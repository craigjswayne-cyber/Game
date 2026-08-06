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
import { spawn } from 'node:child_process'

const server = spawn('npx', ['vite', 'preview', '--port', '4179', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const MEASURE = () => {
  // rgb() / rgba() only - that is what getComputedStyle returns
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || '')
    if (!m) return null
    const [r, g, b, a] = m[1].split(',').map(x => parseFloat(x))
    if (a != null && a < 0.35) return null // barely painted
    return [r, g, b]
  }
  const sat = ([r, g, b]) => {
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255
    const l = (mx + mn) / 2
    if (mx === mn) return 0
    return l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn)
  }
  let area = 0, satArea = 0, greyArea = 0, vivid = 0
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > window.innerHeight) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const a = Math.min(r.width, 844) * Math.min(r.height, 390)
    // background if it paints one, otherwise the text colour it contributes
    const bg = parse(cs.backgroundColor)
    const fg = parse(cs.color)
    const c = bg ?? fg
    if (!c) continue
    const s = sat(c)
    area += a
    satArea += s * a
    if (s < 0.12) greyArea += a
    if (s > 0.45) vivid += a
  }
  if (!area) return null
  return {
    meanSat: +(satArea / area).toFixed(3),
    greyShare: +(greyArea / area).toFixed(3),
    vividShare: +(vivid / area).toFixed(3),
  }
}

const rows = []
try {
  await page.goto('http://localhost:4179/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  rows.push(['title', await page.evaluate(MEASURE)])

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
  await page.click('.tut-veil')
  await page.waitForSelector('text=Welcome to Northampton', { timeout: 15000 })
  rows.push(['home', await page.evaluate(MEASURE)])

  for (const [title, label] of [['Squad', 'squad'], ['Tactics', 'tactics'], ['Club', 'club']]) {
    await page.click(`.bottom-nav button[title="${title}"]`).catch(() => {})
    await page.waitForTimeout(450)
    rows.push([label, await page.evaluate(MEASURE)])
  }

  await page.click('.continue-btn')
  await page.waitForSelector('.mday-head', { timeout: 15000 })
  rows.push(['matchday', await page.evaluate(MEASURE)])

  console.log('screen        meanSat  grey%   vivid%')
  let ms = 0, gs = 0, vs = 0, n = 0
  for (const [name, m] of rows) {
    if (!m) { console.log(`${name.padEnd(13)} (nothing measured)`); continue }
    console.log(`${name.padEnd(13)} ${m.meanSat.toFixed(3)}    ${(m.greyShare * 100).toFixed(0)}%     ${(m.vividShare * 100).toFixed(0)}%`)
    ms += m.meanSat; gs += m.greyShare; vs += m.vividShare; n++
  }
  console.log('')
  console.log(`OVERALL mean saturation ${(ms / n).toFixed(3)}, grey ${((gs / n) * 100).toFixed(0)}% of painted area, vivid ${((vs / n) * 100).toFixed(0)}%`)
} catch (e) {
  console.log('FAILED:', String(e).slice(0, 300))
} finally {
  await browser.close()
  server.kill()
}
