// ---- MATCH SETTINGS (1.8.0) ----
//
// The owner, 28 Sep 2026: "We are aiming for football manager level of
// animation. Smooth and show tries properly, then just commentary only ...
// maybe show stats when nothing interesting happens??" So the always-on pitch
// and the switches that decorated it (overlays, condition rings) are gone, and
// Match Settings holds what is left, on a seeded match:
//
//   between highlights the stage is the live stats, every row there
//   Highlights: Key Moments (tries and TMO calls) or Extended (plus kicks at
//     goal and attacks into the 22), Key by default, with a line saying which
//   Large commentary, on by default
//   every choice remembered on this device, and nothing else stored
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
  await clear()
  const rows = await page.evaluate(() => [...document.querySelectorAll('.live-stats .ls-row .ls-label')].map(e => e.textContent))
  ok(rows.length === 10 && rows.includes('Territory') && rows.includes('Kicks at goal') && rows.includes('Points per 22 visit'), `between highlights the stage is the live stats (${rows.join(', ')})`)
  ok(await page.evaluate(() => !document.querySelector('.pitch')), 'and there is no always-on pitch')
  await tap('.speed-controls .btn >> nth=-1')
  await page.waitForSelector('.settings-sheet')
  const seg = () => page.evaluate(() => {
    const label = [...document.querySelectorAll('.settings-sheet .set-label')].find(e => e.textContent === 'Highlights')
    const row = label?.nextElementSibling
    return { btns: [...(row?.querySelectorAll('.btn') ?? [])].map(b => ({ text: b.textContent, on: b.classList.contains('gold') })), note: document.querySelector('.settings-sheet .ms-note')?.textContent ?? '' }
  })
  const before = await seg()
  ok(before.btns.length === 2 && before.btns[0].on && !before.btns[1].on, `Highlights: two choices, Key Moments by default (${before.btns.map(b => b.text + (b.on ? '*' : '')).join(' / ')})`)
  const sw = await page.evaluate(() => [...document.querySelectorAll('.settings-sheet [role=switch]')].map(e => e.getAttribute('aria-checked')))
  ok(sw.length === 2 && sw.every(v => v === 'true'), `two switches (sound, large commentary), both on (${sw.join(',')})`)
  await page.click(`.settings-sheet .btn >> text=${before.btns[1].text}`)
  await page.waitForTimeout(200)
  const after = await seg()
  ok(after.btns[1].on && !after.btns[0].on, 'picking Extended selects it')
  ok(after.note !== before.note && after.note.length > 10, `and the line under it says what Extended adds ("${after.note}")`)
  await page.locator('.settings-sheet [role=switch]').nth(1).click()
  ok(await page.evaluate(() => !document.querySelector('.live-wrap')?.classList.contains('big-text')), 'turning Large commentary off returns the old size')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('phase.matchPrefs') ?? '{}'))
  ok(saved.highlights === 'extended' && saved.bigText === false && Object.keys(saved).sort().join() === 'bigText,highlights',
    `the choices are remembered on this device, and nothing else is (${JSON.stringify(saved)})`)
  await page.click('.settings-sheet > .btn.gold.block')
  await page.waitForTimeout(300)
  ok(await page.evaluate(() => !document.querySelector('.settings-sheet')), 'closing Match Settings goes back to the match')
  // an old save with the retired switches in it (1.8.0 betas) reads cleanly
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.evaluate(() => localStorage.setItem('phase.matchPrefs', JSON.stringify({ overlays: false, stamina: false, bigText: true, highlights: 'bogus' })))
  await page.reload()
  await page.waitForTimeout(2500)
  ok(errors.length === 0 && await page.evaluate(() => document.body.innerText.length > 50), `a device holding the retired switches still loads the game (${errors.length} errors)`)
} catch (e) {
  console.error(`FAIL  stopped early: ${e.message.split('\n')[0]}`)
  fails++
}
await browser.close(); server.stop()
console.log(fails ? `\nOVERLAY PROBE FAILED (${fails})` : '\nOVERLAY PROBE PASSED: Match Settings does what it says and remembers it')
process.exit(fails ? 1 : 0)
