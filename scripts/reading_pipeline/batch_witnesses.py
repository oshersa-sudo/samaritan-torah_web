# -*- coding: utf-8 -*-
"""Split the masorot archive (per-standard-chapter recordings, 7 readers) into
Samaritan-chapter TIME RANGES — a witness set per reader, like the chanter's.

No new audio files: output is witnesses.json mapping each (reader, sam chapter)
to segments [{file, t0, t1}] inside the existing /static/audio/masorot files.

Boundary logic = the validated pipeline: silence+cadence candidates, chosen by
DP against text-length priors; synthetic zero-score candidates at the expected
positions guarantee feasibility when the reading has no usable pauses.
Checkpoint: witnesses_progress.json (per reader+book+chapter group).
"""
import json, os, sqlite3, subprocess, sys, wave
import numpy as np

SCRATCH = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRATCH)
TORAH = r"C:/Users/osher/Documents/torah"
DB = os.path.join(TORAH, "data", "torah.db")
MASOROT_DIR = os.path.join(TORAH, "web", "static", "audio", "masorot")
PROGRESS = os.path.join(SCRATCH, "witnesses_progress.json")

_g = open("batch_genesis.py", encoding="utf-8").read()
_chunk = _g.split("# ── audio analysis")[1].split("# ── main loop")[0]
exec(_chunk[_chunk.index("\n"):])          # analyze()

man = json.load(open(os.path.join(MASOROT_DIR, "masorot.json"), encoding="utf-8"))
con = sqlite3.connect(DB)
cur = con.cursor()

def chapter_data(book_id, ch):
    """verse char lengths + sam chapters (verse spans) of one standard chapter."""
    verses = dict(cur.execute("""select cast(v.number as integer), length(v.text)
        from verses v join chapters c on v.chapter_id=c.id
        where c.book_id=? and c.number=?""", (book_id, ch)).fetchall())
    sams = []
    for sid, num in cur.execute("select id, number from sam_chapters where book_id=?", (book_id,)).fetchall():
        r = cur.execute("""select min(c.number*1000+cast(v.number as integer)),
                                  max(c.number*1000+cast(v.number as integer))
            from verses v join chapters c on v.chapter_id=c.id
            where v.sam_ch_id=? and c.number=?""", (sid, ch)).fetchone()
        full = cur.execute("""select min(c.number), max(c.number)
            from verses v join chapters c on v.chapter_id=c.id where v.sam_ch_id=?""", (sid,)).fetchone()
        full_span = cur.execute("""select min(c.number*1000+cast(v.number as integer)),
                                          max(c.number*1000+cast(v.number as integer))
            from verses v join chapters c on v.chapter_id=c.id where v.sam_ch_id=?""", (sid,)).fetchone()
        # A Samaritan chapter is not obliged to sit inside one standard chapter —
        # plenty of them open in the middle of one and run on into the next. Taking
        # only the ones that fit inside a single chapter dropped every crossing
        # chapter from the witness set, and the app then fell back to offering the
        # WHOLE standard chapter for them: the reader asked for a chapter that
        # opens at Gen 4:25 and heard the recording start at Gen 4:1. So the test
        # is overlap, and each piece records the part that lies in THIS chapter
        # together with the chapter's full span, which may reach beyond it.
        if r[0] is not None:
            sams.append(dict(num=num, a=r[0] % 1000, b=r[1] % 1000,
                             ga=full_span[0], gb=full_span[1],
                             opens_here=(full[0] == ch)))
    sams.sort(key=lambda s: s["a"])
    return verses, sams

# groups: (reader, book_id, chapter) -> [items]
groups = {}
for it in man["items"]:
    groups.setdefault((it["reader"], it["book_id"], it["chapter"]), []).append(it)

prog = json.load(open(PROGRESS, encoding="utf-8")) if os.path.exists(PROGRESS) else {}
out_items = prog.get("_items", [])
done = set(tuple(k) for k in prog.get("_done", []))

carry = {}          # sam num -> {s, segs}, kept across a reader's whole book
_cur_rb = None


def flush_book(reader, book_id):
    """Emit every Samaritan chapter whose pieces now cover its FULL span. Held
    until the reader's book is done, because a chapter that opens in one standard
    chapter and closes in the next is only whole once both have been read."""
    n = 0
    for num, rec in sorted(carry.items()):
        s, segs = rec["s"], rec["segs"]
        segs = sorted(segs, key=lambda c: c["cov"][0])
        covered = [(c["cov"][0], c["cov"][1]) for c in segs]
        lo, hi = covered[0][0], covered[-1][1]
        # contiguous, allowing the step from the end of one standard chapter to
        # the first verse of the next
        contig = all(covered[i+1][0] == covered[i][1] + 1
                     or covered[i+1][0] // 1000 == covered[i][0] // 1000 + 1
                     for i in range(len(covered)-1))
        if lo != s["ga"] or hi < s["gb"] or not contig: continue    # still partial
        dur = round(sum(c["t1"]-c["t0"] for c in segs), 2)
        out_items.append({
            "reader": reader, "book_id": book_id, "sam_ch_number": num,
            "chapter": segs[0]["ch"], "verses": f"{s['ga'] % 1000}-{s['gb'] % 1000}",
            "spans": sorted({c["ch"] for c in segs}),
            "segs": [{"file": c["file"], "t0": c["t0"], "t1": c["t1"]} for c in segs],
            "duration": dur,
        })
        n += 1
    carry.clear()
    return n


