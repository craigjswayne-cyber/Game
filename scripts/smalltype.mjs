// Probe: no text in the game renders under 11px (WCAG pass, 1.4.4 / 1.4.12).
//
// The pass found about forty stylesheet declarations at 8.5 to 10.5px and a
// handful of inline 9s and 10s, raised them all to 11px, and moved the sheet's
// type to rem so a reader's own default text size applies. A grep of the CSS
// cannot see a size that is computed (an em on a small parent, an inline
// style, a calc), so this walks the rendered screens and asks every run of
// text for its computed size. SVG <text> is a drawing scaled with its picture
// and is not counted.
//
// Run: node scripts/smalltype.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const say = s => writeSync(1, s + '\n')
const MIN = 11
let fails = 0
const server = await startPreview(0, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.setDefaultTimeout(9000)
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const small = () => page.evaluate(MIN => {
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    // the studio mark is a logo, which 1.4.3 and 1.4.4 exempt
    if (el.closest('svg') || el.closest('.sr-only') || el.closest('.studio-mark')) continue
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').trim()
    if (!own) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const px = parseFloat(cs.fontSize)
    if (px < MIN - 0.01) out.push(`${px}px .${el.getAttribute('class') || el.tagName.toLowerCase()} "${own.slice(0, 30)}"`)
  }
  return [...new Set(out)]
}, MIN)

let measured = 0
const look = async label => {
  await page.waitForTimeout(350)
  const bad = await small()
  measured++
  if (bad.length) { fails++; say(`FAIL  ${label}: ${bad.length} run(s) under ${MIN}px`); for (const b of bad.slice(0, 8)) say(`FAIL    ${b}`) }
  else say(`  ok  ${label}`)
}

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await look('title screen')
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await look('club picker')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Small Type')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await look('tutorial')
  await page.click('.tut-close .btn')
  for (const s of ['home', 'inbox', 'squad', 'tactics', 'fixtures', 'tables', 'transfers', 'training', 'finances',
    'club', 'press', 'nations', 'history', 'handbook', 'medical', 'report', 'infra', 'academy', 'scouting', 'agency', 'dreamteam']) {
    await page.evaluate(x => window.rugbyStore.getState().go(x), s)
    await look(s)
  }
  // every tab on the tactics screen, where the smallest type lived
  await page.evaluate(() => window.rugbyStore.getState().go('tactics'))
  const tabs = await page.locator('.tab-bar button').allInnerTexts()
  for (const tb of tabs) {
    await page.locator('.tab-bar button', { hasText: tb }).first().click().catch(() => {})
    await look(`tactics: ${tb}`)
  }
} catch (e) {
  say('PROBE THREW: ' + String(e).slice(0, 200)); fails++
}
await browser.close()
server.stop()
say(fails ? `\nSMALL TYPE: ${fails} screen(s) with text under ${MIN}px` : `\nSMALL TYPE PASSED: ${measured} screens, nothing under ${MIN}px`)
done(fails)
