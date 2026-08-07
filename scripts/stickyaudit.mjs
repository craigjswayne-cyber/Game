// Does every column header stay put, and does every table still fit?
//
// .tblwrap set overflow-x: auto, and CSS computes the other axis to auto with
// it, so the wrapper became the table's scrollport - which never scrolls
// vertically, so `position: sticky` on the th had nothing to stick to. Every
// table screen in the game had been scrolling its own headings away and no test
// noticed, because no test had ever scrolled and then looked.
//
// Landscape now drops the wrapper's overflow by default, which trades away
// sideways scrolling. So this walks every screen that has a table and checks
// both halves of that bargain for EVERY wrapper it finds:
//
//   fit      the table is no wider than its box, and the page has not started
//            scrolling sideways to accommodate it
//   pinned   the heading is still at or below the top of the scrollport after
//            the list has been scrolled - as long as its own table is still on
//            screen, because a heading is meant to leave when its table does
//
// A table that genuinely cannot fit opts out with .wide and gets its scroll
// back; this names the ones that need it rather than leaving it to guesswork.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const server = spawn('npx', ['vite', 'preview', '--port', '4185', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
let fails = 0
let wrappers = 0

/** The dressing room opens when Kick Off is pressed (feedback 9-1), so this
 *  should never fire on a plain screen walk - but it stays as a guard, and the
 *  button text is now the one the modal actually has. The old version looked for
 *  'Say nothing for now', which the modal has never said, and the click was
 *  wrapped in .catch() so it failed silently for three rounds. */
const clearTalk = async () => {
  if (await page.locator('.talk-modal').count()) {
    await page.click('.talk-modal >> text=Say nothing').catch(() => {})
    await page.waitForTimeout(200)
  }
}

const check = async (name) => {
  await page.waitForTimeout(320)
  const res = await page.evaluate(() => {
    const scroller = document.querySelector('main.content') ?? document.scrollingElement
    const wraps = [...document.querySelectorAll('.tblwrap')]
    const top = Math.round(scroller.getBoundingClientRect().top)
    const fit = wraps.map(w => ({
      wide: w.classList.contains('wide'),
      clipped: w.scrollWidth - w.clientWidth,
      hasTh: !!w.querySelector('th'),
    }))
    const pageWide = scroller.scrollWidth - scroller.clientWidth
    // scroll the page and see which headings held their ground
    const room = scroller.scrollHeight - scroller.clientHeight
    scroller.scrollTop = Math.min(600, room)
    const held = wraps.map(w => {
      const th = w.querySelector('th')
      if (!th) return null
      const wr = w.getBoundingClientRect()
      return {
        top: Math.round(th.getBoundingClientRect().top),
        // a heading is only meant to hold while its own table is still visible
        onScreen: wr.bottom > top + 40 && wr.top < top + scroller.clientHeight,
      }
    })
    scroller.scrollTop = 0
    return { fit, held, top, pageWide, scrolled: Math.min(600, room) }
  })
  if (!res.fit.length) { console.log(`  ${name}: no table`); return }
  wrappers += res.fit.length
  if (res.pageWide > 1) {
    console.log(`FAIL ${name}: the page scrolls ${res.pageWide}px sideways - a table has outgrown the screen`)
    fails++
  }
  for (const [i, f] of res.fit.entries()) {
    if (!f.wide && f.clipped > 1) {
      console.log(`FAIL ${name}[${i}]: table is ${f.clipped}px wider than its box with no way to scroll to it - needs .wide`)
      fails++
    }
  }
  let pinned = 0, left = 0
  if (res.scrolled > 40) {
    for (const [i, h] of res.held.entries()) {
      if (!h) continue
      if (!h.onScreen) { left++; continue }
      if (h.top < res.top - 1) {
        console.log(`FAIL ${name}[${i}]: heading scrolled away (top ${h.top} vs scrollport ${res.top}) after ${res.scrolled}px`)
        fails++
      } else pinned++
    }
  }
  const heads = res.held.filter(Boolean).length
  console.log(`  ${name}: ${res.fit.length} wrapper(s), ${heads} with a heading, ${pinned} pinned, ${left} scrolled out with their table`)
}

