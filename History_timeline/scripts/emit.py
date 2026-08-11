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
        "select ord, era, sort_year, name_he, period_he, description_he "
        "from people where sort_year < 3000 order by sort_year").fetchall()
    out = []
    for r in rows:
        out.append({
            "id": "p%d" % r["ord"],
            "year": int(r["sort_year"]),
            "name": r["name_he"],
            "period": r["period_he"] or "",
            "desc": (r["description_he"] or "")[:600],
        })
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
