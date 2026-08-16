# -*- coding: utf-8 -*-
"""Per-performer detail the archive itself does not carry: photo, years, note.

The performers here are named, mostly private members of a small community, so
a photo is only ever attached deliberately by the admin — never guessed from a
web search. Each photo records where it came from, so a picture can always be
traced back and removed.
"""
import os, json

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
PATH = os.path.join(DATA, 'performers.json')

FIELDS = {'photo', 'credit', 'bio', 'years'}


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


def apply(catalog, meta):
    """Attach photo / bio / years onto the performer rows of a catalog, and
    carry in performers that were added by hand but hold no recording yet —
    they have to be listed before anything can be assigned to them."""
    if not meta:
        return catalog
    known = {p['name'] for p in catalog.get('performers', [])}
    for p in catalog.get('performers', []):
        m = meta.get(p['name'])
        if not m:
            continue
        for f in FIELDS:
            if m.get(f):
                p[f] = m[f]
    nxt = max([p['id'] for p in catalog.get('performers', [])], default=0)
    for name, m in meta.items():
        if name in known:
            continue
        nxt += 1
        row = {'id': nxt, 'name': name, 'n_rec': 0, 'n_tracks': 0, 'seconds': 0,
               'events': [], 'n_piyyut': 0, 'empty': 1}
        for f in FIELDS:
            if m.get(f):
                row[f] = m[f]
        catalog['performers'].append(row)
    return catalog
