# -*- coding: utf-8 -*-
"""Build dict_word_index — a COMPREHENSIVE, browsable index of every Aramaic word
the dictionary knows, drawn from (a) Tal's own word->root index, (b) the
dictionary head-words/lemmas, (c) the surface forms tied to roots, and (d) every
Torah word that carries a Tal gloss. Each (word, root) pair is one row, so a
homograph that belongs to two roots shows up as two meanings. Presence flags
(in_torah / in_memar) drive the browse badges and let the detail view promise
"same meaning" matches grounded in the word's root.

Read-only against the source tables; only (re)creates dict_word_index.
Run:  py -3 scripts/build_dict_word_index.py
"""
import os, re, sqlite3, sys

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')

_FINALS = {'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ'}
_NIQQUD = re.compile('[֑-ׇ]')


def bare(w):
    w = _NIQQUD.sub('', w or '')
    return w.strip(' .,;:!?"\'־׳״-()[]')


def norm(w):
    return ''.join(_FINALS.get(c, c) for c in bare(w))


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # ── 1. gather (word -> set of roots) from every source ────────────────────
    word_roots = {}        # word(bare) -> set(root)
    gloss_wr = {}          # (word_norm, root_norm) -> gloss (best Hebrew gloss)

    def clean_words(raw):
        """A raw dictionary head-word may carry OCR noise (leading sense numbers,
        superscripts, the optional-letter notation 'א(ו)שקר', or several synonyms
        in one cell). Collapse parens to their inner letters, split on separators,
        and yield each pure Hebrew-letter token of length >= 2."""
        s = re.sub(r'[()]', '', bare(raw))           # 'א(ו)שקר' -> 'אושקר'
        for piece in re.split(r'[\s,;/]+', s):
            w = re.sub(r'[^א-ת]', '', piece)         # drop digits/latin/punct
            if len(w) >= 2:
                yield w

    def add(word, root, gloss=''):
        r = bare(root) if root else ''
        for w in clean_words(word):
            word_roots.setdefault(w, set())
            if r:
                word_roots[w].add(r)
            if gloss:
                k = (norm(w), norm(r))
                if k not in gloss_wr:
                    gloss_wr[k] = gloss.strip()

    # (a) Tal's own word->root index
    for row in c.execute("SELECT word, root FROM dict_root_index"):
        add(row['word'], row['root'])
    # (b) dictionary head-words / lemmas (+ their first gloss)
    for row in c.execute("SELECT lemma, root, gloss_he FROM tal_auth_entries "
                         "WHERE TRIM(COALESCE(lemma,''))<>''"):
        add(row['lemma'], row['root'], row['gloss_he'] or '')
    # (c) surface forms tied to roots
    for row in c.execute("SELECT form, root FROM tal_forms"):
        add(row['form'], row['root'])
    # (d) every Torah word with a Tal gloss
    for row in c.execute("SELECT word, root, gloss FROM tal_word_gloss"):
        add(row['word'], row['root'], row['gloss'] or '')

    # ── 2. presence maps ──────────────────────────────────────────────────────
    # Torah: a root is "present" if it has occurrences in root_index.
    torah_roots = set(r['root_norm'] for r in
                      c.execute("SELECT DISTINCT root_norm FROM root_index "
                                "WHERE TRIM(COALESCE(root_norm,''))<>''"))
    # Memar: tokenise every TM passage once; a root is present if ANY of its
    # known surface forms appears as a whole token.
    tm_tokens = set()
    for r in c.execute("SELECT aramaic FROM tm_sections"):
        for w in re.findall(r'[א-ת]{2,}', r['aramaic'] or ''):
            tm_tokens.add(w)
            tm_tokens.add(norm(w))
    # root_norm -> set(form_norm)  (from tal_forms + tal_word_gloss + the words themselves)
    root_forms = {}
    for row in c.execute("SELECT form, root FROM tal_forms"):
        root_forms.setdefault(norm(row['root']), set()).add(norm(row['form']))
    for row in c.execute("SELECT word, root FROM tal_word_gloss"):
        root_forms.setdefault(norm(row['root']), set()).add(norm(row['word']))
    for w, roots in word_roots.items():
        for r in roots:
            root_forms.setdefault(norm(r), set()).add(norm(w))
    memar_roots = set()
    for rn, forms in root_forms.items():
        if any(f in tm_tokens for f in forms):
            memar_roots.add(rn)

    # ── 3. (re)create + fill dict_word_index ──────────────────────────────────
    c.execute("DROP TABLE IF EXISTS dict_word_index")
    c.execute("""CREATE TABLE dict_word_index(
                   word TEXT, word_norm TEXT, root TEXT, root_norm TEXT,
                   gloss TEXT, in_torah INTEGER, in_memar INTEGER)""")
    rows = []
    for w in sorted(word_roots):
        wn = norm(w)
        roots = word_roots[w] or {''}
        for r in sorted(roots):
            rn = norm(r)
            g = gloss_wr.get((wn, rn)) or gloss_wr.get((wn, '')) or ''
            it = 1 if (rn and rn in torah_roots) else 0
            im = 1 if (rn and rn in memar_roots) else 0
            rows.append((w, wn, r, rn, g, it, im))
    c.executemany("INSERT INTO dict_word_index VALUES (?,?,?,?,?,?,?)", rows)
    c.execute("CREATE INDEX ix_dwi_norm ON dict_word_index(word_norm)")
    c.execute("CREATE INDEX ix_dwi_root ON dict_word_index(root_norm)")
    conn.commit()

    total = c.execute("SELECT COUNT(*) FROM dict_word_index").fetchone()[0]
    words = c.execute("SELECT COUNT(DISTINCT word_norm) FROM dict_word_index").fetchone()[0]
    t = c.execute("SELECT COUNT(*) FROM dict_word_index WHERE in_torah=1").fetchone()[0]
    m = c.execute("SELECT COUNT(*) FROM dict_word_index WHERE in_memar=1").fetchone()[0]
    print(f"dict_word_index: {total} rows, {words} distinct words; "
          f"in_torah={t}, in_memar={m}")
    conn.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
