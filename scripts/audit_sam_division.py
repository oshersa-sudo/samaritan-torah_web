# -*- coding: utf-8 -*-
"""
READ-ONLY audit of the Samaritan chapter division in the DB. Surfaces three kinds
of problem (changes nothing):

  A) a verse ENDS with the Samaritan end-mark ׃-- but the NEXT verse stays in the
     same sam chapter  -> the split was not applied (verses after the mark should
     move to the next sam chapter).
  B) a verse does NOT end with ׃-- but the next verse opens a new sam chapter
     -> a spurious split.
  C) within a Jewish chapter the verse numbers are not strictly ascending
     (duplicate / out-of-order / reset).

Also reports sam chapters whose LAST verse lacks the end-mark.
"""
import sqlite3, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
END = re.compile(r'׃[-–—]+\s*$')


def main():
    c = sqlite3.connect('data/torah.db'); c.row_factory = sqlite3.Row
    A, B, C, openchaps = [], [], [], []
    for b in c.execute('SELECT id,name FROM books ORDER BY order_n'):
        vs = c.execute(
            '''SELECT ch.number cn, v.number vn, v.sam_ch_id sid, v.text
               FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
               WHERE ch.book_id=? ORDER BY ch.number, v.number''', (b['id'],)).fetchall()
        # A & B : compare each verse's end-mark to the sam boundary with the next
        for i in range(len(vs) - 1):
            cur, nxt = vs[i], vs[i + 1]
            ismark = bool(END.search(cur['text'] or ''))
            boundary = (cur['sid'] != nxt['sid'])
            if ismark and not boundary:
                A.append((b['name'], cur['cn'], cur['vn'], nxt['cn'], nxt['vn'], cur['sid']))
            if (not ismark) and boundary:
                B.append((b['name'], cur['cn'], cur['vn'], nxt['cn'], nxt['vn'], cur['sid'], nxt['sid']))
        # C : ascending verse numbers within each Jewish chapter
        bych = {}
        for r in vs:
            bych.setdefault(r['cn'], []).append(r['vn'])
        for cn, nums in bych.items():
            for k in range(1, len(nums)):
                if nums[k] <= nums[k - 1]:
                    C.append((b['name'], cn, nums[k - 1], nums[k]))
        # sam chapters whose last verse lacks the end-mark
        last = {}
        for r in vs:
            last[r['sid']] = r
        for sid, r in last.items():
            if not END.search(r['text'] or ''):
                openchaps.append((b['name'], r['cn'], r['vn'], sid))
    c.close()

    def show(title, rows, fmt, limit=40):
        print('\n=== %s: %d ===' % (title, len(rows)))
        for r in rows[:limit]:
            print('   ' + fmt(r))
        if len(rows) > limit:
            print('   ... (+%d more)' % (len(rows) - limit))

    show('A) ends with ׃-- but NOT split (verses after mark stay in same sam ch)',
         A, lambda r: '%s  %d:%d --|-- next %d:%d  (both sam=%s)' % r)
    show('B) NOT ending with ׃-- but a new sam chapter opens (spurious split)',
         B, lambda r: '%s  %d:%d -> %d:%d  (sam %s -> %s)' % r)
    show('C) verse numbering not strictly ascending',
         C, lambda r: '%s ch %d:  %d then %d' % r)
    show('sam chapters whose LAST verse lacks ׃-- (excl. book-final, review)',
         openchaps, lambda r: '%s last verse %d:%d  (sam=%s)' % r)


if __name__ == '__main__':
    main()
