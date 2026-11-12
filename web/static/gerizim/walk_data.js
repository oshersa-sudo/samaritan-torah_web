/* הסיור הרגלי במתחם המקודש ובעיר: נתוני השחזור הסכמטי.

   מערכת הצירים היא של המתחם עצמו, כפי שנמדדה על תוכניות החפירה:
     n = מטרים צפונה לאורך החומה המערבית, e = מטרים מזרחה ממנה;
     הראשית בפינה הדרום-מערבית של הגרעין המקודש (מפגש החומה המערבית עם המתחם המבוצר).
   ציר n נוטה כ-15 מעלות מזרחה מן הצפון. בזירה: x = e, z = −n, y = גובה (0 במפלס הרחבה).

   מה שנמצא בחפירה: מהלך החומות, השערים, גרם המדרגות, החצרות, המצודה והמידות שלהם.
   מה שהוא השערה ומוצג כהשערה: גובה הקירות, הגגות, בניין המקדש, מקומו המדויק של המזבח, והדמויות. */
(function () {
  const t = (he, en, ar) => ({ he, en, ar });
  const H = 'h', P = 'p';                        // התקופה ההלניסטית, התקופה הפרסית
  const nb = (n1, n2, e1, e2) => [e1, -n2, e2, -n1];      // תיבה לפי n ו-e -> [x1, z1, x2, z2]

  /* ---------- מפלסי ההליכה ---------- */
  const floors = [];
  const F = (id, n1, n2, e1, e2, o) => floors.push(Object.assign({ id, box: nb(n1, n2, e1, e2), y: 0, mat: 'earth' }, o || {}));
  // ramp: axis 'n' או 'e', מן הערך a (גובה ya) אל הערך b (גובה yb)
  const R = (axis, a, ya, b, yb) => axis === 'e' ? { axis: 'x', a, b, ya, yb } : { axis: 'z', a: -a, b: -b, ya, yb };

  // ---- הרחבה ----
  F('plaza', 0, 80.5, 0, 86.5, { per: H });
  F('plazaN', 80.5, 88.2, 49.35, 74, { per: H });
  F('plazaN2', 80.5, 84.5, 74, 86.5, { per: H });
  F('plazaE', 22, 36.9, 86.5, 93.2, { per: H });
  F('plazaS', -36, 0, 51, 72, { per: H });
  F('plazaS2', -13, 0, 37, 51, { per: H });
  F('plazaS3', -9, 0, 72, 84, { per: H });
  F('plazaP', 3, 80.5, 0, 85, { per: P });
  F('pave', 34, 54, 58, 82, { y: 0.02, mat: 'pave', deco: true });
  // ---- השער המזרחי, רחבת המדרגות וגרם המדרגות המונומנטלי (57 מדרגות, 15.5 מ') ----
  F('egate', 41.65, 46.35, 82, 92, { mat: 'pave', per: H });
  F('usteps', 36.3, 51.9, 92, 96.9, { mat: 'step', per: H, ramp: R('e', 92, 0, 96.9, -1.35), steps: 5 });
  F('landing', 36.3, 51.9, 96.9, 99.5, { y: -1.35, mat: 'pave', per: H });
  F('stairsUp', 45.5, 53.9, 99.5, 108, { mat: 'step', per: H, ramp: R('e', 99.5, -1.35, 108, -5.6), steps: 16 });
  F('stairsLow', 38, 60.8, 108, 121, { mat: 'step', per: H, ramp: R('e', 108, -5.6, 121, -12.1), steps: 24 });
  F('lgsteps', 39.4, 43.4, 121, 125, { mat: 'step', per: H, ramp: R('e', 121, -12.1, 125, -15.5), steps: 12 });
  F('lgate', 36.9, 45.9, 125, 129.5, { y: -15.5, mat: 'pave', per: H });
  F('lgdoor', 45.9, 47.7, 125.1, 128.9, { y: -15.5, mat: 'pave', per: H });
  F('estreet', 47.7, 96, 121.5, 131.5, { y: -15.5, mat: 'pave', per: H });
  // ---- חצרות עולי הרגל ----
  F('court1ramp', 31, 36.3, 96.9, 99.5, { mat: 'pave', per: H, ramp: R('n', 36.3, -1.35, 31, -5) });
  F('court1', -6, 31, 96.5, 109, { y: -5, per: H });
  F('courtStepsA', -12, -6, 98.5, 108, { mat: 'step', per: H, ramp: R('n', -6, -5, -12, -8), steps: 11 });
  F('courtSq', -31, -12, 98.5, 126.5, { y: -8, per: H });
  F('courtStepsB', -12, -6, 113, 126, { mat: 'step', per: H, ramp: R('n', -12, -8, -6, -10), steps: 8 });
  F('court2', -6, 34, 112, 127, { y: -10, per: H });
  // ---- השער הצפוני והדרך לשכם ----
  F('ngate', 80.5, 97, 45.65, 49.35, { mat: 'pave', per: H });
  F('nroad', 97, 128, 42, 53, { per: H, ramp: R('n', 97, 0, 128, -4) });
  F('ngateP', 80.5, 96.5, 48.75, 55.25, { per: P });
  F('nroadP', 96.5, 128, 46, 58, { per: P, ramp: R('n', 96.5, 0, 128, -4) });
  F('ashdoor', 80.5, 82.6, 64, 66, { per: P });
  F('ashyard', 82.6, 89.2, 61, 70.5, { per: P });
  // ---- הכניסה המערבית, המתחם המבוצר והמצודה ----
  F('wstairs', -48, -39, 32.5, 39, { mat: 'step', per: H, ramp: R('e', 32.5, -2.6, 39, 0), steps: 13 });
  F('wland', -48, -39, 39, 51, { mat: 'pave', per: H });
  F('wland2', -48, -36, 51, 60, { mat: 'pave', per: H });
  F('encsteps', -7.5, -3, 32.4, 34.8, { mat: 'step', per: H, ramp: R('n', -3, 0, -7.5, -1.2), steps: 6 });
  F('encdoor', -3, 0, 33, 34.2, { mat: 'pave', per: H });
  F('encyard', -36.6, -3, 0.4, 34.6, { y: -1.2, mat: 'pave', per: H });
  F('citdoor', -14, -9, 80, 83, { mat: 'pave', per: H });
  F('cityard', -30, -14, 78, 87.7, { mat: 'pave', per: H });
  // ---- העיר: הרחוב שלרגלי הכניסה המערבית, האחוזה ובית הבד, בית מגורים ----
  F('wfoot', -56, -39, 25.7, 32.5, { y: -2.6, mat: 'pave', per: H });
  F('street', -63, -56, -48, 32.5, { y: -2.6, mat: 'pave', per: H });
  F('pdoor', -56, -52, -20.2, -16.8, { y: -2.6, mat: 'pave', per: H });
  F('pressyard', -53, -36, -30, -8, { y: -2.6, mat: 'pave', per: H });
  F('hdoor', -66, -63, -35.5, -32.5, { y: -2.6, mat: 'pave', per: H });
  F('house1', -80, -66, -41, -27, { y: -2.6, mat: 'pave', per: H });

  /* ---------- גופים בנויים ---------- */
  const solids = [];
  const S = (n1, n2, e1, e2, h, mat, per, y0, extra) => solids.push(Object.assign({ box: nb(n1, n2, e1, e2), h, mat, per, y0: y0 || 0 }, extra || {}));
  /* חדר שאפשר להיכנס אליו: קירות, פתח באחד מהם, תקרה, ומעליה (אם יש) קומה שנייה.
     מהלך הקירות ומידות החדר מן החפירה; גובה התקרה, הפתח המדויק והריהוט משוערים, לפי מבנים דומים מן התקופה. */
  function room(id, n1, n2, e1, e2, y, o) {
    const t = o.t || 0.6, hC = o.ceil || 3.3, d = o.door, per = o.per || H, mat = o.mat || 'plaster', y0 = y - 0.5, hW = hC + 0.5;
    const wall = (a1, a2, c1, c2) => { if (a2 - a1 > 0.05 && c2 - c1 > 0.05) S(a1, a2, c1, c2, hW, mat, per, y0); };
    const strip = side => side === 's' ? [n1, n1 + t, e1, e2] : side === 'n' ? [n2 - t, n2, e1, e2] : side === 'w' ? [n1, n2, e1, e1 + t] : [n1, n2, e2 - t, e2];
    for (const side of ['s', 'n', 'w', 'e']) {
      const b = strip(side);
      if (!d || d.side !== side) { wall(b[0], b[1], b[2], b[3]); continue; }
      if (side === 's' || side === 'n') { wall(b[0], b[1], b[2], d.a); wall(b[0], b[1], d.b, b[3]); S(b[0], b[1], d.a, d.b, hC - 2.25, mat, per, y + 2.25); F(id + 'door', b[0], b[1], d.a, d.b, { y, per, mat: 'pave' }); }
      else { wall(b[0], d.a, b[2], b[3]); wall(d.b, b[1], b[2], b[3]); S(d.a, d.b, b[2], b[3], hC - 2.25, mat, per, y + 2.25); F(id + 'door', d.a, d.b, b[2], b[3], { y, per, mat: 'pave' }); }
    }
    S(n1, n2, e1, e2, 0.3, 'roof', per, y + hC, { shed: true });                                   // התקרה
    if (o.top) S(n1, n2, e1, e2, o.top, mat, per, y + hC + 0.3, { roof: 'flat' });                 // הקומה שמעל
    F(id, n1 + t, n2 - t, e1 + t, e2 - t, { y, per, mat: 'pave', room: true });
  }
  const WALL = 7.5;                              // גובה משוער של חומות המתחם מעל הרחבה

  // ---- החומות ההלניסטיות: אבנים גדולות, בליטות ושקעים, שלוש שכבות טיח לבן ----
  S(0, 83.2, -2.9, 0, WALL, 'plaster', H, 0, { ribs: 'w' });                 // החומה המערבית, 83 מ'
  S(80.5, 83.2, 0, 42, WALL, 'plaster', H);                                  // החומה הצפונית, ממערב לשער
  S(82.5, 94, -3, 8.5, 12, 'plaster', H, 0, { roof: 'flat' });               // המגדל הצפון-מערבי
  S(83.2, 97, 42, 45.65, 8.5, 'plaster', H, 0, { roof: 'flat' });            // השער הצפוני: ארבעה תאים, פתח 3.7 מ'
  S(83.2, 97, 49.35, 53, 8.5, 'plaster', H, 0, { roof: 'flat' });
  S(88.2, 97, 45.65, 49.35, 3, 'plaster', H, 5.5);
  S(80.5, 83.2, 42, 45.65, WALL, 'plaster', H);
  S(88.2, 91.9, 53, 74, WALL, 'plaster', H);                                 // החומה הצפונית ממזרח לשער, בקטעים מדורגים
  S(84.5, 91.9, 74, 76.6, WALL, 'plaster', H);
  S(84.5, 87.2, 76.6, 86.5, WALL, 'plaster', H);
  S(82, 90.5, 84, 92, 11.5, 'plaster', H, 0, { roof: 'flat' });              // מגדל הפינה הצפון-מזרחית
  S(51.1, 84.5, 86.5, 89.1, WALL, 'plaster', H, 0, { ribs: 'e' });           // החומה המזרחית, מצפון לשער: 36.5 מ'
  S(46.35, 51.1, 82, 92, 9, 'plaster', H, 0, { roof: 'flat' });              // שער ארבעת התאים, 14.5 על 10.25 מ'
  S(36.9, 41.65, 82, 92, 9, 'plaster', H, 0, { roof: 'flat' });
  S(41.65, 46.35, 82, 92, 3.2, 'plaster', H, 5.8);
  S(22, 36.9, 93.2, 95.8, WALL, 'plaster', H, 0, { ribs: 'e' });             // החומה המזרחית, מדרום לשער: 42 מ'
  S(-9, 22, 93.2, 95.8, WALL + 5, 'plaster', H, -5, { ribs: 'e' });
  S(-9, 22, 84, 93.2, 4.6, 'plaster', H, 0, { roof: 'flat', house: true, shops: 'w' });   // שורת החדרים שלפנים החומה
  // ---- גרם המדרגות: קירות הצד, תאי המילוי והמגדל ----
  S(60.8, 63.5, 91.5, 123.5, 22, 'plaster', H, -19.6);                       // הקיר הצפוני, עובי 2.7 מ'
  S(53.9, 60.8, 96.9, 108, 20, 'plaster', H, -21.35);                        // תאי המילוי שמשני צדי המהלך העליון
  S(38.8, 45.5, 99.5, 108, 20, 'plaster', H, -21.35);
  S(51.9, 60.8, 89.1, 96.9, 4, 'plaster', H, -1.4);
  S(27.2, 38.8, 99, 109.4, 17, 'plaster', H, -5, { roof: 'flat' });          // המגדל שמדרום לגרם, 10 על 11 מ'
  S(35.3, 38, 109.4, 121, 9, 'plaster', H, -12.1);
  // ---- השער התחתון: שני תאים, 8.5 על 12.5 מ', כניסה של 3.8 מ' מצפון ----
  S(34.7, 36.9, 121, 131.3, 7, 'plaster', H, -15.5, { roof: 'flat' });
  S(34.7, 47.7, 129.5, 131.3, 7, 'plaster', H, -15.5, { roof: 'flat' });
  S(45.9, 47.7, 121, 125.1, 7, 'plaster', H, -15.5, { roof: 'flat' });
  S(45.9, 47.7, 128.9, 129.5, 7, 'plaster', H, -15.5);
  S(45.9, 47.7, 125.1, 128.9, 2.4, 'plaster', H, -10.9);
  S(43.4, 45.9, 121, 125, 7, 'plaster', H, -15.5);
  S(36.9, 39.4, 121, 125, 7, 'plaster', H, -15.5);
  // ---- החצרות שעל המדרון: הקיר האמצעי (42 מ') והחומה החיצונית (76.5 מ', עובי 2.4 מ') ----
  S(-12, 31, 109, 111.4, 8, 'plaster', H, -10, { ribs: 'e' });
  S(-33, 34.7, 127, 129.4, 9, 'plaster', H, -17, { ribs: 'e' });
  S(31, 35.3, 99.5, 127, 7, 'plaster', H, -10);
  S(-33, -31, 97, 129.4, 7, 'plaster', H, -12);
  S(-12, -6, 108, 113, 6, 'plaster', H, -10);
  S(-12, -6, 96.5, 98.5, 6, 'plaster', H, -8);
  S(-31, -9, 97, 98.5, 6, 'plaster', H, -8);
  S(22, 30.5, 97.2, 108.5, 0.25, 'roof', H, -2.2, { shed: true });            // סככות
  S(-5, 6, 113, 126.5, 0.25, 'roof', H, -7.2, { shed: true });
  // ---- רובע המגורים שליד הרחוב המזרחי ----
  S(63.5, 86, 104, 121.5, 5, 'plaster', H, -15.5, { roof: 'flat', house: true, shops: 'e' });
  S(52, 96, 131.5, 143, 5, 'plaster', H, -15.5, { roof: 'flat', house: true, shops: 'w' });
  S(86, 96, 108, 121.5, 5, 'plaster', H, -15.5, { roof: 'flat', house: true, shops: 'e' });
  // ---- המצודה הדרום-מזרחית: 24 על 25 מ', חצר 9.7 על 16 מ', חדר אירוח, תאים תת-קרקעיים ----
  S(-34, -30, 72, 97, 7, 'plaster', H, 0, { roof: 'flat' });
  room('citroom', -28.7, -10.4, 72, 78, 0, { t: 0.4, door: { side: 'e', a: -23.3, b: -21.7 }, top: 3.4 });   // חדר האירוח, 5.2 על 17.5 מ', נפתח אל החצר
  S(-30, -28.7, 72, 78, 7, 'plaster', H, 0, { roof: 'flat' }); S(-10.4, -9, 72, 78, 7, 'plaster', H, 0, { roof: 'flat' });
  S(-30, -9, 87.7, 97, 7, 'plaster', H, 0, { roof: 'flat' });                              // התאים שבמזרח
  S(-14, -9, 78, 80, 7, 'plaster', H, 0, { roof: 'flat' });
  S(-14, -9, 83, 87.7, 7, 'plaster', H, 0, { roof: 'flat' });
  S(-14, -9, 80, 83, 3.6, 'plaster', H, 3.4);
  S(-9, -3.5, 75, 80, 11, 'plaster', H, 0, { roof: 'flat' });                              // מגדל המשמר שבכניסה
  S(-37.5, -36, 60, 72, WALL, 'plaster', H);                                               // החומה הדרומית
  S(-48, -36, 60, 62, WALL, 'plaster', H);
  S(-50, -48, 32.5, 62, WALL, 'plaster', H, -2.6);
  // ---- המתחם המבוצר: 38 על 39 מ', קיר צפוני 3 מ', שאר הקירות 2.4 מ', חצר ריקה, פתח של 1.2 מ' ----
  S(-3, 0, -2.9, 33, 9, 'plaster', H, -1.2, { roof: 'flat' });
  S(-3, 0, 34.2, 37, 9, 'plaster', H, -1.2, { roof: 'flat' });
  S(-3, 0, 33, 34.2, 6.4, 'plaster', H, 2.6);
  S(-39, -3, -2.9, 0.4, 9, 'plaster', H, -2.6, { roof: 'flat', ribs: 'w' });
  S(-39, -3, 34.6, 37, 9, 'plaster', H, -1.2, { roof: 'flat' });
  S(-39, -36.6, 0.4, 34.6, 9, 'plaster', H, -2.6, { roof: 'flat' });
  S(-36.5, -13, 37, 51, 6, 'plaster', H, 0, { roof: 'flat', house: true, shops: 'n' });    // מבנה הציבור שממזרח למתחם המבוצר
  S(-48, -39, 17, 25.7, 13, 'plaster', H, -2.6, { roof: 'flat' });                         // מגדל הכניסה, 8.5 על 9 מ'
  S(-39, -36.6, 37, 51, 6, 'plaster', H, 0);
  // ---- העיר ----
  S(-36, -15, -40, -2.9, 7.6, 'plaster', H, -2.6, { roof: 'flat', house: true, shops: 's' });   // האחוזה: מגורי הפאר
  S(-55, -36, -40, -30, 7.6, 'plaster', H, -2.6, { roof: 'flat', house: true });
  S(-55, -36, -8, -2.9, 4.6, 'plaster', H, -2.6, { roof: 'flat', house: true, shops: 's' });    // מחסנים וחנויות
  S(-55, -53, -30, -20.2, 4.6, 'plaster', H, -2.6);
  S(-55, -53, -16.8, -8, 4.6, 'plaster', H, -2.6);
  S(-55, -53, -20.2, -16.8, 2.2, 'plaster', H, -0.2);
  S(-96, -63, -14, 20.5, 5.5, 'plaster', H, -2.6, { roof: 'flat', house: true, shops: 'n' });   // מבנה ציבור מדרום לרחוב
  S(-83, -57, 31.3, 32.5, 5, 'plaster', H, -2.6);                                                 // הקיר הארוך היורד מן הכניסה דרומה
  S(-66, -63, -48, -35.5, 4.6, 'plaster', H, -2.6, { roof: 'flat' });
  S(-66, -63, -32.5, -14, 4.6, 'plaster', H, -2.6, { roof: 'flat' });
  S(-66, -63, -35.5, -32.5, 2.3, 'plaster', H, -0.3);
  S(-96, -66, -48, -41, 4.6, 'plaster', H, -2.6, { roof: 'flat', house: true });
  S(-96, -66, -27, -14, 4.6, 'plaster', H, -2.6, { roof: 'flat', house: true });
  S(-96, -80, -41, -27, 7.4, 'plaster', H, -2.6, { roof: 'flat', house: true, shops: 'n' });
  S(-70, -40, -62, -48, 5, 'plaster', H, -2.6, { roof: 'flat', house: true, shops: 'e' });
  S(-51.5, -48, 32.5, 34, 5, 'plaster', H, -2.6);

  // ---- המתחם הפרסי: 96 על 98 מ' עם שעריו, אבני גוויל גדולות ----
  S(0, 84.8, -1.3, 0, 5.5, 'field', P);
  S(80.5, 81.8, 0, 44.5, 5.5, 'field', P);
  S(80.5, 81.8, 59.5, 64, 5.5, 'field', P);
  S(80.5, 81.8, 66, 86.3, 5.5, 'field', P);
  S(56.3, 81.8, 85, 86.3, 5.5, 'field', P);
  S(3, 39.4, 85, 86.3, 5.5, 'field', P);
  S(1.7, 3, 0, 40.5, 5.5, 'field', P);
  S(1.7, 3, 52.5, 86.3, 5.5, 'field', P);
  S(80.5, 96.5, 44.5, 48.75, 7, 'field', P, 0, { roof: 'flat' });            // השער הצפוני: שישה תאים, רוחב 15 מ', מעבר 6.5 מ'
  S(80.5, 96.5, 55.25, 59.5, 7, 'field', P, 0, { roof: 'flat' });
  S(84, 96.5, 48.75, 55.25, 2.4, 'field', P, 4.6);
  S(39.4, 56.3, 81, 99, 7, 'field', P, 0, { roof: 'flat' });                 // השער המזרחי (משוחזר; לא שרד)
  S(-10.5, 3, 40.5, 52.5, 7, 'field', P, 0, { roof: 'flat' });               // השער הדרומי (שרידים מועטים)
  S(89.2, 90.2, 59.7, 71.4, 3.2, 'field', P);                                // "בית הדשן": 11 על 12 מ', חצר 7 על 7 מ'
  S(81.8, 90.2, 70.5, 71.4, 3.2, 'field', P);
  S(81.8, 90.2, 59.7, 61, 3.2, 'field', P);
  S(0, 23.6, 0, 1, 0.1, 'field', P);
  S(3, 8, 0.3, 12.3, 3, 'field', P, 0, { roof: 'flat' });                    // לשכות הפינה הדרום-מערבית, 12 על 21.5 מ'
  S(20.6, 23.6, 0.3, 12.3, 3, 'field', P, 0, { roof: 'flat' });
  S(8, 20.6, 11.3, 12.3, 1.2, 'field', P);
  S(68, 80.5, 0.3, 10.5, 3, 'field', P, 0, { roof: 'flat' });                // חצר הפינה הצפון-מערבית

  // ---- שתים עשרה האבנים: 6.5 על 18 מ', אבני גוויל גדולות ----
  S(26.5, 45, 4, 10.5, 1.3, 'bigstone', null, 0, { block: true, id: 'stones12' });
  // ---- המזבח: מקומו לפי הצעת החופר; בנוי ומטויח, והכבש אליו ממזרח ----
  S(37.3, 44.3, 60.4, 67.4, 2.4, 'plaster', H, 0, { id: 'altar', block: true });
  solids.push({ box: nb(39.6, 42, 67.4, 73.4), rampTo: 2.4, dir: 'x', per: H });
  S(35.4, 48.4, 52.9, 62.4, 2.2, 'plaster', P, 0, { id: 'altar', block: true });
  solids.push({ box: nb(40, 43.8, 62.4, 68.4), rampTo: 2.2, dir: 'x', per: P });
  S(48.2, 49.8, 77.6, 79.2, 1, 'plaster', P, 0, { block: true });              // המזבח המטויח שנמצא ליד השער המזרחי

  // בניין המקדש והמתחם הפנימי, לפי הצעת החופר. לא נמצאו בחפירה, ומוצגים רק כשמבקשים
  const temple = {
    h: { box: nb(27, 46, 10.6, 51.5), h: 12.5, porch: nb(30, 43, 51.5, 56.5), inner: nb(11, 64, 1.5, 74), gap: [37.6, 46.2] },
    p: { box: nb(27, 46.5, 10.6, 40.3), h: 10.5, porch: nb(30, 43.5, 40.3, 44.3), inner: null }
  };

  /* ---------- פני השטח שמסביב ---------- */
  function terrain(x, z) {
    const n = -z, e = x;
    const eastSlope = e > 96 ? (e < 130 ? -(e - 96) * 0.47 : -16 - (e - 130) * 0.09) : 0;   // המדרון המזרחי התלול
    let y = 0;
    if (n > -45) y = eastSlope;
    if (n > 97) y = Math.min(y, -(n - 97) * 0.13);
    if (e < -4 && n > 2) y = Math.min(y, -(-4 - e) * 0.2);
    if (n < 0 && e < 34) y = -2.75;                                              // המדרגה שלרגלי הכניסה המערבית
    if (n < -45) {
      // מדרום למתחם: פני השטח לפי מודל הגבהים. במערב נשמרת המדרגה שעליה האחוזה והבתים, ורק מדרום לה יורדים אל המדרון
      const g = gy(n, e), mix = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
      y = mix(mix(-2.75, g, (-98 - n) / 25), mix(eastSlope, g, (-45 - n) / 5), (e - 24.5) / 9.5);
    }
    if (e < -62) y = Math.min(y, -2.75 - (-62 - e) * 0.12);
    return y;
  }

  /* ---------- אזורים: היכן אני עומד, ומה יש כאן ---------- */
  const Z = [];
  const zone = (id, place, where, name, text, per) => Z.push(Object.assign({ id, place, name, text, per }, where));
  zone('estreet', 'eaststairs', { floors: ['estreet'] },
    t('הרחוב אל השער התחתון', 'The street to the lower gate', 'الشارع المؤدي إلى البوابة السفلى'),
    t('רחוב מרוצף, ברוחב 8.6 עד 16 מ\', שבו הגיעו העולים מכיוון שכם. הוא מגיע אל השער התחתון מצפון, כך שהנכנס פונה בתוך השער ורק אז עולה במדרגות. לצדו עמד רובע מגורים.',
      'A paved street, 8.6 to 16 m wide, by which those coming from Shechem arrived. It reaches the lower gate from the north, so that one turns inside the gate and only then climbs the stairs. A residential quarter stood beside it.',
      'شارع مبلّط بعرض 8.6 إلى 16 م، كان يصل به القادمون من جهة شكيم. يبلغ البوابة السفلى من الشمال، فيستدير الداخل في البوابة ثم يصعد الدرج. وكان إلى جانبه حيّ سكني.'));
  zone('lgate', 'eaststairs', { floors: ['lgate', 'lgdoor', 'lgsteps'] },
    t('השער התחתון', 'The lower gate', 'البوابة السفلى'),
    t('בית שער בן שני תאים, 8.5 על 12.5 מ\', שכניסתו ברוחב 3.8 מ\'. דלת העץ הכפולה והכבדה שלו סבה על צירים בלוחיות ברונזה, וננעלה בבריחים; השקעים שלהם נמצאו בסף.',
      'A two-chambered gatehouse, 8.5 by 12.5 m, with an entrance 3.8 m wide. Its heavy double wooden door turned on pivots in bronze plates and was secured by bolts; their sockets were found in the threshold.',
      'بيت بوابة من حجرتين، 8.5 × 12.5 م، ومدخله بعرض 3.8 م. كان بابه الخشبي المزدوج الثقيل يدور على محاور في صفائح برونزية ويُغلق بمزاليج؛ وقد وُجدت تجاويفها في العتبة.'));
  zone('stairs', 'eaststairs', { floors: ['stairsLow', 'stairsUp'] },
    t('גרם המדרגות המונומנטלי', 'The monumental staircase', 'الدرج الضخم'),
    t('34 מ\' אורך והפרש גובה של 15.5 מ\'. נשתמרו 37 מדרגות, ובמקור היו כ-57. למטה רוחבו 23 מ\', ולמעלה הוא מצטמצם ל-8.4 מ\'. הוא בנוי על תאי אבן ממולאים, ומדרום לו מגדל של 10 על 11 מ\'. בתקופה ההלניסטית זו הייתה הכניסה הראשית של עולי הרגל.',
      '34 m long, climbing 15.5 m. Thirty-seven steps survive of about 57. It is 23 m wide at the bottom and narrows to 8.4 m at the top. It is built on filled stone compartments, with a tower of 10 by 11 m on its south. In the Hellenistic period this was the pilgrims\' main entrance.',
      'طوله 34 م وارتفاعه 15.5 م. بقيت منه 37 درجة من نحو 57. عرضه في الأسفل 23 م ويضيق في الأعلى إلى 8.4 م. بُني على حجرات حجرية مملوءة، وإلى جنوبه برج 10 × 11 م. وكان في الفترة الهلنستية المدخل الرئيس للحجّاج.'));
  zone('egate', 'eaststairs', { floors: ['egate', 'usteps', 'landing'] },
    t('שער ארבעת התאים', 'The four-chambered gate', 'بوابة الحجرات الأربع'),
    t('השער המזרחי, 14.5 על 10.25 מ\', שפתחו 4.7 מ\'. לפניו רחבה מרוצפת וכחמש מדרגות, ודלתות העץ שלו סבו על צירים. הוא הוצב בציר אחד עם מרכז המתחם.',
      'The eastern gate, 14.5 by 10.25 m, with an opening of 4.7 m. Before it lie a paved landing and about five steps, and its wooden doors turned on pivots. It was set on one axis with the centre of the precinct.',
      'البوابة الشرقية، 14.5 × 10.25 م، وفتحتها 4.7 م. أمامها ساحة مبلّطة ونحو خمس درجات، وكان باباها الخشبيان يدوران على محاور. وقد وُضعت على محور واحد مع وسط الحرم.'));
  zone('court1', 'courts', { floors: ['court1', 'court1ramp', 'courtStepsA'] },
    t('חצר עולי הרגל העליונה', 'The upper pilgrims\' courtyard', 'ساحة الحجّاج العليا'),
    t('החצרות שבין שלוש החומות שעל המדרון המזרחי נועדו לעולי הרגל, שהמתינו בהן לתורם להיכנס. הקיר שבינה ובין החצר התחתונה אורכו 42 מ\'. בעת מלחמה יכלו להתכנס בחצרות לוחמים רבים.',
      'The courtyards between the three walls on the eastern slope were meant for the pilgrims, who waited in them for their turn to enter. The wall between this and the lower courtyard is 42 m long. In wartime many fighters could gather in the courtyards.',
      'الساحات بين الأسوار الثلاثة على المنحدر الشرقي أُعدّت للحجّاج، ينتظرون فيها دورهم للدخول. وطول الجدار بينها وبين الساحة السفلى 42 م. وفي زمن الحرب كان يمكن أن يحتشد فيها مقاتلون كثيرون.'));
  zone('court2', 'courts', { floors: ['court2', 'courtSq', 'courtStepsB'] },
    t('חצר עולי הרגל התחתונה', 'The lower pilgrims\' courtyard', 'ساحة الحجّاج السفلى'),
    t('החצר החיצונית, ברוחב 16 מ\'. החומה שסוגרת עליה ממזרח אורכה 76.5 מ\' ועובייה 2.4 מ\', והיא בנויה בליטות ושקעים.',
      'The outer courtyard, 16 m wide. The wall closing it on the east is 76.5 m long and 2.4 m thick, built with offsets and insets.',
      'الساحة الخارجية، بعرض 16 م. والسور الذي يغلقها من الشرق طوله 76.5 م وسماكته 2.4 م، وهو مبنيّ ببروزات وتجاويف.'));
  zone('altar', 'precinct', { box: nb(31, 52, 54, 81) },
    t('רחבת המזבח', 'The altar court', 'ساحة المذبح'),
    t('החופר משחזר כאן את המזבח, ממזרח למרכז המתחם ובציר השער המזרחי; מקומו המדויק לא נמצא. מה שנמצא: מזבח אבן מטויח מן התקופה הפרסית מתחת לשער המזרחי, וסביבו אפר ועצמות, ובכל המתחם מאות אלפי עצמות של כבשים, עיזים, בקר ויונים.',
      'The excavator reconstructs the altar here, east of the centre of the precinct and on the axis of the eastern gate; its exact place was not found. What was found: a plastered stone altar of the Persian period beneath the eastern gate, with ash and bones around it, and throughout the precinct hundreds of thousands of bones of sheep, goats, cattle and pigeons.',
      'يعيد المنقّب بناء المذبح هنا، شرق وسط الحرم وعلى محور البوابة الشرقية؛ أما موضعه الدقيق فلم يُعثر عليه. وما وُجد: مذبح حجري مكسوّ بالجص من الفترة الفارسية تحت البوابة الشرقية، وحوله رماد وعظام، وفي أنحاء الحرم مئات آلاف العظام من غنم وماعز وبقر وحمام.'));
  zone('stones12', 'stones12', { box: nb(22, 50, 0, 18) },
    t('שתים עשרה האבנים', 'The Twelve Stones', 'الحجارة الاثنا عشر'),
    t('מבנה של אבני גוויל גדולות, 6.5 על 18 מ\', כשלושה עד חמישה מטרים מן החומה המערבית. לדעת החופר זהו הקיר המערבי של קודש הקודשים, השריד היחיד מבניין המקדש, שלא פורק בשל קדושתו. במסורת העדה אלה האבנים שהקים יהושע.',
      'A structure of large rough stones, 6.5 by 18 m, some three to five metres from the western wall. The excavator sees in it the western wall of the Holy of Holies, the only remnant of the temple building, left standing for its sanctity. In the community\'s tradition these are the stones set up by Joshua.',
      'بناء من حجارة غشيمة كبيرة، 6.5 × 18 م، على ثلاثة إلى خمسة أمتار من السور الغربي. يرى المنقّب أنه الجدار الغربي لقدس الأقداس والبقية الوحيدة من مبنى الهيكل، تُرك لقداسته. وفي تقليد الطائفة هي الحجارة التي أقامها يشوع.'));
  zone('centre', 'precinct', { box: nb(24, 50, 18, 54) },
    t('מרכז המתחם', 'The centre of the precinct', 'وسط الحرم'),
    t('לדעת החופר עמד כאן בניין המקדש, שציר האורך שלו ממזרח למערב ופתחו למזרח, מגזית לבנה. הבניין עצמו לא נמצא: בוני הכנסייה הביזנטית הרסו ופינו את המקום. בתוכניות החפירה הוא מצויר בקו מקווקו, כהשערה. חוקרים אחרים סבורים שהיה כאן מתחם מזבח פתוח, וכך גם מסורת העדה, שלפיה לא עמד בהר בניין מקדש.',
      'The excavator holds that the temple building stood here, its long axis east–west and its entrance to the east, of white ashlar. The building itself was not found: the builders of the Byzantine church destroyed and cleared the spot. On the excavation plans it is drawn in a dashed line, as conjecture. Other scholars think this was an open-air altar precinct, as does the community\'s tradition, by which no temple building stood on the mountain.',
      'يرى المنقّب أنّ مبنى الهيكل قام هنا، ومحوره الطولي من الشرق إلى الغرب ومدخله إلى الشرق، من الحجر المشذّب الأبيض. والمبنى نفسه لم يُعثر عليه: فبناة الكنيسة البيزنطية هدموا الموضع وأزالوا ما فيه. وهو مرسوم في مخططات التنقيب بخط متقطّع، افتراضًا. ويرى باحثون آخرون أنه كان حرم مذبح مكشوف، وكذلك تقليد الطائفة الذي يقول إنه لم يقم في الجبل مبنى هيكل.'));
  zone('ngate', 'precinct', { floors: ['ngate', 'nroad'], box: nb(68, 80.5, 36, 60) },
    t('השער הצפוני', 'The northern gate', 'البوابة الشمالية'),
    t('שער בן ארבעה תאים, 10 מ\' אורכו ופתחו 3.7 מ\'. משנבנה גרם המדרגות במזרח הוקטן השער הזה, ושימש רק את משרתי המקדש. הוא נבנה צפונית לשער הפרסי, שנשאר פתוח עד שהושלם החדש, כדי שהקורבנות לא ייפסקו בזמן הבנייה.',
      'A four-chambered gate, 10 m long with an opening of 3.7 m. Once the staircase was built on the east this gate was made smaller and served only the temple attendants. It was built north of the Persian gate, which stayed open until the new one was finished, so that the sacrifices would not cease during the building.',
      'بوابة من أربع حجرات، طولها 10 م وفتحتها 3.7 م. ولمّا بُني الدرج في الشرق صُغّرت هذه البوابة وصارت لخَدَمة الهيكل وحدهم. بُنيت شمال البوابة الفارسية، التي بقيت مفتوحة حتى اكتملت الجديدة، كي لا تنقطع القرابين في أثناء البناء.'), H);
  zone('ngateP', 'persian', { floors: ['ngateP', 'nroadP'], box: nb(66, 80.5, 38, 64) },
    t('השער הצפוני', 'The northern gate', 'البوابة الشمالية'),
    t('שער בן שישה תאים, רוחבו 15 מ\' ומעברו 6.5 מ\', הפונה אל הדרך הראשית העולה משכם. בתקופה הפרסית זו הייתה אחת משתי הכניסות הראשיות. קירותיו מטויחים טיח עבה מבחוץ, ורצפתו עפר כבוש וסיד.',
      'A six-chambered gate, 15 m wide with a passage of 6.5 m, facing the main road up from Shechem. In the Persian period this was one of the two main entrances. Its walls are thickly plastered on the outside, and its floor is beaten earth and lime.',
      'بوابة من ست حجرات، عرضها 15 م وممرّها 6.5 م، تواجه الطريق الرئيسة الصاعدة من شكيم. كانت في الفترة الفارسية أحد المدخلين الرئيسين. جدرانها مكسوّة بجص سميك من الخارج، وأرضها تراب مدكوك وجير.'), P);
  zone('ashes', 'persian', { floors: ['ashyard', 'ashdoor'], box: nb(72, 80.5, 58, 74) },
    t('בית הדשן', 'The house of ashes', 'بيت الرماد'),
    t('מבנה של 11 על 12 מ\' ליד השער הצפוני, ובו חצר של 7 על 7 מ\'. נמצאו בו שכבה עבה של אפר, פחם ועצמות קורבנות, בור מים במרכז, בריכה מטויחת בפינה ומזבח קטן בפתח אחד החדרים. החופר מציע שכאן שולם עבור הקורבנות, ומכאן הועברו אל המזבח.',
      'A building of 11 by 12 m beside the northern gate, with a courtyard of 7 by 7 m. In it were a thick layer of ash, charcoal and sacrificial bones, a cistern in the middle, a plastered pool in a corner and a small altar at the doorway of one of the rooms. The excavator suggests that payment for the sacrifices was made here, and from here they were taken to the altar.',
      'مبنى 11 × 12 م قرب البوابة الشمالية، فيه فناء 7 × 7 م. وُجدت فيه طبقة سميكة من الرماد والفحم وعظام القرابين، وبئر في الوسط، وبركة مكسوّة بالجص في زاوية، ومذبح صغير عند مدخل إحدى الغرف. ويقترح المنقّب أنّ ثمن القرابين كان يُدفع هنا، ومنه تُنقل إلى المذبح.'), P);
  zone('lishka', 'persian', { box: nb(0, 26, 0, 16) },
    t('לשכות הפינה', 'The corner chambers', 'غرف الزاوية'),
    t('בפינות המתחם הפרסי נמצאו לשכות, כמו במקדש שבירושלים. כאן, בפינה הדרום-מערבית, בניין של 12 על 21.5 מ\': חצר באמצע וחדר מכל צד. על רצפות העפר המסוידות נמצאו חרסים ומטבעות פרסיים ושרידי קורבנות.',
      'Chambers were found at the corners of the Persian precinct, as in the temple in Jerusalem. Here, at the south-western corner, is a building of 12 by 21.5 m: a courtyard in the middle and a room on either side. On the limed earth floors lay Persian sherds and coins and remains of sacrifices.',
      'وُجدت في زوايا الحرم الفارسي غرف، كما في هيكل القدس. وهنا، في الزاوية الجنوبية الغربية، مبنى 12 × 21.5 م: فناء في الوسط وغرفة على كل جانب. وعلى أرضيات التراب المجيَّرة وُجدت كسر فخار ونقود فارسية وبقايا قرابين.'), P);
  zone('citadel', 'secitadel', { floors: ['citdoor', 'cityard'], box: nb(-9, 0, 72, 84) },
    t('המצודה הדרום-מזרחית', 'The south-eastern citadel', 'القلعة الجنوبية الشرقية'),
    t('מצודה של 24 על 25 מ\', שתי קומות לפחות, סביב חצר של 9.7 על 16 מ\'. במערבה חדר אירוח של 5.2 על 17.5 מ\', שבפתחו דלת עץ כפולה ומעליה משקוף גזית מעוטר; במזרחה חמישה תאים תת-קרקעיים בעומק 4 מ\'. אין בה בור מים: המים הובאו בקנקנים. בכניסתה מגדל משמר בן שתי קומות.',
      'A citadel of 24 by 25 m, at least two storeys high, around a courtyard of 9.7 by 16 m. On its west is a reception room of 5.2 by 17.5 m, entered by a double wooden door under a decorated ashlar lintel; on its east are five underground cells 4 m deep. It has no cistern: water was brought in jars. A two-storey guard tower stands at its entrance.',
      'قلعة 24 × 25 م، من طابقين على الأقل، حول فناء 9.7 × 16 م. في غربها قاعة استقبال 5.2 × 17.5 م، يُدخل إليها من باب خشبي مزدوج يعلوه عتب حجري مزخرف؛ وفي شرقها خمس حجرات تحت الأرض بعمق 4 م. وليس فيها بئر: فالماء كان يُجلب في الجرار. وعند مدخلها برج حراسة من طابقين.'));
  zone('enclosure', 'westentrance', { floors: ['encdoor', 'encyard', 'encsteps'], box: nb(0, 8, 26, 40) },
    t('המתחם המבוצר', 'The fortified compound', 'المجمّع المحصّن'),
    t('מתחם של 38 על 39 מ\' בפינה הדרום-מערבית. קירו הצפוני בעובי 3 מ\' ושאר קירותיו 2.4 מ\', בנויים אבנים גדולות מאוד בבליטות ושקעים ומכוסים שלוש שכבות טיח. אין לו פתח רחב: אל חצר המקדש נכנסו ממנו רק בפתח צר של 1.2 מ\', כך שגם השומרים לא נכנסו בחופשיות. רצפתו נמוכה ממפלס הרחבה.',
      'A compound of 38 by 39 m at the south-western corner. Its northern wall is 3 m thick and the others 2.4 m, built of very large stones with offsets and insets and covered with three layers of plaster. It has no wide opening: the temple court was reached from it only by a narrow door of 1.2 m, so that even the guards did not enter freely. Its floor is lower than the court.',
      'مجمّع 38 × 39 م في الزاوية الجنوبية الغربية. جداره الشمالي بسماكة 3 م وسائر جدرانه 2.4 م، مبنيّة بحجارة كبيرة جدًا ببروزات وتجاويف ومكسوّة بثلاث طبقات من الجص. وليس له مدخل واسع: فلم يكن يُدخل منه إلى ساحة الهيكل إلا من باب ضيّق بعرض 1.2 م، حتى إنّ الحرّاس لم يكونوا يدخلون بحرّية. وأرضه أخفض من الساحة.'));
  zone('wentrance', 'westentrance', { floors: ['wstairs', 'wland', 'wland2', 'wfoot'] },
    t('הכניסה המערבית', 'The western entrance', 'المدخل الغربي'),
    t('כשהמתחם הורחב דרומה הועברה הכניסה מן הדרום למערב. גרם מדרגות ברוחב 9 מ\', שנשתמרו ממנו שבע מדרגות מסותתות ומטויחות, עולה ממערב למזרח אל רחבה מרוצפת של 9 על 12 מ\'. אין כאן שער תאים אלא פתח מונומנטלי, שהוצר מאוחר יותר, אולי בזמן המצור. מגדל של 8.5 על 9 מ\' צופה על הנכנסים.',
      'When the precinct was extended southwards the entrance was moved from the south to the west. A staircase 9 m wide, of which seven dressed and plastered steps survive, climbs from west to east to a paved landing of 9 by 12 m. There is no chambered gate here but a monumental opening, later narrowed, perhaps during the siege. A tower of 8.5 by 9 m overlooks those who enter.',
      'لمّا وُسّع الحرم جنوبًا نُقل المدخل من الجنوب إلى الغرب. درج بعرض 9 م، بقيت منه سبع درجات مشذّبة ومكسوّة بالجص، يصعد من الغرب إلى الشرق إلى ساحة مبلّطة 9 × 12 م. وليست هنا بوابة حجرات بل فتحة ضخمة ضُيّقت لاحقًا، ربما في أثناء الحصار. ويشرف على الداخلين برج 8.5 × 9 م.'));
  zone('pressyard', 'areaP', { floors: ['pressyard', 'pdoor'] },
    t('האחוזה ובית הבד', 'The mansion and the oil press', 'القصر ومعصرة الزيت'),
    t('בית אחוזה של כ-40 על 40 מ\' צמוד לחומת המתחם. בחצרו המרוצפת בית בד: מתקן הריסוק, קורות הכבישה והמשקולות נמצאו במקומם. לידו מחסנים וחנויות, ומגורי פאר שבחדר האירוח שלהם פרסקאות צבעוניים.',
      'A mansion of about 40 by 40 m abutting the precinct wall. Its paved courtyard holds an oil press: the crushing installation, the press beams and the weights were found in place. Beside it are storerooms and shops, and a luxurious residence whose reception room has coloured frescoes.',
      'قصر نحو 40 × 40 م ملاصق لسور الحرم. في فنائه المبلّط معصرة زيت: وُجدت منشأة الهرس وعوارض العصر والأثقال في مواضعها. وبجانبها مخازن ودكاكين، ومسكن فاخر في قاعة استقباله رسوم جدارية ملوّنة.'));
  zone('street', 'city', { floors: ['street'] },
    t('רחוב בעיר', 'A street in the city', 'شارع في المدينة'),
    t('העיר שסביב המתחם השתרעה על כ-400 דונם. לא הייתה לה חומה של ממש: הקירות החיצוניים של הבתים הצמודים שימשו לה חומה. פתחי הבתים אינם פונים זה אל זה, לשמירת הפרטיות. בכל הבתים נמצאה שכבת שרפה עבה, עדות לחורבן העיר באש.',
      'The city around the precinct covered some 40 hectares. It had no true city wall: the outer walls of the adjoining houses served as one. House doorways do not face each other, to keep privacy. A thick burnt layer was found in every house, witness to the city\'s destruction by fire.',
      'امتدت المدينة حول الحرم على نحو 400 دونم. لم يكن لها سور حقيقي: فالجدران الخارجية للبيوت المتلاصقة قامت مقامه. ومداخل البيوت لا يقابل بعضها بعضًا، حفظًا للخصوصية. ووُجدت في كل البيوت طبقة حريق سميكة، شاهدًا على خراب المدينة بالنار.'));
  zone('house', 'areaA', { floors: ['house1', 'hdoor'] },
    t('בית מגורים', 'A dwelling', 'بيت سكني'),
    t('הבתים בנויים סביב חצר מרוצפת ובה פי בור. בבית הגדול שברובע המערבי חדרי אירוח, חדרי רחצה עם אמבטיות, וחדרי שינה קטנים, בגלל הקור העז שבהר. הקומה השנייה נשענה על קורות עץ שהונחו על זיזי אבן, ועלו אליה בגרם אבן פתוח שבחצר. נמצאו בהם קנקני אגירה, סירי בישול, ריחיים, משקולות נול וכלי זכוכית.',
      'The houses are built around a paved courtyard with a cistern mouth. The large house in the western quarter has reception rooms, bathrooms with tubs, and small bedrooms, because of the bitter cold on the mountain. The upper storey rested on wooden beams laid on stone corbels and was reached by an open stone stair in the courtyard. Storage jars, cooking pots, millstones, loom weights and glass vessels were found in them.',
      'البيوت مبنيّة حول فناء مبلّط فيه فوهة بئر. وفي البيت الكبير بالحيّ الغربي قاعات استقبال، وحمّامات فيها أحواض، وغرف نوم صغيرة بسبب البرد الشديد في الجبل. وكان الطابق العلوي يستند إلى عوارض خشبية موضوعة على كوابيل حجرية، ويُصعد إليه بدرج حجري مكشوف في الفناء. ووُجدت فيها جرار تخزين وقدور طبخ وأرحاء وأثقال نول وأوانٍ زجاجية.'));
  zone('plaza', 'precinct', { floors: ['plaza', 'plazaN', 'plazaN2', 'plazaE', 'plazaS', 'plazaS2', 'plazaS3', 'plazaP'] },
    t('רחבת המתחם המקודש', 'The court of the sacred precinct', 'ساحة الحرم المقدّس'),
    t('המתחם נבנה על משטח סלע גדול ושטוח בראש ההר, שאפשר להקים אותו כמעט בלי חציבה. הוא שירת את כל העם: בשלוש הרגלים התקהלו בו אלפים, ובכתובות ההקדשה שהשאירו חוזרת הנוסחה "לפני האל במקום הזה". שמונה בורות מים נמצאו בו.',
      'The precinct was built on a large flat rock surface at the top of the mountain, which allowed it to be laid out almost without quarrying. It served the whole people: thousands gathered in it at the three pilgrimage festivals, and the dedications they left repeat the formula "before God in this place". Eight cisterns were found in it.',
      'بُني الحرم على سطح صخري كبير مستوٍ في رأس الجبل، ممّا أتاح إقامته بلا نحت تقريبًا. وكان يخدم الشعب كله: كان يحتشد فيه الآلاف في أعياد الحجّ الثلاثة، وتتكرر في نقوش إهدائهم الصيغة «أمام الله في هذا المكان». ووُجدت فيه ثماني آبار.'));

  /* ---------- החיים שמסביב ---------- */
  const people = [], animals = [], props = [];
  const put = (kind, n, e, o) => people.push(Object.assign({ kind, x: e, z: -n }, o || {}));
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const scatter = (count, n1, n2, e1, e2, kinds, o) => { for (let i = 0; i < count; i++) put(kinds[Math.floor(rnd() * kinds.length)], n1 + rnd() * (n2 - n1), e1 + rnd() * (e2 - e1), Object.assign({ seed: Math.floor(rnd() * 1e6) }, o || {})); };
  const an = (kind, n, e, per) => animals.push({ kind, x: e, z: -n, per });
  const pr = (kind, n, e, per, o) => props.push(Object.assign({ kind, x: e, z: -n, per }, o || {}));

  // כוהנים ולוויים ליד המזבח
  put('priest', 39, 58.5, { seed: 1, per: H }); put('priest', 42.8, 58.8, { carry: 'bowl', seed: 2, per: H }); put('priest', 40.6, 75, { seed: 3, per: H });
  put('priest', 44.8, 71, { carry: 'lamb', seed: 4, per: H }); put('levite', 35.2, 70, { carry: 'staff', seed: 5, per: H }); put('levite', 46.5, 63, { seed: 6, per: H }); put('levite', 34.6, 62, { carry: 'horn', seed: 7, per: H });
  put('priest', 41, 50.5, { seed: 8, per: P }); put('priest', 44, 65, { carry: 'bowl', seed: 9, per: P }); put('priest', 38, 66, { carry: 'lamb', seed: 10, per: P }); put('levite', 46, 78.5, { seed: 11, per: P }); put('levite', 33, 60, { carry: 'staff', seed: 12, per: P });
  // עולי רגל ברחבה, בקבוצות
  scatter(18, 34, 54, 70, 81, ['man', 'woman', 'man', 'elder', 'child'], { per: H });
  scatter(10, 6, 30, 44, 82, ['man', 'woman', 'child', 'elder'], {});
  scatter(9, 56, 78, 14, 80, ['man', 'woman', 'elder'], {});
  scatter(6, -32, -4, 53, 70, ['man', 'woman', 'child', 'elder'], { per: H });
  scatter(8, 30, 60, 62, 82, ['man', 'woman', 'elder', 'child'], { per: P });
  put('man', 47.5, 74, { carry: 'lamb', seed: 13, per: H }); put('man', 36, 76.5, { carry: 'doves', seed: 14, per: H }); put('woman', 49, 77, { carry: 'basket', seed: 15, per: H });
  put('elder', 47.5, 13.5, { carry: 'staff', seed: 16 }); put('man', 24.5, 13, { seed: 17 }); put('woman', 31, 14.2, { seed: 18 }); put('child', 32.2, 14.8, { seed: 19 });
  // שומרים בשערים ובפתחים
  put('guard', 40.3, 80.6, { carry: 'spear', seed: 21, per: H }); put('guard', 47.7, 80.6, { carry: 'spear', seed: 22, per: H });
  put('guard', 49.5, 124.2, { carry: 'spear', seed: 23, per: H }); put('guard', 49.5, 130, { carry: 'spear', seed: 24, per: H });
  put('guard', 79, 44.2, { carry: 'spear', seed: 25, per: H }); put('guard', 79, 50.8, { carry: 'spear', seed: 26, per: H });
  put('guard', 79, 47.2, { carry: 'spear', seed: 25, per: P }); put('guard', 79, 56.8, { carry: 'spear', seed: 26, per: P });
  put('guard', 1.6, 31.6, { carry: 'spear', seed: 27, per: H }); put('guard', -41, 40.6, { carry: 'spear', seed: 28, per: H }); put('guard', -7.5, 81.5, { carry: 'spear', seed: 29, per: H });
  put('guard', -20, 12, { carry: 'spear', seed: 30, per: H }); put('guard', -22, 24, { carry: 'spear', seed: 31, per: H }); put('guard', -30, 18, { seed: 32, per: H });
  // העולים במדרגות
  for (let i = 0; i < 18; i++) put(['man', 'woman', 'man', 'child', 'elder'][i % 5], 40 + rnd() * 19, 109 + rnd() * 11, { per: H, seed: 100 + i, carry: ['none', 'lamb', 'basket', 'none', 'staff', 'doves', 'jar', 'none'][i % 8] });
  for (let i = 0; i < 6; i++) put(['man', 'woman', 'elder'][i % 3], 46.5 + rnd() * 6, 100 + rnd() * 7.5, { per: H, seed: 130 + i, carry: ['none', 'lamb', 'basket'][i % 3] });
  scatter(5, 37.5, 51, 97.2, 99.2, ['man', 'woman', 'elder'], { per: H });
  // הרחוב אל השער התחתון: סוחרים, חמורים, מוכרי יונים
  scatter(15, 50, 94, 122.5, 130.5, ['man', 'woman', 'merchant', 'child', 'elder'], { per: H });
  put('merchant', 60, 122.6, { carry: 'doves', seed: 41, per: H }); put('merchant', 72, 130.6, { carry: 'jar', seed: 42, per: H }); put('merchant', 84, 122.6, { carry: 'sack', seed: 43, per: H });
  // חצרות עולי הרגל: משפחות, בישול, מנוחה
  scatter(13, -4, 29, 97.5, 108, ['man', 'woman', 'child', 'elder', 'woman'], { per: H });
  scatter(13, -4, 32, 113, 126, ['man', 'woman', 'child', 'elder'], { per: H });
  scatter(6, -29, -14, 100, 125, ['man', 'woman', 'child'], { per: H });
  // העיר
  scatter(12, -62, -57, -46, 30, ['man', 'woman', 'merchant', 'child', 'elder'], { per: H });
  put('man', -44, -19, { carry: 'sack', seed: 51, per: H }); put('man', -47.5, -23, { seed: 52, per: H }); put('man', -40, -12, { carry: 'jar', seed: 53, per: H });
  put('woman', -72, -31, { carry: 'jar', seed: 54, per: H }); put('woman', -75.5, -37.5, { seed: 55, per: H }); put('child', -70, -29, { seed: 56, per: H });
  put('man', -44, 29, { seed: 57, per: H }); put('woman', -45.5, 30.4, { carry: 'basket', seed: 58, per: H });
  // בית הדשן, בתקופה הפרסית
  put('levite', 86, 63.5, { carry: 'sack', seed: 61, per: P }); put('man', 85, 67.5, { carry: 'lamb', seed: 62, per: P }); put('priest', 87.6, 66, { seed: 63, per: P });

  an('sheep', 45.6, 72.2, H); an('sheep', 48.8, 74.6, H); an('goat', 49.6, 75.8, H); an('sheep', 46.6, 76.6, H); an('ox', 30, 74, H);
  an('sheep', 39, 67.5, P); an('goat', 86.5, 68.6, P); an('sheep', 84.2, 68.2, P); an('ox', 60, 70, P);
  an('sheep', 50, 114, H); an('goat', 44, 118, H); an('sheep', 58, 127.5, H); an('sheep', 59.2, 128.6, H); an('goat', 61, 126.4, H);
  an('donkey', 68, 124, H); an('donkey', 90, 129, H); an('donkey', -59.5, -8, H); an('sheep', 10, 100, H); an('goat', 11.4, 101, H); an('sheep', 14, 120, H);
  an('sheep', 20, 30, null); an('goat', -60.5, 12, H);

  // בורות המים שנמצאו במתחם, לפי מקומם בתוכנית
  [[84.2, 63.1], [60.6, 84], [52.7, 51.4], [68.8, 38.2], [58, 22], [14.6, 40.4], [20.9, 75]].forEach(c => pr('cistern', c[0], c[1], H));
  pr('cistern', 85.9, 65.6, P); pr('basin', 83.6, 62.4, P); pr('ash', 86.8, 68.2, P, { small: true }); pr('ash', 51.2, 79.4, P, { small: true });
  pr('ash', 46.5, 58.5, H); pr('post', 46, 72.6, H); pr('post', 48.4, 73.8, H); pr('basin', 33, 66, H); pr('ash', 44, 50, P);
  pr('stall', 60, 122.3, H, { face: 0 }); pr('stall', 72, 130.8, H, { face: Math.PI }); pr('stall', 84, 122.3, H, { face: 0 });
  pr('cage', 61.5, 123, H); pr('jars', 73.5, 130.4, H); pr('jars', 82.4, 122.6, H);
  pr('fire', 10, 99, H); pr('fire', 20, 119, H); pr('fire', -22, 104, H); pr('jars', 26, 98, H); pr('jars', 28, 125.5, H); pr('cistern', -2, 102, H);
  pr('press', -44.5, -17, H); pr('jars', -38.5, -11, H); pr('jars', -50, -27, H); pr('jars', -38, -27.5, H);
  pr('oven', -77, -38.5, H); pr('jars', -68, -39.5, H); pr('loom', -78.5, -30, H); pr('cistern', -72.5, -34.5, H);
  pr('stall', -57, 6, H, { face: Math.PI }); pr('stall', -62, -28, H, { face: 0 }); pr('jars', -61.6, -26, H); pr('basket', -57.6, 7.5, H);
  pr('jars', -22, 82, H); pr('jars', -26, 86, H); pr('oven', -28, 80, H);

  // המרה אל המפה: מטרים מזרחה וצפונה ממרכז הכנסייה המתומנת
  const toEN = (x, z) => { const n = -z, e = x; return [(n - 41) * 0.259 + (e - 56) * 0.966, (n - 41) * 0.966 - (e - 56) * 0.259]; };


  /* ================= העיר שמחוץ לשערי המתחם =================
     המיקומים נמדדו על תוכניות החפירה. הדרכים שבין הרבעים לא נחפרו: הן משוערות, וכך הן מוצגות. */
  /* ---- פני השטח: מודל הגבהים (walk_dem.js), מעוגן כך שרגלי הכניסה המערבית נשארים במפלס −2.6 ----
     הדיוק של המודל הוא מטרים אחדים, והוא מתאר את פני השטח כיום. הכיוון הכללי של המדרון נכון; הפרטים מקורבים. */
  const DEM = window.GERIZIM_DEM || null;
  function demAt(n, e) {
    const r = Math.max(0, Math.min(DEM.rows - 1.001, (n - DEM.n0) / DEM.step)), c = Math.max(0, Math.min(DEM.cols - 1.001, (e - DEM.e0) / DEM.step));
    const i = Math.floor(r), j = Math.floor(c), a = r - i, b = c - j, v = DEM.v;
    return v[i][j] * (1 - a) * (1 - b) + v[i + 1][j] * a * (1 - b) + v[i][j + 1] * (1 - a) * b + v[i + 1][j + 1] * a * b;
  }
  const OFF = DEM ? -2.6 - demAt(-45, 29) : 0;
  const gy = (n, e) => DEM ? demAt(n, e) + OFF : -2.6;
  const r1 = v => Math.round(v * 10) / 10;
  const G = (n, e) => r1(gy(n, e));

  // חתך לאורך דרך: גובה פני השטח בנקודות, מתוקן קווית כך ששני הקצוות יושבים במפלסים הנתונים
  function prof(axis, c, pts, ya, yb) {
    const g = v => axis === 'n' ? gy(v, c) : gy(c, v), last = pts.length - 1, k0 = ya - g(pts[0]), k1 = yb - g(pts[last]);
    return pts.map((v, i) => [v, i === 0 ? ya : i === last ? yb : r1(g(v) + k0 + (k1 - k0) * (v - pts[0]) / (pts[last] - pts[0]))]);
  }
  const levelAt = (nodes, v) => { for (let i = 0; i + 1 < nodes.length; i++) { const a = nodes[i], b = nodes[i + 1]; if ((v - a[0]) * (v - b[0]) <= 0) return r1(a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0])); } return nodes[nodes.length - 1][1]; };
  /* דרך או רחוב כרצף קטעים בין נקודות [מקום לאורך הציר, גובה].
     axis 'n': הרצועה בין e=lo ל-e=hi, והנקודות מצפון לדרום; axis 'e': הרצועה בין n=lo ל-n=hi, והנקודות ממערב למזרח.
     קטע ששיפועו גדול מ-13% נבנה כרחוב מדורג, במדרגות של כ-19 ס"מ. */
  function way(id, axis, lo, hi, nodes, o) {
    const ids = [];
    for (let i = 0; i + 1 < nodes.length; i++) {
      const a = nodes[i][0], ya = nodes[i][1], b = nodes[i + 1][0], yb = nodes[i + 1][1], fid = i ? id + '_' + (i + 1) : id;
      const opt = Object.assign({ per: H, city: true }, o || {}), dy = Math.abs(yb - ya);
      if (dy < 0.03) opt.y = ya;
      else { opt.ramp = R(axis, a, ya, b, yb); if (dy / Math.abs(b - a) > 0.13) opt.steps = Math.max(2, Math.round(dy / 0.19)); }
      if (axis === 'n') F(fid, b, a, lo, hi, opt); else F(fid, lo, hi, a, b, opt);
      ids.push(fid);
    }
    return ids;
  }
  const flat = (id, n1, n2, e1, e2, y, o) => { F(id, n1, n2, e1, e2, Object.assign({ y, per: H, city: true }, o || {})); return [id]; };
  const PAVE = { mat: 'pave' }, ID = {};

  // ---- הדרך המשוערת מן הכניסה המערבית דרומה, וההסתעפות אל גבעת עולם ----
  const Y1 = G(-166, 22.5), Y2 = G(-167.5, -16.5), Y3 = G(-209.5, -16.5), Y4 = G(-209.5, 84);
  ID.road = [].concat(
    way('road1', 'n', 20.5, 24.5, prof('n', 22.5, [-63, -78, -92, -107, -122, -137, -151, -166], -2.6, Y1)),
    flat('road1b', -169, -166, 20.5, 24.5, Y1),
    way('road1w', 'e', -169, -166, prof('e', -167.5, [-14.5, -3, 9, 20.5], Y2, Y1)),
    flat('road1x', -169, -166, -18.5, -14.5, Y2),
    way('road1c', 'n', -18.5, -14.5, prof('n', -16.5, [-169, -183, -197, -208], Y2, Y3)));
  const YE = G(-79, 86);                                   // משטח הסלע של גבעת עולם
  ID.road = ID.road.concat(
    way('eroad', 'e', -56, -51.5, prof('e', -54, [32.5, 44, 55, 66, 73], -2.6, YE)),
    flat('eroadE', -56, -51.5, 73, 77, YE),
    flat('eroad2', -66, -56, 73, 77, YE));
  flat('eternal', -92, -66, 73, 99, YE, { mat: 'rock' });
  // ---- הרובע המערבי (שטח A): הרחוב שמדרום לבתים, העולה מזרחה, והבית A-I שנכנסים אל חצרו ----
  const aNodes = prof('e', -209.5, [-14.5, -5, 8, 21, 34, 47, 60, 73, 82], Y3, Y4), YA = levelAt(aNodes, 23.75);
  ID.astreet = [].concat(
    flat('astreetW', -211, -208, -18.5, -14.5, Y3, PAVE),
    way('astreet', 'e', -211, -208, aNodes, PAVE),
    flat('astreetE', -211, -208, 82, 86, Y4, PAVE));
  flat('aleg1', -208, -200, 23, 24.5, YA, PAVE);
  flat('aleg2', -200, -198.5, 17.5, 24.5, YA, PAVE);
  flat('aleg3', -198.5, -194, 17.5, 19, YA, PAVE);
  flat('ayard', -194, -185.2, 12, 19.4, YA, PAVE);
  // ---- הדרך המשוערת אל הרובע הדרומי: יורדת במדרון כרחוב מדורג ----
  const Y5 = G(-330, 84), YM = r1(gy(-330, 55) + 0.9);     // מפלס השוק: רחבה מפולסת, חצובה מעט במדרון
  ID.road = ID.road.concat(
    way('road2', 'n', 82, 86, prof('n', 84, [-211, -226, -241, -256, -270, -285, -300, -315, -326], Y4, Y5)),
    flat('road2b', -330, -326, 82, 86, Y5),
    way('road2c', 'e', -330, -326, [[70, YM], [82, Y5]]));
  // ---- הרובע הדרומי (שטח B): השוק, הרחוב בן 75 המטרים העולה משער העיר, והשער ----
  const YG = G(-414.25, 49), bNodes = prof('n', 49, [-339, -351, -363, -374, -386, -398, -410], YM, YG), YB = levelAt(bNodes, -349);
  flat('market', -339, -321, 40, 70, YM, PAVE);
  ID.bstreet = way('bstreet', 'n', 46, 52, bNodes, PAVE);
  ID.sgate = flat('sgate', -418.5, -410, 46.9, 51.1, YG, PAVE).concat(
    way('sroad', 'n', 46.9, 51.1, prof('n', 49, [-418.5, -427, -436, -445], YG, G(-445, 49))));
  ID.b2 = way('b2door', 'e', -350.5, -347.5, [[52, YB], [55, r1(YB - 0.6)]], PAVE).concat(     // שלוש מדרגות יורדות אל החצר
    flat('b2yard', -356, -343, 55, 64.5, r1(YB - 0.6), PAVE));

  /* בית או קיר על המדרון: מחולק לטרסות לאורך הכיוון שבו הקרקע משתנה, וכל חלק יושב על מפלס הרחוב שלפניו */
  const fY = (f, x, z) => { if (!f.ramp) return f.y; const q = f.ramp, v = q.axis === 'x' ? x : z, k = Math.max(0, Math.min(1, (v - q.a) / (q.b - q.a))); return q.ya + (q.yb - q.ya) * k; };
  function ground(n, e) {                                  // מפלס הרחוב אם יש רחוב בנקודה או עד מטר ממנה, ואם לא — פני השטח
    const x = e, z = -n; let best = null;
    for (const f of floors) {
      if (!f.city) continue; const b = f.box;
      if (x < b[0] - 1 || x > b[2] + 1 || z < b[1] - 1 || z > b[3] + 1) continue;
      const y = fY(f, Math.max(b[0], Math.min(b[2], x)), Math.max(b[1], Math.min(b[3], z)));
      if (best == null || y < best) best = y;
    }
    return best == null ? gy(n, e) : best;
  }
  function built(n1, n2, e1, e2, h, o, mat) {
    o = o || {};
    const dN = Math.abs(gy(n2, (e1 + e2) / 2) - gy(n1, (e1 + e2) / 2)), dE = Math.abs(gy((n1 + n2) / 2, e2) - gy((n1 + n2) / 2, e1));
    const alongN = dN >= dE, len = alongN ? n2 - n1 : e2 - e1;
    const k = o.level != null ? 1 : Math.max(1, Math.min(Math.floor(len / 5), Math.ceil(Math.max(dN, dE) / 1.6)));
    for (let i = 0; i < k; i++) {
      const a1 = alongN ? n1 + len * i / k : n1, a2 = alongN ? n1 + len * (i + 1) / k : n2;
      const c1 = alongN ? e1 : e1 + len * i / k, c2 = alongN ? e2 : e1 + len * (i + 1) / k, mn = (a1 + a2) / 2, me = (c1 + c2) / 2;
      const dys = { s: r1(ground(a1 - 0.8, me)), n: r1(ground(a2 + 0.8, me)), w: r1(ground(mn, c1 - 0.8)), e: r1(ground(mn, c2 + 0.8)) };
      const lvl = o.level != null ? o.level : o.shops ? dys[o.shops] : mat ? gy(mn, me) : Math.max(dys.s, dys.n);
      if (o.level != null) dys.s = dys.n = dys.w = dys.e = o.level;
      const y0 = r1(Math.min(gy(a1, c1), gy(a1, c2), gy(a2, c1), gy(a2, c2), dys.s, dys.n, dys.w, dys.e, lvl) - 2);
      S(a1, a2, c1, c2, r1(lvl + h - y0), mat || 'plaster', H, y0, Object.assign(mat ? {} : { roof: 'flat', house: true, dys }, o));
    }
  }
  const SC = (n1, n2, e1, e2, h, o) => built(n1, n2, e1, e2, h, o);
  const SG = (n1, n2, e1, e2, h, mat, o) => built(n1, n2, e1, e2, h, o, mat);

  SC(-123, -83, 32.5, 62, 6.5, { shops: 'w' });                               // מבנה הציבור J, כ-30 על 40 מ'
  room('abath', -192, -187.5, 7.2, 12, YA, { door: { side: 'e', a: -190.65, b: -189.05 }, top: 3.4 });               // A-I: חדר רחצה באגף המערבי
  SC(-208, -192, 5.7, 12, 7.2, { level: YA }); SC(-187.5, -170, 5.7, 12, 7.2, { level: YA }); SC(-192, -187.5, 5.7, 7.2, 7.2, { level: YA });   // שאר האגף המערבי, שתי קומות
  room('aroom', -185.2, -178.7, 12, 24.4, YA, { door: { side: 's', a: 14.7, b: 16.2 }, top: 3.4 });          // חדר האירוח הגדול, 5.3 על 11.2 מ'
  SC(-178.7, -170, 12, 28.7, 7.2, { level: YA }); SC(-185.2, -178.7, 24.4, 28.7, 7.2, { level: YA });
  SC(-194, -185.2, 19.4, 28.7, 4.6);
  SC(-208, -194, 12, 17.5, 4.6, { shops: 's' });
  SC(-208, -200, 17.5, 23, 4.6);
  SC(-208, -198.5, 24.5, 28.7, 4.6, { shops: 's' });
  SC(-198.5, -194, 19, 28.7, 4.6);
  SC(-206, -186, -14.3, 5.7, 4.8, { shops: 's' });                            // A-II
  SC(-208, -173, 28.7, 47.7, 7, { shops: 's' });                              // A-III
  SC(-176, -161, 33.7, 52.7, 4.8);                                            // A-X
  SC(-204, -187, 47.7, 63.7, 5, { shops: 's' });                              // A-VII
  SC(-189, -180, 57.7, 63.7, 4.6);                                            // A-IX
  SC(-203, -186, 63.7, 78.7, 5, { shops: 's' });                              // A-VIII
  SC(-223, -211, 32.7, 47.7, 4.8, { shops: 'n' });                            // A-IV
  SC(-224, -211, 47.7, 63.7, 4.8, { shops: 'n' });                            // A-V
  SC(-222, -211, 63.7, 78.7, 4.8, { shops: 'n' });                            // A-VI
  SG(-223, -211, 16.7, 18, 2.2, 'field'); SG(-223, -221.7, 16.7, 32.7, 2.2, 'field');   // השטח המגודר
  SG(-230, -221, 99.7, 106.7, 9, 'plaster', { roof: 'flat' });                // המגדל L-209
  SG(-225, -223.4, -20, 81.2, 3.2, 'field'); SG(-225, -223.4, 86.8, 99.7, 3.2, 'field');   // (with the opening the way south passes through)                                  // קיר ההגנה הדרומי, "מעין קיר סוגרים"
  S(-418.5, -410, 45.25, 46.9, 8.5, 'field', H, YG - 2, { roof: 'flat' });    // תא השער: 7.5 על 8.5 מ', פתח חיצוני 2.7 מ'
  S(-418.5, -410, 51.1, 52.75, 8.5, 'field', H, YG - 2, { roof: 'flat' });
  S(-418.5, -417, 46.9, 47.65, 8.5, 'field', H, YG - 2); S(-418.5, -417, 50.35, 51.1, 8.5, 'field', H, YG - 2);
  S(-418.5, -410, 46.9, 51.1, 2.4, 'field', H, YG + 4.1);
  SC(-415.7, -396.2, 29, 46, 4.6, { shops: 'e' });                            // B-III, 16.5 על 19.3 מ'
  SC(-418.6, -397, 52, 69.5, 4.6, { shops: 'w' });                            // B-IV, 17 על 21 מ'
  SC(-396.2, -339, 31, 46, 4.8, { shops: 'e' });                              // בתים לאורך הרחוב, מדורגים עם המדרון
  SC(-397, -361, 52, 67, 4.8, { shops: 'w' });
  SC(-361, -356, 52, 70, 5.2, { level: YB });                                 // B-II: בית עם חצר וסטיו של שני עמודים
  SC(-343, -339.5, 52, 70, 5.2, { level: YB });
  SC(-356, -350.5, 52, 55, 5.2, { level: YB }); SC(-347.5, -343, 52, 55, 5.2, { level: YB });
  S(-350.5, -347.5, 52, 55, 2.6, 'plaster', H, YB + 2.6);
  room('b2hall', -356, -343, 64.5, 70, r1(YB - 0.6), { door: { side: 'w', a: -352.3, b: -346.7 }, top: 2.9 });   // אולם האירוח שמאחורי הסטיו
  SC(-321, -297.5, 40, 57, 5, { shops: 's' });                                // B-I
  SC(-339, -321, 24, 40, 4.8, { shops: 'e' });
  SC(-321, -300, 59, 80, 4.8, { shops: 's' });
  SG(-420, -418.5, -60, 45.25, 4.2, 'field'); SG(-420, -418.5, 52.75, 170, 4.2, 'field');   // קו חומת העיר הדרומית
  SC(-418.5, -404, 8, 29, 4.4); SC(-418.5, -402, 69.5, 96, 4.4);

  zone('road', 'city', { floors: ID.road },
    t('הדרך שבין רובעי העיר', 'The way between the quarters of the city', 'الطريق بين أحياء المدينة'),
    t('העיר השתרעה על כ-800 על 500 מ\', ורק חלקים ממנה נחפרו. הדרכים שחיברו את הרבעים לא נחשפו: המסלול כאן הוא השערה, והוא נועד רק לחבר בין המקומות שנחפרו. הוא יורד עם המדרון: מרגלי הכניסה המערבית ועד שער העיר הדרומי יורדים כ-37 מ\', ובקטעים התלולים הוא מוצג כרחוב מדורג. השיפוע נלקח ממודל גבהים של פני השטח כיום, ולכן הוא מקורב. ממערב לו מבנה ציבור גדול, כ-30 על 40 מ\', שסגר את המתחם מדרום.',
      'The city covered some 800 by 500 m, and only parts of it were excavated. The ways that joined the quarters were not uncovered: the route here is conjecture, meant only to link the excavated places. It follows the slope: from the foot of the western entrance to the southern city gate one descends some 37 m, and the steep stretches are shown as a stepped street. The gradient is taken from an elevation model of the present surface, so it is approximate. Beside it stands a large public building, about 30 by 40 m, which closed the precinct on the south.',
      'امتدت المدينة على نحو 800 × 500 م، ولم يُنقَّب إلا في أجزاء منها. والطرق التي ربطت الأحياء لم تُكشف: فالمسار هنا افتراضي، غايته وصل الأماكن المنقَّبة فقط. وهو ينحدر مع السفح: من أسفل المدخل الغربي إلى بوابة المدينة الجنوبية ينزل المرء نحو 37 م، والمقاطع الشديدة الانحدار معروضة شارعًا مدرَّجًا. والانحدار مأخوذ من نموذج ارتفاعات لسطح الأرض اليوم، فهو تقريبي. وإلى جانبه مبنى عام كبير، نحو 30 × 40 م، كان يغلق الحرم من الجنوب.'));
  zone('eternal', 'eternal', { floors: ['eternal'] },
    t('גבעת עולם', 'The Eternal Hill', 'التلة الأبدية'),
    t('משטח סלע מחוץ לחומות המתחם, מדרום לו. במסורת העדה זהו מקום המשכן, והוא אחד המקומות הקדושים שבהם עוברים העולים לרגל. בתוכניות החפירה הוא מסומן כמקום קדוש לשומרונים, ולא כשריד שנחפר.',
      'A rock surface outside the precinct walls, to its south. In the community\'s tradition this is the place of the Tabernacle, and it is one of the holy places the pilgrims pass. On the excavation plans it is marked as a Samaritan holy place, not as an excavated remain.',
      'سطح صخري خارج أسوار الحرم، إلى جنوبه. هو في تقليد الطائفة موضع خيمة الاجتماع، وأحد الأماكن المقدّسة التي يمرّ بها الحجّاج. وهو معلَّم في مخططات التنقيب مكانًا مقدّسًا للسامريين، لا أثرًا منقَّبًا.'));
  zone('astreet', 'areaA', { floors: ID.astreet },
    t('הרחוב שברובע המערבי', 'The street of the western quarter', 'شارع الحيّ الغربي'),
    t('רחוב ממזרח למערב, העולה מזרחה; בקטע שנחפר נמצאו בו שלוש מדרגות על פני 25 מ\'. השיפוע המוצג כאן נלקח ממודל הגבהים, ומקום המדרגות מקורב. מצפונו שורת בתים גדולים, ומדרומו בתים נוספים שקירותיהם החיצוניים וקיר סוגרים עם מגדל שימשו לרובע הגנה. הבתים הצמודים יוצרים יחד את הקיר החיצוני של הרובע.',
      'An east–west street that rises eastwards; in the excavated stretch three steps were found over 25 m. The gradient shown here is taken from the elevation model, and the place of the steps is approximate. North of it stands a row of large houses, and south of it more houses whose outer walls, with a casemate-like wall and a tower, defended the quarter. The adjoining houses together form the quarter\'s outer wall.',
      'شارع من الشرق إلى الغرب، يرتفع شرقًا؛ وفي المقطع المنقَّب وُجدت فيه ثلاث درجات على امتداد 25 م. والانحدار المعروض هنا مأخوذ من نموذج الارتفاعات، وموضع الدرجات تقريبي. إلى شماله صف من البيوت الكبيرة، وإلى جنوبه بيوت أخرى كانت جدرانها الخارجية مع جدار شبيه بالغرف المحصّنة وبرج تحمي الحيّ. والبيوت المتلاصقة تشكّل معًا الجدار الخارجي للحيّ.'));
  zone('ayard', 'areaA', { floors: ['ayard', 'aleg1', 'aleg2', 'aleg3'] },
    t('הבית הגדול שברובע המערבי', 'The great house of the western quarter', 'البيت الكبير في الحيّ الغربي'),
    t('נכנסים במסדרון מתפתל באורך 13 מ\', כך שאין רואים את החצר מן הרחוב. החצר, 7.4 על 8.8 מ\', מרוצפת לוחות אבן המשופעים אל פי הבור. סביבה שני חדרי אירוח, 5.3 על 11.2 מ\' ו-4.2 על 9.5 מ\', חדרי רחצה עם אמבטיות, ומחסנים שמעליהם חדרי שינה קטנים. שכבת השרפה שבו עובייה 70 ס"מ.',
      'One enters by a winding corridor 13 m long, so that the courtyard cannot be seen from the street. The courtyard, 7.4 by 8.8 m, is paved with stone slabs sloping to the cistern mouth. Around it are two reception rooms, 5.3 by 11.2 m and 4.2 by 9.5 m, bathrooms with tubs, and storerooms with small bedrooms above them. The burnt layer in it is 70 cm thick.',
      'يُدخل إليه من ممرّ متعرّج طوله 13 م، فلا يُرى الفناء من الشارع. والفناء، 7.4 × 8.8 م، مبلّط بألواح حجرية مائلة نحو فوهة البئر. حوله قاعتا استقبال، 5.3 × 11.2 م و4.2 × 9.5 م، وحمّامات فيها أحواض، ومخازن تعلوها غرف نوم صغيرة. وسماكة طبقة الحريق فيه 70 سم.'));
  zone('market', 'areaB', { floors: ['market'] },
    t('השוק', 'The market place', 'السوق'),
    t('הרחבה שבקצה הרחוב העולה משער העיר. סביבה בתים גדולים: באחד מהם חצר מרוצפת ובה סטיו של שני עמודים דוריים לפני אולם האירוח.',
      'The open place at the end of the street that climbs from the city gate. Large houses stand around it: one has a paved courtyard with a portico of two Doric columns before its reception hall.',
      'الساحة في نهاية الشارع الصاعد من بوابة المدينة. حولها بيوت كبيرة: في أحدها فناء مبلّط فيه رواق من عمودين دوريين أمام قاعة الاستقبال.'));
  zone('b2yard', 'areaB', { floors: ID.b2 },
    t('בית הסטיו', 'The house with the portico', 'بيت الرواق'),
    t('חצר מרוצפת לוחות לא סדירים. בצדה שני עמודים דוריים נושאים קורת אבן ישרה, סטיו שלפני הפתח הרחב של אולם האירוח. שלוש מדרגות יורדות אל החצר, וגרם מדרגות צמוד לקיר עלה אל הקומה השנייה.',
      'A courtyard paved with irregular slabs. On one side two Doric columns carry a straight stone beam, a portico before the wide doorway of the reception hall. Three steps lead down into the courtyard, and a stair along the wall climbed to the upper storey.',
      'فناء مبلّط بألواح غير منتظمة. في جانبه عمودان دوريان يحملان عتبًا حجريًا مستقيمًا، رواق أمام المدخل الواسع لقاعة الاستقبال. تنزل ثلاث درجات إلى الفناء، ودرج ملاصق للجدار كان يصعد إلى الطابق العلوي.'));
  zone('bstreet', 'areaB', { floors: ID.bstreet },
    t('הרחוב הראשי של הרובע הדרומי', 'The main street of the southern quarter', 'الشارع الرئيس للحيّ الجنوبي'),
    t('רחוב באורך 75 מ\', שרוחבו ליד השער 6 מ\' והוא מצטמצם בהמשך, ובתים משני צדיו. הוא עולה מן השער אל השוק במדרון תלול, כ-16 מ\' לכל אורכו, ולכן הוא מוצג כאן כרחוב מדורג שבתיו בנויים בטרסות; המדרגות עצמן הן השערה. בחצרות הבתים נמצאו תנורים רבים מאוד, מימי המצור, ובכולם שכבת שרפה עבה.',
      'A street 75 m long, 6 m wide by the gate and narrowing further on, with houses on both sides. It climbs from the gate to the market up a steep slope, some 16 m along its length, and so it is shown here as a stepped street with terraced houses; the steps themselves are conjecture. Very many ovens, from the days of the siege, were found in the courtyards of the houses, and a thick burnt layer in all of them.',
      'شارع طوله 75 م، عرضه عند البوابة 6 م ثم يضيق، وعلى جانبيه بيوت. وهو يصعد من البوابة إلى السوق على سفح شديد الانحدار، نحو 16 م على طوله، ولذلك يُعرض هنا شارعًا مدرَّجًا بيوته مبنيّة على مصاطب؛ أمّا الدرجات نفسها فافتراضية. ووُجدت في أفنية البيوت أفران كثيرة جدًا، من أيام الحصار، وفي جميعها طبقة حريق سميكة.'));
  zone('sgate', 'areaB', { floors: ID.sgate },
    t('שער העיר הדרומי', 'The southern city gate', 'بوابة المدينة الجنوبية'),
    t('שער בן תא אחד, 7.5 על 8.5 מ\', בנוי גזית גדולה, שפתחו החיצוני 2.7 מ\' ותקרתו מעץ. חומת העיר הדרומית אינה חומה עצמאית בכל אורכה: הקו שלה הוא הקירות החיצוניים של הבתים הקיצוניים, והוא נשתמר לגובה 2.5 מ\'.',
      'A gate of a single chamber, 7.5 by 8.5 m, built of large ashlars, with an outer opening of 2.7 m and a timber ceiling. The southern city wall is not a free-standing wall along its whole length: its line is the outer walls of the outermost houses, preserved to a height of 2.5 m.',
      'بوابة من حجرة واحدة، 7.5 × 8.5 م، مبنيّة بحجارة مشذّبة كبيرة، فتحتها الخارجية 2.7 م وسقفها من خشب. وسور المدينة الجنوبي ليس سورًا قائمًا بذاته على طوله كله: فخطّه هو الجدران الخارجية للبيوت الطرفية، وقد حُفظ إلى ارتفاع 2.5 م.'));

  zone('citroom', 'secitadel', { floors: ['citroom', 'citroomdoor'] },
    t('חדר האירוח של המצודה', 'The reception room of the citadel', 'قاعة الاستقبال في القلعة'),
    t('אולם ארוך, 5.2 על 17.5 מ\', הנפתח אל חצר המצודה. כאן הוא מוצג כחדר הסבה: ספסלים לאורך הקירות, שולחנות נמוכים וכדים. הקירות נחפרו; הריהוט, התקרה והפתח המדויק משוערים, לפי חדרי אירוח דומים מן התקופה ההלניסטית.',
      'A long hall, 5.2 by 17.5 m, opening on the courtyard of the citadel. It is shown here as a dining room: benches along the walls, low tables and jars. The walls were excavated; the furnishing, the ceiling and the exact doorway are conjecture, after similar reception rooms of the Hellenistic period.',
      'قاعة طويلة، 5.2 × 17.5 م، تنفتح على فناء القلعة. تُعرض هنا قاعةَ اتّكاء: مقاعد على طول الجدران، وموائد منخفضة وجرار. الجدران منقَّبة؛ أمّا الأثاث والسقف وموضع الباب بدقّة فافتراضية، قياسًا على قاعات استقبال مشابهة من الفترة الهلنستية.'));
  zone('aroom', 'areaA', { floors: ['aroom', 'aroomdoor'] },
    t('חדר האירוח הגדול', 'The great reception room', 'قاعة الاستقبال الكبرى'),
    t('הגדול בשני חדרי האירוח של הבית, 5.3 על 11.2 מ\', מצפון לחצר. מעליו עמדה קומה שנייה על קורות עץ. הריהוט שכאן משוער: ספסלי הסבה, שולחנות נמוכים ושטיח, כמקובל בבתים אמידים בתקופה ההלניסטית.',
      'The larger of the two reception rooms of the house, 5.3 by 11.2 m, north of the courtyard. An upper storey stood above it on wooden beams. The furnishing here is conjecture: dining benches, low tables and a rug, as was usual in well-to-do houses of the Hellenistic period.',
      'الكبرى بين قاعتَي الاستقبال في البيت، 5.3 × 11.2 م، شمالي الفناء. كان يعلوها طابق ثانٍ على عوارض خشبية. الأثاث هنا افتراضي: مقاعد اتّكاء وموائد منخفضة وبساط، كما جرت العادة في البيوت الميسورة في الفترة الهلنستية.'));
  zone('b2hall', 'areaB', { floors: ['b2hall', 'b2halldoor'] },
    t('אולם האירוח שמאחורי הסטיו', 'The reception hall behind the portico', 'قاعة الاستقبال خلف الرواق'),
    t('האולם שאליו נכנסים בפתח הרחב שבין שני העמודים הדוריים. הקירות נחפרו; הריהוט ומראה הפנים משוערים.',
      'The hall entered by the wide doorway between the two Doric columns. The walls were excavated; the furnishing and the look of the interior are conjecture.',
      'القاعة التي يُدخل إليها من الباب الواسع بين العمودين الدوريين. الجدران منقَّبة؛ أمّا الأثاث وهيئة الداخل فافتراضيان.'));
  zone('abath', 'areaA', { floors: ['abath', 'abathdoor'] },
    t('חדר רחצה', 'A bathroom', 'غرفة استحمام'),
    t('בבית הגדול נמצאו חדרי רחצה ובהם אמבטיות. כאן מוצג אחד מהם: אמבט ישיבה מטויח, כדי מים וספסל. מקומו המדויק של החדר בתוך האגף, הפתח והחפצים משוערים.',
      'Bathrooms with tubs were found in the great house. One of them is shown here: a plastered sitting tub, water jars and a bench. The exact place of the room within the wing, the doorway and the objects are conjecture.',
      'وُجدت في البيت الكبير غرف استحمام فيها أحواض. تُعرض هنا واحدة منها: حوض جلوس مطليّ، وجرار ماء ومقعد. موضع الغرفة بدقّة داخل الجناح، والباب والأغراض افتراضية.'));
  // ריהוט משוער בחדרים, ומי שיושב בהם
  for (const n of [-26.5, -23.9, -19.4, -16.8, -14.2]) pr('couch', n, 73.1, H, { along: 'n' });
  pr('couch', -12, 75, H, { along: 'e' }); pr('table', -25.2, 74.4, H); pr('table', -18, 74.4, H); pr('table', -13.2, 75, H); pr('jars', -27.6, 76.6, H); pr('chest', -11.4, 77, H);
  put('man', -20.5, 75.4, { seed: 91, per: H }); put('elder', -15.5, 74.9, { seed: 92, per: H }); put('woman', -24.6, 76.2, { carry: 'jar', seed: 93, per: H });
  for (const e of [14.2, 17.4, 20.6]) pr('couch', -179.8, e, H, { along: 'e' });
  pr('couch', -182, 23.3, H, { along: 'n' }); pr('couch', -182.3, 13.1, H, { along: 'n' }); pr('rug', -182.2, 18.4, H); pr('table', -181.3, 15.8, H); pr('table', -181.3, 20.4, H); pr('chest', -184, 22.6, H); pr('jars', -183.9, 13.4, H);
  put('man', -182.6, 17.2, { seed: 94, per: H }); put('woman', -183.4, 20.2, { seed: 95, per: H }); put('elder', -181.2, 22, { seed: 96, per: H });
  for (const n of [-354.3, -351.6, -348.9, -346.2]) pr('couch', n, 68.9, H, { along: 'n' });
  pr('table', -353, 67.3, H); pr('table', -347.5, 67.3, H); pr('rug', -349.5, 66.6, H); pr('chest', -344.3, 68.6, H); pr('jars', -355, 65.8, H);
  put('man', -350.6, 67, { seed: 97, per: H }); put('woman', -346.4, 66.4, { carry: 'jar', seed: 98, per: H });
  // החיים בעיר
  scatter(10, -165, -65, 21, 24, ['man', 'woman', 'elder', 'child', 'merchant'], { per: H });
  scatter(5, -55.5, -52, 36, 72, ['man', 'woman', 'elder'], { per: H });
  scatter(7, -90, -68, 75, 97, ['man', 'woman', 'elder', 'priest'], { per: H });
  scatter(14, -210.6, -208.4, -16, 84, ['man', 'woman', 'child', 'elder', 'merchant'], { per: H });
  put('woman', -190, 14, { carry: 'jar', seed: 71, per: H }); put('woman', -187.5, 17.5, { seed: 72, per: H }); put('child', -191.5, 16.5, { seed: 73, per: H }); put('man', -192.5, 13.5, { carry: 'sack', seed: 74, per: H });
  scatter(8, -325, -214, 82.6, 85.4, ['man', 'woman', 'merchant', 'elder'], { per: H });
  scatter(16, -338, -322, 42, 68, ['man', 'woman', 'merchant', 'child', 'elder', 'merchant'], { per: H });
  scatter(14, -408, -341, 46.8, 51.2, ['man', 'woman', 'child', 'elder', 'merchant'], { per: H });
  put('guard', -409, 46.4, { carry: 'spear', seed: 75, per: H }); put('guard', -409, 51.6, { carry: 'spear', seed: 76, per: H });
  put('man', -430, 49, { carry: 'staff', seed: 77, per: H }); put('woman', -433, 48, { carry: 'basket', seed: 78, per: H }); put('elder', -427, 50, { seed: 79, per: H });
  put('man', -349, 59, { seed: 80, per: H }); put('woman', -352, 61.5, { carry: 'jar', seed: 81, per: H }); put('elder', -346, 62.5, { seed: 82, per: H });
  an('donkey', -120, 22.4, H); an('sheep', -209.5, 40, H); an('goat', -209.3, 42, H); an('donkey', -209.6, 70, H); an('donkey', -332, 60, H); an('sheep', -334, 46, H); an('goat', -335, 47.6, H);
  an('donkey', -380, 49, H); an('sheep', -436, 50, H); an('sheep', -437, 48.4, H); an('goat', -80, 85, H);
  pr('cistern', -189.6, 15.7, H); pr('jars', -186.4, 13, H); pr('oven', -192.9, 12.9, H);
  pr('stall', -323, 46, H, { face: 0 }); pr('stall', -323, 54, H, { face: 0 }); pr('stall', -337, 62, H, { face: Math.PI }); pr('stall', -337, 44, H, { face: Math.PI });
  pr('jars', -324, 50, H); pr('jars', -336, 58, H); pr('cage', -336.5, 48, H); pr('basket', -324.5, 57.5, H); pr('basket', -330, 66, H);
  pr('cistern', -346, 58.5, H); pr('oven', -354.5, 56.4, H); pr('oven', -354.6, 58.6, H); pr('jars', -344.5, 62.5, H);
  pr('column', -353.5, 64.1, H); pr('column', -345.5, 64.1, H);
  pr('stall', -360, 46.6, H, { face: Math.PI / 2 }); pr('stall', -385, 51.4, H, { face: -Math.PI / 2 }); pr('jars', -372, 51.2, H);
  pr('rock', -79, 86, H); pr('rock', -86, 80, H); pr('rock', -72, 92, H);

  // ---- פרטי הסביבה: חפצי יומיום במקומות שבהם השתמשו בהם. כולם משוערים, לפי ממצאים דומים מן התקופה ----
  const prx = (kind, n, e, per, o) => pr(kind, n, e, per, Object.assign({ x1: 1 }, o || {}));      // פרט העשרה: במכשיר חלש מוצג רק חלק מהם
  // רחבת המתחם וחצרות העולים
  prx('altartools', 46.6, 62.2, H); prx('woodpile', 35.6, 62.4, H, { along: 'e' }); prx('trough', 20, 70, null); prx('bench', 79, 20, H); prx('bench', 79, 30, H); prx('pithos', 57, 85, H);
  prx('bench', 10, 97.4, H, { along: 'n' }); prx('pithos', 20, 108, H); prx('trough', 0, 100.5, H, { along: 'n' }); prx('bench', 15, 113, H, { along: 'n' }); prx('amphorae', 25, 126, H, { along: 'n' });
  prx('woodpile', 36, 51, P, { along: 'e' }); prx('altartools', 84, 69, P);
  // הרחוב המזרחי
  prx('bench', 70, 122.3, H, { along: 'n' }); prx('amphorae', 60, 130.8, H, { along: 'n' }); prx('woodpile', 85, 122.4, H, { along: 'n' }); prx('trough', 90, 130.5, H, { along: 'n' }); prx('sacks', 78, 130.6, H);
  // המצודה והכניסה המערבית
  prx('rack', -15.5, 86.6, H); prx('woodpile', -29.2, 83.5, H, { along: 'e' }); prx('bench', -40, 45, H); prx('lamp', -27.9, 73, H); prx('lamp', -11.1, 73, H);
  // הרחוב שלרגלי הכניסה, האחוזה ובית המגורים
  prx('trough', -57, 15, H); prx('amphorae', -62.3, 10, H); prx('bench', -56.8, -5, H); prx('sacks', -62.2, -20, H); prx('produce', -57.2, 3.2, H, { c: 'figs' }); prx('woodpile', -62.3, 28, H, { along: 'e' });
  prx('pithos', -37.5, -27, H); prx('pithos', -37.5, -25.3, H); prx('pithos', -37.5, -23.6, H); prx('amphorae', -52, -12, H); prx('produce', -45, -11, H, { c: 'olives' }); prx('produce', -46.4, -11, H, { c: 'olives' }); prx('sacks', -51.8, -27, H);
  prx('quern', -70, -30, H); prx('pithos', -79, -40, H); prx('bench', -66.8, -39, H); prx('lamp', -79.2, -28, H);
  prx('woodpile', -120, 21.1, H, { along: 'n' });
  // הרובע המערבי: הבית הגדול
  prx('quern', -191, 18.6, H); prx('vine', -187.6, 17.4, H); prx('amphorae', -186, 18.9, H, { along: 'n' }); prx('amphorae', -208.4, 40, H); prx('produce', -208.5, 60, H, { c: 'grain' });
  prx('lamp', -184.2, 13.1, H); prx('lamp', -184.2, 23.3, H);
  prx('tub', -190.7, 8.9, H); prx('jars', -190.9, 10.6, H); prx('bench', -188.5, 9.4, H); prx('lamp', -188.5, 8.1, H);
  // הרובע הדרומי: השוק, הרחוב ובית הסטיו
  prx('produce', -324.2, 43.6, H, { c: 'figs' }); prx('produce', -324.2, 56.4, H, { c: 'pomegranate' }); prx('produce', -336, 46.4, H, { c: 'olives' }); prx('produce', -336, 64.4, H, { c: 'grain' }); prx('produce', -330, 41.2, H, { c: 'dates' });
  prx('cloth', -336.2, 60, H); prx('pots', -324, 60.6, H); prx('sacks', -330.5, 68.6, H); prx('amphorae', -322, 66, H); prx('bench', -321.8, 62.6, H); prx('pithos', -338, 41, H);
  prx('woodpile', -350, 46.6, H, { along: 'n' }); prx('sacks', -395, 46.7, H); prx('pithos', -400, 51.4, H); prx('produce', -380, 46.5, H, { c: 'grain' }); prx('amphorae', -366, 51.5, H, { along: 'n' });
  prx('quern', -352, 62, H); prx('vine', -349.5, 60.2, H); prx('pithos', -343.8, 56, H); prx('lamp', -344.3, 65.8, H);
  // מי שיושב ומי שעובד: הסבה בחדרי האירוח, טחינה ברחיים, מוכרים ליד הסחורה
  put('woman', -191.1, 17.9, { pose: 'crouch', seed: 201, per: H }); put('woman', -352.1, 62.7, { pose: 'crouch', seed: 202, per: H }); put('woman', -70.1, -29.3, { pose: 'crouch', seed: 203, per: H });
  put('man', -26.5, 73.1, { pose: 'sit', seed: 204, per: H }); put('elder', -19.4, 73.1, { pose: 'sit', seed: 205, per: H }); put('man', -14.2, 73.1, { pose: 'sit', seed: 206, per: H });
  put('man', -179.8, 14.2, { pose: 'sit', seed: 207, per: H }); put('elder', -179.8, 20.6, { pose: 'sit', seed: 208, per: H }); put('woman', -182, 23.3, { pose: 'sit', seed: 209, per: H });
  put('man', -351.6, 68.9, { pose: 'sit', seed: 210, per: H }); put('elder', -346.2, 68.9, { pose: 'sit', seed: 211, per: H });
  put('merchant', -321.8, 62.6, { pose: 'sit', seed: 212, per: H }); put('elder', 79, 20, { pose: 'sit', seed: 213, per: H }); put('man', 70, 122.3, { pose: 'sit', seed: 214, per: H }); put('woman', -56.8, -5, { pose: 'sit', seed: 215, per: H });
  // חפצים שאי אפשר לעבור דרכם
  const BLOCK = { stall: 1.15, cistern: 0.95, press: 1.4, oven: 0.8, couch: 0.7, table: 0.5, chest: 0.5, pithos: 0.5, quern: 0.55, trough: 0.75, bench: 0.6, woodpile: 0.7, tub: 0.8, basin: 1.0, column: 0.4, loom: 0.7, amphorae: 0.4, sacks: 0.5, produce: 0.45, pots: 0.6, cloth: 0.4, rack: 0.5, altartools: 0.5, lamp: 0.15, pen: 0 };
  const blocks = props.filter(q => BLOCK[q.kind]).map(q => ({ x: q.x, z: q.z, r: BLOCK[q.kind], per: q.per }));

  // אזור שכל מפלסיו הלניסטיים שייך לתקופה ההלניסטית בלבד
  Z.forEach(z => { if (!z.per && z.floors && z.floors.every(id => (floors.find(f => f.id === id) || {}).per === H)) z.per = H; });
  // דלתות העץ של השערים, פתוחות: [n, e, גובה הרצפה, כיוון הכנף ברדיאנים]
  const doors = [[41.9, 85, 0, 1.25], [46.1, 85, 0, -1.25], [46.6, 125.4, -15.5, 0.35], [46.6, 128.6, -15.5, -0.35], [86, 45.9, 0, 0.3], [86, 49.1, 0, -0.3]]
    .map(q => ({ x: q[1], z: -q[0], y: q[2], ry: q[3], per: H }));

  window.GERIZIM_WALK = {
    floors, solids, temple, zones: Z, people, animals, props, blocks, doors, terrain, toEN,
    origin: [35.273441, 32.201236],               // מרכז הכנסייה המתומנת: ממנו נמדד toEN
    demOff: OFF,                                  // ההפרש בין מפלסי הזירה לגובהי מודל הגבהים
    north: 15,                                    // "למעלה" בשרטוט נוטה 15 מעלות מזרחה מן הצפון
    starts: {
      stairs: { x: 126.5, z: -74, yaw: Math.PI },         // ברחוב שמצפון לשער התחתון, פונים אל השער
      plaza: { x: 77, z: -44, yaw: -Math.PI / 2 },        // בפתח השער המזרחי, פונים אל מרכז המתחם
      city: { x: -30, z: 59.5, yaw: Math.PI / 2 },        // ברחוב שבעיר, פונים אל הכניסה המערבית
      areaA: { x: -10, z: 209.5, yaw: Math.PI / 2 },      // ברחוב של הרובע המערבי, פונים מזרחה
      areaB: { x: 49, z: 432, yaw: 0 }                    // מחוץ לשער העיר הדרומי, פונים אל השער
    },
    bounds: [-70, -130, 172, 448],
    // תחומי השרטוט שבכרטיסים: המתחם, הרובע המערבי, הרובע הדרומי
    planBox: { precinct: [-66, -130, 146, 100], areaA: [-24, 160, 110, 232], areaB: [16, 292, 100, 448] }
  };
})();
