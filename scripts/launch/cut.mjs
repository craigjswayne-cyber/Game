// The PHASE launch trailer, final cuts.
//
// Real footage (scripts/launch/motion.mjs), the original score and the game's
// own sound effects (scripts/launch/score.py), composed to the edit in
// docs/launch/assets/03-trailer/TRAILER.md. Four cuts, four ratios, each cut
// with its own rhythm and its own arrangement of the music.
//
//   node scripts/launch/motion.mjs     (footage, once)
//   node scripts/launch/cut.mjs [cut] [ratio]
//
// Writes docs/launch/assets/03-trailer/final/phase-trailer-<cut>s-<ratio>.mp4
// and the matching captions.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { C, fontFace, mark, head } from './brand.mjs'

const A = 'docs/launch/assets/03-trailer'
const MOTION = 'storeart/motion'
const TMP = 'storeart/cut'
const AUDIO = 'storeart/audio'
for (const d of [TMP, AUDIO, `${A}/final/captions`]) mkdirSync(d, { recursive: true })
const META = JSON.parse(readFileSync(`${MOTION}/beats.json`, 'utf8'))
const XF = 0.5

const FORMATS = {
  '16x9': { w: 1920, h: 1080 },
  '9x16': { w: 1080, h: 1920 },
  '1x1': { w: 1080, h: 1080 },
  '4x5': { w: 1080, h: 1350 },
}

// ---- the beats: every caption is proved by the footage beside it -----------
// energy drives the score (score.py); sfx names the sound design
const S = {
  open: { title: 'The world|remembers|what you did.', energy: 0, sfx: ['thud'] },
  decision: { clip: 'decision', cap: 'You make|a decision.', energy: 1 },
  bid: { clip: 'bid', cap: 'Every call|is yours.', energy: 1 },
  match: { clip: 'match', in: 25.4, cap: 'The match|answers.', energy: 2, sfx: ['crowd'] },
  verdict: { clip: 'fulltime', cap: 'You know|why.', energy: 2, sfx: ['whistle3'], whistleAt: 0.15 },
  kept: { clip: 'kept', cap: 'He|remembers.', energy: 3, sfx: ['page'] },
  agents: { clip: 'agents', still: true, cap: 'So does every|agent.', energy: 3, sfx: ['page'] },
  rival: { clip: 'rival', cap: 'So does every|rival.', energy: 3 },
  legacy: { clip: 'legacy', cap: 'Seasons pass.|The record stays.', energy: 4 },
  tactics: { clip: 'tactics', cap: 'Set the plan.', energy: 4 },
  close: { title: 'Your club.|Your decisions.|Your story.', energy: 'drop', sfx: ['thud'] },
  end: { end: true, energy: 'end', sfx: ['thud'] },
}

// [beat, seconds on screen including the 0.5 s crossfade, in-point]
// sum(d) - 0.5 x (beats - 1) = the cut's length, exactly
const CUTS = {
  '60': [['open', 4.5], ['decision', 5.5, 0], ['bid', 5.5, 0], ['match', 5.5], ['verdict', 7, 0], ['kept', 6, 0.2],
    ['agents', 5.5], ['rival', 5, 0.4], ['legacy', 6, 0.4], ['tactics', 4, 0.2], ['close', 5], ['end', 6]],
  '30': [['open', 4], ['decision', 4.5, 0.7], ['verdict', 6, 0.4], ['kept', 5.5, 0.4], ['agents', 4.5], ['close', 4], ['end', 4.5]],
  '15': [['open', 3], ['verdict', 4.5, 2.4], ['kept', 4, 0.9], ['end', 5]],
  '6': [['kept', 3, 1.0], ['end', 3.5]],
}

const want = { cut: process.argv[2], fmt: process.argv[3] }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const ff = (args) => {
  try { execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'] }) }
  catch (e) { throw new Error(`ffmpeg: ${String(e.stderr).slice(0, 800)}`) }
}

// ---- stills: title, end, and the plate a clip plays inside ------------------
async function render(file, w, h, html) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const src = resolve(`${TMP}/${file}.html`)
  writeFileSync(src, html)
  await page.goto('file://' + src)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(120)
  const rect = await page.evaluate(() => {
    const el = document.querySelector('.scr'); if (!el) return null
    const r = el.getBoundingClientRect(); const b = parseFloat(getComputedStyle(el).borderTopWidth)
    return { x: r.x + b, y: r.y + b, w: r.width - 2 * b, h: r.height - 2 * b, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) - b }
  })
  await page.screenshot({ path: `${TMP}/${file}.png` })
  await page.close()
  return rect
}

function base(w, h, u) {
  return `${fontFace}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
body { font-family: 'Space Grotesk', sans-serif; color: ${C.text}; -webkit-font-smoothing: antialiased; position: relative; background: ${C.canvas}; }
h1 { line-height: 1; font-weight: 700; letter-spacing: ${-2.5 * u}px; text-transform: uppercase; }
h1 .dot { color: ${C.primary}; }`
}

