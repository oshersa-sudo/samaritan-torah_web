"""Import the Samaritan personalities dataset into torah.db as a new library unit.

Source: files_persons2.zip (samaritan_people.db / .json) — 95 figures summarised in
Hebrew, English and Arabic from *A Companion to Samaritan Studies*, each with its
page reference and (where signed) the contributor's initials. The second delivery
kept those summaries word for word and added, for 23 of the 95, an `enriched_note`
in all three languages (dates, corrections and context the encyclopedia entry
lacks) plus a `references` list of further reading. Both are carried through.

The source table is copied as-is; four presentation columns are added so the
reader can group and sort the list without re-parsing English prose per request:

  ord         stable display order (chronological: era, then sort_year, then name)
  era         bucket: bib | anc | med | early | mod | unk
  sort_year   approximate year for sorting (negative = BCE, 9999 = unknown)
  period_he   the English `period` rendered in Hebrew  ("14th century" → "המאה ה-14")
  period_ar   the same in Arabic                        ("القرن الرابع عشر")

Pure year ranges ("1904-1990") need no translation beyond an en-dash; the 44
distinct wordy forms are mapped by hand below — a fixed map, not a regex, so
nothing is invented or half-translated.

  py -3 scripts/people/import_people.py            # dry-run: parse + print the grouping
  py -3 scripts/people/import_people.py --apply    # write the `people` table
"""
import json
import os
import re
import sqlite3
import sys

_ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(_ROOT, 'data', 'people', 'samaritan_people.db')   # unpacked from files_persons.zip
WIKI = os.path.join(_ROOT, 'data', 'people', 'wikipedia.json')       # scripts/people/fetch_wikipedia.py
DB = os.path.join(_ROOT, 'data', 'torah.db')

# era buckets (codes are what the UI groups by; labels live in the app's I18N table)
ERA_ORDER = ['bib', 'anc', 'med', 'early', 'mod', 'unk']

