import sqlite3
import os
import re
import functools
import shutil
import unicodedata

# The DB bundled in the repo (pulled via git LFS at build). On a deployment with a
# persistent disk, set DB_PATH to a path on that disk so online admin edits survive
# restarts; the disk is seeded once from the bundled copy (see _seed_db).
_BUNDLED_DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')
DB_PATH = os.environ.get('DB_PATH') or _BUNDLED_DB


def _seed_db():
    """When DB_PATH points at a persistent disk and is still empty (first boot or a
    fresh disk), copy the bundled DB onto it. Later boots use the disk copy, so admin
    edits persist across restarts/redeploys."""
    if DB_PATH == _BUNDLED_DB:
        return
    try:
        if not os.path.exists(DB_PATH) or os.path.getsize(DB_PATH) == 0:
            os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
            if os.path.exists(_BUNDLED_DB):
                shutil.copy2(_BUNDLED_DB, DB_PATH)
    except Exception:
        pass


_seed_db()


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
            sam_number  TEXT,         -- Samaritan-division verse number override;
                                      -- NULL = display the Jewish `number`
            mas_number  TEXT          -- Masoretic-comparison verse number override;
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
            """SELECT v.*, c.number AS jchapter FROM verses v
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
            "SELECT v.*, c.number AS jchapter FROM verses v JOIN chapters c ON c.id=v.chapter_id "
            "WHERE v.chapter_id=? AND typeof(v.number)='integer' ORDER BY v.number", (chapter_id,)
        ).fetchall()
    conn.close()
    return rows


def get_sam_chapters(book_id):
    conn = get_connection()
    rows = conn.execute(
        """SELECT sc.*, v.text AS first_text
           FROM sam_chapters sc
           LEFT JOIN (SELECT sam_ch_id, MIN(id) AS first_v_id FROM verses GROUP BY sam_ch_id) fv
                  ON fv.sam_ch_id = sc.id
           LEFT JOIN verses v ON v.id = fv.first_v_id
           WHERE sc.book_id=? ORDER BY sc.number""", (book_id,)
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
        SELECT DISTINCT sc.*, v.text AS first_text
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
        """SELECT v.*, ch.number AS jchapter FROM verses v JOIN chapters ch ON ch.id = v.chapter_id
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


def _auth_root_gloss(root_norm, conn):
    """A concise HEBREW gloss for a root, read off the authoritative page extraction
    (tal_auth_entries). Takes the root's primary sense and keeps its Hebrew part."""
    for r in conn.execute("SELECT gloss_he FROM tal_auth_entries WHERE root_norm=? "
                          "ORDER BY pdf, ord", (root_norm,)):
        g = (r['gloss_he'] or '').strip()
        if not g:
            continue
        m = re.search('[A-Za-z]', g)              # drop a trailing English gloss
        if m and m.start() > 2:
            g = g[:m.start()].strip(' ,;·—-')
        if re.search('[א-ת]', g):
            return re.sub(r'\s+', ' ', g)[:120]
    return ''


def tal_concise(word, conn=None):
    """A SHORT meaning for an Aramaic word. Prefers the AUTHORITATIVE gloss read off
    Tal's dictionary pages (word → root → page entry); falls back to the distilled
    gloss table and the published index. Returns {'root','lemma','gloss'} or None.
    Pass an open `conn` to avoid per-word connections."""
    base = _tal_bare(word)
    if not base or len(base) < 2:
        return None
    own = conn is None
    if own:
        conn = get_connection()
    res = None
    # (0) Authoritative: resolve the root (dictionary head-word first) and read the
    # root's own Hebrew gloss straight off Tal's pages.
    try:
        for root in _tal_roots(word, conn):
            g = _auth_root_gloss(_norm_fin(root), conn)
            if g:
                res = {'root': root, 'lemma': '', 'gloss': g}
                break
    except Exception:
        res = None
    # (1) The distilled gloss table covers ~every Targum word with a clean Hebrew
    # meaning (and root) — the fallback when the page entry isn't resolved.
    if res is None:
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


def tal_context_gloss(aramaic, verse_id, conn):
    """The Tal-dictionary gloss CLOSEST to how the word is used in THIS verse. When
    the word's root carries several senses and the verse was sense-tagged (Phase 2),
    return that verse's sense label; otherwise fall back to the root's generic gloss.
    Returns {'root','gloss','ctx'(bool: came from the verse-specific sense)} or None."""
    try:
        roots = _tal_roots(aramaic, conn)
    except Exception:
        roots = []
    for root in roots:
        rn = _norm_fin(root)
        srow = conn.execute(
            "SELECT sense_id FROM dict_torah_sense WHERE verse_id=? AND root_norm=?",
            (verse_id, rn)).fetchone()
        if srow:
            lab = conn.execute("SELECT label FROM dict_sense WHERE root_norm=? AND sense_id=?",
                               (rn, srow['sense_id'])).fetchone()
            if lab and (lab['label'] or '').strip():
                return {'root': root, 'gloss': lab['label'].strip(), 'ctx': True}
    tc = tal_concise(aramaic, conn)
    if tc:
        return {'root': tc['root'], 'gloss': tc['gloss'], 'ctx': False}
    return None


def _dedup_he(items):
    """De-duplicate Hebrew gloss candidates (by niqqud/finals-folded key), preserving
    first-seen order — so the combined translation field never repeats the same
    meaning that arrived from two different sources."""
    out, seen = [], set()
    for x in items:
        x = (x or '').strip(' .,;:־׳״')
        if not x:
            continue
        k = _norm_fin(x)
        if k in seen:
            continue
        seen.add(k); out.append(x)
    return out


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
    # independent Arabic→Hebrew (cross-check source), loaded once when available
    ar_he = {}
    try:
        ar_he = {r[0]: r[1] for r in conn.execute("SELECT arabic, hebrew FROM arabic_he")}
    except Exception:
        ar_he = {}
    # per-word English (aligned to the verse) + its Hebrew back-translation, by vd id
    word_en = {}
    try:
        word_en = {r['vd_id']: (r['en'], r['en_he']) for r in conn.execute(
            "SELECT vd_id, en, en_he FROM word_english")}
    except Exception:
        word_en = {}
    out = {}
    for r in rows:
        heb = (r['hebrew'] or '').strip()           # the curated, context-accurate Hebrew
        word = heb.split(',', 1)[0].strip()
        # the dictionary gloss CLOSEST to this verse's usage (sense-tagged when available)
        ctx = tal_context_gloss(r['aramaic'], r['verse_id'], conn)
        ar = (r['arabic'] if has_ar else '') or ''
        arh = ar_he.get(ar, '')
        tal_he = (ctx['gloss'] if ctx and ctx.get('gloss') else '')   # closest gloss, no root/label
        tal_root = ctx['root'] if ctx else ''
        en_word, en_he = word_en.get(r['id'], ('', ''))              # word-level English (aligned) + its Hebrew
        # the combined Hebrew-translation field: LEAD with the curated, context-accurate
        # Hebrew (always reliable), then the Arabic and English back-translations. The
        # Tal dictionary gloss is included only when it is the verse-specific SENSE
        # (ctx) — the generic gloss is unreliable for homographs (e.g. it resolves the
        # Aramaic אתרה, "his place", to root אתר glossed "אתון, donkey").
        def _atoms(s):
            return [p.strip() for p in re.split('[,،/]', s or '') if p.strip()]
        tal_part = _atoms(tal_he) if (ctx and ctx.get('ctx')) else []
        he_combined = _dedup_he(_atoms(heb) + tal_part + _atoms(arh) + _atoms(en_he))
        out.setdefault(r['verse_id'], []).append({
            'word': word, 'meaning': heb or word, 'aramaic': r['aramaic'] or '',
            'arabic': ar, 'english': en_word,
            'he': heb, 'tal_he': tal_he, 'tal_root': tal_root, 'tal_ctx': bool(ctx and ctx.get('ctx')),
            'ar_he': arh, 'en_he': en_he, 'he_combined': ', '.join(he_combined),
        })
    conn.close()
    return out


