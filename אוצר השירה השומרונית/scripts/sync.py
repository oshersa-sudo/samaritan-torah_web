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

# only these are published; runtime state stays on this machine
PUBLISH = ['index.html', 'unit.css', 'unit.js', 'serve.py',
           'data/catalog.json', 'scripts', 'sounds', 'img', 'fonts', 'README.md']


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


def run(branch='main', message=None):
    """Rebuild, compare, commit and push. Returns a result dict."""
    build = subprocess.run([sys.executable, os.path.join(HERE, 'build_catalog.py')],
                           cwd=UNIT, capture_output=True, text=True,
                           encoding='utf-8', errors='replace')
    if build.returncode:
        return {'ok': False, 'stage': 'build',
                'error': (build.stderr or build.stdout or '')[-600:]}

    with open(CATALOG, encoding='utf-8') as fh:
        new = json.load(fh)
    diff = _summarise(_live_catalog(branch), new)

    _git('fetch', 'private', branch)
    paths = [f'{REL}/{p}' for p in PUBLISH]
    add = _git('add', '--', *paths)
    if add.returncode:
        return {'ok': False, 'stage': 'add', 'error': add.stderr[-600:]}

    staged = _git('diff', '--cached', '--name-only', '--', f'{REL}/')
    changed = [l for l in staged.stdout.splitlines() if l.strip()]
    if not changed:
        return {'ok': True, 'nothing': True, 'diff': diff, 'files': 0}

    msg = message or ('אוצר השירה: סנכרון היחידה לאתר החי\n\n'
                      'נבנה מחדש מן הנתונים המקומיים ונדחף כפי שהוא.\n\n'
                      'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>')
    com = _git('commit', '-m', msg, '--', *paths)
    if com.returncode and 'nothing to commit' not in (com.stdout + com.stderr):
        return {'ok': False, 'stage': 'commit',
                'error': (com.stderr or com.stdout)[-600:]}

    push = _git('push', 'private', f'HEAD:{branch}')
    if push.returncode:
        return {'ok': False, 'stage': 'push', 'error': (push.stderr or push.stdout)[-600:],
                'hint': 'ייתכן שהענף מאחור — משכו ונסו שוב'}

    head = _git('rev-parse', '--short', 'HEAD').stdout.strip()
    return {'ok': True, 'diff': diff, 'files': len(changed),
            'commit': head, 'branch': branch}
