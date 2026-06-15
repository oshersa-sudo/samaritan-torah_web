# -*- coding: utf-8 -*-
"""
Populate root_index.sublemma from the raw extraction (data/root_index_raw.jsonl).

In the printed index a root's section can contain bold sub-lemma HEADWORDS — a
derived word (e.g. עֲלִילָה under root עלל) given as a heading, with its own
inflected occurrences listed beneath it. The extractor captured a headword as a
form that has a `form` value but NO locations; the occurrences beneath it are the
following forms (which DO have locations). The original import dropped the
headwords (no location -> no row), losing the grouping.

This script replays each root's form sequence, tracks the current sub-lemma
headword, and tags every occurrence row beneath it (matched by root/pron/verse)
with that headword in a new `sublemma` column, so the search can show it as a
sub-header exactly as in the index. Idempotent; only writes the sublemma column.

Usage:  py -3 scripts/populate_sublemma.py
"""
import os, io, json, sqlite3, sys, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from app.services.hebrew_root import normalize
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DB = os.path.join(ROOT, 'data', 'torah.db')
JSONL = os.path.join(ROOT, 'data', 'root_index_raw.jsonl')
NIKUD = re.compile('[֑-ׇ]')
BOOKS = {'בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים'}


def strip_nikud(s):
    return NIKUD.sub('', s or '').strip()


def parse_locs(fm):
    s = fm.get('locs')
    if isinstance(s, str):
        cur = None
        for t in s.replace(';', ' ').split():
            if t in BOOKS:
                cur = t
            elif cur and ':' in t:
                ch_s, vs_s = t.split(':', 1)
                if ch_s.isdigit():
                    for v in vs_s.split(','):
                        v = v.strip()
                        if v.isdigit():
                            yield (cur, int(ch_s), int(v))
        return
    for L in fm.get('locations') or []:
        for vs in (L.get('verses') or []):
            yield ((L.get('book') or '').strip(), L.get('ch'), vs)


def has_locs(fm):
    return any(True for _ in parse_locs(fm))


def main():
    conn = sqlite3.connect(DB)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(root_index)")]
    if 'sublemma' not in cols:
        conn.execute("ALTER TABLE root_index ADD COLUMN sublemma TEXT")
        conn.commit()
        print('added column root_index.sublemma')

    # build occurrence -> sublemma map from the JSONL
    updates = []          # (sublemma, root_norm, pron, book, chapter, verse)
    headwords = occs = tagged = 0
    for line in io.open(JSONL, encoding='utf-8'):
        line = line.strip()
        if not line:
            continue
        for ro in json.loads(line).get('data', {}).get('roots', []):
            rnorm = normalize((ro.get('root') or '').strip())
            cur_sub = None
            for fm in ro.get('forms', []):
                form = strip_nikud(fm.get('form') or '')
                locd = has_locs(fm)
                if form and not locd:          # a bold sub-lemma headword
                    cur_sub = form
                    headwords += 1
                    continue
                if not cur_sub:                # plain root-level occurrence
                    continue
                pron = (fm.get('pron') or '').strip()
                for book, ch, vs in parse_locs(fm):
                    occs += 1
                    updates.append((cur_sub, rnorm, pron, book, ch, vs))

    cur = conn.cursor()
    for sub, rnorm, pron, book, ch, vs in updates:
        cur.execute(
            """UPDATE root_index SET sublemma=?
               WHERE root_norm=? AND pron=? AND book=? AND chapter=? AND verse=?
                 AND (sublemma IS NULL OR sublemma=?)""",
            (sub, rnorm, pron, book, ch, vs, sub))
        tagged += cur.rowcount
    conn.commit()
    n_rows = conn.execute(
        "SELECT COUNT(*) FROM root_index WHERE sublemma IS NOT NULL").fetchone()[0]
    n_subs = conn.execute(
        "SELECT COUNT(DISTINCT sublemma) FROM root_index WHERE sublemma IS NOT NULL").fetchone()[0]
    print('headwords seen: %d   sub-lemma occurrences in JSONL: %d' % (headwords, occs))
    print('rows tagged with a sublemma: %d  (distinct sub-lemmas: %d)' % (n_rows, n_subs))
    conn.close()


if __name__ == '__main__':
    main()
