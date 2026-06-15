# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from docx import Document
from docx.oxml.ns import qn

d = Document(r"data\torah_aziz.docx")

# Walk the body in document order, identifying paragraphs, tables, and column/page breaks
body = d.element.body
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

def para_text(p):
    return "".join(node.text or "" for node in p.iter(qn('w:t')))

def para_breaks(p):
    brs = []
    for br in p.iter(qn('w:br')):
        brs.append(br.get(qn('w:type')) or 'line')
    # page breaks via lastRenderedPageBreak
    for lp in p.iter(qn('w:lastRenderedPageBreak')):
        brs.append('PAGE(rendered)')
    return brs

idx = 0
for child in body.iterchildren():
    tag = child.tag.replace(W, '')
    if tag == 'p':
        from docx.text.paragraph import Paragraph
        p = Paragraph(child, None)
        t = para_text(child)
        brs = para_breaks(child)
        info = ""
        if brs:
            info = "  <<BREAKS:" + ",".join(brs) + ">>"
        print(f"[P{idx}] ({len(t)}c){info}  {t[:60]!r}")
        idx += 1
    elif tag == 'tbl':
        print(f"[TABLE] ---- a table here ----")
    elif tag == 'sectPr':
        print("[SECTPR]")
