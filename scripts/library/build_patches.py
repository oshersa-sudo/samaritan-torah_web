# -*- coding: utf-8 -*-
"""Build the two boot patches that carry this work to the live site without
ever replacing the live database file.

  data/library_books_patch.json      — the two translated studies (new tables)
  data/translit_benhayyim_patch.json — Ben-Ḥayyim's transcription, 5,208 verses

The live DB sits on Render's persistent disk and holds edits that exist nowhere
else, so nothing here is copied over it. app/services/database.py applies these
at boot, in place, the same way the booklets are applied (_seed_booklets).

Every transcription row records what may safely be overwritten. A verse's
transcription is replaced only when the live row still holds a value this
project itself once shipped (`old`), and only when the verse is still the same
verse — its Samaritan letters (`sk`) match — so a verse merged or split online,
or a transcription corrected online, is left as it is and reported.

Usage:  py -3 scripts/library/build_patches.py
"""
import hashlib, io, json, os, re, sqlite3, subprocess, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOCAL = os.path.join(ROOT, 'data', 'torah.db')

# Databases this project has shipped. A live transcription row equal to one of
# their values has not been touched online, so it may be replaced.
def _lfs_path(rev):
    ptr = subprocess.run(['git', 'show', '%s:data/torah.db' % rev], cwd=ROOT,
                         capture_output=True, text=True).stdout
    m = re.search(r'oid sha256:([0-9a-f]{64})', ptr)
    if not m:
        return None
    oid = m.group(1)
    p = os.path.join(ROOT, '.git', 'lfs', 'objects', oid[:2], oid[2:4], oid)
    return p if os.path.exists(p) else None

SHIPPED = list(dict.fromkeys(p for p in (
    _lfs_path('private/main'),
    _lfs_path('HEAD'),
    os.path.join(os.path.dirname(ROOT), 'torah-deploy', 'data', 'torah.db'),
) if p and os.path.exists(p)))

LETTERS = re.compile(r'[^א-ת]')

def skeleton(text):
    """The bare Hebrew letters of a verse — immune to the punctuation edits the
    live site carries, but not to a verse being merged into another or split."""
    return LETTERS.sub('', text or '')

def ro(path):
    c = sqlite3.connect('file:%s?mode=ro' % path.replace('\\', '/'), uri=True)
    c.row_factory = sqlite3.Row
    return c


def build_books():
    conn = ro(LOCAL)
    books = []
    for table in ('wreschner_sections', 'cohen_sections'):
        rows = [[r['chap'], r['chap_title'], r['ord'], r['ref'] or '', r['title'] or '', r['text'] or '']
                for r in conn.execute('SELECT chap, chap_title, ord, ref, title, text FROM %s '
                                      'ORDER BY chap, ord' % table)]
        fp = hashlib.sha1(json.dumps(rows, ensure_ascii=False).encode('utf-8')).hexdigest()
        books.append({'table': table, 'fingerprint': fp, 'rows': rows})
        print('  %-20s %4d rows  %s' % (table, len(rows), fp[:12]))
    conn.close()
    return {'books': books}


def build_translit():
    # the book's reading, by address — the proposal files are the source of truth
    new = {}
    base = os.path.join(ROOT, 'data', 'translit_pdf', 'proposed')
    for d in sorted(os.listdir(base)):
        full = os.path.join(base, d)
        if not os.path.isdir(full):
            continue
        for f in sorted(os.listdir(full)):
            if f.startswith('p') and f.endswith('.json'):
                for r in json.load(io.open(os.path.join(full, f), encoding='utf-8')):
                    new[(r['book'], r['chap'], str(r['verse']))] = r['text'].strip()

    conn = ro(LOCAL)
    addr, sk = {}, {}
    for r in conn.execute('SELECT c.book_id b, c.number ch, v.number n, v.id, v.text '
                          'FROM verses v JOIN chapters c ON c.id=v.chapter_id'):
        addr[(r['b'], r['ch'], str(r['n']))] = r['id']
        sk[r['id']] = skeleton(r['text'])
    conn.close()

    old, old_fix = {}, {}
    for path in SHIPPED:
        c = ro(path)
        for vid, t in c.execute('SELECT verse_id, text FROM verse_translit'):
            old.setdefault(vid, set()).add((t or '').strip())
        for vid, t in c.execute('SELECT verse_id, text FROM verse_translit_fix'):
            old_fix.setdefault(vid, set()).add((t or '').strip())
        c.close()

    verses, missing = [], 0
    for key in sorted(new, key=lambda k: (k[0], k[1], k[2])):
        vid = addr.get(key)
        if vid is None:
            missing += 1                     # a Samaritan expansion this DB has no row for
            continue
        verses.append({'v': vid, 'sk': sk.get(vid, ''), 'new': new[key],
                       'old': sorted(old.get(vid, set())),
                       'old_fix': sorted(old_fix.get(vid, set()))})
    fp = hashlib.sha1(json.dumps([(x['v'], x['new']) for x in verses],
                                 ensure_ascii=False).encode('utf-8')).hexdigest()
    print('  %d verses (%d book readings with no verse in the DB)  %s' % (len(verses), missing, fp[:12]))
    print('  shipped DBs consulted for the safe-to-replace values:')
    for p in SHIPPED:
        print('    ' + p)
    return {'fingerprint': fp,
            'source': 'Z. Ben-Ḥayyim, the Samaritan reading of the Torah (המליץ/תעתיק הגייה.pdf)',
            'verses': verses}


if __name__ == '__main__':
    print('library books:')
    io.open(os.path.join(ROOT, 'data', 'library_books_patch.json'), 'w', encoding='utf-8').write(
        json.dumps(build_books(), ensure_ascii=False))
    print('transcription:')
    io.open(os.path.join(ROOT, 'data', 'translit_benhayyim_patch.json'), 'w', encoding='utf-8').write(
        json.dumps(build_translit(), ensure_ascii=False))
    for f in ('library_books_patch.json', 'translit_benhayyim_patch.json'):
        print('  %-32s %7.0f KB' % (f, os.path.getsize(os.path.join(ROOT, 'data', f)) / 1024))
