# -*- coding: utf-8 -*-
"""Lay the sound design onto the 36-second timeline and mix it with the
supplied background track. The music level follows the story: subdued while
the problem is on screen, quietest in the teacher's office, up when the app
appears, fullest on the payoff."""
import subprocess, os

SP = "/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid"
FF = SP + "/node_modules/ffmpeg-static/ffmpeg"
MUSIC = "/root/.claude/uploads/600a0a39-fe1c-5671-aa13-aafcd45a293d/72a3cce8-sonicankidsmusicfriendlyplay567165.mp3"
DUR = 36.0

# (file, start second, gain) — one entry per audible cue
CUES = []
CUES += [("blip.wav", 0.9, 1.0), ("blip.wav", 2.4, 0.8)]          # scene 1: the phones
for i in range(8):                                                # scene 2: time draining
    CUES.append(("tick.wav", 3.9 + i * 0.42, 0.9 - i * 0.05))
CUES += [("uhoh.wav", 7.25, 1.0),                                 # scene 3: the office
         ("knock.wav", 8.25, 1.0), ("knock.wav", 8.95, 1.0)]
CUES += [("whoosh.wav", 12.15, 1.0)]                              # the turn
BEAT = 2.7
for i in range(6):                                                # scene 4: using the app
    t = 12.9 + i * BEAT
    if t > 26.6: break
    CUES.append(("tap.wav", t + 0.45, 1.0))
    if i % 2 == 1:
        CUES.append(("correct.wav", t + 1.15, 0.75))
CUES += [("celebrate.wav", 27.35, 1.0),                           # scene 5: they solved it
         ("correct.wav", 27.30, 0.9)]
CUES += [("chime.wav", 31.45, 1.0)]                               # scene 6: the logo

inputs = ["-i", MUSIC]
for f, _, _ in CUES:
    inputs += ["-i", SP + "/sfx/" + f]

# The music sits under the story; these are the level changes, in order.
music = (
    "[0:a]atrim=0:%0.2f,asetpts=N/SR/TB,"
    "volume=0.30:eval=frame:enable='between(t,0,7.2)',"
    "volume=0.20:eval=frame:enable='between(t,7.2,12.1)',"
    "volume=0.62:eval=frame:enable='between(t,12.1,27.2)',"
    "volume=0.78:eval=frame:enable='between(t,27.2,31.4)',"
    "volume=0.55:eval=frame:enable='gt(t,31.4)',"
    "afade=t=in:st=0:d=1.2,afade=t=out:st=%0.2f:d=1.6[m]" % (DUR, DUR - 1.6)
)

parts = [music]
labels = ["[m]"]
for n, (f, at, g) in enumerate(CUES, start=1):
    parts.append("[%d:a]volume=%0.2f,adelay=%d|%d[s%d]" % (n, g, int(at * 1000), int(at * 1000), n))
    labels.append("[s%d]" % n)

graph = ";".join(parts) + ";" + "".join(labels) + \
    "amix=inputs=%d:duration=first:normalize=0,alimiter=level_in=1:level_out=0.94:limit=0.95," \
    "aresample=48000,atrim=0:%0.2f[out]" % (len(labels), DUR)

cmd = [FF, "-y", "-loglevel", "error"] + inputs + \
      ["-filter_complex", graph, "-map", "[out]", "-ac", "2", "-ar", "48000",
       SP + "/audio.wav"]
subprocess.run(cmd, check=True)
print("cues placed:", len(CUES))
print("audio.wav:", round(os.path.getsize(SP + "/audio.wav") / 1e6, 1), "MB")
