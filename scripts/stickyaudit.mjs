// Does the column header actually stay put, and does the table still fit?
//
// .tblwrap sets overflow-x: auto, and CSS computes the other axis to auto with
// it, so the wrapper became the table's scrollport - which never scrolls
// vertically, so `position: sticky` on the th had nothing to stick to. Every
// table screen had been scrolling its own headings away for months and no test
// noticed, because no test had ever scrolled and then looked.
//
// The fix is a `.fits` class that drops the wrapper's overflow in landscape.
// That trades away horizontal scrolling, so this checks both halves of the
// bargain on every screen that opts in: the heading pins when the list is
// scrolled, and the table still fits the width without one.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const server = spawn('npx', ['vite', 'preview', '--port', '4185', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
let fails = 0

const check = async (name) => {
  await page.waitForTimeout(350)
  const rows = await page.evaluate(() => {
    const scroller = document.querySelector('main.content')
    const out = []
    for (const wrap of document.querySelectorAll('.tblwrap.fits')) {
      const th = wrap.querySelector('th')
      out.push({
        overflowX: getComputedStyle(wrap).overflowX,
        clipped: wrap.scrollWidth - wrap.clientWidth,
        hasTh: !!th,
        pageWide: scroller.scrollWidth - scroller.clientWidth,
      })
    }
    return out
  })
  if (!rows.length) { console.log(`  ${name}: no .fits table on screen`); return }
  // scroll the list a screenful and see whether the heading held its ground
  const pinned = await page.evaluate(() => {
    const scroller = document.querySelector('main.content')
    const before = []
    for (const wrap of document.querySelectorAll('.tblwrap.fits')) {
      const th = wrap.querySelector('th')
      if (th) before.push(Math.round(th.getBoundingClientRect().top))
    }
    scroller.scrollTop = Math.min(600, scroller.scrollHeight - scroller.clientHeight)
    const after = []
    for (const wrap of document.querySelectorAll('.tblwrap.fits')) {
      const th = wrap.querySelector('th')
      if (!th) continue
      const wr = wrap.getBoundingClientRect()
      // a sticky heading is only meant to hold while its own table is still on
      // screen. The Test Nations table is twelve rows above a season of
      // fixtures, so by 600px it has legitimately left the building - asserting
      // on it would be asserting the wrong thing.
      const stillVisible = wr.bottom > scroller.getBoundingClientRect().top + 40
      after.push({ top: Math.round(th.getBoundingClientRect().top), stillVisible })
    }
    const top = Math.round(scroller.getBoundingClientRect().top)
    return { before, after, top, scrolled: scroller.scrollTop }
  })
  for (const [i, r] of rows.entries()) {
    const tag = `${name}[${i}]`
    if (r.clipped > 1) { console.log(`FAIL ${tag}: table is ${r.clipped}px wider than its box and can no longer be scrolled to`); fails++ }
    if (r.pageWide > 1) { console.log(`FAIL ${tag}: the page itself scrolls ${r.pageWide}px sideways`); fails++ }
  }
  if (pinned.scrolled > 40 && pinned.after.length) {
    for (const [i, h] of pinned.after.entries()) {
      // pinned means the heading is still on screen, at or below the scroller's
      // own top edge - not carried off with the rows
      if (h.stillVisible && h.top < pinned.top - 1) {
        console.log(`FAIL ${name}[${i}]: heading scrolled away (top ${h.top} vs viewport ${pinned.top}) after ${pinned.scrolled}px`)
        fails++
      }
    }
    const held = pinned.after.filter(h => h.stillVisible)
    console.log(`  ${name}: ${rows.length} table(s), ${held.length} still on screen, headings at ${held.map(h => h.top).join(', ') || 'n/a'} after ${pinned.scrolled}px`)
  } else {
    console.log(`  ${name}: ${rows.length} table(s), too short to scroll`)
  }
}

try {
  await page.goto('http://localhost:4185/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.tile-grid.three')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Sticky Audit')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-veil')

  await page.click('.bottom-nav button[title="Squad"]')
  await page.waitForSelector('.dtable')
  await check('squad')

  for (const [item, label] of [['Fixtures & Results', 'fixtures'], ['Transfer Centre', 'transfers']]) {
    await page.click('.bottom-nav button[title="Club"]')
    await page.click(`.submenu-item >> text=${item}`)
    await check(label)
  }
  for (const [item, label] of [['Scouting Agency', 'agency'], ['International Rugby', 'nations']]) {
    await page.click('.bottom-nav button[title="World"]')
    await page.click(`.submenu-item >> text=${item}`)
    await check(label)
  }
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Competitions')
  await check('competitions')
} catch (e) {
  console.error('STICKY AUDIT stopped early:', e.message)
  fails++
} finally {
  console.log(fails ? `STICKY AUDIT FAILED (${fails})` : 'STICKY AUDIT PASSED')
  await browser.close()
  server.kill()
  process.exit(fails ? 1 : 0)
}
