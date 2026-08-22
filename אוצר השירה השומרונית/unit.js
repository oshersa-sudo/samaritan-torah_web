/* אוצר השירה השומרונית — index of performers, piyyutim, festivals and events.
 *
 * Four indexes over one catalog. Every view is a filter over `C.recordings`,
 * so a search term, a performer, an event and a piyyut all compose: pick a
 * performer, then an event, and the piyyut list narrows to their intersection.
 */
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let C = null;                                   // the catalog
const F = { q: '', perf: 0, event: 0, piyyut: 0 };
let tab = 'piyyut';

/* ---------------------------------------------------------------- format */
function dur(sec) {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
           : `${m}:${String(s).padStart(2, '0')}`;
}
function hours(sec) {
  const h = sec / 3600;
  return h >= 1 ? `${h.toFixed(1)} שעות` : `${Math.round(sec / 60)} דקות`;
}

/* Fold Samaritan spelling variants so a search for "בריך" also finds "בריכ". */
function fold(s) {
  return (s || '').toLowerCase()
    .replace(/[ךםןףץ]/g, c => ({ 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }[c]))
    .replace(/["'`׳״]/g, '')
    .replace(/\s+/g, ' ').trim();
}
function loose(s) { return fold(s).replace(/[אהוי]/g, ''); }

/* ---- matching what was typed against what there is.
 *
 * Whoever is looking for a recording types the scraps they remember: a word
 * of the piyyut and the singer's family name, a fragment of each, in whatever
 * order they come to mind. Those scraps are almost never next to each other,
 * in that order, anywhere — so matching the query as one run of characters
 * finds nothing, and did not: "שער אל" for a recording called "אל שער השמים
 * נפן" returned nothing at all, and so did the title's own word beside its
 * own singer's.
 *
 * So the query is taken apart, and every word of it has to appear somewhere —
 * anywhere, in any order, as part of a longer word. Each is tried both as it
 * was typed and with the vowel letters dropped, which is what lets one
 * Samaritan spelling find another. A word that is nothing but vowel letters
 * is only tried as it stands, or it would match everything.
 */
function terms(q) { return fold(q).split(/\s+/).filter(Boolean); }

function hits(hay, low, ts) {
  for (const t of ts) {
    if (hay.includes(t)) continue;
    const lt = loose(t);
    if (lt && low.includes(lt)) continue;
    return false;
  }
  return true;
}

/* Everything a recording can be found by, folded once and kept — the title,
 * the description, the editor's note, the singer, the feast, the piyyut, the
 * year, and the names of its own tracks. */
function recHay(r) {
  if (r._hay === undefined) {
    r._hay = fold([r.ttl, r.desc, r.note, perfName(r.p), eventName(r.e),
                   piyName(r.y), r.year,
                   (r.tr || []).map(t => t.n).join(' ')].filter(Boolean).join(' '));
    r._low = loose(r._hay);
  }
  return r;
}

/* "שונות" is the absence of an occasion — only worth showing when it is all
 * a piyyut has. */
function named(events) {
  const real = events.filter(e => e !== 'שונות');
  return real.length ? real : events;
}

/* ---------------------------------------------------------------- lookup */
const byId = (arr, id) => arr.find(x => x.id === id);
const perfName  = id => (byId(C.performers, id) || {}).name || '';
const eventName = id => (byId(C.events, id) || {}).name || '';
const piyName   = id => (byId(C.piyyutim, id) || {}).name || '';

/* Recordings passing every active filter except the one named in `skip`,
 * so each index can show what is still reachable from the current selection. */
function filtered(skip) {
  const ts = terms(F.q);
  return C.recordings.filter(r => {
    if (skip !== 'perf'   && F.perf   && r.p !== F.perf)   return false;
    if (skip !== 'event'  && F.event  && r.e !== F.event)  return false;
    if (skip !== 'piyyut' && F.piyyut && r.y !== F.piyyut) return false;
    if (!ts.length) return true;
    recHay(r);
    return hits(r._hay, r._low, ts);
  });
}

/* ------------------------------------------------------------------- sort
 * Each index gets the orders that make sense for it, and remembers its own
 * choice — sorting performers by total hours should not reorder the piyyutim.
 */
// Hebrew titles sort first; transliterated and numbered names follow, so an
// א־ב listing does not open with "5C the stairs".
const heRank = s => (/^[֐-׿]/.test(String(s).trim()) ? 0 : 1);
const he = (a, b) => heRank(a) - heRank(b) ||
                     String(a).localeCompare(String(b), 'he');
const SORTS = {
  piyyut: [['count', 'לפי מספר הקלטות'], ['time', 'לפי אורך'], ['abc', 'לפי א־ב']],
  perf:   [['time', 'לפי אורך'], ['count', 'לפי מספר הקלטות'], ['abc', 'לפי א־ב']],
  event:  [['year', 'לפי סדר השנה'], ['count', 'לפי מספר הקלטות'],
           ['time', 'לפי אורך'], ['abc', 'לפי א־ב']],
  rec:    [['time', 'לפי אורך'], ['abc', 'לפי א־ב'], ['perf', 'לפי מבצע'],
           ['event', 'לפי חג או אירוע'], ['tracks', 'לפי מספר רצועות']],
};
const SORT_STATE = { piyyut: 'count', perf: 'time', event: 'year', rec: 'time' };

function drawSort() {
  const opts = SORTS[tab] || [];
  $('sort').innerHTML = opts.map(([k, label]) =>
    `<option value="${k}"${SORT_STATE[tab] === k ? ' selected' : ''}>${esc(label)}</option>`
  ).join('');
}
$('sort').addEventListener('change', e => { SORT_STATE[tab] = e.target.value; draw(); });

/* ------------------------------------------------------------------ chips */
function drawChips() {
  const out = [];
  if (F.perf)   out.push(chip('מבצע', perfName(F.perf), 'perf'));
  if (F.event)  out.push(chip('אירוע', eventName(F.event), 'event'));
  if (F.piyyut) out.push(chip('פיוט', piyName(F.piyyut), 'piyyut'));
  $('chips').innerHTML = out.join('');
  $('chips').querySelectorAll('button').forEach(b => {
    b.onclick = () => { F[b.dataset.k] = 0; draw(); };
  });
  // the one key that puts everything back — only worth showing when there is
  // something to clear
  $('clearAll').classList.toggle('hidden', !(F.q || F.perf || F.event || F.piyyut));
}

/* back to the whole archive, ready for a fresh search */
function clearFilters() {
  F.q = ''; F.perf = 0; F.event = 0; F.piyyut = 0;
  $('q').value = '';
  $('qclear').classList.add('hidden');
  draw();
  $('q').focus();
}
$('clearAll').onclick = clearFilters;
const chip = (label, val, key) =>
  `<span class="chip"><b>${esc(label)}:</b> ${esc(val)}` +
  `<button data-k="${key}" title="הסר">✕</button></span>`;

/* ------------------------------------------------------------------ views */
function viewPiyyut() {
  const recs = filtered('piyyut');
  const live = new Set(recs.map(r => r.y));
  const ts = terms(F.q);

  let list = C.piyyutim.filter(p => live.has(p.id));
  if (ts.length) {          // a piyyut is also found by its own name or a variant
    const extra = C.piyyutim.filter(p => {
      if (live.has(p.id)) return false;
      const h = fold([p.name].concat(p.variants || []).join(' '));
      return hits(h, loose(h), ts);
    });
    list = list.concat(extra.filter(p => !F.perf && !F.event));
  }
  const count = {}, secs = {};
  recs.forEach(r => {
    count[r.y] = (count[r.y] || 0) + 1;
    secs[r.y]  = (secs[r.y] || 0) + r.s;
  });
  const s = SORT_STATE.piyyut;
  list.sort((a, b) =>
    s === 'abc'  ? he(a.name, b.name) :
    s === 'time' ? (secs[b.id] || 0) - (secs[a.id] || 0)
                 : (count[b.id] || 0) - (count[a.id] || 0) || b.seconds - a.seconds);

  return card_grid(list.map(p => ({
    title: p.name,
    // an index must not go blank because one row lacks an optional list
    meta:  `${count[p.id] || p.n_rec} הקלטות · ${hours(p.seconds)}` +
           ((p.variants || []).length
             ? `<br><span dir="auto">גם: ${esc(p.variants.slice(0, 3).join(' · '))}</span>` : ''),
    tags:  named(p.events || []).slice(0, 2).map(e => ({ t: e, cls: 'ev' }))
             .concat(p.note ? [{ t: 'הערת עורך', cls: '' }] : []),
    click: () => { F.piyyut = p.id; go('rec'); },
  })));
}

function viewPerf() {
  const recs = filtered('perf');
  const count = {}, secs = {};
  recs.forEach(r => {
    count[r.p] = (count[r.p] || 0) + 1;
    secs[r.p]  = (secs[r.p] || 0) + r.s;
  });
  const ts = terms(F.q);
  const s = SORT_STATE.perf;
  const list = C.performers
    .filter(p => count[p.id] ||
                 (ts.length && hits(fold(p.name), loose(p.name), ts)))
    .sort((a, b) =>
      s === 'abc'   ? he(a.name, b.name) :
      s === 'count' ? (count[b.id] || 0) - (count[a.id] || 0)
                    : (secs[b.id] || 0) - (secs[a.id] || 0));

  window._cards = list.map(p => ({
    click: () => { F.perf = p.id; go('piyyut'); },
    edit:  () => openPerf(p),
  }));
  return '<div class="grid">' + list.map((p, i) => `
    <div class="card person" data-card="${i}">
      ${photoHTML(p)}
      <div class="body">
        <h3>${esc(p.name)}</h3>
        <div class="meta">${count[p.id] || 0} הקלטות · ${hours(secs[p.id] || 0)} · ${p.n_piyyut} פיוטים${
          p.years ? ` · ${esc(p.years)}` : ''}</div>
        ${p.bio ? `<div class="meta">${esc(p.bio)}</div>` : ''}
        ${p.credit ? `<div class="pf-credit">תמונה: ${esc(p.credit)}</div>` : ''}
        <div class="tags">${named(p.events).slice(0, 3)
          .map(e => `<span class="tag ev">${esc(e)}</span>`).join('')}
          ${ADMIN.token ? `<button class="edit-btn" data-editp="${i}">✎ ערוך</button>` : ''}</div>
      </div>
    </div>`).join('') + '</div>';
}

/* A performer with no picture gets their initial, not a broken frame. */
function photoHTML(p) {
  return p.photo
    ? `<img class="pf-img" src="${esc(p.photo)}" alt="${esc(p.name)}">`
    : `<div class="pf-img ph">${esc((p.name || '?').trim()[0])}</div>`;
}

function viewEvent() {
  const recs = filtered('event');
  const count = {}, secs = {};
  recs.forEach(r => {
    count[r.e] = (count[r.e] || 0) + 1;
    secs[r.e]  = (secs[r.e] || 0) + r.s;
  });
  const ts = terms(F.q);
  const s = SORT_STATE.event;
  // C.events already arrives in calendar order, so 'year' just keeps it
  const list = C.events.filter(e => count[e.id] ||
    (ts.length && hits(fold(e.name), loose(e.name), ts)));
  if (s !== 'year') list.sort((a, b) =>
    s === 'abc'   ? he(a.name, b.name) :
    s === 'count' ? (count[b.id] || 0) - (count[a.id] || 0)
                  : (secs[b.id] || 0) - (secs[a.id] || 0));

  return card_grid(list.map(e => ({
    title: e.name,
    meta:  `${count[e.id] || 0} הקלטות · ${hours(secs[e.id] || 0)} · ${e.n_piyyut} פיוטים`,
    tags:  e.performers.slice(0, 3).map(p => ({ t: p, cls: '' })),
    click: () => { F.event = e.id; go('piyyut'); },
  })));
}

function viewRec() {
  const s = SORT_STATE.rec;
  const recs = filtered().slice().sort((a, b) =>
    s === 'abc'    ? he(a.ttl, b.ttl) :
    s === 'perf'   ? he(perfName(a.p), perfName(b.p)) || b.s - a.s :
    s === 'event'  ? he(eventName(a.e), eventName(b.e)) || b.s - a.s :
    s === 'tracks' ? b.n - a.n || b.s - a.s
                   : b.s - a.s);
  let html = '';

  if (F.piyyut) {                               // drill-down header for a piyyut
    const p = byId(C.piyyutim, F.piyyut);
    if (p) {
      html += `<div class="head"><h2>${esc(p.name)}</h2>` +
        `<div class="meta">${p.n_rec} הקלטות · ${p.n_tracks} רצועות · ${hours(p.seconds)}` +
        (p.variants.length ? ` · נכתב גם: ${esc(p.variants.join(' · '))}` : '') + `</div>` +
        `<p class="desc"><span class="lbl">מן הארכיון</span>${esc(p.desc)}</p>` +
        (p.note ? `<p class="desc note"><span class="lbl">הערת עורך</span>${esc(p.note)}</p>` : '') +
        `</div>`;
    }
  }
  html += '<div class="rows">' + recs.map(recRow).join('') + '</div>';
  return html;
}

function recRow(r) {
  const sub = [esc(perfName(r.p)), esc(eventName(r.e))];
  if (r.year) sub.push(esc(r.year));
  if (r.n > 1) sub.push(`${r.n} רצועות`);
  if (r.parts) sub.push(`${r.parts} חלקים`);
  if (r.kind === 'video') sub.push('וידאו');
  return `<div class="row${r.hidden ? ' hidden-rec' : ''}" data-rec="${r.id}">
    <button class="row-h" data-toggle="${r.id}">
      <span class="row-play" data-play="${r.id}" title="נגן">▶</span>
      <span class="row-t">
        <span class="t">${esc(r.ttl)}</span>
        <span class="s">${sub.join(' · ')}</span>
        ${r.desc && !r.from_desc ? `<span class="s">${esc(r.desc)}</span>` : ''}
      </span>
      <span class="qadd${inQueue(r.id) ? ' on' : ''}" data-q="${r.id}"
            title="${inQueue(r.id) ? 'הסר מרשימת ההשמעה' : 'הוסף לרשימת ההשמעה'}">${
        inQueue(r.id) ? '♪✓' : '♪+'}</span>
      ${ADMIN.token ? `<span class="edit-btn" data-edit="${r.id}">✎</span>` : ''}
      <span class="row-d">${dur(r.s)}</span>
    </button>
  </div>`;
}

function card_grid(items) {
  window._cards = items;
  return '<div class="grid">' + items.map((it, i) =>
    `<button class="card" data-card="${i}">
       <h3>${esc(it.title)}</h3>
       <div class="meta">${it.meta}</div>
       ${it.tags && it.tags.length ? '<div class="tags">' + it.tags.map(t =>
         `<span class="tag ${t.cls}">${esc(t.t)}</span>`).join('') + '</div>' : ''}
     </button>`).join('') + '</div>';
}

/* ------------------------------------------------------------------- draw */
function draw() {
  drawChips();
  drawSort();                     // the sort dropdown for whichever index is up
  const html = tab === 'piyyut' ? viewPiyyut()
             : tab === 'perf'   ? viewPerf()
             : tab === 'event'  ? viewEvent()
                                : viewRec();
  $('pane').innerHTML = html;
  const n = $('pane').querySelectorAll('.card,.row').length;
  $('empty').classList.toggle('hidden', n > 0);
  $('pane').classList.toggle('hidden', n === 0);

  $('pane').querySelectorAll('[data-card]').forEach(b => {
    b.onclick = ev => {
      if (ev.target.closest('[data-editp]')) return;
      window._cards[+b.dataset.card].click();
    };
  });
  $('pane').querySelectorAll('[data-editp]').forEach(b => {
    b.onclick = ev => { ev.stopPropagation(); window._cards[+b.dataset.editp].edit(); };
  });
  $('pane').querySelectorAll('[data-toggle]').forEach(b => {
    b.onclick = ev => {
      if (ev.target.closest('[data-play]') || ev.target.closest('[data-edit]') ||
          ev.target.closest('[data-q]')) return;
      toggleTracks(+b.dataset.toggle);
    };
  });
  $('pane').querySelectorAll('[data-q]').forEach(b => {
    b.onclick = ev => { ev.stopPropagation(); toggleQueue(+b.dataset.q, b); };
  });
  $('pane').querySelectorAll('[data-play]').forEach(b => {
    b.onclick = ev => { ev.stopPropagation(); playRec(+b.dataset.play, 0); };
  });
  $('pane').querySelectorAll('[data-edit]').forEach(b => {
    b.onclick = ev => { ev.stopPropagation(); openEdit(+b.dataset.edit); };
  });
  $('qclear').classList.toggle('hidden', !F.q);
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('on', t.dataset.tab === tab));
}

function go(t) { tab = t; window.scrollTo({ top: 0 }); draw(); }

/* --------------------------------------------------------------- tracks */
function toggleTracks(id) {
  const row = $('pane').querySelector(`.row[data-rec="${id}"]`);
  if (!row) return;
  const open = row.querySelector('.tracks');
  if (open) { open.remove(); return; }

  // the track list only — where the file sits on the archive drive is not
  // something a listener needs to read
  const r = byId(C.recordings, id);
  const html = '<div class="tracks">' + r.tr.map((t, i) =>
    `<button class="track" data-t="${id}:${i}">
       <span class="n">${i + 1}.</span>
       <span class="nm" dir="auto">${esc(trackName(r, i))}</span>
       <span class="d">${dur(t.s)}</span>
     </button>`).join('') + '</div>';
  row.insertAdjacentHTML('beforeend', html);
  row.querySelectorAll('[data-t]').forEach(b => {
    b.onclick = () => {
      const [rid, idx] = b.dataset.t.split(':').map(Number);
      playRec(rid, idx);
    };
  });
  markPlaying();
}

/* --------------------------------------------------------------- player */
const au = $('au');
let cur = { rec: 0, idx: 0 };

/* Served from home, the audio is the archive drive one directory away. Served
 * from the web, it is 25 GB on a media server, and the catalog says where —
 * going there straight saves the player a redirect on every track and seek. */
function audioURL(rel) {
  const enc = rel.split('/').map(encodeURIComponent).join('/');
  const base = (C && C.meta && C.meta.media) || 'audio/';
  return base + enc;
}

/* Let go of the recording. Assigning '' would leave the element pointing at the
 * page itself and fire a load error for a failure that never happened; dropping
 * the attribute and reloading is the way to end playback quietly. */
function stopAudio() {
  au.removeAttribute('src');
  au.load();
}

/* `quiet` suppresses the button click: moving from track 3 to track 4 of one
 * recording is a continuation, not a new press of PLAY. */
function playRec(recId, idx, quiet) {
  const r = byId(C.recordings, recId);
  if (!r || !r.tr[idx]) return;
  const sameRec = cur.rec === recId;
  cur = { rec: recId, idx };
  const t = r.tr[idx];
  // loading a new source snaps currentTime to 0; without this guard the seek
  // watcher below would read that as a rewind and honk on every track change
  switching = true;
  seekFrom = 0;
  setTimeout(() => { switching = false; }, 400);
  au.src = audioURL(t.f);
  vuPeak = 0;                            // the meter re-learns this tape's loudness
  bandDrop();          // another file: another key, another mode, another tuning
  if (!quiet && !sameRec) sfx('play');   // the deck's own click
  mixInit();                            // the chain must exist before playback
  if (MIX.ctx && MIX.ctx.state === 'suspended') MIX.ctx.resume();
  beginLoad(t);                          // watch it arrive, and hold the scrubber
  au.play().catch(() => {});
  setRate($('prate').value);            // a new source resets playbackRate
  openDeck();
  headIn(true);
  deckLabel(r, idx);
  $('dwName').textContent = '';        // the name is on the label already
  $('dwShare').disabled = false;
  markPlaying();
  mediaSay(r, idx);                    // the notification, for when the app is left
  setLine('ptitle', r.ttl + (r.tr.length > 1 ? ` · רצועה ${idx + 1}/${r.tr.length}` : ''));
  setLine('psub', `${perfName(r.p)} · ${eventName(r.e)}`);
  syncBtn();                 // never write into #pbtn — it holds the two icons
  clearErr();
  markPlaying();
}

/* ------------------------------------------------- loading a recording
 * These are files off a media server, and some are long. Reaching for the
 * scrubber a second after pressing play used to strand the player on a part
 * of the file that had not arrived. So the strip under the title now says
 * what is happening: it blinks red while the recording comes down, carries
 * the percentage, says when there is enough to start, and finishes green.
 * The scrubber stays out of reach until seeking is safe.
 */
const LOAD = { on: false, started: false, timer: 0, greenAt: 0,
               bytes: 0, total: 0, token: 0, blob: '' };
const PLAY_AT = 0.10;                 // enough of it down to start on
const MAX_FETCH = 90 * 1024 * 1024;   // past this, stream it and leave it alone

function loadSay(cls, text, frac) {
  const box = $('pticker');
  box.className = 'pticker on ' + cls;
  $('ptickerTxt').textContent = text;
  box.style.setProperty('--load', Math.round((frac || 0) * 100) + '%');
}

function loadHide() {
  $('pticker').className = 'pticker';
  $('ptickerTxt').textContent = '';
}

function seekable(on) {
  $('pseek').disabled = !on;
  $('pseek').classList.toggle('waiting', !on);
}

function beginLoad(track) {
  clearInterval(LOAD.timer);
  const token = ++LOAD.token;
  LOAD.on = true; LOAD.started = false; LOAD.greenAt = 0;
  LOAD.bytes = 0; LOAD.total = 0;
  TRIM.start = 0; TRIM.end = 0;
  if (LOAD.blob) { URL.revokeObjectURL(LOAD.blob); LOAD.blob = ''; }
  seekable(false);
  loadSay('load', 'טוען הקלטה… 0%', 0);
  LOAD.timer = setInterval(loadTick, 200);
  fetchTrack(track, token);            // the actual download onto the device
}

/* The element streams only a little ahead of the needle and then waits — which
 * is why the figure used to sit still, and why reaching for the scrubber
 * stranded the player. So the recording is pulled down in full alongside the
 * playing, byte by byte, and the moment it is here the player is switched onto
 * the copy in memory: from then on every point in it is instant. */
async function fetchTrack(track, token) {
  const url = audioURL(track.f);
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) return failFetch(token);
    LOAD.total = +(res.headers.get('content-length') || 0);
    if (!LOAD.total || LOAD.total > MAX_FETCH) {  // too big to hold in memory
      if (res.body.cancel) res.body.cancel().catch(() => {});
      return failFetch(token);
    }
    const reader = res.body.getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (token !== LOAD.token) { reader.cancel().catch(() => {}); return; }
      chunks.push(value);
      LOAD.bytes += value.length;
    }
    if (token !== LOAD.token) return;
    const type = res.headers.get('content-type') || 'audio/mpeg';
    const bytes = new Blob(chunks, { type });
    swapToBlob(bytes, token);
    scanSilence(await bytes.arrayBuffer(), token);
  } catch (e) { failFetch(token); }
}

/* no download — carry on streaming, and say so honestly rather than showing a
   figure that will not move */
function failFetch(token) {
  if (token !== LOAD.token || !LOAD.on) return;
  LOAD.total = -1;
}

/* the same recording, now held in memory: keep the place and the play state */
function swapToBlob(bytes, token) {
  if (token !== LOAD.token) return;
  const at = au.currentTime, playing = !au.paused;
  const href = URL.createObjectURL(bytes);
  LOAD.blob = href;
  switching = true;
  setTimeout(() => { switching = false; }, 400);
  const resume = () => {
    au.removeEventListener('loadedmetadata', resume);
    if (token !== LOAD.token) return;
    try { au.currentTime = Math.max(at, TRIM.start || 0); } catch (e) {}
    if (playing) au.play().catch(() => {});
  };
  au.addEventListener('loadedmetadata', resume);
  au.src = href;
  setRate($('prate').value);
}

function loadTick() {
  if (!LOAD.on) return;
  const streaming = LOAD.total < 0;
  const p = streaming ? 0 : (LOAD.total ? LOAD.bytes / LOAD.total : 0);
  const pct = Math.round(p * 100);

  // enough of it is here to start, and the scrubber can be trusted
  if (!LOAD.started && (streaming ? au.readyState >= 3 : p >= PLAY_AT)) {
    LOAD.started = true;
    seekable(true);
    au.play().catch(() => {});
  }
  if (streaming) {
    // no byte count to show: it plays as it arrives, and says only that
    if (!LOAD.greenAt && au.readyState >= 3) {
      LOAD.greenAt = Date.now();
      seekable(true);
      loadSay('done', 'האזנה נעימה', 1);
    } else if (LOAD.greenAt && Date.now() - LOAD.greenAt > 3000) {
      LOAD.on = false; clearInterval(LOAD.timer); loadHide();
    } else if (!LOAD.greenAt) {
      loadSay('load', 'טוען הקלטה…', 0);
    }
    return;
  }
  if (p >= 0.999) {
    if (!LOAD.greenAt) {
      LOAD.greenAt = Date.now();
      seekable(true);
      loadSay('done', 'האזנה נעימה', 1);
    } else if (Date.now() - LOAD.greenAt > 3000) {
      LOAD.on = false; clearInterval(LOAD.timer); loadHide();
    }
    return;
  }
  loadSay('load', LOAD.started
    ? `טוען הקלטה… ${pct}% · מתחיל בהשמעה`
    : `טוען הקלטה… ${pct}%`, p);
}

/* ---------------------------------------------------- trimming the silence
 * Cassettes were left running before the singing began and after it ended,
 * so many of these start and finish with nothing at all. The quiet at the
 * two ends is skipped on playback — never the quiet in the middle, which is
 * a breath or a pause and belongs to the piece — and nothing is written: the
 * file on the archive is untouched, only where this playback starts and
 * stops.
 */
const TRIM = { start: 0, end: 0 };
const SILENCE = 0.012;                // below this counts as nothing

/* The bytes are already here — the download did that — so this only decodes
 * them and reads where the sound begins and ends. */
async function scanSilence(buf, token) {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  if (token !== LOAD.token) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const audio = await ctx.decodeAudioData(buf);
    ctx.close();
    const ch = audio.getChannelData(0);
    const rate = audio.sampleRate;
    const win = Math.floor(rate * 0.05);          // judge in 50 ms windows
    const loud = i => {
      let peak = 0;
      for (let j = i; j < Math.min(i + win, ch.length); j++) {
        const v = Math.abs(ch[j]);
        if (v > peak) peak = v;
      }
      return peak > SILENCE;
    };
    let a = 0, b = ch.length - win;
    while (a < ch.length && !loud(a)) a += win;
    while (b > a && !loud(b)) b -= win;
    const start = Math.max(0, a / rate - 0.15);   // leave a breath either side
    const end   = Math.min(audio.duration, (b + win) / rate + 0.25);
    if (end - start < 1) return;                  // nothing but silence: leave it
    if (token !== LOAD.token) return;             // the user moved on meanwhile
    TRIM.start = start > 0.4 ? start : 0;
    TRIM.end   = end < audio.duration - 0.4 ? end : 0;
    if (TRIM.start && au.currentTime < TRIM.start) au.currentTime = TRIM.start;
  } catch (e) { /* an odd codec, a short read — play it as it comes */ }
}

// the tail: stop where the singing stopped, and move on as if it had ended
au.addEventListener('timeupdate', () => {
  if (TRIM.end && au.currentTime >= TRIM.end && !au.paused) {
    au.currentTime = au.duration || TRIM.end;     // let `ended` do the rest
  }
});

function step(d, quiet) {
  const r = byId(C.recordings, cur.rec);
  if (!r) return false;
  const i = cur.idx + d;
  if (i >= 0 && i < r.tr.length) { playRec(cur.rec, i, quiet); return true; }
  return false;                          // ran off the end of this recording
}

function markPlaying() {
  document.querySelectorAll('.track').forEach(b =>
    b.classList.toggle('on', b.dataset.t === `${cur.rec}:${cur.idx}`));
}

/* ------------------------------------------------------------ the window */
function openDeck() {
  $('deckWin').classList.remove('hidden', 'min');
  $('dwMin').textContent = '─';
}
$('dwMin').onclick = () => {
  const min = $('deckWin').classList.toggle('min');
  $('dwMin').textContent = min ? '▢' : '─';   // playback continues either way
};
/* Closing the player ejects the cassette rather than just blinking the window
 * away: the lid swings up, and the cassette tips back on its rails and rises
 * out of the well — held out, the way a deck offers it to be taken. */
$('dwClose').onclick = () => {
  au.pause(); stopAudio(); spoolStop(false);
  dancerOut('right');            // she is off the stage before the lid shuts
  headIn(false);
  syncBtn();
  const win = $('deckWin');
  if (win.classList.contains('ejecting')) return;
  win.classList.add('ejecting');
  setTimeout(() => {
    win.classList.remove('ejecting');
    win.classList.add('hidden');
    deckLabel(null, 0);
  }, 640);
};

/* ---------------------------------------------------- the tape head
 * The head assembly is parked 96 units below the slot in the artwork.
 * Play drives it up into the cassette; stop parks it again.
 *
 * The straight run of tape reacts: with the head down the run lies flat, and
 * when the head comes up against it the tape is pushed in and rides over it
 * in a shallow wave, the way it does when the pad presses it to the gap.
 */
function headIn(on) {
  $('head').style.transform = on ? 'translate(0px,0px)' : 'translate(0px,96px)';
  headEngaged = on;
  paintTape();
}

