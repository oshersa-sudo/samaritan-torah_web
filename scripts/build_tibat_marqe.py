"""
Load the extracted Tibåt Mårqe data into torah.db.

Creates two tables:
    tm_sections(id, book, section, book_title, sort_key, aramaic, english, hebrew)
    tm_verse_links(id, verse_id, section_id)   -- many-to-many verse <-> section

Reads:
    data/tibat_marqe_sections.json
    data/tibat_marqe_index.json   (Jewish-division Gen..Deut -> Book/§)

Idempotent: drops and recreates the two tables on every run, but preserves any
existing Hebrew translations (tm_sections.hebrew) by reloading them first.

Run:  py -3 scripts/build_tibat_marqe.py
"""
import os
import re
import json
import shutil
import sqlite3
import datetime

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
DB   = os.path.join(DATA, 'torah.db')

BOOK_ORDER = ['I', 'II', 'III', 'IV', 'V', 'VI']
BOOK_NUM = {b: i + 1 for i, b in enumerate(BOOK_ORDER)}
ENG_BOOK_ORDER = {'Genesis': 1, 'Exodus': 2, 'Leviticus': 3,
                  'Numbers': 4, 'Deuteronomy': 5}


def section_sort_key(book, section):
    """Monotonic integer so sections sort I.1 < I.1a < I.2 < ... < VI.71."""
    m = re.match(r'(\d+)([ab]?)', section)
    n = int(m.group(1))
    suf = {'': 1, 'a': 2, 'b': 3}[m.group(2)]   # plain before a/b appendix marks
    return BOOK_NUM[book] * 1_000_000 + n * 10 + suf


def main():
    payload = json.load(open(os.path.join(DATA, 'tibat_marqe_sections.json'), encoding='utf-8'))
    titles   = payload['titles']
    sections = payload['sections']
    index    = json.load(open(os.path.join(DATA, 'tibat_marqe_index.json'), encoding='utf-8'))

    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy(DB, DB + '.tmbak_' + ts)

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    # preserve any existing Hebrew translations across rebuilds
    prev_he = {}
    if conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tm_sections'").fetchone():
        for r in conn.execute("SELECT book, section, hebrew FROM tm_sections WHERE hebrew IS NOT NULL AND hebrew!=''"):
            prev_he[(r['book'], r['section'])] = r['hebrew']

    conn.executescript("""
        DROP TABLE IF EXISTS tm_verse_links;
        DROP TABLE IF EXISTS tm_sections;
        CREATE TABLE tm_sections (
            id         INTEGER PRIMARY KEY,
            book       TEXT NOT NULL,          -- 'I'..'VI'
            section    TEXT NOT NULL,          -- '1','1a','47'...
            book_title TEXT,                   -- Hebrew memar title
            sort_key   INTEGER NOT NULL,
            aramaic    TEXT,
            english    TEXT,
            hebrew     TEXT,
            UNIQUE(book, section)
        );
        CREATE TABLE tm_verse_links (
            id         INTEGER PRIMARY KEY,
            verse_id   INTEGER NOT NULL REFERENCES verses(id),
            section_id INTEGER NOT NULL REFERENCES tm_sections(id),
            UNIQUE(verse_id, section_id)
        );
        CREATE INDEX idx_tm_links_verse ON tm_verse_links(verse_id);
    """)

    # insert sections
    sec_id = {}
    for book in BOOK_ORDER:
        for section, texts in sections.get(book, {}).items():
            cur = conn.execute(
                "INSERT INTO tm_sections (book, section, book_title, sort_key, aramaic, english, hebrew) "
                "VALUES (?,?,?,?,?,?,?)",
                (book, section, titles.get(book), section_sort_key(book, section),
                 texts.get('aramaic') or None, texts.get('english') or None,
                 prev_he.get((book, section))))
            sec_id[(book, section)] = cur.lastrowid

    # verse lookup: (book_order, chapter, verse) -> verse_id
    vlookup = {}
    for r in conn.execute("""
            SELECT v.id AS vid, b.order_n AS bo, c.number AS ch, v.number AS vn
            FROM verses v JOIN chapters c ON c.id=v.chapter_id
            JOIN books b ON b.id=c.book_id"""):
        vlookup[(r['bo'], r['ch'], r['vn'])] = r['vid']

    # resolve links
    links = set()
    unresolved_secs = set()
    unresolved_verses = 0
    for entry in index:
        bo = ENG_BOOK_ORDER[entry['book']]
        # collect target section ids for this entry
        sids = []
        for rom, secs in entry['refs']:
            for s in secs:
                sid = sec_id.get((rom, s))
                if sid:
                    sids.append(sid)
                else:
                    unresolved_secs.add((rom, s))
        if not sids:
            continue
        for ch, vn in entry['verses']:
            if not isinstance(ch, int) or not isinstance(vn, int):
                continue
            vid = vlookup.get((bo, ch, vn))
            if vid is None:
                unresolved_verses += 1
                continue
            for sid in sids:
                links.add((vid, sid))

    conn.executemany("INSERT OR IGNORE INTO tm_verse_links (verse_id, section_id) VALUES (?,?)",
                     sorted(links))
    conn.commit()

    n_sec = conn.execute("SELECT count(*) FROM tm_sections").fetchone()[0]
    n_he  = conn.execute("SELECT count(*) FROM tm_sections WHERE hebrew IS NOT NULL AND hebrew!=''").fetchone()[0]
    n_link = conn.execute("SELECT count(*) FROM tm_verse_links").fetchone()[0]
    n_vlinked = conn.execute("SELECT count(DISTINCT verse_id) FROM tm_verse_links").fetchone()[0]
    conn.close()

    print(f'sections inserted : {n_sec} (hebrew already present: {n_he})')
    print(f'verse links       : {n_link} across {n_vlinked} distinct verses')
    print(f'unresolved verses : {unresolved_verses} (missing in torah.db)')
    print(f'unresolved sections (referenced but not extracted): {sorted(unresolved_secs)}')


if __name__ == '__main__':
    main()
