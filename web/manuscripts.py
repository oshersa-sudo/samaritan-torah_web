# -*- coding: utf-8 -*-
"""אוצר כתבי היד השומרוניים בתבל — the manuscript archive, served inside the web app.

Built to the same shape as `shira.py`, deliberately: a unit of its own with its
own page and its own catalog, served straight out of
`אוצר כתבי היד השומרוניים בתבל/` rather than copied into web/static, so the
harvesting scripts keep regenerating the very files the app serves. The app
opens it in a full-screen frame from the menu, as it does the recordings.

What the unit cannot bring with it is the page images. The manuscripts are
~6.3 GB of scans, so `/manuscripts/img/<file>` is a redirect to the media
server rather than a file read — the same arrangement the recordings use, and
for the same reason.

Read-only online. The harvesting, downloading and enrichment happen where the
archive drive is; this serves what those produced.
"""
import json
import os
import urllib.parse

from flask import Blueprint, jsonify, redirect, send_from_directory

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIT = os.path.join(_ROOT, 'אוצר כתבי היד השומרוניים בתבל')
DATA = os.path.join(UNIT, 'data')

# Where the scans actually live. Same pattern as SHIRA_MEDIA: the bytes never
# pass through this server.
MEDIA = os.environ.get('MSS_MEDIA', 'https://mss.onyx-study.com/images/')

# Only what the page itself asks for; the harvester, the cache and the raw
# catalogue stay private.
_OPEN_FILES = ('index.html',)
_OPEN_DIRS = ('fonts/', 'img/')
_OPEN_DATA = ('local-library.json', 'enriched-library.json', 'world-index.json',
              'viewer-library.json')

manuscripts = Blueprint('manuscripts', __name__)


def _allowed(sub):
    sub = sub.lstrip('/')
    if sub in _OPEN_FILES or sub.startswith(_OPEN_DIRS):
        return True
    if sub in _OPEN_DATA:                      # fetched relative to the page root
        return True
    return sub.startswith('data/') and sub[len('data/'):] in _OPEN_DATA


@manuscripts.route('/manuscripts/')
@manuscripts.route('/manuscripts/<path:sub>')
def page(sub='index.html'):
    """The page asks for its data by relative path, so the trailing slash
    matters — Flask redirects /manuscripts to /manuscripts/ on its own."""
    sub = sub.lstrip('/')
    if not _allowed(sub):
        return ('', 404)
    if sub in _OPEN_DATA:
        # The build step keeps the JSONs in data/; the page addresses them by
        # bare name. Bridge the two here rather than duplicating files.
        return send_from_directory(DATA, sub)
    return send_from_directory(UNIT, sub)


@manuscripts.route('/manuscripts/images/<path:rel>')
def image(rel):
    """A manuscript page. Redirected to the media host, which answers Range
    requests, so large scans stream rather than buffering through here."""
    return redirect(MEDIA + urllib.parse.quote(rel), code=302)


def _read(name):
    try:
        with open(os.path.join(DATA, name), encoding='utf-8') as fh:
            return json.load(fh)
    except OSError:
        return None


@manuscripts.route('/manuscripts/api/catalog')
def api_catalog():
    """Everything the page needs in one call: what is held, what was enriched,
    and the address the scans are served from."""
    local = _read('local-library.json') or []
    enriched = _read('enriched-library.json') or []
    world = _read('world-index.json') or []
    return jsonify({
        'local': local,
        'enriched': enriched,
        'world': world,
        'meta': {
            'media': MEDIA,
            'readonly': True,
            'held': len(local),
            'indexed': len(world),
            'pages': sum(len(x.get('files') or []) for x in local),
        },
    })


@manuscripts.route('/manuscripts/api/summary')
def api_summary():
    """Counts by holding library and by kind - what the index headers show."""
    enriched = _read('enriched-library.json') or []
    world = _read('world-index.json') or []
    by_inst, by_type = {}, {}
    for e in enriched + world:
        inst = e.get('inst') or 'לא צוין'
        kind = (e.get('type') or {}).get('he') or 'לא סווג'
        digital = bool(e.get('folder'))
        a = by_inst.setdefault(inst, {'total': 0, 'digital': 0, 'kinds': {}})
        a['total'] += 1
        a['digital'] += 1 if digital else 0
        a['kinds'][kind] = a['kinds'].get(kind, 0) + 1
        b = by_type.setdefault(kind, {'total': 0, 'digital': 0})
        b['total'] += 1
        b['digital'] += 1 if digital else 0
    return jsonify({'by_institution': by_inst, 'by_type': by_type})
