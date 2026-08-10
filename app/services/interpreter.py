"""
Reads pre-computed interpretations from the verses table.

Two languages live side by side: `interpretation` holds the Hebrew commentary
synthesized from the Samaritan sources (scripts/regen_interpretation.py), and
`interpretation_ar` holds its professional Arabic rendering. Both are plain
columns — nothing is generated at request time.
"""
import os
import sqlite3

_DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')

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
