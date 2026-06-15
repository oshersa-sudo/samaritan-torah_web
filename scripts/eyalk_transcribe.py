# -*- coding: utf-8 -*-
"""Transcribe all manifest audio with faster-whisper (GPU large-v3).
Writes one .txt per video. Skips already-done. Logs timing + speed.
Usage: eyalk_transcribe.py [model] [compute_type]
"""
import os, sys, json, glob, time

# --- make bundled CUDA libs (cublas, cudart, cudnn) discoverable ---
import glob as _glob
SITE = os.path.join(os.path.dirname(os.__file__), "site-packages")
_bins = _glob.glob(os.path.join(SITE, "nvidia", "*", "bin"))
for p in _bins:
    os.add_dll_directory(p)
os.environ["PATH"] = os.pathsep.join(_bins) + os.pathsep + os.environ.get("PATH", "")

sys.stdout.reconfigure(encoding="utf-8")
from faster_whisper import WhisperModel

MAN   = r"C:\Users\osher\Documents\torah\data\_eyalk_manifest.json"
ADIR  = r"C:\Users\osher\Documents\torah\data\_eyalk_audio"
TDIR  = r"C:\Users\osher\Documents\torah\data\_eyalk_transcripts"
LOG   = r"C:\Users\osher\Documents\torah\data\_eyalk_transcribe.log"
os.makedirs(TDIR, exist_ok=True)

MODEL   = sys.argv[1] if len(sys.argv) > 1 else "large-v3"
CTYPE   = sys.argv[2] if len(sys.argv) > 2 else "int8_float16"
# comma-separated series to include (default: long lectures only — the short
# series is Samaritan Torah reading/cantillation, not commentary)
SERIES  = set((sys.argv[3] if len(sys.argv) > 3 else "long").split(","))

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def audio_for(vid):
    c = [p for p in glob.glob(os.path.join(ADIR, vid + ".*")) if not p.endswith(".part")]
    return c[0] if c else None

man = json.load(open(MAN, encoding="utf-8"))
man = [m for m in man if m["series"] in SERIES]
log(f"=== transcribe start: model={MODEL} ctype={CTYPE} series={sorted(SERIES)} videos={len(man)} ===")
t0 = time.time()
model = WhisperModel(MODEL, device="cuda", compute_type=CTYPE)
log(f"model loaded in {time.time()-t0:.1f}s")

done = skip = miss = fail = 0
for i, m in enumerate(man, 1):
    vid = m["id"]
    outp = os.path.join(TDIR, vid + ".txt")
    if os.path.exists(outp) and os.path.getsize(outp) > 50:
        skip += 1
        continue
    ap = audio_for(vid)
    if not ap:
        miss += 1
        log(f"({i}/{len(man)}) MISSING audio {vid}")
        continue
    try:
        t = time.time()
        segs, info = model.transcribe(
            ap, language="he", beam_size=5,
            vad_filter=True, vad_parameters=dict(min_silence_duration_ms=500),
            condition_on_previous_text=False,
        )
        lines = []
        for s in segs:
            lines.append(s.text.strip())
        text = "\n".join(lines)
        header = f"# {m['title']}\n# id={vid} series={m['series']} dur={info.duration:.0f}s\n\n"
        with open(outp, "w", encoding="utf-8") as f:
            f.write(header + text + "\n")
        dt = time.time() - t
        rt = info.duration / dt if dt else 0
        done += 1
        log(f"({i}/{len(man)}) DONE {vid} {m['title'][:30]} | {info.duration:.0f}s audio in {dt:.0f}s ({rt:.1f}x) chars={len(text)}")
    except Exception as e:
        fail += 1
        log(f"({i}/{len(man)}) FAIL {vid}: {type(e).__name__}: {e}")

log(f"=== transcribe done: done={done} skip={skip} miss={miss} fail={fail} total={time.time()-t0:.0f}s ===")
