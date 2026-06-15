# -*- coding: utf-8 -*-
import sys, time
sys.stdout.reconfigure(encoding="utf-8")
from faster_whisper import WhisperModel

AUDIO = r"C:\Users\osher\Documents\torah\data\_eyalk_audio\R_qQhP2mZa4.webm"

for device, ctype in [("cuda", "int8_float16"), ("cuda", "float16"), ("cpu", "int8")]:
    try:
        print(f"\n--- trying {device}/{ctype} ---", flush=True)
        t = time.time()
        model = WhisperModel("small", device=device, compute_type=ctype)
        print(f"loaded model in {time.time()-t:.1f}s", flush=True)
        t = time.time()
        segs, info = model.transcribe(AUDIO, language="he", beam_size=1)
        first = next(iter(segs))
        print(f"first segment in {time.time()-t:.1f}s: {first.text!r}", flush=True)
        print(f"detected lang={info.language} dur={info.duration:.0f}s", flush=True)
        print(f"SUCCESS device={device} ctype={ctype}", flush=True)
        break
    except Exception as e:
        print(f"FAILED {device}/{ctype}: {type(e).__name__}: {e}", flush=True)
