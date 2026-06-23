# -*- coding: utf-8 -*-
"""Re-align ALL of Genesis' Arabic: overwrite the pre-existing SCRAMBLED arabic_trans
values with the verified, docx-extracted translation produced by
fill_arabic_from_docx.py --all (data/arabic_realign_review.jsonl).

Policy (conservative):
 - Only verses the model verified (matches=true) are considered.
 - The new Arabic is cleaned of docx artifacts (the "االله" double-article typo and
   "word/alternative" glosses → keep the first).
 - A verse is OVERWRITTEN only when the new (verified) text differs from the current
   one at the Arabic-letter level — i.e. the current value is wrong/scrambled (or
   carries artifacts). Verses already holding the correct text are left untouched.
 - matches=false verses are never overwritten; they are listed for manual review.

Full DB backup before --apply. Idempotent.

Usage:  py -3 scripts/apply_arabic_realign.py            # dry-run: counts + samples
        py -3 scripts/apply_arabic_realign.py --apply
"""
import sqlite3, sys, io, os, re, json, shutil, datetime, argparse, difflib

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
REVIEW = 'data/arabic_realign_review.jsonl'
FLAGGED = 'data/arabic_realign_flagged.txt'
_ARLET = re.compile('[ء-ي]')


def clean_ar(s):
    s = (s or '').replace('االله', 'الله')           # double-alef "Allah" typo
    s = re.sub(r'/\s*[ء-ي]+', '', s)                 # drop "/alternative" glosses
    s = re.sub(r'\s+', ' ', s).strip()
    return s


_ORTH = {'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه',
         'ؤ': 'و', 'ئ': 'ي', 'ء': ''}


# manual classification of the 0.42–0.80 similarity band (read by content: does the
# OLD Arabic translate THIS verse, or a different one?). Scrambled → overwrite;
# same verse in a different edition → keep.
MANUAL_OVERWRITE = {'24:42', '9:18', '8:10', '27:13', '42:29', '11:26',
                    '2:19', '6:10', '11:11', '12:19'}
MANUAL_KEEP = {'2:18', '23:14', '12:18', '37:24'}


def is_early(ref):
    """Gen 1:1–2:17 — the range whose original Arabic is correctly aligned. Per the
    user's choice we keep these in their original edition and only fix the scrambled
    verses past Gen 2:17."""
    try:
        a, b = ref.split(':'); a = int(a); b = int(b)
    except ValueError:
        return False
    return a == 1 or (a == 2 and b <= 17)
def letters(s):
    """Arabic consonants, orthography-normalised (alef/hamza/ya/ta-marbuta variants
    folded) so that ONLY genuine content differences — a scrambled verse — count as
    a change. Verses that match except for spelling/punctuation are left untouched."""
    out = _ARLET.findall(s or '')
    return ''.join(_ORTH.get(c, c) for c in out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--book', default='בראשית')
    ap.add_argument('--review', default=REVIEW)
    args = ap.parse_args()
    is_gen = (args.book == 'בראשית')   # the early-range + manual-band logic is Gen-only

    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
    gid = con.execute("SELECT id FROM books WHERE name=?", (args.book,)).fetchone()[0]
    cur = {}
    for r in con.execute("""SELECT c.number jch, v.number jn, v.id id, v.text he,
                                   TRIM(COALESCE(v.arabic_trans,'')) ar
                            FROM verses v JOIN chapters c ON c.id=v.chapter_id
                            WHERE c.book_id=?""", (gid,)):
        cur['%s:%s' % (r['jch'], r['jn'])] = (r['id'], r['ar'], r['he'])

    overwrite, unchanged, flagged, noverse = [], 0, [], 0
    seen = set()
    for l in open(args.review, encoding='utf-8'):
        rec = json.loads(l)
        for v in rec.get('verses', []):
            ref = v.get('ref')
            if not ref or ref in seen:
                continue
            seen.add(ref)
            info = cur.get(ref)
            if not info:
                noverse += 1; continue
            vid, old, he = info
            if is_gen and is_early(ref):
                unchanged += 1                # preserve the original early edition
                continue
            new = clean_ar(v.get('arabic', ''))
            if not v.get('matches') or not new:
                flagged.append((ref, he, old, new, v.get('back', '')))
                continue
            lo, ln = letters(old), letters(new)
            if lo == ln:
                unchanged += 1
                continue
            # OLD and NEW differ. Decide scrambled (overwrite) vs same-verse edition
            # difference (keep) by their content similarity, with a few manual calls
            # for the ambiguous 0.42–0.80 band (read by content, see notes below).
            r = difflib.SequenceMatcher(None, lo, ln).ratio()
            mkeep = is_gen and ref in MANUAL_KEEP
            mover = is_gen and ref in MANUAL_OVERWRITE
            if mkeep:
                unchanged += 1
            elif r < 0.42 or mover:
                overwrite.append((vid, ref, old, new, he))     # scrambled → fix
            elif r >= 0.80:
                unchanged += 1                                  # same verse, edition diff → keep
            elif is_gen:
                # an unclassified Gen mid-band verse — keep it and flag for a look
                flagged.append((ref, he, old, new, 'mid-band r=%.2f (kept)' % r))
            else:
                # other books had no correct edition to preserve — the verified docx
                # reading replaces the scrambled one.
                overwrite.append((vid, ref, old, new, he))

    print('verses verified & changed (to overwrite):', len(overwrite))
    print('verses already correct (unchanged)      :', unchanged)
    print('flagged (left as-is, manual review)     :', len(flagged))
    if noverse:
        print('refs not in DB:', noverse)

    with open(FLAGGED, 'w', encoding='utf-8') as f:
        f.write('Re-align: verses NOT overwritten (matches=false) — review manually\n\n')
        for ref, he, old, new, back in flagged:
            f.write('Gen %s\n  HE  : %s\n  OLD : %s\n  NEW?: %s\n  BACK: %s\n\n'
                    % (ref, he, old, new, back))
    print('flagged report ->', FLAGGED)

    if not args.apply:
        print('\nDRY-RUN — sample of corrections:')
        for vid, ref, old, new, he in overwrite[:6]:
            print('  Gen %s' % ref)
            print('     HE :', he[:62])
            print('     OLD:', old[:62])
            print('     NEW:', new[:62])
        print('\npass --apply to write.')
        return

    bak = DB + '.bak_realign_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backup:', os.path.basename(bak))
    c = con.cursor()
    for vid, ref, old, new, he in overwrite:
        c.execute('UPDATE verses SET arabic_trans=? WHERE id=?', (new, vid))
    con.commit()
    print('overwrote arabic_trans for %d verses.' % len(overwrite))
    con.close()


if __name__ == '__main__':
    main()
