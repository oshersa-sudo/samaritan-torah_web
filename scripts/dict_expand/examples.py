# -*- coding: utf-8 -*-
"""Pick the worked examples for the report — a spread across every kind of
evidence, each with its source passage and the derivation that produced it.

Run:  py -3 scripts/dict_expand/examples.py > data/dict_expand/examples.txt
"""
import csv
import os
import pickle
import random
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))
import morph  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'dict_expand')
DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')


def load(name):
    with open(os.path.join(OUT, name), encoding='utf-8') as f:
        return list(csv.DictReader(f, delimiter='\t'))


def ctx(word):
    """A short quoted line containing the word, plus where it came from."""
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    pat = re.compile(r'(?<![א-ת])' + re.escape(word) + r'(?![א-ת])')
    for r in conn.execute("SELECT id, title, text FROM piyutim WHERE text LIKE ? LIMIT 40",
                          (f'%{word}%',)):
        for ln in (r['text'] or '').split('\n'):
            if pat.search(ln):
                conn.close()
                return f"פיוט #{r['id']} «{(r['title'] or '').strip()}»", ln.strip()[:110]
    for r in conn.execute("SELECT book, section, aramaic, hebrew FROM tm_sections "
                          "WHERE aramaic LIKE ? LIMIT 20", (f'%{word}%',)):
        m = pat.search(r['aramaic'])
        if m:
            lo, hi = max(0, m.start() - 55), min(len(r['aramaic']), m.end() + 55)
            conn.close()
            return f"מימר מרקה {r['book']}:{r['section']}", '…' + r['aramaic'][lo:hi].strip() + '…'
    conn.close()
    return '', ''


def show(tag, rows, n, key=None):
    print(f"\n{'='*78}\n{tag}\n{'='*78}")
    if key:
        rows = [r for r in rows if key(r)]
    for r in rows[:n]:
        src, line = ctx(r['form'])
        print(f"\n  מילה     : {r['form']}   (פיוטים {r.get('freq_piyut','?')} / "
              f"מרקה {r.get('freq_memar','?')})")
        print(f"  מקור     : {src}")
        if line:
            print(f"  בהקשר    : {line}")
        print(f"  גזירה    : {r['derivation']}")
        print(f"  שורש     : {r.get('root') or '—'}")
        print(f"  פירוש    : {r['gloss'][:100]}")
        print(f"  ראיה     : {r['evidence']}   [ציון {r.get('score','')}]")
        if r.get('memar_he'):
            print(f"  מרקה עברית: «{r['memar_he']}»  (בטחון {r['memar_conf']})")


def main():
    random.seed(11)
    props = load('proposals.tsv')
    unk = load('unknown_words.tsv')
    lex = morph.Lexicon(DB)

    def f(r):
        return int(r['freq_piyut']) + int(r['freq_memar'])

    piy = [r for r in props if int(r['freq_piyut']) >= 3 and r['new'] == '1']
    mem = [r for r in props if int(r['freq_memar']) >= 3 and r['new'] == '1']
    lowscore = [r for r in props if r['score'] and int(r['score']) <= 2]

    random.shuffle(piy); random.shuffle(mem)
    show('א. פיוטים — הטיה פשוטה, הפירוש מן הערך הראשי במילון טל',
         [r for r in piy if int(r['score'] or 9) <= 2 and r['derivation'].count('←') == 0], 10)
    show('ב. פיוטים — הטיה מורכבת (תחיליות וסיומות, בניינים)',
         [r for r in piy if r['derivation'].count('←') >= 1], 8)
    show('ג. מימר מרקה — שורש ופירוש מתוך מילון טל',
         [r for r in mem if not r['memar_he']], 8)
    show('ד. מימר מרקה — הפירוש נתמך בתרגום העברי של מרקה עצמו',
         sorted([r for r in mem if r['memar_he'] and float(r['memar_conf'] or 0) >= 0.5],
                key=lambda r: -float(r['memar_conf'])), 8)
    show('ה. שחזור גזרה חלשה',
         [r for r in props if 'גזרה חלשה' in r['derivation'] and f(r) >= 4], 4)
    show('ו. סתירות בין הפירוש שנגזר לבין התרגום העברי של מרקה — לבדיקה ידנית',
         sorted([r for r in props if r['memar_he'] and float(r['memar_conf'] or 0) >= 0.6
                 and morph.norm(r['memar_he']) not in
                 set(morph.norm(x) for x in re.findall(r'[א-ת]{2,}', r['gloss']))],
                key=lambda r: -f(r)), 6)

    print(f"\n{'='*78}\nז. מילים שלא הצלחנו לפרש — הקובץ הצדדי\n{'='*78}")
    for r in unk[:10]:
        print(f"\n  מילה     : {r['word']}   (פיוטים {r['freq_piyut']} / מרקה {r['freq_memar']})")
        print(f"  מקור     : {r['source']}")
        print(f"  בהקשר    : {(r['context'] or '')[:110]}")
        if r['memar_he_candidate']:
            print(f"  הצעה מהתרגום העברי של מרקה: «{r['memar_he_candidate']}» "
                  f"(בטחון {r['conf']}) — טעונה אישור")
        else:
            print(f"  אין רמז מן המקורות שברשותנו")


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
