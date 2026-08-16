# -*- coding: utf-8 -*-
"""Hand-built vocabularies for the אוצר השירה השומרונית index.

The archive mixes three naming habits:
  * Hebrew folders     — "אל שער השמים - סעדיה מרחיב"
  * kunya nicknames    — "אבו וואל", "הכהן חדיר"
  * transliterated     — "Al Shaar Ashamem", "Niftah Fiyanu"

These tables fold all three onto one canonical name so a search for
"אל שער השמים" finds the transliterated recordings too.
"""

# ---------------------------------------------------------------- performers
# canonical name -> aliases as they appear in folder / file names
PERFORMERS = {
    # Names corrected to their full Samaritan form; the kunya nicknames the
    # archive was filed under stay on as aliases, so old folder names still
    # resolve and several former "performers" now fold into one person.
    'עדי בן ברוך מרחיב':      ['סעדיה מרחיב', 'סעידה מרחיב', 'סעדיה',
                               'saadia marhiv', 'saadia'],
    'אברהם נור צדקה':          ['נור אילפגרי', 'abraham nur sedaka'],
    'יפת צדקה':               ['יפת(חוסני) צדקה', 'יפת חוסני צדקה', 'יפת'],
    'רצון צדקה':              ['רצון  צדקה', 'רצון ובני צדקה', 'רצון'],
    'מנשה צדקה':              ['מנשה'],
    'אורה צדקה':              [],
    'גבריאל אברהם צדקה':       [],
    'צודיק צדקה':             ['צודיק'],
    'חפץ מרחיב':              ['הכהן אבו פרג', 'אבו פרג', 'abu faraj',
                               'ראראב מרחיב', 'rareb marhiv'],
    'עזיזה מרחיב':            [],
    'הכהן הגדול אהרן בן אב חסדה': ['הכהן אבו וואל', 'אבו וואל', 'abu wael',
                                   'אהרן כהן', 'אהרן הכהן'],
    'הכהן הגדול יוסף בן אב חסדה': ['הכהן אבו פתחי', 'אבו פתחי'],
    'הכהן פינחס בן אברהם':     ['הכהן חאדיר', 'הכהן חדיר', 'hadir elkahen',
                               'חאדיר', 'חדיר', 'פינחס כהן', 'פינחס בן אברהם',
                               'פינחס בן באברהם'],
    'הכהן נתנאל בן אברהם':     ['נתנאל כהן'],
    'הכהן אברהם בן פינחס':     ['הכהן ברהים', 'ברהים'],
    'הכהן אבו עאבד':          ['אבו עאבד', 'aaed alkahen', 'abu abed'],
    'הכהן ברית':              ['ברית כהן', 'ברית בן טביה', 'ברית'],
    'עדן כהן':                [],
    'תקי כהן':                ['תופיק כהן ( אבו תקי)', 'תופיק כהן', 'אבו תקי'],
    'הכהן תופיק (אבו ראלב)':  ['הכהן תופיק ( אבו ראלב)', 'אבו ראלב'],
    'נתן יהושע':              [],
    'ארז יהושע':              [],
    'נתן וארז יהושע':          [],
    'אושר ששוני':             ['אושר'],
    'אורי ששוני':             ['אורי - תורה', 'uri-nuri sirawi', 'uri sirawi',
                               'הכהן אבו תמי', 'אבו תמי'],
    'מאיר ששוני':             ['מאיר ששוני - כל התורה'],
    'אלעד ששוני':             [],
    'הראל ששוני':             [],
    'שלבי חלמי אלטיף':         ['דוד שלבי אלטיף', 'שלבי חילמי', 'שלבי'],
    'פיאד חליל':              ["פי'אד חליל"],
    'סבא וסבתא':              [],
    'לא ידוע':                ['לא נודע'],
}

# Kept out of the public index. Their recordings stay in the data and an admin
# still sees them, so the decision is reversible.
HIDDEN_PERFORMERS = {'סבא וסבתא'}

# folders that are collections / sources rather than a performer
NON_PERFORMER_TOPS = {
    'שיראן ניר', 'הקלטות ישנות', 'ראיונות ודברי הסבר', 'קלטת  הכהנים הגדולים',
    'זבח פסח 68', 'תורה', 'בעבודה', '‏‏תיקיה חדשה', 'לא נודע',
    'תורה -בראשית - פינחס בן באברהם', 'חפץ מרחיב + יפת צדקה',
}

