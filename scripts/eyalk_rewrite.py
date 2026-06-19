# -*- coding: utf-8 -*-
"""
Re-style the "מן המסורת השומרונית" (eyalk) commentary so it reads like a classic
Torah commentary, WITHOUT changing content, meaning, numbering or quotations.
Each section is rewritten by the model; a rewrite is accepted only if every
niqqud-bearing quotation from the original survives verbatim and the length is
sane — otherwise the original is kept untouched. DB backed up; resumable.

Usage:  py -3 scripts/eyalk_rewrite.py
"""
import sqlite3, sys, io, os, re, json, time, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DB = 'data/torah.db'
PROG = 'data/_eyalk_rewrite_progress.json'
NIK = re.compile('[֑-ׇ]')
SYS = ('אתה עורך מומחה לפרשנות המקרא. תפקידך לנסח מחדש פירוש מן המסורת השומרונית '
       'כך שייקרא כפירוש קלאסי ורציף לתורה.')


def api_key():
    k = os.environ.get('ANTHROPIC_API_KEY', '')
    if not k and os.path.exists('.env'):
        for l in open('.env', encoding='utf-8'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                k = l.split('=', 1)[1].strip().strip('"\'')
    return k


def quotes(text):
    return [m.group(1) for m in re.finditer(r'"([^"]+)"', text) if NIK.search(m.group(1))]


def ok(orig, new):
    for q in quotes(orig):
        if q not in new:
            return False, 'ציטוט שונה'
    if len(new) < 0.55 * len(orig):
        return False, 'קצר מדי'
    return True, ''


def rewrite(cl, t):
    p = ('נסח מחדש את הקטע הבא כך שייקרא כפירוש לתורה — בקול של מפרש, גוף שלישי, חשיפה '
         'ישירה ורהוטה. הסר ניסוחי-הרצאה ("המרצה", "לדבריו", "חידושו", "הוא מביא", "אומר" '
         'וכד\'). שמור **בדיוק כפי שהם, מילה במילה**: כל ציטוטי-המקרא (טקסט בגרשיים / עם '
         'ניקוד), כל הפניות-הפסוק והמספור, וכל התוכן, הרעיונות והמקורות — בלי להוסיף, להשמיט '
         'או לשנות משמעות. החזר אך ורק את הטקסט המנוסח-מחדש.\n\nהקטע:\n' + t)
    m = cl.messages.create(model='claude-sonnet-4-6', max_tokens=4000, system=SYS,
                           messages=[{'role': 'user', 'content': p}])
    return m.content[0].text.strip(), m.usage


def main():
    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    if not os.path.exists(DB + '.bak_eyalk_rw'):
        shutil.copy2(DB, DB + '.bak_eyalk_rw'); print('backup ->', DB + '.bak_eyalk_rw', flush=True)
    done = json.load(open(PROG, encoding='utf-8')) if os.path.exists(PROG) else {}
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT id, text FROM eyalk_sections ORDER BY ord').fetchall()
    tin = tout = upd = kept = 0
    for i, r in enumerate(rows, 1):
        if str(r['id']) in done:
            continue
        try:
            new, u = rewrite(cl, r['text'])
            tin += u.input_tokens; tout += u.output_tokens
            good, why = ok(r['text'], new)
            if good:
                conn.execute('UPDATE eyalk_sections SET text=? WHERE id=?', (new, r['id'])); conn.commit()
                upd += 1; done[str(r['id'])] = 'updated'
            else:
                kept += 1; done[str(r['id'])] = 'kept:' + why
            json.dump(done, open(PROG, 'w', encoding='utf-8'), ensure_ascii=False)
        except Exception as ex:
            print('  err id=%d: %s' % (r['id'], ex), flush=True); time.sleep(3); continue
        if i % 20 == 0:
            print('  %d/%d  (updated %d, kept %d)  ~$%.2f'
                  % (i, len(rows), upd, kept, tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)
    conn.close()
    print('DONE. updated %d, kept-original %d.  tokens in=%d out=%d  cost ~$%.2f'
          % (upd, kept, tin, tout, tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)


if __name__ == '__main__':
    main()
