# -*- coding: utf-8 -*-
"""חישוב טווחי הכהונה וכתיבת קבצי ה-JS. נטען ע"י build_data.py."""
import json
import os
import sqlite3

TORAH_DB = r"C:\Users\osher\Documents\torah\data\torah.db"

# עוגנים היסטוריים לרשימת הכהנים — מספר הכהן → השנה שבה מתחילה כהונתו.
# הם נגזרים מן הסינכרוניזמים שהספר עצמו מוסר (גלות אשור, גלות בבל, אלכסנדר,
# צליבת ישו, אספסיאנוס, אדריאנוס), ומאפשרים לפרוש את שנות הכהונה על ציר
# היסטורי אמיתי. המחבר עצמו מעיר ש"חלק משנות הכהונה חופפות", ולכן הטווחים
# המוצגים הם הערכה — שנות הכהונה עצמן מוצגות בכרטיס כפי שנמסרו.
ANCHORS = {1: -1644, 7: -1384, 24: -740, 29: -594, 35: -343, 45: 25, 46: 60, 54: 120}
BLOCK1_END = 177          # סוף כהונת הכהן ה-55
BLOCK2_START = 790        # הטווח הנקוב בספר לכהן ה-78
GAP_NOTE = ("העמודים שבהם נדפס המשך הרשימה הממוספרת נפגעו בסריקה (טשטוש תנועה) "
            "ואינם ניתנים לקריאה. סריקה חוזרת של אותם עמודים תשלים את החסר.")


def _spans(items, y0, y1):
    """פורש רשימת (מס׳, שם, שנים, הערה) על הטווח [y0,y1] ביחס לשנות הכהונה."""
    total = sum(max(1, it[2] or 1) for it in items)
    out, cur = [], float(y0)
    scale = (y1 - y0) / total if total else 0
    for it in items:
        w = max(1, it[2] or 1) * scale
        out.append((it, int(round(cur)), int(round(cur + w))))
        cur += w
    return out


def build_priests(BLOCK1, BLOCK2, BLOCK3, MODERN, src_book, src_ext):
    P = []

    def add(n, name, years, frm, to, note, src, gap=False):
        P.append({"n": n, "name": name, "years": years, "from": frm, "to": to,
                  "note": note, "src": src, "gap": gap})

    # ── חסימה 1: כהנים 1–55, פרישה בין עוגנים היסטוריים ──
    marks = sorted(ANCHORS.keys())
    for i, start_n in enumerate(marks):
        end_n = marks[i + 1] if i + 1 < len(marks) else 56
        seg = [it for it in BLOCK1 if start_n <= it[0] < end_n]
        y0 = ANCHORS[start_n]
        y1 = ANCHORS[end_n] if end_n in ANCHORS else BLOCK1_END
        for it, a, b in _spans(seg, y0, y1):
            add(it[0], it[1], it[2], a, b, it[3], src_book)

    add(None, "פער ברשימה — הכהנים 56–77", None, BLOCK1_END, BLOCK2_START,
        GAP_NOTE, src_book, gap=True)

    # ── חסימה 2: כהנים 78–87 ──
    add(78, BLOCK2[0][1], BLOCK2[0][2], 790, 806, BLOCK2[0][3], src_book)
    cur = 806
    for it in BLOCK2[1:]:
        add(it[0], it[1], it[2], cur, cur + it[2], it[3], src_book)
        cur += it[2]

    add(None, "פער ברשימה — הכהנים 88–94", None, cur, 1115, GAP_NOTE, src_book, gap=True)

    # ── חסימה 3: כהנים 95–102, שנים מפורשות בספר ──
    for n, name, yrs, a, b, note in BLOCK3:
        add(n, name, yrs, a, b, note, src_book)

    # ── התקופה החדשה ──
    prev_end = BLOCK3[-1][4]
    for n, name, yrs, a, b, note, src in MODERN:
        if a - prev_end > 5:
            add(None, "פער ברשימה", None, prev_end, a, GAP_NOTE, src_book, gap=True)
        add(n, name, yrs, a, b, note, src)
        prev_end = b

    P.sort(key=lambda p: p["from"])
    return P


