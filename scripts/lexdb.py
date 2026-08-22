# -*- coding: utf-8 -*-
"""Open the databases the way a BUILD script needs them.

The dictionary lives in data/lexicon.db and the Torah in data/torah.db. A script
that rebuilds a dictionary table has to create it in the lexicon — but SQLite
always creates an unqualified table in `main`. So for those scripts the lexicon
IS main, and torah.db rides along read-only: `CREATE TABLE dict_infl` lands in the
right file, while `SELECT ... FROM verses` still resolves, and no query has to
change.

Without this, a rebuild would quietly create an empty copy inside torah.db, and
because SQLite prefers `main` over an attached file, the app would read that empty
copy instead of the real dictionary — with no error anywhere.

    connect()       lexicon writable, torah read-only   → dictionary builders
    connect_dual()  torah writable, lexicon writable     → the few scripts that
                    write to both; qualify lexicon writes as lex.<table>
"""
import os
import sqlite3

_HERE = os.path.dirname(os.path.abspath(__file__))
TORAH = os.environ.get('DB_PATH') or os.path.join(_HERE, '..', 'data', 'torah.db')
LEXICON = os.environ.get('LEXICON_PATH') or os.path.join(_HERE, '..', 'data', 'lexicon.db')


def connect(row_factory=True):
    """Lexicon as main (writable), Torah attached read-only as `torah`."""
    conn = sqlite3.connect(LEXICON, uri=True)
    if row_factory:
        conn.row_factory = sqlite3.Row
    conn.execute("ATTACH DATABASE ? AS torah", (f'file:{TORAH}?mode=ro',))
    return conn


def connect_dual(row_factory=True):
    """Torah as main (writable), lexicon attached writable as `lex`.

    For scripts that fill tables on both sides. Their lexicon writes must be
    written `lex.<table>` explicitly — an unqualified CREATE would land in torah.db.
    """
    conn = sqlite3.connect(TORAH, uri=True)
    if row_factory:
        conn.row_factory = sqlite3.Row
    conn.execute("ATTACH DATABASE ? AS lex", (LEXICON,))
    return conn
