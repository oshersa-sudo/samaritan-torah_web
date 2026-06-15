# -*- coding: utf-8 -*-
import os, sys, time, glob as _glob
SITE = os.path.join(os.path.dirname(os.__file__), "site-packages")
_bins = _glob.glob(os.path.join(SITE, "nvidia", "*", "bin"))
for p in _bins:
    os.add_dll_directory(p)
os.environ["PATH"] = os.pathsep.join(_bins) + os.pathsep + os.environ.get("PATH", "")
sys.stdout.reconfigure(encoding="utf-8")
from faster_whisper import WhisperModel

vid = sys.argv[1]
start = sys.argv[2] if len(sys.argv) > 2 else "180"
end = sys.argv[3] if len(sys.argv) > 3 else "330"
AUDIO = _glob.glob(rf"C:\Users\osher\Documents\torah\data\_eyalk_audio\{vid}.*")[0]
model = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
segs, info = model.transcribe(AUDIO, language="he", beam_size=5,
    vad_filter=True, condition_on_previous_text=False, clip_timestamps=f"{start},{end}")
for s in segs:
    print(s.text.strip(), flush=True)
