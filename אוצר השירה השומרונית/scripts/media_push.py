# -*- coding: utf-8 -*-
"""Send one freshly added file up to the Contabo media server.

`upload_media.py` is the bulk tool — it walks the whole catalog and mirrors
25 GB. This is its small sibling, for the single clip that has just arrived:
a recording made on the machine itself, or a file dropped into the admin
panel. It saves locally first and copies up afterwards, so nothing depends on
the network being there at the moment of recording.

The copy runs on a worker thread; the browser is not kept waiting for it, and
a failure is written to the log rather than thrown at the user — the audio is
already safe on disk either way.
"""
import os
import subprocess
import threading
import time

HERE   = os.path.dirname(os.path.abspath(__file__))
UNIT   = os.path.dirname(HERE)
ADDED  = os.environ.get('SHIRA_ADDED', os.path.join(UNIT, 'added'))
LOG    = os.path.join(UNIT, 'data', 'media_push.log')

HOST   = os.environ.get('SHIRA_MEDIA_HOST', '194.163.130.39')
USER   = os.environ.get('SHIRA_MEDIA_USER', 'root')
KEY    = os.environ.get('SHIRA_MEDIA_KEY',
                        os.path.expanduser(r'~\.ssh\onyx_hetzner'))
REMOTE = os.environ.get('SHIRA_MEDIA_ROOT', '/srv/shira/archive')


def _env():
    env = dict(os.environ)
    env.update({
        'RCLONE_CONFIG_SHIRA_TYPE':       'sftp',
        'RCLONE_CONFIG_SHIRA_HOST':       HOST,
        'RCLONE_CONFIG_SHIRA_USER':       USER,
        'RCLONE_CONFIG_SHIRA_KEY_FILE':   KEY,
        'RCLONE_CONFIG_SHIRA_SHELL_TYPE': 'unix',
    })
    known = os.path.expanduser(r'~\.ssh\known_hosts')
    if os.path.exists(known):
        env['RCLONE_CONFIG_SHIRA_KNOWN_HOSTS_FILE'] = known
    return env


def _log(line):
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, 'a', encoding='utf-8') as fh:
            fh.write('%s  %s\n' % (time.strftime('%Y-%m-%d %H:%M:%S'), line))
    except OSError:
        pass


def push(rel, wait=False):
    """Copy `added/<rel>` up to the media server, keeping the same path.

    `rel` is the catalog-relative path, e.g. 'added/הכהן/פיוט.webm'.
    Returns the thread, or the result when `wait` is set.
    """
    rel = rel.replace('\\', '/')
    if rel.startswith('added/'):
        local = os.path.join(ADDED, rel[len('added/'):].replace('/', os.sep))
    else:
        local = os.path.join(ADDED, rel.replace('/', os.sep))
    if not os.path.exists(local):
        _log('missing %s' % rel)
        return None

    dest = 'shira:' + REMOTE.rstrip('/') + '/' + rel.rsplit('/', 1)[0]

    def run():
        try:
            r = subprocess.run(['rclone', 'copy', local, dest, '--retries', '3'],
                               capture_output=True, text=True, encoding='utf-8',
                               errors='replace', env=_env(), timeout=900)
            if r.returncode:
                _log('FAILED %s :: %s' % (rel, (r.stderr or '').strip()[-200:]))
            else:
                _log('sent %s' % rel)
            return r.returncode == 0
        except Exception as e:                       # rclone missing, no network
            _log('ERROR %s :: %s' % (rel, e))
            return False

    if wait:
        return run()
    t = threading.Thread(target=run, daemon=True)
    t.start()
    return t
