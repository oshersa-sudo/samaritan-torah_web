/*
 * ניהול שמירה מקומית (localStorage) של כל ההתקדמות.
 * הכול נשמר בדפדפן של המשתמש – שום דבר לא נשלח לרשת.
 */
const Storage = (() => {
  const KEY = "eng_app_state_v1";

  const defaultState = () => ({
    startDate: todayISO(),        // תאריך תחילת השימוש – בסיס לחישוב המחזורים
    learnedWords: {},             // { "spoon": true } – מילים שסומנו כנלמדו
    stats: {
      wordsLearned: 0,            // סך מילים שנלמדו
      questionsAsked: 0,          // סך שאלות שנשאלו במבחנים
      questionsCorrect: 0,        // סך תשובות נכונות
      testsCompleted: 0,          // מבחנים שהושלמו
      grammarLessonsDone: 0       // שיעורי דקדוק שהושלמו
    },
    testHistory: [],              // [{setIndex, date, correct, total}]
    setOverride: null,            // אינדקס אוצר ידני (בעת ערבול)
    customWords: [],              // מילים שהמשתמש הוסיף דרך ייבוא
    customCats: [],               // תחומים שהמשתמש הוסיף דרך ייבוא
    lastActive: todayISO()
  });

  function todayISO() {
    // תאריך מקומי בפורמט YYYY-MM-DD
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // מיזוג עם ברירת מחדל כדי שלא ייחסרו שדות בגרסאות עתידיות
      return Object.assign(defaultState(), parsed, {
        stats: Object.assign(defaultState().stats, parsed.stats || {})
      });
    } catch (e) {
      console.warn("שגיאה בטעינת הנתונים, מתחילים מחדש", e);
      return defaultState();
    }
  }

  function save() {
    state.lastActive = todayISO();
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  return {
    get: () => state,
    save,
    todayISO,
    reset() {
      state = defaultState();
      save();
    },
    markLearned(word) {
      if (!state.learnedWords[word]) {
        state.learnedWords[word] = true;
        state.stats.wordsLearned++;
        save();
      }
    },
    isLearned(word) {
      return !!state.learnedWords[word];
    },
    recordAnswer(correct) {
      state.stats.questionsAsked++;
      if (correct) state.stats.questionsCorrect++;
      save();
    },
    recordTest(setIndex, correct, total) {
      state.stats.testsCompleted++;
      state.testHistory.push({ setIndex, date: todayISO(), correct, total });
      save();
    },
    recordGrammar() {
      state.stats.grammarLessonsDone++;
      save();
    },
    setOverride(idx) {
      state.setOverride = idx;
      save();
    },
    addCustomWords(words) {
      state.customWords = state.customWords.concat(words);
      save();
    },
    addCustomCats(cats) {
      (cats || []).forEach(c => {
        if (!state.customCats.some(x => x.key === c.key)) state.customCats.push(c);
      });
      save();
    },
    clearCustomWords() {
      state.customWords = [];
      state.customCats = [];
      save();
    }
  };
})();
