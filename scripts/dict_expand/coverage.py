# -*- coding: utf-8 -*-
"""Measure what the offline resolver can do for the piyyutim + Memar Marqe
vocabulary, before anything is written to the dictionary.

Run:  py -3 scripts/dict_expand/coverage.py
"""
import os
import re
import sqlite3
import sys
import collections

sys.path.insert(0, os.path.dirname(__file__))
import morph  # noqa: E402

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')


def corpus():
    """word -> {'piyut': freq, 'memar': freq, 'src_p': (piyut_id,title), 'src_m': section}"""
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    words = collections.defaultdict(lambda: {'piyut': 0, 'memar': 0, 'src_p': None, 'src_m': None})
    for r in conn.execute("SELECT id, title, text FROM piyutim WHERE TRIM(COALESCE(text,''))<>''"):
        for w in re.findall(r'[א-ת]{2,}', r['text']):
            d = words[w]
            d['piyut'] += 1
            if d['src_p'] is None:
                d['src_p'] = (r['id'], r['title'] or '')
    for r in conn.execute("SELECT id, book, section, aramaic FROM tm_sections "
                          "WHERE TRIM(COALESCE(aramaic,''))<>''"):
        for w in re.findall(r'[א-ת]{2,}', r['aramaic']):
            d = words[w]
            d['memar'] += 1
            if d['src_m'] is None:
                d['src_m'] = (r['id'], r['book'], r['section'])
    conn.close()
    return words


def main():
    lex = morph.Lexicon(DB)
    words = corpus()
    print(f"vocabulary: {len(words)} distinct forms "
          f"(piyyutim {sum(1 for d in words.values() if d['piyut'])}, "
          f"memar {sum(1 for d in words.values() if d['memar'])})")

    resolved, unresolved = {}, {}
    tiers = collections.Counter()
    hows = collections.Counter()
    for w in words:
        a = morph.analyze(w, lex)
        if a:
            resolved[w] = a
            tiers[a['tier']] += 1
            hows[a['how']] += 1
        else:
            unresolved[w] = words[w]

    tot = len(words)
    ntok = sum(d['piyut'] + d['memar'] for d in words.values())
    covtok = sum(words[w]['piyut'] + words[w]['memar'] for w in resolved)
    print(f"resolved   : {len(resolved)} / {tot}  ({100*len(resolved)/tot:.1f}% of forms)")
    print(f"             {covtok} / {ntok} running tokens ({100*covtok/ntok:.1f}%)")
    print(f"unresolved : {len(unresolved)}")
    print("\nby derivation depth (0 = word found as-is):")
    for t in sorted(tiers):
        print(f"   depth {t}: {tiers[t]}")
    print("\nby lexicon tier that produced the root:")
    for h, n in hows.most_common():
        print(f"   {n:6d}  {h}")

    # how much of this is NEW (not already in dict_word_index)
    conn = sqlite3.connect(DB)
    known = set(r[0] for r in conn.execute("SELECT DISTINCT word_norm FROM dict_word_index"))
    conn.close()
    new = [w for w in resolved if morph.norm(w) not in known]
    print(f"\nnew to the dictionary index: {len(new)} forms "
          f"({len(resolved)-len(new)} already indexed)")

    # unresolved, ranked by how often they actually occur
    top = sorted(unresolved.items(), key=lambda kv: -(kv[1]['piyut'] + kv[1]['memar']))
    print(f"\ntop 40 unresolved by frequency:")
    for w, d in top[:40]:
        print(f"   {w:16s} piyut={d['piyut']:4d} memar={d['memar']:4d}")
    hapax = sum(1 for _, d in top if d['piyut'] + d['memar'] == 1)
    print(f"\nunresolved that occur exactly once: {hapax} "
          f"({100*hapax/max(1,len(unresolved)):.0f}% of the unresolved)")


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
