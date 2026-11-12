/* שחזור המבנים על המפה, במבט מבחוץ: גופים פשוטים שהמפה מרימה מן הקרקע (שכבת "שחזור תלת-ממדי").
   כל גוף: טבעת של נקודות במטרים מזרחה וצפונה ממרכז הכנסייה, גובה הבסיס וגובה הראש מעל פני השטח, צבע ותקופה.

   מה שנמדד בחפירה: מהלך החומות, השערים, המגדלים, הבתים והמדרגות (אותם נתונים של הסיור הרגלי, walk_data.js),
   ומידות הכנסייה, חומתה ומגדליה כפי שהן בכרטיסים.
   מה שהוא השערה: גובה הקירות והגגות, כיפת הכנסייה, צורת קבר השיח', בניין המקדש הרומי שעל תל א-ראס,
   ומהלך גרם המדרגות היורד ממנו אל העיר (קו ישר במורד המדרון; ראו tools/ras_stairs.py).
   התקופות: p פרסית, h הלניסטית, hp שתיהן, r רומית, b ביזנטית, i אסלאמית. */
(function () {
  const W = window.GERIZIM_WALK;
  const feats = [];
  const STONE = '#e7dcc3', FIELD = '#b8a98c', ROOF = '#a9573c', PAVE = '#d6cab0', PAVE2 = '#c6b999', WATER = '#5d93ad',
    RUIN = '#a89f8c', WHITE = '#f1ecdf', BIG = '#a59a86';
  const add = (r, b, h, c, p) => { if (h - b >= 0.08) feats.push({ r, b: Math.round(b * 100) / 100, h: Math.round(h * 100) / 100, c, p }); };
  // תיבה שציריה מזרח-צפון: מרכז, רוחב (מזרח-מערב), עומק (צפון-דרום)
  const box = (cx, cy, w, d, b, h, c, p) => add([[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2]], b, h, c, p);
  // תיבה מסובבת: d לאורך הכיוון brg (מעלות מן הצפון, עם השעון), w לרוחבו
  const obox = (cx, cy, w, d, brg, b, h, c, p) => {
    const a = brg * Math.PI / 180, fx = Math.sin(a), fy = Math.cos(a), sx = fy, sy = -fx;
    add([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(q => [cx + sx * q[0] * w / 2 + fx * q[1] * d / 2, cy + sy * q[0] * w / 2 + fy * q[1] * d / 2]), b, h, c, p);
  };
  const ngon = (cx, cy, r, n, rot, b, h, c, p) => {
    const g = [];
    for (let i = 0; i < n; i++) { const a = (rot + i * 360 / n) * Math.PI / 180; g.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    add(g, b, h, c, p);
  };
  // כיפה: טבעות הולכות וצרות
  const dome = (cx, cy, R, z0, n, c, p, flat) => {
    const K = 6;
    for (let k = 0; k < K; k++) {
      const t0 = k / K * Math.PI / 2, t1 = (k + 1) / K * Math.PI / 2;
      ngon(cx, cy, R * Math.cos(t0), n, 360 / n / 2, z0 + R * (flat || 1) * Math.sin(t0), z0 + R * (flat || 1) * Math.sin(t1), c, p);
    }
  };

  /* ---------- המתחם והעיר, התקופה הפרסית וההלניסטית: הגופים של הסיור הרגלי ---------- */
  if (W) {
    const en = (x, z) => W.toEN(x, z);
    const MAT = { plaster: STONE, field: FIELD, roof: ROOF, bigstone: BIG };
    const per = s => s.per === 'h' ? 'h' : s.per === 'p' ? 'p' : 'hp';
    W.solids.forEach(s => {
      if (s.rampTo || !s.h) return;
      const [x1, z1, x2, z2] = s.box, g = W.terrain((x1 + x2) / 2, (z1 + z2) / 2);
      const top = s.y0 + s.h - g, base = Math.max(0, s.y0 - g);
      if (top < 0.4) return;
      add([en(x1, z1), en(x2, z1), en(x2, z2), en(x1, z2)], base, top, MAT[s.mat] || STONE, per(s));
    });
    // המדרגות והריצופים: לוח דק לכל מדרגה, כך שהגרם נראה מדורג על המדרון
    W.floors.forEach(f => {
      const [x1, z1, x2, z2] = f.box, p = per(f);
      if (f.ramp && f.steps) {
        const r = f.ramp, n = Math.min(f.steps, 14);
        for (let i = 0; i < n; i++) {
          const a = r.a + (r.b - r.a) * i / n, b = r.a + (r.b - r.a) * (i + 1) / n, y = r.ya + (r.yb - r.ya) * (i + 0.5) / n;
          const q = r.axis === 'x' ? [Math.min(a, b), z1, Math.max(a, b), z2] : [x1, Math.min(a, b), x2, Math.max(a, b)];
          const g = W.terrain((q[0] + q[2]) / 2, (q[1] + q[3]) / 2);
          add([en(q[0], q[1]), en(q[2], q[1]), en(q[2], q[3]), en(q[0], q[3])], 0, Math.min(3, Math.max(0.15, y - g + 0.25)), i % 2 ? PAVE : PAVE2, p);
        }
      } else if (f.mat === 'pave' || f.mat === 'step') {
        add([en(x1, z1), en(x2, z1), en(x2, z2), en(x1, z2)], 0, 0.12, PAVE, p);
      }
    });
  }

  /* ---------- התקופה הביזנטית: הכנסייה המתומנת, חומתה ומגדליה, והאגף הצפוני ---------- */
  const XW = -38.4, XE = 35.4, YS = -32.8, YN = 24.3;          // חומת המתחם, כמסומן במפה: כ-71 על 56 מ'
  const XM = (XW + XE) / 2, YM = (YS + YN) / 2;
  function enclosure(p, hw, ht, col, withNE) {
    box(XM, YS, XE - XW, 1.4, 0, hw, col, p); box(XM, YN, XE - XW, 1.4, 0, hw, col, p);
    box(XW, YM, 1.4, YN - YS, 0, hw, col, p); box(XE, YM, 1.4, YN - YS, 0, hw, col, p);
    [[XW, YS], [XE, YS], [XW, YN], [XM, YS]].forEach(q => box(q[0], q[1], 8.5, 8.5, 0, ht, col, p));        // שלוש פינות והמגדל שבאמצע הדרום
    if (withNE) box(XE, YN, 8.5, 8.5, 0, ht, col, p);
    box(0, YN + 1.5, 8.5, 9.5, 0, ht, col, p);                                                              // מגדל השער, בצפון
  }
  function north(p, hw, ht, col, full) {
    const x1 = -31, x2 = 31, y2 = 76;
    box(x1, (YN + y2) / 2, 1.6, y2 - YN, 0, hw, col, p); box(x2, (YN + y2) / 2, 1.6, y2 - YN, 0, hw, col, p); box(0, y2, x2 - x1, 1.6, 0, hw, col, p);
    box(x1, y2, 9, 9, 0, ht, col, p); box(x2, y2, 8.5, 10.8, 0, ht, col, p);
    if (full) {
      box(-16, 52, 21.7, 32.7, 0, 0.15, WATER, p);                               // הבריכה המערבית, 21.7 על 32.7 מ'
      box(14, 52, 28.4, 14, 0, 4.5, col, p); box(14, 67, 28.4, 15.5, 0, 8, col, p);   // הבניין הציבורי: קומה בדרום, שתיים בצפון
      box(14, 67, 29, 16, 8, 8.4, ROOF, p);
    }
  }
  enclosure('b', 7, 11, STONE, true);
  north('b', 7, 11, STONE, true);
  // הסטיו המקורה שלפני החדרים: גג רעפים סביב החצר
  [[XM, YS + 3.5, XE - XW - 4, 2.6], [XM, YN - 3.5, XE - XW - 4, 2.6], [XW + 3.5, YM, 2.6, YN - YS - 9.6], [XE - 3.5, YM, 2.6, YN - YS - 9.6]]
    .forEach(q => box(q[0], q[1], q[2], q[3], 3.8, 4.2, ROOF, 'b'));
  // גוף הכנסייה: מתומן שרוחבו 30 מ', אולם מרכזי בקוטר 21.5 מ' ומעליו כיפה (הכיפה וגובה הקירות משוערים)
  ngon(0, 0, 16.2, 8, 22.5, 0, 9, STONE, 'b');
  ngon(0, 0, 16.6, 8, 22.5, 9, 9.5, ROOF, 'b');
  ngon(0, 0, 10.75, 8, 22.5, 9.5, 13.5, STONE, 'b');
  dome(0, 0, 10.9, 13.5, 16, ROOF, 'b', 0.6);
  box(19, 0, 8.6, 7.8, 0, 8, STONE, 'b'); box(19, 0, 9, 8.2, 8, 8.4, ROOF, 'b');           // הבימה והאפסיס
  box(-17.6, 0, 4.2, 9.5, 0, 6, STONE, 'b');                                               // הנרתקס
  [[12.5, 11.5, 9.8], [12.5, -11.5, 9.8], [-12, 11.5, 8.4], [-12, -11.5, 8.4]].forEach(q => { box(q[0], q[1], q[2], 3.6, 0, 5.5, STONE, 'b'); });   // ארבע הקפלות

  /* ---------- התקופה האסלאמית: חורבות המתחם, וקבר שיח' ע'אנם על המגדל הצפון-מזרחי ---------- */
  enclosure('i', 3.2, 4.5, RUIN, false);
  north('i', 2, 3, RUIN, false);
  ngon(0, 0, 16.2, 8, 22.5, 0, 0.7, RUIN, 'i');                                           // יסודות הכנסייה, שקירותיה פורקו
  (function tomb() {
    const x = XE - 1, y = YN - 0.5, p = 'i';                    // המגדל הצפון-מזרחי, 8.5 על 8.5 מ', שנבנה מחדש עם כיפה
    box(x, y, 8.5, 8.5, 0, 5.6, WHITE, p);
    box(x, y, 9, 9, 5.6, 6, WHITE, p);                          // כרכוב הגג
    ngon(x, y, 3.5, 16, 0, 6, 6.7, WHITE, p);                   // תוף הכיפה
    dome(x, y, 3.3, 6.7, 16, WHITE, p);
    for (let i = 0; i < 7; i++) box(x - 5 - 0.1, y - 3.6 + i * 1.05, 1.3, 1.05, 0, 0.8 + i * 0.8, RUIN, p);   // גרם המדרגות העולה אל הגג
  })();

  /* ---------- התקופה הרומית: המקדש שעל תל א-ראס וגרם המדרגות היורד אל נאפוליס (מהלכו משוער) ---------- */
  (function ras() {
    const T = [125.3, 725.6], BR = 350, a = BR * Math.PI / 180, fx = Math.sin(a), fy = Math.cos(a), p = 'r';
    const along = d => [T[0] + fx * d, T[1] + fy * d];
    obox(T[0], T[1], 26, 38, BR, 0, 2.5, PAVE, p);                                   // הבמה
    obox(T[0], T[1], 15, 22, BR, 2.5, 4.3, STONE, p);                                // הפודיום: בניין של כ-14 על 21 מ'
    let c = along(-2.5); obox(c[0], c[1], 11, 15, BR, 4.3, 12, STONE, p);            // התא
    c = along(8.6);
    for (let i = 0; i < 4; i++) { const s = (i - 1.5) * 3.6, q = [c[0] + fy * s, c[1] - fx * s]; obox(q[0], q[1], 1.1, 1.1, BR, 4.3, 12, WHITE, p); }   // ארבעה עמודים בחזית, כמו על המטבעות
    obox(T[0], T[1], 15.6, 22.6, BR, 12, 12.8, STONE, p);
    obox(T[0], T[1], 11, 22.6, BR, 12.8, 13.8, ROOF, p); obox(T[0], T[1], 5.5, 22.6, BR, 13.8, 14.8, ROOF, p);
    // הגרם: 720 מ' במורד המדרון, ירידה של כ-240 מ'. כל לוח הוא קטע של 6 מ', לא מדרגה אחת
    for (let d = 16, i = 0; d < 736; d += 6, i++) { c = along(d + 3); obox(c[0], c[1], 7, 6, BR, 0, 0.6, i % 2 ? PAVE : PAVE2, p); }
  })();

  window.GERIZIM_RECON = {
    feats,
    // אילו תקופות מוצגות לכל בחירה בסרגל התקופות (בלי בחירה: המתחם ההלניסטי והמקדש הרומי, שאינם עולים זה על זה)
    show: { '': ['h', 'hp', 'r'], persian: ['p', 'hp'], hellenistic: ['h', 'hp'], roman: ['r'], byzantine: ['b'], islamic: ['i'] },
    focus: { roman: { at: [110, 800], zoom: 16.6, bearing: 170 }, byzantine: { at: [0, 10], zoom: 17.7, bearing: 200 }, islamic: { at: [25, 15], zoom: 18.1, bearing: 215 } }
  };
})();
