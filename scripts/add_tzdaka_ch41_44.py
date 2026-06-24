# -*- coding: utf-8 -*-
"""Add Ṣadaqah al-Ḥakīm's commentary for Genesis 41–44 from the new docx files,
INCREMENTALLY (preserving the existing tzdaka_sections.arabic translations for the
other chapters — does NOT drop/rebuild the table like import_tzdaka_all.py).

These files are headingless: a short verse INCIPIT line ends with a bracketed ref —
either comma-Hebrew  "ויהי מקץ שנתים ימים [מא, א]"  or decimal-colon  "… [42:1]" —
and the long paragraphs that follow are its commentary, until the next incipit line.
Chapters 41–44 are deleted then re-inserted from these (authoritative, newest) files;
their verse links are rebuilt; the new sections get arabic=NULL (translated after).

Usage:  py -3 scripts/add_tzdaka_ch41_44.py          # dry run
        py -3 scripts/add_tzdaka_ch41_44.py --apply
"""
import sqlite3, sys, io, os, re, shutil, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DB = 'data/torah.db'
TZDIR = 'תרגום צדקה אלכים'
BOOK = 'בראשית'
CHAPTERS = (41, 42, 43, 44)
FILES = ['Sadaqah_Genesis_Ch41_part1_41.1-16_2.docx',
         'Sadaqah_Genesis_Ch41_part2_41.17-32.docx',
         'Sadaqah_Genesis_Ch41_part3_41.33-44.docx',
         'sadaqah_genesis_ch42-43.docx',
         'sadaqah_genesis_ch44.docx']
GEM = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ך':20,
       'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,
       'ק':100,'ר':200,'ש':300,'ת':400}
NIK = re.compile('[֑-ׇ]')
# a section incipit: short text, then a bracketed verse ref at the very end.
HDR = re.compile(r'^(.{1,80}?)\s*\[\s*(?:([א-ת]{1,3})\s*[,،]\s*([א-ת]{1,3})'
                 r'|(\d{1,3})\s*:\s*(\d{1,3}))(?:\s*[–\-][א-ת\d]{1,4})?\s*\]\s*$')
CHAP_ONLY = re.compile(r'^(?:פרק\s+\S+\s*)?\[\s*(?:\d{1,3}|[א-ת]{1,3})\s*\]\s*$')


def gem(s):
    return sum(GEM.get(c, 0) for c in s)


def bare(s):
    return NIK.sub('', s or '')


def parse_file(path, vidx):
    import docx
    doc = docx.Document(path)
    sections, cur = [], None
    for p in doc.paragraphs:
        raw = p.text.strip()
        if not raw:
            continue
        plain = bare(raw)
        if CHAP_ONLY.match(plain):                      # a "[42]" / "פרק מ״ב" marker
            continue
        m = HDR.match(plain)
        if m:
            if cur:
                sections.append(cur)
            if m.group(2):                              # comma-Hebrew  [מא, א]
                ch, vn = gem(m.group(2)), gem(m.group(3))
            else:                                       # decimal-colon [42:1]
                ch, vn = int(m.group(4)), int(m.group(5))
            inc = m.group(1).strip()
            cur = {'ch': ch, 'v': vn, 'ref': '%d:%d' % (ch, vn), 'title': inc, 'body': []}
        elif cur is not None:
            cur['body'].append(raw)
    if cur:
        sections.append(cur)
    return sections


def main():
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    vidx = {}
    for r in conn.execute("""SELECT v.id, c.number ch, v.number vn FROM verses v
        JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id WHERE b.name=?""", (BOOK,)):
        if str(r['vn']).isdigit():
            vidx[(r['ch'], int(r['vn']))] = r['id']

    all_secs = []
    for fn in FILES:
        path = os.path.join(TZDIR, fn)
        if not os.path.exists(path):
            print('MISSING', fn); continue
        secs = parse_file(path, vidx)
        for s in secs:
            s['text'] = re.sub(r'\s+', ' ', ' '.join(s['body'])).strip()
        secs = [s for s in secs if s['text'] and s['ch'] in CHAPTERS]
        chs = sorted(set(s['ch'] for s in secs))
        print('%-44s -> %d sections (chapters %s)' % (fn, len(secs), chs))
        all_secs += secs

    # link each incipit-block to its full verse SPAN: from its verse up to (but not
    # including) the next block's verse in the same chapter (last block → chapter end).
    chapmax = {}
    for (ch, vn) in vidx:
        chapmax[ch] = max(chapmax.get(ch, 0), vn)
    all_secs.sort(key=lambda s: (s['ch'], s['v']))
    for i, s in enumerate(all_secs):
        nxt = all_secs[i + 1] if i + 1 < len(all_secs) else None
        end = (nxt['v'] - 1) if (nxt and nxt['ch'] == s['ch'] and nxt['v'] > s['v']) else chapmax.get(s['ch'], s['v'])
        s['vids'] = [vidx[(s['ch'], vv)] for vv in range(s['v'], end + 1) if (s['ch'], vv) in vidx]
        s['missing'] = [] if s['vids'] else [(s['ch'], s['v'])]

    by_ch = {}
    for s in all_secs:
        by_ch.setdefault(s['ch'], 0)
        by_ch[s['ch']] += 1
    nlink = sum(len(s['vids']) for s in all_secs)
    miss = [s['ref'] for s in all_secs if s['missing']]
    print('\nTOTAL new sections: %d   verse-links: %d   per-chapter: %s'
          % (len(all_secs), nlink, dict(sorted(by_ch.items()))))
    if miss:
        print('unmatched refs (no verse):', miss)
    print('sample:')
    for s in all_secs[:3]:
        print('  %s · %s' % (s['ref'], s['title'][:34]))
        print('     %s' % s['text'][:90])

    if not APPLY:
        print('\n[dry-run] re-run with --apply to write'); conn.close(); return

    bak = DB + '.bak_tzadd_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backup ->', os.path.basename(bak))
    cu = conn.cursor()
    ph = ','.join(str(c) for c in CHAPTERS)
    cu.execute("DELETE FROM tzdaka_verse_links WHERE section_id IN "
               "(SELECT id FROM tzdaka_sections WHERE book=? AND chap IN (%s))" % ph, (BOOK,))
    cu.execute("DELETE FROM tzdaka_sections WHERE book=? AND chap IN (%s)" % ph, (BOOK,))
    base = (conn.execute("SELECT COALESCE(MAX(ord),0) FROM tzdaka_sections").fetchone()[0]) + 1
    for i, s in enumerate(all_secs):
        cu.execute("INSERT INTO tzdaka_sections (book, chap, ref, title, ord, text, arabic) "
                   "VALUES (?,?,?,?,?,?,NULL)", (BOOK, s['ch'], s['ref'], s['title'], base + i, s['text']))
        sid = cu.lastrowid
        for vid in s['vids']:
            cu.execute("INSERT INTO tzdaka_verse_links (verse_id, section_id) VALUES (?,?)", (vid, sid))
    conn.commit()
    chs = [r[0] for r in conn.execute("SELECT DISTINCT chap FROM tzdaka_sections ORDER BY chap")]
    ns = conn.execute("SELECT COUNT(*) FROM tzdaka_sections").fetchone()[0]
    print('APPLIED. tzdaka_sections now %d rows; chapters: %s' % (ns, chs))
    conn.close()


if __name__ == '__main__':
    main()
