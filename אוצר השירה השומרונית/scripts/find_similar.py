# -*- coding: utf-8 -*-
"""Find recordings that are probably the same performance filed twice.

find_duplicates.py already catches the easy case: the identical file, same
name and same bytes, sitting in two folders. What it cannot see is the same
performance saved under two different names, or transferred twice from the
same tape and encoded slightly differently. Those are what this looks for,
and it looks by two independent signs:

  the clock   two files of exactly the same length, to the second. Across
              2,671 tracks that is rarely coincidence — the same piyyut sung
              on two occasions is practically never the same length twice.

  the name    the same singer, and titles that say the same thing once the
              spelling is normalised. This catches the pair that was
              re-encoded and so differs by a second or two.

Nothing is deleted and nothing is changed. The archive is read and a report
is written; deciding which copy to keep belongs to the editor, not to a
program guessing from a filename.

    py -3 scripts/find_similar.py                 the report
    py -3 scripts/find_similar.py --strict        only the surest pairs
    py -3 scripts/find_similar.py --csv out.csv   all of them, for a spreadsheet
"""
import collections
import csv
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from textutil import skeleton                       # noqa: E402

CATALOG = os.path.join(UNIT, 'data', 'catalog.json')

# words that say nothing about which recording this is
NOISE = re.compile(
    r'\b(?:kaseta|track|audio|side|part|copy|new|old|final|mix|master|'
    r'mp3|wav|m4a|wma)\b|\d+', re.I)
# Besides the filing words, the name of the service a piyyut sits in says
# nothing about which piyyut it is: half the archive is "תפילת בוקר". Two
# different piyyutim from the same morning service share those words and
# nothing else, and comparing on them alone paired האזינו with שבחו.
NOISE_HE = ('קלטת', 'צד', 'רצועה', 'חלק', 'קטע', 'העתק', 'עותק',
            'הקלטה', 'סרט', 'טרק',
            'תפילת', 'תפילה', 'בוקר', 'צהריים', 'צהרים', 'ערבית', 'מנחה',
            'ליל', 'יום', 'שחרית', 'מוסף', 'נעילה')


def norm(s):
    """A title reduced to what it actually says."""
    s = s or ''
    for w in NOISE_HE:
        s = s.replace(w, ' ')
    s = NOISE.sub(' ', s)
    s = skeleton(s) or ''
    return re.sub(r'\s+', ' ', s).strip()


def words(s):
    return {w for w in norm(s).split() if len(w) > 1}


def similar(a, b):
    """How far two titles say the same thing, 0 to 1.

    One word in common is not agreement — it is usually the one word every
    title in the archive shares. Two distinctive words, or a short title
    matching outright, is the least that means anything.
    """
    wa, wb = words(a), words(b)
    if not wa or not wb:
        return 0.0
    shared = wa & wb
    if len(shared) < 2 and not (wa == wb):
        return 0.0
    return len(shared) / len(wa | wb)


def load():
    with io.open(CATALOG, encoding='utf-8') as fh:
        cat = json.load(fh)
    perf = {p['id']: p['name'] for p in cat['performers']}
    ev = {e['id']: e['name'] for e in cat['events']}
    rows = []
    for r in cat['recordings']:
        for t in r['tr']:
            rows.append({
                'rec': r['id'],
                'ttl': r['ttl'],
                'track': (t.get('n') or '').strip(),
                'perf': perf.get(r['p'], ''),
                'event': ev.get(r['e'], ''),
                'secs': int(t.get('s') or 0),
                'f': t.get('f', ''),
            })
    return rows


