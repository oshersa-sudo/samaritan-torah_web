# -*- coding: utf-8 -*-
"""Repair the abbreviation marks mis-read from the Abu'l-Faraj scan.

The scan carries no text layer, so the transcription was done by eye, and a
raised geresh on the book abbreviations was consistently read as a yod:
בר׳ → ברי, שמ׳ → שמי, ויק׳ → ויקי, במ׳ → במי, דב׳ → דבי. The same slip turned
the edition's siglum נ״ש (נוסח שומרוני) into נייש.

The danger is that four of the five strings are also ordinary words - שמי
("my name", as in זה שמי לעולם), במי ("in whom"), ברי ("of sound mind"; in
Marqe's Aramaic "sons of"), דבי. A blind replace would corrupt scripture. So a
hit counts as an abbreviation only when BOTH hold:
  * it opens a citation - preceded by '(' or a ';' / '؛' separating two
    citations inside one parenthesis, and
  * it is followed by a gematria chapter and an Arabic-numeral verse.

Source of truth is the JSONL; the DB is rebuilt from it by bhuq_import.py.

usage:  py -3 scripts/fix_bhuq_abbrev.py            # dry run, prints samples
        py -3 scripts/fix_bhuq_abbrev.py --apply
"""
import io, json, os, re, sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSONL = os.path.join(_ROOT, 'data', 'bhuq_sections.jsonl')

ABBR = {'ברי': 'בר׳', 'שמי': 'שמ׳', 'ויקי': 'ויק׳', 'במי': 'במ׳', 'דבי': 'דב׳'}
SIGLA = {'נייש': 'נ״ש'}

# (?<=[(;؛])\s*  - opens a citation;  (?=\s+gematria\s+digit) - is one
CITE = re.compile(r'(?<=[(;؛])(\s*)(' + '|'.join(sorted(ABBR, key=len, reverse=True)) +
                  r')(?=\s+[א-ת]{1,4}\s+\d)')
BARE = re.compile(r'(?<![א-ת])(' + '|'.join(ABBR) + r')(?![א-ת])')


def fix(s):
    """Return (new_text, n_abbrev, n_sigla)."""
    if not s:
        return s, 0, 0
    n1 = 0

    def sub(m):
        nonlocal n1
        n1 += 1
        return m.group(1) + ABBR[m.group(2)]

    s = CITE.sub(sub, s)
    n2 = 0
    for bad, good in SIGLA.items():
        n2 += s.count(bad)
        s = s.replace(bad, good)
    return s, n1, n2


def main():
    apply_it = '--apply' in sys.argv
    rows = [json.loads(l) for l in io.open(JSONL, encoding='utf-8') if l.strip()]
    tot_a = tot_s = 0
    samples, left = [], {}
    for r in rows:
        for col in ('text', 'title', 'arabic'):
            before = r.get(col) or ''
            after, a, s = fix(before)
            tot_a += a
            tot_s += s
            if (a or s) and len(samples) < 6:
                i = min((before.find(k) for k in list(ABBR) + list(SIGLA)
                         if before.find(k) >= 0), default=0)
                samples.append((r['ord'], col, before[max(0, i - 55):i + 60],
                                after[max(0, i - 55):i + 60]))
            if apply_it:
                r[col] = after
            # anything still bare after the fix must be a real word - collect it
            for m in BARE.finditer(after):
                left.setdefault(m.group(1), []).append(
                    after[max(0, m.start() - 26):m.end() + 26].replace('\n', ' '))

    out = io.open(os.path.join(_ROOT, 'data', 'bhuq_abbrev_report.txt'), 'w', encoding='utf-8')
    out.write('citations repaired : %d\n' % tot_a)
    out.write('sigla repaired     : %d\n\n' % tot_s)
    out.write('=== before / after ===\n')
    for o, col, b, a in samples:
        out.write('  ord %-4s %-7s\n    -  %s\n    +  %s\n' % (o, col, b, a))
    out.write('\n=== left untouched (must all be ordinary words) ===\n')
    for k in sorted(left):
        out.write('  %-6s x%-4d e.g. …%s…\n' % (k, len(left[k]), left[k][0]))
    out.close()

    if apply_it:
        with io.open(JSONL, 'w', encoding='utf-8', newline='') as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
        print('APPLIED  citations=%d sigla=%d' % (tot_a, tot_s))
    else:
        print('DRY RUN  citations=%d sigla=%d  (report: data/bhuq_abbrev_report.txt)'
              % (tot_a, tot_s))


if __name__ == '__main__':
    main()
