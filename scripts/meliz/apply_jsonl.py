"""Load hand-extracted HaMeliṣ entries (JSONL) into meliz_gloss.

Each JSONL line is one glossary sub-row:
  {"book":"בר'", "chap":"מט", "verse":27, "lemma":"זאב",
   "hebrew":"זאב", "arabic":"ذئب", "src":"meliz1 p1 l316", "note":""}

- book:  Hebrew abbreviation (בר'/שמ'/ויק'/במ'/דב') OR an int order_n 1..5
- chap:  Hebrew numeral (מט, כא, …) OR an int
- verse: int (the Torah verse; strip any '+' before writing)
- lemma: Hebrew headword used to MATCH the verse word (fold-matched downstream)
- hebrew/arabic: the HaMeliṣ Hebrew gloss and Arabic gloss to DISPLAY
- src:   provenance (part+page+line) — also the idempotency key

Idempotent: re-running replaces rows with the same src. Run:
  py -3 scripts/meliz/apply_jsonl.py data/meliz/<file>.jsonl
"""
import json
import os
import re
import sqlite3
import sys

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')

BOOK = {'בר': 1, 'שמ': 2, 'שמות': 2, 'ויק': 3, 'ויקרא': 3,
        'במ': 4, 'במד': 4, 'במדבר': 4, 'דב': 5, 'דבר': 5, 'דברים': 5, 'בראשית': 1}
_HEB_VAL = {'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
            'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
            'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100, 'ר': 200,
            'ש': 300, 'ת': 400}


def book_order(b):
    if isinstance(b, int):
        return b
    s = str(b).strip().strip("'׳’.").strip()
    if s.isdigit():
        return int(s)
    return BOOK.get(s)


def heb_num(x):
    if isinstance(x, int):
        return x
    s = str(x).strip()
    if s.isdigit():
        return int(s)
    s = re.sub("[\"'׳״’]", '', s)
    if not s or any(c not in _HEB_VAL for c in s):
        return None
    return sum(_HEB_VAL[c] for c in s)


def main(path):
    conn = sqlite3.connect(DB)
    conn.execute('''CREATE TABLE IF NOT EXISTS meliz_gloss(
        id INTEGER PRIMARY KEY, book INTEGER, chap INTEGER, verse INTEGER,
        lemma TEXT, hebrew TEXT, arabic TEXT, note TEXT, src TEXT)''')
    conn.execute('CREATE INDEX IF NOT EXISTS ix_meliz_bcv ON meliz_gloss(book,chap,verse)')
    ok = bad = 0
    bad_lines = []
    rows = []
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        r = json.loads(line)
        bo = book_order(r.get('book'))
        ch = heb_num(r.get('chap'))
        vs = r.get('verse')
        vs = int(re.sub(r'[^0-9]', '', str(vs))) if vs not in (None, '') else None
        lemma = (r.get('lemma') or '').strip()
        if not (bo and ch and vs and lemma):
            bad += 1
            bad_lines.append((ln, r))
            continue
        rows.append((bo, ch, vs, lemma, (r.get('hebrew') or '').strip(),
                     (r.get('arabic') or '').strip(), (r.get('note') or '').strip(),
                     (r.get('src') or '').strip()))
        ok += 1
    srcs = {s for *_, s in rows if s}
    for s in srcs:
        conn.execute('DELETE FROM meliz_gloss WHERE src=?', (s,))
    conn.executemany('''INSERT INTO meliz_gloss(book,chap,verse,lemma,hebrew,arabic,note,src)
                        VALUES(?,?,?,?,?,?,?,?)''', rows)
    conn.commit()
    total = conn.execute('SELECT count(*) FROM meliz_gloss').fetchone()[0]
    conn.close()
    print('applied %d rows (%d bad) from %s ; meliz_gloss now has %d'
          % (ok, bad, os.path.basename(path), total))
    for ln, r in bad_lines[:20]:
        print('  BAD line %d: %s' % (ln, r))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'data/meliz/entries.jsonl')
