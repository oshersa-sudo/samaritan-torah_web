# -*- coding: utf-8 -*-
"""Build the unified verification/editing player: torah/web/player-all.html

Editing model (v3):
- A group = editing scope with one virtual timeline:
    * Meir: a portion (its per-chapter MP3s concatenated in order)
    * Witness: one masorot archive file
- Pieces on the timeline, each assigned to a Samaritan chapter number, each
  showing its OWN start+end boundary (editable independently; for Meir a
  piece's start === the previous piece's end, since the timeline is
  contiguous, so nudging either moves the same underlying boundary).
- Operations: nudge start/end, MERGE two pieces, SPLIT at the playhead,
  REASSIGN a piece to another chapter number, renumber sequentially.
- Two sync directions against player_server.py (http://localhost:8934):
    * "sync divisions from cloud" - GET /api/cloud_divisions, refreshes
      verses/incipit/portion DISPLAY only, cloud -> player, never touches
      an in-progress edit.
    * "sync this group to cloud" - POST /api/apply (cuts audio, updates
      readings.json/witnesses.json) then POST /api/push (git commit+push).
- Edits still autosave to localStorage as a fallback / offline safety net;
  export still available for the old manual workflow.

Run via player_server.py so the sync buttons have a same-origin backend to
talk to: `python player_server.py` then open http://localhost:8934/
"""
import json
import io
import os

TORAH = r"C:\Users\osher\Documents\torah"
WEB = os.path.join(TORAH, "web")

rd = json.load(io.open(os.path.join(WEB, "static", "audio", "readings", "readings.json"), encoding="utf-8"))
wt = json.load(io.open(os.path.join(WEB, "static", "audio", "witnesses.json"), encoding="utf-8"))

books = {}
for b in rd["books"]:
    chs = []
    for c in sorted(b["chapters"], key=lambda c: c["n"]):
        # a chapter mid-split across two source files (segs, no single "file")
        # has no clean single-timeline representation here yet - fall back to
        # its first segment so the build doesn't crash; not a real fix for
        # multi-file Meir chapters, just defensive.
        file_ = c.get("file") or (c.get("segs") or [{}])[0].get("file", "")
        chs.append({
            "n": c["n"],
            "file": file_,
            "duration": round(float(c.get("duration", 0)), 2),
            "verses": c.get("verses", ""),
            "verses_num": c.get("verses_num", ""),
            "incipit": c.get("incipit", ""),
            "po": c.get("portion", {}).get("order", 0),
            "pn": c.get("portion", {}).get("name", ""),
        })
    books[str(b["book_id"])] = chs

wit = {}
for it in wt["items"]:
    wit.setdefault(str(it["book_id"]), {}).setdefault(it["reader"], {})[str(it["sam_ch_number"])] = {
        "segs": it["segs"],
        "verses": it.get("verses", ""),
        "chapter": it.get("chapter"),
    }

readers = [{"name": r["name"], "years": r.get("years", "")} for r in wt["readers"]]

payload = json.dumps({"books": books, "wit": wit, "readers": readers}, ensure_ascii=False)

