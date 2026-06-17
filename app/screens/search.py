from kivy.app import App
from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.checkbox import CheckBox
from kivy.uix.scrollview import ScrollView
from kivy.uix.gridlayout import GridLayout
from kivy.uix.widget import Widget
from kivy.metrics import sp, dp
from kivy.clock import Clock
import re
from app.services.database import (search_verses, get_samaritan_location,
                                   get_root_occurrences, get_word_occurrences,
                                   wildword_is, get_verse_dictionary,
                                   lookup_tal_dictionary)
from app.services.rtl import rtl
from app.widgets import HoverButton

FONT    = 'Hebrew'
C_DARK  = (0.08, 0.08, 0.08, 1)
C_BLUE  = (0.18, 0.38, 0.72, 1)
C_SAM   = (0.55, 0.30, 0.10, 1)   # Samaritan-division path colour
C_MUTED = (0.45, 0.45, 0.55, 1)
C_WHITE = (1, 1, 1, 1)
C_TRANSLIT = (0.20, 0.45, 0.45, 1)  # Latin transliteration shown under a result
HL      = 'cc0000'                # highlight colour for matched words

_HEB_ONLY = re.compile('[^א-ת]')


def _heb(s):
    return _HEB_ONLY.sub('', s or '')


def _clean_pron(p):
    """Tidy a transliteration for display: drop the source's Hebrew/Arabic
    manuscript markers (e.g. '(ר)', '(ר+ש)') that aren't part of the Latin form."""
    p = re.sub(r'\([^)]*[א-ת؀-ۿ][^)]*\)', '', p or '')
    p = re.sub(r'[א-ת؀-ۿ]', '', p)
    return re.sub(r'\s+', ' ', p).strip()


# ── meaning enrichment for a search result (same data as the web edition) ──────
_FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}


def _fold(s):
    """Hebrew letters only, final forms folded — to match a word against the
    verse_dictionary entries regardless of final-letter spelling."""
    return ''.join(_FIN.get(c, c) for c in (s or '') if ('א' <= c <= 'ת') or c in _FIN)


def _aramaic_for(pairs, cands, aramaic):
    """The Aramaic translation of the matched word, from the verse's word-pairs."""
    cf = [_fold(c) for c in cands if _fold(c)]
    for a, h in pairs:
        side = _fold(a if aramaic else h)
        if side and side in cf:
            return a
    for a, h in pairs:
        side = _fold(a if aramaic else h)
        if side and any(c in side or side in c for c in cf):
            return a
    return ''


_TAL_GLOSS = {}


def _tal_gloss(aramaic_word):
    """Gloss of an Aramaic word from Tal's dictionary (English — Tal has no Hebrew
    gloss). Cached; the dictionary is static."""
    if not aramaic_word:
        return ''
    if aramaic_word in _TAL_GLOSS:
        return _TAL_GLOSS[aramaic_word]
    g = ''
    try:
        res = lookup_tal_dictionary(aramaic_word, limit=1)
        if res:
            r = res[0]
            g = (r['gloss_en'] or '').strip() or (r['notes'] or '').strip()[:90]
    except Exception:
        g = ''
    _TAL_GLOSS[aramaic_word] = g
    return g


class RTLTextInput(TextInput):
    """Single-line Hebrew search box.

    Kivy's SDL2 text provider has no bidi support, so a normal TextInput shows
    typed Hebrew left-to-right (reversed). This subclass keeps the text in
    logical order internally (``query``) while always *displaying* it in visual
    right-to-left order, so the box reads correctly as the user types.
    """

    def __init__(self, on_change=None, **kwargs):
        self._logical = ''
        self._on_change = on_change
        super().__init__(**kwargs)

    def insert_text(self, substring, from_undo=False):
        if from_undo:
            return
        self._logical += substring
        self._show()

    def do_backspace(self, from_undo=False, mode='bkspc'):
        if self._logical:
            self._logical = self._logical[:-1]
            self._show()

    def _show(self):
        # display the reordered (visual) text; park the caret at the left edge,
        # where the next typed letter visually appears
        self.text = rtl(self._logical) if self._logical else ''
        self.cursor = (0, 0)
        if self._on_change:
            self._on_change(self._logical)

    @property
    def query(self):
        return self._logical.strip()

    def clear(self):
        self._logical = ''
        self._show()


