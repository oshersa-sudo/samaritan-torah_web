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


# parasha range: [ויקרא, א', 1 – ה', 26]. Printed variants covered: an alias
# prefix before the book name (ואלה שמות), the words פרק/פרקים, a letter suffix
# on a verse number (21ב'), and a same-chapter range with no second chapter
# ([שמות, כ', 1 - 23]). Hyphen may vary; commas optional.
_VN = r"(\d+)(?:[א-ת]['׳]?)?"
RANGE_RE = re.compile(
    r'\[\s*(?:[א-ת]+\s+)?' + BOOK + r'\s*,?\s*(?:פרקים|פרק)?\s*'
    r'([א-ת"\'׳״]+)\s*,?\s*' + _VN +
    r'\s*,?\s*[–\-—]\s*(?:([א-ת"\'׳״]+)\s*,?\s*)?' + _VN + r'\s*\]')
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


def load_verse_texts(conn):
    """[(std_chapter, verse_id, normalized_text)] for BOOK — for title matching."""
    out = []
    for r in conn.execute(
            """SELECT v.id vid, c.number ch, v.text t FROM verses v
               JOIN chapters c ON c.id=v.chapter_id
               JOIN books b ON b.id=c.book_id WHERE b.name=?""", (BOOK,)):
        out.append((r[1], r[0], _norm(r[2])))
    return out


def _norm(s):
    """Bare Hebrew words only — strips punctuation/quotes so a section title can be
    substring-matched against verse text regardless of stop marks."""
    return ' '.join(re.findall(r'[א-ת]+', s or ''))


def title_chapter_verses(title, vtexts, idx, prange):
    """The user's rule: a section titled with a verse phrase (e.g. "וראיתן על
    האבנים") belongs to the CHAPTER containing that phrase. Try the full
    normalized title, then its first 4/3/2 words; prefer a hit inside the
    section's parasha range. Returns the verse-ids of the matched chapter."""
    words = _norm(title).split()
    if len(words) < 2:
        return []
    for take in (len(words), 4, 3, 2):
        if take > len(words):
            continue
        phrase = ' '.join(words[:take])
        if len(phrase) < 7:                    # too short → false positives
            continue
        hits = [(ch, vid) for ch, vid, t in vtexts if phrase in t]
        if not hits:
            continue
        chapters = sorted({ch for ch, _ in hits})
        if prange:
            inr = [ch for ch in chapters if prange[0] <= ch <= prange[2]]
            if inr:
                chapters = inr
        ch = chapters[0]
        return [vid for (c, vn), vid in idx.items() if c == ch]
    return []


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
            if re.match(r'^#\s+', line):     # single-# part titles are decoration only
                continue
            m = re.match(r'^##\s+(.*)$', line)
            if m and not line.startswith('###'):
                flush()
                head = m.group(1).strip()
                rm = RANGE_RE.search(head)
                if rm is None:
                    # an un-ranged ## is a decorative part title, not a new parasha:
                    # keep it as a topic inside the current parasha so its sections
                    # stay linked to that parasha's range
                    cur = {'parsha': cur_parsha, 'range': cur_range,
                           'title': re.sub(r'["״]', '', head).strip().rstrip(':'), 'text': ''}
                    continue
                cur_range = (gem2int(rm.group(1)), int(rm.group(2)),
                             gem2int(rm.group(3)) if rm.group(3) else gem2int(rm.group(1)),
                             int(rm.group(4)))
                cur_parsha = re.sub(r'["״]', '', RANGE_RE.sub('', head)).strip().rstrip(':').strip()
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


