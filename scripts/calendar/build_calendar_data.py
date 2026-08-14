# -*- coding: utf-8 -*-
"""Bake the Samaritan calendar into static files the Torah app can read offline.

The reckoning itself is NOT reimplemented here — it is the engine of the
samaritan_calendar project (engine/year_calendar.py), the same one behind
sam-calendar.the-samaritans.net. This script runs it once per Gregorian year and
writes what the app needs: for every day, its day-of-month in Hebrew letters, the
month it falls in, and any event on it; and for every Sabbath, the portion read
that week, already matched to the portion row in torah.db.

Baked rather than fetched live so that the app keeps telling the reader the date
and the portion when the phone is offline, and so the calendar site is never on
the critical path of opening the Torah.

usage:  py -3 scripts/calendar/build_calendar_data.py [--from 2025] [--to 2036]
        --engine <path>   (default: ../samaritan_calendar beside this repo)
"""
import argparse, datetime, io, json, os, re, sqlite3, sys

sys.stdout.reconfigure(encoding='utf-8')
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(_ROOT, 'web', 'static', 'data', 'calendar')
DB = os.path.join(_ROOT, 'data', 'torah.db')


_FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}


def norm(s):
    """The two projects spell some names differently — לכ לך against לך לך, אל לבו
    against אל ליבו — so they are compared with final forms folded and the marks
    and spaces dropped."""
    s = ''.join(_FIN.get(c, c) for c in (s or ''))
    return re.sub(r'[\s\'"׳״־-]', '', s)


def portion_map():
    """Engine name → our portion row.

    Four of the five books hold the same portions in the same order in both
    projects, so they are matched BY POSITION — exact even where the two carry
    different names for the same portion (the engine's 'ואל אהרן' is our 'החדש
    הזה'). Genesis alone has two lists, regular and leap, against our single list
    of twenty, so there the names themselves are matched: equal first, then one
    being the opening of the other ('ויוסף הורד' → 'ויוסף הורד מצרימה')."""
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    ours = {b: [dict(r) for r in conn.execute(
        "SELECT id, book_id, name, order_n FROM portions WHERE book_id=? AND mode='samaritan' "
        "ORDER BY order_n", (b,))] for b in (1, 2, 3, 4, 5)}
    books = {r['id']: r['name'] for r in conn.execute('SELECT id, name FROM books')}
    conn.close()

    from engine import parashot as P
    out = {}
    for book, lst in ((2, P.EXODUS), (3, P.LEVITICUS), (4, P.NUMBERS), (5, P.DEUT)):
        if len(lst) != len(ours[book]):
            print('אזהרה: %s — %d פרשות במנוע מול %d אצלנו, אין מיפוי לפי מיקום'
                  % (books.get(book), len(lst), len(ours[book])))
            continue
        for i, nm in enumerate(lst):
            out[norm(nm)] = ours[book][i]
    skel = lambda s: re.sub(r'[אהוי]', '', norm(s))     # last resort: the consonants alone
    for nm in dict.fromkeys(list(P.GENESIS_REG) + list(P.GENESIS_LEAP) + ['בן פרת']):
        k = norm(nm)
        hit = next((r for r in ours[1] if norm(r['name']) == k), None)
        if not hit:      # one name opening the other: 'ויוסף הורד' → 'ויוסף הורד מצרימה'
            c = [r for r in ours[1] if norm(r['name']).startswith(k) or k.startswith(norm(r['name']))]
            hit = max(c, key=lambda r: len(norm(r['name']))) if c else None
        if not hit:      # a spelling that differs inside the word: 'אל לבו' → 'אל ליבו'
            c = [r for r in ours[1] if skel(r['name']) == skel(nm)]
            hit = c[0] if len(c) == 1 else None
        if hit:
            out[k] = hit
    return out, ours, books


def main():
    ap = argparse.ArgumentParser()
    this_year = datetime.date.today().year
    ap.add_argument('--from', dest='y0', type=int, default=this_year - 1)
    ap.add_argument('--to', dest='y1', type=int, default=this_year + 10)
    ap.add_argument('--engine', default=os.path.join(os.path.dirname(_ROOT), 'samaritan_calendar'))
    a = ap.parse_args()

    if not os.path.isdir(a.engine):
        sys.exit('לא נמצא מנוע הלוח: %s' % a.engine)
    sys.path.insert(0, a.engine)
    from engine.year_calendar import samaritan_year          # noqa: E402

    pmap, ours, books = portion_map()
    os.makedirs(OUT_DIR, exist_ok=True)
    unmatched, index = {}, {}

    for gy in range(a.y0, a.y1 + 1):
        y = samaritan_year(gy)
        days, shabbat = {}, {}
        for mo in y['months']:
            # 'החדש הרביעי · ראש המופתים' → the month is 'הרביעי', the rest is a label
            nm = mo['name']
            nm = nm[len('החדש '):] if nm.startswith('החדש ') else nm
            month, _, extra = nm.partition(' · ')
            for rec in mo['days']:
                evs, parasha = [], None
                if extra:
                    evs.append(extra.strip())
                for f in rec.get('festivals') or []:
                    if f.get('kind') == 'parasha':
                        parasha = f.get('name')
                    elif f.get('name'):
                        evs.append(f['name'])
                d = {'d': rec['heb_label'], 'm': month.strip()}
                if evs:
                    d['ev'] = evs
                days[rec['greg']] = d
                if parasha:
                    p = pmap.get(norm(parasha.split('+')[0].strip()))
                    if not p:
                        unmatched[parasha] = unmatched.get(parasha, 0) + 1
                    shabbat[rec['greg']] = {'p': parasha,
                                            'id': p['id'] if p else None,
                                            'book': p['book_id'] if p else None,
                                            'book_name': books.get(p['book_id']) if p else None,
                                            'name': p['name'] if p else parasha}
        path = os.path.join(OUT_DIR, '%d.json' % gy)
        with io.open(path, 'w', encoding='utf-8', newline='') as f:
            # canaan: the year of the entry into Canaan for THIS Samaritan year — one
            # value for the whole file, since a file is exactly one Samaritan year
            # (Abib to Abib), not a Gregorian one
            json.dump({'year': gy, 'canaan': y['canaan_year'], 'days': days, 'shabbat': shabbat},
                      f, ensure_ascii=False, separators=(',', ':'))
        index[gy] = {'days': len(days), 'shabbatot': len(shabbat),
                     'kb': round(os.path.getsize(path) / 1024.0, 1)}
        print('%d → %s  (%d ימים · %d שבתות · %.1f KB)'
              % (gy, os.path.basename(path), index[gy]['days'], index[gy]['shabbatot'], index[gy]['kb']))

    with io.open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf-8', newline='') as f:
        json.dump({'from': a.y0, 'to': a.y1,
                   'generated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
                   'source': 'samaritan_calendar/engine/year_calendar.py'}, f, ensure_ascii=False)
    print('\nסה"כ %d שנים, %.1f KB' % (len(index), sum(v['kb'] for v in index.values())))
    if unmatched:
        print('שמות פרשה שלא נמצאה להם התאמה בטבלת הפרשות:')
        for k, n in sorted(unmatched.items(), key=lambda x: -x[1]):
            print('   %-22s x%d' % (k, n))
    else:
        print('כל שמות הפרשות הותאמו לטבלת הפרשות שבמסד.')


if __name__ == '__main__':
    main()
