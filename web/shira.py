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
import shutil
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
        rows = d if isinstance(d, list) else []
    except (OSError, ValueError):
        return []
    # A recording made here is collected later by the machine that holds the
    # archive drive, which files it as an ordinary addition in the repo and
    # leaves this row alone until a deploy carries the repo's copy up. For
    # that one stretch it is written in both places, so the filed copy — the
    # later word, and the one pointing at the media server — wins, and this
    # one steps aside. Without this the recording would appear twice.
    try:
        filed = {r.get('id') for r in ADD.load()}
    except (OSError, ValueError):
        filed = set()
    return [r for r in rows if r.get('id') not in filed]


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
_OPEN_FILES = ('index.html', 'unit.css', 'unit.js', 'lame.min.js')
# the catalogue, and the two lists the picture screen reads: the photographs
# on the community's own site, and the archive's own pictures and films
_OPEN_DATA  = ('catalog.json', 'pix_sources.json', 'local_media.json',
               'piyyut_texts.json')

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


@shira.route('/shira/api/rec/<path:rel>')
def api_rec_file(rel):
    """A recording made in the app, played straight off the site's own disk.

    Every other recording is streamed from the media server, which this one
    is not on yet. Public on purpose: it is in the catalogue, so it has to
    answer to the same listeners as everything else in it.
    """
    d = _rec_dir()
    if not d:
        return ('', 404)
    # conditional: the player asks for byte ranges, and seeking depends on
    # getting them rather than the whole file each time
    return send_from_directory(d, rel, conditional=True, max_age=86400)


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


@shira.route('/shira/api/version')
def api_version():
    """Which build this is. The page asks for it to put in its own footer, and
    here it was the one request that answered 404 — so the version simply never
    appeared on the web copy. The number is the unit's own VERSION file, which
    is deployed with it, so the two cannot disagree."""
    try:
        with open(os.path.join(UNIT, 'VERSION'), encoding='utf-8') as fh:
            v = fh.read().strip()
    except OSError:
        v = ''
    return jsonify({'version': v, 'local': False})


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

# A recording made in the app lands here, on the site's own persistent disk,
# and is served from here — not from the media server, which this end has no
# way to write to. It stays until the machine that holds the archive drive
# collects it (scripts/live_mp3.py), which copies it to the media server and
# points the catalogue entry there instead. The disk is small and it is the
# same disk the edits live on, so the limits below are not negotiable: a
# recording that cannot be stored safely is refused, with a reason, rather
# than filling the disk that everything else depends on.
REC_SUB      = 'rec'
MAX_REC      = 80 * 1024 * 1024        # one recording
MAX_REC_ALL  = 500 * 1024 * 1024       # all of them, uncollected
KEEP_FREE    = 200 * 1024 * 1024       # never take the disk below this


def _rec_dir(make=False):
    d = _live_path(REC_SUB)
    if d and make:
        os.makedirs(d, exist_ok=True)
    return d


def _rec_file(name):
    """The path of one waiting recording, or '' if that is not where it is."""
    d = _rec_dir()
    if not d:
        return ''
    name = str(name or '').replace('\\', '/').lstrip('/')
    if name.startswith(REC_SUB + '/'):
        name = name[len(REC_SUB) + 1:]
    if not name:
        return ''
    root = os.path.abspath(d)
    full = os.path.abspath(os.path.join(root, name))
    return full if full.startswith(root + os.sep) else ''


def _rec_list():
    """What is waiting, for the collector to come and fetch."""
    d = _rec_dir()
    out = []
    if not d or not os.path.isdir(d):
        return out
    for base, _dirs, files in os.walk(d):
        for f in files:
            full = os.path.join(base, f)
            try:
                st = os.stat(full)
            except OSError:
                continue
            out.append({'name': os.path.relpath(full, d).replace(os.sep, '/'),
                        'bytes': st.st_size, 'mtime': int(st.st_mtime)})
    return sorted(out, key=lambda r: r['mtime'])


