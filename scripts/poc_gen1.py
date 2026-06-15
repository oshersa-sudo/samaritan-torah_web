# -*- coding: utf-8 -*-
"""Proof of concept: show Genesis ch.1 reconstructed with ver2 consonant corrections
and the Samaritan stop marks (:, .) inserted, preserving verse numbers and ׃."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, 'scripts')
from difflib import SequenceMatcher
from aziz_lib import parse_txt, norm
from aziz2_lib import extract as extract2

ref = parse_txt('data/בראשית.txt', 'Genesis')          # current txt
hyp = [w for w in extract2() if w['book'] == 'Genesis']  # ver2

sm = SequenceMatcher(None, [norm(w['word']) for w in ref],
                     [norm(w['word']) for w in hyp], autojunk=False)

mark_for = [''] * len(ref)      # ver2 stop mark to append after each txt word
corr_for = [None] * len(ref)    # corrected consonants (if differs)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        for k in range(i2 - i1):
            mark_for[i1 + k] = hyp[j1 + k]['mark']
    elif tag == 'replace' and (i2 - i1) == (j2 - j1):
        for k in range(i2 - i1):
            mark_for[i1 + k] = hyp[j1 + k]['mark']
            if norm(ref[i1 + k]['word']) != norm(hyp[j1 + k]['word']):
                corr_for[i1 + k] = hyp[j1 + k]['word']

# build chapter 1 display, verse by verse
print('=== בראשית פרק א — שחזור עם תיקונים וסימני עצירה ===\n')
cur_v = None
buf = []
def flush():
    if cur_v is not None:
        print(f'  פסוק {cur_v}:  ' + ' '.join(buf))

for i, w in enumerate(ref):
    if w['chap'] != 1:
        continue
    if w['verse'] != cur_v:
        flush(); buf = []; cur_v = w['verse']
    raw = w['raw']
    # split trailing ׃ from the raw token
    sof = '׃' if raw.endswith('׃') else ''
    surface = corr_for[i] if corr_for[i] else w['word']
    tok = surface + mark_for[i] + sof
    if corr_for[i]:
        tok += '⟵(' + w['word'] + ')'
    buf.append(tok)
flush()
