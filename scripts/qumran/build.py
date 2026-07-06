"""Extract the Qumran (Dead Sea Scrolls) biblical Pentateuch text from the ETCBC/dss
Text-Fabric data (Martin Abegg's transcriptions; CC-BY-NC 4.0), reconstruct each verse
from its best-preserved scroll, and align verse-by-verse onto verses.qumran_text /
verses.qumran_scroll by the Jewish (Masoretic) division.

Requires a local clone of https://github.com/ETCBC/dss (tf/1.8). Pass its tf path:
  py -3 scripts/qumran/build.py <path-to>/dss/tf/1.8
Writes a durable JSONL (data/qumran/verses.jsonl) and applies to data/torah.db.

Attribution (CC-BY-NC 4.0): transcriptions by Martin G. Abegg, Jr., James E. Bowley and
Edward M. Cook; Text-Fabric conversion by ETCBC (Jarod Jacobs, Martijn Naaijer, Dirk Roorda).
"""
import json
import os
import re
import sqlite3
import sys
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DB = os.path.join(ROOT, 'data', 'torah.db')
JSONL = os.path.join(ROOT, 'data', 'qumran', 'verses.jsonl')
BOOKMAP = {'Gen': 1, 'Ex': 2, 'Exod': 2, 'Lev': 3, 'Num': 4, 'Deut': 5}


def _int(x):
    m = re.match(r'\s*(\d+)', str(x)) if x is not None else None
    return int(m.group(1)) if m else None


# ETCBC/Abegg transcription flags to drop for a readable reading: vowel points, # damaged,
# ° uncertain, ? / ׳ ״ ( ) [ ] reconstruction & uncertainty, ׃ ׀ dividers, / \ * _ + marks.
_FLAGS = re.compile(r'[֑-ׇ#°?׳״()\[\]׃׀/\\*{}<>_+]')


def _clean(raw):
    x = re.sub(r'\s+', ' ', _FLAGS.sub('', raw)).strip()
    # re-glue a lone final letter onto the preceding word first ("אלהי ם" → "אלהים")
    x = re.sub(r'([א-ת])\s+([ךםןףץ])(?=\s|$)', r'\1\2', x)
    # reconstruction splits a damaged word into single letters ("ה ו צ אתיך"); re-glue a
    # lone NON-final Hebrew letter onto the following token (toward the attached Torah form)
    prev = None
    while x != prev:
        prev = x
        x = re.sub(r'(?<![א-ת])([אבגדהוזחטיכלמנסעפצקרשת])\s+(?=[א-ת])', r'\1', x)
    return x.strip()


def _letters(s):
    return len(re.sub(r'[^א-ת]', '', s))


def extract(tf_loc):
    from tf.fabric import Fabric
    TF = Fabric(locations=tf_loc, silent='deep')
    api = TF.load('book chapter verse scroll biblical full after otype', silent='deep')
    F, L = api.F, api.L
    # (o,ch,vs) -> scroll_node -> [(word_node, full, after)]
    agg = defaultdict(lambda: defaultdict(list))
    for w in F.otype.s('word'):
        if not F.biblical.v(w):
            continue
        o = BOOKMAP.get(F.book.v(w))
        if not o:
            continue
        ch, vs = _int(F.chapter.v(w)), _int(F.verse.v(w))
        if not ch or not vs:
            continue
        scn = L.u(w, 'scroll')
        agg[(o, ch, vs)][scn[0] if scn else 0].append(
            (w, F.full.v(w) or '', F.after.v(w) or ''))
    recs = {}
    for (o, ch, vs), scrolls in agg.items():
        best_txt, best_sc, best_n = '', '', 0
        for scn, words in scrolls.items():
            raw = ''.join(f + a for _, f, a in sorted(words))
            txt = _clean(raw)
            n = _letters(txt)
            if n > best_n:                        # best-preserved witness = most surviving letters
                best_txt, best_sc, best_n = txt, (F.scroll.v(scn) if scn else '?'), n
        if best_txt:
            recs[(o, ch, vs)] = {'book': o, 'chap': ch, 'verse': vs, 'scroll': best_sc,
                                 'text': best_txt, 'nscrolls': len(scrolls)}
    return recs


def main():
    tf_loc = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'qumran', 'tf', '1.8')
    recs = extract(tf_loc)
    with open(JSONL, 'w', encoding='utf-8') as f:
        for r in sorted(recs.values(), key=lambda r: (r['book'], r['chap'], r['verse'])):
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print('extracted %d Qumran Pentateuch verses → %s' % (len(recs), os.path.basename(JSONL)))
    # apply to DB
    conn = sqlite3.connect(DB)
    cols = [r[1] for r in conn.execute('PRAGMA table_info(verses)')]
    for col in ('qumran_text', 'qumran_scroll'):
        if col not in cols:
            conn.execute('ALTER TABLE verses ADD COLUMN %s TEXT' % col)
    conn.commit()
    rows = conn.execute('''SELECT v.id, b.order_n, c.number jch, v.number num, v.mas_number masn
        FROM verses v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id''').fetchall()
    applied = 0
    for vid, o, jch, num, masn in rows:
        mv = _int(masn) if (masn and str(masn).strip()) else _int(num)
        r = recs.get((o, jch, mv)) if mv else None
        if r:
            conn.execute('UPDATE verses SET qumran_text=?, qumran_scroll=? WHERE id=?',
                         (r['text'], r['scroll'], vid))
            applied += 1
    conn.commit()
    tot = conn.execute("SELECT count(*) FROM verses WHERE qumran_text IS NOT NULL AND trim(qumran_text)<>''").fetchone()[0]
    conn.close()
    print('aligned %d verses; qumran_text now on %d verses' % (applied, tot))


if __name__ == '__main__':
    main()
