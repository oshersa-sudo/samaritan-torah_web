import json, sys
sys.stdout.reconfigure(encoding="utf-8")
d = json.load(open(r"C:\Users\osher\Documents\torah\data\_eyalk_videos.json", encoding="utf-8-sig"))
ents = d.get("entries", [])
print("TOTAL:", len(ents))
print("CHANNEL:", d.get("title"), "|", d.get("channel"))
print("-" * 60)
for e in ents:
    dur = e.get("duration") or 0
    mm = int(dur // 60)
    ss = int(dur % 60)
    print(f"{e.get('id')}\t{mm:>3}:{ss:02d}\t{e.get('title')}")