# period → (Hebrew, Arabic, sort_year, era). Only the wordy forms; plain year
# ranges are handled by _numeric_period() below.
PERIOD_MAP = {
    'Biblical era':
        ('תקופת המקרא', 'العصر التوراتي', -1300, 'bib'),
    'Biblical era (traditionally era of Moses)':
        ('תקופת המקרא (לפי המסורת — ימי משה)', 'العصر التوراتي (بحسب التقليد: زمن موسى)', -1310, 'bib'),
    'traditionally era of Artaxerxes I / Hippocrates (5th century BCE)':
        ('לפי המסורת — ימי ארתחשסתא הראשון / היפוקרטס (המאה ה-5 לפסה״נ)',
         'بحسب التقليد: زمن أرتحششتا الأول / أبقراط (القرن الخامس ق.م)', -450, 'anc'),
    '4th century BCE (d. 323 BCE)':
        ('המאה ה-4 לפסה״נ (נפ׳ 323 לפסה״נ)', 'القرن الرابع ق.م (ت. 323 ق.م)', -350, 'anc'),
    'c. 100 BCE':
        ('בערך 100 לפסה״נ', 'نحو 100 ق.م', -100, 'anc'),
    'd. 104 BCE (ruled 134-104)':
        ('נפ׳ 104 לפסה״נ (מלך 134–104)', 'ت. 104 ق.م (حكم 134–104)', -104, 'anc'),
    'c. 4 BCE - c. 30 CE':
        ('בערך 4 לפסה״נ – בערך 30 לספירה', 'نحو 4 ق.م – نحو 30 م', -4, 'anc'),
    'c. 37 - c. 100 CE':
        ('בערך 37 – בערך 100 לספירה', 'نحو 37 – نحو 100 م', 37, 'anc'),
    '1st century CE':
        ('המאה ה-1 לספירה', 'القرن الأول للميلاد', 50, 'anc'),
    '76-138 CE (Emperor 117-138)':
        ('76–138 לספירה (קיסר 117–138)', '76–138 م (إمبراطور 117–138)', 76, 'anc'),
    'd. c. 200 CE':
        ('נפ׳ בערך 200 לספירה', 'ت. نحو 200 م', 200, 'anc'),
    '3rd-4th century CE':
        ('המאות ה-3–4 לספירה', 'القرنان الثالث والرابع للميلاد', 300, 'anc'),
    '4th century CE (or 3rd century)':
        ('המאה ה-4 לספירה (או המאה ה-3)', 'القرن الرابع للميلاد (أو الثالث)', 330, 'anc'),
    '4th century CE':
        ('המאה ה-4 לספירה', 'القرن الرابع للميلاد', 350, 'anc'),
    '347-395 CE (ruled 379-395)':
        ('347–395 לספירה (מלך 379–395)', '347–395 م (حكم 379–395)', 347, 'anc'),
    'c. 440 - c. 500 CE':
        ('בערך 440 – בערך 500 לספירה', 'نحو 440 – نحو 500 م', 440, 'anc'),
    '6th century CE':
        ('המאה ה-6 לספירה', 'القرن السادس للميلاد', 550, 'anc'),
    'probably 10th-11th century':
        ('ככל הנראה המאות ה-10–11', 'على الأرجح القرنان العاشر والحادي عشر', 1000, 'med'),
    '11th century':
        ('המאה ה-11', 'القرن الحادي عشر', 1050, 'med'),
    'late 11th - early 12th century':
        ('סוף המאה ה-11 – ראשית המאה ה-12', 'أواخر القرن الحادي عشر – مطلع الثاني عشر', 1090, 'med'),
    'probably 12th century':
        ('ככל הנראה המאה ה-12', 'على الأرجح القرن الثاني عشر', 1150, 'med'),
    'c. 1150-1200':
        ('בערך 1150–1200', 'نحو 1150–1200', 1150, 'med'),
    'mid-12th century':
        ('אמצע המאה ה-12', 'منتصف القرن الثاني عشر', 1150, 'med'),
    'active 1197-1225':
        ('פעל 1197–1225', 'نشط 1197–1225', 1197, 'med'),
    'd. 1259':
        ('נפ׳ 1259', 'ت. 1259', 1259, 'med'),
    '2nd half of 13th century':
        ('המחצית השנייה של המאה ה-13', 'النصف الثاني من القرن الثالث عشر', 1275, 'med'),
    'late 13th - early 14th century':
        ('סוף המאה ה-13 – ראשית המאה ה-14', 'أواخر القرن الثالث عشر – مطلع الرابع عشر', 1290, 'med'),
    'early 14th century':
        ('ראשית המאה ה-14', 'مطلع القرن الرابع عشر', 1310, 'med'),
    '14th century':
        ('המאה ה-14', 'القرن الرابع عشر', 1350, 'med'),
    '14th century (fl. 1352-1356)':
        ('המאה ה-14 (פעל 1352–1356)', 'القرن الرابع عشر (نشط 1352–1356)', 1352, 'med'),
    '1431-1509 (in office 1474-1509)':
        ('1431–1509 (כיהן 1474–1509)', '1431–1509 (تولى المنصب 1474–1509)', 1431, 'med'),
    'uncertain (medieval)':
        ('לא ידוע (ימי הביניים)', 'غير معروف (العصور الوسطى)', 1500, 'med'),
    '16th century':
        ('המאה ה-16', 'القرن السادس عشر', 1550, 'early'),
    'active 1532-1584':
        ('פעל 1532–1584', 'نشط 1532–1584', 1532, 'early'),
    'd. 1664':
        ('נפ׳ 1664', 'ت. 1664', 1664, 'early'),
    '19th century':
        ('המאה ה-19', 'القرن التاسع عشر', 1850, 'mod'),
    '19th century (d. 1851)':
        ('המאה ה-19 (נפ׳ 1851)', 'القرن التاسع عشر (ت. 1851)', 1851, 'mod'),
    'b. 1880':
        ('נו׳ 1880', 'و. 1880', 1880, 'mod'),
    'd. 1909':
        ('נפ׳ 1909', 'ت. 1909', 1909, 'mod'),
    'd. 1910':
        ('נפ׳ 1910', 'ت. 1910', 1910, 'mod'),
    '20th century':
        ('המאה ה-20', 'القرن العشرون', 1950, 'mod'),
    'uncertain':
        ('לא ידוע', 'غير معروف', 9999, 'unk'),
    'uncertain (traditions range from 2nd cent. BCE to 1st cent. CE)':
        ('לא ידוע (המסורות נעות בין המאה ה-2 לפסה״נ למאה ה-1 לספירה)',
         'غير معروف (تتراوح الروايات بين القرن الثاني ق.م والأول للميلاد)', 9999, 'unk'),
    'various (from post-Nebuchadnezzar to post-Crusader era)':
        ('תקופות שונות (מימי שלהי נבוכדנאצר ועד לאחר תקופת הצלבנים)',
         'فترات مختلفة (من ما بعد نبوخذنصر إلى ما بعد الحقبة الصليبية)', 9999, 'unk'),
    'various periods (biblical chronology to Roman era)':
        ('תקופות שונות (מכרונולוגיית המקרא ועד התקופה הרומית)',
         'فترات مختلفة (من التسلسل التوراتي إلى العصر الروماني)', 9999, 'unk'),
}

