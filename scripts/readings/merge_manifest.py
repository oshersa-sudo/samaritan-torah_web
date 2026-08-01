# -*- coding: utf-8 -*-
"""Extend web/static/audio/readings/readings.json with every portion the batch
cutter (genesis_map.json, produced in a separate session's scratchpad) has
finished so far.

The app's player (app.js: readingFor/readingBar) reads readings.json as a flat
`chapters` array matched by book_id + sam_ch_number — this script APPENDS the
new batch entries to that same array (deduped by sam_ch_number, existing
entries win) and never touches any other field, so the portion-1 pilot data
and everything else in the file stay exactly as they were.

Re-runnable: run again after the batch finishes more portions.

Usage: py -3 scripts/readings/merge_manifest.py [path-to-genesis_map.json]
"""
import io
import json
import os
import sys

TORAH = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
READINGS = os.path.join(TORAH, 'web', 'static', 'audio', 'readings')
MANIFEST = os.path.join(READINGS, 'readings.json')
SCRATCH_MAP = (sys.argv[1] if len(sys.argv) > 1 else
               r'C:\Users\osher\AppData\Local\Temp\claude'
               r'\C--Users-osher-Documents-realestate-management-20260720T201050Z-1-001'
               r'\759e0287-dd4c-40d6-a80b-b30d30ce905a\scratchpad\genesis_map.json')

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

m = json.load(open(MANIFEST, encoding='utf-8'))
have = {c['sam_ch_number'] for c in m['chapters']}
added = skipped = 0

gm = json.load(open(SCRATCH_MAP, encoding='utf-8'))
for order, p in sorted(gm.items(), key=lambda x: int(x[0])):
    if p.get('status') != 'ok':
        print('-- portion order=%s status=%s, skipped' % (order, p.get('status')))
        continue
    for c in p.get('entries', []):
        if c['sam_ch_number'] in have:
            continue
        if not os.path.exists(os.path.join(READINGS, os.path.basename(c['file']))):
            print('!! audio file missing, skipped:', os.path.basename(c['file']))
            skipped += 1
            continue
        m['chapters'].append(c)
        have.add(c['sam_ch_number'])
        added += 1

m['chapters'].sort(key=lambda c: c['sam_ch_number'])
json.dump(m, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('readings.json: %d chapters (+%d added, %d skipped-missing)'
      % (len(m['chapters']), added, skipped))
