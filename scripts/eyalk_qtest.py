# -*- coding: utf-8 -*-
import os, sys, time
import glob as _glob
SITE = os.path.join(os.path.dirname(os.__file__), "site-packages")
_bins = _glob.glob(os.path.join(SITE, "nvidia", "*", "bin"))
for p in _bins:
    os.add_dll_directory(p)
os.environ["PATH"] = os.pathsep.join(_bins) + os.pathsep + os.environ.get("PATH", "")
sys.stdout.reconfigure(encoding="utf-8")
from faster_whisper import WhisperModel

AUDIO = r"C:\Users\osher\Documents\torah\data\_eyalk_audio\R_qQhP2mZa4.webm"
t = time.time()
model = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
print(f"loaded large-v3 in {time.time()-t:.1f}s", flush=True)
t = time.time()
segs, info = model.transcribe(AUDIO, language="he", beam_size=5,
    vad_filter=True, condition_on_previous_text=False, clip_timestamps="0,120")
out = []
for s in segs:
    out.append(s.text.strip())
dt = time.time() - t
print(f"transcribed 120s in {dt:.0f}s ({120/dt:.1f}x realtime)", flush=True)
print("--- sample text ---", flush=True)
print("\n".join(out), flush=True)
