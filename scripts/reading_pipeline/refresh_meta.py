# -*- coding: utf-8 -*-
"""Refresh verses/verses_num/incipit/verse_count/sam_ch_id metadata for a
range of Genesis chapters from the CURRENT DB, without touching audio
(file/duration/src_start/src_end untouched). Use when the underlying
sam_chapters/verses tables changed (live-site edits) but the audio for
that chapter number is still correctly cut."""
import json, io, sqlite3, os, sys

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
        WHERE v.sam_ch_id=? ORDER BY c.number*1000+CAST(v.number AS INTEGER)""", (sid,)).fetchall()
    locs = [l[0] for l in locs]
    t1 = cur.execute("""SELECT v.text FROM verses v JOIN chapters c ON v.chapter_id=c.id
        WHERE v.sam_ch_id=? ORDER BY c.number*1000+CAST(v.number AS INTEGER) LIMIT 1""", (sid,)).fetchone()
    fl, ll = locs[0], locs[-1]
    return {
        "sam_ch_id": sid,
        "verses": u"%s:%s-%s:%s" % (gematria(fl // 1000), gematria(fl % 1000), gematria(ll // 1000), gematria(ll % 1000)),
        "verses_num": u"%d:%d-%d:%d" % (fl // 1000, fl % 1000, ll // 1000, ll % 1000),
        "verse_count": len(locs),
        "incipit": u" ".join((t1[0] if t1 else u"").split()[:4]),
    }

RANGE = range(92, 102)  # 92-101 inclusive

rd_path = os.path.join(TORAH, "web", "static", "audio", "readings", "readings.json")
rd = json.load(io.open(rd_path, encoding="utf-8"))
b1 = [b for b in rd["books"] if b["book_id"] == 1][0]

touched = 0
for c in b1["chapters"]:
    if c["n"] in RANGE:
        before = c["verses_num"]
        meta = chapter_meta(c["n"])
        c.update(meta)
        print(u"ch%3d: %s -> %s" % (c["n"], before, meta["verses_num"]))
        touched += 1

print(u"touched: %d" % touched)
out = json.dumps(rd, ensure_ascii=False, indent=1)
f = io.open(rd_path, "w", encoding="utf-8")
f.write(out)
f.close()
print(u"manifest written")
