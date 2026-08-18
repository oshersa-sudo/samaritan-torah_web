# -*- coding: utf-8 -*-
"""Take the photograph list from the-samaritans.net into the archive.

The site is the community's own and belongs to the same hands as this archive,
and its library is already sorted the way the screen wants it — the files are
named for their subject, and the photographer is written into the title. So
nothing here has to be guessed: the credit is read off the picture rather than
inferred, and the feast comes from the word the site itself filed it under.

Only the list is taken. The pictures stay where they are and are shown from
there, which is why this writes URLs and not files.

    py -3 scripts/fetch_site_photos.py

Writes data/pix_sources.json, which the screen reads before anything else.
"""
import gzip
import io
import json
import os
import re
import ssl
import sys
import urllib.request

SITE = 'https://www.the-samaritans.net'
API = SITE + ('/wp-json/wp/v2/media?per_page=100&page=%d&_fields='
              'id,source_url,title,alt_text,caption,media_type,mime_type,'
              'media_details,slug')

HEAD = {
    'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                   ' (KHTML, like Gecko) Chrome/126.0 Safari/537.36'),
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip',
    'Connection': 'close',
}

MIN_SIDE = 600          # smaller than this is a thumbnail or a device, not a photograph
KEEP_MIME = ('image/jpeg', 'image/png')

# what is in the library but is not a photograph of anybody
SKIP = re.compile(
    r'logo|icon|emblem|favicon|screenshot|banner|button|cropped|script|youtube|'
    r'placeholder|avatar|header|footer|background|pattern|texture|map\b|chart|'
    r'qr[-_]|badge|watermark|sprite|thumb', re.I)

# the word the site filed a picture under, and the feasts it suits
TOPIC = [
    (r'passover|pesach|matzot', [4, 5]),
    (r'sukkot|succot|sukkoth|tabernacle', [10, 11]),
    (r'shavuot|pentecost', [6]),
    (r'yom.?kippur|atonement', [9]),
    (r'pilgrimage|aliyah|gerizim', [7, 12]),
    (r'torah|pentateuch|scroll', [15]),
    (r'lifecycle|wedding|marriage|birth', [14]),
    (r'prayer|synagogue|sabbath|shabbat', [2, 3]),
]


def _get(url):
    req = urllib.request.Request(url, headers=HEAD)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    r = urllib.request.urlopen(req, timeout=60, context=ctx)
    body = r.read()
    if r.headers.get('Content-Encoding') == 'gzip':
        body = gzip.decompress(body)
    return r, body


def library():
    out, page = [], 1
    while page <= 40:
        try:
            r, body = _get(API % page)
        except Exception as e:                       # noqa: BLE001 — report and stop
            print('  page %d: %s' % (page, str(e)[:80]))
            break
        rows = json.loads(body)
        if not rows:
            break
        out += rows
        total = r.headers.get('X-WP-TotalPages')
        if total and page >= int(total):
            break
        page += 1
    return out


def _text(html):
    """The titles carry entities and the odd tag; only the words are wanted."""
    s = re.sub(r'<[^>]+>', ' ', html or '')
    for a, b in (('&#8211;', '–'), ('&#8212;', '—'), ('&#8217;', '’'),
                 ('&#169;', '©'), ('&copy;', '©'), ('&amp;', '&'),
                 ('&#8220;', '"'), ('&#8221;', '"'), ('&nbsp;', ' ')):
        s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()


def photographer(title, slug):
    """The site writes it into the title: "Samaritans · passover · © Ori Orhof"."""
    m = re.search(r'©\s*(.+?)\s*$', title)
    if m and len(m.group(1)) < 60:
        who = m.group(1).strip(' .·–—')
        if re.search(r'ori\s*orhof', who, re.I):
            return 'אורי אורהוף'
        return who
    if re.search(r'ori[-_ ]?orhof', slug or '', re.I):
        return 'אורי אורהוף'
    return ''


