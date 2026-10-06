# -*- coding: utf-8 -*-
"""Collect the recordings made on the site, here where the archive drive is.

    py -3 scripts/live_mp3.py --user U --password P         # what is waiting
    py -3 scripts/live_mp3.py --user U --password P --go    # collect it

A recording made in the app is already an MP3 when it arrives: the phone
encodes it before sending, because no browser will record MP3 and the site's
own server has no ffmpeg to make one. What the site cannot do is keep it. Its
disk is small, shared with the edits, and not where any of the other 25 GB
lives — so the recording sits there, served by the site, until this runs.

This fetches it, files it under `added/` exactly as any other addition is
filed, copies it to the media server, points the catalogue entry at it, and
only then tells the site to let go of its copy. Nothing is deleted before the
entry has been rewritten, and the entry is not rewritten before the media
server has answered for the file.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import additions as ADD                          # noqa: E402
import media_push as PUSH                         # noqa: E402

SITE = os.environ.get('SHIRA_SITE', 'https://samaritan-torah.onrender.com')
MEDIA = os.environ.get('SHIRA_MEDIA', 'https://shira.onyx-study.com/archive/')
ADDED = os.environ.get('SHIRA_ADDED', os.path.join(UNIT, 'added'))
INBOX = os.path.join(UNIT, 'inbox')


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
    with urllib.request.urlopen(req, timeout=180) as fh:
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


def fetch_rec(name):
    """One waiting recording, off the site's own disk."""
    url = (SITE.rstrip('/') + '/shira/api/rec/'
           + urllib.parse.quote(name.replace('\\', '/')))
    with urllib.request.urlopen(url, timeout=900) as fh:
        return fh.read()


def on_media(rel):
    """Has the media server got it? Asked, not assumed."""
    url = MEDIA.rstrip('/') + '/' + urllib.parse.quote(rel)
    req = urllib.request.Request(url, method='HEAD',
                                 headers={'Referer': SITE})
    try:
        with urllib.request.urlopen(req, timeout=120) as fh:
            return int(fh.headers.get('Content-Length') or 0)
    except Exception:                           # noqa: BLE001
        return 0


def to_mp3(data, suffix):
    """Re-encode to MP3. Only for the odd file that is not one already."""
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


def safe(name, fallback):
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', ' ', (name or '')).strip()
    name = re.sub(r'\s+', ' ', name)
    return name[:110] or fallback


def file_it(data, row, name):
    """Write it under `added/`, the way every other addition is written."""
    perf = safe(row.get('performer'), 'לא ידוע')
    piyyut = safe(row.get('piyyut'), 'הקלטה')
    base = safe(os.path.splitext(os.path.basename(name))[0], 'clip')
    folder = os.path.join(ADDED, perf, piyyut)
    os.makedirs(folder, exist_ok=True)
    dest = os.path.join(folder, base + '.mp3')
    n = 2
    while os.path.exists(dest):                 # never overwrite
        dest = os.path.join(folder, '%s (%d).mp3' % (base, n))
        n += 1
    with open(dest, 'wb') as fh:
        fh.write(data)
    return 'added/' + os.path.relpath(dest, ADDED).replace(os.sep, '/')


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
    waiting = layer.get('rec_files') or []
    # which waiting file belongs to which catalogue entry
    owner = {}
    for r in adds:
        for t in r.get('tracks') or []:
            f = (t.get('f') or '')
            if f.startswith('rec/'):
                owner[f[4:]] = (r, t)

    say('הקלטות על הדיסק של האתר : %d' % len(waiting))
    for w in waiting:
        r = owner.get(w['name'], (None, None))[0]
        say('   %-52s %6.1f MB  %s'
            % (w['name'][:52], w['bytes'] / 1048576,
               'משויכת: ' + (r.get('title') or r.get('piyyut') or '')
               if r else 'ממתינה למיון'))
    if not waiting:
        return 0
    if not a.go:
        say('\n(הצגה בלבד. הוסף --go כדי לאסוף באמת)')
        return 0

    local = ADD.load()
    taken = {r.get('id') for r in local}
    drop, done = [], 0
    for w in waiting:
        name = w['name']
        row, track = owner.get(name, (None, None))
        say('\n— %s' % name[:60])
        try:
            data = fetch_rec(name)
        except Exception as e:                  # noqa: BLE001
            say('   לא ירד מן האתר: %s' % e)
            continue
        say('   ירד %.1f מגה' % (len(data) / 1048576))
        if not name.lower().endswith('.mp3'):
            data = to_mp3(data, os.path.splitext(name)[1] or '.m4a')
            if not data:
                continue
            say('   הומר ל-%.1f מגה' % (len(data) / 1048576))

        if not row:
            # nobody has said what this is yet: it goes to the sorting pile,
            # and stays on the site's disk until somebody does
            os.makedirs(INBOX, exist_ok=True)
            dest = os.path.join(INBOX, os.path.basename(name))
            with open(dest, 'wb') as fh:
                fh.write(data)
            say('   נשמר ל-inbox למיון (נשאר גם באתר)')
            continue

        rel = file_it(data, row, name)
        say('   תויק: %s' % rel)
        th = PUSH.push(rel, wait=True)
        if th is None:
            say('   ⚠ ההעלאה לשרת המדיה לא יצאה לדרך — הרשומה לא שונתה')
            continue
        size = on_media(rel)
        if not size:
            time.sleep(3)
            size = on_media(rel)
        if not size:
            say('   ⚠ שרת המדיה אינו עונה על הקובץ — הרשומה לא שונתה')
            continue
        say('   שרת המדיה עונה: %.1f מגה' % (size / 1048576))

        # the entry first, the site's copy only afterwards
        track['f'] = rel
        row.pop('on_disk', None)
        if row.get('id') in taken:              # an id the drive gave away
            row['id'] = ADD.next_id(local + adds)
        taken.add(row['id'])
        local.append(json.loads(json.dumps(row)))   # a copy, not the same dict
        drop.append(name)
        done += 1

    if done:
        ADD.save(local)
        say('\nנכתב ל-data/additions.json: %d רשומות חדשות' % done)
    r = api('live_layer', token, {'additions': adds, 'drop': drop})
    say('האתר עודכן. שוחררו מן הדיסק: %d' % len(r.get('dropped') or []))
    if done:
        say('הרץ "סנכרון" כדי לפרסם את הרשומות שנוספו למאגר המקומי.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
