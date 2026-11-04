// Captures the screenshots in shots/ from the real build, with every player and
// club name swapped for a generated one first. Run the dev server on 5179
// (npx vite --port 5179), then: node docs/launch/social/carousels/capture.mjs <outdir>
// Matches are random, so the live shots differ run to run.
import { chromium } from 'playwright-core'
const OUT = process.argv[2]
const ORIGIN = 'http://localhost:5179'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, locale: 'en-GB' })
page.setDefaultTimeout(20000)
page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)))
await page.addInitScript(() => { localStorage.setItem('rm-night', '1'); localStorage.setItem('rm-lang', 'en') })
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` }).then(() => console.log('shot', n))

const FICTION = async () => page.evaluate(async () => {
  const { regenName } = await import('/src/game/nations.ts')
  let seed = 20261104
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  const st = window.rugbyStore.getState()
  const g = structuredClone(st.game)
  const taken = new Set()
  for (const p of Object.values(g.players)) p.name = regenName(rng, p.nat, taken, g.gender === 'w' ? 'w' : 'm')
  const TOWNS = ['Calder', 'Harrow', 'Wexmoor', 'Ashcombe', 'Thornfield', 'Corrington', 'Stourleigh', 'Bramwell', 'Eastholme', 'Kelmarsh', 'Penhallow', 'Rydal', 'Oakhurst', 'Dunmere', 'Saltby', 'Wrenford']
  const GROUNDS = ['Mill Lane', 'The Lockyard', 'Castle Park', 'Brewery Road', 'The Meadow', 'Station Fields', 'Hollins Park', 'The Quarry', 'Abbey Fields', 'Kiln Street', 'The Rec', 'Ferry Road', 'Moor Park', 'Long Acre', 'Chapel Field', 'The Downs']
  const user = g.userClubId
  const league = g.clubs[user].leagueId
  const mine = Object.values(g.clubs).filter(c => c.leagueId === league)
  mine.sort((a, b) => (a.id === user ? -1 : b.id === user ? 1 : 0))
  const renames = {}
  mine.forEach((c, i) => { const t = TOWNS[i % TOWNS.length]; renames[c.name] = t; renames[c.short] = t; c.name = t + ' RFC'; c.short = t; c.city = t; c.stadium = GROUNDS[i % GROUNDS.length]; c.stadiumBase = c.stadium })
  const PRE = ['Ash','Brack','Cal','Dun','Elm','Fen','Gar','Hol','Kel','Lang','Mar','Nor','Pen','Red','Stan','Thorn','Wex','Wyn','Bel','Cor','Hart','Lyn','Mor','Rav']
  const SUF = ['ford','bury','ton','ley','mere','holt','field','wick','dale','by','combe','stow']
  let k = 0
  for (const c of Object.values(g.clubs)) if (c.leagueId !== league) {
    const t = PRE[k % PRE.length] + SUF[Math.floor(k / PRE.length) % SUF.length]; k++
    renames[c.name] = t; if (c.short.length > 3) renames[c.short] = t; c.name = t; c.short = t; c.city = t; c.stadium = 'Ground ' + k; c.stadiumBase = c.stadium
  }
  const pairs = Object.entries(renames).sort((a, b) => b[0].length - a[0].length)
  const fix = (s) => pairs.reduce((a, [o, n]) => a.split(o).join(n), s)
  const deep = (o) => { if (!o || typeof o !== 'object') return; for (const key of Object.keys(o)) { if (typeof o[key] === 'string') o[key] = fix(o[key]); else deep(o[key]) } }
  deep(g.news); deep(g.press); deep(g.comps)
  window.rugbyStore.setState({ game: g, tick: (st.tick ?? 0) + 1 })
  return mine.map(c => c.name)
})

try {
  await page.goto(`${ORIGIN}/`)
  await page.waitForSelector('.title-screen')
  await page.locator('.menu-btns .btn').first().click()
  await page.waitForSelector('.club-pick')
  await page.locator('.club-pick').first().click()
  await page.waitForSelector('.club-tile')
  await page.locator('.club-tile').nth(4).click()
  await page.waitForSelector('.action-bar .btn.gold')
  await page.locator('.action-bar .btn.gold').click()
  await page.waitForSelector('input.inline-input')
  await page.fill('input.inline-input', 'A. Gaffer')
  await page.locator('.action-bar .btn.gold').click()
  await page.waitForTimeout(300)
  await page.locator('.action-bar .btn.gold').click()
  await page.waitForSelector('.tut-box', { timeout: 30000 })
  await page.locator('.tut-close .btn').click()
  await page.waitForSelector('.bottom-nav')
  console.log(await FICTION())
  await page.waitForTimeout(600)
  const go = async (s) => { await page.evaluate((s) => window.rugbyStore.setState({ nav: [{ screen: 'home' }, { screen: s }] }), s); await page.waitForTimeout(900) }
  await go('home'); await page.evaluate(() => window.rugbyStore.setState({ nav: [{ screen: 'home' }] })); await page.waitForTimeout(700); await shot('home')
  for (const s of ['tactics', 'transfers', 'academy', 'club', 'tables', 'training']) { await go(s); await shot(s) }
  await go('squad'); await shot('teamsheet')
  await page.locator('.tab-bar button').nth(1).click().catch(() => {}); await page.waitForTimeout(500); await shot('squad')
  await page.evaluate(() => window.rugbyStore.setState({ nav: [{ screen: 'home' }] })); await page.waitForTimeout(600)
  for (let i = 0; i < 40 && !(await page.locator('.mday-head').count()); i++) {
    if (await page.locator('.wire-body').count()) await page.locator('.btn-row .btn.gold').last().click().catch(() => {})
    else if (await page.locator('.continue-btn').count()) await page.locator('.continue-btn').click().catch(() => {})
    else break
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(500); await shot('preview')
  await page.locator('.continue-btn').click()
  await page.waitForTimeout(800)
  if (await page.locator('.talk-modal').count()) { await shot('teamtalk'); await page.locator('.talk-modal .speech-tile').first().click(); await page.waitForTimeout(900) }
  if (await page.locator('.modal .btn.gold').count() && !(await page.locator('.live-wrap').count())) { await page.locator('.modal .btn.gold').click(); await page.waitForTimeout(700) }
  await page.waitForSelector('.live-wrap')
  await page.waitForTimeout(1500); await shot('talkreact')
  await page.locator('.talk-react .tr-head .btn').first().click({ timeout: 3000 }).catch(() => {})
  for (let i = 0; i < 60; i++) {
    const txt = await page.evaluate(() => document.body.innerText)
    if (/your call from the touchline/i.test(txt)) { console.log('PEN at', i); await page.waitForTimeout(600); await shot('pencall-raw');
      await page.evaluate(() => { const h = [...document.querySelectorAll('h3')].find(x => /your call/i.test(x.textContent)); h?.closest('.card')?.scrollIntoView({ block: 'center' }) })
      await page.waitForTimeout(500); await shot('pencall'); break }
    await page.waitForTimeout(500)
  }
  for (let i = 0; i < 90 && !(await page.locator('.ft-stamp').count()); i++) {
    await page.keyboard.press('Escape').catch(() => {})
    const g = page.locator('.sheet .btn.gold:visible, .modal .btn.gold:visible, .panel-area .btn.gold:visible')
    if (await g.count()) await g.first().click({ timeout: 2000 }).catch(() => {})
    else { const sk = page.locator('.speed-controls .btn').nth(1); if (await sk.count()) await sk.click({ timeout: 2000 }).catch(() => {}) }
    await page.waitForTimeout(600)
  }
  await page.waitForTimeout(3400); await shot('fulltime')
  for (let y = 1; y < 4; y++) { await page.mouse.move(215, 600); await page.mouse.wheel(0, 650); await page.waitForTimeout(500); await shot('fulltime-' + y) }
} catch (e) { console.log('ERR', e.message.slice(0, 300)); await shot('err') }
await browser.close()
