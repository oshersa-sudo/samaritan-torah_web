# -*- coding: utf-8 -*-
import os
import sys
import threading
import urllib.request
import json
import zipfile
import tempfile
import shutil
import subprocess
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from kivy.app import App
from kivy.uix.screenmanager import ScreenManager
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.image import Image
from kivy.uix.widget import Widget
from kivy.uix.popup import Popup
from kivy.core.window import Window
from kivy.clock import Clock
import webbrowser
from kivy.core.text import LabelBase
from kivy.graphics import Color, Rectangle
from kivy.metrics import sp, dp
from app.screens.browse import BrowseScreen
from app.screens.search import SearchScreen
from app.services.database import init_db
from app.services.rtl import rtl
from app.services import share as share_svc
from kivy.utils import platform
from app.widgets import HoverButton, IconHoverButton, RoundedHoverButton

_ICONS = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')

Window.clearcolor = (0.97, 0.97, 0.95, 1)

_FONT     = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'SBL_Hbrw.ttf')
_SAM_FONT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'Sam_font.ttf')
_AR_FONT  = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'Amiri-Regular.ttf')
_TR_FONT  = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'CharisSIL-Regular.ttf')
LabelBase.register(name='Hebrew',    fn_regular=_FONT)
LabelBase.register(name='Samaritan', fn_regular=_SAM_FONT)
LabelBase.register(name='Arabic',    fn_regular=_AR_FONT)
LabelBase.register(name='Translit',  fn_regular=_TR_FONT)   # Latin/IPA transliteration

C_NAVY   = (0.10, 0.22, 0.45, 1)
C_ACCENT = (0.18, 0.38, 0.72, 1)
C_ACTIVE = (0.22, 0.50, 0.90, 1)
C_WHITE  = (1, 1, 1, 1)
C_SHARE  = (0.13, 0.55, 0.40, 1)   # share button (green)
C_DARK   = (0.08, 0.08, 0.08, 1)

_BG_IMAGE    = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'background.jpg')
_SCROLL_IMG  = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'torah_scroll_nobg.png')
_APP_ICON    = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons', 'app_icon.png')

APP_VERSION  = '1.2'
# ── Replace GITHUB_USER / GITHUB_REPO with the actual repository details ──
_UPDATE_API  = 'https://api.github.com/repos/oshersa-sudo/samaritan-torah_pub/releases/latest'


