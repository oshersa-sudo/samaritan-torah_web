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

# columns returned for a verse (everything the UI's content modes need)
_VERSE_COLS = ('id', 'number', 'text', 'english', 'masoretic_text', 'sam_aramaic',
               'arabic_trans', 'interpretation', 'rashi', 'ramban', 'cassuto',
               'baal_haturim')
_NIKUD_RE = re.compile(u'[֑-ׇ]')


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
    return jsonify([_verse_dict(r) for r in rows])


@app.route('/api/sam_verses')
def api_sam_verses():
    """Samaritan-division verses of a Samaritan chapter."""
    sid = int(request.args['sam_ch_id'])
    rows = db.get_verses_by_sam_ch(sid)
    return jsonify([_verse_dict(r) for r in rows])


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


@app.route('/api/tibat_marqe')
def api_tibat_marqe():
    return jsonify(db.get_tibat_marqe(_ids_arg()))


@app.route('/api/eyalk')
def api_eyalk():
    return jsonify(db.get_eyalk_commentary(_ids_arg()))


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
def _diff_tokens(verse_num, sam_raw, mas_raw):
    """Port of BrowseScreen._diff_tokens. Returns (sam_tokens, mas_tokens); each
    token is [word, is_diff]. Atom-level, maqaf-aware, niqqud-insensitive."""
    MAQAF = u'־'
    sam_words = sam_raw.split() if sam_raw else []
    mas_words = mas_raw.split() if mas_raw else []
    numtok = [str(verse_num), False]
    if not sam_words and not mas_words:
        return [], []
    if not sam_words:
        return [], [numtok] + [[w, False] for w in mas_words]
    if not mas_words:
        return [numtok] + [[w, False] for w in sam_words], []

    def tokenize(words):
        tokens = []
        for w in words:
            atoms = [_NIKUD_RE.sub(u'', a) for a in w.split(MAQAF) if a]
            tokens.append((w, atoms or [_NIKUD_RE.sub(u'', w)]))
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
    sam_tokens = [numtok] + [[w, sam_diff[i]] for i, (w, _) in enumerate(sam_tok)]
    mas_tokens = [numtok] + [[w, mas_diff[i]] for i, (w, _) in enumerate(mas_tok)]
    return sam_tokens, mas_tokens


@app.route('/api/compare', methods=['POST'])
def api_compare():
    """Body: {verses:[{number,text,masoretic_text}, ...]}. Returns per-verse diff
    token lists for the Samaritan and Masoretic columns."""
    data = request.get_json(force=True)
    out = []
    for v in data.get('verses', []):
        st, mt = _diff_tokens(v.get('number'), v.get('text') or '',
                              v.get('masoretic_text') or '')
        out.append({'number': v.get('number'), 'sam': st, 'mas': mt})
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
    if exact and root:
        root = False

    rows = db.search_verses(query, exact=exact, root=root, aramaic=aramaic,
                            root_letters=root_letters if root else None)

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
            'aramaic': '', 'meaning': '',
        }
        if sam and sam['sam_portion_id']:
            item['sam'] = {
                'sam_ch_id': sam['sam_ch_id'], 'sam_ch_num': sam['sam_ch_num'],
                'number': sam['number'], 'sam_portion_id': sam['sam_portion_id'],
                'sam_portion_name': sam['sam_portion_name'],
            }
        if info:
            item['occ'] = [list(o) for o in info.get('occ', [])]
            item['subroot'] = info.get('subroot') or ''
            if root and not aramaic:
                item['match_words'] = info.get('words') or []

        # meaning of the searched word: its Aramaic translation (from the verse's
        # word-pairs) + the gloss from Tal's dictionary, shown by the pronunciation.
        pairs = vdict.get(r['id'], [])
        cands = [_heb_fold(c) for c in
                 ((info.get('words') if (info and root) else None) or [query])]
        cands = [c for c in cands if c]
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


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5000'))
    app.run(host='127.0.0.1', port=port, debug=False)
