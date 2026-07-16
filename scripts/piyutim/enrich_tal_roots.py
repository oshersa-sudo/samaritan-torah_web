"""Enrich piyutim_words with a resolved Tal-dictionary root + gloss for every
word, reusing the app's existing word -> root -> entry pipeline (tal_full_lookup,
which already backs the Torah's own "מילון מילים" feature) instead of only the
flat ~300-word piyutim_dict / direct tal_word_gloss overlap.

No paid API calls -- pure local lookup against already-built dictionary tables
(tal_auth_entries / root_index / tal_forms / tal_word_gloss / dict_root_index).
Only FILLS empty `definition` cells (the pre-existing ~137 curated glosses, from
the user's own rhyme-book cross-reference, are left untouched); `tal_root` is
set for every word that resolves, even ones that already had a definition.

  py -3 scripts/piyutim/enrich_tal_roots.py            # dry-run: stats only
  py -3 scripts/piyutim/enrich_tal_roots.py --apply    # write tal_root + fill empty definitions
"""
import os
import sqlite3
import sys
import time

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
sys.path.insert(0, ROOT)
from app.services import database as db  # noqa: E402

DB = os.path.join(ROOT, 'data', 'torah.db')


def main(apply):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cols = {r[1] for r in cur.execute("PRAGMA table_info(piyutim_words)").fetchall()}
    if 'tal_root' not in cols:
        if apply:
            cur.execute('ALTER TABLE piyutim_words ADD COLUMN tal_root TEXT')
            conn.commit()
        else:
            print('(dry-run) would ALTER TABLE piyutim_words ADD COLUMN tal_root TEXT')

    rows = cur.execute('SELECT word, definition FROM piyutim_words').fetchall()
    total = len(rows)
    resolved = filled_def = 0
    t0 = time.time()
    updates = []
    for i, r in enumerate(rows):
        res = db.tal_full_lookup(r['word'])
        roots = res.get('roots') or []
        if not roots:
            continue
        resolved += 1
        root = roots[0]['root']
        gloss = ''
        for rt in roots:
            for s in rt['senses']:
                if (s.get('gloss') or '').strip():
                    gloss = s['gloss'].strip()
                    break
            if gloss:
                break
        new_def = r['definition']
        if not (new_def or '').strip() and gloss:
            new_def = gloss
            filled_def += 1
        updates.append((root, new_def, r['word']))
        if apply and len(updates) >= 2000:
            cur.executemany('UPDATE piyutim_words SET tal_root=?, definition=? WHERE word=?', updates)
            conn.commit()
            updates = []
        if (i + 1) % 5000 == 0:
            print('%d/%d words processed (%.0fs elapsed)' % (i + 1, total, time.time() - t0))
    if apply and updates:
        cur.executemany('UPDATE piyutim_words SET tal_root=?, definition=? WHERE word=?', updates)
        conn.commit()
    conn.close()
    print('%s: %d/%d words resolved a Tal root, %d previously-empty definitions filled (%.0fs)'
          % ('APPLIED' if apply else 'DRY-RUN', resolved, total, filled_def, time.time() - t0))


if __name__ == '__main__':
    main('--apply' in sys.argv)
