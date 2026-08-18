# -*- coding: utf-8 -*-
"""תרגום התקופות ושמות נושאי המשרה.

שמות הכהנים בנויים כולם בתבנית ״פלוני בן אלמוני״, ולכן מתורגמים לפי רכיבים —
כך שכל 95 הכהנים מקבלים תעתיק נכון בלי לרשום כל שם בנפרד.
"""
import re

PERIODS_T = {
"ימי קדם — מהבריאה עד המבול": ("Antiquity — from Creation to the Flood", "العصور الأولى — من الخليقة إلى الطوفان"),
"מהמבול עד האבות": ("From the Flood to the Patriarchs", "من الطوفان إلى الآباء"),
"ימי האבות": ("The age of the Patriarchs", "عصر الآباء"),
"ישראל במצרים": ("Israel in Egypt", "إسرائيل في مصر"),
"המדבר והכניסה לארץ": ("The wilderness and the entry into the Land", "البرية والدخول إلى الأرض"),
"ימי הרצון (הרחותה)": ("The Days of Favour (the Rahuta)", "أيام الرضا (الراحوتة)"),
"ימי הפילוג — משכן שילה": ("The age of schism — the tabernacle at Shiloh", "عصر الانشقاق — مسكن شيلوه"),
"ממלכות ישראל ויהודה": ("The kingdoms of Israel and Judah", "مملكتا إسرائيل ويهوذا"),
"השלטון האשורי": ("Assyrian rule", "الحكم الأشوري"),
"השלטון הבבלי": ("Babylonian rule", "الحكم البابلي"),
"השלטון הפרסי": ("Persian rule", "الحكم الفارسي"),
"התקופה ההלניסטית": ("The Hellenistic period", "العصر الهلنستي"),
"רומא האלילית": ("Pagan Rome", "روما الوثنية"),
"השלטון הביזנטי": ("Byzantine rule", "الحكم البيزنطي"),
"התקופה המוסלמית הקדומה": ("The early Muslim period", "العصر الإسلامي المبكر"),
"התקופה הצלבנית": ("The Crusader period", "العصر الصليبي"),
"התקופה הממלוכית": ("The Mamluk period", "العصر المملوكي"),
"התקופה העות׳מאנית": ("The Ottoman period", "العصر العثماني"),
"המנדט הבריטי": ("The British Mandate", "الانتداب البريطاني"),
"ישראל / ירדן — ימי הניתוק": ("Israel / Jordan — the years of separation", "إسرائيل / الأردن — سنوات الانقطاع"),
"מאיחוד הקהילה ועד ימינו": ("From the reunion of the community to our own day", "من لمّ شمل الجماعة حتى اليوم"),
}

# רכיבי השמות שבשושלת הכהנים
NAME = {
"אלעזר": ("Eleazar", "ألعازار"), "פינחס": ("Phinehas", "فينحاس"), "אבישע": ("Abisha", "أبيشع"),
"שישי": ("Shishi", "شيشي"), "בחקי": ("Bukki", "بُقّي"), "עזי": ("Uzzi", "عُزّي"),
"שבט": ("Shevet", "شيفت"), "שלום": ("Shalom", "شالوم"), "שלוס": ("Shalom", "شالوم"),
"חזקיה": ("Hezekiah", "حزقيا"), "יהונתן": ("Jonathan", "يوناثان"), "יאיר": ("Jair", "يائير"),
"דליה": ("Delaiah", "دلايا"), "ישמעאל": ("Ishmael", "إسماعيل"), "טוביה": ("Tobiah", "طوبيا"),
"צדוק": ("Zadok", "صادوق"), "עמרם": ("Amram", "عمرام"), "חלקיה": ("Hilkiah", "حلقيا"),
"עקוב": ("Aqquv", "عقّوب"), "עקביה": ("Aqavyah", "عقبيا"), "חלאל": ("Halel", "حلئيل"),
"שריה": ("Seraiah", "سرايا"), "לוי": ("Levi", "لاوي"), "נתנאל": ("Nethanel", "نثنائيل"),
"עזריה": ("Azariah", "عزريا"), "עבדאל": ("Abdel", "عبدئيل"), "חנניה": ("Hananiah", "حنانيا"),
"חנן": ("Hanan", "حانان"), "מנשה": ("Manasseh", "منسّى"), "יהויקים": ("Joiakim", "يوياقيم"),
"אלישמע": ("Elishama", "أليشمع"), "שמעיה": ("Shemaiah", "شمعيا"), "עקבון": ("Aqbon", "عقبون"),
"בבא": ("Baba", "بابا"), "שמעון": ("Simeon", "شمعون"), "איתמר": ("Ithamar", "إيثامار"),
"יוסף": ("Joseph", "يوسف"), "טביה": ("Tabiah", "طبيا"), "שלמה": ("Shalma", "شلمة"),
"יעקב": ("Jacob", "يعقوب"), "מצליח": ("Matzliach", "مصلح"), "אשר": ("Asher", "آشر"),
"אהרן": ("Aaron", "هارون"), "אב־חסדה": ("Ab-Hisda", "أب-حسدة"), "עבד־אל": ("Aabed-El", "عبد إيل"),
"אברהם": ("Abraham", "أبراهام"), "יצחק": ("Yitzhak", "يتسحاق"),
}
EXTRA = {
"שבא מדמשק": ("who came from Damascus", "الذي جاء من دمشق"),
"בן": ("son of", "بن"),
}

