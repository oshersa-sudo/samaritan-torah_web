from bidi.algorithm import get_display


def rtl(text: str) -> str:
    """Reorder Hebrew to visual left-to-right order for Kivy's LTR renderer."""
    return get_display(text, base_dir='R')


def rtl_lines(text: str) -> str:
    """Process each line independently so verse numbers always stay at the
    start (right side) of their own line and never wrap to the next."""
    return '\n'.join(get_display(line, base_dir='R') for line in text.split('\n'))
