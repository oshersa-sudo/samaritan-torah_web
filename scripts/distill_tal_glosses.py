# -*- coding: utf-8 -*-
"""
Distil a SHORT, clean Hebrew meaning for each Samaritan-Aramaic Targum word that
resolves to a Tal-dictionary entry (via the authoritative index → root → entry),
so the "מילון מילים" table can show a real meaning instead of the noisy OCR gloss.

Scope: distinct Targum words appearing in Genesis 1–6 (the range covered by the
new sources). For each word the model gets the root, the Hebrew equivalent, and
the (often OCR-garbled) entry text, and returns a concise Hebrew gloss. Results
go to a new table tal_word_gloss(word, root, gloss); tal_concise() reads it.

Usage:  py -3 scripts/distill_tal_glosses.py --count    # how many words / cost
        py -3 scripts/distill_tal_glosses.py            # distil + store
"""
import sqlite3, sys, io, os, re, json, time, shutil

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
PROG = 'data/_tal_distill_progress.json'
NIK = re.compile('[֑-ׇ]')
COUNT = '--count' in sys.argv
BATCH = 15
SYS = ('אתה מילונאי מומחה לארמית שומרונית. עבור כל מילה ארמית תן פירוש עברי קצר '
       '(2–5 מילים) של משמעותה. **המקבילה העברית שניתנה היא העוגן העיקרי '
       'למשמעות** — לעולם אל תיתן פירוש הסותר אותה; השתמש בשורש ובטקסט הערך '
       'ממילון א. טל (שעלול להיות משובש מ-OCR) רק כדי לחדד או להעשיר, לא להחליף. '
       'אל תכתוב ציטוטים, מקורות או מספרי-פסוקים — רק את המשמעות בעברית.')


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
    """(root, entry_notes_excerpt) via index→root→entry, or None."""
    b = bare(word)
    if not b or len(b) < 2:
        return None
    for f in variants(b):
        r = conn.execute(
            "SELECT dri.root, e.gloss_en, e.notes FROM dict_root_index dri "
            "JOIN dict_root_entries dre ON dre.root = dri.root "
            "JOIN dict_entries e ON e.id = dre.entry_id "
            "WHERE dri.word = ? ORDER BY dre.tier LIMIT 1", (f,)).fetchone()
        if r:
            txt = ((r['gloss_en'] or '') + ' ' + (r['notes'] or '')).strip()
            txt = re.sub(r'\s+', ' ', txt)[:160]
            return r['root'], txt
    return None


def collect(conn):
    """distinct Targum word -> (root, entry_excerpt, sample_hebrew) for Gen 1-6."""
    rows = conn.execute(
        """SELECT DISTINCT vd.aramaic, vd.hebrew FROM verse_dictionary vd
           JOIN verses v ON v.id = vd.verse_id
           JOIN chapters c ON c.id = v.chapter_id JOIN books b ON b.id = c.book_id
           WHERE b.name='בראשית' AND c.number<=6""").fetchall()
    seen, out = set(), {}
    for r in rows:
        w = (r['aramaic'] or '').strip()
        if not w or w in seen:
            continue
        seen.add(w)
        res = resolve(conn, w)
        if res:
            out[w] = {'root': res[0], 'entry': res[1],
                      'heb': (r['hebrew'] or '').replace(',', ' ').strip()}
    return out


def distil(cl, batch):
    items = '\n'.join('- מילה: %s | שורש: %s | עברית: %s | ערך(טל): %s'
                      % (w, d['root'], d['heb'], d['entry']) for w, d in batch)
    instr = ('תן לכל מילה ברשימה פירוש עברי קצר. החזר JSON object בלבד, מפתח=המילה '
             'הארמית, ערך=הפירוש העברי הקצר.\n\n' + items)
    m = cl.messages.create(model='claude-sonnet-4-6', max_tokens=1500, system=SYS,
                           messages=[{'role': 'user', 'content': instr}])
    txt = ''.join(b.text for b in m.content if b.type == 'text')
    mt = re.search(r'\{.*\}', txt, re.S)
    return (json.loads(mt.group(0)) if mt else {}), m.usage


def main():
    conn = sqlite3.connect(DB, timeout=120); conn.row_factory = sqlite3.Row
    words = collect(conn)
    print('distinct Gen 1-6 Targum words resolving to a Tal entry: %d' % len(words), flush=True)
    if COUNT:
        # rough estimate: ~120 in + ~25 out tokens per word, sonnet pricing
        est = len(words) * (120 / 1e6 * 3 + 25 / 1e6 * 15)
        print('estimated cost ~$%.2f' % est); conn.close(); return

    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    if not os.path.exists(DB + '.bak_taldistill'):
        shutil.copy2(DB, DB + '.bak_taldistill'); print('backup ->', DB + '.bak_taldistill', flush=True)
    conn.execute('CREATE TABLE IF NOT EXISTS tal_word_gloss '
                 '(word TEXT PRIMARY KEY, root TEXT, gloss TEXT)')
    conn.commit()
    done = json.load(open(PROG, encoding='utf-8')) if os.path.exists(PROG) else {}
    todo = [(w, d) for w, d in words.items() if w not in done]
    tin = tout = n = 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        try:
            res, u = distil(cl, batch)
        except Exception as ex:
            print('  err batch %d: %s' % (i, ex), flush=True); time.sleep(3); continue
        tin += u.input_tokens; tout += u.output_tokens
        for w, d in batch:
            g = (res.get(w) or '').strip()
            for _t in range(6):
                try:
                    conn.execute('INSERT OR REPLACE INTO tal_word_gloss (word, root, gloss) '
                                 'VALUES (?,?,?)', (bare(w), d['root'], g)); break
                except sqlite3.OperationalError:
                    time.sleep(2)
            done[w] = 1; n += 1
        conn.commit()
        json.dump(done, open(PROG, 'w', encoding='utf-8'), ensure_ascii=False)
        if (i // BATCH) % 5 == 0:
            print('  %d/%d  ~$%.2f' % (n, len(todo), tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)
    print('DONE. distilled %d words.  tokens in=%d out=%d  cost ~$%.2f'
          % (n, tin, tout, tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)
    conn.close()


if __name__ == '__main__':
    main()
