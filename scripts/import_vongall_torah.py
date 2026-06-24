# -*- coding: utf-8 -*-
"""Re-import von Gall's critical apparatus (חילופי נוסח) from the corrected,
whole-Torah consonantal file `data/vongall_new/apparatus_consonantal_torah.csv`,
replacing the earlier Genesis-only data. Each variant is LINKED to its verse by
(book, chapter, verse) — the user's "fix the apparatus links".

CSV columns: book(GEN/EXO/LEV/NUM/DEU), chapter, verse, sort_pos, lemma, variant,
marks(om/del/transp/…), reading("lemma] variant"), anchor(link quality), needs_review.

Maps into the existing `vongall_apparatus` schema so the API/UI keep working:
  reading_type ← marks  (transp>om>del, else 'sub')
  confidence   ← anchor (lemma+num/lemma=high, lemma~num=medium, lemma-ambig=low)
  reading      ← variant ;  occurrence ← running index when a lemma repeats in a verse
  register=1 (consonantal) ;  witnesses=[] (this apparatus records no witnesses).

Backs up first. Re-runnable.

Usage:  py -3 scripts/import_vongall_torah.py            # dry run
        py -3 scripts/import_vongall_torah.py --apply
"""
import csv, sqlite3, sys, io, os, shutil, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DB = 'data/torah.db'
CSV = 'data/vongall_new/apparatus_consonantal_torah.csv'
BOOK = {'GEN': 'בראשית', 'EXO': 'שמות', 'LEV': 'ויקרא', 'NUM': 'במדבר', 'DEU': 'דברים'}


def reading_type(marks):
    m = marks or ''
    if 'transp' in m:
        return 'transp'
    if 'om' in m:
        return 'om'
    if 'del' in m:
        return 'del'
    return 'sub'


def confidence(anchor):
    a = anchor or ''
    if a in ('lemma+num', 'lemma'):
        return 'high'
    if a == 'lemma-ambig':
        return 'low'
    return 'medium'


def main():
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    vidx = {}
    for r in conn.execute("""SELECT v.id, b.name bk, ch.number cn, v.number vn
                             FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
                             JOIN books b ON b.id=ch.book_id"""):
        if str(r['vn']).isdigit():
            vidx[(r['bk'], r['cn'], int(r['vn']))] = r['id']

    rows = list(csv.DictReader(open(CSV, encoding='utf-8-sig')))
    recs, miss = [], []
    seen_lemma = {}                       # (verse_id, lemma) -> count, for occurrence
    by_book = {}
    for r in rows:
        bk = BOOK.get(r['book'])
        try:
            key = (bk, int(r['chapter']), int(r['verse']))
        except ValueError:
            miss.append(r); continue
        vid = vidx.get(key)
        if not vid:
            miss.append(r); continue
        lemma = (r['lemma'] or '').strip()
        n = seen_lemma.get((vid, lemma), 0) + 1
        seen_lemma[(vid, lemma)] = n
        recs.append((
            vid, 1,                                   # verse_id, register
            lemma,
            '',                                        # occurrence filled below (pass 2)
            (r['variant'] or '').strip(),              # reading
            reading_type(r['marks']),
            '[]',                                      # witnesses (none)
            confidence(r['anchor']),
            '',                                        # note
            int(r['sort_pos']) if str(r['sort_pos']).isdigit() else 0,
            (vid, lemma),                              # tmp key for occurrence
        ))
        by_book[r['book']] = by_book.get(r['book'], 0) + 1
    # pass 2: set occurrence (¹²³…) only where a lemma occurs more than once in a verse
    SUP = {1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶'}
    counts = {}
    for rec in recs:
        counts[rec[-1]] = counts.get(rec[-1], 0) + 1
    running = {}
    final = []
    for rec in recs:
        key = rec[-1]
        occ = ''
        if counts[key] > 1:
            running[key] = running.get(key, 0) + 1
            occ = SUP.get(running[key], str(running[key]))
        final.append((rec[0], rec[1], rec[2], occ, rec[4], rec[5], rec[6], rec[7], rec[8], rec[9]))

    print('apparatus rows linked : %d / %d' % (len(final), len(rows)))
    print('  by book:', by_book)
    print('  unlinked: %d' % len(miss))
    rt = {}
    for f in final:
        rt[f[5]] = rt.get(f[5], 0) + 1
    print('  reading types:', rt)
    if not APPLY:
        print('\n[dry-run] re-run with --apply to write'); conn.close(); return

    bak = DB + '.bak_vongall_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backup ->', os.path.basename(bak))
    cu = conn.cursor()
    cu.execute("DELETE FROM vongall_apparatus")
    cu.executemany(
        """INSERT INTO vongall_apparatus
           (verse_id, register, lemma, occurrence, reading, reading_type,
            witnesses, confidence, note, sort_pos)
           VALUES (?,?,?,?,?,?,?,?,?,?)""", final)
    conn.commit()
    n = conn.execute("SELECT COUNT(*) FROM vongall_apparatus").fetchone()[0]
    nv = conn.execute("SELECT COUNT(DISTINCT verse_id) FROM vongall_apparatus").fetchone()[0]
    print('APPLIED: %d apparatus entries across %d verses (all five books).' % (n, nv))
    conn.close()


if __name__ == '__main__':
    main()
