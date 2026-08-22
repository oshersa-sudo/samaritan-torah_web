# -*- coding: utf-8 -*-
"""Write dict_phrase — the Aramaic set phrases (מטבעות לשון) of the piyyutim and
Memar Marqe, with the Hebrew each one actually gets in Marqe's own translation.

Two classes are kept, per the decision: `formula` (fixed epithets and liturgical
formulas) and `idiom` (phrases whose Hebrew is not a word-for-word rendering of
their parts). Free combinations — אמר לה, כל אלין — are dropped, not stored.

The Hebrew of a phrase is not guessed from its words. Every occurrence of the
phrase is located in the Aramaic, the facing stretch of the Hebrew translation is
taken, and the Hebrew n-gram that recurs across those stretches is the rendering.
A phrase occurring 24 times gives 24 votes; what survives them is evidence.

Read-only against everything else; only (re)creates dict_phrase.
Run:  py -3 scripts/dict_expand/build_dict_phrase.py
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
import phrases as P       # noqa: E402

# The dictionary lives in data/lexicon.db. lexdb.connect() makes it `main` so a
# rebuilt table is created THERE, and attaches torah.db read-only as `torah` so
# reads of verses/tm_sections still resolve unqualified. See scripts/lexdb.py.
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import lexdb

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')
PKL = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'dict_expand',
                   'memar_align.pkl')

MIN_COUNT = 3
MIN_PMI = 1.0
MIN_VOTE = 0.40      # share of occurrences that must show the same Hebrew n-gram


def he_window(hebrew, frac, n_words=2):
    """The stretch of the Hebrew translation facing a phrase that sits `frac` of
    the way through the Aramaic — IN ORDER. (phrases.he_window returns a set for
    membership tests; an n-gram vote needs the words in the order they were written.)

    The window widens with the phrase: a four-word phrase needs room for a
    four-word rendering plus the slack of an imprecise position estimate, and a
    window sized for a two-word phrase clips it."""
    toks = morph.tokens(hebrew)
    if not toks:
        return []
    width = 0.24 + 0.09 * max(0, n_words - 2)
    lo = max(0, int((frac - width / 2) * len(toks)))
    hi = min(len(toks), int((frac + width / 2) * len(toks)) + n_words + 2)
    return toks[lo:hi]


# A longer rendering is preferred over a shorter one even at some cost in votes:
# the full "אין אלהים אלא אחד" is the answer, not the "ונאמר אין" that happens to
# repeat more often because it is easier to hit.
LONGER_TOL = 0.7


def hebrew_rendering(windows, n_words=2, he_freq=None):
    """The Hebrew n-gram that recurs across the passages facing a phrase.

    Votes are cast on stemmed n-grams so that הנביא and נביא count together, but
    the winner is reported in the spelling it most often actually has."""
    votes = collections.Counter()
    surf = collections.defaultdict(collections.Counter)
    max_n = min(6, n_words + 2)
    for toks in windows:
        stems = [am.he_stem(w) for w in toks]
        seen = set()
        for n in range(max_n, 1, -1):
            for i in range(len(toks) - n + 1):
                g = tuple(stems[i:i + n])
                # a run containing two-letter scraps, or "words" that occur almost
                # nowhere else in the Hebrew ("יהו ינו"), is OCR debris winning a
                # vote rather than a rendering
                if g in seen or any(len(w) < 3 for w in g) or \
                        all(w in am.HE_STOP for w in g) or \
                        (he_freq and any(he_freq.get(w, 0) < 3 for w in g)):
                    continue
                seen.add(g)
                votes[g] += 1
                surf[g][' '.join(toks[i:i + n])] += 1
    if not votes:
        return '', 0.0
    top = max(votes.values())
    # Among the well-supported candidates, take the one whose length best matches
    # the Aramaic phrase — a four-word phrase is rendered by roughly four words, so
    # this picks "אין אלהים אלא אחד" over the shorter run that merely repeats more.
    best = max((g for g, v in votes.items() if v >= top * LONGER_TOL),
               key=lambda g: (-abs(len(g) - n_words), votes[g]))
    return surf[best].most_common(1)[0][0], votes[best] / max(1, len(windows))


def main():
    conn = lexdb.connect()
    conn.row_factory = sqlite3.Row
    align = pickle.load(open(PKL, 'rb'))['align'] if os.path.exists(PKL) else {}

    mem = conn.execute("SELECT book, section, aramaic, hebrew FROM tm_sections "
                       "WHERE TRIM(COALESCE(aramaic,''))<>''").fetchall()
    piy = conn.execute("SELECT id, title, text FROM piyutim "
                       "WHERE TRIM(COALESCE(text,''))<>''").fetchall()

    mem_toks = [((r['book'], r['section']), [morph.norm(w) for w in
                 re.findall(r'[א-ת]{2,}', r['aramaic'])]) for r in mem]
    piy_toks = [((r['id'], r['title']), [morph.norm(w) for w in
                 re.findall(r'[א-ת]{2,}', r['text'])]) for r in piy]
    heb = {(r['book'], r['section']): (r['hebrew'] or '') for r in mem}

    # every occurrence of every phrase, not just the first
    occ = collections.defaultdict(list)      # phrase -> [(corpus, key, frac)]
    uni = {'memar': collections.Counter(), 'piyut': collections.Counter()}
    for corpus, toks in (('memar', mem_toks), ('piyut', piy_toks)):
        for key, ts in toks:
            uni[corpus].update(ts)
            for n in (2, 3, 4):
                for i in range(len(ts) - n + 1):
                    occ[(corpus, tuple(ts[i:i + n]))].append((key, i / max(1, len(ts))))

    # Matching runs on folded tokens (ן→נ), but an entry has to be spelled the way
    # the manuscripts spell it — otherwise the dictionary lists "בתר כנ" for בתר כן.
    ar_surface = collections.defaultdict(collections.Counter)
    for r in mem:
        for w in re.findall(r'[א-ת]{2,}', r['aramaic'] or ''):
            ar_surface[morph.norm(w)][w] += 1
    for r in piy:
        for w in re.findall(r'[א-ת]{2,}', r['text'] or ''):
            ar_surface[morph.norm(w)][w] += 1
    ar_surface = {k: v.most_common(1)[0][0] for k, v in ar_surface.items()}

    # How often each Hebrew word occurs across the whole translation — a real word
    # recurs, an OCR fragment does not, and that alone keeps "יהו ינו" out.
    he_freq = collections.Counter()
    for r in mem:
        for w in morph.tokens(r['hebrew']):
            he_freq[am.he_stem(w)] += 1

    # gloss for a piyyut phrase: the rank-0 meanings of its words, joined
    infl = {}
    for r in conn.execute("SELECT form_norm, gloss FROM dict_infl WHERE rank=0"):
        infl.setdefault(r['form_norm'], r['gloss'])

    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS dict_phrase")
    c.execute("""CREATE TABLE dict_phrase (
        phrase TEXT, phrase_norm TEXT, n_words INTEGER,
        count INTEGER, pmi REAL, cls TEXT, corpus TEXT,
        hebrew TEXT,       -- the rendering Marqe's own translation gives it
        support REAL,      -- share of occurrences that agreed on it
        parts_gloss TEXT,  -- word-by-word meaning, for phrases with no translation
        ref TEXT, status TEXT)""")

    rows, stats, untestable = [], collections.Counter(), []
    for (corpus, g), where in occ.items():
        cnt = len(where)
        if cnt < MIN_COUNT or all(w in am.AR_STOP for w in g):
            continue
        # A sequence that is mostly two-letter tokens is OCR debris pairing up
        # (לכ דנ, יה לה), not a phrase — no amount of frequency redeems it.
        if sum(1 for w in g if len(w) < 3) * 2 > len(g):
            stats['dropped (two-letter debris)'] += 1
            continue
        total = sum(uni[corpus].values())
        score = P.pmi({g: cnt}, {g: cnt}, uni[corpus], total) if False else None
        p_joint = cnt / total
        p_parts = 1.0
        for w in g:
            p_parts *= uni[corpus][w] / total
        score = math.log(p_joint / p_parts, 2) if p_parts > 0 else 0.0
        if score < MIN_PMI:
            continue

        he, support = '', 0.0
        cls = 'unknown'
        if corpus == 'memar':
            wins = [w for w in (he_window(heb.get(k, ''), f, len(g)) for k, f in where) if w]
            he, support = hebrew_rendering(wins, len(g), he_freq)
            hits = known = 0
            hset = set(am.he_stem(x) for w in wins for x in w)
            for w in g:
                if w in align:
                    known += 1
                    hits += am.he_stem(align[w]['he']) in hset
            if known and hits < known:
                cls = 'idiom'
            elif known:
                cls = 'free'
        if any(w in P.TITLE for w in g) and score >= 2.0:
            cls = 'formula'
        if cls == 'free':
            stats['dropped (free)'] += 1
            continue
        if cls == 'unknown':
            # A piyyut phrase has no translation facing it, so nothing here can
            # tell an idiom from two words in a row. Those go to a side file for
            # review rather than into the dictionary on a guess.
            stats['side file (piyyut, untestable)'] += 1
            untestable.append((' '.join(g), cnt, round(score, 2),
                               ' · '.join((infl.get(w) or w).split(';')[0][:22] for w in g),
                               f"פיוט #{where[0][0][0]} — {where[0][0][1]}"))
            continue

        # A rendering only a fifth of the occurrences agree on is the window vote
        # catching a neighbouring phrase. Better to show the word-by-word meaning
        # than a confident-looking wrong translation.
        if support < 0.35:
            he, support = '', 0.0
        parts = ' · '.join((infl.get(w) or w).split(';')[0][:22] for w in g)
        # An idiom is only settled when a Hebrew rendering actually recurred; a
        # high support score over an empty rendering settles nothing.
        status = 'auto' if (cls == 'formula' and score >= 4.0) or \
                           (cls == 'idiom' and he and support >= MIN_VOTE) else 'review'
        stats[f'{cls}/{status}'] += 1
        k, _ = where[0]
        shown = ' '.join(ar_surface.get(w, w) for w in g)
        rows.append((shown, ' '.join(g), len(g), cnt, round(score, 2), cls, corpus,
                     he, round(support, 2), parts,
                     (f"מימר מרקה {k[0]}:{k[1]}" if corpus == 'memar'
                      else f"פיוט #{k[0]} — {k[1]}"), status))

    c.executemany("INSERT INTO dict_phrase VALUES (" + ",".join("?" * 12) + ")", rows)
    c.execute("CREATE INDEX ix_phr_norm ON dict_phrase(phrase_norm)")
    c.execute("CREATE INDEX ix_phr_cls ON dict_phrase(cls)")
    conn.commit()
    untestable.sort(key=lambda r: -r[1])
    side = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'dict_expand',
                        'phrase_review_piyut.tsv')
    with open(side, 'w', encoding='utf-8') as f:
        f.write("phrase\tcount\tpmi\tparts_gloss\tref\n")
        for r in untestable:
            f.write("\t".join(str(x) for x in r) + "\n")
    print(f"dict_phrase: {len(rows)} phrases   (+{len(untestable)} -> {os.path.basename(side)})")
    for k, v in stats.most_common():
        print(f"   {k}: {v}")
    conn.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
