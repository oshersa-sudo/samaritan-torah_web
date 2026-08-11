# -*- coding: utf-8 -*-
"""Derive Hebrew meanings for Memar Marqe vocabulary from Memar Marqe's OWN
Hebrew translation — 409 parallel Aramaic/Hebrew passages already in tm_sections.

Method: IBM Model 1 (EM, unsupervised, offline) over the passage pairs, seeded
with a cognate prior, since Samaritan Aramaic and Hebrew share most of their
consonantal skeletons. The output is, per Aramaic form, the Hebrew word the
translation actually puts opposite it — independent evidence that can either
confirm the meaning derived from Tal's dictionary or stand in where Tal has none.

Also pulls recurring multi-word Aramaic collocations (the מטבעות לשון) with the
Hebrew phrase the translation gives them.

Run:  py -3 scripts/dict_expand/align_memar.py
"""
import collections
import math
import os
import pickle
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import morph  # noqa: E402

import sqlite3

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'dict_expand')

# Hebrew function words that co-occur with everything and would otherwise win
# every alignment.
HE_STOP = set("""את של אל על כי לא לו לה הוא היא הם הן אשר כל זה זאת אלה גם אך רק
אם או כמו אין יש לי לך לנו להם אני אתה אנחנו אתם מה מי כן עד אז שם פה בו בה בהם
בכל מן מ ו ה ב ל כ ש כאשר לפני אחרי בין תחת אצל עם ואת ואל ועל וכל והוא ולא כך
היה היו יהיה להיות אותו אותה אותם דבר דברים אמר אמרה אמרו
בראשית שמות ויקרא במדבר דברים""".split())   # ← book names: the Hebrew side carries
# verse citations ("שמות ג,טז") that would otherwise align with whatever stands near them
AR_STOP = set("""ית דו די דא דה ו ה ב ל כ ד מן על אל לא הוא היא הן אנה אנן את
אתון כל כד כי לה לון לון לך לי מה מן עד כן הן לית אית ולא ועל וכל""".split())


def tokens(s):
    return [morph.norm(w) for w in morph.tokens(s)]


def he_stem(w):
    """Hebrew word minus one proclitic — so האמת and אמת compare equal."""
    w = morph.norm(w)
    if len(w) >= 4 and w[0] in 'הובלכמש':
        return w[1:]
    return w


_SENT = re.compile(r'[.!?;:•]|\s[־–—]\s')


def _chunks(s, n):
    """Split a passage into ~n sentence-ish pieces, keeping order."""
    parts = [p for p in _SENT.split(s or '') if re.search(r'[א-ת]', p)]
    if len(parts) <= n:
        return parts
    # merge adjacent pieces down to n, proportionally by length
    step = len(parts) / n
    out, i = [], 0.0
    while i < len(parts):
        j = min(len(parts), int(round(i + step)))
        out.append(' '.join(parts[int(i):max(j, int(i) + 1)]))
        i = max(j, int(i) + 1)
    return out


