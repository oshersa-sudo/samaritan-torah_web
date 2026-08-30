# -*- coding: utf-8 -*-
"""Publish the local unit to the live site.

The cloud copy is read-only: it serves whatever `data/catalog.json` is committed
on `main`. So publishing means three things in order — rebuild the catalog so
the admin's deletions and edits are baked in, work out what actually changed
against what the site is serving now, and push.

Nothing here touches the audio archive or any file outside the unit.
"""
import io, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT = os.path.normpath(os.path.join(HERE, '..'))
REPO = os.path.normpath(os.path.join(UNIT, '..'))
REL  = os.path.basename(UNIT)                       # the unit's folder name
CATALOG = os.path.join(UNIT, 'data', 'catalog.json')

# Only these are published; runtime state stays on this machine.
#
# The four data files below are the editor's own work — corrected titles,
# descriptions, singers, recordings taken down — and they belong here beside
# catalog.json. Leaving them out is what once put a singer online as
# "לא ידוע" while his name sat in overrides.json on this machine.
PUBLISH = ['index.html', 'unit.css', 'unit.js', 'serve.py', 'app.py',
           'desktop.py', 'VERSION', 'CHANGELOG.md',
           'data/catalog.json',
           'data/overrides.json', 'data/additions.json',
           'data/performers.json', 'data/removed.json', 'data/merges.json',
           'data/pix_sources.json', 'data/local_media.json',
           'scripts', 'sounds', 'img', 'fonts', 'README.md']


