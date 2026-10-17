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
