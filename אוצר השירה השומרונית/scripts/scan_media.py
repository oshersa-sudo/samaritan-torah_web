# -*- coding: utf-8 -*-
"""Read a folder of pictures and films and make a manifest of it.

The screen inside the deck shows what it can find on Wikimedia; this is for
what the archive has of its own, which is better material and is not going to
disappear when somebody re-files a category. The scan itself only reads: it
writes one JSON file and touches nothing in the folder it is given.

What is left out is as important as what is taken. Anything whose name marks
it as somebody's private photograph is skipped, and so is anything too small
to be a photograph — an icon saved out of a web page, a thumbnail. What is
kept carries its size, and for a film its length, so that the player knows
how much of it to show.

    py -3 scripts/scan_media.py "G:\\...\\תמונות שונות"
"""
import io
import json
import os
import subprocess
import sys

IMG = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.heic')
VID = ('.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.mpg', '.mpeg', '.3gp')

# names that mark a file as not belonging on the screen
SKIP_NAME = (
    'אושר',            # the owner's own photographs, asked to be left out
    'images.png', 'image.png', 'download', 'untitled',
    'thumb', 'icon', 'logo', 'avatar', 'screenshot', 'צילום מסך',
    'whatsapp image', 'whatsapp video',   # forwards, provenance unknown
)
MIN_PIXELS = 320          # anything smaller is not a photograph
MIN_BYTES = 24 * 1024


def _skip(name):
    low = name.lower()
    base = os.path.splitext(low)[0].strip()
    for s in SKIP_NAME:
        s = s.lower()
        if base == s or base.startswith(s) or s in low:
            return True
    return False


def _size(path):
    """Width and height, if Pillow is about. Nothing is lost without it."""
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        return (0, 0)


def _film(path):
    """Length and frame size of a film, if ffprobe is about."""
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
             '-show_entries', 'stream=width,height:format=duration',
             '-of', 'json', path],
            capture_output=True, text=True, timeout=40).stdout
        j = json.loads(out)
        st = (j.get('streams') or [{}])[0]
        return (int(float(j.get('format', {}).get('duration', 0) or 0)),
                int(st.get('width') or 0), int(st.get('height') or 0))
    except Exception:
        return (0, 0, 0)


def scan(root):
    kept, dropped = [], []
    for dirpath, _dirs, files in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root).replace('\\', '/')
        if rel_dir == '.':
            rel_dir = ''
        for name in sorted(files):
            ext = os.path.splitext(name)[1].lower()
            if ext not in IMG and ext not in VID:
                continue
            path = os.path.join(dirpath, name)
            rel = (rel_dir + '/' + name) if rel_dir else name
            try:
                nbytes = os.path.getsize(path)
            except OSError:
                continue
            if _skip(name):
                dropped.append((rel, 'name'))
                continue
            if ext in VID:
                secs, w, h = _film(path)
                kept.append({'f': rel, 'kind': 'video', 'bytes': nbytes,
                             'secs': secs, 'w': w, 'h': h,
                             'folder': rel_dir})
                continue
            if nbytes < MIN_BYTES:
                dropped.append((rel, 'tiny'))
                continue
            w, h = _size(path)
            if w and (w < MIN_PIXELS or h < MIN_PIXELS):
                dropped.append((rel, 'small %dx%d' % (w, h)))
                continue
            kept.append({'f': rel, 'kind': 'image', 'bytes': nbytes,
                         'w': w, 'h': h, 'folder': rel_dir})
    return kept, dropped


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    root = sys.argv[1].rstrip('\\/')
    if not os.path.isdir(root):
        print('not a folder: %s' % root)
        return 1
    kept, dropped = scan(root)
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, 'data', 'local_media.json')
    with io.open(out, 'w', encoding='utf-8') as fh:
        json.dump({'root': root, 'items': kept}, fh, ensure_ascii=False, indent=1)

    imgs = [x for x in kept if x['kind'] == 'image']
    vids = [x for x in kept if x['kind'] == 'video']
    print('kept  %d pictures (%.0f MB)   %d films (%.0f MB)'
          % (len(imgs), sum(x['bytes'] for x in imgs) / 1e6,
             len(vids), sum(x['bytes'] for x in vids) / 1e6))
    print('left out %d' % len(dropped))
    for rel, why in dropped[:20]:
        print('   %-58s %s' % (rel[:58], why))
    folders = {}
    for x in kept:
        folders.setdefault(x['folder'] or '(root)', []).append(x)
    print('\nby folder:')
    for k in sorted(folders):
        v = folders[k]
        print('   %-44s %3d  (%d films)'
              % (k[:44], len(v), sum(1 for y in v if y['kind'] == 'video')))
    if vids:
        print('\nfilms:')
        for x in sorted(vids, key=lambda y: -y['secs'])[:20]:
            print('   %-52s %s' % (x['f'][:52],
                  ('%d:%02d' % (x['secs'] // 60, x['secs'] % 60)) if x['secs'] else '?'))
    print('\nwrote %s' % out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
