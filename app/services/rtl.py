from bidi.algorithm import get_display

try:
    import arabic_reshaper as _reshaper
except Exception:                      # not installed in some dev envs
    _reshaper = None


def rtl(text: str) -> str:
    """Reorder Hebrew to visual left-to-right order for Kivy's LTR renderer."""
    return get_display(text, base_dir='R')


def arabic(text: str) -> str:
    """Shape Arabic letters (cursive joining) and reorder to visual order, so
    Kivy's non-shaping LTR renderer shows connected, right-to-left Arabic."""
    if _reshaper is not None:
        try:
            text = _reshaper.reshape(text)
        except Exception:
            pass
    return get_display(text, base_dir='R')


def rtl_lines(text: str) -> str:
    """Process each line independently so verse numbers always stay at the
    start (right side) of their own line and never wrap to the next."""
    return '\n'.join(get_display(line, base_dir='R') for line in text.split('\n'))
