# -*- coding: utf-8 -*-
"""Mirror the archive's pictures and films up to the media server.

Only what scan_media.py kept is sent — the manifest is the list, so what was
left out of it (the owner's private photographs, the thumbnails) is left out
of the upload too rather than being weeded again at the far end.

    py -3 scripts/upload_pix.py            # send what is missing
    py -3 scripts/upload_pix.py --check    # say what would be sent, send nothing

It is a mirror, not a push: run it again after adding to the folder and only
the new files go. Nothing on the server is ever deleted by this.
"""
import io
import json
import os
import subprocess
import sys

HERE  = os.path.dirname(os.path.abspath(__file__))
UNIT  = os.path.dirname(HERE)
SRC   = os.environ.get(
    'SHIRA_PIX', r'G:\שומרונים ומסורת- תיקייה חשובה מאד\תמונות שונות')
MAN   = os.path.join(UNIT, 'data', 'local_media.json')

HOST   = os.environ.get('SHIRA_MEDIA_HOST', '194.163.130.39')
USER   = os.environ.get('SHIRA_MEDIA_USER', 'root')
KEY    = os.environ.get('SHIRA_MEDIA_KEY', os.path.expanduser(r'~\.ssh\onyx_hetzner'))
REMOTE = os.environ.get('SHIRA_PIX_ROOT', '/srv/shira/pix')
BASE   = os.environ.get('SHIRA_PIX_URL', 'https://shira.onyx-study.com/pix/')

RCLONE = os.environ.get('RCLONE', 'rclone')


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


def main():
    check = '--check' in sys.argv
    with io.open(MAN, encoding='utf-8') as fh:
        man = json.load(fh)
    items = man.get('items') or []
    if not items:
        print('the manifest is empty — run scripts/scan_media.py first')
        return 1

    # the list of files to send, written where rclone can read it
    listing = os.path.join(UNIT, 'data', '_pix_upload.txt')
    with io.open(listing, 'w', encoding='utf-8') as fh:
        for x in items:
            fh.write(x['f'] + '\n')
    total = sum(x.get('bytes', 0) for x in items)
    print('%d files, %.2f GB' % (len(items), total / 1e9))
    print('  from %s' % SRC)
    print('  to   shira:%s   (%s)' % (REMOTE, BASE))

    cmd = [RCLONE, 'copy', SRC, 'shira:' + REMOTE,
           '--files-from', listing,
           '--transfers', '4', '--checkers', '8',
           '--sftp-set-modtime=false',
           '--stats', '20s', '--stats-one-line', '--progress',
           '--ignore-existing']
    if check:
        cmd += ['--dry-run']
    print('\n' + ' '.join(cmd[:6]) + ' …\n')
    r = subprocess.run(cmd, env=_env())
    if r.returncode:
        print('\nrclone exited %d' % r.returncode)
        return r.returncode

    if not check:
        # the manifest now knows where they are being served from
        man['base'] = BASE
        with io.open(MAN, 'w', encoding='utf-8') as fh:
            json.dump(man, fh, ensure_ascii=False, indent=1)
        print('\nwrote base=%s into %s' % (BASE, os.path.basename(MAN)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
