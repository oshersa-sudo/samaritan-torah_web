# -*- coding: utf-8 -*-
"""Fill the MISSING Arabic translations of Genesis from the manuscript docx.

Source: "בראשית A (1).docx" — Table 0, cell [r0 c1] holds the full Arabic
translation of Genesis; Samaritan qiṣṣa (chapter) boundaries are marked by "...".
The same translation once lived in verses.arabic_trans but drifted/was lost past
Gen 2:17. This script re-extracts ONLY the verses currently missing arabic_trans,
aligns each to its Samaritan chapter:verse, and verifies the Arabic matches the
Hebrew by a literal back-translation — exactly as the user asked.

Alignment challenge: the docx has 244 qiṣṣim for Genesis vs 238 Samaritan chapters
in the DB, so positional chunk→chapter mapping drifts. A self-correcting cursor
walks the chunks in step with the DB chapters: each chapter is aligned against a
two-chunk window [A][B]; the model reports which window chunk the first/last verse
fell in, and the cursor advances accordingly (handling the few chapters the docx
splits across two chunks).

DRY-RUN by default: writes proposals to data/arabic_fill_review.jsonl (chapter,
verse, Hebrew, extracted Arabic, back-translation, matches) and does NOT touch the
DB. Apply to the DB is a separate, reviewed step (apply_arabic_fill.py).

Usage:
  py -3 scripts/fill_arabic_from_docx.py [--max-chapters N] [--start-sam N]
"""
import sqlite3, sys, io, os, re, json, time, argparse
import docx

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
DOCX = r'C:\Users\osher\Downloads\בראשית A (1).docx'
REVIEW = 'data/arabic_fill_review.jsonl'
MODEL = 'claude-sonnet-4-6'

TASH = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭ]')  # arabic diacritics