def load_people():
    con = sqlite3.connect(TORAH_DB)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        "select ord, era, sort_year, name_he, period_he, description_he, "
        "       name_en, period, description_en, name_ar, period_ar, description_ar "
        "from people where sort_year < 3000 order by sort_year").fetchall()
    out = []
    for r in rows:
        rec = {
            "id": "p%d" % r["ord"],
            "year": int(r["sort_year"]),
            "name": r["name_he"],
            "period": r["period_he"] or "",
            "desc": (r["description_he"] or "")[:600],
        }
        for lang in ("en", "ar"):
            rec[lang] = {
                "n": r["name_" + lang] or "",
                "p": (r["period"] if lang == "en" else r["period_ar"]) or "",
                "d": (r["description_" + lang] or "")[:600],
            }
        out.append(rec)
    return out


def build_roster(rows, src):
    """רשימת (שם, מ־, עד, הערה) → פריטי רצועה, עם סימון פערים."""
    out, prev = [], None
    for name, a, b, note in rows:
        if prev is not None and a - prev > 1:
            out.append({"n": None, "name": "—", "years": None, "from": prev, "to": a,
                        "note": "", "src": src, "gap": True})
        out.append({"n": None, "name": name, "years": b - a, "from": a, "to": b,
                    "note": note, "src": src, "gap": False})
        prev = b
    return out


def js(path, varname, obj, header):
    with open(path, "w", encoding="utf-8") as f:
        f.write("/* %s */\n" % header)
        f.write("window.%s = " % varname)
        json.dump(obj, f, ensure_ascii=False, indent=0, separators=(",", ":"))
        f.write(";\n")
    print("  %-16s %6.1f KB" % (os.path.basename(path), os.path.getsize(path) / 1024))


def build_i18n(evs, rosters, periods, people, en_a, en_b, ar_a, ar_b, misc):
    """מרכיב את מילון התרגומים לפי המזהים שבקבצי הנתונים."""
    EN = dict(en_a); EN.update(en_b)
    AR = dict(ar_a); AR.update(ar_b)
    out = {"en": {"events": {}, "rosters": {}, "periods": {}},
           "ar": {"events": {}, "rosters": {}, "periods": {}}}
    missing = {"en": [], "ar": []}

    people_by_id = {p["id"]: p for p in people}

    for e in evs:
        if e["id"] in people_by_id:          # אישים — התרגום כבר במסד הנתונים
            pr = people_by_id[e["id"]]
            for lang in ("en", "ar"):
                tr = pr[lang]
                if tr["n"]:
                    out[lang]["events"][e["id"]] = {
                        "t": tr["n"],
                        "b": (tr["p"] + chr(10) + chr(10) + tr["d"]).strip(),
                    }
            continue
        for lang, TB in (("en", EN), ("ar", AR)):
            rec = TB.get(e["title"])
            if rec:
                out[lang]["events"][e["id"]] = {"t": rec[0], "b": rec[1]}
            else:
                missing[lang].append(e["title"])

    for r in rosters:
        for it in r["items"]:
            key = "%s:%d" % (r["id"], it["from"])
            for lang, idx in (("en", 0), ("ar", 1)):
                nm = misc.translate_name(it["name"], idx)
                if nm:
                    out[lang]["rosters"][key] = {"n": nm}

    for p in periods:
        rec = misc.PERIODS_T.get(p["name"])
        if rec:
            out["en"]["periods"][str(p["from"])] = {"n": rec[0]}
            out["ar"]["periods"][str(p["from"])] = {"n": rec[1]}

    for lang in ("en", "ar"):
        if missing[lang]:
            print("  ! חסר תרגום %s ל-%d אירועים:" % (lang, len(missing[lang])))
            for t in missing[lang][:6]:
                print("      " + t)
    return out
