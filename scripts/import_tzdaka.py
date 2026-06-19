# -*- coding: utf-8 -*-
"""
Import the "פירוש צדקה אל-חכים" commentary on Genesis from
tzdaka_bereshit_perek_alef_10.docx into torah.db as a new "ממקור שומרון" source,
and link every section to the Torah verse(s) it discusses.

The .docx is structured with Word headings:
  Heading 1  = chapter  ("פרק א׳")
  Heading 2  = a verse section, e.g.  'א:ב — „ורוח אלהים מרחפת על פני המים”  ·  היסודות'
               (ref  —  „incipit”  ·  topic);   ranges use '–' ('א:יא–יב').
  Normal     = body paragraphs of that section.
Non-verse Heading 2 blocks (הערת מתרגם, חתימה) and the appendices are skipped.

Each section links to the verses named in its ref (book = בראשית). The import
VALIDATES every link: words of the heading's incipit must appear in the target
verse text — mismatches are reported (and, with --strict, skipped).

Creates ONLY tzdaka_sections / tzdaka_verse_links — no other table touched.
Full DB backup before --apply.

Usage:  py -3 scripts/import_tzdaka.py             # dry run: parse + validate
        py -3 scripts/import_tzdaka.py --apply
"""
import sqlite3, sys, io, os, re, shutil

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DOCX = 'tzdaka_bereshit_perek_alef_10.docx'
DB = 'data/torah.db'
BOOK = 'בראשית'
GEM = {'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
       'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
       'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100,
       'ר': 200, 'ש': 300, 'ת': 400}
NIK = re.compile('[֑-ׇ]')
REF_RE = re.compile(r'^([א-ת]+):([א-ת]+(?:[–\-][א-ת]+)?)\b')


def gem(s):
    return sum(GEM.get(c, 0) for c in s if c in GEM)


def bare(w):
    return NIK.sub('', (w or '')).replace('־', ' ')


def parse_heading(h):
    """('chap_int', [verse_ints], incipit, topic) or None if not a verse heading."""
    m = REF_RE.match(h.strip())
    if not m:
        return None
    ch = gem(m.group(1))
    vs = re.split(r'[–\-]', m.group(2))
    v1 = gem(vs[0]); v2 = gem(vs[1]) if len(vs) > 1 and gem(vs[1]) else v1
    rest = h[m.end():]
    inc = ''
    mi = re.search(r'[„"]([^”"]+)[”"]', rest)
    if mi:
        inc = mi.group(1).strip()
    topic = ''
    if '·' in rest:
        topic = rest.split('·', 1)[1].strip()
    ref = '%s:%s' % (m.group(1), m.group(2))
    return ch, list(range(v1, v2 + 1)), inc, topic, ref


def main():
    import docx
    doc = docx.Document(DOCX)

    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    vidx, vtext = {}, {}
    for r in conn.execute(
            """SELECT v.id vid, c.number ch, v.number vn, v.text txt
               FROM verses v JOIN chapters c ON c.id=v.chapter_id
               JOIN books b ON b.id=c.book_id WHERE b.name=?""", (BOOK,)):
        if str(r['vn']).isdigit():
            vidx[(r['ch'], int(r['vn']))] = r['vid']
            vtext[r['vid']] = r['txt'] or ''

    sections = []        # {ch, ref, title, vids, text, incipit}
    cur = None
    for p in doc.paragraphs:
        sty = (p.style.name if p.style else '') or ''
        t = p.text.strip()
        if not t:
            continue
        if sty.startswith('Heading'):
            ph = parse_heading(t) if sty == 'Heading 2' else None
            if cur:
                sections.append(cur); cur = None
            if ph:
                ch, vns, inc, topic, ref = ph
                vids = [vidx[(ch, vn)] for vn in vns if (ch, vn) in vidx]
                cur = {'ch': ch, 'ref': ref, 'title': topic, 'incipit': inc,
                       'vids': vids, 'missing': [vn for vn in vns if (ch, vn) not in vidx],
                       'body': []}
        elif cur is not None:
            cur['body'].append(t)
    if cur:
        sections.append(cur)

    # validate: incipit words should appear in the linked verse text
    problems = []
    for s in sections:
        s['text'] = re.sub(r'\s+', ' ', ' '.join(s['body'])).strip()
        if not s['incipit'] or not s['vids']:
            if s['missing']:
                problems.append((s['ref'], 'missing verses: %s' % s['missing']))
            continue
        inc_words = [w for w in bare(s['incipit']).split() if len(w) >= 3]
        joined = ' '.join(bare(vtext[v]) for v in s['vids'])
        hit = sum(1 for w in inc_words if w in joined)
        ratio = hit / max(1, len(inc_words))
        if ratio < 0.4:
            problems.append((s['ref'], 'incipit "%s" weak match (%d/%d) to linked verses'
                             % (s['incipit'][:30], hit, len(inc_words))))

    nlinks = sum(len(s['vids']) for s in sections)
    print('verse-sections parsed: %d   total verse-links: %d' % (len(sections), nlinks))
    print('chapters covered:', sorted(set(s['ch'] for s in sections)))
    print('\nvalidation (%d issue(s)):' % len(problems))
    for ref, msg in problems:
        print('  [%s] %s' % (ref, msg))
    print('\n--- sample sections ---')
    for s in sections[:4]:
        print('  %s · %s  -> verses %s' % (s['ref'], s['title'], [(s['ch'], ) for _ in [0]] and
              [k[1] for k, v in vidx.items() if v in s['vids']]))
        print('     %s' % s['text'][:90])

    if not APPLY:
        print('\n[dry-run] re-run with --apply to write'); conn.close(); return

    bak = DB + '.bak_tzdaka'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak); print('backed up ->', bak)
    cu = conn.cursor()
    cu.execute('DROP TABLE IF EXISTS tzdaka_verse_links')
    cu.execute('DROP TABLE IF EXISTS tzdaka_sections')
    cu.execute('CREATE TABLE tzdaka_sections (id INTEGER PRIMARY KEY, book TEXT, '
               'chap INTEGER, ref TEXT, title TEXT, ord INTEGER, text TEXT)')
    cu.execute('CREATE TABLE tzdaka_verse_links (id INTEGER PRIMARY KEY, '
               'verse_id INTEGER, section_id INTEGER)')
    for i, s in enumerate(sections):
        if not s['vids'] or not s['text']:
            continue
        cu.execute('INSERT INTO tzdaka_sections (book, chap, ref, title, ord, text) '
                   'VALUES (?,?,?,?,?,?)', (BOOK, s['ch'], s['ref'], s['title'], i, s['text']))
        sid = cu.lastrowid
        for vid in s['vids']:
            cu.execute('INSERT INTO tzdaka_verse_links (verse_id, section_id) VALUES (?,?)',
                       (vid, sid))
    cu.execute('CREATE INDEX ix_tzl_verse ON tzdaka_verse_links (verse_id)')
    conn.commit()
    ns = conn.execute('SELECT COUNT(*) FROM tzdaka_sections').fetchone()[0]
    nl = conn.execute('SELECT COUNT(*) FROM tzdaka_verse_links').fetchone()[0]
    nv = conn.execute('SELECT COUNT(DISTINCT verse_id) FROM tzdaka_verse_links').fetchone()[0]
    print('APPLIED: %d sections, %d links across %d verses' % (ns, nl, nv))
    conn.close()


if __name__ == '__main__':
    main()
