// Store screenshots: the eight-frame story, composed around real captures.
//
// One composition, laid out in units of the frame's width (1u = width/1080),
// rendered at each store's exact pixel size. Nothing is resized from a smaller
// export: every size is drawn fresh from the vector layout and the 3x captures.
//
//   node scripts/launch/capture.mjs        (real screens, storeart/raw/en)
//   node scripts/launch/storeframes.mjs    (frames, docs/launch/assets/02-store/final)
//
// Sizes are the official ones recorded in docs/launch/PLATFORM-SPECS.md.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { C, fontFace, mark, head } from './brand.mjs'

const RAW = process.env.RAW || 'storeart/raw/en'
// story frames use the game's own Text size: Bigger, so a short story fills the screen
const RAW_BIG = process.env.RAW_BIG || 'storeart/raw/en-z1.15'
let SIZE = {}
const rawOf = (f) => `${f.big ? (SIZE.rawBig ?? RAW_BIG) : (SIZE.raw ?? RAW)}/${f.shot}.png`
const OUT = process.env.OUT || 'docs/launch/assets/02-store/final'
const TMP = 'storeart/tmp'
mkdirSync(TMP, { recursive: true })

export const FRAMES = [
  { id: 'STO-01', shot: 'home', h: 'Your club.|Your way.',
    sub: 'Every Monday the desk fills up. What happens next is up to you.' },
  { id: 'STO-02', shot: 'match-fulltime', h: 'Every decision|has consequences.',
    sub: 'Lose, and the coach tells you exactly why. Then you fix it.', focus: 0.47 },
  { id: 'STO-03', shot: 'word-kept', big: true, h: 'Your players|remember.',
    sub: 'Keep your word and they will run through a wall for you.' },
  { id: 'STO-04', shot: 'agents', big: true, h: 'The world|remembers.',
    sub: 'Break a promise and every agent in the game hears about it.' },
  { id: 'STO-05', shot: 'offers', h: 'Build|your squad.',
    sub: 'Rivals come for your best players. Sell, or hold your nerve.' },
  { id: 'STO-06', shot: 'tactics', h: 'Master|matchday.',
    sub: 'Pick the fifteen. Set the plan. Change it at half-time.' },
  { id: 'STO-07', shot: 'legacy', h: 'Build|your legacy.',
    sub: 'Every season goes on your record. So does every nemesis.' },
  { id: 'STO-08', closer: true, h: 'No two|careers are|the same.' },
]

const SIZES = [
  { store: 'play', w: 1080, h: 2340 },  // Play phone, 9:19.5, inside 320-3840 and 2:1
  { store: 'ios-6.9', w: 1320, h: 2868 }, // App Store iPhone 6.9" (accepted size)
  // App Store iPad 13": the tablet layout, captured at 1032x1376 @2x, laid out
  // on a 1500-unit grid so the type keeps its weight on a wider page
  { store: 'ipad-13', w: 2064, h: 2752, ref: 1500, raw: 'storeart/raw/en-1032x1376', rawBig: 'storeart/raw/en-1032x1376-z1.15', noFocus: true },
]

