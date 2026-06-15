# -*- coding: utf-8 -*-
"""
Repair mislocated root_index entries (OCR digit-misreads of the verse number in
the source index). An entry is "mislocated" when the searched form is absent at
its stated verse but clearly present at exactly ONE other, still-unclaimed verse
*in the same chapter* (digit misreads keep the chapter, only the verse number is
wrong — e.g. דברים 23:10 -> 23:6, 25:6 -> 25:7).

Matching uses a consonant skeleton in which the matres ו and י are dropped, to
mirror the way the Samaritan transliteration (pron) renders those letters as
vowels. "Clearly present" means a verse word whose skeleton equals the pron's
consonants exactly (similarity 1.0); "absent" means the best word at the current
verse scores below ABSENT_BELOW.

Safe by construction:
  * only same-chapter, exactly-one-candidate, not-already-claimed relocations,
  * reads everything first, backs up the DB, writes verse_id/verse only,
  * --apply required to write; default is a dry-run report.

Usage:  py -3 scripts/fix_root_index_locations.py            # dry run
        py -3 scripts/fix_root_index_locations.py --apply    # write (after backup)
"""
import sqlite3, sys, os, io, re, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.database import _lat_cons, _HEB_CONS, _dedupe, _cons_sim

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'torah.db')
APPLY = '--apply' in sys.argv
ABSENT_BELOW = 0.6          # current verse counts as "form absent" below this

# Hebrew -> consonant skeleton with ו and י dropped as matres (mirrors the pron)
_HC = {**_HEB_CONS, 'י': '', 'ו': ''}


def heb_cons(w):
    w = re.sub('[֑-ׇ]', '', w or '')
    return _dedupe(c for c in (_HC.get(ch, '') for ch in w) if c)


def best_in(pc, text):
    """Best skeleton similarity between pron-consonants pc and any word of text."""
    if not pc:
        return 1.0          # all-vowel pron: cannot judge, treat as present
    m = 0.0
    for w in re.findall('[א-ת]+', text or ''):
        s = _cons_sim(heb_cons(w), pc)
        if s > m:
            m = s
    return m


def exact_words(pc, text):
    """Words whose skeleton equals the pron consonants exactly (a clear hit)."""
    return [w for w in re.findall('[א-ת]+', text or '') if pc and heb_cons(w) == pc]


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    # verse lookup tables
    vrows = conn.execute(
        '''SELECT v.id, v.number vs, ch.number ch, ch.book_id bk, b.name bname, v.text
           FROM verses v JOIN chapters ch ON ch.id = v.chapter_id
           JOIN books b ON b.id = ch.book_id''').fetchall()
    vtext = {r['id']: r['text'] for r in vrows}
    vmeta = {r['id']: (r['bk'], r['ch'], r['vs']) for r in vrows}
    chapter_verses = {}                       # (book_id, ch) -> [(vid, number)]
    for r in vrows:
        chapter_verses.setdefault((r['bk'], r['ch']), []).append((r['id'], r['vs']))

    entries = conn.execute(
        "SELECT id, root, pron, root_norm, verse_id FROM root_index "
        "WHERE verse_id IS NOT NULL AND pron IS NOT NULL AND TRIM(pron) <> ''").fetchall()

    # which verses each (root_norm,pron) group already occupies (don't relocate onto them)
    claimed = {}
    for e in entries:
        claimed.setdefault((e['root_norm'], e['pron']), set()).add(e['verse_id'])

    relocate, ambiguous, unresolved = [], [], []
    for e in entries:
        v0 = e['verse_id']
        if v0 not in vmeta:
            continue
        pc = _lat_cons(e['pron'])
        if best_in(pc, vtext.get(v0)) >= ABSENT_BELOW:
            continue                          # current location already matches
        bk, ch, _ = vmeta[v0]
        # the chapter's book_id: recover from chapter_verses keys via vmeta book name -> need book_id
        # vmeta stored book_id as bk
        cands = []
        for vid, num in chapter_verses.get((bk, ch), []):
            if vid == v0:
                continue
            if vid in claimed.get((e['root_norm'], e['pron']), set()):
                continue
            if exact_words(pc, vtext.get(vid)):
                cands.append((vid, num))
        if len(cands) == 1:
            relocate.append((e, cands[0]))
        elif len(cands) > 1:
            ambiguous.append((e, cands))
        else:
            unresolved.append(e)

    print('entries scanned:', len(entries))
    print('mislocated (form absent at stated verse):',
          len(relocate) + len(ambiguous) + len(unresolved))
    print('  -> unique same-chapter fix:', len(relocate))
    print('  -> multiple candidates (left as-is):', len(ambiguous))
    print('  -> no same-chapter candidate (left as-is):', len(unresolved))
    print()
    bookname = {r['bk']: r['bname'] for r in vrows}
    print('--- sample of unique fixes ---')
    for e, (vid, num) in relocate[:25]:
        bk, c, oldvs = vmeta[e['verse_id']]
        print('  %s %-7s %s %d:%d -> :%d | %s' % (
            e['root'], e['pron'], bookname.get(bk, ''),
            c, oldvs, num, (vtext.get(vid) or '')[:45]))

    if APPLY and relocate:
        bak = DB + '.bak5'
        if not os.path.exists(bak):
            shutil.copy2(DB, bak)
            print('\nbacked up DB ->', os.path.basename(bak))
        conn.executemany(
            'UPDATE root_index SET verse_id=?, verse=? WHERE id=?',
            [(vid, num, e['id']) for e, (vid, num) in relocate])
        conn.commit()
        print('applied %d relocations.' % len(relocate))
    elif not APPLY:
        print('\n(dry run — re-run with --apply to write, DB will be backed up first)')
    conn.close()


if __name__ == '__main__':
    main()
