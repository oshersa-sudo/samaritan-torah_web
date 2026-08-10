"""Import the Samaritan personalities dataset into torah.db as a new library unit.

Source: files_persons.zip (samaritan_people.db / .json) — 95 figures summarised in
Hebrew, English and Arabic from *A Companion to Samaritan Studies*, each with its
page reference and (where signed) the contributor's initials.

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
import os
import re
import sqlite3
import sys

_ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(_ROOT, 'data', 'people', 'samaritan_people.db')   # unpacked from files_persons.zip
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


_BOOK = 'A Companion to Samaritan Studies'


def norm_source(s):
    """22 rows name the book, 73 carry only 'p. 131' — the reference is the same
    work throughout, so give every entry the full citation."""
    s = (s or '').strip()
    if not s or s.startswith(_BOOK):
        return s
    return '%s, %s' % (_BOOK, s)


def main(apply):
    if not os.path.exists(SRC):
        sys.exit('source DB not found: %s' % SRC)
    src = sqlite3.connect(SRC)
    src.row_factory = sqlite3.Row
    rows = [dict(r) for r in src.execute('SELECT * FROM people')]
    src.close()

    unmapped = []
    for r in rows:
        he, ar, year, era = resolve_period(r['period'])
        if era == 'unk' and r['period'] not in PERIOD_MAP:
            unmapped.append(r['period'])
        r['period_he'], r['period_ar'], r['sort_year'], r['era'] = he, ar, year, era
        r['source'] = norm_source(r['source'])

    rows.sort(key=lambda r: (ERA_ORDER.index(r['era']), r['sort_year'], r['name_he']))
    for i, r in enumerate(rows, 1):
        r['ord'] = i

    counts = {}
    for r in rows:
        counts[r['era']] = counts.get(r['era'], 0) + 1
    print('people: %d' % len(rows))
    for e in ERA_ORDER:
        print('  %-6s %d' % (e, counts.get(e, 0)))
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
        source TEXT, contributor_initials TEXT)''')
    conn.executemany('''INSERT INTO people(id, ord, era, sort_year, name_en, name_he, name_ar,
        pronunciation, period, period_he, period_ar,
        description_en, description_he, description_ar, source, contributor_initials)
        VALUES(:id,:ord,:era,:sort_year,:name_en,:name_he,:name_ar,:pronunciation,
               :period,:period_he,:period_ar,:description_en,:description_he,
               :description_ar,:source,:contributor_initials)''', rows)
    conn.execute('CREATE INDEX IF NOT EXISTS idx_people_ord ON people(ord)')
    conn.commit()
    conn.close()
    print('written to %s' % os.path.abspath(DB))


if __name__ == '__main__':
    main('--apply' in sys.argv)