def plain(s):
    s = TASH.sub('', s)
    s = s.replace('ـ', '')                 # tatweel
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def api_key():
    k = os.environ.get('ANTHROPIC_API_KEY', '')
    if not k and os.path.exists('.env'):
        for l in open('.env', encoding='utf-8'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                k = l.split('=', 1)[1].strip().strip('"\'')
    return k


def load_chunks():
    d = docx.Document(DOCX)
    ar = d.tables[0].rows[0].cells[1].text
    return [plain(p) for p in re.split(r'\.\.\.+', ar) if p.strip()]


def load_stream():
    """The whole Genesis Arabic as one continuous de-tashkeel stream. The docx
    qiṣṣa boundaries ('...') do NOT line up with the DB Samaritan-chapter
    boundaries, so we ignore them for alignment and slide a character cursor
    over the stream instead."""
    return ' '.join(load_chunks())


SYS = (
    'אתה מיישר פרק עברי מהתורה השומרונית אל תרגומו הערבי (כתב יד שומרוני), '
    'ומאמת התאמה. אתה מקבל את פסוקי הפרק בעברית לפי הסדר, וקטע ערבי המחולק לשני '
    'מקטעים מתויגים [A] ו-[B] שמכיל את הפרק (ייתכן שגם שאריות מפרקים שכנים). '
    'יישר כל פסוק עברי אל המקטע הערבי שמתרגם אותו, לפי סדר הפסוקים. '
    'היה שמרן: סמן "matches=true" רק אם התרגום-לאחור לעברית באמת תואם בתוכן לאותו פסוק.'
)


def build_prompt(verses, window):
    he = '\n'.join('%d. [%s]%s %s' % (i + 1, v['ref'],
                   ' (חסר-תרגום)' if v['missing'] else '', v['he'])
                   for i, v in enumerate(verses))
    need = [v['ref'] for v in verses if v['missing']]
    instr = (
        'פסוקי הפרק בעברית (לפי הסדר):\n' + he +
        '\n\n=== קטע ערבי רציף (מתחיל בתחילת הפרק; עשוי להמשיך אל הפרק הבא) ===\n'
        + window +
        '\n\nיישר כל פסוק עברי אל הטקסט הערבי לפי הסדר. החזר JSON יחיד:\n'
        '{"verses":[ {"ref":"<הפניה>", "arabic":"<הטקסט הערבי המילולי המדויק מהקטע>", '
        '"back":"", "matches":null} ] }\n'
        '- שורה לכל פסוק עברי לפי הסדר (גם לא-חסרים). "arabic" = הטקסט הערבי המילולי '
        'והמדויק (verbatim) מהקטע שמתרגם אותו — העתק מילה במילה כפי שמופיע, כדי שאוכל לאתרו. '
        'אם פסוק אינו מופיע בקטע — "arabic":"".\n'
        '- רק עבור הפסוקים המסומנים (חסר-תרגום): ' + (', '.join(need) if need else '(אין)') +
        ' — מלא גם "back" = תרגום-לאחור מילולי לעברית, ו-"matches"=true/false '
        '(true רק אם ה-back תואם בתוכן לאותו פסוק עברי).\n'
        'החזר אך ורק את ה-JSON.'
    )
    return instr


def call(cl, verses, window):
    m = cl.messages.create(model=MODEL, max_tokens=3000, system=SYS,
                           messages=[{'role': 'user', 'content': build_prompt(verses, window)}])
    txt = ''.join(b.text for b in m.content if b.type == 'text')
    mt = re.search(r'\{.*\}', txt, re.S)
    if not mt:
        raise ValueError('no JSON in response: ' + txt[:200])
    return json.loads(mt.group(0))


_ARLET = re.compile('[ء-ي]')
def arletters(s):
    return ''.join(_ARLET.findall(s or ''))


def find_span(window, arabic, frm=0):
    """Locate a verbatim Arabic span inside `window` (both de-tashkeel) tolerant of
    whitespace/punctuation differences. Returns (start, end) char offsets in window
    relative to `frm`, or None. Matching is on Arabic letters only, with arbitrary
    non-letters allowed between them."""
    letters = arletters(arabic)
    if len(letters) < 6:
        return None
    head = letters[:40]                       # anchor on the span's beginning
    pat = '[^ء-ي]*'.join(re.escape(ch) for ch in head)
    m = re.search(pat, window[frm:])
    if not m:
        return None
    start = frm + m.start()
    # extend to cover the whole span (its last letters) for a tight end offset
    tail = letters[-40:] if len(letters) > 40 else letters
    pat2 = '[^ء-ي]*'.join(re.escape(ch) for ch in tail)
    m2 = re.search(pat2, window[start:])
    end = start + (m2.end() if m2 else m.end() - m.start())
    return (start, end)


def genesis_chapters(conn):
    gid = conn.execute("SELECT id FROM books WHERE name='בראשית'").fetchone()[0]
    out = []
    for sc in conn.execute("SELECT id, number FROM sam_chapters WHERE book_id=? ORDER BY number", (gid,)):
        vs = []
        for v in conn.execute(
                """SELECT v.id, c.number jch, v.number jn, v.text he,
                          TRIM(COALESCE(v.arabic_trans,'')) ar
                   FROM verses v JOIN chapters c ON c.id=v.chapter_id
                   WHERE v.sam_ch_id=? ORDER BY v.id""", (sc[0],)):
            vs.append(dict(id=v['id'], ref='%d:%d' % (v['jch'], v['jn']),
                           he=v['he'] or '', missing=not v['ar']))
        out.append(dict(sam=sc[1], verses=vs))
    return out


WIN = 2600          # chars of stream shown per chapter (covers a chapter + margin)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--max-chapters', type=int, default=0)
    args = ap.parse_args()

    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    stream = load_stream()
    print('stream chars:', len(stream))
    conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row
    chapters = genesis_chapters(conn)
    print('DB Genesis sam chapters:', len(chapters))

    out = open(REVIEW, 'w', encoding='utf-8')
    pos = 0; processed = 0
    for ch in chapters:
        N = ch['sam']
        window = stream[pos:pos + WIN]
        for attempt in range(3):
            try:
                res = call(cl, ch['verses'], window); break
            except Exception as e:
                print('  [sam %d] ERROR %s — retry' % (N, e)); time.sleep(3)
        else:
            res = {'verses': []}
        allv = res.get('verses', [])

        # advance the character cursor by the actual consumed text: move past the
        # FURTHEST verse located in the window (DB verse order within a chapter is
        # not always the stream order, so take the max end offset, not the last).
        ends = [sp[1] for v in allv for sp in [find_span(window, v.get('arabic', ''))] if sp]
        end_off = max(ends) if ends else None
        if end_off is None:
            # nothing located — advance CONSERVATIVELY (undershoot) so we never skip
            # text; the overlap self-corrects on the next chapter. Flag in the log.
            est = int(sum(len(v['he']) for v in ch['verses']) * 1.0) or 150
            end_off = min(est, WIN - 400)
            print('  [sam %d] WARN no span located; advancing ~%d (conservative)'
                  % (N, end_off))

        miss_refs = {v['ref'] for v in ch['verses'] if v['missing']}
        keep = [v for v in allv if v.get('ref') in miss_refs]
        rec = dict(sam=N, pos=pos, verses=keep)
        out.write(json.dumps(rec, ensure_ascii=False) + '\n'); out.flush()
        nm = sum(1 for v in keep if v.get('matches'))
        nf = sum(1 for v in keep if not v.get('matches'))
        print('  sam %3d (pos %d) missing:%d  match:%d  flagged:%d'
              % (N, pos, len(keep), nm, nf))
        pos += end_off
        processed += 1
        if args.max_chapters and processed >= args.max_chapters:
            break
    out.close()
    print('done. review ->', REVIEW)


if __name__ == '__main__':
    main()
