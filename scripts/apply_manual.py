# -*- coding: utf-8 -*-
"""Apply the manual-review rows the user approved with 'Y' in column H of
data/aziz_manual_review.xlsx — by alignment position, with safety filtering.

A held row is one that would corrupt currently-correct text (the scrambled docx
tables in Exodus 2 / 3:15, multi-word deletes, or over-long blocks).

Usage: py -3 scripts/apply_manual.py [--apply]
"""
import sys, os, shutil
sys.path.insert(0, 'scripts')
from difflib import SequenceMatcher
import openpyxl

from aziz_lib import parse_txt, norm
from aziz_docx import extract as extract_docx

FILES = {'Genesis': 'data/בראשית.txt', 'Exodus': 'data/שמות.txt'}
HE2EN = {'בראשית': 'Genesis', 'שמות': 'Exodus'}
HEBSET = set(chr(c) for c in range(0x05D0, 0x05EB))
MAXLEN = 6   # reject blocks longer than this many words on either side


def split_affix(raw):
    idx = [i for i, c in enumerate(raw) if c in HEBSET]
    if not idx:
        return ('', raw, '')
    a, b = idx[0], idx[-1]
    return raw[:a], raw[a:b + 1], raw[b + 1:]


def load_yes():
    wb = openpyxl.load_workbook('data/aziz_manual_review.xlsx')
    ws = wb.active
    yes = set()
    for r in ws.iter_rows(min_row=2, values_only=True):
        h = r[7] if len(r) > 7 else None
        if h is not None and str(h).strip().upper() == 'Y':
            book = HE2EN.get(r[0], r[0])
            orig = r[4] or ''
            new = r[5] or ''
            yes.add((book, int(r[1]), int(r[2]), r[3], orig.strip(), new.strip()))
    return yes


def main(apply=False):
    yes = load_yes()
    docx = extract_docx()
    edits_by_book = {}
    applied, held = [], []
    matched = set()

    for book in ('Genesis', 'Exodus'):
        ref = parse_txt(FILES[book], book)
        hyp = [w for w in docx if w['book'] == book]
        with open(FILES[book], encoding='utf-8') as f:
            lines = f.read().split('\n')
        edits = []
        sm = SequenceMatcher(None, [norm(w['word']) for w in ref],
                             [norm(w['word']) for w in hyp], autojunk=False)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == 'equal':
                continue
            rs, hs = ref[i1:i2], hyp[j1:j2]
            chap = rs[0]['chap'] if rs else (ref[i1 - 1]['chap'] if i1 > 0 else 0)
            verse = rs[0]['verse'] if rs else (ref[i1 - 1]['verse'] if i1 > 0 else 0)
            orig = ' '.join(w['word'] for w in rs)
            new = ' '.join(w['word'] for w in hs)
            key = (book, chap, verse, tag, orig, new)
            if key not in yes:
                continue
            matched.add(key)

            # is there a verse marker / sof-pasuq / parsha break BETWEEN the txt tokens?
            marker_inside = False
            if rs and len(set(w['line'] for w in rs)) == 1:
                line = lines[rs[0]['line']]
                for a, b in zip(rs, rs[1:]):
                    gap = line[a['end']:b['start']]
                    if any(ch in gap for ch in '‏‎׃') or '--' in gap:
                        marker_inside = True
                        break

            # ---- safety filter
            reason = None
            if max(len(rs), len(hs)) > MAXLEN:
                reason = 'בלוק ארוך מדי (סדר משובש) – לא הוחל'
            elif any(w['table'] for w in hs) and max(len(rs), len(hs)) > 1:
                reason = 'טבלה מעורבבת + רב-מילים – לא הוחל'
            elif tag == 'delete' and len(rs) > 1:
                reason = 'מחיקת רב-מילים (עלול להסיר טקסט תקין) – לא הוחל'
            elif rs and len(set(w['line'] for w in rs)) != 1:
                reason = 'משתרע על כמה שורות – לא הוחל'
            elif marker_inside and len(rs) != len(hs):
                reason = 'מפריד פסוק בתוך הקטע ואי-התאמת מילים – לא הוחל'

            if reason:
                held.append((book, chap, verse, tag, orig, new, reason))
                continue

            # ---- build positional edit(s)
            if tag == 'insert':
                anchor = ref[i1 - 1]
                ln, pos = anchor['line'], anchor['end']
                edits.append((ln, pos, pos, ' ' + new))
            elif marker_inside:
                # block straddles a verse marker; replace each token in place so the
                # marker / sof-pasuq between them is preserved (lens are equal here).
                ln = rs[0]['line']
                for rw, hw in zip(rs, hs):
                    pre, _, suf = split_affix(rw['raw'])
                    edits.append((ln, rw['start'], rw['end'], pre + hw['word'] + suf))
            else:  # contiguous span, no marker inside (handles merges/splits too)
                ln = rs[0]['line']
                s, e = rs[0]['start'], rs[-1]['end']
                pre, _, _ = split_affix(rs[0]['raw'])
                _, _, suf = split_affix(rs[-1]['raw'])
                newtext = (pre + suf) if tag == 'delete' else (pre + new + suf)
                edits.append((ln, s, e, newtext))
            applied.append((book, chap, verse, tag, orig, new))
        edits_by_book[book] = (lines, edits)

    # report unmatched Y rows (couldn't be located by alignment)
    unmatched = [k for k in yes if k not in matched]

    print(f'approved (Y) = {len(yes)} | applied = {len(applied)} | '
          f'held = {len(held)} | unmatched = {len(unmatched)}')
    print('\n--- HELD (not applied) ---')
    for h in held:
        print(f'  {h[0]} {h[1]}:{h[2]} [{h[3]}] {h[4]!r}->{h[5]!r}  | {h[6]}')
    if unmatched:
        print('\n--- UNMATCHED (alignment shifted) ---')
        for k in unmatched:
            print(f'  {k[0]} {k[1]}:{k[2]} [{k[3]}] {k[4]!r}->{k[5]!r}')

    if apply:
        for book in ('Genesis', 'Exodus'):
            path = FILES[book]
            bak = path + '.pre_manual.bak'
            if not os.path.exists(bak):
                shutil.copy2(path, bak)
            lines, edits = edits_by_book[book]
            per_line = {}
            for (ln, s, e, txt) in edits:
                per_line.setdefault(ln, []).append((s, e, txt))
            for ln, eds in per_line.items():
                for (s, e, txt) in sorted(eds, key=lambda x: x[0], reverse=True):
                    lines[ln] = lines[ln][:s] + txt + lines[ln][e:]
            with open(path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            print(f'wrote {path} (backup {bak})')
    else:
        print('\n[dry-run] re-run with --apply to write the files.')


if __name__ == '__main__':
    main(apply='--apply' in sys.argv)
