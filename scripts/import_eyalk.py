# -*- coding: utf-8 -*-
"""
Parse data/eyalk_parasha_summaries.md ("מן המסורת השומרונית") and link each
commentary bullet to the verse(s) it discusses, by reading the verse references
embedded in the text (Hebrew-gematria chapter:verse, e.g. "בראשית א:א", "(ד:כה)",
"(א:ג, ו, ט)", "(י:כד-כה)").

Builds two tables, mirroring tm_sections / tm_verse_links:
    eyalk_sections(id, parsha, book, ord, text)
    eyalk_verse_links(id, verse_id, section_id)

A reference's book defaults to the current parsha's book; an explicit book name
in the reference overrides it (cross-references). Every (book,ch,verse) is
validated against the DB — a parse that doesn't resolve to a real verse is
dropped, which filters false ":" matches. The lecturer's name and any "שוכו"
token are stripped from the stored text. Only the two eyalk_* tables are
created/replaced; nothing else in the DB is touched. Full backup.

Usage:  py -3 scripts/import_eyalk.py            # dry run + stats
        py -3 scripts/import_eyalk.py --apply
"""
import sqlite3, sys, io, os, re, shutil

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv

MD = 'data/eyalk_parasha_summaries.md'
DB = 'data/torah.db'
BOOKS = ('בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים')
GEM = {'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
       'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
       'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100,
       'ר': 200, 'ש': 300, 'ת': 400}

# (book? ) chapter : verse (-endverse)?  followed by an optional ", v, v" list
REF = re.compile(
    r'(?:(' + '|'.join(BOOKS) + r')\s+)?'
    r'([א-ת]{1,3}):([א-ת]{1,3})'
    r'(?:[-–—]([א-ת]{1,3}))?'
    r'((?:\s*,\s*[א-ת]{1,3})+)?')
PARSHA_HDR = re.compile(r'^##\s+(.*?)\s+[—\-]')          # ## פרשת בראשית — ...
BOOK_IN_PARENS = re.compile(r'\(\s*(' + '|'.join(BOOKS) + r')')
SEFER_HDR = re.compile(r'^#\s+ספר\s+(' + '|'.join(BOOKS) + r')')
BULLET = re.compile(r'^\s*-\s+(.*\S)\s*$')
STRIP_NAMES = re.compile(r'אייל\s*כהן|אייל|שוכו')


def gem(s):
    return sum(GEM.get(c, 0) for c in s)


def clean(text):
    """Bullet markdown -> plain display text; drop the lecturer's name/שוכו."""
    t = text.replace('**', '').replace('*', '')
    t = STRIP_NAMES.sub('', t)
    return re.sub(r'\s{2,}', ' ', t).strip(' .,;—-')


def build_verse_index(conn):
    """(book_he, chapter, verse) -> verse_id"""
    idx = {}
    for r in conn.execute(
            '''SELECT b.name bk, ch.number cn, v.number vn, v.id vid
               FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
               JOIN books b ON b.id=ch.book_id'''):
        idx[(r['bk'], r['cn'], r['vn'])] = r['vid']
    return idx


def refs_in(text, cur_book, vindex):
    """Resolve every verse reference in a bullet -> ordered list of verse_ids."""
    out = []
    for m in REF.finditer(text):
        bk = m.group(1) or cur_book
        ch = gem(m.group(2))
        v0 = gem(m.group(3))
        if not bk or ch < 1 or v0 < 1:
            continue
        if (bk, ch, v0) not in vindex:           # not a real verse -> not a ref
            continue
        verses = [v0]
        if m.group(4):                            # range  ch:v0-v1
            v1 = gem(m.group(4))
            if v1 > v0:
                verses += list(range(v0 + 1, v1 + 1))
        if m.group(5):                            # comma list ", v, v" (same chapter)
            for part in m.group(5).split(','):
                part = part.strip()
                if not part:
                    continue
                vn = gem(part)
                if (bk, ch, vn) in vindex:
                    verses.append(vn)
                else:
                    break                         # stop at first non-verse (prose)
        for vn in verses:
            vid = vindex.get((bk, ch, vn))
            if vid and vid not in out:
                out.append(vid)
    return out


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    vindex = build_verse_index(conn)

    cur_book, cur_parsha = None, None
    sections = []          # (parsha, book, text, [verse_ids])
    n_units = n_linked = n_links = 0

    for raw in io.open(MD, encoding='utf-8'):
        line = raw.rstrip('\n')
        ms = SEFER_HDR.match(line)
        if ms:
            cur_book = ms.group(1)
            continue
        mp = PARSHA_HDR.match(line)
        if mp:
            cur_parsha = mp.group(1).strip()
            mb = BOOK_IN_PARENS.search(line)
            if mb:
                cur_book = mb.group(1)
            continue
        mbul = BULLET.match(line)
        if not mbul:
            continue
        body = mbul.group(1)
        vids = refs_in(body, cur_book, vindex)
        text = clean(body)
        if not text:
            continue
        n_units += 1
        if vids:
            n_linked += 1
            n_links += len(vids)
        sections.append((cur_parsha, cur_book, text, vids))

    print('bullets parsed        : %d' % n_units)
    print('bullets with verse ref: %d' % n_linked)
    print('total verse links     : %d' % n_links)
    print('bullets WITHOUT a ref : %d  (kept, shown at chapter/parsha level)'
          % (n_units - n_linked))
    print('\n--- sample links ---')
    shown = 0
    rev = {v: k for k, v in vindex.items()}
    for parsha, book, text, vids in sections:
        if vids and shown < 6:
            refs = ', '.join('%s %d:%d' % rev[v] for v in vids[:4])
            print('  [%s] (%s)  %s' % (parsha, refs, text[:60]))
            shown += 1

    if not APPLY:
        print('\n[dry-run] re-run with --apply to write the eyalk_* tables.')
        conn.close()
        return

    bak = DB + '.bak_eyalk'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak)
        print('backed up ->', bak)
    cur = conn.cursor()
    cur.execute('DROP TABLE IF EXISTS eyalk_verse_links')
    cur.execute('DROP TABLE IF EXISTS eyalk_sections')
    cur.execute('''CREATE TABLE eyalk_sections
                   (id INTEGER PRIMARY KEY, parsha TEXT, book TEXT,
                    ord INTEGER, text TEXT)''')
    cur.execute('''CREATE TABLE eyalk_verse_links
                   (id INTEGER PRIMARY KEY, verse_id INTEGER, section_id INTEGER)''')
    for i, (parsha, book, text, vids) in enumerate(sections):
        cur.execute('INSERT INTO eyalk_sections (parsha, book, ord, text) VALUES (?,?,?,?)',
                    (parsha, book, i, text))
        sid = cur.lastrowid
        for vid in vids:
            cur.execute('INSERT INTO eyalk_verse_links (verse_id, section_id) VALUES (?,?)',
                        (vid, sid))
    conn.commit()
    print('\nwrote eyalk_sections=%d  eyalk_verse_links=%d'
          % (conn.execute('SELECT COUNT(*) FROM eyalk_sections').fetchone()[0],
             conn.execute('SELECT COUNT(*) FROM eyalk_verse_links').fetchone()[0]))
    conn.close()


if __name__ == '__main__':
    main()
