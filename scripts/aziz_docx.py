# -*- coding: utf-8 -*-
"""Extract the word stream from torah_aziz.docx in reading order.
Genesis = flowing paragraphs until the 'ואלה שמות' anchor.
Exodus  = from that anchor onward, including the 3 interleaved tables
          (right cell c0 line i, then left cell c1 line i). Table words are
          tagged table=True so downstream diffs can be flagged for manual review."""
import re
from docx import Document
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.table import Table

from aziz_lib import clean_word

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
EXODUS_ANCHOR = 'ואלהשמותבני'  # cleaned, no spaces


def _para_text(p_el):
    return ''.join(n.text or '' for n in p_el.iter(qn('w:t')))


def _emit_words(text, book, table, out):
    for tok in text.split():
        w = clean_word(tok)
        if w:
            out.append({'book': book, 'word': w, 'table': table})


def _emit_table(tbl, book, out):
    """Interleave the two cells line by line: right(c0)[i], left(c1)[i]."""
    row = tbl.rows[0]
    cells = row.cells
    col_paras = []
    for c in cells:
        col_paras.append([p.text for p in c.paragraphs])
    maxlen = max(len(cp) for cp in col_paras)
    for i in range(maxlen):
        for cp in col_paras:  # cell 0 (right) first, then cell 1 (left)
            if i < len(cp):
                _emit_words(cp[i], book, True, out)


def extract():
    d = Document(r'data\torah_aziz.docx')
    body = d.element.body
    out = []
    book = 'Genesis'
    switched = False
    for child in body.iterchildren():
        tag = child.tag.replace(W, '')
        if tag == 'p':
            text = _para_text(child)
            if not switched:
                cleaned = clean_word(text.replace(' ', ''))
                if cleaned.startswith(EXODUS_ANCHOR):
                    book = 'Exodus'
                    switched = True
            _emit_words(text, book, False, out)
        elif tag == 'tbl':
            tbl = Table(child, None)
            _emit_table(tbl, book, out)
    return out


if __name__ == '__main__':
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    ws = extract()
    for bk in ('Genesis', 'Exodus'):
        sub = [w for w in ws if w['book'] == bk]
        tbl = sum(1 for w in sub if w['table'])
        print(f'{bk}: words={len(sub)} (from tables={tbl})')
        print('  first:', ' '.join(w['word'] for w in sub[:12]))
        print('  last :', ' '.join(w['word'] for w in sub[-12:]))
