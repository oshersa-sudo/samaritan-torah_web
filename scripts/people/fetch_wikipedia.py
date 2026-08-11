# -*- coding: utf-8 -*-
"""Fetch the Wikipedia article for each Samaritan figure in the people unit.

The project owner asked for the material to be carried "in full". Rather than
translate one language's article into the other two, this resolves each figure's
article in Hebrew, English and Arabic through Wikipedia's own langlinks — so a
reader gets the article the Wikipedia community wrote in his own language, and
only falls back to another language where none exists.

Text is fetched as plain text (prop=extracts&explaintext), which drops the
infoboxes, footnote markers and navigation and keeps the prose and its section
headings. Wikipedia is CC BY-SA 4.0, so the article title, its URL and the
licence travel with the text and the reader is shown all three.

Network goes through curl: this machine's Python has a stale CA bundle and
rejects Wikipedia's certificate.

  py -3 scripts/people/fetch_wikipedia.py            # dry-run: what exists, how long
  py -3 scripts/people/fetch_wikipedia.py --apply    # write data/people/wikipedia.json
"""
import json
import os
import subprocess
import sys
import urllib.parse

_ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(_ROOT, 'data', 'people', 'wikipedia.json')
UA = 'SamaritanTorahApp/1.0 (https://samaritan-torah.onrender.com; oshersa@gmail.com)'
LANGS = ('he', 'en', 'ar')

# The Samaritan figures of the unit that have a Wikipedia article, with one known
# article each as the seed; the others are resolved from its langlinks.
SEED = {
    'simon_magus':              ('en', 'Simon Magus'),
    'baba_rabba':               ('en', 'Baba Rabba'),
    'marqe':                    ('en', 'Marqah'),
    'marinus_philosopher':      ('en', 'Marinus of Neapolis'),
    'abu_lfath_ibn_abi_lhasan': ('en', "Abu'l-Fath"),
    'aharon_ben_manir':         ('he', 'אהרן בן מניר'),
    'dustan_dositheus':         ('en', 'Dositheos (Samaritan)'),
    # added at the owner's request, from the Hebrew article he pointed at
    'ibrahim_al_ayya':          ('he', 'אברהם בן יעקב הדנפי'),
    # Confirmed by scripts/people/scan_wikipedia.py and then checked one by one
    # against each article's opening lines — the search alone offered a serial
    # killer for Rogers, a US senator for Robertson and St James for Marhib.
    'alexander_the_great_and_samaritans': ('en', 'Alexander the Great'),
    'john_hyrcanus':            ('en', 'John Hyrcanus'),
    'postel_guillaume':         ('en', 'Guillaume Postel'),
    'sancy_achille':            ('en', 'Achille de Harlay de Sancy'),
    'morin_jean':               ('en', 'Jean Morin (theologian)'),
    'castell_edmund':           ('en', 'Edmund Castell'),
    'hottinger_johann':         ('en', 'Johann Heinrich Hottinger'),
    'huntington_robert':        ('en', 'Robert Huntington'),
    'marsh_narcissus':          ('en', 'Narcissus Marsh'),
    'ecchellensis_abraham':     ('en', 'Abraham Ecchellensis'),
    'kennicott_benjamin':       ('en', 'Benjamin Kennicott'),
    'gesenius_wilhelm':         ('en', 'Wilhelm Gesenius'),
    'firkowicz_abraham':        ('he', "אברהם פירקוביץ'"),
    'petermann_julius':         ('en', 'Julius Heinrich Petermann'),
    'payne_smith_robert':       ('en', 'Robert Payne Smith'),
    'guerin_victor':            ('en', 'Victor Guérin'),
    'harkavy_abraham':          ('he', 'אברהם אליהו הרכבי'),
    'conder_claude':            ('en', 'Claude Reignier Conder'),
    'gaster_moses':             ('en', 'Moses Gaster'),
    'adler_elkan_nathan':       ('en', 'Elkan Nathan Adler'),
    'cowley_arthur':            ('en', 'Arthur Ernest Cowley'),
    'yellin_david':             ('en', 'David Yellin'),
    'montgomery_ja':            ('en', 'James Alan Montgomery'),
    'gall_august_georg':        ('en', 'August von Gall'),
    'kahle_paul':               ('en', 'Paul E. Kahle'),
    'yahuda_abraham_shalom':    ('en', 'Abraham Yahuda'),
    'robertson_edward':         ('en', 'Edward Robertson (Semitic scholar)'),
    'ben_zvi_yishaq':           ('en', 'Yitzhak Ben-Zvi'),
    'jeremias_joachim':         ('en', 'Joachim Jeremias'),
    'halkin_abraham':           ('en', 'Abraham Halkin'),
}


