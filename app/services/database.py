import sqlite3
import os
import hashlib
import re
import functools
import json
import shutil
import unicodedata

# The DB bundled in the repo (pulled via git LFS at build). On a deployment with a
# persistent disk, set DB_PATH to a path on that disk so online admin edits survive
# restarts; the disk is seeded once from the bundled copy (see _seed_db).
_BUNDLED_DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')
DB_PATH = os.environ.get('DB_PATH') or _BUNDLED_DB

# What each boot patch did, so /healthz can say whether it took. The patches run
# at import and print to a log; on a hosted deployment that log is not always
# reachable, and "did the patch apply?" is then a question no one can answer from
# outside. Each entry is a short string, written by the patch itself.
PATCH_REPORT = {}

# The Aramaic dictionary lives in its own file. It holds nothing keyed to a verse
# and nothing the admin panel edits, so it can be replaced wholesale on every
# deploy instead of being threaded past the live text. Attached read-only, and
# skipped without complaint when absent — unqualified queries then simply fail
# per-feature rather than taking the app down.
# While both files still carry the tables, SQLite resolves an unqualified name to
# `main` first, so torah.db keeps answering until its copies are dropped.
_LEXICON_DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'lexicon.db')
LEXICON_PATH = os.environ.get('LEXICON_PATH') or _LEXICON_DB
if not os.path.exists(LEXICON_PATH):
    LEXICON_PATH = None


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


# ── corrections to portion names ─────────────────────────────────────────────
# A parasha is named for the words its first verse opens with, and two of them
# were named for the wrong words. They are corrected here, in place, rather than
# by shipping a new database: online the DB lives on the persistent disk and
# carries the maintainer's own edits, so replacing the file would throw those
# away. This runs at boot, matches on the exact wrong value, and is therefore
# safe to run again and again — once corrected it matches nothing and does
# nothing.
#
#   Genesis, opens at 8:21 'ויאמר יהוה אל לבו'      — was 'אל ליבו'
#   Deuteronomy, opens at 30:1 'והיה כי יבאו עליך'  — was 'והיה כי יביאך'
#
# Both were checked against the verse each portion begins at, which is the only
# authority that settles it; the spreadsheet of portion names disagrees with the
# text on both, and the text wins.
_NAME_FIXES = [
    (1, 'samaritan', 'אל ליבו', 'אל לבו'),
    (5, 'samaritan', 'והיה כי יביאך', 'והיה כי יבאו'),
]


def _fix_portion_names():
    try:
        conn = sqlite3.connect(DB_PATH)
        n = 0
        for book_id, mode, wrong, right in _NAME_FIXES:
            cur = conn.execute(
                'UPDATE portions SET name=? WHERE book_id=? AND mode=? AND name=?',
                (right, book_id, mode, wrong))
            n += cur.rowcount
            # the table of canonical chapter counts carries the name too, and it
            # was filled from the spreadsheet rather than from the text
            try:
                cur = conn.execute('UPDATE canon_portion_counts SET portion_name=? '
                                   'WHERE book_id=? AND portion_name=?',
                                   (right, book_id, wrong))
                n += cur.rowcount
            except sqlite3.OperationalError:
                pass     # a DB copy without that table is simply left alone
        if n:
            conn.commit()
        conn.close()
    except Exception:
        pass        # a correction is never worth failing a boot over


_fix_portion_names()


def _apply_startup_migrations():
    """Small, idempotent, surgical corrections applied to whatever DB is already on
    disk (bundled OR the live persistent-disk copy) — NOT a reseed: this never
    touches anything except the exact rows named below, so it's safe to run
    against a live DB that has its own unsynced admin edits. Each statement's
    WHERE clause targets the specific old value, so re-running this after the
    fix has already landed is a harmless no-op.

    Portion names are cross-checked against data/portions of the week.xlsx
    (the Samaritan-tradition parasha list — see the portion-names-source-of-truth
    memory note). 'וליוסף נולדו' was a MISTAKE from an earlier pass that misread
    that file's Hebrew column — the correct name (confirmed at the codepoint
    level: י-ל-ד-ו, not נ-ו-ל-ד-ו) is 'וליוסף ילדו', which is what this reverts
    a live DB back to if the mistaken value ever reached it."""
    try:
        conn = sqlite3.connect(DB_PATH)
        RENAMES = [
            ('וליוסף נולדו', 'וליוסף ילדו'),   # revert an earlier misreading of the xlsx
            ('ואלה תולדות', 'ואלה תולדת'),      # xlsx has no final ו — 'toldat', not 'toldot'
        ]
        for old, new in RENAMES:
            conn.execute("UPDATE portions SET name=? WHERE book_id=1 AND mode='samaritan' AND name=?",
                         (new, old))
            try:
                conn.execute("UPDATE canon_portion_counts SET portion_name=? "
                             "WHERE book_id=1 AND portion_name=?", (new, old))
            except sqlite3.OperationalError:
                pass   # canon_portion_counts doesn't exist yet on this DB copy — fine, skip

        # Genesis sam_chapters 140/141 swap, requested explicitly by the project
        # owner (2026-08-03): id 1229 (30:37-31:2) <-> id 2255 (31:2-1, the
        # interpolated verse) trade their `number` — same two rows, same verses,
        # only the displayed chapter number exchanges. Guarded by the CURRENT
        # number so this is a no-op once already applied.
        conn.execute("UPDATE sam_chapters SET number=141 WHERE id=1229 AND book_id=1 AND number=140")
        conn.execute("UPDATE sam_chapters SET number=140 WHERE id=2255 AND book_id=1 AND number=141")

        # Portion boundary fix (2026-08-03): data/portions of the week.xlsx has
        # 'ויבא יוסף' ending 43:26-46:7 and 'ואלה שמות' starting 46:8-48:2 — the DB
        # had the split one verse-range too early (45:8/45:8, an overlapping/wrong
        # boundary). Chapter 218 (46:8) literally opens with the words "ואלה שמות",
        # confirming the corrected split point. Guarded by the exact OLD boundary
        # values so this is a no-op once applied.
        conn.execute("UPDATE portions SET end_ch=46, end_v=7 WHERE id=17 AND book_id=1 "
                     "AND end_ch=45 AND end_v=8")
        conn.execute("UPDATE portions SET start_ch=46, start_v=8 WHERE id=18 AND book_id=1 "
                     "AND start_ch=45 AND start_v=8")
        try:
            conn.execute("UPDATE canon_portion_counts SET canonical_count=10 WHERE portion_id=17")
            conn.execute("UPDATE canon_portion_counts SET canonical_count=10 WHERE portion_id=18")
        except sqlite3.OperationalError:
            pass

        conn.commit()
        conn.close()
    except Exception:
        pass   # a migration problem must never prevent the server from starting


_apply_startup_migrations()


_BOOKLETS_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                               'data', 'booklets_patch.json')


def _seed_booklets():
    """Add the three Samaritan study booklets to whatever DB is on disk.

    They belong in tradart_sections / tradart_verse_links, and they are 64 rows
    and 344 links — while the live DB on the persistent disk carries work that
    exists nowhere else: eleven Samaritan-chapter splits made online, and the
    numbering of ויקרא and במדבר that follows from them. Copying the bundled
    file over it to deliver those 64 rows would destroy all of it, so they are
    inserted in place, exactly like the portion-name corrections above.

    It touches ONLY rows it put there itself, recognised by the opening of their
    author line, and no other table at all. It is idempotent on a fingerprint of
    the content rather than on mere presence: when the DB already holds exactly
    this patch the whole thing is one SELECT and returns, and when it holds an
    OLDER one — text since corrected — the booklet rows it owns are replaced.
    Insert-if-absent alone would have frozen the first version in place: a
    correction to the prose could never reach a site that already had it.

    Verse ids are the join between the patch and the DB, which is safe because
    they are the same on both sides — 5,847 addresses checked, none re-created.
    A link whose verse is missing from THIS database is skipped rather than
    inserted, so a dangling row can never be created (one link is in that
    position on the live DB: במדבר 12:16-1, a Samaritan expansion verse the site
    does not have)."""
    try:
        if not os.path.exists(_BOOKLETS_PATCH):
            return
        conn = sqlite3.connect(DB_PATH)
        cols = [r[1] for r in conn.execute('PRAGMA table_info(tradart_sections)')]
        if not cols:
            conn.close()
            return          # this DB has no such table — nothing to add to
        with open(_BOOKLETS_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        tag = patch.get('tag') or ''
        mine = list(conn.execute(
            'SELECT id, title, author, ord, text FROM tradart_sections '
            ' WHERE author LIKE ? ORDER BY ord', (tag + '%',)))
        if mine:
            fp = hashlib.sha1()
            for _id, title, author, ordn, text in mine:
                fp.update(('%s\x1f%s\x1f%s\x1f%s\x1e'
                           % (title, author, ordn, text)).encode('utf-8'))
            if fp.hexdigest() == patch.get('fingerprint'):
                conn.close()
                return                       # the DB already holds exactly this
            ids = [r[0] for r in mine]
            q = ','.join('?' * len(ids))
            conn.execute('DELETE FROM tradart_verse_links WHERE section_id IN (%s)' % q, ids)
            conn.execute('DELETE FROM tradart_sections WHERE id IN (%s)' % q, ids)
            print('[booklets] replacing %d sections from an older patch' % len(ids))
        have = set(r[0] for r in conn.execute('SELECT id FROM verses'))
        n_sec = n_link = 0
        for s in patch.get('sections', []):
            cur = conn.execute(
                'INSERT INTO tradart_sections (title, author, ord, text) VALUES (?,?,?,?)',
                (s.get('title'), s.get('author'), s.get('ord'), s.get('text')))
            sid = cur.lastrowid          # the receiving DB assigns the id, not the patch
            n_sec += 1
            for vid in s.get('verses', []):
                if vid not in have:
                    continue
                conn.execute('INSERT INTO tradart_verse_links (section_id, verse_id) '
                             'VALUES (?,?)', (sid, vid))
                n_link += 1
        conn.commit()
        conn.close()
        print('[booklets] added %d sections and %d verse links' % (n_sec, n_link))
    except Exception as exc:
        print('[booklets] skipped: %s' % exc)


_seed_booklets()


_LIBRARY_BOOKS_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                                    'data', 'library_books_patch.json')


def _seed_library_books():
    """Add the two translated studies (Wreschner 1888, Cohen 1899) to whatever DB
    is on disk.

    Each lives in a table of its own that nothing else writes to, so the table is
    brought to the patch's content: created when absent, left alone when it
    already holds exactly this version (compared by fingerprint), and refilled
    when it holds an older one. No other table is touched."""
    try:
        if not os.path.exists(_LIBRARY_BOOKS_PATCH):
            return
        with open(_LIBRARY_BOOKS_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        conn = sqlite3.connect(DB_PATH)
        for book in patch.get('books', []):
            table = book.get('table')
            if table not in ('wreschner_sections', 'cohen_sections'):
                continue                     # a patch fills only the tables it owns
            conn.execute("""CREATE TABLE IF NOT EXISTS %s (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chap INTEGER, chap_title TEXT, ord INTEGER,
                ref TEXT, title TEXT, text TEXT)""" % table)
            have = [[r[0], r[1], r[2], r[3] or '', r[4] or '', r[5] or ''] for r in conn.execute(
                'SELECT chap, chap_title, ord, ref, title, text FROM %s ORDER BY chap, ord' % table)]
            fp = hashlib.sha1(json.dumps(have, ensure_ascii=False).encode('utf-8')).hexdigest()
            if fp == book.get('fingerprint'):
                continue                     # already exactly this
            conn.execute('DELETE FROM %s' % table)
            conn.executemany('INSERT INTO %s (chap, chap_title, ord, ref, title, text) '
                             'VALUES (?,?,?,?,?,?)' % table, book.get('rows', []))
            conn.execute('CREATE INDEX IF NOT EXISTS ix_%s_chap ON %s(chap, ord)' % (table, table))
            print('[library] %s: %d rows' % (table, len(book.get('rows', []))))
        conn.commit()
        conn.close()
    except Exception as exc:
        print('[library] skipped: %s' % exc)


_seed_library_books()


_ERVAH_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                            'data', 'ervah_patch.json')


def _seed_ervah():
    """כתאב אל-עירות (ספר הערוות) — the laws of forbidden unions, in the full
    Hebrew translation, and the verses the book itself cites.

    Two tables of its own that nothing else writes to, so they are brought to
    the patch's content: created when absent, left alone when they already hold
    exactly this version (compared by fingerprint), refilled when older. The
    links are carried by section ORDER, not by id, since the ids are made here.
    """
    try:
        if not os.path.exists(_ERVAH_PATCH):
            return
        with open(_ERVAH_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""CREATE TABLE IF NOT EXISTS ervah_sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ord INTEGER, title TEXT, text TEXT)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS ervah_verse_links (
            section_id INTEGER, verse_id INTEGER, quote TEXT, ref TEXT)""")
        have_s = [[r[0], r[1] or '', r[2] or ''] for r in conn.execute(
            'SELECT ord, title, text FROM ervah_sections ORDER BY ord')]
        have_l = [[r[0], r[1], r[2] or '', r[3] or ''] for r in conn.execute(
            """SELECT s.ord, l.verse_id, l.quote, l.ref
               FROM ervah_verse_links l JOIN ervah_sections s ON s.id = l.section_id
               ORDER BY s.ord, l.verse_id""")]
        fp = hashlib.sha1(json.dumps([have_s, have_l], ensure_ascii=False)
                          .encode('utf-8')).hexdigest()
        if fp == patch.get('fingerprint'):
            PATCH_REPORT['ervah'] = 'already current'
            conn.close()
            return
        conn.execute('DELETE FROM ervah_verse_links')
        conn.execute('DELETE FROM ervah_sections')
        ids = {}
        for ordn, title, text in patch.get('sections', []):
            cur = conn.execute('INSERT INTO ervah_sections (ord, title, text) VALUES (?,?,?)',
                               (ordn, title, text))
            ids[ordn] = cur.lastrowid
        rows = [(ids[o], vid, quote, ref) for o, vid, quote, ref in patch.get('links', [])
                if o in ids]
        conn.executemany('INSERT INTO ervah_verse_links (section_id, verse_id, quote, ref) '
                         'VALUES (?,?,?,?)', rows)
        conn.execute('CREATE INDEX IF NOT EXISTS ix_ervah_links_v '
                     'ON ervah_verse_links(verse_id)')
        conn.execute('CREATE INDEX IF NOT EXISTS ix_ervah_sections_ord '
                     'ON ervah_sections(ord)')
        conn.commit()
        conn.close()
        PATCH_REPORT['ervah'] = '%d sections, %d links' % (len(ids), len(rows))
        print('[ervah] %s' % PATCH_REPORT['ervah'])
    except Exception as exc:
        PATCH_REPORT['ervah'] = 'failed: %s' % exc
        print('[ervah] skipped: %s' % exc)


_seed_ervah()


_ERVAH_AR_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                               'data', 'ervah_ar_patch.json')


def _seed_ervah_ar():
    """The Arabic rendering of ספר הערוות, paragraph by paragraph.

    A table of its own that nothing else writes to, brought to the patch's
    content and compared by fingerprint, so a server already holding this
    version does nothing. Paragraphs are keyed by their section's order and
    their own position in it — the same split the Hebrew is read by."""
    try:
        if not os.path.exists(_ERVAH_AR_PATCH):
            return
        with open(_ERVAH_AR_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""CREATE TABLE IF NOT EXISTS ervah_para_ar (
            ord INTEGER, para INTEGER, text TEXT, PRIMARY KEY (ord, para))""")
        have = [[r[0], r[1], r[2] or ''] for r in conn.execute(
            'SELECT ord, para, text FROM ervah_para_ar ORDER BY ord, para')]
        fp = hashlib.sha1(json.dumps(have, ensure_ascii=False).encode('utf-8')).hexdigest()
        if fp == patch.get('fingerprint'):
            PATCH_REPORT['ervah_ar'] = 'already current'
            conn.close()
            return
        conn.execute('DELETE FROM ervah_para_ar')
        conn.executemany('INSERT INTO ervah_para_ar (ord, para, text) VALUES (?,?,?)',
                         patch.get('paras', []))
        conn.commit()
        conn.close()
        PATCH_REPORT['ervah_ar'] = '%d paragraphs' % len(patch.get('paras', []))
        print('[ervah-ar] %s' % PATCH_REPORT['ervah_ar'])
    except Exception as exc:
        PATCH_REPORT['ervah_ar'] = 'failed: %s' % exc
        print('[ervah-ar] skipped: %s' % exc)


_seed_ervah_ar()


_DARA_UNIT_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                                'data', 'dara_unit_patch.json')


