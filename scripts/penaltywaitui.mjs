// Probe: the penalty call on the match screen (1.9.13, player feedback:
// "improve timing for penalties so no play happens till I decide the
// penalty"). A real career, a real match on screen, played forward to every
// kickable penalty the manager is asked about: when the call panel shows, the
// newest line in the feed is the captain looking to the touchline, nothing
// after it, and the ticker does not move again until the call is made.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { ok, done } from './lib/probe.mjs'

const server = await startPreview(0, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 746 } })
const errors = []
await page.addInitScript(() => {
  let a = 0x2545f491
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
})
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate(() => window.rugbyStore.getState().start('leicester', 'Penalty Wait'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  for (let tap = 0; tap < 12; tap++) {
    if (await page.locator('text="Kick Off"').count()) break
    await page.click('.continue-btn', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(450)
  }
  await page.locator('text="Kick Off"').first().click({ timeout: 20000 })
  await page.locator('.talk-modal').waitFor({ timeout: 6000 })
  await page.click('.talk-modal .speech-tile >> nth=0')
  await page.locator('text="Take the Field"').click({ timeout: 2500 }).catch(() => {})
  await page.waitForSelector('.scoreboard', { timeout: 20000 })

  const S = () => page.evaluate(() => { const lm = window.rugbyStore.getState().liveMatch; return lm && { dec: !!lm.ctx.decision, cursor: lm.cursor, n: lm.ctx.events.length, seg: lm.ctx.seg, awaiting: lm.ctx.awaiting, playing: lm.playing } })
  let calls = 0, newestAsk = 0, panel = 0, held = 0
  for (let i = 0; i < 900 && calls < 3; i++) {
    const s = await S()
    if (!s || (s.seg === 3 && s.cursor >= s.n)) break
    if (s.dec && s.cursor >= s.n) {
      calls++
      await page.waitForTimeout(250)
      // the line the manager last read: the store's, and the phone feed's
      // now-line when the feed is on screen behind the call
      const last = await page.evaluate(() => { const lm = window.rugbyStore.getState().liveMatch; return lm.ctx.events[lm.cursor - 1]?.k ?? '' })
      const now = (await page.locator('.comm-line.now-line .txt').first().textContent({ timeout: 500 }).catch(() => null))
      if (last === 'comm.penKickableAsk' && (now == null || /touchline/i.test(now))) newestAsk++
      else console.log(`    last line at the call: ${last} / ${String(now).slice(0, 100)}`)
      if (await page.locator('.card button.btn.ghost').count() >= 2) panel++
      // the ticker does not move while the call is open
      const before = (await S()).cursor
      await page.evaluate(() => window.rugbyStore.getState().advanceLive())
      await page.waitForTimeout(600)
      if ((await S()).cursor === before) held++
      await page.evaluate(() => window.rugbyStore.getState().decide('posts'))
      continue
    }
    if (s.dec) { await page.evaluate(() => window.rugbyStore.getState().advanceLive()); continue }
    if (s.awaiting) { await page.evaluate(() => window.rugbyStore.getState().startSecondHalf()); continue }
    await page.evaluate(() => { const st = window.rugbyStore.getState(); if (!st.liveMatch.playing) st.matchCursor(st.liveMatch.cursor, true); st.advanceLive() })
  }
  console.log(`  ${calls} penalty calls on screen`)
  ok(calls > 0, `the match asks for the call on screen (${calls})`)
  ok(newestAsk === calls, `the newest line at every call is the captain looking to the touchline (${newestAsk}/${calls})`)
  ok(panel === calls, `the call's buttons are showing each time (${panel}/${calls})`)
  ok(held === calls, `and the ticker does not move until the call is made (${held}/${calls})`)
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close()
  server.stop()
}
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
done('PENALTY WAIT UI PROBE', 'the call comes up straight after the captain looks to the touchline, and play waits for it')
