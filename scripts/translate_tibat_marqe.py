"""
Translate the English Tibåt Mårqe sections to clear, simple Hebrew and store the
result in tm_sections.hebrew.

Uses the Anthropic API (key from env ANTHROPIC_API_KEY or the project .env), the
same mechanism as scripts/translate_interpretations.py.

Run (all pending):        py -3 scripts/translate_tibat_marqe.py
Validation sample:        py -3 scripts/translate_tibat_marqe.py --limit 6
One book only:            py -3 scripts/translate_tibat_marqe.py --book I
Re-translate everything:  py -3 scripts/translate_tibat_marqe.py --all
"""
import os
import sys
import time
import argparse
import sqlite3

sys.stdout.reconfigure(encoding='utf-8')

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
DB   = os.path.join(DATA, 'torah.db')

MODEL      = os.environ.get('TM_MODEL', 'claude-sonnet-4-6')
BATCH_SIZE = 5

SYSTEM = (
    'אתה מתרגם מומחה לטקסטים שומרוניים. אתה מקבל קטעים מתוך החיבור הארמי-שומרוני '
    '"תיבת מרקה" (Tibåt Mårqe) בתרגומם לאנגלית, ומתרגם אותם לעברית.'
)

INSTRUCTIONS = (
    'תרגם כל קטע לעברית פשוטה, ברורה וזורמת, הנאמנה למקור האנגלי. '
    'שמור על הפניות מקראיות בסוגריים כפי שהן (למשל "(דברים ד,לה)"). '
    'שמות (משה, פרעה, ישראל וכו\') תרגם לצורתם העברית המקובלת. '
    'אל תוסיף כותרות, הסברים או הערות. '
    'החזר עבור כל קטע אך ורק בפורמט הבא, שורת מפריד ואז התרגום:\n'
    '===<מספר>===\n<תרגום>\n\n'
)


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not key:
        env_file = os.path.join(DATA, '..', '.env')
        if os.path.exists(env_file):
            for line in open(env_file, encoding='utf-8'):
                line = line.strip()
                if line.startswith('ANTHROPIC_API_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def translate_batch(client, batch):
    """batch: list of (id, english). Returns {id: hebrew}."""
    parts = [f'===%d===\n%s' % (i, eng) for i, (_id, eng) in enumerate(batch, 1)]
    prompt = INSTRUCTIONS + '\n' + '\n\n'.join(parts)
    msg = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        system=SYSTEM,
        messages=[{'role': 'user', 'content': prompt}],
    )
    text = msg.content[0].text.strip()
    # split on ===N===
    import re
    chunks = re.split(r'===\s*(\d+)\s*===', text)
    result = {}
    it = iter(chunks[1:])
    for num, body in zip(it, it):
        try:
            idx = int(num) - 1
        except ValueError:
            continue
        if 0 <= idx < len(batch):
            result[batch[idx][0]] = body.strip()
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0, help='translate at most N pending sections')
    ap.add_argument('--book', help='only this book (I..VI)')
    ap.add_argument('--all', action='store_true', help='re-translate even if hebrew exists')
    args = ap.parse_args()

    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set (env or .env).')
        sys.exit(1)
    try:
        import anthropic
    except ImportError:
        print('ERROR: anthropic not installed. Run: py -3 -m pip install anthropic')
        sys.exit(1)
    client = anthropic.Anthropic(api_key=key)

    conn = sqlite3.connect(DB, timeout=60)
    conn.execute('PRAGMA busy_timeout=60000')
    conn.row_factory = sqlite3.Row
    where = "english IS NOT NULL AND english!=''"
    params = []
    if not args.all:
        where += " AND (hebrew IS NULL OR hebrew='')"
    if args.book:
        where += " AND book=?"
        params.append(args.book)
    rows = conn.execute(
        f"SELECT id, book, section, english FROM tm_sections WHERE {where} ORDER BY sort_key",
        params).fetchall()
    if args.limit:
        rows = rows[:args.limit]

    total = len(rows)
    print(f'sections to translate: {total}  (model: {MODEL})')
    if total == 0:
        conn.close()
        return

    done = errors = 0
    for i in range(0, total, BATCH_SIZE):
        batch = [(r['id'], r['english']) for r in rows[i:i + BATCH_SIZE]]
        try:
            out = translate_batch(client, batch)
            for sid, he in out.items():
                conn.execute("UPDATE tm_sections SET hebrew=? WHERE id=?", (he, sid))
            conn.commit()
            done += len(out)
        except Exception as e:
            errors += 1
            print(f'\n  batch {i//BATCH_SIZE+1} error: {e}')
            time.sleep(3)
            continue
        print(f'  {min(i+BATCH_SIZE, total)}/{total} done...', end='\r')

    conn.close()
    print(f'\nDone. Translated: {done}, batch errors: {errors}')


if __name__ == '__main__':
    main()
