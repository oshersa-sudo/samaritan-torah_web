# -*- coding: utf-8 -*-
"""Turn the raw file inventory into the three-way index: מבצע / חג-אירוע / פיוט.

Files are grouped into *recordings*: a folder full of numbered tracks
("AudioTrack 04", "12 רצועה 12") is one recording of one piyyut, while a folder
of descriptively-named files yields one recording per file. Every individual
track keeps its own row so no audio file is lost from the index.

Events that a folder does not state are inferred twice over: first from the
well-organised שיראן ניר tree (where the same piyyut sits under a named חג),
then from the festival column of the piyutim table in torah.db.
"""
import os, re, json, sys, io, sqlite3, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vocab import (PERFORMERS, NON_PERFORMER_TOPS, EVENTS, TRANSLIT, STRUCTURAL,
                   EVENT_KEYWORDS, HIDDEN_PERFORMERS)

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
D    = lambda *p: os.path.join(HERE, '..', 'data', *p)
DB   = os.path.join(HERE, '..', '..', 'data', 'torah.db')

# ------------------------------------------------------------------ helpers
def norm(s):
    """Fold a name for alias lookup: lowercase, strip punctuation and gershayim."""
    s = (s or '').lower().strip()
    s = s.replace('‏', '').replace('‎', '')
    s = re.sub(r'["\'`׳״]', '', s)
    s = re.sub(r'[()\[\]{}]', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip(' -–—+')

def skeleton(s):
    """Consonantal skeleton — folds Samaritan phonetic spelling variants.

    בריכ/בריך, אדק/אדיק, אלהנו/אלהינו all collapse to one key.
    """
    s = re.sub(r'[^֐-׿ ]', '', s or '')
    s = (s.replace('ך', 'כ').replace('ם', 'מ').replace('ן', 'נ')
           .replace('ף', 'פ').replace('ץ', 'צ'))
    s = re.sub(r'[אהוי]', '', s)
    return re.sub(r'\s+', ' ', s).strip()

P_ALIAS, E_ALIAS = {}, {}
for canon, als in PERFORMERS.items():
    P_ALIAS[norm(canon)] = canon
    for a in als:
        P_ALIAS[norm(a)] = canon
for canon, als in EVENTS.items():
    E_ALIAS[norm(canon)] = canon
    for a in als:
        E_ALIAS[norm(a)] = canon

TRANSLIT_N = {norm(k): v for k, v in TRANSLIT.items()}
STRUCT_N   = {norm(s) for s in STRUCTURAL}

SPLIT_RE = re.compile(r'\s+[-–—]\s*|\s*[-–—]\s+|\s*\+\s*')

# a name that only marks a part or a manner of singing, never a piyyut
THIN = re.compile(r'\d{1,3}|[a-z]|disk\s*\d+|כבד|פאוואה|פוואה|בתים|פסוקים', re.I)

# a leading "07 " / "01-" track prefix on an otherwise descriptive name
LEAD_NUM = re.compile(r'^\d{1,3}\s*[-_.\s]\s*|^\d{1,3}(?=[א-ת])')

TRACK_RE = re.compile(
    r'^(?:'
    r'\d{1,3}'
    r'|(?:audio)?track\s*\d+'
    r'|\d+\s*[-_. ]\s*(?:audio)?track\s*\d+'
    r'|\d+\s*רצועה\s*\d+'
    r'|רצועה\s*\d+'
    r'|temp\d*'
    r'|\d+\s*\.\s*\d+'
    r'|\d+\s*\(\s*\d+\s*\)'                     # 1 (1)
    r'|\d+\s*section\s*\d+'
    r'|[ab]|\d+[ab]'
    r')$', re.I)

def clean_name(name):
    """Drop a leading track number from a descriptive file name."""
    return LEAD_NUM.sub('', (name or '').strip()).strip()

def is_track_name(name):
    """True for pure track labels — checked before *and* after stripping a
    leading number, so "01-Track 1" is caught as well as "Track 1"."""
    return bool(TRACK_RE.match(norm(name)) or TRACK_RE.match(norm(clean_name(name))))

def track_num(name):
    m = re.search(r'(\d+)', name)
    return int(m.group(1)) if m else 0

# ------------------------------------------------------- segment classifier
def read_segment(seg):
    performer = event = None
    piyyut, as_event = [], []
    n = norm(seg)
    if n in TRANSLIT_N:
        return None, None, [TRANSLIT_N[n]]
    if n in P_ALIAS:
        return P_ALIAS[n], None, []
    if n in E_ALIAS:
        return None, E_ALIAS[n], []
    for part in SPLIT_RE.split(seg):
        pn = norm(part)
        if not pn:
            continue
        if pn in P_ALIAS:
            performer = P_ALIAS[pn]
        elif pn in TRANSLIT_N:
            piyyut.append(TRANSLIT_N[pn])
        elif pn in E_ALIAS:
            event = event or E_ALIAS[pn]
            as_event.append(clean_name(part))
        elif pn in STRUCT_N:
            continue
        else:
            piyyut.append(clean_name(part))
    # Some names are both — "אור הבקר" dates a recording to ימי חול *and* is
    # the piyyut sung. Keep it as the title when nothing else names one.
    return performer, event, piyyut or as_event

def classify(dirs, fname=None):
    performer = event = None
    piyyut_parts = []
    segs = list(dirs)

    if segs and norm(segs[0]) in P_ALIAS and segs[0] not in NON_PERFORMER_TOPS:
        performer = P_ALIAS[norm(segs[0])]

    for i, seg in enumerate(segs):
        if i == 0 and performer:
            continue
        p, e, py = read_segment(seg)
        if p:
            performer = p
        if e and not event:
            event = e
        if py:
            piyyut_parts = py

    if fname and not is_track_name(fname):
        p, e, py = read_segment(clean_name(fname))
        if p:
            performer = p
        if e and not event:
            event = e
        if py:
            piyyut_parts = py

    piyyut = ' — '.join(x for x in piyyut_parts if x).strip(' —-')
    return performer, event, piyyut

# ------------------------------------------------------------------- build
inv  = json.load(open(D('raw_inventory.json'), encoding='utf-8'))
durs = json.load(open(D('durations.json'), encoding='utf-8'))

# Files confirmed byte-identical to a copy filed elsewhere (find_duplicates.py).
# Dedup happens per *recording*, not per file: a recording is dropped only when
# every one of its tracks is a duplicate. Dropping individual tracks would leave
# 19 partly-copied folders as fragments of themselves.
dupes = {}
if os.path.exists(D('duplicates.json')):
    dupes = json.load(open(D('duplicates.json'), encoding='utf-8'))

by_folder = collections.defaultdict(list)
for r in inv:
    by_folder['/'.join(r['dirs'])].append(r)

recordings, tracks = [], []
rid = dropped_dup = 0
for folder, files in sorted(by_folder.items()):
    dirs = folder.split('/') if folder else []
    numbered = [f for f in files if is_track_name(f['name'])]
    named    = [f for f in files if not is_track_name(f['name'])]

    groups = []
    if numbered:
        groups.append((None, sorted(numbered, key=lambda f: track_num(f['name']))))
    for f in named:
        groups.append((f['name'], [f]))

    for label, gfiles in groups:
        # every track already present elsewhere → this whole filing is a copy
        if gfiles and all(f['rel'] in dupes for f in gfiles):
            dropped_dup += 1
            continue
        rid += 1
        performer, event, piyyut = classify(dirs, label)
        if not piyyut:
            piyyut = clean_name(label or '') or (dirs[-1] if dirs else 'ללא שם')
        # "1", "d", "כבד" name a part, not a piyyut — take the name from the
        # parent folder and keep the marker as a qualifier.
        if THIN.fullmatch(piyyut.strip()) and dirs:
            # a thin *file* name takes its title from its own folder; a thin
            # *folder* name takes it from the folder above
            upper = dirs if label else dirs[:-1]
            _, _, up = classify(upper) if upper else (None, None, '')
            up = up or (clean_name(upper[-1]) if upper else '')
            if up and not THIN.fullmatch(up.strip()):
                piyyut = '%s — %s' % (up, piyyut.strip())
        recordings.append({
            'id':        rid,
            'performer': performer or 'לא ידוע',
            'event':     event,
            'piyyut':    piyyut,
            'folder':    folder,
            'n_tracks':  len(gfiles),
            'seconds':   round(sum(durs.get(f['rel']) or 0 for f in gfiles)),
            'kind':      gfiles[0]['kind'],
            'src':       (dirs[0] if dirs else ''),
        })
        for i, f in enumerate(gfiles, 1):
            tracks.append({
                'rec':  rid, 'ord': i, 'file': f['rel'],
                'name': f['name'], 'sec': round(durs.get(f['rel']) or 0),
                'size': f['size'],
            })

# ------------------------------------------------ unlabelled cassette sides
# Folders "10".."18" are raw tape rips with no name at all. They share one
# index entry, but each keeps its tape and side in its own title.
for r in recordings:
    r['title'] = r['piyyut']
    if re.fullmatch(r'\d{1,2}', r['folder'] or ''):
        r['title']     = 'קלטת %s' % r['folder']       # its sides are its tracks
        r['piyyut']    = 'קלטות לא מזוהות'
        r['performer'] = 'לא ידוע'
        r['unident']   = True

# --------------------------------------------- join parts of one performance
# One sitting is often filed as several parts — A/B/C, Disk 1/2, or a trailing
# number. Same performer, same parent folder, same title once the part marker
# is stripped ⇒ one recording. The nine unnamed tapes are exempt: they share a
# placeholder title without being the same performance.
PART_MARK = re.compile(
    r'(?:[\s_\-–—]*(?:\(\d{1,2}\)|disk\s*\d{1,2}|cd\s*\d{1,2}|part\s*\d{1,2}'
    r'|חלק\s*\d{1,2}|\d{1,2})'
    r'|[\s_\-–—]+[a-z])$', re.I)   # a bare letter only counts after a separator,
                                   # so "tsedaka" does not lose its last letter


def base_title(s):
    out, prev = (s or '').strip(), None
    while out != prev and len(out) > 3:
        prev = out
        out = PART_MARK.sub('', out).strip(' -–—_')
    return out or (s or '').strip()


def part_rank(r):
    """Order parts the way they were performed: 1,2,3… or A,B,C."""
    m = re.search(r'(\d{1,3})\s*$', r['title'] or '')
    if m:
        return (0, int(m.group(1)), r['folder'])
    m = re.search(r'([abc])\s*$', (r['folder'] or '').split('/')[-1], re.I)
    if m:
        return (0, ord(m.group(1).lower()) - 96, r['folder'])
    return (1, 0, r['folder'])


parts = collections.defaultdict(list)
for r in recordings:
    if r.get('unident'):
        continue
    parent = '/'.join(r['folder'].split('/')[:-1])
    parts[(r['performer'], parent, base_title(r['title']).lower())].append(r)

by_rec = collections.defaultdict(list)
for t in tracks:
    by_rec[t['rec']].append(t)

merged_away, merged_groups = set(), 0
for (perf, parent, base), group in parts.items():
    if len(group) < 2 or len(base) < 2:
        continue
    group.sort(key=part_rank)
    head, rest = group[0], group[1:]
    merged_groups += 1
    head['title']  = base_title(head['title'])
    head['piyyut'] = base_title(head['piyyut']) or head['piyyut']
    head['parts']  = len(group)
    order = len(by_rec[head['id']])
    for r in rest:
        head['n_tracks'] += r['n_tracks']
        head['seconds']  += r['seconds']
        for t in sorted(by_rec[r['id']], key=lambda t: t['ord']):
            order += 1
            t['rec'], t['ord'] = head['id'], order      # parts play in order
        merged_away.add(r['id'])

recordings = [r for r in recordings if r['id'] not in merged_away]
print('joined %d split filings into %d recordings' % (len(merged_away), merged_groups))

# --------------------------------------- event inference 1: from the archive
# the שיראן ניר tree files by חג, so a piyyut seen there dates the same piyyut
# wherever else it appears untagged.
piy_event = collections.Counter()
for r in recordings:
    if r['event'] and r['piyyut']:
        piy_event[(skeleton(r['piyyut']), r['event'])] += 1
best_event = {}
for (sk, ev), n in piy_event.most_common():
    if sk and sk not in best_event:
        best_event[sk] = ev

inferred_archive = 0
for r in recordings:
    if not r['event']:
        ev = best_event.get(skeleton(r['piyyut']))
        if ev:
            r['event'] = ev
            r['event_src'] = 'archive'
            inferred_archive += 1

# -------------------------------------- event + description 2: from torah.db
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
piyutim = list(con.execute(
    'select id,title,incipit3,author,festival,genre,text,translation_he from piyutim'))
con.close()

by_sk = {}
for p in piyutim:
    for field in (p['title'], p['incipit3']):
        sk = skeleton(field or '')
        if len(sk) >= 6 and sk not in by_sk:
            by_sk[sk] = p

def db_match(piyyut):
    sk = skeleton(piyyut)
    if len(sk) < 6:
        return None
    if sk in by_sk:
        return by_sk[sk]
    for k, p in by_sk.items():           # prefix match: folder names truncate
        if len(k) >= 8 and (sk.startswith(k) or k.startswith(sk)):
            return p
    return None

DB_FEST = {
    'יום הכיפורים': 'יום הכיפורים', 'שבת': 'שבת', 'חג המצות': 'חג המצות',
    'פסח': 'חג הפסח', 'סוכות': 'חג הסוכות', 'שבועות': 'חג השבועות',
    'שמיני עצרת': 'שמיני עצרת', 'שמחה': 'שמחות', 'ראש החודש': 'ראש החודש השביעי',
}

matched = inferred_db = 0
for r in recordings:
    p = db_match(r['piyyut'])
    if not p:
        continue
    matched += 1
    r['piy_id']     = p['id']
    r['piy_title']  = p['title']
    r['author']     = p['author']
    r['genre']      = p['genre']
    txt = re.sub(r'\s+', ' ', (p['text'] or '')).strip()
    r['incipit']    = txt[:110]
    if not r['event']:
        ev = DB_FEST.get(p['festival'] or '')
        if ev:
            r['event'] = ev
            r['event_src'] = 'db'
            inferred_db += 1

# ------------------------------- event inference 3: keywords in the piyyut name
inferred_kw = 0
for r in recordings:
    if r['event']:
        continue
    hay = r['piyyut'] + ' ' + r['folder']
    for ev, words in EVENT_KEYWORDS:
        if any(w in hay for w in words):
            r['event'] = ev
            r['event_src'] = 'keyword'
            inferred_kw += 1
            break

for r in recordings:
    r['event'] = r['event'] or 'שונות'
    if r['performer'] in HIDDEN_PERFORMERS:
        r['hidden'] = 1

json.dump(recordings, open(D('recordings.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
json.dump(tracks, open(D('tracks.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

# ------------------------------------------------------------------ report
print('recordings: %d   tracks: %d   hours: %.1f'
      % (len(recordings), len(tracks), sum(r['seconds'] for r in recordings) / 3600))
print('duplicate recordings removed: %d  (%d redundant files confirmed identical)'
      % (dropped_dup, len(dupes)))
print('event inferred — archive: %d, torah.db: %d, keyword: %d'
      % (inferred_archive, inferred_db, inferred_kw))
print('piyyut matched to torah.db: %d / %d' % (matched, len(recordings)))
print()
print('=== events ===')
for k, v in collections.Counter(r['event'] for r in recordings).most_common():
    print('%5d  %s' % (v, k))
print()
print('=== performers (top 15) ===')
for k, v in collections.Counter(r['performer'] for r in recordings).most_common(15):
    print('%5d  %s' % (v, k))
print()
print('=== distinct piyyutim: %d ===' % len({skeleton(r['piyyut']) for r in recordings}))
