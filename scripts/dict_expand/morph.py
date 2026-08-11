# -*- coding: utf-8 -*-
"""Offline morphological resolver for Samaritan Aramaic surface forms.

Given an inflected word from the piyyutim or from Memar Marqe, find the root it
belongs to and the Hebrew meaning that Tal's dictionary already records for that
root — with a written-out derivation ("how we got there") for every hit, so a
human can audit each proposal before it is written into the dictionary.

Nothing here calls out to a network or a model: it is a rule-based stripper over
the lexicon tables that are already in torah.db.
"""
import re
import sqlite3
import collections

_FINALS = {'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ'}
_NIQQUD = re.compile('[֑-ׇ]')

# ── affix inventory ────────────────────────────────────────────────────────────
# Proclitics: conjunction, relative/genitive, the three prepositions, "from",
# and the article/interrogative he. ש is deliberately NOT a proclitic here —
# in Samaritan Aramaic it is nearly always a root letter (שמיה, שמש).
PROCLITICS = ['ו', 'ד', 'ב', 'כ', 'ל', 'מ', 'ה']

# Verbal/nominal prefixes (stem-forming, not clitics).
VPREFIX = ['את', 'אית', 'ית', 'מת', 'נת', 'תת', 'אש', 'מ', 'א', 'י', 'ת', 'נ']

# Suffixes, longest first so that -כון is taken before -ן.
SUFFIXES = [
    'תהון', 'תכון', 'ינון', 'יהון', 'יכון', 'ניה', 'נהי',
    'כון', 'הון', 'תון', 'ינן', 'נן', 'תן', 'כן', 'הן', 'כם', 'הם', 'נו',
    'יה', 'יו', 'יך', 'יכ', 'ין', 'ים', 'ות', 'תה', 'תא', 'אן', 'נה', 'יא',
    'ה', 'א', 'י', 'ך', 'כ', 'ן', 'ו', 'ת', 'ם',
]

# What each affix means — used to write the derivation line in the report.
AFFIX_HE = {
    'ו': 'ו׳ החיבור', 'ד': 'ד׳ הזיקה/הסמיכות', 'ב': 'ב׳ השימוש', 'כ': 'כ׳ הדמיון',
    'ל': 'ל׳ השימוש', 'מ': 'מ׳ (מן)', 'ה': 'ה׳ הידיעה/השאלה',
    'את': 'תבנית אתפעל', 'אית': 'תבנית אתפעל', 'ית': 'תבנית אתפעל',
    'מת': 'בינוני אתפעל', 'נת': 'תבנית אתפעל', 'תת': 'תבנית אתפעל',
    'אש': 'תבנית אשתפעל', 'מ': 'מ׳ הבינוני/שם הפעולה', 'א': 'א׳ אפעל',
    'י': 'י׳ העתיד', 'ת': 'ת׳ העתיד/נקבה', 'נ': 'נ׳ העתיד (רבים)',
    'כון': 'כינוי חבור: שלכם', 'הון': 'כינוי חבור: שלהם', 'תון': 'גוף ב׳ רבים',
    'נן': 'גוף א׳ רבים / שלנו', 'ינן': 'גוף א׳ רבים', 'כן': 'שלכן', 'הן': 'שלהן',
    'תן': 'גוף ב׳ רבות', 'תהון': 'שלהם', 'תכון': 'שלכם', 'כם': 'שלכם', 'הם': 'שלהם',
    'ינון': 'ריבוי + כינוי', 'יהון': 'ריבוי + שלהם', 'יכון': 'ריבוי + שלכם',
    'ניה': 'כינוי מושא', 'נהי': 'כינוי מושא',
    'יה': 'ריבוי / שלו', 'יו': 'שלו', 'יך': 'שלך', 'יכ': 'שלך', 'יא': 'ריבוי מיודע',
    'ין': 'ריבוי זכר', 'ים': 'ריבוי זכר', 'ות': 'ריבוי נקבה', 'אן': 'ריבוי נקבה',
    'תה': 'סיומת נקבה/מיודעת', 'תא': 'סיומת נקבה מיודעת', 'נה': 'שלנו/שלו',
    'נו': 'שלנו', 'ה': 'ה׳ המיודעת / שלו', 'א': 'א׳ המיודעת', 'י': 'שלי / ריבוי',
    'ך': 'שלך', 'כ': 'שלך', 'ן': 'ריבוי / שלהן', 'ו': 'גוף ג׳ רבים / שלו',
    'ת': 'גוף א׳/ב׳ עבר', 'ם': 'ריבוי',
}


