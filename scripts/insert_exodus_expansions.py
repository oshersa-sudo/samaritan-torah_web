# -*- coding: utf-8 -*-
"""
Insert the missing Samaritan expansion passages into Exodus (שמות) in
data/torah.db, from data/שמות.txt — verbatim, nothing else changed.

How the source is read (verified against the raw file):
  * Each Jewish chapter is raw-parsed into numbered verses.
  * A verse's raw text = [the verse's own content] ׃-- [expansion] ׃-- ...
    i.e. splitting a verse's raw text on the Samaritan chapter mark ׃-- yields
    the original verse (part 0, confirmed == the DB verse) followed by any
    expansion Samaritan-chapters the DB lacks.
  * Each expansion chapter is split into VERSES on the period . (the in-chapter
    verse mark); the last verse of a chapter keeps its ׃--.

Each inserted verse is numbered like the preceding existing verse with a maqaf:
18-1, 18-2, … (stored as TEXT, shown only in the Samaritan division). The same
bracket / final-letter / pause-dot cleaning used elsewhere is applied so the
inserted text matches the rest of the DB. After insertion the Exodus Samaritan
division (sam_chapters + sam_ch_id) is re-derived in reading order. Full backup.

Usage:  py -3 scripts/insert_exodus_expansions.py            # dry run
        py -3 scripts/insert_exodus_expansions.py --apply
"""
import sys, io, os, re, shutil, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DB = 'data/torah.db'
TXT = 'data/שמות.txt'
BOOK = 'שמות'
LET = re.compile('[א-ת]')
FIN = {'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ'}
END = re.compile(r'׃[-–—]+')


def lets(t):
    return ''.join(LET.findall(t or ''))


def clean(t):
    """Same cleaning rules applied to the rest of Exodus."""
    t = re.sub(r'\[+[^\[\]]*\]+', '', t)         # [] / [[]] : bracket + content
    t = re.sub(r'<+[^<>]*>+', '', t)             # <> : bracket + content
    t = t.replace('{', '').replace('}', '').replace('(', '').replace(')', '')
    t = re.sub(r'[כמנפצ](?![א-ת])', lambda m: FIN[m.group(0)], t)  # final letters
    t = re.sub(r'\.\s*([:׃])', r'\1', t)         # pause-dot touching a stop
    t = re.sub(r'([:׃])\s*\.', r'\1', t)
    t = re.sub(r'\s{2,}', ' ', t).strip()
    return t


def raw_chapters():
    raw = io.open(TXT, encoding='utf-8').read()
    raw = re.sub(r'[‎‏‪-‮]', '', raw)   # strip bidi marks
    out = {}
    for m in re.finditer(r'Exodus (\d+):(.*?)(?=Exodus \d+:|\Z)', raw, re.S):
        cn = int(m.group(1))
        toks = m.group(2).split()
        verses = {}
        cur, buf = 1, []
        for tk in toks:
            if tk.isdigit():
                verses[cur] = ' '.join(buf); buf = []; cur = int(tk)
            else:
                buf.append(tk)
        verses[cur] = ' '.join(buf)
        out[cn] = verses
    return out


def split_verses(expansion):
    """An expansion Samaritan-chapter -> its verses, split on the period mark,
    keeping the period; the final piece carries the chapter-ending ׃--."""
    body = END.sub('', expansion).strip()
    parts = re.split(r'(?<=\.)\s+', body)
    parts = [p.strip() for p in parts if p.strip()]
    if parts:
        parts[-1] = parts[-1].rstrip('. ') + ' ׃--'
    return parts


