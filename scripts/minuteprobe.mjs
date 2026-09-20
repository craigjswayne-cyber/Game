// Probe: the live match clock runs MINUTE BY MINUTE.
//
// Owner, v1.7.0: "it says minute by minute at the minute in game but it skips
// huge chunks."
//
// He was right, and the settings sheet had been saying the opposite for six
// versions: the ticker's two modes are "Every minute" and "Highlights", and
// Every Minute was a four-minute jump cut, because that is the granularity the
// engine simulates at (matchEngine.ts, stepTick). The fix is a minute clock on
// the match screen that fills the gaps with passages of play (MatchDay.tsx,
// matchphase.ts), and the fix is invisible to every other harness here - no
// score changes, no event changes, no state changes - so this is the only
// thing that can catch it regressing.
//
// WHAT IT MEASURES, off the real DOM of a real match rather than off the
// engine: the sequence of minutes the scoreboard actually shows. Three claims,
// each one a way the clock could quietly go back to what it was:
//
//   1. It never skips. The biggest step between two consecutive readings is
//      one minute. A four-minute jump is the bug this whole feature exists to
//      fix, and it is the one that would come back first.
//   2. It gets through most of the half. A clock that ran minute by minute
//      but stalled would pass (1) and be worse than what it replaced.
//   3. It never goes backwards. The clock is derived from two sources - the
//      passage counter and the last revealed event - and taking the max of
//      them is the only thing stopping a late-arriving line from rewinding it.
//
// It samples the FIRST HALF only. Forty minutes at Normal is about thirty
// seconds of wall clock, it exercises kick-off, passages, headlines and the
// run into half time, and a full match would double the probe's runtime to
// test the same three things twice.
//
// Run: node scripts/minuteprobe.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4241', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
page.setDefaultTimeout(20000)
await page.addInitScript(() => { localStorage.setItem('rm-night', '1') })

const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

try {
  await page.goto('http://localhost:4241/')
  await page.waitForSelector('text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Test Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box')
  await page.click('.tut-close .btn')

  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off').count()) break
    for (const label of ['On to the Week', 'Next Story ▸', 'Get On With The Week']) {
      const b = page.locator(`text=${label}`)
      if (await b.count()) { await b.first().click(); await page.waitForTimeout(200) }
    }
    const rej = page.locator('.btn.danger >> text=Reject')
    if (await rej.count()) { await rej.first().click(); await page.waitForTimeout(200); continue }
    const cont = page.locator('.continue-btn')
    if (!(await cont.count())) break
    await cont.click()
    await page.waitForTimeout(450)
  }
  await page.waitForSelector('text=Kick Off')
  await page.locator('text=Kick Off ▸').first().click()
  try {
    await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    await page.click('.talk-modal .speech-tile >> text=Calm the nerves')
  } catch { /* no dressing room */ }
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* straight down the tunnel */ }
  await page.waitForSelector('.scoreboard')

  // ---- watch the clock ----
  //
  // Sampled in the page rather than by polling from node: a MutationObserver
  // on the minute sees EVERY value it takes, and a poll from out here at any
  // interval can step over one. Stepping over a minute is precisely the thing
  // being measured, so a sampler that can do it by accident is no use.
  await page.evaluate(() => {
    const el = document.querySelector('.scoreboard .minute')
    window.__mins = []
    const read = () => {
      const m = /^(\d+)'/.exec(el.textContent.trim())
      const v = m ? Number(m[1]) : null
      if (v != null && window.__mins[window.__mins.length - 1] !== v) window.__mins.push(v)
    }
    read()
    new MutationObserver(read).observe(el, { subtree: true, characterData: true, childList: true })
  })

  // Through to half time, answering the touchline as a manager would. A
  // kickable penalty stops the clock and waits (DecisionPanel), so a watcher
  // that only watched would sit on the first one for the rest of the run and
  // report a stalled clock - which is what the first version of this did.
  // Always the posts: the choice is not what is being measured, and one
  // answer keeps the run comparable between builds.
  const t0 = Date.now()
  const deadline = t0 + 90_000
  let calls = 0
  while (Date.now() < deadline) {
    if (await page.locator('text=Start Second Half').count()) break
    const pen = page.locator('.panel-area .btn.ghost', { hasText: 'Take the Points' })
    if (await pen.count()) { await pen.first().click(); calls++; await page.waitForTimeout(150); continue }
    await page.waitForTimeout(250)
  }
  const secs = (Date.now() - t0) / 1000
  say(`  touchline calls answered: ${calls}`)

  const mins = await page.evaluate(() => window.__mins)
  const steps = mins.slice(1).map((m, i) => m - mins[i])
  const worst = steps.length ? Math.max(...steps) : 99
  const back = steps.filter(s => s < 0).length
  say(`  clock: ${mins.length} readings, ${mins[0]}' → ${mins[mins.length - 1]}', biggest step ${worst}`)
  say(`  ${mins.join(' ')}`)

  ok(worst <= 1, `never skips a minute (biggest step was ${worst})`)
  ok(back === 0, `never runs backwards (${back} backward steps)`)
  ok(mins[mins.length - 1] >= 34, `reaches the end of the half (got to ${mins[mins.length - 1]}')`)
  ok(mins.length >= 30, `the clock is a clock, not a handful of jumps (${mins.length} distinct minutes)`)
  ok(errors.length === 0, `no page errors${errors.length ? `: ${errors[0]}` : ''}`)
  // WHAT THE MINUTES COST. Filling them is not free and the number is the
  // point of the ceiling: the 1.6.x event ticker played a half in about 20
  // seconds on Normal, and the passages were priced (PHASE_BEAT) to make that
  // roughly a third longer rather than twice as long. Above 45s a half the
  // beat has drifted, or a passage is being drawn where a headline should be.
  say(`  half took ${secs.toFixed(1)}s of wall clock on Normal`)
  ok(secs < 45, `a half is still a half, not a sit-down (${secs.toFixed(1)}s)`)
} catch (e) {
  ok(false, `probe threw: ${e}`)
}

say(fails ? `\nMINUTEPROBE FAILED (${fails})` : '\nMINUTEPROBE PASSED')
await browser.close()
done(server, fails ? 1 : 0)
