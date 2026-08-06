# -*- coding: utf-8 -*-
"""
Regenerate verses.interpretation for בראשית/שמות/ויקרא/במדבר (NOT דברים —
scope approved by the user 2026-08-04) using ONLY Samaritan-tradition
sources — the Samaritan Aramaic Targum (verses.sam_aramaic), the six
verse-linked commentary tables (eyalk/tzdaka/sir/shyt/tm/tradart), and the
word dictionary (word_gloss + meliz_gloss) — never Jewish commentary
(rashi/ramban/cassuto/baal_haturim) or any other outside source. Conflicting
readings across sources are folded in as an explicit "פירוש נוסף".

Writes to a staging JSON checkpoint (data/interp_regen_output.json), NOT
directly into torah.db — a separate load step reviews + applies it.
Resumable: chapters already present in the checkpoint are skipped.

Usage:
  py -3 scripts/regen_interpretation.py            # full run, 8 workers
  py -3 scripts/regen_interpretation.py --pilot     # 3 chapters only (Gen1, sparse Lev, mid Exod)
  py -3 scripts/regen_interpretation.py --limit 20  # first 20 remaining chapters
"""
import os
import sys
import json
import time
import sqlite3
import argparse
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import anthropic

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_ROOT, 'data', 'torah.db')
OUT_PATH = os.path.join(_ROOT, 'data', 'interp_regen_output.json')
MODEL = 'claude-opus-4-8'
BOOKS_SCOPE = (1, 2, 3, 4)  # בראשית שמות ויקרא במדבר


def _load_dotenv():
    p = os.path.join(_ROOT, '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"\''))


_load_dotenv()
client = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

TOOL = {
    'name': 'submit_chapter_commentary',
    'description': 'Submit the synthesized per-verse commentary for this chapter.',
    'input_schema': {
        'type': 'object',
        'properties': {
            'verses': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'number': {'type': 'string', 'description': 'verse number, exactly as given in the input'},
                        'commentary': {'type': 'string', 'description': 'flowing Hebrew prose, or empty string if nothing grounded to say'},
                    },
                    'required': ['number', 'commentary'],
                },
            },
        },
        'required': ['verses'],
    },
}

SYSTEM = (
    "אתה חוקר מומחה במסורת הפרשנות השומרונית לתורה. תפקידך: לכתוב פירוש "
    "תמציתי ורציף לכל פסוק בפרק, המבוסס אך ורק על שני סוגי מקורות שסופקו לך "
    "בהודעת המשתמש: "
    "(1) מקורות פרשניים שומרוניים — התרגום הארמי השומרוני, תיבת מרקה, "
    "פירוש צדקה אל-חכים, סוד הלבבות, שו\"ת יעקב בן אהרן הכהן, פירושי אלעזר "
    "בן צדקה ופנחס בן אברהם, ומקורות מסורת שבעל-פה שומרונית נוספים — "
    "כפי שיסופקו, אם יסופקו, לכל פרק. "
    "(2) מילון המילים שסופק (פירוש מילים בודדות מתוך הפסוקים). "
    "אסור בהחלט להיעזר בפרשנות יהודית (רש\"י, רמב\"ן, קאסוטו, בעל הטורים "
    "וכיו\"ב) או בכל ידע חיצוני אחר שאינו בחומר שסופק — גם אם הם ידועים לך "
    "משגרה. אסור להמציא תוכן שאינו נשען על החומר שסופק. "
    "פרקים רבים מקבלים רק תרגום ומילון בלי חומר פרשני עשיר — במקרה כזה כתוב "
    "הערה קצרה מאוד המבוססת על התרגום/המילון בלבד (למשל הבהרת מילה נדירה או "
    "ניסוח התרגום), ואם באמת אין שום דבר משמעותי לומר על פסוק מסוים, החזר "
    "עבורו מחרוזת commentary ריקה — עדיף תמציתי ואמין על פני מנופח או מומצא. "
    "אם יש סתירה של ממש בין המקורות שסופקו לגבי אותו פסוק, הצג תחילה את "
    "הפירוש המרכזי, ואז הוסף משפט נפרד המתחיל במילים 'פירוש נוסף: ' ובו "
    "הקריאה החלופית. "
    "כתוב פרוזה עברית שוטפת בלבד — בלי כותרות Markdown, בלי כוכביות/הדגשה, "
    "בלי רשימות ממוספרות. מותר לצטט מילה או צירוף מהפסוק במירכאות ולפרשו. "
    "היקף — זהו האילוץ החשוב ביותר: המטרה היא פירוש קריא בנוחות, לא אנציקלופדי. "
    "בפסוק רגיל כתוב משפט אחד או שניים קצרים בלבד. גם כשהחומר עשיר מאוד "
    "(למשל בפרק א׳ של בראשית, שעליו נכתב הרבה), בְּרֹר את הנקודה המעניינת "
    "ביותר או שתיים לכל היותר — אל תנסה לכלול את כל מה שנאמר במקורות. "
    "לכל היותר 3 משפטים קצרים לפסוק בודד, ורק כשמדובר בפסוק מרכזי שיש עליו "
    "חומר יוצא דופן. זכור שהפירוש מוצג ברצף לכל פסוקי הפרק יחד — הפירוש "
    "הכולל של הפרק כולו צריך להישאר קריא בנוחות בכמה דקות, לא יותר."
)


