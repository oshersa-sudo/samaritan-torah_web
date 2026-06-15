# -*- coding: utf-8 -*-
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

d = Document(r"data\torah_aziz_ver2.docx")
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

def ptext(el):
    return ''.join(n.text or '' for n in el.iter(qn('w:t')))

# book-start anchors (cleaned, spaceless)
anchors = {
    'בראשיתבראאלהים': 'GENESIS 1:1',
    'ואלהשמותבניישראל': 'EXODUS 1:1',
    'ויקראאלמשה': 'LEVITICUS 1:1',
    'וידבריהוהאלמשהבמדברסיני': 'NUMBERS 1:1',
    'אלההדבריםאשרדבר': 'DEUT 1:1',
}
def clean(t):
    return re.sub(r'[^א-ת]', '', t)

idx = 0
for child in d.element.body.iterchildren():
    tag = child.tag.replace(W, '')
    if tag == 'p':
        t = ptext(child)
        c = clean(t)
        for a, name in anchors.items():
            if c.startswith(a):
                print(f'  >>> {name} starts at paragraph P{idx}')
        marks = []
        for sym in (':--', '.', '|'):
            n = t.count(sym)
            if n:
                marks.append(f'{sym}={n}')
        if len(t.strip()) and (idx < 3 or ':--' in t[:5] or len(t) < 30):
            pass
        idx += 1
    elif tag == 'tbl':
        print(f'  [TABLE] before paragraph index ~P{idx}')

print('\ntotal paragraphs scanned:', idx)

# table sizes
print('\n=== tables ===')
for ti, tbl in enumerate(d.tables):
    txt = ' '.join(c.text for r in tbl.rows for c in r.cells)
    print(f'  table {ti}: rows={len(tbl.rows)} cols={len(tbl.columns)} chars={len(txt)}  head={clean(txt)[:40]!r}')
