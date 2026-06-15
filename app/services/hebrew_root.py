# -*- coding: utf-8 -*-
"""
Heuristic Hebrew root extraction and root-based matching, for the search
"חילוץ שורש" flag. There is no morphological dictionary here, so this is a
best-effort approximation:

  * strip one common prefix and one common suffix to isolate the stem,
  * reduce both the stem and candidate words to a *consonantal skeleton*
    (drop the mater-lectionis letter ו only — י is kept, see _MATRES),
    which collapses full/defective spelling and binyan vowels,
  * a word shares the root when the root skeleton appears as a *contiguous*
    block inside the word skeleton.
"""
import re

_NIKUD = re.compile('[֑-ׇ]')
_FINALS = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}
_WORD = re.compile('[א-ת]+')
# Only ו is treated as a droppable mater lectionis. י is kept as a consonant:
# in the (largely defective) Samaritan text י is far more often a root letter,
# and dropping it conflates distinct roots (e.g. איבה -> אבה, שיר -> שר).
_MATRES = set('ו')

# longest-first so multi-letter affixes win. Written with NON-final letters,
# because words are normalised (finals -> regular) before stripping.
_SUF = ['ותיהמ', 'ותיכמ', 'ותינו', 'יהמ', 'יכמ', 'ינו', 'נו', 'כמ', 'המ',
        'ימ', 'ות', 'תי', 'תמ', 'תנ', 'יה', 'יו', 'ה', 'ת', 'י', 'ו', 'כ', 'מ', 'נ']
# 'וי'/'ות'/'ונ'/'וא' etc. cover the ubiquitous vav-consecutive + imperfect
# prefix (ויאמר, ותרא, וירא); 'הת'/'הי' cover hitpael/hifil.
_PRE = ['ושה', 'וכש', 'כש', 'וי', 'ות', 'ונ', 'וא', 'הת', 'הי',
        'וה', 'וב', 'וכ', 'ול', 'ומ', 'וש', 'לכ', 'מה', 'שה',
        'ה', 'ו', 'ב', 'כ', 'ל', 'מ', 'ש']


def normalize(s):
    s = _NIKUD.sub('', s or '')
    return ''.join(_FINALS.get(c, c) for c in s)


def heb_only(w):
    return ''.join(c for c in normalize(w) if 'א' <= c <= 'ת')


def _skeleton(w):
    return ''.join(c for c in heb_only(w) if c not in _MATRES)


def to_skeleton(s):
    """Consonantal skeleton of an arbitrary string (drops ו/י, prefixes nothing).
    Used to normalise a user-edited root before matching."""
    return _skeleton(s)


def extract_root(query):
    """Best-effort consonantal root of a single word. '' if too short."""
    w = heb_only(query)
    if len(w) < 3:
        return ''
    if len(w) > 3:
        for suf in _SUF:
            if w.endswith(suf) and len(w) - len(suf) >= 3:
                w = w[:-len(suf)]
                break
    if len(w) > 3:
        for pre in _PRE:
            if w.startswith(pre) and len(w) - len(pre) >= 3:
                w = w[len(pre):]
                break
    root = ''.join(c for c in w if c not in _MATRES)
    return root if len(root) >= 2 else w


def root_matches(root, word_skeleton):
    """True when the root skeleton appears as a *contiguous* block inside the
    word skeleton. After dropping the ו/י mater-lectionis letters the root
    consonants are adjacent in genuine derivations (כותב→כתב, ויאמר→אמר), so
    requiring contiguity avoids spurious gap matches — e.g. the root אבה (א-ב-ה)
    would otherwise match אַרְבָּעָה (א-ר-ב-ע-ה)."""
    return bool(root) and root in word_skeleton


def word_matches_root(word, root):
    """True if a single word shares the root (used for result highlighting)."""
    return root_matches(root, _skeleton(word))


def text_has_root(text, root):
    """True if any word in text shares the root (used as a SQLite function)."""
    if not text or not root:
        return False
    for w in _WORD.findall(normalize(text)):
        if root_matches(root, ''.join(c for c in w if c not in _MATRES)):
            return True
    return False
