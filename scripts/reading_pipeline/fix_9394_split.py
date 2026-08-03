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

files = {}
for n in range(93, 103):
    files[n] = u"b1-p08-c%03d.mp3" % n
for n in range(103, 115):
    files[n] = u"b1-p09-c%03d.mp3" % n

durs = {93:61.75,94:48.33,95:53.73,96:59.38,97:70.06,98:45.53,99:46.52,100:49.74,101:36.75,102:186.19,
        103:103.94,104:57.60,105:66.39,106:60.57,107:67.79,108:76.59,109:130.36,110:100.38,111:58.00,112:48.23,113:59.69,114:57.86}

rd_path = os.path.join(TORAH, "web", "static", "audio", "readings", "readings.json")
rd = json.load(io.open(rd_path, encoding="utf-8"))
b1 = [b for b in rd["books"] if b["book_id"] == 1][0]

by_n = {}
for c in b1["chapters"]:
    by_n.setdefault(c["n"], []).append(c)

# reference entry to copy portion/src scaffolding from
ref93 = by_n[93][0]
ref102 = by_n[102][0] if 102 in by_n else ref93   # was p9's portion before

kept = []
for c in b1["chapters"]:
    if 93 <= c["n"] <= 114:
        continue  # rebuilt below (114 also rebuilt: it now holds old-113's audio)
    kept.append(c)

new_entries = []
for n in sorted(durs):
    src_ref = ref93 if n <= 101 else ref102
    entry = {
        "n": n,
        "sam_ch_number": n,
        "file": u"/static/audio/readings/" + files[n],
        "duration": round(durs[n], 2),
        "src_start": 0, "src_end": round(durs[n], 2),
        "portion": src_ref["portion"],
        "src": src_ref["src"],
    }
    meta = chapter_meta(n)
    entry.update(meta)
    entry["name"] = u"בראשית - %s - %d" % (entry["portion"]["name"], n)
    new_entries.append(entry)

kept.extend(new_entries)
b1["chapters"] = kept

ns = sorted(c["n"] for c in b1["chapters"])
dups = [n for n in set(ns) if ns.count(n) > 1]
assert not dups, ("DUPLICATES", dups)
print(u"total entries: %d" % len(ns))
print(u"new range 93-114 written: %d entries" % len(new_entries))

out = json.dumps(rd, ensure_ascii=False, indent=1)
f = io.open(rd_path, "w", encoding="utf-8")
f.write(out)
f.close()
print(u"manifest written")
