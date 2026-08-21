# -*- coding: utf-8 -*-
"""Verse Player — the chapter-splitting editor as a double-clickable app.

Wraps player_server.py so it can be shipped as one .exe: no Python install, no
terminal, no remembering a URL. It finds the recordings, starts the local
server, and opens the browser on it.

Finding the recordings, in order:
  1. the TORAH_ROOT environment variable
  2. verse-player.ini next to the .exe          ->  root=C:\\path\\to\\project
  3. the folder two levels up from the .exe     (…/<project>/Verse Player/app.exe)
  4. the folders in KNOWN_ROOTS below

If none of them holds a readings manifest the app says so in plain language
instead of failing with a stack trace — the usual cause is that the project was
moved, or that git is on a branch where the recordings do not exist.
"""
import os
import shutil
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path


def log(*parts):
    """A windowed build has no console: PyInstaller leaves sys.stdout as None
    there, and a bare print() would raise. Anything the user must actually see
    goes through a dialog (_die / _report), not through this."""
    try:
        if sys.stdout:
            print(*parts)
    except Exception:
        pass

APP_NAME = "עורך חלוקת הפרקים — Verse Player"
MANIFEST_REL = Path("web") / "static" / "audio" / "readings" / "readings.json"

# Checked last, so an .ini or a sensible layout always wins.
KNOWN_ROOTS = [
    Path(r"C:\Users\osher\Documents\torah-player"),
    Path(r"C:\Users\osher\Documents\torah"),
]


