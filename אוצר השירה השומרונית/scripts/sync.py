# -*- coding: utf-8 -*-
"""Take in what is new, and put the archive online — one action.

    py -3 scripts/sync.py                 # the whole round
    py -3 scripts/sync.py --check         # say what would happen, do nothing
    py -3 scripts/sync.py --no-inbox      # only publish what is already here

Four steps, in the order that keeps everything safe if one of them fails:

  1  read the watched folder, and file whatever is in it
  2  send the audio up to the media server
  3  commit the editor's own files to the branch the site is built from
  4  say what the site is still missing, if anything

Nothing is deleted anywhere, and step 3 writes only the files the site reads —
it does not touch the working branch, so an unfinished edit in the checkout is
never published by accident.
"""
import io
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT = os.path.dirname(HERE)
REPO = os.path.dirname(UNIT)
REL  = os.path.basename(UNIT)
sys.path.insert(0, HERE)

REMOTE = os.environ.get('SHIRA_REMOTE', 'private')
BRANCH = os.environ.get('SHIRA_BRANCH_NAME', 'main')

# what the web edition reads to build the catalogue the world sees
FEEDS = ['data/catalog.json', 'data/overrides.json', 'data/additions.json',
         'data/performers.json', 'data/removed.json',
         'data/pix_sources.json', 'data/local_media.json']


def _git(*args, **kw):
    r = subprocess.run(['git'] + list(args), cwd=REPO,
                       capture_output=True, **kw)
    return r.returncode, r.stdout, r.stderr


def publish(message, check=False):
    """Commit the feeds straight onto the published branch.

    Written with git's plumbing rather than with add/commit so that the
    checkout's own branch, and whatever is half-done in it, is left alone.
    """
    _git('fetch', REMOTE, BRANCH, '-q')
    base = '%s/%s' % (REMOTE, BRANCH)
    changed = []
    for rel in FEEDS:
        path = os.path.join(UNIT, rel.replace('/', os.sep))
        if not os.path.exists(path):
            continue
        code, out, _ = _git('show', '%s:%s/%s' % (base, REL, rel))
        mine = open(path, 'rb').read()
        if code == 0 and out.replace(b'\r\n', b'\n') == mine.replace(b'\r\n', b'\n'):
            continue
        changed.append(rel)
    if not changed:
        print('   אין מה לפרסם — הכול כבר על %s' % base)
        return []
    print('   %d קבצים לפרסום: %s' % (len(changed), ', '.join(
        os.path.basename(c) for c in changed)))
    if check:
        return changed

    idx = os.path.join(os.environ.get('TEMP', '/tmp'), 'shira_publish_index')
    if os.path.exists(idx):
        os.remove(idx)
    env = dict(os.environ, GIT_INDEX_FILE=idx)
    subprocess.run(['git', 'read-tree', base], cwd=REPO, env=env, check=True)
    for rel in changed:
        path = os.path.join(UNIT, rel.replace('/', os.sep))
        blob = subprocess.run(['git', 'hash-object', '-w', path], cwd=REPO,
                              capture_output=True, text=True,
                              check=True).stdout.strip()
        subprocess.run(['git', 'update-index', '--add', '--cacheinfo',
                        '100644,%s,%s/%s' % (blob, REL, rel)],
                       cwd=REPO, env=env, check=True)
    tree = subprocess.run(['git', 'write-tree'], cwd=REPO, env=env,
                          capture_output=True, text=True,
                          check=True).stdout.strip()
    commit = subprocess.run(['git', 'commit-tree', tree, '-p', base],
                            cwd=REPO, env=env, input=message,
                            capture_output=True, text=True,
                            encoding='utf-8', check=True).stdout.strip()
    code, out, err = _git('push', REMOTE, '%s:refs/heads/%s' % (commit, BRANCH))
    if code:
        print('   הדחיפה נכשלה: %s' % err.decode('utf-8', 'replace')[:160])
        return []
    print('   נדחף %s' % commit[:9])
    return changed


def main():
    check = '--check' in sys.argv
    print('סנכרון אוצר השירה השומרונית')
    print('=' * 46)

    taken = []
    if '--no-inbox' not in sys.argv:
        print('\n1. תיקיית הקליטה')
        import inbox
        taken = inbox.run(check=check) or []

    print('\n2. שרת המדיה')
    if taken and not check:
        print('   %d קבצים נשלחו בעת הקליטה' % len(taken))
    else:
        print('   אין קבצי שמע חדשים לשלוח')

    print('\n3. פרסום אל האתר')
    n = len(taken)
    msg = ('אוצר השירה: סנכרון — %s\n\n%s\n\nCo-Authored-By: Claude Opus 5 '
           '<noreply@anthropic.com>\n'
           % (time.strftime('%Y-%m-%d %H:%M'),
              ('%d הקלטות חדשות מתיקיית הקליטה' % n) if n
              else 'עדכון קבצי העריכה'))
    published = publish(msg, check=check)

    print('\n4. בדיקה')
    r = subprocess.run([sys.executable, os.path.join(HERE, 'publish_check.py')],
                       capture_output=True, text=True, encoding='utf-8',
                       env=dict(os.environ, PYTHONIOENCODING='utf-8'))
    for line in (r.stdout or '').strip().splitlines()[-4:]:
        print('   ' + line)

    print('\n' + '=' * 46)
    if check:
        print('בדיקה בלבד — לא נקלט ולא נדחף דבר')
    else:
        print('נקלטו %d, פורסמו %d קבצים' % (len(taken), len(published)))
        if published:
            print('Render בונה מ-%s ויעלה את השינוי תוך כמה דקות' % BRANCH)
    return 0


if __name__ == '__main__':
    sys.exit(main())
