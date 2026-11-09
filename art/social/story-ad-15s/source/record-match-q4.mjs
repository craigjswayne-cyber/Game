import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { tapPast } from './lib/sheet.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const OUT = process.argv[2], CLUB = process.argv[3]
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
async function skipTo(label) {
  const until = Date.now() + 60000
  while (Date.now() < until) {
    if (await page.locator(`text=${label}`).first().isVisible().catch(() => false)) return
    if (await page.locator('.sheet-col').first().isVisible().catch(() => false)) {
      await page.locator('.sheet-col >> nth=0').locator('.sheet-row:not([disabled])').first().click({ timeout: 3000 }).catch(() => {})
      await page.locator('.sheet-col >> nth=1').locator('.sheet-row:not([disabled])').first().click({ timeout: 3000 }).catch(() => {})
      await page.locator('.btn', { hasText: /Back to the Match|Done|Close/ }).first().click({ timeout: 3000 }).catch(() => {})
    } else if (await page.locator('.btn', { hasText: 'Take the Points' }).first().isVisible().catch(() => false)) {
      await page.locator('.btn', { hasText: 'Take the Points' }).first().click().catch(() => {})
    } else await page.click('.speed-controls [data-ctl=skip]', { timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(250)
  }
}
try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career'); await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click(`.tile >> text=${CLUB}`)
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'A. Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance'); await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"'); await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await tick()
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
  await page.locator('.btn', { hasText: 'Got it' }).first().click({ timeout: 3000 }).catch(()=>{})
  await skipTo('Start Second Half'); await tapPast(page, 'text="Start Second Half"'); await page.waitForTimeout(300)
  await skipTo('Play the Final Quarter')
  console.log('Q4 start', (await page.locator('.scoreboard').innerText()).split('\n').slice(0,4).join(' '))
  await tapPast(page, 'text="Play the Final Quarter"'); await page.waitForTimeout(200)
  await page.locator('.btn', { hasText: 'Got it' }).first().click({ timeout: 800 }).catch(()=>{})
  await rec('match')
  const scores = []
  const end = Date.now() + 24000
  while (Date.now() < end) {
    // a stoppage that needs an answer: take the points / pick a replacement so play keeps going
    if (await page.locator('.btn', { hasText: 'Take the Points' }).first().isVisible().catch(() => false)) await page.locator('.btn', { hasText: 'Take the Points' }).first().click().catch(()=>{})
    const sb = await page.locator('.scoreboard').innerText().catch(()=> '')
    scores.push([Date.now()/1000, sb.split('\n').slice(0,4).join(' ')])
    if (await page.locator('text=Continue to Results').first().isVisible().catch(()=>false)) { await page.waitForTimeout(3500); break }
    await page.waitForTimeout(250)
  }
  await stop()
  writeFileSync(`${OUT}/scores.json`, JSON.stringify(scores))
  console.log('score', (await page.locator('.scoreboard').innerText()).replace(/\n/g,' '))
} catch (e) { console.error('ERR', e.message); await page.screenshot({ path: `${OUT}/err.png` }) }
writeFileSync(`${OUT}/frames.json`, JSON.stringify(log))
await browser.close(); process.exit(0)
