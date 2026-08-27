# -*- coding: utf-8 -*-
"""Import the three Samaritan study booklets into torah.db as verse-linked
sources under "מן המסורת השומרונית".

    ספר הצרעת השומרוני   - פרשנות על כתאב אלכאפי ליוסף בן סלאמה (מהד' נפתלי כהן)
    כרוניקת אבו אלפתח    - ספרון היכרות
    מסורות שומרוניות     - פרשנות על ורשנר

They go into tradart_sections / tradart_verse_links, the pair that already
carries attributed Samaritan-tradition articles, so they surface on a verse
screen with no change to the app at all: get_eyalk_commentary already joins
that pair into "מן המסורת השומרונית".

A section is one heading and the prose under it. Two of the booklets carry Word
Heading styles; the third numbers its styles 1/2/3 and repeats every heading in
a TOC1/TOC2/TOC3 table of contents, which is skipped.

Linking - a section is attached to a verse on three signals:

  1. a citation naming book, chapter and verse   - (ויקרא י"ג, 45), (דברים כ"ד, 8-9)
     chapter and verse alike may be Hebrew letters or digits, and either may be
     a range.
  2. a citation naming only a chapter            - (במדבר י"ב), (ויקרא י"ג-י"ד)
     which attaches the section to every verse of those chapters. A topical work
     on the laws of leprosy belongs on the whole of ויקרא י"ג-י"ד, not on one
     verse of it; this is how the binyamim volumes are linked too.
  3. a quotation that is a run of Torah words, matched on the consonantal
     skeleton by scripts/link_source_to_verses.py.
  4. for a booklet that IS a commentary on a fixed stretch of Torah - the
     leprosy book is a commentary on ויקרא י"ג-י"ד and nothing else - a section
     that cites nothing is placed by the Torah's OWN WORDS in its heading.
     "ב. נתק — נגע הראש והזקן" carries נתק, which stands in ויקרא י"ג 30-37 and
     nowhere else in the range; "ג. קרחת וגבחת" carries both, and they stand in
     40-44. A word too common inside the range to place anything - נגע, בשר,
     עור, טמא - is dropped by the same test that keeps the rare ones, and a
     section that no word places stays where it was: unlinked. Pasting it onto
     the whole range would put the front matter on every verse of it.

Sections with no Torah anchor at all - the manuscript descriptions, the
biography of Vilmar - are stored but linked to nothing. They are not verse
commentary and would be noise on a verse screen.

Usage:  py -3 scripts/booklets/import_booklets.py [--apply]
        (without --apply: parse, link and report only - no DB writes)
"""
import io
import os
import re
import sys
import sqlite3
import zipfile
import collections
import xml.etree.ElementTree as ET

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, 'scripts'))
from link_source_to_verses import VerseIndex, find_links      # noqa: E402

DB = os.path.join(_ROOT, 'data', 'torah.db')
SRC = os.path.join(os.path.dirname(_ROOT), 'Manuscripts')
APPLY = '--apply' in sys.argv

NS = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

# The opening of every author line from this import - it reads as the footnote
# it becomes, and it is also the mark by which a re-run replaces its own rows
# and leaves the two older articles alone.
#
# LEGACY holds every opening this import has EVER written. Rewording the author
# line once already cost a silent double import: the re-run cleared rows by the
# new wording, matched nothing, and added a second copy of all 64 sections
# beside the first, so every booklet passage stood twice under its verse. A
# prefix that is retired here has to be retired into this list, never deleted
# from the file.
TAG = 'מתוך הספרון:'
LEGACY = ['ספרון ·']

BOOKLETS = [
    dict(key='zaraath',
         file='ספר הצרעת השומרוני - פרשנות על כתאב אלכאפי.docx',
         author='מתוך הספרון: ספר הצרעת השומרוני — כתאב אלכאפי ליוסף '
                'בן סלאמה, לפי מהדורת נפתלי כהן (1899)',
         short='ספר הצרעת השומרוני',
         # the whole booklet is a commentary on the two chapters of leprosy
         home=[(3, 13), (3, 14)]),
    dict(key='abufath',
         file='כרוניקת אבו אלפתח - ספרון היכרות.docx',
         author='מתוך הספרון: כרוניקת אבו אלפתח — ספרון היכרות',
         short='כרוניקת אבו אלפתח'),          # a chronicle: no home in the Torah
    dict(key='wreschner',
         file='מסורות שומרוניות - פרשנות על ורשנר.docx',
         author='מתוך הספרון: מסורות שומרוניות — פרשנות על ורשנר',
         short='מסורות שומרוניות'),           # halakha at large: none either
]

