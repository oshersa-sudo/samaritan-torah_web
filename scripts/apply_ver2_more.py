# -*- coding: utf-8 -*-
"""Apply ver2 corrections + Samaritan stop marks to Numbers (במדבר.txt, full) and
Deuteronomy 10-34 (דברים.txt, the non-corrupt portion only).

Same rules as apply_ver2.py: safe 1-to-1 consonant fixes, ':'/'.' marks mid-verse,
missing sof-pasuq. Deut uses parse_deut_only so the stray Numbers 23-36 block in the
file is never touched; the missing Deut 1-9 shows up as a (skipped) insert.

Usage: py -3 scripts/apply_ver2_more.py [--apply]
"""
import sys, os, shutil
sys.path.insert(0, 'scripts')
from difflib import SequenceMatcher

from aziz_lib import parse_txt, norm
from aziz2_lib import extract as extract2
from apply_ver2 import split_affix, core_clean
from report_ver2_problems import parse_deut_only

HEBSET = set(chr(c) for c in range(0x05D0, 0x05EB))
TARGETS = [
    ('Numbers', 'data/במדבר.txt', lambda p: parse_txt(p, 'Numbers')),
    ('Deuteronomy', 'data/דברים.txt', parse_deut_only),
]


def process(book, path, parse_fn, hyp, apply):
    ref = parse_fn(path)
    with open(path, encoding='utf-8') as f:
        lines = f.read().split('\n')
    n = len(ref)

    def verse_end(i):
        return i == n - 1 or (ref[i + 1]['chap'], ref[i + 1]['verse']) != \
                             (ref[i]['chap'], ref[i]['verse'])

    edits = []
    st = dict(corr=0, corr_held=0, marks=0, sof=0)

    def add_mark(i, mark):
        if mark in (':', '.') and not verse_end(i) and not ref[i]['raw'].endswith('׃'):
            edits.append((ref[i]['line'], ref[i]['end'], ref[i]['end'], mark))
            st['marks'] += 1

    sm = SequenceMatcher(None, [norm(w['word']) for w in ref],
                         [norm(w['word']) for w in hyp], autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        rs, hs = ref[i1:i2], hyp[j1:j2]
        if tag == 'equal':
            for k in range(i2 - i1):
                add_mark(i1 + k, hyp[j1 + k]['mark'])
            continue
        if tag == 'replace' and (i2 - i1) == (j2 - j1):
            for k in range(i2 - i1):
                rw, hw = ref[i1 + k], hyp[j1 + k]
                if norm(rw['word']) == norm(hw['word']):
                    add_mark(i1 + k, hw['mark'])
                    continue
                safe = (not hw['table'] and core_clean(rw['raw']) and
                        not (SequenceMatcher(None, norm(rw['word']), norm(hw['word'])).ratio() < 0.5
                             and abs(len(rw['word']) - len(hw['word'])) >= 2))
                pre, _, suf = split_affix(rw['raw'])
                if safe and not any(c in pre + suf for c in '[]{}<>'):
                    mk = hw['mark'] if (hw['mark'] in (':', '.') and not verse_end(i1 + k)
                                        and not rw['raw'].endswith('׃')) else ''
                    edits.append((rw['line'], rw['start'], rw['end'], pre + hw['word'] + suf + mk))
                    st['corr'] += 1
                    if mk:
                        st['marks'] += 1
                else:
                    st['corr_held'] += 1
            continue
        # insert/delete/unequal-replace -> skipped (incl. the huge Deut 1-9 insert)

    for i in range(n):
        if verse_end(i) and '׃' not in ref[i]['raw']:
            edits.append((ref[i]['line'], ref[i]['end'], ref[i]['end'], '׃'))
            st['sof'] += 1

    print(f'{book}: corrections={st["corr"]} (held={st["corr_held"]}) '
          f'marks={st["marks"]} sof-pasuq-added={st["sof"]}  edits={len(edits)}')

    if apply:
        bak = path + '.ver2.bak'
        if not os.path.exists(bak):
            shutil.copy2(path, bak)
        per_line = {}
        for (ln, s, e, txt) in edits:
            per_line.setdefault(ln, []).append((s, e, txt))
        for ln, eds in per_line.items():
            for (s, e, txt) in sorted(eds, key=lambda x: (x[0], x[1] == x[2]), reverse=True):
                lines[ln] = lines[ln][:s] + txt + lines[ln][e:]
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(f'  wrote {path} (backup {bak})')


def main(apply=False):
    docx = extract2()
    for book, path, parse_fn in TARGETS:
        hyp = [w for w in docx if w['book'] == book]
        process(book, path, parse_fn, hyp, apply)
    if not apply:
        print('[dry-run] re-run with --apply')


if __name__ == '__main__':
    main(apply='--apply' in sys.argv)
