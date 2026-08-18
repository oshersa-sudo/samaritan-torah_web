@echo off
rem אוצר השירה השומרונית
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
py -3 app.py %*
pause