# ── word-by-word picker for "מילון מילים": tie each Hebrew word in the verse text
#    to its curated dictionary row (verse_dictionary is accurate but uses shifted
#    forms — אלהים/אלוהים, prefixes, reordering — so we match by a folded key, then
#    a particle-stripped key, then a matres-lectionis skeleton). ─────────────────
_DS_FIN = {'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ'}
_DS_PUNCT = ' .,;:!?"\'־׳״-()[]׃׀'


def _ds_fold(w):
    w = re.sub('[֑-ׇ]', '', w or '').strip(_DS_PUNCT)
    return ''.join(_DS_FIN.get(c, c) for c in w)


def _ds_strip(w):                       # drop up to two leading one-letter particles
    for _ in range(2):
        if len(w) > 2 and w[0] in 'והבלכמש':
            w = w[1:]
        else:
            break
    return w


def _ds_skel(w):
    return re.sub('[אהוי]', '', w)


def _ds_match(tok, entry_word):
    ft = _ds_fold(tok)
    ew = (entry_word or '').split()[0].split('(')[0] if entry_word else ''
    few = _ds_fold(ew)
    if not ft or not few:
        return False
    if ft == few:
        return True
    a, b = _ds_strip(ft), _ds_strip(few)
    if a == b:
        return True
    sa, sb = _ds_skel(a), _ds_skel(b)
    return len(sa) >= 2 and sa == sb


def get_dict_select(verse_ids):
    """For each verse, map the index of each (whitespace-split) word to its
    dictionary row, so the UI can underline the words that have an entry and open
    that single word's row on tap. Index is over ALL non-space tokens, matching the
    client's tokenisation. Returns {verse_id: {word_index(str): row}}."""
    if not verse_ids:
        return {}
    wt = get_word_table(verse_ids)
    conn = get_connection()
    # full per-word Hebrew gloss (gap coverage) — used only where the curated entry
    # is missing, so every token still opens to a meaning
    ph = ','.join('?' * len(verse_ids))
    # position-keyed per-word data: full Hebrew gloss (gap coverage), the Samaritan
    # note (folded into the Hebrew column) and the Jewish note (its own column)
    def _pos_map(table, col):
        out = {}
        try:
            for r in conn.execute("SELECT verse_id, pos, %s AS v FROM %s WHERE verse_id IN (%s)"
                                  % (col, table, ph), verse_ids):
                out[(r['verse_id'], r['pos'])] = r['v'] or ''
        except Exception:
            pass
        return out
    gloss = _pos_map('word_gloss', 'he')
    samaritan = _pos_map('word_samaritan', 'note')
    jewish = _pos_map('word_jewish', 'note')
    # per-token alignment that FILLS words the original glossary never covered
    # (e.g. יהוה, proper nouns, wayyiqtol forms) — Aramaic/Arabic/English/Hebrew
    # aligned directly from the verse's three translations. Keyed by (verse_id, pos).
    word_align = {}
    try:
        for r in conn.execute("SELECT verse_id, pos, ar, arab, en, he FROM word_align "
                              "WHERE verse_id IN (%s)" % ph, verse_ids):
            word_align[(r['verse_id'], r['pos'])] = r
    except Exception:
        pass
    ar_he_map = {}
    try:
        ar_he_map = {r[0]: r[1] for r in conn.execute("SELECT arabic, hebrew FROM arabic_he")}
    except Exception:
        pass
    out = {}
    for vid in verse_ids:
        row = conn.execute("SELECT text FROM verses WHERE id=?", (vid,)).fetchone()
        if not row or not (row['text'] or '').strip():
            continue
        toks = (row['text'] or '').split()
        entries = wt.get(vid, [])
        used, m = set(), {}
        for e in entries:
            # a curated entry may be a MULTI-WORD expression (e.g. "עד שים" = "until
            # satisfied"); claim ALL the consecutive tokens it covers so each of them
            # opens to the COMBINED meaning, instead of glossing the words separately.
            ews = [w for w in re.sub(r'\([^)]*\)', '', e['word'] or '').split() if re.search('[א-ת]', w)]
            if not ews:
                continue
            for i in range(len(toks)):
                if i in used or not _ds_match(toks[i], ews[0]):
                    continue
                run = [i]
                for j in range(1, len(ews)):
                    k = i + j
                    if k < len(toks) and k not in used and _ds_match(toks[k], ews[j]):
                        run.append(k)
                    else:
                        run = [i]; break        # not a clean consecutive run → just the head token
                for p in run:
                    used.add(p); m[str(p)] = dict(e)
                break
        # pre-index single-word dictionary entries by their match key, so a token that
        # found no UNUSED entry (a repeated word like אלהים twice, or one the greedy
        # first pass mis-claimed, or a scrambled-order verse) can still REUSE the
        # matching entry's full data — aramaic/arabic/english — instead of being blanked.
        single = [e for e in entries
                  if len([w for w in re.sub(r'\([^)]*\)', '', e['word'] or '').split()
                          if re.search('[א-ת]', w)]) == 1]
        def _reuse(tk):
            for e in single:
                ew = re.sub(r'\([^)]*\)', '', e['word'] or '').split()
                if ew and _ds_match(tk, ew[0]):
                    return e
            return None
        # fill every remaining token: reuse a matching entry when possible (keeps its
        # aramaic/arabic/english), else fall back to the Hebrew-only gloss.
        for i, tk in enumerate(toks):
            if str(i) in m:
                continue
            e = _reuse(tk)
            if e:
                e2 = dict(e); e2['word'] = tk.strip(_DS_PUNCT) or tk
                m[str(i)] = e2
                continue
            # words the glossary never covered: use the per-token alignment built from
            # the three translations, so this token still shows Aramaic/Arabic/English.
            wa = word_align.get((vid, i))
            if wa and ((wa['ar'] or '').strip() or (wa['arab'] or '').strip() or (wa['en'] or '').strip()):
                wa_he = (wa['he'] or '').strip()
                arh = ar_he_map.get((wa['arab'] or '').strip(), '')
                combined = _dedup_he([p.strip() for p in re.split('[,،/]', wa_he) if p.strip()]
                                     + [p.strip() for p in re.split('[,،/]', arh) if p.strip()])
                m[str(i)] = {'word': tk.strip(_DS_PUNCT) or tk, 'meaning': wa_he or tk,
                             'aramaic': (wa['ar'] or '').strip(), 'arabic': (wa['arab'] or '').strip(),
                             'english': (wa['en'] or '').strip(), 'he': wa_he, 'tal_he': '',
                             'tal_root': '', 'tal_ctx': False, 'ar_he': arh,
                             'en_he': '', 'he_combined': ', '.join(combined) or wa_he}
                continue
            he = gloss.get((vid, i), '')
            if he:
                m[str(i)] = {'word': tk, 'meaning': he, 'aramaic': '', 'arabic': '',
                             'english': '', 'he': he, 'tal_he': '', 'tal_root': '',
                             'tal_ctx': False, 'ar_he': '', 'en_he': '', 'he_combined': he}
        # attach the Samaritan note (into the Hebrew column, de-duplicated) and the
        # Jewish note (its own column) to whichever token they sit on
        for i in range(len(toks)):
            e = m.get(str(i))
            if not e:
                continue
            sam = samaritan.get((vid, i), '')
            jew = jewish.get((vid, i), '')
            if sam:
                e['samaritan'] = sam                 # appended whole (an interpretation, not a gloss)
                parts = [a.strip() for a in (e.get('he_combined') or '').split(',') if a.strip()]
                if _norm_fin(sam) not in {_norm_fin(p) for p in parts}:
                    parts.append(sam)
                e['he_combined'] = ', '.join(parts)
            if jew:
                e['jewish'] = jew
        if m:
            out[vid] = m
    conn.close()
    return out


