# -*- coding: utf-8 -*-
"""
Web edition of the Samaritan Torah app — a Flask backend that REUSES the existing
query layer (app/services/database.py) and serves a single-page browser UI with
full feature parity. It is fully isolated: it never writes to the database (only
SELECTs run), and it touches nothing under app/, main.py or buildozer.spec. The
original Kivy app keeps working unchanged.

Run:  py -3 web/server.py     →  http://127.0.0.1:5000
"""
import os
import sys
import re
import difflib

# make the project root importable so we reuse the app's own service layer
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from flask import Flask, jsonify, request, render_template, send_from_directory

from app.services import database as db
from app.services.interpreter import get_chapter_interpretations

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Running behind nginx (reverse proxy) in production: honour the X-Forwarded-*
# headers so the app sees the real client IP, host and https scheme.
try:
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
except Exception:
    pass

APP_VERSION = '1.0'
_VER_UPDATES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'VER_UPDATES.txt')


# ── admin text editing (LOCAL only; secured entirely server-side) ─────────────
# Secrets come from a gitignored .env that exists only on the maintainer's
# machine; the public deployment has no .env, so ADMIN_PASSWORD is empty and
# admin login / editing is disabled there. The password is NEVER sent to the
# client. Edits are restricted to a whitelist of (table, column) pairs and
# require a valid session token, so nothing else can be written.
def _load_dotenv():
    p = os.path.join(_ROOT, '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"\''))


_load_dotenv()
import secrets, hmac
ADMIN_USER = os.environ.get('ADMIN_USER', 'oshersa')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
_ADMIN_TOKENS = set()
_EDITABLE = {'verses': {'text', 'masoretic_text', 'interpretation', 'sam_aramaic',
                        'sam_hebrew', 'simple_hebrew', 'english', 'arabic_trans'}}


@app.route('/api/admin/status')
def admin_status():
    return jsonify({'enabled': bool(ADMIN_PASSWORD)})


@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    if not ADMIN_PASSWORD:
        return jsonify({'ok': False, 'disabled': True})
    d = request.get_json(silent=True) or {}
    u, p = str(d.get('user', '')), str(d.get('password', ''))
    if hmac.compare_digest(u, ADMIN_USER) and hmac.compare_digest(p, ADMIN_PASSWORD):
        tok = secrets.token_urlsafe(24)
        _ADMIN_TOKENS.add(tok)
        return jsonify({'ok': True, 'token': tok})
    return jsonify({'ok': False})


@app.route('/api/admin/edit', methods=['POST'])
def admin_edit():
    d = request.get_json(silent=True) or {}
    if d.get('token') not in _ADMIN_TOKENS:
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    table, col = d.get('table'), d.get('column')
    if table not in _EDITABLE or col not in _EDITABLE[table]:
        return jsonify({'ok': False, 'error': 'field not editable'}), 400
    try:
        vid = int(d.get('id'))
    except Exception:
        return jsonify({'ok': False, 'error': 'bad id'}), 400
    val = d.get('value', '')
    if not isinstance(val, str):
        return jsonify({'ok': False, 'error': 'bad value'}), 400
    conn = db.get_connection()
    try:
        conn.execute('UPDATE %s SET %s = ? WHERE id = ?' % (table, col), (val, vid))
        conn.commit()
    finally:
        conn.close()
    return jsonify({'ok': True})


# ── admin chapter restructuring (merge / split) — local only, gated + backed up ─
import shutil
from datetime import datetime as _dt


def _backup_db():
    src = getattr(db, 'DB_PATH', None)
    if src and os.path.exists(src):
        shutil.copy2(src, '%s.bak_admin_%s' % (src, _dt.now().strftime('%Y%m%d_%H%M%S')))


def _portion_spans(conn, book_id):
    """For every portion of the book, the first/last verse_id it currently covers
    (by standard chapter:verse), so its boundaries can be recomputed after a
    re-chaptering. Returns {portion_id: (first_vid, last_vid, end_was_sentinel)}."""
    out = {}
    for p in conn.execute('SELECT id,start_ch,start_v,end_ch,end_v FROM portions WHERE book_id=?',
                          (book_id,)).fetchall():
        rows = conn.execute(
            """SELECT v.id FROM verses v JOIN chapters c ON c.id=v.chapter_id
               WHERE c.book_id=?
                 AND (c.number>? OR (c.number=? AND CAST(v.number AS INTEGER)>=?))
                 AND (c.number<? OR (c.number=? AND CAST(v.number AS INTEGER)<=?))
               ORDER BY c.number, CAST(v.number AS INTEGER), v.id""",
            (book_id, p['start_ch'], p['start_ch'], p['start_v'],
             p['end_ch'], p['end_ch'], p['end_v'])).fetchall()
        if rows:
            out[p['id']] = (rows[0]['id'], rows[-1]['id'], p['end_v'] >= 9999)
    return out


