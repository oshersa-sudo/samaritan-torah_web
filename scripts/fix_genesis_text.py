# -*- coding: utf-8 -*-
"""
Genesis-only verse-text cleanup in data/torah.db, per the requested rules:

  Stage A - brackets:
    []  square  -> delete the brackets AND their content, collapse the space
    <>  angle   -> same as square
    ()  round   -> delete only the bracket chars, keep the content (glued)
    {}  curly   -> same as round (delete only the brace chars, keep content)

  Stage B1 - a word whose last letter has a final form but uses the plain form
    (כ מ נ פ צ at word end) -> replace it with the final form (ך ם ן ף ץ).
    Run AFTER Stage A so bracket-split fragments don't count.

  Stage B2 - a pause period '.' touching a stop ':' or verse-end '׃'
    (before or after, across spaces) -> drop the period.

Only verses.text of book בראשית is changed. Full backup. Re-runnable.

Usage:  py -3 scripts/fix_genesis_text.py            # dry run (shows every change)
        py -3 scripts/fix_genesis_text.py --apply
"""
import sqlite3, sys, io, os, re, shutil
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
APPLY = '--apply' in sys.argv
BOOK = next((a for a in sys.argv[1:] if a != '--apply'), 'בראשית')
SUFFIX = {'בראשית': 'gen', 'שמות': 'exo', 'ויקרא': 'lev', 'במדבר': 'num', 'דברים': 'deu'}
DB = 'data/torah.db'
FIN = {'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ'}


def stage_a(t):
    t = re.sub(r'\[+[^\[\]]*\]+', '', t)      # square (incl. [[..]]): bracket + content
    t = re.sub(r'<+[^<>]*>+', '', t)          # angle  (incl. <<..>>): bracket + content
    t = t.replace('{', '').replace('}', '')   # curly: braces only (keeps content)
    t = t.replace('(', '').replace(')', '')   # round: parens only (keeps content)
    t = re.sub(r' {2,}', ' ', t).strip()      # collapse spaces left behind
    return t


def stage_b1(t):
    n = [0]
    def rep(m):
        n[0] += 1
        return FIN[m.group(0)]
    out = re.sub(r'[כמנפצ](?![א-ת])', rep, t)
    return out, n[0]


def stage_b2(t):
    before = t
    t = re.sub(r'\.\s*([:׃])', r'\1', t)
    t = re.sub(r'([:׃])\s*\.', r'\1', t)
    return t, (before.count('.') - t.count('.'))


def main():
    conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row
    rows = conn.execute(
        '''SELECT v.id, ch.number cn, v.number vn, v.text t FROM verses v
           JOIN chapters ch ON ch.id=v.chapter_id JOIN books b ON b.id=ch.book_id
           WHERE b.name=? ORDER BY ch.number, v.number''', (BOOK,)).fetchall()

    updates = []
    n_bracket = n_final = n_dot = 0
    print('=== STAGE A (brackets) changes ===')
    for r in rows:
        orig = r['t'] or ''
        a = stage_a(orig)
        if a != orig:
            n_bracket += 1
            print('   %d:%d' % (r['cn'], r['vn']))
            print('     -  %s' % orig)
            print('     +  %s' % a)
        b1, nf = stage_b1(a)
        b2, nd = stage_b2(b1)
        n_final += nf
        n_dot += nd
        if b2 != orig:
            updates.append((b2, r['id']))

    print('\n=== STAGE B1 (final letters) changes ===')
    for r in rows:
        a = stage_a(r['t'] or '')
        b1, nf = stage_b1(a)
        if nf:
            for m in re.finditer(r'[כמנפצ](?![א-ת])', a):
                w = re.search(r'[א-ת]*' + re.escape(m.group(0)) + r'$',
                              a[:m.end()]).group(0)
                print('   %d:%d  %s -> %s%s' % (r['cn'], r['vn'], w, w[:-1], FIN[m.group(0)]))

    print('\n--- summary ---')
    print('Stage A  brackets fixed (verses): %d' % n_bracket)
    print('Stage B1 final letters fixed     : %d' % n_final)
    print('Stage B2 pause-dots cleaned      : %d' % n_dot)
    print('total verses changed             : %d' % len(updates))

    if APPLY:
        bak = DB + '.bak_%sfix' % SUFFIX.get(BOOK, 'x')
        if not os.path.exists(bak):
            shutil.copy2(DB, bak); print('backed up ->', bak)
        conn.executemany('UPDATE verses SET text=? WHERE id=?', updates)
        conn.commit()
        print('applied %d verse updates.' % len(updates))
    else:
        print('\n[dry-run] re-run with --apply to write.')
    conn.close()


if __name__ == '__main__':
    main()
