# -*- coding: utf-8 -*-
"""
Build an authoritative surface-word -> root index for Tal's Samaritan-Aramaic
dictionary from data/tal index/tal_index.md (column ערך = surface word,
column שורש = root), and a precomputed root -> best dictionary-entry mapping so
the app can look up a meaning by: word -> root -> entry.

The dictionary's head-lemmas were OCR'd noisily, so a root is matched to its
entry by tiers: (0) entry lemma == root, (1) consonant-skeleton(lemma) ==
skeleton(root), (2) the root appears among the first Hebrew tokens of the
entry text. Best tier wins; a few entries kept per root.

Creates ONLY two additive tables — dict_root_index, dict_root_entries — and
touches no other table. Full DB backup before --apply.

Usage:  py -3 scripts/build_tal_root_index.py            # dry run + stats
        py -3 scripts/build_tal_root_index.py --apply
"""
import sqlite3, sys, io, os, re, shutil
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
MD = 'data/tal index/tal_index.md'
DB = 'data/torah.db'
NIK = re.compile('[֑-ׇ]')
MAT = str.maketrans('', '', 'אהויםןףךץ')          # matres lectionis + finals


def bare(w):
    return NIK.sub('', (w or '')).strip(' .,;:!?"\'־׳״-()[]')


def skel(w):
    return bare(w).translate(MAT)


def parse_index():
    """[(word_bare, root, note)], skipping the header and rule rows."""
    pairs = []
    for line in io.open(MD, encoding='utf-8'):
        line = line.strip()
        if not line.startswith('|') or line.startswith('| ערך') or set(line) <= set('|-: '):
            continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        if len(cells) < 2:
            continue
        w, root = cells[0], cells[1]
        if not w or not root:
            continue
        m = re.search(r'\(([^)]*)\)', w)
        note = m.group(1) if m else ''
        wb = bare(re.sub(r'\([^)]*\)', '', w))
        rb = bare(root)
        if wb and rb:
            pairs.append((wb, rb, note))
    return pairs


def fold(w):
    """Consonants only (keeps weak letters א/ה/ו/י), final letters folded."""
    return bare(w).translate(str.maketrans('ךםןףץ', 'כמנפצ'))


def match_roots_to_entries(conn, roots):
    """root -> [(entry_id, tier)]. The dictionary head-lemmas were OCR'd noisily,
    so each candidate entry is scored across several signals and the best is kept.
    `tier` is a coarse confidence bucket (0 best). Candidates for a root come
    from: entries whose lemma equals/contains the root, entries that contain the
    root as a head word, and entries whose consonant-skeleton matches."""
    rows = conn.execute('SELECT id, lemma, notes FROM dict_entries').fetchall()
    ents = {}
    by_lemma = defaultdict(list)
    by_skel = defaultdict(list)
    word_in = defaultdict(list)
    for r in rows:
        toks = re.findall(r'[א-ת]{2,}', bare(r[2] or ''))
        pos = {}
        for i, t in enumerate(toks):
            pos.setdefault(fold(t), i)
        e = {'id': r[0], 'lb': bare(r[1]), 'lf': fold(r[1]), 'ls': skel(r[1]),
             'wpos': pos}
        ents[r[0]] = e
        by_lemma[e['lb']].append(e)
        by_skel[e['ls']].append(e)
        for t in pos:
            word_in[t].append(e)

    def score(root, rf, rs, e):
        s = 0
        if e['lb'] == root:
            s += 100
        if e['lf'] == rf:
            s += 60
        p = e['wpos'].get(rf)
        if p == 0:
            s += 40                                        # root is the head-word
        elif p is not None and p <= 2:
            s += 25
        elif p is not None:
            s += 8
        if e['ls'] == rs and len(rs) >= 3:
            s += 20
        elif e['ls'] == rs:
            s += 6
        if e['lf'].startswith(rf) or rf.startswith(e['lf']):
            s += 5
        return s

    out = {}
    for root in roots:
        rf, rs = fold(root), skel(root)
        cand = {}
        for e in by_lemma.get(root, []):
            cand[e['id']] = e
        for e in word_in.get(rf, []):
            cand[e['id']] = e
        if len(rs) >= 3:
            for e in by_skel.get(rs, []):
                cand[e['id']] = e
        scored = sorted(((score(root, rf, rs, e), e['id']) for e in cand.values()),
                        reverse=True)
        scored = [(sc, i) for sc, i in scored if sc > 0][:3]
        if scored:
            top = scored[0][0]
            tier = 0 if top >= 100 else 1 if top >= 40 else 2
            out[root] = [(i, tier) for _sc, i in scored]
    return out


def main():
    pairs = parse_index()
    words = set(p[0] for p in pairs)
    roots = sorted(set(p[1] for p in pairs))
    conn = sqlite3.connect(DB, timeout=60)
    rmap = match_roots_to_entries(conn, roots)
    matched = len(rmap)
    print('index rows: %d   distinct words: %d   distinct roots: %d'
          % (len(pairs), len(words), len(roots)))
    print('roots mapped to >=1 entry: %d / %d (%.0f%%)'
          % (matched, len(roots), 100 * matched / len(roots)))
    print('words now resolvable to a meaning: %d / %d (%.0f%%)'
          % (sum(1 for w, r, n in pairs if r in rmap),
             len(pairs), 100 * sum(1 for w, r, n in pairs if r in rmap) / len(pairs)))

    if not APPLY:
        print('\n[dry-run] re-run with --apply')
        conn.close(); return

    bak = DB + '.bak_talidx'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak); print('backed up ->', bak)
    cur = conn.cursor()
    cur.execute('DROP TABLE IF EXISTS dict_root_index')
    cur.execute('DROP TABLE IF EXISTS dict_root_entries')
    cur.execute('CREATE TABLE dict_root_index (word TEXT, root TEXT, note TEXT)')
    cur.execute('CREATE TABLE dict_root_entries (root TEXT, entry_id INTEGER, tier INTEGER)')
    cur.executemany('INSERT INTO dict_root_index (word, root, note) VALUES (?,?,?)', pairs)
    re = [(root, eid, tier) for root, lst in rmap.items() for eid, tier in lst]
    cur.executemany('INSERT INTO dict_root_entries (root, entry_id, tier) VALUES (?,?,?)', re)
    cur.execute('CREATE INDEX ix_dri_word ON dict_root_index (word)')
    cur.execute('CREATE INDEX ix_dre_root ON dict_root_entries (root)')
    conn.commit()
    print('APPLIED: dict_root_index=%d rows, dict_root_entries=%d rows'
          % (len(pairs), len(re)))
    conn.close()


if __name__ == '__main__':
    main()
