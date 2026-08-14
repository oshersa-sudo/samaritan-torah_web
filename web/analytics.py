# -*- coding: utf-8 -*-
"""Lightweight visit/session analytics for the admin dashboard. Deliberately a
SEPARATE sqlite file from torah.db (the content DB) — it must never be touched
by admin_reseed_db/admin_download_db, and it has nothing to do with the app's
own read-only content layer (app/services/database.py).

Persists on the same persistent disk as DB_PATH when one is mounted (Render);
otherwise falls back to a local file under data/ (gitignored, resets on
redeploy — fine for local dev).
"""
import os
import re
import sqlite3
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
_DB_PATH_ENV = os.environ.get('DB_PATH')
if _DB_PATH_ENV:
    _DEFAULT_DIR = os.path.dirname(_DB_PATH_ENV)
else:
    _DEFAULT_DIR = os.path.join(_HERE, '..', 'data')
ANALYTICS_DB_PATH = os.environ.get('ANALYTICS_DB_PATH') or os.path.join(_DEFAULT_DIR, 'analytics.db')

_SID_RE = re.compile(r'^[A-Za-z0-9_-]{6,64}$')

# Visit history is kept for this long and then deleted, as the privacy policy at
# /privacy promises. Only the visit trail expires: the admin's WebAuthn
# credential and the named counters (the APK download tally) are not visit data
# and are never touched. Override with ANALYTICS_RETENTION_DAYS; 0 disables.
RETENTION_DAYS = int(os.environ.get('ANALYTICS_RETENTION_DAYS', '30'))
_PURGE_MARK = '_analytics_purge'      # counters row holding the last purge time
_PURGE_EVERY = 24 * 3600              # at most one sweep a day


