# -*- coding: utf-8 -*-
"""
READ-ONLY. Find verses that are out of position in the actual reading order.
The app lists verses by id (MIN(id) for sam-chapter order, id within), so a verse
inserted later (high id) sorts to the wrong place even though its number/sam_ch_id
are right. For each Jewish chapter we walk verses BY id and flag any verse whose
number is <= the previous one (not strictly ascending). We also flag, per sam
chapter, verses that sit AFTER a ׃-- ending verse in id order (they appear past
the chapter-end mark). Changes nothing.
"""
import sqlite3, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
END = re.compile(r'׃[-–—]+\s*$')


def main():
    c = sqlite3.connect('data/torah.db'); c.row_factory = sqlite3.Row
    nonasc, aftermark = [], []
    for b in c.execute('SELECT id,name FROM books ORDER BY order_n'):
        # by Jewish chapter, in reading (id) order
        rows = c.execute(
            '''SELECT v.id, ch.number cn, v.number vn, v.sam_ch_id sid, v.text
               FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
               WHERE ch.book_id=? ORDER BY ch.number, v.id''', (b['id'],)).fetchall()
        bych = {}
        for r in rows:
            bych.setdefault(r['cn'], []).append(r)
        for cn, vlist in bych.items():
            for k in range(1, len(vlist)):
                if vlist[k]['vn'] <= vlist[k - 1]['vn']:
                    nonasc.append((b['name'], cn, vlist[k - 1]['vn'], vlist[k]['vn'],
                                   vlist[k]['id'], vlist[k]['sid']))
        # per sam chapter, in id order: verse after a ׃-- ending verse
        bysam = {}
        for r in c.execute(
            '''SELECT v.id, ch.number cn, v.number vn, v.sam_ch_id sid, v.text
               FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
               WHERE ch.book_id=? ORDER BY v.sam_ch_id, v.id''', (b['id'],)):
            bysam.setdefault(r['sid'], []).append(r)
        for sid, vlist in bysam.items():
            seen_mark = False
            for r in vlist:
                if seen_mark:
                    aftermark.append((b['name'], r['cn'], r['vn'], r['id'], sid))
                if END.search(r['text'] or ''):
                    seen_mark = True
    c.close()

    print('=== verses NOT in ascending order within their Jewish chapter (reading/id order): %d ===' % len(nonasc))
    for bk, cn, prev, vn, vid, sid in nonasc:
        print('   %-8s %d:  ...%d then %d  (id=%d, sam=%s)' % (bk, cn, prev, vn, vid, sid))
    print('\n=== verses sitting AFTER the ׃-- end-mark inside the same sam chapter: %d ===' % len(aftermark))
    for bk, cn, vn, vid, sid in aftermark:
        print('   %-8s %d:%d  (id=%d, sam=%s)' % (bk, cn, vn, vid, sid))


if __name__ == '__main__':
    main()
