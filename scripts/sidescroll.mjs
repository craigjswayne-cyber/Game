/**
 * ---- NOTHING ON A PHONE SCROLLS SIDEWAYS ----
 *
 * Owner, v1.1.17: "On all tabs where they dont fit in like senior rankings/
 * wonderkids/ - make the teams initials or first three letters of their name
 * be used to give space so you dont have to scroll right at all."
 *
 * A table wider than the phone is not a small problem: the columns that fall
 * off the right are the ones nobody ever reads, and a horizontal scroll inside
 * a vertically scrolling page is the fiddliest gesture on a touchscreen.
 *
 * Nothing measured this. scrollaudit counts SCREENFULS - how far down a page
 * runs - at 844x390 landscape, which is the opposite axis on the opposite
 * orientation, so a table hanging 60px off the right of a portrait phone was
 * invisible to the whole suite.
 *
 * The fix these tables needed is the owner's own: a club is three letters
 * (clubCode, the same code its crest draws and the touchline paints) rather
 * than up to eleven - Northampton, Montpellier and La Rochelle are the three
 * that set the width.
 *
 * Run: node scripts/sidescroll.mjs
 */
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview(4258, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

/** Every scrollable table on the screen, and how far past the edge it runs. */
const overflow = async (where) => {
  await page.waitForTimeout(350)
  const rows = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('.tblwrap, table.dtable')) {
      const over = el.scrollWidth - el.clientWidth
      if (over > 1) out.push({ cls: el.className, over, w: el.clientWidth })
    }
    // and the page itself must never run sideways
    const doc = document.documentElement
    return { tables: out, page: doc.scrollWidth - doc.clientWidth }
  })
  const worst = rows.tables.sort((a, b) => b.over - a.over)[0]
  ok(!worst, `${where}: no table runs off the side${worst ? ` (worst ${worst.over}px past a ${worst.w}px box)` : ''}`)
  ok(rows.page <= 1, `${where}: and the page itself does not scroll sideways (${rows.page}px)`)
}

try {
  await page.goto('http://localhost:4258/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')   // the longest club name in the game
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Side Scroll')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(400)

  // THE TWO THE OWNER NAMED, and the neighbours that draw the same row
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Scouting Agency')
  await page.waitForSelector('.dtable')
  await overflow('Senior Rankings')
  await page.click('.tab-bar >> text=Wonderkids')
  await overflow('Wonderkids')

  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Team of the Week')
  await page.waitForTimeout(400)
  await overflow('Team of the Week')

  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Competitions')
  await page.waitForTimeout(400)
  await overflow('Competitions')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Transfer Centre')
  await page.waitForTimeout(600)
  await overflow('Transfer Centre')
} catch (e) {
  console.log(`FAIL  the walk itself broke: ${e}`)
  fails++
}

await browser.close()
server.kill?.()
console.log(fails === 0
  ? '\nSIDE SCROLL PASSED: every table fits the phone it is read on'
  : `\nSIDE SCROLL FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
