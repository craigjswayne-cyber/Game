/**
 * Cut the owner's isometric ladders into game sprites.
 *
 *   node scripts/sprites.mjs [sheetDir] [outDir]
 *
 * WHAT THIS IS FOR. The campus on Club Infrastructure was drawn in code:
 * SVG boxes, a few gradients, and an emoji stuck on the roof of each one to
 * say what it was. The owner had already supplied painted isometric art -
 * ten sheets, nine facilities and the stadium, six stages each - and the
 * answer to "the design isn't to the standard I provided" was that the art
 * existed and the game was not using it. This is the pipeline that makes it
 * use it.
 *
 * WHY CHROMIUM AND NOT AN IMAGE LIBRARY. There is no PIL, no ImageMagick and
 * no sharp in this environment, and adding one to a project whose whole
 * argument is that it has no runtime dependencies would be the wrong trade
 * for a script that runs when the art changes. Chromium is already here for
 * Playwright, and a canvas does every operation this needs: decode, read
 * pixels, flood fill, scale, and encode WebP. Same trick as
 * scripts/groundsqa.ts and scripts/systemqa.ts.
 *
 * WHAT IT DOES TO EACH SHEET.
 *
 *  1. SPLITS a 1536x1024 sheet into a 3x2 grid of 512x512 cells, level 0 to 5
 *     reading left to right, top to bottom.
 *
 *  2. KNOCKS OUT THE BACKGROUND by flood filling inward from the sheet's own
 *     border, not by colour-keying every matching pixel. These tiles have
 *     dark roofs and dark shadows well within tolerance of the dark backdrop,
 *     and a colour key punches holes straight through them. A flood only
 *     reaches what is connected to the outside.
 *
 *  3. FINDS THE TILES AS CONNECTED COMPONENTS of whatever the flood did not
 *     reach, and takes the six largest. Two earlier attempts were worse. A
 *     bounding box per cell swallows the number badge and the caption beneath
 *     each tile, and on seven of the ten sheets the headline above the first
 *     row as well. Splitting each cell into horizontal bands and taking the
 *     tallest fixes the headline but not the badge, which sits four rows under
 *     the tile and merges with it - that is why the first run baked a white
 *     "3" into the roof of the club shop. Components do not care about layout:
 *     a tile is one mass of 100k pixels because its ground plate joins it all
 *     up, a caption is a row of 200-pixel glyphs, and the badge is a disc the
 *     same colour as the backdrop with one digit sitting on it, so the flood
 *     takes the disc and the area filter takes the digit.
 *
 *     It also fixes a second fault the grid had. The cells were a rigid third
 *     of the sheet each, and on the playing surface and kicking sheets the
 *     art runs wider than that, so a tile was clipped at 512px and its
 *     neighbour's edge appeared inside it. A component has no such boundary,
 *     and masking each tile to its own component means a neighbour cannot
 *     appear inside it whatever the spacing.
 *
 *  4. GIVES EVERY LEVEL OF ONE FACILITY THE SAME CANVAS, centred on x and
 *     anchored to the bottom. This is the step that makes an upgrade read as
 *     an upgrade: trimmed independently, a level 5 with a tall building gets
 *     scaled down to fit its own box and its ground plate ends up SMALLER
 *     than the level 0 next to it, so the campus appears to shrink as the
 *     club grows. One shared box per facility, bottom-aligned, and the base
 *     stays put while the building grows out of it.
 *
 *  5. ENCODES WebP at a size the map actually draws. The campus is at most
 *     440px wide and holds nine plots, so a plot is about 140px; these come
 *     out at 300 for a 2x screen and no more, because every one of them is
 *     shipped inside an offline-first PWA.
 */
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'