def bare(w):
    w = _NIQQUD.sub('', w or '')
    return w.strip(' .,;:!?"\'׳״־-()[]•')


def norm(w):
    return ''.join(_FINALS.get(c, c) for c in bare(w))


def tokens(s):
    """The whole words of a Hebrew/Aramaic string.

    Niqqud is stripped BEFORE splitting, not after. A vocalised word does not
    match [א-ת]{2,} in one piece — אֵין comes out as "ין" and אֱלֹהִים as three
    fragments — and 192 of the 409 Memar Marqe passages carry a vocalised Hebrew
    translation, so splitting first shreds nearly half the parallel text."""
    return re.findall(r'[א-ת]{2,}', _NIQQUD.sub('', s or ''))


# Stems are compared in normalised form (ן→נ, ם→מ …), so the suffix inventory
# has to be folded the same way — otherwise ־ן never matches טבן→טבנ. Keep the
# unfolded spelling alongside it for the derivation text.
SUFFIXES_N = []
_seen_suf = set()
for _s in SUFFIXES:
    _n = norm(_s)
    if _n and _n not in _seen_suf:
        _seen_suf.add(_n)
        SUFFIXES_N.append((_n, _s))
SUFFIXES_N.sort(key=lambda t: -len(t[0]))


# Weak-radical reconstruction (בנ→בנה, קמ→קום, על→עלל, פל→נפל) was measured and
# dropped: on the short, frequent words it fires on it invents roots — לנו (370
# occurrences) came out as לון "ללון, לשכון", ובו/דבו as גו, ונו as נון. It cost
# more than it bought, so it is gone rather than merely down-weighted.


