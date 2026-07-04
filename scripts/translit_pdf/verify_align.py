"""Systematic transcription verification against the Ben-Ḥayyim PDF.

Aligns the PDF's verse stream to the DB's verses by SEQUENCE + printed verse-number
(two-pointer), per book — never trusting the model's per-page chapter guess (which is
wrong on header-less continuation pages). Overwrites verse_translit where the PDF text
differs; flags composite Samaritan-expansion verses (numbered differently) separately.

Uses the persistent OCR cache (data/translit_pdf/ocr_cache.json); OCRs only uncached
pages. Writes proposed diffs to data/translit_pdf/verify_<book>.json (+ apply with --apply).

Usage: py -3 scripts/translit_pdf/verify_align.py --book 1 [--apply]
"""
import os, json, re, sqlite3, importlib.util, argparse, fitz
spec = importlib.util.spec_from_file_location('fm', os.path.join(os.path.dirname(__file__), 'fill_missing.py'))
fm = importlib.util.module_from_spec(spec); spec.loader.exec_module(fm)

# generous page ranges per book (reading order = DECREASING pdf index); overlaps are
# harmless — verses past the book's last just don't align.
RANGES = {1: ('M', 174, 118), 2: ('M', 121, 79), 3: ('M', 82, 44), 4: ('M', 46, 0), 5: ('D', 36, 0)}

def norm_txt(s):
    return re.sub(r'\s+', ' ', (s or '').strip())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--book', type=int, required=True)
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    bk = args.book
    tag, p_hi, p_lo = RANGES[bk]
    doc = fitz.open(fm.DEUT_PDF if tag == 'D' else fm.MAIN_PDF)

    cache = json.load(open(fm.CACHE_FILE, encoding='utf-8')) if os.path.exists(fm.CACHE_FILE) else {}
    def page(pg):
        key = f'{tag if tag=="D" else fm_book_prefix(pg)}:{pg}'
        # accept ANY existing cache entry for this physical page (any 1-4 prefix), else OCR
        for k in list(cache):
            kp, kn = k.split(':')
            if int(kn) == pg and ((tag == 'D') == (kp == '5')):
                return cache[k]
        parsed = fm.ocr(fm.page_images(doc, pg))
        cache[key] = parsed
        json.dump(cache, open(fm.CACHE_FILE, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'  OCR page {pg}: {len(parsed)} verses (cost ${fm.COST["in"]+fm.COST["out"]:.2f})', flush=True)
        return parsed

    # PDF verse stream in reading order (pages high→low, verses top→bottom as returned)
    pdf_stream = []
    for pg in range(p_hi, p_lo - 1, -1):
        if pg < 0 or pg >= doc.page_count:
            continue
        for o in page(pg):
            v = o.get('verse')
            if v is None:
                continue
            pdf_stream.append((str(v), (o.get('text') or '').strip()))

    # DB verses for this book, in canonical order
    db = sqlite3.connect(fm.DB); db.row_factory = sqlite3.Row
    dbrows = db.execute('''SELECT v.id, c.number ch, v.number vn, t.text cur
        FROM verses v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id
        LEFT JOIN verse_translit t ON t.verse_id=v.id
        WHERE b.order_n=? ORDER BY c.number, v.id''', (bk,)).fetchall()

    # two-pointer align by verse-number; resync on mismatch by scanning a small window
    changes, flagged, matched = [], [], 0
    j = 0
    def vnum(s):
        m = re.match(r'\d+', str(s));
        return m.group(0) if m else str(s)
    pdf_nums = [vnum(v) for v, _ in pdf_stream]
    for r in dbrows:
        want = vnum(r['vn'])
        composite = '-' in str(r['vn'])
        # find next pdf verse matching this number within a forward window
        hit = None
        for k in range(j, min(j + 6, len(pdf_stream))):
            if pdf_nums[k] == want:
                hit = k; break
        if hit is None or composite:
            flagged.append({'id': r['id'], 'ch': r['ch'], 'vn': r['vn'], 'reason': 'composite' if composite else 'no-match'})
            continue
        matched += 1
        j = hit + 1
        pdf_text = pdf_stream[hit][1]
        if pdf_text and norm_txt(pdf_text) != norm_txt(r['cur']):
            changes.append({'book': bk, 'chap': r['ch'], 'verse': str(r['vn']),
                            'id': r['id'], 'old': r['cur'], 'text': pdf_text})

    os.makedirs(fm.OUTDIR, exist_ok=True)
    out = os.path.join(fm.OUTDIR, f'verify_{bk}.json')
    json.dump(changes, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'book {bk}: db {len(dbrows)} verses, matched {matched}, CHANGES {len(changes)}, flagged {len(flagged)} (composite/no-match)')
    print(f'cost ${fm.COST["in"]+fm.COST["out"]:.2f} | diffs -> {out}')
    if args.apply and changes:
        recs = [{'book': c['book'], 'chap': c['chap'], 'verse': c['verse'], 'text': c['text']} for c in changes]
        ap_json = os.path.join(fm.OUTDIR, f'verify_{bk}_apply.json')
        json.dump(recs, open(ap_json, 'w', encoding='utf-8'), ensure_ascii=False)
        os.system(f'{__import__("sys").executable} "{os.path.join(os.path.dirname(__file__),"apply_translit.py")}" "{ap_json}"')

def fm_book_prefix(pg):
    return '1' if pg >= 119 else '2' if pg >= 81 else '3' if pg >= 46 else '4'

if __name__ == '__main__':
    main()
