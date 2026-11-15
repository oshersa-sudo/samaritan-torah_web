/* הסיור הרגלי — ימינו (period 'n'): פסגת הר גריזים כפי שהיא היום.

   מה יש כאן:
   1. החורבות החפורות של המתחם והעיר: מאותם קווי קירות של החפירה (walk_data.js), בגובה של שרידים — בקירוב, לפי התצלומים.
   2. מבצר הכנסייה הביזנטית, מגדליו והכנסייה המתומנת — כשרידים; מידותיהם כמו בשחזור שעל המפה (recon.js).
   3. מקומות הקודש של העדה כפי שהם היום — שתים עשרה האבנים, גבעת עולם, מזבח יצחק — עם הגדרות שסביבם (walk_now_sites).
   4. קבר שיח' ע'אנם על המגדל הצפון-מזרחי, ואפשר להיכנס אליו (walk_now_tomb).

   מערכת הצירים היא של walk_data.js: x = מזרחה לפי רשת המתחם, z = דרומה (−n). רשת המתחם נוטה כ-15° מן הצפון;
   מה שמכוון לצפון האמיתי (הכנסייה, מקומות הקודש) נבנה מתיבות מסובבות (W.rboxes), שנמדדות במטרים מזרחה וצפונה
   ממרכז הכנסייה, כמו בכרטיסים ובשחזור שעל המפה. */
