# -*- coding: utf-8 -*-
"""
Apply the punctuation-merge proposal to verses.text for במדבר — same
treatment as שמות/בראשית: source commas -> our colon convention, source
periods -> our period convention, word-aligned. Punctuation only — no
wording, expansion, or chapter-division changes.

Usage:
  py -3 scripts/apply_num_punctuation.py            # dry run
  py -3 scripts/apply_num_punctuation.py --apply
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from book_compare import apply_punctuation
from num_compare import TRANSCRIPT_DIR, PAGE_ORDER

APPLY = '--apply' in sys.argv

if __name__ == '__main__':
    apply_punctuation(book_id=4, transcript_dir=TRANSCRIPT_DIR, page_order=PAGE_ORDER, apply=APPLY)
