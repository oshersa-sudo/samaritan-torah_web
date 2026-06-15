# -*- coding: utf-8 -*-
"""
Download Jewish commentary from Sefaria and attach it to each verse (Jewish
chapter/verse division) in data/torah.db.

Commentators -> verses.<column>:
    Rashi          -> rashi
    Ramban         -> ramban
    Cassuto        -> cassuto        (Genesis & Exodus only; he wrote no more)
    Ba'al HaTurim  -> baal_haturim

Method (verified verse-accurate):
  * Rashi / Ramban / Ba'al HaTurim: chapter text API  {Title}_on_{Book}.{ch}?pad=0
    -> `he[i]` are the comments anchored to verse i+1 (pad=0 returns the full
       chapter; without it the API collapses to verse 1 only).
  * Cassuto (complex/essay structure): chapter links API, keeping ONLY links
    whose type == 'commentary' (the primary, verse-anchored comment). "Quoting
    Commentary" cross-references are discarded -- they are mis-anchored.

Usage:
    py import_sefaria_commentary.py <book|all> [ch_start] [ch_end] [--force]
Resumable: cells already non-NULL are skipped (chapter skipped entirely when
already complete) unless --force is given.
"""
import os, sys, re, json, time, sqlite3, urllib.request, urllib.error

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
sys.stdout.reconfigure(encoding='utf-8')

BOOK_EN = {'בראשית': 'Genesis', 'שמות': 'Exodus', 'ויקרא': 'Leviticus',
           'במדבר': 'Numbers', 'דברים': 'Deuteronomy'}
# Note: Sefaria's full "Ba'al HaTurim" Hebrew is largely empty; the complete,
# verse-mapped Baal HaTurim remazim text (as printed in chumashim) is its
# "Kitzur Ba'al HaTurim" index -> used for the baal_haturim column.
DIRECT = {'rashi': 'Rashi_on_%s', 'ramban': 'Ramban_on_%s',
          'baal_haturim': 'Kitzur_Baal_HaTurim_on_%s'}
CASSUTO_BOOKS = {'Genesis', 'Exodus'}
COLS = ['rashi', 'ramban', 'cassuto', 'baal_haturim']

_TAG = re.compile(r'<[^>]+>')
_UA = {'User-Agent': 'Mozilla/5.0 (SamaritanTorahApp commentary import)'}
_ANCHOR = re.compile(r':(\d+)(?:-(\d+))?\s*$')


def ensure_columns(conn):
    have = {x[1] for x in conn.execute("PRAGMA table_info(verses)")}
    for col in COLS:
        if col not in have:
            conn.execute("ALTER TABLE verses ADD COLUMN %s TEXT" % col)
    conn.commit()


