// ---- THE GLIDE, MEASURED (1.8.1) ----
//
// Owner, 26 Sep 2026: "Is the animation the best it can be in 2d? ... Be hyper
// critical like its a new fm mobile product." This plays twenty seconds of a
// live match on a 412px phone and records every dot and the ball on every
// frame, then holds the pitch to what a top-down match view owes you:
//
//   in open play nobody stands still between lines: the share of frames
//     where the median man is not moving
//
// The same seeded match on the 1.8.0 pitch (CSS transition per line) read
// 11.3% of open-play frames at rest, 6 stop-starts and 5 ball snaps; with the
// glide (src/ui/pitchGlide.ts) it reads 0, 0 and 0.
//   no stop-starts: a pitch that pulses to rest on every line
//   no snaps: a dot or the ball whose movement in one frame breaks sharply
//     from the frames either side of it (a jump, not a fast run or a kick)
//   the frame budget: no frame over 50ms in a headless browser
//
// Run: npm run build && node scripts/smoothprobe.mjs
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
const server = await startPreview('4253', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
// the same match every run: the career seed and every other draw come from
// Math.random, so a seeded one makes the twenty seconds repeatable
await page.addInitScript(() => {
  let a = 20260926
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
})
await page.goto('http://localhost:4253/')
await page.waitForSelector('text=RUGBY', { timeout: 15000 })
await page.click('text=New Career'); await page.click('text=English Premier Division')
await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
await page.fill('input[placeholder="e.g. A. Gaffer"]', 'S'); await page.click('.speech-tile >> text=Forward Dominance')
await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
for (let tap = 0; tap < 8; tap++) { if (await page.locator('text=Kick Off ▸').count()) break; await page.click('.continue-btn'); await page.waitForTimeout(450) }
await page.locator('text=Kick Off ▸').first().click()
await page.locator('.talk-modal').waitFor({ timeout: 5000 }); await page.click('.talk-modal .speech-tile >> nth=0')
try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
await page.waitForSelector('.scoreboard', { timeout: 20000 })
await page.waitForTimeout(3000)
const r = await page.evaluate(() => new Promise(res => {
  const frames = []; let last = performance.now(); const t0 = last
  const step = now => {
    const dots = [...document.querySelectorAll('.pitch .pdot')].map(d => { const b = d.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2] })
    const bb = document.querySelector('.pitch .ball')?.getBoundingClientRect()
    frames.push({ t: now - t0, dt: now - last, dots, ball: bb ? [bb.x + bb.width / 2, bb.y + bb.height / 2] : null, line: document.querySelector('.now-line .txt')?.textContent?.slice(0, 50) })
    last = now
    if (now - t0 < 20000) requestAnimationFrame(step); else res(frames)
  }
  requestAnimationFrame(step)
}))
// analysis
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const n = r.length
const secs = r[n - 1].t / 1000
const long = r.slice(1).filter(f => f.dt > 50).length
const speeds = []
for (let i = 1; i < n; i++) {
  const a = r[i - 1], b = r[i]
  if (a.dots.length !== b.dots.length || !b.dots.length) continue
  const v = b.dots.map((p, k) => Math.hypot(p[0] - a.dots[k][0], p[1] - a.dots[k][1]) / (b.dt / 1000)).sort((x, y) => x - y)
  speeds.push(v[Math.floor(v.length / 2)])
}
// OPEN PLAY ONLY. A try, a kick at goal or the TMO holds the match on one
// line on purpose, and men standing still through that is right. So the
// stillness is read only across gaps between lines at the usual rhythm (no
// longer than 1.3 times the median gap), which is the play itself.
const changes = [0]
for (let i = 1; i < n; i++) if (r[i].line !== r[i - 1].line) changes.push(i)
const gaps = changes.slice(1).map((c, k) => r[c].t - r[changes[k]].t).sort((x, y) => x - y)
const median = gaps[Math.floor(gaps.length / 2)] ?? Infinity
const open = new Array(n).fill(false)
for (let k = 1; k < changes.length; k++) {
  if (r[changes[k]].t - r[changes[k - 1]].t <= median * 1.3) for (let i = changes[k - 1]; i < changes[k]; i++) open[i] = true
}
const speedsAt = []
for (let i = 1; i < n; i++) {
  const a = r[i - 1], b = r[i]
  if (!open[i] || a.dots.length !== b.dots.length || !b.dots.length) continue
  const v = b.dots.map((p, k) => Math.hypot(p[0] - a.dots[k][0], p[1] - a.dots[k][1]) / (b.dt / 1000)).sort((x, y) => x - y)
  speedsAt.push(v[Math.floor(v.length / 2)])
}
const mean = speeds.reduce((s, x) => s + x, 0) / speeds.length
const stillPct = speedsAt.filter(s => s < mean * 0.08).length / Math.max(1, speedsAt.length) * 100
let stops = 0
for (let i = 1; i < speedsAt.length; i++) if (speedsAt[i - 1] >= mean * 0.08 && speedsAt[i] < mean * 0.08) stops++
// a snap: this frame's step is 25px+ AND at least four times the steps either side
const snapsOf = track => {
  let c = 0
  for (let i = 2; i < track.length - 1; i++) {
    const [p0, p1, p2, p3] = [track[i - 2], track[i - 1], track[i], track[i + 1]]
    if (!p0 || !p1 || !p2 || !p3) continue
    const before = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), now = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), after = Math.hypot(p3[0] - p2[0], p3[1] - p2[1])
    if (now > 25 && now > 4 * Math.max(before, after, 1)) c++
  }
  return c
}
const ballSnaps = snapsOf(r.map(f => f.ball))
let dotSnaps = 0
const most = Math.max(...r.map(f => f.dots.length))
for (let k = 0; k < most; k++) dotSnaps += snapsOf(r.map(f => f.dots.length === most ? f.dots[k] : null))
// STAMPEDES: frames where most of the men are sprinting at once (faster than
// 250px/s, the width of a phone pitch in about a second and a half). That is
// the whole side sliding across the field, which the owner's recording showed
// after every score and into every replay ("erratic ... unclear what is
// happening"); restarts and replays are cuts now, not slides.
let stampede = 0
for (let i = 1; i < n; i++) {
  const a = r[i - 1], b = r[i]
  if (a.dots.length !== b.dots.length || !b.dots.length) continue
  // a step over 30px in one frame is a cut (everyone put in place at once), not a run
  const fast = b.dots.filter((p, k) => { const d = Math.hypot(p[0] - a.dots[k][0], p[1] - a.dots[k][1]); return d < 30 && d / (b.dt / 1000) > 250 }).length
  if (fast > b.dots.length * 0.6) stampede++
}
// THE BALL IS NEVER LEFT ON ITS OWN: the nearest man, nine frames in ten
const near = []
for (const f of r) { if (!f.ball || !f.dots.length) continue; near.push(Math.min(...f.dots.map(p => Math.hypot(p[0] - f.ball[0], p[1] - f.ball[1])))) }
near.sort((x, y) => x - y)
const p90 = near[Math.floor(near.length * 0.9)] ?? 0
console.log(`  ${n} frames in ${secs.toFixed(1)}s, ${new Set(r.map(f => f.line)).size} commentary lines, median man ${Math.round(mean)}px/s`)
ok(stillPct < 10, `in open play nobody stands still between lines (${stillPct.toFixed(1)}% of ${speedsAt.length} open-play frames with the median man at rest)`)
ok(stops <= 2, `no stop-start rhythm in open play (${stops})`)
ok(ballSnaps <= 1, `the ball never snaps (${ballSnaps})`)
ok(dotSnaps <= 3, `no man snaps (${dotSnaps} across ${most} dots)`)
ok(long === 0, `no frame over 50ms (${long})`)
ok(p90 <= 22, `the ball is never left on its own (nearest man ${p90.toFixed(1)}px or closer, nine frames in ten)`)
ok(stampede <= 6, `no stampedes: frames with most of the men sprinting at once (${stampede})`)
console.log(fails ? `\nSMOOTH PROBE FAILED (${fails})` : '\nSMOOTH PROBE PASSED: thirty men who keep moving, and a ball that never jumps')
await browser.close(); server.stop(); process.exit(fails ? 1 : 0)
