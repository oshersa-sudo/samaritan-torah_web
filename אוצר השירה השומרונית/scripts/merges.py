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
    """Fold the joined files into a catalog, in place of the tracks they replace."""
    if not merges:
        return catalog

    cat = dict(catalog)
    cat['recordings'] = []
    touched = False
    for rec in catalog['recordings']:
        m = merges.get(key_of(rec))
        if not m or not m.get('tracks'):
            cat['recordings'].append(rec)
            continue
        touched = True
        r = dict(rec)
        r['orig'] = rec.get('orig') or rec['tr']    # what it was, to go back to
        r['tr'] = [{'f': t['f'], 's': t.get('s') or 0, 'n': t.get('n') or ''}
                   for t in m['tracks']]
        r['n'] = len(r['tr'])
        r['merged'] = 1
        cat['recordings'].append(r)

    if not touched:
        return catalog

    # The count of tracks is now wrong wherever it was rolled up, and it is
    # read on the index cards. It is cheaper and safer to derive it again from
    # the recordings than to try to adjust each row by the difference.
    cat['performers'] = [dict(p) for p in catalog['performers']]
    cat['events']     = [dict(e) for e in catalog['events']]
    cat['piyyutim']   = [dict(p) for p in catalog['piyyutim']]
    for seq, fld in ((cat['performers'], 'p'), (cat['events'], 'e'),
                     (cat['piyyutim'], 'y')):
        by = {row['id']: row for row in seq}
        for row in seq:
            row['n_tracks'] = 0
        for r in cat['recordings']:
            row = by.get(r[fld])
            if row:
                row['n_tracks'] += r['n']
    cat['meta'] = dict(catalog['meta'])
    cat['meta']['n_tracks'] = sum(r['n'] for r in cat['recordings'])
    return cat
