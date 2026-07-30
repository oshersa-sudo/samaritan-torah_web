/*
 * לוגיקת התזמון של האפליקציה.
 *
 * מחזור אוצר מילים = 4 שבועות (28 ימים):
 *   שבועות 1–3 (ימים 0–20): לימוד ושינון של 25 מילים מתחום משותף.
 *   שבוע 4 (ימים 21–27): מבחן אמריקאי על אותן 25 מילים.
 * בסיום 4 השבועות עוברים אוטומטית לאוצר הבא של 25 מילים, וכן הלאה,
 * עד סיום כל המאגר – ואז חוזרים חלילה מההתחלה.
 *
 * לימוד לשון וזמנים: אחת לחודש, בשלושת הימים הראשונים של החודש,
 * מוצג שיעור דקדוק אחר בכל יום (שלישיית שיעורים שמתחלפת מדי חודש).
 */
const Scheduler = (() => {
  const SET_SIZE = 25;
  const CYCLE_DAYS = 28;        // 4 שבועות
  const LEARN_DAYS = 21;        // 3 שבועות ראשונים

  // בונה את רשימת כל האוצרות (כל אוצר = עד 25 מילים מתחום משותף).
  function buildSets(words) {
    const byCat = {};
    (window.CATEGORIES || []).forEach(c => (byCat[c.key] = []));
    words.forEach(w => {
      if (!byCat[w.cat]) byCat[w.cat] = [];
      byCat[w.cat].push(w);
    });
    const sets = [];

    // מחלק רשימת מילים של תחום אחד לאוצרות של 25. שארית קטנה מ-25
    // מתמזגת לאוצר הקודם של אותו תחום, כדי שלא ייווצרו אוצרות זעירים.
    function chunkCategory(list, key, he) {
      const catSets = [];
      for (let i = 0; i < list.length; i += SET_SIZE) {
        catSets.push({ category: key, categoryHe: he, words: list.slice(i, i + SET_SIZE) });
      }
      if (catSets.length >= 2) {
        const last = catSets[catSets.length - 1];
        if (last.words.length < SET_SIZE) {
          catSets[catSets.length - 2].words =
            catSets[catSets.length - 2].words.concat(last.words);
          catSets.pop();
        }
      }
      return catSets;
    }

    (window.CATEGORIES || []).forEach(c => {
      chunkCategory(byCat[c.key] || [], c.key, c.he).forEach(s => sets.push(s));
    });
    // תחומים שאינם ברשימת הקטגוריות הרשמית (למשל מייבוא) – נוסיף בסוף
    Object.keys(byCat).forEach(k => {
      if ((window.CATEGORIES || []).some(c => c.key === k)) return;
      chunkCategory(byCat[k], k, k).forEach(s => sets.push(s));
    });
    return sets.filter(s => s.words.length > 0);
  }

  function daysBetween(startISO, endISO) {
    const a = new Date(startISO + "T00:00:00");
    const b = new Date(endISO + "T00:00:00");
    return Math.floor((b - a) / (1000 * 60 * 60 * 24));
  }

  // מצב המחזור הנוכחי לפי התאריך.
  function getCycle(state, totalSets) {
    const today = Storage.todayISO();
    let elapsed = daysBetween(state.startDate, today);
    if (elapsed < 0) elapsed = 0;

    const naturalSetIndex = totalSets > 0
      ? Math.floor(elapsed / CYCLE_DAYS) % totalSets
      : 0;
    const cycleDay = elapsed % CYCLE_DAYS;              // 0..27
    const phase = cycleDay < LEARN_DAYS ? "learn" : "test";
    const week = Math.floor(cycleDay / 7) + 1;         // 1..4
    const daysToTest = Math.max(0, LEARN_DAYS - cycleDay);
    const daysToNextSet = CYCLE_DAYS - cycleDay;

    // אם המשתמש "ערבל" ובחר אוצר ידני – מכבדים את הבחירה עד המחזור הבא.
    const setIndex = (state.setOverride != null && totalSets > 0)
      ? ((state.setOverride % totalSets) + totalSets) % totalSets
      : naturalSetIndex;

    return {
      setIndex, naturalSetIndex, cycleDay, phase, week,
      daysToTest, daysToNextSet, elapsed, totalSets,
      isOverridden: state.setOverride != null && setIndex !== naturalSetIndex
    };
  }

  // האם היום בתקופת לימוד הדקדוק החודשית (3 ימים ראשונים בחודש).
  function getGrammarStatus(lessons) {
    const today = new Date(Storage.todayISO() + "T00:00:00");
    const dayOfMonth = today.getDate();          // 1..31
    const monthIndex = today.getFullYear() * 12 + today.getMonth();
    const startLesson = lessons.length ? (monthIndex * 3) % lessons.length : 0;

    // שלישיית השיעורים של החודש הנוכחי
    const trio = [0, 1, 2].map(k => lessons[(startLesson + k) % lessons.length]).filter(Boolean);

    const active = dayOfMonth >= 1 && dayOfMonth <= 3 && lessons.length > 0;
    const todayLesson = active ? trio[dayOfMonth - 1] : null;

    return { active, dayOfPeriod: active ? dayOfMonth : 0, trio, todayLesson, monthIndex };
  }

  return { SET_SIZE, CYCLE_DAYS, LEARN_DAYS, buildSets, getCycle, getGrammarStatus, daysBetween };
})();
