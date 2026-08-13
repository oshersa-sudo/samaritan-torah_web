# -*- coding: utf-8 -*-
"""Mark every derived form→root reading in dict_infl with the evidence that
backs it, so the dictionary can offer derivations without guessing.

A derivation on its own proves nothing — peeling ־ה off קמאה reaches קמא
"בוז, ביזיון", a word it has nothing to do with. But a derivation that a second,
independent source agrees with is safe to show. Three sources, in order of
authority:

  dict   the dictionary itself lists this form under this root (dict_form_root)
  memar  Memar Marqe's own Hebrew translation of this very word says what the
         root means
  torah  the Torah word-glossary's meaning for this word says what the root means

Anything none of the three can vouch for stays unverified, and the app will not
present a root for it.

Adds/fills dict_infl.verified; touches nothing else.
Run:  py -3 scripts/dict_expand/verify_infl.py
"""
import collections
import os
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))
import morph  # noqa: E402

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')


def he_stem(w):
    w = morph.norm(w)
    return w[1:] if (len(w) >= 4 and w[0] in 'הובלכמש') else w


def says_same(gloss, hebrew):
    """Does a root's dictionary meaning say what this Hebrew rendering says?"""
    if not gloss or not hebrew:
        return False
    m = he_stem(hebrew)
    if len(m) < 2:
        return False
    for tok in morph.tokens(gloss):
        g = he_stem(tok)
        if g == m or (len(g) >= 3 and len(m) >= 3 and (g.startswith(m) or m.startswith(g))):
            return True
    return False


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    if 'verified' not in [r[1] for r in c.execute("PRAGMA table_info(dict_infl)")]:
        c.execute("ALTER TABLE dict_infl ADD COLUMN verified TEXT")

    attested = collections.defaultdict(set)
    for r in c.execute("SELECT form_norm, root_norm FROM dict_form_root"):
        attested[r['form_norm']].add(r['root_norm'])

    torah = {}
    for r in c.execute("SELECT word, gloss FROM tal_word_gloss "
                       "WHERE TRIM(COALESCE(gloss,''))<>''"):
        torah.setdefault(morph.norm(r['word']), r['gloss'])
    for r in c.execute("SELECT ar, he FROM word_align WHERE TRIM(COALESCE(he,''))<>''"):
        torah.setdefault(morph.norm(r['ar']), r['he'])

    upd, stats = [], collections.Counter()
    for r in c.execute("SELECT rowid, form_norm, root_norm, gloss, gloss_tal, memar_he, "
                       "derivation FROM dict_infl"):
        rn, fn = (r['root_norm'] or '').strip(), r['form_norm']
        gloss = r['gloss_tal'] or r['gloss']
        src = ''
        if not rn:
            src = ''
        elif rn in attested.get(fn, ()):
            src = 'dict'
        elif (r['derivation'] or '').strip() in ('', 'המילה כמות שהיא'):
            # not a derivation at all — the form IS the dictionary's own word
            src = 'dict'
        elif says_same(gloss, r['memar_he']):
            src = 'memar'
        elif says_same(gloss, torah.get(fn, '')):
            src = 'torah'
        stats[src or 'none'] += 1
        upd.append((src, r['rowid']))

    c.executemany("UPDATE dict_infl SET verified=? WHERE rowid=?", upd)
    c.execute("CREATE INDEX IF NOT EXISTS ix_infl_ver ON dict_infl(verified)")
    conn.commit()

    total = sum(stats.values())
    print(f"dict_infl rows: {total}")
    for k in ('dict', 'memar', 'torah', 'none'):
        print(f"   {k:6s}: {stats[k]:6d}  ({100*stats[k]/total:.1f}%)")
    vf = c.execute("SELECT COUNT(DISTINCT form_norm) FROM dict_infl "
                   "WHERE TRIM(COALESCE(verified,''))<>''").fetchone()[0]
    af = c.execute("SELECT COUNT(DISTINCT form_norm) FROM dict_infl").fetchone()[0]
    print(f"forms with at least one verified root: {vf} of {af} ({100*vf/af:.1f}%)")
    conn.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
