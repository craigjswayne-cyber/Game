// Turn the key-art poster into the title screen's background.
//
// Kept as a script rather than done once by hand, because the art will be
// re-cut and every one of the decisions below will have to be made again.
//
//   node scripts/titlebg.mjs <poster.png>
//
// WHAT THIS DOES: it paints the poster's own title lockup out of the picture,
// so the background is the manager's office and nothing else, and the screen's
// live wordmark is the only title on it.
//
// THREE THINGS THAT LOOK LIKE THE ANSWER AND ARE NOT:
//
//   Cropping the lockup out. Leaves a landscape image on a portrait screen,
//   which `cover` then magnifies enormously - the picture arrives as a texture
//   rather than as a room.
//
//   Blurring the lettering. Blurring white letters on a dark ground does not
//   remove them, it spreads their brightness into a halo. Reported back from a
//   real phone as "a weird glow", and that is exactly what it was.
//
//   Framing the lockup above the viewport. Works, but only the desk is left
//   below it, so the screen shows a desk under a lamp rather than an office.
//
// WHAT WORKS is to take the lettering out and rebuild what was behind it. That
// is possible here and would not be on most art: the lockup sits on the dark
// wall between the framed photo and the tactics board, so the pixels behind it
// are a slow vignette with no detail in them. Detail elsewhere in the frame -
// the trophy, the ball, the shirt, the chair, the lamp - is never touched,
// because the mask is per-pixel and bounded away from all of it.
//
// The darkening is left to CSS rather than baked in, so the balance between
// "premium office" and "readable text" can be tuned without re-encoding.
//
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = process.argv[2]
if (!SRC) { console.error('usage: node scripts/titlebg.mjs <poster.png>'); process.exit(1) }
const OUT = process.argv[3] ?? 'src/ui/title-bg.webp'

const b64 = readFileSync(SRC).toString('base64')
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 100, height: 100 } })

