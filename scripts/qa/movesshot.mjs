// Screenshots of the attacking moves card on the Tactics Set Piece tab, at a
// phone's portrait width and at landscape, with the page's depth in screens.
// A look, not a verdict: run after `npm run build`.
//   node scripts/qa/movesshot.mjs [outdir]
import { chromium } from 'playwright-core'
import { startPreview } from '../lib/preview.mjs'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? 'shots-moves'
mkdirSync(out, { recursive: true })
const server = await startPreview('4391', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
try {
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    const page = await browser.newPage({ viewport: vp })
    await page.goto('http://localhost:4391/')
    await page.waitForSelector('text=RUGBY', { timeout: 15000 })
    await page.click('text=New Career')
    await page.waitForSelector('[data-league="prem"]')
    await page.click('[data-league="prem"]')
    await page.waitForSelector('.club-tile')
    await page.click('.tile >> text=Leicester')
    await page.waitForSelector('text=Star Player')
    await page.click('.action-bar >> text=Confirm')
    await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Moves Shot')
    await page.click('.speech-tile >> text=Forward Dominance')
    await page.click('.action-bar >> text=Confirm')
    await page.click('text=▸ Start Career')
    await page.waitForSelector('.tut-box', { timeout: 15000 })
    await page.click('.tut-close .btn')
    await page.click('.bottom-nav button[title="Hub"]')
    await page.click('.submenu-item >> text=Tactics')
    await page.waitForSelector('.tab-bar')
    await page.click('.tab-bar >> text=Set Piece')
    await page.waitForSelector('.mv-card')
    await page.click('.mv-card [data-move="mv_loop"]')
    await page.waitForTimeout(300)
    const card = page.locator('.mv-card')
    await card.scrollIntoViewIfNeeded()
    await card.screenshot({ path: `${out}/moves-${name}.png` })
    await page.click('.mv-card [data-call="open"]')
    await page.click('.mv-card [data-move="mv_1331"]')
    await page.waitForTimeout(300)
    await card.screenshot({ path: `${out}/moves-${name}-shape.png` })
    const m = await page.evaluate(() => {
      const el = document.querySelector('main.content') ?? document.scrollingElement
      const c = document.querySelector('.mv-card').getBoundingClientRect()
      const wide = document.documentElement.scrollWidth > document.documentElement.clientWidth
      return { h: el.scrollHeight, v: el.clientHeight, card: Math.round(c.height), wide }
    })
    console.log(`${name}: set piece tab ${(m.h / m.v).toFixed(2)} screens, moves card ${m.card}px, horizontal scroll ${m.wide}`)
    await page.close()
  }
} finally {
  await browser.close()
  server.stop()
}
process.exit(0)
