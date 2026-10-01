// Reading the room, in the browser (round 4, teamtalk.ts).
//
// The engine probe (teamtalkprobe.ts) holds the arithmetic. This holds what a
// manager actually sees on a phone held upright:
//
//   1. the dressing room before kick-off: the moods read against the game in
//      front of them, and five tones to choose from
//   2. the talk given: every man's reaction, in words with a mood arrow, on
//      the stage for the opening minutes, inside the screen, no numbers
//   3. half time: six tones, and the same per-man reactions after the talk
//
// and saves 390x844 screenshots of both talks for the owner.
//
// Run: node scripts/teamtalkui.mjs [outdir]   (port 4197, PORT to override)
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'

const PORT = process.env.PORT ?? '4197'
const OUT = process.argv[2] ?? 'shots-teamtalk'
mkdirSync(OUT, { recursive: true })
const server = await startPreview(PORT, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok' : 'FAIL'} ${what}`); if (!c) fails++ }
const W = 390

/** every reaction row inside the screen, and no digit in the words */
const audit = async (sel) => page.evaluate(([sel, W]) => {
  const rows = [...document.querySelectorAll(`${sel} .tr-list li`)]
  const chips = rows.map(r => r.querySelector('.mood-chip'))
  return {
    n: rows.length,
    arrows: rows.filter(r => r.querySelector('.tr-dir')).length,
    out: chips.filter(c => c && c.getBoundingClientRect().right > W + 0.5).length,
    digits: chips.filter(c => c && /\d/.test(c.textContent ?? '')).length,
    words: [...new Set(chips.map(c => c?.textContent?.trim()))],
  }
}, [sel, W])

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Talker')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  for (let tap = 0; tap < 8; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })
  await page.locator('text=Kick Off ▸').first().click()

  // ---- 1. the room before the talk
  await page.locator('.talk-modal').waitFor({ timeout: 5000 })
  const tiles = await page.locator('.talk-modal .speech-tile b').allInnerTexts()
  console.log(`  pre-match tones: ${tiles.join(' | ')}`)
  ok(tiles.length === 5, `five pre-match tones (${tiles.length})`)
  await page.click('.talk-modal .mood-fold > summary')
  await page.waitForTimeout(250)
  const moods = await page.locator('.talk-modal .mood-chip').allInnerTexts()
  ok(moods.length >= 15, `the room is read man by man before the talk (${moods.length})`)
  await page.screenshot({ path: `${OUT}/talk-pre-room.png` })

  // ---- 2. give it, and see how every man took it
  await page.click('.talk-modal .speech-tile >> text=I believe in you')
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* clean sheet */ }
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    if (st.liveMatch?.playing) st.matchCursor(st.liveMatch.cursor, false)
  })
  await page.locator('.talk-react').first().waitFor({ timeout: 5000 })
  const pre = await audit('.talk-react')
  console.log(`  pre-match reactions: ${pre.words.join(' / ')}`)
  ok(pre.n >= 15, `every man's reaction is on the stage (${pre.n} rows)`)
  ok(pre.arrows === pre.n, 'each with a mood arrow')
  ok(pre.out === 0, 'every reaction sits inside a 390px screen')
  ok(pre.digits === 0, 'and none of them is a number')
  await page.screenshot({ path: `${OUT}/talk-pre-reactions.png` })
  await page.click('.talk-react >> text=Got it')
  ok(await page.locator('.talk-react').count() === 0, 'and it goes when waved away')

  // ---- 3. half time
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => {
      const st = window.rugbyStore.getState()
      const lm = st.liveMatch
      if (!lm) return 'none'
      if (lm.ctx.awaiting === 'HT' && lm.cursor >= lm.events.length) return 'ht'
      if (lm.ctx.decision) { st.decide('posts'); return 'decided' }
      if (lm.playing) st.matchCursor(lm.cursor, false)
      st.skipToBreak()
      return 'skipped'
    })
    if (s === 'ht' || s === 'none') break
    // an injury opens the forced squad sheet: a free swap of two men answers it
    if (await page.locator('.sheet-casualty').count()) {
      const pitch = page.locator('.squad-sheet .sheet-col').nth(0).locator('.sheet-row:not([disabled])')
      await pitch.nth(1).click({ timeout: 800 }).catch(() => {})
      await pitch.nth(2).click({ timeout: 800 }).catch(() => {})
      await page.locator('.squad-sheet .btn.gold').click({ timeout: 1500 }).catch(() => {})
    }
    await page.waitForTimeout(250)
  }
  await page.waitForSelector('text=Start Second Half', { timeout: 15000 })
  const htBtns = page.locator('.panel-area .card >> .fact-label:has-text("Team Talk") + div button')
  const labels = await htBtns.allInnerTexts()
  console.log(`  half-time tones: ${labels.join(' | ')}`)
  ok(labels.length === 6, `six half-time tones (${labels.length})`)
  const score = await page.evaluate(() => {
    const lm = window.rugbyStore.getState().liveMatch
    const mine = lm.ctx.home.teamId === lm.ctx.userSideId ? lm.ctx.home : lm.ctx.away
    const opp = mine === lm.ctx.home ? lm.ctx.away : lm.ctx.home
    return mine.score - opp.score
  })
  // a sensible call for the scoreline, the way a manager would make it
  const pick = score >= 10 ? 'Demand more' : score >= 0 ? 'Stay calm' : 'Show faith'
  console.log(`  margin at the break ${score}: giving "${pick}"`)
  await page.click(`.panel-area button >> text=${pick}`)
  await page.locator('.panel-area .talk-react').waitFor({ timeout: 5000 })
  const ht = await audit('.panel-area .talk-react')
  console.log(`  half-time reactions: ${ht.words.join(' / ')}`)
  ok(ht.n >= 15, `every man still in it reacts at the break (${ht.n} rows)`)
  ok(ht.out === 0 && ht.digits === 0, 'inside the screen, and no numbers')
  await page.locator('.panel-area .talk-react').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/talk-ht.png` })
} catch (e) {
  console.log('FAIL flow: ' + (e?.message ?? e).split('\n')[0])
  fails++
  await page.screenshot({ path: `${OUT}/talk-fail.png` }).catch(() => {})
} finally {
  await browser.close()
  server.stop()
}
console.log(fails ? `\nTEAM TALK UI FAILED (${fails})` : '\nTEAM TALK UI PASSED')
done(fails)
