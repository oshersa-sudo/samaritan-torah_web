# -*- coding: utf-8 -*-
"""
Clean the editorial marks ! ( ) [ ] < > from the Torah source text files
(data/בראשית.txt … data/דברים.txt) and tidy the spaces those marks leave behind.

Bracketed CONTENT is kept (only the mark characters go): '[ויאמר אלהים ישר]'->
'ויאמר אלהים ישר', '<<יעשה>>'->'יעשה', '(!)'->removed. Single-letter doublet labels
[א]/[ב] are removed whole (they would otherwise leave a stray letter). Curly braces
{} are kept (not in the list). Backs up each file to *.marks.bak and reports, per
file and per mark, how many marks were removed.

Usage:  py -3 scripts/clean_txt_marks.py            # dry run + counts
        py -3 scripts/clean_txt_marks.py --apply
"""
import io, os, re, sys, shutil, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APPLY = '--apply' in sys.argv
FILES = ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים']
MARKS = '!()[]<>'
# a single-letter bracket that is NOT touching Hebrew letters on either side is a
# standalone doublet label ([א]/[ב]) — drop it whole; one that IS attached to a
# word is a restored letter (עמ[ד]=עמד, הע[ץ]=העץ) — keep the letter, drop brackets.
LABEL = re.compile(r'(?<![א-ת])\[[א-ת]\](?![א-ת])')
REST  = re.compile(r'[!()\[\]<>]')      # all remaining mark characters (content kept)


def clean(text):
    t = LABEL.sub('', text)
    t = REST.sub('', t)
    t = re.sub(r' {2,}', ' ', t)             # collapse spaces left by the removals
    t = re.sub(r'[ \t]+(\n|$)', r'\1', t)    # trim any trailing spaces
    return t


def main():
    grand = collections.Counter()
    for bk in FILES:
        path = 'data/%s.txt' % bk
        text = io.open(path, encoding='utf-8').read()
        per = {ch: text.count(ch) for ch in MARKS}
        removed = sum(per.values())
        for ch in MARKS:
            grand[ch] += per[ch]
        new = clean(text)
        left = sum(new.count(ch) for ch in MARKS)
        print('%-8s removed %3d  %s%s' % (
            bk, removed, {k: v for k, v in per.items() if v},
            '' if left == 0 else '  (!! %d left)' % left))
        if APPLY and new != text:
            bak = path + '.marks.bak'
            if not os.path.exists(bak):
                shutil.copy2(path, bak)
            with io.open(path, 'w', encoding='utf-8') as f:
                f.write(new)

    print('\nper-mark totals:', {k: v for k, v in grand.items() if v})
    print('TOTAL marks removed:', sum(grand.values()))
    print('applied (backups *.marks.bak)' if APPLY else '\n[dry-run] re-run with --apply to write.')


if __name__ == '__main__':
    main()
