import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS books (
            id      INTEGER PRIMARY KEY,
            name    TEXT NOT NULL,
            order_n INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS portions (
            id          INTEGER PRIMARY KEY,
            book_id     INTEGER NOT NULL REFERENCES books(id),
            name        TEXT NOT NULL,
            order_n     INTEGER NOT NULL,
            start_ch    INTEGER NOT NULL,
            start_v     INTEGER NOT NULL DEFAULT 1,
            end_ch      INTEGER NOT NULL,
            end_v       INTEGER NOT NULL DEFAULT 9999
        );

        CREATE TABLE IF NOT EXISTS chapters (
            id      INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL REFERENCES books(id),
            number  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sam_chapters (
            id      INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL REFERENCES books(id),
            number  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS verses (
            id          INTEGER PRIMARY KEY,
            chapter_id  INTEGER NOT NULL REFERENCES chapters(id),
            number      INTEGER NOT NULL,
            text        TEXT NOT NULL,
            sam_ch_id   INTEGER REFERENCES sam_chapters(id)
        );

        CREATE INDEX IF NOT EXISTS idx_verses_text ON verses(text);
        CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
        CREATE INDEX IF NOT EXISTS idx_portions_book ON portions(book_id);
    """)
    conn.commit()
    conn.close()


def get_books():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM books ORDER BY order_n").fetchall()
    conn.close()
    return rows


def get_portions(book_id, mode='samaritan'):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM portions WHERE book_id=? AND mode=? ORDER BY order_n",
        (book_id, mode)
    ).fetchall()
    conn.close()
    return rows


def get_chapters(portion_id=None, book_id=None):
    conn = get_connection()
    if portion_id:
        rows = conn.execute(
            """SELECT c.* FROM chapters c
               JOIN portions p ON p.id = ?
               WHERE c.book_id = p.book_id
                 AND c.number >= p.start_ch
                 AND c.number <= p.end_ch
               ORDER BY c.number""",
            (portion_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM chapters WHERE book_id=? ORDER BY number", (book_id,)
        ).fetchall()
    conn.close()
    return rows


def get_verses(chapter_id, portion_id=None):
    conn = get_connection()
    if portion_id:
        rows = conn.execute(
            """SELECT v.* FROM verses v
               JOIN chapters c ON c.id = v.chapter_id
               JOIN portions p ON p.id = ?
               WHERE v.chapter_id = ?
                 AND (c.number > p.start_ch OR v.number >= p.start_v)
                 AND (c.number < p.end_ch   OR v.number <= p.end_v)
               ORDER BY v.number""",
            (portion_id, chapter_id)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM verses WHERE chapter_id=? ORDER BY number", (chapter_id,)
        ).fetchall()
    conn.close()
    return rows


def get_sam_chapters(book_id):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM sam_chapters WHERE book_id=? ORDER BY number", (book_id,)
    ).fetchall()
    conn.close()
    return rows


def count_sam_chapters_in_portion(portion_id):
    conn = get_connection()
    row = conn.execute(
        """
        SELECT COUNT(DISTINCT sc.id)
        FROM   sam_chapters sc
        JOIN   (SELECT sam_ch_id, MIN(id) AS first_v_id FROM verses GROUP BY sam_ch_id) fv
               ON fv.sam_ch_id = sc.id
        JOIN   verses  v  ON v.id  = fv.first_v_id
        JOIN   chapters c ON c.id  = v.chapter_id
        JOIN   portions p ON p.id  = ?
        WHERE  c.book_id  = p.book_id
          AND  c.number  >= p.start_ch
          AND  c.number  <= p.end_ch
        """,
        (portion_id,)
    ).fetchone()
    conn.close()
    return row[0] if row else 0


def get_sam_chapters_in_portion(portion_id):
    """Samaritan chapters whose first verse falls within the given portion's chapter range."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT DISTINCT sc.*
        FROM   sam_chapters sc
        JOIN   (SELECT sam_ch_id, MIN(id) AS first_v_id FROM verses GROUP BY sam_ch_id) fv
               ON fv.sam_ch_id = sc.id
        JOIN   verses  v  ON v.id  = fv.first_v_id
        JOIN   chapters c ON c.id  = v.chapter_id
        JOIN   portions p ON p.id  = ?
        WHERE  c.book_id  = p.book_id
          AND  c.number  >= p.start_ch
          AND  c.number  <= p.end_ch
        ORDER  BY sc.number
        """,
        (portion_id,)
    ).fetchall()
    conn.close()
    return rows


def get_verses_by_sam_ch(sam_ch_id):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM verses WHERE sam_ch_id=? ORDER BY id", (sam_ch_id,)
    ).fetchall()
    conn.close()
    return rows


def search_verses(query, exact=False):
    conn = get_connection()
    if exact:
        where = "(' ' || v.text || ' ') LIKE ?"
        param = f"% {query} %"
    else:
        where = "v.text LIKE ?"
        param = f"%{query}%"
    rows = conn.execute(
        f"""
        SELECT v.id, v.number, v.text,
               c.number AS chapter_num,
               c.id     AS chapter_id,
               b.name   AS book_name,
               b.id     AS book_id,
               p.name   AS portion_name,
               p.id     AS portion_id
        FROM   verses v
        JOIN   chapters c ON c.id = v.chapter_id
        JOIN   books    b ON b.id = c.book_id
        LEFT JOIN (
            SELECT id, name, book_id, start_ch, end_ch
            FROM portions WHERE mode='jewish'
        ) p ON p.book_id = b.id
           AND p.start_ch <= c.number
           AND p.end_ch   >= c.number
        WHERE  {where}
        GROUP  BY v.id
        ORDER  BY b.order_n, c.number, v.number
        LIMIT  200
        """,
        (param,),
    ).fetchall()
    conn.close()
    return rows