/* --------------------------------------------------- play / pause / stop */
$('pbtn').onclick = () => {
  if (!au.src) return;
  if (au.paused) {
    sfx('play'); headIn(true);
    au.play().catch(() => {});
  } else {
    au.pause();                       // pause: the reels simply stop
    sfx('pause');
  }
  syncBtn();
};

/* Stop parks the head and runs the motor backwards — the tape visibly winds
 * back to the start rather than jumping there. */
let rewinding = 0;
$('pstop').onclick = () => {
  // recording first: STOP is what ends it and sends it up
  if (REC.rec) { sfx('stop'); stopRecording(); return; }
  if (!au.src) return;
  au.pause();
  dancerOut('right');                // she runs off the way she came in
  headIn(false);
  syncBtn();
  sfx('stop');                       // the button first…
  if (!au.currentTime) return;
  setTimeout(() => sfx('rewind'), 130);   // …then the tape starts winding
  // a timer, not requestAnimationFrame: the wind must finish even if the tab
  // is in the background, where rAF is suspended
  clearInterval(rewinding);
  const from = au.currentTime, t0 = Date.now();
  const span = Math.min(1600, 300 + from * 12);      // longer tape, longer wind
  rewinding = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / span);
    au.currentTime = from * (1 - k);
    deckPaint();
    if (k >= 1) {
      clearInterval(rewinding);
      au.currentTime = 0;
      sfxStop('rewind');
      deckPaint();
    }
  }, 40);
};

/* ------------------------------------------------------ rewind / forward
 * Held down, these spool the tape the way the mechanical keys do: the head
 * lifts off, so nothing is heard, and the tape runs at twice speed for as
 * long as the key is down. A press first gives the mechanical clack of the
 * key itself, and then the whirr of the spool — the same whirr both ways.
 * Releasing the key drops the tape back where it stands.
 */
let spooling = 0;
const SPOOL_RATE = 2;                    // twice the playing speed

function spoolStart(dir) {
  if (!au.src || spooling) return;
  const wasPlaying = !au.paused;
  au.pause();
  headIn(false);                         // off the tape: a spooling deck is mute
  syncBtn();
  sfx('stop');                           // the key goes down…
  setTimeout(() => sfx('spool'), 130);   // …then the spool picks up
  const t0 = Date.now(), from = au.currentTime;
  spooling = setInterval(() => {
    const moved = ((Date.now() - t0) / 1000) * SPOOL_RATE * dir;
    const to = from + moved;
    const end = au.duration || 0;
    au.currentTime = Math.min(end || to, Math.max(0, to));
    deckPaint();
    if (au.currentTime <= 0 || (end && au.currentTime >= end)) spoolStop(wasPlaying);
  }, 40);
  $('prew').dataset.resume = $('pff').dataset.resume = wasPlaying ? '1' : '';
}

function spoolStop(resume) {
  if (!spooling) return;
  clearInterval(spooling);
  spooling = 0;
  sfxStop('spool');
  if (resume === undefined) resume = $('prew').dataset.resume === '1';
  if (resume) { headIn(true); au.play().catch(() => {}); }
  syncBtn();
  deckPaint();
}

for (const [id, dir] of [['prew', -1], ['pff', 1]]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    spoolStart(dir);
    // capture so a finger sliding off the key still ends the spool on release;
    // it is a convenience, and must never be what stops the key working
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(
    ev => b.addEventListener(ev, () => spoolStop()));
  // keyboard: the key repeats while held, and stops on release
  b.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spoolStart(dir); }
  });
  b.addEventListener('keyup', () => spoolStop());
}

/* -------------------------------------------------------------- record
 * The red key. Recording itself belongs to the admin side of the unit — it
 * is how new material gets into the archive — so outside admin mode the key
 * is present and pressable but says so, on the little segment display under
 * the panel text. Each press sends the message across once.
 */
const REC_DENIED = 'Not Available in this mode · כפתור זה זמין במצב מנהל בלבד';

function ticker(msg) {
  const box = $('pticker'), txt = $('ptickerTxt');
  txt.textContent = msg;
  box.className = 'pticker on';         // never inherit a loading state
  void box.offsetWidth;                 // restart the pass on a repeat press
  box.classList.add('run');
}
$('ptickerTxt').addEventListener('animationend', () => {
  // only the travelling message clears itself; the loading states are held
  // by their own timer and must not be wiped from under it
  if (!$('pticker').classList.contains('run')) return;
  $('pticker').className = 'pticker';
  $('ptickerTxt').textContent = '';
});

/* The machine records. The whole thing hangs off one object: the microphone
 * stream, the encoder writing into it, the analyser the lamps read, and the
 * details typed into the form, which are what the cassette shows while it
 * runs and what the upload is filed under.
 */
const REC = { stream: null, rec: null, chunks: [], meta: null,
              ctx: null, an: null, t0: 0, tick: 0,
              user: '', pass: '' };   // live site only: the media server's own

function recArmed(on) {
  $('prec').classList.toggle('armed', on);
  $('recLamp').classList.toggle('on', on);
}

/* REC asks for the details first: without a piyyut name the archive cannot
 * file what comes back. Outside admin mode it asks to sign in. */
$('prec').onclick = () => {
  if (REC.rec) return;                          // already running — STOP ends it
  const online = !!(C && C.meta && C.meta.readonly);
  if (online) {
    // on the live site the media server keeps its own credentials, so the key
    // asks for those rather than for the archive-drive admin
    if (C.meta.can_record === false) return ticker(REC_DENIED);
    if (REC.pass) return openRecordForm();
    pendingAfterLogin = 'record';
    return $('adminBtn').click();
  }
  if (!ADMIN.token) { pendingAfterLogin = 'record'; return $('adminBtn').click(); }
  openRecordForm();
};

/* the add sheet, in its recording guise */
function openRecordForm() {
  $('addBtn').click();                          // fills the datalists for us
  $('addTitle').textContent = 'הקלטה חדשה';
  $('recIntro').classList.remove('hidden');
  $('upFilesRow').classList.add('hidden');
  $('upList').innerHTML = '';
  $('upGo').classList.add('hidden');
  $('recGo').classList.remove('hidden');
}

/* and back to the shape it has for plain uploads */
function resetAddForm() {
  $('addTitle').textContent = 'הוספת הקלטה לאוצר';
  $('recIntro').classList.add('hidden');
  $('upFilesRow').classList.remove('hidden');
  $('upGo').classList.remove('hidden');
  $('recGo').classList.add('hidden');
}

$('recGo').onclick = async () => {
  const err = m => { $('upErr').textContent = m; $('upErr').classList.remove('hidden'); };
  const piyyut = $('upPiyyut').value.trim();
  if (!piyyut) return err('שם הפיוט הוא שדה חובה — הוא מה שההקלטה תתויק תחתיו.');
  if (!navigator.mediaDevices || !window.MediaRecorder)
    return err('המכשיר הזה אינו תומך בהקלטה מן הדפדפן.');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false,
               autoGainControl: false, channelCount: 1 },
    });
  } catch (e) {
    return err(e && e.name === 'NotAllowedError'
      ? 'הגישה למיקרופון נדחתה. אשר אותה בהגדרות הדפדפן ונסה שוב.'
      : 'לא נמצא מיקרופון זמין במכשיר.');
  }

  REC.meta = { piyyut,
               performer: $('upPerf').value.trim() || 'לא ידוע',
               event:     $('upEvent').value,
               title:     $('upTitle').value.trim() || piyyut,
               note:      $('upNote').value.trim() };
  closeModal('addModal');
  resetAddForm();
  startRecording(stream);
};

function startRecording(stream) {
  // the deck stops playing: one machine, one head
  au.pause(); stopAudio(); spoolStop(false);
  openDeck();

  REC.stream = stream;
  REC.chunks = [];
  // whatever this browser will actually encode
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
    .find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  REC.rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  REC.rec.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  REC.rec.start(1000);                          // a chunk a second, so nothing is lost

  // the lamps read the microphone now, not the playing file
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    REC.ctx = new AC();
    const src = REC.ctx.createMediaStreamSource(stream);
    REC.an = REC.ctx.createAnalyser();
    REC.an.fftSize = 2048;
    src.connect(REC.an);                        // analyser only: no echo back out
  } catch (e) { REC.an = null; }

  recArmed(true);
  headIn(true);
  keepAwake(true);
  writeRecLabels(0);
  REC.t0 = Date.now();
  REC.tick = setInterval(() => writeRecLabels((Date.now() - REC.t0) / 1000), 250);
  toast('מקליט — לחץ STOP לסיום ולשמירה');
}

/* the cassette carries what was typed into the form, and counts up */
function writeRecLabels(secs) {
  const m = REC.meta || {};
  $('cTitle').textContent = m.title || '—';
  $('cPerf').textContent  = m.performer || '';
  $('cRec').textContent   = 'הקלטה חדשה';
  $('cEvent').textContent = m.event || '';
  $('cLine2').textContent = new Date().getFullYear();
  $('cParts').textContent = 'REC';
  $('cTime').textContent  = `${dur(secs)} / ● REC`;
  if ($('ptitle').textContent !== (m.title || 'הקלטה חדשה')) {
    setLine('ptitle', m.title || 'הקלטה חדשה');       // only on a real change:
    setLine('psub', [m.performer, m.event].filter(Boolean).join(' · '));
  }                                                    // the counter ticks 4×/s
  $('dwName').textContent = 'מקליט…';
}

async function stopRecording() {
  if (!REC.rec) return false;
  clearInterval(REC.tick);
  const secs = (Date.now() - REC.t0) / 1000;
  const blob = await new Promise(res => {
    REC.rec.onstop = () => res(new Blob(REC.chunks,
      { type: REC.rec.mimeType || 'audio/webm' }));
    REC.rec.stop();
  });
  REC.stream.getTracks().forEach(t => t.stop());
  if (REC.ctx) { try { REC.ctx.close(); } catch (e) {} }
  REC.rec = null; REC.stream = null; REC.an = null; REC.ctx = null;
  recArmed(false);
  headIn(false);
  keepAwake(false);
  if (secs < 1 || !blob.size) { toast('ההקלטה קצרה מדי — לא נשמרה', 1); return true; }
  await uploadRecording(blob, secs);
  return true;
}

/* Up to the archive, into the pile waiting to be sorted.
 *
 * Where that is depends on where the app is running. On this machine the
 * archive drive is here: the clip is written to disk first and copied to the
 * media server afterwards, so a recording survives a network that is down.
 * On a phone there is no drive, so it goes straight to the media server.
 */
async function uploadRecording(blob, secs) {
  const m = REC.meta || {};
  const ext = /mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
  const online = !!(C && C.meta && C.meta.readonly);
  const fd = new FormData();
  fd.append('file', blob, `${m.piyyut || 'הקלטה'} ${when}.${ext}`);
  fd.append('piyyut', m.piyyut || '');
  fd.append('performer', m.performer || '');
  fd.append('event', m.event || '');
  fd.append('title', m.title || '');
  fd.append('note', m.note || '');
  fd.append('pending', '1');                    // goes to the sorting pile
  fd.append('seconds', Math.round(secs));
  if (online) {                                 // the media server checks these
    fd.append('user', REC.user || '');
    fd.append('password', REC.pass || '');
  }

  $('dwName').textContent = 'מעלה…';
  toast(online ? 'ההקלטה הסתיימה — מעלה לשרת המדיה'
               : 'ההקלטה הסתיימה — נשמרת ומועלית');
  let r = {};
  try {
    r = await fetch(online ? 'api/record' : 'api/upload', {
      method: 'POST', body: fd,
      headers: online ? {} : { 'X-Admin-Token': ADMIN.token },
    }).then(x => x.json());
  } catch (e) { r = {}; }
  if (!r.ok) {
    // hold the audio so nothing is lost if the archive cannot be reached
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${m.piyyut || 'הקלטה'} ${when}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
    toast(r.message || (r.error === 'recording_disabled'
      ? 'ההקלטה אינה מופעלת בשרת — ההקלטה ירדה למכשיר כדי שלא תאבד'
      : 'ההעלאה נכשלה — ההקלטה ירדה למכשיר כדי שלא תאבד'), 1);
    return;
  }
  if (!online) await loadCatalog();
  toast(`נשמר להקלטות למיון: ${m.title || m.piyyut} · ${dur(secs)}`);
  markNewsSeen();
}

function syncBtn() {
  if (navigator.mediaSession)
    navigator.mediaSession.playbackState = !au.src ? 'none'
      : au.paused ? 'paused' : 'playing';
  $('icPlay').classList.toggle('hidden', !au.paused);
  $('icPause').classList.toggle('hidden', au.paused);
  $('pbtn').title = au.paused ? 'נגן' : 'השהה';
  // the key stays latched down while the tape runs, as it does on the machine
  $('pbtn').classList.toggle('down', !au.paused);
}
au.addEventListener('play',  () => { headIn(true); syncBtn(); keepAwake(true); });
au.addEventListener('pause', () => { syncBtn(); keepAwake(false); });
au.addEventListener('ended', () => keepAwake(true));

/* ------------------------------------------------------------- the mixer
 * A real processing chain on the playing audio. These are field recordings off
 * cassette, so the useful controls are the ones that fight tape: rumble below
 * the voice, hiss above it, a shelf each end, and levelling for takes that
 * swing between a whisper and a shout.
 *
 *   element → highpass → lowpass → bass → mid → treble → comp → gain
 *           → analyser → speakers
 */
const MIX = { ctx: null, nodes: null, on: false };
/* every fader, in the order the ready-made settings list their values */
const MIX_IDS = ['mBass', 'mMid', 'mMidF', 'mTreb', 'mHP', 'mLP',
                 'mComp', 'mGate', 'mGain'];

function mixInit() {
  if (MIX.ctx) return MIX.nodes;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    const ctx = new AC();
    const src  = ctx.createMediaElementSource(au);

    /* The tape-restoration stage, ahead of everything the user touches.
     * These are cassettes: forty years of rumble under the singing, mains hum
     * picked up by whatever recorded them, hiss across the top, and the sharp
     * edge of a dropout where the tape faltered. Each of these is dealt with
     * where the singing is not:
     *   rumble  — nothing sung sits below 60 Hz
     *   hum     — two narrow notches, on the mains tone and its harmonic
     *   hiss    — a gentle shelf above 9 kHz, well over the voice
     *   jumps   — a fast limiter that takes the spike off a click
     * Nothing is cut from the middle of the band, so no word is lost, and the
     * whole stage can be stepped past in one press. */
    const rHP  = ctx.createBiquadFilter(); rHP.type = 'highpass'; rHP.frequency.value = 62; rHP.Q.value = .7;
    const rN1  = ctx.createBiquadFilter(); rN1.type = 'notch'; rN1.frequency.value = 50;  rN1.Q.value = 18;
    const rN2  = ctx.createBiquadFilter(); rN2.type = 'notch'; rN2.frequency.value = 100; rN2.Q.value = 18;
    const rHS  = ctx.createBiquadFilter(); rHS.type = 'highshelf'; rHS.frequency.value = 9000; rHS.gain.value = -5;
    const rLim = ctx.createDynamicsCompressor();
    rLim.threshold.value = -6; rLim.ratio.value = 12; rLim.knee.value = 2;
    rLim.attack.value = .0015; rLim.release.value = .08;

    const hp   = ctx.createBiquadFilter(); hp.type = 'highpass';  hp.frequency.value = 20;
    const lp   = ctx.createBiquadFilter(); lp.type = 'lowpass';   lp.frequency.value = 20000;
    const bass = ctx.createBiquadFilter(); bass.type = 'lowshelf';  bass.frequency.value = 180;
    const mid  = ctx.createBiquadFilter(); mid.type = 'peaking';    mid.frequency.value = 1100; mid.Q.value = .9;
    const treb = ctx.createBiquadFilter(); treb.type = 'highshelf'; treb.frequency.value = 3800;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = 0; comp.ratio.value = 1; comp.knee.value = 24;
    comp.attack.value = .006; comp.release.value = .22;
    const gain = ctx.createGain();
    const an   = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = .75;
    // mains hum and its first harmonic, notched out when the noise key is on
    const hum1 = ctx.createBiquadFilter(); hum1.type = 'notch'; hum1.frequency.value = 50;  hum1.Q.value = 24;
    const hum2 = ctx.createBiquadFilter(); hum2.type = 'notch'; hum2.frequency.value = 100; hum2.Q.value = 24;
    hum1.gain.value = hum2.gain.value = 0;      // notch ignores gain; bypass is by Q
    // the echo send: a short delay fed back on itself, mixed in after the gain
    const dly = ctx.createDelay(1.0); dly.delayTime.value = .17;
    const fb  = ctx.createGain(); fb.gain.value = .3;
    const wet = ctx.createGain(); wet.gain.value = 0;    // silent until asked for

    // the gate listens here, before its own gain, so it hears the signal it
    // is about to open or close on
    const pre  = ctx.createAnalyser(); pre.fftSize = 1024; pre.smoothingTimeConstant = .4;
    const gate = ctx.createGain();     gate.gain.value = 1;
    const match = ctx.createGain();    match.gain.value = 1;
    // a hard ceiling: a compressor wound right up, so peaks cannot clip
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = 0; lim.ratio.value = 1; lim.knee.value = 0;
    lim.attack.value = .002; lim.release.value = .12;

    src.connect(rHP); rHP.connect(rN1); rN1.connect(rN2); rN2.connect(rHS);
    rHS.connect(rLim); rLim.connect(hp);
    hp.connect(lp); lp.connect(bass); bass.connect(mid);
    mid.connect(treb); treb.connect(hum1); hum1.connect(hum2);
    hum2.connect(comp);
    comp.connect(pre);  comp.connect(gate);
    gate.connect(match); match.connect(lim); lim.connect(gain);
    gain.connect(an);  an.connect(ctx.destination);
    gain.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet);
    wet.connect(an);

    MIX.ctx = ctx;
    MIX.nodes = { src, hp, lp, bass, mid, treb, comp, gain, an,
                  hum1, hum2, dly, fb, wet, pre, gate, match, lim,
                  rHP, rN1, rN2, rHS, rLim };
    restoreApply();
    return MIX.nodes;
  } catch (e) { return null; }         // already routed, or blocked
}

function mixApply() {
  const n = mixInit();
  if (!n) return;
  const v = id => +$(id).value;
  n.bass.gain.value = v('mBass');
  n.mid.gain.value  = v('mMid');
  n.treb.gain.value = v('mTreb');
  n.mid.frequency.value = v('mMidF');
  n.hp.frequency.value = Math.max(20, v('mHP'));
  n.lp.frequency.value = v('mLP');
  const amt = v('mComp');                     // 0 → off, 40 → firm
  n.comp.threshold.value = amt ? -amt : 0;
  n.comp.ratio.value     = amt ? 1 + amt / 8 : 1;
  n.gain.gain.value      = v('mGain') / 100;
  const dB = x => (x > 0 ? '+' : '') + x;
  $('mBassN').textContent = dB(v('mBass'));
  $('mMidN').textContent  = dB(v('mMid'));
  $('mMidFN').textContent = v('mMidF') >= 1000
    ? (v('mMidF') / 1000).toFixed(1) + 'k' : v('mMidF') + '';
  $('mTrebN').textContent = dB(v('mTreb'));
  $('mHPN').textContent   = v('mHP') ? v('mHP') + ' הרץ' : 'כבוי';
  $('mLPN').textContent   = v('mLP') >= 20000 ? 'כבוי' : Math.round(v('mLP') / 1000) + ' קילוהרץ';
  $('mCompN').textContent = amt ? amt + '' : 'כבוי';
  $('mGateN').textContent = v('mGate') ? '−' + v('mGate') + ' דציבל' : 'כבוי';
  $('mGainN').textContent = v('mGain') + '%';
  localStorage.setItem('shira_mix', JSON.stringify(
    MIX_IDS.map(id => $(id).value)));
  paintMixState();
}

function mixSet(vals) {
  MIX_IDS.forEach((id, i) => { if (vals[i] !== undefined) $(id).value = vals[i]; });
  mixApply();
}

/* Where every control sits when it is doing nothing. Anything away from this
   means the sound is being shaped, and the strip beside the plate says so. */
const MIX_NEUTRAL = { mBass: 0, mMid: 0, mMidF: 1100, mTreb: 0, mHP: 0,
                      mLP: 20000, mComp: 0, mGate: 0, mGain: 100 };

function mixActive() {
  if (MIX_IDS.some(id => +$(id).value !== MIX_NEUTRAL[id])) return true;
  return !!(FX.echo || FX.pitch || FX.denoise || FX.limit || FX.match);
}

function paintMixState() {
  const on = mixActive();
  $('mixState').textContent = on ? 'אפקטי מיקסר' : 'ללא אפקטי מיקסר';
  $('mixState').classList.toggle('on', on);
}

/* ------------------------------------------------- the tape restoration
 * On by default: every recording here came off a cassette, and every one of
 * them carries the same four faults. One press steps past the whole stage and
 * plays the tape exactly as the archive holds it.
 */
let RESTORE = localStorage.getItem('shira_restore') !== 'off';

function restoreApply() {
  const n = MIX.nodes;
  if (n) {
    // Stepping past it means making each filter transparent. A notch is
    // bypassed by narrowing it to nothing and moving it out of the way —
    // NOT by dropping its Q, which widens the notch until it swallows
    // everything and the recording falls silent.
    n.rHP.frequency.value = RESTORE ? 62 : 10;
    n.rN1.frequency.value = RESTORE ? 50 : 21000;
    n.rN2.frequency.value = RESTORE ? 100 : 21000;
    n.rN1.Q.value = n.rN2.Q.value = RESTORE ? 18 : 1000;
    n.rHS.gain.value = RESTORE ? -5 : 0;
    n.rLim.threshold.value = RESTORE ? -6 : 0;
    n.rLim.ratio.value     = RESTORE ? 12 : 1;
  }
  $('tapeState').textContent = RESTORE ? 'עיבוד קלטת' : 'מקור';
  $('tapeState').classList.toggle('off', !RESTORE);
  $('tapeState').title = RESTORE
    ? 'רעש רקע, המהום וקפיצות סרט מרוככים — לחיצה תחזיר את ההקלטה כפי שהיא בארכיון'
    : 'ההקלטה מושמעת כפי שהיא בארכיון — לחיצה תחזיר את עיבוד הקלטת';
  localStorage.setItem('shira_restore', RESTORE ? 'on' : 'off');
}

$('tapeState').onclick = () => {
  RESTORE = !RESTORE;
  mixInit();
  restoreApply();
  toast(RESTORE ? 'עיבוד קלטת פועל' : 'מושמע מן המקור, ללא עיבוד');
};
/* ================================================================== נגנים
 * A composed accompaniment for the piyyut that is playing.
 *
 * The one thing that decides whether this is music or noise is the tuning.
 * These are cassettes: some were recorded on a machine running slow, some
 * were copied twice, and almost none of them sit at A=440. An accompaniment
 * a quarter-tone away from the singing is worse than no accompaniment at
 * all — so the pitch of the recording is measured first, in cents, and every
 * instrument is tuned to the recording rather than to the piano.
 *
 * What is measured, and why each of it is needed:
 *   the tuning   — so the players are in tune with the singer, not with A=440
 *   the tonic    — so the drone sits under the melody instead of beside it
 *   the mode     — so the notes chosen are the ones the piyyut already uses
 *   the pulse    — so the plucking falls with the singing and not across it
 *   the silences — so the players rest where the singing rests
 *
 * The harmony is deliberately still. This is monophonic, largely unmeasured
 * liturgical singing, and a chord progression walking about underneath it
 * fights it. So the organ holds a drone on the tonic for the whole piece and
 * never leaves; only the guitar and the violin move, and they move inside the
 * mode that was measured. A drone cannot quarrel with a melody in its own
 * mode, which is why this repertoire has been sung over one for a very long
 * time.
 */
const BAND = {
  on: false, busy: false, an: null, forKey: '',
  nodes: null, timer: 0, next: 0, step: 0, cache: {},
};

/* The modes tried against the recording, written as semitones above the
   tonic. The last two are what much of this archive actually sings in —
   hijaz above all, whose flat second over a major third is the sound of the
   thing — and they are why a plain major/minor test would not do. */
const BAND_MODES = [
  { k: 'major',    n: "מז'ור",   s: [0, 2, 4, 5, 7, 9, 11], p: [0, 3, 4, 3] },
  { k: 'minor',    n: 'מינור',   s: [0, 2, 3, 5, 7, 8, 10], p: [0, 5, 3, 4] },
  { k: 'dorian',   n: 'דוריאני', s: [0, 2, 3, 5, 7, 9, 10], p: [0, 3, 0, 5] },
  { k: 'phrygian', n: 'פריגי',   s: [0, 1, 3, 5, 7, 8, 10], p: [0, 1, 0, 3] },
  { k: 'hijaz',    n: "חיג'אז",  s: [0, 1, 4, 5, 7, 8, 11], p: [0, 1, 0, 3] },
];

const PC_NAME = ['דו', 'דו#', 'רה', 'מי♭', 'מי', 'פה',
                 'פה#', 'סול', 'לה♭', 'לה', 'סי♭', 'סי'];

/* ---- an FFT, because there is no other way to have one here.
 * AnalyserNode only works while sound is actually passing through it, and
 * this measurement is made on the file with nothing playing. Iterative
 * radix-2, in place. */
function bandFFT(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2], bi = im[i + k + len / 2];
        const tr = br * cr - bi * ci, ti = br * ci + bi * cr;
        re[i + k] = ar + tr; im[i + k] = ai + ti;
        re[i + k + len / 2] = ar - tr; im[i + k + len / 2] = ai - ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/* ---- listening to the recording, once, before a note is played */
