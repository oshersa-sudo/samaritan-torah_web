# -*- coding: utf-8 -*-
"""Local server for the אוצר השירה השומרונית unit.

Serves the unit, streams audio straight from the archive drive with HTTP Range
support, and exposes an admin-only upload API for adding new clips.

    py -3 serve.py            → http://127.0.0.1:8802

Admin login is the same one used to edit the Torah: ADMIN_USER / ADMIN_PASSWORD
from the repo-root .env, and the same stateless HMAC session token. With no
password configured, uploading is simply disabled — the index still works.

Nothing is copied out of the archive, and nothing is ever written into it:
uploads land in `added/` alongside this file.
"""
import os, sys, re, json, time, hmac, hashlib, urllib.parse, mimetypes
import http.server, socketserver, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'scripts'))
import additions as ADD
import media_push as PUSH
import overrides as OVR
import people as PEOPLE
import removed as GONE
from textutil import safe_name

_REPO   = os.path.dirname(HERE)
ARCHIVE = os.environ.get('SHIRA_ARCHIVE',
                         r'G:\שומרונים ומסורת- תיקייה חשובה מאד\שיראן')
ADDED   = os.environ.get('SHIRA_ADDED', os.path.join(HERE, 'added'))
PORT    = int(os.environ.get('SHIRA_PORT', '8802'))
CATALOG = os.path.join(HERE, 'data', 'catalog.json')

PHOTOS     = os.path.join(HERE, 'photos')
MAX_UPLOAD = 600 * 1024 * 1024                 # per request
# .webm is what a browser hands back when it records from the microphone
AUDIO_EXT  = {'.mp3', '.m4a', '.wav', '.aac', '.wma', '.ogg', '.opus', '.flac',
              '.webm'}
IMAGE_EXT  = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}

mimetypes.add_type('audio/mpeg', '.mp3')
mimetypes.add_type('audio/x-ms-wma', '.wma')
mimetypes.add_type('audio/mp4', '.m4a')
mimetypes.add_type('video/mpeg', '.mpg')

RANGE_RE = re.compile(r'bytes=(\d*)-(\d*)')


# ── admin auth: identical scheme to web/server.py ─────────────────────────────
def _load_dotenv():
    p = os.path.join(_REPO, '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"\''))


_load_dotenv()
ADMIN_USER     = os.environ.get('ADMIN_USER', 'oshersa')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
_TOKEN_TTL     = 12 * 3600
_LOGIN_FAILS   = {}


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


def _throttled(ip):
    """Seconds still to wait, or 0. A speed-bump against guessing."""
    now = time.time()
    fails = [t for t in _LOGIN_FAILS.get(ip, []) if now - t < 600]
    _LOGIN_FAILS[ip] = fails
    if len(fails) < 8:
        return 0
    return int(600 - (now - min(fails))) + 1


# ── multipart/form-data (the stdlib cgi module is gone in 3.13) ───────────────
def parse_multipart(body, boundary):
    """Return (fields, files) — files as (field, filename, bytes)."""
    fields, files = {}, []
    sep = b'--' + boundary
    for part in body.split(sep):
        part = part.strip(b'\r\n')
        if not part or part == b'--':
            continue
        head, _, data = part.partition(b'\r\n\r\n')
        if not _:
            continue
        disp = ''
        for line in head.decode('utf-8', 'replace').split('\r\n'):
            if line.lower().startswith('content-disposition:'):
                disp = line
        name = re.search(r'name="([^"]*)"', disp)
        fname = re.search(r'filename="([^"]*)"', disp)
        if not name:
            continue
        if fname and fname.group(1):
            files.append((name.group(1), fname.group(1), data))
        else:
            fields[name.group(1)] = data.decode('utf-8', 'replace')
    return fields, files


