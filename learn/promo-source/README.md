# Promo film — source

The 36-second advert in `learn/static/promo/`. Everything here is source: the
film is generated, not edited by hand, so a change to the script or the app's
screens can be re-rendered exactly.

## The film

| beat | seconds | what is on screen |
|---|---|---|
| 1 | 0.0 – 3.6 | Living room. One child on his back on the sofa with the phone above his face, the other on her stomach on the rug. Caption: *הילדים כל היום תקועים עם הפנים במסך* |
| 2 | 3.6 – 7.2 | The same room. The clock races, the daylight drains from the window, the room dims. Caption: *שעה. שעתיים. ובסוף — כלום.* |
| 3 | 7.2 – 12.4 | The teacher's office. The teacher taps a report card marked 55 while the parent and child sit facing her. Caption: *ההישגים טעונים שיפור?* |
| 4 | 12.4 – 27.2 | The app itself — real captured screens scrolling inside a phone, one per beat, with a tap ripple. Captions name what it does. |
| 5 | 27.2 – 31.4 | The two of them together in front of one phone, arms up, confetti, a green tick. Caption: *פתרנו! — אותו מסך. אחרת לגמרי.* |
| 6 | 31.4 – 36.0 | Logo, subjects, and `learn.onyx-study.com` |

## Sound

`72a3cce8-sonicankidsmusicfriendlyplay567165.mp3` (supplied) is the bed. Its
level follows the story rather than sitting flat: 0.30 while the problem is on
screen, 0.20 in the teacher's office, 0.62 when the app appears, 0.78 on the
payoff. 26 effect cues sit on top — notification blips, a clock ticking down, a
low sting into the office, two desk knocks, a whoosh on the turn, interface taps
and the app's own correct/celebrate sounds, and a closing chime. The app sounds
are the real recordings from `static/sounds/`, so the advert sounds like the
product. Peak is −0.5 dBFS.

## The cast

The people are **Humaaans** (Pablo Stanley, free for commercial use — see
ATTRIBUTION.md), not hand-drawn. `humaaans.py` converts the package's React
components to plain SVG; `build_people.py` assembles and recolours them into
`people.js`.

Two things make the assembly correct:

* The part offsets are Humaaans' own — head (82,0), bottom (0,187), torso
  (22,82) inside `translate(40,31)` standing or `translate(40,24)` sitting — so
  the anatomy joins exactly as the library intends.
* Recolouring is per part, never global. `#191847` is both the hair colour and
  the shading on skinny jeans, so a blanket substitution would repaint someone's
  trousers when you meant to dye their hair.

The library has no lying-down pose, but its figures are drawn in side profile,
so a quarter turn gives a convincing one: `PointingUp` becomes a child on their
back holding a phone above their face, and `Sprint` becomes a child on their
stomach with their shins in the air.

Figures are placed by the rectangle they should occupy rather than by a guessed
transform — `who()` in ad.html scales from the measured bounding boxes in
`people_bbox.json`, produced by `measure_people.js`.

## Rebuilding

Frames are a pure function of their timestamp — `setFrame(n)` never reads the
wall clock — so the render is deterministic and a frame can be re-shot on its
own.

```sh
# 0. a Node with Playwright + Chromium, and ffmpeg
npm i ffmpeg-static @fontsource/rubik

# 1. rebuild the cast, and re-capture the app screens (app served on :8391)
python3 humaaans.py && python3 build_people.py
node serve.js & node measure_people.js      # writes people_bbox.json
node capture-app-shots.js

# 2. serve this folder and render 1080 frames
node serve.js &
node render-frames.js

# 3. build the effects, lay the mix, encode
bash build-sfx.sh
python3 mix-audio.py
ffmpeg -framerate 30 -i frames/%05d.jpg -i audio.wav \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest -movflags +faststart \
  ../static/promo/onyx-learn-promo-1080x1920.mp4
```

The 16:9 cut is the same film centred on a blurred bed of itself, so the Play
Store listing loses nothing to a crop.

The paths inside the scripts are absolute to the machine they were written on;
change them at the top of each file before re-running elsewhere.
