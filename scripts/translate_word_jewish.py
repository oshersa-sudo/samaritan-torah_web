# -*- coding: utf-8 -*-
"""Per-word Jewish-commentary notes for the "מילון מילים" picker (column C).

For each verse that carries Jewish commentary (Rashi / Ramban / Cassuto / Baal
ha-Turim), the model SYNTHESISES a concise Hebrew note per word from that
commentary in context — leaving a word blank when the commentary doesn't
illuminate it. Stored in word_jewish(verse_id, pos, word, note).

Model: claude-sonnet-4-6 (nuanced synthesis). Resumable, one verse per call
(commentary is long). Usage:
  py -3 scripts/translate_word_jewish.py --sample 3
  py -3 scripts/translate_word_jewish.py
"""
import argparse, json, os, re, sqlite3, sys, time

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
MODEL = os.environ.get('JW_MODEL', 'claude-sonnet-4-6')
CAP = 1600                                            # cap each commentary field (huge outliers)

SYS = ("You are a Torah scholar. Given a verse's word list and its Jewish commentary "
       "(Rashi, Ramban, Cassuto, Baal ha-Turim), write for each word a CONCISE Hebrew "
       "note (a few words) that conveys how the commentary understands that word IN "
       "CONTEXT. Leave the note an empty string for words the commentary doesn't "
       "specifically illuminate. Be precise — do not invent. Reply with ONLY a JSON "
       "list of {\"note\":...} in the SAME order and count as the word list.")


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    env = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not key and os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            if line.strip().startswith('ANTHROPIC_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def ensure_table(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS word_jewish("
                 "verse_id INTEGER, pos INTEGER, word TEXT, note TEXT, PRIMARY KEY(verse_id,pos))")
    conn.commit()


def todo_verses(conn):
    done = set(r[0] for r in conn.execute("SELECT DISTINCT verse_id FROM word_jewish"))
    rows = conn.execute(
        "SELECT id FROM verses WHERE TRIM(COALESCE(rashi,''))<>'' OR TRIM(COALESCE(ramban,''))<>'' "
        "OR TRIM(COALESCE(cassuto,''))<>'' OR TRIM(COALESCE(baal_haturim,''))<>'' ORDER BY id").fetchall()
    return [r[0] for r in rows if r[0] not in done]


def commentary(conn, vid):
    r = conn.execute("SELECT text, rashi, ramban, cassuto, baal_haturim FROM verses WHERE id=?", (vid,)).fetchone()
    parts = []
    for name, key in [('רש"י', 'rashi'), ('רמב"ן', 'ramban'), ('קאסוטו', 'cassuto'), ('בעל הטורים', 'baal_haturim')]:
        v = (r[key] or '').strip()
        if v:
            parts.append('%s: %s' % (name, v[:CAP]))
    return r['text'] or '', '\n'.join(parts)


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
    print(f"{len(vids)} verses with Jewish commentary to note")
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set'); sys.exit(1)
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    tin = tout = 0
    for n, vid in enumerate(vids, 1):
        text, comm = commentary(conn, vid)
        toks = [w for w in text.split() if re.search('[א-ת]', w)]
        if not toks or not comm:
            continue
        user = "WORDS: %s\n\nCOMMENTARY:\n%s" % (' | '.join(toks), comm)
        msg = None
        for attempt in range(5):
            try:
                msg = client.messages.create(model=MODEL, max_tokens=1500, system=SYS,
                                             messages=[{'role': 'user', 'content': user}])
                break
            except Exception as e:
                if attempt == 4:
                    print("  ! giving up on verse %d: %s" % (vid, e)); break
                time.sleep(3 * (attempt + 1))
        if msg is None:
            continue
        tin += msg.usage.input_tokens; tout += msg.usage.output_tokens
        txt = ''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text')
        m = re.search(r'\[.*\]', txt, re.S)
        lst = []
        if m:
            try:
                lst = json.loads(m.group(0))
            except json.JSONDecodeError:
                lst = []
        for pos, (word, item) in enumerate(zip(toks, lst)):
            note = (item.get('note') if isinstance(item, dict) else '') or ''
            conn.execute("INSERT OR REPLACE INTO word_jewish VALUES (?,?,?,?)", (vid, pos, word, note.strip()))
        conn.commit()
        if args.sample:
            print("  verse %d:" % vid)
            for word, it in zip(toks, lst):
                nt = (it or {}).get('note', '')
                if nt:
                    print("    %-16s -> %s" % (word, nt))
        if n % 25 == 0:
            print(f"  {n}/{len(vids)}")
        time.sleep(0.2)
    cost = tin / 1e6 * 3 + tout / 1e6 * 15      # Sonnet pricing
    print(f"\ntokens in={tin} out={tout} | this run ≈ ${cost:.2f} (Sonnet)")


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
