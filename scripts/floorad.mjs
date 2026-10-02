// Probe: the news and press floors carry a banner (owner, 1.8.3, with
// screenshots of the empty space under a news story and a quiet press room).
//
// Same seam as matchad.mjs: globalThis.rmAds is stubbed and records every
// mount, because the question is only "did the game mount a slot here, with
// this place". The press room mounts one only while no question is waiting.
//
// Run: node scripts/floorad.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4293', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
page.setDefaultTimeout(15000)
await page.addInitScript(() => {
  globalThis.__mounts = []
  globalThis.rmAds = { mount(_el, place) { globalThis.__mounts.push(place) }, unmount() {} }
})
const mounted = (place) => page.evaluate(p => globalThis.__mounts.includes(p), place)

try {
  await page.goto('http://localhost:4293/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Floor Test')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  await page.click('.bottom-nav >> text=News')
  await page.waitForTimeout(500)
  ok(await mounted('news-foot'), 'the news screen mounts a banner (news-foot)')

  await page.click('.bottom-nav >> text=Manager')
  await page.waitForTimeout(300)
  await page.locator('text=Press Room').first().click()
  await page.waitForTimeout(500)
  const waiting = await page.locator('.press-outlet').count()
  const press = await mounted('press-foot')
  ok(waiting ? !press : press, waiting
    ? `the press room holds its banner while ${waiting} question(s) wait`
    : 'a quiet press room mounts a banner (press-foot)')
} catch (e) {
  ok(false, `walk broke: ${String(e.message ?? e).split('\n')[0]}`)
}
await browser.close()
await server.stop?.()
say(fails ? `FLOOR AD PROBE FAILED (${fails})` : 'FLOOR AD PROBE PASSED: the news and press floors carry a banner, never beside a question')
done(fails)