function frameHtml(f, W, H) {
  const u = W / (SIZE.ref ?? 1080)
  const img = f.shot ? 'file://' + resolve(rawOf(f)) : ''
  const css = `
${fontFace}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body {
  font-family: 'Space Grotesk', sans-serif; color: ${C.text};
  background:
    radial-gradient(${900 * u}px ${1100 * u}px at 50% ${1500 * u}px, ${C.surface1} 0%, ${C.canvas} 70%),
    ${C.canvas};
  -webkit-font-smoothing: antialiased; position: relative;
}
.top { position: absolute; left: ${96 * u}px; right: ${96 * u}px; top: ${118 * u}px; }
.eyebrow { display: flex; align-items: center; gap: ${18 * u}px;
  font-size: ${24 * u}px; font-weight: 700; letter-spacing: ${6 * u}px; color: ${C.text2}; text-transform: uppercase; }
.eyebrow .rule { width: ${56 * u}px; height: ${2 * u}px; background: ${C.borderStrong}; }
h1 { margin-top: ${64 * u}px; font-size: ${88 * u}px; line-height: 1.0; font-weight: 700; letter-spacing: ${-2 * u}px; text-transform: uppercase; }
h1 .dot { color: ${C.primary}; }
.sub { margin-top: ${34 * u}px; margin-right: ${60 * u}px; font-size: ${35 * u}px; line-height: 1.38; color: ${C.text2}; font-weight: 400; }
.screen { position: absolute; left: ${110 * u}px; right: ${110 * u}px; top: ${690 * u}px; height: ${2000 * u}px;
  border-radius: ${54 * u}px; overflow: hidden; border: ${3 * u}px solid ${C.borderStrong};
  background: ${C.canvas}; box-shadow: 0 ${40 * u}px ${120 * u}px rgba(0,0,0,0.55); }
.screen img { width: 100%; display: block; }
.fade { position: absolute; left: 0; right: 0; bottom: 0; height: ${260 * u}px;
  background: linear-gradient(to bottom, rgba(26,32,30,0), ${C.canvas} 92%); }
/* closer */
.closer { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 ${96 * u}px; }
.closer h1 { position: static; font-size: ${118 * u}px; margin-top: ${70 * u}px; }
.closer .word { margin-top: ${46 * u}px; font-size: ${30 * u}px; letter-spacing: ${8 * u}px; font-weight: 700; color: ${C.text2}; }
.facts { margin-top: ${110 * u}px; width: 100%; max-width: ${760 * u}px; }
.facts div { display: flex; justify-content: space-between; padding: ${26 * u}px 0; border-top: ${2 * u}px solid ${C.border};
  font-size: ${34 * u}px; color: ${C.text}; }
.facts div:last-child { border-bottom: ${2 * u}px solid ${C.border}; }
.facts span { color: ${C.text2}; }
`
  if (f.closer) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="closer">
  ${mark(220 * u)}
  <h1>${head(f.h)}</h1>
  <div class="word">PHASE: RUGBY MANAGER</div>
  <div class="facts">
    <div>171 clubs<span>15 leagues</span></div>
    <div>Men's and women's game<span>Two worlds</span></div>
    <div>Six languages<span>Fully translated</span></div>
    <div>Plays offline<span>No account needed</span></div>
  </div>
</div></body></html>`
  }
  // focus: how far down the capture the frame should look (0 = top)
  const shift = f.focus && !SIZE.noFocus ? `transform: translateY(-${f.focus * 900 * u}px)` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="top">
<div class="eyebrow">${mark(40 * u)}<span>PHASE</span><span class="rule"></span><span style="color:${C.muted}">Rugby Manager</span></div>
<h1>${head(f.h)}</h1>
<p class="sub">${f.sub}</p>
</div>
<div class="screen"><img src="${img}" style="${shift}"><div class="fade"></div></div>
</body></html>`
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let made = 0
for (const size of SIZES) {
  SIZE = size
  if (process.env.ONLY_SIZE && process.env.ONLY_SIZE !== size.store) continue
  const dir = `${OUT}/${size.store}`
  mkdirSync(dir, { recursive: true })
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 })
  for (const f of FRAMES) {
    if (f.shot && !existsSync(rawOf(f))) { console.log(`skip ${f.id}: no capture ${f.shot}`); continue }
    const file = resolve(`${TMP}/${f.id}-${size.store}.html`)
    writeFileSync(file, frameHtml(f, size.w, size.h))
    await page.goto('file://' + file)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(200)
    const name = `${dir}/${f.id}-${f.h.replace(/\|/g, ' ').toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}.png`
    // Play and Apple both refuse alpha on screenshots: an opaque PNG
    await page.screenshot({ path: name, omitBackground: false })
    made++
  }
  await page.close()
  console.log(`${size.store}: ${size.w}x${size.h}`)
}
await browser.close()
console.log(`STORE FRAMES: ${made} written to ${OUT}`)
