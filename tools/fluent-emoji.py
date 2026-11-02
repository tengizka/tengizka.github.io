#!/usr/bin/env python3
"""Скачивает 3D-эмодзи Microsoft Fluent Emoji (MIT) в assets/emoji/ как webp.

Пример:  python3 tools/fluent-emoji.py "Clown face" "Game die" "Man dancing"
Имя — как у папки в github.com/microsoft/fluentui-emoji/tree/main/assets
(английское название эмодзи, первая буква заглавная).
"""
import io, sys, pathlib, urllib.parse, urllib.request
from PIL import Image

RAW = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'emoji'

def fetch(name):
    slug = name.lower().replace(' ', '_')
    tries = [f'{name}/3D/{slug}_3d.png', f'{name}/Default/3D/{slug}_3d_default.png']
    for path in tries:
        try:
            with urllib.request.urlopen(RAW + urllib.parse.quote(path), timeout=30) as r:
                return slug, r.read()
        except Exception:
            pass
    raise SystemExit(f'не нашёл: {name}')

OUT.mkdir(parents=True, exist_ok=True)
for name in sys.argv[1:]:
    slug, data = fetch(name)
    dst = OUT / f"{slug.replace('-', '_')}.webp"
    Image.open(io.BytesIO(data)).save(dst, 'WEBP', quality=90, method=6)
    print(f'{name} → {dst.relative_to(OUT.parent.parent)} ({dst.stat().st_size // 1024} КБ)')
