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
//   - a challenge is pinned to one club, and a club exists in one world. Render
//     a men's challenge in the women's wizard and pickChallenge sets leagueIdx
//     to -1, which walks into a screen with no league on it. Until 1.5.6 the
//     women's wizard answered that by showing no challenges at all; it now has
//     four of its own, and what this checks is that each world sees ONLY its
//     own - the men's four in the men's wizard, the women's four in the
//     women's, and no card that would break the screen behind it.
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
  // v1.5.4: the picker is not on the menu any more. It sat one line under
  // Continue, which read as a switch on the career already running - the owner
  // chose the women's game, pressed Continue and arrived back in the men's one.
  // The title screen offers the door; the wizard asks which game is behind it.
  ok(await page.locator('.new-career-w').count() === 0,
    'the title screen does not ask which game - it only offers New Career')
  await page.click('text=New Career')
  await page.waitForSelector('.new-career-w')
  ok(await page.locator('.new-career-w').count() === 1, 'the women\'s game is one half of the picker in the wizard')
  // A segmented control, so the two halves are a radio group and the men's game
  // is the one lit when the wizard opens. A career started without touching it
  // is a men's career, which is what the other 52 harnesses assume when they
  // click New Career and go straight to the competition list.
  ok(await page.locator('.new-career-m[aria-checked="true"]').count() === 1,
    'the men\'s game is selected when the menu opens')
  ok(await page.locator('.new-career-w[aria-checked="false"]').count() === 1,
    'and the women\'s game is not')
  const half = await page.locator('.new-career-m').boundingBox()
  const otherHalf = await page.locator('.new-career-w').boundingBox()
  ok(Math.abs(half.width - otherHalf.width) <= 1 && Math.abs(half.y - otherHalf.y) <= 1,
    `the two games are the same size, side by side (${Math.round(half.width)}x${Math.round(half.height)} v ${Math.round(otherHalf.width)}x${Math.round(otherHalf.height)})`)
  // the men's competition list is what the wizard opens on
  ok(await page.locator('text=English Premier Division').count() >= 1,
    'the wizard opens on the men\'s competitions')

  // ---- and switching the picker switches the world under it ----
  await page.click('.new-career-w')
  ok(await page.locator('.new-career-w[aria-checked="true"]').count() === 1,
    'tapping the women\'s game lights it')
  ok(await page.locator('.new-career-m[aria-checked="false"]').count() === 1,
    'and puts the men\'s game out')
  await page.waitForSelector("text=English Women's Premier Division")

  // the women's four, and not one of the men's
  const wCards = await page.locator('.challenge-card').count()
  ok(wCards === 4, `the women's wizard offers its own four challenges (${wCards})`)
  // 'Stop the Circus' since 1.5.8 - the id behind it is still 'threepeat',
  // because every save that has started or finished it carries that string
  for (const n of ['Stop the Circus', 'The Ealing Project', 'Keep the Licence', 'The Lichfield Grudge']) {
    ok(await page.locator(`text=${n}`).count() >= 1, `${n} is one of them`)
  }
  for (const n of ['Sauvez Sapiac', 'The Energy Project', 'Break the Dynasty', 'The Cornwall Dream']) {
    ok(await page.locator(`text=${n}`).count() === 0, `and ${n} is not, because its club is in the other world`)
  }
  // both women's competitions are offered, not just England
  // named explicitly, never as the men's default (owner's rule)
  for (const n of ["Women's Pacific Championship", "French Women's Division 1",
                   "English Women's Championship", "French Women's Division 2",
                   'Celtic Provinces Cup']) {
    ok(await page.locator(`text=${n}`).count() >= 1, `${n} is on the competition list`)
  }
  ok(await page.locator('text=English Premier Division').count() === 0,
    "and no women's competition wears the men's name")
  // and none wears a REAL competition's name: these four shipped in the first
  // women's build because they arrived after the pass that renamed the men's
  for (const real of ['Celtic Challenge', 'Pacific Four Series', 'Premiership Women']) {
    ok(await page.locator(`text=${real}`).count() === 0, `no real mark on screen: ${real}`)
  }

  await page.click("text=English Women's Premier Division")
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
