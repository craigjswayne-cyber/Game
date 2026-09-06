// Probe: the match-screen banner is up during PLAY and nowhere else.
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

try {
  await page.goto('http://localhost:4216/')
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
  await page.waitForSelector('text=Kick Off', { timeout: 20000 })

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
  ok(await slotUp(), 'the banner is up while the match is running')

  // ---- making subs ----
  const squad = page.locator('.speed-controls >> text=Squad')
  if (await squad.count()) {
    await squad.first().click()
    await page.waitForTimeout(400)
    ok(!(await slotUp()), 'and it is gone the moment the squad sheet opens for a sub')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    const back = await slotUp()
    if (!back) {
      const close = page.locator('.modal .grab, .modal-veil')
      if (await close.count()) { await close.first().click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(400) }
    }
    ok(await slotUp(), 'and it comes back when the sheet closes')
  } else {
    ok(false, 'could not find the Squad button to open a sub sheet')
  }

  // ---- half time ----
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Start Second Half', { timeout: 25000 })
  await page.waitForTimeout(400)
  ok(!(await slotUp()), 'no banner at half time')

  await page.click('text=▸ Start Second Half')
  await page.waitForTimeout(500)
  ok(await slotUp(), 'up again for the second half')

  // ---- the hour break ----
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Play the Final Quarter', { timeout: 25000 })
  await page.waitForTimeout(400)
  ok(!(await slotUp()), 'no banner at the hour break')

  await page.click('text=▸ Play the Final Quarter')
  await page.waitForTimeout(500)

  // ---- full time ----
  await page.click('.speed-controls >> text=Skip')
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
  ? 'MATCH AD PASSED: in play only - never over a sub, half time, the hour or full time'
  : `MATCH AD FAILED (${fails})`)
await browser.close()
server.stop?.()
done(fails)
