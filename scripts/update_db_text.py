# -*- coding: utf-8 -*-
"""Update verses.text in torah.db IN PLACE from the corrected .txt files, matched by
(book, chapter number, verse number) — WITHOUT touching verse_id, so root_index and
verse_dictionary linkage is preserved.

Only verses whose consonantal content still matches are updated (this carries the new
:/. stop marks and the safe letter corrections into the app). Verses whose letters
diverge a lot, or that exist on only one side, are reported and left untouched.

Usage: py -3 scripts/update_db_text.py [--apply]
"""
import sys, io, os, shutil, sqlite3, re
from difflib import SequenceMatcher
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, 'scripts')
from import_torah import parse_book_file   # same parser the DB was built with

DB = 'data/torah.db'
BOOKS = [('בראשית', 'data/בראשית.txt'),
         ('שמות',   'data/שמות.txt'),
         ('ויקרא',  'data/ויקרא.txt'),
         ('במדבר',  'data/במדבר.txt'),
         ('דברים',  'data/דברים.txt')]   # Deut now reconstructed clean (1-34) from DB
FINAL = str.maketrans('ךםןףץ', 'כמנפצ')
def letters(t):
    return re.sub('[^א-ת]', '', t).translate(FINAL)


def main(apply=False):
    if apply:
        bak = DB + '.ver2text.bak'
        if not os.path.exists(bak):
            shutil.copy2(DB, bak)
            print(f'backup -> {bak}')
    conn = sqlite3.connect(DB)
    grand = dict(upd=0, mark_only=0, corrected=0, diverge=0, txt_only=0, db_only=0)
    diverge_rows, txtonly_rows = [], []

    for heb, path in BOOKS:
        bid = conn.execute('SELECT id FROM books WHERE name=?', (heb,)).fetchone()[0]
        # db verses for this book: (ch_number, verse_number) -> (verse_id, text)
        dbv = {}
        for vid, chn, vn, txt in conn.execute(
                '''SELECT v.id, c.number, v.number, v.text
                   FROM verses v JOIN chapters c ON c.id=v.chapter_id
                   WHERE c.book_id=?''', (bid,)):
            dbv[(chn, vn)] = (vid, txt)

        parsed = parse_book_file(path)   # {ch: {vnum: {'text','sam_end'}}}
        txtkeys = set()
        st = dict(upd=0, mark_only=0, corrected=0, diverge=0, txt_only=0)
        for ch, vd in parsed.items():
            for vn, info in vd.items():
                txtkeys.add((ch, vn))
                new = info['text']
                if (ch, vn) not in dbv:
                    st['txt_only'] += 1
                    txtonly_rows.append((heb, ch, vn, new[:40]))
                    continue
                vid, old = dbv[(ch, vn)]
                lo, ln = letters(old), letters(new)
                if lo == ln:
                    # identical consonants -> difference is only marks/punctuation
                    if old != new:
                        if apply:
                            conn.execute('UPDATE verses SET text=? WHERE id=?', (new, vid))
                        st['upd'] += 1; st['mark_only'] += 1
                elif SequenceMatcher(None, lo, ln).ratio() >= 0.85:
                    # small consonant corrections -> safe to carry over
                    if apply:
                        conn.execute('UPDATE verses SET text=? WHERE id=?', (new, vid))
                    st['upd'] += 1; st['corrected'] += 1
                else:
                    st['diverge'] += 1
                    diverge_rows.append((heb, ch, vn, lo[:30], ln[:30]))
        db_only = len(set(dbv) - txtkeys)
        print(f'{heb}: updated={st["upd"]} (marks-only={st["mark_only"]}, '
              f'corrected={st["corrected"]})  diverge={st["diverge"]}  '
              f'txt-only={st["txt_only"]}  db-only={db_only}')
        for k in ('upd', 'mark_only', 'corrected', 'diverge', 'txt_only'):
            grand[k] += st[k]
        grand['db_only'] += db_only

    if apply:
        conn.commit()
    conn.close()

    print('\n--- sample DIVERGENT (left untouched) ---')
    for r in diverge_rows[:15]:
        print(f'  {r[0]} {r[1]}:{r[2]}  db={r[3]!r}  txt={r[4]!r}')
    print(f'... {len(diverge_rows)} divergent total')
    print('\n--- sample TXT-ONLY (no db verse) ---')
    for r in txtonly_rows[:15]:
        print(f'  {r[0]} {r[1]}:{r[2]}  {r[3]!r}')
    print(f'... {len(txtonly_rows)} txt-only total')

    print(f'\n{"APPLIED" if apply else "DRY-RUN"}: would update {grand["upd"]} verses '
          f'(marks-only={grand["mark_only"]}, corrected={grand["corrected"]}); '
          f'diverge={grand["diverge"]} txt-only={grand["txt_only"]} db-only={grand["db_only"]}')


if __name__ == '__main__':
    main(apply='--apply' in sys.argv)
