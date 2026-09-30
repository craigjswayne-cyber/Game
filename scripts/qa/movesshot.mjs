// Screenshots of the playbook on the Tactics Set Piece tab (1.8.2: tap a
// move, watch it run, add it), at a phone's portrait width and at landscape,
// with three frames of the animated preview and the page's depth in screens.
// A look, not a verdict: run after `npm run build`.
//   node scripts/qa/movesshot.mjs [outdir] [move]
import { chromium } from 'playwright-core'
import { startPreview } from '../lib/preview.mjs'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? 'shots-moves'
const move = process.argv[3] ?? 'mv_loop'
mkdirSync(out, { recursive: true })
const PORT = process.env.PORT ?? '4391'
const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
try {
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    const page = await browser.newPage({ viewport: vp })
    await page.goto(`http://localhost:${PORT}/`)
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
    await page.click('[data-sp-sub="moves"]')
    await page.waitForSelector('.mv-card')
    // two in already, so the slots show what they hold
    for (const id of ['mv_1331', 'mv_crash']) {
      await page.click(`.mv-card [data-move="${id}"]`)
      await page.click('.mv-card [data-act="add"]')
    }
    await page.click(`.mv-card [data-move="${move}"]`)
    const svg = page.locator('.mv-preview svg.dg')
    await svg.scrollIntoViewIfNeeded()
    // three frames of the loop: the set-up, the move, the break
    for (const [i, wait] of [[1, 900], [2, 1500], [3, 1900]]) {
      await page.waitForTimeout(wait)
      await svg.screenshot({ path: `${out}/playbook-${name}-frame${i}.png` })
    }
    // ALL=1: one mid-loop frame of every move's preview, for a look at each
    if (process.env.ALL && name === 'phone') {
      for (const id of await page.$$eval('.mv-card [data-move]', bs => bs.map(b => b.dataset.move))) {
        await page.click(`.mv-card [data-move="${id}"]`)
        await page.waitForTimeout(2600)
        await page.locator('.mv-preview svg.dg').screenshot({ path: `${out}/all-${id}.png` })
      }
    }
    await page.evaluate(() => { (document.querySelector('main.content') ?? document.scrollingElement).scrollTop = 0 })
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${out}/playbook-${name}.png` })
    const m = await page.evaluate(() => {
      const el = document.querySelector('main.content') ?? document.scrollingElement
      const c = document.querySelector('.mv-card').getBoundingClientRect()
      const wide = document.documentElement.scrollWidth > document.documentElement.clientWidth
      return { h: el.scrollHeight, v: el.clientHeight, card: Math.round(c.height), wide }
    })
    console.log(`${name}: set piece tab ${(m.h / m.v).toFixed(2)} screens, playbook card ${m.card}px, horizontal scroll ${m.wide}`)
    await page.close()
  }
} finally {
  await browser.close()
  server.stop()
}
process.exit(0)
