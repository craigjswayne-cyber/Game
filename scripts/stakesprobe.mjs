// Probe: the preview names the stakes, and stoppages tell the story (20A+20E).
//
// The audit found the matchday preview never read the league table - it told
// you the matchup and the weather but not what the result DOES - and that a
// touchline decision or the interval left two-thirds of the screen empty.
//
// The walk: start a career, confirm a FRIENDLY preview stays silent about
// stakes (a friendly has none), then stage a league week with a live table
// through the store handle and hold the preview to account. Kick off, skip
// towards the interval answering any touchline calls on the way, and check
// half-time now shows the story so far and the table slice.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4189, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

try {
  await page.goto('http://localhost:4189/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Stakes')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  // week 1 is a friendly: a friendly has no stakes and the card must know it
  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(400)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })
  await page.click('.tab-bar >> text=Briefing')
  await page.waitForTimeout(250)
  ok((await page.locator('text=The Stakes').count()) === 0, 'a friendly preview stays quiet about stakes')

  // stage a league Saturday with a table worth reading: friendlies played,
  // week jumped to the first league round, table rows given real numbers
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    for (const f of g.fixtures) {
      if (f.compId === 'fr' && (f.homeId === g.userClubId || f.awayId === g.userClubId) && !f.played) {
        f.played = true; f.tableApplied = true
      }
    }
    const league = g.comps[g.clubs[g.userClubId].leagueId]
    const rows = league.table
    rows.forEach((r, i) => { r.p = 3; r.pts = Math.max(0, 12 - i) })
    const meIdx = rows.findIndex(r => r.teamId === g.userClubId)
    // park the user mid-table so the card has an above AND a below to name
    const tmp = rows[meIdx]; rows[meIdx] = rows[3]; rows[3] = tmp
    rows.forEach((r, i) => { r.pts = Math.max(0, 12 - i) })
    const next = g.fixtures.filter(f => !f.played && f.compId === league.id &&
      (f.homeId === g.userClubId || f.awayId === g.userClubId)).sort((a, b) => a.week - b.week)[0]
    g.week = next.week
    g.day = 5
    st.touch()
  })
  // the preview reads the week's fixture from state, so the staged league
  // Saturday re-renders in place - MatchDay is full-screen, there is no rail
  await page.waitForTimeout(600)
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })
  await page.click('.tab-bar >> text=Briefing')
  await page.waitForTimeout(250)
  const stakes = page.locator('text=The Stakes')
  ok(await stakes.count() > 0, 'a league preview names the stakes')
  const card = await page.locator('.card', { hasText: 'The Stakes' }).innerText()
  say(`  the card reads: "${card.replace(/\s+/g, ' ').slice(0, 140)}"`)
  ok(/\d+ points/.test(card), 'with the real points total')
  ok(/above by \d+|clear of/.test(card), 'and the gap to the side above (or the cushion below)')

  // kick off and run to the interval: the stoppage tells the story
  await page.locator('text=Kick Off ▸').first().click()
  const talk = page.locator('.talk-modal .speech-tile')
  await talk.first().waitFor({ timeout: 5000 })
  await talk.first().click()
  await page.waitForTimeout(300)
  const gold = page.locator('.modal .btn.gold')
  if (await gold.count()) await gold.click()
  let story = false
  for (let i = 0; i < 80; i++) {
    if (await page.locator('text=The Story So Far').count()) { story = true; break }
    // a touchline call pauses the skip: take the points and move on
    const call = page.locator('.panel-area .speech-tile, .panel-area .dec-tile')
    if (await call.count()) { await call.first().click(); await page.waitForTimeout(300); continue }
    const skip = page.locator('button >> text=Skip ▸')
    if (await skip.count()) { await skip.first().click().catch(() => {}) }
    await page.waitForTimeout(400)
  }
  ok(story, 'a stoppage shows The Story So Far')
  if (story) {
    ok(await page.locator('text=As It Stood At Kick-Off').count() > 0,
      'and a league afternoon shows the table around you')
  }
} catch (e) {
  say(`FAIL  ${e.message}`)
  fails++
} finally {
  await browser.close()
  server.stop()
}

say(fails ? `\nSTAKES PROBE FAILED (${fails})` : '\nSTAKES PROBE PASSED: every league Saturday says what it is worth')
done(fails)