# ── Samaritan oral-reading phonetic transcription (Ben-Ḥayyim) ───────────────
def get_translit(verse_ids):
    """{verse_id: phonetic transcription text} for the given verses (those that
    have one in verse_translit). Used by the תעתיק הגייה two-panel view."""
    if not verse_ids:
        return {}
    conn = get_connection()
    out = {}
    try:
        ph = ','.join('?' * len(verse_ids))
        for r in conn.execute("SELECT verse_id, text FROM verse_translit "
                              "WHERE verse_id IN (%s)" % ph, verse_ids):
            if (r['text'] or '').strip():
                out[r['verse_id']] = r['text']
        # the Samaritan-anchored correction (verse_translit_fix) overrides the raw OCR
        for r in conn.execute("SELECT verse_id, text FROM verse_translit_fix "
                              "WHERE verse_id IN (%s)" % ph, verse_ids):
            if (r['text'] or '').strip():
                out[r['verse_id']] = r['text']
    except Exception:
        pass
    conn.close()
    return out


def translit_word(verse_id, word_index):
    """The phonetic transcription of one word of a verse, by its position index
    over the verse text's whitespace tokens. The transcription renders the same
    text in the same word order, so token i ↔ word i. Returns '' when there is no
    transcription for the verse or the index is out of range."""
    if verse_id is None or word_index is None:
        return ''
    conn = get_connection()
    try:
        r = conn.execute("SELECT COALESCE((SELECT text FROM verse_translit_fix f WHERE f.verse_id=?), "
                         "text) AS text FROM verse_translit WHERE verse_id=?",
                         (verse_id, verse_id)).fetchone()
    except Exception:
        r = None
    conn.close()
    if not r or not (r['text'] or '').strip():
        return ''
    toks = r['text'].split()
    if 0 <= word_index < len(toks):
        return toks[word_index].strip(' .,:;׃')
    return ''


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


# ── Tibåt Mårqe full-book reader (Samaritan Library) ──────────────────────────
_TM_BORD = {'בראשית': 1, 'שמות': 2, 'ויקרא': 3, 'במדבר': 4, 'דברים': 5}
_TM_GEM = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ך':20,
           'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,
           'ק':100,'ר':200,'ש':300,'ת':400}
_TM_REF = re.compile(r'\((בראשית|שמות|ויקרא|במדבר|דברים)\s+([א-ת]{1,3})\s*[,，،]\s*([א-ת]{1,3})\)')


def _tm_gem(s):
    return sum(_TM_GEM.get(c, 0) for c in s)


def _tm_esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _tm_mark_refs(text, vmap):
    """Escape `text`, wrapping each inline verse ref '(שמות ג,ז)' in a clickable
    <a class="tm-ref" data-vid=N> so the reader can jump to that verse in the app."""
    out, last = [], 0
    for m in _TM_REF.finditer(text or ''):
        out.append(_tm_esc(text[last:m.start()]))
        vid = vmap.get((_TM_BORD[m.group(1)], _tm_gem(m.group(2)), _tm_gem(m.group(3))))
        lbl = _tm_esc(m.group(0))
        out.append('<a class="tm-ref" data-vid="%d">%s</a>' % (vid, lbl) if vid else lbl)
        last = m.end()
    out.append(_tm_esc((text or '')[last:]))
    return ''.join(out)


def _tm_vmap(conn):
    vmap = {}
    for r in conn.execute("""SELECT v.id, b.order_n bo, c.number cn, v.number vn FROM verses v
        JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id"""):
        if str(r['vn']).isdigit():
            vmap[(r['bo'], r['cn'], int(r['vn']))] = r['id']
    return vmap


def get_tm_toc():
    """The six 'books' (מימרים) of Tibåt Mårqe — the table of contents."""
    conn = get_connection()
    rows = conn.execute("SELECT book, book_title, COUNT(*) n, MIN(sort_key) mn "
                        "FROM tm_sections GROUP BY book, book_title ORDER BY mn").fetchall()
    conn.close()
    return [{'book': r['book'], 'letter': _TM_HE_LETTER.get(r['book'], r['book']),
             'title': r['book_title'], 'count': r['n']} for r in rows]


def get_tm_chapter(book):
    """All sections of one TM book, in order, with inline verse refs made clickable."""
    conn = get_connection()
    vmap = _tm_vmap(conn)
    secs = conn.execute("SELECT id, section, book_title, aramaic, hebrew FROM tm_sections "
                        "WHERE book=? ORDER BY sort_key", (book,)).fetchall()
    conn.close()
    title = secs[0]['book_title'] if secs else ''
    out = [{'id': s['id'], 'section': s['section'],
            'aramaic': s['aramaic'] or '', 'hebrew': s['hebrew'] or '',
            'hebrew_html': _tm_mark_refs(s['hebrew'] or '', vmap)} for s in secs]
    return {'book': book, 'letter': _TM_HE_LETTER.get(book, book), 'title': title, 'sections': out}


def search_tm(q, limit=80):
    """Search the book text (Aramaic + Hebrew); returns matching sections + a snippet."""
    q = (q or '').strip()
    if not q:
        return []
    conn = get_connection()
    like = '%' + q + '%'
    rows = conn.execute("SELECT book, book_title, section, sort_key, aramaic, hebrew "
                        "FROM tm_sections WHERE aramaic LIKE ? OR hebrew LIKE ? "
                        "ORDER BY sort_key LIMIT ?", (like, like, limit)).fetchall()
    conn.close()
    out = []
    for r in rows:
        txt = r['hebrew'] if (r['hebrew'] and q in r['hebrew']) else (r['aramaic'] or '')
        i = txt.find(q)
        snip = ('…' + txt[max(0, i - 32):i + len(q) + 44] + '…') if i >= 0 else txt[:90]
        out.append({'book': r['book'], 'letter': _TM_HE_LETTER.get(r['book'], r['book']),
                    'title': r['book_title'], 'section': r['section'], 'snippet': snip})
    return out


