// ---- iPAD SCREENSHOTS FOR APP STORE CONNECT (1.8.0) ----
//
// Owner, 27 Sep 2026: "Make it so its built for IPad tablet too." A binary
// that supports iPad cannot be submitted without a set of 13-inch iPad
// screenshots, and Apple takes 2048 x 2732 for that slot. This walks a new
// career on a 1024 x 1366 touch screen at 2x (tablet mode on, as on an iPad
// Pro) and saves six portrait shots to shots-ipad/: the title screen, Home,
// the inbox, the team sheet, the transfer market and a live match.
//
// Run: npm run build && node scripts/ipadshots.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { startPreview } from './lib/preview.mjs'

const OUT = 'shots-ipad'
mkdirSync(OUT, { recursive: true })
const server = await startPreview('4259', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
let n = 0
const shot = async name => { n++; await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${String(n).padStart(2, '0')}-${name}.png` }) }

await page.goto('http://localhost:4259/')
await page.waitForSelector('text=RUGBY', { timeout: 15000 })
await shot('title')
await page.click('text=New Career')
await page.click('text=English Premier Division')
await page.waitForSelector('.club-tile')
await page.click('.tile >> text=Northampton')
await page.waitForSelector('text=Star Player')
await page.click('.action-bar >> text=Confirm')
await page.fill('input[placeholder="e.g. A. Gaffer"]', 'A. Manager')
await page.click('.speech-tile >> text=Forward Dominance')
await page.click('.action-bar >> text=Confirm')
await page.click('text=▸ Start Career')
await page.waitForSelector('.tut-box', { timeout: 15000 })
await page.click('.tut-close .btn')
await page.waitForSelector('.bottom-nav', { timeout: 15000 })
await shot('home')
await page.click('.bottom-nav button[title="News"]')
await page.waitForSelector('.reader')
await shot('inbox')
await page.click('.bottom-nav button[title="Hub"]')
await page.click('.submenu-item >> text="Team"')
await page.waitForSelector('.xv-split')
await shot('team')
await page.click('.bottom-nav button[title="Hub"]')
await page.click('.submenu-item >> text=Transfer Centre')
await page.waitForSelector('.filter-line')
await shot('transfers')
await page.click('.bottom-nav button[title="Home"]').catch(() => {})
for (let tap = 0; tap < 8; tap++) {
  if (await page.locator('text=Kick Off ▸').count()) break
  await page.click('.continue-btn')
  await page.waitForTimeout(450)
}
await page.locator('text=Kick Off ▸').first().click()
await page.locator('.talk-modal').waitFor({ timeout: 5000 })
await page.click('.talk-modal .speech-tile >> nth=0')
try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch { /* clean sheet */ }
await page.waitForSelector('.scoreboard', { timeout: 20000 })
await page.waitForTimeout(9000)
for (let k = 0; k < 3 && await page.locator('text=Take the Points').count(); k++) { await page.click('text=Take the Points'); await page.waitForTimeout(2500) }
await shot('match')

await browser.close()
server.kill?.()
console.log(`IPAD SHOTS: ${n} at 2048 x 2732 in ${OUT}/`)
process.exit(0)
