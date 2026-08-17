# -*- coding: utf-8 -*-
"""Upload the archive's audio to the Contabo media server.

The app itself stays where it is (the Samaritan Torah server); only the audio
moves, so a browser anywhere can play what until now streamed off the G: drive.

    py -3 scripts/upload_media.py --list      # just write the file list
    py -3 scripts/upload_media.py             # upload (resumable, re-runnable)
    py -3 scripts/upload_media.py --verify    # compare server against catalog

Only files the catalog actually references are sent — 2,671 tracks, ~25 GB —
not the archive's de-duplicated leftovers. The upload is plain `rclone copy`
over SFTP: interrupted at any point, running it again picks up where it
stopped, and files already on the server (same size) are skipped.
"""
import argparse
import json
import os
import subprocess
import sys

HERE    = os.path.dirname(os.path.abspath(__file__))
UNIT    = os.path.dirname(HERE)
DATA    = os.path.join(UNIT, 'data')

ARCHIVE = os.environ.get('SHIRA_ARCHIVE',
                         r'G:\שומרונים ומסורת- תיקייה חשובה מאד\שיראן')
ADDED   = os.environ.get('SHIRA_ADDED', os.path.join(UNIT, 'added'))

HOST    = os.environ.get('SHIRA_MEDIA_HOST', '194.163.130.39')
USER    = os.environ.get('SHIRA_MEDIA_USER', 'root')
KEY     = os.environ.get('SHIRA_MEDIA_KEY',
                         os.path.expanduser(r'~\.ssh\onyx_hetzner'))
REMOTE  = os.environ.get('SHIRA_MEDIA_ROOT', '/srv/shira/archive')

LIST    = os.path.join(DATA, 'upload_list.txt')
LOG     = os.path.join(DATA, 'upload.log')


def wanted():
    """(rel path → size) for every file the catalog plays, archive files only."""
    tracks = json.load(open(os.path.join(DATA, 'tracks.json'), encoding='utf-8'))
    sizes  = {r['rel']: r['size'] for r in
              json.load(open(os.path.join(DATA, 'raw_inventory.json'), encoding='utf-8'))}
    out = {}
    for t in tracks:
        f = t['file']
        if f.startswith('added/'):       # uploaded clips live outside the archive
            continue
        out[f] = sizes.get(f, t.get('size', 0))
    return out


def write_list(files):
    with open(LIST, 'w', encoding='utf-8', newline='\n') as fh:
        for f in sorted(files):
            fh.write(f + '\n')
    return LIST


def rclone_env():
    """A named SFTP remote passed entirely through the environment.

    Keeps the Windows key path out of an rclone connection string, where its
    backslashes would need escaping.
    """
    env = dict(os.environ)
    env.update({
        'RCLONE_CONFIG_SHIRA_TYPE':       'sftp',
        'RCLONE_CONFIG_SHIRA_HOST':       HOST,
        'RCLONE_CONFIG_SHIRA_USER':       USER,
        'RCLONE_CONFIG_SHIRA_KEY_FILE':   KEY,
        'RCLONE_CONFIG_SHIRA_SHELL_TYPE': 'unix',
    })
    known = os.path.expanduser(r'~\.ssh\known_hosts')
    if os.path.exists(known):        # otherwise rclone skips host-key checking
        env['RCLONE_CONFIG_SHIRA_KNOWN_HOSTS_FILE'] = known
    return env


def upload(files, bwlimit=None, transfers=4, dry=False):
    write_list(files)
    total = sum(files.values())
    print('להעלאה: %d קבצים, %.2f GB' % (len(files), total / 2 ** 30))
    cmd = [
        'rclone', 'copy', ARCHIVE, 'shira:' + REMOTE,
        '--files-from-raw', LIST,
        '--size-only',                 # audio never changes in place
        '--transfers', str(transfers),
        '--checkers', '8',
        '--retries', '10',
        '--low-level-retries', '20',
        '--stats', '30s',
        '--stats-one-line',
        '--stats-log-level', 'NOTICE',
        '--log-file', LOG,
        '--log-level', 'INFO',
    ]
    if bwlimit:
        cmd += ['--bwlimit', bwlimit]
    if dry:
        cmd += ['--dry-run']
    print(' '.join(cmd[:6]) + ' …')
    print('יומן: %s' % LOG)
    return subprocess.call(cmd, env=rclone_env())


def verify(files):
    """List the server side once and report what is missing or truncated."""
    out = subprocess.run(
        ['ssh', '-i', KEY, '-o', 'BatchMode=yes', '%s@%s' % (USER, HOST),
         "find %s -type f -printf '%%s\\t%%P\\n'" % REMOTE],
        capture_output=True, env=os.environ)
    have = {}
    for line in out.stdout.decode('utf-8', 'replace').splitlines():
        size, _, rel = line.partition('\t')
        if rel:
            have[rel] = int(size)
    missing = [f for f in files if f not in have]
    partial = [f for f, s in files.items() if f in have and have[f] != s]
    done    = len(files) - len(missing) - len(partial)
    sent    = sum(min(have.get(f, 0), s) for f, s in files.items())
    total   = sum(files.values())
    print('בשרת : %d/%d קבצים  (%.2f / %.2f GB, %.1f%%)'
          % (done, len(files), sent / 2 ** 30, total / 2 ** 30, 100.0 * sent / total))
    if partial:
        print('חלקיים: %d' % len(partial))
        for f in partial[:10]:
            print('   ~ %s  (%d / %d)' % (f, have[f], files[f]))
    if missing:
        print('חסרים : %d' % len(missing))
        for f in missing[:10]:
            print('   - %s' % f)
    extra = [f for f in have if f not in files]
    if extra:
        print('בשרת ולא בקטלוג: %d' % len(extra))
    return 0 if not missing and not partial else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true', help='כתוב את רשימת הקבצים ועצור')
    ap.add_argument('--verify', action='store_true', help='השווה את השרת מול הקטלוג')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--bwlimit', help='למשל 5M — כדי לא לחנוק את הגלישה בבית')
    ap.add_argument('--transfers', type=int, default=4)
    a = ap.parse_args()

    files = wanted()
    if a.list:
        print('%s — %d קבצים, %.2f GB'
              % (write_list(files), len(files), sum(files.values()) / 2 ** 30))
        return 0
    if a.verify:
        return verify(files)
    if not os.path.isdir(ARCHIVE):
        print('הארכיון לא מחובר: %s' % ARCHIVE)
        return 2
    return upload(files, bwlimit=a.bwlimit, transfers=a.transfers, dry=a.dry_run)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
