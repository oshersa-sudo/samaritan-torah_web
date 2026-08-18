# -*- coding: utf-8 -*-
"""
עקומת האוכלוסייה השומרונית לאורך הדורות.

kind:
  census   — מניין מתועד (סקר אוכלוסין, מפקד, ספירה בפועל)
  estimate — אומדן מחקרי; הטווח מצוין בהערה

בין 634 ל‎-1180 אין בידינו מספר כלשהו: הקו באותו קטע הוא אינטרפולציה בלבד,
והאפליקציה מציירת אותו כקו מקווקו כדי שלא ייראה כנתון.
"""

SRC_BOOK = 'בנימים צדקה, "קיצור תולדות הישראלים־השומרונים עפ״י המחקר"'
SRC_WEB = "מכון המידע הישראלי־שומרוני (israelite-samaritans.com) וּויקיפדיה"

# (שנה, מספר נפשות, kind, הערה)
POPULATION = [
    (400, 1000000, "estimate",
     "שיא העוצמה המספרית, בין תקופת בבא רבה למרידות הגדולות. החוקרים נוטים לאמוד "
     "את השומרונים בשיאם ב‎300,000 עד 500,000 נפש, אך בעל הספר טוען שגם הערכה זו "
     "נמוכה מדי: עם שהוציא מתוכו צבא שאיבד לפחות 100,000 מחייליו במרידה אחת — "
     "״אפשר שההערכה הכוללת של כוחו המספרי מגיעה ואף עוברת את מיליון הנפשות״."),
    (484, 900000, "estimate",
     "ערב המרידה הגדולה הראשונה בביזנטים."),
    (530, 400000, "estimate",
     "מיד לאחר המרידה הגדולה של 529, שבה איבדו השומרונים כמאה אלף איש: 50,000 "
     "נפלו בקרב, 30,000 נמכרו לעבדות ו‎-20,000 נמלטו אל תחום השלטון הפרסי."),
    (634, 300000, "estimate",
     "״האומדן של 300,000 שומרונים יתאים יותר על כן להערכת כוחם המספרי של השומרונים "
     "אחרי המרידות ולא לפניהן. בכח מספרי זה היו השומרונים ערב הכיבוש הערבי את "
     "ארץ־ישראל, במחצית הראשונה של המאה השביעית לספירה.״"),
    (1180, 1900, "estimate",
     "אומדן בנימין מטודלה למאה ה‎-12. הספר מונה כ‎-1,500 שומרונים בערי ארץ־ישראל — "
     "200 בקיסריה, 300 באשקלון ו‎-300 בשכם — ומעיר שאין הם כוללים את שומרוני הכפרים. "
     "מה אירע בין המאה השביעית למאה ה‎-12 אינו מתועד במספרים."),
    (1780, 150, "estimate",
     "לקראת סוף המאה השמונה־עשרה לא נותרו שומרונים בארץ־ישראל ובסביבתה אלא בשכם "
     "בלבד — פחות מ‎-150 נפשות, בשבעה בתי אב, בשכונת יסמין."),
    (1855, 160, "estimate",
     "הקהילה נעה בין 150 ל‎-170 נפש, בחרדה מפני כיליון ביולוגי."),
    (1917, 146, "census",
     "הנקודה הנמוכה ביותר בתולדות הקהילה, בשנת המעבר מן השלטון התורכי לבריטי."),
    (1919, 141, "census",
     "סקר האוכלוסין של מכון א.ב. ל‎-1 במרץ 1919: 141 נפש, בשכם וביפו."),
    (1948, 250, "census", "192 בשכם ו‎-58 בתל־אביב־יפו, בשנת הקמת המדינה וניתוק הקהילה."),
    (1954, 313, "census", "226 בשכם ו‎-87 בחולון — השנה שבה הוקמה השכונה בחולון."),
    (1969, 414, "census", "227 זכרים ו‎-187 נקבות, בשנת ייסוד העיתון א.ב."),
    (1977, 595, "census", "עשור לאחר איחוד שני חלקי הקהילה."),
    (2000, 625, "census", "301 בקרית לוזה ו‎-324 בחולון, ב‎-1 בינואר 2000."),
    (2009, 723, "census", "341 בשכם ובהרגריזים ו‎-382 בחולון."),
    (2013, 756, "census", "357 בקרית לוזה ו‎-399 בחולון."),
    (2021, 840, "census", "460 בחולון ו‎-380 בקרית לוזה."),
    (2024, 900, "estimate", "כ‎-900 נפש — פי שישה מן השפל של 1917. מספר מעוגל, ולא מפקד מדויק."),
]

SRC = {
    400: SRC_BOOK, 484: SRC_BOOK, 530: SRC_BOOK, 634: SRC_BOOK, 1180: SRC_BOOK,
    1780: SRC_BOOK, 1855: SRC_BOOK, 1917: SRC_BOOK, 1948: SRC_BOOK, 1954: SRC_WEB,
    1969: SRC_BOOK, 1977: SRC_BOOK, 2000: SRC_BOOK,
    1919: SRC_WEB, 2009: SRC_WEB, 2013: SRC_WEB, 2021: SRC_WEB, 2024: SRC_WEB,
}

