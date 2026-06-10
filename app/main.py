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
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.image import Image
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
from app.widgets import HoverButton, IconHoverButton

_ICONS = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')

Window.clearcolor = (0.97, 0.97, 0.95, 1)

_FONT     = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'SBL_Hbrw.ttf')
_SAM_FONT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'Sam_font.ttf')
LabelBase.register(name='Hebrew',    fn_regular=_FONT)
LabelBase.register(name='Samaritan', fn_regular=_SAM_FONT)

C_NAVY   = (0.10, 0.22, 0.45, 1)
C_ACTIVE = (0.22, 0.50, 0.90, 1)
C_WHITE  = (1, 1, 1, 1)
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
            font_size=sp(11), color=(0.75, 0.85, 1, 1),
            size_hint=(None, 1), width=dp(36),
            halign='center', valign='bottom',
        )
        ver_lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        title_row.add_widget(ver_lbl)
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
        self.sm.add_widget(SearchScreen(name='search'))
        root.add_widget(self.sm)

        # ── bottom nav ──
        nav = BoxLayout(size_hint_y=None, height=dp(54), spacing=dp(2))
        browse_btn = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_browse.png'),
            text=rtl('עיון'), font_name='Hebrew', font_size=sp(16),
            text_color=C_WHITE, bg_color=C_NAVY,
            icon_size=dp(26), icon_side='right',
            orientation='horizontal', spacing=dp(4), padding=(dp(6), 0),
        )
        search_btn = IconHoverButton(
            icon_path=os.path.join(_ICONS, 'icon_search.png'),
            text=rtl('חיפוש'), font_name='Hebrew', font_size=sp(16),
            text_color=C_WHITE, bg_color=C_NAVY,
            icon_size=dp(26), icon_side='right',
            orientation='horizontal', spacing=dp(4), padding=(dp(6), 0),
        )
        self.font_btn = HoverButton(
            text=rtl('כתב שומרוני'),
            font_name='Hebrew', font_size=sp(16),
            background_color=(0.25, 0.25, 0.42, 1), background_normal='',
            color=C_WHITE,
        )
        self.eng_btn = HoverButton(
            text=rtl('English'),
            font_name='Hebrew', font_size=sp(16),
            background_color=(0.20, 0.38, 0.20, 1), background_normal='',
            color=C_WHITE,
        )
        self.compare_btn = HoverButton(
            text=rtl('השוואה לנ.מסורה'),
            font_name='Hebrew', font_size=sp(14),
            background_color=(0.35, 0.20, 0.45, 1), background_normal='',
            color=C_WHITE,
            opacity=0, disabled=True,
        )
        self.update_btn = HoverButton(
            text=rtl('עדכון גרסה'),
            font_name='Hebrew', font_size=sp(13),
            background_color=(0.18, 0.18, 0.32, 1), background_normal='',
            color=C_WHITE,
        )
        browse_btn.bind(on_press=self._go_browse)
        search_btn.bind(on_press=self._go_search)
        self.font_btn.bind(on_press=self._toggle_font)
        self.eng_btn.bind(on_press=self._toggle_english)
        self.compare_btn.bind(on_press=self._toggle_compare)
        self.update_btn.bind(on_press=self._on_update_btn_press)

        nav.add_widget(self.update_btn)   # leftmost
        nav.add_widget(browse_btn)
        nav.add_widget(search_btn)
        nav.add_widget(self.font_btn)
        nav.add_widget(self.eng_btn)
        nav.add_widget(self.compare_btn)
        root.add_widget(nav)

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
            text=rtl('הגרסה הנוכחית עדכנית.'),
            font_name='Hebrew', font_size=sp(16), color=C_DARK,
            halign='right', valign='middle',
        )
        lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))
        ok = HoverButton(
            text=rtl('סגור'), font_name='Hebrew', font_size=sp(15),
            background_color=C_NAVY, background_normal='', color=C_WHITE,
            size_hint_y=None, height=dp(40),
        )
        content.add_widget(lbl)
        content.add_widget(ok)
        p = Popup(title=rtl('בדיקת עדכונים'), content=content,
                  size_hint=(0.75, None), height=dp(180), auto_dismiss=False)
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

    def _toggle_font(self, *_):
        if self._font_mode == 'Hebrew':
            self._font_mode = 'Samaritan'
            self.font_btn.text = rtl('כתב עברי')
            self.font_btn.background_color = C_ACTIVE
        else:
            self._font_mode = 'Hebrew'
            self.font_btn.text = rtl('כתב שומרוני')
            self.font_btn.background_color = (0.25, 0.25, 0.42, 1)
        self.browse_screen.refresh_current()

    def _toggle_compare(self, *_):
        if not getattr(self, '_compare_mode', False):
            self._compare_mode = True
            self.compare_btn.background_color = C_ACTIVE
            self._font_btn_saved_bg = tuple(self.font_btn.background_color)
            self._eng_btn_saved_bg  = tuple(self.eng_btn.background_color)
            self.font_btn.background_color = (0.68, 0.68, 0.68, 1)
            self.eng_btn.background_color  = (0.68, 0.68, 0.68, 1)
            self.font_btn.opacity  = 1
            self.font_btn.disabled = True
            self.eng_btn.opacity   = 1
            self.eng_btn.disabled  = True
        else:
            self._compare_mode = False
            self.compare_btn.background_color = (0.35, 0.20, 0.45, 1)
            self.font_btn.background_color = getattr(self, '_font_btn_saved_bg', (0.25, 0.25, 0.42, 1))
            self.eng_btn.background_color  = getattr(self, '_eng_btn_saved_bg',  (0.20, 0.38, 0.20, 1))
            self.font_btn.opacity  = 1
            self.font_btn.disabled = False
            self.eng_btn.opacity   = 1
            self.eng_btn.disabled  = False
        self.browse_screen.toggle_compare(self._compare_mode)

    def _toggle_english(self, *_):
        if not getattr(self, '_english_mode', False):
            self._english_mode = True
            self.eng_btn.background_color = C_ACTIVE
            self.eng_btn.text = rtl('עברית')
        else:
            self._english_mode = False
            self.eng_btn.background_color = (0.20, 0.38, 0.20, 1)
            self.eng_btn.text = rtl('English')
        self.browse_screen.refresh_current()


if __name__ == '__main__':
    TorahApp().run()
