# -*- coding: utf-8 -*-
"""Headless render check for the root-search display fixes.

Drives the real data layer (search_verses / get_root_occurrences /
get_word_occurrences) and the real _mark_query + markup labels for all four
search modes, forcing texture_update so any markup/render error surfaces here
instead of in the running app. Run:  py -3 scripts/_repro.py
"""
import os, sys, io
os.environ['KIVY_GL_BACKEND'] = 'mock'
os.environ['KIVY_NO_ARGS'] = '1'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from kivy.core.text import LabelBase
F = lambda n: os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', n)
LabelBase.register(name='Hebrew',   fn_regular=F('SBL_Hbrw.ttf'))
LabelBase.register(name='Translit', fn_regular=F('CharisSIL-Regular.ttf'))

from kivy.uix.label import Label
from kivy.metrics import sp, dp
from app.services.database import (search_verses, get_root_occurrences,
                                   get_word_occurrences, root_from_index)
from app.services.hebrew_root import normalize
from app.screens.search import _mark_query, _clean_pron
from app.services.rtl import rtl


def render(text, **kw):
    kw.setdefault('markup', True)
    lbl = Label(text=text, **kw)
    lbl.texture_update()      # raises on bad markup
    return lbl


def build_results(query, exact=False, root=False, aramaic=False, root_letters=None):
    rows = search_verses(query, exact=exact, root=root, aramaic=aramaic,
                         root_letters=root_letters)
    occ_map, searched_root = {}, ''
    if not aramaic and rows:
        if root:
            searched_root = normalize(root_letters) if root_letters else normalize(root_from_index(query) or '')
            occ_map = get_root_occurrences(searched_root, [(r['id'], r['text']) for r in rows])
            rows = [r for r in rows if r['id'] in occ_map]
            rows = sorted(rows, key=lambda r: occ_map.get(r['id'], {}).get('order', 1 << 30))
        else:
            occ_map = get_word_occurrences(query, [r['id'] for r in rows])

    n_hl = 0
    seen_headers = []
    for row in rows:
        info = occ_map.get(row['id'])
        if root and info:
            sr = info.get('subroot') or ''
            if sr and sr != searched_root and sr not in seen_headers:
                render('[u]' + rtl(sr) + '[/u]', font_name='Hebrew',
                       font_size=sp(27), bold=True)
                seen_headers.append(sr)
        mwords = info['words'] if (root and info and not aramaic) else None
        marked = _mark_query(row['text'], query, exact, root, root_letters,
                             match_words=mwords)
        if 'cc0000' in marked:
            n_hl += 1
        render(marked, font_name='Hebrew', font_size=sp(19))
        occs = info['occ'] if info else None
        if occs:
            spans = []
            for pron, binyan, form in occs:
                cp = _clean_pron(pron)
                if not cp:
                    continue
                span = '[color=337373]‹ %s ›[/color]' % cp
                extra = ' '.join(x for x in (binyan, form) if x)
                if extra:
                    span += ' [font=Hebrew][color=8a8a8a]%s[/color][/font]' % rtl(extra)
                spans.append(span)
            if spans:
                render('    '.join(spans), font_name='Translit', font_size=sp(20))
    return rows, occ_map, searched_root, n_hl


def main():
    print('=== root search: אבי ===')
    rows, occ_map, sr, n_hl = build_results('אבי', root=True, root_letters='אבי')
    print('  rows=%d  highlighted=%d  searched_root=%s' % (len(rows), n_hl, sr))
    # show order: order id, subroot, first matched word, first occ
    for r in rows[:12]:
        info = occ_map.get(r['id']) or {}
        occ = info.get('occ') or []
        print('   ord=%-6s sub=%-6s words=%s  occ0=%s' % (
            info.get('order'), info.get('subroot') or '-',
            info.get('words'), occ[0] if occ else None))

    print('=== near search: אבה ===')
    rows, _, _, n_hl = build_results('אבה', root=False)
    print('  rows=%d  highlighted=%d' % (len(rows), n_hl))

    print('=== exact search: ויאמר ===')
    rows, _, _, n_hl = build_results('ויאמר', exact=True)
    print('  rows=%d  highlighted=%d' % (len(rows), n_hl))

    print('=== aramaic root search: אבי ===')
    rows, _, _, n_hl = build_results('אבי', root=True, aramaic=True, root_letters='אבי')
    print('  rows=%d  highlighted=%d' % (len(rows), n_hl))

    print('ALL MODES RENDERED OK')


if __name__ == '__main__':
    main()
