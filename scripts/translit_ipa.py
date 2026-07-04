"""Convert the Ben-Ḥayyim transcription (verse_translit) to IPA with a primary-stress
mark, per his Introduction key (memory: translit-pronunciation-key). Feeds a server-side
TTS engine's SSML <phoneme alphabet="ipa">, which — unlike the browser voice — honours the
stress mark, so we get the correct penultimate (mil'el) stress.

Rules applied:
  consonants: q→ʔ · ʾ/ʿ/'→ʔ (light h between vowels) · ḥ dropped · ṭ→t, ṣ→s (emphatics merged)
              š/ś→ʃ · w→w · others 1:1
  vowels:     a→a · å→ɒ · e→e · ə→ə · i→i · o→o · u→u ; macron & ':' → long ː
  stress:     PENULTIMATE syllable by default (ˈ before its onset); 1-syllable → stressed.
"""
import re

_C = {'b':'b','B':'b','v':'v','f':'f','p':'p','m':'m','w':'w','t':'t','ṭ':'t','d':'d','ḏ':'ð',
      's':'s','ṣ':'s','z':'z','š':'ʃ','Š':'ʃ','ś':'ʃ','ṯ':'θ','l':'l','r':'r','n':'n','y':'j','j':'j',
      'g':'ɡ','ġ':'ɣ','k':'k','q':'ʔ',"'":'ʔ','ʾ':'ʔ','ʿ':'ʔ','ḥ':'','h':'h'}
_V = {'a':'a','å':'ɒ','ā':'aː','ɑ':'ɒ','ɒ':'ɒ','e':'e','ē':'eː','ɛ':'ɛ','ə':'ə','ǝ':'ə',
      'i':'i','ī':'iː','o':'o','ō':'oː','ɔ':'ɔ','u':'u','ū':'uː'}

def _word_ipa(w):
    w = re.sub('[̂̄ˆ^]', '', w)          # drop circumflex/macron-combining/stress carets
    chars = list(w)
    # 1) build a list of segments, each tagged vowel/consonant
    segs = []            # (ipa, is_vowel)
    for k, ch in enumerate(chars):
        if ch == 'w':
            segs.append(('w', False))
        elif ch in ("'", 'ʾ', 'ʿ'):
            prevV = k > 0 and chars[k-1] in _V
            nextV = k+1 < len(chars) and chars[k+1] in _V
            segs.append(('h' if (prevV and nextV) else 'ʔ', False))
        elif ch == ':':
            if segs and segs[-1][0] and not segs[-1][0].endswith('ː'):
                segs[-1] = (segs[-1][0] + 'ː', segs[-1][1])   # lengthen previous vowel
        elif ch in _V:
            segs.append((_V[ch], True))
        elif ch in _C:
            if _C[ch]:
                segs.append((_C[ch], False))
        # else: punctuation → ignore
    # 2) stress: mark the onset of the penultimate syllable (vowel = nucleus)
    v_idx = [i for i, s in enumerate(segs) if s[1]]
    if len(v_idx) >= 2:
        nucleus = v_idx[-2]
        prevV = v_idx[-3] if len(v_idx) >= 3 else -1
        onset = prevV + 1                       # first segment after the preceding vowel
        stress_at = onset
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

def translit_to_ipa(s):
    if not s:
        return ''
    return ' '.join(_word_ipa(w) for w in s.split() if re.search('[A-Za-zʾʿåāēīūōəɑɒɛɔ]', w))

if __name__ == '__main__':
    import sqlite3, os
    db = sqlite3.connect(os.path.join(os.path.dirname(__file__), '..', 'data', 'torah.db'))
    rows = db.execute('''SELECT v.number, t.text FROM verses v JOIN chapters c ON c.id=v.chapter_id
        JOIN books b ON b.id=c.book_id JOIN verse_translit t ON t.verse_id=v.id
        WHERE b.order_n=1 AND c.number=1 ORDER BY v.id LIMIT 5''').fetchall()
    for n, tx in rows:
        print(f'[{n}] {tx}')
        print(f'    IPA: {translit_to_ipa(tx)}\n')
