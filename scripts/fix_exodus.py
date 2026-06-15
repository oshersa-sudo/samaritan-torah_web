# -*- coding: utf-8 -*-
"""
Fix the corrupted Exodus data in data/torah.db, sourced from data/שמות.txt.

Problems in שמות.txt (confirmed read-only):
  * chapter 22 has no label - its text is fused onto the end of the "Exodus 21"
    block (Ex 21 vv.1-37 then Ex 22 vv.1-30, with a verse-number restart);
  * chapter 26 is split into two blocks ("26:1" vv.1-35 and "26:36" vv.36-37),
    with an "Exodus 30:1" block (vv.1-10) wrongly wedged between them;
  * chapter 30 is split into two blocks ("30:1" vv.1-10 and "30:11" vv.11-38).
Because import_torah.py keys chapters by number and overwrites, the DB ended up
with no ch.22, ch.26 = only vv.36-37, ch.30 = only vv.11-38, and a scrambled
ch.21.

This rebuilds the Exodus book: every GOOD chapter keeps its existing text,
commentaries and dictionary byte-for-byte; only the four broken chapters
(21, 22, 26, 30) are rebuilt from שמות.txt. The Samaritan division (sam_chapters
/ sam_ch_id) is recomputed for the whole book from the ׃-- markers, so it is
correct and continuous again. Existing commentary/dictionary is re-attached by
(chapter, verse). No other book is touched.

Backup first (data/torah.db.bak2). Re-runnable.
"""
import os, io, re, sqlite3, unicodedata

D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
DB = os.path.join(D, 'torah.db')
TXT = os.path.join(D, 'שמות.txt')
BOOK = 'שמות'
MARK = ' ׃--'
BROKEN = {21, 22, 26, 30}
KEEP = ['text', 'english', 'masoretic_text', 'interpretation', 'sam_hebrew',
        'sam_aramaic', 'simple_hebrew', 'site_english', 'old_text',
        'rashi', 'ramban', 'cassuto', 'baal_haturim']
LABEL = re.compile(r'^[A-Za-z]+\s+(\d+):(\d+)\s+(.*)', re.DOTALL)
EMBED = re.compile(r'^[A-Za-z]+\s+(\d+):(\d+)\s+(.*)', re.DOTALL)  # label inside a chunk
NUM = re.compile(r'^(\d+)\s+(.*)', re.DOTALL)


def clean_bidi(t):
    return ''.join(c for c in t if unicodedata.category(c) != 'Cf')


def clean_brackets(text):
    """Project rule (scripts/restore_verse_text.py): drop [ ] { } characters but
    keep the content inside, then collapse runs of spaces. Also drop the << >>
    variant markers, which the DB's other (cleaned) verses never contain."""
    text = re.sub(r'\[([^\]]*)\]', r'\1', text)
    text = re.sub(r'\{([^}]*)\}', r'\1', text)
    text = re.sub(r'<<([^>]*)>>', r'\1', text)
    return re.sub(r'  +', ' ', text).strip()


def chunks_of(body):
    """Split a chapter body into (verse_text, sam_end) chunks, exactly like
    import_torah._parse_verses splits on ׃ (and optional trailing dashes)."""
    parts = re.split(r'(׃)([-–—]+)?', body)
    out = []
    i, n = 0, len(parts)
    while i < n:
        chunk = (parts[i] or '').strip()
        dashes = parts[i + 2] if i + 2 < n else ''
        sam_end = bool(dashes and re.search(r'[-–—]', dashes or ''))
        if chunk:
            out.append((chunk, sam_end))
        i += 3 if (i + 1 < n and parts[i + 1]) else 1
    return out


def parse_broken_chapters():
    """Return {chapter: {verse: text_with_marker}} for chapters 21,22,26,30
    only, parsed correctly from שמות.txt (split 21/22, merge 26 and 30)."""
    lines = [l.strip() for l in clean_bidi(io.open(TXT, 'rb').read().decode('utf-8')).splitlines() if l.strip()]
    out = {c: {} for c in BROKEN}
    for line in lines:
        m = LABEL.match(line)
        if not m:
            continue
        ch, fv, body = int(m.group(1)), int(m.group(2)), m.group(3)
        if ch not in BROKEN:
            continue
        cur, v = ch, fv
        for idx, (ctext, sam_end) in enumerate(chunks_of(body)):
            em = EMBED.match(ctext)
            nm = NUM.match(ctext)
            if idx == 0:                         # first chunk = the labelled verse
                v, text = fv, ctext
            elif em:                             # embedded "Exodus N:M" label (the 21->22 boundary)
                cur, v, text = int(em.group(1)), int(em.group(2)), em.group(3)
            elif nm:                             # explicit verse number
                v, text = int(nm.group(1)), nm.group(2)
            else:                                # rare missing number: keep in same chapter
                v, text = v + 1, ctext
            text = clean_brackets(text)
            if sam_end:
                text += MARK
            out.setdefault(cur, {})[v] = text
    return out


