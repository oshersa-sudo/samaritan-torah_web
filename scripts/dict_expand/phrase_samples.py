# -*- coding: utf-8 -*-
"""Show candidate Aramaic collocations next to the Hebrew that Memar Marqe's own
translation puts opposite them — the material for deciding whether a phrase
deserves its own dictionary entry or is just two words standing next to each other.

Run:  py -3 scripts/dict_expand/phrase_samples.py
"""
import os
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))
import morph  # noqa: E402

DB = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'torah.db')

# A deliberate spread: formulaic titles, real idioms, and sequences that are
# plainly not lexical units — so the decision is made on a fair sample.
PHRASES = [
    ('נביה רבה משה', 'כינוי קבוע'), ('רבה משה', 'כינוי קבוע'),
    ('לית אלה אלא אחד', 'נוסח אמונה'), ('אני אני הוא', 'נוסח'),
    ('הכ משה ומן מדמי למשה', 'מטבע רטורי'), ('כמה דאמר', 'נוסחת ציטוט'),
    ('עד לעלם', 'ביטוי זמן'), ('עד מותר', 'ביטוי'),
    ('מרן דרחמיה', 'כינוי לאל'), ('על קשטה', 'ביטוי'),
    ('ארע מצרים', 'צירוף שמי'), ('כל אלין', 'צירוף חופשי'),
    ('לא הוה', 'צירוף חופשי'), ('אמר לה', 'צירוף חופשי'),
]


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    secs = conn.execute("SELECT book, section, aramaic, hebrew FROM tm_sections "
                        "WHERE TRIM(COALESCE(hebrew,''))<>''").fetchall()
    # index each passage by its normalised token stream, so a phrase can be found
    # regardless of final-letter spelling
    idx = [(r, ' ' + ' '.join(morph.norm(w) for w in
                              re.findall(r'[א-ת]{2,}', r['aramaic'])) + ' ') for r in secs]

    for ph, kind in PHRASES:
        key = ' ' + ' '.join(morph.norm(w) for w in ph.split()) + ' '
        hits = [(r, s) for r, s in idx if key in s]
        print(f"\n{'─'*74}\n«{ph}»   [{kind}]   — {len(hits)} פסקאות במרקה")
        if not hits:
            continue
        r = hits[0][0]
        m = re.search(re.escape(ph.split()[0]), r['aramaic'])
        pos = m.start() if m else 0
        print(f"  מרקה {r['book']}:{r['section']}")
        print(f"  ארמית : …{r['aramaic'][max(0,pos-40):pos+120].strip()}…")
        print(f"  עברית : {re.sub(chr(10),' ',r['hebrew'])[:230]}…")
    conn.close()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
