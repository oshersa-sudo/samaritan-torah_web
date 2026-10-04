# -*- coding: utf-8 -*-
"""Build the boot patch that carries the printed book's vocalization to the site.

The dataset gives, for every verse, the same text with the book's marks written
after each letter (`typed`) and the same again after the drawing rules that keep
the marks clear of a tall ל (`display`). Stripping the marks from either returns
the verse exactly — checked here before anything is written, because the whole
point is that the Torah text itself is never touched.

Each row carries the text the marks were made for, so the patch can refuse to
attach them to a verse whose wording has since changed.

Usage:  py -3 scripts/nikud/build_patch.py [path to samaritan-torah-nikud.json]
"""
import hashlib, io, json, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = (sys.argv[1] if len(sys.argv) > 1 else
       os.path.join(ROOT, 'data', 'nikud', 'samaritan-torah-nikud.json'))
OUT = os.path.join(ROOT, 'data', 'nikud_patch.json')

# the mark keys: digits and capitals, the raised/spacing copies in the private use
# area, and the right-to-left mark that precedes a mark said before its letter
MARK = re.compile('[0-9A-Z-‏]')

def main():
    data = json.load(io.open(SRC, encoding='utf-8'))
    verses = data['verses']
    rows, empty, broken = [], 0, []
    for x in verses:
        disp, typed, heb = (x.get('display') or ''), (x.get('typed') or ''), x.get('hebrew') or ''
        if not disp.strip():
            empty += 1
            continue
        if MARK.sub('', disp) != heb or MARK.sub('', typed) != heb:
            broken.append('%s %s:%s' % (x.get('book_name'), x.get('chapter'), x.get('verse')))
            continue
        rows.append({'v': x['id'], 'h': heb, 'd': disp, 't': typed})
    if broken:
        print('  !! %d rows where stripping the marks does not return the verse:' % len(broken))
        for b in broken[:10]:
            print('     ', b)
        raise SystemExit('refusing to build a patch that would alter the text')

    fp = hashlib.sha1(json.dumps([(r['v'], r['d']) for r in rows],
                                 ensure_ascii=False).encode('utf-8')).hexdigest()
    io.open(OUT, 'w', encoding='utf-8').write(json.dumps(
        {'fingerprint': fp, 'source': data.get('font') or 'SamNikud', 'rows': rows},
        ensure_ascii=False))
    per = {}
    for x in verses:
        if (x.get('display') or '').strip():
            per[x.get('book_name')] = per.get(x.get('book_name'), 0) + 1
    print('  %d verses with marks (%d without), stripping verified on every one' % (len(rows), empty))
    for b, n in per.items():
        print('     %-8s %5d' % (b, n))
    print('  %s  %.1f MB  %s' % (os.path.basename(OUT), os.path.getsize(OUT) / 1048576, fp[:12]))

if __name__ == '__main__':
    main()
