# -*- coding: utf-8 -*-
"""Apply the verified Arabic fills from data/arabic_fill_review.jsonl to the DB.

Writes the extracted Arabic into verses.arabic_trans ONLY for verses that are
currently missing it AND whose back-translation was verified (matches==true).
Existing Arabic is never overwritten. Flagged verses (matches==false / not found)
are written to data/arabic_fill_flagged.txt for manual review — these are mostly
legitimate Samaritan-Arabic toponym substitutions (Nile=Pishon, Sudan=Cush, …).

Backs up the DB first. Idempotent. DRY-RUN unless --apply is given.

Usage:
  py -3 scripts/apply_arabic_fill.py            # dry-run: counts only
  py -3 scripts/apply_arabic_fill.py --apply    # write to DB
"""
import sqlite3, sys, io, os, re, json, shutil, datetime, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
REVIEW = 'data/arabic_fill_review.jsonl'
FLAGGED = 'data/arabic_fill_flagged.txt'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
    gid = con.execute("SELECT id FROM books WHERE name='בראשית'").fetchone()[0]
    # map "jch:jn" -> (verse_id, has_arabic) for Genesis
    vmap = {}
    for r in con.execute("""SELECT v.id, c.number jch, v.number jn,
                                   TRIM(COALESCE(v.arabic_trans,'')) ar, v.text he
                            FROM verses v JOIN chapters c ON c.id=v.chapter_id
                            WHERE c.book_id=?""", (gid,)):
        vmap['%s:%s' % (r['jch'], r['jn'])] = (r['id'], bool(r['ar']), r['he'])

    to_write = []      # (verse_id, ref, arabic)
    flagged = []       # (ref, arabic, back, reason)
    seen = set()
    for l in open(REVIEW, encoding='utf-8'):
        rec = json.loads(l)
        for v in rec.get('verses', []):
            ref = v.get('ref'); ar = (v.get('arabic') or '').strip()
            if not ref or ref in seen:
                continue
            seen.add(ref)
            info = vmap.get(ref)
            if not info:
                flagged.append((ref, ar, v.get('back', ''), 'ref not in DB')); continue
            vid, has_ar, he = info
            if has_ar:
                continue                      # never overwrite existing
            if ar:
                to_write.append((vid, ref, ar))   # write all 609 (user-approved)
                if not v.get('matches'):
                    flagged.append((ref, ar, v.get('back', ''), 'matches=false (written)'))
            else:
                flagged.append((ref, ar, v.get('back', ''), 'not found (skipped)'))

    print('verified fills (matches=true, missing):', len(to_write))
    print('flagged for review:', len(flagged))

    with open(FLAGGED, 'w', encoding='utf-8') as f:
        f.write('Flagged Arabic fills — review manually (mostly toponym substitutions)\n\n')
        for ref, ar, back, why in flagged:
            he = vmap.get(ref, (None, None, ''))[2]
            f.write('Gen %s  [%s]\n  HE  : %s\n  AR  : %s\n  BACK: %s\n\n'
                    % (ref, why, he, ar, back))
    print('flagged report ->', FLAGGED)

    if not args.apply:
        print('\nDRY-RUN — pass --apply to write to DB.')
        for vid, ref, ar in to_write[:5]:
            print('  would set Gen %s = %s' % (ref, ar[:60]))
        return

    bak = DB + '.bak_arfill_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backup:', os.path.basename(bak))
    c = con.cursor()
    n = 0
    for vid, ref, ar in to_write:
        c.execute("UPDATE verses SET arabic_trans=? WHERE id=? AND TRIM(COALESCE(arabic_trans,''))=''",
                  (ar, vid))
        n += c.rowcount
    con.commit()
    print('wrote arabic_trans for %d verses.' % n)
    con.close()


if __name__ == '__main__':
    main()
