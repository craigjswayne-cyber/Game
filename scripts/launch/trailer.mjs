// Trailer: title cards, end cards and silent animatics of every cut, in every
// aspect ratio, built from real captures.
//
//   node scripts/launch/trailer.mjs [cut] [format]
//
// The animatic is the edit, not the release: it fixes the story, the order, the
// timing and the words, so the final trailer is a re-cut over licensed music
// with live device footage (docs/launch/assets/03-trailer/TRAILER.md) rather
// than a blank page. Every frame of it is the real game.
//
// Writes docs/launch/assets/03-trailer/working/animatic-<cut>-<format>.mp4,
// final/cards/*.png and final/captions/<cut>.srt.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { C, fontFace, mark, head } from './brand.mjs'

const A = 'docs/launch/assets/03-trailer'
const RAW = process.env.RAW || 'storeart/raw/en'
const RAW_BIG = process.env.RAW_BIG || 'storeart/raw/en-z1.15'
const TMP = 'storeart/trailer'
mkdirSync(TMP, { recursive: true })
for (const d of ['working', 'final/cards', 'final/captions']) mkdirSync(`${A}/${d}`, { recursive: true })

const FORMATS = {
  '16x9': { w: 1920, h: 1080 },
  '9x16': { w: 1080, h: 1920 },
  '1x1': { w: 1080, h: 1080 },
  '4x5': { w: 1080, h: 1350 },
}

// ---- the shots: every caption is a claim the screen beside it proves -------
const S = {
  open: { kind: 'title', text: 'The world|remembers|what you did.' },
  decision: { shot: 'press-question', cap: 'You make|a decision.' },
  bid: { shot: 'offers', cap: 'Every call|is yours.' },
  halftime: { shot: 'match-live', cap: 'The match|answers.' },
  verdict: { shot: 'match-fulltime', cap: 'You know|why.', focus: 0.47 },
  kept: { shot: 'word-kept', big: true, cap: 'He|remembers.' },
  agents: { shot: 'agents', big: true, cap: 'So does every|agent.' },
  rival: { shot: 'match-preview', cap: 'So does every|rival.' },
  legacy: { shot: 'legacy', cap: 'Seasons pass.|The record stays.' },
  tactics: { shot: 'tactics', cap: 'Set the plan.' },
  close: { kind: 'title', text: 'Your club.|Your decisions.|Your story.' },
  end: { kind: 'end' },
}

// ---- the cuts: each with its own rhythm, not the master trimmed ------------
const CUTS = {
  // durations include the 0.5s crossfade overlap, so each cut lands exactly
  // on its length: sum(d) - 0.5 x (shots - 1) = 60, 30, 15, 6
  '60': [['open', 4.5], ['decision', 5.5], ['bid', 5.5], ['halftime', 5], ['verdict', 6.5], ['kept', 6.5], ['agents', 5.5], ['rival', 5.5], ['legacy', 5.5], ['tactics', 4], ['close', 5], ['end', 6.5]],
  '30': [['open', 4], ['decision', 4.5], ['verdict', 5.5], ['kept', 5.5], ['agents', 4.5], ['close', 4], ['end', 5]],
  '15': [['open', 3], ['verdict', 4], ['kept', 4.5], ['end', 5]],
  '6': [['kept', 3], ['end', 3.5]],
}
const XF = 0.5 // crossfade seconds

const shotUrl = (s) => 'file://' + resolve(`${s.big ? RAW_BIG : RAW}/${s.shot}.png`)

