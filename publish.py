"""Выкладывает изменения сайта в интернет (GitHub Pages). Запуск: ОПУБЛИКОВАТЬ.cmd"""
import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
URL = "https://empairmod7771.github.io/portfolio/"


def git(*a):
    return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")


def publish():
    print("Загружаю изменения на сайт, это может занять несколько минут...")
    git("add", "-A")
    if not git("status", "--porcelain").stdout.strip() and "ahead" not in git("status", "-sb").stdout:
        print("Нечего загружать: сайт в интернете уже совпадает с этой папкой.")
        return True
    git("commit", "-q", "-m", "Обновление портфолио")
    r = git("push", "-q")
    if r.returncode:
        print("\nОШИБКА: не получилось загрузить. Проверьте интернет и попросите Claude посмотреть.")
        print(r.stderr[-800:])
        return False
    print(f"\nГотово. Через 1-2 минуты изменения появятся на {URL}")
    print("Если видите старую версию, обновите страницу сочетанием Ctrl+F5.")
    return True


if __name__ == "__main__":
    sys.exit(0 if publish() else 1)
