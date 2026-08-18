# -*- coding: utf-8 -*-
"""The watched folder: what is dropped in it joins the archive.

The agreed way of filing, and the whole of it:

    the file's name          becomes the title, and the piyyut
    the file's own tags      become the singer
    the file's name          says which feast it belongs to

Nothing else is inferred. Where a file carries no singer in its tags the
recording is filed under "לא ידוע" and listed in the report, so that whoever
dropped it in can see at a glance what still wants a name — rather than the
program inventing one and it going unnoticed.

A file is taken once. What has been taken is remembered by its content, not
by its name, so the same recording dropped in twice under two names is not
added twice, and a file renamed after the fact is not taken again.

    py -3 scripts/inbox.py               # take what is there
    py -3 scripts/inbox.py --check       # say what would be taken, take nothing

Taking a file copies it into added/, writes it into data/additions.json, and
sends the audio up to the media server. Publishing the catalogue to the live
site is the next step and belongs to scripts/sync.py.
"""
import hashlib
import io
import json
import os
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import additions as ADD                    # noqa: E402
import tags as TAGS                        # noqa: E402
from textutil import safe_name             # noqa: E402

INBOX = os.environ.get('SHIRA_INBOX', os.path.join(UNIT, 'inbox'))
ADDED = os.environ.get('SHIRA_ADDED', os.path.join(UNIT, 'added'))
SEEN  = os.path.join(UNIT, 'data', 'inbox_seen.json')
DONE  = os.path.join(INBOX, '_נקלטו')      # where a taken file is moved to

AUDIO = ('.mp3', '.m4a', '.wav', '.aac', '.wma', '.ogg', '.opus', '.flac',
         '.webm', '.mp4')


def _seen():
    if os.path.exists(SEEN):
        try:
            with io.open(SEEN, encoding='utf-8') as fh:
                return json.load(fh)
        except Exception:                       # noqa: BLE001
            pass
    return {}


def _remember(seen):
    with io.open(SEEN, 'w', encoding='utf-8') as fh:
        json.dump(seen, fh, ensure_ascii=False, indent=1)


def digest(path):
    """A file is known by its contents, so a rename does not make it new."""
    h = hashlib.sha1()
    with open(path, 'rb') as fh:
        h.update(str(os.path.getsize(path)).encode())
        h.update(fh.read(1 << 20))              # the first megabyte is plenty
    return h.hexdigest()


def waiting():
    """Every sound file sitting in the inbox, oldest first."""
    out = []
    if not os.path.isdir(INBOX):
        return out
    for dp, dirs, files in os.walk(INBOX):
        dirs[:] = [d for d in dirs if not d.startswith('_')]
        for f in sorted(files):
            if os.path.splitext(f)[1].lower() in AUDIO and not f.startswith('.'):
                p = os.path.join(dp, f)
                try:
                    out.append((os.path.getmtime(p), p))
                except OSError:
                    pass
    return [p for _, p in sorted(out)]


def take(path, rows, seen, move=True):
    """Read one file, file it, and return the row that was written."""
    d = TAGS.read(path)
    performer = d['performer'] or 'לא ידוע'
    piyyut = d['title']
    event = d['event'] or 'שונות'

    folder = os.path.join(ADDED, safe_name(performer, 'unknown'),
                          safe_name(piyyut, 'piyyut'))
    os.makedirs(folder, exist_ok=True)
    ext = os.path.splitext(path)[1].lower()
    dest = os.path.join(folder, safe_name(piyyut, 'clip') + ext)
    i = 2
    while os.path.exists(dest):                 # never overwrite
        dest = os.path.join(folder, '%s (%d)%s' % (safe_name(piyyut, 'clip'), i, ext))
        i += 1
    shutil.copy2(path, dest)

    rel = os.path.relpath(dest, ADDED).replace(os.sep, '/')
    row = {
        'id':        ADD.next_id(rows),
        'performer': performer,
        'event':     event,
        'piyyut':    piyyut,
        'title':     piyyut,
        'note':      '',
        'dir':       'תיקיית הקליטה',
        'added':     time.strftime('%Y-%m-%dT%H:%M:%S'),
        'tracks':    [{'f': 'added/' + rel, 's': d['seconds'],
                       'n': piyyut}],
    }
    if d['year']:
        row['year'] = d['year']
    rows.append(row)
    seen[digest(path)] = {'f': os.path.basename(path), 'id': row['id'],
                          'at': row['added']}
    if move:
        os.makedirs(DONE, exist_ok=True)
        try:
            shutil.move(path, os.path.join(DONE, os.path.basename(path)))
        except Exception:                       # noqa: BLE001
            pass                                # a copy was already made
    return row, d


def run(check=False, push=True):
    files = waiting()
    if not files:
        print('אין קבצים חדשים בתיקיית הקליטה')
        print('   %s' % INBOX)
        return []
    seen, rows = _seen(), ADD.load()
    print('%d קבצים בתיקייה' % len(files))
    print('   %s\n' % INBOX)
    taken, skipped, nameless = [], 0, []
    for p in files:
        if digest(p) in seen:
            skipped += 1
            continue
        if check:
            d = TAGS.read(p)
            print('  %-40s' % os.path.basename(p)[:40])
            print('      כותרת : %s' % d['title'])
            print('      מבצע  : %s' % (d['performer'] or '— אין בתגיות —'))
            print('      אירוע : %s' % (d['event'] or 'שונות'))
            taken.append(p)
            continue
        row, d = take(p, rows, seen)
        taken.append(row)
        if not d['performer']:
            nameless.append(row['title'])
        print('  נקלט: %-34s  %-18s  %s'
              % (row['title'][:34], row['performer'][:18], row['event']))

    if not check and taken:
        ADD.save(rows)
        _remember(seen)
        if push:
            try:
                import media_push as PUSH
                for r in taken:
                    for t in r['tracks']:
                        PUSH.push(t['f'])
                print('\n%d קבצים נשלחו אל שרת המדיה' % len(taken))
            except Exception as e:              # noqa: BLE001
                print('\nההעלאה לשרת המדיה נכשלה: %s' % str(e)[:80])
                print('הקבצים נשמרו מקומית ואפשר לשלוח אותם שוב')

    print('\nנקלטו %d, דולגו %d (כבר נקלטו קודם)' % (len(taken), skipped))
    if nameless:
        print('\n%d הקלטות ללא שם מבצע בתגיות — נרשמו כ"לא ידוע":' % len(nameless))
        for t in nameless[:12]:
            print('   %s' % t)
        print('אפשר לקבוע להן מבצע בפאנל המנהל.')
    return taken


if __name__ == '__main__':
    sys.exit(0 if run(check='--check' in sys.argv) is not None else 1)
