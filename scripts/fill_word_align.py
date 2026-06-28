# -*- coding: utf-8 -*-
"""Build a per-token alignment table (word_align) that fills the words the original
verse_dictionary glossary never covered — so EVERY word in the מילון מילים panel
gets at least an Aramaic, Arabic and English rendering plus a Hebrew gloss.

For each verse we compute the exact gap positions (the text tokens that the display
matcher still leaves with no Aramaic — see app.services.database.get_dict_select),
then ask the model to align ONLY those Hebrew words to the verse's existing Aramaic
Targum (sam_aramaic), Arabic translation (arabic_trans) and English translation
(english), returning the corresponding word(s) from each plus a concise Hebrew gloss.

Stored in word_align(verse_id, pos, ar, arab, en, he). Resumable; backed up first.

Model: claude-sonnet-4-6 (override WA_MODEL). Usage:
  py -3 scripts/fill_word_align.py --estimate
  py -3 scripts/fill_word_align.py --sample 3
  py -3 scripts/fill_word_align.py
"""
import argparse, io, json, os, re, sqlite3, sys, time, shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import app.services.database as db

DB = 'data/torah.db'
PROG = 'data/_word_align_progress.json'
MODEL = os.environ.get('WA_MODEL', 'claude-sonnet-4-6')
SYS = ('אתה מיישר מילים בפסוק תורה שומרוני. נתונים לך מילות הפסוק העברי לפי הסדר, '
       'התרגום הארמי (תיבת התרגום השומרוני), התרגום הערבי, והתרגום האנגלי. עבור מילים '
       'עבריות מסוימות שיסומנו, החזר עבור כל אחת את המילה/ים המקבילות בכל אחד '
       'מהתרגומים — מועתקות מילולית מאותו תרגום — וגלוסה עברית תמציתית.')


