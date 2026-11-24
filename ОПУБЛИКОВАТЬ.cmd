@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Загружаю изменения на сайт...
git add -A
git commit -q -m "Обновление портфолио"
git push -q
echo.
echo Готово. Через 1-2 минуты изменения появятся на https://empairmod7771.github.io/portfolio/
pause