def _pos(conn, vid):
    r = conn.execute("""SELECT c.number ch, CAST(v.number AS INTEGER) vn
                        FROM verses v JOIN chapters c ON c.id=v.chapter_id WHERE v.id=?""", (vid,)).fetchone()
    return (r['ch'], r['vn']) if r else (None, None)


def _fix_portions(conn, spans):
    for pid, (fv, lv, sentinel) in spans.items():
        sch, svn = _pos(conn, fv)
        ech, evn = _pos(conn, lv)
        if sch is None or ech is None:
            continue
        conn.execute('UPDATE portions SET start_ch=?,start_v=?,end_ch=?,end_v=? WHERE id=?',
                     (sch, svn, ech, 9999 if sentinel else evn, pid))


def _fix_root_index(conn, book_id):
    for r in conn.execute("""SELECT v.id vid, c.number ch, v.number vn FROM verses v
                             JOIN chapters c ON c.id=v.chapter_id WHERE c.book_id=?""", (book_id,)).fetchall():
        conn.execute('UPDATE root_index SET chapter=?, verse=? WHERE verse_id=?', (r['ch'], r['vn'], r['vid']))


@app.route('/api/admin/merge_next', methods=['POST'])
def admin_merge_next():
    d = request.get_json(silent=True) or {}
    if d.get('token') not in _ADMIN_TOKENS:
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    try:
        chapter_id = int(d.get('chapter_id'))
    except Exception:
        return jsonify({'ok': False, 'error': 'bad chapter'}), 400
    _backup_db()
    conn = db.get_connection()
    try:
        cur = conn.execute('SELECT id,book_id,number FROM chapters WHERE id=?', (chapter_id,)).fetchone()
        if not cur:
            return jsonify({'ok': False, 'error': 'chapter not found'}), 404
        nxt = conn.execute('SELECT id,number FROM chapters WHERE book_id=? AND number=?',
                           (cur['book_id'], cur['number'] + 1)).fetchone()
        if not nxt:
            return jsonify({'ok': False, 'error': 'אין פרק הבא לאיחוד'}), 400
        book_id, N = cur['book_id'], cur['number']
        spans = _portion_spans(conn, book_id)
        k = conn.execute('SELECT COALESCE(MAX(CAST(number AS INTEGER)),0) FROM verses WHERE chapter_id=?',
                        (cur['id'],)).fetchone()[0]
        moved = conn.execute('SELECT id FROM verses WHERE chapter_id=? ORDER BY CAST(number AS INTEGER), id',
                            (nxt['id'],)).fetchall()
        for i, r in enumerate(moved, 1):
            conn.execute('UPDATE verses SET chapter_id=?, number=? WHERE id=?', (cur['id'], str(k + i), r['id']))
        conn.execute('DELETE FROM chapters WHERE id=?', (nxt['id'],))
        conn.execute('UPDATE chapters SET number=number-1 WHERE book_id=? AND number>?', (book_id, N + 1))
        _fix_portions(conn, spans)
        _fix_root_index(conn, book_id)
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'ok': False, 'error': str(e)}), 500
    finally:
        conn.close()
    return jsonify({'ok': True})


@app.route('/api/admin/split', methods=['POST'])
def admin_split():
    d = request.get_json(silent=True) or {}
    if d.get('token') not in _ADMIN_TOKENS:
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    try:
        chapter_id = int(d.get('chapter_id')); after_vid = int(d.get('after_verse_id'))
    except Exception:
        return jsonify({'ok': False, 'error': 'bad params'}), 400
    _backup_db()
    conn = db.get_connection()
    try:
        cur = conn.execute('SELECT id,book_id,number FROM chapters WHERE id=?', (chapter_id,)).fetchone()
        if not cur:
            return jsonify({'ok': False, 'error': 'chapter not found'}), 404
        book_id, N = cur['book_id'], cur['number']
        ids = [r['id'] for r in conn.execute(
            'SELECT id FROM verses WHERE chapter_id=? ORDER BY CAST(number AS INTEGER), id', (cur['id'],)).fetchall()]
        if after_vid not in ids:
            return jsonify({'ok': False, 'error': 'הפסוק אינו בפרק זה'}), 400
        pos = ids.index(after_vid)
        if pos >= len(ids) - 1:
            return jsonify({'ok': False, 'error': 'לא ניתן לפצל אחרי הפסוק האחרון'}), 400
        moved = ids[pos + 1:]
        spans = _portion_spans(conn, book_id)
        conn.execute('UPDATE chapters SET number=number+1 WHERE book_id=? AND number>?', (book_id, N))
        c2 = conn.cursor()
        c2.execute('INSERT INTO chapters (book_id, number) VALUES (?,?)', (book_id, N + 1))
        new_id = c2.lastrowid
        for i, vid in enumerate(moved, 1):
            conn.execute('UPDATE verses SET chapter_id=?, number=? WHERE id=?', (new_id, str(i), vid))
        _fix_portions(conn, spans)
        _fix_root_index(conn, book_id)
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'ok': False, 'error': str(e)}), 500
    finally:
        conn.close()
    return jsonify({'ok': True})


