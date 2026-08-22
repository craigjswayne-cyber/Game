// The chaos sweep's browser leg: does the INTERFACE survive a wrecked club?
//
// The engine half (scripts/chaosprobe.ts) proves the simulation bends without
// breaking. This proves the screens do: a balance ten million in the red, a
// squad stripped to the board's 18-man floor, and a 150-6 scoreline on the
// fixture list - the three states most likely to overflow a phone table cell,
// per the QA brief ("text overflow on high scores/negative balances, broken
// squad views with <15 players"). Staged through window.rugbyStore, the same
// door injurygate.mjs uses.
//
// Run: node scripts/chaosui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4201, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

/** The page-wide horizontal overflow check portraitqa uses: the body itself
 *  must never scroll sideways; wide content lives in its own scroller. */
const overflow = () => page.evaluate(() => {
  const d = document.scrollingElement
  return d ? d.scrollWidth - d.clientWidth : 0
})

try {
  await page.goto('http://localhost:4201/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Chaos')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.masthead', { timeout: 20000 })

  // ---- wreck the club ----
  const staged = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const club = g.clubs[g.userClubId]
    club.balance = -10_000_000
    club.budget = -2_500_000
    // strip to the 18-senior floor the board now enforces
    const seniors = club.players.filter(id => !g.players[id]?.acad)
    const keep = seniors.slice(0, 18)
    for (const id of club.players) {
      if (!keep.includes(id) && !g.players[id]?.acad) g.players[id].clubId = null
    }
    club.players = club.players.filter(id => keep.includes(id) || g.players[id]?.acad)
    // and a scoreline that would clip a narrow cell
    const fx = g.fixtures.find(f => !f.played && (f.homeId === club.id || f.awayId === club.id))
    fx.played = true
    fx.homeScore = fx.homeId === club.id ? 6 : 150
    fx.awayScore = fx.homeId === club.id ? 150 : 6
    fx.homeTries = fx.homeId === club.id ? 1 : 22
    fx.awayTries = fx.homeId === club.id ? 22 : 1
    st.touch()
    return { seniors: keep.length, fxWeek: fx.week }
  })
  say(`  staged: balance -10m, ${staged.seniors} seniors, a 150-6 on the books (week ${staged.fxWeek})`)

  // ---- Finances: the red ledger ----
  await page.evaluate(() => window.rugbyStore.getState().go('finances'))
  await page.waitForTimeout(400)
  const finText = await page.locator('.content').innerText()
  ok(/-£10\.0m|−£10\.0m|-£10m/.test(finText), 'the ten-million hole is printed as real negative money')
  ok((await overflow()) <= 1, `Finances survives the red ledger without sideways scroll (${await overflow()}px)`)
  await page.screenshot({ path: (process.env.SHOTS_DIR ?? 'shots') + '/chaos-finances.png' }).catch(() => {})

  // ---- Squad: 18 men, no broken table ----
  await page.evaluate(() => window.rugbyStore.getState().go('squad'))
  await page.waitForTimeout(400)
  const rows = await page.locator('.dtable tbody tr').count()
  ok(rows >= 18, `the squad table renders the thin squad (${rows} rows)`)
  ok((await overflow()) <= 1, `Squad holds its shape at 18 men (${await overflow()}px)`)
  await page.screenshot({ path: (process.env.SHOTS_DIR ?? 'shots') + '/chaos-squad.png' }).catch(() => {})

  // ---- Fixtures: the 150-6 in a phone cell ----
  await page.evaluate(() => window.rugbyStore.getState().go('fixtures'))
  await page.waitForTimeout(400)
  const fixText = await page.locator('.content').innerText()
  ok(/150/.test(fixText), 'the 150-point scoreline is on the list')
  ok((await overflow()) <= 1, `Fixtures holds its shape around 150-6 (${await overflow()}px)`)
  await page.screenshot({ path: (process.env.SHOTS_DIR ?? 'shots') + '/chaos-fixtures.png' }).catch(() => {})

  // ---- Home: the dashboard over a wrecked club ----
  await page.evaluate(() => window.rugbyStore.getState().home())
  await page.waitForTimeout(400)
  ok((await overflow()) <= 1, `Home dashboard holds over the wreckage (${await overflow()}px)`)

  say(fails ? `\nCHAOS UI: ${fails} FAILURES` : '\nCHAOS UI PASSED: the screens hold whatever state the engine hands them')
} catch (e) {
  ok(false, `chaos UI leg threw: ${String(e).slice(0, 200)}`)
} finally {
  await browser.close()
  server.stop()
  done(fails)
}
