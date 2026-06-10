"""
Restore verse texts from original txt files.
Removes only bracket/brace CHARACTERS, keeps content inside.
Updates ONLY the `text` column — masoretic_text, english, sam_ch_id untouched.
Run from project root: py -3 scripts/restore_verse_text.py
"""
import re
import sys
import sqlite3
import os
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH  = os.path.join(DATA_DIR, 'torah.db')

BOOK_MAP = {
    'Genesis':     ('בראשית', 'בראשית.txt'),
    'Exodus':      ('שמות',   'שמות.txt'),
    'Leviticus':   ('ויקרא',  'ויקרא.txt'),
    'Numbers':     ('במדבר',  'במדבר.txt'),
    'Deuteronomy': ('דברים',  'דברים.txt'),
}


def clean_bidi(text):
    return ''.join(c for c in text if unicodedata.category(c) != 'Cf')


def clean_brackets(text):
    """Remove [ ] { } characters but keep content inside; collapse double spaces."""
    text = re.sub(r'\[([^\]]*)\]', r'\1', text)
    text = re.sub(r'\{([^}]*)\}', r'\1', text)
    text = re.sub(r'  +', ' ', text).strip()
    return text


def parse_book_file(filepath):
    """Returns {chapter_num: {verse_num: text_string}}"""
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
    """Returns {verse_num: text_string}"""
    parts  = re.split(r'(׃)([-–—]+)?', text)
    verses = {}
    v_num  = first_v
    n      = len(parts)
    i      = 0
    while i < n:
        chunk  = parts[i].strip() if parts[i] else ''
        sep    = parts[i + 1] if i + 1 < n else ''
        dashes = parts[i + 2] if i + 2 < n else ''

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

            verses[v_num] = verse_text

        i += 3 if sep else 1
    return verses


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Build (heb_name → book_id) lookup
    book_id_map = {r['name']: r['id']
                   for r in conn.execute('SELECT id, name FROM books').fetchall()}

    total_updated = 0

    for eng_key, (heb_name, fname) in BOOK_MAP.items():
        filepath = os.path.join(DATA_DIR, fname)
        if not os.path.exists(filepath):
            print(f'  WARNING: {fname} not found, skipping.')
            continue

        bid = book_id_map.get(heb_name)
        if bid is None:
            print(f'  WARNING: book "{heb_name}" not in DB, skipping.')
            continue

        print(f'Processing {fname}…')
        chapters = parse_book_file(filepath)

        for ch_num, verse_map in chapters.items():
            # Get chapter_id for this book + chapter number
            row = conn.execute(
                'SELECT id FROM chapters WHERE book_id=? AND number=?',
                (bid, ch_num)
            ).fetchone()
            if not row:
                continue
            ch_id = row['id']

            for v_num, raw_text in verse_map.items():
                fixed = clean_brackets(raw_text)
                result = conn.execute(
                    'UPDATE verses SET text=? WHERE chapter_id=? AND number=?',
                    (fixed, ch_id, v_num)
                )
                total_updated += result.rowcount

        conn.commit()
        print(f'  Done.')

    print(f'\nTotal verses updated: {total_updated}')
    conn.close()


if __name__ == '__main__':
    main()
