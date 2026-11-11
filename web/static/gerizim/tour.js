(function () {
  'use strict';
  const G = window.GERIZIM, PERIODS = G.periods, GROUPS = G.groups;
  const IMAGES = window.GERIZIM_IMAGES || {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- גאומטריה: מטרים ממרכז הכנסייה אל קואורדינטות ---------- */
  const C = G.church;
  const M_LAT = 1 / 111320, M_LON = 1 / (111320 * Math.cos(C[1] * Math.PI / 180));
  const at = (dx, dy) => [C[0] + dx * M_LON, C[1] + dy * M_LAT];
  function ringOf(p) {
    if (p.ring) return p.ring;
    if (p.at && p.oct) {
      const r = [];
      for (let a = 22.5; a < 360; a += 45) r.push(at(p.at[0] + p.oct * Math.cos(a * Math.PI / 180), p.at[1] + p.oct * Math.sin(a * Math.PI / 180)));
      return r;
    }
    if (p.at && p.size) {
      const [x, y] = p.at, w = p.size[0] / 2, h = p.size[1] / 2;
      return [at(x - w, y + h), at(x + w, y + h), at(x + w, y - h), at(x - w, y - h)];
    }
    return [];
  }
  const PLACES = G.places;
  PLACES.forEach(p => {
    p.ring = ringOf(p);
    if (!p.center) p.center = p.at ? at(p.at[0], p.at[1]) : null;
    p.strata = p.strata || []; p.finds = p.finds || [];
    p.focus = p.ring.length ? p.ring.reduce((a, q) => [a[0] + q[0] / p.ring.length, a[1] + q[1] / p.ring.length], [0, 0]) : p.center;
  });
  const byId = Object.fromEntries(PLACES.map(p => [p.id, p]));
  const kids = id => PLACES.filter(p => p.parent === id);
  const periodById = Object.fromEntries(PERIODS.map(p => [p.id, p]));

  /* ---------- שלוש שפות ---------- */
  const UI = {
    he: { dir: 'rtl', title: 'הר גריזים — סיור על הפסגה', tag: 'ניסיון', period: 'תקופה:', all: 'הכול',
      tour: '▶ סיור מודרך', endTour: '■ סיום הסיור', home: 'מבט על', relief: 'הדגשת תבליט', pick: 'סימון נקודה', list: '☰ המקומות',
      strata: 'שכבות המקום', finds: 'מה נתגלה כאן', inscr: 'כתובות וממצאים', parts: 'חלקי המקום',
      partOf: 'חלק מתוך', route: 'סדר התחנות', prev: '→ הקודמת', next: 'הבאה ←', finish: 'סיום',
      station: 'תחנה {i} מתוך {n}', note: 'תוכן ראשוני. המיקום והגבולות סומנו בקירוב וטעונים אימות.',
      nomap: 'מיקומו של המקום הזה עדיין לא אומת, ולכן הוא אינו מסומן על המפה.',
      far: 'נראה מן הפסגה: {d} ק"מ לכיוון {c}', farAway: 'מרחק מן הפסגה: {d} ק"מ לכיוון {c}', pickPrompt: 'לחץ על נקודה במפה', close: 'סגירה',
      photoBy: 'צילום', licence: 'רישיון', source: 'Wikimedia Commons', listTitle: 'המקומות בסיור', photos: 'תמונות', dialLetters: ['צ', 'מז', 'ד', 'מע'], dialTitle: 'סיבוב המפה: גררו את החוגה, או לחצו על כיוון', lookTo: 'מבט אל {c}', elev: 'גובה {m} מ׳ מעל פני הים', pop: '{n} תושבים ({y})',
      compass: ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'] },
    en: { dir: 'ltr', title: 'Mount Gerizim — A Tour of the Summit', tag: 'Prototype', period: 'Period:', all: 'All',
      tour: '▶ Guided tour', endTour: '■ End tour', home: 'Overview', relief: 'Exaggerate relief', pick: 'Mark a point', list: '☰ Places',
      strata: 'Layers of the place', finds: 'What was found here', inscr: 'Inscriptions and finds', parts: 'Parts of this place',
      partOf: 'Part of', route: 'Order of the stations', prev: '← Previous', next: 'Next →', finish: 'Finish',
      station: 'Stop {i} of {n}', note: 'Preliminary content. Location and outline are approximate and need verification.',
      nomap: 'The location of this place has not been verified yet, so it is not marked on the map.',
      far: 'Seen from the summit: {d} km to the {c}', farAway: 'Distance from the summit: {d} km to the {c}', pickPrompt: 'Click a point on the map', close: 'Close',
      photoBy: 'Photo', licence: 'Licence', source: 'Wikimedia Commons', listTitle: 'Places in the tour', photos: 'Photos', dialLetters: ['N', 'E', 'S', 'W'], dialTitle: 'Rotate the map: drag the dial, or tap a direction', lookTo: 'Look {c}', elev: '{m} m above sea level', pop: '{n} inhabitants ({y})',
      compass: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] },
    ar: { dir: 'rtl', title: 'جبل جرزيم — جولة على القمة', tag: 'تجريبي', period: 'الفترة:', all: 'الكل',
      tour: '▶ جولة إرشادية', endTour: '■ إنهاء الجولة', home: 'نظرة عامة', relief: 'إبراز التضاريس', pick: 'تحديد نقطة', list: '☰ الأماكن',
      strata: 'طبقات المكان', finds: 'ما اكتُشف هنا', inscr: 'نقوش ومكتشفات', parts: 'أجزاء المكان',
      partOf: 'جزء من', route: 'ترتيب المحطات', prev: '→ السابقة', next: 'التالية ←', finish: 'إنهاء',
      station: 'المحطة {i} من {n}', note: 'محتوى أوّلي. الموقع والحدود تقريبية وتحتاج إلى تحقق.',
      nomap: 'لم يُتحقق بعد من موقع هذا المكان، ولذلك لا يظهر على الخريطة.',
      far: 'يُرى من القمة: {d} كم باتجاه {c}', farAway: 'البعد عن القمة: {d} كم باتجاه {c}', pickPrompt: 'انقر على نقطة في الخريطة', close: 'إغلاق',
      photoBy: 'تصوير', licence: 'الرخصة', source: 'ويكيميديا كومنز', listTitle: 'أماكن الجولة', photos: 'صور', dialLetters: ['ش', 'ق', 'ج', 'غ'], dialTitle: 'تدوير الخريطة: اسحب القرص أو اضغط على اتجاه', lookTo: 'النظر نحو {c}', elev: 'الارتفاع {m} م فوق سطح البحر', pop: '{n} نسمة ({y})',
      compass: ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'] }
  };
  let lang = 'he';
  try { lang = localStorage.getItem('gerizim-lang') || 'he'; } catch (e) { /* בלי אחסון — עברית */ }
  try { const q = new URLSearchParams(location.search).get('lang'); if (q) lang = q; } catch (e) { /* כתובת בלי פרמטרים */ }
  if (!UI[lang]) lang = 'he';
  const T = k => UI[lang][k];
  // שדה תוכן הוא {he,en,ar}; בהיעדר תרגום חוזרים לעברית
  const L = v => (v && typeof v === 'object') ? (v[lang] || v.he || '') : (v || '');

  const state = { sel: null, open: null, period: null, tourAt: -1, relief: false, pick: false, listing: false, exp: {} };

  /* ---------- התאמה למסך: טלפון, טאבלט, מחשב נייד ---------- */
  const narrow = () => window.innerWidth <= 640;
  // נקודת הפתיחה היא גם ההתרחקות המרבית: במסך צר מתרחקים מעט יותר כדי שהפסגה כולה תיכנס
  function homeZoom() {
    const w = Math.min(window.innerWidth, window.innerHeight * 1.5);
    return Math.max(14.3, Math.min(15.7, G.home.zoom + Math.log2(w / 1000)));
  }
  const home = () => ({ center: G.home.center, zoom: homeZoom(), pitch: G.home.pitch, bearing: G.home.bearing });

  /* ---------- תיחום: לא מתרחקים מן הפסגה יותר מ-reach מטרים לכל כיוון ---------- */
  const BOX = { w: C[0] - G.reach * M_LON, e: C[0] + G.reach * M_LON, s: C[1] - G.reach * M_LAT, n: C[1] + G.reach * M_LAT };
  const clampPt = c => [Math.min(BOX.e, Math.max(BOX.w, c[0])), Math.min(BOX.n, Math.max(BOX.s, c[1]))];

  const map = new maplibregl.Map({
    container: 'map',
    center: G.home.center, zoom: homeZoom(), pitch: 38, bearing: G.home.bearing - 140,
    maxPitch: 82, minZoom: homeZoom() - 0.02, maxZoom: 18.6,
    attributionControl: { compact: true },
    style: {
      version: 8,
      sources: {
        sat: {
          // מעבר לרמה 18 אין צילום לאזור הזה — מעליה התמונה נמתחת
          type: 'raster', tileSize: 256, maxzoom: 18,
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
        },
        dem: {
          type: 'raster-dem', tileSize: 256, maxzoom: 14, encoding: 'terrarium',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          attribution: 'Terrain: Mapzen, AWS Open Data'
        }
      },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
      terrain: { source: 'dem', exaggeration: 1 }
    }
  });
  window._map = map;
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');


  /* ---------- חוגת הכיוונים ---------- */
  // השושנה מסתובבת עם המפה, והמשולש שבראשה מסמן את כיוון המבט. גרירה מסובבת את המפה;
  // לחיצה על אות מפנה את המבט אל אותו כיוון.
  const dial = $('dial'), rose = $('dialRose');
  let dialDragged = false;
  function buildDial() {
    let h = '';
    for (let i = 0; i < 24; i++) h += '<i class="tk' + (i % 6 ? '' : ' big') + '" style="transform:rotate(' + i * 15 + 'deg)"></i>';
    T('dialLetters').forEach((ch, k) => {
      const a = k * 90;
      h += '<button class="dl' + (k ? '' : ' n') + '" data-b="' + a + '" title="' + esc(T('lookTo').replace('{c}', T('compass')[k * 2])) + '"' +
        ' style="transform:rotate(' + a + 'deg) translateY(calc(-1 * var(--rad)))">' +
        '<span style="transform:rotate(calc(-1 * (' + a + 'deg + var(--r, 0deg))))">' + esc(ch) + '</span></button>';
    });
    rose.innerHTML = h;
    dial.title = T('dialTitle');
    dial.setAttribute('aria-label', T('dialTitle'));
    rose.querySelectorAll('.dl').forEach(b => {
      b.onclick = () => {
        if (dialDragged) return;
        introEnd(true);
        map.easeTo({ bearing: +b.dataset.b, duration: 800, essential: true });
      };
    });
    dialSync();
  }
  function dialSync() {
    const b = map.getBearing();
    rose.style.transform = 'rotate(' + (-b) + 'deg)';
    dial.style.setProperty('--r', (-b) + 'deg');
    $('dialNow').textContent = T('compass')[Math.round((((b % 360) + 360) % 360) / 45) % 8];
  }
  map.on('rotate', dialSync);
  (() => {
    let drag = null, dialOff = null;
    const ang = e => { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI; };
    dial.addEventListener('pointerdown', e => {
      drag = { a: ang(e), b: map.getBearing(), x: e.clientX, y: e.clientY };
      dialDragged = false;
      clearTimeout(dialOff);
      dial.classList.add('on');            // האצבע על החוגה: היא נעשית אטומה
      try { dial.setPointerCapture(e.pointerId); } catch (err) { /* דפדפן ישן — הגרירה עובדת גם בלי */ }
    });
    dial.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!dialDragged && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      if (!dialDragged) { dialDragged = true; introEnd(true); map.stop(); }
      map.setBearing(drag.b - (ang(e) - drag.a));
    });
    // אחרי שהאצבע עוזבת החוגה נשארת גלויה עוד רגע, ואז חוזרת לשקיפות
    const end = () => { drag = null; setTimeout(() => { dialDragged = false; }, 0); clearTimeout(dialOff); dialOff = setTimeout(() => dial.classList.remove('on'), 1600); };
    dial.addEventListener('pointerup', end);
    dial.addEventListener('pointercancel', end);
  })();
  buildDial();

  let clamping = false;
  map.on('move', () => {
    if (clamping) return;
    const c = map.getCenter(), k = clampPt([c.lng, c.lat]);
    if (k[0] !== c.lng || k[1] !== c.lat) { clamping = true; map.setCenter(k); clamping = false; }
  });
  const barHeight = () => document.documentElement.style.setProperty('--barh', $('bar').offsetHeight + 'px');
  window.addEventListener('resize', () => { map.setMinZoom(homeZoom() - 0.02); barHeight(); });

  /* ---------- שכבת המקומות ---------- */
  function geojson() {
    return {
      type: 'FeatureCollection',
      features: PLACES.filter(p => p.ring.length > 2 && !p.nomap).map(p => ({
        type: 'Feature',
        properties: { id: p.id, color: p.color },
        geometry: { type: 'Polygon', coordinates: [p.ring.concat([p.ring[0]])] }
      }))
    };
  }
  // חלקי מקום צפופים מדי לתוויות מלאות: על המפה הם מספרים, והמספר חוזר ברשימת החלקים שבכרטיס
  const partNo = p => kids(p.parent).indexOf(p) + 1;
  const pinText = p => (p.parent && p.id !== state.sel) ? String(partNo(p)) : L(p.name);
  // חלקי מקום מופיעים רק כשהמקום שהם שייכים לו פתוח
  const shown = p => !p.nomap && (!p.parent || p.parent === state.open);
  const inPeriod = p => !state.period || !p.strata.length || p.strata.some(s => s.period === state.period);

  function repaint() {
    const vis = PLACES.filter(shown).map(p => p.id);
    const act = PLACES.filter(p => shown(p) && inPeriod(p)).map(p => p.id);
    const sel = state.sel || '';
    if (map.getLayer('places-fill')) {
      map.setFilter('places-fill', ['in', ['get', 'id'], ['literal', vis]]);
      map.setFilter('places-line', ['in', ['get', 'id'], ['literal', vis]]);
      map.setPaintProperty('places-fill', 'fill-opacity',
        ['case', ['==', ['get', 'id'], sel], 0.38,
                 ['in', ['get', 'id'], ['literal', act]], 0.16, 0.03]);
      map.setPaintProperty('places-line', 'line-opacity',
        ['case', ['in', ['get', 'id'], ['literal', act]], 1, 0.18]);
      map.setPaintProperty('places-line', 'line-width',
        ['case', ['==', ['get', 'id'], sel], 3.5, 1.6]);
    }
    PLACES.forEach(p => {
      if (!p._pin) return;
      p._pin.classList.toggle('dim', !act.includes(p.id));
      p._pin.classList.toggle('sel', p.id === state.sel);
      p._pin.textContent = pinText(p);
    });
    labels();
  }
  // תוויות של מקומות קטנים מופיעות רק מקרוב, כדי שלא יעלו זו על זו
  function labels() {
    const z = map.getZoom();
    PLACES.forEach(p => {
      if (!p._pin) return;
      const on = shown(p) && (p.id === state.sel || !!p.parent || !p.labelFrom || z >= p.labelFrom);
      p._pin.style.display = on ? '' : 'none';
    });
  }
  map.on('zoom', labels);

  map.on('load', () => {
    try {
      map.setSky({
        'sky-color': '#8fb8e0', 'horizon-color': '#dfe9f2', 'fog-color': '#e6ebee',
        'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.9
      });
    } catch (e) { /* גרסה בלי שמיים — לא נורא */ }

    map.addSource('places', { type: 'geojson', data: geojson() });
    map.addLayer({ id: 'places-fill', type: 'fill', source: 'places',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.16 } });
    map.addLayer({ id: 'places-line', type: 'line', source: 'places',
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.6 } });

    PLACES.forEach(p => {
      if (p.nomap || !p.center) return;
      const el = document.createElement('div');
      el.className = 'pin g-' + p.group + (p.parent ? ' part' : '') + (p.far ? ' far' : '');
      el.addEventListener('click', ev => { ev.stopPropagation(); endTour(); select(p.id); });
      p._pin = el;
      new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -9] }).setLngLat(p.center).addTo(map);
    });

    map.on('click', 'places-fill', ev => {
      if (state.pick) return;
      // כשמקומות חופפים, הקטן שבהם הוא המבוקש
      const ids = ev.features.map(f => f.properties.id);
      const best = PLACES.filter(p => ids.includes(p.id)).sort((a, b) => area(a.ring) - area(b.ring))[0];
      if (best) { endTour(); select(best.id); }
    });
    map.on('mouseenter', 'places-fill', () => { if (!state.pick) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'places-fill', () => { if (!state.pick) map.getCanvas().style.cursor = ''; });
    applyLang();
    repaint();
    intro();
    sharpImagery();
  });

  function area(r) {
    let a = 0;
    for (let i = 0; i < r.length; i++) {
      const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a);
  }

  /* ---------- פתיחה: כותרת זהב בכתב שומרוני בזמן שהמצלמה מסתובבת אל המבט הנוח ---------- */
  // כל פעולה של המשתמש מסיימת את הפתיחה: הכותרת נמוגה, והמצלמה אינה נלקחת ממנו
  // כרטיס אינו נפתח כל עוד הכותרת על המסך: הוא מחכה בתור עד שהיא נמוגה כליל
  let introDone = false, introTimer = null;
  const afterIntro = [];
  const introGone = () => $('intro').style.display === 'none';
  function introHide() {
    $('intro').style.display = 'none';
    afterIntro.splice(0).forEach(fn => fn());
  }
  function introEnd(fast) {
    const el = $('intro');
    if (introGone() || (introDone && !fast)) return;
    introDone = true;
    clearTimeout(introTimer);
    if (!el.classList.contains('show')) return introHide();      // עוד לא הופיעה: לא תופיע
    if (fast) {
      // גם דעיכה אטית שכבר רצה נעצרת כאן, וממשיכה מאותה נקודה בדעיכה קצרה
      const cur = getComputedStyle(el).opacity;
      el.style.transition = 'none'; el.style.opacity = cur; void el.offsetWidth;
      el.style.transition = 'opacity .6s ease-out'; el.style.opacity = '0';
    } else el.classList.add('fade');
    introTimer = setTimeout(introHide, fast ? 650 : 4300);
  }
  function whenIntroGone(fn) {
    if (introGone()) return fn();
    afterIntro.push(fn);
    introEnd(true);
  }
  const introStarted = () => $('intro').classList.contains('show');
  function intro() {
    const el = $('intro');
    $('introSam').textContent = G.introText;
    const start = () => {
      if (introDone) return;
      el.classList.add('show');
      map.easeTo(Object.assign({ duration: 11000, easing: x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2 }, home()));
      setTimeout(() => introEnd(false), 5500);
    };
    // נגיעה במפה עוצרת את הסיבוב, והכותרת נמוגה מיד
    ['mousedown', 'touchstart', 'wheel'].forEach(ev => map.once(ev, () => introEnd(true)));
    (document.fonts && document.fonts.load ? document.fonts.load('40px Samaritan').catch(() => {}) : Promise.resolve())
      .then(() => setTimeout(start, 400));
  }

  /* ---------- צילום חד (Google Map Tiles), רק אם הונח מפתח בקובץ google-key.txt ----------
     בלי מפתח, או אם המפתח נדחה, הדף נשאר עם הצילום הרגיל. */
  let zoomBoost = 0;
  async function sharpImagery() {
    let key = '';
    if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    try {
      const r = await fetch('google-key.txt', { cache: 'no-store' });
      if (r.ok) key = (await r.text()).trim();
    } catch (e) { /* אין קובץ */ }
    if (!key) return;
    try {
      const k = encodeURIComponent(key);
      const r = await fetch('https://tile.googleapis.com/v1/createSession?key=' + k, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapType: 'satellite', language: 'en-US', region: 'US' })
      });
      if (!r.ok) throw new Error('createSession ' + r.status);
      const s = await r.json();
      const q = '?session=' + encodeURIComponent(s.session) + '&key=' + k;
      map.addSource('gsat', {
        type: 'raster', tileSize: s.tileWidth || 256, maxzoom: 20,
        tiles: ['https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}' + q],
        attribution: 'Google Maps'
      });
      map.addLayer({ id: 'gsat', type: 'raster', source: 'gsat' }, 'places-fill');
      map.setLayoutProperty('sat', 'visibility', 'none');
      map.setMaxZoom(20.4);
      zoomBoost = 1.2;

      // שורת הזכויות של Google משתנה לפי האזור המוצג, וחובה להציגה במלואה
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;z-index:4;left:8px;bottom:150px;font-size:11px;color:#fff;' +
        'text-shadow:0 0 3px #000;direction:ltr;pointer-events:none';
      document.body.appendChild(box);
      let t = 0;
      const credit = () => {
        clearTimeout(t);
        t = setTimeout(async () => {
          const b = map.getBounds();
          try {
            const v = await fetch('https://tile.googleapis.com/tile/v1/viewport' + q +
              '&zoom=' + Math.round(map.getZoom()) + '&north=' + b.getNorth() + '&south=' + b.getSouth() +
              '&east=' + b.getEast() + '&west=' + b.getWest()).then(x => x.json());
            box.textContent = 'Google Maps · ' + (v.copyright || '');
          } catch (e) { box.textContent = 'Google Maps'; }
        }, 600);
      };
      map.on('moveend', credit); credit();
    } catch (e) {
      console.warn('הצילום החד לא נטען, הדף נשאר עם הצילום הרגיל: ' + e.message);
    }
  }

  /* ---------- כרטיס מקום ---------- */
  function distDir(p) {
    const dx = (p.center[0] - C[0]) / M_LON, dy = (p.center[1] - C[1]) / M_LAT;
    const d = Math.hypot(dx, dy) / 1000;
    const brg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    return { d: d < 10 ? d.toFixed(1) : String(Math.round(d)), c: T('compass')[Math.round(brg / 45) % 8], brg };
  }
  // Wikimedia מגיש תמונות מוקטנות רק ברוחבים קבועים; 330 לרצועה, 1280 לתצוגה המוגדלת
  const sized = (im, px) => im.t.replace(/\/\d+px-/, '/' + px + 'px-');
  const big = im => (im.w >= 1280 ? sized(im, 1280) : im.t);
  function strip(list, key) {
    return '<div class="strip">' + list.map((im, i) =>
      '<button class="ph" data-set="' + key + '" data-i="' + i + '"><img loading="lazy" src="' + esc(sized(im, 330)) + '" alt="' + esc(L(im.cap) || '') + '"></button>').join('') + '</div>';
  }
  const linkTo = id => '<button class="lnk" data-go="' + id + '">' +
    (byId[id].parent && !byId[id].nomap ? '<b class="no">' + partNo(byId[id]) + '</b>' : '<i style="background:' + esc(byId[id].color) + '"></i>') +
    esc(L(byId[id].name)) + '</button>';

  function renderCard() {
    const card = $('card');
    if (state.listing) return renderList();
    const p = byId[state.sel];
    if (!p) { card.classList.remove('open'); return; }
    const touring = state.tourAt >= 0;
    const im = IMAGES[p.id] || {};
    const parts = kids(p.id);
    let h = '<button class="x" id="cardX" aria-label="' + esc(T('close')) + '">✕</button>' +
      '<div class="kind">' + esc(L(p.kind)) + '</div>' +
      '<h2>' + esc(L(p.name)) + '</h2>';
    if (p.parent) h += '<div class="crumb">' + esc(T('partOf')) + ' ' + linkTo(p.parent) + '</div>';
    // בטלפון הכרטיס קצר: שם, סוג והסבר. תמונות והרחבות נפתחות רק כשמבקשים אותן
    const phone = isPhone();
    const hasPhotos = im.photos && im.photos.length;
    if (hasPhotos && !phone) h += strip(im.photos, 'photos');
    h += '<p>' + esc(L(p.summary)) + '</p>';
    if (p.geo) h += '<p class="farline">' + esc(geoLine(p.geo)) + '</p>';
    if (p.far) { const dd = distDir(p); h += '<p class="farline">' + esc(T(p.unseen ? 'farAway' : 'far').replace('{d}', dd.d).replace('{c}', dd.c)) + '</p>'; }
    if (p.nomap) h += '<p class="farline">' + esc(T('nomap')) + '</p>';
    if (hasPhotos && phone) h += sec('photos', T('photos'), strip(im.photos, 'photos'), im.photos.length);
    if (p.route) h += sec('route', T('route'), '<ol class="route">' + p.route.map(r =>
      '<li>' + (byId[r.id] ? linkTo(r.id) : '') + (r.note ? '<span>' + esc(L(r.note)) + '</span>' : '') + '</li>').join('') + '</ol>', p.route.length);
    if (parts.length) h += sec('parts', T('parts'), '<div class="parts">' + parts.map(c => linkTo(c.id)).join('') + '</div>', parts.length);
    if (p.strata.length) h += sec('strata', T('strata'), p.strata.map(s =>
      '<div class="stratum' + (s.period === state.period ? ' hit' : '') + '">' +
      '<b>' + esc(L(periodById[s.period].label)) + '</b><i>' + esc(L(s.when)) + '</i>' +
      '<span>' + esc(L(s.text)) + '</span></div>').join(''), p.strata.length);
    const hasInscr = im.inscr && im.inscr.length;
    if (p.finds.length || hasInscr) {
      h += sec('finds', T(hasInscr ? 'inscr' : 'finds'),
        (hasInscr ? strip(im.inscr, 'inscr') : '') +
        (p.finds.length ? '<ul>' + p.finds.map(f => '<li>' + esc(L(f)) + '</li>').join('') + '</ul>' : ''),
        p.finds.length + (hasInscr ? im.inscr.length : 0));
    }
    h += '<div class="nav' + (touring ? ' on' : '') + '">' +
        '<button id="tourPrev">' + esc(T('prev')) + '</button>' +
        '<em>' + esc(T('station').replace('{i}', state.tourAt + 1).replace('{n}', G.tour.length)) + '</em>' +
        '<button id="tourNext" class="main">' + esc(state.tourAt === G.tour.length - 1 ? T('finish') : T('next')) + '</button>' +
      '</div>' +
      '<div class="note">' + esc(T('note')) + '</div>';
    card.innerHTML = h;
    card.classList.add('open');
    card.scrollTop = 0;
    $('cardX').onclick = () => { endTour(); select(null); };
    if (touring) {
      $('tourPrev').onclick = () => tourGo(state.tourAt - 1);
      $('tourNext').onclick = () => tourGo(state.tourAt + 1);
    }
    card.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => { endTour(); select(b.dataset.go); }; });
    card.querySelectorAll('.ph').forEach(b => { b.onclick = () => lightbox(im[b.dataset.set], +b.dataset.i); });
    // מה שהמשתמש פתח או סגר נשאר כך גם בכרטיסים הבאים
    card.querySelectorAll('details.sec').forEach(d => { d.ontoggle = () => { state.exp[d.dataset.sec] = d.open; }; });
  }

  /* ---------- פרקי הכרטיס: במחשב פתוחים, בטלפון סגורים עד שמבקשים ---------- */
  const isPhone = () => matchMedia('(max-width:640px), (max-height:520px) and (orientation:landscape)').matches;
  function sec(key, title, body, count) {
    const open = isPhone() ? state.exp[key] === true : state.exp[key] !== false;
    return '<details class="sec" data-sec="' + key + '"' + (open ? ' open' : '') + '><summary>' + esc(title) +
      (count ? '<em>' + count + '</em>' : '') + '</summary>' + body + '</details>';
  }
  const num = n => Number(n).toLocaleString('en-US');
  function geoLine(g) {
    const a = [];
    if (g.elev != null) a.push(T('elev').replace('{m}', num(g.elev)));
    if (g.pop) a.push(T('pop').replace('{n}', num(g.pop)).replace('{y}', g.popYear || ''));
    return a.join(' · ');
  }

  function renderList() {
    const card = $('card');
    let h = '<button class="x" id="cardX" aria-label="' + esc(T('close')) + '">✕</button><h2>' + esc(T('listTitle')) + '</h2>';
    GROUPS.forEach(g => {
      const top = PLACES.filter(p => p.group === g.id && !p.parent);
      if (!top.length) return;
      h += '<h3>' + esc(L(g.name)) + '</h3><div class="parts col">' + top.map(p => linkTo(p.id) +
        (kids(p.id).length ? '<div class="sub">' + kids(p.id).map(c => linkTo(c.id)).join('') + '</div>' : '')).join('') + '</div>';
    });
    card.innerHTML = h;
    card.classList.add('open'); card.scrollTop = 0;
    $('cardX').onclick = () => { state.listing = false; renderCard(); };
    card.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => { state.listing = false; select(b.dataset.go); }; });
  }

  /* ---------- תמונה מוגדלת, עם שם הצלם והרישיון ---------- */
  let lb = { list: [], i: 0 };
  function lightbox(list, i) {
    lb = { list, i };
    const im = list[i];
    $('lbImg').src = big(im);
    $('lbCap').innerHTML = (L(im.cap) ? '<b>' + esc(L(im.cap)) + '</b>' : '') +
      '<span>' + esc(T('photoBy')) + ': ' + esc(im.by || '—') + ' · ' + esc(T('licence')) + ': ' + esc(im.lic || '—') +
      ' · <a href="' + esc(im.page) + '" target="_blank" rel="noopener">' + esc(im.src || T('source')) + '</a></span>';
    $('lbPrev').style.visibility = $('lbNext').style.visibility = list.length > 1 ? 'visible' : 'hidden';
    $('lightbox').classList.add('open');
  }
  const lbClose = () => { $('lightbox').classList.remove('open'); $('lbImg').removeAttribute('src'); };
  $('lbX').onclick = lbClose;
  $('lightbox').onclick = e => { if (e.target.id === 'lightbox') lbClose(); };
  $('lbPrev').onclick = () => lightbox(lb.list, (lb.i + lb.list.length - 1) % lb.list.length);
  $('lbNext').onclick = () => lightbox(lb.list, (lb.i + 1) % lb.list.length);
  document.addEventListener('keydown', e => {
    if (!$('lightbox').classList.contains('open')) return;
    if (e.key === 'Escape') lbClose();
    if (e.key === 'ArrowLeft') $('lbNext').click();
    if (e.key === 'ArrowRight') $('lbPrev').click();
  });

  /* ---------- תנועת המצלמה: המקום תמיד בחלק הפנוי של המסך, לא מתחת לכרטיס ---------- */
  function freePad() {
    const card = $('card'), barH = $('bar').offsetHeight, top = 58;
    if (!card.classList.contains('open')) return { top, bottom: barH, left: 0, right: 0 };
    const r = card.getBoundingClientRect();
    if (narrow()) return { top, bottom: Math.round(window.innerHeight - r.top + 8), left: 0, right: 0 };
    return { top, bottom: barH, left: 0, right: Math.round(window.innerWidth - r.left + 8) };
  }
  function flyToPlace(p, slow) {
    const duration = slow ? 5200 : 2400;
    if (p.nomap || !p.center) return;
    if (p.far) {
      // מקום רחוק: עומדים בקצה התחום ומפנים את המבט אליו
      // לא יורדים נמוך מדי ולא מתרחקים מדי מן הפסגה, כדי שההר עצמו לא יסתיר את המבט
      const dd = distDir(p), rad = dd.brg * Math.PI / 180, step = G.reach * 0.55;
      map.flyTo({ center: clampPt(at(Math.sin(rad) * step, Math.cos(rad) * step)), zoom: homeZoom() + 0.3, pitch: 76,
        bearing: dd.brg, duration, essential: true, curve: 1, padding: freePad() });
      return;
    }
    map.flyTo({ center: clampPt(p.focus), zoom: (p.view ? p.view.zoom : 17) + zoomBoost,
      pitch: p.view ? p.view.pitch : 55, bearing: p.view ? p.view.bearing : map.getBearing(),
      duration, essential: true, curve: 1, padding: freePad() });
  }

  function select(id, slow) {
    const started = introStarted();
    state.listing = false;
    state.sel = id;
    const p = byId[id];
    state.open = p ? (p.parent || (kids(id).length ? id : null)) : null;
    repaint();
    if (p) flyToPlace(p, slow);
    else if (!started && map.getPitch() < 50) map.jumpTo(home());
    // המצלמה כבר בדרך; הכרטיס עצמו נפתח רק אחרי שכותרת הפתיחה נמוגה
    whenIntroGone(() => { if (state.sel === id && !state.listing) renderCard(); });
  }

  /* ---------- סיור מודרך ---------- */
  function tourGo(i) {
    if (i < 0) i = 0;
    if (i >= G.tour.length) { endTour(); select(null); goHome(); return; }
    state.tourAt = i;
    $('btnTour').classList.add('on');
    $('btnTour').textContent = T('endTour');
    select(G.tour[i], true);
  }
  function endTour() {
    state.tourAt = -1;
    $('btnTour').classList.remove('on');
    $('btnTour').textContent = T('tour');
  }
  function goHome() {
    introEnd(true);
    map.flyTo(Object.assign({ duration: 2400, essential: true, curve: 1, padding: { top: 0, bottom: 0, left: 0, right: 0 } }, home()));
  }

  $('btnTour').onclick = () => {
    if (state.tourAt >= 0) { endTour(); select(null); goHome(); }
    else tourGo(0);
  };
  $('btnHome').onclick = () => { endTour(); select(null); goHome(); };
  $('btnList').onclick = () => {
    if (!introStarted()) map.jumpTo(home());
    endTour(); state.sel = null; state.open = null; state.listing = !state.listing; repaint();
    whenIntroGone(renderCard);
  };
  $('btnRelief').onclick = e => {
    state.relief = !state.relief;
    e.currentTarget.classList.toggle('on', state.relief);
    map.setTerrain({ source: 'dem', exaggeration: state.relief ? 1.8 : 1 });
  };

  /* ---------- תקופות ---------- */
  const prow = $('periods');
  function periodBtn(id, label, title) {
    const b = document.createElement('button');
    b.textContent = label; if (title) b.title = title;
    b.classList.toggle('on', state.period === id);
    b.onclick = () => {
      state.period = id;
      [...prow.querySelectorAll('button')].forEach(x => x.classList.toggle('on', x === b));
      renderCard(); repaint();
    };
    prow.appendChild(b);
  }
  function buildPeriods() {
    prow.innerHTML = '<span class="lbl">' + esc(T('period')) + '</span>';
    periodBtn(null, T('all'));
    PERIODS.forEach(p => periodBtn(p.id, L(p.name), L(p.years)));
  }

  /* ---------- החלפת שפה ---------- */
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = T('dir');
    document.title = T('title');
    $('ttl').textContent = T('title');
    $('tag').textContent = T('tag');
    $('btnTour').textContent = state.tourAt >= 0 ? T('endTour') : T('tour');
    $('btnHome').textContent = T('home');
    $('btnList').textContent = T('list');
    $('btnRelief').textContent = T('relief');
    $('btnPick').textContent = T('pick');
    buildPeriods();
    buildDial();
    barHeight();
    PLACES.forEach(p => { if (p._pin) { p._pin.textContent = pinText(p); p._pin.title = L(p.name); p._pin.dir = T('dir'); } });
    [...document.querySelectorAll('#langs button')].forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    renderCard();
  }
  [...document.querySelectorAll('#langs button')].forEach(b => {
    b.onclick = () => {
      lang = b.dataset.lang;
      try { localStorage.setItem('gerizim-lang', lang); } catch (e) { /* לא נשמר — לא נורא */ }
      applyLang();
    };
  });
  applyLang();

  /* ---------- סימון נקודה: לחיצה מחזירה קואורדינטות ---------- */
  let toastT = 0;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toastT); toastT = setTimeout(() => { t.style.display = 'none'; }, 6000);
  }
  $('btnPick').onclick = e => {
    state.pick = !state.pick;
    e.currentTarget.classList.toggle('on', state.pick);
    map.getCanvas().style.cursor = state.pick ? 'crosshair' : '';
    if (state.pick) toast(T('pickPrompt'));
  };
  map.on('click', ev => {
    if (!state.pick) return;
    const s = ev.lngLat.lat.toFixed(6) + ', ' + ev.lngLat.lng.toFixed(6);
    toast(s);
    try { navigator.clipboard.writeText(s); } catch (e) { /* אין הרשאה — המספר מוצג על המסך */ }
  });
})();
