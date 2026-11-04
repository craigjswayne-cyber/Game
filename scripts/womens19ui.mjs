// Probe: the 1.9 screens in a women's career (owner, 4 Nov 2026: "Can I check
// all feedback and changes across 1.9 have all been applied to the womens
// games").
//
// Every 1.9.7 to 1.9.10 harness (visitback, retrainui, loanlistui, loannameui)
// starts a men's career. This starts a women's one and walks the same screens:
// the ability column on Team, the transfer filters with several attributes
// kept over Back, a player's By position ratings and the Retrain picker, the
// retrain on Training, the load and last week's line. Then it reads the lines
// that needed a women's version in French, where they differ (the engine side,
// in all six languages, is scripts/womens19probe.ts).
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const server = await startPreview(0, 3000)

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 360, height: 740 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

const go = (s, p) => page.evaluate(([s, p]) => window.rugbyStore.getState().go(s, p), [s, p])
const back = () => page.evaluate(() => window.rugbyStore.getState().back())
const home = () => page.evaluate(() => window.rugbyStore.getState().home())
const game = fn => page.evaluate(fn)
const screen = () => page.evaluate(() => window.rugbyStore.getState().nav.at(-1)?.screen)

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('.new-career-w')
  await page.click('.new-career-w')
  await page.waitForSelector("text=English Women's Premier Division")
  await page.click("text=English Women's Premier Division")
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Loughboro')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Womens Tester')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-box >> text=Got it').catch(() => {})
  await page.click('.tut-close .btn').catch(() => {})
  await page.waitForTimeout(600)
  ok(await game(() => window.rugbyStore.getState().game.gender) === 'w', 'a women\'s career')

  // ---- 1.9.7: Team > General Info carries the ability column ----
  await go('squad')
  await page.click('main.content .tab-bar button:has-text("General Info")')
  await page.waitForSelector('main.content thead')
  const heads = await page.$$eval('main.content thead th', hs => hs.map(h => h.textContent.trim()))
  ok(heads.includes('Abl'), `General Info has the ability column (${heads.join(' | ')})`)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(over <= 0, `no sideways scroll at 360px (${over}px over)`)

  // ---- 1.9.7 and 1.9.9: transfer filters with attributes, kept over Back ----
  await go('transfers')
  await page.waitForSelector('.filter-btn')
  await page.click('.filter-btn')
  await page.waitForSelector('#fs-pos')
  await page.selectOption('#fs-pos', 'FL')
  await page.selectOption('#fs-attr-min', '50')
  await page.locator('fieldset.fs-attr-group input[type=checkbox]').first().check()
  await page.click('.filter-sheet .btn.gold')
  await page.waitForTimeout(400)
  const row = 'main.content tbody tr'
  const rows = await page.$$(row)
  ok(rows.length > 0, `the attribute search finds women\'s players (${rows.length} rows)`)
  if (rows.length) {
    await page.click(row)
    await page.waitForTimeout(400)
    ok(await screen() === 'player', 'a row opens the player')
    await back()
    await page.waitForTimeout(400)
    await page.click('.filter-btn')
    await page.waitForSelector('#fs-pos')
    ok(await page.$eval('#fs-pos', el => el.value) === 'FL', 'Back keeps the position filter')
    ok(await page.$eval('#fs-attr-min', el => el.value) === '50', 'and the attribute minimum')
    ok(await page.locator('fieldset.fs-attr-group input[type=checkbox]').first().isChecked(), 'and the ticked attribute')
    await page.click('.filter-sheet .btn.gold')
  }

  // ---- 1.9.9 and 1.9.10: By position and the Retrain picker ----
  await home()
  const fl = await game(() => {
    const g = window.rugbyStore.getState().game
    const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad && q.pos === 'FL')
    p.alt = []
    return p.id
  })
  await go('player', fl)
  await page.click('main.content .tab-bar button:has-text("Attributes")')
  await page.waitForSelector('#retrain-to')
  ok(await page.locator('text=By position').count() === 1, 'the Attributes tab shows By position')
  await page.selectOption('#retrain-to', 'N8')
  await page.click('.retrain-pick .btn.gold')
  await page.waitForSelector('.retrain-row')
  ok(await game(() => window.rugbyStore.getState().game.retrains?.[0]?.to) === 'N8', 'Start puts her on a retrain at number 8')

  // ---- 1.9.10: Training lists it, and the load sticks ----
  await home()
  await go('training')
  await page.waitForSelector('.retrain-row')
  ok(await page.$$eval('.retrain-row', rs => rs.length) === 1, 'Training lists the retrain')
  await page.click('main.content .club-pick:has-text("Hard")')
  ok(await game(() => window.rugbyStore.getState().game.trainLoad) === 'hard', 'the Hard load sets')

  // ---- the women's lines, in French ----
  await page.evaluate(() => window.rugbyStore.getState().setLang('fr'))
  await page.waitForFunction(() => document.documentElement.lang === 'fr', null, { timeout: 10000 })
  await game(() => {
    const s = window.rugbyStore.getState()
    s.game.trainLog = { season: s.game.season, week: s.game.week, load: 'hard', pts: 3, inj: 2 }
    s.touch()
  })
  await page.waitForTimeout(300)
  const line = await page.$eval('main.content .train-log', e => e.textContent).catch(() => '')
  ok(/2 blessées/.test(line), `last week's line is feminine in French ("${line}")`)
  await go('transfers')
  await page.waitForSelector('.filter-btn')
  await page.click('.filter-btn')
  await page.waitForSelector('.fs-attrs')
  const hint = await page.$eval('.fs-attrs .meta', e => e.textContent)
  ok(/^Une joueuse/.test(hint), `the attribute hint speaks of a joueuse ("${hint}")`)
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

if (fails) { console.error(`\nWOMENS 1.9 UI PROBE: ${fails} failures`); process.exit(1) }
console.log('\nWOMENS 1.9 UI PROBE PASSED: the 1.9 screens work in a women\'s career, and read for one')
done(0)
