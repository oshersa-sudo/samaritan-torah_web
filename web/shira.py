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
import hashlib
import hmac
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
import merges as MERGE           # noqa: E402
import overrides as OVR          # noqa: E402
import people as PEOPLE          # noqa: E402
import removed as GONE           # noqa: E402

MEDIA = os.environ.get('SHIRA_MEDIA', 'https://shira.onyx-study.com/archive/')

# ---------------------------------------------------------------- editing here
#
# Everything else under /shira is read-only, and for a plain reason: this
# container's filesystem is rebuilt on every deploy, so an edit written into it
# would last until the next push and then vanish. That is why saving used to
# answer 403.
#
# There is one place that survives — the persistent disk the Torah database
# already lives on. Edits made on the site are written there, as a LAYER over
# the files that came with the repository rather than instead of them:
#
#     what the site shows  =  the repo's edit files  +  the layer on the disk
#
# which is what lets both ends keep working. Publishing from the machine that
# holds the archive drive still takes effect, an edit made here is not erased
# by the next deploy, and where the two speak about the same recording the one
# made here wins because it is the later word. Without the layering one side
# would have to be declared the loser, and that is how the Torah database came
# to have edits in one copy and not the other.
LIVE_DIR = os.environ.get('SHIRA_LIVE_DIR') or (
    '/var/data/shira' if os.path.isdir('/var/data') else '')


def _live_path(name):
    return os.path.join(LIVE_DIR, name) if LIVE_DIR else ''


def _live_read(name):
    p = _live_path(name)
    if not p or not os.path.exists(p):
        return {}
    try:
        with open(p, encoding='utf-8') as fh:
            d = json.load(fh)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def _live_write(name, data):
    p = _live_path(name)
    if not p:
        return False
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, p)                     # never leave a half-written file
    return True


def _live_adds():
    """Recordings made on the site itself.

    additions.json is a LIST where the other edit files are maps, so it cannot
    be layered entry by entry — it is simply appended, which is right: an
    upload is a new thing rather than a correction to an old one.
    """
    p = _live_path('additions.json')
    if not p or not os.path.exists(p):
        return []
    try:
        with open(p, encoding='utf-8') as fh:
            d = json.load(fh)
        return d if isinstance(d, list) else []
    except (OSError, ValueError):
        return []


def _layered(base, name):
    """The repo's file with the live layer on top, entry by entry."""
    over = _live_read(name)
    if not over:
        return base
    out = dict(base)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            merged = dict(out[k])
            merged.update(v)
            out[k] = merged
        else:
            out[k] = v
    return out


def can_edit():
    return bool(ADMIN_PASSWORD and LIVE_DIR)


# ---- who is allowed to. The same scheme the unit's own server uses: a
# timestamp signed with the password, carried in a header, good for a day.
ADMIN_USER = os.environ.get('ADMIN_USER', '')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
_TOKEN_TTL = 24 * 3600
_FAILS = {}


def _make_token():
    ts = str(int(time.time()))
    sig = hmac.new(ADMIN_PASSWORD.encode(), ts.encode(), hashlib.sha256).hexdigest()
    return ts + '.' + sig


def _valid_token(tok):
    if not ADMIN_PASSWORD or not tok or '.' not in str(tok):
        return False
    ts, _, sig = str(tok).partition('.')
    if not ts.isdigit() or time.time() - int(ts) > _TOKEN_TTL:
        return False
    good = hmac.new(ADMIN_PASSWORD.encode(), ts.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, good)


def _is_admin():
    return _valid_token(request.headers.get('X-Admin-Token', ''))


def _throttled(ip):
    """Seconds still to wait, or 0 — a speed-bump against guessing."""
    now = time.time()
    fails = [t for t in _FAILS.get(ip, []) if now - t < 600]
    _FAILS[ip] = fails
    return 0 if len(fails) < 8 else int(600 - (now - min(fails))) + 1

# only what the page itself asks for. Everything else in the unit — its local
# server, its build scripts, the raw scan of the archive drive — stays private.
_OPEN_DIRS  = ('img/', 'fonts/', 'sounds/', 'photos/')
_OPEN_FILES = ('index.html', 'unit.css', 'unit.js')
# the catalogue, and the two lists the picture screen reads: the photographs
# on the community's own site, and the archive's own pictures and films
_OPEN_DATA  = ('catalog.json', 'pix_sources.json', 'local_media.json')

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


