# -*- coding: utf-8 -*-
"""חיפוש אחד על פני כל הבית — one search across every app in the house.

The house is a dozen apps that were built one at a time, each with a search of
its own and each searching only itself. This asks all of them at once and
answers in one list: where the thing was found, what kind of thing it is, which
unit of that app holds it, and enough of it to recognise.

Three kinds of source, and the module is mostly the business of making them
answer in the same shape:

  * the database — the Torah itself and everything in the library. Each unit
    already has a search function in app/services/database.py that returns rows
    the CLIENT already knows how to navigate to; those rows are passed through
    untouched, with the unit's key beside them, and the client turns them into a
    destination with the same code it uses for the unit's own search box. That
    is deliberate: a second copy of "how do I reach §12 of Tibåt Mårqe" would be
    one more thing to keep in step.
  * JSON the other units are served from — the recordings catalogue, the
    manuscripts, the calendar's own years.
  * two files that are JavaScript rather than data: the timeline's events (a
    JSON array behind an assignment, so it parses) and Mount Gerizim's places
    (a real script, so only the names are lifted out, by pattern).

Nothing here writes, and nothing here is translated: the snippets are in the
language they were written in, and every label the reader sees is chosen on the
client, where the app's own three-language table lives.
"""
import json
import os
import re
import sys
import unicodedata

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from app.services import database as db

# ── where the other units keep their data ───────────────────────────────────
_SHIRA_CAT = os.path.join(_ROOT, 'אוצר השירה השומרונית', 'data', 'catalog.json')
_MSS_DATA = os.path.join(_ROOT, 'אוצר כתבי היד השומרוניים בתבל', 'data')
_TIMELINE = os.path.join(_ROOT, 'History_timeline', 'data', 'events.js')
_GERIZIM = os.path.join(_ROOT, 'web', 'static', 'gerizim', 'places.js')
_CALENDAR = os.path.join(_ROOT, 'web', 'static', 'data', 'calendar')

# every app that can be searched from here, in the order results are shown.
# The genealogy and the calendar's own site are somebody else's servers; the
# calendar is here all the same, because the app carries its years itself.
APPS = ('torah', 'library', 'dict', 'shira', 'mss', 'timeline', 'gerizim', 'calendar')

# the library's units, each with the key the client knows it by
_BOOKS = (
    ('tm', 'm_tm_book', db.search_tm),
    ('tz', 'm_tz_book', db.search_tz),
    ('shyt', 'm_shyt_book', db.search_shyt),
    ('sir', 'm_sir_book', db.search_sir),
    ('bhuq', 'm_bhuq_book', db.search_bhuq),
    ('ervah', 'm_ervah_book', db.search_ervah),
    ('asatir', 'm_asatir_book', db.search_asatir),
    ('wreschner', 'm_wreschner_book', db.search_wreschner),
    ('cohen', 'm_cohen_book', db.search_cohen),
)


# ── reading the files, once, and again only when they change ────────────────
_cache = {}


def _cached(path, build):
    """Parse a file once and keep it; a changed file is parsed again."""
    try:
        stamp = os.path.getmtime(path)
    except OSError:
        return None
    hit = _cache.get(path)
    if hit and hit[0] == stamp:
        return hit[1]
    try:
        val = build(path)
    except Exception:
        val = None                      # a file that will not parse must not take the search down
    _cache[path] = (stamp, val)
    return val


def _read_json(path):
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def _read_js_array(path):
    """`window.X = [ … ];` — the array inside is JSON, so take it from the first
    bracket to the last and parse that."""
    with open(path, encoding='utf-8') as fh:
        src = fh.read()
    i, j = src.find('['), src.rfind(']')
    return json.loads(src[i:j + 1]) if i >= 0 and j > i else []


# names in Mount Gerizim's script: `id: 'x', … name: t('he', 'en', 'ar')`
_GER_RE = re.compile(r"id:\s*'([^']+)'[\s\S]{0,120}?name:\s*t\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'")