def _get(lang, params):
    params = dict(params, format='json', formatversion='2')
    url = 'https://%s.wikipedia.org/w/api.php?%s' % (lang, urllib.parse.urlencode(params))
    r = subprocess.run(['curl', '-sS', '--max-time', '60', '-A', UA, url],
                       capture_output=True)
    if r.returncode != 0:
        raise RuntimeError('curl failed for %s: %s' % (url, r.stderr.decode('utf-8', 'replace')[:200]))
    return json.loads(r.stdout.decode('utf-8'))


def resolve_titles(lang, title):
    """{lang: title} for every one of he/en/ar that has this article."""
    out = {lang: title}
    d = _get(lang, {'action': 'query', 'prop': 'langlinks', 'titles': title, 'lllimit': '500'})
    pg = d.get('query', {}).get('pages', [{}])[0]
    for l in pg.get('langlinks', []):
        if l['lang'] in LANGS:
            out[l['lang']] = l['title']
    return out


def fetch_extract(lang, title):
    """The article as plain text, with its canonical URL."""
    # exsectionformat=wiki marks headings as "== X ==", so the reader's panel can
    # render them as headings instead of guessing which short lines are titles
    d = _get(lang, {'action': 'query', 'prop': 'extracts|info', 'titles': title,
                    'explaintext': '1', 'exsectionformat': 'wiki', 'inprop': 'url'})
    pg = d.get('query', {}).get('pages', [{}])[0]
    if pg.get('missing') or not pg.get('extract'):
        return None
    return {'title': pg.get('title', title), 'url': pg.get('fullurl', ''),
            'text': _drop_empty_sections(pg['extract'].strip())}


def _drop_empty_sections(text):
    """Keep every section that carries prose. The apparatus sections (footnotes,
    external links) come through the extractor as a heading with nothing under it,
    so they would render as a bare title; nothing with content is removed."""
    out, buf, heading = [], [], None
    def flush():
        if heading is None:
            out.extend(buf)
        elif any(l.strip() for l in buf):
            out.append(heading)
            out.extend(buf)
    for line in text.split('\n'):
        if line.startswith('==') and line.rstrip().endswith('=='):
            flush()
            heading, buf = line, []
        else:
            buf.append(line)
    flush()
    return '\n'.join(out).strip()


def main(apply):
    data = {}
    for pid, (lang, title) in SEED.items():
        titles = resolve_titles(lang, title)
        arts = {}
        for l in LANGS:
            if l not in titles:
                continue
            a = fetch_extract(l, titles[l])
            if a and len(a['text']) > 200:      # a stub is not worth a panel
                arts[l] = a
        data[pid] = arts
        print('%-26s %s' % (pid, ' · '.join(
            '%s %d words' % (l, len(arts[l]['text'].split())) for l in LANGS if l in arts) or '(none)'))
    if not apply:
        print('\nDRY-RUN (pass --apply to write %s)' % os.path.relpath(OUT, _ROOT))
        return
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print('\nwritten to %s' % os.path.abspath(OUT))


if __name__ == '__main__':
    main('--apply' in sys.argv)
