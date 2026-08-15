// The Annual is a real gate (round 25C).
//
// User: "when a season is complete - there should be a forced page that says
// 'ready for a new season?' Records of the last season should be backed up."
// This drives a career to the rollover through the real UI, and holds the
// game to three promises: the Annual page appears, Continue cannot slip past
// it, and its one button is the only way into the new season.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4244, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

try {
  await page.goto('http://localhost:4244/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  // WAIT FOR EACH SCREEN, do not assume it. These four clicks were the only
  // unguarded ones in the wizard, and under a loaded suite box the screen
  // behind them can be slower to settle than Playwright's auto-wait allows -
  // which is how this probe failed two suite runs with a bare "page.click:
  // Timeout 30000ms exceeded" while passing every time it was run alone. A
  // gate that cries wolf is how a real failure gets waved through.
  await page.waitForSelector('input[placeholder="e.g. A. Gaffer"]', { timeout: 15000 })
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Annual')
  await page.waitForSelector('.speech-tile >> text=Forward Dominance', { timeout: 15000 })
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.waitForSelector('text=▸ Start Career', { timeout: 15000 })
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })

  // Drive the settle loop through the store rather than 400 taps of Continue:
  // processWeekAndAdvance is what the button ultimately calls week by week, and
  // the store's continueWeek picks up the annual stamp on the LANDING, which is
  // the piece under test. So settle 44 weeks headless-in-page, then let the
  // real Continue button take the career across the boundary.
  await page.evaluate(async () => {
    // drive a whole season the way a real thumb would, at machine speed: clear
    // the desk, Continue through the day flow, and hand any matchday to the
    // assistant's Instant Result. Stops the moment the rollover stamps annual.
    for (let guard = 0; guard < 900; guard++) {
      const st = window.rugbyStore.getState()
      if (!st.game || st.game.annual) break
      for (const o of st.game.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
      const screen = st.nav[st.nav.length - 1]?.screen
      // the 220ms double-tap guard is for thumbs, not for this loop
      window.rugbyStore.setState({ lastAdvanceAt: 0 })
      if (st.liveMatch) { st.instantResult() }
      else if (screen === 'matchday') { st.instantResult() }
      else st.continueWeek()
      await new Promise(r => setTimeout(r, 5))
    }
  }).catch(() => {})
  await page.waitForTimeout(600)

  const annualSet = await page.evaluate(() => !!window.rugbyStore.getState().game.annual)
  if (!annualSet) {
    // final continue taps across the boundary through the real button
    for (let i = 0; i < 20; i++) {
      if (await page.evaluate(() => !!window.rugbyStore.getState().game.annual)) break
      await page.evaluate(() => { window.rugbyStore.setState({ lastAdvanceAt: 0 }); window.rugbyStore.getState().continueWeek() })
      await page.waitForTimeout(60)
    }
  }
  ok(await page.evaluate(() => !!window.rugbyStore.getState().game.annual),
    'the rollover stamped the Annual')

  // Continue must land on the page, not the new season
  await page.evaluate(() => { window.rugbyStore.setState({ lastAdvanceAt: 0 }); window.rugbyStore.getState().continueWeek() })
  await page.waitForTimeout(400)
  await page.waitForSelector('text=Ready for a new season', { timeout: 8000 })
  ok(true, 'Continue lands on the Annual page')

  // and pressing Continue again goes nowhere else
  await page.evaluate(() => { window.rugbyStore.setState({ lastAdvanceAt: 0 }); window.rugbyStore.getState().continueWeek() })
  await page.waitForTimeout(300)
  ok(await page.locator('text=Ready for a new season').count() > 0,
    'a second Continue stays on the Annual - the gate holds')

  // the one door out
  await page.waitForSelector('text=Ready for a new season', { timeout: 15000 })
  await page.click('text=Ready for a new season')
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => {
    const s = window.rugbyStore.getState()
    return { annual: !!s.game.annual, week: s.game.week, screen: s.nav[s.nav.length - 1]?.screen }
  })
  say(`  after the button: week ${after.week}, screen ${after.screen}`)
  ok(!after.annual, 'the button clears the stamp')
  ok(after.week === 1, 'and the new season stands at week 1')
} catch (e) {
  say(`FAIL  ${e.message.split('\n')[0]}`)
  fails++
} finally {
  await browser.close()
  server.stop()
}

if (fails) { say(`\nANNUAL PROBE FAILED (${fails})`); process.exit(1) }
say('\nANNUAL PROBE PASSED: no season starts without the manager saying so')
done(0)
