# -*- coding: utf-8 -*-
"""Compose the film's cast from Humaaans and emit them as ready SVG groups.

Humaaans supplies the artwork; this file only assembles and recolours it. Two
things matter for it to look right:

* The part offsets are Humaaans' own — head (82,0), bottom (0,187), torso
  (22,82), all inside translate(40,31) standing or translate(40,24) sitting —
  so the anatomy joins exactly as the library intends.
* Recolouring is per part, never global. #191847 is the hair colour AND the
  colour of skinny-jeans shading and shoes, so a blanket substitution would
  repaint someone's trousers when you meant to dye their hair.

The library has no lying-down pose, but its figures are drawn in side profile,
so rotating one a quarter turn gives a convincing one: PointingUp becomes a
child on their back holding a phone above their face, and Sprint becomes a
child on their stomach with their shins in the air.
"""
import io, os, json

VID = "/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid"
P = VID + "/parts"

SKIN_BASE, SKIN_SHADE = "#B28B67", "#997659"
HAIR_BASE = "#191847"

# main / shade / trim colours of each garment, read off the artwork itself
GARMENT = {
    ("torso", "PointingUp"):      ("#1F28CF", "#2026A2", "#F2F2F2"),
    ("torso", "PointingForward"): ("#1F28CF", "#2026A2", None),
    ("torso", "Hoodie"):          ("#FF9B21", "#E87613", "#DDE3E9"),
    ("torso", "LongSleeve"):      ("#C5CFD6", "#AFB9C5", None),
    ("torso", "TurtleNeck"):      ("#DDE3E9", "#C5CFD6", None),
    ("torso", "Jacket"):          ("#5A44FE", "#4136C4", None),
    ("standing", "SweatPants"):   ("#89C5CC", "#69A1AC", None),
    ("standing", "Sprint"):       ("#5C63AB", "#2F3676", None),
    ("standing", "SkinnyJeans"):  ("#2F3676", "#191847", None),
    ("standing", "Jogging"):      ("#FF4048", "#E43F3F", None),
    ("standing", "BaggyPants"):   ("#2F3676", "#191847", None),
    ("standing", "Shorts"):       ("#69C0FF", "#4B9FE1", None),
    ("sitting",  "SkinnyJeans"):  ("#2B44FF", "#1F28CF", None),
    ("sitting",  "SweatPants"):   ("#89C5CC", "#69A1AC", None),
    ("sitting",  "Wheelchair"):   ("#2F3676", "#191847", None),
    ("sitting",  "BaggyPants"):   ("#2F3676", "#191847", None),
}

def dark(hex_color, f=0.82):
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return "#%02X%02X%02X" % tuple(max(0, min(255, int(c * f))) for c in (r, g, b))

def part(group, name, skin=None, hair=None, cloth=None, trim=None):
    svg = io.open(os.path.join(P, "%s.%s.svg" % (group, name)), encoding="utf-8").read()
    if skin:
        svg = svg.replace(SKIN_BASE, skin).replace(SKIN_SHADE, dark(skin, .88))
    if hair and group == "head":            # only a head may have its hair dyed
        svg = svg.replace(HAIR_BASE, hair)
    if cloth and (group, name) in GARMENT:
        main, shade, tr = GARMENT[(group, name)]
        svg = svg.replace(main, "@@M@@").replace(shade, "@@S@@")
        if tr and trim:
            svg = svg.replace(tr, "@@T@@").replace("@@T@@", trim)
        svg = svg.replace("@@M@@", cloth).replace("@@S@@", dark(cloth))
    return svg

def figure(head, torso, bot, posture="standing", face="right",
           skin="#EFC49F", hair="#3A2A20", top="#4ECDC4", pants="#2F3676", trim=None):
    ty = 24 if posture == "sitting" else 31
    flip = ("translate(190,200.5) scale(-1,1) translate(-190,-200.5)" if face == "left" else "")
    return ('<g transform="%s translate(40,%d)">'
            '<g transform="translate(82,0)">%s</g>'
            '<g transform="translate(0,187)">%s</g>'
            '<g transform="translate(22,82)">%s</g></g>'
            % (flip, ty,
               part("head", head, skin, hair),
               part(posture, bot, skin, None, pants),
               part("torso", torso, skin, None, top, trim)))

# ── the cast ────────────────────────────────────────────────────────────────
SKIN_A, SKIN_B, SKIN_C = "#F0C7A1", "#E8B489", "#D79E74"

CAST = {
    # scene 1–2 · rotated a quarter turn so they read as lying down
    "kidSofa":  dict(head="Curly", torso="PointingUp", bot="SweatPants", posture="standing",
                     face="right", skin=SKIN_A, hair="#2E2118", top="#4ECDC4", pants="#3E4C9E"),
    "kidFloor": dict(head="Long", torso="Hoodie", bot="Sprint", posture="standing",
                     face="right", skin=SKIN_B, hair="#5B3A24", top="#FFC94D", pants="#5C63AB"),
    # scene 3 · the office
    "teacher":  dict(head="Chongo", torso="PointingForward", bot="SkinnyJeans", posture="standing",
                     face="left", skin=SKIN_C, hair="#2B1D14", top="#6C5CE7", pants="#241A5C"),
    "parent":   dict(head="Short", torso="LongSleeve", bot="BaggyPants", posture="sitting",
                     face="right", skin=SKIN_C, hair="#3A2A20", top="#F2545B", pants="#2F3676"),
    "childSeat": dict(head="Curly", torso="TurtleNeck", bot="SkinnyJeans", posture="sitting",
                     face="right", skin=SKIN_A, hair="#2E2118", top="#3FBF6F", pants="#2B44FF"),
    # scene 5 · the payoff
    "cheerA":   dict(head="Curly", torso="PointingUp", bot="SweatPants", posture="sitting",
                     face="right", skin=SKIN_A, hair="#2E2118", top="#4ECDC4", pants="#3E4C9E"),
    "cheerB":   dict(head="Long", torso="PointingUp", bot="SkinnyJeans", posture="sitting",
                     face="left", skin=SKIN_B, hair="#5B3A24", top="#FFC94D", pants="#5C63AB"),
}

if __name__ == "__main__":
    out = {k: figure(**v) for k, v in CAST.items()}
    io.open(VID + "/people.js", "w", encoding="utf-8").write(
        "/* Cast composed from Humaaans (build_people.py) — do not hand-edit. */\n"
        "window.PEOPLE=" + json.dumps(out, ensure_ascii=False) + ";\n")
    print("people.js:", len(out), "figures,",
          round(os.path.getsize(VID + "/people.js") / 1024), "KB")
