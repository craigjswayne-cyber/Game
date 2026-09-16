// section heights on the two deep pages, at the scroll audit's own viewport
import { chromium } from 'playwright-core'
import { startPreview } from '../lib/preview.mjs'
const server = await startPreview(4188, 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
const sections = async (label) => {
  const rows = await page.evaluate(() => {
    const main = document.querySelector('.screen, main, .content') || document.body
    const el = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 40 && e.clientHeight >= 300) || main
    const kids = [...el.children]
    const inner = kids.length === 1 ? [...kids[0].children] : kids
    return { h: el.scrollHeight, v: el.clientHeight, parts: inner.map(k => ({ tag: k.tagName, cls: k.className?.toString().slice(0, 30), h: k.getBoundingClientRect().height | 0, text: (k.innerText || '').slice(0, 50).replace(/\n/g, ' / ') })) }
  })
  console.log(`\n=== ${label}: ${rows.h}px in ${rows.v}px = ${(rows.h / rows.v).toFixed(2)} screenfuls`)
  for (const p of rows.parts) if (p.h > 0) console.log(`  ${String(p.h).padStart(5)}  ${p.tag} .${p.cls}  ${p.text}`)
}
try {
  await page.goto('http://localhost:4188/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Audit Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('text=Welcome to Leicester', { timeout: 15000 })
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Finances')
  await page.waitForSelector('text=Top Earners', { timeout: 10000 })
  await page.waitForTimeout(400)
  await sections('finances')
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Tactics')
  await page.waitForSelector('.tab-bar')
  await page.click('.tab-bar >> text=Game Plan')
  await page.waitForTimeout(400)
  await sections('tactics: game plan')
} catch (e) { console.log('FAILED', String(e).slice(0, 200)) } finally { await browser.close(); server.stop() }
