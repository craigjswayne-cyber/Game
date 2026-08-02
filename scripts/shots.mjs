// Quick visual review: capture key screens without the full E2E flow.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` })

try {
  await page.goto('http://localhost:4174/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await shot('r1-title')
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Leicester Tigers')
  await page.fill('input[placeholder="Your name, gaffer"]', 'Gaffer')
  await page.click('text=Take the Job')
  await page.waitForSelector('text=Welcome to Leicester Tigers', { timeout: 15000 })
  await shot('r2-inbox')
  await page.click('.bottom-nav >> text=Squad')
  await page.waitForSelector('.dtable')
  await shot('r3-squad')
  await page.click('.dtable tbody tr >> nth=7')
  await page.waitForSelector('text=Set Piece & Contact')
  await shot('r4-player')
  await page.click('.back-btn')
  await page.click('.bottom-nav >> text=Comps')
  await page.waitForSelector('.dtable')
  await shot('r5-tables')
  await page.click('text=Continue ▸')
  await page.waitForSelector('text=Kick Off', { timeout: 15000 })
  await shot('r6-preview')
  await page.click('text=Kick Off ▸')
  await page.waitForSelector('.scoreboard', { timeout: 15000 })
  await page.waitForTimeout(4500)
  await shot('r7-live')
  await page.click('text=Skip ⏭')
  await page.waitForSelector('text=Continue to Results', { timeout: 15000 })
  await shot('r8-fulltime')
  console.log('SHOTS DONE')
} catch (e) {
  await shot('r9-fail')
  console.error('FAIL', e.message)
} finally {
  console.log('errors:', errors.length ? errors : 'none')
  await browser.close()
  server.kill()
  process.exit(0)
}
