# -*- coding: utf-8 -*-
"""Phase 2 — LLM precise-meaning tagging for the Aramaic dictionary.

The deterministic layer groups a clicked word's occurrences by ROOT. This pass
splits a root's occurrences by SENSE, so a polysemous word shows only the Torah
verses and Tibåt Mårqe passages that share its precise meaning.

Stages (all resumable; checkpointed straight to the DB):
  A. Per multi-sense root, consolidate Tal's raw glosses into a minimal set of
     distinct senses, and assign every surface form to one sense.
        -> dict_sense(root_norm, sense_id, label)
        -> dict_word_sense(word_norm, root_norm, sense_id)
  B. Per Tibåt Mårqe passage, decide which sense each present multi-sense root
     carries in that passage.
        -> dict_memar_sense(section_id, root_norm, sense_id)
  C. (deterministic, no API) Per Torah verse occurrence of a multi-sense root,
     read the verse's Aramaic word for that root and inherit its sense.
        -> dict_torah_sense(verse_id, root_norm, sense_id)

Model: claude-opus-4-8 (adaptive thinking).  Usage:
  py -3 scripts/llm_sense_tagging.py --stage A --sample 3     # dry sample
  py -3 scripts/llm_sense_tagging.py --stage A                # full
  py -3 scripts/llm_sense_tagging.py --stage B
  py -3 scripts/llm_sense_tagging.py --stage C
"""
import argparse, json, os, re, sqlite3, sys, time

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
MODEL = os.environ.get('SENSE_MODEL', 'claude-opus-4-8')
FIN = {'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ'}


