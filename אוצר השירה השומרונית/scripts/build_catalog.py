# -*- coding: utf-8 -*-
"""Merge classification + notes into the single catalog the unit loads.

Produces data/catalog.json with four cross-linked indexes — מבצעים, חגים
ואירועים, פיוטים, הקלטות — plus a per-piyyut description. Each description
carries its provenance so an archive-derived fact and an editor's note are
never presented as the same kind of claim.
"""
import os, re, sys, io, json, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from notes import NOTES

# Ask for UTF-8 out, but never insist on it. There is not always a console
# underneath: packaged there is none at all, and when the build is run from
# inside the program its output is being collected into a buffer that has no
# .buffer to wrap. Either way the catalogue still has to be built.
try:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
except (AttributeError, ValueError):
    pass
HERE = os.path.dirname(os.path.abspath(__file__))
D    = lambda *p: os.path.join(HERE, '..', 'data', *p)

ARCHIVE_ROOT = r'G:\שומרונים ומסורת- תיקייה חשובה מאד\שיראן'

def skeleton(s):
    s = re.sub(r'[^֐-׿ ]', '', s or '')
    s = (s.replace('ך', 'כ').replace('ם', 'מ').replace('ן', 'נ')
           .replace('ף', 'פ').replace('ץ', 'צ'))
    return re.sub(r'\s+', ' ', re.sub(r'[אהוי]', '', s)).strip()

PART_RE = re.compile(r'\s*(?:[—–-]\s*)?\d{1,2}\s*$')

def strip_part(name):
    """Drop a trailing part number, unless that is all the name is."""
    out = PART_RE.sub('', name or '').strip(' —-')
    return out if len(out) >= 2 else (name or '')

def hhmm(sec):
    sec = int(sec or 0)
    h, m = sec // 3600, (sec % 3600) // 60
    if h:
        return '%d:%02d שעות' % (h, m)
    if m:
        return '%d דקות' % m
    return '%d שניות' % sec

recs   = json.load(open(D('recordings.json'), encoding='utf-8'))
tracks = json.load(open(D('tracks.json'), encoding='utf-8'))

NOTES_SK = {skeleton(k): v for k, v in NOTES.items()}

def note_for(name):
    sk = skeleton(name)
    if sk in NOTES_SK:
        return NOTES_SK[sk]
    for k, v in NOTES_SK.items():           # "אור הבקר — נור אילפגרי"
        if len(k) >= 4 and (sk.startswith(k + ' ') or (' ' + k + ' ') in ' ' + sk + ' '):
            return v
    return None

# ------------------------------------------------------------- piyyut index
groups = collections.defaultdict(list)
for r in recs:
    groups[skeleton(r['piyyut']) or ('~' + r['piyyut'])].append(r)

piyyutim = []
for pid, (key, rs) in enumerate(
        sorted(groups.items(), key=lambda kv: -len(kv[1])), 1):
    names = collections.Counter(r['piyyut'] for r in rs)
    # "פרשת הזבח — 1", "פרשת הזבח — 2" are parts of one piyyut, not two names
    display = strip_part(names.most_common(1)[0][0])
    perfs = collections.Counter(r['performer'] for r in rs)
    evs   = collections.Counter(r['event'] for r in rs)
    secs  = sum(r['seconds'] for r in rs)
    main_ev = evs.most_common(1)[0][0]

    # description assembled from what the archive itself attests
    bits = []
    if main_ev != 'שונות':
        bits.append('משויך ל%s' % main_ev)
    bits.append('%d הקלטות באוסף' % len(rs))
    if len(perfs) > 1:
        bits.append('מפי %d מבצעים' % len(perfs))
    bits.append('סך הכול %s' % hhmm(secs))
    desc = '; '.join(bits) + '.'

    for r in rs:
        r['piyyut_id'] = pid
    piyyutim.append({
        'id':        pid,
        'name':      display,
        'variants':  sorted({strip_part(n) for n in names} - {display})[:6],
        'n_rec':     len(rs),
        'n_tracks':  sum(r['n_tracks'] for r in rs),
        'seconds':   secs,
        'events':    [e for e, _ in evs.most_common()],
        'performers': [p for p, _ in perfs.most_common()],
        'desc':      desc,
        'note':      note_for(display),
    })

