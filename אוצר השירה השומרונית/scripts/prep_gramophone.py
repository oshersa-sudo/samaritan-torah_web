# -*- coding: utf-8 -*-
"""Cut the gramophone photo out of its white studio background.

A plain threshold on "near white" would also eat the bright highlights on the
brass bell, so the background is found by flood-filling inward from the edges:
only white that is *connected to the border* is removed. The resulting alpha
edge is then softened by one pixel so the cut-out does not fringe against the
navy header.
"""
import os, sys, io
from collections import deque
from PIL import Image, ImageFilter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\osher\Downloads\shopping.webp'
OUT  = os.path.join(HERE, '..', 'img', 'gramophone.png')
TOL  = 26          # how far from the corner colour still counts as background

im = Image.open(SRC).convert('RGBA')
w, h = im.size
px = im.load()
bg = px[0, 0][:3]


def is_bg(p):
    return (abs(p[0] - bg[0]) <= TOL and abs(p[1] - bg[1]) <= TOL
            and abs(p[2] - bg[2]) <= TOL)


seen = bytearray(w * h)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        q.append((x, y))

while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i] or not is_bg(px[x, y]):
        continue
    seen[i] = 1
    if x > 0:     q.append((x - 1, y))
    if x < w - 1: q.append((x + 1, y))
    if y > 0:     q.append((x, y - 1))
    if y < h - 1: q.append((x, y + 1))

alpha = Image.frombytes('L', (w, h),
                        bytes(0 if seen[i] else 255 for i in range(w * h)))
alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))     # soften the cut edge
im.putalpha(alpha)

im = im.crop(im.getbbox())                              # trim the empty margin
im.thumbnail((360, 360), Image.LANCZOS)                 # header never needs more

os.makedirs(os.path.dirname(OUT), exist_ok=True)
im.save(OUT, 'PNG', optimize=True)
print('wrote %s  %dx%d  %.0f KB'
      % (os.path.normpath(OUT), im.width, im.height, os.path.getsize(OUT) / 1024))
print('removed %d background pixels of %d' % (sum(seen), w * h))
