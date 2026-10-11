#!/usr/bin/env python3
"""Turn the posts on the title screen's STARTING XV sheet the right way round.

    python3 scripts/art/fix_title_posts.py [src/ui/title-bg.webp] [out.webp]

Owner: "The background on the title page: the posts are the wrong way round."
The key art draws an H at each end of the pitch on the team sheet, and both had
the crossbar on the far side, so the tall part of each H pointed back into the
field of play. Real posts stand on the try line with a short stub below the
crossbar and the tall uprights rising away from the field, so the crossbar is
the bar NEARER the field.

The uprights are left exactly where they are. Only the crossbar moves: it is
lifted out, the paper behind it is rebuilt from the clean paper a few rows
along the same column (the sheet's stains run in blobs, not stripes, so a
short vertical clone does not show), and the bar is laid back in at the other
end of the H, nudged sideways by the uprights' lean so it still meets them.
It goes down as ink over the paper that is there (a darken blend weighted by
how dark the source pixel is), so the new spot keeps its own texture.

Run it once on art fresh out of scripts/titlebg.mjs. It refuses a picture
whose crossbars are not where the original art has them, so a second run
cannot move them back.
"""
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else 'src/ui/title-bg.webp'
OUT = sys.argv[2] if len(sys.argv) > 2 else SRC

# Measured off the 1024 x 1536 art (an ASCII dump of the luminance). Each H:
#   up:  the two uprights as (x, y) at top and bottom of their centre lines
#   bar: the crossbar centre line as (x, y) at its two ends
#   half: rows either side of the bar's centre line that belong to it
#   dy:  how far the bar moves (+ is down the picture)
#   clone: which row offset the rebuilt paper is taken from
POSTS = [
    {   # far end, top of the sheet: field below, so the bar goes to the bottom
        'up': [((512.5, 1016), (505.5, 1048)), ((543.0, 1019), (537.5, 1050))],
        'bar': ((509, 1025.5), (543, 1027.9)),
        'half': 1.6,
        'dy': 14,
        'clone': -5,
    },
    {   # near end, bottom of the sheet: field above, so the bar goes to the top
        'up': [((441.0, 1364), (430.0, 1416)), ((484.0, 1369), (474.0, 1421))],
        'bar': ((432, 1394.8), (481, 1399.3)),
        'half': 2.6,
        'dy': -16,
        'clone': -7,
    },
]


def line_x(seg, y):
    (x0, y0), (x1, y1) = seg
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0)


def bar_y(bar, x):
    (x0, y0), (x1, y1) = bar
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def sample(a, y, x):
    x0 = int(np.floor(x))
    f = x - x0
    return a[y, x0] * (1 - f) + a[y, x0 + 1] * f


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


img = Image.open(SRC).convert('RGB')
if img.size != (1024, 1536):
    sys.exit(f'expected the 1024 x 1536 key art, got {img.size}; re-measure POSTS')
src = np.asarray(img).astype(np.float32)
out = src.copy()
L = lum(src)

for p in POSTS:
    (bx0, _), (bx1, _) = p['bar']
    lean = ((p['up'][0][1][0] - p['up'][0][0][0]) / (p['up'][0][1][1] - p['up'][0][0][1]))
    dx = int(round(lean * p['dy']))
    dy = p['dy']
    h = p['half']

    # Refuse a picture that has already been fixed: the bar's old centre line
    # must still be ink, and its new one still paper.
    mid = (bx0 + bx1) // 2
    old = L[int(round(bar_y(p['bar'], mid))), mid]
    new = L[int(round(bar_y(p['bar'], mid))) + dy, mid + dx]
    if not (old < 90 and new > 120):
        sys.exit(f'crossbar not where the original art has it (ink {old:.0f}, paper {new:.0f}); already fixed?')

    # 1. Lift the bar out between the uprights, leaving the uprights alone.
    for x in range(bx0 - 2, bx1 + 3):
        yc = bar_y(p['bar'], x)
        for y in range(int(round(yc - h)), int(round(yc + h)) + 1):
            lx = line_x(p['up'][0], y)
            rx = line_x(p['up'][1], y)
            if lx + 3.5 < x < rx - 3.5:
                out[y, x] = src[y + p['clone'], x]
            elif lx - 3.5 <= x <= rx + 3.5:
                # Beside an upright: rebuild the upright itself from the rows
                # just clear of the bar, following its lean, so the join
                # leaves neither a stub nor a notch.
                ya, yb = int(round(yc - h)) - 1, int(round(yc + h)) + 1
                t = (y - ya) / (yb - ya)
                out[y, x] = (1 - t) * sample(src, ya, x + lean * (ya - y)) + t * sample(src, yb, x + lean * (yb - y))

    # 2. Lay it back in at the other end of the H, as ink over the paper there.
    for x in range(bx0 - 2, bx1 + 3):
        yc = bar_y(p['bar'], x)
        for y in range(int(round(yc - h)), int(round(yc + h)) + 1):
            ty, tx = y + dy, x + dx
            lx = line_x(p['up'][0], ty)
            rx = line_x(p['up'][1], ty)
            if not (lx - 1 <= tx <= rx + 1):
                continue
            s = src[y, x]
            w = float(np.clip((165 - L[y, x]) / 60, 0, 1))
            if w <= 0:
                continue
            d = out[ty, tx]
            out[ty, tx] = d * (1 - w) + np.minimum(d, s) * w

Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)).save(OUT, 'WEBP', quality=86, method=6)
print(f'wrote {OUT}')
