"""Finish the remaining plain-integer missing verses with chapter-HINTED OCR.

Continuation pages have no visible chapter number, so the base OCR mislabels the
chapter. Here we locate each still-missing chapter's page(s) from the cache's real
page->chapter map, then OCR those pages telling the model exactly which chapter
the verses belong to, and harvest the needed verse numbers. Writes fill_hinted.json.

Usage: py -3 scripts/translit_pdf/fill_hinted.py [--book N]
"""
import os, json, sys, re, base64, sqlite3, importlib.util, fitz
spec = importlib.util.spec_from_file_location('fm', os.path.join(os.path.dirname(__file__), 'fill_missing.py'))
fm = importlib.util.module_from_spec(spec); spec.loader.exec_module(fm)

BOOKNAME = {1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy'}

def ocr_hint(doc, pg, book, chapter):
    imgs = fm.page_images(doc, pg)
    blocks = [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}} for _, b64 in imgs]
    prompt = (fm.PROMPT +
        f"\n\nIMPORTANT CONTEXT: this is a CONTINUATION page of {BOOKNAME[book]} chapter {chapter} "
        f"(the printed chapter number may not be visible on this page). Unless a NEW large centred "
        f"chapter number clearly appears, every verse on this page belongs to chapter {chapter}. "
        f"Set \"chapter\":{chapter} for those verses; only use a different number for verses that "
        f"clearly fall under a new visible chapter heading.")
    blocks.append({"type": "text", "text": prompt})
    msg = fm.CLIENT.messages.create(model=fm.MODEL, max_tokens=8000, messages=[{"role": "user", "content": blocks}])
    fm.COST['in'] += msg.usage.input_tokens / 1e6 * 5
    fm.COST['out'] += msg.usage.output_tokens / 1e6 * 25
    txt = ''.join(b.text for b in msg.content if b.type == 'text')
    m = re.search(r'\[.*\]', txt, re.S)
    try:
        return json.loads(m.group(0)) if m else []
    except Exception:
        return []

def main():
    book_filter = None
    if '--book' in sys.argv:
        book_filter = int(sys.argv[sys.argv.index('--book') + 1])
    db = sqlite3.connect(fm.DB); db.row_factory = sqlite3.Row
    miss = db.execute('''SELECT b.order_n bk,c.number ch,v.number vn FROM verses v
        JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id
        LEFT JOIN verse_translit t ON t.verse_id=v.id LEFT JOIN verse_translit_fix f ON f.verse_id=v.id
        WHERE COALESCE(f.text,t.text) IS NULL''').fetchall()
    from collections import defaultdict
    need = defaultdict(set)
    for r in miss:
        if '-' in str(r['vn']): continue   # skip composite expansions (handled separately)
        if book_filter and int(r['bk']) != book_filter: continue
        need[(int(r['bk']), int(r['ch']))].add(str(r['vn']))

    cache = json.load(open(fm.CACHE_FILE, encoding='utf-8'))
    # physical main-PDF page -> set of (chapter) seen (to locate a chapter's pages)
    page_chaps = defaultdict(set); deut_page_chaps = defaultdict(set)
    for k, objs in cache.items():
        pref, pg = k.split(':'); pg = int(pg)
        tgt = deut_page_chaps if pref == '5' else page_chaps
        for o in objs:
            if isinstance(o.get('chapter'), int): tgt[pg].add(o['chapter'])

    docM = fitz.open(fm.MAIN_PDF); docD = fitz.open(fm.DEUT_PDF)
    results = []
    for (bk, ch), vs in sorted(need.items()):
        doc = docD if bk == 5 else docM
        est = fm.est_page(bk, ch)
        # candidate pages: est +/-4, ordered by closeness
        cands = sorted(range(max(0, est - 4), min(doc.page_count, est + 5)), key=lambda p: abs(p - est))
        got = {}
        for pg in cands:
            if not (need[(bk, ch)] - set(got)): break
            parsed = ocr_hint(doc, pg, bk, ch)
            for o in parsed:
                if o.get('chapter') == ch and str(o.get('verse')) in vs:
                    got[str(o['verse'])] = o['text'].strip()
            if fm.COST['in'] + fm.COST['out'] > 6.0:
                print('  !! hinted cost cap'); break
        for v, t in got.items():
            results.append({'book': bk, 'chap': ch, 'verse': v, 'text': t})
        miss_v = vs - set(got)
        print(f'  {bk}.{ch}: filled {len(got)}/{len(vs)}' + (f' MISSED {sorted(miss_v)}' if miss_v else ''), flush=True)
        if fm.COST['in'] + fm.COST['out'] > 6.0: break
    json.dump(results, open(os.path.join(fm.OUTDIR, 'fill_hinted.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'filled={len(results)} cost=${fm.COST["in"]+fm.COST["out"]:.2f}')

if __name__ == '__main__':
    main()
