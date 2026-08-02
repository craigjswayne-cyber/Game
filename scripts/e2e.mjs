// End-to-end smoke test: drive the built app in mobile Chromium.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` })

try {
  await page.goto('http://localhost:4173/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await shot('01-title')

  // New career
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.click('.action-bar >> text=Confirm')
  await page.waitForSelector('.tile-grid.three')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await shot('02-newgame')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Test Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-veil')
  await page.waitForSelector('text=Welcome to Leicester Tigers', { timeout: 15000 })
  await shot('03-inbox')

  // Squad
  await page.click('.bottom-nav >> text=Squad')
  await page.waitForSelector('.dtable')
  await shot('04-squad')

  // Player profile (first row)
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('text=Set Piece & Contact')
  await shot('05-player')
  await page.click('.back-btn')

  // Tactics
  await page.click('.bottom-nav >> text=Tactics')
  await page.waitForSelector('text=Starting XV')
  await shot('06-tactics')

  // Tables
  await page.click('.bottom-nav >> text=Comps')
  await page.waitForSelector('.dtable')
  await shot('07-tables')

  // Transfers
  await page.click('.bottom-nav >> text=Transfers')
  await page.waitForSelector('text=Scout The Market')
  await shot('08-transfers')

  // Continue -> match day
  await page.click('text=Continue ▸')
  await page.waitForSelector('text=Kick Off', { timeout: 15000 })
  await shot('09-matchday-preview')
  await page.click('text=Kick Off ▸')
  await page.waitForSelector('.scoreboard', { timeout: 15000 })
  await page.click('text=Skip ⏭')
  await page.waitForSelector('text=Start Second Half', { timeout: 15000 })
  await shot('10a-halftime')
  await page.click('text=▸ Start Second Half')
  await page.waitForTimeout(400)
  await page.click('text=Skip ⏭')
  await page.waitForSelector('text=Continue to Results', { timeout: 15000 })
  await shot('10-fulltime')
  await page.click('text=Continue to Results')
  await page.waitForSelector('.news-item', { timeout: 15000 })
  await shot('11-after-match')

  // burn through several weeks (mix of matchday + blank weeks)
  for (let i = 0; i < 8; i++) {
    await page.click('text=Continue ▸')
    await page.waitForTimeout(500)
    const kick = page.locator('text=Kick Off ▸')
    if (await kick.count()) {
      await kick.click()
      await page.waitForSelector('text=Skip ⏭', { timeout: 15000 })
      await page.click('text=Skip ⏭')
      await page.waitForSelector('text=Start Second Half', { timeout: 15000 })
      await page.click('text=▸ Start Second Half')
      await page.waitForTimeout(400)
      await page.click('text=Skip ⏭')
      await page.waitForSelector('text=Continue to Results', { timeout: 15000 })
      await page.click('text=Continue to Results')
      await page.waitForTimeout(300)
    }
  }
  await shot('12-weeks-later')

  // press room
  await page.click('.bottom-nav >> text=Press')
  await page.waitForTimeout(400)
  await shot('13-press')

  // reload -> save should load via menu
  await page.reload()
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=Load Career')
  await page.click('text=Test Gaffer')
  await page.waitForSelector('.news-item', { timeout: 15000 })
  await shot('14-loaded-save')

  console.log('E2E FLOW COMPLETE')
} catch (e) {
  await shot('99-failure')
  console.error('E2E FAILED:', e.message)
} finally {
  console.log('console errors:', errors.length ? errors.slice(0, 10) : 'none')
  await browser.close()
  server.kill()
}
