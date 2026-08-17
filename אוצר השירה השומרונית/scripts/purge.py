# -*- coding: utf-8 -*-
"""Permanent deletion of a trashed recording from the cloud media server.

This is the one irreversible operation in the unit, so it is deliberately
narrow:

* it deletes the audio **only from the media server** (`/srv/shira/archive`);
* it never touches the master archive on the drive — that is the irreplaceable
  copy of a heritage collection, and nothing in a web UI should be able to
  remove it;
* every deletion is appended to `data/purge_log.json`, with what was deleted,
  when, by whom, and whether the server confirmed it.

A recording must already be in the recycle bin before it can be purged.
"""
import io, json, os, subprocess, time

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT = os.path.normpath(os.path.join(HERE, '..'))
LOG  = os.path.join(UNIT, 'data', 'purge_log.json')

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


def log_read():
    if os.path.exists(LOG):
        try:
            with open(LOG, encoding='utf-8') as fh:
                return json.load(fh)
        except ValueError:
            return []
    return []


def log_append(entry):
    rows = log_read()
    rows.append(entry)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    tmp = LOG + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, LOG)
    return entry


def _delete_remote(rel_paths):
    """Ask the media server to drop these files. Returns (deleted, missing, err)."""
    if not rel_paths:
        return 0, 0, None
    deleted = missing = 0
    err = None
    for rel in rel_paths:
        if rel.startswith('added/'):        # uploads never reached the server
            missing += 1
            continue
        target = 'shira:' + REMOTE.rstrip('/') + '/' + rel
        r = subprocess.run(['rclone', 'deletefile', target, '--retries', '2'],
                           capture_output=True, text=True, encoding='utf-8',
                           errors='replace', env=_env(), timeout=120)
        if r.returncode == 0:
            deleted += 1
        elif 'not found' in (r.stderr or '').lower() or \
             "object not found" in (r.stderr or '').lower():
            missing += 1
        else:
            err = (r.stderr or r.stdout or '').strip()[-300:]
    return deleted, missing, err


def purge(key, row, by=''):
    """Delete one trashed recording's audio from the media server."""
    files = list(row.get('files') or [])
    deleted, missing, err = _delete_remote(files)
    entry = {
        'key': key,
        'title': row.get('title', ''),
        'files': len(files),
        'deleted_from_server': deleted,
        'not_on_server': missing,
        'when': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'by': by,
        'error': err,
        'masters_kept': True,           # the drive is never touched
    }
    log_append(entry)
    return entry
