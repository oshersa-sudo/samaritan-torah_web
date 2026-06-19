# -*- coding: utf-8 -*-
"""
Build a CLEAN Hebrew meaning (+ root) for EVERY distinct Samaritan-Aramaic Targum
word in the Torah, so the "מילון מילים" table's "מילון טל" column is populated for
all words — not just the ~1,455 that appear in Tal's limited published index
(tal_index.md). Words like טלמס, which the index misses, now get a meaning.

For each word the model is given its most-common Hebrew equivalent (the anchor,
from verse_dictionary), the candidate root + entry text from Tal's index/dictionary
where it resolves, and returns {root, short Hebrew meaning} — anchored on the
Hebrew equivalent, enriched by Tal where available. Stored in tal_word_gloss;
read by database.tal_concise(). Resumable; DB backed up; lock-safe.

Usage:  py -3 scripts/build_full_tal_glosses.py [--book בראשית]   # default: whole Torah
"""
import sqlite3, sys, io, os, re, json, time, shutil
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
PROG = 'data/_full_tal_progress.json'
NIK = re.compile('[֑-ׇ]')
BATCH = 18
BOOK = None
if '--book' in sys.argv:
    BOOK = sys.argv[sys.argv.index('--book') + 1]
SYS = ('אתה מילונאי מומחה לארמית שומרונית (מילון א. טל). לכל מילה ארמית תן: שורש '
       '(r) ופירוש עברי קצר של 1–4 מילים (g). **המקבילה העברית שניתנה היא העוגן '
       'העיקרי למשמעות** — אל תיתן פירוש הסותר אותה; השתמש בשורש-המועמד ובטקסט '
       'הערך ממילון טל (שעלול להיות משובש מ-OCR) רק לחידוד. בלי ציטוטים, מקורות '
       'או מספרי-פסוקים.')


def api_key():
    k = os.environ.get('ANTHROPIC_API_KEY', '')
    if not k and os.path.exists('.env'):
        for l in open('.env', encoding='utf-8'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                k = l.split('=', 1)[1].strip().strip('"\'')
    return k


def bare(w):
    return NIK.sub('', (w or '')).strip(' .,;:!?"\'־׳״-()[]')


def variants(b):
    f = [b]
    if len(b) > 2 and b[0] in 'ובלכדמה':
        f.append(b[1:])
    if len(b) > 2 and b[-1] in 'אה':
        f.append(b[:-1])
        if b[0] in 'ובלכדמה' and len(b) > 3:
            f.append(b[1:-1])
    return f


def resolve(conn, word):
    """(root, entry_excerpt) from Tal's index→entry, or ('', '')."""
    b = bare(word)
    for f in variants(b):
        r = conn.execute(
            "SELECT dri.root, e.gloss_en, e.notes FROM dict_root_index dri "
            "JOIN dict_root_entries dre ON dre.root = dri.root "
            "JOIN dict_entries e ON e.id = dre.entry_id "
            "WHERE dri.word = ? ORDER BY dre.tier LIMIT 1", (f,)).fetchone()
        if r:
            txt = re.sub(r'\s+', ' ', ((r['gloss_en'] or '') + ' ' + (r['notes'] or '')).strip())[:140]
            return r['root'] or '', txt
    return '', ''


def collect(conn):
    """distinct aramaic word -> {heb (most-common equivalent), root, entry}."""
    where = ''
    args = []
    if BOOK:
        where = ("JOIN verses v ON v.id=vd.verse_id JOIN chapters c ON c.id=v.chapter_id "
                 "JOIN books b ON b.id=c.book_id WHERE b.name=? AND")
        args = [BOOK]
    else:
        where = 'WHERE'
    rows = conn.execute(
        f"""SELECT vd.aramaic, vd.hebrew, COUNT(*) c FROM verse_dictionary vd {where}
            vd.aramaic IS NOT NULL AND TRIM(vd.aramaic) <> ''
            GROUP BY vd.aramaic, vd.hebrew""", args).fetchall()
    best = {}                       # aramaic -> (count, hebrew)
    for r in rows:
        w = r['aramaic'].strip()
        if w not in best or r['c'] > best[w][0]:
            best[w] = (r['c'], (r['hebrew'] or '').replace(',', ' ').strip())
    out = {}
    for w, (_c, heb) in best.items():
        root, entry = resolve(conn, w)
        out[w] = {'heb': heb, 'root': root, 'entry': entry}
    return out


def run_batch(cl, batch):
    items = '\n'.join('- מילה: %s | עברית: %s | שורש-מועמד: %s | ערך(טל): %s'
                      % (w, d['heb'] or '?', d['root'] or '?', d['entry'] or '-') for w, d in batch)
    instr = ('לכל מילה ברשימה החזר JSON object: מפתח=המילה הארמית, ערך=אובייקט '
             '{"r":"שורש","g":"פירוש עברי קצר"}. החזר אך ורק את ה-JSON.\n\n' + items)
    m = cl.messages.create(model='claude-sonnet-4-6', max_tokens=2000, system=SYS,
                           messages=[{'role': 'user', 'content': instr}])
    txt = ''.join(b.text for b in m.content if b.type == 'text')
    mt = re.search(r'\{.*\}', txt, re.S)
    return (json.loads(mt.group(0)) if mt else {}), m.usage


def main():
    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    conn = sqlite3.connect(DB, timeout=120); conn.row_factory = sqlite3.Row
    if not os.path.exists(DB + '.bak_fulltal'):
        shutil.copy2(DB, DB + '.bak_fulltal'); print('backup ->', DB + '.bak_fulltal', flush=True)
    conn.execute('CREATE TABLE IF NOT EXISTS tal_word_gloss '
                 '(word TEXT PRIMARY KEY, root TEXT, gloss TEXT)')
    conn.commit()
    have = set(r[0] for r in conn.execute('SELECT word FROM tal_word_gloss'))
    print('collecting distinct words%s…' % (' for ' + BOOK if BOOK else ' (whole Torah)'), flush=True)
    words = collect(conn)
    todo = [(w, d) for w, d in words.items() if bare(w) not in have]
    print('distinct words: %d   already glossed: %d   to do: %d'
          % (len(words), len(have), len(todo)), flush=True)
    done = json.load(open(PROG, encoding='utf-8')) if os.path.exists(PROG) else {}
    todo = [(w, d) for w, d in todo if w not in done]
    tin = tout = n = 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        try:
            res, u = run_batch(cl, batch)
        except Exception as ex:
            print('  err @%d: %s' % (i, ex), flush=True); time.sleep(3); continue
        tin += u.input_tokens; tout += u.output_tokens
        for w, d in batch:
            r = res.get(w) or {}
            root = (r.get('r') or d['root'] or '').strip()
            gloss = (r.get('g') or '').strip()
            for _t in range(6):
                try:
                    conn.execute('INSERT OR REPLACE INTO tal_word_gloss (word, root, gloss) '
                                 'VALUES (?,?,?)', (bare(w), root, gloss)); break
                except sqlite3.OperationalError:
                    time.sleep(2)
            done[w] = 1; n += 1
        conn.commit()
        json.dump(done, open(PROG, 'w', encoding='utf-8'), ensure_ascii=False)
        if (i // BATCH) % 10 == 0:
            print('  %d/%d  ~$%.2f' % (n, len(todo), tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)
    print('DONE. glossed %d words.  tokens in=%d out=%d  cost ~$%.2f'
          % (n, tin, tout, tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)
    conn.close()


if __name__ == '__main__':
    main()