async function bandAnalyse(bytes) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  // 8 kHz. Nothing sung reaches 4 kHz, and the harmonics that matter are all
  // well under it; decoding to less means a shorter window can still resolve
  // what it has to.
  const RATE = 8000;
  const oc = new OAC(1, 1, RATE);
  const audio = await (oc.decodeAudioData.length > 1
    ? new Promise((ok, no) => oc.decodeAudioData(bytes, ok, no))
    : oc.decodeAudioData(bytes));
  const ch = audio.getChannelData(0);
  // A quarter of a second, and it must not be longer than a note. At half a
  // second — which is what this was — a window laid over singing that moves
  // at all covers two notes at once and reports neither: measured on a
  // melody of known content, three of its six notes came back at nought.
  // The frequency lost by shortening it is bought back below, by reading the
  // harmonics rather than the fundamental.
  const N = 2048, HOP = 1024;
  const last = Math.min(ch.length, Math.floor(RATE * 300));  // five minutes is plenty
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);

  // The loudness is read on its own, and far more finely than the pitch. The
  // pitch window has to be long to tell one semitone from the next; the beat
  // has to be read short or a half-second pulse falls inside a single frame
  // and cannot be seen at all.
  const EHOP = 1024;                                   // an eighth of a second
  const energy = [];
  for (let off = 0; off + EHOP <= ch.length; off += EHOP) {
    let r = 0;
    for (let i = 0; i < EHOP; i++) { const v = ch[off + i]; r += v * v; }
    energy.push(Math.sqrt(r / EHOP));
  }

  const chroma = new Float64Array(12);
  let tx = 0, ty = 0;                  // the tuning, summed as a direction
  let lastMidi = -999;                 // what the frame before this one read
  const held = [];                     // every note actually sustained, in order
  const sung = [];                     // {pitch, weight} of each held frame

  const BIN = RATE / N;
  const TOP = Math.min(N / 2 - 2, Math.floor(3800 / BIN));
  const re = new Float32Array(N), im = new Float32Array(N);
  const mag = new Float32Array(N / 2);

  /* The pitch is not looked for among the peaks of the spectrum.
   *
   * A sung note's own fundamental is often the weakest thing in it — at the
   * bottom of a man's voice it can be barely present at all, and on a cassette
   * played through a telephone-grade capsule it frequently is not there. Hunt
   * for peaks near it and the answer comes back wrong or missing: measured on
   * a melody built to order, a note sung five times over came back at nought
   * per cent, and the key with it.
   *
   * So instead every pitch it could be is proposed in turn — a third of a
   * semitone apart, over the range a voice occupies — and each is asked how
   * much of its own harmonic series is present. The note that answers loudest
   * wins. A pitch with no energy at its fundamental still wins on its second,
   * third and fourth, which is exactly the case that was failing.
   */
  const GRID = [], GBIN = [];
  const STEP = Math.pow(2, 1 / 36);                    // a third of a semitone
  for (let f = 70; f <= 700; f *= STEP) {
    GRID.push(f);
    const bs = [];
    for (let h = 1; h <= 5; h++) {
      const x = f * h / BIN;
      if (x + 1 >= TOP) break;
      bs.push(x);
    }
    GBIN.push(bs);
  }
  const at = x => {                                    // the magnitude between bins
    const i = x | 0, t = x - i;
    return mag[i] * (1 - t) + mag[i + 1] * t;
  };

  for (let off = 0; off + N < last; off += HOP) {
    let rms = 0;
    for (let i = 0; i < N; i++) {
      const v = ch[off + i];
      rms += v * v;
      re[i] = v * win[i]; im[i] = 0;
    }
    rms = Math.sqrt(rms / N);
    if (rms < 1e-4) { lastMidi = -999; continue; }
    bandFFT(re, im);
    for (let i = 1; i <= TOP; i++) mag[i] = Math.hypot(re[i], im[i]);

    let bi = -1, bs = -1;
    for (let g = 0; g < GRID.length; g++) {
      const bins = GBIN[g];
      let sal = 0;
      for (let h = 0; h < bins.length; h++) sal += at(bins[h]) / (h + 1);
      // the octave above borrows its whole series from the note below, so
      // without a hand on the scale it wins every time
      sal /= 1 + 0.22 * Math.log2(GRID[g] / 70);
      if (sal > bs) { bs = sal; bi = g; }
    }
    if (bi < 1 || bi >= GRID.length - 1) { lastMidi = -999; continue; }

    // the true pitch lies between two of the proposals; a parabola over the
    // three around the winner places it, and the grid being logarithmic, the
    // correction is in semitones straight away
    let s0 = 0, s1 = bs, s2 = 0;
    for (const [k, tgt] of [[bi - 1, 0], [bi + 1, 2]]) {
      let sal = 0;
      const bins = GBIN[k];
      for (let h = 0; h < bins.length; h++) sal += at(bins[h]) / (h + 1);
      sal /= 1 + 0.22 * Math.log2(GRID[k] / 70);
      if (tgt === 0) s0 = sal; else s2 = sal;
    }
    const d = 0.5 * (s0 - s2) / ((s0 - 2 * s1 + s2) || 1e-9);
    const midi = 69 + 12 * Math.log2(GRID[bi] / 440) + (isFinite(d) ? d / 3 : 0);

    const frac = midi - Math.round(midi);            // −.5 … +.5 of a semitone
    tx += rms * Math.cos(2 * Math.PI * frac);        // circular, so ±.5 meets
    ty += rms * Math.sin(2 * Math.PI * frac);

    // Only a note that is still there next time is counted. Every window that
    // straddles the join between two notes reads something that is neither of
    // them, and there are enough of those to sway a profile. A note being held
    // reads within a fifth of a tone of itself one frame later.
    if (Math.abs(midi - lastMidi) < 0.4) sung.push(midi, rms);
    lastMidi = midi;
  }

  const cents = Math.round(Math.atan2(ty, tx) / (2 * Math.PI) * 100);

  // Only now can the notes be named, and the order matters.
  //
  // Naming a note means rounding it to the nearest semitone, and a recording
  // that sits half a semitone off the piano rounds every note in it to the
  // one above. A tape running a little fast — which is most of them — was
  // therefore transcribed a semitone sharp throughout, and the drone with it.
  // The tuning has to be taken out of the reading before the reading is
  // rounded, which is why it is measured over the whole file first and the
  // profile built afterwards.
  const off = cents / 100;
  for (let i = 0; i < sung.length; i += 2) {
    const pc = ((Math.round(sung[i] - off) % 12) + 12) % 12;
    chroma[pc] += sung[i + 1];
    held.push(pc);
  }
  let tot = 0;
  for (let i = 0; i < 12; i++) tot += chroma[i];
  if (!tot) throw new Error('silence');
  for (let i = 0; i < 12; i++) chroma[i] /= tot;

  // What the players are given to play.
  //
  // Not a key signature. Naming the key of unaccompanied liturgical singing
  // off a cassette is a harder problem than it sounds, and it came out wrong
  // here in more than half of a set of test melodies whose keys were known
  // for certain: C major and D dorian hold the same seven notes, B-flat minor
  // and C phrygian likewise, and no weighting reliably tells one rotation of
  // a scale from another. A drone on the wrong note is worse than no drone.
  //
  // So no key is named and nothing theoretical is imposed. What comes out of
  // the measurement is the set of notes this recording actually dwells on,
  // with the weight of each, and the players are given nothing else. They
  // cannot then sound a note the singer did not sing — which is the only
  // guarantee that matters here, and it holds whether or not a musicologist
  // would agree about what the mode ought to be called.
  //
  // The note held longest becomes the drone, preferring one whose own fifth
  // or fourth is also sung: a drone with its fifth under it sits still, and
  // one without it wanders.
  const rank = Array.from(chroma)
    .map((w, pc) => ({ pc, w }))
    .sort((a, b) => b.w - a.w);
  let root = rank[0].pc, bestS = -1;
  for (const c of rank.slice(0, 4)) {
    const sc = c.w + 0.45 * chroma[(c.pc + 7) % 12] + 0.2 * chroma[(c.pc + 5) % 12];
    if (sc > bestS) { bestS = sc; root = c.pc; }
  }

  // every note worth playing, as semitones above the drone
  const notes = rank.filter(c => c.w >= 0.04)
                    .map(c => ({ s: (c.pc - root + 12) % 12, w: c.w }))
                    .sort((a, b) => b.w - a.w);
  const has = x => notes.some(n => n.s === x);

  // and a name for it, offered as a description and used for nothing else
  let named = null;
  for (const m of BAND_MODES) {
    let hit = 0;
    for (const n of notes) if (m.s.includes(n.s)) hit += n.w;
    if (!named || hit > named.hit) named = { hit, mode: m };
  }

  // The pulse, taken from where the loudness rises: the median gap between
  // the rises is the beat. Where the rises are not regular the piece has no
  // metre worth the name — which for most of this archive is the true answer
  // — and the players then move by the breath, as the singing does.
  const gaps = [];
  let mean = 0, lastAt = -1, quietUntil = -9;
  for (let i = 1; i < energy.length; i++) {
    const rise = Math.max(0, energy[i] - energy[i - 1]);
    mean = mean * 0.9 + rise * 0.1;
    // an onset is where the loudness CLIMBS, not where it is high: a note
    // held for two seconds sits above any mean for its whole length and
    // would otherwise be counted once and then never again
    if (rise > mean * 2.2 && rise > 0.003 && i > quietUntil) {
      if (lastAt >= 0) gaps.push((i - lastAt) * EHOP / RATE);
      lastAt = i; quietUntil = i + 1;
    }
  }
  gaps.sort((a, b) => a - b);
  const med = gaps.length >= 8 ? gaps[gaps.length >> 1] : 0;

  let mean2 = 0;
  for (let i = 0; i < energy.length; i++) mean2 += energy[i];
  mean2 = energy.length ? mean2 / energy.length : 0;

  return {
    cents, root, notes, mode: named.mode,
    // the drone: the note itself, with its fifth under it where the singing
    // has one, and its fourth where it has that instead
    drone: has(7) ? [0, 7] : has(5) ? [0, 5] : [0],
    chroma: Array.from(chroma),
    beat: (med > 0.28 && med < 1.6) ? med : 0,
    dur: audio.duration,
    hz: RATE / EHOP,                             // energy readings per second
    energy: Float32Array.from(energy),
    quiet: mean2 * 0.22,                         // under this, nobody is singing
  };
}

/* ---- the instruments.
 * Four of them, and each is a shape rather than a sample: at this level,
 * behind a voice, the attack and the decay carry far more of what an ear
 * calls "a violin" than the exact spectrum does. Every frequency is worked
 * out from the recording's own tuning, never from A=440.
 */
function bandHz(A, semis) {                 // the note in the octave above middle C
  return 440 * Math.pow(2, (A.root + semis - 9) / 12 + A.cents / 1200);
}

function bandVoice(kind, hz, at, len, vol) {
  const ctx = MIX.ctx, n = BAND.nodes;
  if (!ctx || !n || !isFinite(hz) || hz <= 0) return;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(n.bus);
  const parts = [];

  if (kind === 'organ') {
    // drawbars: the fundamental, its octave, its twelfth. Nothing sharper, or
    // the drone starts competing with the words.
    [[1, 1], [2, 0.42], [3, 0.17], [4, 0.07]].forEach(([mul, amp]) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = hz * mul;
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g); parts.push(o);
    });
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 1.4);          // it breathes in
    g.gain.setValueAtTime(vol, at + Math.max(1.5, len - 1.3));
    g.gain.linearRampToValueAtTime(0, at + len);
  } else if (kind === 'violin') {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.6;
    lp.connect(g);
    [-6, 6].forEach(det => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = 0.5;
      o.connect(og); og.connect(lp); parts.push(o);
    });
    // vibrato, and late: a player does not start one on the attack
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.4;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, at);
    lg.gain.linearRampToValueAtTime(7, at + Math.min(0.6, len * 0.5));
    lfo.connect(lg);
    parts.slice().forEach(o => lg.connect(o.detune));
    parts.push(lfo);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.3);          // drawn, not struck
    g.gain.setValueAtTime(vol, at + Math.max(0.35, len - 0.5));
    g.gain.linearRampToValueAtTime(0, at + len);
  } else if (kind === 'guitar') {
    // a plucked string: bright for an instant, then only the fundamental left
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(7000, hz * 7), at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(160, hz * 1.6), at + 0.5);
    lp.connect(g);
    [['triangle', 0.7, 0], ['sawtooth', 0.3, 4]].forEach(([t, amp, det]) => {
      const o = ctx.createOscillator(); o.type = t;
      o.frequency.value = hz; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(lp); parts.push(o);
    });
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.006);        // struck
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, vol * 0.02), at + len);
    g.gain.linearRampToValueAtTime(0, at + len + 0.05);
  } else {                                                  // flute
    [[1, 0.85], [2, 0.1]].forEach(([mul, amp]) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = hz * mul;
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g); parts.push(o);
    });
    // the breath across the mouthpiece, without which it is only a sine
    const nz = ctx.createBufferSource();
    nz.buffer = n.noise; nz.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = hz * 2.2; bp.Q.value = 1.4;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    nz.connect(bp); bp.connect(ng); ng.connect(g); parts.push(nz);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.14);
    g.gain.setValueAtTime(vol, at + Math.max(0.2, len - 0.3));
    g.gain.linearRampToValueAtTime(0, at + len);
  }

  const end = at + len + 0.4;
  parts.forEach(o => { try { o.start(at); o.stop(end); } catch (e) {} });
  setTimeout(() => { try { g.disconnect(); } catch (e) {} },
             Math.max(0, (end - ctx.currentTime) * 1000) + 500);
}

/* ---- where the players stand.
 * One bus for all four, and two things are done to it and nothing else: it
 * is rolled off above two kilohertz, and it is sent into a room. Both are
 * for the same purpose — to put the players behind the singer rather than
 * beside them. A bright, dry accompaniment at this volume still pulls the
 * ear forward; a dull, distant one at the same volume does not.
 */
function bandBuild() {
  const ctx = MIX.ctx;
  if (!ctx) return null;
  const bus = ctx.createGain(); bus.gain.value = 0;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.5;
  const hp = ctx.createBiquadFilter();       // keep out of the singer's chest
  hp.type = 'highpass'; hp.frequency.value = 55;

  // a room, made rather than recorded: noise decaying over two and a half
  // seconds, which is what a stone hall does to a held note
  const len = Math.floor(ctx.sampleRate * 2.5);
  const imp = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = imp.getChannelData(c);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const verb = ctx.createConvolver(); verb.buffer = imp;
  const wet = ctx.createGain(); wet.gain.value = 0.5;
  const dry = ctx.createGain(); dry.gain.value = 0.75;

  // one second of noise, borrowed by the flute for its breath
  const nlen = Math.floor(ctx.sampleRate);
  const noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;

  bus.connect(hp); hp.connect(lp);
  lp.connect(dry); dry.connect(ctx.destination);
  lp.connect(verb); verb.connect(wet); wet.connect(ctx.destination);
  return { bus, lp, hp, verb, wet, dry, noise };
}

/* The notes the guitar may hold together.
 *
 * A drone is safe with anything in its own mode; a chord is not. So the chord
 * is not built by stacking thirds up a scale — there is no scale here — but by
 * taking the notes the singing itself leans on and keeping only those that
 * are consonant with the drone. A second or a tritone is a fine thing to sing
 * over a drone in passing and a poor thing to hold underneath one, and that
 * distinction is the whole of this function.
 */
const BAND_CONSONANT = [3, 4, 5, 7, 8, 9, 12];

function bandVoicing(A) {
  const out = [0];
  for (const n of A.notes) {
    if (out.length >= 3) break;
    if (n.s && BAND_CONSONANT.includes(n.s) && !out.includes(n.s)) out.push(n.s);
  }
  // Nothing consonant to hold? Then hold nothing. The guitar takes the drone
  // note an octave up instead of a fifth nobody sang. Several recordings in
  // this archive lean on four notes only — a second, a seventh and the note
  // itself — and supplying them a fifth because chords usually have one is
  // exactly the invention this design exists to prevent. Checked: three of
  // six recordings tested had no fifth in them at all.
  if (out.length < 2) out.push(12);
  return out.sort((a, b) => a - b);
}

/* ---- the scheduler.
 * Web Audio is told about a note before it is due and plays it exactly on
 * time; a timer that tried to play notes at the moment they fall would
 * stutter every time the page did anything else. So a bar at a time is
 * written a little ahead of the needle, and the needle is the recording's
 * own clock — which is what makes the players stop when it is paused and
 * pick the piece up again where it was left.
 */
const BAND_AHEAD = 0.7;

function bandTick() {
  const ctx = MIX.ctx, A = BAND.an, n = BAND.nodes;
  if (!BAND.on || !ctx || !A || !n) return;

  // the players wait while the tape does
  if (au.paused) { BAND.next = Math.max(BAND.next, ctx.currentTime); return; }

  // and they drop back while the voice is up, so the words stay in front
  const lev = vuLevel();
  n.bus.gain.setTargetAtTime(BAND.vol * (1 - 0.5 * Math.min(1, lev * 2.2)),
                             ctx.currentTime, 0.25);

  const beat = A.beat || 0.9;
  const bar  = beat * 4;
  if (BAND.next < ctx.currentTime) BAND.next = ctx.currentTime + 0.06;

  while (BAND.next < ctx.currentTime + BAND_AHEAD) {
    const at = BAND.next;
    const step = BAND.step++;
    // where the recording will be when this bar sounds, and whether anyone
    // is singing there — the players rest through the silences
    const when = au.currentTime + (at - ctx.currentTime);
    const e = A.energy[Math.floor(when * A.hz)];
    const resting = e !== undefined && e < A.quiet;

    if (!resting) {
      const f = x => bandHz(A, x);
      const ch = BAND.voicing;

      // the organ holds the drone and never leaves it, in four-bar lengths
      // that overlap so it is one unbroken sound and not a pulse
      if (step % 4 === 0) {
        A.drone.forEach((sm, i) =>
          bandVoice('organ', f(sm) / 4, at, bar * 4 + 1.3, i ? 0.17 : 0.30));
        bandVoice('organ', f(A.drone[0]) / 2, at, bar * 4 + 1.3, 0.13);
      }

      // the guitar picks the chord out, four to the bar, and off the beat on
      // the third of them so that it does not march
      [[0, 0], [1.5, 1], [2.5, 2 % ch.length], [3.5, 1]].forEach(([b, i]) => {
        bandVoice('guitar', f(ch[i % ch.length]) / 2, at + b * beat,
                  Math.max(0.7, beat * 1.6), 0.20);
      });

      // The violin takes one of the notes the singing leans on and holds it,
      // moving by the smallest step it can find from the note it held before.
      // Which note is drawn from the recording's own weights, so the line
      // dwells where the singing dwells.
      const pool = A.notes.slice(0, 5).map(n => n.s);
      let pick = pool[0], near = 99;
      for (const c of pool) {
        const d = Math.abs(c - BAND.lastV) + (BAND.rnd() < 0.35 ? 3 : 0);
        if (d < near && c !== BAND.lastV) { near = d; pick = c; }
      }
      BAND.lastV = pick;
      bandVoice('violin', f(pick), at + beat * 0.25, bar * 0.8, 0.115);

      // and the flute answers at the close of every fourth bar, falling to
      // the drone — the one place anything here is allowed to be a phrase
      if (step % 4 === 3) {
        const above = A.notes.map(n => n.s).filter(x => x > 2).sort((a, b) => a - b);
        const fall = [above[Math.min(2, above.length - 1)], above[0], 0]
          .filter(x => x !== undefined);
        fall.forEach((sm, i) =>
          bandVoice('flute', f(sm) * 2, at + beat * (2.2 + i * 0.55),
                    beat * 0.6, 0.085));
      }
    }
    BAND.next += bar;
  }
}

/* the loudness of the singing at this instant, read from the meter the
   player already keeps — the band ducks under it */
function vuLevel() {
  const n = MIX.nodes;
  if (!n || !n.an) return 0;
  const buf = new Uint8Array(n.an.fftSize);
  n.an.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/* ---- the button */
function bandKey() { return cur.rec + ':' + cur.idx; }

function bandPaint(state) {
  const b = $('bandState');
  if (!b) return;
  b.classList.toggle('off', state === 'off');
  b.classList.toggle('busy', state === 'busy');
  b.textContent = state === 'busy' ? 'מלחין…'
                : state === 'on'   ? 'נגנים'
                : 'הוסף נגנים';
  b.title = state === 'on' && BAND.an
    ? `ליווי על ${PC_NAME[BAND.an.root]}, מן הצלילים שההקלטה עצמה נשענת עליהם` +
      (BAND.an.cents
        ? `, מכוון ${BAND.an.cents > 0 ? '+' : ''}${BAND.an.cents} סנט אל ההקלטה`
        : '') +
      ' — לחיצה משתיקה את הנגנים'
    : 'הלחנת ליווי לפיוט המושמע — כינור, גיטרה, אורגנית וחליל, עמומים ברקע';
}

function bandStop(quiet) {
  BAND.on = false;
  clearInterval(BAND.timer); BAND.timer = 0;
  if (BAND.nodes && MIX.ctx) {
    // let the held notes die away rather than cutting them off
    BAND.nodes.bus.gain.setTargetAtTime(0, MIX.ctx.currentTime, 0.35);
  }
  bandPaint('off');
  if (!quiet) toast('הנגנים הושתקו');
}

/* a different recording is a different key, a different mode and a different
   tuning, so the players are dismissed and must be asked for again */
function bandDrop() {
  if (BAND.on) bandStop(true);
  BAND.an = null; BAND.forKey = '';
  bandPaint('off');
}

async function bandGo() {
  if (BAND.busy) return;
  if (BAND.on) return bandStop();
  if (!cur.rec) return toast('אין הקלטה מושמעת', 1);
  if (!mixInit()) return toast('הדפדפן אינו מאפשר עיבוד קול', 1);
  if (MIX.ctx.state === 'suspended') await MIX.ctx.resume();

  // already listened to this one: the players can start at once
  if (BAND.an && BAND.forKey === bandKey()) return bandPlay();
  const cached = BAND.cache[bandKey()];
  if (cached) { BAND.an = cached; BAND.forKey = bandKey(); return bandPlay(); }

  // Otherwise it has to be listened to first, and that cannot be done while
  // it is playing: the measurement runs over the whole file at once. So the
  // tape stops, as the user asked for, and starts again with the players.
  const wasPlaying = !au.paused;
  au.pause();
  BAND.busy = true;
  bandPaint('busy');
  loadSay('load', 'מאזין לפיוט ומלחין ליווי…', 0);
  try {
    const src = LOAD.blob || audioURL(byId(C.recordings, cur.rec).tr[cur.idx].f);
    const bytes = await (await fetch(src)).arrayBuffer();
    // let the browser paint "מלחין…" before the analysis blocks the thread
    await new Promise(r => setTimeout(r, 30));
    const A = await bandAnalyse(bytes);
    BAND.an = A; BAND.forKey = bandKey(); BAND.cache[bandKey()] = A;
    BAND.busy = false;
    loadHide();
    toast(`ליווי על ${PC_NAME[A.root]} · ${A.notes.length} צלילים מן ההקלטה` +
          (A.cents ? ` · מכוון ${A.cents > 0 ? '+' : ''}${A.cents} סנט` : ''));
    if (wasPlaying) au.play().catch(() => {});
    bandPlay();
  } catch (e) {
    BAND.busy = false;
    bandPaint('off');
    loadHide();
    if (wasPlaying) au.play().catch(() => {});
    toast('לא הצלחתי להאזין להקלטה כדי להלחין לה ליווי', 1);
  }
}

function bandPlay() {
  if (!BAND.an || !MIX.ctx) return;
  if (!BAND.nodes) BAND.nodes = bandBuild();
  if (!BAND.nodes) return;
  BAND.on = true;
  BAND.vol = 0.13;
  BAND.step = 0;
  BAND.voicing = bandVoicing(BAND.an);
  BAND.lastV = BAND.voicing[BAND.voicing.length - 1];
  // the same recording is accompanied the same way every time it is played,
  // as the dancer dances it the same way, and for the same reason
  BAND.rnd = dncSeed('band' + bandKey());
  BAND.next = MIX.ctx.currentTime + 0.12;
  BAND.nodes.bus.gain.setTargetAtTime(BAND.vol, MIX.ctx.currentTime, 0.6);
  clearInterval(BAND.timer);
  BAND.timer = setInterval(bandTick, 120);
  bandPaint('on');
}

$('bandState').onclick = bandGo;

/* the three ready-made settings, chosen with the mode knob. The order is
   MIX_IDS: bass · mid · mid-frequency · treble · rumble · hiss · levelling ·
   gate · gain */
const MODES = ['mFlat', 'mVoice', 'mTape'];
const PRESET = {
  mFlat:  { v: [0, 0, 1100, 0, 0, 20000, 0, 0, 100],   note: 'ללא עיבוד' },
  mVoice: { v: [-3, 4, 1600, 2, 90, 20000, 14, 0, 115], note: 'הדגשת הדיבור והחזנות' },
  mTape:  { v: [2, 1, 900, -4, 70, 7000, 20, 22, 125],  note: 'ריכוך רעש סרט והחזרת גוף' },
};
MIX_IDS.forEach(id =>
  $(id).addEventListener('input', () => {
    mixApply(); $('mixNote').textContent = '';
  }));

/* A rotated range has to be told how long to be: its width becomes the slot's
   height once it is stood upright. offsetHeight, not the bounding rect —
   the rect would include the opening animation's scale and give a short
   fader on any frame but the last. */
function sizeFaders() {
  document.querySelectorAll('.mx-track').forEach(t => {
    const input = t.querySelector('input');
    if (input) input.style.setProperty('--mxh', Math.max(46, t.offsetHeight - 4) + 'px');
  });
}

/* ------------------------------------------------ the processing keys
 * Three small banks in the desk's title strip. Echo is a real delay fed back
 * on itself. Pitch is a trim on the tape speed — which is exactly the fix an
 * old cassette needs when it was recorded on a machine running off-speed, and
 * unlike a pitch shifter it costs the recording nothing. Noise notches out
 * mains hum and the harmonic above it.
 */
const FX = { echo: 0, pitch: 0, denoise: false, limit: false, match: false };
const ECHO_WET = [0, .18, .34, .5];         // off · רך · בינוני · אולם
const PITCH_STEP = 0.03;                    // 3% a step — about half a tone

function fxApply() {
  const n = mixInit();
  if (n) {
    n.wet.gain.value = ECHO_WET[FX.echo] || 0;
    n.fb.gain.value  = FX.echo >= 3 ? .42 : .3;
    // bypassed the same way as the restoration notches: narrowed to nothing
    // and parked above hearing, never by lowering Q
    n.hum1.frequency.value = FX.denoise ? 50  : 21000;
    n.hum2.frequency.value = FX.denoise ? 100 : 21000;
    n.hum1.Q.value = n.hum2.Q.value = FX.denoise ? 24 : 1000;
    // ratio 1 is a compressor doing nothing; 20 to 1 at −2 dB is a ceiling
    n.lim.threshold.value = FX.limit ? -2 : 0;
    n.lim.ratio.value     = FX.limit ? 20 : 1;
    if (!FX.match) n.match.gain.value = 1;     // hand it straight back
  }
  // the pitch trim rides on top of whatever the speed slider is set to
  setRate($('prate').value);

  paintKnobs();

  // the note reads out everything at once, so a knob never wipes what another
  // knob just said
  const bits = [];
  if (FX.mode && FX.mode !== 'mFlat') bits.push(PRESET[FX.mode].note);
  if (FX.echo)  bits.push(['', 'הד רך', 'הד בינוני', 'הד אולם'][FX.echo]);
  if (FX.pitch) bits.push('גובה ' + (FX.pitch > 0 ? '+' : '') +
                          Math.round(FX.pitch * PITCH_STEP * 100) + '%');
  if (FX.denoise) bits.push('ניקוי המהום');
  $('mixNote').textContent = bits.join(' · ');
  localStorage.setItem('shira_fx', JSON.stringify(FX));
  paintMixState();
}

/* --------------------------------------------------------- the knobs
 * Three rotary knobs and a lever, on their own plate. Each knob has a fixed
 * set of detents; it sweeps 270° across them, a click steps to the next, and
 * dragging round it picks the detent nearest the finger.
 */
const KNOBS = {
  mode:  { el: 'knMode',  labels: ['שטוח', 'קול ברור', 'שיקום קלטת'] },
  echo:  { el: 'knEcho',  labels: ['כבוי', 'רך', 'בינוני', 'אולם'] },
  pitch: { el: 'knPitch', labels: ['−−', '−', 'רגיל', '+', '++'], base: -2 },
};
const SWEEP = 270;                        // degrees from first detent to last

function knobAngle(i, n) {
  return n < 2 ? 0 : -SWEEP / 2 + (SWEEP * i) / (n - 1);
}

/* the marks printed round each knob, one per detent */
Object.values(KNOBS).forEach(k => {
  const box = $(k.el).querySelector('.mx-kn-ticks');
  box.innerHTML = k.labels.map((_, i) =>
    `<i style="transform:rotate(${knobAngle(i, k.labels.length)}deg)"></i>`).join('');
});

/* which detent each knob is on, derived from the state it controls */
function knobIndex(fx) {
  if (fx === 'mode')  return Math.max(0, MODES.indexOf(FX.mode || 'mFlat'));
  if (fx === 'pitch') return FX.pitch - KNOBS.pitch.base;
  return FX.echo;
}

function knobSet(fx, i) {
  const k = KNOBS[fx];
  i = Math.max(0, Math.min(k.labels.length - 1, i));
  if (fx === 'mode') {
    FX.mode = MODES[i];
    mixSet(PRESET[FX.mode].v);
  } else if (fx === 'pitch') {
    FX.pitch = i + k.base;
  } else {
    FX.echo = i;
  }
  fxApply();
}

function paintKnobs() {
  Object.entries(KNOBS).forEach(([fx, k]) => {
    const el = $(k.el), i = knobIndex(fx), n = k.labels.length;
    el.querySelector('.mx-kn-body').style.transform = `rotate(${knobAngle(i, n)}deg)`;
    el.querySelector('.mx-kn-val').textContent = k.labels[i];
    el.querySelectorAll('.mx-kn-ticks i')
      .forEach((t, j) => t.classList.toggle('at', j === i));
    el.setAttribute('aria-valuenow', i);
    el.setAttribute('aria-valuetext', k.labels[i]);
  });
  const lever = (box, on, yes) => {
    $(box).querySelector('.mx-swb').setAttribute('aria-checked', on ? 'true' : 'false');
    $(box).querySelector('.mx-kn-val').textContent = on ? yes : 'כבוי';
  };
  lever('knNoise', FX.denoise, 'נקה');
  lever('knLimit', FX.limit,   'פועל');
  lever('knMatch', FX.match,   'פועל');
}

Object.entries(KNOBS).forEach(([fx, k]) => {
  const el = $(k.el);
  let drag = null;
  el.addEventListener('pointerdown', e => {
    const r = el.querySelector('.mx-kn-ring').getBoundingClientRect();
    drag = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, moved: false };
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.cx, dy = e.clientY - drag.cy;
    if (Math.hypot(dx, dy) < 6) return;               // too near the spindle
    drag.moved = true;
    // 0° is straight up; the sweep runs symmetrically either side of it
    let a = Math.atan2(dx, -dy) * 180 / Math.PI;
    a = Math.max(-SWEEP / 2, Math.min(SWEEP / 2, a));
    const n = k.labels.length;
    knobSet(fx, Math.round(((a + SWEEP / 2) / SWEEP) * (n - 1)));
  });
  const end = () => {
    if (drag && !drag.moved) knobSet(fx, (knobIndex(fx) + 1) % k.labels.length);
    drag = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { drag = null; });
  el.addEventListener('keydown', e => {
    const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1
            : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { e.preventDefault(); knobSet(fx, knobIndex(fx) + d); }
  });
});

[['knNoise', 'denoise'], ['knLimit', 'limit'], ['knMatch', 'match']].forEach(
  ([box, key]) => {
    $(box).querySelector('.mx-swb').onclick = () => { FX[key] = !FX[key]; fxApply(); };
  });

/* ------------------------------------------------ the gate and the matcher
 * Neither exists as a node, so both are driven from the frame loop off the
 * analyser that sits before them.
 *
 * The gate closes when the signal falls under its threshold — the tape hiss
 * between phrases — and opens fast when singing returns, so nothing is
 * clipped off the front of a word. The matcher watches the loudest moment it
 * has heard in this recording and trims the level so every cassette, however
 * hot or timid it was recorded, arrives at about the same place.
 */
const gateBuf = new Uint8Array(1024);
let gateOpen = 1, matchPeak = 0;

