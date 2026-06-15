# -*- coding: utf-8 -*-
"""
Extract the Samaritan root index (data/torah-index.pdf) into structured JSON
using Claude vision. Each page is sent as two column images (right column read
first, then left) and the model returns the roots, their inflected forms,
pronunciation and scripture locations.

This is a ONE-TIME, developer-side build step. Its output (a JSONL that is then
loaded into torah.db) ships with the app as a static table -- the distributed
APK makes no network calls and needs no API key.

Usage:
    py -3 scripts/extract_index.py 4 25 50            # specific pages (0-based)
    py -3 scripts/extract_index.py 4-340              # an inclusive range
Writes one JSON object per page to data/root_index_raw.jsonl and prints token
usage / cost so a full run can be estimated.
"""
import os, sys, io, json, base64, time, re
import fitz
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, 'data', 'torah-index.pdf')
OUT = os.environ.get('INDEX_OUT') or os.path.join(ROOT, 'data', 'root_index_raw.jsonl')
MODEL = 'claude-opus-4-8'
# $ per 1M tokens
PRICE_IN, PRICE_OUT = 5.0, 25.0


def load_key():
    p = os.path.join(ROOT, '.env')
    if os.path.exists(p):
        for line in io.open(p, encoding='utf-8'):
            if line.strip().startswith('ANTHROPIC_API_KEY'):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return os.environ.get('ANTHROPIC_API_KEY')


PROMPT = """\
This image pair is one page from a printed index of word-roots in the Samaritan \
Pentateuch. Image 1 is the RIGHT column (read it first); image 2 is the LEFT \
column (read it second). Transcribe EVERY entry on the page in reading order.

Structure of the page:
- A bold, UNVOCALIZED Hebrew word is a ROOT header (e.g. אלה, אלל, אלם, אלף).
- Under each root come one or more inflected FORMS. Each form line has, from \
right to left: the VOCALIZED Hebrew form, then its Latin pronunciation \
(transliteration, e.g. illa, alyā, ūlām), then its scripture LOCATIONS.
- Occasionally a line gives a grammatical BINYAN/parsing label in Hebrew, made \
of words like קל / נפעל / פיעל / הפעיל / התפעל with עבר / עתיד / בינוני / מקור / \
ציווי / פעול / סביל (e.g. "קל עבר", "הפעיל מקור"). This is NEVER a root header — \
attach it as the "binyan" of the form(s) it describes and keep the current root.
- A ROOT header is a short bare consonant cluster (2-4 letters), not a binyan \
phrase. Do not start a new root from a binyan label.
- Small parenthesised markers next to a form (e.g. (יח׳)) are notes; ignore them.

Locations grammar: a book abbreviation is followed by chapter/verse numbers. A \
number in brackets is a CHAPTER; bare numbers after it are VERSES in that \
chapter, until the next bracket or the next book. Brackets may print as [..] or \
(..) -- treat ANY bracketed number as a chapter. A repeated verse number means \
the form occurs twice there; keep duplicates. Normalise book abbreviations to \
full Hebrew names: בר=בראשית, שמ=שמות, ויק/ויקר=ויקרא, במ/בם=במדבר, דב=דברים \
(its ד is often printed to look like ר, so רב also means דברים).

Give each form's locations as ONE compact string field "locs" (not a list).
Grammar: for each book write the full book name, a space, then space-separated \
chapter groups; each group is <chapter>:<verse>,<verse>,... ; separate different \
books with " ; ". Keep repeated verses. Example: "בראשית 2:4,9 6:9 ; שמות 12:1,3". \
Use "" if the form has no locations. Always put a space around every token.

Return ONLY JSON, no prose, no code fence:
{"roots":[{"root":"<unvocalized>","forms":[{"form":"<vocalized or null>",\
"pron":"<latin or null>","binyan":"<hebrew or null>","locs":"<compact string>"}]}]}
If the page has no index content, return {"roots":[]}."""


def col_b64(page, side):
    pix = page.get_pixmap(matrix=fitz.Matrix(3, 3))
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    W, H = img.size
    mid = int(W * 0.505)
    if side == 'R':
        crop = img.crop((mid - int(W * 0.012), 0, W, H))
    else:
        crop = img.crop((0, 0, mid + int(W * 0.012), H))
    buf = io.BytesIO()
    crop.save(buf, format='PNG')
    return base64.standard_b64encode(buf.getvalue()).decode()


def img_block(b64):
    return {"type": "image", "source": {"type": "base64",
            "media_type": "image/png", "data": b64}}


def parse_pages(args):
    out = []
    for a in args:
        if '-' in a:
            lo, hi = a.split('-')
            out.extend(range(int(lo), int(hi) + 1))
        else:
            out.append(int(a))
    return out


def extract_page(client, doc, p):
    r = col_b64(doc[p], 'R')
    l = col_b64(doc[p], 'L')
    last = None
    for attempt in range(4):
        try:
            return client.messages.create(
                model=MODEL, max_tokens=8000,
                output_config={"effort": "medium"},
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "text", "text": "Image 1 (RIGHT column):"}, img_block(r),
                    {"type": "text", "text": "Image 2 (LEFT column):"}, img_block(l),
                ]}],
            )
        except Exception as e:        # transient network / rate limit
            last = e
            time.sleep(5 * (attempt + 1))
    raise last


def done_pages():
    """Pages already present in OUT, so a re-run resumes instead of redoing."""
    seen = set()
    if os.path.exists(OUT):
        for line in io.open(OUT, encoding='utf-8'):
            line = line.strip()
            if line:
                try:
                    seen.add(json.loads(line)['page'])
                except Exception:
                    pass
    return seen


def main():
    import anthropic
    key = load_key()
    if not key:
        print("No ANTHROPIC_API_KEY found"); return
    client = anthropic.Anthropic(api_key=key)
    pages = parse_pages(sys.argv[1:]) or [20]
    seen = done_pages()
    todo = [p for p in pages if p not in seen]
    if seen:
        print("resuming: %d already done, %d to go" % (len(seen), len(todo)))
    doc = fitz.open(PDF)
    tin = tout = 0
    t0 = time.time()
    with io.open(OUT, 'a', encoding='utf-8') as fout:
        for i, p in enumerate(todo):
            msg = extract_page(client, doc, p)
            tin += msg.usage.input_tokens
            tout += msg.usage.output_tokens
            txt = ''.join(b.text for b in msg.content if b.type == 'text').strip()
            txt = re.sub(r'^```(json)?|```$', '', txt.strip(), flags=re.M).strip()
            try:
                data = json.loads(txt)
                nroots = len(data.get('roots', []))
            except Exception as e:
                data = {"_parse_error": str(e), "_raw": txt}
                nroots = -1
            fout.write(json.dumps({"page": p, "data": data}, ensure_ascii=False) + "\n")
            fout.flush()
            print("[%d/%d] page %3d: roots=%-3s in=%d out=%d" %
                  (i + 1, len(todo), p, nroots, msg.usage.input_tokens, msg.usage.output_tokens),
                  flush=True)
    n = len(todo)
    if not n:
        print("nothing to do"); return
    dt = time.time() - t0
    cost = tin / 1e6 * PRICE_IN + tout / 1e6 * PRICE_OUT
    print("\n=== %d pages in %.0fs ===" % (n, dt))
    print("input tokens : %d (avg %.0f/page)" % (tin, tin / n))
    print("output tokens: %d (avg %.0f/page)" % (tout, tout / n))
    print("this run cost: $%.3f  (avg $%.4f/page)" % (cost, cost / n))


if __name__ == '__main__':
    main()