const club = async (item, label) => {
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click(`.submenu-item >> text=${item}`)
  await check(label)
}
const world = async (item, label) => {
  await page.click('.bottom-nav button[title="World"]')
  await page.click(`.submenu-item >> text=${item}`)
  await check(label)
}
const manager = async (item, label) => {
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click(`.submenu-item >> text=${item}`)
  await check(label)
}

try {
  await page.goto('http://localhost:4185/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Sticky Audit')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Squad')
  await page.waitForSelector('.dtable')
  await check('squad')
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('text=Attributes')
  await check('player profile')
  for (const t of ['Attributes', 'Career']) {
    await page.click(`.tab-bar >> text=${t}`)
    await check(`player ${t.toLowerCase()}`)
  }
  await page.click('.back-btn')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Selection & Tactics')
  await page.waitForSelector('.tab-bar')
  await check('tactics selection')

  // the widest tables in the game live behind tabs, so the tabs get walked too
  await club('Team Report', 'team report')
  for (const t of ['Squad Depth', 'Best XV']) {
    await page.click(`.tab-bar >> text=${t}`)
    await check(`team report: ${t.toLowerCase()}`)
  }
  await club('Transfer Centre', 'transfers: market')
  for (const t of ['Shortlist', 'Loans', 'Deals']) {
    await page.click(`.tab-bar >> text=${t}`)
    await check(`transfers: ${t.toLowerCase()}`)
  }

  for (const [item, label] of [
    ['Training & Staff', 'training'],
    ['Medical Centre', 'medical'],
    ['Fixtures & Results', 'fixtures'],
    ['Finances', 'finances'],
    ['Club Infrastructure', 'infrastructure'],
    ['Club Information', 'club information'],
  ]) await club(item, label)

  for (const [item, label] of [
    ['Team of the Week', 'team of the week'],
    ['Scouting Agency', 'agency'],
    ['Competitions', 'competitions'],
    ['International Rugby', 'nations'],
    ['Roll of Honour', 'roll of honour'],
  ]) await world(item, label)

  for (const [item, label] of [
    ['Manager Profile', 'manager profile'],
    ['Manager Legacy', 'manager legacy'],
  ]) await manager(item, label)

  // and the two that only exist once a match has been played: the match-day
  // team sheet, and the week's results table
  await page.click('.continue-btn')
  await page.waitForSelector('text=Kick Off', { timeout: 20000 })
  await clearTalk()
  await check('match day')
  await page.locator('text=Kick Off ▸').first().click()
  // Kick Off opens the dressing room; the speech carries on down the tunnel
  try {
    await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    await page.click('.talk-modal .speech-tile >> nth=0')
  } catch { /* no dressing room */ }
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* a clean team sheet skips the ready-check */ }
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  for (const next of ['▸ Start Second Half', '▸ Play the Final Quarter']) {
    await page.click('.speed-controls >> text=Skip')
    await page.waitForSelector(`text=${next.slice(2)}`, { timeout: 25000 })
    await page.click(`text=${next}`)
    await page.waitForTimeout(300)
  }
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Continue to Results', { timeout: 25000 })
  await page.click('text=Continue to Results')
  await page.waitForSelector("text=This Week's Results", { timeout: 15000 })
  await check('week results')
} catch (e) {
  console.error('STICKY AUDIT stopped early:', e.message)
  fails++
} finally {
  console.log(`\n${wrappers} table wrappers checked`)
  console.log(fails ? `STICKY AUDIT FAILED (${fails})` : 'STICKY AUDIT PASSED')
  await browser.close()
  server.kill()
  process.exit(fails ? 1 : 0)
}
