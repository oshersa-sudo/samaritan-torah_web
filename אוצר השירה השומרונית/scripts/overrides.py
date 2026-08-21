# -*- coding: utf-8 -*-
"""Admin edits applied on top of the built catalog.

An edit is stored against the recording's *first track path*, not its numeric
id: ids are handed out in folder order when the catalog is built, so a rebuild
would silently move them onto the wrong recordings. A file path survives a
rebuild.

Editable per recording: title/description, performer, year, event, editor's
note, and whether it is published at all.
"""
import os, json

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
PATH = os.path.join(DATA, 'overrides.json')

FIELDS = {'title', 'desc', 'performer', 'event', 'year', 'note', 'hidden'}

# performer renames, applied to every recording of that performer at once:
# {old name: new name}. Kept beside the per-recording edits in the same file
# under a reserved key, so one file still holds all the admin's changes.
RENAME_KEY = '__performer_renames__'


def renames(ovr):
    return dict(ovr.get(RENAME_KEY) or {})


def set_rename(ovr, old, new):
    r = renames(ovr)
    # follow an existing chain so A→B→C collapses to A→C
    for k, v in list(r.items()):
        if v == old:
            r[k] = new
    if old != new:
        r[old] = new
    else:
        r.pop(old, None)
    ovr[RENAME_KEY] = r
    return ovr


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


def key_of(rec):
    """Stable identity for a recording: the path of its first track."""
    return (rec.get('tr') or [{}])[0].get('f', '') or rec.get('dir', '')


# what the build calls a tape it knows nothing about
UNIDENTIFIED = 'קלטות לא מזוהות'