def locate_verse(verse_id):
    """Navigation record for a verse_id (for jumping from a TM citation to the app)."""
    conn = get_connection()
    r = conn.execute("""SELECT v.id, v.number, c.id chapter_id, c.number chapter_num,
            b.id book_id, b.name book_name FROM verses v
            JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id
            WHERE v.id=?""", (verse_id,)).fetchone()
    if not r:
        conn.close(); return None
    p = conn.execute("SELECT id, name FROM portions WHERE mode='jewish' AND book_id=? "
                     "AND start_ch<=? AND end_ch>=? LIMIT 1",
                     (r['book_id'], r['chapter_num'], r['chapter_num'])).fetchone()
    conn.close()
    return {'id': r['id'], 'number': r['number'], 'chapter_id': r['chapter_id'],
            'chapter_num': r['chapter_num'], 'book_id': r['book_id'], 'book_name': r['book_name'],
            'portion_id': p['id'] if p else None, 'portion_name': p['name'] if p else ''}


def get_tm_words(book):
    """A per-chapter glossary: the distinct Aramaic words of a TM book that have a
    gloss in A. Tal's dictionary (word · root · Hebrew meaning), in order of first
    appearance."""
    conn = get_connection()
    rows = conn.execute("SELECT aramaic FROM tm_sections WHERE book=? ORDER BY sort_key",
                        (book,)).fetchall()
    order, seen = [], set()
    for r in rows:
        for w in re.findall(r'[א-ת]{2,}', r['aramaic'] or ''):
            if w not in seen:
                seen.add(w); order.append(w)
    gloss = {}
    words = list(seen)
    for i in range(0, len(words), 400):
        chunk = words[i:i + 400]
        ph = ','.join('?' * len(chunk))
        for g in conn.execute("SELECT word, root, gloss FROM tal_word_gloss "
                              "WHERE word IN (%s) AND TRIM(COALESCE(gloss,''))<>''" % ph, chunk):
            if g['word'] not in gloss:
                gloss[g['word']] = (g['root'] or '', g['gloss'] or '')
    conn.close()
    out = []
    for w in order:
        if w in gloss:
            out.append({'word': w, 'root': gloss[w][0], 'gloss': gloss[w][1]})
    return out


# ── Ṣadaqah al-Ḥakīm full-book reader (Genesis commentary, Samaritan Library) ──
_NUM_HE = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'י״א', 'י״ב', 'י״ג',
           'י״ד', 'ט״ו', 'ט״ז', 'י״ז', 'י״ח', 'י״ט', 'כ', 'כ״א', 'כ״ב', 'כ״ג', 'כ״ד',
           'כ״ה', 'כ״ו', 'כ״ז', 'כ״ח', 'כ״ט', 'ל', 'ל״א', 'ל״ב', 'ל״ג', 'ל״ד', 'ל״ה',
           'ל״ו', 'ל״ז', 'ל״ח', 'ל״ט', 'מ', 'מ״א', 'מ״ב', 'מ״ג', 'מ״ד', 'מ״ה', 'מ״ו',
           'מ״ז', 'מ״ח', 'מ״ט', 'נ']


def _num_he(n):
    return _NUM_HE[n] if 0 <= n < len(_NUM_HE) else str(n)


def get_tz_toc():
    """Genesis chapters that carry Ṣadaqah al-Ḥakīm's commentary — the contents."""
    conn = get_connection()
    rows = conn.execute("SELECT chap, COUNT(*) n FROM tzdaka_sections WHERE book='בראשית' "
                        "GROUP BY chap ORDER BY chap").fetchall()
    conn.close()
    return [{'chap': r['chap'], 'heb': _num_he(r['chap']), 'count': r['n']} for r in rows]


def get_tz_chapter(chap):
    """All commentary sections of one Genesis chapter, in order, each with its
    Hebrew + Arabic text, the verse it expounds (for the citation jump), and inline
    verse refs made clickable."""
    try:
        chap = int(chap)
    except (TypeError, ValueError):
        return {'chap': None, 'sections': []}
    conn = get_connection()
    vmap = _tm_vmap(conn)
    vlink = {}
    for r in conn.execute("""SELECT l.section_id sid, MIN(l.verse_id) vid
        FROM tzdaka_verse_links l JOIN tzdaka_sections s ON s.id=l.section_id
        WHERE s.book='בראשית' AND s.chap=? GROUP BY l.section_id""", (chap,)):
        vlink[r['sid']] = r['vid']
    secs = conn.execute("SELECT id, ref, title, text, arabic FROM tzdaka_sections "
                        "WHERE book='בראשית' AND chap=? ORDER BY ord", (chap,)).fetchall()
    conn.close()
    out = [{'id': s['id'], 'ref': s['ref'], 'title': s['title'] or '',
            'hebrew': s['text'] or '', 'arabic': s['arabic'] or '',
            'hebrew_html': _tm_mark_refs(s['text'] or '', vmap),
            'verse_id': vlink.get(s['id'])} for s in secs]
    return {'chap': chap, 'heb': _num_he(chap), 'sections': out}


def search_tz(q, limit=80):
    """Search Ṣadaqah al-Ḥakīm's Genesis commentary (Hebrew + Arabic)."""
    q = (q or '').strip()
    if not q:
        return []
    conn = get_connection()
    like = '%' + q + '%'
    rows = conn.execute("SELECT id, chap, ref, title, text, arabic FROM tzdaka_sections "
                        "WHERE book='בראשית' AND (text LIKE ? OR arabic LIKE ?) "
                        "ORDER BY ord LIMIT ?", (like, like, limit)).fetchall()
    conn.close()
    out = []
    for r in rows:
        txt = r['text'] if (r['text'] and q in r['text']) else (r['arabic'] or '')
        i = txt.find(q)
        snip = ('…' + txt[max(0, i - 32):i + len(q) + 44] + '…') if i >= 0 else txt[:90]
        out.append({'id': r['id'], 'chap': r['chap'], 'heb': _num_he(r['chap']), 'ref': r['ref'],
                    'title': r['title'] or '', 'snippet': snip})
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
    out = [{'parsha': r['parsha'] or '', 'text': r['text'] or ''} for r in rows]
    # the responsa of Jacob ben Aaron ("שו"ת") are also shown under this source
    try:
        srows = conn.execute(
            f"""SELECT DISTINCT s.title, s.ord, s.text, s.anchors FROM shyt_sections s
                JOIN shyt_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders}) ORDER BY s.ord""",
            verse_ids).fetchall()
        out += [{'parsha': 'שו"ת — ' + (r['title'] or ''), 'text': r['text'] or '',
                 'anchors': r['anchors'] or ''} for r in srows]
    except Exception:
        pass
    # Samaritan-tradition commentary articles, each presented in the name of its
    # author (בשם אומרם): פנחס בן אברהם הכהן, אלעזר בן צדקה הכהן.
    try:
        arows = conn.execute(
            f"""SELECT DISTINCT s.title, s.author, s.ord, s.text FROM tradart_sections s
                JOIN tradart_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders}) ORDER BY s.ord""",
            verse_ids).fetchall()
        out += [{'parsha': (r['title'] or ''), 'text': r['text'] or '',
                 'anchors': '— ' + (r['author'] or '')} for r in arows]
    except Exception:
        pass
    conn.close()
    return out


