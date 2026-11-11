/* נתוני הסיור. כל שדה טקסט בשלוש שפות (he / en / ar).
   מיקומים: `at` = מטרים מזרחה וצפונה ממרכז הכנסייה המתומנת; `size` = רוחב (מזרח–מערב) וגובה (צפון–דרום) במטרים.
   המרחקים והכיוונים נלקחו מתיאורי החפירות ומתרשים סכמטי, בדיוק של כ-15%, וטעונים אימות בשטח.
   פירוט המקורות: research/01_excavations.md */
(function () {
  const t = (he, en, ar) => ({ he, en, ar });

  const periods = [
    { id: 'persian', name: t('פרסית', 'Persian', 'الفارسية'),
      label: t('התקופה הפרסית', 'Persian period', 'الفترة الفارسية'),
      years: t('המאות ה-5–4 לפנה"ס', '5th–4th centuries BCE', 'القرنان الخامس والرابع ق.م') },
    { id: 'hellenistic', name: t('הלניסטית', 'Hellenistic', 'الهلنستية'),
      label: t('התקופה ההלניסטית', 'Hellenistic period', 'الفترة الهلنستية'),
      years: t('המאות ה-3–2 לפנה"ס', '3rd–2nd centuries BCE', 'القرنان الثالث والثاني ق.م') },
    { id: 'roman', name: t('רומית', 'Roman', 'الرومانية'),
      label: t('התקופה הרומית', 'Roman period', 'الفترة الرومانية'),
      years: t('המאות ה-1–4 לספירה', '1st–4th centuries CE', 'القرون الأول إلى الرابع م') },
    { id: 'byzantine', name: t('ביזנטית', 'Byzantine', 'البيزنطية'),
      label: t('התקופה הביזנטית', 'Byzantine period', 'الفترة البيزنطية'),
      years: t('המאות ה-4–7 לספירה', '4th–7th centuries CE', 'القرون الرابع إلى السابع م') },
    { id: 'islamic', name: t('מוסלמית', 'Islamic', 'الإسلامية'),
      label: t('התקופה המוסלמית', 'Islamic period', 'الفترة الإسلامية'),
      years: t('מן המאה ה-7 ואילך', 'from the 7th century CE', 'من القرن السابع م فصاعدًا') }
  ];

  const groups = [
    { id: 'arch',   name: t('החפירות', 'The excavations', 'الحفريات'), color: '#e0b24a' },
    { id: 'holy',   name: t('מקומות קדושים לשומרונים', 'Samaritan holy places', 'الأماكن المقدسة للسامريين'), color: '#f2f2f2' },
    { id: 'around', name: t('סביבות ההר', 'Around the mountain', 'محيط الجبل'), color: '#8ecbe6' }
  ];

  const places = [
    /* ================= המתחם המקודש ================= */
    {
      id: 'precinct', group: 'arch', color: '#e0b24a',
      name: t('המתחם המקודש', 'The Sacred Precinct', 'الحرم المقدّس'),
      kind: t('מתחם פולחן', 'Cult precinct', 'حرم عبادة'),
      center: [35.27405, 32.20190],
      ring: [[35.272958, 32.202144], [35.274353, 32.202144], [35.274353, 32.200328], [35.272958, 32.200328]],
      view: { zoom: 16.9, pitch: 58, bearing: -20 },
      summary: t(
        'לב האתר: מתחם מוקף חומה בנקודה הגבוהה בהר. בשלב ההלניסטי השתרע על כ-212 מ\' מצפון לדרום ו-136 מ\' ממזרח למערב. לדעת החופר עמד בו המקדש השומרוני; חוקרים אחרים סבורים שהיה כאן מתחם מזבח פתוח, שכן בניין המקדש עצמו לא נמצא.',
        'The heart of the site: a walled precinct on the highest point of the mountain. In its Hellenistic phase it measured about 212 m north–south by 136 m east–west. The excavator holds that the Samaritan temple stood here; other scholars think it was an open-air altar precinct, since the temple building itself was not found.',
        'قلب الموقع: حرم محاط بسور في أعلى نقطة من الجبل. بلغت أبعاده في المرحلة الهلنستية نحو 212 م من الشمال إلى الجنوب و136 م من الشرق إلى الغرب. يرى المنقّب أنّ الهيكل السامري قام هنا، ويرى باحثون آخرون أنه كان حرم مذبح مكشوف، إذ لم يُعثر على مبنى الهيكل نفسه.'),
      strata: [
        { period: 'persian', when: t('אמצע המאה ה-5 לפנה"ס', 'mid-5th century BCE', 'منتصف القرن الخامس ق.م'),
          text: t('המתחם הראשון, כ-96 על 98 מ\', בנוי אבני גוויל גדולות. התקיים כ-250 שנה.',
                  'The first precinct, about 96 by 98 m, built of large fieldstones. It stood for some 250 years.',
                  'الحرم الأول، نحو 96 × 98 م، مبني من حجارة غشيمة كبيرة. استمر نحو 250 سنة.') },
        { period: 'hellenistic', when: t('ראשית המאה ה-2 לפנה"ס', 'early 2nd century BCE', 'مطلع القرن الثاني ق.م'),
          text: t('בנייה מחדש והרחבה בימי אנטיוכוס השלישי: חומות, שערים, מצודות וגרמי מדרגות. חרב בשרפה בידי יוחנן הורקנוס, בסביבות 110 לפנה"ס.',
                  'Rebuilt and enlarged in the days of Antiochus III: walls, gates, citadels and staircases. Burnt down by John Hyrcanus around 110 BCE.',
                  'أُعيد بناؤه ووُسّع في عهد أنطيوخس الثالث: أسوار وبوابات وقلاع وأدراج. أحرقه يوحنا هركانوس نحو 110 ق.م.') },
        { period: 'roman', when: t('המאה ה-4 לספירה', '4th century CE', 'القرن الرابع م'),
          text: t('המתחם מתחדש כמקום עלייה לרגל של השומרונים; מכאן עשרות כתובות הקדשה ביוונית.',
                  'The precinct is revived as a Samaritan place of pilgrimage; dozens of Greek dedicatory inscriptions date from this time.',
                  'يتجدد الحرم مكانًا لحجّ السامريين؛ ومن هذه الفترة عشرات نقوش الإهداء باليونانية.') },
        { period: 'byzantine', when: t('484 לספירה', '484 CE', '484 م'),
          text: t('על חורבות המתחם נבנות הכנסייה המתומנת וחומתה.',
                  'The octagonal church and its wall are built over the ruins of the precinct.',
                  'تُبنى الكنيسة المثمّنة وسورها فوق أنقاض الحرم.') }
      ],
      finds: [
        t('כ-400 שברי כתובות בעברית ובארמית, רובן הקדשות של עולי רגל, וכ-83 ביוונית. אף אחת לא נמצאה במקומה המקורי: רובן התגלגלו אל המדרון המזרחי, ורבות פונו מערבה בזמן הבנייה הביזנטית',
          'About 400 fragments of inscriptions in Hebrew and Aramaic, mostly pilgrims\' dedications, and about 83 in Greek. None was found in its original place: most had tumbled down the eastern slope, and many were cleared to the west during the Byzantine building work',
          'نحو 400 كسرة من نقوش بالعبرية والآرامية، معظمها إهداءات حجّاج، ونحو 83 باليونانية. لم يُعثر على أيٍّ منها في موضعه الأصلي: فمعظمها تدحرج إلى المنحدر الشرقي، ونُقل كثير منها غربًا في أثناء البناء البيزنطي'),
        t('בכתובות חוזרת הנוסחה הארמית "קדם אלהא באתרא דנה", לפני האל במקום הזה; רוב השמות עבריים, ויש בהן התארים כהן ולוי',
          'The Aramaic formula "before God in this place" recurs in the inscriptions; most of the names are Hebrew, and the titles priest and Levite appear',
          'تتكرر في النقوش الصيغة الآرامية «أمام الله في هذا المكان»؛ معظم الأسماء عبرية، وترد فيها ألقاب كاهن ولاوي'),
        t('כ-16,000 מטבעות, מן התקופה הפרסית ועד החשמונאית, ושוב מן המאה ה-4 לספירה',
          'About 16,000 coins, from the Persian to the Hasmonean period, and again from the 4th century CE',
          'نحو 16,000 قطعة نقدية، من الفترة الفارسية حتى الحشمونية، ثم من القرن الرابع م'),
        t('יותר מ-400,000 עצמות שרופות של כבשים, עיזים, בקר ויונים, רובם צעירים מבני שנה',
          'More than 400,000 burnt bones of sheep, goats, cattle and pigeons, most under a year old',
          'أكثر من 400,000 عظمة محروقة لغنم وماعز وبقر وحمام، معظمها دون السنة من العمر'),
        t('אבני גזית לבנות עם סימני סתתים, וצירי נחושת של דלתות השער המזרחי',
          'White ashlars with masons\' marks, and the copper hinges of the eastern gate doors',
          'حجارة مشذّبة بيضاء عليها علامات البنّائين، ومفصلات نحاسية لأبواب البوابة الشرقية'),
        t('שעון שמש ועליו הקדשה ביוונית "לאל עליון" מאת אדם ששמו תלמי, שלפי הקריאה המוצעת הביא תרומות קודש ממצרים. נמצא במדרון הדרומי',
          'A sundial with a Greek dedication "to God Most High" by a man named Ptolemy, who on the proposed reading conveyed sacred contributions from Egypt. It was found on the southern slope',
          'مزولة شمسية عليها إهداء باليونانية «للإله العليّ» من رجل اسمه بطليموس، حمل بحسب القراءة المقترحة تبرعات مقدّسة من مصر. وُجدت على المنحدر الجنوبي'),
        t('עדות מרחוק: שתי כתובות יווניות מן האי דלוס, מן המאות ה-3–1 לפנה"ס, מזכירות "ישראלים בדלוס התורמים להרגריזים הקדוש"',
          'Evidence from afar: two Greek inscriptions from the island of Delos, of the 3rd–1st centuries BCE, mention "Israelites on Delos who make offerings to holy Argarizein"',
          'شاهد من بعيد: نقشان يونانيان من جزيرة ديلوس، من القرون الثالث إلى الأول ق.م، يذكران «إسرائيليين في ديلوس يقدّمون التبرعات لهرجريزيم المقدّس»')
      ]
    },
    {
      id: 'persian', parent: 'precinct', group: 'arch', color: '#f0cf7a',
      name: t('המתחם הפרסי', 'The Persian-period precinct', 'الحرم من الفترة الفارسية'),
      kind: t('השלב הראשון של המתחם', 'First phase of the precinct', 'المرحلة الأولى للحرم'),
      at: [1, -2], size: [98, 96], view: { zoom: 17.5, pitch: 55, bearing: -15 },
      summary: t(
        'המתחם הקדום, מתחת לכנסייה וסביבה. החומה המערבית, השמורה מכולן, אורכה כ-84 מ\' ואין בה שערים. בחומה הצפונית שער בן שישה תאים, 15 על 14 מ\', וממזרח לו מבנה ובו אלפי עצמות שרופות בשכבת אפר עבה.',
        'The earliest precinct, beneath and around the church. The western wall, the best preserved, is about 84 m long and has no gates. In the northern wall stood a six-chambered gate, 15 by 14 m, and east of it a building holding thousands of burnt bones in a thick layer of ash.',
        'الحرم الأقدم، تحت الكنيسة وحولها. السور الغربي، وهو الأفضل حفظًا، طوله نحو 84 م ولا بوابات فيه. في السور الشمالي بوابة من ست حجرات، 15 × 14 م، وإلى شرقها مبنى فيه آلاف العظام المحروقة في طبقة رماد سميكة.'),
      strata: [
        { period: 'persian', when: t('אמצע המאה ה-5 לפנה"ס', 'mid-5th century BCE', 'منتصف القرن الخامس ق.م'),
          text: t('התיארוך נשען על כלי חרס, מטבעות ואחת עשרה בדיקות פחמן, רובן של פחם עץ. המטבע הקדום ביותר הוא משנת 480 לפנה"ס בקירוב. יש חוקרים המאחרים את ייסוד המתחם לסוף המאה ה-5, ויש המקדימים אותו לשלהי תקופת הברזל; החופר עצמו כותב שלא נמצאה בהר עדות ברורה לאתר פולחן מימי הבית הראשון.',
                  'The dating rests on pottery, coins and eleven radiocarbon samples, most of them wood charcoal. The earliest coin dates to about 480 BCE. Some scholars lower the foundation to the late 5th century and others raise it to the end of the Iron Age; the excavator himself writes that no clear evidence of a First Temple-period cult site has been found on the mountain.',
                  'يستند التأريخ إلى الفخار والنقود وإحدى عشرة عيّنة كربون، معظمها من فحم الخشب. أقدم قطعة نقدية تعود إلى نحو سنة 480 ق.م. يؤخّر بعض الباحثين تأسيس الحرم إلى أواخر القرن الخامس، ويقدّمه آخرون إلى نهاية العصر الحديدي؛ ويكتب المنقّب نفسه أنه لم يُعثر في الجبل على دليل واضح على موقع عبادة من زمن الهيكل الأول.') }
      ],
      finds: [
        t('כ-90 מטבעות מן התקופה הפרסית. הקדומים שבהם, מן המאה ה-5 לפנה"ס, נמצאו בבתים שמחוץ למתחם; על מספר המטבעות שבתוך המתחם עצמו יש מחלוקת',
          'About 90 Persian-period coins. The earliest, of the 5th century BCE, came from houses outside the precinct; how many lay within the precinct itself is disputed',
          'نحو 90 قطعة نقدية من الفترة الفارسية. أقدمها، من القرن الخامس ق.م، وُجد في بيوت خارج الحرم؛ أما عدد ما وُجد داخل الحرم نفسه فموضع خلاف'),
        t('כלי חרס פרסיים ועצמות בעלי חיים בחצרות שבקצות החומה המערבית', 'Persian pottery and animal bones in the courtyards at the ends of the western wall', 'فخار فارسي وعظام حيوانات في الساحات عند طرفي السور الغربي')
      ]
    },
    {
      id: 'eaststairs', parent: 'precinct', group: 'arch', color: '#f0cf7a',
      name: t('גרם המדרגות המזרחי', 'The eastern staircase', 'الدرج الشرقي'),
      kind: t('מערך הכניסה לעולים משכם', 'Entrance for those ascending from Shechem', 'مدخل الصاعدين من شكيم'),
      at: [64, 0], size: [32, 30], view: { zoom: 17.6, pitch: 58, bearing: -90 },
      summary: t(
        'רחוב מרוצף ברוחב עד 16 מ\' מוביל אל שער תחתון, וממנו עולה גרם מדרגות מונומנטלי: כ-57 מדרגות, אורך 34 מ\', רוחב עד 23 מ\' והפרש גובה של 15.5 מ\'. בראשו שער עליון בן ארבעה תאים.',
        'A paved street up to 16 m wide leads to a lower gate, from which a monumental staircase rises: about 57 steps, 34 m long, up to 23 m wide, climbing 15.5 m. At its head stood an upper four-chambered gate.',
        'شارع مبلّط بعرض يصل إلى 16 م يؤدي إلى بوابة سفلى، ومنها يصعد درج ضخم: نحو 57 درجة، طوله 34 م وعرضه حتى 23 م وارتفاعه 15.5 م. وفي أعلاه بوابة عليا من أربع حجرات.'),
      strata: [
        { period: 'hellenistic', when: t('ראשית המאה ה-2 לפנה"ס', 'early 2nd century BCE', 'مطلع القرن الثاني ق.م'),
          text: t('נבנה עם הרחבת המתחם. בשער העליון נמצאו באתרם צירי הנחושת של שתי דלתות העץ.',
                  'Built with the enlargement of the precinct. The copper hinges of the two wooden doors were found in place in the upper gate.',
                  'بُني مع توسعة الحرم. وُجدت في البوابة العليا المفصلات النحاسية لبابَي الخشب في موضعها.') }
      ],
      finds: [
        t('שתי כותרות אבן מעוטרות בלולייניות ("פרוטו-איאוליות"), מאבן נארי שאינה מצויה בהר ובעובי 21 ס"מ בלבד, ושבר של שלישית. נמצאו במפולת שמעל המדרגות; זמנן שנוי במחלוקת',
          'Two volute ("proto-Aeolic") stone capitals, of nari stone not found on the mountain and only 21 cm thick, and a fragment of a third. They lay in the collapse above the staircase; their date is disputed',
          'تاجان حجريان مزخرفان بحلزونات («بروتو-أيولية»)، من حجر الناري غير الموجود في الجبل وبسماكة 21 سم فقط، وكسرة من ثالث. وُجدت في الردم فوق الدرج؛ وتأريخها موضع خلاف')
      ]
    },
    {
      id: 'courts', parent: 'precinct', group: 'arch', color: '#f0cf7a',
      name: t('חצרות עולי הרגל', 'The pilgrims\' courtyards', 'ساحات الحجّاج'),
      kind: t('חצרות', 'Courtyards', 'ساحات'),
      at: [47, -22], size: [26, 56], view: { zoom: 17.6, pitch: 58, bearing: -70 },
      summary: t(
        'לאורך החומה המזרחית, שאורכה 93 מ\' על המדרון התלול, יצרו חומות עבות במפלסים שונים חצרות לעולי הרגל. במרכז החומה שער גדול בן ארבעה תאים.',
        'Along the eastern wall, 93 m long on the steep slope, thick walls at different levels formed courtyards for the pilgrims. A large four-chambered gate stood at the centre of the wall.',
        'على امتداد السور الشرقي، وطوله 93 م على المنحدر الشديد، شكّلت أسوار سميكة على مستويات مختلفة ساحات للحجّاج. وفي وسط السور بوابة كبيرة من أربع حجرات.'),
      strata: [
        { period: 'hellenistic', when: t('ראשית המאה ה-2 לפנה"ס', 'early 2nd century BCE', 'مطلع القرن الثاني ق.م'),
          text: t('חלק מן ההרחבה ההלניסטית. מחוץ לחומה המזרחית ולאורכה נמצא אחד מריכוזי עצמות הקורבנות.',
                  'Part of the Hellenistic enlargement. One of the concentrations of sacrificial bones lay outside and along the eastern wall.',
                  'جزء من التوسعة الهلنستية. ووُجد خارج السور الشرقي وعلى امتداده أحد تجمّعات عظام القرابين.') }
      ],
      finds: []
    },
    {
      id: 'secitadel', parent: 'precinct', group: 'arch', color: '#f0cf7a',
      name: t('המצודה הדרום-מזרחית', 'The south-eastern citadel', 'القلعة الجنوبية الشرقية'),
      kind: t('מצודה', 'Citadel', 'قلعة'),
      at: [25, -60], size: [25, 24], view: { zoom: 17.7, pitch: 58, bearing: -40 },
      summary: t(
        'מצודה בפינת המתחם, 25 על 24 מ\', בקירות עבים מאוד שהתנשאו לשתי קומות ואולי לשלוש, סביב חצר מרכזית ובה חדר אירוח מהודר ושמור היטב.',
        'A citadel at the corner of the precinct, 25 by 24 m, with very thick walls rising two and perhaps three storeys around a central courtyard with a fine, well-preserved reception room.',
        'قلعة في زاوية الحرم، 25 × 24 م، بجدران سميكة جدًا ارتفعت طابقين وربما ثلاثة، حول فناء مركزي فيه قاعة استقبال فاخرة محفوظة جيدًا.'),
      strata: [
        { period: 'hellenistic', when: t('המאה ה-2 לפנה"ס', '2nd century BCE', 'القرن الثاني ق.م'),
          text: t('המתחם המקודש היה החלק המבוצר היחיד בעיר.', 'The sacred precinct was the only fortified part of the city.', 'كان الحرم المقدّس الجزء المحصّن الوحيد في المدينة.') }
      ],
      finds: []
    },
    {
      id: 'westentrance', parent: 'precinct', group: 'arch', color: '#f0cf7a',
      name: t('הכניסה המערבית והמתחם המבוצר', 'The western entrance and fortified compound', 'المدخل الغربي والمجمّع المحصّن'),
      kind: t('שער, מדרגות ומתחם מבוצר', 'Gate, stairs and fortified compound', 'بوابة ودرج ومجمّع محصّن'),
      at: [-48, -50], size: [39, 38], view: { zoom: 17.6, pitch: 58, bearing: 40 },
      summary: t(
        'גרם מדרגות ברוחב 9 מ\' (שרדו שבע מדרגות) הוביל אל רחבה מרוצפת, וממנה פנו צפונה אל המקדש. לידו מגדל מרובע ומתחם מבוצר, 39 על 38 מ\', בקירות מטויחים בעובי 3 מ\'. מדרום לו מבני ציבור גדולים לשימוש המבקרים.',
        'A staircase 9 m wide (seven steps survive) led to a paved plaza, from which one turned north towards the temple. Beside it stood a square tower and a fortified compound, 39 by 38 m, with plastered walls 3 m thick. South of it were large public buildings for visitors.',
        'درج بعرض 9 م (بقيت منه سبع درجات) يؤدي إلى ساحة مبلّطة، ومنها يُتّجه شمالًا نحو الهيكل. وبجانبه برج مربع ومجمّع محصّن، 39 × 38 م، بجدران مكسوّة بالجص سماكتها 3 م. وإلى جنوبه مبانٍ عامة كبيرة للزوّار.'),
      strata: [
        { period: 'hellenistic', when: t('המאה ה-2 לפנה"ס', '2nd century BCE', 'القرن الثاني ق.م'),
          text: t('בפינה זו, ליד המדרגות, נמצא אחד מריכוזי עצמות הקורבנות.',
                  'One of the concentrations of sacrificial bones was found in this corner, by the stairs.',
                  'في هذه الزاوية، قرب الدرج، وُجد أحد تجمّعات عظام القرابين.') }
      ],
      finds: []
    },

    /* ================= הכנסייה ================= */
    {
      id: 'church', group: 'arch', color: '#7fb6e6', labelFrom: 16.3,
      name: t('כנסיית מרים יולדת האל', 'Church of Mary Theotokos', 'كنيسة مريم والدة الإله'),
      kind: t('כנסייה מתומנת ומתחם מבוצר', 'Octagonal church and fortified enclosure', 'كنيسة مثمّنة وسور محصّن'),
      center: [35.273441, 32.201180],
      ring: [[35.273033, 32.201454], [35.273817, 32.201454], [35.273817, 32.200941], [35.273033, 32.200941]],
      view: { zoom: 17.7, pitch: 50, bearing: 30 },
      summary: t(
        'כנסיית זיכרון מתומנת בתוך חומה ומגדלים, 71 על 56 מ\', שנבנתה על חורבות המתחם המקודש. קירותיה פורקו כמעט עד היסוד, ותוכניתה נראית היטב מן האוויר.',
        'An octagonal memorial church within a wall with towers, 71 by 56 m, built over the ruins of the sacred precinct. Its walls were dismantled almost to the foundations, and its plan is clearly visible from the air.',
        'كنيسة تذكارية مثمّنة داخل سور وأبراج، 71 × 56 م، بُنيت فوق أنقاض الحرم المقدّس. فُكّكت جدرانها حتى الأساسات تقريبًا، ومخططها واضح من الجو.'),
      strata: [
        { period: 'byzantine', when: t('484 לספירה', '484 CE', '484 م'),
          text: t('הקיסר זנון בונה את הכנסייה, הסטיו שסביבה וחומת המתחם, אחרי מרד השומרונים בנאפוליס.',
                  'Emperor Zeno builds the church, the colonnade around it and the enclosure wall, after the Samaritan revolt in Neapolis.',
                  'الإمبراطور زينون يبني الكنيسة والرواق المحيط بها وسور المجمّع، بعد ثورة السامريين في نيابوليس.') },
        { period: 'byzantine', when: t('אחרי 529 לספירה', 'after 529 CE', 'بعد 529 م'),
          text: t('הקיסר יוסטיניאנוס מוסיף מצפון מתחם מבוצר ובו בריכה, ומציב חיל מצב.',
                  'Emperor Justinian adds a fortified enclosure with a pool on the north and stations a garrison.',
                  'الإمبراطور جستنيان يضيف من الشمال مجمّعًا محصّنًا فيه بركة، ويضع حامية.') },
        { period: 'islamic', when: t('המאה ה-7 לספירה', '7th century CE', 'القرن السابع م'),
          text: t('הכנסייה ננטשת.', 'The church is abandoned.', 'تُهجر الكنيسة.') }
      ],
      finds: [
        t('כתובות יווניות על לוחות אבן. רובן הקדשות של שומרונים מן המאות ה-4–5 לספירה, בנוסח "אל אחד העוזר", ששולבו בכנסייה בשימוש חוזר; ועמן תווית של "אבן מן הגולגותא"',
          'Greek inscriptions on stone slabs. Most are dedications by Samaritans of the 4th–5th centuries CE, with the formula "One God who helps", reused in the church; with them, the label of a "stone from Golgotha"',
          'نقوش يونانية على ألواح حجرية. معظمها إهداءات لسامريين من القرنين الرابع والخامس م، بصيغة «إله واحد هو المعين»، أُعيد استعمالها في الكنيسة؛ ومعها بطاقة «حجر من الجلجثة»'),
        t('בבור בדיקה במרכז הכנסייה נחשפו שרידי מבנה הלניסטי שמתחתיה',
          'A test pit at the centre of the church exposed remains of a Hellenistic structure beneath it',
          'كشف مجسّ في وسط الكنيسة عن بقايا مبنى هلنستي تحتها'),
        t('כותרות קורינתיות ושברי עמודים מאבן גיר אדומה', 'Corinthian capitals and fragments of red limestone columns', 'تيجان كورنثية وكسور أعمدة من الحجر الجيري الأحمر'),
        t('ריצוף שיש ואריחים', 'Marble and tile paving', 'بلاط من الرخام والقرميد')
      ]
    },
    {
      id: 'octagon', parent: 'church', group: 'arch', color: '#a9d0f0',
      name: t('המתומן והחלל המרכזי', 'The octagon and the central space', 'المثمّن والفضاء المركزي'),
      kind: t('גוף הכנסייה', 'Body of the church', 'جسم الكنيسة'),
      at: [0, 0], oct: 16, view: { zoom: 18.3, pitch: 45, bearing: 20 },
      summary: t(
        'גוף הכנסייה, 30 על 37.4 מ\' מבחוץ. במרכזו בסיס מתומן של עמודים ואומנות פינה שנשאו כיפה, וסביבו מסדרון היקפי. זה החלק השמור פחות מכולם.',
        'The body of the church, 30 by 37.4 m on the outside. At its centre an octagonal base of columns and corner piers carried a dome, with an ambulatory around it. It is the least preserved part.',
        'جسم الكنيسة، 30 × 37.4 م من الخارج. في وسطه قاعدة مثمّنة من أعمدة ودعائم زوايا كانت تحمل قبّة، وحولها ممرّ دائري. وهو أقل الأجزاء حفظًا.'),
      strata: [ { period: 'byzantine', when: t('484 לספירה', '484 CE', '484 م'),
          text: t('קירות גזית בשני פנים עם מילוי; הצלע המזרחית בולטת החוצה כדי להכיל את האפסיס.',
                  'Ashlar walls of two faces with a fill; the eastern side projects to hold the apse.',
                  'جدران من حجارة مشذّبة بوجهين وحشوة؛ والضلع الشرقي بارز ليضمّ الحنية.') } ],
      finds: [ t('שברי עמודים מאבן גיר אדומה וכותרות קורינתיות', 'Fragments of red limestone columns and Corinthian capitals', 'كسور أعمدة من الحجر الجيري الأحمر وتيجان كورنثية') ]
    },
    {
      id: 'apse', parent: 'church', group: 'arch', color: '#a9d0f0',
      name: t('הבימה והאפסיס', 'The bema and apse', 'المنصّة والحنية'),
      kind: t('קודש הכנסייה', 'Sanctuary of the church', 'قدس الكنيسة'),
      at: [18, 0], size: [8, 11], view: { zoom: 18.4, pitch: 45, bearing: -80 },
      summary: t(
        'יחידה מוגבהת הבולטת מזרחה: בימה בצורת U ואפסיס חצי-עגול שקוטרו כ-4.6 מ\'. משני צדדיו שני חדרים מרובעים קטנים, שהכניסה אליהם מחוץ לכנסייה. ממזרח לאפסיס קריפטה, ובה נמצאו בקבוקי זכוכית ושרידי שלדים.',
        'A raised unit projecting eastwards: a U-shaped bema and a semicircular apse about 4.6 m across. On either side are two small square rooms entered from outside the church. East of the apse lies a crypt, in which glass bottles and skeletal remains were found.',
        'وحدة مرتفعة بارزة نحو الشرق: منصّة على شكل U وحنية نصف دائرية قطرها نحو 4.6 م. وعلى جانبيها غرفتان مربعتان صغيرتان يُدخل إليهما من خارج الكنيسة. وإلى شرق الحنية سرداب وُجدت فيه قوارير زجاجية وبقايا هياكل عظمية.'),
      strata: [], finds: []
    },
    {
      id: 'narthex', parent: 'church', group: 'arch', color: '#a9d0f0',
      name: t('הנרתקס', 'The narthex', 'الدهليز (النارثكس)'),
      kind: t('מבואת הכנסייה', 'Entrance hall', 'ردهة المدخل'),
      at: [-17, 0], size: [6, 16], view: { zoom: 18.4, pitch: 45, bearing: 90 },
      summary: t(
        'מבואה בצד המערבי, כנראה מרוצפת שיש. ממנה שלוש כניסות אל הכנסייה, והאמצעית גדולה מהן. מצפון ומדרום לה שני חדרים משולשים, שהובילו אל שתי הקפלות המערביות.',
        'An entrance hall on the west side, probably paved with marble. Three doorways led from it into the church, the middle one the largest. North and south of it two triangular rooms gave access to the two western chapels.',
        'ردهة في الجهة الغربية، مبلّطة بالرخام على الأرجح. منها ثلاثة مداخل إلى الكنيسة، أوسطها أكبرها. وإلى شمالها وجنوبها غرفتان مثلّثتان تؤديان إلى المصلّيين الغربيين.'),
      strata: [], finds: []
    },
    {
      id: 'chapels', parent: 'church', group: 'arch', color: '#a9d0f0',
      name: t('ארבע הקפלות', 'The four chapels', 'المصلّيات الأربعة'),
      kind: t('קפלות', 'Chapels', 'مصلّيات'),
      at: [11, -12], size: [10, 9], view: { zoom: 18.4, pitch: 45, bearing: -30 },
      summary: t(
        'ארבע קפלות בעלות אפסיס, שתיים במערב ושתיים במזרח, בקירות דקים מקירות הכנסייה. הדרום-מזרחית, המסומנת כאן, היא הגדולה מכולן: היא חופתה שיש, ובמרכז האפסיס שלה מתקן אבן משושה. על ייעוד הקפלה הצפון-מזרחית החוקרים חלוקים.',
        'Four apsed chapels, two on the west and two on the east, with walls thinner than those of the church. The south-eastern one, marked here, is the largest: it was faced with marble, and a hexagonal stone installation stands in the centre of its apse. Scholars disagree about the purpose of the north-eastern chapel.',
        'أربعة مصلّيات ذات حنيات، اثنان في الغرب واثنان في الشرق، جدرانها أرقّ من جدران الكنيسة. والجنوبي الشرقي، المعلَّم هنا، أكبرها: كُسي بالرخام، وفي وسط حنيته منشأة حجرية سداسية. ويختلف الباحثون في وظيفة المصلّى الشمالي الشرقي.'),
      strata: [], finds: []
    },
    {
      id: 'peristyle', parent: 'church', group: 'arch', color: '#a9d0f0',
      name: t('הסטיו שסביב הכנסייה', 'The colonnade around the church', 'الرواق المحيط بالكنيسة'),
      kind: t('פריסטיל', 'Peristyle', 'رواق معمَّد'),
      at: [0, 0], size: [53, 39], view: { zoom: 18.1, pitch: 45, bearing: 0 },
      summary: t(
        'במקום חצר כניסה הקיפו את הכנסייה אומנות מלבניות של גזית משובחת, 39 על 53 מ\'. הרצועה שבינן לבין הכנסייה רוצפה לוחות אבן, ומי הגשם נוקזו ממנה אל בור מים גדול שממערב לכנסייה.',
        'Instead of an entrance court, rectangular piers of fine ashlar surrounded the church, 39 by 53 m. The strip between them and the church was paved with stone slabs, and rainwater drained from it into a large cistern west of the church.',
        'بدلًا من فناء المدخل، أحاطت بالكنيسة دعائم مستطيلة من حجارة مشذّبة فاخرة، 39 × 53 م. وبُلّط الشريط بينها وبين الكنيسة بألواح حجرية، وكانت مياه المطر تُصرف منه إلى صهريج كبير غرب الكنيسة.'),
      strata: [], finds: []
    },
    {
      id: 'towers', parent: 'church', group: 'arch', color: '#a9d0f0',
      name: t('החומה, המגדלים והשער', 'The wall, towers and gate', 'السور والأبراج والبوابة'),
      kind: t('ביצורי המתחם', 'Fortifications of the enclosure', 'تحصينات المجمّع'),
      at: [0, 27], size: [8, 6], view: { zoom: 18.0, pitch: 50, bearing: 180 },
      summary: t(
        'חומה מלבנית בעובי כ-2.7 מ\', שהתנשאה במקור לכ-7 מ\' ושמורה במקומות עד 4 מ\'. בארבע פינותיה מגדלים, כ-8.6 על 8 מ\' כל אחד, ועוד מגדל במרכז החומה הדרומית. השער נמצא בחומה הצפונית, והוא המסומן כאן: בית שער של 9.6 על 8.6 מ\' שפתחו כ-3 מ\'. הוא נבנה מחדש כמה פעמים, ושני שלביו האחרונים הם כנראה מן התקופה האסלאמית. לאורך החומות מבפנים שורת חדרים קטנים.',
        'A rectangular wall about 2.7 m thick, originally some 7 m high and preserved in places to 4 m. Towers stand at its four corners, each about 8.6 by 8 m, with another at the centre of the southern wall. The gate is in the northern wall and is marked here: a gatehouse of 9.6 by 8.6 m with an opening about 3 m wide. It was rebuilt several times, and its last two phases are probably of the Islamic period. A row of small rooms lines the inside of the walls.',
        'سور مستطيل سماكته نحو 2.7 م، كان ارتفاعه في الأصل نحو 7 م وهو محفوظ في بعض المواضع حتى 4 م. في زواياه الأربع أبراج، كلٌّ منها نحو 8.6 × 8 م، وبرج آخر في وسط السور الجنوبي. والبوابة في السور الشمالي، وهي المعلَّمة هنا: بيت بوابة 9.6 × 8.6 م وفتحته نحو 3 م. أُعيد بناؤها عدة مرات، ومرحلتاها الأخيرتان على الأرجح من الفترة الإسلامية. وعلى امتداد الأسوار من الداخل صف من الغرف الصغيرة.'),
      strata: [], finds: [ t('צלב חקוק מעל פתח אחד החדרים שבצד המזרחי', 'A cross carved above the doorway of one of the rooms on the east side', 'صليب محفور فوق مدخل إحدى الغرف في الجهة الشرقية') ]
    },
    {
      id: 'northenclosure', parent: 'church', group: 'arch', color: '#a9d0f0',
      name: t('המתחם הצפוני והבריכה', 'The northern enclosure and the pool', 'المجمّع الشمالي والبركة'),
      kind: t('תוספת יוסטיניאנוס', 'Justinian\'s addition', 'إضافة جستنيان'),
      at: [0, 55], size: [62, 42], view: { zoom: 17.8, pitch: 52, bearing: 180 },
      summary: t(
        'מתחם מבוצר לא סדיר שהוצמד מצפון לשער המקורי. במרכזו מאגר מים פתוח וגדול, כ-36.6 על 18.3 מ\', מדופן אבני גזית. בפינתו הצפון-מזרחית קבוצת חדרים שזוהתה כמנזר ובית מרחץ.',
        'An irregular fortified enclosure attached north of the original gate. At its centre is a large open reservoir, about 36.6 by 18.3 m, lined with ashlars. A group of rooms at its north-eastern corner has been identified as a monastery and bathhouse.',
        'مجمّع محصّن غير منتظم أُلحق شمال البوابة الأصلية. في وسطه خزان مياه مكشوف كبير، نحو 36.6 × 18.3 م، مبطَّن بحجارة مشذّبة. وفي زاويته الشمالية الشرقية مجموعة غرف عُرّفت بأنها دير وحمّام.'),
      strata: [ { period: 'byzantine', when: t('המחצית הראשונה של המאה ה-6', 'first half of the 6th century', 'النصف الأول من القرن السادس'),
          text: t('נבנה בימי יוסטיניאנוס, בלי לשנות את תוכנית הכנסייה.', 'Built under Justinian, without altering the plan of the church.', 'بُني في عهد جستنيان دون تغيير مخطط الكنيسة.') } ],
      finds: [
        t('הבריכה נקראת בערבית ביר א-רצאץ, "באר העופרת". שיטת בנייתה שונה משל המתחם, וייתכן שהיא קדומה לו',
          'The pool is called Bir er-Rasas in Arabic, "the Well of Lead". Its masonry differs from that of the enclosure, and it may be older than it',
          'تُسمّى البركة بئر الرصاص. وطريقة بنائها تختلف عن بناء المجمّع، وربما كانت أقدم منه')
      ]
    },
    {
      id: 'ghanim', group: 'arch', color: '#8fd19e', labelFrom: 16.3,
      name: t('קבר שייח\' ע\'אנם', 'Tomb of Sheikh Ghanim', 'مقام الشيخ غانم'),
      kind: t('מבנה קבר', 'Tomb shrine', 'مقام'),
      at: [31, 24], size: [11, 11], view: { zoom: 17.9, pitch: 55, bearing: 200 },
      summary: t(
        'מבנה כיפה על יסודות המגדל הצפון-מזרחי של מתחם הכנסייה, הנראה למרחוק מכל עבר. לפי המסורת המוסלמית זהו קברו של אחד ממפקדי צלאח א-דין; סוקרי המאה ה-19 רשמו שהשומרונים מייחסים אותו לשכם בן חמור.',
        'A domed building on the foundations of the north-eastern tower of the church enclosure, visible from far around. Muslim tradition holds it to be the tomb of one of Saladin\'s commanders; the 19th-century surveyors recorded that the Samaritans attribute it to Shechem son of Hamor.',
        'مبنى ذو قبّة على أساسات البرج الشمالي الشرقي لمجمّع الكنيسة، يُرى من بعيد من كل الجهات. تنسبه الرواية الإسلامية إلى أحد قادة صلاح الدين؛ وسجّل مسّاحو القرن التاسع عشر أنّ السامريين ينسبونه إلى شكيم بن حمور.'),
      strata: [
        { period: 'byzantine', when: t('סוף המאה ה-5 לספירה', 'late 5th century CE', 'أواخر القرن الخامس م'),
          text: t('המגדל הצפון-מזרחי של המתחם המבוצר.', 'The north-eastern tower of the fortified enclosure.', 'البرج الشمالي الشرقي للمجمّع المحصّن.') },
        { period: 'islamic', when: t('ימי הביניים', 'Middle Ages', 'العصور الوسطى'),
          text: t('המגדל נבנה מחדש, עם כיפה, כמקום קדוש.', 'The tower is rebuilt, with a dome, as a holy place.', 'أُعيد بناء البرج بقبّة ليكون مقامًا.') }
      ],
      finds: []
    },

    /* ================= העיר ההלניסטית ================= */
    {
      id: 'city', group: 'arch', color: '#c9a0e0',
      name: t('העיר ההלניסטית', 'The Hellenistic city', 'المدينة الهلنستية'),
      kind: t('עיר מקדש', 'Temple city', 'مدينة هيكل'),
      at: [-70, -150], view: { zoom: 16.2, pitch: 55, bearing: 15 },
      summary: t(
        'עיר של כ-400 דונם שצמחה סביב המתחם המקודש, על הר חשוף בלי מקור מים. לא הייתה לה חומה: קירות הבתים החיצוניים שימשו לה מעין חומה. רוב הבתים בדרום ובמערב, שם המדרון מתון. החופר מעריך שגרו בה עד כ-10,000 נפש, והערכה זו שנויה במחלוקת.',
        'A city of about 40 hectares that grew around the sacred precinct, on a bare mountain with no water source. It had no city wall: the outer walls of the houses served as one. Most houses stood on the south and west, where the slope is gentle. The excavator estimates up to about 10,000 inhabitants, a figure that is disputed.',
        'مدينة مساحتها نحو 400 دونم نشأت حول الحرم المقدّس، على جبل أجرد بلا مصدر ماء. لم يكن لها سور: فجدران البيوت الخارجية قامت مقامه. معظم البيوت في الجنوب والغرب حيث المنحدر لطيف. يقدّر المنقّب سكانها بنحو 10,000 نسمة، وهو تقدير موضع خلاف.'),
      strata: [
        { period: 'persian', when: t('המאה ה-5 לפנה"ס', '5th century BCE', 'القرن الخامس ق.م'),
          text: t('בתי מגורים ראשונים ליד המתחם המקודש, כבר בתקופה הפרסית. כך עולה מן המטבעות ומחפירות הצלה שנערכו במדרון הצפוני בשנים 2019–2021. קודם לכן סברו שהעיר נוסדה רק בסוף המאה ה-4.',
                  'The first dwellings beside the sacred precinct, already in the Persian period, as shown by the coins and by salvage excavations on the northern slope in 2019–2021. It was previously thought that the city was founded only in the late 4th century.',
                  'أولى البيوت قرب الحرم المقدّس، منذ الفترة الفارسية، كما تدلّ النقود وحفريات إنقاذية أُجريت على المنحدر الشمالي في الأعوام 2019–2021. وكان يُظنّ قبل ذلك أنّ المدينة تأسست في أواخر القرن الرابع فقط.') },
        { period: 'hellenistic', when: t('המאה ה-2 לפנה"ס', '2nd century BCE', 'القرن الثاني ق.م'),
          text: t('שיא העיר. בזמן המצור החשמונאי נחסמו פתחים ובוצרו רחובות ובתים; העיר חרבה בסביבות 110 לפנה"ס ולא נושבה עוד. מטמון מטבעות חשמונאיים במערב העיר מלמד, לדעת החופר, שחיל מצב חשמונאי ישב כאן אחרי החורבן.',
                  'The city at its height. During the Hasmonean siege doorways were blocked and streets and houses fortified; the city was destroyed around 110 BCE and never resettled. A hoard of Hasmonean coins in the west of the city shows, in the excavator\'s view, that a Hasmonean garrison was stationed here after the destruction.',
                  'أوج المدينة. في أثناء الحصار الحشموني سُدّت المداخل وحُصّنت الشوارع والبيوت؛ ودُمّرت المدينة نحو 110 ق.م ولم تُسكن بعد ذلك. ويدلّ كنز من النقود الحشمونية في غرب المدينة، في رأي المنقّب، على أنّ حامية حشمونية رابطت هنا بعد الخراب.') }
      ],
      finds: [
        t('בתים בנויים סביב חצר, ובהם חדר אירוח, חדרי שינה וחדר רחצה', 'Houses built around a courtyard, with a reception room, bedrooms and a bathroom', 'بيوت مبنيّة حول فناء، فيها قاعة استقبال وغرف نوم وحمّام'),
        t('בתי בד, תנורים, קנקני אגירה ונרות חרס', 'Oil presses, ovens, storage jars and clay lamps', 'معاصر زيت وأفران وجرار تخزين وسُرُج فخارية')
      ]
    },
    {
      id: 'areaA', parent: 'city', group: 'arch', color: '#dcc0ee',
      name: t('הרובע הדרום-מערבי (אזור A)', 'The south-western quarter (Area A)', 'الحيّ الجنوبي الغربي (المنطقة A)'),
      kind: t('רובע מגורים', 'Residential quarter', 'حيّ سكني'),
      center: [35.272325, 32.199511],
      ring: [[35.271655, 32.199919], [35.272486, 32.199919], [35.273023, 32.199647], [35.272942, 32.199011], [35.272272, 32.199034], [35.271682, 32.199511]],
      view: { zoom: 17.3, pitch: 55, bearing: 60 },
      summary: t(
        'שמונה בתי מגורים לאורך רחוב ממזרח למערב, מדרום-מערב למתחם המקודש. קירותיהם נראים היטב מן האוויר.',
        'Eight dwellings along an east–west street, south-west of the sacred precinct. Their walls are clearly visible from the air.',
        'ثمانية بيوت على امتداد شارع من الشرق إلى الغرب، جنوب غرب الحرم المقدّس. جدرانها واضحة من الجو.'),
      strata: [ { period: 'hellenistic', when: t('המאות ה-3–2 לפנה"ס', '3rd–2nd centuries BCE', 'القرنان الثالث والثاني ق.م'),
          text: t('בתים רחבי ידיים באבן מקומית ובטיח סיד לבן, עם תקרות עץ וקומה שנייה.',
                  'Spacious houses of local stone and white lime plaster, with wooden ceilings and an upper storey.',
                  'بيوت واسعة من الحجر المحلي والجص الجيري الأبيض، بسقوف خشبية وطابق علوي.') } ],
      finds: []
    },
    {
      id: 'areaP', parent: 'city', group: 'arch', color: '#dcc0ee',
      name: t('האחוזה (אזור P)', 'The mansion (Area P)', 'القصر (المنطقة P)'),
      kind: t('בית אחוזה ובית בד', 'Mansion and oil press', 'قصر ومعصرة زيت'),
      at: [-88, -36], size: [40, 40], view: { zoom: 17.7, pitch: 55, bearing: 70 },
      summary: t(
        'מבנה של 40 על 40 מ\' על מדרון תלול, צמוד לחומת המתחם המקודש ושמור במקומות עד הקומה השנייה. יש בו בית בד סביב חצר מרוצפת, מחסנים וחנויות, ומגורי פאר שבחדר האירוח שלהם פרסקאות צבעוניים, היחידים שנמצאו בהר.',
        'A building of 40 by 40 m on a steep slope, abutting the wall of the sacred precinct and preserved in places to the upper storey. It holds an oil press around a paved courtyard, storerooms and shops, and a luxurious residence whose reception room has coloured frescoes, the only ones found on the mountain.',
        'مبنى 40 × 40 م على منحدر شديد، ملاصق لسور الحرم المقدّس ومحفوظ في بعض المواضع حتى الطابق العلوي. فيه معصرة زيت حول فناء مبلّط، ومخازن ودكاكين، ومسكن فاخر في قاعة استقباله رسوم جدارية ملوّنة هي الوحيدة التي وُجدت في الجبل.'),
      strata: [ { period: 'hellenistic', when: t('המאה ה-2 לפנה"ס', '2nd century BCE', 'القرن الثاني ق.م'),
          text: t('בבית הבד נמצאו מתקן הריסוק, גומחות הקורות והמשקולות במקומן.',
                  'In the oil press the crushing installation, the beam niches and the weights were found in place.',
                  'في المعصرة وُجدت منشأة الهرس وكوّات العوارض والأثقال في مواضعها.') } ],
      finds: [ t('המטבע הקדום ביותר בהר, דרכמה מקפריסין משנת 480 לפנה"ס בקירוב, ומטבעות נוספים מן המאה ה-5: עדות לפעילות כאן כבר בתקופה הפרסית',
                 'The earliest coin on the mountain, a drachm from Cyprus of about 480 BCE, and further 5th-century coins: evidence of activity here already in the Persian period',
                 'أقدم قطعة نقدية في الجبل، درهم من قبرص من نحو سنة 480 ق.م، وقطع أخرى من القرن الخامس: دليل على نشاط هنا منذ الفترة الفارسية'),
               t('פרסקאות צבעוניים וסטוקו', 'Coloured frescoes and stucco', 'رسوم جدارية ملوّنة وجص مزخرف'), t('סף אבן מסותת עם דלת עץ', 'A dressed stone threshold with a wooden door', 'عتبة حجرية مشذّبة مع باب خشبي') ]
    },
    {
      id: 'areaB', parent: 'city', group: 'arch', color: '#dcc0ee',
      name: t('הרובע הדרומי (אזור B)', 'The southern quarter (Area B)', 'الحيّ الجنوبي (المنطقة B)'),
      kind: t('הגדול ברובעי העיר', 'The largest of the city quarters', 'أكبر أحياء المدينة'),
      at: [-115, -277], size: [300, 120], view: { zoom: 16.6, pitch: 55, bearing: 20 },
      summary: t(
        'רובע צפוף בשולי העיר הדרומיים, כ-300 על 120 מ\'. מן השער הדרומי עולה רחוב ראשי צפונה אל שתי רחבות ששימשו שוק, וממנו סמטאות למזרח ולמערב. לצד השער שני מבני ציבור, ובקצה הדרום-מערבי מצודה של 25 על 25 מ\'. באחד המבנים חזית של שני עמודים דוריים.',
        'A dense quarter on the southern edge of the city, about 300 by 120 m. From the southern gate a main street climbs north to two plazas that served as a market, with alleys branching east and west. Two public buildings flank the gate, and a citadel of 25 by 25 m stands at the south-western end. One building has a façade of two Doric columns.',
        'حيّ مكتظّ عند الطرف الجنوبي للمدينة، نحو 300 × 120 م. من البوابة الجنوبية يصعد شارع رئيسي شمالًا إلى ساحتين كانتا سوقًا، وتتفرع منه أزقّة شرقًا وغربًا. وعلى جانبي البوابة مبنيان عامان، وفي الطرف الجنوبي الغربي قلعة 25 × 25 م. ولأحد المباني واجهة من عمودين دوريين.'),
      strata: [ { period: 'hellenistic', when: t('המאה ה-2 לפנה"ס', '2nd century BCE', 'القرن الثاني ق.م'),
          text: t('כל הפתחים החיצוניים של מבני השער ושל המצודה נמצאו חסומים, כנראה מימי המצור.',
                  'All the outer doorways of the gate buildings and of the citadel were found blocked, apparently from the time of the siege.',
                  'وُجدت كل المداخل الخارجية لمباني البوابة والقلعة مسدودة، على الأرجح منذ أيام الحصار.') } ],
      finds: []
    },
    {
      id: 'areaE', parent: 'city', group: 'arch', color: '#dcc0ee',
      name: t('המדרון המזרחי (אזור E)', 'The eastern slope (Area E)', 'المنحدر الشرقي (المنطقة E)'),
      kind: t('מבנה ציבור ותנורים', 'Public building and ovens', 'مبنى عام وأفران'),
      at: [0, -295], size: [42, 25], view: { zoom: 17.5, pitch: 55, bearing: -20 },
      summary: t(
        'מבנה ציבור גדול, 42 על 25 מ\': מדרגות, מבואה וחצר מרכזית מוקפת חדרים, ובמערבה אולם אירוח. לצדו גרם מדרגות היורד מן המתחם המקודש, שנשמרו בו 15 מדרגות שלמות. נמצאו כאן יותר מעשרים תנורי בישול ואפייה.',
        'A large public building, 42 by 25 m: steps, a vestibule and a central courtyard surrounded by rooms, with a reception hall on the west. Beside it a staircase descends from the sacred precinct, with 15 complete steps preserved. More than twenty cooking and baking ovens were found here.',
        'مبنى عام كبير، 42 × 25 م: درج وردهة وفناء مركزي تحيط به الغرف، وفي غربه قاعة استقبال. وبجانبه درج ينزل من الحرم المقدّس، حُفظت منه 15 درجة كاملة. ووُجد هنا أكثر من عشرين فرنًا للطبخ والخبز.'),
      strata: [ { period: 'hellenistic', when: t('המאה ה-2 לפנה"ס', '2nd century BCE', 'القرن الثاني ق.م'),
          text: t('המבנים הגבוהים שעל המדרון שימשו גם מעין חומה לעיר.', 'The tall buildings on the slope also served the city as a kind of wall.', 'المباني العالية على المنحدر كانت أيضًا بمثابة سور للمدينة.') } ],
      finds: []
    },
    {
      id: 'areaT', parent: 'city', group: 'arch', color: '#dcc0ee',
      name: t('הרובע הצפוני (אזור T)', 'The northern quarter (Area T)', 'الحيّ الشمالي (المنطقة T)'),
      kind: t('בית מגורים ובית בד', 'Dwelling and oil press', 'بيت ومعصرة زيت'),
      at: [0, 100], size: [22, 30], view: { zoom: 17.7, pitch: 55, bearing: 170 },
      summary: t(
        'בית מגורים שהוסב לבית בד. בצפון הבנייה דלילה, בגלל הסלע השבור.',
        'A dwelling converted into an oil press. Building is sparse on the north, because of the broken bedrock.',
        'بيت حُوّل إلى معصرة زيت. البناء في الشمال متفرّق بسبب الصخر المتشقق.'),
      strata: [ { period: 'hellenistic', when: t('המאות ה-3–2 לפנה"ס', '3rd–2nd centuries BCE', 'القرنان الثالث والثاني ق.م'), text: t('אחד משני בתי הבד שברובעים הצפוניים.', 'One of the two oil presses in the northern quarters.', 'إحدى معصرتَي الزيت في الأحياء الشمالية.') } ],
      finds: []
    },
    {
      id: 'areaK', parent: 'city', group: 'arch', color: '#dcc0ee',
      name: t('הרובע הצפון-מערבי (אזור K)', 'The north-western quarter (Area K)', 'الحيّ الشمالي الغربي (المنطقة K)'),
      kind: t('רובע מגורים', 'Residential quarter', 'حيّ سكني'),
      at: [-231, 96], size: [50, 50], view: { zoom: 17.0, pitch: 55, bearing: 110 },
      summary: t(
        'בתי מגורים ובית בד בשני שטחי חפירה, K1 ו-K2. העיר התרחבה לכיוון זה בזכות השטח הנוח והקרבה למטעים.',
        'Dwellings and an oil press in two excavation areas, K1 and K2. The city expanded in this direction thanks to the easy ground and the nearby orchards.',
        'بيوت ومعصرة زيت في منطقتَي حفر، K1 وK2. توسعت المدينة في هذا الاتجاه لسهولة الأرض وقربها من البساتين.'),
      strata: [ { period: 'hellenistic', when: t('המאות ה-3–2 לפנה"ס', '3rd–2nd centuries BCE', 'القرنان الثالث والثاني ق.م'), text: t('השטח השני, K1, נמצא כמאה מטרים צפונה מכאן.', 'The second area, K1, lies about a hundred metres north of here.', 'المنطقة الثانية، K1، تقع على بعد نحو مئة متر شمالًا من هنا.') } ],
      finds: []
    },

    /* ================= תל א-ראס ================= */
    {
      id: 'ras', group: 'arch', color: '#e58f7a',
      name: t('תל א-ראס', 'Tell er-Ras', 'تل الراس'),
      kind: t('מקדש רומי', 'Roman temple', 'معبد روماني'),
      center: [35.274771, 32.207754],
      ring: [[35.275576, 32.207527], [35.275528, 32.207108], [35.275388, 32.206739], [35.275174, 32.206466], [35.274911, 32.20632], [35.274632, 32.20632], [35.274369, 32.206466], [35.274155, 32.206739], [35.274015, 32.207108], [35.273967, 32.207527], [35.274015, 32.207946], [35.274155, 32.208315], [35.274369, 32.208588], [35.274632, 32.208734], [35.274911, 32.208734], [35.275174, 32.208588], [35.275388, 32.208315], [35.275528, 32.207946]],
      view: { zoom: 16.5, pitch: 64, bearing: -10 },
      summary: t(
        'השלוחה הצפונית של ההר, מעל שכם. רוברט בול חפר כאן בשנים 1964, 1966 ו-1968 וסבר שמצא מתחת למקדש הרומי את המקדש השומרוני. חפירה חוזרת בידי יצחק מגן הראתה שגם המבנה התחתון הוא שלב של המקדש הרומי, והצעתו של בול נדחתה.',
        'The northern spur of the mountain, above Nablus. Robert Bull excavated here in 1964, 1966 and 1968 and believed he had found the Samaritan temple beneath the Roman one. Re-excavation by Yitzhak Magen showed that the lower structure too is a phase of the Roman temple, and Bull\'s proposal was rejected.',
        'النتوء الشمالي للجبل، فوق نابلس. نقّب هنا روبرت بُل في الأعوام 1964 و1966 و1968 وظنّ أنه وجد الهيكل السامري تحت المعبد الروماني. وأظهر تنقيب لاحق أجراه يتسحاق ماغين أنّ المبنى السفلي أيضًا مرحلة من المعبد الروماني، فرُفض اقتراح بُل.'),
      strata: [
        { period: 'hellenistic', when: t('סוף המאה ה-2 לפנה"ס ואילך', 'late 2nd century BCE onwards', 'منذ أواخر القرن الثاني ق.م'),
          text: t('סמוך למקום שבו נבנה לימים המקדש הרומי נתגלו שרידי מצודה שהקימו החשמונאים; היא פיקחה על הדרך העולה להר.',
                  'Near the spot where the Roman temple was later built, remains of a fortress set up by the Hasmoneans were found; it controlled the road up the mountain.',
                  'قرب الموضع الذي بُني فيه المعبد الروماني لاحقًا عُثر على بقايا قلعة أقامها الحشمونيون؛ وكانت تشرف على الطريق الصاعدة إلى الجبل.') },
        { period: 'roman', when: t('המאה ה-2 לספירה', '2nd century CE', 'القرن الثاني م'),
          text: t('מקדש לזאוס על במה שבנה הקיסר אנטונינוס פיוס. בניין המקדש, כ-14 על 21 מ\', נחנך בסביבות 160 לספירה והושלם בראשית המאה ה-3; כתובת מן המקום מקדישה אותו לזאוס אולימפיוס. מדרגות עלו אליו מן העיר נאפוליס, והוא מצויר על מטבעותיה.',
                  'A temple of Zeus on a platform built by Emperor Antoninus Pius. The temple building, about 14 by 21 m, was dedicated around 160 CE and completed in the early 3rd century; an inscription from the site dedicates it to Zeus Olympios. Steps climbed to it from the city of Neapolis, and it is shown on the city\'s coins.',
                  'معبد لزيوس على منصّة بناها الإمبراطور أنطونينوس بيوس. مبنى المعبد، نحو 14 × 21 م، دُشّن نحو 160 م واكتمل في مطلع القرن الثالث؛ ويهديه نقش من الموقع إلى زيوس الأولمبي. كان يصعد إليه درج من مدينة نيابوليس، وهو مصوَّر على نقودها.') }
      ],
      finds: [
        t('מטבעות העיר נאפוליס מראים את ההר, את המקדש שבראשו ואת המדרגות העולות אליו',
          'The coins of the city of Neapolis show the mountain, the temple on its top and the steps climbing to it',
          'تُظهر نقود مدينة نيابوليس الجبل والمعبد على قمته والدرج الصاعد إليه'),
        t('שישה בורות מים; באחד מהם 43 מטבעות מן השנים 222–363 לספירה', 'Six cisterns; one of them held 43 coins of the years 222–363 CE', 'ستة صهاريج؛ في أحدها 43 قطعة نقدية من الأعوام 222–363 م')
      ]
    },

    /* ================= מקומות קדושים ================= */
    {
      id: 'stones12', group: 'holy', color: '#f2f2f2', labelFrom: 16.3,
      name: t('שתים עשרה האבנים', 'The Twelve Stones', 'الحجارة الاثنا عشر'),
      kind: t('מקום קדוש', 'Holy place', 'مكان مقدّس'),
      at: [-47, 0], size: [8, 18], view: { zoom: 18.0, pitch: 52, bearing: 80 },
      summary: t(
        'שורה של אבני גוויל גדולות, כ-6.5 על 18 מ\', ממערב לכנסייה. לדעת החופר זהו השריד היחיד מבניין המקדש של התקופה הפרסית, שלא פורק בשל קדושתו.',
        'A row of large rough stones, about 6.5 by 18 m, west of the church. The excavator regards it as the only remnant of the Persian-period temple building, left standing because of its sanctity.',
        'صف من حجارة غشيمة كبيرة، نحو 6.5 × 18 م، غرب الكنيسة. يرى المنقّب أنه البقية الوحيدة من مبنى الهيكل في الفترة الفارسية، وأنه لم يُفكَّك لقداسته.'),
      strata: [ { period: 'persian', when: t('המאה ה-5 לפנה"ס', '5th century BCE', 'القرن الخامس ق.م'),
          text: t('לידן, בצד הפנימי של המתחם, נמצא אחד מריכוזי עצמות הקורבנות.', 'Beside them, on the inner side of the precinct, one of the concentrations of sacrificial bones was found.', 'بجانبها، في الجهة الداخلية من الحرم، وُجد أحد تجمّعات عظام القرابين.') } ],
      finds: []
    },
    {
      id: 'eternal', group: 'holy', color: '#f2f2f2', labelFrom: 16.3,
      name: t('גבעת עולם', 'The Eternal Hill', 'جبعة عولام (التلة الأبدية)'),
      kind: t('מקום קדוש', 'Holy place', 'مكان مقدّس'),
      at: [0, -107], size: [18, 18], view: { zoom: 18.0, pitch: 52, bearing: -10 },
      summary: t(
        'משטח סלע בדרום הרמה, שבמסורת השומרונית הוא מקום המשכן. סוקרי המאה ה-19 תיארו משטח גיר משופע של כ-15 על 15 מ\', מוקף גושי אבן, בור עמוק בקצהו ורחבות תפילה מרוצפות סביבו.',
        'A rock surface on the south of the plateau, which Samaritan tradition holds to be the place of the Tabernacle. The 19th-century surveyors described a sloping limestone surface of about 15 by 15 m, ringed by blocks of stone, with a deep pit at its edge and paved prayer platforms around it.',
        'سطح صخري في جنوب الهضبة، هو في التقليد السامري موضع خيمة الاجتماع. وصف مسّاحو القرن التاسع عشر سطحًا جيريًا مائلًا نحو 15 × 15 م، تحيط به كتل حجرية، وفي طرفه حفرة عميقة وحوله مصاطب صلاة مبلّطة.'),
      strata: [], finds: []
    },
    {
      id: 'isaac', group: 'holy', color: '#f2f2f2', labelFrom: 16.3,
      name: t('מזבח עקדת יצחק', 'The Altar of Isaac\'s Binding', 'مذبح ذبح إسحاق'),
      kind: t('מקום קדוש', 'Holy place', 'مكان مقدّس'),
      at: [22, -186], size: [14, 14], view: { zoom: 18.0, pitch: 52, bearing: -10 },
      summary: t(
        'בפינה הדרום-מזרחית של הרמה. סוקרי המאה ה-19 תיארו תעלה חצובה בסלע, כ-2.4 על 1.5 מ\', שאליה יורדות ממערב שבע מדרגות חצי-עגולות.',
        'At the south-eastern corner of the plateau. The 19th-century surveyors described a trench cut in the rock, about 2.4 by 1.5 m, reached from the west by seven semicircular steps.',
        'في الزاوية الجنوبية الشرقية من الهضبة. وصف مسّاحو القرن التاسع عشر خندقًا منحوتًا في الصخر، نحو 2.4 × 1.5 م، تنزل إليه من الغرب سبع درجات نصف دائرية.'),
      strata: [], finds: []
    },

    {
      id: 'stations', group: 'holy', color: '#f2f2f2', nomap: true,
      name: t('שבע התחנות של העלייה לרגל', 'The seven stations of the pilgrimage', 'المحطات السبع للحجّ'),
      kind: t('מסלול העלייה לרגל', 'The pilgrimage route', 'مسار الحجّ'),
      summary: t(
        'שלוש פעמים בשנה, בחג המצות, בחג השבועות ובחג הסוכות, עולה העדה אל הפסגה ועוברת בין המקומות הקדושים, ובכל אחד מהם מניף הכהן את ספר התורה. הסדר שכאן הוא סדר חג המצות כפי שפרסם בנימים צדקה. מקורות אחרים מונים שש או שמונה תחנות, ויש שמות אחרים לחלקן.',
        'Three times a year, at the festivals of Unleavened Bread, Weeks and Tabernacles, the community ascends to the summit and passes between the holy places, and at each the priest raises the Torah scroll. The order given here is that of the Festival of Unleavened Bread as published by Benyamim Tsedaka. Other sources count six or eight stations, and some name them differently.',
        'ثلاث مرات في السنة، في عيد الفطير وعيد الأسابيع وعيد المظال، تصعد الطائفة إلى القمة وتمرّ بين الأماكن المقدسة، وفي كل منها يرفع الكاهن سفر التوراة. الترتيب هنا هو ترتيب عيد الفطير كما نشره بنياميم صدقة. تعدّ مصادر أخرى ستّ محطات أو ثماني، وتسمّي بعضها بأسماء أخرى.'),
      route: [
        { id: 'stones12' }, { id: 'adamseth' }, { id: 'eternal' }, { id: 'yireh' }, { id: 'isaac' }, { id: 'noah' },
        { id: 'eternal', note: t('שוב, לסיום העלייה', 'Again, to end the pilgrimage', 'مرة أخرى، لختام الحجّ') }
      ]
    },
    {
      id: 'adamseth', group: 'holy', color: '#f2f2f2', nomap: true,
      name: t('מזבח אדם ושת', 'The Altar of Adam and Seth', 'مذبح آدم وشيث'),
      kind: t('מקום קדוש', 'Holy place', 'مكان مقدّس'),
      summary: t(
        'לפי המסורת הקימו כאן אדם ובנו שת מזבח, ואדם הקריב בו את קורבנו הראשון.',
        'According to tradition Adam and his son Seth set up an altar here, and Adam offered his first sacrifice on it.',
        'بحسب التقليد أقام هنا آدم وابنه شيث مذبحًا، وقدّم عليه آدم قربانه الأول.')
    },
    {
      id: 'yireh', group: 'holy', color: '#f2f2f2', nomap: true,
      name: t('אלהים יראה', 'God Will Provide', 'الله يرى'),
      kind: t('מקום קדוש', 'Holy place', 'مكان مقدّس'),
      summary: t(
        'המקום שבו, לפי המסורת, ראה אברהם את האיל הנאחז בסבך: "אלהים יראה לו השה" (בראשית כ"ב, ח\').',
        'The place where, according to tradition, Abraham saw the ram caught in the thicket: "God will provide himself the lamb" (Genesis 22:8).',
        'المكان الذي رأى فيه إبراهيم، بحسب التقليد، الكبش الممسَك في الغابة: «الله يرى له الخروف» (التكوين 22: 8).')
    },
    {
      id: 'noah', group: 'holy', color: '#f2f2f2', nomap: true,
      name: t('מזבח נח', 'The Altar of Noah', 'مذبح نوح'),
      kind: t('מקום קדוש', 'Holy place', 'مكان مقدّس'),
      summary: t(
        'לפי המסורת הקריב כאן נח קורבן תודה בצאתו מן התיבה.',
        'According to tradition Noah offered a thanksgiving sacrifice here on leaving the ark.',
        'بحسب التقليد قدّم نوح هنا قربان شكر عند خروجه من الفلك.')
    },
    {
      id: 'tenth', group: 'holy', color: '#f2f2f2', nomap: true,
      name: t('שבעת ציוני המקום', 'The seven markers of the place', 'علامات المكان السبع'),
      kind: t('הדיבר העשירי ודברים י"א, ל\'', 'The Tenth Commandment and Deuteronomy 11:30', 'الوصية العاشرة والتثنية 11: 30'),
      summary: t(
        'התורה מציינת את מקום ההר בשבעה ציונים: הר גריזים; בעבר הירדן; אחרי דרך מבוא השמש; בארץ הכנעני היושב בערבה; מול הגלגל; אצל אלון מורא; מול שכם. "מול שכם" נמצא בנוסח שומרון בלבד. "אחרי דרך מבוא השמש" מתפרש במסורת כציון כיוון: ההר נמצא ממערב לירדן, לעבר שקיעת השמש.',
        'The Torah marks the place of the mountain in seven ways: Mount Gerizim; beyond the Jordan; behind the way of the going down of the sun; in the land of the Canaanite who dwells in the Arabah; opposite Gilgal; beside Elon Mora; opposite Shechem. "Opposite Shechem" is found in the Samaritan text only. "Behind the way of the going down of the sun" is understood in the tradition as a direction: the mountain lies west of the Jordan, towards the sunset.',
        'تحدّد التوراة موضع الجبل بسبع علامات: جبل جرزيم؛ في عبر الأردن؛ وراء طريق مغرب الشمس؛ في أرض الكنعاني الساكن في العربة؛ مقابل الجلجال؛ بجانب ألون مورا؛ مقابل شكيم. وعبارة «مقابل شكيم» موجودة في النص السامري وحده. وتُفهم عبارة «وراء طريق مغرب الشمس» في التقليد على أنها تحديد اتجاه: الجبل غرب الأردن، نحو مغيب الشمس.')
    },

    /* ================= קרוב לפסגה ================= */
    {
      id: 'luza', group: 'around', color: '#8ecbe6',
      name: t('קרית לוזה — שכונת השומרונים', 'Kiryat Luza — the Samaritan neighbourhood', 'قرية لوزة — حيّ السامريين'),
      kind: t('יישוב', 'Village', 'قرية'),
      center: [35.270081, 32.203399], view: { zoom: 16.6, pitch: 58, bearing: -60 },
      summary: t(
        'יישוב השומרונים על השלוחה המערבית של ההר, סמוך לפסגה. כאן בית הכנסת, המוזיאון, ומקום קורבן הפסח, שבו מתכנסת העדה כולה מדי שנה.',
        'The Samaritan village on the western spur of the mountain, close to the summit. Here are the synagogue, the museum, and the site of the Passover sacrifice, where the whole community gathers every year.',
        'قرية السامريين على النتوء الغربي للجبل، قرب القمة. فيها الكنيس والمتحف وموضع ذبيحة الفصح، حيث تجتمع الطائفة كلها كل عام.'),
      strata: [], finds: []
    }
  ];

  /* ================= סביבות ההר: מקומות שרואים מן הפסגה ================= */
  const around = [
    { id: 'balata', center: [35.281993, 32.213618],
      name: t('תל בלאטה — שכם הקדומה', 'Tell Balata — ancient Shechem', 'تل بلاطة — شكيم القديمة'),
      kind: t('תל ארכיאולוגי', 'Archaeological mound', 'تل أثري'),
      summary: t(
        'תל העיר שכם המקראית, במעבר שבין הר גריזים להר עיבל. נחפר בידי משלחת גרמנית מ-1913 ובידי משלחת אמריקנית מ-1956. נחשפו בו חומה אדירה, שער ומקדש-מגדל מתקופת הברונזה התיכונה.',
        'The mound of biblical Shechem, in the pass between Mount Gerizim and Mount Ebal. Excavated by a German expedition from 1913 and an American one from 1956. A massive wall, a gate and a fortress-temple of the Middle Bronze Age were uncovered.',
        'تل مدينة شكيم التوراتية، في الممر بين جبل جرزيم وجبل عيبال. نقّبت فيه بعثة ألمانية منذ 1913 وبعثة أمريكية منذ 1956. كُشف فيه سور ضخم وبوابة ومعبد-برج من العصر البرونزي الأوسط.') },
    { id: 'joseph', center: [35.2854733, 32.2126898],
      name: t('קבר יוסף', 'Joseph\'s Tomb', 'قبر يوسف'),
      kind: t('קבר מקודש', 'Venerated tomb', 'ضريح'),
      summary: t(
        'לפי המסורת, מקום קבורת יוסף ב"חלקת השדה" שליד שכם (יהושע כ"ד, ל"ב). המקום מקודש לשומרונים, ליהודים, לנוצרים ולמוסלמים. המבנה הנוכחי שופץ ב-1868.',
        'By tradition the burial place of Joseph in the "parcel of ground" by Shechem (Joshua 24:32). The site is holy to Samaritans, Jews, Christians and Muslims. The present structure was restored in 1868.',
        'بحسب التقليد موضع دفن يوسف في «قطعة الحقل» قرب شكيم (يشوع 24: 32). المكان مقدّس عند السامريين واليهود والمسيحيين والمسلمين. رُمّم المبنى الحالي سنة 1868.') },
    { id: 'well', center: [35.285430555556, 32.209447222222],
      name: t('באר יעקב', 'Jacob\'s Well', 'بئر يعقوب'),
      kind: t('באר עתיקה וכנסייה', 'Ancient well and church', 'بئر قديمة وكنيسة'),
      summary: t(
        'באר עמוקה לרגלי הר גריזים. כאן, לפי הבשורה על-פי יוחנן (פרק ד\'), אמרה האישה השומרונית: "אבותינו השתחוו בהר הזה". מעל הבאר כנסייה יוונית-אורתודוקסית, שבנייתה הושלמה ב-2007.',
        'A deep well at the foot of Mount Gerizim. Here, according to the Gospel of John (chapter 4), the Samaritan woman said: "Our fathers worshipped on this mountain." Above the well stands a Greek Orthodox church, completed in 2007.',
        'بئر عميقة عند سفح جبل جرزيم. هنا، بحسب إنجيل يوحنا (الإصحاح 4)، قالت المرأة السامرية: «آباؤنا سجدوا في هذا الجبل». وفوق البئر كنيسة للروم الأرثوذكس اكتمل بناؤها سنة 2007.') },
    { id: 'nablus', center: [35.260833, 32.221111], geo: { elev: 550, pop: 177638, popYear: 2024 },
      name: t('שכם — נאפוליס', 'Nablus — Neapolis', 'نابلس — نيابوليس'),
      kind: t('עיר', 'City', 'مدينة'),
      summary: t(
        'העיר שבעמק שבין שני ההרים, כ-49 ק"מ מצפון לירושלים. נוסדה בשם פלביה נאפוליס בשנת 72 לספירה, בימי הקיסר אספסיאנוס, ממערב לשכם הקדומה שבתל בלאטה; מן השם נאפוליס בא שמה הערבי, נאבלוס. מטבעותיה מראים את הר גריזים, את המקדש שבתל א-ראס ואת המדרגות העולות אליו.',
        'The city in the valley between the two mountains, about 49 km north of Jerusalem. It was founded as Flavia Neapolis in 72 CE, under Emperor Vespasian, west of ancient Shechem at Tell Balata; its Arabic name, Nablus, comes from Neapolis. Its coins show Mount Gerizim, the temple on Tell er-Ras and the steps climbing to it.',
        'المدينة في الوادي بين الجبلين، على نحو 49 كم شمال القدس. تأسست باسم فلافيا نيابوليس سنة 72 م، في عهد الإمبراطور فسبازيان، غرب شكيم القديمة في تل بلاطة؛ ومن اسم نيابوليس جاء اسمها العربي نابلس. تُظهر نقودها جبل جرزيم والمعبد على تل الراس والدرج الصاعد إليه.'),
      strata: [
        { period: 'roman', when: t('שנת 72 לספירה', '72 CE', 'سنة 72 م'),
          text: t('ייסוד פלביה נאפוליס.', 'The founding of Flavia Neapolis.', 'تأسيس فلافيا نيابوليس.') },
        { period: 'byzantine', when: t('המאות ה-5–6 לספירה', '5th–6th centuries CE', 'القرنان الخامس والسادس م'),
          text: t('מרידות השומרונים, שדוכאו סופית ב-573, דלדלו מאוד את העדה שבעיר. אחרי המרד של 484 נבנתה הכנסייה שבראש ההר.',
                  'The Samaritan revolts, finally put down in 573, greatly reduced the community in the city. After the revolt of 484 the church on the summit was built.',
                  'ثورات السامريين، التي أُخمدت نهائيًا سنة 573، قلّصت الطائفة في المدينة كثيرًا. وبعد ثورة سنة 484 بُنيت الكنيسة على القمة.') },
        { period: 'islamic', when: t('המאה ה-7 לספירה ואילך', '7th century CE onwards', 'منذ القرن السابع م'),
          text: t('העיר נקראת נאבלוס. בימי הצלבנים נוסחו בה חוקי ממלכת ירושלים, ואחריהם שלטו בה האיובים, הממלוכים והעות\'מאנים.',
                  'The city is called Nablus. Under the Crusaders the laws of the Kingdom of Jerusalem were drawn up here; after them came the Ayyubids, the Mamluks and the Ottomans.',
                  'تُسمّى المدينة نابلس. في عهد الصليبيين صيغت فيها قوانين مملكة القدس، وبعدهم حكمها الأيوبيون والمماليك والعثمانيون.') }
      ] },
    { id: 'oldcity', parent: 'nablus', center: [35.261389, 32.218889],
      name: t('העיר העתיקה של שכם', 'The Old City of Nablus', 'البلدة القديمة في نابلس'),
      kind: t('המרכז ההיסטורי', 'Historic centre', 'المركز التاريخي'),
      summary: t(
        'המרכז ההיסטורי של העיר, שנוסד כעיר רומית ולא חדל להיות מיושב. יש בו יותר ממאה מבנים היסטוריים, ושווקים של אריגים, תבלינים וסבון. בכיכר המרכזית עומדים מסגד א-נצר, שכיפתו ירוקה, ומגדל השעון בן חמש הקומות, שהוקם ב-1906 לציון שלושים שנות מלכותו של הסולטאן עבד אל-חמיד השני. בעיר העתיקה גם ח\'אן א-תג\'אר, חאן סוחרים מן המאה ה-15. בשכונת אל-יאסמינה שבה ישבה העדה השומרונית עד רעידת האדמה של 1927.',
        'The historic centre of the city, founded as a Roman town and inhabited ever since. It holds more than a hundred historic buildings, and markets for textiles, spices and soap. In the central square stand the An-Nasr Mosque, with its green dome, and the five-storey clock tower put up in 1906 to mark thirty years of Sultan Abdul Hamid II\'s reign. The Old City also holds Khan al-Tujjar, a merchants\' caravanserai of the 15th century. The Samaritan community lived in its al-Yasmina quarter until the earthquake of 1927.',
        'المركز التاريخي للمدينة، تأسس مدينةً رومانية ولم ينقطع السكن فيه. فيه أكثر من مئة مبنى تاريخي، وأسواق للأقمشة والتوابل والصابون. في الساحة المركزية جامع النصر بقبّته الخضراء، وبرج الساعة ذو الطوابق الخمسة، الذي أُقيم سنة 1906 احتفالًا بمرور ثلاثين عامًا على حكم السلطان عبد الحميد الثاني. وفي البلدة القديمة أيضًا خان التجار، وهو خان من القرن الخامس عشر. وفي حارة الياسمينة منها سكنت الطائفة السامرية حتى زلزال سنة 1927.') },
    { id: 'greatmosque', parent: 'nablus', center: [35.269344, 32.218006],
      name: t('המסגד הגדול של שכם', 'The Great Mosque of Nablus', 'الجامع الكبير في نابلس'),
      kind: t('מסגד, במקורו כנסייה', 'Mosque, originally a church', 'جامع، كان في الأصل كنيسة'),
      summary: t(
        'המסגד העתיק והגדול בעיר, בקצה המזרחי של העיר העתיקה, בצומת רחובותיה הראשיים. נבנה במקורו ככנסייה ביזנטית והיה למסגד בראשית התקופה האסלאמית; הצלבנים חזרו ועשוהו כנסייה, והאיובים קידשוהו מחדש כמסגד במאה ה-12. תוכניתו מלבן ארוך וצר, וכיפתו כסופה.',
        'The oldest and largest mosque in the city, at the eastern edge of the Old City where its main streets cross. It was first built as a Byzantine church and became a mosque in the early Islamic era; the Crusaders turned it back into a church, and the Ayyubids reconsecrated it as a mosque in the 12th century. Its plan is a long, narrow rectangle, and its dome is silver.',
        'أقدم جوامع المدينة وأكبرها، عند الطرف الشرقي للبلدة القديمة حيث تتقاطع شوارعها الرئيسة. بُني في الأصل كنيسةً بيزنطية وصار جامعًا في صدر الإسلام؛ ثم أعاده الصليبيون كنيسة، وأعاده الأيوبيون جامعًا في القرن الثاني عشر. مخططه مستطيل طويل ضيّق، وقبّته فضية.') },
    { id: 'ebal', center: [35.2733, 32.234], geo: { elev: 940 },
      name: t('הר עיבל', 'Mount Ebal', 'جبل عيبال'),
      kind: t('הר', 'Mountain', 'جبل'),
      summary: t(
        'ההר שמנגד, מצפון לעמק שכם. "ונתת את הברכה על הר גריזים ואת הקללה על הר עיבל" (דברים י"א, כ"ט). בנוסח שומרון מצוות הקמת המזבח (דברים כ"ז, ד\') היא בהר גריזים; בנוסח המסורה כתוב שם הר עיבל. ההר מן הגבוהים בשומרון, גבוה מהר גריזים בכ-60 מ\', ושטחו כ-17 קמ"ר; במדרונותיו מערות גדולות שהיו כנראה מחצבות, ולרגליו מצפון קברים חצובים.',
        'The mountain opposite, north of the Shechem valley. "You shall set the blessing on Mount Gerizim and the curse on Mount Ebal" (Deuteronomy 11:29). In the Samaritan text the command to build the altar (Deuteronomy 27:4) names Mount Gerizim; the Masoretic text reads Mount Ebal there. The mountain is among the highest in Samaria, some 60 m higher than Mount Gerizim, and covers about 17 sq km; its slopes hold large caverns that were probably quarries, and at its northern foot are rock-cut tombs.',
        'الجبل المقابل، شمال وادي شكيم. «تجعل البركة على جبل جرزيم واللعنة على جبل عيبال» (التثنية 11: 29). في النص السامري وصية بناء المذبح (التثنية 27: 4) تذكر جبل جرزيم؛ وفي النص الماسوري يرد هناك جبل عيبال. وهو من أعلى جبال السامرة، يعلو جبل جرزيم بنحو 60 م، ومساحته نحو 17 كم²؛ وفي منحدراته مغاور كبيرة كانت على الأرجح محاجر، وعند سفحه الشمالي قبور منحوتة.') },
    { id: 'ebalsite', center: [35.287485, 32.239623], geo: { elev: 785 },
      name: t('האתר בהר עיבל', 'The Mount Ebal site', 'موقع جبل عيبال'),
      kind: t('אתר ארכיאולוגי', 'Archaeological site', 'موقع أثري'),
      summary: t(
        'מבנה אבן מתקופת הברזל הקדומה על כתף הר עיבל, שנחפר בידי אדם זרטל בשנים 1982–1989. זרטל זיהה בו את מזבח יהושע; הזיהוי שנוי במחלוקת בין החוקרים.',
        'A stone structure of the early Iron Age on the shoulder of Mount Ebal, excavated by Adam Zertal in 1982–1989. Zertal identified it as Joshua\'s altar; the identification is disputed among scholars.',
        'مبنى حجري من العصر الحديدي المبكر على كتف جبل عيبال، نقّب فيه آدم زرطال في الأعوام 1982–1989. عرّفه زرطال بأنه مذبح يشوع؛ وهذا التعريف موضع خلاف بين الباحثين.') },
    { id: 'elonmora', center: [35.2880, 32.2108], group: 'holy', color: '#f2f2f2',
      name: t('אלון מורא — חלקת השדה', 'Elon Mora — the Parcel of Ground', 'ألون مورا — قطعة الحقل'),
      kind: t('המישור שלרגלי ההר', 'The plain at the foot of the mountain', 'السهل عند سفح الجبل'),
      summary: t(
        '"ויעבר אברם בארץ עד מקום שכם עד אלון מורא" (בראשית י"ב, ו\'). במסורת השומרונית אלון מורא הוא המישור שלרגלי ההר, לצד שכם; יעקב קנה אותו, ומאז נקרא חלקת השדה, וקבר יוסף בפינתו. הסימון על המפה משוער.',
        '"Abram passed through the land to the place of Shechem, to Elon Mora" (Genesis 12:6). In Samaritan tradition Elon Mora is the plain at the foot of the mountain, beside Shechem; Jacob bought it, and it has since been called the Parcel of Ground, with Joseph\'s Tomb at its corner. The mark on the map is approximate.',
        '«واجتاز أبرام في الأرض إلى مكان شكيم إلى ألون مورا» (التكوين 12: 6). في التقليد السامري ألون مورا هو السهل عند سفح الجبل، بجانب شكيم؛ اشتراه يعقوب فسُمّي منذئذ قطعة الحقل، وقبر يوسف في زاويته. والعلامة على الخريطة تقريبية.') },
    { id: 'elon', center: [35.33138889, 32.23388889], geo: { elev: 635, pop: 2009, popYear: 2021 },
      name: t('היישוב אלון מורה', 'The settlement of Elon Moreh', 'مستوطنة ألون موريه'),
      kind: t('יישוב על הר כביר', 'Settlement on Mount Kabir', 'مستوطنة على جبل الكبير'),
      summary: t(
        'יישוב על הר כביר, ממזרח לשכם. שמו מודרני, על שם אלון מורה שבתורה, ואין הוא המקום שהמסורת מצביעה עליו: זה נמצא במישור שלרגלי הר גריזים.',
        'A settlement on Mount Kabir, east of Nablus. Its name is modern, taken from the Elon Moreh of the Torah, and it is not the place tradition points to, which lies in the plain at the foot of Mount Gerizim.',
        'مستوطنة على جبل الكبير، شرق نابلس. اسمها حديث، مأخوذ من ألون موريه في التوراة، وليست المكان الذي يشير إليه التقليد، فهذا في السهل عند سفح جبل جرزيم.') },
    { id: 'brakha', center: [35.26527778, 32.19277778], geo: { elev: 850, pop: 3062, popYear: 2021 },
      name: t('הר ברכה', 'Har Brakha', 'هار براخا'),
      kind: t('יישוב', 'Settlement', 'مستوطنة'),
      summary: t(
        'יישוב על הרכס הדרומי של הר גריזים, שנוסד ב-1983. שמו בא מכינוי ההר, הר הברכה.',
        'A settlement on the southern ridge of Mount Gerizim, founded in 1983. Its name comes from the mountain\'s epithet, the Mount of Blessing.',
        'مستوطنة على السلسلة الجنوبية لجبل جرزيم، تأسست سنة 1983. اسمها مأخوذ من لقب الجبل، جبل البركة.') },
    { id: 'birhamam', center: [35.2649, 32.21], color: '#7fb6e6',
      name: t('מנזר ביר אל-חמאם', 'The monastery of Bir el-Hamam', 'دير بئر الحمام'),
      kind: t('מנזר ביזנטי', 'Byzantine monastery', 'دير بيزنطي'),
      summary: t(
        'מנזר קטן מן התקופה הביזנטית בכתף הצפון-מערבית של ההר, כ-28 על 24 מ\', מוקף חומה. יש בו חצר מרוצפת, שני בורות מים, מטבח, אורווה, וקפלה שרצפתה פסיפס צבעוני. הוא התגלה ב-2001 בעבודות הבנייה של "בית פלסטין", ונשמר בקומת המסד של הבניין כאתר פתוח למבקרים. מיקומו כאן מקורב.',
        'A small Byzantine-period monastery on the north-western shoulder of the mountain, about 28 by 24 m, within a wall. It has a paved courtyard, two cisterns, a kitchen, a stable, and a chapel with a coloured mosaic floor. It was discovered in 2001 during the building of the "House of Palestine" and is preserved in the basement level of that building as a site open to visitors. Its position here is approximate.',
        'دير صغير من الفترة البيزنطية على الكتف الشمالي الغربي للجبل، نحو 28 × 24 م، يحيط به سور. فيه فناء مبلّط وبئران ومطبخ وإسطبل، ومصلّى أرضيته من الفسيفساء الملوّنة. اكتُشف سنة 2001 في أثناء بناء «بيت فلسطين»، وحُفظ في الطابق السفلي من المبنى موقعًا مفتوحًا للزوّار. وموضعه هنا تقريبي.'),
      strata: [ { period: 'byzantine', when: t('התקופה הביזנטית', 'Byzantine period', 'الفترة البيزنطية'),
          text: t('המנזר והקפלה. חפירת הצלה נערכה ב-2001 בידי מחלקת העתיקות הפלסטינית ואוניברסיטת א-נג\'אח, ועבודות השימור ב-2004.',
                  'The monastery and its chapel. A salvage excavation was carried out in 2001 by the Palestinian Department of Antiquities and An-Najah University, and conservation work in 2004.',
                  'الدير ومصلّاه. أُجريت حفرية إنقاذية سنة 2001 على يد دائرة الآثار الفلسطينية وجامعة النجاح، وأعمال الترميم سنة 2004.') } ],
      finds: [
        t('כתובת הקדשה יוונית בקפלה, לזכר שלושה "אחים אוהבי המשיח"', 'A Greek dedicatory inscription in the chapel, in memory of three "brothers, lovers of Christ"', 'نقش إهداء يوناني في المصلّى لذكرى ثلاثة «إخوة محبّين للمسيح»'),
        t('סורג מעוטר שהפריד את הבמה ושולחן המזבח משאר הקפלה, ונברשות', 'A decorated chancel screen separating the bema and altar table from the rest of the chapel, and chandeliers', 'حاجز مزخرف يفصل المنصّة ومائدة المذبح عن سائر المصلّى، وثريّات')
      ] },
    { id: 'asira', center: [35.267003, 32.250678], unseen: true, geo: { pop: 8813, popYear: 2017 },
      name: t('עסירה א-שמאליה', 'Asira ash-Shamaliya', 'عصيرة الشمالية'),
      kind: t('עיירה', 'Town', 'بلدة'),
      summary: t(
        'עיירה מעבר להר עיבל, כ-3.5 ק"מ מצפון לשכם. מן הפסגה היא נסתרת מאחורי ההר; הסימון מראה את כיוונה.',
        'A town beyond Mount Ebal, about 3.5 km north of Nablus. From the summit it is hidden behind the mountain; the marker shows its direction.',
        'بلدة وراء جبل عيبال، على نحو 3.5 كم شمال نابلس. وهي من القمة محجوبة خلف الجبل؛ والعلامة تبيّن اتجاهها.') },
    { id: 'tirzah', center: [35.3378, 32.2874], unseen: true,
      name: t('תל אל-פארעה — תרצה', 'Tell el-Far\'ah — Tirzah', 'تل الفارعة — ترصة'),
      kind: t('תל ארכיאולוגי', 'Archaeological mound', 'تل أثري'),
      summary: t(
        'תל מצפון-מזרח לשכם, ליד הכפר ואדי אל-פארעה, בראש הנחל היורד אל הירדן. מקובל לזהות בו את תרצה, עיר בהרי שומרון הנזכרת במקרא.',
        'A mound north-east of Nablus, by the village of Wadi al-Far\'a, at the head of the valley running down to the Jordan. It is generally identified with Tirzah, a town of the Samarian highlands mentioned in the Bible.',
        'تل شمال شرق نابلس، قرب قرية وادي الفارعة، عند رأس الوادي النازل إلى الأردن. يُعرَّف عادةً بأنه ترصة، مدينة في جبال السامرة ورد ذكرها في الكتاب المقدّس.') },
    { id: 'salim', center: [35.333333, 32.216667], geo: { pop: 6266, popYear: 2017 },
      name: t('סאלם', 'Salim', 'سالم'),
      kind: t('עיירה', 'Town', 'بلدة'),
      summary: t(
        'עיירה כשישה ק"מ ממזרח לשכם. יש המזהים בה את "שלם" שבנוסח המסורה לבראשית ל"ג, י"ח: "ויבא יעקב שלם עיר שכם". בנוסח שומרון כתוב שם "שלום": יעקב בא אל שכם בשלום, ואין זה שם מקום.',
        'A town about six kilometres east of Nablus. Some identify it with the "Shalem" of the Masoretic text of Genesis 33:18, "And Jacob came to Shalem, a city of Shechem". The Samaritan text reads "shalom" there: Jacob came to Shechem in peace, and no place is named.',
        'بلدة على نحو ستة كيلومترات شرق نابلس. يعرّفها بعضهم بـ«شاليم» الواردة في النص الماسوري للتكوين 33: 18: «وأتى يعقوب شاليم مدينة شكيم». وفي النص السامري ترد هناك كلمة «شالوم»: أي أنّ يعقوب أتى شكيم بسلام، وليس ذلك اسم مكان.') },
    { id: 'kafrqallil', center: [35.276139, 32.191211], geo: { pop: 3029, popYear: 2017 },
      name: t('כפר קליל', 'Kafr Qallil', 'كفر قلّيل'),
      kind: t('עיירה', 'Town', 'بلدة'),
      summary: t(
        'עיירה על המדרון הדרום-מזרחי של הר גריזים, כקילומטר מן הפסגה.',
        'A town on the south-eastern slope of Mount Gerizim, about a kilometre from the summit.',
        'بلدة على المنحدر الجنوبي الشرقي لجبل جرزيم، على نحو كيلومتر من القمة.') },
    { id: 'sartaba', center: [35.46139, 32.09583],
      name: t('סרטבה — אלכסנדריון', 'Sartaba — Alexandrium', 'قرن سرطبة — الإسكندريون'),
      kind: t('מבצר חשמונאי', 'Hasmonean fortress', 'حصن حشموني'),
      summary: t(
        'מבצר בראש גבעה חדה וחשופה המתנשאת מעל בקעת הירדן ממערב, בין בית שאן לירושלים. הקימו אותו החשמונאים, והוא נקרא כנראה על שם המלך אלכסנדר ינאי. במשנה ובתלמוד נקרא המקום סרטבה, ובערבית קרן סרטבה; לפי המשנה היה אחת התחנות שבהן השיאו משואות להודיע על קידוש החודש (ראש השנה ב\', ד\').',
        'A fortress on a pointed, bare hill towering over the Jordan Valley from the west, between Scythopolis and Jerusalem. It was built by the Hasmoneans and probably named after King Alexander Jannaeus. The Mishnah and Talmud call the place Sartaba, and in Arabic it is Qarn Sartaba; according to the Mishnah it was one of the stations where beacons were lit to announce the new month (Rosh Hashanah 2:4).',
        'حصن على رأس تلّة مدبّبة جرداء تشرف على غور الأردن من الغرب، بين بيسان والقدس. بناه الحشمونيون، وسُمّي على الأرجح باسم الملك ألكسندر يناي. يُسمّى المكان في المشنا والتلمود سرطبة، وبالعربية قرن سرطبة؛ وبحسب المشنا كان إحدى المحطات التي كانت توقد فيها المشاعل لإعلان رأس الشهر (روش هشانا 2: 4).'),
      strata: [ { period: 'hellenistic', when: t('ראשית המאה ה-1 לפנה"ס', 'early 1st century BCE', 'مطلع القرن الأول ق.م'),
          text: t('מבצר חשמונאי, מימי אלכסנדר ינאי (104–77 לפנה"ס).', 'A Hasmonean fortress, of the days of Alexander Jannaeus (104–77 BCE).', 'حصن حشموني، من أيام ألكسندر يناي (104–77 ق.م).') } ] },
    { id: 'awarta', center: [35.28638889, 32.16138889], geo: { elev: 497, pop: 7054, popYear: 2017 },
      name: t('עוורתא', 'Awarta', 'عورتا'),
      kind: t('כפר וקברי הכוהנים', 'Village and tombs of the priests', 'قرية وقبور الكهنة'),
      summary: t(
        'כפר מדרום-מזרח להר. לפי המסורת נמצאים בו קברי אלעזר ואיתמר בני אהרן, פינחס בן אלעזר ושבעים הזקנים, והם מקודשים לשומרונים.',
        'A village south-east of the mountain. By tradition it holds the tombs of Eleazar and Ithamar the sons of Aaron, of Phinehas son of Eleazar and of the seventy elders, which are holy to the Samaritans.',
        'قرية جنوب شرق الجبل. فيها بحسب التقليد قبور ألعازار وإيثامار ابنَي هارون، وفينحاس بن ألعازار والشيوخ السبعين، وهي مقدّسة عند السامريين.') },
    { id: 'tapuach', center: [35.25, 32.11805556], geo: { elev: 670, pop: 1522, popYear: 2021 },
      name: t('תפוח', 'Tapuach', 'تفوح'),
      kind: t('יישוב וצומת', 'Settlement and junction', 'مستوطنة ومفترق'),
      summary: t(
        'היישוב כפר תפוח, מדרום להר, נוסד ב-1978 ונקרא על שם תפוח המקראית שבגבול אפרים ומנשה (יהושע י"ז, ח\').',
        'The settlement of Kfar Tapuach, south of the mountain, was founded in 1978 and named after biblical Tappuah on the border of Ephraim and Manasseh (Joshua 17:8).',
        'مستوطنة كفار تبواح، جنوب الجبل، تأسست سنة 1978 وسُمّيت على اسم تفوح التوراتية على حدود أفرايم ومنسّى (يشوع 17: 8).') },
    { id: 'jordan', center: [35.72, 32.25],
      name: t('הרי עבר הירדן', 'The mountains beyond the Jordan', 'جبال شرق الأردن'),
      kind: t('קו הרקיע במזרח', 'The skyline to the east', 'خط الأفق شرقًا'),
      summary: t(
        'ביום בהיר נראים מן הפסגה, מעבר לבקעת הירדן, הרי הגלעד.',
        'On a clear day the mountains of Gilead are visible from the summit, across the Jordan valley.',
        'في يوم صافٍ تُرى من القمة جبال جلعاد، عبر غور الأردن.') },
    { id: 'sebastia', center: [35.19583333, 32.27666667],
      name: t('סבסטיה — שומרון', 'Sebastia — Samaria', 'سبسطية — السامرة'),
      kind: t('עיר עתיקה', 'Ancient city', 'مدينة قديمة'),
      summary: t(
        'העיר שומרון, בירת ממלכת ישראל שייסד המלך עמרי. הורדוס בנה אותה מחדש וקרא לה סבסטי.',
        'The city of Samaria, capital of the kingdom of Israel, founded by King Omri. Herod rebuilt it and named it Sebaste.',
        'مدينة السامرة، عاصمة مملكة إسرائيل التي أسسها الملك عُمري. أعاد هيرودس بناءها وسمّاها سبسطي.') }
  ].map(p => Object.assign({ group: 'around', color: '#8ecbe6', far: true, strata: [], finds: [] }, p));

  window.GERIZIM = {
    church: [35.273441, 32.201236],              // מרכז הכנסייה המתומנת — נקודת הייחוס לכל המדידות
    home: { center: [35.2736, 32.2022], zoom: 15.5, pitch: 62, bearing: 18 },
    reach: 1000,                                  // כמה מטרים מותר להתרחק מן הפסגה, לכל כיוון
    periods, groups,
    places: places.concat(around),
    tour: ['precinct', 'eaststairs', 'church', 'octagon', 'ghanim', 'stones12', 'eternal', 'isaac', 'areaP', 'areaA', 'luza', 'ras'],
    introText: 'והרגריזים· בית· אל· כל· ימי· חיינו'
  };
})();
