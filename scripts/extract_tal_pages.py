# -*- coding: utf-8 -*-
"""Extract the AUTHORITATIVE content of A. Tal's "A Dictionary of Samaritan Aramaic"
straight from the scanned pages, via Claude vision — the embedded text layer and
Tesseract OCR are too noisy (per the tool's README the page image is the only
authoritative reading). We do NOT keep the images: only the extracted text content.

For every dictionary entry visible on a page the model returns:
  {lemma, root, pos, gloss_he}
 - lemma   : the head-word exactly as printed (Hebrew/Aramaic letters)
 - root    : its triliteral root in Hebrew letters (the entry's root head-word)
 - pos     : part of speech if shown (ש"ע / vb / adj. / n.f ...), else ""
 - gloss_he: a faithful, CONCISE Hebrew meaning read off the entry (not English)

Written to tal_auth_entries(pdf, printed, lemma, lemma_norm, root, root_norm, pos,
gloss_he, ord). Resumable per page (tal_pages_done). Body pages are PDF 82–1048
(printed = pdf − 81).

Usage:
  py -3 scripts/extract_tal_pages.py --pages 324,84      # test specific PDF pages
  py -3 scripts/extract_tal_pages.py --all               # full body, resumable
"""
import sqlite3, sys, io, os, re, json, time, base64, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
PDF = 'data/המילון של אברהם טל ארמית שומרונית.pdf'
MODEL = 'claude-sonnet-4-6'
PDF_LO, PDF_HI = 82, 1048
OFFSET = 81
ZOOM = 3.0

NIQ = re.compile('[֑-ׇ]')
_FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}


def norm(w):
    w = NIQ.sub('', w or '').strip(' .,;:!?"\'־׳״-()[]')
    return ''.join(_FIN.get(c, c) for c in w)


def api_key():
    k = os.environ.get('ANTHROPIC_API_KEY', '')
    if not k and os.path.exists('.env'):
        for l in open('.env', encoding='utf-8'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                k = l.split('=', 1)[1].strip().strip('"\'')
    return k


SYS = (
    'אתה קורא עמוד סרוק מתוך "מילון הארמית של השומרונים" (A Dictionary of Samaritan '
    'Aramaic) מאת אברהם טל. העמוד בנוי בשני טורים, ערוך לפי שורשים. עליך לחלץ כל ערך '
    'מילוני שבעמוד. עבור כל ערך החזר: lemma = מילת-הראש בדיוק כפי שמודפסת (אותיות '
    'עבריות/ארמיות, ללא ניקוד); root = השורש (מילת-ראש השורש שתחתיה הערך, באותיות '
    'עבריות); pos = חלק הדיבר אם מצוין (ש"ע / vb / adj. / n.f / num. ...) אחרת ""; '
    'gloss_he = הפירוש בעברית, קצר ונאמן למקור (תרגם לעברית את המשמעות; אל תמציא). '
    'אל תכלול ציטוטים/הפניות מקרא בתוך gloss_he. דלג על מילות-המדריך (running heads) '
    'שבראש העמוד. החזר אך ורק JSON.'
)
PROMPT = (
    'חלץ את כל הערכים המילוניים מן העמוד. החזר JSON יחיד בלבד בצורה:\n'
    '{"entries":[{"lemma":"...","root":"...","pos":"...","gloss_he":"..."}, ...]}\n'
    'שמור על סדר ההופעה (טור ימני מלמעלה למטה, ואז טור שמאלי). אם ערך משתרע על כמה '
    'שורשים/הוראות — שורה לכל הוראה עם אותו lemma/root וגלוסה נפרדת.'
)


def render_page(doc, pdf_page):
    import fitz
    pg = doc[pdf_page - 1]
    pix = pg.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM))
    return pix.tobytes('png')


