# -*- coding: utf-8 -*-
"""Turn the raw collocation counts into a ranked, classified candidate list of
Aramaic set phrases — the מטבעות לשון — for the dictionary.

Three classes, decided offline:
  formula  — a fixed epithet or liturgical formula (נביה רבה משה, לית אלה אלא אחד)
  idiom    — the Hebrew translation does NOT render it word-for-word, so the
             phrase means something its parts do not (עד מותר = "עד מאוד")
  free     — two words that merely stand next to each other (אמר לה, לא הוה)

The idiom test is the useful one and it is evidence-based: for each component word
we already know, from Memar Marqe's own Hebrew translation, which Hebrew word faces
it. If the Hebrew of the passage contains those words, the phrase is compositional;
if the Hebrew says something else entirely, the phrase is idiomatic.

Run:  py -3 scripts/dict_expand/phrases.py
"""
import collections
import math
import os
import pickle
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))
import morph              # noqa: E402
import align_memar as am  # noqa: E402

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'dict_expand')
PKL = os.path.join(OUT, 'memar_align.pkl')

MIN_COUNT = 3
MIN_PMI = 1.0     # association strength; below this the words just co-occur

# Words that make a sequence a title/formula rather than a sentence fragment.
TITLE = set('נביה רבה מרן מרה אלה אלהה קשטה מלכה כהנה מלאך רוח קדישה עלמה'.split())


def load():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    mem = conn.execute("SELECT book, section, aramaic, hebrew FROM tm_sections "
                       "WHERE TRIM(COALESCE(aramaic,''))<>''").fetchall()
    piy = conn.execute("SELECT id, title, text FROM piyutim "
                       "WHERE TRIM(COALESCE(text,''))<>''").fetchall()
    conn.close()
    return mem, piy


def ngrams(token_lists, n_range=(2, 3)):
    """counts, unigram counts, and for each phrase one (key, relative position) —
    the position matters: compositionality has to be judged against the stretch of
    Hebrew facing the phrase, not against the whole passage, where almost any word
    turns up somewhere and every phrase looks compositional."""
    cnt, uni, where = collections.Counter(), collections.Counter(), {}
    for key, toks in token_lists:
        uni.update(toks)
        for n in n_range:
            for i in range(len(toks) - n + 1):
                g = tuple(toks[i:i + n])
                cnt[g] += 1
                where.setdefault(g, (key, i / max(1, len(toks))))
    return cnt, uni, where


def he_window(hebrew, frac, width=0.28):
    """The slice of the Hebrew translation facing a phrase that sits `frac` of the
    way through the Aramaic passage."""
    toks = morph.tokens(hebrew)
    if not toks:
        return set()
    lo = max(0, int((frac - width / 2) * len(toks)))
    hi = min(len(toks), int((frac + width / 2) * len(toks)) + 3)
    return set(am.he_stem(x) for x in toks[lo:hi])


def pmi(g, cnt, uni, total):
    """How much more often the words appear together than chance would give."""
    p_joint = cnt[g] / total
    p_parts = 1.0
    for w in g:
        p_parts *= uni[w] / total
    return math.log(p_joint / p_parts, 2) if p_parts > 0 and p_joint > 0 else 0.0


def main():
    os.makedirs(OUT, exist_ok=True)
    mem, piy = load()
    align = pickle.load(open(PKL, 'rb'))['align'] if os.path.exists(PKL) else {}

    mem_toks = [((r['book'], r['section']), [morph.norm(w) for w in
                 re.findall(r'[א-ת]{2,}', r['aramaic'])]) for r in mem]
    piy_toks = [((r['id'], r['title']), [morph.norm(w) for w in
                 re.findall(r'[א-ת]{2,}', r['text'])]) for r in piy]
    heb = {(r['book'], r['section']): (r['hebrew'] or '') for r in mem}

    rows = []
    for corpus, toks, kind in (('memar', mem_toks, 'memar'), ('piyut', piy_toks, 'piyut')):
        cnt, uni, where = ngrams(toks)
        total = sum(uni.values())
        for g, c in cnt.items():
            if c < MIN_COUNT:
                continue
            if all(w in am.AR_STOP for w in g):
                continue
            score = pmi(g, cnt, uni, total)
            if score < MIN_PMI:
                continue
            phrase = ' '.join(g)
            key, frac = where[g]

            # Is the passage's Hebrew rendering word-for-word? Only Marqe can answer.
            cls, he_hits, he_of = 'free', 0, []
            if kind == 'memar':
                hset = he_window(heb.get(key, ''), frac)
                for w in g:
                    a = align.get(w)
                    if a and am.he_stem(a['he']) in hset:
                        he_hits += 1
                        he_of.append(a['he'])
                known = sum(1 for w in g if w in align)
                if known and he_hits < known:      # translation says something else
                    cls = 'idiom'
                elif known and he_hits == known:
                    cls = 'free'
                else:
                    cls = 'unknown'
            if any(w in TITLE for w in g) and score >= 2.0:
                cls = 'formula'
            if kind == 'piyut' and cls in ('free', 'unknown'):
                cls = 'formula' if any(w in TITLE for w in g) else 'unknown'

            rows.append({'phrase': phrase, 'count': c, 'pmi': round(score, 2),
                         'cls': cls, 'corpus': corpus,
                         'ref': (f"מימר מרקה {key[0]}:{key[1]}" if kind == 'memar'
                                 else f"פיוט #{key[0]} — {key[1]}"),
                         'he_parts': ' '.join(he_of)})

    rows.sort(key=lambda r: (-r['count'], -r['pmi']))
    with open(os.path.join(OUT, 'phrase_candidates.tsv'), 'w', encoding='utf-8') as f:
        f.write("phrase\tcount\tpmi\tclass\tcorpus\tref\thebrew_parts\n")
        for r in rows:
            f.write(f"{r['phrase']}\t{r['count']}\t{r['pmi']}\t{r['cls']}\t"
                    f"{r['corpus']}\t{r['ref']}\t{r['he_parts']}\n")

    by = collections.Counter(r['cls'] for r in rows)
    print(f"candidates: {len(rows)}  ({dict(by)})")
    for cls in ('formula', 'idiom', 'unknown', 'free'):
        sub = [r for r in rows if r['cls'] == cls][:12]
        print(f"\n── {cls} ({by[cls]}) " + "─" * 50)
        for r in sub:
            print(f"  {r['count']:4d}  pmi {r['pmi']:5.2f}  {r['phrase'][:38].ljust(40)} {r['corpus']}")
    print(f"\n→ {os.path.join(OUT, 'phrase_candidates.tsv')}")


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
