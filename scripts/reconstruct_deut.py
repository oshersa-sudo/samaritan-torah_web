# -*- coding: utf-8 -*-
"""Reconstruct a clean, complete דברים.txt (Deuteronomy 1-34) from torah.db, which still
holds the full properly-divided Deuteronomy. Writes to a temp file for verification.

The corrupt data/דברים.txt currently holds a duplicate of Numbers 23-36 + Deut 10-34 only
(Deut 1-9 missing). The DB is the clean verse-divided source.
"""
import sys, sqlite3, re

LRM, RLM = '‎', '‏'
OUT = 'data/דברים.reconstructed.txt'


def reconstruct():
    c = sqlite3.connect('data/torah.db')
    bid = c.execute("SELECT id FROM books WHERE name='דברים'").fetchone()[0]
    rows = c.execute(
        '''SELECT c.number, v.number, v.text
           FROM verses v JOIN chapters c ON c.id=v.chapter_id
           WHERE c.book_id=? ORDER BY c.number, v.number''', (bid,)).fetchall()
    c.close()

    # group by chapter
    chapters = {}
    for ch, vn, txt in rows:
        chapters.setdefault(ch, []).append((vn, txt))

    lines = ['‏']  # mirror the leading RLM-only line seen in the real files
    for ch in sorted(chapters):
        parts = []
        for idx, (vn, txt) in enumerate(chapters[ch]):
            body = txt.strip()
            sam_end = body.endswith('׃--') or body.endswith('׃ --')
            # remove any trailing sof-pasuq/section the DB text carries
            body = re.sub(r'\s*׃\s*--\s*$', '', body)
            body = re.sub(r'\s*׃\s*$', '', body).strip()
            end = '׃--' if sam_end else '׃'
            if idx == 0:
                parts.append(f'{LRM}Deuteronomy {ch}:{vn}{RLM} {body}{end}')
            else:
                parts.append(f'{LRM}{vn}{RLM} {body}{end}')
        lines.append(' '.join(parts))
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'wrote {OUT}  ({len(chapters)} chapters, {len(rows)} verses)')
    return OUT


def apply_full():
    """Overwrite דברים.txt with the reconstruction, apply ver2 corrections+marks."""
    import os, shutil
    sys.path.insert(0, 'scripts')
    from aziz_lib import parse_txt
    from aziz2_lib import extract as extract2
    from apply_ver2_more import process

    out = reconstruct()
    target = 'data/דברים.txt'
    # preserve the corrupt original (if not already kept)
    if not os.path.exists(target + '.corrupt.bak'):
        shutil.copy2(target, target + '.corrupt.bak')
        print(f'backup corrupt -> {target}.corrupt.bak')
    shutil.copy2(out, target)
    print(f'reconstruction installed -> {target}')

    # apply ver2 (corrections + mid-verse marks + sof-pasuq) on the clean full file
    hyp = [w for w in extract2() if w['book'] == 'Deuteronomy']
    # fresh ver2 snapshot of the clean reconstruction
    if os.path.exists(target + '.ver2.bak'):
        os.remove(target + '.ver2.bak')   # old backup was the corrupt/partial file
    process('Deuteronomy', target, lambda p: parse_txt(p, 'Deuteronomy'), hyp, apply=True)


if __name__ == '__main__':
    if '--apply' in sys.argv:
        apply_full()
    else:
        out = reconstruct()
        sys.path.insert(0, 'scripts')
        from aziz_lib import parse_txt
        w = parse_txt(out, 'Deuteronomy')
        ch = sorted(set(x['chap'] for x in w))
        nv = len(set((x['chap'], x['verse']) for x in w))
        print(f'parsed: words={len(w)} chapters={ch[0]}..{ch[-1]} ({len(ch)}) verses={nv}')
        print('first line head:')
        print('  ' + open(out, encoding='utf-8').read().split('\n')[1][:200])
        print('\n[dry-run] re-run with --apply to install + correct + (then run DB update).')
