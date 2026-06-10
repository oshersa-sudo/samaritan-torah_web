import os
import re
import difflib
from kivy.app import App
from kivy.uix.screenmanager import Screen
from kivy.uix.widget import Widget
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.gridlayout import GridLayout
from kivy.graphics import Color, Rectangle, RoundedRectangle, Line
from kivy.metrics import sp, dp
from app.services.database import (get_books, get_portions, get_chapters, get_verses,
                                    get_sam_chapters, get_sam_chapters_in_portion,
                                    count_sam_chapters_in_portion,
                                    get_verses_by_sam_ch)
from app.services.rtl import rtl, rtl_lines
from app.widgets import HoverButton, RoundedHoverButton, IconHoverButton

_ICONS = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'icons')

C_NAVY   = (0.10, 0.22, 0.45, 1)
C_ACCENT = (0.18, 0.38, 0.72, 1)
C_WHITE  = (1, 1, 1, 1)
C_DARK   = (0.08, 0.08, 0.08, 1)
C_MUTED  = (0.45, 0.45, 0.55, 1)
C_BTN    = (0.92, 0.93, 0.98, 1)
FONT     = 'Hebrew'

BG_IMAGE = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'images', 'background.jpg')

_HEB_RE    = re.compile(u'([א-ת]+)')
_NIKUD_RE  = re.compile(u'[֑-ׇ]')


_SOF_PASUQ = u'׃'
_MID_DOT   = u'·'


def _add_word_dots(text):
    """Add middle dot between words; skip before sof-pasuq (׃) or --."""
    result = []
    for line in text.split('\n'):
        tokens = line.split(' ')
        new_tokens = []
        for i, tok in enumerate(tokens):
            new_tokens.append(tok)
            if i < len(tokens) - 1:
                nxt = tokens[i + 1]
                if (tok and not tok.isdigit()
                        and nxt
                        and not nxt.startswith(_SOF_PASUQ)
                        and not nxt.startswith('--')):
                    new_tokens.append(_MID_DOT)
        result.append(' '.join(new_tokens))
    return '\n'.join(result)


def _sam_markup(text):
    """Wrap Hebrew letters with Samaritan font; numbers/punctuation keep Hebrew font."""
    parts = _HEB_RE.split(text)
    out = []
    for p in parts:
        if not p:
            continue
        if _HEB_RE.fullmatch(p):
            out.append(u'[font=Samaritan]' + p + u'[/font]')
        else:
            out.append(u'[font=Hebrew]' + p + u'[/font]')
    return ''.join(out)


def _verse_text(raw_lines):
    """Return (text, markup_bool, ltr_bool) based on current modes."""
    from kivy.utils import platform
    app = App.get_running_app()
    use_sam = getattr(app, '_font_mode', 'Hebrew') == 'Samaritan'
    if platform == 'android':
        # Android renders RTL natively — logical order gives correct line wrapping
        if use_sam:
            return _sam_markup(_add_word_dots(raw_lines)), True, False
        return raw_lines, False, False
    visual = rtl_lines(raw_lines)
    if use_sam:
        return _sam_markup(_add_word_dots(visual)), True, False
    return visual, False, False


def _english_verse_text(verses):
    """Build LTR English text from verse list. Returns (text, markup, ltr)."""
    lines = []
    for v in verses:
        eng = v['english'] if v['english'] else f'[verse {v["number"]}]'
        lines.append(f'{v["number"]}  {eng}')
    return '\n'.join(lines), False, True


def _add_bg(widget):
    if not os.path.exists(BG_IMAGE):
        return
    with widget.canvas.before:
        Color(1, 1, 1, 1)
        _white = Rectangle(pos=widget.pos, size=widget.size)
        Color(1, 1, 1, 0.22)
        _img = Rectangle(source=BG_IMAGE, pos=widget.pos, size=widget.size)
    widget.bind(pos=lambda i, v: (setattr(_white, 'pos', v), setattr(_img, 'pos', v)))
    widget.bind(size=lambda i, v: (setattr(_white, 'size', v), setattr(_img, 'size', v)))