def _connect():
    os.makedirs(os.path.dirname(os.path.abspath(ANALYTICS_DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(ANALYTICS_DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS sessions(
        session_id TEXT PRIMARY KEY, first_seen INTEGER, last_seen INTEGER,
        ip TEXT, user_agent TEXT, device TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS visits(
        id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, ts INTEGER,
        path TEXT, title TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS webauthn_credentials(
        credential_id TEXT PRIMARY KEY, public_key BLOB, sign_count INTEGER, created INTEGER)''')
    # plain named counters (the APK download tally, for one) — here and not in
    # torah.db so that "טען DB מהמאגר" cannot reset them
    conn.execute('''CREATE TABLE IF NOT EXISTS counters(
        name TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, last_ts INTEGER)''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_visits_session ON visits(session_id)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_sessions_last ON sessions(last_seen)')
    # the retention sweep deletes by age; without this it would scan every visit
    conn.execute('CREATE INDEX IF NOT EXISTS idx_visits_ts ON visits(ts)')
    return conn


_UA_DEVICE = [
    (re.compile(r'iPhone'), 'iPhone'),
    (re.compile(r'iPad'), 'iPad'),
    (re.compile(r'Android.*Mobile'), 'טלפון Android'),
    (re.compile(r'Android'), 'טאבלט Android'),
    (re.compile(r'Macintosh'), 'Mac'),
    (re.compile(r'Windows'), 'מחשב Windows'),
    (re.compile(r'Linux'), 'מחשב Linux'),
]
_UA_BROWSER = [
    (re.compile(r'Edg/'), 'Edge'),
    (re.compile(r'OPR/|Opera'), 'Opera'),
    (re.compile(r'CriOS|Chrome'), 'Chrome'),
    (re.compile(r'FxiOS|Firefox'), 'Firefox'),
    (re.compile(r'Safari'), 'Safari'),
]


def device_summary(ua):
    """Best-effort device/browser label from the User-Agent header. Browsers do
    NOT expose a real device name (e.g. "Osher's iPhone") to web pages for
    privacy reasons — this is the closest identifiable proxy available."""
    ua = ua or ''
    device = next((name for rx, name in _UA_DEVICE if rx.search(ua)), 'מכשיר לא מזוהה')
    browser = next((name for rx, name in _UA_BROWSER if rx.search(ua)), '')
    return ('%s · %s' % (device, browser)) if browser else device


def purge_old(conn, now):
    """Delete the visit trail older than RETENTION_DAYS, returning how many rows
    went. The caller owns the connection and the commit.

    Sessions are cut by last_seen and visits by their own timestamp, which cannot
    orphan anything: a visit is never newer than its session's last_seen, so a
    session old enough to delete has no surviving visits. A session still in use
    keeps its row and loses only the visits that aged out from under it."""
    if RETENTION_DAYS <= 0:
        return 0, 0
    cutoff = now - RETENTION_DAYS * 86400
    visits = conn.execute('DELETE FROM visits WHERE ts < ?', (cutoff,)).rowcount
    sessions = conn.execute('DELETE FROM sessions WHERE last_seen < ?', (cutoff,)).rowcount
    return visits, sessions


def _maybe_purge(conn, now):
    """Sweep at most once a day. This host has no scheduler, so the sweep rides
    along with ordinary traffic instead: two DELETEs, each driven by an index on
    the age column, so the day's unlucky request pays almost nothing and every
    other request pays a single indexed lookup of the last-sweep timestamp."""
    if RETENTION_DAYS <= 0:
        return
    row = conn.execute('SELECT last_ts FROM counters WHERE name=?', (_PURGE_MARK,)).fetchone()
    if row and row[0] and (now - row[0]) < _PURGE_EVERY:
        return
    purge_old(conn, now)
    conn.execute('INSERT INTO counters(name, n, last_ts) VALUES(?,1,?) '
                 'ON CONFLICT(name) DO UPDATE SET n = n + 1, last_ts = excluded.last_ts',
                 (_PURGE_MARK, now))


def track(session_id, ip, user_agent, path, title):
    if not session_id or not _SID_RE.match(session_id):
        return
    now = int(time.time())
    device = device_summary(user_agent)
    conn = _connect()
    try:
        row = conn.execute('SELECT 1 FROM sessions WHERE session_id=?', (session_id,)).fetchone()
        if row:
            conn.execute('UPDATE sessions SET last_seen=?, ip=?, user_agent=?, device=? WHERE session_id=?',
                         (now, ip, user_agent, device, session_id))
        else:
            conn.execute('INSERT INTO sessions(session_id, first_seen, last_seen, ip, user_agent, device) '
                         'VALUES(?,?,?,?,?,?)', (session_id, now, now, ip, user_agent, device))
        if path:
            conn.execute('INSERT INTO visits(session_id, ts, path, title) VALUES(?,?,?,?)',
                         (session_id, now, path[:200], (title or '')[:200]))
        _maybe_purge(conn, now)
        conn.commit()
    finally:
        conn.close()


def recent_sessions(limit=300):
    conn = _connect()
    try:
        rows = conn.execute('''SELECT session_id, first_seen, last_seen, ip, user_agent, device
            FROM sessions ORDER BY last_seen DESC LIMIT ?''', (limit,)).fetchall()
        out = []
        for session_id, first_seen, last_seen, ip, ua, device in rows:
            pages = conn.execute('''SELECT COALESCE(NULLIF(title,''), path) label, MAX(ts) last_ts, COUNT(*) c
                FROM visits WHERE session_id=? GROUP BY label ORDER BY last_ts''', (session_id,)).fetchall()
            out.append({
                'session_id': session_id, 'first_seen': first_seen, 'last_seen': last_seen,
                'duration': max(0, last_seen - first_seen), 'ip': ip or '', 'device': device or '',
                'user_agent': ua or '',
                'pages': [{'label': label, 'count': c} for label, _, c in pages],
            })
        return out
    finally:
        conn.close()


# ── WebAuthn (fingerprint/Face ID) credentials for the admin login ────────────
def wa_has_credential():
    conn = _connect()
    try:
        return conn.execute('SELECT 1 FROM webauthn_credentials LIMIT 1').fetchone() is not None
    finally:
        conn.close()


def wa_credential_ids():
    conn = _connect()
    try:
        return [r[0] for r in conn.execute('SELECT credential_id FROM webauthn_credentials').fetchall()]
    finally:
        conn.close()


def wa_add_credential(credential_id, public_key, sign_count):
    conn = _connect()
    try:
        conn.execute('INSERT OR REPLACE INTO webauthn_credentials(credential_id, public_key, sign_count, created) '
                     'VALUES(?,?,?,?)', (credential_id, public_key, sign_count, int(time.time())))
        conn.commit()
    finally:
        conn.close()


def wa_get_credential(credential_id):
    conn = _connect()
    try:
        row = conn.execute('SELECT public_key, sign_count FROM webauthn_credentials WHERE credential_id=?',
                            (credential_id,)).fetchone()
        return {'public_key': row[0], 'sign_count': row[1]} if row else None
    finally:
        conn.close()


def wa_update_sign_count(credential_id, sign_count):
    conn = _connect()
    try:
        conn.execute('UPDATE webauthn_credentials SET sign_count=? WHERE credential_id=?',
                     (sign_count, credential_id))
        conn.commit()
    finally:
        conn.close()


def bump_counter(name):
    """+1, and the moment it happened. Never raises: a counter must not be able to
    fail the thing it is counting."""
    try:
        conn = _connect()
        with conn:
            conn.execute('INSERT INTO counters(name, n, last_ts) VALUES (?,1,?) '
                         'ON CONFLICT(name) DO UPDATE SET n = n + 1, last_ts = excluded.last_ts',
                         (name, int(time.time())))
        conn.close()
    except Exception:
        pass


def counter(name):
    """(count, last timestamp) — zeros before anything was ever counted."""
    try:
        conn = _connect()
        r = conn.execute('SELECT n, last_ts FROM counters WHERE name=?', (name,)).fetchone()
        conn.close()
        return (r[0], r[1]) if r else (0, None)
    except Exception:
        return (0, None)
