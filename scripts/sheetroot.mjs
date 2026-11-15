// Probe: every sheet is drawn at the app root, clear of the bottom bar (1.9.13).
//
// Player report from an iPhone, Safari, 390x746, Quins: "When you open
// filters or try to loan a player the navigation banner at the bottom blocks
// search and offer loan button." Both sheets were written inside main.content,
// which scrolls, and mobile Safari clips a fixed box to a scrolling parent,
// so the bottom bar covered their buttons. Ui/Veil.tsx now draws every sheet at
// `.app`. Chromium does not clip the way Safari does, so this checks the
// structure that stops it - neither sheet lives inside main.content - and
// that at the player's screen size the buttons the report names are the
// element under a thumb at their centre.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const server = await startPreview(0, 3000)

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({
  viewport: { width: 390, height: 746 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
})
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

/** Where a sheet sits, and whether `btn` inside it is what a tap at its centre lands on. */
const read = (sheet, btn) => page.evaluate(([sheet, btn]) => {
  const box = document.querySelector(sheet)
  const veil = box?.closest('.modal-veil')
  const b = box?.querySelector(btn)
  if (!box || !veil || !b) return null
  const r = b.getBoundingClientRect()
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return {
    inContent: !!veil.closest('main.content'),
    atRoot: veil.parentElement?.classList.contains('app') ?? false,
    hit: !!top && b.contains(top),
    inView: r.top >= 0 && r.bottom <= window.innerHeight,
    label: b.textContent.trim().slice(0, 40),
  }
}, [sheet, btn])

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate(() => window.rugbyStore.getState().start('harlequins', 'Sheet Root'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  await page.evaluate(() => window.rugbyStore.getState().go('transfers'))
  await page.waitForSelector('.filter-btn')

  // ---- the filter sheet: Show ----
  await page.locator('.filter-btn').first().click()
  await page.waitForSelector('.filter-sheet')
  await page.waitForTimeout(400)
  const f = await read('.filter-sheet', '.btn-row .btn.gold')
  ok(!!f, 'the filter sheet opens with its Show button')
  ok(f && !f.inContent && f.atRoot, `the filter sheet is drawn at the app root, not inside the scrolling screen (${JSON.stringify(f && { inContent: f.inContent, atRoot: f.atRoot })})`)
  ok(f && f.hit && f.inView, `"${f?.label}" is on screen and is what a tap lands on`)

  // Deal: Loan, then close the sheet with a tap on the veil
  await page.locator('.filter-sheet select').first().selectOption('loan')
  await page.locator('.modal-veil').first().click({ position: { x: 5, y: 5 } })
  await page.waitForTimeout(300)

  // ---- the loan sheet: Offer ----
  await page.locator('main.content tbody td.name').first().click()
  await page.waitForSelector('.loan-sheet')
  await page.waitForTimeout(400)
  const l = await read('.loan-sheet', '.btn.gold')
  ok(!!l, 'a loan row opens the loan sheet with its offer button')
  ok(l && !l.inContent && l.atRoot, `the loan sheet is drawn at the app root (${JSON.stringify(l && { inContent: l.inContent, atRoot: l.atRoot })})`)
  ok(l && l.hit && l.inView, `"${l?.label}" is on screen and is what a tap lands on`)

  // ---- and the sheet still works from the root: the tap reaches the game ----
  await page.locator('.loan-sheet .btn.gold').click()
  await page.waitForTimeout(300)
  ok(await page.locator('.loan-sheet').count() === 1, 'the offer is made and the sheet stays to show the answer')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok(await page.locator('.loan-sheet').count() === 0, 'Escape still closes a sheet drawn at the root')
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close()
  server.stop()
}

if (errors.length) {
  console.error(`\nuncaught page errors (${errors.length}):`)
  for (const e of [...new Set(errors)]) console.error('  ' + e)
  fails += errors.length
}

if (fails) { console.error(`\nSHEET ROOT PROBE: ${fails} failures`); process.exit(1) }
console.log('\nSHEET ROOT PROBE PASSED: the filter and loan sheets sit at the root, clear of the bottom bar')
done(0)