def norm(w):
    w = re.sub('[֑-ׇ]', '', w or '')
    return ''.join(FIN.get(c, c) for c in w)


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    env = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not key and os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            if line.strip().startswith('ANTHROPIC_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def ensure_tables(conn):
    conn.executescript("""
      CREATE TABLE IF NOT EXISTS dict_sense(
        root_norm TEXT, sense_id INTEGER, label TEXT,
        PRIMARY KEY(root_norm, sense_id));
      CREATE TABLE IF NOT EXISTS dict_word_sense(
        word_norm TEXT, root_norm TEXT, sense_id INTEGER,
        PRIMARY KEY(word_norm, root_norm));
      CREATE TABLE IF NOT EXISTS dict_memar_sense(
        section_id INTEGER, root_norm TEXT, sense_id INTEGER,
        PRIMARY KEY(section_id, root_norm));
      CREATE TABLE IF NOT EXISTS dict_torah_sense(
        verse_id INTEGER, root_norm TEXT, sense_id INTEGER,
        PRIMARY KEY(verse_id, root_norm));
      CREATE INDEX IF NOT EXISTS ix_ds_root ON dict_sense(root_norm);
      CREATE INDEX IF NOT EXISTS ix_dws_wr ON dict_word_sense(word_norm, root_norm);
      CREATE INDEX IF NOT EXISTS ix_dms ON dict_memar_sense(root_norm, sense_id);
      CREATE INDEX IF NOT EXISTS ix_dts ON dict_torah_sense(root_norm, sense_id);
    """)
    conn.commit()


def multi_sense_roots(conn):
    multi = set(r[0] for r in conn.execute(
        "SELECT root_norm FROM tal_auth_entries WHERE TRIM(COALESCE(gloss_he,''))<>'' "
        "AND TRIM(COALESCE(root_norm,''))<>'' GROUP BY root_norm "
        "HAVING COUNT(DISTINCT gloss_he)>1"))
    torah = set(r[0] for r in conn.execute(
        "SELECT DISTINCT root_norm FROM root_index WHERE root_norm<>''"))
    memar = set(r[0] for r in conn.execute(
        "SELECT DISTINCT root_norm FROM dict_word_index WHERE in_memar=1 AND root_norm<>''"))
    return sorted(multi & (torah | memar))


def call_json(client, system, user, max_tokens):
    """One Opus call returning a parsed JSON object (best-effort extraction).
    Thinking is omitted — this is a structured lexicography task, and omitting it
    is far faster and cheaper while quality holds (validated on a sample)."""
    msg = client.messages.create(
        model=MODEL, max_tokens=max_tokens,
        system=system, messages=[{'role': 'user', 'content': user}])
    text = ''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text')
    m = re.search(r'\{.*\}', text, re.S)
    if not m:
        return None, msg
    try:
        return json.loads(m.group(0)), msg
    except json.JSONDecodeError:
        return None, msg


# ── Stage A ───────────────────────────────────────────────────────────────────
SYS_A = ("You are a lexicographer of Samaritan Aramaic, working from A. Tal's "
         "Dictionary of Samaritan Aramaic. For each root you are given its raw "
         "dictionary glosses (Hebrew) and its surface word-forms. Consolidate the "
         "glosses into the MINIMAL set of genuinely distinct senses — merge "
         "near-synonyms and inflectional nuances; most roots have 1, some 2-3, at "
         "most 4. Order the senses by frequency, the most common first (id 1). Give "
         "each sense a short Hebrew label. Then, in 'forms', list ONLY the forms "
         "whose sense is 2 or higher — every form you omit defaults to sense 1. "
         "Reply with ONLY a JSON object, no markdown, no prose. Schema: "
         '{"<root>":{"senses":[{"id":1,"label":"..."}],"forms":{"<form>":2}}}')


def stage_a(conn, client, sample=0, batch=10):
    roots = [r for r in multi_sense_roots(conn)
             if not conn.execute("SELECT 1 FROM dict_sense WHERE root_norm=? LIMIT 1", (r,)).fetchone()]
    if sample:
        roots = roots[:sample]
    print(f"Stage A: {len(roots)} roots to tag")
    done = 0
    for i in range(0, len(roots), batch):
        chunk = roots[i:i + batch]
        parts = []
        for rn in chunk:
            glosses = [g[0].strip() for g in conn.execute(
                "SELECT DISTINCT gloss_he FROM tal_auth_entries WHERE root_norm=? "
                "AND TRIM(COALESCE(gloss_he,''))<>'' ORDER BY pdf, ord", (rn,))][:10]
            forms = [w[0] for w in conn.execute(
                "SELECT DISTINCT word_norm FROM dict_word_index WHERE root_norm=? "
                "ORDER BY word_norm", (rn,))][:60]
            parts.append("ROOT %s\nglosses:\n%s\nforms: %s" % (
                rn, '\n'.join('  - ' + g for g in glosses), ', '.join(forms)))
        data, msg = call_json(client, SYS_A, '\n\n'.join(parts), 4000)
        if not data:
            print("  ! no JSON for batch", i // batch, "- skipping"); continue
        for rn in chunk:
            d = data.get(rn) or data.get(rn.strip())
            if not d:
                continue
            senses = d.get('senses') or []
            for s in senses:
                try:
                    sid = int(s.get('id'))
                except (TypeError, ValueError):
                    continue
                conn.execute("INSERT OR REPLACE INTO dict_sense VALUES (?,?,?)",
                             (rn, sid, (s.get('label') or '').strip()))
            # every form of the root defaults to sense 1; the model lists only the
            # exceptions (sense >= 2), which we override on top of the default.
            for (wnf,) in conn.execute(
                    "SELECT DISTINCT word_norm FROM dict_word_index WHERE root_norm=?", (rn,)):
                conn.execute("INSERT OR REPLACE INTO dict_word_sense VALUES (?,?,?)", (wnf, rn, 1))
            for form, sid in (d.get('forms') or {}).items():
                try:
                    conn.execute("INSERT OR REPLACE INTO dict_word_sense VALUES (?,?,?)",
                                 (norm(form), rn, int(sid)))
                except (TypeError, ValueError):
                    pass
        conn.commit()
        done += len(chunk)
        if sample:
            for rn in chunk:
                ss = conn.execute("SELECT sense_id,label FROM dict_sense WHERE root_norm=? ORDER BY sense_id", (rn,)).fetchall()
                ws = conn.execute("SELECT word_norm,sense_id FROM dict_word_sense WHERE root_norm=? ORDER BY sense_id", (rn,)).fetchall()
                print(f"\n  ROOT {rn}: senses={[(s[0],s[1]) for s in ss]}")
                print(f"    forms->sense: {[(w[0],w[1]) for w in ws][:12]}")
        print("  tagged %d/%d roots" % (done, len(roots)))
        time.sleep(0.4)


# ── Stage B ───────────────────────────────────────────────────────────────────
SYS_B = ("You are reading Tibåt Mårqe (Samaritan Aramaic). You are given a passage "
         "(Aramaic, with its Hebrew translation) and a list of roots that occur in "
         "it, each with numbered senses. For each root, decide which SINGLE sense it "
         "carries in THIS passage. Reply with ONLY a JSON object mapping root -> "
         'sense id, e.g. {"<root>":2}. Use 0 only if the root genuinely does not '
         "carry any of the listed senses here.")


def stage_b(conn, client, sample=0):
    rows = conn.execute(
        "SELECT id, aramaic, hebrew FROM tm_sections ORDER BY sort_key").fetchall()
    if sample:
        rows = rows[:sample]
    # roots that have a sense inventory with >1 sense
    multi = set(r[0] for r in conn.execute(
        "SELECT root_norm FROM dict_sense GROUP BY root_norm HAVING COUNT(*)>1"))
    # word_norm -> set(root_norm) limited to multi-sense roots
    w2r = {}
    for wn, rn in conn.execute("SELECT word_norm, root_norm FROM dict_word_index WHERE root_norm<>''"):
        if rn in multi:
            w2r.setdefault(wn, set()).add(rn)
    todo = [r for r in rows if not conn.execute(
        "SELECT 1 FROM dict_memar_sense WHERE section_id=? LIMIT 1", (r[0],)).fetchone()]
    print(f"Stage B: {len(todo)} passages to tag")
    for n, (sid, aram, heb) in enumerate(todo, 1):
        present = set()
        for w in re.findall(r'[א-ת]{2,}', aram or ''):
            for rn in w2r.get(norm(w), ()):  # roots this token could be
                present.add(rn)
        if not present:
            conn.execute("INSERT OR REPLACE INTO dict_memar_sense VALUES (?,?,?)", (sid, '', 0))
            conn.commit(); continue
        rlines = []
        for rn in sorted(present):
            ss = conn.execute("SELECT sense_id,label FROM dict_sense WHERE root_norm=? ORDER BY sense_id", (rn,)).fetchall()
            rlines.append("%s: %s" % (rn, '  '.join("%d=%s" % (s[0], s[1]) for s in ss)))
        user = "ARAMAIC: %s\nHEBREW: %s\nROOTS:\n%s" % ((aram or '')[:1600], (heb or '')[:1600], '\n'.join(rlines))
        data, msg = call_json(client, SYS_B, user, 1200)
        if data is None:
            print("  ! no JSON for passage", sid); continue
        for rn in present:
            v = data.get(rn) or data.get(rn.strip()) or 0
            try:
                conn.execute("INSERT OR REPLACE INTO dict_memar_sense VALUES (?,?,?)", (sid, rn, int(v)))
            except (TypeError, ValueError):
                conn.execute("INSERT OR REPLACE INTO dict_memar_sense VALUES (?,?,?)", (sid, rn, 0))
        conn.commit()
        if sample or n % 25 == 0:
            print("  passage %d/%d (id %d): %d roots tagged" % (n, len(todo), sid, len(present)))
            if sample:
                for rn in sorted(present):
                    print("     %s -> %s" % (rn, data.get(rn)))
        time.sleep(0.3)


# ── Stage C (deterministic) ────────────────────────────────────────────────────
def stage_c(conn):
    """Per Torah verse occurrence of a multi-sense root, inherit the sense of the
    verse's Aramaic word for that root (from dict_word_sense). No API calls."""
    multi = set(r[0] for r in conn.execute(
        "SELECT root_norm FROM dict_sense GROUP BY root_norm HAVING COUNT(*)>1"))
    # word_norm -> root_norm (restricted to multi) for resolving a verse's words
    w2r = {}
    for wn, rn in conn.execute("SELECT word_norm, root_norm FROM dict_word_index WHERE root_norm<>''"):
        if rn in multi:
            w2r.setdefault(wn, set()).add(rn)
    wsense = {}
    for wn, rn, sid in conn.execute("SELECT word_norm, root_norm, sense_id FROM dict_word_sense"):
        wsense[(wn, rn)] = sid
    # verse_id -> its Aramaic words
    vwords = {}
    for vid, aram in conn.execute("SELECT verse_id, aramaic FROM verse_dictionary"):
        vwords.setdefault(vid, []).extend(re.findall(r'[א-ת]{2,}', aram or ''))
    n = 0
    conn.execute("DELETE FROM dict_torah_sense")
    for rn in multi:
        for (vid,) in conn.execute(
                "SELECT DISTINCT verse_id FROM root_index WHERE root_norm=? AND verse_id IS NOT NULL", (rn,)):
            sid = None
            for w in vwords.get(vid, ()):
                wn = norm(w)
                if rn in w2r.get(wn, ()):
                    sid = wsense.get((wn, rn))
                    if sid:
                        break
            if sid is None:
                sid = 1                       # default to the primary sense
            conn.execute("INSERT OR REPLACE INTO dict_torah_sense VALUES (?,?,?)", (vid, rn, sid))
            n += 1
    conn.commit()
    print("Stage C: tagged %d Torah verse-occurrences" % n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', choices=['A', 'B', 'C'], required=True)
    ap.add_argument('--sample', type=int, default=0)
    args = ap.parse_args()
    conn = sqlite3.connect(DB, timeout=60)
    conn.execute('PRAGMA busy_timeout=60000')
    ensure_tables(conn)
    if args.stage == 'C':
        stage_c(conn); return
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set'); sys.exit(1)
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    if args.stage == 'A':
        stage_a(conn, client, sample=args.sample)
    elif args.stage == 'B':
        stage_b(conn, client, sample=args.sample)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