_NUM_RANGE = re.compile(r'^(\d{3,4})\s*-\s*(\d{3,4}|\?)$')


def _numeric_period(p):
    """'1904-1990' / '1865-?' → (he, ar, sort_year, era) with an en-dash."""
    m = _NUM_RANGE.match(p)
    if not m:
        return None
    year = int(m.group(1))
    txt = '%s–%s' % (m.group(1), m.group(2))
    era = 'early' if year < 1800 else 'mod'
    return (txt, txt, year, era)


def resolve_period(p):
    p = (p or '').strip()
    if p in PERIOD_MAP:
        return PERIOD_MAP[p]
    num = _numeric_period(p)
    if num:
        return num
    # nothing invented: fall back to the English string, sorted last
    return (p, p, 9999, 'unk')


# Hebrew names. Samaritan men carry an Arabic name and a Hebrew one, and the
# dataset itself pairs several ("מרחיב (מופרג')", "אב גלוגה (אבו חמד)").
#
# The project owner's ruling (2026-08-11): translate PERSONAL names only, and
# leave the kunya ("אבו X") and the nisba (אל-עסכרי, אלבצרי, א-סורי, אד-דוויק)
# exactly as they stand — those are the forms scholarship knows these figures by.
# European scholars keep their encyclopedic order ("פוסטל, גיום"), so the A-Z
# list still sorts by surname. Where a Hebrew and an Arabic form both exist, the
# Hebrew leads and the Arabic follows in parentheses.
#
# Equivalences used: Ishaq = יצחק and Ibrahim = אברהם (the owner's own examples);
# Salama = שלמה and 'Abd Allah = עבד-אלה (his ruling on 'Abd Allah b. Salama);
# Nagi = אבישע (his ruling on that priest); Ghazal = טביה, Murjan = אב סכוה,
# Hidr = פנחס — each of the three already paired inside these entries' own names
# in the source data. The owner ruled that the remaining Arabic personal names
# stand as they are: אב סכוה and אסעד explicitly, and the rest with them
# (ברכאת · מנג'א · גריב · סעיד). They are left untouched, not guessed at.
NAME_HE = {
    # Ghazal = Ṭabya (gazelle) — the pairing is spelled out in this entry's own name
    'ghazal_tabya_ad_duweik':   'טביה (ע׳זאל) אד-דוויק',
    # the same equivalence applied to another man's father; the kunya stays
    'abu_lhasan_b_ghazal':      'אבו אלחסן בן טביה (ע׳זאל) בן אבי סעיד',
    # Murjan = Ab Sikkuwwa — likewise; spelling unified with ab_sakwa below
    'murgan_ab_sikkuwwa':       'אב סכוה (מרג׳אן) בן צדקה',
    # Hidr = Pinhas — the pairing is in the entry's own name, Hebrew now leads.
    # Nagi = אבישע is the owner's ruling for this priest (2026-08-11).
    'nagi_b_hidr':              'אבישע (נאג׳י) בן פנחס (חדר) בן יצחק',
    # Ishaq = Isaac, Ibrahim = Abraham; al-Musannif ("the compiler") is a title, kept
    'abu_ishaq_ibrahim_al_musannif': 'אברהם אלמצנף (אבו אסחאק אבראהים)',
    # 'Abd Allah = עבד-אלה and Salama = שלמה, both by the owner's ruling. His
    # hymns are signed with the acrostic "עבד יהוה" / "עבד אלוה" (see the entry).
    'abdallah_b_salama':        'עבד-אלה (עבדאללה) בן שלמה (בן סלאמה)',
    # the same Salama, in a name whose Hebrew part was already Hebrew throughout
    'ab_hisda_abu_lhasan_b_jacob': 'אב חסדא (אבו אלחסן) בן יעקב בן אהרן בן שלמה',
    # al-Qabbas reads אל-קבצי by the owner's ruling — the one nisba he did rule on;
    # hyphenated to match the house style of יוסף אל-עסכרי / אבראהים אל-חקילאני
    'abraham_qabbasa':          'אברהם אל-קבצי (אבראהים אלקבאץ)',
}

