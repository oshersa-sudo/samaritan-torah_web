# -*- coding: utf-8 -*-
"""Write dict_infl — the inflected-form index that lets the dictionary answer a
word the reader actually typed.

One row per (surface form, candidate root). A form may carry more than one root:
משה is both the name and the root משח "measure", and the dictionary shows both
rather than gambling on one. Rank 0 is the reading we consider most likely.

Where Memar Marqe's own Hebrew translation contradicts the sense picked off
Tal's entry, the translation wins — it is the text itself saying what the word
means there (אתמר: Tal "עץ דקל" → Marqe "נאמר"). The Tal gloss is kept alongside
in gloss_tal so nothing is lost.

Read-only against every existing table; only (re)creates dict_infl.
Run:  py -3 scripts/dict_expand/build_dict_infl.py
"""
import collections
import os
import pickle
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))
import morph              # noqa: E402
import align_memar as am  # noqa: E402

# The dictionary lives in data/lexicon.db. lexdb.connect() makes it `main` so a
# rebuilt table is created THERE, and attaches torah.db read-only as `torah` so
# reads of verses/tm_sections still resolve unqualified. See scripts/lexdb.py.
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import lexdb

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')
PKL = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'dict_expand',
                   'memar_align.pkl')

AUTO_SCORE = 2       # the band measured at ~93-95% root accuracy
# Marqe's translation overrides Tal's sense only well above the noise floor. At
# 0.6 the aligner still proposed מבלדין→"שאין" and דחלתה→"עוד"; at 0.75 with at
# least three co-occurrences the overrides read clean (מרן→אדוננו, אתמר→נאמר,
# סיני→סיני where Tal had "נעל, שרי סנדליך").
MEMAR_CONF = 0.75
MEMAR_CO = 3         # times the pair must actually co-occur
MEMAR_MINLEN = 3     # a 2-letter Hebrew "equivalent" is a fragment, not a gloss


def corpus(conn):
    """form -> (freq_piyut, freq_memar, src_kind, src_ref)"""
    W = {}

    def touch(w, kind, ref):
        d = W.setdefault(w, [0, 0, kind, ref])
        d[0 if kind == 'piyut' else 1] += 1

    for r in conn.execute("SELECT id, title, text FROM piyutim "
                          "WHERE TRIM(COALESCE(text,''))<>''"):
        for w in re.findall(r'[א-ת]{2,}', r['text']):
            touch(w, 'piyut', str(r['id']))
    for r in conn.execute("SELECT id, book, section, aramaic FROM tm_sections "
                          "WHERE TRIM(COALESCE(aramaic,''))<>''"):
        for w in re.findall(r'[א-ת]{2,}', r['aramaic']):
            touch(w, 'memar', f"{r['book']}:{r['section']}")
    return W


def agrees(he, gloss):
    """Does a one-word Hebrew equivalent already appear in the Tal gloss?"""
    hs = am.he_stem(he)
    gl = [am.he_stem(x) for x in morph.tokens(gloss)]
    return hs in gl or any(am.cognate(hs, g) > 0.8 for g in gl)


def main():
    conn = lexdb.connect()
    conn.row_factory = sqlite3.Row
    lex = morph.Lexicon(DB)
    pk = pickle.load(open(PKL, 'rb')) if os.path.exists(PKL) else {}
    align, surface = pk.get('align', {}), pk.get('surface', {})
    W = corpus(conn)
    print(f"corpus: {len(W)} distinct forms")

    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS dict_infl")
    c.execute("""CREATE TABLE dict_infl (
        form TEXT, form_norm TEXT,
        root TEXT, root_norm TEXT, rank INTEGER,
        derivation TEXT, evidence TEXT, score INTEGER,
        gloss TEXT,          -- the meaning to show
        gloss_tal TEXT,      -- what Tal's entry said, when Marqe overrode it
        memar_he TEXT, memar_conf REAL,
        src_kind TEXT, src_ref TEXT,
        freq_piyut INTEGER, freq_memar INTEGER,
        lang TEXT, status TEXT)""")

    rows, stats = [], collections.Counter()
    for w, (fp, fm, kind, ref) in W.items():
        cands = morph.analyze_all(w, lex, limit=3)
        if not cands:
            stats['unresolved'] += 1
            continue
        al = align.get(morph.norm(w))
        conf = al['conf'] if al else 0.0
        he = surface.get(al['he'], al['he']) if al else ''
        strong = bool(al) and conf >= MEMAR_CONF and al['co'] >= MEMAR_CO \
            and len(al['he']) >= MEMAR_MINLEN

        # Marqe disagrees with rank 0? If one of the other candidate roots agrees
        # instead, that root is promoted; otherwise Marqe's word becomes the gloss.
        corrected = None
        if strong and not agrees(he, cands[0]['gloss']):
            better = next((i for i, x in enumerate(cands) if agrees(he, x['gloss'])), None)
            if better:
                cands.insert(0, cands.pop(better))
                stats['reordered by Marqe'] += 1
            else:
                corrected = he
                stats['gloss taken from Marqe'] += 1

        status = 'auto' if cands[0]['score'] <= AUTO_SCORE else 'review'
        stats[status] += 1
        for i, a in enumerate(cands):
            gloss, gtal = a['gloss'], ''
            if corrected and i == 0:
                gloss, gtal = corrected, a['gloss']
            rows.append((w, morph.norm(w), a.get('root', ''), a.get('root_norm', ''), i,
                         a['derivation'], a['how'], a['score'], gloss, gtal,
                         he, conf, kind, ref, fp, fm, a['lang'], status))

    c.executemany("INSERT INTO dict_infl VALUES (" + ",".join("?" * 18) + ")", rows)
    c.execute("CREATE INDEX ix_infl_norm ON dict_infl(form_norm)")
    c.execute("CREATE INDEX ix_infl_root ON dict_infl(root_norm)")
    c.execute("CREATE INDEX ix_infl_status ON dict_infl(status)")
    conn.commit()

    n_forms = c.execute("SELECT COUNT(DISTINCT form_norm) FROM dict_infl").fetchone()[0]
    n_auto = c.execute("SELECT COUNT(DISTINCT form_norm) FROM dict_infl "
                       "WHERE status='auto'").fetchone()[0]
    multi = c.execute("SELECT COUNT(*) FROM (SELECT form_norm FROM dict_infl "
                      "GROUP BY form_norm HAVING COUNT(*)>1)").fetchone()[0]
    print(f"dict_infl: {len(rows)} rows / {n_forms} forms "
          f"({n_auto} auto, {n_forms-n_auto} review); {multi} forms with >1 root")
    for k, v in stats.most_common():
        print(f"   {k}: {v}")
    conn.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
