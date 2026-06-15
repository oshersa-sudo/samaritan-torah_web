# -*- coding: utf-8 -*-
"""
Restore the verse-END stop mark from torah_aziz_ver2.docx into verses.text.

apply_ver2.py inserted the Samaritan stop marks (':' small, '.' standing) only
MID-verse; verse ends were collapsed to a plain ׃ and then dropped by the verse
import, so an end-of-verse pause like 'ומאת שנה.' (Exodus 6:20) never reached the
app. This script re-derives, per verse, the mark sitting on the verse's LAST word
in the Word doc and appends it to that verse's text in the DB.

Only confident alignments are used (the word matches between the .txt reference
and the doc), and a verse is touched only if it doesn't already end with a mark.
':--' (section end) is left to the existing ׃-- handling. Backs up the DB.

Usage:  py -3 scripts/restore_verse_end_marks.py            # dry run
        py -3 scripts/restore_verse_end_marks.py --apply
"""
import sys, os, io, shutil, sqlite3
sys.path.insert(0, 'scripts')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from difflib import SequenceMatcher
from aziz_lib import parse_txt, norm
from aziz2_lib import extract as extract2

APPLY = '--apply' in sys.argv
FILES = {'Genesis': 'data/בראשית.txt', 'Exodus': 'data/שמות.txt',
         'Leviticus': 'data/ויקרא.txt', 'Numbers': 'data/במדבר.txt',
         'Deuteronomy': 'data/דברים.txt'}
BOOK_HE = {'Genesis': 'בראשית', 'Exodus': 'שמות', 'Leviticus': 'ויקרא',
           'Numbers': 'במדבר', 'Deuteronomy': 'דברים'}
ENDS = ('.', ':', '׃', '-')          # already-terminated verse -> leave alone


def end_marks():
    """(book_he, chap, verse) -> '.' | ':'  from the doc's verse-final word."""
    doc = extract2()
    out = {}
    stats = {}
    for book, path in FILES.items():
        ref = parse_txt(path, book)
        hyp = [w for w in doc if w['book'] == book]
        n = len(ref)

        def verse_end(i):
            return i == n - 1 or (ref[i + 1]['chap'], ref[i + 1]['verse']) != \
                                 (ref[i]['chap'], ref[i]['verse'])

        mark_of = {}                 # ref index -> doc mark (confident only)
        sm = SequenceMatcher(None, [norm(w['word']) for w in ref],
                             [norm(w['word']) for w in hyp], autojunk=False)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == 'equal':
                for k in range(i2 - i1):
                    mark_of[i1 + k] = hyp[j1 + k]['mark']
            elif tag == 'replace' and (i2 - i1) == (j2 - j1):
                for k in range(i2 - i1):
                    if norm(ref[i1 + k]['word']) == norm(hyp[j1 + k]['word']):
                        mark_of[i1 + k] = hyp[j1 + k]['mark']

        got = aligned = 0
        for i in range(n):
            if not verse_end(i):
                continue
            aligned += i in mark_of
            mk = mark_of.get(i)
            if mk in ('.', ':'):
                out[(BOOK_HE[book], ref[i]['chap'], ref[i]['verse'])] = mk
                got += 1
        nverses = sum(1 for i in range(n) if verse_end(i))
        stats[book] = (nverses, aligned, got)
    return out, stats


def main():
    marks, stats = end_marks()
    print('per book:  verse-ends | last-word aligned | got . or :')
    for b, (nv, al, g) in stats.items():
        print('  %-12s %5d | %5d | %5d' % (b, nv, al, g))

    conn = sqlite3.connect('data/torah.db')
    conn.row_factory = sqlite3.Row
    updates, skipped, missing = [], 0, 0
    for (bk, ch, vs), mk in marks.items():
        row = conn.execute(
            """SELECT v.id, v.text FROM verses v JOIN chapters c ON c.id=v.chapter_id
               JOIN books b ON b.id=c.book_id
               WHERE b.name=? AND c.number=? AND v.number=?""", (bk, ch, vs)).fetchone()
        if not row:
            missing += 1
            continue
        t = (row['text'] or '').rstrip()
        if not t or t[-1] in ENDS:
            skipped += 1
            continue
        updates.append((t + mk, row['id']))

    print('\nverses to update: %d   (already-marked skipped: %d, not in DB: %d)'
          % (len(updates), skipped, missing))
    ex = conn.execute(
        """SELECT v.id,v.text FROM verses v JOIN chapters c ON c.id=v.chapter_id
           JOIN books b ON b.id=c.book_id WHERE b.name='שמות' AND c.number=6 AND v.number=20"""
    ).fetchone()
    nt = dict((i, t) for t, i in updates).get(ex['id'])
    print('Exodus 6:20 ->', repr((nt or ex['text'])[-30:]))

    if APPLY:
        bak = 'data/torah.db.bak10'
        if not os.path.exists(bak):
            shutil.copy2('data/torah.db', bak)
            print('backed up ->', bak)
        conn.executemany('UPDATE verses SET text=? WHERE id=?', updates)
        conn.commit()
        print('applied %d verse-end marks.' % len(updates))
    else:
        print('\n[dry-run] re-run with --apply to write.')
    conn.close()


if __name__ == '__main__':
    main()
