# -*- coding: utf-8 -*-
"""Restore the von Gall WITNESS sigla onto the apparatus, and import the manuscript
legend (siglum → repository · shelfmark · date) so each witness can show which scroll
it is and when it was written.

Source: the user's `data/vongall_new/samaritan_pentateuch.db`:
  • `apparatus` (23 Gen-1 "gold" rows) — each with a `witnesses` JSON list.
  • `manuscripts` (siglum, repository, shelfmark, date_ad, note) — the legend.
Witness sigla carry a hand suffix (C2, E3, X2); the legend is keyed by the base
letter (C, E, X), so the base = the siglum with a trailing digit stripped.

Writes:
  • `vongall_manuscripts(siglum, repository, shelfmark, date_ad, note)` — the legend.
  • updates `vongall_apparatus.witnesses` for the matched gold rows.

Usage:  py -3 scripts/import_vongall_witnesses.py            # dry run
        py -3 scripts/import_vongall_witnesses.py --apply
"""
import sqlite3, sys, io, os, json, re, shutil, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DB = 'data/torah.db'
SRC = 'data/vongall_new/samaritan_pentateuch.db'
NIQ = re.compile('[֑-ׇ]')
FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}


def fold(s):
    s = NIQ.sub('', s or '')
    s = re.sub('[^א-ת]', '', s)
    return ''.join(FIN.get(c, c) for c in s)


def main():
    src = sqlite3.connect(SRC); src.row_factory = sqlite3.Row
    db = sqlite3.connect(DB, timeout=60); db.row_factory = sqlite3.Row

    legend = list(src.execute("SELECT siglum, repository, shelfmark, date_ad, note FROM manuscripts"))
    gold = list(src.execute("SELECT book, chapter, verse, lemma, occurrence, reading, reading_type, "
                            "witnesses, confidence, note, sort_pos FROM apparatus "
                            "WHERE witnesses IS NOT NULL AND witnesses<>'' AND witnesses<>'[]'"))
    print('legend manuscripts:', len(legend), '| witnessed gold rows:', len(gold))

    # verse index by (book, ch, vn)
    vidx = {}
    for r in db.execute("""SELECT v.id, b.name bk, ch.number cn, v.number vn FROM verses v
        JOIN chapters ch ON ch.id=v.chapter_id JOIN books b ON b.id=ch.book_id"""):
        if str(r['vn']).isdigit():
            vidx[(r['bk'], r['cn'], int(r['vn']))] = r['id']

    updates, inserts, noverse = [], [], 0
    for g in gold:
        key = (g['book'], int(g['chapter']), int(g['verse']))
        vid = vidx.get(key)
        if not vid:
            noverse += 1; continue
        # match the imported apparatus row by verse + folded lemma (+ type when needed)
        cand = db.execute("SELECT id, lemma, reading_type FROM vongall_apparatus WHERE verse_id=?",
                          (vid,)).fetchall()
        lf = fold(g['lemma'])
        hit = [c for c in cand if fold(c['lemma']) == lf]
        if len(hit) > 1:
            hit2 = [c for c in hit if (c['reading_type'] or '') == (g['reading_type'] or '')]
            if hit2:
                hit = hit2
        if hit:
            updates.append((g['witnesses'], hit[0]['id']))
        else:               # the witnessed gold entry has no consonantal twin — insert it
            inserts.append((vid, 1, g['lemma'] or '', g['occurrence'] or '', g['reading'] or '',
                            g['reading_type'] or 'sub', g['witnesses'], g['confidence'] or 'high',
                            g['note'] or '', g['sort_pos'] or 0))

    print('witness rows matched (update):', len(updates), '| inserted:', len(inserts),
          '| no verse:', noverse)

    if not APPLY:
        print('\n[dry-run] pass --apply to write'); src.close(); db.close(); return

    bak = DB + '.bak_vgwit_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backup ->', os.path.basename(bak))
    cu = db.cursor()
    cu.execute("DROP TABLE IF EXISTS vongall_manuscripts")
    cu.execute("""CREATE TABLE vongall_manuscripts (siglum TEXT PRIMARY KEY, repository TEXT,
                  shelfmark TEXT, date_ad TEXT, note TEXT)""")
    cu.executemany("INSERT INTO vongall_manuscripts VALUES (?,?,?,?,?)",
                   [(r['siglum'], r['repository'], r['shelfmark'], r['date_ad'], r['note']) for r in legend])
    for wit, rid in updates:
        cu.execute("UPDATE vongall_apparatus SET witnesses=? WHERE id=?", (wit, rid))
    cu.executemany("""INSERT INTO vongall_apparatus
        (verse_id, register, lemma, occurrence, reading, reading_type, witnesses,
         confidence, note, sort_pos) VALUES (?,?,?,?,?,?,?,?,?,?)""", inserts)
    db.commit()
    nw = db.execute("SELECT COUNT(*) FROM vongall_apparatus WHERE witnesses NOT IN ('','[]')").fetchone()[0]
    print('APPLIED: legend %d manuscripts; %d apparatus rows now carry witnesses.' % (len(legend), nw))
    src.close(); db.close()


if __name__ == '__main__':
    main()
