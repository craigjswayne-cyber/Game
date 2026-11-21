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
  await page.waitForTimeout(400)
  ok(await page.locator('.preplan').count() === 0, 'the season plan is not on Home (owner: a tab of Training and Staff)')
  await page.evaluate(() => window.rugbyStore.getState().go('training'))
  await page.locator('[data-tab="plan"]').click({ timeout: 5000 })
  const card = page.locator('.preplan[data-preplan="open"]')
  await card.waitFor({ timeout: 5000 })
  ok(await card.count() === 1, `pre-season week ${(await G()).week}: the Season plan tab is on Training and Staff`)
  ok(await card.locator('[data-preplan-set]').isDisabled(), 'Set the plan waits for both answers')
  await card.locator('[data-group="style"] [data-opt="backs"]').click()
  await card.locator('[data-group="work"] [data-opt="setpiece"]').click()
  ok(await card.locator('.pp-opt').count() === 6, 'two questions, three answers each')
  const small = await card.locator('.pp-opt').evaluateAll(els => els.filter(e => e.getBoundingClientRect().height < 44).length)
  ok(small === 0, 'every answer is at least 44px tall')
  await page.screenshot({ path: process.env.SHOT ?? '/tmp/preplan.png', fullPage: false })
  await card.locator('[data-preplan-set]').click()
  await page.waitForTimeout(300)
  const g = await G()
  ok(g.atk === 'width' && g.def === 'drift', `Backs sets the styles on Tactics (${g.atk}, ${g.def})`)
  ok(g.training === 'scrum' && g.prep === 'setpiece', `Set pieces sets the training focus and Set-Piece Work (${g.training}, ${g.prep})`)
  ok(g.plan?.season != null, 'the plan is kept for this season')
  ok(await page.locator('.preplan[data-preplan="set"]').count() === 1, 'the card folds to one line')
  await page.locator('.preplan[data-preplan="set"] .btn').click()
  ok(await page.locator('.preplan[data-preplan="open"] [data-group="style"] [data-opt="backs"].sel').count() === 1, 'Change opens it again on the plan as set')
  // the first league match played: the tab goes
  await page.evaluate(() => { const st = window.rugbyStore.getState(); const g = st.game; const lg = g.clubs[g.userClubId].leagueId; const f = g.fixtures.find(x => x.compId === lg && (x.homeId === g.userClubId || x.awayId === g.userClubId)); f.played = true; window.rugbyStore.setState({ game: { ...g } }) })
  await page.waitForTimeout(300)
  ok(await page.locator('[data-tab="plan"]').count() === 0 && await page.locator('.preplan').count() === 0, 'once the first league match is played the tab is gone')
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close(); server.stop()
}
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
if (fails) { console.error(`\nPRE-SEASON PLAN PROBE: ${fails} failures`); process.exit(1) }
console.log('\nPRE-SEASON PLAN PROBE PASSED: two questions set the styles and the focus, and step aside for the season')
done(0)