def main():
    new = parse_broken_chapters()
    print('parsed from שמות.txt:', {c: '%d verses' % len(new[c]) for c in sorted(new)})

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    book_id = conn.execute('SELECT id FROM books WHERE name=?', (BOOK,)).fetchone()['id']

    # snapshot existing verses + dictionary by (chapter, verse)
    snap = {}
    for r in conn.execute('''SELECT ch.number AS ch, v.number AS vn, v.* FROM verses v
        JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=?''', (book_id,)):
        snap[(r['ch'], r['vn'])] = {k: r[k] for k in KEEP}
    dsnap = {}
    for r in conn.execute('''SELECT ch.number AS ch, v.number AS vn, vd.aramaic, vd.hebrew
        FROM verse_dictionary vd JOIN verses v ON v.id=vd.verse_id
        JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=? ORDER BY vd.id''', (book_id,)):
        dsnap.setdefault((r['ch'], r['vn']), []).append((r['aramaic'], r['hebrew']))

    # decide the final verse set per chapter (1..40)
    good_chapters = sorted({c for (c, _) in snap} - BROKEN)
    final = {}
    for ch in good_chapters:
        final[ch] = {vn: snap[(ch, vn)]['text'] for (c, vn) in snap if c == ch}
    for ch in BROKEN:
        if new.get(ch):
            final[ch] = dict(new[ch])

    # wipe and rebuild the book
    conn.execute('''DELETE FROM verse_dictionary WHERE verse_id IN
        (SELECT v.id FROM verses v JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=?)''', (book_id,))
    conn.execute('''DELETE FROM verses WHERE chapter_id IN
        (SELECT id FROM chapters WHERE book_id=?)''', (book_id,))
    conn.execute('DELETE FROM chapters WHERE book_id=?', (book_id,))
    conn.execute('DELETE FROM sam_chapters WHERE book_id=?', (book_id,))

    sam_num = [1]
    sam_id = [None]

    def new_sam():
        cur = conn.execute('INSERT INTO sam_chapters (book_id, number) VALUES (?,?)',
                            (book_id, sam_num[0]))
        sam_id[0] = cur.lastrowid
        sam_num[0] += 1

    new_sam()
    kept = added = 0
    for ch in sorted(final):
        cur = conn.execute('INSERT INTO chapters (book_id, number) VALUES (?,?)', (book_id, ch))
        ch_id = cur.lastrowid
        for v in sorted(final[ch]):
            text = final[ch][v]
            enr = snap.get((ch, v))
            if enr and ch not in BROKEN:
                data = dict(enr)                     # preserve good chapter exactly
                kept += 1
            elif enr:                                # broken chapter, verse existed
                data = dict(enr)
                data['text'] = text                  # corrected text from .txt
                kept += 1
            else:                                    # brand-new verse
                data = {k: None for k in KEEP}
                data['text'] = text
                data['sam_hebrew'] = text
                added += 1
            cols = ['chapter_id', 'number', 'sam_ch_id'] + KEEP
            vals = [ch_id, v, sam_id[0]] + [data[k] for k in KEEP]
            vid = conn.execute('INSERT INTO verses (%s) VALUES (%s)' %
                               (','.join(cols), ','.join('?' * len(cols))), vals).lastrowid
            for ar, he in dsnap.get((ch, v), []):
                conn.execute('INSERT INTO verse_dictionary (verse_id, aramaic, hebrew) VALUES (?,?,?)',
                             (vid, ar, he))
            if (text or '').rstrip().endswith('׃--'):
                new_sam()
    conn.commit()

    nch = conn.execute('SELECT COUNT(*) FROM chapters WHERE book_id=?', (book_id,)).fetchone()[0]
    nv = conn.execute('''SELECT COUNT(*) FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
        WHERE ch.book_id=?''', (book_id,)).fetchone()[0]
    nsam = conn.execute('SELECT COUNT(*) FROM sam_chapters WHERE book_id=?', (book_id,)).fetchone()[0]
    print('rebuilt שמות: %d chapters, %d verses (%d preserved, %d added), %d samaritan chapters' %
          (nch, nv, kept, added, nsam))
    conn.close()


if __name__ == '__main__':
    main()
