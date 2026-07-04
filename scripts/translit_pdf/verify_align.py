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

    # CONTENT-SIMILARITY align: for each DB verse, find the nearby PDF verse whose text is
    # most similar to the current transcription (same verse ≈ 0.6-0.95; a wrong verse < 0.4).
    # Re-anchor the running pointer on every good match so versification shifts don't cascade.
    # Only overwrite when confident it's the same verse (sim >= THRESH) — never on a weak match.
    import difflib
    THRESH = 0.60          # char-similarity of a confident same-verse match
    SKEL_MIN = 0.5         # consonant-skeleton word overlap — rejects formulaic wrong-person
                           # matches (only formula words shared) while allowing vowel-only fixes
    _VOWELS = set("aeiouAEIOUåāēīūōəǝ:ɑɛɔ")
    # fold notational variants (apostrophe glyphs, vowel diacritics, length mark) so that
    # matching sees THROUGH the very differences we intend to correct; the change itself
    # still uses the raw PDF text.
    _FOLD = str.maketrans({'å': 'a', 'ā': 'a', 'ē': 'e', 'ī': 'i', 'ū': 'u', 'ō': 'o',
                           'ə': 'e', 'ǝ': 'e', 'ʾ': '', 'ʿ': '', 'ʼ': '', '`': '',
                           '‘': '', '’': '', "'": '', ':': '', '´': '', '̄': ''})
    def fold(s):
        return norm_txt(s).translate(_FOLD)
    def skel(s):           # consonant-skeleton word set (drop vowels/length marks)
        return set(''.join(c for c in w if c not in _VOWELS) for w in s.split()) - {''}
    def jac(a, b):
        return len(a & b) / len(a | b) if (a or b) else 0.0
    def sim(a, b):
        return difflib.SequenceMatcher(None, a, b).ratio()
    pdf_norm = [norm_txt(txt) for _, txt in pdf_stream]
    pdf_fold = [fold(txt) for _, txt in pdf_stream]
    pdf_skel = [skel(s) for s in pdf_norm]
    def vnum(s):
        m = re.match(r'\d+', str(s)); return m.group(0) if m else str(s)
    pdf_vn = [vnum(v) for v, _ in pdf_stream]
    # index PDF verses by printed number — the pdf_stream order is unreliable (landscape
    # spreads scramble it), so we match GLOBALLY by (verse-number + best folded content)
    # instead of by sequence: robust to stream order and to formulaic genealogies.
    from collections import defaultdict
    by_num = defaultdict(list)
    for k, vn in enumerate(pdf_vn):
        by_num[vn].append(k)
    changes, flagged, matched = [], [], 0
    for r in dbrows:
        cur = norm_txt(r['cur'])
        if '-' in str(r['vn']) or not cur:
            flagged.append({'id': r['id'], 'ch': r['ch'], 'vn': r['vn'],
                            'reason': 'composite' if '-' in str(r['vn']) else 'no-current'})
            continue
        cur_fold = fold(cur); cur_skel = skel(cur)
        want = vnum(r['vn'])
        best_k, best_r = None, -1.0
        for k in by_num.get(want, []):
            s = sim(cur_fold, pdf_fold[k])
            if s > best_r:
                best_r, best_k = s, k
        if best_k is not None and best_r >= 0.80 and jac(cur_skel, pdf_skel[best_k]) >= SKEL_MIN:
            matched += 1
            if pdf_norm[best_k] and pdf_norm[best_k] != cur:
                changes.append({'book': bk, 'chap': r['ch'], 'verse': str(r['vn']), 'id': r['id'],
                                'sim': round(best_r, 2), 'old': r['cur'], 'text': pdf_stream[best_k][1]})
        else:
            flagged.append({'id': r['id'], 'ch': r['ch'], 'vn': r['vn'],
                            'reason': 'low-sim', 'bestsim': round(best_r, 2)})                  # keep position by advancing one

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
