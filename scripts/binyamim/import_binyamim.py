# -*- coding: utf-8 -*-
"""Import "הפירוש השלם" (Binyamim Tsedaka) commentary transcripts into torah.db
as a new source under "מן המסורת השומרונית".

Input: transcript markdown files (t_*.md) produced by the vision-transcription
pass over the scanned book, with the structure:
    <!-- PAGE NNN -->
    ## פרשת "..." [ויקרא, א', 1 – ה', 26]
    ### topic heading
    body...

Section = one topic under its parasha. Linking:
  1. verse refs inside the topic text like (ב', 3) / (י"א, 44) → those verses;
  2. otherwise → every verse in the parasha's declared range.

Tables (created if missing):
  binyamim_sections(id, book, parsha, title, ord, text)
  binyamim_verse_links(id, section_id, verse_id)

Usage: py -3 scripts/binyamim/import_binyamim.py <transcripts_dir> [--book ויקרא] [--apply]
       (without --apply: parse + report only, no DB writes)
"""
import glob
import io
import json
import os
import re
import sqlite3
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
APPLY = '--apply' in sys.argv
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
TDIR = ARGS[0] if ARGS else '.'
BOOK = 'ויקרא'
if '--book' in sys.argv:
    BOOK = sys.argv[sys.argv.index('--book') + 1]

GEM = {'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
       'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80,
       'צ': 90, 'ק': 100}


def gem2int(s):
    s = re.sub(r"[\'\"״׳]", '', s or '').strip()
    v = sum(GEM.get(ch, 0) for ch in s)
    return v or None


# parasha range: [ויקרא, א', 1 – ה', 26]  (hyphen may vary; commas optional)
RANGE_RE = re.compile(
    r'\[\s*' + BOOK + r'\s*,?\s*([א-ת"\'׳״]+)\s*,?\s*(\d+)\s*[–\-—]\s*([א-ת"\'׳״]+)\s*,?\s*(\d+)\s*\]')
# verse refs live inside SQUARE brackets: [כה', 4] / [ד', 22-26] / ["lemma" – ה', 17]
# (comma after the chapter is optional: [יג' 55]). Brackets naming another book
# (or the parasha-range brackets, which name ויקרא) are skipped.
BRACKET_RE = re.compile(r'\[[^\]\[]{1,120}\]')
INREF_RE = re.compile(r"([א-ת]{1,3})['׳]\s*,?\s*(\d+)(?:\s*-\s*(\d+))?")
OTHER_BOOKS = ('בראשית', 'שמות', 'במדבר', 'דברים', 'ויקרא')


def text_refs(text, idx):
    """verse_ids referenced inside a section's text via [chapter', verse] refs."""
    out = set()
    for bm in BRACKET_RE.finditer(text):
        b = bm.group(0)
        if any(bk in b for bk in OTHER_BOOKS):
            continue                      # other-book ref or a parasha-range bracket
        for m in INREF_RE.finditer(b):
            ch = gem2int(m.group(1))
            if not ch:
                continue
            v1 = int(m.group(2))
            v2 = int(m.group(3)) if m.group(3) else v1
            for vn in range(v1, v2 + 1):
                if (ch, vn) in idx:
                    out.add(idx[(ch, vn)])
    return out


def load_verse_index(conn):
    """(std_chapter, verse_number_int) -> verse_id, for BOOK."""
    idx = {}
    for r in conn.execute(
            """SELECT v.id vid, c.number ch, v.number vn FROM verses v
               JOIN chapters c ON c.id=v.chapter_id
               JOIN books b ON b.id=c.book_id WHERE b.name=?""", (BOOK,)):
        try:
            idx[(r[1], int(str(r[2]).split('-')[0]))] = r[0]
        except ValueError:
            pass
    return idx


def range_verses(idx, c1, v1, c2, v2):
    out = []
    for (ch, vn), vid in idx.items():
        if (ch, vn) >= (c1, v1) and (ch, vn) <= (c2, v2):
            out.append(vid)
    return out


