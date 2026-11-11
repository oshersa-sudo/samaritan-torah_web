/* הדמויות ובעלי החיים של הסיור הרגלי: ציור מפורט, בלי קווי מתאר — גוף בפרופורציות של אדם,
   בד מוצלל בקפלים, פנים, ידיים וסנדלים, ומבט מלפנים או מאחור. הלבוש לפי התקופה: כתונת צמר או פשתן,
   גלימה מוטלת על הכתף, אבנט, כיסוי ראש; כוהנים בלבן ובמצנפת; שומרים בקסדת נחושת, במגן וברומח. */
(function () {
  'use strict';
  const PAL = {
    wool: ['#e6dcc6', '#d8c8a8', '#c9b48c', '#b79a70', '#a2825c', '#8b6c4a', '#efe8d8', '#cdbb9a'],
    dye: ['#8f3a2c', '#a94e38', '#2d4766', '#3c6252', '#b98a34', '#62466f', '#6f2c3a', '#4a6336', '#9a6236', '#7a8a9a'],
    skin: ['#c4916a', '#b47f5a', '#d0a27c', '#a36f4b', '#bb8862', '#96623f'],
    hair: ['#231811', '#33221a', '#19120d', '#43301f']
  };
  function rng(seed) { let s = (seed * 9301 + 49297) % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function tone(hex, k) {                        // k>0 מבהיר, k<0 מכהה
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  // צורה: [[x,y], [cx,cy,x,y] (עקומה), ...]
  function trace(g, pts) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 6) g.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]); else if (p.length === 4) g.quadraticCurveTo(p[0], p[1], p[2], p[3]); else g.lineTo(p[0], p[1]); }
    g.closePath();
  }
  function cloth(g, pts, col, x1, x2) {          // בד: אור משמאל, צל מימין
    trace(g, pts);
    const gr = g.createLinearGradient(x1, 0, x2, 0);
    gr.addColorStop(0, tone(col, 0.16)); gr.addColorStop(0.42, col); gr.addColorStop(1, tone(col, -0.36));
    g.fillStyle = gr; g.fill();
    g.strokeStyle = tone(col, -0.48); g.globalAlpha = 0.55; g.lineWidth = 0.9; g.stroke(); g.globalAlpha = 1;
  }
  function fold(g, x1, y1, cx, cy, x2, y2, col, a, wdt) {      // קפל: קו רך כהה, ולצדו קו אור דק
    g.lineCap = 'round';
    g.strokeStyle = tone(col, -0.5); g.globalAlpha = a; g.lineWidth = wdt || 2.2;
    g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke();
    g.strokeStyle = tone(col, 0.3); g.globalAlpha = a * 0.55; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x1 - 2, y1); g.quadraticCurveTo(cx - 2.2, cy, x2 - 2, y2); g.stroke();
    g.globalAlpha = 1;
  }
  function flesh(g, pts, skin) {
    trace(g, pts);
    const b = pts.reduce((a, p) => { const x = p[p.length - 2]; return [Math.min(a[0], x), Math.max(a[1], x)]; }, [1e9, -1e9]);
    const gr = g.createLinearGradient(b[0], 0, b[1], 0);
    gr.addColorStop(0, tone(skin, 0.14)); gr.addColorStop(0.5, skin); gr.addColorStop(1, tone(skin, -0.3));
    g.fillStyle = gr; g.fill();
  }

  function drawPerson(c, kind, carry, seed) {
    const R = rng(seed + 11), pick = a => a[Math.floor(R() * a.length)];
    const g = c.getContext('2d'), Wd = c.width, Hh = c.height, u = Hh / 236;      // 236 יחידות: מקום גם לרומח שמעל הראש
    g.clearRect(0, 0, Wd, Hh);
    const child = kind === 'child', woman = kind === 'woman';
    const sc = child ? 0.62 : woman ? 0.94 : kind === 'elder' ? 0.97 : 1;
    const back = !(kind === 'guard' || carry === 'lamb' || carry === 'bowl' || carry === 'doves' || carry === 'basket' || carry === 'horn') && R() < 0.3;
    const flip = R() < 0.5 ? -1 : 1;
    g.save(); g.translate(Wd / 2, Hh - 5 * u); g.scale(u * sc * flip, u * sc);
    const skin = pick(PAL.skin), hair = kind === 'elder' ? pick(['#d6d2c8', '#bfb9ac', '#e2dfd6']) : pick(PAL.hair);
    let robe, cloak = null, sash = null, hem = -10, head = 'bare', beard = false, stripe = null;
    if (kind === 'priest') { robe = '#f3eee0'; sash = pick(['#2d4766', '#62466f', '#8f3a2c']); hem = -5; head = 'turban'; beard = true; }
    else if (kind === 'levite') { robe = '#e9e0cb'; sash = '#bfb49a'; hem = -7; head = 'cap'; beard = R() > 0.25; }
    else if (woman) { robe = pick(PAL.dye); cloak = pick(PAL.wool); hem = -3; head = 'veil'; sash = R() > 0.5 ? pick(PAL.wool) : null; }
    else if (kind === 'elder') { robe = pick(PAL.wool); cloak = pick(['#8b6c4a', '#6c5843', '#b79a70', '#5a4a3c']); sash = '#75604a'; hem = -5; head = R() > 0.45 ? 'cloth' : 'bare'; beard = true; }
    else if (kind === 'guard') { robe = pick(['#a2825c', '#8f3a2c', '#c9b48c', '#6f2c3a']); sash = '#3f2c1e'; hem = -84; head = 'helmet'; beard = R() > 0.5; }
    else if (kind === 'merchant') { robe = pick(PAL.wool); sash = pick(PAL.dye); hem = -38; head = 'cloth'; beard = R() > 0.35; stripe = pick(PAL.dye); }
    else if (child) { robe = pick(PAL.wool.concat(PAL.dye)); hem = -64; head = 'bare'; }
    else { robe = pick(PAL.wool); cloak = R() > 0.3 ? pick(PAL.dye.concat(PAL.wool)) : null; sash = pick(['#6c5843', '#8f3a2c', '#2d4766', '#4a3a2c']); hem = R() > 0.5 ? -46 : -9; head = pick(['bare', 'cloth', 'bare', 'band']); beard = R() > 0.2; stripe = R() > 0.6 ? pick(PAL.dye) : null; }
    const sw = woman ? 18.5 : child ? 17 : 22, sh = -154, wst = -106, wd = woman ? 15 : 17, hw = 21 + (hem > -20 ? 5 : 0);

    // צל על הקרקע
    const sg = g.createRadialGradient(4, 1, 2, 4, 1, 34); sg.addColorStop(0, 'rgba(0,0,0,.42)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.save(); g.scale(1, 0.24); g.beginPath(); g.arc(4, 4, 34, 0, 6.3); g.fill(); g.restore();
    // רגליים וסנדלים
    const footY = -3;
    if (hem < -16) for (const sx of [-1, 1]) flesh(g, [[sx * 4, hem - 2], [sx * 12.5, hem - 2], [sx * 13, (hem + footY) / 2, sx * 10.5, footY - 5], [sx * 5, footY - 5], [sx * 3, (hem + footY) / 2, sx * 4, hem - 2]], skin);
    for (const sx of [-1, 1]) {
      flesh(g, [[sx * 3.5, footY - 7], [sx * 11, footY - 7], [sx * 17, footY - 4, sx * 17.5, footY], [sx * 3, footY]], skin);
      g.strokeStyle = '#4a321e'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx * 3, footY); g.lineTo(sx * 17.5, footY); g.moveTo(sx * 6, footY - 7); g.lineTo(sx * 12, footY - 1); g.moveTo(sx * 11, footY - 7); g.lineTo(sx * 6.5, footY - 1); g.stroke();
    }
    // הכתונת
    const hemPts = [];
    for (let i = 0; i <= 6; i++) { const x = hw - i * (2 * hw / 6); hemPts.push([x + hw / 6, hem + (i % 2 ? 3 : -1), x, hem + (i % 2 ? 1.5 : 0)]); }
    cloth(g, [[-7, sh - 5], [7, sh - 5], [sw, sh], [sw + 1, sh + 20, wd, wst], [wd + 3, (wst + hem) / 2, hw, hem]].concat(hemPts.slice(1)).concat([[-wd - 3, (wst + hem) / 2, -wd, wst], [-sw - 1, sh + 20, -sw, sh]]), robe, -sw - 4, sw + 6);
    if (stripe) { g.fillStyle = stripe; g.globalAlpha = 0.85; g.fillRect(-9.5, sh, 3, hem - sh - 2); g.fillRect(6.5, sh, 3, hem - sh - 2); g.globalAlpha = 1; }
    for (let i = 0; i < 5; i++) { const x = -hw + 5 + i * (2 * hw - 8) / 4 + (R() - 0.5) * 3; fold(g, x * 0.72, wst + 4, x * 0.9 + (R() - 0.5) * 5, (wst + hem) / 2, x, hem - 2, robe, 0.22 + R() * 0.16); }
    fold(g, -8, sh + 8, -3, sh + 26, -6, wst - 6, robe, 0.16); fold(g, 9, sh + 10, 5, sh + 28, 8, wst - 6, robe, 0.16);
    if (sash) {
      cloth(g, [[-wd - 1, wst - 5], [wd + 1, wst - 5], [wd + 1.5, wst + 2], [-wd - 1.5, wst + 2]], sash, -wd, wd);
      if (!back) { cloth(g, [[3, wst + 1], [8, wst + 1], [9.5, wst + (kind === 'priest' ? 52 : 26)], [3.5, wst + (kind === 'priest' ? 54 : 27)]], sash, 2, 10); }
    }
    if (kind === 'priest') { g.fillStyle = '#b98a34'; g.globalAlpha = 0.85; g.fillRect(-hw + 1, hem - 6, 2 * hw - 2, 2.2); g.globalAlpha = 1; }
    // הזרועות. zרוע אחת מורמת כשנושאים רומח או מקל, או כפופה אל החזה כשנושאים דבר מה
    const bentR = !back && ['lamb', 'basket', 'bowl', 'doves', 'jar', 'sack', 'horn'].indexOf(carry) >= 0;
    const pole = carry === 'spear' || carry === 'staff';
    const sleeve = kind === 'guard' || child ? -128 : -112;
    const arm = (sx, bent, raised) => {
      const ex = sx * (sw + 6), ey = raised ? -128 : -118;                  // המרפק
      const hx = bent ? sx * 9 : raised ? sx * (sw + 9) : sx * (sw + 5.5), hy = bent ? -116 : raised ? -138 : -90;
      cloth(g, [[sx * (sw - 4), sh + 1], [sx * (sw + 2), sh + 3, sx * (sw + 8), sh + 12], [ex + sx * 3, (sh + ey) / 2, ex + sx * 2.5, ey + 2], [ex - sx * 6, ey + 5], [sx * (sw - 6), sh + 18]], robe, sx < 0 ? -sw - 10 : sw - 6, sx < 0 ? -sw + 6 : sw + 12);
      const fa = [[ex + sx * 2.5, ey - 3], [ex - sx * 5.5, ey + 3], [hx - sx * 3.6, hy - 3], [hx + sx * 3.4, hy - 5]];
      if (sleeve > ey) cloth(g, fa, robe, Math.min(ex, hx) - 6, Math.max(ex, hx) + 6); else flesh(g, fa, skin);
      flesh(g, [[hx - 4.2, hy - 5], [hx + 4.2, hy - 5], [hx + 5, hy, hx + 3.6, hy + 5], [hx, hy + 7.5, hx - 3.6, hy + 5], [hx - 5, hy, hx - 4.2, hy - 5]], skin);
      return [hx, hy];
    };
    const handL = arm(-1, false, pole && !back), handR = arm(1, bentR, false);
    // הגלימה, מוטלת על הכתף השמאלית ויורדת באלכסון
    if (cloak) {
      const low = hem > -20 ? hem + 20 : hem + 6;
      if (back) {
        cloth(g, [[-sw - 2, sh - 2], [sw + 2, sh - 2], [sw + 6, sh + 40, sw + 4, wst + 30], [sw, low], [-sw - 3, low + 5], [-sw - 7, wst, -sw - 2, sh - 2]], cloak, -sw - 6, sw + 8);
        for (let i = 0; i < 5; i++) { const x = -sw + 4 + i * (2 * sw - 6) / 4; fold(g, x, sh + 8, x + (R() - 0.5) * 6, (sh + low) / 2, x * 1.05, low - 2, cloak, 0.28); }
      } else {
        cloth(g, [[-sw - 2, sh - 2], [-2, sh - 4], [8, sh + 6, sw - 2, sh + 22], [sw + 3, wst - 4, sw + 1, wst + 22], [10, low - 8, 2, low], [-sw - 3, low + 4], [-sw - 7, wst, -sw - 2, sh - 2]], cloak, -sw - 6, sw + 6);
        for (let i = 0; i < 4; i++) fold(g, -sw + 2 + i * 6, sh + 6 + i * 3, -sw + 12 + i * 8, wst - 10 + i * 12, -sw + 6 + i * 9, low - 4 - i * 2, cloak, 0.3);
        fold(g, -4, sh, 10, sh + 20, sw, wst, cloak, 0.3, 2.6);
        g.strokeStyle = tone(cloak, -0.45); g.globalAlpha = 0.6; g.lineWidth = 1; for (let x = -sw; x < 4; x += 3) { g.beginPath(); g.moveTo(x, low + 3 - (x + sw) * 0.14); g.lineTo(x - 0.6, low + 7 - (x + sw) * 0.14); g.stroke(); } g.globalAlpha = 1;
      }
    }
    // הצוואר והראש
    const hy = sh - 21, hr = child ? 12.2 : 11.2;
    flesh(g, [[-5.2, sh - 10], [5.2, sh - 10], [6.6, sh - 1], [-6.6, sh - 1]], tone(skin, -0.12));
    if (head === 'veil' && back) cloth(g, [[-14, hy - 3], [-16, hy - 20, 0, hy - 19], [16, hy - 20, 14, hy - 3], [20, sh + 10, 21, sh + 38], [0, sh + 46, -21, sh + 38], [-20, sh + 10, -14, hy - 3]], cloak || '#d8c8a8', -20, 22);
    trace(g, [[0, hy - hr * 1.3], [hr * 1.02, hy - hr * 1.28, hr, hy - 2], [hr * 0.96, hy + hr * 0.75, 0, hy + hr * 1.22], [-hr * 0.96, hy + hr * 0.75, -hr, hy - 2], [-hr * 1.02, hy - hr * 1.28, 0, hy - hr * 1.3]]);
    const fg = g.createRadialGradient(-3.5, hy - 5, 2, 0, hy, hr * 1.5); fg.addColorStop(0, tone(skin, 0.2)); fg.addColorStop(0.55, skin); fg.addColorStop(1, tone(skin, -0.36));
    g.fillStyle = back ? hair : fg; g.fill();
    if (!back) {
      flesh(g, [[-hr - 1.6, hy - 3], [-hr + 0.6, hy - 5], [-hr + 0.6, hy + 4], [-hr - 1.2, hy + 2.5]], tone(skin, -0.1)); flesh(g, [[hr + 1.6, hy - 3], [hr - 0.6, hy - 5], [hr - 0.6, hy + 4], [hr + 1.2, hy + 2.5]], tone(skin, -0.28));
      g.fillStyle = tone(skin, -0.42); g.globalAlpha = 0.5;                                     // ארובות העיניים והאף
      g.beginPath(); g.ellipse(-4.4, hy - 2.6, 3.2, 1.9, 0, 0, 6.3); g.ellipse(4.4, hy - 2.6, 3.2, 1.9, 0, 0, 6.3); g.fill();
      g.beginPath(); g.moveTo(0.4, hy - 2); g.quadraticCurveTo(2.6, hy + 3.4, 0.2, hy + 4.4); g.lineTo(-1.6, hy + 4); g.closePath(); g.fill(); g.globalAlpha = 1;
      g.fillStyle = '#f3ede2'; g.beginPath(); g.ellipse(-4.4, hy - 2.4, 2.1, 1.05, 0, 0, 6.3); g.ellipse(4.4, hy - 2.4, 2.1, 1.05, 0, 0, 6.3); g.fill();
      g.fillStyle = '#20140c'; g.beginPath(); g.arc(-4.2, hy - 2.4, 1.05, 0, 6.3); g.arc(4.6, hy - 2.4, 1.05, 0, 6.3); g.fill();
      g.strokeStyle = kind === 'elder' ? '#a9a39a' : '#1e140d'; g.lineWidth = 1.25; g.lineCap = 'round';   // גבות
      g.beginPath(); g.moveTo(-7.2, hy - 5.2); g.quadraticCurveTo(-4.4, hy - 6.6, -1.8, hy - 5.2); g.moveTo(1.8, hy - 5.2); g.quadraticCurveTo(4.4, hy - 6.6, 7.2, hy - 5.2); g.stroke();
      g.strokeStyle = tone(skin, -0.5); g.lineWidth = 1.1; g.beginPath(); g.moveTo(-3.1, hy + 7.4); g.quadraticCurveTo(0, hy + 8.4, 3.1, hy + 7.4); g.stroke();   // הפה
      if (beard) {
        trace(g, [[-hr + 0.4, hy + 1], [-hr + 1, hy + hr * 1.1, 0, hy + hr * (kind === 'elder' || kind === 'priest' ? 2.1 : 1.65)], [hr - 1, hy + hr * 1.1, hr - 0.4, hy + 1], [5.5, hy + 5, 3.4, hy + 6.2], [0, hy + 5.2, -3.4, hy + 6.2], [-5.5, hy + 5, -hr + 0.4, hy + 1]]);
        const bg = g.createLinearGradient(-hr, 0, hr, 0); bg.addColorStop(0, tone(hair, 0.18)); bg.addColorStop(1, tone(hair, -0.25)); g.fillStyle = bg; g.fill();
        g.strokeStyle = tone(hair, 0.35); g.globalAlpha = 0.35; g.lineWidth = 0.7; for (let i = 0; i < 9; i++) { const x = -7 + i * 1.75; g.beginPath(); g.moveTo(x, hy + 8); g.lineTo(x * 0.7, hy + hr * 1.5); g.stroke(); } g.globalAlpha = 1;
        g.strokeStyle = tone(skin, -0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(-2.6, hy + 7.6); g.lineTo(2.6, hy + 7.6); g.stroke();
      }
    }
    // כיסוי הראש והשיער
    const hairCap = () => { trace(g, [[-hr - 0.5, hy - 1], [-hr - 1.5, hy - hr * 1.5, 0, hy - hr * 1.48], [hr + 1.5, hy - hr * 1.5, hr + 0.5, hy - 1], [hr - 2, hy - hr * 0.72, 0, hy - hr * 0.86], [-hr + 2, hy - hr * 0.72, -hr - 0.5, hy - 1]]); const hg = g.createLinearGradient(-hr, 0, hr, 0); hg.addColorStop(0, tone(hair, 0.22)); hg.addColorStop(1, tone(hair, -0.2)); g.fillStyle = hg; g.fill(); };
    if (head === 'bare' || head === 'band') { hairCap(); if (child || woman) { /* שיער ארוך יותר */ } if (head === 'band') cloth(g, [[-hr - 0.8, hy - hr * 0.86], [hr + 0.8, hy - hr * 0.86], [hr + 0.8, hy - hr * 0.6], [-hr - 0.8, hy - hr * 0.6]], '#cfc4a8', -hr, hr); }
    if (head === 'turban') {
      cloth(g, [[-hr - 2.5, hy - 5.5], [-hr - 5, hy - hr * 1.9, 0, hy - hr * 2.05], [hr + 5, hy - hr * 1.9, hr + 2.5, hy - 5.5], [0, hy - hr * 0.95, -hr - 2.5, hy - 5.5]], '#f8f5ec', -hr - 4, hr + 5);
      for (const k of [0.28, 0.5, 0.72]) fold(g, -hr - 2.5, hy - 6 - k * 13, 0, hy - 12 - k * 17, hr + 2.5, hy - 6 - k * 13, '#e8e2d2', 0.3, 1.4);
    }
    if (head === 'cap') cloth(g, [[-hr - 0.8, hy - 5], [-hr - 0.6, hy - hr * 1.62, 0, hy - hr * 1.62], [hr + 0.6, hy - hr * 1.62, hr + 0.8, hy - 5], [0, hy - hr * 0.9, -hr - 0.8, hy - 5]], '#e3d9c0', -hr, hr);
    if (head === 'cloth') { const hc = pick(PAL.wool); cloth(g, [[-hr - 1.5, hy - 5], [-hr - 3, hy - hr * 1.7, 0, hy - hr * 1.72], [hr + 3, hy - hr * 1.7, hr + 1.5, hy - 5], [hr + 4, hy + 10, hr + 1, sh + 6], [hr - 3, hy + 6, hr - 1.2, hy - 6], [0, hy - hr * 0.92, -hr + 1.2, hy - 6], [-hr + 3, hy + 6, -hr - 1, sh + 6], [-hr - 4, hy + 10, -hr - 1.5, hy - 5]], hc, -hr - 3, hr + 4); cloth(g, [[-hr - 1.6, hy - hr * 0.95], [hr + 1.6, hy - hr * 0.95], [hr + 1.6, hy - hr * 0.7], [-hr - 1.6, hy - hr * 0.7]], '#4a3a2c', -hr, hr); }
    if (head === 'veil' && !back) {
      const vc = cloak || '#d8c8a8';
      cloth(g, [[-hr - 1.5, hy - 3], [-hr - 4.5, hy - hr * 1.75, 0, hy - hr * 1.74], [hr + 4.5, hy - hr * 1.75, hr + 1.5, hy - 3], [hr + 8, sh + 2, sw + 3, sh + 20], [sw - 4, sh + 10, hr - 0.5, hy + 9], [hr - 2.4, hy - 2, hr - 1.6, hy - 7], [0, hy - hr * 1.05, -hr + 1.6, hy - 7], [-hr + 2.4, hy - 2, -hr + 0.5, hy + 9], [-sw + 4, sh + 10, -sw - 3, sh + 20], [-hr - 8, sh + 2, -hr - 1.5, hy - 3]], vc, -sw - 3, sw + 4);
      fold(g, -hr - 2, hy - 2, -hr - 6, sh - 2, -sw, sh + 16, vc, 0.3); fold(g, hr + 2, hy - 2, hr + 6, sh - 2, sw, sh + 16, vc, 0.3);
    }
    if (head === 'helmet') {
      trace(g, [[-hr - 1.5, hy - 2.5], [-hr - 2, hy - hr * 1.7, 0, hy - hr * 1.85], [hr + 2, hy - hr * 1.7, hr + 1.5, hy - 2.5], [hr - 1, hy - hr * 0.5, 0, hy - hr * 0.62], [-hr + 1, hy - hr * 0.5, -hr - 1.5, hy - 2.5]]);
      const mg = g.createLinearGradient(-hr, 0, hr, 0); mg.addColorStop(0, '#e8c56a'); mg.addColorStop(0.35, '#b98a34'); mg.addColorStop(1, '#6e4f1c'); g.fillStyle = mg; g.fill();
      if (!back) { flesh(g, [[-hr - 1, hy - 3], [-hr + 3, hy - 3], [-hr + 2.5, hy + 8], [-hr - 0.5, hy + 5]], '#a67c2e'); flesh(g, [[hr + 1, hy - 3], [hr - 3, hy - 3], [hr - 2.5, hy + 8], [hr + 0.5, hy + 5]], '#8a6524'); }
      cloth(g, [[-2.2, hy - hr * 1.8], [0, hy - hr * 2.6, 2.2, hy - hr * 1.8]], '#8f3a2c', -3, 3);
    }
    // מה שנושאים
    if (pole) {
      const px = back ? -sw - 6 : handL[0];
      const pgr = g.createLinearGradient(px - 2, 0, px + 2, 0); pgr.addColorStop(0, '#8a6a44'); pgr.addColorStop(1, '#4a3320'); g.fillStyle = pgr;
      g.fillRect(px - 1.6, carry === 'spear' ? -206 : -176, 3.2, (carry === 'spear' ? 206 : 176));
      if (carry === 'spear') { trace(g, [[px - 3.6, -204], [px, -226], [px + 3.6, -204], [px, -198]]); const sgr = g.createLinearGradient(px - 4, 0, px + 4, 0); sgr.addColorStop(0, '#dcdcdc'); sgr.addColorStop(1, '#7a7a7a'); g.fillStyle = sgr; g.fill(); }
      if (!back) flesh(g, [[px - 4.4, handL[1] - 5], [px + 4.4, handL[1] - 5], [px + 4.6, handL[1] + 4], [px - 4.6, handL[1] + 4]], skin);
    }
    if (carry === 'spear' && !back) {                                       // מגן עגול
      const sx = sw + 4, sy = -112;
      const shg = g.createRadialGradient(sx - 6, sy - 8, 3, sx, sy, 27); shg.addColorStop(0, '#b98658'); shg.addColorStop(0.75, '#7a5232'); shg.addColorStop(1, '#4a2f1b');
      g.fillStyle = shg; g.beginPath(); g.ellipse(sx, sy, 19, 26, 0, 0, 6.3); g.fill();
      g.strokeStyle = '#b98a34'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(sx, sy, 18, 25, 0, 0, 6.3); g.stroke();
      const bg2 = g.createRadialGradient(sx - 2, sy - 2, 1, sx, sy, 6); bg2.addColorStop(0, '#f0d27a'); bg2.addColorStop(1, '#7a5a1e'); g.fillStyle = bg2; g.beginPath(); g.arc(sx, sy, 5.5, 0, 6.3); g.fill();
    }
    const hx = handR[0], hy2 = handR[1];
    if (carry === 'lamb') {
      trace(g, [[hx - 18, hy2 - 4], [hx - 8, hy2 - 17, hx + 12, hy2 - 13], [hx + 22, hy2 - 8, hx + 20, hy2 + 4], [hx + 8, hy2 + 12, hx - 12, hy2 + 9], [hx - 22, hy2 + 6, hx - 18, hy2 - 4]]);
      const lg = g.createLinearGradient(hx - 20, 0, hx + 22, 0); lg.addColorStop(0, '#fbf8ef'); lg.addColorStop(1, '#cfc7b4'); g.fillStyle = lg; g.fill();
      g.strokeStyle = 'rgba(150,140,118,.55)'; g.lineWidth = 0.9; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(hx - 14 + (i % 8) * 4.4, hy2 - 6 + Math.floor(i / 8) * 7 + (i % 2) * 2, 2.6, 0, 3.4); g.stroke(); }
      g.fillStyle = '#e9e1d0'; g.beginPath(); g.ellipse(hx + 24, hy2 - 11, 7, 5.6, 0.35, 0, 6.3); g.fill(); g.fillStyle = '#20140c'; g.beginPath(); g.arc(hx + 26.5, hy2 - 12, 1, 0, 6.3); g.fill();
      flesh(g, [[hx - 6, hy2 + 1], [hx + 6, hy2 - 1], [hx + 7, hy2 + 6], [hx - 6, hy2 + 8]], skin);
    }
    if (carry === 'jar') {                                                  // קנקן על הכתף
      trace(g, [[sw - 6, sh - 6], [sw + 10, sh - 6], [sw + 18, sh - 26, sw + 15, sh - 46], [sw + 9, sh - 58, sw + 6, sh - 58], [sw - 2, sh - 58, sw - 5, sh - 58], [sw - 14, sh - 46, sw - 11, sh - 26]]);
      const jg = g.createLinearGradient(sw - 12, 0, sw + 18, 0); jg.addColorStop(0, '#d08e62'); jg.addColorStop(0.45, '#b06c44'); jg.addColorStop(1, '#6e3f26'); g.fillStyle = jg; g.fill();
      g.fillStyle = '#7a4a2e'; g.fillRect(sw - 4, sh - 62, 12, 5);
      flesh(g, [[sw + 8, sh - 30], [sw + 16, sh - 32], [sw + 17, sh - 22], [sw + 9, sh - 20]], skin);
    }
    if (carry === 'basket') { cloth(g, [[hx - 14, hy2 - 6], [hx + 14, hy2 - 6], [hx + 11, hy2 + 12, hx + 8, hy2 + 14], [hx - 8, hy2 + 14], [hx - 11, hy2 + 12, hx - 14, hy2 - 6]], '#b3945a', hx - 14, hx + 14); g.strokeStyle = 'rgba(70,50,20,.5)'; g.lineWidth = 0.9; for (let y = -2; y < 13; y += 3.6) { g.beginPath(); g.moveTo(hx - 13, hy2 + y); g.lineTo(hx + 13, hy2 + y); g.stroke(); } for (const [bx, bc] of [[-7, '#7a4a26'], [0, '#c9973a'], [7, '#8f3a2c']]) { g.fillStyle = bc; g.beginPath(); g.arc(hx + bx, hy2 - 8, 4.2, 0, 6.3); g.fill(); } }
    if (carry === 'doves') { g.fillStyle = 'rgba(150,118,70,.3)'; g.fillRect(hx - 14, hy2 - 14, 28, 24); g.strokeStyle = '#6b4a2b'; g.lineWidth = 1.1; g.strokeRect(hx - 14, hy2 - 14, 28, 24); for (let x = -10; x < 14; x += 4) { g.beginPath(); g.moveTo(hx + x, hy2 - 14); g.lineTo(hx + x, hy2 + 10); g.stroke(); } g.fillStyle = '#f4f4f0'; g.beginPath(); g.ellipse(hx - 5, hy2 + 3, 5, 3.6, 0, 0, 6.3); g.ellipse(hx + 6, hy2 + 2, 5, 3.6, 0, 0, 6.3); g.fill(); }
    if (carry === 'sack') cloth(g, [[sw - 10, sh - 8], [sw + 4, sh - 26, sw + 24, sh - 16], [sw + 30, sh + 10, sw + 20, sh + 24], [sw, sh + 26, sw - 8, sh + 12]], '#c2ac80', sw - 10, sw + 30);
    if (carry === 'bowl') { trace(g, [[hx - 13, hy2 - 6], [hx + 13, hy2 - 6], [hx + 9, hy2 + 5, hx, hy2 + 6], [hx - 9, hy2 + 5, hx - 13, hy2 - 6]]); const bg3 = g.createLinearGradient(hx - 13, 0, hx + 13, 0); bg3.addColorStop(0, '#f0d27a'); bg3.addColorStop(1, '#7a5a1e'); g.fillStyle = bg3; g.fill(); }
    if (carry === 'horn') { g.strokeStyle = '#d9c8a2'; g.lineWidth = 5.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy2 - 2); g.quadraticCurveTo(hx + 20, hy2 - 8, hx + 26, hy2 - 30); g.stroke(); g.strokeStyle = '#8a7a58'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx + 2, hy2 + 1); g.quadraticCurveTo(hx + 22, hy2 - 6, hx + 28.5, hy2 - 29); g.stroke(); }
    g.restore();
    // גרעיניות עדינה ואור צד על כל הדמות, כדי שלא תיראה שטוחה
    g.globalCompositeOperation = 'source-atop';
    const lg2 = g.createLinearGradient(Wd * 0.2, 0, Wd * 0.85, 0); lg2.addColorStop(0, 'rgba(255,246,225,.10)'); lg2.addColorStop(0.5, 'rgba(0,0,0,0)'); lg2.addColorStop(1, 'rgba(20,12,4,.22)');
    g.fillStyle = lg2; g.fillRect(0, 0, Wd, Hh);
    const vg = g.createLinearGradient(0, 0, 0, Hh); vg.addColorStop(0, 'rgba(255,250,235,.06)'); vg.addColorStop(1, 'rgba(30,20,8,.16)'); g.fillStyle = vg; g.fillRect(0, 0, Wd, Hh);
    for (let i = 0; i < 1300; i++) { g.fillStyle = R() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; g.fillRect(R() * Wd, R() * Hh, 1.4, 1.4); }
    g.globalCompositeOperation = 'source-over';
  }

  function drawAnimal(c, kind) {
    const g = c.getContext('2d'), Wd = c.width, Hh = c.height, u = Hh / 110, R = rng(kind.length * 31 + 7);
    g.clearRect(0, 0, Wd, Hh);
    const big = kind === 'ox' ? 1.42 : kind === 'donkey' ? 1.3 : 1, k = 0.6 * big;
    g.save(); g.translate(Wd / 2, Hh - 4 * u); g.scale(u * k, u * k);
    const body = kind === 'sheep' ? '#ece5d4' : kind === 'goat' ? '#56463a' : kind === 'ox' ? '#8a5c3c' : '#978b80';
    const dark = kind === 'sheep' ? '#3a2e25' : tone(body, -0.3);
    const sg = g.createRadialGradient(0, 1, 2, 0, 1, 50); sg.addColorStop(0, 'rgba(0,0,0,.4)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.save(); g.scale(1, 0.2); g.beginPath(); g.arc(0, 6, 50, 0, 6.3); g.fill(); g.restore();
    const leg = (x, far) => { trace(g, [[x - 3.4, -34], [x + 3.4, -34], [x + 2.6, -4], [x + 3.2, 0], [x - 3, 0], [x - 2.4, -4]]); g.fillStyle = far ? tone(dark, -0.25) : dark; g.fill(); };
    leg(-22, true); leg(20, true);
    trace(g, [[-38, -50], [-40, -72, -10, -72], [20, -74, 36, -64], [42, -52, 36, -40], [20, -30, -8, -30], [-32, -30, -38, -50]]);
    const bg = g.createLinearGradient(0, -74, 0, -28); bg.addColorStop(0, tone(body, 0.2)); bg.addColorStop(0.55, body); bg.addColorStop(1, tone(body, -0.38)); g.fillStyle = bg; g.fill();
    if (kind === 'sheep') { g.strokeStyle = 'rgba(140,128,104,.5)'; g.lineWidth = 1; for (let i = 0; i < 34; i++) { g.beginPath(); g.arc(-32 + (i % 12) * 6, -64 + Math.floor(i / 12) * 11 + (i % 2) * 3, 4.2, 0.2, 3.2); g.stroke(); } }
    else { g.strokeStyle = tone(body, -0.3); g.globalAlpha = 0.3; g.lineWidth = 1; for (let i = 0; i < 16; i++) { const x = -34 + R() * 68, y = -66 + R() * 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 5); g.stroke(); } g.globalAlpha = 1; }
    leg(-28, false); leg(26, false);
    // הצוואר והראש
    trace(g, [[30, -66], [44, -80, 54, -78], [60, -66, 52, -56], [40, -52, 30, -52]]); g.fillStyle = kind === 'sheep' ? tone(body, -0.08) : body; g.fill();
    trace(g, [[46, -82], [58, -86, 66, -74], [70, -64, 60, -60], [48, -60, 44, -70], [43, -78, 46, -82]]);
    const hg = g.createLinearGradient(44, 0, 70, 0); hg.addColorStop(0, tone(dark, 0.2)); hg.addColorStop(1, tone(dark, -0.2)); g.fillStyle = kind === 'sheep' ? hg : tone(body, -0.1); g.fill();
    g.fillStyle = '#120c08'; g.beginPath(); g.arc(58, -74, 1.6, 0, 6.3); g.fill();
    trace(g, [[46, -80], [40, -86], [44, -74]]); g.fillStyle = tone(dark, -0.1); g.fill();                    // אוזן
    if (kind === 'goat' || kind === 'ox') { g.strokeStyle = '#d6cbb4'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(50, -82); g.quadraticCurveTo(44, -98, 36, -96); g.stroke(); g.beginPath(); g.moveTo(55, -83); g.quadraticCurveTo(56, -100, 48, -104); g.stroke(); }
    if (kind === 'goat') { g.strokeStyle = dark; g.lineWidth = 2; g.beginPath(); g.moveTo(60, -61); g.lineTo(60, -52); g.stroke(); }
    if (kind === 'donkey') {
      trace(g, [[48, -82], [46, -102], [54, -84]]); g.fillStyle = body; g.fill();
      trace(g, [[-16, -74], [-18, -92, -2, -94], [14, -92, 12, -74]]); const pg = g.createLinearGradient(-18, 0, 14, 0); pg.addColorStop(0, '#c98a5e'); pg.addColorStop(1, '#7a4a2e'); g.fillStyle = pg; g.fill();
      g.fillStyle = '#c2ac80'; g.fillRect(-24, -76, 44, 9); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-24, -70, 44, 3);
    }
    g.strokeStyle = dark; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-38, -58); g.quadraticCurveTo(-46, -52, -44, kind === 'sheep' ? -48 : -36); g.stroke();
    g.restore();
    g.globalCompositeOperation = 'source-atop';
    const lg2 = g.createLinearGradient(0, 0, Wd, 0); lg2.addColorStop(0, 'rgba(255,246,225,.08)'); lg2.addColorStop(1, 'rgba(20,12,4,.2)'); g.fillStyle = lg2; g.fillRect(0, 0, Wd, Hh);
    g.globalCompositeOperation = 'source-over';
  }

  window.GerizimPeople = { drawPerson, drawAnimal };
})();
