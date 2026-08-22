# -*- coding: utf-8 -*-
"""Prove the lexicon split is safe, in the three states that matter.

Run before ever dropping the dictionary tables from torah.db, and again after.
Exits non-zero on any failure so it can gate a deploy.

  A  both files present                — today's state, nothing should change
  B  torah.db stripped, lexicon present — the target state
  C  stripped AND no lexicon            — the Torah must survive alone
"""
import os, sqlite3, subprocess, sys, tempfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
sys.path.insert(0, ROOT); sys.path.insert(0, HERE)
from build_lexicon_db import TABLES

DICT_CHECKS = [
    ('tal_full_lookup', lambda db: [r['root'] for r in db.tal_full_lookup('קמיך')['roots']]),
    ('meaning of תרח',  lambda db: db.tal_full_lookup('תרח').get('meaning')),
    ('phrases',         lambda db: db.dict_phrases_browse('')['total']),
    ('word index',      lambda db: db.dict_words_browse(0, 5)['total']),
    ('dictionary page', lambda db: len(db.get_dict_page(100)['entries'])),
    ('Hebrew search',   lambda db: len(db.dict_he_search('שלום')['results'])),
]
# The Torah side. These must be identical in every state — the whole point.
TORAH_CHECKS = [
    ('verses', 'select count(*) from verses'),
    ('פירוש הפסוק', "select count(*) from verses where trim(coalesce(interpretation,''))<>''"),
    ('פירוש בערבית', "select count(*) from verses where trim(coalesce(interpretation_ar,''))<>''"),
    ('verse_dictionary', 'select count(*) from verse_dictionary'),
    ('word_gloss', 'select count(*) from word_gloss'),
    ('root_index', 'select count(*) from root_index'),
    ('tm_sections', 'select count(*) from tm_sections'),
    ('tzdaka links', 'select count(*) from tzdaka_verse_links'),
    ('bhuq links', 'select count(*) from bhuq_verse_links'),
    ('piyutim', 'select count(*) from piyutim'),
]


def run(label, db_path, lex_path):
    env = dict(os.environ, DB_PATH=db_path, PYTHONIOENCODING='utf-8')
    if lex_path:
        env['LEXICON_PATH'] = lex_path
    else:
        env['LEXICON_PATH'] = os.path.join(ROOT, 'data', '__absent__.db')
    code = '''
import sys, json; sys.path.insert(0, %r)
from app.services import database as db
out = {"dict": {}, "torah": {}}
for n, f in %s:
    try: out["dict"][n] = str(f(db))[:40]
    except Exception as e: out["dict"][n] = "RAISED " + type(e).__name__
c = db.get_connection()
for n, q in %s:
    try: out["torah"][n] = c.execute(q).fetchone()[0]
    except Exception as e: out["torah"][n] = "RAISED " + type(e).__name__
c.close(); print(json.dumps(out, ensure_ascii=False))
''' % (ROOT, 'DICT', 'TORAH')
    code = code.replace('DICT', repr([(n, None) for n, _ in DICT_CHECKS]))  # placeholder
    return env


def main():
    root_data = os.path.join(ROOT, 'data')
    torah = os.path.join(root_data, 'torah.db')
    lexicon = os.path.join(root_data, 'lexicon.db')
    tmp = tempfile.mkdtemp()
    stripped = os.path.join(tmp, 'torah_stripped.db')
    shutil.copy2(torah, stripped)
    c = sqlite3.connect(stripped)
    for t in TABLES:
        c.execute(f'DROP TABLE IF EXISTS {t}')
    c.commit(); c.execute('VACUUM'); c.close()
    print(f'made a stripped copy: {os.path.getsize(stripped)/1024/1024:.1f} MiB '
          f'(from {os.path.getsize(torah)/1024/1024:.1f})')

    baseline, failures = None, 0
    for label, dbp, lexp in [('A both present', torah, lexicon),
                             ('B stripped + lexicon', stripped, lexicon),
                             ('C stripped, no lexicon', stripped, os.path.join(tmp, 'nope.db'))]:
        env = dict(os.environ, DB_PATH=dbp, LEXICON_PATH=lexp, PYTHONIOENCODING='utf-8')
        script = os.path.join(tmp, 'probe.py')
        with open(script, 'w', encoding='utf-8') as f:
            f.write('import sys, json\n'
                    f'sys.path.insert(0, {ROOT!r})\n'
                    'from app.services import database as db\n'
                    'd={}\n'
                    'for n,fn in [("lookup",lambda: [r["root"] for r in db.tal_full_lookup("קמיך")["roots"]]),\n'
                    '             ("meaning",lambda: db.tal_full_lookup("תרח").get("meaning")),\n'
                    '             ("phrases",lambda: db.dict_phrases_browse("")["total"]),\n'
                    '             ("index",lambda: db.dict_words_browse(0,5)["total"]),\n'
                    '             ("page",lambda: len(db.get_dict_page(100)["entries"])),\n'
                    '             ("he",lambda: len(db.dict_he_search("שלום")["results"]))]:\n'
                    '    try: d[n]=str(fn())[:40]\n'
                    '    except Exception as e: d[n]="RAISED "+type(e).__name__\n'
                    't={}\nc=db.get_connection()\n'
                    f'for n,q in {TORAH_CHECKS!r}:\n'
                    '    try: t[n]=c.execute(q).fetchone()[0]\n'
                    '    except Exception as e: t[n]="RAISED "+type(e).__name__\n'
                    'c.close()\nprint(json.dumps({"d":d,"t":t},ensure_ascii=False))\n')
        r = subprocess.run([sys.executable, script], capture_output=True, text=True,
                           encoding='utf-8', env=env)
        if r.returncode:
            print(f'\n{label}: PROCESS FAILED\n{r.stderr[-600:]}'); failures += 1; continue
        import json
        got = json.loads(r.stdout.strip().splitlines()[-1])
        print(f'\n{label}')
        for n, v in got['d'].items():
            bad = str(v).startswith('RAISED')
            print(f'   dict  {n:10s} {"✗ " if bad else "  "}{v}')
            failures += bad and label != 'C stripped, no lexicon'
            if bad and label == 'C stripped, no lexicon':
                print('         (a raise here is a bug: the dictionary must degrade, not throw)')
                failures += 1
        if baseline is None:
            baseline = got['t']
        for n, v in got['t'].items():
            same = v == baseline[n]
            print(f'   torah {n:16s} {"  " if same else "✗ CHANGED "}{v}')
            failures += not same
    shutil.rmtree(tmp, ignore_errors=True)
    print(f'\n{"PASS — safe to drop" if not failures else str(failures)+" FAILURES — do not drop"}')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
