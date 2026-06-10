from kivy.uix.button import Button
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.image import Image
from kivy.uix.label import Label
from kivy.uix.behaviors import ButtonBehavior
from kivy.core.window import Window
from kivy.graphics import Color, Rectangle, RoundedRectangle, Line
from kivy.metrics import dp, sp


class HoverButton(Button):
    """Button that lightens when hovered."""

    def on_parent(self, widget, parent):
        if parent:
            Window.bind(mouse_pos=self._on_mouse_pos)
        else:
            Window.unbind(mouse_pos=self._on_mouse_pos)
        self._hovering = False
        self._base_bg  = tuple(self.background_color)

    def on_background_color(self, instance, value):
        if not getattr(self, '_hovering', False):
            self._base_bg = tuple(value)

    def on_touch_down(self, touch):
        if self.collide_point(*touch.pos) and getattr(self, '_hovering', False):
            self._hovering = False
            self.background_color = self._base_bg
        return super().on_touch_down(touch)

    def _on_mouse_pos(self, _window, pos):
        if not self.get_root_window():
            return
        inside = self.collide_point(*self.to_widget(*pos))
        if inside and not self._hovering:
            self._hovering = True
            r, g, b, a = self._base_bg
            self.background_color = (min(r + 0.14, 1), min(g + 0.14, 1),
                                     min(b + 0.14, 1), a)
        elif not inside and self._hovering:
            self._hovering = False
            self.background_color = self._base_bg


class IconHoverButton(ButtonBehavior, BoxLayout):
    """BoxLayout+ButtonBehavior button with an icon image and optional label.
    Exposes self.lbl for external text updates."""

    def __init__(self, icon_path, text='', font_name='Hebrew',
                 font_size=None, text_color=(1, 1, 1, 1),
                 bg_color=(0.10, 0.22, 0.45, 1),
                 icon_size=None, icon_side='right', **kwargs):
        super().__init__(**kwargs)
        self._bg_color = tuple(bg_color)
        self._hovering = False

        with self.canvas.before:
            self._c_bg = Color(*self._bg_color)
            self._r_bg = Rectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._sync_bg, size=self._sync_bg)

        isize = icon_size or dp(26)
        img = Image(source=icon_path,
                    size_hint=(None, None), size=(isize, isize),
                    allow_stretch=True, keep_ratio=True)

        self.lbl = Label(
            text=text, font_name=font_name,
            font_size=font_size or sp(16),
            color=text_color,
            halign='center', valign='middle',
        )
        self.lbl.bind(size=lambda i, s: setattr(i, 'text_size', s))

        if icon_side == 'right':
            self.add_widget(self.lbl)
            self.add_widget(img)
        else:
            self.add_widget(img)
            self.add_widget(self.lbl)

    def on_parent(self, widget, parent):
        if parent:
            Window.bind(mouse_pos=self._on_mouse_pos)
        else:
            Window.unbind(mouse_pos=self._on_mouse_pos)
        self._hovering = False

    def _sync_bg(self, *_):
        self._r_bg.pos  = self.pos
        self._r_bg.size = self.size

    def _on_mouse_pos(self, _window, pos):
        if not self.get_root_window():
            return
        inside = self.collide_point(*self.to_widget(*pos))
        if inside and not self._hovering:
            self._hovering = True
            r, g, b, a = self._bg_color
            self._c_bg.rgba = (min(r + 0.14, 1), min(g + 0.14, 1),
                               min(b + 0.14, 1), a)
        elif not inside and self._hovering:
            self._hovering = False
            self._c_bg.rgba = self._bg_color


class RoundedHoverButton(Button):
    """Chapter-grid button with rounded corners, border, and hover effect."""

    _FILL   = (0.92, 0.93, 0.98, 1)
    _BORDER = (0.35, 0.40, 0.55, 1)
    _RADIUS = 10

    def __init__(self, **kwargs):
        kwargs.setdefault('background_color', (0, 0, 0, 0))
        kwargs.setdefault('background_normal', '')
        kwargs.setdefault('background_down', '')
        kwargs.setdefault('color', (0, 0, 0, 1))
        super().__init__(**kwargs)
        self._hovering = False

        with self.canvas.before:
            self._c_fill   = Color(*self._FILL)
            self._r_fill   = RoundedRectangle(pos=self.pos, size=self.size,
                                              radius=[dp(self._RADIUS)])
            self._c_border = Color(*self._BORDER)
            self._r_border = Line(width=1.3,
                                  rounded_rectangle=[self.x, self.y,
                                                     self.width, self.height,
                                                     dp(self._RADIUS)])

        self.bind(pos=self._sync_geom, size=self._sync_geom)

    def on_parent(self, widget, parent):
        if parent:
            Window.bind(mouse_pos=self._on_mouse_pos)
        else:
            Window.unbind(mouse_pos=self._on_mouse_pos)
        self._hovering = False

    def _sync_geom(self, *_):
        self._r_fill.pos  = self.pos
        self._r_fill.size = self.size
        self._r_border.rounded_rectangle = [self.x, self.y,
                                             self.width, self.height,
                                             dp(self._RADIUS)]

    def _on_mouse_pos(self, _window, pos):
        if not self.get_root_window():
            return
        inside = self.collide_point(*self.to_widget(*pos))
        if inside and not self._hovering:
            self._hovering = True
            r, g, b, a = self._FILL
            self._c_fill.rgba = (min(r + 0.10, 1), min(g + 0.10, 1),
                                 min(b + 0.10, 1), a)
        elif not inside and self._hovering:
            self._hovering = False
            self._c_fill.rgba = self._FILL