def _seed_dara_unit():
    """Add the liturgy volume ("פיוטי השומרונים בתעתיק הגייה") to whatever DB is
    on disk.

    Z. Ben-Ḥayyim's volume, line by line in his three columns — the Samaritan
    Aramaic, his Hebrew rendering, and his transcription — plus the apparatus and
    the word list that joins it to the dictionary. Five tables that nothing but
    this patch ever writes to, so each is simply brought to the patch's content:
    created when absent (with its indexes, without which the dictionary's joins
    over sixteen thousand references crawl), left alone when it already holds
    exactly this version, refilled when it holds an older one. No other table is
    touched, and the live database file is never replaced."""
    try:
        if not os.path.exists(_DARA_UNIT_PATCH):
            return
        with open(_DARA_UNIT_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        conn = sqlite3.connect(DB_PATH)
        for tb in patch.get('tables', []):
            name, cols = tb.get('table') or '', tb.get('cols') or []
            if not name.startswith('dara_') or not cols:
                continue                 # a patch fills only the tables it owns
            conn.execute((tb.get('create') or '').replace(
                'CREATE TABLE', 'CREATE TABLE IF NOT EXISTS', 1))
            for ix in tb.get('indexes') or []:
                try:
                    conn.execute(ix.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS', 1))
                except sqlite3.OperationalError:
                    pass
            order = ', '.join(cols[:2])
            have = [list(r) for r in conn.execute(
                'SELECT %s FROM %s ORDER BY %s' % (', '.join(cols), name, order))]
            fp = hashlib.sha1(json.dumps(have, ensure_ascii=False).encode('utf-8')).hexdigest()
            if fp == tb.get('fingerprint'):
                continue                 # already exactly this
            rows = tb.get('rows') or []
            conn.execute('DELETE FROM %s' % name)
            conn.executemany('INSERT INTO %s (%s) VALUES (%s)'
                             % (name, ', '.join(cols), ', '.join('?' * len(cols))), rows)
            print('[liturgy] %s: %d rows' % (name, len(rows)))
        conn.commit()
        conn.close()
    except Exception as exc:
        print('[liturgy] skipped: %s' % exc)


_seed_dara_unit()


_NIKUD_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                            'data', 'nikud_patch.json')


def _seed_nikud():
    """Add the printed book's vocalization to whatever DB is on disk.

    It is kept apart from the text, in verse_nikud, so the Torah's own wording is
    never touched: the marks are written after each letter of a copy, and striking
    them out of that copy returns the verse exactly (checked when the patch is
    built, on every verse). A verse only takes its marks when it still reads word
    for word as it did when they were made, so one edited since is left alone and
    counted. Running it again once applied finds nothing to do."""
    try:
        if not os.path.exists(_NIKUD_PATCH):
            return
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""CREATE TABLE IF NOT EXISTS verse_nikud (
            verse_id INTEGER PRIMARY KEY, display TEXT, typed TEXT)""")
        with open(_NIKUD_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        text = {vid: (t or '') for vid, t in conn.execute('SELECT id, text FROM verses')}
        have = {vid: (d or '') for vid, d in conn.execute('SELECT verse_id, display FROM verse_nikud')}
        put, changed, gone, edged = [], 0, 0, 0
        for r in patch.get('rows', []):
            vid, cur = r['v'], text.get(r['v'])
            if cur is None:
                gone += 1                       # no such verse in this database
                continue
            disp, typed = r['d'], r['t']
            if cur != r['h']:
                if cur.strip() != r['h'].strip():
                    changed += 1                # the wording moved on; marks stay off
                    continue
                # same words, only a stray space or newline at an edge: the marks
                # take the verse's own edges, so striking them out still returns it
                lead = cur[:len(cur) - len(cur.lstrip())]
                trail = cur[len(cur.rstrip()):]
                disp = lead + disp.strip() + trail
                typed = lead + typed.strip() + trail
                edged += 1
            if have.get(vid) != disp:
                put.append((vid, disp, typed))
        if put:
            conn.executemany('INSERT OR REPLACE INTO verse_nikud (verse_id, display, typed) '
                             'VALUES (?,?,?)', put)
            conn.commit()
            print('[nikud] %d verses vocalised (%d kept the edge spacing of the verse); '
                  'left alone: %d not in this DB, %d whose wording changed since'
                  % (len(put), edged, gone, changed))
        conn.close()
    except Exception as exc:
        print('[nikud] skipped: %s' % exc)


_VERSE_TEXT_FIX = os.path.join(os.path.dirname(__file__), '..', '..',
                               'data', 'verse_text_fix.json')


def _seed_verse_text():
    """Correct a verse of the Torah, where one was asked for and agreed.

    This is the only patch here that touches the text itself, and it is the
    narrowest: every verse is named, with the exact wording it must still carry,
    and it is replaced only where the verse reads exactly so. A verse edited
    online since is left as it is and counted; nothing is matched by pattern.

    Genesis 2:24 read "על הכן יעזב איש". That spelling stands once in the whole
    Samaritan text, against forty places that read "על כן" — a slip in this one
    verse, and one that had already been copied into the commentary on it.
    """
    if not os.path.exists(_VERSE_TEXT_FIX):
        return
    try:
        with open(_VERSE_TEXT_FIX, encoding='utf-8') as fh:
            rows = json.load(fh).get('rows', [])
    except Exception as exc:
        PATCH_REPORT['verse_text'] = 'unreadable: %s' % exc
        return
    if not rows:
        return
    conn = sqlite3.connect(DB_PATH)
    done = 0
    try:
        cur = conn.cursor()
        cur.executemany('UPDATE verses SET text=? WHERE id=? AND text=?',
                        [(r['now'], r['v'], r['was']) for r in rows])
        done = cur.rowcount
        conn.commit()
    except Exception as exc:
        PATCH_REPORT['verse_text'] = 'failed: %s' % exc
        print('[verse-text] %s' % exc)
    finally:
        conn.close()
    if 'verse_text' not in PATCH_REPORT:
        PATCH_REPORT['verse_text'] = '%d of %d verses corrected' % (done, len(rows))
    if done:
        print('[verse-text] %s' % PATCH_REPORT['verse_text'])


# before the vocalisation, which only marks a verse while it still reads as it
# did when the marks were made — the wording and the marks must arrive together
_seed_verse_text()

_seed_nikud()


_DEUT_INTERP_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                                  'data', 'interp_deut_patch.json')


def _seed_deut_interpretation():
    """Fill in the per-verse commentary for Deuteronomy.

    Four books had one and the fifth almost none — 743 of its 956 verses were
    blank — not through any fault but because it had never been built. It is
    shipped the way every other body of text here is shipped: as a patch applied
    to whatever database is on the disk, never as a database of its own, because
    the live one carries edits made online that the one in git has never seen.

    The guard is the strictest one there is: a verse is written ONLY if its
    commentary is empty. Nothing that exists is touched, so a commentary edited
    online survives untouched, and a second run finds nothing left to do."""
    try:
        if not os.path.exists(_DEUT_INTERP_PATCH):
            return
        conn = sqlite3.connect(DB_PATH)
        with open(_DEUT_INTERP_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        rows = patch.get('rows', [])
        if not rows:
            conn.close()
            return
        cur = conn.cursor()
        written = he = ar = 0
        for r in rows:
            cur.execute("UPDATE verses SET interpretation=? WHERE id=? "
                        "AND TRIM(COALESCE(interpretation,''))=''", (r['t'], r['v']))
            he += cur.rowcount
        # and its Arabic, under the same rule: only where there is none
        ar_path = os.path.join(os.path.dirname(_DEUT_INTERP_PATCH), 'interp_deut_ar_patch.json')
        if os.path.exists(ar_path):
            with open(ar_path, encoding='utf-8') as fh:
                for r in json.load(fh).get('rows', []):
                    cur.execute("UPDATE verses SET interpretation_ar=? WHERE id=? "
                                "AND TRIM(COALESCE(interpretation_ar,''))=''", (r['t'], r['v']))
                    ar += cur.rowcount
        written = he + ar
        if written:
            conn.commit()
            print('[deut] Deuteronomy: %d verses given a Hebrew commentary, %d an Arabic one; '
                  'everything that already had one was left as it was' % (he, ar))
        conn.close()
    except Exception as exc:
        print('[deut] skipped: %s' % exc)


_seed_deut_interpretation()


_INTERP_FIXES = os.path.join(os.path.dirname(__file__), '..', '..',
                             'data', 'interp_fixes.json')


def _seed_interp_fixes():
    """Correct a commentary that read the wrong Torah.

    The per-verse commentary is built from the Samaritan sources, and some of
    those sources — a lecture summarised from a transcript, above all — quote the
    Song of Moses in the Masoretic wording. Where that happened the commentary
    inherited the quotation, and at Deuteronomy 32:18 it inherited the meaning
    with it: it glossed תֶּשִׁי as forgetting, while the Samaritan text reads
    תשא, which the Samaritan Targum renders שבקתא and the Arabic تطرح — you
    forsook. The forgetting is the next word.

    Unlike the patch above, this one must overwrite rather than fill. So its
    guard is the strictest kind available: a verse is rewritten only when what
    is in the database is character-for-character the text known to be wrong.
    A commentary edited online no longer matches and is left alone; a second run
    finds the corrected text and does nothing."""
    try:
        if not os.path.exists(_INTERP_FIXES):
            return
        with open(_INTERP_FIXES, encoding='utf-8') as fh:
            fixes = json.load(fh).get('fixes') or []
        if not fixes:
            return
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        n = 0
        for fx in fixes:
            # the guard rides in the WHERE clause: a row is rewritten only while
            # it still holds, character for character, the text known to be wrong
            if fx.get('to_he') and fx.get('from_he'):
                cur.execute("UPDATE verses SET interpretation=? "
                            "WHERE id=? AND interpretation=?",
                            (fx['to_he'], fx['verse_id'], fx['from_he']))
                n += cur.rowcount
            if fx.get('to_ar') and fx.get('from_ar'):
                cur.execute("UPDATE verses SET interpretation_ar=? "
                            "WHERE id=? AND interpretation_ar=?",
                            (fx['to_ar'], fx['verse_id'], fx['from_ar']))
                n += cur.rowcount
        # ותיקון בנוסח עצמו, כשהעד היחיד לו הוא שגיאה: השורה נושאת גם
        # sam_hebrew ו-old_text, ושניהם גורסים אחרת. אותו שמירה בדיוק —
        # רק בעוד הנוסח זהה אות באות לזה שידוע כשגוי.
        _all = json.load(open(_INTERP_FIXES, encoding='utf-8'))
        for fx in _all.get('text_fixes') or []:
            cur.execute("UPDATE verses SET text=? WHERE id=? AND text=?",
                        (fx['to_text'], fx['verse_id'], fx['from_text']))
            n += cur.rowcount
        # ושכבת הניקוד, שהיא מה שהקורא רואה בכתב השומרוני. בלעדיה הנוסח
        # והניקוד היו אומרים שתי אותיות שונות באותו מקום.
        for fx in _all.get('nikud_fixes') or []:
            cur.execute("UPDATE verse_nikud SET display=? WHERE verse_id=? AND display=?",
                        (fx['to_display'], fx['verse_id'], fx['from_display']))
            n += cur.rowcount
            if fx.get('to_typed'):
                cur.execute("UPDATE verse_nikud SET typed=? WHERE verse_id=? AND typed=?",
                            (fx['to_typed'], fx['verse_id'], fx['from_typed']))
                n += cur.rowcount
        # שורה שבשדה הפירוש אינה פירוש — שריד הוראה, תרגום מכונה של נוסח
        # הפסוק, או הפסוק עצמו מנוסח מחדש — מרוקנת ולא מוחלפת. פאנל ריק
        # עדיף על פירוש שגוי, ואותה שמירה חלה: רק בעוד הטקסט זהה אות באות.
        for fx in (_all.get('junk_clear') or {}).get('rows') or []:
            cur.execute("UPDATE verses SET interpretation='' "
                        "WHERE id=? AND interpretation=?",
                        (fx['verse_id'], fx['from_he']))
            n += cur.rowcount
        # וקישורי מקור שהמקשר לא מצא. כאן השמירה היא היפוכה: הקישור נכתב
        # רק אם אינו קיים, שאם לא כן תיווצר כפילות בכל עלייה של השרת.
        # ומה שנשאר ריק מקבל את הטקסט. זו השמירה הבטוחה מכולן: כתיבה
        # לשדה ריק אינה יכולה למחוק דבר, ולכן אין צורך להכיר את מה שהיה.
        for fx in (_all.get('fill_if_empty') or {}).get('rows') or []:
            cur.execute("UPDATE verses SET interpretation=? WHERE id=? "
                        "AND TRIM(COALESCE(interpretation,''))=''",
                        (fx['text'], fx['verse_id']))
            n += cur.rowcount
        for fx in (_all.get('tm_links_add') or {}).get('rows') or []:
            cur.execute("INSERT INTO tm_verse_links (verse_id, section_id) "
                        "SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM tm_verse_links "
                        "WHERE verse_id=? AND section_id=?)",
                        (fx['verse_id'], fx['section_id'],
                         fx['verse_id'], fx['section_id']))
            n += cur.rowcount
        if n:
            conn.commit()
            print('[fix] %d fields corrected to the Samaritan reading' % n)
        conn.close()
    except Exception as exc:
        print('[fix] skipped: %s' % exc)


_seed_interp_fixes()

_INTERP_RESTORE = os.path.join(os.path.dirname(__file__), '..', '..',
                               'data', 'interp_deut_restore.json')


# ── the commentary of Deuteronomy, where the field holds scripture ───────────
# On the deployed database 333 verses of Deuteronomy carry, in the verse
# commentary field, the verse itself — sometimes the Masoretic wording with its
# vocalisation, sometimes a machine restatement ("זכור את אשר עשה יהוה אלהיך
# ל Maryam בדרך"), and in Deut 32:1-10 the blessings of chapter 28 set under
# the Song verse by verse. None of it is a commentary.
#
# The guard is a test of WHAT is in the field, not of its exact text: a
# commentary in this app always names what it is doing — it quotes, or it says
# מבאר / התרגום / לפי / במליץ / כדברי. Bare scripture says none of that. So the
# patch replaces a value only when that value carries no such mark, which
#   · cannot overwrite a real commentary, whatever it says;
#   · needs no knowledge of what the deployed text happens to be;
#   · runs once and then stops, since the restored text does carry the marks.
_INTERP_MARK = re.compile('["\'‘’“”„«—–]'
                          '|מבאר|התרגום|לפי |במליץ|המליץ|פירוש|עניינו|מתפרש'
                          '|מוסר|כלומר|היינו|מצביע|מלמד|כדברי|לומד|מוסיף')


def _seed_interp_deut_restore():
    path = _INTERP_RESTORE
    if not os.path.exists(path):
        return
    try:
        with open(path, encoding='utf-8') as fh:
            rows = json.load(fh)
    except Exception as exc:
        print('[deut-restore] %s' % exc)
        return
    conn = sqlite3.connect(DB_PATH)
    done = skipped = 0
    try:
        for r in rows:
            cur = conn.execute('SELECT interpretation FROM verses WHERE id=?',
                               (r['id'],)).fetchone()
            if cur is None:
                continue
            have = (cur[0] or '').strip()
            if have and _INTERP_MARK.search(have):
                skipped += 1          # a real commentary is already there
                continue
            conn.execute('UPDATE verses SET interpretation=?, interpretation_ar=? '
                         'WHERE id=?', (r['he'], r['ar'] or None, r['id']))
            done += 1
        conn.commit()
    except Exception as exc:
        print('[deut-restore] %s' % exc)
    finally:
        conn.close()
    print('[deut-restore] %d verses of Deuteronomy given back their commentary; '
          '%d already had one and were left alone' % (done, skipped))


_seed_interp_deut_restore()


# ── the dictionary's "occurs in the Torah" flag, recomputed ──────────────────
# dict_word_index carries a flag per word saying whether it occurs in the
# Torah, and the index unit uses it to offer the word's Torah occurrences.
# 8,876 of its rows said no while the word is plainly there in the Samaritan
# Targum — דנע among them, whose derived מדנע ("east", the place of the sun's
# rising) stands in thirty verses, from בארעה כלי מדנעת עדן to ודנע לה שמשה.
# A reader looking the word up was told the Torah does not have it.
#
# The flag is derived, not authored, so it is recomputed rather than patched:
# every Hebrew-letter run in sam_aramaic is collected once and the column is
# set from that. Idempotent by construction — a second run computes the same
# answer — and it writes nothing but this one derived column.
def _seed_dict_in_torah():
    conn = sqlite3.connect(DB_PATH)
    try:
        have = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' "
            "AND name='dict_word_index'").fetchone()[0]
        if not have:
            return
        words = set()
        for (txt,) in conn.execute('SELECT sam_aramaic FROM verses'):
            if txt:
                words.update(re.findall(r'[א-ת]+', txt))
        if not words:
            return
        # a word may stand in the Targum only behind a proclitic: דנע itself is
        # never a bare token, yet ודנע לה שמשה — "and the sun rose upon him" —
        # is Genesis 32:32. One leading ו/ב/ל/כ/מ/ד/ה/ש is therefore lifted as
        # well, which is the normalisation the root index already uses.
        for w in list(words):
            if len(w) > 3 and w[0] in 'ובלכמדהש':
                words.add(w[1:])
        wrong = conn.execute(
            'SELECT COUNT(*) FROM dict_word_index WHERE in_torah=0 AND word IN (%s)'
            % ','.join('?' * len(words)), tuple(words)).fetchone()[0]
        if not wrong:
            return                      # already right; nothing to do
        conn.execute('UPDATE dict_word_index SET in_torah=1 WHERE word IN (%s)'
                     % ','.join('?' * len(words)), tuple(words))
        conn.commit()
        print('[dict] %d dictionary rows now know their word is in the Torah' % wrong)
    except Exception as exc:
        print('[dict] in_torah: %s' % exc)
    finally:
        conn.close()


_seed_dict_in_torah()


_CITE_TOKEN = re.compile('[' + chr(0x5d0) + '-' + chr(0x5ea) +
                         chr(0x591) + '-' + chr(0x5c7) + chr(0x5f3) + chr(0x5f4) +
                         chr(39) + chr(34) + ']+')
_CITE_INNER = re.compile('[' + chr(0x5f3) + chr(0x5f4) + chr(39) + chr(34) + ']')
_CITE_HEB = re.compile('[' + chr(0x5d0) + '-' + chr(0x5ea) + ']')
_CITE_FIN = {chr(0x5da): chr(0x5db), chr(0x5dd): chr(0x5de), chr(0x5df): chr(0x5e0),
             chr(0x5e3): chr(0x5e4), chr(0x5e5): chr(0x5e6)}


# bumped whenever _cite_words changes, so the indexes it built are rebuilt
_CITE_RULE = 2


def _cite_words(quote):
    """The words of one sentence, as a reader would type them: no niqqud, final
    letters folded.

    A token with a geresh inside it is the scan running two words together —
    "יומיס׳אתפרשו". The glued token is not a word, but each half is read as one
    on the screen, so both halves are indexed and the glued form is not."""
    out = set()
    for t in _CITE_TOKEN.findall(quote or ''):
        w = re.sub('[' + chr(0x591) + '-' + chr(0x5c7) + ']', '', t).strip(
            chr(0x5f3) + chr(0x5f4) + chr(39) + chr(34))
        if not w or not _CITE_HEB.search(w):
            continue
        parts = _CITE_INNER.split(w) if _CITE_INNER.search(w) else [w]
        for part in parts:
            if len(part) >= 2 and _CITE_HEB.search(part):
                out.add(''.join(_CITE_FIN.get(ch, ch) for ch in part))
    return out


# ── every word that stands inside one of Tal's example sentences ─────────────
# A reader does not only type head-words. They type a word they met in one of
# the sentences Tal prints under an entry — and until now the dictionary said
# "not found" to 16,000 of those, although the word is plainly on the page.
# The sentences are already in this database (dict_citations); only an index of
# the words inside them was missing, so it is built here rather than shipped.
def _seed_tal_cite_index():
    """Index the words inside the dictionary's example sentences.

    Built from what the database already holds, so nothing has to be carried
    over the wire, and rebuilt only when the sentences themselves change."""
    conn = sqlite3.connect(DB_PATH)
    try:
        n_src = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' "
            "AND name='dict_citations'").fetchone()[0]
        if not n_src:
            return
        n_src = conn.execute('SELECT COUNT(*) FROM dict_citations').fetchone()[0]
        conn.execute("""CREATE TABLE IF NOT EXISTS tal_cite_word (
            word_norm TEXT NOT NULL, cite_id INTEGER NOT NULL,
            PRIMARY KEY (word_norm, cite_id))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS tal_cite_build (
            src_n INTEGER, rows_n INTEGER)""")
        try:
            conn.execute('ALTER TABLE tal_cite_build ADD COLUMN rule INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass                        # the column is already there
        have = conn.execute('SELECT src_n, rows_n, rule FROM tal_cite_build').fetchone()
        if have and have[0] == n_src and have[2] == _CITE_RULE and have[1] == conn.execute(
                'SELECT COUNT(*) FROM tal_cite_word').fetchone()[0]:
            PATCH_REPORT['tal_cites'] = 'already current'
            return
        pairs = set()
        for cid, quote in conn.execute('SELECT id, quote FROM dict_citations'):
            for w in _cite_words(quote):
                pairs.add((w, cid))
        conn.execute('DELETE FROM tal_cite_word')
        conn.executemany('INSERT OR IGNORE INTO tal_cite_word (word_norm, cite_id) '
                         'VALUES (?,?)', sorted(pairs))
        conn.execute('DELETE FROM tal_cite_build')
        conn.execute('INSERT INTO tal_cite_build (src_n, rows_n, rule) VALUES (?,?,?)',
                     (n_src, len(pairs), _CITE_RULE))
        conn.commit()
        PATCH_REPORT['tal_cites'] = '%d words in %d sentences' % (
            len(set(w for w, _ in pairs)), n_src)
        print('[tal-cites] %s' % PATCH_REPORT['tal_cites'])
    except Exception as exc:
        PATCH_REPORT['tal_cites'] = 'failed: %s' % exc
        print('[tal-cites] skipped: %s' % exc)
    finally:
        conn.close()


_seed_tal_cite_index()


# ── every word of the Torah and of its Targum, by the verse it stands in ─────
# The dictionary could answer a word only if some index already carried it. A
# word that simply stands in the text — and ובשפילתה, בתה and ולשנינה do — fell
# through all of them. The text is right here; indexing it costs a fifth of a
# second at start-up and nothing on the wire.
def _seed_text_word_index():
    """Index the words of the Samaritan Torah and of its Aramaic Targum."""
    conn = sqlite3.connect(DB_PATH)
    try:
        n_src = conn.execute('SELECT COUNT(*) FROM verses').fetchone()[0]
        conn.execute("""CREATE TABLE IF NOT EXISTS text_word_ix (
            word_norm TEXT NOT NULL, verse_id INTEGER NOT NULL, kind TEXT NOT NULL,
            PRIMARY KEY (word_norm, verse_id, kind))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS text_word_build (
            src_n INTEGER, rows_n INTEGER)""")
        try:
            conn.execute('ALTER TABLE text_word_build ADD COLUMN rule INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass                        # the column is already there
        have = conn.execute('SELECT src_n, rows_n, rule FROM text_word_build').fetchone()
        if have and have[0] == n_src and have[2] == _CITE_RULE and have[1] == conn.execute(
                'SELECT COUNT(*) FROM text_word_ix').fetchone()[0]:
            PATCH_REPORT['text_words'] = 'already current'
            return
        pairs = set()
        for vid, heb, aram in conn.execute('SELECT id, text, sam_aramaic FROM verses'):
            for w in _cite_words(heb):
                pairs.add((w, vid, 'h'))
            for w in _cite_words(aram):
                pairs.add((w, vid, 'a'))
        conn.execute('DELETE FROM text_word_ix')
        conn.executemany('INSERT OR IGNORE INTO text_word_ix (word_norm, verse_id, kind) '
                         'VALUES (?,?,?)', sorted(pairs))
        conn.execute('DELETE FROM text_word_build')
        conn.execute('INSERT INTO text_word_build (src_n, rows_n, rule) VALUES (?,?,?)',
                     (n_src, len(pairs), _CITE_RULE))
        conn.commit()
        PATCH_REPORT['text_words'] = '%d words in %d verses' % (
            len(set(w for w, _, _ in pairs)), n_src)
        print('[text-words] %s' % PATCH_REPORT['text_words'])
    except Exception as exc:
        PATCH_REPORT['text_words'] = 'failed: %s' % exc
        print('[text-words] skipped: %s' % exc)
    finally:
        conn.close()


_seed_text_word_index()


# ── and every word of the piyyut collection, by the poem it is sung in ───────
# The collection had a word index of its own, but an incomplete one: ניב stands
# in seventy-three of the poems and was not in it. The poems themselves are the
# source of truth, so they are indexed here the same way the Torah is.
def _seed_piyut_word_index():
    """Index the words of the Samaritan piyyut collection."""
    conn = sqlite3.connect(DB_PATH)
    try:
        n_src = conn.execute('SELECT COUNT(*) FROM piyutim').fetchone()[0]
        conn.execute("""CREATE TABLE IF NOT EXISTS piyut_word_ix (
            word_norm TEXT NOT NULL, piyut_id INTEGER NOT NULL,
            PRIMARY KEY (word_norm, piyut_id))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS piyut_word_build (
            src_n INTEGER, rows_n INTEGER)""")
        try:
            conn.execute('ALTER TABLE piyut_word_build ADD COLUMN rule INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass                        # the column is already there
        have = conn.execute('SELECT src_n, rows_n, rule FROM piyut_word_build').fetchone()
        if have and have[0] == n_src and have[2] == _CITE_RULE and have[1] == conn.execute(
                'SELECT COUNT(*) FROM piyut_word_ix').fetchone()[0]:
            PATCH_REPORT['piyut_words'] = 'already current'
            return
        pairs = set()
        for pid, txt in conn.execute('SELECT id, text FROM piyutim'):
            for w in _cite_words(txt):
                pairs.add((w, pid))
        conn.execute('DELETE FROM piyut_word_ix')
        conn.executemany('INSERT OR IGNORE INTO piyut_word_ix (word_norm, piyut_id) '
                         'VALUES (?,?)', sorted(pairs))
        conn.execute('DELETE FROM piyut_word_build')
        conn.execute('INSERT INTO piyut_word_build (src_n, rows_n, rule) VALUES (?,?,?)',
                     (n_src, len(pairs), _CITE_RULE))
        conn.commit()
        PATCH_REPORT['piyut_words'] = '%d words in %d piyyutim' % (
            len(set(w for w, _ in pairs)), n_src)
        print('[piyut-words] %s' % PATCH_REPORT['piyut_words'])
    except Exception as exc:
        PATCH_REPORT['piyut_words'] = 'failed: %s' % exc
        print('[piyut-words] skipped: %s' % exc)
    finally:
        conn.close()


_seed_piyut_word_index()


# ── the Hebrew side, read off the Targum's own word dictionary ───────────────
# verse_dictionary holds, for every word of the Targum, the Hebrew it renders.
# Read the other way round it is a Hebrew→Aramaic dictionary — which is half of
# what this unit is called — and nothing was reading it that way, so בפיה, איפת
# and אמלט had no answer although the table says בפמה, אמכלה and סלק.
def _seed_he_aram_index():
    """Index the Hebrew of the Targum word dictionary, word by word."""
    conn = sqlite3.connect(DB_PATH)
    try:
        n_src = conn.execute('SELECT COUNT(*) FROM verse_dictionary').fetchone()[0]
        conn.execute("""CREATE TABLE IF NOT EXISTS he_aram_ix (
            he_norm TEXT NOT NULL, aramaic TEXT NOT NULL, verse_id INTEGER,
            PRIMARY KEY (he_norm, aramaic, verse_id))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS he_aram_build (
            src_n INTEGER, rows_n INTEGER, rule INTEGER DEFAULT 0)""")
        have = conn.execute('SELECT src_n, rows_n, rule FROM he_aram_build').fetchone()
        if have and have[0] == n_src and have[2] == _CITE_RULE and have[1] == conn.execute(
                'SELECT COUNT(*) FROM he_aram_ix').fetchone()[0]:
            PATCH_REPORT['he_aram'] = 'already current'
            return
        pairs = set()
        for vid, ar, he in conn.execute(
                "SELECT verse_id, aramaic, hebrew FROM verse_dictionary "
                "WHERE TRIM(COALESCE(hebrew,''))<>'' AND TRIM(COALESCE(aramaic,''))<>''"):
            ar = (ar or '').strip()
            for w in _cite_words(he):
                pairs.add((w, ar, vid))
        conn.execute('DELETE FROM he_aram_ix')
        conn.executemany('INSERT OR IGNORE INTO he_aram_ix (he_norm, aramaic, verse_id) '
                         'VALUES (?,?,?)', sorted(pairs))
        conn.execute('DELETE FROM he_aram_build')
        conn.execute('INSERT INTO he_aram_build (src_n, rows_n, rule) VALUES (?,?,?)',
                     (n_src, len(pairs), _CITE_RULE))
        conn.commit()
        PATCH_REPORT['he_aram'] = '%d Hebrew words' % len(set(w for w, _, _ in pairs))
        print('[he-aram] %s' % PATCH_REPORT['he_aram'])
    except Exception as exc:
        PATCH_REPORT['he_aram'] = 'failed: %s' % exc
        print('[he-aram] skipped: %s' % exc)
    finally:
        conn.close()


_seed_he_aram_index()


# ── every word in the index now carries a meaning, and its Arabic ────────────
# 2,263 rows of the word index held no meaning, or held the word back as its own
# meaning — "אבניו → אבניו", which is the same as none. A reader who found such
# a word found nothing.
#
# The sources are asked first: Tal's own word glosses, Ben-Ḥayyim's liturgy word
# list, HaMeliṣ, the piyyut dictionary, and last and weakest the word's ROOT
# through the Hebrew index — weakest because it gives the root's meaning and not
# the form's, and so it is recorded as such. 2,061 rows are answered that way.
# Only the 202 that none of them knows are removed, which is what removing a
# word with no meaning was meant to mean.
#
# And the Arabic is attached where there is one: HaMeliṣ gives it per Torah
# location, and the Arabic translation of the Torah gives it word by word
# through the alignment — 7,582 words in all. The rest have no Arabic in any
# source here, and an empty column says so honestly.
_DICT_FILL = os.path.join(os.path.dirname(__file__), '..', '..',
                          'data', 'dict_fill.json')
_DICT_ARABIC = os.path.join(os.path.dirname(__file__), '..', '..',
                            'data', 'dict_arabic.json')


def _seed_dict_glosses():
    conn = sqlite3.connect(DB_PATH)
    try:
        if not conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' "
                            "AND name='dict_word_index'").fetchone()[0]:
            return
        cols = {r[1] for r in conn.execute('PRAGMA table_info(dict_word_index)')}
        if 'arabic' not in cols:
            conn.execute('ALTER TABLE dict_word_index ADD COLUMN arabic TEXT')
        if 'gloss_src' not in cols:
            conn.execute('ALTER TABLE dict_word_index ADD COLUMN gloss_src TEXT')
        if 'arabic' not in cols or 'gloss_src' not in cols:
            conn.commit()

        bare = "TRIM(COALESCE(gloss,''))='' OR TRIM(COALESCE(gloss,''))=TRIM(word)"
        # ── the marker that keeps this patch off the boot path ───────────────
        # The first guard asked whether any row still lacked its Arabic, and
        # seventy thousand of them always will — most words have no Arabic in
        # any source here. So the guard never fired and ten thousand updates ran
        # on every boot: forty-four seconds before the port was bound, which is
        # how the live site came to serve its maintenance page.
        #
        # What the patch needs to know is not the state of the rows but whether
        # IT has already run, so it records that, keyed by the content of its own
        # two files. A changed file is a new key and the patch runs again.
        conn.execute('CREATE TABLE IF NOT EXISTS patch_state '
                     '(key TEXT PRIMARY KEY, value TEXT)')
        stamp = ''
        for path in (_DICT_FILL, _DICT_ARABIC):
            try:
                stamp += '%d:%d|' % (os.path.getsize(path), int(os.path.getmtime(path)))
            except OSError:
                stamp += '-|'
        done = conn.execute("SELECT value FROM patch_state WHERE key='dict_glosses'").fetchone()
        if done and done[0] == stamp:
            return
        n_bare = conn.execute('SELECT COUNT(*) FROM dict_word_index WHERE %s' % bare).fetchone()[0]
        n_noar = 1

        filled = removed = arab = 0
        data = {}
        if os.path.exists(_DICT_FILL):
            try:
                with open(_DICT_FILL, encoding='utf-8') as fh:
                    data = json.load(fh)
            except Exception as exc:
                print('[dict] fill: %s' % exc)
                data = {}
            rows = [(f['gloss'], f['src'], f['word']) for f in (data.get('fill') or [])]
            if rows and n_bare:
                cur = conn.executemany(
                    'UPDATE dict_word_index SET gloss=?, gloss_src=? '
                    'WHERE word=? AND (%s)' % bare, rows)
                filled = cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
            # whatever is still bare after the sources have spoken has no meaning
            # anywhere, and a word with no meaning has no business in a dictionary
            if n_bare:
                removed = conn.execute('DELETE FROM dict_word_index WHERE %s' % bare).rowcount
            selfg = data.get('drop_selfgloss') or []
            if selfg:
                removed += conn.execute(
                    'DELETE FROM dict_word_index WHERE word IN (%s)'
                    % ','.join('?' * len(selfg)), tuple(selfg)).rowcount

        for e in (data.get('enrich') or []):
            cur = conn.execute(
                "UPDATE dict_word_index SET gloss=?, "
                "arabic=COALESCE(NULLIF(?, ''), arabic), gloss_src=? "
                "WHERE word=? AND TRIM(COALESCE(gloss, ''))=?",
                (e['to'], e.get('arabic') or '', e.get('src') or '',
                 e['word'], e['from']))
            filled += cur.rowcount

        if n_noar and os.path.exists(_DICT_ARABIC):
            try:
                with open(_DICT_ARABIC, encoding='utf-8') as fh:
                    ar = json.load(fh)
            except Exception as exc:
                print('[dict] arabic: %s' % exc)
                ar = {}
            if ar:
                cur = conn.executemany(
                    "UPDATE dict_word_index SET arabic=? "
                    "WHERE word=? AND TRIM(COALESCE(arabic,''))=''",
                    [(a, w) for w, a in ar.items()])
                arab = cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
        conn.execute('INSERT OR REPLACE INTO patch_state(key, value) '
                     "VALUES('dict_glosses', ?)", (stamp,))
        conn.commit()
        if filled or removed or arab:
            print('[dict] %d rows given a meaning from the sources, %d with none '
                  'anywhere removed, %d given their Arabic' % (filled, removed, arab))
    except Exception as exc:
        print('[dict] glosses: %s' % exc)
    finally:
        conn.close()

# ── and it runs BEHIND the server, not in front of it ────────────────────────
# Even with the marker, the first boot after a change still has ten thousand
# rows to write, and on the deploy that introduced this patch those forty-odd
# seconds came before the port was bound: Render stopped waiting, and the site
# served its maintenance page. The work itself is sound — it is its place in the
# order that was wrong.
#
# So it is started on a daemon thread. The port binds at once, the Torah is
# served from the first second, and the dictionary finishes filling a minute
# later. A reader who opens the word index in that minute sees it as it was,
# which is a far smaller price than a site that is down.
def _seed_dict_glosses_async():
    try:
        import threading
        threading.Thread(target=_seed_dict_glosses, name='dict-glosses',
                         daemon=True).start()
    except Exception as exc:          # no threads available: do it in line
        print('[dict] async: %s' % exc)
        _seed_dict_glosses()


_seed_dict_glosses_async()


# ── the verses whose commentary field held the verse, written from the sources ─
# 284 verses carried, under "פירוש הפסוק", a restatement of the verse and nothing
# more — no source named, no word explained, and in some cases a different verse
# altogether (דברים י״ב:י״ב held the forbidden birds of י״ד:י״ב). They are being
# written one chapter at a time from what the Samaritan sources actually hold for
# each verse: the Samaritan Targum, the Arabic translation, the word glossary,
# HaMeliṣ, and the passages of תיבת מרקה / אם בחקותי / האסאטיר / צדקה אל-חכים
# linked to that verse. Where the sources say nothing beyond the words, the
# commentary explains the words and stops.
#
# The guard is the one used for the Deuteronomy restore, and for the same reason:
# a value is replaced only while it carries no mark of being a commentary at all,
# so nothing written by hand or edited online can be overwritten, and a second
# run finds the new text — which does carry those marks — and leaves it alone.
_INTERP_WRITTEN = os.path.join(os.path.dirname(__file__), '..', '..',
                               'data', 'interp_written.json')


def _seed_interp_written():
    if not os.path.exists(_INTERP_WRITTEN):
        return
    try:
        with open(_INTERP_WRITTEN, encoding='utf-8') as fh:
            rows = json.load(fh)
    except Exception as exc:
        print('[written] %s' % exc)
        return
    conn = sqlite3.connect(DB_PATH)
    done = skipped = 0
    try:
        for r in rows:
            cur = conn.execute('SELECT interpretation FROM verses WHERE id=?',
                               (r['id'],)).fetchone()
            if cur is None:
                continue
            have = (cur[0] or '').strip()
            if have and _INTERP_MARK.search(have):
                skipped += 1
                continue
            if r.get('ar'):
                conn.execute('UPDATE verses SET interpretation=?, interpretation_ar=? '
                             'WHERE id=?', (r['he'], r['ar'], r['id']))
            else:
                # the Arabic that is there translates the bare verse, not this
                # commentary, so it is cleared rather than left to disagree
                conn.execute('UPDATE verses SET interpretation=?, interpretation_ar=NULL '
                             'WHERE id=?', (r['he'], r['id']))
            done += 1
        conn.commit()
    except Exception as exc:
        print('[written] %s' % exc)
    finally:
        conn.close()
    if done or skipped:
        print('[written] %d verses given a commentary from the sources; '
              '%d already had one' % (done, skipped))


_seed_interp_written()


_INTERP_ARABIC = os.path.join(os.path.dirname(__file__), '..', '..',
                              'data', 'interp_arabic.json')


def _seed_interp_arabic():
    """Give an existing Hebrew commentary its Arabic, where it has none.

    These verses already carry a commentary that announces itself, so the
    written-commentary seeder deliberately leaves them alone — and that is why
    their Arabic stayed empty. The rule here is the narrowest one that does the
    job: write the Arabic only into a row that has none, so a translation
    corrected online is never overwritten, and a rerun finds nothing to do.
    """
    if not os.path.exists(_INTERP_ARABIC):
        return
    try:
        with open(_INTERP_ARABIC, encoding='utf-8') as fh:
            rows = json.load(fh)
    except Exception as exc:
        print('[interp-ar] %s' % exc)
        return
    conn = sqlite3.connect(DB_PATH)
    done = 0
    try:
        cur = conn.cursor()
        cur.executemany(
            "UPDATE verses SET interpretation_ar=? WHERE id=? "
            "AND TRIM(COALESCE(interpretation_ar,''))='' "
            "AND TRIM(COALESCE(interpretation,''))<>''",
            [(r['ar'], r['id']) for r in rows if (r.get('ar') or '').strip()])
        done = cur.rowcount
        conn.commit()
    except Exception as exc:
        print('[interp-ar] %s' % exc)
    finally:
        conn.close()
    if done:
        print('[interp-ar] %d commentaries given their Arabic' % done)


_seed_interp_arabic()


_WORD_ALIGN_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                                 'data', 'word_align_patch.json')


def _seed_word_align():
    """Give the forty-six verses that showed no word glossary their alignment.

    They were never short of sources: each had its Targum, or — being a Samaritan
    expansion — the Torah's own wording standing a second time somewhere that has
    one, and word_gloss held a row for every token. What the rows held was the
    token repeated as its own gloss, which the panel rightly discards.

    INSERT OR IGNORE is the whole guard: a word that already has a row keeps it,
    so nothing curated and nothing corrected online is overwritten, and a second
    run has nothing to do.
    """
    if not os.path.exists(_WORD_ALIGN_PATCH):
        PATCH_REPORT['word_align'] = 'no file at %s' % _WORD_ALIGN_PATCH
        return
    try:
        with open(_WORD_ALIGN_PATCH, encoding='utf-8') as fh:
            rows = json.load(fh).get('rows', [])
    except Exception as exc:
        PATCH_REPORT['word_align'] = 'unreadable: %s' % exc
        print('[word-align] %s' % exc)
        return
    if not rows:
        PATCH_REPORT['word_align'] = 'file holds no rows'
        return
    conn = sqlite3.connect(DB_PATH)
    done = 0
    try:
        # the table is created when it is missing: this deployment's database may
        # never have run the migration that made it, and the app reads it
        # defensively, so creating it adds nothing but somewhere to put the rows
        conn.execute('CREATE TABLE IF NOT EXISTS word_align('
                     'verse_id INTEGER, pos INTEGER, ar TEXT, arab TEXT, en TEXT, '
                     'he TEXT, PRIMARY KEY(verse_id, pos))')
        # ...and its columns are brought up to what the reader asks for. The
        # gap-filler selects ar, arab, en and he in one statement inside a try
        # that swallows OperationalError: one column missing and the whole table
        # silently contributes nothing, which is precisely what a verse with
        # rows-but-no-Aramaic looks like. Adding a column cannot lose a row, and
        # the check means it happens once.
        have = {r[1] for r in conn.execute('PRAGMA table_info(word_align)')}
        for col in ('ar', 'arab', 'en', 'he'):
            if col not in have:
                conn.execute('ALTER TABLE word_align ADD COLUMN %s TEXT' % col)
                print('[word-align] column %s was missing and has been added' % col)
        try:
            conn.execute('CREATE UNIQUE INDEX IF NOT EXISTS word_align_vp '
                         'ON word_align(verse_id, pos)')
        except Exception:
            pass            # already keyed, or holds duplicates; neither is fatal
        cur = conn.cursor()
        vals = [(r['v'], r['p'], r.get('ar', ''), r.get('arab', ''), '', r.get('he', ''))
                for r in rows]
        cur.executemany(
            'INSERT OR IGNORE INTO word_align(verse_id, pos, ar, arab, en, he) '
            'VALUES (?,?,?,?,?,?)', vals)
        done = cur.rowcount
        # and a row that already stood there, holding nothing: COALESCE keeps
        # whatever each column already says and writes only into emptiness, so a
        # curated value is never overwritten and a rerun changes nothing.
        cur.executemany(
            "UPDATE word_align SET "
            "ar   = CASE WHEN TRIM(COALESCE(ar,''))   = '' THEN ? ELSE ar   END, "
            "arab = CASE WHEN TRIM(COALESCE(arab,'')) = '' THEN ? ELSE arab END, "
            "he   = CASE WHEN TRIM(COALESCE(he,''))   = '' THEN ? ELSE he   END "
            "WHERE verse_id = ? AND pos = ? AND ("
            "  (TRIM(COALESCE(ar,''))   = '' AND ? <> '') OR"
            "  (TRIM(COALESCE(arab,'')) = '' AND ? <> '') OR"
            "  (TRIM(COALESCE(he,''))   = '' AND ? <> ''))",
            [(r[2], r[3], r[5], r[0], r[1], r[2], r[3], r[5]) for r in vals])
        done += cur.rowcount
        conn.commit()
    except Exception as exc:
        PATCH_REPORT['word_align'] = 'failed: %s' % exc
        print('[word-align] %s' % exc)
    finally:
        conn.close()
    if 'word_align' not in PATCH_REPORT:
        try:
            chk = sqlite3.connect('file:%s?mode=ro' % DB_PATH, uri=True)
            have = chk.execute(
                "SELECT COUNT(*) FROM word_align WHERE verse_id IN (%s) "
                "AND TRIM(COALESCE(ar,'')) <> ''"
                % ','.join('?' * len({r['v'] for r in rows})),
                sorted({r['v'] for r in rows})).fetchone()[0]
            chk.close()
        except Exception as exc:
            have = 'unreadable: %s' % exc
        PATCH_REPORT['word_align'] = '%s written, %s of %d now carry Aramaic' % (
            done, have, len(rows))
    print('[word-align] %s' % PATCH_REPORT['word_align'])


_seed_word_align()


_INTERP_QUOTE_FIX = os.path.join(os.path.dirname(__file__), '..', '..',
                                 'data', 'interp_quote_fix.json')

# (verse id, the form to take out, the form the Samaritan text spells). Repaired
# as a substring because these must not stand in a commentary in ANY state.
SUBSTRING_REPAIRS = [
    (55, 'על הכן', 'על כן'),            # Genesis 2:24 — see _seed_interp_quotes
]


def _seed_interp_quotes():
    """Make the quotations in the commentaries read as the Samaritan Torah reads.

    A commentary here quotes constantly, and a quotation in the wrong recension
    is worse than none: the reader is shown, inside the Samaritan Torah, wording
    the Samaritan Torah does not have — "אשר יבחר" where it reads "אשר בחר",
    "בוקר" where it reads "בקר", ה׳ where it writes יהוה. Every quotation was
    aligned to the text word for word, and only those differing from it in
    spelling alone were corrected, each differing word replaced by the form the
    text itself spells.

    The guard is the whole field, so an edit made online is never overwritten and
    a rerun changes nothing.
    """
    if not os.path.exists(_INTERP_QUOTE_FIX):
        PATCH_REPORT['interp_quotes'] = 'no file'
        return
    try:
        with open(_INTERP_QUOTE_FIX, encoding='utf-8') as fh:
            rows = json.load(fh).get('rows', [])
    except Exception as exc:
        PATCH_REPORT['interp_quotes'] = 'unreadable: %s' % exc
        return
    if not rows:
        PATCH_REPORT['interp_quotes'] = 'no rows'
        return
    conn = sqlite3.connect(DB_PATH)
    done = 0
    try:
        cur = conn.cursor()
        cur.executemany(
            'UPDATE verses SET interpretation=? WHERE id=? '
            "AND TRIM(COALESCE(interpretation,'')) = ?",
            [(r['now'], r['v'], r['was']) for r in rows])
        done = cur.rowcount
        # where a commentary was rewritten rather than respelled, its Arabic
        # translated the old wording and is replaced with it, under the same guard
        # A word I should never have written, healed wherever it stands rather than
        # only where the field reads as I expect. "על הכן" occurs once in the whole
        # Samaritan text and "על כן" in all forty of its other places, so the one
        # was a slip in that verse and I carried it into the commentary.
        for vid, bad, good in SUBSTRING_REPAIRS:
            cur.execute('UPDATE verses SET interpretation = REPLACE(interpretation, ?, ?) '
                        'WHERE id = ? AND interpretation LIKE ?',
                        (bad, good, vid, '%' + bad + '%'))
            done += cur.rowcount
        withar = [(r['ar'], r['v'], r['now']) for r in rows if (r.get('ar') or '').strip()]
        if withar:
            cur.executemany(
                'UPDATE verses SET interpretation_ar=? WHERE id=? '
                "AND TRIM(COALESCE(interpretation,'')) = ?", withar)
        conn.commit()
    except Exception as exc:
        PATCH_REPORT['interp_quotes'] = 'failed: %s' % exc
        print('[quotes] %s' % exc)
    finally:
        conn.close()
    if 'interp_quotes' not in PATCH_REPORT:
        PATCH_REPORT['interp_quotes'] = '%d of %d commentaries corrected' % (done, len(rows))
    print('[quotes] %s' % PATCH_REPORT['interp_quotes'])


_seed_interp_quotes()


_TRANSLIT_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                               'data', 'translit_benhayyim_patch.json')
_HEB_LETTERS = re.compile(r'[^\u05D0-\u05EA]')


def _seed_benhayyim_translit():
    """Bring Ben-Ḥayyim's transcription, read from his book, into whatever DB is on
    disk — in place, never by replacing the file.

    A verse is changed only when that is safe. It must still be the same verse:
    its Samaritan letters match the ones the reading was made for, so a verse
    merged or split online is left alone (punctuation is ignored — the live text
    carries punctuation edits of its own). And its transcription must still hold a
    value this project itself once shipped, so one corrected online is left alone.
    The old correction pass (verse_translit_fix), which the book supersedes, is
    removed on the same terms. Once applied, a rerun finds nothing to do."""
    try:
        if not os.path.exists(_TRANSLIT_PATCH):
            return
        conn = sqlite3.connect(DB_PATH)
        names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if 'verse_translit' not in names:
            conn.close()
            return
        with open(_TRANSLIT_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        sk = {vid: _HEB_LETTERS.sub('', t or '') for vid, t in conn.execute('SELECT id, text FROM verses')}
        base = {vid: (t or '').strip() for vid, t in
                conn.execute('SELECT verse_id, text FROM verse_translit')}
        fix = ({vid: (t or '').strip() for vid, t in
                conn.execute('SELECT verse_id, text FROM verse_translit_fix')}
               if 'verse_translit_fix' in names else {})
        upd, ins, dele = [], [], []
        gone = moved = edited = kept = 0
        for x in patch.get('verses', []):
            vid, new = x['v'], x['new']
            if vid not in sk:
                gone += 1                    # merged away, or never on this DB
                continue
            if sk[vid] != x.get('sk', ''):
                moved += 1                   # no longer the verse the reading is for
                continue
            cur = base.get(vid)
            if cur != new:
                if cur is None:
                    ins.append((vid, new))
                elif cur == '' or cur in x.get('old', []):
                    upd.append((new, vid))
                else:
                    edited += 1              # corrected online — the correction stands
                    continue
            f = fix.get(vid)
            if f is not None:
                if f == '' or f in x.get('old_fix', []):
                    dele.append((vid,))
                else:
                    kept += 1                # an online correction still overrides it
        if upd or ins or dele:
            conn.executemany('UPDATE verse_translit SET text=? WHERE verse_id=?', upd)
            conn.executemany('INSERT INTO verse_translit (verse_id, text) VALUES (?,?)', ins)
            conn.executemany('DELETE FROM verse_translit_fix WHERE verse_id=?', dele)
            conn.commit()
            print('[translit] Ben-Hayyim: %d updated, %d added, %d superseded corrections '
                  'removed; left alone: %d not in this DB, %d verse changed since, '
                  '%d edited online, %d online corrections kept'
                  % (len(upd), len(ins), len(dele), gone, moved, edited, kept))
        conn.close()
    except Exception as exc:
        print('[translit] skipped: %s' % exc)


_INTERP_SAM_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                                 'data', 'interp_sam_patch.json')


def _seed_interp_sam():
    """The verse commentary re-voiced in the Torah's own vocabulary, for the
    Samaritan-script view — brought into whatever DB is on disk, in place.

    It lives in its own column, verses.interpretation_sam, created here when
    absent; verses.interpretation is never touched. A verse receives the text only
    while it is still the verse the text was written for (its Samaritan letters
    match — punctuation edited online is ignored), and only while its current
    value is one this patch itself shipped (recorded in interp_sam_shipped), so a
    commentary corrected online is left alone. Once applied, a rerun is one pass
    of comparisons and changes nothing."""
    try:
        if not os.path.exists(_INTERP_SAM_PATCH):
            return
        # other boot patches may still hold the file (some run in threads): wait, don't fail
        conn = sqlite3.connect(DB_PATH, timeout=120)
        cols = [r[1] for r in conn.execute('PRAGMA table_info(verses)')]
        if not cols:
            conn.close()
            return
        if 'interpretation_sam' not in cols:
            conn.execute('ALTER TABLE verses ADD COLUMN interpretation_sam TEXT')
        conn.execute('CREATE TABLE IF NOT EXISTS interp_sam_shipped '
                     '(verse_id INTEGER PRIMARY KEY, text TEXT)')
        with open(_INTERP_SAM_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        import hashlib
        sk = {vid: hashlib.sha1(_HEB_LETTERS.sub('', t or '').encode('utf-8')).hexdigest()[:12]
              for vid, t in conn.execute('SELECT id, text FROM verses')}
        cur = {vid: t for vid, t in conn.execute('SELECT id, interpretation_sam FROM verses')}
        shipped = {vid: t for vid, t in conn.execute('SELECT verse_id, text FROM interp_sam_shipped')}
        upd = []
        gone = moved = edited = same = 0
        for x in patch.get('rows', []):
            vid, new = x['id'], x['sam']
            if vid not in sk:
                gone += 1
                continue
            if sk[vid] != x.get('skel'):
                moved += 1                       # merged, split or re-lettered online
                continue
            have = cur.get(vid)
            if have == new:
                same += 1
                continue
            if have not in (None, '') and have != shipped.get(vid):
                edited += 1                      # corrected online: theirs stands
                continue
            upd.append((new, vid))
        if upd:
            conn.executemany('UPDATE verses SET interpretation_sam=? WHERE id=?', upd)
            conn.executemany('INSERT OR REPLACE INTO interp_sam_shipped (verse_id, text) VALUES (?,?)',
                             [(vid, new) for new, vid in upd])
            conn.commit()
            PATCH_REPORT['interp_sam'] = ('%d verses written; left alone: %d not in this DB, '
                                          '%d verse changed since, %d edited online; %d already current'
                                          % (len(upd), gone, moved, edited, same))
            print('[interp-sam] %s' % PATCH_REPORT['interp_sam'])
        else:
            PATCH_REPORT['interp_sam'] = 'already current'
        conn.close()
    except Exception as exc:
        PATCH_REPORT['interp_sam'] = 'failed: %s' % exc
        print('[interp-sam] skipped: %s' % exc)


_seed_interp_sam()


_WORD_MEANING_PATCH = os.path.join(os.path.dirname(__file__), '..', '..',
                                   'data', 'word_meaning_patch.json')


def _seed_word_meaning():
    """The words that no table in this database could speak about.

    Every word unit asks resolve_glosses, and that asks ten tables; what none of
    them answered was then read one by one, in the line each word stands in. The
    answer is one of four kinds, and the reader is told which:

      gloss  a meaning, read off the line or from the word's own make-up
      read   the piyyut corpus is unproofread scan, and the form is a misreading
             of a real word: the reading is given, with that word's meaning
      he     a Hebrew word in a Hebrew line, which needs no translating
      scan   the form is not a word at all — the scan is corrupt here, and
             saying so is the true answer, not silence

    The table is this patch's own and nothing else writes it, so it is simply
    brought to the patch's content.
    """
    try:
        if not os.path.exists(_WORD_MEANING_PATCH):
            return
        with open(_WORD_MEANING_PATCH, encoding='utf-8') as fh:
            patch = json.load(fh)
        rows = patch.get('rows') or []
        if not rows:
            return
        # the server boots more than one worker, and each runs this chain: two
        # of them reaching this table at the same moment is the ordinary case,
        # not the exception. So the writer waits for the other to finish rather
        # than giving up on the lock — the work is idempotent, and whoever
        # arrives second finds it already done and says so.
        conn = sqlite3.connect(DB_PATH, timeout=90)
        conn.execute('PRAGMA busy_timeout=90000')
        conn.execute('CREATE TABLE IF NOT EXISTS word_meaning ('
                     'word TEXT PRIMARY KEY, kind TEXT, gloss TEXT, '
                     'reading TEXT, src TEXT)')
        have = conn.execute('SELECT COUNT(*) FROM word_meaning').fetchone()[0]
        ver = conn.execute("SELECT value FROM patch_state WHERE key='word_meaning'").fetchone() \
            if conn.execute("SELECT name FROM sqlite_master WHERE type='table' "
                            "AND name='patch_state'").fetchone() else None
        if have == len(rows) and ver and ver[0] == str(patch.get('version') or ''):
            PATCH_REPORT['word_meaning'] = 'already %d words' % have
            conn.close()
            return True
        conn.execute('DELETE FROM word_meaning')
        conn.executemany('INSERT INTO word_meaning (word, kind, gloss, reading, src) '
                         'VALUES (?,?,?,?,?)',
                         [(r.get('w'), r.get('k') or 'gloss', r.get('g') or '',
                           r.get('r') or '', r.get('s') or '') for r in rows])
        conn.execute('CREATE TABLE IF NOT EXISTS patch_state (key TEXT PRIMARY KEY, value TEXT)')
        conn.execute("INSERT OR REPLACE INTO patch_state(key, value) VALUES ('word_meaning', ?)",
                     (str(patch.get('version') or ''),))
        conn.commit()
        conn.close()
        PATCH_REPORT['word_meaning'] = '%d words read one by one' % len(rows)
        print('[word-meaning] %s' % PATCH_REPORT['word_meaning'])
        return True
    except Exception as exc:
        PATCH_REPORT['word_meaning'] = 'failed: %s' % exc
        print('[word-meaning] skipped: %s' % exc)
        # a worker that lost the race leaves the table to the one that won it;
        # the reader is never served a half-filled table, because the fill is
        # one transaction
        try:
            conn.close()
        except Exception:
            pass
    return False


def _seed_word_meaning_async():
    """Fill the table patiently, off the boot path.

    The lock it waits for is held by this same process a moment earlier (the
    dictionary glosses are written in their own thread) or by a second worker
    doing exactly this. None of that is worth delaying the first request for,
    and none of it needs to succeed on the first try: the work is idempotent,
    the file is shared, and whichever worker gets there first fills it for all
    of them. Until it is filled the reader is not left without answers — the ten
    tiers still speak; only the words read one by one are missing.
    """
    def run():
        import time
        for attempt in range(8):
            try:
                if _seed_word_meaning():
                    return
            except Exception as exc:
                PATCH_REPORT['word_meaning'] = 'failed: %s' % exc
            time.sleep(3 * (attempt + 1))
    try:
        import threading
        threading.Thread(target=run, name='word-meaning', daemon=True).start()
    except Exception:
        run()


_seed_word_meaning_async()

_seed_benhayyim_translit()


_MAS_CHAPTER_COL_READY = False


def _ensure_mas_chapter_column(conn):
    """verses.mas_chapter: admin override for the Masoretic-comparison CHAPTER number
    shown next to a Samaritan chapter's first verse (e.g. "20:1") when it derives from
    the joined chapters.number and needs correcting independently of the Samaritan
    chapter split/merge tools, which only ever touch sam_chapters. NULL = derive from
    chapters.number as before. Lazily added so a live disk never needs a DB reseed."""
    global _MAS_CHAPTER_COL_READY
    if _MAS_CHAPTER_COL_READY:
        return
    try:
        conn.execute('ALTER TABLE verses ADD COLUMN mas_chapter TEXT')
        conn.commit()
    except sqlite3.OperationalError:
        pass  # column already exists
    _MAS_CHAPTER_COL_READY = True


def _without_lexicon(empty):
    """Return `empty` instead of raising when the dictionary file is absent.

    The Aramaic dictionary is a separate, optional database (see LEXICON_PATH).
    If it is missing, the app must lose the dictionary and nothing else — the
    Torah, the commentaries and the readers all live in torah.db and keep
    working. Only a genuinely missing table is swallowed; every other SQL error
    still surfaces, because those are bugs, not absent files."""
    def wrap(fn):
        @functools.wraps(fn)
        def inner(*a, **kw):
            try:
                return fn(*a, **kw)
            except sqlite3.OperationalError as e:
                if 'no such table' not in str(e).lower():
                    raise
                return empty() if callable(empty) else empty
        return inner
    return wrap


def get_connection():
    # uri=True is required for the read-only ATTACH below: without it SQLite reads
    # "file:...?mode=ro" as a literal filename, silently creates an empty database
    # under that name, and every dictionary table quietly disappears.
    conn = sqlite3.connect(DB_PATH, uri=True)
    conn.row_factory = sqlite3.Row
    if LEXICON_PATH:
        try:
            conn.execute("ATTACH DATABASE ? AS lex", (f'file:{LEXICON_PATH}?mode=ro',))
        except sqlite3.Error:
            pass          # the dictionary is unavailable; the Torah still works
    _ensure_mas_chapter_column(conn)
    try:                    # so a query can reach a head-word past its homograph mark
        conn.create_function('nomark', 1, _nomark)
    except Exception:
        pass
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
           LEFT JOIN (SELECT sam_ch_id, id AS first_v_id FROM (
                    SELECT v.id, v.sam_ch_id, ROW_NUMBER() OVER (
                        PARTITION BY v.sam_ch_id ORDER BY c.number, CAST(v.number AS INTEGER)) AS rn
                    FROM verses v JOIN chapters c ON c.id = v.chapter_id) WHERE rn = 1) fv
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
        JOIN   (SELECT sam_ch_id, id AS first_v_id FROM (
                    SELECT v.id, v.sam_ch_id, ROW_NUMBER() OVER (
                        PARTITION BY v.sam_ch_id ORDER BY c.number, CAST(v.number AS INTEGER)) AS rn
                    FROM verses v JOIN chapters c ON c.id = v.chapter_id) WHERE rn = 1) fv
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
        JOIN   (SELECT sam_ch_id, id AS first_v_id FROM (
                    SELECT v.id, v.sam_ch_id, ROW_NUMBER() OVER (
                        PARTITION BY v.sam_ch_id ORDER BY c.number, CAST(v.number AS INTEGER)) AS rn
                    FROM verses v JOIN chapters c ON c.id = v.chapter_id) WHERE rn = 1) fv
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


def get_verses_by_sam_chs(sam_ch_ids):
    """{sam_ch_id: rows} for several Samaritan chapters at once, each in reading
    order. The same ordering as get_verses_by_sam_ch, which is where the reasoning
    for it is written — this is that query asked once for many chapters instead of
    once per chapter, for the printing of a range."""
    ids = [int(i) for i in (sam_ch_ids or [])]
    if not ids:
        return {}
    out = {}
    conn = get_connection()
    try:
        for i in range(0, len(ids), 500):
            part = ids[i:i + 500]
            ph = ','.join('?' * len(part))
            for r in conn.execute(
                    """SELECT v.*, ch.number AS jchapter FROM verses v
                       JOIN chapters ch ON ch.id = v.chapter_id
                       WHERE v.sam_ch_id IN (%s)
                       ORDER BY v.sam_ch_id, ch.number,
                                CAST(v.number AS INTEGER),
                                CASE WHEN instr(v.number,'-')>0
                                     THEN CAST(substr(v.number, instr(v.number,'-')+1) AS INTEGER)
                                     ELSE 0 END""" % ph, part):
                out.setdefault(r['sam_ch_id'], []).append(r)
    finally:
        conn.close()
    return out


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


@_without_lexicon("")
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


@_without_lexicon("")
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


_MELIZ_CACHE = None


def _load_meliz(conn):
    """HaMeliṣ glosses grouped by verse_id: {vid: [{lemma, hebrew, arabic, note}]}.
    Resolves the book/chap/verse reference to a verse_id. Cached per process."""
    global _MELIZ_CACHE
    if _MELIZ_CACHE is not None:
        return _MELIZ_CACHE
    out = {}
    try:
        rows = conn.execute('''SELECT v.id AS vid, m.lemma, m.hebrew, m.arabic, m.note
            FROM meliz_gloss m
            JOIN books b    ON b.order_n = m.book
            JOIN chapters c ON c.book_id = b.id AND c.number = m.chap
            JOIN verses v   ON v.chapter_id = c.id AND v.number = m.verse''').fetchall()
        for r in rows:
            out.setdefault(r['vid'], []).append({
                'lemma': r['lemma'] or '', 'hebrew': r['hebrew'] or '',
                'arabic': r['arabic'] or '', 'note': r['note'] or ''})
    except Exception:
        out = {}
    _MELIZ_CACHE = out
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
    meliz_by_v = _load_meliz(conn)
    out = {}
    for r in rows:
        heb = (r['hebrew'] or '').strip()           # the curated, context-accurate Hebrew
        word = heb.split(',', 1)[0].strip()
        # the dictionary gloss CLOSEST to this verse's usage (sense-tagged when available)
        ctx = tal_context_gloss(r['aramaic'], r['verse_id'], conn)
        ar = (r['arabic'] if has_ar else '') or ''
        arh = ar_he.get(ar, '')                      # Arabic→Hebrew from the ORIGINAL Arabic
        # HaMeliṣ: match this verse's entries to this word by folded Hebrew form. Its Arabic
        # gloss is APPENDED to the Arabic field (never overwriting; comma-separated, deduped);
        # its Hebrew gloss feeds the new המליץ column and the expansion panel.
        meliz_he = meliz_ar = ''
        for m in meliz_by_v.get(r['verse_id'], []):
            if _ds_match(word, m['lemma']):
                meliz_he, meliz_ar = m['hebrew'], m['arabic']
                break
        if meliz_ar:
            parts = [p.strip() for p in ar.split(',') if p.strip()]
            if meliz_ar not in parts:
                ar = (ar + ', ' + meliz_ar) if ar else meliz_ar
        tal_he = (ctx['gloss'] if ctx and ctx.get('gloss') else '')   # closest gloss, no root/label
        tal_root = ctx['root'] if ctx else ''
        en_word, en_he = word_en.get(r['id'], ('', ''))              # phrase-level English span + the word's back-translation
        # Data quirk: for most rows en_he actually holds the WORD-LEVEL ENGLISH gloss
        # (e.g. מים→"waters", שמתחת→"under") rather than a Hebrew back-translation, while
        # en_word is the whole sentence span repeated on every word. So:
        #   • the per-word English column uses en_he when it is English (properly aligned),
        #     falling back to the phrase span otherwise;
        #   • en_he is only treated as a Hebrew back-translation (and allowed into the
        #     Hebrew column) when it is genuinely Hebrew — never let English pollute it.
        en_he_is_latin = bool(re.search('[A-Za-z]', en_he or ''))
        english = (en_he or '').strip() if en_he_is_latin else (en_word or '').strip()
        en_he = '' if en_he_is_latin else en_he
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
            'arabic': ar, 'english': english,
            'he': heb, 'tal_he': tal_he, 'tal_root': tal_root, 'tal_ctx': bool(ctx and ctx.get('ctx')),
            'ar_he': arh, 'en_he': en_he, 'he_combined': ', '.join(he_combined),
            'meliz_he': meliz_he, 'meliz_ar': meliz_ar,
        })

    # ── the words the curated glossary never covered ────────────────────────
    # Everything above comes from verse_dictionary alone, and that table is not
    # complete: 468 verses have no row in it at all — the whole of דברים א׳-ט׳,
    # most of שמות כ׳ and כ״ב and כ״ו, the genealogies and name-lists — and 793
    # more carry fewer rows than they have words. The panel showed those verses
    # blank, and so did the word strip under the commentary, while the very same
    # words WERE glossed a table away: word_gloss holds a Hebrew gloss for each of
    # דברים א׳:א׳'s twenty-two tokens, word_align the Aramaic and Arabic for the
    # tokens the glossary skipped, word_samaritan the Samaritan note.
    #
    # get_dict_select already knew this and fell back to those three, which is why
    # TAPPING a word worked while the table above it stayed empty. The fallback is
    # made here instead, at the source both of them read, so the two can no longer
    # disagree about whether a word has a meaning.
    #
    # Rows already produced are left exactly as they are — a curated entry, and
    # its ordering, is better than anything synthesised. Only tokens that no entry
    # claims are added, in the order they stand in the verse.
    try:
        _fill_uncovered_words(conn, verse_ids, out)
    except Exception:
        pass                    # a gap-filler must never cost the panel its rows
    conn.close()
    return out


# ── word-by-word picker for "מילון מילים": tie each Hebrew word in the verse text
#    to its curated dictionary row (verse_dictionary is accurate but uses shifted
#    forms — אלהים/אלוהים, prefixes, reordering — so we match by a folded key, then
#    a particle-stripped key, then a matres-lectionis skeleton). ─────────────────
_DS_FIN = {'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ'}
_DS_PUNCT = ' .,;:!?"\'־׳״-()[]׃׀'


def _fill_uncovered_words(conn, verse_ids, out):
    """Append a row for every verse token no verse_dictionary entry accounts for,
    built from word_gloss / word_align / word_samaritan. Mutates `out` in place."""
    ph = ','.join('?' * len(verse_ids))
    texts = {r['id']: (r['text'] or '')
             for r in conn.execute('SELECT id, text FROM verses WHERE id IN (%s)' % ph,
                                   verse_ids)}
    if not texts:
        return

    def pos_map(sql):
        m = {}
        try:
            for r in conn.execute(sql % ph, verse_ids):
                m[(r['verse_id'], r['pos'])] = r
        except sqlite3.OperationalError:
            pass
        return m

    gloss = pos_map('SELECT verse_id, pos, he FROM word_gloss WHERE verse_id IN (%s)')
    align = pos_map('SELECT verse_id, pos, ar, arab, en, he FROM word_align '
                    'WHERE verse_id IN (%s)')
    samar = pos_map('SELECT verse_id, pos, note FROM word_samaritan WHERE verse_id IN (%s)')
    ar_he = {}
    try:
        ar_he = {r[0]: r[1] for r in conn.execute('SELECT arabic, hebrew FROM arabic_he')}
    except sqlite3.OperationalError:
        pass

    for vid, text in texts.items():
        toks = text.split()
        if not toks:
            continue
        entries = out.get(vid, [])
        # Every word the table already speaks for, however it got there — a
        # single entry or one word of a multi-word expression. A token is passed
        # over when the table has a row for THAT WORD, not merely for that
        # position: a verse says ואת three times and the glossary carries it once,
        # and adding it twice more would show the reader the same word three times
        # over. This is how the word-picker treats a repeat too — it reuses the
        # one entry rather than making new ones.
        covered = [ew for e in entries
                   for ew in re.sub(r'\([^)]*\)', '', e.get('word') or '').split()
                   if re.search('[א-ת]', ew)]
        seen_words = []
        added = []
        for i, tk in enumerate(toks):
            if any(_ds_match(tk, ew) for ew in covered):
                continue
            if any(_ds_match(tk, w) for w in seen_words):
                continue          # a repeat of a word this filler already added
            seen_words.append(tk)
            g = gloss.get((vid, i))
            a = align.get((vid, i))
            s = samar.get((vid, i))
            he = ((g['he'] if g else '') or (a['he'] if a else '') or '').strip()
            # word_gloss stores "token - gloss" / "token (gloss)"; the gloss is what
            # a reader wants in the meaning column, not the token echoed back
            m = re.match(r'^\s*\S+\s*[-–—(]\s*(.+?)\s*\)?\s*$', he)
            if m and m.group(1).strip():
                he = m.group(1).strip()
            # ...and where word_gloss holds ONLY the word again it says nothing, so
            # it must not outrank the aligner's gloss. This is the whole reason the
            # panel showed these verses blank: a gloss equal to its word is dropped.
            if a and (a['he'] or '').strip() and _ds_match(tk, he):
                he = (a['he'] or '').strip()
            aram = (a['ar'] if a else '') or ''
            arab = (a['arab'] if a else '') or ''
            eng = (a['en'] if a else '') or ''
            note = (s['note'] if s else '') or ''
            if not (he or aram.strip() or arab.strip() or eng.strip() or note.strip()):
                continue                       # nothing to say about this token
            arh = ar_he.get(arab.strip(), '')
            combined = _dedup_he(
                [p.strip() for p in re.split('[,،/]', he) if p.strip()]
                + [p.strip() for p in re.split('[,،/]', arh) if p.strip()])
            word = tk.strip(_DS_PUNCT) or tk
            added.append({
                'word': word, 'meaning': he or word, 'aramaic': aram.strip(),
                'arabic': arab.strip(), 'english': eng.strip(), 'he': he,
                'tal_he': '', 'tal_root': '', 'tal_ctx': False, 'ar_he': arh,
                'en_he': '', 'he_combined': ', '.join(combined) or he,
                'meliz_he': '', 'meliz_ar': '', 'filled': True,
            })
        if added:
            out.setdefault(vid, []).extend(added)


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



def get_nikud(verse_ids):
    """{verse_id: the verse with the book's marks} for the verses that have them."""
    if not verse_ids:
        return {}
    conn = get_connection()
    out = {}
    try:
        ph = ','.join('?' * len(verse_ids))
        for r in conn.execute('SELECT verse_id, display FROM verse_nikud '
                              'WHERE verse_id IN (%s)' % ph, verse_ids):
            if (r['display'] or '').strip():
                out[r['verse_id']] = r['display']
    except Exception:
        pass                  # a database without the table simply has no marks
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


_VMAP_CACHE = None


def _tm_vmap(conn):
    """{(book, chapter, verse): verse id} — read once per process. It was being
    rebuilt on every lookup, which meant a join over all six thousand verses for
    each word somebody typed into the dictionary."""
    global _VMAP_CACHE
    if _VMAP_CACHE is not None:
        return _VMAP_CACHE
    vmap = {}
    for r in conn.execute("""SELECT v.id, b.order_n bo, c.number cn, v.number vn FROM verses v
        JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id"""):
        if str(r['vn']).isdigit():
            vmap[(r['bo'], r['cn'], int(r['vn']))] = r['id']
    _VMAP_CACHE = vmap
    return vmap


_VERSE_HE_CACHE = None


def _verse_hebrew(conn):
    """{verse id: its Hebrew} — read once per process, for the same reason."""
    global _VERSE_HE_CACHE
    if _VERSE_HE_CACHE is not None:
        return _VERSE_HE_CACHE
    out = {}
    try:
        for v in conn.execute('SELECT id, text FROM verses'):
            out[v['id']] = (v['text'] or '').strip()
    except sqlite3.OperationalError:
        out = {}
    _VERSE_HE_CACHE = out
    return out


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


# the five final letters sort with the letters they are forms of, so כתב and
# מלך fall where a reader looking them up would expect, and not between ט and כ
_FINALS = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ',
           'ף': 'פ', 'ץ': 'צ'}


def _he_sort_key(w):
    return ''.join(_FINALS.get(c, c) for c in (w or ''))


@_without_lexicon([])
def get_tm_words(book):
    """A per-chapter glossary: the distinct Aramaic words of a TM book that have a
    gloss in A. Tal's dictionary (word · root · Hebrew meaning).

    Ordered by the Aramaic word's own alphabet. It used to come out in order of
    first appearance, which is an order only the book knows: a reader with a word
    in hand had to read the whole list to find out whether it was there."""
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
    out.sort(key=lambda r: _he_sort_key(r['word']))
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


# ── Responsa of Jacob ben Aaron the Priest ("שו"ת") as a standalone library book ──
def get_shyt_toc():
    """Table of contents for the responsa: each question (שאלה) is a browsable unit."""
    conn = get_connection()
    rows = conn.execute("""SELECT s.id, s.qnum, s.title, COUNT(l.id) n
        FROM shyt_sections s LEFT JOIN shyt_verse_links l ON l.section_id=s.id
        GROUP BY s.id ORDER BY s.ord""").fetchall()
    conn.close()
    return [{'id': r['id'], 'qnum': r['qnum'], 'title': r['title'] or '', 'count': r['n']} for r in rows]


def get_shyt_chapter(qid):
    """One responsum, with its biblical anchors, inline verse refs made clickable,
    and the primary linked verse (for the citation jump into the Torah app)."""
    try:
        qid = int(qid)
    except (TypeError, ValueError):
        return {'id': None, 'sections': []}
    conn = get_connection()
    vmap = _tm_vmap(conn)
    s = conn.execute("SELECT id, qnum, title, text, anchors FROM shyt_sections WHERE id=?", (qid,)).fetchone()
    if not s:
        conn.close()
        return {'id': qid, 'sections': []}
    vrow = conn.execute("SELECT MIN(verse_id) v FROM shyt_verse_links WHERE section_id=?", (qid,)).fetchone()
    conn.close()
    html = _tm_mark_refs(s['text'] or '', vmap)
    if (s['anchors'] or '').strip():
        html += '<div class="shyt-anchors">' + _tm_mark_refs(s['anchors'], vmap) + '</div>'
    return {'id': qid, 'qnum': s['qnum'], 'title': s['title'] or '',
            'sections': [{'id': s['id'], 'ref': s['title'] or '', 'title': '',
                          'hebrew': s['text'] or '', 'hebrew_html': html,
                          'verse_id': vrow['v'] if vrow else None}]}


def search_shyt(q, limit=80):
    """Search the responsa (question titles + answer text)."""
    q = (q or '').strip()
    if not q:
        return []
    conn = get_connection()
    like = '%' + q + '%'
    rows = conn.execute("SELECT id, qnum, title, text FROM shyt_sections "
                        "WHERE text LIKE ? OR title LIKE ? ORDER BY ord LIMIT ?",
                        (like, like, limit)).fetchall()
    conn.close()
    out = []
    for r in rows:
        txt = r['text'] or ''
        i = txt.find(q)
        snip = ('…' + txt[max(0, i - 32):i + len(q) + 44] + '…') if i >= 0 else txt[:90]
        out.append({'id': r['id'], 'qnum': r['qnum'], 'title': r['title'] or '', 'snippet': snip})
    return out


# ── Sīr al-Qulūb ("סוד הלבבות") as a standalone library book ──
def get_sir_toc():
    """Table of contents for Sīr al-Qulūb: each section is a browsable unit."""
    conn = get_connection()
    rows = conn.execute("""SELECT s.id, s.ord, s.title, COUNT(l.id) n
        FROM sir_sections s LEFT JOIN sir_verse_links l ON l.section_id=s.id
        GROUP BY s.id ORDER BY s.ord""").fetchall()
    conn.close()
    return [{'id': r['id'], 'ord': r['ord'], 'title': r['title'] or '', 'count': r['n']} for r in rows]


def get_sir_chapter(sid):
    """One section of Sīr al-Qulūb, with inline verse refs made clickable and the
    primary linked verse (for the citation jump into the Torah app)."""
    try:
        sid = int(sid)
    except (TypeError, ValueError):
        return {'id': None, 'sections': []}
    conn = get_connection()
    vmap = _tm_vmap(conn)
    s = conn.execute("SELECT id, ord, title, text FROM sir_sections WHERE id=?", (sid,)).fetchone()
    if not s:
        conn.close()
        return {'id': sid, 'sections': []}
    vrow = conn.execute("SELECT MIN(verse_id) v FROM sir_verse_links WHERE section_id=?", (sid,)).fetchone()
    conn.close()
    html = _tm_mark_refs(s['text'] or '', vmap)
    return {'id': sid, 'ord': s['ord'], 'title': s['title'] or '',
            'sections': [{'id': s['id'], 'ref': s['title'] or '', 'title': '',
                          'hebrew': s['text'] or '', 'hebrew_html': html,
                          'verse_id': vrow['v'] if vrow else None}]}


def search_sir(q, limit=80):
    """Search Sīr al-Qulūb (section titles + text)."""
    q = (q or '').strip()
    if not q:
        return []
    conn = get_connection()
    like = '%' + q + '%'
    rows = conn.execute("SELECT id, ord, title, text FROM sir_sections "
                        "WHERE text LIKE ? OR title LIKE ? ORDER BY ord LIMIT ?",
                        (like, like, limit)).fetchall()
    conn.close()
    out = []
    for r in rows:
        txt = r['text'] or ''
        i = txt.find(q)
        snip = ('…' + txt[max(0, i - 32):i + len(q) + 44] + '…') if i >= 0 else txt[:90]
        out.append({'id': r['id'], 'ord': r['ord'], 'title': r['title'] or '', 'snippet': snip})
    return out


# ── פירוש אם בחקותי as a standalone library book ──
# The edition prints no table of contents, so the work's only division is the
# author's own numbered paragraphs {1}–{235}. 234 of them make an unusable index
# and average barely two sections each, which reads badly for what is really one
# continuous treatise. These parts group the paragraphs where the argument
# actually turns: the boundaries are the author's own paragraph numbers, the
# titles describe the stretch they open.
BHUQ_PARTS = [
    (1, 7, 'פתיחה: המיליות ״אם״ והבי״ת'),
    (8, 13, 'אמיתות שליחות משה, ומי הם המחויבים'),
    (14, 25, 'מי חייב במצוות: השכל, הגיל והיכולת'),
    (26, 36, 'מניין המצוות — תרי״ג ופירוטן'),
    (37, 45, 'הגמול: חובה או חסד'),
    (46, 55, 'ברכות הפרשה — הבטחה לכלל ולא ליחיד'),
    (56, 62, 'העולם הבא וההוכחה השכלית לקיומו'),
    (63, 67, 'שירת האזינו כראיה לעולם הבא'),
    (68, 76, 'תשובה לעובדי האלילים, ויום הנקם'),
    (77, 86, 'הגשם: לשון, טבע וייחוד ארץ כנען'),
    (87, 90, 'ה״א ההדגשה, ונס שאינו מאמת שקר'),
    (91, 103, 'ארבע שלמויות השליח: גוף, חושים וידע'),
    (104, 111, 'שני העצים — הטוב והרע שבאדם'),
    (112, 121, 'עצי השיטים, הארון והמתהלכים לפני האל'),
    (122, 135, '״של נעליך״: לבוש האור והמסווה'),
    (136, 143, 'המטה ומופתיו'),
    (144, 151, 'העולם המלאכי, הרקיע והמסלולים'),
    (152, 163, 'מסע המדבר: מרה, אילים, רפידים ועמלק'),
    (164, 177, 'העלייה אל הערפל וחמש מעלות ההר'),
    (178, 189, 'עשרת הדברים שבהם התייחד משה'),
    (190, 197, '״מעון הקדש״ ומסלול הדיבור והתפילה'),
    (198, 212, 'לשון הברכה: ״והשיג לכם דיש״ ו״ואכלתם לחמכם״'),
    (213, 226, '״וישבתם לבטח בארצכם״ — הארץ והמורשת'),
    (227, 235, '״צלם״: יראת האל כיסוד התורה'),
]
_BHUQ_COLOPHON = len(BHUQ_PARTS) + 1          # the copyist's colophon, kept as a last part

# This edition cites verses as '(שמי לג 22)' — abbreviated book, gematria
# chapter, then an Arabic numeral — not the '(שמות ג,ז)' form _TM_REF handles.
_BHUQ_ABBR = {'ברי': 1, 'בר': 1, 'בראשית': 1, 'שמי': 2, 'שמ': 2, 'שמות': 2,
              'ויקי': 3, 'ויק': 3, 'ויקרא': 3, 'במי': 4, 'במ': 4, 'במדבר': 4,
              'דבי': 5, 'דב': 5, 'דברים': 5}
_BHUQ_REF = re.compile(r'\(\s*(' + '|'.join(sorted(_BHUQ_ABBR, key=len, reverse=True)) +
                       r')\s*[׳\']?\s*([א-ת]{1,4})\s*[׳\']?\s+(\d{1,3})'
                       # swallow the rest of the parenthesis ('… נייש)') so the whole
                       # citation is the link, but stay optional: a citation left
                       # unclosed in the source still links on the reference itself
                       r'(?:[^)\n]{0,14}\))?')


def _bhuq_mark_refs(text, vmap):
    """Escape `text`, wrapping each '(שמי לג 22)' citation in a clickable ref."""
    out, last = [], 0
    for m in _BHUQ_REF.finditer(text or ''):
        out.append(_tm_esc(text[last:m.start()]))
        vid = vmap.get((_BHUQ_ABBR[m.group(1)], _tm_gem(m.group(2)), int(m.group(3))))
        lbl = _tm_esc(m.group(0))
        out.append('<a class="tm-ref" data-vid="%d">%s</a>' % (vid, lbl) if vid else lbl)
        last = m.end()
    out.append(_tm_esc((text or '')[last:]))
    return ''.join(out)


def _bhuq_para(ref):
    """'{169}' → 169. The colophon rows carry a word, not a number → None."""
    m = re.match(r'^\s*\{(\d+)\}\s*$', ref or '')
    return int(m.group(1)) if m else None


def _bhuq_part_of(ref):
    """Which part a section belongs to; colophon rows fall in the last part."""
    n = _bhuq_para(ref)
    if n is None:
        return _BHUQ_COLOPHON
    for i, (lo, hi, _t) in enumerate(BHUQ_PARTS, start=1):
        if lo <= n <= hi:
            return i
    return len(BHUQ_PARTS)                     # anything past the table joins the last part


def get_bhuq_toc():
    """Table of contents for פירוש אם בחקותי — one card per part."""
    conn = get_connection()
    try:
        rows = conn.execute("SELECT id, ref, page FROM bhuq_sections ORDER BY ord").fetchall()
    except Exception:
        rows = []
    conn.close()
    agg = {}
    for r in rows:
        p = _bhuq_part_of(r['ref'])
        a = agg.setdefault(p, {'n': 0, 'p1': r['page'], 'p2': r['page']})
        a['n'] += 1
        a['p1'] = min(a['p1'], r['page'] or 0)
        a['p2'] = max(a['p2'], r['page'] or 0)
    out = []
    for i, (lo, hi, title) in enumerate(BHUQ_PARTS, start=1):
        a = agg.get(i)
        if not a:
            continue
        out.append({'part': i, 'letter': str(i), 'title': title, 'count': a['n'],
                    'paras': '{%d}–{%d}' % (lo, hi), 'pages': [a['p1'], a['p2']]})
    if _BHUQ_COLOPHON in agg:
        a = agg[_BHUQ_COLOPHON]
        out.append({'part': _BHUQ_COLOPHON, 'letter': '·', 'title': 'קולופון המעתיק',
                    'count': a['n'], 'paras': '', 'pages': [a['p1'], a['p2']]})
    return out


def get_bhuq_chapter(part):
    """One part of the treatise: every section in it, in reading order, with
    inline citations made clickable and the verse each section is linked to."""
    try:
        part = int(part)
    except (TypeError, ValueError):
        return {'part': None, 'title': '', 'sections': []}
    conn = get_connection()
    vmap = _tm_vmap(conn)
    try:
        rows = conn.execute("SELECT id, ord, page, ref, title, text "
                            "FROM bhuq_sections ORDER BY ord").fetchall()
        vlink = {r['sid']: r['vid'] for r in conn.execute(
            "SELECT section_id sid, MIN(verse_id) vid FROM bhuq_verse_links GROUP BY section_id")}
    except Exception:
        rows, vlink = [], {}
    conn.close()
    secs = [r for r in rows if _bhuq_part_of(r['ref']) == part]
    if part == _BHUQ_COLOPHON:
        title = 'קולופון המעתיק'
    else:
        lo, hi, title = BHUQ_PARTS[part - 1] if 1 <= part <= len(BHUQ_PARTS) else (0, 0, '')
    out = [{'id': s['id'], 'ref': s['ref'] or '', 'title': s['title'] or '',
            'page': s['page'],
            'hebrew': s['text'] or '', 'hebrew_html': _bhuq_mark_refs(s['text'] or '', vmap),
            'verse_id': vlink.get(s['id'])} for s in secs]
    return {'part': part, 'title': title, 'sections': out}


def search_bhuq(q, limit=80):
    """Search the treatise (section titles + text)."""
    q = (q or '').strip()
    if not q:
        return []
    conn = get_connection()
    like = '%' + q + '%'
    try:
        rows = conn.execute("SELECT id, ord, page, ref, title, text FROM bhuq_sections "
                            "WHERE text LIKE ? OR title LIKE ? ORDER BY ord LIMIT ?",
                            (like, like, limit)).fetchall()
    except Exception:
        rows = []
    conn.close()
    out = []
    for r in rows:
        txt = r['text'] or ''
        i = txt.find(q)
        snip = ('…' + txt[max(0, i - 32):i + len(q) + 44] + '…') if i >= 0 else txt[:90]
        out.append({'id': r['id'], 'part': _bhuq_part_of(r['ref']), 'page': r['page'],
                    'ref': r['ref'] or '', 'title': r['title'] or '', 'snippet': snip})
    return out


# ── ספר הערוות ──────────────────────────────────────────────────────────────
# The book cites scripture as '(ויקרא י״ח, י״ד)' — the book's full name and two
# Hebrew numerals, the numerals written with the gershayim a printed book uses.
# That is the Tibåt Mårqe form with punctuation inside the numbers, which is why
# it needs a pattern of its own rather than _TM_REF.
_ERVAH_REF = re.compile(r'\((בראשית|שמות|ויקרא|במדבר|דברים)\s+'
                        r'([א-ת״׳\'"]{1,8})\s*[,，،]\s*([א-ת״׳\'"]{1,8})\)')


def _ervah_gem(s):
    """A Hebrew numeral as a number; the gershayim are punctuation, not letters."""
    return sum(_TM_GEM.get(c, 0) for c in (s or ''))


def _ervah_mark_refs(text, vmap):
    """Escape `text`, wrapping each citation's reference in a clickable ref."""
    out, last = [], 0
    for m in _ERVAH_REF.finditer(text or ''):
        out.append(_tm_esc(text[last:m.start()]))
        vid = vmap.get((_TM_BORD[m.group(1)], _ervah_gem(m.group(2)),
                        _ervah_gem(m.group(3))))
        lbl = _tm_esc(m.group(0))
        out.append('<a class="tm-ref" data-vid="%d">%s</a>' % (vid, lbl) if vid else lbl)
        last = m.end()
    out.append(_tm_esc((text or '')[last:]))
    return ''.join(out)


_ERVAH_AR_BORD = {'التكوين': 1, 'الخروج': 2, 'اللاويين': 3, 'العدد': 4, 'التثنية': 5}
_ERVAH_AR_REF = re.compile('(التكوين|الخروج|اللاويين|العدد|التثنية)'
                           r'\s+([٠-٩]{1,3})\s*:\s*([٠-٩]{1,3})')


def _ervah_ar_num(s):
    """An Arabic-Indic numeral as a number."""
    return int(''.join(chr(ord('0') + ord(c) - 0x660) for c in (s or '')) or 0)


def _ervah_mark_refs_ar(text, vmap):
    """The same, for the Arabic rendering — its citations name the book in Arabic
    and count in Arabic-Indic digits, so they need their own reading."""
    out, last = [], 0
    for m in _ERVAH_AR_REF.finditer(text or ''):
        out.append(_tm_esc(text[last:m.start()]))
        vid = vmap.get((_ERVAH_AR_BORD[m.group(1)], _ervah_ar_num(m.group(2)),
                        _ervah_ar_num(m.group(3))))
        lbl = _tm_esc(m.group(0))
        out.append('<a class="tm-ref" data-vid="%d">%s</a>' % (vid, lbl) if vid else lbl)
        last = m.end()
    out.append(_tm_esc((text or '')[last:]))
    return ''.join(out)


_ERVAH_NUM = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב',
              'יג', 'יד', 'טו', 'טז', 'יז', 'יח', 'יט', 'כ', 'כא', 'כב', 'כג', 'כד',
              'כה', 'כו', 'כז', 'כח', 'כט', 'ל']


