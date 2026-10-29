// Probe: Back returns to the list as you left it.
//
// Player report, 1.9.5 (France): filters set on the transfer centre, a player
// opened, Back, and the filters were gone; on Team, Back from a player always
// landed on the team sheet whatever tab had been open. Back pops the nav stack
// and the screen underneath used to mount from scratch. visitState.ts keeps
// each screen's controls and scroll against its own nav entry, so Back finds
// them and a fresh visit from the menu still starts clean.
//
// Also held here, from the same report: the ability column on Team > General
// Info, and the shortlist and agency file offered for a free agent.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const server = await startPreview(0, 3000)

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

const screen = () => page.evaluate(() => window.rugbyStore.getState().nav.at(-1)?.screen)
const go = (s, p) => page.evaluate(([s, p]) => window.rugbyStore.getState().go(s, p), [s, p])
const back = () => page.evaluate(() => window.rugbyStore.getState().back())
const home = () => page.evaluate(() => window.rugbyStore.getState().home())

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
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Visit Tester')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(600)

  // ---- the transfer centre keeps its filters ----
  await go('transfers')
  await page.waitForSelector('.filter-btn')
  await page.click('.filter-btn')
  await page.waitForSelector('#fs-pos')
  await page.selectOption('#fs-pos', 'FL')
  await page.selectOption('#fs-age', { index: 2 })
  const ageSet = await page.$eval('#fs-age', el => el.value)
  await page.click('.filter-sheet .btn.gold')
  await page.waitForTimeout(400)
  const firstRow = 'main.content tbody tr'
  await page.waitForSelector(firstRow)
  const listBefore = await page.$$eval(firstRow, rs => rs.slice(0, 5).map(r => r.textContent))
  await page.click(firstRow)
  await page.waitForTimeout(400)
  ok(await screen() === 'player', 'a row opens the player')
  await back()
  await page.waitForTimeout(400)
  ok(await screen() === 'transfers', 'Back returns to the transfer centre')
  const listAfter = await page.$$eval(firstRow, rs => rs.slice(0, 5).map(r => r.textContent))
  ok(JSON.stringify(listAfter) === JSON.stringify(listBefore), 'the same filtered list is there after Back')
  await page.click('.filter-btn')
  await page.waitForSelector('#fs-pos')
  ok(await page.$eval('#fs-pos', el => el.value) === 'FL', 'the position filter is kept')
  ok(await page.$eval('#fs-age', el => el.value) === ageSet, 'the age filter is kept')
  await page.click('.filter-sheet .btn.gold')

  // a fresh visit from the menu starts clean, as it always did
  await home()
  await go('transfers')
  await page.waitForSelector('.filter-btn')
  await page.click('.filter-btn')
  await page.waitForSelector('#fs-pos')
  ok(await page.$eval('#fs-pos', el => el.value) === 'ALL', 'a new visit opens with no filters')
  await page.click('.filter-sheet .btn.gold')

  // ---- Team keeps its tab, its place in the list, and shows the rating ----
  await home()
  await go('squad')
  await page.click('main.content button >> text="General Info"')
  await page.waitForSelector(firstRow)
  const heads = await page.$$eval('main.content thead th', hs => hs.map(h => h.textContent.trim().toLowerCase()))
  ok(heads.includes('abl'), `General Info has an ability column (${heads.join(', ')})`)
  const abl = await page.$$eval(`${firstRow} .ovr`, els => els.map(e => e.textContent))
  ok(abl.length > 10 && abl.every(x => /^\d+$/.test(x)), 'every man of ours shows a number, never "?"')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(overflow <= 0, `no sideways scroll at 360px (${overflow}px over)`)
  await page.evaluate(() => { document.querySelector('main.content').scrollTop = 600; document.querySelector('main.content').dispatchEvent(new Event('scroll')) })
  await page.waitForTimeout(200)
  const was = await page.$eval('main.content', el => el.scrollTop)
  const rows = await page.$$(firstRow)
  await rows[Math.min(14, rows.length - 1)].click()
  await page.waitForTimeout(400)
  ok(await screen() === 'player', 'a man on General Info opens his page')
  await back()
  await page.waitForTimeout(400)
  const active = await page.$eval('main.content button.active', b => b.textContent.trim()).catch(() => '')
  ok(active === 'General Info', `Back returns to General Info, not the team sheet (on "${active}")`)
  const now = await page.$eval('main.content', el => el.scrollTop)
  ok(was > 0 && Math.abs(now - was) < 4, `and to the same place in the list (${now} of ${was})`)
  // Team opened from the menu while Team is showing: the same component, a
  // new visit, so it opens on the team sheet; Back still finds General Info
  await go('squad')
  await page.waitForTimeout(400)
  const fresh = await page.$eval('main.content button.active', b => b.textContent.trim()).catch(() => '')
  ok(fresh !== 'General Info', `Team opened again from the menu starts on its first tab (on "${fresh}")`)
  await back()
  await page.waitForTimeout(400)
  const again = await page.$eval('main.content button.active', b => b.textContent.trim()).catch(() => '')
  ok(again === 'General Info', `and Back from it returns to General Info (on "${again}")`)

  // ---- a free agent can be shortlisted ----
  const fa = await page.evaluate(() => {
    const g = window.rugbyStore.getState().game
    return Object.values(g.players).find(p => !p.clubId && !p.retiring)?.id ?? null
  })
  ok(fa != null, 'the world has a free agent to look at')
  if (fa != null) {
    await go('player', fa)
    await page.waitForTimeout(400)
    const shortlist = page.locator('main.content button', { hasText: 'Shortlist' }).first()
    ok(await shortlist.count() > 0, 'a free agent offers the shortlist')
    await shortlist.click()
    const listed = await page.evaluate(id => window.rugbyStore.getState().game.shortlist.includes(id), fa)
    ok(listed, 'and tapping it puts him on the shortlist for the scouts')
    ok(await page.locator('main.content button', { hasText: 'Sign' }).count() > 0, 'Sign is still there')
  }
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

if (fails) { console.error(`\nVISIT BACK PROBE: ${fails} failures`); process.exit(1) }
console.log('\nVISIT BACK PROBE PASSED: Back returns to the list as it was left')
done(0)
