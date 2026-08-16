# -*- coding: utf-8 -*-
"""Text folding shared by the build scripts and the server.

Kept in one place so an uploaded piyyut name is matched to an existing entry by
exactly the same rule the catalog was built with.
"""
import re


def skeleton(s):
    """Consonantal skeleton — folds Samaritan phonetic spelling variants.

    בריכ/בריך, אדק/אדיק, אלהנו/אלהינו all collapse to one key.
    """
    s = re.sub(r'[^֐-׿ ]', '', s or '')
    s = (s.replace('ך', 'כ').replace('ם', 'מ').replace('ן', 'נ')
           .replace('ף', 'פ').replace('ץ', 'צ'))
    return re.sub(r'\s+', ' ', re.sub(r'[אהוי]', '', s)).strip()


SAFE = re.compile(r'[^\w֐-׿؀-ۿ ().\'’-]', re.U)


def safe_name(name, fallback='clip'):
    """Filesystem-safe file name: no separators, no traversal, no control chars."""
    name = (name or '').replace('\\', '/').split('/')[-1].strip()
    name = SAFE.sub('_', name).strip(' ._')
    return name[:120] or fallback
