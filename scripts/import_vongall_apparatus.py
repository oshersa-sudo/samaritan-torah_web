# -*- coding: utf-8 -*-
"""
Import von Gall's critical apparatus (חילופי נוסח) from the digitised von-Gall
project (data/vongall/samaritan_pentateuch.db) into torah.db, linked to verses,
for the "חילופי נוסח" panel.

Each apparatus entry records, for a word (lemma = the position marker) in a
verse, a variant reading found in one or more manuscript witnesses (C2, E3, …).
NOTE: the von-Gall apparatus is currently digitised for **Genesis 1 only** (the
project's STATUS.md — the tiny sigla elsewhere aren't OCR-readable yet). The
structure here takes whatever the source DB holds, so re-running picks up more
once that project fills in the rest.

Creates ONLY the additive table vongall_apparatus — no other table touched.
Backs up torah.db first.

Usage:  py -3 scripts/import_vongall_apparatus.py            # dry run + stats
        py -3 scripts/import_vongall_apparatus.py --apply
"""
import sqlite3, sys, io, os, shutil

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
SRC = 'data/vongall/samaritan_pentateuch.db'
DB = 'data/torah.db'


def main():
    src = sqlite3.connect(SRC); src.row_factory = sqlite3.Row
    conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row

    # (book, chapter, verse) -> verse_id in torah.db (Masoretic/standard numbering)
    vidx = {}
    for r in conn.execute("""SELECT v.id vid, b.name bk, c.number ch, v.number vn
                             FROM verses v JOIN chapters c ON c.id=v.chapter_id
                             JOIN books b ON b.id=c.book_id"""):
        if str(r['vn']).isdigit():
            vidx[(r['bk'], r['ch'], int(r['vn']))] = r['vid']

    rows = src.execute('SELECT * FROM apparatus ORDER BY book, chapter, verse, register, sort_pos').fetchall()
    linked, missing = [], []
    for r in rows:
        key = (r['book'], r['chapter'], int(r['verse']))
        vid = vidx.get(key)
        if vid:
            linked.append((vid, r))
        else:
            missing.append(key)

    print('apparatus entries in source: %d' % len(rows))
    print('linked to a verse: %d   unmatched: %d' % (len(linked), len(missing)))
    if missing:
        print('  unmatched keys (first 10):', missing[:10])
    from collections import Counter
    perch = Counter((r['book'], r['chapter']) for r in rows)
    print('coverage:', dict(perch))

    if not APPLY:
        print('\n[dry-run] re-run with --apply'); conn.close(); src.close(); return

    bak = DB + '.bak_vongall'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak); print('backed up ->', bak)
    cur = conn.cursor()
    cur.execute('DROP TABLE IF EXISTS vongall_apparatus')
    cur.execute("""CREATE TABLE vongall_apparatus (
        id INTEGER PRIMARY KEY, verse_id INTEGER, register INTEGER, lemma TEXT,
        occurrence TEXT, reading TEXT, reading_type TEXT, witnesses TEXT,
        confidence TEXT, note TEXT, sort_pos INTEGER)""")
    for vid, r in linked:
        cur.execute("""INSERT INTO vongall_apparatus
            (verse_id, register, lemma, occurrence, reading, reading_type,
             witnesses, confidence, note, sort_pos)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (vid, r['register'], r['lemma'], r['occurrence'], r['reading'],
             r['reading_type'], r['witnesses'], r['confidence'], r['note'], r['sort_pos']))
    cur.execute('CREATE INDEX ix_vongall_verse ON vongall_apparatus (verse_id)')
    conn.commit()
    n = conn.execute('SELECT COUNT(*) FROM vongall_apparatus').fetchone()[0]
    nv = conn.execute('SELECT COUNT(DISTINCT verse_id) FROM vongall_apparatus').fetchone()[0]
    print('APPLIED: %d apparatus entries across %d verses' % (n, nv))
    conn.close(); src.close()


if __name__ == '__main__':
    main()
