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
import re
import sys
import time
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
    # the page reads these to know it is the online copy: it takes the
    # recording straight to the media server rather than to a local drive
    cat['meta']['readonly'] = True
    cat['meta']['can_record'] = bool(REC_PASSWORD)
    cat['meta']['media'] = MEDIA
    cat['meta'].pop('root', None)     # the archive drive's own path is nobody's business
    return jsonify(cat)


@shira.route('/shira/api/whatsnew')
def api_whatsnew():
    return jsonify({'added': ADD.load()[-60:][::-1]})


@shira.route('/shira/api/admin/status')
def api_admin_status():
    """Editing the catalog still happens where the archive drive is; recording
    from a phone does not, so the sign-in is offered when it can be honoured."""
    return jsonify({'enabled': bool(REC_PASSWORD), 'user': REC_USER,
                    'readonly': True, 'can_record': bool(REC_PASSWORD)})


# ------------------------------------------------------------ recording
# A phone has no archive drive to write to, so a recording made in the app is
# handed to this endpoint and passed straight on to the media server, into a
# folder of its own for material that still has to be sorted. Nothing is kept
# on Render: its disk resets with every deploy.
REC_USER     = os.environ.get('SHIRA_REC_USER', '')
REC_PASSWORD = os.environ.get('SHIRA_REC_PASSWORD', '')
MEDIA_HOST   = os.environ.get('SHIRA_MEDIA_HOST', '')
MEDIA_USER   = os.environ.get('SHIRA_MEDIA_USER', 'root')
MEDIA_KEY    = os.environ.get('SHIRA_MEDIA_KEY', '')       # private key, PEM text
MEDIA_PASS   = os.environ.get('SHIRA_MEDIA_PASSWORD', '')
MEDIA_ROOT   = os.environ.get('SHIRA_MEDIA_ROOT', '/srv/shira/archive')
PENDING_DIR  = 'pending'          # under MEDIA_ROOT, alongside the archive

_AUDIO_EXT = ('.webm', '.m4a', '.mp4', '.ogg', '.opus', '.mp3', '.wav')


def _safe(name, fallback):
    """A file name safe for any filesystem, with the Hebrew left intact."""
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', ' ', (name or '')).strip()
    name = re.sub(r'\s+', ' ', name)
    return name[:110] or fallback


def _sftp_put(data, remote_path):
    """Write `data` to the media server. Returns (ok, error)."""
    if not MEDIA_HOST or not (MEDIA_KEY or MEDIA_PASS):
        return False, 'no_media_credentials'
    try:
        import io as _io
        import paramiko
    except ImportError:
        return False, 'paramiko_missing'
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        kw = {'username': MEDIA_USER, 'timeout': 20}
        if MEDIA_KEY:
            kw['pkey'] = paramiko.RSAKey.from_private_key(_io.StringIO(MEDIA_KEY))
        else:
            kw['password'] = MEDIA_PASS
        client.connect(MEDIA_HOST, **kw)
        sftp = client.open_sftp()
        # make the folder chain, ignoring the parts that already exist
        parts, path = remote_path.strip('/').split('/')[:-1], ''
        for p in parts:
            path += '/' + p
            try:
                sftp.stat(path)
            except IOError:
                sftp.mkdir(path)
        with sftp.open(remote_path, 'wb') as fh:
            fh.write(data)
        sftp.close()
        client.close()
        return True, None
    except Exception as e:                       # noqa: BLE001 — report, don't raise
        return False, str(e)[:200]


@shira.route('/shira/api/admin/login', methods=['POST'])
def api_admin_login():
    """The only thing that can be signed in for out here is recording."""
    if not REC_PASSWORD:
        return jsonify({'ok': False, 'disabled': True,
                        'message': 'ההקלטה אינה מופעלת בשרת זה'}), 403
    d = request.get_json(silent=True) or {}
    user = (d.get('user') or '').strip()
    pwd  = (d.get('password') or '').strip()
    if user != REC_USER:
        return jsonify({'ok': False, 'bad_user': True}), 401
    if pwd != REC_PASSWORD:
        return jsonify({'ok': False}), 401
    # no token: the archive stays read-only here. The credentials come back so
    # the page can present them with the recording it uploads, and nothing
    # else on the site opens up.
    return jsonify({'ok': True, 'record_only': True, 'user': user})


@shira.route('/shira/api/record', methods=['POST'])
def api_record():
    """Take a recording made on the phone and put it on the media server."""
    if not REC_PASSWORD:
        return jsonify({'ok': False, 'error': 'recording_disabled',
                        'message': 'ההקלטה אינה מופעלת בשרת זה'}), 403
    if (request.form.get('user', '') != REC_USER
            or request.form.get('password', '') != REC_PASSWORD):
        return jsonify({'ok': False, 'error': 'unauthorized',
                        'message': 'שם המשתמש או הסיסמה שגויים'}), 401

    f = request.files.get('file')
    if not f or not f.filename:
        return jsonify({'ok': False, 'error': 'לא צורף קובץ שמע'}), 400
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in _AUDIO_EXT:
        return jsonify({'ok': False, 'error': 'סוג קובץ לא נתמך'}), 400
    data = f.read()
    if not data:
        return jsonify({'ok': False, 'error': 'הקובץ ריק'}), 400

    piyyut = _safe(request.form.get('piyyut'), 'הקלטה')
    perf   = _safe(request.form.get('performer'), 'לא ידוע')
    stamp  = time.strftime('%Y-%m-%d %H%M%S')
    rel    = '%s/%s/%s %s%s' % (PENDING_DIR, perf, piyyut, stamp, ext)
    ok, err = _sftp_put(data, MEDIA_ROOT.rstrip('/') + '/' + rel)
    if not ok:
        return jsonify({'ok': False, 'error': err,
                        'message': 'ההעלאה לשרת המדיה נכשלה'}), 502
    return jsonify({'ok': True, 'stored': rel, 'bytes': len(data),
                    'pending': True,
                    'message': 'ההקלטה נשמרה בשרת המדיה וממתינה למיון'})


@shira.route('/shira/api/<path:_sub>', methods=['POST'])
def api_readonly(_sub):
    return jsonify({'ok': False, 'error': 'readonly',
                    'message': 'העריכה מתבצעת במחשב שבו מחובר כונן הארכיון'}), 403
