# -*- coding: utf-8 -*-
"""
Shift the Arabic translation back by one Samaritan chapter, for a given book and
a range of Samaritan chapter numbers. The Arabic currently sits one Samaritan
chapter too late, so each chapter K in the range takes the (current) Arabic of
chapter K+1, mapped verse-by-verse by position within the chapter.

Only verses.arabic_trans of the targeted chapters are changed; nothing else.
All source values are read first, then written, so the shift can't corrupt
itself. Back up data/torah.db first.

Usage:  py -3 scripts/shift_arabic.py [book] [start] [end]
        (defaults: בראשית 7 13)
"""
import sqlite3, sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'torah.db')
BOOK = sys.argv[1] if len(sys.argv) > 1 else 'בראשית'
START = int(sys.argv[2]) if len(sys.argv) > 2 else 7
END = int(sys.argv[3]) if len(sys.argv) > 3 else 13

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
book_id = conn.execute('SELECT id FROM books WHERE name=?', (BOOK,)).fetchone()['id']


def chapter_verses(num):
    """Verses of Samaritan chapter `num`, in order, with current Arabic."""
    return conn.execute(
        '''SELECT v.id, v.arabic_trans FROM verses v
           JOIN sam_chapters sc ON sc.id = v.sam_ch_id
           WHERE sc.book_id = ? AND sc.number = ? ORDER BY v.id''',
        (book_id, num)).fetchall()


# read all involved chapters FIRST (targets START..END, sources START+1..END+1)
src = {num: chapter_verses(num) for num in range(START, END + 2)}

updates = []   # (new_arabic, verse_id)
for K in range(START, END + 1):
    target = src[K]          # chapter K's verses (these get overwritten)
    source = src[K + 1]      # chapter K+1's current Arabic moves down to K
    for i, tv in enumerate(target):
        new_ar = source[i]['arabic_trans'] if i < len(source) else None
        updates.append((new_ar, tv['id']))

conn.executemany('UPDATE verses SET arabic_trans=? WHERE id=?', updates)
conn.commit()
print('%s: shifted Samaritan chapters %d..%d back by one (%d verses updated)' %
      (BOOK, START, END, len(updates)))
conn.close()
