"""
Extract Tibåt Mårqe (Abraham Tal, 2019) into two JSON files used to build the
in-app "ממקור שומרון" (Tibåt Mårqe) feature:

    data/tibat_marqe_sections.json   {book: {section: {aramaic, english}}}
    data/tibat_marqe_index.json      [{book, verse_spec, verses, refs}]

Source PDF: data/TalA2019_Tibat Marqe.pdf  (651 pages)

Layout discovered:
  * The volume is a critical edition: each Aramaic page (top text + English
    critical apparatus below a short horizontal rule) faces an English page that
    carries the running translation, marked with paragraph numbers [1]..[N] and
    grouped into six "Books" (memars) by a running header "Book One: ... | <pg>".
  * The "Biblical quotations" index (Torah part Gen..Deut) sits on printed pages
    that map a verse to one or more (Book, §) locations, e.g. "Gen. 18:6 I, 2; III, 42".

Run:  py -3 scripts/extract_tibat_marqe.py
"""
import os
import re
import json
from collections import defaultdict

import fitz  # PyMuPDF

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
PDF  = os.path.join(DATA, 'TalA2019_Tibat Marqe.pdf')

BOOKW = {'One': 'I', 'Two': 'II', 'Three': 'III',
         'Four': 'IV', 'Five': 'V', 'Six': 'VI'}
BOOK_ORDER = ['I', 'II', 'III', 'IV', 'V', 'VI']
BOOK_TITLES = {
    'I':   'ספר פליהתה',
    'II':  'על תהומי מעין עדן',
    'III': 'וידבר משה והכהנים הלוים',
    'IV':  'מימר על שירתה רבתה',
    'V':   'מימר על וימת שם משה',
    'VI':  'מימר מדבק בשנים והעשרים אות',
}
BOOK_HE_LETTER = {'I': 'א', 'II': 'ב', 'III': 'ג', 'IV': 'ד', 'V': 'ה', 'VI': 'ו'}

RUN_HDR = re.compile(r'Book (One|Two|Three|Four|Five|Six):[^\n|]*?(?:\|\s*\d+)?\s*$', re.M)
HE_HDR  = re.compile(r'ספר\s+[אבגדהו]\s*:')


# ───────────────────────── English translation ─────────────────────────────

def extract_english(doc):
    """Return {book: {section: text}} from the running English translation."""
    blocks = {}  # book -> list of page text after its running header
    for i in range(42, 635):
        t = doc[i].get_text()
        ms = list(RUN_HDR.finditer(t))
        if not ms:
            continue
        book = BOOKW[ms[-1].group(1)]
        blocks.setdefault(book, []).append(t[ms[-1].end():])

    sec_re = re.compile(r'\[(\d+[ab]?)\]')
    out = {}
    for book, chunks in blocks.items():
        txt = '\n'.join(chunks)
        parts = sec_re.split(txt)
        secs = {}
        it = iter(parts[1:])
        for marker, body in zip(it, it):
            body = re.sub(r'[ \t]+', ' ', body)
            body = re.sub(r'\n+', '\n', body).strip()
            secs[marker] = (secs.get(marker, '') + '\n' + body).strip() if marker in secs else body
        out[book] = secs
    return out


# ───────────────────────── Aramaic original ────────────────────────────────

def _rule_y(page):
    """y of the short horizontal rule separating Aramaic text from apparatus."""
    ys = []
    for item in page.get_drawings():
        for it in item['items']:
            if it[0] == 'l' and abs(it[1].y - it[2].y) < 1 and abs(it[2].x - it[1].x) > 50:
                ys.append(it[1].y)
            elif it[0] == 're' and it[1].height < 2 and it[1].width > 50:
                ys.append(it[1].y0)
    return min(ys) if ys else None


def _aram_lines(page):
    """Lines of Aramaic text above the rule, each rebuilt in RTL reading order."""
    ry = _rule_y(page)
    cut = (ry - 2) if ry else 1e9
    words = [w for w in page.get_text('words') if w[1] < cut]
    lines = defaultdict(list)
    for w in words:
        lines[round(w[1])].append(w)
    return ['‏' + ' '.join(w[4] for w in sorted(lines[y], key=lambda w: -w[0]))
            for y in sorted(lines)]


def _clean_aram(text):
    out = []
    for ln in text.split('\n'):
        if HE_HDR.search(ln):
            continue
        ln = ln.replace('‏', '')
        ln = re.sub(r'[-]', '', ln)   # private-use glyphs
        ln = re.sub(r'[A-Za-z]+', '', ln)          # latin (Torino, BL, Or, H1)
        ln = re.sub(r'\b\d+[ab]\b', '', ln)        # folio refs 116b/117a
        ln = ln.replace('|', ' ')
        ln = re.sub(r'(?<!\S)\d{1,3}(?!\S)', ' ', ln)  # printed line numbers
        ln = re.sub(r'\s+', ' ', ln).strip()
        if ln:
            out.append(ln)
    return ' '.join(out).strip()


