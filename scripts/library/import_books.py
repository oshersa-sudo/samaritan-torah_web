# -*- coding: utf-8 -*-
"""Load the two translated studies into torah.db as standalone library books.

Both are the owner's own Hebrew translations of public-domain scholarship:
  · Leopold Wreschner, *Samaritanische Traditionen*, Halle 1888 (doctoral thesis)
  · Naftali Cohen, the Zaraath laws after the Kitāb al-Kāfī, 1899
Neither is a verse commentary, so — like the Asatir — they get a `_sections`
table and no `_verse_links`; nothing in the Torah text is touched.
"""
import io, json, re, sqlite3, sys

sys.stdout.reconfigure(encoding='utf-8')
DB = 'data/torah.db'

# ── Wreschner: the printed pages grouped into the parts the author argues in ──
WRESCHNER_PARTS = [
    ('שער והקדשה',                        ['שער המהדורה', 'עמוד שער', 'עמוד הקדשה']),
    ('מבוא · לתולדות החוק הדתי אצל השומרונים', ['V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI',
                                            'XII', 'XIII', 'XIV', 'XV', 'XVI']),
    ('מבוא · מנג׳ה בן צדקה וחיבוריו',      ['XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII',
                                            'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX',
                                            'XXX', 'XXXI', 'XXXII', 'XXXIII', 'XXXIV', 'XXXV',
                                            'XXXVI', 'XXXVII', 'XXXVIII']),
    ('חלק שני · פתיחה',                    ['חלק שני']),
    ('פרק IV · על קרבן הפסח',              [str(i) for i in range(1, 12)]),
    ('פרק V · על השבת',                    [str(i) for i in range(12, 25)]),
    ('על ״ערב״ ועל ״בין הערביים״',          [str(i) for i in range(25, 30)]),
    ('על הנידה, הזבה והיולדת',              [str(i) for i in range(30, 39)]),
    ('קורות חיים והודעה',                   ['VITA', 'הודעה']),
]

def wreschner_rows():
    secs = json.load(io.open('data/library/wreschner1888.json', encoding='utf-8'))
    page_of = {}
    for i, (title, pages) in enumerate(WRESCHNER_PARTS, 1):
        for p in pages:
            page_of[p] = (i, title)
    rows, ordn, unplaced = [], {}, []
    for s in secs:
        page = s['title'].replace('עמוד', '').strip() or s['title']
        hit = page_of.get(page) or page_of.get(s['title'])
        if not hit:
            unplaced.append(s['title']); continue
        chap, ctitle = hit
        ref = s['title'] if s['title'].startswith('עמוד') else s['title']
        pending = ''
        for b in s['body']:
            if b.startswith('##'):
                pending = b[2:]
                continue
            ordn[chap] = ordn.get(chap, 0) + 1
            rows.append((chap, ctitle, ordn[chap], ref, pending, b))
            pending = ''
        if pending:                                   # a heading that closes a page
            ordn[chap] = ordn.get(chap, 0) + 1
            rows.append((chap, ctitle, ordn[chap], ref, pending, ''))
    if unplaced:
        print('  לא שובצו:', unplaced)
    return rows

def _renumber(rows):
    """Drop chapters that ended up empty and close the gaps in the numbering.

    A bodyless H1 in Cohen is a part title ("מבוא", "ב. על הפרק העוסק בצרעת")
    rather than a chapter of its own, so it is folded into the chapter it heads.
    """
    used = sorted({r[0] for r in rows})
    titles = {}
    for r in rows:
        titles.setdefault(r[0], r[1])
    remap, out = {c: i + 1 for i, c in enumerate(used)}, []
    for chap, ctitle, ordn, ref, title, text in rows:
        out.append((remap[chap], titles[chap], ordn, ref, title, text))
    return out


def cohen_rows():
    secs = json.load(io.open('data/library/cohen1899.json', encoding='utf-8'))
    rows, chap, ctitle, ordn, ref, pending = [], 0, '', 0, '', ''
    carry = ''
    for s in secs:
        if s['level'] == 1 or chap == 0:
            if chap and not any(r[0] == chap for r in rows):
                carry = (carry + ' · ' if carry else '') + ctitle   # a part title
                chap -= 1
            chap += 1
            ctitle = (carry + ' · ' + s['title']) if carry else s['title']
            carry = ''
            ordn = 0; ref = ''
        else:
            pending = s['title']                      # an H2 heads the next paragraph
        for b in s['body']:
            if b.startswith('§'):
                ref = b[1:].strip(); continue
            if b.startswith('##'):
                pending = b[2:]; continue
            txt = b[1:].strip() if b.startswith('>') else b
            ordn += 1
            rows.append((chap, ctitle, ordn, ref, pending, txt))
            pending = ''
        if pending:
            ordn += 1
            rows.append((chap, ctitle, ordn, ref, pending, ''))
            pending = ''
    return rows

def load(conn, table, rows):
    conn.execute('DROP TABLE IF EXISTS %s' % table)
    conn.execute("""CREATE TABLE %s (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chap INTEGER, chap_title TEXT, ord INTEGER,
        ref TEXT, title TEXT, text TEXT)""" % table)
    conn.executemany('INSERT INTO %s (chap,chap_title,ord,ref,title,text) '
                     'VALUES (?,?,?,?,?,?)' % table, rows)
    conn.execute('CREATE INDEX ix_%s_chap ON %s(chap, ord)' % (table, table))

if __name__ == '__main__':
    conn = sqlite3.connect(DB)
    for table, fn in (('wreschner_sections', wreschner_rows), ('cohen_sections', cohen_rows)):
        rows = _renumber(fn())
        load(conn, table, rows)
        chaps = sorted({(r[0], r[1]) for r in rows})
        print('%-20s %4d פסקאות · %d פרקים' % (table, len(rows), len(chaps)))
        for c, t in chaps:
            print('   %2d. %-42s %3d' % (c, t[:42], sum(1 for r in rows if r[0] == c)))
    conn.commit(); conn.close()