function levelTick() {
  const n = MIX.nodes;
  if (!n || au.paused) return;
  n.pre.getByteTimeDomainData(gateBuf);
  let sum = 0, peak = 0;
  for (let i = 0; i < gateBuf.length; i++) {
    const d = (gateBuf[i] - 128) / 128;
    sum += d * d;
    if (Math.abs(d) > peak) peak = Math.abs(d);
  }
  const rms = Math.sqrt(sum / gateBuf.length);

  const thrDb = +$('mGate').value;                   // 0 = off
  if (thrDb > 0) {
    const thr = Math.pow(10, -thrDb / 20);
    const want = rms > thr ? 1 : 0;
    // open almost at once, close gently, so it never chatters on a held note
    gateOpen += (want - gateOpen) * (want ? 0.55 : 0.06);
    n.gate.gain.value = gateOpen;
  } else if (gateOpen !== 1) {
    gateOpen = 1; n.gate.gain.value = 1;
  }

  if (FX.match) {
    matchPeak = Math.max(peak, matchPeak * 0.9995);  // slow decay, so it adapts
    if (matchPeak > 0.02) {
      const want = Math.min(3, 0.7 / matchPeak);
      n.match.gain.value += (want - n.match.gain.value) * 0.05;
    }
  }
}
// a new recording starts the matcher's memory again
au.addEventListener('loadstart', () => { matchPeak = 0; });

/* One sprung lever puts everything back: the faders flat and every effect
 * out. It flies up on the press and drops again on its own, the way a
 * momentary switch does. */
$('mixReset').onclick = () => {
  const sw = $('mixReset');
  sw.classList.add('fired');
  setTimeout(() => sw.classList.remove('fired'), 190);
  FX.echo = 0; FX.pitch = 0; FX.mode = 'mFlat';
  FX.denoise = FX.limit = FX.match = false;
  matchPeak = 0;                    // the matcher forgets what it had learnt
  mixSet(PRESET.mFlat.v);
  fxApply();
  $('mixNote').textContent = 'הכול אופס';
};

try {
  Object.assign(FX, JSON.parse(localStorage.getItem('shira_fx') || '{}'));
} catch (e) {}
// whatever was carried over from last time, say so before anything is touched
paintMixState();
restoreApply();

let mixShut = 0;
function mixOpen(on) {
  const m = $('mixer');
  clearTimeout(mixShut);
  $('mixToggle').classList.toggle('on', on);
  if (on) {
    m.classList.remove('closing', 'hidden');
    mixApply(); fxApply(); sizeFaders();
    return;
  }
  if (m.classList.contains('hidden')) return;
  // it folds back into the small plate rather than blinking out
  m.classList.add('closing');
  // a timer, not animationend: a tab that is not painting never fires that
  mixShut = setTimeout(() => m.classList.add('hidden') || m.classList.remove('closing'), 210);
}
$('mixToggle').onclick = () => mixOpen($('mixer').classList.contains('hidden'));
$('mixMin').onclick    = () => mixOpen(false);

/* A wheel over the desk turns whatever is under the pointer, and moves
 * nothing else. CSS alone cannot say this — overscroll-behavior only stops
 * the chain once a scrollable box has hit its end, and the mixer has no
 * scrollable box at all, so the wheel went straight past it to the archive
 * behind. Taken here instead, and not passed on. */
$('mixer').addEventListener('wheel', e => {
  const kn = e.target.closest && e.target.closest('.mx-kn[data-fx]');
  if (kn) {                        // a wheel on a knob turns the knob
    e.preventDefault();
    const fx = kn.dataset.fx;
    if (KNOBS[fx]) knobSet(fx, knobIndex(fx) + (e.deltaY < 0 ? 1 : -1));
    return;
  }
  const r = e.target.closest && e.target.closest('input[type=range]');
  if (r) {                         // and on a fader, moves the fader
    e.preventDefault();
    const step = Number(r.step) || 1;
    const to = Number(r.value) + (e.deltaY < 0 ? step : -step);
    r.value = Math.max(Number(r.min), Math.min(Number(r.max), to));
    r.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  e.preventDefault();              // anywhere else on the panel: nothing moves
}, { passive: false });
addEventListener('resize', () => {
  if (!$('mixer').classList.contains('hidden')) sizeFaders();
});

/* --------------------------------------------------------------- VU lamps */
const LAMPS = 14;
(function buildVU() {
  $('vu').innerHTML = Array.from({ length: LAMPS }, (_, i) =>
    `<i class="${i < LAMPS * 0.62 ? 'g' : i < LAMPS * 0.85 ? 'y' : 'r'}"></i>`).join('');
})();
const vuBuf = new Uint8Array(1024);
let vuPeak = 0;                  // the loudest this recording has been so far

function vuTick() {
  const lamps = $('vu').children;
  let lit = 0, vuRms = 0;
  // while the machine records, the lamps follow the microphone; otherwise
  // they follow what is playing
  const an = REC.an || (MIX.nodes && !au.paused ? MIX.nodes.an : null);
  if (an) {
    an.getByteTimeDomainData(vuBuf);
    let sum = 0;
    for (let i = 0; i < vuBuf.length; i++) {
      const d = (vuBuf[i] - 128) / 128;
      sum += d * d;
    }
    vuRms = Math.sqrt(sum / vuBuf.length);
    // The lamps on a fixed scale, as they were — but these are old tapes, and
    // on the quiet ones that scale never lit a single lamp. So the piece's own
    // loudest moment lights the meter too, and whichever reading is higher
    // wins: a loud recording behaves exactly as it did, a quiet one now has a
    // meter that moves instead of one that sits dark.
    vuPeak = Math.max(vuRms, vuPeak * 0.9995);
    const fixed = vuRms * (REC.an ? 5.5 : 3.2);
    const rel = vuPeak > 0.0015 ? (vuRms / vuPeak) * 0.85 : 0;
    lit = Math.round(Math.min(1, Math.max(fixed, rel)) * LAMPS);
  } else {
    vuRms = 0;
  }
  for (let i = 0; i < lamps.length; i++) lamps[i].classList.toggle('on', i < lit);
  // She dances to this particular piece, not to a metronome — and the same
  // listening is what tells her when the singing has stopped and started.
  //
  // What she is given is the loudness itself and not the number of lamps
  // alight. The lamps are a rounded count from nought to fourteen, and these
  // recordings are quiet enough that the count is nought most of the time —
  // which she read as silence, stood still, and never started again, because
  // starting again wanted a level ten times what the tape was giving.
  if (DNC.at === 'dance' || DNC.at === 'rest') dncListen(an, vuRms);
  levelTick();                        // the gate and the matcher ride this loop
  requestAnimationFrame(vuTick);
}
requestAnimationFrame(vuTick);

/* ------------------------------------------------------- keep the screen on
 * A phone that sleeps mid-piyyut also stops the playlist on some devices.
 * The lock is dropped as soon as playback stops, and re-taken if the user
 * comes back to the tab while it is still playing.
 */
let wakeLock = null;
async function keepAwake(on) {
  if (!('wakeLock' in navigator)) return;          // unsupported: nothing to do
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { wakeLock = null; }                 // denied or not allowed here
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !au.paused) keepAwake(true);
});

/* ------------------------------------------- the player, once the app is left
 *
 * Leaving the app is not leaving the recording. The tape goes on playing, and
 * the system's own media controls carry it from there: what is playing, who
 * is singing, how far in it is — and, the part that was asked for, a way to
 * stop it from the notification without opening the app again and having to
 * find one's place a second time.
 *
 * Two things are needed for that and neither is the obvious one. The controls
 * have to be registered before they can appear at all, which is the media
 * session below. And the sound has to survive being in the background: the
 * recording is routed through Web Audio for the mixer, and a suspended audio
 * context silences it while the element itself goes on reporting that it is
 * playing perfectly happily. So the context is woken whenever it drops.
 */
function mediaSay(r, idx) {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  r.ttl + (r.tr.length > 1 ? ` · רצועה ${idx + 1}/${r.tr.length}` : ''),
      artist: perfName(r.p) || 'לא ידוע',
      album:  eventName(r.e) || 'אוצר השירה השומרונית',
      artwork: [96, 192, 256, 512].map(s => ({
        src: 'img/gramophone.png', sizes: `${s}x${s}`, type: 'image/png' })),
    });
  } catch (e) { /* an older engine: the controls simply stay plain */ }
}

/* how far in it is, so the notification can show a scrubber that means
   something rather than a bar that never moves */
function mediaPos() {
  const ms = navigator.mediaSession;
  if (!ms || !ms.setPositionState) return;
  if (!isFinite(au.duration) || au.duration <= 0) return;
  try {
    ms.setPositionState({
      duration: au.duration,
      playbackRate: au.playbackRate > 0 ? au.playbackRate : 1,
      position: Math.max(0, Math.min(au.currentTime, au.duration)),
    });
  } catch (e) {}
}

function mediaWire() {
  const ms = navigator.mediaSession;
  if (!ms || !ms.setActionHandler) return;
  const on = (a, fn) => { try { ms.setActionHandler(a, fn); } catch (e) {} };
  on('play',  () => { au.play().catch(() => {}); syncBtn(); });
  on('pause', () => { au.pause(); syncBtn(); });
  on('previoustrack', () => step(-1));
  on('nexttrack',     () => step(1));
  // the one the request was really about: it ends the whole thing from
  // outside, players and all, and leaves nothing running behind the app
  on('stop', () => {
    au.pause();
    bandStop(true);
    stopAudio();
    spoolStop(false);
    syncBtn();
    ms.playbackState = 'none';
    try { ms.metadata = null; } catch (e) {}
  });
  on('seekbackward', d => {
    au.currentTime = Math.max(0, au.currentTime - ((d && d.seekOffset) || 10));
  });
  on('seekforward', d => {
    au.currentTime = Math.min(au.duration || 1e9,
                              au.currentTime + ((d && d.seekOffset) || 10));
  });
  on('seekto', d => {
    if (!d || !isFinite(d.seekTime)) return;
    if (d.fastSeek && au.fastSeek) au.fastSeek(d.seekTime);
    else au.currentTime = d.seekTime;
    mediaPos();
  });
}
mediaWire();

/* The audio context is what actually carries the sound, and a backgrounded
   page is allowed to suspend it. When that happens the element goes on
   saying it is playing and nothing comes out — so it is woken again, both
   when it drops and when the app is returned to. */
function mixWake() {
  if (MIX.ctx && MIX.ctx.state === 'suspended' && !au.paused)
    MIX.ctx.resume().catch(() => {});
}
au.addEventListener('play', () => {
  mixWake();
  if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
  mediaPos();
});
au.addEventListener('pause', () => {
  if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused';
});
au.addEventListener('durationchange', mediaPos);
au.addEventListener('ratechange', mediaPos);
document.addEventListener('visibilitychange', mixWake);
setInterval(mixWake, 4000);

/* A seek plays the matching tape noise: which way the tape ran decides it. */
let seekFrom = 0, switching = false;
au.addEventListener('seeking', () => {
  if (switching) return;                      // a track change, not a wind
  const d = au.currentTime - seekFrom;
  if (Math.abs(d) < 1.2) return;              // a nudge is not a wind
  sfxStop(d < 0 ? 'forward' : 'rewind');
  sfx(d < 0 ? 'rewind' : 'forward');
});
let mediaAt = 0;
au.addEventListener('timeupdate', () => {
  seekFrom = au.currentTime;
  // the notification only needs this about once a second, not four times
  if (Date.now() - mediaAt > 1000) { mediaAt = Date.now(); mediaPos(); }
});
$('pnext').onclick  = () => step(1);
$('pprev').onclick  = () => step(-1);
/* When a track ends, continue seamlessly inside the recording. Only when the
 * whole recording is done does a queue or shuffle move on to the next one —
 * a multi-track recording counts as one item, never as several. */
au.onended = () => {
  if (step(1, true)) return;             // still inside this recording
  if (PL.playing) return queueNext();
  if (SHUFFLE.on)       return shuffleNext();
};

/* ------------------------------------------------------- רצף אקראי */
const SHUFFLE = { on: false, played: [] };

function shuffleNext() {
  const pool = C.recordings.filter(r => r.s > 20 && !r.hidden);
  if (!pool.length) return;
  if (SHUFFLE.played.length > pool.length * 0.8) SHUFFLE.played = [];
  let pick, guard = 0;
  do { pick = pool[Math.floor(Math.random() * pool.length)]; }
  while (SHUFFLE.played.includes(pick.id) && guard++ < 60);
  SHUFFLE.played.push(pick.id);
  playRec(pick.id, 0);
  toast(`מנגן: ${pick.ttl} · ${perfName(pick.p)}`);
}

function setShuffle(on) {
  SHUFFLE.on = on;
  if (on) { PL.playing = null; PL.pos = -1; }   // one source of order at a time
  $('shuffleBtn').classList.toggle('on', on);
  $('shuffleBtn').title = on ? 'עצור את הרצף האקראי' : 'השמעה אקראית ורציפה';
  drawQueue();
}
$('shuffleBtn').onclick = () => {
  const on = !SHUFFLE.on;
  setShuffle(on);
  if (on) shuffleNext();
};

/* ------------------------------------------------- רשימות השמעה
 * Named playlists, kept in this browser only — nothing is sent anywhere, which
 * is what the dialog tells the user before the first one is created.
 */
const PL = {
  lists: [],            // [{id, name, items:[recId…], made}]
  playing: null,        // id of the list currently running
  order: [],            // playback order (shuffled or straight)
  pos: -1,
  shuffle: false,
  repeat: 'off',        // off | one | all
  open: null,           // id of the list shown in the window
  pending: null,        // a recording waiting for a list to be chosen
};

function plLoad() {
  try { PL.lists = JSON.parse(localStorage.getItem('shira_playlists') || '[]'); }
  catch (e) { PL.lists = []; }
  // carry over the single list made by the earlier version
  const old = JSON.parse(localStorage.getItem('shira_queue') || '[]');
  if (old.length && !PL.lists.length) {
    PL.lists = [{ id: 1, name: 'הרשימה שלי', items: old, made: '' }];
    plSave();
  }
  localStorage.removeItem('shira_queue');
}
function plSave() {
  localStorage.setItem('shira_playlists', JSON.stringify(PL.lists));
  drawQueue();
}
const plById = id => PL.lists.find(l => l.id === id);
const inQueue = id => PL.lists.some(l => l.items.includes(id));

/* ------------------------------------------------------ adding a recording
 * The ♪+ button drops a small menu of the existing lists next to itself.
 * Picking one adds (or removes) the recording there and then; ＋ opens the
 * naming dialog. With no lists yet there is nothing to pick, so the dialog
 * opens straight away.
 */
function toggleQueue(recId, anchor) {
  PL.pending = recId;
  if (!PL.lists.length) return newListDialog();

  const menu = $('plMenu');
  $('plMenuList').innerHTML = PL.lists.map(l => {
    const has = l.items.includes(recId);
    return `<button data-pick="${l.id}" class="${has ? 'has' : ''}">
      <b>${esc(l.name)}</b>
      <span>${has ? '✓ ברשימה'
              : l.items.length === 0 ? 'ריקה'
              : l.items.length === 1 ? 'פריט אחד'
              : l.items.length + ' פריטים'}</span></button>`;
  }).join('');
  $('plMenuList').querySelectorAll('[data-pick]').forEach(b => {
    b.onclick = () => {
      const l = plById(+b.dataset.pick);
      const at = l.items.indexOf(PL.pending);
      if (at >= 0) { l.items.splice(at, 1); toast(`הוסר מ«${l.name}»`); }
      else         { l.items.push(PL.pending); toast(`נוסף ל«${l.name}»`); }
      plSave(); draw(); drawPl(); closeMenu();
    };
  });

  menu.classList.remove('hidden');
  // place it under the button, kept inside the window on both edges
  const r = (anchor || document.body).getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = r.left + scrollX;
  left = Math.max(8, Math.min(left, scrollX + innerWidth - mw - 8));
  let top = r.bottom + scrollY + 6;
  if (r.bottom + mh + 12 > innerHeight) top = r.top + scrollY - mh - 6;
  menu.style.left = left + 'px';
  menu.style.top  = Math.max(8, top) + 'px';
}

function closeMenu() { $('plMenu').classList.add('hidden'); }
document.addEventListener('click', e => {
  if (!$('plMenu').classList.contains('hidden') &&
      !e.target.closest('#plMenu') && !e.target.closest('[data-q]')) closeMenu();
}, true);
addEventListener('resize', closeMenu);
addEventListener('scroll', closeMenu, true);

function newListDialog() {
  closeMenu();
  $('plAddErr').classList.add('hidden');
  $('plNewName').value = '';
  $('plAddTitle').textContent = 'רשימת השמעה חדשה';
  $('plAddList').innerHTML = '';
  openModal('plAddModal');
  setTimeout(() => $('plNewName').focus(), 60);
}
$('plMenuNew').onclick = newListDialog;

$('plCreate').onclick = () => {
  const name = $('plNewName').value.trim();
  if (!name) {
    $('plAddErr').textContent = 'יש לתת שם לרשימה.';
    return $('plAddErr').classList.remove('hidden');
  }
  const l = { id: Date.now(), name, items: PL.pending ? [PL.pending] : [],
              made: new Date().toISOString().slice(0, 16).replace('T', ' ') };
  PL.lists.push(l);
  plSave(); draw(); closeModal('plAddModal');
  toast(`הרשימה «${name}» נוצרה ונשמרה במכשיר`);
};
$('plNewName').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('plCreate').click();
});

/* ------------------------------------------------------- the list of lists */
function drawQueue() {
  $('queueBtn').classList.toggle('hidden', !PL.lists.length);
  $('queueN').textContent = PL.lists.length;
  $('queueN').classList.toggle('hidden', !PL.lists.length);
  const body = $('queueBody');
  if (!body) return;
  body.innerHTML = PL.lists.length ? PL.lists.map(l => `
    <button class="pl-pick big" data-open="${l.id}">
      <b>${esc(l.name)}</b>
      <span>${l.items.length} הקלטות${l.made ? ' · נוצרה ' + esc(l.made) : ''}</span>
    </button>`).join('')
    : '<p class="news-empty">עדיין אין רשימות. סמן הקלטה בכפתור ♪+ כדי ליצור אחת.</p>';
  body.querySelectorAll('[data-open]').forEach(b =>
    b.onclick = () => { closeModal('queueModal'); openPl(+b.dataset.open); });
}
$('queueBtn').onclick = () => { drawQueue(); openModal('queueModal'); };

/* -------------------------------------------------------- one list's window */
function openPl(id) { PL.open = id; drawPl(); openModal('plModal'); }

function drawPl() {
  const l = plById(PL.open);
  if (!l) return;
  $('plName').textContent = l.name;
  $('plCount').textContent = `${l.items.length} הקלטות`;
  $('plShuffle').classList.toggle('on', PL.shuffle);
  $('plRepeat').textContent = PL.repeat === 'one' ? '🔂 חזרה על רצועה'
                            : PL.repeat === 'all' ? '🔁 חזרה על הרשימה'
                                                  : '🔁 ללא חזרה';
  $('plRepeat').classList.toggle('on', PL.repeat !== 'off');

  $('plBody').innerHTML = l.items.length ? l.items.map((id, i) => {
    const r = byId(C.recordings, id);
    if (!r) return '';
    const now = PL.playing === l.id && PL.order[PL.pos] === id;
    return `<div class="qrow${now ? ' on' : ''}">
      <button class="qplay" data-plplay="${i}" title="נגן מכאן">▶</button>
      <span class="qt"><b>${esc(r.ttl)}</b><br>
        <span class="s">${esc(perfName(r.p))} · ${esc(eventName(r.e))} · ${dur(r.s)}</span></span>
      <span class="qmove">
        <button data-up="${i}" title="הזז למעלה"${i ? '' : ' disabled'}>▲</button>
        <button data-down="${i}" title="הזז למטה"${i === l.items.length - 1 ? ' disabled' : ''}>▼</button>
      </span>
      <button class="qdel" data-pldel="${i}" title="הסר מהרשימה">✕</button>
    </div>`;
  }).join('') : '<p class="news-empty">הרשימה ריקה.</p>';

  const move = (from, to) => {
    if (to < 0 || to >= l.items.length) return;
    l.items.splice(to, 0, l.items.splice(from, 1)[0]);
    plSave(); drawPl();
  };
  $('plBody').querySelectorAll('[data-up]').forEach(b =>
    b.onclick = () => move(+b.dataset.up, +b.dataset.up - 1));
  $('plBody').querySelectorAll('[data-down]').forEach(b =>
    b.onclick = () => move(+b.dataset.down, +b.dataset.down + 1));
  $('plBody').querySelectorAll('[data-pldel]').forEach(b =>
    b.onclick = () => { l.items.splice(+b.dataset.pldel, 1); plSave(); draw(); drawPl(); });
  $('plBody').querySelectorAll('[data-plplay]').forEach(b =>
    b.onclick = () => playPl(l.id, +b.dataset.plplay));
}

$('plShuffle').onclick = () => { PL.shuffle = !PL.shuffle; drawPl();
  if (PL.playing === PL.open) plOrder(plById(PL.open)); };
$('plRepeat').onclick  = () => {
  PL.repeat = PL.repeat === 'off' ? 'all' : PL.repeat === 'all' ? 'one' : 'off';
  drawPl();
};
$('plPlay').onclick    = () => playPl(PL.open, 0);
$('plRename').onclick  = () => {
  const l = plById(PL.open); if (!l) return;
  const name = prompt('שם חדש לרשימה:', l.name);
  if (name && name.trim()) { l.name = name.trim(); plSave(); drawPl(); }
};
$('plDelete').onclick  = () => {
  const l = plById(PL.open); if (!l) return;
  if (!confirm(`למחוק את הרשימה «${l.name}»? ההקלטות עצמן לא ייפגעו.`)) return;
  PL.lists = PL.lists.filter(x => x.id !== l.id);
  if (PL.playing === l.id) PL.playing = null;
  plSave(); draw(); closeModal('plModal');
  toast('הרשימה נמחקה');
};

/* ----------------------------------------------------------- playing a list */
function plOrder(l) {
  PL.order = l.items.slice();
  if (PL.shuffle) {
    for (let i = PL.order.length - 1; i > 0; i--) {          // Fisher–Yates
      const j = Math.floor(Math.random() * (i + 1));
      [PL.order[i], PL.order[j]] = [PL.order[j], PL.order[i]];
    }
  }
}

function playPl(id, from) {
  const l = plById(id);
  if (!l || !l.items.length) return;
  setShuffle(false);                    // the archive-wide shuffle steps aside
  PL.playing = l.id;
  plOrder(l);
  PL.pos = PL.shuffle ? 0 : (from || 0);
  closeModal('plModal');
  playRec(PL.order[PL.pos], 0);
  drawPl();
}

function queueNext() {
  const l = plById(PL.playing);
  if (!l) return;
  if (PL.repeat === 'one') return playRec(PL.order[PL.pos], 0);   // same again
  PL.pos++;
  if (PL.pos >= PL.order.length) {
    if (PL.repeat !== 'all') { PL.playing = null; PL.pos = -1; return drawPl(); }
    plOrder(l);                        // reshuffle each time round
    PL.pos = 0;
  }
  playRec(PL.order[PL.pos], 0);
  drawPl();
}

plLoad();
au.ontimeupdate = () => {
  if (!au.duration) return;
  $('pseek').value = (au.currentTime / au.duration) * 1000;
  $('ptime').textContent = `${dur(au.currentTime)} / ${dur(au.duration)}`;
};
$('pseek').oninput = () => {
  if (au.duration) au.currentTime = ($('pseek').value / 1000) * au.duration;
};

/* ------------------------------------------------------------- cassette
 * Reel angle is a pure function of currentTime, so every case falls out of
 * one line: playing winds the reels forward, seeking back winds them back,
 * pausing leaves them still. Rate changes need no handling — currentTime
 * simply advances faster or slower.
 */
const DEG_PER_SEC = 132;                  // a readable spin at 1× speed
let deckLast = null;

/* The threading of the tape, the way a cassette is actually laced.
 *
 * It runs right to left. The tape leaves the right-hand side of the right
 * pack on a steep diagonal, comes down to the right of the guide at the
 * corner of the shell, wraps it, runs straight across the head opening to
 * the left guide, wraps that one on its left, and climbs steeply back to the
 * left pack, which fills as the right one empties. Every one of those wraps
 * turns its guide the same way — to the right — because the tape only ever
 * passes on the outside of them.
 *
 * The two diagonals meet their packs on the exact tangent point, so they
 * read as one length of tape unwinding from the one and winding onto the
 * other rather than a line pasted between them. They are recomputed as the
 * packs change size.
 *
 * The tape is painted twice. #tapeBand and #tapeRun are the dim pass: that
 * is the tape as it shows through the cassette's opaque shell. #tapeLit
 * repeats the run at full strength but clipped to the head opening, so the
 * only place the tape is plainly seen is the window the head reaches
 * through — and it is drawn after the head, so it passes in front of it.
 *
 * Pack centres are fixed at (360,330) and (640,330); only the radii move.
 */
const TAPE_LX = 360, TAPE_RX = 640, TAPE_Y = 330;
const COG_LX  = 196, COG_RX  = 804, COG_Y  = 512;
const COG_R   = 28;                  // the radius the tape rides at on a guide
const RUN_Y   = COG_Y + COG_R;       // so the straight run passes below them
/* every part of the head assembly that takes the tape, right to left: the
   right roller, the head itself, the left roller. Their x spans match the
   artwork's rects exactly, so the tape is pressed in under each of them. */
const PRESS   = [[630, 664], [470, 530], [336, 370]];
const PRESS_Y = RUN_Y - 10;

let headEngaged = false;
let packL = 40, packR = 88;          // the two tape packs, right one full at rest

/* The shared outward normal of a pack and its guide: the direction in which
 * both are touched by the tape that runs taut between them. */
function outerNormal(px, py, r, cx, cy, s) {
  const dx = cx - px, dy = cy - py;
  const d  = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const c  = (r - COG_R) / d;
  const k  = Math.sqrt(Math.max(0, 1 - c * c));
  return [c * ux + s * k * -uy, c * uy + s * k * ux];
}

function paintTape() {
  const [nlx, nly] = outerNormal(TAPE_LX, TAPE_Y, packL, COG_LX, COG_Y,  1);
  const [nrx, nry] = outerNormal(TAPE_RX, TAPE_Y, packR, COG_RX, COG_Y, -1);
  const f = n => n.toFixed(1);

  // where the diagonals leave the packs, and where they reach the guides
  const plx = TAPE_LX + packL * nlx, ply = TAPE_Y + packL * nly;
  const prx = TAPE_RX + packR * nrx, pry = TAPE_Y + packR * nry;
  const qlx = COG_LX  + COG_R * nlx, qly = COG_Y  + COG_R * nly;
  const qrx = COG_RX  + COG_R * nrx, qry = COG_Y  + COG_R * nry;

  $('tapeBand').setAttribute('d',
    `M${f(prx)} ${f(pry)}L${f(qrx)} ${f(qry)}` +
    `M${f(plx)} ${f(ply)}L${f(qlx)} ${f(qly)}`);

  // With the head assembly parked the run lies taut and flat. Driven up, every
  // one of its parts — the two rollers and the head itself — takes the tape
  // and presses it in, so the run leaves the flat and rides over each of them
  // in turn. The tape is painted before the assembly, so it passes under them.
  const mid = headEngaged
    ? PRESS.map(([a, b]) =>
        `C${b + 17} ${RUN_Y} ${b + 8} ${PRESS_Y + 1} ${b} ${PRESS_Y}` +
        `L${a} ${PRESS_Y}` +
        `C${a - 8} ${PRESS_Y + 1} ${a - 17} ${RUN_Y} ${a - 30} ${RUN_Y}`
      ).join('') + `L${COG_LX} ${RUN_Y}`
    : `L${COG_LX} ${RUN_Y}`;

  // sweep 1: each wrap turns the guide clockwise, the way the tape travels
  const run = `M${f(qrx)} ${f(qry)}A${COG_R} ${COG_R} 0 0 1 ${COG_RX} ${RUN_Y}` +
              mid +
              `A${COG_R} ${COG_R} 0 0 1 ${f(qlx)} ${f(qly)}`;
  $('tapeRun').setAttribute('d', run);
  $('tapeLit').setAttribute('d', run);
}

function deckPaint() {
  const t = au.currentTime || 0;
  if (t === deckLast) return;             // paused: nothing to redraw
  deckLast = t;
  const a = t * DEG_PER_SEC;              // + winds forward, − winds back
  $('reelL').style.transform = `rotate(${a}deg)`;
  $('reelR').style.transform = `rotate(${a}deg)`;
  // the drive cogs turn with the tape, both the same way as the reels
  $('cogL').style.transform = `rotate(${a}deg)`;
  $('cogR').style.transform = `rotate(${a}deg)`;
  // The tape runs right to left, the way it is read: the right reel starts
  // full and pays out, the left one takes up and fills.
  const p = au.duration ? Math.min(1, Math.max(0, t / au.duration)) : 0;
  packR = 88 - 48 * p;
  packL = 40 + 48 * p;
  $('tapeL').setAttribute('r', packL.toFixed(1));
  $('tapeR').setAttribute('r', packR.toFixed(1));
  paintTape();
  $('cTime').textContent = `${dur(t)} / ${dur(au.duration || 0)}`;
}
paintTape();                              // laced before anything plays, too

/* Most track names in the archive are the file's and say nothing: bare
 * numbering ("AudioTrack 04"), or the side the tape was copied off ("A",
 * "B", "צד ב"). Those are dropped in favour of the recording's own name and
 * the position within it. */
const BARE_TRACK = /^(?:\d{1,3}|(?:audio)?track\s*\d+|\d+\s*[-_. ]\s*(?:audio)?track\s*\d+|\d+\s*רצועה\s*\d+|temp\d*|(?:side\s*)?[ab]|(?:צד\s*)?[אב]|צד\s*[ab])$/i;

