# -*- coding: utf-8 -*-
"""Word-align the (now corrected) Arabic translation of the Haazinu Song to each
Hebrew word of Deut 32:1-43, so the מילון מילים panel shows the per-word Arabic.
Overwrites verse_dictionary.arabic for those words (the old values there were the
garbage from the previous misalignment). Model: claude-sonnet-4-6.

Usage:  py -3 scripts/align_haazinu_words.py --sample 2
        py -3 scripts/align_haazinu_words.py
"""
import argparse, os, sys, sqlite3, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import align_word_arabic as A          # reuse align() + _first_json_array + api_key

DB = 'data/torah.db'


def haazinu_verses(conn):
    return [r[0] for r in conn.execute(
        """SELECT v.id FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
           WHERE ch.book_id=5 AND ch.number=32 AND CAST(v.number AS INTEGER) BETWEEN 1 AND 43
             AND TRIM(COALESCE(v.arabic_trans,''))<>''
           ORDER BY CAST(v.number AS INTEGER)""")]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--sample', type=int, default=0)
    args = ap.parse_args()
    import anthropic
    cl = anthropic.Anthropic(api_key=A.api_key())
    conn = sqlite3.connect(DB, timeout=120); conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout=120000')
    vids = haazinu_verses(conn)
    if args.sample:
        vids = vids[:args.sample]
    print('verses:', len(vids), flush=True)
    tin = tout = filled = 0
    for vid in vids:
        rows = conn.execute('SELECT id, hebrew FROM verse_dictionary WHERE verse_id=? ORDER BY id',
                            (vid,)).fetchall()
        if not rows:
            continue
        ar = conn.execute('SELECT arabic_trans FROM verses WHERE id=?', (vid,)).fetchone()[0]
        words = [(r['hebrew'] or '').split(',')[0].strip() for r in rows]
        try:
            arr, u = A.align(cl, words, ar)
        except Exception as ex:
            print('  err vid=%d: %s' % (vid, ex), flush=True); time.sleep(3); continue
        tin += u.input_tokens; tout += u.output_tokens
        arr = arr + [''] * (len(rows) - len(arr))
        for r, a in zip(rows, arr):
            conn.execute('UPDATE verse_dictionary SET arabic=? WHERE id=?', ((a or '').strip(), r['id']))
            if (a or '').strip():
                filled += 1
        conn.commit()
        if args.sample:
            vn = conn.execute('SELECT number FROM verses WHERE id=?', (vid,)).fetchone()[0]
            print('-- Deut 32:%s' % vn, flush=True)
            for w, a in zip(words, arr):
                print('   %-14s -> %s' % (w, a), flush=True)
    print('DONE. words filled: %d  tokens in=%d out=%d ~$%.2f'
          % (filled, tin, tout, tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
