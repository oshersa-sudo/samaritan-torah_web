"""
Import scraped data from data/samaritan_site.json into the DB.
Adds 4 columns to verses: sam_hebrew, sam_aramaic, simple_hebrew, site_english
"""
import sqlite3, json, sys, os
sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH   = os.path.join(DATA_DIR, 'torah.db')
JSON_PATH = os.path.join(DATA_DIR, 'samaritan_site.json')

BOOK_SLUGS = {
    'בראשית':  'genesis',
    'שמות':    'exodus',
    'ויקרא':   'leviticus',
    'במדבר':   'numbers',
    'דברים':   'deuteronomy',
}

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

# Add columns if they don't exist
existing = [r[1] for r in conn.execute('PRAGMA table_info(verses)').fetchall()]
for col in ('sam_hebrew', 'sam_aramaic', 'simple_hebrew', 'site_english'):
    if col not in existing:
        conn.execute(f'ALTER TABLE verses ADD COLUMN {col} TEXT')
        print(f'Added column: {col}')

conn.commit()

# Load scraped JSON
with open(JSON_PATH, encoding='utf-8') as f:
    site_data = json.load(f)

# Build lookup: (book_slug, chapter_num, verse_num) -> verse_id
rows = conn.execute(
    'SELECT v.id, v.number, c.number as ch_num, b.name as book_name '
    'FROM verses v '
    'JOIN chapters c ON v.chapter_id = c.id '
    'JOIN books b ON c.book_id = b.id'
).fetchall()

lookup = {}
for r in rows:
    slug = BOOK_SLUGS.get(r['book_name'])
    if slug:
        lookup[(slug, r['ch_num'], r['number'])] = r['id']

updated = 0
missing = 0

for slug, book_data in site_data.items():
    for ch_str, verses in book_data['chapters'].items():
        ch_num = int(ch_str)
        for v_str, v_data in verses.items():
            try:
                v_num = int(v_str)
            except ValueError:
                missing += 1
                continue
            vid = lookup.get((slug, ch_num, v_num))
            if vid is None:
                missing += 1
                continue
            conn.execute(
                'UPDATE verses SET sam_hebrew=?, sam_aramaic=?, simple_hebrew=?, site_english=? WHERE id=?',
                (
                    v_data.get('hebrew', ''),
                    v_data.get('aramaic', ''),
                    v_data.get('simple_hebrew', ''),
                    v_data.get('english', ''),
                    vid,
                )
            )
            updated += 1

conn.commit()
conn.close()
print(f'Done. Updated: {updated}, not matched: {missing}')
