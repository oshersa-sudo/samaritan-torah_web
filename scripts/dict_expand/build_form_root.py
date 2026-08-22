# -*- coding: utf-8 -*-
"""Build dict_form_root — a form→root table read OUT of Tal's dictionary, not
derived from it.

Every earlier attempt to answer an inflected word guessed: peel affixes until
something matches. That is how קמאה reached קמא "בוז, ביזיון". This table takes
the opposite route — it only records a form under a root when the dictionary
itself puts it there:

  entry   the head-word of an entry, and the forms listed with it
  form    Tal's own forms index
  index   Tal's word→root index
  cite    a word inside a citation, admitted ONLY when its consonant skeleton is
          the root's skeleton plus affixes — a citation is a sentence, and most
          of its words have nothing to do with the entry's root

Read-only against everything else; only (re)creates dict_form_root.
Run:  py -3 scripts/dict_expand/build_form_root.py
"""
import collections
import os
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))
import morph  # noqa: E402

# The dictionary lives in data/lexicon.db. lexdb.connect() makes it `main` so a
# rebuilt table is created THERE, and attaches torah.db read-only as `torah` so
# reads of verses/tm_sections still resolve unqualified. See scripts/lexdb.py.
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import lexdb

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')

WEAK = 'אוהי'
AFFIX_PRE = ('', 'ו', 'ד', 'ב', 'כ', 'ל', 'מ', 'ה', 'ית', 'את', 'מת', 'נ', 'י', 'ת', 'א')


def core(w):
    """The word's strong consonants — weak letters carry no identity in a root."""
    return ''.join(ch for ch in morph.norm(w) if ch not in WEAK)


def compatible(form, root):
    """Is `form` plausibly an inflection of `root`? The root's strong consonants
    must appear in the form, in order, with nothing but affix material around
    them, and the form may not run away in length."""
    fc, rc = core(form), core(root)
    if len(rc) < 2 or not fc:
        return False
    if len(morph.norm(form)) > len(morph.norm(root)) + 5:
        return False
    i = 0                                   # rc must be a subsequence of fc …
    for ch in fc:
        if i < len(rc) and ch == rc[i]:
            i += 1
    if i != len(rc):
        return False
    # … and contiguous, so קמאה is not read as a form of קום
    return rc in fc


def main():
    conn = lexdb.connect()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    rows = collections.defaultdict(set)      # (form_norm, root_norm) -> {sources}

    def add(form, root, src):
        f, r = morph.norm(form), morph.norm(root)
        if len(f) >= 2 and len(r) >= 2:
            rows[(f, r)].add(src)

    for r in c.execute("SELECT lemma, root FROM tal_auth_entries "
                       "WHERE TRIM(COALESCE(lemma,''))<>'' AND TRIM(COALESCE(root,''))<>''"):
        add(r['lemma'], r['root'], 'entry')
    # dict_entries.root is empty in the older OCR dictionary; its roots live in
    # dict_root_entries, so that is the bridge from an entry to its root.
    for r in c.execute("SELECT f.form, dre.root FROM dict_forms f "
                       "JOIN dict_root_entries dre ON dre.entry_id=f.entry_id "
                       "WHERE TRIM(COALESCE(f.form,''))<>''"):
        add(r['form'], r['root'], 'entry')
    for r in c.execute("SELECT form, root FROM tal_forms "
                       "WHERE TRIM(COALESCE(form,''))<>''"):
        add(r['form'], r['root'], 'form')
    for r in c.execute("SELECT word, root FROM dict_root_index"):
        add(r['word'], r['root'], 'index')

    # Same word, different final vowel letter. Tal spells the ordinal קמאי and
    # קמאו under קדם/קדמה — "ראשון, קדום" — but never קמאה, the form the piyyutim
    # actually use, and the emphatic strip then lands it on the unrelated קמא
    # "בוז, ביזיון".
    #
    # Generated blind this produced 11,567 pairs and made a mess: משה came back
    # with five roots, ארעה with three. So it is held to words we actually have to
    # answer — forms attested in the piyyutim or Memar — and only where the source
    # head-word points at a single root, so nothing ambiguous is widened.
    corpus = {r['form_norm'] for r in c.execute(
        "SELECT DISTINCT form_norm FROM dict_infl")} if 'dict_infl' in {
        r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")} else set()
    by_stem = {}
    for f, r in list(rows):
        if f and f[-1] in 'אהיו':
            by_stem.setdefault(f[:-1], set()).add(r)
    added = 0
    def rfam(r):
        # קדם and קדמה are one root in two spellings; count families, not strings
        return r[:-1] if len(r) > 2 and r[-1] in 'אהיו' else r

    for stem, roots in by_stem.items():
        if len({rfam(r) for r in roots}) != 1:  # genuinely ambiguous, leave it alone
            continue
        root = sorted(roots, key=len)[0]
        for end in 'אהיו':
            cand = stem + end
            if cand in corpus and (cand, root) not in rows:
                rows[(cand, root)].add('vowel')
                added += 1
    print(f'final-vowel variants added: {added}')

    kept = dropped = 0
    for r in c.execute("SELECT ci.quote, dre.root FROM dict_citations ci "
                       "JOIN dict_forms f ON f.id=ci.form_id "
                       "JOIN dict_root_entries dre ON dre.entry_id=f.entry_id "
                       "WHERE ci.quote IS NOT NULL"):
        for tok in morph.tokens(r['quote']):
            if compatible(tok, r['root']):
                add(tok, r['root'], 'cite')
                kept += 1
            else:
                dropped += 1
    print(f"citation tokens: kept {kept}, rejected {dropped} "
          f"({100*kept/max(1,kept+dropped):.1f}% admitted)")

    c.execute("DROP TABLE IF EXISTS dict_form_root")
    c.execute("""CREATE TABLE dict_form_root(
                   form_norm TEXT, root_norm TEXT, sources TEXT,
                   PRIMARY KEY(form_norm, root_norm))""")
    c.executemany("INSERT INTO dict_form_root VALUES (?,?,?)",
                  [(f, r, ','.join(sorted(s))) for (f, r), s in rows.items()])
    c.execute("CREATE INDEX ix_dfr_form ON dict_form_root(form_norm)")
    conn.commit()
    n = c.execute("SELECT COUNT(*) FROM dict_form_root").fetchone()[0]
    nf = c.execute("SELECT COUNT(DISTINCT form_norm) FROM dict_form_root").fetchone()[0]
    print(f"dict_form_root: {n} pairs / {nf} distinct forms")
    for src in ('entry', 'form', 'index', 'cite'):
        k = c.execute("SELECT COUNT(*) FROM dict_form_root WHERE sources LIKE ?",
                      (f'%{src}%',)).fetchone()[0]
        print(f"   {src}: {k}")
    for probe in ('קמאה', 'קמיך', 'צלואתה', 'חייה', 'דחלתה'):
        got = c.execute("SELECT root_norm, sources FROM dict_form_root WHERE form_norm=?",
                        (morph.norm(probe),)).fetchall()
        print(f"   {probe}: {[(g[0], g[1]) for g in got] or '—'}")
    conn.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
