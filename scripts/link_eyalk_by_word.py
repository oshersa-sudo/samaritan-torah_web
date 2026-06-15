# -*- coding: utf-8 -*-
"""
Add word-based links for eyalk commentary bullets that have NO explicit verse
reference (פרק:פסוק). For such a bullet we take the Torah words it quotes — a
word is recognised as a quote only if it carries nikud (vowel points), which is
how the file marks quoted scripture and which cleanly excludes Aramaic / the
darshan's own prose — and link the bullet to the verse(s) IN ITS OWN PARSHA
whose consonant text contains that word.

Matching is consonants-only (nikud stripped both sides). A quoted word is used
only if it is distinctive: it must match at least one and at most MAXV verses in
the parsha (a word found in many verses is not a useful anchor and is skipped).
This only ADDS rows to eyalk_verse_links for currently-unlinked sections; nothing
is removed and reference-based links are untouched. Full backup.

Usage:  py -3 scripts/link_eyalk_by_word.py           # dry run + report
        py -3 scripts/link_eyalk_by_word.py --apply
"""
import sqlite3, sys, io, os, re, shutil
sys.path.insert(0, 'scripts')
sys.argv_keep = list(sys.argv)
import import_eyalk as E   # gematria, regexes, verse index, refs_in

APPLY = '--apply' in sys.argv_keep
DB = 'data/torah.db'
MAXV = 4                       # a word matching more than this many verses = not an anchor
MINLEN = 3                     # min consonants for a usable anchor word

NIK = re.compile('[֑-ׇ]')          # Hebrew points / accents
NIKWORD = re.compile(r'[א-ת֑-ׇ]+')
NONHEB = re.compile('[^א-ת]+')
PREFIX = 'והבכלמש'                  # one-letter Hebrew proclitics
RANGE = re.compile(r'\(\s*(?:' + '|'.join(E.BOOKS) + r')\s+([א-ת]{1,3})'
                   r'(?:[-–—]\s*([א-ת]{1,3}))?\s*\)')
# very common words that aren't useful anchors even within one parsha
STOP = {'אלהים', 'ויאמר', 'ויהי', 'אשר', 'הארץ', 'יהוה', 'כל', 'את', 'אל',
        'על', 'לא', 'כי', 'הוא', 'אתה', 'אנכי', 'אם', 'מן', 'בני', 'איש',
        'הזה', 'אלה', 'ואת', 'ולא', 'גם', 'עד', 'בן', 'לו', 'לי', 'לך', 'הם'}


def cons_words(t):
    """Consonant words of a verse (nikud stripped, punctuation -> separator)."""
    return NONHEB.sub(' ', NIK.sub('', t or '')).split()


def cons(t):
    return NIK.sub('', t or '').replace(' ', '')  # for single tokens


def word_in(c, words):
    """True if consonant word c appears in the verse word list, allowing a
    single Hebrew proclitic prefix (ו/ה/ב/כ/ל/מ/ש)."""
    for w in words:
        if w == c or (len(w) == len(c) + 1 and w[0] in PREFIX and w[1:] == c):
            return True
    return False


def header_start(line):
    """First (start) chapter number in a parsha header's (book ch[–ch]) part."""
    m = RANGE.search(line)
    return E.gem(m.group(1)) if m else None


def build_parsha_ranges(conn):
    """parsha-name -> (book, start_ch, end_ch). A parsha runs from its header's
    start chapter to the chapter just before the next parsha in the same book
    (or that book's last chapter) — the headers only note a representative range,
    so this recovers the full one."""
    bookmax = {r['name']: r['mx'] for r in conn.execute(
        '''SELECT b.name, MAX(ch.number) mx FROM chapters ch
           JOIN books b ON b.id=ch.book_id GROUP BY b.name''')}
    heads = []          # (book, parsha, start)
    cur_book = None
    for raw in io.open(E.MD, encoding='utf-8'):
        line = raw.rstrip('\n')
        m = E.SEFER_HDR.match(line)
        if m:
            cur_book = m.group(1); continue
        mp = E.PARSHA_HDR.match(line)
        if mp:
            mb = E.BOOK_IN_PARENS.search(line)
            if mb:
                cur_book = mb.group(1)
            st = header_start(line)
            if cur_book and st:
                heads.append((cur_book, mp.group(1).strip(), st))
    ranges = {}
    for i, (book, parsha, st) in enumerate(heads):
        end = bookmax.get(book, st)
        for book2, _p2, st2 in heads[i + 1:]:
            if book2 == book:
                end = max(st, st2 - 1); break
        ranges[parsha] = (book, st, end)
    return ranges


