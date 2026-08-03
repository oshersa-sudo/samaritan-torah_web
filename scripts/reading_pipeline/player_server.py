# -*- coding: utf-8 -*-
"""Local backend for player-all.html: serves the player + audio, and gives it
two live actions instead of the old "export JSON -> tell Claude" workflow:

  GET  /api/cloud_divisions?book_id=1
      Proxies the LIVE site's /api/portions + /api/sam_chapters (per portion)
      and returns {chapters: {n: {portion_id, portion_name, verses_num,
      incipit}}, portions: [...]}. Read-only, cloud -> player direction only.

  POST /api/apply
      Body: one edited group, in the SAME shape the player's old "export"
      button already produced (kind 'meir' or 'wit'). Cuts/renames audio
      with ffmpeg, refreshes verses/incipit/sam_ch_id/portion from the LIVE
      site's API for every touched chapter number, updates readings.json
      (or witnesses.json for a witness group). Does NOT touch git.

  POST /api/push
      git add -A the readings/witnesses paths, commit, push private
      web-deploy:main. Returns the git output so the player can show it.

Run: python player_server.py   (serves on http://localhost:8934)
Needs Python 3 (uses pathlib / f-strings) + ffmpeg on PATH.
"""
import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TORAH = Path(r"C:\Users\osher\Documents\torah")
WEB = TORAH / "web"
READINGS = WEB / "static" / "audio" / "readings"
READINGS_JSON = READINGS / "readings.json"
WITNESSES_JSON = WEB / "static" / "audio" / "witnesses.json"
DB = TORAH / "data" / "torah.db"
LIVE_BASE = "https://samaritan-torah.onrender.com"
PORT = 8934

BOOK_NAMES = {1: "בראשית", 2: "שמות", 3: "ויקרא", 4: "במדבר", 5: "דברים"}


