"""First-pass parser: turn OCR'd dictionary pages into dict_* rows.

The OCR text (data/dict_ocr/txt/page_XXXX.txt) is readable but noisy, and the
two scripts/bidi reorder tokens within a line, so field-level parsing is
best-effort. Two anchors are reliable in this lexicon:

  * Entry boundary  - every head-lemma is immediately followed by a grammatical
    marker (ש"ע, pr. n., n. f, vb, adj., pron.). A new entry starts at the
    Hebrew word sitting next to such a marker.
  * Citations       - Torah references follow a strict pattern: a book
    abbreviation (בר/שמ/ויק/במ/דב/תמ/ת"מ/מ ...) + a Hebrew-numeral chapter +
    an Arabic verse number, e.g. "דב ח 20", "במ כא 11", "ת"מ 148ב".

For each entry we store: lemma (the Hebrew word by the marker), pos, the first
English gloss phrase (gloss_en), the page, and the FULL entry text in notes so
nothing is lost for later manual refinement. The head-lemma is also written as
dict_forms order_n=0, and every detected citation hangs off it.

Run AFTER ocr_dictionary.py. Use --reset to clear dict_* before reloading.

Usage:
  py -3 scripts/parse_dictionary.py --start 83 --end 102
  py -3 scripts/parse_dictionary.py --start 83 --end 1047 --reset
"""
import argparse
import glob
import os
import re
import sqlite3

ROOT    = os.path.join(os.path.dirname(__file__), '..')
DB_PATH = os.path.join(ROOT, 'data', 'torah.db')
TXT_DIR = os.path.join(ROOT, 'data', 'dict_ocr', 'txt')

HEB = r'֐-׿'                       # Hebrew block (letters + niqqud + punct)
HEB_WORD = re.compile(rf'[{HEB}]{{2,}}')      # a Hebrew word (>=2 Hebrew chars)

# Grammatical markers that follow a head-lemma. The Hebrew noun marker ש"ע is
# OCR'd with assorted quote glyphs and sometimes a final-pe variant.
POS = re.compile(
    r'(?:ש\s*["\'״″]?\s*[עפ]'      # ש"ע / ש"פ and OCR variants
    r'|pr\.\s*n\.'                            # proper noun
    r'|n\.\s*[fm]\.?'                         # n. f / n. m
    r'|\bvb\b|\badj\.|\bpron\.)')

# A Torah/Tibåt-Marqe reference: book abbrev + Hebrew-numeral chapter + verse.
BOOKS = r'בר|שמ|ויק|במ|דב|ת["״]?מ|תמ|תיימ|מ|עז|הש'
REF = re.compile(
    rf'(?:{BOOKS})\s+[{HEB}]{{1,4}}\s*[-–]?\s*\d+[א-ת]?(?:\s*[-–]\s*\d+[א-ת]?)?')

PAGE_MARK = re.compile(r'###\s*PAGE\s+(\d+)\s*###')
NIQQUD = re.compile(r'[֑-ׇ]')       # cantillation + vowel points

# Words that sit next to a marker but are never the head-lemma: the Hebrew
# labels printed beside the grammatical tag, and the book abbreviations.
STOP = {'פרטי', 'מקום', 'מופשט', 'שם', 'לשון', 'נקבה', 'זכר', 'רבים', 'יחיד',
        'בר', 'שמ', 'ויק', 'במ', 'דב', 'תמ', 'מ', 'עז', 'הש', 'לא', 'את',
        'כי', 'אל', 'על', 'אם', 'הא', 'הוא', 'היא', 'הלא', 'וכן', 'אשר'}

# Matres lectionis / weak letters dropped when comparing a word to a root, so
# inflected forms in the quotations still match the bare head-lemma.
WEAK = str.maketrans('', '', 'אהויםןףךץ')


def strip_niqqud(s):
    return NIQQUD.sub('', s)


def skel(w):
    """Rough consonant skeleton: drop weak/final letters, dedupe nothing."""
    return strip_niqqud(w).translate(WEAK)


def load_pages(start, end):
    """Yield (page_no, text) for OCR'd pages in range, in order."""
    for path in sorted(glob.glob(os.path.join(TXT_DIR, 'page_*.txt'))):
        pno = int(re.search(r'page_(\d+)', path).group(1))
        if start <= pno <= end:
            with open(path, encoding='utf-8') as f:
                yield pno, f.read()