def gather_chapter(cur, ch_id, book_name):
    cur.execute(
        'SELECT id, number, text, sam_aramaic FROM verses WHERE sam_ch_id=? '
        'ORDER BY CAST(number AS INTEGER)', (ch_id,))
    verses = [{'id': r[0], 'number': r[1], 'text': r[2] or '', 'aramaic': r[3] or ''}
              for r in cur.fetchall()]
    if not verses:
        return verses, []
    vids = [v['id'] for v in verses]
    qmarks = ','.join('?' * len(vids))

    wg = {}
    cur.execute(f'SELECT verse_id, word, he FROM word_gloss WHERE verse_id IN ({qmarks})', vids)
    for vid, word, he in cur.fetchall():
        wg.setdefault(vid, []).append(f'{word}={he}')
    for v in verses:
        v['word_gloss'] = wg.get(v['id'], [])

    mz = {}
    cur.execute(f'''SELECT v.id, m.lemma, m.hebrew, m.arabic FROM meliz_gloss m
                    JOIN books b ON b.order_n = m.book
                    JOIN chapters c ON c.book_id = b.id AND c.number = m.chap
                    JOIN verses v ON v.chapter_id = c.id AND v.number = m.verse
                    WHERE v.id IN ({qmarks})''', vids)
    for vid, lemma, heb, ar in cur.fetchall():
        mz.setdefault(vid, []).append(f'{lemma}: {heb or ar or ""}')
    for v in verses:
        v['meliz'] = mz.get(v['id'], [])

    sources = []
    for link_t, sect_t, col, label in [
        ('eyalk_verse_links', 'eyalk_sections', 'text', 'מסורת שבעל-פה שומרונית'),
        ('tzdaka_verse_links', 'tzdaka_sections', 'text', 'פירוש צדקה אל-חכים'),
        ('sir_verse_links', 'sir_sections', 'text', 'סוד הלבבות'),
        ('shyt_verse_links', 'shyt_sections', 'text', 'שו"ת יעקב בן אהרן הכהן'),
        ('tm_verse_links', 'tm_sections', 'hebrew', 'תיבת מרקה'),
        ('tradart_verse_links', 'tradart_sections', 'text', 'מאמר מסורת שומרונית'),
    ]:
        cur.execute(f'''SELECT s.id, s.{col}, GROUP_CONCAT(DISTINCT v.number)
                        FROM {link_t} l JOIN {sect_t} s ON s.id=l.section_id
                        JOIN verses v ON v.id=l.verse_id
                        WHERE l.verse_id IN ({qmarks})
                        GROUP BY s.id''', vids)
        for sid, text, vnums in cur.fetchall():
            if text and text.strip():
                sources.append({'label': label, 'verses': vnums or '', 'text': text.strip()})
    return verses, sources


def build_prompt(book_name, ch_number, verses, sources):
    lines = [f'ספר: {book_name} | פרק שומרוני מס\' {ch_number}', '']
    lines.append('== פסוקי הפרק ==')
    for v in verses:
        lines.append(f'פסוק {v["number"]}: {v["text"]}')
        if v['aramaic']:
            lines.append(f'  תרגום ארמי שומרוני: {v["aramaic"]}')
        if v['word_gloss']:
            lines.append('  מילון מילים: ' + '; '.join(v['word_gloss']))
        if v['meliz']:
            lines.append('  המליץ (מילון עברי-ערבי שומרוני): ' + '; '.join(v['meliz']))
    if sources:
        lines.append('')
        lines.append('== מקורות פרשניים שומרוניים לפרק (לפי פסוקים רלוונטיים) ==')
        for i, s in enumerate(sources, 1):
            lines.append(f'[מקור {i} — {s["label"]}, נוגע לפסוק/ים {s["verses"]}]')
            lines.append(s['text'])
            lines.append('')
    else:
        lines.append('')
        lines.append('(לא נמצא לפרק זה חומר פרשני שומרוני מיוחד — הסתמך על התרגום הארמי ומילון המילים בלבד.)')
    lines.append('')
    lines.append('כתוב פירוש לכל אחד מפסוקי הפרק, לפי ההנחיות שבהודעת המערכת.')
    return '\n'.join(lines)


