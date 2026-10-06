# -*- coding: utf-8 -*-
"""Several tracks of one recording, joined into a single file.

Some tapes were digitised a side at a time, or in whatever lengths the machine
that read them happened to produce, so one continuous piece of singing arrives
as four files with silence between them. Joining them is an editorial act, not
a repair of the archive: the originals are never touched, the joined file is
written beside the uploads, and this index says which recording is now to be
played from it.

Keyed on the recording's ORIGINAL first-track path — the same key an override
uses — and for that reason applied AFTER the overrides. Joining first would
replace the track list and move the key out from under every edit ever made to
that recording, and the title, the singer and the feast would all come loose at
once. Applied afterwards, the edits still find their recording and only the
track list changes.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
PATH = os.path.join(DATA, 'merges.json')


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
    os.replace(tmp, PATH)                   # never leave a half-written index


def key_of(rec):
    """The recording's identity: the path of its first track, as overrides use.

    Read from `orig` where a merge has already been applied, so that merging a
    second time — or undoing one — still names the same recording.
    """
    tr = rec.get('orig') or rec.get('tr') or [{}]
    return (tr[0] or {}).get('f', '') or rec.get('dir', '')


def apply(catalog, merges):
    """Fold the joinings into a catalog.

    Two kinds live here, and they differ only in where the tracks came from.

    A FILE joining replaces a recording's own tracks with the single file they
    were written into — one continuous piece of singing that had arrived as
    four files with a seam between each.

    A GROUP joining is the other direction: several separate recordings that
    are really one piece in parts. One of them leads, is given every member's
    tracks in the order the editor set, and the others are dropped from the
    index — not deleted, dropped. Their files are still played, as tracks of
    the one that leads, and clearing the entry brings them all back standing
    on their own.

    Both are written against the leading recording's first-track path.
    """
    if not merges:
        return catalog

    # every recording some group has absorbed, so it is no longer listed alone
    absorbed = set()
    for m in merges.values():
        absorbed.update(m.get('absorbed') or [])

    cat = dict(catalog)
    cat['recordings'] = []
    touched = False
    for rec in catalog['recordings']:
        k = key_of(rec)
        if k in absorbed:
            touched = True
            continue                        # it plays inside the one that leads
        m = merges.get(k)
        if not m or not m.get('tracks'):
            cat['recordings'].append(rec)
            continue
        touched = True
        r = dict(rec)
        r['orig'] = rec.get('orig') or rec['tr']    # what it was, to go back to
        r['tr'] = [{'f': t['f'], 's': t.get('s') or 0, 'n': t.get('n') or ''}
                   for t in m['tracks']]
        r['n'] = len(r['tr'])
        # A group holds more singing than the recording that leads it did, so
        # its length is the sum of what it now carries. Left alone, a piece in
        # twelve parts went on announcing the length of its first part.
        if m.get('kind') == 'group':
            r['s'] = sum(t.get('s') or 0 for t in r['tr'])
            if m.get('title'):
                r['ttl'] = m['title']
            r['grouped'] = len(r['tr'])
        r['merged'] = 1
        cat['recordings'].append(r)

    if not touched:
        return catalog

    # Every count rolled up over the recordings is now wrong — how many
    # recordings there are, how many tracks, how many minutes — because a
    # group turned several rows into one. They are read off the index cards,
    # so they are derived again from the recordings rather than adjusted by a
    # difference nobody can check.
    cat['performers'] = [dict(p) for p in catalog['performers']]
    cat['events']     = [dict(e) for e in catalog['events']]
    cat['piyyutim']   = [dict(p) for p in catalog['piyyutim']]
    for seq, fld in ((cat['performers'], 'p'), (cat['events'], 'e'),
                     (cat['piyyutim'], 'y')):
        by = {row['id']: row for row in seq}
        for row in seq:
            row['n_rec'] = row['n_tracks'] = row['seconds'] = 0
        for r in cat['recordings']:
            row = by.get(r[fld])
            if row:
                row['n_rec']    += 1
                row['n_tracks'] += r['n']
                row['seconds']  += r.get('s') or 0
    # a row left holding nothing is no longer an index entry
    cat['performers'] = [p for p in cat['performers'] if p['n_rec']]
    cat['events']     = [e for e in cat['events'] if e['n_rec']]
    cat['piyyutim']   = [y for y in cat['piyyutim'] if y['n_rec']]

    m = cat['meta'] = dict(catalog['meta'])
    m['n_rec']    = len(cat['recordings'])
    m['n_tracks'] = sum(r['n'] for r in cat['recordings'])
    m['seconds']  = sum(r.get('s') or 0 for r in cat['recordings'])
    m['n_perf']   = len(cat['performers'])
    m['n_event']  = len(cat['events'])
    m['n_piyyut'] = len(cat['piyyutim'])
    return cat
