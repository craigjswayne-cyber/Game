// THE BOARDROOM, THROUGH THE GLASS (owner, v1.8.3: "in the club section there
// needs to be a board request section ... These actions should impact the
// game.")
//
// scripts/boardroomprobe.ts proves the rules on the state. This proves the
// room is reachable and that the button under the thumb does what the rules
// say: four asks on Club Information, a reason on the ones that are closed,
// a reply written on the card that asked, and a refusal that shuts the door
// visibly rather than silently.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4189', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

let fails = 0
const bad = (m) => { fails++; console.error('FAIL: ' + m) }
const ok = (c, m) => c ? console.log('  ok  ' + m) : bad(m)
const errs = []
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })

try {
  await page.goto('http://localhost:4189/')
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

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Club Information')
  await page.waitForSelector('text=The Boardroom', { timeout: 15000 })
  ok(true, 'the boardroom is on Club Information')

  const titles = ['Ask for more time', 'Ask for more money', 'Ask for a facilities upgrade', 'Ask for a bigger staff budget']
  for (const title of titles) {
    ok(await page.locator('.card').filter({ hasText: title }).count() > 0, `"${title}" is on the page`)
  }

  // week one, nobody is under pressure: the time ask must be closed, and it
  // must SAY why rather than offering a button that refuses
  const timeCard = page.locator('.card').filter({ hasText: 'Ask for more time' }).first()
  ok(await timeCard.locator('button', { hasText: 'Ask the board' }).count() === 0,
    'a closed ask offers no button')
  ok((await timeCard.innerText()).includes('not under pressure'), 'and says why it is closed')

  // and an open one answers on its own card
  const fundsCard = page.locator('.card').filter({ hasText: 'Ask for more money' }).first()
  const before = await fundsCard.innerText()
  await fundsCard.locator('button', { hasText: 'Ask the board' }).first().click()
  await page.waitForTimeout(400)
  const after = await fundsCard.innerText()
  ok(after.length > before.length, 'the board answers on the card that asked')
  ok(!/\{|board\.|reply\./.test(after), 'and answers in words, not keys or placeholders')
  ok(after.includes('recently') || after.includes('transfer budget'),
    `the answer is a refusal or a grant: ${after.split('\n').slice(-1)[0]}`)
} catch (e) {
  bad('boardroom walk broke: ' + e.message)
}

console.log('console errors:', errs.length ? errs.slice(0, 4) : 'none')
if (errs.length) bad(`${errs.length} console error(s) in the boardroom`)
await browser.close()
server.stop()
if (fails) { console.error(`BOARDROOM UI: ${fails} failures`); process.exit(1) }
console.log('BOARDROOM UI PASSED')
