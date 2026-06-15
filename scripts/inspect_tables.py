# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from docx import Document

d = Document(r"data\torah_aziz.docx")
for ti, tbl in enumerate(d.tables):
    print(f"===== TABLE {ti}: rows={len(tbl.rows)} cols={len(tbl.columns)} =====")
    for ri, row in enumerate(tbl.rows):
        for ci, cell in enumerate(row.cells):
            txt = cell.text.strip()
            if txt:
                print(f"  [r{ri}c{ci}] ({len(txt)}c) {txt[:200]!r}")
