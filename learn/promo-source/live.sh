#!/bin/bash
# Rebuild the film with live footage under the three scenes that show people.
#
# The clips are 16:9 and the film is 9:16, so each is scaled to cover the
# vertical frame and cropped, with a slow push-in so the crop reads as a choice
# rather than an accident. The captions, timing and sound are the ones already
# built — only the picture underneath them changes.
#
# The app section and the closing logo stay as they are: they are the product.
set -e
SP=/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid
FF=$SP/node_modules/ffmpeg-static/ffmpeg
U=/root/.claude/uploads/600a0a39-fe1c-5671-aa13-aafcd45a293d
FILM=/home/user/samaritan-torah_web/learn/static/promo/onyx-learn-promo-1080x1920.mp4
OUT=/home/user/samaritan-torah_web/learn/static/promo
Q="-y -loglevel error"

SOFA="$U/7ed24610-istockphoto1424847445640_adpp_is.mp4"      # three kids sprawled on a sofa
NIGHT="$U/5fc867f8-istockphoto2036702952640_adpp_is.mp4"     # a boy in the dark, phone on his face
MEET="$U/65afe488-istockphoto1352712343640_adpp_is.mp4"      # parent and child facing a teacher
TOGETHER="$U/5c23e46b-istockphoto2138768850640_adpp_is.mp4"  # two kids over one screen, delighted

# cover-crop a 16:9 clip into the 9:16 frame, with a push-in
shot () {  # $1 src  $2 in  $3 dur  $4 frames  $5 grade  $6 out
  $FF $Q -ss "$2" -t "$3" -i "$1" -filter_complex \
"[0:v]fps=30,scale=-2:1920:flags=lanczos,crop=1080:1920:(iw-1080)/2:0,\
zoompan=z='min(1.0+0.06*on/$4,1.06)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,\
$5,setsar=1[v]" -map "[v]" -an -c:v libx264 -preset fast -crf 16 -pix_fmt yuv420p "$6"
}

# ── 0.00–3.60 · the problem, wide ───────────────────────────────────────────
shot "$SOFA" 1.6 3.60 108 "eq=saturation=0.88:contrast=1.04:brightness=-0.02" $SP/s1.mp4
# ── 3.60–7.23 · hours later, in the dark ────────────────────────────────────
shot "$NIGHT" 6.0 3.63 109 "eq=saturation=0.78:contrast=1.06:brightness=-0.04" $SP/s2.mp4
# ── 7.23–12.43 · the meeting ────────────────────────────────────────────────
shot "$MEET" 0.4 5.20 156 "eq=saturation=0.86:contrast=1.03:brightness=-0.02" $SP/s3.mp4
# ── 27.20–31.40 · they solved it, together ──────────────────────────────────
shot "$TOGETHER" 0.3 4.20 126 "eq=saturation=1.06:contrast=1.02:brightness=0.02" $SP/s5.mp4

# ── lay the captions (and the payoff confetti) over the footage ─────────────
cap () {  # $1 base  $2 first plate frame  $3 out
  $FF $Q -i "$1" -framerate 30 -start_number "$2" -i $SP/plate/%05d.png -filter_complex \
  "[0:v][1:v]overlay=0:0:shortest=1,setsar=1[v]" -map "[v]" -an \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$3"
}
printf "file '%s'\nfile '%s'\n" $SP/s1.mp4 $SP/s2.mp4 > $SP/l12.txt
$FF $Q -f concat -safe 0 -i $SP/l12.txt -c copy $SP/s12.mp4
cap $SP/s12.mp4 0   $SP/p12.mp4
cap $SP/s3.mp4  216 $SP/p3.mp4
cap $SP/s5.mp4  816 $SP/p5.mp4

# ── the app section and the logo, straight from the existing film ───────────
seg () { $FF $Q -ss "$1" -t "$2" -i "$FILM" -an -vf setsar=1 \
        -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$3"; }
seg 12.43 14.77 $SP/app.mp4      # 12.43 → 27.20
seg 31.40  4.60 $SP/logo.mp4     # 31.40 → 36.00

printf "file '%s'\n" $SP/p12.mp4 $SP/p3.mp4 $SP/app.mp4 $SP/p5.mp4 $SP/logo.mp4 > $SP/film.txt
$FF $Q -f concat -safe 0 -i $SP/film.txt -c copy $SP/video_only.mp4

# ── the original mix, untouched ─────────────────────────────────────────────
$FF $Q -i $SP/video_only.mp4 -i $SP/audio.wav -c:v copy -c:a aac -b:a 192k \
  -shortest -movflags +faststart $OUT/onyx-learn-promo-LIVE-1080x1920.mp4

$FF $Q -i $OUT/onyx-learn-promo-LIVE-1080x1920.mp4 -filter_complex \
"[0:v]split=2[bg][fg];\
 [bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=42,eq=brightness=-0.09[bgb];\
 [fg]scale=-1:1080[fgs];[bgb][fgs]overlay=(W-w)/2:0[v]" \
 -map "[v]" -map 0:a -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
 -c:a copy -movflags +faststart $OUT/onyx-learn-promo-LIVE-1920x1080.mp4

$FF -hide_banner -i $OUT/onyx-learn-promo-LIVE-1080x1920.mp4 2>&1 | grep -E "Duration|Stream"
