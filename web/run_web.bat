@echo off
rem ── Launch the Samaritan Torah web edition and open it in the browser ──
rem Double-click this file. It starts the local server and opens the app.
cd /d "%~dp0\.."
where py >nul 2>&1 && (set PY=py -3) || (set PY=python)
%PY% -m pip show flask >nul 2>&1 || %PY% -m pip install flask
start "" http://127.0.0.1:5000
%PY% web\server.py
pause
