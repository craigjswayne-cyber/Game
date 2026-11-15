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

  // ---- the owner's feature round ----
  // 1. Arm round the shoulder, beside praise and a quiet word, inside 320px
  const own = await game(() => {
    const g = window.rugbyStore.getState().game
    const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad && !q.loanFrom)
    p.form = 5.5; p.morale = 5; p.lastChatWk = undefined; g.chatsUsed = 0
    return p.id
  })
  await go('player', own)
  await page.waitForTimeout(400)
  ok(await page.locator('main.content button:has-text("Arm round the shoulder")').count() === 1, 'the office offers an arm round the shoulder')
  await page.setViewportSize({ width: 320, height: 640 })
  await page.waitForTimeout(300)
  const row = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('main.content button')].filter(b => /Praise|A quiet word|Arm round the shoulder/.test(b.textContent))
    const r = bs.map(b => b.getBoundingClientRect())
    return { n: r.length, oneRow: r.every(x => Math.abs(x.top - r[0].top) < 2), inside: r.every(x => x.right <= window.innerWidth + 0.5) }
  })
  ok(row.n === 3 && row.inside, `the three office buttons fit a 320px screen (${JSON.stringify(row)})`)
  await page.setViewportSize({ width: 390, height: 746 })
  await page.locator('main.content button:has-text("Arm round the shoulder")').click()
  await page.waitForTimeout(300)
  ok(await game(() => window.rugbyStore.getState().game.chatsUsed) === 1, 'an arm round the shoulder uses one of the week\'s conversations')

  // 2. personality and trait filters
  await go('transfers')
  await page.waitForSelector('.filter-btn')
  await page.click('.filter-btn')
  await page.waitForSelector('#fs-pers')
  ok(await page.$$eval('#fs-pers option', os => os.length) === 7, 'the filter sheet offers every personality')
  ok(await page.$$eval('#fs-trait option', os => os.length) === 9, 'and every trait')
  await page.selectOption('#fs-pers', 'Leader')
  ok(await page.locator('.filter-sheet .meta:has-text("scouts know well enough")').count() === 1, 'and says it only finds players the scouts know')
  await page.click('.filter-sheet .btn.gold')

  // 3. your season in the 22 on the Stats tab
  await game(() => { const s = window.rugbyStore.getState(); s.game.in22 = { season: s.game.season, v: 12, p: 30, ov: 9, op: 14, m: 3 }; s.touch() })
  await go('fixtures', 'stats')
  await page.waitForTimeout(400)
  const st22 = await text()
  ok(/Your Season in the 22/.test(st22) && /2\.5/.test(st22) && /1\.6/.test(st22), 'the Stats tab shows your season in the 22 against your opponents')

  // 5. the physio's report
  await game(() => {
    const g = window.rugbyStore.getState().game
    const ps = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(q => q && !q.acad && !q.injury).slice(0, 4)
    for (const p of ps) { p.cond = 50; p.rust = 2 }
    g.trainLoad = 'normal'
    window.rugbyStore.getState().touch()
  })
  await go('medical')
  await page.waitForTimeout(400)
  ok(await page.locator('[data-testid="physio-report"]').count() === 1, 'Medical carries the physio report')
  const setBtn = page.locator('[data-testid="physio-report"] button:has-text("Set training to")')
  ok(await setBtn.count() === 1, 'with the load the physio recommends')
  await setBtn.click()
  await page.waitForTimeout(200)
  ok(await game(() => window.rugbyStore.getState().game.trainLoad) === 'light', 'and one tap sets it')

  // 6. what the fans think
  await game(() => { const s = window.rugbyStore.getState(); s.game.fanWhy = { season: s.game.season, results: 6, squad: -3, club: -2, manager: 1 }; s.touch() })
  await go('finances')
  await page.waitForTimeout(300)
  await page.locator('main.content .tab-bar button:has-text("The Board")').click()
  await page.waitForTimeout(300)
  const fans = await page.$eval('[data-testid="fan-sentiment"]', e => e.innerText).catch(() => '')
  ok(/Results\s*\+6/.test(fans) && /Signings and the squad\s*−3/.test(fans), `the Board tab breaks down what the fans think ("${fans.replace(/\s+/g, ' ').slice(0, 120)}")`)
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
console.log('\nUI 1.9.13 PROBE PASSED: both owner\'s rounds work on screen')
done(0)
