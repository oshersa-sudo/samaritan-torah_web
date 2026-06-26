# -*- coding: utf-8 -*-
"""Per-word Samaritan-source notes for the "מילון מילים" picker (source B).

For each verse linked to a Samaritan source (Tibåt Mårqe / Ṣadaqah al-Ḥakīm /
Eyalk / Shyt / Sīr al-Qulūb), the model SYNTHESISES a concise Hebrew note per word
from those passages in context — leaving a word blank where the sources don't treat
it. Stored in word_samaritan(verse_id, pos, word, note).

Model: claude-sonnet-4-6. Resumable, one verse per call. Usage:
  py -3 scripts/translate_word_samaritan.py --sample 3
  py -3 scripts/translate_word_samaritan.py
"""
import argparse, json, os, re, sqlite3, sys, time

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
MODEL = os.environ.get('SM_MODEL', 'claude-sonnet-4-6')
CAP = 2600                                            # cap the gathered Samaritan text

SYS = ("You are a scholar of the Samaritan tradition. Given a verse's word list and "
       "passages from Samaritan sources (Tibåt Mårqe and others) that relate to it, "
       "write for each word a CONCISE Hebrew note (a few words) conveying how the "
       "Samaritan tradition understands that word IN CONTEXT. Leave the note empty for "
       "words the sources don't specifically treat. Be precise — do not invent. Reply "
       "with ONLY a JSON list of {\"note\":...} in the SAME order and count as the word list.")

LINKS = [
    ("tm_verse_links", "tm_sections", "hebrew"),
    ("tzdaka_verse_links", "tzdaka_sections", "text"),
    ("eyalk_verse_links", "eyalk_sections", "text"),
    ("shyt_verse_links", "shyt_sections", "text"),
    ("sir_verse_links", "sir_sections", "text"),
]


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    env = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not key and os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            if line.strip().startswith('ANTHROPIC_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def ensure_table(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS word_samaritan("
                 "verse_id INTEGER, pos INTEGER, word TEXT, note TEXT, PRIMARY KEY(verse_id,pos))")
    conn.commit()


def todo_verses(conn):
    done = set(r[0] for r in conn.execute("SELECT DISTINCT verse_id FROM word_samaritan"))
    vids = set()
    for link, _, _ in LINKS:
        for r in conn.execute("SELECT DISTINCT verse_id FROM %s" % link):
            vids.add(r[0])
    return sorted(v for v in vids if v not in done)


def sources(conn, vid):
    out = []
    for link, sect, col in LINKS:
        rows = conn.execute(
            "SELECT s.%s AS t FROM %s l JOIN %s s ON s.id=l.section_id WHERE l.verse_id=?"
            % (col, link, sect), (vid,)).fetchall()
        for r in rows:
            t = (r['t'] or '').strip()
            if t:
                out.append(t)
    txt = '\n---\n'.join(out)
    return txt[:CAP]


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
    print(f"{len(vids)} Samaritan-linked verses to note")
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set'); sys.exit(1)
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    tin = tout = 0
    for n, vid in enumerate(vids, 1):
        text = conn.execute("SELECT text FROM verses WHERE id=?", (vid,)).fetchone()['text'] or ''
        toks = [w for w in text.split() if re.search('[א-ת]', w)]
        src = sources(conn, vid)
        if not toks or not src:
            continue
        user = "WORDS: %s\n\nSAMARITAN SOURCES:\n%s" % (' | '.join(toks), src)
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
            conn.execute("INSERT OR REPLACE INTO word_samaritan VALUES (?,?,?,?)", (vid, pos, word, note.strip()))
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
    cost = tin / 1e6 * 3 + tout / 1e6 * 15
    print(f"\ntokens in={tin} out={tout} | this run ≈ ${cost:.2f} (Sonnet)")


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
