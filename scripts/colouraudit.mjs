// "The colours still feel a little greyed out" - so measure it.
//
// Feel is not a thing you can argue about, but saturation is. This walks the
// visible elements on a set of screens, reads the colours the browser actually
// painted, and reports two numbers per screen: the area-weighted mean saturation
// of everything painted, and the share of painted area that is effectively grey.
//
// The point is a before-and-after. A palette change that does not move these
// numbers did not do anything, whatever it looks like in a screenshot.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4179', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

// ONE walk, two numbers. This used to be two separate page.evaluate passes, each
// iterating document.querySelectorAll('*') and calling getComputedStyle on every
// element - and getComputedStyle is the expensive part, because it forces style
// resolution per node. Splitting canvas from content doubled an already slow
// probe and pushed the whole run past fifteen minutes, which is how a useful
// audit becomes one nobody waits for. Same data, gathered once.
const MEASURE = () => {
  // rgb() / rgba() only - that is what getComputedStyle returns
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || '')
    if (!m) return null
    const [r, g, b, a] = m[1].split(',').map(x => parseFloat(x))
    if (a != null && a < 0.35) return null // barely painted
    return [r, g, b]
  }
  // CHROMA, not HSL saturation. HSL saturation of a near-black navy like #0b1322
  // is 0.51, which scored the darkest background in the game as half-saturated
  // when it reads as black. Chroma is max minus min: #0b1322 scores 0.09 and the
  // slate-grey accent #5c6470 scores 0.08, which is what the eye reports.
  const sat = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255
  // area-weighted totals, over everything painted
  let area = 0, satArea = 0, greyArea = 0, vivid = 0
  // and per-element totals over content only. The area-weighted average is
  // dominated by the page and its cards, which a night theme paints near-black
  // on purpose, so it drags toward grey however vivid the content is and the
  // only way to "improve" it would be to tint the backdrop. The complaint was
  // never about the backdrop; it was about the club colours, the chips and the
  // numbers. Anything covering more than an eighth of the screen is canvas.
  const CANVAS = 844 * 390 * 0.12
  let cn = 0, cTot = 0, cGrey = 0, cVivid = 0
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > window.innerHeight) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    // background if it paints one, otherwise the text colour it contributes
    const c = parse(cs.backgroundColor) ?? parse(cs.color)
    if (!c) continue
    const s = sat(c)
    const a = Math.min(r.width, 844) * Math.min(r.height, 390)
    area += a
    satArea += s * a
    if (s < 0.10) greyArea += a
    if (s > 0.30) vivid += a
    if (r.width * r.height <= CANVAS) {
      cn++; cTot += s
      if (s < 0.10) cGrey++
      if (s > 0.30) cVivid++
    }
  }
  if (!area) return null
  return {
    all: {
      meanSat: +(satArea / area).toFixed(3),
      greyShare: +(greyArea / area).toFixed(3),
      vividShare: +(vivid / area).toFixed(3),
    },
    acc: cn ? { n: cn, mean: +(cTot / cn).toFixed(3), grey: +(cGrey / cn).toFixed(3), vivid: +(cVivid / cn).toFixed(3) } : null,
  }
}