def _catalog():
    """The catalogue exactly as the page is served it."""
    with open(os.path.join(DATA, 'catalog.json'), encoding='utf-8') as fh:
        cat = json.load(fh)
    cat = ADD.merge(cat, ADD.load() + _live_adds())
    cat = GONE.apply(cat, GONE.keys())
    cat = OVR.apply(cat, _layered(OVR.load(), 'overrides.json'),
                    include_hidden=False)
    cat = MERGE.apply(cat, _layered(MERGE.load(), 'merges.json'))
    return PEOPLE.apply(cat, PEOPLE.load())


@shira.route('/shira/api/catalog')
def api_catalog():
    """The catalog, assembled as the unit's own server assembles it, plus the
    address the audio is streamed from."""
    try:
        with open(os.path.join(DATA, 'catalog.json'), encoding='utf-8') as fh:
            cat = json.load(fh)
    except OSError:
        return jsonify({'error': 'catalog missing'}), 500
    cat = ADD.merge(cat, ADD.load() + _live_adds())
    cat = GONE.apply(cat, GONE.keys())            # deletions win over everything
    cat = OVR.apply(cat, _layered(OVR.load(), 'overrides.json'),
                    include_hidden=False)
    # tracks joined into one file, after the edits and never before: an
    # override is keyed on the first track's path, and joining moves that key
    cat = MERGE.apply(cat, _layered(MERGE.load(), 'merges.json'))
    cat = PEOPLE.apply(cat, PEOPLE.load())
    cat['meta']['admin'] = False
    # the page reads these to know it is the online copy: it takes the
    # recording straight to the media server rather than to a local drive
    # the archive drive is not here, so adding and joining files cannot be;
    # editing what a recording SAYS, and the order of what it plays, can
    cat['meta']['readonly'] = True
    cat['meta']['can_edit'] = can_edit()
    cat['meta']['can_record'] = bool(REC_PASSWORD) or can_edit()
    cat['meta']['media'] = MEDIA
    cat['meta'].pop('root', None)     # the archive drive's own path is nobody's business
    return jsonify(cat)


@shira.route('/shira/api/whatsnew')
def api_whatsnew():
    return jsonify({'added': ADD.load()[-60:][::-1]})


@shira.route('/shira/api/admin/status')
def api_admin_status():
    """What signing in here is good for.

    Adding a recording and joining files still happen where the archive drive
    is — there is no drive here. Saying what a recording IS, and in what order
    its parts play, happens wherever the editor happens to be, which is the
    whole point of carrying the archive in a pocket.
    """
    return jsonify({'enabled': bool(ADMIN_PASSWORD or REC_PASSWORD),
                    'user': ADMIN_USER or REC_USER,
                    'readonly': True,
                    'can_edit': can_edit(),
                    'can_record': bool(REC_PASSWORD) or can_edit()})


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
    """Sign in — as the editor if the admin password is given, else to record.

    The editor's password is the app's own, so there is one to remember rather
    than two, and the token it returns is a timestamp signed with it: nothing
    is stored server-side, and it stops being accepted after a day.
    """
    d = request.get_json(silent=True) or {}
    user = (d.get('user') or '').strip()
    pwd = (d.get('password') or '').strip()
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '') \
        .split(',')[0].strip()

    wait = _throttled(ip)
    if wait:
        return jsonify({'ok': False, 'error': 'too many attempts',
                        'wait': wait}), 429

    if ADMIN_PASSWORD and user == ADMIN_USER and pwd == ADMIN_PASSWORD:
        _FAILS.pop(ip, None)
        if not can_edit():
            return jsonify({'ok': False,
                            'message': 'אין כאן אחסון קבוע, ולכן אין מה לשמור'}), 503
        return jsonify({'ok': True, 'token': _make_token(), 'user': user})

    if not REC_PASSWORD:
        _FAILS.setdefault(ip, []).append(time.time())
        return jsonify({'ok': False}), 401
    if user != REC_USER:
        _FAILS.setdefault(ip, []).append(time.time())
        return jsonify({'ok': False, 'bad_user': True}), 401
    if pwd != REC_PASSWORD:
        _FAILS.setdefault(ip, []).append(time.time())
        return jsonify({'ok': False}), 401
    # no token: the archive stays read-only here. The credentials come back so
    # the page can present them with the recording it uploads, and nothing
    # else on the site opens up.
    return jsonify({'ok': True, 'record_only': True, 'user': user})


