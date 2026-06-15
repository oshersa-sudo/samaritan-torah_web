"""
Reads pre-computed Hebrew interpretations from verses.interpretation column.
Run scripts/translate_interpretations.py once to populate the column.
"""
import os
import sqlite3

_DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')


def get_chapter_interpretations(verse_rows):
    """
    verse_rows: list of sqlite Row-like objects with key 'id'.
    Returns {verse_id: interpretation_text} for verses that have one.
    """
    if not verse_rows:
        return {}
    ids = [v['id'] for v in verse_rows]
    placeholders = ','.join('?' * len(ids))
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        f'SELECT id, interpretation FROM verses WHERE id IN ({placeholders})', ids
    ).fetchall()
    conn.close()
    return {r['id']: r['interpretation'] for r in rows if r['interpretation']}
