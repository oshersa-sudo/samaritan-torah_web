/* app.js — ציר הזמן ההיסטורי של הישראלים השומרונים */
(function () {
  'use strict';

  var C = window.Chrono;
  var T = function (k) { return window.I18N.t(k); };
  /* טקסט נתונים מתורגם, עם נפילה חזרה לעברית שבקובץ הנתונים */
  var L = function (table, id, field, fallback) {
    return window.I18N.pick(table, id, field, fallback);
  };
  var EVENTS = window.TIMELINE_EVENTS || [];
  var ROSTERS = window.ROSTERS || [];
  var PERIODS = window.PERIODS || [];
  var CREDITS = window.DATA_CREDITS || '';

  var FIRST = C.FIRST_YEAR;              // שנת הבריאה
  var LAST = C.LAST_YEAR + 5;            // מעט אוויר בקצה
  var SPAN = LAST - FIRST;

  var MIN_PPY = 0.0;                     // מחושב בהמשך לפי רוחב המסך
  var MAX_PPY = 60;

  var TRACK_ORDER = ['samaritan', 'israel', 'torah', 'world', 'people'];
  function trackName(t) { return T('tr_' + t); }

  /* גבהים מתוך גיליון הסגנון, כדי שהפריסה והחישוב לא ייפרדו */
  var CSS = getComputedStyle(document.documentElement);
  var RULER_H = parseFloat(CSS.getPropertyValue('--ruler-h')) || 62;
  var BAND_H = (parseFloat(CSS.getPropertyValue('--priest-h')) || 40) + 1;

  var el = {};
  ['viewport', 'stage', 'ruler', 'lanes', 'rosters', 'bands', 'gridlines', 'rail', 'railTrack',
   'railWindow', 'railFill', 'playhead', 'phGreg', 'phCreation', 'phCanaan', 'phPriest',
   'card', 'cardYear', 'cardTitle', 'cardEras', 'cardBody', 'cardPriest', 'cardSrc', 'cardClose',
   'search', 'results', 'zoomIn', 'zoomOut', 'zoomRange', 'zoomFit', 'playBtn',
   'helpBtn', 'help', 'helpClose', 'credits', 'filters',
   'backSite', 'brandHome', 'langs', 'foot'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  var ppy = 1.4;                          // פיקסלים לשנה
  var enabled = { samaritan: 1, israel: 1, torah: 1, world: 1, people: 0,
                  priests: 1, pm: 1, pres: 1 };
  var selected = null;
  var playing = false, playRAF = 0;

  /* ─────────────── עזרים ─────────────── */

  function xOf(year) { return (year - FIRST) * ppy; }
  function yearAt(x) { return FIRST + x / ppy; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function evTitle(e) { return L('events', e.id, 't', e.title); }
  function evBody(e) { return L('events', e.id, 'b', e.body || ''); }
  function itemName(roster, p) {
    return L('rosters', roster.id + ':' + p.from, 'n', p.gap ? T('gapInList') : p.name);
  }
  function itemNote(roster, p) {
    return L('rosters', roster.id + ':' + p.from, 'o', p.note || '');
  }

  /* אומדן רוחב תווית — מספיק טוב לפריסת שורות */
  function labelWidth(text) { return Math.min(330, text.length * 6.4) + 26; }

  function minPpy() { return (el.viewport.clientWidth - 4) / SPAN; }

  /* ─────────────── סרגל השנים ─────────────── */

  var STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];

  function chooseStep(targetPx) {
    for (var i = 0; i < STEPS.length; i++) {
      if (STEPS[i] * ppy >= targetPx) return STEPS[i];
    }
    return STEPS[STEPS.length - 1];
  }

  function drawRuler() {
    var step = chooseStep(96);
    var major = step * 5;
    var from = Math.floor(FIRST / step) * step;
    var html = '', grid = '';
    var showSub = step * ppy >= 150;

    for (var y = from; y <= LAST; y += step) {
      if (y < FIRST) continue;
      var x = xOf(y);
      var isMajor = (y % major === 0) || y === 1;
      html += '<div class="tick' + (isMajor ? ' major' : '') + '" style="left:' + x.toFixed(1) + 'px">' +
        '<div class="stem"></div>' +
        '<div class="lab">' + C.gregLabel(y, { short: !isMajor }) + '</div>' +
        (showSub || isMajor
          ? '<div class="sub">' + C.toCreation(y) + ' ' + T('toCreation') +
            (C.toCanaan(y) >= 1 ? '<br>' + C.toCanaan(y) + ' ' + T('toEntry') : '') + '</div>'
          : '') +
        '</div>';
      grid += '<div class="gl' + (isMajor ? ' major' : '') + '" style="left:' + x.toFixed(1) + 'px"></div>';
    }
    el.ruler.innerHTML = html;
    el.gridlines.innerHTML = grid;
  }

  /* ─────────────── רצועות תקופה ─────────────── */

  function drawBands() {
    var html = '';
    PERIODS.forEach(function (p) {
      var a = xOf(p.from), b = xOf(p.to);
      html += '<div class="band" style="left:' + a.toFixed(1) + 'px;width:' + Math.max(2, b - a).toFixed(1) +
        'px;background:' + p.color + '"><span class="bl">' +
        esc(L('periods', String(p.from), 'n', p.name)) + '</span></div>';
    });
    el.bands.innerHTML = html;
  }

  /* ─────────────── רצועות נושאי משרה ─────────────── */

  function holderAt(roster, year) {
    for (var i = 0; i < roster.items.length; i++) {
      var it = roster.items[i];
      if (year >= it.from && year <= it.to) return it;
    }
    return null;
  }

  /* רצועה נראית רק אם יש בה פריט בטווח הנצפה — כך ראשי הממשלה אינם
     גוזלים גובה כשמסתכלים על ימי המקרא */
  function rosterVisible(roster) {
    if (!enabled[roster.id]) return false;
    var a = yearAt(el.viewport.scrollLeft);
    var b = yearAt(el.viewport.scrollLeft + el.viewport.clientWidth);
    return roster.items.some(function (it) { return it.to >= a && it.from <= b; });
  }

  var visibleRosters = [];

  /* קריאה זולה: מציירת מחדש רק אם קבוצת הרצועות הנראות השתנתה */
  function refreshRosters() {
    var now = ROSTERS.filter(rosterVisible);
    var changed = now.length !== visibleRosters.length;
    if (!changed) {
      for (var i = 0; i < now.length; i++) {
        if (now[i] !== visibleRosters[i]) { changed = true; break; }
      }
    }
    if (changed) { drawRosters(); drawEvents(); }
  }

  function drawRosters() {
    visibleRosters = ROSTERS.filter(rosterVisible);
    var html = '';
    visibleRosters.forEach(function (roster, ri) {
      var inner = '';
      roster.items.forEach(function (p, i) {
        var a = xOf(p.from), b = xOf(p.to + 1);
        var w = Math.max(2, b - a);
        var nm = itemName(roster, p);
        var label = w > 46 ? (p.n ? p.n + '. ' : '') + nm : (w > 16 ? (p.n || '') : '');
        inner += '<div class="priest' + (p.gap ? ' gap' : '') +
          '" data-r="' + ri + '" data-i="' + i + '" title="' +
          esc(nm + ' — ' + C.gregLabel(p.from) + ' – ' + C.gregLabel(p.to)) +
          '" style="left:' + a.toFixed(1) + 'px;width:' + w.toFixed(1) + 'px">' +
          esc(label) + '</div>';
      });
      html += '<div class="rband" data-color="' + roster.color + '">' + inner + '</div>';
    });
    el.rosters.innerHTML = html;
    /* אזור האירועים מתחיל מתחת לרצועות שנראות בפועל */
    el.lanes.style.top = (RULER_H + visibleRosters.length * BAND_H) + 'px';
  }

  /* ─────────────── אירועים ─────────────── */

  var laidOut = [];   // {ev, x, w, top}

  /* פריסה חמדנית: כל אירוע נכנס לשורה הראשונה שבה תוויתו אינה מתנגשת */
  function greedyRows(list, cap) {
    var rows = [], placed = [];
    list.forEach(function (e) {
      var x = xOf(e.year);
      var w = labelWidth(evTitle(e));
      var r = -1, best = 0;
      for (var i = 0; i < rows.length; i++) {
        if (x > rows[i] + 8) { r = i; break; }
        if (rows[i] < rows[best]) best = i;          /* השורה הפנויה ביותר */
      }
      if (r === -1 && (!cap || rows.length < cap)) { rows.push(-1e9); r = rows.length - 1; }
      if (r === -1) {
        placed.push({ ev: e, x: x, w: 14, row: best, dotOnly: true });   /* נקודה בלבד */
        return;
      }
      rows[r] = x + w;
      placed.push({ ev: e, x: x, w: w, row: r });
    });
    return { rows: rows.length, placed: placed };
  }

  function layoutEvents() {
    var laneTop = 0;
    var rowH = 24;
    var avail = el.lanes.clientHeight || 400;
    laidOut = [];

    var tracks = TRACK_ORDER.filter(function (t) {
      return enabled[t] && EVENTS.some(function (e) { return e.track === t; });
    });
    if (!tracks.length) { return; }

    /* שלב א: כמה שורות כל מסלול היה רוצה, בלי הגבלה */
    var lists = {}, want = {}, total = 0;
    tracks.forEach(function (t) {
      lists[t] = EVENTS.filter(function (e) { return e.track === t; })
        .sort(function (a, b) { return a.year - b.year; });
      want[t] = greedyRows(lists[t], 0).rows;
      total += want[t];
    });

    /* שלב ב: חלוקת הגובה הפנוי לפי הביקוש בפועל, ולא בשווה */
    var budget = Math.max(tracks.length * 2, Math.floor((avail - tracks.length * 10) / rowH));
    var caps = {};
    tracks.forEach(function (t) {
      caps[t] = total <= budget ? want[t]
        : Math.max(2, Math.floor(want[t] / total * budget));
    });
    /* עיגולים עלולים לחרוג — מקזזים מן המסלול הגדול ביותר עד שנכנסים בגובה */
    var sum = function () {
      return tracks.reduce(function (a, t) { return a + caps[t]; }, 0);
    };
    while (sum() > budget) {
      var biggest = tracks[0];
      tracks.forEach(function (t) { if (caps[t] > caps[biggest]) biggest = t; });
      if (caps[biggest] <= 2) break;
      caps[biggest]--;
    }

    tracks.forEach(function (track) {
      var res = greedyRows(lists[track], caps[track]);
      res.placed.forEach(function (p) {
        p.top = laneTop + p.row * rowH;
        laidOut.push(p);
      });
      laneTop += Math.max(1, res.rows) * rowH + 10;
    });
  }

  function drawEvents() {
    layoutEvents();
    var html = '';
    laidOut.forEach(function (p) {
      var e = p.ev;
      var spanW = (e.to != null && e.to > e.year) ? (xOf(e.to) - p.x) : 0;
      html += '<div class="ev' + (spanW > 3 ? ' span' : '') + (selected === e.id ? ' hi' : '') +
        '" data-track="' + e.track + '" data-id="' + esc(e.id) + '" style="left:' + p.x.toFixed(1) +
        'px;top:' + p.top + 'px">' +
        (spanW > 3 ? '<div class="bar" style="width:' + spanW.toFixed(1) + 'px"></div>' : '') +
        '<span class="dot"></span>' +
        (p.dotOnly ? '' : '<span class="tl">' + esc(evTitle(e)) + '</span>') +
        '</div>';
    });
    el.lanes.innerHTML = html;
  }

  /* ─────────────── הסרגל האנכי ─────────────── */

  function drawRailTicks() {
    var h = el.railTrack.clientHeight;
    var html = '<div id="railFill"></div><div id="railWindow"></div>';
    /* אבני דרך קבועות לאורך הסרגל */
    var marks = [
      { y: FIRST, k: 'mk_creation' },
      { y: -2000, k: 'mk_patriarchs' },
      { y: -1638, k: 'mk_entry' },
      { y: -722, k: 'mk_samaria' },
      { y: 1, k: 'mk_ce' },
      { y: 634, k: 'mk_arab' },
      { y: 1517, k: 'mk_ottoman' },
      { y: C.LAST_YEAR, k: 'mk_today' }
    ];
    marks.forEach(function (m) {
      var top = (m.y - FIRST) / SPAN * h;
      html += '<div class="rail-tick era" style="top:' + top.toFixed(1) + 'px">' +
        '<b>' + C.gregLabel(m.y, { short: true }) + '</b>' + esc(T(m.k)) + '</div>';
    });
    el.railTrack.innerHTML = html;
    el.railWindow = document.getElementById('railWindow');
    el.railFill = document.getElementById('railFill');
  }

  function syncRail() {
    var h = el.railTrack.clientHeight;
    var vw = el.viewport.clientWidth;
    var total = el.stage.offsetWidth || 1;
    var top = el.viewport.scrollLeft / total * h;
    var hh = Math.max(14, vw / total * h);
    el.railWindow.style.top = top.toFixed(1) + 'px';
    el.railWindow.style.height = hh.toFixed(1) + 'px';
  }

  /* ─────────────── נקודת ה-0 ─────────────── */

  function syncPlayhead() {
    var y = Math.round(yearAt(el.viewport.scrollLeft));
    el.phGreg.textContent = C.gregLabel(y);
    el.phCreation.textContent = C.creationLabel(y);
    el.phCanaan.textContent = C.canaanLabel(y);
    document.querySelectorAll('.priest.hi').forEach(function (n) { n.classList.remove('hi'); });
    var lines = [];
    visibleRosters.forEach(function (roster, ri) {
      var p = holderAt(roster, y);
      if (!p || p.gap) return;
      lines.push(T('ttl_' + roster.id) + ': ' + itemName(roster, p));
      var node = el.rosters.querySelector('.priest[data-r="' + ri + '"][data-i="' +
        roster.items.indexOf(p) + '"]');
      if (node) node.classList.add('hi');
    });
    el.phPriest.innerHTML = lines.map(esc).join('<br>');
  }

  /* ─────────────── ציור מלא ─────────────── */

  function render() {
    el.stage.style.width = (SPAN * ppy) + 'px';
    drawRuler();
    drawBands();
    drawRosters();
    drawEvents();
    syncRail();
    syncPlayhead();
    var mn = minPpy();
    el.zoomRange.value = Math.round(
      (Math.log(ppy / mn) / Math.log(MAX_PPY / mn)) * 1000
    );
  }

  /* שינוי זום תוך שמירת השנה שבנקודת ה-0 */
  function setZoom(next, anchorX) {
    var mn = minPpy();
    next = clamp(next, mn, MAX_PPY);
    if (Math.abs(next - ppy) < 1e-9) return;
    anchorX = anchorX == null ? 0 : anchorX;
    var anchorYear = yearAt(el.viewport.scrollLeft + anchorX);
    ppy = next;
    el.stage.style.width = (SPAN * ppy) + 'px';
    el.viewport.scrollLeft = xOf(anchorYear) - anchorX;
    render();
  }

  function goToYear(year, where) {
    var offset = where === 'center' ? el.viewport.clientWidth / 2 : 60;
    el.viewport.scrollLeft = xOf(year) - offset;
    syncRail();
    refreshRosters();
    syncPlayhead();
  }

  /* ─────────────── כרטיס פרטים ─────────────── */

  function openEvent(id) {
    var e = EVENTS.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    selected = id;
    var range = e.to != null && e.to !== e.year
      ? C.gregLabel(e.year) + ' – ' + C.gregLabel(e.to)
      : (e.approx ? T('approx') : '') + C.gregLabel(e.year);
    el.cardYear.textContent = range;
    el.cardTitle.textContent = evTitle(e);
    el.cardEras.textContent = C.creationLabel(e.year) + ' · ' + C.canaanLabel(e.year) +
      ' · ' + trackName(e.track);
    el.cardBody.textContent = evBody(e);
    var pr = ROSTERS[0] && holderAt(ROSTERS[0], e.year);
    el.cardPriest.textContent = pr && !pr.gap
      ? T('inTheDaysOf') + T('ttl_priests') + ' ' + itemName(ROSTERS[0], pr) +
        (pr.n ? T('inDynasty').replace('{n}', pr.n) : '') : '';
    el.cardSrc.textContent = e.src ? T('source') + e.src : '';
    el.card.hidden = false;
    drawEvents();
  }

  function openPriest(ri, i) {
    var roster = visibleRosters[ri];
    var p = roster && roster.items[i];
    if (!p) return;
    selected = null;
    el.cardYear.textContent = C.gregLabel(p.from) + ' – ' + C.gregLabel(p.to) +
      (p.years ? '  (' + p.years + ' ' + T('yearsOfOffice') + ')' : '');
    el.cardTitle.textContent = (p.n ? p.n + '. ' : '') + itemName(roster, p);
    el.cardEras.textContent = C.creationLabel(p.from) + ' · ' + C.canaanLabel(p.from) +
      ' · ' + T('ttl_' + roster.id);
    el.cardBody.textContent = itemNote(roster, p);
    el.cardPriest.textContent = '';
    el.cardSrc.textContent = p.src ? T('source') + p.src : '';
    el.card.hidden = false;
  }

  /* ─────────────── חיפוש ─────────────── */

  function runSearch() {
    var q = el.search.value.trim();
    if (!q) { el.results.hidden = true; return; }

    var y = C.parseYear(q);
    var html = '';
    if (y !== null && y >= FIRST && y <= LAST) {
      html += '<div class="r" data-year="' + y + '"><span class="y">' +
        C.gregLabel(y, { short: true }) + '</span><span class="t">' + T('goToYear') + ' ' +
        esc(C.fullLabel(y)) + '</span></div>';
    }

    var ql = q.toLowerCase();
    var hits = EVENTS.filter(function (e) {
      return (evTitle(e) + ' ' + evBody(e) + ' ' + e.title).toLowerCase().indexOf(ql) !== -1;
    }).slice(0, 40);
    hits.forEach(function (e) {
      html += '<div class="r" data-id="' + esc(e.id) + '"><span class="y">' +
        C.gregLabel(e.year, { short: true }) + '</span><span class="t">' + esc(evTitle(e)) + '</span></div>';
    });

    ROSTERS.forEach(function (roster) {
      roster.items.filter(function (p) {
        return !p.gap && (p.name.indexOf(q) !== -1 || itemName(roster, p).indexOf(q) !== -1);
      })
        .slice(0, 10).forEach(function (p) {
          html += '<div class="r" data-goto="' + p.from + '"><span class="y">' +
            C.gregLabel(p.from, { short: true }) + '</span><span class="t">' +
            esc(T('ttl_' + roster.id) + ' ' + itemName(roster, p)) + '</span></div>';
        });
    });

    el.results.innerHTML = html || '<div class="empty">' + esc(T('noResults')) + '</div>';
    el.results.hidden = false;
  }

  /* ─────────────── מסע אוטומטי ─────────────── */

  function togglePlay() {
    playing = !playing;
    el.playBtn.classList.toggle('on', playing);
    el.playBtn.innerHTML = playing ? T('stop') : T('play');
    if (playing) {
      var last = 0;
      var step = function (t) {
        if (!playing) return;
        if (last) el.viewport.scrollLeft += (t - last) * 0.09;
        last = t;
        if (el.viewport.scrollLeft >= el.stage.offsetWidth - el.viewport.clientWidth - 1) {
          togglePlay();
          return;
        }
        syncRail(); syncPlayhead();
        playRAF = requestAnimationFrame(step);
      };
      playRAF = requestAnimationFrame(step);
    } else {
      cancelAnimationFrame(playRAF);
    }
  }

  /* ─────────────── אירועי משתמש ─────────────── */

  el.viewport.addEventListener('scroll', function () {
    syncRail();
    refreshRosters();
    syncPlayhead();
  });

  el.viewport.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(ppy * (e.deltaY < 0 ? 1.16 : 1 / 1.16), e.clientX - el.viewport.getBoundingClientRect().left);
    } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.viewport.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  /* גרירה של הציר */
  (function () {
    var down = false, sx = 0, sl = 0, moved = 0;
    el.viewport.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.ev, .priest')) return;
      down = true; moved = 0; sx = e.clientX; sl = el.viewport.scrollLeft;
      el.viewport.classList.add('dragging');
      el.viewport.setPointerCapture(e.pointerId);
    });
    el.viewport.addEventListener('pointermove', function (e) {
      if (!down) return;
      moved = Math.max(moved, Math.abs(e.clientX - sx));
      el.viewport.scrollLeft = sl - (e.clientX - sx);
    });
    el.viewport.addEventListener('pointerup', function (e) {
      down = false;
      el.viewport.classList.remove('dragging');
      try { el.viewport.releasePointerCapture(e.pointerId); } catch (_) {}
    });
  })();

  /* גרירה של הסרגל האנכי */
  (function () {
    var down = false;
    function apply(clientY) {
      var r = el.railTrack.getBoundingClientRect();
      var total = el.stage.offsetWidth;
      var win = el.viewport.clientWidth / total * r.height;
      var t = clamp(clientY - r.top - win / 2, 0, r.height - win);
      el.viewport.scrollLeft = t / r.height * total;
    }
    el.rail.addEventListener('pointerdown', function (e) {
      down = true;
      el.rail.classList.add('dragging');
      el.rail.setPointerCapture(e.pointerId);
      apply(e.clientY);
    });
    el.rail.addEventListener('pointermove', function (e) { if (down) apply(e.clientY); });
    el.rail.addEventListener('pointerup', function (e) {
      down = false;
      el.rail.classList.remove('dragging');
      try { el.rail.releasePointerCapture(e.pointerId); } catch (_) {}
    });
  })();

  el.lanes.addEventListener('click', function (e) {
    var n = e.target.closest('.ev');
    if (n) { openEvent(n.dataset.id); return; }
    /* לא נפגע ישירות — פותחים את האירוע הקרוב ביותר בסביבה קרובה */
    /* #lanes נגלל יחד עם הבמה, ולכן ה-rect שלו כבר כולל את הגלילה */
    var r = el.lanes.getBoundingClientRect();
    var px = e.clientX - r.left;
    var py = e.clientY - r.top;
    var best = null, bestD = 1e9;
    laidOut.forEach(function (p) {
      var cy = p.top + 11;
      var dx = px < p.x ? p.x - px : (px > p.x + p.w ? px - (p.x + p.w) : 0);
      var dy = Math.abs(py - cy);
      var d = dx * dx + dy * dy * 4;          /* מעדיפים קרבה אנכית */
      if (dy < 18 && dx < 26 && d < bestD) { bestD = d; best = p.ev; }
    });
    if (best) openEvent(best.id);
  });
  el.rosters.addEventListener('click', function (e) {
    var n = e.target.closest('.priest');
    if (n) openPriest(+n.dataset.r, +n.dataset.i);
  });

  el.cardClose.addEventListener('click', function () {
    el.card.hidden = true; selected = null; drawEvents();
  });

  el.zoomIn.addEventListener('click', function () { setZoom(ppy * 1.5, el.viewport.clientWidth / 2); });
  el.zoomOut.addEventListener('click', function () { setZoom(ppy / 1.5, el.viewport.clientWidth / 2); });
  el.zoomFit.addEventListener('click', function () {
    ppy = minPpy(); render(); el.viewport.scrollLeft = 0;
  });
  el.zoomRange.addEventListener('input', function () {
    var mn = minPpy();
    setZoom(mn * Math.pow(MAX_PPY / mn, this.value / 1000), el.viewport.clientWidth / 2);
  });

  el.playBtn.addEventListener('click', togglePlay);
  el.helpBtn.addEventListener('click', function () { el.help.hidden = false; });
  el.helpClose.addEventListener('click', function () { el.help.hidden = true; });
  el.help.addEventListener('click', function (e) { if (e.target === el.help) el.help.hidden = true; });

  el.search.addEventListener('input', runSearch);
  el.search.addEventListener('focus', runSearch);
  el.results.addEventListener('click', function (e) {
    var r = e.target.closest('.r');
    if (!r) return;
    if (r.dataset.year) goToYear(+r.dataset.year, 'start');   /* השנה תיעמד בנקודת ה-0 */
    else if (r.dataset.id) {
      var ev = EVENTS.filter(function (x) { return x.id === r.dataset.id; })[0];
      if (ev) { goToYear(ev.year, 'center'); openEvent(ev.id); }
    } else if (r.dataset.goto) {
      goToYear(+r.dataset.goto, 'start');
    }
    el.results.hidden = true;
    el.search.blur();
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-wrap')) el.results.hidden = true;
  });

  el.filters.addEventListener('change', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    var t = chip.dataset.track || chip.dataset.roster;
    enabled[t] = chip.querySelector('input').checked ? 1 : 0;
    chip.classList.toggle('off', !enabled[t]);
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') {
      if (e.key === 'Escape') { el.results.hidden = true; el.search.blur(); }
      return;
    }
    var page = el.viewport.clientWidth * 0.8;
    if (e.key === 'ArrowRight') { el.viewport.scrollLeft += 90; e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { el.viewport.scrollLeft -= 90; e.preventDefault(); }
    else if (e.key === 'PageDown') { el.viewport.scrollLeft += page; e.preventDefault(); }
    else if (e.key === 'PageUp') { el.viewport.scrollLeft -= page; e.preventDefault(); }
    else if (e.key === 'Home') { el.viewport.scrollLeft = 0; e.preventDefault(); }
    else if (e.key === 'End') { el.viewport.scrollLeft = el.stage.offsetWidth; e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') setZoom(ppy * 1.5, el.viewport.clientWidth / 2);
    else if (e.key === '-') setZoom(ppy / 1.5, el.viewport.clientWidth / 2);
    else if (e.key === ' ') { togglePlay(); e.preventDefault(); }
    else if (e.key === 'Escape') { el.card.hidden = true; el.help.hidden = true; }
  });

  var rT;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(function () { drawRailTicks(); render(); }, 120);
  });

  /* ─────────────── התחלה ─────────────── */

  window.I18N.apply();
  el.rail.title = T('railTitle');
  el.search.placeholder = T('searchPlaceholder');
  el.zoomIn.title = T('zoomInTitle');
  el.zoomOut.title = T('zoomOutTitle');
  el.zoomFit.title = T('allTitle');
  el.zoomFit.textContent = T('all');
  el.playBtn.innerHTML = T('play');
  document.querySelectorAll('#filters .chip').forEach(function (c) {
    var t = c.dataset.track, r = c.dataset.roster;
    var label = t ? T('tr_' + t) : T('rs_' + r);
    c.lastChild.textContent = ' ' + label;
  });
  var fl = document.querySelectorAll('#filters .flabel');
  if (fl[0]) fl[0].textContent = T('layers');
  if (fl[1]) fl[1].textContent = T('bands');
  document.querySelector('#foot .copy').textContent = T('copy');
  var site = window.I18N.siteUrl();
  el.backSite.href = site;
  el.brandHome.href = site;
  el.langs.querySelectorAll('button').forEach(function (b) {
    b.classList.toggle('on', b.dataset.lang === window.I18N.lang);
    b.addEventListener('click', function () { window.I18N.setLang(b.dataset.lang); });
  });

  el.credits.innerHTML = CREDITS;
  drawRailTicks();
  render();
  /* פתיחה: מעט לפני הכניסה לארץ כנען */
  goToYear(-1700, 'start');

  /* המידות האמיתיות של אזור המסלולים ידועות רק אחרי הפריסה הראשונה —
     לכן ציור חוזר בפריים הבא, ובכל שינוי גודל של אזור הציר. */
  var settle = function () { drawRailTicks(); render(); };
  requestAnimationFrame(settle);
  setTimeout(settle, 0);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { drawRailTicks(); render(); });
    ro.observe(el.viewport);
  }

  /* העזרה נפתחת מעצמה רק בביקור הראשון */
  var seen = false;
  try { seen = localStorage.getItem('timelineHelpSeen') === '1'; } catch (e) { /* אין אחסון */ }
  if (!seen) {
    el.help.hidden = false;
    try { localStorage.setItem('timelineHelpSeen', '1'); } catch (e) { /* אין אחסון */ }
  }
})();