def get_shyt_commentary(verse_ids):
    """שו"ת של יעקב בן אהרן הכהן (responsa, from ספר ההארה) relevant to any of the
    given verses, in reading order. Each item is {title, text}."""
    if not verse_ids:
        return []
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            f"""SELECT DISTINCT s.title, s.ord, s.text, s.anchors FROM shyt_sections s
                JOIN shyt_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders}) ORDER BY s.ord""",
            verse_ids).fetchall()
    except Exception:
        rows = []
    conn.close()
    return [{'title': r['title'] or '', 'text': r['text'] or '', 'anchors': r['anchors'] or ''}
            for r in rows]


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


def get_sir_commentary(verse_ids):
    """סוד הלבבות (Sīr al-Qulūb, ch.4, Abraham al-Kabatzi) relevant to any of the
    given verses, in reading order. Each item is {title, text}; a section linked to
    several verses appears once. Returns [] when nothing is relevant."""
    if not verse_ids:
        return []
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            f"""SELECT DISTINCT s.id, s.title, s.ord, s.text
                FROM sir_sections s
                JOIN sir_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders})
                ORDER BY s.ord""",
            verse_ids
        ).fetchall()
    except Exception:
        rows = []
    conn.close()
    return [{'title': r['title'] or '', 'text': r['text'] or ''} for r in rows]


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
    legend = _vongall_legend(conn)
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
            'witness_info': [_describe_witness(w, legend) for w in wit],
            'register': r['register'], 'confidence': r['confidence'] or '', 'note': r['note'] or '',
        })
    return out


def _vongall_legend(conn):
    """{base-siglum: {repository, shelfmark, date, note}} from von Gall's manuscript
    legend. Cached for the process (the legend is static)."""
    global _VG_LEGEND
    if _VG_LEGEND is None:
        d = {}
        try:
            for r in conn.execute("SELECT siglum, repository, shelfmark, date_ad, note "
                                  "FROM vongall_manuscripts"):
                d[r['siglum']] = {'repository': r['repository'] or '', 'shelfmark': r['shelfmark'] or '',
                                  'date': r['date_ad'] or '', 'note': r['note'] or ''}
        except Exception:
            d = {}
        _VG_LEGEND = d
    return _VG_LEGEND


def _describe_witness(siglum, legend):
    """A witness siglum carries a hand suffix (C2, E3, X2); the legend is keyed by the
    base letter. Returns {siglum, repository, shelfmark, date}."""
    base = re.sub(r'[0-9¹²³⁴⁵]+$', '', siglum or '')
    info = legend.get(base) or legend.get(siglum) or {}
    return {'siglum': siglum, 'repository': info.get('repository', ''),
            'shelfmark': info.get('shelfmark', ''), 'date': info.get('date', '')}


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
    translit = _translit_tokens(conn, vids)   # corrected pronunciation source
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
        toks = translit.get(vid, [])
        for _id, w, pron, b, sub in matched:
            if w not in wseen:
                wseen.add(w)
                words.append(w)
            # prefer the Ben-Ḥayyim transcription of this word over the index's OCR pron
            cpron = _best_translit(w, toks) or pron
            k = (cpron, b)
            if k not in seen:
                seen.add(k)
                occ.append((cpron, b, ''))
        out[vid] = {'order': matched[0][0], 'subroot': sr, 'words': words, 'occ': occ}
    return out


def _best_translit(word, tokens):
    """The transcription token (from verse_translit) that best renders `word`,
    by the same consonant-skeleton score used to match search hits. Returns '' when
    nothing matches well enough, so the caller keeps the index's own pron."""
    best = None
    for tk in tokens:
        clean = tk.strip(" .,:;׃'\"")
        if not clean:
            continue
        sc = _word_pron_score(word, clean)
        if best is None or sc > best[0]:
            best = (sc, clean)
    return best[1] if (best and best[0][0] >= 0.5) else ''


def _translit_tokens(conn, vids):
    """{verse_id: [transcription tokens]} for the given verses, when available."""
    out = {}
    try:
        ph = ','.join('?' * len(vids))
        for r in conn.execute("SELECT verse_id, text FROM verse_translit "
                              "WHERE verse_id IN (%s)" % ph, list(vids)):
            out[r['verse_id']] = (r['text'] or '').split()
        for r in conn.execute("SELECT verse_id, text FROM verse_translit_fix "
                              "WHERE verse_id IN (%s)" % ph, list(vids)):
            if (r['text'] or '').strip():
                out[r['verse_id']] = r['text'].split()
    except Exception:
        pass
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
    translit = _translit_tokens(conn, verse_ids)   # corrected pronunciation source
    conn.close()
    bm = _binyan_map()
    best = {}   # verse_id -> (sim, pron, binyan, form)
    for r in rows:
        s, _ = _word_cons(word, _lat_cons(r['pron']))
        if s >= 0.5 and s > best.get(r['verse_id'], (-1.0,))[0]:
            best[r['verse_id']] = (s, r['pron'], bm.get(r['id']), r['form'])
    out = {}
    for vid, (s, p, b, f) in best.items():
        cpron = _best_translit(word, translit.get(vid, [])) or p
        out[vid] = {'order': 0, 'subroot': '', 'words': [], 'occ': [(cpron, b, f)]}
    return out


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
_VG_LEGEND = None
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


_FINALS = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}


def _norm_fin(w):
    """Niqqud-stripped, final-letters folded — the shared key used by tal_forms,
    root_index and tal_auth_entries (all fold ם→מ, ן→נ, ץ→צ …)."""
    return ''.join(_FINALS.get(c, c) for c in _tal_bare(w))


def _tal_variants(base):
    """(full, prefixed) candidate groups. `full` = the surface form and its
    emphatic-state (-א/-ה) variant; `prefixed` = the same after stripping ONE
    proclitic (ובלכדמ). A letter is stripped only when ≥3 letters remain (so a
    2-letter spurious match like מיא→מי can't fire), and ש is never a proclitic
    (usually a root letter — שמיא, שמש). The full group is resolved first so a real
    word is never mis-stripped (כהניא stays כהן rather than becoming הני)."""
    full = [base]
    if len(base) >= 4 and base[-1] in 'אה':
        full.append(base[:-1])
    prefixed = []
    if len(base) >= 4 and base[0] in 'ובלכדמ':
        s = base[1:]
        prefixed.append(s)
        if len(s) >= 4 and s[-1] in 'אה':
            prefixed.append(s[:-1])
    return full, prefixed


