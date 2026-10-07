/* ─────────────────────────────────────────────────────────────────────────────
   בדיקת הסיור המודרך — להריץ אחרי כל שינוי בממשק.

   הסיור מצביע על כפתורים אמיתיים באפליקציה, ולכן הוא הדבר הראשון שנשבר
   כששמו של כפתור משתנה, או כשכפתור עובר לשבת מאחורי כפתור אחר. כשזה קורה
   הסיור אינו מתלונן: הוא פשוט מראה כתובית בלי טבעת, והמשתמש שומע הסבר על
   משהו שאינו רואה.

   ההרצה: לפתוח את האפליקציה בדפדפן, לפתוח את הקונסולה, ולהדביק את הקובץ
   כולו. הבדיקה מריצה את ה-pre של כל שלב בדיוק כפי שהסיור עושה, ובודקת
   שהיעד אמנם על המסך.

   מה היא בודקת
     · שמספר השלבים ומספר הכתוביות שווים, בשלוש השפות.
     · שיעד כל שלב קיים ונראה אחרי ה-pre שלו.
     · שאף כתובית אינה ארוכה מדי לקרוא ברצף.

   מה היא אינה בודקת — ואין לה דרך לבדוק: שהכתובית עדיין אומרת את האמת.
   זה נקרא בעיניים. אחרי הוספת יחידה לספרייה או פריט לתפריט, יש לקרוא את
   שלבים 18 ו-19, שהם היחידים המונים דברים בשמם.
   ───────────────────────────────────────────────────────────────────────────── */
(async function tourCheck(){
  const out = [];
  const say = (ok, msg) => out.push((ok ? '  ✓ ' : '  ✗ ') + msg);

  // ── הכתוביות ───────────────────────────────────────────────────────────────
  const n = TOUR_STEPS.length;
  for (const lang of ['he', 'en', 'ar']) {
    const c = ((I18N[lang] || {}).tour || []).length;
    say(c === n, lang + ': ' + c + ' כתוביות מול ' + n + ' שלבים');
  }

  // ── היעדים ─────────────────────────────────────────────────────────────────
  const wasRunning = TOUR.running, wasMuted = TOUR.muted, wasAuto = TOUR.auto;
  TOUR.running = true; TOUR.auto = false; TOUR.muted = true;
  document.getElementById('tourOverlay').classList.remove('hidden');
  const dead = [];
  for (let i = 0; i < n; i++) {
    const s = TOUR_STEPS[i];
    TOUR.i = i;
    try { if (s.pre) await s.pre(); }
    catch (e) { dead.push((i + 1) + ': ה-pre נכשל — ' + e); continue; }
    await new Promise(r => setTimeout(r, 300));
    let el = null;
    try { el = s.el ? s.el() : null; } catch (e) {}
    if (!el) continue;                       // שלב בלי יעד הוא תקין
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2)
      dead.push((i + 1) + ': ' + (el.id || el.className || el.tagName) + ' אינו על המסך');
  }
  TOUR.running = wasRunning; TOUR.muted = wasMuted; TOUR.auto = wasAuto;
  document.getElementById('tourOverlay').classList.add('hidden');
  say(!dead.length, dead.length ? 'יעדים שאינם על המסך:' : 'כל היעדים על המסך');
  dead.forEach(d => out.push('      ' + d));

  // ── אורך הכתוביות ──────────────────────────────────────────────────────────
  const long = ((I18N.he || {}).tour || [])
    .map((s, i) => [i + 1, s.length]).filter(x => x[1] > 300);
  say(!long.length, long.length
      ? 'כתוביות ארוכות מ-300 תווים: ' + long.map(x => 'שלב ' + x[0] + ' (' + x[1] + ')').join(', ')
      : 'אורכי הכתוביות סבירים');

  console.log('\n בדיקת הסיור המודרך\n' + out.join('\n') + '\n');
  return out.join('\n');
})();
