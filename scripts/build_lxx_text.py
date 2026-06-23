# -*- coding: utf-8 -*-
"""Build the Septuagint (LXX) comparison layer.

The attached LXX/MT/SP mapping is a *variant apparatus*: for each place where the
Septuagint differs from the Masoretic text it gives the LXX reading, the MT
reading and the Samaritan (SP) reading, keyed by Jewish (Masoretic) chapter:verse.
There is no continuous LXX text.

Per the user's instruction, the LXX comparison panel shows the *Masoretic* text,
except at the variant locations, where the MT reading is replaced by the LXX
reading. We therefore precompute, per verse, a synthetic ``verses.lxx_text`` =
masoretic_text with the LXX substitutions applied; verses with no applied variant
keep lxx_text NULL (the server falls back to masoretic_text). The raw variants are
also stored in ``lxx_variants`` for traceability.

Matching the MT fragment inside the niqqud-bearing masoretic_text is done on bare
consonants at the word/atom level (maqaf-aware), with a +-1 adjacent-verse
fallback for the cases where the dataset's versification is offset by one. The
displayed/compared text is never matched on niqqud, so substitution is robust to
vowel/te'amim differences. Fragments that cannot be located exactly are left
as Masoretic (no risky fuzzy substitution into a sacred text) and reported.

Nothing existing is modified: verses.text, verses.masoretic_text and the verse
numbers are untouched; only the new lxx_text column and lxx_variants table are
written.
"""
import json, re, sqlite3, sys, os, datetime, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB   = os.path.join(ROOT, 'data', 'torah.db')
JSON = r'C:\Users\osher\Downloads\lxx_mt_sp_mapping.json'

ONLY  = re.compile(u'[^א-ת]')   # keep Hebrew consonants only
MAQAF = u'־'
cons  = lambda s: ONLY.sub('', s)


def atomize(text):
    """List of (consonant_atom, start, end) over text; atoms are maximal runs
    separated by whitespace or maqaf, positions index into the original text."""
    atoms = []; i = 0; n = len(text)
    while i < n:
        if text[i].isspace() or text[i] == MAQAF:
            i += 1; continue
        j = i
        while j < n and not text[j].isspace() and text[j] != MAQAF:
            j += 1
        c = cons(text[i:j])
        if c:
            atoms.append((c, i, j))
        i = j
    return atoms


def apply_one(text, mt, lxx):
    """Replace the consonant-matched mt fragment in text with lxx; None if not found."""
    mt_atoms = [cons(w) for w in re.split(u'[\\s%s]+' % MAQAF, mt) if cons(w)]
    if not mt_atoms:
        return None
    atoms = atomize(text); seq = [a[0] for a in atoms]
    for k in range(0, len(seq) - len(mt_atoms) + 1):
        if seq[k:k + len(mt_atoms)] == mt_atoms:
            s = atoms[k][1]; e = atoms[k + len(mt_atoms) - 1][2]
            return text[:s] + lxx + text[e:]
    return None


