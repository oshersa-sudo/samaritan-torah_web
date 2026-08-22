# -*- coding: utf-8 -*-
"""Build data/lexicon.db — the Aramaic dictionary, carved out of torah.db.

Only tables that have NO key into a verse and that nobody edits online move here.
Everything the reader can change, and everything joined to verses.id — the
commentaries, the word-glossaries of the Torah, every *_sections and *_verse_links
table — stays in torah.db, untouched.

The result is a read-only file that ships with each deploy and overwrites itself,
so a dictionary update no longer has to be threaded past the live text.

Idempotent: rebuilds lexicon.db from scratch each run, reads torah.db only.
Run:  py -3 scripts/build_lexicon_db.py
"""
import os, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'data', 'torah.db')
DST = os.path.join(HERE, '..', 'data', 'lexicon.db')

# The rule: no verse_id, and not editable from the admin panel.
TABLES = [
    'dict_infl', 'dict_word_index', 'dict_phrase', 'dict_form_root',
    'dict_entries', 'dict_forms', 'dict_citations',
    'dict_root_index', 'dict_root_entries', 'dict_he_index',
    'dict_sense', 'dict_word_sense',
    'tal_auth_entries', 'tal_forms', 'tal_word_gloss', 'tal_pages',
    'piyutim_dict',
]
# Deliberately NOT moved, and why:
#   verse_dictionary, word_gloss, word_align, word_jewish, word_samaritan,
#   word_english, root_index, meliz_gloss, verse_translit  → keyed to verses.id
#   dict_torah_sense (verse_id), dict_memar_sense (section_id)  → keyed despite the name
#   verses, *_sections, *_verse_links, piyutim, people          → content


def main():
    if os.path.exists(DST):
        os.remove(DST)
    src = sqlite3.connect(SRC)
    src.row_factory = sqlite3.Row
    have = set(r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'"))
    missing = [t for t in TABLES if t not in have]
    if missing:
        print('missing from torah.db, skipped:', missing)

    src.execute("ATTACH DATABASE ? AS lex", (DST,))
    moved, total = [], 0
    for t in TABLES:
        if t not in have:
            continue
        ddl = src.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
                          (t,)).fetchone()[0]
        src.execute(ddl.replace(f'TABLE {t}', f'TABLE lex.{t}', 1)
                       .replace(f'TABLE "{t}"', f'TABLE lex."{t}"', 1))
        src.execute(f'INSERT INTO lex.{t} SELECT * FROM main.{t}')
        n = src.execute(f'SELECT COUNT(*) FROM lex.{t}').fetchone()[0]
        src_n = src.execute(f'SELECT COUNT(*) FROM main.{t}').fetchone()[0]
        assert n == src_n, f'{t}: copied {n} of {src_n}'
        # indexes travel with the table, or every lookup turns into a scan
        for (isql,) in src.execute(
                "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? "
                "AND sql IS NOT NULL", (t,)):
            src.execute(isql.replace(' ON ', ' ON ', 1).replace('CREATE INDEX ',
                                                                'CREATE INDEX lex.', 1)
                            .replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX lex.', 1))
        moved.append((t, n)); total += n
    src.commit()
    src.execute("DETACH DATABASE lex")
    src.close()

    dst = sqlite3.connect(DST)
    dst.execute('VACUUM'); dst.close()
    print(f'lexicon.db: {len(moved)} tables, {total:,} rows, '
          f'{os.path.getsize(DST)/1024/1024:.1f} MiB')
    for t, n in moved:
        print(f'   {t:20s}{n:>9,}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
