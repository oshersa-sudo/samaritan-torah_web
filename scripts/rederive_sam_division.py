# -*- coding: utf-8 -*-
"""
Section 2 — re-derive the Samaritan chapter division strictly from the ׃-- verse
endings, for all books. A Samaritan chapter runs from just after one ׃-- to the
next; a verse ending in ׃-- closes its chapter. Rebuilds sam_chapters and
verses.sam_ch_id only; verse text and all other columns are untouched, and
verse ids don't change (so root_index / dictionary links stay valid). Full
backup. Surfaces old vs new chapter counts before writing.

Usage:  py -3 scripts/rederive_sam_division.py            # dry run
        py -3 scripts/rederive_sam_division.py --apply
"""
import sqlite3, sys, io, os, re, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APPLY = '--apply' in sys.argv
END = re.compile(r'׃[-–—]+\s*$')


def main():
    conn = sqlite3.connect('data/torah.db'); conn.row_factory = sqlite3.Row
    plan = {}     # book_id -> (he, K_new, K_old, [(verse_id, sam_number)])
    for b in conn.execute('SELECT id, name FROM books ORDER BY order_n'):
        verses = conn.execute(
            '''SELECT v.id, v.text FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
               WHERE ch.book_id=? ORDER BY ch.number, v.number''', (b['id'],)).fetchall()
        sam, assign = 1, []
        for v in verses:
            assign.append((v['id'], sam))
            if END.search(v['text'] or ''):
                sam += 1
        k_new = max(n for _, n in assign)
        k_old = conn.execute('SELECT COUNT(*) FROM sam_chapters WHERE book_id=?', (b['id'],)).fetchone()[0]
        plan[b['id']] = (b['name'], k_new, k_old, assign)
        print('%-8s sam_chapters  old=%d -> new=%d  (%s)' % (
            b['name'], k_old, k_new, 'unchanged' if k_old == k_new else 'CHANGED'))

    if not APPLY:
        print('\n[dry-run] re-run with --apply to write.')
        conn.close(); return

    bak = 'data/torah.db.bak_sam'
    if not os.path.exists(bak):
        shutil.copy2('data/torah.db', bak); print('backed up ->', bak)
    cur = conn.cursor()
    for bid, (he, k_new, k_old, assign) in plan.items():
        cur.execute('DELETE FROM sam_chapters WHERE book_id=?', (bid,))
        idmap = {}
        for n in range(1, k_new + 1):
            cur.execute('INSERT INTO sam_chapters (book_id, number) VALUES (?,?)', (bid, n))
            idmap[n] = cur.lastrowid
        cur.executemany('UPDATE verses SET sam_ch_id=? WHERE id=?',
                        [(idmap[n], vid) for vid, n in assign])
    conn.commit()
    # verify
    nullsam = conn.execute('SELECT COUNT(*) FROM verses WHERE sam_ch_id IS NULL').fetchone()[0]
    orphan = conn.execute('''SELECT COUNT(*) FROM verses v LEFT JOIN sam_chapters s ON s.id=v.sam_ch_id
                             WHERE v.sam_ch_id IS NOT NULL AND s.id IS NULL''').fetchone()[0]
    print('applied. NULL sam_ch_id=%d  orphan sam links=%d' % (nullsam, orphan))
    conn.close()


if __name__ == '__main__':
    main()
