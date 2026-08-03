# -*- coding: utf-8 -*-
"""Fix the 'portion' metadata field (and derived 'name' field) on every
Genesis manifest entry to match the LIVE portion structure fetched from
the deployed API — NOT local torah.db's portions table, which may lag.
This does not touch audio/file/duration/verses, only display metadata
that was left stale by earlier relabeling this session."""
import json, io, os

TORAH = r"C:\Users\osher\Documents\torah"
SCRIPT_DIR = os.path.join(TORAH, "scripts", "reading_pipeline")

portions = json.load(io.open(os.path.join(SCRIPT_DIR, "live_portions.json"), encoding="utf-8"))
portions_by_id = {p["id"]: p for p in portions}

chapter_to_portion = {}
for pid in range(1, 21):
    chs = json.load(io.open(os.path.join(SCRIPT_DIR, "live_p%d.json" % pid), encoding="utf-8"))
    for c in chs:
        chapter_to_portion[c["number"]] = pid

rd_path = os.path.join(TORAH, "web", "static", "audio", "readings", "readings.json")
rd = json.load(io.open(rd_path, encoding="utf-8"))
b1 = [b for b in rd["books"] if b["book_id"] == 1][0]

# order_n isn't in the live API response; use array index+1 as portion order (matches
# id here since ids 1-20 are sequential for Genesis) unless a distinct order field exists
fixed = 0
unmapped = []
for c in b1["chapters"]:
    n = c["n"]
    pid = chapter_to_portion.get(n)
    if pid is None:
        unmapped.append(n)
        continue
    p = portions_by_id[pid]
    new_portion = {"order": pid, "id": pid, "name": p["name"]}
    if c.get("portion") != new_portion:
        c["portion"] = new_portion
        c["name"] = u"בראשית - %s - %d" % (p["name"], n)
        fixed += 1

print(u"fixed portion labels: %d" % fixed)
print(u"chapters with no live portion mapping (not necessarily a problem, may be beyond our manifest's max n): %s" % unmapped)

out = json.dumps(rd, ensure_ascii=False, indent=1)
f = io.open(rd_path, "w", encoding="utf-8")
f.write(out)
f.close()
print(u"manifest written")
