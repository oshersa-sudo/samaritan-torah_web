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
from kivy.uix.checkbox import CheckBox
from kivy.uix.behaviors import ButtonBehavior
from kivy.clock import Clock
from kivy.graphics import Color, Rectangle, RoundedRectangle, Line
from kivy.metrics import sp, dp
from kivy.core.text import Label as CoreLabel
from app.services.database import (get_books, get_portions, get_chapters, get_verses,
                                    get_sam_chapters, get_sam_chapters_in_portion,
                                    count_sam_chapters_in_portion,
                                    get_verses_by_sam_ch)
from app.services.rtl import rtl, rtl_lines, arabic
from app.widgets import HoverButton, RoundedHoverButton, IconHoverButton
from app.services.interpreter import get_chapter_interpretations
from app.services.database import (get_verse_dictionary, get_tibat_marqe,
                                   get_eyalk_commentary, get_tzdaka_commentary)

_ICONS = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'icons')

C_NAVY   = (0.10, 0.22, 0.45, 1)
C_ACCENT = (0.18, 0.38, 0.72, 1)
C_WHITE  = (1, 1, 1, 1)
C_DARK   = (0.08, 0.08, 0.08, 1)
C_MUTED  = (0.45, 0.45, 0.55, 1)
C_BTN    = (0.92, 0.93, 0.98, 1)
FONT     = 'Hebrew'

BG_IMAGE = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'images', 'background.jpg')


class TapLabel(ButtonBehavior, Label):
    """A Label that behaves like a button (fires on_release on a tap, while still
    letting touches scroll). Used to make dictionary words tappable."""
    pass

# Jewish commentators: (db column, display name). The first four are stored
# locally (downloaded from Sefaria); the last fetches additional commentators
# live from Sefaria's free API on demand.
WEB_KEY = 'web'
COMMENTATORS = [('rashi', 'רש"י'), ('ramban', 'רמב"ן'),
                ('cassuto', 'קאסוטו'), ('baal_haturim', 'בעל הטורים'),
                (WEB_KEY, 'פרשנים נוספים (ספריא)')]
SEFARIA_CREDIT = 'באדיבות אתר ספריא'
WEB_CREDIT     = 'מתוך אתר ספריא'

_HEB_RE    = re.compile(u'([א-ת]+)')
_NIKUD_RE  = re.compile(u'[֑-ׇ]')


_SOF_PASUQ = u'׃'
_MID_DOT   = u'·'


def _add_word_dots(text):
    """Add middle dot between words; skip before sof-pasuq (׃) or --.

    Also applies the Samaritan stop-mark display rules (display only — the stored
    text is untouched): a standing-period (עמידה) touching the small-pause colon,
    or sitting right before the verse-end ׃, is dropped; and the standing mark is
    shown with a one-character space before it."""
    text = re.sub(u'\\.\\s*:', u':', text)   # period before a colon  -> just the colon
    text = re.sub(u':\\s*\\.', u':', text)   # period after  a colon  -> just the colon
    text = re.sub(u'\\.\\s*׃', u'׃', text)   # period before verse-end ׃ -> drop the period
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
    out = '\n'.join(result)
    out = re.sub(u' ?\\.', u' .', out)       # one-char space before the standing mark
    return out


_SAM_RE = re.compile(u'([א-ת]+|\\.)')   # Hebrew runs + the verse-pause period


def _sam_markup(text):
    """Hebrew letters AND the verse-pause period render in the Samaritan font —
    the Samaritan pause glyph (עמידה בפסוק) lives at U+002E in Sam_font. Other
    punctuation (the small-pause colon, numbers, brackets) stays in the Hebrew
    font. Rendered as a plain font glyph it has no background and scales with the
    surrounding text, as requested."""
    out = []
    for p in _SAM_RE.split(text):
        if not p:
            continue
        if p == u'.' or _HEB_RE.fullmatch(p):
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


_MEASURE_CACHE = {}


def _measure_label(font_name, font_size):
    """Cached CoreLabel used only to measure text width in pixels."""
    key = (font_name, round(float(font_size), 1))
    cl = _MEASURE_CACHE.get(key)
    if cl is None:
        cl = CoreLabel(font_name=font_name, font_size=font_size)
        cl.refresh()
        _MEASURE_CACHE[key] = cl
    return cl


def _wrap_rtl(logical_text, use_sam, font_size, max_width):
    """Word-wrap RTL text while it is still in logical order, then reorder each
    resulting line to visual order. Because wrapping decisions are made on the
    logical word stream, the lines come out in reading order top→bottom, so a
    line that overflows the screen width continues *below* (not above / left).

    Returns the final string to assign to a right-aligned Label
    (Samaritan markup already applied when use_sam is True).
    """
    measure_font = 'Samaritan' if use_sam else 'Hebrew'
    cl = _measure_label(measure_font, font_size)

    def _visible(words):
        v = rtl(' '.join(words))
        return _add_word_dots(v) if use_sam else v

    wrapped = []
    for logical_line in logical_text.split('\n'):
        cur = []
        for word in logical_line.split(' '):
            if cur and cl.get_extents(_visible(cur + [word]))[0] > max_width:
                wrapped.append(cur)
                cur = [word]
            else:
                cur.append(word)
        if cur:
            wrapped.append(cur)

    out = []
    for words in wrapped:
        v = rtl(' '.join(words))
        out.append(_sam_markup(_add_word_dots(v)) if use_sam else v)
    return '\n'.join(out)


