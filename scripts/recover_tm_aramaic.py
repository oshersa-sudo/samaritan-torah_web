# -*- coding: utf-8 -*-
"""Recover the Aramaic original for the Tibåt Mårqe passages whose section marker
was missed by the original extraction (so their tm_sections.aramaic is empty while
the Hebrew translation is present).

For each such section we take the continuous Aramaic text of its memar from the
PDF, window it between the nearest detected section markers (so the window surely
contains the missing passage), and have the model extract the exact Aramaic segment
that the section's known Hebrew translation renders. Writes tm_sections.aramaic.

Model: claude-sonnet-4-6. Usage:
  py -3 scripts/recover_tm_aramaic.py --dry     # show what it would extract
  py -3 scripts/recover_tm_aramaic.py           # write to the DB
"""
import argparse, os, re, sqlite3, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
import extract_tibat_marqe as E
import fitz

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')
PDF = os.path.join(os.path.dirname(__file__), '..', 'data', 'TalA2019_Tibat Marqe.pdf')
MODEL = os.environ.get('TM_MODEL', 'claude-sonnet-4-6')

SYS = ("You are given the continuous Aramaic text of a passage from Tibåt Mårqe (a "
       "Samaritan Aramaic work), and the Hebrew translation of ONE numbered section "
       "within it. Return ONLY the exact Aramaic text of that one section — the "
       "contiguous Aramaic words that the given Hebrew translates — copied verbatim "
       "from the supplied text, with nothing added and no markers/numbers. If you "
       "cannot locate it, return an empty string.")


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    env = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not key and os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            if line.strip().startswith('ANTHROPIC_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def book_texts(doc):
    """Continuous Aramaic text per memar (markers 'N] [' kept, for windowing)."""
    heb_book = {}
    for i in range(42, 635):
        ms = list(E.RUN_HDR.finditer(doc[i].get_text()))
        if ms:
            heb_book[i - 1] = E.BOOKW[ms[-1].group(1)]
    raw = defaultdict(list)
    for i in sorted(heb_book):
        raw[heb_book[i]].append('\n'.join(E._aram_lines(doc[i])))
    out = {}
    grey = re.compile(r'\[\s*(\d+[ab]?)\s*\]')
    for b, chunks in raw.items():
        t = '\n'.join(chunks).replace('‏', '')
        out[b] = grey.sub(r'\1] [', t)
    return out


def markers(text):
    return {m.group(1): m.start() for m in re.finditer(r'(\d+[ab]?)\]\s*\[', text)}


def window_for(text, marks, section):
    """A slice of the book text around `section`, bounded by the nearest detected
    markers below and above (so it contains the missing section's words)."""
    try:
        n = int(re.sub(r'\D', '', section))
    except ValueError:
        return text[:6000]
    below = max((int(re.sub(r'\D','',k)) for k in marks if re.sub(r'\D','',k).isdigit()
                 and int(re.sub(r'\D','',k)) < n), default=None)
    above = min((int(re.sub(r'\D','',k)) for k in marks if re.sub(r'\D','',k).isdigit()
                 and int(re.sub(r'\D','',k)) > n), default=None)
    start = marks.get(str(below), 0) if below is not None else 0
    end = marks.get(str(above), len(text)) if above is not None else len(text)
    return text[max(0, start):min(len(text), end + 400)][:8000]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    miss = conn.execute(
        "SELECT id, book, section, hebrew FROM tm_sections "
        "WHERE TRIM(COALESCE(aramaic,''))='' AND TRIM(COALESCE(hebrew,''))<>'' ORDER BY sort_key").fetchall()
    if args.limit:
        miss = miss[:args.limit]
    print(f"{len(miss)} sections to recover")
    doc = fitz.open(PDF)
    bt = book_texts(doc)
    marks = {b: markers(t) for b, t in bt.items()}
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set'); sys.exit(1)
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    done = 0
    for r in miss:
        b, s = r['book'], r['section']
        win = window_for(bt.get(b, ''), marks.get(b, {}), s)
        if not win.strip():
            print(f"  ! no text window for {b} §{s}"); continue
        user = "ARAMAIC TEXT (around the section):\n%s\n\nHEBREW TRANSLATION of section %s:\n%s" % (
            win, s, r['hebrew'][:1500])
        msg = None
        for attempt in range(5):
            try:
                msg = client.messages.create(model=MODEL, max_tokens=1500, system=SYS,
                                             messages=[{'role': 'user', 'content': user}])
                break
            except Exception as e:
                if attempt == 4:
                    print(f"  ! API fail {b} §{s}: {e}"); break
                import time; time.sleep(3 * (attempt + 1))
        if msg is None:
            continue
        aram = ''.join(x.text for x in msg.content if getattr(x, 'type', '') == 'text').strip()
        aram = re.sub(r'^```.*?\n|\n```$', '', aram).strip()
        ok = bool(re.search('[א-ת]', aram)) and len(aram) > 8
        print(f"  {b} §{s}: {'✓ '+str(len(aram))+' chars' if ok else '✗ empty'} | {aram[:60]!r}")
        if ok and not args.dry:
            conn.execute("UPDATE tm_sections SET aramaic=? WHERE id=?", (aram, r['id'])); conn.commit()
            done += 1
    print(f"\nrecovered/written: {done}" + (" (dry-run, nothing written)" if args.dry else ""))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
