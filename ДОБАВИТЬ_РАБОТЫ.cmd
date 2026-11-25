@echo off
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" add_work.py %*
echo.
pause
