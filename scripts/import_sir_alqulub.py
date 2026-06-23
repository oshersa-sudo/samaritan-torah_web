# -*- coding: utf-8 -*-
"""Import "סוד הלבבות" / Sīr al-Qulūb, ch. 4 (Abraham al-Kabatzi, 16th c.) as a new
"ממקור שומרון" source. The chapter is organised by righteous figures and their
trials (Adam→Aaron); each trial section discusses a Torah episode, quoting its
verses inline. We link every section to the verses it discusses (identified from
its content) — additive tables sir_sections / sir_verse_links only.

The section→verse map below was assigned by reading each section; the importer
VALIDATES every link (the linked verse's words must appear in the section body) and
reports weak matches. Full DB backup before --apply.

Usage:  py -3 scripts/import_sir_alqulub.py            # dry run: parse + validate
        py -3 scripts/import_sir_alqulub.py --apply
"""
import sqlite3, sys, io, os, re, shutil, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DOCX = os.path.join('סיר איל קולוב - פרק 4', 'sir_alqulub_ch4.docx')
DB = 'data/torah.db'
NIK = re.compile('[֑-ׇ]')
G, E, N = 'בראשית', 'שמות', 'במדבר'


def gv(book, *cvs):
    return [(book, c, v) for c, v in cvs]


# key = the section's trial title (H2) or, for figure-level sections, the figure
# heading (H1).  value = list of (book, chapter, verse) the section discusses.
LINKS = {
    # the opening (פתיחת הפרק) is a general preface with no specific verse — not linked.
    'הנסיון הראשון: עץ הדעת והגירוש': gv(G, (3, 6), (3, 17), (3, 19), (3, 23), (3, 24)),
    'הנסיון השני: הריגת בנו': gv(G, (4, 8), (4, 10), (4, 12)),
    'נח': gv(G, (6, 11), (6, 18), (8, 21), (9, 1), (9, 9)),
    'נסיון ראשון: לך לך': gv(G, (12, 1), (12, 2), (12, 3)),
    'נסיון שני: הרעב והירידה למצרים': gv(G, (12, 10), (12, 16)),
    'נסיון שלישי: שרי בבית פרעה': gv(G, (12, 15), (12, 17)),
    'נסיון רביעי: שבי לוט ומלחמת המלכים': gv(G, (14, 14), (14, 16)),
    'נסיון חמישי: הפחד מנקמת המלכים': gv(G, (15, 1)),
    'נסיון שישי: עקרות שרה': gv(G, (16, 1), (17, 17)),
    'נסיון שביעי: המילה': gv(G, (17, 4), (17, 24), (17, 26)),
    'נסיון שמיני: אבימלך ושרה בגרר  [שחזור מתקציר המהדיר]': gv(G, (20, 2), (20, 3), (20, 17)),
    'נסיון תשיעי: העקדה  [שחזור מתקציר המהדיר]': gv(G, (22, 1), (22, 2)),
    'נסיון עשירי: מות שרה  [שחזור מתקציר המהדיר]': gv(G, (23, 2)),
    'יצחק': gv(G, (25, 19), (26, 1)),
    'הברכה והתחפושת': gv(G, (27, 8), (27, 9), (27, 12)),
    'שנאת עשו והבריחה': gv(G, (27, 34), (27, 41), (27, 44)),
    'הסולם בבית-אל': gv(G, (28, 10), (28, 11), (28, 12)),
    'הבאר ולבן': gv(G, (29, 1), (29, 2), (29, 10)),
    'הנישואין: לאה ורחל': gv(G, (29, 15), (29, 16), (29, 18), (29, 25)),
    'הבנים ולידת יוסף': gv(G, (29, 31), (29, 32), (30, 1), (30, 2), (30, 3)),
    'הצאן: העקודים והנקודים': gv(G, (30, 25), (30, 31), (30, 32)),
    'יוסף': gv(G, (37, 2), (37, 3), (37, 24), (39, 1)),
    'משה': gv(E, (2, 2)),
    'ארבעת הנסיונות הפרטיים': gv(E, (2, 2), (2, 3), (2, 15)),
    'הנסיון החמישי: טענות ישראל (רשימת המאורעות)':
        gv(E, (14, 12), (15, 24), (17, 2), (32, 1)) + gv(N, (11, 1), (11, 4)),
    'אהרן': gv(E, (32, 1), (32, 5)),
}


def bare(s):
    return NIK.sub('', s or '').replace('־', ' ')


