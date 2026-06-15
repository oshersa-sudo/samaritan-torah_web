# -*- coding: utf-8 -*-
"""Extract the word+stop-mark stream from torah_aziz_ver2.docx in reading order.

Each token is {book, word, mark, table}:
  word  = cleaned Hebrew consonants (finals as written, i.e. none),
  mark  = the trailing Samaritan stop run after the word (':', '.', ':--', '|', ...),
  table = True if it came from one of the scrambled 2-column tables.

Stop marks (per the user): ':' = small stop (עצירה קטנה), '.' = standing (עמידה),
':--' = section / chapter end.
"""
import re
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
HEB = 'א-ת'
_CLEAN = re.compile('[^' + HEB + ']')
# a Hebrew word followed by its immediate (no-space) trailing mark characters
_WORDMARK = re.compile('([' + HEB + ']+)([^\\s' + HEB + ']*)')
# a run of only mark characters (between words, possibly space-separated)
_MARKRUN = re.compile(r'[:.\|\-]+')

BOOK_ANCHORS = [
    ('בראשיתבראאלהים', 'Genesis'),
    ('ואלהשמותבניישראל', 'Exodus'),
    ('ויקראאלמשה', 'Leviticus'),
    ('וידבריהוהאלמשהבמדברסיני', 'Numbers'),
    ('אלההדבריםאשרדבר', 'Deuteronomy'),
]


def clean(t):
    return _CLEAN.sub('', t)


def _norm_mark(raw):
    """Reduce a raw trailing run to a canonical mark.
    Per the user, the marks ')', '|' (incl '|.') and '..' are IGNORED (never inserted)."""
    if not raw:
        return ''
    if '|' in raw:
        return ''            # ignore '|' and '|.'
    if '--' in raw:
        return ':--'          # section / chapter end (not inserted; verse end keeps ׃)
    if raw.count('.') >= 2:
        return ''            # ignore '..' (double period)
    if '.' in raw:
        return '.'            # standing (major stop)
    if ':' in raw:
        return ':'            # small stop (minor)
    return ''                # ')', '<', '_', digits, OCR noise -> ignored


def _emit_text(text, book, table, out):
    last_end = 0
    for m in _WORDMARK.finditer(text):
        # marks sitting in the gap before this word attach to the previous token
        gap = text[last_end:m.start()]
        gm = _MARKRUN.findall(gap)
        if gm and out and out[-1]['book'] == book:
            out[-1]['mark'] = (out[-1]['mark'] + _norm_mark(''.join(gm))) or out[-1]['mark']
        word = m.group(1)
        mark = _norm_mark(m.group(2))
        out.append({'book': book, 'word': word, 'mark': mark, 'table': table})
        last_end = m.end()


def _emit_table(tbl, book, out):
    row = tbl.rows[0]
    cols = [[p.text for p in c.paragraphs] for c in row.cells]
    maxlen = max(len(c) for c in cols)
    for i in range(maxlen):
        for c in cols:               # right cell first, then left
            if i < len(c):
                _emit_text(c[i], book, True, out)


def _ptext(el):
    return ''.join(n.text or '' for n in el.iter(qn('w:t')))


def extract():
    d = Document(r'data\torah_aziz_ver2.docx')
    out = []
    book = 'Genesis'
    for child in d.element.body.iterchildren():
        tag = child.tag.replace(W, '')
        if tag == 'p':
            text = _ptext(child)
            c = clean(text)
            for anchor, name in BOOK_ANCHORS:
                if c.startswith(anchor):
                    book = name
                    break
            _emit_text(text, book, False, out)
        elif tag == 'tbl':
            _emit_table(Table(child, None), book, out)
    return out


if __name__ == '__main__':
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    ws = extract()
    from collections import Counter
    for bk in ('Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'):
        sub = [w for w in ws if w['book'] == bk]
        marks = Counter(w['mark'] for w in sub if w['mark'])
        tbl = sum(1 for w in sub if w['table'])
        print(f'{bk}: words={len(sub)} table={tbl} marks={dict(marks)}')
    print('\nGenesis first 20 tokens:')
    g = [w for w in ws if w['book'] == 'Genesis']
    print(' '.join(w['word'] + w['mark'] for w in g[:20]))
