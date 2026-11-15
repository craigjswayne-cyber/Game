// Probe: the 1.9.14 round on the screens.
//
//   - "Within my budget" in the transfer filters (social feedback: "maybe make
//     players more affordable"): it narrows the market, it is counted on the
//     filter button, Reset clears it, and it is not offered in Loan, where a
//     loan has its own terms
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const server = await startPreview(0, 3000)

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 746 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

const go = (s, p) => page.evaluate(([s, p]) => window.rugbyStore.getState().go(s, p), [s, p])
const shown = async () => Number(((await page.$eval('.filter-sheet .btn.gold', b => b.textContent)) ?? '').replace(/\D+/g, '') || 0)

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate(() => window.rugbyStore.getState().start('bedford', 'Round 1914'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  await go('transfers')
  await page.waitForSelector('.filter-btn')
  await page.click('.filter-btn')
  await page.waitForSelector('.fs-toggles')
  const toggle = page.locator('.fs-toggle:has-text("Within my budget") input')
  ok(await toggle.count() === 1, 'the transfer filters offer "Within my budget"')
  // a small club looking at the top flight: the budget has to bite (and the
  // list stays under the 120 the sheet shows at most)
  await page.selectOption('#fs-pos', 'FL')
  await page.selectOption('#fs-league', 'prem')
  await page.waitForTimeout(200)
  const before = await shown()
  await toggle.check()
  await page.waitForTimeout(300)
  const after = await shown()
  ok(after < before, `it narrows the market to what the club can pay (${before} to ${after})`)
  await page.click('.filter-sheet .btn.gold')
  await page.waitForTimeout(300)
  ok(/\(\d+\)/.test(await page.$eval('.filter-btn', b => b.textContent)), 'and the filter button counts it as on')
  await page.click('.filter-btn')
  await page.waitForSelector('.fs-toggles')
  await page.click('.filter-sheet .btn.ghost:has-text("Reset")')
  await page.waitForTimeout(200)
  ok(!(await page.locator('.fs-toggle:has-text("Within my budget") input').isChecked()), 'Reset clears it')
  await page.selectOption('.filter-sheet select', 'loan')
  await page.waitForTimeout(200)
  ok(await page.locator('.fs-toggle:has-text("Within my budget")').count() === 0, 'and it is not offered for loans')
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

if (fails) { console.error(`\nUI 1.9.14 PROBE: ${fails} failures`); process.exit(1) }
console.log('\nUI 1.9.14 PROBE PASSED: Within my budget narrows the market, resets and stays out of loans')
done(0)