TEMPLATE = u"""<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>עורך חלוקת הפרקים — כל התורה, כל הקוראים</title>
<style>
* { box-sizing: border-box; }
body { font-family: Arial, sans-serif; margin: 0; padding: 14px; background: #f4f2ec; color: #222; }
h1 { font-size: 19px; margin: 0 0 10px; }
.bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; background: #fff;
       padding: 10px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; }
.bar label { font-size: 13px; font-weight: bold; }
select { padding: 6px 8px; font-size: 14px; border-radius: 6px; border: 1px solid #bbb; max-width: 330px; }
button { cursor: pointer; border: 1px solid #bbb; border-radius: 6px; background: #fff;
         padding: 6px 11px; font-size: 13px; }
button:hover { background: #eee; }
button:disabled { opacity: .35; cursor: default; }
.grn { background: #d9f2d9; border-color: #7bbf7b; }
.red { background: #fbe0e0; border-color: #d99; }
.org { background: #ffe9cc; border-color: #e0a050; }
.blu { background: #dceafc; border-color: #6fa8dc; }
#stat { font-size: 12px; color: #555; }
#status { font-size: 13px; color: #06529b; font-weight: bold; min-height: 18px; margin-bottom: 6px; white-space: pre-wrap; }
#serverStat { font-size: 11px; padding: 3px 8px; border-radius: 10px; }
#serverStat.up { background: #d9f2d9; color: #2a7a2a; }
#serverStat.down { background: #fbe0e0; color: #a33; }
#exportBox { width: 100%; height: 130px; font-family: monospace; font-size: 11px; direction: ltr; display: none; margin-bottom: 8px; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 5px; margin-bottom: 14px; }
.chb { position: relative; padding: 7px 2px; text-align: center; font-size: 14px; font-weight: bold;
       background: #fff; border: 1px solid #ccc; border-radius: 6px; }
.chb small { display: block; font-weight: normal; font-size: 9px; color: #888; }
.chb.off { opacity: .25; }
.chb.sel { background: #06529b; color: #fff; border-color: #06529b; }
.chb.sel small { color: #cfe3f5; }
.chb.edited::after { content: ""; position: absolute; top: 3px; left: 4px; width: 8px; height: 8px;
                     border-radius: 50%; background: #e07b00; }
.chb .syncdot { position: absolute; top: 3px; right: 4px; width: 8px; height: 8px; border-radius: 50%;
                background: #ccc; box-shadow: 0 0 0 1px rgba(0,0,0,.15) inset; }
.chb .syncdot.ok { background: #2ecc40; }
.chb .syncdot.bad { background: #e74c3c; }
#syncLegend { font-size: 11px; color: #666; display: flex; align-items: center; gap: 5px; }
#syncLegend .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

.editor { background: #fff; border: 2px solid #06529b; border-radius: 10px; padding: 14px; margin-bottom: 40px; }
.editor h2 { font-size: 16px; margin: 0 0 2px; }
.meta { font-size: 12px; color: #666; margin-bottom: 8px; }
.transport { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: #f2f6fb;
             border: 1px solid #cfe0f0; border-radius: 8px; padding: 8px; margin-bottom: 6px; position: sticky; top: 0; z-index: 5; }
.seekWrap { position: relative; flex: 1; min-width: 160px; display: flex; align-items: center; }
.transport input[type=range] { width: 100%; margin: 0; }
.seekMarks { position: absolute; left: 8px; right: 8px; top: 0; bottom: 0; pointer-events: none; }
.seekMarks .mark { position: absolute; top: 3px; bottom: 3px; width: 2px; background: #9ab; opacity: .65; }
.seekMarks .mark.cur { background: #e07b00; width: 3px; opacity: 1; }
.seekMarks .mark.zero { display: none; }
.tcur { font-family: monospace; font-size: 14px; font-weight: bold; color: #06529b; min-width: 118px; }
.curPiece { background: #fff8dc; border: 1px solid #e5c95b; border-radius: 8px; padding: 6px 10px;
            margin-bottom: 12px; font-size: 13px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.curPiece .cb { font-family: monospace; font-weight: bold; color: #7a5c00; }
.curPiece button { padding: 3px 9px; font-size: 12px; }

.piece { border: 1px solid #ddd; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; background: #fbfbfb; }
.piece.playing { border-color: #e5b800; background: #fffbe8; }
.piece .rowa { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 6px; }
.piece .num { width: 64px; padding: 5px; font-size: 15px; font-weight: bold; text-align: center;
              border: 1px solid #bbb; border-radius: 6px; }
.piece .inc { font-size: 12px; color: #555; flex: 1; min-width: 140px; }
.piece .prate { font-size: 12px; padding: 3px; border: 1px solid #bbb; border-radius: 6px; }
.piece .tm { font-family: monospace; font-size: 12px; color: #06529b; }
.edge { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 4px 4px 4px 14px;
        border-top: 1px dashed #eee; }
.edge .bt { font-family: monospace; font-size: 12px; font-weight: bold; color: #a05a00; min-width: 92px; }
.edge button { padding: 3px 7px; font-size: 11px; }
.gap { color: #b00; font-size: 11px; padding: 2px 14px; }
.note { font-size: 12px; color: #888; margin-top: 8px; }
.warn { color: #b00; font-weight: bold; }
</style>
</head>
<body>
<h1>🎧 עורך חלוקת הפרקים — כל התורה, כל הקוראים
  <span id="serverStat">בודק שרת…</span>
</h1>

<div class="bar">
  <label>ספר <select id="bookSel"></select></label>
  <label>קורא <select id="readerSel"></select></label>
  <label>מהירות
    <select id="speedSel">
      <option value="0.5">0.5×</option><option value="0.75">0.75×</option>
      <option value="1" selected>1×</option><option value="1.25">1.25×</option>
      <option value="1.5">1.5×</option><option value="1.75">1.75×</option>
      <option value="2">2×</option>
    </select>
  </label>
  <span id="stat"></span>
  <span id="syncLegend"><span class="dot" style="background:#2ecc40"></span>מסונכרן
    <span class="dot" style="background:#e74c3c"></span>לא מסונכרן
    <button onclick="fetchSyncStatus()" style="padding:2px 7px;font-size:11px">🔄 בדוק</button></span>
  <span style="flex:1"></span>
  <button class="org" id="addPortionBtn">➕ הוסף פרשה חדשה מקובץ/כתובת</button>
  <button class="blu" id="cloudDivBtn">🔄 סנכרן חלוקות מהענן</button>
  <button class="grn" id="exportBtn">📋 ייצוא תיקונים</button>
  <button class="red" id="clearBtn">🗑 נקה הכל</button>
</div>
<div id="status"></div>
<textarea id="exportBox" readonly></textarea>

<div class="grid" id="grid"></div>
<div class="editor" id="editor" style="display:none"></div>
<audio id="au"></audio>

<script>
var D = __DATA__;
var BOOK_NAMES = {1:"בראשית", 2:"שמות", 3:"ויקרא", 4:"במדבר", 5:"דברים"};
var MEIR = "מאיר בן יפנה ששוני";
var SERVER = "http://localhost:8934";

var book = 1, reader = 'meir';
var G = null;              /* current group */
var playPos = 0, playing = false;
var au = document.getElementById('au');

function $(id) { return document.getElementById(id); }
function setStatus(t) { $('status').textContent = t; }
function rel(f) { return encodeURI(f.replace(/^\\//, '')); }
function r2(x) { return Math.round(x * 100) / 100; }
function fmt(t) { var s = Math.abs(t); var m = Math.floor(s / 60); var ss = (s - m * 60).toFixed(2);
                  return (t < 0 ? '-' : '') + m + ':' + (ss < 10 ? '0' : '') + ss; }
function chapters() { return D.books[String(book)] || []; }
function chMeta(n) { var cs = chapters(); for (var i = 0; i < cs.length; i++) if (cs[i].n === n) return cs[i]; return null; }

/* ================= server presence ================= */
function pingServer() {
  fetch(SERVER + '/api/cloud_divisions?book_id=1', { method: 'GET' }).then(function (r) {
    var el = $('serverStat');
    if (r.ok) { el.textContent = '🟢 שרת מקומי מחובר'; el.className = 'up'; }
    else { el.textContent = '🔴 שרת מקומי לא זמין'; el.className = 'down'; }
  }).catch(function () {
    var el = $('serverStat'); el.textContent = '🔴 שרת מקומי לא זמין (הרץ player_server.py)'; el.className = 'down';
  });
}

/* ================= edits store ================= */
var edits = {};
try { var s = localStorage.getItem('torah-edits-v3'); if (s) edits = JSON.parse(s); } catch (e) {}
function saveEdits() { try { localStorage.setItem('torah-edits-v3', JSON.stringify(edits)); } catch (e) {} updateStat(); }
function editedCount() { return Object.keys(edits).length; }

/* ================= playback engine ================= */
var Q = { items: [], idx: 0, cur: null, rate: null };
function playQueue(items, rate) {
  if (!items.length) return;
  Q.items = items; Q.idx = 0; Q.rate = (rate != null) ? rate : null; playing = true; nextInQueue();
}
function stopAll() { Q.items = []; Q.cur = null; Q.rate = null; playing = false; au.pause(); }
function pauseAll() { if (playing) { au.pause(); playing = false; refreshTransport(); } }
function nextInQueue() {
  if (Q.idx >= Q.items.length) { Q.cur = null; playing = false; au.pause(); refreshTransport(); return; }
  var it = Q.items[Q.idx++]; Q.cur = it;
  au.playbackRate = (Q.rate != null) ? Q.rate : parseFloat($('speedSel').value);
  var abs = new URL(it.src, location.href).href;
  if (au.src === abs) { au.currentTime = it.from || 0; au.play(); }
  else { au.src = it.src; au.onloadedmetadata = function () { au.currentTime = it.from || 0; au.play(); }; }
}
au.ontimeupdate = function () {
  var it = Q.cur; if (!it) return;
  if (it.vFrom != null) { playPos = it.vFrom + (au.currentTime - it.from); refreshTransport(); }
  if (it.to != null && au.currentTime >= it.to - 0.02) nextInQueue();
};
au.onended = function () { nextInQueue(); };
au.onerror = function () { if (au.src) setStatus('שגיאת אודיו: ' + decodeURI(au.src.split('/').pop())); };
$('speedSel').onchange = function () {
  var v = parseFloat(this.value);
  if (Q.cur && Q.rate == null) au.playbackRate = v;
};

/* map virtual range [a,b] over timeline -> queue items carrying vFrom */
function mapRange(tl, a, b) {
  var q = [], pos = 0;
  for (var i = 0; i < tl.length; i++) {
    var len = tl[i].end - tl[i].start;
    var lo = Math.max(a - pos, 0), hi = (b == null ? len : Math.min(b - pos, len));
    if (hi > lo + 0.01) q.push({ src: tl[i].src, from: tl[i].start + lo, to: tl[i].start + hi, vFrom: pos + lo });
    pos += len;
  }
  return q;
}

/* ================= groups ================= */
function meirKey(po) { return 'm|b' + book + '|p' + po; }
function witKey(file) { return 'w|' + reader + '|b' + book + '|' + file; }

function buildMeirGroup(po) {
  var st = edits[meirKey(po)];
  if (st && st.redownloaded) {
    /* a not-yet-applied redownload takes priority over the committed manifest */
    var tl2 = st.origFiles.map(function (f) { return { src: rel(f.file), start: 0, end: f.duration }; });
    return { kind: 'meir', key: meirKey(po), po: po, title: (st.title || 'פרשה') + ' (הורדה מחדש)',
             tl: tl2, total: st.bounds[st.bounds.length - 1],
             bounds: st.bounds.slice(), chs: st.chs.slice(), origFiles: st.origFiles, redownloaded: true };
  }
  var cs = chapters().filter(function (c) { return c.po === po; });
  var tl = [], bounds = [0], chs = [], cum = 0, files = [];
  cs.forEach(function (c) {
    tl.push({ src: rel(c.file), start: 0, end: c.duration });
    files.push({ file: c.file, duration: c.duration });
    cum = r2(cum + c.duration); bounds.push(cum); chs.push(c.n);
  });
  var g = { kind: 'meir', key: meirKey(po), po: po, title: 'פרשת ' + (cs[0] ? cs[0].pn : ''),
            tl: tl, total: cum, bounds: bounds, chs: chs, origFiles: files };
  if (st) { g.bounds = st.bounds.slice(); g.chs = st.chs.slice(); }
  return g;
}
function meirPieces(g) {
  var out = [];
  for (var i = 0; i < g.chs.length; i++) out.push({ n: g.chs[i], v0: g.bounds[i], v1: g.bounds[i + 1] });
  return out;
}

function buildWitGroup(file) {
  var wb = (D.wit[String(book)] || {})[reader] || {};
  var pieces = [], maxT = 0;
  Object.keys(wb).forEach(function (n) {
    wb[n].segs.forEach(function (s0) {
      if (s0.file !== file) return;
      pieces.push({ n: parseInt(n), t0: s0.t0, t1: s0.t1, multi: wb[n].segs.length > 1 });
      if (s0.t1 > maxT) maxT = s0.t1;
    });
  });
  pieces.sort(function (a, b) { return a.t0 - b.t0; });
  var g = { kind: 'wit', key: witKey(file), file: file, title: file.split('/').pop(),
            tl: [{ src: rel(file), start: 0, end: maxT + 60 }], total: maxT + 60, pieces: pieces };
  var st = edits[g.key];
  if (st) g.pieces = JSON.parse(JSON.stringify(st.pieces));
  return g;
}

function markEdited() {
  if (!G) return;
  if (G.kind === 'meir') {
    edits[G.key] = { bounds: G.bounds, chs: G.chs };
    if (G.redownloaded) { edits[G.key].redownloaded = true; edits[G.key].origFiles = G.origFiles; edits[G.key].title = G.title.replace(/ \(הורדה מחדש\)$/, ''); }
  }
  else edits[G.key] = { pieces: G.pieces };
  saveEdits();
}
function resetGroup() {
  if (!G) return;
  if (!confirm('לאפס את כל התיקונים של ' + G.title + '?')) return;
  delete edits[G.key]; saveEdits();
  openGroupByKey();
}
function openGroupByKey() {
  if (G.kind === 'meir') G = buildMeirGroup(G.po); else G = buildWitGroup(G.file);
  renderEditor(); renderGrid();
}

/* ================= undo (one step) ================= */
var undo1 = null;
function snapshot() {
  undo1 = { key: G.key, data: JSON.stringify(G.kind === 'meir'
            ? { bounds: G.bounds, chs: G.chs } : { pieces: G.pieces }) };
}
function undoLast() {
  if (!undo1 || !G || undo1.key !== G.key) return;
  var d = JSON.parse(undo1.data);
  if (G.kind === 'meir') { G.bounds = d.bounds; G.chs = d.chs; }
  else { G.pieces = d.pieces; }
  undo1 = null; markEdited(); renderEditor(); renderGrid();
  setStatus('הפעולה האחרונה בוטלה');
}

/* ================= group ops ================= */
function nudgeBound(i, d) {          /* meir: boundary i (0..len); 0 and last are fixed */
  if (i <= 0 || i >= G.bounds.length - 1) return;
  snapshot();
  var lo = G.bounds[i - 1] + 0.3, hi = G.bounds[i + 1] - 0.3;
  G.bounds[i] = r2(Math.min(hi, Math.max(lo, G.bounds[i] + d)));
  markEdited(); renderEditor();
}
function mergeIntoPrev(i) {          /* piece i is swallowed by piece i-1 */
  if (i <= 0) return;
  mergePieces(i - 1);
}
function mergePieces(i) {            /* merge piece i with i+1; keeps number of piece i */
  snapshot();
  var gone;
  if (G.kind === 'meir') {
    if (i + 1 >= G.chs.length) return;
    gone = G.chs[i + 1];
    G.bounds.splice(i + 1, 1); G.chs.splice(i + 1, 1);
  } else {
    if (i + 1 >= G.pieces.length) return;
    gone = G.pieces[i + 1].n;
    G.pieces[i].t1 = G.pieces[i + 1].t1; G.pieces.splice(i + 1, 1);
  }
  markEdited(); renderEditor(); renderGrid();
  var kept = G.kind === 'meir' ? G.chs[i] : G.pieces[i].n;
  setStatus('פרק ' + gone + ' צורף לפרק ' + kept + ' (↶ לביטול, 🔢 למספור מחדש של ההמשך)');
}
function renumberSeq() {             /* renumber all pieces sequentially from the first */
  if (!G) return;
  var start = G.kind === 'meir' ? G.chs[0] : G.pieces[0].n;
  if (!confirm('למספר את כל הקטעים ברצף החל מ-' + start + '?')) return;
  snapshot();
  if (G.kind === 'meir') for (var i = 0; i < G.chs.length; i++) G.chs[i] = start + i;
  else for (var j = 0; j < G.pieces.length; j++) G.pieces[j].n = start + j;
  markEdited(); renderEditor(); renderGrid();
  setStatus('מוספר מחדש ברצף מ-' + start);
}
function splitAtPlayhead() {
  var p = r2(playPos);
  if (G.kind === 'meir') {
    for (var i = 0; i < G.chs.length; i++) {
      if (p > G.bounds[i] + 0.3 && p < G.bounds[i + 1] - 0.3) {
        snapshot();
        G.bounds.splice(i + 1, 0, p); G.chs.splice(i + 1, 0, G.chs[i]);
        markEdited(); renderEditor(); renderGrid();
        setStatus('פוצל בנקודה ' + fmt(p) + ' — קבע מספר פרק לקטע החדש');
        return;
      }
    }
  } else {
    for (var j = 0; j < G.pieces.length; j++) {
      var s = G.pieces[j];
      if (p > s.t0 + 0.3 && p < s.t1 - 0.3) {
        snapshot();
        var nw = { n: s.n, t0: p, t1: s.t1 };
        s.t1 = p; G.pieces.splice(j + 1, 0, nw);
        markEdited(); renderEditor(); renderGrid();
        setStatus('פוצל בנקודה ' + fmt(p) + ' — קבע מספר פרק לקטע החדש');
        return;
      }
    }
  }
  setStatus('נקודת הנגן אינה בתוך קטע (או קרובה מדי לגבול)');
}
function nudgeSeg(i, f, d) {         /* wit piece i, field t0/t1 */
  snapshot();
  var s = G.pieces[i];
  s[f] = r2(Math.max(0, s[f] + d));
  if (s.t1 <= s.t0 + 0.3) { if (f === 't0') s.t0 = r2(s.t1 - 0.3); else s.t1 = r2(s.t0 + 0.3); }
  markEdited(); renderEditor();
}
function setNum(i, v) {
  snapshot();
  v = parseInt(v) || 0;
  if (G.kind === 'meir') G.chs[i] = v; else G.pieces[i].n = v;
  markEdited(); renderEditor(); renderGrid();
}

/* ================= play helpers ================= */
function playFrom(v) { playQueue(mapRange(G.tl, v, null)); }
function playRange(a, b, rate) { playQueue(mapRange(G.tl, Math.max(0, a), b), rate); }
function pieceRate(i) {
  var sel = document.getElementById('prate-' + i);
  if (!sel || sel.value === '') return null;
  var v = parseFloat(sel.value);
  return isNaN(v) ? null : v;
}
function playPieceMeir(i) { playRange(G.bounds[i], G.bounds[i + 1], pieceRate(i)); setStatus('▶ פרק ' + G.chs[i]); }
function playPieceWit(i) { var s = G.pieces[i]; playRange(s.t0, s.t1, pieceRate(i)); setStatus('▶ פרק ' + s.n); }
function togglePlay() {
  if (playing) { au.pause(); playing = false; }
  else if (Q.cur) { au.play(); playing = true; }
  else playFrom(playPos);
  refreshTransport();
}
/* which piece row (index) the playhead currently sits inside, or -1 */
function currentPieceIndex() {
  if (!G) return -1;
  if (G.kind === 'meir') {
    for (var i = 0; i < G.chs.length; i++) if (playPos >= G.bounds[i] - 0.001 && playPos < G.bounds[i + 1]) return i;
  } else {
    for (var j = 0; j < G.pieces.length; j++) if (playPos >= G.pieces[j].t0 - 0.001 && playPos < G.pieces[j].t1) return j;
  }
  return -1;
}
/* per-row play button: starts this piece, or pauses/resumes it if it's already the current one */
function togglePiece(i, isMeir) {
  var cur = currentPieceIndex();
  if (cur === i && Q.cur) {
    if (playing) { au.pause(); playing = false; refreshTransport(); }
    else { au.play(); playing = true; refreshTransport(); }
  } else if (isMeir) playPieceMeir(i);
  else playPieceWit(i);
}
function jumpTo(v) {
  playPos = Math.max(0, Math.min(G.total, v));
  if (playing) playFrom(playPos); else refreshTransport();
}
/* per-row speed <select> changed while its piece is the one currently playing */
function pieceRateChange(i) {
  if (currentPieceIndex() === i) {
    var v = pieceRate(i);
    au.playbackRate = (v != null) ? v : parseFloat($('speedSel').value);
    Q.rate = v;
  }
}

/* ================= UI: selectors / grid ================= */
function initSelectors() {
  for (var b = 1; b <= 5; b++) {
    var o = document.createElement('option');
    o.value = b; o.textContent = BOOK_NAMES[b]; $('bookSel').appendChild(o);
  }
  $('bookSel').onchange = function () { book = parseInt(this.value); G = null; stopAll(); renderAll(); fetchSyncStatus(); };
  var o0 = document.createElement('option');
  o0.value = 'meir'; o0.textContent = MEIR + ' — הקורא הראשי';
  $('readerSel').appendChild(o0);
  D.readers.forEach(function (r) {
    var o = document.createElement('option');
    o.value = r.name; o.textContent = r.name + (r.years ? ' (' + r.years + ')' : '');
    $('readerSel').appendChild(o);
  });
  $('readerSel').onchange = function () { reader = this.value; G = null; stopAll(); renderAll(); fetchSyncStatus(); };
}

/* ================= sync-status lights (local vs live, per chapter) ================= */
var syncStatus = {};        /* n -> true(green)/false(red); absent = unknown (grey) */
var syncFetchSeq = 0;
function fetchSyncStatus() {
  var seq = ++syncFetchSeq;
  var el = $('syncLegend'); if (el) el.textContent = 'בודק סנכרון מול הענן…';
  fetch(SERVER + '/api/sync_status?book_id=' + book + '&reader=' + encodeURIComponent(reader))
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (seq !== syncFetchSeq) return;   /* a newer request superseded this one */
      if (res.error) throw new Error(res.error);
      syncStatus = res.synced || {};
      renderGrid();
      var vals = Object.keys(syncStatus).map(function (k) { return syncStatus[k]; });
      var ok = vals.filter(Boolean).length;
      if (el) el.textContent = 'סנכרון: ' + ok + '/' + vals.length + ' פרקים תואמים לענן';
    })
    .catch(function (e) {
      if (seq !== syncFetchSeq) return;
      syncStatus = {}; renderGrid();
      if (el) el.textContent = 'לא ניתן לבדוק סנכרון (' + e.message + ')';
    });
}
function witChapterFile(n) {
  var wb = (D.wit[String(book)] || {})[reader];
  if (!wb || !wb[String(n)]) return null;
  return wb[String(n)].segs[0].file;
}
function groupHasEdits(n) {
  if (reader === 'meir') { var c = chMeta(n); return c && !!edits[meirKey(c.po)]; }
  var f = witChapterFile(n); return f && !!edits[witKey(f)];
}
function updateStat() {
  var cs = chapters(), avail = 0;
  cs.forEach(function (c) { if (reader === 'meir' || witChapterFile(c.n)) avail++; });
  $('stat').textContent = avail + '/' + cs.length + ' פרקים · ' + editedCount() + ' קבוצות עם תיקונים';
}
function renderGrid() {
  var g = $('grid'); g.innerHTML = '';
  var curSet = {};
  if (G) {
    if (G.kind === 'meir') G.chs.forEach(function (n) { curSet[n] = 1; });
    else G.pieces.forEach(function (p) { curSet[p.n] = 1; });
  }
  chapters().forEach(function (c) {
    var has = reader === 'meir' ? true : !!witChapterFile(c.n);
    var b = document.createElement('button');
    b.className = 'chb' + (has ? '' : ' off') + (curSet[c.n] ? ' sel' : '') + (has && groupHasEdits(c.n) ? ' edited' : '');
    var dotClass = has && syncStatus.hasOwnProperty(c.n) ? (syncStatus[c.n] ? ' ok' : ' bad') : '';
    b.innerHTML = (has ? '<span class="syncdot' + dotClass + '" title="' +
                    (dotClass === ' ok' ? 'מסונכרן עם הענן' : dotClass === ' bad' ? 'לא מסונכרן עם הענן' : 'סטטוס סנכרון לא ידוע') +
                    '"></span>' : '') +
                  c.n + '<small>' + (c.verses || '') + '</small>';
    b.disabled = !has;
    b.onclick = function () { openChapter(c.n); };
    g.appendChild(b);
  });
  updateStat();
}
function openChapter(n) {
  stopAll();
  if (reader === 'meir') { var c = chMeta(n); G = buildMeirGroup(c.po); playPos = G.bounds[G.chs.indexOf(n)]; }
  else { G = buildWitGroup(witChapterFile(n)); playPos = 0;
         G.pieces.forEach(function (p) { if (p.n === n) playPos = p.t0; }); }
  renderGrid(); renderEditor();
  $('editor').scrollIntoView({ behavior: 'smooth' });
}

/* ================= cloud sync: divisions (cloud -> player, display only) ================= */
function syncDivisionsFromCloud() {
  setStatus('מושך חלוקות מהענן…');
  fetch(SERVER + '/api/cloud_divisions?book_id=' + book).then(function (r) {
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }).then(function (data) {
    if (data.error) throw new Error(data.error);
    var cs = chapters(), n_updated = 0;
    cs.forEach(function (c) {
      var info = data.chapters[c.n];
      if (!info) return;
      if (c.pn !== info.portion_name || c.po !== info.portion_id) n_updated++;
      c.po = info.portion_id; c.pn = info.portion_name;
      if (info.opening) c.incipit = info.opening;
    });
    setStatus('סונכרן מהענן: ' + n_updated + ' פרקים עודכנו (שיוך פרשה/פתיח בלבד — לא נגעתי בעריכות שלך). רענן תצוגה בלחיצה על פרק.');
    renderGrid(); if (G) renderEditor();
  }).catch(function (e) {
    setStatus('שגיאה בסנכרון מהענן: ' + e.message + ' (ודא שהרצת player_server.py)');
  });
}
$('cloudDivBtn').onclick = syncDivisionsFromCloud;

/* ================= redownload + auto-split (player -> cloud algorithm, staged for review) ================= */
function padPo(po) { return (po < 10 ? '0' : '') + po; }
function loadRedownloadedGroup(res, po) {
  var tl = [], bounds = [0], chs = [], cum = 0, origFiles = [];
  res.files.forEach(function (f) {
    tl.push({ src: rel(f.file), start: 0, end: f.duration });
    origFiles.push({ file: f.file, duration: f.duration });
    cum = r2(cum + f.duration); bounds.push(cum); chs.push(f.n);
  });
  G = { kind: 'meir', key: meirKey(po), po: po, title: (res.portion_name || 'פרשה') + ' (הורדה מחדש)',
        tl: tl, total: cum, bounds: bounds, chs: chs, origFiles: origFiles, redownloaded: true };
  playPos = 0; stopAll();
  markEdited();
  renderGrid(); renderEditor();
}
function redownloadAndSplit() {
  if (!G || G.kind !== 'meir') { setStatus('הורדה מחדש זמינה רק לקבוצת מאיר (פרשה שלמה), לא לעד קריאה.'); return; }
  var source = prompt('כתובת YouTube או נתיב לקובץ מקומי:\\nיוריד/יקרא את ההקלטה המלאה ויחלק אותה מחדש לפי האלגוריתם המקורי (הפסקות + ירידת מנגינה + עוגן אורך-טקסט) עבור כל פרקי הפרשה הנוכחית.');
  if (!source) return;
  if (!confirm('לחלק מחדש את "' + G.title + '" מהמקור: ' + source + ' ?\\nזה עשוי לקחת דקה-שתיים. שום דבר לא ייכתב למניפסט עד שתלחץ "☁️ החל שינויים".')) return;
  var po = G.po;
  setStatus('מוריד ומנתח… זה יכול לקחת דקה-שתיים (הורדה + זיהוי הפסקות/מנגינה).');
  fetch(SERVER + '/api/redownload_split', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ source: source, book_id: book, portion_order: po }) })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok) throw new Error(res.error || 'redownload failed');
      var r = res.result;
      loadRedownloadedGroup(r, po);
      setStatus('✓ חולק מחדש: ' + r.n_chapters + ' פרקים' +
                (r.weak_boundaries ? ' · ' + r.weak_boundaries + ' גבולות ללא ירידת מנגינה ברורה (כדאי להאזין ולכוון)' : '') +
                '\\nבדוק/כוון למטה, ואז "☁️ החל שינויים" כדי לכתוב את הקבצים בפועל.');
    })
    .catch(function (e) { setStatus('שגיאה בהורדה/חלוקה: ' + e.message); });
}

function addNewPortion() {
  var po = prompt('מספר סדר הפרשה (portion order) ב' + BOOK_NAMES[book] + ' שברצונך ליצור/להשלים:\\nלמשל 3 - עבור הפרשה השלישית. משמש גם לפרשות שאין להן עדיין אף פרק בנגן.');
  if (!po) return;
  po = parseInt(po);
  if (!po || po < 1) { setStatus('מספר פרשה לא תקין.'); return; }
  var source = prompt('כתובת YouTube (וידאו בודד - לא פלייליסט כולו) או נתיב לקובץ מקומי, עבור פרשה ' + po + ':');
  if (!source) return;
  if (!confirm('ליצור/להשלים את פרשה ' + po + ' ב' + BOOK_NAMES[book] + ' מהמקור: ' + source + ' ?\\nרשימת פרקי הפרשה תישלף מהענן החי; ההקלטה תוריד ותתחלק לפי האלגוריתם המקורי. שום דבר לא ייכתב עד "☁️ החל שינויים".')) return;
  stopAll(); G = null; renderEditor();
  setStatus('מוריד ומנתח פרשה ' + po + '… זה יכול לקחת דקה-שתיים.');
  fetch(SERVER + '/api/redownload_split', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ source: source, book_id: book, portion_order: po }) })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok) throw new Error(res.error || 'redownload failed');
      var r = res.result;
      loadRedownloadedGroup(r, po);
      setStatus('✓ פרשה ' + po + ' (' + (r.portion_name || '') + '): ' + r.n_chapters + ' פרקים' +
                (r.weak_boundaries ? ' · ' + r.weak_boundaries + ' גבולות ללא ירידת מנגינה ברורה (כדאי להאזין ולכוון)' : '') +
                '\\nבדוק/כוון למטה, ואז "☁️ החל שינויים".');
    })
    .catch(function (e) { setStatus('שגיאה בהורדה/חלוקה: ' + e.message); });
}
$('addPortionBtn').onclick = addNewPortion;

/* ================= cloud sync: push this group (player -> cloud, live) ================= */
function syncGroupToCloud() {
  if (!G) return;
  var payload;
  if (G.kind === 'meir') {
    var pieces = [];
    for (var i = 0; i < G.chs.length; i++) pieces.push({ n: G.chs[i], v0: G.bounds[i], v1: G.bounds[i + 1] });
    payload = { kind: 'meir', book_id: book, portion_order: G.po, prefix: 'b' + book + '-p' + padPo(G.po), files: G.origFiles, pieces: pieces };
  } else {
    payload = { kind: 'wit', reader: reader, book_id: book, file: G.file, pieces: G.pieces };
  }
  if (!confirm('לחתוך אודיו ולעדכן את הקבצים המקומיים עבור ' + G.title + '? (עדיין לא ידחוף לענן — זה שלב נפרד)')) return;
  setStatus('חותך אודיו ומעדכן מניפסט מקומי…');
  fetch(SERVER + '/api/apply', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok) throw new Error(res.error || 'apply failed');
      var w = (res.result.warnings || []).length ? '\\n⚠ ' + res.result.warnings.join('; ') : '';
      delete edits[G.key]; saveEdits();
      setStatus('✓ הוחל מקומית: פרקים ' + JSON.stringify(res.result.new_chapters) + w +
                 '\\nטוען מחדש את הנתונים העדכניים… (כדי שקבוצות נוספות יראו את הקבצים החדשים)');
      setTimeout(function () { location.reload(); }, 1800);
    })
    .catch(function (e) { setStatus('שגיאה בהחלה: ' + e.message); });
}
function pushToCloud() {
  if (!confirm('לדחוף את כל השינויים המקומיים לענן (git commit + push, יעדכן את האתר החי)?')) return;
  setStatus('דוחף לענן…');
  fetch(SERVER + '/api/push', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: 'Player: sync boundary edits (' + (G ? G.title : '') + ')' }) })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok) throw new Error(res.error || 'push failed');
      if (!res.result.pushed) { setStatus('אין שינויים לדחוף.'); return; }
      setStatus('✓ נדחף לענן בהצלחה. הפריסה (Render) לוקחת כמה דקות — הנורות יתעדכנו אוטומטית.');
      setTimeout(fetchSyncStatus, 120000);   /* deploy usually lands within ~2 min */
    })
    .catch(function (e) { setStatus('שגיאה בדחיפה: ' + e.message); });
}

/* ================= UI: editor ================= */
function nudges(fn) {
  return [-1, -0.5, -0.1, 0.1, 0.5, 1].map(function (d) {
    return '<button onclick="' + fn.replace('%D', d) + '">' + (d > 0 ? '+' + d : d) + '</button>';
  }).join('');
}
function incipitOf(n) {
  var c = chMeta(n);
  return c ? ('«' + (c.incipit || '') + '» · פס\\u05f3 ' + c.verses) : '<span class="warn">אין פרק כזה בספר!</span>';
}
function boundaryList() {
  /* all piece edges as virtual-time positions, deduped */
  if (!G) return [];
  var pts;
  if (G.kind === 'meir') pts = G.bounds.slice();
  else { pts = []; G.pieces.forEach(function (p) { pts.push(p.t0, p.t1); }); }
  var seen = {}, out = [];
  pts.forEach(function (v) { var k = v.toFixed(2); if (!seen[k]) { seen[k] = 1; out.push(v); } });
  return out;
}
function renderSeekMarks() {
  var mk = $('seekMarks'); if (!mk || !G) return;
  var pts = boundaryList();
  var html = '';
  pts.forEach(function (v) {
    if (v <= 0.01 || v >= G.total - 0.01) return;   /* edges of the whole timeline: skip */
    var pct = (v / G.total) * 100;
    html += '<div class="mark" data-v="' + v + '" style="left:' + pct + '%"></div>';
  });
  mk.innerHTML = html;
}
function refreshTransport() {
  var el = $('tcur'); if (el) el.textContent = fmt(playPos) + ' / ' + fmt(G ? G.total : 0);
  var sb = $('seek'); if (sb && !sb.dragging) sb.value = playPos;
  var pb = $('playBtn'); if (pb) pb.textContent = playing ? '⏸ השהה' : '▶ נגן';
  if (!G) return;
  var rows = document.querySelectorAll('.piece');
  var idx = -1, curStart = null, curEnd = null, curN = null;
  if (G.kind === 'meir') {
    for (var i = 0; i < G.chs.length; i++) if (playPos >= G.bounds[i] - 0.001 && playPos < G.bounds[i + 1]) { idx = i; curStart = G.bounds[i]; curEnd = G.bounds[i + 1]; curN = G.chs[i]; }
  } else {
    for (var j = 0; j < G.pieces.length; j++) if (playPos >= G.pieces[j].t0 - 0.001 && playPos < G.pieces[j].t1) { idx = j; curStart = G.pieces[j].t0; curEnd = G.pieces[j].t1; curN = G.pieces[j].n; }
  }
  rows.forEach(function (r, k) {
    r.classList.toggle('playing', k === idx);
    var btn = document.getElementById('pbtn-' + k);
    if (btn) btn.textContent = (k === idx && playing) ? '⏸' : '▶';
  });
  var marks = document.querySelectorAll('#seekMarks .mark');
  marks.forEach(function (m) {
    var v = parseFloat(m.getAttribute('data-v'));
    var isCur = (curStart != null && Math.abs(v - curStart) < 0.05) || (curEnd != null && Math.abs(v - curEnd) < 0.05);
    m.classList.toggle('cur', isCur);
  });
  var cp = $('curPieceBounds');
  if (cp) {
    if (idx >= 0) {
      cp.innerHTML = 'קטע נוכחי: <b>פרק ' + curN + '</b> &nbsp; ' +
        'התחלה <span class="cb">' + fmt(curStart) + '</span> &nbsp; ' +
        'סוף <span class="cb">' + fmt(curEnd) + '</span> &nbsp; ' +
        'נותרו <span class="cb">' + fmt(curEnd - playPos) + '</span>' +
        '<button onclick="jumpTo(' + curStart + ')">⏮ לתחילת הקטע</button>' +
        '<button onclick="jumpTo(' + (curEnd - 3) + ')">⏭ 3 שנ\\u05f3 לפני הסוף</button>' +
        '<button onclick="jumpTo(' + (curEnd - 0.5) + ')">⏭ ממש לפני הסוף</button>';
    } else {
      cp.innerHTML = 'קטע נוכחי: <span class="warn">מחוץ לכל קטע (באזור לא משויך)</span>';
    }
  }
}
function renderEditor() {
  var ed = $('editor');
  if (!G) { ed.style.display = 'none'; return; }
  ed.style.display = 'block';
  var h = '<h2>' + (G.kind === 'meir' ? G.title + ' — ' + MEIR : G.title + ' — ' + reader) + '</h2>';
  h += '<div class="meta">' + BOOK_NAMES[book] +
       (G.kind === 'wit' ? ' · קובץ ארכיון אחד; העריכה משנה טווחי זמן בלבד' : ' · הפרשה כרצף אחד של קובצי הפרקים') + '</div>';

  h += '<div class="transport">' +
       '<button id="playBtn" class="grn" onclick="togglePlay()">▶ נגן</button>' +
       '<button onclick="stopAll();refreshTransport()">⏹ עצור</button>' +
       '<div class="seekWrap"><input type="range" id="seek" min="0" max="' + G.total + '" step="0.05" value="' + playPos + '">' +
       '<div class="seekMarks" id="seekMarks"></div></div>' +
       '<span class="tcur" id="tcur"></span>' +
       '<button class="org" onclick="splitAtPlayhead()">✂ פצל כאן</button>' +
       '<button onclick="undoLast()">↶ בטל פעולה</button>' +
       '<button onclick="renumberSeq()">🔢 מספר מחדש ברצף</button>' +
       '<button class="red" onclick="resetGroup()">↺ אפס קבוצה</button>' +
       '</div>';
  h += '<div class="curPiece" id="curPieceBounds"></div>';
  h += '<div class="bar" style="margin-bottom:12px">' +
       (G.kind === 'meir' ? '<button class="org" onclick="redownloadAndSplit()">📥 הורדה מחדש וחלוקה אוטומטית</button>' : '') +
       '<button class="blu" onclick="syncGroupToCloud()">☁️ החל שינויים (חיתוך + מניפסט מקומי)</button>' +
       '<button class="grn" id="pushBtn" onclick="pushToCloud()">🚀 דחוף הכל לענן (git push)</button>' +
       '</div>';
  if (G.redownloaded) h += '<div class="gap">⚠ קבוצה זו הגיעה מהורדה מחדש וטרם הוחלה — הקבצים זמניים, לא חלק מהמניפסט עדיין.</div>';

  if (G.kind === 'meir') {
    var ps = meirPieces(G);
    for (var i = 0; i < ps.length; i++) {
      h += pieceRow(i, ps[i].n, ps[i].v0, ps[i].v1, true, i > 0, i < ps.length - 1);
    }
  } else {
    for (var j = 0; j < G.pieces.length; j++) {
      var s = G.pieces[j];
      if (j > 0) {
        var gap = r2(s.t0 - G.pieces[j - 1].t1);
        if (Math.abs(gap) > 0.05) h += '<div class="gap">— רווח של ' + fmt(gap) + ' שאינו משויך —</div>';
      }
      h += pieceRow(j, s.n, s.t0, s.t1, false, true, true);
      if (s.multi) h += '<div class="gap">פרק זה ממשיך גם בקובץ ארכיון נוסף</div>';
    }
  }
  h += '<div class="note">כל קטע מציג את גבול ההתחלה והסוף שלו — כוונו ישירות משם (בפרשת מאיר הגבולות רציפים: הזזת "סוף" של פרק מזיזה גם את "התחלה" של הפרק הבא). ' +
       '⤵ <b>איחוד</b>: מצרף את הפרק לפרק שמעליו (הוא נעלם, האודיו עובר לקודם). ' +
       '✂ <b>פיצול</b>: נגן/גרור לנקודת החיתוך ולחץ "פצל כאן" בסרגל למעלה. <b>שיוך</b>: שנה מספר פרק בתיבה. ' +
       '🔢 "מספר מחדש ברצף" מתקן רצף אחרי איחוד/פיצול. ↶ מבטל פעולה אחרונה. ' +
       '☁️ "החל שינויים" חותך את האודיו בפועל ומעדכן את הקבצים המקומיים; 🚀 "דחוף לענן" שולח הכל (כל הקבוצות שהוחלו) ל-git ולאתר החי.</div>';
  ed.innerHTML = h;

  var sb = $('seek');
  sb.oninput = function () { sb.dragging = true; playPos = parseFloat(sb.value); refreshTransport(); };
  sb.onchange = function () { sb.dragging = false; playPos = parseFloat(sb.value); if (playing) playFrom(playPos); refreshTransport(); };
  renderSeekMarks();
  refreshTransport();
}
function pieceRow(i, n, a, b, isMeir, canEditStart, canEditEnd) {
  var startFn = isMeir ? ('nudgeBound(' + i + ',%D)') : ('nudgeSeg(' + i + ',\\'t0\\',%D)');
  var endFn   = isMeir ? ('nudgeBound(' + (i + 1) + ',%D)') : ('nudgeSeg(' + i + ',\\'t1\\',%D)');
  var listenStart = isMeir ? ('playRange(' + a + '-3,' + a + '+3)') : ('playRange(G.pieces[' + i + '].t0,G.pieces[' + i + '].t0+3.2)');
  var listenEnd   = isMeir ? ('playRange(' + b + '-3,' + b + '+3)') : ('playRange(G.pieces[' + i + '].t1-3.2,G.pieces[' + i + '].t1)');
  var h = '<div class="piece"><div class="rowa">' +
    '<button class="grn" id="pbtn-' + i + '" onclick="togglePiece(' + i + ',' + isMeir + ')" title="נגן/השהה קטע זה">▶</button>' +
    '<button onclick="stopAll();refreshTransport()" title="עצור">⏹</button>' +
    '<select id="prate-' + i + '" class="prate" title="מהירות ניגון לקטע זה" onchange="pieceRateChange(' + i + ')">' +
      '<option value="">מהירות ברירת מחדל</option>' +
      '<option value="0.5">0.5×</option><option value="0.75">0.75×</option>' +
      '<option value="1">1×</option><option value="1.25">1.25×</option>' +
      '<option value="1.5">1.5×</option><option value="1.75">1.75×</option>' +
      '<option value="2">2×</option>' +
    '</select>' +
    '<input class="num" type="number" value="' + n + '" onchange="setNum(' + i + ',this.value)" title="מספר פרק שומרוני">' +
    '<span class="inc">' + incipitOf(n) + '</span>' +
    '<span class="tm">' + fmt(a) + ' → ' + fmt(b) + ' (' + fmt(b - a) + ')</span>' +
    (i > 0 ? '<button class="org" onclick="mergeIntoPrev(' + i + ')" title="פרק זה ייעלם ויתאחד עם הפרק שמעליו">⤵ צרף לפרק הקודם</button>' : '') +
    '</div>';
  h += '<div class="edge"><span class="bt">התחלה ' + fmt(a) + '</span>' +
       (canEditStart ? nudges(startFn) : '<i style="font-size:11px;color:#999">(תחילת הקובץ, קבוע)</i>') +
       '<button onclick="' + listenStart + '">🔊 השמע התחלה</button></div>';
  h += '<div class="edge"><span class="bt">סוף ' + fmt(b) + '</span>' +
       (canEditEnd ? nudges(endFn) : '<i style="font-size:11px;color:#999">(סוף הקובץ, קבוע)</i>') +
       '<button onclick="' + listenEnd + '">🔊 השמע סוף</button></div>';
  h += '</div>';
  return h;
}

/* ================= export / clear ================= */
$('exportBtn').onclick = function () {
  var out = { kind: 'boundary-fixes-v2', meir: [], witnesses: [] };
  Object.keys(edits).forEach(function (k) {
    var st = edits[k];
    if (k.charAt(0) === 'm') {
      var m = /^m\\|b(\\d+)\\|p(\\d+)$/.exec(k); if (!m) return;
      var bk = m[1], po = parseInt(m[2]);
      var files = (D.books[bk] || []).filter(function (c) { return c.po === po; })
                    .map(function (c) { return { file: c.file, duration: c.duration }; });
      var pieces = [];
      for (var i = 0; i < st.chs.length; i++) pieces.push({ n: st.chs[i], v0: st.bounds[i], v1: st.bounds[i + 1] });
      out.meir.push({ book_id: parseInt(bk), portion_order: po, files: files, pieces: pieces });
    } else {
      var m2 = /^w\\|(.+)\\|b(\\d+)\\|(.+)$/.exec(k); if (!m2) return;
      out.witnesses.push({ reader: m2[1], book_id: parseInt(m2[2]), file: m2[3], pieces: st.pieces });
    }
  });
  var txt = JSON.stringify(out, null, 1);
  var box = $('exportBox');
  box.style.display = 'block'; box.value = txt; box.select();
  try { document.execCommand('copy'); setStatus('הועתק ללוח וגם ירד כקובץ boundary_fixes.json'); } catch (e) {}
  var a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(txt);
  a.download = 'boundary_fixes.json'; a.click();
};
$('clearBtn').onclick = function () {
  if (!confirm('למחוק את כל התיקונים השמורים (' + editedCount() + ' קבוצות)?')) return;
  edits = {}; saveEdits(); G = null; renderAll();
};

/* ================= boot ================= */
function renderAll() { renderGrid(); renderEditor(); }
initSelectors();
renderAll();
pingServer();
fetchSyncStatus();
setInterval(pingServer, 15000);
</script>
</body>
</html>
"""

html = TEMPLATE.replace(u"__DATA__", payload)
out_path = os.path.join(WEB, "player-all.html")
f = io.open(out_path, "w", encoding="utf-8")
f.write(html)
f.close()
print("Created: " + out_path)
print("Size: {} KB".format(os.path.getsize(out_path) // 1024))