def _git(*args, **kw):
    return subprocess.run(['git', '-c', 'core.quotepath=false', *args],
                          cwd=REPO, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', **kw)


def _live_catalog(branch='main'):
    """The catalog the site is serving right now, or None if unreachable."""
    r = _git('show', f'{branch}:{REL}/data/catalog.json')
    if r.returncode:
        r = _git('show', f'private/{branch}:{REL}/data/catalog.json')
    if r.returncode:
        return None
    try:
        return json.loads(r.stdout)
    except ValueError:
        return None


def _summarise(old, new):
    """What changed, in terms a person would report."""
    if not old:
        return {'first': True, 'recordings': len(new['recordings'])}
    def by_key(cat):
        out = {}
        for r in cat['recordings']:
            out[(r.get('tr') or [{}])[0].get('f', '') or r.get('dir', '')] = r
        return out
    a, b = by_key(old), by_key(new)
    removed = [k for k in a if k not in b]
    added   = [k for k in b if k not in a]
    pn_old = {p['id']: p['name'] for p in old['performers']}
    pn_new = {p['id']: p['name'] for p in new['performers']}
    ev_old = {e['id']: e['name'] for e in old['events']}
    ev_new = {e['id']: e['name'] for e in new['events']}
    edited = 0
    for k, r in b.items():
        o = a.get(k)
        if not o:
            continue
        if (o['ttl'] != r['ttl'] or pn_old.get(o['p']) != pn_new.get(r['p'])
                or ev_old.get(o['e']) != ev_new.get(r['e'])
                or o.get('year') != r.get('year') or o.get('note') != r.get('note')
                or o.get('desc') != r.get('desc')):
            edited += 1
    return {
        'first': False,
        'removed': len(removed), 'added': len(added), 'edited': edited,
        'performers_before': len(old['performers']),
        'performers_after':  len(new['performers']),
        'recordings_before': len(old['recordings']),
        'recordings_after':  len(new['recordings']),
    }


def build_catalog():
    """Rebuild the catalogue, in the way that suits how we are running.

    As a script there is a Python to hand and the build is given its own
    process, which keeps its imports and its globals out of the server's.

    Packaged, there is no Python to hand: sys.executable is the application
    itself. Spawning it would start a second copy of the whole program — a
    second window, a second browser session, a second server — which is
    exactly what pressing sync used to do. So packaged, the build is run
    inside this process instead.
    """
    script = os.path.join(HERE, 'build_catalog.py')
    if not getattr(sys, 'frozen', False):
        r = subprocess.run([sys.executable, script], cwd=UNIT,
                           capture_output=True, text=True,
                           encoding='utf-8', errors='replace')
        return (r.returncode == 0), (r.stderr or r.stdout or '')

    import contextlib
    import runpy
    buf = io.StringIO()
    argv, cwd = sys.argv, os.getcwd()
    try:
        sys.argv = [script]
        os.chdir(UNIT)
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            runpy.run_path(script, run_name='__main__')
        return True, buf.getvalue()
    except SystemExit as e:                             # a clean early finish
        return (not e.code), buf.getvalue()
    except Exception:                                   # noqa: BLE001
        import traceback
        return False, buf.getvalue() + traceback.format_exc()
    finally:
        sys.argv = argv
        os.chdir(cwd)


def run(branch='main', message=None):
    """Rebuild, compare, and publish onto `branch`.

    The commit is assembled with plumbing against a scratch index rather than
    by committing the checked-out branch: the working tree is usually on some
    other branch, mid-edit, and may hold unrelated changes. This way publishing
    never moves the current branch, never touches an unrelated file, and works
    no matter what state the checkout is in.
    """
    ok, err = build_catalog()
    if not ok:
        return {'ok': False, 'stage': 'build', 'error': err[-600:]}

    with open(CATALOG, encoding='utf-8') as fh:
        new = json.load(fh)

    fetch = _git('fetch', 'private', branch)
    if fetch.returncode:
        return {'ok': False, 'stage': 'push', 'error': fetch.stderr[-600:],
                'hint': 'אין חיבור לשרת הגיט'}
    base = _git('rev-parse', 'FETCH_HEAD').stdout.strip()
    diff = _summarise(_live_catalog(branch), new)

    idx = os.path.join(REPO, '.git', 'shira-sync-index')
    env = dict(os.environ, GIT_INDEX_FILE=idx)

    def g(*a):
        return subprocess.run(['git', '-c', 'core.quotepath=false', *a], cwd=REPO,
                              capture_output=True, text=True, encoding='utf-8',
                              errors='replace', env=env)
    try:
        if os.path.exists(idx):
            os.remove(idx)
        r = g('read-tree', base)                      # start from what is live
        if r.returncode:
            return {'ok': False, 'stage': 'add', 'error': r.stderr[-600:]}

        # stage the unit's published files from the working directory
        files = []
        for p in PUBLISH:
            full = os.path.join(UNIT, p.replace('/', os.sep))
            if os.path.isdir(full):
                for dp, dn, fn in os.walk(full):
                    dn[:] = [d for d in dn if d != '__pycache__']
                    files += [os.path.join(dp, f) for f in fn]
            elif os.path.isfile(full):
                files.append(full)
        rel = [os.path.relpath(f, REPO).replace(os.sep, '/') for f in files]
        r = g('update-index', '--add', '--', *rel)
        if r.returncode:
            return {'ok': False, 'stage': 'add', 'error': r.stderr[-600:]}

        tree = g('write-tree').stdout.strip()
        base_tree = _git('rev-parse', f'{base}^{{tree}}').stdout.strip()
        if tree == base_tree:
            return {'ok': True, 'nothing': True, 'diff': diff, 'files': 0}

        changed = g('diff-tree', '-r', '--name-only', base_tree, tree).stdout
        n_files = len([l for l in changed.splitlines() if l.strip()])

        msg = message or ('אוצר השירה: סנכרון היחידה לאתר החי\n\n'
                          'נבנה מחדש מן הנתונים המקומיים — מחיקות, עריכות\n'
                          'ושינויי שמות — ונדחף כפי שהוא.\n\n'
                          'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>')
        r = g('commit-tree', tree, '-p', base, '-m', msg)
        if r.returncode:
            return {'ok': False, 'stage': 'commit', 'error': r.stderr[-600:]}
        commit = r.stdout.strip()

        push = _git('push', 'private', f'{commit}:refs/heads/{branch}')
        if push.returncode:
            return {'ok': False, 'stage': 'push',
                    'error': (push.stderr or push.stdout)[-600:],
                    'hint': 'ייתכן שמישהו דחף בינתיים — נסו שוב'}
        return {'ok': True, 'diff': diff, 'files': n_files,
                'commit': commit[:7], 'branch': branch}
    finally:
        if os.path.exists(idx):
            os.remove(idx)


def take_inbox():
    """Read the watched folder before publishing, so that anything dropped in
    is part of this round rather than the next one."""
    try:
        import inbox
    except Exception:                                   # noqa: BLE001
        return []
    try:
        return inbox.run() or []
    except Exception:                                   # noqa: BLE001
        return []


def main(argv=None):
    """The whole round from a command line: take in, then publish."""
    argv = argv if argv is not None else sys.argv[1:]
    if '--no-inbox' not in argv:
        print('תיקיית הקליטה')
        take_inbox()
        print()
    print('פרסום אל האתר')
    out = run()
    if not out.get('ok'):
        print('  נכשל בשלב %s: %s' % (out.get('stage'), (out.get('error') or '')[:300]))
        if out.get('hint'):
            print('  %s' % out['hint'])
        return 1
    if out.get('nothing'):
        print('  אין מה לפרסם — הכול כבר באוויר')
        return 0
    d = out.get('diff') or {}
    print('  נדחף %s אל %s — %d קבצים' % (out.get('commit'), out.get('branch'),
                                          out.get('files', 0)))
    if not d.get('first'):
        print('  הקלטות: %s → %s   נוספו %s, הוסרו %s, נערכו %s'
              % (d.get('recordings_before'), d.get('recordings_after'),
                 d.get('added'), d.get('removed'), d.get('edited')))
    print('  Render בונה מ-main ויעלה את השינוי תוך כמה דקות')
    return 0


if __name__ == '__main__':
    sys.exit(main())
