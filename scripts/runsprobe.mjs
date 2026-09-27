// ---- OFF THE BALL, MEASURED (1.8.0) ----
//
// Owner: "The biggest gap left against FM Mobile is that our players are
// arranged in a shape for each commentary line rather than moved by the match
// engine, so nobody makes their own runs off the ball." - "Also fix this".
// offBall.ts gives every man a run through the beat from the line's own facts;
// this plays twenty seconds of the same seeded match as smoothprobe and checks
// the pitch now looks like men playing rather than a shape being moved:
//
//   men keep running late in the beat, instead of easing to a spot and
//     waiting (speed in the last third of a beat against the first third)
//   the attacking forwards off the ruck are running at the ball
//   the defensive line is coming up at the ball
//   men move in different directions at once, not as one block
//
// Run: npm run build && node scripts/runsprobe.mjs
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
const server = await startPreview('4265', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
// the same match every run: the career seed and every other draw come from
// Math.random, so a seeded one makes the twenty seconds repeatable
await page.addInitScript(() => {
  let a = 20260926
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
})
await page.goto('http://localhost:4265/')
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
await page.waitForTimeout(2500)
const r = await page.evaluate(() => new Promise(res => {
  const frames = []; const t0 = performance.now()
  const step = now => {
    const b = document.querySelector('.pitch .ball')?.getBoundingClientRect()
    frames.push({
      t: now - t0,
      line: document.querySelector('.now-line .txt')?.textContent ?? '',
      ball: b ? [b.x + b.width / 2, b.y + b.height / 2] : null,
      dots: [...document.querySelectorAll('.pitch .pdot:not(.ghost)')].map(d => {
        const q = d.getBoundingClientRect()
        return { k: d.dataset.side + d.dataset.slot, poss: d.dataset.poss === '1', slot: +d.dataset.slot, run: !!d.dataset.run, x: q.x + q.width / 2, y: q.y + q.height / 2 }
      }),
    })
    if (now - t0 < 20000) requestAnimationFrame(step); else res(frames)
  }
  requestAnimationFrame(step)
}))
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
// beats: runs of frames on one commentary line, at the usual rhythm
const beats = []
let s0 = 0
for (let i = 1; i <= r.length; i++) if (i === r.length || r[i].line !== r[i - 1].line) { beats.push([s0, i - 1]); s0 = i }
const lens = beats.map(([a, b]) => r[b].t - r[a].t).sort((x, y) => x - y)
const med = lens[Math.floor(lens.length / 2)]
const open = beats.filter(([a, b]) => r[b].t - r[a].t <= med * 1.3 && b - a > 20)
const speed = (i, pick) => {
  const A = new Map(r[i - 1].dots.map(d => [d.k, d])), out = []
  for (const d of r[i].dots) { const p = A.get(d.k); if (p && pick(d)) out.push(Math.hypot(d.x - p.x, d.y - p.y) / ((r[i].t - r[i - 1].t) / 1000)) }
  return out.length ? out.reduce((s, v) => s + v, 0) / out.length : 0
}
let early = 0, lateS = 0, fwdClose = 0, fwdN = 0, defUp = 0, defN = 0, dirs = 0, dirN = 0
for (const [a, b] of open) {
  const n = b - a, e1 = a + Math.floor(n / 3), l0 = b - Math.floor(n / 3)
  for (let i = a + 1; i <= e1; i++) early += speed(i, d => d.run)
  for (let i = l0; i <= b; i++) lateS += speed(i, d => d.run)
  // HEADED FOR THE BALL: in the second half of the beat, is the man moving
  // towards where the ball is? (Distance at the start against the end would
  // punish a man chasing a ball that moved further than he did.)
  const h = a + Math.floor(n / 2)
  if (!r[b].ball) continue
  const at = (f, k) => r[f].dots.find(d => d.k === k)
  for (const d of r[h].dots) {
    const e = at(b, d.k); if (!e || !d.run) continue
    const vx = e.x - d.x, vy = e.y - d.y
    if (Math.hypot(vx, vy) < 1) continue
    const bx = r[b].ball[0] - d.x, by = r[b].ball[1] - d.y
    const toward = vx * bx + vy * by > 0
    if (d.poss && d.slot < 8) { fwdN++; if (toward) fwdClose++ }
    if (!d.poss && d.slot < 10) { defN++; if (Math.sign(vx) === Math.sign(bx)) defUp++ }
  }
  // headings of the moving men, in eight directions, mid-beat
  const m = a + Math.floor(n / 2), P = new Map(r[m - 1].dots.map(d => [d.k, d])), bins = new Set()
  for (const d of r[m].dots) { const p = P.get(d.k); if (!p) continue; const dx = d.x - p.x, dy = d.y - p.y; if (Math.hypot(dx, dy) < 0.3) continue; bins.add(Math.round(Math.atan2(dy, dx) / (Math.PI / 4))) }
  dirs += bins.size; dirN++
}
const ratio = lateS / Math.max(1e-6, early)
// how fast the men off the ball move in open play, all of it, in px/s
let all = 0, allN = 0
for (const [a, b] of open) for (let i = a + 1; i <= b; i++) { all += speed(i, () => true); allN++ }
const offBall = all / Math.max(1, allN)
console.log(`  men off the ball move at ${offBall.toFixed(1)} px/s on average in open play`)
console.log(`  ${open.length} open-play beats`)
ok(open.length >= 3, 'enough open play to measure')
ok(offBall >= 12, `the men off the ball are running, not standing (${offBall.toFixed(1)} px/s)`)
ok(ratio > 0.45, `men keep running late in the beat (late/early speed ${ratio.toFixed(2)})`)
ok(fwdN > 0 && fwdClose / fwdN >= 0.6, `the attacking forwards are running at the ball (${fwdClose}/${fwdN})`)
ok(defN > 0 && defUp / defN >= 0.6, `the defensive line is coming up at the ball (${defUp}/${defN})`)
ok(dirN > 0 && dirs / dirN >= 3, `men move in different directions at once (${(dirs / Math.max(1, dirN)).toFixed(1)} headings of 8)`)
console.log(fails ? `\nRUNS PROBE FAILED (${fails})` : '\nRUNS PROBE PASSED: men make their own runs, and the defence comes up to meet them')
await browser.close(); server.kill?.(); process.exit(fails ? 1 : 0)
