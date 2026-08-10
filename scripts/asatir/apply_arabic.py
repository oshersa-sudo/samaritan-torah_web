# -*- coding: utf-8 -*-
"""Load an Arabic rendering of ספר האסאטיר into asatir_sections.arabic.

The translation is written by hand (in-session, no API) into JSON batch files
under data/asatir_ar/, each a flat {"<ref>": "<arabic>"} map keyed by the
section's own chapter,paragraph ref ("יג,13"). This script merges every batch it
finds, checks each ref against the DB, and writes them in one transaction.

Idempotent: re-running with the same batches just rewrites the same rows, so a
batch can be corrected and re-applied on its own.

Usage:  py -3 scripts/asatir/apply_arabic.py              # dry run: validate + report
        py -3 scripts/asatir/apply_arabic.py --apply
"""
import os
import io
import re
import sys
import glob
import json
import shutil
import sqlite3
import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
DB = os.path.join(_ROOT, 'data', 'torah.db')
BATCH_DIR = os.path.join(_ROOT, 'data', 'asatir_ar')
APPLY = '--apply' in sys.argv

_ARABIC = re.compile(r'[؀-ۿ]')
_HEBREW = re.compile(r'[֐-׿]')


def load_batches():
    """Every data/asatir_ar/*.json merged; a later file wins on a repeated ref."""
    merged, seen = {}, {}
    for path in sorted(glob.glob(os.path.join(BATCH_DIR, '*.json'))):
        with io.open(path, encoding='utf-8') as f:
            d = json.load(f)
        name = os.path.basename(path)
        for ref, ar in d.items():
            if ref in merged:
                print('  note: %s re-translated in %s (was %s)' % (ref, name, seen[ref]))
            merged[ref] = ar
            seen[ref] = name
    return merged


def main():
    if not os.path.isdir(BATCH_DIR):
        print('no batch directory at %s' % BATCH_DIR)
        return
    conn = sqlite3.connect(DB, timeout=60)
    conn.row_factory = sqlite3.Row
    cols = [r[1] for r in conn.execute('PRAGMA table_info(asatir_sections)')]
    rows = {r['ref']: r for r in conn.execute('SELECT id, ref, text FROM asatir_sections')}

    tr = load_batches()
    problems = []
    ok = {}
    for ref, ar in tr.items():
        ar = (ar or '').strip()
        if ref not in rows:
            problems.append((ref, 'no section with this ref'))
            continue
        if not ar:
            problems.append((ref, 'empty translation'))
            continue
        if not _ARABIC.search(ar):
            problems.append((ref, 'no Arabic letters in the translation'))
            continue
        # a stray Hebrew run means an untranslated fragment was left behind —
        # except inside quotation marks, where a cited Hebrew phrase is legitimate.
        stripped = re.sub(r'[«»"“”‘’\'][^«»"“”‘’\']*'
                          r'[«»"“”‘’\']', '', ar)
        heb = _HEBREW.findall(stripped)
        if len(heb) > 12:
            problems.append((ref, 'looks partly untranslated (%d Hebrew letters outside quotes)' % len(heb)))
            continue
        # a translation far shorter than its source is usually a truncated paste
        src = rows[ref]['text'] or ''
        if len(ar) < 0.45 * len(src):
            problems.append((ref, 'much shorter than the source (%d vs %d chars)' % (len(ar), len(src))))
            continue
        ok[ref] = ar

    total = len(rows)
    print('sections in DB: %d   translated in batches: %d   accepted: %d'
          % (total, len(tr), len(ok)))
    print('remaining untranslated: %d' % (total - len(ok)))
    if problems:
        print('problems (%d):' % len(problems))
        for ref, msg in problems:
            print('  [%s] %s' % (ref, msg))
    missing = [r for r in rows if r not in ok]
    if missing:
        def key(r):
            c, p = r.split(',')
            return (len(c), c, int(p))
        print('still missing (%d): %s%s'
              % (len(missing), ', '.join(sorted(missing, key=key)[:40]),
                 ' …' if len(missing) > 40 else ''))

    if not APPLY:
        print('\n[dry-run] re-run with --apply to write')
        conn.close()
        return
    if not ok:
        print('nothing to write')
        conn.close()
        return

    bak = DB + '.bak_asatirar_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak)
    print('backed up ->', os.path.basename(bak))
    cu = conn.cursor()
    if 'arabic' not in cols:
        cu.execute('ALTER TABLE asatir_sections ADD COLUMN arabic TEXT')
        print('added column asatir_sections.arabic')
    for ref, ar in ok.items():
        cu.execute('UPDATE asatir_sections SET arabic=? WHERE ref=?', (ar, ref))
    conn.commit()
    n = conn.execute("SELECT COUNT(*) FROM asatir_sections "
                     "WHERE COALESCE(TRIM(arabic),'')<>''").fetchone()[0]
    print('APPLIED: %d of %d sections now carry an Arabic rendering' % (n, total))
    conn.close()


if __name__ == '__main__':
    main()
