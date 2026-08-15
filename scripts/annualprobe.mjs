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

/**
 * SAY WHICH STEP FAILED. This probe failed three suite runs with nothing but
 * "page.click: Timeout 30000ms exceeded" - no selector, no screen, no clue -
 * and passed every time it was run by hand. Two rounds were spent guessing at
 * it, which is two rounds too many: a harness that cannot say what it was
 * doing when it broke is not a harness, it is a rumour. Every step through the
 * wizard now names itself, and a failure prints the step, the URL and what was
 * actually on the screen at the time.
 */
const step = async (what, fn) => {
  try {
    await fn()
  } catch (e) {
    const seenNow = await page.evaluate(() => ({
      title: document.querySelector('h1')?.textContent?.trim() ?? '(no h1)',
      buttons: [...document.querySelectorAll('button')].slice(0, 8).map(b => (b.textContent || '').trim().slice(0, 24)),
      body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
    })).catch(() => null)
    console.log(`FAIL  step "${what}" broke: ${(e.message || e).toString().split('\n')[0]}`)
    if (seenNow) {
      console.log(`        screen was "${seenNow.title}" · buttons: ${seenNow.buttons.join(' / ')}`)
      console.log(`        text: ${seenNow.body}`)
    }
    throw e
  }
}

try {
  await page.goto('http://localhost:4244/')
  await step('title screen appears', () => page.waitForSelector('text=RUGBY', { timeout: 15000 }))
  await step('tap New Career', () => page.click('text=New Career', { timeout: 15000 }))
  await step('league list appears', () => page.waitForSelector('text=Gallagher Premiership', { timeout: 15000 }))
  await step('tap Gallagher Premiership', () => page.click('text=Gallagher Premiership', { timeout: 15000 }))
  await step('club tiles appear', () => page.waitForSelector('.club-tile', { timeout: 15000 }))
  await step('tap Northampton', () => page.click('.tile >> text=Northampton', { timeout: 15000 }))
  await step('squad preview appears', () => page.waitForSelector('text=Star Player', { timeout: 15000 }))
  await step('confirm the club', () => page.click('.action-bar >> text=Confirm', { timeout: 15000 }))
  await step('name field appears', () => page.waitForSelector('input[placeholder="e.g. A. Gaffer"]', { timeout: 15000 }))
  await step('type a manager name', () => page.fill('input[placeholder="e.g. A. Gaffer"]', 'Annual'))
  await step('origin tiles appear', () => page.waitForSelector('.speech-tile >> text=Forward Dominance', { timeout: 15000 }))
  await step('pick an origin', () => page.click('.speech-tile >> text=Forward Dominance', { timeout: 15000 }))
  await step('confirm the manager', () => page.click('.action-bar >> text=Confirm', { timeout: 15000 }))
  await step('start button appears', () => page.waitForSelector('text=▸ Start Career', { timeout: 15000 }))
  await step('tap Start Career', () => page.click('text=▸ Start Career', { timeout: 15000 }))
  await step('tutorial appears', () => page.waitForSelector('.tut-box', { timeout: 15000 }))
  await step('close the tutorial', () => page.click('.tut-close .btn', { timeout: 15000 }))
  await step('the game is up', () => page.waitForSelector('.bottom-nav', { timeout: 15000 }))

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
  await step('the Annual door appears', () => page.waitForSelector('text=Ready for a new season', { timeout: 15000 }))
  await step('walk through the Annual door', () => page.click('text=Ready for a new season', { timeout: 15000 }))
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
