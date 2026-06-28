# -*- coding: utf-8 -*-
"""Fill ONLY the empty `arabic` cells on verse_dictionary (the "ערבית" column of
מילון מילים), without touching the ~93% that is already aligned.

For every verse that still has at least one word with empty Arabic *and* has an
Arabic translation, the model is given the full ordered word list (for context)
plus the verse's Arabic text, and returns the Arabic word(s) for each Hebrew word.
We then write the result ONLY into rows that are currently empty — existing good
alignments are preserved. Resumable; backed up first.

Model: claude-sonnet-4-6 (override with AR_MODEL). Usage:
  py -3 scripts/fill_word_arabic_gaps.py --estimate   # token/cost estimate, no writes
  py -3 scripts/fill_word_arabic_gaps.py --sample 3   # show 3 verses, write them
  py -3 scripts/fill_word_arabic_gaps.py              # full run
"""
import sqlite3, sys, io, os, json, time, shutil, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
PROG = 'data/_arabic_gapfill_progress.json'
MODEL = os.environ.get('AR_MODEL', 'claude-sonnet-4-6')
JUNK = {'و', 'وَ', 'ال', '،', 'و '}
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


def gap_verses(conn):
    """verse ids that have >=1 empty-arabic dictionary word AND an Arabic text."""
    return [r[0] for r in conn.execute(
        """SELECT DISTINCT d.verse_id
           FROM verse_dictionary d JOIN verses v ON v.id=d.verse_id
           WHERE TRIM(COALESCE(d.arabic,''))=''
             AND TRIM(COALESCE(v.arabic_trans,''))<>''
           ORDER BY d.verse_id""")]


def _first_json_array(txt):
    i = txt.find('[')
    if i < 0:
        return []
    depth = 0; instr = False; esc = False
    for j in range(i, len(txt)):
        ch = txt[j]
        if instr:
            if esc: esc = False
            elif ch == '\\': esc = True
            elif ch == '"': instr = False
        else:
            if ch == '"': instr = True
            elif ch == '[': depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(txt[i:j + 1])
                    except Exception:
                        return []
    return []


