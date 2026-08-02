# -*- coding: utf-8 -*-
import json, io, sqlite3, os

TORAH = r"C:\Users\osher\Documents\torah"

def gematria(n):
    ones = ["", u"א", u"ב", u"ג", u"ד", u"ה", u"ו", u"ז", u"ח", u"ט"]
    tens = ["", u"י", u"כ", u"ל", u"מ", u"נ", u"ס", u"ע", u"פ", u"צ"]
    if n <= 0: return unicode(n)
    t, o = divmod(n, 10)
    s = (tens[t] if t < 10 else u"ק") + ones[o]
    return {u"יה": u"טו", u"יו": u"טז"}.get(s, s)

con = sqlite3.connect(os.path.join(TORAH, "data", "torah.db"))
cur = con.cursor()

def chapter_meta(sam_num):
    sid = cur.execute("select id from sam_chapters where book_id=1 and number=?", (sam_num,)).fetchone()[0]
    locs = cur.execute("""SELECT c.number*1000+CAST(v.number AS INTEGER)
        FROM verses v JOIN chapters c ON v.chapter_id=c.id
        WHERE v.sam_ch_id=? ORDER BY v.id""", (sid,)).fetchall()
    locs = [l[0] for l in locs]
    t1 = cur.execute("SELECT text FROM verses WHERE sam_ch_id=? ORDER BY id LIMIT 1", (sid,)).fetchone()
    fl, ll = locs[0], locs[-1]
    return {
        "sam_ch_id": sid,
        "verses": u"%s:%s-%s:%s" % (gematria(fl // 1000), gematria(fl % 1000), gematria(ll // 1000), gematria(ll % 1000)),
        "verses_num": u"%d:%d-%d:%d" % (fl // 1000, fl % 1000, ll // 1000, ll % 1000),
        "verse_count": len(locs),
        "incipit": u" ".join((t1[0] if t1 else u"").split()[:4]),
    }

rd_path = os.path.join(TORAH, "web", "static", "audio", "readings", "readings.json")
rd = json.load(io.open(rd_path, encoding="utf-8"))
b1 = [b for b in rd["books"] if b["book_id"] == 1][0]

shifts = {}
for old in range(91, 101):
    shifts[old] = (old + 1, u"b1-p08-c%03d.mp3" % (old + 1))
for old in range(101, 113):
    shifts[old] = (old + 1, u"b1-p09-c%03d.mp3" % (old + 1))
for old in range(113, 127):
    shifts[old] = (old + 1, u"b1-p10-c%03d.mp3" % (old + 1))

touched = 0
for c in b1["chapters"]:
    if c["n"] in shifts:
        new_n, new_file = shifts[c["n"]]
        meta = chapter_meta(new_n)
        c["n"] = new_n
        c["sam_ch_number"] = new_n
        c["file"] = u"/static/audio/readings/" + new_file
        c["name"] = u"בראשית - %s - %d" % (c["portion"]["name"], new_n)
        c.update(meta)
        touched += 1

ns = sorted(c["n"] for c in b1["chapters"])
dups = [n for n in set(ns) if ns.count(n) > 1]
assert not dups, ("DUPLICATES", dups)
missing = [n for n in range(1, 239) if n not in ns]
print(u"touched: %d entries" % touched)
print(u"total entries: %d | missing: %s" % (len(ns), missing))

out = json.dumps(rd, ensure_ascii=False, indent=1)
f = io.open(rd_path, "w", encoding="utf-8")
f.write(out)
f.close()
print(u"manifest written")
