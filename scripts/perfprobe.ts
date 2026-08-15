/**
 * ---- IS IT STILL SMOOTH? (Round 26) ----
 *
 * User: "make sure the game is bug free and running smooth." Smooth on a phone
 * is two numbers and one shape:
 *
 *   THE WEEK ADVANCE is the button pressed more than any other. Everything the
 *   game does between Saturdays runs inside it - training, gossip, the AI
 *   market, the whole world's fixtures - so if anything is going to make the
 *   phone stutter, it is this.
 *
 *   THE LIVE MATCH is the thing watched rather than waited for. A tick that
 *   takes too long shows up as a stutter in the commentary, not a spinner.
 *
 *   THE SAVE cannot grow without bound. A save that doubles every ten seasons
 *   is a career that gets slower the longer you love it, and on a phone it is
 *   also a career that eventually will not fit in storage. (Saves live in
 *   IndexedDB, not localStorage - so the ceiling is hundreds of megabytes
 *   rather than five - but "it fits" is not the same as "it stays sane", and
 *   the growth SHAPE below is the assertion that actually matters.)
 *
 * The bands below are deliberately generous against a MODERN DESKTOP running
 * headless: the point is to catch a regression that makes something ten times
 * slower, not to police a millisecond. A phone is slower than this box, which
 * is why the budgets are a fraction of what a user would tolerate.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { beginMatch, playSegment, simMatch } from '../src/game/matchEngine'
import { SEASON_WEEKS } from '../src/game/model'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const ms = (f: () => void) => { const t = performance.now(); f(); return performance.now() - t }

// ---- the week advance, early and late in a career ---------------------------
{
  const g = newGame('northampton', 'Perf', 9)
  const early: number[] = []
  for (let i = 0; i < SEASON_WEEKS; i++) early.push(ms(() => processWeekAndAdvance(g)))
  // now age the save five seasons and measure the same button again: the
  // question is not "is it fast" but "does it STAY fast as the ledgers fill"
  for (let s = 0; s < 5; s++) for (let i = 0; i < SEASON_WEEKS; i++) processWeekAndAdvance(g)
  const late: number[] = []
  for (let i = 0; i < SEASON_WEEKS; i++) late.push(ms(() => processWeekAndAdvance(g)))

  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
  const worst = (a: number[]) => Math.max(...a)
  console.log(`  week advance: fresh mean ${mean(early).toFixed(1)}ms (worst ${worst(early).toFixed(0)}ms) | season 6 mean ${mean(late).toFixed(1)}ms (worst ${worst(late).toFixed(0)}ms)`)
  ok(mean(early) < 120, `a fresh week settles well inside the frame budget (${mean(early).toFixed(1)}ms)`)
  ok(worst(late) < 900, `and the worst week of season six is still not a hang (${worst(late).toFixed(0)}ms)`)
  // THE SHAPE THAT MATTERS: a career that gets slower the longer you play it
  const drift = mean(late) / Math.max(0.01, mean(early))
  ok(drift < 2.5, `six seasons in, a week costs ${drift.toFixed(2)}x what it did on day one`)
}

// ---- the live match ---------------------------------------------------------
{
  const g = newGame('northampton', 'Perf', 77)
  while (!userFixtureThisWeek(g)) processWeekAndAdvance(g)
  const fx = userFixtureThisWeek(g)!
  const t = ms(() => {
    const ctx = beginMatch(g, fx, mulberry32(fx.id * 7919 + 13), true, g.userClubId)
    while (ctx.seg !== 3) playSegment(g, ctx)
  })
  console.log(`  a watched match, kick-off to full time: ${t.toFixed(0)}ms`)
  ok(t < 2500, `the live match plays out without a stutter budget blown (${t.toFixed(0)}ms)`)

  // and the instant result, which is what the impatient manager taps
  const g2 = newGame('northampton', 'Perf', 78)
  while (!userFixtureThisWeek(g2)) processWeekAndAdvance(g2)
  const fx2 = userFixtureThisWeek(g2)!
  const t2 = ms(() => simMatch(g2, fx2, weekRng(g2), false))
  console.log(`  an instant result: ${t2.toFixed(0)}ms`)
  ok(t2 < 400, `instant result is instant (${t2.toFixed(0)}ms)`)
}

// ---- the save cannot grow without bound -------------------------------------
{
  const g = newGame('northampton', 'Perf', 202)
  const size = () => JSON.stringify(g).length
  const s0 = size()
  for (let s = 0; s < 5; s++) for (let i = 0; i < SEASON_WEEKS; i++) processWeekAndAdvance(g)
  const s5 = size()
  for (let s = 0; s < 5; s++) for (let i = 0; i < SEASON_WEEKS; i++) processWeekAndAdvance(g)
  const s10 = size()
  const mb = (n: number) => (n / 1_048_576).toFixed(2)
  console.log(`  save size: fresh ${mb(s0)}MB · after 5 seasons ${mb(s5)}MB · after 10 ${mb(s10)}MB`)
  ok(s10 < 12_000_000, `a ten-season save still fits comfortably in phone storage (${mb(s10)}MB)`)
  // the growth must FLATTEN, not compound: the second five seasons must not
  // add appreciably more than the first five did, or the ledgers are unbounded
  const first = s5 - s0, second = s10 - s5
  console.log(`  growth: first five seasons +${mb(first)}MB, second five +${mb(second)}MB`)
  ok(second <= first * 1.35, `save growth is flattening, not compounding (${(second / Math.max(1, first)).toFixed(2)}x)`)
}

console.log(fails ? `\n${fails} FAILURES` : '\nPERF PROBE PASSED: the week, the match and the save all stay light')
process.exit(fails ? 1 : 0)
