/* הדמויות ובעלי החיים של הסיור הרגלי: ציור מפורט, בלי קווי מתאר — גוף בפרופורציות של אדם,
   בד מוצלל בקפלים, פנים והבעה, ידיים וסנדלים, ומבט מלפנים או מאחור. הלבוש לפי התקופה: כתונת צמר או פשתן,
   גלימה מוטלת על הכתף, אבנט, כיסוי ראש; כוהנים בלבן ובמצנפת; שומרים בקסדת נחושת, במגן וברומח.

   drawPerson(canvas, kind, carry, seed, o)      הבד ביחס 1:2; 236 יחידות גובה; קו הקרקע 5 יחידות מעל התחתית
     o.back    true מאחור, false מלפנים, בלעדיו — לפי ההגרלה (בשיחה, בישיבה ובכריעה: מלפנים, אלא אם נאמר אחרת)
     o.stride  0 עומד · 1 רגל שמאל קדימה (מגע) · 2 מעבר (הגוף בשיאו) · 3 רגל ימין קדימה · 4 מעבר.
               הרגל הנטועה הקרובה אל הצופה תמיד על קו הקרקע; הגוף שוקע 1.2 יחידות במגע ומתרומם 0.8 במעבר — הכול מצויר, בלי להזיז את הספרייט
     o.pose    'stand' · 'talk' (אמה מורמת, ראש מוטה) · 'sit' (על ספסל שגובהו 0.42 מ', שאינו מצויר) · 'crouch' (כורע על ברכיו, ידיו לפנים ונמוך)
     o.mood    'calm' · 'smile' · 'speak' (פה פתוח) · 'stern'
     o.turn    -1..1 — הראש מוטה אל שמאל המסך או אל ימינו (בשיחה, בלעדיו: לפי ההגרלה)
   drawAnimal(canvas, kind, o)                    kind: sheep, goat, donkey, ox (בד 224x192) · dove (בד 96x96)
     o.flip פונה שמאלה · o.stride 1..4 (זוגות רגליים באלכסון: 1,3 מגע · 2,4 מעבר) · o.graze ראש אל הקרקע
     o.rest רובץ, רגליו מקופלות (עם graze: ראשו מונח על הקרקע) · o.look ראש אל הצופה · o.load === false חמור בלי משא
     dove: o.stride 1 צעד · 2 מנקרת · 3 צעד ברגל השנייה; o.fly 1 כנפיים למעלה · 2 למטה (הגוף במרכז הבד, בלי צל); o.white יונה לבנה

   המראה של דמות (צבעים, זקן, כיסוי ראש, מבנה גוף) נקבע רק לפי (kind, carry, seed) — ואינו תלוי ב-o. */
