"""Render HaMeliṣ PDF pages to PNGs for manual extraction.

Usage:
  py -3 scripts/meliz/render_pages.py <part> <start> <count> [dpi] [rot]
    part  = 1|2|3|4   (4 = "חלק אחרון")
    start = 1-based page number in that part's PDF
    count = how many pages
    dpi   = default 150
    rot   = rotate each page by this many degrees (0/90/180/270) for sideways scans

Outputs to the session scratchpad as meliz<part>_p<N>.png and prints the paths.
"""
import os
import sys

import fitz

PDFS = {
    '1': 'המליץ/המליץ 1.pdf',
    '2': 'המליץ/המליץ 2.pdf',
    '3': 'המליץ/המליץ 3.pdf',
    '4': 'המליץ/המליץ חלק אחרון.pdf',
}
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SCR = os.environ.get('MELIZ_OUT') or os.path.join(ROOT, 'data', 'meliz', 'pages')


def main():
    part = sys.argv[1]
    start = int(sys.argv[2])
    count = int(sys.argv[3])
    dpi = int(sys.argv[4]) if len(sys.argv) > 4 else 150
    rot = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    os.makedirs(SCR, exist_ok=True)
    doc = fitz.open(os.path.join(ROOT, PDFS[part]))
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    if rot:
        mat = mat * fitz.Matrix(rot)
    for i in range(start - 1, min(start - 1 + count, doc.page_count)):
        pm = doc[i].get_pixmap(matrix=mat)
        out = os.path.join(SCR, 'meliz%s_p%d.png' % (part, i + 1))
        pm.save(out)
        print(out, pm.width, pm.height)


if __name__ == '__main__':
    main()
