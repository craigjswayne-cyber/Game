// Probe: a zoom belongs to the screen it was made on, and the scout sheet
// reaches a man's attributes (1.9.12).
//
// Tester, on an iPhone: "when scouting and clicking through, the screen is
// zoomed in and you can't zoom out", "when you click on scouted players it
// doesn't show their attributes - have to click make an offer to go and see",
// and "also doesn't scroll up fully". See src/ui/pageReset.ts.
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

const scale = () => page.evaluate(() => window.visualViewport?.scale ?? 1)
const cdp = await context.newCDPSession(page)

console.log('\n=== a zoom does not follow the manager to the next screen ===')
await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.6 })
await page.waitForTimeout(200)
const zoomed = await scale()
ok(zoomed > 1.4, `the page can be zoomed, as it always could (${zoomed.toFixed(2)}x)`)
await page.evaluate(() => window.rugbyStore.getState().go('squad'))
await page.waitForTimeout(700)
const after = await scale()
ok(after <= 1.01, `and the next screen is its own size again (${after.toFixed(2)}x)`)
const meta = await page.evaluate(() => document.querySelector('meta[name="viewport"]').content)
ok(!/maximum-scale/.test(meta), `the viewport is left free to be zoomed again (${meta})`)
// (headless Chromium will not take a second zoom from the protocol after the
// cap has been lifted, and synthesises no pinch at all, so "it can be zoomed
// again" is asserted on the viewport itself: no maximum-scale left behind)

console.log('\n=== the scout sheet reaches the attributes ===')
const name = await page.evaluate(() => {
  const s = window.rugbyStore.getState(), g = s.game
  const p = Object.values(g.players).find(q => q.clubId === 'bath' && !q.acad && q.pos === 'FL')
  if (!g.shortlist.includes(p.id)) s.toggleShortlist(p.id)
  s.go('scouting')
  return p.name
})
await page.waitForTimeout(500)
await page.locator('.scout-row', { hasText: name }).first().click()
await page.locator('.scout-sheet').waitFor({ timeout: 5000 })
const labels = await page.locator('.scout-sheet .btn').allInnerTexts()
ok(labels.includes('Attributes'), `the sheet has an Attributes button (${labels.join(' | ')})`)
await page.locator('.scout-sheet .btn', { hasText: /^Attributes$/ }).click()
await page.waitForTimeout(500)
const onAttrs = await page.evaluate(() => ({
  tab: document.querySelector('.tab-bar button.active')?.textContent,
  attrs: !!document.querySelector('.fm-attrs'),
  title: document.querySelector('.masthead')?.textContent?.includes('Player Profile'),
}))
ok(onAttrs.title && onAttrs.tab === 'Attributes' && onAttrs.attrs, `and it opens his page on the Attributes tab (${JSON.stringify(onAttrs)})`)

console.log('\n=== Make an offer scrolls the column, never the page ===')
await page.evaluate(() => window.rugbyStore.getState().back())
await page.waitForTimeout(400)
await page.locator('.scout-row', { hasText: name }).first().click()
await page.locator('.scout-sheet').waitFor({ timeout: 5000 })
await page.locator('.scout-sheet .btn', { hasText: 'Make an offer' }).click()
await page.waitForTimeout(600)
const pos = await page.evaluate(() => ({
  win: [window.scrollX, window.scrollY], doc: document.documentElement.scrollTop, body: document.body.scrollTop,
  mast: Math.round(document.querySelector('.masthead').getBoundingClientRect().top),
  col: Math.round(document.querySelector('main.content').scrollTop),
  tab: document.querySelector('.tab-bar button.active')?.textContent,
}))
ok(pos.win[0] === 0 && pos.win[1] === 0 && pos.doc === 0 && pos.body === 0 && pos.mast === 0, `the page has not moved (${JSON.stringify(pos)})`)
ok(pos.col > 0, `the column is down at the deal (${pos.col}px)`)
ok(pos.tab === 'Profile', 'on the Profile tab, where the deal is')
await page.evaluate(() => { document.querySelector('main.content').scrollTop = 0 })
ok(await page.evaluate(() => document.querySelector('main.content').scrollTop) === 0, 'and it scrolls all the way back up')

await browser.close(); server.stop()
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
done('PAGE RESET PROBE', 'a zoom stays on its own screen, and the scout sheet opens the attributes', { exit: true })
