# -*- coding: utf-8 -*-
"""Independent Arabic→Hebrew translation for the "מילון מילים" word picker.

Each Arabic word of the Samaritan Arabic Torah-translation is translated FRESH to
Hebrew (not read off the aligned Hebrew), to serve as a cross-check source in the
word's per-source breakdown. Stored in arabic_he(arabic, hebrew). Resumable.

Model: claude-opus-4-8 by default (override with AR_MODEL). No thinking (a short
structured task). Usage:
  py -3 scripts/translate_arabic_he.py --sample 50    # measure + preview, no full run
  py -3 scripts/translate_arabic_he.py                # full (resumable)
"""
import argparse, json, os, re, sqlite3, sys, time

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
MODEL = os.environ.get('AR_MODEL', 'claude-opus-4-8')
BATCH = 50

SYS = ("You translate words from the Samaritan-tradition Arabic translation of the "
       "Torah into Hebrew. For each Arabic word or short phrase, give the most likely "
       "Hebrew equivalent (1-3 words, no explanations). Keep proper names as their "
       "Hebrew form. Reply with ONLY a JSON object mapping each given Arabic string to "
       "its Hebrew translation, no markdown, no prose.")


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    env = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not key and os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            if line.strip().startswith('ANTHROPIC_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def ensure_table(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS arabic_he(arabic TEXT PRIMARY KEY, hebrew TEXT)")
    conn.commit()


def todo_words(conn):
    have = set(r[0] for r in conn.execute("SELECT arabic FROM arabic_he"))
    words = [r[0] for r in conn.execute(
        "SELECT DISTINCT arabic FROM verse_dictionary WHERE TRIM(COALESCE(arabic,''))<>''")]
    return [w for w in words if w not in have]


def translate_batch(client, batch):
    user = '\n'.join('- ' + w for w in batch)
    msg = client.messages.create(model=MODEL, max_tokens=2000, system=SYS,
                                 messages=[{'role': 'user', 'content': user}])
    text = ''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text')
    m = re.search(r'\{.*\}', text, re.S)
    data = {}
    if m:
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            data = {}
    return data, msg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sample', type=int, default=0)
    args = ap.parse_args()
    conn = sqlite3.connect(DB, timeout=60)
    conn.execute('PRAGMA busy_timeout=60000')
    ensure_table(conn)
    words = todo_words(conn)
    if args.sample:
        words = words[:args.sample]
    print(f"{len(words)} Arabic words to translate (batch {BATCH})")
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set'); sys.exit(1)
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    tin = tout = 0
    for i in range(0, len(words), BATCH):
        chunk = words[i:i + BATCH]
        data, msg = translate_batch(client, chunk)
        tin += msg.usage.input_tokens; tout += msg.usage.output_tokens
        for ar in chunk:
            he = (data.get(ar) or '').strip()
            if he:
                conn.execute("INSERT OR REPLACE INTO arabic_he VALUES (?,?)", (ar, he))
        conn.commit()
        if args.sample:
            for ar in chunk[:10]:
                print(f"  {ar}  ->  {data.get(ar,'(none)')}")
        if (i // BATCH) % 10 == 0:
            print(f"  {min(i+BATCH,len(words))}/{len(words)}")
        time.sleep(0.25)
    cost = tin / 1e6 * 5 + tout / 1e6 * 25      # Opus pricing
    print(f"\ntokens in={tin} out={tout} | this run ≈ ${cost:.2f} (Opus)")
    if args.sample and len(words) == args.sample:
        per = (tin + tout) / max(1, (len(words) + BATCH - 1)//BATCH)
        print(f"per-batch avg tokens ≈ {per:.0f}")


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
