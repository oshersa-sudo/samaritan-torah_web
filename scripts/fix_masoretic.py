# -*- coding: utf-8 -*-
"""
Section 3 — fill the missing masoretic_text from the WLC (data/WLC.db) for verses
that lack it, matching by (book, chapter, verse). For each gap we confirm the
numbering really aligns by comparing letters to the WLC verse and its neighbours
(±2): if the best match is the SAME verse number we copy it; if a neighbour is a
much better match (a versification shift, e.g. the Decalogue in דברים 5 / שמות 20)
we DO NOT auto-fill it — it's surfaced for review with the suggested verse. Only
masoretic_text is written; full backup.

Usage:  py -3 scripts/fix_masoretic.py            # dry run + surface shifts
        py -3 scripts/fix_masoretic.py --apply
"""
import sqlite3, sys, io, os, re, shutil
from difflib import SequenceMatcher
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APPLY = '--apply' in sys.argv
BOOK = {'בראשית': 1, 'שמות': 2, 'ויקרא': 3, 'במדבר': 4, 'דברים': 5}
NIK = re.compile('[֑-ׇ]'); ONLY = re.compile('[^א-ת]')


def lets(t):
    return ONLY.sub('', NIK.sub('', t or ''))


def main():
    c = sqlite3.connect('data/torah.db'); c.row_factory = sqlite3.Row
    w = sqlite3.connect('data/WLC.db'); w.row_factory = sqlite3.Row
    wlc = {(r['book_id'], r['chapter'], r['verse']): r['text']
           for r in w.execute('SELECT book_id,chapter,verse,text FROM WLC_verses WHERE book_id<=5')}

    fill, shifts, nomatch = [], [], []
    for he, bid in BOOK.items():
        for g in c.execute(
                '''SELECT v.id, ch.number cn, v.number vn, v.text FROM verses v
                   JOIN chapters ch ON ch.id=v.chapter_id JOIN books b ON b.id=ch.book_id
                   WHERE b.name=? AND (v.masoretic_text IS NULL OR TRIM(v.masoretic_text)="")''', (he,)):
            dl = lets(g['text'])
            best = (-1, 0)
            for k in (0, 1, -1, 2, -2):
                wv = wlc.get((bid, g['cn'], g['vn'] + k))
                if wv:
                    r = SequenceMatcher(None, dl, lets(wv)).ratio()
                    if r > best[0]:
                        best = (r, k)
            r, k = best
            here = wlc.get((bid, g['cn'], g['vn']))
            sim_here = SequenceMatcher(None, dl, lets(here)).ratio() if here else 0
            if here is not None and (k == 0 or sim_here >= 0.6):
                fill.append((here, g['id']))                      # numbering aligns -> fill
            elif r >= 0.7 and k != 0:
                shifts.append((he, g['cn'], g['vn'], g['vn'] + k, round(r, 2)))   # versification shift
            else:
                nomatch.append((he, g['cn'], g['vn'], round(sim_here, 2)))

    print('gaps to fill (numbering aligns): %d' % len(fill))
    print('versification SHIFTS (surfaced, NOT filled): %d' % len(shifts))
    for he, cn, vn, sug, r in shifts:
        print('   %s %d:%d  -> WLC %d:%d  (sim %.2f)' % (he, cn, vn, cn, sug, r))
    print('no confident match (surfaced, NOT filled): %d' % len(nomatch))
    for he, cn, vn, r in nomatch[:15]:
        print('   %s %d:%d  (best-here sim %.2f)' % (he, cn, vn, r))

    if APPLY:
        bak = 'data/torah.db.bak_mas'
        if not os.path.exists(bak):
            shutil.copy2('data/torah.db', bak); print('backed up ->', bak)
        c.executemany('UPDATE verses SET masoretic_text=? WHERE id=?', fill)
        c.commit()
        left = c.execute("SELECT COUNT(*) FROM verses WHERE masoretic_text IS NULL OR TRIM(masoretic_text)=''").fetchone()[0]
        print('filled %d. verses still missing masoretic_text: %d' % (len(fill), left))
    else:
        print('\n[dry-run] re-run with --apply to write.')
    c.close()


if __name__ == '__main__':
    main()
