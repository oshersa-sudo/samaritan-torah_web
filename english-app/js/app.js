/*
 * app.js – הליבה: ניווט בין המסכים ורינדור כל התכונות.
 * מסכים: בית, אוצר מילים (+ערבול), מבחן, לשון וזמנים, התקדמות, מועצת קלוד, ייבוא.
 */
(function () {
  "use strict";

  // ---------- איסוף כל המילים (בסיס + מותאם אישית) ----------
  function allWords() {
    const custom = Storage.get().customWords || [];
    return (window.WORDS || []).concat(custom);
  }

  function computeContext() {
    const state = Storage.get();
    const words = allWords();
    const sets = Scheduler.buildSets(words);
    const cycle = Scheduler.getCycle(state, sets.length);
    const grammar = Scheduler.getGrammarStatus(window.GRAMMAR_LESSONS || []);
    return { state, words, sets, cycle, grammar };
  }

  // ---------- כלי עזר ----------
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const app = document.getElementById("app");
  let currentScreen = "home";

  // ==================================================================
  // מסך בית
  // ==================================================================
  function renderHome() {
    const ctx = computeContext();
    const { cycle, sets, grammar, state } = ctx;
    app.innerHTML = "";

    const set = sets[cycle.setIndex];
    const catHe = set ? set.categoryHe : "—";

    const hero = el("div", "card hero");
    hero.appendChild(el("h2", null, "שלום 👋 בואו נלמד אנגלית"));
    hero.appendChild(el("p", "muted",
      `היום יום ${cycle.cycleDay + 1} מתוך 28 במחזור הנוכחי · שבוע ${cycle.week} מתוך 4`));

    // כרטיס האוצר הפעיל
    const phaseBox = el("div", "phase-box");
    if (cycle.phase === "learn") {
      phaseBox.appendChild(el("div", "phase-tag learn", "שלב לימוד ושינון"));
      phaseBox.appendChild(el("p", null,
        `האוצר הנוכחי: <b>${esc(catHe)}</b> — ${set ? set.words.length : 25} מילים לשינון.`));
      phaseBox.appendChild(el("p", "muted",
        `נותרו ${cycle.daysToTest} ימים עד המבחן.`));
    } else {
      phaseBox.appendChild(el("div", "phase-tag test", "שבוע המבחן 📝"));
      phaseBox.appendChild(el("p", null,
        `הגיע הזמן להיבחן על האוצר: <b>${esc(catHe)}</b>.`));
      phaseBox.appendChild(el("p", "muted",
        `נותרו ${cycle.daysToNextSet} ימים עד האוצר הבא.`));
    }
    hero.appendChild(phaseBox);

    // כפתורי פעולה מהירים
    const actions = el("div", "home-actions");
    const primaryLabel = cycle.phase === "learn" ? "ללימוד האוצר ▸" : "למבחן ▸";
    const primaryTarget = cycle.phase === "learn" ? "vocab" : "quiz";
    actions.appendChild(navBtn(primaryLabel, primaryTarget, "primary"));
    actions.appendChild(navBtn("מועצת קלוד – המלצות אישיות", "council"));
    hero.appendChild(actions);
    app.appendChild(hero);

    // התראת דקדוק חודשי
    if (grammar.active && grammar.todayLesson) {
      const gb = el("div", "card notice");
      gb.appendChild(el("h3", null, "📅 ימי לשון וזמנים – החודש"));
      gb.appendChild(el("p", null,
        `היום, היום ה-${grammar.dayOfPeriod} מתוך 3, שיעור: <b>${esc(grammar.todayLesson.title)}</b>.`));
      gb.appendChild(navBtn("לשיעור של היום ▸", "grammar", "primary"));
      app.appendChild(gb);
    }

    // תקציר מהיר
    const st = state.stats;
    const acc = st.questionsAsked ? Math.round(st.questionsCorrect / st.questionsAsked * 100) : 0;
    const quick = el("div", "card");
    quick.appendChild(el("h3", null, "מבט מהיר"));
    const grid = el("div", "stat-grid");
    grid.appendChild(statCell(st.wordsLearned, "מילים נלמדו"));
    grid.appendChild(statCell(st.questionsAsked, "שאלות נשאלו"));
    grid.appendChild(statCell(st.questionsCorrect, "תשובות נכונות"));
    grid.appendChild(statCell(acc + "%", "אחוז הצלחה"));
    quick.appendChild(grid);
    app.appendChild(quick);
  }

  function statCell(num, label) {
    const c = el("div", "stat-cell");
    c.appendChild(el("div", "stat-num", String(num)));
    c.appendChild(el("div", "stat-label", label));
    return c;
  }
  function navBtn(label, target, cls) {
    const b = el("button", "btn " + (cls || ""), label);
    b.onclick = () => go(target);
    return b;
  }

  // ==================================================================
  // מסך אוצר מילים + ערבול
  // ==================================================================
  let vocabViewSet = null;   // אינדקס האוצר המוצג (לצורך ערבול)

  function renderVocab() {
    const ctx = computeContext();
    const { sets, cycle } = ctx;
    app.innerHTML = "";

    if (!sets.length) {
      app.appendChild(emptyCard("אין מילים במאגר. השתמשו במסך הייבוא כדי להוסיף."));
      return;
    }

    if (vocabViewSet == null) vocabViewSet = cycle.setIndex;
    vocabViewSet = ((vocabViewSet % sets.length) + sets.length) % sets.length;
    const set = sets[vocabViewSet];

    const head = el("div", "card");
    const row = el("div", "row-between");
    const title = el("div");
    title.appendChild(el("h2", null, "אוצר מילים: " + esc(set.categoryHe)));
    title.appendChild(el("p", "muted",
      `אוצר ${vocabViewSet + 1} מתוך ${sets.length} · ${set.words.length} מילים`));
    row.appendChild(title);

    const shuffleBtn = el("button", "btn", "🔀 ערבל אוצר אחר");
    shuffleBtn.title = "קבלת אוצר מילים אחר לשינון";
    shuffleBtn.onclick = () => {
      let next;
      do { next = Math.floor(Math.random() * sets.length); }
      while (sets.length > 1 && next === vocabViewSet);
      vocabViewSet = next;
      Storage.setOverride(next);  // האוצר שנבחר יוצג גם בבית עד המחזור הבא
      renderVocab();
    };
    row.appendChild(shuffleBtn);
    head.appendChild(row);

    if (cycle.isOverridden || vocabViewSet !== cycle.naturalSetIndex) {
      const back = el("button", "btn small ghost", "↩ חזרה לאוצר לפי לוח הזמנים");
      back.onclick = () => {
        Storage.setOverride(null);
        vocabViewSet = cycle.naturalSetIndex;
        renderVocab();
      };
      head.appendChild(back);
    }
    app.appendChild(head);

    // רשימת המילים
    const list = el("div", "word-list");
    set.words.forEach(w => list.appendChild(wordCard(w)));
    app.appendChild(list);

    // סימון כל האוצר כנלמד
    const done = el("button", "btn primary wide", "✓ סמן את כל האוצר כנלמד");
    done.onclick = () => {
      set.words.forEach(w => Storage.markLearned(w.en));
      toast("כל האוצר סומן כנלמד! 🎉");
      renderVocab();
    };
    app.appendChild(done);
  }

  function wordCard(w) {
    const c = el("div", "word-card");
    const learned = Storage.isLearned(w.en);
    if (learned) c.classList.add("learned");

    const main = el("div", "word-main");
    const en = el("div", "word-en", esc(w.en));
    main.appendChild(en);
    main.appendChild(el("div", "word-pron", "[" + esc(w.pron) + "]"));
    main.appendChild(el("div", "word-he", esc(w.he)));
    c.appendChild(main);

    const side = el("div", "word-side");
    const play = el("button", "icon-btn", "🔊");
    play.title = "השמע הגייה";
    play.onclick = () => Speech.speak(w.en);
    side.appendChild(play);

    const mark = el("button", "icon-btn small", learned ? "✓" : "○");
    mark.title = learned ? "נלמד" : "סמן כנלמד";
    mark.onclick = () => { Storage.markLearned(w.en); renderVocab(); };
    side.appendChild(mark);
    c.appendChild(side);
    return c;
  }

  // ==================================================================
  // מסך מבחן אמריקאי
  // ==================================================================
  let quizState = null;

  function renderQuiz() {
    const ctx = computeContext();
    const { sets, cycle } = ctx;
    app.innerHTML = "";
    if (!sets.length) {
      app.appendChild(emptyCard("אין מילים למבחן. הוסיפו מילים דרך הייבוא."));
      return;
    }

    if (!quizState) {
      // מבחן על האוצר הפעיל (או שנבחר בערבול)
      const set = sets[cycle.setIndex];
      startQuiz(set, cycle.setIndex, ctx.words);
      return;
    }
    drawQuizQuestion();
  }

  function startQuiz(set, setIndex, pool) {
    const questions = shuffle(set.words).map(w => {
      // 3 מסיחים – עדיפות לאותה קטגוריה, אחרת מכלל המאגר
      const sameCat = pool.filter(x => x.cat === w.cat && x.en !== w.en);
      const others = pool.filter(x => x.en !== w.en);
      const distractPool = sameCat.length >= 3 ? sameCat : others;
      const distractors = shuffle(distractPool).slice(0, 3).map(x => x.he);
      const options = shuffle([w.he].concat(distractors));
      return { word: w, options, answer: w.he };
    });
    quizState = { set, setIndex, questions, idx: 0, correct: 0, answered: false, selected: null };
    drawQuizQuestion();
  }

  function drawQuizQuestion() {
    app.innerHTML = "";
    const q = quizState.questions[quizState.idx];
    const total = quizState.questions.length;

    const head = el("div", "card");
    head.appendChild(el("h2", null, "מבחן: " + esc(quizState.set.categoryHe)));
    head.appendChild(el("div", "progress-bar",
      `<span style="width:${Math.round((quizState.idx) / total * 100)}%"></span>`));
    head.appendChild(el("p", "muted", `שאלה ${quizState.idx + 1} מתוך ${total}`));
    app.appendChild(head);

    const card = el("div", "card quiz-card");
    const qrow = el("div", "row-between");
    qrow.appendChild(el("div", "quiz-word", esc(q.word.en)));
    const play = el("button", "icon-btn", "🔊");
    play.onclick = () => Speech.speak(q.word.en);
    qrow.appendChild(play);
    card.appendChild(qrow);
    card.appendChild(el("p", "muted", "מה התרגום הנכון?"));

    const opts = el("div", "options");
    q.options.forEach(opt => {
      const b = el("button", "option", esc(opt));
      b.onclick = () => {
        if (quizState.answered) return;
        quizState.answered = true;
        quizState.selected = opt;
        const correct = opt === q.answer;
        if (correct) quizState.correct++;
        Storage.recordAnswer(correct);
        // סימון ויזואלי
        Array.from(opts.children).forEach(ch => {
          ch.classList.add("disabled");
          if (ch.textContent === q.answer) ch.classList.add("correct");
          else if (ch.textContent === opt) ch.classList.add("wrong");
        });
        nextBtn.style.display = "";
      };
      opts.appendChild(b);
    });
    card.appendChild(opts);

    const nextBtn = el("button", "btn primary wide",
      quizState.idx + 1 < total ? "השאלה הבאה ▸" : "סיום המבחן");
    nextBtn.style.display = "none";
    nextBtn.onclick = () => {
      if (quizState.idx + 1 < total) {
        quizState.idx++;
        quizState.answered = false;
        quizState.selected = null;
        drawQuizQuestion();
      } else {
        finishQuiz();
      }
    };
    card.appendChild(nextBtn);
    app.appendChild(card);
  }

  function finishQuiz() {
    const total = quizState.questions.length;
    const correct = quizState.correct;
    Storage.recordTest(quizState.setIndex, correct, total);
    const pct = Math.round(correct / total * 100);
    app.innerHTML = "";
    const c = el("div", "card result");
    c.appendChild(el("h2", null, "המבחן הסתיים 🎓"));
    c.appendChild(el("div", "big-score", pct + "%"));
    c.appendChild(el("p", null, `${correct} תשובות נכונות מתוך ${total}.`));
    c.appendChild(el("p", "muted",
      pct >= 85 ? "מצוין! שליטה יפה באוצר." :
      pct >= 60 ? "יפה מאוד. שווה לחזור על המילים ששגו." :
      "התחלה טובה – חזרה נוספת על האוצר תעזור מאוד."));
    const again = el("button", "btn wide", "🔁 מבחן חוזר על אותו אוצר");
    again.onclick = () => { quizState = null; renderQuiz(); };
    c.appendChild(again);
    const home = el("button", "btn primary wide", "לדף הבית");
    home.onclick = () => { quizState = null; go("home"); };
    c.appendChild(home);
    app.appendChild(c);
  }

  // ==================================================================
  // מסך לשון וזמנים (דקדוק)
  // ==================================================================
  function renderGrammar() {
    const lessons = window.GRAMMAR_LESSONS || [];
    const grammar = Scheduler.getGrammarStatus(lessons);
    app.innerHTML = "";

    const head = el("div", "card");
    head.appendChild(el("h2", null, "לשון וזמנים 📘"));
    if (grammar.active) {
      head.appendChild(el("p", null,
        `אנחנו בתוך שלושת ימי הלשון החודשיים (יום ${grammar.dayOfPeriod} מתוך 3).`));
    } else {
      head.appendChild(el("p", "muted",
        "מסלול הלשון נפתח אוטומטית ב-3 הימים הראשונים של כל חודש. בינתיים אפשר ללמוד כאן בכל עת."));
    }
    head.appendChild(el("p", "muted",
      "שלישיית השיעורים של החודש הנוכחי:"));
    const trioRow = el("div", "trio");
    grammar.trio.forEach((les, i) => {
      const t = el("button", "trio-item" + (grammar.todayLesson && grammar.todayLesson.id === les.id ? " active" : ""),
        `יום ${i + 1}<br><b>${esc(les.title)}</b>`);
      t.onclick = () => showLesson(les);
      trioRow.appendChild(t);
    });
    head.appendChild(trioRow);
    app.appendChild(head);

    // כל השיעורים לגלישה חופשית
    const listCard = el("div", "card");
    listCard.appendChild(el("h3", null, "כל השיעורים"));
    const list = el("div", "lesson-list");
    lessons.forEach(les => {
      const b = el("button", "lesson-link", esc(les.title));
      b.onclick = () => showLesson(les);
      list.appendChild(b);
    });
    listCard.appendChild(list);
    app.appendChild(listCard);
  }

  function showLesson(les) {
    app.innerHTML = "";
    const back = el("button", "btn small ghost", "↩ חזרה לשיעורים");
    back.onclick = () => renderGrammar();
    app.appendChild(back);

    const c = el("div", "card lesson");
    c.appendChild(el("h2", null, esc(les.title)));
    c.appendChild(el("p", "lesson-intro", esc(les.intro)));

    const ul = el("ul", "points");
    les.points.forEach(p => ul.appendChild(el("li", null, esc(p))));
    c.appendChild(ul);

    c.appendChild(el("h3", null, "דוגמאות"));
    const ex = el("div", "examples");
    les.examples.forEach(e => {
      const row = el("div", "example");
      const left = el("div", "ex-en");
      left.appendChild(el("span", null, esc(e.en)));
      const play = el("button", "icon-btn small", "🔊");
      play.onclick = () => Speech.speak(e.en);
      left.appendChild(play);
      row.appendChild(left);
      row.appendChild(el("div", "ex-he", esc(e.he)));
      ex.appendChild(row);
    });
    c.appendChild(ex);

    const done = el("button", "btn primary wide", "✓ סיימתי את השיעור");
    done.onclick = () => {
      Storage.recordGrammar();
      toast("השיעור נרשם כהושלם 📗");
      renderGrammar();
    };
    c.appendChild(done);
    app.appendChild(c);
  }

  // ==================================================================
  // מסך התקדמות
  // ==================================================================
  function renderProgress() {
    const ctx = computeContext();
    const s = ctx.state.stats;
    const total = ctx.words.length;
    const acc = s.questionsAsked ? Math.round(s.questionsCorrect / s.questionsAsked * 100) : 0;
    const coverage = total ? Math.round(s.wordsLearned / total * 100) : 0;
    app.innerHTML = "";

    const head = el("div", "card");
    head.appendChild(el("h2", null, "ההתקדמות שלי 📊"));
    const grid = el("div", "stat-grid big");
    grid.appendChild(statCell(s.wordsLearned, "מילים נלמדו"));
    grid.appendChild(statCell(total, "מילים במאגר"));
    grid.appendChild(statCell(s.questionsAsked, "שאלות נשאלו"));
    grid.appendChild(statCell(s.questionsCorrect, "תשובות נכונות"));
    grid.appendChild(statCell(acc + "%", "אחוז הצלחה"));
    grid.appendChild(statCell(s.testsCompleted, "מבחנים הושלמו"));
    grid.appendChild(statCell(s.grammarLessonsDone, "שיעורי לשון"));
    grid.appendChild(statCell(coverage + "%", "מהמאגר כוסה"));
    head.appendChild(grid);
    app.appendChild(head);

    // התקדמות במאגר
    const cov = el("div", "card");
    cov.appendChild(el("h3", null, "כיסוי המאגר"));
    cov.appendChild(el("div", "progress-bar big",
      `<span style="width:${coverage}%"></span>`));
    cov.appendChild(el("p", "muted", `${s.wordsLearned} / ${total} מילים`));
    app.appendChild(cov);

    // היסטוריית מבחנים
    const hist = el("div", "card");
    hist.appendChild(el("h3", null, "היסטוריית מבחנים"));
    if (!ctx.state.testHistory.length) {
      hist.appendChild(el("p", "muted", "עדיין לא הושלמו מבחנים."));
    } else {
      const tbl = el("div", "hist-list");
      ctx.state.testHistory.slice().reverse().slice(0, 12).forEach(h => {
        const p = h.total ? Math.round(h.correct / h.total * 100) : 0;
        const row = el("div", "hist-row");
        row.appendChild(el("span", null, esc(h.date)));
        row.appendChild(el("span", null, `${h.correct}/${h.total}`));
        row.appendChild(el("span", "hist-pct " + (p >= 85 ? "good" : p >= 60 ? "mid" : "low"), p + "%"));
        tbl.appendChild(row);
      });
      hist.appendChild(tbl);
    }
    app.appendChild(hist);

    const council = el("button", "btn primary wide", "לקבלת המלצות – מועצת קלוד ▸");
    council.onclick = () => go("council");
    app.appendChild(council);
  }

  // ==================================================================
  // מסך מועצת קלוד
  // ==================================================================
  function renderCouncil() {
    const ctx = computeContext();
    const result = Council.analyze({
      stats: ctx.state.stats,
      totalWords: ctx.words.length,
      elapsed: ctx.cycle.elapsed
    });
    app.innerHTML = "";

    const head = el("div", "card council-head");
    head.appendChild(el("h2", null, "🏛️ מועצת קלוד"));
    head.appendChild(el("p", "muted",
      "פאנל יועצים בוחן את ההתקדמות שלך ומגבש המלצות אישיות."));
    head.appendChild(el("div", "council-summary", esc(result.summary)));
    app.appendChild(head);

    const grid = el("div", "council-grid");
    result.advisors.forEach(a => {
      const c = el("div", "advisor tone-" + a.tone);
      const t = el("div", "advisor-top");
      t.appendChild(el("span", "advisor-icon", a.icon));
      t.appendChild(el("span", "advisor-name", esc(a.name)));
      c.appendChild(t);
      c.appendChild(el("p", "advisor-insight", esc(a.insight)));
      c.appendChild(el("p", "advisor-rec", "המלצה: " + esc(a.rec)));
      grid.appendChild(c);
    });
    app.appendChild(grid);

    const decision = el("div", "card decision");
    decision.appendChild(el("h3", null, "📌 החלטת המועצה – הצעד הבא שלך"));
    decision.appendChild(el("p", "decision-text", esc(result.priority)));
    const go1 = el("button", "btn primary", "יאללה, מתחילים ▸");
    go1.onclick = () => go(ctx.cycle.phase === "test" ? "quiz" : "vocab");
    decision.appendChild(go1);
    app.appendChild(decision);

    const refresh = el("button", "btn ghost wide", "🔄 כנס את המועצה מחדש");
    refresh.onclick = () => renderCouncil();
    app.appendChild(refresh);
  }

  // ==================================================================
  // מסך ייבוא / הרחבת המאגר
  // ==================================================================
  function renderImport() {
    app.innerHTML = "";
    const ctx = computeContext();

    const head = el("div", "card");
    head.appendChild(el("h2", null, "הרחבת המאגר ➕"));
    head.appendChild(el("p", "muted",
      `כרגע יש במאגר ${ctx.words.length} מילים ` +
      `(${(window.WORDS || []).length} בסיס + ${(ctx.state.customWords || []).length} שהוספת).`));
    app.appendChild(head);

    // ייבוא מהיר
    const imp = el("div", "card");
    imp.appendChild(el("h3", null, "הוספת מילים"));
    imp.appendChild(el("p", "muted",
      "אפשר להדביק CSV (שורה למילה: english,תעתיק,תרגום,תחום) או JSON. " +
      "התחומים הזמינים: " + (window.CATEGORIES || []).map(c => c.key).join(", ") + "."));

    const ta = el("textarea", "import-area");
    ta.placeholder =
      "דוגמת CSV:\nsugar,שׁוּגֶר,סוכר,kitchen\nsalt,סוֹלְט,מלח,kitchen\n\n" +
      "דוגמת JSON:\n[{\"en\":\"sugar\",\"pron\":\"שׁוּגֶר\",\"he\":\"סוכר\",\"cat\":\"kitchen\"}]";
    imp.appendChild(ta);

    // העלאת קובץ
    const fileRow = el("div", "row");
    const fileInput = el("input", "");
    fileInput.type = "file";
    fileInput.accept = ".csv,.json,.txt";
    fileInput.onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => { ta.value = r.result; };
      r.readAsText(f);
    };
    fileRow.appendChild(fileInput);
    imp.appendChild(fileRow);

    const addBtn = el("button", "btn primary", "הוסף למאגר");
    addBtn.onclick = () => {
      const parsed = parseImport(ta.value);
      if (!parsed.words.length) {
        toast("לא נמצאו מילים תקינות. בדקו את הפורמט.");
        return;
      }
      Storage.addCustomWords(parsed.words);
      toast(`נוספו ${parsed.words.length} מילים למאגר! 🎉`);
      renderImport();
    };
    imp.appendChild(addBtn);
    if ((ctx.state.customWords || []).length) {
      const clear = el("button", "btn ghost", "מחיקת כל המילים שהוספתי");
      clear.onclick = () => {
        if (confirm("למחוק את כל המילים שהוספת ידנית? (מילות הבסיס יישארו)")) {
          Storage.clearCustomWords();
          renderImport();
        }
      };
      imp.appendChild(clear);
    }
    app.appendChild(imp);

    // הסבר על עריכת הקוד
    const guide = el("div", "card");
    guide.appendChild(el("h3", null, "הרחבה דרך הקוד (לכמויות גדולות)"));
    guide.appendChild(el("p", null,
      "לעריכה קבועה של אלפי מילים, פתחו את הקובץ <code>data/words.js</code> " +
      "והוסיפו אובייקטים לרשימה <code>window.WORDS</code>. " +
      "כל אובייקט בפורמט:"));
    guide.appendChild(el("pre", "code",
      esc('{ en: "sugar", pron: "שׁוּגֶר", he: "סוכר", cat: "kitchen" }')));
    guide.appendChild(el("p", "muted",
      "המנוע יחלק אוטומטית כל תוספת לאוצרות של 25 לפי תחום, ויכניס אותם למחזור. " +
      "כך המערכת גדלה עד 50,000 מילים ומעבר."));
    app.appendChild(guide);
  }

  function parseImport(text) {
    text = (text || "").trim();
    const words = [];
    if (!text) return { words };
    // ניסיון JSON
    if (text[0] === "[" || text[0] === "{") {
      try {
        let data = JSON.parse(text);
        if (!Array.isArray(data)) data = [data];
        data.forEach(o => {
          if (o && o.en && o.he) {
            words.push({
              en: String(o.en).trim(),
              pron: String(o.pron || "").trim(),
              he: String(o.he).trim(),
              cat: String(o.cat || "objects").trim()
            });
          }
        });
        return { words };
      } catch (e) { /* ניפול ל-CSV */ }
    }
    // CSV / שורות
    text.split(/\r?\n/).forEach(line => {
      line = line.trim();
      if (!line) return;
      const parts = line.split(",").map(p => p.trim());
      if (parts.length >= 3 && parts[0]) {
        words.push({
          en: parts[0],
          pron: parts[1] || "",
          he: parts[2],
          cat: parts[3] || "objects"
        });
      }
    });
    return { words };
  }

  // ==================================================================
  // תשתית משותפת
  // ==================================================================
  function emptyCard(msg) {
    const c = el("div", "card");
    c.appendChild(el("p", "muted", msg));
    return c;
  }

  let toastTimer = null;
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = el("div", "toast");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  const screens = {
    home: renderHome,
    vocab: renderVocab,
    quiz: renderQuiz,
    grammar: renderGrammar,
    progress: renderProgress,
    council: renderCouncil,
    import: renderImport
  };

  function go(name) {
    currentScreen = name;
    if (name !== "quiz") quizState = null;   // איפוס מבחן ביציאה
    if (name !== "vocab") vocabViewSet = null;
    document.querySelectorAll(".nav-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.target === name));
    window.scrollTo(0, 0);
    (screens[name] || renderHome)();
  }

  // בניית סרגל הניווט
  function buildNav() {
    const nav = document.getElementById("nav");
    const items = [
      ["home", "🏠 בית"],
      ["vocab", "📖 אוצר מילים"],
      ["quiz", "📝 מבחן"],
      ["grammar", "📘 לשון וזמנים"],
      ["progress", "📊 התקדמות"],
      ["council", "🏛️ מועצת קלוד"],
      ["import", "➕ הרחבה"]
    ];
    items.forEach(([target, label]) => {
      const b = el("button", "nav-btn", label);
      b.dataset.target = target;
      b.onclick = () => go(target);
      nav.appendChild(b);
    });
  }

  // אתחול
  window.addEventListener("DOMContentLoaded", () => {
    buildNav();
    go("home");
  });
})();
