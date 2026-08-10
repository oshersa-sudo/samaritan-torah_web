# -*- coding: utf-8 -*-
"""
Generic "attach a commentary passage to the verses it talks about" linker.

Written for the Abū l-Faraj ibn al-Kathār commentary on אם בחקתי but deliberately
source-agnostic: any future work whose text cites Torah locations, or quotes the
Torah, can be linked with the same two signals.

  1. EXPLICIT REFERENCE - a citation like "(ויקי כו 12)" or "(דבי כח 10)".
     Book abbreviations follow this edition (ברי / שמי / ויקי / במי / דבי), the
     chapter is in Hebrew letters and the verse in digits. Trailing editorial
     marks such as "נייש" are ignored.

  2. QUOTED SCRIPTURE - a phrase in quotation marks that is a run of words from
     the Torah. Matched on the CONSONANTAL SKELETON (א ה ו י dropped, final
     forms folded), so a quotation spelled מלא still finds a verse spelled חסר
     and the other way round.

Both signals resolve to verse ids in torah.db. The module exposes find_links()
for import; running it directly self-tests the two paths.
"""
import os
import re
import sys
import io
import sqlite3
from collections import defaultdict

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_ROOT, 'data', 'torah.db')

# this edition's abbreviations -> books.id
BOOK_ABBR = {
    'ברי': 1, 'בר': 1, 'בראשית': 1,
    'שמי': 2, 'שמ': 2, 'שמות': 2,
    'ויקי': 3, 'ויק': 3, 'ויקרא': 3,
    'במי': 4, 'במ': 4, 'במדבר': 4,
    'דבי': 5, 'דב': 5, 'דברים': 5,
}

_GEM = {'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
        'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80,
        'צ': 90, 'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
        'ך': 20, 'ם': 40, 'ן': 50, 'ף': 80, 'ץ': 90}

FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}

# "(ויקי כו 12)" and "(דבי כח 10 נייש)" - chapter in letters, verse in digits
REF_RE = re.compile(
    r'\(\s*(' + '|'.join(sorted(BOOK_ABBR, key=len, reverse=True)) + r')\s*[׳\']?\s*'
    r'([א-ת]{1,4})\s*[׳\']?\s+(\d{1,3})')

# a quoted run: this edition uses ״…״ / "…" / ׳…׳
QUOTE_RE = re.compile(r'[״"]([^״"]{6,240})[״"]')


def gematria(s):
    s = re.sub(r'[^א-ת]', '', s or '')
    return sum(_GEM.get(c, 0) for c in s) if s else 0


def fold(s):
    """letters only, final forms normalised"""
    s = ''.join(FIN.get(c, c) for c in re.sub(r'[^א-ת ]+', ' ', s or ''))
    return s.split()


def skel_words(s):
    """consonantal skeleton per word - blind to מלא/חסר spelling"""
    return [re.sub(r'[אהוי]', '', w) or w for w in fold(s)]


