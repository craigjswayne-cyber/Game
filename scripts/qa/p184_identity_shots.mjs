// The 1.8.4 identity screenshots at 412x870: the Profile's trajectory line,
// the May letter's method rows and the Job Centre's fit line, from the save
// scripts/qa/p184_identity_save.ts writes.
// Usage: node scripts/qa/p184_identity_shots.mjs <out dir> <save.json>
import { chromium } from 'playwright-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { startPreview } from '../lib/preview.mjs'

const OUT = process.argv[2]
const SAVE = readFileSync(process.argv[3], 'utf8')
mkdirSync(OUT, { recursive: true })
const server = await startPreview('4291', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 870 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errs = []
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
try {
  await page.goto('http://localhost:4291/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Board Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('text=Welcome to Leicester', { timeout: 15000 })
  await page.evaluate((json) => {
    window.rugbyStore.setState({ game: JSON.parse(json) })
    window.rugbyStore.getState().go('profile')
  }, SAVE)
  await page.waitForSelector('.mgr-traits', { timeout: 10000 })
  await page.locator('.mgr-traits').scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -200))
  await page.waitForTimeout(300)
  console.log('profile:', await page.locator('.mgr-traits').innerText())
  await page.screenshot({ path: `${OUT}/p5-profile-trajectory.png` })
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const n = st.game.news.find(x => x.k === 'arc.verdict')
    st.go('inbox')
    window.rugbyStore.setState(s => ({ inboxId: n.id, tick: s.tick + 1 }))
  })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/p5-board-letter.png` })
  console.log('letter:', (await page.locator('body').innerText()).split('\n').filter(l => /verdict|chairman|methods/i.test(l)).join(' | '))
  await page.evaluate(() => window.rugbyStore.getState().go('jobs'))
  await page.waitForSelector('.job-profile', { timeout: 10000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/p5-jobs-fit.png` })
  console.log('fit lines:', await page.locator('.job-fit').count(), await page.locator('.job-fit').allInnerTexts())
} catch (e) {
  console.error('FAIL', e.message)
  await page.screenshot({ path: `${OUT}/p5-error.png` })
}
console.log('console errors:', errs.length ? errs.slice(0, 4) : 'none')
await browser.close()
server.stop()
