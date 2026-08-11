# -*- coding: utf-8 -*-
"""Produce the pre-flight report for enlarging the Aramaic dictionary:
what would be added, on what evidence, and what is left unexplained.

Writes, under data/dict_expand/ :
    proposals.tsv        every form that resolved, with root, gloss, evidence
    unknown_words.tsv    the side file — forms nothing in our sources explains
    memar_phrases.tsv    recurring Aramaic collocations + their Hebrew rendering
    report.md            the human-readable report with worked examples

Run:  py -3 scripts/dict_expand/report.py
"""
import collections
import os
import pickle
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))
import morph            # noqa: E402
import align_memar as am  # noqa: E402

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'dict_expand')


# ── corpus with a citable context line for every form ──────────────────────────
def corpus():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    W = {}

    def touch(w, src, freq_key, line):
        d = W.setdefault(w, {'piyut': 0, 'memar': 0, 'src': None, 'line': None})
        d[freq_key] += 1
        if d['src'] is None:
            d['src'], d['line'] = src, line

    for r in conn.execute("SELECT id, title, text FROM piyutim WHERE TRIM(COALESCE(text,''))<>''"):
        for ln in (r['text'] or '').split('\n'):
            for w in re.findall(r'[א-ת]{2,}', ln):
                touch(w, f"פיוט #{r['id']} — {(r['title'] or '').strip()}", 'piyut', ln.strip())
    for r in conn.execute("SELECT id, book, section, book_title, aramaic FROM tm_sections "
                          "WHERE TRIM(COALESCE(aramaic,''))<>''"):
        txt = r['aramaic']
        for m in re.finditer(r'[א-ת]{2,}', txt):
            w = m.group(0)
            lo, hi = max(0, m.start() - 60), min(len(txt), m.end() + 60)
            touch(w, f"מימר מרקה {r['book']}:{r['section']} ({r['book_title'] or ''})",
                  'memar', '…' + txt[lo:hi].strip() + '…')
    conn.close()
    return W


def main():
    os.makedirs(OUT, exist_ok=True)
    lex = morph.Lexicon(DB)
    W = corpus()
    align = {}
    pk = os.path.join(OUT, 'memar_align.pkl')
    if os.path.exists(pk):
        d = pickle.load(open(pk, 'rb'))
        align, colloc = d['align'], d['colloc']
    else:
        colloc = []

    conn = sqlite3.connect(DB)
    known = set(r[0] for r in conn.execute("SELECT DISTINCT word_norm FROM dict_word_index"))
    conn.close()

    resolved, unknown, conflicts = [], [], []
    for w, d in W.items():
        a = morph.analyze(w, lex)
        al = align.get(morph.norm(w))
        if a:
            rec = dict(a)
            rec.update({'freq_p': d['piyut'], 'freq_m': d['memar'],
                        'src': d['src'], 'line': d['line'],
                        'new': morph.norm(w) not in known,
                        'memar_he': al['he'] if al else '', 'memar_conf': al['conf'] if al else 0})
            resolved.append(rec)
            # Memar's own translation disagrees with the sense we picked from Tal?
            if al and al['conf'] >= 0.55 and a['gloss']:
                gl = set(am.he_stem(x) for x in re.findall(r'[א-ת]{2,}', a['gloss']))
                if am.he_stem(al['he']) not in gl and \
                   not any(am.cognate(am.he_stem(al['he']), g) > 0.8 for g in gl):
                    conflicts.append(rec)
        else:
            unknown.append({'word': w, 'freq_p': d['piyut'], 'freq_m': d['memar'],
                            'src': d['src'], 'line': d['line'],
                            'memar_he': al['he'] if al else '',
                            'memar_conf': al['conf'] if al else 0})

    resolved.sort(key=lambda r: -(r['freq_p'] + r['freq_m']))
    unknown.sort(key=lambda r: -(r['freq_p'] + r['freq_m']))

    # ── files ────────────────────────────────────────────────────────────────
    with open(os.path.join(OUT, 'proposals.tsv'), 'w', encoding='utf-8') as f:
        f.write("form\troot\tgloss\tderivation\tevidence\tlang\tdepth\tscore\tnew\t"
                "freq_piyut\tfreq_memar\tmemar_he\tmemar_conf\tsource\n")
        for r in resolved:
            f.write(f"{r['word']}\t{r.get('root','')}\t{r['gloss']}\t{r['derivation']}\t"
                    f"{r['how']}\t{r['lang']}\t{r['tier']}\t{r.get('score','')}\t{int(r['new'])}\t"
                    f"{r['freq_p']}\t{r['freq_m']}\t{r['memar_he']}\t{r['memar_conf']}\t{r['src']}\n")

    with open(os.path.join(OUT, 'unknown_words.tsv'), 'w', encoding='utf-8') as f:
        f.write("word\tfreq_piyut\tfreq_memar\tmemar_he_candidate\tconf\tsource\tcontext\n")
        for r in unknown:
            line = re.sub(r'\s+', ' ', r['line'] or '')   # a TSV row is one line
            f.write(f"{r['word']}\t{r['freq_p']}\t{r['freq_m']}\t{r['memar_he']}\t"
                    f"{r['memar_conf']}\t{r['src']}\t{line}\n")

    with open(os.path.join(OUT, 'memar_phrases.tsv'), 'w', encoding='utf-8') as f:
        f.write("phrase\tcount\tsection\n")
        for p, c, (sid, book, sec) in colloc:
            f.write(f"{p}\t{c}\tמימר מרקה {book}:{sec}\n")

    # ── numbers ──────────────────────────────────────────────────────────────
    tot = len(W)
    new = [r for r in resolved if r['new']]
    ar = [r for r in resolved if r['lang'] == 'ארמית']
    print(f"forms in corpus            : {tot}")
    print(f"resolved                   : {len(resolved)} ({100*len(resolved)/tot:.1f}%)")
    print(f"  of which Aramaic         : {len(ar)}")
    print(f"  of which tagged Hebrew   : {len(resolved)-len(ar)}")
    print(f"  new to the dictionary    : {len(new)}")
    print(f"unknown (side file)        : {len(unknown)}")
    print(f"sense conflicts to review  : {len(conflicts)}")
    print(f"collocations               : {len(colloc)}")
    print(f"\nfiles in {OUT}")
    return resolved, unknown, conflicts, colloc, lex


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
