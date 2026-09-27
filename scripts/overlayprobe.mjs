// ---- THE MATCH OVERLAYS (1.8.1) ----
//
// Match Settings in the FM26 layout the owner picked ("I like the toggle
// on/off option"), and what its switches show on a seeded match:
//
//   open play draws the gainline and the offside line
//   a scrum, lineout or maul draws the contest bar
//   condition rings only while play is stopped, on every man
//   five switches, on by default, that do what they say and are remembered
//
// Run: npm run build && node scripts/overlayprobe.mjs
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
const server = await startPreview('4255', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
// the same match every run: the career seed and every other draw come from
// Math.random, so a seeded one makes the twenty seconds repeatable
await page.addInitScript(() => {
  let a = 20260926
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
})
await page.goto('http://localhost:4255/')
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
const tap = async sel => {
  for (let k = 0; k < 5; k++) {
    await clear()
    try { await page.click(sel, { timeout: 3000 }); return } catch { await page.waitForTimeout(500) }
  }
  throw new Error(`could not tap ${sel}`)
}
// an injury sheet (the assistant has already sent a man on) or a touchline
// call can stop the clock in a seeded match: clear it and carry on
const clear = async () => {
  if (await page.locator('text=Take the Points').count()) await page.click('text=Take the Points')
  // the injury sheet: tapping the man the assistant sent on keeps him
  if (await page.locator('.sheet-row.armed').count()) { await page.locator('.sheet-row.armed').first().click(); await page.waitForTimeout(150) }
  const sheet = page.locator('.modal-veil .btn.gold:enabled').first()
  if (await sheet.count() && !(await page.locator('.settings-sheet').count())) await sheet.click()
}
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
try {
  await page.waitForTimeout(1500)
  ok(await page.evaluate(() => document.querySelectorAll('.pitch .stam').length) === 0, 'no condition rings while the match is playing')
  await tap('.speed-controls .btn >> nth=0')
  await page.waitForTimeout(500)
  const rings = await page.evaluate(() => document.querySelectorAll('.pitch .stam').length)
  ok(rings >= 28, `paused, every man wears his condition ring (${rings})`)
  await tap('.speed-controls .btn >> nth=-1')
  await page.waitForSelector('.settings-sheet')
  const sw = await page.evaluate(() => [...document.querySelectorAll('.settings-sheet [role=switch]')].map(e => e.getAttribute('aria-checked')))
  ok(sw.length === 5 && sw.every(v => v === 'true'), `five switches, all on by default (${sw.join(',')})`)
  await page.locator('.settings-sheet [role=switch]').nth(2).click()
  await page.waitForTimeout(200)
  ok(await page.evaluate(() => document.querySelectorAll('.pitch .stam').length) === 0, 'turning Condition rings off takes them away')
  await page.locator('.settings-sheet [role=switch]').nth(3).click()
  ok(await page.evaluate(() => !document.querySelector('.live-wrap')?.classList.contains('big-text')), 'turning Large commentary off returns the old size')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('phase.matchPrefs') ?? '{}'))
  ok(saved.stamina === false && saved.bigText === false && saved.overlays === true && saved.replays === true, `the choices are remembered on this device (${JSON.stringify(saved)})`)
  // back to the match, and play on to see the overlays
  await page.click('.settings-sheet > .btn.gold.block')
  await page.waitForTimeout(300)
  // closing Match Settings resumes play by itself
  const seen = { lines: 0, contest: 0 }
  for (let k = 0; k < 50 && !(seen.lines && seen.contest); k++) {
    const st = await page.evaluate(() => ({
      lines: document.querySelectorAll('.pitch .phase-line').length,
      contest: document.querySelectorAll('.pitch .contest-bar').length,
    }))
    if (st.lines) seen.lines = st.lines
    if (st.contest) seen.contest = st.contest
    await clear()
    await page.waitForTimeout(500)
  }
  ok(seen.lines === 2, `open play shows the gainline and the offside line (${seen.lines})`)
  ok(seen.contest >= 1, 'a set piece shows the contest bar')
} catch (e) {
  console.error(`FAIL  stopped early: ${e.message.split('\n')[0]}`)
  fails++
}
await browser.close(); server.stop()
console.log(fails ? `\nOVERLAY PROBE FAILED (${fails})` : '\nOVERLAY PROBE PASSED: the lines, the contest and the rings come and go when they should')
process.exit(fails ? 1 : 0)
