// Probe: retraining and the training load, on the screens (1.9.10).
//
// Owner (1.9.9): "players can ask to retrain in positions occasionally or the
// manager can advise this. But it isn't always successful." The engine side is
// tests/retrain.test.ts; this holds the screens: the load choice and last
// week's line on Training, the Retrain picker on a player's Attributes tab
// with the coaches' read of every shirt, the programme taking a plan place and
// showing its progress, and Stop giving the place back.
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
const home = () => page.evaluate(() => window.rugbyStore.getState().home())
const game = fn => page.evaluate(fn)

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Retrain Tester')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(600)

  // ---- the load: three choices, normal by default, Hard sticks ----
  await go('training')
  await page.waitForSelector('text=Training load')
  const sel = () => page.$$eval('main.content .club-pick.sel .cname', xs => xs.map(x => x.textContent.trim()))
  ok((await sel()).includes('Normal'), `normal is the load a career starts on (${(await sel()).join(', ')})`)
  await page.click('main.content .club-pick:has-text("Hard")')
  ok(await game(() => window.rugbyStore.getState().game.trainLoad) === 'hard', 'tapping Hard sets the load')
  ok((await sel()).includes('Hard'), 'and the screen shows it chosen')
  ok(await page.locator('text=Nobody is retraining.').count() === 1, 'the Retraining list starts empty')

  // ---- a player's page: the picker, the odds, the start ----
  const fl = await game(() => {
    const g = window.rugbyStore.getState().game
    const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad && q.pos === 'FL')
    p.alt = []
    return p.id
  })
  await go('player', fl)
  await page.click('main.content .tab-bar button:has-text("Attributes")')
  await page.waitForSelector('#retrain-to')
  const opts = await page.$$eval('#retrain-to option', os => os.map(o => ({ v: o.value, t: o.textContent })))
  ok(opts.length === 10 && opts.every(o => /·/.test(o.t)), `every other shirt is offered with the coaches' read (${opts.length})`)
  const wg = opts.find(o => o.v === 'WG'), n8 = opts.find(o => o.v === 'N8')
  ok(/long shot|Unlikely/i.test(wg?.t ?? ''), `a flanker at wing reads as a long shot ("${wg?.t}")`)
  ok(/Likely to work|either way/i.test(n8?.t ?? ''), `a flanker at number 8 reads as likely ("${n8?.t}")`)
  await page.selectOption('#retrain-to', 'N8')
  const placesBefore = await game(() => { const g = window.rugbyStore.getState().game; return (g.plans ?? []).length + (g.retrains ?? []).length })
  await page.click('.retrain-pick .btn.gold')
  await page.waitForSelector('.retrain-row')
  const r = await game(() => window.rugbyStore.getState().game.retrains?.[0])
  ok(r?.to === 'N8' && r.asked === false, `Start puts him on a retrain at number 8 (${JSON.stringify(r)})`)
  ok(/Learning Number 8|Learning N8|week 0 of 8/i.test(await page.$eval('.retrain-row', e => e.textContent)), 'his page shows the progress')

  // ---- Training lists it, and the plan places count it ----
  await home()
  await go('training')
  await page.waitForSelector('.retrain-row')
  ok(await page.$$eval('.retrain-row', rs => rs.length) === 1, 'Training lists the retrain')
  const placesAfter = await game(() => { const g = window.rugbyStore.getState().game; return (g.plans ?? []).length + (g.retrains ?? []).length })
  ok(placesAfter === placesBefore + 1, 'it holds a personal-plan place')
  await page.click('.retrain-row .btn.ghost')
  ok(await game(() => (window.rugbyStore.getState().game.retrains ?? []).length) === 0, 'Stop ends it and gives the place back')

  // ---- a week of training writes last week's line ----
  await game(() => {
    const s = window.rugbyStore.getState()
    s.game.trainLog = { season: s.game.season, week: s.game.week, load: 'hard', pts: 3, inj: 1 }
    s.touch()
  })
  await page.waitForTimeout(200)
  const line = await page.$eval('main.content .train-log', e => e.textContent).catch(() => '')
  ok(/Last week \(Hard\): 3 attribute gains · 1 hurt in training/.test(line), `last week's line reads ("${line}")`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(overflow <= 0, `no sideways scroll at 360px (${overflow}px over)`)
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

if (fails) { console.error(`\nRETRAIN UI PROBE: ${fails} failures`); process.exit(1) }
console.log('\nRETRAIN UI PROBE PASSED: the load, the picker, the progress and Stop all work on the screen')
done(0)
