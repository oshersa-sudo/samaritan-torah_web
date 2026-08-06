# -*- coding: utf-8 -*-
"""
Apply the punctuation-merge proposal from exod_compare.py to verses.text for
שמות — same treatment as was done for בראשית: source commas -> our colon
convention, source periods -> our period convention, word-aligned (not a
naive word-count offset). Does NOT touch wording differences, Samaritan
expansions, or chapter division — punctuation only, per explicit approval.

Each UPDATE is guarded by the verse's CURRENT text matching the computed
"before" value, so it's safe to re-run (idempotent) and never clobbers a
verse that changed since this was computed.

Usage:
  py -3 scripts/apply_exod_punctuation.py            # dry run (shows every change)
  py -3 scripts/apply_exod_punctuation.py --apply
"""
import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exod_compare as X

APPLY = '--apply' in sys.argv


def main():
    conn = sqlite3.connect(X.DB_PATH)
    cur = conn.cursor()
    cur.execute('''SELECT c.number, v.number, v.id, v.text, v.sam_ch_id FROM verses v
                   JOIN chapters c ON c.id=v.chapter_id
                   JOIN books b ON b.id=c.book_id WHERE b.id=2
                   ORDER BY c.number, CAST(v.number AS INTEGER),
                            CASE WHEN instr(v.number,'-')>0
                                 THEN CAST(substr(v.number, instr(v.number,'-')+1) AS INTEGER)
                                 ELSE 0 END''')
    ours = {}
    verse_id_map = {}
    ours_by_chapter = {}
    for chnum, vnum, vid, text, sam_ch_id in cur.fetchall():
        ours[(chnum, vnum)] = text or ''
        verse_id_map[(chnum, vnum)] = vid
        ours_by_chapter.setdefault(chnum, []).append((vnum, text or ''))

    entries = X.load_batches()
    entries = X.merge_split_verses(entries)
    canonical, _expansions = X.reconcile(entries, ours_by_chapter)

    punct_rows, _colon_add, _period_add, _suppressed = X.build_punctuation_merge(canonical, ours)

    changed = 0
    for p in punct_rows:
        key = (p['ch'], p['v'])
        vid = verse_id_map[key]
        if APPLY:
            cur.execute('UPDATE verses SET text=? WHERE id=? AND text=?',
                        (p['after'], vid, p['before']))
            if cur.rowcount:
                changed += 1
        else:
            changed += 1

    if APPLY:
        conn.commit()
        print(f'APPLIED: {changed} verses updated in {X.DB_PATH}')
    else:
        print(f'DRY RUN: {changed} verses would be updated. Re-run with --apply to write.')
        for p in punct_rows[:5]:
            print(f"  {p['ch']}:{p['v']}  before: {p['before']}")
            print(f"          after : {p['after']}")
    conn.close()


if __name__ == '__main__':
    main()