def pick_lemma(window_words, chunk_skels):
    """The head-lemma is the entry word whose consonant skeleton recurs most in
    its own entry (the head-word saturates its quotations). Ties broken by
    proximity order. STOP words and pure references are never lemmas."""
    best, best_score = None, -1
    for w in window_words:
        bare = strip_niqqud(w)
        if bare in STOP or len(bare) < 2 or not re.search(rf'[{HEB}]', bare):
            continue
        sk = skel(w)
        if len(sk) < 2:
            continue
        score = sum(1 for cs in chunk_skels if sk in cs or cs in sk)
        if score > best_score:
            best, best_score = bare, score
    return best


def find_entries(text):
    """Return list of (chunk_start, chunk_end, lemma) for every entry, anchored
    on the grammatical markers; the head-lemma is chosen per chunk by recurrence."""
    marks = [m.start() for m in POS.finditer(text)]
    # merge markers sitting almost on top of each other (e.g. "pr. n." + "pl.")
    merged = []
    for s in marks:
        if not merged or s - merged[-1] > 25:
            merged.append(s)
    LOOK = 80
    entries = []
    for i, ms in enumerate(merged):
        start = max(0, ms - LOOK)
        if entries:
            start = max(start, entries[-1][1])      # don't overlap previous
        end = (merged[i + 1] - LOOK) if i + 1 < len(merged) else len(text)
        end = max(end, ms + 1)
        chunk = text[start:end]
        chunk_skels = [skel(w.group()) for w in HEB_WORD.finditer(chunk)]
        chunk_skels = [s for s in chunk_skels if len(s) >= 2]
        # candidate words: those near the marker (where the head-word is printed)
        window = [w.group() for w in HEB_WORD.finditer(text, max(0, ms - LOOK), ms + 30)]
        lemma = pick_lemma(window, chunk_skels) or pick_lemma(
            [w.group() for w in HEB_WORD.finditer(chunk)], chunk_skels)
        if lemma:
            entries.append((start, end, lemma))
    return entries


def first_english(chunk):
    """First reasonably-long run of Latin words = the English gloss."""
    m = re.search(r'[A-Za-z][A-Za-z \',;.\-()]{3,}', chunk)
    if not m:
        return None
    g = re.sub(r'\s+', ' ', m.group()).strip(" ,;.-()")
    return g or None


def parse_citations(chunk):
    """Split an entry chunk at each reference; quote = preceding text."""
    cites, last = [], 0
    for m in REF.finditer(chunk):
        quote = chunk[last:m.start()].strip(" \n-–.,")
        ref = re.sub(r'\s+', ' ', m.group()).strip()
        quote = re.sub(r'\s+', ' ', quote)
        # keep only quotes that actually contain Hebrew (drop English-only spans)
        if quote and HEB_WORD.search(quote):
            cites.append((quote[-400:], ref))
        last = m.end()
    return cites


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', type=int, required=True)
    ap.add_argument('--end',   type=int, required=True)
    ap.add_argument('--reset', action='store_true', help='clear dict_* first')
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    if args.reset:
        c.executescript('DELETE FROM dict_citations; DELETE FROM dict_forms; '
                        'DELETE FROM dict_entries;')

    order = 0
    n_entries = n_forms = n_cites = 0
    for pno, text in load_pages(args.start, args.end):
        body = PAGE_MARK.sub('', text)
        heads = find_entries(body)
        for (s, e, lemma) in heads:
            chunk = body[s:e].strip()
            posm = POS.search(chunk)
            pos = posm.group().strip() if posm else None
            gloss_en = first_english(chunk)
            order += 1
            c.execute(
                "INSERT INTO dict_entries (lemma, gloss_en, pos, page, notes, order_n)"
                " VALUES (?,?,?,?,?,?)",
                (lemma, gloss_en, pos, pno, chunk, order))
            eid = c.lastrowid
            n_entries += 1
            c.execute(
                "INSERT INTO dict_forms (entry_id, form, gloss_en, pos, order_n)"
                " VALUES (?,?,?,?,0)", (eid, lemma, gloss_en, pos))
            fid = c.lastrowid
            n_forms += 1
            for j, (quote, ref) in enumerate(parse_citations(chunk)):
                c.execute(
                    "INSERT INTO dict_citations (form_id, quote, source_ref, order_n)"
                    " VALUES (?,?,?,?)", (fid, quote, ref, j))
                n_cites += 1
    conn.commit()
    print(f"entries={n_entries}  forms={n_forms}  citations={n_cites}")
    conn.close()


if __name__ == '__main__':
    main()
