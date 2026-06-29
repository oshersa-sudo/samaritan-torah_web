# -*- coding: utf-8 -*-
"""Correct the OCR'd Samaritan phonetic transcription (verse_translit) so it follows
the Samaritan TEXT rather than the Masoretic. The scanned source applies Samaritan
(Ben-Ḥayyim) vowels on a consonantal base that, at textual variants, drifts to the
Masoretic reading (e.g. Gen 2:2 "aššibī'ī"=השביעי where the Samaritan reads הששי).

For each verse whose Samaritan text differs from the Masoretic (the only verses where
this can occur), the model re-renders the transcription anchored to the Samaritan
text, in the SAME pronunciation style, changing only the words that drifted. The
corrected text is written to verse_translit_fix(verse_id, text); the original OCR in
verse_translit is left untouched. get_translit/_translit_tokens prefer the fix.

Model: claude-opus-4-8 (override TF_MODEL). Resumable. Usage:
  py -3 scripts/fix_translit_samaritan.py --estimate
  py -3 scripts/fix_translit_samaritan.py --sample 15
  py -3 scripts/fix_translit_samaritan.py
"""
import argparse, io, json, os, re, sqlite3, sys, time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import app.services.database as db

DB = 'data/torah.db'
PROG = 'data/_translit_fix_progress.json'
MODEL = os.environ.get('TF_MODEL', 'claude-opus-4-8')
SYS = ('אתה מתקן תעתיק הגייה שומרוני לתורה. נתונים לך: נוסח התורה כפי שהוא בכתב היד '
       'השומרוני (עברית), נוסח המסורה (עברית), ותעתיק הגייה לטיני בשיטת בן-חיים שנסרק '
       'ב-OCR. התעתיק שומר על ההגייה השומרונית (יהוה→"šēmå", אלהים→"ēluwwəm" וכו׳) אך '
       'לעיתים עוקב בטעות אחר נוסח המסורה בעיצורים במקום אחר הנוסח השומרוני, ולעיתים יש '
       'בו שיבושי OCR. החזר תעתיק מתוקן המשקף נאמנה את הנוסח השומרוני (לא המסורה), באותו '
       'סגנון הגייה בדיוק, תוך שינוי אך ורק המילים שחרגו מהנוסח השומרוני או שובשו. שמור על '
       'אותם דיאקריטים וכללי ההגייה. הפלט חייב להיות אך ורק באותיות לטיניות עם דיאקריטים '
       '— לעולם אל תכתוב אותיות עבריות בפלט (העברית ניתנה רק לעיגון). החזר אך ורק את שורת '
       'התעתיק, ללא הסבר.')


