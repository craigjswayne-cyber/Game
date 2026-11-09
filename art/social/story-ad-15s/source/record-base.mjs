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
  await page.click('text=New Career'); await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Bath')
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'A. Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance'); await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"'); await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await tick()
  // CLIP 1: squad
  await page.click('.bottom-nav button[title="Hub"]'); await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('text=Starting XV'); await page.waitForTimeout(500)
  await rec('squad'); await page.waitForTimeout(500)
  await page.click('text=Best XV'); await page.waitForTimeout(900)
  const rows = page.locator('.dtable tbody tr, .sel-row, [data-slot]')
  console.log('rows', await rows.count())
  for (const [a,b] of [[10,12],[3,5]]) { await rows.nth(a).click().catch(()=>{}); await page.waitForTimeout(450); await rows.nth(b).click().catch(()=>{}); await page.waitForTimeout(900) }
  await page.mouse.wheel(0, 500); await page.waitForTimeout(900); await page.mouse.wheel(0, -500); await page.waitForTimeout(700)
  await stop()
  // CLIP 2: tactics
  await page.click('.bottom-nav button[title="Hub"]'); await page.click('.submenu-item >> text=Tactics')
  await page.waitForSelector('.form-pitch'); await page.click('.tab-bar >> text=Game Plan'); await page.waitForSelector('[data-style="width"]'); await page.waitForTimeout(500)
  await rec('tactics'); await page.waitForTimeout(400)
  for (const s of ['width','kick','offload','direct','width']) { await page.click(`[data-style="${s}"]`, { timeout: 2000 }).catch(()=>{}); await page.waitForTimeout(650) }
  await page.mouse.wheel(0, 600); await page.waitForTimeout(700)
  for (const s of ['blitz','pendulum','drift']) { await page.click(`[data-style="${s}"]`, { timeout: 2000 }).catch(()=>{}); await page.waitForTimeout(650) }
  await stop()
  // CLIP 3: match
  await page.click('.bottom-nav button[title="Home"]')
  for (let t = 0; t < 10; t++) {
    if (await page.locator('text="Kick Off"').count()) break
    await page.click('.continue-btn', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(450)
    if (await page.locator('text=Get On With The Week').count()) await page.click('text=Get On With The Week')
    const rej = page.locator('.btn.danger >> text=Reject'); while (await rej.count()) { await rej.first().click(); await page.waitForTimeout(200) }
  }
  await page.locator('text="Kick Off"').first().click()
  try { await page.locator('.talk-modal').waitFor({ timeout: 3000 }); await page.click('.talk-modal .speech-tile >> nth=0') } catch {}
  try { await page.locator('text="Take the Field"').waitFor({ timeout: 2500 }); await page.click('text="Take the Field"') } catch {}
  await page.waitForSelector('.scoreboard', { timeout: 15000 })
  const speeds = await page.$$eval('.speed-controls [data-ctl]', b => b.map(x => x.dataset.ctl + ':' + x.textContent.trim()))
  console.log('speeds', speeds)
  await page.locator('.btn', { hasText: 'Got it' }).first().click({ timeout: 3000 }).catch(()=>{}); await page.waitForTimeout(300)
  await rec('match')
  await page.waitForTimeout(25000)
  await stop()
  console.log('score', (await page.locator('.scoreboard').innerText()).replace(/\n/g,' '))
} catch (e) { console.error('ERR', e.message); await page.screenshot({ path: `${OUT}/err.png` }) }
writeFileSync(`${OUT}/frames.json`, JSON.stringify(log))
await browser.close(); process.exit(0)