# Samaritan-division chapter merge/split: only sam_ch_id + sam_chapters change, so
# the Jewish division, parashot (standard chapter:verse) and root_index are untouched.
@app.route('/api/admin/merge_next_sam', methods=['POST'])
def admin_merge_next_sam():
    d = request.get_json(silent=True) or {}
    if d.get('token') not in _ADMIN_TOKENS:
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    try:
        sam_id = int(d.get('chapter_id'))
    except Exception:
        return jsonify({'ok': False, 'error': 'bad chapter'}), 400
    _backup_db()
    conn = db.get_connection()
    try:
        cur = conn.execute('SELECT id,book_id,number FROM sam_chapters WHERE id=?', (sam_id,)).fetchone()
        if not cur:
            return jsonify({'ok': False, 'error': 'chapter not found'}), 404
        nxt = conn.execute('SELECT id FROM sam_chapters WHERE book_id=? AND number=?',
                           (cur['book_id'], cur['number'] + 1)).fetchone()
        if not nxt:
            return jsonify({'ok': False, 'error': 'אין פרק הבא לאיחוד'}), 400
        conn.execute('UPDATE verses SET sam_ch_id=? WHERE sam_ch_id=?', (cur['id'], nxt['id']))
        conn.execute('DELETE FROM sam_chapters WHERE id=?', (nxt['id'],))
        conn.execute('UPDATE sam_chapters SET number=number-1 WHERE book_id=? AND number>?',
                     (cur['book_id'], cur['number'] + 1))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'ok': False, 'error': str(e)}), 500
    finally:
        conn.close()
    return jsonify({'ok': True})


@app.route('/api/admin/split_sam', methods=['POST'])
def admin_split_sam():
    d = request.get_json(silent=True) or {}
    if d.get('token') not in _ADMIN_TOKENS:
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    try:
        sam_id = int(d.get('chapter_id')); after_vid = int(d.get('after_verse_id'))
    except Exception:
        return jsonify({'ok': False, 'error': 'bad params'}), 400
    _backup_db()
    conn = db.get_connection()
    try:
        cur = conn.execute('SELECT id,book_id,number FROM sam_chapters WHERE id=?', (sam_id,)).fetchone()
        if not cur:
            return jsonify({'ok': False, 'error': 'chapter not found'}), 404
        ids = [r['id'] for r in conn.execute(
            """SELECT v.id FROM verses v JOIN chapters c ON c.id=v.chapter_id
               WHERE v.sam_ch_id=? ORDER BY c.number, CAST(v.number AS INTEGER), v.id""", (cur['id'],)).fetchall()]
        if after_vid not in ids:
            return jsonify({'ok': False, 'error': 'הפסוק אינו בפרק זה'}), 400
        pos = ids.index(after_vid)
        if pos >= len(ids) - 1:
            return jsonify({'ok': False, 'error': 'לא ניתן לפצל אחרי הפסוק האחרון'}), 400
        moved = ids[pos + 1:]
        conn.execute('UPDATE sam_chapters SET number=number+1 WHERE book_id=? AND number>?',
                     (cur['book_id'], cur['number']))
        c2 = conn.cursor()
        c2.execute('INSERT INTO sam_chapters (book_id, number) VALUES (?,?)', (cur['book_id'], cur['number'] + 1))
        new_id = c2.lastrowid
        conn.executemany('UPDATE verses SET sam_ch_id=? WHERE id=?', [(new_id, vid) for vid in moved])
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'ok': False, 'error': str(e)}), 500
    finally:
        conn.close()
    return jsonify({'ok': True})