def call(cl, png):
    b64 = base64.standard_b64encode(png).decode()
    m = cl.messages.create(
        model=MODEL, max_tokens=8000, system=SYS,
        messages=[{'role': 'user', 'content': [
            {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': b64}},
            {'type': 'text', 'text': PROMPT},
        ]}])
    txt = ''.join(b.text for b in m.content if b.type == 'text')
    i = txt.find('{')
    if i < 0:
        return {'entries': []}, m.usage
    depth = 0; instr = False; esc = False
    for j in range(i, len(txt)):
        ch = txt[j]
        if instr:
            if esc: esc = False
            elif ch == '\\': esc = True
            elif ch == '"': instr = False
        else:
            if ch == '"': instr = True
            elif ch == '{': depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(txt[i:j + 1]), m.usage
                    except Exception:
                        return {'entries': []}, m.usage
    return {'entries': []}, m.usage


def ensure_schema(db):
    cu = db.cursor()
    cu.execute("""CREATE TABLE IF NOT EXISTS tal_auth_entries (
        id INTEGER PRIMARY KEY, pdf INTEGER, printed INTEGER, lemma TEXT,
        lemma_norm TEXT, root TEXT, root_norm TEXT, pos TEXT, gloss_he TEXT, ord INTEGER)""")
    cu.execute("CREATE TABLE IF NOT EXISTS tal_pages_done (pdf INTEGER PRIMARY KEY, n INTEGER)")
    cu.execute("CREATE INDEX IF NOT EXISTS ix_tae_root ON tal_auth_entries(root_norm)")
    cu.execute("CREATE INDEX IF NOT EXISTS ix_tae_lemma ON tal_auth_entries(lemma_norm)")
    db.commit()


def main():
    import anthropic, fitz
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', default='')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--dry', action='store_true', help='print, do not write')
    ap.add_argument('--workers', type=int, default=8, help='concurrent API calls')
    args = ap.parse_args()

    db = sqlite3.connect(DB, timeout=60); db.row_factory = sqlite3.Row
    ensure_schema(db)
    done = set(r['pdf'] for r in db.execute("SELECT pdf FROM tal_pages_done"))
    if args.pages:
        pages = [int(x) for x in args.pages.split(',') if x.strip()]
    elif args.all:
        pages = [p for p in range(PDF_LO, PDF_HI + 1) if p not in done]
    else:
        print('pass --pages or --all'); return

    cl = anthropic.Anthropic(api_key=api_key())
    doc = fitz.open(PDF)
    tin = tout = 0

    def work(pdf_page):
        png = render_page(doc, pdf_page)
        for attempt in range(3):
            try:
                return pdf_page, call(cl, png)
            except Exception as e:
                if attempt == 2:
                    return pdf_page, ({'entries': []}, None)
                time.sleep(4)

    if args.dry:
        for pdf_page in pages:
            _, (res, _) = work(pdf_page)
            ents = res.get('entries', [])
            printed = pdf_page - OFFSET
            print('--- pdf %d (printed %d): %d entries ---' % (pdf_page, printed, len(ents)))
            for e in ents[:12]:
                print('   %-10s root=%-8s %s | %s' % (e.get('lemma', ''), e.get('root', ''),
                                                      e.get('pos', ''), (e.get('gloss_he', '') or '')[:50]))
        return

    n_done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(work, p): p for p in pages}
        for fut in as_completed(futs):
            pdf_page, (res, u) = fut.result()
            printed = pdf_page - OFFSET
            ents = res.get('entries', [])
            if u is not None:
                tin += u.input_tokens; tout += u.output_tokens
            if u is None and not ents:
                print('  [pdf %d] FAILED (left for re-run)' % pdf_page, flush=True); continue
            cu = db.cursor()
            cu.execute("DELETE FROM tal_auth_entries WHERE pdf=?", (pdf_page,))
            for i, e in enumerate(ents):
                lemma = (e.get('lemma') or '').strip()
                root = (e.get('root') or '').strip()
                cu.execute("""INSERT INTO tal_auth_entries
                    (pdf,printed,lemma,lemma_norm,root,root_norm,pos,gloss_he,ord)
                    VALUES (?,?,?,?,?,?,?,?,?)""",
                    (pdf_page, printed, lemma, norm(lemma), root, norm(root),
                     (e.get('pos') or '').strip(), (e.get('gloss_he') or '').strip(), i))
            cu.execute("INSERT OR REPLACE INTO tal_pages_done (pdf,n) VALUES (?,?)", (pdf_page, len(ents)))
            db.commit()
            n_done += 1
            if n_done % 20 == 0:
                print('  ... %d/%d pages  (last pdf %d, %d entries)  [~$%.2f]'
                      % (n_done, len(pages), pdf_page, len(ents),
                         tin / 1e6 * 3 + tout / 1e6 * 15), flush=True)
    print('DONE. %d pages. tokens in=%d out=%d  cost ~$%.2f'
          % (n_done, tin, tout, tin / 1e6 * 3 + tout / 1e6 * 15))
    db.close()


if __name__ == '__main__':
    main()
