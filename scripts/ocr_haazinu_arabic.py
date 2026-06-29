# -*- coding: utf-8 -*-
"""High-accuracy OCR of the Arabic translation (recension B) of the Song of Haazinu
(Deuteronomy 32:1-43) from the scanned critical edition, via Opus vision. Sends the
5 cropped top-text page images + the Samaritan Hebrew (for alignment/verification),
and returns verse->Arabic JSON. Only the TOP main text is transcribed; the bottom
critical apparatus is ignored. Prints the result (review) or --write to the DB
(verses.arabic_trans for Deut 32:1-43; the Samaritan text is never touched).

Usage:  py -3 scripts/ocr_haazinu_arabic.py            # OCR + print
        py -3 scripts/ocr_haazinu_arabic.py --write     # also write to DB
"""
import argparse, base64, json, os, sqlite3, sys

SCRATCH = os.environ.get('AR_CROPS', '')
IMAGES = [SCRATCH + '/t%d.png' % i for i in (1095, 1097, 1099, 1101, 1103, 1105)]
HEB = SCRATCH + '/haaz_heb.json'
DB = 'data/torah.db'
MODEL = 'claude-opus-4-8'

SYS = ("You transcribe the Arabic translation (recension B) of the Samaritan Pentateuch "
       "from scans of a critical edition. Each page has the MAIN translation at the TOP "
       "(verse numbers in parentheses, e.g. (١) (٢) … in Arabic-Indic digits) and a "
       "critical apparatus at the BOTTOM — you MUST ignore the apparatus and the small "
       "Hebrew catch-words. Transcribe the top main text EXACTLY as printed, keeping "
       "Arabic diacritics. Verses can span a page break — stitch them. Output ONLY a JSON "
       "object mapping each verse number (as a string '1'..'43') to its full Arabic text.")


def api_key():
    k = os.environ.get('ANTHROPIC_API_KEY', '')
    if not k and os.path.exists('.env'):
        for l in open('.env', encoding='utf-8'):
            if l.strip().startswith('ANTHROPIC_API_KEY='):
                k = l.split('=', 1)[1].strip().strip('"\'')
    return k


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--write', action='store_true')
    args = ap.parse_args()
    heb = json.load(open(HEB, encoding='utf-8'))
    content = []
    for img in IMAGES:
        b = base64.standard_b64encode(open(img, 'rb').read()).decode()
        content.append({'type': 'image', 'source': {'type': 'base64',
                        'media_type': 'image/png', 'data': b}})
    ref = '\n'.join('%s. %s' % (n, heb[n]) for n in sorted(heb, key=lambda x: int(x)))
    content.append({'type': 'text', 'text':
        "The 5 images are consecutive pages (recension B) of Deuteronomy chapter 32, "
        "verses 1-43, in order. For alignment/verification, the Samaritan Hebrew of each "
        "verse is below — make sure each Arabic verse you output is the translation of the "
        "SAME-numbered Hebrew verse.\n\n" + ref +
        "\n\nReturn ONLY the JSON object {\"1\":\"...\", ..., \"43\":\"...\"}."})

    import anthropic
    cl = anthropic.Anthropic(api_key=api_key())
    msg = cl.messages.create(model=MODEL, max_tokens=6000, system=SYS,
                             messages=[{'role': 'user', 'content': content}])
    txt = ''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text')
    cost = msg.usage.input_tokens / 1e6 * 5 + msg.usage.output_tokens / 1e6 * 25
    m = txt[txt.find('{'):txt.rfind('}') + 1]
    data = json.loads(m)
    print('verses returned:', len(data), '| ~$%.3f' % cost)
    for n in sorted(data, key=lambda x: int(x)):
        print('-- 32:%s\n   HE: %s\n   AR: %s' % (n, heb.get(n, '')[:55], data[n]))
    json.dump(data, open(SCRATCH + '/haaz_ar.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    if args.write:
        conn = sqlite3.connect(DB, timeout=60); conn.execute('PRAGMA busy_timeout=60000')
        n = 0
        for num, ar in data.items():
            cur = conn.execute(
                "UPDATE verses SET arabic_trans=? WHERE id=(SELECT v.id FROM verses v "
                "JOIN chapters ch ON ch.id=v.chapter_id WHERE ch.book_id=5 AND ch.number=32 "
                "AND v.number=?)", ((ar or '').strip(), str(num)))
            n += cur.rowcount
        conn.commit()
        print('rows written:', n, '| integrity:', conn.execute('PRAGMA integrity_check').fetchone()[0])


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
