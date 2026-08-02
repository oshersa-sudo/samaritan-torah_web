# -*- coding: utf-8 -*-
"""Import the masorot_shomronim archive (historical reading witnesses, per
STANDARD chapter) into the app: re-encode each MP3 to mono VBR (~halves size),
copy to web/static/audio/masorot/m<unit_id>.mp3, and build masorot.json:

  {"readers": {"<name>": {"origin": ..., "year": ...}},
   "items": [{"u": unit_id, "book_id": N, "chapter": N, "reader": name,
              "file": "/static/audio/masorot/mNNNNN.mp3", "duration": sec}]}

Re-runnable; skips files already encoded. Run:  py -3 scripts/readings/import_masorot.py
"""
import io
import json
import os
import re
import subprocess
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
SRC = os.path.join('data', 'masorot_shomronim')
DST = os.path.join('web', 'static', 'audio', 'masorot')
os.makedirs(DST, exist_ok=True)
BOOK_IDS = {'בראשית': 1, 'שמות': 2, 'ויקרא': 3, 'במדבר': 4, 'דברים': 5}
GEM = {'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
       'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80,
       'צ': 90, 'ק': 100}


def gem2int(s):
    s = re.sub(r'["\'׳״]', '', s or '')
    return sum(GEM.get(c, 0) for c in s) or None


def probe_dur(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', path], capture_output=True, text=True)
    try:
        return round(float(out.stdout.strip()), 2)
    except ValueError:
        return 0.0


idx = json.load(open(os.path.join(SRC, 'index.json'), encoding='utf-8'))
readers, items, skipped = {}, [], []
for e in idx:
    if e.get('status') not in ('ok', 'exists'):   # both mark a valid present file
        skipped.append((e.get('unit_id'), e.get('status')))
        continue
    src = os.path.join(SRC, e['file'])
    if not os.path.exists(src):
        skipped.append((e.get('unit_id'), 'file missing'))
        continue
    fname = 'm%d.mp3' % e['unit_id']
    dst = os.path.join(DST, fname)
    if not os.path.exists(dst):
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src,
                        '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '6', dst], check=True)
    readers.setdefault(e['reader'], {'origin': e.get('origin', ''), 'year': e.get('year', '')})
    items.append({'u': e['unit_id'], 'book_id': BOOK_IDS[e['book']],
                  'chapter': e['chapter_from_num'], 'reader': e['reader'],
                  # verse span within the chapter (Samaritan verse numbering of the
                  # standard chapter) — many files cover only part of a chapter
                  'v1': gem2int(e.get('verse_from')) or 1,
                  'v2': gem2int(e.get('verse_to')) or 999,
                  'file': '/static/audio/masorot/' + fname,
                  'duration': probe_dur(dst)})

json.dump({'version': 1, 'readers': readers, 'items': items},
          open(os.path.join(DST, 'masorot.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('encoded/present: %d items | readers: %d | skipped: %s'
      % (len(items), len(readers), skipped or '-'))
sz = sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST))
print('masorot dir size: %.0f MB' % (sz / 1e6))
