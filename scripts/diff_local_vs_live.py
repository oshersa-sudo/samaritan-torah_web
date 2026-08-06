# -*- coding: utf-8 -*-
"""
Compare the local working torah.db against a downloaded copy of the live
(production) DB — same logic as web/server.py's _reseed_diff_report(), run
standalone against an arbitrary "live" file path instead of the persistent
disk. Read-only against both files.

Text differences are split into "punctuation-only" (ignored per request) vs
"real wording differs" (using the same strip_punct() used throughout the
comparison scripts), since local has several punctuation-merge passes applied
that the live DB does not yet have.

Usage:
  py -3 scripts/diff_local_vs_live.py "<path to live/downloaded db>"
"""
import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import exod_compare as X

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_DB = os.path.join(_ROOT, 'data', 'torah.db')

_CONTENT_TABLES = [
    ('verse_dictionary', 'verse_id'), ('word_gloss', 'verse_id'), ('word_jewish', 'verse_id'),
    ('word_samaritan', 'verse_id'), ('word_align', 'verse_id'), ('verse_translit', 'verse_id'),
    ('vongall_apparatus', 'verse_id'), ('binyamim_verse_links', 'verse_id'),
    ('eyalk_verse_links', 'verse_id'), ('shyt_verse_links', 'verse_id'), ('sir_verse_links', 'verse_id'),
    ('tm_verse_links', 'verse_id'), ('tradart_verse_links', 'verse_id'), ('tzdaka_verse_links', 'verse_id'),
]


def _loc(conn, vid):
    r = conn.execute("""SELECT bk.name book, c.number cn, v.number vn FROM verses v
        JOIN chapters c ON c.id=v.chapter_id JOIN books bk ON bk.id=c.book_id WHERE v.id=?""", (vid,)).fetchone()
    return '%s %s:%s' % (r['book'], r['cn'], r['vn']) if r else str(vid)


def main(live_path):
    lo = sqlite3.connect(LOCAL_DB); lo.row_factory = sqlite3.Row
    li = sqlite3.connect(live_path); li.row_factory = sqlite3.Row

    print(f'LOCAL : {LOCAL_DB}')
    print(f'LIVE  : {live_path}')
    print()

    books = [dict(r) for r in li.execute('SELECT id, name FROM books ORDER BY id')]
    print('=== sam_chapters per book ===')
    for bk in books:
        bid = bk['id']
        lo_sc = {r['id']: r['number'] for r in lo.execute('SELECT id, number FROM sam_chapters WHERE book_id=?', (bid,))}
        li_sc = {r['id']: r['number'] for r in li.execute('SELECT id, number FROM sam_chapters WHERE book_id=?', (bid,))}
        added = sorted(set(lo_sc) - set(li_sc))
        removed = sorted(set(li_sc) - set(lo_sc))
        renumbered = [(i, li_sc[i], lo_sc[i]) for i in sorted(set(lo_sc) & set(li_sc)) if lo_sc[i] != li_sc[i]]
        flag = '' if not (added or removed or renumbered or len(lo_sc) != len(li_sc)) else '  <-- DIFFERS'
        print(f"  {bk['name']:12s} live={len(li_sc):4d}  local={len(lo_sc):4d}  "
              f"added={len(added)} removed={len(removed)} renumbered={len(renumbered)}{flag}")
        for i, l, b in renumbered[:10]:
            print(f'      chapter id {i}: live #{l} -> local #{b}')
    print()

    lo_v = {r['id']: (r['sam_ch_id'], r['text']) for r in lo.execute('SELECT id, sam_ch_id, text FROM verses')}
    li_v = {r['id']: (r['sam_ch_id'], r['text']) for r in li.execute('SELECT id, sam_ch_id, text FROM verses')}
    v_added = sorted(set(lo_v) - set(li_v))
    v_removed = sorted(set(li_v) - set(lo_v))
    common = set(lo_v) & set(li_v)
    sam_ch_changed = [vid for vid in common if lo_v[vid][0] != li_v[vid][0]]

    punct_only = []
    real_diff = []
    for vid in common:
        lt, bt = li_v[vid][1] or '', lo_v[vid][1] or ''
        if lt == bt:
            continue
        if X.strip_punct(lt) == X.strip_punct(bt):
            punct_only.append(vid)
        else:
            real_diff.append(vid)

    print('=== verses ===')
    print(f'  verses only in LOCAL (new): {len(v_added)}')
    print(f'  verses only in LIVE (would be removed by a reseed): {len(v_removed)}')
    print(f'  sam_ch_id changed (chapter membership moved): {len(sam_ch_changed)}')
    print(f'  text differs — punctuation ONLY (excluded per request): {len(punct_only)}')
    print(f'  text differs — REAL wording change: {len(real_diff)}')
    print()

    if real_diff:
        print('=== real wording differences (first 60) ===')
        for vid in real_diff[:60]:
            print(f'  {_loc(li, vid)}')
            print(f'      live : {(li_v[vid][1] or "")[:120]}')
            print(f'      local: {(lo_v[vid][1] or "")[:120]}')
        if len(real_diff) > 60:
            print(f'  ... and {len(real_diff) - 60} more')
        print()

    if v_added:
        print('=== verses only in LOCAL (sample, first 30) ===')
        for vid in v_added[:30]:
            print(f'  {_loc(lo, vid)}: {(lo_v[vid][1] or "")[:80]}')
        print()

    if v_removed:
        print('=== verses only in LIVE — would vanish on a blind reseed (sample, first 30) ===')
        for vid in v_removed[:30]:
            print(f'  {_loc(li, vid)}: {(li_v[vid][1] or "")[:80]}')
        print()

    # content-loss risk: LIVE verse has content-table rows the LOCAL verse lacks
    content_loss = []
    for vid in (v_removed + real_diff + punct_only + sam_ch_changed):
        lost_in = []
        for table, col in _CONTENT_TABLES:
            try:
                li_n = li.execute('SELECT COUNT(*) FROM %s WHERE %s=?' % (table, col), (vid,)).fetchone()[0]
                if not li_n:
                    continue
                lo_n = lo.execute('SELECT COUNT(*) FROM %s WHERE %s=?' % (table, col), (vid,)).fetchone()[0]
                if lo_n < li_n:
                    lost_in.append(table)
            except sqlite3.OperationalError:
                continue
        if lost_in:
            content_loss.append((vid, lost_in))
        if len(content_loss) >= 40:
            break

    print(f'=== content-loss risk (live has commentary/dict rows local lacks): {len(content_loss)} ===')
    for vid, tables in content_loss[:40]:
        print(f'  {_loc(li, vid)}: {", ".join(tables)}')

    lo.close(); li.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('usage: py -3 scripts/diff_local_vs_live.py "<path to live db>"')
        sys.exit(1)
    main(sys.argv[1])
