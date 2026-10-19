// Probe: a screen never opened online still opens offline (1.9.1 bug hunt).
//
// Since 1.9.1 most screens are chunks fetched the first time they open. The
// service worker cached a chunk only once it had been fetched, so an
// installed web game taken offline lost every screen not yet visited: the
// tap reloaded to Home, and a second tap showed the crash screen. The worker
// now fetches every screen at install (public/sw.js PRECACHE, filled by the
// build). This loads the game once online, goes offline, and opens screens
// it has never opened.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { ok, done } from './lib/probe.mjs'

// the game registers its worker anywhere but localhost (main.tsx), so the
// preview is served on, and reached by, an address, which a browser also
// treats as secure. Bound there too: a runner whose localhost is ::1 refused
// a probe that only rewrote the origin.
const server = await startPreview(0, 3000, '127.0.0.1')
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message))
const origin = server.origin
await page.goto(origin + '/')
// the worker has installed, and its precache is in
const installed = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return -1
  const ready = await Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 15000))])
  if (!ready) return -2
  for (let i = 0; i < 100; i++) {
    const names = await caches.keys()
    let n = 0
    for (const k of names) n += (await (await caches.open(k)).keys()).filter(r => /\/assets\/[A-Z]/.test(r.url)).length
    if (n >= 10) return n
    await new Promise(r => setTimeout(r, 200))
  }
  return 0
})
ok(installed >= 10, `the worker caches the screens at install (${installed} screen files)`)
// the first worker to take control reloads the page once (main.tsx, the update
// path): let that happen before playing, rather than mid-career
await page.waitForTimeout(1500)
await page.reload()
await page.waitForSelector('text=New Career')
await page.click('text=New Career'); await page.click('text=English Premier Division')
await page.click('.tile >> text=Leicester'); await page.click('.action-bar >> text=Confirm')
await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Offline'); await page.click('.action-bar >> text=Confirm')
await page.click('text="Start Career"')
await page.locator('.tut-box').or(page.locator('.bottom-nav')).first().waitFor({ timeout: 20000 })
if (await page.locator('.tut-box').count()) await page.click('.tut-close .btn')
await page.waitForSelector('.bottom-nav')

// the server goes away, as a real outage does
server.stop(); await page.waitForTimeout(500)
for (const screen of ['handbook', 'squad', 'tactics', 'settings', 'finances']) {
  // past the tap guard a fresh career starts under, so go() is not ignored
  await page.evaluate(s => { window.rugbyStore.setState({ lastAdvanceAt: 0 }); window.rugbyStore.getState().go(s) }, screen)
  const shown = await page.waitForSelector(`.content[data-screen="${screen}"] > *`, { timeout: 8000 }).then(() => true).catch(() => false)
  const crashed = await page.locator('text=Something broke').count() > 0
  ok(shown && !crashed, `offline, ${screen} opens though it was never opened online`)
  await page.evaluate(() => window.rugbyStore.getState().home())
}
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
await browser.close()
done('OFFLINE PROBE', 'every screen is there without a connection', { exit: true })