# Split one verse into two in the Samaritan division. The new verse keeps the
# integer base of the original and gets the next free maqaf sub-number
# (10 -> 10-1, 10-1 -> 10-2, 11 -> 11-1). Because get_verses() filters
# typeof(number)='integer', the maqaf verse shows ONLY in the Samaritan division
# (same Jewish chapter and same Samaritan chapter as the original).
@app.route('/api/admin/split_verse', methods=['POST'])
def admin_split_verse():
    d = request.get_json(silent=True) or {}
    if d.get('token') not in _ADMIN_TOKENS:
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    try:
        verse_id = int(d.get('verse_id'))
    except Exception:
        return jsonify({'ok': False, 'error': 'bad params'}), 400
    text1, text2 = d.get('text1'), d.get('text2')
    if not isinstance(text1, str) or not isinstance(text2, str) or not text1.strip() or not text2.strip():
        return jsonify({'ok': False, 'error': 'שני החלקים חייבים להכיל טקסט'}), 400
    _backup_db()
    conn = db.get_connection()
    try:
        v = conn.execute('SELECT id, chapter_id, number, sam_ch_id FROM verses WHERE id=?', (verse_id,)).fetchone()
        if not v:
            return jsonify({'ok': False, 'error': 'verse not found'}), 404
        base = str(v['number']).split('-')[0]
        if not base.isdigit():
            return jsonify({'ok': False, 'error': 'מספר פסוק לא תקין'}), 400
        # highest existing maqaf sub-number for this base in the same Jewish chapter
        mx = 0
        for r in conn.execute('SELECT number FROM verses WHERE chapter_id=?', (v['chapter_id'],)):
            s = str(r['number'])
            if s.startswith(base + '-'):
                tail = s[len(base) + 1:]
                if tail.isdigit():
                    mx = max(mx, int(tail))
        new_number = '%s-%d' % (base, mx + 1)
        conn.execute('UPDATE verses SET text=? WHERE id=?', (text1.strip(), verse_id))
        conn.execute('INSERT INTO verses (chapter_id, number, text, sam_ch_id) VALUES (?,?,?,?)',
                     (v['chapter_id'], new_number, text2.strip(), v['sam_ch_id']))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'ok': False, 'error': str(e)}), 500
    finally:
        conn.close()
    return jsonify({'ok': True, 'new_number': new_number})


# Change a verse's SAMARITAN-division number (verses.sam_number) — the Jewish
# `number` is never touched. With cascade=True, every following verse in the same
# Jewish chapter (real integer base >= the target's) has its effective Samaritan
# number shifted by the same delta (maqaf suffix preserved); otherwise only the
# target verse changes. sam_number does not affect root_index (which keys on the
# Jewish number), so no reindex is needed.
@app.route('/api/admin/renumber_verse', methods=['POST'])
def admin_renumber_verse():
    d = request.get_json(silent=True) or {}
    if d.get('token') not in _ADMIN_TOKENS:
        return jsonify({'ok': False, 'error': 'unauthorized'}), 401
    try:
        verse_id = int(d.get('verse_id'))
    except Exception:
        return jsonify({'ok': False, 'error': 'bad params'}), 400
    new_number = str(d.get('new_number') or '').strip()
    cascade = bool(d.get('cascade'))
    if not new_number:
        return jsonify({'ok': False, 'error': 'מספר חדש חסר'}), 400
    _backup_db()
    conn = db.get_connection()
    try:
        v = conn.execute('SELECT id, chapter_id, number, sam_number FROM verses WHERE id=?', (verse_id,)).fetchone()
        if not v:
            return jsonify({'ok': False, 'error': 'verse not found'}), 404
        cid = v['chapter_id']
        if not cascade:
            conn.execute('UPDATE verses SET sam_number=? WHERE id=?', (new_number, verse_id))
        else:
            eff_old = str(v['sam_number'] or v['number']).split('-')[0]
            new_base_s = new_number.split('-')[0]
            real_base_s = str(v['number']).split('-')[0]
            if not (eff_old.isdigit() and new_base_s.isdigit() and real_base_s.isdigit()):
                return jsonify({'ok': False, 'error': 'נדרש מספר שלם לשינוי מדורג'}), 400
            delta = int(new_base_s) - int(eff_old); real_base = int(real_base_s)
            for r in conn.execute('SELECT id, number, sam_number FROM verses WHERE chapter_id=?', (cid,)).fetchall():
                rb = str(r['number']).split('-')[0]
                if rb.isdigit() and int(rb) >= real_base:
                    eff = str(r['sam_number'] or r['number']); eb = eff.split('-')[0]
                    if eb.isdigit():
                        conn.execute('UPDATE verses SET sam_number=? WHERE id=?',
                                     (str(int(eb) + delta) + eff[len(eb):], r['id']))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'ok': False, 'error': str(e)}), 500
    finally:
        conn.close()
    return jsonify({'ok': True})

# columns returned for a verse (everything the UI's content modes need)
_VERSE_COLS = ('id', 'number', 'text', 'english', 'masoretic_text', 'lxx_text',
               'sam_aramaic', 'arabic_trans', 'interpretation', 'rashi', 'ramban',
               'cassuto', 'baal_haturim')
_NIKUD_RE = re.compile(u'[֑-ׇ]')
# everything that is NOT a Hebrew consonant (incl. niqqud, te'amim, U+034F and
# punctuation); used to reduce a word to bare consonants for the compare diff.
_HEB_LETTERS_RE = re.compile(u'[^א-ת]')


def _verse_dict(row):
    keys = row.keys()
    return {k: (row[k] if k in keys else None) for k in _VERSE_COLS}


