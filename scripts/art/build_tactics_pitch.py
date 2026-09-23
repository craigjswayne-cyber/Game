#!/usr/bin/env python3
"""Cut the tactics screen's grass out of the training-pitch master.

    art/masters/campus/training-pitch.png  ->  src/ui/tactics-pitch.png

The master is a 1254px square top-down render: a marked pitch inside its own
grounds. The tactics screen wants the MARKED RECTANGLE only, stood on its end,
because that screen has been a vertical attacking half since the formation was
drawn.

Three things happen on the way, and each is here rather than done by hand so
the next person can redo it:

  THE POSTS COME OUT. Owner, v1.8.3: "Remove the posts". Rotated, they land
  mid-screen with their shadows lying across the grass and read as debris
  rather than as goalposts, because the screen shows a half and the posts
  belong at the ends of a whole one. They are cloned over from directly above,
  which is the one direction that keeps the mowing stripes: the stripes run
  down the master, so the same x is the same shade.

  IT IS QUANTISED HARDER than the campus set - three bits a channel against
  two. Grass is noisy enough to hide it where a smooth sky would not, and this
  is a background behind fifteen jerseys.

  IT IS SMALL. 420px wide, which the screen upscales slightly. A backdrop at
  half opacity does not need to be sharp; it needs to arrive.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
sys.path.insert(0, HERE)

_ns = {'__file__': os.path.join(HERE, 'build_web_assets.py'), '__name__': 'bwa'}
exec(open(os.path.join(HERE, 'build_web_assets.py')).read(), _ns)
read_png, write_png, box_resize, posterise = (
    _ns['read_png'], _ns['write_png'], _ns['box_resize'], _ns['posterise'])

SRC = os.path.join(ROOT, 'art', 'masters', 'campus', 'training-pitch.png')
DST = os.path.join(ROOT, 'src', 'ui', 'tactics-pitch.png')

# the marked pitch, touchline to touchline, measured off the master by
# scanning for the rows and columns carrying the most near-white pixels
X0, X1, Y0, Y1 = 176, 1076, 308, 878
# the two uprights and the shadows they throw, generous on the down-right side
POSTS = [(220, 340, 535, 665), (998, 1076, 535, 660)]
CLONE_FROM = 170          # pixels straight up: same stripe, same shade
TARGET_W = 420
BITS = 3


def main():
    w, h, rows = read_png(SRC)
    rows = [bytearray(r) for r in rows]

    for (px0, px1, py0, py1) in POSTS:
        for y in range(py0, py1):
            src = rows[y - CLONE_FROM]
            dst = rows[y]
            dst[px0 * 3:px1 * 3] = src[px0 * 3:px1 * 3]

    cw, ch = X1 - X0, Y1 - Y0
    crop = [bytes(rows[y][X0 * 3:X1 * 3]) for y in range(Y0, Y1)]

    # ninety degrees clockwise, so the long axis runs up the screen
    rot = []
    for ny in range(cw):
        line = bytearray(ch * 3)
        for nx in range(ch):
            oy = ch - 1 - nx
            line[nx * 3:nx * 3 + 3] = crop[oy][ny * 3:ny * 3 + 3]
        rot.append(bytes(line))

    th = round(TARGET_W * cw / ch)
    out = posterise(box_resize(ch, cw, rot, TARGET_W, th), BITS)
    n = write_png(DST, TARGET_W, th, out)
    print('tactics pitch %dx%d  %.0f KB  (posts cloned out, %d bits)'
          % (TARGET_W, th, n / 1024, BITS))


if __name__ == '__main__':
    main()
