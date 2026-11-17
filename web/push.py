# -*- coding: utf-8 -*-
"""התראות על תוכן חדש — the push notification that reaches the phone itself.

The main menu already shows a small star on an app's circle when something was
added to it (news.py). The star is only seen by someone who opens the app; this
module carries the same news to the phone when the app is CLOSED, for a reader
who asked to be told.

How the chain hangs together:

1. The app asks, once, on the first opening of the INSTALLED app, in the
   language of the DEVICE: "would you like notifications about new content?"
   yes / no. Yes asks the browser for permission and subscribes.
2. The subscription — a URL at the push service of that browser, with two keys —
   is kept here, in analytics.db, on the same persistent disk as the content
   database. It is the only thing kept, and it is deleted the moment the push
   service says the device is gone (404/410) or the reader turns notifications
   off.
3. Every fifteen minutes the feed news.py builds is read, and whatever is in it
   that has not been sent yet is sent. The FIRST run sends nothing: it writes
   down what is already there, so installing this does not fire forty old items
   at everyone.
4. The service worker shows the notification, and a press on it opens the app at
   that app's news (`/?news=<app>`).

The signing keypair (VAPID) is made here on first use and kept beside the
database on the persistent disk — never in git, and nothing for anyone to
configure. Should the disk ever be wiped, a new pair is made and the old
subscriptions die with their first failure, which the sweep cleans up.

Nothing personal is sent outward. The VAPID `sub` claim, which the push service
sees, is the site's own address — not anyone's e-mail.
"""
import base64
import json
import os
import sqlite3
import threading
import time

from flask import Blueprint, jsonify, request

push = Blueprint('push', __name__)

_HERE = os.path.dirname(os.path.abspath(__file__))
try:
    from analytics import ANALYTICS_DB_PATH as _DB
except Exception:                                        # pragma: no cover
    _DB = os.path.join(_HERE, '..', 'data', 'analytics.db')

_KEY_PATH = os.environ.get('VAPID_KEY_PATH') or \
    os.path.join(os.path.dirname(os.path.abspath(_DB)), 'vapid_private.pem')
# What the push service may use to reach us about these pushes. The site's own
# origin, deliberately, and not anybody's e-mail: VAPID allows an https subject
# as readily as a mailto, and this way nothing personal leaves the house. It must
# be the bare origin — py_vapid's check anchors the https form, so a trailing
# slash or a path is rejected.
_SUBJECT = (os.environ.get('VAPID_SUBJECT') or 'https://samaritan-torah.onrender.com').rstrip('/')
SWEEP_EVERY = int(os.environ.get('PUSH_SWEEP_SECONDS', '900'))
_MAX_PER_SWEEP = 6              # a quiet night of additions, not a flood
REPORT = {}                     # what the last sweep did, for /healthz

# the name each app answers to, for the line of the notification. The server has
# to be able to speak without the client, so these are here as well as in hub.js.
APP_NAMES = {
    'dict':      {'he': 'המילון הארמי-עברי', 'en': 'The Aramaic-Hebrew Dictionary', 'ar': 'القاموس الآرامي-العبري'},
    'shira':     {'he': 'אוצר השירה השומרונית', 'en': 'The Song Treasury', 'ar': 'كنز الأناشيد'},
    'calendar':  {'he': 'לוח השנה השומרוני', 'en': 'The Samaritan Calendar', 'ar': 'التقويم السامري'},
    'library':   {'he': 'הספרייה', 'en': 'The Library', 'ar': 'المكتبة'},
    'timeline':  {'he': 'ציר הזמן ההיסטורי', 'en': 'The Historical Timeline', 'ar': 'الخط الزمني التاريخي'},
    'mss':       {'he': 'אוצר כתבי היד', 'en': 'The Manuscript Treasury', 'ar': 'كنز المخطوطات'},
    'genealogy': {'he': 'אילן היוחסין השומרוני', 'en': 'Samaritan Genealogy', 'ar': 'شجرة الأنساب السامرية'},
    'gerizim':   {'he': 'גבעת עולם', 'en': 'Givat Olam', 'ar': 'التلة الأبدية'},
    'archive':   {'he': 'הארכיון', 'en': 'The Archive', 'ar': 'الأرشيف'},
}
_LANGS = ('he', 'en', 'ar')


# ── the store ─────────────────────────────────────────────────────────────────
def _conn():
    os.makedirs(os.path.dirname(os.path.abspath(_DB)), exist_ok=True)
    c = sqlite3.connect(_DB, timeout=8)
    c.row_factory = sqlite3.Row
    # a device that asked to be told: its push endpoint, its two keys, and the
    # language it asked in. No name, no address, no session.
    c.execute('''CREATE TABLE IF NOT EXISTS push_subs(
        endpoint TEXT PRIMARY KEY, p256dh TEXT, auth TEXT, lang TEXT,
        created INTEGER, last_ok INTEGER, fails INTEGER NOT NULL DEFAULT 0)''')
    # one row per news item already sent, so nothing is ever sent twice
    c.execute('''CREATE TABLE IF NOT EXISTS push_sent(
        item_key TEXT PRIMARY KEY, ts INTEGER)''')
    return c