# ------------------------------------------------------------ events / חגים
# canonical event -> aliases (folder segments, Hebrew + transliterated)
EVENTS = {
    'יום הכיפורים': [
        'כיפור', 'kipur', 'האזינו כיפור', 'מליפוטים ליום הכיפור', 'malifutem',
        'יום כיפור', 'כיפור בוקר+ערב',
    ],
    'שבת הסליחות': ['שבת סליחות', 'shabbat seliyot', 'מזרח הסליחן'],
    'חג הפסח': [
        'פסח', 'pesaach', 'pesach', 'מוסם פסח', 'זבח פסח', 'zevach pessach',
        'זבח פסח 68', 'פרשת זבח הפסח', 'haadesh ha raaishon', 'החדש הראשון',
        'מועד החודש הראשון',
    ],
    'חג המצות': [
        'צמות הפסח', 'tsimmot pessach', 'שבת חג המצות', 'shabbat mued hamassot',
        'שבת צמות הפסח', 'שבת מועד המצות',
    ],
    'חג השבועות': [
        'shavuot', 'שבועות', 'שבת עמלק', 'shabbat amalek', 'שבת עמלק - פאוואה',
    ],
    'מעמד הר סיני': [
        'מעמד הר סיני', 'yom maamad har sini', 'יום מעמד הר סיני',
    ],
    'חג הסוכות': [
        'סכות', 'סוכות', 'sukkot', 'מוסם סכות', 'shabbat mued hassakot',
        'shabbat mued hassakot', 'שבת סכות', 'צמות הסכות', 'שבת מועד הסכות',
    ],
    'שמיני עצרת': ['שמיני עצרת', 'shemini atseret'],
    'ראש החודש השביעי': [
        'מועד ראש החודש השביעי', 'ראש החודש השביעי', 'חגי החודש השביעי',
        'ראש חודש',
    ],
    'שבת': [
        'שבת', 'shabbat', 'ערב שבת', 'תפילת בוקר', 'תפילת צהריים',
        'תפילת מוצאי שבת', 'מוצאי שבת', 'הקלטות לשבת', 'עמידות  השבת בבקר',
        'עמידות השבת בבקר', 'shabbau-boker', 'amidot tfilat boker',
        'bate markeh-tsohoraiim', 'שבת ראשונה', 'שבת שניה', 'שבת שלישית',
        'שבת רביעית', 'שבת חמישית',
    ],
    'ימי חול': ['ימי חול', 'אור הבקר', 'or habbekar', 'תיפלת בוקר יחיד'],
    'עלייה לרגל': [
        'עליה לרגל', 'aliya laregel', 'aliya laregel', 'שלש רגלים',
        'שלוש רגלים', 'זיארה',
    ],
    'מועדים': ['מועדים-שבתות מועדים', 'מועד חול', 'מועדים'],
    'שמחות': ['שמחות', 'משכרה', 'שמחה', 'מולד משה'],
    'קריאה בתורה': [
        'קריאה בתורה', 'כל התורה', 'תורה', 'parasha', 'פרשה', 'בראשית',
    ],
    'ראיונות ודברי הסבר': [
        'ראיונות ודברי הסבר', 'ראיון', 'שיחת סקר', 'מתוך הסרט של בול 1966',
    ],
    'שונות': ['שונות', 'shonot', 'שירה', 'בעבודה'],
}