def call_model(prompt, retries=4):
    for attempt in range(retries):
        try:
            msg = client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=SYSTEM,
                tools=[TOOL],
                tool_choice={'type': 'tool', 'name': 'submit_chapter_commentary'},
                messages=[{'role': 'user', 'content': prompt}],
            )
            for block in msg.content:
                if block.type == 'tool_use':
                    return block.input
            raise RuntimeError('no tool_use block in response')
        except Exception as e:
            wait = 2 ** attempt
            print(f'  retry {attempt+1}/{retries} after error: {e} (sleep {wait}s)', file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError('call_model: exhausted retries')


_lock = threading.Lock()


def process_chapter(ch_id, book_id, book_name, ch_number):
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        verses, sources = gather_chapter(cur, ch_id, book_name)
        if not verses:
            return ch_id, {}
        prompt = build_prompt(book_name, ch_number, verses, sources)
        result = call_model(prompt)
        # map verse number -> verse id (numbers are unique within a chapter)
        num_to_id = {str(v['number']): v['id'] for v in verses}
        out = {}
        raw_list = result.get('verses', []) if isinstance(result, dict) else []
        for item in raw_list:
            if not isinstance(item, dict):
                continue
            vid = num_to_id.get(str(item.get('number', '')).strip())
            if vid is None:
                continue
            txt = (item.get('commentary') or '').strip()
            if txt:
                out[vid] = txt
        return ch_id, out
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pilot', action='store_true')
    ap.add_argument('--limit', type=int, default=None)
    ap.add_argument('--workers', type=int, default=8)
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('SELECT id, name FROM books')
    book_names = dict(cur.fetchall())

    if args.pilot:
        cur.execute('''SELECT id FROM sam_chapters WHERE book_id=1 AND number=1''')
        gen1 = cur.fetchone()[0]
        cur.execute('''SELECT id FROM sam_chapters WHERE book_id=3 AND number=5''')
        lev5 = cur.fetchone()[0]
        cur.execute('''SELECT sc.id FROM sam_chapters sc
                       WHERE sc.book_id=2 AND EXISTS(
                         SELECT 1 FROM verses v WHERE v.sam_ch_id=sc.id AND v.id IN (
                           SELECT verse_id FROM shyt_verse_links UNION SELECT verse_id FROM tm_verse_links))
                       ORDER BY sc.number LIMIT 1''')
        exod_row = cur.fetchone()
        targets = [gen1, lev5] + ([exod_row[0]] if exod_row else [])
    else:
        cur.execute(f'''SELECT id FROM sam_chapters WHERE book_id IN {BOOKS_SCOPE} ORDER BY book_id, number''')
        targets = [r[0] for r in cur.fetchall()]

    checkpoint = {}
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH, encoding='utf-8') as f:
            checkpoint = json.load(f)

    todo = [cid for cid in targets if str(cid) not in checkpoint]
    if args.limit:
        todo = todo[:args.limit]
    print(f'{len(targets)} target chapters, {len(todo)} remaining to process.')

    cur.execute('SELECT id, book_id, number FROM sam_chapters')
    ch_info = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
    conn.close()

    done_count = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {}
        for cid in todo:
            book_id, ch_number = ch_info[cid]
            futs[ex.submit(process_chapter, cid, book_id, book_names[book_id], ch_number)] = cid
        for fut in as_completed(futs):
            cid = futs[fut]
            book_id, ch_number = ch_info[cid]
            try:
                _, out = fut.result()
                checkpoint[str(cid)] = {str(vid): txt for vid, txt in out.items()}
                done_count += 1
                if done_count % 10 == 0 or done_count == len(todo):
                    with _lock:
                        with open(OUT_PATH, 'w', encoding='utf-8') as f:
                            json.dump(checkpoint, f, ensure_ascii=False, indent=1)
                    print(f'[{done_count}/{len(todo)}] checkpoint saved '
                          f'(last: {book_names[book_id]} ch.{ch_number})')
            except Exception as e:
                print(f'FAILED chapter {cid} ({book_names[book_id]} ch.{ch_number}): {e}', file=sys.stderr)

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=1)
    print(f'Done. {len(checkpoint)} chapters in checkpoint at {OUT_PATH}')


if __name__ == '__main__':
    main()
