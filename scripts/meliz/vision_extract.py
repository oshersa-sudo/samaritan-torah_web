"""Extract HaMeliṣ glossary rows from the scanned PDFs with Opus vision, into meliz_gloss.

PAID (Anthropic API). Reads ANTHROPIC_API_KEY from env or .env. Per-page response is
cached (resume-safe) and token usage → running USD cost is printed. A hard --max-cost cap
stops the run before overspending.

Usage:
  # calibration: measure real cost on a few pages WITHOUT writing to the DB
  py -3 scripts/meliz/vision_extract.py --part 1 --start 4 --count 8 --calib
  # real run for a range (writes to meliz_gloss), capped at $X
  py -3 scripts/meliz/vision_extract.py --part 1 --start 4 --count 160 --apply --max-cost 15
  # whole book: --part all
"""
import argparse
import base64
import json
import os
import sqlite3
import sys

import fitz

sys.path.insert(0, os.path.dirname(__file__))
from apply_jsonl import book_order, heb_num  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DB = os.path.join(ROOT, 'data', 'torah.db')
CACHE = os.path.join(ROOT, 'data', 'meliz', 'vision_cache')
PDFS = {'1': 'המליץ/המליץ 1.pdf', '2': 'המליץ/המליץ 2.pdf',
        '3': 'המליץ/המליץ 3.pdf', '4': 'המליץ/המליץ חלק אחרון.pdf'}
MODEL = 'claude-opus-4-8'
IN_PER_MTOK, OUT_PER_MTOK = 5.0, 25.0        # USD per 1M tokens (Opus 4.8)

PROMPT = (
    "This is one page of a printed Samaritan Hebrew–Arabic dictionary (HaMeliṣ). It has a "
    "glossary TABLE and, below it, numbered editor footnotes.\n"
    "Read ONLY the table. Each table row (right→left) is: a Hebrew headword (the lemma, "
    "sometimes in parentheses and sometimes blank because it continues the row above), an "
    "ARABIC gloss, a HEBREW gloss/form, a Torah reference, and manuscript sigla.\n"
    "Return a JSON array; one object per row that HAS a Torah reference:\n"
    '  {"lemma","arabic","hebrew","book","chap","verse","note"}\n'
    "Rules:\n"
    "- lemma: the Hebrew headword for that row (carry it down when the lemma cell is blank; "
    "strip parentheses).\n"
    "- arabic: the Arabic gloss exactly as printed (keep vocalisation).\n"
    "- hebrew: the Hebrew gloss/form cell.\n"
    "- book: the reference book abbreviation exactly (בר' / שמ' / ויק' / במ' / דב').\n"
    "- chap: the chapter as the printed Hebrew numeral letters (e.g. מט, כא).\n"
    "- verse: the verse as an integer (drop any trailing '+').\n"
    "- If a row's reference is 'שם', repeat the PREVIOUS row's book/chap/verse.\n"
    "- SKIP rows with no Torah reference at all.\n"
    "- note: '' (leave empty).\n"
    "Output ONLY the JSON array, nothing else."
)