# --------------------------------------------------- transliterated piyyutim
# transliterated folder name -> Hebrew piyyut name
TRANSLIT = {
    'al feta rehemek nigah-shira': 'אל פתח רחמיך נגש',
    'al shaar ashamem': 'אל שער השמים',
    'al shaar ashamem+ barek elhanu': 'אל שער השמים + בריך אלהנו',
    'barek elhanu': 'בריך אלהנו',
    'bafam kadesh': 'בפם קדש',
    'eluwe abraham yussiak': 'אלהי אברהם יוציאך',
    'eti af shelam': 'אתי בשלם',
    'eti afshelam': 'אתי בשלם',
    'fassil-baarti hra mikrbi': 'פציל — בערתי הרע מקרבי',
    'haazinu-boker': 'האזינו — תפילת בוקר',
    'malifutem': 'מליפוטים',
    'niftah fiyanu': 'נפתח פינו',
    'sela lanu': 'סלח לנו',
    'shabbau -bamini tashbaata': 'שבחו — במיני תשבחתה',
    'bamini tashbaata': 'במיני תשבחתה',
    'shob mi yaron': 'שוב מחרון',
    'uyannau': 'ויאנחו',
    'yam haremem': 'ים הרחמים',
    'aliya laregel': 'עלייה לרגל',
    "'mbarrak-aliya laregel": 'מברך — עלייה לרגל',
    'haadesh ha raaishon': 'החדש הראשון',
    'mufatem': 'מופתים',
    'shabbat mued hamassot': 'שבת מועד המצות',
    'tsimmot pessach': 'צמות הפסח',
    'zevach pessach': 'זבח הפסח',
    'adek alinan': 'אדיק עלינן',
    'amidot tfilat boker': 'עמידות — תפילת בוקר',
    'bate dustan+ ab giluga': 'בתי דוסתאן + אב גלוגה',
    'bate markeh-tsohoraiim': 'בתי מרקה — תפילת צהריים',
    'haad u shema anikbad': 'אחד הוא — שמע הנכבד',
    'hasehlam-end': 'השלם',
    'shabbau-boker': 'שבחו — תפילת בוקר',
    'shallau': 'שלחו',
    'eshol sidkat ela': 'אשול צדקת אלה',
    'maran yekabel-gadol': 'מרן יקבל — כבד',
    'shabbat amalek': 'שבת עמלק',
    'yom maamad har sini': 'יום מעמד הר סיני',
    'al kal moed rashet': 'אל כל מועד ראשית',
    'maran shurot- minni lak ma tidrah': 'מרן שורות — מני לך מה תדרש',
    'muedi-shira': 'מועדי — שירה',
    'az yashar-hagim': 'אז ישר — חגים',
    'az yashar pasuk': 'אז ישר — פסוק',
    'bareku u shabbau': 'ברכו ושבחו',
    'ha sibyan': 'הא סביען',
    'or habbekar': 'אור הבקר',
    'shamaaot': 'שמעות',
    'shemma ela-shabbat-hagim': 'שמע אלה — שבת וחגים',
    'shabbat mued hassakot': 'שבת מועד הסכות',
    'hassakot-shira': 'הסכות — שירה',
    'takes degeli haulam': 'טקס דגלי העולם',
    'yishar nashbee kahhalan-kaved': 'ישר נשוה כהלן — כבד',
    'az hael': 'אז האל',
    'mimari+akrau+shibu': 'מימרי + אקראו + שבחו',
    'seluta eikalalat': 'צלותה הכללת',
    'al yam aseliyan': 'אל ים הסליחן',
    'attau adbarek alama-kaved': 'אתהו דבריך עלמה — כבד',
    'kayami': 'כימי',
    'kayami-afshemak neshari': 'כימי — בשמך נשרי',
    'kayami-eluwe man haberet': 'כימי — אלהי מן הברית שמור',
    'ehe yishrael shob': 'אהה ישראל שוב',
    'ehe kahhal yishrael': 'אהה קהל ישראל',
    'eluwe masnefet': 'אלהי מצנפת הברית',
    'yishtabba': 'ישתבח',
    'yishtabah': 'ישתבח',
    'yshtabah': 'ישתבח',
    'yishtabba-eila ad sammet': 'ישתבח — אילה עד סמת',
    'yishtaba-mufat tanen': 'ישתבח — מופת תנין',
    'fa ele kal ma yebhar': 'פעלה כל מה יבחר',
    'hayarosh al kal yarosh': 'הירוש על כל ירוש',
    'hatamed belautu': 'התמיד באלהותו',
    'mufat barad- hatamed belautu': 'מופת ברד — התמיד באלהותו',
    'mufat dam-eluwe u mari': 'מופת דם — אלהי ומרי',
    'mufat haareb- saekot b y shama': 'מופת הערב — צעקות בני ישראל',
    'mufat sefarda- hatamed eil rai': 'מופת צפרדע — התמיד אל ראי',
    'mufat shain': 'מופת שחין',
    'shibu': 'שבחו',
    'shabbau': 'שבחו',
    'sagudot': 'סגודות',
    'koktel samri': 'מחרוזת שומרונית',
    'al fetah hashuba - hadir elkahen': 'אל פתח השובה',
    'aseto': 'האציתו',
    'mi ukal alnafshu-amarnu mdebari': 'מי יוכל אל נפשו',

    # file-level transliteration, mostly the Shabbat-morning עמידות sequence
    'aabode dalama1': 'עבודה דעלמה א׳',
    'aabode daalama2': 'עבודה דעלמה ב׳',
    'abuda dalama': 'עבודה דעלמה',
    'seherem': 'סהרם',
    'seherem — abuda dalama': 'סהרם — עבודה דעלמה',
    'ketef rishon-shabat boker': 'כתף ראשון — שבת בוקר',
    'ketef sheni-shabat boker': 'כתף שני — שבת בוקר',
    'ketef shelishi': 'כתף שלישי',
    'ketef reviei': 'כתף רביעי',
    'shabat boker': 'שבת בוקר',
    'ae taba rati usubar': 'אה טבא רעותי וסובר',
    'mamena ad kala': 'ממנה עד כלה',
    'meimena': 'ממנה',
    'duran': 'דורן',
    'ayol u eila takifa': 'איול ואילה תקיפה',
    'ayol uo eile': 'איול הוא אילה',
    'ahhan daton kaemin': 'אחן דאתון קימין',
    'attau yakira eila': 'אתהו יקירה אילה',
    'attau adda': 'אתהו אדה',
    'malka ad lel': 'מלכה עד ליל',
    'iila rama': 'אילה רמה',
    'dakura': 'דכורה',
    'yitbrak': 'יתברך',
    'elueim yitbarak': 'אלהים יתברך',
    'lit afkal yumaya': 'לית אף כל יומיא',
    'ah yo kadsih': 'אה יום קדשה',
    'kamnan man shintan': 'קמנן מן שינתן',
    'abod simanaya': 'עבד שמיניא',
    'fathet eshol': 'פתחת אשול',
    'nebarek-kaved': 'נברך — כבד',
    'nebarek-kaved2': 'נברך — כבד ב׳',
    'nfta fyano to me yashorak': 'נפתח פינו',
    'kerzu': 'כרזו',
    'ela rab': 'אלה רב',
    'leket': 'לקט',
    'aharon elkahen': 'אהרן הכהן',
}

