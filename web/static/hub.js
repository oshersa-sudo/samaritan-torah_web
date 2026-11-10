/* התפריט הראשי — "אבני שהם".
 *
 * The page the app opens on: the Torah in a large circle in the middle, the five
 * other apps on a ring round it that turns like a combination lock. Whichever
 * circle is at the top has a pop-up beside it saying what that app gives.
 *
 * Loaded after app.js and touching it only from the outside — wrapping a few of
 * its global functions — so that the whole feature can be taken out by removing
 * the markup, hub.css and this file.
 */
(function(){
  'use strict';
  const hub = document.getElementById('hub');
  if(!hub) return;
  const $ = id => document.getElementById(id);

  // ── the apps ────────────────────────────────────────────────────────────────
  const ICON = {
    shira:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 18V5l12-2v13"/><path d="M9 9l12-2"/></svg>',
    calendar:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="15.5" r="1.6" fill="currentColor"/></svg>',
    library:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/></svg>',
    timeline:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="8" y1="10" x2="8" y2="5"/><circle cx="8" cy="12" r="2"/><line x1="16" y1="14" x2="16" y2="19"/><circle cx="16" cy="12" r="2"/></svg>',
    mss:'<svg class="hub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/></svg>'
  };
  // the order here is the order round the ring, clockwise from the top
  const APPS = [
    { key:'shira', name:'אוצר השירה', full:'אוצר השירה השומרונית',
      tag:'ארכיון ההקלטות של השירה והפיוט',
      points:['הקלטות פיוטים ושירות בקולם של בני העדה','חיפוש לפי פיוט, מבצע ופרשה','השמעה שממשיכה גם כשחוזרים לקרוא בתורה','מצב רכב להאזנה בנהיגה, והקלטה עצמית מן האפליקציה'],
      open:() => openShira() },
    { key:'calendar', name:'הלוח השומרוני', full:'חשבן קשטה — הלוח השומרוני',
      tag:'התאריך, המועדים ופרשת השבוע',
      points:['התאריך השומרוני של היום ושנת הכניסה לכנען','מועדי העדה, החגים והשבתות','הפרשה הנקראת בשבת הקרובה','לוח שנה מלא לשנים קדימה ואחורה'],
      open:() => openExternalUnit(CALENDAR_URL, t('m_calendar')) },
    { key:'library', name:'הספרייה', full:'הספרייה השומרונית',
      tag:'ספרי המסורת וכלי המחקר במקום אחד',
      points:['תיבת מרקה, פירוש צדקה אל-חכים, סוד הלבבות, האסאטיר ועוד','מילון ארמי–עברי של טל וחיפוש בו','פיוטים ומחפש חרוזים','אישים וחוקרים שומרוניים; מחקרי ורשנר וכהן בעברית'],
      open:() => openLibrary() },
    { key:'timeline', name:'ציר הזמן', full:'ציר הזמן ההיסטורי השומרוני',
      tag:'תולדות העדה לפי מניין השנים השומרוני',
      points:['אירועים, כהנים גדולים ותקופות על ציר אחד','מניין השנים השומרוני לצד הלועזי','כל פריט עם מקורו','מעבר מהיר בין תקופות'],
      open:() => openTimeline() },
    { key:'mss', name:'אוצר כתבי היד', full:'אוצר כתבי היד השומרוניים בתבל',
      tag:'כתבי היד השומרוניים בספריות העולם',
      points:['קטלוג כתבי היד של התורה ושל כתבי העדה בספריות ובאוספים ברחבי העולם','פרטי כל כתב יד ותיאורו','צפייה בדפי כתב היד'],
      open:() => (typeof window.openMss === 'function') && window.openMss() }
  ];
  const N = APPS.length, STEP = 360 / N;

  // ── build the ring ─────────────────────────────────────────────────────────
  const dial = $('hubDial');
  const sats = APPS.map((a, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hub-c hub-sat'; b.dataset.i = i;
    b.setAttribute('aria-label', a.full);
    b.innerHTML = ICON[a.key] + '<span class="hub-name">' + a.name + '</span>';
    dial.appendChild(b);
    return b;
  });
  const center = $('hubTorah');

  // the faint Samaritan page behind it all
  (function(){
    const ALPHA = 'ࠀࠁࠂࠃࠄࠅࠆࠇࠈࠉࠊࠋࠌࠍࠎࠏࠐࠑࠒࠓࠔࠕ'.split('');
    const cols = innerWidth < 560 ? 5 : 9;
    let h = '';
    for(let c = 0; c < cols; c++){
      let s = '';
      for(let i = 0; i < 46; i++){ s += ALPHA[(Math.random() * ALPHA.length) | 0]; if(Math.random() < .16) s += ' '; }
      h += '<div class="col">' + s + '</div>';
    }
    $('hubPages').innerHTML = h;
  })();

  // ── the turning ────────────────────────────────────────────────────────────
  let rot = 0;             // degrees the ring has been turned (not wrapped)
  let topIdx = -1;
  function topIndex(r){ return (((-Math.round(r / STEP)) % N) + N) % N; }
  function paint(r){
    sats.forEach((b, i) => b.style.setProperty('--a', (i * STEP + r).toFixed(2) + 'deg'));
  }
  function setTop(i){
    if(i === topIdx) return;
    topIdx = i;
    sats.forEach((b, k) => b.classList.toggle('top', k === i));
    showPop(i);
  }
  function turnTo(r){ rot = r; paint(rot); setTop(topIndex(rot)); }
  function snap(){ turnTo(Math.round(rot / STEP) * STEP); }
  function step(dir){ turnTo(Math.round(rot / STEP) * STEP + dir * STEP); }

  // ── the pop-up ─────────────────────────────────────────────────────────────
  const pop = $('hubPop');
  let popTimer = null;
  function fill(a){
    pop.innerHTML = '<h2></h2><p class="hub-tag"></p><ul></ul><button type="button" class="hub-go">כניסה לאפליקציה ›</button>';
    pop.querySelector('h2').textContent = a.full;
    pop.querySelector('.hub-tag').textContent = a.tag;
    const ul = pop.querySelector('ul');
    a.points.forEach(p => { const li = document.createElement('li'); li.textContent = p; ul.appendChild(li); });
    pop.querySelector('.hub-go').onclick = () => enter(a.key);
  }
  function showPop(i){
    const a = APPS[i];
    clearTimeout(popTimer);
    if(!pop.innerHTML){ fill(a); return; }
    pop.classList.add('swap');
    popTimer = setTimeout(() => { fill(a); pop.classList.remove('swap'); }, 170);
  }

  // ── dragging it like a dial ────────────────────────────────────────────────
  let drag = null, justDragged = false;
  function angleOf(e){
    const r = dial.getBoundingClientRect();
    return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
  }
  dial.addEventListener('pointerdown', e => {
    if(e.button !== undefined && e.button > 0) return;
    if(center.contains(e.target)) return;
    drag = { id:e.pointerId, a0:angleOf(e), r0:rot, x:e.clientX, y:e.clientY, moved:false, last:0 };
  });
  dial.addEventListener('pointermove', e => {
    if(!drag || e.pointerId !== drag.id) return;
    if(!drag.moved){
      if(Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return;
      drag.moved = true; dial.classList.add('dragging');
      try{ dial.setPointerCapture(e.pointerId); }catch(_){}
      drag.a0 = angleOf(e); drag.r0 = rot;          // start the turn from where it is now
    }
    let d = angleOf(e) - drag.a0;
    d = ((d + 540) % 360) - 180;                    // the short way round, never a jump
    drag.last = d;
    turnTo(drag.r0 + d);
  });
  function endDrag(e){
    if(!drag || (e && e.pointerId !== drag.id)) return;
    const moved = drag.moved;
    drag = null; dial.classList.remove('dragging');
    if(moved){ justDragged = true; setTimeout(() => { justDragged = false; }, 60); snap(); }
  }
  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);
  // a drag must not also count as a tap on the circle it ended over
  dial.addEventListener('click', e => { if(justDragged){ e.stopPropagation(); e.preventDefault(); } }, true);
  dial.addEventListener('wheel', e => {
    if(Math.abs(e.deltaY) < 4 && Math.abs(e.deltaX) < 4) return;
    e.preventDefault();
    if(dial._wheelBusy) return;
    dial._wheelBusy = true; setTimeout(() => { dial._wheelBusy = false; }, 280);
    step((e.deltaY || e.deltaX) > 0 ? 1 : -1);
  }, { passive:false });
  document.addEventListener('keydown', e => {
    if(!isOpen()) return;
    if(e.key === 'ArrowLeft'){ step(1); e.preventDefault(); }
    else if(e.key === 'ArrowRight'){ step(-1); e.preventDefault(); }
  });

  // ── entering an app ────────────────────────────────────────────────────────
  // the Torah's own hamburger and a circle here lead to the same units; what
  // differs is where they were reached from, and so whether "↩ התורה" is offered.
  function setOrigin(o){ document.body.classList.toggle('from-hub', o === 'hub'); }
  function isOpen(){ return !hub.classList.contains('hidden'); }
  function hideUnits(){
    document.querySelectorAll('.rd-totorah').forEach(b => {
      const m = b.closest('.modal'); if(m) m.classList.add('hidden');
    });
    ['extFrameWrap', 'mssFrameWrap'].forEach(id => { const w = $(id); if(w) w.style.display = 'none'; });
    document.body.style.overflow = '';
    if(typeof closeMenu === 'function') closeMenu();
  }
  function showHub(){
    hideUnits();
    hub.classList.remove('hidden');
    hub.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    setOrigin('menu');
  }
  function hideHub(){ hub.classList.add('hidden'); document.body.style.overflow = ''; }
  function enter(key){
    const a = APPS.find(x => x.key === key); if(!a) return;
    hideUnits();
    setOrigin('hub');
    hideHub();
    a.open();
  }
  center.addEventListener('click', () => { setOrigin('menu'); hideHub(); });
  sats.forEach((b, i) => b.addEventListener('click', () => {
    // a tap on the circle at the top goes in; a tap on another brings it to the top
    // first would be a surprise — the brief says a tap enters the app.
    enter(APPS[i].key);
  }));

  // the Torah's hamburger: units reached from there keep their way back to the Torah
  document.querySelectorAll('.menu-item').forEach(b =>
    b.addEventListener('click', () => setOrigin('menu'), true));

  // ── every unit's own bar ───────────────────────────────────────────────────
  // X → the main menu. Added to the bars that carry the "↩ התורה" link; the two
  // framed units already have an X of their own, which is re-pointed.
  document.querySelectorAll('.rd-totorah').forEach(link => {
    const bar = link.parentElement; if(!bar) return;
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'hub-x'; x.innerHTML = '&times;';
    x.title = 'חזרה לתפריט הראשי'; x.setAttribute('aria-label', 'חזרה לתפריט הראשי');
    x.addEventListener('click', showHub);
    bar.insertBefore(x, bar.firstChild);
  });
  [['extFrameClose', 'extFrameWrap'], ['mssFrameClose', 'mssFrameWrap']].forEach(([xid, wid]) => {
    const x = $(xid); if(!x) return;
    x.title = 'חזרה לתפריט הראשי'; x.setAttribute('aria-label', 'חזרה לתפריט הראשי');
    x.classList.add('hub-x');
    x.addEventListener('click', showHub);              // after the old handler has hidden the frame
    const link = document.createElement('button');
    link.type = 'button'; link.className = 'unit-totorah'; link.textContent = '↩ התורה';
    link.title = 'חזרה לתורה';
    link.addEventListener('click', () => {
      const w = $(wid); if(w) w.style.display = 'none';
      document.body.style.overflow = '';
    });
    x.after(link);
  });

  // ── the date ───────────────────────────────────────────────────────────────
  // exactly the line the Torah's own header carries (paintSamDate), word for word
  function paintHubDate(){
    const el = $('hubDate'); if(!el) return;
    const run = $('samDateRun');
    el.textContent = (run && run.textContent) || '';
  }
  if(typeof paintSamDate === 'function'){
    const orig = paintSamDate;
    paintSamDate = function(){ const r = orig.apply(this, arguments); paintHubDate(); return r; };
  }
  paintHubDate();

  // ── staying out of the hub's way ───────────────────────────────────────────
  // a unit opened by some other road (the recording that went on playing and is
  // brought back to the front) must not appear under the hub
  ['openTimeline', 'openShira', 'openLibrary', 'openExternalUnit'].forEach(n => {
    const orig = window[n]; if(typeof orig !== 'function') return;
    window[n] = function(){ if(isOpen()) hideHub(); return orig.apply(this, arguments); };
  });
  // Back, while the hub is up, is a press at the front page: nothing underneath
  // should step back behind it.
  addEventListener('popstate', e => { if(isOpen()) e.stopImmediatePropagation(); }, true);
  // the welcome/what's-new cards wait for the reader to reach the Torah
  if(typeof runOnboarding === 'function'){
    const orig = runOnboarding;
    runOnboarding = function(){
      const go = () => orig.apply(this, arguments);
      const reached = () => !isOpen() && !document.body.classList.contains('from-hub');
      if(reached()) return go();
      const iv = setInterval(() => { if(reached()){ clearInterval(iv); go(); } }, 400);
    };
  }

  window.AvneiHub = { show:showHub, hide:hideHub, enter, apps:APPS, turnTo, get top(){ return topIdx; } };
  paint(0); setTop(0);
  document.body.style.overflow = hub.classList.contains('hidden') ? '' : 'hidden';
})();
