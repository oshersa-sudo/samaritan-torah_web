# -*- coding: utf-8 -*-
"""
Second pass over the eyalk commentary, for the sections that the first pass
(scripts/eyalk_rewrite.py) LEFT UNCHANGED because a niqqud quote would have
shifted. Here quotes are made untouchable by construction: every niqqud-bearing
quotation is swapped for a placeholder token (⟦Q1⟧ …), the model rewrites the
prose around the fixed tokens, and the ORIGINAL quotes are then reinserted
verbatim. A rewrite is accepted only if every token survives exactly once — so
the cited text is guaranteed byte-identical while the framing is rewritten.

Targets only the 'kept' sections recorded in the first run's progress file
(data/_eyalk_rewrite_progress.json). Resumable; DB backed up first.

Usage:  py -3 scripts/eyalk_rewrite_v2.py            # all kept sections
        py -3 scripts/eyalk_rewrite_v2.py --test 3   # offline: show tokenisation only
"""
import sqlite3, sys, io, os, re, json, time, shutil

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
RUN1 = 'data/_eyalk_rewrite_progress.json'
PROG = 'data/_eyalk_rw2_progress.json'
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
    """A densely vocalised quote is a Bible citation to protect; a sparsely
    pointed quote (e.g. a colloquial aside with a stray sin/shin dot) is not —
    leave it free so the rewrite can clean it."""
    marks = len(NIK.findall(q))
    letters = len(re.findall(r'[א-ת]', q))
    return letters > 0 and marks >= 2 and marks / letters >= 0.4


def placehold(text):
    """Replace every Bible-citation "…" quote with a token; return (text, quotes)."""
    quotes = []

    def repl(m):
        if _is_scripture(m.group(0)):
            quotes.append(m.group(0))
            return '⟦Q%d⟧' % len(quotes)
        return m.group(0)

    return re.sub(r'"[^"]*"', repl, text), quotes


def restore(text, quotes):
    """Put the original quotes back; return restored text or None if a token is
    missing/duplicated/garbled."""
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
             '"הוא מביא", "אומר" וכד\'), בלי להוסיף, להשמיט או לשנות תוכן ומשמעות. '
             'הטקסט מכיל אסימונים בצורת ⟦Q1⟧, ⟦Q2⟧ וכו\' המסמנים ציטוטי-מקרא: '
             'השאר כל אסימון כפי שהוא, פעם אחת בדיוק, במקום ההגיוני במשפט — אל '
             'תתרגם, תשנה, תכפיל או תשמיט אסימון. החזר אך ורק את הטקסט המנוסח.\n\n'
             'הקטע:\n' + ph)
    m = cl.messages.create(model='claude-sonnet-4-6', max_tokens=4000, system=SYS,
                           messages=[{'role': 'user', 'content': instr}])
    new_ph = ''.join(b.text for b in m.content if b.type == 'text').strip()
    return restore(new_ph, quotes), m.usage


def kept_ids():
    if not os.path.exists(RUN1):
        return None
    d = json.load(open(RUN1, encoding='utf-8'))
    return set(int(k) for k, v in d.items() if str(v).startswith('kept'))


def main():
    test = 0
    if '--test' in sys.argv:
        test = int(sys.argv[sys.argv.index('--test') + 1])
    conn = sqlite3.connect(DB, timeout=120); conn.row_factory = sqlite3.Row
    ids = kept_ids()
    rows = conn.execute('SELECT id, text FROM eyalk_sections ORDER BY ord').fetchall()
    if ids is not None:
        rows = [r for r in rows if r['id'] in ids]

    if test:
        for r in rows[:test]:
            ph, q = placehold(r['text'])
            print('--- id=%d  (%d quote(s)) ---' % (r['id'], len(q)))
            print('PLACEHELD:', ph[:240])
            print('QUOTES:', q)
        conn.close(); return

    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    bak = DB + '.bak_eyalk_rw2'
    if not os.path.exists(bak):
        shutil.copy2(DB, bak); print('backup ->', bak, flush=True)
    done = json.load(open(PROG, encoding='utf-8')) if os.path.exists(PROG) else {}
    tin = tout = upd = kept = 0
    for i, r in enumerate(rows, 1):
        if str(r['id']) in done:
            continue
        try:
            new, u = rewrite(cl, r['text'])
            tin += u.input_tokens; tout += u.output_tokens
        except Exception as ex:
            print('  err id=%d: %s' % (r['id'], ex), flush=True); time.sleep(3); continue
        if new and new != r['text']:
            for _try in range(6):
                try:
                    conn.execute('UPDATE eyalk_sections SET text=? WHERE id=?', (new, r['id']))
                    conn.commit(); break
                except sqlite3.OperationalError:
                    time.sleep(2)
            upd += 1; done[str(r['id'])] = 'updated'
        else:
            kept += 1; done[str(r['id'])] = 'kept'
        json.dump(done, open(PROG, 'w', encoding='utf-8'), ensure_ascii=False)
        if i % 25 == 0:
            print('  %d/%d  (updated %d, kept %d)  ~$%.2f'
                  % (i, len(rows), upd, kept, tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)
    print('DONE. updated %d, kept %d.  tokens in=%d out=%d  cost ~$%.2f'
          % (upd, kept, tin, tout, tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)
    conn.close()


if __name__ == '__main__':
    main()
