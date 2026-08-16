# -*- coding: utf-8 -*-
"""Recordings the admin has deleted.

Two different things can be deleted, and they are not treated alike:

* an **upload** (its audio lives under `added/`) — the files are the only copy
  the project owns, so they are moved into `deleted/`, not unlinked. The folder
  is the trash can; emptying it is a deliberate act outside the app.

* an **archive recording** (its audio lives on the master drive) — the master is
  the irreplaceable copy of a heritage collection, so it is never touched. The
  recording is struck from the catalog and from anything served or uploaded
  onward, which is what "remove it from the server" can safely mean.

Either way the entry is recorded here, so a deletion survives a rebuild and can
be undone by editing one JSON file.
"""
import os, json, shutil, time

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
PATH = os.path.join(DATA, 'removed.json')
TRASH = os.path.join(HERE, '..', 'deleted')


def load():
    if os.path.exists(PATH):
        with open(PATH, encoding='utf-8') as fh:
            return json.load(fh)
    return {}


def save(d):
    os.makedirs(DATA, exist_ok=True)
    tmp = PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, PATH)


def keys():
    return set(load().keys())


def trash_uploads(files, added_root):
    """Move uploaded audio into `deleted/`. Returns (moved, kept_on_master)."""
    moved, master = [], []
    for rel in files:
        if not rel.startswith('added/'):
            master.append(rel)           # a master file — left exactly where it is
            continue
        src = os.path.join(added_root, rel[len('added/'):].replace('/', os.sep))
        if not os.path.isfile(src):
            continue
        dst = os.path.join(TRASH, rel[len('added/'):].replace('/', os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        base, ext = os.path.splitext(dst)
        i = 2
        while os.path.exists(dst):
            dst = '%s (%d)%s' % (base, i, ext)
            i += 1
        shutil.move(src, dst)
        moved.append(rel)
    return moved, master


def record(key, title, files, moved, by=''):
    d = load()
    d[key] = {
        'title': title,
        'files': files,
        'trashed': moved,
        'when': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'by': by,
    }
    save(d)
    return d[key]


def restore(key, added_root):
    """Put a deleted recording back, carrying its trashed audio home again."""
    d = load()
    row = d.pop(key, None)
    if not row:
        return None
    back = []
    for rel in row.get('trashed', []):
        src = os.path.join(TRASH, rel[len('added/'):].replace('/', os.sep))
        if not os.path.isfile(src):
            continue
        dst = os.path.join(added_root, rel[len('added/'):].replace('/', os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst):
            shutil.move(src, dst)
            back.append(rel)
    row['restored_files'] = back
    save(d)
    return row


def listing():
    """Newest first, for the admin's recycle bin."""
    rows = [dict(v, key=k) for k, v in load().items()]
    rows.sort(key=lambda r: r.get('when', ''), reverse=True)
    return rows


def apply(catalog, gone):
    """Drop deleted recordings from a catalog and re-derive the index counts."""
    if not gone:
        return catalog
    keep = [r for r in catalog['recordings']
            if ((r.get('tr') or [{}])[0].get('f', '') or r.get('dir', '')) not in gone]
    if len(keep) == len(catalog['recordings']):
        return catalog
    cat = dict(catalog)
    cat['recordings'] = keep
    live_p = {r['p'] for r in keep}
    live_e = {r['e'] for r in keep}
    live_y = {r['y'] for r in keep}
    cat['performers'] = [p for p in catalog['performers'] if p['id'] in live_p]
    cat['events']     = [e for e in catalog['events'] if e['id'] in live_e]
    cat['piyyutim']   = [y for y in catalog['piyyutim'] if y['id'] in live_y]
    m = dict(catalog['meta'])
    m['n_rec']    = len(keep)
    m['n_tracks'] = sum(r['n'] for r in keep)
    m['seconds']  = sum(r['s'] for r in keep)
    m['n_perf']   = len(cat['performers'])
    m['n_event']  = len(cat['events'])
    m['n_piyyut'] = len(cat['piyyutim'])
    m['n_removed'] = len(gone)
    cat['meta'] = m
    return cat
