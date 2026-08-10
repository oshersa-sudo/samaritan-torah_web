# -*- coding: utf-8 -*-
"""
Verify that verses.arabic_trans is aligned to the verse it belongs to.

The Arabic column was scrambled once before (Genesis, from 2:17 onwards) and was
repaired by later re-alignment runs. Before feeding it into anything that treats
it as evidence about a particular verse, we need positive proof that the repair
held - a silently shifted translation would attach one verse's reading to its
neighbour, which is worse than having no Arabic at all.

Method: proper-noun anchoring. Hebrew names transliterate into Arabic
recognisably (אברהם -> إبراهيم, משה -> موسى, פרעה -> فرعون ...). For every verse
carrying at least one such name we ask which Arabic verse - the aligned one, or
one of its neighbours - best accounts for those names. If the column is sound,
offset 0 wins nearly always; a shifted region shows up as a run of verses whose
best offset is a constant non-zero number.

Read-only. Usage:  py -3 scripts/check_arabic_alignment.py
"""
import os
import re
import sys
import io
import sqlite3
from collections import defaultdict

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_ROOT, 'data', 'torah.db')

# canonical name -> (hebrew forms, arabic forms). Arabic forms are matched after
# normalisation, so only the consonantal skeleton has to be right.
NAMES = {
    'abraham': (['אברהם', 'אברם'],           ['ابرهيم', 'ابراهيم', 'ابرام']),
    'isaac':   (['יצחק'],                     ['اسحق', 'اسحاق']),
    'jacob':   (['יעקב'],                     ['يعقوب']),
    'joseph':  (['יוסף'],                     ['يوسف']),
    'moses':   (['משה'],                      ['موسى', 'موسي']),
    'aaron':   (['אהרן'],                     ['هارون']),
    'pharaoh': (['פרעה'],                     ['فرعون']),
    'israel':  (['ישראל'],                    ['اسرءيل', 'اسراءيل', 'اسرائيل']),
    'egypt':   (['מצרים', 'מצרימה'],          ['مصر']),
    'noah':    (['נח'],                       ['نوح']),
    'lot':     (['לוט'],                      ['لوط']),
    'sarah':   (['שרה', 'שרי'],               ['سارة', 'ساراي', 'سارا']),
    'rebecca': (['רבקה'],                     ['رفقة', 'رفقه']),
    'rachel':  (['רחל'],                      ['راحيل']),
    'leah':    (['לאה'],                      ['ليئة', 'ليه']),
    'esau':    (['עשו'],                      ['عيسو']),
    'laban':   (['לבן'],                      ['لابان']),
    'canaan':  (['כנען', 'כנענה'],            ['كنعان']),
    'sinai':   (['סיני'],                     ['سيني', 'سينا']),
    'judah':   (['יהודה'],                    ['يهوذا']),
    'reuben':  (['ראובן'],                    ['راوبين', 'رءوبين']),
    'simeon':  (['שמעון'],                    ['شمعون']),
    'levi':    (['לוי'],                      ['لاوي']),
    'benjamin':(['בנימין', 'בנימן'],          ['بنيامين']),
    'ephraim': (['אפרים'],                    ['افرايم', 'افريم']),
    'gerizim': (['גריזים'],                   ['غريزيم', 'جريزيم']),
}


def norm_ar(s):
    """Fold Arabic to a comparable skeleton: drop diacritics/tatweel and
    normalise the alef, ya and ta-marbuta families that vary by orthography."""
    s = re.sub(r'[ً-ٰٟـ]', '', s or '')
    s = re.sub(r'[آأإٱ]', 'ا', s)   # آأإٱ -> ا
    s = s.replace('ى', 'ي')                        # ى -> ي
    s = s.replace('ة', 'ه')                        # ة -> ه
    s = s.replace('ؤ', 'و').replace('ئ', 'ي')  # ؤ ئ
    s = s.replace('ء', '')                              # bare hamza
    return s


AR_NORM = {k: [norm_ar(a) for a in v[1]] for k, v in NAMES.items()}


# Whole-token matching, NOT substring: plain `'עשו' in text` fires inside
# "לעשות", 'נח' inside "וינחהו" and "נחמד", 'שרי' inside "מבשרי". Those false
# hits made a quarter of the corpus look unanalysable. We instead build every
# legal prefixed spelling of each name and compare whole tokens, so "לבן" the
# name is still found while "לבנת" is not.
_HE_PREFIX = ['', 'ו', 'ה', 'ב', 'ל', 'מ', 'כ', 'ש', 'וב', 'ול', 'וה', 'ומ', 'וכ',
              'לכ', 'מה', 'בה', 'כה', 'שב', 'של', 'ומה']
_HE_FORMS = {}
for _k, (_hebs, _) in NAMES.items():
    _HE_FORMS[_k] = {p + h for h in _hebs for p in _HE_PREFIX}

_AR_PREFIX = ['', 'و', 'ال', 'وال', 'ب', 'ل', 'ف', 'ك', 'بال', 'لل', 'فال', 'كال', 'ولل']
_AR_FORMS = {k: {p + a for a in v for p in _AR_PREFIX} for k, v in AR_NORM.items()}


def he_names(text):
    toks = set(re.findall(r'[א-ת]+', text or ''))
    return {k for k, forms in _HE_FORMS.items() if toks & forms}


def ar_names(text):
    toks = set(re.findall(r'[؀-ۿ]+', norm_ar(text or '')))
    return {k for k, forms in _AR_FORMS.items() if toks & forms}


