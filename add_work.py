"""Добавление работ в портфолио.

Положите видео (.mp4 .mov .mkv .webm) или фото (.jpg .jpeg .png .webp) в папку «Добавить»
и запустите ДОБАВИТЬ_РАБОТЫ.cmd (или: python add_work.py). Скрипт для каждого файла:
  * делает лёгкую копию для сайта (видео до ~90 МБ, с быстрым стартом), обложку и превью;
  * сам определяет раздел: вертикальное видео → Shorts, горизонтальное → Ролики, картинка → Фото;
  * дописывает работу в data/works.js и переносит исходник в «Добавить/_готово».

Название берётся из имени файла («2026-11-22_капсула_времени_1.mp4» → «Капсула времени 1»).
Можно положить рядом текстовый файл с тем же именем (.txt): первая строка — название,
остальное — описание. Либо поправить всё потом в data/works.js.

Другие режимы:
  python add_work.py путь\\к\\файлу.mp4 [ещё файлы]   — добавить конкретные файлы (исходник не трогается)
  python add_work.py --list                             — список работ
  python add_work.py --remove <id>                      — убрать работу с сайта (и её файлы в media/)
"""
import json, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INBOX = ROOT / "Добавить"
DONE = INBOX / "_готово"
MEDIA = ROOT / "media"
WORKS = ROOT / "data" / "works.js"
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}
PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_MB = 90  # GitHub Pages не принимает файлы больше 100 МБ

TR = dict(zip("абвгдеёзийклмнопрстуфхцы", "abvgdeezijklmnoprstufhcy"))
TR.update({"ж": "zh", "ч": "ch", "ш": "sh", "щ": "sch", "ю": "yu", "я": "ya", "э": "e", "ь": "", "ъ": ""})


def slugify(s):
    s = "".join(TR.get(c, c) for c in s.lower())
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60] or "work"


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])
    return r.stdout


def probe(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
               "stream=width,height:stream_side_data=rotation:format=duration", "-of", "json", str(path)])
    j = json.loads(out)
    st = j["streams"][0]
    w, h = st["width"], st["height"]
    rot = 0
    for sd in st.get("side_data_list", []) or []:
        rot = abs(int(sd.get("rotation", 0) or 0))
    if rot in (90, 270):
        w, h = h, w
    return w, h, float(j.get("format", {}).get("duration") or 0)


def load_works():
    if not WORKS.exists():
        return []
    txt = WORKS.read_text(encoding="utf-8")
    m = re.search(r"window\.WORKS\s*=\s*(\[.*\])\s*;?\s*$", txt, re.S)
    if not m:
        sys.exit("Не получилось прочитать data/works.js — проверьте запятые и кавычки (это формат JSON).")
    return json.loads(m.group(1))


def save_works(works):
    WORKS.parent.mkdir(parents=True, exist_ok=True)
    head = ("// Список работ портфолио. Новые работы добавляет add_work.py.\n"
            "// Править можно вручную: title — название, desc — описание, tags — что сделано,\n"
            "// featured: true — показать первой, hidden: true — скрыть, youtube — ссылка вместо файла.\n"
            "// Формат JSON: строки в двойных кавычках, запятые между полями.\n")
    WORKS.write_text(head + "window.WORKS = " + json.dumps(works, ensure_ascii=False, indent=2) + ";\n",
                     encoding="utf-8")


def title_from(src):
    side = src.with_suffix(".txt")
    if side.exists():
        lines = side.read_text(encoding="utf-8-sig").strip().splitlines()
        if lines:
            return lines[0].strip(), "\n".join(lines[1:]).strip()
    for cand in (src.parent / (src.stem + "_описание.md"),):
        if cand.exists():
            for line in cand.read_text(encoding="utf-8-sig").splitlines():
                if line.startswith("# "):
                    t = re.sub(r"\s*\(.*?\)\s*$", "", line[2:]).strip()
                    return re.sub(r"\s*[—–-]\s*(shorts?|reels)$", "", t, flags=re.I), ""
    name = re.sub(r"^\d{4}-\d{2}-\d{2}[_ -]*", "", src.stem)
    name = re.sub(r"[_ -]*(short|shorts|final|финал)$", "", name, flags=re.I)
    name = re.sub(r"[_]+", " ", name).strip() or src.stem
    return name[:1].upper() + name[1:], ""


def date_from(src):
    m = re.match(r"(\d{4}-\d{2}-\d{2})", src.stem)
    if m:
        return m.group(1)
    import datetime
    return datetime.date.fromtimestamp(src.stat().st_mtime).isoformat()


