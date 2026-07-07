"""Fix the per-word ENGLISH alignment in word_english for "Format A" verses (those whose
en_he holds a HEBREW fragment). There the English rows were paired to verse_dictionary
words sequentially, so when the English source skipped a word (e.g. כבלע in Num 4:20) the
rest drifted onto the wrong word. We re-pair each row to the vd word whose Hebrew matches
its en_he. Format-B verses (en_he = an English gloss) are already correct and left alone.

  py -3 scripts/fix_english_align.py            # dry-run: stats + Num 4:20 before/after
  py -3 scripts/fix_english_align.py --apply    # write the corrected rows
"""
import re
import sqlite3
import sys

DB = 'data/torah.db'
_F = re.compile(r'[^א-ת]')


def fold(s):
    return _F.sub('', s or '')


def skel(s):
    return re.sub('[אהוי]', '', fold(s))


def first(s):
    t = (s or '').split()
    return t[0] if t else ''


def realign_verse(vd, rows):
    """vd=[(vd_id,hebrew)] ordered; rows=[(vd_id,en,en_he)] ordered. Return [(vd_id,en,en_he)]
    re-paired by content, or None if this verse isn't Format A."""
    heb = [r for r in rows if re.search('[א-ת]', r[2] or '')]
    if len(heb) * 2 <= len(rows):                 # mostly English en_he → Format B, leave it
        return None
    vdw = [(vid, fold((h or '').split(',')[0])) for vid, h in vd]
    used = [False] * len(rows)
    out = []
    for vid, wf in vdw:
        if not wf:
            continue
        idx = None
        for i, (_, en, en_he) in enumerate(rows):     # exact first-token match
            if not used[i] and fold(first(en_he)) == wf:
                idx = i
                break
        if idx is None:                                # matres-lectionis skeleton fallback
            for i, (_, en, en_he) in enumerate(rows):
                if not used[i]:
                    ft = fold(first(en_he))
                    if ft and skel(ft) == skel(wf) and len(skel(wf)) >= 2:
                        idx = i
                        break
        if idx is not None:
            used[idx] = True
            out.append((vid, rows[idx][1], rows[idx][2]))
    return out


def main(apply):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    verses = [r[0] for r in conn.execute('SELECT DISTINCT verse_id FROM word_english')]
    changed = rows_before = rows_after = 0
    sample_before = sample_after = None
    for vidv in verses:
        vd = [(r['id'], r['hebrew']) for r in conn.execute(
            'SELECT id, hebrew FROM verse_dictionary WHERE verse_id=? ORDER BY id', (vidv,))]
        rows = [(r['vd_id'], r['en'], r['en_he']) for r in conn.execute(
            'SELECT vd_id, en, en_he FROM word_english WHERE verse_id=? ORDER BY vd_id', (vidv,))]
        new = realign_verse(vd, rows)
        if new is None:
            continue
        old_map = {vid: (en, en_he) for vid, en, en_he in rows}
        new_map = {vid: (en, en_he) for vid, en, en_he in new}
        if old_map == new_map:
            continue
        changed += 1
        rows_before += len(rows); rows_after += len(new)
        # capture Num 4:20 as the sample
        info = conn.execute('''SELECT b.order_n,c.number,v.number FROM verses v
            JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id WHERE v.id=?''', (vidv,)).fetchone()
        if tuple(info) == (4, 4, 20) or (sample_before is None and changed == 1):
            hebmap = {vid: (h or '').split(',')[0] for vid, h in vd}
            sample_before = [(hebmap.get(v, '?'), (o[0] or '')[:20]) for v, o in old_map.items()]
            sample_after = [(hebmap.get(v, '?'), (n[0] or '')[:20]) for v, n in new_map.items()]
        if apply:
            conn.execute('DELETE FROM word_english WHERE verse_id=?', (vidv,))
            conn.executemany('INSERT INTO word_english(vd_id, verse_id, en, en_he) VALUES(?,?,?,?)',
                             [(vid, vidv, en, en_he) for vid, en, en_he in new])
    if apply:
        conn.commit()
    conn.close()
    print('%s: %d Format-A verses re-aligned (rows %d→%d)'
          % ('APPLIED' if apply else 'DRY-RUN', changed, rows_before, rows_after))
    if sample_before:
        print('sample before:', sample_before)
        print('sample after :', sample_after)


if __name__ == '__main__':
    main('--apply' in sys.argv)
