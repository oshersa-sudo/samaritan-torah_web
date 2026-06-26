# -*- coding: utf-8 -*-
"""Build dict_he_index — a Hebrew→Aramaic reverse index for the dictionary's new
Hebrew side. Every Hebrew word that appears in the dictionary's glosses points back
to the Aramaic root(s) it renders, so the user can browse/search in Hebrew and land
on the Aramaic entry.

Sources: tal_auth_entries (authoritative root glosses) + tal_word_gloss (per-word
Hebrew glosses with their root). Read-only except for (re)creating dict_he_index.
Run:  py -3 scripts/build_dict_he_index.py
"""
import os, re, sqlite3, sys

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
_FINALS = {'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ'}
_NIQQUD = re.compile('[֑-ׇ]')
# short grammatical/function words that aren't useful index head-words
STOP = set('של זה זו אשר עם אל על אך כי גם או אם לא כן הוא היא הם הן את כמו אצל לפי כדי '
           'אחד אחת שם פה כאן אותו אותה אותם שלו שלה כל בו בה בהם מן עד אף הלא הנה'.split())


def norm(w):
    w = _NIQQUD.sub('', w or '').strip(' .,;:!?"\'־׳״-()[]׃')
    return ''.join(_FINALS.get(c, c) for c in w)


def he_words(text, limit=4):
    """The gloss's PRIMARY meaning words (the first few content words) — trailing
    notes/examples add noise, so we keep only the head of the gloss."""
    out = []
    for w in re.findall(r'[א-ת]{2,}', _NIQQUD.sub('', text or '')):
        if w in STOP:
            continue
        out.append(w)
        if len(out) >= limit:
            break
    return out


def main():
    conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row
    c = conn.cursor()
    # he_word -> set of (root, root_norm)
    pairs = {}

    def add(word, root):
        r = (root or '').strip()
        if not r:
            return
        w = norm(word)
        if len(w) < 2:
            return
        pairs.setdefault((w, word), set()).add((r, norm(r)))

    for row in c.execute("SELECT root, gloss_he FROM tal_auth_entries "
                         "WHERE TRIM(COALESCE(gloss_he,''))<>'' AND TRIM(COALESCE(root,''))<>''"):
        for hw in he_words(row['gloss_he']):
            add(hw, row['root'])
    for row in c.execute("SELECT root, gloss FROM tal_word_gloss "
                         "WHERE TRIM(COALESCE(gloss,''))<>'' AND TRIM(COALESCE(root,''))<>''"):
        for hw in he_words(row['gloss']):
            add(hw, row['root'])

    c.execute("DROP TABLE IF EXISTS dict_he_index")
    c.execute("CREATE TABLE dict_he_index(he_word TEXT, he_norm TEXT, root TEXT, root_norm TEXT)")
    rows = []
    for (wn, word), roots in pairs.items():
        for (root, rn) in roots:
            rows.append((word, wn, root, rn))
    c.executemany("INSERT INTO dict_he_index VALUES (?,?,?,?)", rows)
    c.execute("CREATE INDEX ix_dhi_norm ON dict_he_index(he_norm)")
    c.execute("CREATE INDEX ix_dhi_word ON dict_he_index(he_word)")
    conn.commit()
    total = c.execute("SELECT COUNT(*) FROM dict_he_index").fetchone()[0]
    words = c.execute("SELECT COUNT(DISTINCT he_norm) FROM dict_he_index").fetchone()[0]
    print(f"dict_he_index: {total} rows, {words} distinct Hebrew words")
    conn.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