# piyyut-name keywords that date a recording when the folder tree does not
EVENT_KEYWORDS = [
    ('יום הכיפורים',    ['כיפור', 'סליחן', 'סליחות', 'חנון החנונים', 'מליפוט']),
    ('מעמד הר סיני',    ['עשרת הדברים', 'הר סיני', 'מעמד הר']),
    ('חג המצות',        ['צמות הפסח', 'המצות', 'מצות']),
    ('חג הפסח',         ['פסח', 'זבח', 'מופת', 'החדש הראישון', 'החודש הראשון',
                         'דגלי העולם', 'מכות']),
    ('חג הסוכות',       ['סכות', 'סוכות', 'הסכות']),
    ('חג השבועות',      ['שבועות', 'עמלק', 'אשול']),
    ('ראש החודש השביעי', ['החודש השביעי', 'שרת בך']),
    ('שמיני עצרת',      ['שמיני עצרת']),
    ('עלייה לרגל',      ['עליה לרגל', 'עלייה לרגל', 'זיארה', 'גבעת עולם']),
    ('שבת',             ['שבת', 'עמידות', 'כתף', 'דורן', 'עבודה דעלמה']),
    ('ימי חול',         ['אור הבקר', 'תפילת בוקר יחיד']),
    ('שמחות',           ['חתנה', 'משכרה', 'מולד משה', 'שמחה']),
]

# generic folder words that are structure, not a piyyut name
STRUCTURAL = {
    'a', 'b', 'c', 'בתים', 'פסוקים', 'שירה', 'קלטת מניר', 'ארבה', 'חשך',
    'שיראן ניר', 'הקלטות ישנות', 'סעדיה הקלטות ישנות', 'הקלטה ישנה', 'בעבודה',
    'מופתים', 'mufatem', 'עמידות', 'בתים מרקה', 'בתים דוסתאן', 'פאוואה',
    'תסאביח', 'תסאביך', 'kipur', 'shonot', 'shabbat', 'sukkot', 'shavuot',
    'pesaach', 'shemini atseret',
}