def parse(files):
    """-> list of sections: {parsha, range:(c1,v1,c2,v2)|None, title, text}"""
    sections = []
    cur_parsha, cur_range = None, None
    cur = None

    def flush():
        nonlocal cur
        if cur and cur['text'].strip():
            cur['text'] = re.sub(r'\n{3,}', '\n\n', cur['text']).strip()
            sections.append(cur)
        cur = None

    for fn in files:
        for line in io.open(fn, encoding='utf-8'):
            line = line.rstrip('\n')
            if line.startswith('<!--'):
                continue
            m = re.match(r'^##\s+(.*)$', line)
            if m and not line.startswith('###'):
                flush()
                head = m.group(1).strip()
                rm = RANGE_RE.search(head)
                cur_range = tuple(
                    [gem2int(rm.group(1)), int(rm.group(2)),
                     gem2int(rm.group(3)), int(rm.group(4))]) if rm else None
                cur_parsha = RANGE_RE.sub('', head).strip().strip('"').strip()
                cur = {'parsha': cur_parsha, 'range': cur_range,
                       'title': 'הפרשה', 'text': ''}
                continue
            m = re.match(r'^###\s+(.*)$', line)
            if m:
                flush()
                cur = {'parsha': cur_parsha, 'range': cur_range,
                       'title': m.group(1).strip(), 'text': ''}
                continue
            if cur is None:
                # front matter before the first parasha header
                cur = {'parsha': None, 'range': None, 'title': 'פתיחה', 'text': ''}
            cur['text'] += line + '\n'
    flush()
    return sections


def main():
    files = sorted(glob.glob(os.path.join(TDIR, 't_*.md')))
    if not files:
        print('no t_*.md transcripts in', TDIR)
        return
    print('transcripts:', [os.path.basename(f) for f in files])
    sections = parse(files)
    conn = sqlite3.connect(DB)
    idx = load_verse_index(conn)

    linked, unlinked, report = 0, 0, []
    plan = []
    for i, s in enumerate(sections):
        refs = text_refs(s['text'], idx)
        via = 'refs'
        if not refs and s['range']:
            refs = set(range_verses(idx, *s['range']))
            via = 'range'
        if refs:
            linked += 1
        else:
            unlinked += 1
            via = 'NONE'
        plan.append((s, sorted(refs)))
        report.append({'parsha': s['parsha'], 'title': s['title'],
                       'chars': len(s['text']), 'verses': len(refs), 'via': via})

    print('sections: %d | linked: %d (%d by inline refs) | unlinked: %d'
          % (len(sections), linked,
             sum(1 for r in report if r['via'] == 'refs'), unlinked))
    for r in report:
        print('  %-22s | %-30s | %5d chars | %3d verses (%s)'
              % ((r['parsha'] or '—')[:22], r['title'][:30], r['chars'],
                 r['verses'], r['via']))
    json.dump(report, open('data/binyamim_import_report.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    if not APPLY:
        print('\n(dry-run; use --apply to write)')
        return
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS binyamim_sections
            (id INTEGER PRIMARY KEY, book TEXT, parsha TEXT, title TEXT,
             ord INTEGER, text TEXT);
        CREATE TABLE IF NOT EXISTS binyamim_verse_links
            (id INTEGER PRIMARY KEY, section_id INTEGER, verse_id INTEGER);
        CREATE INDEX IF NOT EXISTS idx_binyamim_links_verse
            ON binyamim_verse_links(verse_id);
    """)
    conn.execute('DELETE FROM binyamim_verse_links WHERE section_id IN '
                 '(SELECT id FROM binyamim_sections WHERE book=?)', (BOOK,))
    conn.execute('DELETE FROM binyamim_sections WHERE book=?', (BOOK,))
    for i, (s, vids) in enumerate(plan):
        cur = conn.execute(
            'INSERT INTO binyamim_sections (book, parsha, title, ord, text) '
            'VALUES (?,?,?,?,?)',
            (BOOK, s['parsha'] or '', s['title'], i, s['text']))
        sid = cur.lastrowid
        conn.executemany(
            'INSERT INTO binyamim_verse_links (section_id, verse_id) VALUES (?,?)',
            [(sid, v) for v in vids])
    conn.commit()
    n = conn.execute('SELECT COUNT(*) FROM binyamim_sections').fetchone()[0]
    nl = conn.execute('SELECT COUNT(*) FROM binyamim_verse_links').fetchone()[0]
    print('\nAPPLIED: %d sections, %d verse links now in DB' % (n, nl))


if __name__ == '__main__':
    main()