# ───────────────────────── cloud helpers ─────────────────────────
def cloud_get(path):
    with urllib.request.urlopen(LIVE_BASE + path, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def cloud_divisions(book_id):
    """Every current chapter -> its portion + verse text, straight from the
    deployed site. This is what 'sync divisions from cloud' pulls."""
    portions = cloud_get("/api/portions?book_id={}".format(book_id))
    chapters = {}
    for p in portions:
        pid = p["id"]
        chs = cloud_get("/api/sam_chapters?portion_id={}".format(pid))
        for c in chs:
            chapters[c["number"]] = {
                "portion_id": pid,
                "portion_name": p["name"],
                "opening": c.get("opening", ""),
                "sam_ch_id": c["id"],
            }
    return {"portions": portions, "chapters": chapters}


# ───────────────────────── DB verse-metadata helpers ─────────────────────────
def gematria(n):
    ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"]
    tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"]
    if n <= 0:
        return str(n)
    t, o = divmod(n, 10)
    s = (tens[t] if t < 10 else "ק") + ones[o]
    return {"יה": "טו", "יו": "טז"}.get(s, s)


def chapter_meta(cur, book_id, sam_num):
    row = cur.execute("select id from sam_chapters where book_id=? and number=?", (book_id, sam_num)).fetchone()
    if not row:
        return None
    sid = row[0]
    locs = cur.execute(
        """SELECT c.number*1000+CAST(v.number AS INTEGER)
           FROM verses v JOIN chapters c ON v.chapter_id=c.id
           WHERE v.sam_ch_id=? ORDER BY c.number*1000+CAST(v.number AS INTEGER)""",
        (sid,),
    ).fetchall()
    if not locs:
        return None
    locs = [l[0] for l in locs]
    t1 = cur.execute(
        """SELECT v.text FROM verses v JOIN chapters c ON v.chapter_id=c.id
           WHERE v.sam_ch_id=? ORDER BY c.number*1000+CAST(v.number AS INTEGER) LIMIT 1""",
        (sid,),
    ).fetchone()
    fl, ll = locs[0], locs[-1]
    return {
        "sam_ch_id": sid,
        "verses": "{}:{}-{}:{}".format(gematria(fl // 1000), gematria(fl % 1000), gematria(ll // 1000), gematria(ll % 1000)),
        "verses_num": "{}:{}-{}:{}".format(fl // 1000, fl % 1000, ll // 1000, ll % 1000),
        "verse_count": len(locs),
        "incipit": " ".join((t1[0] if t1 else "").split()[:4]),
    }


def ffprobe_dur(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]
    )
    return float(out.strip())


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError("cmd failed: {}\n{}\n{}".format(cmd, p.stdout, p.stderr))
    return p.stdout


# ───────────────────────── apply: meir group ─────────────────────────
def apply_meir(entry):
    """entry = {book_id, portion_order, files:[{file,duration}], pieces:[{n,v0,v1}]}
    files/v0/v1 are in the SAME virtual timeline (files concatenated in order,
    starting at 0) that the player already uses. Pieces whose [v0,v1] exactly
    matches a run of whole original files are pure renames (lossless); any
    other piece is cut from a concat of the covering original files."""
    book_id = entry["book_id"]
    files = entry["files"]  # original, in order
    pieces = sorted(entry["pieces"], key=lambda p: p["v0"])

    # cumulative boundaries of the ORIGINAL files
    cum = [0.0]
    for f in files:
        cum.append(round(cum[-1] + f["duration"], 2))
    total = cum[-1]

    # SAFETY: a Meir group's timeline must stay fully, contiguously covered -
    # a gap here would mean audio silently dropped from the manifest.
    if not pieces:
        raise RuntimeError("refusing: no pieces submitted")
    if abs(pieces[0]["v0"]) > 0.06 or abs(pieces[-1]["v1"] - total) > 0.06:
        raise RuntimeError("refusing: pieces don't span the full timeline (0 to {:.2f}); "
                            "got {:.2f} to {:.2f}".format(total, pieces[0]["v0"], pieces[-1]["v1"]))
    for i in range(len(pieces) - 1):
        gap = pieces[i + 1]["v0"] - pieces[i]["v1"]
        if abs(gap) > 0.06:
            raise RuntimeError("refusing: gap/overlap of {:.2f}s between piece {} and {}".format(
                gap, pieces[i]["n"], pieces[i + 1]["n"]))

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        results = []  # (n, tmp_path, duration)

        for p in pieces:
            v0, v1 = round(p["v0"], 2), round(p["v1"], 2)
            # does [v0,v1] land exactly on one whole original file?
            exact_idx = None
            for i in range(len(files)):
                if abs(cum[i] - v0) < 0.06 and abs(cum[i + 1] - v1) < 0.06:
                    exact_idx = i
                    break
            out_path = tmp / "n{}.mp3".format(p["n"])
            if exact_idx is not None:
                shutil.copy(READINGS / Path(files[exact_idx]["file"]).name, out_path)
            else:
                # which original files does [v0,v1] touch?
                lo_i = next(i for i in range(len(files)) if cum[i + 1] > v0 + 0.001)
                hi_i = next(i for i in range(len(files)) if cum[i + 1] >= v1 - 0.001)
                span_files = files[lo_i:hi_i + 1]
                concat_list = tmp / "cc_{}.txt".format(p["n"])
                with open(concat_list, "w", encoding="utf-8") as f:
                    for sf in span_files:
                        src = (READINGS / Path(sf["file"]).name).as_posix()
                        f.write("file '{}'\n".format(src))
                span_wav = tmp / "span_{}.wav".format(p["n"])
                run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
                     "-i", str(concat_list), "-ac", "2", "-ar", "44100", str(span_wav)])
                local_v0 = v0 - cum[lo_i]
                local_v1 = v1 - cum[lo_i]
                cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(span_wav), "-ss", str(local_v0)]
                if hi_i < len(files) - 1 or v1 < total - 0.01:
                    cmd += ["-to", str(local_v1)]
                cmd += ["-c:a", "libmp3lame", "-q:a", "4", str(out_path)]
                run(cmd)

            dur = ffprobe_dur(out_path)
            expect = round(v1 - v0, 2)
            if abs(dur - expect) > 0.3:
                raise RuntimeError("piece n={} duration mismatch: got {:.2f} expected {:.2f}".format(p["n"], dur, expect))
            results.append((p["n"], out_path, round(dur, 2)))

        # place files: back up anything about to be overwritten that isn't
        # itself one of our new outputs (avoids the same-name clobber bug)
        prefix = Path(files[0]["file"]).name.split("-c")[0]  # e.g. b1-p11
        placed = {}
        for n, tmp_path, dur in results:
            dest_name = "{}-c{:03d}.mp3".format(prefix, n)
            dest = READINGS / dest_name
            placed[n] = (dest, dur)
        for n, tmp_path, dur in results:
            dest, _ = placed[n]
            shutil.copy(tmp_path, dest)

        # remove original files that are no longer referenced by ANY new piece
        # (only within this portion's own numbering - safe since this whole
        # portion's chapter range is being rebuilt from `pieces`)
        old_names = set(Path(f["file"]).name for f in files)
        new_names = set(Path(placed[n][0]).name for n in placed)
        for old_name in old_names - new_names:
            p = READINGS / old_name
            if p.exists():
                p.unlink()

    # update readings.json
    rd = json.loads(READINGS_JSON.read_text(encoding="utf-8"))
    b1 = next(b for b in rd["books"] if b["book_id"] == book_id)
    old_ns = set()
    for f in files:
        # any CURRENT entry whose file matches one of the original files
        for c in b1["chapters"]:
            if Path(c["file"]).name in old_names:
                old_ns.add(c["n"])
    new_ns = set(placed.keys())
    touched_ns = old_ns | new_ns

    con = sqlite3.connect(str(DB))
    cur = con.cursor()
    div = cloud_divisions(book_id)  # portion labels straight from live site

    kept = [c for c in b1["chapters"] if c["n"] not in touched_ns]
    ref_entry = next((c for c in b1["chapters"] if c["n"] in old_ns), None)
    src_scaffold = ref_entry["src"] if ref_entry else {"youtube_id": None}

    new_entries = []
    warnings = []
    for n in sorted(placed.keys()):
        dest, dur = placed[n]
        meta = chapter_meta(cur, book_id, n)
        if meta is None:
            warnings.append("chapter {} not found in local DB - skipped metadata refresh".format(n))
            continue
        pinfo = div["chapters"].get(n)
        portion = {"order": pinfo["portion_id"], "id": pinfo["portion_id"], "portion_name": pinfo["portion_name"]} if pinfo else (ref_entry["portion"] if ref_entry else {})
        if pinfo:
            portion = {"order": pinfo["portion_id"], "id": pinfo["portion_id"], "name": pinfo["portion_name"]}
        else:
            portion = ref_entry["portion"] if ref_entry else {"order": entry["portion_order"], "id": entry["portion_order"], "name": ""}
            warnings.append("chapter {} not found in CLOUD portions - kept old portion label".format(n))
        e = {
            "n": n,
            "sam_ch_number": n,
            "file": "/static/audio/readings/" + dest.name,
            "duration": dur,
            "src_start": 0,
            "src_end": dur,
            "portion": portion,
            "src": src_scaffold,
        }
        e.update(meta)
        e["name"] = "{} - {} - {}".format(BOOK_NAMES.get(book_id, ""), portion.get("name", ""), n)
        new_entries.append(e)

    kept.extend(new_entries)
    ns = [c["n"] for c in kept]
    dups = set(n for n in ns if ns.count(n) > 1)
    if dups:
        raise RuntimeError("would create duplicate chapter numbers: {}".format(dups))

    b1["chapters"] = kept
    READINGS_JSON.write_text(json.dumps(rd, ensure_ascii=False, indent=1), encoding="utf-8")

    return {
        "touched": sorted(touched_ns),
        "new_chapters": sorted(new_ns),
        "removed_chapters": sorted(old_ns - new_ns),
        "warnings": warnings,
    }