const out = await page.evaluate(async (data) => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + data
  await img.decode()

  const W = img.width, H = img.height
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0)
  const im = g.getImageData(0, 0, W, H)
  const d = im.data

  // The two boxes the lockup lives in, as fractions of the frame so that
  // re-cut art at another size still lands. Everything outside them is
  // untouchable: the trophy's left shoulder is 4px from the M of MANAGER and
  // the lamp's cone is inside the logo's rows, so these edges are not slack.
  // The boxes the lockup lives in, as fractions of the frame. They are per-art
  // and they are tight on purpose: the "PHASE" ball, the trophy, the shirt and
  // the chair all come within a few pixels of the type, and a lazy box that
  // swallowed any of them would repaint real detail as wall. Measured with
  // scripts/lib/inkscan.mjs; re-measure when the art is re-cut.
  // The boxes the lockup lives in, as fractions of the frame. They are per-art
  // and they are tight on purpose: the "PHASE" ball, the trophy, the shirt and
  // the chair all come within a few pixels of the type, and a lazy box that
  // swallowed any of them would repaint real detail as wall. Re-measure when
  // the art is re-cut - scripts/lib/inkscan.mjs prints the extents.
  //
  // `mode: 'green'` narrows a box to the brand green only, which is how the
  // thin rule under the wordmark can be chased out to the edges of the frame
  // without the pass also biting the chair's leather highlights on the way.
  const BOXES = [
    { x0: 0.400, x1: 0.595, y0: 0.066, y1: 0.182 },                 // the ball roundel
    { x0: 0.285, x1: 0.700, y0: 0.200, y1: 0.376 },                 // PHASE / RUGBY
    { x0: 0.205, x1: 0.795, y0: 0.378, y1: 0.470 },                 // MANAGER
    { x0: 0.780, x1: 0.832, y0: 0.374, y1: 0.408 },                 // its trademark
    { x0: 0.180, x1: 0.930, y0: 0.468, y1: 0.503, mode: 'green' },  // the rule, out to its faded ends
    { x0: 0.225, x1: 0.760, y0: 0.500, y1: 0.537 },                 // the tagline
  ]
  const boxAt = (x, y) => BOXES.find(bx =>
    x >= bx.x0 * W && x <= bx.x1 * W && y >= bx.y0 * H && y <= bx.y1 * H)
  const inBox = (x, y) => boxAt(x, y) !== undefined

  // Ink, as opposed to room. White lettering reads as bright and neutral; the
  // brand green reads as green and nothing else in these boxes is. The green
  // threshold is low because the rule and the type's antialiasing fade almost
  // into the wall, and a remnant too faint to name is still a remnant - the
  // first pass at this left dashes of the rule behind, at both ends.
  const isInk = (i, mode) => {
    const R = d[i], G = d[i + 1], B = d[i + 2]
    const mn = Math.min(R, G, B), mx = Math.max(R, G, B)
    if (G > 26 && G - R > 8 && G - B > 5) return true       // brand green
    if (mode === 'green') return false
    return mn > 115 && mx - mn < 45                          // white type
  }

  const N = W * H
  const mask = new Uint8Array(N)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const bx = boxAt(x, y)
      if (!bx) continue
      if (isInk((y * W + x) * 4, bx.mode)) mask[y * W + x] = 1
    }
  }

  // Grow the mask. Type is antialiased and the poster's own rendering put a
  // faint bloom around it; leaving either behind is what a ghost of the title
  // looks like. Growth stays inside the boxes.
  const grow = (m, r) => {
    let cur = m
    for (let pass = 0; pass < r; pass++) {
      const next = cur.slice()
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (cur[y * W + x] || !inBox(x, y)) continue
          if (cur[(y - 1) * W + x] || cur[(y + 1) * W + x] || cur[y * W + x - 1] || cur[y * W + x + 1]) {
            next[y * W + x] = 1
          }
        }
      }
      cur = next
    }
    return cur
  }
  const painted = grow(mask, 7)
  const original = painted.slice()

  // Fill inwards from the edge of the hole: every pass, any masked pixel that
  // touches known ground takes the mean of that ground. Repeated, this walks
  // the wall's own colour into the hole from all sides at once, which is what
  // makes it match the vignette rather than sit on it as a flat patch.
  const known = new Uint8Array(N)
  for (let i = 0; i < N; i++) known[i] = painted[i] ? 0 : 1
  let left = 0
  for (let i = 0; i < N; i++) if (!known[i]) left++
  while (left > 0) {
    const filled = []
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x
        if (known[p]) continue
        let r = 0, gg = 0, b = 0, n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const qx = x + dx, qy = y + dy
            if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue
            const q = qy * W + qx
            if (!known[q]) continue
            r += d[q * 4]; gg += d[q * 4 + 1]; b += d[q * 4 + 2]; n++
          }
        }
        if (!n) continue
        d[p * 4] = r / n; d[p * 4 + 1] = gg / n; d[p * 4 + 2] = b / n
        filled.push(p)
      }
    }
    if (!filled.length) break
    for (const p of filled) { known[p] = 1; left-- }
  }

  // The fill leaves faint contour rings where the passes met. Smooth ONLY the
  // pixels that were painted, reading from everything - so the join to the
  // untouched wall stays exact and nothing real is softened. This is not the
  // blur that failed: there is no bright type left to spread, only new wall.
  const src = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) { src[i * 3] = d[i * 4]; src[i * 3 + 1] = d[i * 4 + 1]; src[i * 3 + 2] = d[i * 4 + 2] }
  for (let pass = 0; pass < 26; pass++) {
    const next = src.slice()
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x
        if (!original[p]) continue
        for (let ch = 0; ch < 3; ch++) {
          next[p * 3 + ch] = (
            src[(p - W) * 3 + ch] + src[(p + W) * 3 + ch] +
            src[(p - 1) * 3 + ch] + src[(p + 1) * 3 + ch] +
            src[p * 3 + ch] * 2) / 6
        }
      }
    }
    src.set(next)
  }
  for (let i = 0; i < N; i++) {
    if (!original[i]) continue
    d[i * 4] = src[i * 3]; d[i * 4 + 1] = src[i * 3 + 1]; d[i * 4 + 2] = src[i * 3 + 2]
  }

  g.putImageData(im, 0, 0)

  // Down to a sane delivery size. This is an offline PWA whose shell is
  // precached; a 2MB poster on the first screen is a bad trade.
  const OW = 900, OH = Math.round(H * (OW / W))
  const o = document.createElement('canvas')
  o.width = OW; o.height = OH
  const og = o.getContext('2d')
  og.imageSmoothingQuality = 'high'
  og.drawImage(c, 0, 0, OW, OH)
  // Did any of it survive? Re-cut art will not land on the boxes above, and
  // the failure mode is quiet: a dash of the rule or the tail of a letter left
  // sitting on the wall, too faint to notice here and perfectly visible on a
  // phone. So the whole lockup band is re-read after the repaint and anything
  // still ink-coloured is reported with where it is, in fractions, ready to be
  // pasted into a box.
  const after = g.getImageData(0, 0, W, H).data
  const survivors = []
  for (let y = Math.round(0.05 * H); y < Math.round(0.56 * H); y++) {
    for (let x = Math.round(0.17 * W); x < Math.round(0.84 * W); x++) {
      const i = (y * W + x) * 4
      const R = after[i], G = after[i + 1], B = after[i + 2]
      const mn = Math.min(R, G, B), mx = Math.max(R, G, B)
      if ((mn > 150 && mx - mn < 40) || (G > 60 && G - R > 30 && G - B > 20)) {
        survivors.push([x / W, y / H])
      }
    }
  }

  let painted2 = 0
  for (let i = 0; i < N; i++) if (original[i]) painted2++
  return { webp: o.toDataURL('image/webp', 0.86), w: OW, h: OH, painted: painted2, src: `${W}x${H}`, survivors }
}, b64)

const buf = Buffer.from(out.webp.split(',')[1], 'base64')
writeFileSync(OUT, buf)
console.log(`${OUT}: ${out.w}x${out.h} from ${out.src}, ${(buf.length / 1024).toFixed(0)} KB, ${out.painted} px repainted`)
await browser.close()

// The frame legitimately holds bright things inside the band - the trophy, the
// lit edge of the shirt - so a handful of survivors is the picture, not a
// ghost. A crowd of them in one place is a ghost. Report the extent so the
// boxes can be moved rather than guessed at.
if (out.survivors.length) {
  const xs = out.survivors.map(s => s[0]), ys = out.survivors.map(s => s[1])
  const f = (n) => n.toFixed(3)
  console.log(`  note: ${out.survivors.length} ink-coloured px left in the lockup band, ` +
    `x ${f(Math.min(...xs))}-${f(Math.max(...xs))}, y ${f(Math.min(...ys))}-${f(Math.max(...ys))}`)
  if (out.survivors.length > 400) {
    console.error('  that is a lot: the art has moved under the BOXES above. Re-measure them.')
    process.exitCode = 1
  }
}