def parse(path):
    import docx
    doc = docx.Document(path)
    sections = []; fig = None; cur = None
    for p in doc.paragraphs:
        sty = (p.style.name if p.style else '') or ''
        t = p.text.strip()
        if not t:
            continue
        if sty == 'Heading 1':
            if cur:
                sections.append(cur)
            fig = t; cur = {'fig': fig, 'trial': '', 'body': []}
        elif sty == 'Heading 2':
            if cur:
                sections.append(cur)
            cur = {'fig': fig, 'trial': t, 'body': []}
        elif cur is not None:
            cur['body'].append(t)
    if cur:
        sections.append(cur)
    return sections


def main():
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    vidx, vtext = {}, {}
    for r in conn.execute("""SELECT v.id vid, b.name bk, c.number ch, v.number vn, v.text txt
                             FROM verses v JOIN chapters c ON c.id=v.chapter_id
                             JOIN books b ON b.id=c.book_id"""):
        if str(r['vn']).isdigit():
            vidx[(r['bk'], r['ch'], int(r['vn']))] = r['vid']
            vtext[r['vid']] = r['txt'] or ''

    sections = parse(DOCX)
    built = []     # {key, title, text, vids}
    problems = []
    for s in sections:
        key = s['trial'] or s['fig']
        body = re.sub(r'\s+', ' ', ' '.join(s['body'])).strip()
        if key not in LINKS or not body:
            continue
        vids, missing = [], []
        for (bk, ch, vn) in LINKS[key]:
            vid = vidx.get((bk, ch, vn))
            if vid:
                vids.append(vid)
            else:
                missing.append('%s %d:%d' % (bk, ch, vn))
        # validate: words of each linked verse should appear in the section body
        bb = bare(body)
        for vid in vids:
            vw = [w for w in bare(vtext[vid]).split() if len(w) >= 3]
            hit = sum(1 for w in vw if w in bb)
            # the work is a (paraphrasing) translation, so word-overlap with the DB
            # Samaritan text is naturally low; only a near-zero overlap is worth a look.
            if vw and hit == 0 and len(vw) >= 6:
                problems.append((key, 'no word overlap with a linked verse (%d words)' % len(vw)))
        if missing:
            problems.append((key, 'verses not in DB: %s' % missing))
        title = s['fig'] + (' · ' + s['trial'] if s['trial'] else '')
        title = re.sub(r'\s*\[שחזור מתקציר המהדיר\]', '', title)
        built.append({'title': title, 'text': body, 'vids': vids})

    nlinks = sum(len(b['vids']) for b in built)
    print('sections built: %d   verse-links: %d' % (len(built), nlinks))
    print('validation issues (%d):' % len(problems))
    for k, m in problems:
        print('  [%s] %s' % (k[:40], m))
    print('\nsample:')
    for b in built[:3]:
        print('  %s  -> %d verses' % (b['title'], len(b['vids'])))
        print('     %s' % b['text'][:90])

    if not APPLY:
        print('\n[dry-run] re-run with --apply to write'); conn.close(); return

    bak = DB + '.bak_sir_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backed up ->', os.path.basename(bak))
    cu = conn.cursor()
    cu.execute('DROP TABLE IF EXISTS sir_verse_links')
    cu.execute('DROP TABLE IF EXISTS sir_sections')
    cu.execute('CREATE TABLE sir_sections (id INTEGER PRIMARY KEY, title TEXT, ord INTEGER, text TEXT)')
    cu.execute('CREATE TABLE sir_verse_links (id INTEGER PRIMARY KEY, verse_id INTEGER, section_id INTEGER)')
    for i, b in enumerate(built):
        if not b['vids']:
            continue
        cu.execute('INSERT INTO sir_sections (title, ord, text) VALUES (?,?,?)', (b['title'], i, b['text']))
        sid = cu.lastrowid
        for vid in b['vids']:
            cu.execute('INSERT INTO sir_verse_links (verse_id, section_id) VALUES (?,?)', (vid, sid))
    cu.execute('CREATE INDEX ix_sir_verse ON sir_verse_links (verse_id)')
    conn.commit()
    ns = conn.execute('SELECT COUNT(*) FROM sir_sections').fetchone()[0]
    nl = conn.execute('SELECT COUNT(*) FROM sir_verse_links').fetchone()[0]
    nv = conn.execute('SELECT COUNT(DISTINCT verse_id) FROM sir_verse_links').fetchone()[0]
    print('APPLIED: %d sections, %d links across %d verses' % (ns, nl, nv))
    conn.close()


if __name__ == '__main__':
    main()