class Lexicon:
    """Every word→root / root→meaning table already in torah.db, loaded once."""

    def __init__(self, db):
        conn = sqlite3.connect(db)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        self.lemma = {}         # word_norm -> [root_norm]  Tal head-words
        self.root_senses = {}   # root_norm -> [{lemma,pos,gloss,page}]
        self.roots = {}         # root_norm -> root (surface spelling)
        self.lemma_entries = {}  # word_norm -> [{lemma,pos,gloss,page,root}]
        for r in c.execute("SELECT lemma_norm, root, root_norm, lemma, pos, gloss_he, printed "
                           "FROM tal_auth_entries"):
            rt, rn = (r['root'] or '').strip(), (r['root_norm'] or '').strip()
            g = (r['gloss_he'] or '').strip()
            ent = {'lemma': r['lemma'] or '', 'pos': r['pos'] or '', 'gloss': g,
                   'page': r['printed'], 'root': rn}
            if r['lemma_norm'] and g:
                self.lemma_entries.setdefault(r['lemma_norm'], []).append(ent)
            if rn:
                self.roots.setdefault(rn, rt or rn)
                if r['lemma_norm']:
                    self.lemma.setdefault(r['lemma_norm'], [])
                    if rn not in self.lemma[r['lemma_norm']]:
                        self.lemma[r['lemma_norm']].append(rn)
                if g:
                    self.root_senses.setdefault(rn, []).append(ent)

        self.forms = {}        # form_norm -> [root_norm]   Tal's own forms index
        for r in c.execute("SELECT form_norm, root_norm FROM tal_forms"):
            if r['form_norm'] and r['root_norm']:
                self.forms.setdefault(r['form_norm'], []).append(r['root_norm'])

        self.wgloss = {}       # word_norm -> (root_norm, gloss)  every Torah word
        for r in c.execute("SELECT word, root, gloss FROM tal_word_gloss"):
            wn = norm(r['word'])
            if wn and wn not in self.wgloss:
                self.wgloss[wn] = (norm(r['root'] or ''), (r['gloss'] or '').strip())

        self.rindex = {}       # form_norm -> [root_norm]   Torah root index
        for r in c.execute("SELECT DISTINCT form_norm, root_norm FROM root_index "
                           "WHERE form_norm IS NOT NULL"):
            self.rindex.setdefault(r['form_norm'], []).append(r['root_norm'])

        self.dri = {}          # word_norm -> [root_norm]   older forms index
        for r in c.execute("SELECT word, root FROM dict_root_index"):
            self.dri.setdefault(norm(r['word']), []).append(norm(r['root']))

        # Older (English-gloss) dictionary, reachable by root.
        self.root_en = {}
        for r in c.execute("SELECT dre.root, e.lemma, e.pos, e.gloss_en, e.gloss_he, e.page "
                           "FROM dict_root_entries dre JOIN dict_entries e ON e.id=dre.entry_id "
                           "ORDER BY dre.tier"):
            self.root_en.setdefault(norm(r['root']), []).append(
                {'lemma': r['lemma'] or '', 'pos': r['pos'] or '',
                 'gloss': (r['gloss_he'] or r['gloss_en'] or '').strip(), 'page': r['page']})

        # Surface forms quoted inside the dictionary's own citations -> that entry's root.
        self.cited = {}
        for r in c.execute("SELECT c.quote, e.root FROM dict_citations c "
                           "JOIN dict_forms f ON f.id=c.form_id "
                           "JOIN dict_entries e ON e.id=f.entry_id "
                           "WHERE TRIM(COALESCE(e.root,''))<>''"):
            rn = norm(r['root'])
            for w in re.findall(r'[א-ת]{2,}', r['quote'] or ''):
                self.cited.setdefault(norm(w), set()).add(rn)

        # Hand-made piyyut glossary (313 words) — highest trust for piyyut vocabulary.
        self.piyut = {}
        for r in c.execute("SELECT word, gloss FROM piyutim_dict"):
            self.piyut[norm(r['word'])] = (r['gloss'] or '').strip()

        # Glosses already computed for piyyut words in an earlier pass.
        self.pw = {}
        for r in c.execute("SELECT word, definition, tal_root FROM piyutim_words "
                           "WHERE TRIM(COALESCE(definition,''))<>'' "
                           "   OR TRIM(COALESCE(tal_root,''))<>''"):
            self.pw[norm(r['word'])] = ((r['tal_root'] or '').strip(),
                                        (r['definition'] or '').strip())

        # ── Hebrew side: every surface word of the Samaritan Torah, with its
        # Hebrew gloss. Lets us tell "unknown Aramaic" apart from plain Hebrew,
        # which the piyyutim are full of.
        # word_gloss is a per-token table, so a single misaligned verse can put a
        # wrong gloss on a word. Take the MAJORITY gloss per word, not the first.
        votes = collections.defaultdict(collections.Counter)
        for r in c.execute("SELECT word, he FROM word_gloss WHERE TRIM(COALESCE(word,''))<>''"):
            wn = norm(r['word'])
            if wn:
                votes[wn][(r['he'] or '').strip()] += 1
        self.heb = {}          # word_norm -> gloss (may be '')
        for wn, cnt in votes.items():
            g, n = cnt.most_common(1)[0]
            # a lone vote on a frequent word is a misalignment, not a gloss
            self.heb[wn] = g if (n > 1 or sum(cnt.values()) == 1) else ''
        self.torah_words = set(self.heb)
        for r in c.execute("SELECT DISTINCT lemma, hebrew FROM meliz_gloss "
                           "WHERE TRIM(COALESCE(lemma,''))<>''"):
            wn = norm(r['lemma'])
            if wn and not self.heb.get(wn):
                self.heb[wn] = (r['hebrew'] or '').strip()
        # Aramaic->Hebrew word alignment of the targum
        self.align = {}
        for r in c.execute("SELECT ar, he FROM word_align WHERE TRIM(COALESCE(ar,''))<>''"):
            wn = norm(r['ar'])
            if wn and wn not in self.align:
                self.align[wn] = (r['he'] or '').strip()

        # Proper names, so משה is not read off the root משח "מידה". Taken from the
        # dictionary's own pr.n. entries and from the Samaritan personalities list.
        self.proper = set()
        for r in c.execute(
                "SELECT lemma_norm FROM tal_auth_entries WHERE lemma_norm IS NOT NULL AND ("
                "  LOWER(COALESCE(pos,'')) LIKE 'pr%n%' OR gloss_he LIKE 'שם פרטי%' "
                "  OR gloss_he LIKE 'שם מקום%' OR gloss_he LIKE 'שם של מקום%')"):
            self.proper.add(r['lemma_norm'])
        for r in c.execute("SELECT name_he FROM people WHERE TRIM(COALESCE(name_he,''))<>''"):
            for w in re.findall(r'[א-ת]{2,}', r['name_he']):
                self.proper.add(norm(w))
        conn.close()

    # ── choosing WHICH sense of a head-word/root to show ──────────────────────
    @staticmethod
    def _sense_penalty(e):
        """Lower is better. Alphabet-letter entries ('האות השנייה באלף-בית') and
        proper nouns are real dictionary entries but almost never what an
        inflected form in a piyyut means, so they sink below the common senses."""
        g, pos = e.get('gloss', ''), (e.get('pos') or '').lower()
        p = 0
        if re.search(r'האות\s+\S+\s+ב?אלף', g) or 'שם האות' in g:
            p += 6
        if g.startswith('שם פרטי') or g.startswith('שם מקום') or g.startswith('שם של מקום'):
            p += 4
        if pos.startswith('pr. n') or 'pr.n' in pos:
            p += 4
        if not re.search(r'[א-ת]', g):        # English-only gloss
            p += 2
        if len(g) < 3:
            p += 1
        return p

    def rank(self, entries, stem=None):
        """Order candidate senses: exact head-word match first, then the
        penalties above, then the dictionary's own order."""
        sn = norm(stem) if stem else None
        return sorted(
            entries,
            key=lambda e: (0 if (sn and norm(e.get('lemma', '')) == sn) else 1,
                           self._sense_penalty(e)))

    # ── root lookup for one candidate stem ────────────────────────────────────
    def roots_of(self, cand):
        """(roots, how) for a fully-stripped stem, most authoritative tier first."""
        cn = norm(cand)
        if len(cn) < 2:
            return [], ''
        if cn in self.lemma:
            return self.lemma[cn], 'ערך ראשי במילון טל'
        if cn in self.roots:
            return [cn], 'המילה עצמה שורש במילון טל'
        if cn in self.forms:
            return self.forms[cn], 'אינדקס הנטיות של טל'
        if cn in self.wgloss and self.wgloss[cn][0]:
            return [self.wgloss[cn][0]], 'מילון המילים של התורה (tal_word_gloss)'
        if cn in self.rindex:
            return self.rindex[cn], 'אינדקס השורשים של נוסח התורה'
        if cn in self.dri:
            return self.dri[cn], 'אינדקס הנטיות הישן'
        if cn in self.cited:
            return sorted(self.cited[cn]), 'ציטוט בגוף המילון (הערך שבו מובאת המילה)'
        return [], ''

    def senses(self, root_norm, stem=None):
        """All dictionary senses of a root, best first. When the surface stem is
        itself one of the root's head-words, that head-word's own entry leads —
        otherwise a homograph like מרה would be read off its neighbour's entry."""
        ents = self.root_senses.get(root_norm) or self.root_en.get(root_norm) or []
        return self.rank(ents, stem)

    def head_entries(self, cand):
        """Entries whose head-word IS this stem — the most direct answer the
        dictionary can give, and the one to prefer over any root detour."""
        return self.rank(self.lemma_entries.get(norm(cand), []), cand)

    def direct_gloss(self, cand):
        """A meaning attached to the stem itself, when its root carries no
        dictionary entry. (gloss, how) or (None, '')."""
        cn = norm(cand)
        if len(cn) < 2:
            return None, ''
        he = self.head_entries(cn)
        if he:
            return he[0]['gloss'], 'ערך ראשי במילון טל'
        if cn in self.piyut and self.piyut[cn]:
            return self.piyut[cn], 'גלוסר הפיוטים הידני'
        g = self.wgloss.get(cn, ('', ''))[1]
        if g:
            return g, 'מילון המילים של התורה (tal_word_gloss)'
        if self.align.get(cn):
            return self.align[cn], 'יישור מילה-במילה של התרגום (word_align)'
        if self.pw.get(cn) and self.pw[cn][1]:
            return self.pw[cn][1], 'הגדרה קיימת בטבלת מילות הפיוטים'
        return None, ''