def main():
    conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row
    bid = conn.execute('SELECT id FROM books WHERE name=?', (BOOK,)).fetchone()['id']
    chmap = {r['number']: r['id'] for r in conn.execute(
        'SELECT id, number FROM chapters WHERE book_id=?', (bid,))}
    db = {}
    for r in conn.execute(
            '''SELECT ch.number cn, v.number vn, v.text t FROM verses v
               JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=?''', (bid,)):
        db[(r['cn'], r['vn'])] = r['t']

    txt = raw_chapters()
    inserts = []      # (chapter_id, cn, base_vn, sub, text, ends_chapter)
    mism = []
    for cn in sorted(txt):
        for vn, rawtext in sorted(txt[cn].items()):
            if '׃-' not in rawtext and '׃–' not in rawtext:
                pass
            pieces = END.split(rawtext)
            # rebuild: piece0 is the verse's own content; the rest (non-empty) are expansions
            if len(pieces) <= 1:
                continue
            base = pieces[0]
            dbt = db.get((cn, vn))
            if dbt is None:
                continue
            if lets(base) and lets(base) not in lets(dbt) and lets(dbt) not in lets(base):
                # part0 doesn't correspond to the DB verse -> don't touch, surface it
                if lets(base) != lets(dbt):
                    mism.append((cn, vn, base[:40], (dbt or '')[:40]))
            sub = 0
            for ex in pieces[1:]:
                if not ex.strip():
                    continue
                for k, vtext in enumerate(split_verses(ex)):
                    ct = clean(vtext)
                    if not lets(ct):
                        continue
                    sub += 1
                    ends = ct.rstrip().endswith('׃--') and (k == len(split_verses(ex)) - 1)
                    inserts.append((chmap[cn], cn, vn, sub, ct))

    # report
    print('=== planned inserted verses (Samaritan-only) ===')
    last = None
    for cid, cn, vn, sub, text in inserts:
        if (cn, vn) != last:
            print('  ── after %s %d:%d ──' % (BOOK, cn, vn)); last = (cn, vn)
        print('     %d-%d  %s' % (vn, sub, text[:88] + ('…' if len(text) > 88 else '')))
    from collections import Counter
    byv = Counter((cn, vn) for cid, cn, vn, sub, text in inserts)
    print('\ninserted verses: %d   across %d locations   chapters: %s'
          % (len(inserts), len(byv), sorted({cn for _, cn, _, _, _ in inserts})))
    if mism:
        print('\n[!] verses where part0 != DB (NOT inserted, review): %d' % len(mism))
        for cn, vn, a, b in mism[:20]:
            print('   %d:%d  txt0=%s | db=%s' % (cn, vn, a, b))

    if not APPLY:
        print('\n[dry-run] re-run with --apply to insert + re-derive sam division.')
        conn.close(); return

    bak = DB + '.bak_exoins'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak); print('backed up ->', bak)
    cur = conn.cursor()
    for cid, cn, vn, sub, text in inserts:
        cur.execute('INSERT INTO verses (chapter_id, number, text) VALUES (?,?,?)',
                    (cid, '%d-%d' % (vn, sub), text))
    conn.commit()

    # re-derive Exodus Samaritan division in reading order (N then N-1,N-2…)
    def keyf(numstr):
        s = str(numstr)
        if '-' in s:
            a, b = s.split('-', 1)
            return (int(a), int(b))
        return (int(s), 0)
    rows = conn.execute(
        '''SELECT v.id, ch.number cn, v.number vn, v.text FROM verses v
           JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=?''', (bid,)).fetchall()
    rows = sorted(rows, key=lambda r: (r['cn'], keyf(r['vn'])))
    cur.execute('DELETE FROM sam_chapters WHERE book_id=?', (bid,))
    sam = 1; assign = []
    samids = {}
    for r in rows:
        if sam not in samids:
            cur.execute('INSERT INTO sam_chapters (book_id, number) VALUES (?,?)', (bid, sam))
            samids[sam] = cur.lastrowid
        assign.append((samids[sam], r['id']))
        if END.search(r['text'] or ''):
            sam += 1
    cur.executemany('UPDATE verses SET sam_ch_id=? WHERE id=?', assign)
    conn.commit()
    print('applied: inserted %d verses; Exodus sam_chapters now %d'
          % (len(inserts), conn.execute('SELECT COUNT(*) FROM sam_chapters WHERE book_id=?', (bid,)).fetchone()[0]))
    conn.close()


if __name__ == '__main__':
    main()
