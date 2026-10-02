// Probe: a man borrowed off the loan list leaves the loan list on the spot.
//
// Owner, round 183: "when a player is loaned out, he still appears in the
// available loan list. A loaned player must be removed from that list
// immediately." The engine's list (loans.loanMarket) was already right about
// him; the SCREEN was not. Transfers cached its loan list keyed on the game
// object and the week, and a loan is struck on the same game object in the same
// week, so the cache never noticed and the row stayed until the week turned or
// the screen was left. Only a browser can see that, so this drives one: open
// the loan market, sign a man off it, and read the rows again.
//
// Run: npm run build && node scripts/loanlistui.mjs [port]
import { chromium } from 'playwright-core'
import { writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const PORT = Number(process.argv[2] ?? 4237)
const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/** every name on the current page of the market, from the row's title */
const rows = page => page.locator('tbody td.name').evaluateAll(els => els.map(e => e.getAttribute('title')))

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(6000)
  await page.addInitScript(() => { localStorage.setItem('rm-lang', 'en') })
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate(() => window.rugbyStore.getState().start('newcastle', 'Loan List'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  await page.evaluate(() => window.rugbyStore.getState().go('transfers'))
  await page.waitForTimeout(400)
  // Deal: Loan, in the filter sheet
  await page.locator('.filter-btn').first().click()
  await page.locator('.filter-sheet select').first().selectOption('loan')
  await page.locator('.modal-veil').first().click({ position: { x: 5, y: 5 } })
  await page.waitForTimeout(300)
  const before = await rows(page)
  ok(before.length > 0, `the loan market shows ${before.length} names on its first page`)

  // sign the first man who says yes at the most generous terms
  let signed = null
  for (const name of before) {
    await page.locator(`tbody td.name[title="${name}"]`).first().click()
    await page.locator('.loan-sheet select').nth(1).selectOption('1')
    await page.locator('.loan-sheet .btn.gold').click()
    await page.waitForTimeout(250)
    const gone = await page.locator('.loan-sheet .btn.ghost', { hasText: 'Done' }).count()
    if (gone) { signed = name; await page.locator('.loan-sheet .btn.ghost').click(); break }
    await page.locator('.loan-sheet .btn.ghost').click()
    await page.waitForTimeout(150)
  }
  ok(!!signed, `a parent club said yes${signed ? `: ${signed}` : ''}`)
  if (signed) {
    await page.waitForTimeout(300)
    const after = await rows(page)
    ok(!after.includes(signed), `${signed} is off the loan list the moment he signs (rows now: ${after.length})`)
    // and leaving and coming back does not bring him back either
    await page.evaluate(() => window.rugbyStore.getState().go('squad'))
    await page.waitForTimeout(250)
    await page.evaluate(() => window.rugbyStore.getState().go('transfers'))
    await page.waitForTimeout(300)
    const later = await rows(page)
    ok(!later.includes(signed), `and he is still off it after leaving the screen and coming back`)
  }
  await page.close()
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nLOAN LIST UI FAILED (${fails})` : '\nLOAN LIST UI PASSED: a borrowed man leaves the list at once')
done(fails)
