// Exploration pass: load the showcase save in a phone viewport and photograph
// candidate screens. Output: $OUT (default scratch dir). Not shipped.
import { chromium } from 'playwright-core'
import { startPreview, done } from '../lib/preview.mjs'
import { mkdirSync, readFileSync } from 'node:fs'
const OUT = process.env.OUT || 'shots-launch'
mkdirSync(OUT, { recursive: true })
const record = JSON.parse(readFileSync(process.env.SAVE || 'scripts/deepsave.json', 'utf8'))
const server = await startPreview('4231', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 })
await page.addInitScript(() => { localStorage.setItem('rm-night', '1'); localStorage.setItem('rm-lang', 'en') })
await page.goto('http://localhost:4231/')
await page.waitForSelector('text=RUGBY', { timeout: 20000 })
await page.evaluate((rec) => new Promise((res, rej) => {
  const req = indexedDB.open('rugby-manager', 1)
  req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('saves')) req.result.createObjectStore('saves') }
  req.onsuccess = () => { const tx = req.result.transaction('saves', 'readwrite'); tx.objectStore('saves').put(rec, 'deep'); tx.oncomplete = () => res(null); tx.onerror = () => rej(tx.error) }
}), record)
await page.reload()
await page.waitForSelector('text=RUGBY')
await page.click('text=Load Career')
await page.click(`text=${record.state.managerName}`)
await page.waitForSelector('.bottom-nav', { timeout: 20000 })
for (let i = 0; i < 4 && await page.locator('.celebrate-veil').count(); i++) { await page.locator('.celebrate-veil').click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(300) }
await page.waitForTimeout(800)
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
await shot('00-home')
const screens = (process.env.SCREENS || 'inbox,club,profile,legacy,history,annual,transfers,offers,press,tactics,seasonreview,squad,academy,fixtures,tables,report,dreamteam,finances').split(',')
for (const s of screens) {
  await page.evaluate((s) => { const st = window.rugbyStore.getState(); st.home(); st.go(s) }, s)
  await page.waitForTimeout(700)
  await shot(`s-${s}`)
}
await browser.close(); server.stop?.(); done?.(0)
