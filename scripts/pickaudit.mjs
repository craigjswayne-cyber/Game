// Can you tell what you have selected?
//
// User, on the coaching philosophy tiles: "when you select one of the boxes it
// needs to be highlighted as its unclear if you've selected it."
//
// They were right, and the cause was one line: every selectable box in the game
// marks itself with var(--gold), and --gold is #5c6470. A slate grey, left behind
// when the palette went blue. So "selected" was a grey border and a 10% grey wash
// over a navy tile: a luminance change of roughly three percent. Invisible.
//
// No existing test could have caught it. The overlap audit measures pixels
// shared, the scroll audit measures height, the density audit measures ink. None
// of them ever compared a selected thing to an unselected thing. So this does:
// for each family of selectable boxes, pick one, and measure how far the picked
// one has moved away from its neighbours.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const server = spawn('npx', ['vite', 'preview', '--port', '4199', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

let fails = 0
const ok = (cond, what) => { console.log(`${cond ? '  ok' : 'FAIL'} ${what}`); if (!cond) fails++ }

// Perceptual distance in plain sRGB. Not CIE, but the failure this exists to
// catch was a 3% shift against a 26% one - no amount of colour science is needed
// to tell those apart, and a formula nobody can read is a formula nobody checks.
const DIST_MIN = 40           // out of 255-ish; a grey wash scored about 9
const parse = (c) => {
  const m = c.match(/[\d.]+/g)
  if (!m) return null
  let [r, g, b] = m.slice(0, 3).map(Number)
  // getComputedStyle returns color(srgb 0..1) for color-mix results
  if (c.startsWith('color(') || (r <= 1 && g <= 1 && b <= 1)) { r *= 255; g *= 255; b *= 255 }
  return [r, g, b]
}
const dist = (a, b) => {
  const x = parse(a), y = parse(b)
  if (!x || !y) return 0
  return Math.round(Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0)))
}

/** Compare the .sel element in a family against a sibling that is not selected. */
const compare = (page, family) => page.evaluate((sel) => {
  const all = [...document.querySelectorAll(sel)]
  const on = all.find(e => e.classList.contains('sel'))
  const off = all.find(e => !e.classList.contains('sel'))
  if (!on || !off) return { missing: !on ? 'nothing selected' : 'nothing unselected' }
  const read = (el) => {
    const cs = getComputedStyle(el)
    return {
      bg: cs.backgroundColor,
      // a gradient background leaves backgroundColor transparent, so sample the
      // first colour stop instead of scoring the whole thing as "no change"
      grad: (cs.backgroundImage.match(/(rgba?\([^)]*\)|color\(srgb[^)]*\))/) ?? [''])[0],
      border: cs.borderColor,
      shadow: cs.boxShadow,
      badge: getComputedStyle(el, '::after').content,
    }
  }
  return { on: read(on), off: read(off) }
}, family)

const page = await browser.newPage({ viewport: { width: 890, height: 410 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const check = async (label, family) => {
  const r = await compare(page, family)
  if (r.missing) { console.log(`FAIL ${label}: ${r.missing}`); fails++; return }
  const bgOn = r.on.grad || r.on.bg
  const bgOff = r.off.grad || r.off.bg
  const d = dist(bgOn, bgOff)
  const ring = r.on.border !== r.off.border || r.on.shadow !== r.off.shadow
  const badge = r.on.badge && r.on.badge !== 'none' && r.on.badge !== r.off.badge
  console.log(`  ${label}: background moved ${d}, ring ${ring ? 'changed' : 'SAME'}, badge ${badge ? 'yes' : 'no'}`)
  ok(d >= DIST_MIN || (ring && badge), `${label} is unmistakably selected`)
}

try {
  await page.goto('http://localhost:4199/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Top 14')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.club-tile >> text=Northampton')
  await page.waitForTimeout(300)
  await check('club tile', '.club-tile')

  // and the badges must still fit without a scroll or an ellipsis
  const grid = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.club-tile')]
    const rows = new Set(tiles.map(t => Math.round(t.getBoundingClientRect().top)))
    const cut = tiles.map(t => t.querySelector('b')).filter(b => b && b.scrollWidth > b.clientWidth + 1)
    return { n: tiles.length, rows: rows.size, cut: cut.map(b => b.textContent) }
  })
  console.log(`  club picker: ${grid.n} clubs in ${grid.rows} rows`)
  ok(grid.rows <= 2, `a ten-club league fits two rows (${grid.rows})`)
  ok(grid.cut.length === 0, `no club name is cut off (${grid.cut.join(', ') || 'none'})`)

  await page.click('.action-bar >> text=Confirm')
  await page.waitForSelector('.speech-tile')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.waitForTimeout(300)
  await check('coaching philosophy tile', '.speech-tile')

  // the live dressing room uses the same family, so it comes along for free
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Pick')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-veil')
  await page.click('.bottom-nav button[title="Tactics"]')
  await page.waitForSelector('.tab-bar')
  await page.waitForTimeout(400)
  const tabs = await compare(page, '.tab-bar button')
  if (!tabs.missing) {
    console.log(`  tab bar: active tab differs (${tabs.on.bg !== tabs.off.bg || tabs.on.border !== tabs.off.border})`)
  }
} catch (e) {
  console.error('PICK AUDIT stopped early:', e.message)
  fails++
}

console.log(fails ? `\nPICK AUDIT FAILED (${fails})` : '\nPICK AUDIT PASSED')
await browser.close()
server.kill()
process.exit(fails ? 1 : 0)
