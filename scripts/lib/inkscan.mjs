// Where is the type in this poster? Prints, per row, how many pixels look like
// lettering and how far they reach across - as fractions, ready to be pasted
// into the BOXES in scripts/titlebg.mjs.
//
// Not a probe and not shipped. It exists because the boxes in titlebg.mjs are
// per-art: the second cut of the key art moved the whole lockup down and out,
// and boxes measured on the first cut left a leg of the M and both ends of the
// rule sitting on the wall. Measure, do not guess.
//
//   node scripts/lib/inkscan.mjs <poster.png>
//   node scripts/lib/inkscan.mjs <poster.png> 4     (every 4th row)
//
// Read it by looking for runs of rows with a similar x-range: each run is one
// line of type. Ignore rows whose x-range suddenly jumps to the edges of the
// frame - that is the lamp on the left or the shirt on the right, and those
// are things the repaint must not touch.
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'

const SRC = process.argv[2]
if (!SRC) { console.error('usage: node scripts/lib/inkscan.mjs <poster.png> [step]'); process.exit(1) }
const STEP = Number(process.argv[3] ?? 4)

const b64 = readFileSync(SRC).toString('base64')
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 100, height: 100 } })
const r = await page.evaluate(async (data) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode()
  const W = img.width, H = img.height
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, W, H).data
  // Same test as titlebg.mjs, so what shows up here is what that will paint.
  const ink = (i) => {
    const R = d[i], G = d[i + 1], B = d[i + 2]
    const mn = Math.min(R, G, B), mx = Math.max(R, G, B)
    return (G > 26 && G - R > 8 && G - B > 5) || (mn > 115 && mx - mn < 45)
  }
  const rows = []
  for (let y = 0; y < H; y++) {
    let n = 0, x0 = W, x1 = -1
    for (let x = 0; x < W; x++) {
      if (!ink((y * W + x) * 4)) continue
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x
    }
    rows.push([y, n, x0, x1])
  }
  return { W, H, rows }
}, b64)
await browser.close()

const f = (n) => n.toFixed(3)
console.log(`${SRC}: ${r.W}x${r.H}`)
console.log('row\ty\tpx\tx range\tx fractions')
for (const [y, n, x0, x1] of r.rows) {
  if (y % STEP || n < 12) continue
  console.log(`${y}\t${f(y / r.H)}\t${n}\t${x0}-${x1}\t${f(x0 / r.W)}-${f(x1 / r.W)}`)
}
