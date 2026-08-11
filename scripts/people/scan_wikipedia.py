# -*- coding: utf-8 -*-
"""Look for a Wikipedia article for every figure in the people unit.

The unit's Wikipedia panel started from a hand-listed seven. This asks Wikipedia
itself, in Hebrew, English and Arabic, for every figure the unit holds, and writes
the candidates out for review — it does not decide. Samaritan names are ambiguous
enough ("Marqe", "Abisha", "Pinhas") that an automatic top-hit would attach the
wrong article to a man often enough to matter, so the reviewer confirms each.

Output: data/people/wiki_candidates.json — {id: {lang: [{title, snippet, score}]}}

  py -3 scripts/people/scan_wikipedia.py
"""
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.parse

_ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DB = os.path.join(_ROOT, 'data', 'torah.db')
OUT = os.path.join(_ROOT, 'data', 'people', 'wiki_candidates.json')
UA = 'SamaritanTorahApp/1.0 (https://samaritan-torah.onrender.com; oshersa@gmail.com)'


def _search(lang, term):
    url = ('https://%s.wikipedia.org/w/api.php?%s' % (lang, urllib.parse.urlencode({
        'action': 'query', 'list': 'search', 'srsearch': term, 'srlimit': '4',
        'format': 'json', 'formatversion': '2'})))
    r = subprocess.run(['curl', '-sS', '--max-time', '30', '-A', UA, url], capture_output=True)
    if r.returncode != 0:
        return []
    try:
        d = json.loads(r.stdout.decode('utf-8'))
    except ValueError:
        return []
    return d.get('query', {}).get('search', [])


_STRIP = re.compile(r'[\(\[].*?[\)\]]|["׳’\']')


def _clean(name):
    """Drop the parenthetical gloss and quotes — 'אבישע "בעל הימימרים"' searches badly."""
    return _STRIP.sub(' ', name or '').strip()


def _overlap(a, b):
    """Crude token overlap, enough to rank an obviously-right title above noise."""
    ta = {w for w in re.split(r'\W+', (a or '').lower()) if len(w) > 2}
    tb = {w for w in re.split(r'\W+', (b or '').lower()) if len(w) > 2}
    return len(ta & tb) / max(1, min(len(ta), len(tb)))


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT id, name_he, name_en, name_ar, wikipedia_json FROM people ORDER BY ord').fetchall()
    conn.close()

    out = {}
    for i, r in enumerate(rows, 1):
        have = json.loads(r['wikipedia_json'] or '{}')
        cand = {}
        for lang, name in (('he', r['name_he']), ('en', r['name_en']), ('ar', r['name_ar'])):
            if lang in have:                      # already settled
                continue
            term = _clean(name)
            if not term:
                continue
            hits = []
            for h in _search(lang, term):
                hits.append({'title': h['title'],
                             'snippet': re.sub(r'<[^>]+>', '', h.get('snippet', '')),
                             'score': round(_overlap(term, h['title']), 2)})
            time.sleep(0.15)
            if hits:
                cand[lang] = hits
        if cand:
            out[r['id']] = {'name_he': r['name_he'], 'name_en': r['name_en'], 'candidates': cand}
        print('%3d/%d %-46s %s' % (i, len(rows), r['name_he'],
                                   ' '.join('%s:%d' % (l, len(v)) for l, v in cand.items()) or '-'))
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('\ncandidates for %d of %d figures -> %s' % (len(out), len(rows), os.path.relpath(OUT, _ROOT)))


if __name__ == '__main__':
    main()