async function plate(key, fmt) {
  const s = S[key]
  const { w, h } = FORMATS[fmt]
  const land = fmt === '16x9'
  const u = land ? h / 1080 : w / 1080
  const id = `${key}-${fmt}`
  if (s.title) {
    await render(id, w, h, `<!doctype html><html><head><meta charset="utf-8"><style>${base(w, h, u)}
body { background: #000; } .c { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 ${70 * u}px }
h1 { font-size: ${(land ? 108 : fmt === '1x1' ? 92 : 104) * u}px; }</style></head><body><div class="c"><h1>${head(s.title)}</h1></div></body></html>`)
    return { png: `${TMP}/${id}.png` }
  }
  if (s.end) {
    await render(id, w, h, `<!doctype html><html><head><meta charset="utf-8"><style>${base(w, h, u)}
.c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 ${80 * u}px; }
.w { margin-top: ${44 * u}px; font-size: ${92 * u}px; font-weight: 700; letter-spacing: ${8 * u}px; line-height: 1; }
.r { margin-top: ${18 * u}px; font-size: ${28 * u}px; font-weight: 700; letter-spacing: ${11 * u}px; color: ${C.text2}; }
.l { margin-top: ${56 * u}px; font-size: ${32 * u}px; color: ${C.text2}; max-width: ${900 * u}px; line-height: 1.4; }
.s { margin-top: ${52 * u}px; padding: ${18 * u}px ${34 * u}px; border: ${2 * u}px solid ${C.borderStrong}; border-radius: ${14 * u}px; font-size: ${28 * u}px; font-weight: 700; letter-spacing: ${2 * u}px; }
</style></head><body><div class="c">${mark(190 * u)}<div class="w">PHASE</div><div class="r">RUGBY MANAGER</div>
<div class="l">The rugby management game where the world remembers what you did.</div><div class="s">Free on Google Play</div></div></body></html>`)
    return { png: `${TMP}/${id}.png` }
  }
  // a screen beat: caption, and a frame whose inside is exactly the phone's shape
  const AR = 1736 / 800
  const L = land
    ? { cap: `left:${170 * u}px;top:0;bottom:0;width:${760 * u}px;display:flex;align-items:center`, x: `right:${230 * u}px`, top: 90 * u, width: 560 * u }
    : fmt === '9x16'
      ? { cap: `left:${90 * u}px;right:${90 * u}px;top:${250 * u}px`, x: `left:${150 * u}px`, top: 620 * u, width: 780 * u }
      : fmt === '1x1'
        ? { cap: `left:${80 * u}px;top:0;bottom:0;width:${470 * u}px;display:flex;align-items:center`, x: `right:${80 * u}px`, top: 70 * u, width: 440 * u }
        : { cap: `left:${90 * u}px;right:${90 * u}px;top:${110 * u}px`, x: `left:${210 * u}px`, top: 420 * u, width: 660 * u }
  const bw = 3 * u
  const capSize = { '16x9': 96, '9x16': 92, '1x1': 64, '4x5': 80 }[fmt] * u
  const rect = await render(id, w, h, `<!doctype html><html><head><meta charset="utf-8"><style>${base(w, h, u)}
body { background: radial-gradient(${w * 0.8}px ${h}px at ${land ? '70%' : '50%'} 70%, ${C.surface1}, ${C.canvas} 70%), ${C.canvas}; }
.cap { position: absolute; ${L.cap} } .cap h1 { font-size: ${capSize}px; }
.scr { position: absolute; ${L.x}; top: ${L.top}px; width: ${L.width}px; height: ${(L.width - 2 * bw) * AR + 2 * bw}px;
  border-radius: ${40 * u}px; border: ${bw}px solid ${C.borderStrong}; background: ${C.canvas}; box-shadow: 0 ${30 * u}px ${90 * u}px rgba(0,0,0,.6); }
</style></head><body><div class="cap"><h1>${head(s.cap)}</h1></div><div class="scr"></div></body></html>`)
  // the mask: the frame's inside, rounded, cut off where the picture ends
  const ev = (n) => Math.round(n / 2) * 2
  const r = { x: Math.round(rect.x), y: Math.round(rect.y), w: ev(rect.w), radius: rect.radius }
  r.h = ev(Math.min(rect.h, h - r.y))
  r.full = ev(rect.w * AR)
  r.h = Math.min(r.h, r.full)
  await render(`${id}-mask`, r.w, r.h, `<!doctype html><html><head><style>html,body{margin:0;background:#000;width:${r.w}px;height:${r.h}px;overflow:hidden}
div{width:${r.w}px;height:${rect.h}px;background:#fff;border-radius:${r.radius}px}</style></head><body><div></div></body></html>`)
  return { png: `${TMP}/${id}.png`, mask: `${TMP}/${id}-mask.png`, r }
}

