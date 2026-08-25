# -*- coding: utf-8 -*-
"""Render pages of a scanned commentary volume to PNG so they can be read.

The volume is a pure scan - one full-page image per page, no text layer - and
the reader tool cannot rasterise a PDF itself here, so the pages are rendered
out first and read as images.

Usage: py -3 scripts/binyamim/render_pages.py <pdf> <out_dir> <first> <last> [dpi]
"""
import os
import sys

import fitz


def main():
    pdf, out, first, last = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    dpi = int(sys.argv[5]) if len(sys.argv) > 5 else 170
    os.makedirs(out, exist_ok=True)
    doc = fitz.open(pdf)
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    for n in range(first, min(last, doc.page_count) + 1):
        pix = doc[n - 1].get_pixmap(matrix=mat)
        path = os.path.join(out, 'p%03d.png' % n)
        pix.save(path)
        print('%s  %dx%d  %d KB' % (path, pix.width, pix.height,
                                    os.path.getsize(path) // 1024))


if __name__ == '__main__':
    main()