def api_key():
    k = os.environ.get('ANTHROPIC_API_KEY', '')
    if not k and os.path.exists(os.path.join(ROOT, '.env')):
        for l in open(os.path.join(ROOT, '.env'), encoding='utf-8-sig'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                k = l.split('=', 1)[1].strip().strip('"\'')
    return k


def png_b64(doc, i, dpi=170, rot=0):
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    if rot:
        mat = mat * fitz.Matrix(rot)
    return base64.b64encode(doc[i].get_pixmap(matrix=mat).tobytes('png')).decode()


def _ask(client, b64):
    msg = client.messages.create(
        model=MODEL, max_tokens=8000,
        messages=[{'role': 'user', 'content': [
            {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': b64}},
            {'type': 'text', 'text': PROMPT}]}])
    txt = ''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text').strip()
    if txt.startswith('```'):
        txt = txt.split('\n', 1)[1].rsplit('```', 1)[0]
    try:
        rows = json.loads(txt)
    except Exception:
        rows = []
    return rows, txt, msg.usage.input_tokens, msg.usage.output_tokens


def extract_page(client, doc, part, i):
    os.makedirs(CACHE, exist_ok=True)
    cf = os.path.join(CACHE, 'p%s_%04d.json' % (part, i + 1))
    if os.path.exists(cf):
        d = json.load(open(cf, encoding='utf-8'))
        return d['rows'], 0, 0
    page = doc[i]
    landscape = page.rect.width > page.rect.height
    rots = [90, 270] if landscape else [0]     # landscape: try both orientations, keep the readable one
    rows, txt, ti, to = [], '', 0, 0
    for r in rots:
        rr, tt, a, b = _ask(client, png_b64(doc, i, rot=r))
        ti += a; to += b
        if len(rr) > len(rows):
            rows, txt = rr, tt
        if rows:
            break
    json.dump({'rows': rows, 'raw': txt}, open(cf, 'w', encoding='utf-8'), ensure_ascii=False)
    return rows, ti, to


def apply_rows(conn, part, i, rows):
    src_pref = 'meliz%s p%03d' % (part, i + 1)
    conn.execute('DELETE FROM meliz_gloss WHERE src LIKE ?', (src_pref + '%',))
    n = 0
    for j, r in enumerate(rows):
        bo, ch = book_order(r.get('book')), heb_num(r.get('chap'))
        vs = r.get('verse')
        vs = int(str(vs)) if str(vs).isdigit() else None
        lemma = (r.get('lemma') or '').strip()
        if not (bo and ch and vs and lemma):
            continue
        conn.execute('INSERT INTO meliz_gloss(book,chap,verse,lemma,hebrew,arabic,note,src) '
                     'VALUES(?,?,?,?,?,?,?,?)',
                     (bo, ch, vs, lemma, (r.get('hebrew') or '').strip(),
                      (r.get('arabic') or '').strip(), (r.get('note') or '').strip(),
                      '%s r%02d' % (src_pref, j)))
        n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--part', required=True)
    ap.add_argument('--start', type=int, default=1)
    ap.add_argument('--count', type=int, default=1)
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--calib', action='store_true')
    ap.add_argument('--max-cost', type=float, default=5.0)
    a = ap.parse_args()
    import anthropic
    client = anthropic.Anthropic(api_key=api_key())
    parts = ['3', '2', '1', '4'] if a.part == 'all' else [a.part]
    conn = sqlite3.connect(DB) if a.apply else None
    tin = tout = 0.0
    pages = rowsN = 0
    for part in parts:
        doc = fitz.open(os.path.join(ROOT, PDFS[part]))
        start = 0 if a.part == 'all' else a.start - 1
        end = doc.page_count if a.part == 'all' else min(a.start - 1 + a.count, doc.page_count)
        for i in range(start, end):
            rows, ti, to = extract_page(client, doc, part, i)
            tin += ti; tout += to; pages += 1
            if a.apply:
                rowsN += apply_rows(conn, part, i, rows); conn.commit()
            cost = tin / 1e6 * IN_PER_MTOK + tout / 1e6 * OUT_PER_MTOK
            print('part %s p%d: %d rows | tok %d/%d | $%.3f so far'
                  % (part, i + 1, len(rows), ti, to, cost))
            if cost >= a.max_cost:
                print('!! reached --max-cost $%.2f — stopping.' % a.max_cost);
                if conn: conn.close()
                return
    cost = tin / 1e6 * IN_PER_MTOK + tout / 1e6 * OUT_PER_MTOK
    live = [c for c in (tin, tout)]
    print('\nDONE %d pages | inserted %d rows | in=%d out=%d tok | COST $%.3f'
          % (pages, rowsN, tin, tout, cost))
    if pages and (tin or tout):
        print('avg $%.4f/page → projected 861 pages ≈ $%.0f' % (cost / pages, cost / pages * 861))
    if conn:
        print('meliz_gloss now', conn.execute('SELECT count(*) FROM meliz_gloss').fetchone()[0])
        conn.close()


if __name__ == '__main__':
    main()
