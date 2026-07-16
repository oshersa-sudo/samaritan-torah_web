"""Import the Samaritan piyyutim project into torah.db as new tables.

Source: app_unit/piyutim_data.js + app_unit/rhyme_data.js (window.PIYUTIM_DATA /
window.RHYME_DATA globals) -- this is the freshest export from the user's own
pipeline (2026-07-16), NOT samaritan_piyyutim.db (found empty/corrupted with a
leftover -journal) nor the slightly-older .xlsx.

New tables (all additive; nothing existing is touched):
  piyutim(id, title, incipit3, author, festival, genre, type, source,
          source_ref, quality, text, translation_he, translation_en, notes)
  piyutim_dict(word, gloss)                              -- shared small glossary
  piyutim_words(word, freq, freq_clean, last2, last3, phon2, phon3,
                rhyme_key, rhyme_human, rhyme_conf, rhyme_method,
                definition, occurrences)                 -- occurrences = JSON list of piyut ids

  py -3 scripts/piyutim/import_piyutim.py            # dry-run: parses + prints counts
  py -3 scripts/piyutim/import_piyutim.py --apply    # write the tables
"""
import json
import os
import sqlite3
import sys

SRC_DIR = os.path.join(os.path.expanduser('~'), 'OneDrive', 'Documents', 'Piyutim', 'app_unit')
DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')


def _load_js_global(path):
    raw = open(path, encoding='utf-8').read()
    raw = raw[raw.index('=') + 1:].strip()
    if raw.endswith(';'):
        raw = raw[:-1]
    return json.loads(raw)


def main(apply):
    piy = _load_js_global(os.path.join(SRC_DIR, 'piyutim_data.js'))
    rhy = _load_js_global(os.path.join(SRC_DIR, 'rhyme_data.js'))
    piyutim = piy['piyutim']
    p_dict = piy.get('dictionary') or {}
    r_dict = rhy.get('dictionary') or {}
    merged_dict = dict(p_dict)
    merged_dict.update(r_dict)   # same 313-entry glossary in both sources; union just in case
    words = rhy['words']

    print('piyutim: %d, shared dictionary: %d words, rhyme words: %d'
          % (len(piyutim), len(merged_dict), len(words)))
    if not apply:
        print('DRY-RUN (pass --apply to write)')
        return

    conn = sqlite3.connect(DB)
    conn.execute('DROP TABLE IF EXISTS piyutim')
    conn.execute('DROP TABLE IF EXISTS piyutim_dict')
    conn.execute('DROP TABLE IF EXISTS piyutim_words')
    conn.execute('''CREATE TABLE piyutim(
        id INTEGER PRIMARY KEY, title TEXT, incipit3 TEXT, author TEXT,
        festival TEXT, genre TEXT, type TEXT, source TEXT, source_ref TEXT,
        quality TEXT, text TEXT, translation_he TEXT, translation_en TEXT, notes TEXT)''')
    conn.execute('CREATE TABLE piyutim_dict(word TEXT PRIMARY KEY, gloss TEXT)')
    conn.execute('''CREATE TABLE piyutim_words(
        word TEXT PRIMARY KEY, freq INTEGER, freq_clean INTEGER,
        last2 TEXT, last3 TEXT, phon2 TEXT, phon3 TEXT,
        rhyme_key TEXT, rhyme_human TEXT, rhyme_conf REAL, rhyme_method TEXT,
        definition TEXT, occurrences TEXT)''')
    conn.execute('CREATE INDEX idx_piyutim_festival ON piyutim(festival, genre)')
    conn.execute('CREATE INDEX idx_piyutim_words_gk ON piyutim_words(rhyme_key)')
    conn.execute('CREATE INDEX idx_piyutim_words_p3 ON piyutim_words(phon3)')
    conn.execute('CREATE INDEX idx_piyutim_words_l3 ON piyutim_words(last3)')

    conn.executemany(
        '''INSERT INTO piyutim(id, title, incipit3, author, festival, genre, type,
           source, source_ref, quality, text, translation_he, translation_en, notes)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        [(p['id'], p.get('title'), p.get('incipit3'), p.get('author'), p.get('festival'),
          p.get('genre'), p.get('type'), p.get('source'), p.get('source_ref'), p.get('quality'),
          p.get('text'), p.get('translation_he') or None, p.get('translation_en') or None,
          p.get('notes')) for p in piyutim])

    conn.executemany('INSERT INTO piyutim_dict(word, gloss) VALUES(?,?)', list(merged_dict.items()))

    conn.executemany(
        '''INSERT INTO piyutim_words(word, freq, freq_clean, last2, last3, phon2, phon3,
           rhyme_key, rhyme_human, rhyme_conf, rhyme_method, definition, occurrences)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        [(w['w'], w.get('f'), w.get('fc'), w.get('l2'), w.get('l3'), w.get('p2'), w.get('p3'),
          w.get('gk'), w.get('gh'), w.get('gc'), w.get('gm'), w.get('d'),
          json.dumps(w.get('o') or [])) for w in words])

    conn.commit()
    conn.close()
    print('APPLIED: %d piyutim, %d dict entries, %d rhyme words written to %s'
          % (len(piyutim), len(merged_dict), len(words), DB))


if __name__ == '__main__':
    main('--apply' in sys.argv)
