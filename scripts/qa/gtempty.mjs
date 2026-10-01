// Game Time with a filter nobody matches: the header must read across, not
// stack NAME one letter a line (owner, round 7). Screenshot for the owner.
import { chromium } from 'playwright-core'
import { startPreview } from '../lib/preview.mjs'
const PORT = Number(process.env.PORT ?? 4377)
const OUT = process.env.OUT ?? '/tmp'
const server = await startPreview(String(PORT), 2500)
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
let fails = 0
try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.click('text=New Career'); await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'S'); await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await page.evaluate(() => window.rugbyStore.getState().go('squad'))
  await page.locator('.tab-bar button', { hasText: /game time/i }).first().click()
  await page.waitForSelector('.gt-head')
  // every filter chip on: nobody can match them all
  // the injured-only chip at week 1: nobody is hurt yet, so the list is empty
  await page.locator('.preset-chip[aria-label]').last().click().catch(() => {})
  await page.waitForTimeout(150)
  const chips = page.locator('.gt-head').locator('xpath=ancestor::div[1]/preceding-sibling::*//button')
  if (await page.locator('text=Nobody matches').count() === 0) {
    const icons = page.locator('button[aria-pressed]')
    for (let i = 0; i < await icons.count(); i++) { await icons.nth(i).click().catch(() => {}); if (await page.locator('text=Nobody matches').count()) break }
  }
  console.log(`  empty state shown: ${await page.locator('text=Nobody matches').count() > 0}`)
  await page.waitForTimeout(300)
  const heads = await page.locator('.gt-head').count()
  if (heads) { console.log('FAIL  an empty list still draws its column headings'); fails++ } else console.log('  ok  an empty list shows the message alone, no squeezed headings')
  await page.screenshot({ path: `${OUT}/gametime-empty.png` })
} catch (e) { console.log("FAIL  " + e.message.split("\n")[0]); fails++ } finally { await browser.close(); server.stop() }
process.exit(fails ? 1 : 0)
