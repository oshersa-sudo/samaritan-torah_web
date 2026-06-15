"""
1. Add old_text column and copy text into it (backup).
2. For each verse where sam_hebrew differs from text (ignoring end-of-verse markers),
   update text = sam_hebrew + original end-of-verse suffix.
End-of-verse marker pattern: trailing ' ׃--'
"""
import sqlite3, sys, re, os
sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db')

SUFFIX_RE = re.compile(r'(\s*׃--\s*)$')

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

# 1. Add old_text column if missing
existing = [r[1] for r in conn.execute('PRAGMA table_info(verses)').fetchall()]
if 'old_text' not in existing:
    conn.execute('ALTER TABLE verses ADD COLUMN old_text TEXT')
    print('Added column: old_text')

# 2. Backup text -> old_text (only where old_text is not yet set)
conn.execute('UPDATE verses SET old_text = text WHERE old_text IS NULL')
conn.commit()
print('Backup done.')

# 3. Compare and update
rows = conn.execute(
    'SELECT id, text, sam_hebrew FROM verses '
    'WHERE sam_hebrew IS NOT NULL AND sam_hebrew != ""'
).fetchall()

updated = 0
for r in rows:
    original = r['text'] or ''
    sam = (r['sam_hebrew'] or '').strip()

    # Extract suffix from original text
    m = SUFFIX_RE.search(original)
    suffix = m.group(1) if m else ''
    body = original[:m.start()] if m else original.rstrip()

    if body.strip() == sam:
        continue  # no difference

    new_text = sam + suffix
    conn.execute('UPDATE verses SET text = ? WHERE id = ?', (new_text, r['id']))
    updated += 1

conn.commit()
conn.close()
print(f'Done. Updated {updated} verses.')
