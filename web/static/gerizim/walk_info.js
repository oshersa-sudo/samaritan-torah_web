/* הסיור הרגלי: מה מייצג כל מבנה, מי בנה אותו ומתי, ומה ידוע מן החפירה לעומת מה שמשוער.
   tags — שיוך וביסוס; zone — השיוך של כל אזור בסיור; marks — שלטים למבנים שאינם אזור הליכה;
   hang — כתובות שמקום מציאתן המדויק אינו רשום כאן, והן תלויות במקום משוער באותו חלק של האתר. */
(function () {
  const t = (he, en, ar) => ({ he, en, ar });
  window.GERIZIM_WALK_INFO = {
    tags: {
      samhel: { col: '#d9b25f', text: t('בנייה שומרונית · התקופה ההלניסטית, המאה ה-2 לפנה"ס · נחפר', 'Samaritan building · Hellenistic period, 2nd century BCE · excavated', 'بناء سامري · الفترة الهلنستية، القرن الثاني ق.م · منقَّب') },
      samper: { col: '#7fa6c9', text: t('בנייה שומרונית · התקופה הפרסית, המאה ה-5 לפנה"ס · נחפר', 'Samaritan building · Persian period, 5th century BCE · excavated', 'بناء سامري · الفترة الفارسية، القرن الخامس ق.م · منقَّب') },
      trad: { col: '#8fb27a', text: t('מקום קדוש במסורת השומרונית', 'A holy place in Samaritan tradition', 'مكان مقدّس في التقليد السامري') },
      guess: { col: '#c9a0a0', text: t('לפי הצעת החופר · לא נמצא בחפירה', 'As the excavator proposes · not found in the excavation', 'بحسب اقتراح المنقّب · لم يُعثر عليه في التنقيب') },
      way: { col: '#b9ad93', text: t('דרך משוערת · לא נחפרה', 'A conjectured way · not excavated', 'طريق افتراضي · لم يُنقَّب') },
      inside: { col: '#d9b25f', text: t('בנייה שומרונית · התקופה ההלניסטית · הקירות נחפרו; הריהוט ומראה הפנים משוערים, לפי מבנים דומים מן התקופה', 'Samaritan building · Hellenistic period · the walls were excavated; the furnishing and the look of the interior are conjecture, after similar buildings of the period', 'بناء سامري · الفترة الهلنستية · الجدران منقَّبة؛ أمّا الأثاث وهيئة الداخل فافتراضيان، قياسًا على مبانٍ مشابهة من الفترة') }
    },
    // אזור שאינו כאן מקבל את השיוך לפי התקופה המוצגת
    zone: { abath: 'inside', altar: 'guess', stones12: 'trad', eternal: 'trad', road: 'way', ngateP: 'samper', ashes: 'samper', lishka: 'samper', citroom: 'inside', aroom: 'inside', b2hall: 'inside' },
    marks: [
      { id: 'nwtower', n: 88, e: 3, per: 'h', place: 'nwtower', name: t('המגדל הצפון-מערבי', 'The north-western tower', 'البرج الشمالي الغربي'),
        text: t('מגדל בפינה הצפון-מערבית של חומת המתחם ההלניסטי. מהלך קירותיו נחפר; גובהו כאן משוער.', 'A tower at the north-western corner of the wall of the Hellenistic precinct. The line of its walls was excavated; its height here is conjecture.', 'برج في الزاوية الشمالية الغربية لسور الحرم الهلنستي. مسار جدرانه منقَّب؛ أمّا ارتفاعه هنا فافتراضي.') },
      { id: 'netower', n: 86, e: 88, per: 'h', name: t('מגדל הפינה הצפון-מזרחית', 'The north-eastern corner tower', 'برج الزاوية الشمالية الشرقية'),
        text: t('מגדל בפינה שבה נפגשות החומה הצפונית והחומה המזרחית של המתחם ההלניסטי. גובהו כאן משוער.', 'A tower at the corner where the northern and the eastern walls of the Hellenistic precinct meet. Its height here is conjecture.', 'برج في الزاوية التي يلتقي فيها السور الشمالي والسور الشرقي للحرم الهلنستي. ارتفاعه هنا افتراضي.') },
      { id: 'stairtower', n: 33, e: 104, per: 'h', place: 'eaststairs', name: t('המגדל שמדרום לגרם המדרגות', 'The tower south of the staircase', 'البرج جنوبي الدرج'),
        text: t('מגדל של כ-10 על 11 מ\', הצמוד לגרם המדרגות המונומנטלי מדרום ושומר על העלייה אל השער המזרחי.', 'A tower of about 10 by 11 m, adjoining the monumental staircase on the south and guarding the ascent to the eastern gate.', 'برج نحو 10 × 11 م، ملاصق للدرج الضخم من الجنوب ويحرس الصعود إلى البوابة الشرقية.') },
      { id: 'entrtower', n: -43.5, e: 21, per: 'h', place: 'westentrance', name: t('מגדל הכניסה המערבית', 'The tower of the western entrance', 'برج المدخل الغربي'),
        text: t('מגדל של 8.5 על 9 מ\' לצד המדרגות העולות מן העיר אל המתחם.', 'A tower of 8.5 by 9 m beside the steps that climb from the city to the precinct.', 'برج 8.5 × 9 م إلى جانب الدرج الصاعد من المدينة إلى الحرم.') },
      { id: 'rooms', n: 6.5, e: 82, per: 'h', name: t('שורת החדרים שלפנים החומה המזרחית', 'The row of rooms inside the eastern wall', 'صف الغرف داخل السور الشرقي'),
        text: t('חדרים הנשענים על החומה המזרחית מבפנים. מה היה בהם אינו ידוע; הפתחים והסככות משוערים.', 'Rooms built against the inner face of the eastern wall. What they held is not known; the doorways and awnings are conjecture.', 'غرف مستندة إلى السور الشرقي من الداخل. لا يُعرف ما كان فيها؛ والأبواب والمظلات افتراضية.') },
      { id: 'buildingJ', n: -103, e: 30, per: 'h', place: 'buildingJ', name: t('מבנה הציבור הדרומי', 'The southern public building', 'المبنى العام الجنوبي'),
        text: t('מבנה גדול, כ-30 על 40 מ\', שסגר את המתחם מדרום. חלוקתו הפנימית אינה מוצגת.', 'A large building, about 30 by 40 m, which closed the precinct on the south. Its inner division is not shown.', 'مبنى كبير، نحو 30 × 40 م، كان يغلق الحرم من الجنوب. تقسيمه الداخلي غير معروض.') },
      { id: 'southpublic', n: -80, e: 3, per: 'h', place: 'city', name: t('מבנה הציבור שמדרום לרחוב', 'The public building south of the street', 'المبنى العام جنوبي الشارع'),
        text: t('מבנה גדול הפונה אל הרחוב שלרגלי הכניסה המערבית. ייעודו המדויק אינו ידוע; הפתחים והסככות משוערים.', 'A large building facing the street at the foot of the western entrance. Its exact purpose is not known; the doorways and awnings are conjecture.', 'مبنى كبير يطلّ على الشارع عند أسفل المدخل الغربي. غايته بدقّة غير معروفة؛ والأبواب والمظلات افتراضية.') },
      { id: 'eastquarter', n: 75, e: 112, per: 'h', place: 'eaststairs', name: t('רובע המגורים שליד הרחוב המזרחי', 'The residential quarter by the eastern street', 'الحيّ السكني عند الشارع الشرقي'),
        text: t('בתי מגורים משני צדי הרחוב המרוצף שהוביל אל השער התחתון. חלוקת הבתים כאן סכמטית.', 'Dwellings on both sides of the paved street that led to the lower gate. The division into houses here is schematic.', 'بيوت سكنية على جانبي الشارع المبلّط المؤدي إلى البوابة السفلى. تقسيم البيوت هنا تخطيطي.') },
      { id: 'towerL', n: -225.5, e: 97, per: 'h', place: 'areaA', name: t('המגדל וקיר ההגנה של הרובע המערבי', 'The tower and defence wall of the western quarter', 'برج الحيّ الغربي وجدار دفاعه'),
        text: t('קיר הדומה לקיר סוגרים ובקצהו מגדל הגנו על הרובע מדרום, יחד עם הקירות החיצוניים של הבתים.', 'A casemate-like wall with a tower at its end defended the quarter on the south, together with the outer walls of the houses.', 'جدار شبيه بجدار الغرف المحصّنة وفي طرفه برج كانا يحميان الحيّ من الجنوب، مع الجدران الخارجية للبيوت.') },
      { id: 'temple', n: 36.5, e: 31, only: 'temple', name: t('בניין המקדש — הצעת החופר', 'The temple building — the excavator\'s proposal', 'مبنى الهيكل — اقتراح المنقّب'), tag: 'guess',
        text: t('החופר מציע שכאן עמד בניין מקדש. הבניין עצמו לא נמצא בחפירה, ובמסורת השומרונית לא עמד בהר בניין מקדש. לכן הוא מוצג רק כשמבקשים, כגוף שקוף.', 'The excavator proposes that a temple building stood here. The building itself was not found in the excavation, and in Samaritan tradition no temple building stood on the mountain. It is therefore shown only on request, as a transparent mass.', 'يقترح المنقّب أنّ مبنى هيكل قام هنا. المبنى نفسه لم يُعثر عليه في التنقيب، وفي التقليد السامري لم يقم على الجبل مبنى هيكل. لذلك لا يُعرض إلا عند الطلب، ككتلة شفافة.') }
    ],
    hang: { 1: [60.3, 112], 11: [60.3, 117], sundial: [62, 86] },
    /* לוחות שם חקוקים על חזיתות המבנים המרכזיים: תוספת של הסיור, בסגנון לוחות ההקדשה מן התקופה. לוחות כאלה לא נמצאו בחפירה.
       n, e — נקודה על פני הקיר; face — לאן הקיר פונה; ref — האזור או המבנה שהלוח מזהה. */
    plates: [
      { ref: 'ngate', n: 80.5, e: 44, face: 's', per: 'h' },
      { ref: 'egate', n: 48.7, e: 82, face: 'w', per: 'h' },
      { ref: 'lgate', n: 47.7, e: 123.4, face: 'n', per: 'h' },
      { ref: 'stairtower', n: 33, e: 99, face: 'w', per: 'h' },
      { ref: 'citadel', n: -9, e: 79, face: 'n', per: 'h' },
      { ref: 'enclosure', n: 0, e: 31, face: 'n', per: 'h' },
      { ref: 'entrtower', n: -44, e: 25.7, face: 'e', per: 'h' },
      { ref: 'rooms', n: 6, e: 84, face: 'w', per: 'h' },
      { ref: 'eastquarter', n: 75, e: 121.5, face: 'e', per: 'h' },
      { ref: 'buildingJ', n: -100, e: 32.5, face: 'w', per: 'h', size: 1.5 },
      { ref: 'southpublic', n: -63, e: 3, face: 'n', per: 'h' },
      { ref: 'pressyard', n: -55, e: -24.5, face: 's', per: 'h' },
      { ref: 'house', n: -63, e: -28, face: 'n', per: 'h' },
      { ref: 'ayard', n: -208, e: 26.4, face: 's', per: 'h' },
      { ref: 'market', n: -321, e: 49, face: 's', per: 'h' },
      { ref: 'b2yard', n: -345.4, e: 52, face: 'w', per: 'h' },
      { ref: 'sgate', n: -418.5, e: 46.05, face: 's', per: 'h', size: 0.8 },
      { ref: 'ngateP', n: 80.5, e: 46.6, face: 's', per: 'p' },
      { ref: 'ashes', n: 80.5, e: 62, face: 's', per: 'p' },
      { ref: 'lishka', n: 5.5, e: 12.3, face: 'e', per: 'p' }
    ],
    // נקודות עניין: מקומות שאין להם חזית לשלט, והם מזוהים בשכבת השילוט של הסיור
    poi: ['altar', 'stones12', 'eternal', 'plaza', 'court1', 'court2', 'stairs', 'temple'],
    // המסלולים המרכזיים, לפי [n, e]
    routes: [
      { id: 'pilgrim', per: 'h', col: '#c8892a', stone: '#f1ead6', name: t('דרך העולים: מן השער התחתון אל המזבח', 'The pilgrims\' way: from the lower gate to the altar', 'طريق الحجّاج: من البوابة السفلى إلى المذبح'),
        pts: [[92, 126.5], [48.5, 127], [41.4, 127], [41.4, 121], [49.5, 116], [49.7, 108], [49.7, 99.5], [44, 98.2], [44, 92], [44, 86], [44, 78], [41, 75.5]] },
      { id: 'city', per: 'h', col: '#3f7fa8', stone: '#4f4a42', name: t('דרך העיר: מן הכניסה המערבית אל שער העיר הדרומי', 'The city way: from the western entrance to the southern city gate', 'طريق المدينة: من المدخل الغربي إلى بوابة المدينة الجنوبية'),
        pts: [[-43.5, 49], [-43.5, 35.7], [-50, 29], [-59.5, 22.5], [-166, 22.5], [-167.5, -16.5], [-208, -16.5], [-209.5, -16.5], [-209.5, 84], [-328, 84], [-328, 70], [-330, 49], [-339, 49], [-410, 49], [-444, 49]] }
    ],
    // שמות קצרים למפה
    mapNames: {
      plaza: t('רחבת המתחם', 'The court', 'ساحة الحرم'), altar: t('המזבח', 'The altar', 'المذبح'), stones12: t('שתים עשרה האבנים', 'The Twelve Stones', 'الاثنا عشر حجرًا'),
      egate: t('השער המזרחי', 'East gate', 'البوابة الشرقية'), stairs: t('גרם המדרגות', 'The staircase', 'الدرج'), lgate: t('השער התחתון', 'Lower gate', 'البوابة السفلى'),
      ngate: t('השער הצפוני', 'North gate', 'البوابة الشمالية'), ngateP: t('השער הצפוני', 'North gate', 'البوابة الشمالية'), ashes: t('בית הדשן', 'House of ashes', 'بيت الرماد'), lishka: t('לשכות הפינה', 'Corner chambers', 'غرف الزاوية'),
      citadel: t('המצודה', 'The citadel', 'القلعة'), enclosure: t('המתחם המבוצר', 'Fortified compound', 'المجمّع المحصّن'), wentrance: t('הכניסה המערבית', 'West entrance', 'المدخل الغربي'),
      pressyard: t('האחוזה ובית הבד', 'Mansion and oil press', 'الدار والمعصرة'), eternal: t('גבעת עולם', 'The Eternal Hill', 'التلة الأبدية'), court1: t('חצרות עולי הרגל', 'Pilgrims\' courts', 'ساحات الحجّاج'),
      ayard: t('הבית הגדול', 'The great house', 'البيت الكبير'), astreet: t('הרובע המערבי', 'Western quarter', 'الحيّ الغربي'), market: t('השוק', 'The market', 'السوق'),
      b2yard: t('בית הסטיו', 'Portico house', 'بيت الرواق'), bstreet: t('הרחוב הראשי', 'Main street', 'الشارع الرئيس'), sgate: t('שער העיר', 'City gate', 'بوابة المدينة'), estreet: t('הרחוב המזרחי', 'East street', 'الشارع الشرقي')
    },
    // מה משוער בכל סוג של מקום (מוצג בכרטיס המידע)
    guess: {
      samhel: t('שחזור משוער כאן: גובה הקירות, הגגות, מקום הפתחים והחלונות, צבע הטיח, החפצים והדמויות.', 'Conjectured here: the height of the walls, the roofs, the place of doors and windows, the colour of the plaster, the objects and the figures.', 'افتراضي هنا: ارتفاع الجدران، والسقوف، وموضع الأبواب والنوافذ، ولون الطلاء، والأغراض والشخوص.'),
      samper: t('שחזור משוער כאן: גובה הקירות, הגגות, מקום הפתחים, החפצים והדמויות.', 'Conjectured here: the height of the walls, the roofs, the place of the doorways, the objects and the figures.', 'افتراضي هنا: ارتفاع الجدران، والسقوف، وموضع الأبواب، والأغراض والشخوص.'),
      inside: t('שחזור משוער כאן: הריהוט, כלי הבית, התקרה ומקום הפתח המדויק.', 'Conjectured here: the furniture, the household vessels, the ceiling and the exact place of the doorway.', 'افتراضي هنا: الأثاث، وأواني البيت، والسقف، وموضع الباب بدقّة.'),
      guess: t('שחזור משוער כאן: המבנה כולו — מקומו, מידותיו וצורתו.', 'Conjectured here: the whole structure — its place, its size and its form.', 'افتراضي هنا: المنشأة كلها — موضعها وقياساتها وشكلها.'),
      way: t('שחזור משוער כאן: מהלך הדרך, המדרגות והשיפוע המדויק.', 'Conjectured here: the course of the way, the steps and the exact gradient.', 'افتراضي هنا: مسار الطريق، والدرجات، والانحدار بدقّة.'),
      trad: t('המקום מזוהה לפי מסורת העדה; מה שמוצג סביבו משוער.', 'The place is identified by the community\'s tradition; what is shown around it is conjecture.', 'المكان معيَّن بحسب تقليد الطائفة؛ وما يُعرض حوله افتراضي.')
    },
    plateNote: t('לוחות השם שעל חזיתות המבנים הם תוספת של הסיור, בסגנון לוחות אבן חקוקים מן התקופה; לוחות כאלה לא נמצאו בחפירה.', 'The name tablets on the facades are an addition of this tour, in the manner of carved stone tablets of the period; no such tablets were found in the excavation.', 'ألواح الأسماء على واجهات المباني إضافة من هذه الجولة، على طراز الألواح الحجرية المنقوشة في تلك الفترة؛ ولم يُعثر على ألواح كهذه في التنقيب.'),
    later: t('המקדש הרומי שבתל א-ראס והכנסייה הביזנטית המתומנת מאוחרים במאות שנים, ואינם חלק מן השחזור הזה.', 'The Roman temple on Tell er-Ras and the Byzantine octagonal church are centuries later, and are not part of this reconstruction.', 'الهيكل الروماني في تل الراس والكنيسة البيزنطية المثمّنة متأخران بقرون، وليسا جزءًا من إعادة البناء هذه.')
  };
})();
