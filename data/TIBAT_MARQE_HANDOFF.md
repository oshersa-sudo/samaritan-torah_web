# Tibåt Mårqe — Handoff / Status

Feature: surface Tibåt Mårqe (Abraham Tal, 2019) passages under the **"ממקור שומרון"**
button — for each Torah verse, show the relevant memar passage with two adjacent
panels: **right = Aramaic source, left = simple-Hebrew translation** (no English in UI).

Source PDF: `data/TalA2019_Tibat Marqe.pdf`.

## Pipeline (all under scripts/, run with `py -3`)

1. **`extract_tibat_marqe.py`** — PDF → two JSON files (already produced):
   - `data/tibat_marqe_sections.json` — 410 sections × {aramaic, english} (381 w/ Aramaic).
   - `data/tibat_marqe_index.json` — 958 "Biblical quotations" entries (Gen..Deut → Book/§).
   - Index format confirmed: `Gen. 9:5 III, 50` = Torah book + chapter:verse → TM book (I–VI) + paragraph §50.
     Sub-letter refs (e.g. `9a`, `67a`, `1b`) are appendix/sub-paragraphs `[9a]` etc.
   - Book starts (PDF pages): I=43, II=157, III=209, IV=325, V=479, VI=523. Titles:
     I ספר פליהתה · II על תהומי מעין עדן · III וידבר משה והכהנים הלוים ·
     IV מימר על שירתה רבתה · V מימר על וימת שם משה · VI מימר על כ״ב האותיות.

2. **`build_tibat_marqe.py`** — loads sections into DB tables `tm_sections` and (unfiltered)
   `tm_verse_links`. Preserves existing `tm_sections.hebrew` across rebuilds; backs up DB.

3. **`translate_tibat_marqe.py`** — fills `tm_sections.hebrew` (English → simple Hebrew) via
   Anthropic API (`claude-sonnet-4-6`, .env key). **DONE: 409/410** translated (1 has no English).

4. **`relink_tibat_marqe.py`** — semantic-relevance filter. For each (index-entry, section-ref)
   it asks the model whether the paragraph genuinely relates to the verse; relevant → linked,
   irrelevant → routed to an Excel review file. Judgements cached in
   `data/tibat_marqe_relevance_cache.json` (resumable — the background runner is killed
   periodically, just re-run to continue).
   - `py -3 scripts/relink_tibat_marqe.py`           # judge all pending (cache only)
   - `py -3 scripts/relink_tibat_marqe.py --apply`   # rebuild tm_verse_links + write Excel

## DB schema (torah.db)

```
tm_sections(id, book 'I'..'VI', section, book_title, sort_key, aramaic, english, hebrew)
tm_verse_links(id, verse_id -> verses(id), section_id -> tm_sections(id))   -- many-to-many
```
Per-verse retrieval (Aramaic + English + Hebrew) via `database.get_tibat_marqe(verse_ids)`.

## Current state (this session = data only; NO app edits here)

- `tm_sections`: 410 rows, Aramaic 381, Hebrew 409.  ✅
- Relevance cache: **COMPLETE — 1187/1187 judged. 482 relevant (41%), 705 rejected (59%).** ✅
- **NOT YET APPLIED**: `tm_verse_links` still holds the OLD unfiltered links (1782). Run `--apply`
  ONLY after the user approves — it rebuilds links from the cache (→ ~482 assertions, expanded
  over verse ranges) and writes `data/tibat_marqe_links_review.xlsx`
  (sheets: "נדחו" rejected, "קושרו" accepted, each with reason).

## App integration (do in the "New Samaritan torah Project" session — NOT here)

Already on disk (kept per user): `app/services/database.py` `get_tibat_marqe`,
`app/screens/browse.py` `_build_samaritan_src_container` + `_tm_source_card` + `_tm_sel`
state + `_select_tm_section`, and `app/main.py` docstring. UI shows tappable source cards →
two panels (Aramaic | Hebrew).

## Next steps

1. Finish relevance judging: `py -3 scripts/relink_tibat_marqe.py` (repeat until 1187).
2. On approval: `py -3 scripts/relink_tibat_marqe.py --apply`; review the xlsx; adjust the
   cache/criterion if needed and re-apply.
3. Optionally improve Aramaic for the ~29 sections still missing it.
4. Verify the UI in the app session.

Scratch/debug files from extraction (safe to delete): `data/_tm_*.txt`, `data/_tm_pg*.png`,
`data/_tm_aram_*.txt`, `data/_tm_*.log`.
