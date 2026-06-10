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
from app.services.database import search_verses
from app.services.rtl import rtl
from app.widgets import HoverButton

FONT    = 'Hebrew'
C_DARK  = (0.08, 0.08, 0.08, 1)
C_BLUE  = (0.18, 0.38, 0.72, 1)
C_MUTED = (0.45, 0.45, 0.55, 1)
C_WHITE = (1, 1, 1, 1)


def _mark_query(verse_text, query):
    """Return rtl-processed verse text with the matched query highlighted via markup."""
    visual = rtl(verse_text)
    idx = visual.find(query)
    if idx < 0:
        return visual
    before  = visual[:idx]
    matched = visual[idx:idx + len(query)]
    after   = visual[idx + len(query):]
    return f'{before}[color=c49a00][b]{matched}[/b][/color]{after}'


class SearchScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._exact = False
        self._build()

    def _build(self):
        layout = BoxLayout(orientation='vertical', spacing=dp(6), padding=dp(10))

        bar = BoxLayout(size_hint_y=None, height=dp(50), spacing=dp(6))
        self.input = TextInput(
            hint_text='חפש מילה',
            multiline=False,
            font_name=FONT,
            font_size=sp(18),
            write_tab=False,
            foreground_color=C_DARK,
            hint_text_color=C_MUTED,
            base_direction='rtl',
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

        # exact-search checkbox row
        flag_row = BoxLayout(size_hint_y=None, height=dp(36), spacing=dp(6))
        flag_row.add_widget(Widget())  # spacer pushes checkbox to the right
        self.exact_lbl = Label(
            text=rtl('חיפוש מדויק'),
            font_name=FONT, font_size=sp(17),
            color=C_BLUE, size_hint_x=None, width=dp(140),
            halign='right', valign='middle',
        )
        self.exact_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        self.exact_cb = CheckBox(
            size_hint_x=None, width=dp(36),
            color=C_BLUE,
        )
        self.exact_cb.bind(active=self._on_exact_toggle)
        flag_row.add_widget(self.exact_lbl)
        flag_row.add_widget(self.exact_cb)
        layout.add_widget(flag_row)

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

    def _on_exact_toggle(self, cb, value):
        self._exact = value

    def _do_search(self, *_):
        query = self.input.text.strip()
        if not query:
            return
        self.results.clear_widgets()
        self.scroll.scroll_y = 1
        try:
            rows = search_verses(query, exact=self._exact)
        except Exception as e:
            self.status.text = rtl(f'שגיאה: {e}')
            return

        self.status.text = rtl(f'נמצאו {len(rows)} תוצאות')

        for row in rows:
            loc = (f'{row["book_name"]}  ›  '
                   f'{row["portion_name"] or ""}  ›  '
                   f'פרק {row["chapter_num"]}  פסוק {row["number"]}')

            loc_btn = Button(
                text=rtl(loc), font_name=FONT, font_size=sp(14),
                size_hint_y=None, height=dp(26),
                halign='right', color=C_BLUE,
                background_color=(0, 0, 0, 0), background_normal='',
            )
            loc_btn.bind(size=lambda i, s: setattr(i, 'text_size', (s[0], s[1])))
            loc_btn.bind(on_press=lambda _, r=row: self._go_to_chapter(r))
            self.results.add_widget(loc_btn)

            # verse with matched word highlighted in gold
            marked = _mark_query(row['text'], query)
            verse_lbl = Label(
                text=marked, font_name=FONT, font_size=sp(19),
                size_hint_y=None, height=dp(46),
                halign='right', color=C_DARK,
                markup=True,
            )
            verse_lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w - dp(8), None)))
            verse_lbl.bind(texture_size=lambda i, ts: setattr(i, 'height',
                                                               max(ts[1] + dp(8), dp(36))))
            self.results.add_widget(verse_lbl)

    def _go_to_chapter(self, row):
        app = App.get_running_app()
        app.browse_screen.show_chapter_for_search(
            row['book_id'],
            row['book_name'],
            row['portion_id'],
            row['portion_name'] or '',
            row['chapter_id'],
            row['chapter_num'],
        )
        app.sm.current = 'browse'
