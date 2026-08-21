# -*- coding: utf-8 -*-
"""Confirm a suspected duplicate by listening to it, not by reading its name.

find_similar.py suspects. This decides. It reads the sound itself, so an
identical performance is recognised however it was named, and two different
performances that happen to share a duration are told apart.

How the sound is reduced to something comparable:

  decoded at 4 kHz, mono — everything a voice carries is well inside that, and
  it is small enough to hold a whole hour in memory;

  cut into frames of a quarter of a second, each frame turned into the energy
  in sixteen bands spaced the way hearing is spaced, not the way hertz are;

  and every frame normalised on its own. That last step is what makes the
  comparison survive re-encoding: a copy at another bitrate, or louder, or
  quieter, has the same shape in each frame even when the numbers differ.

Two fingerprints are then compared frame against frame, allowing a small slip
either way in case one copy starts a moment earlier. What comes back is a
number between 0 and 1, and in practice the two populations do not overlap:
the same recording scores above about 0.9, and different recordings well
below it.

    py -3 scripts/verify_dupes.py --self-test    prove the method first
    py -3 scripts/verify_dupes.py                check every suspected pair
    py -3 scripts/verify_dupes.py --limit 50     the surest suspects only

Reads only. Writes data/duplicates_verified.csv and nothing else.
"""
import collections
import csv
import hashlib
import io
import json
import os
import subprocess
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT = os.path.dirname(HERE)
ARCHIVE = os.environ.get('SHIRA_ARCHIVE',
                         r'G:\שומרונים ומסורת- תיקייה חשובה מאד\שיראן')
ADDED = os.environ.get('SHIRA_ADDED', os.path.join(UNIT, 'added'))
REPORT = os.path.join(UNIT, 'data', 'duplicates_report.csv')
OUT = os.path.join(UNIT, 'data', 'duplicates_verified.csv')
CACHE = os.path.join(UNIT, 'data', 'fingerprints')

RATE = 4000                 # a voice needs nothing above this
FRAME = 1024                # a quarter of a second
HOP = 512
BANDS = 16
SAME = 0.90                 # at or above this, the same recording


def path_of(rel):
    """Where a catalogue path actually is on this machine."""
    rel = (rel or '').replace('/', os.sep)
    if rel.startswith('added' + os.sep):
        return os.path.join(ADDED, rel[len('added') + 1:])
    return os.path.join(ARCHIVE, rel)


def _bands():
    """Sixteen band edges, spaced as hearing is rather than as hertz are."""
    lo, hi = 60.0, RATE / 2 - 100
    edges = np.geomspace(lo, hi, BANDS + 1)
    bins = np.floor(edges / (RATE / FRAME)).astype(int)
    return np.clip(bins, 1, FRAME // 2)


BAND_BINS = _bands()


def decode(path, seconds=0):
    """The file as mono samples at 4 kHz, or None if it will not decode."""
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE),
           '-f', 's16le', '-']
    if seconds:
        cmd[3:3] = ['-t', str(seconds)]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=600)
    except Exception:                               # noqa: BLE001
        return None
    if not r.stdout:
        return None
    return np.frombuffer(r.stdout, dtype='<i2').astype(np.float32) / 32768.0


def fingerprint(path):
    """The shape of the sound over time: one row of sixteen bands per frame."""
    x = decode(path)
    if x is None or x.size < FRAME * 4:
        return None
    n = 1 + (x.size - FRAME) // HOP
    if n < 8:
        return None
    idx = np.arange(FRAME)[None, :] + HOP * np.arange(n)[:, None]
    frames = x[idx] * np.hanning(FRAME)[None, :]
    spec = np.abs(np.fft.rfft(frames, axis=1))
    out = np.empty((n, BANDS), dtype=np.float32)
    for b in range(BANDS):
        a, z = BAND_BINS[b], max(BAND_BINS[b + 1], BAND_BINS[b] + 1)
        out[:, b] = spec[:, a:z].mean(axis=1)
    out = np.log1p(out * 100.0)
    # each frame judged on its own shape, so loudness and bitrate fall away
    out -= out.mean(axis=1, keepdims=True)
    norm = np.linalg.norm(out, axis=1, keepdims=True)
    # A silent frame has no shape to compare and must not be made to look
    # like one: it is marked, and left out of the reckoning below. Counting
    # silence as disagreement is what made a file score 0.978 against itself.
    out /= np.maximum(norm, 1e-6)
    out[(norm < 1e-4).ravel()] = 0.0
    return out


def cached(rel):
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.sha1(rel.encode('utf-8')).hexdigest()[:20]
    p = os.path.join(CACHE, key + '.npy')
    if os.path.exists(p):
        try:
            return np.load(p)
        except Exception:                           # noqa: BLE001
            pass
    full = path_of(rel)
    if not os.path.exists(full):
        return None
    fp = fingerprint(full)
    if fp is None:
        return None
    np.save(p, fp)
    return fp


