# -*- coding: utf-8 -*-
"""
Fix the corrupted Deuteronomy data in data/torah.db.

Root cause: data/דברים.txt was malformed (it held Numbers 23-36 instead of
Deut 1-9), so import_torah.py built דברים with chapters 10-36 where 35-36 were
duplicated Numbers content and chapters 1-9 were missing entirely.

This rebuilds ONLY the דברים book (no other book or versification is touched):
  * existing Deut verses (ch 10-34) keep their text, commentaries and dictionary
    byte-for-byte (snapshotted and restored by chapter:verse),
  * the missing chapters 1-9 (and any verses absent from the DB) are added from
    the authoritative samaritan_site.json,
  * the spurious Numbers chapters 35-36 are dropped (they remain correct under
    במדבר),
  * the Samaritan division (sam_chapters / sam_ch_id) for דברים is rebuilt from
    the JSON `qissa_end` flag, which matches the existing ׃-- markers.

Re-runnable; make a backup first (data/torah.db.bak).
"""
import os, io, json, sqlite3

D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
DB = os.path.join(D, 'torah.db')
JSON = os.path.join(D, 'samaritan_site.json')
BOOK, SLUG = 'דברים', 'deuteronomy'
MARK = ' ׃--'

# verse columns we carry over for existing verses (everything content-bearing)
KEEP = ['text', 'english', 'masoretic_text', 'interpretation', 'sam_hebrew',
        'sam_aramaic', 'simple_hebrew', 'site_english', 'old_text',
        'rashi', 'ramban', 'cassuto', 'baal_haturim']


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    j = json.load(io.open(JSON, encoding='utf-8'))
    chs = j[SLUG]['chapters']

    book_id = conn.execute('SELECT id FROM books WHERE name=?', (BOOK,)).fetchone()['id']

    # 1) snapshot existing verses + dictionary, keyed by (chapter, verse)
    snap = {}
    for r in conn.execute(
            '''SELECT ch.number AS ch, v.number AS vn, v.* FROM verses v
               JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=?''', (book_id,)):
        snap[(r['ch'], r['vn'])] = {k: r[k] for k in KEEP}
    dsnap = {}
    for r in conn.execute(
            '''SELECT ch.number AS ch, v.number AS vn, vd.aramaic, vd.hebrew
               FROM verse_dictionary vd JOIN verses v ON v.id=vd.verse_id
               JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=? ORDER BY vd.id''', (book_id,)):
        dsnap.setdefault((r['ch'], r['vn']), []).append((r['aramaic'], r['hebrew']))
    print('snapshot: %d verses, %d dictionary rows' %
          (len(snap), sum(len(x) for x in dsnap.values())))

    # 2) delete the book's verse_dictionary, verses, chapters, sam_chapters
    conn.execute('''DELETE FROM verse_dictionary WHERE verse_id IN
        (SELECT v.id FROM verses v JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=?)''', (book_id,))
    conn.execute('''DELETE FROM verses WHERE chapter_id IN
        (SELECT id FROM chapters WHERE book_id=?)''', (book_id,))
    conn.execute('DELETE FROM chapters WHERE book_id=?', (book_id,))
    conn.execute('DELETE FROM sam_chapters WHERE book_id=?', (book_id,))

    # 3) rebuild דברים from JSON (chapters 1..N)
    sam_num = [1]
    sam_id = [None]

    def new_sam():
        cur = conn.execute('INSERT INTO sam_chapters (book_id, number) VALUES (?,?)',
                            (book_id, sam_num[0]))
        sam_id[0] = cur.lastrowid
        sam_num[0] += 1

    new_sam()
    added = kept = 0
    for ch in sorted(int(x) for x in chs):
        cur = conn.execute('INSERT INTO chapters (book_id, number) VALUES (?,?)', (book_id, ch))
        ch_id = cur.lastrowid
        verses = chs[str(ch)]
        for v in sorted(int(x) for x in verses):
            jv = verses[str(v)]
            qissa = bool(jv.get('qissa_end'))
            if (ch, v) in snap:
                data = dict(snap[(ch, v)])
                kept += 1
            else:
                txt = (jv.get('hebrew') or '')
                if qissa:
                    txt += MARK
                data = {k: None for k in KEEP}
                data['text'] = txt
                data['sam_hebrew'] = jv.get('hebrew')
                data['sam_aramaic'] = jv.get('aramaic')
                data['simple_hebrew'] = jv.get('simple_hebrew')
                data['site_english'] = jv.get('english')
                data['english'] = jv.get('english')
                added += 1
            cols = ['chapter_id', 'number', 'sam_ch_id'] + KEEP
            vals = [ch_id, v, sam_id[0]] + [data[k] for k in KEEP]
            curv = conn.execute(
                'INSERT INTO verses (%s) VALUES (%s)' % (','.join(cols), ','.join('?' * len(cols))),
                vals)
            vid = curv.lastrowid
            for ar, he in dsnap.get((ch, v), []):
                conn.execute('INSERT INTO verse_dictionary (verse_id, aramaic, hebrew) VALUES (?,?,?)',
                             (vid, ar, he))
            if qissa:
                new_sam()
    conn.commit()

    # 4) report
    nverses = conn.execute(
        '''SELECT COUNT(*) FROM verses v JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=?''',
        (book_id,)).fetchone()[0]
    nchap = conn.execute('SELECT COUNT(*) FROM chapters WHERE book_id=?', (book_id,)).fetchone()[0]
    nsam = conn.execute('SELECT COUNT(*) FROM sam_chapters WHERE book_id=?', (book_id,)).fetchone()[0]
    print('rebuilt דברים: %d chapters, %d verses (%d preserved, %d added), %d samaritan chapters' %
          (nchap, nverses, kept, added, nsam))
    conn.close()


if __name__ == '__main__':
    main()
