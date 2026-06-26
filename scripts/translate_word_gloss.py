# -*- coding: utf-8 -*-
"""Full per-word Hebrew gloss coverage for the "מילון מילים" picker.

Every word of the Samaritan Torah verse gets a short Hebrew meaning — including the
~24% (particles, prepositions, words with no Targum entry) that the curated
verse_dictionary doesn't cover — so EVERY highlighted word opens to a translation.
Stored per token position in word_gloss(verse_id, pos, word, he); the dictionary
backend uses it only to fill gaps (curated entries always win).

Model: claude-haiku-4-5. Resumable, verse-batched. Usage:
  py -3 scripts/translate_word_gloss.py --sample 3
  py -3 scripts/translate_word_gloss.py
"""
import argparse, json, os, re, sqlite3, sys, time

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
MODEL = os.environ.get('GLOSS_MODEL', 'claude-haiku-4-5')
BATCH = 8

SYS = ("You gloss every word of a Samaritan-Hebrew Torah verse. For each word given "
       "(in order) return a SHORT Hebrew meaning (1-3 words); for particles and "
       "prepositions give their plain grammatical sense (e.g. את → 'מילת מושא', ו → "
       "'ו החיבור'). Reply with ONLY a JSON object mapping each verse id to a list of "
       "{\"he\":...} in the SAME order and count as that verse's word list.")


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    env = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not key and os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            if line.strip().startswith('ANTHROPIC_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def ensure_table(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS word_gloss("
                 "verse_id INTEGER, pos INTEGER, word TEXT, he TEXT, PRIMARY KEY(verse_id,pos))")
    conn.commit()


def todo_verses(conn):
    done = set(r[0] for r in conn.execute("SELECT DISTINCT verse_id FROM word_gloss"))
    rows = conn.execute("SELECT id FROM verses WHERE TRIM(COALESCE(text,''))<>'' ORDER BY id").fetchall()
    return [r[0] for r in rows if r[0] not in done]


def verse_tokens(conn, vid):
    txt = conn.execute("SELECT text FROM verses WHERE id=?", (vid,)).fetchone()[0] or ''
    return [w for w in txt.split() if re.search('[א-ת]', w)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sample', type=int, default=0)
    args = ap.parse_args()
    conn = sqlite3.connect(DB, timeout=60)
    conn.execute('PRAGMA busy_timeout=60000')
    conn.row_factory = sqlite3.Row
    ensure_table(conn)
    vids = todo_verses(conn)
    if args.sample:
        vids = vids[:args.sample]
    print(f"{len(vids)} verses to gloss (batch {BATCH})")
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set'); sys.exit(1)
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    tin = tout = 0
    for i in range(0, len(vids), BATCH):
        chunk = vids[i:i + BATCH]
        tmap = {v: verse_tokens(conn, v) for v in chunk}
        parts = ["=== VERSE %d ===\nWORDS: %s" % (v, ' | '.join(tmap[v])) for v in chunk]
        msg = None
        for attempt in range(5):
            try:
                msg = client.messages.create(model=MODEL, max_tokens=3000, system=SYS,
                                             messages=[{'role': 'user', 'content': '\n\n'.join(parts)}])
                break
            except Exception as e:
                if attempt == 4:
                    print("  ! giving up on batch %d: %s" % (i // BATCH, e)); break
                time.sleep(3 * (attempt + 1))
        if msg is None:
            continue
        tin += msg.usage.input_tokens; tout += msg.usage.output_tokens
        text = ''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text')
        m = re.search(r'\{.*\}', text, re.S)
        data = {}
        if m:
            try:
                data = json.loads(m.group(0))
            except json.JSONDecodeError:
                data = {}
        by_num = {}
        for k, val in (data.items() if isinstance(data, dict) else []):
            mn = re.search(r'\d+', str(k))
            if mn:
                by_num[int(mn.group())] = val
        for v in chunk:
            lst = by_num.get(v) or []
            for pos, (word, item) in enumerate(zip(tmap[v], lst)):
                he = (item.get('he') if isinstance(item, dict) else '') or ''
                conn.execute("INSERT OR REPLACE INTO word_gloss VALUES (?,?,?,?)", (v, pos, word, he.strip()))
        conn.commit()
        if args.sample:
            for v in chunk:
                print("  verse %d:" % v)
                for word, it in zip(tmap[v], by_num.get(v, [])):
                    print("    %-16s -> %s" % (word, (it or {}).get('he', '?')))
        if (i // BATCH) % 10 == 0:
            print(f"  {min(i+BATCH,len(vids))}/{len(vids)}")
        time.sleep(0.2)
    cost = tin / 1e6 * 1 + tout / 1e6 * 5
    print(f"\ntokens in={tin} out={tout} | this run ≈ ${cost:.2f} (Haiku)")


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