# declared parasha ranges (from the printed headers) — used by --relink, where
# sections come from the DB (which stores only the parasha NAME)
PARSHA_RANGES = {
    'ויקרא': {
        'פרשת ויקרא אל משה': (1, 1, 5, 26),
        'פרשת צוי את אהרן ואת בניו': (6, 1, 9, 21),
        'פרשת וישא אהרן': (9, 22, 13, 28),
        'פרשת ואיש או אשה': (13, 29, 15, 33),
        'פרשת אחרי מות שני בני אהרן': (16, 1, 19, 8),
        'פרשת ובקצרכם': (19, 9, 22, 33),
        'פרשת מועדי': (23, 1, 26, 2),
        'פרשת אם בחקותי': (26, 3, 27, 34),
    },
    'בראשית': {
        'פרשת בראשית': (1, 1, 3, 24),
        'פרשת והאדם ידע': (4, 1, 4, 24),
        'פרשת וידע אדם': (4, 25, 6, 16),
        'פרשת ואני הנני': (6, 17, 8, 21),
        "פרשת ויאמר ה' אל לבו": (8, 21, 11, 32),
        'פרשת לך לך מארצך': (12, 1, 14, 24),
        'פרשת ויהי אברם בן תשעים ותשע שנים': (17, 1, 20, 18),
        "פרשת וה' פקד את שרה": (21, 1, 21, 34),
        'פרשת ויהוה פקד את שרה': (21, 1, 23, 20),
        'פרשת ואברהם זקן בא בימים': (24, 1, 25, 18),
        'פרשת ואלה תולדת יצחק בן אברהם': (25, 19, 28, 22),
        'פרשת וישא יעקב רגליו': (29, 1, 29, 30),
        'יעקב אבי השנים-עשר': (29, 31, 31, 16),
        'פרשת ויקם יעקב': (31, 17, 33, 20),
        'פרשת ותצא דינה': (34, 1, 36, 43),
        'פרשת וישב יעקב': (37, 1, 38, 30),
        'פרשת ויוסף הורד מצרימה': (39, 1, 43, 25),
        'פרשת וליוסף ילדו': (41, 50, 43, 25),
        'פרשת ויבא יוסף הביתה': (43, 26, 48, 2),
        'פרשת ואלה שמות': (46, 8, 48, 2),
        'פרשת אל שדי': (48, 3, 49, 21),
        'פרשת בן פרת': (49, 22, 50, 26),
    },
    'במדבר': {
        'פרשת במדבר סיני': (1, 1, 3, 51),
        'פרשת נשא את ראש בני קהת': (4, 1, 6, 21),
        'פרשת דבר אל אהרן ואל בניו': (6, 22, 12, 16),
        'פרשת שלח לך אנשים': (13, 1, 15, 41),
        'פרשת ויקח קרח': (16, 1, 17, 28),
        'פרשת וישלח משה מלאכים': (20, 14, 25, 9),
        'פרשת פינחס': (25, 11, 31, 31),
        'פרשת ויהי המלקח': (31, 32, 36, 12),
    },
    'שמות': {
        'פרשת ואלה שמות': (1, 1, 3, 12),
        'פרשת ואל אהרן': (12, 1, 15, 21),
        'שירת הים': (15, 1, 15, 21),
        'פרשת ויסע משה': (15, 22, 18, 22),
        'פרשת בחדש השלישי': (19, 1, 24, 18),
        'עשרת הדברים': (20, 1, 20, 23),
        'אלה המשפטים ועליית משה לקבלת התורה והמצווה': (21, 1, 24, 18),
        'פרשת ויקחו לי תרומה': (25, 1, 28, 43),
        'פרשת וזה הדבר': (29, 1, 31, 17),
        'פרשת ויתן אל משה': (31, 18, 36, 19),
        'פרשת ויעש את הקרשים': (36, 20, 40, 38),
    },
}


def relink():
    """Recompute binyamim_verse_links for BOOK from the sections already in the
    DB (texts untouched), using the refs → title → range priority."""
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    idx = load_verse_index(conn)
    vtexts = load_verse_texts(conn)
    ranges = PARSHA_RANGES.get(BOOK, {})
    stats = {'refs': 0, 'title': 0, 'range': 0, 'none': 0}
    rows = conn.execute('SELECT id, parsha, title, text FROM binyamim_sections '
                        'WHERE book=? ORDER BY ord', (BOOK,)).fetchall()
    for s in rows:
        prange = ranges.get(s['parsha'])
        refs = text_refs(s['text'], idx)
        via = 'refs'
        if not refs:
            refs = set(title_chapter_verses(s['title'], vtexts, idx, prange))
            via = 'title'
        if not refs and prange:
            refs = set(range_verses(idx, *prange))
            via = 'range'
        if not refs:
            via = 'none'
        stats[via] += 1
        if APPLY:
            conn.execute('DELETE FROM binyamim_verse_links WHERE section_id=?', (s['id'],))
            conn.executemany('INSERT INTO binyamim_verse_links (section_id, verse_id) '
                             'VALUES (?,?)', [(s['id'], v) for v in sorted(refs)])
        print('  %-34s | %-28s -> %3d verses (%s)'
              % ((s['parsha'] or '—')[:34], s['title'][:28], len(refs), via))
    if APPLY:
        conn.commit()
    n = conn.execute('SELECT COUNT(*) FROM binyamim_verse_links l JOIN binyamim_sections s '
                     'ON s.id=l.section_id WHERE s.book=?', (BOOK,)).fetchone()[0]
    print('link mix:', stats, '| total links for %s: %d %s'
          % (BOOK, n, '' if APPLY else '(dry-run, unchanged)'))


def main():
    if '--relink' in sys.argv:
        relink()
        return
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
    vtexts = load_verse_texts(conn)
    for i, s in enumerate(sections):
        refs = text_refs(s['text'], idx)
        via = 'refs'
        if not refs:
            refs = set(title_chapter_verses(s['title'], vtexts, idx, s['range']))
            via = 'title'
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
