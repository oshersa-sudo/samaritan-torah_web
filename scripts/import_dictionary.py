"""
Creates verse_dictionary table and imports dictionary_words per verse from samaritan_site.json.
"""
import sqlite3, json, sys, os
sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR  = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH   = os.path.join(DATA_DIR, 'torah.db')
JSON_PATH = os.path.join(DATA_DIR, 'samaritan_site.json')

BOOK_SLUGS = {
    'בראשית': 'genesis', 'שמות': 'exodus', 'ויקרא': 'leviticus',
    'במדבר': 'numbers',  'דברים': 'deuteronomy',
}

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

# Create table
conn.execute('''
    CREATE TABLE IF NOT EXISTS verse_dictionary (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        verse_id INTEGER NOT NULL,
        aramaic  TEXT NOT NULL,
        hebrew   TEXT,
        FOREIGN KEY (verse_id) REFERENCES verses(id)
    )
''')
conn.execute('CREATE INDEX IF NOT EXISTS idx_vdict_verse ON verse_dictionary(verse_id)')
conn.commit()
print('Table ready.')

# Build lookup: (slug, ch_num, v_num) -> verse_id
rows = conn.execute(
    'SELECT v.id, v.number, c.number as ch_num, b.name as book_name '
    'FROM verses v JOIN chapters c ON v.chapter_id=c.id JOIN books b ON c.book_id=b.id'
).fetchall()
lookup = {}
for r in rows:
    slug = BOOK_SLUGS.get(r['book_name'])
    if slug:
        lookup[(slug, r['ch_num'], r['number'])] = r['id']

with open(JSON_PATH, encoding='utf-8') as f:
    data = json.load(f)

# Clear existing data
conn.execute('DELETE FROM verse_dictionary')
conn.commit()

inserted = 0
for slug, book_data in data.items():
    for ch_str, verses in book_data['chapters'].items():
        ch_num = int(ch_str)
        for v_str, v_data in verses.items():
            try:
                v_num = int(v_str)
            except ValueError:
                continue
            vid = lookup.get((slug, ch_num, v_num))
            if vid is None:
                continue
            words = v_data.get('dictionary_words', [])
            for entry in words:
                aram = (entry.get('aramaic') or '').strip()
                heb  = (entry.get('hebrew')  or '').strip()
                if aram:
                    conn.execute(
                        'INSERT INTO verse_dictionary (verse_id, aramaic, hebrew) VALUES (?,?,?)',
                        (vid, aram, heb)
                    )
                    inserted += 1

conn.commit()
conn.close()
print(f'Done. Inserted {inserted} dictionary entries.')
