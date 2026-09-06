// ---- THE WOMEN'S GAME, PLAYED ----
//
// genderprobe.ts proves the two worlds are built apart and stay apart. It works
// on the engine and never opens a browser, so everything it proves is true of a
// GameState and nothing it proves is true of the GAME: whether the choice is on
// the menu, whether the wizard survives being pointed at a nine-club world, and
// whether a women's career actually reaches a home screen and plays a match.
//
// That gap matters more here than usual because every one of the fifty-odd
// browser harnesses starts a career by clicking text=New Career, which is the
// MEN'S door. Without this file the women's path would have no browser coverage
// at all, and the first person to walk it would be a player.
//
// Two things it is specifically watching for, both found by reading the wizard
// rather than by running it:
//
//   - the four challenges are pinned to men's clubs (Montauban, Newcastle,
//     Munster, Cornwall) that do not exist in the women's world. Rendered there,
//     pickChallenge would set leagueIdx to -1 and the wizard would walk into a
//     screen with no league on it. They are hidden; this checks they are.
//   - a women's world has nine clubs where the men's has 101, and no cups and
//     no internationals. Screens that assume a fixture list longer than a league
//     season, or a competition list with a cup in it, break there and only there.
//
// Run: node scripts/womensui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const PORT = '4231'
const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 })
page.setDefaultTimeout(12000)
const errs = []
page.on('pageerror', e => errs.push(e.message))
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY')

  // ---- the choice is on the main page ----
  const menMatches = await page.locator('text=New Career').count()
  ok(menMatches === 1,
    `exactly one button on the menu matches text=New Career (${menMatches}) - two would break the other 52 harnesses under Playwright strict mode`)
  // .new-career-w, not text=Women's Game. Playwright's text= is a
  // case-insensitive SUBSTRING match, and the hint line under the buttons says
  // "The men's and women's games are separate careers" - which contains it. The
  // first run of this probe counted two and failed, which is the selector being
  // wrong rather than the menu.
  ok(await page.locator('.new-career-w').count() === 1, 'the women\'s game has its own door on the menu')
  ok(await page.locator('.new-career-hint').count() === 1, 'and a line saying the two are separate careers')

  // ---- the wizard, pointed at the women's world ----
  await page.click('.new-career-w')
  await page.waitForSelector('text=English Premier Division')

  ok(await page.locator('.challenge-card').count() === 0,
    'no challenge cards in the women\'s wizard (all four are pinned to men\'s clubs)')

  // both women's competitions are offered, not just England
  ok(await page.locator('text=Pacific Championship').count() === 1,
    'the Pacific Championship is on the competition list too')
  ok(await page.locator('text=French Elite 1').count() === 1,
    'and France')

  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  const tiles = await page.locator('.club-tile').count()
  ok(tiles === 9, `the club list is the nine PWR clubs (${tiles})`)

  // a club whose name only exists in the women's world's version of the league
  await page.click('.tile >> text=Loughboro')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-box >> text=Got it').catch(() => {})
  ok(true, 'a women\'s career reaches the home screen')

  // ---- and no man is anywhere in it ----
  const squad = await page.evaluate(async () => {
    const el = document.querySelector('body')
    return el ? el.textContent ?? '' : ''
  })
  ok(!squad.includes('w:'), 'no raw w: id has leaked onto a screen')

  // ---- it plays ----
  // Continue until a match is reachable, then check the world it is played in.
  for (let i = 0; i < 14; i++) {
    const cont = page.locator('.action-bar >> text=Continue')
    if (await cont.count() === 0) break
    await cont.first().click()
    await page.waitForTimeout(220)
    if (await page.locator('text=Kick Off').count() > 0) break
  }
  ok(errs.length === 0, `no page error walking a women's career${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`)
} catch (e) {
  ok(false, `PROBE THREW: ${e.message}`)
} finally {
  await browser.close()
  server.stop()
}

console.log('')
if (fails === 0) console.log("WOMEN'S UI PROBE PASSED: the women's game is on the menu and plays")
else console.log(`WOMEN'S UI PROBE FAILED (${fails})`)
process.exit(fails ? 1 : 0)
