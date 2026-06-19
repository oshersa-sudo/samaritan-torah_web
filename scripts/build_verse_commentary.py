# -*- coding: utf-8 -*-
"""
Regenerate verses.interpretation ("פירוש הפסוק") as a rich, continuous,
source-woven Hebrew commentary for Genesis ch. 1-6 (the span where צדקה אל-חכים
and the other Samaritan sources are richest).

For each verse a bundle of every available source is assembled — Samaritan text,
vocalised Masorah, plain Hebrew, the Samaritan Aramaic Targum (+ Tal-dictionary
glosses of its hard words, word→root→meaning), English, Arabic (only where the
column is reliably aligned, ≤ Gen 2:17), and the linked Samaritan commentaries
(צדקה אל-חכים, תיבת מרקה / מימר מרקה, מן המסורת השומרונית), plus midrashic
background — and Opus 4.8 writes one flowing commentary that weaves them with
inline attribution.

Usage:  py -3 scripts/build_verse_commentary.py --sample 3      # preview, no write
        py -3 scripts/build_verse_commentary.py --apply          # all 159, writes
"""
import sqlite3, sys, io, os, re, json, shutil

sys.path.insert(0, '.')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
PROG = 'data/_versecomm_progress.json'
NIK = re.compile('[֑-ׇ]')
PARTICLES = {'ית', 'על', 'אל', 'דכן', 'הוא', 'היא', 'ולא', 'לא', 'מן', 'עם', 'כל',
             'דין', 'הדין', 'אפי', 'בית', 'ולה', 'לה', 'לון', 'הון', 'את', 'אשר',
             'וית', 'ועל', 'ואת', 'כד', 'ארום', 'הא'}
SYS = ('אתה פרשן מקרא מומחה, הכותב פירוש-פסוק רציף ובהיר עבור אפליקציית תורה '
       'שומרונית. הפירוש נגיש לקורא המשכיל אך ברמה גבוהה, ושוזר מקורות שונים '
       'לכלל הסבר אחד זורם — תוך ייחוס כל רעיון למקורו בקצרה ("צדקה אל-חכים", '
       '"התרגום השומרוני", "מימר מרקה", "המסורת השומרונית", "המילון הארמי", '
       '"במדרש"). אתה מסביר את פשט הפסוק, מבאר מילים קשות (בעיקר דרך הארמית), '
       'ומביא רעיונות ומדרשים הקשורים — בעברית בלבד.\n'
       'כללי כתיבה: טקסט רגיל בלבד — בלי סימוני Markdown (בלי ** או #), '
       'מילים מצוטטות בגרשיים. רושם ספרותי-פרשני נקי, בלי ניסוחי-דיבור או '
       'מילות-מילוי ("יש פה איזשהו", "כביכול" וכד\'). אל תזכיר שמות פרטיים '
       'מסופקים או משובשים — אם שם אינו ברור, השמט אותו ושמור על הרעיון.')


def bare(w):
    return NIK.sub('', (w or '')).strip()


def arabic_reliable(ch, vn):
    return (ch, vn) <= (2, 17)        # arabic_trans is misaligned past Gen 2:17


def tal_glosses(db, aramaic):
    """word → short Hebrew/English meaning for the content words of the Aramaic
    targum, via Tal's root index. A few words, deduped."""
    out, seen = [], set()
    for w in re.findall(r'[א-ת]{3,}', bare(aramaic)):
        wb = w
        if wb in PARTICLES or wb in seen:
            continue
        seen.add(wb)
        res = db.lookup_tal_dictionary(wb, limit=1)
        if res:
            e = res[0]
            g = (e.get('gloss_en') or '').strip()
            note = re.sub(r'\s+', ' ', (e.get('notes') or ''))[:60]
            meaning = g or note
            if meaning:
                out.append('%s ≈ %s' % (wb, meaning))
        if len(out) >= 8:
            break
    return out


def gather(db, conn, vid):
    r = conn.execute("""SELECT v.*, c.number ch FROM verses v
                        JOIN chapters c ON c.id=v.chapter_id WHERE v.id=?""", (vid,)).fetchone()
    ch = r['ch']; vn = int(r['number']) if str(r['number']).isdigit() else 0
    b = {'ref': 'בראשית %d:%d' % (ch, vn), 'ch': ch, 'vn': vn}
    b['text'] = (r['text'] or '').strip()
    b['masoretic'] = (r['masoretic_text'] or '').strip()
    b['simple'] = (r['simple_hebrew'] or '').strip()
    b['aramaic'] = (r['sam_aramaic'] or '').strip()
    b['english'] = (r['english'] or r['site_english'] or '').strip()
    b['arabic'] = (r['arabic_trans'] or '').strip() if arabic_reliable(ch, vn) else ''
    b['midrash'] = (r['cassuto'] or '').strip()
    b['tal'] = tal_glosses(db, b['aramaic'])
    b['tzdaka'] = [s['text'] for s in db.get_tzdaka_commentary([vid])]
    b['eyalk'] = [s['text'] for s in db.get_eyalk_commentary([vid])]
    b['tm'] = [(s['hebrew'] or s['aramaic'] or '') for s in db.get_tibat_marqe([vid])]
    return b