def _read_gerizim(path):
    with open(path, encoding='utf-8') as fh:
        src = fh.read()
    # the file opens with the periods and the groups, which are not places and
    # cannot be opened at; the places themselves start further down
    cut = src.find('const places')
    if cut > 0:
        src = src[cut:]
    out, seen = [], set()
    for pid, he, en, ar in _GER_RE.findall(src):
        if pid in seen:
            continue
        seen.add(pid)
        out.append({'id': pid, 'he': he, 'en': en, 'ar': ar})
    return out


def _read_calendar(path):
    """Every year the app carries, flattened to the two things worth finding:
    a feast on its day, and the sabbath's portion."""
    feasts, portions = {}, {}
    for fn in sorted(os.listdir(path)):
        if not re.match(r'^\d{4}\.json$', fn):
            continue
        try:
            year = _read_json(os.path.join(path, fn))
        except Exception:
            continue
        for date, d in (year.get('days') or {}).items():
            for ev in (d.get('ev') or []):
                feasts.setdefault(ev, []).append((date, d.get('d', ''), d.get('m', '')))
        for date, s in (year.get('shabbat') or {}).items():
            name = s.get('name') or s.get('p') or ''
            if name:
                portions.setdefault(name, []).append((date, s.get('book_name', '')))
    return {'feasts': feasts, 'portions': portions}


