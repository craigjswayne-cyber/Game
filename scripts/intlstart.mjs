import { mkdirSync } from 'node:fs'
// 1.9.16: the paid "start as an international coach" door, driven with a stand-in store.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
const OUT = process.env.OUT ?? 'shots-intlstart'
mkdirSync(OUT, { recursive: true })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const server = await startPreview(0, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/usr/bin/google-chrome' })
const run = async (mode) => {
  const ctx = await browser.newContext({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.addInitScript((mode) => {
    if (mode === 'nostore') return
    window.__buys = 0
    window.rmBilling = {
      details: async sku => ({ sku, price: '£4.99' }),
      buy: async () => { window.__buys++; return mode === 'cancel' ? 'cancelled' : 'owned' },
      owned: async () => [], ownedState: async () => ({ skus: [], ok: true }),
    }
  }, mode)
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  const card = page.locator('[data-intl-start]')
  if (mode === 'nostore') { ok(await card.count() === 0, 'no store, not owned: the door is not offered on the website'); await ctx.close(); return }
  ok(await card.count() === 1, `${mode}: the door is on the title screen`)
  await page.screenshot({ path: `${OUT}/menu-${mode}.png` })
  const box = await card.boundingBox()
  ok(box.x >= 0 && box.x + box.width <= 384, `${mode}: the card is inside the screen (${Math.round(box.x)} to ${Math.round(box.x + box.width)})`)
  await card.click()
  await page.waitForSelector('[data-intl-wizard]')
  ok(await page.locator('.intl-tile').count() === 16, 'the men\'s game offers sixteen countries')
  ok(await page.locator('[data-intl-go]').isDisabled(), 'the button waits for a country and a name')
  await page.click('[data-nat="ENG"]')
  await page.fill('#intl-name', 'craig swayne')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/wizard-${mode}.png` })
  const over = await page.evaluate(() => [...document.querySelectorAll('.intl-tile, .intl-grid, #intl-name, [data-intl-go]')].filter(e => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth }).length)
  ok(over === 0, 'nothing runs off the side at 384')
  ok((await page.locator('[data-intl-go]').textContent()).trim() === 'Buy and start', 'not owned: the button says Buy and start')
  await page.click('[data-intl-go]')
  await page.waitForTimeout(900)
  const st = await page.evaluate(() => { const g = window.rugbyStore.getState().game; return { buys: window.__buys, game: !!g, nat: g?.natTeam, un: g?.unemployed, name: g?.managerName, news: g?.news.map(n => n.k) } })
  if (mode === 'cancel') {
    ok(st.buys === 1 && !st.game, 'cancelled at the store: one ask, no career started')
    ok(await page.locator('[data-intl-msg]').count() === 1, 'and the reason is printed')
    await page.screenshot({ path: `${OUT}/wizard-cancelled.png` })
  } else {
    ok(st.buys === 1 && st.game && st.nat === 'ENG' && st.un === true, `bought: England head coach, no club (${JSON.stringify(st)})`)
    ok(st.name === 'Craig Swayne', 'the name is capitalised')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/home-after.png` })
    const errs = await page.locator('.error-boundary').count() + await page.locator('text=Something went wrong').count()
    ok(errs === 0, 'Home draws for a coach with a country and no club')
    // back at the title screen he owns it: no second charge
    // the unveiling is over the screen: answer it the way a player does
    for (let i = 0; i < 6 && await page.locator('[data-nat-unveil]').count(); i++) { await page.locator('[data-nat-unveil] button').last().click().catch(() => {}); await page.waitForTimeout(400) }
    await page.screenshot({ path: `${OUT}/home-after2.png` })
    await page.evaluate(() => window.rugbyStore.getState().go('menu'))
    await page.waitForSelector('[data-intl-start]')
    await page.click('[data-intl-start]'); await page.waitForSelector('[data-intl-wizard]')
    ok((await page.locator('[data-intl-go]').textContent()).trim() === 'Start Career', 'owned: the button says Start Career, no second purchase')
  }
  await ctx.close()
}
try { for (const m of ['nostore', 'cancel', 'buy']) await run(m) } catch (e) { console.log('ERR', e.message); fails++ }
await browser.close(); await server.close?.()
console.log(fails ? `INTL START FAILED (${fails})` : 'INTL START PASSED')
process.exit(fails ? 1 : 0)
