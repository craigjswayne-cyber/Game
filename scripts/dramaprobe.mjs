// Probe: the match ANIMATION reads the match, not the clock.
//
// The owner played four games live on 25 August and said: "the animation of
// match play needs working on to be more realistic. it should reflect momentum
// and possession. it should build and make you edgy if the score is close."
//
// He was right, and the cause was one line. The ball on the pitch mock-up sat
// at `50 + dir * (10 + min % 20)` - a SAWTOOTH ON THE CLOCK. It crawled up the
// field for twenty minutes, snapped back to halfway and did it again, and none
// of it had ever had anything to do with the game being played. Two centimetres
// above it the scoreboard drew ctx.momo, a real tuned momentum figure, on a
// needle. The presentation had the number and did not read it.
//
// v1.1.1 (docs/match-drama.md) reads it:
//   territory = 50 + momo * 30, nudged +-9 by whose event this was
//   tension   = late * close, and the beat between events stretches by up to
//               60% when both are true
//   a band on the scoreboard names the state, STATIC, because reduced motion
//               collapses every duration in this codebase
//
// So this probe holds all three, and holds them the only way that means
// anything: by driving a real match and reading the actual pixels the actual
// renderer produced.
//
//   1. every ball position is exactly the territory model, to 0.01%
//   2. and is demonstrably NOT the sawtooth it used to be
//   3. a one-score finish paces slower than a rout, measured on the wall clock
//   4. the band appears only when late AND close, and says the right thing
//   5. the ball never leaves the pitch
//
// Run: node scripts/dramaprobe.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview(4257, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

