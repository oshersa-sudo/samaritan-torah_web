# -*- coding: utf-8 -*-
"""אוצר השירה השומרונית — the archive, as a program on this machine.

    py -3 app.py                 open it
    py -3 app.py --sync          take in the inbox and put it online, then open
    py -3 app.py --no-watch      open it, but leave the inbox alone
    py -3 app.py --version       say which version this is

The same code runs here and on the web. What is different is only what this
machine has: the archive drive, and the right to write. So this is the full
edition — the reading, the editing, the taking in, and the putting online —
and the web edition is the same program with its hands tied.

While it is open it watches the inbox. Anything dropped in is filed within the
minute, by the agreed rules in scripts/tags.py, and appears in the index
without a restart. Sending it up to the site stays a deliberate act: press it
in the panel, or run scripts/sync.py.
"""
import io
import os
import subprocess
import sys
import threading
import time
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'scripts'))

PORT  = int(os.environ.get('SHIRA_PORT', '8802'))
INBOX = os.environ.get('SHIRA_INBOX', os.path.join(HERE, 'inbox'))
WATCH_EVERY = int(os.environ.get('SHIRA_WATCH_SECONDS', '60'))


def version():
    try:
        with io.open(os.path.join(HERE, 'VERSION'), encoding='utf-8') as fh:
            return fh.read().strip()
    except OSError:
        return '0.0.0'


def _watch():
    """Take in whatever appears in the inbox, quietly, while the app is open."""
    import inbox
    while True:
        time.sleep(WATCH_EVERY)
        try:
            if inbox.waiting():
                print('\n— תיקיית הקליטה —')
                inbox.run()
                print('— הקטלוג עודכן; רענן את הדף —\n')
        except Exception as e:                      # noqa: BLE001
            print('הקליטה נכשלה: %s' % str(e)[:120])


def main():
    if '--version' in sys.argv:
        print('אוצר השירה השומרונית %s' % version())
        return 0

    if '--sync' in sys.argv:
        import sync
        sync.main()

    os.makedirs(INBOX, exist_ok=True)
    print('אוצר השירה השומרונית %s' % version())
    print('  http://127.0.0.1:%d' % PORT)
    print('  תיקיית קליטה: %s' % INBOX)
    if '--no-watch' not in sys.argv:
        print('  נקלט אוטומטית כל %d שניות' % WATCH_EVERY)
        threading.Thread(target=_watch, daemon=True).start()
    print()

    threading.Timer(1.5, lambda: webbrowser.open(
        'http://127.0.0.1:%d/' % PORT)).start()

    # serve.py is the engine; running it in-process keeps one console and one
    # Ctrl-C for the whole program
    sys.argv = [sys.argv[0]]
    import runpy
    runpy.run_path(os.path.join(HERE, 'serve.py'), run_name='__main__')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print('\nלהתראות')