def _rtl_btn(text, callback, bg=(0.85, 0.85, 0.85, 1), color=C_DARK,
             height=None, font_size=None):
    h  = height    or dp(52)
    fs = font_size or sp(18)
    b = HoverButton(
        text=rtl(text),
        font_name=FONT,
        font_size=fs,
        size_hint_y=None,
        height=h,
        halign='right',
        valign='middle',
        background_color=bg,
        background_normal='',
        color=color,
    )
    b.bind(size=lambda i, s: setattr(i, 'text_size', (s[0] - dp(16), s[1])))
    b.bind(on_press=callback)
    return b


def _rtl_lbl(text, font_size=None, color=C_DARK, height=None):
    fs  = font_size or sp(18)
    lbl = Label(
        text=rtl(text),
        font_name=FONT,
        font_size=fs,
        color=color,
        halign='right',
        valign='middle',
    )
    if height is not None:
        lbl.size_hint_y = None
        lbl.height = dp(height) if isinstance(height, (int, float)) else height
    lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w, None)))
    return lbl


class BrowseScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._state           = []
        self._current         = None
        self._portions        = []
        self._cur_pid         = None
        self._mode            = 'samaritan'
        self._nav_mode        = 'portion'
        self._ch_list         = []
        self._ch_idx          = 0
        self._ch_book_id      = None
        self._ch_book_name    = ''
        self._ch_portion_name = ''
        self._ch_portion_id   = None
        self._ch_mode         = 'standard'
        self._search_return   = False
        self._last_render     = None
        self._font_size_offset = 0
        self._compare_mode     = False
        self._build()

    def set_mode(self, mode):
        self._mode = mode
        self._show_books()

    # ── layout ────────────────────────────────────────────────────────────────

    def _build(self):
        root = BoxLayout(orientation='vertical')
        _add_bg(root)

        # clickable breadcrumb bar — right-aligned
        self._crumb_bar = BoxLayout(orientation='horizontal', size_hint_y=None,
                                     height=dp(36), padding=(dp(6), dp(2)))
        root.add_widget(self._crumb_bar)

        self.scroll = ScrollView(
            do_scroll_x=False,
            bar_width=dp(10),
            bar_color=(0.18, 0.38, 0.72, 0.85),
            bar_inactive_color=(0.18, 0.38, 0.72, 0.35),
            scroll_type=['bars', 'content'],
        )
        self.list_layout = GridLayout(cols=1, spacing=dp(3), size_hint_y=None,
                                      padding=(dp(6), dp(4)))
        self.list_layout.bind(minimum_height=self.list_layout.setter('height'))
        self.scroll.add_widget(self.list_layout)
        root.add_widget(self.scroll)

        # ── font-size bar (visible only on verse screens) ──
        self._size_bar = BoxLayout(size_hint_y=None, height=dp(44),
                                   spacing=dp(8), padding=(dp(6), dp(2)))
        minus_btn = RoundedHoverButton(
            text='−', font_size=sp(30), bold=True,
            size_hint_y=None, height=dp(40),
        )
        plus_btn = RoundedHoverButton(
            text='+', font_size=sp(30), bold=True,
            size_hint_y=None, height=dp(40),
        )
        minus_btn.bind(on_press=self._dec_font)
        plus_btn.bind(on_press=self._inc_font)
        self._size_bar.add_widget(Widget())
        self._size_bar.add_widget(minus_btn)
        self._size_bar.add_widget(plus_btn)
        self._size_bar.add_widget(Widget())
        self._size_bar.opacity  = 0
        self._size_bar.disabled = True
        root.add_widget(self._size_bar)

        bar = BoxLayout(size_hint_y=None, height=dp(50), spacing=dp(4),
                        padding=(dp(4), dp(2)))
        self.back_btn = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_arrow_back.png'),
            text=rtl('חזור'), font_name=FONT, font_size=sp(16),
            text_color=C_WHITE, bg_color=C_ACCENT,
            icon_size=dp(22), icon_side='right',
            orientation='horizontal', spacing=dp(4), padding=(dp(6), 0),
            size_hint_y=None, height=dp(46),
        )
        self.back_btn.bind(on_press=self._go_back)
        self.prev_btn = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_arrow_prev.png'),
            text=rtl('פרשה קודמת'), font_name=FONT, font_size=sp(13),
            text_color=C_WHITE, bg_color=C_NAVY,
            icon_size=dp(22), icon_side='right',
            orientation='horizontal', spacing=dp(4), padding=(dp(6), 0),
            size_hint_y=None, height=dp(46),
        )
        self.next_btn = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_arrow_next.png'),
            text=rtl('פרשה הבאה'), font_name=FONT, font_size=sp(13),
            text_color=C_WHITE, bg_color=C_NAVY,
            icon_size=dp(22), icon_side='left',
            orientation='horizontal', spacing=dp(4), padding=(dp(6), 0),
            size_hint_y=None, height=dp(46),
        )
        self.prev_btn.bind(on_press=self._on_prev)
        self.next_btn.bind(on_press=self._on_next)
        bar.add_widget(self.back_btn)
        bar.add_widget(self.next_btn)
        bar.add_widget(self.prev_btn)
        root.add_widget(bar)

        self.add_widget(root)
        self._show_books()

    def _clear(self):
        self.list_layout.clear_widgets()
        self.scroll.scroll_y = 1

    def _nav_visible(self, show):
        for b in (self.prev_btn, self.next_btn):
            b.disabled = not show
            b.opacity  = 1 if show else 0

    def _size_bar_visible(self, show):
        self._size_bar.opacity  = 1 if show else 0
        self._size_bar.disabled = not show
        app = App.get_running_app()
        if hasattr(app, 'compare_btn'):
            app.compare_btn.opacity  = 1 if show else 0
            app.compare_btn.disabled = not show

    def toggle_compare(self, active):
        self._compare_mode = active
        if self._last_render:
            self._last_render()

    def _build_compare_panel(self, title, text, markup, ltr, fsize):
        panel = BoxLayout(orientation='vertical', size_hint=(1, None),
                          padding=(dp(8), dp(8)), spacing=dp(4))
        with panel.canvas.before:
            Color(0.97, 0.97, 0.95, 1)
            _rr = RoundedRectangle(pos=panel.pos, size=panel.size, radius=[dp(12)])
            Color(*C_NAVY[:3], 0.55)
            _ln = Line(width=1.3,
                       rounded_rectangle=[panel.x, panel.y, panel.width, panel.height, dp(12)])
        def _sync_geom(inst, val):
            _rr.pos  = inst.pos;  _rr.size = inst.size
            _ln.rounded_rectangle = [inst.x, inst.y, inst.width, inst.height, dp(12)]
        panel.bind(pos=_sync_geom, size=_sync_geom)

        title_lbl = Label(
            text=rtl(title), font_name=FONT, font_size=sp(17),
            bold=True, color=C_NAVY,
            size_hint_y=None, height=dp(32),
            halign='center', valign='middle',
        )
        title_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        panel.add_widget(title_lbl)

        halign = 'left' if ltr else 'right'
        text_lbl = Label(
            text=text, font_name=FONT, font_size=fsize,
            color=C_DARK, halign=halign, valign='top',
            size_hint_y=None, markup=markup,
        )
        text_lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w - dp(8), None)))
        text_lbl.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(8)))
        panel.add_widget(text_lbl)

        def _upd(*_):
            panel.height = dp(32) + text_lbl.height + dp(20)
        text_lbl.bind(height=_upd)
        panel.height = dp(100)
        return panel

    @staticmethod
    def _diff_verse(verse_num, sam_raw, mas_raw, use_sam):
        """Return (sam_visual, mas_visual) with red markup on differing words."""
        RED   = u'[color=cc0000]'
        END   = u'[/color]'
        MAQAF = u'־'

        sam_words = sam_raw.split() if sam_raw else []
        mas_words = mas_raw.split() if mas_raw else []

        num_str = u'  ' + str(verse_num)

        # Missing verse on one side → empty line on that side
        if not sam_words:
            mv = u' '.join(rtl(w) for w in reversed(mas_words)) + num_str
            return (u'', mv)
        if not mas_words:
            sv = u' '.join(rtl(w) for w in reversed(sam_words)) + num_str
            return (sv, u'')

        # Tokenize: split each space-token further by maqaf for comparison
        def tokenize(words):
            tokens = []
            for w in words:
                atoms = [_NIKUD_RE.sub(u'', a) for a in w.split(MAQAF) if a]
                tokens.append((w, atoms or [_NIKUD_RE.sub(u'', w)]))
            return tokens

        sam_tok = tokenize(sam_words)
        mas_tok = tokenize(mas_words)

        # Flatten to atom lists and build atom→token index maps
        sam_atoms, sam_a2t = [], {}
        for ti, (_, atoms) in enumerate(sam_tok):
            for a in atoms:
                sam_a2t[len(sam_atoms)] = ti
                sam_atoms.append(a)

        mas_atoms, mas_a2t = [], {}
        for ti, (_, atoms) in enumerate(mas_tok):
            for a in atoms:
                mas_a2t[len(mas_atoms)] = ti
                mas_atoms.append(a)

        # Run diff on atoms
        sam_diff = [False] * len(sam_tok)
        mas_diff = [False] * len(mas_tok)
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(
                None, sam_atoms, mas_atoms, autojunk=False).get_opcodes():
            if tag != 'equal':
                for ai in range(i1, i2): sam_diff[sam_a2t[ai]] = True
                for aj in range(j1, j2): mas_diff[mas_a2t[aj]] = True

        def fmt(w, is_diff, for_sam):
            visual = rtl(w)
            if for_sam and use_sam:
                visual = _sam_markup(visual)
            return (RED + visual + END) if is_diff else visual

        sam_col = [fmt(w, d, True)  for (w, _), d in zip(sam_tok, sam_diff)]
        mas_col = [fmt(w, d, False) for (w, _), d in zip(mas_tok, mas_diff)]

        sv = u' '.join(reversed(sam_col)) + num_str
        mv = u' '.join(reversed(mas_col)) + num_str
        return sv, mv

    def _add_compare_panels(self, verses, fsize, use_eng):
        app      = App.get_running_app()
        use_sam  = getattr(app, '_font_mode', 'Hebrew') == 'Samaritan'

        if use_eng:
            sam_text, sam_mk, sam_ltr = _english_verse_text(verses)
            mas_parts = [u'{} {}'.format(v['number'], v['masoretic_text'])
                         for v in verses if v['masoretic_text']]
            mas_text = rtl_lines(u'\n'.join(mas_parts)) if mas_parts else rtl(u'אין נוסח מסורה')
            sam_mk_flag, mas_mk_flag = sam_mk, False
            sam_ltr_flag, mas_ltr_flag = sam_ltr, False
        else:
            sam_lines, mas_lines = [], []
            for v in verses:
                sv, mv = self._diff_verse(
                    v['number'], v['text'] or u'', v['masoretic_text'] or u'', use_sam)
                sam_lines.append(sv)
                mas_lines.append(mv)
            sam_text = u'\n'.join(sam_lines)
            mas_text = u'\n'.join(mas_lines)
            sam_mk_flag = mas_mk_flag = True
            sam_ltr_flag = mas_ltr_flag = False

        # Masoretic LEFT, Samaritan RIGHT
        mas_panel = self._build_compare_panel(u'נוסח מסורה',  mas_text, mas_mk_flag, mas_ltr_flag, fsize)
        sam_panel = self._build_compare_panel(u'נוסח שומרון', sam_text, sam_mk_flag, sam_ltr_flag, fsize)

        container = BoxLayout(orientation='horizontal', spacing=dp(8),
                              size_hint_y=None, height=dp(100),
                              padding=(dp(2), dp(4)))

        def _sync(*_):
            container.height = max(sam_panel.height, mas_panel.height) + dp(8)
        sam_panel.bind(height=_sync)
        mas_panel.bind(height=_sync)

        container.add_widget(mas_panel)  # left
        container.add_widget(sam_panel)  # right
        self.list_layout.add_widget(container)

    def _inc_font(self, *_):
        self._font_size_offset += sp(2)
        if self._last_render:
            self._last_render()

    def _dec_font(self, *_):
        self._font_size_offset -= sp(2)
        if self._last_render:
            self._last_render()

    def _set_portion_labels(self):
        self.prev_btn.lbl.text = rtl('פרשה קודמת')
        self.next_btn.lbl.text = rtl('פרשה הבאה')
        self._nav_mode = 'portion'

    def _set_chapter_labels(self):
        self.prev_btn.lbl.text = rtl('פרק קודם')
        self.next_btn.lbl.text = rtl('פרק הבא')
        self._nav_mode = 'chapter'

    def _set_breadcrumb(self, crumbs):
        """crumbs: list of (text, callback_or_None)"""
        self._crumb_bar.clear_widgets()
        self._crumb_bar.add_widget(Widget(size_hint_x=1))  # pushes content to the right
        # reversed so shallowest level (book) appears rightmost
        for i, (text, cb) in enumerate(reversed(crumbs)):
            if cb is not None:
                w = Button(
                    text=rtl(text), font_name=FONT, font_size=sp(14),
                    background_color=(0, 0, 0, 0), background_normal='',
                    color=C_ACCENT, size_hint=(None, 1), width=dp(10),
                    halign='center', valign='middle',
                )
                w.bind(texture_size=lambda i, ts: setattr(i, 'width', ts[0] + dp(12)))
                w.bind(on_press=cb)
            else:
                w = Label(
                    text=rtl(text), font_name=FONT, font_size=sp(14),
                    color=C_DARK, size_hint=(None, 1), width=dp(10),
                    halign='center', valign='middle',
                )
                w.bind(texture_size=lambda i, ts: setattr(i, 'width', ts[0] + dp(12)))
            self._crumb_bar.add_widget(w)
            if i < len(crumbs) - 1:
                sep = Label(text=' ‹ ', font_size=sp(13), color=C_MUTED,
                            size_hint=(None, 1), width=dp(22))
                self._crumb_bar.add_widget(sep)

    # ── books ─────────────────────────────────────────────────────────────────

    def _show_books(self):
        self._clear()
        self._set_breadcrumb([('בחר ספר', None)])
        self.back_btn.disabled = True
        self._state = []
        self._nav_visible(False)
        self._size_bar_visible(False)
        self._set_portion_labels()
        for row in get_books():
            def cb(_, r=row): self._show_portions(r['id'], r['name'])
            btn = IconHoverButton(
                icon_path=os.path.join(_ICONS, 'icon_book_dark.png'),
                text=rtl(row['name']), font_name=FONT, font_size=sp(21),
                text_color=C_DARK, bg_color=(0.85, 0.85, 0.85, 1),
                icon_size=dp(32), icon_side='right',
                orientation='horizontal', spacing=dp(8), padding=(dp(10), dp(4)),
                size_hint_y=None, height=dp(60),
            )
            btn.bind(on_press=cb)
            self.list_layout.add_widget(btn)

    # ── portions ──────────────────────────────────────────────────────────────

    def _show_portions(self, book_id, book_name):
        self._state.append(('books',))
        self._clear()
        self._set_breadcrumb([
            (book_name, lambda *_: self._show_books()),
        ])
        self.back_btn.disabled = False
        self._current  = ('portions', book_id, book_name)
        portions_mode  = 'jewish' if self._mode == 'standard' else 'samaritan'
        self._portions = list(get_portions(book_id, mode=portions_mode))
        self._nav_visible(False)
        self._size_bar_visible(False)
        self._set_portion_labels()
        for row in self._portions:
            if self._mode == 'samaritan':
                ch_count = count_sam_chapters_in_portion(row['id'])
                label = rtl(f'{row["name"]}  ({ch_count})')
                def cb(_, r=row, bid=book_id, bn=book_name):
                    self._show_sam_chapters(bid, r['id'], bn, r['name'])
            else:
                label = rtl(row['name'])
                def cb(_, r=row, bid=book_id, bn=book_name):
                    self._show_chapters(bid, r['id'], bn, r['name'])
            btn = IconHoverButton(
                icon_path=os.path.join(_ICONS, 'icon_portion_dark.png'),
                text=label, font_name=FONT, font_size=sp(19),
                text_color=C_DARK, bg_color=(0.85, 0.85, 0.85, 1),
                icon_size=dp(28), icon_side='right',
                orientation='horizontal', spacing=dp(8), padding=(dp(10), dp(4)),
                size_hint_y=None, height=dp(54),
            )
            btn.bind(on_press=cb)
            self.list_layout.add_widget(btn)

    # ── standard chapters ─────────────────────────────────────────────────────

    def _show_chapters(self, book_id, portion_id, book_name, portion_name):
        self._state.append(('portions', book_id, book_name))
        self._clear()
        self._set_breadcrumb([
            (book_name,    lambda *_, bid=book_id, bn=book_name: self._show_portions(bid, bn)),
            (portion_name, None),
        ])
        self._current = ('chapters', book_id, portion_id, book_name, portion_name)
        self._cur_pid = portion_id
        self._set_portion_labels()
        self._nav_visible(True)
        self._size_bar_visible(False)
        self._update_nav_state()

        self.list_layout.add_widget(
            _rtl_lbl('בחר פרק', font_size=sp(14), color=C_MUTED, height=30))

        grid = GridLayout(cols=5, spacing=dp(6), size_hint_y=None,
                          padding=(dp(2), dp(4)))
        grid.bind(minimum_height=grid.setter('height'))
        for row in get_chapters(portion_id=portion_id):
            num = row['number']
            def cb(_, r=row, bn=book_name, pn=portion_name, pid=portion_id):
                self._show_verses(r['id'], bn, pn, r['number'], portion_id=pid)
            b = RoundedHoverButton(text=str(num), font_name=FONT, font_size=sp(17),
                                   size_hint_y=None, height=dp(56))
            b.bind(on_press=cb)
            grid.add_widget(b)
        self.list_layout.add_widget(grid)

    def _show_verses(self, chapter_id, book_name, portion_name, chapter_num, portion_id=None):
        self._state.append(self._current)
        ch_rows = list(get_chapters(portion_id=portion_id))
        self._ch_list         = [(r['id'], r['number']) for r in ch_rows]
        self._ch_idx          = next((i for i, (cid, _) in enumerate(self._ch_list) if cid == chapter_id), 0)
        self._ch_book_id      = self._current[1] if self._current and len(self._current) >= 2 else None
        self._ch_book_name    = book_name
        self._ch_portion_name = portion_name
        self._ch_portion_id   = portion_id
        self._ch_mode         = 'standard'
        self._render_verses(chapter_id, book_name, portion_name, chapter_num, portion_id)

    def _render_verses(self, chapter_id, book_name, portion_name, chapter_num, portion_id=None):
        self._last_render = lambda: self._render_verses(
            chapter_id, book_name, portion_name, chapter_num, portion_id)
        self._clear()
        book_id = self._ch_book_id
        self._set_breadcrumb([
            (book_name,          lambda *_, bid=book_id, bn=book_name:
                                 self._show_portions(bid, bn)),
            (portion_name,       lambda *_, bid=book_id, pid=portion_id, bn=book_name, pn=portion_name:
                                 self._show_chapters(bid, pid, bn, pn)),
            (f'פרק {chapter_num}', None),
        ])
        self._set_chapter_labels()
        self._nav_visible(True)
        self._size_bar_visible(True)
        self._update_ch_nav_state()

        verses = get_verses(chapter_id, portion_id=portion_id)
        if not verses:
            self.list_layout.add_widget(_rtl_lbl('אין פסוקים', color=C_MUTED, height=40))
            return
        app = App.get_running_app()
        use_eng = getattr(app, '_english_mode', False)
        use_sam = getattr(app, '_font_mode', 'Hebrew') == 'Samaritan'
        fsize = sp(14) + self._font_size_offset if use_sam else sp(20) + self._font_size_offset
        if self._compare_mode:
            self._add_compare_panels(verses, fsize, use_eng)
        else:
            if use_eng:
                text, use_markup, ltr = _english_verse_text(verses)
            else:
                lines = '\n'.join(f'{v["number"]}  {v["text"]}' for v in verses)
                text, use_markup, ltr = _verse_text(lines)
            halign = 'left' if ltr else 'right'
            lbl = Label(text=text, font_name=FONT, font_size=fsize, color=C_DARK,
                        halign=halign, valign='top', size_hint_y=None,
                        padding=(dp(10), dp(8)), markup=use_markup)
            lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w - dp(20), None)))
            lbl.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(16)))
            self.list_layout.add_widget(lbl)

    # ── samaritan chapters ────────────────────────────────────────────────────

    def _show_sam_chapters(self, book_id, portion_id, book_name, portion_name):
        self._state.append(('portions', book_id, book_name))
        self._clear()
        self._set_breadcrumb([
            (book_name,    lambda *_, bid=book_id, bn=book_name: self._show_portions(bid, bn)),
            (portion_name, None),
        ])
        self._current = ('sam_portion', book_id, portion_id, book_name, portion_name)
        self._cur_pid = portion_id
        self._set_portion_labels()
        self._nav_visible(True)
        self._size_bar_visible(False)
        self._update_nav_state()

        self.list_layout.add_widget(
            _rtl_lbl('בחר פרק שומרוני', font_size=sp(14), color=C_MUTED, height=30))

        grid = GridLayout(cols=5, spacing=dp(6), size_hint_y=None,
                          padding=(dp(2), dp(4)))
        grid.bind(minimum_height=grid.setter('height'))
        for row in get_sam_chapters_in_portion(portion_id):
            num = row['number']
            def cb(_, r=row, bn=book_name, pn=portion_name):
                self._show_sam_verses(r['id'], bn, pn, r['number'])
            b = RoundedHoverButton(text=str(num), font_name=FONT, font_size=sp(17),
                                   size_hint_y=None, height=dp(56))
            b.bind(on_press=cb)
            grid.add_widget(b)
        self.list_layout.add_widget(grid)

    def _show_sam_verses(self, sam_ch_id, book_name, portion_name, sam_ch_num):
        self._state.append(self._current)
        sam_rows = list(get_sam_chapters_in_portion(self._cur_pid))
        self._ch_list         = [(r['id'], r['number']) for r in sam_rows]
        self._ch_idx          = next((i for i, (cid, _) in enumerate(self._ch_list) if cid == sam_ch_id), 0)
        self._ch_book_id      = self._current[1] if self._current and len(self._current) >= 2 else None
        self._ch_book_name    = book_name
        self._ch_portion_name = portion_name
        self._ch_portion_id   = self._cur_pid
        self._ch_mode         = 'samaritan'
        self._render_sam_verses(sam_ch_id, book_name, portion_name, sam_ch_num)

    def _render_sam_verses(self, sam_ch_id, book_name, portion_name, sam_ch_num):
        self._last_render = lambda: self._render_sam_verses(
            sam_ch_id, book_name, portion_name, sam_ch_num)
        self._clear()
        book_id    = self._ch_book_id
        portion_id = self._ch_portion_id
        self._set_breadcrumb([
            (book_name,                  lambda *_, bid=book_id, bn=book_name:
                                         self._show_portions(bid, bn)),
            (portion_name,               lambda *_, bid=book_id, pid=portion_id, bn=book_name, pn=portion_name:
                                         self._show_sam_chapters(bid, pid, bn, pn)),
            (f'פרק שומרוני {sam_ch_num}', None),
        ])
        self._set_chapter_labels()
        self._nav_visible(True)
        self._size_bar_visible(True)
        self._update_ch_nav_state()

        verses = get_verses_by_sam_ch(sam_ch_id)
        if not verses:
            self.list_layout.add_widget(_rtl_lbl('אין פסוקים', color=C_MUTED, height=40))
            return
        app = App.get_running_app()
        use_eng = getattr(app, '_english_mode', False)
        use_sam = getattr(app, '_font_mode', 'Hebrew') == 'Samaritan'
        fsize = sp(14) + self._font_size_offset if use_sam else sp(20) + self._font_size_offset
        if self._compare_mode:
            self._add_compare_panels(verses, fsize, use_eng)
        else:
            if use_eng:
                text, use_markup, ltr = _english_verse_text(verses)
            else:
                lines = '\n'.join(f'{v["number"]}  {v["text"]}' for v in verses)
                text, use_markup, ltr = _verse_text(lines)
            halign = 'left' if ltr else 'right'
            lbl = Label(text=text, font_name=FONT, font_size=fsize, color=C_DARK,
                        halign=halign, valign='top', size_hint_y=None,
                        padding=(dp(10), dp(8)), markup=use_markup)
            lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w - dp(20), None)))
            lbl.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(16)))
            self.list_layout.add_widget(lbl)

    # ── prev / next dispatcher ────────────────────────────────────────────────

    def _on_prev(self, *_):
        if self._nav_mode == 'chapter':
            self._jump_chapter(-1)
        else:
            self._jump_portion(-1)

    def _on_next(self, *_):
        if self._nav_mode == 'chapter':
            self._jump_chapter(1)
        else:
            self._jump_portion(1)

    def _update_ch_nav_state(self):
        self.prev_btn.disabled = (self._ch_idx <= 0)
        self.next_btn.disabled = (self._ch_idx >= len(self._ch_list) - 1)

    def _jump_chapter(self, delta):
        new_idx = self._ch_idx + delta
        if 0 <= new_idx < len(self._ch_list):
            self._ch_idx = new_idx
            cid, cnum = self._ch_list[new_idx]
            if self._ch_mode == 'standard':
                self._render_verses(cid, self._ch_book_name, self._ch_portion_name,
                                    cnum, self._ch_portion_id)
            else:
                self._render_sam_verses(cid, self._ch_book_name, self._ch_portion_name, cnum)

    def _update_nav_state(self):
        if not self._portions or self._cur_pid is None:
            return
        ids = [p['id'] for p in self._portions]
        try:
            idx = ids.index(self._cur_pid)
        except ValueError:
            return
        self.prev_btn.disabled = (idx <= 0)
        self.next_btn.disabled = (idx >= len(ids) - 1)

    def _jump_portion(self, delta):
        if not self._portions or self._cur_pid is None:
            return
        ids = [p['id'] for p in self._portions]
        try:
            idx = ids.index(self._cur_pid)
        except ValueError:
            return
        new_idx = idx + delta
        if 0 <= new_idx < len(self._portions):
            p = self._portions[new_idx]
            if self._current and len(self._current) >= 4:
                book_id, book_name = self._current[1], self._current[3]
                if self._mode == 'samaritan':
                    self._show_sam_chapters(book_id, p['id'], book_name, p['name'])
                else:
                    self._show_chapters(book_id, p['id'], book_name, p['name'])

    def refresh_current(self):
        """Re-render the current verse view (called on font toggle)."""
        if self._last_render:
            self._last_render()

    def show_chapter_for_search(self, book_id, book_name, portion_id, portion_name,
                                chapter_id, chapter_num):
        """Navigate directly to a chapter, with Back returning to search results."""
        from app.services.database import get_portions, get_chapters
        self._portions        = list(get_portions(book_id, mode='jewish'))
        self._cur_pid         = portion_id
        self._current         = ('chapters', book_id, portion_id, book_name, portion_name)
        self._state           = []
        self._search_return   = True
        ch_rows = list(get_chapters(portion_id=portion_id))
        self._ch_list         = [(r['id'], r['number']) for r in ch_rows]
        self._ch_idx          = next((i for i, (cid, _) in enumerate(self._ch_list) if cid == chapter_id), 0)
        self._ch_book_id      = book_id
        self._ch_book_name    = book_name
        self._ch_portion_name = portion_name
        self._ch_portion_id   = portion_id
        self._ch_mode         = 'standard'
        self.back_btn.disabled = False
        self._render_verses(chapter_id, book_name, portion_name, chapter_num, portion_id)

    def _go_back(self, *_):
        if not self._state:
            if self._search_return:
                self._search_return = False
                from kivy.app import App
                App.get_running_app().sm.current = 'search'
            return
        prev = self._state.pop()
        level = prev[0]
        if   level == 'books':       self._show_books()
        elif level == 'portions':    self._show_portions(prev[1], prev[2])
        elif level == 'chapters':    self._show_chapters(prev[1], prev[2], prev[3], prev[4])
        elif level == 'sam_portion': self._show_sam_chapters(prev[1], prev[2], prev[3], prev[4])
