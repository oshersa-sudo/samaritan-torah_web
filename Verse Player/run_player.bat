@echo off
rem ── Launch the local reading-editor player and open it in the browser ──
rem Double-click this file. It starts player_server.py and opens the app.
cd /d "%~dp0\.."
where py >nul 2>&1 && (set PY=py -3) || (set PY=python)
start "" http://localhost:8934/
%PY% "Verse Player\player_server.py"
pause
