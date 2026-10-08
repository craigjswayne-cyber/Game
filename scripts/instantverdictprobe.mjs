// Probe: Instant Result stops at the full-time card (1.8.15).
//
// Found in the release hardening play-through: a manager who let the assistant
// take the match went straight from the match screen to the round-up, so the
// full-time card never showed - the three causes that decided it, the coach's
// two fixes and the marking of last week's homework. Watching was the only way
// to learn why a result went the way it did.
//
// The walk: start a career, set this competition to Instant Result, press the
// big button through the dressing room, and hold the screen to account:
//
//   the match is over and the week has not turned yet
//   the full-time card is up: the score, Continue to Results, the coach's word
//   Continue to Results turns the week and lands on the round-up
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4181, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

try {
  await page.goto('http://localhost:4181/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Instant')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })

  const before = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const fx = g.fixtures.find(f => !f.played && f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))
    g.viewPref = { ...(g.viewPref ?? {}), [fx.compId]: 'instant' }
    st.touch()
    return { week: g.week, season: g.season, fx: fx.id }
  })
  await page.waitForTimeout(200)
  await page.locator('button', { hasText: /Instant Result/ }).first().click()
  await page.waitForTimeout(300)
  if (await page.locator('.talk-modal .speech-tile').count()) await page.click('.talk-modal .speech-tile >> nth=0')
  await page.waitForTimeout(300)
  const go = page.locator('button', { hasText: 'Let Him Take It' }).first()
  if (await go.count()) await go.click()
  await page.waitForSelector('text=Continue to Results', { timeout: 15000 })

  const at = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const lm = st.liveMatch
    return { week: st.game.week, live: !!lm, seg: lm?.ctx.seg, played: st.game.fixtures.find(f => f.id === lm?.fixture.id)?.played ?? null }
  })
  ok(at.live && at.seg === 3, 'the match has been played to the final whistle')
  ok(at.week === before.week, `the week has not turned under the full-time card (week ${at.week})`)
  ok(await page.locator('text=Full Time').count() > 0, 'the full-time scorecard is up')
  ok(await page.locator('.ft-continue').count() === 1, 'Continue to Results is on the card')
  const card = await page.locator('.review-grid').innerText().catch(() => '')
  ok(card.length > 200, `the coach's verdict and the match stats are on it (${card.length} characters)`)

  await page.click('.ft-continue')
  await page.waitForTimeout(800)
  const after = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const top = st.nav[st.nav.length - 1]
    return { week: st.game.week, live: !!st.liveMatch, screen: top?.screen, played: st.game.fixtures.filter(f => f.played).length }
  })
  ok(!after.live && after.week !== before.week, `Continue turns the week (week ${before.week} -> ${after.week})`)
  ok(after.screen === 'results', `and lands on the round-up (${after.screen})`)
} catch (e) {
  say('FAIL  ' + String(e).slice(0, 300)); fails++
}
await browser.close()
say(fails ? `INSTANT VERDICT PROBE FAILED (${fails})` : 'INSTANT VERDICT PROBE PASSED: the assistant\'s result stops at the full-time card')
server.stop()
done(fails)