# Figures the delivered dataset skipped, read back off the scanned encyclopedia
# (האנציקלופדיה השומרונית.pdf) at the page each one names. The summaries follow
# the delivered entries' own style — condensed, in the three languages — rather
# than copying the printed article.
EXTRA_PEOPLE = [
    dict(
        id='ninna_b_marqe',
        name_en='Ninna (son of Marqe)',
        name_he='נינה (ננה) בן מרקה',
        name_ar='نينّا بن مرقة',
        pronunciation=None,
        period='4th century CE',
        description_en=(
            "Son of the poet Marqe and grandson of 'Amram Dare, and the third and last of the "
            "series of known Samaritan poets who wrote Aramaic at its height. Ben-Hayyim's edition "
            "of the liturgical hymns carries one hymn of his, and he may also be the author of a "
            "second attributed there to Marqe. His name is read two ways: Cowley derived it from "
            "the Roman Nonus — his father's and grandfather's names are Roman in origin too — while "
            "Ben-Hayyim linked it to the Talmudic name Nanny, pronounced with a doubled N."),
        description_he=(
            'בנו של המשורר מרקה ונכדו של עמרם דרה, השלישי והאחרון בשלשלת המשוררים השומרונים '
            'הידועים שכתבו ארמית בשיא פריחתה. במהדורת הפיוטים של בן-חיים מובא פיוט אחד משלו, '
            'ויש שמייחסים לו גם פיוט נוסף הרשום שם על שם מרקה. שמו נדרש בשתי דרכים: קאולי גזר '
            'אותו מן השם הרומי נונוס — גם שמות אביו וסבו רומיים במקורם — ואילו בן-חיים קשר אותו '
            'לשם התלמודי "ננאי", הנהגה בנו"ן כפולה.'),
        description_ar=(
            'ابن الشاعر مرقة وحفيد عمرام دارا، وثالث وآخر سلسلة الشعراء السامريين المعروفين الذين '
            'كتبوا بالآرامية في أوجها. تحمل طبعة بن حَيّيم للأناشيد نشيدًا واحدًا له، وقد يكون أيضًا '
            'صاحب نشيد آخر منسوب هناك إلى مرقة. ويُقرأ اسمه على وجهين: اشتقّه كاولي من الاسم '
            'الروماني نونوس — واسما أبيه وجدّه رومانيان أصلًا — بينما ربطه بن حَيّيم بالاسم التلمودي '
            '"ناني" بنونٍ مشدَّدة.'),
        enriched_note_en=None, enriched_note_he=None, enriched_note_ar=None,
        references_json='[]',
        source='p. 172',
        contributor_initials='M.F.',
    ),
    dict(
        id='ibrahim_al_ayya',
        name_en="Abraham b. Jacob ad-Danafi (Ibrahim al-'Ayya)",
        name_he='אברהם בן יעקב הדנפי (אלעיה)',
        name_ar="إبراهيم بن يعقوب الدنفي (العَيَّه)",
        pronunciation=None,
        period='1719-?',
        description_en=(
            "An eighteenth-century Samaritan poet, commentator, historian and public figure, "
            "counted among the greatest Samaritan poets and exegetes of any generation. His "
            "Arabic byname al-'Ayya, 'the pleader', was earned by the many compositions he wrote "
            "pleading on the community's behalf through the hard years of his lifetime. He came "
            "of the Danafi family, the community's largest household to this day, descended from "
            "the last remnant of the Damascus community. His greatest work is a five-thousand-page "
            "commentary on the Torah, written together with the elder Tabya b. Ab Zehuta al-Matari "
            "and now in Berlin; he also wrote on grammar and on the correct reading of the Torah, "
            "and with the High Priest Tabya b. Isaac he set the order of prayers for the fourteen "
            "days of the mishmar. His hymns are still sung in the synagogue on the festivals."),
        description_he=(
            'פייטן, פרשן, היסטוריון ואיש ציבור שומרוני בן המאה ה-18, הנמנה עם גדולי פייטני '
            'השומרונים ופרשניהם לאורך הדורות. כינויו הערבי "אלעיה" — הפצרן או המתחנן — ניתן לו '
            'על שום חיבוריו הרבים שבהם התחנן בעד העדה בשנותיה הקשות. בן משפחת הדנפים, בית האב '
            'הגדול בעדה עד ימינו, שמוצאה משרידי קהילת דמשק. מפעלו הגדול הוא פירוש לתורה בן חמשת '
            'אלפים עמודים, שכתב עם הזקן טביה בן אב זהותה המטרי ומצוי כיום בברלין; חיבר גם חיבורים '
            'בדקדוק ובקריאת התורה, ועם הכהן הגדול טביה בן יצחק כונן את סדר התפילות לארבעה עשר ימי '
            'המשמרת. פיוטיו נאמרים בבתי הכנסת עד היום בימי המועדים.'),
        description_ar=(
            'شاعر ومفسّر ومؤرّخ ورجل عامّة سامري من القرن الثامن عشر، يُعدّ من كبار شعراء السامريين '
            'ومفسّريهم على مرّ الأجيال. ولقبه العربي "العَيَّه" — أي المتضرّع — ناله لكثرة ما كتب '
            'متضرّعًا عن الطائفة في سنيّها الصعبة. وهو من آل الدنفي، أكبر بيوت الطائفة حتى اليوم، '
            'المنحدرة من بقايا جماعة دمشق. وأعظم أعماله تفسير للتوراة في خمسة آلاف صفحة، كتبه مع '
            'الشيخ طابيا بن أب زهوتة المطري وهو اليوم في برلين؛ وله أيضًا مصنّفات في النحو وفي '
            'قراءة التوراة، ومع الكاهن الأكبر طابيا بن إسحق وضع ترتيب صلوات أيام المشمار الأربعة '
            'عشر. وما زالت أناشيده تُرتَّل في الكنائس أيام الأعياد.'),
        enriched_note_en=None, enriched_note_he=None, enriched_note_ar=None,
        references_json='[]',
        source='ויקיפדיה העברית, הערך "אברהם בן יעקב הדנפי"',
        contributor_initials=None,
    ),
]

