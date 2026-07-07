"""Re-align verses.onkelos_text and verses.qumran_text by CONTENT, fixing versification
mismatches (e.g. the Decalogue in Exodus 20 / Deut 5, and Samaritan expansion verses).

Instead of the DB's own verse numbering (mas_number/number), which follows a different
Decalogue versification than Sefaria/ETCBC, we match each DB verse's masoretic_text to
Sefaria's Hebrew Torah (which shares Onkelos's versification), then take the Onkelos /
Qumran text at that exact (book, chapter, verse). A DB verse with no masoretic_text is a
Samaritan expansion → its Onkelos/Qumran is cleared (the UI shows a dashed line).

Sources reused: data/onkelos/cache/ (Sefaria Onkelos) and data/qumran/verses.jsonl.
Sefaria Hebrew is fetched to data/onkelos/heb_cache/. Run: py -3 scripts/realign_versions.py
"""
import difflib
import json
import os
import re
import sqlite3
import time
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..')
DB = os.path.join(ROOT, 'data', 'torah.db')
ONK_CACHE = os.path.join(ROOT, 'data', 'onkelos', 'cache')
HEB_CACHE = os.path.join(ROOT, 'data', 'onkelos', 'heb_cache')
QUM_JSONL = os.path.join(ROOT, 'data', 'qumran', 'verses.jsonl')
BOOKS = [(1, 'Genesis', 'Onkelos_Genesis', 50), (2, 'Exodus', 'Onkelos_Exodus', 40),
         (3, 'Leviticus', 'Onkelos_Leviticus', 27), (4, 'Numbers', 'Onkelos_Numbers', 36),
         (5, 'Deuteronomy', 'Onkelos_Deuteronomy', 34)]
_TAG = re.compile(r'<[^>]+>|\{[^}]*\}')
_FOLD = re.compile(r'[^א-ת]')


def clean(s):
    return re.sub(r'\s+', ' ', _TAG.sub('', s or '')).strip()


def fold(s):
    return _FOLD.sub('', _TAG.sub('', s or ''))


def fetch(name, ch, cache):
    os.makedirs(cache, exist_ok=True)
    cf = os.path.join(cache, '%s_%d.json' % (name, ch))
    if os.path.exists(cf):
        return json.load(open(cf, encoding='utf-8'))
    url = 'https://www.sefaria.org/api/texts/%s.%d?context=0&commentary=0' % (name, ch)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    he = json.load(urllib.request.urlopen(req, timeout=30)).get('he') or []
    json.dump(he, open(cf, 'w', encoding='utf-8'), ensure_ascii=False)
    time.sleep(0.12)
    return he


def main():
    # reference: Sefaria Hebrew + Onkelos, per (o, ch) → {verse: text/fold}
    heb, onk = {}, {}
    for o, heb_name, onk_name, maxch in BOOKS:
        for ch in range(1, maxch + 1):
            for i, v in enumerate(fetch(heb_name, ch, HEB_CACHE), 1):
                heb[(o, ch, i)] = fold(v)
            for i, v in enumerate(fetch(onk_name, ch, ONK_CACHE), 1):
                onk[(o, ch, i)] = clean(v)
    # Qumran text keyed by (o, ch, v)
    qum = {}
    if os.path.exists(QUM_JSONL):
        for line in open(QUM_JSONL, encoding='utf-8'):
            r = json.loads(line)
            qum[(r['book'], r['chap'], r['verse'])] = r['text']
    # index Sefaria Hebrew per chapter for matching
    by_chap = {}
    for (o, ch, v), fx in heb.items():
        by_chap.setdefault((o, ch), []).append((v, fx))

    conn = sqlite3.connect(DB)
    rows = conn.execute('''SELECT v.id, b.order_n, c.number jch, v.number num, v.masoretic_text, v.text
        FROM verses v JOIN chapters c ON c.id=v.chapter_id JOIN books b ON b.id=c.book_id''').fetchall()
    n_onk = n_qum = n_dash = 0
    for vid, o, jch, num, mas, sam in rows:
        # match by the Masoretic text when present; else, only for a plain-integer verse
        # number (a real verse whose masoretic_text just wasn't filled), fall back to the
        # Samaritan text. A composite number (e.g. "14-1") with no masoretic_text is a true
        # Samaritan expansion → leave it unmatched (dashed line).
        fx = fold(mas)
        if not fx and str(num).strip().isdigit():
            fx = fold(sam)
        best_v = None
        if fx:
            cand = by_chap.get((o, jch)) or []
            exact = [v for v, cf in cand if cf == fx]
            if len(exact) == 1:
                best_v = exact[0]
            else:
                best_r = 0.0
                for v, cf in cand:
                    if not cf:
                        continue
                    # containment (split commandment ⊂ combined verse) or high similarity
                    r = 1.0 if (fx in cf or cf in fx) else difflib.SequenceMatcher(None, fx, cf).ratio()
                    if r > best_r:
                        best_r, best_v = r, v
                if best_r < 0.6:
                    best_v = None
        ot = onk.get((o, jch, best_v)) if best_v else None
        qt = qum.get((o, jch, best_v)) if best_v else None
        conn.execute('UPDATE verses SET onkelos_text=?, qumran_text=? WHERE id=?', (ot, qt, vid))
        if ot:
            n_onk += 1
        if qt:
            n_qum += 1
        if best_v is None:
            n_dash += 1
    conn.commit()
    conn.close()
    print('re-aligned by content: onkelos on %d verses, qumran on %d verses; %d expansion verses cleared'
          % (n_onk, n_qum, n_dash))


if __name__ == '__main__':
    main()
