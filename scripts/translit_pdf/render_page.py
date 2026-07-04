"""Render one source PDF page into legible horizontal strips for inline OCR.

Usage: py -3 scripts/translit_pdf/render_page.py <pdf> <page_index> [nstrips]
The Ben-Hayyim transcription PDFs are scanned (no text layer) and laid out in
REVERSE page order (PDF page 0 = last printed page). We render the lower ~70%
of the page (below the book/chapter heading band) split into N strips at 4x so
the diacritics (a-ring vs a-macron, gemination, s/s-dot, etc.) stay sharp.
"""
import sys, fitz, os

OUT = r'C:\Users\osher\AppData\Local\Temp\claude\C--Users-osher-Documents-torah\3b9a744a-b8e2-4630-b8a2-116404443172\scratchpad'

def main():
    pdf = sys.argv[1]
    page = int(sys.argv[2])
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    d = fitz.open(pdf)
    p = d[page]
    r = p.rect
    # content band: from 6% down to 96% (covers heading too, harmless)
    top, bot = 0.06, 0.965
    span = (bot - top) / n
    overlap = 0.015
    tag = os.path.splitext(os.path.basename(pdf))[0][:4]
    for i in range(n):
        y0 = top + i * span - (overlap if i else 0)
        y1 = top + (i + 1) * span + (overlap if i < n - 1 else 0)
        clip = fitz.Rect(r.x0, r.y0 + r.height * y0, r.x1, r.y0 + r.height * y1)
        pm = p.get_pixmap(matrix=fitz.Matrix(4, 4), clip=clip)
        path = os.path.join(OUT, f'pg_{page}_{chr(97+i)}.png')
        pm.save(path)
        print('saved', path, pm.width, pm.height)
    d.close()

if __name__ == '__main__':
    main()
