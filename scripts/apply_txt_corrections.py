# -*- coding: utf-8 -*-
"""
Apply the user-approved (column G == 'Y') word corrections from
data/txt_docx_diffs.xlsx to the .txt files. Each approved row is a small replace
block (txt words -> docx words); we locate it by re-running the same alignment,
then replace exactly that span in the .txt, preserving any non-Hebrew affix
(attached :/./׃ stop marks) so nothing else changes. Backs up *.corr.bak.

Usage:  py -3 scripts/apply_txt_corrections.py            # dry run
        py -3 scripts/apply_txt_corrections.py --apply
"""
import sys, io, os, re, shutil
sys.path.insert(0, 'scripts')
from difflib import SequenceMatcher
from aziz_lib import parse_txt, norm
from aziz2_lib import extract as extract2
import openpyxl
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APPLY = '--apply' in sys.argv
FILES = {'Genesis': 'בראשית', 'Exodus': 'שמות', 'Leviticus': 'ויקרא',
         'Numbers': 'במדבר', 'Deuteronomy': 'דברים'}
_LEAD = re.compile(r'^[:.׃\-]+')         # only attached stop-marks are preserved
_TRAIL = re.compile(r'[:.׃\-]+$')        # (variant braces {} belong to the words -> dropped)


def lead_stop(raw):
    m = _LEAD.match(raw); return m.group() if m else ''


def trail_stop(raw):
    m = _TRAIL.search(raw); return m.group() if m else ''


def load_yes():
    """approved corrections: {(book_he, chap, verse, txt_words): docx_words}.
    The docx value is taken from column E AS THE USER LEFT IT (they may have fixed
    a docx OCR space there); the txt value (column D) locates the block."""
    wb = openpyxl.load_workbook('data/txt_docx_diffs.xlsx')
    yes = {}
    for sn in ('1-word-diffs', '2-boundary'):
        for r in wb[sn].iter_rows(min_row=2, values_only=True):
            if len(r) > 6 and r[6] and str(r[6]).strip().upper() == 'Y':
                yes[(r[0], r[1], r[2], (r[3] or '').strip())] = (r[4] or '').strip()
    return yes


def main():
    yes = load_yes()
    print('approved rows:', len(yes))
    doc = extract2()
    edits = {}          # he -> [(line, start, end, newtext, oldtext)]
    matched = set()
    for en, he in FILES.items():
        ref = parse_txt('data/%s.txt' % he, en)
        hyp = [w for w in doc if w['book'] == en]
        sm = SequenceMatcher(None, [norm(w['word']) for w in ref],
                             [norm(w['word']) for w in hyp], autojunk=False)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag != 'replace':
                continue
            ch, vs = ref[i1]['chap'], ref[i1]['verse']
            rs = ' '.join(w['word'] for w in ref[i1:i2])
            key = (he, ch, vs, rs)
            if key not in yes:
                continue
            docx_words = yes[key]                  # the user's column-E value
            first, last = ref[i1], ref[i2 - 1]
            new = lead_stop(first['raw']) + docx_words + trail_stop(last['raw'])
            old = ' '.join(w['raw'] for w in ref[i1:i2])
            edits.setdefault(he, []).append((first['line'], first['start'], last['end'], new, old))
            matched.add(key)

    miss = set(yes) - matched
    print('matched %d / %d approved   (unmatched: %d)' % (len(matched), len(yes), len(miss)))
    for m in list(miss)[:10]:
        print('   UNMATCHED:', m)
    for he, eds in edits.items():
        print('--- %s (%d edits) ---' % (he, len(eds)))
        for ln, s, e, new, old in sorted(eds)[:50]:
            print('   [%s] -> [%s]' % (old, new))

    if APPLY:
        for he, eds in edits.items():
            path = 'data/%s.txt' % he
            bak = path + '.corr.bak'
            if not os.path.exists(bak):
                shutil.copy2(path, bak)
            lines = io.open(path, encoding='utf-8').read().split('\n')
            per_line = {}
            for ln, s, e, new, old in eds:
                per_line.setdefault(ln, []).append((s, e, new))
            for ln, lst in per_line.items():
                for s, e, new in sorted(lst, reverse=True):     # right-to-left
                    lines[ln] = lines[ln][:s] + new + lines[ln][e:]
            io.open(path, 'w', encoding='utf-8').write('\n'.join(lines))
            print('wrote %s (backup %s)' % (path, os.path.basename(bak)))
    else:
        print('\n[dry-run] re-run with --apply to write.')


if __name__ == '__main__':
    main()
