#!/usr/bin/env python3
"""Make the far posts on the title screen's STARTING XV sheet the near posts,
turned upside down.

    python3 scripts/art/posts_match.py [src/ui/title-bg.webp] [out.webp]

Owner, 1.9.1: "the posts are still on the wrong way on the team sheet on the
desk in the title intro", and then, with the two H's marked in red: "Both the
posts should be exactly the same but bottom one upside down".

The near H (bottom of the sheet) is the one to copy: it stands in the in-goal,
its uprights running from the try line to the dead-ball line, the crossbar a
third of the way back from the try line. The far H was a different drawing.
So the far one is lifted out (the try and dead-ball lines it crossed are left
alone, the paper behind it cloned from clean paper beside it) and the near one
is laid in its place, rotated half a turn and fitted to the far in-goal: its
try-line end on the far try line, its dead-ball end on the far dead-ball line,
narrowed to the far end's width. A half turn keeps the uprights' lean, which
is the lean the picture's perspective gives the far end anyway. The ink goes
down as a darken blend over the paper that is there, so it keeps its texture.

Run it once on art that has been through fix_title_posts.py. It refuses a
picture whose far H is not where that script leaves it.
"""
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else 'src/ui/title-bg.webp'
OUT = sys.argv[2] if len(sys.argv) > 2 else SRC


def seg(p, q):
    """A straight line through two (x, y) points, as y(x)."""
    (x0, y0), (x1, y1) = p, q
    return lambda x: y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def upr(p, q):
    """An upright's centre line through two (x, y) points, as x(y)."""
    (x0, y0), (x1, y1) = p, q
    return lambda y: x0 + (x1 - x0) * (y - y0) / (y1 - y0)


# Measured off the 1024 x 1536 art (ASCII dumps of the luminance).
FAR = {
    'up': [upr((512, 1016), (505, 1048)), upr((543, 1019), (537, 1051))],
    'ys': (1014, 1052),
    'bar': seg((506, 1040.0), (541, 1041.6)),
    'bx': (504, 545),
    'try': seg((495, 1028.6), (555, 1033.6)),
    'dead': seg((513, 1005.0), (556, 1008.5)),
}
NEAR = {
    'up': [upr((440.5, 1364), (429.5, 1416)), upr((483.5, 1369), (474, 1421))],
    'ys': (1362, 1423),
    'bar': seg((437, 1379.6), (483, 1383.6)),
    'bx': (433, 487),
    'try': seg((415, 1360.2), (500, 1369.6)),
    'dead': seg((415, 1418.0), (500, 1428.0)),
}
HALF_UP = 4.4    # half the width of an upright's ink, with its soft edge
HALF_BAR = 3.6
LINE_KEEP = 2.8  # pixels either side of a pitch line that belong to the line


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def h_mask(L, p, thresh=185):
    """The H's ink: the uprights and the crossbar."""
    m = np.zeros(L.shape, bool)
    y0, y1 = p['ys']
    for y in range(y0, y1 + 1):
        for up in p['up']:
            cx = up(y)
            for x in range(int(cx - HALF_UP - 1), int(cx + HALF_UP + 2)):
                if abs(x - cx) <= HALF_UP and L[y, x] < thresh:
                    m[y, x] = True
    bx0, bx1 = p['bx']
    for x in range(bx0, bx1 + 1):
        cy = p['bar'](x)
        for y in range(int(cy - HALF_BAR - 1), int(cy + HALF_BAR + 2)):
            if abs(y - cy) <= HALF_BAR and L[y, x] < thresh:
                m[y, x] = True
    return m


def on_line(p, x, y):
    return abs(y - p['try'](x)) <= LINE_KEEP or abs(y - p['dead'](x)) <= LINE_KEEP


def centre_width(p, y):
    lx, rx = p['up'][0](y), p['up'][1](y)
    return (lx + rx) / 2, rx - lx


def y_at(p, v, x):
    """v = 0 on the try line, 1 on the dead-ball line."""
    t, d = p['try'](x), p['dead'](x)
    return t + v * (d - t)


def bilinear(a, y, x):
    y0, x0 = int(np.floor(y)), int(np.floor(x))
    fy, fx = y - y0, x - x0
    return (a[y0, x0] * (1 - fy) * (1 - fx) + a[y0, x0 + 1] * (1 - fy) * fx
            + a[y0 + 1, x0] * fy * (1 - fx) + a[y0 + 1, x0 + 1] * fy * fx)


img = Image.open(SRC).convert('RGB')
if img.size != (1024, 1536):
    sys.exit(f'expected the 1024 x 1536 key art, got {img.size}; re-measure FAR and NEAR')
src = np.asarray(img).astype(np.float32)
out = src.copy()
L = lum(src)
mid = sum(FAR['bx']) // 2
if not L[int(round(FAR['bar'](mid))), mid] < 90:
    sys.exit('the far crossbar is not where fix_title_posts.py leaves it; already replaced?')

# 1. lift the far H out, keeping the lines it crosses
far = h_mask(L, FAR)
for y, x in zip(*np.nonzero(far)):
    if on_line(FAR, x, y):
        continue
    bar = abs(y - FAR['bar'](x)) <= HALF_BAR + 0.5 and FAR['bx'][0] + 5 < x < FAR['bx'][1] - 5
    offs = ((9, 0), (-9, 0), (12, 0), (-12, 0)) if bar else ((0, 10), (0, -10), (0, 13), (0, -13), (9, 0), (-9, 0))
    offs += ((0, 17), (0, -17), (15, 0), (-15, 0), (0, 22), (0, -22))
    for oy, ox in offs:
        sy, sx = y + oy, x + ox
        if not far[sy, sx] and L[sy, sx] > 125 and not on_line(FAR, sx, sy):
            out[y, x] = src[sy, sx]
            break

# 2. the near H as ink strength, 0 to 1. Where it meets a line the line's ink
# is the H's too, which is what lets the copy touch the far lines cleanly.
near = h_mask(L, NEAR)
alpha = np.zeros(L.shape, np.float32)
for y, x in zip(*np.nonzero(near)):
    alpha[y, x] = float(np.clip((165 - L[y, x]) / 100, 0, 1))
ink = src[near & (L < 70)].mean(axis=0)

# 3. lay it in at the far end, half a turn round: the far try line takes the
# near try line, and left and right swap
cx_far, w_far = centre_width(FAR, FAR['try'](mid))
cx_near, _ = centre_width(NEAR, NEAR['try'](460))
x_lo, x_hi = int(cx_far - w_far), int(cx_far + w_far) + 1
y_lo, y_hi = int(FAR['dead'](x_lo)) - 2, int(FAR['try'](x_hi)) + 3
for ty in range(y_lo, y_hi + 1):
    for tx in range(x_lo, x_hi + 1):
        t, d = FAR['try'](tx), FAR['dead'](tx)
        v = (ty - t) / (d - t)
        if not -0.06 <= v <= 1.06:
            continue
        cf, wf = centre_width(FAR, y_at(FAR, v, cx_far))
        cn, wn = centre_width(NEAR, y_at(NEAR, v, cx_near))
        u = (tx - cf) / wf
        xb = cn - u * wn
        yb = y_at(NEAR, v, xb)
        if not (NEAR['ys'][0] <= yb <= NEAR['ys'][1] - 1):
            continue
        a = float(bilinear(alpha, yb, xb))
        if a <= 0.02:
            continue
        px = out[ty, tx]
        out[ty, tx] = px * (1 - a) + np.minimum(px, ink) * a

Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)).save(OUT, 'WEBP', quality=86, method=6)
print(f'wrote {OUT}')