try {
  await page.goto('http://localhost:4257/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Drama')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')

  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 6000 })
  await page.click('.talk-modal .speech-tile >> nth=0')
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* clean sheet, no warning to clear */ }
  await page.waitForSelector('.scoreboard', { timeout: 20000 })

  // ---- 0. what Skip decided for you
  //
  // The owner played four matches and asked whether the touchline calls were
  // still in the game. They were - Skip was taking every one of them at the
  // posts and never saying a word. A decision is forced here rather than
  // waited for, so this tests the reporting on every run and not on the 70%
  // of first halves that happen to produce a kickable penalty.
  const skipped = await page.evaluate(async () => {
    const S = () => window.rugbyStore.getState()
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    S().liveMatch.ctx.decision = { kind: 'penalty', min: S().liveMatch.ctx.events.at(-1)?.min ?? 5 }
    S().skipToBreak()
    await frame()
    const el = document.querySelector('.skip-took')
    const took = S().liveMatch.skipTook
    S().startSecondHalf()
    await frame()
    return { took, note: el ? el.textContent.trim() : null, after: !!document.querySelector('.skip-took') }
  })
  ok(skipped.took >= 1, `Skip counts the calls it answers (${skipped.took})`)
  ok(!!skipped.note && /\d/.test(skipped.note), `and the scoreboard says so: "${skipped.note}"`)
  ok(skipped.after === false, 'and the note goes when play restarts - it is about the skip, not the match')

  // ---- 1-2. drive the rest of the match, sampling what the renderer drew
  //
  // The reveal is driven by hand rather than by the component's own timer, for
  // one reason that matters: advanceLive() sets the store and THEN React
  // renders, so the momo read after the call is exactly the momo the render
  // used. Waiting on a heartbeat would sample a moving target - which is how
  // the first two attempts at measuring the kick animation went wrong.
  const samples = await page.evaluate(async () => {
    const S = () => window.rugbyStore.getState()
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const out = []
    const homeId = S().liveMatch.fixture.homeId
    for (let i = 0; i < 500; i++) {
      const lm = S().liveMatch
      if (!lm) break
      if (lm.ctx.seg === 3 && lm.cursor >= lm.ctx.events.length) break
      if (lm.ctx.decision) { S().decide('posts'); continue }   // answer the touchline
      if (lm.ctx.awaiting) { S().startSecondHalf(); continue } // and the intervals
      if (!lm.playing) S().matchCursor(lm.cursor, true)
      S().advanceLive()
      await frame()
      const now = S().liveMatch
      if (!now) break
      const ev = now.ctx.events[now.cursor - 1]
      const ball = document.querySelector('.pitch .ball')
      if (!ev || !ball) continue
      out.push({
        left: parseFloat(ball.style.left), momo: now.ctx.momo,
        min: ev.min, type: ev.type, home: ev.teamId === homeId,
      })
    }
    return out
  })

  const clamp = x => Math.max(6, Math.min(94, x))
  const play = samples.filter(s => s.type !== 'TRY' && s.type !== 'PEN' && s.type !== 'DG')
  say(`  drove the rest of the match: ${samples.length} revealed events, ${play.length} of them open play`)
  ok(play.length >= 10, `enough open play to measure (${play.length})`)

  const err = play.map(s => Math.abs(s.left - clamp(50 + s.momo * 30 + (s.home ? 9 : -9))))
  const worst = Math.max(...err)
  ok(worst < 0.01, `every ball position IS the territory model (worst error ${worst.toFixed(4)}%)`)

  // and is not what it used to be: the old sawtooth, scored against the same
  // events, would have put the ball somewhere else entirely
  const sawErr = play.map(s => Math.abs(s.left - clamp(50 + (s.home ? 1 : -1) * (10 + (s.min % 20)))))
  const sawMean = sawErr.reduce((a, b) => a + b, 0) / (sawErr.length || 1)
  ok(sawMean > 5, `and is nothing like the clock sawtooth it replaced (mean ${sawMean.toFixed(1)}% apart)`)

  const spread = Math.max(...play.map(s => s.left)) - Math.min(...play.map(s => s.left))
  ok(spread > 12, `the ball uses the field rather than sitting on halfway (${spread.toFixed(1)}% spread)`)
  ok(samples.every(s => s.left >= 6 && s.left <= 94), 'and never once leaves the pitch')

  // ---- 3-4. pacing and the band, on fabricated end-games
  //
  // The match is at full time and every event is on the books, so the cursor
  // can be wound back and the tail REPLAYED - advanceLive only reveals when
  // the cursor trails the events, so nothing is re-simulated and the engine is
  // not touched. Rewriting the scores on those stored events is what lets one
  // real match be both a nail-biter and a rout.
  const measure = (margin, fromMin, k) => page.evaluate(async ([margin, fromMin, k]) => {
    const S = () => window.rugbyStore.getState()
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const lm = S().liveMatch
    const evs = lm.ctx.events
    // the last k events at or past that minute, backed off the end so the
    // window always fits: a cursor at events.length is full time, and full
    // time reveals nothing
    const first = evs.findIndex(e => e.min >= fromMin)
    const start = Math.max(1, Math.min(first < 0 ? evs.length : first, evs.length - 1 - k))
    if (start + k >= evs.length) return { bad: `no ${fromMin}' tail (${evs.length} events)` }
    for (const e of evs) { e.homeScore = 40; e.awayScore = 40 - margin }
    S().matchCursor(start, true)
    await frame()
    const t0 = performance.now()
    while (S().liveMatch && S().liveMatch.cursor < start + k) {
      if (performance.now() - t0 > 40000) break
      await new Promise(r => setTimeout(r, 15))
    }
    const ms = performance.now() - t0
    S().matchCursor(start, false)
    return { ms, per: ms / k }
  }, [margin, fromMin, k])

  /** Park the ticker on an event at roughly `atMin` with a fabricated margin,
   *  and report what the scoreboard says about it. */
  const bandAt = (margin, atMin) => page.evaluate(async ([margin, atMin]) => {
    const S = () => window.rugbyStore.getState()
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const evs = S().liveMatch.ctx.events
    for (const e of evs) { e.homeScore = 40; e.awayScore = 40 - margin }
    // An event to stand on - any event, never the final one: a cursor at
    // events.length is full time, and full time is not tense, it is over.
    // The minute is then FABRICATED onto it, exactly like the scores above,
    // and for the same reason. Two rounds of depending on the generated
    // match's own minutes both lost: asking for an event at 76' failed the
    // run whose match had nothing past 74', and falling back to the last
    // event "while it is still late" (≥70') failed the next run, because
    // late is not one threshold - the band needs late × close > 0.45, so
    // level shows from 67', a kick in it from 70', but a SCORE in it
    // (close = 4/7) needs 75' - and a 74' stand-in banded for two margins
    // and rendered null for the third. This assertion is about what the
    // band SAYS at a margin, not about where one match's events happened
    // to land, so the minute is now part of the fixture: park on the event
    // and make it minute atMin. Every run tests the same three sentences.
    let idx = -1
    for (let i = 0; i < evs.length - 1; i++) if (evs[i].min >= atMin) { idx = i; break }
    if (idx < 0) idx = evs.length - 2
    if (idx < 0) return { bad: `a match with ${evs.length} events has no event to park on` }
    evs[idx].min = atMin
    S().matchCursor(idx + 1, false)
    await frame()
    const band = document.querySelector('.tense-band')
    return { min: evs[idx].min, band: band ? band.textContent.trim() : null }
  }, [margin, atMin])

  const K = 3
  const rout = await measure(30, 68, K)   // 40-10 with a dozen to go: over
  const tight = await measure(0, 68, K)   // 40-40 with a dozen to go: not over
  for (const [name, r] of [['rout', rout], ['tight', tight]]) if (r.bad) ok(false, `${name}: ${r.bad}`)

  say(`  pacing: rout ${rout.per?.toFixed(0)}ms/event, one-score ${tight.per?.toFixed(0)}ms/event`)
  ok(tight.per > rout.per * 1.2, `a one-score finish is paced slower than a rout (${(tight.per / rout.per).toFixed(2)}x)`)
  ok(rout.per < 1000, `and the rout keeps the speed the manager chose (${rout.per?.toFixed(0)}ms, Slow is 900)`)

  const bBlow = await bandAt(30, 74)   // late, but long since decided
  const bEarly = await bandAt(0, 20)   // level, but it is the first quarter
  const bLevel = await bandAt(0, 74)   // both
  const bKick = await bandAt(3, 76)    // a penalty in it
  const bScore = await bandAt(6, 76)   // a converted try in it
  for (const [name, r] of [['blowout', bBlow], ['early', bEarly], ['level', bLevel], ['kick', bKick], ['score', bScore]]) {
    if (r.bad) ok(false, `${name}: ${r.bad}`)
  }
  ok(bBlow.band === null, `no tension band in a blowout (${bBlow.min}', 30 points in it)`)
  ok(bEarly.band === null, `and none at ${bEarly.min}', level or not - it is not late`)
  ok(!!bLevel.band && /\d/.test(bLevel.band), `level and late says so: "${bLevel.band}"`)
  ok(!!bKick.band && bKick.band !== bLevel.band, `three points in it says something else: "${bKick.band}"`)
  ok(!!bScore.band && bScore.band !== bKick.band && bScore.band !== bLevel.band, `and a try in it a third: "${bScore.band}"`)
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 200)}`)
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nDRAMA PROBE FAILED (${fails})` : '\nDRAMA PROBE PASSED: the pitch reads the match, and the clock knows when to slow down')
done(fails)