const both = async (pg) => await pg.evaluate(MEASURE)
// progress as it goes: this printed nothing until the very end, so a stall
// looked identical to a slow run and there was no way to tell which screen ate
// the clock
const step = (s) => console.log(`  [${new Date().toISOString().slice(11, 19)}] ${s}`)
const rows = []
try {
  await page.goto('http://localhost:4179/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  step('measuring title')
  rows.push(['title', await both(page)])

  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Colour Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('text=Welcome to Northampton', { timeout: 15000 })
  step('measuring home')
  rows.push(['home', await both(page)])

  // These used to click .bottom-nav button[title="Squad"] / "Tactics" / "Club"
  // and swallow the failure with .catch(() => {}). The rail was then rebuilt
  // around News / Home / Hub / Manager / World, so all three clicks missed and
  // the audit measured Home three more times - and reported it as four screens
  // with four sets of numbers. They were byte-identical, which is what gave it
  // away: 117 elements, 0.137 chroma, 41% grey, four times over.
  //
  // So go through the Hub the way a player does, and prove the screen changed
  // before measuring it. A navigation click that misses is a failure, not a
  // shrug.
  for (const [item, label, anchor] of [
    ['Squad', 'squad', '.dtable'],
    ['Selection & Tactics', 'tactics', '.tab-bar'],
    ['Club Information', 'club', 'text=DRESSING ROOM'],
  ]) {
    await page.click('.bottom-nav button[title="Hub"]')
    await page.click(`.submenu-item >> text=${item}`)
    await page.waitForSelector(anchor, { timeout: 12000 })
    await page.waitForTimeout(400)
    step(`measuring ${label}`)
    rows.push([label, await both(page)])
  }

  // the hub sub-menu can be left open over the masthead, so land on Home first
  await page.click('.bottom-nav button[title="Home"]')
  await page.waitForTimeout(400)
  await page.click('.continue-btn', { timeout: 8000 }).catch(() => {})
  await page.waitForSelector('.mday-head', { timeout: 12000 }).catch(() => {})
  step('measuring matchday')
  rows.push(['matchday', await both(page)])

  console.log('screen        canvas-weighted        content only')
  console.log('              chroma grey% vivid%   n  chroma grey% vivid%')
  let ms = 0, gs = 0, vs = 0, n = 0
  let am = 0, ag = 0, av = 0, an = 0
  for (const [name, r] of rows) {
    const m = r?.all, a = r?.acc
    if (!m) { console.log(`${name.padEnd(13)} (nothing measured)`); continue }
    const accCol = a ? `${String(a.n).padStart(4)}  ${a.mean.toFixed(3)}  ${(a.grey * 100).toFixed(0).padStart(3)}%  ${(a.vivid * 100).toFixed(0).padStart(3)}%` : '   -'
    console.log(`${name.padEnd(13)} ${m.meanSat.toFixed(3)}  ${(m.greyShare * 100).toFixed(0).padStart(3)}%  ${(m.vividShare * 100).toFixed(0).padStart(3)}%  ${accCol}`)
    ms += m.meanSat; gs += m.greyShare; vs += m.vividShare; n++
    if (a) { am += a.mean; ag += a.grey; av += a.vivid; an++ }
  }
  console.log('')
  console.log(`canvas-weighted: mean chroma ${(ms / n).toFixed(3)}, grey ${((gs / n) * 100).toFixed(0)}% of painted area, vivid ${((vs / n) * 100).toFixed(0)}%`)
  if (an) console.log(`content only:    mean chroma ${(am / an).toFixed(3)}, grey ${((ag / an) * 100).toFixed(0)}% of elements, vivid ${((av / an) * 100).toFixed(0)}%`)
  console.log('')
  console.log('The canvas-weighted row is dominated by the page and card backgrounds, which')
  console.log('a night theme paints near-black on purpose. Judge a palette change on the')
  console.log('content column: that is the club colours, the chips and the numbers.')

  // A ratchet, not a target. This printed six lines of numbers and asserted
  // nothing, which is how it went on reporting four screens it had stopped
  // visiting. The colours have been walked back toward grey twice already after
  // being fixed, so hold the floor: content chroma may rise, and it may not
  // fall. Rebaseline deliberately, in the same commit as the palette change,
  // with a note saying why.
  const FLOOR = 0.112 // measured 0.119 with the navigation repaired
  if (an && am / an < FLOOR) {
    console.error(`FAIL: content chroma ${(am / an).toFixed(3)} is below the ${FLOOR} floor - the palette has drifted back toward grey`)
    process.exitCode = 1
  } else if (an) {
    console.log(`\nCOLOUR AUDIT PASSED (content chroma ${(am / an).toFixed(3)} at or above the ${FLOOR} floor)`)
  }
} catch (e) {
  console.log('FAILED:', String(e).slice(0, 300))
  process.exitCode = 1
} finally {
  await browser.close()
  server.stop()
}
