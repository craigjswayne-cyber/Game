// Probe: the season plan on Home (1.9.14, preseasonplan.ts). Player feedback:
// "Be good have a preseason focus choose how you will play that season &
// practice set play". In pre-season week 1 the card is on Home; choosing an
// attack, a defence, a lineout and scrum call, Set-Piece Work and a training
// focus and pressing Set writes each of them where its own screen reads it;
// the card folds to one line with Change; and it is gone once the season starts.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const server = await startPreview(0, 3000)
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
const G = () => page.evaluate(() => { const g = window.rugbyStore.getState().game; const c = g.clubs[g.userClubId]; return { week: g.week, plan: g.preplan, atk: c.tactic.atkStyle, def: c.tactic.defStyle, lo: c.tactic.lineoutCall, sc: c.tactic.scrumCall, training: g.training, prep: g.matchPrep } })

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate(() => window.rugbyStore.getState().start('leicester', 'Season Plan'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  await page.evaluate(() => window.rugbyStore.getState().go('home'))
  const card = page.locator('.preplan[data-preplan="open"]')
  await card.waitFor({ timeout: 5000 })
  ok(await card.count() === 1, `pre-season week ${(await G()).week}: the season plan is on Home`)
  await card.locator('[data-group="atk"] [data-opt="width"]').click()
  await card.locator('[data-group="def"] [data-opt="blitz"]').click()
  const lo = await card.locator('[data-group="lineout"] .pp-opt').nth(2).getAttribute('data-opt')
  const sc = await card.locator('[data-group="scrum"] .pp-opt').last().getAttribute('data-opt')
  await card.locator(`[data-group="lineout"] [data-opt="${lo}"]`).click()
  await card.locator(`[data-group="scrum"] [data-opt="${sc}"]`).click()
  await card.locator('.pp-check input').check()
  await card.locator('[data-group="focus"] [data-opt="lineout"]').click()
  const small = await card.locator('.pp-opt').evaluateAll(els => els.filter(e => e.getBoundingClientRect().height < 44).length)
  ok(small === 0, 'every choice is at least 44px tall')
  await page.screenshot({ path: process.env.SHOT ?? '/tmp/preplan.png', fullPage: false })
  await card.locator('[data-preplan-set]').click()
  await page.waitForTimeout(300)
  const g = await G()
  ok(g.atk === 'width' && g.def === 'blitz', `the styles go to Tactics (${g.atk}, ${g.def})`)
  ok(g.lo === lo && g.sc === sc, `the calls go to the playbook (${g.lo}, ${g.sc})`)
  ok(g.training === 'lineout' && g.prep === 'setpiece', `the focus goes to Training and Set-Piece Work is on (${g.training}, ${g.prep})`)
  ok(g.plan?.season != null, 'the plan is kept for this season')
  ok(await page.locator('.preplan[data-preplan="set"]').count() === 1, 'the card folds to one line')
  await page.locator('.preplan[data-preplan="set"] .btn').click()
  ok(await page.locator('.preplan[data-preplan="open"] [data-group="atk"] [data-opt="width"].sel').count() === 1, 'Change opens it again on the plan as set')
  // into the season: the card goes
  await page.evaluate(() => { const st = window.rugbyStore.getState(); st.game.week = 8; window.rugbyStore.setState({ game: { ...st.game } }) })
  await page.waitForTimeout(300)
  ok(await page.locator('.preplan').count() === 0, 'once the season is under way the card is gone')
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close(); server.stop()
}
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
if (fails) { console.error(`\nPRE-SEASON PLAN PROBE: ${fails} failures`); process.exit(1) }
console.log('\nPRE-SEASON PLAN PROBE PASSED: one card sets the styles, the calls and the focus, and steps aside for the season')
done(0)
