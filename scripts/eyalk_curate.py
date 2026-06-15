# -*- coding: utf-8 -*-
"""Curate the parasha-lecture videos from the channel dump into a manifest.
Selects long-form lectures + the short parallel series, excludes liturgy/clips.
"""
import json, sys
sys.stdout.reconfigure(encoding="utf-8")

SRC = r"C:\Users\osher\Documents\torah\data\_eyalk_videos.json"
OUT = r"C:\Users\osher\Documents\torah\data\_eyalk_manifest.json"

# Explicit include lists by series. id -> ordering key (book, seq) added later.
# LONG: full lectures 32-91 min
LONG = [
    "x-s1sGJz1-A",  # בראשית פרשנות לפרשת השבוע
    "0u_lfOzWBm8",  # וידע אדם + ואני הנני
    "knhILI0MbRM",  # אל לבו (נח)
    "lpwqoGi8Jak",  # לך לך
    "qZA-QJaqXgE",  # ויהי אברם
    "q-UxJzvaQWo",  # ויהוה פקד
    "Lpd7Ia9U0Hg",  # ואברהם זקן
    "DG0Lq2BeZ70",  # ואלה תולדת יצחק
    "drQYHQKhZaY",  # וישא יעקב רגליו / ויקם יעקב
    "Kn4UIETq8fc",  # ותצא דינה
    "oFbZDZ_HJnM",  # ויוסף הורד / וליוסף ילדו
    "4Dr0OAA3zjk",  # ויבא יוסף הביתה
    "vnfCbxXQFzY",  # אל שדי / בן פרת יוסף
    "zxgoIMNC66Y",  # ואלה שמות
    "3zTq25ecGKI",  # כי ידבר
    "ghThYIausAM",  # ויסע משה
    "5nIDlc0qqDc",  # בחודש השלישי
    "Tu5GzS71FdQ",  # היום הזה
    "ZZbiAZ2iTqY",  # ויקחו לי תרומה
    "C1SERK_RkTY",  # החודש השביעי
    "QNqRX_AOx5A",  # שופטים ושוטרים
    "li3079iLdno",  # כי יקח איש אשה
    "3vIZSNCJZQM",  # האזינו השמים
]
# SHORT: parallel run-through 3-40 min
SHORT = [
    "R_qQhP2mZa4",  # בראשית
    "sh96PJI6RNo",  # ואדם ידע
    "TJnWj5Qvcxs",  # וידע אדם
    "N_fSSrYur1g",  # ואני הנני
    "GGv2unbzz4o",  # אל לבו
    "z_QiLQkT9HQ",  # לך לך
    "gdCS6_DbTpo",  # ויהי אברם
    "Ccn74OC70Qg",  # ויהוה פקד
    "oICJ65HNimc",  # ואברהם זקן
    "3AZ1Ar8cqN8",  # אלה תודת יצחק
    "oeQbJQKlVBU",  # אלה תודת יצחק (2)
    "Fs0khj7BY5g",  # וישא יעקב א
    "Vp8UMc2cP5w",  # ויקם יעקב
    "dY50GyHrdXk",  # ותצא דינה
    "Vzh8yOt0f6w",  # וישב יעקב
    "r-udLebudMg",  # ויוסף הורד
    "q7SXYiRcVJI",  # וליוסף ילידו
    "iovEM8nXZVc",  # ויבא יוסף הביתה
    "NltRiJoXwBg",  # ואלה שמות
    "m0rwjElPrLY",  # אל שדי
    "Wv9QyMCVd5Y",  # בן פרת יוסף
    "qvacJOBiMf8",  # ואלה שמות
    "VFDkBipRNqk",  # כי ידבר
    "eiyWxwyhJjQ",  # ואל אהרון
    "Mg07J7OHFEU",  # ויסע משה
    "jtFSLKUzQ5c",  # בחודש השלישי
    "73HJzKULh4o",  # וה הדבר
    "uO3_MJeYzzY",  # אלה המשפטים
    "wFaaTTqYREQ",  # טיקחו לי תרומה
    "veqabhxb0OY",  # ויקרא אל משה
    "FhkASiGgeas",  # ויתן אל משה
    "upDtmYMee4A",  # ויעש את הקרשים
    "fTQG7fdhQRc",  # צוה את אהרון
    "0euccTxU7EM",  # וישא אהרון
    "XoZeQ4aFCU4",  # ואיש או אשה
    "aogBwymaV_U",  # אחורי מות
    "kyRmh5B0guA",  # ובקצרכם
    "K7LGpyW-EQg",  # מועדי
    "XjsdbiNaZW4",  # אם בחקותי
    "2aZzfzQlHK0",  # במדבר סיני
    "yH7rF7DmCtw",  # נשא את ראש
    "MHPEePHJ-AE",  # דבר אל אהרון
    "JmJhmFXyBj4",  # שלח לך אנשים
    "0Iz0521K60s",  # וישלח משה מלאכים
    "QmvWmuj_1PY",  # ויקח קרח
    "sELILBr_CsY",  # ויהי המלקח
    "7P9e8BkEX1Y",  # פינחס
    "IR29k97rOes",  # אלה הדברים
    "eqNfxbicK8Q",  # ראו למדתי
    "yYEB3GfP8cQ",  # כי יביאך
    "-e5pgHn-aD4",  # כי אתם עברים
    "3U7TpzJ9hmQ",  # בנים אתם
    "gO5SdUGInrE",  # שופטים א
    "-yWUNY8GzHI",  # שופטים ב
    "_RXTkmmx3T0",  # כי יקח איש אשה
    "0LgEAFzyY2g",  # היום הזה
    "RxwuATc2mzQ",  # והיה כי יבאו
    "nBL49qnma5Q",  # וידבר משה באזני
    "AfhxSVGCItw",  # זאת הברכה (כולל כתוביות)
]

d = json.load(open(SRC, encoding="utf-8-sig"))
by_id = {e["id"]: e for e in d.get("entries", [])}

manifest = []
for series, ids in (("long", LONG), ("short", SHORT)):
    for i, vid in enumerate(ids):
        e = by_id.get(vid)
        if not e:
            print("MISSING:", vid)
            continue
        manifest.append({
            "id": vid,
            "title": e.get("title"),
            "duration": e.get("duration"),
            "series": series,
            "order": i,
        })

json.dump(manifest, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
tot = sum((m["duration"] or 0) for m in manifest)
print(f"selected: {len(manifest)} videos | long={len(LONG)} short={len(SHORT)}")
print(f"total audio: {tot/3600:.1f} hours")
