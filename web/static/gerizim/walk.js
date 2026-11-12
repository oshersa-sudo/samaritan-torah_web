/* הסיור הרגלי: הליכה בגוף ראשון בשחזור סכמטי של המתחם המקודש והעיר.
   נטען רק כשנכנסים לסיור. הנתונים ב-walk_data.js; המנוע כאן. */
(function () {
  'use strict';
  const W = window.GERIZIM_WALK;
  const THREE_URL = 'https://unpkg.com/three@0.149.0/build/three.min.js';
  const EYE = 1.62, RADIUS = 0.45, SPEED = 4.4;

  const UI = {
    he: { tr_en: 'באנגלית', tr_he: 'בעברית', hintT: 'גררו כדי להביט סביב · הקישו על הקרקע כדי ללכת לשם · או השתמשו בחיצים שעל המסך', exit: '✕ חזרה למפה', exitS: '✕ יציאה', layers: 'שכבות', mapBtn: 'מפה', infoBtn: 'מידע', close: 'סגירה', mapBig: 'הגדלת המפה: הפסגה כולה', mapSmall: 'הקטנת המפה', mapHide: 'הסתרת המפה', youHere: 'אתם כאן',
      ly_names: 'שמות מבנים', ly_poi: 'נקודות עניין', ly_routes: 'מסלולים', ly_history: 'מידע היסטורי', ly_inscr: 'כתובות', ly_walker: 'דמות ההולך', ly_life: 'אנשים ובעלי חיים', ly_temple: 'בניין המקדש (הצעת החופר)', hel: 'התקופה ההלניסטית · המאה ה-2 לפנה"ס', per: 'התקופה הפרסית · המאה ה-5 לפנה"ס', temple: 'בניין המקדש לפי הצעת החופר', walker: 'דמות ההולך', signs: 'שלטי הסבר', helS: 'הלניסטית', perS: 'פרסית', templeS: 'מקדש (הצעה)', walkerS: 'דמות', signsS: 'שלטים', look: 'מבט אל', insOrig: 'מוצגת באותיות המקור', insSquare: 'מוצגת באותיות מרובעות, כי אין במכשיר גופן של כתב המקור', insApprox: 'מקום התלייה משוער',
      here: 'אתם כאן', today: 'המקום היום, בתצלומים', more: 'לכרטיס המקום', hint: 'גררו כדי להביט סביב · לחצו על הקרקע כדי ללכת לשם · או החיצים במקלדת',
      note: 'שחזור סכמטי. מה שנמצא בחפירה: מהלך הקירות, השערים, המדרגות והמידות. גובה הקירות, הגגות והדמויות הם השערה.',
      loading: 'בונה את המתחם…', fail: 'הסיור הרגלי לא נטען. בדקו את החיבור לרשת ונסו שוב.', map: 'היכן אני', fwd: 'קדימה', back: 'אחורה', left: 'שמאלה', right: 'ימינה' },
    en: { tr_en: 'In English', tr_he: 'In Hebrew', hintT: 'Drag to look around · tap the ground to walk there · or use the arrows on the screen', exit: '✕ Back to the map', exitS: '✕ Exit', layers: 'Layers', mapBtn: 'Map', infoBtn: 'Info', close: 'Close', mapBig: 'Enlarge the map: the whole summit', mapSmall: 'Shrink the map', mapHide: 'Hide the map', youHere: 'You are here',
      ly_names: 'Building names', ly_poi: 'Points of interest', ly_routes: 'Routes', ly_history: 'Historical information', ly_inscr: 'Inscriptions', ly_walker: 'The walker', ly_life: 'People and animals', ly_temple: 'The temple building (the excavator\'s proposal)', hel: 'Hellenistic period · 2nd century BCE', per: 'Persian period · 5th century BCE', temple: 'The temple building as the excavator proposes', walker: 'The walker', signs: 'Signs', helS: 'Hellenistic', perS: 'Persian', templeS: 'Temple (proposal)', walkerS: 'Walker', look: 'Looking at', insOrig: 'shown in the letters of the original', insSquare: 'shown in square letters, as this device has no font for the original script', insApprox: 'the place where it hangs is approximate',
      here: 'You are here', today: 'The place today, in photographs', more: 'Open the place card', hint: 'Drag to look around · click the ground to walk there · or use the arrow keys',
      note: 'A schematic reconstruction. Found in the excavation: the lines of the walls, the gates, the stairs and the dimensions. Wall heights, roofs and the figures are conjecture.',
      loading: 'Building the precinct…', fail: 'The walk could not be loaded. Check your connection and try again.', map: 'Where am I', fwd: 'Forward', back: 'Back', left: 'Left', right: 'Right' },
    ar: { tr_en: 'بالإنجليزية', tr_he: 'بالعبرية', hintT: 'اسحب للنظر حولك · انقر على الأرض للسير إليها · أو استعمل الأسهم على الشاشة', exit: '✕ العودة إلى الخريطة', exitS: '✕ خروج', layers: 'الطبقات', mapBtn: 'خريطة', infoBtn: 'معلومات', close: 'إغلاق', mapBig: 'تكبير الخريطة: القمة كلها', mapSmall: 'تصغير الخريطة', mapHide: 'إخفاء الخريطة', youHere: 'أنتم هنا',
      ly_names: 'أسماء المباني', ly_poi: 'نقاط الاهتمام', ly_routes: 'المسارات', ly_history: 'معلومات تاريخية', ly_inscr: 'النقوش', ly_walker: 'شخص السائر', ly_life: 'الناس والحيوانات', ly_temple: 'مبنى الهيكل (اقتراح المنقّب)', hel: 'الفترة الهلنستية · القرن الثاني ق.م', per: 'الفترة الفارسية · القرن الخامس ق.م', temple: 'مبنى الهيكل بحسب اقتراح المنقّب', walker: 'شخص السائر', signs: 'لافتات الشرح', helS: 'هلنستية', perS: 'فارسية', templeS: 'هيكل (اقتراح)', walkerS: 'السائر', signsS: 'لافتات', look: 'نظرة إلى', insOrig: 'معروض بحروف الأصل', insSquare: 'معروض بالحروف المربّعة، لعدم وجود خطّ للكتابة الأصلية في الجهاز', insApprox: 'موضع التعليق تقريبي',
      here: 'أنت هنا', today: 'المكان اليوم، بالصور', more: 'بطاقة المكان', hint: 'اسحب للنظر حولك · اضغط على الأرض للسير إليها · أو استعمل أسهم لوحة المفاتيح',
      note: 'إعادة بناء تخطيطية. ما وُجد في التنقيب: مسار الجدران والبوابات والأدراج والقياسات. أما ارتفاع الجدران والسقوف والشخوص فافتراض.',
      loading: 'جارٍ بناء الحرم…', fail: 'تعذّر تحميل الجولة. تحقّق من الاتصال وحاول ثانية.', map: 'أين أنا', fwd: 'إلى الأمام', back: 'إلى الخلف', left: 'يسارًا', right: 'يمينًا' }
  };

  let THREE = null, renderer, scene, camera, root, clock;
  let lang = 'he', period = 'h', showTemple = false, opts = {};
  let active = false, raf = 0;
  const pos = { x: 0, y: 0, z: 0 }, look = { yaw: 0, pitch: 0 };
  let target = null, keys = {}, hold = {}, zoneId = null, smoke = [], flames = [], clickables = [], marker = null, stride = 0, lastX = 0, lastZ = 0;
  const $ = id => document.getElementById(id);
  const T = k => (UI[lang] || UI.he)[k];
  const L = v => (v && (v[lang] || v.he)) || '';
  const inPer = o => !o.per || o.per === period;

  /* ---------- טעינת three.js לפי דרישה ---------- */
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    return new Promise((ok, bad) => {
      const s = document.createElement('script');
      s.src = THREE_URL; s.onload = () => ok(window.THREE); s.onerror = bad;
      document.head.appendChild(s);
    });
  }

  /* ---------- גובה הקרקע והיכן מותר ללכת ---------- */
  const inBox = (b, x, z, m) => x >= b[0] - (m || 0) && x <= b[2] + (m || 0) && z >= b[1] - (m || 0) && z <= b[3] + (m || 0);
  function floorY(f, x, z) {
    if (!f.ramp) return f.y;
    const r = f.ramp, v = r.axis === 'x' ? x : z;
    const k = Math.max(0, Math.min(1, (v - r.a) / (r.b - r.a)));
    return r.ya + (r.yb - r.ya) * k;
  }
  // על מדרגות: גובה המדרגה עצמה שבנקודה (ההולך נע על קו השיפוע, אבל מי שעומד — עומד על מדרגה)
  function standY(f, x, z) {
    if (!f.steps) return floorY(f, x, z);
    const r = f.ramp, v = r.axis === 'x' ? x : z, k = Math.max(0, Math.min(0.9999, (v - r.a) / (r.b - r.a)));
    return r.ya + (r.yb - r.ya) * Math.floor(k * f.steps) / f.steps;
  }
  function floorAt(x, z, nearY) {
    let best = null, bd = 1e9;
    for (const f of W.floors) {
      if (f.deco || !inPer(f) || !inBox(f.box, x, z)) continue;
      const y = floorY(f, x, z), d = nearY == null ? -y : Math.abs(y - nearY);
      if (d < bd) { bd = d; best = { f, y }; }
    }
    return best;
  }
  function blocked(x, z, y) {
    for (const s of W.solids) {
      if (!inPer(s) || s.h < 0.5 || s.shed) continue;
      if (s.y0 > y + 1.7 || s.y0 + s.h < y + 0.35) continue;
      if (inBox(s.box, x, z, RADIUS)) return true;
    }
    const tp = showTemple && W.temple[period];
    if (tp && (inBox(tp.box, x, z, RADIUS) || inBox(tp.porch, x, z, RADIUS))) return true;
    if (tp) for (const b of innerWalls(tp)) if (inBox(b, x, z, RADIUS)) return true;
    return false;
  }
  // קירות המתחם הפנימי המשוער: מלבן נמוך עם פתח בצלע המזרחית
  function innerWalls(tp) {
    if (!tp.inner) return [];
    const b = tp.inner, g = tp.gap, k = 0.8;
    return [[b[0], b[1], b[2], b[1] + k], [b[0], b[3] - k, b[2], b[3]], [b[0], b[1], b[0] + k, b[3]], [b[2] - k, b[1], b[2], -g[1]], [b[2] - k, -g[0], b[2], b[3]]];
  }
  function propHit(x, z, ox, oz) {
    for (const b of (W.blocks || [])) {
      if (!inPer(b)) continue;
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < b.r + 0.3 && d < Math.hypot(ox - b.x, oz - b.z)) return true;
    }
    return false;
  }
  // ox, oz — מהיכן באים (אם נמסרו, נבדקים גם החפצים שבדרך)
  function canStand(x, z, y, ox, oz) {
    const f = floorAt(x, z, y);
    if (!f || Math.abs(f.y - y) > 1.1) return null;
    if (ox != null && propHit(x, z, ox, oz)) return null;
    return blocked(x, z, f.y) ? null : f;
  }

  /* ---------- מרקמים מצוירים ---------- */
  function tex(draw, size, rep) {
    const c = document.createElement('canvas'); c.width = c.height = size || 256;
    draw(c.getContext('2d'), c.width);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (rep) t.repeat.set(rep, rep);
    return t;
  }
  const R = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  function speckle(g, n, a, cols, S) {
    for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = a * (0.4 + R() * 0.6); const r = 1 + R() * 3; g.fillRect(R() * S, R() * S, r, r); }
    g.globalAlpha = 1;
  }
  function makeMaterials() {
    const m = {};
    const lam = (map, extra) => new THREE.MeshLambertMaterial(Object.assign({ map }, extra || {}));
    m.ashlar = lam(tex((g, S) => {                      // גזית לבנה מטויחת: נדבכים של חצי מטר
      g.fillStyle = '#e9e1cc'; g.fillRect(0, 0, S, S);
      speckle(g, 900, 0.10, ['#b7a888', '#fff', '#9c8e70'], S);
      g.strokeStyle = 'rgba(110,95,70,.5)'; g.lineWidth = 1.4;
      for (let r = 0; r < 4; r++) {
        const y = r * S / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
        for (let k = 0; k < 2; k++) { const x = (k * S / 2 + (r % 2) * S / 4 + S * 0.07) % S; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + S / 4); g.stroke(); }
      }
    }));
    const stones = (bg, cols, n, rmin, rmax) => tex((g, S) => {
      g.fillStyle = bg; g.fillRect(0, 0, S, S);
      for (let i = 0; i < n; i++) {
        const x = R() * S, y = R() * S, rx = rmin + R() * (rmax - rmin), ry = rx * (0.6 + R() * 0.3);
        for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
          g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, R() * 0.6 - 0.3, 0, 6.3);
          g.fillStyle = cols[i % cols.length]; g.fill(); g.strokeStyle = 'rgba(40,32,22,.55)'; g.lineWidth = 1.5; g.stroke();
        }
      }
      speckle(g, 500, 0.12, ['#6d6250', '#fff'], S);
    });
    m.field = lam(stones('#6f6452', ['#b3a58a', '#a39579', '#c2b497', '#958770'], 46, 14, 30));
    m.bigstone = lam(stones('#5f5646', ['#a99c84', '#b8ab92', '#9a8d75'], 12, 40, 62));
    m.plaster = lam(tex((g, S) => {
      g.fillStyle = '#efe8d6'; g.fillRect(0, 0, S, S); speckle(g, 700, 0.08, ['#cdbf9f', '#fff', '#b5a684'], S);
      g.globalAlpha = 0.03; g.fillStyle = '#7a6a4a'; for (let i = 0; i < 7; i++) g.fillRect(R() * S, 0, 6 + R() * 22, S); g.globalAlpha = 1;
    }));
    m.pave = lam(tex((g, S) => {                        // ריצוף אבן
      g.fillStyle = '#b5a888'; g.fillRect(0, 0, S, S);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
        const x = ((k + (r % 2) * 0.5) * S / 3) % S, y = r * S / 4;
        g.fillStyle = ['#d3c7a9', '#c9bc9d', '#dccfb1', '#c2b596'][Math.floor(R() * 4)];
        g.fillRect(x + 2, y + 2, S / 3 - 4, S / 4 - 4); if (x + S / 3 > S) g.fillRect(x - S + 2, y + 2, S / 3 - 4, S / 4 - 4);
      }
      speckle(g, 600, 0.10, ['#8e8266', '#fff'], S);
    }));
    m.step = m.pave;
    // טיח הסיד הלבן מאיר גם בצל
    m.plaster.emissive = new THREE.Color(0x3a362c); m.ashlar.emissive = new THREE.Color(0x2c2920);
    m.earth = lam(tex((g, S) => { g.fillStyle = '#b79f7b'; g.fillRect(0, 0, S, S); speckle(g, 2600, 0.16, ['#8f7a59', '#d2bd98', '#a08a66', '#c9b48e'], S); }));
    m.terrain = lam(tex((g, S) => { g.fillStyle = '#9d9069'; g.fillRect(0, 0, S, S); speckle(g, 3000, 0.2, ['#7f7a50', '#b8a984', '#6f6f48', '#c7b891', '#8c8458'], S); }, 256, 1));
    m.roof = lam(tex((g, S) => { g.fillStyle = '#a8946d'; g.fillRect(0, 0, S, S); speckle(g, 1800, 0.14, ['#8a7653', '#c4b08a'], S); }));
    m.wood = lam(tex((g, S) => { g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, S, S); g.strokeStyle = 'rgba(30,18,8,.4)'; for (let i = 0; i < 40; i++) { g.beginPath(); const x = R() * S; g.moveTo(x, 0); g.lineTo(x + R() * 8 - 4, S); g.stroke(); } }));
    m.rock = lam(stones('#8d8068', ['#b9ad94', '#a89c83', '#c6baa0', '#9c907a'], 9, 46, 80));
    m.cloth = c => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
    m.dark = new THREE.MeshLambertMaterial({ color: 0x2a2118 });
    m.ash = new THREE.MeshLambertMaterial({ color: 0x8b8880 });
    m.clay = new THREE.MeshLambertMaterial({ color: 0xb5714a });
    m.water = new THREE.MeshLambertMaterial({ color: 0x30505a });
    /* פתחים, חלונות וקורות: מצוירים כלוחות. פתח במסגרת אבן גזית ובו דלת קרשים; חלון קטן וגבוה בסבכת עץ; קצות קורות הגג */
    const stoneBg = (g, S) => { g.fillStyle = '#d9d0b8'; g.fillRect(0, 0, S, S); speckle(g, 900, 0.12, ['#b7a888', '#f4eeda', '#8f8266'], S); };
    const frame = (g, S) => {                            // מזוזות ומשקוף
      stoneBg(g, S);
      g.strokeStyle = 'rgba(80,65,42,.55)'; g.lineWidth = 2;
      for (let y = 0.13 * S; y < S; y += 0.145 * S) { g.beginPath(); g.moveTo(0, y); g.lineTo(0.14 * S, y); g.moveTo(0.86 * S, y); g.lineTo(S, y); g.stroke(); }
      g.beginPath(); g.moveTo(0, 0.13 * S); g.lineTo(S, 0.13 * S); g.stroke();
      const sh = g.createLinearGradient(0, 0.13 * S, 0, 0.2 * S); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = '#17110b'; g.fillRect(0.14 * S, 0.13 * S, 0.72 * S, 0.84 * S);
      g.fillStyle = '#b9ae94'; g.fillRect(0.1 * S, 0.965 * S, 0.8 * S, 0.035 * S);                          // הסף
      return sh;
    };
    const leaf = (g, S, x0, x1) => {                     // כנף דלת: קרשים, שלושה בריחים ומסמרות
      const n = Math.max(2, Math.round((x1 - x0) / (0.145 * S)));
      for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * i / n; g.fillStyle = ['#6f4d2d', '#664628', '#755233', '#5f4125'][(i * 3 + n) % 4]; g.fillRect(x, 0.135 * S, (x1 - x0) / n - 1.5, 0.83 * S); }
      g.fillStyle = '#4a321c'; for (const y of [0.24, 0.52, 0.8]) { g.fillRect(x0, y * S, x1 - x0, 0.045 * S); for (let i = 0; i < n; i++) { g.fillStyle = '#b89460'; g.beginPath(); g.arc(x0 + (x1 - x0) * (i + 0.5) / n, (y + 0.022) * S, 0.012 * S, 0, 6.3); g.fill(); g.fillStyle = '#4a321c'; } }
      g.strokeStyle = '#a8854f'; g.lineWidth = 0.016 * S; g.beginPath(); g.arc(x1 - 0.09 * S, 0.57 * S, 0.035 * S, 0, 6.3); g.stroke();   // טבעת
    };
    m.door = lam(tex((g, S) => { const sh = frame(g, S); leaf(g, S, 0.145 * S, 0.855 * S); g.fillStyle = sh; g.fillRect(0.14 * S, 0.13 * S, 0.72 * S, 0.07 * S); }));
    m.doorAjar = lam(tex((g, S) => { const sh = frame(g, S); leaf(g, S, 0.42 * S, 0.855 * S); g.fillStyle = sh; g.fillRect(0.14 * S, 0.13 * S, 0.72 * S, 0.07 * S); }));
    m.shop = lam(tex((g, S) => {                         // חנות פתוחה: פנים אפל, מדפים, כדים, ודלפק עץ
      const sh = frame(g, S);
      const ig = g.createLinearGradient(0, 0.13 * S, 0, S); ig.addColorStop(0, '#120d08'); ig.addColorStop(1, '#3a2c1c'); g.fillStyle = ig; g.fillRect(0.14 * S, 0.13 * S, 0.72 * S, 0.84 * S);
      g.fillStyle = '#5b4028'; g.fillRect(0.16 * S, 0.36 * S, 0.68 * S, 0.018 * S); g.fillRect(0.16 * S, 0.52 * S, 0.68 * S, 0.018 * S);
      const cols = ['#b5714a', '#c98a5e', '#8f5a3a', '#d6b25a', '#a44a36'];
      for (let i = 0; i < 6; i++) { g.fillStyle = cols[i % 5]; g.beginPath(); g.ellipse((0.22 + i * 0.11) * S, 0.325 * S, 0.035 * S, 0.045 * S, 0, 0, 6.3); g.fill(); g.beginPath(); g.ellipse((0.25 + i * 0.1) * S, 0.487 * S, 0.03 * S, 0.04 * S, 0, 0, 6.3); g.fill(); }
      g.fillStyle = '#6b4a2b'; g.fillRect(0.14 * S, 0.68 * S, 0.72 * S, 0.29 * S); g.fillStyle = '#7d5a36'; g.fillRect(0.13 * S, 0.66 * S, 0.74 * S, 0.035 * S);
      g.strokeStyle = 'rgba(30,18,8,.45)'; g.lineWidth = 1.5; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo((0.14 + i * 0.144) * S, 0.7 * S); g.lineTo((0.14 + i * 0.144) * S, 0.97 * S); g.stroke(); }
      g.fillStyle = sh; g.fillRect(0.14 * S, 0.13 * S, 0.72 * S, 0.07 * S);
    }));
    m.win = lam(tex((g, S) => {
      stoneBg(g, S); g.fillStyle = '#15100a'; g.fillRect(0.17 * S, 0.17 * S, 0.66 * S, 0.66 * S);
      g.strokeStyle = '#6b4a2b'; g.lineWidth = 0.05 * S; for (const k of [0.34, 0.5, 0.66]) { g.beginPath(); g.moveTo(k * S, 0.17 * S); g.lineTo(k * S, 0.83 * S); g.stroke(); }
      for (const k of [0.39, 0.61]) { g.beginPath(); g.moveTo(0.17 * S, k * S); g.lineTo(0.83 * S, k * S); g.stroke(); }
      g.strokeStyle = 'rgba(80,65,42,.6)'; g.lineWidth = 2; g.strokeRect(0.17 * S, 0.17 * S, 0.66 * S, 0.66 * S);
    }, 128));
    const cut = (draw, size) => { const t = tex(draw, size || 128); return new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }); };
    m.beams = cut((g, S) => {                            // אריח של 2.4 מ' על 0.3 מ': שני קצות קורה עגולים
      g.clearRect(0, 0, S, S);
      for (const cx of [0.25, 0.75]) { g.fillStyle = '#4a321c'; g.beginPath(); g.ellipse(cx * S, 0.5 * S, 0.042 * S, 0.34 * S, 0, 0, 6.3); g.fill(); g.fillStyle = '#7a5633'; g.beginPath(); g.ellipse(cx * S, 0.46 * S, 0.026 * S, 0.2 * S, 0, 0, 6.3); g.fill(); }
    });
    m.ladder = cut((g, S) => {
      g.clearRect(0, 0, S, S); g.fillStyle = '#6b4a2b'; g.fillRect(0.12 * S, 0, 0.1 * S, S); g.fillRect(0.78 * S, 0, 0.1 * S, S);
      for (let i = 0; i < 8; i++) g.fillRect(0.12 * S, (0.06 + i * 0.125) * S, 0.76 * S, 0.035 * S);
    });
    m.mat = lam(tex((g, S) => {                          // מחצלת קנים ועליה פירות מתייבשים
      g.fillStyle = '#b79f6a'; g.fillRect(0, 0, S, S); g.strokeStyle = 'rgba(90,70,35,.5)'; for (let y = 0; y < S; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
      for (let i = 0; i < 90; i++) { g.fillStyle = ['#5b3a5e', '#7a4a2a', '#8a3a2e', '#6e5a2a'][i % 4]; g.beginPath(); g.arc(12 + R() * (S - 24), 12 + R() * (S - 24), 3 + R() * 2.5, 0, 6.3); g.fill(); }
    }, 128));
    m.bronze = new THREE.MeshLambertMaterial({ color: 0x9a7a3c, emissive: 0x2a1f0a });
    m.flame = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    m.leaf = new THREE.MeshLambertMaterial({ color: 0x5d7a3a, side: THREE.DoubleSide });
    m.pale = new THREE.MeshLambertMaterial({ color: 0xcbb690 });
    m.ghost = new THREE.MeshLambertMaterial({ color: 0xfff6dc, transparent: true, opacity: 0.82, map: m.ashlar.map });
    return m;
  }

  /* ---------- בניית הגופים ---------- */
  function boxGeo(w, h, d, tile) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, t = tile || 2;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / t, uv.getY(k) * dims[f][1] / t); }
    return g;
  }
  function addBox(b, y0, h, mat, tile) {
    const w = b[2] - b[0], d = b[3] - b[1];
    const me = new THREE.Mesh(boxGeo(w, h, d, tile), mat); me.castShadow = me.receiveShadow = shadows;
    me.position.set((b[0] + b[2]) / 2, y0 + h / 2, (b[1] + b[3]) / 2);
    root.add(me); return me;
  }
  const terrainH = (x, z) => W.terrain(x, z);
  let nearBox = [0, 0, 0, 0];
  // גובה הקרקע בנקודה: פני השטח, ובהם חצובים מפלסי ההליכה; בשוליים — נמזג אל הנוף הרחוק
  function groundY(x, z) {
    let y = terrainH(x, z), cut = null, lay = null;
    for (const f of W.floors) {
      if (f.deco || !inPer(f) || !inBox(f.box, x, z, f.city ? 2.6 : 1.4)) continue;
      const fy = floorY(f, Math.max(f.box[0], Math.min(f.box[2], x)), Math.max(f.box[1], Math.min(f.box[3], z))) - (f.steps ? 0.3 : 0.12);
      if (f.city) lay = lay == null ? fy : Math.min(lay, fy); else cut = cut == null ? fy : Math.min(cut, fy);
    }
    // רחובות העיר שעל המדרון: הקרקע צמודה אליהם משני הצדדים. מפלסי המתחם רק חוצבים בה
    if (lay != null) y = lay;
    if (cut != null) y = Math.min(y, cut);
    const far = life && life.farY(x, z);
    if (far != null && lay == null && cut == null) { const edge = Math.min(x - nearBox[0], nearBox[2] - x, z - nearBox[1], nearBox[3] - z); if (edge < 70) y = far + (y - far) * Math.max(0, edge / 70); }
    return y;
  }
  function buildTerrain(M) {
    const SX = W.bounds[2] - W.bounds[0] + 160, SZ = W.bounds[3] - W.bounds[1] + 160;
    const g = new THREE.PlaneGeometry(SX, SZ, Math.round(SX / 2.4), Math.round(SZ / 2.4));
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv, cx = (W.bounds[0] + W.bounds[2]) / 2, cz = (W.bounds[1] + W.bounds[3]) / 2;
    let low = -55;
    nearBox = [cx - SX / 2, cz - SZ / 2, cx + SX / 2, cz + SZ / 2];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + cx, z = p.getZ(i) + cz; let y = groundY(x, z);
      const edge = Math.min(x - nearBox[0], nearBox[2] - x, z - nearBox[1], nearBox[3] - z);
      if (edge < 1) y -= 40;                                // השפה יורדת אל מתחת לנוף הרחוק
      if (y < low && edge >= 1) low = y;
      p.setXYZ(i, x, y, z); uv.setXY(i, x / 9, z / 9);
    }
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, M.terrain); ground.receiveShadow = shadows; root.add(ground);
    // הרחק: טבעת נמוכה והרים באופק. הר עיבל מצפון
    const real = !!(life && life.farY(0, 0) != null);
    const far = new THREE.Mesh(new THREE.CircleGeometry(real ? 40000 : 2600, 40), new THREE.MeshLambertMaterial({ color: 0x8f8a63 }));
    far.rotation.x = -Math.PI / 2; far.position.y = real ? -900 : low - 5; (real ? farRoot : root).add(far);
    if (real) return;
    const hill = (x, z, sx, sy, sz, col) => { const h = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, 6.3, 0, 1.6), new THREE.MeshLambertMaterial({ color: col, fog: false })); h.scale.set(sx, sy, sz); h.position.set(x, low - 7, z); root.add(h); };
    hill(-100, -2700, 1700, 330, 900, 0x8b9274);                  // הר עיבל
    hill(1900, -1500, 1200, 200, 900, 0x9aa088); hill(2600, 600, 1500, 170, 1400, 0xa6aa96); hill(-2400, 300, 1300, 210, 1500, 0x969c80);
    hill(300, 2600, 1800, 190, 900, 0x9aa086); hill(-1700, -1700, 900, 160, 800, 0x8f9678); hill(1500, 2000, 900, 150, 800, 0xa2a690);
  }
  function buildFloors(M) {
    for (const f of W.floors) {
      if (!inPer(f)) continue;
      const b = f.box, mat = M[f.mat] || M.earth;
      if (f.steps) {
        const r = f.ramp, n = f.steps, len = r.b - r.a, tread = len / n;
        for (let i = 0; i < n; i++) {
          const a = r.a + i * tread, top = r.ya + (r.yb - r.ya) * (i + 1) / n, base = Math.min(r.ya, r.yb) - 0.6;
          const bb = r.axis === 'x' ? [a, b[1], a + tread, b[3]] : [b[0], a, b[2], a + tread];
          const me = addBox(bb, base, top - base + (r.ya - r.yb) / n * 0.999, mat, 2); clickables.push(me);
        }
      } else if (f.ramp) {
        const g = new THREE.PlaneGeometry(b[2] - b[0], b[3] - b[1], 1, 6); g.rotateX(-Math.PI / 2);
        const p = g.attributes.position, uv = g.attributes.uv, cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz; p.setXYZ(i, x, floorY(f, x, z) + 0.03, z); uv.setXY(i, x / 2, z / 2); }
        g.computeVertexNormals(); const me = new THREE.Mesh(g, mat); me.receiveShadow = shadows; root.add(me); clickables.push(me);
      } else {
        const g = new THREE.PlaneGeometry(b[2] - b[0], b[3] - b[1]); g.rotateX(-Math.PI / 2);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b[2] - b[0]) / 2, uv.getY(i) * (b[3] - b[1]) / 2);
        const me = new THREE.Mesh(g, mat); me.receiveShadow = shadows; me.position.set((b[0] + b[2]) / 2, f.y + (f.deco ? 0.02 : 0.03), (b[1] + b[3]) / 2); root.add(me);
        if (!f.deco) clickables.push(me);
      }
    }
  }
  function buildSolids(M) {
    for (const s of W.solids) {
      if (!inPer(s)) continue;
      const b = s.box;
      if (s.rampTo) {                                   // כבש המזבח
        const g = new THREE.BufferGeometry(), x1 = b[0], x2 = b[2], z1 = b[1], z2 = b[3], h = s.rampTo;
        // dir 'x': הצד הגבוה במערב ויורדים מזרחה; אחרת הצד הגבוה בצפון ויורדים דרומה
        g.setAttribute('position', new THREE.Float32BufferAttribute(s.dir === 'x'
          ? [x1, h, z1, x1, h, z2, x2, 0, z1, x2, 0, z2, x1, 0, z1, x1, 0, z2]
          : [x1, h, z1, x2, h, z1, x1, 0, z2, x2, 0, z2, x1, 0, z1, x2, 0, z1], 3));
        g.setIndex([0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5]); g.computeVertexNormals();
        root.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xe8e0cc, side: THREE.DoubleSide }))); continue;
      }
      if (s.h <= 0) continue;
      const mat = M[s.mat] || M.ashlar;
      addBox(b, s.y0, s.h, mat, s.mat === 'bigstone' ? 4 : 2);
      const top = s.y0 + s.h, w = b[2] - b[0], d = b[3] - b[1];
      if (s.roof === 'crenel') {                        // שיני חומה בראש המגדלים והשערים
        const n = Math.max(2, Math.round(w / 2.2)), k = Math.max(2, Math.round(d / 2.2));
        for (let i = 0; i < n; i++) { const x = b[0] + (i + 0.25) * w / n; addBox([x, b[1], x + w / n * 0.5, b[1] + 0.55], top, 0.8, mat); addBox([x, b[3] - 0.55, x + w / n * 0.5, b[3]], top, 0.8, mat); }
        for (let i = 0; i < k; i++) { const z = b[1] + (i + 0.25) * d / k; addBox([b[0], z, b[0] + 0.55, z + d / k * 0.5], top, 0.8, mat); addBox([b[2] - 0.55, z, b[2], z + d / k * 0.5], top, 0.8, mat); }
      }
      if (s.roof === 'flat') { addBox([b[0] - 0.2, b[1] - 0.2, b[2] + 0.2, b[3] + 0.2], top, 0.25, M.roof); addBox([b[0] - 0.2, b[1] - 0.2, b[2] + 0.2, b[1] + 0.25], top + 0.25, 0.75, mat); addBox([b[0] - 0.2, b[3] - 0.25, b[2] + 0.2, b[3] + 0.2], top + 0.25, 0.75, mat); addBox([b[0] - 0.2, b[1], b[0] + 0.25, b[3]], top + 0.25, 0.75, mat); addBox([b[2] - 0.25, b[1], b[2] + 0.2, b[3]], top + 0.25, 0.75, mat); }
      if (s.ribs) {                                   // קיר בבליטות ושקעים: רצועות בולטות לאורך הפן החיצוני
        const xo = s.ribs === 'w' ? [b[0] - 0.4, b[0]] : [b[2], b[2] + 0.4];
        for (let z = b[1] + 1; z < b[3] - 3; z += 9) addBox([xo[0], z, xo[1], z + 4.2], s.y0, s.h, mat);
      }
      if (s.house) {                                    // פתחים במסגרת אבן, חלונות קטנים וגבוהים, קצות קורות, סככות בד, סולמות
        const sides = s.shops ? [s.shops] : ['s', 'n'];
        for (const side of sides) {
          const alongX = side === 's' || side === 'n', len = alongX ? w : d, nS = Math.max(1, Math.floor(len / 9));
          const ry = side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2;
          const face = side === 's' ? b[3] + 0.03 : side === 'n' ? b[1] - 0.03 : side === 'e' ? b[2] + 0.03 : b[0] - 0.03;
          const out = (side === 's' || side === 'e') ? 1 : -1, gl = s.dys && s.dys[side] != null ? s.dys[side] : s.y0, hh = top - gl;
          const P3 = (uu, y, off) => alongX ? [uu, y, face + off * out] : [face + off * out, y, uu];
          const flat = (wd, ht, mat, uu, y, off) => { const me = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), mat); me.position.set.apply(me.position, P3(uu, y, off || 0)); me.rotation.y = ry; root.add(me); return me; };
          for (let i = 0; i < nS; i++) {
            const u = (alongX ? b[0] : b[1]) + (i + 0.5) * len / nS, hsh = Math.abs(Math.round(u * 7.3 + b[0] * 3.1 + b[1] * 1.7)) + i;
            flat(1.9, 2.6, s.shops ? (hsh % 3 === 0 ? M.doorAjar : M.shop) : (hsh % 4 === 0 ? M.doorAjar : M.door), u, gl + 1.3);
            const wy = gl + Math.min(hh - 1.0, 3.05);
            if (len / nS > 4.6) flat(0.62, 0.62, M.win, u + 2.3, wy);
            if (len / nS > 7.4) flat(0.62, 0.62, M.win, u - 2.3, wy);
            if (s.shops && hh < 7) {
              const aw = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.9), M.cloth([0xb5533c, 0xc9a24a, 0x6d7f8f, 0xd8c7a0][(i + Math.round(Math.abs(u))) % 4]));
              aw.position.set.apply(aw.position, P3(u, gl + 2.95, 0.85)); aw.rotation.order = 'YXZ'; aw.rotation.y = ry; aw.rotation.x = Math.PI / 2 - 0.42; aw.castShadow = shadows; root.add(aw);
            } else if (!s.shops && hsh % 5 === 1 && hh < 6.5 && len / nS > 6) {   // סולם אל הגג
              const ld = flat(0.62, hh + 0.5, M.ladder, u - 1.75, gl + (hh + 0.5) / 2 - 0.05, 0.42); ld.rotation.order = 'YXZ'; ld.rotation.x = -0.2;
            }
          }
          if (hh > 3 && len > 3) {                        // קצות קורות הגג, מתחת למעקה
            const g2 = new THREE.PlaneGeometry(len - 0.4, 0.3), uv2 = g2.attributes.uv; for (let k = 0; k < uv2.count; k++) uv2.setX(k, uv2.getX(k) * (len - 0.4) / 2.4);
            const bm = new THREE.Mesh(g2, M.beams); bm.position.set.apply(bm.position, P3((alongX ? b[0] : b[1]) + len / 2, top - 0.36, 0.006)); bm.rotation.y = ry; root.add(bm);
          }
        }
        if (s.roof === 'flat' && w * d > 55 && Math.abs(Math.round(b[0] * 5 + b[1] * 3)) % 3 === 0) {   // על הגג: מחצלת ועליה פירות מתייבשים
          const mt = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), M.mat); mt.rotation.x = -Math.PI / 2; mt.position.set(b[0] + w * 0.35, top + 0.27, b[1] + d * 0.4); root.add(mt);
        }
      }
    }
    // דלתות העץ של השערים, פתוחות
    for (const dr of (W.doors || [])) {
      if (!inPer(dr)) continue;
      const me = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.2, 2.0), M.wood);
      me.position.set(dr.x, dr.y + 2.1, dr.z); me.rotation.y = dr.ry; root.add(me);
    }
    const tp = showTemple && W.temple[period];
    if (tp) {                                          // בניין המקדש והמתחם הפנימי, לפי הצעת החופר: שקופים למחצה, כהשערה
      const tb = tp.box, pc = tp.porch;
      addBox(tb, 0.6, tp.h, M.ghost); addBox([tb[0] - 1, tb[1] - 1, tb[2] + 1, tb[3] + 1], 0, 0.6, M.ghost);
      addBox([tb[0] - 0.4, tb[1] - 0.4, tb[2] + 0.4, tb[3] + 0.4], 0.6 + tp.h, 0.5, M.ghost);
      addBox(pc, 0, 0.6, M.ghost);
      const zc = (pc[1] + pc[3]) / 2;
      for (const dz of [-3.2, 3.2]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.44, 8, 14), M.ghost); c.position.set(pc[2] - 1.2, 4.6, zc + dz); root.add(c); }
      addBox([tb[2], pc[1], pc[2], pc[3]], 8.6, 0.8, M.ghost);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2), M.wood); door.position.set(tb[2] + 0.03, 3.2, zc); door.rotation.y = Math.PI / 2; root.add(door);
      for (const ib of innerWalls(tp)) addBox(ib, 0, 3.2, M.ghost);
    }
  }

  /* ---------- דמויות מצוירות ---------- */
  const PAL = {
    wool: ['#e9dfc8', '#d9c9a6', '#c8b48a', '#b89a6c', '#a5835a', '#8a6a46', '#efe7d6'],
    dye: ['#9c3b2e', '#b5533c', '#2f4a6b', '#3f6a5a', '#c9973a', '#6b4a7a', '#7a3040', '#4d6b3a', '#a86a3a'],
    skin: ['#c99872', '#b98561', '#d6a983', '#a8744f', '#c08c66'], hair: ['#2a1d14', '#3a281a', '#1d1510', '#4a3423']
  };
  function drawPerson(c, kind, carry, seed) {
    let s = seed * 9301 + 49297; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; rnd(); rnd();
    const pick = a => a[Math.floor(rnd() * a.length)];
    const g = c.getContext('2d'), Wd = c.width, Hh = c.height, u = Hh / 200, cx = Wd / 2;
    const child = kind === 'child', sc = child ? 0.64 : (kind === 'woman' ? 0.94 : 1);
    g.save(); g.translate(cx, Hh - 4 * u); g.scale(u * sc, u * sc);                     // יחידות: 190 = גובה אדם, הראש למעלה ב-y שלילי
    const skin = pick(PAL.skin), hair = kind === 'elder' ? '#d9d6cf' : pick(PAL.hair);
    let robe, cloak, sash, hem = -14, head = 'bare', beard = false;
    if (kind === 'priest') { robe = '#f6f1e4'; cloak = null; sash = pick(['#2f4a6b', '#6b4a7a', '#9c3b2e']); hem = -6; head = 'turban'; beard = true; }
    else if (kind === 'levite') { robe = '#eee5d0'; cloak = null; sash = '#c9bfa6'; hem = -8; head = 'cap'; beard = rnd() > 0.3; }
    else if (kind === 'woman') { robe = pick(PAL.dye); cloak = pick(PAL.wool); sash = null; hem = -4; head = 'veil'; }
    else if (kind === 'elder') { robe = pick(PAL.wool); cloak = pick(['#8a6a46', '#6f5a45', '#b89a6c']); sash = '#7a6248'; hem = -6; head = rnd() > 0.5 ? 'cloth' : 'bare'; beard = true; }
    else if (kind === 'guard') { robe = pick(['#a5835a', '#9c3b2e', '#c8b48a']); cloak = null; sash = '#4a3423'; hem = -78; head = 'helmet'; beard = rnd() > 0.5; }
    else if (kind === 'merchant') { robe = pick(PAL.wool); cloak = null; sash = pick(PAL.dye); hem = -40; head = 'cloth'; beard = rnd() > 0.4; }
    else if (child) { robe = pick(PAL.wool.concat(PAL.dye)); cloak = null; sash = null; hem = -70; head = 'bare'; }
    else { robe = pick(PAL.wool); cloak = rnd() > 0.35 ? pick(PAL.dye.concat(PAL.wool)) : null; sash = pick(['#6f5a45', '#9c3b2e', '#2f4a6b']); hem = rnd() > 0.5 ? -44 : -10; head = pick(['bare', 'cloth', 'bare', 'band']); beard = rnd() > 0.25; }
    const line = 'rgba(46,30,16,.85)'; g.lineJoin = 'round'; g.lineWidth = 2.2;
    const shape = (pts, fill) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const p = pts[i]; p.length === 4 ? g.quadraticCurveTo(p[0], p[1], p[2], p[3]) : g.lineTo(p[0], p[1]); } g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = line; g.stroke(); };
    // צל על הקרקע
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 1, 30, 6, 0, 0, 6.3); g.fill();
    // רגליים וסנדלים
    if (hem < -20) { shape([[-13, hem], [-5, hem], [-5, -4], [-12, -4]], skin); shape([[5, hem], [13, hem], [12, -4], [5, -4]], skin); }
    shape([[-15, -5], [-3, -5], [-2, 0], [-17, 0]], '#5a4028'); shape([[3, -5], [15, -5], [17, 0], [2, 0]], '#5a4028');
    // הכתונת
    const sh = -150, wst = -100;
    shape([[-20, sh], [20, sh], [22, wst, 21, wst], [26, hem, 24, hem], [-24, hem], [-22, wst, -21, wst]], robe);
    g.strokeStyle = 'rgba(60,40,20,.28)'; g.lineWidth = 1.4; for (const x of [-11, -2, 8]) { g.beginPath(); g.moveTo(x, wst + 6); g.lineTo(x * 1.25, hem - 3); g.stroke(); }
    g.lineWidth = 2.2;
    if (kind === 'priest') { g.fillStyle = sash; g.fillRect(-21, wst - 5, 42, 7); g.fillRect(4, wst, 6, 46); g.fillStyle = 'rgba(201,151,58,.9)'; g.fillRect(-24, hem - 5, 48, 3); }
    else if (sash) { g.fillStyle = sash; g.fillRect(-21, wst - 4, 42, 6); }
    // הזרועות
    const armL = carry === 'spear' || carry === 'staff' ? [[-20, sh + 4], [-30, sh + 12], [-33, -112, -28, -104], [-22, -108]] : [[-20, sh + 4], [-30, sh + 14], [-29, -98, -26, -92], [-19, -100]];
    shape(armL, robe); shape([[20, sh + 4], [30, sh + 14], [29, -98, 26, -92], [19, -100]], robe);
    g.fillStyle = skin; g.strokeStyle = line; g.beginPath(); g.arc(-27, armL === undefined ? -94 : (carry === 'spear' || carry === 'staff' ? -106 : -93), 4.6, 0, 6.3); g.fill(); g.stroke(); g.beginPath(); g.arc(27, -93, 4.6, 0, 6.3); g.fill(); g.stroke();
    // הגלימה, מוטלת על כתף אחת
    if (cloak) shape([[-21, sh - 1], [4, sh - 2], [20, sh + 26, 22, -104], [18, hem + 22, 8, hem + 16], [-25, hem + 12], [-23, wst]], cloak);
    // הצוואר והראש
    shape([[-5, sh - 9], [5, sh - 9], [6, sh + 2], [-6, sh + 2]], skin);
    g.beginPath(); g.ellipse(0, sh - 22, 12, 14.5, 0, 0, 6.3); g.fillStyle = skin; g.fill(); g.strokeStyle = line; g.stroke();
    g.fillStyle = '#2a1d14'; g.beginPath(); g.arc(-4.5, sh - 24, 1.3, 0, 6.3); g.arc(4.5, sh - 24, 1.3, 0, 6.3); g.fill();
    if (beard) shape([[-11, sh - 19], [-9, sh - 6, 0, sh + 1], [9, sh - 6, 11, sh - 19], [5, sh - 14, 0, sh - 13], [-5, sh - 14, -11, sh - 19]], hair);
    if (head === 'bare' || head === 'band') { shape([[-12, sh - 24], [-13, sh - 40, 0, sh - 39], [13, sh - 40, 12, sh - 24], [8, sh - 31, 0, sh - 32], [-8, sh - 31, -12, sh - 24]], hair); if (head === 'band') { g.fillStyle = '#c9bfa6'; g.fillRect(-12, sh - 32, 24, 3.4); } }
    if (head === 'turban') { shape([[-14, sh - 27], [-16, sh - 46, 0, sh - 48], [16, sh - 46, 14, sh - 27], [0, sh - 33, -14, sh - 27]], '#fbf8ef'); g.strokeStyle = 'rgba(120,110,90,.6)'; g.lineWidth = 1.2; for (const k of [-38, -33]) { g.beginPath(); g.moveTo(-13, sh + k + 6); g.quadraticCurveTo(0, sh + k, 13, sh + k + 6); g.stroke(); } g.lineWidth = 2.2; }
    if (head === 'cap') shape([[-12, sh - 28], [-11, sh - 41, 0, sh - 41], [11, sh - 41, 12, sh - 28], [0, sh - 32, -12, sh - 28]], '#e6dcc4');
    if (head === 'cloth') shape([[-13, sh - 27], [-15, sh - 42, 0, sh - 43], [15, sh - 42, 13, sh - 27], [16, sh - 10, 12, sh - 6], [10, sh - 22, 9, sh - 28], [0, sh - 33, -13, sh - 27]], pick(PAL.wool));
    if (head === 'veil') shape([[-13, sh - 24], [-16, sh - 44, 0, sh - 44], [16, sh - 44, 13, sh - 24], [22, sh + 8, 24, sh + 30], [12, sh + 16, 11, sh - 8], [9, sh - 24, 0, sh - 34], [-9, sh - 24, -11, sh - 8], [-12, sh + 16, -24, sh + 30], [-22, sh + 8, -13, sh - 24]], cloak || '#d9c9a6');
    if (head === 'helmet') { shape([[-13, sh - 25], [-14, sh - 44, 0, sh - 47], [14, sh - 44, 13, sh - 25], [0, sh - 30, -13, sh - 25]], '#b08a3e'); shape([[-2, sh - 46], [0, sh - 56], [2, sh - 46]], '#8a3a2e'); }
    // מה שנושאים ביד
    if (carry === 'spear') { g.strokeStyle = '#5a4028'; g.lineWidth = 3; g.beginPath(); g.moveTo(-28, 0); g.lineTo(-28, -196); g.stroke(); g.lineWidth = 2.2; shape([[-31, -196], [-28, -214], [-25, -196]], '#9a9a9a'); shape([[12, -128], [34, -128, 36, -100], [34, -72, 12, -72], [2, -100, 12, -128]], '#8a5a34'); g.fillStyle = '#b08a3e'; g.beginPath(); g.arc(20, -100, 5, 0, 6.3); g.fill(); }
    if (carry === 'staff') { g.strokeStyle = '#5a4028'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(-28, 0); g.lineTo(-27, -168); g.stroke(); g.lineWidth = 2.2; }
    if (carry === 'lamb') { shape([[-4, -118], [14, -128, 34, -118], [38, -104, 30, -96], [10, -92, -2, -100]], '#f1ece0'); g.beginPath(); g.ellipse(36, -122, 7, 6, 0.3, 0, 6.3); g.fillStyle = '#e8e0cf'; g.fill(); g.strokeStyle = line; g.stroke(); g.fillStyle = '#2a1d14'; g.beginPath(); g.arc(38, -123, 1.1, 0, 6.3); g.fill(); }
    if (carry === 'jar') { shape([[18, -150], [34, -150], [40, -168, 38, -186], [30, -196, 26, -196], [14, -186, 12, -168]], '#b5714a'); g.fillStyle = '#8a5234'; g.fillRect(21, -200, 10, 5); }
    if (carry === 'basket') { shape([[14, -98], [40, -98], [37, -80, 34, -76], [20, -76], [17, -80]], '#b89a5c'); g.strokeStyle = 'rgba(70,50,20,.6)'; g.lineWidth = 1.2; for (const y of [-92, -86, -81]) { g.beginPath(); g.moveTo(16, y); g.lineTo(38, y); g.stroke(); } g.lineWidth = 2.2; g.fillStyle = '#7a4d2a'; g.beginPath(); g.arc(22, -100, 4, 0, 6.3); g.arc(30, -101, 4, 0, 6.3); g.fill(); }
    if (carry === 'doves') { shape([[16, -106], [40, -106], [40, -84], [16, -84]], 'rgba(150,120,70,.35)'); g.strokeStyle = '#6b4a2b'; g.lineWidth = 1.2; for (let x = 19; x < 40; x += 4) { g.beginPath(); g.moveTo(x, -106); g.lineTo(x, -84); g.stroke(); } g.lineWidth = 2.2; g.fillStyle = '#f2f2f2'; g.beginPath(); g.ellipse(24, -92, 4.5, 3.4, 0, 0, 6.3); g.ellipse(33, -93, 4.5, 3.4, 0, 0, 6.3); g.fill(); }
    if (carry === 'sack') shape([[-2, -152], [24, -160, 40, -146], [44, -122, 30, -112], [6, -112, -6, -128]], '#c8b48a');
    if (carry === 'bowl') { shape([[14, -100], [38, -100], [34, -90, 26, -88], [18, -90]], '#b08a3e'); }
    if (carry === 'horn') { g.strokeStyle = '#d8c7a0'; g.lineWidth = 5; g.beginPath(); g.moveTo(10, -sh * 0 - 172); g.quadraticCurveTo(34, -176, 40, -196); g.stroke(); g.lineWidth = 2.2; }
    g.restore();
  }
  function drawAnimal(c, kind) {
    const g = c.getContext('2d'), Wd = c.width, Hh = c.height, u = Hh / 100;
    g.save(); g.translate(Wd / 2, Hh - 3 * u); g.scale(u, u); g.lineJoin = 'round'; g.lineWidth = 2; const line = 'rgba(46,30,16,.85)';
    const body = kind === 'sheep' ? '#f0eadc' : kind === 'goat' ? '#5a4a3a' : kind === 'ox' ? '#8a5a3a' : '#9a8f84';
    const big = kind === 'ox' ? 1.5 : kind === 'donkey' ? 1.35 : 1;
    g.scale(big * 0.62, big * 0.62);
    g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(0, 1, 44, 6, 0, 0, 6.3); g.fill();
    g.fillStyle = kind === 'sheep' ? '#3a2e24' : body; g.strokeStyle = line;
    for (const x of [-26, -16, 14, 24]) { g.beginPath(); g.rect(x, -32, 6, 32); g.fill(); g.stroke(); }
    g.beginPath(); g.ellipse(0, -46, 38, kind === 'sheep' ? 22 : 18, 0, 0, 6.3); g.fillStyle = body; g.fill(); g.stroke();
    if (kind === 'sheep') { g.strokeStyle = 'rgba(120,110,90,.5)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-26 + i * 6.5, -50 + (i % 3) * 6, 5, 0, 3.2); g.stroke(); } g.strokeStyle = line; }
    g.beginPath(); g.ellipse(44, -62, 13, 10, -0.3, 0, 6.3); g.fillStyle = kind === 'sheep' ? '#3a2e24' : body; g.fill(); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.arc(48, -64, 1.5, 0, 6.3); g.fill();
    if (kind === 'goat' || kind === 'ox') { g.strokeStyle = '#d8cdb8'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, -70); g.quadraticCurveTo(34, -86, 26, -84); g.stroke(); g.beginPath(); g.moveTo(46, -71); g.quadraticCurveTo(46, -88, 38, -92); g.stroke(); }
    if (kind === 'donkey') { g.fillStyle = body; g.strokeStyle = line; g.lineWidth = 2; g.beginPath(); g.moveTo(40, -70); g.lineTo(38, -90); g.lineTo(46, -72); g.fill(); g.stroke(); g.fillStyle = '#b5714a'; g.beginPath(); g.ellipse(-4, -70, 14, 16, 0, 0, 6.3); g.fill(); g.stroke(); g.fillStyle = '#c8b48a'; g.fillRect(-22, -66, 36, 8); }
    g.restore();
  }
  const spriteCache = {};
  function texture(key, cw, ch, draw) {
    let t = spriteCache[key];
    if (!t) { const c = document.createElement('canvas'); c.width = cw; c.height = ch; draw(c); t = spriteCache[key] = new THREE.CanvasTexture(c); t.anisotropy = 2; }
    return t;
  }
  // נקודה שאפשר לעמוד בה: המפלס הנמוך שבה, ובלבד שאין שם קיר
  function spot(x, z) {
    let yy = null, on = null;
    for (const fl of W.floors) if (!fl.deco && inPer(fl) && inBox(fl.box, x, z)) { const y = floorY(fl, x, z); if (yy == null || y < yy) { yy = y; on = fl; } }
    return on && !blocked(x, z, yy) ? { y: standY(on, x, z), f: on } : null;
  }
  function sprite(key, w, h, cw, ch, draw) {
    const t = texture(key, cw, ch, draw);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.25, fog: true }));
    sp.center.set(0.5, 0); sp.scale.set(w, h, 1); return sp;
  }
  function buildLife(M) {
    if (life) { life.build(root, farRoot, entrySeed, pos, nearBox); if (life.show) life.show(layers.life); }
    for (const p of (life ? [] : W.people)) {
      if (!inPer(p)) continue;
      const f = floorAt(p.x, p.z, null); if (!f) continue;
      const fy = floorAt(p.x, p.z, p.y0 == null ? 0 : p.y0) || f;
      let yy = null, on = null; for (const fl of W.floors) if (!fl.deco && inPer(fl) && inBox(fl.box, p.x, p.z)) { const y = floorY(fl, p.x, p.z); if (yy == null || y < yy) { yy = y; on = fl; } }
      if (blocked(p.x, p.z, yy)) continue;
      yy = standY(on, p.x, p.z);
      const seed = (p.seed || 1) % 16, carry = p.carry || 'none', GP = window.GerizimPeople;
      // אדם בגובה 1.72 מ' בקירוב. הציור המפורט בא מ-walk_people.js; בהיעדרו נשאר הציור הפשוט
      const sp = GP ? sprite(p.kind + carry + seed, 1.07, 2.14, 160, 320, c => GP.drawPerson(c, p.kind, carry, seed + 3))
                    : sprite(p.kind + carry + seed, 1.38, 1.82, 152, 200, c => drawPerson(c, p.kind, carry, seed + 3));
      sp.position.set(p.x, yy, p.z); root.add(sp);
    }
    for (const a of (life ? [] : W.animals)) {
      if (!inPer(a)) continue;
      const f = floorAt(a.x, a.z, null); if (!f) continue;
      const GA = window.GerizimPeople;
      const sp = GA ? sprite('an' + a.kind, 2.18, 1.87, 192, 165, c => GA.drawAnimal(c, a.kind)) : sprite('an' + a.kind, 1.7, 1.33, 128, 100, c => drawAnimal(c, a.kind));
      sp.position.set(a.x, standY(f.f, a.x, a.z), a.z); root.add(sp);
    }
    const jar = (x, y, z, s) => { const pts = [[0, 0], [0.16, 0.02], [0.3, 0.3], [0.33, 0.55], [0.22, 0.82], [0.12, 0.9], [0.15, 1.0]].map(p => new THREE.Vector2(p[0] * s, p[1] * s)); const me = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), M.clay); me.position.set(x, y, z); root.add(me); };
    for (const p of W.props) {
      if (!inPer(p)) continue;
      if (p.x1 && quality && quality.lite && (Math.abs(Math.round(p.x * 7 + p.z * 3)) % 5) < 2 && !(p.kind === 'tub' || p.kind === 'quern' || p.kind === 'altartools')) continue;
      const f = floorAt(p.x, p.z, null); if (!f) continue; const y = standY(f.f, p.x, p.z), x = p.x, z = p.z;
      if (p.kind === 'jars') for (let i = 0; i < 5; i++) jar(x + (i % 3) * 0.62 - 0.6, y, z + Math.floor(i / 3) * 0.6, 0.85 + (i % 2) * 0.25);
      if (p.kind === 'ash') { const k = p.small ? 0.45 : 1, me = new THREE.Mesh(new THREE.ConeGeometry(3.2 * k, 1.5 * k, 14), M.ash); me.position.set(x, y + 0.75 * k, z); root.add(me); }
      if (p.kind === 'column') { const me = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 3.4, 16), M.plaster); me.position.set(x, y + 1.7, z); root.add(me); const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), M.plaster); cap.position.set(x, y + 3.5, z); root.add(cap); }
      if (p.kind === 'rock') { const me = new THREE.Mesh(new THREE.SphereGeometry(2.4, 9, 6, 0, 6.3, 0, 1.5), M.rock); me.scale.set(1.6, 0.42, 1.2); me.position.set(x, y, z); root.add(me); }
      if (p.kind === 'post') { const me = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 8), M.wood); me.position.set(x, y + 0.55, z); root.add(me); }
      if (p.kind === 'basin') { const me = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 0.9, 16), M.plaster); me.position.set(x, y + 0.45, z); root.add(me); const w = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), M.water); w.rotation.x = -Math.PI / 2; w.position.set(x, y + 0.86, z); root.add(w); }
      if (p.kind === 'cistern') { const me = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 16, 1, true), M.field); me.position.set(x, y + 0.35, z); root.add(me); const w = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), M.dark); w.rotation.x = -Math.PI / 2; w.position.set(x, y + 0.2, z); root.add(w); jar(x + 1.3, y, z + 0.3, 0.8); }
      if (p.kind === 'stall') { for (const [dx, dz] of [[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]]) { const me = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), M.wood); me.position.set(x + dx, y + 1.15, z + dz); root.add(me); } const top = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), M.cloth([0xb5533c, 0xd8c7a0, 0x6d7f8f, 0xc9a24a][Math.floor(Math.abs(x)) % 4])); top.rotation.x = -Math.PI / 2 + 0.16; top.position.set(x, y + 2.3, z); root.add(top); addBox([x - 1.4, z - 0.5, x + 1.4, z + 0.5], y, 0.8, M.wood); for (let i = 0; i < 4; i++) jar(x - 1 + i * 0.66, y + 0.8, z, 0.45); }
      if (p.kind === 'cage') addBox([x - 0.5, z - 0.35, x + 0.5, z + 0.35], y, 0.6, new THREE.MeshLambertMaterial({ color: 0x9a7b4a, wireframe: true }));
      if (p.kind === 'basket') { const me = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.4, 10), new THREE.MeshLambertMaterial({ color: 0xb89a5c })); me.position.set(x, y + 0.2, z); root.add(me); }
      if (p.kind === 'fire') { for (let i = 0; i < 3; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), M.dark); lg.rotation.z = Math.PI / 2; lg.rotation.y = i * 1.05; lg.position.set(x, y + 0.08, z); root.add(lg); } const pot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), M.dark); pot.position.set(x, y + 0.45, z); root.add(pot); addSmoke(x, y + 0.7, z, 0.5, 0xdedbd2); }
      if (p.kind === 'oven') { const me = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8, 0, 6.3, 0, 1.6), M.clay); me.position.set(x, y, z); root.add(me); addSmoke(x, y + 0.9, z, 0.4, 0xdedbd2); }
      if (p.kind === 'loom') { addBox([x - 0.9, z - 0.05, x + 0.9, z + 0.05], y + 1.7, 0.1, M.wood); addBox([x - 0.9, z - 0.05, x - 0.8, z + 0.05], y, 1.7, M.wood); addBox([x + 0.8, z - 0.05, x + 0.9, z + 0.05], y, 1.7, M.wood); const cl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), M.cloth(0xd9c9a6)); cl.position.set(x, y + 1.05, z); root.add(cl); }
      // ---- חפצי יומיום: מה שמבקר רואה מקרוב ברחוב, בחצר ובחדר ----
      const cyl = (rt, rb, hgt, mat, cx, cy, cz, seg) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hgt, seg || 12), mat); me.position.set(cx, cy, cz); me.castShadow = shadows; root.add(me); return me; };
      const lathe = (pts, mat, cx, cy, cz, k) => { const me = new THREE.Mesh(new THREE.LatheGeometry(pts.map(q => new THREE.Vector2(q[0] * k, q[1] * k)), 12), mat); me.position.set(cx, cy, cz); me.castShadow = shadows; root.add(me); return me; };
      const AMPH = [[0, 0], [0.05, 0.03], [0.15, 0.3], [0.17, 0.52], [0.13, 0.72], [0.06, 0.82], [0.055, 0.95], [0.085, 1]];
      const PITH = [[0, 0], [0.2, 0.02], [0.4, 0.3], [0.46, 0.62], [0.4, 0.92], [0.27, 1.06], [0.3, 1.14]];
      const along = p.along === 'n', bxy = (l, w2) => along ? [x - w2, z - l, x + w2, z + l] : [x - l, z - w2, x + l, z + w2];
      if (p.kind === 'amphorae') { addBox(bxy(0.5, 0.17), y, 0.3, M.wood); for (let i = 0; i < 3; i++) lathe(AMPH, M.clay, x + (along ? 0 : (i - 1) * 0.34), y + 0.16, z + (along ? (i - 1) * 0.34 : 0), 0.95 + (i % 2) * 0.12); }
      if (p.kind === 'pithos') lathe(PITH, M.pale, x, y, z, 1 + (Math.abs(Math.round(x * 3)) % 3) * 0.08);
      if (p.kind === 'quern') {                         // אבן רחיים: שכב ורכב, וערמת גרעינים
        const lo = addBox([x - 0.36, z - 0.21, x + 0.36, z + 0.21], y, 0.2, M.field); lo.rotation.z = 0.08;
        const up = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), M.field); up.scale.set(1, 0.5, 0.75); up.position.set(x - 0.08, y + 0.29, z); root.add(up);
        const gr = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0xd6b25a })); gr.position.set(x + 0.62, y + 0.07, z + 0.1); root.add(gr);
      }
      if (p.kind === 'trough') { addBox(bxy(0.8, 0.3), y, 0.45, M.field); const wt = new THREE.Mesh(new THREE.PlaneGeometry(along ? 0.42 : 1.42, along ? 1.42 : 0.42), M.water); wt.rotation.x = -Math.PI / 2; wt.position.set(x, y + 0.4, z); root.add(wt); }
      if (p.kind === 'bench') addBox(bxy(0.9, 0.22), y, 0.42, M.ashlar);
      if (p.kind === 'woodpile') { for (let i = 0; i < 9; i++) { const row = i < 4 ? 0 : i < 7 ? 1 : 2, k = i < 4 ? i - 1.5 : i < 7 ? i - 5 : i - 7.5, lg = cyl(0.09, 0.1, 1.1, M.wood, x + (along ? k * 0.2 : 0), y + 0.1 + row * 0.17, z + (along ? 0 : k * 0.2), 7); lg.rotation.x = along ? Math.PI / 2 : 0; lg.rotation.z = along ? 0 : Math.PI / 2; } }
      if (p.kind === 'sacks') { for (let i = 0; i < 3; i++) { const sk = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.pale); sk.scale.set(1, 0.72, 0.8); sk.position.set(x + (i - 1) * 0.42, y + 0.2 + (i === 1 ? 0.3 : 0), z + (i === 1 ? 0.05 : 0)); sk.castShadow = shadows; root.add(sk); } }
      if (p.kind === 'produce') {                       // סל ובו פרי: תאנים, זיתים, רימונים, תמרים או תבואה
        const col = { figs: 0x5b3a5e, olives: 0x4f5a2a, grain: 0xd6b25a, pomegranate: 0xa83a2e, dates: 0x8a5a2a }[p.c] || 0x8a5a2a;
        cyl(0.42, 0.32, 0.36, new THREE.MeshLambertMaterial({ color: 0xb89a5c }), x, y + 0.18, z, 12);
        const top2 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 6, 0, 6.3, 0, 1.2), new THREE.MeshLambertMaterial({ color: col })); top2.scale.y = 0.45; top2.position.set(x, y + 0.3, z); root.add(top2);
      }
      if (p.kind === 'pots') { const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), M.mat); pm.rotation.x = -Math.PI / 2; pm.position.set(x, y + 0.04, z); root.add(pm); for (let i = 0; i < 6; i++) jar(x - 0.5 + (i % 3) * 0.5, y + 0.04, z - 0.25 + Math.floor(i / 3) * 0.5, 0.42 + (i % 2) * 0.18); }
      if (p.kind === 'cloth') { [0x8f3a2c, 0x2d4766, 0xc9a24a, 0xe9e1cc].forEach((c2, i) => { const bl = cyl(0.11, 0.11, 0.9, M.cloth(c2), x, y + 0.12 + Math.floor(i / 2) * 0.2, z - 0.14 + (i % 2) * 0.28, 10); bl.rotation.z = Math.PI / 2; }); }
      if (p.kind === 'tub') {                           // אמבט ישיבה מטויח
        addBox([x - 0.75, z - 0.36, x + 0.75, z + 0.36], y, 0.52, M.plaster); const wt = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.5), M.water); wt.rotation.x = -Math.PI / 2; wt.position.set(x, y + 0.47, z); root.add(wt);
        addBox([x + 0.95, z - 0.2, x + 1.3, z + 0.2], y, 0.32, M.wood);
      }
      if (p.kind === 'lamp') { cyl(0.025, 0.09, 1.15, M.bronze, x, y + 0.575, z, 8); cyl(0.11, 0.05, 0.05, M.clay, x, y + 1.17, z, 10); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.flame); fl.scale.y = 1.7; fl.position.set(x + 0.09, y + 1.25, z); root.add(fl); }
      if (p.kind === 'rack') {                          // כן לרמחים ומגן
        cyl(0.04, 0.04, 1.5, M.wood, x - 0.6, y + 0.75, z, 6); cyl(0.04, 0.04, 1.5, M.wood, x + 0.6, y + 0.75, z, 6); const br = cyl(0.03, 0.03, 1.3, M.wood, x, y + 1.35, z, 6); br.rotation.z = Math.PI / 2;
        for (let i = 0; i < 3; i++) { const sp2 = cyl(0.018, 0.018, 2.2, M.wood, x - 0.35 + i * 0.35, y + 1.05, z + 0.14, 5); sp2.rotation.x = 0.16; }
        const shd = cyl(0.36, 0.36, 0.05, M.bronze, x + 0.2, y + 0.4, z + 0.2, 16); shd.rotation.x = Math.PI / 2 - 0.25;
      }
      if (p.kind === 'vine') {                          // גפן מודלית על ארבעה עמודי עץ
        for (const [dx2, dz2] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) cyl(0.05, 0.06, 2.2, M.wood, x + dx2, y + 1.1, z + dz2, 6);
        const lf = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.4), M.leaf); lf.rotation.x = -Math.PI / 2; lf.position.set(x, y + 2.22, z); lf.castShadow = shadows; root.add(lf);
        for (let i = 0; i < 4; i++) { const gp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshLambertMaterial({ color: 0x4a2a55 })); gp.scale.y = 1.5; gp.position.set(x - 0.9 + i * 0.6, y + 2.02, z - 0.5 + (i % 2)); root.add(gp); }
        const tr = cyl(0.05, 0.08, 2.2, M.wood, x - 1.2, y + 1.1, z + 0.6, 6); tr.rotation.z = 0.08;
      }
      if (p.kind === 'altartools') {                    // כלי המזבח: אגן נחושת על חצובה, יעה ומזלג
        cyl(0.34, 0.2, 0.2, M.bronze, x, y + 0.72, z, 16); for (let i = 0; i < 3; i++) { const lg2 = cyl(0.02, 0.02, 0.7, M.bronze, x + Math.cos(i * 2.1) * 0.2, y + 0.33, z + Math.sin(i * 2.1) * 0.2, 5); lg2.rotation.z = Math.cos(i * 2.1) * 0.25; lg2.rotation.x = -Math.sin(i * 2.1) * 0.25; }
        const sv = cyl(0.016, 0.016, 1.5, M.bronze, x + 0.75, y + 0.72, z, 5); sv.rotation.z = 0.2; const fk = cyl(0.016, 0.016, 1.5, M.bronze, x + 0.95, y + 0.72, z + 0.1, 5); fk.rotation.z = 0.24;
      }
      if (p.kind === 'pen') { addBox([x - 1.6, z - 1.6, x + 1.6, z - 1.52], y, 0.9, M.wood); addBox([x - 1.6, z - 1.6, x - 1.52, z + 1.6], y, 0.9, M.wood); addBox([x + 1.52, z - 1.6, x + 1.6, z + 1.6], y, 0.9, M.wood); addBox([x - 1.6, z + 1.52, x + 0.4, z + 1.6], y, 0.9, M.wood); }
      if (p.kind === 'couch') {                         // ספסל הסבה: מסגרת עץ, מזרן וכר
        const a = p.along === 'n', bx = (l, w2) => a ? [x - w2, z - l, x + w2, z + l] : [x - l, z - w2, x + l, z + w2];
        addBox(bx(0.95, 0.38), y, 0.4, M.wood); addBox(bx(0.9, 0.33), y + 0.4, 0.11, M.cloth([0x8f3a2c, 0x2d4766, 0xc9a24a, 0x62466f][Math.floor(Math.abs(x * 3 + z)) % 4]));
        addBox(a ? [x - 0.3, z - 0.92, x + 0.3, z - 0.6] : [x - 0.92, z - 0.3, x - 0.6, z + 0.3], y + 0.51, 0.13, M.cloth(0xd8c7a0));
      }
      if (p.kind === 'table') { const top = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 20), M.wood); top.position.set(x, y + 0.44, z); root.add(top); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.42, 10), M.wood); leg.position.set(x, y + 0.21, z); root.add(leg); jar(x + 0.12, y + 0.47, z - 0.08, 0.28); const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.07, 14), M.clay); bowl.position.set(x - 0.16, y + 0.5, z + 0.1); root.add(bowl); }
      if (p.kind === 'chest') { addBox([x - 0.5, z - 0.28, x + 0.5, z + 0.28], y, 0.52, M.wood); addBox([x - 0.53, z - 0.31, x + 0.53, z + 0.31], y + 0.52, 0.07, M.dark); }
      if (p.kind === 'rug') { const rg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), M.cloth(0x8f3a2c)); rg.rotation.x = -Math.PI / 2; rg.position.set(x, y + 0.045, z); root.add(rg); const inn = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.35), M.cloth(0xc9a24a)); inn.rotation.x = -Math.PI / 2; inn.position.set(x, y + 0.05, z); root.add(inn); }
      if (p.kind === 'press') {                         // בית הבד: אגן ריסוק, אבן מתגלגלת, קורה ומשקולות
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.1, 0.55, 20), M.field); basin.position.set(x, y + 0.28, z); root.add(basin);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 16), M.field); wheel.rotation.z = Math.PI / 2; wheel.position.set(x + 0.5, y + 0.9, z); root.add(wheel);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 0.3), M.wood); beam.position.set(x - 6, y + 1.5, z + 3); beam.rotation.z = -0.07; root.add(beam);
        for (let i = 0; i < 3; i++) { const wt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), M.field); wt.position.set(x - 8.4 + i * 0.1, y + 0.35 + i * 0.01, z + 2.2 + i * 0.8); root.add(wt); }
        const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.4, 16), M.field); bed.position.set(x - 4.2, y + 0.2, z + 3); root.add(bed);
        for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0x8f7a45 })); b.position.set(x - 4.2, y + 0.46 + i * 0.11, z + 3); root.add(b); }
      }
    }
    // הכתובות: לוח אבן הקבוע בקיר הקרוב למקום שבו נמצאה כל אחת, והנוסח באותיות המקור
    insStones = []; taps = [];
    if (period === 'h') for (const ins of (opts.inscr || [])) {
      const hang = INFO.hang || {};
      let at = ins.walk, approx = false;
      if (!at) { at = hang[ins.no] || (ins.script === 'greek' && ins.place === 'precinct' ? hang.sundial : null); approx = !!at; }
      if (!at || !ins.text) continue;
      const x = at[1], z = -at[0], f = canStandAny(x, z) || floorAt(x, z, pos.y); if (!f) continue;
      const w = wallFor(x, z, f.y), tx = insTexture(ins), side = M.ashlar, face = new THREE.MeshLambertMaterial({ map: tx.tex, color: 0xcfc8b8, emissive: 0x3a352b });
      let sx = x, sz = z, me;
      if (w) {
        me = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.74, 0.12), [side, side, side, side, face, side]);
        me.position.set(w.px + w.nx * 0.05, f.y + 1.72, w.pz + w.nz * 0.05); me.rotation.y = Math.atan2(w.nx, w.nz);
        sx = w.px + w.nx * 1.3; sz = w.pz + w.nz * 1.3;
      } else {                                         // אין קיר קרוב: האבן מונחת על כן
        me = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.34), [side, side, side, side, face, face]);
        me.position.set(x, f.y + 0.75, z); me.rotation.y = ((ins.no || 3) * 1.7) % 6.28; me.rotation.x = -0.12;
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.5), M.field); base.position.set(x, f.y + 0.22, z); base.rotation.y = me.rotation.y; root.add(base);
      }
      me.visible = layers.inscr; root.add(me); taps.push({ obj: me, ins });
      insStones.push({ ins, x: sx, z: sz, approx, shown: tx.shown, at: w ? { x: w.px + w.nx * 0.07, y: f.y + 1.72, z: w.pz + w.nz * 0.07, ry: Math.atan2(w.nx, w.nz) } : { x, y: f.y + 1.75, z, ry: null } });
    }
    buildSigns();
    // אש ועשן מעל המזבח
    for (const s of W.solids) {
      if (s.id !== 'altar' || !inPer(s)) continue;
      const ax = (s.box[0] + s.box[2]) / 2, az = (s.box[1] + s.box[3]) / 2, top = s.y0 + s.h;
      addSmoke(ax, top + 0.2, az, 1.6, 0xcfcac0); addSmoke(ax + 1, top + 0.2, az - 1, 1.3, 0xbdb8ae);
      // אש המזבח: לשונות להבה מרצדות מעל ערמת העצים
      const ft = texture('flame', 64, 96, c => { const g = c.getContext('2d'), gr = g.createRadialGradient(32, 70, 2, 32, 62, 34); gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.35, 'rgba(255,190,70,.95)'); gr.addColorStop(0.7, 'rgba(240,110,30,.6)'); gr.addColorStop(1, 'rgba(200,60,20,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(62, 52, 46, 84); g.quadraticCurveTo(32, 96, 18, 84); g.quadraticCurveTo(2, 52, 32, 2); g.fill(); });
      for (let i = 0; i < 6; i++) { const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, transparent: true, depthWrite: false, fog: false })); fl.center.set(0.5, 0.1); fl.userData = { x: ax + Math.cos(i * 1.05) * 0.75 * (i ? 1 : 0), y: top + 0.05, z: az + Math.sin(i * 1.05) * 0.75 * (i ? 1 : 0), s: i ? 0.9 : 1.5, ph: i * 1.7 }; root.add(fl); flames.push(fl); }
      for (let i = 0; i < 5; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.5, 6), M.dark); lg.rotation.z = Math.PI / 2; lg.rotation.y = i * 0.63; lg.position.set(ax, top + 0.1, az); root.add(lg); }
    }
  }
  let smokeTex = null;
  function addSmoke(x, y, z, size, col) {
    if (!smokeTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); smokeTex = new THREE.CanvasTexture(c); }
    for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: col, transparent: true, depthWrite: false, opacity: 0.5 })); sp.userData = { x, y, z, size, t: i / 7 }; root.add(sp); smoke.push(sp); }
  }

  /* ---------- בניית הזירה ---------- */
  function build() {
    if (root) { scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    if (farRoot) { scene.remove(farRoot); farRoot.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    root = new THREE.Group(); scene.add(root); farRoot = new THREE.Group(); scene.add(farRoot); smoke = []; flames = []; clickables = [];
    const M = build.M || (build.M = makeMaterials());
    buildTerrain(M); buildFloors(M); buildSolids(M); buildLife(M);
    marker = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2; marker.visible = false; root.add(marker);
  }
  function setup(cv) {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    const lite = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 820 || (window.matchMedia && matchMedia('(hover:none)').matches);
    quality = { lite, pr: Math.min(lite ? 1.25 : 1.5, window.devicePixelRatio || 1), fps: 0, cull: 0 };
    renderer.setPixelRatio(quality.pr);
    scene = new THREE.Scene();
    const sky = skyCv = document.createElement('canvas'); sky.width = 4; sky.height = 256;
    const g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5f9bd0'); gr.addColorStop(0.5, '#a9cbe2'); gr.addColorStop(0.62, '#dfe3d6'); gr.addColorStop(1, '#d9d2bd');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(sky);
    const wide = !!(window.GerizimLife && window.GERIZIM_FAR);               // יש נוף רחוק: רואים עד ההרים, באובך קל
    scene.fog = wide ? new THREE.Fog(0xdcd8c6, 240, 9000) : new THREE.Fog(0xdcd8c6, 160, 760);
    const hemi = new THREE.HemisphereLight(0xfff6e4, 0xb9aa8c, 0.72); scene.add(hemi);
    const sun = sunRef = new THREE.DirectionalLight(0xfff1d6, 0.46); sun.position.set(-120, 220, 90); scene.add(sun);
    // צללים של ממש, במחשב בלבד: מפת הצל נעה עם ההולך ומכסה כמאה מטר סביבו
    shadows = !quality.lite;
    if (shadows) {
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -100; sc.right = 100; sc.top = 100; sc.bottom = -100; sc.near = 120; sc.far = 480;
      sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.05; scene.add(sun.target);
    }
    camera = new THREE.PerspectiveCamera(68, 1, wide ? 0.3 : 0.2, wide ? 60000 : 6000); camera.rotation.order = 'YXZ';
    if (window.GerizimLife) life = window.GerizimLife({ THREE, W, scene, hemi, sun, sky: skyCv, inPer, inBox, canStand, spot, sprite, texture, hasTexture: k => !!spriteCache[k], terrainY: groundY, shadows, lite: quality.lite, standY });
    clock = new THREE.Clock();
    buildAvatar();
  }

  /* ---------- דמות ההולך: רואים אותה מאחור, מן הראש ועד מעט מתחת לכתפיים ----------
     היא מצוירת בשכבה משלה מעל הנוף, תמיד בתחתית המסך. כשהמבט פונה — הראש פונה תחילה, והגוף מתיישר אחריו. */
  let life = null, skyCv = null, entrySeed = 1, farRoot = null;
  let hud = null, hudCam = null, av = null, bodyYaw = null, showAvatar = true, avLift = 0, avFit = 1, avTick = 0;
  function clothTex(a, b) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = a; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 9; i++) { const x = 6 + i * 14 + (i % 3) * 3, gr = g.createLinearGradient(x - 6, 0, x + 6, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, b); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.26; g.fillStyle = gr; g.fillRect(x - 6, 0, 12, 128); }
    g.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function buildAvatar() {
    hud = new THREE.Scene();
    hud.add(new THREE.HemisphereLight(0xfff6e4, 0x8d7f66, 0.86));
    const sun = new THREE.DirectionalLight(0xfff1d6, 0.5); sun.position.set(-1.4, 2.4, 1.8); hud.add(sun);
    hudCam = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    const lam = col => new THREE.MeshLambertMaterial({ color: col });
    const skin = lam(0xb98a62), hair = lam(0x2b211a), band = lam(0xd8ceb4);
    const tunic = new THREE.MeshLambertMaterial({ map: clothTex('#e9e1cd', '#c6ba9c') }), mantle = new THREE.MeshLambertMaterial({ map: clothTex('#6b3c53', '#4c2a3c') });
    const mesh = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); return m; };
    av = new THREE.Group();
    const body = new THREE.Group(); av.add(body); av.body = body;
    body.add(mesh(new THREE.SphereGeometry(1, 30, 18), tunic, 0, 0, 0, 0.265, 0.112, 0.135));                 // הכתפיים
    body.add(mesh(new THREE.CylinderGeometry(0.205, 0.25, 2.4, 26), tunic, 0, -1.21, 0, 1, 1, 0.6));        // הגב העליון
    body.add(mesh(new THREE.SphereGeometry(1, 22, 14), mantle, -0.112, 0.003, 0.002, 0.158, 0.116, 0.14));  // הגלימה שעל הכתף השמאלית
    const drape = mesh(new THREE.BoxGeometry(0.17, 1.1, 0.03), mantle, 0.04, -0.46, 0.128, 1, 1, 1); drape.rotation.z = 0.46; body.add(drape);
    body.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.11, 16), skin, 0, 0.135, 0.004));                  // הצוואר
    const head = new THREE.Group(); head.position.set(0, 0.17, 0.004); head.rotation.order = 'YXZ'; av.add(head); av.head = head;
    head.add(mesh(new THREE.SphereGeometry(0.1, 28, 20), skin, 0, 0.1, 0, 0.95, 1.12, 1.05));                 // הראש; הפנים פונות מן הצופה והלאה
    head.add(mesh(new THREE.SphereGeometry(0.106, 28, 20), hair, 0, 0.118, 0.03, 0.97, 1.08, 1.02));          // השיער: מכסה את העורף ואת הקודקוד
    head.add(mesh(new THREE.SphereGeometry(0.021, 10, 8), skin, 0.096, 0.092, -0.012, 0.6, 1.2, 1));           // האוזניים
    head.add(mesh(new THREE.SphereGeometry(0.021, 10, 8), skin, -0.096, 0.092, -0.012, 0.6, 1.2, 1));
    const nose = mesh(new THREE.ConeGeometry(0.016, 0.042, 8), skin, 0, 0.088, -0.112); nose.rotation.x = -Math.PI / 2; head.add(nose);
    head.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), hair, 0, 0.028, -0.07, 0.95, 0.85, 0.72));           // הזקן
    const tie = mesh(new THREE.TorusGeometry(0.1035, 0.012, 8, 36), band, 0, 0.15, 0.03, 0.99, 1.045, 1); tie.rotation.x = Math.PI / 2; head.add(tie);   // סרט בד סביב הראש
    hud.add(av);
  }
  function avatarStep(dt, moving) {
    if (!av) return;
    if (bodyYaw == null) bodyYaw = look.yaw;
    let d = look.yaw - bodyYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    d -= d * Math.min(1, dt * (Math.abs(d) > 0.9 ? 7 : 2.3));              // הגוף מתיישר אחרי המבט; עד אז הראש הוא שפונה
    d = Math.max(-1.15, Math.min(1.15, d)); bodyYaw = look.yaw - d;
    av.head.rotation.y = -d * 0.72;                                        // מבט ימינה — הראש פונה ימינה
    av.head.rotation.x = look.pitch * 0.85;                                // מבט למעלה — הראש נוטה לאחור; למטה — מרכין
    av.body.rotation.y = d * 0.16;
    // גודל ומקום: בתחתית המסך, במרכז; במסך צר הדמות קטנה יותר, ומעל הלוחות שמכסים את מרכז התחתית
    const D = 2.4, half = D * Math.tan(19 * Math.PI / 180), k = Math.max(0.5, Math.min(1, hudCam.aspect / 1.3)) * avFit;
    if ((avTick++ % 30) === 0) {
      const el = $('walk'), W0 = el.clientWidth, H0 = el.clientHeight; let up = 0;
      for (const id of ['walkInfo', 'walkPad']) { const n = $(id); if (!n || !n.offsetParent) continue; const r = n.getBoundingClientRect(), o = el.getBoundingClientRect(); if (r.left - o.left < W0 / 2 && r.right - o.left > W0 / 2 && r.top - o.top > H0 * 0.45) up = Math.max(up, H0 - (r.top - o.top)); }
      const u = Math.min(0.5, up / Math.max(1, H0));
      avLift = u * 2 * half; avFit = Math.min(1, 0.42 * (1 - u) / 0.36);         // במסך נמוך הדמות קטנה, כדי שלא תסתיר את הדרך
    }
    const sway = moving ? Math.sin(stride * 4.3) : 0;
    av.scale.setScalar(k);
    av.position.set(moving ? Math.sin(stride * 2.15) * 0.012 * k : 0, -half + avLift + 0.2 * k + sway * 0.012 * k, -D);
    av.rotation.z = moving ? Math.sin(stride * 2.15) * 0.018 : 0;
  }
  function resize() {
    const el = $('walk'), w = el.clientWidth, h = el.clientHeight;
    if (!renderer || !w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 78 : 66; camera.updateProjectionMatrix();
    if (hudCam) { hudCam.aspect = w / h; hudCam.updateProjectionMatrix(); avTick = 0; }
    if ($('walkTop').firstChild) { texts(); const tb = $('walkTop').getBoundingClientRect(), o = el.getBoundingClientRect(); $('walkSide').style.top = Math.round(tb.bottom - o.top + 8) + 'px'; }
    drawMini(true);
  }

  /* ---------- תנועה ---------- */
  function tryMove(dx, dz) {
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
      if (!mx && !mz) continue;
      const f = canStand(pos.x + mx, pos.z + mz, pos.y, pos.x, pos.z);
      if (f) { pos.x += mx; pos.z += mz; pos.y = f.y; return true; }
    }
    return false;
  }
  function step(dt) {
    if (paused) { keys = {}; hold = {}; target = null; }
    const turn = ((keys.ArrowLeft || hold.left) ? -1 : 0) + ((keys.ArrowRight || hold.right) ? 1 : 0);
    if (turn) look.yaw += turn * 1.7 * dt;
    let fwd = ((keys.ArrowUp || keys.KeyW || hold.fwd) ? 1 : 0) - ((keys.ArrowDown || keys.KeyS || hold.back) ? 1 : 0);
    const side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const sp = SPEED * (keys.ShiftLeft || keys.ShiftRight ? 2 : 1) * dt;
    if (fwd || side) {
      target = null;
      const s = Math.sin(look.yaw), c = Math.cos(look.yaw);
      tryMove((s * fwd + c * side) * sp, (-c * fwd + s * side) * sp);
    } else if (target) {
      const dx = target.x - pos.x, dz = target.z - pos.z, d = Math.hypot(dx, dz);
      if (d < 0.25) target = null;
      else {
        const k = Math.min(1, sp * 1.25 / d);
        if (!tryMove(dx * k, dz * k)) target = null;
        // מפנים את המבט בהדרגה אל כיוון ההליכה
        let want = Math.atan2(dx, -dz), df = want - look.yaw; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
        if (!dragging) look.yaw += df * Math.min(1, dt * 2.2);
      }
      marker.visible = !!target;
    }
    const moved = Math.hypot(pos.x - lastX, pos.z - lastZ); lastX = pos.x; lastZ = pos.z;
    if (moved > 0.001) stride += moved; else stride = 0;
    const bob = moved > 0.001 ? Math.sin(stride * 4.3) * 0.045 : 0;                // צעד בכל מטר וחצי בערך
    camera.position.set(pos.x, camera.position.y + (pos.y + EYE + bob - camera.position.y) * Math.min(1, dt * 9), pos.z);
    camera.rotation.y = -look.yaw; camera.rotation.x = look.pitch;
    avatarStep(dt, moved > 0.001);
  }
  // שלוש שכבות: הנוף הרחוק, ומעליו הזירה (שתמיד קרובה ממנו), ומעליה דמות ההולך
  function sunAt(x, y, z) {                                 // השמש "הולכת" עם מי שמביט, כדי שהצללים יהיו חדים סביבו
    if (!shadows) return;
    const d = sunRef.userData.dir || [-120, 220, 90], k = 300 / Math.hypot(d[0], d[1], d[2]);
    sunRef.position.set(x + d[0] * k, y + d[1] * k, z + d[2] * k); sunRef.target.position.set(x, y, z); sunRef.target.updateMatrixWorld();
  }
  function passes(cam, withWalker) {
    const bg = scene.background;
    if (farRoot && farRoot.children.length) {
      root.visible = false; farRoot.visible = true; renderer.autoClear = true; renderer.render(scene, cam);
      renderer.autoClear = false; renderer.clearDepth(); scene.background = null; farRoot.visible = false; root.visible = true; if (shadows) renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); scene.background = bg;
    } else { if (shadows) renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); }
    if (withWalker && hud) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(hud, hudCam); }
    renderer.autoClear = true;
  }
  // לבדיקות: צילום הזירה מנקודה נתונה אל תמונה, בלי לגעת במבט של מי שמסייר
  function shot(x, z, y, yaw, pitch, w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h), cam = camera.clone();
    cam.aspect = w / h; cam.updateProjectionMatrix(); cam.position.set(x, y + EYE, z); cam.rotation.order = 'YXZ'; cam.rotation.y = -yaw; cam.rotation.x = pitch || 0;
    sunAt(x, y, z); renderer.setRenderTarget(rt); passes(cam, false); sunAt(pos.x, pos.y, pos.z);
    const buf = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf); renderer.setRenderTarget(null); rt.dispose();
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let r = 0; r < h; r++) im.data.set(buf.subarray((h - 1 - r) * w * 4, (h - r) * w * 4), r * w * 4);
    g.putImageData(im, 0, 0); return c.toDataURL('image/jpeg', 0.86);
  }
  // קצב התמונות נמדד כל כמה שניות; כשהוא נמוך — מורידים תחילה את חדות התמונה, ואחר כך מדללים דמויות רחוקות
  let fAcc = 0, fN = 0;
  function adapt(raw) {
    if (raw > 0.5 || document.visibilityState !== 'visible') { fAcc = 0; fN = 0; return; }      // לשונית שהייתה מוסתרת אינה מדידה
    fAcc += raw; fN++;
    if (fN < 90) return;
    const avg = fAcc / fN; fAcc = 0; fN = 0; quality.fps = Math.round(1 / avg);
    if (avg > 1 / 24 && quality.pr > 0.8) { quality.pr = Math.max(0.75, quality.pr - 0.25); renderer.setPixelRatio(quality.pr); resize(); }
    else if (avg > 1 / 20 && quality.cull !== 45) { quality.cull = quality.cull ? 45 : 80; if (life && life.cull) life.cull(quality.cull); }
  }
  function tick() {
    if (!active) return;
    raf = requestAnimationFrame(tick);
    frame(clock.getDelta(), true);
  }
  // תמונה אחת של הסיור: תנועה, חיים, ציור, ועדכון הכרטיס והמפה. (בבדיקות היא מורצת גם ביד, בלי לחכות לדפדפן)
  let flameT = 0;
  function frame(raw, measured) {
    const dt = Math.min(0.06, raw);
    if (measured) adapt(raw);
    step(dt);
    if (life) life.step(dt, camera.position, pos, look.yaw);
    sunAt(pos.x, pos.y, pos.z); stepSigns();
    flameT += dt; for (const fl of flames) { const u = fl.userData, k = u.s * (1 + 0.22 * Math.sin(flameT * 11 + u.ph) + 0.1 * Math.sin(flameT * 23 + u.ph * 2)); fl.scale.set(u.s * 0.75, k * 1.25, 1); fl.position.set(u.x + Math.sin(flameT * 7 + u.ph) * 0.05, u.y, u.z); }
    for (const s of smoke) {                              // העשן עולה ומתפזר
      const u = s.userData; u.t = (u.t + dt * 0.11) % 1;
      s.position.set(u.x + Math.sin(u.t * 5 + u.x) * u.size * 0.8 * u.t + u.t * 3, u.y + u.t * 9 * u.size, u.z + u.t * 1.5);
      const k = u.size * (1 + u.t * 4.5); s.scale.set(k, k, 1); s.material.opacity = 0.5 * (1 - u.t);
    }
    passes(camera, showAvatar);
    updateZone(); drawMini(false);
  }

  /* ---------- כתובות בכתב המקור ---------- */
  const INFO = window.GERIZIM_WALK_INFO || {};
  let taps = [], signs = [], peek = null, insForce = null, shadows = false, sunRef = null;
  const HEB = 'אבגדהוזחטיכלמנסעפצקרשת', FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  const toBlock = (s, base) => Array.from(s).map(ch => { const i = HEB.indexOf(FINALS[ch] || ch); return i < 0 ? ch : String.fromCodePoint(base + i); }).join('');
  const glyphOK = {};
  // האם יש במכשיר גופן לכתב הזה: שתי אותיות שונות צריכות להיראות שונות, ושונות מתו שאינו קיים
  function hasScript(font, base) {
    if (glyphOK[base] != null) return glyphOK[base];
    const px = s => { const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d'); g.font = '32px ' + font; g.textBaseline = 'middle'; g.fillText(s, 6, 24); return c.toDataURL(); };
    const a = px(String.fromCodePoint(base)), b = px(String.fromCodePoint(base + 11)), n = px(String.fromCodePoint(base + 22));
    return (glyphOK[base] = a !== b && a !== n);
  }
  const ARAM_FONT = '"Noto Sans Imperial Aramaic", "Segoe UI Historic", serif', PHN_FONT = '"Noto Sans Phoenician", "Segoe UI Historic", serif';
  function insTexture(ins) {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 348; const g = cv.getContext('2d');
    g.fillStyle = '#e2dac6'; g.fillRect(0, 0, 640, 348); speckle(g, 2200, 0.12, ['#b7a888', '#fff', '#8f8266'], 640);
    g.strokeStyle = 'rgba(90,75,50,.55)'; g.lineWidth = 7; g.strokeRect(4, 4, 632, 340);
    let lines = String(ins.text || '').split(/\n|\s*\/\s*/).filter(Boolean).slice(0, 5), font = '"Frank Ruhl Libre", David, "Times New Roman", serif', shown = 'square', rtl = true, wgt = '600 ';
    const sc = ins.script || '';
    if (sc.indexOf('aramaic') === 0 && hasScript(ARAM_FONT, 0x10840)) { lines = lines.map(l => toBlock(l, 0x10840)); font = ARAM_FONT; shown = 'orig'; wgt = ''; }
    else if (sc === 'paleo-hebrew' && hasScript(PHN_FONT, 0x10900)) { lines = lines.map(l => toBlock(l, 0x10900)); font = PHN_FONT; shown = 'orig'; wgt = ''; }
    else if (sc === 'samaritan') { font = 'Samaritan, serif'; shown = 'orig'; wgt = ''; }
    else if (sc === 'greek') { font = 'Georgia, "Times New Roman", serif'; shown = 'orig'; rtl = false; wgt = ''; }
    const fs = lines.length > 3 ? 46 : lines.length > 2 ? 54 : 66;
    g.font = wgt + fs + 'px ' + font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = rtl ? 'rtl' : 'ltr';
    lines.forEach((ln, i) => { const y = 174 + (i - (lines.length - 1) / 2) * (fs + 10); g.fillStyle = 'rgba(60,20,10,.45)'; g.fillText(ln, 322, y + 2, 600); g.fillStyle = '#9a2d1e'; g.fillText(ln, 320, y, 600); });   // האותיות חקוקות וממולאות צבע אדום
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    return { tex, shown };
  }
  // הקיר הקרוב לנקודה: נקודה על פניו, והכיוון שאליו הוא פונה
  function wallFor(x, z, y) {
    let best = null;
    for (const s of W.solids) {
      if (!inPer(s) || s.shed || s.rampTo || s.h < 2.4 || s.y0 > y + 0.6 || s.y0 + s.h < y + 2.3) continue;
      const b = s.box; if (inBox(b, x, z)) continue;
      let px = Math.max(b[0], Math.min(b[2], x)), pz = Math.max(b[1], Math.min(b[3], z)); const d = Math.hypot(px - x, pz - z);
      if (d > 7 || (best && d >= best.d)) continue;
      let nx = 0, nz = 0;
      if (Math.abs(x - px) >= Math.abs(z - pz)) nx = x > px ? 1 : -1; else nz = z > pz ? 1 : -1;
      if (nx) { if (b[3] - b[1] < 1.5) continue; pz = Math.max(b[1] + 0.75, Math.min(b[3] - 0.75, pz)); }
      else { if (b[2] - b[0] < 1.5) continue; px = Math.max(b[0] + 0.75, Math.min(b[2] - 0.75, px)); }
      best = { d, px, pz, nx, nz };
    }
    return best;
  }

  /* ---------- שכבות התצוגה: כל אחת נדלקת ונכבית בנפרד, והבחירה נשמרת ---------- */
  const LAYERS = ['names', 'poi', 'routes', 'history', 'inscr', 'walker', 'life', 'temple'];
  const layers = { names: true, poi: true, routes: true, history: true, inscr: true, walker: true, life: true, temple: false };
  try {
    const sv = JSON.parse(localStorage.getItem('gerizim-layers') || '{}');
    LAYERS.forEach(k => { if (typeof sv[k] === 'boolean' && k !== 'temple') layers[k] = sv[k]; });
    if (sv.walker == null && localStorage.getItem('gerizim-walker') === '0') layers.walker = false;
  } catch (e) { /* בלי אחסון — ברירות המחדל */ }
  showAvatar = layers.walker;
  let infoClosed = false, paused = false, labelObjs = [], routeObjs = [], mapMode = 'mini', quality = null;
  try { if (localStorage.getItem('gerizim-map') === 'off') mapMode = 'off'; } catch (e) { /* בלי אחסון */ }
  function setLayer(k, on) {
    layers[k] = !!on;
    try { localStorage.setItem('gerizim-layers', JSON.stringify(layers)); } catch (e) { /* בלי אחסון */ }
    if (k === 'temple') { showTemple = layers.temple; if (active) rebuild(); }
    if (k === 'walker') showAvatar = layers.walker;
    if (k === 'life' && life && life.show) life.show(layers.life);
    if (k === 'history') { infoClosed = false; }
    if (k === 'inscr') { for (const q of taps) if (q.ins) q.obj.visible = layers.inscr; insShown = undefined; }
    if (k === 'names') for (const q of taps) if (q.plate) q.obj.visible = layers.names;
    if (k === 'routes') for (const o of routeObjs) o.visible = layers.routes;
    applyUI(); if (active) drawMini(true);
  }

  /* ---------- שילוט: לוחות שם חקוקים על החזיתות, ותוויות לנקודות העניין ---------- */
  const tagKey = z => z.tag || (INFO.zone || {})[z.id] || ((z.per || period) === 'p' ? 'samper' : 'samhel');
  const tagOf = z => (INFO.tags || {})[tagKey(z)] || null;
  const infoById = id => W.zones.find(z => z.id === id && (!z.per || z.per === period)) || (INFO.marks || []).find(m => m.id === id) || null;
  function signSprite(name, col) {
    const tex = texture('sign' + lang + name + col, 512, 112, c => {
      const g = c.getContext('2d'); g.fillStyle = 'rgba(22,18,12,.84)'; g.strokeStyle = col; g.lineWidth = 5;
      g.beginPath(); const r = 26; g.moveTo(r, 6); g.arcTo(506, 6, 506, 106, r); g.arcTo(506, 106, 6, 106, r); g.arcTo(6, 106, 6, 6, r); g.arcTo(6, 6, 506, 6, r); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f3ead6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = lang === 'en' ? 'ltr' : 'rtl';
      let fs = 46; g.font = '600 ' + fs + 'px "Segoe UI", Arial, sans-serif'; while (g.measureText(name).width > 470 && fs > 22) { fs -= 2; g.font = '600 ' + fs + 'px "Segoe UI", Arial, sans-serif'; }
      g.fillText(name, 256, 58);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sp.center.set(0.5, 0); return sp;
  }
  // לוח אבן גיר במסגרת מגולפת, והכיתוב חרות בו: כך נראו לוחות ההקדשה. השפה היא שפת המבקר
  function plateTexture(name) {
    return texture('plate' + lang + name, 512, 168, c => {
      const g = c.getContext('2d'); g.fillStyle = '#d6cdb5'; g.fillRect(0, 0, 512, 168); speckle(g, 2600, 0.13, ['#b3a585', '#f3ecd9', '#8f8266'], 512);
      g.strokeStyle = 'rgba(70,55,35,.6)'; g.lineWidth = 7; g.strokeRect(8, 8, 496, 152); g.strokeStyle = 'rgba(255,250,235,.55)'; g.lineWidth = 2; g.strokeRect(15, 15, 482, 138);
      const fam = lang === 'en' ? 'Georgia, "Times New Roman", serif' : lang === 'ar' ? 'Amiri, "Traditional Arabic", "Times New Roman", serif' : '"Frank Ruhl Libre", David, "Times New Roman", serif';
      const txt = lang === 'en' ? name.toUpperCase() : name; let fs = 70;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = lang === 'en' ? 'ltr' : 'rtl';
      g.font = '600 ' + fs + 'px ' + fam; while (g.measureText(txt).width > 448 && fs > 24) { fs -= 2; g.font = '600 ' + fs + 'px ' + fam; }
      g.fillStyle = 'rgba(255,252,240,.6)'; g.fillText(txt, 257.5, 88); g.fillStyle = '#463220'; g.fillText(txt, 256, 86);       // אות חרותה: שפה מוארת וצל
    });
  }
  // המשטח הראשון של האזור שקיים בתקופה המוצגת
  const zoneFloor = z => { for (const id of (z.floors || [])) { const f = W.floors.find(q => q.id === id && inPer(q)); if (f) return f; } return null; };
  const FACE = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
  function buildSigns() {
    for (const o of labelObjs) root.remove(o); labelObjs = []; signs = []; taps = taps.filter(q => q.ins && !q.cap);
    const plated = {}, POI = INFO.poi || [];
    for (const pl of (INFO.plates || [])) {
      if (pl.per && pl.per !== period) continue;
      const info = infoById(pl.ref), d = FACE[pl.face]; if (!info || !d) continue;
      const x = pl.e, z = -pl.n, s0 = spot(x + d[0], z + d[1]), y0 = s0 ? s0.y : groundY(x + d[0], z + d[1]), k = pl.size || 1, wd = 1.9 * k;
      const side = build.M.ashlar, face = new THREE.MeshLambertMaterial({ map: plateTexture(L((INFO.mapNames || {})[pl.ref] && pl.short ? INFO.mapNames[pl.ref] : info.name)), color: 0xddd6c6 });
      const me = new THREE.Mesh(new THREE.BoxGeometry(wd, wd * 0.33, 0.1), [side, side, side, side, face, side]);
      me.position.set(x + d[0] * 0.06, y0 + (pl.y || 2.55), z + d[1] * 0.06); me.rotation.y = Math.atan2(d[0], d[1]); me.castShadow = shadows; me.visible = layers.names;
      root.add(me); labelObjs.push(me); taps.push({ obj: me, info, plate: true }); plated[pl.ref] = 1;
    }
    const add = (info, x, z, y) => {
      if (plated[info.id]) return;                         // למבנה שיש לו לוח על החזית אין צורך גם בתווית מרחפת
      const tg = tagOf(info), layer = POI.indexOf(info.id) >= 0 ? 'poi' : 'names', sp = signSprite(L(info.name), tg ? tg.col : '#d9b25f');
      sp.position.set(x, y, z); sp.visible = layers[layer]; root.add(sp); labelObjs.push(sp); signs.push({ sp, info, x, z, layer }); taps.push({ obj: sp, info });
    };
    for (const z of W.zones) {
      if ((z.per && z.per !== period) || z.id === 'centre') continue;
      const f0 = zoneFloor(z), f = f0 && f0.room ? (W.floors.find(q => q.id === f0.id + 'door') || f0) : f0, b = f ? f.box : z.box; if (!b) continue;
      const x = (b[0] + b[2]) / 2, zz = (b[1] + b[3]) / 2;
      add(z, x, zz, (f ? floorY(f, x, zz) : 0) + (f0 && f0.room ? 3.5 : 3.7));
    }
    for (const m of (INFO.marks || [])) {
      if ((m.per && m.per !== period) || (m.only === 'temple' && !(showTemple && W.temple[period]))) continue;
      const x = m.e, z = -m.n; let top = null;
      for (const s of W.solids) if (inPer(s) && !s.shed && inBox(s.box, x, z, 0.5)) top = Math.max(top == null ? -1e9 : top, s.y0 + s.h);
      add(m, x, z, m.only === 'temple' ? W.temple[period].h + 1 : (top == null ? 4 : top + 1.4));
    }
    // תרגום לצד כל כתובת: הכתובות כתובות ארמית או יוונית, והתרגום מוצג מתחתן בשפת המבקר (שכבת הכתובות)
    for (const q of insStones) {
      const txt = L(q.ins.tr); if (!txt || !q.at) continue;
      const tex = texture('cap' + lang + (q.ins.id || q.ins.no) + txt.length, 640, 168, c => {
        const g = c.getContext('2d'); g.fillStyle = 'rgba(22,18,12,.9)'; g.fillRect(0, 0, 640, 168); g.strokeStyle = '#d9b25f'; g.lineWidth = 3; g.strokeRect(3, 3, 634, 162);
        g.fillStyle = '#f3ead6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = lang === 'en' ? 'ltr' : 'rtl';
        let fs = 34, lines = [];
        for (; fs >= 17; fs -= 2) {                       // שבירת שורות: עד שלוש שורות, בגודל האות הגדול ביותר שנכנס
          g.font = fs + 'px "Segoe UI", Arial, sans-serif'; lines = []; let cur = '';
          for (const wd of txt.split(/\s+/)) { const t2 = cur ? cur + ' ' + wd : wd; if (g.measureText(t2).width > 600 && cur) { lines.push(cur); cur = wd; } else cur = t2; }
          if (cur) lines.push(cur); if (lines.length <= 3) break;
        }
        lines = lines.slice(0, 4); const lh = fs + 7; lines.forEach((ln, i) => g.fillText(ln, 320, 84 + (i - (lines.length - 1) / 2) * lh, 610));
      });
      let me;
      if (q.at.ry != null) { me = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.42), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); me.position.set(q.at.x, q.at.y - 0.62, q.at.z); me.rotation.y = q.at.ry; }
      else { me = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); me.scale.set(1.6, 0.42, 1); me.position.set(q.at.x, q.at.y - 0.05, q.at.z); }
      me.visible = layers.inscr; root.add(me); labelObjs.push(me); taps.push({ obj: me, ins: q.ins, cap: true });
    }
    buildRoutes();
  }
  function stepSigns() {
    for (const s of signs) {
      const d = Math.hypot(s.x - pos.x, s.z - pos.z), k = Math.max(1, Math.min(5, d / 11));
      s.sp.visible = layers[s.layer] && d > 4 && d < 150; s.sp.scale.set(2.7 * k, 0.59 * k, 1);
    }
  }
  // המסלולים המרכזיים: אבני סימון שקועות בקרקע, כל שלושה מטרים
  const routesNow = () => (INFO.routes || []).filter(r => !r.per || r.per === period);
  function buildRoutes() {
    for (const o of routeObjs) root.remove(o); routeObjs = [];
    for (const r of routesNow()) {
      const pts = [];
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const a = r.pts[i], b = r.pts[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(d / 3));
        for (let k = 0; k < n; k++) { const x = a[1] + (b[1] - a[1]) * k / n, z = -(a[0] + (b[0] - a[0]) * k / n), s = spot(x, z); if (s) pts.push([x, s.y + 0.07, z]); }
      }
      if (!pts.length) continue;
      const g = new THREE.CircleGeometry(0.13, 8); g.rotateX(-Math.PI / 2);
      const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: r.stone || r.col }), pts.length), m4 = new THREE.Matrix4();
      pts.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); });
      im.visible = layers.routes; root.add(im); routeObjs.push(im);
    }
  }
  function tapAt(e) {
    if (!taps.length) return null;
    const cv = renderer.domElement, r = cv.getBoundingClientRect(), rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera); rc.far = 150;
    const hit = rc.intersectObjects(taps.filter(q => q.obj.visible).map(q => q.obj), false)[0];
    return hit ? taps.find(q => q.obj === hit.object) : null;
  }

  /* ---------- מבט וגרירה ---------- */
  let dragging = false, down = null, insStones = [], insShown = null;
  function ray(e) {
    const cv = renderer.domElement, r = cv.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, camera); rc.far = 90;
    const hit = rc.intersectObjects(clickables, false)[0];
    return hit ? hit.point : null;
  }
  function bind(cv) {
    cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* בלי לכידה */ } });
    cv.addEventListener('pointermove', e => {
      if (down && !paused) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 6) { down.moved = true; dragging = true; cv.classList.add('drag'); }
        if (down.moved) { const k = 0.0042; look.yaw = down.yaw - dx * k; look.pitch = Math.max(-1.1, Math.min(1.1, down.pitch + dy * k)); }
      } else if (e.pointerType === 'mouse') {             // עיגול על הקרקע, במקום שאליו אפשר ללכת
        const p = ray(e); const ok = p && canStandAny(p.x, p.z);
        if (ok && !target) { marker.position.set(p.x, ok.y + 0.06, p.z); marker.visible = true; } else if (!target) marker.visible = false;
      }
    });
    const up = e => {
      const tp = down && !down.moved && !paused ? tapAt(e) : null;
      if (tp) {
        if (tp.ins) { insForce = { ins: tp.ins, x: pos.x, z: pos.z }; insShown = null; } else { peek = { info: tp.info, x: pos.x, z: pos.z }; zoneId = null; }
        infoClosed = false; if (!layers.history) setLayer('history', true); applyUI(); $('walkInfo').classList.add('open'); hideHint();
      } else if (down && !down.moved && !paused) {
        const p = ray(e), f = p && canStandAny(p.x, p.z);
        if (f) { target = { x: p.x, z: p.z }; marker.position.set(p.x, f.y + 0.06, p.z); marker.visible = true; hideHint(); }
      }
      down = null; dragging = false; cv.classList.remove('drag');
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { down = null; dragging = false; });
    cv.addEventListener('wheel', e => { e.preventDefault(); camera.fov = Math.max(32, Math.min(84, camera.fov + (e.deltaY > 0 ? 3 : -3))); camera.updateProjectionMatrix(); }, { passive: false });
    window.addEventListener('keydown', e => { if (!active) return; if (e.code === 'Escape') { if (paused && opts.onCloseCard) return opts.onCloseCard(); if (!$('walkLayers').hidden) { $('walkLayers').hidden = true; return; } return exit(); } if (paused) return; keys[e.code] = true; if (/^Arrow|^Key[WASD]$/.test(e.code)) { e.preventDefault(); hideHint(); } });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => { keys = {}; hold = {}; });
    window.addEventListener('resize', () => { if (active) resize(); });
  }
  function canStandAny(x, z) {
    let best = null;
    for (const f of W.floors) if (!f.deco && inPer(f) && inBox(f.box, x, z)) { const y = floorY(f, x, z); if (!blocked(x, z, y) && (!best || Math.abs(y - pos.y) < Math.abs(best.y - pos.y))) best = { f, y }; }
    return best;
  }

  /* ---------- היכן אני: האזור, ההסבר והמפה הקטנה ---------- */
  function zoneAt() {
    const f = floorAt(pos.x, pos.z, pos.y), fid = f && f.f.id;
    for (const z of W.zones) {
      if (z.per && z.per !== period) continue;
      if (z.box && inBox(z.box, pos.x, pos.z) && (!f || Math.abs(f.y) < 0.5)) return z;
      if (z.floors && z.floors.indexOf(fid) >= 0) return z;
    }
    return null;
  }
  function updateZone() {
    // כשעומדים ליד כתובת, או כשנוגעים בה, הנוסח והתרגום שלה מוצגים
    let near = null, nd = 3.6, rec = null;
    if (layers.inscr) for (const s of insStones) { const dd = Math.hypot(s.x - pos.x, s.z - pos.z); if (dd < nd) { nd = dd; near = s.ins; } }
    if (insForce) { if (Math.hypot(pos.x - insForce.x, pos.z - insForce.z) > 4) insForce = null; else near = insForce.ins; }
    if (near !== insShown) {
      insShown = near; const el = $('walkIns'); rec = near && insStones.find(s => s.ins === near);
      if (near) {
        el.innerHTML = '<div class="insno"></div><div class="insscr"></div><div class="instx"></div><div class="instr"></div><div class="instr2"></div>';
        el.children[0].textContent = (near.no != null ? (opts.insNo || '{n}').replace('{n}', near.no) : L(near.label)) + ' · ' + L(near.spot);
        el.children[1].textContent = ((opts.scripts || {})[near.script] || '') + ' · ' + T(rec && rec.shown === 'orig' ? 'insOrig' : 'insSquare') + (rec && rec.approx ? ' · ' + T('insApprox') : '');
        el.children[2].textContent = near.text || ''; el.children[3].textContent = L(near.tr);
        const o2 = lang === 'he' ? 'en' : 'he', t2 = near.tr && near.tr[o2]; el.children[4].textContent = t2 ? T('tr_' + o2) + ': ' + t2 : ''; el.children[4].dir = o2 === 'en' ? 'ltr' : 'rtl';
      }
      el.classList.toggle('on', !!near); if (near) $('walkInfo').classList.add('open');
    }
    if (peek && Math.hypot(pos.x - peek.x, pos.z - peek.z) > 5) peek = null;
    const z = peek ? peek.info : zoneAt(), id = (peek ? 'look:' : '') + (z ? z.id : '');
    if (id === zoneId) return;
    zoneId = id;
    $('walkHere').textContent = peek ? T('look') : T('here');
    const tg = z && tagOf(z), who = $('walkWho');
    who.textContent = tg ? L(tg.text) : ''; who.style.display = tg ? '' : 'none'; if (tg) who.style.borderColor = tg.col;
    const gs = z && (INFO.guess || {})[tagKey(z)]; $('walkGuess').textContent = gs ? L(gs) : ''; $('walkGuess').style.display = gs ? '' : 'none';
    $('walkZone').textContent = z ? L(z.name) : '';
    $('walkText').textContent = z ? L(z.text) : '';
    $('walkMore').style.display = z && z.place && opts.onPlace ? '' : 'none';
    // תצלומים אמיתיים של המקום שבו עומדים, כפי שהוא נראה היום
    const ph = z && z.place && opts.photosOf ? opts.photosOf(z.place) : [], box = $('walkPhotos');
    box.innerHTML = ph.length ? '<div class="wpt">' + T('today') + '</div><div class="strip">' + ph.slice(0, 8).map((im, i) => '<button class="ph" data-i="' + i + '"><img loading="lazy" src="' + im.thumb + '" alt=""></button>').join('') + '</div>' : '';
    box.querySelectorAll('.ph').forEach(b => { b.onclick = e => { e.stopPropagation(); opts.onPhoto(ph, +b.dataset.i); }; });
    $('walkMore').onclick = e => { e.stopPropagation(); opts.onPlace(z.place); };
  }
  let miniBase = null, mapLab = null;
  const MK = 2;                                           // פיקסלים למטר בשרטוט המלא שממנו נגזר החלון
  function buildMiniBase() {
    const B = W.bounds, cw = Math.round((B[2] - B[0]) * MK), ch = Math.round((B[3] - B[1]) * MK);
    miniBase = document.createElement('canvas'); miniBase.width = cw; miniBase.height = ch;
    const g = miniBase.getContext('2d');
    g.fillStyle = '#f1e9d2'; g.fillRect(0, 0, cw, ch);
    const rect = (b, fill, stroke) => { const x = (b[0] - B[0]) * MK, y = (b[1] - B[1]) * MK, ww = (b[2] - b[0]) * MK, hh = (b[3] - b[1]) * MK; if (fill) { g.fillStyle = fill; g.fillRect(x, y, ww, hh); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.2; g.strokeRect(x, y, ww, hh); } };
    for (const f of W.floors) if (inPer(f) && !f.deco) rect(f.box, f.steps ? '#c9b98f' : (/^road|^eroad|^sroad/.test(f.id) ? '#e8dfc6' : f.mat === 'pave' ? '#e3d7b6' : '#d9cba4'));
    for (const f of W.floors) if (inPer(f) && f.steps) {     // קווי מדרגות
      const b = f.box, r = f.ramp; g.strokeStyle = 'rgba(90,70,40,.55)'; g.lineWidth = 1;
      for (let i = 0; i <= 12; i++) { const v = r.a + (r.b - r.a) * i / 12; g.beginPath(); if (r.axis === 'x') { g.moveTo((v - B[0]) * MK, (b[1] - B[1]) * MK); g.lineTo((v - B[0]) * MK, (b[3] - B[1]) * MK); } else { g.moveTo((b[0] - B[0]) * MK, (v - B[1]) * MK); g.lineTo((b[2] - B[0]) * MK, (v - B[1]) * MK); } g.stroke(); }
    }
    for (const s of W.solids) if (inPer(s) && s.h > 0.5 && !s.shed) rect(s.box, s.id ? '#b8862e' : (s.house ? '#8a7a66' : '#3b3024'));
    const tpm = showTemple && W.temple[period];
    if (tpm) { g.setLineDash([5, 4]); rect(tpm.box, 'rgba(184,134,46,.25)', '#8a5a1c'); if (tpm.inner) rect(tpm.inner, null, '#8a5a1c'); g.setLineDash([]); }
    // התחנות המרכזיות, בשמן הקצר
    mapLab = [];
    const POI = INFO.poi || [];
    for (const id of Object.keys(INFO.mapNames || {})) {
      const z = W.zones.find(q => q.id === id && (!q.per || q.per === period)); if (!z) continue;
      const f = zoneFloor(z), b = f ? f.box : z.box; if (!b) continue;
      mapLab.push({ x: (b[0] + b[2]) / 2, z: (b[1] + b[3]) / 2, name: L(INFO.mapNames[id]), layer: POI.indexOf(id) >= 0 ? 'poi' : 'names' });
    }
  }
  function setMap(m) {
    mapMode = m;
    try { localStorage.setItem('gerizim-map', m === 'off' ? 'off' : 'mini'); } catch (e) { /* בלי אחסון */ }
    applyUI(); drawMini(true); avTick = 0;
  }
  function drawMini(force) {
    const cv = $('walkMini'); if (!cv || mapMode === 'off') return;
    const w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), big = mapMode === 'big';
    if (force || !miniBase) buildMiniBase();
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    // חלון קטן: כ-95 מ' לכל צד מן ההולך, והמפה נעה איתו. מפה מוגדלת: הפסגה כולה, וההולך נע בתוכה
    const B = W.bounds; let k, x0, z0;
    if (big) { k = Math.min(w / (B[2] - B[0]), h / (B[3] - B[1])); x0 = (B[0] + B[2]) / 2 - w / k / 2; z0 = (B[1] + B[3]) / 2 - h / k / 2; }
    else { k = w / 190; x0 = pos.x - 95; z0 = pos.z - h / k / 2; }
    drawMini.inv = (px, pz) => [x0 + px / k, z0 + pz / k];
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#e9e0c6'; g.fillRect(0, 0, w, h);
    // רק החלק של השרטוט שבתוך החלון
    const sx0 = Math.max(B[0], x0), sz0 = Math.max(B[1], z0), sx1 = Math.min(B[2], x0 + w / k), sz1 = Math.min(B[3], z0 + h / k);
    if (sx1 > sx0 && sz1 > sz0) g.drawImage(miniBase, (sx0 - B[0]) * MK, (sz0 - B[1]) * MK, (sx1 - sx0) * MK, (sz1 - sz0) * MK, (sx0 - x0) * k, (sz0 - z0) * k, (sx1 - sx0) * k, (sz1 - sz0) * k);
    const P = (x, z) => [(x - x0) * k, (z - z0) * k];
    if (layers.routes) for (const r of routesNow()) {       // המסלולים
      g.setLineDash([5, 4]); g.strokeStyle = r.col; g.lineWidth = 2.2; g.beginPath();
      r.pts.forEach((p, i) => { const q = P(p[1], -p[0]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.stroke(); g.setLineDash([]);
    }
    // שמות התחנות; תווית שמתנגשת בקודמתה מדולגת
    const used = []; g.font = '600 ' + (big ? 11 : 10) + 'px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = lang === 'en' ? 'ltr' : 'rtl';
    for (const m of (mapLab || [])) {
      if (!layers[m.layer]) continue;
      const q = P(m.x, m.z), tw = g.measureText(m.name).width / 2 + 3; if (q[0] < tw || q[0] > w - tw || q[1] < 8 || q[1] > h - 8) continue;
      if (used.some(u => Math.abs(u[0] - q[0]) < u[2] + tw && Math.abs(u[1] - q[1]) < 13)) continue;
      used.push([q[0], q[1], tw]);
      g.lineWidth = 3; g.strokeStyle = 'rgba(241,233,210,.92)'; g.strokeText(m.name, q[0], q[1]); g.fillStyle = m.layer === 'poi' ? '#7a2a18' : '#2f2519'; g.fillText(m.name, q[0], q[1]);
    }
    // "אתם כאן": נקודה, ומניפה שמראה לאן מביטים
    const me = P(pos.x, pos.z), a = look.yaw, cx = me[0], cy = me[1];
    g.fillStyle = 'rgba(200,40,30,.26)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, big ? 26 : 30, a - Math.PI / 2 - 0.55, a - Math.PI / 2 + 0.55); g.closePath(); g.fill();
    g.fillStyle = '#c8281e'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 4.8, 0, 6.3); g.fill(); g.stroke();
    g.font = '700 10.5px "Segoe UI", Arial, sans-serif'; const yh = T('youHere'), ty = cy + (Math.cos(a) > 0 ? 14 : -14);
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeText(yh, cx, ty); g.fillStyle = '#b02218'; g.fillText(yh, cx, ty);
    // חץ צפון: המתחם נוטה מן הצפון, ולכן גם החץ
    g.save(); g.translate(w - 15, 17); g.rotate(-(W.north || 0) * Math.PI / 180);
    g.fillStyle = 'rgba(241,233,210,.85)'; g.beginPath(); g.arc(0, 2, 13, 0, 6.3); g.fill();
    g.fillStyle = '#3b3024'; g.beginPath(); g.moveTo(0, -9); g.lineTo(-4.5, 4); g.lineTo(4.5, 4); g.closePath(); g.fill();
    g.font = '600 8px sans-serif'; g.textAlign = 'center'; g.direction = 'ltr'; g.fillText('N', 0, 12.5); g.restore();
    // קנה מידה
    const sm = big ? 100 : 50; g.direction = 'ltr'; g.fillStyle = '#3b3024'; g.fillRect(8, h - 9, sm * k, 2); g.font = '9px sans-serif'; g.textAlign = 'left'; g.fillText(sm + ' m', 8, h - 14);
  }
  function hideHint() { const h = $('walkHint'); if (h) h.classList.add('gone'); }

  /* ---------- הממשק ---------- */
  function dom() {
    const el = $('walk');
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    el.innerHTML = '<canvas id="walkCv"></canvas>' +
      '<div id="walkTop"><button id="walkExit"></button><div id="walkPer"><button data-p="h"></button><button data-p="p"></button></div>' +
      '<div id="walkLayersBox"><button id="walkLayersBtn" aria-haspopup="true" aria-expanded="false"></button><div id="walkLayers" hidden>' +
      LAYERS.map(k => '<label><input type="checkbox" data-l="' + k + '"><span></span></label>').join('') + '</div></div>' +
      '<button id="walkMapBtn"></button><button id="walkInfoBtn"></button>' +
      '<div id="walkLang"><button data-lang="he">עב</button><button data-lang="en">EN</button><button data-lang="ar">ع</button></div></div>' +
      '<div id="walkSide"><div id="walkMiniH"><span id="walkMiniT"></span><button id="walkMiniBig"></button><button id="walkMiniX">✕</button></div><canvas id="walkMini"></canvas><div id="walkLegend"></div></div>' +
      '<div id="walkInfo"><button id="walkInfoX" class="wx">✕</button><div id="walkHere"></div><h3 id="walkZone"></h3><div id="walkWho"></div><p id="walkText"></p><div id="walkGuess"></div><div id="walkIns"></div><div id="walkPhotos"></div><button id="walkMore"></button><div id="walkNote"></div></div>' +
      '<div id="walkPad"><button data-h="left" aria-label="">◀</button><div><button data-h="fwd">▲</button><button data-h="back">▼</button></div><button data-h="right">▶</button></div>' +
      '<div id="walkHint"></div><div id="walkAttr">Imagery © Esri, Maxar, Earthstar Geographics · Terrain: Mapzen, AWS Open Data</div><div id="walkLoad"></div>';
    $('walkExit').onclick = exit;
    el.querySelectorAll('#walkPer button').forEach(b => { b.onclick = () => setPeriod(b.dataset.p); });
    // תפריט השכבות: נפתח ונסגר בלחיצה, וכל שכבה בו נדלקת ונכבית לעצמה
    const menu = open => { $('walkLayers').hidden = !open; $('walkLayersBtn').setAttribute('aria-expanded', open ? 'true' : 'false'); $('walkLayersBtn').classList.toggle('on', open); };
    $('walkLayersBtn').onclick = e => { e.stopPropagation(); menu($('walkLayers').hidden); };
    $('walkLayers').addEventListener('click', e => e.stopPropagation());
    el.addEventListener('pointerdown', e => { if (!$('walkLayers').hidden && !e.target.closest('#walkLayersBox')) menu(false); });
    el.querySelectorAll('#walkLayers input').forEach(i => { i.onchange = () => setLayer(i.dataset.l, i.checked); });
    el.querySelectorAll('#walkLang button').forEach(b => { b.onclick = () => { if (opts.onLang) opts.onLang(b.dataset.lang); else setLang(b.dataset.lang); }; });
    $('walkMapBtn').onclick = () => setMap(mapMode === 'off' ? 'mini' : 'off');
    $('walkMiniBig').onclick = e => { e.stopPropagation(); setMap(mapMode === 'big' ? 'mini' : 'big'); };
    $('walkMiniX').onclick = e => { e.stopPropagation(); setMap('off'); };
    $('walkInfoBtn').onclick = () => { if (!layers.history) { setLayer('history', true); return; } infoClosed = !infoClosed; if (infoClosed) { peek = null; insForce = null; } applyUI(); };
    $('walkInfoX').onclick = e => { e.stopPropagation(); infoClosed = true; peek = null; insForce = null; zoneId = undefined; applyUI(); };
    el.querySelectorAll('#walkPad button').forEach(b => {
      const k = b.dataset.h, on = e => { e.preventDefault(); if (paused) return; hold[k] = true; hideHint(); }, off = () => { hold[k] = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    $('walkMini').addEventListener('click', e => {       // לחיצה על המפה מעבירה לשם
      const r = e.currentTarget.getBoundingClientRect(), q = drawMini.inv(e.clientX - r.left, e.clientY - r.top), f = canStandAny(q[0], q[1]);
      if (f) { pos.x = q[0]; pos.z = q[1]; pos.y = f.y; target = null; camera.position.y = pos.y + EYE; if (mapMode === 'big' && window.innerWidth <= 640) setMap('mini'); }
    });
    $('walkInfo').addEventListener('click', e => { if (e.target.id !== 'walkMore' && !e.target.closest('.ph') && !e.target.closest('.wx')) $('walkInfo').classList.toggle('open'); });
  }
  // מצב הכפתורים, התפריט והלוחות לפי השכבות, המפה והכרטיס
  function applyUI() {
    if (!$('walkTop') || !$('walkTop').firstChild) return;
    $('walk').querySelectorAll('#walkLayers input').forEach(i => { i.checked = !!layers[i.dataset.l]; });
    $('walk').querySelectorAll('#walkLang button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    const side = $('walkSide'); side.style.display = mapMode === 'off' ? 'none' : ''; side.classList.toggle('big', mapMode === 'big');
    $('walkMapBtn').classList.toggle('on', mapMode !== 'off'); $('walkMiniBig').textContent = mapMode === 'big' ? '−' : '⤢';
    $('walkMiniBig').setAttribute('aria-label', T(mapMode === 'big' ? 'mapSmall' : 'mapBig')); $('walkMiniBig').title = T(mapMode === 'big' ? 'mapSmall' : 'mapBig');
    const showInfo = layers.history && !infoClosed;
    $('walkInfo').style.display = showInfo ? '' : 'none'; $('walkInfoBtn').classList.toggle('on', showInfo);
    $('walkLegend').innerHTML = mapMode === 'big' && layers.routes ? routesNow().map(r => '<span><i style="background:' + r.col + '"></i>' + L(r.name).replace(/[<>&]/g, '') + '</span>').join('') : '';
    avTick = 0;
  }
  function texts() {
    const nar = window.innerWidth <= 640, S2 = k => (nar && T(k + 'S')) || T(k);          // במסך צר: תוויות קצרות, כדי שהסרגל העליון לא יכסה את הנוף
    $('walkExit').textContent = S2('exit');
    const pb = $('walkPer').querySelectorAll('button'); pb[0].textContent = S2('hel'); pb[1].textContent = S2('per');
    pb.forEach(b => b.classList.toggle('on', b.dataset.p === period));
    $('walkLayersBtn').textContent = '☰ ' + T('layers'); $('walkMapBtn').textContent = T('mapBtn'); $('walkInfoBtn').textContent = 'ⓘ' + (nar ? '' : ' ' + T('infoBtn'));
    $('walkInfoBtn').setAttribute('aria-label', T('infoBtn')); $('walkInfoX').setAttribute('aria-label', T('close')); $('walkInfoX').title = T('close');
    $('walkMiniX').setAttribute('aria-label', T('mapHide')); $('walkMiniX').title = T('mapHide');
    $('walk').querySelectorAll('#walkLayers label').forEach(lb => { lb.querySelector('span').textContent = T('ly_' + lb.querySelector('input').dataset.l); });
    $('walkMore').textContent = T('more'); $('walkNote').textContent = T('note') + (INFO.plateNote ? ' ' + L(INFO.plateNote) : '') + (INFO.later ? ' ' + L(INFO.later) : '');
    $('walkHint').textContent = T(window.matchMedia && matchMedia('(hover:none)').matches ? 'hintT' : 'hint'); $('walkMiniT').textContent = T('map'); $('walk').dir = lang === 'en' ? 'ltr' : 'rtl'; $('walk').lang = lang;
    const pad = $('walkPad').querySelectorAll('button'); ['left', 'fwd', 'back', 'right'].forEach((k, i) => pad[i].setAttribute('aria-label', T(k)));
    applyUI();
  }
  function place(st) {
    const s = W.starts[st] || W.starts.plaza, f = canStandAny(s.x, s.z) || { y: 0 };
    pos.x = s.x; pos.z = s.z; pos.y = f.y; look.yaw = s.yaw; look.pitch = 0; target = null; bodyYaw = null;
    if (camera) camera.position.set(pos.x, pos.y + EYE, pos.z);
  }
  function rebuild() { build(); miniBase = null; zoneId = undefined; texts(); if (!canStandAny(pos.x, pos.z)) place('plaza'); drawMini(true); }
  function setPeriod(p) { if (p === period) return; period = p; peek = null; insForce = null; rebuild(); }
  // החלפת שפה בתוך הסיור: המקום, כיוון המבט והשכבות נשארים כפי שהם; רק הכיתוב מתחלף
  function setLang(code, extra) {
    lang = UI[code] ? code : 'he'; if (extra) Object.assign(opts, extra);
    if (!$('walk').dataset.ready) return;
    texts();
    if (!active) return;
    zoneId = undefined; insShown = undefined; buildSigns(); updateZone(); drawMini(true);
  }
  // כרטיס מידע פתוח מעל הסיור: ההליכה נעצרת, והמקום וכיוון המבט נשמרים עד שסוגרים אותו
  function pause(b) { paused = !!b; keys = {}; hold = {}; target = null; if (marker) marker.visible = false; $('walk').classList.toggle('paused', paused); }

  function enter(o) {
    opts = o || {}; lang = opts.lang || 'he';
    const el = $('walk'); dom(); texts();
    el.classList.add('open'); $('walkLoad').textContent = T('loading'); $('walkLoad').style.display = 'flex';
    return loadThree().then(T3 => {
      THREE = T3;
      if (!renderer) { setup($('walkCv')); bind($('walkCv')); }
      period = opts.period || period;
      if (opts.start !== 'plaza') period = 'h';
      entrySeed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
      showTemple = layers.temple; paused = false; infoClosed = false; peek = null; insForce = null;
      place(opts.start || 'stairs'); build(); texts(); place(opts.start || 'stairs');
      active = true; resize(); zoneId = undefined; clock.getDelta(); cancelAnimationFrame(raf); tick();
      $('walkLoad').style.display = 'none'; $('walkHint').classList.remove('gone');
      setTimeout(hideHint, 9000);
    }).catch(() => { $('walkLoad').textContent = T('fail'); setTimeout(exit, 2600); });
  }
  function exit() {
    active = false; paused = false; cancelAnimationFrame(raf); keys = {}; hold = {};
    $('walk').classList.remove('open'); $('walk').classList.remove('paused');
    if (opts.onExit) opts.onExit();
  }
  window.GerizimWalk = { enter, exit, pause, setLang, setLayer, _shot: shot, _frame: (dt, n) => { for (let i = 0; i < (n || 1); i++) frame(dt || 0.033, false); }, _life: box => life && life.sample && life.sample(box), _go: (x, z, yaw, pitch) => { const f = canStandAny(x, z); if (!f) return false; pos.x = x; pos.z = z; pos.y = f.y; if (yaw != null) look.yaw = yaw; look.pitch = pitch || 0; target = null; camera.position.y = pos.y + EYE; return true; }, get active() { return active; }, get paused() { return paused; },
    _state: () => ({ pos, look, period, lang, zoneId, paused, layers: Object.assign({}, layers), mapMode, infoClosed, quality, life: life && life.counts(), ins: insStones.map(q => [q.ins.no, +q.x.toFixed(1), +q.z.toFixed(1), q.shown, q.approx ? 1 : 0]), signs: signs.length, plates: taps.filter(q => q.plate).length, routes: routeObjs.length,
      vis: { plates: taps.filter(q => q.plate && q.obj.visible).length, labels: signs.filter(q => q.layer === 'names' && layers.names).length, poi: signs.filter(q => q.layer === 'poi' && layers.poi).length, routes: routeObjs.filter(o => o.visible).length, inscr: taps.filter(q => q.ins && q.obj.visible).length, info: !!$('walkInfo') && $('walkInfo').style.display !== 'none', templeMark: signs.some(q => q.info.id === 'temple') },
      walker: av && { on: showAvatar, headYaw: av.head.rotation.y, headPitch: av.head.rotation.x, y: av.position.y, scale: av.scale.x } }) };
})();