// storeart/ is gitignored, which is the right place for this: twenty megabytes
// of 1536x1024 source art does not belong in a repository whose entire built
// output is five. The ten sheets are the owner's originals; drop them back in
// here under their facility names - academy.png, briefing.png, gym.png,
// hospitality.png, kicking.png, paddock.png, pitch.png, recovery.png,
// shop.png, stadium.png - and this regenerates all sixty sprites.
const SHEETS = process.argv[2] ?? 'storeart/facilities'
const OUT = process.argv[3] ?? 'src/ui/sprites'
const MAX_W = 300, MAX_H = 260, QUALITY = 0.82

const say = (s) => process.stdout.write(s + '\n')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
await page.setContent('<canvas id="c"></canvas>')

const files = readdirSync(SHEETS).filter(f => f.endsWith('.png')).sort()
let total = 0, bytes = 0
const plates = {}

for (const f of files) {
  const name = basename(f, '.png')
  const b64 = readFileSync(join(SHEETS, f)).toString('base64')
  const tiles = await page.evaluate(async ({ b64, MAX_W, MAX_H, QUALITY }) => {
    const im = new Image()
    im.src = 'data:image/png;base64,' + b64
    await im.decode()
    const W = im.width, H = im.height, N = W * H

    const src = document.createElement('canvas')
    src.width = W; src.height = H
    const sg = src.getContext('2d', { willReadFrequently: true })
    sg.drawImage(im, 0, 0)
    const img = sg.getImageData(0, 0, W, H)
    const D = img.data

    // The backdrop, read from the sheet's own corners: the ten are not all
    // the same dark navy.
    const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]
    const bg = [0, 1, 2].map(k =>
      Math.round(corners.reduce((s, [x, y]) => s + D[((y * W + x) << 2) + k], 0) / corners.length))
    // 16, not the 52 this started with. The backdrop on all ten sheets is
    // near-perfectly flat - measured, it strays at most 6 units from its own
    // corner average - so a tolerance of 52 was not clearing the backdrop, it
    // was clearing everything within 52 of it, and the dark roofs on the
    // briefing suite and the club shop are well inside that. The flood ate
    // through them, reached the lit interiors behind, and broke each tile into
    // several components; the six largest were then six PIECES rather than six
    // tiles, and the buildings came out as black slabs with their windows
    // missing. At 16 the backdrop still floods away completely and a dark roof
    // is comfortably outside it.
    const TOL = 16 * 16
    const isBg = (p) => {
      const i = p << 2
      const dr = D[i] - bg[0], dg = D[i + 1] - bg[1], db = D[i + 2] - bg[2]
      return dr * dr + dg * dg + db * db < TOL
    }

    // ---- 1. flood the backdrop in from the border ----
    const back = new Uint8Array(N)
    const st = new Int32Array(N)
    let sp = 0
    const seed = (p) => { if (!back[p] && isBg(p)) { back[p] = 1; st[sp++] = p } }
    for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x) }
    for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1) }
    while (sp) {
      const p = st[--sp], x = p % W
      if (x > 0) seed(p - 1)
      if (x < W - 1) seed(p + 1)
      if (p >= W) seed(p - W)
      if (p < N - W) seed(p + W)
    }

    // ---- 2. label what it did not reach ----
    const lab = new Int32Array(N).fill(-1)
    const comps = []
    for (let s0 = 0; s0 < N; s0++) {
      if (back[s0] || lab[s0] >= 0) continue
      const id = comps.length
      let area = 0, minx = W, maxx = -1, miny = H, maxy = -1
      sp = 0; lab[s0] = id; st[sp++] = s0
      while (sp) {
        const p = st[--sp], x = p % W, y = (p - x) / W
        area++
        if (x < minx) minx = x
        if (x > maxx) maxx = x
        if (y < miny) miny = y
        if (y > maxy) maxy = y
        const push = (q) => { if (q >= 0 && q < N && !back[q] && lab[q] < 0) { lab[q] = id; st[sp++] = q } }
        if (x > 0) push(p - 1)
        if (x < W - 1) push(p + 1)
        push(p - W); push(p + W)
      }
      comps.push({ id, area, minx, maxx, miny, maxy })
    }

    // Six largest, then read like the sheet: top row left to right, then the
    // bottom row. Sorting on the CENTRE, not the top edge, because a level
    // with a tall building starts higher up the cell than a bare plot does.
    const big = comps.slice().sort((a, b) => b.area - a.area).slice(0, 6)
    const keep = new Set(big.map(c => c.id))
    big.sort((a, b) => {
      const ra = (a.miny + a.maxy) / 2 < H / 2 ? 0 : 1
      const rb = (b.miny + b.maxy) / 2 < H / 2 ? 0 : 1
      return ra - rb || (a.minx + a.maxx) - (b.minx + b.maxx)
    })

    // ---- 3. cut each tile off at the foot of its ground plate ----
    // The number badge under each tile is a disc the colour of the backdrop
    // with one digit on it. At a tolerance of 52 the flood removed the soft
    // shadow under the tile and the badge stood alone, so it was never part of
    // the tile. At 16 the shadow survives - which is correct, it is art - and
    // it reaches DOWN far enough to touch the badge, which welds the badge to
    // the tile and put a white "3" under the training paddock and a "5" under
    // the hospitality boxes.
    //
    // Neither tolerance is wrong; the bounding box is. What actually ends a
    // tile is the bottom vertex of its ground plate, and a plate is BRIGHT -
    // grass, concrete, gravel - where a shadow is not, and wide where a digit
    // is not. So the last row carrying a real run of bright pixels is the foot
    // of the tile, and everything under it is shadow tail and typography.
    const BRIGHT = 60 * 60, RUN = 30
    const foot = (c) => {
      let last = c.maxy
      for (let y = c.maxy; y >= c.miny; y--) {
        let n = 0
        for (let x = c.minx; x <= c.maxx; x++) {
          const p = y * W + x
          if (lab[p] !== c.id) continue
          const i = p << 2
          const dr = D[i] - bg[0], dg = D[i + 1] - bg[1], db = D[i + 2] - bg[2]
          if (dr * dr + dg * dg + db * db > BRIGHT) n++
        }
        if (n >= RUN) { last = y; break }
      }
      // a couple of rows of grace so the plate keeps its own edge
      return Math.min(c.maxy, last + 3)
    }
    for (const c of big) c.maxy = foot(c)

    const cut = big.map(c => {
      const w = c.maxx - c.minx + 1, h = c.maxy - c.miny + 1
      const cnv = document.createElement('canvas')
      cnv.width = w; cnv.height = h
      const g = cnv.getContext('2d')
      const out = g.createImageData(w, h)
      const o = out.data
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = (c.miny + y) * W + (c.minx + x), i = p << 2, j = ((y * w) + x) << 2
        // THIS COMPONENT AND NOTHING ELSE. An earlier version also kept any
        // small scrap inside the box that belonged to no tile, on the theory
        // that a detached sign or awning should survive. What it actually
        // caught was typography: the strapline above the first row falls
        // inside the bounding box of the tile beneath it, so the kicking
        // enclosure shipped with a fragment of "SHARPER GOAL-KICKING" floating
        // over its posts. Losing a rare detached scrap is the cheaper mistake.
        if (lab[p] !== c.id) { o[j + 3] = 0; continue }
        o[j] = D[i]; o[j + 1] = D[i + 1]; o[j + 2] = D[i + 2]; o[j + 3] = 255
      }
      g.putImageData(out, 0, 0)
      return { cnv, w, h, area: c.area }
    })

    // ---- 4. one box for the whole ladder, centred and stood on the floor ----
    const bw = Math.max(...cut.map(t => t.w))
    const bh = Math.max(...cut.map(t => t.h))
    const scale = Math.min(MAX_W / bw, MAX_H / bh, 1)
    const ow = Math.round(bw * scale), oh = Math.round(bh * scale)

    return cut.map(t => {
      const dw = Math.round(t.w * scale), dh = Math.round(t.h * scale)
      const o = document.createElement('canvas')
      o.width = ow; o.height = oh
      const g = o.getContext('2d', { willReadFrequently: true })
      g.imageSmoothingQuality = 'high'
      g.drawImage(t.cnv, Math.round((ow - dw) / 2), oh - dh, dw, dh)

      /* ---- 5. MEASURE THE GROUND PLATE ----
       * The map cannot place these by image width, which is what it did at
       * first and why the estate came out crooked. A tile's image is mostly
       * building; what has to sit in the plot is the PLATE it stands on, and
       * the ten sheets do not agree on one. Measured, their plates run from
       * 1.56 wide-to-tall on the playing surface to 2.28 on the hospitality
       * boxes, because each sheet was rendered at its own camera angle. A
       * true isometric grid is 2.00, so no single lattice makes them meet:
       * laid out by image width, the flat ones overlapped their neighbours
       * and the steep ones left holes.
       *
       * So the pipeline reports what it actually cut, and the map fits each
       * ladder to its plot from these numbers instead of assuming.
       *
       * The plate is the widest run of pixels in the lower half of the tile -
       * above that is building - and it ends at the lowest opaque row, which
       * is its near vertex. */
      const d = g.getImageData(0, 0, ow, oh).data
      let bottom = -1, wide = 0, wideY = -1
      for (let y = oh - 1; y >= 0; y--) {
        let lo = -1, hi = -1
        for (let x = 0; x < ow; x++) if (d[((y * ow + x) << 2) + 3] > 40) { if (lo < 0) lo = x; hi = x }
        if (lo < 0) continue
        if (bottom < 0) bottom = y
        if (y > oh * 0.45 && hi - lo + 1 > wide) { wide = hi - lo + 1; wideY = y }
      }
      return {
        url: o.toDataURL('image/webp', QUALITY), w: ow, h: oh, tw: t.w, th: t.h, area: t.area,
        pw: wide, ph: Math.max(2, (bottom - wideY) * 2),
      }
    })
  }, { b64, MAX_W, MAX_H, QUALITY })

  // A merge shows up as one component carrying two tiles, so the areas stop
  // looking like each other. Worth saying out loud rather than finding it in
  // the contact sheet.
  plates[name] = {
    w: tiles[0].w, h: tiles[0].h,
    pw: Math.max(...tiles.map(t => t.pw)),
    ph: Math.max(...tiles.map(t => t.ph)),
  }
  const areas = tiles.map(t => t.area)
  const spread = Math.max(...areas) / Math.min(...areas)
  let sheetBytes = 0
  tiles.forEach((t, lvl) => {
    const buf = Buffer.from(t.url.split(',')[1], 'base64')
    writeFileSync(join(OUT, `${name}-${lvl}.webp`), buf)
    sheetBytes += buf.length; bytes += buf.length; total++
  })
  say(`  ${name.padEnd(12)} 6 at ${tiles[0].w}x${tiles[0].h}  ${(sheetBytes / 6144).toFixed(0)}KB each`
    + `  source ${Math.min(...tiles.map(t => t.tw))}-${Math.max(...tiles.map(t => t.tw))}px wide`
    + (spread > 1.9 ? `  CHECK: areas differ ${spread.toFixed(1)}x, two tiles may have joined` : ''))
}

/* The manifest the map reads. One entry per ladder, holding the canvas the
 * six levels share and the LARGEST plate any of them has - largest, because
 * all six are scaled together so the plot does not change size when the club
 * builds on it, and the biggest plate is the one that has to fit. */
writeFileSync(join(OUT, 'plates.json'), JSON.stringify(plates, null, 1) + '\n')
say(`\n${total} sprites, ${(bytes / 1024).toFixed(0)}KB total, into ${OUT}/`)
say(`plates.json: ${Object.keys(plates).length} ladders, plate ratios `
  + Object.values(plates).map(p => (p.pw / p.ph).toFixed(2)).sort().join(' '))
await browser.close()
