"""
Re-link Tibåt Mårqe sections to Torah verses WITH a semantic-relevance filter.

The "Biblical quotations" index lists every place a verse is quoted/alluded to in
Tibåt Mårqe. Many of those are incidental (a verse cited only as a turn of phrase
in a paragraph about something else). This script reads each paragraph's English
translation and decides whether it genuinely relates to the verse:

  * relevant   -> link kept in tm_verse_links
  * irrelevant -> NOT linked; recorded in data/tibat_marqe_links_review.xlsx

Judgements are cached in data/tibat_marqe_relevance_cache.json so the run is fully
resumable (the API can be re-invoked in chunks).

Usage:
  py -3 scripts/relink_tibat_marqe.py --limit 40     # judge 40 pending (calibration)
  py -3 scripts/relink_tibat_marqe.py                # judge all pending
  py -3 scripts/relink_tibat_marqe.py --apply        # rebuild links + write Excel from cache
"""
import os
import re
import sys
import json
import time
import argparse
import sqlite3

sys.stdout.reconfigure(encoding='utf-8')

DATA  = os.path.join(os.path.dirname(__file__), '..', 'data')
DB    = os.path.join(DATA, 'torah.db')
INDEX = os.path.join(DATA, 'tibat_marqe_index.json')
CACHE = os.path.join(DATA, 'tibat_marqe_relevance_cache.json')
XLSX  = os.path.join(DATA, 'tibat_marqe_links_review.xlsx')

MODEL      = os.environ.get('TM_MODEL', 'claude-sonnet-4-6')
BATCH_SIZE = 5
ENG_BOOK_ORDER = {'Genesis': 1, 'Exodus': 2, 'Leviticus': 3,
                  'Numbers': 4, 'Deuteronomy': 5}
HE_LETTER = {'I': 'א', 'II': 'ב', 'III': 'ג', 'IV': 'ד', 'V': 'ה', 'VI': 'ו'}

SYSTEM = ('אתה חוקר מומחה לספרות שומרונית ולמקרא. תפקידך לקבוע אם פסקה מתוך החיבור '
          'השומרוני "תיבת מרקה" אכן קשורה לפסוק נתון מהתורה.')

