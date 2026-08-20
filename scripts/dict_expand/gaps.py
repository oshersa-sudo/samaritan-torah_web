# -*- coding: utf-8 -*-
"""List the words of Memar Marqe and the Aramaic Torah that the dictionary cannot
translate — counting a word as covered if ANY of its inflections is translated.

A word is "answered" when the lookup yields a root that carries dictionary senses,
or a meaning quoted from Marqe / the Torah targum, or a derivation-based suggestion.
Words are then grouped into inflectional families by their strong consonants, and a
family is reported only when NOTHING in it is answered — so כתבה is not listed as a
gap while וכתבו is understood.

Run:  py -3 scripts/dict_expand/gaps.py
"""
import collections, os, re, sqlite3, sys
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
import morph
from app.services import database as db

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'dict_expand')
WEAK = 'אוהי'
CLITIC = 'ובלכדמה'


def family(w):
    """Strong consonants after peeling a leading proclitic — the crude key that
    puts a word and its inflections in one bucket."""
    n = morph.norm(w)
    if len(n) >= 4 and n[0] in CLITIC:
        n = n[1:]
    return ''.join(ch for ch in n if ch not in WEAK) or morph.norm(w)


def main():
    conn = db.get_connection()
    freq = collections.Counter(); where = {}
    for r in conn.execute("SELECT book, section, aramaic FROM tm_sections "
                          "WHERE TRIM(COALESCE(aramaic,''))<>''"):
        for w in morph.tokens(r['aramaic']):
            freq[w] += 1
            where.setdefault(w, f"מימר מרקה {r['book']}:{r['section']}")
    for r in conn.execute("SELECT id, sam_aramaic FROM verses "
                          "WHERE TRIM(COALESCE(sam_aramaic,''))<>''"):
        for w in morph.tokens(r['sam_aramaic']):
            freq[w] += 1
            where.setdefault(w, f"תורה ארמית (פסוק {r['id']})")
    print(f"corpus: {len(freq):,} distinct words, {sum(freq.values()):,} tokens", flush=True)

    def answered(w):
        r = db.tal_full_lookup(w, torah_limit=1)
        if any(rt['senses'] for rt in r['roots']):
            return True
        return bool(r.get('meaning') or r.get('suggestion'))

    ans = {}
    for i, w in enumerate(freq):
        ans[w] = answered(w)
        if i % 3000 == 0:
            print(f"   {i:,}/{len(freq):,}", flush=True)

    fam = collections.defaultdict(list)
    for w in freq:
        fam[family(w)].append(w)
    gaps = []
    for k, ws in fam.items():
        if any(ans[w] for w in ws):
            continue
        tot = sum(freq[w] for w in ws)
        gaps.append((tot, k, sorted(ws, key=lambda x: -freq[x])))
    gaps.sort(reverse=True)

    path = os.path.join(OUT, 'untranslated_families.tsv')
    with open(path, 'w', encoding='utf-8') as f:
        f.write("total_occurrences\tfamily_key\tn_forms\tforms\tfirst_source\n")
        for tot, k, ws in gaps:
            f.write(f"{tot}\t{k}\t{len(ws)}\t{' · '.join(ws[:12])}\t{where[ws[0]]}\n")

    words = sum(len(ws) for _, _, ws in gaps)
    toks = sum(t for t, _, _ in gaps)
    print(f"\nunanswered families: {len(gaps):,}  ({words:,} word-forms, "
          f"{toks:,} occurrences = {100*toks/sum(freq.values()):.1f}% of the text)")
    print(f"answered: {sum(1 for v in ans.values() if v):,} of {len(freq):,} forms")
    print(f"\n→ {path}\n\ntop 30 families by how often a reader meets them:")
    for tot, k, ws in gaps[:30]:
        print(f"  {tot:5d}  {' · '.join(ws[:6])}")
    conn.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
