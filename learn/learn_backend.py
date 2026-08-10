# -*- coding: utf-8 -*-
"""
Onyx לימודי — שרת למידה (Learning backend)
=================================================
Standalone Flask service for the multi-subject trainer. Runs independently
of the Torah web app so it can be deployed on its own (e.g. a Contabo VPS).

What it provides
----------------
* Student registration with a 6-digit confirmation code (email, or console
  in dev). The account stays unverified until the code is entered.
* Result syncing: the trainer POSTs each finished test here, keyed by phone.
* Parent tracking: a parent links to a student using the student's phone plus
  the "parent code" shown to the student at registration, then follows the
  student's progress remotely from the parent portal at /parent.

Storage is a single SQLite file (LEARN_DB, default learn.db). No external
services are required to run; SMS/e-mail are optional and pluggable.

Run locally:      python3 web/learn_backend.py
Environment:
  LEARN_DB           path to sqlite file (default: ./learn.db)
  LEARN_PORT         port (default: 8000)
  LEARN_DEV          "1" → verification codes are returned in the API
                     response and printed to the console (no e-mail needed)
  SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM
                     if set, confirmation codes are e-mailed via SMTP
"""
import os, re, json, sqlite3, smtplib, hashlib, secrets, time
from email.mime.text import MIMEText
from flask import Flask, Blueprint, request, jsonify, Response

DB_PATH = os.environ.get("LEARN_DB", os.path.join(os.path.dirname(__file__), "learn.db"))
DEV     = os.environ.get("LEARN_DEV", "0") == "1"   # fail-closed: codes go out by e-mail, not the API
PORT    = int(os.environ.get("LEARN_PORT", "8000"))
# Admin console. Locked to a single super-user password supplied through the
# environment — with no ADMIN_PASSWORD set the console refuses every login
# rather than falling back to a default, so a misconfigured deploy is closed,
# not open.
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ADMIN_USER     = os.environ.get("ADMIN_USER", "admin")

# Routes live on a Blueprint so this service can either run standalone
# (python3 web/learn_backend.py) or be mounted inside the unified onyx_app.
bp = Blueprint("learn", __name__)