def get_ervah_toc(lang='he'):
    """The book's sections, in order — one card each, with how many verses it
    reads. In Arabic each chapter is named in Arabic."""
    conn = get_connection()
    try:
        rows = conn.execute("""SELECT s.id, s.ord, s.title, LENGTH(s.text) len,
                                      COUNT(l.verse_id) n
                               FROM ervah_sections s
                               LEFT JOIN ervah_verse_links l ON l.section_id = s.id
                               GROUP BY s.id ORDER BY s.ord""").fetchall()
    except Exception:
        rows = []
    ar = _ervah_ar(conn) if lang == 'ar' else {}
    conn.close()

    def badge(n):
        # the chapter's number, counted the way the reader is reading
        if lang == 'ar':
            return ''.join(chr(0x660 + int(d)) for d in str(n))
        return _ERVAH_NUM[n] if 0 < n < len(_ERVAH_NUM) else str(n)

    return [{'id': r['id'], 'ord': r['ord'], 'letter': badge(r['ord']),
             'title': ar.get((r['ord'], -1), '') or r['title'] or '', 'count': r['n'] or 0,
             'len': r['len'] or 0} for r in rows]


def get_ervah_chapter(sid, lang='he'):
    """One section, paragraph by paragraph, with its citations made clickable and
    the verse each paragraph reads — so a reader can step from the book into the
    Torah at the place it is arguing about.

    In Arabic the paragraph's own Arabic rendering is read in its place, keyed by
    the same split; a paragraph with none yet keeps the Hebrew, marked `pending`,
    so the book still reads continuously."""
    try:
        sid = int(sid)
    except (TypeError, ValueError):
        return {'id': None, 'title': '', 'sections': []}
    conn = get_connection()
    vmap = _tm_vmap(conn)
    try:
        s = conn.execute('SELECT id, ord, title, text FROM ervah_sections WHERE id=?',
                         (sid,)).fetchone()
        links = conn.execute('SELECT verse_id, quote FROM ervah_verse_links '
                             'WHERE section_id=? ORDER BY verse_id', (sid,)).fetchall()
    except Exception:
        s, links = None, []
    ar = _ervah_ar(conn) if lang == 'ar' else {}
    conn.close()
    if not s:
        return {'id': sid, 'title': '', 'sections': []}
    # a paragraph's verse is the first verse whose quotation stands in it
    byq = [(l['quote'] or '', l['verse_id']) for l in links if (l['quote'] or '').strip()]
    out = []
    for i, para in enumerate([p for p in (s['text'] or '').split('\n\n') if p.strip()], 1):
        vid = None
        for quote, v in byq:
            if quote[:24] and quote[:24] in para:
                vid = v
                break
        txt = ar.get((s['ord'], i - 1), '') if lang == 'ar' else ''
        arabic = bool(txt.strip())
        pending = lang == 'ar' and not arabic
        body = txt if arabic else para
        out.append({'id': sid * 1000 + i, 'ref': '', 'title': '',
                    'hebrew': body, 'pending': pending,
                    'hebrew_html': (_ervah_mark_refs_ar(body, vmap) if arabic
                                    else _ervah_mark_refs(body, vmap)),
                    'verse_id': vid})
    return {'id': sid, 'ord': s['ord'],
            'title': ar.get((s['ord'], -1), '') or s['title'] or '', 'sections': out}


