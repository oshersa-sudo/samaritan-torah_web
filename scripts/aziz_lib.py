# -*- coding: utf-8 -*-
"""Shared parsing utilities for comparing torah_aziz.docx against the .txt files."""
import re

HEB = 'א-ת'                       # Hebrew consonants alef..tav
FINAL = str.maketrans('ךםןףץ',   # ך ם ן ף ץ
                      'כמנפצ')    # כ מ נ פ צ
ONLY_HEB = re.compile('[^' + HEB + ']')
RLM = '‏'   # right-to-left mark (follows a verse number)
LRM = '‎'   # left-to-right mark (precedes a verse number)


def norm(w):
    """Normalize a word for comparison: unify final letters."""
    return w.translate(FINAL)


def clean_word(raw):
    """Strip everything that is not a Hebrew consonant (brackets, braces, sofpasuq,
    digits, niqqud, underscores...). Returns '' if nothing remains."""
    return ONLY_HEB.sub('', raw)


_CHV = re.compile(r'^[‎‏]*(\d+):(\d+)[‎‏]*$')   # "2:1" chapter:verse
_VMK = re.compile(r'^[‎‏]*(\d+)' + RLM + r'[‎‏]*$')  # "‎2‏" verse marker
_DBL = re.compile(r'^[‎‏]*\[[' + HEB + r']\][‎‏]*$')  # "[א]" doublet label
_TOK = re.compile(r'\S+')
_LAT = re.compile(r'[A-Za-z]')


def parse_txt(path, book):
    """Parse a .txt file into a flat list of dicts, one per (real) word, recording the
    exact raw token and its character span so corrections can be applied by position:
      {book, chap, verse, word, raw, line, start, end}
    word = cleaned (Hebrew-only) surface form, finals preserved.
    Skips verse/chapter markers, book names, [א]/[ב] doublet labels and <<...>> variants,
    exactly mirroring the comparison stream so alignment indices stay valid."""
    words = []
    with open(path, encoding='utf-8') as f:
        lines = f.read().split('\n')

    chap = 1
    verse = 0
    in_angle = False
    for li, line in enumerate(lines):
        if RLM not in line:
            continue  # header / blank lines
        for m in _TOK.finditer(line):
            tok = m.group()
            if in_angle:
                if '>>' in tok:
                    in_angle = False
                continue
            if '<<' in tok:
                if '>>' not in tok:
                    in_angle = True
                continue
            mc = _CHV.match(tok)
            if mc:
                chap, verse = int(mc.group(1)), int(mc.group(2))
                continue
            mv = _VMK.match(tok)
            if mv:
                verse = int(mv.group(1))
                continue
            if _LAT.search(tok) or _DBL.match(tok):
                continue
            w = clean_word(tok)
            if w:
                words.append({'book': book, 'chap': chap, 'verse': verse, 'word': w,
                              'raw': tok, 'line': li, 'start': m.start(), 'end': m.end()})
    return words


if __name__ == '__main__':
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    for fn, bk in [('data/בראשית.txt', 'Genesis'),
                   ('data/שמות.txt', 'Exodus')]:
        w = parse_txt(fn, bk)
        chaps = sorted(set(x['chap'] for x in w))
        nverses = len(set((x['chap'], x['verse']) for x in w))
        print(f'{bk}: words={len(w)} chapters={chaps[0]}..{chaps[-1]} ({len(chaps)}) verses={nverses}')
        # show first few words and a sample verse
        s = [x for x in w if x['chap'] == 1 and x['verse'] == 1]
        print('  1:1 ->', ' '.join(x['word'] for x in s))
        last = chaps[-1]
        lv = max(x['verse'] for x in w if x['chap'] == last)
        s = [x for x in w if x['chap'] == last and x['verse'] == lv]
        print(f'  {last}:{lv} ->', ' '.join(x['word'] for x in s))
