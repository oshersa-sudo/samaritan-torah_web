# -*- coding: utf-8 -*-
"""
Load the extracted root index (data/root_index_raw.jsonl, produced by
extract_index.py) into the root_index table of data/torah.db, one row per
(root, form, book, chapter, verse). Each row's verse is resolved to a verses.id
so the search can jump straight to the verse.

Re-runnable: it rebuilds the table from the current JSONL each time.
"""
import os, io, json, sqlite3, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from app.services.hebrew_root import normalize, to_skeleton  # normalise + consonant skeleton

DB = os.path.join(ROOT, 'data', 'torah.db')
JSONL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'root_index_raw.jsonl')

# A real root is a short consonant cluster. These tokens mark a binyan/parsing
# label that the model sometimes mis-promotes into the "root" field; when a
# "root" is made only of such tokens it is really a binyan for the forms below
# the last genuine root header.
BINYAN_TOKENS = {'קל', 'נפעל', 'פיעל', 'פועל', 'פעל', 'הפעיל', 'הופעל',
                 'התפעל', 'עבר', 'עתיד', 'הווה', 'ציווי', 'מקור',
                 'בינוני', 'פעול', 'סביל', 'ב', 'א'}


def is_binyan_label(s):
    toks = s.split()
    return bool(toks) and all(t in BINYAN_TOKENS for t in toks)


BOOKS = {'בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים'}


def parse_locs(fm):
    """Yield (book, chapter, verse) for a form, supporting both the compact
    'locs' string and the older verbose 'locations' list."""
    s = fm.get('locs')
    if isinstance(s, str):
        cur = None
        for t in s.replace(';', ' ').split():
            if t in BOOKS:
                cur = t
            elif cur and ':' in t:
                ch_s, vs_s = t.split(':', 1)
                if ch_s.isdigit():
                    ch = int(ch_s)
                    for v in vs_s.split(','):
                        v = v.strip()
                        if v.isdigit():
                            yield (cur, ch, int(v))
        return
    for L in fm.get('locations') or []:
        book = (L.get('book') or '').strip()
        ch = L.get('ch')
        for vs in (L.get('verses') or []):
            yield (book, ch, vs)

SCHEMA = """
DROP TABLE IF EXISTS root_index;
CREATE TABLE root_index (
    id        INTEGER PRIMARY KEY,
    root      TEXT NOT NULL,
    root_norm TEXT NOT NULL,
    root_skel TEXT,
    form      TEXT,
    form_norm TEXT,
    pron      TEXT,
    binyan    TEXT,
    book      TEXT,
    chapter   INTEGER,
    verse     INTEGER,
    verse_id  INTEGER
);
CREATE INDEX idx_rootidx_root_norm ON root_index(root_norm);
CREATE INDEX idx_rootidx_root_skel ON root_index(root_skel);
CREATE INDEX idx_rootidx_form_norm ON root_index(form_norm);
CREATE INDEX idx_rootidx_verse     ON root_index(verse_id);
"""


def main():
    conn = sqlite3.connect(DB)
    conn.executescript(SCHEMA)
    # cache (book_name, chapter, verse) -> verse_id
    loc = {}
    for r in conn.execute(
            """SELECT v.id, b.name AS book, c.number AS ch, v.number AS vs
               FROM verses v JOIN chapters c ON c.id=v.chapter_id
               JOIN books b ON b.id=c.book_id"""):
        loc[(r[1], r[2], r[3])] = r[0]

    rows = []
    pages = forms = locs = unresolved = 0
    parse_errors = []
    for line in io.open(JSONL, encoding='utf-8'):
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        data = rec.get('data', {})
        if '_parse_error' in data:
            parse_errors.append(rec['page'])
            continue
        pages += 1
        last_root = ''   # forward-fill: sub-entries carry root:null under the last header
        for ro in data.get('roots', []):
            root = (ro.get('root') or '').strip()
            grp_binyan = None
            if not root:
                root = last_root
            elif is_binyan_label(root):
                grp_binyan = root        # it was a binyan, not a root
                root = last_root
            else:
                last_root = root
            rnorm = normalize(root)
            rskel = to_skeleton(root)
            for fm in ro.get('forms', []):
                forms += 1
                form = (fm.get('form') or '').strip() or None
                fnorm = normalize(form) if form else None
                pron = (fm.get('pron') or '').strip() or None
                binyan = (fm.get('binyan') or '').strip() or grp_binyan or None
                for book, ch, vs in parse_locs(fm):
                    locs += 1
                    vid = loc.get((book, ch, vs))
                    if vid is None:
                        unresolved += 1
                    rows.append((root, rnorm, rskel, form, fnorm, pron, binyan,
                                 book, ch, vs, vid))
    conn.executemany(
        """INSERT INTO root_index
           (root,root_norm,root_skel,form,form_norm,pron,binyan,book,chapter,verse,verse_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""", rows)
    conn.commit()
    distinct_roots = conn.execute(
        "SELECT COUNT(DISTINCT root_norm) FROM root_index").fetchone()[0]
    conn.close()
    print("pages ingested : %d  (parse errors on pages %s)" % (pages, parse_errors or 'none'))
    print("distinct roots : %d" % distinct_roots)
    print("forms          : %d" % forms)
    print("location rows  : %d  (unresolved to a verse: %d, %.1f%%)" %
          (locs, unresolved, 100.0 * unresolved / max(locs, 1)))


if __name__ == '__main__':
    main()
