// Can you read what you typed, on somebody else's phone?
//
// A friend playing the deployed build reported that the manager-name field and
// the leadership dropdowns showed nothing at all: he typed his name and the box
// stayed empty, he picked a captain and the box stayed empty. It was not his
// browser. It was ours.
//
//   .inline-input { background: var(--paper); }   <- no colour
//   :root         { color-scheme: light dark; }   <- browser may go dark
//
// A form control does not inherit `color`. It takes the user agent's, and
// `color-scheme: light dark` tells the user agent it may pick for the reader's
// system theme. So on a phone set to dark mode, in the game's DAY theme, every
// input and select was painted light text on cream paper.
//
// Nobody here ever saw it, for the most boring reason imaginable: the user plays
// in night mode, and `.app.night .inline-input` had always set a colour of its
// own. Every browser probe in the suite sets `rm-night` before it loads the page.
// The one combination that was never once looked at - day theme, dark phone - is
// the default for anybody who tries the game without turning the floodlights on.
//
// There is already a contrast harness - nightcontrast.mjs - and it walks both
// themes. It could not have caught this for two structural reasons. It measures
// elements that own a text node, and an input's value is not a text node, nor is
// a select's chosen option; form controls were invisible to it. And it never
// emulates the reader's system theme, which is the entire trigger.
//
// So this probe runs the pairing the suite was blind to: colorScheme 'dark'
// emulated at the browser, the game left in its day theme, and every visible
// form control measured for real contrast between its own text colour and the
// background actually painted behind it. It also runs night mode with a light
// phone, because the mirror image of a bug is a bug.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4199', 2500)

let fails = 0
const ok = (cond, what) => { console.log(`${cond ? '  ok' : 'FAIL'} ${what}`); if (!cond) fails++ }

