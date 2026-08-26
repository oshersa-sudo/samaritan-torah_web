# -*- coding: utf-8 -*-
"""Weave the three booklets into פירוש הפסוק, where they speak about a verse.

The booklets already stand as a linked source under "מן המסורת השומרונית".
This is the second pass the reader asked for: folding what they say into the
commentary prose itself, in the name of whoever says it.

ONLY THE VERSE-SPECIFIC LINKS. A booklet reaches a verse two ways:

  * a citation that names THAT verse - "(ויקרא י"ג, 45)", "(דברים כ"ד, 8-9)".
    72 verses. The booklet is saying something about that verse, and it can be
    woven into that verse's commentary.
  * topically - the whole of ויקרא י"ג-י"ד, or a heading word that places a
    section on a stretch of verses. 104 verses. Weaving these would copy one
    booklet paragraph into 116 commentaries, and every verse of the leprosy
    chapters would say the same thing. That is exactly the repetition just
    taken out of the panel, so it is not done. Those verses keep the booklet as
    a source card, which is the right shape for a topical work.

Each verse is sent alone: its text, its present commentary, and the booklet
passage. What comes back replaces the commentary only if it still contains the
old one - the pass may only ADD, never quietly rewrite what is already there.

Usage: py -3 scripts/booklets/weave_into_interp.py [--apply] [--limit N]
"""
import difflib
import io
import json
import os
import re
import sqlite3
import sys
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.join(_ROOT, 'scripts'))

import import_booklets as B                                   # noqa: E402

# import_booklets rebinds sys.stdout to a wrapper over the same buffer; take
# it back by reconfiguring rather than wrapping again, or the first wrapper is
# collected and closes the buffer out from under this one.
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = B.DB
BACKUP = os.path.join(_ROOT, 'data', 'interp_weave_backup.json')
MODEL = 'claude-opus-4-8'
APPLY = '--apply' in sys.argv
LIMIT = None
if '--limit' in sys.argv:
    LIMIT = int(sys.argv[sys.argv.index('--limit') + 1])

SYSTEM = (
    'אתה עורך את "פירוש הפסוק" של אפליקציית התורה השומרונית. '
    'הפירוש כתוב עברית, בלשון פרשנית מרוסנת, ומביא כל דבר בשם אומרו.\n\n'
    'תקבל פסוק, את הפירוש הקיים לו, וקטע מתוך ספרון מחקרי שומרוני שמצטט את '
    'הפסוק הזה במפורש. שלב את מה שהספרון אומר על הפסוק לתוך הפירוש.\n\n'
    'כללים:\n'
    '1. אל תמחק ואל תנסח מחדש את הפירוש הקיים. הוא נשאר כלשונו. אתה מוסיף בלבד.\n'
    '2. הוסף רק מה שהספרון אומר על הפסוק הזה. אל תוסיף רקע על הספרון, על מחברו '
    'או על כתבי היד שלו.\n'
    '3. הבא בשם אומרו: "לפי ספר הצרעת השומרוני...", "יוסף בן סלאמה מבאר...", '
    '"ורשנר מראה...". אם הספרון מייחס דבר לאדם מסוים, השתמש בשמו.\n'
    '4. אם הספרון אינו אומר דבר על הפסוק הזה עצמו — החזר את הפירוש הקיים ללא '
    'שינוי כלל.\n'
    '5. משפט או שניים. אל תאריך.\n'
    '6. החזר את הפירוש המלא בלבד — הקיים ואחריו התוספת. בלי כותרות, בלי הסברים, '
    'בלי סימוני markdown.'
)


def client():
    import anthropic
    env = os.path.join(_ROOT, '.env')
    if os.path.exists(env):
        for line in io.open(env, encoding='utf-8', errors='replace'):
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        sys.exit('ANTHROPIC_API_KEY not set (checked .env and environment)')
    return anthropic.Anthropic(api_key=key, timeout=600.0, max_retries=5)


