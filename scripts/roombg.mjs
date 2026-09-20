// Turn a room photograph into a screen's background.
//
//   node scripts/roombg.mjs <room.png> <out.webp> [centre]
//
// One script for every room the game gets, because the second one arrived the
// same afternoon as the first - the treatment room behind Medical, then the
// gym behind Training and its Staff tab - and two copies of this reasoning
// would already have started to drift. `centre` is the only thing that
// differs between them.
//
// A script rather than a one-off crop in an image editor, for the reason
// scripts/titlebg.mjs gives: the art will be re-shot or re-cut, and every
// decision below will have to be made again by somebody who was not here.
//
// ---- WHY THE SOURCE IS CROPPED TO PORTRAIT ----
//
// The photograph is landscape (1672x941, 1.78:1) and the screen it has to sit
// behind is a phone (~390x700, 0.56:1). `cover` on that viewport scales the
// picture to the screen's HEIGHT and then shows about a third of its width -
// the same trap titlebg.mjs records: at that magnification a room arrives as a
// texture rather than as a room, and which third you get depends on the phone.
//
// So the crop is made HERE, at 4:5, where it can be chosen rather than
// inherited from whatever viewport the player happens to hold. The centre is
// the argument, and it is per-room: pick the framing that holds the things
// that NAME the room, because at the scrim strength theme.css puts over these
// that is all a player will ever get from one.
//
//   med-bg  0.62  the recovery board, the table with the towel on it, the
//                 massage gun, and the anatomy poster behind. Further left
//                 loses the board; further right loses the poster and roller.
//   gym-bg  0.26  the rack with the loaded bar, the dumbbell wall and the
//                 DISCIPLINE BUILDS FREEDOM panel, whole rather than clipped
//                 mid-word. The right half of that
//                 frame is floor and a whiteboard, which is the part of a gym
//                 that looks like any other room.
//
// ---- AND WHY IT IS BLURRED ----
//
// titlebg.mjs argues against blur and is right about the job it was doing:
// blurring bright lettering spreads it into a halo instead of removing it, and
// the title screen wants its room sharp because the room IS the screen.
//
// This is the opposite job. These screens are dense stacks of tables - names,
// weeks, percentages, attribute grids, staff rows - and a sharp photograph
// behind them is something the eye keeps trying to read. The owner's brief was
// "subtle, in the background", and a background you stop reading is what
// subtle means here. A light Gaussian does that, costs about a third of the
// file, and has the useful side effect of settling the lettering in the
// picture (the board, the posters) into tone rather than words.
//
// The darkening is NOT baked in. It lives in theme.css as a scrim mixed from
// var(--canvas), so the picture sits correctly under every skin in the game
// and the balance between "you can see a room" and "you can read a table" is a
// number to change rather than a re-encode.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = process.argv[2]
const OUT = process.argv[3]
if (!SRC || !OUT) { console.error('usage: node scripts/roombg.mjs <room.png> <out.webp> [centre]'); process.exit(1) }

/** Where the crop is centred, across the frame. See the note above. */
const CENTRE = Number(process.argv[4] ?? 0.5)
/** Portrait, wider than a phone so a tablet does not crop into it further. */
const ASPECT = 0.8
/** Delivered size. 820 wide is a 2x phone; title-bg.webp ships 900 for a
 *  picture that has to be sharp, and this one does not. */
const OUT_W = 820
/** Gaussian sigma at the DELIVERED scale, so re-encoding at another size keeps
 *  the same softness rather than the same pixel count. */
const SIGMA = 2.6

const b64 = readFileSync(SRC).toString('base64')
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 100, height: 100 } })

const out = await page.evaluate(async ({ data, centre, aspect, outW, sigma }) => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + data
  await img.decode()
  const W = img.width, H = img.height

  // the tallest 4:5 box the frame can give, clamped inside it
  const cw = Math.min(W, Math.round(H * aspect))
  const ch = Math.round(cw / aspect)
  const x0 = Math.max(0, Math.min(W - cw, Math.round(centre * W - cw / 2)))
  const y0 = Math.max(0, Math.round((H - ch) / 2))

  const outH = Math.round(outW / aspect)
  const c = document.createElement('canvas')
  c.width = outW; c.height = outH
  const g = c.getContext('2d')
  g.imageSmoothingQuality = 'high'
  // The blur is applied by the canvas filter on the way down rather than by
  // hand afterwards: it is the same separable Gaussian, done by the compositor,
  // and doing it during the downscale means the resample and the blur agree
  // about what a pixel is. Drawn oversized and clipped back, because a filtered
  // drawImage pulls transparent black in from outside the source rectangle and
  // would otherwise leave a soft grey frame around all four edges.
  const bleed = Math.ceil(sigma * 3)
  g.filter = `blur(${sigma}px)`
  g.drawImage(img, x0, y0, cw, ch,
    -bleed, -bleed, outW + bleed * 2, outH + bleed * 2)
  g.filter = 'none'

  return {
    webp: c.toDataURL('image/webp', 0.82),
    w: outW, h: outH,
    crop: `${cw}x${ch} at ${(x0 / W).toFixed(3)},${(y0 / H).toFixed(3)} of ${W}x${H}`,
  }
}, { data: b64, centre: CENTRE, aspect: ASPECT, outW: OUT_W, sigma: SIGMA })

const buf = Buffer.from(out.webp.split(',')[1], 'base64')
writeFileSync(OUT, buf)
console.log(`${OUT}: ${out.w}x${out.h}, ${(buf.length / 1024).toFixed(0)} KB — crop ${out.crop}, blur σ${SIGMA}`)
await browser.close()

// A background nobody can see through is not a background. The title screen's
// own art ships at 116 KB and is the first thing a career loads; this one is
// behind one screen, so it has a smaller claim on a metered connection.
if (buf.length > 140 * 1024) {
  console.error(`  that is large for a screen background - drop OUT_W or the quality`)
  process.exitCode = 1
}