def add_video(src, wid, out):
    w, h, dur = probe(src)
    vertical = h > w
    kind = "short" if vertical else "long"
    # битрейт так, чтобы файл влез в MAX_MB
    cap = int(min(4500 if vertical else 3500, MAX_MB * 8192 / max(dur, 1) - 128))
    scale = "scale='min(1080,iw)':-2" if vertical else "scale='min(1920,iw)':-2"
    print(f"  видео {w}x{h}, {dur:.0f} с → {kind}, до {cap} кбит/с")
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf", scale + ",format=yuv420p",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", f"{cap}k",
         "-bufsize", f"{cap * 2}k", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
         str(out / "video.mp4")])
    t_poster = min(3.0, dur * 0.3) if vertical else dur * 0.12
    pw = 720 if vertical else 1280
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t_poster:.2f}", "-i", str(src), "-frames:v", "1",
         "-vf", f"scale={pw}:-2", "-q:v", "3", str(out / "poster.jpg")])
    t_prev = dur * 0.25
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t_prev:.2f}", "-t", "5", "-i", str(src), "-an",
         "-vf", f"scale={360 if vertical else 640}:-2,fps=30,format=yuv420p", "-c:v", "libx264",
         "-preset", "veryfast", "-crf", "30", "-movflags", "+faststart", str(out / "preview.mp4")])
    return {"type": kind, "video": f"media/{wid}/video.mp4", "poster": f"media/{wid}/poster.jpg",
            "preview": f"media/{wid}/preview.mp4", "duration": round(dur), "w": w, "h": h,
            "tags": ["Субтитры", "Наезды камеры", "Графика", "Звук"] if vertical
            else ["Сюжет и темп", "Графика на весь экран", "Цвет", "Музыка и звук"]}


def add_photo(src, wid, out):
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf",
         "scale='min(2400,iw)':-2", "-q:v", "2", str(out / "photo.jpg")])
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf",
         "scale='min(900,iw)':-2", "-q:v", "4", str(out / "poster.jpg")])
    w, h, _ = probe(out / "photo.jpg")
    return {"type": "photo", "photo": f"media/{wid}/photo.jpg", "poster": f"media/{wid}/poster.jpg",
            "w": w, "h": h, "tags": []}


def add(src, works, move=False):
    ext = src.suffix.lower()
    if ext not in VIDEO_EXT | PHOTO_EXT:
        return False
    title, desc = title_from(src)
    if ext in VIDEO_EXT:
        try:
            dur = probe(src)[2]
        except Exception:
            dur = -1
        same = [w for w in works if abs(w.get("duration", -9) - dur) <= 1
                and (w["title"].lower() == title.lower() or w.get("date") == date_from(src))]
        if same:
            print(f"→ {src.name}: уже есть на сайте («{same[0]['title']}»), пропускаю")
            if move:
                DONE.mkdir(exist_ok=True)
                shutil.move(str(src), str(DONE / src.name))
            return False
    wid = base = slugify(date_from(src)[5:] + "-" + title)
    ids = {w["id"] for w in works}
    n = 2
    while wid in ids:
        wid, n = f"{base}-{n}", n + 1
    out = MEDIA / wid
    out.mkdir(parents=True, exist_ok=True)
    print(f"→ {src.name}  «{title}»")
    try:
        info = add_video(src, wid, out) if ext in VIDEO_EXT else add_photo(src, wid, out)
    except Exception as e:
        shutil.rmtree(out, ignore_errors=True)
        print("  ОШИБКА:", e)
        return False
    works.insert(0, {"id": wid, "title": title, "desc": desc, "date": date_from(src), **info})
    save_works(works)
    if move:
        DONE.mkdir(exist_ok=True)
        for f in [src, src.with_suffix(".txt")]:
            if f.exists():
                shutil.move(str(f), str(DONE / f.name))
    mb = sum(f.stat().st_size for f in out.iterdir()) / 1048576
    print(f"  готово: media/{wid} ({mb:.0f} МБ)")
    return True


def main():
    args = sys.argv[1:]
    works = load_works()
    if args[:1] == ["--list"]:
        for w in works:
            print(f"{w['id']:45} {w['type']:6} {w['title']}")
        return
    if args[:1] == ["--remove"]:
        for wid in args[1:]:
            works = [w for w in works if w["id"] != wid]
            shutil.rmtree(MEDIA / wid, ignore_errors=True)
            print("убрано:", wid)
        save_works(works)
        return
    if args:
        files, move = [Path(a) for a in args], False
    else:
        INBOX.mkdir(exist_ok=True)
        files, move = sorted(p for p in INBOX.iterdir() if p.is_file()), True
    added = sum(add(f, works, move) for f in files if f.suffix.lower() in VIDEO_EXT | PHOTO_EXT)
    print(f"\nДобавлено работ: {added}. Всего на сайте: {len(works)}.")
    if not added and not args:
        print("Новых работ нет: папка «Добавить» пуста или там только то, что уже есть на сайте.")
    if added and not args:
        print("\nПока новые работы есть только на этом компьютере.")
        ans = input("Выложить их на сайт в интернете сейчас? Введите 1 (да) или 2 (нет) и нажмите Enter: ").strip()
        if ans in ("1", "д", "да", "y", "yes"):
            import publish
            publish.publish()
        else:
            print("Хорошо. Чтобы выложить позже, запустите ОПУБЛИКОВАТЬ.cmd")


if __name__ == "__main__":
    main()
