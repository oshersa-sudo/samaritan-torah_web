# -*- coding: utf-8 -*-
"""Augment tm_verse_links with the EXPLICIT verse references embedded in each Tibåt
Mårqe section's own text (Part 2 of the coverage fix).

The original linking (relink_tibat_marqe.py) relied solely on the external "Biblical
quotations" index + an AI relevance filter, and so missed 124 sections that directly
quote and expound a verse with an inline parenthetical reference like "(שמות ג,ז)".
This script parses those refs straight from the section text (hebrew/aramaic/english),
resolves them via gematria, and adds the links (INSERT OR IGNORE — never removes
existing links, never touches the index/relevance work).

Usage:  py -3 scripts/link_tibat_marqe_intext.py            # dry run
        py -3 scripts/link_tibat_marqe_intext.py --apply
"""
import sqlite3, sys, io, os, re, shutil, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DB = 'data/torah.db'
BOOK_ORD = {'בראשית': 1, 'שמות': 2, 'ויקרא': 3, 'במדבר': 4, 'דברים': 5}
GEM = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ך':20,
       'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,
       'ק':100,'ר':200,'ש':300,'ת':400}
# an inline reference: "(שמות ג,ז)" — book, chapter, verse in Hebrew numerals,
# the chapter/verse separated by a comma (incl. Arabic/full-width commas).
REF = re.compile(r'\(\s*(בראשית|שמות|ויקרא|במדבר|דברים)\s+([א-ת]{1,3})\s*[,，،]\s*([א-ת]{1,3})\s*\)')


def gem(s):
    return sum(GEM.get(c, 0) for c in s)


def main():
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout=60000')

    vlookup = {}
    for r in conn.execute("""SELECT v.id, b.order_n bo, ch.number cn, v.number vn FROM verses v
        JOIN chapters ch ON ch.id=v.chapter_id JOIN books b ON b.id=ch.book_id"""):
        if str(r['vn']).isdigit():
            vlookup[(r['bo'], r['cn'], int(r['vn']))] = r['id']

    existing = set((r['verse_id'], r['section_id'])
                   for r in conn.execute("SELECT verse_id, section_id FROM tm_verse_links"))
    covered_before = set(v for v, _ in existing)

    # only "rescue" the ORPHANED sections (no link at all). Their inline citation IS
    # the section's subject, so linking it is a clear win; we deliberately do NOT mine
    # extra inline cross-references out of already-linked sections — those murkier
    # incidental citations are what the relevance filter was built to exclude.
    new_pairs = set()
    refs_seen, unresolved = 0, 0
    sections_touched = set()
    for s in conn.execute("""SELECT id, hebrew, aramaic, english FROM tm_sections s
        WHERE NOT EXISTS (SELECT 1 FROM tm_verse_links l WHERE l.section_id=s.id)"""):
        txt = ' '.join(filter(None, (s['hebrew'], s['aramaic'], s['english'])))
        for bk, chh, vnn in REF.findall(txt):
            refs_seen += 1
            vid = vlookup.get((BOOK_ORD[bk], gem(chh), gem(vnn)))
            if not vid:
                unresolved += 1; continue
            pair = (vid, s['id'])
            if pair not in existing:
                new_pairs.add(pair); sections_touched.add(s['id'])

    new_verses = set(v for v, _ in new_pairs)
    print('inline refs parsed: %d  (unresolved: %d)' % (refs_seen, unresolved))
    print('NEW links to add: %d   across %d sections' % (len(new_pairs), len(sections_touched)))
    print('verses gaining Tibåt Mårqe: %d   (newly-covered, none before: %d)'
          % (len(new_verses), len(new_verses - covered_before)))
    print('covered verses: %d  ->  %d' % (len(covered_before), len(covered_before | new_verses)))

    if not APPLY:
        print('\n[dry-run] re-run with --apply to write'); conn.close(); return

    bak = DB + '.bak_tmlink_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backup ->', os.path.basename(bak))
    conn.executemany("INSERT OR IGNORE INTO tm_verse_links (verse_id, section_id) VALUES (?,?)",
                     sorted(new_pairs))
    conn.commit()
    nlink = conn.execute("SELECT COUNT(*) FROM tm_verse_links").fetchone()[0]
    nverse = conn.execute("SELECT COUNT(DISTINCT verse_id) FROM tm_verse_links").fetchone()[0]
    print('APPLIED. tm_verse_links now: %d links across %d verses.' % (nlink, nverse))
    conn.close()


if __name__ == '__main__':
    main()