def subscriber_count():
    try:
        with _conn() as c:
            return c.execute('SELECT COUNT(*) FROM push_subs').fetchone()[0]
    except sqlite3.Error:
        return 0


# ── the signing keypair ───────────────────────────────────────────────────────
_KEY_LOCK = threading.Lock()
_PUB = None


def _ensure_keys():
    """The VAPID keypair: read from the disk, or made once and written there.
    Returns the public key as the browser wants it (base64url, 65 raw bytes)."""
    global _PUB
    if _PUB:
        return _PUB
    with _KEY_LOCK:
        if _PUB:
            return _PUB
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        key = None
        if os.path.exists(_KEY_PATH):
            try:
                with open(_KEY_PATH, 'rb') as fh:
                    key = serialization.load_pem_private_key(fh.read(), password=None)
            except Exception:
                key = None
        if key is None:
            key = ec.generate_private_key(ec.SECP256R1())
            os.makedirs(os.path.dirname(os.path.abspath(_KEY_PATH)), exist_ok=True)
            pem = key.private_bytes(serialization.Encoding.PEM,
                                    serialization.PrivateFormat.PKCS8,
                                    serialization.NoEncryption())
            tmp = _KEY_PATH + '.tmp'
            with open(tmp, 'wb') as fh:
                fh.write(pem)
            os.replace(tmp, _KEY_PATH)
            try:
                os.chmod(_KEY_PATH, 0o600)
            except OSError:
                pass
        raw = key.public_key().public_bytes(serialization.Encoding.X962,
                                            serialization.PublicFormat.UncompressedPoint)
        _PUB = base64.urlsafe_b64encode(raw).rstrip(b'=').decode()
        return _PUB


# ── sending ───────────────────────────────────────────────────────────────────
def _send_one(row, payload):
    """True if it arrived, False if it failed, None if the device is gone."""
    from pywebpush import WebPushException, webpush
    try:
        webpush(subscription_info={'endpoint': row['endpoint'],
                                   'keys': {'p256dh': row['p256dh'], 'auth': row['auth']}},
                data=json.dumps(payload, ensure_ascii=False),
                vapid_private_key=_KEY_PATH,
                vapid_claims={'sub': _SUBJECT},
                ttl=60 * 60 * 24 * 3)
        return True
    except WebPushException as exc:
        code = getattr(getattr(exc, 'response', None), 'status_code', 0)
        if code in (404, 410):             # the subscription is dead for good
            return None
        return False
    except Exception:
        return False


def send(make_payload):
    """Send to every subscriber. make_payload(lang) -> dict, so each device is
    told in the language it asked in. Returns (sent, dropped, failed)."""
    _ensure_keys()
    with _conn() as c:
        rows = [dict(r) for r in c.execute('SELECT * FROM push_subs')]
    by_lang = {l: make_payload(l) for l in _LANGS}
    sent = dropped = failed = 0
    gone, ok = [], []
    for row in rows:
        r = _send_one(row, by_lang.get(row.get('lang') or 'he', by_lang['he']))
        if r is True:
            sent += 1
            ok.append(row['endpoint'])
        elif r is None:
            dropped += 1
            gone.append(row['endpoint'])
        else:
            failed += 1
    try:
        with _conn() as c:
            now = int(time.time())
            # a device the push service says is gone is forgotten at once
            c.executemany('DELETE FROM push_subs WHERE endpoint=?', [(e,) for e in gone])
            c.executemany('UPDATE push_subs SET last_ok=?, fails=0 WHERE endpoint=?',
                          [(now, e) for e in ok])
    except sqlite3.Error:
        pass
    return sent, dropped, failed


# ── the news sweep ────────────────────────────────────────────────────────────
def _feed():
    """The very same items the stars are drawn from."""
    try:
        import news as _news
        return _news._curated() + _news._shira()
    except Exception:
        return []


def _item_key(it):
    own = it.get('id')
    if own:
        return str(own)
    return ('%s|%s|%s' % (it.get('app'), it.get('date'), it.get('he') or ''))[:200]


def _payload_for(it, lang):
    app = it.get('app') or ''
    name = (APP_NAMES.get(app) or {}).get(lang) or (APP_NAMES.get(app) or {}).get('he') or ''
    # the headline falls back to the Hebrew — it is usually the name of the thing
    # added, a piyyut or a book, and a name is better than nothing. The sentence
    # under it does NOT: a Hebrew sentence appended to an English notification is
    # worse than no sentence, so it is shown only where it was written.
    head = (it.get(lang) or it.get('he') or '').strip()
    body = (it.get('text_' + lang) or '').strip()
    return {'title': name, 'body': (head + (' — ' + body if body else '')).strip() or name,
            'url': '/?news=' + app, 'app': app, 'tag': 'news-' + app, 'lang': lang}