/** One beat as a finished segment at its exact length. */
async function segment(key, fmt, d, inPoint) {
  const s = S[key]
  const out = `${TMP}/seg-${key}-${fmt}-${d}-${inPoint ?? 'x'}.mp4`
  if (existsSync(out)) return out
  const p = await plate(key, fmt)
  if (!s.clip) {
    ff(['-loop', '1', '-framerate', '30', '-t', String(d), '-i', p.png, '-vf', 'format=yuv420p', '-r', '30',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', out])
    return out
  }
  const { r } = p
  const src = `${MOTION}/${s.clip}.mp4`
  const len = META[s.clip].length
  const at = inPoint ?? s.in ?? 0
  let screen
  if (s.still) {
    // a screen that holds still drifts up a touch, rendered at 2x so the
    // movement is sub-pixel smooth when it comes back down
    const drift = Math.round(r.w * 2 * 0.05)
    screen = `[1:v]trim=start=${at}:duration=${d},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${d},scale=${r.w * 2}:${r.full * 2}:flags=lanczos,` +
      `crop=${r.w * 2}:${r.h * 2}:0:'${drift}*t/${d}',scale=${r.w}:${r.h}:flags=lanczos`
  } else {
    const pad = Math.max(0, at + d - len + 0.1)
    screen = `[1:v]trim=start=${at}:duration=${d},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${pad.toFixed(2)},` +
      `scale=${r.w}:${r.full}:flags=lanczos,crop=${r.w}:${r.h}:0:0`
  }
  ff(['-loop', '1', '-framerate', '30', '-t', String(d), '-i', p.png, '-i', src, '-loop', '1', '-framerate', '30', '-t', String(d), '-i', p.mask,
    '-filter_complex', `${screen},format=rgba[s];[2:v]format=gray,scale=${r.w}:${r.h}[m];[s][m]alphamerge[sm];[0:v][sm]overlay=${r.x}:${r.y}:shortest=1,fps=30,format=yuv420p[v]`,
    '-map', '[v]', '-t', String(d), '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', out])
  return out
}

const srtTime = (t) => {
  const ms = Math.round(t * 1000)
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
}

for (const [cut, seq] of Object.entries(CUTS)) {
  if (want.cut && want.cut !== cut) continue
  const total = seq.reduce((a, [, d]) => a + d, 0) - XF * (seq.length - 1)

  // ---- the plan the score is written to, and the captions ------------------
  let t = 0, srt = '', n = 1
  const beats = seq.map(([key, d, inPoint]) => {
    const s = S[key]
    const at = inPoint ?? s.in ?? 0
    const taps = (s.clip ? META[s.clip].taps : []).map(x => x - at).filter(x => x >= 0 && x < d).map(x => +(t + x).toFixed(3))
    const words = (s.cap ?? s.title ?? 'PHASE: Rugby Manager. Free on Google Play.').replace(/\|/g, ' ')
    srt += `${n++}\n${srtTime(t)} --> ${srtTime(t + d - XF)}\n${words}\n\n`
    const b = { key, start: +t.toFixed(3), dur: d, energy: s.energy, sfx: s.sfx ?? [], taps, whistleAt: s.whistleAt ?? 0.3 }
    t += d - XF
    return b
  })
  const plan = `${AUDIO}/plan-${cut}.json`
  writeFileSync(plan, JSON.stringify({ cut, total, beats }, null, 1))
  writeFileSync(`${A}/final/captions/phase-trailer-${cut}s.srt`, srt)
  execFileSync('python3', ['scripts/launch/score.py', plan], { stdio: 'inherit' })
  // music and sound design, mixed and set to -14 LUFS, -1.5 dBTP
  const mix = `${AUDIO}/mix-${cut}.wav`
  ff(['-i', `${AUDIO}/plan-${cut}-music.wav`, '-i', `${AUDIO}/plan-${cut}-sfx.wav`, '-filter_complex',
    `[0:a]volume=1.0[m];[1:a]volume=0.9[s];[m][s]amix=inputs=2:normalize=0,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]`,
    '-map', '[a]', '-c:a', 'pcm_s16le', mix])

  for (const fmt of Object.keys(FORMATS)) {
    if (want.fmt && want.fmt !== fmt) continue
    const { w, h } = FORMATS[fmt]
    const segs = []
    for (const [key, d, inPoint] of seq) segs.push(await segment(key, fmt, d, inPoint))
    const inputs = segs.flatMap(f => ['-i', f])
    const filters = []
    let prev = '0:v', off = 0
    for (let i = 1; i < seq.length; i++) {
      off += seq[i - 1][1] - XF
      filters.push(`[${prev}][${i}:v]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(3)}[x${i}]`)
      prev = `x${i}`
    }
    filters.push(`[${prev}]fade=t=in:st=0:d=0.4,fade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6,format=yuv420p[v]`)
    const out = `${A}/final/phase-trailer-${cut}s-${fmt}.mp4`
    const rate = fmt === '16x9' ? ['-b:v', '16M', '-maxrate', '20M', '-bufsize', '32M'] : ['-b:v', '12M', '-maxrate', '16M', '-bufsize', '24M']
    ff([...inputs, '-i', mix, '-filter_complex', filters.join(';'), '-map', '[v]', '-map', `${segs.length}:a`,
      '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30', ...rate,
      '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', '-t', total.toFixed(3), out])
    console.log(`${out}  ${total.toFixed(1)} s  ${w}x${h}`)
  }
}
await browser.close()
console.log('CUT: done')
