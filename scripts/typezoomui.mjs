// Probe: no text box zooms an iPhone, and the game lets go of a typing zoom (1.9.14).
//
// Player report (iPhone, 1.9.13): "When I click on filters for players, then
// type something in the search box, the app stays zoomed in tight until I
// close the app." iOS zooms the page in on any text box whose writing is under
// 16px, and the Transfers name search had been shrunk to 11px with the rest of
// its row on a phone held upright. This walks the screens with a box to type
// in, on a portrait phone, and holds every one at 16px or more.
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
// every box you type in on the screen, with the size of its writing
const boxes = () => page.$$eval('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea', els =>
  els.filter(e => e.offsetParent !== null).map(e => ({ size: parseFloat(getComputedStyle(e).fontSize), what: e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.className })))

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate(() => window.rugbyStore.getState().start('bedford', 'Type Zoom'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  let seen = 0
  for (const s of ['transfers', 'medical', 'handbook', 'training', 'scouting']) {
    await go(s)
    await page.waitForTimeout(400)
    for (const b of await boxes()) {
      seen++
      ok(b.size >= 16, `${s}: "${b.what}" types at ${b.size}px, 16 or more`)
    }
  }
  ok(seen >= 3, `the walk found the boxes it is about (${seen})`)
  // the one in the report, by name
  await go('transfers')
  await page.waitForSelector('.filter-line input')
  const fs = await page.$eval('.filter-line input', e => parseFloat(getComputedStyle(e).fontSize))
  ok(fs >= 16, `the Transfers name search beside Filters is ${fs}px on a portrait phone`)
  ok(errors.length === 0, `no page errors (${errors.join(' | ')})`)
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close()
  server.stop()
}
if (fails) { console.error(`\nTYPE ZOOM UI PROBE: ${fails} failures`); process.exit(1) }
console.log('\nTYPE ZOOM UI PROBE PASSED: every box you type in is 16px on a phone, so iOS never zooms to it')
done(0)
