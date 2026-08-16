# -*- coding: utf-8 -*-
"""Recordings added through the UI, merged onto the built catalog at serve time.

Uploads live in their own file (data/additions.json) and their audio in its own
directory, never inside the read-only archive. That keeps two things true:
rebuilding the catalog from the drive never loses an upload, and re-scanning the
archive never has to know uploads exist.
"""
import os, json, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from textutil import skeleton

HERE  = os.path.dirname(os.path.abspath(__file__))
DATA  = os.path.join(HERE, '..', 'data')
ADD_JSON = os.path.join(DATA, 'additions.json')

# ids for added rows start here so they can never collide with built ones
ID_BASE = 900000


def load():
    if os.path.exists(ADD_JSON):
        with open(ADD_JSON, encoding='utf-8') as fh:
            return json.load(fh)
    return []


def save(rows):
    os.makedirs(DATA, exist_ok=True)
    tmp = ADD_JSON + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, ADD_JSON)               # never leave a half-written index


def next_id(rows):
    return max([r['id'] for r in rows], default=ID_BASE) + 1


def merge(catalog, rows):
    """Return a copy of `catalog` with the uploaded recordings folded in."""
    if not rows:
        return catalog

    cat = {
        'meta':       dict(catalog['meta']),
        'performers': [dict(p) for p in catalog['performers']],
        'events':     [dict(e) for e in catalog['events']],
        'piyyutim':   [dict(p) for p in catalog['piyyutim']],
        'recordings': list(catalog['recordings']),
    }
    perf_by  = {p['name']: p for p in cat['performers']}
    event_by = {e['name']: e for e in cat['events']}
    piy_by   = {}
    for p in cat['piyyutim']:
        piy_by.setdefault(skeleton(p['name']) or p['name'], p)

    def new_id(seq):
        return max([x['id'] for x in seq], default=ID_BASE) + 1

    for r in rows:
        secs = round(sum(t.get('s') or 0 for t in r['tracks']))

        perf = perf_by.get(r['performer'])
        if not perf:
            perf = {'id': new_id(cat['performers']), 'name': r['performer'],
                    'n_rec': 0, 'n_tracks': 0, 'seconds': 0,
                    'events': [], 'n_piyyut': 0}
            cat['performers'].append(perf)
            perf_by[perf['name']] = perf

        ev = event_by.get(r['event'])
        if not ev:
            ev = {'id': new_id(cat['events']), 'name': r['event'], 'n_rec': 0,
                  'n_tracks': 0, 'seconds': 0, 'performers': [], 'n_piyyut': 0}
            cat['events'].append(ev)
            event_by[ev['name']] = ev

        key = skeleton(r['piyyut']) or r['piyyut']
        piy = piy_by.get(key)
        if not piy:
            piy = {'id': new_id(cat['piyyutim']), 'name': r['piyyut'],
                   'variants': [], 'n_rec': 0, 'n_tracks': 0, 'seconds': 0,
                   'events': [], 'performers': [], 'desc': '', 'note': None}
            cat['piyyutim'].append(piy)
            piy_by[key] = piy

        for holder, extra in ((perf, 'events'), (ev, 'performers')):
            val = r['event'] if extra == 'events' else r['performer']
            if val not in holder[extra]:
                holder[extra].append(val)
        for holder in (perf, ev, piy):
            holder['n_rec']    += 1
            holder['n_tracks'] += len(r['tracks'])
            holder['seconds']  += secs
        if r['event'] not in piy['events']:
            piy['events'].append(r['event'])
        if r['performer'] not in piy['performers']:
            piy['performers'].append(r['performer'])
        piy['desc'] = ('%d הקלטות באוסף; סך הכול %d דקות.'
                       % (piy['n_rec'], round(piy['seconds'] / 60)))
        if r.get('note'):
            piy['note'] = r['note']

        cat['recordings'].append({
            'id':   r['id'], 'p': perf['id'], 'e': ev['id'], 'y': piy['id'],
            'ttl':  r.get('title') or r['piyyut'],
            'dir':  r.get('dir', 'הוספות'),
            'n':    len(r['tracks']),
            's':    secs,
            'kind': 'audio',
            'added': r.get('added', ''),
            'tr':   [{'f': t['f'], 's': t.get('s') or 0, 'n': t['n']}
                     for t in r['tracks']],
        })

    m = cat['meta']
    m['n_rec']    = len(cat['recordings'])
    m['n_tracks'] = sum(len(x['tr']) for x in cat['recordings'])
    m['seconds']  = sum(x['s'] for x in cat['recordings'])
    m['n_perf']   = len(cat['performers'])
    m['n_event']  = len(cat['events'])
    m['n_piyyut'] = len(cat['piyyutim'])
    m['n_added']  = len(rows)
    return cat