function trackName(r, idx) {
  const t = r.tr[idx] || {};
  const raw = (t.n || '').trim();
  if (raw && !BARE_TRACK.test(raw)) return raw;
  return r.tr.length > 1 ? `${r.ttl} · ${idx + 1}/${r.tr.length}` : r.ttl;
}

/* What goes on the cassette's own label.
 *
 * Not the file's name. A track called "A.mp3" says nothing, and the ones that
 * look like they say something mostly do not either — "JSPEC265.DW_H264",
 * "fetah kal mamlal nael - ratson tsedaka", "מרחיב חפץ + הכהן פינחס - - חתנה
 * של שחר וגאולה2" are all names a file happened to be saved under. What the
 * archive actually knows about the recording is its description where one has
 * been written, and otherwise the title it was catalogued under, which is the
 * cleaned-up form of all that. The track's position within the recording is
 * added when there is more than one, so it is still clear which is playing. */
function recLabel(r, idx) {
  if (!r) return '—';
  const d = (r.desc && !r.from_desc ? String(r.desc) : '').trim();
  const base = d || r.ttl;
  return r.tr.length > 1 ? `${base} · ${idx + 1}/${r.tr.length}` : base;
}

/* Put a line in the panel, and set it travelling if it does not fit.
 * The distance is whatever hangs off the edge, and the time is proportional
 * to it, so a very long name does not race past. */
function rollInto(el, text, least) {
  el.classList.remove('roll');
  el.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = text || '';
  el.appendChild(span);
  // measured straight away: reading scrollWidth forces the layout, so the
  // figure is right here. A frame callback would be cleaner but never fires
  // in a tab that is not painting, and the line would then sit truncated.
  const w = span.scrollWidth, box = el.clientWidth;
  if (w - box <= 4) return;
  // A marquee, always rightwards: the line sets out from beyond the left
  // edge, crosses the window and leaves by the right, and comes round again.
  // The negative delay starts the first pass where the line naturally sits,
  // so the name is readable the moment it is put up rather than after a lap.
  const dist = w + box;
  const dur  = Math.max(least || 9, Math.round(dist / 42));
  el.style.setProperty('--rfrom', -box + 'px');
  el.style.setProperty('--rto', w + 'px');
  el.style.setProperty('--dur', dur + 's');
  span.style.animationDelay = -(dur * box / dist).toFixed(2) + 's';
  el.classList.add('roll');
}

const setLine = (id, text) => rollInto($(id), text);

/* The label's own lines. They are no longer cut short: a long one is set
 * travelling inside the label, which is clipped, so the whole name can be
 * read without the cassette growing. The label runs from x=110 to x=890. */
const LABEL_LEFT   = 200;               // where the roll's own clip begins
const LABEL_RIGHT  = 896;               // and where it ends
const LABEL_ANCHOR = 890;               // the right edge the lines are set from

function labelRoll(textId, groupId) {
  const t = $(textId), g = $(groupId);
  g.classList.remove('roll');
  g.style.removeProperty('animation-delay');
  let w = 0;
  try { w = t.getComputedTextLength(); } catch (e) { return; }
  if (w - (LABEL_ANCHOR - LABEL_LEFT) <= 6) return;
  // the same marquee as the panel's: in from the left, out at the right, and
  // round again, starting where the line would have sat had it fitted
  const from = LABEL_LEFT - LABEL_ANCHOR;
  const to   = LABEL_RIGHT - LABEL_ANCHOR + w;
  const dist = to - from;
  const dur  = Math.max(12, Math.round(dist / 80));
  g.style.setProperty('--lfrom', from + 'px');
  g.style.setProperty('--lto', Math.round(to) + 'px');
  g.style.setProperty('--ldur', dur + 's');
  g.style.animationDelay = -(dur * -from / dist).toFixed(2) + 's';
  g.classList.add('roll');
}

/* the cassette's label carries the track and the performer */
function deckLabel(r, idx) {
  const cut = (s, n) => (s || '').length > n ? s.slice(0, n - 1) + '…' : (s || '');
  $('cTitle').textContent = recLabel(r, idx);
  $('cPerf').textContent  = r ? perfName(r.p) : 'בחר הקלטה כדי לנגן';
  labelRoll('cTitle', 'cTitleRoll');
  labelRoll('cPerf',  'cPerfRoll');
  // shorter than it looks it could be: the type mark sits centred on the same
  // red band, and the title must stop before reaching it
  $('cRec').textContent   = r ? cut(r.ttl, 22) : 'אוצר השירה השומרונית';
  $('cLine2').textContent = r && r.year ? r.year : '';
  $('cEvent').textContent = r ? eventName(r.e) : '—';
  $('cParts').textContent = r ? (r.parts ? `${r.parts} חלקים` : `${r.n} רצועות`) : 'C-90';
}

/* ---------------------------------------------------------- the dancer
 * She belongs to the music, so she waits until a recording has been playing
 * a few seconds and then comes on from the right — walking the thin strip
 * along the bottom of the cassette, just above the indicator lamps, the way
 * a dancer walks on from the wings. She turns to whoever is listening, bows,
 * and dances for as long as the singing lasts.
 *
 * How she leaves says why. A recording that plays itself out lets her walk
 * off to the left, unhurried. Stopping the tape or shutting the deck turns
 * her round and she runs off the way she came in. Pausing — and the gap
 * between one recording and the next — is not a departure at all: she comes
 * to a stand and waits there for the music to start again.
 *
 * Everything is a transform on a group inside the cassette's own drawing —
 * she has no ground, no shadow and no backdrop, so the cassette is seen
 * around her exactly as it was.
 */
const DNC = {
  at: 'off', timers: [], figT: 0, fig: -1, dx: 0,
  y: 650,             // below the shell's edge, hovering over the lamps
  inX: 906,           // centre stage for her: beside the far right screw
  startX: 1090, offLeft: -130, offRight: 1130,
  // How far the figures may carry her: from just short of the shell's own
  // corner on the right, all the way to the middle of the strip — the centre
  // screw at x=500 — which is half the width of the cassette to cross.
  stage: [500 - 906, 968 - 906],
};

function dncClear() {
  DNC.timers.forEach(clearTimeout);
  DNC.timers = [];
}
function dncLater(ms, fn) { DNC.timers.push(setTimeout(fn, ms)); }

function dncPlace(x) {
  $('dancer').querySelector('.dnc-x').style.transform = `translate(${x}px, ${DNC.y}px)`;
}

/* Which way she is facing. She is drawn facing right, so dir = -1 turns her
 * about. The transition carries scaleX through zero on the way, so she
 * narrows to a line and opens out the other way — which is what turning
 * looks like on a figure this flat, and needs no second drawing of her. */
function dncFace(dir) {
  $('dancer').querySelector('.dnc-turn').style.transform = `scaleX(${dir})`;
}

/* ---- how brightly she has to be outlined.
 *
 * On a phone she was hard to make out: she is small there, and she is black,
 * and she stands on the dark plastic at the foot of a cassette. The answer is
 * a white outline, and the worse the conditions the thicker and brighter it
 * has to be.
 *
 * No browser will say how bright the screen is turned up — there is no such
 * API, and the ambient light sensor that might have stood in for one is not
 * available in practice. So the outline is set from what can actually be
 * known, each of which makes her harder to see: how small she is being drawn,
 * whether the reader has asked for a dark presentation, and whether they have
 * asked for more contrast — that last being the nearest thing there is to
 * someone saying the screen is not doing them any favours.
 */
function dncRim() {
  const deck = document.querySelector('.deck');
  const w = deck ? deck.getBoundingClientRect().width : 400;
  // the drawing is 1000 units across, so this is how many screen pixels one
  // unit of outline is actually worth
  // A hairline, not a border. What carries her on a dim screen is that the
  // line is pure white and lit, not that it is thick — a thick one only
  // fattens her and loses the figure.
  let px = 0.7;                                   // the outline, in real pixels
  if (w < 330) px = 1.05;
  else if (w < 420) px = 0.9;
  if (matchMedia('(prefers-color-scheme: dark)').matches) px += 0.12;
  if (matchMedia('(prefers-contrast: more)').matches) px += 0.3;
  const d = $('dancer');
  d.style.setProperty('--rim', px.toFixed(2) + 'px');
  d.style.setProperty('--rimop', (w < 420 ? 0.95 : 0.85).toFixed(2));
}
dncRim();
addEventListener('resize', dncRim);
['(prefers-color-scheme: dark)', '(prefers-contrast: more)'].forEach(q => {
  const m = matchMedia(q);
  (m.addEventListener ? m.addEventListener.bind(m, 'change') : m.addListener.bind(m))(dncRim);
});

/* An SVG element has no offsetWidth — reading it returns undefined and forces
 * nothing — so the usual `void el.offsetWidth` does not flush the style here.
 * Without a flush the browser coalesces "put her off the right edge" and
 * "walk her to her mark" into one recalculation, and she slides in from
 * wherever her transform happened to be instead of walking on from the wing.
 * getBoundingClientRect does force the layout, on SVG as on anything else. */
function dncFlush() { $('dancer').getBoundingClientRect(); }

function dncSet(cls) {
  const d = $('dancer');
  [...d.classList].forEach(c => {
    if (c !== 'dancer' && c !== 'show') d.classList.remove(c);
  });
  if (cls) cls.split(' ').forEach(c => d.classList.add(c));
}

/* Every joint the dance drives, in the order they are nested — and not
 * `.dnc-step`, which is where on the strip she is standing rather than
 * anything about her posture. She comes to rest where the music left her,
 * not back on her mark. */
const DNC_JOINTS = ['.dnc-spin', '.dnc-bob', '.dnc-body', '.dnc-chest',
                    '.dnc-headg', '.dnc-arm-f', '.dnc-arm-b',
                    '.dnc-elbow-f', '.dnc-elbow-b',
                    '.dnc-leg-f', '.dnc-leg-b', '.dnc-knee-f', '.dnc-knee-b'];

/* Coming to a stand, without leaving the strip. Three things ask for it:
 * pausing the tape, changing to another recording, and a quiet passage in
 * the middle of one. The pose she is caught in is written back as an inline
 * transform before the dance is dropped, so that letting it go eases her
 * into standing instead of snapping her there. */
function dncSettle(state) {
  if (DNC.at !== 'dance' && DNC.at !== 'rest' && DNC.at !== 'still') return;
  if (DNC.at === state) return;
  const d = $('dancer');
  const held = DNC_JOINTS.map(sel => {
    const el = d.querySelector(sel);
    return [el, getComputedStyle(el).transform];
  });
  held.forEach(([el, t]) => { if (t && t !== 'none') el.style.transform = t; });
  dncFlush();
  dncSet('settling');                 // the dance is off; the inline pose holds
  dncFlush();
  held.forEach(([el]) => { el.style.transform = ''; });   // …and eases to standing
  dncFace(1);                         // upright, and facing whoever is there
  dncStep(DNC.dx, 0.34);              // but on the spot she had reached
  DNC.at = state;
  dncClear();
  clearTimeout(DNC.figT); DNC.figT = 0;
  dncLater(460, () => d.classList.remove('settling'));
}

const dancerHold = () => dncSettle('still');   // the tape stopped for a moment
const dancerRest = () => dncSettle('rest');    // …or the singing did

/* She picks the dance up where she left it — the same choreography, the same
 * place on the strip — rather than starting the piece over. */
function dancerResume() {
  if (DNC.at !== 'still' && DNC.at !== 'rest') return;
  DNCM.hush = 0;
  DNC.at = 'dance';
  if (!DNC.plan || !DNC.plan.length) return dncDance();
  dncFigure();
}

function dancerIn() {
  if (DNC.at !== 'off' || !DNC_ON || PIX.on) return;
  const d = $('dancer');
  DNC.at = 'in';
  dncClear();
  // She starts just off the right edge, already in profile and already facing
  // the way she will walk. Every transition is off while that is arranged, so
  // that nothing of the setting-up is animated — she is simply there, off in
  // the wing, and the only thing the eye is given is the walk on.
  const x = d.querySelector('.dnc-x'), turn = d.querySelector('.dnc-turn'),
        step = d.querySelector('.dnc-step');
  x.style.transition = turn.style.transition = step.style.transition = 'none';
  dncPlace(DNC.startX);
  dncFace(-1);
  DNC.dx = 0;
  step.style.transform = '';
  d.classList.add('show');
  dncFlush();
  x.style.transition = turn.style.transition = '';
  dncSet('walking');
  dncPlace(DNC.inX);

  dncLater(1900, () => {                    // arrived: turn to face the front
    dncSet(null);
    dncFace(1);
    DNC.at = 'turn';
    dncLater(450, () => {                   // and bow to whoever is listening
      DNC.at = 'bow';
      dncSet('bowing');
      dncLater(1350, () => {
        if (au.paused) return dancerOut('right');
        // this piece's own pulse and metre, not the last one's
        DNCM.gaps = []; DNCM.onsets = []; DNCM.meter = 0; DNCM.bpm = 0;
        DNCM.peak = 0; DNCM.hush = 0;      // this tape's own loudness, not the last one's
        dncDance();
      });
    });
  });
}

/* `side` is which way she goes off: 'left' at the end of a recording, at a
 * walk; 'right' when the tape is stopped or the deck shut, at a run. Either
 * way she finishes properly — a last bow to the front, and only then away. */
function dancerOut(side) {
  const d = $('dancer');
  if (DNC.at === 'off' || DNC.at === 'out' || DNC.at === 'bye') return;
  const onStage = DNC.at === 'dance' || DNC.at === 'rest' || DNC.at === 'still';
  dncClear();
  clearTimeout(DNC.figT);
  if (!onStage) return dncLeave(side);      // caught mid-entrance: just go
  DNC.at = 'bye';
  dncFace(1);
  dncStep(0, 0.4); DNC.dx = 0;              // back to where she came on
  dncSet('bowing');
  dncLater(1050, () => dncLeave(side));
}

function dncLeave(side) {
  const d = $('dancer');
  DNC.at = 'out';
  dncClear();
  const right = side === 'right';
  dncSet(right ? 'running' : 'walking');
  d.classList.add('exiting');
  dncFace(right ? 1 : -1);
  dncPlace(right ? DNC.offRight : DNC.offLeft);
  dncLater(right ? 1200 : 2350, () => {
    dncSet(null);
    d.classList.remove('show', 'exiting');
    DNC.at = 'off';
  });
}

/* ---- the vocabulary, and how a dance is built out of it.
 *
 * A movement is described along four axes: what moves, how it moves, where it
 * goes, and what shape it makes. Two of those are settled by the figure
 * itself, in the stylesheet. The other two — how, and how far — are settled
 * here, from the recording.
 *
 * `kind` divides the vocabulary the way movement itself divides. Axial
 * figures happen on the spot and transfer no weight; locomotor ones do, and
 * there are only five physically possible ways to transfer it — one foot to
 * the other, one foot to the same, one to the other through the air, two to
 * two, and the mixed take-off. Every named step in every tradition is a
 * combination of those five, which is why the list below is short and still
 * covers the ground.
 *
 * `m` is the metres a figure will sit in, 0 standing for free rhythm — most
 * of this archive, which is unmeasured liturgical singing. A step whose shape
 * is asymmetrical needs an asymmetrical metre and cannot be forced into a
 * symmetrical one without deforming: a grapevine is four transfers of weight
 * and belongs in two or four, a triplet is three and belongs in three or six.
 *
 * `hi` is the fastest tempo at which the figure still reads. The rule behind
 * it is that as the tempo rises the range of movement must fall, or the
 * dancer arrives after the beat; past about 180 to the minute only the small
 * figures — the isolations, the shuffles — survive at all.
 *
 * `b` is the figure's length in beats of the piece, so that a movement phrase
 * and a musical phrase begin together.
 */
const STEPS = [
  // key            kind    b  metres        hi   calm mid live
  { k:'f-gesture',  a:1, b:4, m:[0,2,3,4,6], hi:135, w:[6,2,1] },
  { k:'f-sway',     a:1, b:4, m:[0,2,3,4,6], hi:150, w:[6,3,1] },
  { k:'f-swing',    a:1, b:6, m:[0,3,6],     hi:140, w:[4,4,2] },
  { k:'f-contract', a:1, b:4, m:[0,3,4],     hi:110, w:[4,2,1] },
  { k:'f-fall',     a:1, b:4, m:[0,3,4],     hi:120, w:[3,3,2] },
  { k:'f-twist',    a:1, b:4, m:[0,2,3,4],   hi:150, w:[2,3,2] },
  { k:'f-iso',      a:1, b:2, m:[0,2,4],     hi:999, w:[1,3,4] },
  { k:'f-shimmy',   a:1, b:2, m:[2,4],       hi:999, w:[0,2,4] },
  { k:'f-passe',    a:1, b:3, m:[0,2,3,4,6], hi:150, w:[2,3,2] },
  { k:'f-arab',     a:1, b:4, m:[0,3,4,6],   hi:130, w:[3,3,2] },
  { k:'f-walk',     a:0, b:4, m:[0,2,4],     hi:170, w:[3,4,3], go:1 },
  { k:'f-grapevine',a:0, b:4, m:[2,4],       hi:165, w:[2,5,4], go:1 },
  { k:'f-chasse',   a:0, b:3, m:[2,3,4],     hi:170, w:[2,4,4], go:1 },
  { k:'f-triplet',  a:0, b:3, m:[3,6],       hi:160, w:[2,4,3], go:1 },
  { k:'f-skip',     a:0, b:4, m:[2,6],       hi:160, w:[1,3,4], go:1 },
  { k:'f-waltz',    a:0, b:3, m:[3],         hi:150, w:[3,4,2], go:1 },
  { k:'f-bourree',  a:0, b:3, m:[0,2,3,4],   hi:190, w:[2,3,3], go:1 },
  { k:'f-turn',     a:0, b:2, m:[0,2,3,4,6], hi:170, w:[0,2,4], peak:1 },
  { k:'f-jete',     a:0, b:2, m:[0,2,4,6],   hi:150, w:[0,1,4], peak:1, go:1 },
  { k:'f-saute',    a:0, b:2, m:[2,4],       hi:150, w:[0,1,3], peak:1 },
  // The two acrobatic figures. They are peaks like the leaps, so they can
  // only fall at the close of a section and only after the breath that
  // prepares them, and their weights are the lowest in the table — between
  // them they take about a quarter of the peaks, which puts one somewhere
  // around every half-minute of singing. Any oftener and they stop being
  // the thing that the rest of the dance was leading up to. Both are given
  // a length of their own as well as a number of beats: a cartwheel taken
  // over four and a half seconds is not a cartwheel.
  { k:'f-cart',     a:0, b:3, m:[0,2,3,4,6], hi:175, w:[0,1,2], peak:1, go:1,
                    wide:1, mind:1.15, maxd:2.4 },
  { k:'f-flip',     a:0, b:2, m:[0,2,3,4,6], hi:180, w:[0,0,2], peak:1,
                    mind:1.00, maxd:2.0 },
];

/* The eight actions that the three qualities of effort — how the weight is
 * used, how the time is used, how the space is used — combine into. They are
 * the most exact way there is of saying what a movement is like rather than
 * what shape it makes, and here each becomes a curve and a size: a sustained
 * effort eases in and out, a sudden one strikes and settles. */
const EFFORTS = {
  float: { ease:'cubic-bezier(.35,0,.55,1)',  sz:1.12 },  // light  sustained indirect
  glide: { ease:'cubic-bezier(.45,0,.55,1)',  sz:1.00 },  // light  sustained direct
  flick: { ease:'cubic-bezier(.2,.85,.35,1)', sz:0.74 },  // light  sudden    indirect
  dab:   { ease:'cubic-bezier(.15,.9,.3,1)',  sz:0.64 },  // light  sudden    direct
  wring: { ease:'cubic-bezier(.55,0,.45,1)',  sz:1.06 },  // strong sustained indirect
  press: { ease:'cubic-bezier(.6,0,.4,1)',    sz:0.96 },  // strong sustained direct
  slash: { ease:'cubic-bezier(.12,.85,.25,1)',sz:1.14 },  // strong sudden    indirect
  punch: { ease:'cubic-bezier(.1,.9,.2,1)',   sz:1.02 },  // strong sudden    direct
};
function effortName(strong, sudden, indirect) {
  return strong ? (sudden ? (indirect ? 'slash' : 'punch')
                          : (indirect ? 'wring' : 'press'))
                : (sudden ? (indirect ? 'flick' : 'dab')
                          : (indirect ? 'float' : 'glide'));
}

/* As the tempo rises the range must come down, or she is always late. This is
 * the commonest fault in a dancer who has just learnt the steps. */
function rangeFor(bpm) {
  if (!bpm)        return 1.12;      // free rhythm: sustained, and full
  if (bpm < 90)    return 1.14;
  if (bpm < 120)   return 1.00;
  if (bpm < 140)   return 0.88;
  if (bpm < 180)   return 0.72;
  return 0.50;                       // up here only the small figures survive
}

/* the same recording is to be danced the same way every time it is played,
 * and differently from the next one — so the ordering is drawn from a stream
 * seeded on the recording's own id rather than from chance */
