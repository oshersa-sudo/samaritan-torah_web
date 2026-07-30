/*
 * מאגר שיעורי הדקדוק והזמנים.
 * אחת לחודש, בשלושה ימים רצופים, המערכת מציגה שלושה שיעורים (יום אחד לכל שיעור).
 * כל חודש נבחרת שלישייה אחרת, במחזוריות, כדי לכסות בהדרגה את כל כללי הלשון והזמנים.
 * להרחבה – הוסיפו עוד אובייקטים של שיעור לרשימה.
 */
window.GRAMMAR_LESSONS = [
  {
    id: "present_simple",
    title: "Present Simple – הווה פשוט",
    intro: "משמש לתיאור עובדות, הרגלים ופעולות קבועות. למשל: אני עובד כל יום.",
    points: [
      "מבנה: Subject + verb (בגוף שלישי יחיד מוסיפים s).",
      "I / You / We / They + work. || He / She / It + works.",
      "שלילה: don't / doesn't + פועל בסיסי. למשל: He doesn't work.",
      "שאלה: Do / Does + נושא + פועל. למשל: Do you work?"
    ],
    examples: [
      { en: "I drink coffee every morning.", he: "אני שותה קפה כל בוקר." },
      { en: "She works in an office.", he: "היא עובדת במשרד." },
      { en: "They don't live here.", he: "הם לא גרים כאן." },
      { en: "Does he speak English?", he: "האם הוא מדבר אנגלית?" }
    ]
  },
  {
    id: "present_continuous",
    title: "Present Continuous – הווה מתמשך",
    intro: "משמש לפעולה שקורית ממש עכשיו, או בתקופה הנוכחית.",
    points: [
      "מבנה: am / is / are + פועל+ing.",
      "I am eating. || He is eating. || We are eating.",
      "שלילה: am not / isn't / aren't + פועל+ing.",
      "שאלה: Am / Is / Are + נושא + פועל+ing?"
    ],
    examples: [
      { en: "I am learning English now.", he: "אני לומד אנגלית עכשיו." },
      { en: "She is cooking dinner.", he: "היא מבשלת ארוחת ערב." },
      { en: "They are not sleeping.", he: "הם לא ישנים." },
      { en: "Are you working today?", he: "האם אתה עובד היום?" }
    ]
  },
  {
    id: "past_simple",
    title: "Past Simple – עבר פשוט",
    intro: "משמש לפעולה שהסתיימה בעבר בזמן מוגדר.",
    points: [
      "פעלים רגילים: מוסיפים ed. work → worked.",
      "פעלים לא רגילים: צורה מיוחדת. go → went, eat → ate, have → had.",
      "שלילה: didn't + פועל בסיסי. למשל: I didn't go.",
      "שאלה: Did + נושא + פועל בסיסי. למשל: Did you eat?"
    ],
    examples: [
      { en: "I visited my family yesterday.", he: "ביקרתי את משפחתי אתמול." },
      { en: "He went to work early.", he: "הוא הלך לעבודה מוקדם." },
      { en: "We didn't watch TV.", he: "לא צפינו בטלוויזיה." },
      { en: "Did she call you?", he: "האם היא התקשרה אליך?" }
    ]
  },
  {
    id: "future_will",
    title: "Future – עתיד (will / going to)",
    intro: "will לתחזיות והחלטות ספונטניות; going to לתוכניות וכוונות.",
    points: [
      "will + פועל בסיסי. למשל: I will help you.",
      "going to + פועל בסיסי. למשל: I am going to travel.",
      "שלילה: won't / am not going to.",
      "שאלה: Will you...? / Are you going to...?"
    ],
    examples: [
      { en: "I will call you tomorrow.", he: "אתקשר אליך מחר." },
      { en: "We are going to buy a car.", he: "אנחנו הולכים לקנות מכונית." },
      { en: "It won't rain today.", he: "לא יירד גשם היום." },
      { en: "Will you come to the meeting?", he: "האם תבוא לפגישה?" }
    ]
  },
  {
    id: "present_perfect",
    title: "Present Perfect – הווה מושלם",
    intro: "פעולה שהתחילה בעבר ורלוונטית להווה, או ניסיון חיים ללא זמן מוגדר.",
    points: [
      "מבנה: have / has + Past Participle. eat → eaten, do → done.",
      "מילים נפוצות: already, yet, ever, never, just, since, for.",
      "שלילה: haven't / hasn't + Past Participle.",
      "שאלה: Have / Has + נושא + Past Participle?"
    ],
    examples: [
      { en: "I have finished my work.", he: "סיימתי את העבודה שלי." },
      { en: "She has never been to London.", he: "היא מעולם לא הייתה בלונדון." },
      { en: "We haven't eaten yet.", he: "עדיין לא אכלנו." },
      { en: "Have you seen this movie?", he: "האם ראית את הסרט הזה?" }
    ]
  },
  {
    id: "articles",
    title: "Articles – a / an / the",
    intro: "מילות היידוע והסתמיות באנגלית – מתי משתמשים בכל אחת.",
    points: [
      "a לפני עיצור: a book. an לפני תנועה: an apple.",
      "the ליידוע – כשידוע על מה מדברים: the car (המכונית הספציפית).",
      "בלי מילית לרבים כללי: I like books (אני אוהב ספרים בכלל).",
      "לא משתמשים ב-a/an עם שם בלתי ספיר: water, money, information."
    ],
    examples: [
      { en: "I bought a car and the car is red.", he: "קניתי מכונית והמכונית אדומה." },
      { en: "She is an engineer.", he: "היא מהנדסת." },
      { en: "The sun is bright.", he: "השמש בהירה." },
      { en: "I need information.", he: "אני צריך מידע." }
    ]
  },
  {
    id: "prepositions",
    title: "Prepositions of time – in / on / at",
    intro: "מילות יחס לזמן – טעות נפוצה מאוד אצל דוברי עברית.",
    points: [
      "at לשעה: at 8 o'clock, at night.",
      "on ליום/תאריך: on Monday, on July 30th.",
      "in לחודש/שנה/חלק יום: in June, in 2026, in the morning.",
      "זכרו: at night אבל in the morning / in the evening."
    ],
    examples: [
      { en: "The meeting is at 9 in the morning.", he: "הפגישה בתשע בבוקר." },
      { en: "I was born in 1990.", he: "נולדתי ב-1990." },
      { en: "We travel on Sunday.", he: "אנחנו נוסעים ביום ראשון." },
      { en: "He works at night.", he: "הוא עובד בלילה." }
    ]
  },
  {
    id: "comparatives",
    title: "Comparatives & Superlatives – השוואה",
    intro: "איך אומרים 'יותר גדול' ו'הכי גדול'.",
    points: [
      "מילה קצרה: +er / +est. big → bigger → the biggest.",
      "מילה ארוכה: more / most. important → more important → the most important.",
      "יוצאים מן הכלל: good → better → best. bad → worse → worst.",
      "משתמשים ב-than בהשוואה: bigger than."
    ],
    examples: [
      { en: "This car is faster than that one.", he: "המכונית הזו מהירה מזו." },
      { en: "She is the tallest in the class.", he: "היא הכי גבוהה בכיתה." },
      { en: "English is more useful than I thought.", he: "אנגלית שימושית יותר משחשבתי." },
      { en: "Today is better than yesterday.", he: "היום טוב יותר מאתמול." }
    ]
  },
  {
    id: "modals",
    title: "Modal verbs – can / must / should",
    intro: "פעלים עזר להבעת יכולת, חובה והמלצה.",
    points: [
      "can – יכולת/אפשרות: I can swim.",
      "must – חובה חזקה: You must stop.",
      "should – המלצה: You should rest.",
      "אחרי modal תמיד פועל בסיסי, בלי to ובלי s."
    ],
    examples: [
      { en: "I can speak a little English.", he: "אני יכול לדבר קצת אנגלית." },
      { en: "You must wear a seatbelt.", he: "אתה חייב לחגור חגורה." },
      { en: "You should drink water.", he: "כדאי לך לשתות מים." },
      { en: "Can you help me?", he: "אתה יכול לעזור לי?" }
    ]
  },
  {
    id: "questions_wh",
    title: "WH Questions – מילות שאלה",
    intro: "בניית שאלות פתוחות באנגלית.",
    points: [
      "What (מה), Where (איפה), When (מתי), Who (מי), Why (למה), How (איך).",
      "מבנה: WH + פועל עזר + נושא + פועל. Where do you live?",
      "How much (כמה – בלתי ספיר), How many (כמה – ספיר).",
      "Why → כי (because) בתשובה."
    ],
    examples: [
      { en: "Where do you live?", he: "איפה אתה גר?" },
      { en: "What time is it?", he: "מה השעה?" },
      { en: "Why are you late?", he: "למה אתה מאחר?" },
      { en: "How many children do you have?", he: "כמה ילדים יש לך?" }
    ]
  },
  {
    id: "plural_nouns",
    title: "Plural nouns – רבים",
    intro: "יצירת צורת רבים של שמות עצם.",
    points: [
      "רגיל: +s. book → books.",
      "אחרי s/x/ch/sh: +es. box → boxes, watch → watches.",
      "y אחרי עיצור → ies. baby → babies.",
      "יוצאים מן הכלל: man → men, woman → women, child → children, foot → feet."
    ],
    examples: [
      { en: "I have three cars.", he: "יש לי שלוש מכוניות." },
      { en: "There are many boxes here.", he: "יש כאן הרבה קופסאות." },
      { en: "The children are playing.", he: "הילדים משחקים." },
      { en: "My feet hurt.", he: "כפות הרגליים שלי כואבות." }
    ]
  },
  {
    id: "possessive",
    title: "Possessive – שייכות",
    intro: "איך מביעים בעלות ושייכות באנגלית.",
    points: [
      "'s ליחיד: John's car (המכונית של ג'ון).",
      "s' לרבים שמסתיים ב-s: the students' books.",
      "כינויי שייכות: my, your, his, her, its, our, their.",
      "of לרוב לחפצים: the color of the car."
    ],
    examples: [
      { en: "This is my brother's house.", he: "זה הבית של אחי." },
      { en: "Her name is Sarah.", he: "שמה שרה." },
      { en: "The dog's tail is long.", he: "הזנב של הכלב ארוך." },
      { en: "That is their car.", he: "זו המכונית שלהם." }
    ]
  }
];