def _ervah_bare(s):
    """The text with its vocalisation taken off, for matching against a word a
    reader typed — nobody types עֶרְוַת."""
    return re.sub(r'[֑-ׇ]', '', s or '')


def _ervah_para_for(text, quote):
    """The paragraph the book quoted a verse in — that is the passage that
    belongs under the verse. A quotation that cannot be found (the text having
    been re-flowed) falls back to the opening paragraph rather than to nothing."""
    paras = [p for p in (text or '').split('\n\n') if p.strip()]
    key = _ervah_bare(quote or '')[:24]
    if key:
        for p in paras:
            if key in _ervah_bare(p):
                return p
    return paras[0] if paras else (text or '')


def search_ervah(q, limit=80, lang='he'):
    """Search the book (section titles + text), the marks set aside.

    A reader reading the Arabic searches the Arabic: the section's paragraphs are
    then joined from their Arabic rendering, so what is found is what is on the
    page in front of them."""
    q = _ervah_bare((q or '').strip())
    if not q:
        return []
    conn = get_connection()
    try:
        rows = conn.execute('SELECT id, ord, title, text FROM ervah_sections '
                            'ORDER BY ord').fetchall()
    except Exception:
        rows = []
    ar = _ervah_ar(conn) if lang == 'ar' else {}
    conn.close()
    out = []
    for r in rows:
        body = r['text'] or ''
        if lang == 'ar':
            paras = [p for p in body.split('\n\n') if p.strip()]
            body = '\n\n'.join(ar.get((r['ord'], i), '') or p
                               for i, p in enumerate(paras))
        bare = _ervah_bare(body)
        i = bare.find(q)
        ttl = ar.get((r['ord'], -1), '') or r['title'] or ''
        if i < 0 and q not in _ervah_bare(ttl):
            continue
        snip = ('…' + bare[max(0, i - 32):i + len(q) + 44] + '…') if i >= 0             else _ervah_bare(ttl)
        out.append({'id': r['id'], 'ord': r['ord'],
                    'title': _ervah_bare(ar.get((r['ord'], -1), '') or r['title'] or ''),
                    'snippet': snip})
        if len(out) >= limit:
            break
    return out


