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
  /* ---------- מפת ההתמצאות: יישובי הסביבה, העמקים, ההרים והדרך מצטרפים אל המקומות ---------- */
  const OR = window.GERIZIM_ORIENT || null;
  if (OR) {
    OR.groups.forEach(g => GROUPS.push(g));
    OR.places.forEach(p => G.places.push(Object.assign({ color: p.group === 'land' ? '#bfe08f' : '#f0ead8', far: true, unseen: true, orient: true }, p)));
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
      tour: '▶ סיור מודרך', orient: 'מפת התמצאות', legRoad: 'כביש 60 היום', legOld: 'הדרך הישנה דרך שכם', legVil: 'כפר, עיירה או יישוב', legVal: 'עמק', legPeak: 'הר', kmAir: '{n} ק"מ בקו אוויר', mAbove: '{m} מ\'', endTour: '■ סיום הסיור', home: 'מבט על', relief: 'הדגשת תבליט', pick: 'סימון נקודה', list: '☰ המקומות',
      strata: 'שכבות המקום', finds: 'מה נתגלה כאן', inscr: 'כתובות וממצאים', parts: 'חלקי המקום',
      partOf: 'חלק מתוך', route: 'סדר התחנות', prev: '→ הקודמת', next: 'הבאה ←', finish: 'סיום',
      station: 'תחנה {i} מתוך {n}', note: 'תוכן ראשוני. המיקום והגבולות סומנו בקירוב וטעונים אימות.',
      nomap: 'מיקומו של המקום הזה עדיין לא אומת, ולכן הוא אינו מסומן על המפה.',
      far: 'נראה מן הפסגה: {d} ק"מ לכיוון {c}', farAway: 'מרחק מן הפסגה: {d} ק"מ לכיוון {c}', pickPrompt: 'לחץ על נקודה במפה', close: 'סגירה',
      photoBy: 'צילום', licence: 'רישיון', source: 'Wikimedia Commons', listTitle: 'המקומות בסיור', photos: 'תמונות', ins: 'כתובות שנמצאו כאן', insNo: 'כתובת מס\' {n}', insAt: 'נמצאה', scr: { 'aramaic-lapidary': 'ארמית, כתב לפידרי', 'aramaic-cursive': 'ארמית, כתב רהוט', 'paleo-hebrew': 'כתב עברי קדום', greek: 'יוונית', samaritan: 'כתב שומרוני' }, flk: 'צילומי אורי אורחוף', flkPhoto: 'צילום', flkVideo: 'סרטון', flkNote: '', flkAll: 'כל האלבומים של הצלם ב-Flickr', plan: 'שרטוט המקום', planNote: 'שרטוט סכמטי שצויר לפי מידות החפירה. החץ מראה את הצפון; המקום שבכרטיס מודגש בזהב.', planHel: 'התקופה ההלניסטית', planPer: 'התקופה הפרסית', walk: 'סיור רגלי', walkBtn: 'היכנסו לסיור רגלי במקום הזה', walkTip: 'כניסה לסיור רגלי בשחזור תלת-ממדי', dialLetters: ['צ', 'מז', 'ד', 'מע'], dialTitle: 'סיבוב המפה: גררו את החוגה, או לחצו על כיוון', lookTo: 'מבט אל {c}', elev: 'גובה {m} מ׳ מעל פני הים', pop: '{n} תושבים ({y})',
      compass: ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'] },
    en: { dir: 'ltr', title: 'Mount Gerizim — A Tour of the Summit', tag: 'Prototype', period: 'Period:', all: 'All',
      tour: '▶ Guided tour', orient: 'Orientation map', legRoad: 'Route 60 today', legOld: 'The old road through Nablus', legVil: 'Village, town or settlement', legVal: 'Valley', legPeak: 'Mountain', kmAir: '{n} km in a straight line', mAbove: '{m} m', endTour: '■ End tour', home: 'Overview', relief: 'Exaggerate relief', pick: 'Mark a point', list: '☰ Places',
      strata: 'Layers of the place', finds: 'What was found here', inscr: 'Inscriptions and finds', parts: 'Parts of this place',
      partOf: 'Part of', route: 'Order of the stations', prev: '← Previous', next: 'Next →', finish: 'Finish',
      station: 'Stop {i} of {n}', note: 'Preliminary content. Location and outline are approximate and need verification.',
      nomap: 'The location of this place has not been verified yet, so it is not marked on the map.',
      far: 'Seen from the summit: {d} km to the {c}', farAway: 'Distance from the summit: {d} km to the {c}', pickPrompt: 'Click a point on the map', close: 'Close',
      photoBy: 'Photo', licence: 'Licence', source: 'Wikimedia Commons', listTitle: 'Places in the tour', photos: 'Photos', ins: 'Inscriptions found here', insNo: 'Inscription no. {n}', insAt: 'Found', scr: { 'aramaic-lapidary': 'Aramaic, lapidary script', 'aramaic-cursive': 'Aramaic, cursive script', 'paleo-hebrew': 'Paleo-Hebrew script', greek: 'Greek', samaritan: 'Samaritan script' }, flk: 'Photographs by Ori Orhof', flkPhoto: 'Photo', flkVideo: 'Video', flkNote: 'The photographs belong to the photographer and open on Flickr.', flkAll: 'All the photographer’s albums on Flickr', plan: 'Plan of the place', planNote: 'A schematic plan drawn from the excavation dimensions. The arrow points north; the place of this card is marked in gold.', planHel: 'Hellenistic period', planPer: 'Persian period', walk: 'Walk here', walkBtn: 'Walk around this place', walkTip: 'Enter a walk through a 3D reconstruction', dialLetters: ['N', 'E', 'S', 'W'], dialTitle: 'Rotate the map: drag the dial, or tap a direction', lookTo: 'Look {c}', elev: '{m} m above sea level', pop: '{n} inhabitants ({y})',
      compass: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] },
    ar: { dir: 'rtl', title: 'جبل جرزيم — جولة على القمة', tag: 'تجريبي', period: 'الفترة:', all: 'الكل',
      tour: '▶ جولة إرشادية', orient: 'خريطة توجيه', legRoad: 'الطريق 60 اليوم', legOld: 'الطريق القديمة عبر نابلس', legVil: 'قرية أو بلدة أو مستوطنة', legVal: 'سهل أو وادٍ', legPeak: 'جبل', kmAir: '{n} كم في خط مستقيم', mAbove: '{m} م', endTour: '■ إنهاء الجولة', home: 'نظرة عامة', relief: 'إبراز التضاريس', pick: 'تحديد نقطة', list: '☰ الأماكن',
      strata: 'طبقات المكان', finds: 'ما اكتُشف هنا', inscr: 'نقوش ومكتشفات', parts: 'أجزاء المكان',
      partOf: 'جزء من', route: 'ترتيب المحطات', prev: '→ السابقة', next: 'التالية ←', finish: 'إنهاء',
      station: 'المحطة {i} من {n}', note: 'محتوى أوّلي. الموقع والحدود تقريبية وتحتاج إلى تحقق.',
      nomap: 'لم يُتحقق بعد من موقع هذا المكان، ولذلك لا يظهر على الخريطة.',
      far: 'يُرى من القمة: {d} كم باتجاه {c}', farAway: 'البعد عن القمة: {d} كم باتجاه {c}', pickPrompt: 'انقر على نقطة في الخريطة', close: 'إغلاق',
      photoBy: 'تصوير', licence: 'الرخصة', source: 'ويكيميديا كومنز', listTitle: 'أماكن الجولة', photos: 'صور', ins: 'نقوش وُجدت هنا', insNo: 'النقش رقم {n}', insAt: 'وُجد', scr: { 'aramaic-lapidary': 'آرامي، خط حجري', 'aramaic-cursive': 'آرامي، خط ليّن', 'paleo-hebrew': 'خط عبري قديم', greek: 'يوناني', samaritan: 'خط سامري' }, flk: 'صور أوري أورحوف', flkPhoto: 'صورة', flkVideo: 'فيديو', flkNote: 'الصور ملك للمصوّر وتُفتح في موقع Flickr.', flkAll: 'كل ألبومات المصوّر على Flickr', plan: 'مخطط المكان', planNote: 'مخطط تخطيطي رُسم بحسب قياسات التنقيب. السهم يشير إلى الشمال؛ ومكان هذه البطاقة مظلَّل بالذهبي.', planHel: 'الفترة الهلنستية', planPer: 'الفترة الفارسية', walk: 'جولة سيرًا', walkBtn: 'ادخل جولة سيرًا في هذا المكان', walkTip: 'دخول جولة سيرًا في إعادة بناء ثلاثية الأبعاد', dialLetters: ['ش', 'ق', 'ج', 'غ'], dialTitle: 'تدوير الخريطة: اسحب القرص أو اضغط على اتجاه', lookTo: 'النظر نحو {c}', elev: 'الارتفاع {m} م فوق سطح البحر', pop: '{n} نسمة ({y})',
      compass: ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'] }
  };
  let lang = 'he';
  try { lang = localStorage.getItem('gerizim-lang') || 'he'; } catch (e) { /* בלי אחסון — עברית */ }
  try { const q = new URLSearchParams(location.search).get('lang'); if (q) lang = q; } catch (e) { /* כתובת בלי פרמטרים */ }
  if (!UI[lang]) lang = 'he';
  const T = k => UI[lang][k];
  // שדה תוכן הוא {he,en,ar}; בהיעדר תרגום חוזרים לעברית
  const L = v => (v && typeof v === 'object') ? (v[lang] || v.he || '') : (v || '');

  const state = { orient: false, wide: false, sel: null, open: null, period: null, tourAt: -1, relief: false, pick: false, listing: false, exp: {} };

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
  // במפת ההתמצאות התחום רחב: כל הארץ שמסביב להר
  const OBOX = OR ? OR.box : BOX;
  const clampPt = c => { const B = state.wide ? OBOX : BOX; return [Math.min(B.e, Math.max(B.w, c[0])), Math.min(B.n, Math.max(B.s, c[1]))]; };

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



  /* ---------- הסיור הרגלי: כניסה מן המפה אל שחזור תלת-ממדי, כמו ירידה לתצוגת רחוב ---------- */
  const WALK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="M13 8l-3 5 3 3v6M10 13l-3 8M13 8l4 3 2-1M10 9l-3 2v3"/></svg>';
  // נקודות הכניסה (במטרים: מזרחה, דרומה ממרכז הכנסייה) והמבט בכל אחת
  const WALK_STARTS = (() => {
    const WD = window.GERIZIM_WALK, o = {};
    if (WD) Object.keys(WD.starts).forEach(k => { const s = WD.starts[k], en = WD.toEN(s.x, s.z); o[k] = { en, bearing: ((s.yaw * 180 / Math.PI + WD.north) % 360 + 360) % 360 }; });
    return o;
  })();
  const WALK_FROM = { precinct: 'plaza', persian: 'plaza', stones12: 'plaza', secitadel: 'plaza', eaststairs: 'stairs', courts: 'stairs', westentrance: 'city', city: 'city', areaP: 'city', eternal: 'city', areaA: 'areaA', areaB: 'areaB' };
  const VER = (() => { try { return (document.currentScript.src.split('?')[1] || ''); } catch (e) { return ''; } })();
  let walkScripts = null;
  const loadScript = src => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src + (VER ? '?' + VER : ''); s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  function enterWalk(key) {
    const st = WALK_STARTS[key] || WALK_STARTS.plaza, c0 = map.getCenter();
    if (!st) return;
    const back = { center: [c0.lng, c0.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
    introEnd(true); endTour(); state.listing = false; state.sel = null; state.open = null; renderCard(); repaint();
    if (!walkScripts) walkScripts = (window.GERIZIM_WALK ? Promise.resolve() : loadScript('walk_data.js')).then(() => loadScript('walk_people.js')).then(() => loadScript('walk_far.js')).then(() => loadScript('walk_life.js')).then(() => loadScript('walk.js'));
    const mapEl = $('map');
    map.stop();
    map.flyTo({ center: at(st.en[0], st.en[1]), zoom: Math.min(map.getMaxZoom(), 19.2), pitch: 80, bearing: st.bearing, duration: 2300, essential: true, curve: 1 });
    setTimeout(() => mapEl.classList.add('diving'), 1150);
    const arrived = new Promise(r => setTimeout(r, 2350));
    Promise.all([walkScripts, arrived]).then(() => window.GerizimWalk.enter({
      start: key, lang,
      onPlace: id => select(id), onCloseCard: () => select(null), onLang: code => setLang(code),
      // תצלומים אמיתיים של המקום: מן האוסף החופשי, ומצילומי אורי אורחוף
      photosOf: id => {
        // למקום שאין לו תצלומים משלו מוצגים תצלומי המתחם או שרידי העיר בכלל
        const FB = { areaA: 'city', areaB: 'city', areaP: 'city', eaststairs: 'precinct', courts: 'precinct', secitadel: 'precinct', westentrance: 'precinct', persian: 'precinct' };
        const own = (IMAGES[id] || {}).photos || [], src = own.length ? own : ((IMAGES[FB[id]] || {}).photos || []);
        const a = src.map(im => Object.assign({ thumb: sized(im, 330) }, im));
        const F = window.GERIZIM_FLICKR, fl = F && F.places && F.places[id] ? F.places[id].filter(it => it.t).map(it => ({ thumb: it.t, t: it.t, f: it.f, w: it.w, cap: it.c, by: F.by, lic: F.rights ? L(F.rights) : '', page: it.u, src: 'Flickr' })) : [];
        return a.concat(fl);
      },
      onPhoto: (list, i) => lightbox(list, i),
      inscr: window.GERIZIM_INSCR || [], scripts: T('scr'), insNo: T('insNo'),
      onExit: () => { mapEl.classList.remove('diving'); map.jumpTo(Object.assign({}, back, { zoom: Math.max(back.zoom, 16.6) })); }
    })).catch(() => { mapEl.classList.remove('diving'); walkScripts = null; map.flyTo(back); });
  }
  const walkPins = {};
  function buildWalkPins() {
    Object.keys(WALK_STARTS).forEach(k => {
      const st = WALK_STARTS[k];
      let el = walkPins[k];
      if (!el) {
        el = walkPins[k] = document.createElement('button');
        el.className = 'pin walkpin';
        el.onclick = e => { e.stopPropagation(); enterWalk(k); };
        new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -9] }).setLngLat(at(st.en[0], st.en[1])).addTo(map);
      }
      el.innerHTML = WALK_ICON + '<span>' + esc(T('walk')) + '</span>'; el.title = T('walkTip'); el.dir = T('dir');
    });
  }


  /* ---------- שרטוט סכמטי בכרטיס: מצויר כאן מנתוני השחזור, עם מקרא בשפת הממשק ---------- */
  function planSection(p) {
    const WD = window.GERIZIM_WALK;
    if (!WD || !WALK_FROM[p.id]) return '';
    const per = p.id === 'persian' ? 'p' : 'h', ok = o => !o.per || o.per === per;
    const PB = WD.planBox || {}, B = PB[p.id] || PB.precinct || WD.bounds, x0 = B[0], z0 = B[1], w = B[2] - B[0], hgt = B[3] - B[1];
    const inView = b => b && b[2] > B[0] && b[0] < B[2] && b[3] > B[1] && b[1] < B[3];
    const r = (b, fill, extra) => '<rect x="' + (b[0] - x0) + '" y="' + (b[1] - z0) + '" width="' + (b[2] - b[0]) + '" height="' + (b[3] - b[1]) + '" fill="' + fill + '"' + (extra || '') + '/>';
    let s = '<svg viewBox="0 0 ' + w + ' ' + hgt + '" role="img" aria-label="' + esc(T('plan')) + '">';
    WD.floors.forEach(f => { if (ok(f) && !f.deco) s += r(f.box, f.steps ? '#c7b68b' : (f.mat === 'pave' ? '#e2d5b2' : '#d6c79f')); });
    WD.floors.forEach(f => {                             // קווי המדרגות
      if (!ok(f) || !f.steps) return; const b = f.box, q = f.ramp;
      for (let i = 1; i < 12; i++) { const v = q.a + (q.b - q.a) * i / 12;
        s += q.axis === 'x' ? '<line x1="' + (v - x0) + '" y1="' + (b[1] - z0) + '" x2="' + (v - x0) + '" y2="' + (b[3] - z0) + '" stroke="#7a6a45" stroke-width=".4"/>'
                            : '<line x1="' + (b[0] - x0) + '" y1="' + (v - z0) + '" x2="' + (b[2] - x0) + '" y2="' + (v - z0) + '" stroke="#7a6a45" stroke-width=".4"/>'; }
    });
    WD.solids.forEach(o => { if (ok(o) && o.h > 0.5 && !o.shed) s += r(o.box, o.id ? '#b8862e' : (o.house ? '#93826c' : '#3b3024')); });
    // המקומות שבמקרא: לכל אזור מספר, והאזורים של הכרטיס הזה מודגשים
    const zs = WD.zones.filter(z => !z.per || z.per === per);
    const boxOf = z => { if (z.box) return z.box; const fl = WD.floors.filter(f => z.floors.indexOf(f.id) >= 0 && ok(f)); if (!fl.length) return null;
      return [Math.min.apply(0, fl.map(f => f.box[0])), Math.min.apply(0, fl.map(f => f.box[1])), Math.max.apply(0, fl.map(f => f.box[2])), Math.max.apply(0, fl.map(f => f.box[3]))]; };
    const list = [];
    zs.forEach(z => { const b = boxOf(z); if (!inView(b) || z.id === 'plaza' || z.id === 'road') return; const c = [Math.max(b[0], B[0]), Math.max(b[1], B[1]), Math.min(b[2], B[2]), Math.min(b[3], B[3])]; list.push({ z, b: c, hit: z.place === p.id }); });
    list.forEach(o => { if (o.hit) s += r(o.b, 'rgba(217,178,95,.45)', ' stroke="#b8862e" stroke-width="1.2"'); });
    list.forEach((o, i) => { const cx = (o.b[0] + o.b[2]) / 2 - x0, cz = (o.b[1] + o.b[3]) / 2 - z0;
      s += '<circle cx="' + cx + '" cy="' + cz + '" r="5.2" fill="' + (o.hit ? '#b8862e' : '#fffaf0') + '" stroke="#3b3024" stroke-width=".7"/>' +
           '<text x="' + cx + '" y="' + (cz + 2.3) + '" font-size="6.4" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#201a12">' + (i + 1) + '</text>'; });
    // חץ צפון וקנה מידה
    s += '<g transform="translate(' + (w - 14) + ' 16) rotate(' + (-(WD.north || 0)) + ')"><path d="M0 -11 l-4.5 13 h9z" fill="#3b3024"/><text x="0" y="11" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#3b3024">N</text></g>' +
         '<rect x="8" y="' + (hgt - 9) + '" width="50" height="2.4" fill="#3b3024"/><text x="33" y="' + (hgt - 11.5) + '" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#3b3024">50 m</text></svg>';
    return sec('plan', T('plan') + ' · ' + T(per === 'p' ? 'planPer' : 'planHel'),
      '<div class="plan">' + s + '</div><ol class="planlist">' + list.map(o => '<li' + (o.hit ? ' class="hit"' : '') + '>' + esc(L(o.z.name)) + '</li>').join('') + '</ol>' +
      '<p class="plannote">' + esc(T('planNote')) + '</p>', list.length);
  }


  /* ---------- צילומי אורי אורחוף: התמונות מוצגות ברשותו, ושמו כתוב על כל אחת; סרטונים נפתחים ב-Flickr ---------- */
  let flkShown = [];
  function flickrSection(p) {
    const F = window.GERIZIM_FLICKR, list = F && F.places && F.places[p.id];
    flkShown = [];
    if (!list || !list.length) return '';
    const rights = F.rights ? L(F.rights) : '© ' + F.by;
    flkShown = list.filter(it => it.t).map(it => ({ t: it.t, f: it.f, w: it.w, cap: it.c, by: F.by, lic: rights, page: it.u, src: 'Flickr' }));
    const links = list.filter(it => !it.t);
    return sec('flk', T('flk'),
      (flkShown.length ? strip(flkShown, 'flk') : '') +
      (links.length ? '<ul class="flk">' + links.map(it => '<li><a href="' + esc(it.u) + '" target="_blank" rel="noopener"><b>' + esc(T(it.k === 'video' ? 'flkVideo' : 'flkPhoto')) + '</b>' +
        '<span>' + esc(L(it.c)) + '</span><i>' + esc(it.y || '') + '</i></a></li>').join('') + '</ul>' : '') +
      '<p class="flkmore">' + esc(rights) + ' <a href="' + esc(F.account + 'albums') + '" target="_blank" rel="noopener">' + esc(T('flkAll')) + '</a></p>', list.length);
  }


  /* ---------- הכתובות שנמצאו במקום: הנוסח העתיק, התרגום, והיכן בדיוק נמצאה כל אחת ---------- */
  function insSection(p) {
    const list = (window.GERIZIM_INSCR || []).filter(x => x.place === p.id || (p.id === 'precinct' && x.place === 'other'));
    if (!list.length) return '';
    return sec('ins', T('ins'), '<ul class="ins">' + list.map(x =>
      '<li><div class="insno">' + esc(x.no != null ? T('insNo').replace('{n}', x.no) : L(x.label)) + (T('scr')[x.script] ? ' · ' + esc(T('scr')[x.script]) : '') + '</div>' +
      (x.text ? '<div class="instx' + (x.script === 'greek' ? ' gr' : '') + '">' + esc(x.text) + '</div>' : '') +
      (L(x.tr) ? '<div class="instr">' + esc(L(x.tr)) + '</div>' : '') +
      '<div class="insnt">' + esc(T('insAt')) + ': ' + esc(L(x.spot)) + (L(x.note) ? ' · ' + esc(L(x.note)) : '') + '</div></li>').join('') + '</ul>', list.length);
  }

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
  window.addEventListener('resize', () => { if (!state.wide) map.setMinZoom(homeZoom() - 0.02); barHeight(); });

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
  // תווית של עמק נכתבת לאורכו, של הר נושאת משולש, ושל הדרך היא מספרה
  function setPin(p) {
    const el = p._pin;
    if (p.lab === 'valley') { if (!el.firstElementChild) el.innerHTML = '<span></span>'; el.firstElementChild.textContent = L(p.name); }
    else if (p.lab === 'peak') el.textContent = '▲ ' + L(p.name);
    else if (p.lab === 'road') el.textContent = '60';
    else el.textContent = pinText(p);
    el._w = 0;
  }
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
      setPin(p);
    });
    labels();
  }
  // תוויות של מקומות קטנים מופיעות רק מקרוב, כדי שלא יעלו זו על זו
  let orientFresh = false;               // נכנסו אל מפת ההתמצאות דרך בחירת מקום, והמצלמה עוד על הפסגה
  const OZ = 14.2;                       // מתחת לרמה הזאת מפת ההתמצאות מראה את הסביבה, ומעליה חוזרים פרטי הפסגה
  const oExtra = [];                     // סימני הדרך, שלטי הכיוון ותווית הפסגה
  function labels() {
    const z = map.getZoom(), wideView = state.orient && z < OZ, cand = [];
    document.body.classList.toggle('ofar', wideView);
    PLACES.forEach(p => {
      if (!p._pin) return;
      const base = shown(p) && (p.id === state.sel || !!p.parent || !p.labelFrom || z >= p.labelFrom);
      const on = !state.orient ? base && !p.orient : wideView ? shown(p) && !!p.far : base;
      p._pin.style.display = on ? '' : 'none';
      if (on && state.orient) cand.push(p);
    });
    oExtra.forEach(o => { o.el.style.display = state.orient && (!o.summit || wideView) ? '' : 'none'; });
    if (state.orient) declutter(cand);
  }
  // תוויות שעולות זו על זו: החשובה נשארת, והאחרת מחכה עד שמתקרבים
  const ORANK = { nablus: 0.5, ebal: 3, balata: 3.4, well: 3.6, joseph: 3.8, awarta: 4.5, birhamam: 6.5, ebalsite: 6.5 };
  const rank = p => p.id === state.sel ? 0 : ORANK[p.id] || (p.lab === 'valley' ? 1 : p.lab === 'road' ? 2 : p.lab === 'peak' ? 3 : p.lab === 'town' ? 4 : !p.lab ? 5 : 6);
  function declutter(cand) {
    const taken = [], size = el => { if (!el._w) { el._w = el.offsetWidth; el._h = el.offsetHeight; } return [el._w, el._h]; };
    const hit = b => taken.some(t => b[0] < t[2] + 4 && b[2] > t[0] - 4 && b[1] < t[3] + 2 && b[3] > t[1] - 2);
    const dist = c => Math.hypot((c[0] - C[0]) / M_LON, (c[1] - C[1]) / M_LAT);
    const all = cand.map(p => ({ p, el: p._pin, c: p.center, r: rank(p) }))
      .concat(oExtra.filter(o => o.el.style.display !== 'none').map(o => ({ x: o, el: o.el, c: o.c, r: o.summit ? 0.1 : o.end ? 0.2 : o.shield ? 2.2 : 2.4 })));
    all.forEach(o => { o.d = dist(o.c); });
    all.sort((a, b) => a.r - b.r || a.d - b.d).forEach(o => {
      const p = o.p, q = map.project(o.c); let [w, h] = size(o.el), cy = q.y, pad = 0;
      if (p && p.lab === 'valley') {
        // שם עמק פרוש על פני שטח; מקומו נשמר רק סביב אמצעו, ושמות היישובים שבעמק נכתבים עליו
        const a = (parseFloat(o.el.style.getPropertyValue('--rot')) || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
        [w, h] = [(w * c + h * sn) * 0.5, (w * sn + h * c) * 0.5]; cy = q.y - 9 - o.el._h / 2;
      } else if (p && p.orient && p.lab !== 'road') { cy = q.y - 9 - h / 2; pad = 8; }
      else if (p) cy = q.y - 9 - h / 2;
      const b = [q.x - w / 2, cy - h / 2, q.x + w / 2, cy + h / 2 + pad];
      // מקומות משניים מחכים עד שמתקרבים
      if (o.r > 0.3 && (hit(b) || (o.r >= 6.5 && map.getZoom() < 12.6))) o.el.style.display = 'none'; else taken.push(b);
    });
  }
  // שם העמק נכתב לאורך העמק, גם כשמסובבים את המפה
  function valleyRot() {
    const br = map.getBearing();
    PLACES.forEach(p => { if (p.lab !== 'valley' || !p._pin) return; let a = ((p.rot || 0) - br) % 180; if (a > 90) a -= 180; if (a < -90) a += 180; p._pin.style.setProperty('--rot', a.toFixed(1) + 'deg'); });
  }
  let labelsQ = 0;
  const labelsSoon = () => { if (!labelsQ) labelsQ = requestAnimationFrame(() => { labelsQ = 0; labels(); }); };
  map.on('zoom', labels);
  map.on('rotate', () => { if (state.orient) { valleyRot(); labelsSoon(); } });
  map.on('pitch', () => { if (state.orient) labelsSoon(); });
  map.on('moveend', () => { if (state.orient) labels(); });

  /* ---------- מפת ההתמצאות: מבט רחב מלמעלה, הצפון למעלה, עם היישובים, העמקים והדרך ---------- */
  function buildOrient() {
    if (!OR) return;
    map.addSource('oroads', { type: 'geojson', attribution: OR.credit, data: { type: 'FeatureCollection',
      features: OR.roads.map(r => ({ type: 'Feature', properties: { id: r.id }, geometry: { type: 'LineString', coordinates: r.pts } })) } });
    const line = (id, road, paint) => map.addLayer({ id, type: 'line', source: 'oroads', filter: ['==', ['get', 'id'], road],
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint });
    line('oroad-oldcase', 'old', { 'line-color': '#1d1408', 'line-width': 4.6, 'line-opacity': 0.55 });
    line('oroad-old', 'old', { 'line-color': '#fff1c0', 'line-width': 2.2, 'line-dasharray': [1.5, 1.7] });
    line('oroad-case', 'r60', { 'line-color': '#1d1408', 'line-width': 7, 'line-opacity': 0.7 });
    line('oroad-60', 'r60', { 'line-color': '#ffcf40', 'line-width': 3.4 });
    const mk = (cls, c, go) => {
      const el = document.createElement('div');
      el.className = 'omark ' + cls;
      if (go) el.addEventListener('click', ev => { ev.stopPropagation(); go(); });
      new maplibregl.Marker({ element: el, anchor: 'center', opacityWhenCovered: '1' }).setLngLat(c).addTo(map);   // במבט מלמעלה אין מה שיסתיר; בלי זה שלט שבקצה המפה מתעמעם
      const o = { el, c }; oExtra.push(o); return o;
    };
    OR.shields.forEach(c => { const o = mk('shield', c, () => select('road60')); o.shield = true; o.el.textContent = '60'; });
    mk('oldlab', OR.oldAt, () => select('road60')).old = true;
    OR.ends.forEach(e => { mk('end', e.at).end = e; });
    mk('summit', OR.summit.center, () => { endTour(); select(null); goHome(); }).summit = true;
    valleyRot();
    orientText();
  }
  function orientText() {
    if (!OR) return;
    oExtra.forEach(o => {
      o.el._w = 0; o.el.dir = T('dir');
      if (o.end) o.el.innerHTML = '<b>' + o.end.arrow + '</b><span>' + esc(L(o.end.name)) + '</span><i>' + esc(T('kmAir').replace('{n}', o.end.km)) + '</i>';
      if (o.summit) o.el.textContent = '▲ ' + L(OR.summit.name) + ' · ' + T('mAbove').replace('{m}', OR.summit.elev);
      if (o.old) o.el.textContent = T('legOld');
    });
    $('olegend').innerHTML = '<div><i class="l60"></i>' + esc(T('legRoad')) + '</div><div><i class="lold"></i>' + esc(T('legOld')) + '</div>' +
      '<div><i class="lvil"></i>' + esc(T('legVil')) + '</div><div><i class="lval">' + esc(T('legVal')) + '</i><i class="lpk">▲ ' + esc(T('legPeak')) + '</i></div>';
  }
  function orientCam() {
    const c = map.cameraForBounds(narrow() && OR.viewNarrow ? OR.viewNarrow : OR.view, { padding: { top: 62, bottom: $('bar').offsetHeight + 14, left: 14, right: 14 }, bearing: 0, pitch: 0 });
    return { center: c.center, zoom: c.zoom };
  }
  function orientShow(on) {
    state.orient = on;
    $('btnOrient').classList.toggle('on', on);
    document.body.classList.toggle('orient', on);
    ['oroad-oldcase', 'oroad-old', 'oroad-case', 'oroad-60'].forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); });
  }
  function enterOrient(fly) {
    if (!OR || state.orient) return;
    introEnd(true); endTour();
    const cam = orientCam();
    state.wide = true;
    map.setMinZoom(Math.max(9.5, cam.zoom - 0.6));
    orientShow(true);
    if (fly !== false) map.flyTo({ center: cam.center, zoom: cam.zoom, pitch: 0, bearing: 0, duration: 2200, essential: true, curve: 1.2, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
    repaint();
  }
  // היציאה: התחום הצר חוזר רק כשהמצלמה כבר שבה אל הפסגה, כדי שהמפה לא תקפוץ באמצע הדרך
  function leaveOrient() {
    if (!state.orient) return;
    orientShow(false);
    const narrow = () => {
      if (state.orient) return;
      if (map.getZoom() < homeZoom() - 0.05) { map.once('moveend', narrow); return; }
      state.wide = false; map.setMinZoom(homeZoom() - 0.02);
    };
    map.once('moveend', narrow);
    repaint();
  }

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
      el.className = 'pin g-' + p.group + (p.parent ? ' part' : '') + (p.far ? ' far' : '') + (p.orient ? ' olab o-' + p.lab : '');
      el.addEventListener('click', ev => { ev.stopPropagation(); endTour(); select(p.id); });
      p._pin = el;
      new maplibregl.Marker(Object.assign({ element: el, anchor: 'bottom', offset: [0, -9] }, p.far ? { opacityWhenCovered: '1' } : {})).setLngLat(p.center).addTo(map);
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
    buildOrient();
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
  const big = im => im.f || (im.w >= 1280 ? sized(im, 1280) : im.w >= 960 ? sized(im, 960) : im.w >= 500 ? sized(im, 500) : im.t);
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
    const p = byId[state.sel], walking = inWalk();
    // כרטיס שנפתח מתוך הסיור הרגלי מוצג מעליו; ההליכה נעצרת עד שסוגרים אותו, והמבקר נשאר במקומו
    card.classList.toggle('inwalk', walking); if (walking) window.GerizimWalk.pause(!!p);
    if (!p) { card.classList.remove('open'); return; }
    const touring = state.tourAt >= 0 && !walking;
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
    if (WALK_FROM[p.id] && !walking) h += '<button class="walkbtn" id="cardWalk">' + WALK_ICON + esc(T('walkBtn')) + '</button>';
    if (p.geo) h += '<p class="farline">' + esc(geoLine(p.geo)) + '</p>';
    if (p.far) { const dd = distDir(p); h += '<p class="farline">' + esc(T(p.unseen ? 'farAway' : 'far').replace('{d}', dd.d).replace('{c}', dd.c)) + '</p>'; }
    if (p.nomap) h += '<p class="farline">' + esc(T('nomap')) + '</p>';
    if (hasPhotos && phone) h += sec('photos', T('photos'), strip(im.photos, 'photos'), im.photos.length);
    if (p.route) h += sec('route', T('route'), '<ol class="route">' + p.route.map(r =>
      '<li>' + (byId[r.id] ? linkTo(r.id) : '') + (r.note ? '<span>' + esc(L(r.note)) + '</span>' : '') + '</li>').join('') + '</ol>', p.route.length);
    h += planSection(p);
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
    h += insSection(p);
    h += flickrSection(p);
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
    card.querySelectorAll('.ph').forEach(b => { b.onclick = () => lightbox(b.dataset.set === 'flk' ? flkShown : im[b.dataset.set], +b.dataset.i); });
    if ($('cardWalk')) $('cardWalk').onclick = () => enterWalk(WALK_FROM[p.id]);
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
    if (p.far && state.orient) {
      // במפת ההתמצאות טסים אל המקום עצמו, והסביבה נשארת בתמונה
      // מי שבא מן הפסגה מקבל מבט מלמעלה, והצפון למעלה; מי שכבר במפה נשאר בזווית שבחר
      const top = p.lab === 'valley' || p.lab === 'road' || p.lab === 'peak' ? 12.5 : 13.3, fresh = orientFresh;
      orientFresh = false;
      map.flyTo({ center: clampPt(p.center), zoom: Math.min(Math.max(map.getZoom(), 12.3), top), pitch: fresh ? 0 : map.getPitch(), bearing: fresh ? 0 : map.getBearing(),
        duration: fresh ? 2200 : Math.min(duration, 1800), essential: true, curve: fresh ? 1.2 : 1, padding: freePad() });
      return;
    }
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

  const inWalk = () => !!(window.GerizimWalk && window.GerizimWalk.active);
  function select(id, slow) {
    const started = introStarted();
    state.listing = false;
    state.sel = id;
    const p = byId[id];
    state.open = p ? (p.parent || (kids(id).length ? id : null)) : null;
    if (p && OR && !inWalk()) { if (p.orient && !state.orient) { enterOrient(false); orientFresh = true; } else if (!p.far && state.orient) leaveOrient(); }
    repaint();
    if (p && !inWalk()) flyToPlace(p, slow);
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
  // הסיור יוצא תמיד מנקודת הפתיחה: קודם חוזרים אל מבט העל שבו נפתח הדף, ורק משם טסים אל התחנה הראשונה
  let tourWait = null;
  function atHome() {
    const h = home(), c = map.getCenter();
    return Math.abs(c.lng - h.center[0]) < 12 * M_LON && Math.abs(c.lat - h.center[1]) < 12 * M_LAT && Math.abs(map.getZoom() - h.zoom) < 0.08 &&
      Math.abs(map.getPitch() - h.pitch) < 2 && Math.abs(((map.getBearing() - h.bearing + 540) % 360) - 180) < 2;
  }
  function startTour() {
    endTour(); select(null);
    $('btnTour').classList.add('on');
    $('btnTour').textContent = T('endTour');
    if (atHome()) { introEnd(true); tourWait = setTimeout(() => { tourWait = null; tourGo(0); }, 350); return; }
    goHome();
    tourWait = setTimeout(() => { tourWait = null; tourGo(0); }, 2400 + 900);
  }
  function endTour() {
    if (tourWait) { clearTimeout(tourWait); tourWait = null; }
    state.tourAt = -1;
    $('btnTour').classList.remove('on');
    $('btnTour').textContent = T('tour');
  }
  function goHome() {
    introEnd(true);
    leaveOrient();
    map.flyTo(Object.assign({ duration: 2400, essential: true, curve: 1, padding: { top: 0, bottom: 0, left: 0, right: 0 } }, home()));
  }

  $('btnTour').onclick = () => {
    if (state.tourAt >= 0 || tourWait) { endTour(); select(null); goHome(); }
    else startTour();
  };
  $('btnHome').onclick = () => { endTour(); select(null); goHome(); };
  $('btnList').onclick = () => {
    if (!introStarted()) map.jumpTo(home());
    endTour(); state.sel = null; state.open = null; state.listing = !state.listing; repaint();
    whenIntroGone(renderCard);
  };
  $('btnOrient').onclick = () => { if (state.orient) { endTour(); select(null); goHome(); } else { select(null); enterOrient(); } };
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
    $('btnTour').textContent = (state.tourAt >= 0 || tourWait) ? T('endTour') : T('tour');
    $('btnHome').textContent = T('home');
    $('btnList').textContent = T('list');
    $('btnRelief').textContent = T('relief');
    $('btnOrient').textContent = T('orient');
    orientText();
    if (state.orient) labels();
    $('btnPick').textContent = T('pick');
    $('lbX').setAttribute('aria-label', T('close')); $('lbPrev').setAttribute('aria-label', T('prev')); $('lbNext').setAttribute('aria-label', T('next'));
    buildPeriods();
    buildDial();
    buildWalkPins();
    barHeight();
    PLACES.forEach(p => { if (p._pin) { setPin(p); p._pin.title = L(p.name); p._pin.dir = T('dir'); } });
    [...document.querySelectorAll('#langs button')].forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    if (window.GerizimWalk && window.GerizimWalk.setLang) window.GerizimWalk.setLang(lang, { scripts: T('scr'), insNo: T('insNo') });
    renderCard();
  }
  function setLang(code) {
    if (!UI[code]) return;
    lang = code;
    try { localStorage.setItem('gerizim-lang', lang); } catch (e) { /* לא נשמר — לא נורא */ }
    applyLang();
  }
  [...document.querySelectorAll('#langs button')].forEach(b => { b.onclick = () => setLang(b.dataset.lang); });
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
