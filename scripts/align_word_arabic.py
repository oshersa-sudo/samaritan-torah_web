# -*- coding: utf-8 -*-
"""
Populate a word-aligned Arabic column on verse_dictionary, for the "מילון מילים"
table (column "ערבית"). The DB's arabic_trans is reliably aligned to its verse
only through ~Gen 2:17 (it drifts afterwards), so only that range is aligned.

For each verse, the model is given the ordered Hebrew words and the verse's
Arabic translation, and returns the Arabic word(s) that render each Hebrew word
(or "" when none). Adds an additive `arabic` column to verse_dictionary; backed
up first; resumable.

Usage:  py -3 scripts/align_word_arabic.py            # Gen 1:1–2:17
"""
import sqlite3, sys, io, os, re, json, time, shutil

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
PROG = 'data/_arabic_align_progress.json'
SYS = ('אתה מיישר מילים בין פסוק עברי/ארמי שומרוני לבין תרגומו הערבי. '
       'אתה מקבל את מילות הפסוק העברי לפי הסדר ואת התרגום הערבי, ומחזיר עבור כל '
       'מילה עברית את המילה/ים בערבית שמתרגמות אותה.')


def api_key():
    k = os.environ.get('ANTHROPIC_API_KEY', '')
    if not k and os.path.exists('.env'):
        for l in open('.env', encoding='utf-8'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                k = l.split('=', 1)[1].strip().strip('"\'')
    return k


def reliable_verses(conn):
    """ids of verses whose arabic_trans is trustworthy: Gen ch1 + ch2 v1-17."""
    out = []
    for r in conn.execute(
            """SELECT v.id, c.number ch, v.number vn, v.arabic_trans ar
               FROM verses v JOIN chapters c ON c.id=v.chapter_id
               JOIN books b ON b.id=c.book_id
               WHERE b.name='בראשית' AND c.number<=2 ORDER BY c.number, CAST(v.number AS INTEGER)"""):
        if not str(r['vn']).isdigit():
            continue
        vn = int(r['vn'])
        if (r['ch'] == 1 or (r['ch'] == 2 and vn <= 17)) and (r['ar'] or '').strip():
            out.append(r['id'])
    return out


def align(cl, words, arabic):
    instr = ('מילות הפסוק (לפי הסדר):\n'
             + '\n'.join('%d. %s' % (i + 1, w) for i, w in enumerate(words))
             + '\n\nהתרגום הערבי של הפסוק:\n' + arabic
             + '\n\nהחזר JSON array של מחרוזות באורך %d, לפי הסדר — בכל תא המילה/ים '
               'בערבית שמתרגמות את המילה העברית באותו מספר, או "" אם אין. '
               'החזר אך ורק את ה-JSON.' % len(words))
    m = cl.messages.create(model='claude-sonnet-4-6', max_tokens=1500, system=SYS,
                           messages=[{'role': 'user', 'content': instr}])
    txt = ''.join(b.text for b in m.content if b.type == 'text')
    mt = re.search(r'\[.*\]', txt, re.S)
    arr = json.loads(mt.group(0)) if mt else []
    return arr, m.usage


def main():
    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    if not os.path.exists(DB + '.bak_arabicalign'):
        shutil.copy2(DB, DB + '.bak_arabicalign'); print('backup ->', DB + '.bak_arabicalign', flush=True)
    conn = sqlite3.connect(DB, timeout=120); conn.row_factory = sqlite3.Row
    cols = [r[1] for r in conn.execute('PRAGMA table_info(verse_dictionary)')]
    if 'arabic' not in cols:
        conn.execute('ALTER TABLE verse_dictionary ADD COLUMN arabic TEXT'); conn.commit()
        print('added verse_dictionary.arabic column', flush=True)
    done = json.load(open(PROG, encoding='utf-8')) if os.path.exists(PROG) else {}
    vids = reliable_verses(conn)
    tin = tout = n = 0
    for vid in vids:
        if str(vid) in done:
            continue
        rows = conn.execute('SELECT id, hebrew FROM verse_dictionary WHERE verse_id=? ORDER BY id',
                            (vid,)).fetchall()
        if not rows:
            done[str(vid)] = 0; continue
        ar = conn.execute('SELECT arabic_trans FROM verses WHERE id=?', (vid,)).fetchone()[0]
        words = [(r['hebrew'] or '').split(',')[0].strip() for r in rows]
        try:
            arr, u = align(cl, words, ar)
        except Exception as ex:
            print('  err vid=%d: %s' % (vid, ex), flush=True); time.sleep(3); continue
        tin += u.input_tokens; tout += u.output_tokens; n += 1
        for r, a in zip(rows, arr + [''] * (len(rows) - len(arr))):
            for _t in range(6):
                try:
                    conn.execute('UPDATE verse_dictionary SET arabic=? WHERE id=?',
                                 ((a or '').strip(), r['id'])); break
                except sqlite3.OperationalError:
                    time.sleep(2)
        conn.commit()
        done[str(vid)] = 1
        json.dump(done, open(PROG, 'w', encoding='utf-8'))
    print('DONE. aligned %d verses.  tokens in=%d out=%d  cost ~$%.2f'
          % (n, tin, tout, tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)
    conn.close()


if __name__ == '__main__':
    main()
