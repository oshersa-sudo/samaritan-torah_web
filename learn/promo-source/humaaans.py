# -*- coding: utf-8 -*-
"""Convert the Humaaans body-part components (JSX) into plain SVG fragments.

Humaaans ships as React components. The markup inside is ordinary SVG apart
from React's camelCase attribute names and brace-wrapped values, so the
conversion is mechanical — and mechanical is what we want: the artwork itself
is untouched.
"""
import io, os, re, json

SRC = "/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid/node_modules/humaaans/src/human/body-parts"
OUT = "/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid/parts"

ATTR = {
    "strokeWidth": "stroke-width", "fillRule": "fill-rule", "clipRule": "clip-rule",
    "strokeLinecap": "stroke-linecap", "strokeLinejoin": "stroke-linejoin",
    "fillOpacity": "fill-opacity", "strokeOpacity": "stroke-opacity",
    "strokeDasharray": "stroke-dasharray", "clipPath": "clip-path",
    "xlinkHref": "xlink:href", "stopColor": "stop-color", "stopOpacity": "stop-opacity",
    "gradientUnits": "gradientUnits", "patternUnits": "patternUnits",
    "maskUnits": "maskUnits", "className": "class",
}

def convert(js):
    # keep only the JSX body
    m = re.search(r"=>\s*\(([\s\S]*?)\n\);", js)
    if not m:
        m = re.search(r"=>\s*\(([\s\S]*)\)\s*;\s*export", js)
    if not m:
        return None
    s = m.group(1)
    s = re.sub(r"\{\.\.\.props\}", "", s)             # the React spread
    s = re.sub(r"\{/\*[\s\S]*?\*/\}", "", s)          # JSX comments
    # {1} / {0.5} / {"x"} → "1" / "0.5" / "x"
    s = re.sub(r'=\{"([^"]*)"\}', r'="\1"', s)
    s = re.sub(r"=\{'([^']*)'\}", r'="\1"', s)
    s = re.sub(r"=\{([-\d.]+)\}", r'="\1"', s)
    for a, b in ATTR.items():
        s = re.sub(r"\b%s=" % a, b + "=", s)
    return s.strip()

os.makedirs(OUT, exist_ok=True)
index = {}
for group in ("head", "torso", "standing", "sitting", "scene"):
    d = os.path.join(SRC, group)
    if not os.path.isdir(d):
        continue
    index[group] = []
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".js"):
            continue
        name = fn[:-3]
        svg = convert(io.open(os.path.join(d, fn), encoding="utf-8").read())
        if not svg:
            print("  SKIP", group, name)
            continue
        io.open(os.path.join(OUT, "%s.%s.svg" % (group, name)), "w", encoding="utf-8").write(svg)
        index[group].append(name)

io.open(os.path.join(OUT, "index.json"), "w", encoding="utf-8").write(
    json.dumps(index, ensure_ascii=False, indent=1))
for g, v in index.items():
    print("%-9s %2d  %s" % (g, len(v), " ".join(v)))