class TorahApp(App):
    def build(self):
        init_db()
        self._font_mode       = 'Hebrew'
        self._available_update = None
        if os.path.exists(_APP_ICON):
            self.icon = _APP_ICON

        root = BoxLayout(orientation='vertical')
        if os.path.exists(_BG_IMAGE):
            with root.canvas.before:
                Color(1, 1, 1, 1)
                self._bg_white = Rectangle(pos=root.pos, size=root.size)
                Color(1, 1, 1, 0.22)
                self._bg_rect = Rectangle(source=_BG_IMAGE, pos=root.pos, size=root.size)
            root.bind(pos=lambda i, v: (setattr(self._bg_white, 'pos', v), setattr(self._bg_rect, 'pos', v)))
            root.bind(size=lambda i, v: (setattr(self._bg_white, 'size', v), setattr(self._bg_rect, 'size', v)))

        # ── header: title + chapter-mode toggle ──
        header = BoxLayout(orientation='vertical', size_hint_y=None, height=dp(86))
        with header.canvas.before:
            Color(*C_NAVY)
            self._hdr_rect = Rectangle(pos=header.pos, size=header.size)
        header.bind(pos=lambda i, v: setattr(self._hdr_rect, 'pos', v))
        header.bind(size=lambda i, v: setattr(self._hdr_rect, 'size', v))

        title_row = BoxLayout(orientation='horizontal', size_hint_y=None, height=dp(48),
                              padding=(dp(6), 0))
        if os.path.exists(_SCROLL_IMG):
            scroll_img = Image(
                source=_SCROLL_IMG,
                size_hint=(None, None), size=(dp(40), dp(40)),
                allow_stretch=True, keep_ratio=True,
            )
            title_row.add_widget(scroll_img)
        title = Label(
            text=rtl('התורה השומרונית הישראלית'),
            font_name='Hebrew', font_size=sp(22),
            halign='center', color=C_WHITE,
        )
        title.bind(width=lambda i, w: setattr(i, 'text_size', (w, None)))
        title_row.add_widget(title)
        ver_lbl = Label(
            text='v' + APP_VERSION,
            font_size=sp(14), color=(0.75, 0.85, 1, 1),
            size_hint=(None, 1), width=dp(44),
            halign='center', valign='bottom',
        )
        ver_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        self.update_btn = HoverButton(
            text=rtl('עדכן'),
            font_name='Hebrew', font_size=sp(14),
            bold=True,
            background_color=(0.20, 0.75, 0.30, 0.45), background_normal='',
            color=C_WHITE,
            size_hint=(None, 1), width=dp(80),
        )
        title_row.add_widget(ver_lbl)
        title_row.add_widget(self.update_btn)
        header.add_widget(title_row)

        toggle_row = BoxLayout(size_hint_y=None, height=dp(36),
                               spacing=dp(4), padding=(dp(8), dp(2)))
        self.btn_standard = HoverButton(
            text=rtl('חלוקה יהודית'), font_name='Hebrew', font_size=sp(14),
            background_color=(0.3, 0.3, 0.5, 1), background_normal='', color=C_WHITE,
        )
        self.btn_samaritan = HoverButton(
            text=rtl('חלוקה שומרונית'), font_name='Hebrew', font_size=sp(14),
            background_color=C_ACTIVE, background_normal='', color=C_WHITE,
        )
        self.btn_standard.bind(on_press=self._set_standard)
        self.btn_samaritan.bind(on_press=self._set_samaritan)
        toggle_row.add_widget(self.btn_standard)
        toggle_row.add_widget(self.btn_samaritan)
        header.add_widget(toggle_row)

        root.add_widget(header)

        # ── screen manager ──
        self.sm = ScreenManager()
        self.browse_screen = BrowseScreen(name='browse')
        self.sm.add_widget(self.browse_screen)
        self.search_screen = SearchScreen(name='search')
        self.sm.add_widget(self.search_screen)
        root.add_widget(self.sm)

        # ── bottom nav (3 rows) ──
        ROW_H = dp(44)
        nav = BoxLayout(orientation='vertical', size_hint_y=None,
                        height=ROW_H * 2 + dp(2), spacing=dp(2))
        row_mid = BoxLayout(size_hint_y=None, height=ROW_H, spacing=dp(2))
        row_bot = BoxLayout(size_hint_y=None, height=ROW_H, spacing=dp(2))

        browse_btn = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_browse.png'),
            text=rtl('עיון'), font_name='Hebrew', font_size=sp(16),
            text_color=C_WHITE, bg_color=C_NAVY,
            icon_size=dp(24), icon_side='right',
            orientation='horizontal', spacing=dp(4), padding=(dp(6), 0),
        )
        search_btn = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_search.png'),
            text=rtl('חיפוש'), font_name='Hebrew', font_size=sp(16),
            text_color=C_WHITE, bg_color=C_NAVY,
            icon_size=dp(24), icon_side='right',
            orientation='horizontal', spacing=dp(4), padding=(dp(6), 0),
        )
        self.font_btn = HoverButton(
            text=rtl('כתב שומרוני'),
            font_name='Hebrew', font_size=sp(14),
            background_color=(0.25, 0.25, 0.42, 1), background_normal='',
            color=C_WHITE,
        )
        self.eng_btn = HoverButton(
            text=rtl('התרגום לאנגלית'),
            font_name='Hebrew', font_size=sp(13),
            background_color=(0.20, 0.38, 0.20, 1), background_normal='',
            color=C_WHITE,
        )
        self.commentary_btn = HoverButton(
            text=rtl('פרשנות יהודית'),
            font_name='Hebrew', font_size=sp(13),
            background_color=(0.55, 0.55, 0.55, 1), background_normal='',
            color=C_WHITE,
            disabled=True,
        )
        self.compare_btn = HoverButton(
            text=rtl('השוואה לנ.מסורה'),
            font_name='Hebrew', font_size=sp(13),
            background_color=(0.55, 0.55, 0.55, 1), background_normal='',
            color=C_WHITE,
            disabled=True,
        )
        self.samaritan_src_btn = HoverButton(
            text=rtl('ממקור שומרון'),
            font_name='Hebrew', font_size=sp(13),
            background_color=(0.45, 0.33, 0.22, 1), background_normal='',
            color=C_WHITE,
            disabled=True,
        )
        self.aram_btn = HoverButton(
            text=rtl('התרגום הארמי'),
            font_name='Hebrew', font_size=sp(13),
            background_color=(0.55, 0.55, 0.55, 1), background_normal='',
            color=C_WHITE,
            disabled=True,
        )
        self.arabic_btn = HoverButton(
            text=rtl('התרגום לערבית'),
            font_name='Hebrew', font_size=sp(13),
            background_color=(0.55, 0.55, 0.55, 1), background_normal='',
            color=C_WHITE,
            disabled=True,
        )
        browse_btn.bind(on_press=self._go_browse)
        search_btn.bind(on_press=self._go_search)
        self.font_btn.bind(on_press=self._toggle_font)
        self.eng_btn.bind(on_press=self._toggle_english)
        self.compare_btn.bind(on_press=self._toggle_compare)
        self.aram_btn.bind(on_press=self._toggle_aramaic)
        self.arabic_btn.bind(on_press=self._toggle_arabic)
        self.commentary_btn.bind(on_press=self._toggle_commentary)
        self.samaritan_src_btn.bind(on_press=self._toggle_samaritan_source)
        self.update_btn.bind(on_press=self._on_update_btn_press)

        # browse-screen buttons relocated into the shared toolbar
        bs = self.browse_screen
        for b in (bs.back_btn, bs.interp_btn, bs.dict_btn):
            b.size_hint_y = 1

        # share button — left of חזור; shown only while verses/results are on screen
        self.share_btn = HoverButton(
            text=rtl('שתף'), font_name='Hebrew', font_size=sp(13),
            background_color=C_SHARE, background_normal='', color=C_WHITE,
            size_hint_x=None, width=dp(56))
        self.share_btn.bind(on_press=self._open_share)

        # middle row (right→left): פירוש הפסוק, כתב שומרוני, מילון מילים, חיפוש, עיון, חזור, שתף
        row_mid.add_widget(self.share_btn)
        row_mid.add_widget(bs.back_btn)
        row_mid.add_widget(browse_btn)
        row_mid.add_widget(search_btn)
        row_mid.add_widget(bs.dict_btn)
        row_mid.add_widget(self.font_btn)
        row_mid.add_widget(bs.interp_btn)
        # bottom row (right→left): התרגום הארמי, התרגום לאנגלית, ממקור שומרון, השוואה לנ.מסורה, פרשנות יהודית
        row_bot.add_widget(self.commentary_btn)
        row_bot.add_widget(self.compare_btn)
        row_bot.add_widget(self.samaritan_src_btn)
        row_bot.add_widget(self.eng_btn)
        row_bot.add_widget(self.arabic_btn)
        row_bot.add_widget(self.aram_btn)

        nav.add_widget(row_mid)
        nav.add_widget(row_bot)
        root.add_widget(nav)
        self._nav_bar = nav
        self._nav_full_h = ROW_H * 2 + dp(2)

        # search-screen control: centered +/- to enlarge the result text.
        # Shown only on the search screen (the full toolbar is hidden there).
        self._search_bar_h = dp(46)
        self.search_size_bar = FloatLayout(size_hint_y=None, height=0,
                                           opacity=0, disabled=True)
        s_back = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_arrow_back.png'),
            text=rtl('חזור'), font_name='Hebrew', font_size=sp(14),
            text_color=C_WHITE, bg_color=C_ACCENT,
            icon_size=dp(20), icon_side='right',
            orientation='horizontal', spacing=dp(4), padding=(dp(6), 0),
            size_hint=(None, None), width=dp(96), height=dp(42))
        s_browse = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_browse.png'),
            text=rtl('עיון'), font_name='Hebrew', font_size=sp(14),
            text_color=C_WHITE, bg_color=C_NAVY,
            icon_size=dp(20), icon_side='right',
            orientation='horizontal', spacing=dp(4), padding=(dp(6), 0),
            size_hint=(None, None), width=dp(96), height=dp(42))
        s_minus = RoundedHoverButton(
            text='−', font_size=sp(28), bold=True,
            size_hint=(None, None), width=dp(54), height=dp(42))
        s_plus = RoundedHoverButton(
            text='+', font_size=sp(28), bold=True,
            size_hint=(None, None), width=dp(54), height=dp(42))
        s_back.bind(on_press=lambda *_: setattr(self.sm, 'current', 'browse'))
        s_browse.bind(on_press=self._go_browse)
        s_minus.bind(on_press=lambda *_: self.search_screen.bump_result_font(-2))
        s_plus.bind(on_press=lambda *_: self.search_screen.bump_result_font(2))
        # All four share one row. חזור + עיון anchored on the left; +/- pinned to
        # the exact horizontal centre (over the footer copyright) via center_x=0.5,
        # independent of the left buttons' width.
        self.s_share = HoverButton(
            text=rtl('שתף'), font_name='Hebrew', font_size=sp(14),
            background_color=C_SHARE, background_normal='', color=C_WHITE,
            size_hint=(None, None), width=dp(70), height=dp(42))
        self.s_share.bind(on_press=self._open_share)
        left_grp = BoxLayout(size_hint=(None, None), width=dp(274), height=dp(42),
                             spacing=dp(6), pos_hint={'x': 0.02, 'center_y': 0.5})
        left_grp.add_widget(self.s_share)     # left of חזור
        left_grp.add_widget(s_back)
        left_grp.add_widget(s_browse)
        mid_grp = BoxLayout(size_hint=(None, None), width=dp(114), height=dp(42),
                            spacing=dp(6), pos_hint={'center_x': 0.5, 'center_y': 0.5})
        mid_grp.add_widget(s_minus)
        mid_grp.add_widget(s_plus)
        self.search_size_bar.add_widget(left_grp)
        self.search_size_bar.add_widget(mid_grp)
        root.add_widget(self.search_size_bar)

        self.sm.bind(current=self._on_screen_change)

        # ── footer ──
        footer = BoxLayout(orientation='vertical', size_hint_y=None, height=dp(36),
                           padding=(0, dp(2)))
        lbl_copy = Label(
            text='All rights reserved to Osher Sassoni ©',
            font_size=sp(11), color=(0.4, 0.4, 0.4, 1),
            halign='center', valign='middle',
        )
        lbl_copy.bind(size=lambda i, s: setattr(i, 'text_size', s))

        url_btn = Button(
            text='www.the-samaritans.net',
            font_size=sp(11), color=(0.18, 0.38, 0.72, 1),
            halign='center', valign='middle',
            background_color=(0, 0, 0, 0), background_normal='',
        )
        url_btn.bind(size=lambda i, s: setattr(i, 'text_size', s))
        url_btn.bind(on_press=lambda _: webbrowser.open('https://www.the-samaritans.net'))

        footer.add_widget(lbl_copy)
        footer.add_widget(url_btn)
        root.add_widget(footer)

        # Check for updates in background after startup
        Clock.schedule_once(lambda dt: self._check_update_async(), 2)

        return root

    # ── update logic ────────────────────────────────────────────────────────

    def _check_update_async(self):
        def _check():
            try:
                req = urllib.request.Request(
                    _UPDATE_API,
                    headers={'User-Agent': 'SamaritanTorahApp/' + APP_VERSION})
                with urllib.request.urlopen(req, timeout=8) as r:
                    data = json.loads(r.read().decode())
                tag = data.get('tag_name', '').lstrip('vV')
                if tag and tag > APP_VERSION:
                    dl_url = None
                    for asset in data.get('assets', []):
                        if asset['name'].endswith('.zip'):
                            dl_url = asset['browser_download_url']
                            break
                    Clock.schedule_once(lambda dt: self._on_update_found(tag, dl_url), 0)
            except Exception:
                pass
        threading.Thread(target=_check, daemon=True).start()

    def _on_update_btn_press(self, *_):
        if self._available_update:
            version, url = self._available_update
            self._show_update_popup(version, url)
        else:
            self._check_update_async()
            self._show_no_update_popup()

    def _on_update_found(self, version, dl_url):
        self._available_update = (version, dl_url)
        self.update_btn.text = rtl('עדכון v' + version)
        self.update_btn.background_color = (0.10, 0.55, 0.22, 1)
        self._show_update_popup(version, dl_url)

    def _show_no_update_popup(self):
        content = BoxLayout(orientation='vertical', padding=dp(16), spacing=dp(12))
        lbl = Label(
            text=rtl('לא נמצאה גרסא חדשה'),
            font_name='Hebrew', font_size=sp(18), color=C_WHITE,
            halign='center', valign='middle', size_hint_y=1,
        )
        lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        ok = HoverButton(
            text=rtl('סגור'), font_name='Hebrew', font_size=sp(15),
            background_color=C_NAVY, background_normal='', color=C_WHITE,
            size_hint_y=None, height=dp(40),
        )
        content.add_widget(lbl)
        content.add_widget(ok)
        p = Popup(title='בדיקת עדכונים', content=content,
                  size_hint=(0.45, None), height=dp(190), auto_dismiss=False)
        ok.bind(on_press=p.dismiss)
        p.open()

    def _show_update_popup(self, version, dl_url):
        content = BoxLayout(orientation='vertical', spacing=dp(12), padding=dp(16))
        msg = Label(
            text=rtl('גרסה ' + version + ' זמינה!\nהאם לעדכן כעת?'),
            font_name='Hebrew', font_size=sp(16), color=C_DARK,
            halign='right', valign='middle',
        )
        msg.bind(size=lambda i, s: setattr(i, 'text_size', s))
        content.add_widget(msg)

        btns = BoxLayout(size_hint_y=None, height=dp(44), spacing=dp(8))
        yes_btn = HoverButton(
            text=rtl('עדכן'), font_name='Hebrew', font_size=sp(15),
            background_color=(0.10, 0.55, 0.22, 1), background_normal='', color=C_WHITE,
        )
        no_btn = HoverButton(
            text=rtl('לא עכשיו'), font_name='Hebrew', font_size=sp(15),
            background_color=(0.45, 0.45, 0.45, 1), background_normal='', color=C_WHITE,
        )
        btns.add_widget(yes_btn)
        btns.add_widget(no_btn)
        content.add_widget(btns)

        popup = Popup(
            title=rtl('עדכון זמין'),
            content=content,
            size_hint=(0.85, None), height=dp(220),
            auto_dismiss=False,
        )
        no_btn.bind(on_press=popup.dismiss)
        yes_btn.bind(on_press=lambda _: (popup.dismiss(),
                                         self._do_update(dl_url, version)))
        popup.open()

    def _do_update(self, dl_url, version):
        prog_content = BoxLayout(orientation='vertical', padding=dp(16))
        self._prog_lbl = Label(
            text=rtl('מוריד עדכון...'),
            font_name='Hebrew', font_size=sp(16), color=C_DARK,
            halign='right', valign='middle',
        )
        self._prog_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        prog_content.add_widget(self._prog_lbl)
        self._prog_popup = Popup(
            title=rtl('עדכון גרסה'),
            content=prog_content,
            size_hint=(0.75, None), height=dp(150),
            auto_dismiss=False,
        )
        self._prog_popup.open()

        def _download():
            try:
                tmp = tempfile.mkdtemp()
                zip_path = os.path.join(tmp, 'update.zip')
                urllib.request.urlretrieve(dl_url, zip_path)

                Clock.schedule_once(lambda dt: setattr(
                    self._prog_lbl, 'text', rtl('מחלץ קבצים...')), 0)

                extract_dir = os.path.join(tmp, 'extracted')
                with zipfile.ZipFile(zip_path, 'r') as z:
                    z.extractall(extract_dir)

                contents = os.listdir(extract_dir)
                src = (os.path.join(extract_dir, contents[0])
                       if len(contents) == 1
                       and os.path.isdir(os.path.join(extract_dir, contents[0]))
                       else extract_dir)

                project_dir = os.path.dirname(
                    os.path.dirname(os.path.abspath(__file__)))

                bat = os.path.join(tmp, 'do_update.bat')
                with open(bat, 'w', encoding='utf-8') as f:
                    f.write('@echo off\r\n')
                    f.write('timeout /t 2 /nobreak >nul\r\n')
                    f.write('xcopy /E /Y /I "{}\\*" "{}\\"\r\n'.format(src, project_dir))
                    f.write('cd /d "{}"\r\n'.format(project_dir))
                    f.write('start "" py -3 main.py\r\n')
                    f.write('del "%~f0"\r\n')

                Clock.schedule_once(lambda dt: self._update_ready(bat), 0)
            except Exception as e:
                Clock.schedule_once(lambda dt: self._update_failed(str(e)), 0)

        threading.Thread(target=_download, daemon=True).start()

    def _update_ready(self, bat_path):
        self._prog_popup.dismiss()
        subprocess.Popen(
            ['cmd', '/c', bat_path],
            creationflags=subprocess.CREATE_NEW_CONSOLE)
        App.get_running_app().stop()

    def _update_failed(self, err):
        self._prog_popup.dismiss()
        content = BoxLayout(orientation='vertical', padding=dp(16), spacing=dp(12))
        lbl = Label(
            text=rtl('שגיאה בעדכון:\n') + err,
            font_name='Hebrew', font_size=sp(14), color=C_DARK,
            halign='right',
        )
        lbl.bind(width=lambda i, w: setattr(i, 'text_size', (w, None)))
        ok = HoverButton(
            text='OK', font_size=sp(14),
            background_color=C_NAVY, background_normal='', color=C_WHITE,
            size_hint_y=None, height=dp(40),
        )
        content.add_widget(lbl)
        content.add_widget(ok)
        p = Popup(title='Error', content=content,
                  size_hint=(0.75, None), height=dp(220), auto_dismiss=False)
        ok.bind(on_press=p.dismiss)
        p.open()

    # ── navigation ───────────────────────────────────────────────────────────

    def _go_browse(self, *_):
        self.sm.current = 'browse'
        self.browse_screen._show_books()

    def _go_search(self, *_):
        self.sm.current = 'search'

    # ── share ────────────────────────────────────────────────────────────────

    def _open_share(self, *_):
        """Popup offering the three share destinations."""
        box = BoxLayout(orientation='vertical', spacing=dp(10), padding=dp(16))
        for label, target, col in (('WhatsApp', 'whatsapp', (0.15, 0.68, 0.38, 1)),
                                    (rtl('אימייל'), 'email', (0.20, 0.45, 0.72, 1)),
                                    ('Facebook', 'facebook', (0.23, 0.35, 0.60, 1))):
            b = HoverButton(text=label, font_name='Hebrew', font_size=sp(18),
                            background_color=col, background_normal='', color=C_WHITE,
                            size_hint_y=None, height=dp(54))
            b.bind(on_press=lambda _w, t=target: self._share_to(t))
            box.add_widget(b)
        self._share_popup = Popup(
            title=rtl('שיתוף'), title_font='Hebrew', title_align='center',
            content=box, size_hint=(0.72, None), height=dp(272),
            separator_color=C_SHARE)
        self._share_popup.open()

    def _share_to(self, target):
        """Capture the current screen's results as a PNG and share it."""
        if getattr(self, '_share_popup', None):
            self._share_popup.dismiss()
        path = os.path.join(self.user_data_dir, 'torah_share.png')
        try:
            self.sm.current_screen.export_to_png(path)
        except Exception as e:
            print('screenshot error:', e)
            return
        # share text is logical Hebrew (the target apps handle RTL themselves)
        ok = share_svc.share_image(path, target, text='התורה השומרונית')
        if platform != 'android':
            note = ('התמונה נשמרה ונפתחה. שיתוף לאפליקציות זמין במכשיר אנדרואיד.'
                    if ok else 'לא ניתן לשמור את התמונה.')
            lbl = Label(text=rtl(note), font_name='Hebrew', halign='center', valign='middle')
            lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
            Popup(title=rtl('שיתוף'), title_font='Hebrew', content=lbl,
                  size_hint=(0.75, None), height=dp(170)).open()

    def _on_screen_change(self, sm, current):
        """On the search screen show only the centered +/- bar; elsewhere show
        the full 2-row toolbar."""
        on_search = (current == 'search')
        self._nav_bar.height   = 0 if on_search else self._nav_full_h
        self._nav_bar.opacity  = 0 if on_search else 1
        self._nav_bar.disabled = on_search
        self.search_size_bar.height   = self._search_bar_h if on_search else 0
        self.search_size_bar.opacity  = 1 if on_search else 0
        self.search_size_bar.disabled = not on_search

    def _set_standard(self, *_):
        self.btn_standard.background_color  = C_ACTIVE
        self.btn_samaritan.background_color = (0.3, 0.3, 0.5, 1)
        self.browse_screen.set_mode('standard')
        self.sm.current = 'browse'

    def _set_samaritan(self, *_):
        self.btn_samaritan.background_color = C_ACTIVE
        self.btn_standard.background_color  = (0.3, 0.3, 0.5, 1)
        self.browse_screen.set_mode('samaritan')
        self.sm.current = 'browse'

    def _sync_btn_states(self):
        sam_on = (self._font_mode == 'Samaritan')
        cmp_on = getattr(self, '_compare_mode', False)
        eng_on = getattr(self, '_english_mode', False)
        sam_blocked = eng_on
        cmp_blocked = sam_on or eng_on
        eng_blocked = sam_on or cmp_on

        C_DISABLED   = (0.55, 0.55, 0.55, 1)
        verse_view   = getattr(self, '_compare_btn_should_show', False)

        # share button: visible only on the text / interpretation views (the
        # book/portion lists hide it). The search screen has its own share btn.
        self.share_btn.width    = dp(56) if verse_view else 0
        self.share_btn.opacity  = 1 if verse_view else 0
        self.share_btn.disabled = not verse_view

        font_blocked = sam_blocked or not verse_view
        self.font_btn.disabled = font_blocked
        if font_blocked:
            self.font_btn.background_color = C_DISABLED
        elif sam_on:
            self.font_btn.background_color = C_ACTIVE
        else:
            self.font_btn.background_color = (0.25, 0.25, 0.42, 1)

        cmp_visible = getattr(self, '_compare_btn_should_show', False)
        self.compare_btn.opacity = 1
        if cmp_blocked:
            self.compare_btn.disabled = True
            self.compare_btn.background_color = C_DISABLED
        elif not cmp_visible:
            self.compare_btn.disabled = True
            self.compare_btn.background_color = C_DISABLED
        else:
            self.compare_btn.disabled = False
            self.compare_btn.background_color = C_ACTIVE if cmp_on else (0.35, 0.20, 0.45, 1)

        self.eng_btn.disabled = eng_blocked
        if eng_blocked:
            self.eng_btn.background_color = C_DISABLED
        elif eng_on:
            self.eng_btn.background_color = C_ACTIVE
        else:
            self.eng_btn.background_color = (0.20, 0.38, 0.20, 1)

        interp_on      = getattr(self, '_interpret_mode', False)
        interp_blocked = sam_on or not verse_view
        self.browse_screen.interp_btn.disabled = interp_blocked
        if interp_blocked:
            self.browse_screen.interp_btn.background_color = C_DISABLED
        elif interp_on:
            self.browse_screen.interp_btn.background_color = C_ACTIVE
        else:
            self.browse_screen.interp_btn.background_color = (0.20, 0.35, 0.35, 1)

        comm_on      = getattr(self, '_commentary_mode', False)
        comm_blocked = sam_on or not verse_view
        self.commentary_btn.disabled = comm_blocked
        if comm_blocked:
            self.commentary_btn.background_color = C_DISABLED
        elif comm_on:
            self.commentary_btn.background_color = C_ACTIVE
        else:
            self.commentary_btn.background_color = (0.30, 0.30, 0.50, 1)

        ss_on      = getattr(self, '_samaritan_src_mode', False)
        ss_blocked = sam_on or not verse_view
        self.samaritan_src_btn.disabled = ss_blocked
        if ss_blocked:
            self.samaritan_src_btn.background_color = C_DISABLED
        elif ss_on:
            self.samaritan_src_btn.background_color = C_ACTIVE
        else:
            self.samaritan_src_btn.background_color = (0.45, 0.33, 0.22, 1)

        aram_on      = getattr(self, '_aramaic_mode', False)
        aram_blocked = sam_on or eng_on or cmp_on or not verse_view
        self.aram_btn.disabled = aram_blocked
        if aram_blocked:
            self.aram_btn.background_color = C_DISABLED
        elif aram_on:
            self.aram_btn.background_color = C_ACTIVE
        else:
            self.aram_btn.background_color = (0.35, 0.25, 0.15, 1)

        arab_on      = getattr(self, '_arabic_mode', False)
        arab_blocked = sam_on or eng_on or cmp_on or not verse_view
        self.arabic_btn.disabled = arab_blocked
        if arab_blocked:
            self.arabic_btn.background_color = C_DISABLED
        elif arab_on:
            self.arabic_btn.background_color = C_ACTIVE
        else:
            self.arabic_btn.background_color = (0.35, 0.25, 0.15, 1)

        dict_on      = getattr(self, '_dict_mode', False)
        dict_blocked = eng_on or cmp_on or not verse_view
        self.browse_screen.dict_btn.disabled = dict_blocked
        if dict_blocked:
            self.browse_screen.dict_btn.background_color = C_DISABLED
        elif dict_on:
            self.browse_screen.dict_btn.background_color = C_ACTIVE
        else:
            self.browse_screen.dict_btn.background_color = (0.25, 0.35, 0.45, 1)

    def _toggle_font(self, *_):
        if self._font_mode == 'Hebrew':
            self._font_mode = 'Samaritan'
            self.font_btn.text = rtl('כתב עברי')
            self.font_btn.background_color = C_ACTIVE
            # Auto-deactivate conflicting modes
            if getattr(self, '_compare_mode', False):
                self._compare_mode = False
                self.compare_btn.background_color = (0.35, 0.20, 0.45, 1)
                self.browse_screen.toggle_compare(False)
            if getattr(self, '_english_mode', False):
                self._english_mode = False
                self.eng_btn.background_color = (0.20, 0.38, 0.20, 1)
                self.eng_btn.text = rtl('התרגום לאנגלית')
            if getattr(self, '_interpret_mode', False):
                self._interpret_mode = False
                self.browse_screen.interp_btn.background_color = (0.20, 0.35, 0.35, 1)
                self.browse_screen.toggle_interpret(False)
            if getattr(self, '_aramaic_mode', False):
                self._aramaic_mode = False
                self.aram_btn.background_color = (0.35, 0.25, 0.15, 1)
                self.browse_screen.toggle_aramaic(False)
            self._off_arabic()
            self._off_commentary()
            self._off_samaritan_src()
        else:
            self._font_mode = 'Hebrew'
            self.font_btn.text = rtl('כתב שומרוני')
            self.font_btn.background_color = (0.25, 0.25, 0.42, 1)
        self._sync_btn_states()
        self.browse_screen.refresh_current()

    def _toggle_compare(self, *_):
        if not getattr(self, '_compare_mode', False):
            self._compare_mode = True
            self._off_commentary()
            self._off_samaritan_src()
            self.compare_btn.background_color = C_ACTIVE
            if getattr(self, '_english_mode', False):
                self._english_mode = False
                self.eng_btn.background_color = (0.20, 0.38, 0.20, 1)
                self.eng_btn.text = rtl('התרגום לאנגלית')
            if getattr(self, '_aramaic_mode', False):
                self._aramaic_mode = False
                self.aram_btn.background_color = (0.35, 0.25, 0.15, 1)
                self.browse_screen.toggle_aramaic(False)
            self._off_arabic()
        else:
            self._compare_mode = False
            self.compare_btn.background_color = (0.35, 0.20, 0.45, 1)
        self._sync_btn_states()
        self.browse_screen.toggle_compare(self._compare_mode)

    def _toggle_english(self, *_):
        if not getattr(self, '_english_mode', False):
            self._english_mode = True
            self._off_commentary()
            self._off_samaritan_src()
            self.eng_btn.background_color = C_ACTIVE
            self.eng_btn.text = rtl('עברית')
            if getattr(self, '_compare_mode', False):
                self._compare_mode = False
                self.compare_btn.background_color = (0.35, 0.20, 0.45, 1)
                self.browse_screen.toggle_compare(False)
            if self._font_mode == 'Samaritan':
                self._font_mode = 'Hebrew'
                self.font_btn.text = rtl('כתב שומרוני')
                self.font_btn.background_color = (0.25, 0.25, 0.42, 1)
            if getattr(self, '_aramaic_mode', False):
                self._aramaic_mode = False
                self.aram_btn.background_color = (0.35, 0.25, 0.15, 1)
                self.browse_screen.toggle_aramaic(False)
            self._off_arabic()
        else:
            self._english_mode = False
            self.eng_btn.background_color = (0.20, 0.38, 0.20, 1)
            self.eng_btn.text = rtl('התרגום לאנגלית')
        self._sync_btn_states()
        self.browse_screen.refresh_current()

    def _toggle_dict(self, *_):
        if not getattr(self, '_dict_mode', False):
            self._dict_mode = True
            self.browse_screen.dict_btn.background_color = C_ACTIVE
        else:
            self._dict_mode = False
            self.browse_screen.dict_btn.background_color = (0.25, 0.35, 0.45, 1)
        self._sync_btn_states()
        self.browse_screen.toggle_dict(self._dict_mode)

    def _toggle_aramaic(self, *_):
        if not getattr(self, '_aramaic_mode', False):
            self._aramaic_mode = True
            self._off_commentary()
            self._off_samaritan_src()
            self._off_arabic()
            self.aram_btn.background_color = C_ACTIVE
        else:
            self._aramaic_mode = False
            self.aram_btn.background_color = (0.35, 0.25, 0.15, 1)
        self._sync_btn_states()
        self.browse_screen.toggle_aramaic(self._aramaic_mode)

    def _off_arabic(self):
        """Deactivate the Arabic-translation mode (used when another mode opens)."""
        if getattr(self, '_arabic_mode', False):
            self._arabic_mode = False
            self.arabic_btn.background_color = (0.35, 0.25, 0.15, 1)
            self.browse_screen.toggle_arabic(False)

    def _toggle_arabic(self, *_):
        if not getattr(self, '_arabic_mode', False):
            self._arabic_mode = True
            self._off_commentary()
            self._off_samaritan_src()
            if getattr(self, '_aramaic_mode', False):
                self._aramaic_mode = False
                self.aram_btn.background_color = (0.35, 0.25, 0.15, 1)
                self.browse_screen.toggle_aramaic(False)
            self.arabic_btn.background_color = C_ACTIVE
        else:
            self._arabic_mode = False
            self.arabic_btn.background_color = (0.35, 0.25, 0.15, 1)
        self._sync_btn_states()
        self.browse_screen.toggle_arabic(self._arabic_mode)

    def _toggle_interpret(self, *_):
        if not getattr(self, '_interpret_mode', False):
            self._interpret_mode = True
            self._off_commentary()
            self._off_samaritan_src()
            self.browse_screen.interp_btn.background_color = C_ACTIVE
        else:
            self._interpret_mode = False
            self.browse_screen.interp_btn.background_color = (0.20, 0.35, 0.35, 1)
        self._sync_btn_states()
        self.browse_screen.toggle_interpret(self._interpret_mode)

    def _off_commentary(self):
        """Deactivate the Jewish-commentary mode (used when another mode opens)."""
        if getattr(self, '_commentary_mode', False):
            self._commentary_mode = False
            self.commentary_btn.background_color = (0.30, 0.30, 0.50, 1)
            self.browse_screen.toggle_commentary(False)

    def _toggle_commentary(self, *_):
        bs = self.browse_screen
        if not getattr(self, '_commentary_mode', False):
            self._commentary_mode = True
            self.commentary_btn.background_color = C_ACTIVE
            self._off_samaritan_src()
            # deactivate conflicting content modes
            if getattr(self, '_interpret_mode', False):
                self._interpret_mode = False
                bs.interp_btn.background_color = (0.20, 0.35, 0.35, 1)
                bs.toggle_interpret(False)
            if getattr(self, '_aramaic_mode', False):
                self._aramaic_mode = False
                self.aram_btn.background_color = (0.35, 0.25, 0.15, 1)
                bs.toggle_aramaic(False)
            self._off_arabic()
            if getattr(self, '_compare_mode', False):
                self._compare_mode = False
                self.compare_btn.background_color = (0.35, 0.20, 0.45, 1)
                bs.toggle_compare(False)
            if getattr(self, '_english_mode', False):
                self._english_mode = False
                self.eng_btn.background_color = (0.20, 0.38, 0.20, 1)
                self.eng_btn.text = rtl('התרגום לאנגלית')
        else:
            self._commentary_mode = False
            self.commentary_btn.background_color = (0.30, 0.30, 0.50, 1)
        self._sync_btn_states()
        bs.toggle_commentary(self._commentary_mode)

    def _off_samaritan_src(self):
        """Deactivate the ממקור שומרון panel (used when another mode opens)."""
        if getattr(self, '_samaritan_src_mode', False):
            self._samaritan_src_mode = False
            self.samaritan_src_btn.background_color = (0.45, 0.33, 0.22, 1)
            self.browse_screen.toggle_samaritan_source(False)

    def _toggle_samaritan_source(self, *_):
        """ממקור שומרון — opens an in-screen panel showing the Tibåt Mårqe
        passages relevant to the current verse(s); tapping one reveals its
        translation in two adjacent panels (Hebrew | English)."""
        bs = self.browse_screen
        if not getattr(self, '_samaritan_src_mode', False):
            self._samaritan_src_mode = True
            self.samaritan_src_btn.background_color = C_ACTIVE
            # deactivate conflicting content modes (same as commentary does)
            self._off_commentary()
            if getattr(self, '_interpret_mode', False):
                self._interpret_mode = False
                bs.interp_btn.background_color = (0.20, 0.35, 0.35, 1)
                bs.toggle_interpret(False)
            if getattr(self, '_aramaic_mode', False):
                self._aramaic_mode = False
                self.aram_btn.background_color = (0.35, 0.25, 0.15, 1)
                bs.toggle_aramaic(False)
            self._off_arabic()
            if getattr(self, '_compare_mode', False):
                self._compare_mode = False
                self.compare_btn.background_color = (0.35, 0.20, 0.45, 1)
                bs.toggle_compare(False)
            if getattr(self, '_english_mode', False):
                self._english_mode = False
                self.eng_btn.background_color = (0.20, 0.38, 0.20, 1)
                self.eng_btn.text = rtl('התרגום לאנגלית')
        else:
            self._samaritan_src_mode = False
            self.samaritan_src_btn.background_color = (0.45, 0.33, 0.22, 1)
        self._sync_btn_states()
        bs.toggle_samaritan_source(self._samaritan_src_mode)


if __name__ == '__main__':
    TorahApp().run()
