"""Apply OCR'd Ben-Hayyim transcription records to the DB, PDF as sole source.

Reads a JSON file: a list of {"book":1,"chap":1,"verse":1,"text":"..."}.
For each record it overwrites verse_translit for the matching verse and DELETES
any verse_translit_fix row for that verse (the old Samaritan-anchored guess), so
the PDF text becomes the single authoritative transcription get_translit returns.

No completion: only verses present in the JSON are touched. Reports any record
whose (book,chap,verse) has no matching verse in the DB.

Usage: py -3 scripts/translit_pdf/apply_translit.py <records.json> [--dry]
"""
import sys, json, sqlite3, os

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')

def main():
    path = sys.argv[1]
    dry = '--dry' in sys.argv
    recs = json.load(open(path, encoding='utf-8'))
    db = sqlite3.connect(DB)
    # (book_order, chap_number, verse_number) -> verse_id
    lut = {}
    for vid, bo, ch, vn in db.execute('''
        SELECT v.id, b.order_n, c.number, v.number
        FROM verses v JOIN chapters c ON c.id=v.chapter_id
        JOIN books b ON b.id=c.book_id'''):
        lut[(int(bo), int(ch), str(vn))] = vid
    updated = inserted = cleared = 0
    missing = []
    for r in recs:
        key = (int(r['book']), int(r['chap']), str(r['verse']))
        vid = lut.get(key)
        if not vid:
            missing.append(key); continue
        text = r['text'].strip()
        if dry:
            continue
        cur = db.execute('SELECT text FROM verse_translit WHERE verse_id=?', (vid,)).fetchone()
        if cur is None:
            db.execute('INSERT INTO verse_translit(verse_id,text) VALUES(?,?)', (vid, text)); inserted += 1
        elif cur[0] != text:
            db.execute('UPDATE verse_translit SET text=? WHERE verse_id=?', (text, vid)); updated += 1
        d = db.execute('DELETE FROM verse_translit_fix WHERE verse_id=?', (vid,))
        cleared += d.rowcount
    if not dry:
        db.commit()
    print(f'records={len(recs)} updated={updated} inserted={inserted} fix_cleared={cleared} missing={len(missing)}')
    if missing:
        print('MISSING (no such verse in DB):', missing[:40])
    db.close()

if __name__ == '__main__':
    main()
