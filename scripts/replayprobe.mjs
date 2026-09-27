// ---- TRY REPLAYS (1.8.0) ----
//
// FM Mobile replays its goals; this is the rugby version. On a seeded match
// (?replays=1, since automated browsers do not replay on their own):
//
//   after a try the pitch shows REPLAY and the match waits for it
//   the replay ends by itself and the match carries on
//   the Replay the try button shows it again by hand
//
// The Match Settings switch and its memory are overlayprobe's.
//
// Run: npm run build && node scripts/replayprobe.mjs
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
const server = await startPreview('4267', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
// the same match every run: the career seed and every other draw come from
// Math.random, so a seeded one makes the twenty seconds repeatable
await page.addInitScript(() => {
  let a = 20260926
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
})
await page.goto('http://localhost:4267/?replays=1')
await page.waitForSelector('text=RUGBY', { timeout: 15000 })
await page.click('text=New Career'); await page.click('text=English Premier Division')
await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
await page.fill('input[placeholder="e.g. A. Gaffer"]', 'S'); await page.click('.speech-tile >> text=Forward Dominance')
await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
for (let tap = 0; tap < 8; tap++) { if (await page.locator('text=Kick Off ▸').count()) break; await page.click('.continue-btn'); await page.waitForTimeout(450) }
await page.locator('text=Kick Off ▸').first().click()
await page.locator('.talk-modal').waitFor({ timeout: 5000 }); await page.click('.talk-modal .speech-tile >> nth=0')
try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
await page.waitForSelector('.scoreboard', { timeout: 20000 })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const line = () => page.evaluate(() => document.querySelector('.now-line .txt')?.textContent ?? '')
try {
  // wait for the first try and its replay
  await page.waitForSelector('.replay-badge', { timeout: 60000 })
  ok(true, 'after a try the pitch shows REPLAY')
  const during = await line()
  await page.waitForTimeout(1500)
  ok(await line() === during, 'the match waits while the try is shown again')
  await page.waitForSelector('.replay-badge', { state: 'detached', timeout: 20000 })
  ok(true, 'the replay ends by itself')
  const after = await line()
  let moved = false
  for (let k = 0; k < 12 && !moved; k++) { await page.waitForTimeout(500); moved = (await line()) !== after }
  ok(moved, 'and the match carries on')
  await page.click('.replay-btn')
  await page.waitForSelector('.replay-badge', { timeout: 3000 })
  ok(true, 'the Replay the try button shows it again')
} catch (e) {
  console.error(`FAIL  stopped early: ${e.message.split('\n')[0]}`)
  fails++
}
await browser.close(); server.kill?.()
console.log(fails ? `\nREPLAY PROBE FAILED (${fails})` : '\nREPLAY PROBE PASSED: a try is shown again, and then the game goes on')
process.exit(fails ? 1 : 0)