SUBJECT = {
    'passover': 'חג הפסח', 'pesach': 'חג הפסח', 'matzot': 'חג המצות',
    'sukkot': 'חג הסוכות', 'succot': 'חג הסוכות', 'sukkoth': 'חג הסוכות',
    'shavuot': 'חג השבועות', 'pilgrimage': 'עלייה לרגל', 'aliyah': 'עלייה לרגל',
    'gerizim': 'הר גריזים', 'torah': 'ספר התורה', 'pentateuch': 'ספר התורה',
    'prayer': 'תפילה', 'synagogue': 'בית הכנסת', 'lifecycle': 'מעגל החיים',
    'wedding': 'חתונה', 'community': 'הקהילה', 'priest': 'הכהונה',
    'yom-kippur': 'יום הכיפורים',
}


def _useless(s):
    """A caption that is only a copyright line, or a title that is still the
    camera's file name, says nothing about what is in the picture."""
    if not s:
        return True
    if '©' in s or re.match(r'^\s*(?:photo|credit)\b', s, re.I):
        return True
    # 0V1A2925, 48031896336_d125e0a3b7_k, IMG_2371 …
    return bool(re.match(r'^[\w\-.]+$', s) and re.search(r'\d{3,}', s)
                and not re.search(r'[א-ת]', s))


def _subject(title, slug):
    """The photographer's name is not the picture's name. What the site filed
    it under is, and that reads better in Hebrew anyway."""
    plain = re.split(r'©', title)[0].strip(' ·–—-')
    words = re.split(r'[-_ ]+', (slug or '').lower())
    for w in words:
        if w in SUBJECT:
            return SUBJECT[w]
    plain = re.sub(r'^samaritans?\s*[·–—-]\s*', '', plain, flags=re.I).strip(' ·–—-')
    return plain or 'מחיי השומרונים'


def feasts(text):
    out = []
    for pat, ids in TOPIC:
        if re.search(pat, text, re.I):
            out += ids
    return sorted(set(out))


def main():
    print('reading the library at %s …' % SITE)
    rows = library()
    print('  %d entries' % len(rows))
    kept, why = [], {'small': 0, 'kind': 0, 'name': 0}
    for m in rows:
        if (m.get('mime_type') or '') not in KEEP_MIME:
            why['kind'] += 1
            continue
        d = m.get('media_details') or {}
        w, h = d.get('width') or 0, d.get('height') or 0
        if min(w, h) < MIN_SIDE:
            why['small'] += 1
            continue
        slug = m.get('slug') or ''
        title = _text((m.get('title') or {}).get('rendered'))
        alt = _text(m.get('alt_text'))
        cap = _text((m.get('caption') or {}).get('rendered'))
        if SKIP.search(slug) or SKIP.search(title):
            why['name'] += 1
            continue
        who = photographer(title, slug)
        kept.append({
            'src': m.get('source_url'),
            'by': who or 'אתר השומרונים',
            'lic': 'באישור הצלם' if who else 'מאתר the-samaritans.net',
            'ttl': (None if _useless(cap) else cap)
                   or (None if _useless(alt) else alt)
                   or (None if _useless(title) else _subject(title, slug))
                   or _subject(title, slug),
            'source': 'the-samaritans.net',
            'feasts': feasts(' '.join((slug, title, alt, cap))),
            'w': w, 'h': h,
        })

    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, 'data', 'pix_sources.json')
    with io.open(out, 'w', encoding='utf-8') as fh:
        json.dump(kept, fh, ensure_ascii=False, indent=1)

    from collections import Counter
    print('\nkept %d photographs' % len(kept))
    print('left out: %s' % ', '.join('%s %d' % kv for kv in why.items()))
    print('\nby photographer:')
    for k, v in Counter(x['by'] for x in kept).most_common():
        print('   %-28s %d' % (k, v))
    print('\nby feast:')
    named = sum(1 for x in kept if x['feasts'])
    print('   tagged with a feast %d, general %d' % (named, len(kept) - named))
    for k, v in Counter(tuple(x['feasts']) for x in kept if x['feasts']).most_common():
        print('   %-22s %d' % (str(k), v))
    print('\nwrote %s' % out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