def mmss(n):
    return '%d:%02d' % (n // 60, n % 60)


def find(rows, strict=False):
    pairs = {}

    def note(a, b, why, weight):
        key = tuple(sorted((a['f'], b['f'])))
        p = pairs.setdefault(key, {'a': a, 'b': b, 'why': set(), 'score': 0})
        p['why'].add(why)
        p['score'] += weight

    named = lambda r: r['perf'] and r['perf'] != 'לא ידוע'

    # 1. the clock — exactly the same number of seconds
    by_len = collections.defaultdict(list)
    for r in rows:
        # Length alone is evidence only when the length is unusual. Two
        # unrelated one-minute tracks share a duration often; two unrelated
        # ten-minute ones almost never do.
        if r['secs'] >= 90:
            by_len[r['secs']].append(r)
    for secs, group in by_len.items():
        if len(group) < 2 or len(group) > 12:   # a crowd at one length is noise
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                if a['rec'] == b['rec']:
                    continue
                same_perf = named(a) and a['perf'] == b['perf']
                sim = similar(a['ttl'] + ' ' + a['track'],
                              b['ttl'] + ' ' + b['track'])
                if same_perf and sim >= 0.5:
                    note(a, b, 'אותו אורך בדיוק (%s), אותו מבצע, ושם דומה' % mmss(secs), 5)
                elif same_perf:
                    note(a, b, 'אותו אורך בדיוק (%s) ואותו מבצע' % mmss(secs), 3)
                elif sim >= 0.6:
                    note(a, b, 'אותו אורך בדיוק (%s) ושם דומה' % mmss(secs), 3)
                elif not strict and secs >= 240:
                    note(a, b, 'אותו אורך בדיוק (%s)' % mmss(secs), 1)

    # 2. the name — same singer, and the titles say the same thing
    by_perf = collections.defaultdict(list)
    for r in rows:
        if named(r):
            by_perf[r['perf']].append(r)
    for group in by_perf.values():
        if len(group) > 600:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                if a['rec'] == b['rec']:
                    continue
                sim = similar(a['ttl'] + ' ' + a['track'],
                              b['ttl'] + ' ' + b['track'])
                if sim < (0.85 if strict else 0.7):
                    continue
                gap = abs(a['secs'] - b['secs'])
                if gap == 0:
                    continue                        # the clock already has it
                if gap <= 3:
                    note(a, b, 'אותו מבצע, שם זהה, הפרש %d שניות' % gap, 4)
                elif not strict and gap <= max(8, min(a['secs'], b['secs']) * 0.02):
                    note(a, b, 'אותו מבצע, שם זהה, הפרש %d שניות' % gap, 2)
    return pairs


def main():
    strict = '--strict' in sys.argv
    csv_path = None
    for i, a in enumerate(sys.argv):
        if a == '--csv' and i + 1 < len(sys.argv):
            csv_path = sys.argv[i + 1]

    rows = load()
    pairs = find(rows, strict)
    ranked = sorted(pairs.values(), key=lambda p: (-p['score'], p['a']['f']))

    print('%d רצועות נבדקו' % len(rows))
    print('%d זוגות חשודים%s\n' % (len(ranked), ' (מצב מחמיר)' if strict else ''))
    tiers = collections.Counter(
        'כמעט ודאי' if p['score'] >= 5 else
        'סביר' if p['score'] >= 3 else 'לבדיקה' for p in ranked)
    for k in ('כמעט ודאי', 'סביר', 'לבדיקה'):
        if tiers.get(k):
            print('   %-12s %d' % (k, tiers[k]))
    print()

    if csv_path:
        with io.open(csv_path, 'w', encoding='utf-8-sig', newline='') as fh:
            w = csv.writer(fh)
            w.writerow(['ודאות', 'סיבה', 'מבצע', 'אורך',
                        'כותרת א', 'קובץ א', 'כותרת ב', 'קובץ ב'])
            for p in ranked:
                a, b = p['a'], p['b']
                w.writerow([p['score'], ' · '.join(sorted(p['why'])), a['perf'],
                            mmss(a['secs']), a['ttl'], a['f'], b['ttl'], b['f']])
        print('נכתב %s\n' % csv_path)

    for n, p in enumerate(ranked[:40], 1):
        a, b = p['a'], p['b']
        print('%2d. %s' % (n, ' · '.join(sorted(p['why']))))
        print('    %-44s  %s' % (a['ttl'][:44], a['perf'][:22]))
        print('        %s' % a['f'][:78])
        print('    %-44s  %s' % (b['ttl'][:44], b['perf'][:22]))
        print('        %s' % b['f'][:78])
    if len(ranked) > 40:
        print('\n…ועוד %d. --csv כותב את כולם לגיליון.' % (len(ranked) - 40))
    return 0


if __name__ == '__main__':
    sys.exit(main())
