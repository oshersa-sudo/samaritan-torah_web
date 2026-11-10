# -*- coding: utf-8 -*-
"""Add one line to what the main menu says is new in an app.

    py -3 scripts/add_news.py library "ספר חדש נוסף" --en "A new book" --ar "كتاب جديد" \
        --text "תיאור קצר" --text-en "A short note" --text-ar "..."

app is one of: shira · calendar · library · timeline · mss · genealogy · dict
(shira needs nothing: its additions are read from the archive itself).
The date defaults to now (ISO, local). The line goes to web/data/news.json.
"""
import argparse, datetime, json, os, sys

sys.stdout.reconfigure(encoding='utf-8')
FEED = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'web', 'data', 'news.json')
APPS = ('shira', 'calendar', 'library', 'timeline', 'mss', 'genealogy', 'dict')

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('app', choices=APPS)
ap.add_argument('he', help='the line, in Hebrew')
ap.add_argument('--en'); ap.add_argument('--ar')
ap.add_argument('--text'); ap.add_argument('--text-en'); ap.add_argument('--text-ar')
ap.add_argument('--date', help='ISO date or datetime; default now')
a = ap.parse_args()

rows = []
if os.path.exists(FEED):
    with open(FEED, encoding='utf-8') as fh:
        rows = json.load(fh)
row = {'app': a.app, 'date': a.date or datetime.datetime.now().replace(microsecond=0).isoformat(), 'he': a.he}
for k, v in (('en', a.en), ('ar', a.ar), ('text_he', a.text), ('text_en', a.text_en), ('text_ar', a.text_ar)):
    if v:
        row[k] = v
rows.append(row)
with open(FEED, 'w', encoding='utf-8') as fh:
    json.dump(rows, fh, ensure_ascii=False, indent=2)
    fh.write('\n')
print('added to', FEED, '→', row)
