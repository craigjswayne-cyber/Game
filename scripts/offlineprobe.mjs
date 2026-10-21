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
import { readdirSync } from 'node:fs'

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
// AND EVERY FONT (1.9.4). The title screen's faces are fetched before the
// worker controls the page, so only the precache can hold them: without it an
// offline launch, once the browser's own cache had let them go, drew the
// titles in the phone's sans.
const woff = readdirSync('dist/assets').filter(f => f.endsWith('.woff2'))
const cachedFonts = await page.evaluate(async () => {
  const got = new Set()
  for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) if (r.url.endsWith('.woff2')) got.add(r.url.split('/').pop())
  return [...got]
})
const uncached = woff.filter(f => !cachedFonts.includes(f))
ok(woff.length >= 20 && uncached.length === 0, `the worker caches every font at install (${woff.length - uncached.length} of ${woff.length}${uncached.length ? `; not ${uncached.slice(0, 3).join(', ')}` : ''})`)
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
// a fresh launch with no server and an empty browser cache: the worker alone
// has to serve the page and every face it draws
{
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable'); await cdp.send('Network.clearBrowserCache'); await cdp.detach()
  const cold = await ctx.newPage()
  await cold.goto(origin + '/').catch(() => {})
  await cold.locator('.content').or(cold.locator('text=RUGBY')).first().waitFor({ timeout: 15000 }).catch(() => {})
  const faces = await cold.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter(f => f.status === 'loaded' || f.status === 'error').map(f => `${f.family} ${f.weight} ${f.status}`)
  })
  const broken = faces.filter(f => f.endsWith('error'))
  ok(faces.length > 0 && broken.length === 0, `offline from cold, every face the screen draws loads (${faces.length - broken.length} loaded${broken.length ? `; failed: ${broken.join(', ')}` : ''})`)
  await cold.close()
}
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
await browser.close()
done('OFFLINE PROBE', 'every screen is there without a connection', { exit: true })
