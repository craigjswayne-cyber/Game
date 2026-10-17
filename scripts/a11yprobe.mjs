// Probe: can the game be driven from a keyboard, and does it say what things are?
//
// The WCAG 2.1 AA pass found about fifty tappable rows, cards and names that a
// keyboard could not reach and a screen reader did not announce, sortable
// headers that were bare <th>s with a click handler, twenty-one form controls
// with no name, and a focus ring drawn in a divider grey at under 2:1. Each was
// fixed in the source and eslint (npm run lint) now refuses the code patterns.
// This is the other half: the rendered game, driven by keys alone.
//
//   1. Tab reaches a squad row, the ring it shows is the palette's
//      --focus-ring at 2px, and Enter on the row opens the player.
//   2. A sortable header is a button inside a th with aria-sort, and Enter on
//      it flips the sort.
//   3. Every visible input, select and textarea on the screens walked has an
//      accessible name.
//   4. Escape closes the hub menu.
//
// Run: node scripts/a11yprobe.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4611', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/** visible form controls with no accessible name, on whatever is open */
const unnamed = page => page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (el.type === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length)
    if (!named) out.push(el.outerHTML.slice(0, 90))
  }
  return out
})
const screen = page => page.evaluate(() => { const n = window.rugbyStore.getState().nav; return n[n.length - 1].screen })

for (const night of [true, false]) {
  const theme = night ? 'night' : 'day'
  say(`\n--- ${theme} ---`)
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
  page.setDefaultTimeout(9000)
  await page.addInitScript(v => localStorage.setItem('rm-night', v), night ? '1' : '0')
  try {
    await page.goto('http://localhost:4611/')
    await page.waitForSelector('text=RUGBY', { timeout: 15000 })
    await page.click('text=New Career')
    await page.click('text=English Premier Division')
    await page.waitForSelector('.club-tile')
    await page.click('.tile >> text=Northampton')
    await page.waitForSelector('text=Star Player')
    await page.click('.action-bar >> text=Confirm')
    const nameSel = 'input[placeholder="e.g. A. Gaffer"]'
    await page.waitForSelector(nameSel)
    let bare = await unnamed(page)
    ok(bare.length === 0, `${theme}: the manager-name step names every field${bare.length ? ': ' + bare[0] : ''}`)
    await page.fill(nameSel, 'Key Board')
    await page.click('.speech-tile >> text=Forward Dominance')
    await page.click('.action-bar >> text=Confirm')
    await page.click('text=▸ Start Career')
    await page.waitForSelector('.tut-box', { timeout: 15000 })
    await page.click('.tut-close .btn')
    await page.waitForSelector('.bottom-nav')

    // 4. Escape closes the hub menu
    await page.click('.bottom-nav button[title="Hub"]')
    await page.waitForSelector('.submenu-veil')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    ok(await page.locator('.submenu-veil').count() === 0, `${theme}: Escape closes the hub menu`)

    // 1. a squad row from the keyboard
    await page.click('.bottom-nav button[title="Hub"]')
    await page.click('.submenu-item >> text="Team"')
    // the Team screen opens on Selection, whose rows pick a shirt; the
    // General Info list is the one whose rows open a player
    await page.click('.tab-bar >> text=General Info')
    await page.waitForSelector('.dtable tbody tr[data-row-nav]')
    const rows = await page.locator('.dtable tbody tr[data-row-nav][tabindex="0"]').count()
    ok(rows >= 15, `${theme}: squad rows are rows a keyboard opens, in the tab order (${rows})`)
    // Tab from the element just before the first row, the way a keyboard gets there
    await page.evaluate(() => {
      const row = document.querySelector('.dtable tbody tr[data-row-nav]')
      const all = [...document.querySelectorAll('button, [href], input, select, [tabindex="0"]')]
      const before = all[all.indexOf(row) - 1]
      before?.focus()
    })
    let landed = false
    for (let i = 0; i < 4 && !landed; i++) {
      await page.keyboard.press('Tab')
      landed = await page.evaluate(() => document.activeElement?.matches('.dtable tbody tr[data-row-nav]') ?? false)
    }
    ok(landed, `${theme}: Tab lands on a squad row`)
    const ring = await page.evaluate(() => {
      const a = document.activeElement
      const cs = getComputedStyle(a)
      const want = getComputedStyle(document.querySelector('.app')).getPropertyValue('--focus-ring').trim()
      const probe = document.createElement('i'); probe.style.color = want; document.body.append(probe)
      const wantRgb = getComputedStyle(probe).color; probe.remove()
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, wantRgb }
    })
    ok(ring.style === 'solid' && ring.width >= 2 && ring.color === ring.wantRgb,
      `${theme}: the focus ring is the palette's --focus-ring (${ring.style} ${ring.width}px ${ring.color}, want ${ring.wantRgb})`)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    ok(await screen(page) === 'player', `${theme}: Enter on the row opens the player (${await screen(page)})`)
    await page.evaluate(() => window.rugbyStore.getState().go('squad'))
    await page.click('.tab-bar >> text=General Info')
    await page.waitForSelector('.dtable th.th-sort')

    // 2. a sortable header from the keyboard
    const th = page.locator('.dtable th.th-sort', { has: page.locator('button.th-btn') }).filter({ hasText: /age/i }).first()
    ok(await th.count() === 1, `${theme}: the Age header holds a real button`)
    const before = await th.getAttribute('aria-sort')
    await th.locator('button').focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(150)
    const after1 = await th.getAttribute('aria-sort')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(150)
    const after2 = await th.getAttribute('aria-sort')
    ok(before === 'none' && after1 !== 'none' && after2 !== after1 && after2 !== 'none',
      `${theme}: Enter sorts by the column and flips it (aria-sort ${before} -> ${after1} -> ${after2})`)

    // 3. named fields on the screens that hold the most of them
    for (const [label, go] of [['transfers', 'transfers'], ['tactics', 'tactics'], ['finances', 'finances'], ['medical', 'medical']]) {
      await page.evaluate(s => window.rugbyStore.getState().go(s), go)
      await page.waitForTimeout(350)
      bare = await unnamed(page)
      ok(bare.length === 0, `${theme}: ${label} names every field${bare.length ? ': ' + bare[0] : ''}`)
    }
    // and the transfer filter sheet, which is most of the selects in the game
    await page.evaluate(() => window.rugbyStore.getState().go('transfers'))
    await page.locator('.filter-line .filter-btn').first().click()
    await page.waitForSelector('.filter-sheet')
    bare = await unnamed(page)
    const selects = await page.locator('.filter-sheet select').count()
    ok(selects >= 6 && bare.length === 0, `${theme}: the transfer filter sheet names all ${selects} selects${bare.length ? ': ' + bare[0] : ''}`)
    await page.keyboard.press('Escape')
  } catch (e) {
    say(`PROBE THREW (${theme}): ${String(e).slice(0, 200)}`)
    fails++
  }
  await page.close()
}

await browser.close()
server.stop()
say(fails ? `\nA11Y PROBE FAILED: ${fails}` : '\nA11Y PROBE PASSED: rows, headers and fields work from a keyboard and say what they are')
done(fails)
