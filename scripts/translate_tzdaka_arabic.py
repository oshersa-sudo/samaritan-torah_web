# -*- coding: utf-8 -*-
"""Fill tzdaka_sections.arabic by translating the Hebrew commentary back into
literary Arabic — for the "show in Arabic" toggle of the Ṣadaqah al-Ḥakīm reader.

Ṣadaqah al-Ḥakīm's Genesis commentary was composed in (Judeo-)Arabic; only a Hebrew
translation is stored here, so we render a faithful Arabic version. Resumable: only
rows whose `arabic` is still empty are translated. Batched (5/req).

Usage:  py -3 scripts/translate_tzdaka_arabic.py --limit 10   # calibrate
        py -3 scripts/translate_tzdaka_arabic.py               # the rest
"""
import sqlite3, sys, io, os, re, time, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
DB = 'data/torah.db'
MODEL = os.environ.get('TZ_MODEL', 'claude-sonnet-4-6')
BATCH = 5

SYSTEM = ('أنت مترجم خبير. النصّ تفسيرٌ سامريّ فلسفيّ على سفر التكوين بقلم صدقة الحكيم، '
          'وصل إلينا بترجمة عبرية. أعد صياغته بعربية فصيحة واضحة، أمينةً للمعنى، '
          'بأسلوب علميّ هادئ. حافظ على علامات الصفحات مثل [דף א/א] وعلى أيّ إحالات '
          'إلى الآيات كما هي قدر الإمكان. لا تُضِف شرحاً أو مقدّمات.')

RUBRIC = ('ترجم كلّ فقرة إلى العربية. أعِد لكلّ بند بالضبط بهذا الشكل '
          '(بدون أيّ نصّ آخر):\n<<<المعرّف>>>\n<الترجمة العربية>\n<<<end>>>\n')


def get_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not key and os.path.exists('.env'):
        for line in open('.env', encoding='utf-8'):
            if line.strip().startswith('ANTHROPIC_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('"').strip("'")
    return key


def translate_batch(client, batch):
    parts = []
    for sid, text in batch:
        parts.append('=== %d ===\n%s' % (sid, text))
    prompt = RUBRIC + '\n' + '\n\n'.join(parts)
    msg = client.messages.create(model=MODEL, max_tokens=4000, system=SYSTEM,
                                 messages=[{'role': 'user', 'content': prompt}])
    out = msg.content[0].text
    res = {}
    for m in re.finditer(r'<<<\s*(\d+)\s*>>>\s*(.*?)\s*<<<\s*end\s*>>>', out, re.S | re.I):
        res[int(m.group(1))] = m.group(2).strip()
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()
    key = get_api_key()
    if not key:
        print('ERROR: ANTHROPIC_API_KEY not set'); sys.exit(1)
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    conn = sqlite3.connect(DB, timeout=60); conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout=60000')
    pending = conn.execute("SELECT id, text FROM tzdaka_sections WHERE book='בראשית' "
                           "AND TRIM(COALESCE(text,''))<>'' AND TRIM(COALESCE(arabic,''))=''"
                           " ORDER BY ord").fetchall()
    pending = [(r['id'], r['text']) for r in pending]
    if args.limit:
        pending = pending[:args.limit]
    print('pending sections to translate: %d   (model %s)' % (len(pending), MODEL))
    done = 0
    for i in range(0, len(pending), BATCH):
        batch = pending[i:i + BATCH]
        try:
            res = translate_batch(client, batch)
        except Exception as ex:
            print('  batch error:', ex); time.sleep(4); continue
        for sid, _ in batch:
            ar = res.get(sid)
            if ar:
                conn.execute("UPDATE tzdaka_sections SET arabic=? WHERE id=?", (ar, sid))
                done += 1
        conn.commit()
        print('  %d/%d done' % (min(i + BATCH, len(pending)), len(pending)), flush=True)
    n = conn.execute("SELECT COUNT(*) FROM tzdaka_sections WHERE book='בראשית' "
                     "AND TRIM(COALESCE(arabic,''))<>''").fetchone()[0]
    conn.close()
    print('translated this run: %d   total Arabic-filled: %d' % (done, n))


if __name__ == '__main__':
    main()
