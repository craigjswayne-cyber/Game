// ---- THE MOTION LAYER (1.8.0) ----
//
// Owner, 26 Sep 2026: "Could we add subtle motion throughout the game at
// opportunities?" The motion is off for automated browsers (main.tsx), so
// this asks for it with ?motion=1 and checks it keeps its promises:
//
//   Home's cards arrive (m-rise), a sheet slides up (m-sheet)
//   every animation on the page has finished within 700ms: motion confirms,
//   it never makes you wait
//   a sheet opened on a screen that has just arrived still sits on the
//   bottom of the glass (a held transform would pin it to the screen)
//   reduce motion switches the whole layer off
//   without ?motion=1 an automated browser gets a still page
//
// Run: npm run build && node scripts/ambientprobe.mjs
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4251', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

async function career(page, url) {
  await page.goto(url)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Motion')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
}
const running = page => page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && !(a.effect?.target?.closest?.('.pitch, .intro'))).length)

try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
  await career(page, 'http://localhost:4251/?motion=1')
  ok(await page.evaluate(() => document.documentElement.dataset.motion === 'on'), 'the layer is on with ?motion=1')
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Transfer Centre')
  const names = await page.evaluate(() => [...new Set(document.getAnimations().map(a => a.animationName))])
  ok(names.includes('m-rise'), `a new screen rises into place (${names.join(', ')})`)
  await page.click('.filter-btn')
  const sheet = await page.evaluate(() => [...new Set(document.getAnimations().map(a => a.animationName))])
  ok(sheet.includes('m-sheet'), 'a sheet slides up')
  await page.waitForTimeout(700)
  ok(await running(page) === 0, `everything has settled within 700ms (${await running(page)} still running)`)
  const pos = await page.evaluate(() => { const r = document.querySelector('.filter-sheet').getBoundingClientRect(); return { bottom: Math.round(r.bottom), h: innerHeight } })
  ok(Math.abs(pos.bottom - pos.h) <= 2, `the sheet sits on the bottom of the glass (${pos.bottom} of ${pos.h})`)
  await page.click('.filter-sheet .btn.gold')
  await page.click('.bottom-nav button[title="Home"]')
  const home = await page.evaluate(() => document.querySelector('.card-grid > *')?.getAnimations().map(a => a.animationName) ?? [])
  ok(home.includes('m-rise'), 'Home deals its cards in')
  await page.waitForTimeout(700)
  ok(await running(page) === 0, 'and they have all landed within 700ms')
  await page.close()

  const calm = await browser.newPage({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce' })
  await calm.goto('http://localhost:4251/?motion=1')
  await calm.waitForSelector('text=RUGBY')
  await calm.click('text=New Career')
  const calmNames = await calm.evaluate(() => document.getAnimations().map(a => a.animationName).filter(n => n?.startsWith('m-')))
  ok(calmNames.length === 0, `reduce motion switches the layer off (${calmNames.join(', ') || 'none'})`)
  await calm.close()

  const still = await browser.newPage({ viewport: { width: 412, height: 915 } })
  await still.goto('http://localhost:4251/')
  await still.waitForSelector('text=RUGBY')
  ok(await still.evaluate(() => document.documentElement.dataset.motion !== 'on'), 'an automated browser without ?motion=1 gets a still page')
  await still.close()
} catch (e) {
  console.error(`FAIL  stopped early: ${e.message.split('\n')[0]}`)
  fails++
}
await browser.close()
server.kill?.()
console.log(fails ? `\nAMBIENT PROBE FAILED (${fails})` : '\nAMBIENT PROBE PASSED: things arrive rather than appear, and never make you wait')
process.exit(fails ? 1 : 0)
