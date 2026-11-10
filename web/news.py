# -*- coding: utf-8 -*-
"""מה חדש בכל אפליקציה — the feed behind the small blinking stars on the main menu.

Each circle of the main menu (web/static/hub.js) asks /api/news for what has been
added to its app, and shows a star with the number of items the reader has not
yet seen. Pressing the star opens just that app's news; closing it clears the star.

Where the items come from:

* the recordings archive (אוצר השירה) — automatically: every recording that is
  added carries the time it was added (the unit's additions.json), so a new piyyut
  needs nothing more than being added;
* every other app — web/data/news.json, one line per addition. Add to it with

      py -3 scripts/add_news.py library "ספר חדש נוסף" --en "A new book" --ar "..."

  whenever something is added to the timeline, the library, the manuscript
  treasury, the calendar or the genealogy. (The calendar and the genealogy are
  sites of their own and cannot tell us themselves.)

Nothing here is personal: what a reader has already seen is kept on their own
device (localStorage), never sent anywhere.
"""
import json
import os

from flask import Blueprint, jsonify

news = Blueprint('news', __name__)

_HERE = os.path.dirname(os.path.abspath(__file__))
FEED = os.path.join(_HERE, 'data', 'news.json')
KEEP = 40                                    # items kept per app


def _curated():
    try:
        with open(FEED, encoding='utf-8') as fh:
            rows = json.load(fh)
    except (OSError, ValueError):
        return []
    return [r for r in rows if isinstance(r, dict) and r.get('app') and r.get('date')]


def _shira():
    """The recordings added to the archive — read from the unit itself."""
    try:
        import shira as _unit
        rows = _unit.ADD.load()
    except Exception:
        return []
    out = []
    for r in rows[-60:]:
        added, title = r.get('added'), (r.get('piyyut') or r.get('title') or '').strip()
        if not added or not title:
            continue
        who = (r.get('performer') or '').strip()
        out.append({'app': 'shira', 'id': 'shira-%s' % r.get('id'), 'date': added,
                    'he': title, 'en': title, 'ar': title,
                    'text_he': ('מבצע: ' + who) if who and who != 'לא ידוע' else '',
                    'text_en': ('Performer: ' + who) if who and who != 'לא ידוע' else '',
                    'text_ar': ('المؤدّي: ' + who) if who and who != 'לא ידוע' else ''})
    return out


@news.route('/api/news')
def api_news():
    apps = {}
    for r in _curated() + _shira():
        apps.setdefault(r['app'], []).append(r)
    for k in apps:
        apps[k].sort(key=lambda r: r['date'], reverse=True)
        apps[k] = apps[k][:KEEP]
    resp = jsonify({'apps': apps})
    resp.headers['Cache-Control'] = 'no-store'
    return resp