class VerseIndex:
    """Torah verses, indexed for both reference lookup and quotation lookup."""

    NGRAM = 4          # a quotation must share at least this many words to count

    def __init__(self, db_path=DB_PATH):
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        self.by_ref = {}                 # (book_id, chapter, verse_str) -> verse id
        self.by_ref_int = {}             # (book_id, chapter, verse_int) -> verse id
        self.ngrams = defaultdict(set)   # skeleton n-gram -> {verse id}
        for r in conn.execute('''SELECT v.id, c.book_id, c.number AS ch, v.number AS vn, v.text
                                 FROM verses v JOIN chapters c ON c.id = v.chapter_id'''):
            key = (r['book_id'], int(r['ch']), str(r['vn']))
            self.by_ref[key] = r['id']
            base = re.match(r'\d+', str(r['vn']))
            if base:
                self.by_ref_int.setdefault((r['book_id'], int(r['ch']), int(base.group())), r['id'])
            sk = skel_words(r['text'])
            for i in range(len(sk) - self.NGRAM + 1):
                self.ngrams[' '.join(sk[i:i + self.NGRAM])].add(r['id'])
        conn.close()

    def by_reference(self, book_id, chapter, verse):
        return (self.by_ref.get((book_id, chapter, str(verse)))
                or self.by_ref_int.get((book_id, chapter, int(verse))))

    SHORT_MAX = 3      # a 2-3 word quote is accepted only if it is nearly unique

    def by_quote(self, quote):
        """Verse ids sharing a run of >=NGRAM skeleton words with the quotation.
        Intersecting the n-grams keeps a common phrase from matching half the
        Torah: only verses carrying the WHOLE quoted run survive."""
        sk = skel_words(quote)
        if len(sk) < 2:
            return set()
        if len(sk) < self.NGRAM:
            # Short quotations are the norm in this commentary ("ואוליך אתכם
            # קוממית"), so refusing them would throw away most of the links.
            # They are safe only when distinctive on two counts. First, the run
            # must carry real substance: dropping א ה ו י leaves a phrase like
            # "אם כל חי" as the threadbare "ם כל ח", which turns up in unrelated
            # verses, so every word must keep at least two consonants and the
            # run at least eight. Second, it must occur in only a few verses -
            # a common phrase is dropped rather than pinned to a dozen places.
            if any(len(w) < 2 for w in sk) or sum(len(w) for w in sk) < 8:
                return set()
            hits = self._contiguous(sk)
            return hits if 0 < len(hits) <= self.SHORT_MAX else set()
        hits = None
        for i in range(len(sk) - self.NGRAM + 1):
            s = self.ngrams.get(' '.join(sk[i:i + self.NGRAM]), set())
            hits = s.copy() if hits is None else (hits & s)
            if not hits:
                return set()
        return hits or set()

    def _contiguous(self, sk):
        """Verses whose skeleton contains `sk` as a contiguous run."""
        if not hasattr(self, '_seq'):
            conn = sqlite3.connect(DB_PATH)
            self._seq = {r[0]: skel_words(r[1]) for r in
                         conn.execute('SELECT id, text FROM verses')}
            conn.close()
        n = len(sk)
        out = set()
        for vid, ws in self._seq.items():
            if any(ws[i:i + n] == sk for i in range(len(ws) - n + 1)):
                out.add(vid)
        return out


def find_links(text, index, home_book=None, home_chapter=None):
    """
    Returns {'refs': [(verse_id, 'ref', shown)], 'quotes': [(verse_id, 'quote', shown)]}.
    home_book/home_chapter, when given, resolve a bare "(כו 12)" that omits the book.
    """
    out = {'refs': [], 'quotes': []}
    seen = set()

    for m in REF_RE.finditer(text or ''):
        bid = BOOK_ABBR[m.group(1)]
        ch = gematria(m.group(2))
        vn = int(m.group(3))
        vid = index.by_reference(bid, ch, vn)
        if vid and (vid, 'ref') not in seen:
            seen.add((vid, 'ref'))
            out['refs'].append((vid, 'ref', m.group(0).strip('( ')))

    for m in QUOTE_RE.finditer(text or ''):
        q = m.group(1)
        for vid in index.by_quote(q):
            if (vid, 'quote') not in seen:
                seen.add((vid, 'quote'))
                out['quotes'].append((vid, 'quote', q[:60]))
    return out


if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    idx = VerseIndex()
    print('indexed n-grams: %d' % len(idx.ngrams))

    SAMPLES = [
        'שנאמר: "והתהלכתי בתוככם" (ויקי כו 12) כי \'לא יהלך\' אלא ב\'מחנה\' הצדיקים',
        'שנאמר: "וראו כל עמי הארץ כי שם יהוה נקרא עליך ויראו ממך" (דבי כח 10)',
        'שנאמר: "ואוליך אתכם קוממית" (ויקי כו 13)',
        'ייאמר במשמע: "והיה אם בא אל אשת אחיו" (ברי לח 9)',
    ]
    for s in SAMPLES:
        r = find_links(s, idx)
        print()
        print('  ', s[:70])
        print('    refs  :', [(v, shown) for v, _k, shown in r['refs']])
        print('    quotes:', [(v, shown[:34]) for v, _k, shown in r['quotes']])