function dncSeed(id) {
  let h = 2166136261;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h |= 0; h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---- composing this recording's dance.
 *
 * Music of this kind is built in phrases of eight beats and in sections of
 * four phrases, and a dance has to agree with that: a movement phrase begins
 * where a musical phrase begins and closes where it closes, never in the
 * middle. So each phrase here is filled to seven beats of movement and the
 * eighth is left as a breath — and where the next phrase opens with a leap or
 * a turn, that eighth beat is the plié that makes it possible. Nothing rises
 * without a preparation under it.
 *
 * Within that, axial and locomotor alternate, so that she is not travelling
 * for eight bars together nor rooted for eight; and the peak figures — the
 * turns and the leaps — are saved for the end of a section, where the music
 * is closing too.
 */
function choreograph(recId, meter, bpm) {
  const rnd = dncSeed(recId);
  const pool = STEPS.filter(s => s.m.includes(meter) && bpm <= s.hi);
  if (!pool.length) return [{ k: 'f-sway', b: 4 }, { k: 'f-prep', b: 4 }];
  const pick = (want, mood, notK) => {
    const bag = [];
    pool.forEach(s => {
      if (s.k === notK) return;
      if (want === 'peak' ? !s.peak : (s.peak || s.a !== want)) return;
      for (let n = 0; n < s.w[mood]; n++) bag.push(s);
    });
    if (!bag.length) return null;
    return bag[Math.floor(rnd() * bag.length)];
  };

  const dance = [];
  for (let ph = 0; ph < 16; ph++) {
    const closing = ph % 4 === 3;             // the last phrase of a section
    const mood = ph % 4 === 0 ? 0 : closing ? 2 : 1;
    let left = 7, axial = (ph % 2 === 0);     // phrases alternate their footing
    const last = dance.length ? dance[dance.length - 1].k : '';
    while (left >= 2) {
      const s = (closing && left <= 3 && rnd() < 0.7)
        ? pick('peak', mood, last) || pick(axial ? 1 : 0, mood, last)
        : pick(axial ? 1 : 0, mood, dance.length ? dance[dance.length - 1].k : '');
      if (!s) break;
      const b = Math.min(s.b, left);
      dance.push({ k: s.k, b, go: s.go ? (rnd() < 0.5 ? 1 : -1) : 0, peak: !!s.peak,
                   wide: !!s.wide, mind: s.mind || 0, maxd: s.maxd || 0 });
      left -= b;
      axial = !axial;
    }
    // The breath, and the preparation for whatever opens the next phrase. It
    // takes whatever the movement did not, so the phrase always comes to
    // eight and the next one starts where the music does.
    dance.push({ k: 'f-prep', b: left + 1, breath: true });
  }

  // Every recording is to show at least one of the two acrobatic figures.
  //
  // The plan is drawn once per recording and then repeated for as long as the
  // piece runs, so a plan that happens to come out without an acrobatic is not
  // a recording that shows one rarely — it is a recording that never shows one
  // at all, however long it lasts. Left to the weights alone that was three
  // recordings in four. Raising the weights instead would have crowded out the
  // turns and the leaps everywhere else, so where a plan came up with none,
  // one peak is exchanged for one acrobatic: the dance keeps its shape and the
  // count of eight is untouched, because the exchange keeps the same beats.
  const acro = pool.filter(s => s.k === 'f-cart' || s.k === 'f-flip');
  if (acro.length && !dance.some(f => f.k === 'f-cart' || f.k === 'f-flip')) {
    // A peak is the natural place to put one. Two plans in five contain no
    // peak at all, though, so where there is none the exchange falls on the
    // last movement of a phrase — the one the breath comes after, which is
    // the same position in the music even if the plan did not mark it.
    let peaks = dance.map((f, i) => (f.peak ? i : -1)).filter(i => i >= 0);
    if (!peaks.length)
      peaks = dance.map((f, i) => (f.k !== 'f-prep' && f.b >= 2 &&
                                   dance[i - 1] && dance[i - 1].k === 'f-prep' ? i : -1))
                   .filter(i => i >= 0);
    if (peaks.length) {
      const at = peaks[Math.floor(rnd() * peaks.length)];
      const s  = acro[Math.floor(rnd() * acro.length)];
      dance[at] = { k: s.k, b: dance[at].b, peak: true,
                    go: s.go ? (rnd() < 0.5 ? 1 : -1) : 0,
                    wide: !!s.wide, mind: s.mind || 0, maxd: s.maxd || 0 };
    }
  }
  return dance;
}

/* the travelling is a transition rather than an animation: JS knows where
 * she should end up, and the figure's own length is how long she has */
function dncStep(x, sec) {
  const st = $('dancer').querySelector('.dnc-step');
  st.style.transition = `transform ${sec.toFixed(2)}s linear`;
  st.style.transform = `translateX(${Math.round(x)}px)`;
}

/* the dance is set out once, when a recording starts, and again if the piece
 * turns out to be in a different metre or at a different pace than the first
 * few seconds suggested — but never in the middle of a phrase */
function dncDance() {
  DNC.at = 'dance';
  DNC.plan = choreograph(cur.rec || 0, DNCM.meter, DNCM.bpm);
  DNC.step = 0;
  DNC.planFor = DNCM.meter + '/' + Math.round(DNCM.bpm / 12);
  dncFigure();
}

function dncFigure() {
  if (DNC.at !== 'dance') return;
  const d = $('dancer');
  if (!DNC.plan || !DNC.plan.length) return dncDance();

  // At the top of a section, take account of what the piece has turned out to
  // be. The metre and the pace are far better known after twenty seconds of
  // singing than after four, and this is the one place a new reading may be
  // acted on without cutting a phrase in half.
  if (DNC.step % 8 === 0) {
    const now = DNCM.meter + '/' + Math.round(DNCM.bpm / 12);
    if (now !== DNC.planFor && DNCM.gaps.length >= 5) {
      DNC.planFor = now;
      DNC.plan = choreograph(cur.rec || 0, DNCM.meter, DNCM.bpm);
      DNC.step = 0;
    }
  }

  const f = DNC.plan[DNC.step % DNC.plan.length];
  DNC.step++;

  // how the movement is to be done, and how big it may be
  const eff = EFFORTS[DNCM.effort] || EFFORTS.glide;
  d.style.setProperty('--ease', eff.ease);
  d.style.setProperty('--sz', (rangeFor(DNCM.bpm) * eff.sz).toFixed(2));

  const beat = Math.min(1.5, Math.max(0.3, DNCM.beat || 0.62));
  let   dur  = Math.min(7, Math.max(0.75, beat * f.b));
  // An acrobatic has one speed at which it reads. Too slow and it floats,
  // too fast and it is a smear, and neither is a fault the music can excuse.
  if (f.maxd) dur = Math.min(f.maxd, Math.max(f.mind, dur));
  d.style.setProperty('--figdur', dur.toFixed(2) + 's');
  dncSet('fig ' + f.k);

  if (f.go) {
    let dir = f.go;
    // A wheel has a width, and a wheel turned against a wall is a fall. If
    // the way this one was set to go has been used up, and the other way has
    // not, it goes the other way instead — the only place in the dance where
    // the room she has left overrules the plan.
    if (f.wide) {
      const ahead = dir > 0 ? DNC.stage[1] - DNC.dx : DNC.dx - DNC.stage[0];
      const back  = dir > 0 ? DNC.dx - DNC.stage[0] : DNC.stage[1] - DNC.dx;
      if (ahead < 96 && back > ahead) dir = -dir;
    }
    // She turns to the way she is going and covers most of what room is left
    // that way — most, not a fraction of it, or she would creep towards the
    // ends of the strip and never actually arrive at either.
    const room = dir > 0 ? DNC.stage[1] - DNC.dx : DNC.dx - DNC.stage[0];
    const span = Math.max(f.wide ? 64 : 24, Math.min(112, room * 0.8)) * dir;
    DNC.dx = Math.max(DNC.stage[0], Math.min(DNC.stage[1], DNC.dx + span));
    dncFace(dir);
    dncStep(DNC.dx, dur);
  } else {
    dncFace(1);                                // the set figures face the front
    dncStep(DNC.dx, 0.3);                      // and hold their ground
  }
  clearTimeout(DNC.figT);
  DNC.figT = setTimeout(dncFigure, dur * 1000);
}

/* ---- dancing to the piece, not to a metronome.
 * Four things about the singing are worth having: whether there is any, how
 * loud it is at this instant, how quickly the pulses come, and how high the
 * voice is sitting. They become, in order, whether she dances at all, the
 * size of her movement, which figure comes next and how long it lasts, and
 * how far she opens and lifts — so a slow, low recitation gets a grave,
 * close dance and a fast, bright one gets a wide, high one.
 *
 * The beat is taken from the singing's own envelope rather than from a drum
 * that is not there: a pulse is counted each time the level rises well clear
 * of its running mean, and the median of the last few gaps is the beat. It is
 * only ever read when a figure ends, so no animation is retimed mid-flight.
 */
const DNCM = {
  spec: null, prev: null, mean: 0, up: false, last: 0, gaps: [], beat: 0, bpm: 0,
  lift: 1, amp: 1, hush: 0, peak: 0,
  onsets: [], meter: 0, flux: 0, cen: 0, wob: 0, effort: 'glide',
};

/* ---- what metre the piece is in, taken from where its accents fall.
 * Group the onsets by two, by three and by four in turn, and see which
 * grouping puts the strong ones consistently in the same place. The best
 * spread wins; if none of them is convincing the piece has no metre worth
 * the name, which for most of this archive — unmeasured liturgical singing —
 * is the true answer, and the free-rhythm figures are then the right ones. */
function meterOf(onsets) {
  if (onsets.length < 10) return 0;
  const v = onsets.map(o => o.v);
  let best = 0, score = 0;
  for (const k of [2, 3, 4]) {
    const sum = new Array(k).fill(0), n = new Array(k).fill(0);
    v.forEach((x, i) => { sum[i % k] += x; n[i % k]++; });
    const mean = sum.map((s, i) => s / (n[i] || 1));
    const hi = Math.max(...mean), lo = Math.min(...mean);
    const s = hi > 0 ? (hi - lo) / hi : 0;
    if (s > score) { score = s; best = k; }
  }
  // six is three grouped in twos, and is what a swing or a skip wants
  if (best === 3 && score > 0.34) return 6;
  return score > 0.17 ? best : 0;
}

function dncListen(an, rms) {
  const d = $('dancer'), now = performance.now();

  /* How loud this recording is at all. These are tapes of unaccompanied
   * singing, half of them copied from cassette, and what counts as loud on
   * one is near silence on another — so loudness is judged against the
   * piece's own peak rather than against a fixed number. The peak falls
   * slowly, so a quiet passage lowers the bar with it instead of being
   * mistaken for the end of the singing. */
  DNCM.peak = Math.max(rms, DNCM.peak * 0.9995);
  const loud = DNCM.peak > 0.0015;          // have we heard anything at all?
  const rel = DNCM.peak > 0 ? Math.min(1, rms / DNCM.peak) : 0;

  /* Silence is not something to dance through — but neither is a reading of
   * nothing, which is what a browser gives when it will not hand the sound
   * to the graph at all. She only stands still for a silence that can
   * actually be measured; where there is no signal to measure she goes on
   * dancing, which is the right way round for a fault to fall. */
  DNCM.hush = (loud && rel < 0.14) ? DNCM.hush + 1 : 0;
  if (DNC.at === 'dance' && DNCM.hush > 62) return dancerRest();
  if (DNC.at === 'rest') {
    // back at the first real sound, or after a spell with nothing to hear
    if (rel > 0.3 || !loud) dancerResume();
    return;
  }

  // how big: the level itself, smoothed so she does not twitch on every frame
  DNCM.amp += (0.55 + rel * 0.8 - DNCM.amp) * 0.12;
  d.style.setProperty('--amp', DNCM.amp.toFixed(2));
  if (!an) return;
  const level = rel;                        // the beat is read off the same scale

  // how high: where the weight of the spectrum sits, which for a voice runs
  // from about 300 Hz in the chest to some 2.5 kHz at the top of the register
  if (!DNCM.spec || DNCM.spec.length !== an.frequencyBinCount)
    DNCM.spec = new Uint8Array(an.frequencyBinCount);
  if (!DNCM.prev || DNCM.prev.length !== DNCM.spec.length)
    DNCM.prev = new Uint8Array(DNCM.spec.length);
  an.getByteFrequencyData(DNCM.spec);
  let num = 0, den = 0, rise = 0;
  for (let i = 1; i < DNCM.spec.length; i++) {
    const x = DNCM.spec[i];
    num += i * x; den += x;
    const up = x - DNCM.prev[i];               // only what grew: an attack
    if (up > 0) rise += up;
    DNCM.prev[i] = x;
  }
  // how sudden: how sharply the sound rises, which is the difference between
  // an effort that strikes and one that is drawn out
  DNCM.flux += (Math.min(1, rise / (DNCM.spec.length * 6)) - DNCM.flux) * 0.1;

  if (den > 40) {
    const hz = (num / den) * ((an.context.sampleRate / 2) / DNCM.spec.length);
    const want = 0.72 + Math.min(1, Math.max(0, (hz - 300) / 2200)) * 0.55;
    DNCM.lift += (want - DNCM.lift) * 0.05;
    d.style.setProperty('--lift', DNCM.lift.toFixed(2));
    // how direct: a voice that holds its place in the spectrum is going
    // straight at the note; one that wavers around it is going by way of
    DNCM.wob += (Math.abs(hz - DNCM.cen) / 900 - DNCM.wob) * 0.08;
    DNCM.cen += (hz - DNCM.cen) * 0.12;
  }
  DNCM.effort = effortName(DNCM.amp > 1.12, DNCM.flux > 0.2, DNCM.wob > 0.055);

  // how fast: a pulse every time the level clears its own running mean
  DNCM.mean += (level - DNCM.mean) * 0.045;
  if (!DNCM.up && level > DNCM.mean * 1.42 && level > 0.14) {
    DNCM.up = true;
    const gap = now - DNCM.last;
    DNCM.last = now;
    DNCM.onsets.push({ t: now, v: level });    // kept for the metre
    if (DNCM.onsets.length > 32) DNCM.onsets.shift();
    if (gap > 240 && gap < 1900) {
      DNCM.gaps.push(gap);
      if (DNCM.gaps.length > 9) DNCM.gaps.shift();
    }
  } else if (DNCM.up && level < DNCM.mean * 1.1) {
    DNCM.up = false;
  }
  if (DNCM.gaps.length >= 4) {
    const g = [...DNCM.gaps].sort((a, b) => a - b);
    DNCM.beat = g[g.length >> 1] / 1000;      // read when the next figure starts
    DNCM.bpm  = 60 / DNCM.beat;
    DNCM.meter = meterOf(DNCM.onsets);
  }
}

/* she comes on a few seconds in, once the recording is properly under way */
let dncWatch = 0;
function dancerWatch() {
  clearInterval(dncWatch);
  dncWatch = setInterval(() => {
    if (!au.src) {
      if (DNC.at !== 'off' && DNC.at !== 'out') dancerOut('right');
      return;
    }
    if (au.paused) return dancerHold();
    if (DNC.at === 'still') return dancerResume();
    if (DNC.at === 'off' && au.currentTime > 4) dancerIn();
    // no analyser (the mixer graph is not up), so she cannot hear the piece;
    // the figures still have to follow one another
    if (DNC.at === 'dance' && !DNC.figT) dncFigure();
  }, 700);
}
dancerWatch();
/* the tape running out is the one exit she takes at a walk, to the left */
au.addEventListener('ended', () => dancerOut('left'));
/* pause, and the gap between one recording and the next, only halt her. STOP
 * and closing the deck have already sent her off by the time these fire. */
au.addEventListener('pause', dancerHold);
au.addEventListener('play', dancerResume);

function deckTick() { deckPaint(); requestAnimationFrame(deckTick); }
requestAnimationFrame(deckTick);
// rAF is suspended while the tab is in the background, so also repaint on the
// audio's own events — the reels then still track a seek made off-screen.
['timeupdate', 'seeking', 'seeked', 'play', 'pause'].forEach(
  ev => au.addEventListener(ev, deckPaint));

/* ------------------------------------------------------- transport sounds
 * The deck's own noises: a click on play, tape whirr on a seek. They are cues,
 * not content, so they duck to a third of the listening volume and never
 * overlap themselves.
 */
/* One place assigns a file to each transport action. An empty string means
 * that action has no sound yet and stays silent — nothing else changes. */
const SOUNDS = {
  play:    'sounds/play.mp3',    // לחיצה על PLAY
  stop:    'sounds/play.mp3',    // אותו כפתור — אותה נקישה מכנית
  rewind:  'sounds/rewind.mp3',  // גלגול הסרט לאחור בעצירה
  // הגלגול נשמע אותו הדבר לשני הכיוונים, כמו במנוע אחד שמושך את שני הצדדים
  spool:   'sounds/rewind.mp3',  // הרצה קדימה ואחורה בהחזקת הכפתור
  pause:   '',                   // ללא צליל
};
const SFX = {};
for (const [k, src] of Object.entries(SOUNDS)) {
  if (!src) continue;
  SFX[k] = new Audio(src);
  SFX[k].preload = 'auto';
}

/* The transport's own noises can be switched off without touching the
 * recording. The choice is the listener's and stays on their device. */
let QUIET = localStorage.getItem('shira_quiet') === '1';

function paintQuiet() {
  const b = $('dwQuiet');
  b.setAttribute('aria-pressed', QUIET ? 'true' : 'false');
  b.title = QUIET ? 'נקישות המקשים מושתקות — לחיצה תחזיר אותן'
                  : 'השתקת נקישות המקשים';
}
$('dwQuiet').onclick = () => {
  QUIET = !QUIET;
  if (QUIET) Object.keys(SFX).forEach(sfxStop);   // cut anything sounding now
  localStorage.setItem('shira_quiet', QUIET ? '1' : '');
  paintQuiet();
  toast(QUIET ? 'נקישות המקשים מושתקות' : 'נקישות המקשים חזרו');
};
paintQuiet();

/* ------------------------------------------------- sending the sound out
 * A page cannot pair a Bluetooth speaker itself. Pairing belongs to the
 * device's own settings, and the web's Bluetooth API reaches data services,
 * never the audio profile — so no browser can make this button do that part.
 *
 * What it can do is the part that matters once the speaker is paired: choose
 * which of the outputs the device already has the singing comes out of. Pair
 * the speaker once in the phone's or the computer's settings, press this,
 * pick it from the list, and the recording plays there instead of out of the
 * machine in your hand. The choice is remembered per device, and re-made on
 * the next recording; if the speaker has gone, playback quietly falls back.
 */
const BT = { id: localStorage.getItem('shira_sink') || '', label: '' };
const btCan = () => typeof au.setSinkId === 'function';

function paintBT() {
  const b = $('dwBT'), on = !!BT.id && BT.id !== 'default';
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.classList.toggle('unsupported', !btCan());
  b.title = !btCan() ? 'הדפדפן הזה אינו מאפשר לבחור את יעד ההשמעה — הבחירה נעשית בהגדרות המכשיר'
          : on ? `ההשמעה יוצאת אל ${BT.label || 'רמקול חיצוני'} — לחיצה תחזיר אותה למכשיר`
               : "השמעה ברמקול בלוטות'";
}

/* setSinkId rejects if the device has gone; then the sound simply stays where
 * it is, and the button goes back to showing the machine's own speaker. */
async function btRoute(id, label, quiet) {
  try {
    await au.setSinkId(id || '');
    BT.id = id || ''; BT.label = label || '';
    localStorage.setItem('shira_sink', BT.id);
    if (!quiet) toast(BT.id ? `ההשמעה יוצאת אל ${BT.label || 'הרמקול שנבחר'}`
                            : 'ההשמעה חזרה אל המכשיר');
  } catch (e) {
    BT.id = ''; localStorage.removeItem('shira_sink');
    if (!quiet) toast('לא ניתן היה לשלוח את ההשמעה אל הרמקול שנבחר', true);
  }
  paintBT();
}

$('dwBT').onclick = async () => {
  sfx('click');
  if (!btCan()) {
    toast("בדפדפן זה יעד ההשמעה נקבע בהגדרות המכשיר: צמדו את רמקול הבלוטות' " +
          'והקול יעבור אליו מאליו', true);
    return;
  }
  if (BT.id) return btRoute('', '');            // pressing again brings it home
  // the browser's own chooser where there is one: it needs no permission and
  // names the outputs properly
  if (navigator.mediaDevices && navigator.mediaDevices.selectAudioOutput) {
    try {
      const dev = await navigator.mediaDevices.selectAudioOutput();
      if (dev && dev.deviceId) return btRoute(dev.deviceId, dev.label);
      return;
    } catch (e) { if (e && e.name === 'NotAllowedError') return; }
  }
  // otherwise, whatever enumerateDevices will admit to
  let outs = [];
  try {
    outs = (await navigator.mediaDevices.enumerateDevices())
             .filter(d => d.kind === 'audiooutput');
  } catch (e) {}
  outs = outs.filter(d => d.deviceId && d.deviceId !== 'default');
  if (!outs.length) {
    toast("לא נמצא רמקול בלוטות' מצומד. צמדו אותו בהגדרות המכשיר ונסו שוב", true);
    return;
  }
  if (outs.length === 1) return btRoute(outs[0].deviceId, outs[0].label);
  btMenu(outs);
};

/* a small list under the button, only when there is more than one output */
function btMenu(outs) {
  let m = $('btMenu');
  if (!m) {
    m = document.createElement('div');
    m.id = 'btMenu'; m.className = 'bt-menu';
    $('dwBar').appendChild(m);
    addEventListener('pointerdown', e => {
      if (!m.contains(e.target) && e.target !== $('dwBT')) m.classList.add('hidden');
    });
  }
  m.innerHTML = '';
  m.classList.remove('hidden');       // measurable before the names go in
  outs.forEach((d, i) => {
    const b = document.createElement('button');
    const name = d.label || `יציאת שמע ${i + 1}`;
    m.appendChild(b);
    // a speaker's own name is often longer than the list is wide, so it
    // travels across rather than being cut off where it matters most
    rollInto(b, name, 7);
    b.onclick = () => { m.classList.add('hidden'); btRoute(d.deviceId, name); };
  });
}

/* the sink is a property of the element, so it has to be re-set on each new
 * recording — but silently: the listener chose it once and meant it */
au.addEventListener('loadedmetadata', () => {
  if (BT.id && btCan() && au.sinkId !== BT.id) btRoute(BT.id, BT.label, true);
});
if (BT.id && btCan()) btRoute(BT.id, BT.label, true); else paintBT();

/* --------------------------------------------- watching it on a television
 * The Remote Playback API is the part of this the browser really does: it
 * puts up the device picker the system already knows about — a Chromecast, a
 * television running Cast — and hands the recording over to it. Safari has
 * its own door to the same room, for AirPlay. Where neither exists the key
 * says so rather than pretending.
 */
function castCan() {
  return !!(au.remote && typeof au.remote.prompt === 'function')
      || typeof au.webkitShowPlaybackTargetPicker === 'function';
}
function paintCast(state) {
  const b = $('dwCast');
  if (state === 'connected' || state === 'connecting') {
    b.setAttribute('aria-pressed', 'true');
    b.title = 'ההקלטה מוצגת במכשיר חיצוני — לחיצה תנתק';
  } else {
    b.setAttribute('aria-pressed', 'false');
    b.title = castCan() ? 'צפייה במכשיר טלוויזיה'
                        : 'הדפדפן הזה אינו תומך בשידור אל מסך חיצוני';
  }
}
$('dwCast').onclick = async () => {
  sfx('click');
  if (au.remote && au.remote.prompt) {
    try { await au.remote.prompt(); }
    catch (e) {
      // the picker being dismissed is not a failure worth a message
      if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError')
        toast('לא נמצא מכשיר לשידור ברשת הזו', true);
    }
    return;
  }
  if (au.webkitShowPlaybackTargetPicker) return au.webkitShowPlaybackTargetPicker();
  toast('הדפדפן הזה אינו תומך בשידור אל מסך חיצוני. ' +
        'אפשר להטיל את המסך כולו מתוך תפריט הדפדפן', true);
};
if (au.remote) {
  au.remote.addEventListener('connect', () => paintCast('connected'));
  au.remote.addEventListener('connecting', () => paintCast('connecting'));
  au.remote.addEventListener('disconnect', () => paintCast('disconnected'));
  // the key dims where the network has nothing to send to
  try {
    au.remote.watchAvailability(has => $('dwCast').classList.toggle('away', !has));
  } catch (e) {}
}
paintCast();

/* ------------------------------------------------ sharing this recording
 * The link carries the recording's own id, and the page opens on it, so what
 * arrives in WhatsApp is this piece and this track rather than the archive's
 * front door. WhatsApp is only handed the text — nothing is sent from here;
 * the message is composed there and sent by whoever shares it.
 */
function recLink(recId, idx) {
  const u = new URL(location.href);
  u.hash = 'r=' + encodeURIComponent(recId) + (idx ? '.' + idx : '');
  return u.href;
}
$('dwShare').disabled = true;
$('dwShare').onclick = () => {
  if (!cur.rec) return;
  const r = byId(C.recordings, cur.rec);
  if (!r) return;
  sfx('click');
  // what is written on the cassette, not what the file was saved under
  const txt = `${recLabel(r, cur.idx)}\n${perfName(r.p)} · ${eventName(r.e)}\n` +
              `מתוך אוצר השירה השומרונית\n${recLink(cur.rec, cur.idx)}`;
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
};

/* a link shared out of here comes back in through this */
function openFromLink() {
  const m = /^#r=([^.]+)(?:\.(\d+))?/.exec(location.hash || '');
  if (!m || !C) return false;
  // the id came back through a URL, so it is a string now whatever it was
  const want = decodeURIComponent(m[1]);
  const r = C.recordings.find(x => String(x.id) === want);
  if (!r) return false;
  playRec(r.id, Math.min(Math.max(0, +(m[2] || 0)), r.tr.length - 1));
  return true;
}

/* ------------------------------------------ pictures in place of the tape
 *
 * The cassette's own place in the well becomes a screen, and photographs of
 * Samaritan life run across it one after another — of the feast the
 * recording was made at where there are such pictures, and of the community
 * more generally where there are not. Nothing else changes for it: the
 * window keeps its size and the singing carries on behind.
 *
 * The pictures come from Wikimedia Commons, which is where the freely
 * licensed ones are, and which will say who took each of them. That last
 * part is not a nicety — the licences these are published under ask for the
 * photographer to be named wherever the picture is shown — so the credit
 * runs along the bottom of the screen and changes with the picture. Anything
 * that arrives without a photographer's name says so rather than passing it
 * over in silence.
 */
const PIX = {
  on: false, list: [], i: 0, timer: 0, load: 0, which: 'A', key: '',
};
/* what to look for, by the feast the recording belongs to. The archive's own
 * event list is in Hebrew; Commons is catalogued in English. */
/* Kept to two or three words apiece. Commons wants every word of a search to
 * appear, and its files are named plainly — "Samaritans marking Sukkot on
 * Mount Gerizim", "Samaritans' Passover at Mount Gerizim" — so a longer
 * phrase simply finds nothing. The preference for people is applied when the
 * results are sorted, not by loading it into the query. */
const PIX_Q = {
  2:  ['Samaritan synagogue', 'Samaritan prayer'],
  3:  ['Samaritan synagogue'],
  4:  ['Samaritans Passover', 'Samaritan Passover sacrifice'],
  5:  ['Samaritans Passover', 'Samaritan matzot'],
  6:  ['Samaritans Shavuot', 'Samaritan pilgrimage'],
  7:  ['Samaritan pilgrimage', 'Samaritans Gerizim'],
  8:  ['Samaritans Gerizim', 'Samaritan priests'],
  9:  ['Samaritans Yom Kippur', 'Samaritan synagogue'],
  10: ['Samaritans Sukkot', 'Samaritan sukkah'],
  11: ['Samaritans Sukkot', 'Samaritans Gerizim'],
  12: ['Samaritan pilgrimage', 'Samaritans Luza'],
  14: ['Samaritan wedding', 'Samaritan celebration'],
  15: ['Samaritan Torah', 'Samaritan Pentateuch'],
};
const PIX_ANY = ['Samaritans Israel', 'Samaritan high priest',
                 'Samaritan festival', 'Samaritan priests',
                 'Samaritans Gerizim', 'Samaritans Holon', 'Samaritan community'];

/* What is wanted on that screen is the life of the community, which means
 * people in it — the priests, the pilgrims, a family at a feast — and not the
 * mountain by itself, a manuscript under glass, or a plan of a building. No
 * browser can look at a picture and say who is in it, but Commons says a good
 * deal in what it calls a file and what it files it under, and that is enough
 * to sort the ones with somebody in them to the front. */
const PIX_WHO = /priest|people|men\b|women|family|families|pilgrim|worship|pray|congregation|crowd|ceremon|celebrat|dance|dancing|singer|choir|children|boy|girl|elder|group|sacrific|slaughter|feast|festival|wedding|reading|blessing|procession/i;
const PIX_NOBODY = /manuscript|scroll|codex|inscription|map\b|plan\b|diagram|chart|coin|stamp|seal\b|tomb|grave|ruins?\b|archaeolog|excavat|panorama|landscape|aerial|view of|skyline|mountain\b|hill\b|building|architecture|facade|interior of|exterior|street|road|sign\b|book|page\b|folio|text\b|font|alphabet|script\b|letter/i;

function pixPeople(p) {
  let s = 0;
  const t = `${p.ttl} ${(p.cats || []).join(' ')}`;
  if (PIX_WHO.test(t)) s += 2;
  if (PIX_NOBODY.test(t)) s -= 3;
  return s;
}

/* Commons hands the photographer back as a scrap of HTML. It is parsed in an
 * inert document and only its text taken: nothing from out there is ever put
 * into this page as markup. */
function pixText(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch (e) { return ''; }
}

/* Where the uploader gave no machine-readable author, Commons writes a
 * sentence about it and puts the name it worked out inside — which is the
 * name the credit wants, not the sentence. */
function pixName(s) {
  const m = /No machine-readable author provided\.\s*(.+?)(?:~commonswiki)?\s*assumed/i.exec(s);
  if (m && m[1]) return m[1].trim();
  return /No machine-readable author/i.test(s) ? '' : s;
}

async function pixSearch(term) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
    + '&origin=*&generator=search&gsrnamespace=6&gsrlimit=24'
    + '&prop=imageinfo|categories&cllimit=24'
    + '&iiprop=url|size|extmetadata&iiurlwidth=900'
    + '&gsrsearch=' + encodeURIComponent('intitle:' + term);
  const j = await fetch(u).then(r => r.ok ? r.json() : Promise.reject(r.status));
  return Object.values((j.query && j.query.pages) || {}).map(p => {
    const ii = (p.imageinfo || [])[0] || {}, m = ii.extmetadata || {};
    const by = pixName(pixText(m.Artist && m.Artist.value));
    const x = {
      src: ii.thumburl || '',
      by: by.length > 64 ? by.slice(0, 63) + '…' : by,
      lic: pixText(m.LicenseShortName && m.LicenseShortName.value),
      ttl: (p.title || '').replace(/^[^:]+:/, '').replace(/\.[a-z]+$/i, ''),
      cats: (p.categories || []).map(c => c.title.replace(/^[^:]+:/, '')),
    };
    return pixUsable(x, ii.width, ii.height, true) ? x : null;
  }).filter(Boolean);
}

/* The same search need not be made twice in a day. The number in the key is
 * the version of the rules below: change what is let through and every list
 * saved under the old rules is abandoned rather than kept showing what those
 * rules allowed. Raise it whenever the filtering changes. */
const PIX_RULES = 3;

/* Every visit starts clean. A saved list is only worth having inside one
 * sitting — it saves asking Commons the same question each time the screen is
 * switched on and off — and keeping it beyond that is how a picture that
 * should no longer be shown goes on being shown for another half a day. */
(function pixFresh() {
  try {
    Object.keys(localStorage).forEach(k => {
      if (/^shira_pix\d*_/.test(k)) localStorage.removeItem(k);
    });
  } catch (e) {}
})();

function pixCached(key) {
  try {
    const c = JSON.parse(localStorage.getItem(`shira_pix${PIX_RULES}_${key}`) || 'null');
    if (c && Date.now() - c.t < 432e5) return c.v;          // half a day
  } catch (e) {}
  return null;
}
function pixKeep(key, v) {
  try {
    localStorage.setItem(`shira_pix${PIX_RULES}_${key}`,
                         JSON.stringify({ t: Date.now(), v }));
    // and clear out what earlier rules had saved
    Object.keys(localStorage).forEach(k => {
      if (/^shira_pix\d*_/.test(k) && k.indexOf(`shira_pix${PIX_RULES}_`) !== 0)
        localStorage.removeItem(k);
    });
  } catch (e) {}
}

/* The pictures illustrating the Hebrew Wikipedia article on the Samaritans —
 * asked for by name, and a good set: somebody has already chosen them as the
 * ones that show the community. The article's own images are fetched, and
 * each brings its photographer and licence with it. */
/* An article carries more than photographs: the site's own logos, the little
 * icons the templates use, maps, coats of arms. None of those belong on a
 * screen showing the life of the community, and they are recognisable both
 * by what they are called and by being far too small to be a photograph. */
const PIX_NOT = /logo|icon|symbol|wiki|commons|open.?access|flag|coat.of.arms|blank|placeholder|question|edit|magnify|ambox|stub|portal|disambig|nuvola|crystal|emblem|barnstar|template/i;

/* Commons holds millions of scanned book pages, and a search for words like
 * "ceremony" or "people" brings them up by the hundred. They are engravings
 * out of Victorian encyclopaedias, not photographs of anybody's life. */
