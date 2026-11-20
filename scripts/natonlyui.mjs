// Probe: the national coach with no club (1.9.15). Owner: "ive picked my
// squad but i cant select my xv and subs for my game in international mode".
// The out-of-work guard in App.tsx sent every desk screen, the match day
// included, back to Home, so a nation-only coach never saw the Test sheet.
// Also: the Job Centre leaves the bottom bar for a national coach, the
// coaches' squad covers every shirt, the announcement draws the social
// media's reaction, and a player's page carries no fees or wages.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const server = await startPreview(0, 2500)
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
const S = (f, a) => page.evaluate(f, a)

const walk = until => S(async src => {
  const stop = new Function('g', src)
  for (let guard = 0; guard < 20000; guard++) {
    const st = window.rugbyStore.getState(); const g = st.game
    const screen = st.nav[st.nav.length - 1]?.screen
    if (stop(g) && !st.liveMatch && screen !== 'matchday') return g.week
    if (g.natConfidence != null) g.natConfidence = Math.max(g.natConfidence, 60)
    for (const n of g.news) n.read = true
    for (const q of g.press) q.answered = true
    window.rugbyStore.setState({ lastAdvanceAt: 0 })
    if (st.liveMatch || screen === 'matchday') st.instantResult()
    else st.continueWeek()
    await new Promise(r => setTimeout(r, 5))
  }
  return -1
}, until)

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await S(() => window.rugbyStore.getState().start('leicester', 'NatOnly'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  await S(() => { const st = window.rugbyStore.getState(); const g = st.game
    g.natTeam = 'ENG'; g.natConfidence = 60; g.natRecord = { m: 0, w: 0, d: 0, l: 0 }; st.resign(); st.touch() })
  ok(await S(() => window.rugbyStore.getState().game.unemployed), 'the coach has no club, only England')
  await S(() => { const st = window.rugbyStore.getState(); st.go('home'); st.touch() }); await page.waitForTimeout(300)
  ok(await page.locator('.bottom-nav button', { hasText: /^Jobs/ }).count() === 0, 'no Job Centre button on the bottom bar')
  ok(await page.locator('.bottom-nav button', { hasText: /Country/ }).count() === 1, 'the Country button is there')

  // the camp opens the week before its window, empty, and the week waits for
  // the coach to name it (1.9.15): stop there, as he would
  const tw = await walk('return (g.natSquads?.[g.natTeam]?.length ?? -1) === 0')
  ok(tw > 0, `the camp opens, empty, for the coach to name (week ${tw})`)
  await S(() => { const st = window.rugbyStore.getState(); st.go('country'); st.touch() }); await page.waitForTimeout(400)
  await page.locator('button:has-text("Take the coaches")').click()
  await page.waitForTimeout(300)
  const shape = await S(() => { const g = window.rugbyStore.getState().game
    const by = {}; for (const id of g.natSquads[g.natTeam] ?? []) { const p = g.players[id]; by[p.pos] = (by[p.pos] ?? 0) + 1 } return by })
  ok(['LP', 'HK', 'TP', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB'].every(pos => (shape[pos] ?? 0) >= 2 || (pos === 'N8' && shape[pos] >= 1)), `the coaches' squad covers every shirt (${JSON.stringify(shape)})`)
  // no touch from here: the call-up itself has to bring Announce up
  await page.locator('[data-nc-announce]').click({ timeout: 4000 })
  await page.waitForSelector('[data-nc-social]', { timeout: 3000 })
  ok(await page.locator('[data-nc-social] .nc-post').count() >= 2, 'the announcement draws social media posts')
  await page.locator('[data-nc-reveal] .btn.gold').click(); await page.waitForTimeout(300)
  const pid = await S(() => { const g = window.rugbyStore.getState().game; return g.natSquads[g.natTeam][0] })
  await S(id => { const st = window.rugbyStore.getState(); st.go('player', id); st.touch() }, pid); await page.waitForTimeout(400)
  ok(await page.locator('.chips .chip', { hasText: /^Value/ }).count() === 0, 'a player page shows no value for a nation-only coach')
  ok(await page.locator('.chips .chip', { hasText: /^Wage/ }).count() === 0, 'and no wage')

  for (let i = 0; i < 40 && !(await page.locator('text=YOUR TEST XV').count()); i++) {
    await S(() => { const st = window.rugbyStore.getState(); const g = st.game
      for (const n of g.news) n.read = true; for (const q of g.press) q.answered = true
      if (g.natWin?.event && !g.natWin.event.answer) g.natWin.event.answer = 'b'
      window.rugbyStore.setState({ lastAdvanceAt: 0 }); st.continueWeek() })
    await page.waitForTimeout(350)
    for (const b of ['On to the Week', 'Next Story', 'Matchday']) if (await page.locator(`text="${b}"`).count()) { await page.click(`text="${b}"`).catch(() => {}); await page.waitForTimeout(250) }
  }
  ok(await page.locator('text=YOUR TEST XV').count() > 0, 'the Test sheet opens for a coach with no club')
  const rows = page.locator('table.dtable').first().locator('tr')
  ok(await rows.count() === 15, 'fifteen shirts to pick')
  await rows.nth(0).click(); await page.waitForTimeout(150)
  await rows.nth(0).click(); await page.waitForTimeout(300)
  const picks = page.locator('.modal tr')
  ok(await picks.count() >= 23, `the picker lists the squad (${await picks.count()})`)
  const before = await S(() => window.rugbyStore.getState().game.natLineup.lineup[0])
  const target = await S(b => { const g = window.rugbyStore.getState().game; return (g.natSquads[g.natTeam] ?? []).find(id => id !== b && !g.natLineup.lineup.includes(id)) }, before)
  const tname = await S(id => window.rugbyStore.getState().game.players[id].name, target)
  await page.locator('.modal tr', { hasText: tname }).first().click(); await page.waitForTimeout(300)
  ok(await S(() => window.rugbyStore.getState().game.natLineup.lineup[0]) === target, 'a pick goes into the shirt')
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 200)}`)
} finally {
  await browser.close(); server.stop()
}
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
if (fails) { console.error(`\nNATION-ONLY PROBE: ${fails} failures`); process.exit(1) }
console.log('\nNATION-ONLY PROBE PASSED: a coach with only a country picks the Test side, and the club desk stays out of the way')
done(0)
