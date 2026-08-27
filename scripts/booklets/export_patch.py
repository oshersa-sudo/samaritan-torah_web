# -*- coding: utf-8 -*-
"""Write the three booklets out as a patch the running site can apply to itself.

The live database lives on a persistent disk and carries the maintainer's own
work — eleven Samaritan-chapter splits that exist nowhere else, and none of the
sixty-nine Samaritan expansion verses the local DB has. Copying the local file
over it ("טען DB מהמאגר") would destroy all of that to deliver 64 rows. So the
booklets travel as a patch instead: a small file in the repo that the app reads
at boot and inserts if it is not already there, the same way the two portion
names are corrected in place rather than by shipping a database.

The patch is INSERT-ONLY into two tables. It updates nothing, deletes nothing,
and touches no other table.

Verse ids are the join, and they are safe to use: every one of the 5,847 verses
the site serves carries the same id as the local copy — checked by address, with
zero re-created rows. The one link whose verse exists only locally
(במדבר 12:16-1) is carried anyway and skipped at apply time, so the same patch
is correct on a database that does have it.

Usage: py -3 scripts/booklets/export_patch.py
"""
import io
import json
import os
import sqlite3
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB = os.path.join(_ROOT, 'data', 'torah.db')
OUT = os.path.join(_ROOT, 'data', 'booklets_patch.json')
TAG = 'מתוך הספרון:'


def main():
    conn = sqlite3.connect('file:%s?mode=ro' % DB.replace('\\', '/'), uri=True)
    conn.row_factory = sqlite3.Row
    secs = [dict(r) for r in conn.execute(
        'SELECT id, title, author, ord, text FROM tradart_sections '
        ' WHERE author LIKE ? ORDER BY ord', (TAG + '%',))]
    ids = set(s['id'] for s in secs)
    links = {}
    for r in conn.execute('SELECT section_id, verse_id FROM tradart_verse_links'):
        if r['section_id'] in ids:
            links.setdefault(r['section_id'], []).append(r['verse_id'])

    # the section's own id is not carried: the receiving database assigns its
    # own, and the links follow it. Carrying it would collide the moment the
    # site's tradart table grows a row of its own.
    out = {
        'tag': TAG,
        'sections': [{'title': s['title'], 'author': s['author'], 'ord': s['ord'],
                      'text': s['text'], 'verses': sorted(links.get(s['id'], []))}
                     for s in secs],
    }
    json.dump(out, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    n_links = sum(len(s['verses']) for s in out['sections'])
    print('sections : %d' % len(out['sections']))
    print('links    : %d  (%d distinct verses)'
          % (n_links, len(set(v for s in out['sections'] for v in s['verses']))))
    print('written  : %s  (%d KB)' % (os.path.relpath(OUT, _ROOT),
                                      os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