# ─── Database ──────────────────────────────────────────────────────────────
def db():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS students(
            phone TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER,
            verified INTEGER DEFAULT 0,
            code TEXT,
            code_ts INTEGER,
            parent_code TEXT,
            email TEXT,
            created INTEGER,
            notify_child INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS results(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            subject TEXT,
            grade INTEGER,
            correct INTEGER,
            total INTEGER,
            ts INTEGER,
            dur INTEGER DEFAULT 0,
            detail TEXT
        );
        CREATE TABLE IF NOT EXISTS links(
            parent_phone TEXT NOT NULL,
            parent_name TEXT,
            parent_email TEXT,
            student_phone TEXT NOT NULL,
            created INTEGER,
            PRIMARY KEY(parent_phone, student_phone)
        );
        CREATE TABLE IF NOT EXISTS parent_tokens(
            token TEXT PRIMARY KEY,
            parent_phone TEXT NOT NULL,
            created INTEGER
        );
        -- daily time-on-task per student, in seconds, keyed by calendar day
        CREATE TABLE IF NOT EXISTS study_time(
            phone TEXT NOT NULL,
            day TEXT NOT NULL,
            seconds INTEGER DEFAULT 0,
            PRIMARY KEY(phone, day)
        );
        -- small key/value store (holds the server's VAPID keypair for web push)
        CREATE TABLE IF NOT EXISTS meta(
            k TEXT PRIMARY KEY,
            v TEXT
        );
        -- Product analytics for the admin console. One row per event; no
        -- personal content, only which kind of thing happened and when. The
        -- phone is kept so "how many distinct children" can be counted, and is
        -- never shown in full in the console.
        CREATE TABLE IF NOT EXISTS events(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            phone TEXT,
            day TEXT NOT NULL,
            meta TEXT,
            ts INTEGER NOT NULL
        );
        -- browser/phone push subscriptions. role='parent' → parent_phone set;
        -- role='child' → student_phone set (the student's own device).
        CREATE TABLE IF NOT EXISTS push_subs(
            endpoint TEXT PRIMARY KEY,
            parent_phone TEXT,
            student_phone TEXT,
            role TEXT DEFAULT 'parent',
            sub TEXT NOT NULL,
            created INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_results_phone ON results(phone);
        CREATE INDEX IF NOT EXISTS idx_ptok_phone ON parent_tokens(parent_phone);
        CREATE INDEX IF NOT EXISTS idx_time_phone ON study_time(phone);
        CREATE INDEX IF NOT EXISTS idx_events_day ON events(day, kind);
        CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, ts);
        """)
        # ── idempotent migrations for databases created before these columns ──
        for tbl, col, ddl in (
            ("results",  "dur",          "ALTER TABLE results ADD COLUMN dur INTEGER DEFAULT 0"),
            ("results",  "detail",       "ALTER TABLE results ADD COLUMN detail TEXT"),
            ("links",    "parent_email", "ALTER TABLE links ADD COLUMN parent_email TEXT"),
            # child-device push: reminders can also go to the student's own phone.
            # notify_child (on students) is controlled ONLY from the parent portal.
            ("students", "notify_child", "ALTER TABLE students ADD COLUMN notify_child INTEGER DEFAULT 1"),
            ("push_subs","role",         "ALTER TABLE push_subs ADD COLUMN role TEXT DEFAULT 'parent'"),
            ("push_subs","student_phone","ALTER TABLE push_subs ADD COLUMN student_phone TEXT"),
        ):
            cols = {r["name"] for r in c.execute(f"PRAGMA table_info({tbl})").fetchall()}
            if col not in cols:
                try: c.execute(ddl)
                except Exception as e: print(f"[learn] migration {tbl}.{col} skipped:", e)
    # generate/persist the web-push VAPID keypair now, while nothing else holds
    # a DB connection (avoids doing the one-time write during a live request)
    try: vapid_keys()
    except Exception: pass

# ─── Helpers ───────────────────────────────────────────────────────────────
PHONE_RE = re.compile(r"^\d{9,15}$")

def norm_phone(p):
    return re.sub(r"\D", "", p or "")

def gen_code():
    return f"{secrets.randbelow(1000000):06d}"

def gen_parent_code():
    # short, human-shareable
    return secrets.token_hex(3).upper()   # e.g. "3F9A2C"

def send_code(dest_email, phone, code):
    """E-mail the code if SMTP is configured; always log in dev."""
    host = os.environ.get("SMTP_HOST")
    if host and dest_email:
        try:
            msg = MIMEText(f"קוד האימות שלך ל-Onyx לימודי: {code}", "plain", "utf-8")
            msg["Subject"] = "קוד אימות — Onyx לימודי"
            msg["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "noreply@localhost"))
            msg["To"] = dest_email
            s = smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=15)
            s.starttls()
            if os.environ.get("SMTP_USER"):
                s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASS", ""))
            s.sendmail(msg["From"], [dest_email], msg.as_string())
            s.quit()
            return True
        except Exception as e:
            print("[learn] SMTP send failed:", e)
    if DEV:
        print(f"[learn] verification code for {phone}: {code}")
    return False

def send_email(dest_email, subject, body):
    """Send a plain-text e-mail if SMTP is configured; log in dev. Returns True
    only when the message was actually handed to an SMTP server."""
    host = os.environ.get("SMTP_HOST")
    if host and dest_email:
        try:
            msg = MIMEText(body, "plain", "utf-8")
            msg["Subject"] = subject
            msg["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "noreply@localhost"))
            msg["To"] = dest_email
            s = smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=15)
            s.starttls()
            if os.environ.get("SMTP_USER"):
                s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASS", ""))
            s.sendmail(msg["From"], [dest_email], msg.as_string())
            s.quit()
            return True
        except Exception as e:
            print("[learn] SMTP send failed:", e)
    if DEV:
        print(f"[learn] (would e-mail {dest_email}) {subject}: {body}")
    return False

def jerr(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code

# ─── Brute-force throttle ──────────────────────────────────────────────────
# The parent code is a short string, so the endpoints that check one (or that
# hand one out) have to be slow to guess against. A sliding window per
# (bucket, key) held in memory — the service is a single process, so this is
# enough; it only needs to make an online guessing attack impractical.
_HITS = {}

def rate_ok(bucket, key, limit, window=600):
    """True if this (bucket,key) is still under `limit` hits per `window` s."""
    now = time.time()
    k = (bucket, key)
    q = [t for t in _HITS.get(k, ()) if now - t < window]
    if len(_HITS) > 5000:            # cheap upper bound on memory
        for kk in [kk for kk, v in _HITS.items() if not v or now - v[-1] > window]:
            _HITS.pop(kk, None)
    if len(q) >= limit:
        _HITS[k] = q
        return False
    q.append(now)
    _HITS[k] = q
    return True

def client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    return (fwd.split(",")[0].strip() if fwd else request.remote_addr) or "?"

# ─── Web Push (phone notifications, work with the screen locked) ────────────
# We keep a single VAPID keypair for the server: from env if provided, else
# generated once and persisted in the `meta` table so it stays stable across
# restarts (subscriptions are bound to the key). Generating + the subscribe
# flow need only `cryptography`; actually *sending* a push needs `pywebpush`
# (optional — if it's not installed we simply fall back to e-mail).
VAPID_SUB = os.environ.get("VAPID_SUB", "mailto:no-reply@onyx-study.com")

def _meta_get(c, k):
    r = c.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
    return r["v"] if r else None

def _meta_set(c, k, v):
    c.execute("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, v))

_VAPID_CACHE = None   # (priv, pub) once resolved — avoids re-hitting the DB/crypto per call

def vapid_keys():
    """Return (private_pem, public_b64url). Env wins; otherwise persist a
    generated pair in the DB. Returns (None, None) if crypto is unavailable."""
    global _VAPID_CACHE
    if _VAPID_CACHE is not None:
        return _VAPID_CACHE
    priv = os.environ.get("VAPID_PRIVATE")
    pub  = os.environ.get("VAPID_PUBLIC")
    if priv and pub:
        _VAPID_CACHE = (priv, pub)
        return _VAPID_CACHE
    with db() as c:
        priv = _meta_get(c, "vapid_private")
        pub  = _meta_get(c, "vapid_public")
        if priv and pub:
            _VAPID_CACHE = (priv, pub)
            return _VAPID_CACHE
        try:
            from cryptography.hazmat.primitives.asymmetric import ec
            from cryptography.hazmat.primitives import serialization
            import base64
            k = ec.generate_private_key(ec.SECP256R1())
            priv = k.private_bytes(serialization.Encoding.PEM,
                                   serialization.PrivateFormat.PKCS8,
                                   serialization.NoEncryption()).decode()
            raw = k.public_key().public_bytes(serialization.Encoding.X962,
                                              serialization.PublicFormat.UncompressedPoint)
            pub = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
            _meta_set(c, "vapid_private", priv); _meta_set(c, "vapid_public", pub)
            _VAPID_CACHE = (priv, pub)
            return _VAPID_CACHE
        except BaseException as e:   # crypto backend can fail hard (rust panic) — never 500
            print("[learn] VAPID key generation failed (no push):", e)
            _VAPID_CACHE = (None, None)
            return _VAPID_CACHE

def send_push(sub_json, title, body, url="/parent"):
    """Deliver one web-push notification. Returns True on success. Silently
    returns False (and prunes dead subscriptions upstream) when pywebpush is
    missing or the endpoint is gone."""
    priv, _ = vapid_keys()
    if not priv:
        return False
    try:
        from pywebpush import webpush, WebPushException
    except Exception:
        if DEV: print("[learn] pywebpush not installed — cannot send push")
        return False
    try:
        webpush(subscription_info=json.loads(sub_json) if isinstance(sub_json, str) else sub_json,
                data=json.dumps({"title": title, "body": body, "url": url}, ensure_ascii=False),
                vapid_private_key=priv,
                vapid_claims={"sub": VAPID_SUB})
        return True
    except BaseException as e:   # includes rust-panic from a broken crypto backend
        # 404/410 → the subscription is dead; caller removes it
        code = getattr(getattr(e, "response", None), "status_code", None)
        if code in (404, 410):
            try:
                with db() as c:
                    ep = (json.loads(sub_json) if isinstance(sub_json, str) else sub_json).get("endpoint")
                    if ep: c.execute("DELETE FROM push_subs WHERE endpoint=?", (ep,))
            except Exception: pass
        elif DEV:
            print("[learn] push send failed:", e)
        return False

def notify_parent(c, pphone, title, body, url="/parent", email=None, email_body=None):
    """Prefer a phone push; fall back to e-mail if the parent has no live
    push subscription. Returns the channel used ('push'/'email'/'none')."""
    subs = c.execute("SELECT sub FROM push_subs WHERE parent_phone=?", (pphone,)).fetchall()
    if any(send_push(s["sub"], title, body, url) for s in subs):
        return "push"
    if email and send_email(email, title, email_body or body):
        return "email"
    return "none"

# ─── Parent access tokens ──────────────────────────────────────────────────
# A parent proves ownership once (by knowing a student's parent_code at link
# time) and receives a bearer token. Reads of student PII (progress, the
# parent dashboard) then require that token — no more anonymous access by
# phone number.
def new_parent_token(pphone):
    tok = secrets.token_urlsafe(24)
    with db() as c:
        c.execute("INSERT INTO parent_tokens(token,parent_phone,created) VALUES(?,?,?)",
                  (tok, pphone, int(time.time())))
    return tok

def parent_from_token(tok):
    if not tok:
        return None
    with db() as c:
        row = c.execute("SELECT parent_phone FROM parent_tokens WHERE token=?", (tok,)).fetchone()
    return row["parent_phone"] if row else None

def read_token():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return (request.args.get("token") or "").strip()

# ─── Student registration & verification ───────────────────────────────────
@bp.route("/api/register", methods=["POST"])
def register():
    d = request.get_json(silent=True) or {}
    phone = norm_phone(d.get("phone"))
    name  = (d.get("name") or "").strip()
    age   = int(d.get("age") or 0)
    email = (d.get("email") or "").strip()
    if not name:            return jerr("missing name")
    if not PHONE_RE.match(phone): return jerr("invalid phone")
    if not rate_ok("register", client_ip(), 20) or not rate_ok("register", phone, 10):
        return jerr("too many attempts, try again later", 429)
    code = gen_code()
    now = int(time.time())
    with db() as c:
        row = c.execute("SELECT phone, name, age, verified, parent_code FROM students WHERE phone=?",
                        (phone,)).fetchone()
        if row:
            # An account already exists for this phone. The parent code is the
            # only credential guarding the child's whole file, so a bare phone
            # number must never be enough to obtain it — the caller also has to
            # know the registered name (the same shared secret /api/student/
            # results is guarded by). A mismatch is answered without the code,
            # and the stored name is left alone so nobody can rewrite their way
            # in by re-registering someone else's number under their own name.
            if (row["name"] or "").strip() != name:
                return jsonify({"ok": True, "exists": True})
            if age or email:
                c.execute("UPDATE students SET age=COALESCE(NULLIF(?,0),age),"
                          " email=COALESCE(NULLIF(?,''),email) WHERE phone=?", (age, email, phone))
            return jsonify({"ok": True, "already": True, "parent_code": row["parent_code"]})
        parent_code = gen_parent_code()
        c.execute("""INSERT INTO students(phone,name,age,verified,code,code_ts,parent_code,email,created)
                     VALUES(?,?,?,0,?,?,?,?,?)""",
                  (phone, name, age, code, now, parent_code, email, now))
    send_code(email, phone, code)
    out = {"ok": True, "parent_code": parent_code}
    if DEV:
        out["dev_code"] = code
    return jsonify(out)

@bp.route("/api/verify", methods=["POST"])
def verify():
    d = request.get_json(silent=True) or {}
    phone = norm_phone(d.get("phone"))
    code  = (d.get("code") or "").strip()
    with db() as c:
        row = c.execute("SELECT code, code_ts FROM students WHERE phone=?", (phone,)).fetchone()
        if not row:            return jerr("unknown phone", 404)
        if row["verified"] if "verified" in row.keys() else False:
            return jsonify({"ok": True, "already": True})
        if not row["code"] or code != row["code"]:
            return jerr("wrong code", 401)
        if int(time.time()) - (row["code_ts"] or 0) > 3600:
            return jerr("code expired", 410)
        c.execute("UPDATE students SET verified=1, code=NULL WHERE phone=?", (phone,))
        pc = c.execute("SELECT parent_code FROM students WHERE phone=?", (phone,)).fetchone()["parent_code"]
    return jsonify({"ok": True, "parent_code": pc})

@bp.route("/api/resend", methods=["POST"])
def resend():
    d = request.get_json(silent=True) or {}
    phone = norm_phone(d.get("phone"))
    code = gen_code()
    with db() as c:
        row = c.execute("SELECT email,verified FROM students WHERE phone=?", (phone,)).fetchone()
        if not row:  return jerr("unknown phone", 404)
        if row["verified"]: return jsonify({"ok": True, "already": True})
        c.execute("UPDATE students SET code=?, code_ts=? WHERE phone=?", (code, int(time.time()), phone))
        email = row["email"]
    send_code(email, phone, code)
    out = {"ok": True}
    if DEV: out["dev_code"] = code
    return jsonify(out)

# ─── Results sync ──────────────────────────────────────────────────────────
@bp.route("/api/student/results")
def student_results():
    # A student fetches their OWN results on any device. Guarded by knowing
    # BOTH the phone and the exact registered name (a light shared secret) —
    # so results follow the child across devices without exposing them to a
    # bare phone-number lookup.
    phone = norm_phone(request.args.get("phone"))
    name  = (request.args.get("name") or "").strip()
    if not PHONE_RE.match(phone) or not name:
        return jerr("phone and name required", 400)
    with db() as c:
        st = c.execute("SELECT name FROM students WHERE phone=?", (phone,)).fetchone()
        if not st:
            return jerr("not found", 404)
        if (st["name"] or "").strip() != name:
            return jerr("name does not match", 403)
        rows = [dict(r) for r in c.execute(
            "SELECT subject,grade,correct,total,ts FROM results WHERE phone=? ORDER BY ts DESC LIMIT 60",
            (phone,)).fetchall()]
    return jsonify({"ok": True, "name": st["name"], "results": rows})

@bp.route("/api/results", methods=["POST"])
def post_result():
    d = request.get_json(silent=True) or {}
    phone = norm_phone(d.get("phone"))
    if not PHONE_RE.match(phone): return jerr("invalid phone")
    subject = (d.get("subject") or "english")[:20]
    grade   = int(d.get("grade") or 0)
    correct = int(d.get("correct") or 0)
    total   = int(d.get("total") or 0)
    ts      = int(d.get("ts") or time.time()*1000)
    dur     = max(0, min(int(d.get("dur") or 0), 24*3600))   # seconds, sane cap
    detail  = d.get("detail")
    # Per-question log: a compact list the parent can drill into. Cap its size
    # so a malformed client can't bloat the row; store as JSON text.
    detail_json = None
    if isinstance(detail, list) and detail:
        detail_json = json.dumps(detail[:80], ensure_ascii=False)[:20000]
    with db() as c:
        if not c.execute("SELECT 1 FROM students WHERE phone=?", (phone,)).fetchone():
            return jerr("register first", 404)
        c.execute("INSERT INTO results(phone,subject,grade,correct,total,ts,dur,detail) VALUES(?,?,?,?,?,?,?,?)",
                  (phone, subject, grade, correct, total, ts, dur, detail_json))
    return jsonify({"ok": True})

# ─── Daily time-on-task sync ───────────────────────────────────────────────
@bp.route("/api/time", methods=["POST"])
def post_time():
    # The trainer reports cumulative seconds-per-day for the student. We keep
    # the MAX seen per day so repeated syncs (or a re-opened app) never shrink
    # a day's total. Days are "YYYY-MM-DD" strings in the child's local zone.
    d = request.get_json(silent=True) or {}
    phone = norm_phone(d.get("phone"))
    days  = d.get("days") or {}
    if not PHONE_RE.match(phone):   return jerr("invalid phone")
    if not isinstance(days, dict):  return jerr("days must be an object")
    with db() as c:
        if not c.execute("SELECT 1 FROM students WHERE phone=?", (phone,)).fetchone():
            return jerr("register first", 404)
        for day, sec in list(days.items())[:60]:
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(day)): continue
            sec = max(0, min(int(sec or 0), 24*3600))
            c.execute("""INSERT INTO study_time(phone,day,seconds) VALUES(?,?,?)
                         ON CONFLICT(phone,day) DO UPDATE SET seconds=MAX(seconds,excluded.seconds)""",
                      (phone, str(day), sec))
    return jsonify({"ok": True})

def _stats(rows):
    out = {}
    for r in rows:
        s = r["subject"] or "english"
        out.setdefault(s, {"count": 0, "best": 0, "avg": 0, "_sum": 0})
        b = out[s]; b["count"] += 1; b["_sum"] += r["grade"]; b["best"] = max(b["best"], r["grade"])
    for s in out:
        b = out[s]; b["avg"] = round(b["_sum"] / b["count"]); del b["_sum"]
    return out

@bp.route("/api/progress")
def progress():
    # a parent may read a student's progress only with a valid token AND only
    # for a student linked to that parent — never anonymous access by phone.
    pphone = parent_from_token(read_token())
    if not pphone:
        return jerr("unauthorized", 401)
    phone = norm_phone(request.args.get("phone"))
    with db() as c:
        linked = c.execute("SELECT 1 FROM links WHERE parent_phone=? AND student_phone=?",
                           (pphone, phone)).fetchone()
        if not linked:
            return jerr("forbidden — not your student", 403)
        rows = c.execute("SELECT subject,grade,correct,total,ts FROM results WHERE phone=? ORDER BY ts DESC LIMIT 100", (phone,)).fetchall()
    rows = [dict(r) for r in rows]
    return jsonify({"ok": True, "results": rows, "stats": _stats(rows)})

# ─── Parent linking & portal ───────────────────────────────────────────────
@bp.route("/api/parent/link", methods=["POST"])
def parent_link():
    d = request.get_json(silent=True) or {}
    pphone = norm_phone(d.get("parent_phone"))
    pname  = (d.get("parent_name") or "").strip()
    pemail = (d.get("parent_email") or "").strip()[:120]
    sphone = norm_phone(d.get("student_phone"))
    pcode  = (d.get("parent_code") or "").strip().upper()
    if not PHONE_RE.match(pphone): return jerr("invalid parent phone")
    # The parent code is short, so guessing has to be throttled: cap attempts
    # both per calling address and per student account being targeted.
    if not rate_ok("link", client_ip(), 15) or not rate_ok("link", sphone, 10):
        return jerr("too many attempts, try again later", 429)
    with db() as c:
        st = c.execute("SELECT parent_code,name FROM students WHERE phone=?", (sphone,)).fetchone()
        if not st:                       return jerr("student not found", 404)
        if not pcode or not secrets.compare_digest(str(st["parent_code"] or ""), pcode):
            return jerr("wrong parent code", 401)
        c.execute("""INSERT OR REPLACE INTO links(parent_phone,parent_name,parent_email,student_phone,created)
                     VALUES(?,?,?,?,?)""", (pphone, pname, pemail, sphone, int(time.time())))
    log_event("parent_link", sphone)
    # proven ownership of a parent_code → hand out an access token for reads
    token = new_parent_token(pphone)
    return jsonify({"ok": True, "student_name": st["name"], "token": token})

@bp.route("/api/parent/students")
def parent_students():
    # authorised by the bearer token issued at link time — not by a raw phone
    pphone = parent_from_token(read_token())
    if not pphone:
        return jerr("unauthorized — link a student first", 401)
    with db() as c:
        links = c.execute("SELECT student_phone FROM links WHERE parent_phone=?", (pphone,)).fetchall()
        out = []
        for l in links:
            sp = l["student_phone"]
            st = c.execute("SELECT name,age,notify_child FROM students WHERE phone=?", (sp,)).fetchone()
            rows = [dict(r) for r in c.execute(
                "SELECT id,subject,grade,correct,total,ts,dur FROM results WHERE phone=? ORDER BY ts DESC LIMIT 50",
                (sp,)).fetchall()]
            last = rows[0]["ts"] if rows else None
            # daily time-on-task for the last 30 days (minutes rendered client-side)
            tm = [dict(r) for r in c.execute(
                "SELECT day,seconds FROM study_time WHERE phone=? ORDER BY day DESC LIMIT 30", (sp,)).fetchall()]
            inactive = None
            if last:
                inactive = max(0, int((time.time()*1000 - last) // 86400000))
            # grade trend: oldest→newest, for the line chart (subject + score)
            trend = [{"ts": r["ts"], "g": r["grade"], "subject": r["subject"]}
                     for r in reversed(rows)]
            # is the child's device even registered for pushes?
            child_subs = c.execute("SELECT COUNT(*) n FROM push_subs WHERE role='child' AND student_phone=?", (sp,)).fetchone()["n"]
            out.append({"phone": sp, "name": st["name"] if st else sp, "age": st["age"] if st else None,
                        "stats": _stats(rows), "last": last, "recent": rows[:10],
                        "time": tm, "inactive_days": inactive, "trend": trend,
                        "notify_child": (st["notify_child"] if st and st["notify_child"] is not None else 1),
                        "child_device": bool(child_subs)})
    return jsonify({"ok": True, "students": out})

@bp.route("/api/parent/result")
def parent_result():
    # Drill into a single test: the exact questions asked and what the child
    # answered. Guarded by the parent token AND by the result belonging to a
    # student linked to that parent.
    pphone = parent_from_token(read_token())
    if not pphone:
        return jerr("unauthorized", 401)
    try:    rid = int(request.args.get("id") or 0)
    except (TypeError, ValueError): return jerr("bad id")
    with db() as c:
        r = c.execute("SELECT * FROM results WHERE id=?", (rid,)).fetchone()
        if not r: return jerr("not found", 404)
        linked = c.execute("SELECT 1 FROM links WHERE parent_phone=? AND student_phone=?",
                           (pphone, r["phone"])).fetchone()
        if not linked:
            return jerr("forbidden — not your student", 403)
    try:    detail = json.loads(r["detail"]) if r["detail"] else []
    except Exception: detail = []
    return jsonify({"ok": True, "subject": r["subject"], "grade": r["grade"],
                    "correct": r["correct"], "total": r["total"], "ts": r["ts"],
                    "dur": r["dur"] or 0, "detail": detail})

@bp.route("/parent")
def parent_portal():
    log_event("parent_open")
    return Response(PARENT_HTML, mimetype="text/html")

PRIVACY_HTML = """<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>מדיניות פרטיות — Onyx לימודי</title>
<style>
 body{font-family:system-ui,'Segoe UI',Arial,sans-serif;background:#f6f4ff;color:#26203a;margin:0;line-height:1.7}
 .wrap{max-width:760px;margin:0 auto;padding:26px 20px 60px}
 h1{font-size:26px;margin:6px 0 2px}
 h2{font-size:19px;margin:26px 0 6px;color:#5a3fd0}
 .upd{opacity:.65;font-size:13px;margin-bottom:8px}
 p,li{font-size:15px}
 ul{padding-inline-start:22px}
 a{color:#6C5CE7}
 .box{background:#fff;border:1px solid #e6e0fb;border-radius:14px;padding:14px 18px;margin-top:14px}
</style></head><body><div class="wrap">
 <h1>מדיניות פרטיות — Onyx לימודי</h1>
 <div class="upd">מעודכן: אוגוסט 2026</div>
 <p>אפליקציית <b>Onyx לימודי</b> ("האפליקציה", "אנחנו") היא כלי תרגול לימודי לילדים
 עם מעקב הורים. אנו מכבדים את פרטיותכם ואוספים אך ורק את המידע הדרוש להפעלת השירות.</p>

 <h2>איזה מידע אנו אוספים</h2>
 <ul>
   <li><b>פרטי תלמיד/ה:</b> שם, גיל ומספר טלפון (משמש כמזהה חשבון).</li>
   <li><b>נתוני למידה:</b> תוצאות מבחנים (מקצוע, ציון, מספר תשובות נכונות), זמן
       תרגול יומי, והשאלות והתשובות שהוזנו — לצורך מעקב ושיפור.</li>
   <li><b>פרטי הורה:</b> מספר טלפון, ואימייל (אופציונלי) לצורך תזכורות.</li>
   <li><b>התראות:</b> אם אישרתם התראות, נשמר מזהה מנוי הדחיפה של הדפדפן/המכשיר.</li>
   <li><b>אימות:</b> קוד חד-פעמי הנשלח באימייל לאימות ההרשמה.</li>
 </ul>
 <p>איננו אוספים מיקום, אנשי קשר, תמונות או מזהי פרסום, ואיננו כוללים פרסומות.</p>

 <h2>למה אנו משתמשים במידע</h2>
 <ul>
   <li>לשמור ולהציג את התקדמות הלמידה של התלמיד/ה בין מכשירים.</li>
   <li>לאפשר להורה לעקוב אחר ההתקדמות (עם קוד ההורה שקיבל התלמיד/ה).</li>
   <li>לשלוח תזכורות תרגול (דחיפה למכשיר או אימייל) — לפי בחירת ההורה.</li>
 </ul>

 <h2>שיתוף עם צדדים שלישיים</h2>
 <p>איננו מוכרים ואיננו משתפים מידע אישי עם צדדים שלישיים לצורכי שיווק. המידע נשמר
 בשרת שלנו ומשמש אך ורק להפעלת השירות. שליחת אימייל/דחיפה מתבצעת דרך ספקי תשתית
 לצורך המסירה בלבד.</p>

 <h2>פרטיות ילדים</h2>
 <p>האפליקציה מיועדת לשימוש בליווי הורה/מורה. ההרשמה והקישור להורה נעשים בידיעת
 ההורה, וההורה יכול לבקש בכל עת לצפות בנתוני הילד/ה, לעדכן או למחוק אותם.</p>

 <h2>אבטחה ושמירת מידע</h2>
 <p>הגישה נעשית דרך חיבור מוצפן (HTTPS). גישת הורה מוגנת באמצעות אסימון (token)
 המונפק רק לאחר הזנת קוד ההורה. אנו שומרים את המידע כל עוד החשבון פעיל.</p>

 <h2>הזכויות שלכם</h2>
 <p>ניתן לבקש גישה, תיקון או מחיקה של המידע. לפנייה: <a href="mailto:support@onyx-study.com">support@onyx-study.com</a>.
 בקשת מחיקה תסיר את החשבון ונתוני הלמידה המשויכים אליו.</p>

 <h2>שינויים במדיניות</h2>
 <p>נעדכן דף זה במקרה של שינוי. המשך השימוש לאחר עדכון מהווה הסכמה למדיניות המעודכנת.</p>

 <div class="box">שאלות? צרו קשר: <a href="mailto:support@onyx-study.com">support@onyx-study.com</a></div>
</div></body></html>"""

@bp.route("/privacy")
def privacy():
    return Response(PRIVACY_HTML, mimetype="text/html")

# ─── Product analytics + admin console ─────────────────────────────────────
# The app posts small, content-free events here (a screen was opened, the
# install button was pressed, a test was finished). They answer "how much is
# this being used" without recording anything a child typed.
EVENT_KINDS = {
    "open",            # the app was opened
    "install_click",   # the install button was pressed
    "install_done",    # the browser reported the app was installed
    "test_start",
    "test_done",
    "parent_open",     # the parent portal was opened
    "parent_link",     # a parent linked to a child
}

def log_event(kind, phone=None, meta=None):
    if kind not in EVENT_KINDS:
        return
    now = int(time.time())
    day = time.strftime("%Y-%m-%d", time.localtime(now))
    try:
        with db() as c:
            c.execute("INSERT INTO events(kind,phone,day,meta,ts) VALUES(?,?,?,?,?)",
                      (kind, norm_phone(phone) if phone else None, day,
                       (str(meta)[:120] if meta else None), now))
    except Exception:
        pass          # analytics must never break a child's lesson

@bp.route("/api/event", methods=["POST"])
def api_event():
    d = request.get_json(silent=True) or {}
    kind = (d.get("kind") or "").strip()
    if kind not in EVENT_KINDS:
        return jerr("unknown event")
    # one address can only file so many events; a stuck client cannot flood the table
    if not rate_ok("event", client_ip(), 240, 3600):
        return jsonify({"ok": True, "throttled": True})
    log_event(kind, d.get("phone"), d.get("meta"))
    return jsonify({"ok": True})

# ── super-user auth ────────────────────────────────────────────────────────
def admin_from_token(tok):
    if not tok:
        return False
    with db() as c:
        row = c.execute("SELECT v FROM meta WHERE k=?", ("admin_tok:" + tok,)).fetchone()
    if not row:
        return False
    try:
        return int(row["v"]) > int(time.time())
    except Exception:
        return False

def require_admin():
    return admin_from_token(read_token())

@bp.route("/api/admin/login", methods=["POST"])
def admin_login():
    d = request.get_json(silent=True) or {}
    user = (d.get("user") or "").strip()
    pw   = d.get("password") or ""
    # Fail closed: an unset ADMIN_PASSWORD means the console is disabled, not open.
    if not ADMIN_PASSWORD:
        return jerr("admin console is not configured", 503)
    if not rate_ok("admin", client_ip(), 8, 900):
        return jerr("too many attempts, try again later", 429)
    ok = secrets.compare_digest(user, ADMIN_USER) and secrets.compare_digest(pw, ADMIN_PASSWORD)
    if not ok:
        return jerr("wrong user or password", 401)
    tok = secrets.token_urlsafe(24)
    with db() as c:
        c.execute("INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)",
                  ("admin_tok:" + tok, str(int(time.time()) + 12 * 3600)))
        # drop expired tokens so the table does not grow without bound
        now = int(time.time())
        for r in c.execute("SELECT k,v FROM meta WHERE k LIKE 'admin_tok:%'").fetchall():
            try:
                if int(r["v"]) < now:
                    c.execute("DELETE FROM meta WHERE k=?", (r["k"],))
            except Exception:
                pass
    return jsonify({"ok": True, "token": tok})

@bp.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    tok = read_token()
    if tok:
        with db() as c:
            c.execute("DELETE FROM meta WHERE k=?", ("admin_tok:" + tok,))
    return jsonify({"ok": True})

@bp.route("/api/admin/stats")
def admin_stats():
    if not require_admin():
        return jerr("unauthorized", 401)
    days = max(1, min(180, int(request.args.get("days") or 30)))
    since = int(time.time()) - days * 86400
    since_day = time.strftime("%Y-%m-%d", time.localtime(since))
    with db() as c:
        one = lambda q, *a: (c.execute(q, a).fetchone() or [0])[0]
        totals = {
            "students":       one("SELECT COUNT(*) FROM students"),
            "students_new":   one("SELECT COUNT(*) FROM students WHERE created>=?", since),
            "parents":        one("SELECT COUNT(DISTINCT parent_phone) FROM links"),
            "links":          one("SELECT COUNT(*) FROM links"),
            "tests":          one("SELECT COUNT(*) FROM results"),
            "tests_period":   one("SELECT COUNT(*) FROM results WHERE ts>=?", since * 1000),
            "push_subs":      one("SELECT COUNT(*) FROM push_subs"),
            "study_hours":    round((one("SELECT COALESCE(SUM(seconds),0) FROM study_time") or 0) / 3600.0, 1),
            "install_clicks": one("SELECT COUNT(*) FROM events WHERE kind='install_click'"),
            "install_done":   one("SELECT COUNT(*) FROM events WHERE kind='install_done'"),
            "install_clicks_period": one("SELECT COUNT(*) FROM events WHERE kind='install_click' AND day>=?", since_day),
            "app_opens_period":      one("SELECT COUNT(*) FROM events WHERE kind='open' AND day>=?", since_day),
        }
        # how many DISTINCT devices pressed install, not how many presses
        totals["install_devices"] = one(
            "SELECT COUNT(DISTINCT COALESCE(phone,'?')) FROM events WHERE kind='install_click' AND phone IS NOT NULL")

        by_kind = {r["kind"]: r["n"] for r in c.execute(
            "SELECT kind, COUNT(*) n FROM events WHERE day>=? GROUP BY kind", (since_day,)).fetchall()}

        daily = [dict(r) for r in c.execute(
            """SELECT day,
                      SUM(kind='open')          opens,
                      SUM(kind='install_click') installs,
                      SUM(kind='test_done')     tests
               FROM events WHERE day>=? GROUP BY day ORDER BY day""", (since_day,)).fetchall()]

        active = [dict(r) for r in c.execute(
            """SELECT day, COUNT(DISTINCT phone) n FROM study_time
               WHERE day>=? AND seconds>0 GROUP BY day ORDER BY day""", (since_day,)).fetchall()]

        subjects = [dict(r) for r in c.execute(
            """SELECT subject, COUNT(*) n, ROUND(AVG(grade),1) avg_grade
               FROM results WHERE ts>=? GROUP BY subject ORDER BY n DESC""", (since * 1000,)).fetchall()]

        # Roster, de-identified: the console shows how much each account is used,
        # never the child's answers. The phone is masked to its last three digits.
        roster = [dict(r) for r in c.execute(
            """SELECT s.name, s.age, s.phone, s.created,
                      (SELECT COUNT(*) FROM results r WHERE r.phone=s.phone) tests,
                      (SELECT MAX(ts)   FROM results r WHERE r.phone=s.phone) last_ts,
                      (SELECT COALESCE(SUM(seconds),0) FROM study_time t WHERE t.phone=s.phone) secs,
                      (SELECT COUNT(*) FROM links l WHERE l.student_phone=s.phone) parents
               FROM students s ORDER BY s.created DESC LIMIT 200""").fetchall()]
    for r in roster:
        p = r.pop("phone", "") or ""
        r["phone_tail"] = p[-3:] if len(p) >= 3 else "?"
        r["minutes"] = round((r.pop("secs", 0) or 0) / 60.0)
    return jsonify({"ok": True, "days": days, "totals": totals, "by_kind": by_kind,
                    "daily": daily, "active": active, "subjects": subjects, "roster": roster})


# Service worker for the parent portal — receives phone push notifications and
# opens the portal when tapped (works with the screen locked).
PARENT_SW = """
const PCACHE = 'onyx-parent-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(PCACHE)
    .then(c => c.addAll(['/parent', '/static/img/onyx_learn_icon-192.png', '/static/img/onyx_learn_icon-512.png']))
    .then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== PCACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;   // live data always hits network
  if (u.pathname === '/parent' || u.pathname.startsWith('/static/img/')) {
    e.respondWith(
      fetch(e.request).then(resp => { const c = resp.clone(); caches.open(PCACHE).then(x => x.put(e.request, c)); return resp; })
        .catch(() => caches.match(e.request).then(hit => hit || caches.match('/parent')))
    );
  }
});
self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data.json(); } catch(_) { d = { title:'Onyx לימודי', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Onyx לימודי', {
    body: d.body || '', dir: 'rtl', lang: 'he', tag: 'onyx-reminder',
    renotify: true, data: { url: d.url || '/parent' }
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/parent';
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(cl){
    for (var i=0;i<cl.length;i++){ if (cl[i].url.indexOf('/parent')>=0 && 'focus' in cl[i]) return cl[i].focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
"""

@bp.route("/parent-sw.js")
def parent_sw():
    resp = Response(PARENT_SW, mimetype="application/javascript")
    resp.headers["Service-Worker-Allowed"] = "/"
    resp.headers["Cache-Control"] = "no-cache"
    return resp

@bp.route("/parent.webmanifest")
def parent_manifest():
    # Lets the parent portal be installed to the home screen as its own app.
    return jsonify({
        "name": "מעקב הורים — Onyx לימודי",
        "short_name": "מעקב הורים",
        "description": "מעקב אחר התקדמות התלמידים מרחוק",
        "start_url": "/parent",
        "scope": "/parent",
        "display": "standalone",
        "orientation": "portrait",
        "lang": "he", "dir": "rtl",
        "background_color": "#EAF7FB",
        "theme_color": "#6C5CE7",
        "icons": [
            {"src": "/static/img/onyx_learn_icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "/static/img/onyx_learn_icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        ],
    })

@bp.route("/api/leaderboard")
def leaderboard():
    subject = (request.args.get("subject") or "").strip()[:20]
    with db() as c:
        if subject:
            rows = c.execute(
                "SELECT s.name AS name, MAX(r.grade) AS g, COUNT(r.id) AS n "
                "FROM results r JOIN students s ON s.phone=r.phone "
                "WHERE r.subject=? GROUP BY r.phone ORDER BY g DESC, n DESC LIMIT 20",
                (subject,)).fetchall()
        else:
            rows = c.execute(
                "SELECT s.name AS name, MAX(r.grade) AS g, COUNT(r.id) AS n "
                "FROM results r JOIN students s ON s.phone=r.phone "
                "GROUP BY r.phone ORDER BY g DESC, n DESC LIMIT 20").fetchall()
    # first name only (privacy for minors)
    top = [{"name": (r["name"] or "").split(" ")[0], "grade": r["g"], "tests": r["n"]} for r in rows]
    return jsonify({"ok": True, "top": top})

@bp.route("/api/push/vapid")
def push_vapid():
    _, pub = vapid_keys()
    if not pub:
        return jerr("push unavailable", 503)
    return jsonify({"ok": True, "publicKey": pub})

@bp.route("/api/parent/push/subscribe", methods=["POST"])
def push_subscribe():
    pphone = parent_from_token(read_token())
    if not pphone:
        return jerr("unauthorized", 401)
    d = request.get_json(silent=True) or {}
    sub = d.get("subscription") or d
    endpoint = (sub or {}).get("endpoint")
    if not endpoint:
        return jerr("missing endpoint")
    with db() as c:
        c.execute("""INSERT INTO push_subs(endpoint,parent_phone,sub,created) VALUES(?,?,?,?)
                     ON CONFLICT(endpoint) DO UPDATE SET parent_phone=excluded.parent_phone, sub=excluded.sub""",
                  (endpoint, pphone, json.dumps(sub), int(time.time())))
    return jsonify({"ok": True})

@bp.route("/api/parent/push/unsubscribe", methods=["POST"])
def push_unsubscribe():
    pphone = parent_from_token(read_token())
    if not pphone:
        return jerr("unauthorized", 401)
    d = request.get_json(silent=True) or {}
    endpoint = d.get("endpoint")
    with db() as c:
        if endpoint:
            c.execute("DELETE FROM push_subs WHERE endpoint=? AND parent_phone=?", (endpoint, pphone))
        else:
            c.execute("DELETE FROM push_subs WHERE parent_phone=?", (pphone,))
    return jsonify({"ok": True})

@bp.route("/api/student/push/subscribe", methods=["POST"])
def student_push_subscribe():
    # The trainer (child device) registers itself for reminder pushes. Guarded
    # by the student's phone + exact registered name (the same light secret used
    # for cross-device result sync). There is deliberately NO child-side way to
    # turn this off — only the parent controls delivery (see notify_child).
    d = request.get_json(silent=True) or {}
    phone = norm_phone(d.get("phone"))
    name  = (d.get("name") or "").strip()
    sub   = d.get("subscription") or {}
    endpoint = (sub or {}).get("endpoint")
    if not PHONE_RE.match(phone) or not name:
        return jerr("phone and name required")
    if not endpoint:
        return jerr("missing endpoint")
    with db() as c:
        st = c.execute("SELECT name FROM students WHERE phone=?", (phone,)).fetchone()
        if not st:                              return jerr("not found", 404)
        if (st["name"] or "").strip() != name:  return jerr("name does not match", 403)
        c.execute("""INSERT INTO push_subs(endpoint,student_phone,role,sub,created) VALUES(?,?,'child',?,?)
                     ON CONFLICT(endpoint) DO UPDATE SET student_phone=excluded.student_phone,
                        role='child', sub=excluded.sub""",
                  (endpoint, phone, json.dumps(sub), int(time.time())))
    return jsonify({"ok": True})

@bp.route("/api/parent/child-notify", methods=["POST"])
def parent_child_notify():
    # Parent-only switch: whether reminder pushes reach the CHILD's device.
    pphone = parent_from_token(read_token())
    if not pphone:
        return jerr("unauthorized", 401)
    d = request.get_json(silent=True) or {}
    sphone = norm_phone(d.get("student_phone"))
    enabled = 1 if d.get("enabled") else 0
    with db() as c:
        if not c.execute("SELECT 1 FROM links WHERE parent_phone=? AND student_phone=?",
                         (pphone, sphone)).fetchone():
            return jerr("forbidden — not your student", 403)
        c.execute("UPDATE students SET notify_child=? WHERE phone=?", (enabled, sphone))
    return jsonify({"ok": True, "enabled": bool(enabled)})

def notify_child_device(c, sphone, title, body, url="/exam"):
    """Push a reminder to the student's OWN device(s), only if the parent left
    child notifications enabled. Returns True if at least one push went out."""
    row = c.execute("SELECT notify_child FROM students WHERE phone=?", (sphone,)).fetchone()
    if row and row["notify_child"] == 0:
        return False
    subs = c.execute("SELECT sub FROM push_subs WHERE role='child' AND student_phone=?", (sphone,)).fetchall()
    return any(send_push(s["sub"], title, body, url) for s in subs)

@bp.route("/api/parent/push/test", methods=["POST"])
def push_test():
    # lets a parent confirm notifications reach their phone
    pphone = parent_from_token(read_token())
    if not pphone:
        return jerr("unauthorized", 401)
    with db() as c:
        ch = notify_parent(c, pphone, "Onyx לימודי 🔔",
                           "מעולה! התראות למכשיר הזה פעילות.", "/parent")
    return jsonify({"ok": ch != "none", "channel": ch})

@bp.route("/api/cron/inactivity", methods=["GET", "POST"])
def cron_inactivity():
    # Meant to be hit once a day by a scheduler (systemd timer / cron / curl).
    # For every linked student who has not practised in >= `days` days, e-mail
    # the parent — provided a parent e-mail is on file and SMTP is configured.
    # Guarded by a shared secret so it can't be triggered by the public.
    key = os.environ.get("CRON_KEY", "")
    if not key or (request.args.get("key") or "") != key:
        return jerr("forbidden", 403)
    days = max(1, min(int(request.args.get("days") or 2), 60))
    cutoff_ms = (time.time() - days*86400) * 1000
    now = int(time.time())
    notified, checked = [], 0
    with db() as c:
        # every linked parent — a phone push reaches them even without an e-mail
        links = c.execute(
            "SELECT parent_phone,parent_name,parent_email,student_phone FROM links"
        ).fetchall()
        for l in links:
            checked += 1
            sp = l["student_phone"]
            st = c.execute("SELECT name FROM students WHERE phone=?", (sp,)).fetchone()
            sname = (st["name"] if st else sp) or sp
            last = c.execute("SELECT MAX(ts) AS m FROM results WHERE phone=?", (sp,)).fetchone()["m"]
            if last is not None and last >= cutoff_ms:
                continue   # practised recently — nothing to nag about
            since = "עדיין לא התחיל/ה לתרגל" if not last else \
                    f"כבר {int((now*1000 - last)//86400000)} ימים לא תרגל/ה"
            title = f"תזכורת תרגול — {sname}"
            body  = f"{sname} {since}. אפשר לעודד תרגול קצר היום 🙂"
            email_body = (f"שלום {l['parent_name'] or ''},\n\n"
                          f"תזכורת מ-Onyx לימודי: {sname} {since}.\n"
                          f"אפשר לעודד תרגול קצר היום 🙂\n\n"
                          f"למעקב מלא: היכנסו לעמוד ההורים.")
            ch = notify_parent(c, l["parent_phone"], title, body, "/parent",
                               l["parent_email"], email_body)
            # also nudge the child's own device (parent-controlled switch)
            kid = notify_child_device(c, sp, "בוא/י נתרגל! 🎯",
                                      f"{sname}, לא תרגלת היום — כמה דקות והתקדמת! 🚀", "/exam")
            notified.append({"student": sname, "channel": ch, "child_push": bool(kid)})
    return jsonify({"ok": True, "days": days, "checked": checked, "notified": notified})

@bp.route("/health")
def health():
    return jsonify({"ok": True, "dev": DEV})

# ─── Parent portal page (self-contained) ───────────────────────────────────
ADMIN_HTML = """<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Onyx לימודי · ניהול</title>
<style>
 *{box-sizing:border-box}
 body{margin:0;font-family:Rubik,Arial,sans-serif;background:#0f172a;color:#e2e8f0}
 .wrap{max-width:1100px;margin:0 auto;padding:18px}
 h1{font-size:22px;margin:0 0 4px}
 .sub{color:#94a3b8;font-size:13px;margin:0 0 18px}
 .card{background:#1e293b;border:1px solid #334155;border-radius:14px;padding:16px;margin-bottom:14px}
 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
 .kpi{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:12px}
 .kpi b{display:block;font-size:26px;line-height:1.1;color:#38bdf8}
 .kpi span{font-size:12px;color:#94a3b8}
 .kpi.hi b{color:#4ade80}
 table{width:100%;border-collapse:collapse;font-size:13px}
 th,td{text-align:right;padding:7px 8px;border-bottom:1px solid #334155;white-space:nowrap}
 th{color:#94a3b8;font-weight:600;font-size:12px}
 .scroll{overflow-x:auto}
 input,button,select{font-family:inherit;font-size:14px;border-radius:10px;border:1px solid #334155;
   padding:10px 12px;background:#0f172a;color:#e2e8f0}
 button{background:#0284c7;border-color:#0284c7;color:#fff;cursor:pointer;font-weight:600}
 button.ghost{background:transparent;color:#94a3b8}
 .login{max-width:340px;margin:12vh auto}
 .login input{width:100%;margin-bottom:10px}
 .login button{width:100%}
 .err{color:#f87171;font-size:13px;min-height:18px;margin-top:8px}
 .bars{display:flex;align-items:flex-end;gap:3px;height:110px;margin-top:10px}
 .bars div{flex:1;background:#0284c7;border-radius:3px 3px 0 0;min-height:2px;position:relative}
 .bars div.i{background:#4ade80}
 .legend{font-size:12px;color:#94a3b8;margin-top:6px}
 .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 .muted{color:#64748b}
</style></head><body>
<div class="wrap">
 <div id="login" class="login card">
   <h1>ניהול · Onyx לימודי</h1>
   <p class="sub">כניסה למשתמש על בלבד</p>
   <input id="u" placeholder="שם משתמש" autocomplete="username" value="admin">
   <input id="p" type="password" placeholder="סיסמה" autocomplete="current-password">
   <button id="go">כניסה</button>
   <div class="err" id="lerr"></div>
 </div>

 <div id="app" style="display:none">
  <div class="row" style="justify-content:space-between">
    <div><h1>ניהול · Onyx לימודי</h1><p class="sub" id="range"></p></div>
    <div class="row">
      <select id="days">
        <option value="7">7 ימים</option>
        <option value="30" selected>30 יום</option>
        <option value="90">90 יום</option>
      </select>
      <button class="ghost" id="out">יציאה</button>
    </div>
  </div>

  <div class="card">
    <div class="grid" id="kpis"></div>
  </div>

  <div class="card">
    <b>פעילות יומית</b>
    <div class="bars" id="bars"></div>
    <div class="legend"><span style="color:#38bdf8">■</span> פתיחות אפליקציה &nbsp;
      <span style="color:#4ade80">■</span> לחיצות על התקנה</div>
  </div>

  <div class="card">
    <b>לפי מקצוע</b>
    <div class="scroll"><table id="subj"></table></div>
  </div>

  <div class="card">
    <b>משתמשים</b>
    <p class="sub">מספר הטלפון מוצג בשלוש ספרות אחרונות בלבד. תשובות התלמידים אינן מוצגות כאן.</p>
    <div class="scroll"><table id="roster"></table></div>
  </div>
 </div>
</div>
<script>
const TK="onyx_admin_tok";
const $=id=>document.getElementById(id);
const esc=t=>String(t==null?"":t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function tok(){ return localStorage.getItem(TK)||""; }

async function login(){
  $("lerr").textContent="";
  const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({user:$("u").value.trim(),password:$("p").value})});
  const j=await r.json().catch(()=>({}));
  if(!j.ok){
    $("lerr").textContent = j.error==="wrong user or password" ? "שם משתמש או סיסמה שגויים"
      : j.error==="admin console is not configured" ? "מסך הניהול לא הוגדר בשרת (חסר ADMIN_PASSWORD)"
      : r.status===429 ? "יותר מדי ניסיונות — נסו שוב בעוד רבע שעה" : ("שגיאה: "+(j.error||r.status));
    return;
  }
  localStorage.setItem(TK,j.token); show();
}
async function load(){
  const r=await fetch("/api/admin/stats?days="+$("days").value,{headers:{Authorization:"Bearer "+tok()}});
  if(r.status===401){ localStorage.removeItem(TK); show(); return; }
  const j=await r.json();
  if(!j.ok) return;
  $("range").textContent="נתונים ל-"+j.days+" הימים האחרונים";
  const T=j.totals;
  const kpi=(v,l,hi)=>`<div class="kpi${hi?" hi":""}"><b>${v}</b><span>${l}</span></div>`;
  $("kpis").innerHTML=
    kpi(T.students,"תלמידים רשומים")+
    kpi(T.students_new,"נרשמו בתקופה")+
    kpi(T.parents,"הורים מקושרים")+
    kpi(T.tests,"מבחנים שהושלמו")+
    kpi(T.tests_period,"מבחנים בתקופה")+
    kpi(T.study_hours,"שעות לימוד מצטברות")+
    kpi(T.app_opens_period,"פתיחות אפליקציה בתקופה")+
    kpi(T.install_clicks,"לחיצות על 'התקן אפליקציה'",1)+
    kpi(T.install_done,"התקנות שהושלמו",1)+
    kpi(T.push_subs,"מכשירים עם התראות");

  const d=j.daily||[];
  const mx=Math.max(1,...d.map(x=>Math.max(x.opens||0,x.installs||0)));
  $("bars").innerHTML=d.length? d.map(x=>
    `<div title="${x.day}: ${x.opens||0} פתיחות" style="height:${Math.round((x.opens||0)/mx*100)}%"></div>`+
    `<div class="i" title="${x.day}: ${x.installs||0} התקנות" style="height:${Math.round((x.installs||0)/mx*100)}%"></div>`
  ).join("") : '<div class="muted" style="height:auto">אין עדיין נתונים בתקופה זו</div>';

  $("subj").innerHTML="<tr><th>מקצוע</th><th>מבחנים</th><th>ציון ממוצע</th></tr>"+
    ((j.subjects||[]).map(x=>`<tr><td>${esc(x.subject)}</td><td>${x.n}</td><td>${x.avg_grade==null?"—":x.avg_grade}</td></tr>`).join("")
     || '<tr><td colspan="3" class="muted">אין נתונים</td></tr>');

  $("roster").innerHTML="<tr><th>שם</th><th>גיל</th><th>טלפון</th><th>מבחנים</th><th>דקות</th><th>הורים</th><th>פעילות אחרונה</th></tr>"+
    ((j.roster||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${x.age||"—"}</td><td class="muted" dir="ltr">···${esc(x.phone_tail)}</td>`+
      `<td>${x.tests}</td><td>${x.minutes}</td><td>${x.parents}</td>`+
      `<td>${x.last_ts?new Date(x.last_ts).toLocaleDateString("he-IL"):"—"}</td></tr>`).join("")
     || '<tr><td colspan="7" class="muted">אין נתונים</td></tr>');
}
function show(){
  const on=!!tok();
  $("login").style.display=on?"none":"block";
  $("app").style.display=on?"block":"none";
  if(on)load();
}
$("go").onclick=login;
$("p").addEventListener("keydown",e=>{if(e.key==="Enter")login();});
$("days").onchange=load;
$("out").onclick=async()=>{ await fetch("/api/admin/logout",{method:"POST",headers:{Authorization:"Bearer "+tok()}}).catch(()=>{});
  localStorage.removeItem(TK); show(); };
show();
</script></body></html>"""

@bp.route("/admin")
def admin_page():
    return Response(ADMIN_HTML, mimetype="text/html")

PARENT_HTML = """<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>מעקב הורים — Onyx לימודי</title>
<meta name="theme-color" content="#6C5CE7">
<link rel="manifest" href="/parent.webmanifest">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="מעקב הורים">
<link rel="apple-touch-icon" href="/static/img/onyx_learn_icon-192.png">
<link rel="icon" href="/static/img/onyx_learn_icon-192.png">
<style>
 body{font-family:system-ui,'Segoe UI',Arial,sans-serif;background:linear-gradient(160deg,#EAF7FB,#D6EAF2);margin:0;color:#12313F}
 .wrap{max-width:680px;margin:0 auto;padding:18px}
 h1{font-size:24px;margin:6px 0 4px}
 .sub{opacity:.7;margin:0 0 16px;font-size:14px}
 .card{background:#fff;border-radius:18px;padding:16px;margin-bottom:14px;box-shadow:0 12px 30px -20px rgba(11,36,48,.6)}
 label{display:block;font-size:13px;margin:8px 0 4px;opacity:.8}
 input{width:100%;padding:11px;border:2px solid #DCE9EE;border-radius:12px;font-size:16px}
 button{background:#6C5CE7;color:#fff;border:0;border-radius:12px;padding:12px 16px;font-size:15px;cursor:pointer;margin-top:10px}
 button.sec{background:#0B2430}
 .stud{border:1px solid #E4EEF2;border-radius:14px;padding:12px;margin-top:10px}
 .stud h3{margin:0 0 6px}
 .subj{display:inline-block;background:#F2FAFC;border-radius:10px;padding:6px 10px;margin:4px 4px 0 0;font-size:13px}
 .subj b{color:#6C5CE7}
 table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
 td,th{padding:6px;border-bottom:1px solid #EEF4F6;text-align:right}
 .muted{opacity:.6;font-size:12px}
 .err{color:#C0392B;font-size:13px;margin-top:8px}
 tr.click{cursor:pointer}
 tr.click:hover{background:#F5FAFC}
 tr.click td:last-child::after{content:"🔍";opacity:.45;margin-inline-start:6px;font-size:11px}
 .warn{background:#FFF3E0;border:1px solid #FFCC80;color:#8A5300;border-radius:12px;padding:9px 12px;margin:8px 0;font-size:13px}
 .ok-badge{background:#E8F8EF;border:1px solid #A9E2C4;color:#1E7A48;border-radius:12px;padding:9px 12px;margin:8px 0;font-size:13px}
 .tmwrap{margin:12px 0 4px}
 .tmwrap .lbl{font-size:12px;opacity:.7;margin-bottom:6px}
 .bars{display:flex;align-items:flex-end;gap:4px;height:80px;padding-top:4px}
 .bar{flex:1;min-width:8px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}
 .bar i{display:block;width:100%;background:linear-gradient(180deg,#6C5CE7,#8E7BEE);border-radius:5px 5px 0 0;min-height:2px}
 .bar i.zero{background:#E4EEF2}
 .bar b{font-size:9px;opacity:.7;margin-bottom:2px;font-weight:600}
 .bar span{font-size:9px;opacity:.55;margin-top:3px;writing-mode:horizontal-tb}
 .tmtot{font-size:12px;opacity:.75;margin-top:6px}
 .refbar{display:flex;align-items:center;justify-content:space-between;gap:10px;position:sticky;top:0;z-index:5;background:linear-gradient(#EAF7FB,#EAF7FBcc);padding:6px 2px;margin-bottom:6px}
 .refbar button{margin:0;padding:9px 16px}
 .refbar button:disabled{opacity:.6}
 .legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
 .legend .lg{display:inline-flex;align-items:center;font-size:11px;opacity:.8}
 .legend .lg i{width:10px;height:10px;border-radius:3px;display:inline-block;margin-inline-start:4px}
 .cnote{display:flex;align-items:center;gap:8px;background:#F4F2FF;border:1px solid #E0DAFB;border-radius:12px;padding:9px 11px;margin:8px 0;font-size:13px}
 .cnote input{width:auto;transform:scale(1.25);accent-color:#6C5CE7}
 #installcard{border:2px solid #C9BEF6;background:#F7F5FF}
 #installcard.hot{border-color:#6C5CE7;box-shadow:0 8px 24px -14px rgba(108,92,231,.7)}
 .ovl{position:fixed;inset:0;background:rgba(11,36,48,.55);display:none;align-items:center;justify-content:center;padding:14px;z-index:9}
 .ovl.on{display:flex}
 .sheet{background:#fff;border-radius:18px;max-width:560px;width:100%;max-height:86vh;overflow:auto;padding:16px}
 .sheet h3{margin:0 0 2px}
 .qrow{border:1px solid #EEF4F6;border-radius:12px;padding:9px 11px;margin-top:8px}
 .qrow.good{border-color:#BFE9CF;background:#F4FCF7}
 .qrow.bad{border-color:#F3C9C2;background:#FEF6F4}
 .qrow .qq{font-size:14px;font-weight:600;margin-bottom:3px}
 .qrow .ans{font-size:13px}
 .qrow .ans .child{font-weight:600}
 .qrow .bad-a{color:#C0392B}
 .qrow .good-a{color:#1E7A48}
 .pill{display:inline-block;font-size:11px;border-radius:8px;padding:1px 7px;margin-inline-start:6px}
 .pill.g{background:#E8F8EF;color:#1E7A48}.pill.b{background:#FCEBE8;color:#C0392B}
 .xbtn{float:left;background:#0B2430;border:0;color:#fff;border-radius:10px;padding:6px 12px;cursor:pointer;margin:0}
</style></head><body><div class="wrap">
 <h1>מעקב הורים</h1>
 <p class="sub">עקבו אחר ההתקדמות של הילד/ה מרחוק. אחרי הקישור הראשון המכשיר יזכור את התלמידים — בכניסה הבאה הכול ייטען אוטומטית.</p>
 <div class="card" id="installcard" style="display:none">
   <b>📲 התקנת האפליקציה למסך הבית</b>
   <p class="muted" id="install-hint" style="margin:6px 0 0"></p>
   <button id="installbtn" style="display:none;margin-top:10px" onclick="installApp()">התקן עכשיו</button>
 </div>

 <div class="card">
   <label>מספר הטלפון שלכם (הורה)</label>
   <input id="pphone" inputmode="numeric" placeholder="0500000000">
   <button onclick="loadStudents()">הצג התקדמות</button>
   <div id="err" class="err"></div>
 </div>

 <div class="card">
   <b>קישור תלמיד חדש</b>
   <label>שם ההורה</label><input id="pname" placeholder="שם">
   <label>אימייל לתזכורות (לא חובה) — נשלח מייל אם התלמיד/ה לא מתרגל/ת</label><input id="pemail" type="email" placeholder="parent@email.com">
   <label>טלפון התלמיד</label><input id="sphone" inputmode="numeric" placeholder="0500000000">
   <label>קוד הורה (שהתלמיד קיבל בהרשמה)</label><input id="pcode" placeholder="3F9A2C">
   <button class="sec" onclick="linkStudent()">קשר תלמיד</button>
   <div id="lerr" class="err"></div>
 </div>

 <div class="card" id="pushcard" style="display:none">
   <b>🔔 התראות לנייד</b>
   <p class="muted" style="margin:6px 0 0">קבלו התראה ישירות למכשיר — גם כשהמסך נעול — בימים שהילד/ה לא מתרגל/ת. בלי צורך במייל.</p>
   <button onclick="enablePush()" id="pushbtn">הפעל התראות במכשיר הזה</button>
   <div id="pushmsg" class="muted" style="margin-top:8px"></div>
   <p class="muted" style="margin:8px 0 0;font-size:11px">באייפון: הוסיפו קודם את העמוד למסך הבית (שיתוף → הוספה למסך הבית) ואז הפעילו.</p>
 </div>

 <div id="students"></div>
</div>
<div class="ovl" id="ovl"><div class="sheet" id="sheet"></div></div>
<script>
 const SUBJ={english:"אנגלית",hebrew:"עברית",math:"חשבון",science:"מדעים",torah:"תורה",lashon:"לשון"};
 function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
 function fmt(ts){ if(!ts) return "—"; const d=new Date(ts); return d.toLocaleDateString("he-IL"); }
 function fmtDT(ts){ if(!ts) return "—"; const d=new Date(ts); return d.toLocaleDateString("he-IL")+" "+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}); }
 function fmtDur(sec){ sec=+sec||0; if(sec<60) return sec+" שנ'"; const m=Math.round(sec/60); return m+" דק'"; }
 function ptoken(p){ return localStorage.getItem("ptok:"+p)||""; }
 // last 14 days as a small bar chart of minutes-on-task
 function timeChart(time){
   const map={}; (time||[]).forEach(t=>{map[t.day]=t.seconds;});
   const days=[],today=new Date(); today.setHours(0,0,0,0);
   for(let i=13;i>=0;i--){ const d=new Date(today.getTime()-i*86400000);
     const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
     days.push({key,sec:map[key]||0,dow:["א","ב","ג","ד","ה","ו","ש"][d.getDay()]}); }
   const max=Math.max(60,...days.map(d=>d.sec));
   const totSec=days.reduce((a,d)=>a+d.sec,0);
   const bars=days.map(d=>{ const h=Math.round(d.sec/max*100), m=Math.round(d.sec/60);
     return `<div class="bar" title="${esc(d.key)}: ${fmtDur(d.sec)}"><b>${d.sec?m:""}</b><i class="${d.sec?"":"zero"}" style="height:${d.sec?Math.max(4,h):3}%"></i><span>${d.dow}</span></div>`;
   }).join("");
   return `<div class="tmwrap"><div class="lbl">⏱️ זמן תרגול יומי (14 ימים אחרונים, בדקות)</div><div class="bars">${bars}</div>
     <div class="tmtot">סה"כ בשבועיים: <b>${fmtDur(totSec)}</b></div></div>`;
 }
 const SUBJ_COLOR={english:"#6C5CE7",hebrew:"#00A8A8",math:"#E17055",science:"#0984E3",torah:"#B8860B",lashon:"#D63384"};
 // grade trend over time: one coloured line per subject (needs 2+ tests)
 function trendChart(trend){
   if(!Array.isArray(trend)||trend.length<2) return "";
   const bySub={}; trend.forEach(t=>{(bySub[t.subject]=bySub[t.subject]||[]).push(t.g);});
   const subs=Object.entries(bySub).filter(([k,v])=>v.length>=2);
   if(!subs.length) return "";
   const W=300,H=120,PL=26,PR=8,PT=8,PB=14;
   const maxN=Math.max(...subs.map(([k,v])=>v.length));
   const x=i=>PL+(maxN<=1?0:i/(maxN-1))*(W-PL-PR);
   const y=g=>PT+(1-Math.max(0,Math.min(100,g))/100)*(H-PT-PB);
   let grid=""; [0,50,100].forEach(v=>{grid+=`<line x1="${PL}" y1="${y(v).toFixed(1)}" x2="${W-PR}" y2="${y(v).toFixed(1)}" stroke="#EEF4F6"/><text x="${PL-4}" y="${(y(v)+3).toFixed(1)}" text-anchor="end" font-size="9" fill="#9FB6BF">${v}</text>`;});
   const lines=subs.map(([k,v])=>{
     const col=SUBJ_COLOR[k]||"#888";
     const pts=v.map((g,i)=>`${x(i).toFixed(1)},${y(g).toFixed(1)}`).join(" ");
     const dots=v.map((g,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(g).toFixed(1)}" r="2.4" fill="${col}"/>`).join("");
     return `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>${dots}`;
   }).join("");
   const legend=subs.map(([k])=>`<span class="lg"><i style="background:${SUBJ_COLOR[k]||"#888"}"></i>${esc(SUBJ[k]||k)}</span>`).join("");
   return `<div class="tmwrap"><div class="lbl">📈 מגמת ציונים לאורך זמן</div>
     <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:150px" preserveAspectRatio="xMidYMid meet">${grid}${lines}</svg>
     <div class="legend">${legend}</div></div>`;
 }
 async function loadStudents(){
   document.getElementById("err").textContent="";
   const _rb=document.getElementById("refbtn"); if(_rb){_rb.textContent="⏳ מרענן…";_rb.disabled=true;}
   const p=document.getElementById("pphone").value.replace(/\\D/g,"")||(localStorage.getItem("pphone")||"");
   if(p)document.getElementById("pphone").value=p;
   if(p.length<9){document.getElementById("err").textContent="מספר טלפון לא תקין";return;}
   const tok=ptoken(p);
   if(!tok){document.getElementById("err").textContent="כדי לצפות בהתקדמות, קשרו קודם תלמיד/ה עם קוד ההורה (בטופס למטה).";return;}
   const r=await fetch("/api/parent/students",{headers:{"Authorization":"Bearer "+tok}}); const j=await r.json();
   if(!j.ok){document.getElementById("err").textContent=(r.status===401)?"פג תוקף החיבור — קשרו תלמיד/ה מחדש עם הקוד.":"שגיאה בטעינה.";return;}
   try{localStorage.setItem("pphone",p);}catch(e){}   // remember this parent for next time
   const box=document.getElementById("students"); box.innerHTML="";
   const pc=document.getElementById("pushcard"); if(pc)pc.style.display="";   // parent is linked → offer phone alerts
   if(!j.students||!j.students.length){box.innerHTML='<div class="card muted">לא נמצאו תלמידים מקושרים. קשרו תלמיד למעלה.</div>';return;}
   const _now=new Date();
   box.insertAdjacentHTML("beforeend",`<div class="refbar"><button id="refbtn" onclick="loadStudents()">🔄 רענן תוצאות</button><span class="muted">עודכן ${_now.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</span></div>`);
   for(const s of j.students){
     const subs=Object.entries(s.stats||{}).map(([k,v])=>`<span class="subj">${esc(SUBJ[k]||k)}: <b>${esc(v.avg)}</b> ממוצע · שיא ${esc(v.best)} · ${esc(v.count)} מבחנים</span>`).join("");
     const rows=(s.recent||[]).map(x=>`<tr class="${x.id?"click":""}" ${x.id?`data-id="${esc(x.id)}"`:""}><td>${esc(SUBJ[x.subject]||x.subject)}</td><td>${esc(x.grade)}/100</td><td>${esc(x.correct)}/${esc(x.total)}</td><td>${esc(fmtDur(x.dur))}</td><td>${esc(fmtDT(x.ts))}</td></tr>`).join("");
     let banner="";
     const inact=s.inactive_days;
     if(inact==null&&!s.last) banner='<div class="warn">🔔 התלמיד/ה עדיין לא תרגל/ה. עודדו התחלה 🙂</div>';
     else if(inact>=2) banner=`<div class="warn">🔔 לא תורגל כבר <b>${esc(inact)}</b> ימים — אולי כדאי לעודד תרגול קצר היום.</div>`;
     else banner='<div class="ok-badge">✅ תרגל/ה לאחרונה — כל הכבוד!</div>';
     box.insertAdjacentHTML("beforeend",
       `<div class="card"><div class="stud"><h3>${esc(s.name)} <span class="muted">· גיל ${esc(s.age||"?")} · פעילות אחרונה ${esc(fmt(s.last))}</span></h3>
        ${banner}
        <label class="cnote"><input type="checkbox" class="cn-toggle" data-phone="${esc(s.phone)}" ${s.notify_child?"checked":""}>
          <span>שליחת תזכורות תרגול למכשיר של ${esc(s.name)} 🔔${s.child_device?"":' <span class="muted">— המכשיר עדיין לא רשום. פִּתחו פעם אחת את האפליקציה במכשיר הילד/ה.</span>'}</span></label>
        ${subs||'<span class="muted">אין עדיין תוצאות</span>'}
        ${trendChart(s.trend)}
        ${timeChart(s.time)}
        ${rows?`<div class="muted" style="margin-top:6px">לחצו על מבחן כדי לראות את השאלות והתשובות של התלמיד/ה 🔍</div><table><tr><th>מקצוע</th><th>ציון</th><th>נכונות</th><th>זמן</th><th>מתי</th></tr>${rows}</table>`:""}
        </div></div>`);
   }
   box.querySelectorAll("tr.click").forEach(tr=>tr.addEventListener("click",()=>openTest(tr.dataset.id)));
   box.querySelectorAll(".cn-toggle").forEach(cb=>cb.addEventListener("change",()=>toggleChildNotify(cb)));
 }
 async function toggleChildNotify(cb){
   const p=document.getElementById("pphone").value.replace(/\\D/g,""), tok=ptoken(p);
   try{
     const r=await fetch("/api/parent/child-notify",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok},body:JSON.stringify({student_phone:cb.dataset.phone,enabled:cb.checked})});
     const j=await r.json(); if(!j.ok){cb.checked=!cb.checked;}
   }catch(e){ cb.checked=!cb.checked; }
 }
 // ── drill into one test: exact questions + what the child answered ──
 const SUBJHE={vocab:"אוצר מילים",cloze:"השלמת מילים",reading:"הבנת הנקרא",pics:"תיאור תמונה",match:"התאמה",balloons:"בלונים",spell:"איות",quiz:"חידון",lex:"נרדף/הפך",word:"מילה או לא",math:"חשבון"};
 async function openTest(id){
   if(!id) return;
   const p=document.getElementById("pphone").value.replace(/\\D/g,""), tok=ptoken(p);
   const sheet=document.getElementById("sheet"); sheet.innerHTML='<div class="muted">טוען…</div>';
   document.getElementById("ovl").classList.add("on");
   let j; try{ const r=await fetch("/api/parent/result?id="+encodeURIComponent(id),{headers:{"Authorization":"Bearer "+tok}}); j=await r.json(); }catch(e){ j={ok:false}; }
   if(!j||!j.ok){ sheet.innerHTML='<button class="xbtn" onclick="closeTest()">סגור</button><p class="err">לא ניתן לטעון את פרטי המבחן.</p>'; return; }
   const det=j.detail||[];
   const qs=det.length?det.map((x,i)=>{
     const ok=!!x.ok, part=SUBJHE[x.t]||x.t||"";
     const child=x.a==null||x.a===""?"—":x.a;
     const ansLine=ok
       ? `תשובת התלמיד/ה: <span class="child good-a">${esc(child)}</span> ✓`
       : `תשובת התלמיד/ה: <span class="child bad-a">${esc(child)}</span> ✗ · התשובה הנכונה: <span class="good-a">${esc(x.k)}</span>`;
     return `<div class="qrow ${ok?"good":"bad"}"><div class="qq">${i+1}. ${esc(x.p)} ${part?`<span class="pill ${ok?"g":"b"}">${esc(part)}</span>`:""}</div><div class="ans">${ansLine}</div></div>`;
   }).join("") : '<p class="muted">לא נשמרו פרטי שאלות למבחן זה (מבחן ישן יותר).</p>';
   sheet.innerHTML=`<button class="xbtn" onclick="closeTest()">סגור</button>
     <h3>${esc(SUBJ[j.subject]||j.subject)} · ${esc(j.grade)}/100</h3>
     <div class="muted">${esc(j.correct)}/${esc(j.total)} נכונות · זמן ${esc(fmtDur(j.dur))} · ${esc(fmtDT(j.ts))}</div>
     ${qs}`;
 }
 function closeTest(){ document.getElementById("ovl").classList.remove("on"); }
 document.getElementById("ovl").addEventListener("click",e=>{ if(e.target.id==="ovl") closeTest(); });
 // ── phone push notifications (work with the screen locked) ──
 function b64ToU8(s){ const pad="=".repeat((4-s.length%4)%4); const b=(s+pad).replace(/-/g,"+").replace(/_/g,"/"); const raw=atob(b); const u=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i); return u; }
 async function enablePush(){
   const p=document.getElementById("pphone").value.replace(/\\D/g,""), tok=ptoken(p), msg=document.getElementById("pushmsg");
   if(!tok){msg.textContent="קשרו קודם תלמיד/ה עם קוד ההורה.";return;}
   if(!("serviceWorker" in navigator)||!("PushManager" in window)){msg.textContent="הדפדפן במכשיר זה לא תומך בהתראות.";return;}
   msg.textContent="מפעיל…";
   try{
     const perm=await Notification.requestPermission();
     if(perm!=="granted"){msg.textContent="ההתראות נחסמו. אפשר לאשר בהגדרות הדפדפן/האתר.";return;}
     const reg=await navigator.serviceWorker.register("/parent-sw.js"); await navigator.serviceWorker.ready;
     const vr=await (await fetch("/api/push/vapid")).json();
     if(!vr.ok||!vr.publicKey){msg.textContent="שירות ההתראות אינו זמין כרגע בשרת.";return;}
     let sub=await reg.pushManager.getSubscription();
     if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToU8(vr.publicKey)});
     const r=await fetch("/api/parent/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok},body:JSON.stringify({subscription:sub})});
     const j=await r.json();
     if(j.ok){document.getElementById("pushbtn").textContent="ההתראות פעילות ✓";
       msg.innerHTML='✅ ההתראות פעילות במכשיר הזה. <a href="#" onclick="testPush(event)">שליחת התראת בדיקה</a>';}
     else msg.textContent="לא ניתן להפעיל התראות כרגע.";
   }catch(e){msg.textContent="שגיאה בהפעלת ההתראות: "+(e&&e.message||e);}
 }
 async function testPush(ev){ if(ev)ev.preventDefault();
   const p=document.getElementById("pphone").value.replace(/\\D/g,""), tok=ptoken(p);
   const r=await fetch("/api/parent/push/test",{method:"POST",headers:{"Authorization":"Bearer "+tok}}); const j=await r.json();
   document.getElementById("pushmsg").textContent=j.ok?("נשלחה התראת בדיקה למכשיר 📨"):"לא נמצא מנוי התראות פעיל — הפעילו שוב.";
 }
 async function linkStudent(){
   document.getElementById("lerr").textContent="";
   const body={parent_phone:document.getElementById("pphone").value.replace(/\\D/g,"")||document.getElementById("sphone").value,
     parent_name:document.getElementById("pname").value,
     parent_email:document.getElementById("pemail").value.trim(),
     student_phone:document.getElementById("sphone").value.replace(/\\D/g,""),
     parent_code:document.getElementById("pcode").value};
   if(!body.parent_phone){document.getElementById("lerr").textContent="מלאו קודם את מספר הטלפון שלכם למעלה";return;}
   const r=await fetch("/api/parent/link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const j=await r.json();
   if(!j.ok){document.getElementById("lerr").textContent=j.error==="wrong parent code"?"קוד הורה שגוי":j.error==="student not found"?"תלמיד לא נמצא":"שגיאה: "+j.error;return;}
   if(j.token) localStorage.setItem("ptok:"+body.parent_phone, j.token);
   document.getElementById("pphone").value=body.parent_phone;
   loadStudents();
 }
 // Register the service worker so the portal is installable and works offline.
 if("serviceWorker" in navigator) navigator.serviceWorker.register("/parent-sw.js").catch(()=>{});

 // Install helper — always discoverable, tailored per platform, and hidden once
 // the portal is already installed as an app.
 let _installEvt=null;
 function _isStandalone(){ return matchMedia("(display-mode: standalone)").matches || navigator.standalone===true; }
 function _uaFlags(){ const ua=navigator.userAgent||"";
   return { ios:/iphone|ipad|ipod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1),
     inApp:/\\bwv\\b|FBAN|FBAV|FB_IAB|Instagram|Line\\/|Twitter|WhatsApp/i.test(ua) }; }
 (function(){ try{
   if(_isStandalone()) return;                  // already running as an installed app
   const f=_uaFlags(), card=document.getElementById("installcard"),
         hint=document.getElementById("install-hint"), btn=document.getElementById("installbtn");
   if(!card||!hint||!btn) return;
   btn.style.display="";                         // always offer a button that does something
   if(f.inApp){ hint.innerHTML='הקישור נפתח בתוך אפליקציה שלא תומכת בהתקנה. פִּתחו אותו ב-<b>Chrome</b> (תפריט ⋮ → "פתח בדפדפן"), ואז התקינו.'; btn.textContent="איך פותחים ב-Chrome"; }
   else if(f.ios){ hint.innerHTML='ב-Safari: כפתור <b>שיתוף</b> ⬆️ → <b>"הוספה למסך הבית"</b>.'; btn.textContent="הצג הוראות"; }
   else { hint.innerHTML='לחצו <b>התקן עכשיו</b>, או תפריט הדפדפן ⋮ → <b>"התקנת אפליקציה"</b>.'; btn.textContent="התקן עכשיו"; }
   card.style.display="";
 }catch(e){} })();
 window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); _installEvt=e;
   const c=document.getElementById("installcard"), b=document.getElementById("installbtn");
   if(b){b.style.display="";b.textContent="התקן עכשיו";} if(c)c.style.display=""; });
 window.addEventListener("appinstalled",()=>{ const c=document.getElementById("installcard"); if(c)c.style.display="none"; });
 async function installApp(){
   if(_installEvt){ _installEvt.prompt(); try{await _installEvt.userChoice;}catch(e){} _installEvt=null;
     const c=document.getElementById("installcard"); if(c)c.style.display="none"; return; }
   const f=_uaFlags();   // no native prompt available → give clear manual steps
   if(f.inApp) alert('הקישור נפתח בתוך אפליקציה (כמו וואטסאפ) שלא מאפשרת התקנה.\\n\\nלחצו על תפריט שלוש הנקודות (⋮) בפינה ובחרו "פתח ב-Chrome" או "פתח בדפדפן", ואז לחצו שוב על התקנה.');
   else if(f.ios) alert('להתקנה באייפון (חובה Safari):\\n1. לחצו על כפתור השיתוף ⬆️ בתחתית המסך.\\n2. גללו ובחרו "הוספה למסך הבית".\\n3. אשרו.');
   else alert('להתקנה:\\n1. פתחו את תפריט הדפדפן (שלוש נקודות ⋮).\\n2. בחרו "התקנת אפליקציה" או "הוספה למסך הבית".');
 }

 // On entry: an invite link (?s=&c=) prefills the link form; otherwise, if we
 // already know this parent (saved phone + token), load their students
 // automatically so nothing has to be re-entered.
 (function(){ try{
   const q=new URLSearchParams(location.search);
   const s=(q.get("s")||"").replace(/\\D/g,""), c=(q.get("c")||"").trim();
   if(s) document.getElementById("sphone").value=s;
   if(c) document.getElementById("pcode").value=c;
   if(s&&c){
     const sub=document.querySelector(".sub");
     if(sub) sub.innerHTML="קיבלתם הזמנה למעקב! ✅ מומלץ קודם <b>להתקין את האפליקציה</b> (למטה), ואז להזין את מספר הטלפון וללחוץ <b>קשר תלמיד</b>.";
     // put the install call-to-action right at the top and make it stand out
     const card=document.getElementById("installcard"), ih=document.getElementById("install-hint");
     if(card){
       card.style.display=""; card.classList.add("hot");
       const wrap=document.querySelector(".wrap"), subEl=document.querySelector(".sub");
       if(wrap&&subEl&&subEl.nextSibling!==card) wrap.insertBefore(card, subEl.nextSibling);
     }
     if(ih) ih.innerHTML="💡 התקינו למסך הבית — כניסה למעקב בלחיצה אחת, בלי דפדפן ובלי הזנת פרטים בכל פעם.<br>"+ih.innerHTML;
     const pin=document.getElementById("pphone"); if(pin) pin.focus();
     return;
   }
   const saved=localStorage.getItem("pphone")||"";
   if(saved && ptoken(saved)){
     document.getElementById("pphone").value=saved;
     loadStudents();   // remembered device → show the tracked students right away
   }
 }catch(e){} })();
</script></body></html>"""

# ─── Standalone app (mounts the blueprint) ─────────────────────────────────
app = Flask(__name__)
app.register_blueprint(bp)

if __name__ == "__main__":
    init_db()
    print(f"[learn] DB={DB_PATH} DEV={DEV} → http://127.0.0.1:{PORT}")
    app.run(host="0.0.0.0", port=PORT)