def candidates(word, deep=True):
    """Every (stem, ops, cost) the stripper can reach: up to two proclitics, one
    stem-prefix and up to two suffixes, ordered by how little was removed.
    `deep` also allows a 2-letter remainder (needed for בכל→כל, הזה→זה)."""
    base = norm(word)
    seen, out = set(), []
    floor = 2 if deep else 3

    def push(stem, ops, cost):
        if len(stem) >= 2 and (stem, tuple(ops)) not in seen:
            seen.add((stem, tuple(ops)))
            out.append((stem, list(ops), cost))

    push(base, [], 0)
    pro_stems = [(base, [])]
    for _ in range(2):
        nxt = []
        for s, ops in pro_stems:
            for p in PROCLITICS:
                if s.startswith(p) and len(s) - len(p) >= floor:
                    nxt.append((s[len(p):], ops + [('pro', p)]))
        for s, ops in nxt:
            push(s, ops, len(ops))
        pro_stems += nxt

    all_stems = list(pro_stems)
    for _ in range(2):
        nxt = []
        for s, ops in all_stems:
            for sufn, suf in SUFFIXES_N:
                if s.endswith(sufn) and len(s) - len(sufn) >= 2:
                    nxt.append((s[:-len(sufn)], ops + [('suf', suf)]))
        for s, ops in nxt:
            push(s, ops, len(ops))
        all_stems += nxt

    for s, ops in list(all_stems):
        for vp in VPREFIX:
            rest = len(s) - len(vp)
            if s.startswith(vp) and rest >= 2:
                # Reading the first letter as a preformative is a real claim about
                # the word; on a two-letter residue it is a guess, and it must not
                # come as cheap as peeling a plural ־ן (else מרן is read as מ+רן
                # "saddle" instead of מר "lord" + ־ן).
                push(s[len(vp):], ops + [('vpre', vp)], len(ops) + (2 if rest <= 2 else 1))

    out.sort(key=lambda t: (t[2], -len(t[0])))
    return out


