# -*- coding: utf-8 -*-
"""
Live, free, key-less fetch of additional Jewish commentators from Sefaria's
public API (used by the "פרשנים נוספים (ספריא)" option). One request per
commentator, run concurrently, so a verse's extra commentaries arrive in a
second or two with no API key and no cost.
"""
import re
import json
import socket
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

_TAG  = re.compile(r'<[^>]+>')
_UA   = {'User-Agent': 'Mozilla/5.0 (SamaritanTorahApp)'}
_CAP  = 4000   # max chars per commentator (keeps the panel readable)

BOOK_EN = {'בראשית': 'Genesis', 'שמות': 'Exodus', 'ויקרא': 'Leviticus',
           'במדבר': 'Numbers', 'דברים': 'Deuteronomy'}

# (Sefaria title template, Hebrew display name); %s = English book name.
COMMENTATORS = [
    ('Ibn_Ezra_on_%s',     'אבן עזרא'),
    ('Rashbam_on_%s',      'רשב״ם'),
    ('Radak_on_%s',        'רד״ק'),
    ('Sforno_on_%s',       'ספורנו'),
    ('Kli_Yakar_on_%s',    'כלי יקר'),
    ('Or_HaChaim_on_%s',   'אור החיים'),
    ('Rabbeinu_Bahya,_%s', 'רבינו בחיי'),
    ('Tur_HaArokh,_%s',    'טור הארוך'),
    ('Steinsaltz_on_%s',   'שטיינזלץ'),
]


def has_internet(timeout=4):
    try:
        with socket.create_connection(('www.sefaria.org', 443), timeout=timeout):
            return True
    except OSError:
        return False


def lookup_root(word, timeout=10):
    """Look the word up in Sefaria's free lexicon and return the consonantal
    skeleton of its dictionary head-word (lemma). This resolves the word's
    meaning to its base/root even with defective Samaritan spelling
    (e.g. השקים -> שׁוֹק -> שק). Returns None when nothing is found."""
    import urllib.parse
    from app.services.hebrew_root import to_skeleton
    url = 'https://www.sefaria.org/api/words/' + urllib.parse.quote(word)
    try:
        req = urllib.request.Request(url, headers=_UA)
        d = json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8'))
    except Exception:
        return None
    if isinstance(d, list):
        for entry in d:
            hw = entry.get('headword')
            if hw:
                sk = to_skeleton(hw)
                if sk:
                    return sk
    return None


def _strip(s):
    if isinstance(s, list):
        s = ' '.join(_strip(x) for x in s)
    if not isinstance(s, str):
        return ''
    s = s.replace('<br>', '\n').replace('<br/>', '\n').replace('<br />', '\n')
    s = _TAG.sub('', s)
    s = s.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&thinsp;', ' ')
    return re.sub(r'[ \t]+', ' ', s).strip()


def _flatten(x):
    out = []
    if isinstance(x, list):
        for i in x:
            out.extend(_flatten(i))
    elif isinstance(x, str) and x.strip():
        out.append(x)
    return out


def _fetch_one(title, ch, vs, timeout):
    url = 'https://www.sefaria.org/api/texts/%s.%d.%d?context=0&commentary=0' % (title, ch, vs)
    try:
        req = urllib.request.Request(url, headers=_UA)
        d = json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8'))
    except Exception:
        return None
    parts = [_strip(p) for p in _flatten(d.get('he') or [])]
    text = '\n'.join(p for p in parts if p).strip()
    if not text:
        return None
    if len(text) > _CAP:
        text = text[:_CAP].rstrip() + ' …'
    return text


def fetch_live_commentaries(book_he, ch, vs, timeout=20):
    """Return [(hebrew_name, text), ...] of extra Sefaria commentators for the
    verse (book_he, chapter, verse). Empty list if none found."""
    book_en = BOOK_EN.get(book_he)
    if not book_en:
        return []
    jobs = [(tmpl % book_en, heb) for tmpl, heb in COMMENTATORS]
    with ThreadPoolExecutor(max_workers=len(jobs)) as ex:
        submitted = [(heb, ex.submit(_fetch_one, title, ch, vs, timeout))
                     for title, heb in jobs]
    out = []
    for heb, fut in submitted:
        try:
            txt = fut.result()
        except Exception:
            txt = None
        if txt:
            out.append((heb, txt))
    return out
