// QA sweep 2: today's UI — match prep chips, chc/natl1 tabs, pnc tab.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { mkdirSync } from 'node:fs'

const SHOTS = '/tmp/claude-0/-home-user-Game/3407727b-220d-5fa6-b2ad-b15e5ff93514/scratchpad/qa2'
mkdirSync(SHOTS, { recursive: true })
const server = await startPreview(4176, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
const shot = n => page.screenshot({ path: `${SHOTS}/${n}.png` })

try {
  await page.goto('http://localhost:4176/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForTimeout(600)
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.waitForTimeout(600)
  await page.click('button:has-text("Start Career")')
  await page.waitForTimeout(1500)
  const veil = page.locator('.tut-veil')
  if (await veil.count()) { await shot('t0-tutorial'); await veil.click() }
  // tactics: match prep
  await page.click('text=Roles')
  await page.waitForSelector('text=Match Preparation', { timeout: 8000 })
  await page.click('text=Set-Piece Work')
  await page.waitForTimeout(400)
  await shot('t1-matchprep')
  // tables: challenge cup + national 1 tabs
  await page.click('text=World')
  await page.waitForTimeout(500)
  await page.click('text=Competitions').catch(() => {})
  await page.waitForTimeout(600)
  await page.click('.tab-bar >> text=Continental Shield')
  await page.waitForTimeout(500)
  await shot('t2-chc')
  await page.click('.tab-bar >> text=National 1')
  await page.waitForTimeout(500)
  await shot('t3-natl1')
  // internationals: pacific cup
  await page.click('.tab-bar >> text=Internationals')
  await page.waitForTimeout(600)
  await page.click('.tab-bar >> text=🌺 Pacific Cup')
  await page.waitForTimeout(500)
  await shot('t4-pnc')
} catch (e) {
  console.log('FAILED:', String(e).slice(0, 200))
  // QA-GATE-01 (1.6.5): a caught failure used to be followed by exit(0) in
  // finally, so the harness reported success. The failure sets the exit code
  // and finally exits WITH it.
  process.exitCode = 1
  await shot('fail')
} finally {
  console.log('errors:', errors.length ? errors : 'none')
  if (errors.length) process.exitCode = 1
  await browser.close()
  server.stop()
  process.exit(process.exitCode ?? 0)
}
