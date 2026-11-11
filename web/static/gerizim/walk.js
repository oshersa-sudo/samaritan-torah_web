/* הסיור הרגלי: הליכה בגוף ראשון בשחזור סכמטי של המתחם המקודש והעיר.
   נטען רק כשנכנסים לסיור. הנתונים ב-walk_data.js; המנוע כאן. */
(function () {
  'use strict';
  const W = window.GERIZIM_WALK;
  const THREE_URL = 'https://unpkg.com/three@0.149.0/build/three.min.js';
  const EYE = 1.62, RADIUS = 0.45, SPEED = 4.4;

  const UI = {
    he: { exit: '✕ חזרה למפה', hel: 'התקופה ההלניסטית · המאה ה-2 לפנה"ס', per: 'התקופה הפרסית · המאה ה-5 לפנה"ס', temple: 'בניין המקדש לפי הצעת החופר', walker: 'דמות ההולך',
      here: 'אתה נמצא כאן', today: 'המקום היום, בתצלומים', more: 'לכרטיס המקום', hint: 'גררו כדי להביט סביב · לחצו על הקרקע כדי ללכת לשם · או החיצים במקלדת',
      note: 'שחזור סכמטי. מה שנמצא בחפירה: מהלך הקירות, השערים, המדרגות והמידות. גובה הקירות, הגגות והדמויות הם השערה.',
      loading: 'בונה את המתחם…', fail: 'הסיור הרגלי לא נטען. בדקו את החיבור לרשת ונסו שוב.', map: 'היכן אני', fwd: 'קדימה', back: 'אחורה', left: 'שמאלה', right: 'ימינה' },
    en: { exit: '✕ Back to the map', hel: 'Hellenistic period · 2nd century BCE', per: 'Persian period · 5th century BCE', temple: 'The temple building as the excavator proposes', walker: 'The walker',
      here: 'You are here', today: 'The place today, in photographs', more: 'Open the place card', hint: 'Drag to look around · click the ground to walk there · or use the arrow keys',
      note: 'A schematic reconstruction. Found in the excavation: the lines of the walls, the gates, the stairs and the dimensions. Wall heights, roofs and the figures are conjecture.',
      loading: 'Building the precinct…', fail: 'The walk could not be loaded. Check your connection and try again.', map: 'Where am I', fwd: 'Forward', back: 'Back', left: 'Left', right: 'Right' },
    ar: { exit: '✕ العودة إلى الخريطة', hel: 'الفترة الهلنستية · القرن الثاني ق.م', per: 'الفترة الفارسية · القرن الخامس ق.م', temple: 'مبنى الهيكل بحسب اقتراح المنقّب', walker: 'شخص السائر',
      here: 'أنت هنا', today: 'المكان اليوم، بالصور', more: 'بطاقة المكان', hint: 'اسحب للنظر حولك · اضغط على الأرض للسير إليها · أو استعمل أسهم لوحة المفاتيح',
      note: 'إعادة بناء تخطيطية. ما وُجد في التنقيب: مسار الجدران والبوابات والأدراج والقياسات. أما ارتفاع الجدران والسقوف والشخوص فافتراض.',
      loading: 'جارٍ بناء الحرم…', fail: 'تعذّر تحميل الجولة. تحقّق من الاتصال وحاول ثانية.', map: 'أين أنا', fwd: 'إلى الأمام', back: 'إلى الخلف', left: 'يسارًا', right: 'يمينًا' }
  };

  let THREE = null, renderer, scene, camera, root, clock;
  let lang = 'he', period = 'h', showTemple = false, opts = {};
  let active = false, raf = 0;
  const pos = { x: 0, y: 0, z: 0 }, look = { yaw: 0, pitch: 0 };
  let target = null, keys = {}, hold = {}, zoneId = null, smoke = [], clickables = [], marker = null, stride = 0, lastX = 0, lastZ = 0;
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
  function canStand(x, z, y) {
    const f = floorAt(x, z, y);
    if (!f || Math.abs(f.y - y) > 1.1) return null;
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
    const me = new THREE.Mesh(boxGeo(w, h, d, tile), mat);
    me.position.set((b[0] + b[2]) / 2, y0 + h / 2, (b[1] + b[3]) / 2);
    root.add(me); return me;
  }
  const terrainH = (x, z) => W.terrain(x, z);
  function buildTerrain(M) {
    const SX = W.bounds[2] - W.bounds[0] + 160, SZ = W.bounds[3] - W.bounds[1] + 160;
    const g = new THREE.PlaneGeometry(SX, SZ, Math.round(SX / 2.4), Math.round(SZ / 2.4));
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv, cx = (W.bounds[0] + W.bounds[2]) / 2, cz = (W.bounds[1] + W.bounds[3]) / 2;
    let low = -55;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + cx, z = p.getZ(i) + cz; let y = terrainH(x, z), cut = null, lay = null;
      for (const f of W.floors) {
        if (f.deco || !inPer(f) || !inBox(f.box, x, z, f.city ? 2.6 : 1.4)) continue;
        const fy = floorY(f, Math.max(f.box[0], Math.min(f.box[2], x)), Math.max(f.box[1], Math.min(f.box[3], z))) - (f.steps ? 0.3 : 0.12);
        if (f.city) lay = lay == null ? fy : Math.min(lay, fy); else cut = cut == null ? fy : Math.min(cut, fy);
      }
      // רחובות העיר שעל המדרון: הקרקע צמודה אליהם משני הצדדים. מפלסי המתחם רק חוצבים בה
      if (lay != null) y = lay;
      if (cut != null) y = Math.min(y, cut);
      if (y < low) low = y;
      p.setXYZ(i, x, y, z); uv.setXY(i, x / 9, z / 9);
    }
    g.computeVertexNormals();
    root.add(new THREE.Mesh(g, M.terrain));
    // הרחק: טבעת נמוכה והרים באופק. הר עיבל מצפון
    const far = new THREE.Mesh(new THREE.CircleGeometry(2600, 40), new THREE.MeshLambertMaterial({ color: 0x8f8a63 }));
    far.rotation.x = -Math.PI / 2; far.position.y = low - 5; root.add(far);
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
        g.computeVertexNormals(); const me = new THREE.Mesh(g, mat); root.add(me); clickables.push(me);
      } else {
        const g = new THREE.PlaneGeometry(b[2] - b[0], b[3] - b[1]); g.rotateX(-Math.PI / 2);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b[2] - b[0]) / 2, uv.getY(i) * (b[3] - b[1]) / 2);
        const me = new THREE.Mesh(g, mat); me.position.set((b[0] + b[2]) / 2, f.y + (f.deco ? 0.02 : 0.03), (b[1] + b[3]) / 2); root.add(me);
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
      if (s.house) {                                    // פתחים, חלונות וסככות בד, מצוירים כלוחות
        const sides = s.shops ? [s.shops] : ['s', 'n'];
        for (const side of sides) {
          const alongX = side === 's' || side === 'n', len = alongX ? w : d, nS = Math.max(1, Math.floor(len / 9));
          const ry = side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2;
          const face = side === 's' ? b[3] + 0.03 : side === 'n' ? b[1] - 0.03 : side === 'e' ? b[2] + 0.03 : b[0] - 0.03;
          const out = (side === 's' || side === 'e') ? 1 : -1, gl = s.dys && s.dys[side] != null ? s.dys[side] : s.y0, hh = top - gl;
          for (let i = 0; i < nS; i++) {
            const u = (alongX ? b[0] : b[1]) + (i + 0.5) * len / nS;
            const P3 = (uu, y, off) => alongX ? [uu, y, face + off * out] : [face + off * out, y, uu];
            const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.1), M.wood); door.position.set.apply(door.position, P3(u, gl + 1.05, 0)); door.rotation.y = ry; root.add(door);
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), M.dark); win.position.set.apply(win.position, P3(u + 2.4, gl + Math.min(hh - 1.2, 3.2), 0)); win.rotation.y = ry; root.add(win);
            if (s.shops && hh < 7) {
              const aw = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.9), M.cloth([0xb5533c, 0xc9a24a, 0x6d7f8f, 0xd8c7a0][(i + Math.round(Math.abs(u))) % 4]));
              aw.position.set.apply(aw.position, P3(u, gl + 2.75, 0.85)); aw.rotation.order = 'YXZ'; aw.rotation.y = ry; aw.rotation.x = Math.PI / 2 - 0.42; root.add(aw);
            }
          }
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
  function sprite(key, w, h, cw, ch, draw) {
    let t = spriteCache[key];
    if (!t) { const c = document.createElement('canvas'); c.width = cw; c.height = ch; draw(c); t = spriteCache[key] = new THREE.CanvasTexture(c); t.anisotropy = 2; }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.25, fog: true }));
    sp.center.set(0.5, 0); sp.scale.set(w, h, 1); return sp;
  }
  function buildLife(M) {
    for (const p of W.people) {
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
    for (const a of W.animals) {
      if (!inPer(a)) continue;
      const f = floorAt(a.x, a.z, null); if (!f) continue;
      const GA = window.GerizimPeople;
      const sp = GA ? sprite('an' + a.kind, 2.18, 1.87, 192, 165, c => GA.drawAnimal(c, a.kind)) : sprite('an' + a.kind, 1.7, 1.33, 128, 100, c => drawAnimal(c, a.kind));
      sp.position.set(a.x, standY(f.f, a.x, a.z), a.z); root.add(sp);
    }
    const jar = (x, y, z, s) => { const pts = [[0, 0], [0.16, 0.02], [0.3, 0.3], [0.33, 0.55], [0.22, 0.82], [0.12, 0.9], [0.15, 1.0]].map(p => new THREE.Vector2(p[0] * s, p[1] * s)); const me = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), M.clay); me.position.set(x, y, z); root.add(me); };
    for (const p of W.props) {
      if (!inPer(p)) continue;
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
      if (p.kind === 'press') {                         // בית הבד: אגן ריסוק, אבן מתגלגלת, קורה ומשקולות
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.1, 0.55, 20), M.field); basin.position.set(x, y + 0.28, z); root.add(basin);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 16), M.field); wheel.rotation.z = Math.PI / 2; wheel.position.set(x + 0.5, y + 0.9, z); root.add(wheel);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 0.3), M.wood); beam.position.set(x - 6, y + 1.5, z + 3); beam.rotation.z = -0.07; root.add(beam);
        for (let i = 0; i < 3; i++) { const wt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), M.field); wt.position.set(x - 8.4 + i * 0.1, y + 0.35 + i * 0.01, z + 2.2 + i * 0.8); root.add(wt); }
        const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.4, 16), M.field); bed.position.set(x - 4.2, y + 0.2, z + 3); root.add(bed);
        for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0x8f7a45 })); b.position.set(x - 4.2, y + 0.46 + i * 0.11, z + 3); root.add(b); }
      }
    }
    // אבני הכתובות, במקום שבו נמצאה כל אחת: אבן גזית ועליה הנוסח, באותיות ממולאות צבע אדום
    insStones = [];
    if (period === 'h') for (const ins of (opts.inscr || [])) {
      if (!ins.walk) continue;
      const x = ins.walk[1], z = -ins.walk[0], f = canStandAny(x, z) || floorAt(x, z, pos.y); if (!f) continue;
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d');
      g.fillStyle = '#e4dcc8'; g.fillRect(0, 0, 512, 256); speckle(g, 1400, 0.12, ['#b7a888', '#fff', '#8f8266'], 512);
      g.strokeStyle = 'rgba(90,75,50,.6)'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 250);
      const lines = String(ins.text || '').split(/\n|\s*\/\s*/).filter(Boolean).slice(0, 4); const fs = lines.length > 2 ? 40 : 52;
      g.font = '600 ' + fs + 'px "Frank Ruhl Libre", David, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = ins.script === 'greek' ? 'ltr' : 'rtl';
      lines.forEach((ln, i) => { const y = 128 + (i - (lines.length - 1) / 2) * (fs + 8); g.fillStyle = 'rgba(60,20,10,.5)'; g.fillText(ln, 258, y + 2, 480); g.fillStyle = '#9a2d1e'; g.fillText(ln, 256, y, 480); });
      const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4;
      const side = M.ashlar, face = new THREE.MeshLambertMaterial({ map: tx, emissive: 0x2c2920 });
      const me = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.34), [side, side, side, side, face, face]);
      me.position.set(x, f.y + 0.75, z); me.rotation.y = (ins.no * 1.7) % 6.28; me.rotation.x = -0.12; root.add(me);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.5), M.field); base.position.set(x, f.y + 0.22, z); base.rotation.y = me.rotation.y; root.add(base);
      insStones.push({ ins, x, z });
    }
    // אש ועשן מעל המזבח
    for (const s of W.solids) {
      if (s.id !== 'altar' || !inPer(s)) continue;
      const ax = (s.box[0] + s.box[2]) / 2, az = (s.box[1] + s.box[3]) / 2, top = s.y0 + s.h;
      addSmoke(ax, top + 0.2, az, 1.6, 0xcfcac0); addSmoke(ax + 1, top + 0.2, az - 1, 1.3, 0xbdb8ae);
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.5, 8), new THREE.MeshBasicMaterial({ color: 0xff9a2e })); fire.position.set(ax, top + 0.7, az); root.add(fire);
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
    root = new THREE.Group(); scene.add(root); smoke = []; clickables = [];
    const M = build.M || (build.M = makeMaterials());
    buildTerrain(M); buildFloors(M); buildSolids(M); buildLife(M);
    marker = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2; marker.visible = false; root.add(marker);
  }
  function setup(cv) {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    scene = new THREE.Scene();
    const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
    const g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5f9bd0'); gr.addColorStop(0.5, '#a9cbe2'); gr.addColorStop(0.62, '#dfe3d6'); gr.addColorStop(1, '#d9d2bd');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(sky);
    scene.fog = new THREE.Fog(0xdcd8c6, 160, 760);
    scene.add(new THREE.HemisphereLight(0xfff6e4, 0xb9aa8c, 0.72));
    const sun = new THREE.DirectionalLight(0xfff1d6, 0.46); sun.position.set(-120, 220, 90); scene.add(sun);
    camera = new THREE.PerspectiveCamera(68, 1, 0.2, 6000); camera.rotation.order = 'YXZ';
    clock = new THREE.Clock();
    buildAvatar();
  }

  /* ---------- דמות ההולך: רואים אותה מאחור, מן הראש ועד מעט מתחת לכתפיים ----------
     היא מצוירת בשכבה משלה מעל הנוף, תמיד בתחתית המסך. כשהמבט פונה — הראש פונה תחילה, והגוף מתיישר אחריו. */
  let hud = null, hudCam = null, av = null, bodyYaw = null, showAvatar = true, avLift = 0, avFit = 1, avTick = 0;
  try { showAvatar = localStorage.getItem('gerizim-walker') !== '0'; } catch (e) { /* בלי אחסון — הדמות מוצגת */ }
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
    drawMini(true);
  }

  /* ---------- תנועה ---------- */
  function tryMove(dx, dz) {
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
      if (!mx && !mz) continue;
      const f = canStand(pos.x + mx, pos.z + mz, pos.y);
      if (f) { pos.x += mx; pos.z += mz; pos.y = f.y; return true; }
    }
    return false;
  }
  function step(dt) {
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
  function tick() {
    if (!active) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.06, clock.getDelta());
    step(dt);
    for (const s of smoke) {                              // העשן הוא הדבר היחיד שנע
      const u = s.userData; u.t = (u.t + dt * 0.11) % 1;
      s.position.set(u.x + Math.sin(u.t * 5 + u.x) * u.size * 0.8 * u.t + u.t * 3, u.y + u.t * 9 * u.size, u.z + u.t * 1.5);
      const k = u.size * (1 + u.t * 4.5); s.scale.set(k, k, 1); s.material.opacity = 0.5 * (1 - u.t);
    }
    renderer.render(scene, camera);
    if (showAvatar && hud) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(hud, hudCam); renderer.autoClear = true; }
    updateZone(); drawMini(false);
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
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 6) { down.moved = true; dragging = true; cv.classList.add('drag'); }
        if (down.moved) { const k = 0.0042; look.yaw = down.yaw - dx * k; look.pitch = Math.max(-1.1, Math.min(1.1, down.pitch + dy * k)); }
      } else if (e.pointerType === 'mouse') {             // עיגול על הקרקע, במקום שאליו אפשר ללכת
        const p = ray(e); const ok = p && canStandAny(p.x, p.z);
        if (ok && !target) { marker.position.set(p.x, ok.y + 0.06, p.z); marker.visible = true; } else if (!target) marker.visible = false;
      }
    });
    const up = e => {
      if (down && !down.moved) {
        const p = ray(e), f = p && canStandAny(p.x, p.z);
        if (f) { target = { x: p.x, z: p.z }; marker.position.set(p.x, f.y + 0.06, p.z); marker.visible = true; hideHint(); }
      }
      down = null; dragging = false; cv.classList.remove('drag');
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { down = null; dragging = false; });
    cv.addEventListener('wheel', e => { e.preventDefault(); camera.fov = Math.max(32, Math.min(84, camera.fov + (e.deltaY > 0 ? 3 : -3))); camera.updateProjectionMatrix(); }, { passive: false });
    window.addEventListener('keydown', e => { if (!active) return; if (e.code === 'Escape') return exit(); keys[e.code] = true; if (/^Arrow|^Key[WASD]$/.test(e.code)) { e.preventDefault(); hideHint(); } });
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
    // כשעומדים ליד אבן כתובת, הנוסח והתרגום שלה מוצגים
    let near = null, nd = 3.6;
    for (const s of insStones) { const dd = Math.hypot(s.x - pos.x, s.z - pos.z); if (dd < nd) { nd = dd; near = s.ins; } }
    if (near !== insShown) {
      insShown = near; const el = $('walkIns');
      if (near) { el.innerHTML = '<div class="insno"></div><div class="instx"></div><div class="instr"></div>'; el.children[0].textContent = (near.no != null ? (opts.insNo || '{n}').replace('{n}', near.no) : L(near.label)) + ' · ' + L(near.spot); el.children[1].textContent = near.text || ''; el.children[2].textContent = L(near.tr); }
      el.classList.toggle('on', !!near); if (near) $('walkInfo').classList.add('open');
    }
    const z = zoneAt(), id = z ? z.id : '';
    if (id === zoneId) return;
    zoneId = id;
    $('walkZone').textContent = z ? L(z.name) : '';
    $('walkText').textContent = z ? L(z.text) : '';
    $('walkMore').style.display = z && z.place && opts.onPlace ? '' : 'none';
    // תצלומים אמיתיים של המקום שבו עומדים, כפי שהוא נראה היום
    const ph = z && z.place && opts.photosOf ? opts.photosOf(z.place) : [], box = $('walkPhotos');
    box.innerHTML = ph.length ? '<div class="wpt">' + T('today') + '</div><div class="strip">' + ph.slice(0, 8).map((im, i) => '<button class="ph" data-i="' + i + '"><img loading="lazy" src="' + im.thumb + '" alt=""></button>').join('') + '</div>' : '';
    box.querySelectorAll('.ph').forEach(b => { b.onclick = e => { e.stopPropagation(); opts.onPhoto(ph, +b.dataset.i); }; });
    $('walkMore').onclick = () => { const p = z.place; exit(); opts.onPlace(p); };
  }
  let miniBase = null;
  const MK = 2;                                           // פיקסלים למטר בשרטוט המלא שממנו נגזר החלון
  function buildMiniBase() {
    const B = W.bounds, cw = Math.round((B[2] - B[0]) * MK), ch = Math.round((B[3] - B[1]) * MK);
    miniBase = document.createElement('canvas'); miniBase.width = cw; miniBase.height = ch;
    const g = miniBase.getContext('2d');
    g.fillStyle = '#f1e9d2'; g.fillRect(0, 0, cw, ch);
    const rect = (b, fill, stroke) => { const x = (b[0] - B[0]) * MK, y = (b[1] - B[1]) * MK, ww = (b[2] - b[0]) * MK, hh = (b[3] - b[1]) * MK; if (fill) { g.fillStyle = fill; g.fillRect(x, y, ww, hh); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.2; g.strokeRect(x, y, ww, hh); } };
    for (const f of W.floors) if (inPer(f) && !f.deco) rect(f.box, f.steps ? '#c9b98f' : (/^road|^eroad/.test(f.id) ? '#e8dfc6' : f.mat === 'pave' ? '#e3d7b6' : '#d9cba4'));
    for (const f of W.floors) if (inPer(f) && f.steps) {     // קווי מדרגות
      const b = f.box, r = f.ramp; g.strokeStyle = 'rgba(90,70,40,.55)'; g.lineWidth = 1;
      for (let i = 0; i <= 12; i++) { const v = r.a + (r.b - r.a) * i / 12; g.beginPath(); if (r.axis === 'x') { g.moveTo((v - B[0]) * MK, (b[1] - B[1]) * MK); g.lineTo((v - B[0]) * MK, (b[3] - B[1]) * MK); } else { g.moveTo((b[0] - B[0]) * MK, (v - B[1]) * MK); g.lineTo((b[2] - B[0]) * MK, (v - B[1]) * MK); } g.stroke(); }
    }
    for (const s of W.solids) if (inPer(s) && s.h > 0.5 && !s.shed) rect(s.box, s.id ? '#b8862e' : (s.house ? '#8a7a66' : '#3b3024'));
    const tpm = showTemple && W.temple[period];
    if (tpm) { g.setLineDash([5, 4]); rect(tpm.box, 'rgba(184,134,46,.25)', '#8a5a1c'); if (tpm.inner) rect(tpm.inner, null, '#8a5a1c'); g.setLineDash([]); }
  }
  function drawMini(force) {
    const cv = $('walkMini'); if (!cv) return;
    const w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (force || !miniBase) buildMiniBase();
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    // החלון: כ-95 מ' לכל צד מן ההולך (יותר כשהשרטוט מוגדל)
    const B = W.bounds, span = $('walkSide').classList.contains('big') ? 320 : 190, k = w / span, vh = h / k;
    const x0 = pos.x - span / 2, z0 = pos.z - vh / 2;
    drawMini.inv = (px, pz) => [x0 + px / k, z0 + pz / k];
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#e9e0c6'; g.fillRect(0, 0, w, h);
    g.drawImage(miniBase, (x0 - B[0]) * MK, (z0 - B[1]) * MK, span * MK, vh * MK, 0, 0, w, h);
    const a = look.yaw, cx = w / 2, cy = h / 2;
    g.fillStyle = 'rgba(200,40,30,.22)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 30, a - Math.PI / 2 - 0.55, a - Math.PI / 2 + 0.55); g.closePath(); g.fill();
    g.fillStyle = '#c8281e'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 4.5, 0, 6.3); g.fill(); g.stroke();
    // חץ צפון: המתחם נוטה מן הצפון, ולכן גם החץ
    g.save(); g.translate(w - 15, 17); g.rotate(-(W.north || 0) * Math.PI / 180);
    g.fillStyle = 'rgba(241,233,210,.85)'; g.beginPath(); g.arc(0, 2, 13, 0, 6.3); g.fill();
    g.fillStyle = '#3b3024'; g.beginPath(); g.moveTo(0, -9); g.lineTo(-4.5, 4); g.lineTo(4.5, 4); g.closePath(); g.fill();
    g.font = '600 8px sans-serif'; g.textAlign = 'center'; g.fillText('N', 0, 12.5); g.restore();
    // קנה מידה
    g.fillStyle = '#3b3024'; g.fillRect(8, h - 9, 50 * k, 2); g.font = '9px sans-serif'; g.textAlign = 'left'; g.fillText('50 m', 8, h - 12);
  }
  function hideHint() { const h = $('walkHint'); if (h) h.classList.add('gone'); }

  /* ---------- הממשק ---------- */
  function dom() {
    const el = $('walk');
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    el.innerHTML = '<canvas id="walkCv"></canvas>' +
      '<div id="walkTop"><button id="walkExit"></button><div id="walkPer"><button data-p="h"></button><button data-p="p"></button></div>' +
      '<label id="walkTempleL"><input type="checkbox" id="walkTemple"><span></span></label>' +
      '<label id="walkAvL"><input type="checkbox" id="walkAv"><span></span></label></div>' +
      '<div id="walkSide"><div id="walkMiniT"></div><canvas id="walkMini"></canvas></div>' +
      '<div id="walkInfo"><div id="walkHere"></div><h3 id="walkZone"></h3><p id="walkText"></p><div id="walkIns"></div><div id="walkPhotos"></div><button id="walkMore"></button><div id="walkNote"></div></div>' +
      '<div id="walkPad"><button data-h="left" aria-label="">◀</button><div><button data-h="fwd">▲</button><button data-h="back">▼</button></div><button data-h="right">▶</button></div>' +
      '<div id="walkHint"></div><div id="walkLoad"></div>';
    $('walkExit').onclick = exit;
    el.querySelectorAll('#walkPer button').forEach(b => { b.onclick = () => setPeriod(b.dataset.p); });
    $('walkTemple').onchange = e => { showTemple = e.target.checked; rebuild(); };
    $('walkAv').checked = showAvatar;
    $('walkAv').onchange = e => { showAvatar = e.target.checked; try { localStorage.setItem('gerizim-walker', showAvatar ? '1' : '0'); } catch (x) { /* בלי אחסון */ } };
    el.querySelectorAll('#walkPad button').forEach(b => {
      const k = b.dataset.h, on = e => { e.preventDefault(); hold[k] = true; hideHint(); }, off = () => { hold[k] = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    $('walkMini').addEventListener('click', e => {       // לחיצה על המפה הקטנה מעבירה לשם
      const r = e.currentTarget.getBoundingClientRect(), q = drawMini.inv(e.clientX - r.left, e.clientY - r.top), f = canStandAny(q[0], q[1]);
      if (f) { pos.x = q[0]; pos.z = q[1]; pos.y = f.y; target = null; camera.position.y = pos.y + EYE; }
    });
    $('walkInfo').addEventListener('click', e => { if (e.target.id !== 'walkMore' && !e.target.closest('.ph')) $('walkInfo').classList.toggle('open'); });
    $('walkSide').addEventListener('click', e => { if (e.target.id === 'walkMiniT') { $('walkSide').classList.toggle('big'); drawMini(false); } });
  }
  function texts() {
    $('walkExit').textContent = T('exit');
    const pb = $('walkPer').querySelectorAll('button'); pb[0].textContent = T('hel'); pb[1].textContent = T('per');
    pb.forEach(b => b.classList.toggle('on', b.dataset.p === period));
    $('walkTempleL').querySelector('span').textContent = T('temple'); $('walkAvL').querySelector('span').textContent = T('walker');
    $('walkHere').textContent = T('here'); $('walkMore').textContent = T('more'); $('walkNote').textContent = T('note');
    $('walkHint').textContent = T('hint'); $('walkMiniT').textContent = T('map'); $('walk').dir = lang === 'en' ? 'ltr' : 'rtl';
    const pad = $('walkPad').querySelectorAll('button'); ['left', 'fwd', 'back', 'right'].forEach((k, i) => pad[i].setAttribute('aria-label', T(k)));
  }
  function place(st) {
    const s = W.starts[st] || W.starts.plaza, f = canStandAny(s.x, s.z) || { y: 0 };
    pos.x = s.x; pos.z = s.z; pos.y = f.y; look.yaw = s.yaw; look.pitch = 0; target = null; bodyYaw = null;
    if (camera) camera.position.set(pos.x, pos.y + EYE, pos.z);
  }
  function rebuild() { build(); miniBase = null; zoneId = null; texts(); if (!canStandAny(pos.x, pos.z)) place('plaza'); drawMini(true); }
  function setPeriod(p) { if (p === period) return; period = p; rebuild(); }

  function enter(o) {
    opts = o || {}; lang = opts.lang || 'he';
    const el = $('walk'); dom(); texts();
    el.classList.add('open'); $('walkLoad').textContent = T('loading'); $('walkLoad').style.display = 'flex';
    return loadThree().then(T3 => {
      THREE = T3;
      if (!renderer) { setup($('walkCv')); bind($('walkCv')); }
      period = opts.period || period;
      if (opts.start !== 'plaza') period = 'h';
      build(); texts(); place(opts.start || 'stairs');
      active = true; resize(); zoneId = null; clock.getDelta(); cancelAnimationFrame(raf); tick();
      $('walkLoad').style.display = 'none'; $('walkHint').classList.remove('gone');
      setTimeout(hideHint, 9000);
    }).catch(() => { $('walkLoad').textContent = T('fail'); setTimeout(exit, 2600); });
  }
  function exit() {
    active = false; cancelAnimationFrame(raf); keys = {}; hold = {};
    $('walk').classList.remove('open');
    if (opts.onExit) opts.onExit();
  }
  window.GerizimWalk = { enter, exit, get active() { return active; }, _state: () => ({ pos, look, period, zoneId, walker: av && { on: showAvatar, headYaw: av.head.rotation.y, headPitch: av.head.rotation.x, y: av.position.y, scale: av.scale.x } }) };
})();
