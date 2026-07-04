# Transcription re-OCR from המליץ PDFs — progress

**Task:** Replace `verse_translit` with a faithful OCR of the Ben-Ḥayyim transcription
PDFs in `המליץ/`. PDF is the SOLE source — no completion from any other text. Where a
verse is not in the PDF, leave it untouched. Inline OCR (MAX session, no paid API).

## Sources (both reverse page order: PDF page 0 = last printed page)
- `המליץ/תעתיק הגייה.pdf` — 175 pp — **Genesis–Numbers**. Gen 1:1 = PDF page 174; Num 36 = page 0.
- `המליץ/תעתיק הגייה דברים.pdf` — 37 pp — **Deuteronomy**. Deut 1:1 = page 36; Deut 34 = page 0.
- The `… 2.pdf` files are same-size duplicates (ignore).

## Pipeline
1. `py -3 scripts/translit_pdf/render_page.py "<pdf>" <pageidx> [nstrips]` → strips in scratchpad `pg_<idx>_a/b/c.png`
2. Read strips, transcribe verse-by-verse `[n]`; zoom (6x thin clip) any ambiguous ṣ/š/vowel.
3. Save page/chapter records JSON in `data/translit_pdf/pages/`.
4. `py -3 scripts/translit_pdf/apply_translit.py <json>` → upserts verse_translit, deletes matching verse_translit_fix.

## Backup
- `data/translit_backup_20260629_175024.json` (verse_translit 5483 + verse_translit_fix 2411).

## STRATEGY (decided with user)
- User chose: PAID, targeted — fix ONLY the verses that are wrong. The cheaply-detectable
  "wrong" set = the **430 MISSING verses** in 72 chapters (the 361 "truncated" flags are
  mostly false positives — complete verses just lacking a final period).
- Audio recitation sample (Deut Sam-ch.69): I CANNOT process audio. User said continue per
  the PDF (Ben-Ḥayyim is itself the phonetic record of the recitation).
- Paid fill via `scripts/translit_pdf/fill_missing.py` (Opus vision, claude-opus-4-8):
  locates each chapter by interpolation+probe (global page cache), harvests only the
  missing verse numbers, writes to `data/translit_pdf/fill_result.json`, review →
  `fill_review.json`. Then `apply_translit.py fill_result.json`.
- Approved budget ~$6-10; script has a hard $11 cost cap.

## DONE
- Genesis ch.1 (page 174→173 top) — 31 verses applied inline (28 changed). Old data had errors + truncations.
- Genesis ch.2 partially read inline (not yet applied — superseded by the missing-fill plan;
  ch.2 is fully present in DB so it's NOT in the missing set).
- Built fill_missing.py; fixed harvest direction bug (reverse PDF: earlier verses = higher page idx).

## NEXT
- Validate Gen 30 sample output vs PDF, then run `--all` for the 430 missing verses, then apply.

## ✅ SYSTEMATIC VERIFICATION — WORKING ALGORITHM (2026-07-04)
`verify_align.py` now uses GLOBAL matching (NOT sequential — the pdf_stream is scrambled by
landscape spreads): for each DB verse, search ALL pdf verses with the same printed number,
pick the best FOLDED-content match (fold() normalises apostrophes ʾʿ' and vowel diacritics so
matching sees through the notation being corrected), gated by foldsim>=0.80 + consonant-skeleton
Jaccard>=0.5. This is robust to stream scrambling AND to formulaic genealogies (verse-number
narrows to one-per-chapter; folded content picks the right chapter). Validated: 0 wrong-verse
across all books (even the riskiest sim=0.80 changes are correct same-verse fixes).
APPLIED: **Gen 583, Exod 504, Lev 335, Num 592** (each backed up first; fix-rows cleared).
Deut running (OCR of its 37 pages). Flagged verses (below threshold / composite / empty) are
left untouched — safe, not corrupted.

## 🔄 (earlier attempts — superseded) SYSTEMATIC VERIFICATION vs PDF
User directive: "עבור שיטתית מול ה-PDF ותקן" — verify the WHOLE transcription against the
scanned PDF and overwrite where it differs (transcription must come ONLY from המליץ/ PDFs).

**Pipeline:** `scripts/translit_pdf/verify_align.py --book N [--apply]`
- Aligns the PDF verse stream to DB verses by SEQUENCE + printed verse-number (two-pointer),
  per book — does NOT trust the model's per-page chapter label (that caused the earlier
  Lev-25 mislabel corruption). Overwrites verse_translit where PDF text ≠ DB text.
