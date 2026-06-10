"""
Remove background from torah_scroll.jpg and produce:
  assets/images/torah_scroll_nobg.png  — transparent PNG (for header)
  assets/icons/app_icon.png            — 256x256 icon for the window
"""
import os
from PIL import Image

BASE = os.path.join(os.path.dirname(__file__), '..')
SRC  = os.path.join(BASE, 'assets', 'images', 'torah_scroll.jpg')
OUT_HEADER = os.path.join(BASE, 'assets', 'images', 'torah_scroll_nobg.png')
OUT_ICON   = os.path.join(BASE, 'assets', 'icons', 'app_icon.png')

try:
    from rembg import remove
    img = Image.open(SRC)
    result = remove(img)
    result.save(OUT_HEADER)
    print("rembg: background removed successfully")
except Exception as e:
    print(f"rembg failed ({e}), falling back to PIL threshold removal")
    img = Image.open(SRC).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    # The image is B&W: background is light gray/white wall
    # Make pixels brighter than threshold transparent
    THRESHOLD = 160
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            brightness = (r + g + b) // 3
            if brightness > THRESHOLD:
                pixels[x, y] = (r, g, b, 0)
    img.save(OUT_HEADER)
    print("PIL threshold: background removed")

# Create square icon (crop to centre, pad to square, resize)
nobg = Image.open(OUT_HEADER).convert('RGBA')
w, h = nobg.size
side = max(w, h)
square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
square.paste(nobg, ((side - w) // 2, (side - h) // 2))
icon = square.resize((256, 256), Image.LANCZOS)
icon.save(OUT_ICON)
print(f"Icon saved: {OUT_ICON}")
print(f"Header image saved: {OUT_HEADER}")