def prompt(b):
    L = ['כתוב פירוש רציף ובהיר לפסוק הבא מספר בראשית. שזור את המקורות שלהלן '
         'לכלל הסבר אחד זורם, ויַחֵס כל רעיון למקורו בקצרה. הסבר את פשט הפסוק, '
         'באר מילים קשות (במיוחד בעזרת הארמית והמילון), והבא רעיון או מדרש קשור '
         'אם יש. אורך: 120–230 מילים. החזר אך ורק את הפירוש, בעברית.', '',
         '== הפסוק (%s) ==' % b['ref'], b['text'] or b['masoretic']]
    if b['masoretic']:
        L += ['ניקוד: ' + b['masoretic']]
    if b['simple']:
        L += ['עברית פשוטה: ' + b['simple']]
    if b['aramaic']:
        L += ['תרגום שומרוני (ארמית): ' + b['aramaic']]
    if b['tal']:
        L += ['מילון טל (ארמית→משמעות): ' + ' ; '.join(b['tal'])]
    if b['english']:
        L += ['אנגלית: ' + b['english']]
    if b['arabic']:
        L += ['ערבית: ' + b['arabic']]
    for t in b['tzdaka']:
        L += ['פירוש צדקה אל-חכים: ' + t[:1200]]
    for t in b['tm']:
        if t.strip():
            L += ['מימר מרקה: ' + t[:800]]
    for t in b['eyalk']:
        L += ['מן המסורת השומרונית: ' + t[:800]]
    if b['midrash']:
        L += ['רקע/מדרש (קאסוטו): ' + b['midrash'][:800]]
    return '\n'.join(L)


def generate(cl, b):
    m = cl.messages.create(
        model='claude-opus-4-8', max_tokens=2000,
        thinking={'type': 'adaptive'},
        system=SYS,
        messages=[{'role': 'user', 'content': prompt(b)}])
    txt = ''.join(blk.text for blk in m.content if blk.type == 'text').strip()
    return txt, m.usage


def gen_verses(conn):
    return [r['id'] for r in conn.execute(
        """SELECT v.id FROM verses v JOIN chapters c ON c.id=v.chapter_id
           JOIN books b ON b.id=c.book_id
           WHERE b.name='בראשית' AND c.number<=6
           ORDER BY c.number, CAST(v.number AS INTEGER)""")]


def main():
    import anthropic
    from app.services import database as db
    sample = 0
    if '--sample' in sys.argv:
        sample = int(sys.argv[sys.argv.index('--sample') + 1])
    apply = '--apply' in sys.argv
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not key and os.path.exists('.env'):
        for l in open('.env', encoding='utf-8'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                key = l.split('=', 1)[1].strip().strip('"\'')
    cl = anthropic.Anthropic(api_key=key)
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    vids = gen_verses(conn)

    if sample:
        out = io.open('data/_versecomm_sample.txt', 'w', encoding='utf-8')
        tin = tout = 0
        for vid in vids[:sample]:
            b = gather(db, conn, vid)
            txt, u = generate(cl, b)
            tin += u.input_tokens; tout += u.output_tokens
            out.write('\n===== %s =====\n' % b['ref'])
            out.write('מקורות: tzdaka=%d tm=%d eyalk=%d arabic=%s tal=%d\n'
                      % (len(b['tzdaka']), len([1 for t in b['tm'] if t.strip()]),
                         len(b['eyalk']), 'כן' if b['arabic'] else 'לא', len(b['tal'])))
            out.write('--- פירוש חדש ---\n%s\n' % txt)
        out.write('\n[tokens in=%d out=%d  ~$%.3f  | est. 159 verses ~$%.2f]\n'
                  % (tin, tout, tin / 1e6 * 5 + tout / 1e6 * 25,
                     (tin / 1e6 * 5 + tout / 1e6 * 25) / sample * 159))
        out.close(); print('sample -> data/_versecomm_sample.txt'); conn.close(); return

    if not apply:
        print('specify --sample N or --apply'); conn.close(); return

    bak = DB + '.bak_versecomm'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak); print('backed up ->', bak)
    done = json.load(open(PROG, encoding='utf-8')) if os.path.exists(PROG) else {}
    tin = tout = n = 0
    for vid in vids:
        if str(vid) in done:
            continue
        b = gather(db, conn, vid)
        try:
            txt, u = generate(cl, b)
        except Exception as ex:
            print('  err vid=%d: %s' % (vid, ex)); continue
        tin += u.input_tokens; tout += u.output_tokens; n += 1
        conn.execute('UPDATE verses SET interpretation=? WHERE id=?', (txt, vid)); conn.commit()
        done[str(vid)] = 1
        json.dump(done, open(PROG, 'w', encoding='utf-8'))
        if n % 20 == 0:
            print('  %d/%d  ~$%.2f' % (n, len(vids), tin / 1e6 * 5 + tout / 1e6 * 25), flush=True)
    print('DONE. wrote %d verses.  tokens in=%d out=%d  cost ~$%.2f'
          % (n, tin, tout, tin / 1e6 * 5 + tout / 1e6 * 25), flush=True)
    conn.close()


if __name__ == '__main__':
    main()