def main():
    conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row
    vindex = E.build_verse_index(conn)
    pranges = build_parsha_ranges(conn)

    # verses by (book, chapter), consonant text, keyed verse_id
    vrows = {}
    for r in conn.execute('''SELECT b.name bk, ch.number cn, v.number vn, v.id vid, v.text txt
                             FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
                             JOIN books b ON b.id=ch.book_id'''):
        vrows.setdefault((r['bk'], r['cn']), []).append((r['vid'], r['vn'], cons_words(r['txt'])))

    # re-walk the md, tracking the section ord (same order import_eyalk used)
    cur_book = cur_parsha = None
    ord_i = -1
    plan = []          # (ord, parsha, book, text, [(vid, word, vn, cn)])
    for raw in io.open(E.MD, encoding='utf-8'):
        line = raw.rstrip('\n')
        m = E.SEFER_HDR.match(line)
        if m:
            cur_book = m.group(1); continue
        mp = E.PARSHA_HDR.match(line)
        if mp:
            cur_parsha = mp.group(1).strip()
            mb = E.BOOK_IN_PARENS.search(line)
            if mb:
                cur_book = mb.group(1)
            continue
        mb = E.BULLET.match(line)
        if not mb:
            continue
        body = mb.group(1)
        text = E.clean(body)
        if not text:
            continue
        ord_i += 1                                   # matches import_eyalk's i
        if E.refs_in(body, cur_book, vindex):
            continue                                 # already has reference links
        pr = pranges.get(cur_parsha)
        if not pr:
            continue
        rbook, rstart, rend = pr
        cur_range = (rstart, rend)
        cur_book = rbook
        # candidate anchor words: nikud-bearing tokens in the bullet
        cands = []
        for tok in NIKWORD.findall(body):
            if not NIK.search(tok):
                continue
            c = cons(tok)
            if len(c) >= MINLEN and c not in STOP and c not in cands:
                cands.append(c)
        # match each candidate within the parsha's chapter range
        hits = []
        seen = set()
        for c in cands:
            wmatches = []
            for cn in range(cur_range[0], cur_range[1] + 1):
                for vid, vn, vwords in vrows.get((cur_book, cn), []):
                    if word_in(c, vwords):
                        wmatches.append((vid, vn, cn))
            if 1 <= len(wmatches) <= MAXV:
                for vid, vn, cn in wmatches:
                    if vid not in seen:
                        seen.add(vid)
                        hits.append((vid, c, vn, cn))
        if hits:
            plan.append((ord_i, cur_parsha, cur_book, text, hits))

    total = sum(len(h) for *_, h in plan)
    print('unlinked bullets that gain word-links: %d' % len(plan))
    print('new verse links to add               : %d\n' % total)
    for ordi, parsha, book, text, hits in plan:
        refs = ', '.join('%s %d:%d«%s»' % (book, cn, vn, w) for _, w, vn, cn in hits)
        print('  [%s] %s' % (parsha, text[:48]))
        print('       -> %s' % refs)

    if not APPLY:
        print('\n[dry-run] re-run with --apply to add these links.')
        conn.close(); return

    bak = DB + '.bak_eyalk2'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak); print('backed up ->', bak)
    # map section ord -> section id
    oid = {r['ord']: r['id'] for r in conn.execute('SELECT id, ord FROM eyalk_sections')}
    added = 0
    for ordi, parsha, book, text, hits in plan:
        sid = oid.get(ordi)
        if sid is None:
            continue
        for vid, w, vn, cn in hits:
            exists = conn.execute('SELECT 1 FROM eyalk_verse_links WHERE verse_id=? AND section_id=?',
                                  (vid, sid)).fetchone()
            if not exists:
                conn.execute('INSERT INTO eyalk_verse_links (verse_id, section_id) VALUES (?,?)',
                             (vid, sid))
                added += 1
    conn.commit()
    print('\nadded %d links. eyalk_verse_links now: %d'
          % (added, conn.execute('SELECT COUNT(*) FROM eyalk_verse_links').fetchone()[0]))
    conn.close()


if __name__ == '__main__':
    main()