def _asatir_ar_col(conn):
    """'s.arabic' when the DB has that column, else a literal empty string.

    The live app reads its DB from a persistent disk, which is only re-seeded from
    the repo on request — so a deploy can run new code against a DB written before
    a column existed. Selecting `arabic` unconditionally made the library reader
    return 500 there, and made the verse panel swallow the exception and show
    nothing at all. Ask the DB what it has instead of assuming."""
    try:
        cols = [r[1] for r in conn.execute('PRAGMA table_info(asatir_sections)')]
    except Exception:
        cols = []
    return 's.arabic' if 'arabic' in cols else "''"


# ── ספר האסאטיר as a standalone library book ──
# Unlike the other works on the shelf the Asatir is not a commentary keyed to
# verses but a running chronicle from Adam to the end of days, divided here into
# its 16 chapters; a "section" is one paragraph of the chronicle, cited by
# chapter,paragraph (e.g. "ט,4").
def get_asatir_toc():
    """The chapters of the Asatir — the table of contents."""
    conn = get_connection()
    rows = conn.execute("""SELECT chap, chap_title, COUNT(*) n FROM asatir_sections
        GROUP BY chap, chap_title ORDER BY chap""").fetchall()
    conn.close()
    return [{'chap': r['chap'], 'heb': _num_he(r['chap']),
             'title': r['chap_title'] or '', 'count': r['n']} for r in rows]


def get_asatir_chapter(chap):
    """All paragraphs of one Asatir chapter, in order, each with the Torah verse it
    retells (for the citation jump) and inline verse refs made clickable."""
    try:
        chap = int(chap)
    except (TypeError, ValueError):
        return {'chap': None, 'sections': []}
    conn = get_connection()
    vmap = _tm_vmap(conn)
    vlink = {}
    for r in conn.execute("""SELECT l.section_id sid, MIN(l.verse_id) vid
        FROM asatir_verse_links l JOIN asatir_sections s ON s.id=l.section_id
        WHERE s.chap=? GROUP BY l.section_id""", (chap,)):
        vlink[r['sid']] = r['vid']
    secs = conn.execute("SELECT s.id, s.ref, s.chap_title, s.text, %s arabic "
                        "FROM asatir_sections s WHERE s.chap=? ORDER BY s.ord"
                        % _asatir_ar_col(conn), (chap,)).fetchall()
    conn.close()
    title = secs[0]['chap_title'] if secs else ''
    out = [{'id': s['id'], 'ref': s['ref'] or '', 'title': '',
            'hebrew': s['text'] or '', 'arabic': s['arabic'] or '',
            'hebrew_html': _tm_mark_refs(s['text'] or '', vmap),
            'verse_id': vlink.get(s['id'])} for s in secs]
    return {'chap': chap, 'heb': _num_he(chap), 'title': title, 'sections': out}


def search_asatir(q, limit=80):
    """Search the Asatir (chapter titles + paragraph text)."""
    q = (q or '').strip()
    if not q:
        return []
    conn = get_connection()
    like = '%' + q + '%'
    rows = conn.execute("SELECT id, chap, chap_title, ref, text FROM asatir_sections "
                        "WHERE text LIKE ? OR chap_title LIKE ? ORDER BY ord LIMIT ?",
                        (like, like, limit)).fetchall()
    conn.close()
    out = []
    for r in rows:
        txt = r['text'] or ''
        i = txt.find(q)
        snip = ('…' + txt[max(0, i - 32):i + len(q) + 44] + '…') if i >= 0 else txt[:90]
        out.append({'id': r['id'], 'chap': r['chap'], 'heb': _num_he(r['chap']),
                    'title': r['chap_title'] or '', 'ref': r['ref'] or '', 'snippet': snip})
    return out


# ── Two translated studies, each a standalone book on the shelf ───────────────
# Wreschner 1888 (a Halle dissertation on Samaritan tradition) and Cohen 1899
# (the Zaraath laws after the Kitāb al-Kāfī), in the owner's Hebrew translation.
# Neither is keyed to verses, so like the Asatir they are read chapter by
# chapter; a "section" here is one paragraph of the translation, carrying the
# printed page it came from (`ref`) and the heading it opens, when it opens one.
def _study_toc(table):
    conn = get_connection()
    rows = conn.execute("""SELECT chap, chap_title, COUNT(*) n FROM %s
        GROUP BY chap, chap_title ORDER BY chap""" % table).fetchall()
    conn.close()
    return [{'chap': r['chap'], 'heb': _num_he(r['chap']),
             'title': r['chap_title'] or '', 'count': r['n']} for r in rows]


def _study_chapter(table, chap):
    """One chapter of a translated study, its scripture references made clickable."""
    try:
        chap = int(chap)
    except (TypeError, ValueError):
        return {'chap': None, 'sections': []}
    conn = get_connection()
    vmap = _tm_vmap(conn)
    secs = conn.execute("SELECT id, ref, title, chap_title, text FROM %s "
                        "WHERE chap=? ORDER BY ord" % table, (chap,)).fetchall()
    conn.close()
    title = secs[0]['chap_title'] if secs else ''
    out = [{'id': s['id'], 'ref': s['ref'] or '', 'title': s['title'] or '',
            'hebrew': s['text'] or '',
            'hebrew_html': _tm_mark_refs(s['text'] or '', vmap),
            'verse_id': None} for s in secs]
    return {'chap': chap, 'heb': _num_he(chap), 'title': title, 'sections': out}


def _study_search(table, q, limit=80):
    q = (q or '').strip()
    if not q:
        return []
    conn = get_connection()
    like = '%' + q + '%'
    rows = conn.execute("SELECT id, chap, chap_title, ref, title, text FROM %s "
                        "WHERE text LIKE ? OR title LIKE ? OR chap_title LIKE ? "
                        "ORDER BY chap, ord LIMIT ?" % table,
                        (like, like, like, limit)).fetchall()
    conn.close()
    out = []
    for r in rows:
        txt = r['text'] or ''
        i = txt.find(q)
        snip = ('…' + txt[max(0, i - 32):i + len(q) + 44] + '…') if i >= 0 else txt[:90]
        out.append({'id': r['id'], 'chap': r['chap'], 'heb': _num_he(r['chap']),
                    'title': r['title'] or r['chap_title'] or '',
                    'ref': r['ref'] or '', 'snippet': snip})
    return out


def get_wreschner_toc():             return _study_toc('wreschner_sections')
def get_wreschner_chapter(chap):     return _study_chapter('wreschner_sections', chap)
def search_wreschner(q, limit=80):   return _study_search('wreschner_sections', q, limit)

def get_cohen_toc():                 return _study_toc('cohen_sections')
def get_cohen_chapter(chap):         return _study_chapter('cohen_sections', chap)
def search_cohen(q, limit=80):       return _study_search('cohen_sections', q, limit)


# ── Samaritan piyyutim ("עיון בפיוטים השומרוניים") + rhyme finder ──────────────
# Two standalone library units built from the user's own pipeline export
# (app_unit/piyutim_data.js + rhyme_data.js, imported via scripts/piyutim/
# import_piyutim.py). The reader groups by festival > genre (not a flat/lettered
# TOC like the other library books), so the frontend gets light metadata for
# every piece and builds the tree client-side; the rhyme finder is a search
# tool, not a linear reader.
def get_piyutim_toc():
    """Light metadata for every piyyut (no full text) — the client groups this
    into a festival > genre tree, exactly like the standalone prototype did."""
    conn = get_connection()
    rows = conn.execute("""SELECT id, title, incipit3, author, festival, genre, quality
        FROM piyutim ORDER BY festival, genre, author""").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_piyutim_chapter(pid):
    """One piyyut in full, with per-word glosses inline (word -> gloss) restricted
    to words that actually appear in this piece, so the payload stays small."""
    try:
        pid = int(pid)
    except (TypeError, ValueError):
        return None
    conn = get_connection()
    r = conn.execute("""SELECT id, title, incipit3, author, festival, genre, type, source,
        source_ref, quality, text, translation_he, translation_en, notes
        FROM piyutim WHERE id=?""", (pid,)).fetchone()
    if not r:
        conn.close()
        return None
    words = set(re.findall(r'[א-ת]+', r['text'] or ''))
    gloss = {}
    meta = {}
    if words:
        qs = ','.join('?' * len(words))
        for wr in conn.execute('SELECT word, gloss FROM piyutim_dict WHERE word IN (%s)' % qs, tuple(words)):
            gloss[wr['word']] = wr['gloss']
        # and for every word that glossary misses, the same sources every other
        # word unit asks — the dictionary, the Torah, the targum, and the words
        # read one by one where none of those could answer
        meta = resolve_glosses(conn, [w for w in words if w not in gloss])
        for w, v in meta.items():
            if v.get('g'):
                gloss[w] = v['g']
    conn.close()
    out = dict(r)
    out['dict'] = gloss
    # what kind of answer each of those is, where it is not a plain meaning: a
    # reading that corrects the scan, a Hebrew word that needs no translating,
    # or a form that is not a word. The reader is told which.
    out['dict_kind'] = {w: v for w, v in (meta or {}).items() if v.get('k') != 'gloss'}
    return out


def search_piyutim(q, limit=200):
    """Search piyyutim by title/author/text; returns light rows (like get_piyutim_toc)
    for the matching pieces so the client can re-filter its tree to just these ids."""
    q = (q or '').strip()
    if not q:
        return []
    conn = get_connection()
    like = '%' + q + '%'
    rows = conn.execute("""SELECT id, title, incipit3, author, festival, genre, quality
        FROM piyutim WHERE title LIKE ? OR author LIKE ? OR text LIKE ?
        ORDER BY festival, genre, author LIMIT ?""", (like, like, like, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@_without_lexicon({})
def get_piyutim_dict():
    """The whole shared glossary (~300 entries) — small enough to fetch once and
    cache client-side, used for the inline word-tap popup while reading."""
    conn = get_connection()
    rows = conn.execute('SELECT word, gloss FROM piyutim_dict').fetchall()
    conn.close()
    return {r['word']: r['gloss'] for r in rows}


_PIY_FINALS = str.maketrans('ךםןףץ', 'כמנפצ')
_PIY_PHON = str.maketrans('החע', 'אאא')


def _piy_fold_finals(s):
    return (s or '').translate(_PIY_FINALS)


def _piy_phon_key(s, n):
    return _piy_fold_finals(s).translate(_PIY_PHON)[-n:] if s else ''


_PIY_ROW_COLS = 'word, freq, freq_clean, rhyme_key, rhyme_human, rhyme_conf, rhyme_method, definition, occurrences, tal_root'


# ── one rule for every word unit ───────────────────────────────────────────
# A word the app can be asked about comes back with a meaning. Each tier is a
# table that already says what a form means, ordered by how directly it speaks
# about this very form: the volume's own hand-made glossary first, then its
# per-word column, then the app's Aramaic dictionary and the Torah's, then the
# targum laid beside the Hebrew verse, then the remaining word lists.
# (table, the column holding the form, the expression holding the meaning, the
#  name the answer carries back)
_GLOSS_TIERS = (
    ('piyutim_dict',     'word',    'gloss',      'piyut'),
    ('piyutim_words',    'word',    'definition', 'piyut'),
    ('dict_word_index',  'word',    'gloss',      'dict'),
    ('dict_infl',        'form',    "COALESCE(NULLIF(TRIM(gloss),''), "
                                    "NULLIF(TRIM(gloss_tal),''), TRIM(memar_he))", 'dict'),
    ('tal_word_gloss',   'word',    'gloss',      'torah'),
    ('verse_dictionary', 'aramaic', 'hebrew',     'targum'),
    ('dara_words',       'word',    'gloss',      'liturgy'),
    ('meliz_gloss',      'lemma',   "COALESCE(NULLIF(TRIM(hebrew),''), TRIM(arabic))", 'meliz'),
    ('word_gloss',       'word',    'he',         'torah'),
    ('word_align',       'ar',      'he',         'targum'),
)
_SQL_VARS = 800          # SQLite's limit on bound parameters, with room to spare


def _chunks(seq, n=_SQL_VARS):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


_WORD_MEANING_MEM = None


def _word_meaning_file():
    """{word: {g, k, s, r}} read once from the patch that ships with the code.

    Read lazily, because most requests never ask about a word no table could
    answer, and kept in memory afterwards, because the file does not change
    between deploys.
    """
    global _WORD_MEANING_MEM
    if _WORD_MEANING_MEM is None:
        out = {}
        try:
            with open(_WORD_MEANING_PATCH, encoding='utf-8') as fh:
                for r in (json.load(fh).get('rows') or []):
                    w = (r.get('w') or '').strip()
                    if not w:
                        continue
                    v = {'g': (r.get('g') or '').strip(),
                         'k': (r.get('k') or 'gloss').strip(),
                         's': (r.get('s') or '').strip()}
                    if (r.get('r') or '').strip():
                        v['r'] = r['r'].strip()
                    out[w] = v
        except Exception as exc:
            print('[word-meaning] file unread: %s' % exc)
        _WORD_MEANING_MEM = out
    return _WORD_MEANING_MEM


def resolve_glosses(conn, words):
    """{form: {g, k, s}} — what is known about each of these forms.

    g the meaning, k what kind of answer it is ('gloss', or from the curated
    table also 'read' for a scan the reading corrects, 'he' for a Hebrew word
    that needs no translating, 'scan' for a form that is not a word), s the
    source that said it. A form nothing speaks about is simply absent, and the
    caller decides what to say about that.
    """
    want = {w for w in (words or []) if w}
    if not want:
        return {}
    out, echo = {}, {}
    for table, col, expr, name in _GLOSS_TIERS:
        left = [w for w in want if w not in out]
        if not left:
            break
        for part in _chunks(left):
            qs = ','.join('?' * len(part))
            try:
                rows = conn.execute('SELECT %s AS w, %s AS g FROM "%s" WHERE %s IN (%s)'
                                    % (col, expr, table, col, qs), tuple(part))
            except sqlite3.Error:
                break                      # a database without that table has no say
            for r in rows:
                w, g = (r['w'] or '').strip(), (r['g'] or '').strip()
                if not w or not g or w in out:
                    continue
                if g == w:
                    # the word said back to itself is no translation — but it is
                    # a statement that the form is a word of the Hebrew the
                    # reader is reading in, and that needs no translating. Said
                    # as such, and only where nothing better was found.
                    echo.setdefault(w, name)
                    continue
                out[w] = {'g': g, 'k': 'gloss', 's': name}
    # and the words read one by one, where no table could answer
    left = [w for w in want if w not in out]
    if left:
        for part in _chunks(left):
            qs = ','.join('?' * len(part))
            try:
                rows = conn.execute('SELECT word, kind, gloss, reading, src FROM word_meaning '
                                    'WHERE word IN (%s)' % qs, tuple(part)).fetchall()
            except sqlite3.Error:
                break
            for r in rows:
                w = (r['word'] or '').strip()
                if w and w not in out:
                    out[w] = {'g': (r['gloss'] or '').strip(),
                              'k': (r['kind'] or 'gloss').strip(),
                              's': (r['src'] or '').strip()}
                    if (r['reading'] or '').strip():
                        out[w]['r'] = r['reading'].strip()
    # and where the table could not be written at all — a second worker held the
    # lock, the disk is read-only — the same words are read from the file that
    # ships with the code. The table is an optimisation; the answer is not.
    left = [w for w in want if w not in out]
    if left:
        f = _word_meaning_file()
        for w in left:
            v = f.get(w)
            if v:
                out[w] = dict(v)
    for w, name in echo.items():
        if w not in out:
            out[w] = {'g': '', 'k': 'he', 's': name}
    return out


def _piy_gloss_fallback(conn, words):
    """The meaning of every piyyut word the volume's own glossary leaves empty.

    It used to read piyutim_words.definition and nothing else, trusting a
    one-off script to have filled it — and that column is empty for seven in ten
    of the corpus, so the reader was told there was no entry while the
    dictionary held the word. It now asks the same sources as every other word
    unit.
    """
    words = [w for w in set(words) if w]
    if not words:
        return {}
    return {w: v['g'] for w, v in resolve_glosses(conn, words).items() if v.get('g')}


def _piy_rowdicts(conn, rows):
    out = []
    for r in rows:
        d = dict(r)
        try:
            d['occurrences'] = json.loads(d['occurrences'] or '[]')
        except (TypeError, ValueError):
            d['occurrences'] = []
        out.append(d)
    out.sort(key=lambda x: (-(x['freq_clean'] or 0), -(x['freq'] or 0)))
    return out


def _piy_word_rows(conn, where, params):
    rows = conn.execute('SELECT %s FROM piyutim_words WHERE %s' % (_PIY_ROW_COLS, where), params).fetchall()
    return _piy_rowdicts(conn, rows)


_PIY_HEB = re.compile(r'[א-ת]')


def _piy_syllable_estimate(word):
    """Very rough syllable-count GUESS for unvocalized Hebrew/Aramaic text (there's
    no niqqud here to count real vowels) -- treated as roughly one syllable per two
    consonants. Meant only to group words of similar length/rhythm for the "same
    syllable count" filter, not as a linguistically exact syllabification."""
    n = len(_PIY_HEB.findall(word or ''))
    return max(1, round(n / 2.2))


def piyutim_rhyme_sounds():
    """Distinct rhyme-group keys (for the "sound" mode's optional group picker)."""
    conn = get_connection()
    rows = conn.execute("""SELECT DISTINCT rhyme_key FROM piyutim_words
        WHERE rhyme_key IS NOT NULL ORDER BY rhyme_key""").fetchall()
    conn.close()
    return [r['rhyme_key'] for r in rows]


def piyutim_rhyme_search(mode, q, clean_only=False, start_letter='', group=''):
    """Three ending-match modes (per the user's spec) plus an optional starting-
    letter filter combinable with any of them:
    - 'exact': other words whose RAW (unfolded) ending is exactly the same letters
      as q's ending -- a literal spelling match.
    - 'syll': other words with the same rough syllable-count estimate as q (see
      _piy_syllable_estimate -- an approximation, unvocalized text has no real
      syllable marking).
    - 'sound': phonetic ending match -- if q is itself in the corpus with a
      book-derived rhyme group, every other word in that group; else a folded
      phonetic-suffix fallback (ה/ח/ע and finals collapsed). If `group` is given
      instead of typing a word, jumps straight to that explicit rhyme_key group.
    """
    q = (q or '').strip()
    start_letter = (start_letter or '').strip()
    group = (group or '').strip()
    conn = get_connection()
    try:
        if group:
            out = _piy_word_rows(conn, 'rhyme_key=?', (group,))
        elif mode == 'exact':
            if not q:
                return []
            # arbitrary-length suffix match against raw text isn't indexable,
            # so scan once in Python rather than risk a huge IN(...) parameter list
            k = q[-min(3, len(q)):]
            all_rows = conn.execute('SELECT %s FROM piyutim_words' % _PIY_ROW_COLS).fetchall()
            out = _piy_rowdicts(conn, [r for r in all_rows if r['word'] != q and r['word'].endswith(k)])
        elif mode == 'syll':
            if not q:
                return []
            target = _piy_syllable_estimate(q)
            all_rows = conn.execute('SELECT %s FROM piyutim_words' % _PIY_ROW_COLS).fetchall()
            out = _piy_rowdicts(conn, [r for r in all_rows
                                        if r['word'] != q and _piy_syllable_estimate(r['word']) == target])
        else:  # 'sound'
            if not q:
                return []
            me = conn.execute('SELECT rhyme_key FROM piyutim_words WHERE word=?', (q,)).fetchone()
            if me and me['rhyme_key']:
                out = [w for w in _piy_word_rows(conn, 'rhyme_key=?', (me['rhyme_key'],)) if w['word'] != q]
            else:
                k = _piy_phon_key(q, min(3, len(q)))
                out = [w for w in _piy_word_rows(conn, 'phon3=?', (k,)) if w['word'] != q]
    finally:
        conn.close()
    if start_letter:
        out = [w for w in out if w['word'].startswith(start_letter)]
    if clean_only:
        out = [w for w in out if (w['freq_clean'] or 0) > 0]
    return out[:400]


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
    # per-parasha tradition sections synthesized from the community's halakha-and-
    # practice commentary volumes (source noted in VER_UPDATES); presented as part
    # of the tradition source itself, same look as the eyalk sections above.
    try:
        brows = conn.execute(
            f"""SELECT DISTINCT s.parsha, s.title, s.ord, s.text FROM binyamim_sections s
                JOIN binyamim_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders}) ORDER BY s.ord""",
            verse_ids).fetchall()
        out += [{'parsha': (r['parsha'] or '')
                           + ((' · ' + r['title']) if r['title'] else ''),
                 'text': r['text'] or ''} for r in brows]
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


def get_bhuq_commentary(verse_ids):
    """פירוש אם בחקותי - Abū l-Faraj ibn al-Kathār on parashat אם בחקתי, in Ali
    Watad's Hebrew translation, restated in our own words. A passage is attached
    to a verse either because it cites it outright or because it quotes it, so
    the same section can surface on verses far outside Leviticus 26 - that is
    the point: the commentary argues from across the Torah. Each item is
    {ref, title, text}; a section reaching several of the verses appears once."""
    if not verse_ids:
        return []
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            f"""SELECT DISTINCT s.id, s.ref, s.title, s.ord, s.text
                FROM bhuq_sections s
                JOIN bhuq_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders})
                ORDER BY s.ord""",
            verse_ids
        ).fetchall()
    except Exception:
        rows = []
    conn.close()
    return [{'ref': r['ref'] or '', 'title': r['title'] or '', 'text': r['text'] or ''}
            for r in rows]


def get_bhuq_by_verse(verse_ids, lang='he'):
    """The same passages as get_bhuq_commentary, but keyed BY VERSE —
    {verse_id: [{ref, title, text}, ...]} — so the verse-commentary panel can set
    each passage beneath the verse it argues about instead of listing them all at
    the end. A passage reaching several of the verses is repeated under each.

    In Arabic mode the passage is served from `arabic`, falling back to the
    Hebrew for a section not yet translated — an untranslated passage is better
    read in Hebrew than not shown at all."""
    if not verse_ids:
        return {}
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            # DISTINCT: bhuq_verse_links is keyed by (section, verse, method), so a
            # passage that both cites a verse AND quotes it has two rows and would
            # otherwise be printed twice under that verse.
            f"""SELECT DISTINCT l.verse_id vid, s.ref, s.title, s.ord, s.text, s.arabic
                FROM bhuq_sections s
                JOIN bhuq_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders})
                ORDER BY l.verse_id, s.ord""",
            verse_ids
        ).fetchall()
    except Exception:
        rows = []
    conn.close()
    out = {}
    for r in rows:
        txt = (r['arabic'] or '').strip() if lang == 'ar' else ''
        pending = lang == 'ar' and not txt
        if not txt:
            txt = r['text'] or ''
        out.setdefault(r['vid'], []).append(
            {'ref': r['ref'] or '', 'title': r['title'] or '',
             'text': txt, 'pending': pending})
    return out


