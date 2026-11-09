import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { tapPast } from './lib/sheet.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const OUT = process.argv[2]
const server = await startPreview(0, 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const cdp = await page.context().newCDPSession(page)
let cur = null, n = 0, log = []
cdp.on('Page.screencastFrame', async f => {
  if (cur) { const name = `${cur}/${String(n++).padStart(5,'0')}.jpg`; writeFileSync(`${OUT}/${name}`, Buffer.from(f.data, 'base64')); log.push([name, f.metadata.timestamp]) }
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(()=>{})
})
async function rec(name) { cur = name; n = 0; mkdirSync(`${OUT}/${name}`, { recursive: true }); await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 }) }
async function stop() { await cdp.send('Page.stopScreencast'); cur = null }
// a tiny repaint ticker so static moments still produce frames with timestamps
const tick = () => page.evaluate(() => { if (!window.__tk) { const d = document.createElement('div'); d.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;z-index:99999;pointer-events:none'; document.body.appendChild(d); let i=0; window.__tk=setInterval(()=>{d.style.background=(i++%2)?'#000':'#010101'},33) } })

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await tick()
  await page.click('text=New Career'); await page.waitForSelector('text=English Premier Division'); await page.waitForTimeout(400)
  // CLIP: club
  await rec('club'); await page.waitForTimeout(500)
  await page.click('text=English Premier Division'); await page.waitForSelector('.club-tile'); await page.waitForTimeout(900)
  await page.mouse.wheel(0, 300); await page.waitForTimeout(700); await page.mouse.wheel(0, -300); await page.waitForTimeout(500)
  await page.click('.tile >> text=Bath'); await page.waitForSelector('text=Star Player'); await page.waitForTimeout(1600)
  await stop()
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'A. Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance'); await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"'); await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await tick()
  // CLIP: team
  await page.click('.bottom-nav button[title="Hub"]'); await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('text=Starting XV'); await page.waitForTimeout(500)
  await rec('team'); await page.waitForTimeout(400)
  await page.click('text=Best XV'); await page.waitForTimeout(800)
  const rows = page.locator('.dtable tbody tr, .sel-row, [data-slot]')
  for (const [a,b] of [[10,12],[3,5]]) { await rows.nth(a).click().catch(()=>{}); await page.waitForTimeout(450); await rows.nth(b).click().catch(()=>{}); await page.waitForTimeout(800) }
  await stop()
  // CLIP: moves
  await page.click('.bottom-nav button[title="Hub"]'); await page.click('.submenu-item >> text=Tactics')
  await page.waitForSelector('.form-pitch'); await page.click('.tab-bar >> text=Set Piece'); await page.waitForTimeout(300)
  await page.click('[data-sp-sub="moves"]'); await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/moves-start.png` })
  await rec('moves'); await page.waitForTimeout(500)
  for (let k = 0; k < 3; k++) {
    await page.locator('[data-call]').nth(k).click({ timeout: 2000 }).catch(e=>console.log('slot',k,e.message.slice(0,60))); await page.waitForTimeout(550)
    await page.locator('.mv-chips [data-move]').nth(k + 1).click({ timeout: 2000 }).catch(e=>console.log('move',k,e.message.slice(0,60))); await page.waitForTimeout(650)
    await page.locator('[data-act="put"]').first().click({ timeout: 2000 }).catch(e=>console.log('put',k,e.message.slice(0,60))); await page.waitForTimeout(650)
  }
  await page.waitForTimeout(400)
  await stop()
  await page.screenshot({ path: `${OUT}/moves-end.png` })
} catch (e) { console.error('ERR', e.message); await page.screenshot({ path: `${OUT}/err.png` }) }
writeFileSync(`${OUT}/frames.json`, JSON.stringify(log))
await browser.close(); process.exit(0)