(function () {
  const W = window.GERIZIM_WALK, INFO = window.GERIZIM_WALK_INFO;
  if (!W || !INFO) return;
  const t = (he, en, ar) => ({ he, en, ar });
  const P = 'n';
  // ממטרים מזרחה/צפונה ממרכז הכנסייה אל צירי הסיור (ההפך של W.toEN)
  const fromEN = (E, N) => { const a = 0.259 * E + 0.966 * N, b = 0.966 * E - 0.259 * N; return [b + 56, -(a + 41)]; };
  const RY = Math.atan2(0.259, 0.966);                       // תיבה שצלעותיה לצפון ולמזרח האמיתיים
  const G = (x, z) => W.terrain(x, z);
  const hash = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
  W.rboxes = W.rboxes || [];
  const front = [];

  // תיבה לפי מרכז במטרים מזרחה (E) וצפונה (N), רוחב לאורך המזרח (w), עומק לאורך הצפון (d); rot — סיבוב נוסף במעלות, נגד כיוון השעון (מן המזרח אל הצפון)
  function enBox(E, N, w, d, h, mat, o) {
    o = o || {};
    const [x, z] = fromEN(E, N), base = o.y0 != null ? o.y0 : G(x, z) + (o.dy || 0);
    const r = Object.assign({ x, z, w, d, h, mat, per: P, ry: RY + (o.rot || 0) * Math.PI / 180, y0: base }, o);
    delete r.rot; delete r.dy; r.y0 = base;
    W.rboxes.push(r); return r;
  }
  // קיר חרב בין שתי נקודות (במטרים מזרחה/צפונה): נשבר לקטעים בגבהים שונים, ולפעמים חסר קטע
  function ruinWall(E1, N1, E2, N2, th, hMin, hMax, mat, o) {
    const L = Math.hypot(E2 - E1, N2 - N1), n = Math.max(1, Math.round(L / 5)), rot = Math.atan2(N2 - N1, E2 - E1) * 180 / Math.PI;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, cE = E1 + (E2 - E1) * k, cN = N1 + (N2 - N1) * k;
      const q = hash(cE, cN); if (o && o.gaps && q < o.gaps) continue;
      enBox(cE, cN, L / n + 0.05, th, hMin + (hMax - hMin) * hash(cN, cE), mat || 'bigstone', Object.assign({ rot }, o || {}));
    }
  }

  /* ---------- הקרקע: הולכים על פני השטח בכל הפסגה ---------- */
  W.floors.push({ id: 'nall', box: W.bounds.slice(), per: P, follow: true });

  /* ---------- 1. החורבות החפורות: קירות המתחם והעיר מן החפירה, בגובה של שרידים ---------- */
  W.solids.filter(s => (!s.per || s.per === 'h') && s.tl == null && !s.gone && !s.hide && !s.rampTo && !s.shed && s.h >= 0.5 && s.id !== 'altar' && s.id !== 'stones12' &&
      /^(field|bigstone|plaster|ashlar|rock)$/.test(s.mat || 'field'))
    .forEach(s => {
      const [x1, z1, x2, z2] = s.box, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, k = hash(cx, cz);
      const keep = Math.min(s.h, (s.mat === 'bigstone' ? 0.8 : 0.3) + k * (s.mat === 'bigstone' ? 1.2 : 0.9));
      const mat = s.mat === 'plaster' || s.mat === 'ashlar' ? 'field' : s.mat, y0 = G(cx, cz) - 0.15;
      const push = (b, hh) => W.solids.push({ box: b, h: hh, mat, per: P, y0 });
      // בית או מגדל שלם (תיבה רחבה): היום נשארו ממנו קירות ההיקף בלבד, ובאחד מהם פרצה
      if (x2 - x1 > 2.6 && z2 - z1 > 2.6) {
        const T = 0.65, gapSide = Math.floor(k * 4), gx = (x1 + x2) / 2, gz = (z1 + z2) / 2, g2 = 0.7;
        const sides = [[x1, z1, x2, z1 + T], [x1, z2 - T, x2, z2], [x1, z1, x1 + T, z2], [x2 - T, z1, x2, z2]];
        sides.forEach((b, i) => {
          const hh = keep * (0.6 + 0.4 * hash(i, cx));
          if (i !== gapSide) return push(b, hh);
          if (i < 2) { push([b[0], b[1], gx - g2, b[3]], hh); push([gx + g2, b[1], b[2], b[3]], hh); }
          else { push([b[0], b[1], b[2], gz - g2], hh); push([b[0], gz + g2, b[2], b[3]], hh); }
        });
      } else push([x1, z1, x2, z2], keep);
    });

  /* ---------- 2. מבצר הכנסייה הביזנטית והכנסייה המתומנת, כשרידים (מידות כמו ב-recon.js) ---------- */
  const XW = -38.4, XE = 35.4, YS = -32.8, YN = 24.3, XM = (XW + XE) / 2;
  // היום אפשר לעבור בין החורבות: בקירות פרצות, ובאמצע הדרום ובמערב פתחים של שבילי המבקרים
  ruinWall(XW, YS, XM - 5, YS, 1.4, 1.2, 3.2, 'ashlar', { gaps: 0.15 }); ruinWall(XM + 5, YS, XE, YS, 1.4, 1.2, 3.2, 'ashlar', { gaps: 0.15 });
  ruinWall(XW, YN, -4.3, YN, 1.4, 1.4, 3.4, 'ashlar', { gaps: 0.1 }); ruinWall(4.3, YN, XE - 4.3, YN, 1.4, 1.4, 3.4, 'ashlar', { gaps: 0.1 });
  ruinWall(XW, YS, XW, -6, 1.4, 1.2, 3.0, 'ashlar', { gaps: 0.15 }); ruinWall(XW, 0, XW, YN, 1.4, 1.2, 3.0, 'ashlar', { gaps: 0.15 });
  ruinWall(XE, YS, XE, YN - 4.3, 1.4, 1.2, 3.0, 'ashlar', { gaps: 0.12 });
  // המגדלים: שלוש פינות, אמצע הדרום ומגדל השער שבצפון. המגדל הצפון-מזרחי — ראו קבר שיח' ע'אנם
  [[XW, YS, 3.4], [XE, YS, 4.2], [XW, YN, 3.8]].forEach(q => enBox(q[0], q[1], 8.5, 8.5, q[2], 'ashlar'));
  enBox(XM - 3.6, YS, 1.3, 8.5, 2.6, 'ashlar'); enBox(XM + 3.6, YS, 1.3, 8.5, 2.8, 'ashlar');      // המגדל שבאמצע הדרום: נשארו דפנותיו, והשביל עובר ביניהן
  enBox(-3.55, YN + 3.3, 1.4, 6.6, 2.2, 'ashlar'); enBox(3.55, YN + 3.3, 1.4, 6.6, 2.4, 'ashlar');   // מגדל השער שבצפון: שני קירות הצד, והמעבר ביניהם פתוח
  // הכנסייה: קיר המתומן החיצוני (קוטר כ-32 מ') נמוך ושבור, ובסיסי העמודים של האולם הפנימי
  for (let i = 0; i < 8; i++) {
    const a1 = (22.5 + i * 45) * Math.PI / 180, a2 = (22.5 + (i + 1) * 45) * Math.PI / 180, R = 16.2;
    if (i === 4) continue;                                     // הפתח המערבי
    ruinWall(R * Math.cos(a1), R * Math.sin(a1), R * Math.cos(a2), R * Math.sin(a2), 1.2, 0.4, 1.3, 'ashlar', { gaps: 0.15 });
  }
  for (let i = 0; i < 8; i++) { const a = (22.5 + i * 45) * Math.PI / 180; enBox(10.75 * Math.cos(a), 10.75 * Math.sin(a), 1.3, 1.3, 0.5 + hash(i, 3) * 0.6, 'ashlar'); }
  enBox(19, 0, 8.6, 1.2, 0.9, 'ashlar'); enBox(19, 3.4, 8.6, 1.2, 0.7, 'ashlar'); enBox(22.7, 0, 1.2, 7.8, 1.0, 'ashlar');   // האפסיס
  enBox(-17.6, 4.2, 4.2, 1.0, 0.6, 'ashlar'); enBox(-17.6, -4.2, 4.2, 1.0, 0.5, 'ashlar');                                 // הנרתקס
  [[12.5, 11.5, 9.8], [12.5, -11.5, 9.8], [-12, 11.5, 8.4], [-12, -11.5, 8.4]].forEach(q => enBox(q[0], q[1], q[2], 1.0, 0.6 + hash(q[0], q[1]) * 0.5, 'ashlar'));   // ארבע הקפלות
  // האגף הצפוני: קירות נמוכים
  ruinWall(-31, YN, -31, 76, 1.6, 0.6, 1.8, 'ashlar', { gaps: 0.2 }); ruinWall(31, YN, 31, 76, 1.6, 0.6, 1.8, 'ashlar', { gaps: 0.2 }); ruinWall(-31, 76, 31, 76, 1.6, 0.6, 1.6, 'ashlar', { gaps: 0.2 });

  /* ---------- נקודות פתיחה ---------- */
  // bearing — כיוון המבט האמיתי (0 צפון, 90 מזרח); רשת הסיור נוטה ב-W.north מעלות
  const st = (k, E, N, bearing) => { const [x, z] = fromEN(E, N); W.starts[k] = { x, z, yaw: (bearing - W.north) * Math.PI / 180, per: P }; };
  W.nowStart = st;
  st('today', -47, 15, 180); st('teternal', 0, -91, 180); st('tisaac', 22, -171, 180); st('tghanim', 18, 10, 50);

  /* ---------- אזורים ---------- */
  const zone = (id, place, E, N, w, d, name, text, o) => {
    const [x, z] = fromEN(E, N), r = Math.max(w, d) / 2;
    const zz = Object.assign({ id, place, per: P, box: [x - r, z - r, x + r, z + r], anyY: true, y: G(x, z), name, text, tag: 'today' }, o || {});
    front.push(zz); return zz;
  };
  Object.assign(INFO.tags, { today: { col: '#7fa7c9', text: t('ימינו · לפי תצלומים עכשוויים, בקירוב', 'Today · after recent photographs, approximate', 'أيامنا · بحسب صور حديثة، على وجه التقريب') } });
  W.nowZone = zone;
  W.nowEN = { fromEN, enBox, ruinWall, RY, XE, YN };

  zone('nchurch', 'church', 0, 0, 34, 34, t('שרידי הכנסייה המתומנת', 'Remains of the octagonal church', 'بقايا الكنيسة المثمّنة'),
    t('היום נשארו מן הכנסייה של מרים יולדת האל רק תחתיות הקירות ובסיסי העמודים, בתוך חומת המבצר הביזנטי. הקירות נבנו מחדש מעט בשחזור הארכאולוגי, וסביבם שבילי מבקרים.',
      'Today only the bottoms of the walls and the column bases remain of the church of Mary Theotokos, inside the wall of the Byzantine fortress. The walls were partly rebuilt in the archaeological restoration, with visitor paths around them.',
      'لم يبقَ اليوم من كنيسة مريم والدة الإله إلا أسافل الجدران وقواعد الأعمدة، داخل سور الحصن البيزنطي. وقد رُمّمت الجدران جزئيًا في الترميم الأثري، وحولها ممرات للزوار.'));
  zone('nfort', 'towers', XM, YS + 4, 40, 10, t('חומת המבצר הביזנטי', 'The wall of the Byzantine fortress', 'سور الحصن البيزنطي'),
    t('החומה שהקיפה את הכנסייה ומגדליה עומדת היום בחלקה לגובה של כמה מטרים, אבנים גדולות מסותתות ששובצו בה גם אבנים מבניינים קדומים יותר.',
      'The wall that surrounded the church and its towers still stands in part to a height of several metres: large dressed stones, with blocks from earlier buildings set into it.',
      'لا يزال السور الذي أحاط بالكنيسة وأبراجها قائمًا في أجزاء منه بارتفاع بضعة أمتار: حجارة كبيرة منحوتة، أُدخلت فيها حجارة من مبانٍ أقدم.'));

  W.nowFront = front;
  // החזית נכנסת לראש רשימת האזורים אחרי שהמקומות והקבר נוספו (walk_now_sites)
  W.nowFinish = () => { if (front.length) { W.zones.unshift.apply(W.zones, front); front.length = 0; } };

  /* ---------- 4. קבר שיח' ע'אנם: המגדל הצפון-מזרחי של המבצר, ועליו הכיפה. אפשר להיכנס ולעלות לחדר העליון ----------
     מקורות: מידות המגדל (כ-9.1 מ' לכל צד) — סקר ארץ ישראל המערבית; הדלת במערב, 1 על 2 מ', שני חדרים זה מעל זה,
     החדר התחתון כ-4 על 4 מ' ובו גומחה בקיר הדרומי, מדרגות ברזל בפינה המערבית, מחראב בקיר הדרומי של החדר העליון —
     תיאורים בכתב (Yalla Falasteen, ויקיפדיה הערבית). אין תצלום של הפנים: סידור הפנים, גובה החדרים ומקום המדרגות בקירוב.
     הגובה (כ-9 מ'), הכיפה, ראש המדרגות שעל הגג בפינה הצפון-מערבית והחלונות שבחזית הדרומית — לפי התצלומים. */
  (function tomb() {
    const C0 = [34.4, 23.8], H = 4.55, IN = 2.05, WT = H - IN, TOP = 9.0, BASE = -0.3, SILL = 1.4, UP = 5.2;
    const [tx, tz] = fromEN(C0[0], C0[1]), gy = G(tx, tz);
    const LE = (u, v) => [C0[0] + u, C0[1] + v];
    W.nowTomb = { E: C0[0], N: C0[1], top: TOP + 0.5 - 0.3, R: 2.45 };       // לכיפה שבשחזור שעל המפה (גובה מעל הקרקע)
    const bx = (u, v, w, d, y0, h, mat, o) => { const q = LE(u, v); return enBox(q[0], q[1], w, d, h, mat, Object.assign({ y0: gy + y0 }, o || {})); };
    const fl = (id, u, v, w, d, y, o) => {
      const q = LE(u, v), c = fromEN(q[0], q[1]), r = Math.hypot(w, d) / 2 + 0.05;
      W.floors.push(Object.assign({ id, per: P, nodraw: true, box: [c[0] - r, c[1] - r, c[0] + r, c[1] + r], rot: { x: c[0], z: c[1], w, d, ry: RY }, y: y == null ? null : gy + y }, o || {}));
    };
    // הקירות: נדבכים תחתונים של אבני גזית גדולות (המגדל הביזנטי), ומעליהם בנייה מאוחרת של אבנים קטנות
    const wall = (u, v, w, d, y0, y1) => { const cut = 4.6; if (y0 < cut) bx(u, v, w, d, y0, Math.min(y1, cut) - y0, 'ashlar'); if (y1 > cut) bx(u, v, w, d, Math.max(y0, cut), y1 - Math.max(y0, cut), 'ashlar'); };
    wall(0, -(IN + WT / 2), 2 * H, WT, BASE, TOP);                       // הדרומי
    wall(0, IN + WT / 2, 2 * H, WT, BASE, TOP);                          // הצפוני
    wall(IN + WT / 2, 0, WT, 2 * IN, BASE, TOP);                         // המזרחי
    // המערבי, ובו הפתח: 1 מ' רוחב, 2 מ' גובה, הסף כ-1.4 מ' מעל הקרקע של היום
    const D1 = -2.05, D2 = -0.75, DM = (D1 + D2) / 2;     // הפתח: כ-1 מ' בתיאור; כאן 1.3 מ', כדי שההולך יעבור בו
    wall(-(IN + WT / 2), (D2 + IN) / 2, WT, IN - D2, BASE, TOP);
    wall(-(IN + WT / 2), DM, WT, D2 - D1, BASE, SILL);
    wall(-(IN + WT / 2), DM, WT, D2 - D1, SILL + 2.0, TOP);
    bx(-IN - 0.05, D2 - 0.5, 0.06, 1.0, SILL, 2.0, 'dark', { block: false, rot: 70 });   // כנף הדלת, פלדה כהה, פתוחה פנימה
    // מדרגות האבן שמחוץ לדלת: מן הקרקע אל הסף
    const NS = 8, SW = 2.8;
    fl('ngsteps', -H - SW / 2, DM, SW, 1.2, null, { excl: true, ramp: { axis: 'u', a: -SW / 2, b: SW / 2, ya: gy + 0.02, yb: gy + SILL }, steps: NS });
    for (let i = 0; i < NS; i++) bx(-H - SW + (i + 0.5) * SW / NS, DM, SW / NS + 0.02, 1.2, BASE, 0.3 + (i + 1) * SILL / NS, 'ashlar', { block: false, mini: false });
    fl('ngdoor', -(IN + WT / 2), DM, WT + 0.1, D2 - D1, SILL);
    // החדר התחתון, התקרה שמעליו (פתוחה מעל המדרגות), ומדרגות הברזל
    fl('ngroom1', 0, 0, 2 * IN, 2 * IN, SILL, { room: true });
    const SV = 1.6, SD = 0.9, S1 = -2.0, S2 = 1.0;                      // המדרגות לאורך הקיר הצפוני, עולות ממערב למזרח
    fl('ngstair', (S1 + S2) / 2, SV, S2 - S1, SD, null, { excl: true, ramp: { axis: 'u', a: -(S2 - S1) / 2, b: (S2 - S1) / 2, ya: gy + SILL, yb: gy + UP }, steps: 12, room: true });
    for (let i = 0; i < 12; i++) bx(S1 + (i + 0.5) * (S2 - S1) / 12, SV, 0.22, SD, SILL + (i + 1) * (UP - SILL) / 12 - 0.05, 0.05, 'dark', { block: false, mini: false });
    bx(0, (SV - SD / 2 - IN) / 2, 2 * IN, SV - SD / 2 + IN, UP - 0.3, 0.3, 'pale', { block: false, mini: false });                                   // התקרה, מדרום למדרגות
    bx((S2 + IN) / 2, SV, IN - S2, SD, UP - 0.3, 0.3, 'pale', { block: false, mini: false });                                                                         // מעל ראש המדרגות
    // החדר העליון, תחת הכיפה
    fl('ngroom2', 0, (-IN + SV - SD / 2) / 2, 2 * IN, SV - SD / 2 + IN, UP, { room: true });
    fl('ngland', (S2 + IN) / 2, SV, IN - S2, SD, UP, { room: true });
    // גומחות: בקיר הדרומי של החדר התחתון, והמחראב בקיר הדרומי של החדר העליון
    bx(0, -IN + 0.03, 1.0, 0.06, SILL + 0.6, 0.7, 'dark', { block: false, mini: false });
    bx(0, -IN + 0.04, 0.9, 0.08, UP, 1.5, 'dark', { block: false, mini: false });
    bx(0, -IN + 0.06, 1.15, 0.06, UP + 1.5, 0.18, 'pale', { block: false, mini: false });
    // החלונות: בחזית הדרומית חרך ושני חלונות קטנים מסורגים גבוה, ובצפונית חלון אחד
    [[-1.0, 0.16, 0.8], [1.3, 0.5, 0.6], [2.4, 0.5, 0.6]].forEach(q => bx(q[0], -H - 0.03, q[1], 0.08, 6.1, q[2], 'dark', { block: false, mini: false }));
    bx(0.4, H + 0.03, 0.45, 0.08, 6.3, 0.55, 'dark', { block: false, mini: false });
    bx(1.5, -H - 0.03, 1.1, 0.06, 7.4, 0.55, 'pale', { block: false, mini: false });                 // לוח הכתובת משנת 1965
    // הגג: משטח עם פתח מתחת לכיפה, מעקה בנוי סביבו, וראש המדרגות בפינה הצפון-מערבית
    const HO = 1.7;
    bx(0, -(HO + (H - HO) / 2), 2 * H, H - HO, TOP - 0.35, 0.35, 'pale', { block: false, mini: false });
    bx(0, HO + (H - HO) / 2, 2 * H, H - HO, TOP - 0.35, 0.35, 'pale', { block: false, mini: false });
    bx(-(HO + (H - HO) / 2), 0, H - HO, 2 * HO, TOP - 0.35, 0.35, 'pale', { block: false, mini: false });
    bx(HO + (H - HO) / 2, 0, H - HO, 2 * HO, TOP - 0.35, 0.35, 'pale', { block: false, mini: false });
    bx(0, -H + 0.22, 2 * H, 0.45, TOP, 0.8, 'ashlar', { mini: false }); bx(0, H - 0.22, 2 * H, 0.45, TOP, 0.8, 'ashlar', { mini: false });
    bx(-H + 0.22, 0, 0.45, 2 * H - 0.9, TOP, 0.8, 'ashlar', { mini: false }); bx(H - 0.22, 0, 0.45, 2 * H - 0.9, TOP, 0.8, 'ashlar', { mini: false });
    bx(-H + 1.2, H - 1.2, 1.9, 1.9, TOP, 1.15, 'ashlar', { mini: false }); bx(-H + 1.2, H - 1.2, 2.3, 2.3, TOP + 1.15, 0.14, 'pale', { mini: false });
    // הכיפה המטויחת, בלי תוף, וקנה ברזל כפוף בראשה; מבפנים — תקרת החדר העליון
    W.hooks = (W.hooks || []).concat([cx => {
      if (cx.period !== P) return;
      const THREE = cx.THREE, R = 2.45;
      const mat = new THREE.MeshLambertMaterial({ color: 0xe9e3d3, side: THREE.DoubleSide });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      // הכיפה עולה כ-1.5 מ' מעל המעקה (בתצלומים): יושבת על טבעת נמוכה שמעל פתח הגג
      const DB = TOP + 0.5;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(R, R, DB - (TOP - 0.35), 28, 1, true), mat); ring.position.set(tx, (DB + TOP - 0.35) / 2 + gy, tz); cx.root.add(ring);
      dome.scale.y = 0.72; dome.position.set(tx, gy + DB, tz); cx.root.add(dome);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), cx.M.dark); rod.position.set(tx, gy + DB + R * 0.72 + 0.25, tz); cx.root.add(rod);
      // אורן ליד הפינה הצפון-מערבית (בתצלומי 2013)
      const pq = fromEN(C0[0] - H - 3, C0[1] + H + 1.5), py = G(pq[0], pq[1]);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 4.2, 8), cx.M.wood || cx.M.dark); trunk.position.set(pq[0], py + 2.1, pq[1]); cx.root.add(trunk);
      const leaf = new THREE.MeshLambertMaterial({ color: 0x3f5a32 });
      [[2.6, 3.2, 3.6], [2.0, 2.8, 5.2], [1.3, 2.3, 6.6]].forEach(q => { const c = new THREE.Mesh(new THREE.ConeGeometry(q[0], q[1], 10), leaf); c.position.set(pq[0], py + q[2], pq[1]); c.castShadow = cx.shadows; cx.root.add(c); });
    }]);
    W.blocks = (W.blocks || []).concat([{ x: fromEN(C0[0] - H - 3, C0[1] + H + 1.5)[0], z: fromEN(C0[0] - H - 3, C0[1] + H + 1.5)[1], r: 0.5, per: P }]);
    // אזורים: שני החדרים, ואחריהם המגדל מבחוץ
    const zin = (id, y, name, text) => { const c = fromEN(C0[0], C0[1]); front.push({ id, place: 'ghanim', per: P, box: [c[0] - 2.3, c[1] - 2.3, c[0] + 2.3, c[1] + 2.3], y: gy + y, signY: 2.2, signNear: 5, name, text, tag: 'tguessN' }); };
    zin('nghanim1', SILL, t('קבר שיח\' ע\'אנם · החדר התחתון', 'Sheikh Ghanim\'s tomb · the lower room', 'مقام الشيخ غانم · الغرفة السفلى'),
      t('חדר כ-4 על 4 מ\' בתוך קירות עבים של המגדל הביזנטי, ובקיר הדרומי גומחה. מדרגות ברזל בפינה עולות אל החדר העליון. לפני השיפוץ של 1965 היו כאן קברים. אין תצלום של הפנים, והסידור כאן לפי תיאורים בכתב.',
        'A room of about 4 by 4 m inside the thick walls of the Byzantine tower, with a niche in the south wall. An iron stair in the corner climbs to the upper room. Before the 1965 restoration there were graves here. No photograph of the interior exists, so its arrangement here follows written descriptions.',
        'غرفة نحو 4 × 4 م داخل الجدران السميكة للبرج البيزنطي، وفي الجدار الجنوبي كوّة. درج حديدي في الزاوية يصعد إلى الغرفة العليا. وقبل ترميم 1965 كانت هنا قبور. لا توجد صورة للداخل، فالترتيب هنا بحسب أوصاف مكتوبة.'));
    zin('nghanim2', UP, t('קבר שיח\' ע\'אנם · החדר העליון', 'Sheikh Ghanim\'s tomb · the upper room', 'مقام الشيخ غانم · الغرفة العليا'),
      t('החדר שתחת הכיפה, ובקיר הדרומי מחראב קטן הפונה למכה. מחלונותיו הקטנים נשקף נוף רחב — על כך כתב כבר ויקטור גרן במאה ה-19. הכיפה שופצה ב-1689, והבניין כולו ב-1965.',
        'The room under the dome, with a small mihrab facing Mecca in the south wall. Its small windows look out over a wide view, which Victor Guérin already praised in the 19th century. The dome was repaired in 1689, and the whole building in 1965.',
        'الغرفة التي تحت القبة، وفي جدارها الجنوبي محراب صغير نحو مكة. ومن نوافذها الصغيرة يُطلّ منظر واسع امتدحه فيكتور غيران في القرن التاسع عشر. رُمّمت القبة سنة 1689، والبناء كله سنة 1965.'));
    zone('nghanim', 'ghanim', C0[0], C0[1], 2 * H + 8, 2 * H + 8, t('קבר שיח\' ע\'אנם', 'The tomb of Sheikh Ghanim', 'مقام الشيخ غانم'),
      t('המקאם בעל הכיפה עומד על מגדל הפינה הצפון-מזרחי של המבצר הביזנטי. הנדבכים התחתונים, אבני גזית גדולות, הם של המגדל; הקומה העליונה מאבנים קטנות והכיפה הנמוכה המטויחת הם בנייה מוסלמית מאוחרת, ששופצה לאחרונה ב-1965 (לוח הכתובת בחזית הדרומית). הדלת הנמוכה במערב, ומדרגות אבן עולות אליה. המסורת המוסלמית קושרת את המקום לשייח\' ע\'אנם אל-אנצארי מבורין, בן תקופת צלאח א-דין, או לבנו עבדאללה; במסורת השומרונית נקרא קבר שכם בן חמור.',
        'The domed shrine stands on the north-east corner tower of the Byzantine fortress. The lower courses of large dressed blocks belong to the tower; the upper storey of small stones and the low plastered dome are a later Muslim rebuilding, last restored in 1965 (the inscription plaque on the south face). The low door is on the west, with stone steps up to it. Muslim tradition links the place to Sheikh Ghanim al-Ansari of Burin, of Saladin\'s time, or to his son Abdallah; Samaritan tradition called it the tomb of Shechem son of Hamor.',
        'يقوم المقام ذو القبة على البرج الشمالي الشرقي للحصن البيزنطي. المداميك السفلى من حجارة كبيرة منحوتة هي من البرج؛ أما الطابق العلوي من حجارة صغيرة والقبة الواطئة المجصّصة فبناء إسلامي لاحق، رُمّم آخر مرة سنة 1965 (لوح النقش في الواجهة الجنوبية). الباب الواطئ في الغرب، وتصعد إليه درجات حجرية. تنسب الرواية الإسلامية المكان إلى الشيخ غانم الأنصاري من بورين، من عصر صلاح الدين، أو إلى ابنه عبد الله؛ وسمّته الرواية السامرية قبر شكيم بن حمور.'),
      { signY: 11.2, signNear: 14 });
    Object.assign(INFO.tags, { tguessN: { col: '#c9a0a0', text: t('ימינו · הפנים לפי תיאורים בכתב, בלי תצלום · בקירוב', 'Today · the interior after written descriptions, without photographs · approximate', 'أيامنا · الداخل بحسب أوصاف مكتوبة، بلا صور · على وجه التقريب') } });
  })();

  // תיאורי המקומות כפי שהם היום (מתוך תצלומים; ראו research/holy)
  const PL = {"stones12": {"card": {"he": "רצועה צרה לרגלי החומה המערבית של מתחם הכנסייה הביזנטית, ובה ערמה של אבני גוויל גדולות מאוד ומסותתות בגסות, בגוני שמנת ואפור, ששתי שורות מהן עוד מונחות בקו אחד. בין האבנים צומחים עשב ושיחים נמוכים, והקרקע לבנה וגירית. מעקה נמוך של עמודי פלדה לבנים עם כבלי פלדה אופקיים מפריד בין האבנים לבין שביל המבקרים המרוצף, ושלט שמספרו 10 עומד בקצהו. ממערב עובר גדר הביטחון של הגן, ומעבר לו בתי קריית לוזה; בקצה הדרומי ניצבים מרפסת תצפית מקורה ומדרגות העולות אל המתחם.", "en": "A narrow strip at the foot of the western wall of the Byzantine church precinct holds a pile of very large, roughly squared cream-and-grey limestone blocks, two courses of which still lie in line. Grass and low shrubs grow between the blocks on white chalky ground. A low railing of white steel posts with horizontal steel cables separates the stones from the paved visitor path, where sign no. 10 stands. The park's perimeter fence runs along the west side with the houses of Kiryat Luza beyond, and a roofed viewing platform and a stair up to the precinct stand at the south end.", "ar": "في شريط ضيق عند أسفل الجدار الغربي لساحة الكنيسة البيزنطية كومة من حجارة كلسية كبيرة جدًا مشذّبة تشذيبًا خشنًا بلون كريمي ورمادي، وما زال صفّان منها مصفوفين في خط واحد. ينبت العشب والشجيرات المنخفضة بين الحجارة على أرض طباشيرية بيضاء. ويفصل حاجز منخفض من أعمدة فولاذية بيضاء تمتد بينها كوابل أفقية بين الحجارة وممر الزوار المبلّط، وعنده لافتة تحمل الرقم 10. ويمتد السياج الخارجي للحديقة على الجانب الغربي وخلفه بيوت قرية لوزة، وفي الطرف الجنوبي منصة مشاهدة مسقوفة ودرج يصعد إلى الساحة."}}, "eternal": {"card": {"he": "גבעת עולם היא משטח סלע גיר חשוף ורציף, חלק ונוטה בשיפוע מתון, בגודל של כחמישה־עשר עד שמונה־עשר מטרים לכל צד. הסלע אפור־לבנבן, חצוי בסדקים ארוכים ודקים ומנוקד בכתמי חזזית כתומה, ועשב צומח בסדקיו. לאורך הצד הפונה אל שביל המבקרים עומדת גדר רשת מרותכת נמוכה, ועליה שלט שמספרו 23; הצדדים האחרים פתוחים, ותוחמים אותם קיר אבן יבשה נמוך ושורת אבנים גדולות. מצפון נראים בתים שנחשפו בחפירה וחומת מתחם הכנסייה, ומדרום חורש אורנים.", "en": "The Everlasting Hill is a continuous sheet of bare limestone, smooth and gently sloping, about fifteen to eighteen metres on each side. The rock is pale grey to off-white, split by long thin cracks and spotted with orange lichen, with grass growing in the joints. A low welded-mesh fence carrying sign no. 23 runs along the side facing the visitor path. The other sides are open, edged by a low dry-stone wall and a row of large blocks. Excavated houses and the wall of the church precinct lie to the north, and a pine wood lies to the south.", "ar": "تلة العالم سطح متصل من الصخر الكلسي المكشوف، أملس ومنحدر انحدارًا خفيفًا، يبلغ نحو خمسة عشر إلى ثمانية عشر مترًا من كل جانب. لون الصخر رمادي فاتح يميل إلى البياض، تشقّه شقوق طويلة دقيقة وتنتشر عليه بقع من الأشنات البرتقالية، وينبت العشب في فواصله. ويمتد على طول الجانب المواجه لممر الزوار سياج منخفض من الشبك الملحوم عليه لافتة تحمل الرقم 23. أما الجوانب الأخرى فمفتوحة، يحدّها جدار منخفض من الحجارة الجافة وصف من الحجارة الكبيرة. وتقع إلى الشمال بيوت كُشفت في الحفريات وجدار ساحة الكنيسة، وإلى الجنوب غابة صنوبر."}}, "isaac": {"card": {"he": "מקום העקדה הוא חצר שקועה קטנה, שרצפתה סלע גיר קרסטי מחוספס ואפרפר, ובתוכה חריץ חצוב בסלע באורך של כשניים וחצי מטרים. משני צדדים מקיף אותה קיר תמך של אבן יבשה בגובה של כמטר, ועליו גדר רשת ירוקה. בחזית החצר שני שערים ירוקים לבאים, ולפניהם שלט ומדרך של לוחות אבן בהירים. בתוך החצר צומח עץ קטן, ומאחוריה משתרע חורש אורנים.", "en": "The place of the Binding is a small sunken court floored with rough, greyish karst limestone, with a rock-cut trench about two and a half metres long in the rock. On two sides it is held by a dry-stone retaining wall about a metre high, topped by a green welded-mesh fence. The front fence has two green pedestrian gates, with a sign and a landing of pale stone slabs before them. A small tree grows inside the court, and a pine wood rises behind it.", "ar": "موضع الذبيحة ساحة صغيرة غائرة أرضيتها صخر كلسي كارستي خشن رمادي اللون، وفي الصخر خندق منحوت يبلغ طوله نحو مترين ونصف. ويحيط بها من جانبين جدار استنادي من الحجارة الجافة ارتفاعه نحو متر، يعلوه سياج أخضر من الشبك الملحوم. وفي السياج الأمامي بوابتان خضراوان للمشاة، أمامهما لافتة ومصطبة من ألواح حجرية فاتحة. وتنمو داخل الساحة شجرة صغيرة، وخلفها غابة صنوبر."}}, "adamseth": {"card": {"he": "מזבח אדם ושת הוא גוש נמוך של לוחות אבן גיר גדולים ושטוחים, המונחים בשתי מדרגות, בגודל של כשני מטרים על מטר וחצי ובגובה של כחצי מטר. לאבנים גוון אפור, ופניהן העליונות שחוקות ובגוון ורדרד־חום. המזבח עומד על קרקע פתוחה של עשב יבש, חצץ ואדמה לבנה, ללא גדר. מאחוריו נמשכת שורה של אבנים גדולות, ובהמשך קיר טרסה של אבן יבשה; מתחם מזבח יצחק נמצא במרחק הליכה קצר.", "en": "The Altar of Adam and Seth is a low block of large flat limestone slabs laid in two steps, about two metres by one and a half and about half a metre high. The stones are grey, with worn, pinkish-buff upper faces. The altar stands on open ground of dry grass, gravel and white soil, with no fence. A row of large blocks runs behind it, with a dry-stone terrace wall beyond, and the Isaac enclosure is a short walk away.", "ar": "مذبح آدم وشيث كتلة منخفضة من ألواح حجرية كلسية كبيرة مسطحة موضوعة على درجتين، أبعادها نحو مترين في متر ونصف وارتفاعها نحو نصف متر. لون الحجارة رمادي، وسطوحها العليا متآكلة بلون وردي مائل إلى البني. ويقوم المذبح على أرض مكشوفة من العشب اليابس والحصى والتراب الأبيض، من غير سياج. ويمتد خلفه صف من الحجارة الكبيرة، ثم جدار مصطبة من الحجارة الجافة، وساحة مذبح إسحاق على مسافة قصيرة سيرًا على الأقدام."}}};
  /* ---------- 3. מקומות הקודש של העדה כפי שהם היום, והגדרות שסביבם ----------
     לפי תצלומים חופשיים מוויקישיתוף (2013, ושל שתים עשרה האבנים וגבעת עולם גם מ-2022), תצלום האוויר ותכנית האתר של החפירה.
     המידות שאין להן מקור כתוב — לפי קנה מידה בתצלומים (אדם 1.7 מ', מדרגה 0.17 מ'), בקירוב. */
  const FEN = [];                              // קטעי גדר לציור: { kind, a:[x,z], b:[x,z], y0, h }
  const FH = { cable: 1.0, mesh: 1.2, green: 1.5, security: 2.3 };
  // גדר לאורך נקודות (מטרים מזרחה/צפונה); base — גובה בסיס הגדר מעל הקרקע (למשל על קיר תמך)
  function fence(kind, pts, o) {
    o = o || {};
    for (let i = 0; i + 1 < pts.length; i++) {
      const [E1, N1] = pts[i], [E2, N2] = pts[i + 1], L = Math.hypot(E2 - E1, N2 - N1), n = Math.max(1, Math.ceil(L / 3));
      for (let k = 0; k < n; k++) {
        const e1 = E1 + (E2 - E1) * k / n, n1 = N1 + (N2 - N1) * k / n, e2 = E1 + (E2 - E1) * (k + 1) / n, n2 = N1 + (N2 - N1) * (k + 1) / n;
        const a = fromEN(e1, n1), b = fromEN(e2, n2), mid = fromEN((e1 + e2) / 2, (n1 + n2) / 2);
        const y0 = (o.yAbs != null ? o.yAbs : G(mid[0], mid[1])) + (o.base || 0);
        FEN.push({ kind, a, b, y0, h: FH[kind] });
      }
      // גוף חוסם בלתי נראה לאורך הקטע
      const mE = (E1 + E2) / 2, mN = (N1 + N2) / 2, m = fromEN(mE, mN);
      enBox(mE, mN, L, 0.14, FH[kind], 'field', { hide: true, rot: Math.atan2(N2 - N1, E2 - E1) * 180 / Math.PI, y0: (o.yAbs != null ? o.yAbs : G(m[0], m[1])) + (o.base || 0), mini: kind === 'security' ? '#7b8288' : '#3d6b4f' });
    }
  }
  // משטח שטוח דק (שביל, מדרך): לא חוסם
  const flat = (E, N, w, d, mat, rot, o) => enBox(E, N, w, d, 0.06, mat, Object.assign({ rot: rot || 0, block: false, dy: 0.01, mini: o && o.mini || (mat === 'pave' ? '#e3d7b6' : '#ddd2b4') }, o || {}));
  // שביל לאורך נקודות: קטעים של עד 5 מ'
  function path(pts, w, mat) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [E1, N1] = pts[i], [E2, N2] = pts[i + 1], L = Math.hypot(E2 - E1, N2 - N1), n = Math.max(1, Math.ceil(L / 5)), rot = Math.atan2(N2 - N1, E2 - E1) * 180 / Math.PI;
      for (let k = 0; k < n; k++) flat(E1 + (E2 - E1) * (k + 0.5) / n, N1 + (N2 - N1) * (k + 0.5) / n, L / n + 0.3, w, mat, rot);
    }
  }
  const PINES = [], SIGNS = [], ISAACF = {};

  // ---- שתים עשרה האבנים: רצועה לרגלי החומה המערבית של מבצר הכנסייה, כ-6 על 17 מ' ----
  {
    const E0 = -43.4, N0 = -2, W2 = 3.0, L2 = 8.5;
    enBox(XW, N0 - 1, 1.5, 19, 4.6, 'ashlar');                                           // החומה שממזרח: כאן עומדת לגובה כ-5 מ'
    // שתי שורות אבנים מונחות בקו אחד לאורך רגל החומה, ושאר האבנים — ערמה
    for (let i = 0; i < 12; i++) { const n = N0 - L2 + 0.8 + i * 1.4; enBox(E0 + W2 - 1.2, n, 1.3, 1.25, 0.7, 'bigstone'); enBox(E0 + W2 - 1.25, n + 0.35, 1.15, 1.1, 0.65, 'bigstone', { y0: G(...fromEN(E0 + W2 - 1.2, n)) + 0.7, block: false }); }
    for (let i = 0; i < 26; i++) {
      const q1 = hash(i, 1.7), q2 = hash(i, 4.1), q3 = hash(i, 9.3), s = 0.6 + q3 * 0.9;
      enBox(E0 - W2 + 0.6 + q1 * (2 * W2 - 3), N0 - L2 + 0.6 + q2 * (2 * L2 - 1.2), s * (0.9 + q2 * 0.5), s, s * (0.55 + q1 * 0.35), q3 > 0.5 ? 'bigstone' : 'ashlar', { rot: (q1 - 0.5) * 40, dy: -0.12 });
    }
    // מעקה של עמודי פלדה לבנים וכבלים לאורך השביל ובקצה הדרומי; בצפון גדר רשת אפורה עם שער; ממערב גדר הביטחון של הגן
    fence('cable', [[E0 - W2 - 0.7, N0 + 5.5], [E0 - W2 - 0.7, N0 - L2 - 0.7], [E0 + W2 - 0.2, N0 - L2 - 0.7]]);
    fence('mesh', [[E0 - W2 - 0.7, N0 + L2 + 0.7], [E0 - W2 - 0.7, N0 + 5.5]]);
    fence('mesh', [[E0 - W2 - 0.7, N0 + L2 + 0.7], [E0 - 1.2, N0 + L2 + 0.7]]); fence('mesh', [[E0 + 0.1, N0 + L2 + 0.7], [E0 + W2 - 0.2, N0 + L2 + 0.7]]);   // השער: פתח ביניהם
    fence('security', [[-58.5, -34], [-58.5, 22]]);
    path([[E0 - W2 - 2.2, N0 + 13], [E0 - W2 - 2.2, N0 - L2 - 2.2], [E0 + W2 + 4, N0 - L2 - 2.2]], 1.8, 'pave');
    SIGNS.push({ E: E0 - W2 - 1.6, N: N0 - L2 - 1.3, no: '10' });
    // מרפסת התצפית המקורה בפינה הדרומית-מערבית של המתחם
    { const P0 = [-35.5, -27.5]; [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]].forEach(q => enBox(P0[0] + q[0], P0[1] + q[1], 0.14, 0.14, 3.1, 'dark', { block: true })); enBox(P0[0], P0[1], 4.6, 4.6, 0.12, 'pale', { dy: 3.1, block: false }); }
    zone('nstones', 'stones12', E0, N0, 2 * W2 + 6, 2 * L2 + 4, t('שתים עשרה האבנים — היום', 'The Twelve Stones — today', 'الحجارة الاثنا عشر — اليوم'), PL.stones12.card);
  }

  // ---- גבעת עולם: משטח סלע גיר חשוף, כ-17 על 16 מ', נוטה מעט ----
  const EO = [-5, -108], EW = 8.5, ED = 8;
  {
    // גדר רשת נמוכה רק לאורך הצד הפונה אל השביל (מזרח), עם קטעי פינה קצרים; מצפון וממערב קיר אבן יבשה נמוך ושורת אבנים גדולות
    fence('mesh', [[EO[0] + EW - 2.5, EO[1] + ED + 0.8], [EO[0] + EW + 0.8, EO[1] + ED + 0.8], [EO[0] + EW + 0.8, EO[1] - ED - 0.8], [EO[0] + EW - 3.5, EO[1] - ED - 0.8]]);
    ruinWall(EO[0] - EW - 0.6, EO[1] - ED, EO[0] - EW - 0.6, EO[1] + ED + 0.6, 0.8, 0.6, 0.95, 'field');
    ruinWall(EO[0] - EW - 0.6, EO[1] + ED + 0.6, EO[0] + EW - 3, EO[1] + ED + 0.6, 0.8, 0.6, 0.9, 'field');
    for (let i = 0; i < 5; i++) enBox(EO[0] - EW + 2 + i * 2.6, EO[1] + ED + 1.9, 1.1, 0.9, 0.6 + hash(i, 7) * 0.6, 'bigstone', { rot: (hash(i, 2) - 0.5) * 20 });
    path([[EO[0] + EW + 2.2, EO[1] + ED + 3], [EO[0] + EW + 2.2, EO[1] - ED - 3]], 1.8, 'pave');
    SIGNS.push({ E: EO[0] + EW + 1.0, N: EO[1] + ED + 0.2, no: '23' });
    // הגת מן התקופה הביזנטית מדרום-מערב, ומעקה כבלים סביבה
    { const GP = [-20, -131]; enBox(GP[0], GP[1], 3.2, 2.4, 0.5, 'dark', { dy: -0.45, block: false }); fence('cable', [[GP[0] - 2.4, GP[1] - 2], [GP[0] + 2.4, GP[1] - 2], [GP[0] + 2.4, GP[1] + 2], [GP[0] - 2.4, GP[1] + 2], [GP[0] - 2.4, GP[1] - 2]]); }
    [[-14, -126], [-6, -129], [3, -127], [10, -131], [-22, -140], [14, -138]].forEach(q => PINES.push(q));
    zone('neternal', 'eternal', EO[0], EO[1], 2 * EW + 6, 2 * ED + 6, t('גבעת עולם — היום', 'The Eternal Hill — today', 'التلة الأبدية — اليوم'), PL.eternal.card);
  }

  // ---- מזבח יצחק: חצר שקועה כמטר, ובה חריץ חצוב; קירות תמך וגדר רשת ירוקה, שני שערים בחזית (בצפון) ----
  const IO = [18, -187], IW = 5.5, ID = 5.5, DEEP = 1.0;
  {
    const ic = fromEN(IO[0], IO[1]), gI = G(ic[0], ic[1]), FY = gI - DEEP;
    // רצפת החצר: ריבוע בכיוון רשת הסיור החסום בתוך החצר (הקרקע נחצבת רק בתוכו)
    const s = (2 * IW) / (Math.cos(RY) + Math.sin(RY)) / 2 - 0.1;
    W.floors.push({ id: 'nisaac', per: P, box: [ic[0] - s, ic[1] - s, ic[0] + s, ic[1] + s], y: FY, nodraw: true, cutM: 0 });
    ISAACF.y = FY;
    // קירות התמך: מן הרצפה ועד מעט מעל הקרקע; בחזית קיר נמוך ובו שני פתחים
    const TH = 0.8, top = DEEP + 0.25;
    enBox(IO[0], IO[1] - ID - TH / 2, 2 * IW + 2 * TH, TH, top, 'field', { y0: FY });
    enBox(IO[0] - IW - TH / 2, IO[1], TH, 2 * ID, top, 'field', { y0: FY }); enBox(IO[0] + IW + TH / 2, IO[1], TH, 2 * ID, top, 'field', { y0: FY });
    const GA = [IO[0] - 2.6, IO[0] + 2.6], GW = 1.2, NW = IO[1] + ID + TH / 2;
    const fw = (e1, e2) => enBox((e1 + e2) / 2, NW, e2 - e1, TH, DEEP + 0.8, 'field', { y0: FY });
    fw(IO[0] - IW - TH, GA[0] - GW / 2); fw(GA[0] + GW / 2, GA[1] - GW / 2); fw(GA[1] + GW / 2, IO[0] + IW + TH);
    // הגדר הירוקה: על קירות התמך בשלושה צדדים, ובחזית מאחורי הקיר הנמוך, עם שני שערים
    fence('green', [[IO[0] - IW - TH / 2, IO[1] + ID], [IO[0] - IW - TH / 2, IO[1] - ID - TH / 2], [IO[0] + IW + TH / 2, IO[1] - ID - TH / 2], [IO[0] + IW + TH / 2, IO[1] + ID]], { yAbs: FY + top });
    fence('green', [[IO[0] - IW - TH / 2, NW], [GA[0] - GW / 2, NW]], { yAbs: FY + DEEP + 0.8 }); fence('green', [[GA[0] + GW / 2, NW], [GA[1] - GW / 2, NW]], { yAbs: FY + DEEP + 0.8 }); fence('green', [[GA[1] + GW / 2, NW], [IO[0] + IW + TH / 2, NW]], { yAbs: FY + DEEP + 0.8 });
    // המדרגות היורדות מכל שער אל רצפת החצר
    GA.forEach((ge, gi) => {
      const len = 2.2, q = fromEN(ge, NW - TH / 2 - len / 2 + 0.4), r = Math.hypot(len, GW) / 2 + 0.05, gTop = G(...fromEN(ge, NW + 1.2));
      W.floors.push({ id: 'nisaacst' + gi, per: P, nodraw: true, excl: true, box: [q[0] - r, q[1] - r, q[0] + r, q[1] + r], rot: { x: q[0], z: q[1], w: len + 0.8, d: GW, ry: RY + Math.PI / 2 }, ramp: { axis: 'u', a: -(len + 0.8) / 2, b: (len + 0.8) / 2, ya: FY, yb: gTop }, steps: 5 });
      for (let k = 0; k < 5; k++) enBox(ge, NW + TH / 2 - (k + 0.5) * (len + 0.8) / 5, GW, (len + 0.8) / 5 + 0.02, Math.max(0.05, gTop - FY - (k + 1) * (gTop - FY) / 5 + 0.17), 'pale', { y0: FY, block: false, mini: false });
      flat(ge, NW + 1.4, 2.2, 1.6, 'pave');                                                             // מדרך לוחות האבן שלפני השער
    });
    // החריץ החצוב בסלע, כ-2.4 על 1.5 מ', עמוק כמטר — אי אפשר לרדת אליו
    enBox(IO[0] + 0.5, IO[1] - 1, 2.4, 1.5, 0.04, 'dark', { y0: FY + 0.01, block: false });
    enBox(IO[0] + 0.5, IO[1] - 1, 2.4, 1.5, 1.0, 'dark', { y0: FY, hide: true });
    SIGNS.push({ E: IO[0], N: NW + 1.0, no: '' });
    // עץ קטן בתוך החצר, צריף צבוע אדום-חלודה לצדה, וחורש אורנים מאחוריה
    PINES.push([IO[0] - 3, IO[1] + 2, 0.55, FY]);
    enBox(IO[0] + IW + 7, IO[1] + 3, 3.2, 2.5, 2.5, 'clay');
    [[12, -201], [20, -203], [28, -199], [33, -191], [8, -205], [26, -209], [35, -205]].forEach(q => PINES.push(q));
    W.blocks = (W.blocks || []).concat([{ x: fromEN(IO[0] - 3, IO[1] + 2)[0], z: fromEN(IO[0] - 3, IO[1] + 2)[1], r: 0.35, per: P }]);
    const zi = fromEN(IO[0], IO[1]);
    front.push({ id: 'nisaacin', place: 'isaac', per: P, box: [zi[0] - s, zi[1] - s, zi[0] + s, zi[1] + s], y: FY, signY: 2.4, signNear: 7, name: t('מקום העקדה — בתוך החצר', 'The place of the Binding — inside the court', 'موضع الذبيحة — داخل الساحة'), text: PL.isaac.card, tag: 'today' });
    zone('nisaac', 'isaac', IO[0], IO[1], 2 * IW + 8, 2 * ID + 8, t('מזבח יצחק — היום', 'The Altar of Isaac — today', 'مذبح إسحاق — اليوم'), PL.isaac.card);
  }

  // ---- מזבח אדם ושת: גוש נמוך של לוחות אבן בשתי מדרגות, בלי גדר. מקומו המדויק אינו מתועד — כאן בקירוב, סמוך לחצר יצחק ----
  const A0 = [4, -197];
  {
    enBox(A0[0], A0[1], 2.2, 1.6, 0.27, 'ashlar', { dy: -0.02 }); enBox(A0[0], A0[1] + 0.1, 1.6, 1.1, 0.25, 'ashlar', { dy: 0.25, block: false });
    for (let i = 0; i < 5; i++) enBox(A0[0] - 2.6 + i * 1.3, A0[1] - 3.2, 1.15, 0.8, 0.6, 'bigstone', { rot: (hash(i, 5) - 0.5) * 12 });
    ruinWall(A0[0] - 6, A0[1] - 6, A0[0] + 6, A0[1] - 6.5, 0.9, 0.7, 1.0, 'field');
    zone('nadam', 'adamseth', A0[0], A0[1], 8, 8, t('מזבח אדם ושת — היום', 'The Altar of Adam and Seth — today', 'مذبح آدم وشيث — اليوم'), PL.adamseth.card, { tag: 'tguessN' });
  }

  // ---- שביל החצץ הרחב של הגן: מחצר יצחק צפונה, לאורך גבעת עולם, אל פינת המתחם ושתים עשרה האבנים ----
  path([[IO[0], IO[1] + ID + 3.5], [12, -160], [7, -132], [EO[0] + EW + 4.5, EO[1] - ED], [EO[0] + EW + 4.5, EO[1] + ED + 4], [-12, -78], [-28, -48], [-42, -24], [-48, -13]], 3.6, 'earth');
  path([[A0[0] + 2, A0[1] + 3], [IO[0] - 2, IO[1] + ID + 3.5]], 1.6, 'earth');

  // ---- הציור: גדרות, שלטים ממוספרים, אורנים, ומשטח הסלע של גבעת עולם ----
  W.hooks = (W.hooks || []).concat([cx => {
    if (cx.period !== P) return;
    const THREE = cx.THREE, root = cx.root, lite = cx.lite;
    const grid = (col, cell) => cx.texture('fence-' + col, 64, 64, c => { const g = c.getContext('2d'); g.clearRect(0, 0, 64, 64); g.strokeStyle = col; g.lineWidth = 3; for (let i = 0; i <= 64; i += 64 / cell) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } });
    const MAT = {
      white: new THREE.MeshLambertMaterial({ color: 0xeeeeea }), steel: new THREE.MeshLambertMaterial({ color: 0xb8bcbc }),
      grey: new THREE.MeshLambertMaterial({ color: 0x8c9396 }), green: new THREE.MeshLambertMaterial({ color: 0x3f6b46 })
    };
    const meshMat = (col, cell) => { const tx = grid(col, cell).clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return new THREE.MeshLambertMaterial({ map: tx, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }); };
    const panel = { mesh: meshMat('#46504c', 4), green: meshMat('#2f5a37', 4), security: meshMat('#7d858a', 5) };
    for (const f of FEN) {
      const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], L = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx), cxm = (f.a[0] + f.b[0]) / 2, czm = (f.a[1] + f.b[1]) / 2;
      const postMat = f.kind === 'cable' ? MAT.white : f.kind === 'green' ? MAT.green : MAT.grey;
      const post = (x, z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, f.h, 6), postMat); p.position.set(x, f.y0 + f.h / 2, z); root.add(p); };
      post(f.a[0], f.a[1]); if (L > 2.2) post(cxm, czm);
      if (f.kind === 'cable') {
        for (const hh of [0.25, 0.5, 0.75]) { const c = new THREE.Mesh(new THREE.BoxGeometry(L, 0.012, 0.012), MAT.steel); c.position.set(cxm, f.y0 + hh, czm); c.rotation.y = ang; root.add(c); }
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 6), MAT.white); top.rotation.z = Math.PI / 2; const g2 = new THREE.Group(); g2.add(top); g2.position.set(cxm, f.y0 + f.h, czm); g2.rotation.y = ang; root.add(g2);
      } else {
        const m = panel[f.kind].clone(); m.map = panel[f.kind].map.clone(); m.map.needsUpdate = true; m.map.repeat.set(L / 0.8, f.h / 0.8);
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(L, f.h), m); pl.position.set(cxm, f.y0 + f.h / 2, czm); pl.rotation.y = ang; root.add(pl);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, 0.04), postMat); rail.position.set(cxm, f.y0 + f.h, czm); rail.rotation.y = ang; root.add(rail);
        if (f.kind === 'security') { const arm = new THREE.Mesh(new THREE.BoxGeometry(L, 0.45, 0.02), panel.security); arm.position.set(cxm, f.y0 + f.h + 0.18, czm); arm.rotation.y = ang; arm.rotation.x = 0.6; root.add(arm); }
      }
    }
    // השלטים הממוספרים של הגן: לוח בהיר על שני עמודים
    for (const s of SIGNS) {
      const [x, z] = fromEN(s.E, s.N), y = G(x, z), g = new THREE.Group();
      const tx = cx.texture('nsign' + s.no, 128, 128, c => { const q = c.getContext('2d'); q.fillStyle = '#d9c9a3'; q.fillRect(0, 0, 128, 128); q.strokeStyle = '#7a6a4a'; q.lineWidth = 6; q.strokeRect(4, 4, 120, 120); q.fillStyle = '#4a3b22'; q.font = 'bold 54px sans-serif'; q.textAlign = 'center'; q.fillText(s.no, 64, 58); for (let i = 0; i < 4; i++) q.fillRect(22, 74 + i * 11, 84 - i * 9, 4); });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.04), new THREE.MeshLambertMaterial({ map: tx })); board.position.y = 1.2; g.add(board);
      for (const sx of [-0.27, 0.27]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.05), new THREE.MeshLambertMaterial({ color: 0xa08a60 })); p.position.set(sx, 0.8, -0.03); g.add(p); }
      g.position.set(x, y, z); g.rotation.y = RY + Math.PI / 2; root.add(g);
    }
    // אורנים
    const leaf = new THREE.MeshLambertMaterial({ color: 0x3f5a32 }), bark = cx.M.wood || cx.M.dark;
    for (const q of PINES) {
      const [x, z] = fromEN(q[0], q[1]), y = q[3] != null ? q[3] : G(x, z), k = (q[2] || 1) * (0.85 + hash(q[0], q[1]) * 0.4);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * k, 0.24 * k, 4.6 * k, 7), bark); tr.position.set(x, y + 2.3 * k, z); root.add(tr);
      [[2.4, 2.6, 3.8], [1.9, 2.4, 5.0], [1.2, 2.0, 6.1]].forEach(c => { const m = new THREE.Mesh(new THREE.ConeGeometry(c[0] * k, c[1] * k, lite ? 7 : 10), leaf); m.position.set(x, y + c[2] * k, z); m.castShadow = cx.shadows; root.add(m); });
    }
    // משטח הסלע של גבעת עולם: גיר חשוף, סדוק, עם כתמי חזזית כתומה — צמוד לפני השטח
    const rockTx = cx.texture('nrock', 512, 512, c => {
      const g = c.getContext('2d'); g.fillStyle = '#cfcac0'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 900; i++) { const v = 180 + Math.floor(hash(i, 1) * 50); g.fillStyle = 'rgba(' + v + ',' + (v - 4) + ',' + (v - 12) + ',.35)'; g.fillRect(hash(i, 2) * 512, hash(i, 3) * 512, 6 + hash(i, 4) * 22, 4 + hash(i, 5) * 14); }
      g.strokeStyle = 'rgba(70,64,56,.75)'; g.lineWidth = 1.6;
      for (let i = 0; i < 14; i++) { let x = hash(i, 6) * 512, y = hash(i, 7) * 512; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (hash(i, k + 8) - 0.5) * 90; y += (hash(k, i + 3) - 0.3) * 70; g.lineTo(x, y); } g.stroke(); }
      for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(214,128,40,' + (0.25 + hash(i, 9) * 0.4) + ')'; g.beginPath(); g.arc(hash(i, 10) * 512, hash(i, 11) * 512, 2 + hash(i, 12) * 7, 0, 7); g.fill(); }
    });
    const geo = new THREE.PlaneGeometry(2 * EW, 2 * ED, 24, 24); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, c0 = fromEN(EO[0], EO[1]), cs = Math.cos(RY), sn = Math.sin(RY);
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), lz = pos.getZ(i), wx = c0[0] + cs * lx + sn * lz, wz = c0[1] - sn * lx + cs * lz;
      const edge = Math.min(EW - Math.abs(lx), ED - Math.abs(lz));
      pos.setXYZ(i, wx, G(wx, wz) + 0.06 - (edge < 1.2 ? (1.2 - edge) * 0.05 : 0), wz);
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: rockTx })); rock.receiveShadow = cx.shadows; root.add(rock);
    // רצפת חצר יצחק: אותו גיר, אפור ומחוספס יותר
    const ig = new THREE.PlaneGeometry(2 * IW, 2 * ID); ig.rotateX(-Math.PI / 2);
    const im = new THREE.Mesh(ig, new THREE.MeshLambertMaterial({ map: rockTx, color: 0xb3ada2 })); const ic2 = fromEN(IO[0], IO[1]); im.position.set(ic2[0], ISAACF.y + 0.02, ic2[1]); im.rotation.y = RY; im.receiveShadow = cx.shadows; root.add(im);
  }]);


  W.nowFinish();
})();
