// Probe: the owner's 1.9.13 round, on the screens.
//
//   - a player on loan TO you is not offered Send on loan, Send down or
//     contract talks ("ive taken someone on loan but I can also send that
//     player then on loan again")
//   - the loan sheet says whether the deal has an option to buy
//   - Fixtures has a Stats tab beside the table, and the Team of the Week
//     points to it ("in its own section maybe in a tab to the right of
//     fixtures, league table")
//   - every result on Week Results names its Player of the Match ("not sure
//     how to see other game motm")
//   - the Job Centre badge on World clears once the Job Centre is opened
//     ("fix the job notification coming up all the time")
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const server = await startPreview(0, 3000)

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 746 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

const go = (s, p) => page.evaluate(([s, p]) => window.rugbyStore.getState().go(s, p), [s, p])
const game = fn => page.evaluate(fn)
const text = () => page.evaluate(() => document.querySelector('main.content')?.innerText ?? '')

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate(() => window.rugbyStore.getState().start('harlequins', 'Round 1913'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})

  // ---- Stats tab ----
  await go('fixtures', 'stats')
  await page.waitForTimeout(400)
  const tabs = await page.$$eval('main.content .tab-bar button', bs => bs.map(b => b.textContent.trim()))
  ok(tabs.join('|') === 'Fixtures|Table|Stats', `Fixtures has Fixtures | Table | Stats (${tabs.join(' | ')})`)
  const active = await page.$eval('main.content .tab-bar button.active', b => b.textContent.trim())
  ok(active === 'Stats', 'the Team of the Week door opens it on Stats')
  const st = await text()
  ok(/No matches played yet this season\./.test(st), 'before a ball is kicked the Stats tab says so, not a stack of empty headings')
  await go('dreamteam')
  await page.waitForTimeout(300)
  ok(await page.locator('main.content button:has-text("Season stats")').count() === 1, 'the Team of the Week has a Season stats button')
  ok(!/Top Tacklers/.test(await text()), 'and no longer carries the leaderboards itself')

  // ---- Week Results: every result's Player of the Match ----
  await game(() => {
    const g = window.rugbyStore.getState().game
    // a played round, staged: three league results with a Player of the Match each
    const fx = g.fixtures.filter(f => f.compId === g.clubs[g.userClubId].leagueId).slice(0, 3)
    const pid = g.clubs[fx[0].homeId].players[0]
    for (const f of fx) if (!f.played) { f.played = true; f.homeScore = 20; f.awayScore = 13; f.motm = pid; f.week = g.week }
  })
  const at = await game(() => { const f = window.rugbyStore.getState().game.fixtures.find(x => x.played && x.motm != null); return `${f.compId}:${f.week}` })
  await go('results', at)
  await page.waitForTimeout(400)
  ok(await page.locator('main.content .rs-motm').count() > 0, `Week Results names a Player of the Match under a result (${at})`)

  // ---- the Job Centre badge ----
  await game(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const ids = Object.keys(g.clubs).filter(id => id !== g.userClubId).slice(0, 3)
    g.vacancies = ids.map(clubId => ({ clubId, week: g.week }))
    st.touch()
  })
  await go('home')
  await page.waitForTimeout(300)
  const dot = () => page.$$eval('.bottom-nav .dot', ds => ds.map(d => d.textContent.trim()))
  const before = await dot()
  ok(before.includes('3'), `three new vacancies light the World badge (${before.join(',')})`)
  await go('jobs')
  await page.waitForTimeout(300)
  await go('home')
  await page.waitForTimeout(300)
  const after = await dot()
  ok(!after.includes('3'), `once the Job Centre has been opened the badge goes (${after.join(',') || 'none'})`)

  // ---- a player on loan to you ----
  const loanee = await game(() => {
    const g = window.rugbyStore.getState().game
    const other = Object.values(g.clubs).find(c => c.id !== g.userClubId && g.clubs[c.id])
    const p = other.players.map(id => g.players[id]).find(q => q && !q.acad && q.age <= 22)
    other.players = other.players.filter(id => id !== p.id)
    g.clubs[g.userClubId].players.push(p.id)
    p.loanFrom = other.id
    p.clubId = g.userClubId
    p.loanOpt = false
    p.loanApps = 2
    p.joinedAt = g.season * 48 + g.week
    window.rugbyStore.getState().touch()
    return p.id
  })
  await go('player', loanee)
  await page.waitForTimeout(400)
  const pg = await text()
  ok(!/Send on loan/i.test(pg), 'a player on loan to you is not offered Send on loan')
  ok(!/Send down/i.test(pg), 'nor Send down')
  ok(!/Open contract talks/i.test(pg), 'nor contract talks')
  ok(/No option to buy in this loan/.test(pg), 'his loan card says the deal has no option to buy')
  ok(/Games for you: 2\/8/.test(pg), 'and counts his games towards earning one')
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

if (fails) { console.error(`\nUI 1.9.13 PROBE: ${fails} failures`); process.exit(1) }
console.log('\nUI 1.9.13 PROBE PASSED: loanee buttons, the Stats tab, every MOTM and the Job Centre badge work on screen')
done(0)
