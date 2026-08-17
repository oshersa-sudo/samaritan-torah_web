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
  const q = fold(F.q), ql = loose(F.q);
  return C.recordings.filter(r => {
    if (skip !== 'perf'   && F.perf   && r.p !== F.perf)   return false;
    if (skip !== 'event'  && F.event  && r.e !== F.event)  return false;
    if (skip !== 'piyyut' && F.piyyut && r.y !== F.piyyut) return false;
    if (!q) return true;
    const hay = fold(`${r.ttl} ${perfName(r.p)} ${eventName(r.e)} ${piyName(r.y)}`);
    return hay.includes(q) || loose(hay).includes(ql);
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
}
const chip = (label, val, key) =>
  `<span class="chip"><b>${esc(label)}:</b> ${esc(val)}` +
  `<button data-k="${key}" title="הסר">✕</button></span>`;

/* ------------------------------------------------------------------ views */
function viewPiyyut() {
  const recs = filtered('piyyut');
  const live = new Set(recs.map(r => r.y));
  const q = fold(F.q), ql = loose(F.q);

  let list = C.piyyutim.filter(p => live.has(p.id));
  if (F.q) {                                    // also match the piyyut's own name
    const extra = C.piyyutim.filter(p =>
      !live.has(p.id) &&
      (fold(p.name).includes(q) || loose(p.name).includes(ql) ||
       p.variants.some(v => fold(v).includes(q))));
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
    meta:  `${count[p.id] || p.n_rec} הקלטות · ${hours(p.seconds)}` +
           (p.variants.length ? `<br><span dir="auto">גם: ${esc(p.variants.slice(0, 3).join(' · '))}</span>` : ''),
    tags:  named(p.events).slice(0, 2).map(e => ({ t: e, cls: 'ev' }))
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
  const q = fold(F.q);
  const s = SORT_STATE.perf;
  const list = C.performers
    .filter(p => count[p.id] || (F.q && fold(p.name).includes(q)))
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
  const q = fold(F.q);
  const s = SORT_STATE.event;
  // C.events already arrives in calendar order, so 'year' just keeps it
  const list = C.events.filter(e => count[e.id] || (F.q && fold(e.name).includes(q)));
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
        ${r.desc ? `<span class="s">${esc(r.desc)}</span>` : ''}
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
  drawSort();
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
  if (!quiet && !sameRec) sfx('play');   // the deck's own click
  mixInit();                            // the chain must exist before playback
  if (MIX.ctx && MIX.ctx.state === 'suspended') MIX.ctx.resume();
  au.play().catch(() => {});
  setRate($('prate').value);            // a new source resets playbackRate
  openDeck();
  headIn(true);
  deckLabel(r, idx);
  $('dwName').textContent = r.ttl;
  markPlaying();
  $('ptitle').textContent = r.ttl + (r.tr.length > 1 ? ` · רצועה ${idx + 1}/${r.tr.length}` : '');
  $('psub').textContent   = `${perfName(r.p)} · ${eventName(r.e)}`;
  syncBtn();                 // never write into #pbtn — it holds the two icons
  clearErr();
  markPlaying();
}

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
$('dwClose').onclick = () => {
  au.pause(); stopAudio();
  headIn(false);
  $('deckWin').classList.add('hidden');
  deckLabel(null, 0);
};

/* ---------------------------------------------------- the tape head
 * The head assembly is parked 96 units below the slot in the artwork.
 * Play drives it up into the cassette; stop parks it again. */
function headIn(on) {
  $('head').style.transform = on ? 'translate(0px,0px)' : 'translate(0px,96px)';
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
  if (!au.src) return;
  au.pause();
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

/* nudge buttons */
$('prew').onclick = () => { if (au.src) au.currentTime = Math.max(0, au.currentTime - 15); };
$('pff').onclick  = () => { if (au.src && au.duration)
                              au.currentTime = Math.min(au.duration, au.currentTime + 15); };

function syncBtn() {
  $('icPlay').classList.toggle('hidden', !au.paused);
  $('icPause').classList.toggle('hidden', au.paused);
  $('pbtn').title = au.paused ? 'נגן' : 'השהה';
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

function mixInit() {
  if (MIX.ctx) return MIX.nodes;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    const ctx = new AC();
    const src  = ctx.createMediaElementSource(au);
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

    src.connect(hp); hp.connect(lp); lp.connect(bass); bass.connect(mid);
    mid.connect(treb); treb.connect(comp); comp.connect(gain);
    gain.connect(an);  an.connect(ctx.destination);

    MIX.ctx = ctx;
    MIX.nodes = { src, hp, lp, bass, mid, treb, comp, gain, an };
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
  n.hp.frequency.value = Math.max(20, v('mHP'));
  n.lp.frequency.value = v('mLP');
  const amt = v('mComp');                     // 0 → off, 40 → firm
  n.comp.threshold.value = amt ? -amt : 0;
  n.comp.ratio.value     = amt ? 1 + amt / 8 : 1;
  n.gain.gain.value      = v('mGain') / 100;
  const dB = x => (x > 0 ? '+' : '') + x;
  $('mBassN').textContent = dB(v('mBass'));
  $('mMidN').textContent  = dB(v('mMid'));
  $('mTrebN').textContent = dB(v('mTreb'));
  $('mHPN').textContent   = v('mHP') ? v('mHP') + ' הרץ' : 'כבוי';
  $('mLPN').textContent   = v('mLP') >= 20000 ? 'כבוי' : Math.round(v('mLP') / 1000) + ' קילוהרץ';
  $('mCompN').textContent = amt ? amt + '' : 'כבוי';
  $('mGainN').textContent = v('mGain') + '%';
  localStorage.setItem('shira_mix', JSON.stringify(
    ['mBass','mMid','mTreb','mHP','mLP','mComp','mGain'].map(id => $(id).value)));
}

function mixSet(vals) {
  ['mBass','mMid','mTreb','mHP','mLP','mComp','mGain']
    .forEach((id, i) => { $(id).value = vals[i]; });
  mixApply();
}
$('mFlat').onclick  = () => { mixSet([0, 0, 0, 0, 20000, 0, 100]); $('mixNote').textContent = 'ללא עיבוד'; };
$('mVoice').onclick = () => { mixSet([-3, 4, 2, 90, 20000, 14, 115]); $('mixNote').textContent = 'הדגשת הדיבור והחזנות'; };
$('mTape').onclick  = () => { mixSet([2, 1, -4, 70, 7000, 20, 125]); $('mixNote').textContent = 'ריכוך רעש סרט והחזרת גוף'; };
['mBass','mMid','mTreb','mHP','mLP','mComp','mGain'].forEach(id =>
  $(id).addEventListener('input', () => { mixApply(); $('mixNote').textContent = ''; }));

$('mixToggle').onclick = () => {
  const open = $('mixer').classList.toggle('hidden');
  $('mixToggle').classList.toggle('on', !open);
  if (!open) mixApply();
};

/* --------------------------------------------------------------- VU lamps */
const LAMPS = 14;
(function buildVU() {
  $('vu').innerHTML = Array.from({ length: LAMPS }, (_, i) =>
    `<i class="${i < LAMPS * 0.62 ? 'g' : i < LAMPS * 0.85 ? 'y' : 'r'}"></i>`).join('');
})();
const vuBuf = new Uint8Array(1024);

function vuTick() {
  const lamps = $('vu').children;
  let lit = 0;
  if (MIX.nodes && !au.paused) {
    MIX.nodes.an.getByteTimeDomainData(vuBuf);
    let sum = 0;
    for (let i = 0; i < vuBuf.length; i++) {
      const d = (vuBuf[i] - 128) / 128;
      sum += d * d;
    }
    const rms = Math.sqrt(sum / vuBuf.length);
    lit = Math.round(Math.min(1, rms * 3.2) * LAMPS);
  }
  for (let i = 0; i < lamps.length; i++) lamps[i].classList.toggle('on', i < lit);
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

/* A seek plays the matching tape noise: which way the tape ran decides it. */
let seekFrom = 0, switching = false;
au.addEventListener('seeking', () => {
  if (switching) return;                      // a track change, not a wind
  const d = au.currentTime - seekFrom;
  if (Math.abs(d) < 1.2) return;              // a nudge is not a wind
  sfxStop(d < 0 ? 'forward' : 'rewind');
  sfx(d < 0 ? 'rewind' : 'forward');
});
au.addEventListener('timeupdate', () => { seekFrom = au.currentTime; });
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

function deckPaint() {
  const t = au.currentTime || 0;
  if (t === deckLast) return;             // paused: nothing to redraw
  deckLast = t;
  const a = t * DEG_PER_SEC;              // + winds forward, − winds back
  $('reelL').style.transform = `rotate(${a}deg)`;
  $('reelR').style.transform = `rotate(${a}deg)`;
  // The tape runs the same way the seek bar does, left to right: the left reel
  // starts full and empties, the right one fills.
  const p = au.duration ? Math.min(1, Math.max(0, t / au.duration)) : 0;
  $('tapeL').setAttribute('r', (88 - 48 * p).toFixed(1));
  $('tapeR').setAttribute('r', (40 + 48 * p).toFixed(1));
  $('cTime').textContent = `${dur(t)} / ${dur(au.duration || 0)}`;
}

/* Most track names in the archive are bare numbering ("AudioTrack 04"); those
 * say nothing, so the position within the recording is shown instead. */
const BARE_TRACK = /^(?:\d{1,3}|(?:audio)?track\s*\d+|\d+\s*[-_. ]\s*(?:audio)?track\s*\d+|\d+\s*רצועה\s*\d+|temp\d*)$/i;

function trackName(r, idx) {
  const t = r.tr[idx] || {};
  const raw = (t.n || '').trim();
  if (raw && !BARE_TRACK.test(raw)) return raw;
  return r.tr.length > 1 ? `${r.ttl} · ${idx + 1}/${r.tr.length}` : r.ttl;
}

/* the cassette's label carries the track and the performer */
function deckLabel(r, idx) {
  const cut = (s, n) => (s || '').length > n ? s.slice(0, n - 1) + '…' : (s || '');
  $('cTitle').textContent = r ? cut(trackName(r, idx), 30) : '—';
  $('cPerf').textContent  = r ? cut(perfName(r.p), 30) : 'בחר הקלטה כדי לנגן';
  $('cRec').textContent   = r ? cut(r.ttl, 34) : 'אוצר השירה השומרונית';
  $('cLine2').textContent = r && r.year ? r.year : '';
  $('cEvent').textContent = r ? eventName(r.e) : '—';
  $('cParts').textContent = r ? (r.parts ? `${r.parts} חלקים` : `${r.n} רצועות`) : 'C-90';
}

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
  rewind:  'sounds/rewind.mp3',  // הרצה לאחור
  forward: 'sounds/forward.mp3', // הרצה קדימה
  pause:   '',                   // ללא צליל
};
const SFX = {};
for (const [k, src] of Object.entries(SOUNDS)) {
  if (!src) continue;
  SFX[k] = new Audio(src);
  SFX[k].preload = 'auto';
}

function sfx(name) {
  const a = SFX[name];
  if (!a || au.muted) return;
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
  au.playbackRate = v;
  au.preservesPitch = au.mozPreservesPitch = au.webkitPreservesPitch = true;
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
  localStorage.setItem('shira_vol', v);
  localStorage.setItem('shira_muted', au.muted ? '1' : '');
}
$('pvup').onclick  = () => setVol(au.volume + 0.1, false);
$('pvdn').onclick  = () => setVol(au.volume - 0.1);
$('pmute').onclick = () => setVol(au.volume, !au.muted);
setVol(parseFloat(localStorage.getItem('shira_vol') ?? '1'),
       localStorage.getItem('shira_muted') === '1');
$('prate').addEventListener('input', e => setRate(e.target.value));
$('prate').addEventListener('dblclick', () => setRate(1));   // snap back to 1×
setRate(localStorage.getItem('shira_rate') || 1);

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
const closeModal = id => $(id).classList.add('hidden');
document.querySelectorAll('[data-close]').forEach(b =>
  b.onclick = () => closeModal(b.dataset.close));
document.querySelectorAll('.modal').forEach(m =>
  m.onclick = e => { if (e.target === m) m.classList.add('hidden'); });

function showAdminUI(redraw) {
  $('addBtn').classList.toggle('hidden', !ADMIN.token);
  $('trashBtn').classList.toggle('hidden', !ADMIN.token);   // admins only
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

async function loadTrash() {
  if (!ADMIN.token) { TRASH = []; return drawTrash(); }
  const r = await fetch('api/trash', { headers: { 'X-Admin-Token': ADMIN.token } })
    .then(r => r.json()).catch(() => ({}));
  TRASH = r.items || [];
  drawTrash();
}

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
    </div>`).join('')
    : '<p class="news-empty">סל המחזור ריק.</p>';
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
  if (r.ok) {
    ADMIN.token = r.token;
    sessionStorage.setItem('shira_admin', r.token);
    $('liPass').value = '';
    closeModal('loginModal');
    await loadCatalog();                 // admins also see hidden recordings
    showAdminUI(true);
    toast('נכנסת כמנהל — אפשר להוסיף ולערוך');
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
  $('edTitle').value = r.ttl || '';
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

/* ------------------------------------------------------------------ boot */
async function loadCatalog() {
  // /api/catalog folds in uploads; the static file keeps the unit working
  // as a plain index with no server behind it.
  // the token matters: an admin's catalog also carries the hidden recordings
  C = await fetch('api/catalog', ADMIN.token
        ? { headers: { 'X-Admin-Token': ADMIN.token } } : undefined)
        .then(r => r.ok ? r.json() : Promise.reject())
        .catch(() => fetch('data/catalog.json').then(r => r.json()));
  $('stats').textContent =
    `${C.meta.n_rec.toLocaleString('he')} הקלטות · ` +
    `${C.meta.n_tracks.toLocaleString('he')} רצועות · ` +
    `${Math.round(C.meta.seconds / 3600)} שעות · ` +
    `${C.meta.n_perf} מבצעים · ${C.meta.n_piyyut} פיוטים · ` +
    `${C.meta.n_event} חגים ואירועים`;
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
  const st = await fetch('api/admin/status').then(r => r.json()).catch(() => ({}));
  ADMIN.enabled = !!st.enabled;
  ADMIN.user    = st.user || '';
  showAdminUI();
  // drop ids that no longer exist (a deleted or rebuilt recording)
  PL.lists.forEach(l => { l.items = l.items.filter(id => byId(C.recordings, id)); });
  drawQueue();
  await loadNews(true);
})();