const PIX_BOOK = /\(IA |bub_gb_|internet archive|encyclopa|microform|- being a|wherein is|\bplate \d|\bpage \d|frontispiece|woodcut|engraving|lithograph|\bvol\b|\bed\.\b|\(micr|news\b|newspaper|clipping|poster|leaflet|cover\b|seminar|conference|delegation|ulpan/i;
/* a scan reproduced under fair use is somebody's newspaper page, not a
 * picture of anybody's life, and it has no licence to show it under */
const PIX_FAIR = /fair.?use|שימוש הוגן|non.?free/i;

/* And a search anchored only by subject words still wanders, so a picture is
 * kept only if the file itself is named for this community — Samaritan in one
 * of its spellings, or the mountain and the village that are theirs and
 * nobody else's. Nablus and Holon are deliberately not on this list: a
 * picture of either is a picture of a town, and only the words below make it
 * a picture of the Samaritans. */
const PIX_SUBJ = /samarit|samaritain|samariter|shomron|shumron|schomron|gerizim|garizim|kiryat.?luza|\bluza\b/i;

/* The word "Samaritan" belongs to two quite separate things, and only one of
 * them is this community. The other is the parable, and everything named for
 * it — the inn on the Jericho road, the hospitals, the charities — none of
 * which has anything to do with the people who sing these recordings. The
 * same goes for anything Christian that a search for "Samaritan prayer"
 * drags in, and for paintings: what is wanted on that screen is photographs
 * of a living community, not somebody's picture of a congregation. */
const PIX_WRONG = /good.?samaritan|parable|\binn\b|hospital|charit|church|jesus|christ|gospel|new testament|apostle|отче наш|lord'?s prayer|missionar|crusad/i;
const PIX_ART = /painting|oil on canvas|watercolou?r|\bdrawing\b|sketch|etching|\bicon\b|fresco|mosaic|museum|gallery|gottlieb|\bart of\b|illustration/i;

function pixUsable(p, w, h, anchored) {
  if (!p.src || !/\.(jpe?g|png)$/i.test(p.src.split('?')[0])) return false;
  if (PIX_NOT.test(p.ttl) || PIX_BOOK.test(p.ttl)) return false;
  const cats = (p.cats || []).join(' ');
  const hay = `${p.ttl} ${cats}`;
  if (PIX_FAIR.test(`${p.lic} ${cats}`)) return false;
  if (PIX_WRONG.test(hay) || PIX_ART.test(hay)) return false;
  // A free search has to prove the picture is of this community; the
  // article's own images do not — being in it is the proof.
  if (anchored && !PIX_SUBJ.test(hay)) return false;
  if (w && w < 620) return false;                 // an icon, not a photograph
  if (w && h && (w / h > 3.2 || h / w > 2.6)) return false;   // a banner or a strip
  return true;
}

async function pixArticle(site, title) {
  const u = `https://${site}/w/api.php?action=query&format=json&origin=*`
    + '&generator=images&gimlimit=100&prop=imageinfo|categories'
    + '&iiprop=url|size|extmetadata&iiurlwidth=900&cllimit=24&titles=' + encodeURIComponent(title);
  const j = await fetch(u).then(r => r.ok ? r.json() : Promise.reject(r.status));
  return Object.values((j.query && j.query.pages) || {}).map(p => {
    const ii = (p.imageinfo || [])[0] || {}, m = ii.extmetadata || {};
    const by = pixName(pixText(m.Artist && m.Artist.value));
    const x = { src: ii.thumburl || '', by: by.length > 64 ? by.slice(0, 63) + '…' : by,
                lic: pixText(m.LicenseShortName && m.LicenseShortName.value),
                ttl: (p.title || '').replace(/^[^:]+:/, '').replace(/\.[a-z]+$/i, ''),
                cats: (p.categories || []).map(c => c.title.replace(/^[^:]+:/, '')) };
    return pixUsable(x, ii.width, ii.height) ? x : null;
  }).filter(Boolean);
}

/* Pictures given to the archive directly rather than found — a photographer
 * who has said yes, a page whose owner has said yes. They live in a list of
 * their own beside the catalogue, each with the credit it is to be shown
 * under, and they go first because they are the closest to home. The file is
 * optional: without it nothing here changes. */
async function pixGiven() {
  try {
    const j = await fetch('data/pix_sources.json').then(r => r.ok ? r.json() : null);
    if (!Array.isArray(j)) return [];
    return j.filter(x => x && x.src).map(x => ({
      src: String(x.src), by: String(x.by || ''), lic: String(x.lic || ''),
      ttl: String(x.ttl || ''), src_name: String(x.source || ''),
      feasts: Array.isArray(x.feasts) ? x.feasts : [], given: true,
    }));
  } catch (e) { return []; }
}

/* ---- the archive's own pictures and films.
 *
 * scripts/scan_media.py reads the folder they are kept in and writes what it
 * found to data/local_media.json; the files themselves are served from the
 * same media host as the recordings. These come before anything fetched from
 * outside — they are the community's own, and they are what the screen is
 * really for.
 *
 * The feast a picture belongs to is written into where it was filed and what
 * it was called: a folder named Passover03, a film called 2016-Shavuot-ORI…
 * That is enough to show a recording made at Sukkot the Sukkot pictures. */
const PIX_FEAST = [
  [/passover|pesa|פסח|מצות/i,            [4, 5]],
  [/sukkot|sukkoth|succot|סוכות|סוכה/i,  [10, 11]],
  [/shavuot|שבועות/i,                     [6]],
  [/yom.?kippur|כיפור/i,                  [9]],
  [/wedding|חתונה|חתנה/i,                 [14]],
  [/torah|תורה|ספר/i,                     [15]],
];

async function pixLocal() {
  let man = null;
  try { man = await fetch('data/local_media.json').then(r => r.ok ? r.json() : null); }
  catch (e) { return []; }
  if (!man || !Array.isArray(man.items) || !man.items.length) return [];
  const root = man.base || (C.meta && C.meta.media_pix) || '';
  if (!root) return [];                    // nowhere to serve them from yet
  const base = root.replace(/\/?$/, '/');
  const credit = man.credit || 'ארכיון אוצר השירה השומרונית';
  return man.items.map(x => {
    const path = `${x.folder || ''}/${x.f}`;
    const feasts = PIX_FEAST.filter(([re]) => re.test(path)).flatMap(([, ids]) => ids);
    // his own cameras, and his name is on the files: ORI_… and OOH_…
    const his = /\b(?:ORI|OOH)[_ ]?\d/i.test(x.f);
    return {
      src: base + x.f.split('/').map(encodeURIComponent).join('/'),
      kind: x.kind === 'video' ? 'video' : 'image',
      secs: x.secs || 0,
      by: x.by || (his ? 'אורי אורהוף' : credit),
      lic: x.lic || (his ? 'באישור הצלם' : 'מארכיון הקהילה'),
      ttl: x.f.split('/').pop().replace(/\.[a-z0-9]+$/i, ''),
      feasts, local: true,
    };
  });
}

async function pixLoad() {
  const r = cur.rec ? byId(C.recordings, cur.rec) : null;
  const key = String((r && r.e) || 0);
  if (PIX.key === key && PIX.list.length) return true;
  const cache = pixCached(key);
  if (cache && cache.length) { PIX.key = key; PIX.list = cache; PIX.i = 0; return true; }

  // `rank` is how close a picture is to this particular recording: what was
  // given to the archive, then what the feast's own search found, then the
  // article's, then the general searches
  const seen = new Set(), out = [];
  const take = (got, rank) => got.forEach(x => {
    if (!seen.has(x.src)) { seen.add(x.src); out.push(Object.assign(x, { rank })); }
  });
  // The community's own, and closest to home: the pictures on the archive's
  // own site and the films off its own drive. Those filed under this feast
  // come first, then the rest of them, and only then anything from outside.
  const ev = (r && r.e) || 0;
  const mine = (await pixGiven()).concat(await pixLocal());
  take(mine.filter(x => (x.feasts || []).includes(ev)), 0);
  take(mine.filter(x => !(x.feasts || []).length), 1);
  if (!PIX.on) return false;

  const own = PIX_Q[r && r.e] || [];
  for (const t of own) {
    if (!PIX.on) return false;
    try { take(await pixSearch(t), 1); } catch (e) {}
  }
  try { take(await pixArticle('he.wikipedia.org', 'שומרונים'), 2); } catch (e) {}
  for (const t of PIX_ANY) {
    if (!PIX.on) return false;                      // switched off while loading
    let got = [];
    try { got = await pixSearch(t); } catch (e) { continue; }
    take(got, 3);
    if (out.length >= 34) break;                    // enough for a long recording
  }
  if (!out.length) return false;
  // Where the feast's own search found plenty, the general one is not wanted
  // at all: it is there to fill a gap, not to dilute what fits.
  const close = out.filter(p => p.rank <= 2);
  let pool = close.length >= 14 ? close : out;

  /* Two caps, and they matter more than any of the filtering above. A search
   * returns one photographer's whole session — thirty frames of the same
   * afternoon, or a seminar somebody once photographed — and without a limit
   * that one series takes over the screen entirely. So no photographer gives
   * more than a handful, and neither does any one run of consecutively
   * numbered files. */
  const stem = p => p.ttl.replace(/[\s_-]*\(?\d[\d\s.]*\)?$/, '').trim().toLowerCase();
  const perBy = new Map(), perStem = new Map();
  pool = pool.filter(p => {
    // the archive's own holdings are not what the cap is for: they are all
    // filed under one name and they are the whole point of the screen
    if (p.local || p.given) return true;
    const b = p.by || '?', s = stem(p);
    const nb = (perBy.get(b) || 0) + 1, ns = (perStem.get(s) || 0) + 1;
    if (nb > 5 || ns > 6) return false;
    perBy.set(b, nb); perStem.set(s, ns);
    return true;
  });

  // Somebody in the picture first, and the feast's own before the general.
  // Pictures that plainly have nobody in them are dropped outright, so long
  // as enough are left without them.
  // shuffled first, so that pictures of equal standing — same rank, same
  // score — come up in a different order every time; the sort below is
  // stable, so it settles the tiers without undoing the shuffle inside them
  const scored = pixShuffle(pool.map(p => ({ p, s: pixPeople(p) })))
    .sort((a, b) => (b.s - a.s) || (a.p.rank - b.p.rank));
  const kept = scored.filter(x => x.s >= 0).map(x => x.p);
  const rest = scored.filter(x => x.s < 0).map(x => x.p);
  const list = kept.length >= 8 ? kept : kept.concat(rest);
  PIX.key = key; PIX.list = pixSpread(list); PIX.i = 0;
  pixKeep(key, PIX.list);
  return true;
}

function pixShuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* A search comes back in the order the files were uploaded, which means one
 * photographer's whole afternoon in a row, and the same run every time. So
 * the pictures are both shuffled and dealt round by photographer: shuffled,
 * so that no two hearings show the same sequence; dealt round, so that the
 * name under the picture keeps changing rather than one hand holding the
 * screen for a dozen frames together.
 *
 * The shuffling happens inside each photographer's own pile and again over
 * the order the piles are dealt in, which keeps both properties at once —
 * and the pictures that suit this recording still lead, because they were
 * already sorted to the front before any of this. */
function pixSpread(list) {
  const by = new Map();
  list.forEach(p => {
    const k = p.by || '?';
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(p);
  });
  const hands = [...by.values()];
  hands.forEach(pixShuffle);
  pixShuffle(hands);
  // …but a hand whose pictures came closest to this recording still deals
  // first, so the feast is not shuffled away altogether
  hands.sort((a, b) => (a[0].rank || 0) - (b[0].rank || 0));
  const out = [];
  for (let n = 0; out.length < list.length; n++) {
    let any = false;
    for (const h of hands) if (h.length) { out.push(h.shift()); any = true; }
    if (!any) break;
  }
  return out;
}

/* One picture after another, each fading up over the one before it.
 *
 * A film is treated as one of them, and never brings its own sound: what is
 * being listened to is the recording. A short one runs through; a long one
 * would hold the screen for ten minutes, so only about ten seconds of it are
 * shown — and a different ten seconds each time it comes round, so that a
 * long film gives up all of itself over the course of a long recording
 * instead of the same opening again and again.
 */
const PIX_CLIP = 10;                     // seconds of a long film at a time
const pixSeen = new Map();               // how many times each film has been on

function pixNext() {
  if (!PIX.on || !PIX.list.length) return;
  const p = PIX.list[PIX.i % PIX.list.length];
  PIX.i++;
  clearTimeout(PIX.timer);
  const vid = $('tvV');
  if (p.kind === 'video') return pixFilm(p, vid);

  vid.classList.remove('on');
  try { vid.pause(); } catch (e) {}
  const show = PIX.which === 'A' ? $('tvB') : $('tvA');
  const hide = PIX.which === 'A' ? $('tvA') : $('tvB');
  PIX.which = PIX.which === 'A' ? 'B' : 'A';
  show.onload = () => {
    if (!PIX.on) return;
    show.classList.add('on');
    hide.classList.remove('on');
    $('tvCap').textContent = pixCredit(p);
  };
  show.onerror = () => { if (PIX.on) pixNext(); };    // a picture that will not come
  show.src = p.src;
  PIX.timer = setTimeout(pixNext, 7200);
}

function pixFilm(p, vid) {
  const n = (pixSeen.get(p.src) || 0);
  pixSeen.set(p.src, n + 1);
  vid.muted = true;                        // said twice, because it matters
  vid.volume = 0;
  vid.onerror = () => { if (PIX.on) pixNext(); };
  vid.onloadedmetadata = () => {
    if (!PIX.on) return;
    const len = vid.duration || p.secs || 0;
    let run = len;
    if (len > PIX_CLIP + 3) {
      // a different part on each showing, walking through the film
      const parts = Math.max(1, Math.floor(len / PIX_CLIP));
      const at = (n % parts) * PIX_CLIP;
      try { vid.currentTime = Math.min(at, Math.max(0, len - PIX_CLIP)); } catch (e) {}
      run = PIX_CLIP;
    }
    vid.play().catch(() => {});
    $('tvA').classList.remove('on'); $('tvB').classList.remove('on');
    vid.classList.add('on');
    $('tvCap').textContent = pixCredit(p) +
      (len > PIX_CLIP + 3 ? ` · קטע ${(n % Math.max(1, Math.floor(len / PIX_CLIP))) + 1}` : '');
    clearTimeout(PIX.timer);
    PIX.timer = setTimeout(pixNext, run * 1000 + 400);
  };
  vid.src = p.src;
  vid.load();
  // if the film never arrives, do not leave the screen stuck on it
  PIX.timer = setTimeout(() => { if (PIX.on && !vid.classList.contains('on')) pixNext(); }, 9000);
}

/* Who took it, under what terms, and where it came from — and that last is
 * named for what it actually is: the community's own site, the archive's own
 * drive, or Wikimedia, and never one standing in for another. */
function pixCredit(p) {
  const bits = [p.by ? `צילום: ${p.by}` : 'צילום: לא צוין שם הצלם'];
  if (p.lic) bits.push(p.lic);
  const where = p.src_name || (p.local ? 'ארכיון הקהילה' : 'ויקישיתוף');
  // …unless the licence line already says where it came from
  if (!bits.some(b => b.indexOf(where) >= 0)) bits.push(where);
  return bits.join(' · ');
}

function pixOff() {
  PIX.on = false;
  clearTimeout(PIX.timer);
  const tv = $('tv');
  tv.classList.add('hidden');
  tv.classList.remove('on');
  ['tvA', 'tvB'].forEach(id => { $(id).classList.remove('on'); $(id).removeAttribute('src'); });
  const v = $('tvV');
  v.classList.remove('on');
  try { v.pause(); } catch (e) {}
  v.removeAttribute('src'); v.load();
  $('dwPix').setAttribute('aria-pressed', 'false');
  $('dwPix').title = 'תמונות מחיי השומרונים';
  // the cassette is back, so she may come on again with it
  dancerWatch();
}

/* While the pictures are up there is nothing of her to see — the screen is
 * over the whole cassette — so she stops rather than dancing behind it. This
 * does not touch whether the listener wants her at all: that is their own
 * setting, and it is waiting for her when the cassette comes back. */
function dancerAside() {
  dncClear();
  clearTimeout(DNC.figT); DNC.figT = 0;
  dncSet(null);
  $('dancer').classList.remove('show');
  DNC.at = 'off';
}

$('dwPix').onclick = async () => {
  sfx('click');
  if (PIX.on) return pixOff();
  PIX.on = true;
  dancerAside();                                  // nothing of her would show
  const tv = $('tv');
  tv.classList.remove('hidden');
  void tv.offsetWidth;
  tv.classList.add('on');
  $('tvCap').textContent = 'מחפש תמונות…';
  $('dwPix').setAttribute('aria-pressed', 'true');
  $('dwPix').title = 'חזרה אל הקלטת';
  const ok = await pixLoad();
  if (!PIX.on) return;                            // switched off meanwhile
  if (!ok) {
    $('tvCap').textContent = 'לא ניתן להביא תמונות כרגע';
    toast('לא ניתן להביא תמונות מוויקישיתוף כרגע', true);
    return;
  }
  pixNext();
};
/* a new recording may belong to another feast, so the pictures follow it */
au.addEventListener('loadedmetadata', () => {
  if (!PIX.on) return;
  const r = cur.rec ? byId(C.recordings, cur.rec) : null;
  if (String((r && r.e) || 0) === PIX.key) return;
  pixLoad().then(ok => { if (ok && PIX.on) pixNext(); });
});
/* Reaching for one of the transport keys is reaching for the tape, so the
 * screen gets out of its way and the cassette comes back. Caught on the way
 * down and before anything else, so that the key's own work still happens. */
document.querySelector('.transport').addEventListener('pointerdown', () => {
  if (PIX.on) pixOff();
}, true);

/* ------------------------------------------------------------ the dancer
 * She is a pleasure, not a fixture: whoever would rather watch the reels
 * turn can send her off, and the deck remembers it on that device. */
let DNC_ON = localStorage.getItem('shira_dancer') !== '0';
function paintDnc() {
  const b = $('dwDnc');
  b.setAttribute('aria-pressed', DNC_ON ? 'true' : 'false');
  b.title = DNC_ON ? 'הרקדנית על הקלטת — לחיצה תכבה אותה'
                   : 'הרקדנית כבויה — לחיצה תחזיר אותה';
}
$('dwDnc').onclick = () => {
  DNC_ON = !DNC_ON;
  localStorage.setItem('shira_dancer', DNC_ON ? '1' : '0');
  if (!DNC_ON) {
    dncClear();
    clearTimeout(DNC.figT); DNC.figT = 0;
    dncSet(null);
    $('dancer').classList.remove('show');
    DNC.at = 'off';
  }
  paintDnc();
  sfx('click');
  toast(DNC_ON ? 'הרקדנית חוזרת אל הקלטת' : 'הרקדנית כבויה');
};
paintDnc();

function sfx(name) {
  const a = SFX[name];
  if (!a || au.muted || QUIET) return;
  // the cues are normalised to about -16 LUFS, so they sit just under the
  // recording rather than needing to be attenuated away to nothing
  a.volume = Math.min(1, Math.max(0.25, (au.volume || 0) * 0.9));
  try { a.currentTime = 0; a.play().catch(err => console.warn('sfx', name, err)); }
  catch (e) {}
}
function sfxStop(name) {
  const a = SFX[name];
  if (a) { a.pause(); try { a.currentTime = 0; } catch (e) {} }
}

/* ---------------------------------------------------------- playing speed */
function setRate(v) {
  // four steps only: 0.5 · 1 · 1.5 · 2 — a value stored by an earlier build
  // (0.85, say) is snapped onto the nearest one
  v = Math.min(2, Math.max(0.5, Math.round((Number(v) || 1) * 2) / 2));
  // the pitch trim from the desk rides on top: with pitch preserved the speed
  // slider changes tempo alone, and with a trim dialled in the tape itself is
  // run a little fast or slow, which moves the pitch with it
  const trim = (typeof FX !== 'undefined' && FX.pitch) ? FX.pitch : 0;
  au.playbackRate = v * (1 + trim * 0.03);
  au.preservesPitch = au.mozPreservesPitch = au.webkitPreservesPitch = !trim;
  $('prate').value = v;
  const txt = v.toFixed(1) + '×';
  $('prateN').textContent = $('cRate').textContent = txt;
  localStorage.setItem('shira_rate', v);
}

/* --------------------------------------------------------------- volume */
function setVol(v, muted) {
  v = Math.min(1, Math.max(0, Math.round(v * 100) / 100));
  au.volume = v;
  if (muted !== undefined) au.muted = muted;
  if (v > 0 && au.muted && muted === undefined) au.muted = false;
  $('pvolN').textContent = Math.round(v * 100) + '%';
  $('pmute').textContent = au.muted || v === 0 ? '🔇' : v < 0.5 ? '🔉' : '🔊';
  $('deckWin').classList.toggle('muted', au.muted || v === 0);
  // the knob keeps its place while muted, so releasing mute restores the level
  if (+$('pvol').value !== Math.round(v * 100)) $('pvol').value = Math.round(v * 100);
  localStorage.setItem('shira_vol', v);
  localStorage.setItem('shira_muted', au.muted ? '1' : '');
}

/* The fader. Sliding the knob sets the level; pressing it where it stands,
 * without sliding, is the mute — so the one control does both without a
 * separate button, as on the machines this is modelled on. */
const volSlider = $('pvol');
let volPress = null;

volSlider.addEventListener('pointerdown', e => {
  const r = volSlider.getBoundingClientRect();
  const THUMB = 13;                       // matches the knob width in the CSS
  const frac = (+volSlider.value - +volSlider.min) /
               ((+volSlider.max - +volSlider.min) || 1);
  const knobX = r.left + THUMB / 2 + frac * (r.width - THUMB);
  volPress = { x: e.clientX, v: +volSlider.value, moved: false,
               onKnob: Math.abs(e.clientX - knobX) <= THUMB / 2 + 3 };
});
volSlider.addEventListener('pointermove', e => {
  if (volPress && Math.abs(e.clientX - volPress.x) > 3) volPress.moved = true;
});
volSlider.addEventListener('pointerup', () => {
  if (volPress && volPress.onKnob && !volPress.moved) {
    volSlider.value = volPress.v;         // a press is not a move
    setVol(volPress.v / 100, !au.muted);
  }
  volPress = null;
});
volSlider.addEventListener('pointercancel', () => { volPress = null; });
volSlider.addEventListener('input', () => {
  // hold the level while the knob is merely being pressed
  if (volPress && volPress.onKnob && !volPress.moved) return;
  setVol(volSlider.value / 100, false);
});

$('pmute').onclick = () => setVol(au.volume, !au.muted);
$('pmute').onkeydown = e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('pmute').onclick(); }
};
setVol(parseFloat(localStorage.getItem('shira_vol') ?? '1'),
       localStorage.getItem('shira_muted') === '1');
$('prate').addEventListener('input', e => setRate(e.target.value));
$('prate').addEventListener('dblclick', () => setRate(1));   // snap back to 1×
setRate(localStorage.getItem('shira_rate') || 1);

/* The word before the speed slider is a label, nothing more — it is never a
 * button. Both sliders lie flat side by side at every width. */
$('prateTap').setAttribute('aria-hidden', 'true');

/* A recording that will not play. Where the file sits and why it is unreachable
 * is ours to fix, not the listener's to read, so the message says only what it
 * means for them. */
function clearErr() { document.querySelector('.perr')?.remove(); }
au.onerror = () => {
  /* Stopping playback empties the source, and an empty source counts as a load
   * error by the letter of the spec — nothing failed, so say nothing. */
  if (!au.getAttribute('src')) return;
  clearErr();
  const box = document.createElement('div');
  box.className = 'perr';
  box.textContent = 'ההקלטה הזאת לא מתנגנת כרגע. נסו שוב בעוד רגע.';
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 6000);
};

/* ---------------------------------------------------------------- events */
let qt;
$('q').addEventListener('input', e => {
  clearTimeout(qt);
  qt = setTimeout(() => { F.q = e.target.value.trim(); draw(); }, 130);
});
$('qclear').onclick = () => { $('q').value = ''; F.q = ''; draw(); };
$('tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab');
  if (t) go(t.dataset.tab);
});

/* ------------------------------------------------------------------ admin
 * Uploading is admin-only, behind the very same login used to edit the Torah:
 * the server checks ADMIN_USER/ADMIN_PASSWORD and hands back a signed token.
 * The password never reaches this file. */
const ADMIN = { token: sessionStorage.getItem('shira_admin') || '',
                enabled: false, user: '' };

function toast(msg, warn) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (warn ? ' warn' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 4200);
}

const openModal  = id => $(id).classList.remove('hidden');
// the add sheet has two guises; leaving it always returns it to the plain one
const closeModal = id => {
  $(id).classList.add('hidden');
  if (id === 'addModal') resetAddForm();
  if (id === 'loginModal') pendingAfterLogin = '';
};
document.querySelectorAll('[data-close]').forEach(b =>
  b.onclick = () => closeModal(b.dataset.close));
document.querySelectorAll('.modal').forEach(m =>
  m.onclick = e => { if (e.target === m) closeModal(m.id); });

function showAdminUI(redraw) {
  $('addBtn').classList.toggle('hidden', !ADMIN.token);
  $('trashBtn').classList.toggle('hidden', !ADMIN.token);   // admins only
  $('pendBtn').classList.toggle('hidden', !ADMIN.token);
  if (ADMIN.token) drawPending();
  $('perfBtn').classList.toggle('hidden', !ADMIN.token);
  // publishing exists only in the local copy — the cloud has nowhere to push
  $('syncBtn').classList.toggle('hidden', !ADMIN.token || !!(C && C.meta.readonly));
  $('adminFlag').classList.toggle('hidden', !ADMIN.token);
  $('adminBtn').classList.toggle('hidden', !ADMIN.enabled || !!ADMIN.token);
  if (ADMIN.token) loadTrash();
  if (redraw && C) draw();               // edit affordances appear on login
}

/* ------------------------------------------------------------ סל המחזור */
let TRASH = [];

let PURGED = [];

async function loadTrash() {
  if (!ADMIN.token) { TRASH = []; PURGED = []; return drawTrash(); }
  const r = await fetch('api/trash', { headers: { 'X-Admin-Token': ADMIN.token } })
    .then(r => r.json()).catch(() => ({}));
  TRASH = r.items || [];
  PURGED = r.purged || [];
  drawTrash();
}

/* ------------------------------------------------- permanent deletion
 * Removes the audio from the media server. The masters on the drive are never
 * touched, and every deletion is written to the log tab.
 */
async function purge(key, title) {
  const one = !!key;
  const what = one ? `«${title}»` : `כל ${TRASH.length} ההקלטות שבסל`;
  if (!confirm(
    `למחוק ${what} מן הענן לצמיתות?\n\n` +
    'הקבצים יימחקו משרת המדיה ולא ניתן יהיה להשיב אותם.\n' +
    'קובצי המקור שעל כונן הארכיון לא ייגעו.')) return;
  if (!one && prompt('לאישור סופי הקלד: מחק') !== 'מחק') return;

  toast('מוחק מן הענן…');
  const r = await fetch('api/purge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': ADMIN.token },
    body: JSON.stringify(one ? { key } : { all: true }),
  }).then(r => r.json()).catch(e => ({ ok: false, errors: [String(e)] }));

  await loadTrash();
  if (!r.ok) return toast('המחיקה נכשלה: ' + (r.errors?.[0] || r.error || ''), true);
  toast(`נמחקו לצמיתות: ${r.purged} הקלטות · ${r.files_deleted} קבצים מן השרת` +
        (r.failed ? ` · ${r.failed} נכשלו` : ''));
}
$('purgeAll').onclick = () => TRASH.length ? purge(null) : toast('סל המחזור ריק');

$('trashTabs').addEventListener('click', e => {
  const b = e.target.closest('.subtab');
  if (!b) return;
  const bin = b.dataset.ttab === 'bin';
  $('trashTabs').querySelectorAll('.subtab').forEach(x =>
    x.classList.toggle('on', x === b));
  $('trashBin').classList.toggle('hidden', !bin);
  $('trashLog').classList.toggle('hidden', bin);
});

/* ------------------------------------------- recordings waiting to be sorted
 * What the record key captures lands in the archive at once, flagged as
 * pending: it is safe, but it is not yet filed. This is where an admin hears
 * each one, corrects what was typed in a hurry, and either files it into the
 * indexes or removes it.
 */
function pendingRecs() {
  return (C && C.recordings ? C.recordings : []).filter(r => r.pending);
}

function drawPending() {
  const rows = pendingRecs();
  $('pendN').textContent = rows.length;
  $('pendN').classList.toggle('hidden', !rows.length);
  const body = $('pendBody');
  if (!body) return;
  body.innerHTML = rows.length ? rows.map(r => `
    <div class="qrow">
      <span class="qt"><b>${esc(r.ttl || 'הקלטה ללא שם')}</b><br>
        <span class="s">${esc(perfName(r.p))} · ${esc(eventName(r.e))} ·
          ${dur((r.tr || []).reduce((a, t) => a + (t.s || 0), 0))}
          ${r.added ? '· נקלטה ב־' + esc(r.added.replace('T', ' ').slice(0, 16)) : ''}</span></span>
      <button class="btn ghost" data-splay="${r.id}">▶ האזן</button>
      <button class="btn ghost" data-sedit="${r.id}">✎ פרטים</button>
      <button class="btn" data-sfile="${r.id}">תייק</button>
    </div>`).join('')
    : '<p class="empty">אין הקלטות הממתינות למיון.</p>';

  body.querySelectorAll('[data-splay]').forEach(b =>
    b.onclick = () => { closeModal('pendModal'); playRec(+b.dataset.splay, 0); });
  body.querySelectorAll('[data-sedit]').forEach(b =>
    b.onclick = () => { closeModal('pendModal'); openEdit(+b.dataset.sedit); });
  body.querySelectorAll('[data-sfile]').forEach(b =>
    b.onclick = () => fileRecording(+b.dataset.sfile));
}

async function fileRecording(id) {
  const rec = (C.recordings || []).find(r => r.id === id);
  if (!rec) return;
  const r = await fetch('api/file_pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': ADMIN.token },
    body: JSON.stringify({ key: (rec.tr || [{}])[0].f || '' }),
  }).then(x => x.json()).catch(() => ({}));
  if (!r.ok) return toast(r.error || 'התיוק נכשל', 1);
  await loadCatalog();
  drawPending();
  toast(`«${rec.ttl}» תויקה לאוצר`);
}

$('pendBtn').onclick = () => { drawPending(); openModal('pendModal'); };

function drawTrash() {
  $('trashN').textContent = TRASH.length;
  $('trashN').classList.toggle('hidden', !TRASH.length);
  const body = $('trashBody');
  if (!body) return;
  body.innerHTML = TRASH.length ? TRASH.map(it => `
    <div class="qrow">
      <span class="qt"><b>${esc(it.title || 'הקלטה ללא שם')}</b><br>
        <span class="s">${it.files.length} קבצים ·
          ${it.trashed.length ? `${it.trashed.length} בסל` : 'קובצי המקור נשמרו בארכיון'}
          · הוסר ב־${esc((it.when || '').replace('T', ' ').slice(0, 16))}</span></span>
      <button class="btn ghost" data-restore="${esc(it.key)}">השב</button>
      <button class="btn ghost danger-txt" data-purge="${esc(it.key)}"
              title="מחיקה לצמיתות מן הענן">🗑</button>
    </div>`).join('')
    : '<p class="news-empty">סל המחזור ריק.</p>';

  $('purgeAll').classList.toggle('hidden', !TRASH.length);
  $('trashLog').innerHTML = PURGED.length ? PURGED.map(e => `
    <div class="qrow${e.error ? ' bad' : ''}">
      <span class="qt"><b>${esc(e.title || 'ללא שם')}</b><br>
        <span class="s">${e.deleted_from_server} קבצים נמחקו מן השרת${
          e.not_on_server ? ` · ${e.not_on_server} לא נמצאו` : ''} ·
          ${esc((e.when || '').replace('T', ' ').slice(0, 16))}${
          e.by ? ' · ' + esc(e.by) : ''}${
          e.error ? ' · נכשל' : ''}</span></span>
    </div>`).join('') +
    '<p class="hint">קובצי המקור שעל כונן הארכיון נשמרו בכל המקרים.</p>'
    : '<p class="news-empty">טרם נמחקה הקלטה לצמיתות.</p>';

  $('trashBody').querySelectorAll('[data-purge]').forEach(b => {
    const it = TRASH.find(x => x.key === b.dataset.purge);
    b.onclick = () => purge(b.dataset.purge, it ? (it.title || 'ללא שם') : '');
  });
  body.querySelectorAll('[data-restore]').forEach(b => {
    b.onclick = async () => {
      const r = await fetch('api/restore_recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': ADMIN.token },
        body: JSON.stringify({ key: b.dataset.restore }),
      }).then(r => r.json()).catch(() => ({}));
      if (!r.ok) return toast('ההשבה נכשלה', true);
      await loadTrash();
      await loadCatalog();
      toast('ההקלטה הושבה לאוצר');
    };
  });
}
$('trashBtn').onclick = async () => { await loadTrash(); openModal('trashModal'); };

