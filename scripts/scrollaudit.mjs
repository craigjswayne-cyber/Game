// Scroll audit (user: "reduce scrolling across the whole game - more pages,
// fit stuff into one clean screen"). Walks every screen at the phone's
// landscape size and measures how many screenfuls each one is.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const server = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const rows = []

const measure = async (name) => {
  await page.waitForTimeout(350)
  const m = await page.evaluate(() => {
    const el = document.querySelector('main.content') ?? document.scrollingElement
    return { h: el.scrollHeight, v: el.clientHeight }
  })
  rows.push({ name, screens: m.h / m.v, h: m.h, v: m.v })
}

try {
  await page.goto('http://localhost:4177/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.tile-grid.three')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await measure('wizard: club pick')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Audit Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await measure('wizard: manager')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-veil')
  await page.waitForSelector('text=Welcome to Leicester Tigers', { timeout: 15000 })
  await measure('home')

  await page.click('.bottom-nav button[title="Squad"]')
  await page.waitForSelector('.dtable')
  await measure('squad')
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('text=Set Piece & Contact')
  await measure('player profile')
  await page.click('.back-btn')

  await page.click('.bottom-nav button[title="Tactics"]')
  await page.waitForSelector('.tab-bar')
  await measure('tactics: selection')
  for (const [tab, label] of [['In-Form XV', 'in-form xv'], ['Tactics', 'tactics'], ['Prep', 'match prep'], ['Game Plan', 'game plan']]) {
    await page.click(`.tab-bar >> text=${tab}`)
    await measure(`tactics: ${label}`)
  }

  const clubItems = [
    ['Team Report', 'team report'],
    ['Medical Centre', 'medical centre'],
    ['Fixtures & Results', 'fixtures'],
    ['Finances', 'finances'],
    ['Transfer Centre', 'transfers'],
    ['Press Room', 'press room'],
    ['Training & Coaching', 'training'],
    ['Club Infrastructure', 'infrastructure'],
    ['Club Information', 'club information'],
  ]
  for (const [item, label] of clubItems) {
    await page.click('.bottom-nav button[title="Club"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
  }

  const worldItems = [
    ['The Rugby Wire', 'the wire'],
    ['Team of the Week', 'team of the week'],
    ['Scouting Agency', 'scouting agency'],
    ['Competitions', 'competitions'],
    ['International Rugby', 'international rugby'],
    ['Roll of Honour', 'roll of honour'],
    ['Job Centre', 'job centre'],
  ]
  for (const [item, label] of worldItems) {
    await page.click('.bottom-nav button[title="World"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
  }
} catch (e) {
  console.error('SCROLL AUDIT stopped early:', e.message)
} finally {
  rows.sort((a, b) => b.screens - a.screens)
  console.log('\nscreenfuls  screen')
  for (const r of rows) {
    const flag = r.screens >= 3 ? ' ‼' : r.screens >= 2 ? ' !' : ''
    console.log(`${r.screens.toFixed(2).padStart(8)}    ${r.name}${flag}`)
  }
  const over = rows.filter(r => r.screens >= 2)
  console.log(`\n${rows.length} screens measured, ${over.length} need more than two screenfuls`)
  await browser.close()
  server.kill()
  process.exit(0)
}