def _wrap_arabic(logical_text, font_size, max_width):
    """Like _wrap_rtl, but for Arabic: shape the letters (cursive joining) and
    measure/render with the Arabic font, so lines wrap and read right-to-left."""
    cl = _measure_label('Arabic', font_size)
    wrapped = []
    for logical_line in logical_text.split('\n'):
        cur = []
        for word in logical_line.split(' '):
            if cur and cl.get_extents(arabic(' '.join(cur + [word])))[0] > max_width:
                wrapped.append(cur)
                cur = [word]
            else:
                cur.append(word)
        if cur:
            wrapped.append(cur)
    return '\n'.join(arabic(' '.join(words)) for words in wrapped)


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
        self._interpret_mode   = False
        self._aramaic_mode     = False
        self._arabic_mode      = False
        self._dict_mode        = False
        self._online_dict_mode = False   # show online Hebrew-Hebrew results
        self._dict_pool        = None    # lazy ThreadPoolExecutor for lookups
        self._commentary_mode  = False
        self._commentary_sel   = None
        self._samaritan_src_mode = False
        self._sam_src_choice   = None   # None=source picker, 'tm', or 'eyalk'
        self._tm_sel           = None   # selected Tibåt Mårqe section (book, section)
        self._web_cache        = {}     # verse-id tuple -> (status, text)
        self._web_pending      = set()
        self._verse_filter     = None
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

        # "פריסת פרקים" — jump straight to any chapter of the current book; shown
        # only on the portion-division pages, hidden (height 0) everywhere else.
        self._spread_btn = HoverButton(
            text=rtl('פריסת פרקים'), font_name=FONT, font_size=sp(16),
            background_color=C_NAVY, background_normal='', color=C_WHITE,
            size_hint_y=None, height=0, opacity=0, disabled=True,
        )
        self._spread_btn.bind(on_press=self._on_spread)
        root.add_widget(self._spread_btn)

        # ── nav + font-size bar:  [פרק הבא] [−] [+] [פרק קודם] ──
        self._size_bar = BoxLayout(size_hint_y=None, height=dp(46),
                                   spacing=dp(6), padding=(dp(6), dp(2)))
        self._minus_btn = RoundedHoverButton(
            text='−', font_size=sp(28), bold=True,
            size_hint=(None, None), width=dp(54), height=dp(42),
        )
        self._plus_btn = RoundedHoverButton(
            text='+', font_size=sp(28), bold=True,
            size_hint=(None, None), width=dp(54), height=dp(42),
        )
        self._minus_btn.bind(on_press=self._dec_font)
        self._plus_btn.bind(on_press=self._inc_font)
        root.add_widget(self._size_bar)

        # back / dict / interp buttons are created here but placed by main.py
        # into the shared 3-row toolbar (so they share a row with עיון/חיפוש).
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
            icon_size=dp(20), icon_side='right',
            orientation='horizontal', spacing=dp(4), padding=(dp(4), 0),
            size_hint_y=None, height=dp(42),
        )
        self.next_btn = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_arrow_next.png'),
            text=rtl('פרשה הבאה'), font_name=FONT, font_size=sp(13),
            text_color=C_WHITE, bg_color=C_NAVY,
            icon_size=dp(20), icon_side='left',
            orientation='horizontal', spacing=dp(4), padding=(dp(4), 0),
            size_hint_y=None, height=dp(42),
        )
        self.interp_btn = HoverButton(
            text=rtl('פירוש הפסוק'),
            font_name=FONT, font_size=sp(14),
            background_color=(0.55, 0.55, 0.55, 1), background_normal='',
            color=C_WHITE,
            size_hint_y=None, height=dp(46),
            disabled=True,
        )
        self.dict_btn = HoverButton(
            text=rtl('מילון מילים'),
            font_name=FONT, font_size=sp(14),
            background_color=(0.55, 0.55, 0.55, 1), background_normal='',
            color=C_WHITE,
            size_hint_y=None, height=dp(46),
            disabled=True,
        )
        self.prev_btn.bind(on_press=self._on_prev)
        self.next_btn.bind(on_press=self._on_next)
        self.interp_btn.bind(on_press=self._on_interp)
        self.dict_btn.bind(on_press=self._on_dict)

        # next/prev flank the −/+ font buttons in the size bar
        self._size_bar.add_widget(self.next_btn)
        self._size_bar.add_widget(self._minus_btn)
        self._size_bar.add_widget(self._plus_btn)
        self._size_bar.add_widget(self.prev_btn)
        self._size_bar.opacity  = 0
        self._size_bar.disabled = True

        self.add_widget(root)
        self._show_books()

    def _clear(self):
        self.list_layout.clear_widgets()
        self.scroll.scroll_y = 1
        if hasattr(self, '_spread_btn'):
            self._spread_visible(False)

    def _spread_visible(self, show):
        self._spread_btn.height   = dp(50) if show else 0
        self._spread_btn.opacity  = 1 if show else 0
        self._spread_btn.disabled = not show

    def _nav_visible(self, show):
        self._nav_on = show
        self._refresh_size_bar()

    def _size_bar_visible(self, show):
        # controls the −/+ font buttons (verse screens only) and gates the
        # verse-view-only mode buttons in the bottom nav.
        self._font_on = show
        app = App.get_running_app()
        if hasattr(app, 'compare_btn'):
            app._compare_btn_should_show = show
            app._sync_btn_states()
        self._refresh_size_bar()

    def _refresh_size_bar(self):
        nav  = getattr(self, '_nav_on', False)
        font = getattr(self, '_font_on', False)
        for b in (self.prev_btn, self.next_btn):
            b.disabled = not nav
            b.opacity  = 1 if nav else 0
        for b in (self._minus_btn, self._plus_btn):
            b.disabled = not font
            b.opacity  = 1 if font else 0
        on = nav or font
        self._size_bar.opacity  = 1 if on else 0
        self._size_bar.disabled = not on

    def toggle_compare(self, active):
        self._compare_mode = active
        if self._last_render:
            self._last_render()

    def toggle_interpret(self, active):
        self._interpret_mode = active
        if self._last_render:
            self._last_render()

    def toggle_aramaic(self, active):
        self._aramaic_mode = active
        if self._last_render:
            self._last_render()

    def toggle_arabic(self, active):
        self._arabic_mode = active
        if self._last_render:
            self._last_render()

    def toggle_dict(self, active):
        self._dict_mode = active
        if self._last_render:
            self._last_render()

    def toggle_commentary(self, active):
        self._commentary_mode = active
        if active:
            self._commentary_sel = None   # open with the selection list
        if self._last_render:
            self._last_render()

    def toggle_samaritan_source(self, active):
        self._samaritan_src_mode = active
        if active:
            self._sam_src_choice = None   # open with the source-selection panel
            self._tm_sel = None
        if self._last_render:
            self._last_render()

    def _select_sam_source(self, choice):
        """Pick a source inside 'ממקור שומרון': 'tm' (תיבת מרקה) / 'eyalk'
        (מן המסורת השומרונית); None returns to the source-selection panel."""
        self._sam_src_choice = choice
        self._tm_sel = None
        if self._last_render:
            self._last_render()

    def _select_tm_section(self, key):
        self._tm_sel = key
        if self._last_render:
            self._last_render()

    def _on_dict(self, *_):
        App.get_running_app()._toggle_dict()

    def _on_interp(self, *_):
        App.get_running_app()._toggle_interpret()

    def _select_commentator(self, key):
        self._commentary_sel = key
        if self._last_render:
            self._last_render()

    # ── panel text wrapping (right-aligned, breaks downward like the main view) ──

    @staticmethod
    def _plain_rewrap(logical, fsize):
        """rewrap(width) for plain Hebrew panel text (no per-word markup)."""
        def f(avail):
            return _wrap_rtl(logical, False, fsize, avail if avail > dp(20) else 10 ** 6)
        return f

    @staticmethod
    def _arabic_rewrap(logical, fsize):
        """rewrap(width) for Arabic panel text (shaped + right-to-left)."""
        def f(avail):
            return _wrap_arabic(logical, fsize, avail if avail > dp(20) else 10 ** 6)
        return f

    @staticmethod
    def _static_rewrap(text):
        """rewrap(width) for already-prepared text (LTR English / fallbacks)."""
        return lambda avail: text

    def _diff_rewrap(self, token_lines, use_sam, fsize):
        """rewrap(width) for the compare diff (per-word red markup)."""
        def f(avail):
            return self._wrap_panel(token_lines, use_sam, fsize,
                                    avail if avail > dp(20) else 10 ** 6)
        return f

    def _wrap_panel(self, token_lines, use_sam, font_size, max_width):
        """Word-wrap diff token lines (logical order) and render each resulting
        visual line right-to-left, keeping per-word red markup. Wrapping is done
        on the logical stream, so overflow continues on a new line *below*."""
        RED, END = u'[color=cc0000]', u'[/color]'
        cl = _measure_label('Samaritan' if use_sam else 'Hebrew', font_size)

        def width_of(words):
            return cl.get_extents(rtl(u' '.join(words)))[0]

        def render(word, is_diff):
            v = _sam_markup(rtl(word)) if use_sam else rtl(word)
            return (RED + v + END) if is_diff else v

        def flush(out, cur):
            out.append(u' '.join(render(w, d) for w, d in reversed(cur)))

        out = []
        for tokens in token_lines:
            if not tokens:
                out.append(u'')
                continue
            cur = []
            for tok in tokens:
                trial = [w for w, _ in cur] + [tok[0]]
                if cur and width_of(trial) > max_width:
                    flush(out, cur)
                    cur = [tok]
                else:
                    cur.append(tok)
            if cur:
                flush(out, cur)
        return u'\n'.join(out)

    def _build_compare_panel(self, title, rewrap, markup, ltr, fsize, font_name=FONT):
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
            text='', font_name=font_name, font_size=fsize,
            color=C_DARK, halign=halign, valign='top',
            size_hint_y=None, markup=markup,
        )
        def _on_width(i, w):
            avail = w - dp(8)
            i.text_size = (avail, None)
            i.text = rewrap(avail - dp(8))   # margin so pre-wrapped lines never re-wrap
        text_lbl.bind(width=_on_width)
        text_lbl.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(8)))
        panel.add_widget(text_lbl)
        # spacer absorbs slack at the bottom so title+text stay pinned to the top
        # when this panel is stretched to match a taller sibling (_equal_height_pair)
        panel.add_widget(Widget())

        panel.text_lbl = text_lbl
        panel.height = dp(100)
        return panel

    def _equal_height_pair(self, left, right):
        """Lay two compare-style panels side by side at equal height, so their
        top and bottom edges align. Inner text is already top-aligned, and the
        bottom spacer in each panel keeps it that way when stretched."""
        container = BoxLayout(orientation='horizontal', spacing=dp(8),
                              size_hint_y=None, height=dp(100), padding=(dp(2), dp(4)))

        def _sync(*_):
            lh = dp(32) + left.text_lbl.height + dp(20)
            rh = dp(32) + right.text_lbl.height + dp(20)
            h  = max(lh, rh)
            left.height  = h
            right.height = h
            container.height = h + dp(8)
        left.text_lbl.bind(height=_sync)
        right.text_lbl.bind(height=_sync)
        _sync()

        container.add_widget(left)
        container.add_widget(right)
        return container

    @staticmethod
    def _diff_tokens(verse_num, sam_raw, mas_raw):
        """Return (sam_tokens, mas_tokens) for one verse; each is a logical-order
        list of (word, is_diff). The verse number is the first token of each
        non-empty side. Differing words (atom-level, maqaf-aware) are flagged."""
        MAQAF = u'־'
        sam_words = sam_raw.split() if sam_raw else []
        mas_words = mas_raw.split() if mas_raw else []
        numtok = (str(verse_num), False)

        if not sam_words and not mas_words:
            return [], []
        if not sam_words:
            return [], [numtok] + [(w, False) for w in mas_words]
        if not mas_words:
            return [numtok] + [(w, False) for w in sam_words], []

        # Tokenize: split each space-token further by maqaf for comparison
        def tokenize(words):
            tokens = []
            for w in words:
                atoms = [_NIKUD_RE.sub(u'', a) for a in w.split(MAQAF) if a]
                tokens.append((w, atoms or [_NIKUD_RE.sub(u'', w)]))
            return tokens

        sam_tok = tokenize(sam_words)
        mas_tok = tokenize(mas_words)

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

        sam_diff = [False] * len(sam_tok)
        mas_diff = [False] * len(mas_tok)
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(
                None, sam_atoms, mas_atoms, autojunk=False).get_opcodes():
            if tag != 'equal':
                for ai in range(i1, i2): sam_diff[sam_a2t[ai]] = True
                for aj in range(j1, j2): mas_diff[mas_a2t[aj]] = True

        sam_tokens = [numtok] + [(w, sam_diff[i]) for i, (w, _) in enumerate(sam_tok)]
        mas_tokens = [numtok] + [(w, mas_diff[i]) for i, (w, _) in enumerate(mas_tok)]
        return sam_tokens, mas_tokens

    def _add_compare_panels(self, verses, fsize, use_eng):
        app      = App.get_running_app()
        use_sam  = getattr(app, '_font_mode', 'Hebrew') == 'Samaritan'

        if use_eng:
            sam_text, sam_mk, sam_ltr = _english_verse_text(verses)
            mas_logical = u'\n'.join(u'{}  {}'.format(v['number'], v['masoretic_text'])
                                     for v in verses if v['masoretic_text'])
            sam_rewrap = self._static_rewrap(sam_text)                       # English (LTR)
            mas_rewrap = (self._plain_rewrap(mas_logical, fsize) if mas_logical
                          else self._static_rewrap(rtl(u'אין נוסח מסורה')))
            sam_mk_flag, mas_mk_flag = sam_mk, False
            sam_ltr_flag, mas_ltr_flag = sam_ltr, False
        else:
            sam_lines, mas_lines = [], []
            for v in verses:
                st, mt = self._diff_tokens(
                    v['number'], v['text'] or u'', v['masoretic_text'] or u'')
                sam_lines.append(st)
                mas_lines.append(mt)
            sam_rewrap = self._diff_rewrap(sam_lines, use_sam, fsize)
            mas_rewrap = self._diff_rewrap(mas_lines, False, fsize)   # Masoretic never Samaritan
            sam_mk_flag = mas_mk_flag = True
            sam_ltr_flag = mas_ltr_flag = False

        # Masoretic LEFT, Samaritan RIGHT
        mas_panel = self._build_compare_panel(u'נוסח מסורה',  mas_rewrap, mas_mk_flag, mas_ltr_flag, fsize)
        sam_panel = self._build_compare_panel(u'נוסח שומרון', sam_rewrap, sam_mk_flag, sam_ltr_flag, fsize)
        self.list_layout.add_widget(self._equal_height_pair(mas_panel, sam_panel))

    def _build_interpret_container(self, verses, fsize):
        orig_logical = '\n'.join(f'{v["number"]}  {v["text"]}' for v in verses)
        orig_panel = self._build_compare_panel(
            'הטקסט המקורי', self._plain_rewrap(orig_logical, fsize), False, False, fsize)

        interp_map = get_chapter_interpretations(verses)
        parts = [f'{v["number"]}  {interp_map[v["id"]]}'
                 for v in verses if interp_map.get(v['id'])]
        interp_rewrap = (self._plain_rewrap('\n'.join(parts), fsize) if parts
                         else self._static_rewrap(
                             rtl('פירוש אינו זמין — הרץ scripts/translate_interpretations.py')))
        interp_panel = self._build_compare_panel('פירוש הפסוק', interp_rewrap, False, False, fsize)
        return self._equal_height_pair(interp_panel, orig_panel)

    def _add_interpret_panels(self, verses, fsize):
        self.list_layout.add_widget(self._build_interpret_container(verses, fsize))

    def _build_aramaic_container(self, verses, fsize):
        orig_logical = '\n'.join(f'{v["number"]}  {v["text"]}' for v in verses)
        orig_panel = self._build_compare_panel(
            'הטקסט המקורי', self._plain_rewrap(orig_logical, fsize), False, False, fsize)

        parts = [f'{v["number"]}  {(v["sam_aramaic"] or "").strip()}'
                 for v in verses if (v['sam_aramaic'] or '').strip()]
        aram_rewrap = (self._plain_rewrap('\n'.join(parts), fsize) if parts
                       else self._static_rewrap(rtl('תרגום ארמי אינו זמין')))
        aram_panel = self._build_compare_panel('תרגום ארמי', aram_rewrap, False, False, fsize)
        return self._equal_height_pair(aram_panel, orig_panel)

    def _add_aramaic_panels(self, verses, fsize):
        self.list_layout.add_widget(self._build_aramaic_container(verses, fsize))

    def _build_arabic_container(self, verses, fsize):
        orig_logical = '\n'.join(f'{v["number"]}  {v["text"]}' for v in verses)
        orig_panel = self._build_compare_panel(
            'הטקסט המקורי', self._plain_rewrap(orig_logical, fsize), False, False, fsize)

        parts = [f'{v["number"]}  {(v["arabic_trans"] or "").strip()}'
                 for v in verses if (v["arabic_trans"] or '').strip()]
        if parts:
            arab_rewrap = self._arabic_rewrap('\n'.join(parts), fsize)
            arab_font = 'Arabic'
        else:
            arab_rewrap = self._static_rewrap(rtl('תרגום ערבי אינו זמין'))
            arab_font = FONT
        arab_panel = self._build_compare_panel('תרגום ערבי', arab_rewrap, False, False,
                                               fsize, font_name=arab_font)
        return self._equal_height_pair(arab_panel, orig_panel)

    def _add_arabic_panels(self, verses, fsize):
        self.list_layout.add_widget(self._build_arabic_container(verses, fsize))

    # ── Jewish commentary (Sefaria) ───────────────────────────────────────────

    def _commentary_logical(self, verses, sel):
        parts = []
        for v in verses:
            txt = (v[sel] or '').strip() if sel in v.keys() else ''
            if txt:
                parts.append(f'{v["number"]}  {txt}')
        return '\n'.join(parts)

    # ── extra commentators fetched live from Sefaria ──────────────────────────

    def _web_rewrap(self, verses, fsize):
        """rewrap(width) for the live-Sefaria option. Works on a single verse;
        kicks off an async fetch and shows a loading line until it lands."""
        if len(verses) != 1:
            return self._static_rewrap(
                rtl('בחר פסוק יחיד מהפס שלמעלה לצפייה בפרשנים נוספים מספריא'))
        vid = verses[0]['id']
        cached = self._web_cache.get(vid)
        if cached is None and vid not in self._web_pending:
            self._web_pending.add(vid)
            self._start_web_fetch(vid)
        if cached is not None:
            return self._plain_rewrap(cached[1], fsize)
        return self._static_rewrap(rtl('טוען פרשנים נוספים מספריא...'))

    def _start_web_fetch(self, verse_id):
        import threading
        from kivy.clock import Clock
        from app.services.sefaria_live import has_internet, fetch_live_commentaries
        from app.services.database import get_verse_ref

        def work():
            try:
                ref = get_verse_ref(verse_id)
                if not has_internet():
                    result = ('error', 'אין חיבור לרשת. פונקציה זו זמינה רק בחיבור לרשת.')
                elif ref is None:
                    result = ('error', 'הפסוק אינו זמין.')
                else:
                    items = fetch_live_commentaries(ref['book'], ref['chapter'], ref['verse'])
                    if items:
                        result = ('ok', '\n\n'.join('%s\n%s' % (n, t) for n, t in items))
                    else:
                        result = ('ok', 'לא נמצאו פרשנים נוספים לפסוק זה בספריא.')
            except Exception:
                result = ('error', 'שגיאה בטעינת הפרשנים מספריא. נסה שוב.')
            Clock.schedule_once(lambda dt: self._web_done(verse_id, result), 0)

        threading.Thread(target=work, daemon=True).start()

    def _web_done(self, key, result):
        self._web_pending.discard(key)
        self._web_cache[key] = result
        if (self._commentary_mode and self._commentary_sel == WEB_KEY
                and self._last_render):
            self._last_render()

    def _build_commentary_container(self, verses, fsize):
        """Lower panel shown beneath the original text in commentary mode.
        No selection -> 'בחר פרשן' header + vertical commentator list.
        A commentator selected -> its commentary (with a back-to-list button)."""
        sel   = self._commentary_sel
        names = dict(COMMENTATORS)

        panel = BoxLayout(orientation='vertical', size_hint_y=None,
                          padding=(dp(8), dp(8)), spacing=dp(6))
        with panel.canvas.before:
            Color(0.97, 0.97, 0.95, 1)
            _rr = RoundedRectangle(pos=panel.pos, size=panel.size, radius=[dp(12)])
            Color(*C_NAVY[:3], 0.55)
            _ln = Line(width=1.3,
                       rounded_rectangle=[panel.x, panel.y, panel.width, panel.height, dp(12)])
        def _sg(inst, val):
            _rr.pos = inst.pos;  _rr.size = inst.size
            _ln.rounded_rectangle = [inst.x, inst.y, inst.width, inst.height, dp(12)]
        panel.bind(pos=_sg, size=_sg)

        if sel is None:
            title = Label(text=rtl('בחר פרשן'), font_name=FONT, font_size=sp(18),
                          bold=True, color=C_NAVY, size_hint_y=None, height=dp(34),
                          halign='center', valign='middle')
            title.bind(size=lambda i, s: setattr(i, 'text_size', s))
            panel.add_widget(title)
            for key, name in COMMENTATORS:
                btn = HoverButton(text=rtl(name), font_name=FONT, font_size=sp(16),
                                  background_color=(0.25, 0.35, 0.45, 1), background_normal='',
                                  color=C_WHITE, size_hint_y=None, height=dp(46))
                btn.bind(on_press=lambda _, k=key: self._select_commentator(k))
                panel.add_widget(btn)
            panel.height = dp(34) + len(COMMENTATORS) * (dp(46) + dp(6)) + dp(18)
        else:
            header = BoxLayout(size_hint_y=None, height=dp(34), spacing=dp(6))
            back = HoverButton(text=rtl('‹ בחר פרשן'), font_name=FONT, font_size=sp(13),
                               background_color=C_ACCENT, background_normal='', color=C_WHITE,
                               size_hint_x=None, width=dp(108))
            back.bind(on_press=lambda *_: self._select_commentator(None))
            name_lbl = Label(text=rtl(names[sel]), font_name=FONT, font_size=sp(18),
                             bold=True, color=C_NAVY, halign='center', valign='middle')
            name_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
            header.add_widget(back)
            header.add_widget(name_lbl)
            panel.add_widget(header)

            credit_text = WEB_CREDIT if sel == WEB_KEY else SEFARIA_CREDIT
            credit = Label(text=rtl(credit_text), font_name=FONT, font_size=sp(12),
                           bold=True, color=C_ACCENT, size_hint_y=None, height=dp(20),
                           halign='center', valign='middle')
            credit.bind(size=lambda i, s: setattr(i, 'text_size', s))
            panel.add_widget(credit)

            if sel == WEB_KEY:
                rewrap = self._web_rewrap(verses, fsize)
            else:
                logical = self._commentary_logical(verses, sel)
                rewrap = (self._plain_rewrap(logical, fsize) if logical
                          else self._static_rewrap(rtl('אין פרשנות %s לפסוק זה' % names[sel])))
            text_lbl = Label(text='', font_name=FONT, font_size=fsize, color=C_DARK,
                             halign='right', valign='top', size_hint_y=None, markup=False)
            def _on_cw(i, w):
                avail = w - dp(8)
                i.text_size = (avail, None)
                i.text = rewrap(avail - dp(8))
            text_lbl.bind(width=_on_cw)
            text_lbl.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(8)))
            panel.add_widget(text_lbl)
            panel.add_widget(Widget())
            def _upd(*_):
                panel.height = dp(34) + dp(20) + text_lbl.height + dp(26)
            text_lbl.bind(height=_upd)
            panel.height = dp(160)
        return panel

    def _add_commentary_panels(self, verses, fsize):
        self.list_layout.add_widget(self._build_commentary_container(verses, fsize))

    def _src_panel_frame(self):
        """Framed vertical panel (rounded bg + navy border) shared by the
        'ממקור שומרון' source pages; caller adds children, height auto-tracks."""
        panel = GridLayout(cols=1, size_hint_y=None, padding=(dp(8), dp(8)), spacing=dp(6))
        panel.bind(minimum_height=panel.setter('height'))
        with panel.canvas.before:
            Color(0.97, 0.97, 0.95, 1)
            _rr = RoundedRectangle(pos=panel.pos, size=panel.size, radius=[dp(12)])
            Color(*C_NAVY[:3], 0.55)
            _ln = Line(width=1.3,
                       rounded_rectangle=[panel.x, panel.y, panel.width, panel.height, dp(12)])
        def _sg(inst, val):
            _rr.pos = inst.pos;  _rr.size = inst.size
            _ln.rounded_rectangle = [inst.x, inst.y, inst.width, inst.height, dp(12)]
        panel.bind(pos=_sg, size=_sg)
        return panel

    def _build_samaritan_src_container(self, verses, fsize):
        """'ממקור שומרון' lower panel. Opens on a source-selection panel; the
        chosen source is then shown: תיבת מרקה (Tibåt Mårqe passages) or
        מן המסורת השומרונית (Samaritan-tradition commentary)."""
        if self._sam_src_choice == 'tm':
            return self._build_tm_container(verses, fsize)
        if self._sam_src_choice == 'eyalk':
            return self._build_eyalk_container(verses, fsize)
        if self._sam_src_choice == 'tzdaka':
            return self._build_tzdaka_container(verses, fsize)
        return self._build_src_picker(verses, fsize)

    def _build_src_picker(self, verses, fsize):
        """The source-selection panel: a button per source that actually has
        content on the current verse(s)."""
        panel = self._src_panel_frame()
        title = Label(text=rtl('ממקור שומרון — בחר מקור'), font_name=FONT, font_size=sp(18),
                      bold=True, color=C_NAVY, size_hint_y=None, height=dp(34),
                      halign='center', valign='middle')
        title.bind(size=lambda i, s: setattr(i, 'text_size', s))
        panel.add_widget(title)
        vids = [v['id'] for v in verses]
        avail = []
        if get_tibat_marqe(vids):
            avail.append((rtl('תיבת מרקה'), 'tm'))
        if get_eyalk_commentary(vids):
            avail.append((rtl('מן המסורת השומרונית'), 'eyalk'))
        if get_tzdaka_commentary(vids):
            avail.append((rtl('פירוש צדקה אל-חכים'), 'tzdaka'))
        if not avail:
            msg = Label(text=rtl('אין מקור שומרוני זמין לפסוקים אלה'),
                        font_name=FONT, font_size=sp(15), color=C_MUTED,
                        size_hint_y=None, height=dp(46), halign='center', valign='middle')
            msg.bind(size=lambda i, s: setattr(i, 'text_size', s))
            panel.add_widget(msg)
            return panel
        for label, choice in avail:
            btn = HoverButton(text=label, font_name=FONT, font_size=sp(16),
                              background_color=C_NAVY, background_normal='', color=C_WHITE,
                              size_hint_y=None, height=dp(48))
            btn.bind(on_press=lambda _b, c=choice: self._select_sam_source(c))
            panel.add_widget(btn)
        return panel

    def _build_tzdaka_container(self, verses, fsize):
        """פירוש צדקה אל-חכים — the commentary section(s) linked to the current
        verse(s), each tagged with its reference and topic."""
        items = get_tzdaka_commentary([v['id'] for v in verses])
        panel = self._src_panel_frame()

        header = BoxLayout(size_hint_y=None, height=dp(34), spacing=dp(6))
        back = HoverButton(text=rtl('‹ מקורות'), font_name=FONT, font_size=sp(13),
                           background_color=C_ACCENT, background_normal='', color=C_WHITE,
                           size_hint_x=None, width=dp(110))
        back.bind(on_press=lambda *_: self._select_sam_source(None))
        title = Label(text=rtl('פירוש צדקה אל-חכים'), font_name=FONT, font_size=sp(17),
                      bold=True, color=C_NAVY, halign='center', valign='middle')
        title.bind(size=lambda i, s: setattr(i, 'text_size', s))
        header.add_widget(back)
        header.add_widget(title)
        panel.add_widget(header)

        if not items:
            msg = Label(text=rtl('אין פרשנות רלוונטית לפסוקים אלה'),
                        font_name=FONT, font_size=sp(15), color=C_MUTED,
                        size_hint_y=None, height=dp(46), halign='center', valign='middle')
            msg.bind(size=lambda i, s: setattr(i, 'text_size', s))
            panel.add_widget(msg)
            return panel

        for it in items:
            label = '  ·  '.join(p for p in (it['ref'], it['title']) if p)
            panel.add_widget(self._eyalk_card({'parsha': label, 'text': it['text']}, fsize))
        return panel

    def _build_eyalk_container(self, verses, fsize):
        """מן המסורת השומרונית — the commentary bullets linked to the current
        verse(s), in reading order, each tagged with its parsha."""
        items = get_eyalk_commentary([v['id'] for v in verses])
        panel = self._src_panel_frame()

        header = BoxLayout(size_hint_y=None, height=dp(34), spacing=dp(6))
        back = HoverButton(text=rtl('‹ מקורות'), font_name=FONT, font_size=sp(13),
                           background_color=C_ACCENT, background_normal='', color=C_WHITE,
                           size_hint_x=None, width=dp(110))
        back.bind(on_press=lambda *_: self._select_sam_source(None))
        title = Label(text=rtl('מן המסורת השומרונית'), font_name=FONT, font_size=sp(17),
                      bold=True, color=C_NAVY, halign='center', valign='middle')
        title.bind(size=lambda i, s: setattr(i, 'text_size', s))
        header.add_widget(back)
        header.add_widget(title)
        panel.add_widget(header)

        if not items:
            msg = Label(text=rtl('אין פרשנות רלוונטית לפסוקים אלה'),
                        font_name=FONT, font_size=sp(15), color=C_MUTED,
                        size_hint_y=None, height=dp(46), halign='center', valign='middle')
            msg.bind(size=lambda i, s: setattr(i, 'text_size', s))
            panel.add_widget(msg)
            return panel

        for it in items:
            panel.add_widget(self._eyalk_card(it, fsize))
        return panel

    def _eyalk_card(self, item, fsize):
        """One commentary bullet: small parsha tag + the explanation text."""
        card = BoxLayout(orientation='vertical', size_hint_y=None,
                         padding=(dp(6), dp(5)), spacing=dp(2))
        with card.canvas.before:
            Color(0.99, 0.99, 0.97, 1)
            _bg = RoundedRectangle(pos=card.pos, size=card.size, radius=[dp(8)])
            Color(*C_ACCENT[:3], 0.35)
            _bl = Line(width=1.0,
                       rounded_rectangle=[card.x, card.y, card.width, card.height, dp(8)])
        card.bind(pos=lambda i, v: (setattr(_bg, 'pos', i.pos), setattr(_bg, 'size', i.size),
                                    setattr(_bl, 'rounded_rectangle',
                                            [i.x, i.y, i.width, i.height, dp(8)])),
                  size=lambda i, v: (setattr(_bg, 'pos', i.pos), setattr(_bg, 'size', i.size),
                                     setattr(_bl, 'rounded_rectangle',
                                             [i.x, i.y, i.width, i.height, dp(8)])))
        head_h = 0
        if item['parsha']:
            head = Label(text=rtl(item['parsha']), font_name=FONT, font_size=sp(13),
                         bold=True, color=C_ACCENT, size_hint_y=None, height=dp(22),
                         halign='right', valign='middle')
            head.bind(size=lambda i, s: setattr(i, 'text_size', s))
            card.add_widget(head)
            head_h = dp(22)

        rewrap = self._plain_rewrap(item['text'], fsize)
        body = Label(text='', font_name=FONT, font_size=fsize, color=C_DARK,
                     halign='right', valign='top', size_hint_y=None, markup=False)
        def _on_w(i, w):
            avail = w - dp(8)
            i.text_size = (avail, None)
            i.text = rewrap(avail - dp(8))
        body.bind(width=_on_w)
        body.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(6)))
        card.add_widget(body)

        def _ch(*_):
            card.height = head_h + body.height + dp(12)
        body.bind(height=_ch)
        card.height = dp(80)
        return card

    def _build_tm_container(self, verses, fsize):
        """Lower panel for 'ממקור שומרון': shows the Tibåt Mårqe passages relevant
        to the current verse(s). The list shows each passage's source text (the
        מלל); tapping one opens its translation in two adjacent panels."""
        items = get_tibat_marqe([v['id'] for v in verses])

        # GridLayout(cols=1) so the panel height tracks its children automatically
        panel = GridLayout(cols=1, size_hint_y=None, padding=(dp(8), dp(8)), spacing=dp(6))
        panel.bind(minimum_height=panel.setter('height'))
        with panel.canvas.before:
            Color(0.97, 0.97, 0.95, 1)
            _rr = RoundedRectangle(pos=panel.pos, size=panel.size, radius=[dp(12)])
            Color(*C_NAVY[:3], 0.55)
            _ln = Line(width=1.3,
                       rounded_rectangle=[panel.x, panel.y, panel.width, panel.height, dp(12)])
        def _sg(inst, val):
            _rr.pos = inst.pos;  _rr.size = inst.size
            _ln.rounded_rectangle = [inst.x, inst.y, inst.width, inst.height, dp(12)]
        panel.bind(pos=_sg, size=_sg)

        thead = BoxLayout(size_hint_y=None, height=dp(34), spacing=dp(6))
        tback = HoverButton(text=rtl('‹ מקורות'), font_name=FONT, font_size=sp(13),
                            background_color=C_ACCENT, background_normal='', color=C_WHITE,
                            size_hint_x=None, width=dp(110))
        tback.bind(on_press=lambda *_: self._select_sam_source(None))
        title = Label(text=rtl('תיבת מרקה'), font_name=FONT, font_size=sp(18),
                      bold=True, color=C_NAVY, halign='center', valign='middle')
        title.bind(size=lambda i, s: setattr(i, 'text_size', s))
        thead.add_widget(tback)
        thead.add_widget(title)
        panel.add_widget(thead)

        if not items:
            msg = Label(text=rtl('אין קטע רלוונטי מתיבת מרקה לפסוקים אלה'),
                        font_name=FONT, font_size=sp(15), color=C_MUTED,
                        size_hint_y=None, height=dp(46), halign='center', valign='middle')
            msg.bind(size=lambda i, s: setattr(i, 'text_size', s))
            panel.add_widget(msg)
            return panel

        cur = next((it for it in items
                    if (it['book'], it['section']) == self._tm_sel), None)

        if cur is None:
            hint = Label(text=rtl('הקש על קטע להצגת התרגום'), font_name=FONT,
                         font_size=sp(13), color=C_ACCENT, size_hint_y=None,
                         height=dp(22), halign='center', valign='middle')
            hint.bind(size=lambda i, s: setattr(i, 'text_size', s))
            panel.add_widget(hint)
            for it in items:
                panel.add_widget(self._tm_source_card(it, fsize))
        else:
            header = BoxLayout(size_hint_y=None, height=dp(34), spacing=dp(6))
            back = HoverButton(text=rtl('‹ חזרה'), font_name=FONT, font_size=sp(13),
                               background_color=C_ACCENT, background_normal='', color=C_WHITE,
                               size_hint_x=None, width=dp(96))
            back.bind(on_press=lambda *_: self._select_tm_section(None))
            name_lbl = Label(text=rtl('%s (%s)' % (cur['label'], cur['book_title'])),
                             font_name=FONT, font_size=sp(16), bold=True, color=C_NAVY,
                             halign='center', valign='middle')
            name_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
            header.add_widget(back)
            header.add_widget(name_lbl)
            panel.add_widget(header)

            he_rewrap = (self._plain_rewrap(cur['hebrew'], fsize) if cur['hebrew']
                         else self._static_rewrap(rtl('התרגום העברי בהכנה')))
            ar_rewrap = (self._plain_rewrap(cur['aramaic'], fsize) if cur['aramaic']
                         else self._static_rewrap(rtl('המקור הארמי אינו זמין')))
            he_panel = self._build_compare_panel('תרגום לעברית', he_rewrap, False, False, fsize)
            ar_panel = self._build_compare_panel('מקור ארמי', ar_rewrap, False, False, fsize)
            # right = Aramaic source, left = Hebrew translation
            panel.add_widget(self._equal_height_pair(he_panel, ar_panel))
        return panel

    def _tm_source_card(self, item, fsize):
        """One tappable card showing a Tibåt Mårqe passage's source text (Aramaic
        when available, else the English text). Tapping opens its translation."""
        # preview the Aramaic source (the מלל); fall back to the Hebrew
        # translation when no Aramaic was extracted. Never show English here.
        source = item['aramaic'] or item['hebrew']
        key    = (item['book'], item['section'])

        card = BoxLayout(orientation='vertical', size_hint_y=None,
                         padding=(dp(6), dp(5)), spacing=dp(2))
        with card.canvas.before:
            Color(0.99, 0.99, 0.97, 1)
            _bg = RoundedRectangle(pos=card.pos, size=card.size, radius=[dp(8)])
            Color(*C_ACCENT[:3], 0.35)
            _bl = Line(width=1.0,
                       rounded_rectangle=[card.x, card.y, card.width, card.height, dp(8)])
        card.bind(pos=lambda i, v: (setattr(_bg, 'pos', i.pos), setattr(_bg, 'size', i.size),
                                    setattr(_bl, 'rounded_rectangle',
                                            [i.x, i.y, i.width, i.height, dp(8)])),
                  size=lambda i, v: (setattr(_bg, 'pos', i.pos), setattr(_bg, 'size', i.size),
                                     setattr(_bl, 'rounded_rectangle',
                                             [i.x, i.y, i.width, i.height, dp(8)])))

        head = TapLabel(text=rtl('%s  ⟵ הקש לתרגום' % item['label']), font_name=FONT,
                        font_size=sp(14), bold=True, color=C_NAVY,
                        size_hint_y=None, height=dp(24), halign='right', valign='middle')
        head.bind(size=lambda i, s: setattr(i, 'text_size', s))
        head.bind(on_release=lambda *_: self._select_tm_section(key))
        card.add_widget(head)

        rewrap = (self._plain_rewrap(source, fsize) if source
                  else self._static_rewrap(rtl('טקסט המקור אינו זמין')))
        body = TapLabel(text='', font_name=FONT, font_size=fsize, color=C_DARK,
                        halign='right', valign='top',
                        size_hint_y=None, markup=False)
        def _on_w(i, w):
            avail = w - dp(8)
            i.text_size = (avail, None)
            i.text = rewrap(avail - dp(8))
        body.bind(width=_on_w)
        body.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(6)))
        body.bind(on_release=lambda *_: self._select_tm_section(key))
        card.add_widget(body)

        def _ch(*_):
            card.height = dp(24) + body.height + dp(12)
        body.bind(height=_ch)
        card.height = dp(80)
        return card

    def _add_samaritan_src_panels(self, verses, fsize):
        self.list_layout.add_widget(self._build_samaritan_src_container(verses, fsize))

    def _add_english_header(self):
        """Source-book credit shown atop the English translation pages."""
        lbl = Label(
            text=('[b]The Samaritan Pentateuch[/b]\n'
                  'An English Translation with a Parallel Annotated Hebrew Text\n'
                  'Moshe Florentin and Abraham Tal'),
            font_size=sp(13), color=C_NAVY, markup=True,
            halign='center', valign='middle', size_hint_y=None,
        )
        lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w, None)))
        lbl.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(10)))
        self.list_layout.add_widget(lbl)

    def _build_dict_panel(self, verses):
        app       = App.get_running_app()
        aram_mode = getattr(app, '_aramaic_mode', False)
        online    = getattr(self, '_online_dict_mode', False)
        verse_ids = [v['id'] for v in verses]
        dict_map  = get_verse_dictionary(verse_ids)

        DICT_MAX_H = dp(440) if online else dp(260)
        ROW_H      = dp(28)

        # Outer frame (rounded border + background)
        panel = BoxLayout(orientation='vertical', size_hint_y=None,
                          padding=(dp(8), dp(8)), spacing=dp(4))
        with panel.canvas.before:
            Color(0.96, 0.96, 0.92, 1)
            _rr = RoundedRectangle(pos=panel.pos, size=panel.size, radius=[dp(12)])
            Color(*C_NAVY[:3], 0.45)
            _ln = Line(width=1.2,
                       rounded_rectangle=[panel.x, panel.y, panel.width, panel.height, dp(12)])
        def _sg(inst, val):
            _rr.pos  = inst.pos;  _rr.size = inst.size
            _ln.rounded_rectangle = [inst.x, inst.y, inst.width, inst.height, dp(12)]
        panel.bind(pos=_sg, size=_sg)

        title_lbl = Label(
            text=rtl('מילון מילים'), font_name=FONT, font_size=sp(17),
            bold=True, color=C_NAVY, size_hint_y=None, height=dp(32),
            halign='center', valign='middle',
        )
        title_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        panel.add_widget(title_lbl)

        hint_lbl = Label(
            text=rtl('הקש על מילה לתרגום מתוך המילון של א. טל'), font_name=FONT,
            font_size=sp(12), color=C_MUTED, size_hint_y=None, height=dp(20),
            halign='center', valign='middle')
        hint_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        panel.add_widget(hint_lbl)

        # Checkbox: pull each word's definition from free online dictionaries
        cb_row = BoxLayout(size_hint_y=None, height=dp(30), spacing=dp(6))
        cb_lbl = Label(text=rtl('הצג תוצאות ממילונים ברשת'), font_name=FONT,
                       font_size=sp(14), color=C_NAVY, halign='right', valign='middle')
        cb_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        cb = CheckBox(active=online, size_hint_x=None, width=dp(30),
                      color=C_NAVY)
        cb.bind(active=self._on_online_dict_toggle)
        cb_row.add_widget(cb_lbl)
        cb_row.add_widget(cb)
        panel.add_widget(cb_row)

        # Inner grid inside a ScrollView so rows stay bounded and scrollable
        inner = GridLayout(cols=1, size_hint=(1, None), spacing=dp(2))
        inner.bind(minimum_height=inner.setter('height'))

        rows_added = 0
        pending = []                      # (hebrew_word, res_box) for bulk fetch
        for v in verses:
            for aram, heb in dict_map.get(v['id'], []):
                if aram_mode:
                    word_text = rtl(f'{aram}  ›  {heb}')
                else:
                    if heb == aram:
                        continue
                    word_text = rtl(f'{heb}----{aram}----{heb}')

                # vertical container so online results can sit under the word
                wb = GridLayout(cols=1, size_hint_y=None, spacing=dp(2))
                wb.bind(minimum_height=wb.setter('height'))

                row = BoxLayout(size_hint_y=None, height=ROW_H, spacing=dp(6))
                lbl = TapLabel(text=word_text, font_name=FONT, font_size=sp(19),
                               color=C_ACCENT, halign='right', valign='middle',
                               size_hint_x=1, shorten=True, shorten_from='left')
                lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
                lbl.bind(on_release=lambda _, w=aram: self._show_tal_dict(w))
                row.add_widget(lbl)
                wb.add_widget(row)

                if online:
                    res_box = GridLayout(cols=1, size_hint_y=None, spacing=dp(2),
                                         padding=(dp(12), 0, dp(12), dp(4)))
                    res_box.bind(minimum_height=res_box.setter('height'))
                    res_box.add_widget(self._dict_note('טוען מהמילון…', C_MUTED))
                    wb.add_widget(res_box)
                    pending.append((heb, res_box))

                inner.add_widget(wb)
                rows_added += 1

        if online and pending:
            self._fetch_online_dict_bulk(pending)

        if rows_added == 0:
            inner.add_widget(Label(text=rtl('אין מילון זמין לפרק זה'), font_name=FONT,
                                   font_size=sp(15), color=C_MUTED,
                                   size_hint_y=None, height=ROW_H,
                                   halign='center', valign='middle'))

        sv = ScrollView(size_hint=(1, None),
                        do_scroll_x=False, do_scroll_y=True,
                        bar_width=dp(6),
                        bar_color=(*C_NAVY[:3], 0.7),
                        bar_inactive_color=(*C_NAVY[:3], 0.3),
                        scroll_type=['bars', 'content'])
        sv.add_widget(inner)
        panel.add_widget(sv)

        # heights follow content (results arrive asynchronously when online)
        def _resize(*_):
            sv.height = min(inner.height, DICT_MAX_H)
            panel.height = dp(32) + dp(20) + dp(30) + sv.height + dp(24)
        inner.bind(height=_resize)
        _resize()
        return panel

    def _dict_note(self, text, color):
        """Small single-line note label used inside the dictionary panel."""
        lbl = Label(text=rtl(text), font_name=FONT, font_size=sp(13),
                    color=color, size_hint_y=None, height=dp(22),
                    halign='right', valign='middle')
        lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        return lbl

    def _dict_source_label(self, logical_text):
        """Bold header crediting all sources; wraps downward in logical order so
        mixed Hebrew + Latin (site domains) stay correctly ordered per line."""
        rewrap = self._plain_rewrap(logical_text, sp(12))
        lbl = Label(text='', font_name=FONT, font_size=sp(12), color=C_ACCENT,
                    bold=True, halign='right', valign='top',
                    size_hint_y=None, markup=False)
        def _on_w(i, w):
            i.text_size = (w, None)
            i.text = rewrap(w - dp(8))
        lbl.bind(width=_on_w)
        lbl.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(4)))
        return lbl

    def _dict_body_label(self, logical_text):
        """Wrapping Hebrew body whose lines break downward (logical-order wrap,
        matching the commentary panel), and whose height tracks the text."""
        rewrap = self._plain_rewrap(logical_text, sp(15))
        lbl = Label(text='', font_name=FONT, font_size=sp(15), color=C_DARK,
                    halign='right', valign='top', size_hint_y=None, markup=False)
        def _on_w(i, w):
            i.text_size = (w, None)
            i.text = rewrap(w - dp(8))
        lbl.bind(width=_on_w)
        lbl.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(4)))
        return lbl

    def _on_online_dict_toggle(self, checkbox, value):
        self._online_dict_mode = value
        if self._last_render:
            self._last_render()

    def _ensure_dict_pool(self):
        if self._dict_pool is None:
            from concurrent.futures import ThreadPoolExecutor
            self._dict_pool = ThreadPoolExecutor(max_workers=4)
        return self._dict_pool

    def _fetch_online_dict_bulk(self, pending):
        """Look up every word of the panel in ONE background bulk request (a
        couple of MediaWiki calls for the whole chapter instead of one per word,
        which avoids rate limits), then fill each row's box."""
        from app.services import hebrew_dict
        words = [w for w, _ in pending]
        fut = self._ensure_dict_pool().submit(hebrew_dict.lookup_many, words)
        def _done(f):
            try:
                results = f.result()
            except Exception:
                results = {}
            Clock.schedule_once(
                lambda dt: self._fill_online_dict_bulk(pending, results), 0)
        fut.add_done_callback(_done)

    def _fill_online_dict_bulk(self, pending, results):
        for word, res_box in pending:
            self._fill_online_dict(res_box, results.get(word))

    def _fill_online_dict(self, res_box, payload):
        res_box.clear_widgets()
        if not payload or not payload[0]:
            res_box.add_widget(self._dict_note('לא נמצאו תוצאות ברשת', C_MUTED))
            return
        summary, sources = payload
        credit = '  ·  '.join(f'{name} ({site})' for name, site in sources)
        res_box.add_widget(self._dict_source_label('מקורות: ' + credit))
        res_box.add_widget(self._dict_body_label(summary))

    def _show_tal_dict(self, word):
        """Popup with the entry/entries for an Aramaic word from Tal's dictionary."""
        from kivy.uix.popup import Popup
        from app.services.database import lookup_tal_dictionary

        results = lookup_tal_dictionary(word)

        def wrap_label(logical_text, color, size, bold=False):
            """Self-contained wrapping label (logical-order RTL wrap, height
            tracks text) — depends only on the stable _plain_rewrap helper."""
            rewrap = self._plain_rewrap(logical_text, size)
            lbl = Label(text='', font_name=FONT, font_size=size, color=color,
                        bold=bold, halign='right', valign='top',
                        size_hint_y=None, markup=False)
            def _on_w(i, w):
                i.text_size = (w - dp(8), None)
                i.text = rewrap(max(w - dp(8), dp(10)))
            lbl.bind(width=_on_w)
            lbl.bind(texture_size=lambda i, ts: setattr(i, 'height', ts[1] + dp(4)))
            return lbl

        grid = GridLayout(cols=1, size_hint_y=None, spacing=dp(6),
                          padding=(dp(6), dp(6)))
        grid.bind(minimum_height=grid.setter('height'))
        if not results:
            grid.add_widget(wrap_label(
                'לא נמצא ערך עבור מילה זו במילון של טל.', C_MUTED, sp(15)))
        else:
            for i, r in enumerate(results):
                head = r['lemma'] or word
                if r['pos']:
                    head += f'  ·  {r["pos"]}'
                grid.add_widget(wrap_label(head, C_NAVY, sp(19), bold=True))
                if r['gloss_en']:
                    grid.add_widget(wrap_label(r['gloss_en'], C_ACCENT, sp(15)))
                note = (r['notes'] or '').strip()
                if note:
                    grid.add_widget(wrap_label(note[:600], C_DARK, sp(14)))
                for q, ref in r['citations']:
                    grid.add_widget(wrap_label(f'{q}  —  {ref}', C_MUTED, sp(13)))
                if r['page']:
                    grid.add_widget(self._dict_note(f'(עמ׳ {r["page"]} במילון)', C_MUTED))
                if i < len(results) - 1:
                    sep = Widget(size_hint_y=None, height=dp(1))
                    with sep.canvas:
                        Color(*C_NAVY[:3], 0.25)
                        _r = Rectangle(pos=sep.pos, size=sep.size)
                    sep.bind(pos=lambda s, *_: setattr(_r, 'pos', s.pos),
                             size=lambda s, *_: setattr(_r, 'size', s.size))
                    grid.add_widget(sep)

        sv = ScrollView(do_scroll_x=False, do_scroll_y=True, bar_width=dp(6),
                        bar_color=(*C_NAVY[:3], 0.7),
                        bar_inactive_color=(*C_NAVY[:3], 0.3),
                        scroll_type=['bars', 'content'])
        sv.add_widget(grid)

        body = BoxLayout(orientation='vertical', spacing=dp(6))
        body.add_widget(sv)
        close_btn = RoundedHoverButton(
            text=rtl('סגור'), font_name=FONT, font_size=sp(14),
            size_hint_y=None, height=dp(40), background_color=C_NAVY)
        body.add_widget(close_btn)

        popup = Popup(title=word, content=body, size_hint=(0.92, 0.85),
                      title_font=FONT, title_align='center')
        close_btn.bind(on_press=popup.dismiss)
        popup.open()

    def _add_dict_panel(self, verses):
        self.list_layout.add_widget(self._build_dict_panel(verses))

    def _add_with_dict(self, top_widget, verses):
        """Wrap top_widget and dict panel in a vertical container and add to list_layout."""
        dict_panel = self._build_dict_panel(verses)
        wrapper = GridLayout(cols=1, size_hint_y=None, spacing=dp(6),
                             padding=(0, dp(4)))
        wrapper.bind(minimum_height=wrapper.setter('height'))
        wrapper.add_widget(top_widget)
        wrapper.add_widget(dict_panel)
        self.list_layout.add_widget(wrapper)

    def _filter_verse(self, verse_id):
        self._verse_filter = verse_id
        if self._last_render:
            self._last_render()

    def _add_verse_num_strip(self, all_verses):
        strip = BoxLayout(orientation='horizontal', size_hint_y=None, height=dp(36),
                          spacing=dp(4), padding=(dp(4), 0))
        if self._verse_filter is not None:
            clear_btn = RoundedHoverButton(
                text=rtl('נקה סינון'), font_name=FONT, font_size=sp(11),
                size_hint=(None, 1), width=dp(44),
                background_color=(0.75, 0.22, 0.18, 1),
            )
            clear_btn.bind(on_press=lambda *_: self._filter_verse(None))
            strip.add_widget(clear_btn)
        strip.add_widget(Widget(size_hint_x=1))
        for v in all_verses:
            active = (self._verse_filter == v['id'])
            bg = C_ACCENT if active else (0.76, 0.80, 0.94, 1)
            btn = RoundedHoverButton(
                text=str(v['number']), font_name=FONT, font_size=sp(12),
                size_hint=(None, 1), width=dp(30), background_color=bg,
            )
            btn.bind(on_press=lambda _, vid=v['id']: self._filter_verse(vid))
            strip.add_widget(btn)
        self.list_layout.add_widget(strip)

    def _build_verse_rows(self, verses, fsize):
        app = App.get_running_app()
        use_eng = getattr(app, '_english_mode', False)
        container = GridLayout(cols=1, size_hint_y=None, spacing=dp(2))
        container.bind(minimum_height=container.setter('height'))
        for v in verses:
            # plain view (no Masoretic alignment): collapse empty verses so they
            # don't open a gap between lines. Numbering/data are untouched — the
            # verse just isn't drawn here (the compare view still shows it).
            if not (v['text'] or '').strip():
                continue
            ltr    = use_eng
            halign = 'left' if ltr else 'right'
            row = BoxLayout(orientation='horizontal', size_hint_y=None, height=dp(40),
                            spacing=dp(4), padding=(dp(4), dp(2)))
            if use_eng:
                eng = v['english'] if v['english'] else f'[verse {v["number"]}]'
                text_lbl = Label(text=eng, font_name=FONT, font_size=fsize, color=C_DARK,
                                 halign=halign, valign='top', size_hint=(1, None), height=dp(30),
                                 markup=False, padding=(dp(2), dp(2)))
                text_lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w, None)))
            else:
                # RTL: wrap in logical order so long lines continue *below*, then
                # reorder each line to visual order. Re-wrap whenever width changes.
                use_sam = getattr(app, '_font_mode', 'Hebrew') == 'Samaritan'
                text_lbl = Label(text='', font_name=FONT, font_size=fsize, color=C_DARK,
                                 halign=halign, valign='top', size_hint=(1, None), height=dp(30),
                                 markup=use_sam, padding=(dp(2), dp(2)))

                def _rewrap(i, w, logical=v['text'], sam=use_sam, fs=fsize):
                    i.text_size = (w, None)
                    avail = w - dp(8)
                    if avail < dp(20):          # not laid out yet → no wrapping
                        avail = 10 ** 6
                    i.text = _wrap_rtl(logical, sam, fs, avail)
                text_lbl.bind(width=_rewrap)
            text_lbl.bind(texture_size=lambda i, ts, r=row: setattr(r, 'height', max(ts[1] + dp(10), dp(36))))
            active = (self._verse_filter == v['id'])
            num_btn = RoundedHoverButton(
                text=str(v['number']), font_name=FONT, font_size=sp(12),
                size_hint=(None, None), width=dp(30), height=dp(26),
                background_color=C_ACCENT if active else (0.76, 0.80, 0.94, 1),
            )
            num_btn.bind(on_press=lambda _, vid=v['id']: self._filter_verse(vid))
            if self._verse_filter is not None:
                clear_btn = RoundedHoverButton(
                    text=rtl('נקה סינון'), font_name=FONT, font_size=sp(11),
                    size_hint=(None, None), width=dp(40), height=dp(26),
                    background_color=(0.75, 0.22, 0.18, 1),
                )
                clear_btn.bind(on_press=lambda *_: self._filter_verse(None))
                if ltr:
                    row.add_widget(num_btn)
                    row.add_widget(text_lbl)
                    row.add_widget(clear_btn)
                else:
                    row.add_widget(clear_btn)
                    row.add_widget(text_lbl)
                    row.add_widget(num_btn)
            else:
                if ltr:
                    row.add_widget(num_btn)
                    row.add_widget(text_lbl)
                else:
                    row.add_widget(text_lbl)
                    row.add_widget(num_btn)
            container.add_widget(row)
        return container

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
            if self._mode == 'samaritan':
                n_portions = len(get_portions(row['id'], mode='samaritan'))
                n_chapters = len(get_sam_chapters(row['id']))
                label = rtl(f'{row["name"]}  ({n_portions}-{n_chapters})')
            else:
                label = rtl(row['name'])
            def cb(_, r=row): self._show_portions(r['id'], r['name'])
            btn = IconHoverButton(
                icon_path=os.path.join(_ICONS, 'icon_book_dark.png'),
                text=label, font_name=FONT, font_size=sp(21),
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
        self._spread_visible(True)

    def _on_spread(self, *_):
        cur = getattr(self, '_current', None)
        if cur and cur[0] == 'portions':
            self._show_chapter_spread(cur[1], cur[2])

    def _portion_for_chapter(self, num):
        """First portion (in the current division) whose chapter range holds `num`."""
        for p in self._portions:
            if p['start_ch'] <= num <= p['end_ch']:
                return (p['id'], p['name'])
        return (None, '')

    def _show_chapter_spread(self, book_id, book_name):
        """All chapters of the book as a 15-per-row grid; tap one to open it."""
        self._state.append(('portions', book_id, book_name))
        self._clear()
        self._set_breadcrumb([
            (book_name, lambda *_, bid=book_id, bn=book_name: self._show_portions(bid, bn)),
            ('פריסת פרקים', None),
        ])
        self._current = ('spread', book_id, book_name)
        self._nav_visible(False)
        self._size_bar_visible(False)
        self._set_portion_labels()
        self.list_layout.add_widget(
            _rtl_lbl('בחר פרק', font_size=sp(14), color=C_MUTED, height=30))
        grid = GridLayout(cols=15, spacing=dp(4), size_hint_y=None, padding=(dp(2), dp(4)))
        grid.bind(minimum_height=grid.setter('height'))
        if self._mode == 'samaritan':
            ch2port = {}
            for p in self._portions:
                for sc in get_sam_chapters_in_portion(p['id']):
                    ch2port.setdefault(sc['id'], (p['id'], p['name']))
            rows = get_sam_chapters(book_id)
        else:
            rows = get_chapters(book_id=book_id)
        for row in rows:
            num, cid = row['number'], row['id']
            if self._mode == 'samaritan':
                pid, pn = ch2port.get(cid, (None, ''))
                def cb(_, cid=cid, cnum=num, pid=pid, pn=pn, bid=book_id, bn=book_name):
                    self._cur_pid = pid
                    self._current = ('sam_portion', bid, pid, bn, pn)
                    self._show_sam_verses(cid, bn, pn, cnum)
            else:
                pid, pn = self._portion_for_chapter(num)
                def cb(_, cid=cid, cnum=num, pid=pid, pn=pn, bid=book_id, bn=book_name):
                    self._cur_pid = pid
                    self._current = ('chapters', bid, pid, bn, pn)
                    self._show_verses(cid, bn, pn, cnum, portion_id=pid)
            b = RoundedHoverButton(text=str(num), font_name=FONT, font_size=sp(13),
                                   size_hint_y=None, height=dp(40))
            b.bind(on_press=cb)
            grid.add_widget(b)
        self.list_layout.add_widget(grid)

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

        all_verses = list(get_verses(chapter_id, portion_id=portion_id))
        if not all_verses:
            self.list_layout.add_widget(_rtl_lbl('אין פסוקים', color=C_MUTED, height=40))
            return
        verses = [v for v in all_verses if v['id'] == self._verse_filter] if self._verse_filter else all_verses
        app = App.get_running_app()
        use_eng = getattr(app, '_english_mode', False)
        use_sam = getattr(app, '_font_mode', 'Hebrew') == 'Samaritan'
        fsize = sp(14) + self._font_size_offset if use_sam else sp(20) + self._font_size_offset
        if self._commentary_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            self.list_layout.add_widget(self._build_verse_rows(verses, fsize))
            self._add_commentary_panels(verses, fsize)
        elif self._samaritan_src_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            self.list_layout.add_widget(self._build_verse_rows(verses, fsize))
            self._add_samaritan_src_panels(verses, fsize)
        elif self._interpret_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            if self._dict_mode:
                top = self._build_interpret_container(verses, fsize)
                self._add_with_dict(top, verses)
            else:
                self._add_interpret_panels(verses, fsize)
        elif self._aramaic_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            if self._dict_mode:
                top = self._build_aramaic_container(verses, fsize)
                self._add_with_dict(top, verses)
            else:
                self._add_aramaic_panels(verses, fsize)
        elif self._arabic_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            if self._dict_mode:
                top = self._build_arabic_container(verses, fsize)
                self._add_with_dict(top, verses)
            else:
                self._add_arabic_panels(verses, fsize)
        elif self._compare_mode:
            self._add_verse_num_strip(all_verses)
            self._add_compare_panels(verses, fsize, use_eng)
        else:
            if use_eng:
                self._add_english_header()
            container = self._build_verse_rows(verses, fsize)
            if self._dict_mode:
                self._add_with_dict(container, verses)
            else:
                self.list_layout.add_widget(container)

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

        all_verses = list(get_verses_by_sam_ch(sam_ch_id))
        if not all_verses:
            self.list_layout.add_widget(_rtl_lbl('אין פסוקים', color=C_MUTED, height=40))
            return
        verses = [v for v in all_verses if v['id'] == self._verse_filter] if self._verse_filter else all_verses
        app = App.get_running_app()
        use_eng = getattr(app, '_english_mode', False)
        use_sam = getattr(app, '_font_mode', 'Hebrew') == 'Samaritan'
        fsize = sp(14) + self._font_size_offset if use_sam else sp(20) + self._font_size_offset
        if self._commentary_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            self.list_layout.add_widget(self._build_verse_rows(verses, fsize))
            self._add_commentary_panels(verses, fsize)
        elif self._samaritan_src_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            self.list_layout.add_widget(self._build_verse_rows(verses, fsize))
            self._add_samaritan_src_panels(verses, fsize)
        elif self._interpret_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            if self._dict_mode:
                top = self._build_interpret_container(verses, fsize)
                self._add_with_dict(top, verses)
            else:
                self._add_interpret_panels(verses, fsize)
        elif self._aramaic_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            if self._dict_mode:
                top = self._build_aramaic_container(verses, fsize)
                self._add_with_dict(top, verses)
            else:
                self._add_aramaic_panels(verses, fsize)
        elif self._arabic_mode and not use_sam:
            self._add_verse_num_strip(all_verses)
            if self._dict_mode:
                top = self._build_arabic_container(verses, fsize)
                self._add_with_dict(top, verses)
            else:
                self._add_arabic_panels(verses, fsize)
        elif self._compare_mode:
            self._add_verse_num_strip(all_verses)
            self._add_compare_panels(verses, fsize, use_eng)
        else:
            if use_eng:
                self._add_english_header()
            container = self._build_verse_rows(verses, fsize)
            if self._dict_mode:
                self._add_with_dict(container, verses)
            else:
                self.list_layout.add_widget(container)

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

    def _portion_index(self):
        """(index of current portion in self._portions, total portions)."""
        if not self._portions or self._ch_portion_id is None:
            return None, 0
        ids = [p['id'] for p in self._portions]
        return (ids.index(self._ch_portion_id) if self._ch_portion_id in ids else None), len(ids)

    def _update_ch_nav_state(self):
        pidx, n = self._portion_index()
        first_portion = (pidx is None) or (pidx <= 0)
        last_portion  = (pidx is None) or (pidx >= n - 1)
        self.prev_btn.disabled = (self._ch_idx <= 0) and first_portion
        self.next_btn.disabled = (self._ch_idx >= len(self._ch_list) - 1) and last_portion

    def _render_current_chapter(self, cid, cnum):
        if self._ch_mode == 'standard':
            self._render_verses(cid, self._ch_book_name, self._ch_portion_name,
                                cnum, self._ch_portion_id)
        else:
            self._render_sam_verses(cid, self._ch_book_name, self._ch_portion_name, cnum)

    def _jump_chapter(self, delta):
        self._verse_filter = None
        new_idx = self._ch_idx + delta
        if 0 <= new_idx < len(self._ch_list):
            self._ch_idx = new_idx
            cid, cnum = self._ch_list[new_idx]
            self._render_current_chapter(cid, cnum)
        else:
            self._cross_portion(delta)

    def _cross_portion(self, delta):
        """When stepping past a portion's first/last chapter, continue into the
        adjacent portion's chapters and refresh the breadcrumb accordingly."""
        pidx, n = self._portion_index()
        if pidx is None:
            return
        npidx = pidx + delta
        if not (0 <= npidx < n):
            return
        p = self._portions[npidx]
        if self._ch_mode == 'standard':
            rows = list(get_chapters(portion_id=p['id']))
        else:
            rows = list(get_sam_chapters_in_portion(p['id']))
        ch_list = [(r['id'], r['number']) for r in rows]
        if not ch_list:
            return
        self._ch_list         = ch_list
        self._ch_idx          = 0 if delta > 0 else len(ch_list) - 1
        self._cur_pid         = p['id']
        self._ch_portion_id   = p['id']
        self._ch_portion_name = p['name']
        if self._state:
            lvl = 'chapters' if self._ch_mode == 'standard' else 'sam_portion'
            self._state[-1] = (lvl, self._ch_book_id, p['id'], self._ch_book_name, p['name'])
        cid, cnum = self._ch_list[self._ch_idx]
        self._render_current_chapter(cid, cnum)

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
                                chapter_id, chapter_num, verse_id=None):
        """Navigate to a chapter (Jewish division) focused on a verse, with Back
        returning to search results."""
        self._mode            = 'standard'
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
        self._verse_filter    = verse_id
        self.back_btn.disabled = False
        self._render_verses(chapter_id, book_name, portion_name, chapter_num, portion_id)

    def show_sam_chapter_for_search(self, book_id, book_name, sam_portion_id, sam_portion_name,
                                    sam_ch_id, sam_ch_num, verse_id=None):
        """Navigate to a Samaritan chapter focused on a verse, Back -> search."""
        self._mode            = 'samaritan'
        self._portions        = list(get_portions(book_id, mode='samaritan'))
        self._cur_pid         = sam_portion_id
        self._current         = ('sam_portion', book_id, sam_portion_id, book_name, sam_portion_name)
        self._state           = []
        self._search_return   = True
        sam_rows = list(get_sam_chapters_in_portion(sam_portion_id))
        self._ch_list         = [(r['id'], r['number']) for r in sam_rows]
        self._ch_idx          = next((i for i, (cid, _) in enumerate(self._ch_list) if cid == sam_ch_id), 0)
        self._ch_book_id      = book_id
        self._ch_book_name    = book_name
        self._ch_portion_name = sam_portion_name
        self._ch_portion_id   = sam_portion_id
        self._ch_mode         = 'samaritan'
        self._verse_filter    = verse_id
        self.back_btn.disabled = False
        self._render_sam_verses(sam_ch_id, book_name, sam_portion_name, sam_ch_num)

    def _go_back(self, *_):
        if self._verse_filter is not None:
            self._verse_filter = None
            if self._last_render:
                self._last_render()
            return
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