def api_key():
    k = os.environ.get('ANTHROPIC_API_KEY', '')
    if not k and os.path.exists('.env'):
        for l in open('.env', encoding='utf-8'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                k = l.split('=', 1)[1].strip().strip('"\'')
    return k


def gaps_for(verse_ids):
    """{verse_id: (tokens, [gap_positions])} — gap = token shown with empty Aramaic."""
    sel = db.get_dict_select(verse_ids)
    conn = db.get_connection()
    out = {}
    for vid in verse_ids:
        m = sel.get(vid)
        if not m:
            continue
        row = conn.execute('SELECT text FROM verses WHERE id=?', (vid,)).fetchone()
        toks = (row['text'] or '').split()
        gaps = [i for i in range(len(toks))
                if str(i) in m and not (m[str(i)].get('aramaic') or '').strip()
                and re.search('[א-ת]', toks[i])]
        if gaps:
            out[vid] = (toks, gaps)
    conn.close()
    return out


def _first_json_object(txt):
    i = txt.find('{')
    if i < 0:
        return {}
    depth = 0; instr = False; esc = False
    for j in range(i, len(txt)):
        ch = txt[j]
        if instr:
            if esc: esc = False
            elif ch == '\\': esc = True
            elif ch == '"': instr = False
        else:
            if ch == '"': instr = True
            elif ch == '{': depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(txt[i:j + 1])
                    except Exception:
                        return {}
    return {}


def build_prompt(toks, gaps, aramaic, arabic, english):
    numbered = '\n'.join('%d. %s' % (i, t) for i, t in enumerate(toks))
    return ('מילות הפסוק העברי (ממוספרות, לפי הסדר):\n' + numbered
            + '\n\nהתרגום הארמי:\n' + (aramaic or '—')
            + '\n\nהתרגום הערבי:\n' + (arabic or '—')
            + '\n\nהתרגום האנגלי:\n' + (english or '—')
            + '\n\nעבור המיקומים האלה בלבד: ' + json.dumps(gaps)
            + '\nהחזר אובייקט JSON הממפה כל מיקום לאובייקט '
              '{"ar":..., "arab":..., "en":..., "he":...}:\n'
              '- ar: המילה/ים בארמית מהתרגום הארמי שמתרגמות את המילה העברית (מילולית), '
              'או "" אם אין.\n'
              '- arab: המילה/ים בערבית מהתרגום הערבי, או "".\n'
              '- en: קטע המשפט באנגלית מהתרגום האנגלי שמתאים למילה, או "".\n'
              '- he: גלוסה עברית תמציתית של המילה.\n'
              'החזר אך ורק את ה-JSON.')


def ensure_table(conn):
    conn.execute('CREATE TABLE IF NOT EXISTS word_align('
                 'verse_id INTEGER, pos INTEGER, ar TEXT, arab TEXT, en TEXT, he TEXT, '
                 'PRIMARY KEY(verse_id,pos))')
    conn.commit()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--estimate', action='store_true')
    ap.add_argument('--sample', type=int, default=0)
    args = ap.parse_args()

    conn = sqlite3.connect(DB, timeout=120); conn.row_factory = sqlite3.Row
    ensure_table(conn)
    allv = [r[0] for r in conn.execute(
        "SELECT id FROM verses WHERE TRIM(COALESCE(text,''))<>'' "
        "AND EXISTS(SELECT 1 FROM verse_dictionary d WHERE d.verse_id=verses.id) ORDER BY id")]
    done = set(json.load(open(PROG, encoding='utf-8'))) if os.path.exists(PROG) else set()

    # compute gaps in chunks
    print('computing gap positions across %d verses...' % len(allv), flush=True)
    gapmap = {}
    for i in range(0, len(allv), 300):
        gapmap.update(gaps_for(allv[i:i + 300]))
    todo = [v for v in allv if v in gapmap and v not in done]
    ntok = sum(len(gapmap[v][1]) for v in gapmap)
    print('verses with gaps: %d (%d gap tokens) | remaining to process: %d'
          % (len(gapmap), ntok, len(todo)), flush=True)

    if args.estimate:
        tin = tout = 0
        for v in (todo or list(gapmap)):
            toks, gaps = gapmap[v]
            ar = conn.execute('SELECT sam_aramaic,arabic_trans,english FROM verses WHERE id=?', (v,)).fetchone()
            tin += len(toks) * 5 + (len(ar[0] or '') + len(ar[1] or '') + len(ar[2] or '')) // 3 + 180
            tout += len(gaps) * 32 + 10
        inr, outr = (3, 15) if 'sonnet' in MODEL else (1, 5)
        print('est tokens in~%d out~%d -> ~$%.2f (%s)'
              % (tin, tout, tin / 1e6 * inr + tout / 1e6 * outr, MODEL), flush=True)
        return

    if not os.path.exists(DB + '.bak_wordalign'):
        shutil.copy2(DB, DB + '.bak_wordalign'); print('backup -> %s.bak_wordalign' % DB, flush=True)
    if args.sample:
        todo = todo[:args.sample]

    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    tin = tout = n = wrote = 0
    for v in todo:
        toks, gaps = gapmap[v]
        meta = conn.execute('SELECT sam_aramaic,arabic_trans,english FROM verses WHERE id=?', (v,)).fetchone()
        prompt = build_prompt(toks, gaps, meta['sam_aramaic'], meta['arabic_trans'], meta['english'])
        msg = None
        for attempt in range(5):
            try:
                msg = cl.messages.create(model=MODEL, max_tokens=2000, system=SYS,
                                         messages=[{'role': 'user', 'content': prompt}])
                break
            except Exception as ex:
                if attempt == 4:
                    print('  ! API fail v%d: %s' % (v, ex), flush=True); break
                time.sleep(3 * (attempt + 1))
        if msg is None:
            continue
        tin += msg.usage.input_tokens; tout += msg.usage.output_tokens; n += 1
        data = _first_json_object(''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text'))
        for k, val in (data.items() if isinstance(data, dict) else []):
            mnum = re.search(r'\d+', str(k))
            if not mnum or not isinstance(val, dict):
                continue
            pos = int(mnum.group())
            for _t in range(6):
                try:
                    conn.execute('INSERT OR REPLACE INTO word_align VALUES (?,?,?,?,?,?)',
                                 (v, pos, (val.get('ar') or '').strip(), (val.get('arab') or '').strip(),
                                  (val.get('en') or '').strip(), (val.get('he') or '').strip())); break
                except sqlite3.OperationalError:
                    time.sleep(2)
            wrote += 1
        conn.commit()
        done.add(v)
        if not args.sample:
            json.dump(sorted(done), open(PROG, 'w', encoding='utf-8'))
        if args.sample:
            print('verse %d:' % v, flush=True)
            for k, val in sorted(data.items(), key=lambda x: int(re.search(r'\d+', x[0]).group())):
                p = int(re.search(r'\d+', k).group())
                w = toks[p] if p < len(toks) else '?'
                print('   %-14s ar=%-12s arab=%-10s en=%-22s he=%s'
                      % (w, val.get('ar', ''), val.get('arab', ''), (val.get('en', '') or '')[:22], val.get('he', '')), flush=True)
        if n % 100 == 0:
            inr, outr = (3, 15) if 'sonnet' in MODEL else (1, 5)
            print('  ... %d verses, %d tokens ~$%.2f' % (n, wrote, tin / 1e6 * inr + tout / 1e6 * outr), flush=True)
    inr, outr = (3, 15) if 'sonnet' in MODEL else (1, 5)
    print('DONE. %d verses, %d tokens written. in=%d out=%d ~$%.2f'
          % (n, wrote, tin, tout, tin / 1e6 * inr + tout / 1e6 * outr), flush=True)


if __name__ == '__main__':
    main()
