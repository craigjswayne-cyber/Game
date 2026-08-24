import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
const server = await startPreview('4224', 3000)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const OUT = '/tmp/claude-0/-home-user-Game/11cac352-0b31-5477-93be-0b56714abd41/scratchpad'
for (const [n, w, h] of [['tall', 412, 870], ['short', 412, 700], ['wide', 430, 932]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
  await page.goto('http://localhost:4224/')
  await page.waitForSelector('.title-screen'); await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/bg-${n}.png` })
  await page.close()
}
await browser.close(); server.stop(); done(0)
