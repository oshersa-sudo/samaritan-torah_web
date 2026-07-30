/*
 * מועצת קלוד – פאנל יועצים שמנתח את ההתקדמות האישית ומגבש המלצות.
 *
 * המועצה עובדת מקומית ומורכבת מכמה "יועצים", כל אחד מזווית מבט אחרת
 * (התמדה, אחוזי הצלחה, קצב לימוד, הגייה, ואסטרטגיה כללית).
 * כל יועץ בוחן את הנתונים ומחזיר תובנה + המלצה מעשית, ולבסוף
 * מגובשת "החלטת מועצה" מסכמת עם צעד ראשון מומלץ.
 */
const Council = (() => {

  function analyze(ctx) {
    const s = ctx.stats;
    const totalWords = ctx.totalWords;
    const accuracy = s.questionsAsked > 0
      ? Math.round((s.questionsCorrect / s.questionsAsked) * 100) : null;
    const coverage = totalWords > 0
      ? Math.round((s.wordsLearned / totalWords) * 100) : 0;
    const daysActive = ctx.elapsed + 1;
    const pace = daysActive > 0 ? (s.wordsLearned / daysActive) : 0;

    const advisors = [];

    // ---- יועץ ההתמדה ----
    advisors.push((() => {
      let insight, rec, tone;
      if (s.wordsLearned === 0) {
        insight = "עדיין לא סומנו מילים כנלמדו. ההתחלה היא החלק החשוב ביותר.";
        rec = "פתחו את מסך אוצר המילים והשלימו היום 5 מילים בלבד – קטן ובר-ביצוע.";
        tone = "start";
      } else if (pace < 0.5) {
        insight = `הקצב הנוכחי כ-${pace.toFixed(1)} מילים ליום. יש מקום להאיץ מעט.`;
        rec = "קבעו תזכורת יומית קבועה של 10 דקות – עדיף מעט וקבוע מהרבה ולעיתים רחוקות.";
        tone = "push";
      } else {
        insight = `קצב יפה של כ-${pace.toFixed(1)} מילים ליום, לאורך ${daysActive} ימים.`;
        rec = "שמרו על השגרה. עקביות יומית שווה יותר מכל מאמץ חד-פעמי.";
        tone = "good";
      }
      return { name: "יועץ ההתמדה", icon: "🔥", insight, rec, tone };
    })());

    // ---- יועץ הדיוק ----
    advisors.push((() => {
      let insight, rec, tone;
      if (accuracy == null) {
        insight = "עדיין לא נענו שאלות מבחן, ולכן אין נתוני דיוק.";
        rec = "אחרי שלושה שבועות ילמד ייפתח מבחן. אפשר גם לתרגל מוקדם דרך מסך המבחן.";
        tone = "start";
      } else if (accuracy < 60) {
        insight = `אחוז ההצלחה כרגע ${accuracy}% – יש בלבול בין מילים.`;
        rec = "לפני כל מבחן חזרו על האוצר עם ההגייה הקולית, וכסו את התרגום ונסו להיזכר.";
        tone = "push";
      } else if (accuracy < 85) {
        insight = `אחוז הצלחה ${accuracy}% – בסיס טוב, אפשר לחדד.`;
        rec = "התמקדו במילים שבהן טעיתם. חזרה ממוקדת יעילה יותר מחזרה על הכול.";
        tone = "good";
      } else {
        insight = `אחוז הצלחה מצוין של ${accuracy}%!`;
        rec = "העלו את הרף: נסו לתרגם מעברית לאנגלית בעל-פה, לא רק לזהות.";
        tone = "great";
      }
      return { name: "יועץ הדיוק", icon: "🎯", insight, rec, tone };
    })());

    // ---- יועץ ההיקף ----
    advisors.push((() => {
      let insight, rec, tone;
      insight = `כיסית ${s.wordsLearned} מתוך ${totalWords} מילים (${coverage}%).`;
      if (coverage < 10) {
        rec = "היעד הקרוב: להשלים אוצר מלא אחד של 25 מילים ולעבור את המבחן שלו.";
        tone = "start";
      } else if (coverage < 50) {
        rec = "אתם בדרך הנכונה. סמנו יעד ביניים – להגיע לחצי מהמאגר.";
        tone = "good";
      } else {
        rec = "התקדמות מרשימה. שקלו להרחיב את המאגר במילים מהתחום המקצועי שלכם.";
        tone = "great";
      }
      return { name: "יועץ ההיקף", icon: "📚", insight, rec, tone };
    })());

    // ---- יועץ ההגייה ----
    advisors.push((() => {
      const insight = "הגייה נכונה נבנית מחזרה קולית, לא רק מקריאה שקטה.";
      const rec = Speech.supported()
        ? "בכל מילה חדשה לחצו על כפתור ההגייה 🔊 ואמרו אותה בקול אחרי הרמקול, 3 פעמים."
        : "הדפדפן הנוכחי ללא הגייה קולית – מומלץ לעבור ל-Chrome או Edge לתרגול מבטא.";
      return { name: "יועץ ההגייה", icon: "🗣️", insight, rec, tone: "good" };
    })());

    // ---- יועץ האסטרטגיה ----
    advisors.push((() => {
      let insight, rec, tone = "good";
      if (s.testsCompleted === 0) {
        insight = "טרם הושלמו מבחנים, ולכן קשה למדוד שליטה אמיתית.";
        rec = "השלימו מבחן ראשון – הוא הופך את הידע מ'מוכר' ל'זמין לשליפה'.";
        tone = "start";
      } else if (s.grammarLessonsDone === 0) {
        insight = "אוצר מילים בלי דקדוק נשאר רשימה. הזמנים מחברים אותו למשפטים.";
        rec = "בתחילת החודש הבא הקדישו 3 ימים לשיעורי הלשון – זה מכפיל את היכולת לדבר.";
        tone = "push";
      } else {
        insight = `שילוב טוב: ${s.testsCompleted} מבחנים ו-${s.grammarLessonsDone} שיעורי דקדוק.`;
        rec = "התחילו לבנות משפטים משלכם מ-3 מילים חדשות בכל יום, בקול.";
        tone = "great";
      }
      return { name: "יועץ האסטרטגיה", icon: "♟️", insight, rec, tone };
    })());

    // ---- החלטת המועצה ----
    const priority =
      s.wordsLearned === 0 ? "להתחיל: 5 מילים היום במסך אוצר המילים." :
      accuracy != null && accuracy < 60 ? "לחזק דיוק: חזרה ממוקדת על מילים שגויות לפני המבחן הבא." :
      s.testsCompleted === 0 ? "להשלים מבחן ראשון כדי לבסס שליפה." :
      s.grammarLessonsDone === 0 ? "להוסיף דקדוק: 3 ימי לשון בתחילת החודש." :
      coverage < 50 ? "לשמור קצב ולהגיע לחצי מהמאגר." :
      "להעלות רף: תרגום פעיל מעברית לאנגלית בקול.";

    const summary =
      `נלמדו ${s.wordsLearned} מילים, נשאלו ${s.questionsAsked} שאלות, ` +
      `מתוכן ${s.questionsCorrect} נכונות` +
      (accuracy != null ? ` (${accuracy}% דיוק).` : ".") +
      ` הושלמו ${s.testsCompleted} מבחנים ו-${s.grammarLessonsDone} שיעורי לשון.`;

    return { advisors, summary, priority, accuracy, coverage, pace };
  }

  return { analyze };
})();
