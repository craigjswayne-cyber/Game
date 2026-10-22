/**
 * ---- NOTHING ON A PHONE SCROLLS SIDEWAYS ----
 *
 * Owner, v1.1.17: "On all tabs where they dont fit in like senior rankings/
 * wonderkids/ - make the teams initials or first three letters of their name
 * be used to give space so you dont have to scroll right at all."
 *
 * A table wider than the phone is not a small problem: the columns that fall
 * off the right are the ones nobody ever reads, and a horizontal scroll inside
 * a vertically scrolling page is the fiddliest gesture on a touchscreen.
 *
 * Nothing measured this. scrollaudit counts SCREENFULS - how far down a page
 * runs - at 844x390 landscape, which is the opposite axis on the opposite
 * orientation, so a table hanging 60px off the right of a portrait phone was
 * invisible to the whole suite.
 *
 * The fix these tables needed is the owner's own: a club is three letters
 * (clubCode, the same code its crest draws and the touchline paints) rather
 * than up to eleven - Northampton, Montpellier and La Rochelle are the three
 * that set the width.
 *
 * Run: node scripts/sidescroll.mjs
 */
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview(0, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/** Every scrollable table on the screen, and how far past the edge it runs. */
const overflowOn = async (page, where) => {
  await page.waitForTimeout(350)
  const rows = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('.tblwrap, table.dtable')) {
      const over = el.scrollWidth - el.clientWidth
      if (over > 1) out.push({ cls: el.className, over, w: el.clientWidth })
    }
    // and the page itself must never run sideways
    const doc = document.documentElement
    // AND NO HEADING CUT SHORT (1.9.4): Game Time's Due column is 34px, and
    // the Italian ATTESE and Afrikaans VERWAG were clipped to ATTES and VERWA
    // against the next heading. A heading that does not fit is a column
    // nobody can name.
    const heads = []
    for (const th of document.querySelectorAll('table.dtable thead th')) {
      const el = th.querySelector('.th-btn') ?? th
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') heads.push(`"${th.textContent.trim()}" ${el.scrollWidth}>${el.clientWidth}`)
    }
    return { tables: out, page: doc.scrollWidth - doc.clientWidth, heads }
  })
  ok(!rows.heads.length, `${where}: every heading fits its column${rows.heads.length ? ` (cut: ${rows.heads.join(', ')})` : ''}`)
  const worst = rows.tables.sort((a, b) => b.over - a.over)[0]
  ok(!worst, `${where}: no table runs off the side${worst ? ` (worst ${worst.over}px past a ${worst.w}px box)` : ''}`)
  ok(rows.page <= 1, `${where}: and the page itself does not scroll sideways (${rows.page}px)`)
}

try {
  // FIVE LANGUAGES, NOT ONE (v1.2.2, pre-launch audit item 11). This walked
  // the English UI by its visible labels, which is exactly what makes it
  // unable to walk any other language - and Spanish and Italian run about a
  // fifth longer than English, so the tables most likely to overflow were
  // the ones never measured. The walk goes through the store handle now, by
  // screen id, so it is the same walk in every language.
  for (const lang of ['en', 'fr', 'es', 'it', 'ja', 'af']) {
    const p = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
    p.setDefaultTimeout(9000)
    await p.addInitScript(l => { localStorage.setItem('rm-night', '1'); localStorage.setItem('rm-lang', l) }, lang)
    await p.goto(`${server.origin}/`)
    await p.waitForSelector('text=RUGBY', { timeout: 20000 })
    // Northampton: the longest club name in the game
    await p.evaluate(() => window.rugbyStore.getState().start('northampton', 'Side Scroll'))
    await p.waitForTimeout(700)
    await p.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
    const at = async (screen, where, tab) => {
      await p.evaluate(sc => window.rugbyStore.getState().go(sc), screen)
      await p.waitForTimeout(500)
      if (tab != null) { await p.locator('.tab-bar button').nth(tab).click().catch(() => {}); await p.waitForTimeout(300) }
      await overflowOn(p, `${lang} ${where}`)
    }
    await at('agency', 'Senior Rankings')
    await at('agency', 'Wonderkids', 1)
    await at('dreamteam', 'Team of the Week')
    await at('tables', 'Competitions')
    await at('transfers', 'Transfer Centre')
    await at('squad', 'Squad')
    // the four player tables behind the team sheet (1.9.4, DataTable)
    await at('squad', 'Squad General Info', 1)
    await at('squad', 'Squad Stats', 2)
    await at('squad', 'Squad Game Time', 3)
    await at('squad', 'Squad Contracts', 4)
    await at('finances', 'Finances')
    await p.close()
  }
} catch (e) {
  console.log(`FAIL  the walk itself broke: ${e}`)
  fails++
}

await browser.close()
server.stop()
console.log(fails === 0
  ? '\nSIDE SCROLL PASSED: every table fits the phone it is read on, in five languages'
  : `\nSIDE SCROLL FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
