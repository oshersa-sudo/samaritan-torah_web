import sqlite3
import os
import re
import functools
import unicodedata

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS books (
            id      INTEGER PRIMARY KEY,
            name    TEXT NOT NULL,
            order_n INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS portions (
            id          INTEGER PRIMARY KEY,
            book_id     INTEGER NOT NULL REFERENCES books(id),
            name        TEXT NOT NULL,
            order_n     INTEGER NOT NULL,
            start_ch    INTEGER NOT NULL,
            start_v     INTEGER NOT NULL DEFAULT 1,
            end_ch      INTEGER NOT NULL,
            end_v       INTEGER NOT NULL DEFAULT 9999
        );

        CREATE TABLE IF NOT EXISTS chapters (
            id      INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL REFERENCES books(id),
            number  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sam_chapters (
            id         INTEGER PRIMARY KEY,
            book_id    INTEGER NOT NULL REFERENCES books(id),
            number     INTEGER NOT NULL,
            portion_id INTEGER REFERENCES portions(id)   -- explicit Samaritan-portion
                                                         -- override; NULL = derive from
                                                         -- the first verse's Jewish chapter
        );

        CREATE TABLE IF NOT EXISTS verses (
            id          INTEGER PRIMARY KEY,
            chapter_id  INTEGER NOT NULL REFERENCES chapters(id),
            number      INTEGER NOT NULL,
            text        TEXT NOT NULL,
            sam_ch_id   INTEGER REFERENCES sam_chapters(id),
            sam_number  TEXT          -- Samaritan-division verse number override;
                                      -- NULL = display the Jewish `number`
        );

        CREATE INDEX IF NOT EXISTS idx_verses_text ON verses(text);
        CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
        CREATE INDEX IF NOT EXISTS idx_portions_book ON portions(book_id);
    """)
    conn.commit()
    conn.close()


def get_books():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM books ORDER BY order_n").fetchall()
    conn.close()
    return rows


def get_portions(book_id, mode='samaritan'):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM portions WHERE book_id=? AND mode=? ORDER BY order_n",
        (book_id, mode)
    ).fetchall()
    conn.close()
    return rows


def get_chapters(portion_id=None, book_id=None):
    conn = get_connection()
    if portion_id:
        rows = conn.execute(
            """SELECT c.* FROM chapters c
               JOIN portions p ON p.id = ?
               WHERE c.book_id = p.book_id
                 AND c.number >= p.start_ch
                 AND c.number <= p.end_ch
               ORDER BY c.number""",
            (portion_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM chapters WHERE book_id=? ORDER BY number", (book_id,)
        ).fetchall()
    conn.close()
    return rows


def get_verses(chapter_id, portion_id=None):
    conn = get_connection()
    # typeof(v.number)='integer' keeps Samaritan-only inserted verses (numbered
    # like "18-1", stored as TEXT) OUT of the Jewish-division view; they appear
    # only in the Samaritan-division view (get_verses_by_sam_ch).
    if portion_id:
        rows = conn.execute(
            """SELECT v.* FROM verses v
               JOIN chapters c ON c.id = v.chapter_id
               JOIN portions p ON p.id = ?
               WHERE v.chapter_id = ?
                 AND typeof(v.number) = 'integer'
                 AND (c.number > p.start_ch OR v.number >= p.start_v)
                 AND (c.number < p.end_ch   OR v.number <= p.end_v)
               ORDER BY v.number""",
            (portion_id, chapter_id)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM verses WHERE chapter_id=? AND typeof(number)='integer' "
            "ORDER BY number", (chapter_id,)
        ).fetchall()
    conn.close()
    return rows


def get_sam_chapters(book_id):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM sam_chapters WHERE book_id=? ORDER BY number", (book_id,)
    ).fetchall()
    conn.close()
    return rows


def count_sam_chapters_in_portion(portion_id):
    conn = get_connection()
    row = conn.execute(
        """
        SELECT COUNT(DISTINCT sc.id)
        FROM   sam_chapters sc
        JOIN   (SELECT sam_ch_id, MIN(id) AS first_v_id FROM verses GROUP BY sam_ch_id) fv
               ON fv.sam_ch_id = sc.id
        JOIN   verses  v  ON v.id  = fv.first_v_id
        JOIN   chapters c ON c.id  = v.chapter_id
        JOIN   portions p ON p.id  = ?
        WHERE  c.book_id  = p.book_id
          AND  (
                 sc.portion_id = p.id
              OR (sc.portion_id IS NULL
                  AND (c.number > p.start_ch OR (c.number = p.start_ch AND CAST(v.number AS INTEGER) >= p.start_v))
                  AND (c.number < p.end_ch   OR (c.number = p.end_ch   AND CAST(v.number AS INTEGER) <= p.end_v)))
               )
        """,
        (portion_id,)
    ).fetchone()
    conn.close()
    return row[0] if row else 0


def get_sam_chapters_in_portion(portion_id):
    """Samaritan chapters whose first verse falls within the given portion's chapter range."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT DISTINCT sc.*
        FROM   sam_chapters sc
        JOIN   (SELECT sam_ch_id, MIN(id) AS first_v_id FROM verses GROUP BY sam_ch_id) fv
               ON fv.sam_ch_id = sc.id
        JOIN   verses  v  ON v.id  = fv.first_v_id
        JOIN   chapters c ON c.id  = v.chapter_id
        JOIN   portions p ON p.id  = ?
        WHERE  c.book_id  = p.book_id
          AND  (
                 sc.portion_id = p.id
              OR (sc.portion_id IS NULL
                  AND (c.number > p.start_ch OR (c.number = p.start_ch AND CAST(v.number AS INTEGER) >= p.start_v))
                  AND (c.number < p.end_ch   OR (c.number = p.end_ch   AND CAST(v.number AS INTEGER) <= p.end_v)))
               )
        ORDER  BY sc.number
        """,
        (portion_id,)
    ).fetchall()
    conn.close()
    return rows


def get_verses_by_sam_ch(sam_ch_id):
    # Reading order is (Jewish chapter, verse number), NOT id: verses inserted
    # later carry a high id and would otherwise sort after the ׃-- end-mark and
    # out of numeric order. Ordering by number puts every verse in its correct
    # ascending place; the Samaritan chapter still ends at its ׃-- verse, and each
    # verse keeps its own Masoretic/Aramaic columns.
    # Reading order: by Jewish chapter, then the integer part of the verse number
    # ("18" and "18-1" both -> 18), then the maqaf sub-number as an INTEGER (so
    # 18, 18-1, 18-2 … 18-10 sort right; a plain verse has sub 0 and comes first).
    conn = get_connection()
    rows = conn.execute(
        """SELECT v.* FROM verses v JOIN chapters ch ON ch.id = v.chapter_id
           WHERE v.sam_ch_id=?
           ORDER BY ch.number,
                    CAST(v.number AS INTEGER),
                    CASE WHEN instr(v.number,'-')>0
                         THEN CAST(substr(v.number, instr(v.number,'-')+1) AS INTEGER)
                         ELSE 0 END""", (sam_ch_id,)
    ).fetchall()
    conn.close()
    return rows


def get_verse_ref(verse_id):
    """Jewish-division reference for a verse: row with book (Hebrew), chapter, verse."""
    conn = get_connection()
    row = conn.execute(
        """SELECT b.name AS book, c.number AS chapter, v.number AS verse
           FROM verses v JOIN chapters c ON c.id = v.chapter_id
           JOIN books b ON b.id = c.book_id WHERE v.id = ?""", (verse_id,)).fetchone()
    conn.close()
    return row


def get_samaritan_location(verse_id):
    """For a verse, return its Samaritan-division location:
    {sam_ch_id, sam_ch_num, sam_portion_id, sam_portion_name, number}.
    The Samaritan portion is the one whose chapter range contains the Samaritan
    chapter's first verse (matching how browse groups Samaritan chapters)."""
    conn = get_connection()
    row = conn.execute(
        """SELECT v.number, v.sam_ch_id, sc.number AS sam_ch_num, sc.book_id
           FROM verses v JOIN sam_chapters sc ON sc.id = v.sam_ch_id
           WHERE v.id = ?""", (verse_id,)).fetchone()
    if not row:
        conn.close()
        return None
    first = conn.execute(
        """SELECT c.number FROM verses v JOIN chapters c ON c.id = v.chapter_id
           WHERE v.sam_ch_id = ? ORDER BY v.id LIMIT 1""",
        (row['sam_ch_id'],)).fetchone()
    jch = first['number'] if first else None
    # explicit portion override on the Samaritan chapter wins; otherwise derive the
    # portion from the chapter's first-verse Jewish chapter (the default grouping).
    override = conn.execute(
        "SELECT portion_id FROM sam_chapters WHERE id=?", (row['sam_ch_id'],)).fetchone()
    if override and override['portion_id']:
        port = conn.execute(
            "SELECT id, name FROM portions WHERE id=?", (override['portion_id'],)).fetchone()
    else:
        port = conn.execute(
            """SELECT id, name FROM portions WHERE mode='samaritan' AND book_id=?
               AND start_ch <= ? AND end_ch >= ? ORDER BY order_n LIMIT 1""",
            (row['book_id'], jch, jch)).fetchone()
    conn.close()
    return {
        'sam_ch_id':         row['sam_ch_id'],
        'sam_ch_num':        row['sam_ch_num'],
        'number':            row['number'],
        'sam_portion_id':    port['id'] if port else None,
        'sam_portion_name':  port['name'] if port else '',
    }


def get_verse_dictionary(verse_ids):
    """Return {verse_id: [(aramaic, hebrew), ...]} for the given verse ids."""
    if not verse_ids:
        return {}
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    rows = conn.execute(
        f'SELECT verse_id, aramaic, hebrew FROM verse_dictionary WHERE verse_id IN ({placeholders}) ORDER BY id',
        verse_ids
    ).fetchall()
    conn.close()
    result = {}
    for r in rows:
        result.setdefault(r['verse_id'], []).append((r['aramaic'], r['hebrew']))
    return result


def tal_concise(word, conn=None):
    """A SHORT meaning for an Aramaic word, via Tal's authoritative index only
    (word → root → entry). Returns {'root','lemma','gloss'} or None when the word
    is not in the index — so the noisy fallback matches are never shown here.
    Pass an open `conn` to avoid per-word connections."""
    base = _tal_bare(word)
    if not base or len(base) < 2:
        return None
    own = conn is None
    if own:
        conn = get_connection()
    res = None
    # (1) The distilled gloss table covers ~every Targum word with a clean Hebrew
    # meaning (and root) — anchored on the word's Hebrew equivalent and grounded
    # in Tal where available. This is the primary source.
    try:
        g = conn.execute("SELECT root, gloss FROM tal_word_gloss WHERE word = ? LIMIT 1",
                         (base,)).fetchone()
        if g and ((g['root'] or '').strip() or (g['gloss'] or '').strip()):
            res = {'root': (g['root'] or '').strip(), 'lemma': '',
                   'gloss': (g['gloss'] or '').strip()}
    except Exception:
        res = None
    # (2) Fallback: resolve the root from Tal's published index (root only),
    # trying the determined-state / proclitic variants of the surface form.
    if res is None:
        forms = [base]
        if len(base) > 2 and base[0] in 'ובלכדמה':
            forms.append(base[1:])
        if len(base) > 2 and base[-1] in 'אה':
            forms.append(base[:-1])
            if base[0] in 'ובלכדמה' and len(base) > 3:
                forms.append(base[1:-1])
        try:
            for f in forms:
                row = conn.execute(
                    "SELECT dri.root, e.lemma FROM dict_root_index dri "
                    "JOIN dict_root_entries dre ON dre.root = dri.root "
                    "JOIN dict_entries e ON e.id = dre.entry_id "
                    "WHERE dri.word = ? ORDER BY dre.tier LIMIT 1", (f,)).fetchone()
                if row:
                    res = {'root': row['root'] or '', 'lemma': row['lemma'] or '', 'gloss': ''}
                    break
        except Exception:
            pass
    if own:
        conn.close()
    return res


def get_word_table(verse_ids):
    """Per-word table rows for the "מילון מילים" panel. For each Targum word of
    the given verse(s): {word (Hebrew), meaning (Hebrew), aramaic, tal (concise
    Tal gloss via index→root), arabic (word-aligned, where available)}."""
    if not verse_ids:
        return {}
    conn = get_connection()
    has_ar = any(r[1] == 'arabic' for r in conn.execute("PRAGMA table_info(verse_dictionary)"))
    placeholders = ','.join('?' * len(verse_ids))
    cols = 'id, verse_id, aramaic, hebrew' + (', arabic' if has_ar else '')
    rows = conn.execute(
        f'SELECT {cols} FROM verse_dictionary WHERE verse_id IN ({placeholders}) ORDER BY id',
        verse_ids).fetchall()
    out = {}
    for r in rows:
        heb = r['hebrew'] or ''
        parts = [p.strip() for p in heb.split(',', 1)]
        word = parts[0]
        inline = parts[1] if len(parts) > 1 else ''
        tc = tal_concise(r['aramaic'], conn)
        tal = ''
        if tc:
            tal = tc['root'] + (' · ' + tc['gloss'] if tc['gloss'] else '')
        # verse_dictionary rarely carries an inline gloss, so fall back to the
        # distilled Hebrew meaning, then to the word itself — never blank.
        meaning = inline or (tc['gloss'] if tc and tc['gloss'] else word)
        out.setdefault(r['verse_id'], []).append({
            'word': word, 'meaning': meaning, 'aramaic': r['aramaic'] or '',
            'tal': tal, 'arabic': (r['arabic'] if has_ar else '') or '',
        })
    conn.close()
    return out


_TM_HE_LETTER = {'I': 'א', 'II': 'ב', 'III': 'ג', 'IV': 'ד', 'V': 'ה', 'VI': 'ו'}


def get_tibat_marqe(verse_ids):
    """Distinct Tibåt Mårqe sections relevant to any of the given verses,
    ordered by their place in the composition. Each item is a dict:
    {book, section, label, book_title, aramaic, english, hebrew}.
    Returns [] when nothing is relevant (panel should then stay empty)."""
    if not verse_ids:
        return []
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    rows = conn.execute(
        f"""SELECT DISTINCT s.book, s.section, s.book_title, s.sort_key,
                   s.aramaic, s.english, s.hebrew
            FROM tm_sections s
            JOIN tm_verse_links l ON l.section_id = s.id
            WHERE l.verse_id IN ({placeholders})
            ORDER BY s.sort_key""",
        verse_ids
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        letter = _TM_HE_LETTER.get(r['book'], r['book'])
        out.append({
            'book': r['book'],
            'section': r['section'],
            'book_title': r['book_title'],
            'label': 'ספר %s, §%s' % (letter, r['section']),
            'aramaic': r['aramaic'] or '',
            'english': r['english'] or '',
            'hebrew': r['hebrew'] or '',
        })
    return out


def get_eyalk_commentary(verse_ids):
    """Samaritan-tradition commentary ("מן המסורת השומרונית") relevant to any of
    the given verses, in reading order. Each item is a dict {parsha, text}.
    A commentary bullet linked to several of the verses appears once. Returns []
    when nothing is relevant."""
    if not verse_ids:
        return []
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    rows = conn.execute(
        f"""SELECT DISTINCT s.id, s.parsha, s.ord, s.text
            FROM eyalk_sections s
            JOIN eyalk_verse_links l ON l.section_id = s.id
            WHERE l.verse_id IN ({placeholders})
            ORDER BY s.ord""",
        verse_ids
    ).fetchall()
    conn.close()
    return [{'parsha': r['parsha'] or '', 'text': r['text'] or ''} for r in rows]


def get_tzdaka_commentary(verse_ids):
    """פירוש צדקה אל-חכים (Ṣadaqah al-Ḥakīm on Genesis) relevant to any of the
    given verses, in reading order. Each item is {ref, title, text}. A section
    linked to several of the verses appears once. Returns [] when nothing is
    relevant (panel then stays empty)."""
    if not verse_ids:
        return []
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            f"""SELECT DISTINCT s.id, s.ref, s.title, s.ord, s.text
                FROM tzdaka_sections s
                JOIN tzdaka_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders})
                ORDER BY s.ord""",
            verse_ids
        ).fetchall()
    except Exception:
        rows = []
    conn.close()
    return [{'ref': r['ref'] or '', 'title': r['title'] or '', 'text': r['text'] or ''}
            for r in rows]


_APP_TYPE = {'sub': 'חילוף', 'om': 'חיסור', 'add': 'תוספת', 'sic': 'sic!',
             'transp': 'היפוך סדר', 'del': 'מחיקה', 'orth': 'כתיב/ניקוד'}


def get_apparatus(verse_ids):
    """von Gall textual-variant apparatus (חילופי נוסח) for the given verse(s).
    Each item is a variant keyed to a word (lemma = its position marker) in the
    verse: {verse, lemma, occurrence, reading, type, type_label, witnesses[],
    register, confidence, note}. Ordered by verse, then apparatus register, then
    position. Returns [] when nothing is relevant (panel then stays empty)."""
    if not verse_ids:
        return []
    import json
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            f"""SELECT a.*, v.number AS vnum FROM vongall_apparatus a
                JOIN verses v ON v.id = a.verse_id
                WHERE a.verse_id IN ({placeholders})
                ORDER BY a.verse_id, a.register, a.sort_pos""",
            verse_ids).fetchall()
    except Exception:
        rows = []
    conn.close()
    out = []
    for r in rows:
        try:
            wit = json.loads(r['witnesses'] or '[]')
        except Exception:
            wit = []
        out.append({
            'verse': r['vnum'], 'lemma': r['lemma'] or '', 'occurrence': r['occurrence'] or '',
            'reading': r['reading'] or '', 'type': r['reading_type'] or '',
            'type_label': _APP_TYPE.get(r['reading_type'], ''), 'witnesses': wit,
            'register': r['register'], 'confidence': r['confidence'] or '', 'note': r['note'] or '',
        })
    return out


# ── plain-search wildcards ─────────────────────────────────────────────────────
# '?' = exactly one Hebrew letter; '*' = any run of letters (an unknown string).
# A pattern of ONLY '?' matches a WHOLE word of that length ('????' = any 4-letter
# word). A '?'-with-letters pattern matches as a SUBSTRING inside a word
# ('מ?כלת' finds הַמַּאֲכֶלֶת). A pattern with '*' is a glob, anchored to the word's
# edges except where '*' stands: 'כא*' = starts with כא, '*כא' = ends with כא,
# '*כא*' = contains כא.
def _all_wild(pattern):
    return bool(pattern) and all(c == '?' for c in pattern)


@functools.lru_cache(maxsize=512)
def _wild_search_re(pattern):
    """Regex used to find the ?/*-pattern inside a verse text."""
    if '*' in pattern:                                   # glob: anchor where no '*'
        left  = not pattern.startswith('*')
        right = not pattern.endswith('*')
        core  = pattern.strip('*')
        body  = ''.join('[א-ת]' if c == '?' else ('[א-ת]*' if c == '*' else re.escape(c))
                        for c in core)
        rx = ('(?<![א-ת])' if left else '') + body + ('(?![א-ת])' if right else '')
        return re.compile(rx)
    if _all_wild(pattern):
        return re.compile(r'(?<![א-ת])[א-ת]{%d}(?![א-ת])' % len(pattern))
    body = ''.join('[א-ת]' if c == '?' else re.escape(c) for c in pattern)
    return re.compile(body)            # all chars Hebrew -> stays within one word


def wildword_is(word_letters, pattern):
    """Whether a single word satisfies the ?-pattern (used for highlighting):
    an all-'?' pattern -> the word is exactly that length; otherwise -> the
    pattern occurs somewhere inside the word."""
    w = word_letters or ''
    if _all_wild(pattern):
        return len(w) == len(pattern)
    return _wild_search_re(pattern).search(w) is not None


_FINALS_TR = str.maketrans('ךםןףץ', 'כמנפצ')


def _fold_finals(s):
    """Map word-final Hebrew letters to their base form (ך→כ, ם→מ … ץ→צ), so a
    query and the text compare equal regardless of final-letter spelling."""
    return (s or '').translate(_FINALS_TR)


def search_verses(query, exact=False, root=False, aramaic=False, root_letters=None,
                  ignore_finals=False):
    """Search verses. aramaic=True searches the Aramaic translation field
    instead of the Hebrew text; root=True matches by Hebrew root (all words
    sharing the root). root_letters, when given, is the (possibly user-edited)
    root to use instead of extracting one from the query. ignore_finals=True
    makes a plain/exact search final-letter-insensitive (הציף matches הציפ)."""
    field = 'v.sam_aramaic' if aramaic else 'v.text'
    conn = get_connection()
    if ignore_finals:
        conn.create_function('FOLD', 1, _fold_finals)
    fld = 'FOLD(%s)' % field if ignore_finals else field   # column expr to match on
    sel_extra = ''
    order_by = 'b.order_n, c.number, v.number'
    # '?' / '*' / '+' are search operators incompatible with exact / root / plain-
    # literal matching, so when present they take precedence — a '?' search must
    # keep working even if "חיפוש מדויק" / "לפי שורש" / "בתרגום הארמי" is ticked.
    has_special = any(c in query for c in '?*+')
    if root and not has_special:
        from app.services.hebrew_root import extract_root, to_skeleton, normalize, text_has_root
        if aramaic:
            # Aramaic translation field — the root index is Hebrew-only, so this
            # path keeps the heuristic skeleton match on the Aramaic text.
            rl = to_skeleton(root_letters) if root_letters else extract_root(query)
            if not rl:
                conn.close()
                return []
            conn.create_function('ROOTMATCH', 2,
                                 lambda cell, r: 1 if text_has_root(cell, r) else 0)
            where = f"ROOTMATCH({field}, ?)"
            params = [rl]
        else:
            # Hebrew root search: the root is taken from the root index and the
            # results are the lexicographer's exact occurrence list for it.
            rn = normalize(root_letters) if root_letters else normalize(root_from_index(query) or '')
            if not rn:
                conn.close()
                return []
            where = "v.id IN (SELECT verse_id FROM root_index WHERE root_norm = ?)"
            # order by the index itself (occurrence id) so the LIMIT keeps the
            # forms in the index's own order rather than by chapter/verse.
            sel_extra = (", (SELECT MIN(ri.id) FROM root_index ri "
                         "WHERE ri.verse_id = v.id AND ri.root_norm = ?) AS _ord")
            order_by = '_ord'
            params = [rn, rn]   # first binds the SELECT subquery, then the WHERE
    elif exact and not has_special:
        q = _fold_finals(query) if ignore_finals else query
        where = f"(' ' || {fld} || ' ') LIKE ?"
        params = [f"% {q} %"]
    elif not has_special:
        # plain substring — a literal Hebrew or Aramaic query (no ? / * / +).
        q = _fold_finals(query) if ignore_finals else query
        where = f"{fld} LIKE ?"
        params = [f"%{q}%"]
    else:
        # enhanced search: '?' = one letter, '*' = an unknown string (glob); '+'
        # joins terms that must ALL appear. Runs on the chosen field (Hebrew text
        # or the Aramaic translation), overriding the exact/root flags.
        terms = [t.strip() for t in query.split('+') if t.strip()]
        conds, params = [], []
        if any(('?' in t or '*' in t) for t in terms):
            conn.create_function(
                'WILDWORD', 2,
                lambda text, pat: 1 if (text and _wild_search_re(pat).search(text)) else 0)
        for t in terms:
            pat = ''.join(c for c in t if ('א' <= c <= 'ת') or c in '?*')
            if ('?' in t or '*' in t) and pat:
                conds.append(f"WILDWORD({field}, ?)")
                params.append(pat)
            else:
                conds.append(f"{field} LIKE ?")
                params.append(f"%{t}%")
        if conds:
            where = ' AND '.join(conds)
        else:
            where = f"{field} LIKE ?"
            params = [f"%{query}%"]
    rows = conn.execute(
        f"""
        SELECT v.id, v.number, v.text, v.sam_aramaic,
               c.number AS chapter_num,
               c.id     AS chapter_id,
               b.name   AS book_name,
               b.id     AS book_id,
               p.name   AS portion_name,
               p.id     AS portion_id{sel_extra}
        FROM   verses v
        JOIN   chapters c ON c.id = v.chapter_id
        JOIN   books    b ON b.id = c.book_id
        LEFT JOIN (
            SELECT id, name, book_id, start_ch, end_ch
            FROM portions WHERE mode='jewish'
        ) p ON p.book_id = b.id
           AND p.start_ch <= c.number
           AND p.end_ch   >= c.number
        WHERE  {where}
        GROUP  BY v.id
        ORDER  BY {order_by}
        LIMIT  200
        """,
        params,
    ).fetchall()
    conn.close()
    return rows


def get_root_prons(root_norm, verse_ids):
    """For each verse id, the Latin pronunciation(s) of that root's occurrence
    from the index — used to show the transliteration under a search result."""
    if not root_norm or not verse_ids:
        return {}
    conn = get_connection()
    ph = ','.join('?' * len(verse_ids))
    rows = conn.execute(
        f"""SELECT verse_id, pron FROM root_index
            WHERE root_norm = ? AND pron IS NOT NULL AND TRIM(pron) <> ''
              AND verse_id IN ({ph})""",
        [root_norm] + list(verse_ids)).fetchall()
    conn.close()
    out, seen = {}, set()
    for r in rows:
        key = (r['verse_id'], r['pron'])
        if key in seen:
            continue
        seen.add(key)
        out.setdefault(r['verse_id'], []).append(r['pron'])
    return out


_BINYAN_MAP = None


def _binyan_map():
    """Cached root_index.id -> effective binyan/tense. The index records a binyan
    only on the header row of each tense group; the rows that follow in the same
    group leave it blank. We forward-fill it by index order within each root, and
    reset it at a bold sub-lemma (a `form` value — a noun sub-entry that carries
    no binyan), so the parsing shown next to a result is always filled in."""
    global _BINYAN_MAP
    if _BINYAN_MAP is None:
        conn = get_connection()
        try:
            rows = conn.execute(
                "SELECT id, root_norm, binyan, form FROM root_index "
                "ORDER BY root_norm, id").fetchall()
            m = {}
            cur_root, cur_bin = None, None
            for r in rows:
                if r['root_norm'] != cur_root:
                    cur_root, cur_bin = r['root_norm'], None
                if (r['form'] or '').strip():
                    cur_bin = None          # noun sub-lemma -> binyan no longer applies
                b = (r['binyan'] or '').strip()
                if b:
                    cur_bin = b
                if cur_bin:
                    m[r['id']] = cur_bin
            _BINYAN_MAP = m
        except Exception:
            _BINYAN_MAP = {}
        conn.close()
    return _BINYAN_MAP


def get_root_occurrences(root_norm, verses):
    """`verses` is [(verse_id, text), ...]. For each verse, match the root's index
    occurrences to the verse's *actual words* (by transliteration), so the right
    word is highlighted and only the matching inflection is shown. Returns
    {verse_id: {'order': <index id>, 'subroot': <sub-lemma root or ''>,
                'words': [matched words], 'occ': [(pron, binyan, form), ...]}}."""
    if not root_norm or not verses:
        return {}
    text_of = {v: t for v, t in verses}
    vids = list(text_of)
    conn = get_connection()
    ph = ','.join('?' * len(vids))
    rows = conn.execute(
        f"""SELECT id, verse_id, pron, binyan, form, sublemma FROM root_index
            WHERE root_norm = ? AND pron IS NOT NULL AND TRIM(pron) <> ''
              AND verse_id IN ({ph}) ORDER BY id""",
        [root_norm] + vids).fetchall()
    conn.close()
    bm = _binyan_map()
    by_verse = {}
    for r in rows:
        by_verse.setdefault(r['verse_id'], []).append(r)

    from app.services.hebrew_root import to_skeleton, word_matches_root
    root_skel = to_skeleton(root_norm)

    out = {}
    for vid, occ_rows in by_verse.items():
        words_in_verse = re.findall('[א-ת]+', text_of.get(vid) or '')
        # for each index occurrence, pick the *single* verse word it best matches,
        # so we never light up an unrelated word that merely shares a consonant. A
        # word that actually carries the root (skeleton match) is always preferred.
        matched = []   # (index_id, word, pron, binyan, sublemma)
        for r in occ_rows:
            pc = _lat_cons(r['pron'])
            best = None   # ((skel, base, lead, span), word)
            for w in words_in_verse:
                sk = 1 if word_matches_root(w, root_skel) else 0
                key = (sk,) + _word_pron_score(w, r['pron'], pc)
                if best is None or key > best[0]:
                    best = (key, w)
            if best is None:
                continue
            sk, base = best[0][0], best[0][1]
            # keep this occurrence only if the verse really has the form: a word
            # bearing the root, or a strong transliteration match. Otherwise the
            # index location is an OCR error (the form isn't here) -> skip it, and
            # if no occurrence survives the whole verse is dropped from results.
            if not (sk or base >= 0.67):
                continue
            matched.append((r['id'], best[1], r['pron'], bm.get(r['id']), r['sublemma']))
        if not matched:
            continue
        matched.sort(key=lambda m: m[0])
        # the sub-lemma header (e.g. עלילה under root עלל) comes straight from the
        # index now (root_index.sublemma), not guessed from the inflected form
        sr = next((sub for _i, _w, _p, _b, sub in matched if sub), '')
        words, occ, seen, wseen = [], [], set(), set()
        for _id, w, pron, b, sub in matched:
            if w not in wseen:
                wseen.add(w)
                words.append(w)
            k = (pron, b)
            if k not in seen:
                seen.add(k)
                occ.append((pron, b, ''))
        out[vid] = {'order': matched[0][0], 'subroot': sr, 'words': words, 'occ': occ}
    return out


def _word_pron_score(word, pron, pron_cons=None):
    """Rank how well a Hebrew word matches a transliteration. Primary signal is
    consonant-skeleton similarity; ties (common with short roots whose skeleton
    is a single consonant) are broken by whether both start the same way — a
    vowel-initial transliteration lines up with a guttural/mater-initial word —
    and then by closeness of length. Returns a comparable tuple (higher = better)."""
    pc = pron_cons if pron_cons is not None else _lat_cons(pron)
    base, wc = _word_cons(word, pc)
    p = unicodedata.normalize('NFD', pron or '')
    p = ''.join(c for c in p if unicodedata.category(c) != 'Mn').lower()
    # a vowel OR a glottal marker (ʿ=ע, ʾ/'=א, h=ה) opens a guttural-initial word
    pron_vowel_start = bool(p) and p[0] in "aeiouɔəɛʿʾʔ'`h"
    word_guttural_start = bool(word) and word[0] in 'אהעוי'
    lead = 1 if (pron_vowel_start == word_guttural_start) else 0
    span = -abs(len(wc) - len(pc))
    return (base, lead, span)


def get_word_occurrences(word, verse_ids):
    """For a non-root search: for each verse, the index occurrence whose
    transliteration matches the typed word. Same shape as get_root_occurrences."""
    word = (word or '').strip()
    if not word or not verse_ids:
        return {}
    conn = get_connection()
    ph = ','.join('?' * len(verse_ids))
    rows = conn.execute(
        f"""SELECT id, verse_id, root_norm, pron, binyan, form FROM root_index
            WHERE verse_id IN ({ph}) AND pron IS NOT NULL AND TRIM(pron) <> ''""",
        list(verse_ids)).fetchall()
    conn.close()
    bm = _binyan_map()
    best = {}   # verse_id -> (sim, pron, binyan, form)
    for r in rows:
        s, _ = _word_cons(word, _lat_cons(r['pron']))
        if s >= 0.5 and s > best.get(r['verse_id'], (-1.0,))[0]:
            best[r['verse_id']] = (s, r['pron'], bm.get(r['id']), r['form'])
    return {vid: {'order': 0, 'subroot': '', 'words': [], 'occ': [(p, b, f)]}
            for vid, (s, p, b, f) in best.items()}


_ROOT_INVENTORY = None


def _root_inventory():
    """Cached [(root_skel, root, count), ...] from the root index."""
    global _ROOT_INVENTORY
    if _ROOT_INVENTORY is None:
        conn = get_connection()
        try:
            rows = conn.execute(
                """SELECT root_skel, root, COUNT(*) c FROM root_index
                   WHERE root_skel IS NOT NULL AND root_skel <> ''
                   GROUP BY root_skel, root""").fetchall()
            _ROOT_INVENTORY = [(r['root_skel'], r['root'], r['c']) for r in rows]
        except Exception:
            _ROOT_INVENTORY = []
        conn.close()
    return _ROOT_INVENTORY


def _root_by_skeleton(word):
    """Fallback: the longest index root whose consonant skeleton appears as a
    contiguous part of the word's skeleton (ties broken by frequency)."""
    from app.services.hebrew_root import to_skeleton
    w = to_skeleton(word)
    if not w:
        return ''
    best = None
    for skel, root, cnt in _root_inventory():
        if len(skel) >= 2 and skel in w:
            key = (len(skel), cnt)
            if best is None or key > best[0]:
                best = (key, root)
    return best[1] if best else ''


# Hebrew letters and Latin transliteration letters mapped to a shared consonant
# class, so a typed Hebrew word can be matched against an occurrence's pron.
_HEB_CONS = {'ב': 'b', 'ג': 'g', 'ד': 'd', 'ז': 'z', 'ח': '', 'ט': 't', 'י': 'y',
             'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n',
             'ס': 's', 'פ': 'f', 'ף': 'f', 'צ': 's', 'ץ': 's', 'ק': 'q', 'ר': 'r',
             'ש': 's', 'ת': 't', 'א': '', 'ה': '', 'ע': '', 'ו': ''}


def _dedupe(seq):
    out = []
    for c in seq:
        if not out or out[-1] != c:
            out.append(c)
    return ''.join(out)


def _heb_cons(w):
    w = re.sub('[֑-ׇ]', '', w or '')
    return _dedupe(c for c in (_HEB_CONS.get(ch, '') for ch in w) if c)


def _heb_cons_nomater(w):
    """Like _heb_cons but also drops the mater-lectionis yod, for words where the
    transliteration renders yod as a vowel (עלילת -> ʿālīlåt, not '...y...')."""
    w = re.sub('[֑-ׇ]', '', w or '')
    return _dedupe(c for c in (('' if ch == 'י' else _HEB_CONS.get(ch, '')) for ch in w) if c)


def _word_cons(word, pc):
    """The word's consonant skeleton scored against pron-consonants pc, trying it
    both with and without the mater yod and keeping the better match. Returns
    (similarity, skeleton_used) so callers can also gauge length closeness."""
    c1, c2 = _heb_cons(word), _heb_cons_nomater(word)
    s1, s2 = _cons_sim(c1, pc), _cons_sim(c2, pc)
    return (s2, c2) if s2 >= s1 else (s1, c1)


def _lat_cons(p):
    p = unicodedata.normalize('NFD', p or '')
    p = ''.join(c for c in p if unicodedata.category(c) != 'Mn').lower()
    out = []
    for c in p:
        if c in 'bß':       out.append('b')
        elif c in 'fpv':    out.append('f')
        elif c in 'gɡ':     out.append('g')
        elif c in 'dð':     out.append('d')
        elif c == 'z':      out.append('z')
        elif c == 't':      out.append('t')
        elif c == 'k':      out.append('k')
        elif c == 'l':      out.append('l')
        elif c == 'm':      out.append('m')
        elif c == 'n':      out.append('n')
        elif c in 'sšśşçc': out.append('s')
        elif c == 'q':      out.append('q')
        elif c == 'r':      out.append('r')
        elif c in 'yj':     out.append('y')
        # vowels, w, h, glottal/modifier letters -> dropped
    return _dedupe(out)


def _lcs(a, b):
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    for ca in a:
        cur = [0] * (len(b) + 1)
        for j, cb in enumerate(b):
            cur[j + 1] = prev[j] + 1 if ca == cb else (cur[j] if cur[j] > prev[j + 1] else prev[j + 1])
        prev = cur
    return prev[-1]


def _cons_sim(a, b):
    if not a or not b:
        return 0.0
    return _lcs(a, b) / max(len(a), len(b))


# ── Samaritan-Aramaic dictionary (A. Tal) lookup ──────────────────────────────
# Reads only the dict_* tables; added for the "tap an Aramaic word -> its entry
# in Tal's dictionary" feature. Does not touch any Torah-project table.

_TAL_CACHE = None
_WEAK_TAL = str.maketrans('', '', 'אהויםןףךץ')   # matres lectionis + finals


def _tal_bare(w):
    """Strip niqqud/cantillation and surrounding punctuation from a word."""
    w = re.sub('[֑-ׇ]', '', w or '')
    return w.strip(' .,;:!?"\'־׳״-()[]')


def _tal_skel(w):
    return _tal_bare(w).translate(_WEAK_TAL)


def _tal_entries():
    """Cached [{id,lemma,gloss_en,pos,page,notes,_bare,_skel}, ...]."""
    global _TAL_CACHE
    if _TAL_CACHE is None:
        conn = get_connection()
        try:
            rows = conn.execute(
                "SELECT id, lemma, gloss_en, pos, page, notes FROM dict_entries"
            ).fetchall()
            _TAL_CACHE = []
            for r in rows:
                e = dict(r)
                e['_bare'] = _tal_bare(e['lemma'])
                e['_skel'] = _tal_skel(e['lemma'])
                _TAL_CACHE.append(e)
        except Exception:
            _TAL_CACHE = []
        conn.close()
    return _TAL_CACHE


def lookup_tal_dictionary(word, limit=6):
    """Entries for an Aramaic word from Tal's dictionary, best-effort.
    Match tiers: exact (niqqud-stripped) lemma, then the word appearing verbatim
    inside a citation quote, then a consonant-skeleton match. Each result carries
    the lemma, part of speech, English gloss, full entry text (notes) and up to a
    few citations."""
    bare = _tal_bare(word)
    if not bare or len(bare) < 2:
        return []
    sk = _tal_skel(word)
    entries = _tal_entries()
    byid = {e['id']: e for e in entries}
    hits = []

    # (1) Authoritative root index (Tal's own index): word -> root -> entry.
    # This is the primary path; it resolves an inflected Aramaic word to its
    # root and returns that root's dictionary entry. Falls through silently if
    # the index tables are absent or the word is not indexed.
    try:
        conn = get_connection()
        ids = [r['entry_id'] for r in conn.execute(
            "SELECT dre.entry_id FROM dict_root_index dri "
            "JOIN dict_root_entries dre ON dre.root = dri.root "
            "WHERE dri.word = ? ORDER BY dre.tier", (bare,))]
        conn.close()
        seen = set()
        for i in ids:
            if i in byid and i not in seen:
                seen.add(i); hits.append(byid[i])
    except Exception:
        pass

    # (2) Fallbacks for words not in the index: exact lemma, then the word
    # appearing inside a citation quote, then a consonant-skeleton match.
    if not hits:
        hits = [e for e in entries if e['_bare'] == bare]
    if not hits:
        conn = get_connection()
        ids = [r['id'] for r in conn.execute(
            "SELECT DISTINCT f.entry_id AS id FROM dict_citations ci "
            "JOIN dict_forms f ON f.id = ci.form_id "
            "WHERE ci.quote LIKE ? LIMIT 30", (f'%{bare}%',))]
        conn.close()
        hits = [byid[i] for i in ids if i in byid]
    if not hits and len(sk) >= 2:
        hits = [e for e in entries if e['_skel'] == sk]

    out = []
    conn = get_connection()
    for e in hits[:limit]:
        cites = conn.execute(
            "SELECT ci.quote, ci.source_ref FROM dict_citations ci "
            "JOIN dict_forms f ON f.id = ci.form_id "
            "WHERE f.entry_id = ? ORDER BY ci.order_n LIMIT 3", (e['id'],)).fetchall()
        out.append({
            'lemma':     e['lemma'],
            'pos':       e['pos'],
            'gloss_en':  e['gloss_en'],
            'page':      e['page'],
            'notes':     e['notes'],
            'citations': [(c['quote'], c['source_ref']) for c in cites],
        })
    conn.close()
    return out


def root_from_index(word):
    """A word's root from the index: find where the word occurs in the text, then
    match the typed word to the transliteration (pron) recorded for the occurrence
    there and read off that occurrence's root. Falls back to skeleton matching
    when the word isn't found in the text. Runs as the user types."""
    word = (word or '').strip()
    if not word:
        return ''
    conn = get_connection()
    vids = [r['id'] for r in conn.execute(
        "SELECT id FROM verses WHERE (' ' || text || ' ') LIKE ?", ('% ' + word + ' %',))]
    if vids:
        wc = _heb_cons(word)
        ph = ','.join('?' * len(vids))
        sims, vsets = {}, {}
        for r in conn.execute(
                f"""SELECT root, pron, verse_id FROM root_index
                    WHERE verse_id IN ({ph}) AND pron IS NOT NULL AND TRIM(pron) <> ''""", vids):
            s = _cons_sim(wc, _lat_cons(r['pron']))
            if s > sims.get(r['root'], -1.0):
                sims[r['root']] = s
            vsets.setdefault(r['root'], set()).add(r['verse_id'])
        conn.close()
        if sims:
            root = max(sims, key=lambda rt: (sims[rt], len(vsets[rt])))
            if sims[root] >= 0.5:
                return root
    else:
        conn.close()
    return _root_by_skeleton(word)
