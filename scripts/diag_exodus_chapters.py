# -*- coding: utf-8 -*-
"""
READ-ONLY diagnostic. List every Samaritan chapter (a ׃--delimited unit) of the
Exodus TXT that is MISSING from the clean DB (data/torah.db.bak_exoins), using a
position-aware whole-book word alignment so the command/execution doublets are
counted correctly (the DB keeps one copy, the TXT has both -> the extra copy is
flagged). For each missing chapter: its opening words, word count, and the DB
verse it should follow. Changes nothing.
"""
import sqlite3, sys, io, re
from difflib import SequenceMatcher
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DB = 'data/torah.db.bak_exoins'
WORD = re.compile('[א-ת]+')


def main():
    # ---- TXT: words with a ׃-- chapter id, and the raw chapter text ----
    raw = re.sub(r'[‎‏‪-‮]', '', io.open('data/שמות.txt', encoding='utf-8').read())
    body = []
    for m in re.finditer(r'Exodus \d+:(.*?)(?=Exodus \d+:|\Z)', raw, re.S):
        for tk in m.group(1).split():
            if not tk.isdigit():
                body.append(tk)
    text = ' '.join(body)
    chapters = re.split(r'(׃[-–—]+)', text)
    # rebuild chapter units (text up to and including each ׃--)
    units, cur = [], ''
    for piece in chapters:
        if re.fullmatch(r'׃[-–—]+', piece):
            units.append((cur + ' ' + piece).strip()); cur = ''
        else:
            cur += ' ' + piece
    if cur.strip():
        units.append(cur.strip())
    tw, tchap = [], []
    for ci, u in enumerate(units):
        for w in WORD.findall(u):
            tw.append(w); tchap.append(ci)

    # ---- clean DB: words in reading order with (ch:vn) anchor ----
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row
    dw, danchor = [], []
    for r in c.execute('''SELECT ch.number cn, v.number vn, v.text t FROM verses v
            JOIN chapters ch ON ch.id=v.chapter_id JOIN books b ON b.id=ch.book_id
            WHERE b.name=? ORDER BY ch.number, v.number''', ('שמות',)):
        for w in WORD.findall(r['t'] or ''):
            dw.append(w); danchor.append((r['cn'], r['vn']))
    c.close()

    sm = SequenceMatcher(None, dw, tw, autojunk=False)
    inserted = [False] * len(tw)
    anchor_at = {}
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ('insert', 'replace'):
            for j in range(j1, j2):
                inserted[j] = True
            anchor_at[tchap[j1]] = danchor[i1 - 1] if i1 > 0 else ('-', '-')

    # per chapter: total words and inserted words
    from collections import defaultdict
    tot, ins = defaultdict(int), defaultdict(int)
    first_words = {}
    for j, ci in enumerate(tchap):
        tot[ci] += 1
        if inserted[j]:
            ins[ci] += 1
        first_words.setdefault(ci, [])
        if len(first_words[ci]) < 9:
            first_words[ci].append(tw[j])

    missing = [ci for ci in sorted(tot)
               if tot[ci] >= 6 and ins[ci] / tot[ci] >= 0.6]
    print('TXT Samaritan chapters total: %d' % len(tot))
    print('=== chapters MISSING from the clean DB (>=60%% words absent) : %d ===' % len(missing))
    for ci in missing:
        a = anchor_at.get(ci, ('?', '?'))
        print('  after %s:%s  (%d/%d words new)  «%s …»'
              % (a[0], a[1], ins[ci], tot[ci], ' '.join(first_words[ci])))


if __name__ == '__main__':
    main()