# ───────────────────────── apply: witness group ─────────────────────────
def apply_witness(entry):
    """entry = {reader, book_id, file, pieces:[{n,t0,t1}]} - pure time-range
    edit inside the existing masorot file, no audio cut needed.

    SAFETY: a masorot file can hold several sam-chapter witnesses for the
    same reader. The caller (player's buildWitGroup) always collects every
    piece sharing that file, but if it ever sends a PARTIAL set, silently
    dropping the old-only chapters would delete real data. Refuse instead."""
    wt = json.loads(WITNESSES_JSON.read_text(encoding="utf-8"))
    reader, book_id, file_ = entry["reader"], entry["book_id"], entry["file"]
    fname = Path(file_).name

    old_items = [it for it in wt["items"] if it["reader"] == reader and it["book_id"] == book_id
                 and any(s["file"].endswith(fname) for s in it.get("segs", []))]
    old_ns = set(it["sam_ch_number"] for it in old_items)
    new_ns = set(p["n"] for p in entry["pieces"])
    dropped = old_ns - new_ns
    if dropped:
        raise RuntimeError(
            "refusing: {} existing chapter(s) {} for this reader+file are missing from the "
            "submitted pieces (which only cover {}) - would silently delete them. "
            "Re-open the group in the player so ALL its pieces are included.".format(
                len(dropped), sorted(dropped), sorted(new_ns)))

    # chapters that ALSO have a segment in a DIFFERENT file (multi-file witness) -
    # preserve those other-file segments; only the segment in THIS file gets replaced
    other_file_segs = {}
    for it in old_items:
        others = [s for s in it.get("segs", []) if not s["file"].endswith(fname)]
        if others:
            other_file_segs[it["sam_ch_number"]] = others

    kept = [it for it in wt["items"] if not (it["reader"] == reader and it["book_id"] == book_id
            and any(s["file"].endswith(fname) for s in it.get("segs", [])))]

    con = sqlite3.connect(str(DB))
    cur = con.cursor()
    new_items = []
    for p in entry["pieces"]:
        n = p["n"]
        row = cur.execute("select id from sam_chapters where book_id=? and number=?", (book_id, n)).fetchone()
        chapter_std = None
        verses = ""
        if row:
            r2 = cur.execute(
                """select min(c.number), max(c.number) from verses v
                   join chapters c on v.chapter_id=c.id where v.sam_ch_id=?""", (row[0],)).fetchone()
            chapter_std = r2[0] if r2 else None
            r3 = cur.execute(
                """select min(cast(v.number as integer)), max(cast(v.number as integer)) from verses v
                   join chapters c on v.chapter_id=c.id where v.sam_ch_id=?""", (row[0],)).fetchone()
            if r3 and r3[0] is not None:
                verses = "{}-{}".format(r3[0], r3[1])
        this_seg = {"file": "/static/audio/masorot/" + fname, "t0": round(p["t0"], 2), "t1": round(p["t1"], 2)}
        segs = other_file_segs.get(n, []) + [this_seg]
        segs.sort(key=lambda s: s["file"])
        total_dur = round(sum(s["t1"] - s["t0"] for s in segs), 2)
        new_items.append({
            "reader": reader, "book_id": book_id, "sam_ch_number": n,
            "chapter": chapter_std, "verses": verses,
            "segs": segs,
            "duration": total_dur,
        })

    kept.extend(new_items)
    wt["items"] = kept
    WITNESSES_JSON.write_text(json.dumps(wt, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"reader": reader, "file": fname, "chapters": sorted(p["n"] for p in entry["pieces"])}


# ───────────────────────── git push ─────────────────────────
def run_in(cwd, cmd):
    p = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError("{}\n{}\n{}".format(cmd, p.stdout, p.stderr))
    return p.stdout


def push_to_cloud(message):
    run_in(TORAH, ["git", "add", "-A", "--", "web/static/audio/readings/", "web/static/audio/witnesses.json"])
    status = run_in(TORAH, ["git", "status", "--short", "web/static/audio/readings/", "web/static/audio/witnesses.json"])
    if not status.strip():
        return {"pushed": False, "reason": "no changes staged"}
    run_in(TORAH, ["git", "commit", "-m", message])
    push_out = run_in(TORAH, ["git", "push", "private", "web-deploy:main"])
    return {"pushed": True, "output": push_out, "status": status}


# ───────────────────────── HTTP handler ─────────────────────────
class Handler(BaseHTTPRequestHandler):
    def _send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("[player_server] " + (fmt % args))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/cloud_divisions":
            qs = urllib.parse.parse_qs(parsed.query)
            book_id = int(qs.get("book_id", ["1"])[0])
            try:
                self._send_json(cloud_divisions(book_id))
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return
        # static file serving
        rel = parsed.path.lstrip("/")
        if rel == "" or rel == "player-all.html":
            path = WEB / "player-all.html"
        else:
            path = WEB / rel
        try:
            path = path.resolve()
            if not str(path).startswith(str(WEB.resolve())):
                raise FileNotFoundError()
            data = path.read_bytes()
        except Exception:
            self.send_response(404)
            self.end_headers()
            return
        ctype = "application/octet-stream"
        if path.suffix == ".html":
            ctype = "text/html; charset=utf-8"
        elif path.suffix == ".mp3":
            ctype = "audio/mpeg"
        elif path.suffix == ".json":
            ctype = "application/json; charset=utf-8"
        elif path.suffix == ".js":
            ctype = "application/javascript"
        elif path.suffix == ".css":
            ctype = "text/css"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            self._send_json({"error": "bad json"}, 400)
            return

        if self.path == "/api/apply":
            try:
                if payload.get("kind") == "meir":
                    result = apply_meir(payload)
                elif payload.get("kind") == "wit":
                    result = apply_witness(payload)
                else:
                    raise RuntimeError("unknown kind")
                # rebuild the player so it reflects the new state on next open
                subprocess.run(["python", str(Path(__file__).parent / "build_player.py")], check=False)
                self._send_json({"ok": True, "result": result})
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)}, 500)
            return

        if self.path == "/api/push":
            try:
                msg = payload.get("message") or "Player: sync boundary edits to cloud"
                result = push_to_cloud(msg)
                self._send_json({"ok": True, "result": result})
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)}, 500)
            return

        self._send_json({"error": "not found"}, 404)


if __name__ == "__main__":
    print("player_server: http://localhost:{}/player-all.html".format(PORT))
    ThreadingHTTPServer(("localhost", PORT), Handler).serve_forever()
