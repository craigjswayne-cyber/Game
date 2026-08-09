// Which block is eating the screen?
//
// The scroll audit says a page is 2.46 screenfuls; it does not say what to cut.
// This walks the same four flagged screens and prints the height of every
// top-level block inside main.content, so the density work aims at the tallest
// thing rather than at whatever looks suspicious in the JSX.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4179', 2500)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const dump = async (name) => {
  await page.waitForTimeout(350)
  const rows = await page.evaluate(() => {
    const el = document.querySelector('main.content') ?? document.scrollingElement
    const kids = [...el.children].map(k => ({
      tag: k.tagName.toLowerCase() + (k.className && typeof k.className === 'string' ? '.' + k.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''),
      h: Math.round(k.getBoundingClientRect().height),
      txt: (k.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 34),
    })).filter(k => k.h > 0)
    return { total: el.scrollHeight, view: el.clientHeight, kids }
  })
  console.log(`\n== ${name}: ${(rows.total / rows.view).toFixed(2)} screenfuls (${rows.total}px / ${rows.view}px)`)
  for (const k of rows.kids.sort((a, b) => b.h - a.h)) {
    console.log(`  ${String(k.h).padStart(4)}px  ${k.tag.padEnd(28)} ${k.txt}`)
  }
}

try {
  await page.goto('http://localhost:4179/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await dump('wizard: club pick')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Audit Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await dump('wizard: manager')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('text=Welcome to Leicester Tigers', { timeout: 15000 })
  await dump('home')
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.dtable')
  await dump('squad')
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Selection & Tactics')
  await page.waitForSelector('.tab-bar')
  await dump('tactics: selection')
} catch (e) {
  console.error('BLOCK PROBE stopped early:', e.message)
} finally {
  await browser.close()
  server.stop()
  process.exit(0)
}