def get(url, tries=4):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=_UA)
            return json.loads(urllib.request.urlopen(req, timeout=90).read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 400:
                return None
            last = e
        except Exception as e:
            last = e
        time.sleep(1.5 + i)
    raise last


def strip_html(s):
    if isinstance(s, list):
        s = ' '.join(strip_html(x) for x in s)
    if not isinstance(s, str):
        return ''
    s = s.replace('<br>', '\n').replace('<br/>', '\n').replace('<br />', '\n')
    s = _TAG.sub('', s)
    s = s.replace('&nbsp;', ' ').replace('&thinsp;', ' ').replace('&amp;', '&')
    return re.sub(r'[ \t]+', ' ', s).strip()


def flatten(x):
    out = []
    if isinstance(x, list):
        for i in x:
            out.extend(flatten(i))
    elif isinstance(x, str) and x.strip():
        out.append(x)
    return out


def chapter_text(title_en, ch):
    """Return {verse_number: joined_text} for a whole chapter (pad=0)."""
    url = 'https://www.sefaria.org/api/texts/%s.%d?context=0&commentary=0&pad=0' % (title_en, ch)
    d = get(url)
    res = {}
    if not d:
        return res
    he = d.get('he') or []
    if not isinstance(he, list):
        he = [he]
    for i, item in enumerate(he):
        parts = [strip_html(p) for p in flatten(item)]
        parts = [p for p in parts if p]
        if parts:
            res[i + 1] = '\n'.join(parts)
    return res


def cassuto_chapter(book_en, ch):
    """Return {verse_number: joined_text} for Cassuto over a whole chapter."""
    links = get('https://www.sefaria.org/api/links/%s.%d?with_text=0' % (book_en, ch))
    if not links:
        return {}
    by_vs = {}
    for L in links:
        it = L.get('index_title') or ''
        if not (it.startswith('Cassuto on') and L.get('type') == 'commentary'):
            continue
        anchor = L.get('anchorRef') or ''
        m = _ANCHOR.search(anchor)
        if not m:
            continue
        v1 = int(m.group(1))
        v2 = int(m.group(2)) if m.group(2) else v1
        sr = L.get('sourceRef') or L.get('ref')
        for v in range(v1, v2 + 1):
            by_vs.setdefault(v, [])
            if sr not in by_vs[v]:
                by_vs[v].append(sr)

    cache = {}
    out = {}
    for v, refs in by_vs.items():
        parts = []
        for sr in refs:
            if sr not in cache:
                ref_url = sr.replace(' ', '_').replace(':', '.')
                d = get('https://www.sefaria.org/api/texts/%s?context=0&commentary=0' % ref_url)
                cache[sr] = '\n'.join(strip_html(p) for p in flatten(d.get('he') or [])) if d else ''
                time.sleep(0.1)
            if cache[sr]:
                parts.append(cache[sr])
        if parts:
            out[v] = '\n'.join(parts)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv
    only = None
    for a in sys.argv[1:]:
        if a.startswith('--only='):
            only = [c.strip() for c in a.split('=', 1)[1].split(',') if c.strip()]
    active = only if only else COLS
    if not args:
        print(__doc__)
        return
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    ensure_columns(conn)

    books = list(BOOK_EN.items()) if args[0] == 'all' else [(args[0], BOOK_EN[args[0]])]
    ch_start = int(args[1]) if len(args) > 1 else 1
    ch_end = int(args[2]) if len(args) > 2 else 9999

    for book_he, book_en in books:
        maxch = conn.execute("""SELECT MAX(c.number) FROM verses v
            JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id
            WHERE b.name=?""", (book_he,)).fetchone()[0] or 0
        for ch in range(ch_start, min(ch_end, maxch) + 1):
            rows = conn.execute("""SELECT v.id, v.number vs,
                    v.rashi, v.ramban, v.cassuto, v.baal_haturim
                FROM verses v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id
                WHERE b.name=? AND c.number=? ORDER BY v.number""", (book_he, ch)).fetchall()
            if not rows:
                continue
            want = {c: (c in active and (book_en in CASSUTO_BOOKS if c == 'cassuto' else True))
                    for c in COLS}
            if not force and all(
                    (r[c] is not None) for r in rows for c in COLS if want[c]):
                print('%s %d: complete, skip' % (book_he, ch))
                continue

            data = {c: {} for c in COLS}
            for col in ('rashi', 'ramban', 'baal_haturim'):
                if want[col]:
                    data[col] = chapter_text(DIRECT[col] % book_en, ch)
                    time.sleep(0.1)
            if want['cassuto']:
                data['cassuto'] = cassuto_chapter(book_en, ch)

            updated = 0
            for r in rows:
                sets, vals = [], []
                for col in COLS:
                    if not want[col]:
                        continue
                    if r[col] is not None and not force:
                        continue
                    sets.append('%s=?' % col)
                    vals.append(data[col].get(r['vs']))
                if sets:
                    conn.execute('UPDATE verses SET %s WHERE id=?' % ', '.join(sets),
                                 vals + [r['id']])
                    updated += 1
            conn.commit()
            cov = {c: sum(1 for r in rows if data[c].get(r['vs'])) for c in COLS}
            print('%s %d: verses=%d updated=%d  rashi=%d ramban=%d cassuto=%d baal=%d'
                  % (book_he, ch, len(rows), updated,
                     cov['rashi'], cov['ramban'], cov['cassuto'], cov['baal_haturim']))
    conn.close()
    print('DONE')


if __name__ == '__main__':
    main()
