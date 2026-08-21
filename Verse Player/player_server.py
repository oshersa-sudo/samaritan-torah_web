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

  GET  /api/sync_status?book_id=1&reader=meir
      {synced: {n: bool}} - for every chapter the given reader (meir or a
      witness name) currently has locally, compares its recording segment
      (duration+verses_num+filename, or exact segs for a witness) against
      the LIVE deployed readings.json/witnesses.json for that SAME chapter
      number. Drives the red/green light per chapter in the grid.

  POST /api/redownload_split
      Body: {source, book_id, portion_order}. source is a URL (yt-dlp
      download) or a local file path. Re-runs the ORIGINAL auto-split
      algorithm (audio_analysis.py: silence+cadence candidates, DP boundary
      selection anchored to text-length priors from the local DB) against
      the fresh audio, for whatever chapters the LIVE portion structure
      currently assigns to portion_order. Cuts N staging MP3s (temp names,
      not yet the portion's real filenames) into the readings dir and
      returns {files:[{n,file,duration}], total, weak_boundaries}. Does NOT
      touch readings.json - the player loads the result as a fresh group so
      the user reviews/tunes it with the normal piece editor before Apply.

Run: python player_server.py   (serves on http://localhost:8934)
Needs Python 3 (uses pathlib / f-strings) + ffmpeg on PATH; redownload_split
also needs numpy (audio_analysis.py) and, for URL sources, yt-dlp.
"""
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import uuid
import urllib.request
import urllib.parse
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audio_analysis

# Derive the project root from this file's own location (<root>/Verse Player/…)
# instead of hardcoding it. The repo is checked out in more than one place
# (main clone + a `git worktree` for web-deploy), and a hardcoded path made the
# tool silently read the OTHER checkout - wrong branch, no audio files.
# Override with the TORAH_ROOT env var if you ever need to point elsewhere.
def _project_root():
    """<root>/Verse Player/<this file>  ->  <root>.

    In a PyInstaller build __file__ points inside the unpacked temp directory,
    so the location that means anything is the .exe itself. TORAH_ROOT wins
    over both, which is how the packaged app is pointed at the recordings when
    it is not sitting inside the project."""
    env = os.environ.get("TORAH_ROOT")
    if env:
        return Path(env)
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent.parent
    return Path(__file__).resolve().parent.parent


TORAH = _project_root()
# build_player reads the same variable, and in a frozen build it cannot work
# the root out for itself either.
os.environ["TORAH_ROOT"] = str(TORAH)
WEB = TORAH / "web"
READINGS = WEB / "static" / "audio" / "readings"
READINGS_JSON = READINGS / "readings.json"
WITNESSES_JSON = WEB / "static" / "audio" / "witnesses.json"
DB = TORAH / "data" / "torah.db"
LIVE_BASE = "https://samaritan-torah.onrender.com"
PORT = 8934

BOOK_NAMES = {1: "בראשית", 2: "שמות", 3: "ויקרא", 4: "במדבר", 5: "דברים"}


# ───────────────────────── cloud helpers ─────────────────────────
def cloud_get(path, retries=3, backoff=5, timeout=12):
    """The live site is on Render's free tier and spins down when idle -
    the first request after a while can 502/time out while it wakes back
    up, so retry through that rather than failing the whole operation.

    Bounded on purpose: worst case here is ~46s, not minutes. Callers that
    are a passive background nicety (sync lights) pass retries=1 so a site
    that is genuinely down never leaves the UI hanging; user-initiated work
    worth waiting for (redownload/apply) uses the default."""
    last_err = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(LIVE_BASE + path, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(backoff)
    raise RuntimeError(
        "האתר החי אינו זמין ({} ניסיונות). ייתכן שהוא בהמתנה להתעוררות "
        "(Render free tier) - נסה שוב בעוד דקה. פרטים: {}".format(retries, last_err))


def cloud_divisions(book_id, retries=3):
    """Every current chapter -> its portion + verse text, straight from the
    deployed site. This is what 'sync divisions from cloud' pulls.
    portion_id is the site's global DB row id (NOT stable/comparable across
    books - book 2 starts at 21, book 3 at 30, etc); portion_order is the
    1-based position of the portion WITHIN this book, which is what the
    player UI/readings.json actually mean by "portion order" - keep these
    two distinct, conflating them only ever worked by coincidence for
    Genesis (book 1), where id happens to equal order."""
    portions = cloud_get("/api/portions?book_id={}".format(book_id), retries=retries)
    portions = sorted(portions, key=lambda p: p.get("start_ch", p["id"]))
    chapters = {}
    for order, p in enumerate(portions, start=1):
        pid = p["id"]
        chs = cloud_get("/api/sam_chapters?portion_id={}".format(pid), retries=retries)
        for c in chs:
            chapters[c["number"]] = {
                "portion_id": pid,
                "portion_order": order,
                "portion_name": p["name"],
                "opening": c.get("opening", ""),
                "sam_ch_id": c["id"],
            }
    return {"portions": portions, "chapters": chapters}


def _same_segment(a, b):
    """Is the recording SEGMENT for a sam_ch_number identical between two
    manifest entries? duration + verses_num + filename together are a good
    proxy for 'same audio content, same chapter identity' without needing
    to byte-compare the mp3s themselves."""
    return (
        round(float(a.get("duration", 0)), 2) == round(float(b.get("duration", 0)), 2)
        and a.get("verses_num") == b.get("verses_num")
        and Path(a.get("file", "")).name == Path(b.get("file", "")).name
    )


def sync_status(book_id, reader):
    """{n: bool} - for every chapter this reader currently has locally, is
    its recording segment identical to what's live on the deployed site
    right now? Used for the per-chapter red/green sync light in the grid."""
    if reader == "meir":
        live_rd = cloud_get("/static/audio/readings/readings.json", retries=1)
        live_b = next((b for b in live_rd["books"] if b["book_id"] == book_id), None)
        live_by_n = {c["n"]: c for c in (live_b["chapters"] if live_b else [])}

        local_rd = json.loads(READINGS_JSON.read_text(encoding="utf-8"))
        local_b = next((b for b in local_rd["books"] if b["book_id"] == book_id), None)
        local_chapters = local_b["chapters"] if local_b else []

        result = {}
        for c in local_chapters:
            lv = live_by_n.get(c["n"])
            result[c["n"]] = bool(lv) and _same_segment(c, lv)
        return {"synced": result}

    live_wt = cloud_get("/static/audio/witnesses.json", retries=1)
    live_by_key = {}
    for it in live_wt["items"]:
        live_by_key.setdefault((it["reader"], it["book_id"]), {})[it["sam_ch_number"]] = it

    local_wt = json.loads(WITNESSES_JSON.read_text(encoding="utf-8"))
    live_for_reader = live_by_key.get((reader, book_id), {})
    result = {}
    for it in local_wt["items"]:
        if it["reader"] != reader or it["book_id"] != book_id:
            continue
        lv = live_for_reader.get(it["sam_ch_number"])
        result[it["sam_ch_number"]] = bool(lv) and it.get("segs") == lv.get("segs")
    return {"synced": result}


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


# A windowed build has no console of its own, so every ffmpeg/git call would
# otherwise flash up a black console window of its own. CREATE_NO_WINDOW keeps
# them invisible; it does not exist off Windows, hence the getattr.
_NO_WINDOW = {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}     if os.name == "nt" else {}


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, **_NO_WINDOW)
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

    # SAFETY: duplicate chapter numbers would collapse into one entry
    # (placed[] is keyed by n, and both pieces map to the same output
    # filename), silently DROPPING a piece of audio. The contiguity check
    # below cannot catch this - the timeline still looks fully covered.
    # This has bitten for real before (an un-renumbered split produced two
    # pieces numbered 95, and one chapter's audio went missing).
    seen_ns = {}
    for p in pieces:
        if p["n"] in seen_ns:
            raise RuntimeError(
                "refusing: chapter number {} appears on more than one piece. "
                "This usually means a split wasn't renumbered - use "
                "'מספר מחדש ברצף' (or fix the numbers) and try again.".format(p["n"]))
        seen_ns[p["n"]] = True

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
        # itself one of our new outputs (avoids the same-name clobber bug).
        # Prefer an EXPLICIT prefix from the caller (always correct); only
        # fall back to inferring from files[0]'s name for older callers -
        # that inference breaks for staging files from /api/redownload_split,
        # whose names don't follow the b{book}-p{portion}-c{n} convention.
        prefix = entry.get("prefix") or Path(files[0]["file"]).name.split("-c")[0]  # e.g. b1-p11
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
        if pinfo:
            portion = {"order": pinfo["portion_order"], "id": pinfo["portion_id"], "name": pinfo["portion_name"]}
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


# ───────────────────────── redownload + auto-split ─────────────────────────
def ytdlp(argv):
    """Run yt-dlp with the usual command-line flags, in this process.

    It used to be `sys.executable -m yt_dlp`. In the packaged build
    sys.executable is VersePlayer.exe, so that did not start a downloader at
    all - it started a SECOND COPY OF THE APP. That is what "pressing
    redownload opens a new session" was.

    yt_dlp is bundled, so its own option parser is handed the same argv and the
    download runs here. parse_options rather than main() on purpose: main()
    installs process-level signal handlers, which fails off the main thread,
    and every request is served on one.
    """
    import yt_dlp
    parsed = yt_dlp.parse_options(list(argv))
    opts = parsed.ydl_opts if hasattr(parsed, "ydl_opts") else parsed[-1]
    urls = parsed.urls if hasattr(parsed, "urls") else parsed[-2]
    with yt_dlp.YoutubeDL(opts) as ydl:
        code = ydl.download(urls)
    if code:
        raise RuntimeError("yt-dlp failed (code {}) for: {}".format(code, urls))


def move_chapter(payload):
    """Nudge the boundary between two portions by one chapter.

    Only a portion's FIRST chapter may move back, and only its LAST chapter may
    move forward: a portion is a contiguous run, so moving anything from the
    middle would tear a hole in it. The chapter's recording is renamed into the
    neighbouring portion's series (b{book}-p{portion}-c{n}) and its manifest
    label is taken from the live site, which is what decides where a chapter
    belongs.
    """
    book_id = int(payload["book_id"])
    n = int(payload["n"])
    direction = int(payload["direction"])
    if direction not in (-1, 1):
        raise RuntimeError("direction must be -1 (previous portion) or +1 (next)")

    rd = json.loads(READINGS_JSON.read_text(encoding="utf-8"))
    book = next((x for x in rd["books"] if x["book_id"] == book_id), None)
    if book is None:
        raise RuntimeError("book {} is not in the manifest".format(book_id))
    entry = next((c for c in book["chapters"] if c.get("n") == n), None)
    if entry is None:
        raise RuntimeError("chapter {} is not in {}".format(n, BOOK_NAMES.get(book_id, book_id)))
    if "file" not in entry:
        raise RuntimeError(
            "פרק {} מורכב מכמה קטעי מקור (segs) ואין לו קובץ יחיד להעביר - "
            "טפל בו ידנית".format(n))

    cur = (entry.get("portion") or {}).get("order")
    if not cur:
        raise RuntimeError("chapter {} has no portion order in the manifest".format(n))
    siblings = sorted(c["n"] for c in book["chapters"]
                      if (c.get("portion") or {}).get("order") == cur)
    edge, word = (siblings[0], "הראשון") if direction == -1 else (siblings[-1], "האחרון")
    if n != edge:
        raise RuntimeError(
            "רק הפרק {} בפרשה יכול לזוז לכיוון הזה. בפרשה {} זה פרק {}, לא {}."
            .format(word, cur, edge, n))
    if len(siblings) == 1:
        raise RuntimeError("פרשה {} מכילה רק את פרק {} - העברתו תרוקן אותה".format(cur, n))

    target = cur + direction
    div = cloud_divisions(book_id)
    plist = sorted(div["portions"], key=lambda p: p.get("start_ch", p["id"]))
    if target < 1 or target > len(plist):
        raise RuntimeError("אין פרשה מספר {} ב{}".format(target, BOOK_NAMES.get(book_id, book_id)))
    tp = plist[target - 1]

    old_path = READINGS / Path(entry["file"]).name
    new_name = "b{}-p{:02d}-c{:03d}.mp3".format(book_id, target, n)
    new_path = READINGS / new_name
    if new_path.exists() and new_path.resolve() != old_path.resolve():
        raise RuntimeError("כבר קיים קובץ בשם {} - לא דורס".format(new_name))
    if not old_path.exists():
        raise RuntimeError("קובץ האודיו {} חסר".format(old_path.name))

    stamp = time.strftime("%Y%m%d_%H%M%S")
    shutil.copy2(READINGS_JSON, READINGS_JSON.with_suffix(".json.bak_" + stamp))
    if new_path.resolve() != old_path.resolve():
        old_path.rename(new_path)

    entry["file"] = "/static/audio/readings/" + new_name
    entry["portion"] = {"order": target, "id": tp["id"], "name": tp["name"]}
    READINGS_JSON.write_text(json.dumps(rd, ensure_ascii=False, indent=1), encoding="utf-8")
    rebuild_player()
    return {"n": n, "from_order": cur, "to_order": target,
            "to_name": tp["name"], "file": new_name, "backup": stamp}


def redownload_split(payload):
    """Re-fetch a source recording (YouTube URL or local file path) and
    re-run the ORIGINAL auto-split algorithm against it, for whichever
    chapters the LIVE portion structure currently assigns to portion_order.
    Writes N staging MP3s (temp names) into READINGS and returns their
    durations/chapter-number assignment WITHOUT touching readings.json -
    the player loads this as a fresh, reviewable group."""
    source = payload["source"].strip()
    book_id = payload["book_id"]
    portion_order = payload["portion_order"]

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)

        if re.match(r"^https?://", source, re.I):
            ytdlp(["--no-playlist", "--js-runtimes", "node",
                   "-x", "--audio-format", "mp3",
                   "-o", str(tmp / "src.%(ext)s"), source])
            found = list(tmp.glob("src.*"))
            if not found:
                raise RuntimeError("yt-dlp produced no output file for: {}".format(source))
            audio_path = found[0]
        else:
            audio_path = Path(source)
            if not audio_path.exists():
                raise RuntimeError("local file not found: {}".format(source))

        wav_path = tmp / "analysis.wav"
        run(["ffmpeg", "-y", "-v", "error", "-i", str(audio_path), "-ac", "1", "-ar", "16000", str(wav_path)])
        dur, cands, med = audio_analysis.analyze(str(wav_path))
        cands = [c for c in cands if 2 < c["start"] < dur - 2]

        div = cloud_divisions(book_id)
        chapter_nums = [n for n, info in div["chapters"].items() if info["portion_order"] == portion_order]
        if not chapter_nums:
            raise RuntimeError("live API lists no chapters for portion {} - check portion_order".format(portion_order))

        con = sqlite3.connect(str(DB))
        cur = con.cursor()
        metas = []
        for num in chapter_nums:
            row = cur.execute("select id from sam_chapters where book_id=? and number=?", (book_id, num)).fetchone()
            if not row:
                continue
            rows = cur.execute(
                """select c.number*1000+cast(v.number as integer), length(v.text)
                   from verses v join chapters c on v.chapter_id=c.id where v.sam_ch_id=?""",
                (row[0],)).fetchall()
            if not rows:
                continue
            metas.append({"number": num, "first": min(r[0] for r in rows), "chars": sum(r[1] or 0 for r in rows)})
        metas.sort(key=lambda m: m["first"])
        N = len(metas)
        if N < 2:
            raise RuntimeError("resolved fewer than 2 chapters ({}) for this portion from the local DB - aborting".format(N))

        total_chars = sum(m["chars"] for m in metas)
        cum = 0.0
        expected = []
        for m in metas[:-1]:
            cum += m["chars"]
            expected.append(dur * cum / total_chars)

        chosen = audio_analysis.choose_boundaries_dp(cands, expected, dur)
        bounds = [0.0] + [round((c["start"] + c["end"]) / 2, 2) for c in chosen] + [round(dur, 2)]
        weak = sum(1 for c in chosen if not c.get("cad"))

        stamp = uuid.uuid4().hex[:8]
        out_files = []
        for i, m in enumerate(metas):
            a, b = bounds[i], bounds[i + 1]
            out_name = "_redl{}_c{:03d}.mp3".format(stamp, m["number"])
            out_path = READINGS / out_name
            cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(audio_path), "-ss", str(a)]
            if i < len(metas) - 1:
                cmd += ["-to", str(b)]
            cmd += ["-c:a", "libmp3lame", "-q:a", "4", str(out_path)]
            run(cmd)
            piece_dur = round(ffprobe_dur(out_path), 2)
            out_files.append({"n": m["number"], "file": "/static/audio/readings/" + out_name, "duration": piece_dur})

    return {
        "files": out_files,
        "total": round(dur, 2),
        "n_chapters": N,
        "weak_boundaries": weak,
        "portion_name": next((info["portion_name"] for info in div["chapters"].values()
                               if info["portion_order"] == portion_order), ""),
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

    # Duplicate numbers would emit two witnesses.json items for the same
    # reader+chapter - ambiguous, and whichever the app picks is arbitrary.
    # (Same root cause as the Meir path: an un-renumbered split.)
    dup_seen = set()
    for p in entry["pieces"]:
        if p["n"] in dup_seen:
            raise RuntimeError(
                "refusing: chapter number {} appears on more than one piece. "
                "Use 'מספר מחדש ברצף' (or fix the numbers) and try again.".format(p["n"]))
        dup_seen.add(p["n"])

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
    p = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, **_NO_WINDOW)
    if p.returncode != 0:
        raise RuntimeError("{}\n{}\n{}".format(cmd, p.stdout, p.stderr))
    return p.stdout


def rebuild_player():
    """Regenerate web/player-all.html after the manifest changed.

    This used to shell out to `python build_player.py`. A packaged build has
    neither a python on PATH nor a .py file on disk to hand it, so the build
    runs in-process instead: build_player does all its work at import time, so
    re-importing it is the rebuild. It is also faster than spawning a process.
    """
    import importlib
    mod = sys.modules.get("build_player")
    if mod is None:
        import build_player          # the import itself is the build
    else:
        importlib.reload(mod)        # every later call re-runs it


def cleanup_orphan_staging():
    """Delete any _redl* staging file left in READINGS that isn't referenced
    by the current readings.json - leftovers from an abandoned/superseded
    redownload attempt. Without this, `git add -A` in push_to_cloud() would
    happily commit+push them as unused dead weight (bit us once already)."""
    rd = json.loads(READINGS_JSON.read_text(encoding="utf-8"))
    referenced = set()
    for b in rd["books"]:
        for c in b["chapters"]:
            if "file" in c:
                referenced.add(Path(c["file"]).name)
            for s in c.get("segs", []):
                referenced.add(Path(s["file"]).name)
    removed = []
    for p in READINGS.glob("_redl*.mp3"):
        if p.name not in referenced:
            p.unlink()
            removed.append(p.name)
    return removed


def push_to_cloud(message):
    cleanup_orphan_staging()
    run_in(TORAH, ["git", "add", "-A", "--", "web/static/audio/readings/", "web/static/audio/witnesses.json"])
    status = run_in(TORAH, ["git", "status", "--short", "web/static/audio/readings/", "web/static/audio/witnesses.json"])
    if not status.strip():
        return {"pushed": False, "reason": "no changes staged"}
    run_in(TORAH, ["git", "commit", "-m", message])

    # The repo is worked on from more than one place, so the remote often has
    # commits we don't - git then rejects the push as non-fast-forward and the
    # button just fails with a wall of git hint text. Catch up first.
    rebased_onto = None
    run_in(TORAH, ["git", "fetch", "private"])
    behind = run_in(TORAH, ["git", "rev-list", "--count", "web-deploy..private/main"]).strip()
    if behind and behind != "0":
        # Refuse to rebase if the incoming commits touch the same files we do -
        # that needs a human, not an automatic replay of audio edits.
        ours = set(run_in(TORAH, ["git", "diff", "--name-only", "private/main...web-deploy"]).split("\n"))
        theirs = set(run_in(TORAH, ["git", "diff", "--name-only", "web-deploy...private/main"]).split("\n"))
        clash = sorted(f for f in (ours & theirs) if f.strip())
        if clash:
            raise RuntimeError(
                "the cloud has {} new commit(s) that change the SAME files as your edits "
                "({}{}). Not rebasing automatically - your work is committed locally and "
                "safe; this needs to be merged by hand.".format(
                    behind, ", ".join(clash[:3]), " and more" if len(clash) > 3 else ""))
        try:
            run_in(TORAH, ["git", "rebase", "private/main"])
        except Exception as e:
            # --abort itself throws if no rebase actually started; don't let
            # that mask the real error.
            try:
                run_in(TORAH, ["git", "rebase", "--abort"])
            except Exception:
                pass
            raise RuntimeError(
                "could not replay your edits on top of the {} new cloud commit(s): {}. "
                "Your work is committed locally and safe.".format(behind, e))
        rebased_onto = behind

    push_out = run_in(TORAH, ["git", "push", "private", "web-deploy:main"])
    return {"pushed": True, "output": push_out, "status": status, "rebased_onto": rebased_onto}


# ───────────────────────── HTTP handler ─────────────────────────
class Handler(BaseHTTPRequestHandler):
    # HTTP/1.1 so browsers get correct Range/206 semantics, but WITHOUT
    # keep-alive: switching pieces aborts the in-flight audio request
    # mid-body, which leaves a reusable keep-alive connection out of sync
    # (server mid-write, browser expecting a fresh response). The browser
    # then reuses that poisoned connection for the next piece and the
    # <audio> element hangs at readyState 0 - observed directly, and the
    # exact "sometimes it plays, sometimes it doesn't" symptom. One
    # connection per request costs nothing on localhost and makes a stale
    # connection structurally impossible.
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Connection", "close")
        self.close_connection = True
        BaseHTTPRequestHandler.end_headers(self)

    def handle_one_request(self):
        # A browser aborting an in-flight audio request (normal when switching
        # pieces) surfaces here as a connection reset; without this it prints
        # a full traceback per abort and tears the thread down noisily.
        try:
            BaseHTTPRequestHandler.handle_one_request(self)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            self.close_connection = True

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
        # Local-only liveness check. The UI used to ping /api/cloud_divisions
        # for this, which reaches out to the LIVE site - so whenever the
        # deployed site was asleep the player reported "local server not
        # available" even though it was running fine.
        if parsed.path == "/api/ping":
            self._send_json({"ok": True})
            return

        if parsed.path == "/api/cloud_divisions":
            qs = urllib.parse.parse_qs(parsed.query)
            book_id = int(qs.get("book_id", ["1"])[0])
            # retries=1: this also backs the "server connected?" ping on page
            # load, so it must never hang the UI when the live site is down.
            retries = int(qs.get("retries", ["1"])[0])
            try:
                self._send_json(cloud_divisions(book_id, retries=retries))
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return

        if parsed.path == "/api/sync_status":
            qs = urllib.parse.parse_qs(parsed.query)
            book_id = int(qs.get("book_id", ["1"])[0])
            reader = qs.get("reader", ["meir"])[0]
            try:
                self._send_json(sync_status(book_id, reader))
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
            file_size = path.stat().st_size
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

        # Real Range support: the server has always advertised Accept-Ranges
        # but ignored the Range header and returned the whole file - the
        # <audio> element relies on real 206 responses to seek, and a 200
        # instead can make seeking/playback silently fail depending on
        # where in the file you seek to (this is why playback looked
        # "random": it depended on which byte offset was requested).
        start, end, status = 0, file_size - 1, 200
        range_header = self.headers.get("Range")
        if range_header:
            m = re.match(r"bytes=(\d*)-(\d*)", range_header)
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else file_size - 1
                else:
                    start = max(0, file_size - int(m.group(2)))
                    end = file_size - 1
                start = max(0, min(start, file_size - 1)) if file_size else 0
                end = max(start, min(end, file_size - 1)) if file_size else 0
                status = 206
        length = end - start + 1 if file_size else 0

        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        if status == 206:
            self.send_header("Content-Range", "bytes {}-{}/{}".format(start, end, file_size))
        self.end_headers()
        if self.command != "HEAD":
            try:
                with open(path, "rb") as f:
                    f.seek(start)
                    self.wfile.write(f.read(length))
            except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
                # browser moved on (switched pieces mid-download) - expected
                self.close_connection = True

    def do_HEAD(self):
        self.do_GET()

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
                rebuild_player()
                self._send_json({"ok": True, "result": result})
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)}, 500)
            return

        if self.path == "/api/move_chapter":
            try:
                self._send_json({"ok": True, "result": move_chapter(payload)})
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

        if self.path == "/api/redownload_split":
            try:
                result = redownload_split(payload)
                self._send_json({"ok": True, "result": result})
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)}, 500)
            return

        self._send_json({"error": "not found"}, 404)


if __name__ == "__main__":
    stale = cleanup_orphan_staging()
    if stale:
        print("player_server: cleaned up {} orphan staging file(s) from a previous session".format(len(stale)))
    print("player_server: http://localhost:{}/player-all.html".format(PORT))
    ThreadingHTTPServer(("localhost", PORT), Handler).serve_forever()
