#!/usr/bin/env python3
"""Composite the locked facility tiles into the campus plate.

Two knobs, because the plate's plots are only ~12% of the canvas width and a
1254px tile shrunk to 132px loses everything that distinguishes one facility
from another:

  --scale     output resolution multiplier. The plate is upscaled, but each
              tile is resampled from its NATIVE 1254px source, so this buys
              real facility detail rather than just bigger pixels.
  --oversize  how much larger than its plot each facility draws, centred on
              the plot. 1.0 sits exactly in the plot; 1.4 spills onto the
              verge and reads far better at a glance.

Pure stdlib: no Pillow, no numpy.
"""
import argparse, json, os, struct, sys, zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art', 'masters')

# Which facility sits in which plot. Plot ids come from campus/plots.json,
# ordered top-to-bottom, left-to-right.
ASSIGN = {
    1:  ('academy',         'Centre of Excellence'),
    2:  ('paddock',         'Training Paddock'),
    3:  ('gym',             'Strength & Conditioning'),
    4:  ('kicking',         'Kicking Enclosure'),
    5:  ('stadium',         'Stadium'),
    6:  ('playing-surface', 'Playing Surface'),
    7:  ('recovery',        'Recovery Centre'),
    8:  ('analysis',        'Analysis & Briefing'),
    9:  ('shop',            'Club Shop & Megastore'),
    10: ('hospitality',     'Hospitality & Boxes'),
}

DIGITS = {
    '0': (0x0E,0x11,0x13,0x15,0x19,0x11,0x0E), '1': (0x04,0x0C,0x04,0x04,0x04,0x04,0x0E),
    '2': (0x0E,0x11,0x01,0x02,0x04,0x08,0x1F), '3': (0x1F,0x02,0x04,0x02,0x01,0x11,0x0E),
    '4': (0x02,0x06,0x0A,0x12,0x1F,0x02,0x02), '5': (0x1F,0x10,0x1E,0x01,0x01,0x11,0x0E),
    '6': (0x06,0x08,0x10,0x1E,0x11,0x11,0x0E), '7': (0x1F,0x01,0x02,0x04,0x08,0x08,0x08),
    '8': (0x0E,0x11,0x11,0x0E,0x11,0x11,0x0E), '9': (0x0E,0x11,0x11,0x0F,0x01,0x02,0x0C),
}


def read_png(path):
    """Minimal PNG reader for 8-bit RGB/RGBA/grey/palette, non-interlaced."""
    d = open(path, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('%s: not a PNG' % path)
    i, idat, pal = 8, b'', None
    w = h = bd = ct = None
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]
        typ, data = d[i+4:i+8], d[i+8:i+8+ln]
        i += 12 + ln
        if typ == b'IHDR':
            w, h, bd, ct, _, _, _ = struct.unpack('>IIBBBBB', data)
        elif typ == b'PLTE':
            pal = data
        elif typ == b'IDAT':
            idat += data
    if bd != 8:
        raise ValueError('%s: only 8-bit supported' % path)
    raw = zlib.decompress(idat)
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    stride, out, prev, o = w * ch, [], bytearray(w * ch), 0
    for _ in range(h):
        f = raw[o]; o += 1
        line = bytearray(raw[o:o+stride]); o += stride
        if f == 1:
            for x in range(ch, stride):
                line[x] = (line[x] + line[x-ch]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                c = prev[x-ch] if x >= ch else 0
                b = prev[x]
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out.append(bytes(line)); prev = line
    # normalise every colour type to packed RGB
    rgb = []
    for line in out:
        if ct == 2:
            rgb.append(bytearray(line))
        else:
            n = bytearray(w * 3)
            for x in range(w):
                if ct == 3:
                    idx = line[x]; v = (pal[idx*3], pal[idx*3+1], pal[idx*3+2])
                elif ct in (0, 4):
                    g = line[x*ch]; v = (g, g, g)
                else:
                    v = (line[x*4], line[x*4+1], line[x*4+2])
                n[x*3], n[x*3+1], n[x*3+2] = v
            rgb.append(n)
    return w, h, rgb


def write_png(path, w, h, rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
    blob = (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 6))
            + chunk(b'IEND', b''))
    open(path, 'wb').write(blob)


