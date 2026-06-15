# -*- coding: utf-8 -*-
"""
Sync the Samaritan stop marks in the .txt files to torah_aziz_ver2.docx:
  '.'  = עמידה (standing)   ':' = עצירה (stop)   ':--' = Samaritan chapter end -> ':'
For every confidently-aligned word (equal block or a small <=3 replace) that is NOT
a verse end, the word's trailing :/. is set to the docx's mark (added, changed, or
removed). Verse-end words (those carrying ׃) and verse-number markers are left
untouched, and divergent / insert / delete regions are skipped (mark placement
there can't be trusted). Backs up *.marks2.bak.

Usage:  py -3 scripts/apply_txt_marks.py            # dry run + counts
        py -3 scripts/apply_txt_marks.py --apply
"""
import sys, io, os, re, shutil
sys.path.insert(0, 'scripts')
from difflib import SequenceMatcher
from aziz_lib import parse_txt, norm
from aziz2_lib import extract as extract2
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APPLY = '--apply' in sys.argv
FILES = {'Genesis': 'בראשית', 'Exodus': 'שמות', 'Leviticus': 'ויקרא',
         'Numbers': 'במדבר', 'Deuteronomy': 'דברים'}
TRAIL = re.compile(r'[:.]+$')           # trailing pause marks (NOT ׃)


def docx_mark(m):
    if not m:
        return ''
    if m == '.':
        return '.'
    return ':'                          # ':' and ':--' both become a ':' stop


def main():
    doc = extract2()
    for en, he in FILES.items():
        ref = parse_txt('data/%s.txt' % he, en)
        hyp = [w for w in doc if w['book'] == en]
        sm = SequenceMatcher(None, [norm(w['word']) for w in ref],
                             [norm(w['word']) for w in hyp], autojunk=False)
        edits = []          # (line, start, end, newtoken)
        added = changed = removed = skipped_ve = 0
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == 'equal' or (tag == 'replace' and max(i2 - i1, j2 - j1) <= 3):
                n = min(i2 - i1, j2 - j1)
                for k in range(n):
                    rw = ref[i1 + k]
                    raw = rw['raw']
                    if '׃' in raw:                 # verse end -> leave ׃ alone
                        skipped_ve += 1
                        continue
                    core = TRAIL.sub('', raw)
                    cur = raw[len(core):]            # current trailing :/. (may be '')
                    want = docx_mark(hyp[j1 + k]['mark'])
                    if cur == want:
                        continue
                    if not cur and want:
                        added += 1
                    elif cur and not want:
                        removed += 1
                    else:
                        changed += 1
                    edits.append((rw['line'], rw['start'], rw['end'], core + want))
        print('%-8s  add=%-4d change=%-4d remove=%-4d  (verse-ends kept=%d, edits=%d)'
              % (he, added, changed, removed, skipped_ve, len(edits)))
        if APPLY and edits:
            path = 'data/%s.txt' % he
            bak = path + '.marks2.bak'
            if not os.path.exists(bak):
                shutil.copy2(path, bak)
            lines = io.open(path, encoding='utf-8').read().split('\n')
            per = {}
            for ln, s, e, nt in edits:
                per.setdefault(ln, []).append((s, e, nt))
            for ln, lst in per.items():
                for s, e, nt in sorted(lst, reverse=True):
                    lines[ln] = lines[ln][:s] + nt + lines[ln][e:]
            io.open(path, 'w', encoding='utf-8').write('\n'.join(lines))
    if not APPLY:
        print('\n[dry-run] re-run with --apply to write.')


if __name__ == '__main__':
    main()
