# -*- coding: utf-8 -*-
"""Walk the שיראן audio archive and dump a raw inventory to JSON.

Only real listenable media is kept: Audacity `_data` scratch dirs (13,955 .au
chunks) and album-art/desktop.ini noise are skipped.
"""
import os, json, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = r'G:\שומרונים ומסורת- תיקייה חשובה מאד\שיראן'
OUT  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'raw_inventory.json')

AUDIO = {'.mp3', '.wma', '.m4a', '.wav', '.aac'}
VIDEO = {'.mp4', '.mpg', '.mpeg', '.avi', '.wmv'}

rows = []
for dp, dn, fn in os.walk(ROOT):
    dn[:] = [d for d in dn if not d.endswith('_data')]
    for f in fn:
        ext = os.path.splitext(f)[1].lower()
        if ext not in AUDIO and ext not in VIDEO:
            continue
        full = os.path.join(dp, f)
        try:
            sz = os.path.getsize(full)
        except OSError:
            sz = 0
        rel = os.path.relpath(full, ROOT)
        parts = rel.split(os.sep)
        rows.append({
            'rel':   rel.replace(os.sep, '/'),
            'name':  os.path.splitext(f)[0],
            'ext':   ext,
            'size':  sz,
            'kind':  'video' if ext in VIDEO else 'audio',
            'top':   parts[0] if len(parts) > 1 else '',
            'dirs':  parts[:-1],
        })

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(rows, fh, ensure_ascii=False, indent=1)

print('files: %d   bytes: %.1f GB' % (len(rows), sum(r['size'] for r in rows) / 1e9))
print('audio: %d   video: %d' % (sum(r['kind'] == 'audio' for r in rows),
                                 sum(r['kind'] == 'video' for r in rows)))
print('wrote', os.path.normpath(OUT))
