# -*- coding: utf-8 -*-
"""
Clean editorial marks from verses.text: remove ! ( ) [ ] < > and tidy the spaces
those marks leave behind (collapse double spaces, drop a space left before a stop
mark, trim edges). Bracketed CONTENT is kept — only the mark characters go, e.g.
'אעבר (!) את' -> 'אעבר את', '<<יעשה>>' -> 'יעשה', '[יהוה]' -> 'יהוה'.

Nothing else is touched (the restored verse-end . / : stay). Backs up the DB.

Usage:  py -3 scripts/clean_text_marks.py            # dry run
        py -3 scripts/clean_text_marks.py --apply
"""
import sqlite3, sys, os, io, re, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APPLY = '--apply' in sys.argv
MARKS = re.compile(r'[!()\[\]<>]')
# a single-letter bracket NOT touching Hebrew letters is a standalone doublet label
# ([א]/[ב]) -> drop whole; one attached to a word is a restored letter (עמ[ד]=עמד) -> keep it
LABEL = re.compile(r'(?<![א-ת])\[[א-ת]\](?![א-ת])')


def clean(text):
    t = LABEL.sub('', text or '')        # drop only standalone doublet labels whole
    t = MARKS.sub('', t)                 # remove the remaining mark characters
    t = re.sub(r' +', ' ', t)            # collapse spaces left by the removals
    t = re.sub(r' +([:.׃])', r'\1', t)   # drop a space left before a stop mark
    return t.strip()


def main():
    conn = sqlite3.connect('data/torah.db')
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT id, text FROM verses").fetchall()
    updates, samples = [], []
    for r in rows:
        # only touch verses that actually contain one of these marks, so we never
        # collapse incidental double-spaces in unrelated verses
        if not (MARKS.search(r['text'] or '') or LABEL.search(r['text'] or '')):
            continue
        nt = clean(r['text'])
        if nt != (r['text'] or ''):
            updates.append((nt, r['id']))
            if len(samples) < 10:
                samples.append((r['text'], nt))

    print('verses changed: %d' % len(updates))
    for old, new in samples:
        i = MARKS.search(old).start()
        print('  - ...%s' % old[max(0, i - 16):i + 18])
        print('    ...%s' % new[max(0, i - 16):i + 16])

    if APPLY:
        bak = 'data/torah.db.bak11'
        if not os.path.exists(bak):
            shutil.copy2('data/torah.db', bak)
            print('backed up ->', bak)
        conn.executemany("UPDATE verses SET text=? WHERE id=?", updates)
        conn.commit()
        # confirm no marks remain
        left = conn.execute(
            "SELECT COUNT(*) FROM verses WHERE text GLOB '*[][!()<>]*'").fetchone()[0]
        print('applied. verses still containing any of those marks:', left)
    else:
        print('\n[dry-run] re-run with --apply to write.')
    conn.close()


if __name__ == '__main__':
    main()
