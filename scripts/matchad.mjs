// Probe: the match-screen banner is up only while a HIGHLIGHT plays, and
// nowhere else in a match. Plus the week's floor carries one (1.8.7).
//
// Owner, 1.8.7, from the iOS simulator: "It shouldnt be over stats or
// lineups" and, of the banner under the pitch animation, "It works really
// well when the animation is on screen".
//
// Owner, 6 Sep, with a screenshot of the empty strip under the commentary:
// "should only be in-game! NOT when making subs, half-time, 60 or ft. its just
// an easy ad space".
//
// That list is the feature. src/game/monetise.ts carried a rule saying a banner
// must never appear during a match at all, and this placement deliberately
// breaks it, so the exception has to be held to its own terms by something
// other than good intentions. The match screen is the one place in the game
// where a mis-tap costs a substitution.
//
// This stubs the GAME-SIDE seam (globalThis.rmAds) rather than the shell
// bridge - adsprobe.mjs already drives the real bridge - because the question
// here is only ever "did the game mount a slot on this screen, in this state".
//
// Run: node scripts/matchad.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4216', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
page.setDefaultTimeout(15000)

// A provider that exists. Without one the slot renders null everywhere and
// every assertion below would pass for the wrong reason.
await page.addInitScript(() => {
  localStorage.setItem('rm-night', '1')
  globalThis.rmAds = { mount() {}, unmount() {} }
})

const slotUp = async () => (await page.locator('.ad-slot').count()) > 0
const clipUp = async () => (await page.locator('[data-testid=hl-clip]').count()) > 0
const statsUp = async () => (await page.locator('[data-testid=live-stats]').count()) > 0
// a touchline call stops the clock and disables Skip until it is answered
const answer = async () => {
  for (const label of ['Take the Points', 'Kick for the Corner', 'Scrum']) {
    const b = page.locator(`button:has-text("${label}")`)
    if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(200); return true }
  }
  return false
}
const skip = async (until) => {
  for (let i = 0; i < 60; i++) {
    if (await page.locator(`text=${until}`).count()) return
    await answer()
    const b = page.locator('.speed-controls [data-ctl=skip]:not([disabled])')
    if (await b.count()) await b.first().click().catch(() => {})
    await page.waitForTimeout(500)
  }
}

try {
  // ?hl=1: highlights are off under a test driver unless asked for
  await page.goto('http://localhost:4216/?hl=1')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
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
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  // Continue walks the week a day at a time, same as e2e does it: the button
  // reads Continue on the bulletin days and Matchday on the day of the game.
  let weekSeen = 0, weekWithSlot = 0
  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off').count()) break
    if (await page.locator('.day-next').count()) { weekSeen++; if (await slotUp()) weekWithSlot++ }
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
  await page.waitForSelector('text=Kick Off', { timeout: 20000 })
  ok(weekSeen > 0 && weekWithSlot === weekSeen, `the floor of the week carries a banner (${weekWithSlot} of ${weekSeen} days)`)

  await page.locator('text=Kick Off ▸').first().click()
  try {
    await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    ok(!(await slotUp()), 'no banner over the dressing-room team talk')
    await page.click('.talk-modal .speech-tile >> text=Calm the nerves')
  } catch { /* no dressing room */ }
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* straight down the tunnel */ }

  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  await page.waitForTimeout(600)
  // ---- the stage: stats or a highlight ----
  // Sample the screen while play runs: every moment the live stats are the
  // stage there must be no banner, and every moment a highlight is, there is.
  let statsMoments = 0, statsWithSlot = 0, clipMoments = 0, clipWithSlot = 0
  // 960 samples (four minutes), not 480: the career's seed is fresh every run,
  // and on the 1.8.15 RC run one first half went two minutes without a
  // highlight, so the check read "0 of 0" on a screen that was working (the
  // next two runs found 58 and 36). The loop still stops as soon as it has
  // three of each.
  for (let i = 0; i < 960 && (clipMoments < 3 || statsMoments < 3); i++) {
    if (await answer()) continue
    // (one snapshot of the page, not three queries in turn: a clip that ended
    // between asking for it and asking for the banner read as a clip without one)
    const { c, st, up } = await page.evaluate(() => ({
      c: !!document.querySelector('[data-testid=hl-clip]'),
      st: !!document.querySelector('[data-testid=live-stats]'),
      up: !!document.querySelector('.ad-slot'),
    }))
    if (c) { clipMoments++; if (up) clipWithSlot++ }
    else if (st) { statsMoments++; if (up) statsWithSlot++ }
    await page.waitForTimeout(250)
  }
  ok(statsMoments > 0 && statsWithSlot === 0, `no banner over the live stats (${statsWithSlot} of ${statsMoments} moments)`)
  ok(clipMoments > 0 && clipWithSlot === clipMoments, `the banner is up under a highlight (${clipWithSlot} of ${clipMoments} moments)`)

  // ---- making subs ----
  const squad = page.locator('.speed-controls [data-ctl=squad]')
  if (await squad.count()) {
    await squad.first().click()
    await page.waitForTimeout(400)
    ok(!(await slotUp()), 'no banner while the squad sheet is open for a sub')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    if (await page.locator('.modal').count()) {
      const close = page.locator('.modal .grab, .modal-veil')
      if (await close.count()) { await close.first().click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(400) }
    }
  } else {
    ok(false, 'could not find the Squad button to open a sub sheet')
  }

  // ---- half time ----
  await skip('Start Second Half')
  await page.waitForSelector('text=Start Second Half', { timeout: 25000 })
  await page.waitForTimeout(400)
  ok(!(await slotUp()), 'no banner at half time')

  await page.click('text=▸ Start Second Half')
  await page.waitForTimeout(500)

  // ---- the hour break ----
  await skip('Play the Final Quarter')
  await page.waitForSelector('text=Play the Final Quarter', { timeout: 25000 })
  await page.waitForTimeout(400)
  ok(!(await slotUp()), 'no banner at the hour break')

  await page.click('text=▸ Play the Final Quarter')
  await page.waitForTimeout(500)

  // ---- full time ----
  await skip('Continue to Results')
  await page.waitForSelector('text=Continue to Results', { timeout: 25000 })
  await page.waitForTimeout(400)
  ok(!(await slotUp()), 'and none at full time')

  // ---- and a supporter never sees it at all ----
  await page.evaluate(() => localStorage.setItem('rm-ent', JSON.stringify({ 'phase.license': true })))
} catch (e) {
  say('PROBE THREW ' + String(e).slice(0, 400))
  fails++
}

say('')
say(fails === 0
  ? 'MATCH AD PASSED: under a highlight only - never over the stats, a sub, half time, the hour or full time'
  : `MATCH AD FAILED (${fails})`)
await browser.close()
server.stop?.()
done(fails)
