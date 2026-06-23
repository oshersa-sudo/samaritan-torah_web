"""
Parse Torah text files + portions Excel → populate data/torah.db
Run from project root: python scripts/import_torah.py
"""
import re
import sys
import sqlite3
import unicodedata
import os
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH  = os.path.join(DATA_DIR, 'torah.db')
XLS_PATH = os.path.join(DATA_DIR, 'portions of the week.xlsx')

BOOK_MAP = {
    'Genesis':     ('בראשית', 'בראשית.txt', 1),
    'Exodus':      ('שמות',   'שמות.txt',   2),
    'Leviticus':   ('ויקרא',  'ויקרא.txt',  3),
    'Numbers':     ('במדבר',  'במדבר.txt',  4),
    'Deuteronomy': ('דברים',  'דברים.txt',  5),
}


def clean_bidi(text):
    return ''.join(c for c in text if unicodedata.category(c) != 'Cf')


def book_key(excel_book):
    excel_book = excel_book.strip()
    for key in BOOK_MAP:
        if excel_book.startswith(key):
            return key
    raise ValueError(f"Unknown book: {excel_book!r}")


def parse_range(r):
    r = r.strip().replace('\xa0', '').replace(' ', '')
    m = re.match(r'^(\d+)(?::(\d+))?-(\d+)(?::(\d+))?$', r)
    if not m:
        raise ValueError(f"Cannot parse range: {r!r}")
    sc = int(m.group(1));  sv = int(m.group(2)) if m.group(2) else 1
    ec = int(m.group(3));  ev = int(m.group(4)) if m.group(4) else 9999
    return sc, sv, ec, ev


def parse_book_file(filepath):
    """
    Returns {chapter_num: {verse_num: {'text': str, 'sam_end': bool}}}
    sam_end=True means this verse ends a Samaritan chapter (had ׃--)
    ׃-- is preserved in the verse text.
    """
    with open(filepath, 'rb') as f:
        raw = f.read()
    text = clean_bidi(raw.decode('utf-8'))
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    chapters = {}
    for line in lines:
        m = re.match(r'^[A-Za-z]+\s+(\d+):(\d+)\s+(.*)', line, re.DOTALL)
        if m:
            ch_num  = int(m.group(1))
            first_v = int(m.group(2))
            rest    = m.group(3)
        else:
            ch_num  = 1
            first_v = 1
            rest    = line
        chapters[ch_num] = _parse_verses(rest, first_v)
    return chapters


def _parse_verses(text, first_v):
    """
    Returns {verse_num: {'text': str, 'sam_end': bool}}
    Preserves ׃-- in verse text where present.
    """
    # Split on ׃ capturing optional following dashes
    parts = re.split(r'(׃)([-–—]+)?', text)
    # parts layout: [chunk, ׃, dashes_or_None, chunk, ׃, dashes_or_None, ...]

    verses  = {}
    v_num   = first_v
    n       = len(parts)

    i = 0
    while i < n:
        chunk = parts[i].strip() if parts[i] else ''
        sep   = parts[i + 1] if i + 1 < n else ''       # ׃ or ''
        dashes = parts[i + 2] if i + 2 < n else ''      # '--' or None or ''

        sam_end = bool(dashes and re.search(r'[-–—]', dashes or ''))

        if chunk:
            m = re.match(r'^(\d+)\s+(.*)', chunk, re.DOTALL)
            if m:
                v_num      = int(m.group(1))
                verse_text = m.group(2).strip()
            else:
                verse_text = chunk

            if sam_end:
                verse_text = verse_text + ' ׃--'

            verses[v_num] = {'text': verse_text, 'sam_end': sam_end}

        i += 3 if sep else 1

    return verses