def apply(catalog, ovr, include_hidden=False):
    """Fold admin edits into a catalog, re-deriving the affected indexes.

    Also enforces the `hidden` flag the build itself may set (a performer kept
    out of the public index), not just hiding chosen through the admin panel.
    """
    ren = renames(ovr)
    ovr = {k: v for k, v in ovr.items() if k != RENAME_KEY}
    baked_hidden = any(r.get('hidden') for r in catalog['recordings'])
    if not ovr and not ren and not (baked_hidden and not include_hidden):
        return catalog

    cat = {
        'meta':       dict(catalog['meta']),
        'performers': [dict(p) for p in catalog['performers']],
        'events':     [dict(e) for e in catalog['events']],
        'piyyutim':   [dict(p) for p in catalog['piyyutim']],
        'recordings': [],
    }
    # a rename merges into an existing performer when the new name is taken,
    # which is how duplicate entries get folded together
    if ren:
        seen = {}
        merged = []
        for p in cat['performers']:
            name = ren.get(p['name'], p['name'])
            if name in seen:
                seen[name]['n_rec']    += p['n_rec']
                seen[name]['n_tracks'] += p['n_tracks']
                seen[name]['seconds']  += p['seconds']
                p['merged_into'] = seen[name]['id']
                continue
            p['name'] = name
            seen[name] = p
            merged.append(p)
        moved = {p['id']: p['merged_into'] for p in cat['performers']
                 if p.get('merged_into')}
        cat['performers'] = merged
    else:
        moved = {}

    perf_by  = {p['name']: p for p in cat['performers']}
    event_by = {e['name']: e for e in cat['events']}
    piy_by   = {p['id']: p for p in cat['piyyutim']}
    piy_name = {p['name']: p for p in cat['piyyutim']}

    def ensure(seq, by_name, name, extra):
        if name in by_name:
            return by_name[name]
        row = {'id': max([x['id'] for x in seq], default=0) + 1, 'name': name,
               'n_rec': 0, 'n_tracks': 0, 'seconds': 0, 'n_piyyut': 0}
        row[extra] = []
        seq.append(row)
        by_name[name] = row
        return row

    hidden = 0
    for rec in catalog['recordings']:
        o = ovr.get(key_of(rec))
        # an override decides publication; otherwise the build's own flag does
        is_hidden = o.get('hidden') if (o and 'hidden' in o) else rec.get('hidden')
        if is_hidden and not include_hidden:
            hidden += 1
            continue                                  # not published — drop it
        if not o:
            # a merged-away performer id has to be redirected even when this
            # recording carries no edit of its own
            cat['recordings'].append(
                dict(rec, p=moved[rec['p']]) if rec['p'] in moved else rec)
            continue
        r = dict(rec)
        if r['p'] in moved:
            r['p'] = moved[r['p']]
        for f in ('desc', 'year', 'note'):
            if o.get(f):
                r[f] = o[f]
        # What the site shows: an explicit title wins, but a description is
        # just as much a name the admin chose — most recordings are titled
        # after their file, so a written description should replace that.
        if o.get('title'):
            r['ttl'] = o['title']
        elif o.get('desc'):
            r['ttl'] = o['desc'].strip().splitlines()[0][:120]
            r['from_desc'] = 1
        if o.get('hidden'):
            r['hidden'] = 1
        if o.get('performer'):
            r['p'] = ensure(cat['performers'], perf_by, o['performer'], 'events')['id']
        if o.get('event'):
            r['e'] = ensure(cat['events'], event_by, o['event'], 'performers')['id']
        # A cassette that has been given a name is no longer an unnamed one.
        #
        # The build files every folder named with a bare number under the one
        # heading "קלטות לא מזוהות", because at that point nobody knows what is
        # on the tape. Identifying it afterwards used to restore its title, its
        # singer and its feast and leave it sitting in that bin all the same:
        # the edit was applied to everything about the recording except where
        # it is filed. Naming it moves it out.
        if o.get('piyyut'):
            r['y'] = ensure(cat['piyyutim'], piy_name, o['piyyut'], 'events')['id']
        elif ((o.get('title') or o.get('desc'))
                and (piy_by.get(rec['y']) or {}).get('name') == UNIDENTIFIED):
            r['y'] = ensure(cat['piyyutim'], piy_name, r['ttl'], 'events')['id']
        cat['recordings'].append(r)

    # A piyyut created a moment ago by ensure() is in the list but not in this
    # map, which was taken before the loop ran. The roll-up below counts through
    # the map, so without this the new row would be left at nought and then
    # dropped as empty — and the recordings pointing at it would be left
    # pointing at nothing.
    piy_by = {p['id']: p for p in cat['piyyutim']}

    # recompute the roll-ups so the menus match what is actually listed
    for seq in (cat['performers'], cat['events'], cat['piyyutim']):
        for row in seq:
            row['n_rec'] = row['n_tracks'] = row['seconds'] = 0
    for p in cat['performers']:
        p['events'] = []
    for e in cat['events']:
        e['performers'] = []
    for y in cat['piyyutim']:
        y['events'] = []
        y['performers'] = []

    name_of_p = {p['id']: p['name'] for p in cat['performers']}
    name_of_e = {e['id']: e['name'] for e in cat['events']}
    seen_piy  = {}
    for r in cat['recordings']:
        for row in (perf_by.get(name_of_p.get(r['p'], '')),
                    event_by.get(name_of_e.get(r['e'], '')),
                    piy_by.get(r['y'])):
            if not row:
                continue
            row['n_rec']    += 1
            row['n_tracks'] += r['n']
            row['seconds']  += r['s']
        pn, en = name_of_p.get(r['p'], ''), name_of_e.get(r['e'], '')
        for row, val, fld in ((perf_by.get(pn), en, 'events'),
                              (event_by.get(en), pn, 'performers'),
                              (piy_by.get(r['y']), en, 'events'),
                              (piy_by.get(r['y']), pn, 'performers')):
            if row and val and val not in row[fld]:
                row[fld].append(val)
        seen_piy.setdefault(r['y'], set()).add((pn, en))
    for p in cat['performers']:
        p['n_piyyut'] = len({r['y'] for r in cat['recordings']
                             if name_of_p.get(r['p']) == p['name']})
    for e in cat['events']:
        e['n_piyyut'] = len({r['y'] for r in cat['recordings']
                             if name_of_e.get(r['e']) == e['name']})

    # drop index rows that no longer carry anything
    cat['performers'] = [p for p in cat['performers'] if p['n_rec']]
    cat['events']     = [e for e in cat['events'] if e['n_rec']]
    cat['piyyutim']   = [y for y in cat['piyyutim'] if y['n_rec']]

    m = cat['meta']
    m['n_rec']    = len(cat['recordings'])
    m['n_tracks'] = sum(r['n'] for r in cat['recordings'])
    m['seconds']  = sum(r['s'] for r in cat['recordings'])
    m['n_perf']   = len(cat['performers'])
    m['n_event']  = len(cat['events'])
    m['n_piyyut'] = len(cat['piyyutim'])
    m['n_hidden'] = hidden if not include_hidden else sum(
        1 for r in cat['recordings'] if r.get('hidden'))
    return cat
