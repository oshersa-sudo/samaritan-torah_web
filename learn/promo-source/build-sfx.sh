#!/bin/bash
# Build the scene sound effects. Everything is synthesised here except the
# app's own recorded sounds, which are reused so the ad sounds like the product.
set -e
SP=/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid
FF=$SP/node_modules/ffmpeg-static/ffmpeg
S=/home/user/samaritan-torah_web/learn/static/sounds
mkdir -p $SP/sfx
Q="-y -loglevel error"

# a dull notification blip — the sound of another hour disappearing
$FF $Q -f lavfi -i "sine=frequency=760:duration=0.16:sample_rate=44100" \
  -af "volume=0.5,afade=t=in:st=0:d=0.01,afade=t=out:st=0.05:d=0.11,lowpass=f=2200" \
  -ac 2 $SP/sfx/blip.wav

# clock tick — a short dry click
$FF $Q -f lavfi -i "anoisesrc=color=white:duration=0.04:sample_rate=44100:amplitude=0.5" \
  -af "highpass=f=1800,lowpass=f=6000,afade=t=out:st=0.004:d=0.034,volume=0.5" \
  -ac 2 $SP/sfx/tick.wav

# the drop into the teacher's office — a low descending tone
$FF $Q -f lavfi -i "sine=frequency=300:duration=1.1:sample_rate=44100" \
  -af "asetrate=44100*1.0,atempo=1.0,volume=0.42,afade=t=in:st=0:d=0.05,afade=t=out:st=0.5:d=0.6,lowpass=f=900" \
  -ac 2 $SP/sfx/low_a.wav
$FF $Q -f lavfi -i "sine=frequency=196:duration=1.4:sample_rate=44100" \
  -af "volume=0.34,afade=t=in:st=0.15:d=0.15,afade=t=out:st=0.6:d=0.8,lowpass=f=700" \
  -ac 2 $SP/sfx/low_b.wav
$FF $Q -i $SP/sfx/low_a.wav -i $SP/sfx/low_b.wav \
  -filter_complex "[0][1]amix=inputs=2:normalize=0,volume=1.2" $SP/sfx/uhoh.wav

# a soft knock on the desk
$FF $Q -f lavfi -i "sine=frequency=170:duration=0.13:sample_rate=44100" \
  -af "volume=0.5,afade=t=out:st=0.01:d=0.12,lowpass=f=600" -ac 2 $SP/sfx/knock.wav

# the turn: a bright rising whoosh into the app
$FF $Q -f lavfi -i "anoisesrc=color=pink:duration=0.85:sample_rate=44100:amplitude=0.8" \
  -af "highpass=f=400,lowpass=f=7000,afade=t=in:st=0:d=0.55,afade=t=out:st=0.6:d=0.25,volume=0.45" \
  -ac 2 $SP/sfx/whoosh.wav

# the closing chime — a bright open fifth
$FF $Q -f lavfi -i "sine=frequency=1318:duration=1.6:sample_rate=44100" \
  -af "volume=0.3,afade=t=out:st=0.1:d=1.5" -ac 2 $SP/sfx/ch_a.wav
$FF $Q -f lavfi -i "sine=frequency=1976:duration=1.6:sample_rate=44100" \
  -af "volume=0.22,afade=t=out:st=0.05:d=1.55" -ac 2 $SP/sfx/ch_b.wav
$FF $Q -f lavfi -i "sine=frequency=659:duration=1.8:sample_rate=44100" \
  -af "volume=0.26,afade=t=out:st=0.15:d=1.65" -ac 2 $SP/sfx/ch_c.wav
$FF $Q -i $SP/sfx/ch_a.wav -i $SP/sfx/ch_b.wav -i $SP/sfx/ch_c.wav \
  -filter_complex "[0][1][2]amix=inputs=3:normalize=0" $SP/sfx/chime.wav

# the app's own sounds, normalised to the ad's level
$FF $Q -i $S/sfx-tap.wav      -af "volume=1.6"  -ac 2 -ar 44100 $SP/sfx/tap.wav
$FF $Q -i $S/sfx-correct.wav  -af "volume=0.85" -ac 2 -ar 44100 $SP/sfx/correct.wav
$FF $Q -i $S/celebrate.wav    -af "volume=0.95" -ac 2 -ar 44100 $SP/sfx/celebrate.wav

ls -la $SP/sfx/*.wav | awk '{print $5, $9}'
