# -*- coding: utf-8 -*-
"""Mirror the lexicon back into torah.db, for as long as both still hold it.

During the migration the dictionary lives in two places: lexicon.db, which the
build scripts now write, and torah.db, which still carries the original copies.
SQLite resolves an unqualified name to `main`, so the app reads torah.db — which
means a rebuilt dictionary would not reach a single reader until the copies are
dropped.

This keeps the two in step, so the split stays reversible without freezing
dictionary work. Once torah.db's copies are dropped, this script has no purpose
and should go with them.

Run after any dictionary rebuild:  py -3 scripts/sync_lexicon_to_torah.py
"""
import os, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_lexicon_db import TABLES

TORAH = os.environ.get('DB_PATH') or os.path.join(HERE, '..', 'data', 'torah.db')
LEXICON = os.environ.get('LEXICON_PATH') or os.path.join(HERE, '..', 'data', 'lexicon.db')


def main():
    # uri=True is required, or ATTACH reads the whole "file:...?mode=ro" string
    # as a literal filename and fails outright on Windows.
    conn = sqlite3.connect(TORAH, uri=True)
    conn.execute("ATTACH DATABASE ? AS lex",
                 ('file:' + os.path.abspath(LEXICON).replace(os.sep, '/') + '?mode=ro',))
    have = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    lex_have = {r[0] for r in conn.execute(
        "SELECT name FROM lex.sqlite_master WHERE type='table'")}
    n = 0
    for t in TABLES:
        if t not in lex_have:
            continue
        if t not in have:                      # already dropped — nothing to mirror
            continue
        before = conn.execute(f'SELECT COUNT(*) FROM main.{t}').fetchone()[0]
        conn.execute(f'DELETE FROM main.{t}')
        conn.execute(f'INSERT INTO main.{t} SELECT * FROM lex.{t}')
        after = conn.execute(f'SELECT COUNT(*) FROM main.{t}').fetchone()[0]
        if before != after:
            print(f'   {t:20s}{before:>8,} -> {after:,}')
        n += 1
    conn.commit()
    conn.execute("DETACH DATABASE lex")
    conn.close()
    print(f'mirrored {n} tables from lexicon.db into torah.db')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