# ---------------------------------------------------------- performer index
performers = []
for pid, (name, rs) in enumerate(sorted(
        collections.defaultdict(list, {
            k: [r for r in recs if r['performer'] == k]
            for k in {r['performer'] for r in recs}}).items(),
        key=lambda kv: -sum(r['seconds'] for r in kv[1])), 1):
    performers.append({
        'id':       pid,
        'name':     name,
        'n_rec':    len(rs),
        'n_tracks': sum(r['n_tracks'] for r in rs),
        'seconds':  sum(r['seconds'] for r in rs),
        'events':   [e for e, _ in collections.Counter(
                        r['event'] for r in rs).most_common()],
        'n_piyyut': len({r['piyyut_id'] for r in rs}),
    })
PERF_ID = {p['name']: p['id'] for p in performers}

# -------------------------------------------------------------- event index
EVENT_ORDER = [
    'ימי חול', 'שבת', 'שבת הסליחות', 'חג הפסח', 'חג המצות', 'חג השבועות',
    'מעמד הר סיני', 'ראש החודש השביעי', 'יום הכיפורים', 'חג הסוכות',
    'שמיני עצרת', 'עלייה לרגל', 'מועדים', 'שמחות', 'קריאה בתורה',
    'ראיונות ודברי הסבר', 'שונות',
]
events = []
for name in EVENT_ORDER:
    rs = [r for r in recs if r['event'] == name]
    if not rs:
        continue
    events.append({
        'id':        len(events) + 1,
        'name':      name,
        'n_rec':     len(rs),
        'n_tracks':  sum(r['n_tracks'] for r in rs),
        'seconds':   sum(r['seconds'] for r in rs),
        'performers': [p for p, _ in collections.Counter(
                          r['performer'] for r in rs).most_common()],
        'n_piyyut':  len({r['piyyut_id'] for r in rs}),
    })
EVENT_ID = {e['name']: e['id'] for e in events}

# ------------------------------------------------------------------ output
by_rec = collections.defaultdict(list)
for t in tracks:
    by_rec[t['rec']].append(t)

out_recs = []
for r in sorted(recs, key=lambda r: r['id']):
    out_recs.append({
        'id':   r['id'],
        'p':    PERF_ID[r['performer']],
        'e':    EVENT_ID[r['event']],
        'y':    r['piyyut_id'],
        'ttl':  r.get('title') or r['piyyut'],
        'dir':  r['folder'],
        'n':    r['n_tracks'],
        's':    r['seconds'],
        'kind': r['kind'],
        'parts': r.get('parts', 0),
        'hidden': r.get('hidden', 0),
        'tr':   [{'f': t['file'], 's': t['sec'], 'n': t['name']}
                 for t in sorted(by_rec[r['id']], key=lambda t: t['ord'])],
    })

catalog = {
    'meta': {
        'title':     'אוצר השירה השומרונית',
        'root':      ARCHIVE_ROOT,
        'n_rec':     len(out_recs),
        'n_tracks':  len(tracks),
        'seconds':   sum(r['seconds'] for r in recs),
        'n_perf':    len(performers),
        'n_event':   len(events),
        'n_piyyut':  len(piyyutim),
        'n_noted':   sum(1 for p in piyyutim if p['note']),
    },
    'performers': performers,
    'events':     events,
    'piyyutim':   piyyutim,
    'recordings': out_recs,
}

# Deletions made in the local admin panel are baked in here, so the catalog the
# cloud serves matches what the maintainer sees. The cloud copy is read-only —
# this file is the only way those removals reach it.
sys.path.insert(0, HERE)
import removed as GONE                                   # noqa: E402
gone = GONE.keys()
if gone:
    before = len(catalog['recordings'])
    catalog = GONE.apply(catalog, gone)
    print('deletions applied: %d recordings removed (%d → %d)'
          % (before - len(catalog['recordings']), before, len(catalog['recordings'])))

json.dump(catalog, open(D('catalog.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))

sz = os.path.getsize(D('catalog.json')) / 1e6
print('catalog.json  %.2f MB' % sz)
print('  recordings %d   tracks %d   %.1f hours'
      % (catalog['meta']['n_rec'], catalog['meta']['n_tracks'],
         catalog['meta']['seconds'] / 3600))
print('  performers %d   events %d   piyyutim %d   (notes on %d)'
      % (catalog['meta']['n_perf'], catalog['meta']['n_event'],
         catalog['meta']['n_piyyut'], catalog['meta']['n_noted']))
print()
print('=== piyyutim with an editor note ===')
print(', '.join(p['name'] for p in piyyutim if p['note'])[:1500])