# ── matching ────────────────────────────────────────────────────────────────
def _fold(s):
    """Fold for comparison: no points, no punctuation, one kind of space. Hebrew
    final letters are left alone — a reader who typed one meant it."""
    s = unicodedata.normalize('NFKD', str(s or ''))
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[־׀׃׳״"\'`.,;:!?()\[\]{}־–—]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip().lower()


def _hit(q, *fields):
    """True when the folded query is inside any of the folded fields."""
    for f in fields:
        if f and q in _fold(f):
            return True
    return False


def _snip(text, q, before=34, after=46):
    """The matched stretch with a little on either side."""
    txt = re.sub(r'\s+', ' ', str(text or '')).strip()
    low, fq = _fold(txt), q
    i = low.find(fq)
    if i < 0:
        return txt[:110]
    # the folded string and the real one can differ in length; walk back to a
    # word boundary rather than cutting a letter off
    start = max(0, i - before)
    end = min(len(txt), i + len(fq) + after)
    return ('…' if start else '') + txt[start:end].strip() + ('…' if end < len(txt) else '')


def _row(app, kind, ref, text='', go=None, unit_key='', extra=None):
    r = {'app': app, 'kind': kind, 'ref': ref, 'text': text, 'go': go or {}}
    if unit_key:
        r['unitKey'] = unit_key
    if extra:
        r.update(extra)
    return r


# ── the Torah ───────────────────────────────────────────────────────────────
def _torah(q, raw, cap):
    try:
        rows, _total = db.search_verses(raw)
    except Exception:
        return []
    out = []
    for r in rows[:cap]:
        ref = '%s %s:%s' % (r['book_name'], r['chapter_num'], r['number'])
        out.append(_row('torah', 'verse', ref, _snip(r['text'], q),
                        {'t': 'verse', 'vid': r['id']}))
    return out


# ── the library ─────────────────────────────────────────────────────────────
def _library(q, raw, cap):
    out = []
    for key, unit_key, fn in _BOOKS:
        try:
            rows = fn(raw, limit=cap)
        except TypeError:                                  # ervah takes a language too
            rows = fn(raw)
        except Exception:
            continue
        for r in rows[:cap]:
            # the row goes to the client untouched: its own BOOK_CFG[key].searchTo()
            # turns it into a place in that book, and searchRef() into a reference
            out.append(_row('library', 'section', '', r.get('snippet', ''),
                            {'t': 'book', 'key': key, 'row': r}, unit_key))
    try:
        # the people search answers with the light list rows, which carry no
        # description — so the line under the name is when the figure lived,
        # which is what those rows do carry
        for p in db.search_people(raw, limit=cap)[:cap]:
            name = p.get('name_he') or p.get('name_en') or ''
            out.append(_row('library', 'person', name,
                            p.get('period_he') or p.get('period') or p.get('era') or '',
                            {'t': 'person', 'id': p.get('id')}, 'm_people_book'))
    except Exception:
        pass
    try:
        for p in db.search_piyutim(raw, limit=cap)[:cap]:
            title = p.get('title') or p.get('incipit3') or ''
            sub = ' · '.join(x for x in (p.get('author'), p.get('festival'), p.get('genre')) if x)
            out.append(_row('library', 'piyut', title, sub,
                            {'t': 'piyut', 'id': p.get('id')}, 'm_piyutim_book'))
    except Exception:
        pass
    try:
        seen = set()
        for l in db.search_dara(raw, limit=cap * 3):
            pid = l.get('piyut_id')
            if pid in seen:
                continue
            seen.add(pid)
            line = l.get('heb') or l.get('aram') or l.get('translit') or ''
            out.append(_row('library', 'dara', l.get('title') or '', _snip(line, q),
                            {'t': 'dara', 'id': pid}, 'm_dara_book'))
            if len(seen) >= cap:
                break
    except Exception:
        pass
    return out


# ── the dictionary ──────────────────────────────────────────────────────────
def _dict(q, raw, cap):
    out, seen = [], set()
    try:
        rows = db.dict_word_search(raw, limit=cap * 3) or []
    except Exception:
        rows = []
    for r in rows:
        word = r.get('lemma') or r.get('word') or r.get('entry') or ''
        gloss = str(r.get('gloss') or r.get('meaning') or r.get('hebrew') or '')[:120]
        # one entry can hold several senses; the same word with the same gloss
        # twice is the same answer twice
        if not word or (word, gloss) in seen:
            continue
        seen.add((word, gloss))
        out.append(_row('dict', 'word', word, gloss,
                        {'t': 'dict', 'word': word}, 'm_dict_aram'))
        if len(out) >= cap:
            break
    return out


# ── the song archive ────────────────────────────────────────────────────────
def _shira(q, raw, cap):
    cat = _cached(_SHIRA_CAT, _read_json)
    if not cat:
        return []
    out = []
    for p in cat.get('piyyutim', []):
        if len(out) >= cap:
            break
        if _hit(q, p.get('name'), *(p.get('variants') or [])):
            out.append(_row('shira', 'shira_piyyut', p.get('name', ''),
                            p.get('desc') or '', {'t': 'shira', 'q': p.get('name', '')}))
    n = 0
    for p in cat.get('performers', []):
        if n >= 6:
            break
        if _hit(q, p.get('name')):
            n += 1
            out.append(_row('shira', 'shira_perf', p.get('name', ''),
                            '%s · %s' % (p.get('n_rec', 0), p.get('n_tracks', 0)),
                            {'t': 'shira', 'q': p.get('name', '')},
                            extra={'counts': [p.get('n_rec', 0), p.get('n_tracks', 0)]}))
    for e in cat.get('events', []):
        if _hit(q, e.get('name')):
            out.append(_row('shira', 'shira_event', e.get('name', ''), '',
                            {'t': 'shira', 'q': e.get('name', '')},
                            extra={'counts': [e.get('n_rec', 0), e.get('n_tracks', 0)]}))
    return out


# ── the manuscripts ─────────────────────────────────────────────────────────
def _mss(q, raw, cap):
    out = []
    lib = _cached(os.path.join(_MSS_DATA, 'viewer-library.json'), _read_json) or []
    for m in lib:
        if len(out) >= cap:
            break
        if _hit(q, m.get('title'), m.get('inst'), m.get('shelf'), m.get('note')):
            ref = ' · '.join(x for x in (m.get('title'), m.get('shelf')) if x)
            # the shelfmark is what that app's own search box finds it by in one
            # go; a title can run to a dozen words and matches nothing exactly
            out.append(_row('mss', 'mss', ref, m.get('inst') or '',
                            {'t': 'mss', 'q': m.get('shelf') or m.get('title') or ''}))
    world = _cached(os.path.join(_MSS_DATA, 'world-index.json'), _read_json) or []
    n = 0
    for m in world:
        if n >= cap:
            break
        if _hit(q, m.get('title'), m.get('title_en'), m.get('title_ar'),
                m.get('inst'), m.get('inst_en'), m.get('shelf')):
            n += 1
            ref = ' · '.join(x for x in (m.get('title'), m.get('shelf')) if x)
            out.append(_row('mss', 'mss_coll', ref, m.get('inst') or m.get('inst_en') or '',
                            {'t': 'mss', 'q': m.get('shelf') or m.get('title') or ''}))
    return out


# ── the timeline ────────────────────────────────────────────────────────────
def _timeline(q, raw, cap):
    evs = _cached(_TIMELINE, _read_js_array) or []
    out = []
    for e in evs:
        if len(out) >= cap:
            break
        if _hit(q, e.get('title'), e.get('body')):
            year = e.get('year')
            when = ('%d לפנה״ס' % -year) if isinstance(year, int) and year < 0 else str(year or '')
            out.append(_row('timeline', 'tl', e.get('title', ''),
                            _snip(e.get('body'), q) if e.get('body') else '',
                            {'t': 'timeline', 'ev': e.get('id')}, extra={'when': when}))
    return out


# ── Mount Gerizim ───────────────────────────────────────────────────────────
def _gerizim(q, raw, cap):
    places = _cached(_GERIZIM, _read_gerizim) or []
    out = []
    for p in places:
        if len(out) >= cap:
            break
        if _hit(q, p['he'], p['en'], p['ar']):
            out.append(_row('gerizim', 'place', p['he'] or p['en'], '',
                            {'t': 'gerizim', 'place': p['id']}))
    return out


# ── the calendar ────────────────────────────────────────────────────────────
def _calendar(q, raw, cap):
    cal = _cached(_CALENDAR, _read_calendar) if os.path.isdir(_CALENDAR) else None
    if not cal:
        return []
    out = []
    for name, days in cal['feasts'].items():
        if len(out) >= cap:
            break
        if _hit(q, name):
            days = sorted(days)
            out.append(_row('calendar', 'feast', name,
                            '%s · %s' % (days[0][0], days[0][2]),
                            {'t': 'calendar', 'date': days[0][0]},
                            extra={'times': len(days)}))
    n = 0
    for name, days in cal['portions'].items():
        if n >= cap:
            break
        if _hit(q, name):
            n += 1
            days = sorted(days)
            out.append(_row('calendar', 'parasha', name,
                            '%s · %s' % (days[0][0], days[0][1]),
                            {'t': 'calendar', 'date': days[0][0]},
                            extra={'times': len(days)}))
    return out


_FINDERS = {'torah': _torah, 'library': _library, 'dict': _dict, 'shira': _shira,
            'mss': _mss, 'timeline': _timeline, 'gerizim': _gerizim, 'calendar': _calendar}


def search(q, scopes=None, cap=8, limit=240):
    """Ask every chosen app. `cap` is per source, `limit` the whole answer."""
    raw = (q or '').strip()
    if len(raw) < 2:
        return {'q': raw, 'count': 0, 'rows': [], 'by_app': {}, 'apps': list(APPS)}
    folded = _fold(raw)
    want = [a for a in APPS if not scopes or a in scopes]
    rows, by_app = [], {}
    for app_key in want:
        try:
            found = _FINDERS[app_key](folded, raw, cap) or []
        except Exception:
            found = []
        by_app[app_key] = len(found)
        rows.extend(found)
    return {'q': raw, 'count': len(rows), 'rows': rows[:limit],
            'by_app': by_app, 'apps': list(APPS)}
