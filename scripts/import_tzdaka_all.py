# -*- coding: utf-8 -*-
"""Rebuild the "פירוש צדקה אל-חכים" commentary (tzdaka_sections / tzdaka_verse_links)
from the full set of manuscript docx files, extending coverage beyond Gen 1–6.

Sources, in priority order (later file wins on a duplicate ref):
  1. tzdaka_bereshit_alef_bet_39.docx        — chapters 1–10 (supersedes the old
                                               perek_alef_10 import; its 1–6 == it)
  2. tzdaka_bereshit_yod-bet_yod-chet.docx   — chapters 12–18 (… up to 18:20)
  3. tzdaka_bereshit_18-20.docx              — 18:20 → 20 (headingless: ref-lines
                                               appear as ordinary paragraphs)
(yod-bet_yod-zayin_1.docx is a 12–17 subset of #2 and is intentionally skipped.)

Section format (same as the original importer):
  Heading 2 / ref-line:  'א:ב — „incipit” · topic'  (ranges use '–'; numerals may
                         carry gershayim/geresh, e.g. 'י״ב:א–ג', 'י״ח:כ״ג').
  Body = the paragraphs until the next section.
Headings that aren't verse refs (פרק…, הערת מתרגם) close the current section;
once a 'נספח'/appendix heading is reached the file is no longer scanned.

Each section links to the verses in its ref (book בראשית). The incipit is validated
against the linked verse text. Rebuilds ONLY the two tzdaka tables; full DB backup
before --apply.

Usage:  py -3 scripts/import_tzdaka_all.py            # dry run
        py -3 scripts/import_tzdaka_all.py --apply
"""
import sqlite3, sys, io, os, re, shutil, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DB = 'data/torah.db'
BOOK = 'בראשית'
FILES = ['tzdaka_bereshit_alef_bet_39.docx',
         'tzdaka_bereshit_yod-bet_yod-chet.docx',
         'tzdaka_bereshit_18-20.docx']

GEM = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,
       'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,'ס':60,'ע':70,'פ':80,'ף':80,
       'צ':90,'ץ':90,'ק':100,'ר':200,'ש':300,'ת':400}
NIK = re.compile('[֑-ׇ]')
NUM = r'[א-ת]+(?:[״׳][א-ת]*)*'                       # numeral, gershayim/geresh ok
REF_RE = re.compile(r'^(%s)\s*:\s*(%s(?:[–\-]%s)?)' % (NUM, NUM, NUM))
# a standalone ref-line in a headingless file: ref + separator (· or —) + incipit
LINE_RE = re.compile(r'^(%s)\s*:\s*(%s(?:[–\-]%s)?)\s*[·—]\s*[„"]' % (NUM, NUM, NUM))


def gem(s):
    return sum(GEM.get(c, 0) for c in s)


def bare(w):
    return NIK.sub('', (w or '')).replace('־', ' ')


def parse_ref(h):
    """('chap', [verse_ints], incipit, topic, ref) from a heading/ref-line, or None."""
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
    topic = rest.split('·', 1)[1].strip() if '·' in rest else ''
    ref = '%s:%s' % (m.group(1), m.group(2))
    return ch, list(range(v1, v2 + 1)), inc, topic, ref


def parse_file(path, vidx):
    """Yield section dicts from one docx (heading-based or headingless)."""
    import docx
    doc = docx.Document(path)
    sections = []
    cur = None
    for p in doc.paragraphs:
        sty = (p.style.name if p.style else '') or ''
        t = p.text.strip()
        if not t:
            continue
        if t.startswith('נספח') and sty.startswith('Heading'):
            break             # the נספח א׳/ב׳ appendices — stop (NOT 'מסה נספחת')
        is_ref = None
        if sty == 'Heading 2':
            is_ref = parse_ref(t)
        elif LINE_RE.match(t):                       # headingless ref-line
            is_ref = parse_ref(t)
        if sty.startswith('Heading') or is_ref:
            if cur:
                sections.append(cur); cur = None
            if is_ref:
                ch, vns, inc, topic, ref = is_ref
                vids = [vidx[(ch, vn)] for vn in vns if (ch, vn) in vidx]
                cur = {'ch': ch, 'ref': ref, 'title': topic, 'incipit': inc,
                       'vids': vids, 'missing': [vn for vn in vns if (ch, vn) not in vidx],
                       'body': []}
        elif cur is not None:
            cur['body'].append(t)
    if cur:
        sections.append(cur)
    return sections


def main():
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    vidx, vtext = {}, {}
    for r in conn.execute(
            """SELECT v.id vid, c.number ch, v.number vn, v.text txt
               FROM verses v JOIN chapters c ON c.id=v.chapter_id
               JOIN books b ON b.id=c.book_id WHERE b.name=?""", (BOOK,)):
        if str(r['vn']).isdigit():
            vidx[(r['ch'], int(r['vn']))] = r['vid']
            vtext[r['vid']] = r['txt'] or ''

    # gather sections. A ref may legitimately repeat WITHIN a file (two distinct
    # comments on the same verse — keep both). Across files the same ref is the same
    # passage in another edition — the LATER file replaces the earlier (e.g. 18:20:
    # file #3's brief note is replaced by file #1's dedicated treatment).
    final = {}          # ref -> list[section]  (from the last file that defines it)
    order = []
    for f in FILES:
        if not os.path.exists(f):
            print('MISSING file:', f); continue
        secs = parse_file(f, vidx)
        print('%-42s -> %d sections (chapters %s)'
              % (f, len(secs), sorted(set(s['ch'] for s in secs))))
        grouped = {}
        for s in secs:
            s['text'] = re.sub(r'\s+', ' ', ' '.join(s['body'])).strip()
            grouped.setdefault(s['ref'], []).append(s)
        for ref, slist in grouped.items():
            if ref not in final:
                order.append(ref)
            final[ref] = slist           # last file wins; within-file keeps all
    sections = [s for ref in order for s in final[ref]]

    # validate incipit against linked verse text
    problems = []
    for s in sections:
        if not s['incipit'] or not s['vids']:
            if s['missing']:
                problems.append((s['ref'], 'missing verses %s' % s['missing']))
            continue
        iw = [w for w in bare(s['incipit']).split() if len(w) >= 3]
        joined = ' '.join(bare(vtext[v]) for v in s['vids'])
        hit = sum(1 for w in iw if w in joined)
        if hit / max(1, len(iw)) < 0.4:
            problems.append((s['ref'], 'incipit "%s" weak match (%d/%d)'
                             % (s['incipit'][:28], hit, len(iw))))

    nlinks = sum(len(s['vids']) for s in sections)
    print('\nTOTAL sections: %d   verse-links: %d   chapters: %s'
          % (len(sections), nlinks, sorted(set(s['ch'] for s in sections))))
    print('validation issues (%d):' % len(problems))
    for ref, msg in problems:
        print('  [%s] %s' % (ref, msg))
    print('\nsample (new chapters):')
    for s in sections:
        if s['ch'] >= 12:
            print('  %s · %s' % (s['ref'], s['title'][:40]))
            print('     %s' % s['text'][:90])
            if s['ch'] >= 13:
                break

    if not APPLY:
        print('\n[dry-run] re-run with --apply to write'); conn.close(); return

    bak = DB + '.bak_tzdaka_all_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backed up ->', os.path.basename(bak))
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
