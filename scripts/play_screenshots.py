# -*- coding: utf-8 -*-
"""Store screenshots of the app, on a real phone viewport.

Plain headless Chrome will not lay a page out below ~500px however small the
window is asked to be, so a "phone" screenshot taken that way is a wide layout
cropped — book names fall off the edge. Playwright honours the emulated metrics,
so this is the way to get a picture of what a phone actually shows.

    py -3 scripts/play_screenshots.py twa/play/screenshots      # server on :5059
"""
import os, sys, time
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5059/'
OUT  = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)

SEED = """
for (const k of ['as_welcome_read','as_tour_seen','as_install_hide','as_notif_hide'])
  localStorage.setItem(k,'1');
localStorage.setItem('as_seen_ver','3.3');
"""

def settle(page, ms=1200):
    page.wait_for_timeout(ms)

def kill_splash(page):
    # the entry splash writes a verse with a quill; press its own "דלג" and wait
    # for it to take itself off, so nothing of it is caught in a picture
    try:
        page.click('#sp-skip', timeout=3000)
    except Exception:
        pass
    for _ in range(40):
        gone = page.evaluate("() => { const s=document.getElementById('samaritan-splash');"
                             " const i=document.getElementById('splash-image');"
                             " return (!s || getComputedStyle(s).display==='none' || !s.isConnected)"
                             "     && (!i || getComputedStyle(i).opacity==='0' || !i.isConnected); }")
        if gone:
            break
        page.wait_for_timeout(400)
    page.evaluate("() => { for(const id of ['samaritan-splash','splash-image']){"
                  " const e=document.getElementById(id); if(e) e.remove(); } }")

def land(page, book, num):
    """open a Samaritan chapter by book id + number, the way the app itself does"""
    page.evaluate("""async ([book, num]) => {
        S.division='samaritan'; S.book=book;
        const books = await api('books?mode=samaritan');
        S.bookName = (books.find(b=>b.id===book)||{}).name || '';
        const ports = await api('portions?book_id='+book+'&mode=samaritan');
        for(const p of ports){
          const rows = await api('sam_chapters?portion_id='+p.id);
          const hit = rows.find(r=>r.number===num);
          if(hit){ await openSamChapter(hit.id, hit.number, p.id, p.name, false); return; }
        }
    }""", [book, num])

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=3,
                         is_mobile=True, has_touch=True, locale='he-IL')
    ctx.add_init_script(SEED)
    page = ctx.new_page()
    page.goto(BASE, wait_until='networkidle')
    kill_splash(page); settle(page, 2200)          # past the auto-fold of the bottom bar

    # 1 — the book list, with the poem in the space beneath it
    page.evaluate("() => { const c=document.getElementById('content'); c.scrollTop = 0; }")
    settle(page, 600)
    page.screenshot(path=os.path.join(OUT, '01-books.png'))

    # 2 — a chapter, in Hebrew letters
    land(page, 1, 1); settle(page, 1500)
    page.evaluate("() => document.querySelectorAll('.verse-bless').forEach(e=>e.remove())")
    page.screenshot(path=os.path.join(OUT, '02-chapter.png'))

    # 3 — the same text in Samaritan script
    page.evaluate("() => { if(!S.samFont) document.getElementById('fontBtn').click(); }")
    settle(page, 1200)
    page.screenshot(path=os.path.join(OUT, '03-samaritan-script.png'))

    # 4 — the verse commentary
    page.evaluate("() => { if(S.samFont) document.getElementById('fontBtn').click(); }")
    settle(page, 500)
    page.evaluate("() => document.getElementById('interpBtn').click()")
    settle(page, 1800)
    page.screenshot(path=os.path.join(OUT, '04-commentary.png'))

    # 5 — the library
    page.evaluate('() => openLibrary()')
    settle(page, 1600)
    page.screenshot(path=os.path.join(OUT, '05-library.png'))

    for f in sorted(os.listdir(OUT)):
        print(' ', f)
    br.close()