def probe_duration(path):
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'csv=p=0', path], capture_output=True, text=True, timeout=60)
        return round(float(out.stdout.strip()), 1)
    except Exception:
        return 0


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def log_message(self, fmt, *args):
        if '/audio/' not in (self.path or ''):
            super().log_message(fmt, *args)

    def end_headers(self):
        # The unit's own files must never be served stale — an edited unit.js
        # that the browser keeps caching looks exactly like a broken feature.
        # Audio is immutable and stays cacheable.
        if not getattr(self, '_cc_sent', False) and not self.path.startswith('/audio/'):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
            self._cc_sent = True
        super().end_headers()

    # ------------------------------------------------------------- helpers
    def json_out(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self._cc_sent = True
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_UPLOAD:
            return None
        buf, left = bytearray(), n
        while left > 0:
            chunk = self.rfile.read(min(1 << 20, left))
            if not chunk:
                break
            buf += chunk
            left -= len(chunk)
        return bytes(buf)

    def client_ip(self):
        return (self.headers.get('X-Forwarded-For', '') or
                self.client_address[0]).split(',')[0].strip()

    def is_admin(self):
        tok = self.headers.get('X-Admin-Token', '')
        return _valid_token(tok)

    # ----------------------------------------------------------------- GET
    def do_GET(self):
        p = self.path.split('?')[0]
        if p.startswith('/audio/'):
            return self.serve_audio()
        if p == '/api/catalog':
            return self.api_catalog()
        if p == '/api/admin/status':
            # the user name is not a secret (it is plain text in render.yaml);
            # sending it lets the form prefill it instead of making it a guess
            return self.json_out({'enabled': bool(ADMIN_PASSWORD),
                                  'user': ADMIN_USER if ADMIN_PASSWORD else ''})
        if p == '/api/whatsnew':
            return self.json_out({'added': ADD.load()[-60:][::-1]})
        if p == '/api/trash':
            # the recycle bin is admin-only: it lists what was taken down
            if not self.is_admin():
                return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
            import purge as PURGE
            return self.json_out({'ok': True, 'items': GONE.listing(),
                                  'purged': PURGE.log_read()[::-1][:60]})
        return super().do_GET()

    def do_HEAD(self):
        if self.path.startswith('/audio/'):
            return self.serve_audio(head=True)
        return super().do_HEAD()

    def do_POST(self):
        p = self.path.split('?')[0]
        if p == '/api/admin/login':
            return self.api_login()
        if p == '/api/upload':
            return self.api_upload()
        if p == '/api/file_pending':
            return self.api_file_pending()
        if p == '/api/delete_addition':
            return self.api_delete()
        if p == '/api/override':
            return self.api_override()
        if p == '/api/performer':
            return self.api_performer()
        if p == '/api/rename_performer':
            return self.api_rename_performer()
        if p == '/api/sync':
            return self.api_sync()
        if p == '/api/purge':
            return self.api_purge()
        if p == '/api/delete_recording':
            return self.api_delete_recording()
        if p == '/api/restore_recording':
            return self.api_restore_recording()
        self.send_error(404)

    # ------------------------------------------------------------- catalog
    def api_catalog(self):
        try:
            with open(CATALOG, encoding='utf-8') as fh:
                cat = json.load(fh)
        except OSError:
            return self.json_out({'error': 'catalog missing'}, 500)
        admin = self.is_admin()
        cat = ADD.merge(cat, ADD.load())
        cat = GONE.apply(cat, GONE.keys())        # deletions win over everything
        cat = OVR.apply(cat, OVR.load(), include_hidden=admin)
        cat = PEOPLE.apply(cat, PEOPLE.load())
        cat['meta']['admin'] = admin
        self.json_out(cat)

    # ------------------------------------------------------------- deletion
    def api_delete_recording(self):
        """Delete a recording. Uploaded audio goes to `deleted/`; master files
        on the archive drive are never touched — the recording is simply struck
        from the catalog and from anything served onward."""
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        try:
            d = json.loads(self.read_body() or b'{}')
        except ValueError:
            return self.json_out({'ok': False, 'error': 'bad json'}, 400)
        key = str(d.get('key') or '').strip()
        files = [str(f) for f in (d.get('files') or [])]
        if not key:
            return self.json_out({'ok': False, 'error': 'missing key'}, 400)

        moved, master = GONE.trash_uploads(files, ADDED)
        GONE.record(key, str(d.get('title') or ''), files, moved, by=ADMIN_USER)

        # an upload also leaves the additions index
        rows = ADD.load()
        keep = [r for r in rows
                if not any(t.get('f') in files for t in r.get('tracks', []))]
        if len(keep) != len(rows):
            ADD.save(keep)

        self.json_out({'ok': True, 'trashed': len(moved), 'master_kept': len(master)})

    def api_restore_recording(self):
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        try:
            d = json.loads(self.read_body() or b'{}')
        except ValueError:
            d = {}
        row = GONE.restore(str(d.get('key') or ''), ADDED)
        self.json_out({'ok': bool(row), 'restored': row})

    # ------------------------------------------------------------ edit meta
    def api_override(self):
        """Admin edit of one recording: title, description, performer, year,
        event, editor's note, and whether it is published."""
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        try:
            d = json.loads(self.read_body() or b'{}')
        except ValueError:
            return self.json_out({'ok': False, 'error': 'bad json'}, 400)
        key = str(d.get('key') or '').strip()
        if not key:
            return self.json_out({'ok': False, 'error': 'missing key'}, 400)

        ovr = OVR.load()
        row = dict(ovr.get(key) or {})
        for f in OVR.FIELDS:
            if f in d:
                v = d[f]
                v = bool(v) if f == 'hidden' else str(v or '').strip()
                if v:
                    row[f] = v
                else:
                    row.pop(f, None)
        if row:
            ovr[key] = row
        else:
            ovr.pop(key, None)
        OVR.save(ovr)
        self.json_out({'ok': True, 'override': row})

    def api_purge(self):
        """Delete trashed recordings from the media server for good.

        `key` purges one; `all: true` purges the whole bin. The masters on the
        archive drive are never touched, and every deletion is logged.
        """
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        try:
            d = json.loads(self.read_body() or b'{}')
        except ValueError:
            return self.json_out({'ok': False, 'error': 'bad json'}, 400)

        import purge as PURGE
        trash = GONE.load()
        keys = list(trash) if d.get('all') else [str(d.get('key') or '')]
        keys = [k for k in keys if k in trash]
        if not keys:
            return self.json_out({'ok': False, 'error': 'not in trash'}, 404)

        done, failed = [], []
        for k in keys:
            try:
                e = PURGE.purge(k, trash[k], by=ADMIN_USER)
            except Exception as exc:
                failed.append({'key': k, 'error': str(exc)[:200]})
                continue
            (failed if e.get('error') else done).append(e)
            if not e.get('error'):
                trash.pop(k, None)       # gone for good — leaves the bin too
        GONE.save(trash)

        self.json_out({
            'ok': not failed or bool(done),
            'purged': len(done),
            'failed': len(failed),
            'files_deleted': sum(e.get('deleted_from_server', 0) for e in done),
            'not_on_server': sum(e.get('not_on_server', 0) for e in done),
            'errors': [f.get('error') for f in failed][:3],
            'remaining': len(trash),
        })

    def api_sync(self):
        """Publish the unit to the live site. Local admin only — the cloud copy
        has no such route, and would have nowhere to push to anyway."""
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        import sync
        try:
            self.json_out(sync.run())
        except Exception as e:                       # git missing, no network…
            self.json_out({'ok': False, 'stage': 'run', 'error': str(e)[:400]}, 500)

    def api_rename_performer(self):
        """Rename a performer across every recording at once. Renaming onto a
        name that already exists merges the two — the way duplicates are fixed."""
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        try:
            d = json.loads(self.read_body() or b'{}')
        except ValueError:
            return self.json_out({'ok': False, 'error': 'bad json'}, 400)
        old = str(d.get('old') or '').strip()
        new = str(d.get('new') or '').strip()
        if not old or not new:
            return self.json_out({'ok': False, 'error': 'missing name'}, 400)

        ovr = OVR.load()
        OVR.set_rename(ovr, old, new)
        OVR.save(ovr)

        # carry the photo / bio across to the new name
        meta = PEOPLE.load()
        if old in meta:
            meta.setdefault(new, {}).update(meta.pop(old))
            PEOPLE.save(meta)
        self.json_out({'ok': True, 'renames': OVR.renames(OVR.load())})

    def api_performer(self):
        """Admin edit of a performer: photo (uploaded file), credit, bio, years."""
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        ctype = self.headers.get('Content-Type', '')
        m = re.search(r'boundary=([^;]+)', ctype)
        if m:
            body = self.read_body()
            if body is None:
                return self.json_out({'ok': False, 'error': 'too large'}, 413)
            fields, files = parse_multipart(body, m.group(1).strip('"').encode())
        else:
            try:
                fields, files = json.loads(self.read_body() or b'{}'), []
            except ValueError:
                return self.json_out({'ok': False, 'error': 'bad json'}, 400)

        name = str(fields.get('name') or '').strip()
        if not name:
            return self.json_out({'ok': False, 'error': 'missing name'}, 400)
        meta = PEOPLE.load()
        row = dict(meta.get(name) or {})
        for f in ('credit', 'bio', 'years'):
            if f in fields:
                v = str(fields[f] or '').strip()
                row[f] = v if v else row.pop(f, '') and ''
                if not v:
                    row.pop(f, None)

        img = next((f for f in files
                    if os.path.splitext(f[1])[1].lower() in IMAGE_EXT and f[2]), None)
        if img:
            os.makedirs(PHOTOS, exist_ok=True)
            ext  = os.path.splitext(img[1])[1].lower()
            # hash suffix: two performers can sanitise to the same string
            tag  = hashlib.sha1(name.encode('utf-8')).hexdigest()[:8]
            dest = os.path.join(PHOTOS, '%s-%s%s' % (safe_name(name, 'performer'), tag, ext))
            with open(dest, 'wb') as fh:
                fh.write(img[2])
            row['photo'] = 'photos/' + os.path.basename(dest)
        if fields.get('remove_photo'):
            row.pop('photo', None)
        if fields.get('create'):
            # a performer may be registered with nothing but a name, so that a
            # recording can be assigned to them straight away
            row.setdefault('added', time.strftime('%Y-%m-%d'))

        if row:
            meta[name] = row
        else:
            meta.pop(name, None)
        PEOPLE.save(meta)
        self.json_out({'ok': True, 'performer': row})

    # --------------------------------------------------------------- login
    def api_login(self):
        if not ADMIN_PASSWORD:
            return self.json_out({'ok': False, 'disabled': True})
        ip = self.client_ip()
        wait = _throttled(ip)
        if wait:
            return self.json_out({'ok': False, 'error': 'too many attempts',
                                  'wait': wait}, 429)
        try:
            d = json.loads(self.read_body() or b'{}')
        except ValueError:
            d = {}
        # trim: a trailing space off a copy-paste is a common cause of failure
        u, p = str(d.get('user', '')).strip(), str(d.get('password', '')).strip()
        if hmac.compare_digest(u, ADMIN_USER) and hmac.compare_digest(p, ADMIN_PASSWORD):
            _LOGIN_FAILS.pop(ip, None)          # a good login clears the record
            return self.json_out({'ok': True, 'token': _make_token()})
        _LOGIN_FAILS.setdefault(ip, []).append(time.time())
        left = max(0, 8 - len(_LOGIN_FAILS[ip]))
        return self.json_out({'ok': False, 'left': left,
                              'bad_user': not hmac.compare_digest(u, ADMIN_USER)})

    # -------------------------------------------------------------- upload
    def api_upload(self):
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        ctype = self.headers.get('Content-Type', '')
        m = re.search(r'boundary=([^;]+)', ctype)
        if 'multipart/form-data' not in ctype or not m:
            return self.json_out({'ok': False, 'error': 'expected multipart'}, 400)
        body = self.read_body()
        if body is None:
            return self.json_out({'ok': False, 'error': 'too large'}, 413)

        fields, files = parse_multipart(body, m.group(1).strip('"').encode())
        performer = (fields.get('performer') or '').strip() or 'לא ידוע'
        event     = (fields.get('event') or '').strip() or 'שונות'
        piyyut    = (fields.get('piyyut') or '').strip()
        title     = (fields.get('title') or '').strip()
        note      = (fields.get('note') or '').strip()
        if not piyyut:
            return self.json_out({'ok': False, 'error': 'שם הפיוט חסר'}, 400)
        files = [f for f in files
                 if os.path.splitext(f[1])[1].lower() in AUDIO_EXT and f[2]]
        if not files:
            return self.json_out({'ok': False, 'error': 'לא צורף קובץ שמע'}, 400)

        folder = os.path.join(ADDED, safe_name(performer, 'unknown'),
                              safe_name(piyyut, 'piyyut'))
        os.makedirs(folder, exist_ok=True)

        tracks = []
        for _, fname, data in files:
            base = safe_name(os.path.splitext(fname)[0], 'clip')
            ext  = os.path.splitext(fname)[1].lower()
            dest = os.path.join(folder, base + ext)
            i = 2
            while os.path.exists(dest):                 # never overwrite
                dest = os.path.join(folder, '%s (%d)%s' % (base, i, ext))
                i += 1
            with open(dest, 'wb') as fh:
                fh.write(data)
            rel = os.path.relpath(dest, ADDED).replace(os.sep, '/')
            tracks.append({'f': 'added/' + rel, 's': probe_duration(dest),
                           'n': os.path.splitext(os.path.basename(dest))[0]})

        rows = ADD.load()
        # a recording made in the app arrives before anyone has decided where it
        # belongs, so it is filed as pending and waits to be sorted
        pending = (fields.get('pending') or '').strip() in ('1', 'true', 'yes')
        row = {
            'id':        ADD.next_id(rows),
            'performer': performer,
            'event':     event,
            'piyyut':    piyyut,
            'title':     title or piyyut,
            'note':      note,
            'dir':       ('הקלטות למיון' if pending else 'הוספות · ' + performer),
            'added':     time.strftime('%Y-%m-%dT%H:%M:%S'),
            'tracks':    tracks,
        }
        if pending:
            row['pending'] = 1
            row['recorded'] = 1               # captured here, not uploaded
        rows.append(row)
        ADD.save(rows)
        # saved here first, then sent up — so a recording is never lost to a
        # network that happened to be down at the moment it was made
        for t in tracks:
            PUSH.push(t['f'])
        self.json_out({'ok': True, 'rec': row})

    def api_file_pending(self):
        """Clear the pending flag: the recording has been checked and filed."""
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        try:
            d = json.loads(self.read_body() or b'{}')
        except ValueError:
            return self.json_out({'ok': False, 'error': 'bad json'}, 400)
        key = str(d.get('key') or '').strip()
        if not key:
            return self.json_out({'ok': False, 'error': 'missing key'}, 400)

        rows = ADD.load()
        hit = None
        for row in rows:
            if any(t.get('f') == key for t in row.get('tracks', [])):
                hit = row
                break
        if hit is None:
            return self.json_out({'ok': False, 'error': 'not found'}, 404)
        hit.pop('pending', None)
        hit['dir'] = 'הוספות · ' + (hit.get('performer') or 'לא ידוע')
        ADD.save(rows)
        return self.json_out({'ok': True, 'rec': hit})

    def api_delete(self):
        if not self.is_admin():
            return self.json_out({'ok': False, 'error': 'unauthorized'}, 401)
        try:
            d = json.loads(self.read_body() or b'{}')
        except ValueError:
            d = {}
        rid = int(d.get('id') or 0)
        rows = ADD.load()
        keep = [r for r in rows if r['id'] != rid]
        if len(keep) == len(rows):
            return self.json_out({'ok': False, 'error': 'not found'}, 404)
        ADD.save(keep)                       # audio files are left on disk
        self.json_out({'ok': True})

    # --------------------------------------------------------------- audio
    def serve_audio(self, head=False):
        rel = urllib.parse.unquote(self.path[len('/audio/'):].split('?')[0])
        rel = rel.replace('/', os.sep).lstrip(os.sep)

        # uploads are addressed as added/<...>; everything else is the archive
        if rel.startswith('added' + os.sep):
            root, rel = ADDED, rel[len('added') + 1:]
        else:
            root = ARCHIVE
        full = os.path.normpath(os.path.join(root, rel))
        if not full.startswith(os.path.normpath(root) + os.sep):
            self.send_error(403, 'forbidden')
            return
        if not os.path.isfile(full):
            self.send_error(404, 'not on this drive')
            return

        size  = os.path.getsize(full)
        ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
        start, end, partial = 0, size - 1, False

        m = RANGE_RE.match(self.headers.get('Range') or '')
        if m:
            partial = True
            if m.group(1):
                start = int(m.group(1))
                if m.group(2):
                    end = min(int(m.group(2)), size - 1)
            elif m.group(2):
                start = max(0, size - int(m.group(2)))
            if start > end or start >= size:
                self.send_response(416)
                self.send_header('Content-Range', 'bytes */%d' % size)
                self.end_headers()
                return

        length = end - start + 1
        self.send_response(206 if partial else 200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(length))
        self.send_header('Accept-Ranges', 'bytes')
        if partial:
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.end_headers()
        if head:
            return
        with open(full, 'rb') as fh:
            fh.seek(start)
            left = length
            while left > 0:
                chunk = fh.read(min(256 * 1024, left))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                left -= len(chunk)


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    print('אוצר השירה השומרונית')
    print('  http://127.0.0.1:%d' % PORT)
    print('  ארכיון : %s  %s' % (ARCHIVE,
          '✓' if os.path.isdir(ARCHIVE) else '✗ לא מחובר — האינדקס יעבוד, נגינה לא'))
    print('  הוספות : %s (%d)' % (ADDED, len(ADD.load())))
    print('  מנהל   : %s' % ('✓ מופעל (אותה סיסמה כמו עריכת התורה)' if ADMIN_PASSWORD
                             else '✗ אין ADMIN_PASSWORD ב-.env — העלאה מושבתת'))
    if not os.path.exists(CATALOG):
        print('  ✗ data/catalog.json חסר — הרץ: py -3 scripts/build_catalog.py')
    try:
        with Server(('127.0.0.1', PORT), Handler) as srv:
            srv.serve_forever()
    except KeyboardInterrupt:
        print('\nהופסק.')
