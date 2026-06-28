# -*- coding: utf-8 -*-
"""Import the Samaritan oral-reading phonetic transcription (Ben-Ḥayyim Latin
transliteration) from the project bundle into torah.db as an ADDITIVE table
`verse_translit(verse_id, text)`. Nothing else in the DB is touched.

Source DB (the bundle's sqlite) is mapped to torah.db verse ids by
book_order -> books.id, chapter -> chapters.number, and verse(+suffix) ->
verses.number ("14" or, for Samaritan additions, "14-2").

Usage:  py -3 scripts/import_translit.py path/to/samaritan_torah.sqlite
"""
import sqlite3, sys, os

DB = 'data/torah.db'


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    if not src or not os.path.exists(src):
        print('usage: import_translit.py <samaritan_torah.sqlite>'); sys.exit(1)
    main_db = sqlite3.connect(DB, timeout=120)
    main_db.execute('PRAGMA busy_timeout=120000')
    main_db.row_factory = sqlite3.Row
    tr = sqlite3.connect(src); tr.row_factory = sqlite3.Row

    main_db.execute('CREATE TABLE IF NOT EXISTS verse_translit('
                    'verse_id INTEGER PRIMARY KEY, text TEXT)')
    main_db.commit()

    # cache (book_id, chapter_number) -> chapter_id and resolve verse numbers
    ch_cache = {}
    def chapter_id(book_order, chapter):
        key = (book_order, chapter)
        if key not in ch_cache:
            r = main_db.execute('SELECT id FROM chapters WHERE book_id=? AND number=?',
                                (book_order, chapter)).fetchone()
            ch_cache[key] = r['id'] if r else None
        return ch_cache[key]

    rows = tr.execute('SELECT book_order, chapter, verse, verse_suffix, text FROM verses').fetchall()
    matched = unmatched = 0
    for r in rows:
        num = str(r['verse']) if r['verse_suffix'] is None else '%s-%s' % (r['verse'], r['verse_suffix'])
        cid = chapter_id(r['book_order'], r['chapter'])
        vid = None
        if cid is not None:
            v = main_db.execute('SELECT id FROM verses WHERE chapter_id=? AND number=?',
                                (cid, num)).fetchone()
            vid = v['id'] if v else None
        if vid is None:
            unmatched += 1; continue
        main_db.execute('INSERT OR REPLACE INTO verse_translit(verse_id, text) VALUES (?,?)',
                        (vid, (r['text'] or '').strip()))
        matched += 1
    main_db.commit()
    n = main_db.execute('SELECT COUNT(*) FROM verse_translit').fetchone()[0]
    print('imported: matched=%d unmatched=%d | verse_translit rows=%d' % (matched, unmatched, n))
    print('integrity:', main_db.execute('PRAGMA integrity_check').fetchone()[0])
    main_db.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
