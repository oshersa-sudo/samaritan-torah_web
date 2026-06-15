"""OCR the Samaritan-Aramaic dictionary PDF into clean per-page text.

The scanned book has a two-column layout where, per page, the RIGHT column is
read before the LEFT (Hebrew RTL). Whole-page OCR scrambles the columns, so each
page is rendered to an image, split down the middle, and each half is OCR'd
separately (heb+eng, psm 4) and concatenated right-then-left.

Outputs (under data/dict_ocr/):
  txt/page_XXXX.txt   cleaned plain text, right column then left column
  tsv/page_XXXX.tsv   raw pytesseract word boxes (col,conf,height,text,...) so a
                      parser can later use font-height/position without re-OCR.

Resumable: pages already done are skipped unless --force is given.

Usage:
  py -3 scripts/ocr_dictionary.py --start 83 --end 102          # PDF page indices
  py -3 scripts/ocr_dictionary.py --start 83 --end 1047 --force
"""
import argparse
import os
import re

import fitz
import pytesseract
from PIL import Image

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

ROOT     = os.path.join(os.path.dirname(__file__), '..')
PDF_PATH = os.path.join(ROOT, 'data', 'המילון של אברהם טל ארמית שומרונית.pdf')
OUT_DIR  = os.path.join(ROOT, 'data', 'dict_ocr')
TXT_DIR  = os.path.join(OUT_DIR, 'txt')
TSV_DIR  = os.path.join(OUT_DIR, 'tsv')

LANG = 'heb+eng'
PSM  = '--psm 4'   # single column of text of variable sizes

# EBSCO / library watermark lines to drop from the cleaned text.
WATERMARK = re.compile(
    r'(ebsco|EBSCOhost|terms-of-use|All use subject|printed on|https?://)',
    re.IGNORECASE)


def clean(text):
    out = []
    for ln in text.splitlines():
        if WATERMARK.search(ln):
            continue
        if ln.strip():
            out.append(ln.rstrip())
    return '\n'.join(out)


def ocr_half(img, label):
    """Return (clean_text, tsv_text) for one column image."""
    txt = pytesseract.image_to_string(img, lang=LANG, config=PSM)
    tsv = pytesseract.image_to_data(img, lang=LANG, config=PSM)
    # tag every tsv data row with the column label for the parser
    lines = tsv.splitlines()
    tagged = [lines[0] + '\tcolumn'] + [l + '\t' + label for l in lines[1:]]
    return clean(txt), '\n'.join(tagged)


def process_page(doc, pno, dpi, force):
    txt_path = os.path.join(TXT_DIR, f'page_{pno:04d}.txt')
    tsv_path = os.path.join(TSV_DIR, f'page_{pno:04d}.tsv')
    if not force and os.path.exists(txt_path) and os.path.exists(tsv_path):
        return False
    pix = doc[pno].get_pixmap(dpi=dpi)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    W, H = img.size
    mid = W // 2
    right_txt, right_tsv = ocr_half(img.crop((mid, 0, W, H)), 'R')
    left_txt,  left_tsv  = ocr_half(img.crop((0, 0, mid, H)), 'L')
    page_txt = f'### PAGE {pno} ###\n{right_txt}\n{left_txt}\n'
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(page_txt)
    with open(tsv_path, 'w', encoding='utf-8') as f:
        f.write(right_tsv + '\n' + left_tsv + '\n')
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', type=int, required=True, help='first PDF page index (0-based)')
    ap.add_argument('--end',   type=int, required=True, help='last PDF page index (inclusive)')
    ap.add_argument('--dpi',   type=int, default=300)
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    os.makedirs(TXT_DIR, exist_ok=True)
    os.makedirs(TSV_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    done = 0
    for pno in range(args.start, min(args.end, doc.page_count - 1) + 1):
        if process_page(doc, pno, args.dpi, args.force):
            done += 1
            print(f'page {pno} ocr\'d', flush=True)
        else:
            print(f'page {pno} skipped (exists)', flush=True)
    print(f'completed: {done} pages newly OCR\'d')


if __name__ == '__main__':
    main()
