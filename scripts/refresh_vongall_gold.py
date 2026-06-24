# -*- coding: utf-8 -*-
"""Refresh the von Gall apparatus (חילופי נוסח) from the updated data files in
`data/vongall_new/samaritan_pentateuch.db`.

What actually changed vs. the data already in torah.db:
  • the whole-Torah CONSONANTAL apparatus CSV is byte-identical to the prior import
    (4,374 rows) — left untouched, so every existing word↔apparatus link stays put.
  • the manuscript LEGEND is identical (24 sigla) — rebuilt anyway for provenance.
  • Genesis 1 is the genuine improvement: the previous import patched only the
    *witnesses* field onto the garbled consonantal OCR rows (collisions lost 3 of the
    23 gold readings, and types/readings stayed wrong, e.g. 1:11 מזריע→לאתות). Here
    the gold `apparatus` rows (manually read, witnesses C²/E³/D²/P/B…, clean
    sub/om/orth/sic/del types + notes) REPLACE the apparatus for exactly the gold-
    covered verses {4,5,6,7,11,12,14,15,16,18}. The consonantal-only Gen-1 verses
    {21,24,25,27,29} are kept as-is.

Witnesses come from `apparatus_witness` (authoritative, one row per reading×witness)
and are stored as a JSON list to match the existing schema / get_apparatus().

Usage:  py -3 scripts/refresh_vongall_gold.py            # dry run
        py -3 scripts/refresh_vongall_gold.py --apply
"""
import sqlite3, sys, io, os, json, re, shutil, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
DB = 'data/torah.db'
SRC = 'data/vongall_new/samaritan_pentateuch.db'
BOOK = {'GEN': 'בראשית', 'EXO': 'שמות', 'LEV': 'ויקרא', 'NUM': 'במדבר', 'DEU': 'דברים'}
SUP = {1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶'}
NIQ = re.compile('[֑-ׇ]')
FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}


def fold(s):
    s = NIQ.sub('', s or '')
    s = re.sub('[^א-ת]', '', s)
    return ''.join(FIN.get(c, c) for c in s)


def confidence(anchor):
    return {'lemma+num': 'high', 'lemma': 'high', 'lemma-ambig': 'low'}.get(anchor or '', 'high')


def main():
    src = sqlite3.connect(SRC); src.row_factory = sqlite3.Row
    db = sqlite3.connect(DB, timeout=60); db.row_factory = sqlite3.Row

    # gold rows + their witnesses (authoritative apparatus_witness table)
    gold = list(src.execute("SELECT * FROM apparatus ORDER BY verse, sort_pos"))
    wit_of = {}
    for w in src.execute("SELECT app_id, witness FROM apparatus_witness"):
        wit_of.setdefault(w['app_id'], []).append(w['witness'])
    legend = list(src.execute("SELECT siglum, repository, shelfmark, date_ad, note FROM manuscripts"))
    gold_verses = sorted(set(int(g['verse']) for g in gold))
    print('gold rows: %d  | covers Gen-1 verses %s  | legend: %d sigla'
          % (len(gold), gold_verses, len(legend)))

    # verse index by (hebrew-book, ch, vn)
    vidx = {}
    for r in db.execute("""SELECT v.id, b.name bk, ch.number cn, v.number vn FROM verses v
        JOIN chapters ch ON ch.id=v.chapter_id JOIN books b ON b.id=ch.book_id"""):
        if str(r['vn']).isdigit():
            vidx[(r['bk'], r['cn'], int(r['vn']))] = r['id']

    # occurrence superscripts: only where a folded lemma repeats within a verse
    per_verse = {}
    for g in gold:
        per_verse.setdefault(int(g['verse']), []).append(g)
    rows, missing = [], []
    for vn, gs in per_verse.items():
        counts, running = {}, {}
        for g in gs:
            counts[fold(g['lemma'])] = counts.get(fold(g['lemma']), 0) + 1
        vid = vidx.get(('בראשית', 1, vn))
        if not vid:
            missing.append(vn); continue
        for g in gs:
            lf = fold(g['lemma'])
            occ = ''
            if counts[lf] > 1:
                running[lf] = running.get(lf, 0) + 1
                occ = SUP.get(running[lf], str(running[lf]))
            wl = wit_of.get(g['app_id'], [])
            rows.append((vid, 1, g['lemma'] or '', occ, g['reading'] or '',
                         g['reading_type'] or 'sub', json.dumps(wl, ensure_ascii=False),
                         g['confidence'] or 'high',
                         g['note'] or '', int(g['sort_pos']) if g['sort_pos'] is not None else 0))

    # the Gen-1 verse_ids whose apparatus will be replaced by gold
    repl_vids = [vidx[('בראשית', 1, vn)] for vn in gold_verses if ('בראשית', 1, vn) in vidx]
    cur_in_repl = db.execute(
        "SELECT COUNT(*) FROM vongall_apparatus WHERE verse_id IN (%s)"
        % ','.join('?' * len(repl_vids)), repl_vids).fetchone()[0]
    total = db.execute("SELECT COUNT(*) FROM vongall_apparatus").fetchone()[0]
    print('replacing %d existing Gen-1 rows with %d clean gold rows (of %d total apparatus)'
          % (cur_in_repl, len(rows), total))
    if missing:
        print('  WARNING unmapped Gen-1 verses:', missing)
    print('\nsample of new gold rows:')
    for r in rows[:6]:
        print('   1:%-2s sp%s [%s]%s>>[%s] (%s) wit=%s'
              % (db.execute('SELECT v.number FROM verses v WHERE v.id=?', (r[0],)).fetchone()[0],
                 r[9], r[2], r[3], r[4], r[5], r[6]))

    if not APPLY:
        print('\n[dry-run] re-run with --apply to write'); src.close(); db.close(); return

    bak = DB + '.bak_vggold_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backup ->', os.path.basename(bak))
    cu = db.cursor()
    cu.execute("DELETE FROM vongall_apparatus WHERE verse_id IN (%s)"
               % ','.join('?' * len(repl_vids)), repl_vids)
    cu.executemany("""INSERT INTO vongall_apparatus
        (verse_id, register, lemma, occurrence, reading, reading_type, witnesses,
         confidence, note, sort_pos) VALUES (?,?,?,?,?,?,?,?,?,?)""", rows)
    # refresh the legend (identical content, rebuilt for provenance)
    cu.execute("DROP TABLE IF EXISTS vongall_manuscripts")
    cu.execute("""CREATE TABLE vongall_manuscripts (siglum TEXT PRIMARY KEY, repository TEXT,
                  shelfmark TEXT, date_ad TEXT, note TEXT)""")
    cu.executemany("INSERT INTO vongall_manuscripts VALUES (?,?,?,?,?)",
                   [(r['siglum'], r['repository'], r['shelfmark'], r['date_ad'], r['note']) for r in legend])
    db.commit()
    n = db.execute("SELECT COUNT(*) FROM vongall_apparatus").fetchone()[0]
    nw = db.execute("SELECT COUNT(*) FROM vongall_apparatus WHERE witnesses NOT IN ('', '[]')").fetchone()[0]
    g1 = db.execute("""SELECT COUNT(*) FROM vongall_apparatus a JOIN verses v ON v.id=a.verse_id
        JOIN chapters ch ON ch.id=v.chapter_id JOIN books b ON b.id=ch.book_id
        WHERE b.name='בראשית' AND ch.number=1""").fetchone()[0]
    print('APPLIED: %d apparatus rows total; %d carry witnesses; Gen-1 now has %d entries.'
          % (n, nw, g1))
    src.close(); db.close()


if __name__ == '__main__':
    main()
