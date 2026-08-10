# -*- coding: utf-8 -*-
"""
Load data/interp_regen_output.json (produced by regen_interpretation.py) into
verses.interpretation in the local torah.db.

Usage:
  py -3 scripts/load_interpretations.py --dry-run   # report only, no writes
  py -3 scripts/load_interpretations.py --apply      # write to the DB
"""
import os
import sys
import json
import sqlite3
import argparse

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_ROOT, 'data', 'torah.db')
OUT_PATH = os.path.join(_ROOT, 'data', 'interp_regen_output.json')


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--dry-run', action='store_true')
    g.add_argument('--apply', action='store_true')
    # Each regeneration round writes its own checkpoint (v2, v3, ...) so a bad
    # run can never overwrite the one already proven good; name it here.
    ap.add_argument('--file', default=OUT_PATH, help='checkpoint to load (default: %s)' % OUT_PATH)
    args = ap.parse_args()

    with open(args.file, encoding='utf-8') as f:
        checkpoint = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    total_verses = 0
    empty_verses = 0
    changed = 0
    for ch_id, verse_map in checkpoint.items():
        for vid, txt in verse_map.items():
            total_verses += 1
            if not txt.strip():
                empty_verses += 1
                continue
            changed += 1
            if args.apply:
                cur.execute('UPDATE verses SET interpretation=? WHERE id=?', (txt, int(vid)))

    print(f'chapters in checkpoint: {len(checkpoint)}')
    print(f'verses with an entry: {total_verses}')
    print(f'  -> non-empty (will be written): {changed}')
    print(f'  -> empty (model had nothing grounded to say, left untouched): {empty_verses}')

    if args.apply:
        conn.commit()
        print('APPLIED to', DB_PATH, 'from', args.file)
    else:
        print('DRY RUN — no writes made. Re-run with --apply to write.')
    conn.close()


if __name__ == '__main__':
    main()
