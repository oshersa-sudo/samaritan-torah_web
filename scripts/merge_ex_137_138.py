# -*- coding: utf-8 -*-
"""
Merge Samaritan chapters #137 and #138 of שמות (book_id=2) into a single
chapter #137 — explicit user request to bring שמות from 199 to 198 canonical
Samaritan chapters. Matches the previously-identified scan-vs-app mismatch at
29:21 (app marked a chapter-end there that the scanned source did not
confirm).

Effects, all local (data/torah.db) only — no push:
  1. verses.sam_ch_id: move the 4 verses currently in old chapter #138
     (29:22-25) onto old chapter #137's row (29:19-21) -> one chapter, 7 verses.
  2. Delete the now-empty sam_chapters row for old #138.
  3. Renumber every later שמות sam_chapters row down by 1 (139->138, ..., 199->198).
  4. canon_chapter_counts (book_id=2): 199 -> 198.
  5. canon_portion_counts (portion_id=27, "וזה הדבר", the portion both merged
     chapters belong to): 14 -> 13.

Does NOT touch chapters/verses of any other book, and does not touch Masoretic
(book) chapter:verse numbering — only the Samaritan chapter grouping/numbering.

Usage:
  py -3 scripts/merge_ex_137_138.py            # dry run (prints what would change)
  py -3 scripts/merge_ex_137_138.py --apply
"""
import os
import sys
import sqlite3

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_ROOT, 'data', 'torah.db')
APPLY = '--apply' in sys.argv

NOTE_198 = ('קאנון עודכן ע"י בעל הפרויקט (2026-08-07): מ-199 ל-198 פרקים שומרוניים. '
            'שולב פרק שומרוני 137 (שמות כ"ט:19-21) עם פרק 138 (כ"ט:22-25) לפרק אחד, '
            'לאחר השוואה מול הסריקה שהראתה שהמקור אינו מאשר חלוקה שם. '
            'אין לשנות שוב בלי אישור מפורש נוסף.')
NOTE_PORTION = ('קאנון עודכן ע"י בעל הפרויקט (2026-08-07): מ-14 ל-13, בעקבות איחוד '
                'פרק שומרוני 137/138 (שניהם בתוך הפרשה הזו). אין לשנות שוב בלי אישור מפורש.')


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    ch137 = cur.execute("SELECT id, number FROM sam_chapters WHERE book_id=2 AND number=137").fetchone()
    ch138 = cur.execute("SELECT id, number FROM sam_chapters WHERE book_id=2 AND number=138").fetchone()
    if not ch137 or not ch138:
        print('ERROR: could not find both sam_chapters #137 and #138 for book_id=2'); return
    id137, id138 = ch137[0], ch138[0]

    v137_before = cur.execute("SELECT COUNT(*) FROM verses WHERE sam_ch_id=?", (id137,)).fetchone()[0]
    v138_before = cur.execute("SELECT COUNT(*) FROM verses WHERE sam_ch_id=?", (id138,)).fetchone()[0]
    total_before = cur.execute("SELECT COUNT(*) FROM sam_chapters WHERE book_id=2").fetchone()[0]
    to_renumber = cur.execute("SELECT COUNT(*) FROM sam_chapters WHERE book_id=2 AND number>138").fetchone()[0]

    print(f'chapter #137 (id={id137}): {v137_before} verses')
    print(f'chapter #138 (id={id138}): {v138_before} verses -> will move onto #137')
    print(f'book_id=2 sam_chapters total before: {total_before}')
    print(f'chapters with number>138 to renumber down by 1: {to_renumber}')

    if not APPLY:
        print('\nDRY RUN — re-run with --apply to write.')
        conn.close()
        return

    cur.execute("UPDATE verses SET sam_ch_id=? WHERE sam_ch_id=?", (id137, id138))
    cur.execute("DELETE FROM sam_chapters WHERE id=?", (id138,))
    cur.execute("UPDATE sam_chapters SET number=number-1 WHERE book_id=2 AND number>138")
    cur.execute("UPDATE canon_chapter_counts SET canonical_count=198, note=? WHERE book_id=2", (NOTE_198,))
    cur.execute("UPDATE canon_portion_counts SET canonical_count=13, note=? WHERE portion_id=27", (NOTE_PORTION,))
    conn.commit()

    v137_after = cur.execute("SELECT COUNT(*) FROM verses WHERE sam_ch_id=?", (id137,)).fetchone()[0]
    total_after = cur.execute("SELECT COUNT(*) FROM sam_chapters WHERE book_id=2").fetchone()[0]
    gap_check = cur.execute(
        "SELECT number FROM sam_chapters WHERE book_id=2 ORDER BY number").fetchall()
    numbers = [r[0] for r in gap_check]
    contiguous = numbers == list(range(1, total_after + 1))
    print(f'\nAPPLIED.')
    print(f'chapter #137 (id={id137}) now has {v137_after} verses (expected {v137_before + v138_before})')
    print(f'book_id=2 sam_chapters total after: {total_after} (expected 198)')
    print(f'numbering 1..{total_after} contiguous, no gaps/dupes: {contiguous}')
    conn.close()


if __name__ == '__main__':
    main()
