# -*- coding: utf-8 -*-
"""Say what the live site is missing, before claiming it is missing nothing.

The web edition assembles its catalogue out of five files: catalog.json and
the four the editor's own work lives in. Four of those were once gitignored,
which meant they never appeared in `git status`, never appeared in any
"what is left to push" list, and could sit for weeks with the corrections in
them applying only on the machine they were typed on.

    py -3 scripts/publish_check.py              # local vs the published branch
    py -3 scripts/publish_check.py --live       # …and vs what the site serves

Exit status is 1 when something differs, so it can gate a deploy.
"""
import io
import json
import os
import ssl
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT = os.path.dirname(HERE)
REPO = os.path.dirname(UNIT)
REL  = os.path.basename(UNIT)

BRANCH = os.environ.get('SHIRA_BRANCH', 'private/main')
LIVE   = 'https://samaritan-torah.onrender.com/shira/api/catalog'

# everything web/shira.py reads to build what the world sees
FEEDS = [
    ('data/catalog.json',    'the archive itself'),
    ('data/overrides.json',  'corrected titles, descriptions, singers, feasts'),
    ('data/additions.json',  'recordings added through the panel'),
    ('data/performers.json', 'singers added by hand'),
    ('data/removed.json',    'recordings taken down'),
    ('data/pix_sources.json','photographs from the community site'),
    ('data/local_media.json','the archive drive\'s own pictures and films'),
]


def _git(*args):
    return subprocess.run(['git'] + list(args), cwd=REPO,
                          capture_output=True).stdout


def published(rel):
    """The file as it stands on the branch the site is built from."""
    out = subprocess.run(['git', 'show', '%s:%s/%s' % (BRANCH, REL, rel)],
                         cwd=REPO, capture_output=True)
    return out.stdout if out.returncode == 0 else None


def main():
    _git('fetch', BRANCH.split('/')[0], BRANCH.split('/')[-1], '-q')
    bad = []
    print('%-24s %10s %10s   %s' % ('file', 'here', 'published', ''))
    print('-' * 68)
    for rel, what in FEEDS:
        path = os.path.join(UNIT, rel.replace('/', os.sep))
        mine = open(path, 'rb').read() if os.path.exists(path) else None
        theirs = published(rel)
        a = len(mine) if mine is not None else -1
        b = len(theirs) if theirs is not None else -1
        # git normalises line endings on commit, so compare without them
        same = (mine is not None and theirs is not None
                and mine.replace(b'\r\n', b'\n') == theirs.replace(b'\r\n', b'\n'))
        mark = 'ok' if same else 'DIFFERS'
        if not same:
            bad.append((rel, what, a, b))
        print('%-24s %10s %10s   %s'
              % (os.path.basename(rel),
                 a if a >= 0 else 'missing', b if b >= 0 else 'missing', mark))

    if '--live' in sys.argv:
        print('\nand what the site is actually serving:')
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(LIVE, headers={'User-Agent': 'Mozilla/5.0'})
            cat = json.loads(urllib.request.urlopen(req, timeout=90,
                                                    context=ctx).read().decode('utf-8'))
            here = json.load(io.open(os.path.join(UNIT, 'data', 'catalog.json'),
                                     encoding='utf-8'))
            print('   recordings  live %-6d  catalog.json %d'
                  % (len(cat['recordings']), len(here['recordings'])))
            print('   performers  live %-6d  catalog.json %d'
                  % (len(cat['performers']), len(here['performers'])))
            # the singers only an override or a hand-addition can produce
            raw = {p['name'] for p in here['performers']}
            live = {p['name'] for p in cat['performers']}
            only_here = sorted(_edited_names(UNIT) - live)
            if only_here:
                print('   singers named in your editing but NOT on the live site:')
                for n in only_here:
                    print('      %s' % n)
                bad.append(('live', 'singers missing online', len(only_here), 0))
            else:
                print('   every singer you named is on the live site')
        except Exception as e:                       # noqa: BLE001
            print('   could not reach the site: %s' % str(e)[:90])

    if bad:
        print('\n%d of the catalogue\'s feeds are not published:' % len(bad))
        for rel, what, a, b in bad:
            print('   %-22s %s' % (os.path.basename(rel), what))
        print('\nUntil they are, the site serves the archive without them.')
        return 1
    print('\nEverything the site reads is published.')
    return 0


def _edited_names(unit):
    """Singers introduced by the editor rather than by the scan."""
    names = set()
    for rel, key in (('data/overrides.json', 'performer'),):
        p = os.path.join(unit, rel.replace('/', os.sep))
        if not os.path.exists(p):
            continue
        try:
            d = json.load(io.open(p, encoding='utf-8'))
        except Exception:
            continue
        for v in (d.values() if isinstance(d, dict) else []):
            if isinstance(v, dict) and v.get(key):
                names.add(v[key])
    p = os.path.join(unit, 'data', 'performers.json')
    if os.path.exists(p):
        try:
            names |= set(json.load(io.open(p, encoding='utf-8')).keys())
        except Exception:
            pass
    return names


if __name__ == '__main__':
    sys.exit(main())