# words that name nothing in particular inside a leprosy chapter, or anywhere:
# they would place a section on half its range. The distinctiveness test below
# would drop most of them by itself; these are the ones common enough in Hebrew
# prose to be worth refusing outright.
STOP = set("""
של על עם אל את זה זו מן כל לא ואם אם כי גם רק אך אבל אשר הוא היא הם הן אני
לפי לפני אחרי בין תחת מעל אצל אותו אותה כמו עוד כבר יותר פחות מאוד
פרק פרקים פסוק פסוקים חלק חלקים סוגי סוג שלושת שני שתי ראשית ועוד וכן
תורה תורת מסורת מסורות פירוש פרשנות הלכה הלכות דין דיני עניין ענייני
""".split())

BOOK_ID = {'בראשית': 1, 'שמות': 2, 'ויקרא': 3, 'במדבר': 4, 'דברים': 5}

_GEM = {'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
        'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80,
        'צ': 90, 'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
        'ך': 20, 'ם': 40, 'ן': 50, 'ף': 80, 'ץ': 90}


def gem(s):
    """Hebrew numeral -> int. None for anything that is not one."""
    s = re.sub(r'["\'׳״]', '', s or '').strip()
    if not s or any(c not in _GEM for c in s):
        return None
    return sum(_GEM[c] for c in s) or None


def num(s):
    """A chapter/verse token: Hebrew letters or digits."""
    s = (s or '').strip()
    if re.fullmatch(r'\d{1,3}', s):
        return int(s)
    return gem(s)


# book, then a chapter (letters or digits, possibly a range), then optionally a
# comma and a verse (letters or digits, possibly a range). The booklets set them
# every way: ויקרא י"ג, 45 · שמות י"ב, ג' · דברים כ"ד, 8-9 · ויקרא י"ג-י"ד
_TOK = r'(?:\d{1,3}|[א-ת]{1,4}["\'׳״]?[א-ת]?["\'׳״]?)'
CITE = re.compile(
    r'(' + '|'.join(BOOK_ID) + r')\s*'
    r'(' + _TOK + r')(?:\s*[-–—]\s*(' + _TOK + r'))?'
    r'(?:\s*,\s*(' + _TOK + r')(?:\s*[-–—]\s*(' + _TOK + r'))?)?')


def paragraphs(path):
    """(style, text) for every non-empty paragraph, in order."""
    root = ET.fromstring(zipfile.ZipFile(path).read('word/document.xml'))
    out = []
    for p in root.iter(NS + 'p'):
        txt = ''.join(t.text or '' for t in p.iter(NS + 't')).strip()
        if not txt:
            continue
        style = ''
        pr = p.find(NS + 'pPr')
        if pr is not None:
            st = pr.find(NS + 'pStyle')
            if st is not None:
                style = st.get(NS + 'val') or ''
        out.append((style, txt))
    return out


def heading_level(style):
    """1/2/3 for a heading, 0 for body, -1 for a table-of-contents row."""
    if style.startswith('TOC'):
        return -1
    m = re.fullmatch(r'Heading([1-9])', style)
    if m:
        return int(m.group(1))
    if re.fullmatch(r'[1-9]', style):        # the third booklet's own numbering
        return int(style)
    return 0


# ── the writing tool's own voice ────────────────────────────────────────────
# The booklets were dictated in instalments, and the seams are still in them:
# paragraphs that announce what the next instalment will cover, apologise that a
# chapter is unfinished, or call the work "my own rendering". None of that is
# Samaritan scholarship — it is the machine that typed it talking to whoever
# asked — and under a verse it is worse than noise, because it points the reader
# at a "next part" that does not exist anywhere in the app.
#
# A whole paragraph goes when it OPENS with one of these. Opening is the test,
# not merely containing: כתבי היד says a manuscript "והושלם ב-28 בצפר 1201",
# and מנג'א "ממשיך לתקוף את תחום שבת" — both real, both would be lost to a rule
# that only looked for the words.
DROP_PARA = [
    re.compile(r'^\(?\s*ממשיך\s*[:\s]'),            # "ממשיך: בחלק הבא — …"
    re.compile(r'^\(?\s*(?:אמשיך|נמשיך)\b'),
    re.compile(r'^\(\s*פרק זה\s+(?:טרם|עדיין לא)\s+הושלם'),
    re.compile(r'^\(\s*עדיין נותרו לדיון'),
]
# and a single opening sentence goes where the rest of its paragraph is a real
# attribution note worth keeping
DROP_SENTENCE = [
    re.compile(r'^כמו בחלק א[\'׳] — זהו עיבוד בלשוני שלי, לא תרגום מילולי\.\s*'),
    re.compile(r'^כמו בספרון הקודם: זהו עיבוד בלשוני, לא תרגום\.\s*'),
]
# One sentence points forward at a section by its POSITION rather than by name.
# Set under a verse there is no "later" — each section is its own card — so the
# pointer is turned into the fact it was pointing at. Nothing is lost: the
# subtype and its name both stay.
REWORD = [
    ('הנתק עצמו מתחלק לשני תת-סוגים; השני (נגע הקרחת) יידון בהמשך.',
     'הנתק עצמו מתחלק לשני תת-סוגים, והשני שבהם הוא נגע הקרחת.'),
]


