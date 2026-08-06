// Does the new touchline furniture actually work?
//
// Feedback 9-2 and 9-4 replaced two dropdowns and a seven-button toolbar with a
// match-day squad sheet and a settings sheet. Neither is on the e2e path, and
// shipping UI that no test has ever clicked is how the last four device bugs got
// out. So this drives them: play to half-time, open the squad, make two changes,
// check the counter moves, and open the settings sheet and change the speed.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const server = spawn('npx', ['vite', 'preview', '--port', '4195', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

let fails = 0
const ok = (cond, what) => { console.log(`${cond ? '  ok' : 'FAIL'} ${what}`); if (!cond) fails++ }

try {
  await page.goto('http://localhost:4195/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Subs')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-veil')

  await page.click('.continue-btn')
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 5000 })
  await page.click('.talk-modal .speech-tile >> nth=0')
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* clean sheet */ }
  await page.waitForSelector('.scoreboard', { timeout: 20000 })

  // ---- the control row: four buttons, and only one of them is a play glyph
  const ctrl = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('.speed-controls .btn')]
    return { n: bs.length, labels: bs.map(b => (b.textContent ?? '').trim()) }
  })
  console.log(`  control row: ${ctrl.n} buttons [${ctrl.labels.join(' | ')}]`)
  ok(ctrl.n === 4, 'the control row is four buttons, not seven')
  const plays = ctrl.labels.filter(l => l.includes('▶')).length
  ok(plays <= 1, `only one play glyph on the row (found ${plays})`)

  // ---- the settings sheet holds speed and sound
  await page.click('.speed-controls .btn >> nth=3')
  await page.waitForSelector('text=Match Settings', { timeout: 5000 })
  ok(await page.locator('text=Commentary speed').count() > 0, 'settings sheet has the speed control')
  ok(await page.locator('.modal .btn >> text=Fast').count() > 0, 'settings sheet has the Fast speed')
  await page.click('.modal .btn >> text=Fast')
  ok(await page.locator('.modal .btn.gold >> text=Fast').count() > 0, 'the chosen speed is marked')
  await page.click('.modal >> text=Back to the Match')
  await page.waitForTimeout(300)
  ok(await page.locator('text=Match Settings').count() === 0, 'settings sheet closes')

  // ---- half time: the squad sheet, several changes in one visit
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Start Second Half', { timeout: 25000 })
  ok(await page.locator('text=Match-Day Squad').count() > 0, 'half-time offers the match-day squad')
  ok(await page.locator('select').count() === 0, 'the quick-sub dropdowns are gone')

  await page.click('text=Match-Day Squad')
  await page.waitForSelector('.squad-sheet', { timeout: 5000 })
  const rows = await page.locator('.sheet-col >> nth=0').locator('.sheet-row').count()
  ok(rows === 15, `the XV is listed in full (${rows} rows)`)
  ok(await page.locator('.sheet-col >> nth=1').locator('.sheet-row').count() > 0, 'the bench is listed')

  const subsLeft = async () => {
    const t = await page.locator('.sheet-head .meta').textContent()
    return parseInt(t ?? '0', 10)
  }
  const before = await subsLeft()
  ok(before === 5, `five changes available at half-time (${before})`)

  // two changes without leaving the sheet, which is the whole point of it
  for (let i = 0; i < 2; i++) {
    // arm a man who is on, then take the first bench option offered
    await page.locator('.sheet-col >> nth=0').locator('.sheet-row:not([disabled])').first().click()
    await page.waitForTimeout(150)
    ok(await page.locator('.sheet-row.armed').count() === 1, `change ${i + 1}: a man is armed`)
    await page.locator('.sheet-col >> nth=1').locator('.sheet-row:not([disabled])').first().click()
    await page.waitForTimeout(300)
    // The sheet surviving the change is the whole point. It did not, at first:
    // the new commentary line pushed events past the cursor, caughtUp went false
    // and the half-time panel unmounted mid-substitution.
    const stillOpen = await page.locator('.squad-sheet').count() > 0
    ok(stillOpen, `change ${i + 1}: the sheet is still open afterwards`)
    if (!stillOpen) break
  }
  // ---- Play at half-time restarts the match, so the resume button at the foot
  // of the panel is never the only way out (user: "the play buttons should
  // trigger the start second half. you shouldn't have to scroll"). It used to do
  // nothing: advanceLive returns early while ctx.awaiting is set, so Play set
  // playing true and the next tick set it back to false.
  const beforeExit = await subsLeft()
  ok(beforeExit === before - 2, `two changes in one visit spent two of the five (${before} -> ${beforeExit})`)
  ok(await page.locator('.sheet-log').count() >= 2, 'both changes are reported in the sheet')
  ok((await page.locator('.squad-sheet .btn.gold').textContent() ?? '').includes('2 changes'), 'the Done button counts the changes')
  await page.click('.squad-sheet .btn.gold')
  await page.waitForTimeout(250)
  ok(await page.locator('.squad-sheet').count() === 0, 'the sheet closes')
  ok((await page.locator('text=Replacements').first().textContent() ?? '').includes('3 of 5'), 'the panel agrees three are left')

  // still at half-time: the control row must say what it will do, and do it
  const playCap = (await page.locator('.speed-controls .btn').first().textContent() ?? '').trim()
  console.log(`  half-time play button reads "${playCap}"`)
  ok(/Second Half/.test(playCap), 'at half-time the play button names the restart')
  await page.click('.speed-controls .btn >> nth=0')
  await page.waitForTimeout(900)
  const resumed = await page.evaluate(() => (document.querySelector('.minute')?.textContent ?? '').trim())
  console.log(`  after pressing Play: "${resumed.slice(0, 40)}"`)
  ok(!/Half-Time/.test(resumed), 'Play restarted the match rather than doing nothing')
  // Not asserting the panel has gone: this probe set the speed to Fast earlier,
  // so within a second of restarting the game can legitimately reach a kickable
  // penalty or the 60' break, both of which put a panel back up. Leaving
  // half-time is the claim being tested.

  // the 60' break is the same state and must behave the same way
  if (/60' Break/.test(resumed)) {
    const brkCap = (await page.locator('.speed-controls .btn').first().textContent() ?? '').trim()
    console.log(`  60' break play button reads "${brkCap}"`)
    ok(/Final Quarter/.test(brkCap), "at the 60' break the play button names the restart")
    await page.click('.speed-controls .btn >> nth=0')
    await page.waitForTimeout(900)
    const after60 = await page.evaluate(() => (document.querySelector('.minute')?.textContent ?? '').trim())
    ok(!/60' Break/.test(after60), "Play restarted the match from the 60' break")
  }
} catch (e) {
  console.error('SUBS PROBE stopped early:', e.message)
  fails++
}

console.log(fails ? `\nSUBS PROBE FAILED (${fails})` : '\nSUBS PROBE PASSED')
await browser.close()
server.kill()
process.exit(fails ? 1 : 0)