def blit(dst, dw, dh, src, sw, sh, dx, dy, tw, th, step=1):
    """Box-resample src into a tw x th rectangle at (dx, dy). Clipped to dst."""
    for ty in range(th):
        y = dy + ty
        if not (0 <= y < dh):
            continue
        sy0 = ty * sh // th
        sy1 = max(sy0 + 1, (ty + 1) * sh // th)
        line = dst[y]
        for tx in range(tw):
            x = dx + tx
            if not (0 <= x < dw):
                continue
            sx0 = tx * sw // tw
            sx1 = max(sx0 + 1, (tx + 1) * sw // tw)
            r = g = b = n = 0
            for sy in range(sy0, sy1, step):
                rr = src[sy]
                for sx in range(sx0, sx1, step):
                    o = sx * 3
                    r += rr[o]; g += rr[o+1]; b += rr[o+2]; n += 1
            i = x * 3
            line[i] = r // n; line[i+1] = g // n; line[i+2] = b // n


def badge(dst, dw, dh, x, y, text, px):
    """Dark plate with white digits, px pixels per font cell."""
    gw = (len(text) * 6 - 1) * px
    gh = 7 * px
    pad = 2 * px
    for by in range(-pad, gh + pad):
        Y = y + by
        if not (0 <= Y < dh):
            continue
        line = dst[Y]
        for bx in range(-pad, gw + pad):
            X = x + bx
            if 0 <= X < dw:
                i = X * 3
                line[i] = 20; line[i+1] = 26; line[i+2] = 32
    for ci, cch in enumerate(text):
        glyph = DIGITS.get(cch)
        if not glyph:
            continue
        ox = x + ci * 6 * px
        for ry, bits in enumerate(glyph):
            for cx in range(5):
                if not (bits >> (4 - cx)) & 1:
                    continue
                for sy in range(px):
                    Y = y + ry * px + sy
                    if not (0 <= Y < dh):
                        continue
                    line = dst[Y]
                    for sx in range(px):
                        X = ox + cx * px + sx
                        if 0 <= X < dw:
                            i = X * 3
                            line[i] = 255; line[i+1] = 255; line[i+2] = 255


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--scale', type=float, default=3.0, help='output multiplier (default 3)')
    ap.add_argument('--oversize', type=float, default=1.4,
                    help='facility size relative to its plot (default 1.4)')
    ap.add_argument('--level', type=int, default=5, help='facility level 0-5 (default 5)')
    ap.add_argument('--no-badges', action='store_true', help='omit the numbered badges')
    ap.add_argument('--step', type=int, default=1, help='source sampling stride; 2 is ~4x faster')
    ap.add_argument('--out', default='campus-composite.png')
    a = ap.parse_args()

    meta = json.load(open(os.path.join(ROOT, 'campus', 'plots.json')))
    S = a.scale
    W, H = int(meta['canvas'][0] * S), int(meta['canvas'][1] * S)
    print('output %dx%d  scale %.2f  oversize %.2f  level %d' % (W, H, S, a.oversize, a.level))

    print('plate...')
    pw, ph, prows = read_png(os.path.join(ROOT, 'campus', 'campus-plate.png'))
    canvas = [bytearray(3 * W) for _ in range(H)]
    blit(canvas, W, H, prows, pw, ph, 0, 0, W, H, a.step)
    del prows

    for plot in meta['plots']:
        pid = plot['id']
        if pid not in ASSIGN:
            continue
        folder, name = ASSIGN[pid]
        path = os.path.join(ROOT, folder, '%s-L%d.png' % (folder, a.level))
        if not os.path.exists(path):
            print('  plot %-2d SKIP  %s missing' % (pid, path)); continue
        # centre the oversized tile on the plot's centre
        tw = int(plot['w'] * S * a.oversize)
        th = int(plot['h'] * S * a.oversize)
        cx = (plot['x'] + plot['w'] / 2) * S
        cy = (plot['y'] + plot['h'] / 2) * S
        dx, dy = int(cx - tw / 2), int(cy - th / 2)
        print('  plot %-2d %-24s %dx%d at (%d,%d)' % (pid, name, tw, th, dx, dy))
        sw, sh, srows = read_png(path)
        blit(canvas, W, H, srows, sw, sh, dx, dy, tw, th, a.step)
        del srows
        if not a.no_badges:
            badge(canvas, W, H, dx + int(6 * S), dy + int(6 * S), str(pid), max(2, int(2 * S)))

    write_png(a.out, W, H, canvas)
    print('\nwritten %s  (%.1f MB)' % (a.out, os.path.getsize(a.out) / 1e6))
    print('\nkey:')
    for pid in sorted(ASSIGN):
        print('  %2d  %s' % (pid, ASSIGN[pid][1]))


if __name__ == '__main__':
    sys.exit(main())