STRIPPED = [0]          # how many seams the run took out, for the report


def strip_tool_voice(text):
    """Drop the instalment seams. Returns (text, how_many_removed)."""
    out, n = [], 0
    for p in (text or '').split('\n\n'):
        s = p.strip()
        if not s:
            continue
        for old, new in REWORD:
            if old in s:
                s = s.replace(old, new)
                n += 1
        if any(rx.search(s) for rx in DROP_PARA):
            n += 1
            continue
        for rx in DROP_SENTENCE:
            s2 = rx.sub('', s)
            if s2 != s:
                n += 1
                s = s2.strip()
        out.append(s)
    return '\n\n'.join(out), n


def sections(paras, short):
    """Split a booklet into (title, text) sections at its headings."""
    out, title, body = [], None, []

    def flush():
        if title and body:
            txt, dropped = strip_tool_voice('\n\n'.join(body))
            STRIPPED[0] += dropped
            if txt:
                out.append((title, txt))

    for style, txt in paras:
        lvl = heading_level(style)
        if lvl == -1:
            continue                                   # table of contents
        if lvl > 0:
            if re.match(r'^\s*תוכן\s+העניינים', txt):
                flush()
                title, body = None, []
                continue
            flush()
            # the booklet's own name repeats as a part heading; strip it so the
            # section is named by what it is about
            title = re.sub(r'^\s*' + re.escape(short) + r'\s*[—\-–]\s*',
                           '', txt).strip()
            body = []
        elif title:
            body.append(txt)
    flush()
    return out


def chapter_verses(conn):
    """(book, chapter) -> [verse_id]  and  (book, chapter, verse) -> verse_id."""
    by_ch = collections.defaultdict(list)
    by_v = {}
    for vid, bid, chn, vn, masn in conn.execute(
            'SELECT v.id, ch.book_id, ch.number, v.number, v.mas_number '
            '  FROM verses v JOIN chapters ch ON ch.id = v.chapter_id '
            ' ORDER BY ch.book_id, ch.number, v.id'):
        by_ch[(bid, chn)].append(vid)
        try:
            by_v.setdefault((bid, chn, int(vn)), vid)
        except (TypeError, ValueError):
            pass
        try:
            by_v.setdefault((bid, chn, int(str(masn).strip())), vid)
        except (TypeError, ValueError):
            pass
    return by_ch, by_v


def cite_links(text, by_ch, by_v):
    """verse_ids a section's citations point at, and what was cited."""
    hits, shown = set(), []
    for m in CITE.finditer(text or ''):
        book, c1, c2, v1, v2 = m.groups()
        bid = BOOK_ID[book]
        a, b = num(c1), num(c2)
        if not a:
            continue
        chapters = list(range(a, b + 1)) if (b and b >= a) else [a]
        if len(chapters) > 8:                    # a runaway range is a misread
            continue
        f, g = num(v1), num(v2)
        got = set()
        if f:
            for ch in chapters:
                for vn in range(f, (g if (g and g >= f) else f) + 1):
                    vid = by_v.get((bid, ch, vn))
                    if vid:
                        got.add(vid)
        else:
            for ch in chapters:
                got.update(by_ch.get((bid, ch), []))
        if got:
            hits |= got
            shown.append(m.group(0).strip())
    return hits, shown


FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}


def skel(w):
    """A word reduced to what does not move between spellings: final forms
    folded, the mothers of reading dropped. So מכוה and מכווה are one word."""
    w = ''.join(FIN.get(c, c) for c in re.sub(r'[^א-ת]', '', w or ''))
    return re.sub(r'[אהוי]', '', w)


def fold(w):
    """Final forms folded, nothing else lost."""
    return ''.join(FIN.get(c, c) for c in re.sub(r'[^א-ת]', '', w or ''))


def home_index(conn, home):
    """[(verse_id, [folded words], [skeleton words])] for a booklet's range."""
    out = []
    for bid, chn in home or []:
        for vid, text in conn.execute(
                'SELECT v.id, v.text FROM verses v '
                '  JOIN chapters ch ON ch.id = v.chapter_id '
                ' WHERE ch.book_id = ? AND ch.number = ? ORDER BY v.id',
                (bid, chn)):
            ws = re.findall(r'[א-ת]+', text or '')
            out.append((vid, [fold(w) for w in ws], [skel(w) for w in ws]))
    return out