function cardHtml(key, fmt, scale) {
  const s = S[key]
  const { w, h } = FORMATS[fmt]
  const W = w * scale, H = h * scale
  const land = fmt === '16x9'
  const u = (land ? h / 1080 : w / 1080) * scale
  const extra = s.shot ? 1.06 : 1 // room for the slow drift
  const base = `${fontFace}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H * extra}px; overflow: hidden; }
body { font-family: 'Space Grotesk', sans-serif; color: ${C.text}; -webkit-font-smoothing: antialiased; position: relative; background: ${C.canvas}; }
h1 { font-size: ${(land ? 108 : 104) * u}px; line-height: 1; font-weight: 700; letter-spacing: ${-2.5 * u}px; text-transform: uppercase; }
h1 .dot { color: ${C.primary}; }`
  if (s.kind === 'title') {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body { background: #000; } .c { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; }
</style></head><body><div class="c"><h1>${head(s.text)}</h1></div></body></html>`
  }
  if (s.kind === 'end') {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
.c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 ${80 * u}px; }
.w { margin-top: ${44 * u}px; font-size: ${92 * u}px; font-weight: 700; letter-spacing: ${8 * u}px; line-height: 1; }
.r { margin-top: ${18 * u}px; font-size: ${28 * u}px; font-weight: 700; letter-spacing: ${11 * u}px; color: ${C.text2}; }
.l { margin-top: ${60 * u}px; font-size: ${32 * u}px; color: ${C.text2}; max-width: ${900 * u}px; line-height: 1.4; }
.s { margin-top: ${56 * u}px; padding: ${18 * u}px ${34 * u}px; border: ${2 * u}px solid ${C.borderStrong}; border-radius: ${14 * u}px; font-size: ${28 * u}px; font-weight: 700; letter-spacing: ${2 * u}px; }
</style></head><body><div class="c">${mark(190 * u)}<div class="w">PHASE</div><div class="r">RUGBY MANAGER</div>
<div class="l">The rugby management game where the world remembers what you did.</div>
<div class="s">Free on Google Play</div></div></body></html>`
  }
  // screen card: caption and the real screen
  const shift = s.focus ? `transform:translateY(-${s.focus * 900 * 2.2 * u / (land ? 1.15 : 1)}px)` : ''
  const layout = land
    ? { cap: `left:${170 * u}px;top:0;bottom:0;width:${760 * u}px;display:flex;align-items:center`, scr: `right:${230 * u}px;top:${90 * u}px;width:${560 * u}px;height:${1400 * u}px` }
    : fmt === '9x16'
      ? { cap: `left:${90 * u}px;right:${90 * u}px;top:${250 * u}px`, scr: `left:${150 * u}px;right:${150 * u}px;top:${620 * u}px;height:${1700 * u}px` }
      : fmt === '1x1'
        ? { cap: `left:${80 * u}px;top:0;bottom:0;width:${470 * u}px;display:flex;align-items:center`, scr: `right:${70 * u}px;top:${80 * u}px;width:${440 * u}px;height:${1200 * u}px` }
        : { cap: `left:${90 * u}px;right:${90 * u}px;top:${110 * u}px`, scr: `left:${210 * u}px;right:${210 * u}px;top:${420 * u}px;height:${1500 * u}px` }
  const capSize = { '16x9': 96, '9x16': 92, '1x1': 64, '4x5': 80 }[fmt] * u
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body { background: radial-gradient(${W * 0.8}px ${H}px at ${land ? '70%' : '50%'} 70%, ${C.surface1}, ${C.canvas} 70%), ${C.canvas}; }
.cap { position: absolute; ${layout.cap} } .cap h1 { font-size: ${capSize}px; }
.scr { position: absolute; ${layout.scr}; border-radius: ${40 * u}px; overflow: hidden; border: ${3 * u}px solid ${C.borderStrong}; box-shadow: 0 ${30 * u}px ${90 * u}px rgba(0,0,0,.6); }
.scr img { width: 100%; display: block; }
</style></head><body><div class="cap"><h1>${head(s.cap)}</h1></div><div class="scr"><img src="${shotUrl(s)}" style="${shift}"></div></body></html>`
}

const want = { cut: process.argv[2], fmt: process.argv[3] }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

async function card(key, fmt, scale) {
  const out = `${TMP}/${key}-${fmt}@${scale}.png`
  if (existsSync(out)) return out
  const { w, h } = FORMATS[fmt]
  const extra = S[key].shot ? 1.06 : 1
  const page = await browser.newPage({ viewport: { width: w * scale, height: Math.round(h * scale * extra) }, deviceScaleFactor: 1 })
  const file = resolve(`${TMP}/${key}-${fmt}.html`)
  writeFileSync(file, cardHtml(key, fmt, scale))
  await page.goto('file://' + file)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
  await page.screenshot({ path: out })
  await page.close()
  return out
}

const srtTime = (t) => {
  const ms = Math.round(t * 1000), hh = Math.floor(ms / 3600000), mm = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
}

for (const [cut, seq] of Object.entries(CUTS)) {
  if (want.cut && want.cut !== cut) continue
  // captions: the on-screen words, for the accessible (sidecar) version
  let t = 0, n = 1, srt = ''
  for (const [key, d] of seq) {
    const s = S[key]
    const words = (s.cap ?? s.text ?? 'PHASE: Rugby Manager. Free on Google Play.').replace(/\|/g, ' ')
    srt += `${n++}\n${srtTime(t)} --> ${srtTime(t + d - XF)}\n${words}\n\n`
    t += d - XF
  }
  writeFileSync(`${A}/final/captions/phase-trailer-${cut}s.srt`, srt)

  for (const fmt of Object.keys(FORMATS)) {
    if (want.fmt && want.fmt !== fmt) continue
    const { w, h } = FORMATS[fmt]
    const inputs = [], filters = []
    for (let i = 0; i < seq.length; i++) {
      const [key, d] = seq[i]
      const png = await card(key, fmt, 2)
      inputs.push('-loop', '1', '-t', String(d), '-framerate', '30', '-i', png)
      const drift = S[key].shot ? h * 2 * 0.06 : 0
      // a slow upward drift on screen cards (rendered at 2x, so sub-pixel
      // steps vanish in the downscale); title cards hold still
      filters.push(`[${i}:v]crop=${w * 2}:${h * 2}:0:'${drift}*t/${d}',scale=${w}:${h}:flags=lanczos,setsar=1,format=yuv420p,fps=30[v${i}]`)
    }
    let prev = 'v0', off = 0
    for (let i = 1; i < seq.length; i++) {
      off += seq[i - 1][1] - XF
      filters.push(`[${prev}][v${i}]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(3)}[x${i}]`)
      prev = `x${i}`
    }
    const total = seq.reduce((a, [, d]) => a + d, 0) - XF * (seq.length - 1)
    filters.push(`[${prev}]fade=t=in:st=0:d=0.4,fade=t=out:st=${(total - 0.5).toFixed(2)}:d=0.5[out]`)
    const out = `${A}/working/animatic-${cut}s-${fmt}.mp4`
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs,
      '-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex', filters.join(';'), '-map', '[out]', '-map', `${seq.length}:a`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out])
    console.log(`${out}  ${total.toFixed(1)}s ${w}x${h}`)
  }
}

// title and end cards as stills, for the editor
for (const key of ['open', 'close', 'end']) {
  for (const fmt of Object.keys(FORMATS)) {
    const png = await card(key, fmt, 1)
    execFileSync('cp', [png, `${A}/final/cards/${key}-${fmt}-${FORMATS[fmt].w}x${FORMATS[fmt].h}.png`])
  }
}
await browser.close()
console.log('TRAILER: done')