_BOOK = 'A Companion to Samaritan Studies'


_BARE_PAGE = re.compile(r'^p+\. ?\d')


def norm_source(s):
    """22 rows name the book, 73 carry only 'p. 131' — the reference is the same
    work throughout, so complete those. A citation that names something else (an
    entry read off another source) is left exactly as it stands."""
    s = (s or '').strip()
    if not s or s.startswith(_BOOK):
        return s
    return '%s, %s' % (_BOOK, s) if _BARE_PAGE.match(s) else s


def main(apply):
    if not os.path.exists(SRC):
        sys.exit('source DB not found: %s' % SRC)
    src = sqlite3.connect(SRC)
    src.row_factory = sqlite3.Row
    rows = [dict(r) for r in src.execute('SELECT * FROM people')]
    src.close()
    have = {r['id'] for r in rows}
    rows += [dict(x) for x in EXTRA_PEOPLE if x['id'] not in have]

    # the Wikipedia articles for the seven Samaritan figures, per language
    wiki = {}
    if os.path.exists(WIKI):
        with open(WIKI, encoding='utf-8') as f:
            wiki = json.load(f)

    unmapped = []
    renamed = 0
    for r in rows:
        he, ar, year, era = resolve_period(r['period'])
        if era == 'unk' and r['period'] not in PERIOD_MAP:
            unmapped.append(r['period'])
        r['period_he'], r['period_ar'], r['sort_year'], r['era'] = he, ar, year, era
        r['source'] = norm_source(r['source'])
        if r['id'] in NAME_HE and NAME_HE[r['id']] != r['name_he']:
            r['name_he'] = NAME_HE[r['id']]
            renamed += 1
        # the second delivery's columns are optional — an older source file
        # simply leaves them empty rather than failing the import
        for k in ('enriched_note_en', 'enriched_note_he', 'enriched_note_ar'):
            r.setdefault(k, None)
        r.setdefault('references_json', '[]')
        arts = wiki.get(r['id']) or {}
        r['wikipedia_json'] = json.dumps(arts, ensure_ascii=False) if arts else None

    rows.sort(key=lambda r: (ERA_ORDER.index(r['era']), r['sort_year'], r['name_he']))
    for i, r in enumerate(rows, 1):
        r['ord'] = i

    counts = {}
    for r in rows:
        counts[r['era']] = counts.get(r['era'], 0) + 1
    print('people: %d' % len(rows))
    for e in ERA_ORDER:
        print('  %-6s %d' % (e, counts.get(e, 0)))
    print('  enriched notes: %d · with further reading: %d · Hebrew names applied: %d'
          % (sum(1 for r in rows if (r.get('enriched_note_he') or '').strip()),
             sum(1 for r in rows if (r.get('references_json') or '[]') not in ('[]', '', None)),
             renamed))
    wk = [r for r in rows if r.get('wikipedia_json')]
    print('  Wikipedia articles: %d figures, %d articles'
          % (len(wk), sum(len(json.loads(r['wikipedia_json'])) for r in wk)))
    if unmapped:
        print('UNMAPPED periods (left in English): %s' % sorted(set(unmapped)))
    if not apply:
        print('DRY-RUN (pass --apply to write)')
        return

    conn = sqlite3.connect(DB)
    conn.execute('DROP TABLE IF EXISTS people')
    conn.execute('''CREATE TABLE people(
        id TEXT PRIMARY KEY, ord INTEGER, era TEXT, sort_year INTEGER,
        name_en TEXT, name_he TEXT, name_ar TEXT, pronunciation TEXT,
        period TEXT, period_he TEXT, period_ar TEXT,
        description_en TEXT, description_he TEXT, description_ar TEXT,
        enriched_note_en TEXT, enriched_note_he TEXT, enriched_note_ar TEXT,
        references_json TEXT, wikipedia_json TEXT,
        source TEXT, contributor_initials TEXT)''')
    conn.executemany('''INSERT INTO people(id, ord, era, sort_year, name_en, name_he, name_ar,
        pronunciation, period, period_he, period_ar,
        description_en, description_he, description_ar,
        enriched_note_en, enriched_note_he, enriched_note_ar, references_json, wikipedia_json,
        source, contributor_initials)
        VALUES(:id,:ord,:era,:sort_year,:name_en,:name_he,:name_ar,:pronunciation,
               :period,:period_he,:period_ar,:description_en,:description_he,
               :description_ar,:enriched_note_en,:enriched_note_he,:enriched_note_ar,
               :references_json,:wikipedia_json,:source,:contributor_initials)''', rows)
    conn.execute('CREATE INDEX IF NOT EXISTS idx_people_ord ON people(ord)')
    conn.commit()
    conn.close()
    print('written to %s' % os.path.abspath(DB))


if __name__ == '__main__':
    main('--apply' in sys.argv)