def _mark_query(verse_text, query, exact, root=False, root_letters=None,
                match_words=None, aramaic=False):
    """RTL-render the verse text, highlighting whole words that match the search.

    Words are reversed for visual right-to-left order and each is processed
    independently so the colour markup survives (Kivy has no bidi). For a root
    search the words to highlight are given explicitly (match_words — the exact
    words the index occurrence was matched to); otherwise a word matches when it
    equals a query term (exact) or contains one (near)."""
    if root and match_words is not None:
        mw = {_heb(w) for w in match_words if _heb(w)}

        def is_match(word):
            w = _heb(word)
            return bool(w) and w in mw
    elif root:
        from app.services.hebrew_root import extract_root, to_skeleton, word_matches_root
        rl = to_skeleton(root_letters) if root_letters else extract_root(query)

        def is_match(word):
            return bool(rl) and word_matches_root(word, rl)
    elif not exact and not aramaic and ('?' in query or '+' in query):
        # enhanced plain search: '+' joins AND terms; '?' is a one-letter wildcard
        # matching a WHOLE word. Highlight every word satisfying any term.
        parts = [t.strip() for t in query.split('+') if t.strip()]
        wild = [p for p in (''.join(c for c in t if ('א' <= c <= 'ת') or c == '?')
                            for t in parts if '?' in t) if p]
        lits = [x for x in (_heb(w) for t in parts if '?' not in t for w in t.split()) if x]

        def is_match(word):
            w = _heb(word)
            if not w:
                return False
            return any(wildword_is(w, p) for p in wild) or any(t in w for t in lits)
    else:
        terms = [t for t in (_heb(w) for w in query.split()) if t]

        def is_match(word):
            w = _heb(word)
            if not w or not terms:
                return False
            return (w in terms) if exact else any(t in w for t in terms)

    out = []
    for w in reversed(verse_text.split()):
        v = rtl(w)
        out.append(f'[color={HL}][b]{v}[/b][/color]' if is_match(w) else v)
    return ' '.join(out)


class SearchScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._exact = False
        self._root = False
        self._aramaic_search = False
        self._root_auto = ''     # last auto-filled root (heuristic/lexicon)
        self._lex_ev = None      # debounced lexicon-lookup Clock event
        self._result_font_offset = 0   # +/- buttons enlarge the result text
        self._build()

    def bump_result_font(self, delta):
        """Enlarge / shrink the search-result verse text (the +/- buttons)."""
        self._result_font_offset = max(-6, min(self._result_font_offset + delta, 40))
        if self.input.query:
            self._do_search()

    def _build(self):
        layout = BoxLayout(orientation='vertical', spacing=dp(6), padding=dp(10))

        bar = BoxLayout(size_hint_y=None, height=dp(50), spacing=dp(6))
        self.input = RTLTextInput(
            on_change=self._on_query_change,
            hint_text=rtl('חפש מילה'),
            multiline=False,
            font_name=FONT,
            font_size=sp(18),
            write_tab=False,
            foreground_color=C_DARK,
            hint_text_color=C_MUTED,
            halign='right',
        )
        self.input.bind(on_text_validate=self._do_search)

        btn = HoverButton(
            text=rtl('חפש'),
            size_hint_x=None, width=dp(80),
            font_name=FONT, font_size=sp(18),
            background_color=C_BLUE, background_normal='',
            color=C_WHITE, halign='center',
        )
        btn.bind(on_press=self._do_search)
        bar.add_widget(self.input)
        bar.add_widget(btn)
        layout.add_widget(bar)

        # search-option checkboxes (all default off)
        exact_row, self.exact_cb = self._make_flag('חיפוש מדויק', self._on_exact_toggle)
        root_row,  self.root_cb  = self._make_flag('לפי שורש המילה', self._on_root_toggle)
        aram_row,  self.aram_cb  = self._make_flag('חפש בתרגום הארמי', self._on_aram_toggle)
        layout.add_widget(exact_row)
        layout.add_widget(root_row)
        layout.add_widget(aram_row)

        # editable root box — appears only while "לפי שורש המילה" is on
        self.root_box_row = BoxLayout(size_hint_y=None, height=0, spacing=dp(6), opacity=0)
        self.root_box = RTLTextInput(
            hint_text=rtl('שורש'), multiline=False, font_name=FONT, font_size=sp(18),
            write_tab=False, foreground_color=C_DARK, hint_text_color=C_MUTED, halign='right',
        )
        root_box_lbl = Label(
            text=rtl('שורש לחיפוש:'), font_name=FONT, font_size=sp(15), color=C_BLUE,
            size_hint_x=None, width=dp(110), halign='right', valign='middle')
        root_box_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        self.root_box_row.add_widget(self.root_box)
        self.root_box_row.add_widget(root_box_lbl)
        self.root_box_row.disabled = True
        layout.add_widget(self.root_box_row)

        self.status = Label(
            text='', size_hint_y=None, height=dp(30),
            font_name=FONT, font_size=sp(15),
            color=C_BLUE, halign='right',
        )
        self.status.bind(width=lambda i, w: setattr(i, 'text_size', (w, None)))
        layout.add_widget(self.status)

        self.scroll = ScrollView(
            do_scroll_x=False,
            bar_width=dp(10),
            bar_color=(0.18, 0.38, 0.72, 0.85),
            bar_inactive_color=(0.18, 0.38, 0.72, 0.35),
            scroll_type=['bars', 'content'],
        )
        self.results = GridLayout(cols=1, spacing=dp(4), size_hint_y=None,
                                  padding=(0, dp(4)))
        self.results.bind(minimum_height=self.results.setter('height'))
        self.scroll.add_widget(self.results)
        layout.add_widget(self.scroll)

        self.add_widget(layout)

    def _make_flag(self, text, callback):
        row = BoxLayout(size_hint_y=None, height=dp(34), spacing=dp(6))
        row.add_widget(Widget())  # spacer pushes the checkbox to the right
        lbl = Label(text=rtl(text), font_name=FONT, font_size=sp(16), color=C_BLUE,
                    size_hint_x=None, width=dp(190), halign='right', valign='middle')
        lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        cb = CheckBox(size_hint_x=None, width=dp(36), color=C_BLUE)
        cb.bind(active=callback)
        row.add_widget(lbl)
        row.add_widget(cb)
        return row, cb

    def _on_exact_toggle(self, cb, value):
        self._exact = value
        if value and self.root_cb.active:   # exact and root are mutually exclusive
            self.root_cb.active = False

    def _on_root_toggle(self, cb, value):
        self._root = value
        if value and self.exact_cb.active:   # exact and root are mutually exclusive
            self.exact_cb.active = False
        self._set_root_box_visible(value)
        if value:
            self._fill_root_box(self.input.query)

    def _on_aram_toggle(self, cb, value):
        self._aramaic_search = value

    def _set_root_box_visible(self, show):
        self.root_box_row.height = dp(44) if show else 0
        self.root_box_row.opacity = 1 if show else 0
        self.root_box_row.disabled = not show

    def _fill_root_box(self, query):
        """Fill the box with the root extracted from the root index."""
        from app.services.database import root_from_index
        r = root_from_index(query) if len(query.split()) == 1 else ''
        self._root_auto = r
        if r != self.root_box._logical:
            self.root_box._logical = r
            self.root_box._show()

    def _on_query_change(self, logical):
        # keep the index-extracted root in sync while the root flag is on
        if getattr(self, '_root', False) and hasattr(self, 'root_box'):
            self._fill_root_box(logical)

    def _do_search(self, *_):
        query = self.input.query
        if not query:
            return
        self.results.clear_widgets()
        self.scroll.scroll_y = 1
        aramaic = self._aramaic_search
        root    = self._root and len(query.split()) == 1   # root: single word only
        root_letters = self.root_box.query if root else None
        try:
            rows = search_verses(query, exact=self._exact, root=root, aramaic=aramaic,
                                 root_letters=root_letters)
        except Exception as e:
            self.status.text = rtl(f'שגיאה: {e}')
            return

        src  = ' בתרגום הארמי' if aramaic else ''
        note = ' (חיפוש לפי שורש זמין למילה אחת בלבד)' if self._root and not root else ''

        # occurrences (pron + binyan/form) keyed by verse id, from the index
        occ_map = {}
        searched_root = ''
        if not aramaic and rows:
            from app.services.hebrew_root import normalize
            from app.services.database import root_from_index
            if root:
                searched_root = normalize(root_letters) if root_letters else normalize(root_from_index(query) or '')
                occ_map = get_root_occurrences(searched_root, [(r['id'], r['text']) for r in rows])
                # drop verses whose index location is an OCR error (the form isn't
                # actually there) — keep only verses with a confirmed occurrence,
                # in the index's own order (main root first, sub-lemmas after)
                rows = [r for r in rows if r['id'] in occ_map]
                rows = sorted(rows, key=lambda r: occ_map.get(r['id'], {}).get('order', 1 << 30))
            else:
                occ_map = get_word_occurrences(query, [r['id'] for r in rows])

        self.status.text = rtl(f'נמצאו {len(rows)} תוצאות{src}{note}')

        # per-verse Aramaic word-pairs (batched once) for the meaning line; the
        # Tal gloss and the online Hebrew meaning are filled in a background thread.
        vdict = get_verse_dictionary([r['id'] for r in rows]) if rows else {}
        meaning_pending = []          # (aramaic_word, hebrew_word, label)

        current_sr = None
        for row in rows:
            info = occ_map.get(row['id'])
            # entering a sub-lemma group -> show its root as a large underlined header
            if root and info:
                sr = info.get('subroot') or ''
                if sr and sr != searched_root and sr != current_sr:
                    hdr = Label(text='[u]' + rtl(sr) + '[/u]', markup=True,
                                font_name=FONT, font_size=sp(27), bold=True, color=C_DARK,
                                size_hint_y=None, height=dp(42), halign='right', valign='middle')
                    hdr.bind(size=lambda i, s: setattr(i, 'text_size', s))
                    self.results.add_widget(hdr)
                    current_sr = sr

            # Jewish-division path (top line)
            jloc = (f'←  יהודית   {row["book_name"]}  ›  '
                    f'{row["portion_name"] or ""}  ›  '
                    f'פרק {row["chapter_num"]}  פסוק {row["number"]}')
            self.results.add_widget(self._path_btn(
                jloc, C_BLUE, lambda _, r=row: self._go_to_jewish(r)))

            # Samaritan-division path (line below)
            sam = get_samaritan_location(row['id'])
            if sam and sam['sam_portion_id']:
                sloc = (f'→  שומרונית   {row["book_name"]}  ›  '
                        f'{sam["sam_portion_name"]}  ›  '
                        f'פרק שומרוני {sam["sam_ch_num"]}  פסוק {sam["number"]}')
                self.results.add_widget(self._path_btn(
                    sloc, C_SAM, lambda _, r=row, s=sam: self._go_to_samaritan(r, s)))

            # verse (Aramaic translation when that flag is on) with matches highlighted
            display_text = (row['sam_aramaic'] if aramaic else row['text']) or ''
            mwords = info['words'] if (root and info and not aramaic) else None
            marked = _mark_query(display_text, query, self._exact, root, root_letters,
                                 match_words=mwords, aramaic=aramaic)
            verse_lbl = Label(
                text=marked, font_name=FONT, font_size=sp(19) + self._result_font_offset,
                size_hint_y=None, height=dp(46),
                halign='right', color=C_DARK,
                markup=True,
            )
            verse_lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w - dp(8), None)))
            verse_lbl.bind(texture_size=lambda i, ts: setattr(i, 'height',
                                                               max(ts[1] + dp(8), dp(36))))
            self.results.add_widget(verse_lbl)

            # transliteration of the occurrence + its binyan/form, from the index
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
                    occ_lbl = Label(
                        text='    '.join(spans), markup=True,
                        font_name='Translit', font_size=sp(20) + self._result_font_offset,
                        size_hint_y=None, height=dp(30),
                        halign='right', valign='middle',
                    )
                    occ_lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w - dp(8), None)))
                    occ_lbl.bind(texture_size=lambda i, ts: setattr(i, 'height',
                                                                    max(ts[1] + dp(8), dp(28))))
                    self.results.add_widget(occ_lbl)

            # meaning line: Aramaic translation + Tal gloss + online Hebrew meaning.
            cand_words = (info['words'] if (root and info and info.get('words')) else None) or [query]
            aramaic_w  = _aramaic_for(vdict.get(row['id'], []), cand_words, aramaic)
            heword     = cand_words[0] if cand_words else query
            mean_lbl = Label(
                text=('[color=1a3873]%s[/color]' % rtl('תרגום ארמי: ' + aramaic_w)) if aramaic_w else '',
                markup=True, font_name=FONT, font_size=sp(15) + self._result_font_offset,
                size_hint_y=None, height=dp(24) if aramaic_w else 0,
                halign='right', valign='middle', color=C_DARK)
            mean_lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w - dp(8), None)))
            mean_lbl.bind(texture_size=lambda i, ts: setattr(
                i, 'height', (ts[1] + dp(6)) if i.text.strip() else 0))
            self.results.add_widget(mean_lbl)
            meaning_pending.append((aramaic_w, heword, mean_lbl))

        if meaning_pending:
            self._fetch_meanings(meaning_pending)

    def _fetch_meanings(self, pending):
        """In one background thread: the Tal gloss for each Aramaic word and the
        online Hebrew-dictionary meaning for each searched word, then fill the
        labels on the UI thread."""
        import threading
        from app.services import hebrew_dict
        hewords = list({hw for _, hw, _ in pending if hw})

        def work():
            try:
                he = hebrew_dict.lookup_many(hewords)
            except Exception:
                he = {}
            tal = {}
            for aw, _hw, _lbl in pending:
                if aw and aw not in tal:
                    tal[aw] = _tal_gloss(aw)
            Clock.schedule_once(lambda dt: self._fill_meanings(pending, tal, he), 0)

        threading.Thread(target=work, daemon=True).start()

    def _fill_meanings(self, pending, tal, he):
        for aw, hw, lbl in pending:
            segs = []
            if aw:
                segs.append('[color=1a3873]%s[/color]' % rtl('תרגום ארמי: ' + aw))
                g = tal.get(aw, '')
                if g:
                    segs.append('[color=666666]%s %s[/color]' % (rtl('מילון טל:'), g))
            r = he.get(hw)
            if r and r[0]:
                he_txt = r[0].strip()
                if len(he_txt) > 110:                 # keep it short (1–2 lines)
                    cut = he_txt[:110]
                    he_txt = cut[:cut.rfind(' ')] + ' …' if ' ' in cut else cut + '…'
                segs.append('[color=4a6a4a]%s[/color]' % rtl('פירוש עברי: ' + he_txt))
            if segs:
                # each source on its own line: every line is single-direction, so it
                # wraps cleanly (mixing RTL Hebrew and LTR English on one line does not).
                lbl.text = '\n'.join(segs)
            else:
                lbl.text = ''
                lbl.height = 0

    def _path_btn(self, text, color, callback):
        b = Button(
            text=rtl(text), font_name=FONT, font_size=sp(14.5),
            size_hint_y=None, height=dp(27),
            halign='right', valign='middle', color=color,
            background_color=(0, 0, 0, 0), background_normal='',
        )
        b.bind(size=lambda i, s: setattr(i, 'text_size', (s[0], s[1])))
        b.bind(on_press=callback)
        return b

    def _go_to_jewish(self, row):
        app = App.get_running_app()
        app.browse_screen.show_chapter_for_search(
            row['book_id'], row['book_name'], row['portion_id'],
            row['portion_name'] or '', row['chapter_id'], row['chapter_num'],
            row['id'])
        app.sm.current = 'browse'

    def _go_to_samaritan(self, row, sam):
        app = App.get_running_app()
        app.browse_screen.show_sam_chapter_for_search(
            row['book_id'], row['book_name'], sam['sam_portion_id'],
            sam['sam_portion_name'], sam['sam_ch_id'], sam['sam_ch_num'],
            row['id'])
        app.sm.current = 'browse'