def _ids_arg(name='verse_ids'):
    raw = request.args.get(name, '')
    return [int(x) for x in raw.split(',') if x.strip().isdigit()]


_FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}


def _heb_fold(s):
    """Hebrew letters only, final forms folded to their base — for matching a
    searched word against the verse_dictionary entries."""
    return ''.join(_FIN.get(c, c) for c in (s or '') if ('א' <= c <= 'ת') or c in _FIN)


def _first_match_word(text, query, exact):
    """The actual word IN THE VERSE that the (plain) query matched — i.e. the word
    highlighted in the result — so the meaning reflects it, not the typed query."""
    qf = _heb_fold(query)
    if not qf:
        return ''
    for w in re.findall('[א-ת]+', text or ''):
        wf = _heb_fold(w)
        if (wf == qf if exact else qf in wf):
            return w
    return ''


_TAL_GLOSS_CACHE = {}


def _tal_gloss(aramaic_word):
    """Short meaning of an Aramaic word from Tal's dictionary (gloss, else the
    start of the entry text). Cached — the dictionary is static."""
    if not aramaic_word:
        return ''
    if aramaic_word in _TAL_GLOSS_CACHE:
        return _TAL_GLOSS_CACHE[aramaic_word]
    g = ''
    try:
        res = db.lookup_tal_dictionary(aramaic_word, limit=1)
        if res:
            r = res[0]
            g = (r.get('gloss_en') or '').strip() or (r.get('notes') or '').strip()[:90]
    except Exception:
        g = ''
    _TAL_GLOSS_CACHE[aramaic_word] = g
    return g


_SAM_OPENING = {}


def _sam_opening(sam_ch_id):
    """First three words of a Samaritan chapter — shown next to a search result's
    Samaritan-division path to identify the chapter. Cached (static data)."""
    if sam_ch_id in _SAM_OPENING:
        return _SAM_OPENING[sam_ch_id]
    try:
        rows = db.get_verses_by_sam_ch(sam_ch_id)
        words = re.findall('[א-ת]+', (rows[0]['text'] if rows else '') or '')
        txt = ' '.join(words[:3])
    except Exception:
        txt = ''
    _SAM_OPENING[sam_ch_id] = txt
    return txt


# ── pages ──────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html', version=APP_VERSION)


@app.route('/api/whats_new')
def api_whats_new():
    """The current version's changelog, read from VER_UPDATES.txt on the server."""
    try:
        with open(_VER_UPDATES, encoding='utf-8') as f:
            text = f.read()
    except Exception:
        text = ''
    return jsonify({'version': APP_VERSION, 'text': text})


@app.route('/fonts/<path:fn>')
def fonts(fn):
    return send_from_directory(os.path.join(app.static_folder, 'fonts'), fn)


# PWA: service worker + manifest must be served from the root scope ('/').
@app.route('/sw.js')
def sw():
    resp = send_from_directory(app.static_folder, 'sw.js')
    resp.headers['Cache-Control'] = 'no-cache'
    resp.headers['Service-Worker-Allowed'] = '/'
    return resp


@app.route('/manifest.json')
def manifest():
    return send_from_directory(app.static_folder, 'manifest.json')


# ── navigation API ─────────────────────────────────────────────────────────
@app.route('/api/books')
def api_books():
    mode = request.args.get('mode', 'samaritan')
    out = []
    for b in db.get_books():
        item = {'id': b['id'], 'name': b['name']}
        if mode == 'samaritan':
            item['n_portions'] = len(db.get_portions(b['id'], mode='samaritan'))
            item['n_chapters'] = len(db.get_sam_chapters(b['id']))
        out.append(item)
    return jsonify(out)


@app.route('/api/portions')
def api_portions():
    book_id = int(request.args['book_id'])
    mode = request.args.get('mode', 'samaritan')          # 'samaritan' | 'standard'
    pmode = 'jewish' if mode == 'standard' else 'samaritan'
    out = []
    for p in db.get_portions(book_id, mode=pmode):
        item = {'id': p['id'], 'name': p['name'],
                'start_ch': p['start_ch'], 'end_ch': p['end_ch']}
        if mode == 'samaritan':
            item['n_chapters'] = db.count_sam_chapters_in_portion(p['id'])
        out.append(item)
    return jsonify(out)


@app.route('/api/chapters')
def api_chapters():
    """Standard (Jewish) chapters — by portion, or all of a book (spread)."""
    pid = request.args.get('portion_id')
    bid = request.args.get('book_id')
    rows = db.get_chapters(portion_id=int(pid)) if pid else db.get_chapters(book_id=int(bid))
    return jsonify([{'id': r['id'], 'number': r['number']} for r in rows])


