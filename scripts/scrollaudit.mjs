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
  await page.waitForSelector('.club-tile')
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
  await page.click('.tut-close .btn')
  await page.waitForSelector('text=Welcome to Leicester Tigers', { timeout: 15000 })
  await measure('home')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Squad')
  await page.waitForSelector('.dtable')
  await measure('squad')
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('text=Attributes')
  await measure('player: profile')
  await page.click('.tab-bar >> text=Attributes')
  await page.waitForSelector('text=Set Piece & Contact')
  await measure('player: attributes')
  await page.click('.back-btn')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Selection & Tactics')
  await page.waitForSelector('.tab-bar')
  await measure('tactics: selection')
  for (const [tab, label] of [['Bench', 'tactics: bench'], ['Tactics', 'tactics'], ['Prep', 'match prep'], ['Game Plan', 'game plan']]) {
    await page.click(`.tab-bar >> text=${tab}`)
    await measure(`tactics: ${label}`)
  }

  const clubItems = [
    ['Team Report', 'team report'],
    ['Medical Centre', 'medical centre'],
    ['Fixtures & Results', 'fixtures'],
    ['Finances', 'finances'],
    ['Transfer Centre', 'transfers'],
    ['Training & Staff', 'training'],
    ['Club Infrastructure', 'infrastructure'],
    ['Club Information', 'club information'],
  ]
  for (const [item, label] of clubItems) {
    await page.click('.bottom-nav button[title="Hub"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
  }

  await page.click('.bottom-nav button[title="Manager"]')
  await page.click(".submenu-item >> text=The Manager's Handbook")
  await page.waitForSelector('text=the eighty minutes and the hour before it')
  await measure('handbook')

  // the press room and the job centre belong to the manager, not to the team
  // sheet: he is the one in front of the cameras and the one being courted
  for (const [item, label] of [['Press Room', 'press room'], ['Job Centre', 'job centre']]) {
    await page.click('.bottom-nav button[title="Manager"]')
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
  ]
  for (const [item, label] of worldItems) {
    await page.click('.bottom-nav button[title="World"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
  }
} catch (e) {
  console.error('SCROLL AUDIT stopped early:', e.message)
} finally {
  // Long lists are meant to scroll: a 42-man squad, a whole season of
  // fixtures, every club in the world. The screens worth policing are the ones
  // that present a fixed amount of information and should fit in a glance or
  // two.
  //
  // This used to add "they all keep a sticky column header, so the scroll costs
  // nothing", which was an assumption and a wrong one: .tblwrap's overflow-x
  // made the wrapper the table's scrollport, so the header had nothing to stick
  // to and scrolled away with the rows. scripts/stickyaudit.mjs now measures it
  // rather than asserting it in a comment.
  // 'home' belongs here for the same reason: it is the inbox. Everything above
  // the feed - the fixture, the hub widgets, the dashboard panels - measures
  // 1.4 screenfuls, and the rest is however many headlines the week produced.
  // Policing the total would only ever mean showing fewer of them.
  // 'handbook' joins them: it is a searchable index of 49 topics, and the only
  // way to shorten it is to write about less of the game.
  const LISTS = new Set(['squad', 'fixtures', 'transfers', 'scouting agency', 'international rugby', 'home', 'handbook'])
  rows.sort((a, b) => b.screens - a.screens)
  console.log('\nscreenfuls  screen')
  for (const r of rows) {
    const list = LISTS.has(r.name)
    const flag = list ? ' (list)' : r.screens >= 3 ? ' ‼' : r.screens >= 2 ? ' !' : ''
    console.log(`${r.screens.toFixed(2).padStart(8)}    ${r.name}${flag}`)
  }
  const over = rows.filter(r => !LISTS.has(r.name) && r.screens >= 2)
  console.log(`\n${rows.length} screens measured, ${over.length} page${over.length === 1 ? '' : 's'} over two screenfuls`)
  if (over.some(r => r.screens >= 3)) console.log('WARN: a fixed-content page is three screenfuls deep')
  await browser.close()
  server.kill()
  process.exit(0)
}