def main():
    j = json.load(open(JSON, encoding='utf-8'))
    recs = []
    for bk, bd in j['data'].items():
        for ch, cd in bd['chapters'].items():
            for vs, vl in cd.items():
                for it in sorted(vl, key=lambda x: x['variant_index']):
                    recs.append(dict(book=bk, chapter=int(ch), verse=int(vs),
                                     vi=it['variant_index'],
                                     lxx=(it.get('lxx') or '').strip(),
                                     mt=(it.get('mt') or '').strip(),
                                     sp=(it.get('sp') or '').strip(),
                                     saadia=1 if it.get('saadia_samaritan') else 0,
                                     note=(it.get('note') or '').strip()))
    print('variant records:', len(recs))

    bak = DB + '.bak_lxx_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    shutil.copy2(DB, bak); print('backup:', os.path.basename(bak))

    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
    c = con.cursor()
    cols = [r['name'] for r in c.execute('PRAGMA table_info(verses)')]
    if 'lxx_text' not in cols:
        c.execute('ALTER TABLE verses ADD COLUMN lxx_text TEXT')
        print('added column verses.lxx_text')
    c.execute('''CREATE TABLE IF NOT EXISTS lxx_variants(
        id INTEGER PRIMARY KEY, verse_id INTEGER, book TEXT, chapter INTEGER,
        verse INTEGER, variant_index INTEGER, lxx TEXT, mt TEXT, sp TEXT,
        saadia_samaritan INTEGER, note TEXT, applied INTEGER)''')
    c.execute('DELETE FROM lxx_variants')
    c.execute('UPDATE verses SET lxx_text=NULL')   # idempotent rebuild

    vmap = {}
    for r in c.execute('''SELECT bk.name bn, ch.number cn, v.number vn,
                                 v.masoretic_text m, v.id id
                          FROM verses v JOIN chapters ch ON ch.id=v.chapter_id
                          JOIN books bk ON bk.id=ch.book_id'''):
        vmap[(r['bn'], r['cn'], r['vn'])] = (r['id'], r['m'] or '')

    work = {}   # verse_id -> current synthetic text (starts from masoretic)
    def cur_text(vid, orig):
        return work.get(vid, orig)

    stats = dict(ok=0, ok_adj=0, insert=0, nomatch=0, no_verse=0)
    unmatched = []
    for r in recs:
        bk, ch, vs = r['book'], r['chapter'], r['verse']
        applied_vid = None
        if not r['mt']:                       # LXX insertion (no MT counterpart)
            if (bk, ch, vs) in vmap:
                vid, orig = vmap[(bk, ch, vs)]
                work[vid] = (cur_text(vid, orig).rstrip() + ' ' + r['lxx']).strip()
                applied_vid = vid; stats['insert'] += 1
            else:
                stats['no_verse'] += 1; unmatched.append(('NOVERSE', r))
        else:
            for dv in (0, -1, 1):
                key = (bk, ch, vs + dv)
                if key not in vmap:
                    continue
                vid, orig = vmap[key]
                new = apply_one(cur_text(vid, orig), r['mt'], r['lxx'])
                if new is not None:
                    work[vid] = new; applied_vid = vid
                    stats['ok' if dv == 0 else 'ok_adj'] += 1
                    break
            if applied_vid is None:
                stats['nomatch'] += 1; unmatched.append(('NOMATCH', r))
        ref_vid = applied_vid if applied_vid is not None else \
                  (vmap[(bk, ch, vs)][0] if (bk, ch, vs) in vmap else None)
        c.execute('''INSERT INTO lxx_variants(verse_id,book,chapter,verse,
                     variant_index,lxx,mt,sp,saadia_samaritan,note,applied)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?)''',
                  (ref_vid, bk, ch, vs, r['vi'], r['lxx'], r['mt'], r['sp'],
                   r['saadia'], r['note'], 1 if applied_vid is not None else 0))

    for vid, txt in work.items():
        c.execute('UPDATE verses SET lxx_text=? WHERE id=?', (txt, vid))

    con.commit()
    print('STATS:', stats)
    print('verses with synthetic lxx_text:', len(work))
    print('applied variants:', stats['ok'] + stats['ok_adj'] + stats['insert'],
          '/', len(recs))

    rep = os.path.join(ROOT, 'data', 'lxx_unmatched_report.txt')
    with open(rep, 'w', encoding='utf-8') as f:
        f.write('LXX variants that could not be located in the DB Masoretic text\n')
        f.write('(left as Masoretic in the LXX panel)\n\n')
        for tag, r in unmatched:
            f.write(u'%s %s %d:%d  mt=[%s]  lxx=[%s]\n' %
                    (tag, r['book'], r['chapter'], r['verse'], r['mt'], r['lxx']))
    print('unmatched report:', rep, '(%d rows)' % len(unmatched))
    con.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