# תרגומי ההערות
POP_T = {
400: ("Peak numerical strength, between the age of Baba Rabbah and the great revolts. "
      "Scholars tend to estimate the Samaritans at their height at 300,000 to 500,000; "
      "the author of the book argues that even this is too low: a people that fielded an army "
      "which lost at least 100,000 of its soldiers in a single revolt — “it may be that the "
      "overall estimate of its numerical strength reaches and even passes a million souls.”",
      "ذروة القوة العددية، بين عصر بابا ربّه والثورات الكبرى. يميل الباحثون إلى تقدير "
      "السامريين في أوجهم بين 300,000 و500,000 نسمة، لكن مؤلف الكتاب يرى أن هذا التقدير "
      "أيضاً أقل من الواقع: شعب أخرج جيشاً فقد مئة ألف من جنوده في ثورة واحدة — «ربما بلغ "
      "التقدير الإجمالي لقوته العددية مليون نسمة بل تجاوزه»."),
484: ("On the eve of the first great revolt against the Byzantines.",
      "عشية الثورة الكبرى الأولى على البيزنطيين."),
530: ("Immediately after the great revolt of 529, in which the Samaritans lost some hundred "
      "thousand: 50,000 fell in battle, 30,000 were sold into slavery and 20,000 fled to "
      "Persian territory.",
      "مباشرة بعد الثورة الكبرى سنة 529، التي فقد فيها السامريون نحو مئة ألف: 50,000 سقطوا في "
      "القتال، و30,000 بيعوا عبيداً، و20,000 فرّوا إلى أرض الفرس."),
634: ("“The estimate of 300,000 Samaritans therefore fits better the assessment of their "
      "numerical strength after the revolts rather than before them. With this numerical "
      "force the Samaritans stood on the eve of the Arab conquest of the Land of Israel, in "
      "the first half of the seventh century.”",
      "«لذلك فإن تقدير 300,000 سامري يناسب أكثر تقييم قوتهم العددية بعد الثورات لا قبلها. "
      "وبهذه القوة العددية كان السامريون عشية الفتح العربي للبلاد، في النصف الأول من القرن "
      "السابع الميلادي»."),
1180: ("Benjamin of Tudela’s estimate for the 12th century. The book counts some 1,500 "
       "Samaritans in the cities of the Land — 200 in Caesarea, 300 in Ashkelon and 300 in "
       "Shechem — and notes that these do not include the village Samaritans. What happened "
       "between the seventh century and the twelfth is not documented in numbers.",
       "تقدير بنيامين التطيلي للقرن الثاني عشر. ويحصي الكتاب نحو 1,500 سامري في مدن البلاد — "
       "200 في قيسارية و300 في عسقلان و300 في شكيم — وينبّه إلى أنها لا تشمل سامريي القرى. "
       "أما ما جرى بين القرن السابع والثاني عشر فغير موثّق بالأرقام."),
1780: ("Towards the end of the eighteenth century no Samaritans remained in the Land or its "
       "surroundings except in Shechem — fewer than 150 souls, in seven clans, in the Yasmin quarter.",
       "في أواخر القرن الثامن عشر لم يبقَ سامريون في البلاد وما حولها إلا في شكيم — أقل من 150 "
       "نفساً، في سبعة بيوت، في حيّ الياسمين."),
1855: ("The community ranged between 150 and 170 souls, in dread of biological extinction.",
       "تراوح عدد الجماعة بين 150 و170 نفساً، في خوف من الفناء البيولوجي."),
1917: ("The lowest point in the history of the community, in the year of the transition from "
       "Turkish to British rule.",
       "أدنى نقطة في تاريخ الجماعة، في سنة الانتقال من الحكم التركي إلى البريطاني."),
1919: ("The A.B. Institute population survey for 1 March 1919: 141 souls, in Shechem and Jaffa.",
       "تعداد معهد «أ.ب» في 1 آذار 1919: 141 نفساً، في شكيم ويافا."),
1948: ("192 in Shechem and 58 in Tel Aviv-Jaffa, in the year the state was founded and the "
       "community severed.",
       "192 في شكيم و58 في تل أبيب-يافا، في سنة قيام الدولة وانقطاع الجماعة."),
1954: ("226 in Shechem and 87 in Holon — the year the Holon quarter was founded.",
       "226 في شكيم و87 في حولون — السنة التي أُسّس فيها حيّ حولون."),
1969: ("227 males and 187 females, in the year the newspaper A.B. was founded.",
       "227 ذكراً و187 أنثى، في سنة تأسيس صحيفة «أ.ب»."),
1977: ("A decade after the reunion of the two halves of the community.",
       "بعد عقد من لمّ شمل شطري الجماعة."),
2000: ("301 in Kiryat Luza and 324 in Holon, on 1 January 2000.",
       "301 في كريات لوزة و324 في حولون، في 1 كانون الثاني 2000."),
2009: ("341 in Shechem and on Mount Gerizim, 382 in Holon.",
       "341 في شكيم وجبل جريزيم، و382 في حولون."),
2013: ("357 in Kiryat Luza and 399 in Holon.", "357 في كريات لوزة و399 في حولون."),
2021: ("460 in Holon and 380 in Kiryat Luza.", "460 في حولون و380 في كريات لوزة."),
2024: ("About 900 souls — sixfold the nadir of 1917.", "نحو 900 نفس — ستة أضعاف حضيض 1917."),
}