def targets():
    """{verse_id: [(booklet, title, text)]} for verse-specific links only."""
    conn = sqlite3.connect(DB)
    by_ch, by_v = B.chapter_verses(conn)
    out = {}
    for b in B.BOOKLETS:
        path = os.path.join(B.SRC, b['file'])
        for title, text in B.sections(B.paragraphs(path), b['short']):
            for m in B.CITE.finditer(text):
                book, c1, c2, v1, v2 = m.groups()
                f = B.num(v1)
                a = B.num(c1)
                if not f or not a:
                    continue                      # chapter-only: topical, skipped
                g = B.num(v2)
                bid = B.BOOK_ID[book]
                for vn in range(f, (g if (g and g >= f) else f) + 1):
                    vid = by_v.get((bid, a, vn))
                    if vid:
                        out.setdefault(vid, [])
                        if (b['short'], title, text) not in out[vid]:
                            out[vid].append((b['short'], title, text))
    conn.close()
    return out


def main():
    tgt = targets()
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = []
    for vid, items in tgt.items():
        r = conn.execute(
            'SELECT v.id, b.name AS book, ch.number AS ch, v.number AS vn, '
            "       COALESCE(v.text,'') AS vt, COALESCE(v.interpretation,'') AS t "
            '  FROM verses v JOIN chapters ch ON ch.id = v.chapter_id '
            '  JOIN books b ON b.id = ch.book_id WHERE v.id = ?', (vid,)).fetchone()
        if r:
            rows.append((r, items))
    rows.sort(key=lambda x: (x[0]['book'], x[0]['ch'], x[0]['vn']))
    if LIMIT:
        rows = rows[:LIMIT]

    print('verses a booklet cites by name: %d' % len(rows))
    per = {}
    for r, items in rows:
        for s, _t, _x in items:
            per[s] = per.get(s, 0) + 1
    print('  by booklet: %s' % per)
    print('  of them with no commentary yet: %d'
          % sum(1 for r, _ in rows if not r['t'].strip()))
    if not APPLY:
        for r, items in rows[:10]:
            print('   %-8s %s:%-3s  <- %s' % (r['book'], r['ch'], r['vn'],
                                              ', '.join(s for s, _t, _x in items)[:52]))
        print('\n(report only - pass --apply to write)')
        return

    cl = client()
    done, changed, skipped, log = 0, 0, 0, []
    for r, items in rows:
        src = '\n\n'.join('מתוך "%s" — %s:\n%s' % (s, t, x) for s, t, x in items)
        user = ('הפסוק (%s %s:%s):\n%s\n\nהפירוש הקיים:\n%s\n\nקטע הספרון:\n%s'
                % (r['book'], r['ch'], r['vn'], r['vt'],
                   r['t'] or '(אין פירוש קיים)', src))
        try:
            resp = cl.messages.create(model=MODEL, max_tokens=1200, system=SYSTEM,
                                      messages=[{'role': 'user', 'content': user}])
            new = ''.join(b.text for b in resp.content if b.type == 'text').strip()
        except Exception as e:
            print('  ! %s %s:%s  %s' % (r['book'], r['ch'], r['vn'], str(e)[:70]))
            continue
        done += 1
        new = re.sub(r'^\s*#{1,6}\s+.*$', '', new, flags=re.M).replace('**', '').strip()
        old = (r['t'] or '').strip()
        # the pass may only ADD. If the old commentary is no longer inside the new
        # one, it was rewritten rather than extended, and it is refused.
        if old:
            keeps = difflib.SequenceMatcher(None, old.split(), new.split())
            kept = sum(bl.size for bl in keeps.get_matching_blocks())
            if kept < 0.9 * len(old.split()):
                skipped += 1
                log.append(dict(id=r['id'], why='rewrote instead of adding',
                                old=old, new=new))
                continue
        if new == old or not new:
            skipped += 1
            continue
        log.append(dict(id=r['id'], book=r['book'], ch=r['ch'], vn=r['vn'],
                        old=old, new=new))
        conn.execute('UPDATE verses SET interpretation = ? WHERE id = ?', (new, r['id']))
        changed += 1
        if changed % 10 == 0:
            conn.commit()
            print('   ... %d/%d changed' % (changed, done))
        time.sleep(0.2)
    conn.commit()
    json.dump(log, io.open(BACKUP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\nasked %d, changed %d, left alone %d' % (done, changed, skipped))
    print('before/after of every change: %s' % os.path.relpath(BACKUP, _ROOT))


if __name__ == '__main__':
    main()