# ראשי ממשלה ונשיאים
RULERS = {
"דוד בן־גוריון": ("David Ben-Gurion", "دافيد بن غوريون"),
"משה שרת": ("Moshe Sharett", "موشيه شاريت"),
"לוי אשכול": ("Levi Eshkol", "ليفي أشكول"),
"גולדה מאיר": ("Golda Meir", "غولدا مئير"),
"יצחק רבין": ("Yitzhak Rabin", "يتسحاق رابين"),
"מנחם בגין": ("Menachem Begin", "مناحيم بيغن"),
"יצחק שמיר": ("Yitzhak Shamir", "يتسحاق شامير"),
"שמעון פרס": ("Shimon Peres", "شمعون بيريس"),
"בנימין נתניהו": ("Benjamin Netanyahu", "بنيامين نتنياهو"),
"אהוד ברק": ("Ehud Barak", "إيهود باراك"),
"אריאל שרון": ("Ariel Sharon", "أريئيل شارون"),
"אהוד אולמרט": ("Ehud Olmert", "إيهود أولمرت"),
"נפתלי בנט": ("Naftali Bennett", "نفتالي بينيت"),
"יאיר לפיד": ("Yair Lapid", "يائير لبيد"),
"חיים ויצמן": ("Chaim Weizmann", "حاييم وايزمان"),
"יצחק בן־צבי": ("Yitzhak Ben-Zvi", "يتسحاق بن تسفي"),
"זלמן שזר": ("Zalman Shazar", "زلمان شازار"),
"אפרים קציר": ("Ephraim Katzir", "إفرايم كتسير"),
"יצחק נבון": ("Yitzhak Navon", "يتسحاق نافون"),
"חיים הרצוג": ("Chaim Herzog", "حاييم هرتسوغ"),
"עזר ויצמן": ("Ezer Weizman", "عيزر وايزمان"),
"משה קצב": ("Moshe Katsav", "موشيه كتساف"),
"ראובן ריבלין": ("Reuven Rivlin", "رؤوفين ريفلين"),
"יצחק הרצוג": ("Isaac Herzog", "يتسحاق هرتسوغ"),
}

GAPS = {
"פער ברשימה": ("Gap in the list", "فجوة في القائمة"),
"פער ברשימה — הכהנים 56–77": ("Gap in the list — High Priests 56–77", "فجوة في القائمة — الكهنة 56–77"),
"פער ברשימה — הכהנים 88–94": ("Gap in the list — High Priests 88–94", "فجوة في القائمة — الكهنة 88–94"),
"—": ("—", "—"),
}


def translate_name(he, idx):
    """מתרגם שם של נושא משרה. idx: 0=אנגלית, 1=ערבית. None אם לא ניתן."""
    if he in RULERS:
        return RULERS[he][idx]
    if he in GAPS:
        return GAPS[he][idx]
    for k, v in EXTRA.items():
        if k != "בן" and he.endswith(k):
            base = translate_name(he[: -len(k)].strip(), idx)
            return (base + " " + v[idx]) if base else None
    parts = re.split(r"\s+", he.strip())
    out = []
    for p in parts:
        if p == "בן":
            out.append(EXTRA["בן"][idx])
        elif p in NAME:
            out.append(NAME[p][idx])
        else:
            return None                     # שם שאינו מוכר — נשאר בעברית
    return " ".join(out)
