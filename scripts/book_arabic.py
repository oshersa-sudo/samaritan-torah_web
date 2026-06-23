# -*- coding: utf-8 -*-
"""Extract the continuous Arabic translation stream for a book from its docx.

Unlike the Genesis file (one big Arabic cell), the other books spread the Arabic
across several tables/rows; some tables are portion-indexes and some columns are
merged-cell duplicates. We walk the document in order and, for every row, take the
Arabic-bearing cell (de-duplicated), skipping small index tables — concatenating
into one de-tashkeel Arabic stream in verse order.

Regexes use \\u escapes (typing Arabic diacritics directly can reorder them via bidi
and silently eat the letters).
"""
import re

DOCX = {
    'שמות':  'ואלה שמותצ B.docx',
    'ויקרא': 'ויקראט C.docx',
    'במדבר': 'במדבר סיני D.docx',
    'דברים': 'E דברים.docx',
    'בראשית': r'C:\Users\osher\Documents\torah\תרגום צדקה אלכים\בראשית A (1).docx',
}
_ARLET = re.compile('[ء-ي]')                       # Arabic letters
TASH = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭ]')  # diacritics only


def _plain(s):
    s = TASH.sub('', s)
    s = s.replace('ـ', '')                              # tatweel
    return re.sub(r'\s+', ' ', s).strip()


def _arcount(s):
    return len(_ARLET.findall(s))


def load_stream(book):
    import docx
    doc = docx.Document(DOCX[book])
    parts = []
    for t in doc.tables:
        ncol = len(t.columns)
        tot = sum(_arcount(c.text) for r in t.rows for c in r.cells)
        if ncol >= 5 and len(t.rows) <= 2 and tot < 400:    # skip portion-index tables
            continue
        for row in t.rows:
            seen = None
            for cell in row.cells:
                tx = cell.text
                if _arcount(tx) >= 30 and tx != seen:        # the Arabic cell (dedupe merged)
                    parts.append(_plain(tx))
                    seen = tx
    return ' '.join(p for p in parts if p)


if __name__ == '__main__':
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    for bk in ['שמות', 'ויקרא', 'במדבר', 'דברים']:
        s = load_stream(bk)
        print('=== %s ===  stream chars: %d' % (bk, len(s)))
        print('   START:', s[:160])
        print('   END  :', s[-110:])
