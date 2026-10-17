#!/usr/bin/env python3
"""Convert the shipped art PNGs to WebP (1.9.1).

build_web_assets.py and build_tactics_pitch.py write PNG, stdlib only. The
game ships WebP: the same pictures at about a fifth of the bytes (3.2 MB to
roughly 0.6 MB), which every phone also decodes into less memory. Run this
after either builder; it needs Pillow (pip install pillow).

    python3 scripts/art/to_webp.py

Each PNG under public/art and src/ui/tactics-pitch.png is written as a .webp
beside it and the PNG is removed. Quality 92 with lossless alpha: the facility
tiles stand on a transparent ground and a soft edge there shows on the map.
"""
import glob, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
files = glob.glob(os.path.join(ROOT, 'public', 'art', '**', '*.png'), recursive=True)
files.append(os.path.join(ROOT, 'src', 'ui', 'tactics-pitch.png'))
before = after = 0
for f in files:
    if not os.path.exists(f):
        continue
    im = Image.open(f)
    out = f[:-4] + '.webp'
    im.save(out, 'WEBP', quality=85, alpha_quality=100, method=6)
    before += os.path.getsize(f)
    after += os.path.getsize(out)
    os.remove(f)
print(f'{len(files)} files: {before // 1024} KB of PNG -> {after // 1024} KB of WebP')
