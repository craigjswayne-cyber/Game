// End-to-end smoke test: drive the built app in mobile Chromium (landscape).
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })

const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` })

/** Play a full interactive match from the preview screen. */
async function playMatch() {
  await page.locator('text=Kick Off ▸').first().click()
  // a clean team sheet skips the ready-check modal entirely
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* no modal - straight to the tunnel */ }
  await page.waitForSelector('.scoreboard', { timeout: 15000 })
  await page.click('.speed-controls >> text=⏭')
  await page.waitForSelector('text=Start Second Half', { timeout: 20000 })
  await page.click('text=▸ Start Second Half')
  await page.waitForTimeout(300)
  await page.click('.speed-controls >> text=⏭')
  await page.waitForSelector('text=Play the Final Quarter', { timeout: 20000 })
  await page.click('text=▸ Play the Final Quarter')
  await page.waitForTimeout(300)
  await page.click('.speed-controls >> text=⏭')
  await page.waitForSelector('text=Continue to Results', { timeout: 20000 })
}

try {
  await page.goto('http://localhost:4173/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await shot('01-title')

  // New career
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.tile-grid.three')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await shot('02-newgame')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Test Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-veil')
  await page.waitForSelector('text=Welcome to Leicester Tigers', { timeout: 15000 })
  await shot('03-inbox')

  // Squad
  await page.click('.bottom-nav button[title="Squad"]')
  await page.waitForSelector('.dtable')
  await shot('04-squad')

  // Player profile (first row)
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('text=Set Piece & Contact')
  await shot('05-player')
  await page.click('.back-btn')

  // Tactics (readouts + presets)
  await page.click('.bottom-nav button[title="Tactics"]')
  await page.waitForSelector('.form-pitch')
  await shot('06-tactics')
  await page.click('.tab-bar >> text=Instructions')
  await page.waitForSelector('text=Quick Game Plans')

  // Club submenu -> Team Report
  await page.click('.bottom-nav button[title="Club"]')
  await page.waitForSelector('.submenu')
  await shot('06b-club-menu')
  await page.click('.submenu-item >> text=Team Report')
  await page.waitForSelector('text=Positional Depth')
  await shot('06c-team-report')

  // Club submenu -> Medical Centre
  await page.click('.bottom-nav button[title="Club"]')
  await page.click('.submenu-item >> text=Medical Centre')
  await page.waitForSelector('text=Treatment Room')
  await shot('06d-medical')

  // World submenu -> Competitions
  await page.click('.bottom-nav button[title="World"]')
  await page.waitForSelector('.submenu')
  await page.click('.submenu-item >> text=Competitions')
  await page.waitForSelector('.dtable')
  await shot('07-tables')

  // World submenu -> The Rugby Wire
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=The Rugby Wire')
  await page.waitForSelector('text=THE RUGBY WIRE')
  await shot('07b-wire')

  // Manager submenu -> Profile
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Manager Profile')
  await page.waitForSelector('text=Coaching Specialities')
  await shot('07c-profile')

  // Manager submenu -> Save/Load
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Save / Load Game')
  await page.waitForSelector('text=Save Slots')
  await page.click('.card >> text=💾 Save >> nth=0')
  await page.waitForSelector('text=Career saved')
  await shot('07d-saves')

  // Club submenu -> Transfers
  await page.click('.bottom-nav button[title="Club"]')
  await page.click('.submenu-item >> text=Transfer Centre')
  await page.waitForSelector('text=Scout The Market')
  await shot('08-transfers')

  // Continue -> match day: swap a player, give a speech, ready check
  await page.click('.continue-btn')
  await page.waitForSelector('text=Kick Off', { timeout: 15000 })
  await shot('09-matchday-preview')
  await page.click('.tab-bar >> text=Talk')
  await page.click('.speech-tile >> text=Calm the nerves')
  await playMatch()
  await shot('10-fulltime')
  await page.click('text=Continue to Results')
  await page.waitForSelector('text=This Week\'s Results', { timeout: 10000 })
  await page.click('text=Back to the Dressing Room')
  await page.waitForSelector('.news-item', { timeout: 15000 })
  await shot('11-after-match')

  // burn through several weeks (mix of matchday + blank weeks)
  for (let i = 0; i < 8; i++) {
    await page.click('.continue-btn')
    await page.waitForTimeout(500)
    const kick = page.locator('text=Kick Off ▸')
    if (await kick.count()) {
      await playMatch()
      await page.click('text=Continue to Results')
      await page.waitForSelector("text=This Week's Results", { timeout: 10000 })
      await page.click('text=Back to the Dressing Room')
      await page.waitForTimeout(300)
    }
  }
  await shot('12-weeks-later')

  // Team of the Week (magazine dream team)
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Team of the Week')
  await page.waitForSelector('text=DREAM TEAM')
  await shot('12b-dreamteam')

  // Scouting Agency world rankings
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Scouting Agency')
  await page.waitForSelector('text=Senior Rankings: World')
  await page.click('.tab-bar >> text=Wonderkids')
  await page.waitForSelector('text=Wonderkid Watch: World')
  await shot('12c-agency')

  // press room via Club submenu
  await page.click('.bottom-nav button[title="Club"]')
  await page.click('.submenu-item >> text=Press Room')
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
  process.exit(0)
}
