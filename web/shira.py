# -*- coding: utf-8 -*-
"""אוצר השירה השומרונית — the recordings archive, served inside the web app.

A page of its own, with its own HTML/CSS/JS and its own catalog, served straight
out of `אוצר השירה השומרונית/` rather than copied into web/static — one copy on
disk, so the unit's build scripts keep regenerating the very files the app
serves. The app opens it in a full-screen frame from the menu, as it does the
timeline.

What the unit cannot bring with it is the audio. The recordings are 25 GB on a
media server of their own (shira.onyx-study.com), so `/shira/audio/<file>` is a
redirect there rather than a file read — and the catalog carries that base
address, letting the player skip the redirect and stream from the media server
directly.

The online copy is READ-ONLY. Locally the unit has an admin panel that adds
clips and edits the catalog by writing JSON next to itself; on Render the
filesystem resets with every deploy, so those endpoints answer 403 here and the
editing stays where the archive drive is.
"""
import json
import os
import sys
import urllib.parse

from flask import Blueprint, jsonify, redirect, request, send_from_directory

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIT  = os.path.join(_ROOT, 'אוצר השירה השומרונית')
DATA  = os.path.join(UNIT, 'data')

# the unit's own modules — the same ones its local server uses, so the catalog
# the app serves is assembled exactly as it is at home. Appended, never
# inserted: the unit's scripts/ must not come to shadow a module of the app's.
_SCRIPTS = os.path.join(UNIT, 'scripts')
if _SCRIPTS not in sys.path:
    sys.path.append(_SCRIPTS)
import additions as ADD          # noqa: E402
import overrides as OVR          # noqa: E402
import people as PEOPLE          # noqa: E402
import removed as GONE           # noqa: E402

MEDIA = os.environ.get('SHIRA_MEDIA', 'https://shira.onyx-study.com/archive/')

# only what the page itself asks for. Everything else in the unit — its local
# server, its build scripts, the raw scan of the archive drive — stays private.
_OPEN_DIRS  = ('img/', 'fonts/', 'sounds/', 'photos/')
_OPEN_FILES = ('index.html', 'unit.css', 'unit.js')
_OPEN_DATA  = ('catalog.json',)

shira = Blueprint('shira', __name__)


def _allowed(sub):
    sub = sub.lstrip('/')
    if sub in _OPEN_FILES or sub.startswith(_OPEN_DIRS):
        return True
    return sub.startswith('data/') and sub[len('data/'):] in _OPEN_DATA


@shira.route('/shira/')
@shira.route('/shira/<path:sub>')
def page(sub='index.html'):
    """The page asks for unit.css and unit.js by RELATIVE path, so the trailing
    slash matters — Flask redirects /shira to /shira/ on its own."""
    if not _allowed(sub):
        return ('', 404)
    return send_from_directory(UNIT, sub)


@shira.route('/shira/audio/<path:rel>')
def audio(rel):
    """A recording. The bytes never pass through this server: the player is sent
    to the media host, which answers Range requests so seeking works."""
    return redirect(MEDIA + urllib.parse.quote(rel), code=302)


@shira.route('/shira/api/catalog')
def api_catalog():
    """The catalog, assembled as the unit's own server assembles it, plus the
    address the audio is streamed from."""
    try:
        with open(os.path.join(DATA, 'catalog.json'), encoding='utf-8') as fh:
            cat = json.load(fh)
    except OSError:
        return jsonify({'error': 'catalog missing'}), 500
    cat = ADD.merge(cat, ADD.load())
    cat = GONE.apply(cat, GONE.keys())            # deletions win over everything
    cat = OVR.apply(cat, OVR.load(), include_hidden=False)
    cat = PEOPLE.apply(cat, PEOPLE.load())
    cat['meta']['admin'] = False
    cat['meta']['media'] = MEDIA
    cat['meta'].pop('root', None)     # the archive drive's own path is nobody's business
    return jsonify(cat)


@shira.route('/shira/api/whatsnew')
def api_whatsnew():
    return jsonify({'added': ADD.load()[-60:][::-1]})


@shira.route('/shira/api/admin/status')
def api_admin_status():
    """No admin online: editing the archive happens where the archive drive is."""
    return jsonify({'enabled': False, 'user': '', 'readonly': True})


@shira.route('/shira/api/<path:_sub>', methods=['POST'])
def api_readonly(_sub):
    return jsonify({'ok': False, 'error': 'readonly',
                    'message': 'העריכה מתבצעת במחשב שבו מחובר כונן הארכיון'}), 403