def _tal_roots(word, conn):
    """Resolve an Aramaic surface word to its Tal root(s), most authoritative first:
    the dictionary's own head-word (lemma), the word as a root, Tal's forms index,
    then the word→root gloss and the Torah-text root index. The full surface form is
    resolved completely before any proclitic-stripped variant is tried."""
    base = _tal_bare(word)
    if not base or len(base) < 2:
        return []

    def dedup(rs):
        out = []
        for r in rs:
            r = (r or '').strip()
            if r and r not in out:
                out.append(r)
        return out

    def resolve(cands):
        cnorms = [_norm_fin(c) for c in cands]
        for cn in cnorms:                       # 1) dictionary head-word (lemma → root)
            rs = [r['root'] for r in conn.execute(
                "SELECT DISTINCT root FROM tal_auth_entries "
                "WHERE lemma_norm=? AND TRIM(COALESCE(root,''))<>''", (cn,))]
            if rs:
                return dedup(rs)
        for cn in cnorms:                       # 2) the word IS itself a root
            row = (conn.execute("SELECT root FROM tal_auth_entries WHERE root_norm=? LIMIT 1", (cn,)).fetchone()
                   or conn.execute("SELECT root FROM root_index WHERE root_norm=? LIMIT 1", (cn,)).fetchone())
            if row:
                return [row['root']]
        for cn in cnorms:                       # 3) Tal's own forms index
            rs = [r['root'] for r in conn.execute("SELECT DISTINCT root FROM tal_forms WHERE form_norm=?", (cn,))]
            if rs:
                return dedup(rs)
        for c in cands:                         # 4) word→root gloss (every Torah word)
            rs = [r['root'] for r in conn.execute(
                "SELECT root FROM tal_word_gloss WHERE word=? AND TRIM(COALESCE(root,''))<>''", (c,))]
            if rs:
                return dedup(rs)
        for cn in cnorms:                       # 5) Torah-text root index
            rs = [r['root'] for r in conn.execute("SELECT DISTINCT root FROM root_index WHERE form_norm=?", (cn,))]
            if rs:
                return dedup(rs)
        for c in cands:                         # 6) old forms index
            rs = [r['root'] for r in conn.execute("SELECT DISTINCT root FROM dict_root_index WHERE word=?", (c,))]
            if rs:
                return dedup(rs)
        return []

    full, prefixed = _tal_variants(base)
    return resolve(full) or (resolve(prefixed) if prefixed else [])


def tal_full_lookup(word, torah_limit=16):
    """Everything Tal's dictionary holds for an Aramaic word, grounded in the
    authoritative page extraction. Returns {word, roots:[{root, senses, torah,
    torah_count, forms}]} where each sense is {lemma, pos, gloss, page} read off
    the dictionary itself, torah are the word's occurrences across the Torah
    (book/ch/verse/verse_id), and forms are other surface forms of the root."""
    conn = get_connection()
    roots = _tal_roots(word, conn)
    out = {'word': word, 'roots': []}
    for root in roots:
        rn = _norm_fin(root)
        senses = []
        for r in conn.execute(
                "SELECT lemma, pos, gloss_he, printed FROM tal_auth_entries "
                "WHERE root_norm=? ORDER BY pdf, ord", (rn,)):
            g = (r['gloss_he'] or '').strip()
            if g:
                senses.append({'lemma': r['lemma'] or '', 'pos': r['pos'] or '',
                               'gloss': g, 'page': r['printed']})
        if not senses:                      # fall back to the older entries (English gloss)
            for r in conn.execute(
                    "SELECT e.lemma, e.pos, e.gloss_en, e.page FROM dict_root_entries dre "
                    "JOIN dict_entries e ON e.id=dre.entry_id WHERE dre.root=? ORDER BY dre.tier",
                    (root,)):
                senses.append({'lemma': r['lemma'] or '', 'pos': r['pos'] or '',
                               'gloss': r['gloss_en'] or '', 'page': r['page']})
        locs = conn.execute(
            "SELECT book, chapter, verse, verse_id FROM root_index "
            "WHERE root_norm=? ORDER BY verse_id", (rn,)).fetchall()
        torah = [{'book': r['book'], 'ch': r['chapter'], 'vn': r['verse'],
                  'verse_id': r['verse_id']} for r in locs[:torah_limit]]
        forms = [r['form'] for r in conn.execute(
            "SELECT DISTINCT form FROM tal_forms WHERE root_norm=? LIMIT 24", (rn,))]
        out['roots'].append({'root': root, 'senses': senses, 'torah': torah,
                             'torah_count': len(locs), 'forms': forms})
    conn.close()
    return out


# ── dictionary app: page-browse, index-browse, direct word search, form locations ──
def get_dict_page(printed):
    """One printed page of Tal's dictionary (its head-words), with prev/next nav."""
    try:
        p = int(printed)
    except (TypeError, ValueError):
        p = 1
    conn = get_connection()
    pages = [r['printed'] for r in conn.execute(
        "SELECT DISTINCT printed FROM tal_auth_entries WHERE printed IS NOT NULL ORDER BY printed")]
    if not pages:
        conn.close(); return {'page': p, 'entries': [], 'prev': None, 'next': None}
    p = min(max(p, pages[0]), pages[-1])
    while p not in pages and p < pages[-1]:
        p += 1
    rows = conn.execute("SELECT lemma, root, pos, gloss_he FROM tal_auth_entries "
                        "WHERE printed=? ORDER BY ord", (p,)).fetchall()
    hd = conn.execute("SELECT head FROM tal_pages WHERE printed=? LIMIT 1", (p,)).fetchone()
    conn.close()
    i = pages.index(p)
    return {'page': p, 'head': hd['head'] if hd else '',
            'prev': pages[i - 1] if i > 0 else None,
            'next': pages[i + 1] if i < len(pages) - 1 else None,
            'first': pages[0], 'last': pages[-1],
            'entries': [{'lemma': r['lemma'] or '', 'root': r['root'] or '',
                         'pos': r['pos'] or '', 'gloss': (r['gloss_he'] or '').strip()} for r in rows]}


def get_dict_index(start=0, limit=80, prefix=''):
    """A window of the alphabetical index of dictionary head-words (for flipping
    through the index). `prefix` jumps to the first head-word from that letter on."""
    conn = get_connection()
    WH = "WHERE TRIM(COALESCE(lemma,''))<>''"
    total = conn.execute("SELECT COUNT(*) FROM tal_auth_entries " + WH).fetchone()[0]
    if prefix:
        pn = _norm_fin(prefix)
        start = conn.execute("SELECT COUNT(*) FROM tal_auth_entries " + WH +
                             " AND lemma_norm < ?", (pn,)).fetchone()[0]
    try:
        start = max(0, int(start))
    except (TypeError, ValueError):
        start = 0
    rows = conn.execute("SELECT lemma, root, printed FROM tal_auth_entries " + WH +
                        " ORDER BY lemma_norm, ord LIMIT ? OFFSET ?", (limit, start)).fetchall()
    conn.close()
    return {'start': start, 'limit': limit, 'total': total,
            'items': [{'lemma': r['lemma'] or '', 'root': r['root'] or '', 'page': r['printed']} for r in rows]}