def init_schema(conn):
    conn.executescript("""
        DROP TABLE IF EXISTS verses;
        DROP TABLE IF EXISTS sam_chapters;
        DROP TABLE IF EXISTS chapters;
        DROP TABLE IF EXISTS portions;
        DROP TABLE IF EXISTS books;

        CREATE TABLE books (
            id      INTEGER PRIMARY KEY,
            name    TEXT NOT NULL,
            order_n INTEGER NOT NULL
        );

        CREATE TABLE portions (
            id       INTEGER PRIMARY KEY,
            book_id  INTEGER NOT NULL REFERENCES books(id),
            name     TEXT NOT NULL,
            order_n  INTEGER NOT NULL,
            start_ch INTEGER NOT NULL,
            start_v  INTEGER NOT NULL DEFAULT 1,
            end_ch   INTEGER NOT NULL,
            end_v    INTEGER NOT NULL DEFAULT 9999
        );

        CREATE TABLE chapters (
            id      INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL REFERENCES books(id),
            number  INTEGER NOT NULL
        );

        CREATE TABLE sam_chapters (
            id      INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL REFERENCES books(id),
            number  INTEGER NOT NULL
        );

        CREATE TABLE verses (
            id         INTEGER PRIMARY KEY,
            chapter_id INTEGER NOT NULL REFERENCES chapters(id),
            number     INTEGER NOT NULL,
            text       TEXT NOT NULL,
            sam_ch_id  INTEGER REFERENCES sam_chapters(id),
            sam_number TEXT
        );

        CREATE INDEX idx_chapters_book   ON chapters(book_id, number);
        CREATE INDEX idx_sam_chapters_bk ON sam_chapters(book_id, number);
        CREATE INDEX idx_verses_chapter  ON verses(chapter_id, number);
        CREATE INDEX idx_verses_sam_ch   ON verses(sam_ch_id);
        CREATE INDEX idx_verses_text     ON verses(text);
        CREATE INDEX idx_portions_book   ON portions(book_id, order_n);
    """)
    conn.commit()


def load_excel_portions(path):
    wb  = openpyxl.load_workbook(path)
    ws  = wb['parasha']
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        heb_name, book_cell, ch_range = row[1], row[3], row[4]
        if not heb_name or '***' in str(heb_name):
            continue
        if not book_cell or not ch_range:
            continue
        try:
            bkey = book_key(str(book_cell))
            sc, sv, ec, ev = parse_range(str(ch_range))
        except ValueError as e:
            print(f"  WARNING: {e}")
            continue
        out.append({'name': str(heb_name).strip(), 'book_key': bkey,
                    'start_ch': sc, 'start_v': sv, 'end_ch': ec, 'end_v': ev})
    return out


def main():
    print("Connecting to DB…")
    conn = sqlite3.connect(DB_PATH)
    init_schema(conn)

    print("Loading portions from Excel…")
    portions = load_excel_portions(XLS_PATH)

    # Insert books
    book_ids = {}
    for key, (heb, _fn, order) in sorted(BOOK_MAP.items(), key=lambda x: x[1][2]):
        cur = conn.execute("INSERT INTO books (name, order_n) VALUES (?, ?)", (heb, order))
        book_ids[key] = cur.lastrowid
    conn.commit()
    print(f"  {len(book_ids)} books.")

    # Insert portions
    portion_order = {k: 0 for k in BOOK_MAP}
    for p in portions:
        bkey = p['book_key']
        portion_order[bkey] += 1
        conn.execute(
            "INSERT INTO portions (book_id,name,order_n,start_ch,start_v,end_ch,end_v) VALUES(?,?,?,?,?,?,?)",
            (book_ids[bkey], p['name'], portion_order[bkey],
             p['start_ch'], p['start_v'], p['end_ch'], p['end_v'])
        )
    conn.commit()
    print(f"  {sum(portion_order.values())} portions.")

    total_chapters = total_sam = total_verses = 0

    for key, (heb, fname, _order) in sorted(BOOK_MAP.items(), key=lambda x: x[1][2]):
        filepath = os.path.join(DATA_DIR, fname)
        print(f"  Parsing {fname}…")
        chapters = parse_book_file(filepath)
        bid = book_ids[key]

        # Running Samaritan chapter counter for this book
        sam_num    = 1
        sam_ch_id  = None  # current samaritan chapter DB id

        def new_sam_chapter():
            nonlocal sam_num, sam_ch_id
            cur = conn.execute(
                "INSERT INTO sam_chapters (book_id, number) VALUES (?, ?)", (bid, sam_num)
            )
            sam_ch_id = cur.lastrowid
            sam_num  += 1

        # Start the first Samaritan chapter before any verse
        new_sam_chapter()

        for ch_num in sorted(chapters.keys()):
            cur = conn.execute(
                "INSERT INTO chapters (book_id, number) VALUES (?, ?)", (bid, ch_num)
            )
            ch_id = cur.lastrowid
            total_chapters += 1

            verse_data = chapters[ch_num]
            for v_num in sorted(verse_data.keys()):
                vd   = verse_data[v_num]
                text = vd['text']

                conn.execute(
                    "INSERT INTO verses (chapter_id, number, text, sam_ch_id) VALUES (?,?,?,?)",
                    (ch_id, v_num, text, sam_ch_id)
                )
                total_verses += 1

                if vd['sam_end']:
                    new_sam_chapter()
                    total_sam += 1

        conn.commit()

    print(f"\nDone!")
    print(f"  {total_chapters} standard chapters")
    print(f"  {total_sam} samaritan chapters")
    print(f"  {total_verses} verses")
    conn.close()


if __name__ == '__main__':
    main()
