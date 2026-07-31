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
            created INTEGER
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
        CREATE INDEX IF NOT EXISTS idx_results_phone ON results(phone);
        CREATE INDEX IF NOT EXISTS idx_ptok_phone ON parent_tokens(parent_phone);
        CREATE INDEX IF NOT EXISTS idx_time_phone ON study_time(phone);
        """)
        # ── idempotent migrations for databases created before these columns ──
        for tbl, col, ddl in (
            ("results", "dur",          "ALTER TABLE results ADD COLUMN dur INTEGER DEFAULT 0"),
            ("results", "detail",       "ALTER TABLE results ADD COLUMN detail TEXT"),
            ("links",   "parent_email", "ALTER TABLE links ADD COLUMN parent_email TEXT"),
        ):
            cols = {r["name"] for r in c.execute(f"PRAGMA table_info({tbl})").fetchall()}
            if col not in cols:
                try: c.execute(ddl)
                except Exception as e: print(f"[learn] migration {tbl}.{col} skipped:", e)

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
    code = gen_code()
    now = int(time.time())
    with db() as c:
        row = c.execute("SELECT phone, verified, parent_code FROM students WHERE phone=?", (phone,)).fetchone()
        if row and row["verified"]:
            # already verified — just (re)issue nothing, report existing
            return jsonify({"ok": True, "already": True, "parent_code": row["parent_code"]})
        parent_code = (row["parent_code"] if row else None) or gen_parent_code()
        if row:
            c.execute("UPDATE students SET name=?,age=?,email=?,code=?,code_ts=? WHERE phone=?",
                      (name, age, email, code, now, phone))
        else:
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
    with db() as c:
        st = c.execute("SELECT parent_code,name FROM students WHERE phone=?", (sphone,)).fetchone()
        if not st:                       return jerr("student not found", 404)
        if (st["parent_code"] or "") != pcode or not pcode:
            return jerr("wrong parent code", 401)
        c.execute("""INSERT OR REPLACE INTO links(parent_phone,parent_name,parent_email,student_phone,created)
                     VALUES(?,?,?,?,?)""", (pphone, pname, pemail, sphone, int(time.time())))
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
            st = c.execute("SELECT name,age FROM students WHERE phone=?", (sp,)).fetchone()
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
            out.append({"phone": sp, "name": st["name"] if st else sp, "age": st["age"] if st else None,
                        "stats": _stats(rows), "last": last, "recent": rows[:10],
                        "time": tm, "inactive_days": inactive})
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
    return Response(PARENT_HTML, mimetype="text/html")

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
        links = c.execute(
            "SELECT parent_phone,parent_name,parent_email,student_phone FROM links WHERE parent_email IS NOT NULL AND parent_email!=''"
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
            body = (f"שלום {l['parent_name'] or ''},\n\n"
                    f"תזכורת מ-Onyx לימודי: {sname} {since}.\n"
                    f"אפשר לעודד תרגול קצר היום 🙂\n\n"
                    f"למעקב מלא: היכנסו לעמוד ההורים.")
            sent = send_email(l["parent_email"], f"תזכורת תרגול — {sname}", body)
            notified.append({"student": sname, "parent_email": l["parent_email"], "sent": bool(sent)})
    return jsonify({"ok": True, "days": days, "checked": checked, "notified": notified})

@bp.route("/health")
def health():
    return jsonify({"ok": True, "dev": DEV})

# ─── Parent portal page (self-contained) ───────────────────────────────────
PARENT_HTML = """<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>מעקב הורים — Onyx לימודי</title>
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
 <p class="sub">עקבו אחר ההתקדמות של הילד/ה מרחוק. הזינו את מספר הטלפון שלכם כדי לראות את התלמידים המקושרים, או קשרו תלמיד חדש עם קוד ההורה שקיבל.</p>

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
 async function loadStudents(){
   document.getElementById("err").textContent="";
   const p=document.getElementById("pphone").value.replace(/\\D/g,"");
   if(p.length<9){document.getElementById("err").textContent="מספר טלפון לא תקין";return;}
   const tok=ptoken(p);
   if(!tok){document.getElementById("err").textContent="כדי לצפות בהתקדמות, קשרו קודם תלמיד/ה עם קוד ההורה (בטופס למטה).";return;}
   const r=await fetch("/api/parent/students",{headers:{"Authorization":"Bearer "+tok}}); const j=await r.json();
   if(!j.ok){document.getElementById("err").textContent=(r.status===401)?"פג תוקף החיבור — קשרו תלמיד/ה מחדש עם הקוד.":"שגיאה בטעינה.";return;}
   const box=document.getElementById("students"); box.innerHTML="";
   if(!j.students||!j.students.length){box.innerHTML='<div class="card muted">לא נמצאו תלמידים מקושרים. קשרו תלמיד למעלה.</div>';return;}
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
        ${subs||'<span class="muted">אין עדיין תוצאות</span>'}
        ${timeChart(s.time)}
        ${rows?`<div class="muted" style="margin-top:6px">לחצו על מבחן כדי לראות את השאלות והתשובות של התלמיד/ה 🔍</div><table><tr><th>מקצוע</th><th>ציון</th><th>נכונות</th><th>זמן</th><th>מתי</th></tr>${rows}</table>`:""}
        </div></div>`);
   }
   box.querySelectorAll("tr.click").forEach(tr=>tr.addEventListener("click",()=>openTest(tr.dataset.id)));
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
 // Arriving from a "send to parent" link (?s=<student phone>&c=<parent code>):
 // prefill the student phone + code so the parent only enters their own number.
 (function(){ try{
   const q=new URLSearchParams(location.search);
   const s=(q.get("s")||"").replace(/\\D/g,""), c=(q.get("c")||"").trim();
   if(s) document.getElementById("sphone").value=s;
   if(c) document.getElementById("pcode").value=c;
   if(s&&c){
     const sub=document.querySelector(".sub");
     if(sub) sub.innerHTML="קיבלתם הזמנה למעקב! ✅ הזינו את <b>מספר הטלפון שלכם</b> ולחצו <b>קשר תלמיד</b> כדי לראות את ההתקדמות.";
     const pin=document.getElementById("pphone"); if(pin) pin.focus();
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
