# -*- coding: utf-8 -*-
"""Download best audio for each manifest video into data/_eyalk_audio/.
No re-encode (no ffmpeg needed). Skips files already present. Logs progress.
"""
import json, os, sys, subprocess, glob, time
sys.stdout.reconfigure(encoding="utf-8")

MAN = r"C:\Users\osher\Documents\torah\data\_eyalk_manifest.json"
ADIR = r"C:\Users\osher\Documents\torah\data\_eyalk_audio"
LOG = r"C:\Users\osher\Documents\torah\data\_eyalk_download.log"
os.makedirs(ADIR, exist_ok=True)
PY = sys.executable

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")

man = json.load(open(MAN, encoding="utf-8"))
log(f"=== download start: {len(man)} videos ===")
ok = skip = fail = 0
for i, m in enumerate(man, 1):
    vid = m["id"]
    existing = glob.glob(os.path.join(ADIR, vid + ".*"))
    existing = [p for p in existing if not p.endswith(".part")]
    if existing:
        skip += 1
        continue
    url = f"https://www.youtube.com/watch?v={vid}"
    out = os.path.join(ADIR, "%(id)s.%(ext)s")
    cmd = [PY, "-m", "yt_dlp", "-f", "bestaudio/best",
           "--no-playlist", "-o", out, "--quiet", "--no-warnings", url]
    log(f"({i}/{len(man)}) downloading {vid}  {m['title']}")
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode == 0 and glob.glob(os.path.join(ADIR, vid + ".*")):
        ok += 1
    else:
        fail += 1
        log(f"   FAIL {vid}: {(r.stderr or '')[-300:]}")
log(f"=== download done: ok={ok} skip={skip} fail={fail} ===")