- Composite Samaritan-expansion verses (X-N) are FLAGGED, not auto-changed (different numbering).
- Reuses persistent ocr_cache.json; OCRs only uncached pages. Writes diffs to
  data/translit_pdf/verify_<book>.json; `--apply` writes via apply_translit.py.
- Book page ranges (RANGES in the script): Gen M174-118, Exod M121-79, Lev M82-44,
  Num M46-0, Deut D36-0.

**Cache coverage (2026-07-04):** main PDF 143/175 pages cached; **Deut 0/37 cached**.
Uncached main pages: 7,8,95,96,105,120-127,136,137,140,146-148,157-160,166-174.
→ ~69 new pages to OCR (~$5-7) for the full pass; alignment itself is free.

**STATE:** Genesis (book 1) verify running (no --apply yet) — validate diff quality first,
then apply + do books 2-5. Resume = re-run `verify_align.py --book N` (cache persists).
Backups: data/translit_backup_*.json (verse_translit+fix), data/word_gloss_backup_*.json.

## ⚠️ PRE-EXISTING transcription DIVERGES from the PDF (found 2026-07-04)
The ~5,483 verses that ALREADY had verse_translit before this work (the original source
bundle, NOT the PDF) do not reliably match the scanned Ben-Ḥayyim PDF. Example the user
caught: Gen 5:21-24 read חנוך = "ammon" (should be "īnok"), חמש = "ḥåməš" (should be
"'amməš"), ויתהלך = "wyithallak" (should be "wyētållåk"). Fixed those 4 from the PDF
(data/translit_pdf/enoch_fix.json, applied). BUT this implies the whole pre-existing
transcription needs verification against the PDF — that is the FULL re-OCR (212 pages) we
scoped down earlier. My missing-fill only added the 430 empty verses; it did NOT touch or
validate the pre-existing ones. Decision pending with user.

## ⚠️ CORRUPTION TO FIX (found 2026-06-30)
The chapter-HINTED fills (scripts/translit_pdf/fill_hinted.py, forced chapter on a ±4 page
range) put WRONG content into some verses — neighbouring-chapter verses got relabelled as
the target chapter. CONFIRMED WRONG: **Lev 25 (all filled v19-51 = Lev 23/27 content)**,
**Lev 11:47 (= Lev 13:47)**, **Lev 5:25 (looks like Lev 4)**. CONFIRMED CORRECT: Lev 7:37-38,
Lev 13:5, Deut 30:9-20, Deut 34:4. TODO: re-OCR the correct single continuation page per bad
chapter with a tight hint (Lev 25 real page = PDF p48, verses 19-51; p47 for 52-55) and
OVERWRITE. Better fix: only trust a hinted page if its verse-number span matches the needed
range. This is MY error — fix at no charge to user's budget.

## STATE (2026-06-30)
- **229 of 430 missing verses APPLIED to DB** (Gen+Exod done + cache-recovered). Backup: data/translit_backup_20260629_175024.json.
- ~$11.6 spent (136 pages in ocr_cache.json). User approved ~$4-7 MORE to finish.
- **201 still missing** = ~155 plain-integer (Lev/Num/Deut/some Exod) + ~46 composite expansion verses.
- **Root cause of Lev/Num failures (FIXED):** est_page anchors were wrong (Lev ch1 is p77 not p82; Num ch1 is p44 not p62 — verified from cache page→chapter map). Recalibrated slopes in fill_missing.py. Also switched ocr_cache key to PDF-based (`M:`/`D:`) so Gen-Num share cached pages (migrated existing cache 158->136).
- fill_result_applied.json = the 229 already applied. New run writes fresh fill_result.json (newly-filled only).
- **Composite expansion verses (~46): DB and PDF number them DIFFERENTLY** (e.g. Exod 20 DB `14-1,14-6,18-1` vs PDF `14-1..14-5,15-1`). Cannot map by number — needs CONTENT alignment. Separate task.
- Resume = re-run `py -3 scripts/translit_pdf/fill_missing.py --all --passes 1` (DB query targets only still-missing; cache reused free; checkpoints per chapter).

## Notes
- Book order_n: 1 Gen, 2 Exod, 3 Lev, 4 Num, 5 Deut.
- Known DB issues to watch: Deut chapters wrong/missing; Exodus missing ch.22 (corruption memory).
- ":" in transcription = length/stress mark (e.g. `å:rəṣ`). Keep as-is.
