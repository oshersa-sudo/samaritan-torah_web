# -*- coding: utf-8 -*-
"""Find files that are the same recording filed twice, and pick which copy wins.

Matching on file name alone is wrong here — "AudioTrack 04.mp3" occurs in
dozens of unrelated folders — so a candidate must share name *and* byte size,
and is then confirmed by hashing its head and tail. That check matters: of 730
name+size candidates, one pair really is two different recordings.

Writes data/duplicates.json: {redundant_rel: kept_rel}.
"""
import os, sys, io, json, hashlib, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vocab import PERFORMERS, EVENTS

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
D    = lambda *p: os.path.join(HERE, '..', 'data', *p)
ROOT = r'G:\שומרונים ומסורת- תיקייה חשובה מאד\שיראן'

CANON_PERF = {p.lower() for p in PERFORMERS}
EVENT_WORDS = {a.lower() for als in EVENTS.values() for a in als} | \
              {e.lower() for e in EVENTS}

inv = json.load(open(D('raw_inventory.json'), encoding='utf-8'))


def part_hash(rel):
    """MD5 of the first and last 256KB — conclusive for audio, and cheap."""
    p = os.path.join(ROOT, rel.replace('/', os.sep))
    h = hashlib.md5()
    size = os.path.getsize(p)
    with open(p, 'rb') as f:
        h.update(f.read(262144))
        if size > 262144:
            f.seek(max(0, size - 262144))
            h.update(f.read(262144))
    return h.hexdigest()


def score(r):
    """Prefer the copy filed where it is best described."""
    dirs = r['dirs']
    s = 0
    if dirs and dirs[0].lower() in CANON_PERF:
        s += 4                                   # אושר ששוני beats the alias אושר
    s += 3 * sum(1 for d in dirs if d.lower() in EVENT_WORDS)   # festival context
    s += len(dirs)                               # a deeper filing says more
    return (s, len(r['rel']))


groups = collections.defaultdict(list)
for r in inv:
    groups[(r['name'] + r['ext'], r['size'])].append(r)
cand = {k: v for k, v in groups.items() if len(v) > 1}
print('candidates (same name + size): %d groups' % len(cand))

cache = {}
if os.path.exists(D('hash_cache.json')):
    cache = json.load(open(D('hash_cache.json'), encoding='utf-8'))

dup_map, confirmed, rejected = {}, 0, 0
for k, files in cand.items():
    by_hash = collections.defaultdict(list)
    for r in files:
        if r['rel'] not in cache:
            try:
                cache[r['rel']] = part_hash(r['rel'])
            except OSError:
                cache[r['rel']] = None
        by_hash[cache[r['rel']]].append(r)
    for h, same in by_hash.items():
        if h is None or len(same) < 2:
            if len(by_hash) > 1:
                rejected += 1
            continue
        confirmed += 1
        keep = max(same, key=score)
        for r in same:
            if r['rel'] != keep['rel']:
                dup_map[r['rel']] = keep['rel']

json.dump(cache, open(D('hash_cache.json'), 'w', encoding='utf-8'), ensure_ascii=False)
json.dump(dup_map, open(D('duplicates.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

print('confirmed identical groups : %d' % confirmed)
print('name+size matches rejected  : %d  (different content)' % rejected)
print('redundant files             : %d' % len(dup_map))
print()
print('=== which copy was kept (sample) ===')
for r, k in list(dup_map.items())[:10]:
    print('  drop  %s' % r[:78])
    print('  keep  %s' % k[:78])