def _rec_room(n):
    """Is there room for `n` more bytes? Returns an error message, or ''."""
    d = _rec_dir()
    if not d:
        return 'אין דיסק קבוע בשרת זה'
    if n > MAX_REC:
        return 'ההקלטה גדולה מ-%d מגה' % (MAX_REC // 1048576)
    held = sum(r['bytes'] for r in _rec_list())
    if held + n > MAX_REC_ALL:
        return ('הדיסק של האתר מחזיק %d מגה של הקלטות שעוד לא נאספו — '
                'הרץ את האיסוף מן המחשב שבו כונן הארכיון'
                % (held // 1048576))
    probe = d                              # the rec folder may not exist yet,
    while probe and not os.path.isdir(probe):   # so ask about the nearest
        up = os.path.dirname(probe)             # folder that does — otherwise
        if up == probe:                         # the question goes unasked
            break
        probe = up
    try:
        free = shutil.disk_usage(probe).free
    except OSError:
        free = None
    if free is not None and free - n < KEEP_FREE:
        return 'אין מקום פנוי בדיסק של האתר'
    return ''


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

    why = _rec_room(len(data))
    if why:
        return jsonify({'ok': False, 'error': 'no_room', 'message': why}), 507

    piyyut = _safe(request.form.get('piyyut'), 'הקלטה')
    perf   = _safe(request.form.get('performer'), 'לא ידוע')
    title  = _safe(request.form.get('title'), '') or piyyut
    stamp  = time.strftime('%Y-%m-%d %H%M')
    mine   = bool(_is_admin() and can_edit())

    # It arrives finished. The phone encodes it to MP3 before sending, because
    # no browser will record one and this server has no ffmpeg to make one, so
    # what is written here is already the file that will be played — and the
    # catalogue is told only after it is written. That order is the point: a
    # title whose file is not yet the file it will be answers with an error.
    sub = '' if mine else PENDING_DIR + '/'
    name = '%s%s %s%s' % (sub, title, stamp, ext)
    dest = _rec_file(name)
    if not dest:
        return jsonify({'ok': False, 'error': 'no_store',
                        'message': 'אין דיסק קבוע בשרת זה'}), 503
    n = 2
    while os.path.exists(dest):                      # never overwrite
        name = '%s%s %s (%d)%s' % (sub, title, stamp, n, ext)
        dest = _rec_file(name)
        n += 1
    try:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest + '.part', 'wb') as fh:
            fh.write(data)
        os.replace(dest + '.part', dest)             # whole, or not there
    except OSError as e:
        return jsonify({'ok': False, 'error': 'write_failed',
                        'message': 'הכתיבה לדיסק של האתר נכשלה: %s' % e}), 500

    rel = REC_SUB + '/' + name
    url = '/shira/api/rec/' + urllib.parse.quote(name)

    # Somebody who signed in only to record is lending a voice to the archive
    # and does not decide what it is: their recording waits for an editor to
    # name and file it, and no catalogue entry is made. The editor has already
    # named it on the form.
    if not mine:
        return jsonify({'ok': True, 'stored': rel, 'bytes': len(data),
                        'pending': True, 'url': url,
                        'message': 'ההקלטה נשמרה וממתינה למיון'})

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
        # on the site's disk, not on the media server — until it is collected
        'on_disk': 1,
        'tracks': [{'f': rel, 's': secs,
                    'n': request.form.get('title') or piyyut}],
    }
    rows.append(row)
    if not _live_write('additions.json', rows):
        try:
            os.remove(dest)      # nothing half-entered: no file, no entry
        except OSError:
            pass
        return jsonify({'ok': False, 'error': 'no_store',
                        'message': 'הרשומה לא נשמרה — ההקלטה לא נכנסה'}), 500
    return jsonify({'ok': True, 'stored': rel, 'bytes': len(data),
                    'filed': True, 'id': row['id'], 'url': url,
                    'message': 'ההקלטה נכנסה לאוצר'})


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
                    'additions': _live_adds(),
                    'rec_files': _rec_list()})


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
    # a recording that has been collected — copied to the media server and the
    # entry pointed there — no longer needs to sit on this disk. It is dropped
    # only after the entry above has been rewritten, never before.
    gone = []
    for one in (d.get('drop') or []):
        full = _rec_file(one)
        if full and os.path.isfile(full):
            try:
                os.remove(full)
                gone.append(one)
            except OSError:
                pass
    return jsonify({'ok': True, 'wrote': wrote, 'dropped': gone})


@shira.route('/shira/api/<path:_sub>', methods=['POST'])
def api_readonly(_sub):
    return jsonify({'ok': False, 'error': 'readonly',
                    'message': 'העריכה מתבצעת במחשב שבו מחובר כונן הארכיון'}), 403
