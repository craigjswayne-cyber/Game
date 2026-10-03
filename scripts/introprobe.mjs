// ---- THE OPENING TITLES (1.8.0) ----
//
// Owner, 26 Sep 2026: "a 5 second motion intro to the loading in of the game
// ... with the logo of the game before the menu page launches". The harnesses
// never see it (automated browsers skip it, see src/ui/Intro.tsx), so this one
// asks for it with ?intro=1 and checks the promises:
//
//   it is there at once and the title screen is underneath it
//   the lockup is on screen by the middle of it, badge, PHASE and RUGBY MANAGER
//   it is gone by five and a half seconds, and the menu takes taps
//   a tap skips it
//   where the browser holds sound back, a speaker button starts it without
//   skipping (the office: the lamp, the whoosh, the title landing)
//   and nothing it plays is the telly's crowd: no looped noise bed, no buffer
//   longer than the one-second whoosh (owner: the crowd sounded like static,
//   so it came out entirely)
//   without ?intro=1 an automated browser never sees it
//
// Frames go to shots/intro-*.png at 412 and 820 wide for a look.
// Run: npm run build && node scripts/introprobe.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4247', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
mkdirSync('shots', { recursive: true })

try {
  for (const [w, h] of [[412, 915], [820, 1180]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const t0 = Date.now()
    await page.goto('http://localhost:4247/?intro=1')
    await page.waitForSelector('.intro', { timeout: 8000 })
    ok(true, `${w}px: the titles are up`)
    ok(await page.$('.title-screen') != null, `${w}px: and the title screen is underneath them`)
    for (const at of [600, 1500, 2600, 3600, 4400]) {
      const wait = at - (Date.now() - t0)
      if (wait > 0) await page.waitForTimeout(wait)
      await page.screenshot({ path: `shots/intro-${w}-${at}.png` })
    }
    const lock = await page.evaluate(() => {
      const vis = s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return +getComputedStyle(e).opacity > 0.5 && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight }
      return { badge: vis('.intro-badge'), word: vis('.intro-word'), sub: vis('.intro-sub') }
    })
    ok(lock.badge && lock.word && lock.sub, `${w}px: badge, PHASE and RUGBY MANAGER all on screen by 4.4s (${JSON.stringify(lock)})`)
    await page.waitForTimeout(Math.max(0, 5600 - (Date.now() - t0)))
    ok(await page.$('.intro') == null, `${w}px: gone by 5.6s`)
    await page.click('text=New Career', { timeout: 3000 }).then(() => ok(true, `${w}px: and the menu takes a tap`), () => ok(false, `${w}px: and the menu takes a tap`))
    await page.close()
  }

  const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
  await page.goto('http://localhost:4247/?intro=1')
  await page.waitForSelector('.intro')
  await page.waitForTimeout(800)
  await page.click('.intro')
  await page.waitForTimeout(600)
  ok(await page.$('.intro') == null, 'a tap skips it')

  // the speaker: a headless browser holds sound until a tap, so it is offered;
  // pressing it starts the sound and does NOT skip the titles. Every source
  // started is logged, so the crowd's absence is checked, not assumed.
  await page.addInitScript(() => {
    const log = window.__rmSources = []
    const bs = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...a) { log.push({ kind: 'buffer', loop: this.loop, secs: this.buffer?.duration ?? 0 }); return bs.apply(this, a) }
    const os = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (...a) { log.push({ kind: 'osc' }); return os.apply(this, a) }
  })
  await page.goto('http://localhost:4247/?intro=1')
  await page.waitForSelector('.intro')
  const spk = await page.waitForSelector('.intro-sound', { timeout: 2000 }).catch(() => null)
  ok(!!spk, 'with sound held back, the speaker button is offered')
  if (spk) {
    await spk.click()
    await page.waitForTimeout(300)
    ok(await page.$('.intro') != null && await page.$('.intro-sound') == null, 'the speaker starts the sound and the titles carry on')
    await page.waitForTimeout(2600)
    const src = await page.evaluate(() => window.__rmSources)
    const bufs = src.filter(x => x.kind === 'buffer')
    ok(src.some(x => x.kind === 'osc'), `the title sound still plays (${src.length} sources started)`)
    ok(!bufs.some(x => x.loop), 'no looped noise bed: the telly crowd is gone')
    ok(bufs.every(x => x.secs <= 1.01), `no noise longer than the whoosh (${Math.max(0, ...bufs.map(x => x.secs)).toFixed(2)}s at most)`)
  }
  await page.waitForTimeout(2900)
  await page.goto('http://localhost:4247/')
  await page.waitForSelector('.title-screen')
  await page.waitForTimeout(300)
  ok(await page.$('.intro') == null, 'an automated browser without ?intro=1 never sees it')
  await page.close()
} catch (e) {
  console.error(`FAIL  stopped early: ${e.message.split('\n')[0]}`)
  fails++
}
await browser.close()
server.stop()
console.log(fails ? `\nINTRO PROBE FAILED (${fails})` : '\nINTRO PROBE PASSED: five seconds of titles, then the game, and a tap is always quicker')
process.exit(fails ? 1 : 0)
