# -*- coding: utf-8 -*-
"""
Copy the Arabic translation from 'torah with arabic.db' into data/torah.db,
matched by Jewish division (book, chapter, verse), into a new column
verses.arabic_trans.

Non-destructive: only ADDs the column and UPDATEs that one column. The source DB
is opened read-only. Re-runnable. Back up data/torah.db first.
"""
import sqlite3, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'torah with arabic.db')
MINE = os.path.join(ROOT, 'data', 'torah.db')

# (book, chapter, verse) -> arabic, only where the source actually has text
src = sqlite3.connect('file:%s?mode=ro' % SRC, uri=True)
amap = {}
for bk, ch, vs, ar in src.execute(
        '''SELECT b.name, ch.number, v.number, v.arabic_translation
           FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
           JOIN books b ON b.id=ch.book_id
           WHERE v.arabic_translation IS NOT NULL AND TRIM(v.arabic_translation) <> ''' "''"):
    amap[(bk, ch, vs)] = ar
src.close()
print('arabic translations in source:', len(amap))

conn = sqlite3.connect(MINE)
cols = [r[1] for r in conn.execute('PRAGMA table_info(verses)')]
if 'arabic_trans' not in cols:
    conn.execute('ALTER TABLE verses ADD COLUMN arabic_trans TEXT')
    print('added column verses.arabic_trans')
else:
    print('column verses.arabic_trans already exists')

rows = conn.execute(
    '''SELECT v.id, b.name, ch.number, v.number
       FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
       JOIN books b ON b.id=ch.book_id''').fetchall()
updates = [(amap[(bk, ch, vs)], vid) for (vid, bk, ch, vs) in rows if (bk, ch, vs) in amap]
conn.executemany('UPDATE verses SET arabic_trans=? WHERE id=?', updates)
conn.commit()

n = conn.execute("SELECT COUNT(*) FROM verses WHERE arabic_trans IS NOT NULL AND TRIM(arabic_trans)<>''").fetchone()[0]
unmatched = len(amap) - len(updates)
print('verses updated with arabic : %d' % len(updates))
print('verses now holding arabic  : %d' % n)
print('source arabic not matched  : %d' % unmatched)
conn.close()