@shira.route('/shira/api/record', methods=['POST'])
def api_record():
    """Take a recording made on the phone and put it on the media server."""
    # An editor is already signed in; the recording password is for everyone
    # else, and its absence must not stop the one person who may file things.
    if not (_is_admin() and can_edit()):
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

    # Where it lands depends on who made it. Somebody who signed in to record
    # is lending a voice to the archive and does not decide what it is: their
    # recording waits on a pile for the editor to name and file. The editor
    # has already named it on the form, so it goes straight into the archive
    # — under `added/`, which is where every upload lives and where the media
    # server is fed from, never into the scanned archive itself.
    if _is_admin() and can_edit():
        title = _safe(request.form.get('title'), '') or piyyut
        rel = 'added/%s/%s/%s%s' % (perf, piyyut, _safe(title, 'הקלטה'), ext)
        ok, err = _sftp_put(data, MEDIA_ROOT.rstrip('/') + '/' + rel)
        if not ok:
            return jsonify({'ok': False, 'error': err,
                            'message': 'ההעלאה לשרת המדיה נכשלה'}), 502
        try:
            secs = int(float(request.form.get('seconds') or 0))
        except ValueError:
            secs = 0
        rows = _live_adds()
        row = {
            'id': ADD.next_id(ADD.load() + rows),
            'piyyut': request.form.get('piyyut') or piyyut,
            'performer': request.form.get('performer') or 'לא ידוע',
            'event': request.form.get('event') or 'שונות',
            'title': request.form.get('title') or '',
            'note': request.form.get('note') or '',
            'dir': 'הוספות',
            'added': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'recorded': 1,
            # not MP3 yet, and the catalogue says so: the machine that holds
            # the drive turns it into one, because no browser can encode MP3
            # and this server has no ffmpeg to do it here
            'needs_mp3': 1,
            'tracks': [{'f': rel, 's': secs, 'n': request.form.get('title') or piyyut}],
        }
        rows.append(row)
        if not _live_write('additions.json', rows):
            return jsonify({'ok': False, 'error': 'no_store',
                            'message': 'הקול הועלה אך הרשומה לא נשמרה'}), 500
        return jsonify({'ok': True, 'stored': rel, 'bytes': len(data),
                        'filed': True, 'id': row['id'],
                        'message': 'ההקלטה נכנסה לאוצר'})

    rel = '%s/%s/%s %s%s' % (PENDING_DIR, perf, piyyut, stamp, ext)
    ok, err = _sftp_put(data, MEDIA_ROOT.rstrip('/') + '/' + rel)
    if not ok:
        return jsonify({'ok': False, 'error': err,
                        'message': 'ההעלאה לשרת המדיה נכשלה'}), 502
    return jsonify({'ok': True, 'stored': rel, 'bytes': len(data),
                    'pending': True,
                    'message': 'ההקלטה נשמרה בשרת המדיה וממתינה למיון'})


# ------------------------------------------------------------- editing
@shira.route('/shira/api/override', methods=['POST'])
def api_override():
    """What a recording says: its title, its singer, its feast, its note.

    Written to the live layer only. The repository's own file is never
    touched from here — it belongs to the machine that holds the archive.
    """
    if not _is_admin():
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    if not can_edit():
        return jsonify({'ok': False, 'error': 'no_store',
                        'message': 'אין כאן אחסון קבוע'}), 503
    d = request.get_json(silent=True) or {}
    key = (d.get('key') or '').strip()
    if not key:
        return jsonify({'ok': False, 'error': 'חסר מפתח'}), 400

    book = _live_read('overrides.json')
    cur = dict(book.get(key) or {})
    for f in ('title', 'desc', 'performer', 'event', 'year', 'note'):
        if f in d:
            v = (d.get(f) or '').strip()
            if v:
                cur[f] = v
            else:
                cur.pop(f, None)
    if 'hidden' in d:
        if d['hidden']:
            cur['hidden'] = True
        else:
            cur.pop('hidden', None)
    if cur:
        book[key] = cur
    else:
        book.pop(key, None)
    if not _live_write('overrides.json', book):
        return jsonify({'ok': False, 'error': 'השמירה נכשלה'}), 500
    return jsonify({'ok': True, 'live': True})


