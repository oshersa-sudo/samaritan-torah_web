"""
Reads pre-computed interpretations from the verses table.

Two languages live side by side: `interpretation` holds the Hebrew commentary
synthesized from the Samaritan sources (scripts/regen_interpretation.py), and
`interpretation_ar` holds its professional Arabic rendering. Both are plain
columns — nothing is generated at request time.
"""
import os
import sqlite3

# The SAME database the rest of the app uses. This module used to name the
# bundled copy outright and ignore DB_PATH, which on the server points at the
# persistent disk — so the commentary panel was reading a different database
# from every other panel: the copy frozen in git. A commentary edited online
# was saved to the disk and never shown, and a commentary shipped as a boot
# patch was written to the disk and never shown either. It is taken from
# database.py so the two can no longer drift apart.
from .database import DB_PATH as _DB_PATH

# lang -> column. Anything unrecognised falls back to Hebrew rather than
# erroring, so a stale client asking for a language we dropped still renders.
_COLUMNS = {'he': 'interpretation', 'ar': 'interpretation_ar'}


def get_chapter_interpretations(verse_rows, lang='he'):
    """
    verse_rows: list of sqlite Row-like objects with key 'id'.
    Returns {verse_id: interpretation_text} for verses that have one.
    """
    if not verse_rows:
        return {}
    col = _COLUMNS.get(lang, _COLUMNS['he'])
    ids = [v['id'] for v in verse_rows]
    placeholders = ','.join('?' * len(ids))
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        f'SELECT id, {col} AS txt FROM verses WHERE id IN ({placeholders})', ids
    ).fetchall()
    conn.close()
    return {r['id']: r['txt'] for r in rows if r['txt']}
