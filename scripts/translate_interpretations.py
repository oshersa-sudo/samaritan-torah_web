"""
One-time translation: English verses -> Hebrew interpretation, stored in verses.interpretation.
Run once:
    set ANTHROPIC_API_KEY=sk-ant-...
    py -3 scripts/translate_interpretations.py
"""
import os
import sys
import sqlite3
import time

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH  = os.path.join(DATA_DIR, 'torah.db')

BATCH_SIZE = 30   # verses per API call
MODEL      = 'claude-haiku-4-5-20251001'

import re
WORD_SUBS = [
    (r'\bMusi\b',     'משה',   re.IGNORECASE),
    (r'\bmisrem\b',   'מצרים', re.IGNORECASE),
    (r'\bShema\b',    'יהוה',  re.IGNORECASE),
    (r'\bYishrael\b', 'ישראל', re.IGNORECASE),
    (r'\bShem\b',     'שם',   re.IGNORECASE),
    (r'\bAm\b',       'חם',   re.IGNORECASE),
    (r'\bNa\b',       'נח',   re.IGNORECASE),
    (r'\bgopher\b',   'גופר', re.IGNORECASE),
]


def apply_subs(text):
    for pattern, replacement, flags in WORD_SUBS:
        text = re.sub(pattern, replacement, text, flags=flags)
    return text


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


def translate_batch(client, verses):
    """verses: list of (id, number, english). Returns {id: hebrew}."""
    to_translate = [(vid, num, eng) for vid, num, eng in verses if eng and eng.strip()]
    if not to_translate:
        return {}

    lines = '\n'.join(f'{num}: {eng}' for _, num, eng in to_translate)
    prompt = (
        'תרגם כל פסוק מהרשימה הבאה מאנגלית לעברית. '
        'תרגם כל מילה במדויק ובאופן מילולי בלבד. '
        'מילים שאינך יכול לתרגם, השאר בשפת המקור. '
        'עבור כל פסוק, החזר בפורמט בדיוק: <מספר>: <טקסט>, שורה אחת לפסוק. '
        'אל תוסיף הסברים.\n\n' + lines
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
        num_str, _, text = line.partition(':')
        try:
            num = int(num_str.strip())
            match = next((v for v in to_translate if v[1] == num), None)
            if match:
                result[match[0]] = apply_subs(text.strip())
        except ValueError:
            pass
    return result


def main():
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set.')
        print('Set environment variable or create .env file with ANTHROPIC_API_KEY=sk-ant-...')
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
        'SELECT id, number, english FROM verses '
        'WHERE english IS NOT NULL AND english != "" '
        'AND (interpretation IS NULL OR interpretation = "")'
        'ORDER BY id'
    ).fetchall()

    total = len(rows)
    print(f'Verses to translate: {total}')
    if total == 0:
        print('All verses already translated.')
        conn.close()
        return

    done = 0
    errors = 0
    for i in range(0, total, BATCH_SIZE):
        batch = [(r['id'], r['number'], r['english']) for r in rows[i:i + BATCH_SIZE]]
        try:
            translated = translate_batch(client, batch)
            for vid, text in translated.items():
                conn.execute('UPDATE verses SET interpretation=? WHERE id=?', (text, vid))
            conn.commit()
            done += len(translated)
        except Exception as e:
            errors += 1
            print(f'  batch {i//BATCH_SIZE+1} error: {e}')
            time.sleep(2)
            continue

        pct = min(100, int((i + len(batch)) / total * 100))
        print(f'  {pct}%  ({i + len(batch)}/{total}) translated so far...', end='\r')

    conn.close()
    print(f'\nDone. Translated: {done}, errors: {errors}')


if __name__ == '__main__':
    main()
