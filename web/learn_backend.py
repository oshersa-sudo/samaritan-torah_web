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
            ts INTEGER
        );
        CREATE TABLE IF NOT EXISTS links(
            parent_phone TEXT NOT NULL,
            parent_name TEXT,
            student_phone TEXT NOT NULL,
            created INTEGER,
            PRIMARY KEY(parent_phone, student_phone)
        );
        CREATE INDEX IF NOT EXISTS idx_results_phone ON results(phone);
        """)

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

def jerr(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code

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
    with db() as c:
        if not c.execute("SELECT 1 FROM students WHERE phone=?", (phone,)).fetchone():
            return jerr("register first", 404)
        c.execute("INSERT INTO results(phone,subject,grade,correct,total,ts) VALUES(?,?,?,?,?,?)",
                  (phone, subject, grade, correct, total, ts))
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
    phone = norm_phone(request.args.get("phone"))
    with db() as c:
        rows = c.execute("SELECT subject,grade,correct,total,ts FROM results WHERE phone=? ORDER BY ts DESC LIMIT 100", (phone,)).fetchall()
    rows = [dict(r) for r in rows]
    return jsonify({"ok": True, "results": rows, "stats": _stats(rows)})

# ─── Parent linking & portal ───────────────────────────────────────────────
@bp.route("/api/parent/link", methods=["POST"])
def parent_link():
    d = request.get_json(silent=True) or {}
    pphone = norm_phone(d.get("parent_phone"))
    pname  = (d.get("parent_name") or "").strip()
    sphone = norm_phone(d.get("student_phone"))
    pcode  = (d.get("parent_code") or "").strip().upper()
    if not PHONE_RE.match(pphone): return jerr("invalid parent phone")
    with db() as c:
        st = c.execute("SELECT parent_code,name FROM students WHERE phone=?", (sphone,)).fetchone()
        if not st:                       return jerr("student not found", 404)
        if (st["parent_code"] or "") != pcode or not pcode:
            return jerr("wrong parent code", 401)
        c.execute("""INSERT OR REPLACE INTO links(parent_phone,parent_name,student_phone,created)
                     VALUES(?,?,?,?)""", (pphone, pname, sphone, int(time.time())))
    return jsonify({"ok": True, "student_name": st["name"]})

@bp.route("/api/parent/students")
def parent_students():
    pphone = norm_phone(request.args.get("parent_phone"))
    with db() as c:
        links = c.execute("SELECT student_phone FROM links WHERE parent_phone=?", (pphone,)).fetchall()
        out = []
        for l in links:
            sp = l["student_phone"]
            st = c.execute("SELECT name,age FROM students WHERE phone=?", (sp,)).fetchone()
            rows = [dict(r) for r in c.execute("SELECT subject,grade,correct,total,ts FROM results WHERE phone=? ORDER BY ts DESC LIMIT 50", (sp,)).fetchall()]
            last = rows[0]["ts"] if rows else None
            out.append({"phone": sp, "name": st["name"] if st else sp, "age": st["age"] if st else None,
                        "stats": _stats(rows), "last": last, "recent": rows[:10]})
    return jsonify({"ok": True, "students": out})

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
   <label>טלפון התלמיד</label><input id="sphone" inputmode="numeric" placeholder="0500000000">
   <label>קוד הורה (שהתלמיד קיבל בהרשמה)</label><input id="pcode" placeholder="3F9A2C">
   <button class="sec" onclick="linkStudent()">קשר תלמיד</button>
   <div id="lerr" class="err"></div>
 </div>

 <div id="students"></div>
</div>
<script>
 const SUBJ={english:"אנגלית",hebrew:"עברית",math:"חשבון"};
 function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
 function fmt(ts){ if(!ts) return "—"; const d=new Date(ts); return d.toLocaleDateString("he-IL"); }
 async function loadStudents(){
   document.getElementById("err").textContent="";
   const p=document.getElementById("pphone").value.replace(/\\D/g,"");
   if(p.length<9){document.getElementById("err").textContent="מספר טלפון לא תקין";return;}
   const r=await fetch("/api/parent/students?parent_phone="+p); const j=await r.json();
   const box=document.getElementById("students"); box.innerHTML="";
   if(!j.students||!j.students.length){box.innerHTML='<div class="card muted">לא נמצאו תלמידים מקושרים. קשרו תלמיד למעלה.</div>';return;}
   for(const s of j.students){
     const subs=Object.entries(s.stats||{}).map(([k,v])=>`<span class="subj">${esc(SUBJ[k]||k)}: <b>${esc(v.avg)}</b> ממוצע · שיא ${esc(v.best)} · ${esc(v.count)} מבחנים</span>`).join("");
     const rows=(s.recent||[]).map(x=>`<tr><td>${esc(SUBJ[x.subject]||x.subject)}</td><td>${esc(x.grade)}/100</td><td>${esc(x.correct)}/${esc(x.total)}</td><td>${esc(fmt(x.ts))}</td></tr>`).join("");
     box.insertAdjacentHTML("beforeend",
       `<div class="card"><div class="stud"><h3>${esc(s.name)} <span class="muted">· גיל ${esc(s.age||"?")} · פעילות אחרונה ${esc(fmt(s.last))}</span></h3>
        ${subs||'<span class="muted">אין עדיין תוצאות</span>'}
        ${rows?`<table><tr><th>מקצוע</th><th>ציון</th><th>נכונות</th><th>תאריך</th></tr>${rows}</table>`:""}
        </div></div>`);
   }
 }
 async function linkStudent(){
   document.getElementById("lerr").textContent="";
   const body={parent_phone:document.getElementById("pphone").value.replace(/\\D/g,"")||document.getElementById("sphone").value,
     parent_name:document.getElementById("pname").value,
     student_phone:document.getElementById("sphone").value.replace(/\\D/g,""),
     parent_code:document.getElementById("pcode").value};
   if(!body.parent_phone){document.getElementById("lerr").textContent="מלאו קודם את מספר הטלפון שלכם למעלה";return;}
   const r=await fetch("/api/parent/link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const j=await r.json();
   if(!j.ok){document.getElementById("lerr").textContent=j.error==="wrong parent code"?"קוד הורה שגוי":j.error==="student not found"?"תלמיד לא נמצא":"שגיאה: "+j.error;return;}
   document.getElementById("pphone").value=body.parent_phone;
   loadStudents();
 }
</script></body></html>"""

# ─── Standalone app (mounts the blueprint) ─────────────────────────────────
app = Flask(__name__)
app.register_blueprint(bp)

if __name__ == "__main__":
    init_db()
    print(f"[learn] DB={DB_PATH} DEV={DEV} → http://127.0.0.1:{PORT}")
    app.run(host="0.0.0.0", port=PORT)