def dict_word_search(word, limit=40):
    """Dictionary entries that contain the word DIRECTLY as a head-word, regardless
    of whether the word is itself a root (so a plain inflected form still hits, as
    long as it stands as a head-word in Tal). Complements the root resolution."""
    base = _tal_bare(word)
    if not base or len(base) < 2:
        return []
    bn = _norm_fin(base)
    conn = get_connection()
    rows = conn.execute("SELECT lemma, root, pos, gloss_he, printed FROM tal_auth_entries "
                        "WHERE lemma_norm=? ORDER BY pdf, ord LIMIT ?", (bn, limit)).fetchall()
    conn.close()
    out, seen = [], set()
    for r in rows:
        k = (r['lemma'], r['printed'], (r['gloss_he'] or '')[:20])
        if k in seen:
            continue
        seen.add(k)
        out.append({'lemma': r['lemma'] or '', 'root': r['root'] or '', 'pos': r['pos'] or '',
                    'gloss': (r['gloss_he'] or '').strip(), 'page': r['printed']})
    return out


def dict_form_locations(word, limit=80):
    """Every place a surface form is cited inside Tal's dictionary — the location
    reference (source_ref) plus the citation quote — for the "tap a form to see all
    its occurrences in the dictionary" feature."""
    base = _tal_bare(word)
    if not base:
        return {'form': word, 'count': 0, 'locations': []}
    conn = get_connection()
    rows = conn.execute(
        "SELECT c.quote, c.source_ref FROM dict_forms f JOIN dict_citations c ON c.form_id=f.id "
        "WHERE f.form=? OR f.form=? ORDER BY c.order_n LIMIT ?",
        (word, base, limit)).fetchall()
    conn.close()
    locs = [{'ref': r['source_ref'] or '', 'quote': (r['quote'] or '').strip()}
            for r in rows if (r['source_ref'] or '').strip()]
    return {'form': word, 'count': len(locs), 'locations': locs}


# ── comprehensive word index: browse every dictionary word, then drill into one ──
def dict_words_browse(start=0, limit=60, prefix=''):
    """A page of the comprehensive word index (dict_word_index) — every Aramaic
    word the dictionary knows, collapsed to one row per word with its meaning count
    and Torah/Memar presence badges. `prefix` jumps to the first word from there on."""
    conn = get_connection()
    total = conn.execute(
        "SELECT COUNT(*) FROM (SELECT word_norm FROM dict_word_index GROUP BY word_norm)").fetchone()[0]
    if prefix:
        pn = _norm_fin(prefix)
        start = conn.execute(
            "SELECT COUNT(*) FROM (SELECT word_norm FROM dict_word_index "
            "WHERE word_norm < ? GROUP BY word_norm)", (pn,)).fetchone()[0]
    try:
        start = max(0, int(start))
    except (TypeError, ValueError):
        start = 0
    rows = conn.execute(
        "SELECT MIN(word) AS word, MAX(in_torah) AS it, MAX(in_memar) AS im, "
        "COUNT(*) AS nm FROM dict_word_index GROUP BY word_norm "
        "ORDER BY word_norm LIMIT ? OFFSET ?", (limit, start)).fetchall()
    conn.close()
    return {'start': start, 'limit': limit, 'total': total,
            'items': [{'word': r['word'] or '', 'meanings': r['nm'],
                       'in_torah': bool(r['it']), 'in_memar': bool(r['im'])} for r in rows]}


# ── Hebrew → Aramaic side: a Hebrew index that leads to the Aramaic entry, and a
#    Hebrew search that finds words IN THE RESULTS (not by jumping in the index) ──
def dict_he_browse(start=0, limit=60, prefix=''):
    """A page of the Hebrew word index (dict_he_index) — Hebrew words that lead to
    their Aramaic root(s). One row per Hebrew word with its root count."""
    conn = get_connection()
    total = conn.execute(
        "SELECT COUNT(*) FROM (SELECT he_norm FROM dict_he_index GROUP BY he_norm)").fetchone()[0]
    if prefix:
        pn = _norm_fin(prefix)
        start = conn.execute(
            "SELECT COUNT(*) FROM (SELECT he_norm FROM dict_he_index "
            "WHERE he_norm < ? GROUP BY he_norm)", (pn,)).fetchone()[0]
    try:
        start = max(0, int(start))
    except (TypeError, ValueError):
        start = 0
    rows = conn.execute(
        "SELECT MIN(he_word) AS word, COUNT(DISTINCT root_norm) AS nr FROM dict_he_index "
        "GROUP BY he_norm ORDER BY he_norm LIMIT ? OFFSET ?", (limit, start)).fetchall()
    conn.close()
    return {'start': start, 'limit': limit, 'total': total,
            'items': [{'word': r['word'] or '', 'roots': r['nr']} for r in rows]}


_HE_PREFIX = 'והלבכמ'           # particles that attach to a Hebrew word (ש excluded — usually a root letter)
_HE_SUFFIX = ['תי', 'נו', 'תם', 'תן', 'הם', 'הן', 'ים', 'ות', 'יו', 'יה', 'ני', 'נה',
              'כם', 'כן', 'ת', 'ה', 'י', 'ו', 'ך', 'ם', 'נ']


def _he_stems(base):
    """Inflection stems of a Hebrew word: the word with up to two leading particles
    stripped, and with a verbal/possessive suffix stripped — so a conjugated/affixed
    form (ישבתי, אכלתי, וילך) can still reach its base entry (ישב, אכל, ילך)."""
    cands = {base}
    b = base
    for _ in range(2):                              # strip leading particles (ו/ה/ל/ב/כ/מ/ש)
        if len(b) > 2 and b[0] in _HE_PREFIX:
            b = b[1:]; cands.add(b)
        else:
            break
    for c in list(cands):                           # strip a trailing inflection suffix
        for s in _HE_SUFFIX:
            if c.endswith(s) and len(c) - len(s) >= 2:
                cands.add(c[:-len(s)])
    return {x for x in cands if len(x) >= 2 and x != base}


def dict_he_search(word, limit=60):
    """Search a Hebrew word among the RESULTS, with a fallback cascade so inflected /
    affixed forms still find their Aramaic interpretation:
      1) exact head-word, then words that CONTAIN the query;
      2) if still thin, the word's INFLECTION stems (strip particles/suffixes → base,
         usually the פעל form), matched exactly or by containment.
    Returns the Hebrew head-words with the Aramaic root(s) each renders."""
    base = _norm_fin(word)
    if not base or len(base) < 2:
        return {'word': word, 'results': []}
    conn = get_connection()
    seen, results = set(), []

    def _collect(clause, params):
        rows = conn.execute(
            "SELECT he_word, root FROM dict_he_index WHERE " + clause +
            " ORDER BY LENGTH(he_norm), he_norm LIMIT ?", tuple(params) + (limit * 4,)).fetchall()
        byword = {}
        for r in rows:
            byword.setdefault(r['he_word'], [])
            if r['root'] and r['root'] not in byword[r['he_word']]:
                byword[r['he_word']].append(r['root'])
        for hw, roots in byword.items():
            if hw in seen or len(results) >= limit:
                continue
            seen.add(hw); results.append({'word': hw, 'roots': roots[:8]})

    # 1) exact, then contains
    _collect("he_norm=?", [base])
    if len(results) < limit:
        _collect("he_norm LIKE ? AND he_norm<>?", ['%' + base + '%', base])
    # 2) inflection-stem fallback (only if the direct search was thin)
    if len(results) < 3:
        for stem in sorted(_he_stems(base), key=len, reverse=True):
            if len(results) >= limit:
                break
            if len(stem) >= 3:                      # broad prefix-match only for longer stems
                _collect("(he_norm=? OR he_norm LIKE ?)", [stem, stem + '%'])
            else:
                _collect("he_norm=?", [stem])
    conn.close()
    return {'word': word, 'results': results}


