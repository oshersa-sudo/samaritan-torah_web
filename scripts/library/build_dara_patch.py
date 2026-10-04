# -*- coding: utf-8 -*-
"""Build the boot patch that carries the liturgy unit's data to the live site.

"פיוטי השומרונים בתעתיק הגייה" — Z. Ben-Ḥayyim's liturgy volume, each piyyut line
by line in three columns: the Samaritan Aramaic, his Hebrew rendering, and his
phonetic transcription. Five tables, all of them written by nothing but this
patch, so they travel the same way the two translated studies did: applied in
place at boot, never by replacing the live database file.

Usage:  py -3 scripts/library/build_dara_patch.py
"""
import hashlib, io, json, os, sqlite3, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB = os.path.join(ROOT, 'data', 'torah.db')
OUT = os.path.join(ROOT, 'data', 'dara_unit_patch.json')

# column order is fixed here so the fingerprint means the same thing on both sides
TABLES = [
    ('dara_piyutim',   ['id', 'author', 'sec', 'title', 'ord', 'sources', 'usage', 'pages', 'n_lines']),
    ('dara_lines',     ['piyut_id', 'ord', 'n', 'aram', 'heb', 'translit', 'page']),
    ('dara_vars',      ['piyut_id', 'n', 'text']),
    ('dara_words',     ['word', 'word_norm', 'freq', 'translit', 'root', 'gloss', 'gloss_src', 'word_fin']),
    ('dara_word_refs', ['word', 'piyut_id', 'line_ord', 'pos']),
]

def main():
    conn = sqlite3.connect('file:%s?mode=ro' % DB.replace('\\', '/'), uri=True)
    tables = []
    for name, cols in TABLES:
        sql = conn.execute("SELECT sql FROM sqlite_master WHERE name=?", (name,)).fetchone()[0]
        # the indexes travel with the table: without them the dictionary's joins
        # over 16k references crawl
        idx = [r[0] for r in conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL",
            (name,))]
        rows = [list(r) for r in conn.execute(
            'SELECT %s FROM %s ORDER BY %s' % (', '.join(cols), name, ', '.join(cols[:2])))]
        fp = hashlib.sha1(json.dumps(rows, ensure_ascii=False).encode('utf-8')).hexdigest()
        tables.append({'table': name, 'cols': cols, 'create': sql, 'indexes': idx,
                       'fingerprint': fp, 'rows': rows})
        print('  %-16s %6d rows  %d אינדקסים  %s' % (name, len(rows), len(idx), fp[:12]))
    conn.close()
    io.open(OUT, 'w', encoding='utf-8').write(json.dumps({'tables': tables}, ensure_ascii=False))
    print('  %-16s %7.0f KB' % (os.path.basename(OUT), os.path.getsize(OUT) / 1024))

if __name__ == '__main__':
    main()