def compare(a, b, slack=8):
    """How alike two fingerprints are, 0 to 1, allowing a small slip."""
    if a is None or b is None:
        return 0.0
    n = min(len(a), len(b))
    if n < 8:
        return 0.0
    best = 0.0
    for lag in range(-slack, slack + 1):
        if lag >= 0:
            x, y = a[lag:lag + n - slack], b[:n - slack]
        else:
            x, y = a[:n - slack], b[-lag:-lag + n - slack]
        m = min(len(x), len(y))
        if m < 8:
            continue
        x, y = x[:m], y[:m]
        # only where both sides actually have sound
        live = (np.abs(x).sum(axis=1) > 0) & (np.abs(y).sum(axis=1) > 0)
        if live.sum() < 8:
            continue
        s = float((x[live] * y[live]).sum() / live.sum())
        best = max(best, s)
    return max(0.0, min(1.0, best))


def self_test():
    """Prove the method on cases whose answer is already known."""
    import random
    with io.open(REPORT, encoding='utf-8-sig') as fh:
        rows = list(csv.DictReader(fh))
    strong = [r for r in rows if int(r['ודאות']) >= 5][:6]

    print('— pairs the name test calls near-certain —')
    same_scores = []
    for r in strong:
        s = compare(cached(r['קובץ א']), cached(r['קובץ ב']))
        same_scores.append(s)
        print('  %.3f  %s' % (s, r['כותרת א'][:44]))

    print('\n— a file against itself (must be 1.000) —')
    one = cached(strong[0]['קובץ א'])
    print('  %.3f' % compare(one, one))

    print('\n— unrelated recordings (must be low) —')
    with io.open(os.path.join(UNIT, 'data', 'catalog.json'), encoding='utf-8') as fh:
        cat = json.load(fh)
    tracks = [t['f'] for r in cat['recordings'] for t in r['tr']
              if (t.get('s') or 0) > 120]
    random.seed(7)
    diff_scores = []
    for _ in range(6):
        a, b = random.sample(tracks, 2)
        s = compare(cached(a), cached(b))
        diff_scores.append(s)
        print('  %.3f  %s  vs  %s' % (s, a.split('/')[-1][:26], b.split('/')[-1][:26]))

    if same_scores and diff_scores:
        print('\n  same     : %.3f – %.3f' % (min(same_scores), max(same_scores)))
        print('  different: %.3f – %.3f' % (min(diff_scores), max(diff_scores)))
        gap = min(same_scores) - max(diff_scores)
        print('  gap between the two populations: %.3f' % gap)
        print('  %s' % ('the method separates them cleanly' if gap > 0.15
                        else 'THE POPULATIONS OVERLAP — do not trust this yet'))
    return 0


def main():
    if '--self-test' in sys.argv:
        return self_test()
    limit = 0
    for i, a in enumerate(sys.argv):
        if a == '--limit' and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    with io.open(REPORT, encoding='utf-8-sig') as fh:
        rows = list(csv.DictReader(fh))
    rows.sort(key=lambda r: -int(r['ודאות']))
    if limit:
        rows = rows[:limit]
    files = sorted({r['קובץ א'] for r in rows} | {r['קובץ ב'] for r in rows})
    print('%d זוגות, %d קבצים לטביעת קול' % (len(rows), len(files)))

    t0, done = time.time(), 0
    for rel in files:
        cached(rel)
        done += 1
        if done % 25 == 0:
            per = (time.time() - t0) / done
            print('   %d/%d  (%.1fs לקובץ, נותרו כ-%d דקות)'
                  % (done, len(files), per, (len(files) - done) * per / 60))

    print('\nמשווה…')
    out, tally = [], collections.Counter()
    for r in rows:
        s = compare(cached(r['קובץ א']), cached(r['קובץ ב']))
        verdict = ('אותה הקלטה' if s >= SAME else
                   'כנראה אותה' if s >= 0.80 else
                   'שונות' if s < 0.55 else 'לא ברור')
        tally[verdict] += 1
        out.append(dict(r, דמיון='%.3f' % s, פסק=verdict))

    with io.open(OUT, 'w', encoding='utf-8-sig', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)

    print('\n%-14s %s' % ('פסק', 'זוגות'))
    for k in ('אותה הקלטה', 'כנראה אותה', 'לא ברור', 'שונות'):
        if tally.get(k):
            print('%-14s %d' % (k, tally[k]))
    print('\nנכתב %s' % OUT)

    sure = [r for r in out if r['פסק'] == 'אותה הקלטה']
    if sure:
        print('\nהזוגות שאושרו בטביעת קול, ראשונים:')
        for r in sure[:12]:
            print('  %s  %s' % (r['דמיון'], r['כותרת א'][:44]))
            print('        %s' % r['קובץ א'][-72:])
            print('        %s' % r['קובץ ב'][-72:])
    return 0


if __name__ == '__main__':
    sys.exit(main())
