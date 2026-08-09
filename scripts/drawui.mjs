// The draw room, seen for real (F19).
//
// The engine half of the draw is covered by the season harness: the ties are
// recorded for every round the manager is in. What no engine test can see is the
// ceremony itself - that the balls come out one at a time and not all at once,
// that the manager's own tie is called out when it lands, that the room fits a
// phone held upright in the dark, and that closing it puts the draw away for
// good. So the draw is staged into a live save and watched.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { mkdirSync } from 'node:fs'
const SHOTS = 'shots'; mkdirSync(SHOTS, { recursive: true })
const server = await startPreview('4182', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, colorScheme: 'dark' })
const page = await ctx.newPage()
// floodlit before the app boots: the theme the user actually plays in
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))
const fails = []
const check = (ok, label) => { console.log(`  ${ok ? 'ok' : 'FAIL'} ${label}`); if (!ok) fails.push(label) }

const REACH_GAME = `(() => {
  const root = document.getElementById('root')
  const key = Object.keys(root).find(k => k.startsWith('__reactContainer'))
  const seen = new Set(); const stack = [root[key]]
  while (stack.length) {
    const f = stack.pop(); if (!f || seen.has(f)) continue; seen.add(f)
    let h = f.memoizedState, guard = 0
    while (h && guard++ < 60) {
      const v = h.memoizedState
      if (v && typeof v === 'object' && v.userClubId && v.clubs && v.players) return v
      h = h.next
    }
    if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling)
  }
  return null
})()`

try {
  await page.goto('http://localhost:4182/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Draw Tester')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(600)

  // stage a four-tie quarter-final draw with the user in the third ball
  const staged = await page.evaluate(`(() => {
    const g = ${REACH_GAME}
    if (!g) return 'no game'
    const ids = Object.keys(g.clubs).filter(id => id !== g.userClubId)
    const comp = Object.values(g.comps).find(c => /cup|challenge/i.test(c.name)) || Object.values(g.comps)[0]
    g.draw = { compId: comp.id, stage: 'QF', week: g.week, season: g.season, revealed: 0, ties: [
      { homeId: ids[0], awayId: ids[1] },
      { homeId: ids[2], awayId: ids[3] },
      { homeId: ids[4], awayId: g.userClubId },
      { homeId: ids[5], awayId: ids[6] },
    ] }
    return comp.name
  })()`)
  check(staged !== 'no game', `a quarter-final draw is staged in ${staged}`)

  // The day bulletin is where the draw card lives, and Continue is the door to
  // it. That tap is also the redraw: the staging above wrote straight to the live
  // state object, which zustand has no way to notice on its own - the same thing
  // that happens when the engine mutates state during a week and the UI catches
  // up on the next ordinary tap.
  await page.click('.continue-btn')
  await page.waitForTimeout(700)
  const dayText = await page.textContent('.content').catch(() => '')
  check(/draw/i.test(dayText || ''), 'the day room mentions the draw waiting')
  await page.screenshot({ path: `${SHOTS}/draw-day.png` })

  const link = page.locator('.day-draw').first()
  check(await link.count() > 0, 'and it is a card you can tap')
  await link.click()
  await page.waitForTimeout(400)
  check(await page.locator('.draw-room').count() > 0, 'tapping it opens the draw room')

  // reveal every ball
  for (let i = 0; i < 4; i++) {
    const n = await page.locator('.draw-tie').count()
    check(n === i, `${i} ball(s) out before the ${i + 1}${['st','nd','rd','th'][i]} tap`)
    if (i === 2) await page.screenshot({ path: `${SHOTS}/draw-mid.png` })
    await page.locator('.draw-next').click()
    await page.waitForTimeout(250)
  }
  check(await page.locator('.draw-tie').count() === 4, 'all four ties are out')
  check(await page.locator('.draw-tie.ours').count() === 1, 'and exactly one of them is called out as yours')
  const verdict = await page.textContent('.draw-verdict').catch(() => '')
  check(/travel to|at home to/i.test(verdict || ''), `the verdict reads: ${(verdict || '').slice(0, 60)}`)
  check(!/undefined|NaN/.test(await page.textContent('.draw-room')), 'no NaN or undefined anywhere in the room')
  await page.screenshot({ path: `${SHOTS}/draw-full.png` })

  // does it fit the phone, and does the button stay reachable
  const box = await page.locator('.draw-room').boundingBox()
  check(box.x >= 0 && box.x + box.width <= 412.5, `the room fits the screen (${Math.round(box.x + box.width)} of 412)`)
  const btn = await page.locator('.draw-next').boundingBox()
  check(btn.height >= 36, `the button is ${btn.height.toFixed(1)}px tall, which a thumb can hit`)

  await page.locator('.draw-next').click()
  await page.waitForTimeout(400)
  check(await page.locator('.draw-room').count() === 0, 'closing it leaves the draw room')
  const back = await page.textContent('.content')
  check(!/still in the bag/i.test(back), 'and the day room no longer offers a draw that has been made')
  check(errors.length === 0, `console errors: ${errors.length ? errors.join(' | ') : 'none'}`)
} catch (e) {
  fails.push(String(e))
  console.log('THREW', e)
} finally {
  await browser.close(); server.stop()
}
console.log(fails.length ? `\nDRAW UI FOUND ${fails.length} PROBLEM(S)` : '\nDRAW UI PASSED')
process.exit(fails.length ? 1 : 0)
