// Probe: the form controls are big enough to tap (1.8.15).
//
// scripts/tapsize.mjs measures every BUTTON by asking the browser what a tap
// at each edge would hit. It never looked at form controls, and the release
// hardening play-through found them all short on a 412px phone: every slider
// was a 16px strip, the transfer filter toggles sat in 40px rows, the two
// contract checkboxes in 30px rows and the contract steppers were 33x36.
//
// Same method as tapsize: from the control's centre, walk outwards until
// elementFromPoint stops landing on the control (or, for a checkbox, on the
// label that toggles it). The reach on the short axis must be 44px.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const MIN = 44

const server = await startPreview(4183, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
page.setDefaultTimeout(8000)

/** the shortest reach of every control matching sel, through what owns it */
const reach = sel => page.evaluate(({ sel }) => {
  const out = []
  for (const el of document.querySelectorAll(sel)) {
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const owner = el.closest('label') ?? el
    const owns = h => !!h && (h === el || owner.contains(h))
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2)
    const walk = (dx, dy) => { let n = 0; for (; n <= 40; n++) { const x = cx + dx * (n + 1), y = cy + dy * (n + 1); if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) break; if (!owns(document.elementFromPoint(x, y))) break } return n }
    const w = walk(-1, 0) + walk(1, 0) + 1, h = walk(0, -1) + walk(0, 1) + 1
    out.push({ box: `${Math.round(r.width)}x${Math.round(r.height)}`, hit: `${w}x${h}`, min: Math.min(w, h), label: (owner.textContent ?? '').trim().slice(0, 30) })
  }
  return out
}, { sel })

const check = async (name, sel) => {
  await page.waitForTimeout(250)
  const all = await reach(sel)
  const bad = all.filter(c => c.min < MIN)
  for (const b of bad.slice(0, 8)) say(`    ${b.min}px  box ${b.box}  hit ${b.hit}  "${b.label}"`)
  ok(all.length > 0 && bad.length === 0, `${name}: ${all.length} controls, every one reaches ${MIN}px (${bad.length} short)`)
}

try {
  await page.goto('http://localhost:4183/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Controls')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  // the tactics sliders
  await page.evaluate(() => window.rugbyStore.getState().go('tactics'))
  await page.waitForSelector('.tab-bar')
  // the dials live on the Game Plan tab; walk the tabs rather than name one
  const tabs = await page.locator('.tab-bar button').count()
  for (let i = 0; i < tabs; i++) {
    await page.locator('.tab-bar button').nth(i).click().catch(() => {})
    await page.waitForTimeout(200)
    if (await page.locator('[data-plan-sub="tune"]').count()) { await page.click('[data-plan-sub="tune"]'); await page.waitForTimeout(250) }
    if (await page.locator('.slider-row input[type=range]').count()) break
  }
  await check('Tactics sliders', '.slider-row input[type=range]')

  // the transfer filter toggles
  await page.evaluate(() => window.rugbyStore.getState().go('transfers'))
  await page.waitForSelector('.filter-btn')
  await page.click('.filter-btn')
  await page.waitForSelector('.filter-sheet')
  await check('Transfer filter toggles', '.fs-toggle input[type=checkbox]')
  await page.keyboard.press('Escape').catch(() => {})
  await page.evaluate(() => window.rugbyStore.getState().back())

  // the contract table after a fee is agreed: steppers and the two checkboxes
  const pid = await page.evaluate(() => {
    const S = window.rugbyStore.getState(); const g = S.game
    g.clubs[g.userClubId].budget = 50_000_000
    const p = Object.values(g.players).find(x => x.clubId && x.clubId !== g.userClubId && !x.acad && g.clubs[x.clubId]?.leagueId === 'champ' && x.age < 30)
    S.touch(); S.go('player', p.id); return p.id
  })
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: /Offer the asking price|Offer asking price|asking price/i }).first().click()
  await page.waitForTimeout(400)
  if (await page.locator('.btn.stepper').count()) {
    await check('Contract steppers', '.btn.stepper')
    await check('Contract checkboxes', '.check-row input[type=checkbox]')
  } else {
    ok(false, `the contract table opened for player ${pid}`)
  }
} catch (e) {
  say('FAIL  ' + String(e).slice(0, 300)); fails++
}
await browser.close()
server.stop()
say(fails ? `TAP CONTROLS PROBE FAILED (${fails})` : 'TAP CONTROLS PROBE PASSED: sliders, toggles, steppers and checkboxes all reach 44px')
done(fails)
