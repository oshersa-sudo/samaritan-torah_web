# -*- coding: utf-8 -*-
"""The smoke test: does the app still stand up and answer?

Two parts. The first talks to the API only and needs nothing but Flask — that is
what runs in CI on every push. The second drives a real browser through the app
and runs only where Playwright is installed (locally, or in CI once the browsers
are cached); without it, it says so and is skipped rather than failing.

    py -3 tests/smoke.py                 # starts its own server on a free port
    py -3 tests/smoke.py --base URL      # tests something already running
    py -3 tests/smoke.py --no-browser    # the API part alone
"""
import argparse, json, os, socket, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILED = []


def check(name, ok, detail=''):
    print(('  ✓ ' if ok else '  ✗ ') + name + (('  — ' + str(detail)) if detail else ''))
    if not ok:
        FAILED.append(name)
    return ok


def get(base, path, timeout=30):
    req = urllib.request.Request(base + path, headers={'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def get_json(base, path):
    st, body = get(base, path)
    return st, json.loads(body.decode('utf-8'))


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def start_server(port):
    env = dict(os.environ, PORT=str(port))
    proc = subprocess.Popen([sys.executable, os.path.join('web', 'server.py')],
                            cwd=ROOT, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = 'http://127.0.0.1:%d' % port
    for _ in range(60):
        try:
            get(base, '/healthz', timeout=3)
            return proc, base
        except Exception:
            time.sleep(0.5)
    proc.kill()
    sys.exit('the server did not come up')


# ── the API ─────────────────────────────────────────────────────────────────
def test_api(base):
    print('\nAPI')
    st, h = get_json(base, '/healthz')
    check('healthz answers', st == 200 and h.get('ok') and h.get('books') == 5, h)

    st, books = get_json(base, '/api/books?mode=samaritan')
    check('five books, each with its counts', st == 200 and len(books) == 5
          and all(b.get('n_portions') and b.get('n_chapters') for b in books))

    # the canon this project keeps: the chapter count of every book
    CANON = {'בראשית': 250, 'שמות': 198, 'ויקרא': 129, 'במדבר': 212, 'דברים': 160}
    got = {b['name']: b['n_chapters'] for b in books}
    check('the Samaritan chapter counts are what they were', got == CANON, got)

    st, ports = get_json(base, '/api/portions?book_id=1&mode=samaritan')
    check('Genesis has its portions', st == 200 and len(ports) >= 9, len(ports))

    st, chs = get_json(base, '/api/sam_chapters?portion_id=%d' % ports[0]['id'])
    check('a portion lists its chapters', st == 200 and chs and chs[0].get('number') == 1)

    st, vs = get_json(base, '/api/sam_verses?sam_ch_id=%d' % chs[0]['id'])
    check('a chapter has verses with text', st == 200 and vs and vs[0].get('text'))
    check('a chapter does NOT carry the Jewish commentaries',
          all('cassuto' not in v for v in vs))
    st, full = get_json(base, '/api/sam_verses?sam_ch_id=%d&full=1' % chs[0]['id'])
    check('…but ?full=1 does', all('cassuto' in v for v in full))

    st, res = get_json(base, '/api/search?q=%s&exact=0&root=0' % urllib.parse.quote('ברא'))
    check('search finds something', st == 200 and (len(res) if isinstance(res, list) else len(res)) > 0)

    st, marks = get_json(base, '/api/sam_chapter_marks?sam_ch_id=%d' % chs[0]['id'])
    check('chapter marks carry the animation overrides', st == 200 and 'anim' in marks)

    st, am = get_json(base, '/api/anim_marks?book_id=3&ends=' + urllib.parse.quote('כאשר צוה יהוה את משה'))
    check('anim_marks answers per chapter', st == 200 and len(am) > 100, len(am))

    st, body = get(base, '/manifest.json')
    m = json.loads(body.decode('utf-8'))
    check('the manifest names a maskable icon', st == 200
          and any(i.get('purpose') == 'maskable' for i in m.get('icons', [])))

    for path in ('/sw.js', '/static/app.js', '/static/style.css',
                 '/fonts/Sam_font.ttf', '/static/data/calendar/2026.json'):
        st, body = get(base, path)
        check('serves ' + path, st == 200 and len(body) > 100, len(body))

    st, body = get(base, '/t/sam/1/8/10')
    check('a deep link is served the app itself', st == 200 and b'id="app"' in body)


# ── the app in a browser ────────────────────────────────────────────────────
def test_browser(base):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('\nBROWSER — skipped (playwright is not installed here)')
        return
    print('\nBROWSER')
    seed = ("for (const k of ['as_welcome_read','as_tour_seen','as_install_hide','as_notif_hide'])"
            " localStorage.setItem(k,'1'); localStorage.setItem('as_seen_ver','3.3');")
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, locale='he-IL')
        ctx.add_init_script(seed)
        pg = ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)[:120]))

        pg.goto(base + '/', wait_until='load')
        try: pg.click('#sp-skip', timeout=5000)
        except Exception: pass
        pg.wait_for_timeout(2500)
        check('the book list paints', pg.evaluate("() => document.querySelectorAll('.listbtn').length") == 5)

        # a deep link opens the very chapter it names
        pg.goto(base + '/t/sam/1/1/3', wait_until='load')
        try: pg.click('#sp-skip', timeout=5000)
        except Exception: pass
        pg.wait_for_timeout(3500)
        st = pg.evaluate("() => ({view: S.view, num: S.curChNum, div: S.division, verses: (S.verses||[]).length})")
        check('a deep link opens its chapter', st['view'] == 'verses' and st['num'] == 3
              and st['div'] == 'samaritan' and st['verses'] > 0, st)

        # …and the address follows the reader
        pg.evaluate("() => showBooks()")
        pg.wait_for_timeout(1200)
        check('going back to the books writes /', pg.evaluate("() => location.pathname") == '/')
        pg.go_back()
        pg.wait_for_timeout(2500)
        check('Back returns to the chapter',
              pg.evaluate("() => S.view") == 'verses', pg.evaluate("() => location.pathname"))

        check('no page errors', not errors, errors[:3])
        br.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base')
    ap.add_argument('--no-browser', action='store_true')
    a = ap.parse_args()
    proc = None
    base = a.base
    if not base:
        port = free_port()
        proc, base = start_server(port)
        print('server on', base)
    try:
        test_api(base)
        if not a.no_browser:
            test_browser(base)
    finally:
        if proc:
            proc.kill()
    print('\n%d checks failed' % len(FAILED) if FAILED else '\nall checks passed')
    sys.exit(1 if FAILED else 0)


if __name__ == '__main__':
    main()
