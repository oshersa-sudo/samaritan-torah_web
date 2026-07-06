"""Download the full Targum Onkelos (Aramaic) from Sefaria's free API and align it,
verse-by-verse, onto verses.onkelos_text by the Jewish (Masoretic) division.

Adds the column if missing. Per-chapter JSON is cached under data/onkelos/cache/ so a
re-run is free/offline. Alignment key = (book order_n, chapters.number, Masoretic verse
number = mas_number when set else number). Verses with no Onkelos counterpart stay NULL
(the UI shows a dashed cell). Run:  py -3 scripts/onkelos/download.py
"""
import json
import os
import re
import sqlite3
import time
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DB = os.path.join(ROOT, 'data', 'torah.db')
CACHE = os.path.join(ROOT, 'data', 'onkelos', 'cache')
BOOKS = [(1, 'Onkelos_Genesis', 50), (2, 'Onkelos_Exodus', 40),
         (3, 'Onkelos_Leviticus', 27), (4, 'Onkelos_Numbers', 36),
         (5, 'Onkelos_Deuteronomy', 34)]
_TAG = re.compile(r'<[^>]+>')
_FOOT = re.compile(r'\{[^}]*\}')          # Sefaria footnote braces


def clean(s):
    s = _TAG.sub('', s or '')
    s = _FOOT.sub('', s)
    return re.sub(r'\s+', ' ', s).strip()


def fetch_chapter(name, ch):
    os.makedirs(CACHE, exist_ok=True)
    cf = os.path.join(CACHE, '%s_%d.json' % (name, ch))
    if os.path.exists(cf):
        return json.load(open(cf, encoding='utf-8'))
    url = 'https://www.sefaria.org/api/texts/%s.%d?context=0&commentary=0' % (name, ch)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    d = json.load(urllib.request.urlopen(req, timeout=30))
    he = d.get('he') or []
    json.dump(he, open(cf, 'w', encoding='utf-8'), ensure_ascii=False)
    time.sleep(0.15)
    return he


def main():
    conn = sqlite3.connect(DB)
    cols = [r[1] for r in conn.execute('PRAGMA table_info(verses)')]
    if 'onkelos_text' not in cols:
        conn.execute('ALTER TABLE verses ADD COLUMN onkelos_text TEXT')
        conn.commit()
        print('added verses.onkelos_text')
    # (order_n, jchapter, masverse) -> onkelos aramaic
    onk = {}
    for order_n, name, maxch in BOOKS:
        got = 0
        for ch in range(1, maxch + 1):
            try:
                he = fetch_chapter(name, ch)
            except Exception as e:
                print('  !! %s ch%d: %s' % (name, ch, e)); continue
            for i, v in enumerate(he, 1):
                txt = clean(v)
                if txt:
                    onk[(order_n, ch, i)] = txt; got += 1
        print('%s: %d verses' % (name, got))
    # resolve to verse_id by Masoretic position
    rows = conn.execute('''SELECT v.id, b.order_n, c.number jch, v.number num, v.mas_number masn
        FROM verses v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id''').fetchall()
    applied = miss = 0
    for vid, order_n, jch, num, masn in rows:
        def _leadnum(x):                       # leading integer of "18" / "18-1" / None
            m = re.match(r'\s*(\d+)', str(x)) if x is not None else None
            return int(m.group(1)) if m else None
        mv = _leadnum(masn) if (masn and str(masn).strip()) else _leadnum(num)
        txt = onk.get((order_n, jch, mv)) if mv else None
        if txt:
            conn.execute('UPDATE verses SET onkelos_text=? WHERE id=?', (txt, vid)); applied += 1
        else:
            miss += 1
    conn.commit()
    tot = conn.execute("SELECT count(*) FROM verses WHERE onkelos_text IS NOT NULL AND trim(onkelos_text)<>''").fetchone()[0]
    conn.close()
    print('aligned %d verses (%d had no Onkelos match); onkelos_text now on %d verses'
          % (applied, miss, tot))


if __name__ == '__main__':
    main()
