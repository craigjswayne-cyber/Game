// Probe: an unfit shirt cannot be sent out.
//
// User: "when a player is injured you shouldn't be able to process the game
// without making changes." The ready check used to be confirmable: the modal
// listed the injured man, promised he would be auto-replaced at kick-off, and
// let you wave the team through blind. Now a bad warning blocks the tunnel -
// the one button that proceeds APPLIES the assistant's re-pick to the actual
// team sheet first, so the change is made in front of you, and Not Yet goes
// back to fix it by hand.
//
// The walk: start a career, injure the starting loosehead through the store
// handle (match morning, no natural walk can stage this on demand), press
// Kick Off, and hold the modal to account:
//
//   it says the team cannot kick off as it is (plain words since round 23 -
//     the old line was "an unfit shirt cannot be sent out")
//   the only way forward carries the fix ("Fix It &" on the button)
//   taking it CHANGES THE TEAM SHEET: the injured man is out of the lineup
//     before the scoreboard exists, not silently patched inside the engine
//   and the match then plays normally
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4179, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

try {
  await page.goto('http://localhost:4179/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gate')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  // walk to match day
  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })

  // match morning: the starting loosehead pulls up in the warm-up - and so
  // does a man on the bench, because the gate has to hold for all 23 (round
  // 25, user: "I had an injured player on the bench and the game play
  // continued. All 23 should be fit and ready to play")
  const hurt = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const club = g.clubs[g.userClubId]
    const pid = club.tactic.lineup[0]
    const p = g.players[pid]
    p.injury = { desc: 'hamstring (warm-up)', until: g.week + 3, weeks: 3 }
    const bid = club.tactic.lineup[16]
    const b = bid != null ? g.players[bid] : null
    if (b) b.injury = { desc: 'calf (warm-up)', until: g.week + 2, weeks: 2 }
    st.touch()
    return { id: pid, name: p.name, benchId: bid, benchName: b?.name ?? null }
  })
  say(`  injured the starting loosehead: ${hurt.name}, and on the bench: ${hurt.benchName}`)

  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 5000 })
  await page.click('.talk-modal .speech-tile >> nth=0')
  await page.locator('.modal .btn.gold').waitFor({ timeout: 5000 })

  const modalText = await page.locator('.modal').innerText()
  ok(/cannot kick off as it is/i.test(modalText), 'the modal says the team cannot kick off as it is')
  ok(/all twenty-three must be fit/i.test(modalText),
    'the injured BENCH man is flagged too: all twenty-three must be fit')
  const goldLabel = await page.locator('.modal .btn.gold').innerText()
  say(`  the way forward reads: "${goldLabel.trim()}"`)
  ok(/Fix It &/i.test(goldLabel), 'the only way forward carries the fix')

  await page.locator('.modal .btn.gold').click()
  await page.waitForSelector('.scoreboard', { timeout: 15000 })

  const after = await page.evaluate(hurtId => {
    const g = window.rugbyStore.getState().game
    const club = g.clubs[g.userClubId]
    return {
      inXV: club.tactic.lineup.slice(0, 15).includes(hurtId),
      anyInjuredIn23: club.tactic.lineup
        .some(id => id != null && g.players[id]?.injury),
    }
  }, hurt.id)
  ok(!after.inXV, `${hurt.name} is out of the team sheet, visibly, not patched in the engine`)
  ok(!after.anyInjuredIn23, 'and nobody injured is anywhere in the repaired 23, bench included')
  say('  the match is under way with a fit twenty-three')
} finally {
  await browser.close()
  server.stop()
}

if (fails) { say(`\nINJURY GATE PROBE: ${fails} failures`); process.exit(1) }
say('\nINJURY GATE PROBE PASSED: no unfit shirt goes down the tunnel')
done(0)
