# -*- coding: utf-8 -*-
"""Clear the cells of פירוש הפסוק that hold Torah text instead of commentary.

Two faults, one shape:

  * 362 verses across the Torah whose "commentary" is the verse restated -
    sometimes word for word, niqqud and all (בראשית ל"ו 36, שמות א' 2).
  * ספר דברים, where 406 of 554 non-empty cells are Torah text and 113 of those
    are the text of a DIFFERENT verse, on a systematic chapter offset: the
    commentary of דברים י"ג 3 is "לא תאכל כל התועבה", which is י"ד 3 and has
    nothing to do with a false prophet's sign.

A reader who presses פירוש הפסוק and is handed the verse back has been answered
without being told anything, and one who is handed a different verse has been
misinformed. Both are worse than an empty panel, so both are emptied.

WHAT IS CLEARED - a cell must first carry no mark of commentary at all: no
source named, no explaining verb, nothing glossed. A real commentary that quotes
its verse at length still says something about it, and that is the line. Of what
is left, a cell goes if either:

  a. it is the text of a DIFFERENT verse (>= MIN_RATIO on the consonantal
     skeleton, through a 4-gram index of the whole Torah). Wrong at any
     likeness, so no second test applies.
  b. it is its OWN verse (>= MIN_RATIO) AND adds fewer than MIN_NEW content
     words the verse does not already have.

The second test is what the likeness alone could not do. Ranked by likeness the
two cases interleave: "הלויים שומרים משמרת אהרן ומשמרת כל האהל" sits at 70% and
is worth reading - it names who is doing the guarding, which במדבר י"ח 3 does
not - while "והוציאו את הנערה אל פתח בית אביה וסקלוה אנשי עירה באבנים" sits at
98% and is דברים כ"ב 21 with the colons taken out. What separates them is not
how close they are but whether a reader learns a word from them.

Every cleared cell is written out first, so the change is reversible.

Usage: py -3 scripts/interp/clear_verse_text_cells.py [--apply]
"""
import collections
import difflib
import io
import json
import os
import re
import sqlite3
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB = os.path.join(_ROOT, 'data', 'torah.db')
BACKUP = os.path.join(_ROOT, 'data', 'interp_cleared_backup.json')
APPLY = '--apply' in sys.argv

MIN_RATIO = 0.60
MIN_NEW = 3        # content words a cell must add before it counts as saying something
NG = 4

FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}

# If any of these stands in the cell it is doing something a verse never does:
# naming who said it, explaining, translating, or glossing a word.
COMMENTARY_MARKS = (
    'מבאר', 'מפרש', 'לפי ', 'כדברי', 'לדברי', 'מוסיף', 'מעיר', 'דורש',
    'כלומר', 'היינו', 'עניינו', 'משמעו', 'שפירושו', 'מתורגם', 'תרגום',
    'התרגום', 'המליץ', 'מרקה', 'אל-חכים', 'הכהן', 'מסורת', 'רומז',
    'מכאן', 'ומכאן', 'ללמד', 'טעם', 'משום ש', 'לפיכך', 'ואילו',
)


