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
  await page.click('text=New Career'); await page.waitForSelector('text=English Premier Division'); await page.waitForTimeout(500)
  await rec('leagues'); await page.waitForTimeout(500)
  for (const g of ["Women's Game", "Men's Game", "Women's Game", "Men's Game"]) {
    await page.click(`text=${g}`, { timeout: 3000 }).catch(e => console.log('tap', g, e.message.slice(0,60))); await page.waitForTimeout(900)
  }
  await stop()
  await page.screenshot({ path: `${OUT}/leagues-end.png` })
} catch (e) { console.error('ERR', e.message); await page.screenshot({ path: `${OUT}/err.png` }) }
writeFileSync(`${OUT}/frames.json`, JSON.stringify(log))
await browser.close(); process.exit(0)