@app.route('/api/sam_chapters')
def api_sam_chapters():
    """Samaritan chapters whose first verse falls in the portion; or all of a book."""
    pid = request.args.get('portion_id')
    bid = request.args.get('book_id')
    if pid:
        rows = db.get_sam_chapters_in_portion(int(pid))
    else:
        rows = db.get_sam_chapters(int(bid))
    return jsonify([{'id': r['id'], 'number': r['number']} for r in rows])


@app.route('/api/verses')
def api_verses():
    """Standard-division verses of a Jewish chapter."""
    cid = int(request.args['chapter_id'])
    pid = request.args.get('portion_id')
    rows = db.get_verses(cid, portion_id=int(pid) if pid else None)
    out = []
    for r in rows:
        dd = _verse_dict(r)
        dd['jchapter'] = r['jchapter'] if 'jchapter' in r.keys() else None
        mn = r['mas_number'] if 'mas_number' in r.keys() else None
        dd['masnum'] = mn if mn else dd['number']     # Masoretic-comparison number
        out.append(dd)
    return jsonify(out)


@app.route('/api/sam_verses')
def api_sam_verses():
    """Samaritan-division verses of a Samaritan chapter."""
    sid = int(request.args['sam_ch_id'])
    rows = db.get_verses_by_sam_ch(sid)
    out = []
    for r in rows:
        dd = _verse_dict(r)
        dd['jchapter'] = r['jchapter'] if 'jchapter' in r.keys() else None
        mn = r['mas_number'] if 'mas_number' in r.keys() else None
        dd['masnum'] = mn if mn else dd['number']     # Masoretic-comparison number (real)
        sn = r['sam_number'] if 'sam_number' in r.keys() else None
        if sn:                          # Samaritan division shows the Samaritan number
            dd['number'] = sn
        out.append(dd)
    return jsonify(out)


# ── content-mode API ───────────────────────────────────────────────────────
@app.route('/api/interpretations')
def api_interpretations():
    ids = _ids_arg()
    rows = [{'id': i} for i in ids]
    m = get_chapter_interpretations(rows) if ids else {}
    return jsonify({str(k): v for k, v in m.items()})


@app.route('/api/dictionary')
def api_dictionary():
    m = db.get_verse_dictionary(_ids_arg())
    return jsonify({str(k): v for k, v in m.items()})


@app.route('/api/word_table')
def api_word_table():
    m = db.get_word_table(_ids_arg())
    return jsonify({str(k): v for k, v in m.items()})


@app.route('/api/tibat_marqe')
def api_tibat_marqe():
    return jsonify(db.get_tibat_marqe(_ids_arg()))


@app.route('/api/eyalk')
def api_eyalk():
    return jsonify(db.get_eyalk_commentary(_ids_arg()))


@app.route('/api/tzdaka')
def api_tzdaka():
    return jsonify(db.get_tzdaka_commentary(_ids_arg()))


@app.route('/api/apparatus')
def api_apparatus():
    return jsonify(db.get_apparatus(_ids_arg()))


@app.route('/api/tal')
def api_tal():
    word = request.args.get('word', '')
    return jsonify(db.lookup_tal_dictionary(word))


@app.route('/api/root_box')
def api_root_box():
    """Index-extracted root for the editable root box (runs as the user types)."""
    return jsonify({'root': db.root_from_index(request.args.get('word', ''))})


@app.route('/api/sefaria')
def api_sefaria():
    """Live, free, key-less extra Jewish commentators from Sefaria for one verse
    (the 'פרשנים נוספים (ספריא)' option). Resolves the verse's Jewish ref first."""
    from app.services import sefaria_live
    vid = request.args.get('verse_id')
    if not vid or not vid.isdigit():
        return jsonify({'ok': False, 'items': [], 'error': 'bad verse'})
    ref = db.get_verse_ref(int(vid))
    if ref is None:
        return jsonify({'ok': False, 'items': [], 'error': 'no ref'})
    try:
        items = sefaria_live.fetch_live_commentaries(ref['book'], ref['chapter'], ref['verse'])
    except Exception:
        return jsonify({'ok': False, 'items': [], 'error': 'fetch failed'})
    return jsonify({'ok': True, 'items': [{'name': n, 'text': t} for n, t in items]})


@app.route('/api/online_dict')
def api_online_dict():
    """Free, key-less Hebrew-Hebrew definitions (Wiktionary + Wikipedia) for the
    given words, looked up in bulk."""
    from app.services import hebrew_dict
    words = [w for w in request.args.get('words', '').split(',') if w.strip()]
    if not words:
        return jsonify({})
    try:
        res = hebrew_dict.lookup_many(words)
    except Exception:
        res = {}
    out = {}
    for w, payload in res.items():
        if payload and payload[0]:
            out[w] = {'summary': payload[0],
                      'sources': [[name, site] for name, site in payload[1]]}
    return jsonify(out)