def sweep(force=False):
    """Send what is new and has not been sent. Silent on the first run."""
    items = [it for it in _feed() if it.get('app') and it.get('date')]
    if not items:
        return {'new': 0, 'note': 'feed empty'}
    try:
        with _conn() as c:
            known = {r[0] for r in c.execute('SELECT item_key FROM push_sent')}
            first_time = not known
            fresh = [it for it in items if _item_key(it) not in known]
            if first_time and not force:
                # the first time: write down everything that is already there and
                # tell nobody, so switching this on is not forty notifications
                c.executemany('INSERT OR IGNORE INTO push_sent(item_key, ts) VALUES(?, ?)',
                              [(_item_key(it), int(time.time())) for it in items])
                REPORT['push'] = 'first run: %d items noted, none sent' % len(items)
                return {'new': 0, 'noted': len(items)}
    except sqlite3.Error as exc:
        REPORT['push'] = 'store unreadable: %s' % exc
        return {'new': 0, 'error': str(exc)}
    if not fresh:
        return {'new': 0}
    fresh.sort(key=lambda it: it.get('date') or '')
    hold = fresh[:-_MAX_PER_SWEEP] if len(fresh) > _MAX_PER_SWEEP else []
    out = fresh[-_MAX_PER_SWEEP:] if len(fresh) > _MAX_PER_SWEEP else fresh
    done = 0
    for it in out:
        s, d, f = send(lambda lang, _it=it: _payload_for(_it, lang))
        done += s
    try:
        with _conn() as c:
            c.executemany('INSERT OR IGNORE INTO push_sent(item_key, ts) VALUES(?, ?)',
                          [(_item_key(it), int(time.time())) for it in out + hold])
    except sqlite3.Error:
        pass
    REPORT['push'] = '%d new items, %d notifications sent' % (len(out), done)
    print('[push] %s' % REPORT['push'])
    return {'new': len(out), 'sent': done}


_WATCHING = False


def start_watch():
    """One daemon thread: a sweep shortly after boot, then every quarter hour."""
    global _WATCHING
    if _WATCHING or os.environ.get('PUSH_DISABLE') == '1':
        return
    _WATCHING = True

    def loop():
        time.sleep(20)                       # let the boot finish first
        while True:
            try:
                if subscriber_count():
                    sweep()
                else:
                    # nobody is listening; still note what is there, so the day
                    # someone subscribes they are not told about old news
                    sweep()
            except Exception as exc:
                print('[push] sweep failed: %s' % exc)
            time.sleep(max(60, SWEEP_EVERY))

    threading.Thread(target=loop, name='push-sweep', daemon=True).start()


# ── the endpoints the app itself uses ─────────────────────────────────────────
@push.route('/api/push/key')
def api_key():
    try:
        return jsonify({'key': _ensure_keys()})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 503


@push.route('/api/push/subscribe', methods=['POST'])
def api_subscribe():
    d = request.get_json(silent=True) or {}
    sub = d.get('subscription') or d
    endpoint = (sub.get('endpoint') or '').strip()
    keys = sub.get('keys') or {}
    p256dh, auth = (keys.get('p256dh') or '').strip(), (keys.get('auth') or '').strip()
    lang = (d.get('lang') or 'he').strip()[:5]
    if not endpoint.startswith('https://') or not p256dh or not auth:
        return jsonify({'ok': False, 'error': 'bad subscription'}), 400
    if lang not in _LANGS:
        lang = 'he'
    try:
        with _conn() as c:
            c.execute('''INSERT INTO push_subs(endpoint, p256dh, auth, lang, created, last_ok, fails)
                         VALUES(?,?,?,?,?,NULL,0)
                         ON CONFLICT(endpoint) DO UPDATE SET
                           p256dh=excluded.p256dh, auth=excluded.auth, lang=excluded.lang''',
                      (endpoint, p256dh, auth, lang, int(time.time())))
    except sqlite3.Error as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 503
    return jsonify({'ok': True})


@push.route('/api/push/unsubscribe', methods=['POST'])
def api_unsubscribe():
    d = request.get_json(silent=True) or {}
    endpoint = ((d.get('subscription') or {}).get('endpoint') or d.get('endpoint') or '').strip()
    if not endpoint:
        return jsonify({'ok': False}), 400
    try:
        with _conn() as c:
            c.execute('DELETE FROM push_subs WHERE endpoint=?', (endpoint,))
    except sqlite3.Error:
        pass
    return jsonify({'ok': True})
