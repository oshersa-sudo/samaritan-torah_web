/* התיאור החזותי של סיפורי המטיילים: דברי המספר על מצב האזור הופכים להדמיה על גבי התבליט האמיתי.
   הצילום מתעמעם לגוון של תקופה, וצורות פשוטות קמות במקומן — חורבות, בתים, כיפות, עצים, אוהלים, עדרים —
   לפי מה שהמספר מתאר, והמצלמה עוברת מרגע לרגע בסיפור כשדבריו מוצגים.
   הנתונים: story_scenes.js (נבנה בידי tools/build_scenes.py, נטען רק כשמבקשים) ו-scene_state.js (מצב האזור, בכרטיסים).
   הכול להמחשה: המקומות בקירוב, והצורות סכמטיות. */
(function () {
  'use strict';
  const A = window.GerizimTourAPI;
  if (!A) return;
  const map = A.map, esc = A.esc, byId = A.byId;
  const $ = id => document.getElementById(id);
  let lang = A.lang();

  const TX = {
    he: { title: 'תיאור חזותי', state: 'מצב האזור בעיני המספר', close: 'סגירה', prev: 'הרגע הקודם', next: 'הרגע הבא', play: 'הפעלה', pause: 'עצירה',
      loading: 'בונה את ההדמיה…', fail: 'ההדמיה לא נטענה. בדקו את החיבור לרשת ונסו שוב.', count: 'רגע {i} מתוך {n}', back: '↩ חזרה לסיפור',
      note: 'הדמיה להמחשה לפי דברי המספר, על דגם התבליט האמיתי: המקומות בקירוב, והצורות סכמטיות.', model: 'דגם', photo: 'צילום של היום' },
    en: { title: 'Visual description', state: 'The area as the narrator saw it', close: 'Close', prev: 'Previous moment', next: 'Next moment', play: 'Play', pause: 'Pause',
      loading: 'Building the scene…', fail: 'The scene could not be loaded. Check your connection and try again.', count: 'Moment {i} of {n}', back: '↩ Back to the story',
      note: 'An illustration after the narrator’s words, on a model of the real relief: places are approximate and shapes are schematic.', model: 'Model', photo: 'Today’s photo' },
    ar: { title: 'وصف مرئي', state: 'حال المنطقة كما رآها الراوي', close: 'إغلاق', prev: 'اللحظة السابقة', next: 'اللحظة التالية', play: 'تشغيل', pause: 'إيقاف',
      loading: 'جارٍ بناء المشهد…', fail: 'تعذّر تحميل المشهد. تحقّق من الاتصال وحاول ثانية.', count: 'اللحظة {i} من {n}', back: '↩ العودة إلى القصة',
      note: 'تصوير توضيحي بحسب كلام الراوي، على مجسّم للتضاريس الحقيقية: المواضع تقريبية والأشكال تخطيطية.', model: 'مجسّم', photo: 'صورة اليوم' }
  };
  const T = k => (TX[lang] || TX.he)[k];
  const L = v => (v && (v[lang] || v.he || v.en)) || '';
  const SST = window.GERIZIM_SCENE_STATE || {};

  /* ---------- טעינה ---------- */
  let SC = window.GERIZIM_SCENES || null, loading = null;
  function load() {
    if (SC) return Promise.resolve(SC);
    if (loading) return loading;
    const me = [...document.scripts].find(s => /(^|\/)scenes\.js/.test(s.getAttribute('src') || ''));
    const v = me && (me.getAttribute('src').match(/\?v=([^&]+)/) || [])[1];
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'story_scenes.js' + (v ? '?v=' + v : '');
      s.onload = () => { SC = window.GERIZIM_SCENES || null; SC ? res(SC) : rej(new Error('empty')); };
      s.onerror = () => { loading = null; rej(new Error('load')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  /* ---------- גאומטריה: מטרים מזרחה וצפונה ממקום נתון ---------- */
  const M = 111320;
  const ll = (c, e, n) => [c[0] + e / (M * Math.cos(c[1] * Math.PI / 180)), c[1] + n / M];
  function rect(c, x, y, w, d, rot) {
    const a = (rot || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    const r = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => ll(c, x + u * co - v * si, y + u * si + v * co));
    r.push(r[0]); return [r];
  }
  function circ(c, x, y, r, seg, jit, rnd) {
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const a = i / seg * 2 * Math.PI, rr = r * (1 + (jit ? (rnd() - 0.5) * jit : 0));
      pts.push(ll(c, x + rr * Math.cos(a), y + rr * Math.sin(a)));
    }
    pts.push(pts[0]); return [pts];
  }
  // מספרים אקראיים קבועים: אותה סצנה נבנית תמיד באותה צורה
  function rng(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    let a = h >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16), k = 1 + f;
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }
  const COL = { stone: '#cdbf9f', white: '#f1ece0', dark: '#5d4f3e', mud: '#a98d68', red: '#a8553f' };
  const col = (c, rnd, j) => shade(COL[c] || COL.stone, ((rnd ? rnd() : 0.5) - 0.5) * (j == null ? 0.16 : j));
  const inDisc = (rnd, r, p) => { const rad = r * Math.pow(rnd(), p || 0.5), a = rnd() * 2 * Math.PI; return [rad * Math.cos(a), rad * Math.sin(a)]; };

  /* ---------- מן האביזר אל הצורות ---------- */
  // solid: גוף תלת-ממדי (בסיס, גובה, צבע); flat: משטח צבוע על הקרקע; line: קו; mk: סימן HTML (דמויות, עדר, אש, מערה)
  function build(p, sid, season) {
    const out = { solid: [], flat: [], line: [], mk: [] };
    const base = p.off ? ll(p.c0, p.off[0], p.off[1]) : p.c0;
    const rnd = rng(sid + '|' + p.k + '|' + base.join(','));
    const S = (g, b, h, c) => out.solid.push({ g, b, h, c });
    const F = (g, c, o) => out.flat.push({ g, c, o: o == null ? 0.6 : o });
    const n = p.n, r = p.r, h = p.h;
    const dome = (x, y, R, h0, c) => {
      S(circ(base, x, y, R * 0.95, 14), h0, h0 + 0.5, c);
      for (let k = 1; k <= 5; k++) {
        const a0 = (k - 1) / 5 * Math.PI / 2, a1 = k / 5 * Math.PI / 2;
        S(circ(base, x, y, R * 0.92 * Math.cos((a0 + a1) / 2), 14), h0 + 0.5 + R * Math.sin(a0), h0 + 0.5 + R * Math.sin(a1), c);
      }
    };
    const minaret = (x, y, H) => {
      const c = COL.white;
      S(circ(base, x, y, 1.6, 8), 0, H - 4, c);
      S(circ(base, x, y, 2.4, 8), H - 4, H - 3.4, c);
      S(circ(base, x, y, 1.1, 8), H - 3.4, H, c);
      S(circ(base, x, y, 0.6, 8), H, H + 2, '#b9ad94');
    };
    switch (p.k) {
      case 'ruins':
        for (let i = 0; i < (n || 12); i++) {
          const [x, y] = inDisc(rnd, r || 30);
          if (rnd() < 0.62) S(rect(base, x, y, 2 + rnd() * 6, 0.9 + rnd() * 0.6, rnd() * 180), 0, 0.4 + rnd() * (h || 2), col('stone', rnd, 0.22));
          else S(circ(base, x, y, 1 + rnd() * 1.6, 6, 0.45, rnd), 0, 0.3 + rnd() * 0.8, col('stone', rnd, 0.28));
        }
        break;
      case 'building':
        S(rect(base, 0, 0, p.w || 10, p.d || 10, p.rot), 0, h || 6, col(p.c || 'stone', rnd, 0.06));
        break;
      case 'dome': {
        const R = r || 4, H = h || 4;
        S(rect(base, 0, 0, 2 * R + 1, 2 * R + 1, 0), 0, H, col(p.c || 'white', rnd, 0.04));
        dome(0, 0, R, H, col(p.c || 'white', rnd, 0.04));
        break;
      }
      case 'tower':
        S(rect(base, 0, 0, p.w || 6, p.w || 6, 0), 0, h || 10, col(p.c || 'stone', rnd, 0.06));
        break;
      case 'wall': {
        const pa = p.path || [], W = p.w || 1.5;
        for (let i = 1; i < pa.length; i++) {
          const [x0, y0] = pa[i - 1], [x1, y1] = pa[i], len = Math.hypot(x1 - x0, y1 - y0);
          if (len > 0) S(rect(base, (x0 + x1) / 2, (y0 + y1) / 2, len + W, W, Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI), 0, h || 4, col(p.c || 'stone', rnd, 0.08));
        }
        break;
      }
      case 'village': case 'town': {
        const town = p.k === 'town', R = r || (town ? 400 : 120), N = Math.max(n || 0, town ? Math.round(R * 0.45) : 20), turn = rnd() * 90;
        for (let i = 0; i < N; i++) {
          const [x, y] = inDisc(rnd, R, town ? 0.72 : 0.6);
          S(rect(base, x, y, (town ? 9 : 7) + rnd() * 7, 8 + rnd() * 6, turn + (rnd() - 0.5) * 30), 0, (town ? 6 : 4) + rnd() * (town ? 6 : 3), col('stone', rnd, 0.22));
        }
        if (town) {
          S(rect(base, 0, 0, 22, 32, turn), 0, 9, COL.stone);
          dome(0, 6, 7, 9, COL.white);
          for (let i = 0; i < (p.minarets == null ? 2 : p.minarets); i++) { const [x, y] = inDisc(rnd, R * 0.45); minaret(x, y, 20 + rnd() * 6); }
        } else {
          const [x, y] = inDisc(rnd, R * 0.4);
          S(rect(base, x, y, 7, 7, turn), 0, 4, COL.white); dome(x, y, 3, 4, COL.white);
        }
        break;
      }
      case 'minaret':
        minaret(0, 0, h || 18);
        break;
      case 'trees': {
        const sp = p.sp || 'olive', N = n || 20, R = r || 60, bare = season === 'winter' && /fig|mulberry|orchard/.test(sp);
        const put = (x, y) => {
          const tr = '#5b4630';
          if (sp === 'palm') { S(circ(base, x, y, 0.35, 6), 0, 8, tr); S(circ(base, x, y, 2.6, 9, 0.7, rnd), 7.4, 8.7, '#6e9a3e'); return; }
          if (sp === 'cypress') { S(circ(base, x, y, 0.95, 7), 0, 9 + rnd() * 3, '#2f4a2a'); return; }
          const D = { olive: [2.2, 1.2, 3.6, '#8b9566'], fig: [2.6, 0.9, 3.8, '#5d8a3a'], pine: [3.1, 3.6, 9, '#3e5e35'], oak: [4, 1.6, 6.5, '#4e6b36'],
            terebinth: [3.6, 1.4, 5.8, '#58703a'], orchard: [1.9, 0.8, 3.4, '#6f9b48'], mulberry: [3, 1.2, 5, '#5a8a3c'] }[sp] || [2.2, 1.2, 3.6, '#8b9566'];
          S(rect(base, x, y, 0.5, 0.5, 0), 0, D[1] + 0.3, tr);
          S(circ(base, x, y, D[0] * (0.8 + rnd() * 0.4) * (bare ? 0.7 : 1), 7, 0.35, rnd), D[1], D[2] + rnd(), bare ? '#8a7a62' : shade(D[3], (rnd() - 0.5) * 0.18));
        };
        if (sp === 'orchard') {                              // מטע: שורות סדורות
          const step = 6, side = Math.max(step, Math.sqrt(N) * step);
          for (let x = -side / 2; x <= side / 2; x += step) for (let y = -side / 2; y <= side / 2; y += step) if (Math.hypot(x, y) <= Math.max(R, side / 2)) put(x + (rnd() - 0.5), y + (rnd() - 0.5));
        } else for (let i = 0; i < N; i++) { const [x, y] = inDisc(rnd, R); put(x, y); }
        break;
      }
      case 'field': {
        const C = { wheat: season === 'summer' || season === 'autumn' ? '#d8c27a' : '#a9b85e', green: '#86b05a', plowed: '#9a7754', garden: '#6f9e4e' }[p.c || 'wheat'] || '#a9b85e';
        F(circ(base, 0, 0, r || 100, 16, 0.3, rnd), C, 0.55);
        break;
      }
      case 'water': {
        const R = r || 4;
        S(circ(base, 0, 0, R, 16), 0, 0.35, '#3f8fc4');
        for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * Math.PI; S(rect(base, (R + 0.5) * Math.cos(a), (R + 0.5) * Math.sin(a), 2 * Math.PI * R / 12 + 0.4, 0.8, a * 180 / Math.PI + 90), 0, 0.6, COL.stone); }
        break;
      }
      case 'stream':
        out.line.push({ g: (p.path || []).map(q => ll(base, q[0], q[1])), c: '#4aa3df', w: 3.6, dash: 0 });
        break;
      case 'path':
        out.line.push({ g: (p.path || []).map(q => ll(base, q[0], q[1])), c: p.c === 'road' ? '#e7d7ae' : '#f1e5c6', w: p.c === 'road' ? 4 : 2.2, dash: p.c === 'road' ? 0 : 1 });
        break;
      case 'tents': {
        const c = p.c === 'dark' ? '#3a3028' : '#f3efe6';
        for (let i = 0; i < (n || 10); i++) {
          const [x, y] = inDisc(rnd, r || 30), rot = rnd() * 180;
          S(rect(base, x, y, 3.4, 4.6, rot), 0, 1.4, c); S(rect(base, x, y, 2.3, 4.4, rot), 1.4, 2.2, c); S(rect(base, x, y, 1, 4.2, rot), 2.2, 2.7, shade(c, -0.06));
        }
        break;
      }
      case 'stones':
        for (let i = 0; i < (n || 12); i++) {
          const per = 4, row = Math.floor(i / per), k = i % per, sp = Math.max(2.2, (r || 6) / 2);
          S(rect(base, (k - (per - 1) / 2) * sp + (rnd() - 0.5) * 0.4, (row - 1) * sp * 0.8, 1.7, 1.05, (rnd() - 0.5) * 14), 0, 0.55, '#d8ceb6');
        }
        break;
      case 'rock':
        S(circ(base, 0, 0, r || 5, 9, 0.38, rnd), 0, 0.7, '#bbb09a');
        break;
      case 'well':
        S(circ(base, 0, 0, 1.5, 12), 0, 0.9, COL.stone); S(circ(base, 0, 0, 0.9, 12), 0, 0.92, '#23465f');
        break;
      case 'people': case 'flock': case 'fire': case 'cave':
        out.mk.push({ k: p.k, at: base, n: n || (p.k === 'flock' ? 12 : p.k === 'people' ? 6 : 1), kind: p.kind, r: r, seed: rnd });
        break;
    }
    return out;
  }

  /* ---------- סימני HTML: דמויות, בעלי חיים, אש ומערה ---------- */
  const FIG = { priest: ['#f4f1ea', '#b2332b'], pilgrim: ['#d9c7a0', '#efe7d6'], villager: ['#8a6a45', '#f1ece0'], soldier: ['#5a6a3a', '#3b3b30'],
    shepherd: ['#7a5a3a', '#e9e2d2'], traveller: ['#2f3140', '#2b2620'], women: ['#3b4a7a', '#f1ece0'] };
  const person = k => { const [b, hd] = FIG[k] || FIG.villager;
    return '<svg viewBox="0 0 10 22" width="8" height="17"><circle cx="5" cy="3.3" r="2.7" fill="' + hd + '" stroke="#1a140c" stroke-width=".6"/><path d="M1.3 21 L2.5 7.2 Q5 5.8 7.5 7.2 L8.7 21 Z" fill="' + b + '" stroke="#1a140c" stroke-width=".6"/></svg>'; };
  const ANI = { sheep: '#f2efe6', goats: '#2d2622', camels: '#c9a36a', horses: '#7a4e2e', donkeys: '#8e8780', cattle: '#8a5a3a' };
  const animal = k => { const c = ANI[k] || ANI.sheep, hump = k === 'camels' ? '<ellipse cx="7" cy="2.6" rx="3" ry="2.2" fill="' + c + '"/>' : '';
    return '<svg viewBox="0 0 18 12" width="' + (k === 'camels' || k === 'horses' ? 17 : 13) + '" height="' + (k === 'camels' || k === 'horses' ? 12 : 9) + '">' + hump +
      '<ellipse cx="8" cy="5.4" rx="6" ry="3.4" fill="' + c + '" stroke="#1a140c" stroke-width=".6"/><circle cx="14.6" cy="3.8" r="2" fill="' + (k === 'sheep' ? '#3a332c' : c) + '" stroke="#1a140c" stroke-width=".5"/>' +
      '<rect x="4" y="8" width="1.3" height="3.6" fill="#2a221b"/><rect x="10.5" y="8" width="1.3" height="3.6" fill="#2a221b"/></svg>'; };
  function marker(m) {
    const el = document.createElement('div');
    el.className = 'scmk sc-' + m.k;
    if (m.k === 'people' || m.k === 'flock') {
      const N = Math.min(m.n, 40), W = Math.max(26, Math.round(Math.sqrt(N) * (m.k === 'flock' ? 15 : 11))), H = Math.round(W * 0.62);
      el.style.width = W + 'px'; el.style.height = H + 'px';
      let h = '';
      for (let i = 0; i < N; i++) h += '<i style="left:' + Math.round(m.seed() * (W - 14)) + 'px;top:' + Math.round(m.seed() * (H - 14)) + 'px">' + (m.k === 'people' ? person(m.kind) : animal(m.kind || 'sheep')) + '</i>';
      el.innerHTML = '<div class="scin" style="width:' + W + 'px;height:' + H + 'px">' + h + '</div>';
    } else if (m.k === 'fire') el.innerHTML = '<div class="scin"><b>🔥</b><s></s><s></s><s></s></div>';
    else el.innerHTML = '<div class="scin"><svg viewBox="0 0 20 14" width="22" height="15"><path d="M1 14 Q1 2 10 1 Q19 2 19 14 Z" fill="#6d5f4c" stroke="#2a2118"/><path d="M5 14 Q5 6 10 5.4 Q15 6 15 14 Z" fill="#120d08"/></svg></div>';
    return new maplibregl.Marker({ element: el, anchor: m.k === 'fire' || m.k === 'cave' ? 'bottom' : 'center' }).setLngLat(m.at);
  }

  /* ---------- השכבות שעל המפה ---------- */
  const EMPTY = { type: 'FeatureCollection', features: [] };
  function ensureLayers() {
    if (map.getSource('sc-solid')) return;
    const B = A.C, sz = 0.3;
    map.addSource('sc-wash', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[B[0] - sz, B[1] - sz], [B[0] + sz, B[1] - sz], [B[0] + sz, B[1] + sz], [B[0] - sz, B[1] + sz], [B[0] - sz, B[1] - sz]]] } } });
    ['sc-flat', 'sc-line', 'sc-solid'].forEach(id => map.addSource(id, { type: 'geojson', data: EMPTY }));
    // דגם התבליט: הצילום של היום מתכסה בגוון אדמה, וההר מצויר בצל ואור מנתוני הגובה — כך הבנייה של ימינו נעלמת, והתבליט נשאר
    const dem = map.getStyle().sources.dem;
    if (dem) map.addSource('sc-dem', Object.assign({}, dem));
    map.addLayer({ id: 'sc-wash', type: 'fill', source: 'sc-wash', layout: { visibility: 'none' }, paint: { 'fill-color': '#cdb68b', 'fill-opacity': 0.84 } });
    if (dem) map.addLayer({ id: 'sc-hill', type: 'hillshade', source: 'sc-dem', layout: { visibility: 'none' },
      paint: { 'hillshade-shadow-color': '#4e3d29', 'hillshade-highlight-color': '#fff6e2', 'hillshade-accent-color': '#6e5638', 'hillshade-exaggeration': 0.62, 'hillshade-illumination-direction': 315 } });
    map.addLayer({ id: 'sc-flat', type: 'fill', source: 'sc-flat', layout: { visibility: 'none' }, paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['get', 'o'] } });
    map.addLayer({ id: 'sc-line', type: 'line', source: 'sc-line', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'c'], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, ['*', ['get', 'w'], 0.5], 16, ['get', 'w'], 18, ['*', ['get', 'w'], 2.4]] } });
    map.addLayer({ id: 'sc-solid', type: 'fill-extrusion', source: 'sc-solid', layout: { visibility: 'none' },
      paint: { 'fill-extrusion-color': ['get', 'c'], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.98, 'fill-extrusion-vertical-gradient': true } });
  }
  const LAYERS = ['sc-wash', 'sc-hill', 'sc-flat', 'sc-line', 'sc-solid'];
  // מעבר בין הדגם ובין הצילום של היום, כדי להשוות
  let photo = false;
  function base() {
    if (!map.getLayer('sc-wash')) return;
    map.setPaintProperty('sc-wash', 'fill-opacity', photo ? 0.14 : 0.84);
    if (map.getLayer('sc-hill')) map.setLayoutProperty('sc-hill', 'visibility', cur && !photo ? 'visible' : 'none');
    $('scBase').textContent = photo ? '◧ ' + T('model') : '◨ ' + T('photo');
    $('scBase').setAttribute('aria-pressed', photo ? 'true' : 'false');
  }
  let mks = [];
  function draw(id, s) {
    ensureLayers();
    const solid = [], flat = [], line = [];
    mks.forEach(m => m.remove()); mks = [];
    s.beats.forEach(b => (b.props || []).forEach(p => {
      const o = build(p, id, s.season);
      o.solid.forEach(q => solid.push({ type: 'Feature', properties: { b: q.b, h: q.h, c: q.c }, geometry: { type: 'Polygon', coordinates: q.g } }));
      o.flat.forEach(q => flat.push({ type: 'Feature', properties: { c: q.c, o: q.o }, geometry: { type: 'Polygon', coordinates: q.g } }));
      o.line.forEach(q => { if (q.g.length > 1) line.push({ type: 'Feature', properties: { c: q.c, w: q.w }, geometry: { type: 'LineString', coordinates: q.g } }); });
      o.mk.forEach(m => mks.push(marker(m).addTo(map)));
    }));
    map.getSource('sc-solid').setData({ type: 'FeatureCollection', features: solid });
    map.getSource('sc-flat').setData({ type: 'FeatureCollection', features: flat });
    map.getSource('sc-line').setData({ type: 'FeatureCollection', features: line });
    LAYERS.forEach(l => { if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', 'visible'); });
    base();
    scaleMk();
  }
  function clear() {
    mks.forEach(m => m.remove()); mks = [];
    LAYERS.forEach(l => { if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', 'none'); });
    if (dot) { dot.remove(); dot = null; }
  }
  // הדמויות ובעלי החיים קטנים כשמתרחקים
  function scaleMk() { document.documentElement.style.setProperty('--scz', Math.max(0.4, Math.min(1.35, Math.pow(2, map.getZoom() - 16.6))).toFixed(3)); }
  map.on('zoom', () => { if (cur) scaleMk(); });

  /* ---------- מצב רוח: השמיים והגוון לפי שעת היום שבסיפור ---------- */
  const LOOK = { sat: -0.62, con: -0.06, bmin: 0.06, bmax: 0.93, hue: 0 };
  const MOOD = {
    day: [LOOK, null],
    morning: [Object.assign({}, LOOK, { bmax: 0.9 }), { 'sky-color': '#a9c3df', 'horizon-color': '#f3d7aa', 'fog-color': '#efe1c8' }],
    evening: [Object.assign({}, LOOK, { bmax: 0.78, bmin: 0.04 }), { 'sky-color': '#7f8fb5', 'horizon-color': '#eaa36b', 'fog-color': '#d9b48f' }],
    night: [Object.assign({}, LOOK, { bmax: 0.5, bmin: 0, sat: -0.75 }), { 'sky-color': '#16203a', 'horizon-color': '#3b4566', 'fog-color': '#2b3148' }],
    haze: [Object.assign({}, LOOK, { con: -0.18, bmin: 0.14 }), { 'sky-color': '#c9cfd3', 'horizon-color': '#e4e2dc', 'fog-color': '#e7e4dd', 'fog-ground-blend': 0.6 }]
  };

  /* ---------- הלוח ---------- */
  const box = document.createElement('div');
  box.id = 'scene'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-labelledby', 'scTitle');
  box.innerHTML = '<div class="sctop"><b id="scTitle"></b><span id="scCount"></span><button id="scBase" class="scbase"></button><button id="scX">✕</button></div><div id="scBody"></div>' +
    '<div class="scnav"><button id="scPrev">‹</button><button id="scPlay">▶</button><button id="scNext">›</button></div>';
  document.body.appendChild(box);
  let cur = null, at = 0, playing = false, timer = 0, from = null, dot = null;
  const TRAVEL = () => window.GERIZIM_TRAVEL || [];
  function who(id) { const e = TRAVEL().find(x => x.id === id); return e ? L(e.writer) + (e.visit_year || e.pub_year ? ' · ' + (e.visit_year || e.pub_year) : '') : ''; }
  function placeName(b) {
    if (typeof b.at === 'string' && byId[b.at]) return L(byId[b.at].name);
    return '';
  }
  function texts() {
    if (!cur) return;
    const s = SC[cur], b = s.beats[at];
    box.dir = lang === 'en' ? 'ltr' : 'rtl';
    $('scTitle').innerHTML = '<span class="scpre">' + esc(T('title')) + ' · </span>' + esc(who(cur));
    $('scCount').textContent = T('count').replace('{i}', at + 1).replace('{n}', s.beats.length);
    $('scX').setAttribute('aria-label', T('close')); $('scPrev').setAttribute('aria-label', T('prev')); $('scNext').setAttribute('aria-label', T('next'));
    base();
    $('scPlay').textContent = playing ? '❚❚' : '▶'; $('scPlay').setAttribute('aria-label', T(playing ? 'pause' : 'play'));
    const pn = placeName(b);
    $('scBody').innerHTML = (at === 0 && SST[cur] ? '<div class="scstate"><b>' + esc(T('state')) + '</b><p>' + esc(L(SST[cur])) + '</p></div>' : '') +
      (pn ? '<div class="scplace">📍 ' + esc(pn) + '</div>' : '') +
      '<blockquote class="scq" dir="auto">' + esc(L(b.q)) + '</blockquote>' +
      (at === s.beats.length - 1 && from === 'story' ? '<button class="scback" id="scBack">' + esc(T('back')) + '</button>' : '') +
      '<p class="scnote">' + esc(T('note')) + '</p>';
    if ($('scBack')) $('scBack').onclick = () => stop();
    $('scBody').scrollTop = 0;
    if (dot) dot.getElement().innerHTML = pn ? '<span>' + esc(pn) + '</span>' : '';
  }
  function camFor(b) {
    const c = b.off ? ll(b.c, b.off[0], b.off[1]) : b.c, C = A.C;
    const dE = (c[0] - C[0]) * M * Math.cos(C[1] * Math.PI / 180), dN = (c[1] - C[1]) * M, d = Math.hypot(dE, dN);
    const v = b.view || {};
    // רגע שיש בו מה לראות — המצלמה קרובה מספיק כדי שהצורות ייקראו; רגע של נוף בלבד נשאר רחב
    const has = (b.props || []).some(p => p.k !== 'path' && p.k !== 'stream');
    let zoom = v.zoom != null ? v.zoom : d < 700 ? 16.8 : d < 5000 ? 15.9 : 13.2;
    if (has) zoom = Math.max(zoom, (b.props || []).some(p => p.k === 'town' || (p.r || 0) > 250) ? 15.4 : 16.2);
    // מקום שמחוץ לפסגה נראה מכיוון ההר: המצלמה עומדת בין הפסגה ובינו ומביטה אליו
    const bearing = v.bearing != null ? v.bearing : d < 700 ? map.getBearing() : Math.atan2(dE, dN) * 180 / Math.PI;
    return { c, zoom, pitch: v.pitch != null ? v.pitch : 62, bearing };
  }
  function go(i) {
    const s = SC[cur]; if (!s) return;
    const n = s.beats.length; at = Math.max(0, Math.min(n - 1, i));
    clearTimeout(timer);
    const b = s.beats[at], cam = camFor(b);
    if (!dot) { const el = document.createElement('div'); el.className = 'stdot scdot'; dot = new maplibregl.Marker({ element: el }).setLngLat(cam.c).addTo(map); }
    dot.setLngLat(cam.c);
    texts();
    A.finger(cam.c, 48);
    map.flyTo({ center: cam.c, zoom: Math.min(cam.zoom, map.getMaxZoom()), pitch: cam.pitch, bearing: cam.bearing, padding: A.padFor(box), duration: 2800, essential: true, curve: 1.3 });
    if (playing) map.once('moveend', () => {
      if (!playing || !cur) return;
      const len = L(b.q).length + (at === 0 && SST[cur] ? L(SST[cur]).length : 0);
      timer = setTimeout(() => { if (!playing || !cur) return; if (at < n - 1) go(at + 1); else { playing = false; texts(); } }, Math.max(6500, len * 62));
    });
  }
  function setPlay(v) { playing = v; texts(); if (v) { if (at >= SC[cur].beats.length - 1) go(0); else go(at); } else clearTimeout(timer); }

  function play(id, origin) {
    if (!SST[id] && !(SC && SC[id])) return;
    if (window.GerizimLayers && GerizimLayers.isOpen && GerizimLayers.isOpen()) { from = 'story'; GerizimLayers.closeStory(); }
    else from = origin || 'card';
    A.photoWalkEnd();
    box.classList.add('open'); document.body.classList.add('sceneopen');
    $('scTitle').innerHTML = '<span class="scpre">' + esc(T('title')) + ' · </span>' + esc(who(id)); $('scCount').textContent = '';
    $('scBody').innerHTML = '<p class="scload">' + esc(T('loading')) + '</p>';
    load().then(() => {
      if (!SC[id]) throw new Error('missing');
      cur = id; at = 0; playing = false; photo = false;
      const s = SC[id], m = MOOD[s.sky || 'day'] || MOOD.day;
      A.sceneMode(true, m[0], m[1]);
      draw(id, s);
      go(0);
    }).catch(() => { $('scBody').innerHTML = '<p class="scload">' + esc(T('fail')) + '</p>'; });
  }
  function stop() {
    if (!box.classList.contains('open')) return;
    const id = cur, back = from;
    clearTimeout(timer); playing = false; cur = null;
    box.classList.remove('open'); document.body.classList.remove('sceneopen');
    clear();
    A.sceneMode(false);
    A.finger(null);
    if (back === 'story' && id && window.GerizimLayers) { A.home(); GerizimLayers.openStory(id); return; }
    if (A.state.sel) A.select(A.state.sel); else A.home();
  }
  $('scX').onclick = stop;
  $('scBase').onclick = () => { photo = !photo; base(); };
  $('scPrev').onclick = () => { if (cur) { playing = false; go(at - 1); } };
  $('scNext').onclick = () => { if (cur) { playing = false; go(at + 1); } };
  $('scPlay').onclick = () => { if (cur) setPlay(!playing); };
  // מי שגורר את המפה בזמן ההפעלה — ההפעלה נעצרת, כדי שלא תילקח ממנו המצלמה
  map.on('dragstart', () => { if (playing) setPlay(false); });
  document.addEventListener('keydown', e => {
    if (!box.classList.contains('open') || $('lightbox').classList.contains('open')) return;
    if (e.key === 'Escape') stop();
    if (e.key === 'ArrowLeft') $(lang === 'en' ? 'scPrev' : 'scNext').click();
    if (e.key === 'ArrowRight') $(lang === 'en' ? 'scNext' : 'scPrev').click();
  });

  window.GerizimScenes = {
    has: id => !!SST[id],
    state: id => SST[id] || null,
    play, stop,
    setLang: l => { lang = l; if (cur) texts(); else if (box.classList.contains('open')) $('scTitle').textContent = T('title'); }
  };
})();
