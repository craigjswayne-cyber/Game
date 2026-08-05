// Night-mode visual QA: the theme the user actually plays in.
// Forces rm-night=1 before the app boots, then screenshots the key screens.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))
const shot = (name) => page.screenshot({ path: `${SHOTS}/night-${name}.png` })

try {
  await page.goto('http://localhost:4175/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await shot('01-title')

  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await shot('02-wizard-league')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.tile-grid.three')
  await shot('03-wizard-club')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await shot('04-wizard-detail')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Night Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-veil')
  await page.waitForSelector('text=Welcome to Leicester Tigers', { timeout: 15000 })
  await shot('05-home')

  await page.click('.bottom-nav button[title="Squad"]')
  await page.waitForSelector('.dtable')
  await shot('06-squad')

  // squad filters: availability chip + search
  await page.locator('.preset-chip >> text=🚑 Unavailable').click()
  await page.waitForTimeout(250)
  await shot('06a2-squad-filtered')
  await page.locator('.preset-chip >> text=Everyone').click()

  // player profile
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('text=Set Piece & Contact')
  await shot('06b-player')
  await page.click('.back-btn')

  // transfers (lives under the Club submenu)
  await page.click('.bottom-nav button[title="Club"]')
  await page.click('.submenu-item >> text=Transfer Centre')
  await page.waitForTimeout(600)
  await shot('06c-transfers')
  await page.locator('.preset-chip >> text=🏷️ Listed only').click()
  await page.waitForTimeout(300)
  await shot('06c2-transfers-filtered')
  // commissioned scouting lives on the Shortlist tab
  await page.click('.tab-bar >> text=Shortlist')
  await page.waitForSelector('text=Commissioned Search')
  await shot('06c3-commission')

  // tables
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Competitions')
  await page.waitForSelector('.dtable')
  await shot('06d-tables')

  // press room
  await page.click('.bottom-nav button[title="Club"]')
  await page.click('.submenu-item >> text=Press Room')
  await page.waitForTimeout(400)
  await shot('06e-press')

  // training: the facilities boardroom flow
  await page.click('.bottom-nav button[title="Club"]')
  await page.click('.submenu-item >> text=Training & Coaching')
  await page.waitForSelector('.tab-bar')
  await shot('06f-training')
  await page.click('.tab-bar >> text=Staff')
  await page.waitForSelector('text=Backroom Staff')
  await shot('06f2-staff')
  await page.locator('.btn.ghost >> text=Market').first().click()
  await page.waitForTimeout(300)
  await shot('06f3-staff-market')
  await page.click('.tab-bar >> text=Club')
  await page.waitForSelector('text=Mentoring')
  await shot('06g-mentoring')

  // club infrastructure: the estate on one page
  await page.click('.bottom-nav button[title="Club"]')
  await page.click('.submenu-item >> text=Club Infrastructure')
  await page.waitForSelector('text=League Estates')
  await shot('06i-infrastructure')
  await page.locator('text=🏛 Ask board').first().click()
  await page.waitForTimeout(300)
  await shot('06j-infra-ask')

  // live match: kick off and play a half in the dark
  await page.click('text=MATCHDAY').catch(() => {})
  await page.waitForSelector('text=Kick Off ▸', { timeout: 15000 })
  await shot('07-matchday')
  await page.locator('text=Kick Off ▸').first().click()
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* straight to the tunnel */ }
  await page.waitForSelector('.scoreboard', { timeout: 15000 })
  await page.waitForTimeout(1500)
  await shot('08-live-match')

  console.log('NIGHT QA COMPLETE')
} catch (e) {
  await shot('99-failure')
  console.error('NIGHT QA FAILED:', e.message)
} finally {
  console.log('console errors:', errors.length ? errors.slice(0, 10) : 'none')
  await browser.close()
  server.kill()
  process.exit(0)
}
