import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { mkdirSync } from 'node:fs'

const SHOTS = '/tmp/claude-0/-home-user-Game/3407727b-220d-5fa6-b2ad-b15e5ff93514/scratchpad/qa'
mkdirSync(SHOTS, { recursive: true })
const server = await startPreview(4175, 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
const shot = n => page.screenshot({ path: `${SHOTS}/${n}.png` })
const log = m => console.log('STEP:', m)

try {
  await page.goto('http://localhost:4175/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=National League One', { timeout: 8000 })
  await page.click('text=National League One')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Rosslyn Pk')
  log('clicked club')
  await page.waitForTimeout(800)
  await shot('n2b-club-detail')
  await page.click('.action-bar >> text=Confirm')
  log('confirmed club')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  log('manager named')
  await page.waitForTimeout(500)
  await shot('n2c-summary')
  const start = page.locator('.action-bar >> text=Confirm')
  if (await start.count()) await start.click()
  const begin = page.locator('button:has-text("Begin"), button:has-text("Start")')
  if (await begin.count()) await begin.first().click()
  log('started')
  await page.waitForTimeout(1500)
  await shot('n3-home')
  await page.click('text=Inbox').catch(() => {})
  await page.waitForTimeout(700)
  await shot('n4-inbox')
  log('inbox')
  await page.click('text="Team"').catch(() => {})
  await page.waitForTimeout(700)
  await shot('n5-squad')
  await page.click('.dtable tbody tr >> nth=2').catch(() => {})
  await page.waitForTimeout(700)
  await shot('n6-player')
  log('done')
} catch (e) {
  console.log('FAILED:', String(e).slice(0, 300))
  await shot('fail')
} finally {
  console.log('errors:', errors.length ? errors : 'none')
  await browser.close()
  server.stop()
  process.exit(0)
}