def describe(ops):
    parts = []
    for kind, a in ops:
        lab = AFFIX_HE.get(a, a)
        if kind == 'pro':
            parts.append(f'הסרת תחילית {a}׳ ({lab})')
        elif kind == 'vpre':
            parts.append(f'הסרת תחילית {a} ({lab})')
        else:
            parts.append(f'הסרת סיומת ־{a} ({lab})')
    return ' ← '.join(parts) if parts else 'המילה כמות שהיא'


def analyze_all(word, lex, limit=3):
    """Every root this surface form could belong to, best first.

    Storing more than one is the whole point: משה is both the name and the root
    משח "measure", and rather than gambling on one, the dictionary shows both and
    lets the reader choose. Same for any homograph."""
    seen, out = set(), []
    for rec in _analyses(word, lex):
        k = rec.get('root_norm') or rec['gloss'][:24]
        if k in seen:
            continue
        seen.add(k)
        out.append(rec)
        if len(out) >= limit:
            break
    # When the dictionary lists the word itself as a proper name (משה, ישראל),
    # that reading leads — a name in a piyyut is a name, not the root it shares.
    wn = norm(word)
    if wn in lex.proper:
        out.sort(key=lambda r: 0 if r.get('root_norm') == wn else 1)
    for i, r in enumerate(out):
        r['rank'] = i
    return out


def analyze(word, lex):
    """The single best analysis, or None."""
    a = analyze_all(word, lex, limit=1)
    return a[0] if a else None


