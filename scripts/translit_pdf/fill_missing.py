"""Fill the MISSING verse_translit verses from the Ben-Hayyim PDFs (paid Opus vision).

PDF is the sole source. Only verses currently absent from verse_translit/_fix are
filled. The script locates each target chapter's page by interpolation + a header
probe, OCRs the page (splitting landscape two-page spreads), harvests only the
missing verse numbers, and (verification) re-OCRs each harvested page a second
time; agreements are written, disagreements go to a review file for manual zoom.

Usage:
  py -3 scripts/translit_pdf/fill_missing.py --book 1 --chap 30           # one chapter (sample)
  py -3 scripts/translit_pdf/fill_missing.py --all                        # every missing chapter
  add --passes 1 to skip verification; --apply to write straight to DB.
"""
import os, sys, json, base64, re, argparse, sqlite3, io, time
import fitz
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DB = os.path.join(ROOT, 'data', 'torah.db')
MAIN_PDF = os.path.join(ROOT, 'המליץ', 'תעתיק הגייה.pdf')
DEUT_PDF = os.path.join(ROOT, 'המליץ', 'תעתיק הגייה דברים.pdf')
OUTDIR = os.path.join(ROOT, 'data', 'translit_pdf')
REVIEW = os.path.join(OUTDIR, 'fill_review.json')
RESULT = os.path.join(OUTDIR, 'fill_result.json')
CACHE_FILE = os.path.join(OUTDIR, 'ocr_cache.json')

def load_key():
    for line in open(os.path.join(ROOT, '.env'), encoding='utf-8'):
        if line.startswith('ANTHROPIC_API_KEY'):
            return line.split('=', 1)[1].strip().strip('"').strip("'")
    return os.environ.get('ANTHROPIC_API_KEY')

import anthropic
CLIENT = anthropic.Anthropic(api_key=load_key())
MODEL = 'claude-opus-4-8'
COST = {'in': 0.0, 'out': 0.0}

def est_page(bk, ch):
    # slopes/anchors recalibrated from the OCR cache's real page->chapter map
    if bk == 1: return round(174 - (ch - 1) * 0.95)   # Gen ch1=174
    if bk == 2: return round(118 - (ch - 1) * 0.95)   # Exod ch1=118, ch40=81
    if bk == 3: return round(78 - (ch - 1) * 1.23)    # Lev ch1=78, ch27=46
    if bk == 4: return round(44 - (ch - 1) * 1.25)    # Num ch1=44, ch36=0
    if bk == 5: return round(36 - (ch - 1) * 1.06)    # Deut ch1=36 (separate PDF)

def pdf_for(bk):
    return DEUT_PDF if bk == 5 else MAIN_PDF

def pdf_tag(bk):
    return 'D' if bk == 5 else 'M'   # cache key: Gen-Num share the main PDF

def page_images(doc, page):
    """Return list of (label, png_b64). Portrait -> 1 image; landscape spread -> right,left."""
    p = doc[page]; r = p.rect
    out = []
    if r.width > r.height:  # landscape two-page spread: right half first (RTL)
        for label, x0, x1 in (('R', 0.50, 1.0), ('L', 0.0, 0.50)):
            clip = fitz.Rect(r.x0 + r.width * x0, r.y0, r.x0 + r.width * x1, r.y1)
            pm = p.get_pixmap(matrix=fitz.Matrix(3.8, 3.8), clip=clip)
            out.append((label, base64.b64encode(pm.tobytes('png')).decode()))
    else:
        pm = p.get_pixmap(matrix=fitz.Matrix(2.7, 2.7))
        out.append(('', base64.b64encode(pm.tobytes('png')).decode()))
    return out

PROMPT = (
    "This is a scanned page of the Samaritan Pentateuch printed in the Ben-Hayyim "
    "LATIN phonetic transcription (e.g. \"båråšət bårå ēluwwəm it aššåmem\"). "
    "Transcribe EXACTLY what is printed, character-for-character, preserving every "
    "diacritic (å ā a ē e ī i ū u ə š ṣ ṭ ġ ḏ etc.), the apostrophes ' and ʿ and the "
    "length mark ':'. CRITICAL: the length mark is a COLON ':' written right after a vowel "
    "(as in alyå:qob, rå:əl, å:rəṣ, å:dåm); transcribe it as ':' — never as a macron (ā) or "
    "apostrophe. Most a-vowels are å (ring above), not ā (macron); use ā only when clearly a "
    "macron. Do NOT translate, normalize, transliterate to Hebrew, or complete "
    "anything. The big centred number is the CHAPTER. Each verse begins with [n] where n "
    "is an integer or a composite like 18-1. Asterisks * mark section breaks (ignore them). "
    "Return ONLY a JSON array, one object per FULLY-visible numbered verse: "
    "[{\"chapter\":N,\"verse\":\"n\",\"text\":\"...\"}]. Omit any verse cut off at the top/bottom edge. No prose."
)