def main():
    # done here, not at import: hijacking stdout on import closes the shared
    # buffer out from under any caller that imports this module for its helpers
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute('''SELECT b.id, b.name, c.number, v.number, v.text, v.arabic_trans
                           FROM verses v
                           JOIN chapters c ON c.id = v.chapter_id
                           JOIN books  b ON b.id = c.book_id
                           ORDER BY b.id, c.number, CAST(v.number AS INTEGER)''').fetchall()
    conn.close()
    print('verses examined: %d' % len(rows))

    hn = [he_names(r[4]) for r in rows]
    an = [ar_names(r[5]) for r in rows]

    OFFSETS = (-2, -1, 0, 1, 2)
    best_of = []            # per-verse best offset, or None when uninformative
    tally = defaultdict(int)
    informative = 0
    for i, r in enumerate(rows):
        if not hn[i] or not (r[5] or '').strip():
            best_of.append(None)
            continue
        scores = {}
        for k in OFFSETS:
            j = i + k
            if 0 <= j < len(rows) and rows[j][0] == r[0]:   # stay inside the book
                scores[k] = len(hn[i] & an[j]) / float(len(hn[i]))
        if not scores:
            best_of.append(None)
            continue
        top = max(scores.values())
        if top == 0:
            best_of.append('none')
            tally['no-match'] += 1
            informative += 1
            continue
        # a tie that includes 0 counts as aligned - repeated names in adjacent
        # verses are normal and must not be read as evidence of a shift
        winners = [k for k, v in scores.items() if v == top]
        pick = 0 if 0 in winners else winners[0]
        best_of.append(pick)
        tally[pick] += 1
        informative += 1

    print('verses with a name anchor AND Arabic: %d\n' % informative)
    print('best-matching offset (0 = correctly aligned):')
    for k in sorted([x for x in tally if x != 'no-match']):
        print('   offset %+d : %5d  (%.1f%%)' % (k, tally[k], 100.0 * tally[k] / informative))
    print('   no match  : %5d  (%.1f%%)' % (tally['no-match'], 100.0 * tally['no-match'] / informative))

    # A real shift is a RUN of same-signed offsets, not scattered singles.
    print('\nruns of >=4 consecutive verses all preferring the same non-zero offset:')
    runs = []
    i = 0
    while i < len(rows):
        k = best_of[i]
        if k in (None, 'none', 0):
            i += 1
            continue
        j = i
        while j + 1 < len(rows) and best_of[j + 1] == k:
            j += 1
        if j - i + 1 >= 4:
            runs.append((rows[i][1], rows[i][2], rows[i][3], rows[j][2], rows[j][3], k, j - i + 1))
        i = j + 1
    if runs:
        for bk, c1, v1, c2, v2, k, n in runs:
            print('   %-8s %s:%s .. %s:%s  offset %+d  (%d verses)' % (bk, c1, v1, c2, v2, k, n))
    else:
        print('   NONE - no systematic shift found')

    # ── name-independent cross-check: windowed length correlation ───────────
    # Names only anchor the verses that happen to carry one; a shifted run in a
    # name-free stretch (Gen 2:9 is exactly that) would slip through. Verse
    # length, however, is always available: a Hebrew verse and its Arabic
    # rendering track each other in length, so over a window the correlation
    # peaks at the true offset. This catches region shifts with no names at all.
    def pearson(xs, ys):
        n = len(xs)
        if n < 4:
            return 0.0
        mx, my = sum(xs) / n, sum(ys) / n
        num = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
        dx = sum((a - mx) ** 2 for a in xs) ** .5
        dy = sum((b - my) ** 2 for b in ys) ** .5
        return num / (dx * dy) if dx and dy else 0.0

    print('\nwindowed length-correlation (name-independent), windows preferring a shift:')
    W = 21
    by_book = defaultdict(list)
    for i, r in enumerate(rows):
        by_book[(r[0], r[1])].append(i)
    flagged = []
    for (bid, bname), idxs in sorted(by_book.items()):
        hl = [len(rows[i][4] or '') for i in idxs]
        al = [len(rows[i][5] or '') for i in idxs]
        for s in range(0, max(0, len(idxs) - W + 1), W // 3 or 1):
            win = range(s, min(s + W, len(idxs)))
            best, bestk = -2.0, None
            sc = {}
            for k in OFFSETS:
                xs, ys = [], []
                for i in win:
                    j = i + k
                    if 0 <= j < len(idxs) and al[j]:
                        xs.append(hl[i]); ys.append(al[j])
                c = pearson(xs, ys)
                sc[k] = c
                if c > best:
                    best, bestk = c, k
            # only flag a clear win: the shift must beat aligned by a real margin
            if bestk not in (0, None) and best - sc.get(0, 0) > 0.25 and best > 0.5:
                a_i, b_i = idxs[list(win)[0]], idxs[list(win)[-1]]
                flagged.append((bname, rows[a_i][2], rows[a_i][3], rows[b_i][2], rows[b_i][3],
                                bestk, round(best, 2), round(sc.get(0, 0), 2)))
    if flagged:
        for bk, c1, v1, c2, v2, k, cbest, c0 in flagged:
            print('   %-8s %s:%s .. %s:%s  prefers %+d  (r=%.2f vs r=%.2f aligned)'
                  % (bk, c1, v1, c2, v2, k, cbest, c0))
    else:
        print('   NONE - length correlation peaks at offset 0 everywhere')

    # per-book summary
    print('\nper book (share of informative verses that align at offset 0):')
    per = defaultdict(lambda: [0, 0])
    for i, r in enumerate(rows):
        k = best_of[i]
        if k in (None,):
            continue
        per[r[1]][1] += 1
        if k == 0:
            per[r[1]][0] += 1
    for bk, (ok, tot) in per.items():
        print('   %-8s %5d/%5d  (%.1f%%)' % (bk, ok, tot, 100.0 * ok / max(tot, 1)))


if __name__ == '__main__':
    main()
