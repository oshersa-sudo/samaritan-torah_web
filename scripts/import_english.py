"""
Parse tal_torah.pdf (Florentin & Tal translation) and store English verse text in DB.
Run from project root: py -3.12 scripts/import_english.py
"""
import re
import sqlite3
import sys
import pdfplumber

sys.stdout.reconfigure(encoding='utf-8')

PDF_PATH  = 'data/tal_torah.pdf'
DB_PATH   = 'data/torah.db'

BOOK_IDS = {
    'genesis': 1, 'exodus': 2, 'leviticus': 3,
    'numbers': 4, 'deuteronomy': 5,
}

# PDF page ranges for translation (0-indexed)
TRANS_FIRST = 86
TRANS_LAST  = 912   # translation ends p913 (0-indexed); endnotes start p916

COL_SPLIT   = 295   # x < this → English column

# Patterns
HDR_BOOK_CH = re.compile(
    r'(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\s+(\d+)',
    re.IGNORECASE)
HDR_BOOK_ONLY = re.compile(
    r'(GENESIS|EXODUS|LEVITICUS|NUMBERS|DEUTERONOMY)', re.IGNORECASE)

# Verse number: 1-3 digits followed by space + uppercase letter / quote
VERSE_NUM_RE = re.compile(r'(?<!\d)(\d{1,3})(?!\d)\s+(?=[A-Z“‘"\'(])')

# Clean up noise
NOISE_RE = re.compile(
    r'\(cid:\d+\)'      # unreadable glyphs
    r'|:?\s*>?\s*—+\s*—+\s*<?:?'  # Samaritan chapter markers
    r'|\[\s*\]'         # empty brackets
)


def setup_db(conn):
    try:
        conn.execute("ALTER TABLE verses ADD COLUMN english TEXT")
        conn.commit()
        print("Added 'english' column.")
    except Exception:
        print("'english' column already exists.")


def build_lookups(conn):
    """Returns: (book_ch_to_cid, cid_vnum_to_vid)"""
    chs = conn.execute("SELECT id, book_id, number FROM chapters").fetchall()
    book_ch_to_cid = {(r['book_id'], r['number']): r['id'] for r in chs}

    vs = conn.execute("SELECT id, chapter_id, number FROM verses").fetchall()
    cid_vnum_to_vid = {(r['chapter_id'], r['number']): r['id'] for r in vs}

    return book_ch_to_cid, cid_vnum_to_vid


CONTENT_BOTTOM = 575  # footnotes/apparatus start below this y on 720-height pages

def get_left_words(page):
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    # Scale cutoff to actual page height (pages are 720pt tall)
    bottom = CONTENT_BOTTOM * (page.height / 720.0)
    left = [w for w in words if w['x0'] < COL_SPLIT and w['top'] < bottom]
    left.sort(key=lambda w: (w['top'], w['x0']))
    return left


def parse_header(left_words):
    """Return (book_lower, ch_int) or (None, None)."""
    hdr = [w for w in left_words if w['top'] < 65]
    text = ' '.join(w['text'] for w in hdr)

    m = HDR_BOOK_CH.search(text)
    if m:
        return m.group(1).lower(), int(m.group(2))

    m2 = HDR_BOOK_ONLY.search(text)
    if m2:
        return m2.group(1).lower(), 1  # first chapter when only book title shown

    return None, None


def words_to_text(left_words):
    """Reconstruct flowing English text from content area (y >= 65)."""
    content = [w for w in left_words if w['top'] >= 65]
    if not content:
        return ''

    # Sort by binned y (8px bins) then x — keeps verse numbers in correct line order
    content.sort(key=lambda w: (round(w['top'] / 8) * 8, w['x0']))

    lines = []
    cur_words = []
    cur_y = None

    for w in content:
        y = round(w['top'] / 8) * 8
        if cur_y is None or y != cur_y:
            if cur_words:
                lines.append(' '.join(cur_words))
            cur_words = [w['text']]
            cur_y = y
        else:
            cur_words.append(w['text'])
    if cur_words:
        lines.append(' '.join(cur_words))

    return ' '.join(lines)


def parse_verses(text):
    """Return list of (verse_num, text) in page order."""
    text = NOISE_RE.sub(' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    matches = list(VERSE_NUM_RE.finditer(text))
    if not matches:
        return []

    result = []
    for i, m in enumerate(matches):
        v = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        vtext = text[start:end].strip()
        vtext = re.sub(r'\s+', ' ', vtext)
        if vtext:
            result.append((v, vtext))
    return result


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    setup_db(conn)

    book_ch_to_cid, cid_vnum_to_vid = build_lookups(conn)

    cur_book  = None
    cur_ch    = None
    last_v    = 0      # last verse number seen on prev page
    updates   = 0
    missing   = 0

    with pdfplumber.open(PDF_PATH) as pdf:
        total_pages = TRANS_LAST - TRANS_FIRST + 1
        for page_idx in range(TRANS_FIRST, TRANS_LAST + 1):
            page = pdf.pages[page_idx]
            left_words = get_left_words(page)

            hdr_book, hdr_ch = parse_header(left_words)

            # Update current book/chapter from header (never go backwards in chapter)
            if hdr_book and hdr_book != cur_book:
                cur_book = hdr_book
                cur_ch   = hdr_ch or 1
                last_v   = 0
            elif hdr_ch and hdr_ch > (cur_ch or 0):
                cur_ch = hdr_ch
                last_v = 0

            if cur_book is None:
                continue

            text = words_to_text(left_words)
            verses = parse_verses(text)

            for v_num, v_text in verses:
                # Chapter transition: new chapter always starts at verse 1 or 2.
                # Using <= 2 avoids false triggers (e.g. cross-page v=7 after prev-page v=14).
                if v_num <= 2 and last_v > 5:
                    cur_ch += 1
                last_v = v_num

                book_id = BOOK_IDS.get(cur_book)
                if book_id is None:
                    continue

                ch_id = book_ch_to_cid.get((book_id, cur_ch))
                if ch_id is None:
                    missing += 1
                    continue

                v_id = cid_vnum_to_vid.get((ch_id, v_num))
                if v_id is None:
                    missing += 1
                    continue

                conn.execute(
                    "UPDATE verses SET english=? WHERE id=?",
                    (v_text, v_id)
                )
                updates += 1

            if (page_idx - TRANS_FIRST) % 100 == 0:
                pct = (page_idx - TRANS_FIRST) / total_pages * 100
                print(f'  {pct:.0f}%  page {page_idx+1}  updates={updates}  '
                      f'cur={cur_book} ch={cur_ch}')
                conn.commit()

    conn.commit()
    conn.close()
    print(f'\nDone. {updates} verses updated, {missing} not found.')


if __name__ == '__main__':
    main()