@shira.route('/shira/api/reorder', methods=['POST'])
def api_reorder():
    """The order the parts of one recording play in.

    A piece that arrived as twelve files is one recording with twelve tracks,
    and the order they were scanned in is not the order they are sung in. The
    whole list comes back each time rather than a pair to swap: the editor is
    looking at the order, and the order is what is saved.
    """
    if not _is_admin():
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    if not can_edit():
        return jsonify({'ok': False, 'error': 'no_store',
                        'message': 'אין כאן אחסון קבוע'}), 503
    d = request.get_json(silent=True) or {}
    key = (d.get('key') or '').strip()
    order = d.get('tracks')
    if not key or not isinstance(order, list) or len(order) < 2:
        return jsonify({'ok': False, 'error': 'חסר מפתח או סדר'}), 400

    # the recording as the site currently serves it, so the saved order is
    # built from tracks that actually exist rather than from what was posted
    cat = _catalog()
    rec = next((r for r in cat['recordings'] if MERGE.key_of(r) == key), None)
    if not rec:
        return jsonify({'ok': False, 'error': 'ההקלטה לא נמצאה'}), 404
    have = {t['f']: t for t in (rec.get('tr') or [])}
    picked, seen = [], set()
    for f in order:
        t = have.get(f)
        if t and f not in seen:
            picked.append({'f': t['f'], 's': t.get('s') or 0,
                           'n': t.get('n') or ''})
            seen.add(f)
    # Anything the posted order left out is put back at the end rather than
    # dropped. A reorder is about sequence, never about contents, and a client
    # that sends a short list — an older page, a half-finished drag — must not
    # be able to take a recording's tracks away.
    for t in (rec.get('tr') or []):
        if t['f'] not in seen:
            picked.append({'f': t['f'], 's': t.get('s') or 0,
                           'n': t.get('n') or ''})

    book = _live_read('merges.json')
    base = dict((MERGE.load().get(key) or {}))
    cur = dict(book.get(key) or base)
    cur['tracks'] = picked
    cur.setdefault('kind', 'group' if rec.get('grouped') else 'order')
    if not _live_write('merges.json', book | {key: cur}):
        return jsonify({'ok': False, 'error': 'השמירה נכשלה'}), 500
    return jsonify({'ok': True, 'live': True, 'tracks': len(picked)})


# ------------------------------------------- bringing the live layer home
#
# What is edited or recorded on the site lives on this server's disk, and the
# machine that holds the archive drive cannot see it. These two let it: one to
# read the layer, one to put a corrected layer back. That is also how a
# recording made on a telephone becomes an MP3 — the conversion happens where
# ffmpeg is, which is there and not here.
@shira.route('/shira/api/live_layer')
def api_live_layer():
    if not _is_admin():
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    return jsonify({'ok': True, 'dir': LIVE_DIR,
                    'overrides': _live_read('overrides.json'),
                    'merges': _live_read('merges.json'),
                    'additions': _live_adds()})


@shira.route('/shira/api/live_layer', methods=['POST'])
def api_live_layer_put():
    if not _is_admin():
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    if not can_edit():
        return jsonify({'ok': False, 'error': 'no_store'}), 503
    d = request.get_json(silent=True) or {}
    wrote = []
    for name, want in (('overrides.json', dict), ('merges.json', dict),
                       ('additions.json', list)):
        key = name.split('.')[0]
        if key in d and isinstance(d[key], want):
            if _live_write(name, d[key]):
                wrote.append(name)
    return jsonify({'ok': True, 'wrote': wrote})


@shira.route('/shira/api/<path:_sub>', methods=['POST'])
def api_readonly(_sub):
    return jsonify({'ok': False, 'error': 'readonly',
                    'message': 'העריכה מתבצעת במחשב שבו מחובר כונן הארכיון'}), 403
