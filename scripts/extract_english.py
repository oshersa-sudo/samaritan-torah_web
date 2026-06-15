"""
Extract English translation from tal_torah.pdf (printed pages 87-896).
Left column only (x < 260), apparatus excluded by font size.
Stores in verses.english in torah.db.
Run from project root: py -3 scripts/extract_english.py
"""
import re
import sys
import sqlite3
import os
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')

try:
    from pypdf import PdfReader
except ImportError:
    print("ERROR: pypdf not installed. Run: py -3 -m pip install pypdf")
    sys.exit(1)

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH  = os.path.join(DATA_DIR, 'torah.db')
PDF_PATH = os.path.join(DATA_DIR, 'tal_torah.pdf')

BOOK_MAP = {
    'GENESIS':     'בראשית',
    'EXODUS':      'שמות',
    'LEVITICUS':   'ויקרא',
    'NUMBERS':     'במדבר',
    'DEUTERONOMY': 'דברים',
}

# Hebrew Unicode block U+0590-05FF + presentation forms U+FB1D-FB4F
HEB_RE    = re.compile(r'[֐-׿יִ-ﭏ]+')
MARKER_RE = re.compile(r':\s*>?\s*[—–\-]+\s*|[—–\-]{2,}\s*$|^\s*[—–\-]+\s*$')

# Apparatus font size: ~9.49-9.98 (vs main text 11.0, verse nums 7.34, headers 13-16)
APPARATUS_SIZE_MIN = 8.5
APPARATUS_SIZE_MAX = 10.5


def is_hebrew(text):
    return bool(HEB_RE.search(text))


def is_apparatus_size(size):
    return APPARATUS_SIZE_MIN <= size <= APPARATUS_SIZE_MAX


def clean_verse_text(text):
    # Fix ligature encoding artifacts from PDF font
    text = (text
            .replace('˚', 'fi')   # ˚ -> fi
            .replace('ˤ', 'ff')   # ˤ -> ff
            .replace('˜', 'fl')   # ˜ -> fl
            .replace('ﬁ', 'fi')   # fi ligature
            .replace('ﬂ', 'fl')   # fl ligature
            .replace('ﬃ', 'ffi')  # ffi ligature
            .replace('ﬄ', 'ffl')) # ffl ligature
    # Remove Hebrew characters
    text = HEB_RE.sub('', text)
    # Remove bracket chars
    text = re.sub(r'[\[\]{}<>]', '', text)
    # Remove section-end markers
    text = MARKER_RE.sub('', text)
    # Remove non-printable / control chars
    text = ''.join(c for c in text if unicodedata.category(c)[0] != 'C')
    text = re.sub(r'\s+', ' ', text).strip()
    # Fix ligature-split suffix: "offering s" -> "offerings"
    text = re.sub(r'(\b\w{5,}) s(\b|$)', r'\1s\2', text)
    return text


def join_linebreak_hyphens(words):
    """Remove line-break hyphens: 'some-' + 'word' -> 'someword'."""
    result = []
    i = 0
    while i < len(words):
        w = words[i]
        if (w.endswith('-') and len(w) > 1
                and i + 1 < len(words) and words[i + 1]
                and words[i + 1][0].islower()):
            result.append(w[:-1] + words[i + 1])
            i += 2
        else:
            result.append(w)
            i += 1
    return result


def group_into_lines(elements, gap=8):
    """
    Group elements (sorted y-desc) into lines.
    New line when gap from previous element's y > gap threshold.
    Within each line, sort by x ascending.
    """
    if not elements:
        return []
    elems = sorted(elements, key=lambda e: -e[1])
    groups = [[elems[0]]]
    for elem in elems[1:]:
        last_y = groups[-1][-1][1]
        if last_y - elem[1] > gap:
            groups.append([elem])
        else:
            groups[-1].append(elem)
    for g in groups:
        g.sort(key=lambda e: e[0])
    return groups


def extract_page_elements(page):
    items = []
    def visitor(text, cm, tm, font, size):
        if text.strip():
            items.append((tm[4], tm[5], round(size, 2), text))
    page.extract_text(visitor_text=visitor)
    return items