# a heading word places a section only if it is RARE inside the range: a word in
# more than this share of its verses is describing the subject, not locating it
SPREAD_MAX = 0.25


def home_links(title, hidx):
    """Verses of the booklet's range whose text carries a rare word of the
    heading. Returns (verse_ids, the words that did the placing).

    The Torah inflects: the heading says קרחת and the verse says בקרחתו, so the
    heading word is looked for INSIDE the verse's words rather than against
    them. Spelling moves too - the heading writes מכווה where the verse writes
    מכוה - so a word that finds nothing as written is tried again on its
    consonantal skeleton, but only if enough of it survives that stripping to
    still name something."""
    if not hidx:
        return set(), []
    words = [w for w in re.findall(r'[א-ת]+', title or '')
             if len(w) >= 3 and w not in STOP]
    hits, used = set(), []
    for w in words:
        f = fold(w)
        where = set(vid for vid, fw, _sw in hidx if any(f in x for x in fw))
        if not where:
            # The skeleton is a blunt instrument: it turns אלכאפי into לכפ, which
            # collides with ordinary Hebrew. A word only gets the second chance
            # if four consonants survive - enough that a collision is a word and
            # not an accident.
            s = skel(w)
            if len(s) < 4:
                continue
            where = set(vid for vid, _fw, sw in hidx if any(s in x for x in sw))
        if where and len(where) <= SPREAD_MAX * len(hidx):
            hits |= where
            used.append(w)
    return hits, used


def main():
    conn = sqlite3.connect(DB)
    by_ch, by_v = chapter_verses(conn)
    idx = VerseIndex()

    rows = []
    for b in BOOKLETS:
        path = os.path.join(SRC, b['file'])
        secs = sections(paragraphs(path), b['short'])
        hidx = home_index(conn, b.get('home'))
        print('=' * 76)
        print('%s  -  %d sections%s'
              % (b['short'], len(secs),
                 ('   [range: %d verses]' % len(hidx)) if hidx else ''))
        for title, text in secs:
            vids, shown = cite_links(text, by_ch, by_v)
            q = find_links(text, idx)
            qv = set(v for v, _k, _s in q['quotes'])
            vids |= qv
            how = ' ; '.join(shown[:3])
            if not vids and hidx:
                vids, used = home_links(title, hidx)
                if vids:
                    how = 'לפי מילות הכותרת: ' + ', '.join(used)
            rows.append(dict(book=b, title=title, text=text, vids=sorted(vids),
                             cites=shown, nquote=len(qv)))
            mark = '%4d' % len(vids) if vids else '   .'
            print('   %s  %-50s %s' % (mark, title[:50], how[:46]))

    linked = [r for r in rows if r['vids']]
    print()
    print('paragraphs of tool-voice removed: %d' % STRIPPED[0])
    print('sections %d   linked %d   unlinked %d   verse links %d'
          % (len(rows), len(linked), len(rows) - len(linked),
             sum(len(r['vids']) for r in rows)))

    name = dict((r[0], r[1]) for r in conn.execute(
        'SELECT v.id, b.name FROM verses v JOIN chapters ch ON ch.id=v.chapter_id '
        'JOIN books b ON b.id=ch.book_id'))
    touched = set()
    for r in linked:
        touched.update(r['vids'])
    spread = collections.Counter(name[v] for v in touched if v in name)
    print('verses touched: %d  ->  %s' % (len(touched), dict(spread)))

    if not APPLY:
        print('\n(report only - pass --apply to write)')
        return

    cur = conn.cursor()
    old = []
    for mark in [TAG] + LEGACY:
        old += [r[0] for r in conn.execute(
            'SELECT id FROM tradart_sections WHERE author LIKE ?', (mark + '%',))]
    old = sorted(set(old))
    if old:
        q = ','.join('?' * len(old))
        cur.execute('DELETE FROM tradart_verse_links WHERE section_id IN (%s)' % q, old)
        cur.execute('DELETE FROM tradart_sections WHERE id IN (%s)' % q, old)
        print('replaced %d sections from a previous run' % len(old))
    base = conn.execute('SELECT COALESCE(MAX(ord),0) FROM tradart_sections').fetchone()[0]
    nsec = nlink = 0
    for i, r in enumerate(rows, 1):
        cur.execute('INSERT INTO tradart_sections (title, author, ord, text) '
                    'VALUES (?,?,?,?)',
                    (r['title'], r['book']['author'], base + i, r['text']))
        sid = cur.lastrowid
        nsec += 1
        for vid in r['vids']:
            cur.execute('INSERT INTO tradart_verse_links (section_id, verse_id) '
                        'VALUES (?,?)', (sid, vid))
            nlink += 1
    conn.commit()
    print('\nwrote %d sections and %d verse links' % (nsec, nlink))


if __name__ == '__main__':
    main()
