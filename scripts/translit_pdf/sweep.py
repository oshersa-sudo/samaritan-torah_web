"""Brute-force sweep: OCR every page in a range into the shared cache (robust vs the
fragile locator, for spread-dense regions). Then harvest+apply is done separately.

Usage: py -3 scripts/translit_pdf/sweep.py main 46 80     # OCR main PDF pages 46..80
       py -3 scripts/translit_pdf/sweep.py deut 0 36
Caches under key '{book}:{page}' (book inferred by page range for main; 5 for deut),
skipping pages already cached under ANY prefix for that physical page.
"""
import sys, os, json, fitz
import importlib.util
spec = importlib.util.spec_from_file_location('fm', os.path.join(os.path.dirname(__file__), 'fill_missing.py'))
fm = importlib.util.module_from_spec(spec); spec.loader.exec_module(fm)

def book_main(pg):
    if pg >= 119: return 1
    if pg >= 81: return 2
    if pg >= 46: return 3
    return 4

def main():
    which = sys.argv[1]; p0 = int(sys.argv[2]); p1 = int(sys.argv[3])
    pdf = fm.DEUT_PDF if which == 'deut' else fm.MAIN_PDF
    doc = fitz.open(pdf)
    cache = json.load(open(fm.CACHE_FILE, encoding='utf-8')) if os.path.exists(fm.CACHE_FILE) else {}
    # which physical main-PDF pages are already cached (under any 1-4 prefix)?
    cached_main = {int(k.split(':')[1]) for k in cache if not k.startswith('5:')}
    cached_deut = {int(k.split(':')[1]) for k in cache if k.startswith('5:')}
    done = 0
    for pg in range(p0, p1 + 1):
        if pg < 0 or pg >= doc.page_count: continue
        if which == 'deut':
            key = f'5:{pg}'
            if pg in cached_deut: continue
        else:
            key = f'{book_main(pg)}:{pg}'
            if pg in cached_main: continue
        cache[key] = fm.ocr(fm.page_images(doc, pg))
        json.dump(cache, open(fm.CACHE_FILE, 'w', encoding='utf-8'), ensure_ascii=False)
        done += 1
        print(f'  OCR {key}: {len(cache[key])} verses, cost so far ${fm.COST["in"]+fm.COST["out"]:.2f}', flush=True)
        if fm.COST['in'] + fm.COST['out'] > 6.0:
            print('  !! sweep cost cap'); break
    print(f'swept {done} new pages; total cached {len(cache)}; cost ${fm.COST["in"]+fm.COST["out"]:.2f}')

if __name__ == '__main__':
    main()
