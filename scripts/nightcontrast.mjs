// Can you read it with the lights off?
//
// The draw room shipped its tie rows with a hard-coded white background, because
// the rule reached for a --card token this stylesheet does not define and the
// fallback took over. In daylight it looked right. At night the card stayed white
// while the team names followed --ink and turned pale, so the draw was four white
// rectangles with the names ghosted out inside them.
//
// Every existing harness looked straight past it. The density audit measures how
// much ink is on the page, and there was plenty. The overlap audit measures
// collisions, and nothing collided. The pick audit compares a selected box to an
// unselected one, and both were equally unreadable. The night sweep takes
// screenshots, which only helps if somebody happens to open the one screen that
// broke. Nothing in the game had ever compared a piece of text to the thing
// painted behind it.
//
// So this does. Night mode, portrait, every screen it can reach: for each run of
// text, find the colour it is painted in and the first real background above it,
// and work out the contrast ratio the way the accessibility standards do. The
// threshold is deliberately far below the AA reading standard - this is not a
// design review, and an argument about whether a caption should be 4.2 or 4.8 is
// not what this is for. It catches text you cannot read at all.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

// AA for body text is 4.5. This fires at 2.2, which is the "something is wrong"
// line rather than the "could be better" line: the ghosted draw names scored 1.3,
// and the softest legitimate caption in the game sits above 3.
const FLOOR = 2.2

