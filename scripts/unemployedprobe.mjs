// Probe: no desk, no desk screens (19E), and the trimmed-down surfaces (19D).
//
// User: "when ive resigned or fired from a team i still see team information
// like fictures etc". Resigning set unemployed but left the nav trail - and
// resume restores it - so the back arrow walked a jobless manager straight
// into his old club's Fixtures page. The App guard now redirects any club-desk
// screen to the unemployed Home.
//
// The walk: start a career (checking on the way that the New Career wizard no
// longer offers "Your Story" - 19D), open Fixtures like any employed manager,
// then resign through the store handle and watch the door close behind you.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4181, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

try {
  await page.goto('http://localhost:4181/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Door')

  // 19D: the manager step offers a name and a philosophy, nothing else
  const storyTiles = await page.locator('text=Your Story').count()
  ok(storyTiles === 0, 'the New Career wizard no longer offers Your Story')

  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  // an employed manager opens his fixture list like any other day
  await page.evaluate(() => window.rugbyStore.getState().go('fixtures'))
  await page.waitForTimeout(400)
  let mast = await page.locator('.masthead h1').innerText()
  ok(/fixtures/i.test(mast), `Fixtures opens while employed (masthead: "${mast}")`)

  // he resigns with the screen still open - the exact stale-trail state
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    st.game.unemployed = true
    st.touch()
  })
  await page.waitForTimeout(500)
  mast = await page.locator('.masthead h1').innerText()
  ok(/unemployed/i.test(mast), `the old club's Fixtures page closed behind him (masthead: "${mast}")`)
  ok(await page.locator('text=The Job Centre').count() > 0, 'and he lands on the between-jobs Home')

  // and the desk stays shut if he tries the door again
  await page.evaluate(() => window.rugbyStore.getState().go('squad'))
  await page.waitForTimeout(500)
  mast = await page.locator('.masthead h1').innerText()
  ok(/unemployed/i.test(mast), `Team redirects home while unemployed (masthead: "${mast}")`)

  // world screens are about the world, not his desk: they stay open
  await page.evaluate(() => window.rugbyStore.getState().go('tables'))
  await page.waitForTimeout(400)
  mast = await page.locator('.masthead h1').innerText()
  ok(!/unemployed/i.test(mast), `Competitions still opens while unemployed (masthead: "${mast}")`)

  // the day room stays open between jobs, but the desk furniture inside it
  // goes: an unemployed manager was still shown his OLD club's treatment room
  // in the Monday review (round 25, from a screenshot)
  await page.evaluate(() => window.rugbyStore.getState().go('day'))
  await page.waitForTimeout(400)
  const dayText = await page.locator('.content').innerText()
  ok(!/Treatment Room/i.test(dayText), 'the day room shows no old-club treatment room while unemployed')
  ok(/Between jobs/i.test(dayText), 'and says plainly why the desk furniture is gone')
} catch (e) {
  say(`FAIL  ${e.message}`)
  fails++
} finally {
  await browser.close()
  server.stop()
}

// done() takes the FAILURE COUNT - the first draft passed it the server
// object, which is always truthy, so a probe whose every assertion held
// exited 1 with its verdict unprinted and the suite recorded a phantom FAIL.
say(fails ? `\nUNEMPLOYED PROBE FAILED (${fails})` : '\nUNEMPLOYED PROBE PASSED: no desk, no desk screens')
done(fails)