def extract_aramaic(doc):
    """Return {book: {section: text}}. Aramaic facing page = English page - 1."""
    heb_book = {}
    for i in range(42, 635):
        ms = list(RUN_HDR.finditer(doc[i].get_text()))
        if ms:
            heb_book[i - 1] = BOOKW[ms[-1].group(1)]

    raw = defaultdict(list)
    for i in sorted(heb_book):
        raw[heb_book[i]].append('\n'.join(_aram_lines(doc[i])))

    # Two marker forms occur: the normal RTL-reconstructed "N] [" and, in the
    # grey MS-S passages, a clean "[N]". Canonicalise the latter to the former.
    split = re.compile(r'(\d+[ab]?)\]\s*\[')
    grey  = re.compile(r'\[\s*(\d+[ab]?)\s*\]')
    out = {}
    for book, chunks in raw.items():
        text = '\n'.join(chunks).replace('‏', '')
        text = grey.sub(r'\1] [', text)
        parts = split.split(text)
        secs = {}
        it = iter(parts[1:])
        for num, body in zip(it, it):
            cb = _clean_aram(body)
            secs[num] = (secs.get(num, '') + ' ' + cb).strip() if num in secs else cb
        out[book] = secs
    return out


# ───────────────────────── Biblical-quotations index ───────────────────────

BOOKMAP = {'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus',
           'Num': 'Numbers', 'Deut': 'Deuteronomy'}
BOOK_RE = re.compile(r'^(Gen|Exod|Lev|Num|Deut)\.\s')
FIRST_ROM = re.compile(r'\b(?:VI|IV|V|III|II|I)\s*[,:]')
TOK = re.compile(r'\b(VI|IV|V|III|II|I)\b|(\d+[ab]?)')


def _parse_refs(s):
    out, cur = [], None
    for m in TOK.finditer(s):
        if m.group(1):
            cur = m.group(1)
            out.append([cur, []])
        elif out:
            out[-1][1].append(m.group(2))
    return out


def _expand_verses(spec):
    spec = spec.replace('–', '-').replace('—', '-')
    res, ch = [], None
    for part in re.split(r'[;,]', spec):
        part = part.strip()
        if not part:
            continue
        if ':' in part:
            c, v = part.split(':', 1)
            try:
                ch = int(c.strip())
            except ValueError:
                ch = c.strip()
            vpart = v
        else:
            vpart = part
        for vp in vpart.replace('f.', '').split('.'):
            vp = vp.strip()
            if not vp:
                continue
            if '-' in vp:
                a, b = vp.split('-', 1)
                try:
                    for vv in range(int(a), int(b) + 1):
                        res.append((ch, vv))
                except ValueError:
                    res.append((ch, vp))
            else:
                try:
                    res.append((ch, int(vp)))
                except ValueError:
                    res.append((ch, vp))
    return res


def extract_index(doc):
    raw = '\n'.join(doc[i].get_text() for i in range(635, 647))
    a = raw.index('Biblical quotations')
    b = raw.index('Prophets', a)
    seg = raw[a:b]

    def junk(l):
        return (not l or 'Index' in l or 'zbar' in l or 'ftf' in l
                or l.startswith('Biblical quotations'))

    lines = [l.strip() for l in seg.split('\n') if not junk(l.strip())]
    entries = []
    for l in lines:
        if BOOK_RE.match(l):
            entries.append(l)
        elif entries:
            entries[-1] += ' ' + l

    data = []
    for e in entries:
        bm = re.match(r'^(Gen|Exod|Lev|Num|Deut)\.\s*(.*)$', e)
        if not bm:
            continue
        book, rest = BOOKMAP[bm.group(1)], bm.group(2)
        fm = FIRST_ROM.search(rest)
        if not fm:
            continue  # index entry with no reference (e.g. Exod. 2:7-9)
        data.append({
            'book': book,
            'verse_spec': rest[:fm.start()].strip(),
            'verses': _expand_verses(rest[:fm.start()].strip()),
            'refs': _parse_refs(rest[fm.start():].strip()),
        })
    return data


def main():
    doc = fitz.open(PDF)
    eng = extract_english(doc)
    aram = extract_aramaic(doc)

    sections = {}
    for b in BOOK_ORDER:
        sections[b] = {}
        for k in set(eng.get(b, {})) | set(aram.get(b, {})):
            sections[b][k] = {
                'english': eng.get(b, {}).get(k, '').strip(),
                'aramaic': aram.get(b, {}).get(k, '').strip(),
            }

    payload = {
        'titles': BOOK_TITLES,
        'he_letter': BOOK_HE_LETTER,
        'sections': sections,
    }
    with open(os.path.join(DATA, 'tibat_marqe_sections.json'), 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)

    index = extract_index(doc)
    with open(os.path.join(DATA, 'tibat_marqe_index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)

    n_sec = sum(len(v) for v in sections.values())
    n_ar = sum(1 for v in sections.values() for s in v.values() if s['aramaic'])
    print(f'sections: {n_sec} (with aramaic: {n_ar})')
    print(f'index entries: {len(index)}')


if __name__ == '__main__':
    main()
