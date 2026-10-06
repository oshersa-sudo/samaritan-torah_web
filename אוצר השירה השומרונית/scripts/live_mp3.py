# -*- coding: utf-8 -*-
"""Turn recordings made on the site into MP3s, here where ffmpeg is.

    py -3 scripts/live_mp3.py            # see what is waiting
    py -3 scripts/live_mp3.py --go       # convert, upload, and write back

A recording made on a telephone cannot be an MP3 when it is made. No browser
encodes one — `audio/mpeg` is refused by every MediaRecorder there is — so the
app records AAC in an MP4, which at least plays on every device including the
older iPhones a good part of this community uses. And the server it is sent to
cannot convert it either: Render runs the app without the rights to install
ffmpeg.

So the conversion happens here, on the machine the archive drive is attached
to, where ffmpeg has been doing this work all along. The recording is fetched
from the media server, re-encoded, sent back beside the original, and the
catalogue entry is pointed at the new file. The original is left where it is:
it is the thing that was actually recorded, and it costs almost nothing to
keep.
"""
import argparse
import io
import json
import os
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import media_push as PUSH                       # noqa: E402

SITE = os.environ.get('SHIRA_SITE', 'https://samaritan-torah.onrender.com')
MEDIA = os.environ.get('SHIRA_MEDIA', 'https://shira.onyx-study.com/archive/')
ADDED = os.environ.get('SHIRA_ADDED', os.path.join(UNIT, 'added'))


def say(*a):
    try:
        print(*a)
    except UnicodeEncodeError:                  # a console that cannot spell
        print(*[str(x).encode('ascii', 'replace').decode() for x in a])


def api(path, token, data=None):
    req = urllib.request.Request(
        SITE.rstrip('/') + '/shira/api/' + path,
        data=json.dumps(data).encode('utf-8') if data is not None else None,
        headers={'X-Admin-Token': token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as fh:
        return json.loads(fh.read())


def login(user, password):
    req = urllib.request.Request(
        SITE.rstrip('/') + '/shira/api/admin/login',
        data=json.dumps({'user': user, 'password': password}).encode('utf-8'),
        headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as fh:
        d = json.loads(fh.read())
    if not d.get('token'):
        raise SystemExit('הכניסה נדחתה')
    return d['token']


def fetch(rel):
    """The audio itself, straight off the media server."""
    url = MEDIA.rstrip('/') + '/' + urllib.parse.quote(rel)
    req = urllib.request.Request(url, headers={'Referer': SITE})
    with urllib.request.urlopen(req, timeout=600) as fh:
        return fh.read()


def to_mp3(data, suffix):
    """Re-encode to MP3. Returns the bytes, or None if ffmpeg would not."""
    src = dst = None
    try:
        fd, src = tempfile.mkstemp(suffix=suffix)
        os.write(fd, data)
        os.close(fd)
        dst = src + '.mp3'
        r = subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-i', src,
             '-c:a', 'libmp3lame', '-b:a', '192k', dst],
            capture_output=True, text=True, encoding='utf-8', errors='replace',
            timeout=3600)
        if r.returncode or not os.path.isfile(dst):
            say('   ffmpeg נכשל: %s' % (r.stderr or '')[-200:])
            return None
        with open(dst, 'rb') as fh:
            return fh.read()
    except FileNotFoundError:
        raise SystemExit('ffmpeg אינו מותקן על המחשב הזה')
    finally:
        for f in (src, dst):
            if f and os.path.exists(f):
                os.remove(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--user', default=os.environ.get('ADMIN_USER', ''))
    ap.add_argument('--password', default=os.environ.get('ADMIN_PASSWORD', ''))
    ap.add_argument('--go', action='store_true', help='בצע, ולא רק הצג')
    a = ap.parse_args()
    if not a.user or not a.password:
        raise SystemExit('צריך --user ו---password (או ADMIN_USER / ADMIN_PASSWORD)')

    token = login(a.user, a.password)
    layer = api('live_layer', token)
    adds = layer.get('additions') or []
    waiting = [r for r in adds if r.get('needs_mp3')]

    say('רשומות בשכבה החיה : %d' % len(adds))
    say('ממתינות להמרה     : %d' % len(waiting))
    for r in waiting:
        for t in r.get('tracks') or []:
            say('   %-46s %s' % ((r.get('title') or r.get('piyyut') or '')[:46],
                                 t.get('f', '')))
    if not waiting:
        return 0
    if not a.go:
        say('\n(הצגה בלבד. הוסף --go כדי להמיר באמת)')
        return 0

    done = 0
    for r in waiting:
        name = r.get('title') or r.get('piyyut') or 'הקלטה'
        say('\n— %s' % name[:56])
        new_tracks = []
        ok_all = True
        for t in r.get('tracks') or []:
            rel = t.get('f') or ''
            if rel.lower().endswith('.mp3'):
                new_tracks.append(t)
                continue
            try:
                data = fetch(rel)
            except Exception as e:              # noqa: BLE001
                say('   לא ירד משרת המדיה: %s' % e)
                ok_all = False
                new_tracks.append(t)
                continue
            say('   ירד %.1f מגה' % (len(data) / 1048576))
            mp3 = to_mp3(data, os.path.splitext(rel)[1] or '.m4a')
            if not mp3:
                ok_all = False
                new_tracks.append(t)
                continue
            out_rel = os.path.splitext(rel)[0] + '.mp3'
            local = os.path.join(ADDED, out_rel[len('added/'):].replace('/', os.sep))
            os.makedirs(os.path.dirname(local), exist_ok=True)
            with open(local, 'wb') as fh:
                fh.write(mp3)
            say('   הומר ל-%.1f מגה, נשלח לשרת המדיה' % (len(mp3) / 1048576))
            th = PUSH.push(out_rel, wait=True)
            if th is None:
                say('   ⚠ ההעלאה לשרת המדיה לא יצאה לדרך')
                ok_all = False
                new_tracks.append(t)
                continue
            new_tracks.append(dict(t, f=out_rel))
            done += 1
        r['tracks'] = new_tracks
        if ok_all:
            r.pop('needs_mp3', None)

    api('live_layer', token, {'additions': adds})
    say('\nהומרו %d קבצים. השכבה החיה עודכנה.' % done)
    return 0


if __name__ == '__main__':
    sys.exit(main())