# ── compare (Masoretic vs Samaritan) diff, computed server-side ─────────────
def _diff_tokens(sam_num, mas_num, sam_raw, mas_raw):
    """Returns (sam_tokens, mas_tokens); each token is [word, is_diff]. Comparison is
    consonant-only: niqqud, cantillation, the combining grapheme joiner (U+034F) and
    punctuation (periods, dashes, colons, maqaf) are all ignored, so only genuine
    letter differences between the versions are highlighted — the displayed words keep
    their original spelling and marks. Each column carries its own leading number token
    (Samaritan number on the Samaritan side, Masoretic number on the Masoretic side —
    they can differ)."""
    MAQAF = u'־'
    sam_words = sam_raw.split() if sam_raw else []
    mas_words = mas_raw.split() if mas_raw else []
    sam_numtok = [str(sam_num), False]
    mas_numtok = [str(mas_num), False]
    if not sam_words and not mas_words:
        return [], []
    if not sam_words:
        return [], [mas_numtok] + [[w, False] for w in mas_words]
    if not mas_words:
        return [sam_numtok] + [[w, False] for w in sam_words], []

    def tokenize(words):
        # token -> list of consonant-only atoms (maqaf-separated). Atoms that hold no
        # Hebrew letter (pure punctuation: '.', '--', ':--', …) are dropped, so such
        # tokens never count as a difference.
        tokens = []
        for w in words:
            atoms = [_HEB_LETTERS_RE.sub(u'', a) for a in w.split(MAQAF)]
            atoms = [a for a in atoms if a]
            tokens.append((w, atoms))
        return tokens

    sam_tok = tokenize(sam_words)
    mas_tok = tokenize(mas_words)
    sam_atoms, sam_a2t = [], {}
    for ti, (_, atoms) in enumerate(sam_tok):
        for a in atoms:
            sam_a2t[len(sam_atoms)] = ti
            sam_atoms.append(a)
    mas_atoms, mas_a2t = [], {}
    for ti, (_, atoms) in enumerate(mas_tok):
        for a in atoms:
            mas_a2t[len(mas_atoms)] = ti
            mas_atoms.append(a)
    sam_diff = [False] * len(sam_tok)
    mas_diff = [False] * len(mas_tok)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(
            None, sam_atoms, mas_atoms, autojunk=False).get_opcodes():
        if tag != 'equal':
            for ai in range(i1, i2):
                sam_diff[sam_a2t[ai]] = True
            for aj in range(j1, j2):
                mas_diff[mas_a2t[aj]] = True
    sam_tokens = [sam_numtok] + [[w, sam_diff[i]] for i, (w, _) in enumerate(sam_tok)]
    mas_tokens = [mas_numtok] + [[w, mas_diff[i]] for i, (w, _) in enumerate(mas_tok)]
    return sam_tokens, mas_tokens


@app.route('/api/compare', methods=['POST'])
def api_compare():
    """Body: {verses:[{number,text,masoretic_text}, ...]}. Returns per-verse diff
    token lists for the Samaritan and Masoretic columns."""
    data = request.get_json(force=True)
    out = []
    for v in data.get('verses', []):
        st, mt = _diff_tokens(v.get('sam_num'), v.get('mas_num'),
                              v.get('text') or '', v.get('masoretic_text') or '')
        out.append({'sam': st, 'mas': mt})
    return jsonify(out)


