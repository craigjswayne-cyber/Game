// The injury-wait sheet (1.9.1) opens over the match whenever the manager's
// own man goes down, and nothing under it can be tapped until he names a
// replacement. A harness that taps a match button (Start Second Half, Play the
// Final Quarter) meets it at random, so it answers the sheet first, as a
// manager would: the man the match is waiting on, then each tappable bench
// row until one is taken, then back to the match.

/** Answer an open squad sheet; a no-op when none is open. */
export async function answerSheet(page) {
  for (let round = 0; round < 4 && await page.locator('.squad-sheet').count(); round++) {
    await page.locator('.squad-sheet .sheet-col >> nth=0').locator('.sheet-row:not([disabled])').first().click({ timeout: 3000 }).catch(() => {})
    const rows = page.locator('.squad-sheet .sheet-col >> nth=1').locator('.sheet-row:not([disabled])')
    const n = await rows.count().catch(() => 0)
    for (let k = 0; k < Math.min(n, 8); k++) {
      if (await page.locator('.squad-sheet .btn.gold:not([disabled])').count()) break
      await rows.nth(k).click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(150)
    }
    await page.locator('.squad-sheet .btn.gold:not([disabled])').first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
}

/** Tap a match button, answering the injury sheet first if it is in the way. */
export async function tapPast(page, selector, timeout = 30000) {
  const until = Date.now() + timeout
  for (;;) {
    await answerSheet(page)
    try { await page.click(selector, { timeout: 4000 }); return } catch (e) {
      if (Date.now() > until) throw e
    }
  }
}

/**
 * Skip the match on until `label` shows, answering whatever stops the clock on
 * the way: the injury sheet, or a kickable penalty's touchline call. Throws
 * if the label has not come in `timeout` ms.
 */
export async function skipTo(page, label, timeout = 40000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if (await page.locator(`text=${label}`).first().isVisible().catch(() => false)) return
    if (await page.locator('.squad-sheet').count()) await answerSheet(page)
    else if (await page.locator('.btn', { hasText: 'Take the Points' }).first().isVisible().catch(() => false)) {
      await page.locator('.btn', { hasText: 'Take the Points' }).first().click().catch(() => {})
    } else await page.click('.speed-controls [data-ctl=skip]', { timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(250)
  }
  await page.waitForSelector(`text=${label}`, { timeout: 1000 })
}
