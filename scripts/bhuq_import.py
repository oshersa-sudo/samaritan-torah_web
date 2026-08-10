# -*- coding: utf-8 -*-
"""
Create and fill the "פירוש אם בחקותי" source - the commentary of Abū l-Faraj
ibn al-Kathār on parashat אם בחקתי, in Dr. Ali Watad's Hebrew translation.

Input is a JSONL of reworked sections (data/bhuq_sections.jsonl), one per line:
    {"ord": 1, "page": 62, "ref": "{55}", "title": "…", "text": "…"}

`text` is our own restatement, never the translator's wording: the edition is a
copyrighted scholarly work, so sections are paraphrased - the ideas, the
attributions and the scriptural references are preserved, the phrasing is not.

Each section is then linked to the verses it actually concerns, using the
generic linker in link_source_to_verses.py: explicit citations like "(ויקי כו 12)"
and quoted scripture matched blind to מלא/חסר spelling.

Usage:
  py -3 scripts/bhuq_import.py --schema           # create the two tables
  py -3 scripts/bhuq_import.py --load [--apply]   # load + link (dry-run default)
  py -3 scripts/bhuq_import.py --stats
"""
import os
import io
import sys
import json
import sqlite3
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from link_source_to_verses import VerseIndex, find_links

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_ROOT, 'data', 'torah.db')
JSONL = os.path.join(_ROOT, 'data', 'bhuq_sections.jsonl')

SCHEMA = '''
CREATE TABLE IF NOT EXISTS bhuq_sections (
  id     INTEGER PRIMARY KEY,
  ord    INTEGER,          -- reading order within the commentary
  page   INTEGER,          -- printed page in the Watad edition
  ref    TEXT,             -- the {NN} manuscript paragraph mark, when present
  title  TEXT,             -- short heading we give the passage
  text   TEXT NOT NULL     -- our reworked restatement, not the translator's wording
);
CREATE TABLE IF NOT EXISTS bhuq_verse_links (
  section_id INTEGER NOT NULL,
  verse_id   INTEGER NOT NULL,
  method     TEXT,          -- 'ref' (explicit citation) | 'quote' (quoted scripture)
  shown      TEXT,          -- what produced the link, for review
  PRIMARY KEY (section_id, verse_id, method)
);
CREATE INDEX IF NOT EXISTS ix_bhuq_links_verse ON bhuq_verse_links(verse_id);
'''


def cmd_schema():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.commit()
    cols = lambda t: [r[1] for r in conn.execute('PRAGMA table_info(%s)' % t)]
    print('bhuq_sections   :', cols('bhuq_sections'))
    print('bhuq_verse_links:', cols('bhuq_verse_links'))
    conn.close()


def cmd_load(apply_it):
    if not os.path.exists(JSONL):
        sys.exit('missing %s - transcribe the pages into it first' % JSONL)
    secs = [json.loads(l) for l in io.open(JSONL, encoding='utf-8') if l.strip()]
    print('sections in file: %d' % len(secs))

    idx = VerseIndex(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    linked = unlinked = nlinks = 0
    per_book = {}
    book_of = dict(cur.execute('''SELECT v.id, c.book_id FROM verses v
                                  JOIN chapters c ON c.id=v.chapter_id''').fetchall())
    names = dict(cur.execute('SELECT id, name FROM books').fetchall())

    if apply_it:
        cur.execute('DELETE FROM bhuq_verse_links')
        cur.execute('DELETE FROM bhuq_sections')

    for i, s in enumerate(secs, 1):
        found = find_links(s['text'], idx)
        rows = found['refs'] + found['quotes']
        if rows:
            linked += 1
        else:
            unlinked += 1
        nlinks += len(rows)
        for vid, _m, _sh in rows:
            b = book_of.get(vid)
            per_book[b] = per_book.get(b, 0) + 1
        if apply_it:
            cur.execute('INSERT INTO bhuq_sections (id, ord, page, ref, title, text) '
                        'VALUES (?,?,?,?,?,?)',
                        (i, s.get('ord', i), s.get('page'), s.get('ref', ''),
                         s.get('title', ''), s['text']))
            for vid, method, shown in rows:
                cur.execute('INSERT OR IGNORE INTO bhuq_verse_links '
                            '(section_id, verse_id, method, shown) VALUES (?,?,?,?)',
                            (i, vid, method, shown))

    if apply_it:
        conn.commit()
    print('  sections that found at least one verse : %d' % linked)
    print('  sections with no location at all       : %d' % unlinked)
    print('  verse links total                      : %d' % nlinks)
    print('  spread over books:')
    for b, n in sorted(per_book.items()):
        print('     %-8s %4d' % (names.get(b, '?'), n))
    print('APPLIED' if apply_it else 'DRY RUN - re-run with --apply to write')
    conn.close()


def cmd_stats():
    conn = sqlite3.connect(DB_PATH)
    try:
        ns = conn.execute('SELECT COUNT(*) FROM bhuq_sections').fetchone()[0]
        nl = conn.execute('SELECT COUNT(*) FROM bhuq_verse_links').fetchone()[0]
        nv = conn.execute('SELECT COUNT(DISTINCT verse_id) FROM bhuq_verse_links').fetchone()[0]
    except sqlite3.OperationalError:
        sys.exit('tables not created yet - run --schema')
    print('sections %d | links %d | distinct verses reached %d' % (ns, nl, nv))
    for bn, n in conn.execute('''SELECT b.name, COUNT(DISTINCT l.verse_id)
                                 FROM bhuq_verse_links l JOIN verses v ON v.id=l.verse_id
                                 JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id
                                 GROUP BY b.id ORDER BY b.id'''):
        print('   %-8s %4d' % (bn, n))
    conn.close()


if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--schema', action='store_true')
    ap.add_argument('--load', action='store_true')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--stats', action='store_true')
    a = ap.parse_args()
    if a.schema:
        cmd_schema()
    elif a.load:
        cmd_load(a.apply)
    elif a.stats:
        cmd_stats()
    else:
        ap.print_help()
