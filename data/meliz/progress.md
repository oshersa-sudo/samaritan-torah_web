# HaMeliṣ (המליץ) dictionary → word-popup integration — progress

**Goal:** surface the HaMeliṣ Samaritan Hebrew–Arabic lexicon glosses in the "מילון מילים"
popup, keyed to each word at its Torah location. Only words that appear in HaMeliṣ get a gloss.
(HaMeliṣ here is **not** Ben-Ḥayyim's edition.)

## Source PDFs (data/torah.db is the target)
Under `המליץ/`. Page counts per PyMuPDF (`fitz`), and alphabetical coverage:
- `המליץ 3.pdf`      — 127 pp — letter **א** (start); SOME PAGES ROTATED 90°
- `המליץ 2.pdf`      — 186 pp — letter **ג** region (printed p.220)
- `המליץ 1.pdf`      — 163 pp — letter **ז** region (printed p.399)
- `המליץ חלק אחרון.pdf` — 385 pp — letters **ע→ת** (printed p.667+)
Together ≈ 861 pages, ~17k entries. Parts are scan segments; order them by printed page #.

## Page layout (glossary table, right→left)
`line# | lemma(in parens) | Arabic gloss | Hebrew form/gloss | Torah ref | mss-sigla`
Below the table: numbered editor footnotes keyed to the line numbers (optional — not extracted yet).
- Ref format: book' + chapter(Hebrew numeral) + verse(Arabic digits), e.g. `בר' מט 27` = Gen 49:27.
- `שם` = ibid (same ref as the row above) — resolve while transcribing.
- trailing `+` = appears here and elsewhere; use this ref. Strip the `+`.
- Books: בר'=1 שמ'=2 ויק'=3 במ'=4 דב'=5.
- A row with NO ref (e.g. a bare synonym line) is skipped — can't be placed.

## Pipeline (manual/free extraction, chosen over paid vision)
1. Render pages:  `py -3 scripts/meliz/render_pages.py <part> <start> <count> [dpi=150] [rot]`
   → PNGs in `data/meliz/pages/`. Use `rot 90`/`270` for sideways scans (part 3 has them).
2. Read each PNG, transcribe placeable rows into `data/meliz/entries_meliz<part>_p<NNN>.jsonl`
   (one sub-row per line: book, chap, verse, lemma, hebrew, arabic, src="meliz<part> p<NNN> l<line>").
3. Apply:  `py -3 scripts/meliz/apply_jsonl.py data/meliz/entries_meliz<part>_p<NNN>.jsonl`
   → idempotent by `src`; inserts into `meliz_gloss`.

## Backend/frontend wiring (DONE, verified)
- Table `meliz_gloss(book,chap,verse,lemma,hebrew,arabic,note,src)` + `_load_meliz()` +
  `get_word_table` attach (app/services/database.py): matches lemma→word by `_ds_match` fold,
  APPENDS Arabic to the `arabic` field (comma, never overwrites), exposes `meliz_he`/`meliz_ar`.
- Frontend (web/static/app.js): new **המליץ** column in the 5→6-col table (`col_meliz`),
  and the expansion panel's "מן המליץ" section now shows meliz Arabic+Hebrew (was "טרם נוסף").
- CSS `.wt-meliz`; i18n col_meliz he/en/ar.

## DONE — full extraction complete (meliz_gloss = 10,666 rows)
Extracted all 861 pages via **Opus vision** (`scripts/meliz/vision_extract.py --part all --apply`),
cost **$36.24** ($0.042/page). Raw per-page JSON cached in `data/meliz/vision_cache/` (resume-safe).
- 10,666 rows; **99% resolve to a verse**; 3,205 distinct verses covered.
- by book(order_n): Gen 4755, Exod 2107, Lev 1014, Num 1344, Deut 1446.
- ~66% of rows fold-match a word in their verse (rest show nothing — safe).
- The early manual files (entries_meliz1_p00*.jsonl) were superseded by the vision run
  (same src prefix `meliz1 p00N`, overwritten).

## If re-running / extending
- Cache hit = $0, so re-running `--part all --apply` just re-applies from cache.
- To re-extract a page: delete its `data/meliz/vision_cache/p<part>_<NNNN>.json` and rerun.

## Next
- Continue page by page. Suggest finishing part 1 (ז) then part 2/3/4.
- Consider extracting footnotes into `note` later (currently empty).