# ── search ─────────────────────────────────────────────────────────────────
@app.route('/api/search')
def api_search():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'rows': [], 'count': 0})
    exact = request.args.get('exact') == '1'
    aramaic = request.args.get('aramaic') == '1'
    root_flag = request.args.get('root') == '1'
    root = root_flag and len(query.split()) == 1
    root_letters = request.args.get('root_letters') or None
    ignore_finals = request.args.get('ignore_finals') == '1'
    if exact and root:
        root = False

    rows = db.search_verses(query, exact=exact, root=root, aramaic=aramaic,
                            root_letters=root_letters if root else None,
                            ignore_finals=ignore_finals)

    occ_map, searched_root = {}, ''
    if not aramaic and rows:
        from app.services.hebrew_root import normalize
        if root:
            searched_root = (normalize(root_letters) if root_letters
                             else normalize(db.root_from_index(query) or ''))
            occ_map = db.get_root_occurrences(
                searched_root, [(r['id'], r['text']) for r in rows])
            rows = [r for r in rows if r['id'] in occ_map]
            rows = sorted(rows, key=lambda r: occ_map.get(r['id'], {}).get('order', 1 << 30))
        else:
            occ_map = db.get_word_occurrences(query, [r['id'] for r in rows])

    # batch the per-verse Aramaic word-pairs once, for the meaning enrichment
    vdict = db.get_verse_dictionary([r['id'] for r in rows]) if rows else {}

    out = []
    for r in rows:
        sam = db.get_samaritan_location(r['id'])
        info = occ_map.get(r['id'])
        item = {
            'id': r['id'], 'number': r['number'],
            'text': r['text'], 'sam_aramaic': r['sam_aramaic'],
            'book_id': r['book_id'], 'book_name': r['book_name'],
            'chapter_id': r['chapter_id'], 'chapter_num': r['chapter_num'],
            'portion_id': r['portion_id'], 'portion_name': r['portion_name'] or '',
            'sam': None, 'occ': None, 'match_words': None, 'subroot': '',
            'aramaic': '', 'meaning': '', 'matched_word': '',
        }
        if sam and sam['sam_portion_id']:
            item['sam'] = {
                'sam_ch_id': sam['sam_ch_id'], 'sam_ch_num': sam['sam_ch_num'],
                'number': sam['number'], 'sam_portion_id': sam['sam_portion_id'],
                'sam_portion_name': sam['sam_portion_name'],
                'opening': _sam_opening(sam['sam_ch_id']),
            }
        if info:
            item['occ'] = [list(o) for o in info.get('occ', [])]
            item['subroot'] = info.get('subroot') or ''
            if root and not aramaic:
                item['match_words'] = info.get('words') or []

        # meaning of the HIGHLIGHTED word (not the typed query): its Aramaic
        # translation (from the verse's word-pairs) + the gloss from Tal's dict.
        if info and root and info.get('words'):
            mword = info['words'][0]
        else:
            mword = _first_match_word(r['sam_aramaic'] if aramaic else r['text'],
                                      query, exact) or query
        item['matched_word'] = mword
        pairs = vdict.get(r['id'], [])
        cands = [c for c in [_heb_fold(mword)] if c]
        aramaic_w = ''
        for a, h in pairs:                                  # exact word match first
            side = _heb_fold(a if aramaic else h)
            if side and side in cands:
                aramaic_w = a; break
        if not aramaic_w:                                   # then a substring match
            for a, h in pairs:
                side = _heb_fold(a if aramaic else h)
                if side and any(c in side or side in c for c in cands):
                    aramaic_w = a; break
        item['aramaic'] = aramaic_w
        item['meaning'] = _tal_gloss(aramaic_w)
        out.append(item)

    return jsonify({
        'rows': out, 'count': len(out),
        'aramaic': aramaic, 'root': root, 'exact': exact,
        'searched_root': searched_root,
        'root_requested_multi': (root_flag and not root),
    })


def _snippet(text, word, span=70):
    t = text or ''
    i = t.find(word)
    if i < 0:
        return t[:span] + ('…' if len(t) > span else '')
    s = max(0, i - 22); e = min(len(t), i + len(word) + 48)
    return ('…' if s > 0 else '') + t[s:e] + ('…' if e < len(t) else '')


@app.route('/api/word_sources')
def api_word_sources():
    """For a tapped word: its root/entry from Tal's dictionary (with the citation
    locations), plus where the word also occurs in Tibåt Mårqe and the Samaritan-
    tradition (eyalk) sources. Shown in a popup."""
    word = (request.args.get('word') or '').strip()
    out = {'word': word, 'tal': [], 'tibat_marqe': [], 'eyalk': []}
    if len(_heb_fold(word)) < 2:
        return jsonify(out)
    try:
        for e in db.lookup_tal_dictionary(word, limit=4):
            out['tal'].append({
                'lemma': e.get('lemma'), 'pos': e.get('pos'), 'gloss_en': e.get('gloss_en'),
                'citations': [{'quote': q, 'ref': rf} for q, rf in (e.get('citations') or [])][:5],
            })
    except Exception:
        pass
    like = '%' + word + '%'
    conn = db.get_connection()
    try:
        for r in conn.execute(
                "SELECT book, section, book_title, aramaic, hebrew FROM tm_sections "
                "WHERE aramaic LIKE ? OR hebrew LIKE ? ORDER BY sort_key LIMIT 15",
                (like, like)).fetchall():
            letter = db._TM_HE_LETTER.get(r['book'], r['book'])
            out['tibat_marqe'].append({
                'label': 'ספר %s, §%s' % (letter, r['section']),
                'book_title': r['book_title'] or '',
                'snippet': _snippet(r['aramaic'] or r['hebrew'] or '', word),
            })
    except Exception:
        pass
    try:
        for r in conn.execute(
                "SELECT parsha, text FROM eyalk_sections WHERE text LIKE ? ORDER BY ord LIMIT 12",
                (like,)).fetchall():
            out['eyalk'].append({'parsha': r['parsha'] or '', 'snippet': _snippet(r['text'], word)})
    except Exception:
        pass
    conn.close()
    return jsonify(out)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5000'))
    app.run(host='127.0.0.1', port=port, debug=False)
