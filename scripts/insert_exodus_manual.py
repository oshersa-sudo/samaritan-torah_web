# -*- coding: utf-8 -*-
"""
Insert the manually-approved small Samaritan additions into Exodus, one item at a
time (the 4 in-verse passages the automatic pass left out). Each addition is taken
verbatim from data/שמות.txt, cleaned the same way as the rest of the book, split
into verses on the period mark, and numbered after its anchor verse with a maqaf
(e.g. 25-1, 25-2 …). After inserting, the Exodus Samaritan division is re-derived.
Only INSERTs; existing verses are never modified. Backup data/torah.db.bak_exo2.

Usage:  py -3 scripts/insert_exodus_manual.py <ITEM> [--apply]
        ITEM = 18_25 | 23_19 | 32_10 | 39_21
"""
import sys, io, os, re, shutil, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
ITEM = next((a for a in sys.argv[1:] if a != '--apply'), None)
DB = 'data/torah.db'
LET = re.compile('[א-ת]')
FIN = {'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ'}
ENDANCHOR = re.compile(r'׃[-–—]+\s*$')


def lets(t): return ''.join(LET.findall(t or ''))


def clean(t):
    t = re.sub(r'\[+[^\[\]]*\]+', '', t)
    t = re.sub(r'<+[^<>]*>+', '', t)
    t = t.replace('{', '').replace('}', '').replace('(', '').replace(')', '')
    t = re.sub(r'[כמנפצ](?![א-ת])', lambda m: FIN[m.group(0)], t)
    t = re.sub(r'\.\s*([:׃])', r'\1', t)
    t = re.sub(r'([:׃])\s*\.', r'\1', t)
    return re.sub(r'\s{2,}', ' ', t).strip()


def txt_verse(cn, vn):
    raw = re.sub(r'[‎‏‪-‮]', '', io.open('data/שמות.txt', encoding='utf-8').read())
    seg = re.search(r'Exodus %d:(.*?)(?=Exodus \d+:|\Z)' % cn, raw, re.S).group(1)
    verses = {}; cur, buf = 1, []
    for tk in seg.split():
        if tk.isdigit():
            verses[cur] = ' '.join(buf); buf = []; cur = int(tk)
        else:
            buf.append(tk)
    verses[cur] = ' '.join(buf)
    return verses.get(vn, '')


def split_periods(text):
    return [p.strip() for p in re.split(r'(?<=\.)\s+', text) if p.strip()]


def build_item(item):
    """-> (chapter, anchor_vn, [verse_texts]).  The text is the WHOLE Samaritan
    verse (the approved 'add after existing' content)."""
    if item == '18_25':
        return 18, 25, [clean(p) for p in split_periods(txt_verse(18, 25))]
    raise SystemExit('item not configured yet: %s' % item)


def rederive(conn, bid):
    def keyf(n):
        s = str(n)
        if '-' in s:
            a, b = s.split('-', 1); return (int(a), int(b))
        return (int(s), 0)
    rows = sorted(conn.execute(
        '''SELECT v.id, ch.number cn, v.number vn, v.text FROM verses v
           JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=?''', (bid,)).fetchall(),
        key=lambda r: (r['cn'], keyf(r['vn'])))
    cur = conn.cursor()
    cur.execute('DELETE FROM sam_chapters WHERE book_id=?', (bid,))
    sam, samids, assign = 1, {}, []
    for r in rows:
        if sam not in samids:
            cur.execute('INSERT INTO sam_chapters (book_id, number) VALUES (?,?)', (bid, sam))
            samids[sam] = cur.lastrowid
        assign.append((samids[sam], r['id']))
        if ENDANCHOR.search(r['text'] or ''):
            sam += 1
    cur.executemany('UPDATE verses SET sam_ch_id=? WHERE id=?', assign)


def main():
    cn, an, pieces = build_item(ITEM)
    conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row
    bid = conn.execute('SELECT id FROM books WHERE name=?', ('שמות',)).fetchone()['id']
    cid = conn.execute('SELECT id FROM chapters WHERE book_id=? AND number=?', (bid, cn)).fetchone()['id']
    print('=== item %s: insert after שמות %d:%d ===' % (ITEM, cn, an))
    for i, p in enumerate(pieces, 1):
        print('  %d-%d  %s' % (an, i, p))
    if not APPLY:
        print('\n[dry-run] add --apply to insert.'); conn.close(); return
    bak = DB + '.bak_exo2'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak); print('backed up ->', bak)
    cur = conn.cursor()
    for i, p in enumerate(pieces, 1):
        cur.execute('INSERT INTO verses (chapter_id, number, text) VALUES (?,?,?)',
                    (cid, '%d-%d' % (an, i), p))
    conn.commit()
    rederive(conn, bid)
    conn.commit()
    print('APPLIED: inserted %d verses.' % len(pieces))
    conn.close()


if __name__ == '__main__':
    main()