/* the standing flag doubles as the way out of admin mode */
$('adminFlag').onclick = async () => {
  if (!confirm('לצאת ממצב מנהל?')) return;
  ADMIN.token = '';
  sessionStorage.removeItem('shira_admin');
  await loadCatalog();                 // back to what a visitor sees
  showAdminUI(true);
  toast('יצאת ממצב מנהל');
};

/* what to do once the sign-in succeeds — the record key sets this before it
   sends the user to the login sheet */
let pendingAfterLogin = '';

$('adminBtn').onclick = () => {
  $('liErr').classList.add('hidden');
  if (!$('liUser').value) $('liUser').value = ADMIN.user || '';
  openModal('loginModal');
  setTimeout(() => ($('liUser').value ? $('liPass') : $('liUser')).focus(), 60);
};
$('liGo').onclick = async () => {
  const r = await fetch('api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: $('liUser').value.trim(),
                           password: $('liPass').value.trim() }),
  }).then(r => r.json()).catch(() => ({}));
  if (r.ok && r.record_only) {
    // the live site: this signs in for recording alone, nothing else opens
    REC.user = $('liUser').value.trim();
    REC.pass = $('liPass').value.trim();
    $('liPass').value = '';
    closeModal('loginModal');
    toast('נכנסת — אפשר להקליט');
    if (pendingAfterLogin === 'record') { pendingAfterLogin = ''; openRecordForm(); }
  } else if (r.ok) {
    ADMIN.token = r.token;
    sessionStorage.setItem('shira_admin', r.token);
    $('liPass').value = '';
    closeModal('loginModal');
    await loadCatalog();                 // admins also see hidden recordings
    showAdminUI(true);
    toast('נכנסת כמנהל — אפשר להוסיף ולערוך');
    // signing in was only a step on the way to recording
    if (pendingAfterLogin === 'record') { pendingAfterLogin = ''; openRecordForm(); }
  } else if (r.error === 'too many attempts') {
    // the counter blocks even a correct password, so say so plainly
    const m = Math.ceil((r.wait || 600) / 60);
    fail(`נחסמת זמנית אחרי 8 נסיונות כושלים. נסה שוב בעוד ${m} דקות — ` +
         `גם הסיסמה הנכונה תידחה עד אז.`);
  } else if (r.disabled) {
    fail('כניסת מנהל מושבתת — אין ADMIN_PASSWORD ב‑.env של השרת.');
  } else if (r.bad_user) {
    fail(`שם המשתמש אינו נכון. הוא אמור להיות «${ADMIN.user || 'oshersa'}».` +
         (r.left ? ` נותרו ${r.left} נסיונות.` : ''));
  } else {
    fail('הסיסמה שגויה — אותה סיסמה המשמשת לעריכת התורה.' +
         (r.left ? ` נותרו ${r.left} נסיונות.` : ''));
  }
  function fail(msg) {
    $('liErr').textContent = msg;
    $('liErr').classList.remove('hidden');
  }
};
$('liUser').addEventListener('keydown', e => { if (e.key === 'Enter') $('liPass').focus(); });
$('liPass').addEventListener('keydown', e => { if (e.key === 'Enter') $('liGo').click(); });

/* ----------------------------------------------------------------- upload */
$('addBtn').onclick = () => {
  $('upErr').classList.add('hidden');
  $('dlPiyyut').innerHTML = C.piyyutim.slice(0, 400)
    .map(p => `<option value="${esc(p.name)}">`).join('');
  $('dlPerf').innerHTML = C.performers
    .map(p => `<option value="${esc(p.name)}">`).join('');
  $('upEvent').innerHTML = C.events
    .map(e => `<option${e.name === 'שונות' ? ' selected' : ''}>${esc(e.name)}</option>`).join('');
  openModal('addModal');
};
$('upFiles').addEventListener('change', e => {
  const fs = [...e.target.files];
  $('upList').innerHTML = fs.map(f =>
    `<div>${esc(f.name)} — ${(f.size / 1048576).toFixed(1)} MB</div>`).join('');
});

$('upGo').onclick = () => {
  const files = $('upFiles').files;
  const piyyut = $('upPiyyut').value.trim();
  const err = m => { $('upErr').textContent = m; $('upErr').classList.remove('hidden'); };
  if (!files.length) return err('לא נבחר קובץ שמע.');
  if (!piyyut)       return err('שם הפיוט הוא שדה חובה.');

  const fd = new FormData();
  [...files].forEach(f => fd.append('file', f));
  fd.append('piyyut', piyyut);
  fd.append('performer', $('upPerf').value.trim());
  fd.append('event', $('upEvent').value);
  fd.append('title', $('upTitle').value.trim());
  fd.append('note',  $('upNote').value.trim());

  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'api/upload');
  xhr.setRequestHeader('X-Admin-Token', ADMIN.token);
  $('upErr').classList.add('hidden');
  $('upBar').classList.remove('hidden');
  $('upGo').disabled = true;
  xhr.upload.onprogress = e => {
    if (e.lengthComputable)
      $('upBar').firstElementChild.style.width = (e.loaded / e.total * 100) + '%';
  };
  xhr.onload = async () => {
    $('upGo').disabled = false;
    $('upBar').classList.add('hidden');
    $('upBar').firstElementChild.style.width = '0';
    let r = {};
    try { r = JSON.parse(xhr.responseText); } catch (e) {}
    if (!r.ok) {
      if (xhr.status === 401) {
        ADMIN.token = ''; sessionStorage.removeItem('shira_admin'); showAdminUI();
        return err('פג תוקף הכניסה. היכנס שוב כמנהל.');
      }
      return err(r.error || 'ההעלאה נכשלה.');
    }
    closeModal('addModal');
    ['upPiyyut', 'upPerf', 'upTitle', 'upNote'].forEach(id => $(id).value = '');
    $('upFiles').value = ''; $('upList').innerHTML = '';
    await loadCatalog();
    toast(`נוסף לאוצר: ${r.rec.piyyut} · ${r.rec.tracks.length === 1
            ? 'רצועה אחת' : r.rec.tracks.length + ' רצועות'}`);
    markNewsSeen();                       // the uploader has obviously seen it
    F.q = ''; $('q').value = ''; F.perf = F.event = 0;
    F.piyyut = (C.piyyutim.find(p => p.name === r.rec.piyyut) || {}).id || 0;
    go('rec');
  };
  xhr.onerror = () => {
    $('upGo').disabled = false; $('upBar').classList.add('hidden');
    err('שגיאת רשת בהעלאה.');
  };
  xhr.send(fd);
};

/* ------------------------------------------------- admin: edit a recording */
let edKey = null;

function openEdit(recId) {
  const r = byId(C.recordings, recId);
  if (!r) return;
  edKey = (r.tr && r.tr[0] ? r.tr[0].f : '') || r.dir;
  $('edWhat').textContent =
    `${perfName(r.p)} · ${eventName(r.e)} · ` +
    `${r.n === 1 ? 'רצועה אחת' : r.n + ' רצועות'} · ${dur(r.s)}`;
  // when the shown name came from the description, the title box stays empty —
  // filling it in would silently promote the description to an explicit title
  $('edTitle').value = r.from_desc ? '' : (r.ttl || '');
  $('edTitle').placeholder = r.from_desc
    ? 'ריק — מוצג התיאור שלמטה' : 'שם ההקלטה';
  $('edDesc').value  = r.desc || '';
  $('edPerf').value  = perfName(r.p);
  $('edYear').value  = r.year || '';
  $('edNote').value  = r.note || '';
  $('edPub').checked = !r.hidden;
  fillPerfSelect($('edPerf'), perfName(r.p));
  $('edNewPerfWrap').classList.add('hidden');
  $('edNewPerf').value = '';
  const ev = eventName(r.e);
  $('edEvent').innerHTML = C.events
    .map(e => `<option${e.name === ev ? ' selected' : ''}>${esc(e.name)}</option>`).join('');
  $('edErr').classList.add('hidden');

  // spell out what deletion will actually touch — an upload and a master
  // recording are not the same kind of loss
  edRec = r;
  const uploads = r.tr.filter(t => (t.f || '').startsWith('added/')).length;
  $('edDelWhat').textContent = uploads
    ? `${uploads} מקובצי ההקלטה הועלו דרך הממשק והם יועברו לתיקיית deleted/. ` +
      `ההקלטה תרד מן האינדקס ומכל מה שמוגש.`
    : `ההקלטה תרד מן האינדקס ומכל מה שמוגש, ולא תועלה לשרת. ` +
      `${r.n} קובצי המקור בארכיון לא ייגעו — הם העותק היחיד שלהם.`;
  $('edDelOk').checked = false;
  $('edDel').disabled = true;
  openModal('editModal');
}

let edRec = null;
$('edDelOk').onchange = e => { $('edDel').disabled = !e.target.checked; };

/* the performer picker is fed from the managed list, with a way to register a
 * new name without leaving the recording being edited */
const NEW_PERF = '__new__';
function fillPerfSelect(sel, chosen) {
  const names = C.performers.map(p => p.name)
    .sort((a, b) => a.localeCompare(b, 'he'));
  sel.innerHTML = names.map(n =>
    `<option${n === chosen ? ' selected' : ''}>${esc(n)}</option>`).join('') +
    `<option value="${NEW_PERF}">＋ מבצע חדש…</option>`;
}
$('edPerf').addEventListener('change', e => {
  const isNew = e.target.value === NEW_PERF;
  $('edNewPerfWrap').classList.toggle('hidden', !isNew);
  if (isNew) setTimeout(() => $('edNewPerf').focus(), 50);
});

/* ------------------------------------------------ סנכרון לאתר החי (מנהל)
 * The live site serves whatever catalog is committed, so publishing is:
 * rebuild → see what changed → push. The report says how much moved.
 */
$('syncBtn').onclick = () => {
  $('syncTitle').textContent = 'סנכרון היחידה לאתר החי';
  $('syncBody').innerHTML = `<p class="hint">
    היחידה תיבנה מחדש מן הנתונים המקומיים — כולל מחיקות, עריכות ושינויי שמות —
    ותידחף לאתר החי. האתר יתעדכן תוך כמה דקות.</p>`;
  $('syncGo').disabled = false;
  $('syncGo').textContent = 'סנכרן עכשיו';
  openModal('syncModal');
};

$('syncGo').onclick = async () => {
  $('syncGo').disabled = true;
  $('syncGo').textContent = 'מסנכרן…';
  $('syncBody').innerHTML = '<p class="hint">בונה את הקטלוג ודוחף…</p>';

  const r = await fetch('api/sync', {
    method: 'POST', headers: { 'X-Admin-Token': ADMIN.token },
  }).then(r => r.json()).catch(e => ({ ok: false, error: String(e) }));

  if (!r.ok) {
    const where = { build: 'בבניית הקטלוג', add: 'בהוספה ל-git',
                    commit: 'בשמירת השינוי', push: 'בדחיפה לאתר',
                    run: 'בהרצה' }[r.stage] || '';
    $('syncTitle').textContent = 'הסנכרון נכשל';
    $('syncBody').innerHTML =
      `<p class="err">הסנכרון נעצר ${esc(where)}.</p>` +
      (r.hint ? `<p class="hint">${esc(r.hint)}</p>` : '') +
      `<pre class="synclog">${esc(r.error || 'ללא פירוט')}</pre>`;
    $('syncGo').disabled = false;
    $('syncGo').textContent = 'נסה שוב';
    return toast('הסנכרון נכשל', true);
  }

  if (r.nothing) {
    $('syncTitle').textContent = 'אין מה לסנכרן';
    $('syncBody').innerHTML =
      '<p class="hint">האתר החי כבר מעודכן — לא נמצא שינוי להעלות.</p>';
    $('syncGo').classList.add('hidden');
    return toast('האתר כבר מעודכן');
  }

  const d = r.diff || {};
  const rows = d.first
    ? [['הקלטות שפורסמו', d.recordings]]
    : [['הקלטות שהוסרו', d.removed], ['הקלטות שנוספו', d.added],
       ['הקלטות שעודכנו', d.edited],
       ['הקלטות באתר', `${d.recordings_before} ← ${d.recordings_after}`],
       ['מבצעים', `${d.performers_before} ← ${d.performers_after}`]];
  const total = d.first ? d.recordings : (d.removed + d.added + d.edited);

  $('syncTitle').textContent = 'הסנכרון הושלם';
  $('syncBody').innerHTML =
    `<p class="syncbig">${total} עדכונים נשלחו לאתר</p>` +
    '<table class="synctab">' + rows.map(([k, v]) =>
      `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('') + '</table>' +
    `<p class="hint">${r.files} קבצים נדחפו · גרסה ${esc(r.commit || '')} ·
      האתר החי יתעדכן תוך כמה דקות.</p>`;
  $('syncGo').classList.add('hidden');
  toast(`הסנכרון הושלם — ${total} עדכונים`);
  await loadCatalog();
};

/* ------------------------------------------- ניהול רשימת המבצעים (מנהל) */
$('perfBtn').onclick = () => { drawPerfList(); openModal('perfListModal'); };

function drawPerfList() {
  const list = C.performers.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'));
  $('perfListBody').innerHTML = list.map(p => `
    <div class="qrow">
      <span class="qt"><b>${esc(p.name)}</b><br>
        <span class="s">${p.n_rec} הקלטות${p.years ? ' · ' + esc(p.years) : ''}${
          p.photo ? ' · יש תמונה' : ''}</span></span>
      <button class="btn ghost" data-pren="${esc(p.name)}">✎ שם</button>
      <button class="btn ghost" data-pedit="${esc(p.name)}">פרטים</button>
    </div>`).join('');
  $('perfListBody').querySelectorAll('[data-pedit]').forEach(b =>
    b.onclick = () => {
      const p = C.performers.find(x => x.name === b.dataset.pedit);
      if (p) { closeModal('perfListModal'); openPerf(p); }
    });
  $('perfListBody').querySelectorAll('[data-pren]').forEach(b =>
    b.onclick = () => renamePerformer(b.dataset.pren));
}

/* Renaming onto a name that already exists merges the two — that is how the
 * duplicate entries in this list get folded together. */
async function renamePerformer(old) {
  const name = prompt(
    `שם חדש ל«${old}».\n` +
    'הזנת שם שכבר קיים תאחד את השניים לאותו מבצע.', old);
  if (!name || !name.trim() || name.trim() === old) return;
  const fresh = name.trim();
  const merging = C.performers.some(p => p.name === fresh);
  if (merging && !confirm(`«${fresh}» כבר קיים. לאחד את «${old}» לתוכו?`)) return;

  const r = await fetch('api/rename_performer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': ADMIN.token },
    body: JSON.stringify({ old, new: fresh }),
  }).then(r => r.json()).catch(() => ({}));
  if (!r.ok) return toast(r.error === 'unauthorized'
    ? 'פג תוקף הכניסה. היכנס שוב.' : 'השינוי נכשל', true);
  await loadCatalog();
  drawPerfList();
  draw();
  toast(merging ? `«${old}» אוחד לתוך «${fresh}»` : `השם שונה ל«${fresh}»`);
}

async function addPerformer(name) {
  const fd = new FormData();
  fd.append('name', name);
  fd.append('create', '1');
  const r = await fetch('api/performer', {
    method: 'POST', headers: { 'X-Admin-Token': ADMIN.token }, body: fd,
  }).then(r => r.json()).catch(() => ({}));
  if (r.ok) await loadCatalog();
  return r.ok;
}

$('npAdd').onclick = async () => {
  const name = $('npName').value.trim();
  const err = m => { $('npErr').textContent = m; $('npErr').classList.remove('hidden'); };
  if (!name) return err('יש להזין שם.');
  if (C.performers.some(p => p.name === name)) return err('המבצע כבר קיים ברשימה.');
  $('npErr').classList.add('hidden');
  if (!await addPerformer(name)) return err('ההוספה נכשלה — ייתכן שפג תוקף הכניסה.');
  $('npName').value = '';
  drawPerfList();
  toast(`«${name}» נוסף לרשימת המבצעים`);
};
$('npName').addEventListener('keydown', e => { if (e.key === 'Enter') $('npAdd').click(); });

$('edDel').onclick = async () => {
  if (!edRec || !$('edDelOk').checked) return;
  const r = await fetch('api/delete_recording', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': ADMIN.token },
    body: JSON.stringify({ key: edKey, title: edRec.ttl,
                           files: edRec.tr.map(t => t.f) }),
  }).then(r => r.json()).catch(() => ({}));
  if (!r.ok) {
    $('edErr').textContent = r.error === 'unauthorized'
      ? 'פג תוקף הכניסה. היכנס שוב.' : (r.error || 'ההסרה נכשלה.');
    $('edErr').classList.remove('hidden');
    return;
  }
  const gone = edRec.ttl;
  closeModal('editModal');
  if (cur.rec === edRec.id) { au.pause(); stopAudio(); $('deckWin').classList.add('hidden'); }
  PL.lists.forEach(l => { l.items = l.items.filter(id => id !== edRec.id); });
  plSave();
  await loadCatalog();
  await loadTrash();
  toast(`«${gone}» הועברה לסל המחזור` +
        (r.trashed ? ` · ${r.trashed} קבצים` : ' · קובצי המקור נשמרו בארכיון'));
};

$('edGo').onclick = async () => {
  // a name typed into the "new performer" box joins the list first, so the
  // recording is linked to a real entry and not to a loose string
  let performer = $('edPerf').value;
  if (performer === NEW_PERF) {
    const fresh = $('edNewPerf').value.trim();
    if (!fresh) {
      $('edErr').textContent = 'יש להזין שם למבצע החדש.';
      return $('edErr').classList.remove('hidden');
    }
    if (!C.performers.some(p => p.name === fresh) && !await addPerformer(fresh)) {
      $('edErr').textContent = 'הוספת המבצע נכשלה.';
      return $('edErr').classList.remove('hidden');
    }
    performer = fresh;
  }
  const body = {
    key:   edKey,
    title: $('edTitle').value.trim(),
    desc:  $('edDesc').value.trim(),
    performer,
    year:  $('edYear').value.trim(),
    event: $('edEvent').value,
    note:  $('edNote').value.trim(),
    hidden: !$('edPub').checked,
  };
  const r = await fetch('api/override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': ADMIN.token },
    body: JSON.stringify(body),
  }).then(r => r.json()).catch(() => ({}));
  if (!r.ok) {
    $('edErr').textContent = r.error === 'unauthorized'
      ? 'פג תוקף הכניסה. היכנס שוב.' : (r.error || 'השמירה נכשלה.');
    $('edErr').classList.remove('hidden');
    return;
  }
  closeModal('editModal');
  await loadCatalog();
  toast(body.hidden ? 'נשמר — ההקלטה הוסתרה מהאתר' : 'ההקלטה עודכנה');
};

/* --------------------------------------------------- admin: edit a person */
let pfName = null;

function openPerf(p) {
  pfName = p.name;
  $('pfTitle').textContent = 'עריכת מבצע — ' + p.name;
  $('pfPreview').innerHTML = p.photo
    ? `<img src="${esc(p.photo)}" alt=""><div class="pf-credit">${esc(p.credit || 'ללא קרדיט')}</div>`
    : '<span class="none">אין תמונה משויכת.</span>';
  $('pfPhoto').value = '';
  $('pfCredit').value = p.credit || '';
  $('pfYears').value  = p.years || '';
  $('pfBio').value    = p.bio || '';
  $('pfErr').classList.add('hidden');
  openModal('perfModal');
}

async function savePerf(extra) {
  const fd = new FormData();
  fd.append('name', pfName);
  fd.append('credit', $('pfCredit').value.trim());
  fd.append('years',  $('pfYears').value.trim());
  fd.append('bio',    $('pfBio').value.trim());
  if (extra) fd.append(extra, '1');
  if (!extra && $('pfPhoto').files[0]) fd.append('photo', $('pfPhoto').files[0]);
  const r = await fetch('api/performer', {
    method: 'POST', headers: { 'X-Admin-Token': ADMIN.token }, body: fd,
  }).then(r => r.json()).catch(() => ({}));
  if (!r.ok) {
    $('pfErr').textContent = r.error === 'unauthorized'
      ? 'פג תוקף הכניסה. היכנס שוב.' : (r.error || 'השמירה נכשלה.');
    $('pfErr').classList.remove('hidden');
    return;
  }
  closeModal('perfModal');
  await loadCatalog();
  toast('פרטי המבצע נשמרו');
}
$('pfGo').onclick  = () => savePerf(null);
$('pfDel').onclick = () => savePerf('remove_photo');

/* ---------------------------------------------------------------- מה חדש */
let NEWS = [];
const seenAt = () => localStorage.getItem('shira_seen') || '';

function freshCount() { return NEWS.filter(n => (n.added || '') > seenAt()).length; }

function drawNews() {
  const n = freshCount();
  $('newsBadge').textContent = n;
  $('newsBadge').classList.toggle('hidden', !n);

  $('newsBody').innerHTML = NEWS.length ? NEWS.map(it => {
    const fresh = (it.added || '') > seenAt();
    const secs  = (it.tracks || []).reduce((a, t) => a + (t.s || 0), 0);
    return `<div class="news-item${fresh ? ' fresh' : ''}" data-piy="${esc(it.piyyut)}">
      <h4>${esc(it.title || it.piyyut)}</h4>
      <div class="m">${esc(it.performer)} · ${esc(it.event)} · ${it.tracks.length} רצועות · ${dur(secs)}
        · נוסף ב־${esc((it.added || '').replace('T', ' ').slice(0, 16))}</div>
    </div>`;
  }).join('') : '<p class="news-empty">עדיין לא נוספו הקלטות חדשות לאוצר.</p>';

  $('newsBody').querySelectorAll('[data-piy]').forEach(el => {
    el.onclick = () => {
      const p = C.piyyutim.find(x => x.name === el.dataset.piy);
      closeModal('newsModal');
      if (p) { F.perf = F.event = 0; F.q = ''; $('q').value = ''; F.piyyut = p.id; go('rec'); }
    };
  });
}

function markNewsSeen() {
  const latest = NEWS.reduce((a, n) => (n.added || '') > a ? n.added : a, '');
  if (latest) localStorage.setItem('shira_seen', latest);
  drawNews();
}

/* the second tab: what the app itself gained, newest first */
const FEATURES = [
  ['רשימות השמעה אישיות',
   'אפשר לסמן הקלטות בכפתור ♪+, לתת שם לרשימה ולשמור אותה על המכשיר. ' +
   'בכל רשימה אפשר לסדר מחדש את הסדר, להסיר פריטים, לנגן ברצף או באקראי, ' +
   'ולבחור חזרה על רצועה או על הרשימה כולה.'],
  ['השמעה אקראית רציפה',
   'כפתור בכותרת שבוחר הקלטה אקראית ומנגן אותה במלואה לפני שהוא עובר להבאה. ' +
   'הקלטה מרובת רצועות נחשבת יחידה אחת.'],
  ['נגן קלטת',
   'לחיצה על הקלטה פותחת חלון נגן שאפשר למזער. ראש הטייפ נכנס פנימה ב‑PLAY, ' +
   'הסלילים מתגלגלים לפי מיקום ההשמעה ונעצרים בהשהיה, ו‑STOP מגלגל את הסרט ' +
   'לאחור. פרטי ההקלטה נכתבים על התווית, ויש מהירות 0.5×–2× ובקרת עוצמה.'],
  ['צלילי מנגנון',
   'נקישת כפתור ב‑PLAY וב‑STOP, וצלילי גלגול בהרצה קדימה ולאחור.'],
  ['מיון בכל האינדקסים',
   'מבצעים, פיוטים, חגים והקלטות — לפי אורך, לפי מספר הקלטות, לפי א־ב ועוד. ' +
   'כל עמוד זוכר את הבחירה שלו.'],
  ['תמונות מבצעים',
   'עמוד המבצעים מציג תמונה, שנות פעילות ותיאור לכל מבצע שהוזנו לו.'],
  ['שמות מלאים למבצעים',
   'שמות הכינויים שהארכיון תויק לפיהם הוחלפו בשמות המלאים, וכמה רישומים ' +
   'שהיו נפרדים אוחדו לאותו אדם.'],
  ['ניהול למנהל',
   'העלאת הקלטות, עריכת כותרת, תיאור, מבצע, שנה, שיוך לחג והערת עורך, ' +
   'הסתרה מן האתר, הסרה לסל מחזור והשבה ממנו.'],
];

function drawFeat() {
  $('newsFeat').innerHTML = FEATURES.map(([t, d]) =>
    `<div class="feat"><h4>${esc(t)}</h4><p>${esc(d)}</p></div>`).join('');
}

$('newsTabs').addEventListener('click', e => {
  const b = e.target.closest('.subtab');
  if (!b) return;
  const items = b.dataset.ntab === 'items';
  $('newsTabs').querySelectorAll('.subtab').forEach(x =>
    x.classList.toggle('on', x === b));
  $('newsBody').classList.toggle('hidden', !items);
  $('newsFeat').classList.toggle('hidden', items);
});

$('newsBtn').onclick  = () => { drawNews(); drawFeat(); openModal('newsModal'); };
$('newsSeen').onclick = () => { markNewsSeen(); closeModal('newsModal'); };

async function loadNews(announce) {
  NEWS = await fetch('api/whatsnew').then(r => r.json()).then(d => d.added || [])
           .catch(() => []);
  const n = freshCount();
  drawNews();
  if (announce && n) {
    toast(n === 1 ? 'הקלטה חדשה נוספה לאוצר'
                  : `${n} הקלטות חדשות נוספו לאוצר`);
    openModal('newsModal');                 // the "מה חדש" page on entry
  }
}

/* ---- what the archive holds, said in one line under the title.
 *
 * The pictures are counted alongside the recordings because they are part of
 * the holdings now and not a decoration: the community's own photographs from
 * its site, and the pictures and films off the archive drive. They are
 * counted from the same two lists the screen inside the deck reads, so the
 * number under the title and what actually comes up on that screen can never
 * drift apart. The count arrives a moment after the rest — the lists are
 * fetched — so the line is written once without it and again with it.
 */
const HOLD = { pix: 0, film: 0 };

function statsLine() {
  const bits = [
    `${C.meta.n_rec.toLocaleString('he')} הקלטות`,
    `${C.meta.n_tracks.toLocaleString('he')} רצועות`,
    `${Math.round(C.meta.seconds / 3600)} שעות`,
    `${C.meta.n_perf} מבצעים`,
    `${C.meta.n_piyyut} פיוטים`,
    `${C.meta.n_event} חגים ואירועים`,
  ];
  if (HOLD.pix) bits.push(`${HOLD.pix.toLocaleString('he')} תמונות`);
  if (HOLD.film) bits.push(`${HOLD.film} סרטונים`);
  let line = bits.join(' · ');
  if (HOLD.version) line += `   ·   גרסה ${HOLD.version}`;
  return line;
}

async function countPictures() {
  const one = async (url, pick) => {
    try {
      const j = await fetch(url).then(r => r.ok ? r.json() : null);
      return j ? pick(j) : null;
    } catch (e) { return null; }
  };
  const site = await one('data/pix_sources.json',
                         j => Array.isArray(j) ? { pix: j.length, film: 0 } : null);
  const mine = await one('data/local_media.json', j => {
    const items = (j && j.items) || [];
    // only what can actually be shown: without a base they are on a drive
    // this browser cannot reach, and counting them would be a boast
    if (!j.base && !(C.meta && C.meta.media_pix)) return { pix: 0, film: 0 };
    return { pix: items.filter(x => x.kind !== 'video').length,
             film: items.filter(x => x.kind === 'video').length };
  });
  HOLD.pix  = (site ? site.pix : 0) + (mine ? mine.pix : 0);
  HOLD.film = (site ? site.film : 0) + (mine ? mine.film : 0);
  // which build this is — only the program on the archive's own machine
  // answers this, so online the line simply does not carry it
  const v = await one('api/version', j => j && j.version);
  if (v) HOLD.version = v;
  if (C && C.meta) $('stats').textContent = statsLine();
}

/* ------------------------------------------------------------------ boot */
async function loadCatalog() {
  // /api/catalog folds in uploads; the static file keeps the unit working
  // as a plain index with no server behind it.
  // the token matters: an admin's catalog also carries the hidden recordings
  C = await fetch('api/catalog', ADMIN.token
        ? { headers: { 'X-Admin-Token': ADMIN.token } } : undefined)
        .then(r => r.ok ? r.json() : Promise.reject())
        .catch(() => fetch('data/catalog.json').then(r => r.json()));
  $('stats').textContent = statsLine();
  countPictures();
  draw();
}

(async () => {
  headIn(false);                              // the head starts parked
  try {
    await loadCatalog();
  } catch (e) {
    $('stats').textContent = 'לא ניתן לטעון את הקטלוג.';
    $('empty').textContent = 'data/catalog.json חסר — הרץ scripts/build_catalog.py.';
    $('empty').classList.remove('hidden');
    return;
  }
  // a link shared out of the deck opens straight on its own recording
  openFromLink();
  addEventListener('hashchange', openFromLink);
  const st = await fetch('api/admin/status').then(r => r.json()).catch(() => ({}));
  ADMIN.enabled = !!st.enabled;
  ADMIN.user    = st.user || '';
  showAdminUI();
  // drop ids that no longer exist (a deleted or rebuilt recording)
  PL.lists.forEach(l => { l.items = l.items.filter(id => byId(C.recordings, id)); });
  drawQueue();
  await loadNews(true);
})();
