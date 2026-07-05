"""Ben-Ḥayyim transcription → POINTED HEBREW, so an Azure he-IL neural voice reads it with
natural Semitic phonetics (the voice is trained on Hebrew; raw IPA phonemes come out muffled).
Ported 1:1 from the client-side ttsHeb in app.js (memory: translit-pronunciation-key)."""

# The transcription is phonetic, so each Latin letter is mapped to the Hebrew letter that a
# he-IL neural voice will actually SOUND correctly for Samaritan:
#   • no /v/ ever → b is a HARD /b/ (בּ with dagesh; plain ב is read /v/, causing "va")
#   • every כ is hard /k/ (כּ with dagesh; plain כ is read as soft /χ/)
#   • every פ likewise hard /p/ where the transcription has p (פּ); f stays soft פ
#   • ח is PRONOUNCED as a light guttural (ח), never dropped
_C = {'b': 'בּ', 'B': 'בּ', 'v': 'ב', 'f': 'פ', 'p': 'פּ', 'm': 'מ', 'w': 'ו', 't': 'ת', 'ṭ': 'ט',
      'd': 'ד', 'ḏ': 'ד', 's': 'ס', 'ṣ': 'ס', 'z': 'ז', 'š': 'שׁ', 'Š': 'שׁ', 'ś': 'שׂ', 'ṯ': 'ת',
      'l': 'ל', 'r': 'ר', 'n': 'נ', 'y': 'י', 'j': 'י', 'g': 'ג', 'ġ': 'ג', 'k': 'כּ', 'q': 'א',
      "'": 'א', 'ʾ': 'א', 'ʿ': 'א', 'ḥ': 'ח', 'h': 'ה'}
# a/å → patach (clear /a/; qamats is misread as qamats-katan /o/); ə schwa → segol (audible)
_V = {'a': 'ַ', 'å': 'ַ', 'ā': 'ַ', 'ɑ': 'ַ', 'ɒ': 'ַ', 'e': 'ֶ', 'ē': 'ֵ', 'ɛ': 'ֶ', 'ə': 'ֶ',
      'ǝ': 'ֶ', 'i': 'ִ', 'ī': 'ִ', 'o': 'ֹ', 'ō': 'ֹ', 'ɔ': 'ֹ', 'u': 'ֻ', 'ū': 'ֻ'}
_DROP = set(':^ˆ̄̂')          # length/stress marks, folded away
_PUNCT = set('.,;:!?\'"()[]־–—* ')


def _word_heb(w):
    out, cons = '', None
    chars = [c for c in w if c not in _DROP]
    n = len(chars)
    for k, ch in enumerate(chars):
        if ch == 'w':                               # /w/ → u-glide ("וּ")
            if cons is not None:
                out += cons; cons = None
            out += 'וּ'; continue
        if ch in ("'", 'ʾ', 'ʿ'):                   # glottal from א/ה/ע
            if cons is not None:
                out += cons
            prevV = k > 0 and chars[k - 1] in _V
            nextV = k + 1 < n and chars[k + 1] in _V
            cons = 'ה' if (prevV and nextV) else 'א'  # light ה between vowels, else silent א
            continue
        if ch in _V:
            if cons is not None:
                out += cons + _V[ch]; cons = None
            else:
                out += 'א' + _V[ch]                  # vowel onset
        elif ch in _C:
            if _C[ch] == '':                        # ḥ — lost
                continue
            if cons is not None:
                out += cons
            cons = _C[ch]
        elif ch not in _PUNCT:
            if cons is not None:
                out += cons; cons = None
            out += ch
    if cons is not None:
        out += cons
    return out


def translit_to_heb(s):
    """Whole transcription line → pointed Hebrew."""
    if not s:
        return ''
    return ' '.join(_word_heb(w) for w in s.split())
