// Probe: the Back button goes back, and does not close the career.
//
// Reported by a closed-testing tester on 13 Sep 2026: "When the user taps the
// Back button, the entire app closes instead of returning to the previous
// screen." He was right, and it had never worked in any packaged build. The
// game has carried a nav stack and a back() action since the first version and
// nothing had ever listened for the hardware button, so Capacitor did what it
// does with no listener: exit.
//
// It is the same fault on the website, where the browser's Back left the site,
// which is why this can be a browser harness at all - the fix is a history
// entry rather than a native plugin, so Chromium's Back is the same press as
// Android's.
//
// WHAT THIS HAS TO ASSERT, and why the obvious version of it is not enough:
// "Back returns to the previous screen" is only half the report. The half that
// mattered to him is that the app was still there afterwards. A probe that
// only checks the screen would pass on a build that navigated back and then
// closed on the next press, so the origin is checked every time too.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const PORT = 4188
const server = await startPreview(PORT, 3000)

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 732 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

/** What the app thinks it is showing, and whether it is still the app at all.
 *
 *  Read off the store rather than off the headings: nav IS the thing Back is
 *  supposed to be popping, so asserting against a rendered <h1> would be
 *  testing the screen titles instead. window.rugbyStore is the same hook e2e
 *  uses. */
const state = () => page.evaluate(() => {
  const s = window.rugbyStore.getState()
  return {
    url: location.href,
    onApp: !!document.querySelector('.app'),
    armed: window.history.state?.phase === 'phase-back',
    depth: s.nav.length,
    screen: s.nav[s.nav.length - 1]?.screen ?? null,
    hasGame: !!s.game,
  }
})