RUBRIC = (
    'לכל פריט מופיעים: ציון הפסוק מהתורה (וטקסטו), ופסקה מתיבת מרקה בתרגום אנגלי.\n'
    'קבע לכל פריט אם הפסקה **באמת קשורה** לפסוק — כלומר דנה בו, מפרשת אותו, רומזת אליו '
    'במפורש, או עוסקת בנושא/בהקשר/באירוע של אותו פסוק. '
    'סמן NO אם הפסוק מצוטט רק כבדרך־אגב, כראָיה לשונית לעניין אחר, או שאין קשר תוכני ממשי.\n'
    'החזר שורה אחת לכל פריט, בדיוק בפורמט:\n'
    '<id>|REL|<נימוק קצר>   או   <id>|NO|<נימוק קצר>\n'
)


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not key:
        env = os.path.join(DATA, '..', '.env')
        if os.path.exists(env):
            for line in open(env, encoding='utf-8'):
                if line.strip().startswith('ANTHROPIC_API_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def load_cache():
    if os.path.exists(CACHE):
        return json.load(open(CACHE, encoding='utf-8'))
    return {}


def save_cache(cache):
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


def build_assertions(conn):
    """One assertion per (index-entry, section-ref). Returns list of dicts."""
    index = json.load(open(INDEX, encoding='utf-8'))
    # verse lookup + text
    vlookup, vtext = {}, {}
    for r in conn.execute("""SELECT v.id vid, b.order_n bo, c.number ch, v.number vn, v.text txt
                             FROM verses v JOIN chapters c ON c.id=v.chapter_id
                             JOIN books b ON b.id=c.book_id"""):
        vlookup[(r['bo'], r['ch'], r['vn'])] = r['vid']
        vtext[(r['bo'], r['ch'], r['vn'])] = r['txt']
    sec_id, sec_en = {}, {}
    for r in conn.execute("SELECT id, book, section, english FROM tm_sections"):
        sec_id[(r['book'], r['section'])] = r['id']
        sec_en[(r['book'], r['section'])] = r['english'] or ''

    out = []
    for e in index:
        bo = ENG_BOOK_ORDER[e['book']]
        ref = '%s %s' % (e['book'], e['verse_spec'])
        vids, texts = [], []
        for ch, vn in e['verses']:
            if isinstance(ch, int) and isinstance(vn, int):
                vid = vlookup.get((bo, ch, vn))
                if vid:
                    vids.append(vid)
                    t = vtext.get((bo, ch, vn))
                    if t and len(texts) < 3:
                        texts.append('%d:%d %s' % (ch, vn, t))
        for rom, secs in e['refs']:
            for s in secs:
                sid = sec_id.get((rom, s))
                if not sid:
                    continue
                out.append({
                    'key': '%s|%s|%s|%s' % (e['book'], e['verse_spec'], rom, s),
                    'ref': ref, 'verse_ids': vids, 'verse_text': '  '.join(texts),
                    'tm_book': rom, 'tm_section': s, 'section_id': sid,
                    'english': sec_en.get((rom, s), ''),
                })
    return out


def judge_batch(client, batch):
    parts = []
    for i, a in enumerate(batch, 1):
        eng = ' '.join(a['english'].split()[:230])
        vt = a['verse_text'] or '(טקסט לא זמין)'
        parts.append('=== פריט %d ===\nפסוק: %s\nטקסט הפסוק: %s\nפסקת תיבת מרקה (אנגלית): %s'
                     % (i, a['ref'], vt, eng))
    prompt = RUBRIC + '\n' + '\n\n'.join(parts)
    msg = client.messages.create(model=MODEL, max_tokens=1500, system=SYSTEM,
                                 messages=[{'role': 'user', 'content': prompt}])
    text = msg.content[0].text.strip()
    res = {}
    for line in text.splitlines():
        m = re.match(r'\s*(\d+)\s*\|\s*(REL|NO)\s*\|\s*(.*)', line, re.I)
        if not m:
            continue
        idx = int(m.group(1)) - 1
        if 0 <= idx < len(batch):
            res[batch[idx]['key']] = {'rel': m.group(2).upper() == 'REL',
                                      'reason': m.group(3).strip()}
    return res


def do_judge(limit):
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set'); sys.exit(1)
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout=60000')
    assertions = build_assertions(conn)
    conn.close()
    cache = load_cache()
    pending = [a for a in assertions if a['key'] not in cache]
    if limit:
        pending = pending[:limit]
    print('total assertions: %d  judged: %d  pending(now): %d  (model %s)'
          % (len(assertions), len(cache), len(pending), MODEL))
    done = 0
    for i in range(0, len(pending), BATCH_SIZE):
        batch = pending[i:i + BATCH_SIZE]
        try:
            res = judge_batch(client, batch)
            cache.update(res)
            save_cache(cache)
            done += len(res)
        except Exception as ex:
            print('\n  batch error:', ex); time.sleep(3); continue
        print('  judged %d/%d ...' % (min(i + BATCH_SIZE, len(pending)), len(pending)), flush=True)
    print('\njudged this run: %d   cache total: %d' % (done, len(cache)))


def do_apply():
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout=60000')
    assertions = build_assertions(conn)
    cache = load_cache()
    sec_meta = {}
    for r in conn.execute("SELECT book, section, book_title, aramaic, english, hebrew FROM tm_sections"):
        sec_meta[(r['book'], r['section'])] = r

    links, accepted, rejected, unjudged = set(), [], [], 0
    for a in assertions:
        j = cache.get(a['key'])
        if j is None:
            unjudged += 1
            continue
        m = sec_meta[(a['tm_book'], a['tm_section'])]
        row = {
            'torah_ref': a['ref'],
            'verse_text': a['verse_text'],
            'tm_ref': 'ספר %s §%s' % (HE_LETTER.get(a['tm_book'], a['tm_book']), a['tm_section']),
            'tm_title': m['book_title'],
            'reason': j['reason'],
            'english': (m['english'] or '')[:300],
            'hebrew': (m['hebrew'] or '')[:300],
        }
        if j['rel']:
            accepted.append(row)
            for vid in a['verse_ids']:
                links.add((vid, a['section_id']))
        else:
            rejected.append(row)

    # rebuild link table
    conn.execute("DELETE FROM tm_verse_links")
    conn.executemany("INSERT OR IGNORE INTO tm_verse_links (verse_id, section_id) VALUES (?,?)",
                     sorted(links))
    conn.commit()
    nlink = conn.execute("SELECT count(*) FROM tm_verse_links").fetchone()[0]
    nverse = conn.execute("SELECT count(DISTINCT verse_id) FROM tm_verse_links").fetchone()[0]
    conn.close()

    write_xlsx(accepted, rejected)
    print('applied. relevant links: %d across %d verses' % (nlink, nverse))
    print('accepted assertions: %d   rejected: %d   unjudged(skipped): %d'
          % (len(accepted), len(rejected), unjudged))
    print('review file:', XLSX)


def write_xlsx(accepted, rejected):
    try:
        from openpyxl import Workbook
    except ImportError:
        print('openpyxl missing -> writing CSVs instead')
        import csv
        for name, rows in [('accepted', accepted), ('rejected', rejected)]:
            p = os.path.join(DATA, 'tibat_marqe_links_%s.csv' % name)
            with open(p, 'w', newline='', encoding='utf-8-sig') as f:
                w = csv.writer(f)
                w.writerow(['torah_ref', 'verse_text', 'tm_ref', 'tm_title', 'reason', 'english', 'hebrew'])
                for r in rows:
                    w.writerow([r['torah_ref'], r['verse_text'], r['tm_ref'], r['tm_title'],
                                r['reason'], r['english'], r['hebrew']])
        return
    wb = Workbook()
    cols = ['torah_ref', 'verse_text', 'tm_ref', 'tm_title', 'reason', 'english', 'hebrew']
    heads = ['פסוק', 'טקסט הפסוק', 'תיבת מרקה', 'שם המימר', 'נימוק', 'אנגלית', 'עברית']
    for sheetname, rows in [('נדחו (לא קושרו)', rejected), ('קושרו', accepted)]:
        ws = wb.create_sheet(sheetname)
        ws.append(heads)
        for r in rows:
            ws.append([r[c] for c in cols])
    wb.remove(wb['Sheet'])
    wb.save(XLSX)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    if args.apply:
        do_apply()
    else:
        do_judge(args.limit)


if __name__ == '__main__':
    main()
