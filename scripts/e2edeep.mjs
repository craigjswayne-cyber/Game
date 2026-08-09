// Deep-save visual QA: inject a 12-season save into IndexedDB, load it,
// and screenshot the late-game screens a fresh-game e2e can never reach.
// Prereq: npx vite-node scripts/deepsave.ts (writes scripts/deepsave.json)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { mkdirSync, readFileSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })
const record = JSON.parse(readFileSync('scripts/deepsave.json', 'utf8'))

const server = await startPreview('4174', 2500)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })
// NIGHT=1 runs the whole flow in the dark theme
const night = process.env.NIGHT === '1'
if (night) await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))
const shot = (name) => page.screenshot({ path: `${SHOTS}/${night ? 'n-' : ''}${name}.png` })
// the app scrolls inside .content, so fullPage cannot see below the fold
const scrollTo = (frac) => page.evaluate((f) => {
  const el = document.querySelector('.content')
  if (el) el.scrollTop = (el.scrollHeight - el.clientHeight) * f
}, frac)
const shotScrolled = async (name) => {
  await shot(`${name}-top`)
  await scrollTo(0.5); await page.waitForTimeout(150); await shot(`${name}-mid`)
  await scrollTo(1); await page.waitForTimeout(150); await shot(`${name}-end`)
}

try {
  await page.goto('http://localhost:4174/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })

  // plant the save, then reload so the title screen lists it
  await page.evaluate((rec) => new Promise((resolve, reject) => {
    const req = indexedDB.open('rugby-manager', 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('saves')) req.result.createObjectStore('saves')
    }
    req.onsuccess = () => {
      const tx = req.result.transaction('saves', 'readwrite')
      tx.objectStore('saves').put(rec, 'deep')
      tx.oncomplete = () => resolve(null)
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  }), record)
  await page.reload()
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=Load Career')
  await page.click('text=Deep Gaffer')
  // Home used to list the headlines, so this waited on .news-item. The inbox
  // then moved to its own screen (user: "inbox and summary should be
  // separated") and Home kept only the unread cue, so .news-item can no longer
  // appear here at all and this probe had been failing on its first step ever
  // since. The dashboard is the thing to wait for.
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  // A trophy the save was carrying now raises the celebration veil, which
  // swallows every click behind it. It used to be an orphaned block statement
  // that never rendered at all, so no harness had ever met it. Tap it away.
  for (let i = 0; i < 4 && await page.locator('.celebrate-veil').count() > 0; i++) {
    await page.locator('.celebrate-veil').click({ position: { x: 5, y: 5 } })
    await page.waitForTimeout(300)
  }
  await page.waitForSelector('.dash-head', { timeout: 15000 })
  await shot('deep-01-home')

  // the Annual: annals table + POTY roll of honour, 12 seasons deep
  await page.click('text=The Annual is out')
  await page.waitForSelector('text=The Annals', { timeout: 10000 })
  // FL surface: the award row must survive into a deep career's Annual
  await page.waitForSelector('text=Try of the season', { timeout: 10000 })
  await shotScrolled('deep-02-annual')
  await page.click('.back-btn')

  // club information: era records, dressing room, record books after 12 years
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Club Information')
  await page.waitForSelector('text=DRESSING ROOM', { timeout: 10000 })
  await shotScrolled('deep-03-club')

  // world: test rankings with movement, roll of honour, hall of fame
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Scouting Agency')
  await page.waitForSelector('text=Senior Rankings: World', { timeout: 10000 })
  await page.click('.tab-bar >> text=Test Nations')
  await page.waitForSelector('text=Test Rankings: World', { timeout: 10000 })
  await shotScrolled('deep-04-nations')
  await page.click('.bottom-nav button[title="World"]')
  await page.click('.submenu-item >> text=Roll of Honour')
  await page.waitForTimeout(600)
  await shotScrolled('deep-05-history')

  // manager: profile with 12 seasons of trophies and badges
  // the systems built in the 8-batch, seen in a twelve-season career
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Club Infrastructure')
  await page.waitForSelector('text=Facilities', { timeout: 10000 })
  await shot('deep-06-infrastructure')
  await page.click('.tab-bar >> text=The League')
  await page.waitForSelector('text=League Estates')
  await shot('deep-06b-league-estates')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Training & Staff')
  await page.click('.tab-bar >> text=Staff')
  await page.waitForSelector('text=Backroom Staff', { timeout: 10000 })
  await shot('deep-07-staff')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Transfer Centre')
  await page.click('.tab-bar >> text=Shortlist')
  await page.waitForSelector('text=Commissioned Search', { timeout: 10000 })
  await shot('deep-08-scout-report')

  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Manager Profile')
  await page.waitForTimeout(600)
  // FP surface: the challenge (live or conquered) must show on the profile
  await page.waitForSelector('text=Sauvez Sapiac', { timeout: 10000 })
  // Finances with a season's worth of history: the chips and the balance graph
  // should share a row in landscape, which week one can never show
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Finances')
  await page.waitForSelector('text=Top Earners', { timeout: 10000 })
  await shot('deep-10-finances')
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Manager Profile')
  await page.waitForTimeout(600)

  const dec = await page.locator('text=what you chose, and what it did').count()
  console.log('decisions card present:', dec > 0)
  if (dec > 0) {
    await page.locator('text=what you chose, and what it did').scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await shot('deep-09-decisions')
  }
  await shotScrolled('deep-06-profile')
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Manager Legacy')
  await page.waitForTimeout(600)
  await shotScrolled('deep-07-legacy')

  console.log('DEEP QA COMPLETE')
} catch (e) {
  await shot('deep-99-failure')
  console.error('DEEP QA FAILED:', e.message)
} finally {
  console.log('console errors:', errors.length ? errors.slice(0, 10) : 'none')
  await browser.close()
  server.stop()
  process.exit(0)
}
