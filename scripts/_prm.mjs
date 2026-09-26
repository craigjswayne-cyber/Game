import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
const server = await startPreview(4296, 2500)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 844, height: 390 } })
const shot = n => page.screenshot({ path: '/tmp/claude-0/-home-user-Game/2cd33d45-9785-5e90-8c47-ef92d46cc791/scratchpad/prm-' + n + '.png' })
await page.goto('http://localhost:4296/'); await page.waitForSelector('text=RUGBY', { timeout: 20000 })
await shot('title')
await page.click('text=New Career'); await page.click('text=English Premier Division'); await page.waitForSelector('.club-tile')
await page.click('.tile >> text=Northampton'); await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
await page.fill('input[placeholder="e.g. A. Gaffer"]', 'F'); await page.click('.speech-tile >> text=Forward Dominance'); await page.click('.action-bar >> text=Confirm')
await page.click('text=▸ Start Career'); await page.waitForSelector('.tut-box', { timeout: 20000 }); await page.click('.tut-close .btn')
await page.waitForTimeout(500)
await page.evaluate(() => window.rugbyStore.getState().go('inbox')); await page.waitForTimeout(600); await shot('inbox')
for (let t = 0; t < 12 && !(await page.locator('text=Kick Off ▸').count()); t++) { await page.click('.continue-btn'); await page.waitForTimeout(400); if (t === 1) await shot('wire') }
await page.locator('text=Kick Off ▸').first().click(); await page.waitForTimeout(500)
await page.locator('.mood-fold summary').click().catch(() => {}); await page.waitForTimeout(300); await shot('talk')
await page.click('.talk-modal .speech-tile >> nth=0')
try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
await page.waitForSelector('.scoreboard', { timeout: 20000 }); await page.waitForTimeout(5000); await shot('live')
await page.click('button[aria-label="Match menu"]'); await page.waitForTimeout(400); await shot('mp0')
for (let i = 1; i < 5; i++) { await page.click('.mp-dots button >> nth=' + i); await page.waitForTimeout(250); await shot('mp' + i) }
await b.close(); server.kill?.(); server.stop?.(); process.exit(0)
