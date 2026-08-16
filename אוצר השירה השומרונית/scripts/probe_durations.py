# -*- coding: utf-8 -*-
"""Read the real duration of every media file via ffprobe, into data/durations.json.

Resumable: an existing durations.json is loaded first and only missing files are
probed, so an interrupted run costs nothing.
"""
import os, json, subprocess, sys, io
from concurrent.futures import ThreadPoolExecutor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = r'G:\שומרונים ומסורת- תיקייה חשובה מאד\שיראן'
INV  = os.path.join(HERE, '..', 'data', 'raw_inventory.json')
OUT  = os.path.join(HERE, '..', 'data', 'durations.json')

rows = json.load(open(INV, encoding='utf-8'))
done = {}
if os.path.exists(OUT):
    done = json.load(open(OUT, encoding='utf-8'))

todo = [r['rel'] for r in rows if r['rel'] not in done]
print('to probe: %d (cached %d)' % (len(todo), len(done)))


def probe(rel):
    p = os.path.join(ROOT, rel.replace('/', os.sep))
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'csv=p=0', p],
            capture_output=True, text=True, timeout=60)
        return rel, round(float(out.stdout.strip()), 1)
    except Exception:
        return rel, None


with ThreadPoolExecutor(max_workers=8) as ex:
    for i, (rel, dur) in enumerate(ex.map(probe, todo), 1):
        done[rel] = dur
        if i % 400 == 0:
            print('  %d/%d' % (i, len(todo)), flush=True)

with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(done, fh, ensure_ascii=False)

ok = [v for v in done.values() if v]
print('done: %d  failed: %d  total audio %.1f hours'
      % (len(ok), len(done) - len(ok), sum(ok) / 3600))
