# -*- coding: utf-8 -*-
"""מעלה את מספר הגרסה שבתגיות ה-?v= של index.html.

הדפדפן שומר את js/ ו-data/ במטמון לפי הכתובת, ולכן כל שינוי בקוד או בנתונים
מחייב העלאת גרסה — אחרת המבקרים (וגם הבדיקות) ימשיכו לקבל את הקובץ הישן.

הרצה:  py -3 scripts/bump_version.py
"""
import io
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "index.html")

s = io.open(p, encoding="utf-8").read()
cur = re.search(r"\?v=(\d+)\.(\d+)\.(\d+)", s)
if not cur:
    raise SystemExit("לא נמצאה תגית ?v= ב-index.html")
maj, mid, pat = (int(x) for x in cur.groups())
new = "%d.%d.%d" % (maj, mid, pat + 1)
s = re.sub(r"\?v=\d+\.\d+\.\d+", "?v=" + new, s)
io.open(p, "w", encoding="utf-8").write(s)
print("גרסת הנכסים: %d.%d.%d → %s" % (maj, mid, pat, new))