def skel(s):
    """Consonantal skeleton, word by word: niqqud gone, final forms folded,
    the mothers of reading dropped - so a cell spelled מלא still matches a
    verse spelled חסר."""
    s = re.sub(r'[֑-ׇ]', '', s or '')
    out = []
    for w in re.findall(r'[א-ת]+', s):
        w = re.sub(r'[אהוי]', '', ''.join(FIN.get(c, c) for c in w))
        if w:
            out.append(w)
    return out


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT v.id, b.id AS bid, b.name AS book, ch.number AS ch, v.number AS vn, "
        "       COALESCE(v.text,'') AS vt, COALESCE(v.interpretation,'') AS t "
        "  FROM verses v JOIN chapters ch ON ch.id = v.chapter_id "
        "  JOIN books b ON b.id = ch.book_id "
        " ORDER BY b.id, ch.number, v.id").fetchall()

    gram = collections.defaultdict(set)
    place = {}
    for r in rows:
        sk = skel(r['vt'])
        place[r['id']] = (r['book'], r['ch'], r['vn'], sk)
        for i in range(len(sk) - NG + 1):
            gram[' '.join(sk[i:i + NG])].add(r['id'])

    def looks_like_a_verse(text):
        sk = skel(text)
        if len(sk) < NG:
            return None, 0.0
        hits = collections.Counter()
        for i in range(len(sk) - NG + 1):
            for vid in gram.get(' '.join(sk[i:i + NG]), ()):
                hits[vid] += 1
        if not hits:
            return None, 0.0
        vid, _ = hits.most_common(1)[0]
        return vid, difflib.SequenceMatcher(None, sk, place[vid][3]).ratio()

    doomed, spared = [], []
    for r in rows:
        t = (r['t'] or '').strip()
        if not t:
            continue
        vid, ratio = looks_like_a_verse(t)
        if not vid or ratio < MIN_RATIO:
            continue
        own = (vid == r['id'])
        rec = dict(id=r['id'], book=r['book'], ch=r['ch'], vn=r['vn'], text=t,
                   ratio=round(ratio, 3), matched=place[vid][:3], own=own)
        marks = [m for m in COMMENTARY_MARKS if m in t]
        if marks:
            rec['kept'] = 'explains: ' + ', '.join(marks[:3])
            spared.append(rec)
            continue
        if own:
            # what does it say that its verse did not?
            had = set(skel(r['vt']))
            new = sorted(set(w for w in skel(t) if len(w) >= 2) - had)
            rec['new_words'] = new[:8]
            if len(new) >= MIN_NEW:
                rec['kept'] = 'adds %d words: %s' % (len(new), ' '.join(new[:5]))
                spared.append(rec)
                continue
        doomed.append(rec)

    print('cells that read as Torah text (>= %d%% of some verse): %d'
          % (MIN_RATIO * 100, len(doomed) + len(spared)))
    print('  kept, because they say something              : %d' % len(spared))
    print('  to be cleared                                 : %d' % len(doomed))
    print()
    per = collections.Counter(d['book'] for d in doomed)
    own = sum(1 for d in doomed if d['own'])
    print('  by book: %s' % dict(per))
    print('  the verse handed back        : %d' % own)
    print('  a DIFFERENT verse            : %d' % (len(doomed) - own))
    print()
    print('  kept (a paraphrase that adds something):')
    for s in [x for x in spared if x.get('new_words')][:6]:
        print('    %-8s %s:%-3s %-4s  +%s'
              % (s['book'], s['ch'], s['vn'], '%.0f%%' % (s['ratio'] * 100),
                 ' '.join(s['new_words'][:4])))
        print('        %s' % s['text'][:88])
    print()
    print('  cleared:')
    for d in doomed[:8]:
        tag = 'the verse back' if d['own'] else ('= %s %s:%s' % d['matched'])
        print('    %-8s %s:%-3s %-4s %-18s %s'
              % (d['book'], d['ch'], d['vn'], '%.0f%%' % (d['ratio'] * 100), tag, d['text'][:48]))

    if not APPLY:
        print('\n(report only - pass --apply to clear)')
        return

    json.dump(doomed, io.open(BACKUP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    cur = conn.cursor()
    for d in doomed:
        cur.execute("UPDATE verses SET interpretation = '' WHERE id = ?", (d['id'],))
    conn.commit()
    print('\ncleared %d cells; the old contents are in %s'
          % (len(doomed), os.path.relpath(BACKUP, _ROOT)))
    left = conn.execute(
        "SELECT b.name, COUNT(*) FROM verses v JOIN chapters ch ON ch.id=v.chapter_id "
        "JOIN books b ON b.id=ch.book_id "
        "WHERE COALESCE(TRIM(v.interpretation),'') <> '' GROUP BY b.id ORDER BY b.id").fetchall()
    print('verses left with a commentary: %s' % dict((r[0], r[1]) for r in left))


if __name__ == '__main__':
    main()
