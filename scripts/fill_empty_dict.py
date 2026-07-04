"""Fill the DICTIONARY gaps: tokens that open an EMPTY dictionary in the app.

get_dict_select() falls back to word_gloss.he for any token the curated glossary /
word_align never covered. ~971 real-word tokens (516 distinct forms) have no entry
at all, so clicking them shows nothing. Almost every such form is already glossed
elsewhere in word_gloss (the position was just missed), so we reuse the existing
gloss for the same form; prefixed variants reuse their base form's gloss; a small
hand map covers the rest.

Writes word_gloss rows for every empty real-word (verse_id,pos). Idempotent.
Run with --report to only print what would be filled / still unresolved.
"""
import sqlite3, re, sys, os, json
from collections import Counter

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
PREFIXES = ['ו', 'ה', 'ל', 'ב', 'כ', 'מ', 'ש', 'ולה', 'ול', 'וב', 'ומ', 'וה', 'וכ']

# hand glosses for forms with no reusable gloss even after prefix-stripping
HAND = {
    'ליך': 'אליך', 'יצעק': 'יזעק, יצעק', 'ואי': 'ואיה, והיכן', 'רבל': 'די, רב',
    'פלת': 'פלת (שם)', 'ואון': 'ואון (שם)', 'לבתואל': 'לבתואל (שם)',
    'תתיגרו': 'תתגרו, תתגרו מלחמה', 'לשמעוני': 'לשמעוני, ממשפחת שמעון',
    'במרה': 'במרה', 'בחרדה': 'בחרדה (מקום)', 'למרים': 'למרים',
    'ותינקהו': 'ותיניק אותו', 'ותבאהו': 'ותבא אותו', 'משיתיו': 'משיתיהו, מן המים משיתיו',
    'נצים': 'נצים, ניצים (רבים)', 'ולשופט': 'ולשופט', 'מאנת': 'מאנת, סירבת',
    'הפלטה': 'הפליטה, הנותרת', 'הנשארות': 'הנשארות', 'הצמח': 'הצומח',
    'ואבות': 'ואבות, ובני אבותם', 'היותם': 'היותם', 'ויתום': 'ויתום',
    'צעקתו': 'צעקתו', 'והרגתי': 'והרגתי', 'אלמנות': 'אלמנות', 'יתומים': 'יתומים',
    'כנשיא': 'כנושה, כמלווה', 'תשימנו': 'תשים לו', 'תשיבנה': 'תשיבנה, תחזירנה',
    'שמלתו': 'שמלתו, בגדו', 'לעורו': 'לעורו', 'ושמעתי': 'ושמעתי', 'חנון': 'חנון',
    'וירגנו': 'וירגנו, ותתלוננו', 'באהליהם': 'באהליהם', 'אנא': 'אנה, לאן',
    'להחנתכם': 'להחנותכם, לחנותכם', 'להראתכם': 'להראותכם', 'יומן': 'יומם, ביום',
    'לשבט': 'לשבט', 'ובה': 'ובה, ובתוכה', 'ולאברם': 'ולאברם', 'ומישראל': 'ומישראל',
    'הלכי': 'הליכי, לכי', 'יוציא': 'יוציא, יוֹצִיא',
}

def norm(w):
    return re.sub(r'[^א-ת]', '', w or '')

def main():
    report = '--report' in sys.argv
    db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
    # form -> most common existing he gloss
    cnt = {}
    for r in db.execute('SELECT word,he FROM word_gloss WHERE he IS NOT NULL AND he!=""'):
        f = norm(r['word'])
        if f:
            cnt.setdefault(f, Counter())[r['he']] += 1
    form_he = {f: c.most_common(1)[0][0] for f, c in cnt.items()}

    def resolve(tok):
        f = norm(tok)
        if not f:
            return None
        if f in form_he:
            return form_he[f]
        if f in HAND:
            return HAND[f]
        for p in sorted(PREFIXES, key=len, reverse=True):
            if f.startswith(p) and norm(f[len(p):]) in form_he:
                return form_he[norm(f[len(p):])]
        return None

    emp = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'data', 'dict_empty_tokens.json'), encoding='utf-8'))
    fills = []; unresolved = Counter()
    for e in emp:
        tok = e['token']
        if not re.search('[א-ת]', tok):
            continue  # punctuation-only token, not a word
        g = resolve(tok)
        if g:
            fills.append((e['verse_id'], e['pos'], tok, g))
        else:
            unresolved[norm(tok)] += 1
    print(f'real-word empties: {sum(1 for e in emp if re.search("[א-ת]", e["token"]))}, resolvable: {len(fills)}, unresolved: {sum(unresolved.values())} ({len(unresolved)} forms)')
    if unresolved:
        print('UNRESOLVED forms:', dict(unresolved.most_common()))
    if report:
        return
    n = 0
    for vid, pos, tok, he in fills:
        cur = db.execute('SELECT he FROM word_gloss WHERE verse_id=? AND pos=?', (vid, pos)).fetchone()
        if cur is None:
            db.execute('INSERT INTO word_gloss(verse_id,pos,word,he) VALUES(?,?,?,?)', (vid, pos, tok, he)); n += 1
        elif not (cur['he'] or '').strip():
            db.execute('UPDATE word_gloss SET he=?, word=? WHERE verse_id=? AND pos=?', (he, tok, vid, pos)); n += 1
    db.commit()
    print(f'inserted/updated {n} word_gloss rows')

if __name__ == '__main__':
    main()
