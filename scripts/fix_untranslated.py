"""
Fix untranslated English words in verses.interpretation by replacing them
with the corresponding Hebrew words from verses.text (original Hebrew).
Run once:
    set ANTHROPIC_API_KEY=sk-ant-...
    py -3 scripts/fix_untranslated.py
"""
import os
import re
import sys
import sqlite3
import time

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH  = os.path.join(DATA_DIR, 'torah.db')

BATCH_SIZE = 20
MODEL      = 'claude-haiku-4-5-20251001'

LATIN = re.compile(r'[A-Za-z]')


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not key:
        env_file = os.path.join(DATA_DIR, '..', '.env')
        if os.path.exists(env_file):
            for line in open(env_file, encoding='utf-8'):
                line = line.strip()
                if line.startswith('ANTHROPIC_API_KEY='):
                    key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def fix_batch(client, verses):
    """verses: list of (id, number, text_he, english, interpretation).
    Returns {id: fixed_interpretation}."""
    lines = []
    for vid, num, text_he, english, interp in verses:
        lines.append(
            f'פסוק {num}:\n'
            f'  עברית מקורית: {text_he}\n'
            f'  תרגום אנגלי: {english}\n'
            f'  פירוש נוכחי: {interp}'
        )

    prompt = (
        'להלן מספר פסוקים. בעמודת "פירוש נוכחי" נותרו מילים בלטינית שלא תורגמו. '
        'החלף כל מילה לטינית בפירוש בהתאמה מן "העברית המקורית" של אותו פסוק. '
        'אם אינך בטוח מהי ההתאמה, השאר את הפסוק כמות שהוא. '
        'החזר בפורמט בדיוק: <מספר פסוק>: <פירוש מתוקן>, שורה אחת לפסוק. '
        'אל תוסיף הסברים.\n\n' + '\n\n'.join(lines)
    )

    msg = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        messages=[{'role': 'user', 'content': prompt}],
    )

    result = {}
    for line in msg.content[0].text.strip().splitlines():
        if ':' not in line:
            continue
        num_str, _, fixed = line.partition(':')
        num_str = num_str.strip()
        # handle "פסוק X" prefix or plain number
        num_str = num_str.replace('פסוק', '').strip()
        try:
            num = int(num_str)
            match = next((v for v in verses if v[1] == num), None)
            if match:
                result[match[0]] = fixed.strip()
        except ValueError:
            pass
    return result


def main():
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set.')
        sys.exit(1)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
    except ImportError:
        print('ERROR: anthropic not installed. Run: py -3 -m pip install anthropic')
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    rows = conn.execute(
        'SELECT id, number, text, english, interpretation FROM verses '
        'WHERE interpretation IS NOT NULL AND interpretation != "" '
        'ORDER BY id'
    ).fetchall()

    # Keep only verses that still have Latin characters in interpretation
    affected = [r for r in rows if LATIN.search(r['interpretation'] or '')]
    total = len(affected)
    print(f'Verses with untranslated words: {total}')
    if total == 0:
        print('Nothing to fix.')
        conn.close()
        return

    done = 0
    errors = 0
    for i in range(0, total, BATCH_SIZE):
        batch = [
            (r['id'], r['number'], r['text'], r['english'], r['interpretation'])
            for r in affected[i:i + BATCH_SIZE]
        ]
        try:
            fixed = fix_batch(client, batch)
            for vid, text in fixed.items():
                conn.execute('UPDATE verses SET interpretation=? WHERE id=?', (text, vid))
            conn.commit()
            done += len(fixed)
        except Exception as e:
            errors += 1
            print(f'  batch {i//BATCH_SIZE+1} error: {e}')
            time.sleep(2)
            continue

        pct = min(100, int((i + len(batch)) / total * 100))
        print(f'  {pct}%  ({i + len(batch)}/{total})...', end='\r')

    conn.close()
    print(f'\nDone. Fixed: {done}, errors: {errors}')


if __name__ == '__main__':
    main()