/** The Hub submenu is how a manager reaches a desk screen. */
const openHub = async (item) => {
  await page.click('.bottom-nav button[title="Hub"]')
  await page.waitForSelector('.submenu', { timeout: 8000 })
  await page.click(`.submenu-item >> text="${item}"`)
  await page.waitForTimeout(600)
}

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })

  // ---- a career, because Back on the title screen is a different question ----
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Back Tester')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(600)

  const home = await state()
  ok(home.hasGame && home.onApp, `a career opens on ${home.screen}`)

  // ---- one screen deep, and back again ------------------------------------
  await openHub('Team')
  const deep = await state()
  ok(deep.depth > home.depth, `a tap goes one deeper (${home.screen} ${home.depth} -> ${deep.screen} ${deep.depth})`)
  ok(deep.armed, 'and history holds a spare entry for the press that follows')

  await page.goBack()
  await page.waitForTimeout(800)
  const once = await state()
  ok(once.onApp && once.hasGame, 'BACK DOES NOT CLOSE THE APP, which is the whole report')
  ok(once.url === home.url, 'and does not leave the page')
  ok(once.depth === home.depth && once.screen === home.screen,
     `it returns the manager to ${home.screen} (${once.screen}, depth ${once.depth})`)

  // ---- and it re-arms, so the tenth press works like the first -------------
  //
  // The bug this guards is the one-shot fix: push a single entry at startup,
  // spend it once, and every press after that closes the app exactly as
  // before. A manager taps Back far more than once a session, and a probe that
  // pressed it only once would sign that off.
  //
  // Driven through the store rather than the Hub submenu. The first trip above
  // already proved the real chrome reaches a screen; what is under test here is
  // whether history re-arms, and routing four more trips through menu labels
  // only adds ways for this probe to fail on something e2e already covers.
  const goTo = (screen) => page.evaluate(s => window.rugbyStore.getState().go(s), screen)

  let survived = 0
  for (const screen of ['squad', 'tactics', 'fixtures', 'squad']) {
    await goTo(screen)
    await page.waitForTimeout(500)
    const d = await state()
    if (d.depth <= home.depth) continue
    if (!d.armed) { ok(false, `history did not re-arm on the way into ${screen}`); continue }
    await page.goBack()
    await page.waitForTimeout(700)
    const b = await state()
    if (b.onApp && b.hasGame && b.depth === home.depth) survived++
  }
  ok(survived === 4, `Back keeps working press after press (${survived} of 4 round trips)`)

  // ---- two deep, and back out one screen at a time --------------------------
  //
  // The failure worth catching here is a Back that unwinds the whole stack at
  // once. That looks perfectly correct from one screen deep and is badly wrong
  // from two, which is why one round trip is not enough of a test.
  await goTo('squad')
  await page.waitForTimeout(500)
  const squad = await state()
  const pid = await page.evaluate(() => {
    const s = window.rugbyStore.getState()
    return s.game?.clubs[s.game.userClubId]?.players?.[0] ?? null
  })
  if (pid != null && squad.depth > home.depth) {
    await page.evaluate(id => window.rugbyStore.getState().go('player', id), pid)
    await page.waitForTimeout(600)
    const player = await state()
    ok(player.depth === squad.depth + 1, `two deep on ${player.screen} (depth ${player.depth})`)

    await page.goBack()
    await page.waitForTimeout(700)
    const b1 = await state()
    ok(b1.onApp && b1.depth === squad.depth && b1.screen === squad.screen,
       `back from ${player.screen} lands on ${squad.screen}, not on ${home.screen}`)

    await page.goBack()
    await page.waitForTimeout(700)
    const b2 = await state()
    ok(b2.onApp && b2.depth === home.depth && b2.screen === home.screen,
       `and the next press lands on ${home.screen}`)
  } else {
    ok(false, 'could not reach a player page to test a two-deep unwind')
  }

  // ---- a match recovered by a reload must not be closed by a stray thumb ----
  //
  // There are two ways to be on the match screen and they are NOT the same
  // shape. kickOff pushes matchday onto the stack (store.ts:901), so a match
  // started from the day room sits three or four deep and Back pops out of it
  // like any other screen. resumeLive REPLACES the stack with a single matchday
  // entry (store.ts:680), which is what a reload into a match in progress
  // leaves behind - and that is depth 1, where the ordinary rule would let Back
  // through to the shell and close the app.
  //
  // That is the worst moment for it: the manager has just got his match back.
  // So matchday is armed whatever the depth, and at depth 1 Back does nothing.
  //
  // The first version of this probe asserted that kickOff produced depth 1,
  // which is simply untrue, and reached the match screen by advancing weeks
  // until one turned up at depth 4. It failed, correctly, and the comment in
  // App.tsx that said the same thing was wrong with it.
  while ((await state()).depth > 1) { await page.goBack(); await page.waitForTimeout(400) }

  // the walk into a match, taken from reloadprobe, which has driven it for
  // longer than this probe has existed
  for (let tap = 0; tap < 12; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn').catch(() => {})
    await page.waitForTimeout(500)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 6000 }).catch(() => {})
  await page.click('.talk-modal .speech-tile >> nth=1').catch(() => {})
  await page.locator('text=▸ Take the Field').click({ timeout: 3000 }).catch(() => {})
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  await page.waitForTimeout(2500)

  const kicked = await state()
  ok(kicked.screen === 'matchday', `a match is running (${kicked.screen}, depth ${kicked.depth})`)
  ok(kicked.armed, `and it arms the spare entry at depth ${kicked.depth} like any other screen`)

  // ---- now the case the exception exists for: a reload into a live match ----
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.scoreboard', { timeout: 40000 }).catch(() => {})
  await page.waitForTimeout(2000)
  const resumed = await state()
  ok(resumed.screen === 'matchday', `the reload comes back into the match (${resumed.screen})`)
  if (resumed.screen === 'matchday') {
    ok(resumed.depth === 1, `and it is the only screen on the stack, which is the whole problem (depth ${resumed.depth})`)
    ok(resumed.armed, 'armed anyway, because there is nothing underneath it to go back to')
    await page.goBack()
    await page.waitForTimeout(900)
    const after = await state()
    ok(after.onApp && after.screen === 'matchday',
       `BACK DOES NOT CLOSE A RECOVERED MATCH (${after.screen})`)
    await page.goBack()
    await page.waitForTimeout(900)
    const after2 = await state()
    ok(after2.onApp && after2.screen === 'matchday', 'nor does the press after that')
  }

} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close()
  server.stop()
}

if (errors.length) {
  console.error(`\nuncaught page errors (${errors.length}):`)
  for (const e of [...new Set(errors)]) console.error('  ' + e)
  fails += errors.length
}

if (fails) { console.error(`\nBACK PROBE: ${fails} failures`); process.exit(1) }
console.log('\nBACK PROBE PASSED: Back goes back, again and again, and never closes a career')
done(0)