def extract_pdf():
    r = PdfReader(PDF_PATH)
    total = len(r.pages)
    print(f'PDF has {total} pages. Processing indices 86-895 (printed pages 87-896).')

    data = {}  # {book_heb: {ch_num: {v_num: text}}}

    current_book    = None
    current_chapter = None
    current_verse   = None
    verse_parts     = []

    def finalize_verse():
        if not (current_book and current_chapter and current_verse and verse_parts):
            return
        raw   = ' '.join(verse_parts)
        raw   = clean_verse_text(raw)
        words = join_linebreak_hyphens(raw.split())
        text  = ' '.join(words).strip()
        if text:
            data.setdefault(current_book, {}).setdefault(current_chapter, {})[current_verse] = text

    for pg_i in range(86, min(896, total)):
        page = r.pages[pg_i]
        all_items = extract_page_elements(page)

        # English column: x in [60, 260)
        # Exclude apparatus by font size: keep size < 8.5 (verse nums) or size >= 10.5 (main text/headers)
        eng = [it for it in all_items
               if 60 <= it[0] < 260
               and not is_apparatus_size(it[2])]
        if not eng:
            continue

        lines = group_into_lines(eng, gap=8)

        for line in lines:
            # Book name (large font, e.g. "GENESIS")
            if any(e[2] > 13 for e in line):
                for e in line:
                    key = e[3].strip().upper()
                    if key in BOOK_MAP:
                        finalize_verse()
                        current_book    = BOOK_MAP[key]
                        current_chapter = None
                        current_verse   = None
                        verse_parts     = []
                continue

            # Chapter number: single element, pure digit, centered x, reasonable range
            if (len(line) == 1
                    and line[0][3].strip().isdigit()
                    and line[0][0] > 130
                    and line[0][2] >= 10
                    and int(line[0][3].strip()) <= 60):
                finalize_verse()
                current_chapter = int(line[0][3].strip())
                current_verse   = None
                verse_parts     = []
                continue

            # Process elements in x-order (verse nums + text mixed)
            for x, y, size, text in line:
                text_s = text.strip()
                if not text_s:
                    continue

                # Skip Hebrew text
                if is_hebrew(text_s):
                    continue

                # Verse number: small superscript font
                if size < 9 and text_s.isdigit():
                    finalize_verse()
                    verse_parts   = []
                    current_verse = int(text_s)
                    continue

                # Skip standalone markers
                if text_s in (':', '—', '–', '-', ':>—', '>', '<', ':>'):
                    continue

                # Regular text
                if current_book and current_chapter and current_verse:
                    verse_parts.append(text_s)

    finalize_verse()
    return data


def update_db(data):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    book_id_map = {r['name']: r['id']
                   for r in conn.execute('SELECT id, name FROM books').fetchall()}

    updated   = 0
    not_found = 0

    for heb_book, chapters in sorted(data.items()):
        bid = book_id_map.get(heb_book)
        if bid is None:
            print(f'  WARNING: book {heb_book!r} not in DB')
            continue
        for ch_num, verses in sorted(chapters.items()):
            row = conn.execute(
                'SELECT id FROM chapters WHERE book_id=? AND number=?',
                (bid, ch_num)
            ).fetchone()
            if not row:
                print(f'  WARNING: {heb_book} ch {ch_num} not in DB')
                continue
            ch_id = row['id']
            for v_num, text in sorted(verses.items()):
                res = conn.execute(
                    'UPDATE verses SET english=? WHERE chapter_id=? AND number=?',
                    (text, ch_id, v_num)
                )
                if res.rowcount:
                    updated += 1
                else:
                    not_found += 1
                    if not_found <= 20:
                        print(f'  NOT FOUND: {heb_book} {ch_num}:{v_num}')

    conn.commit()
    conn.close()
    print(f'\nUpdated {updated} verses. Not found in DB: {not_found}.')


def main():
    print('=== Extracting English from tal_torah.pdf ===\n')
    data = extract_pdf()

    total_v = sum(len(vv) for ch in data.values() for vv in ch.values())
    print(f'\nExtracted {total_v} verses from {len(data)} books:')
    for book, chapters in sorted(data.items()):
        v_count = sum(len(vv) for vv in chapters.values())
        ch_nums = sorted(chapters.keys())
        print(f'  {book}: ch {ch_nums[0]}-{ch_nums[-1]}, {v_count} verses')

    print('\n--- Sample: Genesis 1:1-5 ---')
    gen1 = data.get(BOOK_MAP['GENESIS'], {}).get(1, {})
    for v in range(1, 6):
        print(f'  1:{v}: {gen1.get(v, "(missing)")}')

    print('\n--- Sample: Leviticus 1:1-2 ---')
    lev1 = data.get(BOOK_MAP['LEVITICUS'], {}).get(1, {})
    for v in [1, 2]:
        print(f'  Lev 1:{v}: {lev1.get(v, "(missing)")}')

    print('\n--- Sample: Deuteronomy 10:1-2 ---')
    deu10 = data.get(BOOK_MAP['DEUTERONOMY'], {}).get(10, {})
    for v in [1, 2]:
        print(f'  Deu 10:{v}: {deu10.get(v, "(missing)")}')

    print('\n=== Updating DB ===\n')
    update_db(data)
    print('\nDone.')


if __name__ == '__main__':
    main()
