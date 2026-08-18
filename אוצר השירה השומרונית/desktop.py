# -*- coding: utf-8 -*-
"""אוצר השירה השומרונית — as a window, not as a web page.

    py -3 desktop.py            open the archive
    py -3 desktop.py --browser  fall back to the default browser

There is still a server. There has to be: the page asks for the catalogue over
HTTP, and a recording is streamed with Range requests so it can be seeked into
— neither of which works from a file:// page. What is different is that the
server is not yours to start or to think about. It comes up inside this
process on a port the operating system hands out, it is reachable only from
this machine, and it dies with the window. No console, no address to type, no
port to remember.

The window itself is the system's own — Edge's WebView2, which Windows already
has — so this is a real application window with a real title bar, not a
browser tab pretending.
"""
import os
import socket
import sys
import threading
import time
import traceback
import urllib.request

# serve.py is read at run time, so the packager never sees what it imports and
# would leave every one of these out of the bundle. Naming them here is what
# puts them in. Removing this block builds a program that opens a window onto
# nothing — which is exactly what it did the first time.
import base64            # noqa: F401
import email             # noqa: F401
import hashlib           # noqa: F401
import hmac              # noqa: F401
import html              # noqa: F401
import http.server       # noqa: F401
import json              # noqa: F401
import mimetypes         # noqa: F401
import posixpath         # noqa: F401
import re                # noqa: F401
import shutil            # noqa: F401
import socketserver      # noqa: F401
import subprocess        # noqa: F401
import unicodedata       # noqa: F401
import urllib.parse      # noqa: F401
import uuid              # noqa: F401

def _home():
    """Where the archive actually lives.

    Built as one file, the program carries a copy of the page and the
    catalogue inside itself, unpacked to a temporary folder that is wiped when
    it closes. That copy is fine to read and useless to write: an edit made
    there would vanish. So if the executable is sitting in the archive's own
    folder — the one with serve.py and data/catalog.json in it — that folder
    wins, and the built-in copy is only the fallback for running it from
    somewhere else.
    """
    if getattr(sys, 'frozen', False):
        beside = os.path.dirname(os.path.abspath(sys.executable))
        if (os.path.exists(os.path.join(beside, 'serve.py'))
                and os.path.exists(os.path.join(beside, 'data', 'catalog.json'))):
            return beside, True
        return getattr(sys, '_MEIPASS', beside), False
    return os.path.dirname(os.path.abspath(__file__)), True


HERE, WRITABLE = _home()
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'scripts'))


def version():
    try:
        with open(os.path.join(HERE, 'VERSION'), encoding='utf-8') as fh:
            return fh.read().strip()
    except OSError:
        return '0.0.0'


def free_port():
    """A port nobody else is on, bound to this machine only."""
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def log_path():
    return os.path.join(HERE if WRITABLE else
                        os.environ.get('TEMP', HERE), 'data', 'desktop.log') \
        if WRITABLE else os.path.join(os.environ.get('TEMP', HERE), 'shira-desktop.log')


def note(msg):
    """A window with no console has to write its troubles down somewhere."""
    try:
        p = log_path()
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'a', encoding='utf-8') as fh:
            fh.write('%s  %s\n' % (time.strftime('%Y-%m-%d %H:%M:%S'), msg))
    except Exception:                               # noqa: BLE001
        pass


def serve(port):
    """Run the archive's own server, quietly, on this thread."""
    os.environ['SHIRA_PORT'] = str(port)
    import runpy
    saved = sys.argv
    sys.argv = ['serve.py']
    # BaseException, not Exception: a SystemExit or a KeyboardInterrupt raised
    # in here would otherwise end the thread without a word, and the window
    # would sit waiting on a server that had already given up.
    try:
        note('starting the server from %s on port %d' % (HERE, port))
        runpy.run_path(os.path.join(HERE, 'serve.py'), run_name='__main__')
        note('the server returned on its own')
    except BaseException:                           # noqa: BLE001
        note('the server stopped: %s' % traceback.format_exc())
    finally:
        sys.argv = saved


def wait_for(port, seconds=20):
    """The window must not open on a server that is not up yet."""
    url = 'http://127.0.0.1:%d/' % port
    until = time.time() + seconds
    while time.time() < until:
        try:
            urllib.request.urlopen(url, timeout=1).read(1)
            return True
        except Exception:                           # noqa: BLE001
            time.sleep(0.15)
    return False


def watch_inbox():
    """Take in whatever is dropped in the inbox, while the window is open."""
    if not WRITABLE:
        return              # a copy inside the program has nothing to write to
    every = int(os.environ.get('SHIRA_WATCH_SECONDS', '60'))
    try:
        import inbox
    except Exception:                               # noqa: BLE001
        return
    while True:
        time.sleep(every)
        try:
            if inbox.waiting():
                inbox.run()
        except Exception:                           # noqa: BLE001
            pass


def main():
    port = free_port()
    threading.Thread(target=serve, args=(port,), daemon=True).start()
    if not wait_for(port):
        note('the internal server never came up on port %d' % port)
        print('השרת הפנימי לא עלה. הפרטים ב-%s' % log_path())
        return 1
    threading.Thread(target=watch_inbox, daemon=True).start()

    url = 'http://127.0.0.1:%d/' % port
    if '--browser' in sys.argv:
        import webbrowser
        webbrowser.open(url)
        print('אוצר השירה השומרונית %s — %s' % (version(), url))
        print('Ctrl-C לסגירה')
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            return 0

    try:
        import webview
    except ImportError:
        print('חלון האפליקציה דורש pywebview:')
        print('    py -3 -m pip install pywebview')
        print('בינתיים ייפתח הדפדפן.')
        import webbrowser
        webbrowser.open(url)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            return 0

    webview.create_window(
        'אוצר השירה השומרונית %s' % version(), url,
        width=1180, height=860, min_size=(420, 620),
        text_select=True, confirm_close=False)
    # http_server=False: the archive's own server is already up, and this one
    # would only serve the folder as flat files without the catalogue API
    webview.start(private_mode=False, storage_path=os.path.join(
        os.environ.get('LOCALAPPDATA', HERE), 'ShiraArchive'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
