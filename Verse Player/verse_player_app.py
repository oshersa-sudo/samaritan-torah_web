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
    print(text)
    sys.exit(1)


def _port_busy(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def selftest():
    """--selftest: prove the packaged build can do the things that only break
    once it is frozen — find the project, import the server, and regenerate the
    player page (which in a normal build shells out to a python that an .exe
    does not have). Prints a pass/fail line per check and sets the exit code."""
    ok = True

    root, tried = find_root()
    print("[%s] project root      %s" % ("ok" if root else "FAIL", root or "not found"))
    if not root:
        for w, p in tried:
            print("        looked in %-18s %s" % (w, p))
        return 1
    os.environ["TORAH_ROOT"] = str(root)
    sys.path.insert(0, str(_here()))
    if getattr(sys, "frozen", False):
        sys.path.insert(0, str(Path(sys._MEIPASS)))

    try:
        import player_server as ps
        print("[ok] server module    port %d, reads %s" % (ps.PORT, ps.READINGS_JSON.name))
    except Exception as e:
        print("[FAIL] server module  %s: %s" % (type(e).__name__, e))
        return 1

    for label, path in (("manifest", ps.READINGS_JSON), ("database", ps.DB)):
        good = Path(path).is_file()
        ok &= good
        print("[%s] %-16s %s" % ("ok" if good else "FAIL", label, path))

    page = Path(ps.WEB) / "player-all.html"
    before = page.stat().st_mtime if page.is_file() else 0
    try:
        ps.rebuild_player()
        grew = page.is_file() and page.stat().st_mtime >= before
        ok &= grew
        print("[%s] rebuild page     %s (%d KB)"
              % ("ok" if grew else "FAIL", page.name,
                 page.stat().st_size // 1024 if page.is_file() else 0))
    except Exception as e:
        ok = False
        print("[FAIL] rebuild page   %s: %s" % (type(e).__name__, e))

    for tool in ("ffmpeg", "ffprobe", "git"):
        found = shutil.which(tool)
        # not fatal: playing and editing work without them, only cutting/pushing needs them
        print("[%s] %-16s %s" % ("ok" if found else "-- ", tool,
                                 found or "not on PATH (needed to cut audio / push)"))

    print("\n%s" % ("SELFTEST PASSED" if ok else "SELFTEST FAILED"))
    return 0 if ok else 1


def main():
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    root, tried = find_root()
    if root is None:
        looked = "\n".join("    %-18s %s" % (w, p) for w, p in tried) or "    (nowhere)"
        _die("לא מצאתי את ההקלטות.",
             "חיפשתי את %s תחת:\n%s\n\n"
             "אם הפרויקט הועבר, צור לצד הקובץ הזה קובץ בשם verse-player.ini "
             "ובתוכו שורה אחת:\n\n    root=C:\\הנתיב\\לפרויקט\n\n"
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

    if _port_busy(ps.PORT):
        # Already running (often an earlier window that is still open) — just
        # show it rather than dying on "address already in use".
        webbrowser.open("http://localhost:%d/" % ps.PORT)
        _die("הנגן כבר פועל.",
             "יש כבר חלון פתוח של התוכנה (פורט %d), ופתחתי אותו בדפדפן.\n\n"
             "אם הוא תקוע — סגור את חלון התוכנה הקודם והפעל שוב." % ps.PORT)

    try:
        stale = ps.cleanup_orphan_staging()
        if stale:
            print("ניקיתי %d קבצי ביניים משימוש קודם" % len(stale))
    except Exception as e:
        print("דילגתי על ניקוי קבצי ביניים: %s" % e)

    url = "http://localhost:%d/" % ps.PORT
    print("%s\nההקלטות: %s\nכתובת:    %s\n\nהשאר חלון זה פתוח כל עוד אתה עובד.\n"
          % (APP_NAME, root, url))
    threading.Thread(target=lambda: (time.sleep(1.0), webbrowser.open(url)),
                     daemon=True).start()

    from http.server import ThreadingHTTPServer
    try:
        ThreadingHTTPServer(("localhost", ps.PORT), ps.Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nהתוכנה נסגרה.")


if __name__ == "__main__":
    main()
