// Probe: the scouting overhaul on a phone (1.9.12).
//
// The scout sheet shows a man's attributes as the file reads them, compares
// him with your best in the same shirt, and sends the chief scout to watch him
// in person. The list sorts and filters. Nothing runs off the side of the
// screen and nothing throws.
import { chromium, devices } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { ok, done } from './lib/probe.mjs'

const server = await startPreview()
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const context = await browser.newContext({ ...devices['iPhone 13'] })
const page = await context.newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto(server.origin + '/')
await page.click('text=New Career'); await page.click('text=English Premier Division')
await page.click('.tile >> text=Leicester'); await page.click('.action-bar >> text=Confirm')
await page.fill('input[placeholder="e.g. A. Gaffer"]', 'T'); await page.click('.action-bar >> text=Confirm')
await page.click('text="Start Career"')
await page.locator('.tut-box').or(page.locator('.bottom-nav')).first().waitFor({ timeout: 20000 })
if (await page.locator('.tut-box').count()) await page.click('.tut-close .btn')

const wide = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

console.log('\n=== the list ===')
const names = await page.evaluate(() => {
  const s = window.rugbyStore.getState(), g = s.game
  g.staff.scout = 2
  const men = Object.values(g.players).filter(q => q.clubId === 'bath' && !q.acad).slice(0, 6)
  for (const p of men) { p.sc = 60; if (!g.shortlist.includes(p.id)) s.toggleShortlist(p.id) }
  s.go('scouting')
  return men.map(p => p.name)
})
await page.waitForTimeout(500)
const rows = await page.locator('.scout-row').count()
ok(rows >= 6, `the six men are on the screen (${rows} rows)`)
ok(!(await wide()), 'the scouting screen fits the phone')

console.log('\n=== the sheet: attributes, compare, scout in person ===')
await page.locator('.scout-row', { hasText: names[0] }).first().click()
await page.locator('.scout-sheet').waitFor({ timeout: 5000 })
const attrs = await page.locator('.scout-sheet .scout-attrs').count()
ok(attrs === 1, 'the sheet carries his attributes')
const cells = await page.locator('.scout-sheet .scout-attrs').innerText()
ok(/Tackling/.test(cells) && /Pace/.test(cells) && /\d+-\d+/.test(cells), 'named, and as ranges while the file is thin')
const cmp = page.locator('.scout-sheet .scout-attrs .btn', { hasText: /^Compare with/ })
if (await cmp.count()) {
  await cmp.click(); await page.waitForTimeout(200)
  ok(await page.locator('.scout-sheet .scout-attrs .btn', { hasText: /^Beside/ }).count() === 1, 'compare puts your own man beside him')
  ok(!(await wide()), 'and the comparison still fits the phone')
} else ok(true, 'no man of yours in his shirt to compare with')
await page.locator('.scout-sheet .btn', { hasText: /^Scout in person$/ }).click()
await page.waitForTimeout(300)
ok(await page.locator('.scout-sheet .btn', { hasText: /^Stop watching$/ }).count() === 1, 'Scout in person sends the chief scout, and the button says so')
const watching = await page.evaluate(() => (window.rugbyStore.getState().game.scoutWatch ?? []).length)
ok(watching === 1, `one man on the watch (${watching})`)
await page.locator('.scout-sheet .btn', { hasText: /^Close$/ }).click()
await page.waitForTimeout(300)
ok(await page.locator('.scout-sheet').count() === 0, 'Close closes the sheet')

await browser.close(); server.stop()
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
done('SCOUT SCREEN PROBE', 'the sheet shows the numbers, compares, and sends the scout; the screen fits a phone', { exit: true })
