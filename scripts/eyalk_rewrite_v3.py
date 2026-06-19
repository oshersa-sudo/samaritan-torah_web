# -*- coding: utf-8 -*-
"""
Third pass for the eyalk sections still in lecture voice — the ~54 that the
placeholder pass (eyalk_rewrite_v2.py) left unchanged because the model dropped
or duplicated a ⟦Qn⟧ quote-token. Same placeholder method, but driven by Opus
4.8 (far better at carrying the tokens verbatim) with up to 3 attempts per
section. Quotes stay byte-identical by construction; a section is kept original
only if all attempts fail.

Targets the sections marked 'kept' in data/_eyalk_rw2_progress.json. Resumable.

Usage:  py -3 scripts/eyalk_rewrite_v3.py
"""
import sqlite3, sys, io, os, re, json, time, shutil

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
RUN2 = 'data/_eyalk_rw2_progress.json'
PROG = 'data/_eyalk_rw3_progress.json'
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


def _is_scripture(q):
    marks = len(NIK.findall(q))
    letters = len(re.findall(r'[א-ת]', q))
    return letters > 0 and marks >= 2 and marks / letters >= 0.4


def placehold(text):
    quotes = []

    def repl(m):
        if _is_scripture(m.group(0)):
            quotes.append(m.group(0))
            return '⟦Q%d⟧' % len(quotes)
        return m.group(0)

    return re.sub(r'"[^"]*"', repl, text), quotes


def restore(text, quotes):
    for i, q in enumerate(quotes, 1):
        tok = '⟦Q%d⟧' % i
        if text.count(tok) != 1:
            return None
        text = text.replace(tok, q)
    if '⟦' in text or '⟧' in text:
        return None
    return text


def rewrite(cl, text):
    ph, quotes = placehold(text)
    instr = ('נסח מחדש את הקטע הבא כך שייקרא כפירוש לתורה — בקול של מפרש, גוף שלישי, '
             'חשיפה ישירה ורהוטה. הסר ניסוחי-הרצאה ("המרצה", "לדבריו", "חידושו", '
             '"הוא מביא", "אומר" וכד\'), בלי לשנות תוכן ומשמעות. הקטע מכיל אסימונים '
             'בצורת ⟦Q1⟧, ⟦Q2⟧ וכו\' המסמנים ציטוטי-מקרא. **חובה קריטית:** העתק כל '
             'אסימון בדיוק כמות שהוא — אותם תווים בדיוק (⟦Q ואז המספר ואז ⟧), פעם '
             'אחת לכל אסימון, בלי לתרגם, לשנות, להשמיט או לכפול אף אסימון. כל %d '
             'האסימונים חייבים להופיע בפלט. החזר אך ורק את הטקסט המנוסח.\n\n'
             'הקטע:\n' % len(quotes)) + ph
    m = cl.messages.create(model='claude-opus-4-8', max_tokens=4000,
                           thinking={'type': 'adaptive'}, system=SYS,
                           messages=[{'role': 'user', 'content': instr}])
    new_ph = ''.join(b.text for b in m.content if b.type == 'text').strip()
    return restore(new_ph, quotes), m.usage


def kept_ids():
    d = json.load(open(RUN2, encoding='utf-8'))
    return set(int(k) for k, v in d.items() if str(v) == 'kept')


def main():
    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    ids = kept_ids()
    conn = sqlite3.connect(DB, timeout=120); conn.row_factory = sqlite3.Row
    rows = [r for r in conn.execute('SELECT id, text FROM eyalk_sections ORDER BY ord')
            if r['id'] in ids]
    if not os.path.exists(DB + '.bak_eyalk_rw3'):
        shutil.copy2(DB, DB + '.bak_eyalk_rw3'); print('backup ->', DB + '.bak_eyalk_rw3', flush=True)
    done = json.load(open(PROG, encoding='utf-8')) if os.path.exists(PROG) else {}
    tin = tout = upd = kept = 0
    print('targeting %d still-original sections' % len(rows), flush=True)
    for r in rows:
        if str(r['id']) in done:
            continue
        new = None
        for _attempt in range(3):
            try:
                new, u = rewrite(cl, r['text'])
                tin += u.input_tokens; tout += u.output_tokens
            except Exception as ex:
                print('  err id=%d: %s' % (r['id'], ex), flush=True); time.sleep(3); continue
            if new and new != r['text']:
                break
        if new and new != r['text']:
            for _t in range(6):
                try:
                    conn.execute('UPDATE eyalk_sections SET text=? WHERE id=?', (new, r['id']))
                    conn.commit(); break
                except sqlite3.OperationalError:
                    time.sleep(2)
            upd += 1; done[str(r['id'])] = 'updated'
        else:
            kept += 1; done[str(r['id'])] = 'kept'
        json.dump(done, open(PROG, 'w', encoding='utf-8'), ensure_ascii=False)
        print('  id=%d -> %s  (upd %d, kept %d)  ~$%.2f'
              % (r['id'], done[str(r['id'])], upd, kept, tin / 1e6 * 5 + tout / 1e6 * 25), flush=True)
    print('DONE. updated %d, kept %d.  tokens in=%d out=%d  cost ~$%.2f'
          % (upd, kept, tin, tout, tin / 1e6 * 5 + tout / 1e6 * 25), flush=True)
    conn.close()


if __name__ == '__main__':
    main()