def api_key():
    k = os.environ.get('ANTHROPIC_API_KEY', '')
    if not k and os.path.exists('.env'):
        for l in open('.env', encoding='utf-8'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                k = l.split('=', 1)[1].strip().strip('"\'')
    return k


def variant_verses(conn):
    """verse rows where the Samaritan consonantal text differs from the Masoretic
    AND a transcription exists — the verses where the drift can show up."""
    out = []
    for r in conn.execute(
            """SELECT t.verse_id vid, v.text sam, v.masoretic_text mas, t.text tr
               FROM verse_translit t JOIN verses v ON v.id=t.verse_id
               WHERE TRIM(COALESCE(v.masoretic_text,''))<>'' AND TRIM(COALESCE(v.text,''))<>''
               ORDER BY t.verse_id"""):
        ss = db._heb_cons(re.sub('[^א-ת ]', '', r['sam']))
        ms = db._heb_cons(re.sub('[^א-ת ]', '', r['mas']))
        if ss != ms:
            out.append(r)
    return out


def garbled_verses(conn):
    """NON-variant verses (Samaritan text == Masoretic, so the drift pass skipped them)
    whose transcription shows an OCR garble: a triple-repeated letter (e.g. 'wwww') or a
    very low consonant-skeleton match to the Samaritan text. Prefers the already-corrected
    fix text if present (won't reflag a fixed verse)."""
    out = []
    for r in conn.execute(
            """SELECT t.verse_id vid, v.text sam, v.masoretic_text mas,
                      COALESCE(f.text, t.text) tr
               FROM verse_translit t JOIN verses v ON v.id=t.verse_id
               LEFT JOIN verse_translit_fix f ON f.verse_id=t.verse_id
               WHERE TRIM(COALESCE(v.masoretic_text,''))<>'' AND TRIM(COALESCE(v.text,''))<>''
               ORDER BY t.verse_id"""):
        ss = db._heb_cons(re.sub('[^א-ת ]', '', r['sam']))
        ms = db._heb_cons(re.sub('[^א-ת ]', '', r['mas']))
        if ss != ms:
            continue                                    # variant verse → handled by the drift pass
        tr = r['tr'] or ''
        if re.search(r'([a-zšṣṭāēīōūǝ])\1\1', tr) or db._cons_sim(db._lat_cons(tr), ss) < 0.45:
            out.append(r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--garbled', action='store_true', help='clean OCR garbles in non-variant verses')
    ap.add_argument('--estimate', action='store_true')
    ap.add_argument('--sample', type=int, default=0)
    args = ap.parse_args()
    conn = sqlite3.connect(DB, timeout=120); conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout=120000')
    conn.execute('CREATE TABLE IF NOT EXISTS verse_translit_fix(verse_id INTEGER PRIMARY KEY, text TEXT)')
    conn.commit()
    global PROG
    if args.garbled:
        PROG = 'data/_translit_garble_progress.json'
        rows = garbled_verses(conn)
        print('garbled non-variant verses:', len(rows), flush=True)
    else:
        rows = variant_verses(conn)
        print('textual-variant verses with a transcription:', len(rows), flush=True)
    if args.estimate:
        tin = sum((len(r['sam']) + len(r['mas']) + len(r['tr'])) // 3 + 220 for r in rows)
        tout = sum(len(r['tr']) // 3 + 20 for r in rows)
        inr, outr = (5, 25) if 'opus' in MODEL else ((3, 15) if 'sonnet' in MODEL else (1, 5))
        print('est tokens in~%d out~%d -> ~$%.2f (%s)'
              % (tin, tout, tin / 1e6 * inr + tout / 1e6 * outr, MODEL), flush=True)
        return
    done = set(json.load(open(PROG, encoding='utf-8'))) if os.path.exists(PROG) else set()
    todo = rows if args.sample else [r for r in rows if r['vid'] not in done]
    if args.sample:
        # bias the sample to include Gen 2:2 + a spread
        g22 = conn.execute("SELECT v.id FROM verses v JOIN chapters ch ON ch.id=v.chapter_id "
                           "WHERE ch.book_id=1 AND ch.number=2 AND v.number='2'").fetchone()
        pick = [r for r in rows if r['vid'] == (g22['id'] if g22 else -1)]
        pick += [r for r in rows[::max(1, len(rows)//args.sample)]][:args.sample - len(pick)]
        todo = pick
    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    tin = tout = n = 0
    for r in todo:
        user = ('נוסח שומרוני (עברית):\n%s\n\nנוסח המסורה (עברית):\n%s\n\nתעתיק נוכחי (בן-חיים):\n%s'
                % (r['sam'], r['mas'], r['tr']))
        msg = None
        for attempt in range(5):
            try:
                msg = cl.messages.create(model=MODEL, max_tokens=600, system=SYS,
                                         messages=[{'role': 'user', 'content': user}])
                break
            except Exception as e:
                if attempt == 4:
                    print('  ! API fail v%d: %s' % (r['vid'], e), flush=True); break
                time.sleep(3 * (attempt + 1))
        if msg is None:
            continue
        tin += msg.usage.input_tokens; tout += msg.usage.output_tokens; n += 1
        fixed = ''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text').strip()
        fixed = fixed.strip('`').strip()
        if not fixed:
            continue
        if re.search('[א-ת]', fixed):          # model leaked Hebrew into the Latin transcription → reject
            print('  ! Hebrew in output, skipped v%d' % r['vid'], flush=True)
            continue
        conn.execute('INSERT OR REPLACE INTO verse_translit_fix(verse_id, text) VALUES (?,?)',
                     (r['vid'], fixed)); conn.commit()
        if not args.sample:
            done.add(r['vid']); json.dump(sorted(done), open(PROG, 'w', encoding='utf-8'))
        if args.sample:
            print('-- v%d' % r['vid'], flush=True)
            print('   sam : %s' % r['sam'][:90], flush=True)
            print('   OCR : %s' % r['tr'][:90], flush=True)
            print('   FIX : %s' % fixed[:90], flush=True)
        elif n % 100 == 0:
            inr, outr = (5, 25) if 'opus' in MODEL else (3, 15)
            print('  ... %d verses ~$%.2f' % (n, tin / 1e6 * inr + tout / 1e6 * outr), flush=True)
    inr, outr = (5, 25) if 'opus' in MODEL else ((3, 15) if 'sonnet' in MODEL else (1, 5))
    print('DONE. %d verses. in=%d out=%d ~$%.2f'
          % (n, tin, tout, tin / 1e6 * inr + tout / 1e6 * outr), flush=True)


if __name__ == '__main__':
    main()
