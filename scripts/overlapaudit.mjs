// Does anything sit on top of anything else?
//
// A device screenshot showed the Replacements bench painted over the top of
// itself: shirt 16's form and fitness columns drawn across shirt 20's number and
// name, and the Leadership card over the right-hand table. Every existing test
// passed, because they all measure HEIGHT - how many screenfuls a screen is -
// and none of them had ever asked whether two things occupy the same pixels.
//
// The cause is a table in a grid track. `minmax(0, 1fr)` lets the TRACK shrink,
// which is what stopped the page scrolling sideways, but a table will not shrink
// below its min-content width and it does not clip, so it paints straight over
// its neighbour. The earlier fix moved the symptom rather than removing it.
//
// This runs every screen at three widths, because the bug only appears when a
// track gets narrow enough, and the width the game is played at is not the width
// it was tuned at: the nav rail and the browser's own chrome eat more of a real
// phone than they did in the harness.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4187', 2500)

// 844x390 is what everything was tuned at. The other two are the same phone with
// a browser toolbar and a narrower reported width, which is what it really is.
const SIZES = [
  { w: 844, h: 390, label: '844x390 harness' },
  { w: 800, h: 320, label: '800x320 with a toolbar' },
  { w: 740, h: 300, label: '740x300 worst case' },
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fails = 0
let checks = 0

/** Do two boxes share pixels, allowing a hair of rounding? */
const OVERLAP_TOLERANCE = 3

const overlapsOnPage = (page) => page.evaluate((tol) => {
  const bad = []
  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''
    const txt = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 26)
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`
  }
  // Only siblings are compared. A child inside its parent overlaps by design;
  // two things that are meant to sit next to each other do not.
  const containers = document.querySelectorAll('.xv-split, .sel-split, .wiz-split, .card-grid, .dash-row, .hub-row, .tile-grid, .fact-grid, .speech-grid')
  for (const box of containers) {
    const kids = [...box.children].filter(k => {
      const r = k.getBoundingClientRect()
      const cs = getComputedStyle(k)
      return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' &&
        cs.position !== 'absolute' && cs.position !== 'fixed'
    })
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect()
        const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (dx > tol && dy > tol) {
          bad.push(`${label(kids[i])} overlaps ${label(kids[j])} by ${Math.round(dx)}x${Math.round(dy)}px inside .${(box.className || '').split(' ')[0]}`)
        }
      }
    }
    // and the container's own content spilling past its edge, which is how the
    // overlap happens in the first place
    const br = box.getBoundingClientRect()
    for (const k of kids) {
      const r = k.getBoundingClientRect()
      if (r.right - br.right > tol) bad.push(`${label(k)} spills ${Math.round(r.right - br.right)}px past the right edge of .${(box.className || '').split(' ')[0]}`)
    }
  }
  const scroller = document.querySelector('main.content') ?? document.scrollingElement
  return { bad, sideways: scroller.scrollWidth - scroller.clientWidth }
}, OVERLAP_TOLERANCE)

const run = async (size) => {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } })
  await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
  const clearTalk = async () => {
    if (await page.locator('.talk-modal').count()) {
      await page.click('.talk-modal >> text=Say nothing').catch(() => {})
      await page.waitForTimeout(200)
    }
  }
  const check = async (name) => {
    await page.waitForTimeout(300)
    checks++
    const { bad, sideways } = await overlapsOnPage(page)
    if (sideways > 1) { console.log(`FAIL ${size.label} ${name}: page scrolls ${sideways}px sideways`); fails++ }
    for (const b of bad) { console.log(`FAIL ${size.label} ${name}: ${b}`); fails++ }
    if (!bad.length && sideways <= 1) console.log(`  ok ${size.label} ${name}`)
  }
  try {
    await page.goto('http://localhost:4187/')
    await page.waitForSelector('text=RUGBY', { timeout: 15000 })
    await page.click('text=New Career')
    await page.waitForSelector('text=Gallagher Premiership')
    await check('wizard: league')
    await page.click('text=Gallagher Premiership')
    await page.waitForSelector('.club-tile')
    await page.click('.tile >> text=Northampton')
    await page.waitForSelector('text=Star Player')
    await check('wizard: club')
    await page.click('.action-bar >> text=Confirm')
    await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Overlap')
    await check('wizard: manager')
    await page.click('.speech-tile >> text=Forward Dominance')
    await page.click('.action-bar >> text=Confirm')
    await check('wizard: summary')
    await page.click('text=▸ Start Career')
    await page.waitForSelector('.tut-box', { timeout: 15000 })
    await page.click('.tut-close .btn')
    await page.waitForTimeout(400)
    await check('home')
    await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Selection & Tactics')
    await page.waitForSelector('.xv-split')
    await check('tactics: selection')
    await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Squad')
    await page.waitForSelector('.dtable')
    await check('squad')
    for (const [item, label] of [['Team Report', 'team report'], ['Finances', 'finances'], ['Club Infrastructure', 'infrastructure']]) {
      await page.click('.bottom-nav button[title="Hub"]')
      await page.click(`.submenu-item >> text=${item}`)
      await check(label)
    }
    // Continue walks the week a day at a time, so kick-off is a handful of taps
    // away rather than one. This probe pressed it once and then waited twenty
    // seconds for a button several days out, which is why all three sizes
    // stopped short of the two match-day views.
    for (let tap = 0; tap < 10; tap++) {
      if (await page.locator('text=Kick Off ▸').count()) break
      if (!(await page.locator('.continue-btn').count())) break
      await page.click('.continue-btn')
      await page.waitForTimeout(450)
    }
    await page.waitForSelector('text=Kick Off', { timeout: 20000 })
    await check('match day')       // with the dressing room open, as it arrives
    await clearTalk()
    await check('match day: team sheet')
  } catch (e) {
    console.error(`OVERLAP AUDIT stopped early at ${size.label}:`, e.message)
    fails++
  }
  await page.close()
}

for (const size of SIZES) await run(size)
console.log(`\n${checks} screen views checked at ${SIZES.length} sizes`)
console.log(fails ? `OVERLAP AUDIT FAILED (${fails})` : 'OVERLAP AUDIT PASSED')
await browser.close()
server.stop()
process.exit(fails ? 1 : 0)
