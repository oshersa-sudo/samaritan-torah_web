# -*- coding: utf-8 -*-
"""
Reflect the שמות #137/#138 sam_chapters merge in the two audio manifests
(readings.json, witnesses.json), which the frontend matches purely by
(book_id, sam_ch_number) — app.js's readingFor() literally warns that ids
drift across DB copies and numbers are the stable coordinate.

readings.json (one dedicated mp3 per Samaritan chapter, matched via
Array.find — only the FIRST match plays): merge the #137 and #138 entries
into one #137 entry using the existing `segs` mechanism (rdSegs() already
falls back to a single full-file segment, so multi-file segs is a supported
shape) so BOTH existing recordings remain reachable, back to back.

witnesses.json (multiple items per chapter allowed, matched via Array.filter):
the #137/#138 witness clips are contiguous timestamps inside the SAME source
file, so they merge into one clean segment (t0 of #137 -> t1 of #138).

Both files then get every book_id=2 entry with sam_ch_number/n > 138
decremented by 1, to match the DB's new numbering. sam_ch_id fields for those
untouched chapters are left as-is (the underlying row's id did not change,
only its `number` column did).

Usage:
  py -3 scripts/shift_ex_manifests_137.py            # dry run
  py -3 scripts/shift_ex_manifests_137.py --apply
"""
import os
import sys
import json
import shutil
import datetime

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
READINGS_PATH = os.path.join(_ROOT, 'web', 'static', 'audio', 'readings', 'readings.json')
WITNESSES_PATH = os.path.join(_ROOT, 'web', 'static', 'audio', 'witnesses.json')
APPLY = '--apply' in sys.argv


def backup(path):
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    dst = path + f'.bak_pre_ex137merge_{ts}'
    shutil.copy(path, dst)
    return dst


def fix_readings():
    rd = json.load(open(READINGS_PATH, encoding='utf-8'))
    book = next((b for b in rd.get('books', []) if b.get('book_id') == 2), None)
    if not book:
        print('readings.json: no book_id=2 entry found'); return None
    chapters = book['chapters']
    c137 = next((c for c in chapters if c.get('sam_ch_number') == 137), None)
    c138 = next((c for c in chapters if c.get('sam_ch_number') == 138), None)
    if not c137 or not c138:
        print('readings.json: could not find both #137 and #138 entries'); return None

    print(f"readings.json: merging #137 ({c137['file']}, {c137['duration']}s) "
          f"+ #138 ({c138['file']}, {c138['duration']}s)")

    merged = dict(c137)
    merged['segs'] = [
        {'file': c137['file'], 't0': 0, 't1': c137['duration']},
        {'file': c138['file'], 't0': 0, 't1': c138['duration']},
    ]
    merged['duration'] = (c137.get('duration') or 0) + (c138.get('duration') or 0)
    merged['verse_count'] = (c137.get('verse_count') or 0) + (c138.get('verse_count') or 0)
    merged['verses_num'] = c137['verses_num'].split('-')[0] + '-' + c138['verses_num'].split('-')[-1]
    merged['name'] = c137['name']
    merged['incipit'] = c137['incipit']
    merged['src_start'] = c137.get('src_start')
    merged['src_end'] = c138.get('src_end')
    merged.pop('file', None)  # segs replaces the single-file shape

    others = [c for c in chapters if c is not c137 and c is not c138]
    for c in others:
        n = c.get('sam_ch_number')
        if n is not None and n > 138:
            c['sam_ch_number'] = n - 1
        n2 = c.get('n')
        if n2 is not None and n2 > 138:
            c['n'] = n2 - 1
    others.append(merged)
    others.sort(key=lambda c: c.get('sam_ch_number') or 0)
    book['chapters'] = others

    if APPLY:
        b = backup(READINGS_PATH)
        json.dump(rd, open(READINGS_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'  applied. backup: {b}')
    return merged


def fix_witnesses():
    wj = json.load(open(WITNESSES_PATH, encoding='utf-8'))
    items = wj.get('items', [])
    i137 = [it for it in items if it.get('book_id') == 2 and it.get('sam_ch_number') == 137]
    i138 = [it for it in items if it.get('book_id') == 2 and it.get('sam_ch_number') == 138]
    if len(i137) != 1 or len(i138) != 1:
        print(f'witnesses.json: expected exactly one #137 and one #138 item, got {len(i137)}/{len(i138)}')
        merged_list = []
    else:
        w137, w138 = i137[0], i138[0]
        s137, s138 = w137['segs'][0], w138['segs'][0]
        same_file = s137['file'] == s138['file']
        contiguous = abs(s137['t1'] - s138['t0']) < 0.5
        print(f"witnesses.json: merging #137 + #138 (same file: {same_file}, contiguous: {contiguous}, "
              f"gap={abs(s137['t1'] - s138['t0']):.2f}s)")
        merged = dict(w137)
        if same_file and contiguous:
            merged['segs'] = [{'file': s137['file'], 't0': s137['t0'], 't1': s138['t1']}]
        else:
            merged['segs'] = [s137, s138]
        merged['duration'] = sum(seg['t1'] - seg['t0'] for seg in merged['segs'])
        merged['verses'] = w137['verses'].split('-')[0] + '-' + w138['verses'].split('-')[-1]
        merged_list = [merged]

    others = [it for it in items
              if not (it.get('book_id') == 2 and it.get('sam_ch_number') in (137, 138))]
    for it in others:
        if it.get('book_id') == 2:
            n = it.get('sam_ch_number')
            if n is not None and n > 138:
                it['sam_ch_number'] = n - 1
    others.extend(merged_list)
    others.sort(key=lambda it: (it.get('book_id') or 0, it.get('sam_ch_number') or 0))
    wj['items'] = others

    if APPLY:
        b = backup(WITNESSES_PATH)
        json.dump(wj, open(WITNESSES_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'  applied. backup: {b}')


if __name__ == '__main__':
    m = fix_readings()
    fix_witnesses()
    if not APPLY:
        print('\nDRY RUN — re-run with --apply to write.')
