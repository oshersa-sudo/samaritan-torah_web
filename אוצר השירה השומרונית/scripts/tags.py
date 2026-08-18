# -*- coding: utf-8 -*-
"""What a sound file says about itself, and what its name says.

The agreed way of filing a recording is that the file carries its own
particulars: the name it is saved under is the piyyut, the singer is in the
file's tags where whoever digitised it put one, and the feast is written into
the name. This module reads all three and hands back what it found — never a
guess dressed as a fact: where a tag is absent it says so, and the singer
comes back empty rather than invented.

Tags are read with ffprobe, which is already needed for durations, so no
further library has to be installed. If mutagen happens to be there it is
preferred, because it reads a few odd old tags ffprobe skips.
"""
import json
import os
import re
import subprocess

# the feasts, and what a file name might call them. Longest first, so that
# "חג המצות" is not swallowed by "מצות" inside another word.
FEASTS = [
    ('חג הפסח',            r'פסח|pesa?ch|passover|קרבן'),
    ('חג המצות',           r'המצות|מצות|matzot'),
    ('חג השבועות',         r'שבועות|shavu|pentecost'),
    ('מעמד הר סיני',       r'הר סיני|sinai'),
    ('ראש החודש השביעי',   r'ראש החודש|השביעי|new ?year|ר״ח|ר"ח'),
    ('יום הכיפורים',       r'כיפור|kippur|atonement'),
    ('חג הסוכות',          r'סוכות|סוכה|sukk?ot|sukkoth|succot|tabernacle'),
    ('שמיני עצרת',         r'שמיני עצרת|שמחת תורה|simchat'),
    ('עלייה לרגל',         r'עלייה לרגל|עליה לרגל|pilgrim|הר גריזים|gerizim'),
    ('שבת הסליחות',        r'סליחות|selichot'),
    ('שבת',                r'\bשבת\b|shabbat|sabbath'),
    ('קריאה בתורה',        r'קריאה בתורה|קריאת התורה|torah reading'),
    ('שמחות',              r'חתונה|חתנה|נישואין|wedding|בר מצוה|בר מצווה|ברית'),
    ('ראיונות ודברי הסבר', r'ראיון|ראיונות|הסבר|הרצאה|interview|lecture'),
    ('מועדים',             r'\bמועד\b|מועדים'),
    ('ימי חול',            r'ימי חול|יום חול|weekday'),
]

# what to strip out of a file name before it is used as a title
NOISE = re.compile(
    r'^\s*\d{1,3}\s*(?=[א-ת])'                # "19בן פרת יוסף" — no separator
    r'|^\s*\d{1,3}\s*[-_.]\s*'                # or with one
    r'|\b(?:audio ?track|track)\s*\d+\b'
    r'|\b\d{6,}\b'                            # a camera or phone stamp
    r'|\b(?:mp3|wav|m4a|wma|copy|final|new|mix(?:down)?|master)\b'
    r'|[\[\(](?:[^\]\)]{0,24})[\]\)]',        # a short bracketed aside
    re.I)


def _ffprobe(path):
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries',
             'format=duration:format_tags=artist,album_artist,title,album,date,'
             'comment,composer,performer',
             '-of', 'json', path],
            capture_output=True, text=True, timeout=60, encoding='utf-8').stdout
        return json.loads(out or '{}').get('format', {}) or {}
    except Exception:                               # noqa: BLE001
        return {}


def _mutagen(path):
    try:
        from mutagen import File as MFile
        f = MFile(path, easy=True)
        if not f:
            return {}
        got = {}
        for k in ('artist', 'albumartist', 'title', 'album', 'date',
                  'composer', 'performer'):
            v = f.get(k)
            if v:
                got[k] = v[0] if isinstance(v, list) else str(v)
        if getattr(f, 'info', None) and getattr(f.info, 'length', 0):
            got['duration'] = f.info.length
        return got
    except Exception:                               # noqa: BLE001
        return {}


def clean_title(name):
    """The file's name, made into something worth printing on a label."""
    s = os.path.splitext(os.path.basename(name))[0]
    s = s.replace('_', ' ')
    s = NOISE.sub(' ', s)
    s = re.sub(r'\s*[-–—]\s*$', '', s)
    s = re.sub(r'\s{2,}', ' ', s).strip(' -–—.·')
    return s


def feast_of(text):
    """The feast a name points at, or nothing where it points at none."""
    for name, pat in FEASTS:
        if re.search(pat, text, re.I):
            return name
    return ''


def read(path):
    """Everything known about one file, from its tags and from its name.

    performer is '' when nothing said who sang — never a guess.
    """
    tags = _mutagen(path)
    if not tags.get('artist') and not tags.get('title'):
        fmt = _ffprobe(path)
        t = {k.lower(): v for k, v in (fmt.get('tags') or {}).items()}
        tags.setdefault('artist', t.get('artist') or t.get('performer') or '')
        tags.setdefault('albumartist', t.get('album_artist', ''))
        tags.setdefault('title', t.get('title', ''))
        tags.setdefault('album', t.get('album', ''))
        tags.setdefault('date', t.get('date', ''))
        tags.setdefault('composer', t.get('composer', ''))
        if fmt.get('duration'):
            tags['duration'] = float(fmt['duration'])

    name = os.path.basename(path)
    who = (tags.get('artist') or tags.get('albumartist')
           or tags.get('performer') or tags.get('composer') or '').strip()
    # a tag that is only the file's own name says nothing about a singer
    if who and clean_title(who).lower() == clean_title(name).lower():
        who = ''

    # The name of the file is the title. That is the agreed way of filing, and
    # it is also the truer one: the title tag on an old transfer is as often as
    # not the tape it was copied from — "Y - 06901 - DAT" — while the name is
    # what somebody sat down and typed about the recording.
    title = clean_title(name)
    return {
        'title':     title or 'ללא שם',
        'tag_title': clean_title(tags.get('title') or ''),
        'performer': who,
        'event':     feast_of(name + ' ' + (tags.get('album') or '')),
        'year':      (re.search(r'(1[89]\d\d|20\d\d)',
                                (tags.get('date') or '') + ' ' + name) or [''])[0]
                     if re.search(r'(1[89]\d\d|20\d\d)',
                                  (tags.get('date') or '') + ' ' + name) else '',
        'seconds':   int(float(tags.get('duration') or 0)),
        'from_tags': bool(who),
    }


if __name__ == '__main__':
    import sys
    for p in sys.argv[1:]:
        print(p)
        for k, v in read(p).items():
            print('   %-10s %s' % (k, v))
