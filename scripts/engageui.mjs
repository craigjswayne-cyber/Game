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

  say('\n--- 1. the ledger on Legacy')
  await page.evaluate(() => {
    const st = window.rugbyStore.getState(); const g = st.game
    g.ledger = [{ k: 'news.ledgerFirstAway', v: { at: 'bath', ground: 'The Rec', opp: 'Bath', tries: 3, tries_k: 'news.ledgerGoes' }, season: g.season, week: g.week }]
    st.go('legacy'); st.touch()
  })
  await page.waitForTimeout(500)
  const legacy = await page.locator('.content').innerText()
  ok(/Gaffer.s Ledger/i.test(legacy), 'Legacy has the ledger section')
  ok(/first win at The Rec/i.test(legacy) && /3 goes/.test(legacy), 'and the first is written in it, plural and all')

  ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
  await page.close()
} finally { await browser.close(); server.stop() }
say(fails ? `\nENGAGE UI FAILED (${fails})` : '\nENGAGE UI PASSED: the ledger reaches the screen')
process.exit(fails ? 1 : 0)