def _here():
    """The directory the app was launched from — the .exe when frozen."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def _has_recordings(root):
    try:
        return (Path(root) / MANIFEST_REL).is_file()
    except Exception:
        return False


def _from_ini():
    ini = _here() / "verse-player.ini"
    if not ini.is_file():
        return None
    try:
        for line in ini.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith((";", "#")) or "=" not in line:
                continue
            key, val = line.split("=", 1)
            if key.strip().lower() == "root":
                return Path(val.strip().strip('"'))
    except Exception:
        pass
    return None


def find_root():
    tried = []
    for label, cand in (("TORAH_ROOT", os.environ.get("TORAH_ROOT")),
                        ("verse-player.ini", _from_ini()),
                        ("next to the app", _here().parent)):
        if not cand:
            continue
        tried.append((label, Path(cand)))
        if _has_recordings(cand):
            return Path(cand), tried
    for cand in KNOWN_ROOTS:
        tried.append(("known location", cand))
        if _has_recordings(cand):
            return cand, tried
    return None, tried


def _die(title, body):
    """Say what went wrong somewhere the user will actually see it."""
    text = title + "\n\n" + body
    try:                                   # a real dialog when there is a desktop
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, text, APP_NAME, 0x10)
    except Exception:
        pass
    log(text)
    sys.exit(1)


def _port_busy(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def selftest():
    """--selftest: prove the packaged build can do the things that only break
    once it is frozen - find the project, import the server, and regenerate the
    player page (which unfrozen shells out to a python an .exe does not have).

    The build is windowed, so there is no console to print a report into: the
    lines are collected and shown in a dialog as well."""
    out, ok = [], True

    def say(line):
        out.append(line)
        log(line)

    root, tried = find_root()
    say("[%s] project root      %s" % ("ok" if root else "FAIL", root or "not found"))
    if not root:
        for w, pth in tried:
            say("        looked in %-18s %s" % (w, pth))
        _report("SELFTEST FAILED", out)
        return 1
    os.environ["TORAH_ROOT"] = str(root)
    sys.path.insert(0, str(_here()))
    if getattr(sys, "frozen", False):
        sys.path.insert(0, str(Path(sys._MEIPASS)))

    try:
        import player_server as ps
        say("[ok] server module    port %d, reads %s" % (ps.PORT, ps.READINGS_JSON.name))
    except Exception as e:
        say("[FAIL] server module  %s: %s" % (type(e).__name__, e))
        _report("SELFTEST FAILED", out)
        return 1

    for label, path in (("manifest", ps.READINGS_JSON), ("database", ps.DB)):
        good = Path(path).is_file()
        ok &= good
        say("[%s] %-16s %s" % ("ok" if good else "FAIL", label, path))

    page = Path(ps.WEB) / "player-all.html"
    before = page.stat().st_mtime if page.is_file() else 0
    try:
        ps.rebuild_player()
        grew = page.is_file() and page.stat().st_mtime >= before
        ok &= grew
        say("[%s] rebuild page     %s (%d KB)"
            % ("ok" if grew else "FAIL", page.name,
               page.stat().st_size // 1024 if page.is_file() else 0))
    except Exception as e:
        ok = False
        say("[FAIL] rebuild page   %s: %s" % (type(e).__name__, e))

    try:
        import webview  # noqa: F401
        say("[ok] native window    pywebview + WebView2 available")
    except Exception as e:
        say("[-- ] native window    unavailable (%s) - will open in the browser"
            % type(e).__name__)

    for tool in ("ffmpeg", "ffprobe", "git"):
        found = shutil.which(tool)
        # not fatal: playing and editing work without them; cutting/pushing needs them
        say("[%s] %-16s %s" % ("ok" if found else "-- ", tool,
                               found or "not on PATH (needed to cut audio / push)"))

    _report("SELFTEST PASSED" if ok else "SELFTEST FAILED", out)
    return 0 if ok else 1


def _report(title, lines):
    """Windowed builds have nowhere to print, so the report is written next to
    the app AND shown in a dialog. --quiet skips the dialog: it waits for a
    click, which is right for someone who double-clicked and wrong for anything
    running the check unattended."""
    log("")
    log(title)
    text = title + "\n\n" + "\n".join(lines)
    try:
        (_here() / "selftest.txt").write_text(text, encoding="utf-8")
    except Exception:
        pass
    if "--quiet" in sys.argv:
        return
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, text, APP_NAME, 0x40)
    except Exception:
        pass


def serve(ps):
    """Start the local server on a background thread and wait until it answers.

    The window is what the user closes to quit, so the server must not own the
    main thread: it runs as a daemon and dies with the process."""
    from http.server import ThreadingHTTPServer
    srv = ThreadingHTTPServer(("localhost", ps.PORT), ps.Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    for _ in range(60):
        if _port_busy(ps.PORT):
            return srv
        time.sleep(0.1)
    return srv


def open_window(url, title):
    """A real application window rather than a browser tab.

    pywebview drives the Edge WebView2 runtime that ships with Windows, so the
    page is the app: its own window, its own taskbar entry, no address bar and
    no separate browser. If that runtime is missing on some machine the app
    still has to work, so it falls back to the browser rather than refusing to
    start."""
    try:
        import webview
    except Exception as e:
        log("native window unavailable (%s) - falling back to the browser" % e)
        webbrowser.open(url)
        threading.Event().wait()
        return
    try:
        webview.create_window(title, url, width=1360, height=900,
                              min_size=(940, 620), text_select=True)
        webview.start()                      # returns when the user closes it
    except Exception as e:
        log("native window failed to open (%s) - falling back to the browser" % e)
        webbrowser.open(url)
        threading.Event().wait()


def main():
    if "--selftest" in sys.argv:
        sys.exit(selftest())

    root, tried = find_root()
    if root is None:
        looked = "\n".join("    %-18s %s" % (w, p) for w, p in tried) or "    (nowhere)"
        _die("לא מצאתי את ההקלטות.",
             "חיפשתי את %s תחת:\n%s\n\n"
             "אם הפרויקט הועבר, צור לצד הקובץ הזה קובץ בשם verse-player.ini "
             "ובתוכו שורה אחת:\n\n    root=C:\הנתיב\לפרויקט\n\n"
             "אם הנתיב קיים אבל ריק — ייתכן שגיט נמצא על ענף שאין בו את "
             "ההקלטות (הן יושבות על web-deploy)." % (MANIFEST_REL, looked))

    os.environ["TORAH_ROOT"] = str(root)
    sys.path.insert(0, str(_here()))
    if getattr(sys, "frozen", False):
        sys.path.insert(0, str(Path(sys._MEIPASS)))

    try:
        import player_server as ps
    except Exception as e:
        _die("התוכנה לא הצליחה לעלות.", "%s: %s" % (type(e).__name__, e))

    # An instance already serving is not an error: show its window rather than
    # dying on "address already in use", and leave its server alone.
    if not _port_busy(ps.PORT):
        try:
            stale = ps.cleanup_orphan_staging()
            if stale:
                log("ניקיתי %d קבצי ביניים משימוש קודם" % len(stale))
        except Exception as e:
            log("דילגתי על ניקוי קבצי ביניים: %s" % e)
        serve(ps)

    url = "http://localhost:%d/" % ps.PORT
    log("%s | %s | %s" % (APP_NAME, root, url))
    open_window(url, APP_NAME)


if __name__ == "__main__":
    main()