def _ervah_ar(conn):
    """{(section ord, paragraph): the Arabic of it} — empty when none is stored.

    A section's own title rides along under paragraph -1, so the book names its
    chapters in Arabic too rather than heading Arabic text in Hebrew."""
    try:
        return {(r[0], r[1]): r[2] or '' for r in
                conn.execute('SELECT ord, para, text FROM ervah_para_ar')}
    except Exception:
        return {}


def _ervah_para_index(text, quote):
    """Which paragraph of the section the book quoted the verse in."""
    paras = [p for p in (text or '').split('\n\n') if p.strip()]
    key = _ervah_bare(quote or '')[:24]
    if key:
        for i, p in enumerate(paras):
            if key in _ervah_bare(p):
                return i, p
    return 0, (paras[0] if paras else (text or ''))


def get_ervah_commentary(verse_ids, lang='he'):
    """ספר הערוות on any of the given verses, in the book's own order. A section
    is attached to a verse because the book quotes that verse in it — nothing
    here is inferred — so a section argues under every verse it reads, and a
    section reading several of them appears once."""
    if not verse_ids:
        return []
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            f"""SELECT DISTINCT s.ord, s.title, s.text, l.quote
                FROM ervah_sections s
                JOIN ervah_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders})
                ORDER BY s.ord""",
            verse_ids
        ).fetchall()
    except Exception:
        rows = []
    ar = _ervah_ar(conn) if lang == 'ar' else {}
    conn.close()
    out, seen = [], set()
    for r in rows:
        i, para = _ervah_para_index(r['text'], r['quote'])
        if para in seen:
            continue                     # one paragraph quoting two of the verses
        seen.add(para)
        txt = ar.get((r['ord'], i), '') if lang == 'ar' else ''
        ttl = ar.get((r['ord'], -1), '') if lang == 'ar' else ''
        out.append({'ref': '', 'title': ttl or r['title'] or '',
                    'text': txt or para, 'pending': lang == 'ar' and not txt})
    return out


def get_ervah_by_verse(verse_ids, lang='he'):
    """The same sections keyed BY VERSE — {verse_id: [{ref, title, text}, ...]} —
    so a passage can stand beneath the verse it argues about rather than at the
    end of the chapter. The quotation the book made is the ref, because that is
    what the book itself printed to name the verse."""
    if not verse_ids:
        return {}
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            f"""SELECT DISTINCT l.verse_id vid, l.quote, l.ref, s.ord, s.title, s.text
                FROM ervah_sections s
                JOIN ervah_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders})
                ORDER BY l.verse_id, s.ord""",
            verse_ids
        ).fetchall()
    except Exception:
        rows = []
    ar = _ervah_ar(conn) if lang == 'ar' else {}
    conn.close()
    out = {}
    for r in rows:
        seen = out.setdefault(r['vid'], [])
        i, para = _ervah_para_index(r['text'], r['quote'])
        if any(x['_he'] == para for x in seen):
            continue
        txt = ar.get((r['ord'], i), '') if lang == 'ar' else ''
        ttl = ar.get((r['ord'], -1), '') if lang == 'ar' else ''
        seen.append({'ref': r['quote'] or r['ref'] or '', 'title': ttl or r['title'] or '',
                     'text': txt or para, 'pending': lang == 'ar' and not txt,
                     '_he': para})
    for items in out.values():
        for x in items:
            x.pop('_he', None)
    return out


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


def get_asatir_commentary(verse_ids):
    """ספר האסאטיר — the Samaritan chronicle's retelling of the given verse(s), in
    reading order. Each item is {ref, title, text}, where `ref` is the chapter,
    paragraph citation and `title` the chapter's heading. A passage is attached to
    a verse either because it retells that episode or because it quotes the verse
    outright, so one paragraph can surface on several verses; a paragraph reaching
    several of the verses appears once. Returns [] when nothing is relevant."""
    if not verse_ids:
        return []
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            f"""SELECT DISTINCT s.id, s.chap, s.chap_title, s.ref, s.ord, s.text,
                       {_asatir_ar_col(conn)} arabic
                FROM asatir_sections s
                JOIN asatir_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders})
                ORDER BY s.ord""",
            verse_ids
        ).fetchall()
    except Exception:
        rows = []
    conn.close()
    return [{'ref': 'אסאטיר ' + (r['ref'] or ''), 'title': r['chap_title'] or '',
             'text': r['text'] or '', 'arabic': r['arabic'] or ''} for r in rows]


def get_asatir_by_verse(verse_ids):
    """The same Asatir passages as get_asatir_commentary, but keyed BY VERSE —
    {verse_id: [{ref, title, text}, ...]} — so the verse-commentary panel can set
    each passage beneath the verse it retells instead of listing them all at the
    end. A passage covering several of the verses is repeated under each, which is
    what the reader wants there: every verse row stands on its own."""
    if not verse_ids:
        return {}
    conn = get_connection()
    placeholders = ','.join('?' * len(verse_ids))
    try:
        rows = conn.execute(
            f"""SELECT l.verse_id vid, s.chap_title, s.ref, s.ord, s.text,
                       {_asatir_ar_col(conn)} arabic
                FROM asatir_sections s
                JOIN asatir_verse_links l ON l.section_id = s.id
                WHERE l.verse_id IN ({placeholders})
                ORDER BY l.verse_id, s.ord""",
            verse_ids
        ).fetchall()
    except Exception:
        rows = []
    conn.close()
    out = {}
    for r in rows:
        # bare "יג,13" here (no book name): the panel names the book in its lead-in,
        # unlike the sources panel where the ref has to carry it.
        out.setdefault(r['vid'], []).append(
            {'ref': r['ref'] or '', 'title': r['chap_title'] or '',
             'text': r['text'] or '', 'arabic': r['arabic'] or ''})
    return out


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


# ── what each panel would find, per verse ────────────────────────────────────
# The one button that replaced six cannot promise what it does not have, so the
# sheet it opens asks this first: for these verses, how much does each panel
# actually hold? Read-only throughout — nothing here writes.
# (the key it is counted under, the table). "מן המסורת השומרונית" is drawn from
# four tables and counted under the one name it is presented beneath — the
# lectures, the two attributed articles, and the per-parasha tradition sections.
# The responsa are inside that panel too, but they keep a key of their own: the
# sheet gives them a line of their own, and counting them twice would offer the
# same text behind two names.
_SAM_SOURCES = [('tibat', 'tm_verse_links'), ('eyalk', 'eyalk_verse_links'),
                ('eyalk', 'tradart_verse_links'), ('eyalk', 'binyamim_verse_links'),
                ('shyt', 'shyt_verse_links'), ('tzdaka', 'tzdaka_verse_links'),
                ('bhuq', 'bhuq_verse_links'), ('sir', 'sir_verse_links'),
                ('asatir', 'asatir_verse_links'),
                ('ervah', 'ervah_verse_links')]


def get_verse_sources(verse_ids):
    """{verse_id: {panel: count}} — how much each panel would find, per verse.

    A count of zero is kept rather than dropped: the caller is shown what is
    there, and decides whether an absent source is worth a grey line or no line
    at all. A table this database does not carry simply counts nothing."""
    if not verse_ids:
        return {}
    ids = [int(v) for v in verse_ids]
    ph = ','.join('?' * len(ids))
    out = {v: {'interpret': 0, 'jewish': 0, 'variants': 0, 'translit': 0,
               'samsrc': 0, 'compare': 0, 'translate': 0, 'by': {}} for v in ids}
    conn = get_connection()

    def note(vid, key, n=1, sub=None):
        if vid not in out or not n:
            return
        out[vid][key] = out[vid].get(key, 0) + n
        if sub:
            out[vid]['by'][sub] = out[vid]['by'].get(sub, 0) + n

    # the verse's own columns: the commentary, the Jewish commentators, the
    # texts it can be compared with, and the translations it carries
    cols = ('interpretation', 'rashi', 'ramban', 'cassuto', 'baal_haturim',
            'masoretic_text', 'lxx_text', 'onkelos_text', 'qumran_text',
            'sam_aramaic', 'arabic_trans', 'english')
    try:
        for r in conn.execute('SELECT id, %s FROM verses WHERE id IN (%s)'
                              % (', '.join(cols), ph), ids):
            vid = r['id']
            has = lambda c: 1 if (r[c] or '').strip() else 0      # noqa: E731
            note(vid, 'interpret', has('interpretation'))
            for c in ('rashi', 'ramban', 'cassuto', 'baal_haturim'):
                note(vid, 'jewish', has(c), c)
            for c, name in (('masoretic_text', 'masoretic'), ('lxx_text', 'lxx'),
                            ('onkelos_text', 'onkelos'), ('qumran_text', 'qumran')):
                note(vid, 'compare', has(c), name)
            for c, name in (('sam_aramaic', 'aramaic'), ('arabic_trans', 'arabic'),
                            ('english', 'english')):
                note(vid, 'translate', has(c), name)
    except Exception as exc:
        print('[sources] verses: %s' % exc)

    # the Samaritan works, one table each
    for name, table in _SAM_SOURCES:
        try:
            for r in conn.execute('SELECT verse_id, COUNT(*) AS n FROM "%s" '
                                  'WHERE verse_id IN (%s) GROUP BY verse_id'
                                  % (table, ph), ids):
                note(r['verse_id'], 'samsrc', r['n'], name)
        except Exception:
            pass                       # a database without that work simply has none

    # the manuscript apparatus, and the pronunciation
    for table, key, sub in (('vongall_apparatus', 'variants', None),
                            ('verse_translit', 'translit', 'translit')):
        try:
            for r in conn.execute('SELECT verse_id, COUNT(*) AS n FROM "%s" '
                                  'WHERE verse_id IN (%s) GROUP BY verse_id'
                                  % (table, ph), ids):
                note(r['verse_id'], key, r['n'], sub)
        except Exception:
            pass

    conn.close()
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


# ── אישי השומרונים: a browsable who's-who as a standalone library unit ─────────
# 95 figures (biblical priests through 20th-century scholars), each summarised in
# Hebrew/English/Arabic with its source page. Imported by scripts/people/
# import_people.py, which also assigns the era bucket + sort year the reader
# groups by — the source `period` is free English text ("late 13th - early 14th
# century"), useless for ordering as-is.
_PEOPLE_LIST_COLS = ('id, ord, era, sort_year, name_he, name_en, name_ar, '
                     'period, period_he, period_ar')


def _has_people(conn):
    """A deployment's live DB sits on a persistent disk that can predate this
    table (it arrives with a reseed from the bundled copy). Answer "no data" then,
    so the unit says so in the reader's language instead of returning a 500."""
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='people'").fetchone() is not None


def get_people_toc():
    """Light rows for every figure (names + period, no descriptions) — the client
    builds the era tree / A-Z list from this and fetches a person on demand."""
    conn = get_connection()
    if not _has_people(conn):
        conn.close()
        return []
    rows = conn.execute('SELECT %s FROM people ORDER BY ord' % _PEOPLE_LIST_COLS).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_person(pid):
    """One figure in full: the three descriptions, the enriched note where the
    source supplied one, the further-reading links (stored as JSON text, handed
    over as a list), and the attribution."""
    conn = get_connection()
    if not _has_people(conn):
        conn.close()
        return None
    r = conn.execute('SELECT * FROM people WHERE id=?', (pid or '',)).fetchone()
    conn.close()
    if not r:
        return None
    out = dict(r)
    try:
        refs = json.loads(out.pop('references_json', None) or '[]')
    except (TypeError, ValueError):
        refs = []
    out['references'] = [x for x in refs if isinstance(x, dict) and (x.get('title') or x.get('url'))]
    # {lang: {title, url, text}} for the figures that have a Wikipedia article —
    # each language's own article, so nothing had to be machine-translated
    try:
        out['wikipedia'] = json.loads(out.pop('wikipedia_json', None) or '{}')
    except (TypeError, ValueError):
        out['wikipedia'] = {}
    return out


def search_people(q, limit=200):
    """Search names AND descriptions in all three languages; returns the same light
    rows as get_people_toc() so the client can re-filter its list to the matches."""
    q = (q or '').strip()
    if not q:
        return []
    like = '%' + q + '%'
    conn = get_connection()
    if not _has_people(conn):
        conn.close()
        return []
    rows = conn.execute("""SELECT %s FROM people
        WHERE name_he LIKE ? OR name_en LIKE ? OR name_ar LIKE ?
           OR description_he LIKE ? OR description_en LIKE ? OR description_ar LIKE ?
           OR enriched_note_he LIKE ? OR enriched_note_en LIKE ? OR enriched_note_ar LIKE ?
           OR period LIKE ? OR period_he LIKE ? OR period_ar LIKE ?
           OR wikipedia_json LIKE ?
        ORDER BY ord LIMIT ?""" % _PEOPLE_LIST_COLS, (like,) * 13 + (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


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
    sel_params = []           # params bound by sel_extra (before the WHERE params)
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
            where_params = [rl]
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
            sel_params = [rn]          # binds the SELECT subquery
            where_params = [rn]        # binds the WHERE
    elif exact and not has_special:
        q = _fold_finals(query) if ignore_finals else query
        where = f"(' ' || {fld} || ' ') LIKE ?"
        where_params = [f"% {q} %"]
    elif not has_special:
        # plain substring — a literal Hebrew or Aramaic query (no ? / * / +).
        q = _fold_finals(query) if ignore_finals else query
        where = f"{fld} LIKE ?"
        where_params = [f"%{q}%"]
    else:
        # enhanced search: '?' = one letter, '*' = an unknown string (glob); '+'
        # joins terms that must ALL appear. Runs on the chosen field (Hebrew text
        # or the Aramaic translation), overriding the exact/root flags.
        terms = [t.strip() for t in query.split('+') if t.strip()]
        conds, where_params = [], []
        if any(('?' in t or '*' in t) for t in terms):
            conn.create_function(
                'WILDWORD', 2,
                lambda text, pat: 1 if (text and _wild_search_re(pat).search(text)) else 0)
        if exact:
            # with "חיפוש מדויק" ticked, each '+' term must appear as a COMPLETE word
            # (bounded by non-Hebrew letters), in any order — not as a substring, so
            # e.g. "בא" won't match inside "ויבא"/"באו".
            # whole word = the term, optionally with leading inseparable particles
            # (ו/ה/ב/כ/ל/מ/ש), bounded by non-Hebrew letters — so "ארץ" matches
            # "הארץ"/"ובארץ" but NOT a deeper embedding like "ויבא"/"באו".
            _ff = _fold_finals if ignore_finals else (lambda s: s)
            conn.create_function('WHOLEWORD', 2, lambda text, term: 1 if (
                text and term and re.search(r'(?<![א-ת])[והבכלמש]{0,2}' + re.escape(_ff(term)) + r'(?![א-ת])',
                                            _ff(text))) else 0)
        for t in terms:
            pat = ''.join(c for c in t if ('א' <= c <= 'ת') or c in '?*')
            if ('?' in t or '*' in t) and pat:
                conds.append(f"WILDWORD({field}, ?)")
                where_params.append(pat)
            elif exact:
                conds.append(f"WHOLEWORD({field}, ?)")
                where_params.append(t)
            else:
                conds.append(f"{field} LIKE ?")
                where_params.append(f"%{t}%")
        if conds:
            where = ' AND '.join(conds)
        else:
            where = f"{field} LIKE ?"
            where_params = [f"%{query}%"]
    # true total of matching verses (NOT capped by the display LIMIT), so the result
    # count shown to the user is accurate even when more than 200 verses match.
    total = conn.execute(
        f"SELECT COUNT(*) FROM (SELECT v.id FROM verses v WHERE {where} GROUP BY v.id)",
        where_params).fetchone()[0]
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
        sel_params + where_params,
    ).fetchall()
    conn.close()
    return rows, total


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


def verse_word_pron(verse_id, word):
    """The Ben-Ḥayyim transcription of `word` as it occurs in this verse (the best
    matching transcription token), or '' when none matches well enough — so a search
    result never shows a pronunciation unrelated to the matched word."""
    if not verse_id or not word:
        return ''
    conn = get_connection()
    toks = _translit_tokens(conn, [verse_id]).get(verse_id, [])
    conn.close()
    return _best_translit(word, toks)


def pron_related(word, pron):
    """True if a Latin pronunciation is a plausible transcription of the Hebrew word
    (shared consonant skeleton) — used to filter out unrelated prons in results."""
    if not word or not pron:
        return False
    return _word_cons(word, _lat_cons(pron))[0] >= 0.5


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


# Tal numbers his homographs — חרש¹ the craftsman, חרש² the deaf man, חרש³ the
# wood — and daggers the words attested outside his main corpus (†חזק, †צְלוּ).
# The mark is part of the stored head-word, so a reader typing the plain word
# never reached any of them: 640 of the dictionary's 12,802 entries stand behind
# one. This takes the mark off for MATCHING only; what is displayed keeps it, so
# the reader still sees which homograph a sense belongs to.
_HOMOGRAPH = re.compile('[¹²³⁴-⁹†]')


def _nomark(s):
    return _HOMOGRAPH.sub('', s or '')


@_without_lexicon([])
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


@_without_lexicon([])
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


_BRACKET = re.compile(r'[\(\[]([^()\[\]]*)[\)\]]?')


def _reader_spellings(lemma):
    """Every way a reader might type a head-word Tal printed with his own marks.

    He numbers homographs (חרש¹), daggers words from outside his main corpus
    (†חזק), and puts a letter that may or may not be there in brackets —
    (א)רתחח, תשמין(יות), מסתא(נ)בה, א]רקנע. A reader types one of the real
    spellings, which is none of those strings: both readings of every optional
    group are produced here, and each word of a head-word made of several."""
    out = set()
    for word in _nomark(lemma or '').split():
        # a closing bracket with nothing opened before it marks an optional
        # opening: א]רקנע is read רקנע as well as ארקנע, לנ]קבל both ways
        m = re.match(r'([^()\[\]]+)[\)\]](?![^()\[\]]*[\)\]])', word)
        if m and '(' not in word[:m.start(2) if m.lastindex and m.lastindex > 1 else m.end()]                 and '[' not in word[:m.end()]:
            word = '(' + m.group(1) + ')' + word[m.end():]
        forms = {word}
        for _ in range(4):                    # nested or repeated groups
            nxt = set()
            for x in forms:
                m = _BRACKET.search(x)
                if m:
                    nxt.add(x[:m.start()] + m.group(1) + x[m.end():])
                    nxt.add(x[:m.start()] + x[m.end():])
                else:
                    nxt.add(x)
            if nxt == forms:
                break
            forms = nxt
        for f in forms:
            f = _norm_fin(re.sub('[^' + chr(0x5d0) + '-' + chr(0x5ea) + ']', '', f))
            if len(f) >= 2:
                out.add(f)
    return out


_ALT_HEADWORDS = None


def _alt_headwords(conn):
    """{a spelling a reader would type: [the head-words printed that way]} for
    every entry whose printed form is not what a reader types. Read once per
    process, so a word is answered from memory rather than by scanning."""
    global _ALT_HEADWORDS
    if _ALT_HEADWORDS is not None:
        return _ALT_HEADWORDS
    out = {}
    try:
        rows = conn.execute("SELECT lemma, lemma_norm, root FROM tal_auth_entries").fetchall()
    except sqlite3.OperationalError:
        rows = []
    for r in rows:
        own = r['lemma_norm'] or ''
        for sp in _reader_spellings(r['lemma']):
            if sp == own:
                continue                      # already found letter for letter
            e = out.setdefault(sp, {'lemmas': [], 'roots': []})
            lem = (r['lemma'] or '').strip()
            root = (r['root'] or '').strip()
            if lem and lem not in e['lemmas']:
                e['lemmas'].append(lem)
            if root and root not in e['roots']:
                e['roots'].append(root)
    _ALT_HEADWORDS = out
    return out


def _marked_headwords(conn):
    """{a spelling a reader would type: [roots]} — the root side of the above."""
    return {k: v['roots'] for k, v in _alt_headwords(conn).items() if v['roots']}


@_without_lexicon([])
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
        # 0) the word is the same as a head-word bar its closing vowel letter.
        # Only this one case, and only on the surface form. The tiers below work on
        # stripped variants, so peeling the emphatic ־ה off קמאה reaches the
        # unrelated head-word קמא "בוז, ביזיון" before anything can look further —
        # while Tal's own קמאי / קמאו place the word under קדם, "ראשון, קדום".
        # Nothing else from dict_form_root is consulted here: its 'entry' and
        # 'index' rows carry extraction noise (משה listed under רבה, ארעה under
        # רעל) that the ordinary tiers already step around.
        try:
            rs = [r['root_norm'] for r in conn.execute(
                "SELECT root_norm FROM dict_form_root WHERE form_norm=? "
                "AND sources = 'vowel'", (cnorms[0],))]
        except sqlite3.OperationalError:
            rs = []
        if rs:
            return dedup(rs)
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
        # A root is only ever READ, never inferred. The affix-stripping analysis in
        # dict_infl is deliberately NOT consulted here: stripping ־ה off קמאה — a
        # word Tal does not contain at all — reaches the unrelated head-word קמא
        # "בוז, ביזיון" and would send the reader to that root's occurrences. A word
        # Tal does not know must return no root, not a plausible-looking wrong one.
        for c in cands:                         # 4) word→root gloss (every Torah word)
            rs = [r['root'] for r in conn.execute(
                "SELECT root FROM tal_word_gloss WHERE word=? AND TRIM(COALESCE(root,''))<>''", (c,))]
            if rs:
                return dedup(rs)
        for cn in cnorms:                       # 5) Torah-text root index
            rs = [r['root'] for r in conn.execute("SELECT DISTINCT root FROM root_index WHERE form_norm=?", (cn,))]
            if rs:
                return dedup(rs)
        for c in cands:                         # 6) Tal's own word→root index
            rs = [r['root'] for r in conn.execute("SELECT DISTINCT root FROM dict_root_index WHERE word=?", (c,))]
            if rs:
                return dedup(rs)
        return []

    def marked(cands):
        """Head-words that only a homograph mark kept out of reach (tier 1 compares
        the stored lemma letter for letter, and חרש¹ is not חרש)."""
        m = _marked_headwords(conn)
        out = []
        for cn in [_norm_fin(c) for c in cands]:
            out += m.get(cn, ())
        return dedup(out)

    full, prefixed = _tal_variants(base)
    found = resolve(full) or (resolve(prefixed) if prefixed else [])
    # Appended, never merged into the tiers above: a word that already resolves
    # keeps the root it resolved to, first and unchanged, and everything that reads
    # the first root reads the same root as before. What the marks used to hide
    # simply follows it — for חרש, the craftsman and the sorcerer after the deaf man.
    return found + [r for r in marked(full) if r not in found]


def dict_phrases_for(word, limit=12):
    """The Aramaic set phrases (מטבעות לשון) that a word takes part in, with the
    Hebrew Memar Marqe's own translation gives each one. Formulas and idioms only —
    free word sequences were never stored. Best-attested first."""
    wn = _norm_fin(word)
    if not wn or len(wn) < 2:
        return []
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT phrase, hebrew, parts_gloss, cls, count, corpus, ref, status "
            "FROM dict_phrase WHERE phrase_norm = ? OR phrase_norm LIKE ? "
            "   OR phrase_norm LIKE ? OR phrase_norm LIKE ? "
            "ORDER BY count DESC LIMIT ?",
            (wn, wn + ' %', '% ' + wn, '% ' + wn + ' %', limit)).fetchall()
    except sqlite3.OperationalError:        # table absent in older copies
        conn.close()
        return []
    conn.close()
    return [{'phrase': r['phrase'], 'hebrew': r['hebrew'] or '',
             'parts': r['parts_gloss'] or '', 'cls': r['cls'], 'count': r['count'],
             'corpus': r['corpus'], 'ref': r['ref'], 'status': r['status']}
            for r in rows]


def dict_phrases_browse(q='', limit=200):
    """The set-phrase list for the dictionary's own tab. Best-attested first, and
    the ones carrying a Hebrew rendering confirmed against Memar Marqe's
    translation lead — a phrase we can actually translate is worth more to a
    reader than one we can only take apart."""
    conn = get_connection()
    sql = ("SELECT phrase, hebrew, parts_gloss, cls, count, ref FROM dict_phrase ")
    args = []
    q = (q or '').strip()
    if q:
        sql += "WHERE phrase_norm LIKE ? "
        args.append('%' + _norm_fin(q) + '%')
    sql += ("ORDER BY (CASE WHEN TRIM(COALESCE(hebrew,''))<>'' THEN 0 ELSE 1 END), "
            "count DESC LIMIT ?")
    args.append(limit)
    try:
        rows = conn.execute(sql, args).fetchall()
    except sqlite3.OperationalError:
        conn.close()
        return {'items': [], 'total': 0}
    total = conn.execute("SELECT COUNT(*) FROM dict_phrase").fetchone()[0]
    conn.close()
    return {'total': total, 'items': [
        {'phrase': r['phrase'], 'hebrew': r['hebrew'] or '', 'parts': r['parts_gloss'] or '',
         'cls': r['cls'], 'count': r['count'], 'ref': r['ref']} for r in rows]}


