// Browser performance, two builds side by side, interleaved (release QA).
//
//   node scripts/qa/browserperf.mjs <dirA> <dirB> [rounds=3] [cpuThrottle=4]
//
// Each dir is a checkout with a fresh `vite build` in dist/; both are served
// with `vite preview` at once and measured in turn - A, B, A, B ... - so the
// machine's drift lands on both. Per run, under CDP CPU throttling (a phone is
// slower than this box):
//
//   launch   navigation to the title screen painted (cold: fresh context)
//   career   Start Career tapped to Home on screen
//   match    the live match: requestAnimationFrame deltas over 8 s of full
//            mode - mean, p95, share of frames over 33 ms - and long tasks
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const [dirA, dirB] = process.argv.slice(2, 4)
const ROUNDS = Number(process.argv[4] ?? 3)
const THROTTLE = Number(process.argv[5] ?? 4)
if (!dirA || !dirB) { console.error('usage: browserperf.mjs <dirA> <dirB> [rounds] [throttle]'); process.exit(2) }

function serve(dir, port) {
  const p = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: dir, stdio: 'ignore', detached: true })
  p.unref()
  return { stop: () => { try { process.kill(-p.pid, 'SIGTERM') } catch { /* gone */ } } }
}
const servers = [serve(dirA, 4241), serve(dirB, 4242)]
await new Promise(r => setTimeout(r, 4000))
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

async function run(port) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, locale: 'en-GB' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(60000)
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  const out = {}
  let t = Date.now()
  await page.goto(`http://localhost:${port}/`)
  await page.waitForSelector('text=New Career')
  out.launch = Date.now() - t
  out.fcp = await page.evaluate(() => Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1))
  // LAUNCH_ONLY=1: many cheap samples of the one number that varies most
  if (process.env.LAUNCH_ONLY) { await ctx.close(); out.match = {}; out.career = NaN; return out }
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.click('.tile >> text=Leicester')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Perf')
  await page.click('.action-bar >> text=Confirm')
  t = Date.now()
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box')
  out.career = Date.now() - t
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')
  // walk to the first match (reloadprobe's walk)
  for (let tap = 0; tap < 14; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn').catch(() => {})
    await page.waitForTimeout(600)
  }
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 8000 }).catch(() => {})
  await page.click('.talk-modal .speech-tile >> nth=1').catch(() => {})
  await page.locator('text=▸ Take the Field').click({ timeout: 4000 }).catch(() => {})
  await page.waitForSelector('.scoreboard')
  await page.waitForTimeout(1500)
  out.match = await page.evaluate(() => new Promise(res => {
    const deltas = []; let long = 0, longN = 0
    const po = new PerformanceObserver(l => { for (const e of l.getEntries()) { long += e.duration; longN++ } })
    try { po.observe({ entryTypes: ['longtask'] }) } catch { /* unsupported */ }
    let last = performance.now()
    const t0 = last
    const tick = (now) => {
      deltas.push(now - last); last = now
      if (now - t0 < 8000) requestAnimationFrame(tick)
      else {
        po.disconnect()
        deltas.sort((a, b) => a - b)
        const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
        res({ frames: deltas.length, mean: +mean.toFixed(1), p95: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1),
          over33: +(100 * deltas.filter(d => d > 33.4).length / deltas.length).toFixed(1), longMs: Math.round(long), longN })
      }
    }
    requestAnimationFrame(tick)
  }))
  await ctx.close()
  return out
}

const res = { A: [], B: [] }
try {
  for (let r = 0; r < ROUNDS; r++) {
    for (const [k, port] of r % 2 ? [['B', 4242], ['A', 4241]] : [['A', 4241], ['B', 4242]]) {
      try {
        const o = await run(port)
        res[k].push(o)
        console.log(`round ${r} ${k}: ${JSON.stringify(o)}`)
      } catch (e) { console.log(`round ${r} ${k}: threw ${String(e).split('\n')[0]}`) }
    }
  }
} finally {
  await browser.close()
  for (const s of servers) s.stop()
}
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN }
for (const k of ['A', 'B']) {
  const rs = res[k]
  console.log(`MEDIAN ${k} (${k === 'A' ? dirA : dirB}): launch ${med(rs.map(x => x.launch))} ms, fcp ${med(rs.map(x => x.fcp))} ms, career ${med(rs.map(x => x.career))} ms, ` +
    `frame mean ${med(rs.map(x => x.match.mean))} ms p95 ${med(rs.map(x => x.match.p95))} ms >33ms ${med(rs.map(x => x.match.over33))}% long ${med(rs.map(x => x.match.longMs))} ms/${med(rs.map(x => x.match.longN))}`)
}
process.exit(0)
