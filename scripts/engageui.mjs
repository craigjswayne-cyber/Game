// ---- THE BACK PAGE, THE GRUDGE AND THE LEDGER, ON SCREEN ----
//
// engageprobe.ts proves the engine writes them. This proves a player sees
// them: the back page comes up after a match and folds away on a tap, the
// grudge strip sits on Home with the rival's crest, and Legacy has a ledger.
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

  say('\n--- 1. the grudge strip on Home')
  const strip = page.locator('.card.grudge')
  ok(await strip.count() === 1, 'the rival strip is on the home screen')
  const stripText = await strip.innerText()
  ok(stripText.length > 8 && !/\{|home\./.test(stripText), `and it reads as words: "${stripText.slice(0, 70)}"`)
  ok(await strip.locator('svg, img, .crest, [class*=crest]').count() >= 1, "with the rival's crest on it")

  say('\n--- 2. the back page after a match')
  ok(await page.locator('.backpage').count() === 0, 'no back page before a match has been played')
  await page.evaluate(() => {
    const st = window.rugbyStore.getState(); const g = st.game
    const c = g.clubs[g.userClubId]
    const fx = g.fixtures.find(f => f.compId === c.leagueId && (f.homeId === c.id || f.awayId === c.id))
    g.backPage = { fixtureId: fx.id, compId: fx.compId, week: fx.week, hk: 'bp.headComeback',
      hv: { us: 'Leicester', opp: 'Bath', s1: 27, s2: 24, n: 17 }, sk: 'bp.subComeback', sv: { gaffer: 'Their gaffer', us: 'Leicester', opp: 'Bath', s1: 27, s2: 24 } }
    st.touch()
  })
  await page.waitForTimeout(400)
  ok(await page.locator('.backpage').count() === 1, 'the back page comes up')
  const head = await page.locator('.backpage-head').innerText()
  ok(/FROM 17 DOWN/i.test(head) && /27-24/.test(head), `the headline leads with the comeback: "${head}"`)
  ok(!/bp\.|\{/.test(await page.locator('.backpage').innerText()), 'nothing on it is a raw key')
  const box = await page.locator('.backpage').boundingBox()
  ok(box && box.x >= 0 && box.x + box.width <= 413, 'and it fits the phone')
  // IT BLOCKS NOTHING: the bottom nav underneath still takes a tap while
  // the page is showing - the deep test found the first build covering
  // Continue and the Annual door after every match
  const navHit = await page.evaluate(() => {
    const b = document.querySelector('.bottom-nav button'); const r = b.getBoundingClientRect()
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return !!el && (b === el || b.contains(el))
  })
  ok(navHit, 'the game underneath is still tappable while the page is up')
  await page.locator('.backpage .btn.ghost').click()
  await page.waitForTimeout(300)
  ok(await page.locator('.backpage').count() === 0, 'its own button folds it away - a treat, not a gate')

  say('\n--- 3. the ledger on Legacy')
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
say(fails ? `\nENGAGE UI FAILED (${fails})` : '\nENGAGE UI PASSED: the back page, the grudge and the ledger all reach the screen')
process.exit(fails ? 1 : 0)
