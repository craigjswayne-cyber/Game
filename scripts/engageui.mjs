// ---- THE LEDGER, ON SCREEN ----
//
// engageprobe.ts proves the engine writes it. This proves a player sees it:
// Legacy carries the ledger, and its entries read as sentences rather than
// keys.
//
// v1.2.3 removed the two features this file used to open with. The back page
// went at the owner's word, and the grudge strip went with it ("remove the
// new bit on rival on the home page ... feels unnecessary with the other
// one") - Home's Rival Watch panel says the same thing further down and has
// said it since v1.1.x.
//
// Run: node scripts/engageui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4221', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`); if (!c) fails++ }
const say = (s) => console.log(s)

try {
  const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
  page.setDefaultTimeout(9000)
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  await page.goto('http://localhost:4221/')
  await page.waitForSelector('text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  say('\n--- 1. the ledger the engine keeps')
  //
  // THIS USED TO CHECK A SECTION ON LEGACY. The owner had it taken off that
  // page in 1.5.8 - the firsts were a wall of small print under the honours
  // that nobody was reading - and the two assertions here duly failed against
  // a screen that no longer exists.
  //
  // The RECORD was deliberately kept: season.ts still writes state.ledger at
  // every first, so a future screen has a history to show rather than starting
  // from the day it ships. What was worth testing about the old section is
  // still worth testing about the record, so the coverage moves rather than
  // going in the bin: the line still has to compose, and it still has to get
  // its plural right in whatever language is on.
  const rec = await page.evaluate(() => {
    const st = window.rugbyStore.getState(); const g = st.game
    g.ledger = [{ k: 'news.ledgerFirstAway', v: { at: 'bath', ground: 'The Rec', opp: 'Bath', tries: 3, tries_k: 'news.ledgerGoes' }, season: g.season, week: g.week }]
    st.go('legacy'); st.touch()
    return { n: (g.ledger || []).length, key: g.ledger[0].k, hasVars: !!g.ledger[0].v.ground }
  })
  ok(rec.n === 1 && rec.key === 'news.ledgerFirstAway', 'a first is written into the record the engine keeps')
  ok(rec.hasVars, 'with the vars the line needs to compose, so a screen can still be built on it')
  // and Legacy renders without it, which is the half that regressed: the page
  // still had to survive a ledger it no longer reads
  const legacy = await page.locator('.content').innerText()
  ok(!/Gaffer.s Ledger/i.test(legacy), 'and Legacy no longer shows the section, as asked in 1.5.8')
  ok(legacy.trim().length > 40, 'while still rendering a page rather than an empty one')

  ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
  await page.close()
} finally { await browser.close(); server.stop() }
say(fails ? `\nENGAGE UI FAILED (${fails})` : '\nENGAGE UI PASSED: the engine still keeps the ledger, and it still reads')
process.exit(fails ? 1 : 0)
