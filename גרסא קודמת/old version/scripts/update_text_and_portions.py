"""
1. Clean verse texts: remove [..] and {..} markers
2. Re-import Jewish portions from Jewish_Portions of the week.xlsx
Run from project root: py -3.12 scripts/update_text_and_portions.py
"""
import re
import sys
import sqlite3
import os
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH  = os.path.join(DATA_DIR, 'torah.db')
XLS_PATH = os.path.join(DATA_DIR, 'Jewish_Portions of the week.xlsx')

BOOK_HEB_MAP = {
    'בראשית': 'Genesis',
    'שמות':   'Exodus',
    'ויקרא':  'Leviticus',
    'במדבר':  'Numbers',
    'דברים':  'Deuteronomy',
}

BRACKET_RE = re.compile(r'\[[^\]]*\]|\{[^}]*\}')


def clean_text(text):
    text = BRACKET_RE.sub('', text)
    text = re.sub(r'  +', ' ', text).strip()
    return text


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # ── 1. Clean verse texts ──────────────────────────────────────────────────
    print('Cleaning verse texts…')
    rows = conn.execute("SELECT id, text FROM verses WHERE text LIKE '%[%' OR text LIKE '%{%'").fetchall()
    count = 0
    for row in rows:
        cleaned = clean_text(row['text'])
        if cleaned != row['text']:
            conn.execute("UPDATE verses SET text=? WHERE id=?", (cleaned, row['id']))
            count += 1
    conn.commit()
    print(f'  {count} verses cleaned.')

    # ── 2. Re-import Jewish portions ─────────────────────────────────────────
    print('Loading portions from Excel…')
    wb = openpyxl.load_workbook(XLS_PATH)
    ws = wb.active

    # Build book_id lookup
    book_rows = conn.execute("SELECT id, name FROM books ORDER BY order_n").fetchall()
    book_name_to_id = {}
    for r in book_rows:
        for heb, eng in BOOK_HEB_MAP.items():
            if r['name'] == heb:
                book_name_to_id[heb] = r['id']

    portions = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        heb_book, heb_name, start_str, end_str = row[0], row[1], row[2], row[3]
        if not heb_book or not heb_name or not start_str or not end_str:
            continue
        heb_book = str(heb_book).strip()
        heb_name = str(heb_name).strip()
        bid = book_name_to_id.get(heb_book)
        if bid is None:
            print(f'  WARNING: unknown book {heb_book!r}')
            continue
        sc, sv = [int(x) for x in str(start_str).strip().split(':')]
        ec, ev = [int(x) for x in str(end_str).strip().split(':')]
        portions.append((bid, heb_name, sc, sv, ec, ev))

    conn.execute("DELETE FROM portions")
    order_by_book = {}
    for bid, name, sc, sv, ec, ev in portions:
        order_by_book[bid] = order_by_book.get(bid, 0) + 1
        conn.execute(
            "INSERT INTO portions (book_id, name, order_n, start_ch, start_v, end_ch, end_v) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (bid, name, order_by_book[bid], sc, sv, ec, ev)
        )
    conn.commit()
    print(f'  {len(portions)} portions inserted.')

    conn.close()
    print('Done.')


if __name__ == '__main__':
    main()
