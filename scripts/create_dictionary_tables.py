"""Create the Samaritan-Aramaic dictionary tables in data/torah.db.

Source: "המילון של אברהם טל - ארמית שומרונית" (A. Tal, A Dictionary of
Samaritan Aramaic), dictionary body starting at printed page 83.

The dictionary is modelled with three linked tables:

  dict_entries    one row per head-lemma (the enlarged-font word, e.g. אגר),
                  with its root and its primary Hebrew/English gloss.
  dict_forms      the related forms listed under a head-lemma (e.g. מיגר,
                  אגירו, אגרה), each with its own gloss. The head-lemma itself
                  is stored as the first form (order_n = 0) so every citation
                  hangs off a form uniformly.
  dict_citations  the quotations and their source references attached to a
                  given form.

This script only ADDS tables; it never alters or drops anything that already
exists in torah.db (the Torah project tables are left completely untouched).
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS dict_entries (
    id        INTEGER PRIMARY KEY,
    lemma     TEXT    NOT NULL,            -- head-word (enlarged font), e.g. אגר
    root      TEXT,                        -- root of the word
    gloss_he  TEXT,                        -- meaning in Hebrew,   e.g. שכר ותמורה
    gloss_en  TEXT,                        -- meaning in English,  e.g. wages
    pos       TEXT,                        -- part of speech, e.g. "n. f", "vb"
    page      INTEGER,                     -- printed page in the dictionary
    notes     TEXT,                        -- free notes (etymology, cross-refs)
    order_n   INTEGER NOT NULL DEFAULT 0   -- ordering of entries
);

CREATE TABLE IF NOT EXISTS dict_forms (
    id        INTEGER PRIMARY KEY,
    entry_id  INTEGER NOT NULL REFERENCES dict_entries(id),
    form      TEXT    NOT NULL,            -- the related word/form
    translit  TEXT,                        -- Latin transliteration, e.g. mig̱ar
    gloss_he  TEXT,                        -- form's meaning in Hebrew
    gloss_en  TEXT,                        -- form's meaning in English
    pos       TEXT,                        -- part of speech for this form
    order_n   INTEGER NOT NULL DEFAULT 0   -- 0 = the head-lemma itself
);

CREATE TABLE IF NOT EXISTS dict_citations (
    id         INTEGER PRIMARY KEY,
    form_id    INTEGER NOT NULL REFERENCES dict_forms(id),
    quote      TEXT,                       -- the cited text
    source_ref TEXT,                       -- the reference, e.g. "במ כד 24"
    order_n    INTEGER NOT NULL DEFAULT 0  -- ordering of citations within a form
);

CREATE INDEX IF NOT EXISTS idx_dict_entries_lemma  ON dict_entries(lemma);
CREATE INDEX IF NOT EXISTS idx_dict_entries_root   ON dict_entries(root);
CREATE INDEX IF NOT EXISTS idx_dict_forms_entry    ON dict_forms(entry_id);
CREATE INDEX IF NOT EXISTS idx_dict_forms_form     ON dict_forms(form);
CREATE INDEX IF NOT EXISTS idx_dict_citations_form ON dict_citations(form_id);
"""


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.commit()
    created = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'dict_%' "
        "ORDER BY name")]
    print("Dictionary tables present:", created)
    for t in created:
        cols = [c[1] for c in conn.execute(f"PRAGMA table_info({t})")]
        print(f"  {t}: {', '.join(cols)}")
    conn.close()


if __name__ == '__main__':
    main()
