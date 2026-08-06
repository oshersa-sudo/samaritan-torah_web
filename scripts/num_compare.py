# -*- coding: utf-8 -*-
import os
from book_compare import run_comparison

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRANSCRIPT_DIR = r'C:\Users\osher\AppData\Local\Temp\claude\C--Users-osher-Documents-torah\3b9a744a-b8e2-4630-b8a2-116404443172\scratchpad\num_transcripts'
PAGE_ORDER = [
    'pages_01-04', 'pages_05-08', 'pages_09-12', 'pages_13-16', 'pages_17-20',
    'pages_21-24', 'pages_25-28', 'pages_29-32', 'pages_33-36', 'pages_37-40',
    'pages_41-44', 'pages_45-48', 'pages_49-52', 'pages_53-54',
]

if __name__ == '__main__':
    run_comparison(
        book_id=4,
        book_name_he='ספר במדבר סיני',
        source_pdf='CamScanner 06.08.2026 15.16.pdf',
        transcript_dir=TRANSCRIPT_DIR,
        page_order=PAGE_ORDER,
        out_xlsx=os.path.join(_ROOT, 'data', 'numbers_source_comparison.xlsx'),
    )
