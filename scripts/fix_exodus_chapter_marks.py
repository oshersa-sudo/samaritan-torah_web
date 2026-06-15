# -*- coding: utf-8 -*-
"""
Fix the trailing Samaritan chapter-mark ׃-- on inserted Exodus verses. For each
inserted verse whose text ends in ׃--, find it in שמות.txt: if in the source the
passage is followed by a NUMBERED verse of the SAME chapter (no ׃-- before it),
then it is a verse WITHIN a chapter, not a chapter end — the ׃-- is spurious and
is removed (content kept). If the source really has ׃-- there (a true chapter
end), it is left. After fixing, the Exodus Samaritan division is re-derived.
Only the trailing mark changes; no verse text/word is removed. Backup bak_exo4.

Usage:  py -3 scripts/fix_exodus_chapter_marks.py            # dry run
        py -3 scripts/fix_exodus_chapter_marks.py --apply
"""
import sqlite3, sys, io, os, re, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DB = 'data/torah.db'
LET = re.compile('[א-ת]')
END = re.compile(r'׃[-–—]+')


def lets(t):
    return ''.join(LET.findall(t or ''))


def main():
    rawfull = re.sub(r'[‎‏‪-‮]', '', io.open('data/שמות.txt', encoding='utf-8').read())
    # normalized TXT letters with a map to raw positions
    norm, idxmap = [], []
    for i, ch in enumerate(rawfull):
        if LET.match(ch):
            norm.append(ch); idxmap.append(i)
    norm = ''.join(norm)

    conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row
    bid = conn.execute('SELECT id FROM books WHERE name=?', ('שמות',)).fetchone()['id']
    ins = conn.execute('''SELECT v.id, ch.number cn, v.number vn, v.text t FROM verses v
            JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=? AND typeof(v.number)='text'
            ''', (bid,)).fetchall()

    fixes = []
    for r in ins:
        if not END.search(r['t'] or ''):
            continue                      # only verses ending in ׃--
        core = lets(re.sub(r'\s*׃[-–—]+\s*$', '', r['t']))
        tail = core[-22:]                 # last ~6 words of letters
        pos = norm.find(tail)
        if pos < 0:
            print('  [?] %s:%s not located in TXT' % (r['cn'], r['vn'])); continue
        after_raw = rawfull[idxmap[pos + len(tail) - 1] + 1: idxmap[pos + len(tail) - 1] + 14]
        # type A (true chapter end): a ׃-- appears before the next Hebrew letter
        is_chapter_end = bool(re.match(r'\s*׃[-–—]+', after_raw))
        if not is_chapter_end:
            new = re.sub(r'\s*׃[-–—]+\s*$', '', r['t'])
            new = re.sub(r'\s*׃\s*$', '', new).rstrip()
            fixes.append((r['id'], r['cn'], r['vn'], r['t'], new, after_raw.strip()[:12]))

    print('=== inserted verses with a SPURIOUS ׃-- (followed by a numbered verse, same chapter) ===')
    for vid, cn, vn, old, new, after in fixes:
        print('  %s:%s  (TXT next: %r)  ...%s  ->  ...%s' % (cn, vn, after, old[-20:], new[-20:]))
    print('total to fix: %d' % len(fixes))

    if not APPLY:
        print('\n[dry-run] re-run with --apply.')
        conn.close(); return

    bak = DB + '.bak_exo4'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak); print('backed up ->', bak)
    cur = conn.cursor()
    for vid, cn, vn, old, new, after in fixes:
        cur.execute('UPDATE verses SET text=? WHERE id=?', (new, vid))
    conn.commit()

    # re-derive Exodus Samaritan division in reading order
    def keyf(n):
        s = str(n)
        if '-' in s:
            a, b = s.split('-', 1); return (int(a), int(b))
        return (int(s), 0)
    ENDA = re.compile(r'׃[-–—]+\s*$')
    rows = sorted(conn.execute(
        '''SELECT v.id, ch.number cn, v.number vn, v.text FROM verses v
           JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=?''', (bid,)).fetchall(),
        key=lambda r: (r['cn'], keyf(r['vn'])))
    cur.execute('DELETE FROM sam_chapters WHERE book_id=?', (bid,))
    sam, samids, assign = 1, {}, []
    for r in rows:
        if sam not in samids:
            cur.execute('INSERT INTO sam_chapters (book_id, number) VALUES (?,?)', (bid, sam))
            samids[sam] = cur.lastrowid
        assign.append((samids[sam], r['id']))
        if ENDA.search(r['text'] or ''):
            sam += 1
    cur.executemany('UPDATE verses SET sam_ch_id=? WHERE id=?', assign)
    conn.commit()
    print('APPLIED: fixed %d marks; Exodus sam_chapters now %d'
          % (len(fixes), conn.execute('SELECT COUNT(*) FROM sam_chapters WHERE book_id=?', (bid,)).fetchone()[0]))
    conn.close()


if __name__ == '__main__':
    main()