def align(cl, words, cur_arabic, arabic):
    """words+cur_arabic are parallel lists; cur_arabic[i] is the Arabic already
    assigned to word i ("" = the gap to fill). We show the model the existing
    alignment so it only fills genuine gaps and does NOT reuse an Arabic word that
    a sibling word already took (Samaritan variant duplicates like חושך/וחושך)."""
    lines = []
    for i, (w, a) in enumerate(zip(words, cur_arabic)):
        tag = ('= %s' % a) if a else '= ❓ (חסר — למלא)'
        lines.append('%d. %s %s' % (i + 1, w, tag))
    instr = ('מילות הפסוק לפי הסדר, עם התרגום הערבי שכבר שובץ לכל מילה. רק המילים '
             'המסומנות ❓ חסרות:\n' + '\n'.join(lines)
             + '\n\nהתרגום הערבי המלא של הפסוק:\n' + arabic
             + '\n\nהחזר JSON array של מחרוזות באורך %d, לפי הסדר. עבור מילה שכבר שובצה — '
               'החזר את אותו ערך. עבור מילה המסומנת ❓ — החזר את המילה/ים בערבית שמתרגמות '
               'אותה, אך ורק אם קיימת בתרגום מילה ערבית מובחנת שטרם שובצה למילה אחרת. '
               'אם זו כפילות של מילה שכבר תורגמה, או מילת־תפקוד שאין לה מקבילה ערבית '
               '(כמו את/ית), החזר "". אל תמציא ואל תחזיר רק וי״ו חיבור בודדת כתרגום שלם. '
               'החזר אך ורק את ה-JSON.' % len(words))
    m = cl.messages.create(model=MODEL, max_tokens=1500, system=SYS,
                           messages=[{'role': 'user', 'content': instr}])
    txt = ''.join(b.text for b in m.content if b.type == 'text')
    return _first_json_array(txt), m.usage


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--estimate', action='store_true')
    ap.add_argument('--sample', type=int, default=0)
    args = ap.parse_args()
    conn = sqlite3.connect(DB, timeout=120); conn.row_factory = sqlite3.Row
    vids = gap_verses(conn)
    nwords = conn.execute(
        """SELECT COUNT(*) FROM verse_dictionary d JOIN verses v ON v.id=d.verse_id
           WHERE TRIM(COALESCE(d.arabic,''))='' AND TRIM(COALESCE(v.arabic_trans,''))<>''""").fetchone()[0]
    print('gap verses: %d   fillable empty words: %d' % (len(vids), nwords), flush=True)
    if args.estimate:
        # rough: input ~ (#words*6 + arabic_chars/3 + 80) tokens, output ~ #words*4 tokens
        tin = tout = 0
        for vid in vids:
            rows = conn.execute('SELECT hebrew FROM verse_dictionary WHERE verse_id=?', (vid,)).fetchall()
            ar = conn.execute('SELECT arabic_trans FROM verses WHERE id=?', (vid,)).fetchone()[0] or ''
            w = len(rows)
            tin += w * 6 + len(ar) // 3 + 90
            tout += w * 5 + 20
        inr, outr = (3, 15) if 'sonnet' in MODEL else (1, 5)
        print('est tokens in~%d out~%d  ->  ~$%.2f (%s)'
              % (tin, tout, tin / 1e6 * inr + tout / 1e6 * outr, MODEL), flush=True)
        return
    if args.sample:
        vids = vids[:args.sample]
    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    if not os.path.exists(DB + '.bak_argapfill'):
        shutil.copy2(DB, DB + '.bak_argapfill'); print('backup ->', DB + '.bak_argapfill', flush=True)
    done = json.load(open(PROG, encoding='utf-8')) if os.path.exists(PROG) else {}
    tin = tout = n = filled = 0
    for vid in vids:
        if str(vid) in done and not args.sample:
            continue
        rows = conn.execute('SELECT id, hebrew, arabic FROM verse_dictionary WHERE verse_id=? ORDER BY id',
                            (vid,)).fetchall()
        ar = conn.execute('SELECT arabic_trans FROM verses WHERE id=?', (vid,)).fetchone()[0]
        words = [(r['hebrew'] or '').split(',')[0].strip() for r in rows]
        cur = [(r['arabic'] or '').strip() for r in rows]
        try:
            arr, u = align(cl, words, cur, ar)
        except Exception as ex:
            print('  err vid=%d: %s' % (vid, ex), flush=True); time.sleep(3); continue
        tin += u.input_tokens; tout += u.output_tokens; n += 1
        arr = arr + [''] * (len(rows) - len(arr))
        for r, a in zip(rows, arr):
            if (r['arabic'] or '').strip():
                continue                       # keep existing good alignment
            a = (a or '').strip()
            if not a:
                continue
            if a in JUNK or (len(a) <= 2 and a.lstrip('و').strip() == ''):
                continue                       # bare connector / not a real translation
            for _t in range(6):
                try:
                    conn.execute('UPDATE verse_dictionary SET arabic=? WHERE id=?', (a, r['id'])); break
                except sqlite3.OperationalError:
                    time.sleep(2)
            filled += 1
            if args.sample:
                print('    %-16s -> %s' % (words[rows.index(r)], a), flush=True)
        conn.commit()
        done[str(vid)] = 1
        if not args.sample:
            json.dump(done, open(PROG, 'w', encoding='utf-8'))
        if n % 100 == 0:
            print('  ... %d verses, %d words filled  ~$%.2f so far'
                  % (n, filled, tin / 1e6 * (3 if 'sonnet' in MODEL else 1)
                     + tout / 1e6 * (15 if 'sonnet' in MODEL else 5)), flush=True)
    inr, outr = (3, 15) if 'sonnet' in MODEL else (1, 5)
    print('DONE. %d verses, %d words filled.  tokens in=%d out=%d  ~$%.2f'
          % (n, filled, tin, tout, tin / 1e6 * inr + tout / 1e6 * outr), flush=True)
    conn.close()


if __name__ == '__main__':
    main()