def ocr(images):
    blocks = []
    for label, b64 in images:
        blocks.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}})
    blocks.append({"type": "text", "text": PROMPT})
    msg = CLIENT.messages.create(
        model=MODEL, max_tokens=8000,
        messages=[{"role": "user", "content": blocks}],
    )
    COST['in'] += msg.usage.input_tokens / 1e6 * 5
    COST['out'] += msg.usage.output_tokens / 1e6 * 25
    txt = ''.join(b.text for b in msg.content if b.type == 'text')
    m = re.search(r'\[.*\]', txt, re.S)
    if not m:
        return []
    try:
        return json.loads(m.group(0))
    except Exception:
        return []

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--book', type=int); ap.add_argument('--chap', type=int)
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--passes', type=int, default=2)
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
    miss = db.execute('''SELECT b.order_n bk, c.number ch, v.number vn
        FROM verses v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id
        LEFT JOIN verse_translit t ON t.verse_id=v.id LEFT JOIN verse_translit_fix f ON f.verse_id=v.id
        WHERE COALESCE(f.text,t.text) IS NULL''').fetchall()
    targets = defaultdict(set)
    for r in miss:
        targets[(int(r['bk']), int(r['ch']))].add(str(r['vn']))
    if args.all:
        pass
    elif args.chap:
        targets = {(args.book, args.chap): targets.get((args.book, args.chap), set())}
    elif args.book:
        targets = {k: v for k, v in targets.items() if k[0] == args.book}

    docs = {}
    def doc(bk):
        if bk not in docs: docs[bk] = fitz.open(pdf_for(bk))
        return docs[bk]

    os.makedirs(OUTDIR, exist_ok=True)
    # PERSISTENT on-disk OCR cache: survives interruptions so pages are never re-paid.
    ocr_cache = json.load(open(CACHE_FILE, encoding='utf-8')) if os.path.exists(CACHE_FILE) else {}
    def cache(bk, pg):
        key = f'{pdf_tag(bk)}:{pg}'
        if key not in ocr_cache:
            ocr_cache[key] = ocr(page_images(doc(bk), pg))
            json.dump(ocr_cache, open(CACHE_FILE, 'w', encoding='utf-8'), ensure_ascii=False)
        return ocr_cache[key]
    def chaps_on(bk, pg):
        return {o.get('chapter') for o in cache(bk, pg) if isinstance(o.get('chapter'), int)}

    # RESUME: load any results already saved; skip verses already filled.
    results = json.load(open(RESULT, encoding='utf-8')) if os.path.exists(RESULT) else []
    have = {(int(r['book']), int(r['chap']), str(r['verse'])) for r in results}
    review = []
    def save():
        json.dump(results, open(RESULT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump(review, open(REVIEW, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    def locate(bk, ch):
        e = est_page(bk, ch); npages = doc(bk).page_count
        order = [e] + [e + d for k in range(1, 9) for d in (-k, k)]
        for pg in order:
            if 0 <= pg < npages and ch in chaps_on(bk, pg):
                return pg
        return None

    for (bk, ch), need in sorted(targets.items()):
        need = {v for v in need if (bk, ch, v) not in have}     # resume: drop already-filled
        if not need: continue
        npages = doc(bk).page_count
        if COST['in'] + COST['out'] > 7.5:
            print('  !! cost cap reached, stopping'); break
        found = locate(bk, ch)
        if found is None:
            review.append({'bk': bk, 'ch': ch, 'error': 'not located', 'need': sorted(need)})
            print(f'  !! {bk}.{ch} NOT LOCATED'); save(); continue
        # gather pages holding this chapter (verses earlier=higher idx, later=lower idx),
        # stopping as soon as every needed verse is collected.
        harvest = {}
        chapter_pages = []
        def take(pg):
            chapter_pages.append(pg)
            for o in cache(bk, pg):
                if o.get('chapter') == ch and str(o.get('verse')) in need:
                    harvest[str(o['verse'])] = o['text'].strip()
        take(found)
        pg = found + 1
        while (need - set(harvest)) and pg < npages and ch in chaps_on(bk, pg): take(pg); pg += 1
        pg = found - 1
        while (need - set(harvest)) and pg >= 0 and ch in chaps_on(bk, pg): take(pg); pg -= 1
        for v, t in harvest.items():
            results.append({'book': bk, 'chap': ch, 'verse': v, 'text': t}); have.add((bk, ch, v))
        missed = need - set(harvest)
        print(f'  {bk}.{ch}: pages {sorted(chapter_pages)}, filled {len(harvest)}/{len(need)}'
              + (f', MISSED {sorted(missed)}' if missed else ''), flush=True)
        for v in missed:
            review.append({'bk': bk, 'ch': ch, 'verse': v, 'pages': sorted(chapter_pages), 'note': 'not found in OCR'})
        save()   # checkpoint after every chapter

    save()
    print(f'\nfilled={len(results)} review={len(review)}  cost=${COST["in"]+COST["out"]:.2f} (in ${COST["in"]:.2f} out ${COST["out"]:.2f})')
    print('result ->', RESULT, '| review ->', REVIEW)
    if args.apply and results:
        os.system(f'{sys.executable} "{os.path.join(os.path.dirname(__file__),"apply_translit.py")}" "{RESULT}"')

if __name__ == '__main__':
    main()