def load_pairs(segment=True):
    """Parallel passages, optionally cut into shorter aligned segments. Aramaic
    and Hebrew are split into the SAME number of pieces and paired in order —
    the translation is passage-faithful, so k-th piece faces k-th piece. Short
    pairs make Model 1 far sharper than one 130-token block would."""
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    pairs = []
    for r in conn.execute("SELECT id, book, section, aramaic, hebrew FROM tm_sections "
                          "WHERE TRIM(COALESCE(aramaic,''))<>'' "
                          "  AND TRIM(COALESCE(hebrew,''))<>''"):
        if not segment:
            a, h = tokens(r['aramaic']), tokens(r['hebrew'])
            if a and h:
                pairs.append((r['id'], r['book'], r['section'], a, h))
            continue
        n = max(1, min(len(_SENT.split(r['aramaic'])), len(_SENT.split(r['hebrew']))))
        n = max(1, min(n, len(tokens(r['aramaic'])) // 8 or 1))
        ac, hc = _chunks(r['aramaic'], n), _chunks(r['hebrew'], n)
        n = min(len(ac), len(hc))
        for k in range(n):
            a, h = tokens(ac[k]), tokens(hc[k])
            if a and h:
                pairs.append((r['id'], r['book'], r['section'], a, h))
    conn.close()
    return pairs


def cognate(a, h):
    """Consonantal closeness of an Aramaic and a Hebrew word, 0..1. Handles the
    regular correspondences (ת~ש, ע~א/ט, ד~ז) that separate the two languages."""
    sub = str.maketrans({'ש': 'ת', 'ז': 'ד', 'ט': 'צ'})
    x, y = a.translate(sub), h.translate(sub)
    if x == y:
        return 1.0
    # longest common subsequence ratio
    m, n = len(x), len(y)
    prev = [0] * (n + 1)
    for i in range(m):
        cur = [0] * (n + 1)
        for j in range(n):
            cur[j + 1] = prev[j] + 1 if x[i] == y[j] else max(prev[j + 1], cur[j])
        prev = cur
    return 2.0 * prev[n] / (m + n)


def ibm1(pairs, iters=6):
    """t(h|a) after `iters` EM passes, initialised from the cognate prior."""
    ar_vocab = collections.Counter()
    for _, _, _, a, h in pairs:
        ar_vocab.update(a)
    # candidate Hebrew words per Aramaic word = those co-occurring in some passage
    cand = collections.defaultdict(set)
    for _, _, _, a, h in pairs:
        hs = set(h)
        for w in set(a):
            cand[w] |= hs

    t = {}
    for a_w, hs in cand.items():
        prior = {h_w: 0.05 + cognate(a_w, h_w) for h_w in hs}
        z = sum(prior.values()) or 1.0
        t[a_w] = {h_w: p / z for h_w, p in prior.items()}

    for _ in range(iters):
        cnt = collections.defaultdict(lambda: collections.defaultdict(float))
        tot = collections.defaultdict(float)
        for _, _, _, a, h in pairs:
            for h_w in h:
                z = sum(t[a_w].get(h_w, 0.0) for a_w in a) or 1e-12
                for a_w in a:
                    p = t[a_w].get(h_w, 0.0)
                    if p:
                        d = p / z
                        cnt[a_w][h_w] += d
                        tot[a_w] += d
        for a_w in t:
            z = tot[a_w] or 1e-12
            t[a_w] = {h_w: c / z for h_w, c in cnt[a_w].items()}
    return t, ar_vocab


def best_pairs(t, ar_vocab, pairs, min_freq=2):
    """Top Hebrew equivalent per Aramaic form, with the co-occurrence count and a
    confidence that blends the model probability with the cognate score."""
    co = collections.defaultdict(collections.Counter)
    for _, _, _, a, h in pairs:
        for a_w in set(a):
            co[a_w].update(set(h))
    out = {}
    for a_w, dist in t.items():
        if ar_vocab[a_w] < min_freq or a_w in AR_STOP:
            continue
        ranked = sorted(((p, h_w) for h_w, p in dist.items()
                         if h_w not in HE_STOP and len(h_w) >= 3),
                        reverse=True)[:4]
        if not ranked:
            continue
        p, h_w = ranked[0]
        c = co[a_w][h_w]
        if c < 2:
            continue
        # Confidence = how far the winner is clear of the runner-up (margin),
        # tempered by how often the pair was actually seen together. The cognate
        # score is deliberately NOT folded in: the interesting cases are the
        # non-cognate ones, and rewarding look-alikes would only flatter them.
        second = ranked[1][0] if len(ranked) > 1 else 0.0
        margin = (p - second) / p if p else 0.0
        support = min(1.0, math.log(1 + c) / math.log(9))
        conf = round(0.65 * margin + 0.35 * support, 3)
        out[a_w] = {'he': h_w, 'p': p, 'co': c, 'freq': ar_vocab[a_w],
                    'conf': conf, 'alts': [h for _, h in ranked[1:]]}
    return out


def collocations(pairs, min_count=3):
    """Recurring 2- and 3-word Aramaic sequences — the מטבעות לשון themselves."""
    ngr = collections.Counter()
    where = {}
    for sid, book, sec, a, h in pairs:
        for n in (2, 3):
            for i in range(len(a) - n + 1):
                g = tuple(a[i:i + n])
                if all(w in AR_STOP for w in g):
                    continue
                ngr[g] += 1
                where.setdefault(g, (sid, book, sec))
    return [(' '.join(g), c, where[g]) for g, c in ngr.most_common() if c >= min_count]


def main():
    os.makedirs(OUT, exist_ok=True)
    pairs = load_pairs()
    print(f"parallel passages: {len(pairs)}")
    t, ar_vocab = ibm1(pairs)
    bp = best_pairs(t, ar_vocab, pairs)
    print(f"aligned forms: {len(bp)} (of {len(ar_vocab)} distinct Aramaic forms)")

    # ── validation: on forms where Tal's dictionary already gives a meaning,
    # does the aligner agree? That is the only honest way to trust it elsewhere.
    lex = morph.Lexicon(DB)
    checked = []
    for a_w, d in bp.items():
        a = morph.analyze(a_w, lex)
        if not a or not a['gloss']:
            continue
        # Compare on Hebrew stems (drop one proclitic) so האמת ≡ אמת, and allow a
        # near-cognate match so עולם ≡ עולמי.
        gl = set(he_stem(x) for x in morph.tokens(a['gloss']))
        hs = he_stem(d['he'])
        hit = hs in gl or any(cognate(hs, g) > 0.8 for g in gl)
        checked.append((a_w, d['he'], a['gloss'], hit, d['conf']))
    agree = sum(1 for c in checked if c[3])
    tot = len(checked)
    print(f"validation against Tal: {agree}/{tot} agree ({100*agree/max(1,tot):.0f}%)")
    for th in (0.3, 0.45, 0.6, 0.75):
        sub = [s for s in checked if s[4] >= th]
        if sub:
            print(f"   conf>={th}: {sum(1 for s in sub if s[3])}/{len(sub)} "
                  f"({100*sum(1 for s in sub if s[3])/len(sub):.0f}%)")
    # Fairer slice: Tal glosses that are themselves a one/two-word equivalent, where
    # a single Hebrew word is the right kind of answer at all.
    short = [c for c in checked if len(morph.tokens(c[2])) <= 2]
    if short:
        print(f"   on short Tal glosses (≤2 words): "
              f"{sum(1 for s in short if s[3])}/{len(short)} "
              f"({100*sum(1 for s in short if s[3])/len(short):.0f}%)")
        hi = [s for s in short if s[4] >= 0.6]
        if hi:
            print(f"   short glosses & conf>=0.6: {sum(1 for s in hi if s[3])}/{len(hi)} "
                  f"({100*sum(1 for s in hi if s[3])/len(hi):.0f}%)")

    cols = collocations(pairs)
    print(f"collocations (>=3 occurrences): {len(cols)}")

    # Alignment works on normalised tokens (ן→נ), but a gloss has to be shown in
    # real spelling — so keep the commonest surface form behind each normal form.
    surf = collections.defaultdict(collections.Counter)
    conn = sqlite3.connect(DB)
    for (h,) in conn.execute("SELECT hebrew FROM tm_sections WHERE hebrew IS NOT NULL"):
        for w in morph.tokens(h):
            surf[morph.norm(w)][w] += 1
    conn.close()
    surface = {k: v.most_common(1)[0][0] for k, v in surf.items()}

    with open(os.path.join(OUT, 'memar_align.pkl'), 'wb') as f:
        pickle.dump({'align': bp, 'colloc': cols, 'surface': surface}, f)
    print(f"written -> {os.path.join(OUT, 'memar_align.pkl')}")

    print("\nsample alignments (high confidence, not already in Tal):")
    n = 0
    for a_w, d in sorted(bp.items(), key=lambda kv: -kv[1]['conf']):
        if d['conf'] < 0.6 or morph.analyze(a_w, lex):
            continue
        print(f"   {a_w:14s} → {d['he']:12s} conf={d['conf']:.2f} freq={d['freq']}")
        n += 1
        if n >= 25:
            break


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