def _he_stem_one(w):
    """Hebrew word minus one proclitic, so האמת and אמת compare equal."""
    w = _norm_fin(w)
    return w[1:] if (len(w) >= 4 and w[0] in 'הובלכמש') else w


def _gloss_matches_memar(gloss, memar_he):
    """Does a root's dictionary meaning say the same thing as the Hebrew that
    Memar Marqe's own translation puts opposite the word?

    This is the corroboration that lets a DERIVED root be trusted. Stripping
    affixes off a word Tal does not list can land anywhere — קמאה reaches קמא
    "בוז, ביזיון" — so the derivation alone proves nothing. But when the root we
    landed on already means what the translated text says the word means, two
    independent sources agree, and the reading is safe to show."""
    if not gloss or not memar_he:
        return False
    m = _he_stem_one(memar_he)
    if len(m) < 2:
        return False
    for tok in re.findall(r'[א-ת]{2,}', gloss):
        g = _he_stem_one(tok)
        if g == m or (len(g) >= 3 and len(m) >= 3 and (g.startswith(m) or m.startswith(g))):
            return True
    return False


@functools.lru_cache(maxsize=1)
def _memar_overused():
    """Hebrew renderings the aligner attached to so many different Aramaic words
    that they carry no information — "דברים" stands opposite 36 unrelated forms.
    A rendering has to be about ONE word to be worth quoting."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT memar_he, COUNT(DISTINCT form_norm) n FROM dict_infl "
            "WHERE rank=0 AND TRIM(COALESCE(memar_he,''))<>'' AND memar_conf>=0.6 "
            "GROUP BY memar_he HAVING n > 15").fetchall()
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    return frozenset(r['memar_he'] for r in rows)


def _memar_rendering(conn, word):
    """The Hebrew that Memar Marqe's own translation puts opposite this word.

    Reported even when the dictionary DID yield a root, because it is evidence
    about this word while the root's senses are evidence about the root — and the
    two part company more often than one would like. תרח occurs 155 times in the
    piyyutim meaning "gate", and Marqe translates it "שער", but Tal's head-word
    תרח holds only Terah the proper name; showing the root alone answers a
    different question than the reader asked."""
    try:
        r = conn.execute(
            "SELECT memar_he, memar_conf FROM dict_infl WHERE form_norm=? "
            "AND TRIM(COALESCE(memar_he,''))<>'' AND memar_conf>=0.6 "
            "ORDER BY rank LIMIT 1", (_norm_fin(word),)).fetchone()
    except sqlite3.OperationalError:
        return None
    if not r or r['memar_he'] in _memar_overused():
        return None
    return {'gloss': r['memar_he'], 'conf': round(r['memar_conf'], 2)}


@_without_lexicon(lambda: {'word': '', 'roots': [], 'phrases': []})
def tal_full_lookup(word, torah_limit=16):
    """Everything Tal's dictionary holds for an Aramaic word, grounded in the
    authoritative page extraction. Returns {word, roots:[{root, senses, torah,
    torah_count, forms}]} where each sense is {lemma, pos, gloss, page} read off
    the dictionary itself, torah are the word's occurrences across the Torah
    (book/ch/verse/verse_id), and forms are other surface forms of the root."""
    conn = get_connection()
    roots = _tal_roots(word, conn)
    # No root from the dictionary's own reading? A derivation may still stand in,
    # but only if Memar Marqe's translation of this very word agrees with what the
    # derived root means. Derivation alone is not evidence; agreement is.
    # A derived root becomes a real root only when a second source vouches for it:
    # dict_form_root (the dictionary lists the form under that root), Memar Marqe's
    # translation, or the Torah glossary — recorded in dict_infl.verified. Where
    # nothing vouches, the derivation is still shown, but as a suggestion, never as
    # a root: sending a reader to ק.ד.מ's occurrences because קמאה happened to strip
    # to something was the whole complaint.
    derived = suggestion = None
    if not roots:
        try:
            r = conn.execute(
                "SELECT root, gloss, gloss_tal, memar_he, derivation, verified "
                "FROM dict_infl WHERE form_norm=? AND TRIM(COALESCE(root,''))<>'' "
                "ORDER BY rank", (_norm_fin(word),)).fetchall()
        except sqlite3.OperationalError:
            r = []
        for row in r:
            if (row['verified'] or '').strip():
                roots = [row['root']]
                derived = {'derivation': row['derivation'], 'verified': row['verified'],
                           'memar_he': row['memar_he']}
                break
        if not roots and r:
            row = r[0]
            suggestion = {'root': row['root'], 'gloss': row['gloss_tal'] or row['gloss'],
                          'derivation': row['derivation'], 'memar_he': row['memar_he']}
    out = {'word': word, 'roots': [], 'derived_root': derived,
           'suggestion': suggestion,
           # where the word itself stands on Tal's pages. Shown even when a root
           # was found — it is the evidence — and it is the whole answer for a
           # word that only ever appears inside somebody else's example sentence.
           'citations': tal_citations_for(word),
           # the same word where it is actually used: in the Targum of the Torah,
           # and in the liturgy — which is where the words Tal never entered live
           'targum': targum_occurrences(word),
           'piyut': piyut_occurrences(word),
           'piyut_corpus': piyut_corpus_occurrences(word),
           'dara': dara_gloss_for(word),
           'torah_he': torah_word_gloss(word),
           'hebrew_side': hebrew_side(word),
           # the same word as the dictionary prints it elsewhere: the gutturals
           # and the sibilants interchange, and each spelling is its own entry
           # up to twenty-four; the screen shows the closest eight and opens the
           # rest, so a large family is never silently cut off
           'near': near_spellings(word, roots, 24),
           # the one lookup every word unit in this app is required to ask, so
           # the dictionary answers a word the same way the word panels do
           'said': (lambda v: ({'gloss': (v.get('g') or '').strip(),
                                'kind': v.get('k') or '', 'reading': (v.get('r') or '').strip(),
                                'src': v.get('s') or ''}
                               if (v.get('g') or v.get('r')) else {}))(
               (resolve_glosses(conn, [word, _tal_bare(word)]) or {}).get(word)
               or (resolve_glosses(conn, [_tal_bare(word)]) or {}).get(_tal_bare(word)) or {})}
    # No source states a meaning? Then say what KIND of word it is, by the
    # taxonomy this app already answers every word unit with: a word standing in
    # the Hebrew text is Hebrew and needs no translating; an Aramaic word with no
    # entry is read off the line standing beside it — the דנע method. Both are
    # answers, and both are evidenced by what is shown above them.
    if not (out['said'].get('gloss') or out['dara'].get('gloss')
            or out['torah_he'].get('he') or out['hebrew_side']
            or any(r['senses'] for r in out['roots'])):
        heb_text = any(o.get('kind') == 'h' for o in out['targum'])
        aram_text = any(o.get('kind') != 'h' for o in out['targum'])
        line_he = ''
        for o in out['targum']:
            if o.get('heb'):
                line_he = o['heb']
                break
        if not line_he:
            for l in out['piyut']:
                if l.get('heb'):
                    line_he = l['heb']
                    break
        if not line_he:
            for cq in out['citations']:
                if cq.get('heb'):
                    line_he = cq['heb']
                    break

        if heb_text and not out['said'].get('kind'):
            out['said'] = {'gloss': '', 'kind': 'he', 'reading': '', 'src': 'text'}
        elif (aram_text or out['piyut'] or out['citations']) and line_he                 and not out['said'].get('kind'):
            out['said'] = {'gloss': '', 'kind': 'line', 'reading': line_he, 'src': 'line'}
        elif not out['said'].get('kind') and (out['targum'] or out['piyut']
                                              or out['piyut_corpus'] or out['citations']):
            # it stands somewhere and no source carries it. That is itself the
            # answer, and it is NOT the same as calling it a corrupt scan.
            out['said'] = {'gloss': '', 'kind': 'none', 'reading': '', 'src': 'none'}

    # Where the string itself was read from. The dictionary holds it; it must not
    # pretend otherwise — and the sentences it finds carry Hebrew of their own.
    if not (out['roots'] or out['citations'] or out['targum'] or out['piyut']
            or out['piyut_corpus'] or out['dara'] or out['torah_he']):
        out['read_as'] = dict_read_as(word)
    else:
        out['read_as'] = []
    if not out['said'].get('kind') and not out['said'].get('gloss'):
        for x in out['read_as']:
            if (x.get('heb') or '').strip():
                out['said'] = {'gloss': '', 'kind': 'line',
                               'reading': x['heb'].strip(), 'src': 'line'}
                break
    # a string that is only ever shown as "this is where it was read" — and a
    # head-word whose meaning the page never gave — are answered too: no source
    # we hold carries a meaning for it, which is a different thing from silence.
    if out['read_as'] and not out['said'].get('kind') and not out['said'].get('gloss'):
        out['said'] = {'gloss': '', 'kind': 'none', 'reading': '', 'src': 'none'}
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

    # The word's own meaning, quoted from a text that actually renders it: Memar
    # Marqe's Hebrew translation, or the word-by-word glossary of the Torah targum.
    # Nothing here is derived. It is reported WHETHER OR NOT a root was found —
    # a rendering of this word is never discarded because the root happened to
    # resolve. תרח is "gate" 155 times in the piyyutim and Marqe says so, while
    # Tal's head-word תרח is only Terah the man; the reader needs both.
    if True:
        wn = _norm_fin(word)
        meaning = src = ''
        try:
            r = conn.execute(
                "SELECT memar_he, memar_conf FROM dict_infl WHERE form_norm=? "
                "AND TRIM(COALESCE(memar_he,''))<>'' ORDER BY rank LIMIT 1", (wn,)).fetchone()
            if r and r['memar_he'] not in _memar_overused():
                meaning, src = r['memar_he'], 'memar'
        except sqlite3.OperationalError:
            pass
        if not meaning:
            r = conn.execute("SELECT gloss FROM tal_word_gloss WHERE word=? "
                             "AND TRIM(COALESCE(gloss,''))<>'' LIMIT 1", (word,)).fetchone()
            if r:
                meaning, src = r['gloss'], 'torah'
        if not meaning:
            r = conn.execute("SELECT he FROM word_align WHERE ar=? "
                             "AND TRIM(COALESCE(he,''))<>'' LIMIT 1", (word,)).fetchone()
            if r:
                meaning, src = r['he'], 'torah'
        if not meaning:
            # The Torah targum's own word-by-word glossary — 14,544 Aramaic words
            # with a Hebrew rendering beside them. It is the most direct Aramaic→
            # Hebrew evidence the project owns and was never consulted here.
            r = conn.execute("SELECT hebrew FROM verse_dictionary WHERE aramaic=? "
                             "AND TRIM(COALESCE(hebrew,''))<>'' LIMIT 1", (word,)).fetchone()
            if not r:
                r = conn.execute(
                    "SELECT hebrew FROM verse_dictionary WHERE aramaic=? "
                    "AND TRIM(COALESCE(hebrew,''))<>'' LIMIT 1", (_tal_bare(word),)).fetchone()
            if r:
                meaning, src = r['hebrew'], 'targum'
        if meaning:
            out['meaning'] = {'gloss': meaning, 'source': src}
    # Does the quoted meaning disagree with every sense the root offers? Then the
    # entry is answering about the root while the text is answering about the word,
    # and the reader must be told which is which rather than shown only one.
    if out.get('meaning'):
        senses = ' '.join(sn['gloss'] for rt in out['roots'] for sn in rt['senses'])
        out['meaning']['disagrees'] = bool(out['roots']) and             not _gloss_matches_memar(senses, out['meaning']['gloss'])
    conn.close()
    out['phrases'] = dict_phrases_for(word)
    return out


# ── dictionary app: page-browse, index-browse, direct word search, form locations ──
@_without_lexicon({'page': 0, 'entries': [], 'prev': None, 'next': None})
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


@_without_lexicon({'start': 0, 'limit': 0, 'total': 0, 'items': []})
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


@_without_lexicon([])
def dict_word_search(word, limit=40):
    """Dictionary entries that contain the word DIRECTLY as a head-word, regardless
    of whether the word is itself a root (so a plain inflected form still hits, as
    long as it stands as a head-word in Tal). Complements the root resolution."""
    base = _tal_bare(word)
    if not base or len(base) < 2:
        return []
    bn = _norm_fin(base)
    conn = get_connection()
    try:
        rows = conn.execute("SELECT lemma, root, pos, gloss_he, printed FROM tal_auth_entries "
                            "WHERE lemma_norm=? OR nomark(lemma_norm)=? "
                            "ORDER BY pdf, ord LIMIT ?", (bn, bn, limit)).fetchall()
    except sqlite3.OperationalError:               # a connection without nomark()
        rows = conn.execute("SELECT lemma, root, pos, gloss_he, printed FROM tal_auth_entries "
                            "WHERE lemma_norm=? ORDER BY pdf, ord LIMIT ?", (bn, limit)).fetchall()
    # …and the head-words a reader cannot type letter for letter, because Tal
    # printed an optional letter in brackets: (א)רתחח is reached by רתחח and by
    # ארתחח, and neither of those is the string the entry is stored under.
    lemmas = (_alt_headwords(conn).get(bn) or {}).get('lemmas') or []
    if lemmas:
        q = ','.join('?' * len(lemmas))
        rows = list(rows) + list(conn.execute(
            "SELECT lemma, root, pos, gloss_he, printed FROM tal_auth_entries "
            "WHERE lemma IN (%s) ORDER BY pdf, ord LIMIT ?" % q, lemmas + [limit]))
    out, seen = [], set()
    for r in rows:
        k = (r['lemma'], r['printed'], (r['gloss_he'] or '')[:20])
        if k in seen:
            continue
        seen.add(k)
        out.append({'lemma': r['lemma'] or '', 'root': r['root'] or '', 'pos': r['pos'] or '',
                    'gloss': (r['gloss_he'] or '').strip(), 'page': r['printed']})

    # and what the app's own dictionary says about this form. Tal's pages are one
    # source among several, and a reader who types a word the app glosses must
    # not be told there is nothing — דנע stood in the index with its meaning in
    # full while this search came back empty.
    try:
        said = resolve_glosses(conn, [base, word.strip()])
        v = said.get(base) or said.get(word.strip()) or {}
        g = (v.get('g') or '').strip()
        if g and not any(g[:24] in (e['gloss'] or '') for e in out):
            kind, read = v.get('k') or 'gloss', (v.get('r') or '').strip()
            if kind == 'read' and read:
                g = '%s — הסריקה שיבשה; הקריאה: %s' % (g, read)
            elif kind == 'maybe' and read:
                g = '%s — אפשר שהסריקה שיבשה; הקריאה הקרובה: %s' % (g, read)
            elif kind == 'line' and read:
                g = '%s — מתוך תרגום השורה: %s' % (g, read)
            rt = conn.execute("SELECT root FROM dict_word_index WHERE word_norm=? "
                              "AND TRIM(COALESCE(root,''))<>'' LIMIT 1", (bn,)).fetchone()
            out.append({'lemma': base, 'root': (rt['root'] if rt else ''), 'pos': '',
                        'gloss': g, 'page': None, 'src': v.get('s') or ''})
    except Exception as exc:
        print('[dict-search] %s' % exc)
    conn.close()
    return out



def _cite_clean(q):
    """One example sentence, readable.

    The sentences were read off the page, and between the Hebrew the reading
    left behind fragments of Tal's English and of his reference numbers —
    "NYY", "824", "[TD". A Latin token is kept only when it reads as an English
    word (lower-case, or capitalised and long enough); everything else goes, and
    the Hebrew, which is what the reader came for, is never touched."""
    q = re.sub('[‎‏‪-‮]', '', q or '')
    out = []
    for t in q.split():
        if _CITE_HEB.search(t):
            out.append(t)
        elif re.fullmatch(r"[a-z][a-z\-']{1,}[.,;:]?", t) or                 re.fullmatch(r"[A-Z][a-z\-']{2,}[.,;:]?", t):
            out.append(t)
    return re.sub(r'\s+', ' ', ' '.join(out)).strip(' .,;:-()[]')


_CITE_BOOK = {'בר': 'בראשית', 'שמ': 'שמות', 'ויק': 'ויקרא', 'במ': 'במדבר', 'דב': 'דברים'}
_CITE_REF = re.compile('^(בר|שמ|ויק|במ|דב)' + r'\s+([א-ת״׳]{1,6})\s+(\d{1,3})')


def _cite_ref_he(ref):
    """The place a sentence is quoted from, spelled out — the dictionary prints
    it short (דב ח 19) and a reader should not have to decode it."""
    m = _CITE_REF.match(ref or '')
    if not m:
        return (ref or '').strip()
    return '%s %s %s' % (_CITE_BOOK[m.group(1)], m.group(2).strip('״׳'), m.group(3))


def _cite_vid(ref, vmap):
    """…and the verse it is, so the reader can step straight into it."""
    m = _CITE_REF.match(ref or '')
    if not m:
        return None
    book = {'בר': 1, 'שמ': 2, 'ויק': 3, 'במ': 4, 'דב': 5}[m.group(1)]
    return vmap.get((book, _ervah_gem(m.group(2)), int(m.group(3))))


# In Samaritan Aramaic the gutturals fell together and the sibilants with them,
# so the same word is printed under more than one spelling: Tal has חפס "חפר,
# נבר" on page 289 and עפס on 652, and a reader who types עפץ reaches neither.
# These are the classes, and nothing else is folded — a wider net turns the
# answer into a list.
_SAM_CLASS = str.maketrans({'א': 'א', 'ה': 'א', 'ח': 'א', 'ע': 'א',
                            'ז': 'ס', 'ס': 'ס', 'צ': 'ס',
                            'ט': 'ת', 'ת': 'ת'})


def _sam_skel(w):
    return re.sub('[^' + chr(0x5d0) + '-' + chr(0x5ea) + ']', '',
                  _norm_fin(_nomark(w or ''))).translate(_SAM_CLASS)


_SKEL_FAMILY = None


def _skel_family(conn):
    """{the interchange skeleton: the entries printed with it}. Read once."""
    global _SKEL_FAMILY
    if _SKEL_FAMILY is not None:
        return _SKEL_FAMILY
    out = {}
    try:
        rows = conn.execute(
            "SELECT lemma, lemma_norm, root, gloss_he, printed FROM tal_auth_entries "
            "WHERE TRIM(COALESCE(gloss_he,''))<>''").fetchall()
    except sqlite3.OperationalError:
        rows = []
    for r in rows:
        ln = r['lemma_norm'] or ''
        if ' ' in ln or not ln:
            continue
        out.setdefault(_sam_skel(ln), []).append(
            {'lemma': r['lemma'] or '', 'norm': _norm_fin(_nomark(ln)),
             'root': (r['root'] or '').strip(), 'gloss': (r['gloss_he'] or '').strip(),
             'page': r['printed']})
    _SKEL_FAMILY = out
    return out


def near_spellings(word, skip_roots=(), limit=8):
    """The dictionary's entries for the same word spelled another way.

    An offer, not a claim: the entry is shown as it is printed, with its page,
    and the reader judges whether it is the same word. Entries the search has
    already answered with are left out."""
    bn = _norm_fin(_tal_bare(word))
    if not bn or len(bn) < 2:
        return []
    conn = get_connection()
    fam = _skel_family(conn).get(_sam_skel(bn), [])
    conn.close()
    skip = {(_norm_fin(r) or '') for r in skip_roots}
    out = []
    for e in fam:
        if e['norm'] == bn or _norm_fin(e['root']) in skip:
            continue
        # closest spelling first: how many letters actually differ
        d = sum(1 for a, b in zip(e['norm'], bn) if a != b) + abs(len(e['norm']) - len(bn))
        out.append((d, e))
    out.sort(key=lambda x: (x[0], str(x[1]['page'])))
    seen, res = set(), []
    for _, e in out:
        k = (e['lemma'], e['gloss'][:20])
        if k in seen:
            continue
        seen.add(k)
        res.append(e)
        if len(res) >= limit:
            break
    return res


def dict_read_as(word, limit=8):
    """The last thing the dictionary can say: where this exact string was read.

    Some strings the dictionary holds are not words — the optical reading of a
    page glues two together, or breaks one apart. Saying "not found" about a
    string that is plainly on the page is wrong; saying where it was read, and
    letting the reader see the whole of what it was read from, is right. Only
    called when nothing else answered, so it may look the slow way."""
    base = _tal_bare(word)
    if not base or len(base) < 2:
        return []
    bn = _norm_fin(base)
    # the stored string keeps its final letter; the reader's typing was folded,
    # so look for both spellings
    tail = {'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ'}.get(base[-1])
    likes = ['%' + base + '%']
    if tail:
        likes.append('%' + base[:-1] + tail + '%')
    conn = get_connection()
    vmap = _tm_vmap(conn)
    vhe = _verse_hebrew(conn)
    out = []

    def add(kind, text, extra=None):
        if len(out) < limit and text:
            row = {'kind': kind, 'text': text.strip()}
            row.update(extra or {})
            out.append(row)

    try:
        for r in conn.execute("SELECT form, root FROM tal_forms WHERE form=? OR form_norm=? "
                              "LIMIT 3", (base, bn)):
            add('form', r['form'], {'root': r['root'] or ''})
        for like in likes:
            for r in conn.execute("SELECT lemma, root, gloss_he, printed FROM tal_auth_entries "
                                  "WHERE lemma LIKE ? LIMIT 3", (like,)):
                add('headword', r['lemma'], {'root': r['root'] or '',
                                             'gloss': (r['gloss_he'] or '').strip(),
                                             'page': r['printed']})
            for r in conn.execute("SELECT form, root FROM tal_forms WHERE form LIKE ? LIMIT 3",
                                  (like,)):
                add('form', r['form'], {'root': r['root'] or ''})
            # the earlier reading of the pages kept head-words of its own, and
            # the sentences printed under them — which carry the Hebrew the word
            # is read against
            for r in conn.execute(
                    """SELECT e.lemma, c.quote, c.source_ref
                       FROM dict_entries e
                       LEFT JOIN dict_forms f ON f.entry_id = e.id
                       LEFT JOIN dict_citations c ON c.form_id = f.id
                       WHERE e.lemma LIKE ? LIMIT 3""", (like,)):
                extra = {}
                if r['source_ref']:
                    extra['ref'] = _cite_ref_he(r['source_ref'])
                    vid = _cite_vid(r['source_ref'], vmap)
                    if vid:
                        extra['verse_id'] = vid
                        extra['heb'] = vhe.get(vid, '')
                if r['quote']:
                    extra['quote'] = _cite_clean(r['quote'])
                add('early', r['lemma'], extra)
            # the text index keeps the vowels inside the word, so the search has
            # to run on its bare form rather than on what is printed
            for r in conn.execute("SELECT DISTINCT form, book, chapter, verse, verse_id "
                                  "FROM root_index WHERE form_norm LIKE ? LIMIT 3",
                                  ('%' + bn + '%',)):
                add('text', r['form'], {'book': r['book'] or '', 'ch': r['chapter'],
                                        'vn': r['verse'], 'verse_id': r['verse_id']})
            if len(out) < limit:
                for r in conn.execute("SELECT quote, source_ref FROM dict_citations "
                                      "WHERE quote LIKE ? LIMIT 3", (like,)):
                    add('sentence', _cite_clean(r['quote']),
                        {'ref': _cite_ref_he(r['source_ref'] or '')})
    except sqlite3.OperationalError:
        pass
    conn.close()
    return out


def targum_occurrences(word, limit=12):
    """The places the word itself stands in the Torah's Aramaic Targum.

    The root recorded beside a form in that index is not always sound, so only
    the places are reported — those are read straight off the text and cannot be
    wrong. For a word Tal never gave an entry, seeing it in its own verse, with
    the verse beside it, is the meaning."""
    bn = _norm_fin(_tal_bare(word))
    if not bn or len(bn) < 2:
        return []
    conn = get_connection()
    try:
        # First the text itself: a word that simply stands in a verse is answered
        # by that verse, whether or not any index ever happened to carry it.
        # the verse comes with it, in both languages: for a word no source
        # glosses, seeing it in its own verse beside the Hebrew is the meaning
        rows = conn.execute(
            """SELECT '' AS form, '' AS pron, bk.name AS book, ch.number AS chapter,
                      v.number AS verse, v.id AS verse_id, x.kind,
                      v.text AS heb, v.sam_aramaic AS aram
               FROM text_word_ix x
               JOIN verses v    ON v.id = x.verse_id
               JOIN chapters ch ON ch.id = v.chapter_id
               JOIN books bk    ON bk.id = ch.book_id
               WHERE x.word_norm = ? ORDER BY v.id LIMIT ?""", (bn, limit)).fetchall()
        if not rows:
            # and a place name is indexed whole — "אברמונ פרצ" — so a reader
            # typing one of its words is looking for exactly that entry
            rows = conn.execute(
                "SELECT r.form, r.pron, r.book, r.chapter, r.verse, r.verse_id, 'a' AS kind, "
                "       v.text AS heb, v.sam_aramaic AS aram "
                "FROM root_index r LEFT JOIN verses v ON v.id = r.verse_id "
                "WHERE r.form_norm = ? OR r.form_norm LIKE ? "
                "   OR r.form_norm LIKE ? OR r.form_norm LIKE ? "
                "GROUP BY r.verse_id ORDER BY r.verse_id LIMIT ?",
                (bn, bn + ' %', '% ' + bn, '% ' + bn + ' %', limit)).fetchall()
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    return [{'form': r['form'] or '', 'pron': r['pron'] or '', 'book': r['book'] or '',
             'ch': r['chapter'], 'vn': r['verse'], 'verse_id': r['verse_id'],
             'kind': r['kind'], 'heb': (r['heb'] or '').strip(),
             'aram': (r['aram'] or '').strip()} for r in rows]


def piyut_occurrences(word, limit=8):
    """The lines of the Samaritan liturgy — Z. Ben-Ḥayyim's volume — that the word
    stands in, with his own reading of the line and, where he gives one, his
    Hebrew. A word of the piyyutim that no dictionary entry covers is still a word
    somebody sang, and this is where."""
    bn = _norm_fin(_tal_bare(word))
    if not bn or len(bn) < 2:
        return []
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT p.title, p.author, l.aram, l.heb, l.translit
               FROM dara_word_refs w
               JOIN dara_piyutim p ON p.id = w.piyut_id
               JOIN dara_lines l   ON l.piyut_id = w.piyut_id AND l.ord = w.line_ord
               WHERE w.word = ? OR w.word = ?
               ORDER BY p.ord, l.ord LIMIT ?""", (word, bn, limit)).fetchall()
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    out, seen = [], set()
    for r in rows:
        a = (r['aram'] or '').strip()
        if not a or a in seen:
            continue
        seen.add(a)
        out.append({'title': (r['title'] or '').strip(), 'author': (r['author'] or '').strip(),
                    'aram': a, 'heb': (r['heb'] or '').strip(),
                    'translit': (r['translit'] or '').strip()})
    return out