def _analyses(word, lex):
    """All analyses, sorted by score. See analyze_all/analyze."""
    wn = norm(word)
    if len(wn) < 2:
        return []

    # How much to distrust each kind of evidence, added to the stripping depth.
    # Lower is better; the whole point is that a light derivation off a solid
    # head-word beats a deep derivation off a fuzzy index.
    EV = {'ערך ראשי במילון טל': 0, 'המילה עצמה שורש במילון טל': 1,
          'גלוסר הפיוטים (piyutim_dict)': 1, 'אינדקס הנטיות של טל': 2,
          'מילון המילים של התורה (tal_word_gloss)': 2,
          'אינדקס השורשים של נוסח התורה': 3, 'אינדקס הנטיות הישן': 4,
          'ציטוט בגוף המילון (הערך שבו מובאת המילה)': 5}

    found = []

    def mk(stem, ops, cost, rn, entries, how, lang='ארמית'):
        if not entries:
            return
        e = entries[0]
        # A proper name that the dictionary lists under its own name as root is
        # the dictionary asserting the name reading; only a light penalty, and
        # the rival reading is kept anyway as a second root.
        pen = lex._sense_penalty(e)
        if norm(stem) in lex.proper and rn and rn == norm(stem):
            pen = min(pen, 1)
        score = 2 * cost + EV.get(how, 4) + pen
        found.append((score, {'word': word, 'stem': stem, 'root': lex.roots.get(rn, rn),
                              'root_norm': rn, 'gloss': e['gloss'], 'senses': entries[:6],
                              'ops': ops, 'how': how, 'tier': cost, 'lang': lang,
                              'score': score, 'derivation': describe(ops)}))

    for stem, ops, cost in candidates(word):
        he = lex.head_entries(stem)
        if he:
            mk(stem, ops, cost, he[0].get('root') or '', he, 'ערך ראשי במילון טל')
            # a head-word with several roots (משה: the name, and משח "measure")
            # contributes each of them, so both survive into the entry
            for alt_rn in lex.lemma.get(norm(stem), []):
                if alt_rn != (he[0].get('root') or ''):
                    mk(stem, ops, cost, alt_rn, lex.senses(alt_rn, stem), 'ערך ראשי במילון טל')
        roots, how = lex.roots_of(stem)
        for rn in roots:
            mk(stem, ops, cost, rn, lex.senses(rn, stem), how)

    if found:
        found.sort(key=lambda t: t[0])
        return [r for _, r in found]

    # the piyyut glossary, then a meaning attached to the form itself
    if wn in lex.piyut and lex.piyut[wn]:
        return [{'word': word, 'stem': wn, 'root': (lex.pw.get(wn) or ('', ''))[0],
                 'root_norm': '', 'gloss': lex.piyut[wn], 'senses': [], 'ops': [],
                 'how': 'גלוסר הפיוטים (piyutim_dict)', 'tier': 0, 'score': 1,
                 'lang': 'ארמית', 'derivation': 'ערך קיים בגלוסר הפיוטים'}]
    for stem, ops, cost in candidates(word):
        g, how = lex.direct_gloss(stem)
        if g:
            roots, _ = lex.roots_of(stem)
            rn = roots[0] if roots else ''
            return [{'word': word, 'stem': stem, 'root': lex.roots.get(rn, rn),
                     'root_norm': rn, 'gloss': g, 'senses': [], 'ops': ops,
                     'how': how + ' (פירוש ישיר לצורה, ללא ערך שורש)',
                     'tier': cost + 1, 'score': 2 * cost + 6, 'lang': 'ארמית',
                     'derivation': describe(ops)}]

    # plain Hebrew — the piyyutim mix Hebrew in freely; tag it, don't file it as
    # an unexplained Aramaic word.
    for stem, ops, cost in candidates(word):
        sn = norm(stem)
        if sn in lex.torah_words and lex.heb.get(sn):
            return [{'word': word, 'stem': stem, 'root': '', 'root_norm': '',
                     'gloss': lex.heb[sn], 'senses': [], 'ops': ops,
                     'how': 'מילה עברית מנוסח התורה השומרוני', 'tier': cost,
                     'score': 2 * cost + 8, 'lang': 'עברית', 'derivation': describe(ops)}]
    return []