// WCAG relative luminance and contrast ratio. 4.5:1 is the readable-body-text
// bar; anything under about 1.6 is the same colour twice.
const MIN_CONTRAST = 4.5

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/** Walk the screens that hold form controls and measure every one of them. */
async function sweep(label, { night, systemScheme }) {
  console.log(`\n=== ${label}: game in ${night ? 'night' : 'day'} theme, phone set to ${systemScheme} ===`)
  const page = await browser.newPage({
    viewport: { width: 412, height: 915 },
    colorScheme: systemScheme,
  })
  await page.addInitScript(n => localStorage.setItem('rm-night', n), night ? '1' : '0')

  // The measurement runs in the page, because the only colours that count are
  // the ones the browser actually resolved. Reading the stylesheet would have
  // agreed with the stylesheet and missed the bug entirely.
  const measure = () => page.evaluate(min => {
    const lum = c => {
      const [r, g, b] = c.map(v => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const parse = s => {
      const m = /rgba?\(([^)]+)\)/.exec(s || '')
      if (!m) return null
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
      return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }
    }
    // what is actually painted behind this element, walking up through
    // transparent ancestors the way the pixels do
    const bgOf = el => {
      for (let n = el; n; n = n.parentElement) {
        const p = parse(getComputedStyle(n).backgroundColor)
        if (p && p.a > 0.5) return p.rgb
      }
      const p = parse(getComputedStyle(document.body).backgroundColor)
      return p ? p.rgb : [255, 255, 255]
    }
    const out = []
    for (const el of document.querySelectorAll('input, select, textarea')) {
      const cs = getComputedStyle(el)
      const t = (el.getAttribute('type') || '').toLowerCase()
      // range sliders and checkboxes carry no text to read
      if (t === 'range' || t === 'checkbox' || t === 'radio' || t === 'file') continue
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || cs.display === 'none') continue
      const fg = parse(cs.color)
      if (!fg) continue
      const bg = bgOf(el)
      const l1 = lum(fg.rgb), l2 = lum(bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      out.push({
        what: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`,
        label: (el.value || el.placeholder || el.options?.[el.selectedIndex]?.text || '').slice(0, 22),
        color: cs.color, bg: `rgb(${bg.join(', ')})`,
        ratio: Math.round(ratio * 100) / 100,
        bad: ratio < min,
      })
    }
    return out
  }, MIN_CONTRAST)

  // A screen that reports no controls is not a pass, it is a miss - so the
  // sweep counts what it actually measured and fails if navigation quietly
  // stopped reaching the fields.
  let measured = 0
  const report = (where, rows) => {
    measured += rows.length
    if (!rows.length) { console.log(`  ${where}: no form controls on screen`); return }
    const worst = rows.reduce((a, b) => (b.ratio < a.ratio ? b : a))
    console.log(`  ${where}: ${rows.length} control(s), worst ${worst.ratio}:1 on ${worst.what} "${worst.label}"`)
    for (const r of rows.filter(r => r.bad)) {
      console.error(`    UNREADABLE ${r.what} "${r.label}": ${r.color} on ${r.bg} = ${r.ratio}:1`)
    }
    ok(!rows.some(r => r.bad), `${where}: every field's text is readable against what is behind it`)
  }

  try {
    await page.goto('http://localhost:4199/')
    await page.waitForSelector('text=RUGBY', { timeout: 15000 })
    await page.click('text=New Career')
    await page.waitForSelector('text=English Premier Division')
    await page.click('text=English Premier Division')
    await page.waitForSelector('.club-tile')
    await page.click('.tile >> text=Northampton')
    await page.waitForSelector('text=Star Player')
    await page.click('.action-bar >> text=Confirm')

    // THE FIRST FIELD IN THE GAME. He could not see his own name in it.
    const nameSel = 'input[placeholder="e.g. A. Gaffer"]'
    await page.waitForSelector(nameSel)
    await page.fill(nameSel, 'A. Gaffer')
    report('the manager-name field', await measure())

    await page.click('.speech-tile >> text=Forward Dominance')
    await page.click('.action-bar >> text=Confirm')
    await page.click('text=▸ Start Career')
    await page.waitForSelector('.tut-box', { timeout: 15000 })
    await page.click('.tut-close .btn')
    await page.waitForSelector('.bottom-nav', { timeout: 15000 })

    // Every screen in the game that holds a field, reached the way a player
    // reaches it. The leadership card is the one in the report, so it goes
    // first, and it is on the Selection page.
    for (const [where, menu, item] of [
      ['the leadership card and selection', 'Hub', 'Team'],
      ['the game-time ledger', 'Hub', 'Team'],
      ['the mentoring picker', 'Hub', 'Training & Staff'],
      ['the medical search', 'Hub', 'Medical Centre'],
      ['the transfer filters', 'Hub', 'Transfer Centre'],
      ['the handbook search', 'Manager', "The Manager's Handbook"],
    ]) {
      await page.click(`.bottom-nav button[title="${menu}"]`)
      await page.waitForSelector('.submenu-item', { timeout: 8000 })
      await page.click(`.submenu-item >> text=${item}`)
      await page.waitForTimeout(600)
      report(where, await measure())
    }

    // and the tactics dropdowns, a tab across from Selection
    await page.click('.bottom-nav button[title="Hub"]')
    await page.click('.submenu-item >> text=Tactics')
    await page.waitForSelector('.tab-bar', { timeout: 8000 })
    for (const tab of ['Roles', 'Set Piece']) {
      if (!(await page.locator(`.tab-bar >> text=${tab}`).count())) continue
      await page.click(`.tab-bar >> text=${tab}`)
      await page.waitForTimeout(450)
      report(`the ${tab.toLowerCase()} page`, await measure())
    }

    // The floor. Fourteen is comfortably under what the sweep finds today and
    // comfortably over zero, so a menu label that gets renamed shows up as a
    // failure here rather than as a quiet row of "no form controls on screen".
    console.log(`  ${measured} controls measured across the sweep`)
    ok(measured >= 14, `the sweep reached the game's fields (${measured} measured, floor 14)`)
  } finally {
    await page.close()
  }
}

try {
  // the pairing that shipped the bug
  await sweep('day theme on a dark phone', { night: false, systemScheme: 'dark' })
  // the mirror image
  await sweep('night theme on a light phone', { night: true, systemScheme: 'light' })
  // and the two that always worked, so a fix cannot break them
  await sweep('day theme on a light phone', { night: false, systemScheme: 'light' })
  await sweep('night theme on a dark phone', { night: true, systemScheme: 'dark' })
} finally {
  await browser.close()
  server.stop()
}

if (fails) { console.error(`\nCONTRAST PROBE: ${fails} failures`); process.exit(1) }
console.log('\nCONTRAST PROBE PASSED')