(function () {
  'use strict';
  const PAL = {
    wool: ['#e6dcc6', '#d8c8a8', '#c9b48c', '#b79a70', '#a2825c', '#8b6c4a', '#efe8d8', '#cdbb9a'],
    dye: ['#8f3a2c', '#a94e38', '#2d4766', '#3c6252', '#b98a34', '#62466f', '#6f2c3a', '#4a6336', '#9a6236', '#7a8a9a'],
    skin: ['#c4916a', '#b47f5a', '#d0a27c', '#a36f4b', '#bb8862', '#96623f'],
    hair: ['#231811', '#33221a', '#19120d', '#43301f']
  };
  const TAU = Math.PI * 2, PI = Math.PI;
  let LS = 1;                                    // 1: הציור אינו הפוך, האור משמאל; -1: הציור הפוך במראה, והאור מימין (שעל המסך הוא שוב שמאל)
  function rng(seed) { let s = (seed * 9301 + 49297) % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function rgbOf(col) {
    if (col.charAt(0) === '#') { const n = parseInt(col.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    const m = col.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]];
  }
  function tone(col, k) {                        // k>0 מבהיר, k<0 מכהה
    const c = rgbOf(col), f = v => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
    return 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')';
  }
  function mix(a, b, t) { const p = rgbOf(a), q = rgbOf(b), f = i => Math.round(p[i] + (q[i] - p[i]) * t); return 'rgb(' + f(0) + ',' + f(1) + ',' + f(2) + ')'; }
  function alpha(col, a) { const c = rgbOf(col); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  // צורה: [[x,y], [cx,cy,x,y] (עקומה), ...]
  function path(g, pts) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 6) g.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]); else if (p.length === 4) g.quadraticCurveTo(p[0], p[1], p[2], p[3]); else g.lineTo(p[0], p[1]); }
  }
  function trace(g, pts) { g.beginPath(); path(g, pts); g.closePath(); }
  function stroke(g, pts, col, w, a) { g.beginPath(); path(g, pts); g.strokeStyle = col; g.lineWidth = w; g.globalAlpha = a == null ? 1 : a; g.lineCap = 'round'; g.stroke(); g.globalAlpha = 1; }
  function cloth(g, pts, col, x1, x2, edge) {    // בד: אור משמאל, צל מימין
    trace(g, pts);
    const gr = g.createLinearGradient(LS < 0 ? x2 : x1, 0, LS < 0 ? x1 : x2, 0);
    gr.addColorStop(0, tone(col, 0.16)); gr.addColorStop(0.42, col); gr.addColorStop(1, tone(col, -0.36));
    g.fillStyle = gr; g.fill();
    if (edge !== 0) { g.strokeStyle = tone(col, -0.48); g.globalAlpha = edge || 0.5; g.lineWidth = 0.8; g.stroke(); g.globalAlpha = 1; }
  }
  function fold(g, x1, y1, cx, cy, x2, y2, col, a, wdt) {      // קפל: קו רך כהה, ולצדו קו אור דק
    g.lineCap = 'round';
    g.strokeStyle = tone(col, -0.5); g.globalAlpha = a; g.lineWidth = wdt || 2.2;
    g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke();
    g.strokeStyle = tone(col, 0.3); g.globalAlpha = a * 0.55; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x1 - 2 * LS, y1); g.quadraticCurveTo(cx - 2.2 * LS, cy, x2 - 2 * LS, y2); g.stroke();
    g.globalAlpha = 1;
  }
  function flesh(g, pts, skin) {
    trace(g, pts);
    const b = pts.reduce((a, p) => { const x = p[p.length - 2]; return [Math.min(a[0], x), Math.max(a[1], x)]; }, [1e9, -1e9]);
    const gr = g.createLinearGradient(LS < 0 ? b[1] : b[0], 0, LS < 0 ? b[0] : b[1], 0);
    gr.addColorStop(0, tone(skin, 0.14)); gr.addColorStop(0.5, skin); gr.addColorStop(1, tone(skin, -0.3));
    g.fillStyle = gr; g.fill();
  }
  // איבר: גליל מתחדד בין שתי נקודות, מואר מלמעלה-שמאל
  function limb(g, x1, y1, r1, x2, y2, r2, col, hi, lo) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath(); g.arc(x1, y1, r1, a + PI / 2, a - PI / 2); g.arc(x2, y2, r2, a - PI / 2, a + PI / 2); g.closePath();
    let nx = -Math.sin(a), ny = Math.cos(a); if (-nx * LS - ny * 0.45 < 0) { nx = -nx; ny = -ny; }
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, r = Math.max(r1, r2);
    const gr = g.createLinearGradient(mx + nx * r, my + ny * r, mx - nx * r, my - ny * r);
    gr.addColorStop(0, tone(col, hi == null ? 0.15 : hi)); gr.addColorStop(0.45, col); gr.addColorStop(1, tone(col, lo == null ? -0.32 : lo));
    g.fillStyle = gr; g.fill();
  }
  function soft(g, x, y, rx, ry, col, a) {        // כתם רך: אור או צל שמתפוגג אל השוליים
    g.save(); g.translate(x, y); g.scale(rx, ry); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, alpha(col, a)); gr.addColorStop(0.5, alpha(col, a * 0.6)); gr.addColorStop(1, alpha(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
  }
  function blob(g, x, y, rx, ry, col, a, rot) { g.globalAlpha = a == null ? 1 : a; g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
  function shadow(g, x, r, k) {
    const sg = g.createRadialGradient(x, 1, 2, x, 1, r); sg.addColorStop(0, 'rgba(0,0,0,.44)'); sg.addColorStop(0.6, 'rgba(0,0,0,.26)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.save(); g.scale(1, k); g.beginPath(); g.arc(x, 1 / k, r, 0, TAU); g.fill(); g.restore();
  }

  /* ======================================================================= אנשים */
  function drawPerson(c, kind, carry, seed, o) {
    o = o || {};
    const R = rng(seed + 11), pick = a => a[Math.floor(R() * a.length)];
    const g = c.getContext('2d'), Wd = c.width, Hh = c.height, u = Hh / 236;      // 236 יחידות: מקום גם לרומח שמעל הראש
    g.clearRect(0, 0, Wd, Hh); g.lineJoin = 'round';
    const child = kind === 'child', woman = kind === 'woman', elder = kind === 'elder', guard = kind === 'guard',
      priest = kind === 'priest', levite = kind === 'levite', merchant = kind === 'merchant';

    // ---------- המראה: נקבע רק לפי (kind, carry, seed) ----------
    const backR = !(guard || carry === 'lamb' || carry === 'bowl' || carry === 'doves' || carry === 'basket' || carry === 'horn') && R() < 0.3;
    const flip = R() < 0.5 ? -1 : 1;
    const skin = pick(PAL.skin), hair = elder ? pick(['#d6d2c8', '#bfb9ac', '#e2dfd6']) : pick(PAL.hair);
    let robe, cloak = null, sash = null, hem = -10, head = 'bare', beard = false, stripe = null;
    if (priest) { robe = '#f3eee0'; sash = pick(['#2d4766', '#62466f', '#8f3a2c']); hem = -5; head = 'turban'; beard = true; }
    else if (levite) { robe = '#e9e0cb'; sash = '#bfb49a'; hem = -7; head = 'cap'; beard = R() > 0.25; }
    else if (woman) { robe = pick(PAL.dye); cloak = pick(PAL.wool); hem = -3; head = 'veil'; sash = R() > 0.5 ? pick(PAL.wool) : null; }
    else if (elder) { robe = pick(PAL.wool); cloak = pick(['#8b6c4a', '#6c5843', '#b79a70', '#5a4a3c']); sash = '#75604a'; hem = -5; head = R() > 0.45 ? 'cloth' : 'bare'; beard = true; }
    else if (guard) { robe = pick(['#a2825c', '#8f3a2c', '#c9b48c', '#6f2c3a']); sash = '#3f2c1e'; hem = -84; head = 'helmet'; beard = R() > 0.5; }
    else if (merchant) { robe = pick(PAL.wool); sash = pick(PAL.dye); hem = -38; head = 'cloth'; beard = R() > 0.35; stripe = pick(PAL.dye); }
    else if (child) { robe = pick(PAL.wool.concat(PAL.dye)); hem = -64; head = 'bare'; }
    else { robe = pick(PAL.wool); cloak = R() > 0.3 ? pick(PAL.dye.concat(PAL.wool)) : null; sash = pick(['#6c5843', '#8f3a2c', '#2d4766', '#4a3a2c']); hem = R() > 0.5 ? -46 : -9; head = pick(['bare', 'cloth', 'bare', 'band']); beard = R() > 0.2; stripe = R() > 0.6 ? pick(PAL.dye) : null; }
    // פרטים נוספים — ממחולל נפרד, ובמספר קבוע של הגרלות
    const Lr = rng(seed * 7 + 131 + kind.length * 17), lv = []; for (let i = 0; i < 24; i++) lv.push(Lr());
    const Jr = rng(seed * 3 + 71), J = []; for (let i = 0; i < 40; i++) J.push(Jr() - 0.5);
    const bw = 0.95 + lv[0] * 0.12, bh = 0.975 + lv[1] * 0.05;
    const sc = (child ? 0.66 : woman ? 0.94 : elder ? 0.965 : 1) * bh;
    const headCloth = PAL.wool[Math.floor(lv[2] * PAL.wool.length)];
    const barefoot = priest || (child ? lv[3] < 0.55 : lv[3] < 0.1);
    const slv = guard || child ? 'short' : (woman || priest || levite || elder) ? 'long' : lv[4] < 0.5 ? 'elbow' : 'long';
    const beardLen = elder || priest ? 1.95 + lv[5] * 0.2 : 1.42 + lv[5] * 0.4;
    const iris = lv[6] < 0.8 ? '#2e1c10' : lv[6] < 0.93 ? '#4f3418' : '#56603f';
    const trim = PAL.dye[Math.floor(lv[7] * PAL.dye.length)];
    const border = woman ? lv[8] < 0.75 : (kind === 'man' || merchant || elder) ? lv[8] < 0.5 : false;
    const fringe = lv[9] < 0.75;
    const bald = elder && head === 'bare' && lv[10] < 0.5;
    const jewel = woman && lv[11] < 0.6;
    const longHair = child && lv[12] < 0.4;
    const wrapCloth = lv[16] < 0.5;
    const veilCol = cloak || '#d8c8a8';
    const stance = priest || levite ? (lv[18] < 0.6 ? 2 : 0) : woman ? (lv[18] < 0.45 ? 2 : lv[18] < 0.7 ? 1 : 0) : child || guard ? 0 : lv[18] < 0.28 ? 1 : lv[18] < 0.42 ? 2 : 0;   // עמידה: 0 ידיים לצדי הגוף · 1 יד על האבנט · 2 ידיים שלובות לפנים

    // ---------- התנוחה ----------
    const pose = guard ? 'stand' : (o.pose === 'talk' || o.pose === 'sit' || o.pose === 'crouch') ? o.pose : 'stand';
    const st = pose === 'stand' && o.stride >= 1 && o.stride <= 4 ? Math.floor(o.stride) : 0;
    const back = o.back != null ? !!o.back : (pose === 'stand' ? backR : false);
    const mood = o.mood === 'smile' || o.mood === 'speak' || o.mood === 'stern' ? o.mood : 'calm';
    const contact = st === 1 || st === 3, passing = st === 2 || st === 4;
    const fs = st === 1 ? flip : st === 3 ? -flip : 0;           // הרגל שלפנים, בשלבי המגע (1: רגל שמאל של הדמות)
    const ss = st === 2 ? flip : st === 4 ? -flip : 0;           // הרגל הנושאת, בשלבי המעבר
    const dyB = contact ? 1.2 : passing ? -0.8 : 0;              // הגוף שוקע מעט במגע ומתרומם במעבר
    const turn = back ? 0 : o.turn != null ? Math.max(-1, Math.min(1, +o.turn || 0)) * flip : pose === 'talk' ? (lv[15] < 0.5 ? -0.9 : 0.9) : 0;

    const xs = flip * (back ? -1 : 1);                           // מאחור הדמות מצוירת במראה: מה שבשמאלה נשאר בשמאלה
    LS = xs;
    g.save(); g.translate(Wd / 2, Hh - 5 * u); g.scale(u * sc * xs, u * sc);

    // ---------- מידות (ביחידות של אדם עומד: 190 יחידות גובה) ----------
    const sh = -154, wst = -106, hipY = -98;
    const sw = (woman ? 18.5 : child ? 16.5 : 22) * bw, wd = (woman ? 14.5 : child ? 14 : merchant ? 18 : 16.5) * bw;
    const long = hem > -20, hw = (long ? 25.5 : hem > -50 ? 22 : 20) * (0.4 + 0.6 * bw);
    const hr = child ? 14.2 : woman ? 10.8 : 11.2, HY = sh - (child ? 23.5 : 21), lk = child ? 1.2 : 1;
    const cloakOn = !!cloak && (!woman || lv[17] < 0.35);        // רוב הנשים מתעטפות בצעיף בלבד
    const S = 46.3 / sc;                                         // גובה הספסל (0.42 מ') ביחידות הדמות
    const kxS = woman ? 8.5 : child ? 9 : 12, kneeTop = -58.5;   // הברכיים בישיבה
    const hipF = pose === 'sit' ? -(S + 12) : pose === 'crouch' ? -28 : hipY + dyB;   // בישיבה: המושב ב-S, הירך מעליו, ומעט מבט מלמעלה כדי שהחיק ייראה
    const sq = pose === 'crouch' ? 0.9 : 1;
    const IY = y => (y - hipF) / sq - 98;                        // מגובה סופי אל מערכת פלג הגוף העליון
    const lapY = pose === 'sit' ? Math.min(kneeTop, hipF - 5) : 0;
    const twoItem = carry === 'lamb' || carry === 'basket' || carry === 'bowl' || carry === 'doves';
    const pole = carry === 'spear' || carry === 'staff';
    const rBusy = twoItem || carry === 'horn' || carry === 'jar' || carry === 'sack', lBusy = pole || twoItem;
    const gs = pose !== 'talk' ? 0 : !rBusy ? 1 : !lBusy ? -1 : 0;   // היד המדברת
    const strapC = '#4a321e';

    shadow(g, 3, pose === 'crouch' ? 40 : pose === 'sit' ? 36 : 32, 0.24);

    // ---------- כפות רגליים ----------
    function footFlat(x, yB, s, sp, col) {                       // מלפנים, נטועה
      const t = yB - 8.6 * s;
      flesh(g, [[x - 3.1 * s, t], [x + 3.1 * s, t], [x + 4 * s + sp, t + 3 * s, x + 5.3 * s + sp, yB - 2.4 * s], [x + 5.4 * s + sp, yB, x + 2.4 * s + sp, yB], [x - 2.4 * s + sp, yB], [x - 5.4 * s + sp, yB, x - 5.3 * s + sp, yB - 2.4 * s], [x - 4 * s + sp, t + 3 * s, x - 3.1 * s, t]], col);
      g.strokeStyle = tone(col, -0.5); g.globalAlpha = 0.5; g.lineWidth = 0.5; g.beginPath();
      for (let i = -1; i <= 1; i++) { g.moveTo(x + sp + i * 2.2 * s, yB - 0.4); g.lineTo(x + sp + i * 2.05 * s, yB - 2.5 * s); } g.stroke(); g.globalAlpha = 1;
      if (!barefoot) {
        g.strokeStyle = strapC; g.lineCap = 'round'; g.lineWidth = 1.2 * s; g.beginPath();
        g.moveTo(x - 4.9 * s + sp, yB - 0.6 * s); g.lineTo(x + 4.9 * s + sp, yB - 0.6 * s); g.stroke();
        g.lineWidth = 1.05 * s; g.beginPath();
        g.moveTo(x + sp * 0.9, yB - 1.8 * s); g.lineTo(x - 3.3 * s, t + 2.8 * s); g.moveTo(x + sp * 0.9, yB - 1.8 * s); g.lineTo(x + 3.3 * s, t + 2.8 * s);
        g.moveTo(x - 3.2 * s, t + 1.5 * s); g.lineTo(x + 3.2 * s, t + 1.5 * s); g.stroke();
      }
    }
    function footToe(x, yB, s, col) {                            // מלפנים, העקב מורם
      const t = yB - 11 * s;
      flesh(g, [[x - 2.9 * s, t], [x + 2.9 * s, t], [x + 3.5 * s, yB - 4.5 * s, x + 4.2 * s, yB - 1.6 * s], [x + 4 * s, yB, x, yB], [x - 4 * s, yB, x - 4.2 * s, yB - 1.6 * s], [x - 3.5 * s, yB - 4.5 * s, x - 2.9 * s, t]], col);
      if (!barefoot) { g.strokeStyle = strapC; g.lineCap = 'round'; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(x - 3 * s, t + 2 * s); g.lineTo(x + 3 * s, t + 2 * s); g.moveTo(x, yB - 1.6 * s); g.lineTo(x - 3 * s, t + 3.4 * s); g.moveTo(x, yB - 1.6 * s); g.lineTo(x + 3 * s, t + 3.4 * s); g.moveTo(x - 3.4 * s, yB - 0.6 * s); g.lineTo(x + 3.4 * s, yB - 0.6 * s); g.stroke(); }
    }
    function footHeel(x, yB, s, sp, col) {                       // מאחור, נטועה
      const t = yB - 8.6 * s;
      flesh(g, [[x - 4.4 * s + sp, yB - 3.4 * s], [x + 4.4 * s + sp, yB - 3.4 * s], [x + 5 * s + sp, yB], [x - 5 * s + sp, yB]], tone(col, -0.22));
      flesh(g, [[x - 2.7 * s, t], [x + 2.7 * s, t], [x + 3.5 * s, yB - 3 * s, x + 3.1 * s, yB], [x - 3.1 * s, yB], [x - 3.5 * s, yB - 3 * s, x - 2.7 * s, t]], col);
      if (!barefoot) { g.strokeStyle = strapC; g.lineCap = 'round'; g.lineWidth = 1.1 * s; g.beginPath(); g.moveTo(x - 4.7 * s + sp, yB - 0.6 * s); g.lineTo(x + 4.7 * s + sp, yB - 0.6 * s); g.moveTo(x - 3 * s, t + 2.6 * s); g.lineTo(x + 3 * s, t + 2.6 * s); g.stroke(); }
    }
    function footSole(x, yB, s, col) {                           // מאחור, העקב מורם: רואים את הסוליה
      const t = yB - 11 * s, pts = [[x - 2.4 * s, t + 2 * s], [x, t - 0.6 * s, x + 2.4 * s, t + 2 * s], [x + 3.5 * s, yB - 4.5 * s, x + 4.2 * s, yB - 1.4 * s], [x + 4 * s, yB, x, yB], [x - 4 * s, yB, x - 4.2 * s, yB - 1.4 * s], [x - 3.5 * s, yB - 4.5 * s, x - 2.4 * s, t + 2 * s]];
      if (barefoot) flesh(g, pts, tone(col, -0.2)); else cloth(g, pts, '#6a4a2c', x - 4 * s, x + 4 * s, 0.35);
    }

    // ---------- רגליים: עמידה והליכה ----------
    // [ברך x, ברך y, קרסול x, תחתית כף הרגל, קנה מידה, סוג]. הרגל הקרובה אל הצופה נטועה על קו הקרקע; הרחוקה — מעט מעליו, כבפרספקטיבה
    const LEGF = { stand: [7.5, -52, 7.4, 0, 1, 'flat'], fwd: [6.4, -50, 4.8, 0, 1.1, 'flat'], rear: [7.6, -55, 6.6, -4.6, 0.9, 'toe'], stance: [6.4, -52.6, 5.2, 0, 1, 'flat'], swing: [9, -59, 8.4, -11, 0.92, 'toe'] };
    const LEGB = { stand: [7.5, -52, 7.4, 0, 1, 'heel'], fwd: [6.4, -55, 4.8, -4.4, 0.88, 'heel'], rear: [7.6, -50.5, 6.6, 0, 1.08, 'sole'], stance: [6.4, -52.6, 5.2, 0, 1, 'heel'], swing: [9, -57, 8.4, -9.5, 1, 'sole'] };
    const legMode = sx => !st ? 'stand' : contact ? (sx === fs ? 'fwd' : 'rear') : (sx === ss ? 'stance' : 'swing');
    const legFar = sx => { const m = legMode(sx); return back ? m === 'fwd' : (m === 'rear' || m === 'swing'); };
    function leg(sx, what) {                                     // what: 'leg' השוק והירך, 'foot' כף הרגל
      const m = legMode(sx), P = (back ? LEGB : LEGF)[m], col = legFar(sx) ? tone(skin, -0.17) : skin;
      const kx = sx * P[0], ky = P[1], ax = sx * P[2], yB = P[3], s = P[4], ft = P[5], ay = yB - (ft === 'flat' || ft === 'heel' ? 8 : 10.4) * s;
      if (what === 'leg') {
        if (!long) {
          if (hem < -54) limb(g, sx * 7.6, hipY + dyB + 8, 7.8 * lk, kx, ky, 5.8 * lk, col);
          const qx = kx + (ax - kx) * 0.3 + sx * 0.5, qy = ky + (ay - ky) * 0.3;                                     // שריר השוק
          limb(g, kx, ky, 5.4 * lk, qx, qy, 5.8 * lk, col); limb(g, qx, qy, 5.8 * lk, ax, ay, 3.1 * lk, col);
          if (hem < -50) {
            if (back) { stroke(g, [[kx - 3.2, ky - 0.6], [kx, ky + 1.2, kx + 3.2, ky - 0.6]], tone(col, -0.5), 0.7, 0.4); stroke(g, [[kx, qy + 3], [kx + (ax - kx) * 0.6, ky + (ay - ky) * 0.62]], tone(col, -0.45), 0.7, 0.3); }
            else { soft(g, kx - 0.8 * LS, ky - 1.4, 4.2, 3.8, tone(col, 0.3), 0.5); stroke(g, [[kx - 3.6, ky + 2.4], [kx, ky + 4.6, kx + 3.6, ky + 2.4]], tone(col, -0.5), 0.7, 0.4); stroke(g, [[kx - 0.4 * LS, ky + 6], [ax - 0.2 * LS, ay - 6]], tone(col, 0.3), 1, 0.3); }
          }
          if (guard) { g.strokeStyle = strapC; g.lineWidth = 0.9; g.globalAlpha = 0.85; g.beginPath(); for (let i = 0; i < 3; i++) { const t0 = 0.5 + i * 0.16, t1 = t0 + 0.14, w0 = 5 - t0 * 2.2, w1 = 5 - t1 * 2.2; g.moveTo(kx + (ax - kx) * t0 - w0, ky + (ay - ky) * t0); g.lineTo(kx + (ax - kx) * t1 + w1, ky + (ay - ky) * t1); g.moveTo(kx + (ax - kx) * t0 + w0, ky + (ay - ky) * t0); g.lineTo(kx + (ax - kx) * t1 - w1, ky + (ay - ky) * t1); } g.stroke(); g.globalAlpha = 1; }
        } else limb(g, ax, Math.min(ay - 2, hem + dyB - 8), 3.8, ax, ay, 3.2, col);
      } else {
        const sp = sx * 1.5 * s;
        if (yB < 0 && yB > -6) blob(g, ax, yB + 0.6, 6.5, 1.5, '#000', 0.2);
        if (ft === 'flat') footFlat(ax, yB, s, sp, col); else if (ft === 'toe') footToe(ax, yB, s, col); else if (ft === 'heel') footHeel(ax, yB, s, sp, col); else footSole(ax, yB, s, col);
      }
    }
    const legOrder = legFar(-1) ? [-1, 1] : [1, -1];
    const lateFoot = sx => long && !back && legMode(sx) === 'fwd';          // כף הרגל שמציצה לפני שולי הכתונת

    // ---------- הכתונת ----------
    function tunicDetails(pts, yR, yL, xR, xL) {
      g.save(); trace(g, pts); g.clip();
      if (stripe) { g.fillStyle = stripe; g.globalAlpha = 0.85; for (const x of [-8, 8]) { const bx = x + (contact ? fs * (back ? -1 : 1) * 1.2 : 0); g.beginPath(); g.moveTo(x - 1.5, sh - 3); g.lineTo(x + 1.5, sh - 3); g.lineTo(bx + 1.7, hem + 6); g.lineTo(bx - 1.7, hem + 6); g.closePath(); g.fill(); } g.globalAlpha = 1; }
      if (border || priest) {                                               // פס ארוג לאורך השוליים
        const bc = priest ? '#b98a34' : mix(robe, trim, 0.8);
        stroke(g, [[xR + 2, yR - 4.6], [0, (yR + yL) / 2 - 3.6, -xL - 2, yL - 4.6]], bc, priest ? 1.8 : 2.4, 0.85);
        if (!priest) stroke(g, [[xR + 2, yR - 7.6], [0, (yR + yL) / 2 - 6.6, -xL - 2, yL - 7.6]], bc, 0.8, 0.7);
      }
      // צורת הרגליים שמתחת לבד
      if (st && hem > -70) {
        const top = -92, bot = Math.max(yR, yL) + 4;
        if (contact) {
          const ns = back ? -fs : fs;                                       // הצד הקרוב אל הצופה
          soft(g, ns * 7.2, (top + bot) / 2 + 4, 8.5, (bot - top) * 0.62, '#fff8e6', 0.2);
          soft(g, -ns * 9.5, (top + bot) / 2 + 12, 11, (bot - top) * 0.55, '#140a00', 0.22);
          if (hem > -60) { fold(g, ns * 1.5, top + 4, ns * 1, (top + bot) / 2, ns * 1.2, bot - 4, robe, 0.34, 2.4); fold(g, ns * 9, -74, -ns * 2, (hem - 60) / 2, -ns * (hw - 9), bot - 5, robe, 0.2, 1.8); }
        } else {
          const sx = -ss;                                                   // הברך של הרגל המונפת דוחפת את הבד
          if (!back) soft(g, sx * 8.4, -58, 8, 12, '#fff8e6', 0.2);
          if (hem > -50) { soft(g, sx * 9, (bot - 46) / 2, 9, (bot + 46) / 2, '#140a00', back ? 0.1 : 0.2); fold(g, -sx * 0.5, -88, -sx * 1, -50, -sx * 0.5, bot - 4, robe, 0.24, 2); }
        }
      }
      // קפלים מן המותניים אל השוליים; בהליכה הם נוטים עם הצעד
      const sway = contact ? fs * (back ? -1 : 1) * 3.2 : passing ? -ss * 1.2 : 0, nf = long ? 5 : hem > -70 ? 4 : 3;
      for (let i = 0; i < nf; i++) {
        const t = nf > 1 ? i / (nf - 1) : 0.5, x = -hw + 5 + t * (2 * hw - 9) + J[i] * 3;
        fold(g, x * 0.7, wst + 5, x * 0.9 + J[i + 6] * 5 + sway * 0.6, (wst + hem) / 2, x + sway * (0.4 + 0.3 * Math.abs(J[i + 12]) * 2), hem - 2 + dyB * 0, robe, 0.2 + (J[i + 18] + 0.5) * 0.16);
      }
      fold(g, -8, sh + 9, -3, sh + 26, -6, wst - 7, robe, 0.15); fold(g, 9, sh + 11, 5, sh + 28, 8, wst - 7, robe, 0.15);
      // צל מתחת לזרועות ועל המותן
      g.fillStyle = 'rgba(20,10,0,.10)'; g.beginPath(); g.moveTo(sw - 6, sh + 12); g.quadraticCurveTo(wd - 5, (sh + wst) / 2, wd - 3, wst); g.lineTo(wd + 6, wst); g.lineTo(sw + 4, sh + 12); g.closePath(); g.fill();
      g.restore();
    }
    function tunicStand() {
      const amp = long ? 2.2 : 1.2, n = 6;
      let yR = hem, yL = hem, xR = hw, xL = hw;
      if (contact) { const ns = back ? -fs : fs; if (ns > 0) { yR += 1.3; xR += 1.8; yL -= 1.9; xL -= 0.5; } else { yL += 1.3; xL += 1.8; yR -= 1.9; xR -= 0.5; } }
      else if (passing) { if (ss < 0) yR -= 0.9; else yL -= 0.9; }
      const hp = [];
      for (let i = 1; i <= n; i++) { const t = i / n, x = xR - (xR + xL) * t, y = yR + (yL - yR) * t; hp.push([x + (xR + xL) / n / 2, y + (i % 2 ? amp : -amp * 0.5) + J[i] * 1.2, x, y + (i % 2 ? amp * 0.5 : 0)]); }
      const mid = (wst + hem) / 2;
      const pts = [[-6.5, sh - 6], [6.5, sh - 6], [sw * 0.62, sh - 4.6, sw, sh + 1.5], [sw + 1, sh + 20, wd, wst], [wd + 3, mid, xR, yR]].concat(hp, [[-wd - 3, mid, -wd, wst], [-sw - 1, sh + 20, -sw, sh + 1.5], [-sw * 0.62, sh - 4.6, -6.5, sh - 6]]);
      cloth(g, pts, robe, -sw - 4, sw + 6);
      tunicDetails(pts, yR, yL, xR, xL);
    }
    function torsoOnly(bot) {                                    // פלג הגוף העליון בלבד — לישיבה ולכריעה
      const pts = [[-6.5, sh - 6], [6.5, sh - 6], [sw * 0.62, sh - 4.6, sw, sh + 1.5], [sw + 1, sh + 20, wd, wst], [wd + 3.5, (wst + bot) / 2, wd + 3, bot], [0, bot + 4, -wd - 3, bot], [-wd - 3.5, (wst + bot) / 2, -wd, wst], [-sw - 1, sh + 20, -sw, sh + 1.5], [-sw * 0.62, sh - 4.6, -6.5, sh - 6]];
      cloth(g, pts, robe, -sw - 4, sw + 6);
      g.save(); trace(g, pts); g.clip();
      if (stripe) { g.fillStyle = stripe; g.globalAlpha = 0.85; g.fillRect(-9.5, sh - 3, 3, bot - sh + 8); g.fillRect(6.5, sh - 3, 3, bot - sh + 8); g.globalAlpha = 1; }
      fold(g, -8, sh + 9, -3, sh + 26, -6, wst - 7, robe, 0.15); fold(g, 9, sh + 11, 5, sh + 28, 8, wst - 7, robe, 0.15);
      g.fillStyle = 'rgba(20,10,0,.10)'; g.beginPath(); g.moveTo(sw - 6, sh + 12); g.quadraticCurveTo(wd - 5, (sh + wst) / 2, wd - 3, wst); g.lineTo(wd + 6, wst); g.lineTo(sw + 4, sh + 12); g.closePath(); g.fill();
      g.restore();
    }
    function guardArmour() {                                     // שריון עור ורצועות מתחת לחגורה
      const lc = '#7a5232';
      cloth(g, [[-sw + 2, sh + 1], [-6, sh - 3.5], [6, sh - 3.5], [sw - 2, sh + 1], [sw - 1, sh + 22, wd + 0.6, wst - 4], [-wd - 0.6, wst - 4], [-sw + 1, sh + 22, -sw + 2, sh + 1]], lc, -sw, sw + 4);
      for (let i = -3; i <= 3; i++) cloth(g, [[i * 4.9 - 2.1, wst + 1], [i * 4.9 + 2.1, wst + 1], [i * 5.3 + 2.2, wst + 15], [i * 5.3, wst + 17], [i * 5.3 - 2.2, wst + 15]], i % 2 ? '#6c4628' : lc, i * 5 - 3, i * 5 + 4, 0.4);
      if (!back) { stroke(g, [[-sw + 3, sh + 2], [-2, sh + 24, wd - 2, wst - 6]], '#3f2c1e', 2.4, 0.9); g.fillStyle = '#c9a04a'; for (const p of [[-9, sh + 12], [9, sh + 12], [-7, sh + 30], [7, sh + 30]]) { g.beginPath(); g.arc(p[0], p[1], 1.3, 0, TAU); g.fill(); } }
      else stroke(g, [[sw - 3, sh + 2], [2, sh + 24, -wd + 2, wst - 6]], '#3f2c1e', 2.4, 0.9);
    }
    function sashBand() {
      if (!sash) return;
      cloth(g, [[-wd - 1, wst - 5.5], [0, wst - 4.4, wd + 1, wst - 5.5], [wd + 1.6, wst + 2], [0, wst + 3.2, -wd - 1.6, wst + 2]], sash, -wd, wd);
      stroke(g, [[-wd, wst - 2], [0, wst - 0.8, wd, wst - 2]], tone(sash, -0.45), 0.7, 0.5);
      if (priest) { for (let x = -wd + 2; x < wd; x += 4.2) { g.fillStyle = ['#8f3a2c', '#b98a34', '#2d4766', '#62466f'][Math.abs(Math.round(x)) % 4]; g.globalAlpha = 0.85; g.fillRect(x, wst - 3.6, 1.6, 3.4); } g.globalAlpha = 1; }
      if (guard && !back) { g.fillStyle = '#c9a04a'; g.fillRect(-2.6, wst - 5, 5.2, 6.4); g.fillStyle = '#6e4f1c'; g.fillRect(-1.2, wst - 3.6, 2.4, 3.6); }
    }
    function sashEnds(len, swy) {                                // קשר וקצוות תלויים
      if (!sash || back || guard) return;
      blob(g, 5.6, wst - 1.6, 2.9, 3.3, tone(sash, -0.12));
      cloth(g, [[6, wst + 0.5], [9.6, wst + 1], [11.5 + swy, wst + len * 0.8], [7.6 + swy, wst + len * 0.82]], tone(sash, -0.1), 5, 12, 0.4);
      cloth(g, [[2.6, wst + 0.5], [7, wst + 1], [8.2 + swy, wst + len], [3.4 + swy, wst + len + 1.4]], sash, 2, 9, 0.4);
      if (priest) { for (let y = 6; y < len - 3; y += 5) { g.fillStyle = ['#8f3a2c', '#b98a34', '#2d4766'][Math.round(y / 5) % 3]; g.globalAlpha = 0.8; g.fillRect(3.4 + swy * y / len, wst + y, 4.2, 1.5); } g.globalAlpha = 1; }
      g.strokeStyle = tone(sash, -0.4); g.lineWidth = 0.6; g.globalAlpha = 0.8; g.beginPath(); for (let x = 3.6; x < 8.4; x += 1.2) { g.moveTo(x + swy, wst + len + 0.6); g.lineTo(x + swy - 0.2, wst + len + 4); } g.stroke(); g.globalAlpha = 1;
    }

    // ---------- הזרועות ----------
    function handDraw(sx, E, H, type, k, sk) {
      g.save(); g.translate(H[0], H[1]); g.rotate(Math.atan2(H[1] - E[1], H[0] - E[0]) - PI / 2); g.scale(k, k);
      const t = -sx;
      if (type === 'grip') { flesh(g, [[-4.2, -3], [4.2, -3], [4.9, 1.5, 4, 4.6], [0, 6.2, -4, 4.6], [-4.9, 1.5, -4.2, -3]], sk); stroke(g, [[-3.6, 1.2], [3.6, 1.2]], tone(sk, -0.5), 0.5, 0.5); stroke(g, [[-3.4, 3], [3.4, 3]], tone(sk, -0.5), 0.5, 0.4); }
      else {
        flesh(g, [[t * 2.6, -2], [t * 5.9, 0.4, t * 5.2, 4.4], [t * 3.6, 5.2, t * 2.8, 2.6]], tone(sk, -0.07));
        flesh(g, [[-3.5, -3], [3.5, -3], [4.7, 2, 3.6, 6.8], [0, type === 'open' ? 11 : 9.8, -3.4, 6.8], [-4.7, 2, -3.5, -3]], sk);
        g.strokeStyle = tone(sk, -0.5); g.lineWidth = 0.5; g.globalAlpha = type === 'open' ? 0.6 : 0.36; g.beginPath(); for (let i = -1; i <= 1; i++) { g.moveTo(i * 1.7, 4.2); g.lineTo(i * 1.9, type === 'open' ? 9.4 : 8.4); } g.stroke(); g.globalAlpha = 1;
      }
      g.restore();
    }
    function armPose(sx) {
      if (pose === 'crouch') return back ? { E: [sx * (sw + 5), -121], H: [sx * (sw - 3), -106], hand: 'none', layer: 'behind' } : { E: [sx * (sw + 5), IY(-47)], H: [sx * 6.5, IY(-17)], hand: 'rest', layer: 'late' };
      if (sx < 0 && pole) return { E: [-(sw + 5), -125], H: [-(sw + 10), -144], hand: 'grip', layer: 'late' };
      if (sx > 0 && carry === 'jar') return { E: [sw + 15, sh + 3], H: [sw + 12, sh - 26], hand: 'rest', layer: 'late' };
      if (sx > 0 && carry === 'sack') return back ? { E: [sw + 6, -122], H: [sw - 3, sh + 12], hand: 'none', layer: 'behind' } : { E: [sw + 6, -122], H: [sw - 5, sh + 10], hand: 'grip', layer: 'late' };
      if (twoItem || (sx > 0 && carry === 'horn')) return back ? { E: [sx * (sw + 6), -121], H: [sx * (sw - 4), -113], hand: 'none', layer: 'behind' } : { E: [sx * (sw + 5), -119.5], H: [sx * (twoItem ? 11 : 9), -114], hand: twoItem ? 'none' : 'grip', layer: 'front' };
      if (pose === 'talk' && sx === gs) return { E: [sx * (sw + 7), -124], H: [sx * (sw + 11.5), -147], hand: 'open', layer: 'late' };
      if (pose === 'sit') return back ? { E: [sx * (sw + 5), -121], H: [sx * (sw - 2), -107], hand: 'none', layer: 'behind' } : { E: [sx * (sw + 3.6), -119.5], H: [sx * (kxS + 1.5), IY(lapY - 2.5)], hand: 'rest', layer: 'late' };
      const a = contact && !(cloakOn && sx < 0) ? (sx === -fs ? 1 : -1) : 0;      // היד שמנגד לרגל נעה קדימה
      if (a) return (back ? -a : a) > 0 ? { E: [sx * (sw + 3.6), -123], H: [sx * (sw + 0.4), -101], hand: 'rest', layer: 'front', big: 1.07 } : { E: [sx * (sw + 4.8), -122.5], H: [sx * (sw + 3.6), -99.5], hand: 'rest', layer: 'behind', big: 0.95 };
      if (!st && pose === 'stand' && !back && !(cloakOn && sx < 0)) {
        if (stance === 2 && !cloakOn && !pole) return { E: [sx * (sw + 3.4), -120.5], H: [sx * 2.6, -100.5], hand: 'rest', layer: 'late', clasp: 1 };
        if (stance === 1 && sx > 0 && sash) return { E: [sw + 5, -120], H: [8.5, -107.5], hand: 'grip', layer: 'late' };
      }
      return { E: [sx * (sw + 3.6), -121], H: [sx * (sw + 4), -93.5 - (passing ? 1 : 0)], hand: 'rest', layer: 'front' };
    }
    function armDraw(sx, P, noHand) {
      const Sx = sx * (sw - 3.4), Sy = sh + 6.8, E = P.E, H = P.H, k = (P.big || 1) * (child ? 1.1 : 1), dim = P.layer === 'behind';
      const rc = dim ? tone(robe, -0.14) : robe, sk = dim ? tone(skin, -0.14) : skin;
      if (slv === 'short') { limb(g, Sx, Sy, 5.2, E[0], E[1], 4.5 * k, sk); limb(g, Sx, Sy, 6.3, Sx + (E[0] - Sx) * 0.5, Sy + (E[1] - Sy) * 0.5, 6.3, rc, 0.16, -0.34); }
      else limb(g, Sx, Sy, 6.2, E[0], E[1], 5.6 * k, rc, 0.16, -0.34);
      if (slv === 'long') {
        const Wx = E[0] + (H[0] - E[0]) * 0.84, Wy = E[1] + (H[1] - E[1]) * 0.84;
        limb(g, E[0], E[1], 5.6 * k, Wx, Wy, 4.9 * k, rc, 0.16, -0.34);
        const a = Math.atan2(H[1] - E[1], H[0] - E[0]), nx = -Math.sin(a) * 4.7 * k, ny = Math.cos(a) * 4.7 * k;
        stroke(g, [[Wx + nx, Wy + ny], [Wx - nx, Wy - ny]], tone(rc, -0.5), 0.8, 0.5);
        if (border || priest) stroke(g, [[Wx + nx - Math.cos(a) * 2, Wy + ny - Math.sin(a) * 2], [Wx - nx - Math.cos(a) * 2, Wy - ny - Math.sin(a) * 2]], priest ? '#b98a34' : mix(robe, trim, 0.8), 1.3, 0.8);
      } else limb(g, E[0], E[1], 4.4 * k, H[0], H[1], 3.4 * k, sk);
      const mx = (Sx + E[0]) / 2, my = (Sy + E[1]) / 2;
      fold(g, mx - 4, my + 2, mx, my + 5, mx + 4, my + 1, rc, 0.16, 1.4);
      if (P.hand !== 'none' && !noHand) { if (P.clasp) handDraw(sx, [H[0] + sx * 4, H[1] - 8], H, 'grip', k, sk); else handDraw(sx, E, H, P.hand, k, sk); }
    }

    // ---------- הגלימה, מוטלת על הכתף השמאלית ויורדת באלכסון ----------
    function cloakDraw(low, upperOnly) {
      if (!cloakOn) return;
      const cb = mix(cloak, trim, 0.55), sway = contact ? fs * (back ? -1 : 1) * 1.6 : 0, lx = -sw * 0.15 + sway;
      const pts = upperOnly
        ? [[-sw - 2, sh - 2], [-2, sh - 4], [8, sh + 6, sw - 2, sh + 22], [sw + 3, wst - 6, sw + 1, low - 6], [6, low + 2, -sw - 3, low + 2], [-sw - 7, wst, -sw - 2, sh - 2]]
        : back ? [[-sw - 2, sh - 2], [-2, sh - 4], [8, sh + 4, sw - 1, sh + 16], [sw + 4, wst - 8, sw + 2.5, low - 24], [10, low - 5, lx, low], [-sw - 3 + sway, low + 3], [-sw - 7.5, wst, -sw - 2, sh - 2]]
        : [[-sw - 2, sh - 2], [-2, sh - 4], [8, sh + 6, sw - 2, sh + 22], [sw + 3, wst - 8, sw + 1.5, wst + 9], [8, low - 18, lx, low], [-sw - 3 + sway, low + 3], [-sw - 7.5, wst, -sw - 2, sh - 2]];
      cloth(g, pts, cloak, -sw - 6, sw + 6);
      g.save(); trace(g, pts); g.clip();
      for (let i = 0; i < 4; i++) fold(g, -sw + 2 + i * 5, sh + 6 + i * 3, -sw + 7 + i * 6 + sway * 0.5 + J[20 + i] * 3, wst - 6 + i * 8, -sw + 2 + i * 5 + sway, low - 1 - i * 2, cloak, 0.3);
      fold(g, -4, sh, 10, sh + 20, sw, wst, cloak, 0.3, 2.6);
      if (!upperOnly) { fold(g, sw - 1, wst, 12, wst + 16, 1 + sway, low - 14, cloak, 0.24, 2); fold(g, sw - 6, wst - 14, 4, wst + 6, -6 + sway, low - 20, cloak, 0.18, 1.8); }
      if (!back) stroke(g, [[-2, sh - 1.5], [9, sh + 9, sw - 1, sh + 25]], cb, 1.6, border ? 0.8 : 0.3);        // שפת הגלימה שעל החזה
      if (border && !upperOnly) stroke(g, back ? [[sw + 2.5, low - 27.6], [10, low - 8.6, lx, low - 3.6], [-sw - 5 + sway, low - 0.6]] : [[sw + 1.5, wst + 5.4], [8, low - 21.6, lx, low - 3.6], [-sw - 5 + sway, low - 0.6]], cb, 2.2, 0.8);
      g.restore();
      if (back && !woman) {                                                 // קצה הגלימה, מושלך אל הגב מעל הכתף
        const ex = -sw + 1.5;
        cloth(g, [[ex, sh - 3], [ex + 8.5, sh - 4.5], [ex + 9.5, sh + 33], [ex + 1, sh + 36.5]], tone(cloak, -0.07), ex, ex + 10, 0.4);
        fold(g, ex + 4.5, sh, ex + 5.4, sh + 16, ex + 4.8, sh + 32, cloak, 0.24, 1.6);
        if (fringe) { g.strokeStyle = tone(cloak, -0.42); g.globalAlpha = 0.7; g.lineWidth = 0.8; g.beginPath(); for (let x = ex + 1.4; x < ex + 9.6; x += 1.9) { const y = sh + 36.4 - (x - ex - 1) * 0.42; g.moveTo(x, y); g.lineTo(x - 0.3, y + 3.6); } g.stroke(); g.globalAlpha = 1; }
      }
      if (fringe && !upperOnly) {
        g.strokeStyle = tone(cloak, -0.42); g.globalAlpha = 0.7; g.lineWidth = 0.8; g.beginPath(); for (let x = -sw - 2.4; x < -sw * 0.15; x += 2.5) { const y = low + 3 - (x + sw + 3) / (sw * 0.85 + 3) * 3; g.moveTo(x + sway, y); g.lineTo(x + sway - 0.5, y + 3.8); } g.stroke(); g.globalAlpha = 1;
        stroke(g, [[-sw - 3 + sway, low + 3], [-sw - 3.8 + sway, low + 9.5]], '#2d4766', 1.3, 0.85); stroke(g, [[lx, low], [lx - 0.4, low + 6.5]], '#2d4766', 1.3, 0.85);       // גדילים בכנפות
      }
    }

    // ---------- הראש ----------
    const browCol = elder ? '#aaa49a' : tone(hair, -0.15), mdark = mix(tone(skin, -0.6), '#40140f', 0.5), lipC = mix(skin, woman ? '#a8483f' : '#8a4a3c', woman ? 0.55 : 0.36);
    function hairFill(pts, k) { trace(g, pts); const hg = g.createLinearGradient(-hr * LS, 0, hr * LS, 0); hg.addColorStop(0, tone(hair, 0.22 + (k || 0))); hg.addColorStop(1, tone(hair, -0.22)); g.fillStyle = hg; g.fill(); }
    function headBehind(hy) {                                    // מה שמאחורי הצוואר: בד הצעיף, שיער ארוך
      if (back) return;
      if (head === 'veil') cloth(g, [[-hr - 1, hy], [hr + 1, hy], [hr + 5, sh - 5, sw - 7, sh + 1], [0, sh + 3, -sw + 7, sh + 1], [-hr - 5, sh - 5, -hr - 1, hy]], tone(veilCol, -0.3), -sw, sw, 0);
      if (head === 'cloth' && !wrapCloth) cloth(g, [[-hr, hy], [hr, hy], [hr + 3, sh - 3], [-hr - 3, sh - 3]], tone(headCloth, -0.3), -hr, hr, 0);
      if (longHair || (elder && head === 'bare' && !bald)) hairFill([[-hr - 0.6, hy - 4], [hr + 0.6, hy - 4], [hr + 2.6, hy + 9, hr + 0.5, sh - (longHair ? 0 : 5)], [-hr - 0.5, sh - (longHair ? 0 : 5)], [-hr - 2.6, hy + 9, -hr - 0.6, hy - 4]], -0.1);
    }
    function neckDraw() {
      const nk = tone(skin, -0.1);
      if (back) { flesh(g, [[-5.4, sh - 12], [5.4, sh - 12], [6.8, sh - 3], [-6.8, sh - 3]], nk); return; }
      flesh(g, [[-5.2, sh - 12], [5.2, sh - 12], [6.9, sh - 3], [3.6, sh + 3.6, 0, sh + 5], [-3.6, sh + 3.6, -6.9, sh - 3]], nk);
      blob(g, 0.6, sh - 8.6, 5.6, 3.2, tone(skin, -0.5), 0.3);                                                   // צל הסנטר
      stroke(g, [[-7, sh - 3.4], [-3.7, sh + 3.9, 0, sh + 5.6], [3.7, sh + 3.9, 7, sh - 3.4]], border || woman ? mix(robe, trim, 0.75) : tone(robe, -0.4), border || woman ? 1.5 : 0.9, 0.85);
      if (jewel) { g.fillStyle = '#c9a04a'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(i * 1.9, sh + 1.2 - Math.abs(i) * 1.5, 0.75, 0, TAU); g.fill(); } }
    }
    function faceDraw(hy, tn, down) {
      const dx = tn * 1.7, fy = down * 1.6, es = child ? 1.25 : 1;
      const jw = child ? 0.7 : woman ? 0.5 : 0.56, cy2 = child ? 1.12 : woman ? 1.2 : 1.24;
      if (head !== 'veil' && !(head === 'cloth' && !wrapCloth)) {                                              // אוזניים
        flesh(g, [[-hr - 1.7, hy - 3.4 + fy], [-hr + 0.8, hy - 5 + fy], [-hr + 0.8, hy + 4 + fy], [-hr - 1.2, hy + 2.8 + fy]], tone(skin, -0.1));
        flesh(g, [[hr + 1.7, hy - 3.4 + fy], [hr - 0.8, hy - 5 + fy], [hr - 0.8, hy + 4 + fy], [hr + 1.2, hy + 2.8 + fy]], tone(skin, -0.26));
      }
      trace(g, [[0, hy - hr * 1.3], [hr * 1.04, hy - hr * 1.3, hr, hy - 2], [hr * 0.98, hy + hr * 0.62, hr * jw, hy + hr * (cy2 - 0.2)], [hr * 0.28, hy + hr * cy2, 0, hy + hr * cy2], [-hr * 0.28, hy + hr * cy2, -hr * jw, hy + hr * (cy2 - 0.2)], [-hr * 0.98, hy + hr * 0.62, -hr, hy - 2], [-hr * 1.04, hy - hr * 1.3, 0, hy - hr * 1.3]]);
      const fg = g.createRadialGradient(-3.6 * LS + dx, hy - 5, 2, dx * 0.5, hy, hr * 1.55); fg.addColorStop(0, tone(skin, 0.2)); fg.addColorStop(0.55, skin); fg.addColorStop(1, tone(skin, -0.34));
      g.fillStyle = fg; g.fill();
      // העיניים
      const ey = hy + (child ? 0.8 : -2.5) + fy, ex = child ? 5.7 : 4.5, open = (mood === 'smile' ? 0.72 : mood === 'stern' ? 0.74 : mood === 'speak' ? 1.1 : 1) * (down ? 0.7 : 1) * (elder ? 0.88 : 1);
      const w = 2.5 * es, up = 2.6 * es * open, lo = (mood === 'smile' ? 0.3 : 1.45) * es, gaze = tn * 0.55;
      for (const s of [-1, 1]) {
        const x = dx + s * ex;
        blob(g, x, ey - 0.5, w + 1, 2.4 * es, tone(skin, -0.36), 0.3);
        g.beginPath(); g.moveTo(x - w, ey + 0.15); g.quadraticCurveTo(x, ey - up, x + w, ey + 0.1); g.quadraticCurveTo(x, ey + lo, x - w, ey + 0.15); g.closePath();
        g.fillStyle = '#efe7d8'; g.fill();
        g.save(); g.clip();
        g.fillStyle = iris; g.beginPath(); g.arc(x + gaze, ey - 0.2 + down * 0.4, 1.3 * es, 0, TAU); g.fill();
        g.fillStyle = '#0d0805'; g.beginPath(); g.arc(x + gaze, ey - 0.2 + down * 0.4, 0.62 * es, 0, TAU); g.fill();
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x - w, ey - up, 2 * w, up * 0.3);
        g.restore();
        blob(g, x + gaze - 0.5, ey - 0.65, 0.36 * es, 0.36 * es, '#ffffff', 0.85);
        stroke(g, [[x - w - (woman ? 0.4 : 0.1), ey + 0.25], [x, ey - up - 0.1, x + w + (woman ? 0.4 : 0.1), ey + 0.15]], '#1b110a', (woman ? 0.95 : 0.78) * es);
        stroke(g, [[x - w * 0.9, ey + 0.4], [x, ey + lo + 0.1, x + w * 0.9, ey + 0.35]], tone(skin, -0.45), 0.45, 0.55);
        stroke(g, [[x - w * 0.9, ey - up * 0.42 - 0.9], [x, ey - up * 0.5 - 1.5, x + w * 0.9, ey - up * 0.42 - 0.9]], tone(skin, -0.4), 0.4, 0.4);
        if (elder) { stroke(g, [[x + s * (w + 0.6), ey - 0.4], [x + s * (w + 2.2), ey - 1.2]], tone(skin, -0.5), 0.4, 0.5); stroke(g, [[x + s * (w + 0.6), ey + 0.4], [x + s * (w + 2.2), ey + 1]], tone(skin, -0.5), 0.4, 0.5); stroke(g, [[x - w * 0.8, ey + 1.7], [x, ey + 2.5, x + w * 0.8, ey + 1.7]], tone(skin, -0.5), 0.45, 0.4); }
      }
      // הגבות
      const by = ey - (child ? 3.5 : 3.6) * es - (mood === 'speak' ? 0.5 : 0) + (mood === 'stern' ? 0.9 : 0);
      const bIn = mood === 'stern' ? 1.3 : mood === 'speak' ? -0.5 : 0.25, bMid = mood === 'stern' ? -0.1 : -0.82, bOut = mood === 'stern' ? -0.5 : mood === 'smile' ? 0.25 : 0.5;
      for (const s of [-1, 1]) { const x = dx + s * ex; stroke(g, [[x - s * 2.9, by + bIn], [x + s * 0.3, by + 2 * bMid - (bIn + bOut) / 2, x + s * 3.3, by + bOut]], browCol, woman || child ? 0.8 : 1.08); }
      if (mood === 'stern') { stroke(g, [[dx - 0.9, by + 0.6], [dx - 0.7, by + 2.4]], tone(skin, -0.5), 0.5, 0.6); stroke(g, [[dx + 0.9, by + 0.6], [dx + 0.7, by + 2.4]], tone(skin, -0.5), 0.5, 0.6); }
      if (elder) { stroke(g, [[dx - 5.5, hy - 8 + fy], [dx, hy - 8.8 + fy, dx + 5.5, hy - 8 + fy]], tone(skin, -0.45), 0.45, 0.45); stroke(g, [[dx - 4.6, hy - 10 + fy], [dx, hy - 10.7 + fy, dx + 4.6, hy - 10 + fy]], tone(skin, -0.45), 0.45, 0.38); }
      // האף
      const ny = hy + (child ? 5.6 : 4.3) + fy, nx = dx + tn * 0.7;
      g.fillStyle = tone(skin, -0.42); g.globalAlpha = 0.36;
      g.beginPath(); g.moveTo(dx + 0.7 * LS, ey - 0.4); g.quadraticCurveTo(nx + 3.1 * LS, ny - 1.4, nx + 2.3 * LS, ny + 0.2); g.quadraticCurveTo(nx + 0.6 * LS, ny + 1.2, nx - 1.9 * LS, ny + 0.3); g.quadraticCurveTo(nx - 0.3 * LS, ny - 2.2, dx - 0.1 * LS, ey + 0.4); g.closePath(); g.fill(); g.globalAlpha = 1;
      blob(g, nx - 1.35, ny + 0.2, 0.62, 0.42, tone(skin, -0.64), 0.62); blob(g, nx + 1.5, ny + 0.2, 0.62, 0.42, tone(skin, -0.64), 0.62);
      stroke(g, [[dx - 0.5 * LS, ey + 1.2], [nx - 0.7 * LS, ny - 1.3]], tone(skin, 0.34), 0.8, 0.32);
      blob(g, nx - 0.5 * LS, ny - 0.9, 1, 0.8, tone(skin, 0.3), 0.4);
      if (mood === 'smile' || elder || mood === 'stern') for (const s of [-1, 1]) stroke(g, [[nx + s * 2.6, ny + 0.4], [nx + s * 4.4, ny + 2.4, nx + s * 4.2, ny + 4.6]], tone(skin, -0.5), 0.45, elder ? 0.5 : 0.36);
      if (mood === 'smile') { blob(g, dx - 6, ny - 0.4, 2.7, 1.9, '#c9654f', 0.16); blob(g, dx + 6, ny - 0.4, 2.7, 1.9, '#c9654f', 0.14); }
      // הזקן
      if (beard) {
        const bl = beardLen;
        trace(g, [[-hr + 0.3, hy + 0.5], [-hr + 0.5, hy + hr * 0.98, -hr * 0.46 + dx * 0.3, hy + hr * (bl - 0.14)], [dx * 0.4, hy + hr * (bl + 0.12), hr * 0.46 + dx * 0.3, hy + hr * (bl - 0.14)], [hr - 0.5, hy + hr * 0.98, hr - 0.3, hy + 0.5], [dx + 7.6, ny + 2.4, dx + 4.5, hy + 7.2 + fy], [dx, hy + 12.4 + fy, dx - 4.5, hy + 7.2 + fy], [dx - 7.6, ny + 2.4, -hr + 0.3, hy + 0.5]]);
        const bg = g.createLinearGradient(-hr * LS, 0, hr * LS, 0); bg.addColorStop(0, tone(hair, 0.2)); bg.addColorStop(1, tone(hair, -0.25)); g.fillStyle = bg; g.fill();
        g.strokeStyle = tone(hair, elder ? -0.25 : 0.4); g.globalAlpha = 0.34; g.lineWidth = 0.6; g.beginPath(); for (let i = 0; i < 9; i++) { const x = -7 + i * 1.75; g.moveTo(x + dx * 0.5, hy + 9.5 + Math.abs(x) * 0.25); g.quadraticCurveTo(x * 0.9, hy + hr * (bl - 0.4), x * 0.55 + dx * 0.3, hy + hr * (bl - 0.16) - Math.abs(x) * 0.5); } g.stroke(); g.globalAlpha = 1;
      }
      if (beard) for (const s of [-1, 1]) { stroke(g, [[dx + s * 0.3, ny + 1.5], [dx + s * 3, ny + 1.3, dx + s * 5, hy + 8.3 + fy]], tone(hair, s * LS < 0 ? 0.12 : -0.12), 2); stroke(g, [[dx + s * 0.8, ny + 1.2], [dx + s * 3, ny + 1, dx + s * 4.6, hy + 7.4 + fy]], tone(hair, elder ? -0.2 : 0.4), 0.5, 0.4); }      // שפם
      // הפה
      const my = hy + (child ? 9.6 : 7.8) + fy, mx = dx + tn * 0.4, mw = child ? 2.8 : 3.1;
      if (mood === 'speak') {
        blob(g, mx, my + 0.8, mw * 0.8, 2.05, '#35120e');
        g.fillStyle = '#efe6d6'; g.beginPath(); g.ellipse(mx, my + 0.8, mw * 0.8, 2.05, 0, PI * 1.12, PI * 1.88); g.closePath(); g.fill();
        stroke(g, [[mx - mw * 0.78, my + 1.3], [mx, my + 3.5, mx + mw * 0.78, my + 1.3]], lipC, 1.05, 0.9);
        stroke(g, [[mx - mw * 0.8, my + 0.4], [mx, my - 1.5, mx + mw * 0.8, my + 0.4]], mdark, 0.6, 0.7);
      } else if (mood === 'smile') {
        blob(g, mx, my + 1.1, mw * 0.72, 0.95, lipC, 0.8);
        stroke(g, [[mx - mw - 0.8, my - 1], [mx, my + 2.3, mx + mw + 0.8, my - 1]], mdark, 1);
        stroke(g, [[mx - mw - 1.3, my - 1.7], [mx - mw - 0.6, my - 0.8]], mdark, 0.5, 0.6); stroke(g, [[mx + mw + 1.3, my - 1.7], [mx + mw + 0.6, my - 0.8]], mdark, 0.5, 0.6);
      } else if (mood === 'stern') {
        blob(g, mx, my + 1.3, mw * 0.62, 0.75, lipC, 0.6);
        stroke(g, [[mx - mw, my + 0.7], [mx, my - 0.5, mx + mw, my + 0.7]], mdark, 1.05);
      } else {
        blob(g, mx, my + 1.05, mw * 0.68, 0.9, lipC, 0.75);
        stroke(g, [[mx - mw, my - 0.1], [mx, my + 0.9, mx + mw, my - 0.1]], mdark, 0.95);
      }
    }
    function headDraw(hy, tn, down) {
      if (back) {
        if (head === 'veil') {
          const vp = [[-hr - 1.6, hy - 3], [-hr - 3.6, hy - hr * 1.78, 0, hy - hr * 1.76], [hr + 3.6, hy - hr * 1.78, hr + 1.6, hy - 3], [hr + 1.4, hy + 9, hr + 3.5, sh - 6], [sw - 1, sh - 4, sw + 2.5, sh + 6], [sw + 4, sh + 22, sw - 1, sh + 36], [0, sh + 47, -sw + 1, sh + 36], [-sw - 4, sh + 22, -sw - 2.5, sh + 6], [-sw + 1, sh - 4, -hr - 3.5, sh - 6], [-hr - 1.4, hy + 9, -hr - 1.6, hy - 3]];
          cloth(g, vp, veilCol, -sw - 3, sw + 4);
          g.save(); trace(g, vp); g.clip();
          for (const x of [-10, -3.5, 3, 9.5]) fold(g, x * 0.55, hy - 4, x * 0.8 + J[24 + Math.round(x + 10) % 6] * 2, sh + 10, x * 1.35, sh + 40, veilCol, 0.24, 1.8);
          soft(g, 0, sh - 7, hr + 5, 5, '#140a00', 0.2);
          if (border) stroke(g, [[sw - 1, sh + 32.6], [0, sh + 43.4, -sw + 1, sh + 32.6]], mix(veilCol, trim, 0.7), 1.8, 0.8);
          g.restore();
          return;
        }
        flesh(g, [[-hr - 1.5, hy - 3], [-hr + 1, hy - 5], [-hr + 1, hy + 4], [-hr - 1, hy + 3]], tone(skin, -0.12)); flesh(g, [[hr + 1.5, hy - 3], [hr - 1, hy - 5], [hr - 1, hy + 4], [hr + 1, hy + 3]], tone(skin, -0.28));
        const skull = [[0, hy - hr * 1.34], [hr * 1.06, hy - hr * 1.32, hr + 0.3, hy - 2], [hr, hy + hr * 0.7, hr * 0.55, hy + hr * 0.98], [0, hy + hr * 1.16, -hr * 0.55, hy + hr * 0.98], [-hr, hy + hr * 0.7, -hr - 0.3, hy - 2], [-hr * 1.06, hy - hr * 1.32, 0, hy - hr * 1.34]];
        if (bald) { flesh(g, skull, skin); hairFill([[-hr - 0.4, hy - 3], [-hr * 0.5, hy - 1, 0, hy - 2], [hr * 0.5, hy - 1, hr + 0.4, hy - 3], [hr, hy + hr * 0.7, hr * 0.55, hy + hr * 0.98], [0, hy + hr * 1.16, -hr * 0.55, hy + hr * 0.98], [-hr, hy + hr * 0.7, -hr - 0.4, hy - 3]]); }
        else { hairFill(skull); g.strokeStyle = tone(hair, elder ? -0.3 : 0.4); g.globalAlpha = 0.3; g.lineWidth = 0.6; g.beginPath(); for (let i = 0; i < 9; i++) { const x = -8 + i * 2; g.moveTo(x * 0.3, hy - hr * 1.1); g.quadraticCurveTo(x * 1.1, hy - 2, x * 0.85, hy + hr * 0.9); } g.stroke(); g.globalAlpha = 1; }
        if (longHair) hairFill([[-hr - 0.5, hy - 2], [hr + 0.5, hy - 2], [hr + 2.5, hy + 10, hr, sh + 2], [0, sh + 5, -hr, sh + 2], [-hr - 2.5, hy + 10, -hr - 0.5, hy - 2]]);
        if (head === 'band') cloth(g, [[-hr - 0.8, hy - hr * 0.86], [hr + 0.8, hy - hr * 0.86], [hr + 0.8, hy - hr * 0.58], [-hr - 0.8, hy - hr * 0.58]], '#cfc4a8', -hr, hr);
        if (head === 'cap') cloth(g, [[-hr - 0.8, hy - 1], [-hr - 0.8, hy - hr * 1.66, 0, hy - hr * 1.64], [hr + 0.8, hy - hr * 1.66, hr + 0.8, hy - 1], [0, hy + 2.5, -hr - 0.8, hy - 1]], '#e3d9c0', -hr, hr);
        if (head === 'turban') { cloth(g, [[-hr - 2.5, hy - 2], [-hr - 5, hy - hr * 1.9, 0, hy - hr * 2.05], [hr + 5, hy - hr * 1.9, hr + 2.5, hy - 2], [0, hy + 3, -hr - 2.5, hy - 2]], '#f8f5ec', -hr - 4, hr + 5); for (const k of [0.2, 0.45, 0.7]) fold(g, -hr - 2.5, hy - 3 - k * 15, 0, hy + 1 - k * 20, hr + 2.5, hy - 3 - k * 15, '#e8e2d2', 0.3, 1.4); }
        if (head === 'cloth') {
          const hc = headCloth;
          if (wrapCloth) { cloth(g, [[-hr - 2, hy - 1], [-hr - 3.8, hy - hr * 1.74, 0, hy - hr * 1.8], [hr + 3.8, hy - hr * 1.74, hr + 2, hy - 1], [0, hy + 3, -hr - 2, hy - 1]], hc, -hr - 3, hr + 4); for (const k of [0.25, 0.55]) fold(g, -hr - 2, hy - 3 - k * 13, 0, hy - k * 17, hr + 2, hy - 4 - k * 13, hc, 0.3, 1.4); cloth(g, [[2, hy - 2], [7, hy - 2], [8.5, sh + 10], [3, sh + 12]], tone(hc, -0.08), 2, 9, 0.4); }
          else { cloth(g, [[-hr - 1.5, hy - 5], [-hr - 3, hy - hr * 1.7, 0, hy - hr * 1.72], [hr + 3, hy - hr * 1.7, hr + 1.5, hy - 5], [hr + 5, hy + 10, hr + 3, sh + 12], [0, sh + 20, -hr - 3, sh + 12], [-hr - 5, hy + 10, -hr - 1.5, hy - 5]], hc, -hr - 3, hr + 4); for (const x of [-6, 0, 6]) fold(g, x * 0.6, hy - 4, x, hy + 8, x * 1.1, sh + 13, hc, 0.24, 1.6); cloth(g, [[-hr - 1.6, hy - hr * 0.95], [hr + 1.6, hy - hr * 0.95], [hr + 1.6, hy - hr * 0.7], [-hr - 1.6, hy - hr * 0.7]], '#4a3a2c', -hr, hr); }
        }
        if (head === 'helmet') {
          trace(g, [[-hr - 1.6, hy + 1], [-hr - 2.2, hy - hr * 1.7, 0, hy - hr * 1.86], [hr + 2.2, hy - hr * 1.7, hr + 1.6, hy + 1], [hr + 3, hy + 7, hr + 2.4, hy + 9], [0, hy + 12.5, -hr - 2.4, hy + 9], [-hr - 3, hy + 7, -hr - 1.6, hy + 1]]);
          const mg = g.createLinearGradient(-hr * LS, 0, hr * LS, 0); mg.addColorStop(0, '#e8c56a'); mg.addColorStop(0.35, '#b98a34'); mg.addColorStop(1, '#6e4f1c'); g.fillStyle = mg; g.fill();
          stroke(g, [[-hr - 1.8, hy + 1.5], [0, hy + 4.5, hr + 1.8, hy + 1.5]], '#6e4f1c', 0.9, 0.7);
          cloth(g, [[-2.4, hy - hr * 1.78], [-2, hy - hr * 2.7, 0, hy - hr * 2.75], [2, hy - hr * 2.7, 2.4, hy - hr * 1.78], [2.2, hy - 4], [-2.2, hy - 4]], '#8f3a2c', -3, 3);
        }
        return;
      }
      faceDraw(hy, tn, down);
      const fy = down * 1.6;
      // שיער וכיסוי ראש
      const hl = hy - hr * (bald ? 1.12 : child ? 0.6 : 0.74) + fy;                                             // קו השיער
      const hairCap = () => {
        if (bald) { hairFill([[-hr - 0.6, hy + 1], [-hr - 1.6, hy - hr * 0.9, -hr * 0.62, hy - hr * 1.02], [-hr * 0.8, hy - hr * 0.4, -hr + 0.9, hy - 5], [-hr + 0.7, hy - 1, -hr - 0.6, hy + 1]]); hairFill([[hr + 0.6, hy + 1], [hr + 1.6, hy - hr * 0.9, hr * 0.62, hy - hr * 1.02], [hr * 0.8, hy - hr * 0.4, hr - 0.9, hy - 5], [hr - 0.7, hy - 1, hr + 0.6, hy + 1]]); return; }
        hairFill([[-hr - 0.6, hy - 0.5], [-hr - 1.7, hy - hr * 1.52, 0, hy - hr * 1.5], [hr + 1.7, hy - hr * 1.52, hr + 0.6, hy - 0.5], [hr - 1.2, hy - 5, hr - 2.4, hl + 2], [hr * 0.4, hl - (child ? -1.4 : 1.6), 0, hl + (child ? 1.6 : 0)], [-hr * 0.4, hl - (child ? -1.4 : 1.6), -hr + 2.4, hl + 2], [-hr + 1.2, hy - 5, -hr - 0.6, hy - 0.5]]);
        g.strokeStyle = tone(hair, elder ? -0.3 : 0.42); g.globalAlpha = 0.32; g.lineWidth = 0.6; g.beginPath(); for (let i = 0; i < 8; i++) { const x = -8 + i * 2.3; g.moveTo(x * 0.5, hy - hr * 1.42); g.quadraticCurveTo(x * 1.1, hy - hr * 1.1, x * 1.02, hl + 0.5); } g.stroke(); g.globalAlpha = 1;
      };
      if (head === 'bare' || head === 'band') { hairCap(); if (head === 'band') cloth(g, [[-hr - 0.8, hy - hr * 0.98], [0, hy - hr * 1.04, hr + 0.8, hy - hr * 0.98], [hr + 0.8, hy - hr * 0.72], [0, hy - hr * 0.78, -hr - 0.8, hy - hr * 0.72]], '#cfc4a8', -hr, hr); }
      if (head === 'turban') {
        hairFill([[-hr + 0.4, hy - 1], [-hr - 0.2, hy - 8], [-hr + 2.5, hy - 8], [-hr + 1.6, hy - 2]]); hairFill([[hr - 0.4, hy - 1], [hr + 0.2, hy - 8], [hr - 2.5, hy - 8], [hr - 1.6, hy - 2]]);
        cloth(g, [[-hr - 2.5, hy - 5.5], [-hr - 5, hy - hr * 1.9, 0, hy - hr * 2.05], [hr + 5, hy - hr * 1.9, hr + 2.5, hy - 5.5], [0, hy - hr * 0.95, -hr - 2.5, hy - 5.5]], '#f8f5ec', -hr - 4, hr + 5);
        for (const k of [0.28, 0.5, 0.72]) fold(g, -hr - 2.5, hy - 6 - k * 13, 0, hy - 12 - k * 17, hr + 2.5, hy - 6 - k * 13, '#e8e2d2', 0.3, 1.4);
        cloth(g, [[-hr - 2.7, hy - 8.4], [0, hy - hr * 1.2, hr + 2.7, hy - 8.4], [hr + 2.5, hy - 5.2], [0, hy - hr * 0.9, -hr - 2.5, hy - 5.2]], '#efe9da', -hr - 3, hr + 3, 0.35);
      }
      if (head === 'cap') { hairFill([[-hr + 0.4, hy - 1], [-hr - 0.2, hy - 7], [-hr + 2.5, hy - 7], [-hr + 1.6, hy - 2]]); hairFill([[hr - 0.4, hy - 1], [hr + 0.2, hy - 7], [hr - 2.5, hy - 7], [hr - 1.6, hy - 2]]); cloth(g, [[-hr - 0.8, hy - 5], [-hr - 0.6, hy - hr * 1.62, 0, hy - hr * 1.62], [hr + 0.6, hy - hr * 1.62, hr + 0.8, hy - 5], [0, hy - hr * 0.9, -hr - 0.8, hy - 5]], '#e3d9c0', -hr, hr); stroke(g, [[-hr - 0.4, hy - 7], [0, hy - hr * 1.08, hr + 0.4, hy - 7]], '#bfb49a', 0.9, 0.7); }
      if (head === 'cloth') {
        const hc = headCloth;
        if (wrapCloth) {                                                                                         // סודר כרוך סביב הראש, וקצהו תלוי
          cloth(g, [[hr - 2.6, hy - 6], [hr + 1.6, hy - 7], [hr + 4.4, hy + 6, hr + 3.4, sh + 3], [hr - 1.4, sh + 5], [hr + 0.4, hy + 4, hr - 2.6, hy - 6]], tone(hc, -0.06), hr - 3, hr + 5, 0.4);
          cloth(g, [[-hr - 2, hy - 4.6], [-hr - 3.8, hy - hr * 1.74, 0, hy - hr * 1.8], [hr + 3.8, hy - hr * 1.74, hr + 2, hy - 4.6], [hr - 1, hy - hr * 0.76, 0, hy - hr * 0.9], [-hr + 1, hy - hr * 0.76, -hr - 2, hy - 4.6]], hc, -hr - 3, hr + 4);
          fold(g, -hr - 2, hy - 8, -2, hy - hr * 1.3, hr + 2.6, hy - hr * 1.25, hc, 0.3, 1.4); fold(g, -hr - 1, hy - hr * 1.2, 0, hy - hr * 1.62, hr + 2, hy - hr * 0.95, hc, 0.26, 1.3);
        } else {                                                                                                 // מטפחת ראש רפויה, וחבל סביבה
          cloth(g, [[-hr - 1.5, hy - 5], [-hr - 3, hy - hr * 1.7, 0, hy - hr * 1.72], [hr + 3, hy - hr * 1.7, hr + 1.5, hy - 5], [hr + 4, hy + 10, hr + 1, sh + 6], [hr - 3, hy + 6, hr - 1.2, hy - 6], [0, hy - hr * 0.92, -hr + 1.2, hy - 6], [-hr + 3, hy + 6, -hr - 1, sh + 6], [-hr - 4, hy + 10, -hr - 1.5, hy - 5]], hc, -hr - 3, hr + 4);
          cloth(g, [[-hr - 1.6, hy - hr * 0.98], [0, hy - hr * 1.06, hr + 1.6, hy - hr * 0.98], [hr + 1.6, hy - hr * 0.74], [0, hy - hr * 0.82, -hr - 1.6, hy - hr * 0.74]], '#4a3a2c', -hr, hr);
        }
      }
      if (head === 'veil') {
        const vc = veilCol;
        hairFill([[-hr + 0.8, hy - 3], [-hr - 0.2, hy - hr * 1.2, 0, hy - hr * 1.22], [hr + 0.2, hy - hr * 1.2, hr - 0.8, hy - 3], [hr * 0.5, hy - hr * 0.72, 0.4, hy - hr * 0.86], [-hr * 0.5, hy - hr * 0.72, -hr + 0.8, hy - 3]]);
        cloth(g, [[-hr - 1.5, hy - 3], [-hr - 4.5, hy - hr * 1.75, 0, hy - hr * 1.74], [hr + 4.5, hy - hr * 1.75, hr + 1.5, hy - 3], [hr + 8, sh + 2, sw + 3, sh + 20], [sw - 4, sh + 10, hr - 0.5, hy + 9], [hr - 2.4, hy - 2, hr - 1.6, hy - 7], [0, hy - hr * 1.12, -hr + 1.6, hy - 7], [-hr + 2.4, hy - 2, -hr + 0.5, hy + 9], [-sw + 4, sh + 10, -sw - 3, sh + 20], [-hr - 8, sh + 2, -hr - 1.5, hy - 3]], vc, -sw - 3, sw + 4);
        fold(g, -hr - 2, hy - 2, -hr - 6, sh - 2, -sw, sh + 16, vc, 0.3); fold(g, hr + 2, hy - 2, hr + 6, sh - 2, sw, sh + 16, vc, 0.3);
        fold(g, -5, hy - hr * 1.6, 0, hy - hr * 1.3, 6, hy - hr * 1.62, vc, 0.18, 1.3);
        if (border) stroke(g, [[-hr + 1.2, hy + 8], [-hr + 2.9, hy - 2, -hr + 2.1, hy - 7], [0, hy - hr * 1.2, hr - 2.1, hy - 7], [hr - 2.9, hy - 2, hr - 1.2, hy + 8]], mix(vc, trim, 0.75), 1.2, 0.8);
        if (jewel) { blob(g, -hr + 0.9, hy + 5.4 + fy, 0.9, 1.3, '#c9a04a'); blob(g, hr - 0.9, hy + 5.4 + fy, 0.9, 1.3, '#a9822e'); }
      }
      if (head === 'helmet') {
        trace(g, [[-hr - 1.6, hy - 2.5], [-hr - 2.2, hy - hr * 1.7, 0, hy - hr * 1.86], [hr + 2.2, hy - hr * 1.7, hr + 1.6, hy - 2.5], [hr - 1, hy - hr * 0.56, 0, hy - hr * 0.66], [-hr + 1, hy - hr * 0.56, -hr - 1.6, hy - 2.5]]);
        const mg = g.createLinearGradient(-hr * LS, 0, hr * LS, 0); mg.addColorStop(0, '#e8c56a'); mg.addColorStop(0.35, '#b98a34'); mg.addColorStop(1, '#6e4f1c'); g.fillStyle = mg; g.fill();
        flesh(g, [[-hr - 1.3, hy - 3.5], [-hr + 3, hy - 4.5], [-hr + 3.6, hy + 4, -hr + 1.6, hy + 9.5], [-hr - 0.9, hy + 6]], '#b98a34'); flesh(g, [[hr + 1.3, hy - 3.5], [hr - 3, hy - 4.5], [hr - 3.6, hy + 4, hr - 1.6, hy + 9.5], [hr + 0.9, hy + 6]], '#8a6524');
        stroke(g, [[-hr - 1.4, hy - 3.4], [0, hy - hr * 0.86, hr + 1.4, hy - 3.4]], '#f0d88a', 0.9, 0.7);
        flesh(g, [[-1.1, hy - hr * 0.72], [1.1, hy - hr * 0.72], [0.8, hy - 1.5], [-0.8, hy - 1.5]], '#a67c2e');
        cloth(g, [[-2.4, hy - hr * 1.78], [-2.6, hy - hr * 2.6, 0, hy - hr * 2.78], [2.6, hy - hr * 2.6, 2.4, hy - hr * 1.78]], '#8f3a2c', -3, 3);
      }
    }

    // ---------- מה שנושאים ----------
    const poleX = -(sw + 10);
    function poleDraw() {
      const top = carry === 'spear' ? -206 : -176, bot = IY(0);
      const pgr = g.createLinearGradient(poleX - 2, 0, poleX + 2, 0); pgr.addColorStop(0, '#9a7a50'); pgr.addColorStop(1, '#4a3320'); g.fillStyle = pgr;
      g.fillRect(poleX - 1.6, top, 3.2, bot - top);
      if (carry === 'spear') { trace(g, [[poleX - 3.6, -204], [poleX, -226], [poleX + 3.6, -204], [poleX, -197]]); const sgr = g.createLinearGradient(poleX - 4, 0, poleX + 4, 0); sgr.addColorStop(0, '#e6e2d6'); sgr.addColorStop(0.5, '#b9b5aa'); sgr.addColorStop(1, '#6f6c66'); g.fillStyle = sgr; g.fill(); g.fillStyle = '#b98a34'; g.fillRect(poleX - 2.1, -199, 4.2, 3); g.fillRect(poleX - 2, bot - 7, 4, 7); }
      else { blob(g, poleX, top, 2.5, 2.8, '#7a5c3a'); blob(g, poleX + 0.3, top + 44, 2.1, 1.6, '#6a4e30', 0.8); }
    }
    function shieldDraw() {
      const sx = sw + 4, sy = -112;
      if (back) { cloth(g, [[sx + 2, sy - 25], [sx + 16, sy - 22, sx + 16, sy], [sx + 16, sy + 22, sx + 2, sy + 25]], '#5a3d24', sx, sx + 16, 0.4); stroke(g, [[sx + 3, sy - 24], [sx + 16, sy - 21, sx + 16, sy], [sx + 16, sy + 21, sx + 3, sy + 24]], '#b98a34', 1.6, 0.9); return; }
      const shg = g.createRadialGradient(sx - 6, sy - 8, 3, sx, sy, 27); shg.addColorStop(0, '#b98658'); shg.addColorStop(0.75, '#7a5232'); shg.addColorStop(1, '#4a2f1b');
      g.fillStyle = shg; g.beginPath(); g.ellipse(sx, sy, 19, 26, 0, 0, TAU); g.fill();
      g.strokeStyle = '#b98a34'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(sx, sy, 18, 25, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(60,36,16,.5)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(sx, sy, 11.5, 16, 0, 0, TAU); g.stroke();
      const bg2 = g.createRadialGradient(sx - 2, sy - 2, 1, sx, sy, 6); bg2.addColorStop(0, '#f0d27a'); bg2.addColorStop(1, '#7a5a1e'); g.fillStyle = bg2; g.beginPath(); g.arc(sx, sy, 5.5, 0, TAU); g.fill();
      g.fillStyle = '#c9a04a'; for (let i = 0; i < 8; i++) { const a = i * PI / 4 + 0.4; g.beginPath(); g.arc(sx + Math.cos(a) * 14.6, sy + Math.sin(a) * 20.4, 0.9, 0, TAU); g.fill(); }
    }
    function jarDraw() {
      const x = sw + 2;
      trace(g, [[x - 6, sh - 5], [x + 6, sh - 5], [x + 17, sh - 22, x + 14, sh - 42], [x + 11, sh - 52, x + 5.5, sh - 55], [x + 5, sh - 60], [x - 5, sh - 60], [x - 5.5, sh - 55], [x - 11, sh - 52, x - 14, sh - 42], [x - 17, sh - 22, x - 6, sh - 5]]);
      const jg = g.createLinearGradient(x - 15, 0, x + 16, 0); jg.addColorStop(0, '#d9a070'); jg.addColorStop(0.4, '#b06c44'); jg.addColorStop(1, '#6e3f26'); g.fillStyle = jg; g.fill();
      cloth(g, [[x - 6.4, sh - 63], [x + 6.4, sh - 63], [x + 6, sh - 59.4], [x - 6, sh - 59.4]], '#8a5434', x - 6, x + 6, 0.4);
      stroke(g, [[x - 5.4, sh - 57], [x - 12.5, sh - 56, x - 12.5, sh - 45]], '#8a5434', 2.2); stroke(g, [[x + 5.4, sh - 57], [x + 12.5, sh - 56, x + 12.5, sh - 45]], '#6e3f26', 2.2);
      stroke(g, [[x - 14, sh - 36], [x, sh - 33.5, x + 14.6, sh - 36]], '#6e3f26', 1, 0.6); stroke(g, [[x - 14.6, sh - 32], [x, sh - 29.5, x + 15, sh - 32]], '#6e3f26', 1, 0.6);
      blob(g, x - 7, sh - 34, 2.2, 9, '#f2c9a0', 0.3, 0.12);
    }
    function sackDraw() {
      if (back) { const pts = [[sw - 20, sh + 2], [sw - 8, sh - 12, sw + 6, sh - 4], [sw + 14, sh + 18, sw + 9, sh + 42], [sw - 6, sh + 54, sw - 22, sh + 44], [sw - 30, sh + 22, sw - 20, sh + 2]]; cloth(g, pts, '#c2ac80', sw - 28, sw + 14); fold(g, sw - 12, sh, sw - 8, sh + 22, sw - 14, sh + 46, '#c2ac80', 0.26); fold(g, sw - 2, sh + 2, sw + 3, sh + 22, sw, sh + 44, '#c2ac80', 0.22); stroke(g, [[sw - 14, sh - 3], [sw - 6, sh - 6, sw + 1, sh - 2]], '#6a4e30', 1.4, 0.8); return; }
      cloth(g, [[sw - 10, sh - 8], [sw + 4, sh - 28, sw + 24, sh - 16], [sw + 31, sh + 10, sw + 20, sh + 26], [sw, sh + 28, sw - 8, sh + 12]], '#c2ac80', sw - 10, sw + 30);
      fold(g, sw + 8, sh - 18, sw + 16, sh, sw + 14, sh + 22, '#c2ac80', 0.26); fold(g, sw + 18, sh - 14, sw + 25, sh + 2, sw + 22, sh + 18, '#c2ac80', 0.2);
    }
    function sackNeck() { if (!back) { cloth(g, [[sw - 9, sh - 9], [sw + 2, sh - 12], [sw - 1, sh + 9], [sw - 8, sh + 11]], '#b39c70', sw - 9, sw + 2, 0.4); stroke(g, [[sw - 8.4, sh + 1], [sw - 0.4, sh - 1]], '#6a4e30', 1.3, 0.8); } }
    function itemDraw() {                                        // מה שמוחזק בשתי הידיים לפני החזה
      const x = 0, y = -114;
      if (carry === 'lamb') {
        for (const lx of [-9, -4, 9, 13]) limb(g, x + lx, y + 6, 1.9, x + lx + (lx < 0 ? -1 : 1), y + 17, 1.4, '#d9d0bb');
        trace(g, [[x - 18, y - 4], [x - 8, y - 17, x + 12, y - 13], [x + 22, y - 8, x + 20, y + 4], [x + 8, y + 12, x - 12, y + 9], [x - 22, y + 6, x - 18, y - 4]]);
        const lg = g.createLinearGradient(0, y - 15, 0, y + 12); lg.addColorStop(0, '#fbf8ef'); lg.addColorStop(1, '#cfc7b4'); g.fillStyle = lg; g.fill();
        g.strokeStyle = 'rgba(150,140,118,.5)'; g.lineWidth = 0.9; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(x - 14 + (i % 8) * 4.4, y - 6 + Math.floor(i / 8) * 7 + (i % 2) * 2, 2.6, 0, 3.4); g.stroke(); }
        blob(g, x + 23, y - 12, 7, 5.6, '#efe7d6', 1, 0.35); blob(g, x + 27.5, y - 9.6, 2.6, 2.1, '#d9bfae'); blob(g, x + 18, y - 15.5, 3.4, 1.7, '#d6cab2', 1, -0.5);
        blob(g, x + 24.6, y - 13, 1, 1, '#20140c'); blob(g, x - 20, y + 1, 3, 4, '#f3eee0');
      }
      if (carry === 'basket') {
        for (const b of [[-8, '#7a4a26'], [-1, '#c9973a'], [6, '#8f3a2c'], [11, '#6f7a3a'], [-4, '#b9742e']]) blob(g, x + b[0], y - 8 - (Math.abs(b[0]) % 3), 4.4, 4, b[1]);
        cloth(g, [[x - 15, y - 6], [x + 15, y - 6], [x + 12, y + 12, x + 8.5, y + 14.5], [x - 8.5, y + 14.5], [x - 12, y + 12, x - 15, y - 6]], '#b3945a', x - 15, x + 15);
        g.strokeStyle = 'rgba(70,50,20,.5)'; g.lineWidth = 0.8; g.beginPath(); for (let yy = -2.5; yy < 13; yy += 3.4) { g.moveTo(x - 14 + (yy + 2.5) * 0.2, y + yy); g.lineTo(x + 14 - (yy + 2.5) * 0.2, y + yy); } for (let xx = -12; xx <= 12; xx += 3) { g.moveTo(x + xx, y - 5); g.lineTo(x + xx * 0.8, y + 13.5); } g.stroke();
        stroke(g, [[x - 15.5, y - 6], [x + 15.5, y - 6]], '#8a6c3a', 2.2);
      }
      if (carry === 'doves') {
        g.fillStyle = 'rgba(150,118,70,.3)'; g.fillRect(x - 15, y - 15, 30, 26);
        blob(g, x - 5, y + 3.6, 5.4, 3.8, '#f4f4f0'); blob(g, x + 6.4, y + 2.6, 5.4, 3.8, '#e6e6e0'); blob(g, x - 0.8, y + 0.4, 2.2, 2.1, '#f4f4f0'); blob(g, x + 10.8, y - 0.6, 2.2, 2.1, '#e6e6e0'); blob(g, x + 0.2, y + 0.1, 0.5, 0.5, '#20140c'); blob(g, x + 11.6, y - 0.9, 0.5, 0.5, '#20140c');
        g.strokeStyle = '#6b4a2b'; g.lineWidth = 1; g.strokeRect(x - 15, y - 15, 30, 26); g.beginPath(); for (let xx = -11; xx < 15; xx += 4) { g.moveTo(x + xx, y - 15); g.lineTo(x + xx, y + 11); } g.stroke();
        stroke(g, [[x - 8, y - 15], [x, y - 22, x + 8, y - 15]], '#6b4a2b', 1.2);
      }
      if (carry === 'bowl') {
        trace(g, [[x - 14, y - 6], [x + 14, y - 6], [x + 10, y + 5.5, x, y + 6.5], [x - 10, y + 5.5, x - 14, y - 6]]); const bg3 = g.createLinearGradient(x - 14, 0, x + 14, 0); bg3.addColorStop(0, '#f5dc8c'); bg3.addColorStop(0.4, '#c9a04a'); bg3.addColorStop(1, '#7a5a1e'); g.fillStyle = bg3; g.fill();
        blob(g, x, y - 6, 14, 2.2, '#8a6a26'); blob(g, x, y - 5.8, 12, 1.5, '#5a3a1e', 0.8); blob(g, x - 2.4, y + 7, 4.4, 1.4, '#7a5a1e');
      }
    }
    function hornDraw(hx, hy2) {
      stroke(g, [[hx, hy2 - 2], [hx + 20, hy2 - 8, hx + 26, hy2 - 30]], '#d9c8a2', 5.5); stroke(g, [[hx + 23, hy2 - 16], [hx + 26, hy2 - 24, hx + 26.5, hy2 - 31]], '#e6d8b6', 6.5);
      stroke(g, [[hx + 2, hy2 + 1], [hx + 22, hy2 - 6, hx + 28.5, hy2 - 29]], '#8a7a58', 1, 0.8); for (const t of [0.3, 0.5, 0.7]) stroke(g, [[hx + 6 + t * 18, hy2 - 6 - t * 14], [hx + 9 + t * 18, hy2 - 2 - t * 16]], '#8a7a58', 0.6, 0.5);
    }

    // ================= הציור =================
    const P = { '-1': armPose(-1), '1': armPose(1) };
    const upper = lowY => {                                      // פלג הגוף העליון, במערכת של אדם עומד
      const tDn = pose === 'crouch' ? 1 : 0, hyy = HY + (pose === 'crouch' ? 5 : 0);
      if (carry === 'sack' && back === false && pose !== 'crouch') sackDraw();
      if (carry === 'spear' && back) shieldDraw();
      for (const sx of [-1, 1]) if (P[sx].layer === 'behind') armDraw(sx, P[sx]);
      lowY();
      for (const sx of [-1, 1]) if (P[sx].layer === 'front') armDraw(sx, P[sx], twoItem);
      if (pose === 'stand' || pose === 'talk') cloakDraw((long ? hem - 26 : hem + 6), false); else if (pose === 'sit' && !back) cloakDraw(wst + 31, false); else cloakDraw(wst + 9, true);
      headBehind(hyy); neckDraw();
      if (pose === 'crouch') { g.save(); g.translate(0, hyy); g.scale(1, 1 / sq); g.translate(0, -hyy); }
      headDraw(hyy, turn, tDn);
      if (pose === 'crouch') g.restore();
      if (pose !== 'crouch') {
        if (carry === 'jar') jarDraw();
        if (carry === 'sack') { if (back) sackDraw(); else sackNeck(); }
        if (pole) poleDraw();
        if (carry === 'spear' && !back) shieldDraw();
        if (twoItem && !back) { itemDraw(); for (const sx of [-1, 1]) handDraw(sx, P[sx].E, [sx * (carry === 'lamb' ? 9 : 13.5), -108], 'grip', 1, skin); }
        if (carry === 'horn' && !back) hornDraw(P[1].H[0], P[1].H[1]);
      }
      for (const sx of [-1, 1]) if (P[sx].layer === 'late') armDraw(sx, P[sx]);
    };
    const hemShade = y => { g.globalCompositeOperation = 'source-atop'; const hg = g.createLinearGradient(0, y, 0, y + 15); hg.addColorStop(0, 'rgba(24,12,2,.5)'); hg.addColorStop(1, 'rgba(24,12,2,0)'); g.fillStyle = hg; g.fillRect(-32, y - 3, 64, 18); g.globalCompositeOperation = 'source-over'; };

    if (pose === 'stand' || pose === 'talk') {
      for (const sx of legOrder) { leg(sx, 'leg'); if (!lateFoot(sx)) leg(sx, 'foot'); }
      hemShade(hem + dyB);
      const lean = () => { g.save(); g.translate(0, dyB); if (passing) g.transform(1, 0, ss * 0.017, 1, -ss * 0.017 * HY, 0); };
      lean();
      upper(() => {
        tunicStand();
        g.restore(); for (const sx of legOrder) if (lateFoot(sx)) leg(sx, 'foot'); lean();
        if (guard) guardArmour();
        sashBand(); sashEnds(priest ? 52 : 25, contact ? -fs * (back ? -1 : 1) * 1.6 : 0);
      });
      g.restore();
    } else if (pose === 'sit') {
      // ---------- ישיבה: הירכיים על המושב, הברכיים קדימה, כפות הרגליים על הקרקע ----------
      const shortT = hem < -54, hemS = shortT ? 0 : Math.min(-12, hem - 3), dim = back ? -0.2 : 0, sk = dim ? tone(skin, dim) : skin;
      for (const sx of [-1, 1]) { limb(g, sx * kxS, -51, 5.5, sx * (kxS - 0.6), -8.4, 3.2, sk); if (back) footHeel(sx * (kxS - 0.6), 0, 1, sx * 1.5, sk); else footFlat(sx * (kxS - 0.6), 0, 1.04, sx * 1.6, sk); }
      if (shortT) for (const sx of [-1, 1]) { limb(g, sx * 6.5, hipF + 1, 7.6, sx * kxS, -53, 6, sk); blob(g, sx * kxS - 0.8, -54, 3.4, 3, tone(sk, 0.18), 0.35); }
      else hemShade(hemS);
      const lap = () => {
        if (shortT) {
          const yh = hipF + (-52 - hipF) * 0.72 + 2;
          const pts = [[-wd - 3, hipF - 7], [wd + 3, hipF - 7], [kxS + 8.5, (hipF + yh) / 2, kxS + 7.5, yh], [kxS, yh + 2.4, 0, yh - 1], [-kxS, yh + 2.4, -kxS - 7.5, yh], [-kxS - 8.5, (hipF + yh) / 2, -wd - 3, hipF - 7]];
          cloth(g, pts, back ? tone(robe, -0.2) : robe, -kxS - 8, kxS + 9);
          fold(g, -1, hipF - 2, 0, (hipF + yh) / 2, 0.5, yh - 2, robe, 0.34, 2.2);
        } else {
          const X = kxS + 9, n = 6, hp = [];
          for (let i = 1; i <= n; i++) { const x = X + 1 - (2 * X + 2) * i / n; hp.push([x + (2 * X + 2) / n / 2, hemS + (i % 2 ? 2.2 : -1) + J[i] * 1.2, x, hemS + (i % 2 ? 1.1 : 0)]); }
          const pts = [[-wd - 3.5, hipF - 7], [wd + 3.5, hipF - 7], [X + 1.5, lapY - 3, X, lapY + 7], [X + 0.5, (lapY + hemS) / 2, X + 1, hemS]].concat(hp, [[-X - 0.5, (lapY + hemS) / 2, -X, lapY + 7], [-X - 1.5, lapY - 3, -wd - 3.5, hipF - 7]]);
          cloth(g, pts, back ? tone(robe, -0.2) : robe, -X - 3, X + 5);
          g.save(); trace(g, pts); g.clip();
          if (!back) { const tg = g.createLinearGradient(0, hipF - 7, 0, lapY + 3); tg.addColorStop(0, 'rgba(255,248,230,.05)'); tg.addColorStop(1, 'rgba(255,248,230,.26)'); g.fillStyle = tg; g.fillRect(-X - 3, hipF - 8, 2 * X + 6, lapY + 3 - hipF + 8); const dg = g.createLinearGradient(0, lapY + 2, 0, lapY + 13); dg.addColorStop(0, 'rgba(20,10,0,.34)'); dg.addColorStop(1, 'rgba(20,10,0,.1)'); g.fillStyle = dg; g.fillRect(-X - 3, lapY + 2, 2 * X + 6, 11); g.fillStyle = 'rgba(20,10,0,.1)'; g.fillRect(-X - 3, lapY + 13, 2 * X + 6, hemS - lapY); }
          if (stripe) { g.fillStyle = stripe; g.globalAlpha = 0.85; g.fillRect(-kxS - 1.5, lapY - 3, 3, hemS - lapY + 8); g.fillRect(kxS - 1.5, lapY - 3, 3, hemS - lapY + 8); g.globalAlpha = 1; }
          if (border || priest) stroke(g, [[X + 3, hemS - 4.6], [0, hemS - 3.4, -X - 3, hemS - 4.6]], priest ? '#b98a34' : mix(robe, trim, 0.8), priest ? 1.8 : 2.4, 0.85);
          if (!back) {
            for (const sx of [-1, 1]) { soft(g, sx * kxS - 1.2 * LS, lapY + 2.5, 7.5, 6, '#fff8e6', 0.34); soft(g, sx * kxS - 1 * LS, (lapY + hemS) / 2 + 4, 5.5, (hemS - lapY) * 0.5, '#fff8e6', 0.16); fold(g, sx * (kxS + 5.2), lapY + 5, sx * (kxS + 6.4), (lapY + hemS) / 2, sx * (kxS + 5.6), hemS - 2, robe, 0.24, 1.8); }
            g.fillStyle = 'rgba(20,10,0,.24)'; g.beginPath(); g.moveTo(-kxS + 4.4, lapY + 2.6); g.quadraticCurveTo(0, lapY + 6, kxS - 4.4, lapY + 2.6); g.lineTo(kxS - 5.4, hemS + 4); g.lineTo(-kxS + 5.4, hemS + 4); g.closePath(); g.fill();
            fold(g, -kxS + 4.4, lapY + 3, -2.5, (lapY + hemS) / 2, -kxS + 6, hemS - 2, robe, 0.3, 2); fold(g, kxS - 4.4, lapY + 3, 2.5, (lapY + hemS) / 2, kxS - 6, hemS - 2, robe, 0.26, 2);
            fold(g, -kxS * 0.2, hipF - 4, 0, (hipF + lapY) / 2 - 2, kxS * 0.1, lapY + 3, robe, 0.3, 2);
          } else for (const x of [-9, -3, 4, 10]) fold(g, x, lapY + 4, x * 1.05, (lapY + hemS) / 2, x * 1.1, hemS - 2, robe, 0.3, 2);
          g.restore();
        }
      };
      if (back) lap();
      g.save(); g.translate(0, hipF + 98);
      upper(() => {
        torsoOnly(back ? -89 : -92);
        sashBand();
        if (!back) { g.restore(); lap(); g.save(); g.translate(0, hipF + 98); sashEnds(priest ? 17 : 13, 0); }
      });
      g.restore();
    } else {
      // ---------- כריעה לעבודה: יושב על העקבים, רכון קדימה, הידיים לפנים ונמוך ----------
      const shortT = hem < -54;
      if (back) {
        for (const sx of [-1, 1]) { const pts = [[sx * 4, -13], [sx * 7.5, -15, sx * 11, -12], [sx * 13, -5, sx * 11.5, -0.2], [sx * 4.5, 0], [sx * 2.6, -6, sx * 4, -13]]; if (barefoot) flesh(g, pts, tone(skin, -0.2)); else cloth(g, pts, '#6a4a2c', -12, 13, 0.35); }
        const pts = [[-wd - 4, -34], [wd + 4, -34], [wd + 11, -24, wd + 9, -11], [wd + 6, -3.5, 9, -4.5], [3, -7, 0, -5], [-3, -7, -9, -4.5], [-wd - 6, -3.5, -wd - 9, -11], [-wd - 11, -24, -wd - 4, -34]];
        cloth(g, pts, robe, -wd - 10, wd + 12);
        fold(g, 0, -30, 0.6, -18, 0, -7, robe, 0.34, 2.2); fold(g, -10, -30, -13, -18, -11, -6, robe, 0.2); fold(g, 10, -30, 14, -18, 12, -6, robe, 0.2);
      } else {
        if (shortT) for (const sx of [-1, 1]) { limb(g, sx * 8, -24, 8.2, sx * 13.5, -7, 6.8, skin); blob(g, sx * 13.5 - 1, -7.6, 4, 3.6, tone(skin, 0.18), 0.35); }
        const pts = shortT
          ? [[-wd - 4, -34], [wd + 4, -34], [wd + 10, -24, wd + 6.5, -13.5], [10, -10, 0, -14], [-10, -10, -wd - 6.5, -13.5], [-wd - 10, -24, -wd - 4, -34]]
          : [[-wd - 4, -34], [wd + 4, -34], [wd + 12, -26, 24.5, -11], [26, -1, 19, 0], [10, 0.6, 5, -1.5], [1.5, -4.5, 0, -4.5], [-1.5, -4.5, -5, -1.5], [-10, 0.6, -19, 0], [-26, -1, -24.5, -11], [-wd - 12, -26, -wd - 4, -34]];
        cloth(g, pts, robe, -24, 27);
        g.save(); trace(g, pts); g.clip();
        if (!shortT) {
          for (const sx of [-1, 1]) { blob(g, sx * 13.5 - 1.6, -9, 7, 6.6, 'rgb(255,248,230)', 0.2); fold(g, sx * 6, -30, sx * 19, -24, sx * 22.5, -8, robe, 0.22, 1.8); fold(g, sx * 4.5, -22, sx * 6.5, -12, sx * 5.6, -2, robe, 0.3, 2); }
          g.fillStyle = 'rgba(20,10,0,.26)'; g.beginPath(); g.moveTo(-5, -24); g.quadraticCurveTo(0, -20, 5, -24); g.lineTo(4.5, 0); g.lineTo(-4.5, 0); g.closePath(); g.fill();
          if (border || priest) stroke(g, [[25, -5], [12, -3.6, 4.5, -5.4]], priest ? '#b98a34' : mix(robe, trim, 0.8), 2, 0.8), stroke(g, [[-25, -5], [-12, -3.6, -4.5, -5.4]], priest ? '#b98a34' : mix(robe, trim, 0.8), 2, 0.8);
        } else fold(g, 0, -30, 0.5, -22, 0, -14, robe, 0.3, 2);
        g.restore();
      }
      g.save(); g.translate(0, hipF + 98 * sq); g.scale(1, sq);
      upper(() => { torsoOnly(-91); sashBand(); });
      g.restore();
    }
    g.restore();

    // גרעיניות עדינה ואור צד על כל הדמות, כדי שלא תיראה שטוחה
    g.globalCompositeOperation = 'source-atop';
    const lg2 = g.createLinearGradient(Wd * 0.2, 0, Wd * 0.85, 0); lg2.addColorStop(0, 'rgba(255,246,225,.10)'); lg2.addColorStop(0.5, 'rgba(0,0,0,0)'); lg2.addColorStop(1, 'rgba(20,12,4,.2)');
    g.fillStyle = lg2; g.fillRect(0, 0, Wd, Hh);
    const vg = g.createLinearGradient(0, 0, 0, Hh); vg.addColorStop(0, 'rgba(255,250,235,.06)'); vg.addColorStop(1, 'rgba(30,20,8,.14)'); g.fillStyle = vg; g.fillRect(0, 0, Wd, Hh);
    const N = rng(seed + 977);
    for (let i = 0; i < 1100; i++) { g.fillStyle = N() > 0.5 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.055)'; g.fillRect(N() * Wd, N() * Hh, 1.4, 1.4); }
    g.globalCompositeOperation = 'source-over';
  }

  /* ======================================================================= בעלי חיים */
  const BEAST = {
    sheep:  { k: 0.6,  ox: 0,  body: '#e9e1cd', leg: '#a08a6c', head: '#5a4636', muz: '#3d2f25', back: -70, belly: -33, rump: -37, chest: 35, fT: [23, -36], hT: [-24, -37], N: [30, -61], nl: 14, nr: [10, 7],  na: -0.78, hl: 20, hd: 11.5, hm: 6.8, ha: 1.3,  cv: 3.2, lr: [3.5, 2.3, 1.8], hoof: 3.4, amp: 6 },
    goat:   { k: 0.6,  ox: 0,  body: '#4d3d31', leg: '#3a2d24', head: '#4d3d31', muz: '#8a735e', back: -70, belly: -39, rump: -35, chest: 33, fT: [22, -40], hT: [-23, -41], N: [28, -61], nl: 15, nr: [9.4, 6.2],  na: -0.98, hl: 21, hd: 11,   hm: 6,   ha: 1.42, cv: 0.2, lr: [3.8, 2.4, 1.8], hoof: 3.2, amp: 6.5 },
    donkey: { k: 0.78, ox: -5, body: '#9a8e84', leg: '#857a71', head: '#948980', muz: '#e6ded2', back: -72, belly: -42, rump: -38, chest: 36, fT: [24, -44], hT: [-26, -46], N: [31, -63], nl: 20, nr: [11, 7.6], na: -0.86, hl: 28, hd: 13.5, hm: 8.4, ha: 1.5,  cv: 1.2, lr: [4.4, 2.8, 2.2], hoof: 4.2, amp: 7 },
    ox:     { k: 0.86, ox: -9, body: '#8d5f3e', leg: '#7a5134', head: '#87593a', muz: '#d9c2a8', back: -74, belly: -37, rump: -42, chest: 40, fT: [27, -40], hT: [-30, -42], N: [36, -61], nl: 12, nr: [15, 11],   na: -0.2,  hl: 29, hd: 16.5, hm: 11,  ha: 0.86, cv: 0.6, lr: [5.6, 3.5, 2.8], hoof: 4.4, amp: 7 }
  };
  function drawAnimal(c, kind, o) {
    o = o || {};
    if (kind === 'dove') return drawDove(c, o);
    const B = BEAST[kind] || BEAST.sheep;
    const g = c.getContext('2d'), Wd = c.width, Hh = c.height, u = Hh / 110, R = rng(kind.length * 31 + 7);
    g.clearRect(0, 0, Wd, Hh); g.lineJoin = 'round';
    const sheep = kind === 'sheep', goat = kind === 'goat', ox = kind === 'ox', donkey = kind === 'donkey';
    const k = B.k, body = B.body, dark = tone(body, -0.34);
    const rest = !!o.rest, st = !rest && o.stride >= 1 && o.stride <= 4 ? Math.floor(o.stride) : 0, graze = !!o.graze, look = !!o.look && !graze;
    LS = o.flip ? -1 : 1;
    g.save(); g.translate(Wd / 2, Hh - 4 * u); g.scale(u * k * LS, u * k); g.translate(B.ox, 0);
    shadow(g, rest ? -2 : 0, rest ? 58 : 52, rest ? 0.17 : 0.2);
    const drop = rest ? -B.belly - 4 : 0;                        // ברביצה הגוף יורד אל הקרקע
    const hoofC = donkey ? '#2a211b' : '#1e1610';

    // ---------- רגל: מפרק עליון, ברך (או קרסול אחורי), פרסה. הפרסה הנטועה תמיד על קו הקרקע ----------
    const lowC = sheep ? B.leg : tone(body, -0.27);
    function leg(T, off, lift, front, far) {
      const h = -T[1] - B.hoof, L = h * (front ? 1.035 : 1.1), a = L * (front ? 0.5 : 0.48), b = L - a;
      const ax = T[0] + off + (front ? 0 : -5), ay = -B.hoof - lift;
      let dx = ax - T[0], dy = ay - T[1], d = Math.hypot(dx, dy); if (d > L - 0.01) d = L - 0.01;
      const base = Math.atan2(dy, dx), al = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
      const k1 = [T[0] + a * Math.cos(base + al), T[1] + a * Math.sin(base + al)], k2 = [T[0] + a * Math.cos(base - al), T[1] + a * Math.sin(base - al)];
      const K = (front ? k1[0] > k2[0] : k1[0] < k2[0]) ? k1 : k2;
      const col = far ? tone(lowC, -0.3) : lowC, r = B.lr;
      // החלק העליון: שריר שנמשך מן הגוף ומתחדד אל הברך — בצבע הגוף, כדי שלא ייראה כאיבר נפרד
      const w0 = r[0] * (front ? 1.35 : 2.1), ty = T[1] - (front ? 9 : 13), my = (ty + K[1]) / 2;
      const up = front
        ? [[T[0] - w0, ty], [T[0] + w0, ty], [T[0] + w0 * 0.95, my, K[0] + r[1], K[1]], [K[0] - r[1], K[1]], [T[0] - w0 * 1.1, my, T[0] - w0, ty]]
        : [[T[0] - w0 * 0.85, ty], [T[0] + w0, ty], [T[0] + w0 * 0.8, my - 2, K[0] + r[1] * 1.15, K[1] - 1], [K[0] - r[1] * 0.9, K[1] + 0.6], [T[0] - w0 * 1.3, my + 1, T[0] - w0 * 0.85, ty]];
      trace(g, up);
      if (far || sheep) g.fillStyle = far ? tone(lowC, -0.34) : lowC;
      else { const lg = g.createLinearGradient(0, B.back - 3, 0, B.belly + 14); lg.addColorStop(0, tone(body, 0.22)); lg.addColorStop(0.36, body); lg.addColorStop(0.66, tone(body, -0.3)); lg.addColorStop(1, lowC); g.fillStyle = lg; }
      g.fill();
      if (!far && !sheep) stroke(g, front ? [[T[0] - w0, ty + 4], [T[0] - w0 * 1.1, my, K[0] - r[1], K[1]]] : [[T[0] + w0, ty + 5], [T[0] + w0 * 0.8, my - 2, K[0] + r[1] * 1.15, K[1] - 1]], tone(body, -0.5), 1.2, 0.28);
      limb(g, K[0], K[1], r[1] * 0.96, ax, ay, r[2], col, 0.12, -0.3);
      blob(g, K[0] + (front ? 0.4 : -0.7), K[1] + (front ? 0 : -0.4), r[1] * (front ? 1.06 : 1.02), r[1] * 1.14, far ? col : tone(col, 0.05));
      g.save(); g.translate(ax, ay);
      if (lift > 0) g.rotate(Math.atan2(ay - K[1], ax - K[0]) - PI / 2 + 0.25);
      trace(g, [[-r[2] - 0.5, -0.8], [r[2] + 0.3, -0.8], [r[2] + 2.4, B.hoof], [-r[2] - 0.7, B.hoof]]); g.fillStyle = hoofC; g.fill();
      if (!donkey) stroke(g, [[0.6, 0.4], [1.2, B.hoof]], '#000', 0.5, 0.5);
      blob(g, 0, -1.2, r[2] + 0.5, 1.2, far ? col : tone(col, -0.12));
      g.restore();
    }
    function hornShape(ax, ay, cx, cy, tx, ty, w, col, tip) {      // קרן מתחדדת
      const dx = cx - ax, dy = cy - ay, d = Math.hypot(dx, dy) || 1, nx = -dy / d * w, ny = dx / d * w;
      trace(g, [[ax - nx, ay - ny], [cx - nx * 0.75, cy - ny * 0.75, tx, ty], [cx + nx * 0.75, cy + ny * 0.75, ax + nx, ay + ny]]);
      const hg = g.createLinearGradient(ax, ay, tx, ty); hg.addColorStop(0, tone(col, -0.12)); hg.addColorStop(0.55, col); hg.addColorStop(1, tip || tone(col, -0.5)); g.fillStyle = hg; g.fill();
    }
    function legFolded(T, front, far) {                          // רגל מקופלת מתחת לגוף
      const col = far ? tone(B.leg, -0.3) : B.leg, r = B.lr, x = T[0] + (far ? 5 : 0);
      if (front) {
        const Kx = x + 13, Ky = -r[1] - 1.2;
        limb(g, Kx, Ky + 0.6, r[1] * 0.9, x + 1, -r[2] - 0.6, r[2], tone(col, -0.16));
        trace(g, [[x - 3.6, -B.hoof + 0.4], [x + 1.4, -B.hoof - 0.6], [x + 1.6, 0], [x - 4.4, 0]]); g.fillStyle = hoofC; g.fill();
        limb(g, x - 1, -11, r[0] * 1.2, Kx, Ky, r[1], far ? tone(col, -0.1) : (sheep ? col : tone(body, -0.16)));
        blob(g, Kx + 0.6, Ky, r[1] * 1.15, r[1] * 1.15, col);
      } else {
        const Hx = x - 7, Hy = -r[1] - 2.2;
        limb(g, Hx, Hy, r[1], x + 6, -r[2] - 0.8, r[2], col);
        blob(g, Hx - 0.4, Hy, r[1] * 1.15, r[1] * 1.2, col);
        trace(g, [[x + 6.6, -2 * r[2] - 1.6], [x + 6.6 + B.hoof, -2 * r[2] - 0.2], [x + 7.6 + B.hoof, 0], [x + 6, 0]]); g.fillStyle = hoofC; g.fill();
      }
    }
    // שלבי הצעד: זוג א' (קדמית קרובה + אחורית רחוקה), זוג ב' (קדמית רחוקה + אחורית קרובה)
    const A = B.amp, ph = p => st === 0 ? [0, 0] : p === 0 ? [[A, 0], [0, 0], [-A, 0], [1.5, 1]][st - 1] : [[-A, 0], [1.5, 1], [A, 0], [0, 0]][st - 1];
    const fT = B.fT, hT = B.hT, fT2 = [fT[0] - 5, fT[1]], hT2 = [hT[0] + 5, hT[1]];
    const lf = (T, pr, front, far) => { const p = ph(pr); leg(T, p[0] * (front ? 1 : 0.9), p[1] * (front ? 5.6 : 4.2), front, far); };

    if (rest) { legFolded(fT, true, true); } else { lf(hT2, 0, false, true); lf(fT2, 1, true, true); if (sheep) { lf(hT, 1, false, false); lf(fT, 0, true, false); } }

    // ---------- הזנב ----------
    g.save(); g.translate(0, drop);
    const tw = st === 1 ? 2 : st === 3 ? -2 : 0;
    if (donkey || ox) {
      const tx = B.rump - 1, ty = B.back + 6;
      if (rest) { stroke(g, [[tx + 2, ty], [tx - 9, ty + 14, tx - 4, -drop - 4]], dark, 2.6); blob(g, tx - 1, -drop - 3.5, 5.5, 2.4, tone(dark, -0.3)); }
      else { stroke(g, [[tx + 2, ty], [tx - 8, ty + 12, tx - 5 + tw, ty + 32]], dark, ox ? 3 : 2.6); blob(g, tx - 5 + tw * 1.4, ty + 37, 2.8, 6.5, tone(dark, -0.3), 1, tw * 0.06); }
    } else if (goat) { stroke(g, [[B.rump + 2, B.back + 5], [B.rump - 5, B.back + 2, B.rump - 6, B.back - 5 + (rest ? 6 : 0)]], dark, 3.4); }
    g.restore();

    // ---------- הצוואר והראש ----------
    const hCol = B.head, nCol = body;
    function headProfile() {                                     // בצדודית; x לאורך הפנים, y אל הגרון
      const hl = B.hl, d = B.hd, m = B.hm, top = -(0.45 * d + 0.5 * m) / 2 - B.cv;
      if (goat || ox) {                                          // הקרן הרחוקה
        if (ox) hornShape(1, -d * 0.4, -9, -d * 0.4 - 7, 0, -d * 0.4 - 17, 2.6, '#b9ad94', '#4a4234');
        else hornShape(3.4, -d * 0.42, 2, -d * 0.44 - 13, -11, -d * 0.44 - 17, 1.9, '#8f8672');
      }
      if (donkey) { trace(g, [[-1.5, -d * 0.36], [-5.5, -d * 0.36 - 11, -11.4, -d * 0.36 - 21.5], [-5.5, -d * 0.36 - 15, 1.6, -d * 0.4]]); g.fillStyle = tone(hCol, -0.3); g.fill(); }
      const pts = [[-3, -d * 0.45], [hl * 0.5, top, hl - 1, -m * 0.5], [hl + 1.9, -m * 0.45, hl + 1.6, m * 0.15], [hl + 1.1, m * 0.64, hl - 3, m * 0.62], [hl * 0.52, m * 0.72 + 1, hl * 0.3, d * 0.55], [hl * 0.08, d * 0.64, -3.5, d * 0.34]];
      trace(g, pts);
      const hg = g.createLinearGradient(0, -d * 0.6, 0, d * 0.6); hg.addColorStop(0, tone(hCol, 0.16)); hg.addColorStop(0.55, hCol); hg.addColorStop(1, tone(hCol, -0.3)); g.fillStyle = hg; g.fill();
      g.save(); g.clip();
      const mg = g.createLinearGradient(hl * 0.58, 0, hl * 0.86, 0); mg.addColorStop(0, alpha(B.muz, 0)); mg.addColorStop(1, alpha(B.muz, donkey ? 0.95 : 0.8)); g.fillStyle = mg; g.fillRect(hl * 0.5, -d, hl, 2 * d);
      if (donkey) blob(g, hl * 0.33, -d * 0.12, 3.6, 3, '#d9d0c2', 0.5);
      if (ox) blob(g, hl + 0.4, 0, 3.4, m * 0.62, '#3a2a22', 0.55);
      g.restore();
      blob(g, hl - 0.2, -m * 0.12, 1.15, 0.75, '#17100b', 0.95, 0.5);                                           // נחיר
      stroke(g, [[hl + 1.2, m * 0.3], [hl - 2.5, m * 0.22, hl - 5.5, m * 0.4]], '#17100b', 0.6, 0.6);           // הפה
      const exx = hl * 0.31, eyy = -d * 0.15;
      blob(g, exx, eyy, 1.9, 1.6, '#17100b'); blob(g, exx, eyy, 1.2, 1.1, sheep || goat ? '#6a4a22' : '#2a1a10'); blob(g, exx + 0.1, eyy, 0.6, 0.75, '#0a0604'); blob(g, exx + 0.55, eyy - 0.6, 0.42, 0.42, '#fff', 0.8);
      stroke(g, [[exx - 2.2, eyy - 1.3], [exx, eyy - 2.4, exx + 2.2, eyy - 1.1]], tone(hCol, -0.45), 0.7, 0.6);
      if (donkey) { trace(g, [[1.6, -d * 0.4], [-2.6, -d * 0.4 - 12, -8, -d * 0.4 - 23], [-1.6, -d * 0.4 - 17, 5, -d * 0.42 - 1]]); g.fillStyle = tone(hCol, -0.06); g.fill(); trace(g, [[1.8, -d * 0.4 - 3], [-2, -d * 0.4 - 12, -5.6, -d * 0.4 - 19.6], [-0.8, -d * 0.4 - 14, 3.2, -d * 0.4 - 3]]); g.fillStyle = '#c9ad9c'; g.fill(); blob(g, 3.6, -d * 0.46, 3.2, 1.8, '#3c2f27', 0.9, 0.3); }
      else if (ox) { blob(g, -4.5, -d * 0.1, 5.6, 2.5, tone(hCol, -0.2), 1, -0.25); blob(g, -4.6, -d * 0.1, 3.4, 1.2, '#c9a08a', 0.7, -0.25); hornShape(3.5, -d * 0.42, -7, -d * 0.42 - 9, 5, -d * 0.42 - 20, 3, '#e6dcc4', '#4a4234'); }
      else {
        if (goat) { hornShape(5.4, -d * 0.44, 4.5, -d * 0.46 - 14, -9.5, -d * 0.46 - 19, 2.3, '#b9ad94'); trace(g, [[hl - 6.5, m * 0.62], [hl - 5, m * 0.62 + 8, hl - 7.6, m * 0.62 + 9.5], [hl - 9.6, m * 0.6 + 4, hl - 10, m * 0.7]]); g.fillStyle = tone(hCol, -0.25); g.fill(); }
        blob(g, sheep ? -1.4 : -2, d * (sheep ? 0.2 : 0.26), sheep ? 3 : 2.8, sheep ? 7 : 8, tone(hCol, sheep ? -0.22 : -0.3), 1, sheep ? 0.5 : 0.62);                    // אוזן שמוטה
        if (sheep) { blob(g, -1.2, -d * 0.4, 5, 3.4, tone(body, -0.03)); blob(g, 1.5, -d * 0.5, 2.6, 2, '#f6f1e4', 0.8); }
      }
    }
    function headFront() {                                       // הראש פונה אל הצופה
      const fw = sheep ? 5.8 : goat ? 5.2 : donkey ? 6.4 : 8.6, fh = sheep ? 17 : goat ? 16.5 : donkey ? 25 : 22, mw = sheep ? 3.7 : goat ? 3.2 : donkey ? 4.8 : 6.6;
      if (donkey) for (const s of [-1, 1]) { trace(g, [[s * fw * 0.3, -1], [s * (fw + 4.6), -9, s * (fw + 2.6), -24], [s * (fw - 2.4), -14, s * fw * 0.95, 1]]); g.fillStyle = tone(hCol, s < 0 ? -0.02 : -0.2); g.fill(); trace(g, [[s * fw * 0.5, -2], [s * (fw + 2.6), -10, s * (fw + 2.2), -20.5], [s * (fw - 0.8), -12, s * fw * 0.85, -1]]); g.fillStyle = '#c9ad9c'; g.fill(); }
      if (ox) for (const s of [-1, 1]) { hornShape(s * fw * 0.6, -3.6, s * (fw + 11), -3, s * (fw + 9), -18, 2.9, s < 0 ? '#e6dcc4' : '#b9ad94', '#4a4234'); blob(g, s * (fw + 4.6), 2.4, 5.4, 2.5, tone(hCol, s < 0 ? -0.1 : -0.3), 1, s * 0.25); }
      if (goat) for (const s of [-1, 1]) { hornShape(s * 2.4, -3.6, s * 3.6, -15, s * 10.5, -21, 2.1, s < 0 ? '#b9ad94' : '#8f8672'); blob(g, s * (fw + 3.8), 4, 5.4, 2.3, tone(hCol, s < 0 ? -0.2 : -0.36), 1, s * 0.7); trace(g, [[-1.8, fh + 0.6], [0, fh + 9], [1.8, fh + 0.6]]); g.fillStyle = tone(hCol, -0.25); g.fill(); }
      if (sheep) for (const s of [-1, 1]) blob(g, s * (fw + 3.6), 4.4, 5.2, 2.3, tone(hCol, s < 0 ? -0.1 : -0.3), 1, s * 0.62);
      trace(g, [[-fw * 0.8, -3], [0, -6.2, fw * 0.8, -3], [fw * 1.22, fh * 0.26, mw, fh * 0.84], [mw, fh + 1.6, 0, fh + 1.6], [-mw, fh + 1.6, -mw, fh * 0.84], [-fw * 1.22, fh * 0.26, -fw * 0.8, -3]]);
      const hg = g.createLinearGradient(-fw, 0, fw, 0); hg.addColorStop(0, tone(hCol, 0.14)); hg.addColorStop(0.5, hCol); hg.addColorStop(1, tone(hCol, -0.3)); g.fillStyle = hg; g.fill();
      g.save(); g.clip(); const mg = g.createLinearGradient(0, fh * 0.56, 0, fh * 0.86); mg.addColorStop(0, alpha(B.muz, 0)); mg.addColorStop(1, alpha(B.muz, donkey ? 0.95 : 0.8)); g.fillStyle = mg; g.fillRect(-fw * 2, fh * 0.5, fw * 4, fh);
      stroke(g, [[-0.6, 0], [-0.4, fh * 0.6]], tone(hCol, 0.3), 1.6, 0.3); g.restore();
      for (const s of [-1, 1]) { const x = s * fw * 0.74, y = fh * 0.25; if (donkey) blob(g, x, y, 2.6, 2.6, '#d9d0c2', 0.5); blob(g, x, y, 1.6, 1.8, '#17100b'); blob(g, x, y, 1, 1.25, sheep || goat ? '#6a4a22' : '#2a1a10'); blob(g, x, y, 0.5, 0.8, '#0a0604'); blob(g, x - 0.4, y - 0.7, 0.4, 0.4, '#fff', 0.8); }
      for (const s of [-1, 1]) blob(g, s * mw * 0.46, fh * 0.9, ox ? 1.3 : 0.9, ox ? 0.9 : 0.65, '#17100b', 0.9, s * 0.5);
      stroke(g, [[0, fh * 0.96], [0, fh + 0.4]], '#17100b', 0.5, 0.6); stroke(g, [[-mw * 0.5, fh + 0.4], [0, fh + 1.2, mw * 0.5, fh + 0.4]], '#17100b', 0.5, 0.5);
      if (sheep) { blob(g, 0, -4, fw * 0.86, 3.6, tone(body, -0.02)); blob(g, -1.6, -5, 2.6, 2, '#f6f1e4', 0.8); }
      if (donkey) blob(g, 0, -3.6, 3.6, 3.4, '#3c2f27', 0.92);
    }
    const hlen = B.hl;
    let nlen = B.nl, NB = B.N, rb = B.nr[0], na = B.na + (rest ? -0.16 : 0) + (look ? -0.14 : 0), ha = B.ha;
    if (graze && rest) {                                         // ברביצה: הראש נח על הקרקע
      ha = 0.2; const Ny = B.N[1] + drop, tgt = -B.hm * 0.55;
      let lo = B.na, hi = 1.35; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2, y = Ny + nlen * Math.sin(m) + (hlen + 1.5) * Math.sin(m + ha); if (y < tgt) lo = m; else hi = m; } na = lo;
    } else if (graze) {                                          // ברעייה: הצוואר נמתח מן הכתף עד שהחרטום נוגע בקרקע
      NB = ox ? [B.chest - 14, B.back + 13] : [B.chest - 7, B.back + 0.56 * (B.belly - B.back)]; na = ox ? 1.0 : 1.16; ha = ox ? 0.46 : 0.34; rb = B.nr[0] * (ox ? 0.92 : 0.8);
      nlen = Math.max(B.nl, ((-1.2 - NB[1]) - (hlen + 1.5) * Math.sin(na + ha)) / Math.sin(na));
    }
    function neckHead() {
      g.save(); g.translate(NB[0], NB[1] + drop); g.rotate(na);
      const rp = B.nr[1];
      if (ox && !graze) { g.save(); g.rotate(-na); trace(g, [[2, 2], [16, 6, 15, 14], [12, 24, 0, 27], [-9, 16, 2, 2]]); g.fillStyle = tone(body, -0.24); g.fill(); stroke(g, [[8, 8], [8, 17, 3, 24]], tone(body, -0.5), 1, 0.3); g.restore(); }      // פימה
      trace(g, [[-4, -rb], [nlen * 0.5, -(rb + rp) / 2 + 1.2, nlen + 1, -rp], [nlen + 3, 0, nlen + 1.5, rp * 0.9], [nlen * 0.5, (rb + rp) / 2 - 0.6, -3, rb]]);
      const ng = g.createLinearGradient(0, -rb, 0, rb); ng.addColorStop(0, tone(nCol, sheep ? 0.06 : 0.14)); ng.addColorStop(0.5, sheep ? tone(nCol, -0.05) : nCol); ng.addColorStop(1, tone(nCol, -0.3)); g.fillStyle = ng; g.fill();
      if (sheep) { g.save(); g.clip(); for (let i = 0; i < 12; i++) { const x = -2 + (i % 6) * 3.4, y = -rb + 3 + Math.floor(i / 6) * 7 + (i % 2) * 2.6; curl(x, y, 3.6); } g.restore(); }
      if (donkey) { g.strokeStyle = '#3c2f27'; g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); for (let i = 0; i <= 9; i++) { const t = i / 9, x = -2 + t * (nlen + 2), y = -rb + (rb - rp) * t + 1.1 * Math.sin(t * PI); g.moveTo(x, y + 1); g.lineTo(x + 1.6, y - 3.4); } g.stroke(); }
      if (goat) { g.strokeStyle = tone(body, -0.3); g.lineWidth = 1; g.globalAlpha = 0.6; g.beginPath(); for (let i = 0; i < 6; i++) { const x = 1 + i * 2.4; g.moveTo(x, rb - 3 - i * 0.3); g.lineTo(x - 1.5, rb + 2.5 - i * 0.4); } g.stroke(); g.globalAlpha = 1; }
      g.translate(nlen, 0);
      if (look) { g.rotate(-na); g.translate(1.5, -B.hd * 0.3); headFront(); }
      else { g.rotate(ha); headProfile(); }
      g.restore();
    }
    function curl(x, y, r) { const wg = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 0.5, x, y, r); wg.addColorStop(0, 'rgba(255,253,244,.62)'); wg.addColorStop(0.7, 'rgba(232,224,205,.34)'); wg.addColorStop(1, 'rgba(150,138,112,.3)'); g.fillStyle = wg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }

    neckHead();                                                  // הצוואר יוצא מאחורי קו הגוף, גם ברעייה

    // ---------- הגוף ----------
    g.save(); g.translate(0, drop);
    const bk = B.back, bl = B.belly, rx = B.rump, cx = B.chest;
    const bpts = sheep ? [[rx, -52], [rx - 3, bk + 1, rx + 14, bk - 1], [-6, bk - 3, 18, bk - 2], [cx - 2, bk, cx + 2, -56], [cx + 4, -42, cx - 6, bl - 1], [8, bl + 3, -16, bl + 1], [rx + 2, bl, rx, -52]]
      : goat ? [[rx, -56], [rx - 1, bk + 1, rx + 10, bk], [-6, bk + 2.5, 18, bk - 2], [cx - 3, bk - 1, cx + 1, -57], [cx + 2, -46, cx - 8, bl - 1], [6, bl + 1, -14, bl - 2], [rx + 1, bl - 2, rx, -56]]
      : donkey ? [[rx, -56], [rx - 2, bk, rx + 12, bk - 1], [-8, bk + 4, 18, bk - 3], [cx - 2, bk - 2, cx + 2, -56], [cx + 3, -45, cx - 7, bl - 1], [6, bl + 3.5, -16, bl], [rx + 1, bl - 2, rx, -56]]
      : [[rx, -60], [rx - 1, bk - 1, rx + 10, bk - 1], [-10, bk + 3, 8, bk - 1.5], [20, bk - 7, 30, bk - 1], [cx + 1, bk + 4, cx + 2, -54], [cx + 5, -40, cx - 5, bl - 4], [10, bl + 4, -14, bl + 1], [rx + 6, bl - 3, rx + 1, -46], [rx - 3, -52, rx, -60]];
    trace(g, bpts);
    const bg = g.createLinearGradient(0, bk - 3, 0, bl + 2); bg.addColorStop(0, tone(body, sheep ? 0.1 : 0.22)); bg.addColorStop(0.45, body); bg.addColorStop(0.82, tone(body, -0.3)); bg.addColorStop(1, donkey ? '#d6cdc0' : ox ? tone(body, -0.2) : tone(body, -0.42)); g.fillStyle = bg; g.fill();
    g.save(); g.clip();
    if (sheep) { for (let i = 0; i < 64; i++) curl(rx + R() * (cx - rx + 4), bk - 2 + R() * (bl - bk + 4), 4 + R() * 3.2); }
    else {
      g.strokeStyle = tone(body, -0.36); g.globalAlpha = 0.3; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < 30; i++) { const x = rx + 3 + R() * (cx - rx - 6), y = bk + 3 + R() * (bl - bk - 8); g.moveTo(x, y); g.lineTo(x - 1.6, y + (goat ? 8 : 4.2)); } g.stroke(); g.globalAlpha = 1;
      // שריר הכתף והירך
      blob(g, hT[0] + 1, (bk + bl) / 2 + 2, 13, (bl - bk) * 0.44, tone(body, 0.2), 0.16); stroke(g, [[hT[0] + 12, bk + 8], [hT[0] + 16, (bk + bl) / 2 + 2, hT[0] + 9, bl - 1]], tone(body, -0.45), 1.6, 0.26);
      blob(g, fT[0] - 2, (bk + bl) / 2 + 4, 9, (bl - bk) * 0.36, tone(body, 0.2), 0.14); stroke(g, [[fT[0] - 10, bk + 10], [fT[0] - 13, (bk + bl) / 2 + 4, fT[0] - 8, bl - 2]], tone(body, -0.45), 1.4, 0.2);
      if (donkey) { stroke(g, [[rx + 2, bk + 2], [-8, bk + 3.5, 26, bk - 2]], '#3c2f27', 2.2, 0.55); stroke(g, [[22, bk - 1], [24, bk + 9, 22, bk + 20]], '#3c2f27', 2, 0.5); }
      if (ox) { blob(g, 14, bk + 2, 14, 5, tone(body, 0.25), 0.2); for (let i = 0; i < 4; i++) stroke(g, [[-6 + i * 5, bk + 16], [-7 + i * 5, bk + 23, -6 + i * 5, bk + 30]], tone(body, -0.4), 1, 0.18); }
    }
    g.restore();
    if (sheep) {                                                 // שפת הצמר: גבשושיות לאורך הגב והבטן
      for (let i = 0; i < 9; i++) { const t = i / 8; curl(rx + 3 + t * (cx - rx - 5), bk + 2.4 - Math.sin(t * PI) * 2.6 + (i % 2) * 1.2, 4.6 + (i % 3) * 0.5); }
      for (let i = 0; i < 7; i++) { const t = i / 6; curl(rx + 6 + t * (cx - rx - 13), bl - 2.4 + Math.sin(t * PI) * 1.6 + (i % 2), 4.3); }
      trace(g, [[rx + 3, bk + 6], [rx - 7, bk + 10, rx - 6, -44], [rx - 4, -37, rx + 1, -38], [rx + 5, -44, rx + 3, bk + 6]]); g.fillStyle = tone(body, -0.1); g.fill(); curl(rx - 2, -52, 4.4); curl(rx - 1, -44, 4);      // אליה
    }
    if (goat && !rest) {                                         // שיער ארוך שתלוי מן הבטן ומן הירך
      const sp = [[rx + 3, bl - 10]], n = 30; for (let i = 0; i <= n; i++) { const t = i / n, x = rx + 3 + t * (cx - rx - 8), y = bl - 2 + Math.sin(t * PI) * 2.4; sp.push([x, y + (i % 2 ? 3.5 + R() * 5 : 1 + R() * 2)]); } sp.push([cx - 5, bl - 10]);
      trace(g, sp); const sg2 = g.createLinearGradient(0, bl - 10, 0, bl + 7); sg2.addColorStop(0, alpha(tone(body, -0.36), 0)); sg2.addColorStop(0.4, alpha(tone(body, -0.38), 1)); sg2.addColorStop(1, tone(body, -0.52)); g.fillStyle = sg2; g.fill();
    }
    g.restore();

    // ---------- הרגליים הקרובות ----------
    if (rest) { legFolded(hT, false, false); legFolded(fT, true, false); }
    else if (!sheep) { lf(hT, 1, false, false); lf(fT, 0, true, false); }

    // ---------- המשא שעל החמור ----------
    if (donkey && !rest && o.load !== false) {
      cloth(g, [[-22, bk - 2.5], [-4, bk - 5, 18, bk - 3.5], [19, bk + 13], [-3, bk + 16, -22, bk + 14]], '#a8533a', -22, 19, 0.4);
      for (const x of [-16, -9, -2, 5, 12]) stroke(g, [[x, bk + 14.6], [x - 0.4, bk + 18]], '#6f2c3a', 0.9, 0.8); stroke(g, [[-22, bk + 9.6], [-3, bk + 11.6, 19, bk + 8.6]], '#e6dcc6', 1.4, 0.7);
      stroke(g, [[-4, bk + 14], [-4.6, bl + 1]], '#4a3320', 1.8);
      trace(g, [[-17, bk - 2], [-19, bk - 19, -2, bk - 21], [15, bk - 19, 13, bk - 2]]); const pg = g.createLinearGradient(-18, 0, 14, 0); pg.addColorStop(0, '#cdb489'); pg.addColorStop(1, '#8a744e'); g.fillStyle = pg; g.fill();
      stroke(g, [[-10, bk - 19], [-8, bk - 10, -11, bk - 3]], '#6a5636', 1, 0.5); stroke(g, [[5, bk - 19], [8, bk - 10, 6, bk - 3]], '#6a5636', 1, 0.5); stroke(g, [[-3, bk - 21], [-2, bk - 25, 1, bk - 21]], '#6a5636', 2);
      const pb = [[-14, bk + 2], [10, bk + 2], [8, bk + 21, 5, bk + 23], [-9, bk + 23], [-12, bk + 21, -14, bk + 2]]; cloth(g, pb, '#b3945a', -14, 10);
      g.strokeStyle = 'rgba(70,50,20,.5)'; g.lineWidth = 0.8; g.beginPath(); for (let y = 6; y < 22; y += 3.6) { g.moveTo(-13, bk + y); g.lineTo(9, bk + y); } for (let x = -10; x < 9; x += 3.4) { g.moveTo(x, bk + 3); g.lineTo(x * 0.9 - 0.4, bk + 22); } g.stroke();
      stroke(g, [[-14.5, bk + 2], [10.5, bk + 2]], '#8a6c3a', 2);
    }
    g.restore();
    g.globalCompositeOperation = 'source-atop';
    const lg2 = g.createLinearGradient(0, 0, Wd, 0); lg2.addColorStop(0, 'rgba(255,246,225,.08)'); lg2.addColorStop(1, 'rgba(20,12,4,.16)'); g.fillStyle = lg2; g.fillRect(0, 0, Wd, Hh);
    g.globalCompositeOperation = 'source-over';
  }

  /* יונה על הקרקע או במעוף, בצדודית. הבד 96x96; קו הקרקע 6 פיקסלים מעל התחתית; במעוף — הגוף במרכז הבד */
  function drawDove(c, o) {
    const g = c.getContext('2d'), Wd = c.width, Hh = c.height, s = Wd / 100;
    g.clearRect(0, 0, Wd, Hh); g.lineJoin = 'round'; LS = o.flip ? -1 : 1;
    const fly = o.fly === 1 || o.fly === 2 ? o.fly : 0, st = !fly && o.stride >= 1 && o.stride <= 3 ? Math.floor(o.stride) : 0, peck = st === 2;
    const C = o.white ? { body: '#efece4', head: '#f6f4ee', wing: '#e2dfd6', bar: '#cfcbc0', tip: '#b5b1a6', neck: 0 } : { body: '#8f99a6', head: '#667180', wing: '#b6bec8', bar: '#33383f', tip: '#3d434c', neck: 1 };
    const legC = '#b9524a';
    g.save(); g.translate(Wd / 2, fly ? Hh / 2 : Hh - 6 * Hh / 96); g.scale(s * (o.flip ? -1 : 1), s);
    const bodyShape = () => {
      trace(g, [[-15, -24], [-3, -33.5, 9, -29], [18.5, -24, 16.5, -14], [11, -5.5, -2, -7], [-12, -8.5, -17, -15.5], [-17.5, -20, -15, -24]]);
      const bg = g.createLinearGradient(0, -33, 0, -6); bg.addColorStop(0, tone(C.body, 0.12)); bg.addColorStop(0.6, C.body); bg.addColorStop(1, tone(C.body, -0.3)); g.fillStyle = bg; g.fill();
    };
    const tail = () => { trace(g, [[-12, -23], [-24, -19, -32, -13.5], [-32.5, -10.5, -30, -9.5], [-20, -10, -12, -11]]); g.fillStyle = tone(C.body, -0.12); g.fill(); trace(g, [[-26.4, -16.6], [-32, -13.5], [-32.5, -10.5, -30, -9.5], [-25, -9.8]]); g.fillStyle = C.tip; g.fill(); };
    const wing = () => {
      const pts = [[8, -28], [-4, -32, -16, -23], [-24, -17.5, -28.5, -13.8], [-13, -9.5, 1, -12], [9.5, -16, 8, -28]];
      trace(g, pts); const wg = g.createLinearGradient(0, -31, 0, -10); wg.addColorStop(0, tone(C.wing, 0.14)); wg.addColorStop(1, tone(C.wing, -0.2)); g.fillStyle = wg; g.fill();
      g.save(); g.clip(); stroke(g, [[-5, -30], [-9, -20, -6, -10]], C.bar, 2.4, 0.9); stroke(g, [[-12.5, -27], [-16, -19, -13.5, -11]], C.bar, 2.4, 0.9); g.fillStyle = C.tip; g.beginPath(); g.moveTo(-18, -22); g.lineTo(-30, -13); g.lineTo(-18, -10.5); g.closePath(); g.fill(); g.restore();
      stroke(g, [[5, -17], [-4, -12.4, -14, -11.4]], tone(C.wing, -0.4), 0.6, 0.5);
    };
    const head = (hx, hy, ang, nx, ny) => {                      // צוואר מן הכתף אל הראש, עין ומקור
      limb(g, nx, ny, 7, hx, hy, 4.8, C.head, 0.14, -0.25);
      if (C.neck) { const a = Math.atan2(hy - ny, hx - nx); g.save(); g.translate((nx + hx) / 2, (ny + hy) / 2); g.rotate(a); blob(g, -1, 1, 5.2, 3.6, '#3f8a68', 0.5); blob(g, -4.4, 1.6, 3.6, 3.2, '#7d4f8c', 0.45); g.restore(); }
      blob(g, hx, hy, 5.3, 5, C.head); blob(g, hx - 1, hy - 1.6, 3.2, 2.2, tone(C.head, 0.2), 0.5);
      g.save(); g.translate(hx, hy); g.rotate(ang);
      trace(g, [[4.2, -1.7], [11.8, 0.9], [4.2, 2.1]]); g.fillStyle = '#2a2622'; g.fill(); blob(g, 5.5, -1, 1.7, 1.2, '#efece4');
      blob(g, 1.5, -1.3, 1.5, 1.5, '#d9661e'); blob(g, 1.5, -1.3, 0.75, 0.75, '#120c08'); blob(g, 1.9, -1.8, 0.3, 0.3, '#fff', 0.9);
      g.restore();
    };
    const foot = (x0, y0, x1, lift) => { stroke(g, [[x0, y0], [x1 - 0.6, -lift - 0.6]], legC, 1.5); stroke(g, [[x1 - 0.6, -lift - 0.5], [x1 + 4.6, -lift - 0.5]], legC, 1.1); stroke(g, [[x1 - 0.6, -lift - 0.5], [x1 + 3.6, -lift - 1.7]], legC, 0.9); stroke(g, [[x1 - 0.6, -lift - 0.5], [x1 - 3, -lift - 0.5]], legC, 1); };
    if (!fly) {
      shadow(g, -2, 22, 0.16);
      const tilt = peck ? 0.52 : st === 1 ? 0.05 : st === 3 ? -0.04 : 0;
      const rot = (x, y) => { const cs = Math.cos(tilt), sn = Math.sin(tilt), dx = x, dy = y + 11; return [dx * cs - dy * sn, dx * sn + dy * cs - 11]; };
      const hipA = rot(-1.5, -9.5), hipB = rot(2.5, -9.5);
      foot(hipB[0], hipB[1], st === 1 ? -4 : st === 3 ? 7.5 : peck ? 0 : 3.5, 0);
      g.save(); g.translate(0, -11); g.rotate(tilt); g.translate(0, 11); tail(); bodyShape(); g.restore();
      const sh0 = rot(10, -23);
      const H = peck ? [19.5, -8.5] : st === 1 ? [18.5, -38] : st === 3 ? [14.5, -39.5] : [16, -39.5];
      head(H[0], H[1], peck ? 1.05 : 0.08, sh0[0], sh0[1]);
      g.save(); g.translate(0, -11); g.rotate(tilt); g.translate(0, 11); wing(); g.restore();
      foot(hipA[0], hipA[1], st === 1 ? 6.5 : st === 3 ? -5 : peck ? -3.5 : -1.5, 0);
    } else {
      const up = fly === 1;
      g.translate(0, 19); g.rotate(-0.1);
      const flap = (far) => {
        const k = far ? 0.9 : 1, col = far ? tone(C.wing, -0.22) : C.wing, ox = far ? 5 : 0;
        const pts = up ? [[9 + ox, -22], [16 + ox, -44 * k, -3 + ox, -62 * k], [-10 + ox, -52 * k, -14 + ox, -40 * k], [-13 + ox, -30, -9 + ox, -21]]
                       : [[10 + ox, -18], [20 + ox, -4, 6 + ox, 14 * k], [-4 + ox, 6 * k, -10 + ox, -3], [-12 + ox, -10, -8 + ox, -19]];
        trace(g, pts); const wg = g.createLinearGradient(0, up ? -60 : 12, 0, -20); wg.addColorStop(0, tone(col, -0.3)); wg.addColorStop(0.35, col); wg.addColorStop(1, tone(col, 0.1)); g.fillStyle = wg; g.fill();
        g.save(); g.clip();
        g.strokeStyle = tone(col, -0.45); g.lineWidth = 0.6; g.globalAlpha = 0.6; g.beginPath();
        for (let i = 0; i < 7; i++) { const t = i / 6; if (up) { g.moveTo(3 + ox - t * 9, -24); g.lineTo(2 + ox - t * 15, -60 * k + t * 16); } else { g.moveTo(4 + ox - t * 10, -17); g.lineTo(8 + ox - t * 17, 13 * k - t * 13); } } g.stroke(); g.globalAlpha = 1;
        if (!far) { stroke(g, up ? [[10, -30], [-12, -34]] : [[12, -12], [-10, -8]], C.bar, 2.2, 0.85); stroke(g, up ? [[9, -37], [-13, -41]] : [[12, -6], [-8, -2]], C.bar, 2.2, 0.85); }
        g.fillStyle = C.tip; g.globalAlpha = 0.8; if (up) g.fillRect(-20, -66, 40, 13); else g.fillRect(-20, 4, 40, 14); g.globalAlpha = 1;
        g.restore();
      };
      flap(true);
      trace(g, [[-12, -24], [-26, -24, -34, -19], [-35, -14, -32, -11], [-22, -11, -12, -12]]); g.fillStyle = tone(C.body, -0.12); g.fill(); trace(g, [[-28, -22.4], [-34, -19], [-35, -14, -32, -11], [-26.6, -11]]); g.fillStyle = C.tip; g.fill();
      stroke(g, [[-4, -9], [-10, -6.5]], legC, 1.6); stroke(g, [[-10, -6.5], [-13.5, -6.2]], legC, 1);
      bodyShape();
      head(21, -27, 0.1, 12, -22);
      flap(false);
    }
    g.restore();
    g.globalCompositeOperation = 'source-atop';
    const lg2 = g.createLinearGradient(0, 0, 0, Hh); lg2.addColorStop(0, 'rgba(255,250,235,.08)'); lg2.addColorStop(1, 'rgba(20,12,4,.14)'); g.fillStyle = lg2; g.fillRect(0, 0, Wd, Hh);
    g.globalCompositeOperation = 'source-over';
  }

  window.GerizimPeople = { drawPerson, drawAnimal };
})();
