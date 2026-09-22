#!/usr/bin/env python3
"""Cut the locked facility masters down to game assets, and emit their geometry.

The masters are 1254px tiles and a 1086x1448 plate - right for reference, far
too heavy to ship. This writes:

    public/art/campus/plate.png          the town, downscaled
    public/art/campus/construction.png   the site-under-works tile
    public/art/facilities/<fac>-L<n>.png  60 facility tiles

and src/game/campusPlots.ts, the ten plot rectangles as percentages so the
screen can place tiles without importing JSON or hard-coding pixels.

Pure stdlib. The PNG writer picks a filter per row the way encoders normally
do - the naive all-zero filter this started with compresses renders badly.
"""
import json, os, struct, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
MASTERS = os.path.join(ROOT, 'art', 'masters')
PUB = os.path.join(ROOT, 'public', 'art')

TILE = 192          # facility tile, square
PLATE_W = 768       # plate width; height follows the 3:4 master

FACILITIES = ['playing-surface', 'stadium', 'gym', 'recovery', 'paddock',
              'kicking', 'analysis', 'academy', 'hospitality', 'shop']


def read_png(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', path
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
    assert bd == 8, path
    raw = zlib.decompress(idat)
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    stride, out, prev, o = w * ch, [], bytearray(w * ch), 0
    for _ in range(h):
        f = raw[o]; o += 1
        line = bytearray(raw[o:o+stride]); o += stride
        if f == 1:
            for x in range(ch, stride): line[x] = (line[x] + line[x-ch]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                c = prev[x-ch] if x >= ch else 0
                b = prev[x]; p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out.append(bytes(line)); prev = line
    rgb = []
    for line in out:
        if ct == 2:
            rgb.append(bytearray(line)); continue
        n = bytearray(w * 3)
        for x in range(w):
            if ct == 3:
                k = line[x]; v = (pal[k*3], pal[k*3+1], pal[k*3+2])
            elif ct in (0, 4):
                g = line[x*ch]; v = (g, g, g)
            else:
                v = (line[x*4], line[x*4+1], line[x*4+2])
            n[x*3], n[x*3+1], n[x*3+2] = v
        rgb.append(n)
    return w, h, rgb


def box_resize(sw, sh, rows, tw, th):
    """Average every source pixel that falls in a target cell."""
    out = []
    for ty in range(th):
        sy0, sy1 = ty * sh // th, max(ty * sh // th + 1, (ty + 1) * sh // th)
        line = bytearray(tw * 3)
        for tx in range(tw):
            sx0, sx1 = tx * sw // tw, max(tx * sw // tw + 1, (tx + 1) * sw // tw)
            r = g = b = n = 0
            for sy in range(sy0, sy1):
                rr = rows[sy]
                for sx in range(sx0, sx1):
                    o = sx * 3
                    r += rr[o]; g += rr[o+1]; b += rr[o+2]; n += 1
            i = tx * 3
            line[i] = r // n; line[i+1] = g // n; line[i+2] = b // n
        out.append(line)
    return out


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
    return a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)


def write_png(path, w, h, rows):
    """Adaptive filtering: per row, pick the filter with the smallest sum of
    absolute differences. That is the standard heuristic, and on these renders
    it is worth roughly a third of the file against no filtering at all."""
    bpp, stride = 3, w * 3
    prev = bytearray(stride)
    chunks = []
    for line in rows:
        cands = []
        # 0 none
        cands.append((sum(line), 0, bytes(line)))
        # 1 sub
        s = bytearray(stride)
        for x in range(stride):
            s[x] = (line[x] - (line[x-bpp] if x >= bpp else 0)) & 255
        cands.append((sum(v if v < 128 else 256-v for v in s), 1, bytes(s)))
        # 2 up
        u = bytearray(stride)
        for x in range(stride):
            u[x] = (line[x] - prev[x]) & 255
        cands.append((sum(v if v < 128 else 256-v for v in u), 2, bytes(u)))
        # 4 paeth
        pth = bytearray(stride)
        for x in range(stride):
            a = line[x-bpp] if x >= bpp else 0
            c = prev[x-bpp] if x >= bpp else 0
            pth[x] = (line[x] - _paeth(a, prev[x], c)) & 255
        cands.append((sum(v if v < 128 else 256-v for v in pth), 4, bytes(pth)))
        _, ft, data = min(cands, key=lambda t: t[0])
        chunks.append(bytes([ft]) + data)
        prev = line
    raw = b''.join(chunks)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
    blob = (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(blob)
    return len(blob)


def main():
    total = 0
    os.makedirs(os.path.join(PUB, 'facilities'), exist_ok=True)
    os.makedirs(os.path.join(PUB, 'campus'), exist_ok=True)

    # ---- the plate ------------------------------------------------------
    meta = json.load(open(os.path.join(MASTERS, 'campus', 'plots.json')))
    cw, chh = meta['canvas']
    ph = round(PLATE_W * chh / cw)
    w, h, rows = read_png(os.path.join(MASTERS, 'campus', 'campus-plate.png'))
    n = write_png(os.path.join(PUB, 'campus', 'plate.png'), PLATE_W, ph,
                  box_resize(w, h, rows, PLATE_W, ph))
    total += n
    print('plate            %4dx%-4d %6.1f KB' % (PLATE_W, ph, n/1024))

    # ---- the construction tile -----------------------------------------
    src = os.path.join(MASTERS, 'campus', 'construction.png')
    if os.path.exists(src):
        w, h, rows = read_png(src)
        n = write_png(os.path.join(PUB, 'campus', 'construction.png'), TILE, TILE,
                      box_resize(w, h, rows, TILE, TILE))
        total += n
        print('construction     %4dx%-4d %6.1f KB' % (TILE, TILE, n/1024))
    else:
        print('construction     MISSING at %s' % src)

    # ---- the sixty tiles -------------------------------------------------
    for fac in FACILITIES:
        for lvl in range(6):
            s = os.path.join(MASTERS, fac, '%s-L%d.png' % (fac, lvl))
            if not os.path.exists(s):
                print('  %s L%d MISSING' % (fac, lvl)); continue
            w, h, rows = read_png(s)
            n = write_png(os.path.join(PUB, 'facilities', '%s-L%d.png' % (fac, lvl)),
                          TILE, TILE, box_resize(w, h, rows, TILE, TILE))
            total += n
        print('%-16s 6 tiles' % fac)

    # ---- the geometry, as percentages -----------------------------------
    lines = [
        '// GENERATED by scripts/art/build_web_assets.py - do not edit by hand.',
        '//',
        '// The ten plots of public/art/campus/plate.png, as percentages of the',
        '// plate so the screen never has to know its pixel size. Measured off the',
        '// rendered plate rather than laid out on a grid: it is a hand-drawn town,',
        '// and the plots vary by about 3%, so each tile is placed in its own rect.',
        '',
        "import type { FacilityId } from './model'",
        '',
        '/** The campus holds the nine buildable facilities AND the ground. The',
        ' *  ground is not a FacilityId - it is levelled by capacity rather than by',
        ' *  a board request - so the map carries it as its own member. */',
        "export type CampusId = FacilityId | 'stadium'",
        '',
        'export interface CampusPlot {',
        '  /** which facility stands here */',
        '  fid: CampusId',
        '  /** the art folder the six tiles live in, which is not always the id:',
        "   *  the pitch is drawn as 'playing-surface', the briefing room as",
        "   *  'analysis'. Emitted rather than mapped in the screen so the names",
        '   *  can only ever disagree in one place. */',
        '  art: string',
        '  /** percentages of the plate: left, top, width, height */',
        '  x: number; y: number; w: number; h: number',
        '}',
        '',
        '/** Facilities draw larger than their plot so they read at map scale - the',
        ' *  same 1.45 the reference composite uses. Centred, so the overspill is',
        ' *  even and lands on the verge rather than the road. */',
        'export const PLOT_OVERSIZE = 1.45',
        '',
        '/** What the ground has to hold to draw at each tier. The club ladder runs',
        ' *  from about 1,500 seats to about 62,500, so the bands are spread across',
        ' *  that rather than up to the 82,000 cap a top club can expand into. */',
        'export const STADIUM_TIERS = [3_000, 8_000, 16_000, 28_000, 45_000] as const',
        '',
        'export function stadiumLevel(capacity: number): number {',
        '  let n = 0',
        '  for (const t of STADIUM_TIERS) if (capacity >= t) n++',
        '  return n',
        '}',
        '',
        'export const CAMPUS_PLOTS: CampusPlot[] = [',
    ]
    # plot id -> facility, in the order the composite assigns them
    ASSIGN = {1: 'academy', 2: 'paddock', 3: 'gym', 4: 'kicking', 5: 'stadium',
              6: 'pitch', 7: 'recovery', 8: 'briefing', 9: 'shop', 10: 'hospitality'}
    # the two whose art folder is not their id
    ART = {'pitch': 'playing-surface', 'briefing': 'analysis'}
    for p in meta['plots']:
        fid = ASSIGN[p['id']]
        lines.append('  { fid: %-14s art: %-18s x: %6.3f, y: %6.3f, w: %6.3f, h: %6.3f },' % (
            "'%s'," % fid, "'%s'," % ART.get(fid, fid),
            p['x']/cw*100, p['y']/chh*100, p['w']/cw*100, p['h']/chh*100))
    lines.append(']')
    lines.append('')
    out = os.path.join(ROOT, 'src', 'game', 'campusPlots.ts')
    open(out, 'w').write('\n'.join(lines))
    print('\nsrc/game/campusPlots.ts written')
    print('total shipped art: %.2f MB' % (total/1e6))


if __name__ == '__main__':
    sys.exit(main())