const server = spawn('npx', ['vite', 'preview', '--port', '4185', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const findings = []
let measured = 0

/** One pass over the visible text on whatever screen is open. */
const MEASURE = `(() => {
  const parse = (c) => {
    if (!c) return null
    const m = c.match(/[\\d.]+/g)
    if (!m) return null
    let [r, g, b, a] = m.slice(0, 4).map(Number)
    // color-mix() comes back as color(srgb 0..1)
    if (c.startsWith('color(') || (r <= 1 && g <= 1 && b <= 1 && m.length >= 3)) { r *= 255; g *= 255; b *= 255 }
    return { r, g, b, a: a == null ? 1 : a }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const out = []
  for (const el of document.querySelectorAll('*')) {
    // only elements that own text directly: a wrapper's colour is not what is read
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim()
    // one character counts: an arrow, a star and a tick are the entire message
    if (!own.length) continue
    const box = el.getBoundingClientRect()
    if (box.width < 6 || box.height < 6) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    if (parseFloat(cs.opacity) < 0.25) continue          // deliberately faded out
    const fg = parse(cs.color)
    if (!fg || fg.a < 0.35) continue
    // walk up for the first background that actually paints something. A gradient
    // or an image cannot be reduced to one colour, so those elements are skipped
    // rather than guessed at.
    let node = el, bg = null, painted = false
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node)
      if (s.backgroundImage && s.backgroundImage !== 'none') { painted = true; break }
      const c = parse(s.backgroundColor)
      if (c && c.a > 0.5) { bg = c; break }
      node = node.parentElement
    }
    if (painted || !bg) continue
    const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
    out.push({
      text: own.slice(0, 42), cls: el.className || el.tagName.toLowerCase(),
      r: Math.round(ratio(fg, bg) * 10) / 10, fg: hex(fg), bg: hex(bg), on: node.className || node.tagName.toLowerCase(),
    })
  }
  return out
})()`

async function look(label) {
  await page.waitForTimeout(350)
  let rows = []
  try { rows = await page.evaluate(MEASURE) } catch { return }
  measured += rows.length
  const bad = rows.filter(x => x.r < FLOOR)
  // one line per distinct class, not one per row of a table
  const seen = new Set()
  for (const b of bad) {
    const key = `${label}|${b.cls}`
    if (seen.has(key)) continue
    seen.add(key)
    findings.push({ label, ...b })
  }
  if (!rows.length) {
    // a screen painted entirely over a gradient or an image measures nothing, and
    // saying "ok" there would be claiming coverage this harness does not have
    console.log(`  ---- ${label}: nothing measurable (painted over an image or a gradient)`)
    return
  }
  const worst = Math.min(...rows.map(x => x.r))
  console.log(`  ${bad.length ? 'FAIL' : '  ok'} ${label}: ${rows.length} runs of text, worst ratio ${worst}${bad.length ? ` (${new Set(bad.map(b => b.cls)).size} unreadable)` : ''}`)
}

const hub = async (item, label) => {
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click(`.submenu-item >> text=${item}`)
  await look(label)
}
const world = async (item, label) => {
  await page.click('.bottom-nav button[title="World"]')
  await page.click(`.submenu-item >> text=${item}`)
  await look(label)
}

try {
  await page.goto('http://localhost:4185/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await look('title screen')
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await look('league picker')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await look('club picker')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await look('club brief')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Night Reader')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await look('tutorial')
  await page.click('.tut-close .btn')
  await look('home')

  await page.click('.bottom-nav button[title="News"]')
  await look('inbox')
  await page.click('.bottom-nav button[title="Home"]')

  await hub('Squad', 'squad')
  await page.click('.tab-bar >> text=Contracts').catch(() => {})
  await look('squad: contracts')
  await hub('Team Report', 'team report')
  await hub('Transfer Centre', 'transfers')
  await hub('Finances', 'finances')
  await page.click('.tab-bar >> text=Cap & Squad')
  await look('finances: cap and squad')
  await page.click('.tab-bar >> text=The Board')
  await look('finances: the board')
  await hub('Training & Staff', 'training')
  await hub('Medical Centre', 'medical')
  await hub('Fixtures & Results', 'fixtures')
  await hub('Club Infrastructure', 'infrastructure')
  await hub('Club Information', 'club information')
  await world('Competitions', 'competitions')
  await world('Scouting Agency', 'agency')
  await world('International Rugby', 'nations')
  await world('Roll of Honour', 'roll of honour')

  // The draw room, which is where this harness came from. It only exists when a
  // draw is waiting, so one is staged into the live save the same way the draw
  // probe does it, and the Continue tap that opens the bulletin is also what makes
  // react notice the write.
  const staged = await page.evaluate(`(() => {
    const root = document.getElementById('root')
    const key = Object.keys(root).find(k => k.startsWith('__reactContainer'))
    const seen = new Set(); const stack = [root[key]]
    let g = null
    while (stack.length && !g) {
      const f = stack.pop(); if (!f || seen.has(f)) continue; seen.add(f)
      let h = f.memoizedState, guard = 0
      while (h && guard++ < 60) {
        const v = h.memoizedState
        if (v && typeof v === 'object' && v.userClubId && v.clubs && v.players) { g = v; break }
        h = h.next
      }
      if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling)
    }
    if (!g) return false
    const ids = Object.keys(g.clubs).filter(id => id !== g.userClubId)
    const comp = Object.values(g.comps)[0]
    g.draw = { compId: comp.id, stage: 'SF', week: g.week, season: g.season, revealed: 2, ties: [
      { homeId: ids[0], awayId: g.userClubId }, { homeId: ids[1], awayId: ids[2] },
    ] }
    return true
  })()`)
  if (!staged) throw new Error('could not stage a draw for the draw room')
  await page.click('.bottom-nav button[title="Home"]')
  await page.click('.continue-btn')
  await look('day bulletin')
  await page.locator('.day-draw').first().click()
  await look('the draw room')
} catch (e) {
  findings.push({ label: 'the sweep itself', cls: 'threw', text: String(e).slice(0, 120), r: 0 })
  console.log('THREW', e)
} finally {
  await browser.close()
  server.kill()
}

if (findings.length) {
  console.log('\nunreadable in the dark:')
  for (const f of findings) {
    console.log(`  ${f.label}: .${f.cls} at ${f.r}:1 - "${f.text}"`)
    if (f.fg) console.log(`     ${f.fg} text on ${f.bg}, painted by .${f.on}`)
  }
}
console.log(`\n${measured} runs of text measured against the background painted behind them`)
console.log(findings.length
  ? `NIGHT CONTRAST FOUND ${findings.length} PLACE(S) BELOW ${FLOOR}:1`
  : `NIGHT CONTRAST PASSED: nothing on any screen falls below ${FLOOR}:1`)
process.exit(findings.length ? 1 : 0)
