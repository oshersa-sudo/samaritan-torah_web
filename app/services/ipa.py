"""Ben-Ḥayyim transcription → IPA (with primary-stress marks), for the server-side TTS.
See memory: translit-pronunciation-key. Prototype/CLI: scripts/translit_ipa.py.
"""
import re

_C = {'b': 'b', 'B': 'b', 'v': 'v', 'f': 'f', 'p': 'p', 'm': 'm', 'w': 'w', 't': 't', 'ṭ': 't',
      'd': 'd', 'ḏ': 'ð', 's': 's', 'ṣ': 's', 'z': 'z', 'š': 'ʃ', 'Š': 'ʃ', 'ś': 'ʃ', 'ṯ': 'θ',
      'l': 'l', 'r': 'r', 'n': 'n', 'y': 'j', 'j': 'j', 'g': 'ɡ', 'ġ': 'ɣ', 'k': 'k', 'q': 'ʔ',
      "'": 'ʔ', 'ʾ': 'ʔ', 'ʿ': 'ʔ', 'ḥ': '', 'h': 'h'}
_V = {'a': 'a', 'å': 'ɒ', 'ā': 'aː', 'ɑ': 'ɒ', 'ɒ': 'ɒ', 'e': 'e', 'ē': 'eː', 'ɛ': 'ɛ', 'ə': 'ə',
      'ǝ': 'ə', 'i': 'i', 'ī': 'iː', 'o': 'o', 'ō': 'oː', 'ɔ': 'ɔ', 'u': 'u', 'ū': 'uː'}


def word_ipa(w):
    """IPA for one transcription word, with a primary-stress mark on the penultimate
    syllable (Ben-Ḥayyim's default mil'el); monosyllables are stressed."""
    w = re.sub('[̂̄ˆ^]', '', w)
    chars = list(w)
    segs = []                                   # (ipa, is_vowel)
    for k, ch in enumerate(chars):
        if ch == 'w':
            segs.append(('w', False))
        elif ch in ("'", 'ʾ', 'ʿ'):
            prevV = k > 0 and chars[k - 1] in _V
            nextV = k + 1 < len(chars) and chars[k + 1] in _V
            segs.append(('h' if (prevV and nextV) else 'ʔ', False))
        elif ch == ':':
            if segs and segs[-1][0] and not segs[-1][0].endswith('ː'):
                segs[-1] = (segs[-1][0] + 'ː', segs[-1][1])
        elif ch in _V:
            segs.append((_V[ch], True))
        elif ch in _C and _C[ch]:
            segs.append((_C[ch], False))
    v_idx = [i for i, s in enumerate(segs) if s[1]]
    if len(v_idx) >= 2:
        prevV = v_idx[-3] if len(v_idx) >= 3 else -1
        stress_at = prevV + 1                   # onset of the penultimate syllable
    elif len(v_idx) == 1:
        stress_at = 0
    else:
        stress_at = None
    out = ''
    for i, (ipa, _) in enumerate(segs):
        if i == stress_at:
            out += 'ˈ'
        out += ipa
    return out


def ipa_words(s):
    """Return [(word, ipa)] for the words of a transcription line (for SSML <phoneme>)."""
    out = []
    for w in (s or '').split():
        core = w.strip('.,;:!?\'"()[]־–—* ')
        if not re.search('[A-Za-zʾʿåāēīūōəɑɒɛɔ]', core):
            continue
        ip = word_ipa(core)
        if ip:
            out.append((core, ip))
    return out


def translit_to_ipa(s):
    return ' '.join(ip for _, ip in ipa_words(s))
