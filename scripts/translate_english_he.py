# -*- coding: utf-8 -*-
"""Word-level English for the "מילון מילים" picker.

Aligns the existing English Torah translation (verses.english) to each word of the
verse, and back-translates that English to Hebrew — so the picker can show, per
word: its English (from the published translation) and that English's Hebrew.
Stored per verse_dictionary row in word_english(vd_id, verse_id, en, en_he).

Model: claude-haiku-4-5 (simple alignment). Resumable, verse-batched. Usage:
  py -3 scripts/translate_english_he.py --sample 3
  py -3 scripts/translate_english_he.py
"""
import argparse, json, os, re, sqlite3, sys, time

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
MODEL = os.environ.get('EN_MODEL', 'claude-haiku-4-5')
BATCH = 8

SYS = ("You align a published English translation of a Torah verse to the verse's word "
       "list. The English is NOT word-for-word, so for each Hebrew word return the "
       "RELEVANT COMPLETE ENGLISH SEGMENT from the sentence that renders that word's "
       "clause — it may span several English words, and adjacent Hebrew words that share "
       "a clause may return the SAME segment (e.g. for 'על | ידו' both return 'by his "
       "own place'). Do NOT chop a phrase so a word gets a stray fragment. Also give a "
       "concise Hebrew meaning of that segment. Reply with ONLY a JSON object mapping "
       "each verse id to a list of {\"en\":...,\"en_he\":...} in the SAME order and "
       "count as that verse's word list.")


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    env = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not key and os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            if line.strip().startswith('ANTHROPIC_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def ensure_table(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS word_english("
                 "vd_id INTEGER PRIMARY KEY, verse_id INTEGER, en TEXT, en_he TEXT)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_we_v ON word_english(verse_id)")
    conn.commit()


def todo_verses(conn):
    done = set(r[0] for r in conn.execute("SELECT DISTINCT verse_id FROM word_english"))
    rows = conn.execute(
        "SELECT v.id FROM verses v WHERE TRIM(COALESCE(v.english,''))<>'' "
        "AND EXISTS(SELECT 1 FROM verse_dictionary d WHERE d.verse_id=v.id) ORDER BY v.id").fetchall()
    return [r[0] for r in rows if r[0] not in done]


def verse_words(conn, vid):
    return [(r['id'], (r['hebrew'] or '').split(',')[0].strip())
            for r in conn.execute("SELECT id, hebrew FROM verse_dictionary WHERE verse_id=? ORDER BY id", (vid,))]


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
    print(f"{len(vids)} verses to align (batch {BATCH})")
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set'); sys.exit(1)
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    tin = tout = 0
    for i in range(0, len(vids), BATCH):
        chunk = vids[i:i + BATCH]
        wmap = {v: verse_words(conn, v) for v in chunk}
        parts = []
        for v in chunk:
            eng = conn.execute("SELECT english FROM verses WHERE id=?", (v,)).fetchone()['english']
            words = ' | '.join(w for _, w in wmap[v])
            parts.append("=== VERSE %d ===\nWORDS: %s\nENGLISH: %s" % (v, words, eng))
        msg = None
        for attempt in range(5):                      # ride out transient 429/529 overloads
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
        # the model keys verses as "1" or "VERSE 1" — index by the number in the key
        by_num = {}
        for k, val in (data.items() if isinstance(data, dict) else []):
            mnum = re.search(r'\d+', str(k))
            if mnum:
                by_num[int(mnum.group())] = val
        for v in chunk:
            lst = by_num.get(v) or []
            vw = wmap[v]
            for (vd_id, _he), item in zip(vw, lst):
                if not isinstance(item, dict):
                    continue
                conn.execute("INSERT OR REPLACE INTO word_english VALUES (?,?,?,?)",
                             (vd_id, v, (item.get('en') or '').strip(), (item.get('en_he') or '').strip()))
        conn.commit()
        if args.sample:
            for v in chunk:
                print("  verse %d:" % v)
                for (vd, he), it in zip(wmap[v], by_num.get(v, [])):
                    print("    %-16s -> %-18s | %s" % (he, it.get('en', '?'), it.get('en_he', '?')))
        if (i // BATCH) % 10 == 0:
            print(f"  {min(i+BATCH,len(vids))}/{len(vids)}")
        time.sleep(0.2)
    cost = tin / 1e6 * 1 + tout / 1e6 * 5      # Haiku pricing
    print(f"\ntokens in={tin} out={tout} | this run ≈ ${cost:.2f} (Haiku)")


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