def _hl_forms(norm_set, tokens_src):
    """Of the whole-word tokens in `tokens_src`, the distinct ones whose folded key
    is in `norm_set` — the surface forms a client should emphasise (used for Memar,
    where the Aramaic forms match the dictionary's forms directly)."""
    out, seen = [], set()
    for w in re.findall(r'[א-ת]{2,}', tokens_src or ''):
        if w in seen:
            continue
        seen.add(w)
        if _norm_fin(w) in norm_set:
            out.append(w)
    return out


def _hl_root(text, root_core):
    """Tokens to emphasise in a sentence: those whose weak-letter-stripped core —
    after peeling leading proclitics (ו/ב/ל/כ/מ/ה/ש/ד) — equals the root core, or
    begins with it (so prefixed forms like מקדם and suffixed forms like קדמת light
    up, while unrelated prepositions like מן/על do not). Works for both the Hebrew
    Torah verse and the Aramaic Tibåt Mårqe passage — the bridge is the root
    skeleton, so no per-occurrence surface form is needed."""
    if not root_core or len(root_core) < 2:
        return []
    out, seen = [], set()
    for w in re.findall(r'[א-ת]{2,}', text or ''):
        if w in seen:
            continue
        seen.add(w)
        c = _norm_fin(w).translate(_WEAK_TAL)
        ok = False
        for _ in range(3):                       # peel up to two proclitics
            if c == root_core or (len(root_core) >= 3 and c.startswith(root_core)):
                ok = True; break
            if len(c) > len(root_core) and c and c[0] in 'ובלכמהשד':
                c = c[1:]
            else:
                break
        if ok:
            out.append(w)
    return out


def dict_word_detail(word, root=None, torah_limit=40, memar_limit=30):
    """Everything a clicked index word opens to, grouped by meaning (= root, the only
    bridge between the Aramaic dictionary and the Hebrew Torah). For each meaning:
    its Tal sense(s); the Torah verses where the SAME ROOT occurs (its full text,
    plus the Hebrew surface forms to highlight); and the Tibåt Mårqe (Memar) passages
    where an Aramaic form of the same root occurs (text + forms to highlight). The
    'same meaning' guarantee is the shared root — homographs of different roots are
    split into separate meanings, never mixed."""
    wn = _norm_fin(word)
    conn = get_connection()
    q = "SELECT DISTINCT root, root_norm FROM dict_word_index WHERE word_norm=?"
    args = [wn]
    if root:
        q += " AND root_norm=?"; args.append(_norm_fin(root))
    wr = [r for r in conn.execute(q, args).fetchall() if (r['root_norm'] or '').strip()]

    # all TM passages once (small), for the Memar scan
    tm_rows = conn.execute(
        "SELECT id, book_title, section, aramaic, hebrew FROM tm_sections ORDER BY sort_key").fetchall()

    meanings = []
    for row in wr:
        rn, rt = row['root_norm'], row['root'] or ''
        # senses straight off the dictionary, de-duplicated by gloss text
        senses, seen_g = [], set()
        for s in conn.execute(
                "SELECT lemma, pos, gloss_he, printed FROM tal_auth_entries "
                "WHERE root_norm=? AND TRIM(COALESCE(gloss_he,''))<>'' ORDER BY pdf, ord", (rn,)):
            g = (s['gloss_he'] or '').strip()
            if g in seen_g:
                continue
            seen_g.add(g)
            senses.append({'lemma': s['lemma'] or '', 'pos': s['pos'] or '',
                           'gloss': g, 'page': s['printed']})

        # precise-meaning split (Phase 2): if the root carries more than one sense
        # and the clicked word is pinned to one of them, filter the occurrences to
        # that sense; otherwise fall back to the whole root (same behaviour as before
        # tagging existed). `t_sense` / `m_sense` are empty when the root is untagged.
        sense_labels = {r['sense_id']: (r['label'] or '')
                        for r in conn.execute(
                            "SELECT sense_id, label FROM dict_sense WHERE root_norm=?", (rn,))}
        target = None
        if len(sense_labels) > 1:
            tr = conn.execute("SELECT sense_id FROM dict_word_sense "
                              "WHERE word_norm=? AND root_norm=?", (wn, rn)).fetchone()
            target = tr['sense_id'] if tr else None
        t_sense, m_sense = {}, {}
        if target is not None:
            t_sense = {r['verse_id']: r['sense_id'] for r in conn.execute(
                "SELECT verse_id, sense_id FROM dict_torah_sense WHERE root_norm=?", (rn,))}
            m_sense = {r['section_id']: r['sense_id'] for r in conn.execute(
                "SELECT section_id, sense_id FROM dict_memar_sense WHERE root_norm=?", (rn,))}

        # the root's Aramaic forms (for highlighting + the Memar scan)
        aram_norm = set(r['word_norm'] for r in conn.execute(
            "SELECT DISTINCT word_norm FROM dict_word_index WHERE root_norm=?", (rn,)))
        aram_norm.add(wn)
        root_core = rn.translate(_WEAK_TAL)         # for highlighting in Hebrew verses

        # Torah occurrences (de-duplicated by verse, filtered to the sense if pinned)
        torah, seen_v = [], set()
        for o in conn.execute(
                "SELECT book, chapter, verse, verse_id FROM root_index "
                "WHERE root_norm=? AND verse_id IS NOT NULL ORDER BY verse_id", (rn,)):
            vid = o['verse_id']
            if vid in seen_v:
                continue
            if t_sense and t_sense.get(vid) != target:   # wrong sense for this verse
                continue
            seen_v.add(vid)
            torah.append(o)
        torah_count = len(torah)
        torah_out = []
        for o in torah[:torah_limit]:
            vt = conn.execute("SELECT text FROM verses WHERE id=?", (o['verse_id'],)).fetchone()
            text = (vt['text'] if vt else '') or ''
            torah_out.append({'book': o['book'], 'ch': o['chapter'], 'vn': o['verse'],
                              'verse_id': o['verse_id'], 'text': text,
                              'hi': _hl_root(text, root_core)})

        # Memar passages with an Aramaic form of the root (filtered to the sense)
        memar_all = []
        for s in tm_rows:
            if m_sense and m_sense.get(s['id']) != target:
                continue
            hi = _hl_root(s['aramaic'], root_core)
            if hi:
                memar_all.append({'id': s['id'], 'title': s['book_title'] or '',
                                  'section': s['section'] or '',
                                  'aramaic': s['aramaic'] or '', 'hebrew': s['hebrew'] or '',
                                  'hi': hi})
        memar_count = len(memar_all)
        meanings.append({'root': rt, 'senses': senses,
                         'sense_label': sense_labels.get(target) if target is not None else '',
                         'sense_split': bool(target is not None and (t_sense or m_sense)),
                         'torah': torah_out, 'torah_count': torah_count,
                         'memar': memar_all[:memar_limit], 'memar_count': memar_count})
    conn.close()
    return {'word': word, 'meanings': meanings}


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