def piyut_corpus_occurrences(word, limit=6):
    """The poems of the Samaritan piyyut collection the word is sung in. A second
    corpus beside Ben-Ḥayyim's volume, with an index of its own."""
    bn = _norm_fin(_tal_bare(word))
    if not bn or len(bn) < 2:
        return []
    conn = get_connection()
    ids = []
    try:                       # the poems themselves, indexed word by word
        ids = [r['piyut_id'] for r in conn.execute(
            "SELECT piyut_id FROM piyut_word_ix WHERE word_norm = ? LIMIT ?",
            (bn, limit))]
    except sqlite3.OperationalError:
        ids = []
    if not ids:                # the collection's older index, where it has more
        try:
            row = conn.execute(
                "SELECT occurrences FROM piyutim_words WHERE word = ? OR word = ? LIMIT 1",
                (word, bn)).fetchone()
            ids = [int(x) for x in json.loads((row and row['occurrences']) or '[]')][:limit]
        except Exception:
            ids = []
    out = []
    if ids:
        q = ','.join('?' * len(ids))
        for r in conn.execute("SELECT id, title, incipit3, author, festival "
                              "FROM piyutim WHERE id IN (%s)" % q, ids):
            out.append({'id': r['id'], 'title': (r['title'] or r['incipit3'] or '').strip(),
                        'author': (r['author'] or '').strip(),
                        'festival': (r['festival'] or '').strip()})
    conn.close()
    return out


def torah_word_gloss(word, limit=3):
    """What this app's own word apparatus says the word means in the Torah.

    Every word of the text already carries a Hebrew reading in the per-verse word
    table a reader sees under the verse ("מילון מילים"). The dictionary never read
    it, and so said nothing about אבתיכם, אדניהם or אחזיק — words nobody would
    call rare. The reading is quoted as it stands, with the verse it was given in."""
    base = _tal_bare(word)
    bn = _norm_fin(base)
    if not bn or len(bn) < 2:
        return {}
    conn = get_connection()
    rows = []
    try:
        rows = conn.execute(
            """SELECT g.he, g.word, bk.name AS book, ch.number AS ch, v.number AS vn,
                      v.id AS verse_id
               FROM word_gloss g
               JOIN verses v    ON v.id = g.verse_id
               JOIN chapters ch ON ch.id = v.chapter_id
               JOIN books bk    ON bk.id = ch.book_id
               WHERE g.word = ? AND TRIM(COALESCE(g.he,'')) <> ''
               ORDER BY v.id LIMIT ?""", (base, limit)).fetchall()
        if not rows:                 # the Aramaic side, where the two were aligned
            rows = conn.execute(
                """SELECT a.he, a.ar AS word, bk.name AS book, ch.number AS ch,
                          v.number AS vn, v.id AS verse_id
                   FROM word_align a
                   JOIN verses v    ON v.id = a.verse_id
                   JOIN chapters ch ON ch.id = v.chapter_id
                   JOIN books bk    ON bk.id = ch.book_id
                   WHERE a.ar = ? AND TRIM(COALESCE(a.he,'')) <> ''
                   ORDER BY v.id LIMIT ?""", (base, limit)).fetchall()
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    if not rows:
        return {}
    he = (rows[0]['he'] or '').strip()
    if not he or _norm_fin(he) == bn:         # a word glossed by itself says nothing
        for r in rows[1:]:
            alt = (r['he'] or '').strip()
            if alt and _norm_fin(alt) != bn:
                he = alt
                break
        else:
            return {}
    return {'word': rows[0]['word'] or base, 'he': he,
            'places': [{'book': r['book'], 'ch': r['ch'], 'vn': r['vn'],
                        'verse_id': r['verse_id']} for r in rows]}


def hebrew_side(word, limit=4):
    """For a Hebrew word: the Aramaic the Targum puts opposite it, and where.

    This is the Hebrew→Aramaic half of the unit, read off the Targum's own word
    dictionary rather than asserted. Empty for a word the Targum never renders."""
    bn = _norm_fin(_tal_bare(word))
    if not bn or len(bn) < 2:
        return []
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT x.aramaic, bk.name AS book, ch.number AS ch, v.number AS vn, v.id AS vid
               FROM he_aram_ix x
               JOIN verses v    ON v.id = x.verse_id
               JOIN chapters ch ON ch.id = v.chapter_id
               JOIN books bk    ON bk.id = ch.book_id
               WHERE x.he_norm = ? ORDER BY v.id LIMIT ?""", (bn, limit * 3)).fetchall()
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    out, seen = [], set()
    for r in rows:
        a = (r['aramaic'] or '').strip()
        if not a or a in seen:
            continue
        seen.add(a)
        out.append({'aramaic': a, 'book': r['book'], 'ch': r['ch'], 'vn': r['vn'],
                    'verse_id': r['vid'], 'of': ''})
        if len(out) >= limit:
            break
    # Nothing under the word as written? One proclitic is lifted and it is asked
    # again — the same single step the root resolution takes, and no further:
    # באהליהם is not in the table, אהליהם is, and the answer is marked as being
    # for that form rather than for what was typed.
    if not out and len(bn) >= 4 and bn[0] in 'ובלכמדהש':
        for x in hebrew_side(bn[1:], limit):
            x['of'] = bn[1:]
            out.append(x)
    return out


def dara_gloss_for(word):
    """What the liturgy volume's own word list says the word means — read there,
    not inferred here. Returns {} when it says nothing."""
    bn = _norm_fin(_tal_bare(word))
    if not bn:
        return {}
    conn = get_connection()
    try:
        r = conn.execute(
            "SELECT word, root, gloss, translit FROM dara_words "
            "WHERE (word = ? OR word_norm = ?) AND TRIM(COALESCE(gloss,'')) <> '' LIMIT 1",
            (word, bn)).fetchone()
    except sqlite3.OperationalError:
        r = None
    conn.close()
    if not r:
        return {}
    return {'word': r['word'] or word, 'root': (r['root'] or '').strip(),
            'gloss': (r['gloss'] or '').strip(), 'translit': (r['translit'] or '').strip()}


def tal_citations_for(word, limit=14):
    """Where the word stands inside Tal's dictionary: the example sentence it is
    part of, the place that sentence cites, and the entry it was printed under.

    This is an attestation, not a gloss — it says "the dictionary shows this word
    here", which for a word Tal never gave an entry of its own is the whole of
    what can honestly be said about it."""
    base = _tal_bare(word)
    if not base or len(base) < 2:
        return []
    bn = _norm_fin(base)
    conn = get_connection()
    try:
        # The entry name the older reading attached to a sentence is wrong almost
        # every time (it disagrees with the authoritative reading in 1,414 of
        # 1,415 cases), so it is not shown. The page number is sound, and
        # tal_pages turns it into the page as the book itself numbers it,
        # together with the head-words that page runs between — which is a place
        # a reader can actually turn to.
        rows = conn.execute(
            """SELECT c.quote, c.source_ref FROM tal_cite_word t
               JOIN dict_citations c ON c.id = t.cite_id
               WHERE t.word_norm = ? ORDER BY c.id LIMIT ?""",
            (bn, limit * 3)).fetchall()
    except sqlite3.OperationalError:          # the index has not been built here
        rows = []
    vmap = _tm_vmap(conn)
    # the verse each sentence quotes, in Hebrew: Tal prints his examples with
    # their Hebrew beside them, and that Hebrew is what the word is read by
    vhe = _verse_hebrew(conn)
    conn.close()
    out, seen = [], set()
    for r in rows:
        q = _cite_clean(r['quote'])
        if not q or q in seen:
            continue
        seen.add(q)
        ref = (r['source_ref'] or '').strip()
        vid = _cite_vid(ref, vmap)
        out.append({'quote': q, 'ref': _cite_ref_he(ref), 'verse_id': vid,
                    'heb': vhe.get(vid, '')})
        if len(out) >= limit:
            break
    return out


@_without_lexicon({'form': '', 'count': 0, 'locations': []})
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
@_without_lexicon({'start': 0, 'limit': 0, 'total': 0, 'items': []})
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
    try:
        rows = conn.execute(
            "SELECT MIN(word) AS word, MAX(in_torah) AS it, MAX(in_memar) AS im, "
            "COUNT(*) AS nm, MIN(NULLIF(TRIM(COALESCE(gloss,'')),'')) AS gl, "
            "MIN(NULLIF(TRIM(COALESCE(arabic,'')),'')) AS ar "
            "FROM dict_word_index GROUP BY word_norm "
            "ORDER BY word_norm LIMIT ? OFFSET ?", (limit, start)).fetchall()
    except sqlite3.OperationalError:
        # a database from before the Arabic column was added
        rows = conn.execute(
            "SELECT MIN(word) AS word, MAX(in_torah) AS it, MAX(in_memar) AS im, "
            "COUNT(*) AS nm, MIN(NULLIF(TRIM(COALESCE(gloss,'')),'')) AS gl, "
            "NULL AS ar FROM dict_word_index GROUP BY word_norm "
            "ORDER BY word_norm LIMIT ? OFFSET ?", (limit, start)).fetchall()
    conn.close()
    return {'start': start, 'limit': limit, 'total': total,
            'items': [{'word': r['word'] or '', 'meanings': r['nm'],
                       'gloss': r['gl'] or '', 'arabic': r['ar'] or '',
                       'in_torah': bool(r['it']), 'in_memar': bool(r['im'])} for r in rows]}


# ── Hebrew → Aramaic side: a Hebrew index that leads to the Aramaic entry, and a
#    Hebrew search that finds words IN THE RESULTS (not by jumping in the index) ──
@_without_lexicon({'start': 0, 'limit': 0, 'total': 0, 'items': []})
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


@_without_lexicon({'word': '', 'results': []})
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



# ── where a word stands in the Targum, read from the alignment ───────────────
# The dictionary panel lists a word's Torah occurrences through the root index,
# and a word with no root recorded therefore showed none — fourteen per cent of
# the words that do occur in the Torah. The Targum lies beside the Hebrew verse,
# so the alignment already knows both the verse and the Hebrew word being
# rendered; that index is built once from it and shipped as data.
#
# Loaded lazily: almost two megabytes of JSON does not belong on the boot path,
# and most page views never open the dictionary.
_WORD_LOC_PATH = os.path.join(os.path.dirname(__file__), '..', '..',
                              'data', 'word_locations.json')
_WORD_LOC = None


def _word_locations():
    global _WORD_LOC
    if _WORD_LOC is None:
        try:
            with open(_WORD_LOC_PATH, encoding='utf-8') as fh:
                _WORD_LOC = json.load(fh)
        except Exception:
            _WORD_LOC = {}
    return _WORD_LOC


def _targum_occurrences(conn, word_norm, limit=40):
    """[{book, chapter, verse, verse_id, hebrew}] for a word, from the alignment."""
    rec = _word_locations().get(word_norm)
    if not rec:
        return [], 0
    pairs = rec.get('v') or []
    ids = [p[0] for p in pairs][:limit]
    if not ids:
        return [], 0
    heb_of = {p[0]: p[1] for p in pairs}
    rows = conn.execute(
        'SELECT v.id, v.number AS verse, v.text AS text, ch.number AS chapter, '
        'b.name AS book FROM verses v JOIN chapters ch ON ch.id = v.chapter_id '
        'JOIN books b ON b.id = ch.book_id WHERE v.id IN (%s)'
        % ','.join('?' * len(ids)), ids).fetchall()
    by_id = {r['id']: r for r in rows}
    out = []
    for vid in ids:
        r = by_id.get(vid)
        if not r:
            continue
        he = heb_of.get(vid, '')
        out.append({'book': r['book'], 'ch': r['chapter'], 'vn': r['verse'],
                    'verse_id': vid, 'text': r['text'] or '',
                    'hi': _hl_root(r['text'] or '', he) if he else '',
                    'hebrew': he, 'from_targum': True})
    return out, rec.get('n') or len(out)

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

    # A set phrase is an entry in its own right: its meaning belongs to the phrase,
    # not to any one root, so the root-driven path below has nothing to say about it.
    if ' ' in wn.strip():
        try:
            rows = conn.execute(
                "SELECT phrase, hebrew, parts_gloss, cls, count, corpus, ref, support, status "
                "FROM dict_phrase WHERE phrase_norm=? ORDER BY count DESC", (wn,)).fetchall()
        except sqlite3.OperationalError:
            rows = []
        if rows:
            words = [w for w in re.findall(r'[א-ת]{2,}', rows[0]['phrase'])]
            out = {'word': word, 'is_phrase': True, 'words': words, 'meanings': [],
                   'senses': [{'phrase': r['phrase'], 'hebrew': r['hebrew'] or '',
                               'parts': r['parts_gloss'] or '', 'cls': r['cls'],
                               'count': r['count'], 'corpus': r['corpus'],
                               'ref': r['ref'], 'support': r['support'],
                               'status': r['status']} for r in rows]}
            conn.close()
            return out

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

        # ── a word with no entry still has a meaning, and must show it ───────
        # Tal's printed dictionary is keyed by root, and some roots have no entry
        # in it at all: דנע is one — "זרח", whose derived מדנע ("east", the place
        # of the sun's rising) stands in thirty verses of the Targum. The panel
        # opened on such a word with a root at the top and nothing under it, which
        # reads as "the dictionary does not know this word" when the dictionary
        # does know it. So where the printed entry is silent the index's own
        # meaning is shown, marked for what it is, together with the Arabic where
        # one of the sources has it.
        if not senses:
            fb = None
            for where, arg in (('word_norm=?', wn), ('root_norm=? AND root_norm<>''', rn)):
                try:
                    fb = conn.execute(
                        "SELECT MIN(NULLIF(TRIM(COALESCE(gloss,'')),'')) AS g, "
                        "MIN(NULLIF(TRIM(COALESCE(arabic,'')),'')) AS a, "
                        "MIN(NULLIF(TRIM(COALESCE(gloss_src,'')),'')) AS s "
                        "FROM dict_word_index WHERE " + where, (arg,)).fetchone()
                except sqlite3.OperationalError:
                    fb = None
                    break
                if fb and fb['g']:
                    break
            if fb and fb['g']:
                senses.append({'lemma': rt, 'pos': '', 'gloss': fb['g'],
                               'arabic': fb['a'] or '', 'page': None,
                               'from_index': True, 'src': fb['s'] or ''})

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
    # a meaning with no occurrence to show gets the Targum's own
    for m in meanings:
        if not (m.get('torah') or []):
            occ, n = _targum_occurrences(conn, wn)
            if occ:
                m['torah'] = occ
                m['torah_count'] = n
                m['torah_from_targum'] = True
            break

    if not any((m.get('senses') or []) for m in meanings):
        try:
            fb = conn.execute(
                "SELECT MIN(word) AS w, MIN(root) AS r, "
                "MIN(NULLIF(TRIM(COALESCE(gloss,'')),'')) AS g, "
                "MIN(NULLIF(TRIM(COALESCE(arabic,'')),'')) AS a, "
                "MIN(NULLIF(TRIM(COALESCE(gloss_src,'')),'')) AS s "
                "FROM dict_word_index WHERE word_norm=?", (wn,)).fetchone()
        except sqlite3.OperationalError:
            fb = None
        if fb and fb['g']:
            sense = {'lemma': fb['w'] or word, 'pos': '', 'gloss': fb['g'],
                     'arabic': fb['a'] or '', 'page': None,
                     'from_index': True, 'src': fb['s'] or ''}
            if meanings:
                meanings[0]['senses'] = [sense]
            else:
                meanings.append({'root': fb['r'] or (fb['w'] or word), 'senses': [sense],
                                 'forms': [], 'torah': [], 'torah_count': 0,
                                 'memar': [], 'memar_count': 0})
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


# ── private compositions: admin-only AI-assisted piyyut drafts, saved per-line so
# the existing verse-pencil edit endpoint can edit them line by line ────────────
_PRIVATE_TABLES_READY = False


def _ensure_private_tables(conn):
    global _PRIVATE_TABLES_READY
    if _PRIVATE_TABLES_READY:
        return
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS private_compositions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            title      TEXT NOT NULL,
            prompt     TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS private_composition_lines (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            composition_id INTEGER NOT NULL REFERENCES private_compositions(id),
            line_no        INTEGER NOT NULL,
            text           TEXT NOT NULL
        );
    """)
    conn.commit()
    _PRIVATE_TABLES_READY = True


def list_private_compositions():
    conn = get_connection()
    try:
        _ensure_private_tables(conn)
        rows = conn.execute(
            'SELECT id, title, created_at FROM private_compositions ORDER BY created_at DESC').fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_private_composition(cid):
    conn = get_connection()
    try:
        _ensure_private_tables(conn)
        comp = conn.execute(
            'SELECT id, title, prompt, created_at FROM private_compositions WHERE id=?', (cid,)).fetchone()
        if not comp:
            return None
        lines = conn.execute(
            'SELECT id, line_no, text FROM private_composition_lines WHERE composition_id=? ORDER BY line_no',
            (cid,)).fetchall()
        d = dict(comp)
        d['lines'] = [dict(l) for l in lines]
        return d
    finally:
        conn.close()


def create_private_composition(title, prompt, lines):
    conn = get_connection()
    try:
        _ensure_private_tables(conn)
        cur = conn.execute('INSERT INTO private_compositions (title, prompt) VALUES (?, ?)', (title, prompt))
        cid = cur.lastrowid
        for i, ln in enumerate(lines):
            conn.execute(
                'INSERT INTO private_composition_lines (composition_id, line_no, text) VALUES (?, ?, ?)',
                (cid, i, ln))
        conn.commit()
        return cid
    finally:
        conn.close()


def delete_private_composition(cid):
    conn = get_connection()
    try:
        _ensure_private_tables(conn)
        conn.execute('DELETE FROM private_composition_lines WHERE composition_id=?', (cid,))
        conn.execute('DELETE FROM private_compositions WHERE id=?', (cid,))
        conn.commit()
    finally:
        conn.close()


def duplicate_private_composition(cid):
    conn = get_connection()
    try:
        _ensure_private_tables(conn)
        comp = conn.execute('SELECT title, prompt FROM private_compositions WHERE id=?', (cid,)).fetchone()
        if not comp:
            return None
        lines = conn.execute(
            'SELECT line_no, text FROM private_composition_lines WHERE composition_id=? ORDER BY line_no',
            (cid,)).fetchall()
        cur = conn.execute(
            'INSERT INTO private_compositions (title, prompt) VALUES (?, ?)',
            (comp['title'] + ' (עותק)', comp['prompt']))
        new_id = cur.lastrowid
        for l in lines:
            conn.execute(
                'INSERT INTO private_composition_lines (composition_id, line_no, text) VALUES (?, ?, ?)',
                (new_id, l['line_no'], l['text']))
        conn.commit()
        return new_id
    finally:
        conn.close()


def _dara_occurrences(conn, word_fins, limit=25):
    """The lines of Ben-Hayyim's liturgy volume in which these forms are sung —
    the third body of occurrences the dictionary shows, beside the Torah and
    Tibat Marqe. Each line carries the Aramaic as printed, his Hebrew rendering
    and his phonetic transcription, which is where the dictionary's own
    pronunciations come from."""
    fins = [f for f in set(word_fins or []) if f]
    if not fins:
        return [], 0
    qs = ','.join('?' * len(fins))
    try:
        rows = conn.execute(
            "SELECT DISTINCT p.id AS piyut_id, p.title, p.ord AS pord, l.ord, l.n, "
            "       l.aram, l.heb, l.translit, w.word "
            "FROM dara_words w "
            "JOIN dara_word_refs r ON r.word = w.word "
            "JOIN dara_lines l ON l.piyut_id = r.piyut_id AND l.ord = r.line_ord "
            "JOIN dara_piyutim p ON p.id = r.piyut_id "
            "WHERE w.word_fin IN (%s) ORDER BY p.ord, l.ord" % qs, tuple(fins)).fetchall()
    except sqlite3.OperationalError:
        return [], 0
    out = []
    for o in rows[:limit]:
        out.append({'piyut_id': o['piyut_id'], 'title': o['title'] or '',
                    'n': o['n'] or '', 'aram': o['aram'] or '', 'heb': o['heb'] or '',
                    'translit': o['translit'] or '', 'hi': [o['word']]})
    return out, len(rows)


# ── תעתיק בן-חיים: ספר הפיוטים ("פיוטי השומרונים בתעתיק הגייה") ────────────────
# A library unit built from the scanned volume of Z. Ben-Hayyim's liturgy (the
# CamScanner PDF the user supplied): every piyyut appears line by line in three
# columns — the Samaritan Aramaic, Ben-Hayyim's Hebrew rendering, and his
# phonetic transcription — with the apparatus and the "when is it said" note.
# The word list built from those lines (dara_words) is what joins this book to
# the Aramaic-Hebrew dictionary: it carries a pronunciation for nearly every
# word, which the dictionary itself never had.
def get_dara_toc():
    """Every piyyut in the volume, grouped client-side by author."""
    conn = get_connection()
    # the opening words come too: a piyyut is known by them, not by its number
    rows = conn.execute("""SELECT p.id, p.author, p.sec, p.title, p.sources, p.usage,
               p.pages, p.n_lines,
               (SELECT l.aram FROM dara_lines l WHERE l.piyut_id = p.id
                 ORDER BY l.ord LIMIT 1) AS opening
        FROM dara_piyutim p ORDER BY p.ord""").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_dara_piyut(pid):
    """One piyyut in full: its lines, its apparatus, and a word→(pronunciation,
    meaning) map for the words that actually occur in it."""
    try:
        pid = int(pid)
    except (TypeError, ValueError):
        return None
    conn = get_connection()
    head = conn.execute("""SELECT id, author, sec, title, sources, usage, pages, n_lines
        FROM dara_piyutim WHERE id=?""", (pid,)).fetchone()
    if not head:
        conn.close()
        return None
    lines = [dict(r) for r in conn.execute(
        "SELECT ord, n, aram, heb, translit, page FROM dara_lines WHERE piyut_id=? ORDER BY ord",
        (pid,))]
    variants = [dict(r) for r in conn.execute(
        "SELECT n, text FROM dara_vars WHERE piyut_id=?", (pid,))]
    words = sorted({w for l in lines for w in re.findall(r'[א-ת]+', l['aram'] or '')})
    gloss = {}
    if words:
        qs = ','.join('?' * len(words))
        for r in conn.execute(
                'SELECT word, translit, gloss, root FROM dara_words WHERE word IN (%s)' % qs,
                tuple(words)):
            gloss[r['word']] = {'t': r['translit'] or '', 'g': r['gloss'] or '', 'r': r['root'] or ''}
    conn.close()
    out = dict(head)
    out['lines'] = lines
    out['variants'] = variants
    out['dict'] = gloss
    return out


def search_dara(q, limit=200):
    """Search the volume by Aramaic, by the Hebrew rendering or by transcription."""
    q = (q or '').strip()
    if not q:
        return []
    conn = get_connection()
    like = '%' + q + '%'
    rows = conn.execute("""SELECT l.piyut_id, p.title, l.ord, l.n, l.aram, l.heb, l.translit, l.page
        FROM dara_lines l JOIN dara_piyutim p ON p.id = l.piyut_id
        WHERE l.aram LIKE ? OR l.heb LIKE ? OR l.translit LIKE ?
        ORDER BY p.ord, l.ord LIMIT ?""", (like, like, like, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_dara_word(word):
    """Everything the app holds about one word of the liturgy.

    It used to answer from the volume's own word list alone and return nothing at
    all when that list was silent — so a reader tapping a word was told there was
    no entry while the dictionary held the word, the Torah held it, and the
    Arabic lexicon glossed it. Now the volume's list is one source among several:
    its pronunciation and its lines, Tal's dictionary with its senses and the
    Torah verses it cites, the Arabic gloss, and the word's own places in the
    Torah text. A word that genuinely appears nowhere returns an empty record
    rather than nothing, so the reader is told that, and not told it wrongly."""
    word = (word or '').strip()
    if not word:
        return None
    conn = get_connection()
    w = conn.execute(
        "SELECT word, freq, translit, root, gloss FROM dara_words WHERE word=? OR word_norm=?",
        (word, word)).fetchone()
    out = dict(w) if w else {'word': word, 'freq': 0, 'translit': '',
                             'root': '', 'gloss': ''}

    # where it is sung
    try:
        out['refs'] = [dict(r) for r in conn.execute("""SELECT r.piyut_id, p.title, l.ord, l.n,
                l.aram, l.heb, l.translit
            FROM dara_word_refs r
            JOIN dara_lines l ON l.piyut_id = r.piyut_id AND l.ord = r.line_ord
            JOIN dara_piyutim p ON p.id = r.piyut_id
            WHERE r.word=? ORDER BY p.ord, l.ord LIMIT 60""", (word,))]
    except Exception:
        out['refs'] = []

    # the Arabic gloss, where HaMeliṣ has one for this word
    try:
        row = conn.execute(
            "SELECT hebrew, arabic FROM meliz_gloss WHERE lemma=? LIMIT 1", (word,)).fetchone()
        if row:
            out['meliz'] = {'he': row['hebrew'] or '', 'ar': row['arabic'] or ''}
    except Exception:
        pass
    conn.close()

    # the dictionary: its senses, and the Torah verses it cites for them
    try:
        out['tal'] = tal_full_lookup(word)
    except Exception:
        out['tal'] = None
    # and a short meaning, when the volume's list had none of its own
    if not (out.get('gloss') or '').strip():
        try:
            c = tal_concise(word)
            # the word said back to itself is no meaning: leave it out, and the
            # sources below get their turn to say something that is
            if c and c.get('gloss') and c['gloss'].strip() != word:
                out['gloss'] = c['gloss']
                out['gloss_from'] = 'tal'
        except Exception:
            pass
    # and where the dictionary is silent too, the same sources every other word
    # unit asks — including the words read one by one
    if not (out.get('gloss') or '').strip():
        try:
            conn2 = get_connection()
            v = resolve_glosses(conn2, [word]).get(word)
            conn2.close()
            if v:
                out['gloss'] = v.get('g') or ''
                out['gloss_from'] = v.get('s') or 'resolved'
                out['gloss_kind'] = v.get('k') or 'gloss'
                if v.get('r'):
                    out['gloss_read'] = v['r']
        except Exception:
            pass
    return out


def dara_pronounce(words):
    """Pronunciations for a list of Aramaic words (used by the dictionary app)."""
    words = [w for w in (words or []) if w]
    if not words:
        return {}
    conn = get_connection()
    qs = ','.join('?' * len(words))
    rows = conn.execute(
        'SELECT word, translit, gloss FROM dara_words WHERE word IN (%s)' % qs, tuple(words)).fetchall()
    conn.close()
    return {r['word']: {'t': r['translit'] or '', 'g': r['gloss'] or ''} for r in rows}
