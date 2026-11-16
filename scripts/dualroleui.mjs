// Probe: one manager, two jobs (1.9.14). Player feedback from a manager with
// a club and a country: "Couldn't see training for my international team,
// couldn't edit the squad, match week for club got muddled with
// international". Walks a Leicester career with the England job to a week
// holding both a Test and a club match, then checks: the Home hero is the
// Test and names the assistant's club match under it; the Squad screen has a
// Club | Country switch whose Country side is the window squad with call-up
// and drop; Training & Staff has a Country tab with the camp focus, and a
// choice is stored for this window.
// FA_SHOT=<dir> also writes screenshots.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
const OUT = process.env.FA_SHOT
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const errors = []
const server = await startPreview(0, 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
await page.goto(`${server.origin}/`)
await page.waitForSelector('text=RUGBY', { timeout: 20000 })
await page.evaluate(() => window.rugbyStore.getState().start('leicester', 'Intl'))
await page.waitForTimeout(700)
await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
const info = await page.evaluate(() => {
  const st = window.rugbyStore.getState(); const g = st.game
  g.natTeam = 'ENG'; g.natConfidence = 60; g.natRecord = { m: 0, w: 0, d: 0, l: 0 }
  const club = g.userClubId
  const tests = g.fixtures.filter(f => f.homeId === 'ENG' || f.awayId === 'ENG').map(f => f.week).sort((a, b) => a - b)
  const clubWeeks = new Set(g.fixtures.filter(f => f.homeId === club || f.awayId === club).map(f => f.week))
  const both = tests.filter(w => clubWeeks.has(w))
  return { tests, both, week: g.week }
})
ok(info.both.length > 0, `the calendar holds weeks with a Test and a club match (${info.both.join(', ')})`)
// walk to the first Test week
const reached = await page.evaluate(async () => {
  for (let guard = 0; guard < 20000; guard++) {
    const st = window.rugbyStore.getState(); const g = st.game
    if (g.fixtures.some(f => !f.played && f.week === g.week && (f.homeId === 'ENG' || f.awayId === 'ENG')) && g.fixtures.some(f => !f.played && f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))) {
      const screen = st.nav[st.nav.length - 1]?.screen
      if (screen === 'home' || !st.liveMatch) return g.week
    }
    const club = g.clubs[g.userClubId]; if (club) club.boardConfidence = 80
    for (const o of g.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
    for (const n of g.news) { n.read = true }
    for (const q of g.press) q.answered = true
    const camp = g.natSquads?.[g.natTeam]
    if (camp && camp.length < 23) {
      const spare = Object.values(g.players).filter(p => p.nat === g.natTeam && p.clubId && !p.injury && !p.natSquad).sort((a, b) => b.ca - a.ca).slice(0, 23 - camp.length)
      for (const p of spare) { camp.push(p.id); p.natSquad = true }
    }
    window.rugbyStore.setState({ lastAdvanceAt: 0 })
    const screen = st.nav[st.nav.length - 1]?.screen
    if (st.liveMatch || screen === 'matchday') st.instantResult()
    else st.continueWeek()
    await new Promise(r => setTimeout(r, 5))
  }
  return -1
})
ok(reached > 0, `the walk reaches week ${reached}, with both`)
await page.evaluate(() => { const st = window.rugbyStore.getState(); st.go('home'); st.touch() })
await page.waitForTimeout(600)
const wk = await page.evaluate(() => { const g = window.rugbyStore.getState().game; const c = g.userClubId; return { week: g.week, club: g.fixtures.filter(f => f.week === g.week && (f.homeId === c || f.awayId === c)).map(f => f.homeId + ' v ' + f.awayId), test: g.fixtures.filter(f => f.week === g.week && (f.homeId === 'ENG' || f.awayId === 'ENG')).map(f => f.homeId + ' v ' + f.awayId) } })
ok(wk.club.length === 1 && wk.test.length === 1, `week ${wk.week}: ${wk.club[0]} and ${wk.test[0]}`)
const hero = page.locator('[data-desk-test]')
ok(await hero.count() === 1, 'the Home hero is the Test')
ok((await hero.textContent()).includes('England'), 'and it names England')
ok(await page.locator('[data-desk-assistant]').count() === 1, 'the club match is one line under it, saying the assistant has it')
ok(await page.locator('text=Assistant\'s match').count() === 0, 'and the club match is no longer in the hero place')
if (OUT) await page.screenshot({ path: OUT + '/dual_home.png' })
await page.evaluate(() => window.rugbyStore.getState().go('squad')); await page.waitForTimeout(500)
ok(await page.locator('[data-side-switch] [data-side]').count() === 2, 'the Squad screen has a Club | Country switch')
await page.locator('[data-side="country"]').click()
await page.waitForTimeout(300)
const drops = await page.locator('button:has-text("Drop")').count()
ok(drops >= 23, `the Country side is the window squad, with Drop on each (${drops})`)
ok(await page.locator('button:has-text("Call up")').count() > 0, 'and Call up for the next names in')
if (OUT) await page.screenshot({ path: OUT + '/dual_squad.png' })
await page.locator('[data-side="club"]').click(); await page.waitForTimeout(200)
ok(await page.locator('.tab-bar button:has-text("Selection")').count() === 1, 'and Club takes it back to the club squad')
await page.evaluate(() => window.rugbyStore.getState().go('training')); await page.waitForTimeout(500)
ok(await page.locator('[data-tab="camp"]').count() === 1, 'Training & Staff has a Country tab')
await page.locator('[data-tab="camp"]').click(); await page.waitForTimeout(200)
ok(await page.locator('[data-camp="open"] [data-camp-focus]').count() === 3, 'with the camp open, three focuses')
await page.locator('[data-camp-focus="setpiece"]').click(); await page.waitForTimeout(200)
const camp = await page.evaluate(() => window.rugbyStore.getState().game.natCamp)
ok(camp?.focus === 'setpiece' && camp?.nat === 'ENG', `the choice is stored for this window (${JSON.stringify(camp)})`)
ok(await page.locator('[data-camp-focus="setpiece"][aria-checked="true"]').count() === 1, 'and shown as chosen')
if (OUT) await page.screenshot({ path: OUT + '/dual_camp.png' })
await browser.close(); server.stop()
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
if (fails) { console.error(`\nDUAL ROLE UI PROBE: ${fails} failures`); process.exit(1) }
console.log('\nDUAL ROLE UI PROBE PASSED: a Test week puts the Test first, and the country has its squad and its camp where the club has them')
done(0)