for (reader, book_id, ch), items in sorted(groups.items(), key=lambda g: (g[0][0], g[0][1], g[0][2])):
    if _cur_rb is not None and _cur_rb != (reader, book_id):
        flush_book(*_cur_rb)
    _cur_rb = (reader, book_id)
    key = (reader, book_id, ch)
    if list(key) in prog.get("_done", []) or key in done: continue
    items = sorted(items, key=lambda i: i["v1"])
    verses, sams = chapter_data(book_id, ch)
    if not sams:
        done.add(key); continue

    # analyze each part
    parts = []          # {item, dur, cands}
    ok = True
    for it in items:
        src = os.path.join(TORAH, "web", it["file"].lstrip("/").replace("/", os.sep))
        if not os.path.exists(src): ok = False; break
        wavf = "wtn_tmp.wav"
        subprocess.run(["ffmpeg","-y","-v","error","-i",src,"-ac","1","-ar","16000",wavf], check=True)
        dur, cands, med = analyze(wavf)
        os.remove(wavf)
        parts.append(dict(it=it, dur=dur, cands=[c for c in cands if 2 < c["start"] < dur-2]))
    if not ok:
        print(f"!! missing file for {reader} b{book_id} ch{ch}", flush=True); done.add(key); continue

    def chars(v1, v2):
        return sum(verses.get(v, 0) for v in range(v1, v2+1))

    # per part: detect boundaries at sam starts inside the part span
    for p in parts:
        it = p["it"]
        pv1, pv2 = it["v1"], min(it["v2"], max(verses) if verses else it["v2"])
        starts = [s for s in sams if pv1 < s["a"] <= pv2]        # boundary BEFORE verse s.a
        K = len(starts)
        span_chars = chars(pv1, pv2) or 1
        expected = [p["dur"] * chars(pv1, s["a"]-1) / span_chars for s in starts]
        cands = list(p["cands"])
        for eidx, e in enumerate(expected):                       # synthetic fallbacks
            cands.append({"start": e, "end": e, "score": 0.0, "cad": False, "syn": True})
        cands.sort(key=lambda c: c["start"])
        # DP: K boundaries, maximize score - 400*dev^2, min gap 4s
        chosen = []
        if K:
            LAM, GAP, NEG = 400.0, 4.0, -1e18
            C = len(cands)
            dp = [[NEG]*(K+1) for _ in range(C)]
            par = [[-1]*(K+1) for _ in range(C)]
            def val(i, k):
                d = (cands[i]["start"] - expected[k-1]) / max(p["dur"], 1)
                return cands[i]["score"] - LAM*d*d
            for i in range(C): dp[i][1] = val(i, 1)
            for k in range(2, K+1):
                best_j, best_v, ptr = -1, NEG, 0
                for i in range(C):
                    while ptr < i and cands[ptr]["start"] <= cands[i]["start"] - GAP:
                        if dp[ptr][k-1] > best_v: best_v, best_j = dp[ptr][k-1], ptr
                        ptr += 1
                    if best_v > NEG:
                        dp[i][k] = best_v + val(i, k); par[i][k] = best_j
            end_i = max(range(C), key=lambda i: dp[i][K])
            if dp[end_i][K] < -1e17:
                # infeasible under the min-gap (e.g. expected boundaries closer
                # than GAP) — fall back to the pure text-proportion positions
                chosen = [{"start": e, "end": e, "score": 0.0, "cad": False} for e in expected]
            else:
                sel, i, k = [], end_i, K
                while k >= 1 and i >= 0: sel.append(i); i = par[i][k]; k -= 1
                chosen = [cands[i] for i in sorted(sel)]
        bounds = [0.0] + [round((c["start"]+c["end"])/2, 2) for c in chosen] + [round(p["dur"], 2)]
        # segment i covers verses [seg_v1 .. next start-1]
        seg_v = [pv1] + [s["a"] for s in starts]
        for i in range(len(bounds)-1):
            v_lo = seg_v[i]
            v_hi = (seg_v[i+1]-1) if i+1 < len(seg_v) else pv2
            # which sam chapter do these verses belong to? the one containing v_lo
            owner = next((s for s in sams if s["a"] <= v_lo <= s["b"]), None)
            if owner is None: continue
            carry.setdefault(owner["num"], {"s": owner, "segs": []})["segs"].append(
                {"file": p["it"]["file"], "t0": bounds[i], "t1": bounds[i+1],
                 "cov": (ch * 1000 + v_lo, ch * 1000 + v_hi), "ch": ch})

    done.add(key)
    prog = {"_done": [list(k) for k in done], "_items": out_items}
    json.dump(prog, open(PROGRESS, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"[{reader} | b{book_id} ch{ch}] parts={len(parts)} sams={len(sams)} emitted so far={len(out_items)}", flush=True)

if _cur_rb is not None: flush_book(*_cur_rb)     # the last reader's last book

# final manifest
readers = []
seen = {}
for it in man["items"]:
    if it["reader"] not in seen:
        seen[it["reader"]] = True
src_idx = json.load(open(os.path.join(TORAH, "data", "masorot_shomronim", "index.json"), encoding="utf-8"))
meta = {}
for i in src_idx:
    meta.setdefault(i["reader"], {"origin": i.get("origin",""), "years": set()})
    if i.get("year"): meta[i["reader"]]["years"].add(str(i["year"]))
readers = [{"name": r, "origin": m["origin"], "years": "-".join(sorted(m["years"]))}
           for r, m in meta.items()]
out = {"version": 1, "kind": "sam-chapter-witnesses", "readers": readers, "items": out_items}
dest = os.path.join(TORAH, "web", "static", "audio", "witnesses.json")
json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nWITNESSES DONE: {len(out_items)} sam-chapter witness entries -> {dest}", flush=True)
