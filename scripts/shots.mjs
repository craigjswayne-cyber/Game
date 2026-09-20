// Quick visual review: capture key screens without the full E2E flow.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })

const server = await startPreview('4174', 2500)

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 390), height: Number(process.env.H || 844) }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` })

try {
  await page.goto('http://localhost:4174/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await shot('r1-title')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  // 'Leicester', not 'Leicester Tigers': the club is Leicester RFC since the IP
  // rename, and the welcome story names it the way the save has it
  await page.waitForSelector('text=Welcome to Leicester', { timeout: 15000 })
  await shot('r2-inbox')
  await page.click('.bottom-nav button[title="Hub"]')
  // The group menu is twelve of the game's icons in one frame and nothing
  // else photographed it, so a whole icon set could drift without a single
  // shot in this folder showing it.
  await page.waitForSelector('.submenu-item')
  await page.waitForTimeout(250)
  await shot('r2b-hub')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.dtable')
  await page.click('.tab-bar >> text=General Info')
  await page.waitForTimeout(300)
  await shot('r3-squad')
  await page.click('.dtable tbody tr >> nth=7')
  // The profile opens on its own tab bar and Set Piece & Contact lives under
  // Attributes, so waiting for that heading without opening the tab waits for
  // something that is not on screen. This reporter has been timing out here
  // and writing r9-fail instead of the player shots; scripts/e2e.mjs clicks
  // the tab first, which is why it never saw the same thing.
  await page.waitForSelector('.tab-bar')
  await page.click('.tab-bar >> text=Attributes')
  await page.waitForSelector('text=Set Piece & Contact')
  await shot('r4-player')
  await page.click('.back-btn')
  // The rail hides its labels (.nlbl { display: none }), so no text selector
  // matches a rail button - and Competitions is not a rail button any more in
  // any case, it is an item in the World group. Titles are what the rail
  // exposes, which is how the rest of this file already reaches the Hub.
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Competitions')
  await page.waitForSelector('.dtable')
  await shot('r5-tables')
  // ONE CONTINUE IS NOT A WEEK. The walk to matchday passes day bulletins,
  // press questions and the odd offer, so a single press lands on a story
  // page and the wait for Kick Off times out - which is what it had been
  // doing, killing every shot from the preview onwards. Same bounded loop
  // scripts/minuteprobe.mjs uses.
  for (let tap = 0; tap < 12; tap++) {
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
  await page.waitForSelector('text=Kick Off', { timeout: 15000 })
  await shot('r6-preview')
  await page.click('text=Kick Off ▸')
  // The dressing room and the tunnel both sit between Kick Off and the
  // scoreboard, and either can be absent depending on the week, so both are
  // guarded rather than awaited. Without these the wait for .scoreboard was
  // watching a team talk.
  try {
    await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    await page.click('.talk-modal .speech-tile >> text=Calm the nerves')
  } catch { /* no dressing room this week */ }
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* straight down the tunnel */ }
  await page.waitForSelector('.scoreboard', { timeout: 15000 })
  await page.waitForTimeout(4500)
  await shot('r7-live')
  await page.click('text=Skip ▸')
  await page.waitForSelector('text=Start Second Half', { timeout: 15000 })
  await shot('r8a-halftime')
  await page.click('text=▸ Start Second Half')
  await page.waitForTimeout(400)
  await page.click('text=Skip ▸')
  await page.waitForSelector('text=Play the Final Quarter', { timeout: 15000 })
  await page.click('text=▸ Play the Final Quarter')
  await page.waitForTimeout(400)
  await page.click('text=Skip ▸')
  await page.waitForSelector('text=Continue to Results', { timeout: 15000 })
  await shot('r8-fulltime')

  // floodlit mode
  await page.click('text=Continue to Results')
  // Continue to Results lands on the week's report, not the inbox, so waiting
  // for a .news-item here waited for something no route had been asked for.
  // The rail is the way in, and its News button serves the next unread.
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  await page.click('.bottom-nav button[title="News"]')
  await page.waitForTimeout(400)
  await page.click('.night-btn')
  await page.waitForTimeout(400)
  await shot('n1-inbox-night')
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForTimeout(400)
  await page.click('.tab-bar >> text=General Info')
  await page.waitForTimeout(300)
  await shot('n2-squad-night')
  await page.click('.dtable tbody tr >> nth=7')
  // The profile opens on its own tab bar and Set Piece & Contact lives under
  // Attributes, so waiting for that heading without opening the tab waits for
  // something that is not on screen. This reporter has been timing out here
  // and writing r9-fail instead of the player shots; scripts/e2e.mjs clicks
  // the tab first, which is why it never saw the same thing.
  await page.waitForSelector('.tab-bar')
  await page.click('.tab-bar >> text=Attributes')
  await page.waitForSelector('text=Set Piece & Contact')
  await shot('n3-player-night')
  await page.click('.back-btn')
  // The rail hides its labels (.nlbl { display: none }), so no text selector
  // matches a rail button - and Competitions is not a rail button any more in
  // any case, it is an item in the World group. Titles are what the rail
  // exposes, which is how the rest of this file already reaches the Hub.
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Competitions')
  await page.waitForTimeout(400)
  await shot('n4-tables-night')
  console.log('SHOTS DONE')
} catch (e) {
  await shot('r9-fail')
  console.error('FAIL', e.message)
  // QA-GATE-01 (1.6.5): a caught failure used to be followed by exit(0) in
  // finally, so the harness reported success. The failure sets the exit code
  // and finally exits WITH it.
  process.exitCode = 1
} finally {
  console.log('errors:', errors.length ? errors : 'none')
  if (errors.length) process.exitCode = 1
  await browser.close()
  server.stop()
  process.exit(process.exitCode ?? 0)
}
