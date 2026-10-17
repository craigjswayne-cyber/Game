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
 * THE BUDGETS ARE RELATIVE TO THIS MACHINE (1.9.1). The week used to be held to
 * a fixed 215 ms, which was a statement about the box as much as the game: the
 * 13 Oct container read 178 to 221 ms on an unchanged commit and failed about
 * one run in three. Now a CALIBRATION workload (plain JavaScript that touches
 * no game code: allocation, sorting, a Map, JSON, strings) is timed on the same
 * machine, interleaved with the thing being measured, and each budget is a
 * ratio to it. A slow runner slows both sides; a slower engine moves only one.
 *
 *   The REF ratios below were measured on the dev container on 16 Oct 2026,
 *   and the limit is REF x TOLERANCE. For the week, quiet runs read 11.0 to
 *   11.7 (230 to 245 ms) and runs beside three other probes read 13.1 to
 *   15.1 while the wall clock nearly doubled (415 to 546 ms): the fixed
 *   budget failed those, the ratio does not. TOLERANCE 1.5 on REF 11.5 is a
 *   limit of 17.25, and PERF_SLOWDOWN=2 read 24.6: a genuine 2x regression
 *   fails. The two matches take 5 to 10 ms, too short to time to 1.5x on a
 *   shared box, so they get 3x: a far closer watch than the 2,500 and 400 ms
 *   they used to have, which were over fifty times what they cost.
 *
 *   PERF_SLOWDOWN=2 makes every measured block take twice as long, to show the
 *   probe catches what it is for: it must FAIL with it set.
 *
 * Each ratio is printed, so a deliberate cost (a feature, the owner's call) is
 * rebaselined here in the same commit, with a line saying what moved.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { beginMatch, playSegment, simMatch } from '../src/game/matchEngine'
import { SEASON_WEEKS, type GameState } from '../src/game/model'
import { mulberry32 } from '../src/game/rng'
import { ok, failures } from './lib/probe'

const SLOWDOWN = Number(process.env.PERF_SLOWDOWN ?? 1)
const spin = (wanted: number) => { const end = performance.now() + wanted; while (performance.now() < end) { /* spin */ } }
const ms = (f: () => void) => {
  const t = performance.now()
  f()
  if (SLOWDOWN > 1) spin((performance.now() - t) * (SLOWDOWN - 1))
  return performance.now() - t
}

// ---- the calibration workload -----------------------------------------------
// Roughly the shape of a week's work without any of its code: objects made and
// dropped, a sort, a Map, a JSON round trip and some string building.
let sink = 0
function calibration(): number {
  const t = performance.now()
  const rng = mulberry32(12345)
  const rows = Array.from({ length: 20000 }, (_, i) => ({ id: i, a: rng() * 100, b: Math.floor(rng() * 50), name: `p${i}` }))
  rows.sort((x, y) => x.a - y.a || x.b - y.b)
  const byB = new Map<number, number>()
  for (const r of rows) byB.set(r.b, (byB.get(r.b) ?? 0) + r.a)
  const back = JSON.parse(JSON.stringify(rows.slice(0, 4000))) as typeof rows
  let str = ''
  for (const r of back) str += `${r.name}:${r.a.toFixed(2)};`
  sink += byB.size + str.length + rows.filter(r => r.a > 50).map(r => r.b).reduce((x, y) => x + y, 0)
  return performance.now() - t
}
for (let i = 0; i < 10; i++) calibration()       // warm the JIT before anything counts

/** Time `work` n times with a calibration run before each, so a load spike
 *  lands on both. `prep` runs untimed and hands work its input. */
function measure<T>(n: number, prep: () => T, work: (x: T) => void) {
  let cal = 0, w = 0
  const each: number[] = []
  for (let i = 0; i < n; i++) {
    cal += calibration()
    const x = prep()
    const d = ms(() => work(x))
    w += d; each.push(d)
  }
  return { cal: cal / n, work: w / n, ratio: w / cal, worst: Math.max(...each) }
}
const TOLERANCE = 1.5
const MATCH_TOLERANCE = 3
const limit = (ref: number, tol = TOLERANCE) => ref * tol

// REF RATIOS (work / calibration): dev container, 16 Oct 2026. See the header.
const REF_WEEK = 11.5
const REF_LIVE = 0.4
const REF_INSTANT = 0.27

// ---- the week advance, early and late in a career ---------------------------
{
  const g = newGame('northampton', 'Perf', 9)
  const early = measure(SEASON_WEEKS, () => g, x => processWeekAndAdvance(x))
  // now age the save five seasons and measure the same button again: the
  // question is not "is it fast" but "does it STAY fast as the ledgers fill"
  for (let s = 0; s < 5; s++) for (let i = 0; i < SEASON_WEEKS; i++) processWeekAndAdvance(g)
  const late = measure(SEASON_WEEKS, () => g, x => processWeekAndAdvance(x))

  console.log(`  calibration: ${early.cal.toFixed(1)}ms a run on this machine`)
  console.log(`  week advance: fresh mean ${early.work.toFixed(1)}ms (${early.ratio.toFixed(2)}x calibration, worst ${early.worst.toFixed(0)}ms) | season 6 mean ${late.work.toFixed(1)}ms (worst ${late.worst.toFixed(0)}ms)`)
  // The history of this line, all of it in wall-clock milliseconds on one box:
  // 120 ms until 1.8.0; 200 when every side began rebuilding its units when its
  // men change (+15%); 215 at 1.9.0 when scrums and lineouts became contested
  // every tick (+5 to 8%). It is a ratio now; see the header.
  ok(early.ratio < limit(REF_WEEK), `a fresh week costs ${early.ratio.toFixed(2)}x the calibration run (limit ${limit(REF_WEEK).toFixed(1)}x)`)
  // not a budget, a hang detector: ten times the machine-scaled week
  const hang = early.cal * REF_WEEK * 10
  ok(late.worst < hang * SLOWDOWN, `and the worst week of season six is still not a hang (${late.worst.toFixed(0)}ms, limit ${hang.toFixed(0)}ms)`)
  // THE SHAPE THAT MATTERS: a career that gets slower the longer you play it.
  // Relative already: both sides were measured on this machine, this run.
  const drift = late.ratio / Math.max(0.01, early.ratio)
  ok(drift < 2.5, `six seasons in, a week costs ${drift.toFixed(2)}x what it did on day one`)
}

// ---- the live match ---------------------------------------------------------
{
  // the same fixture from a fresh copy each time, so every run is the same match
  const g = newGame('northampton', 'Perf', 77)
  while (!userFixtureThisWeek(g)) processWeekAndAdvance(g)
  const base = JSON.stringify(g)
  const copy = () => JSON.parse(base) as GameState
  const live = measure(30, copy, gg => {
    const fx = userFixtureThisWeek(gg)!
    const ctx = beginMatch(gg, fx, mulberry32(fx.id * 7919 + 13), true, gg.userClubId)
    while (ctx.seg !== 3) playSegment(gg, ctx)
  })
  console.log(`  a watched match, kick-off to full time: ${live.work.toFixed(0)}ms (${live.ratio.toFixed(2)}x calibration)`)
  ok(live.ratio < limit(REF_LIVE, MATCH_TOLERANCE), `the live match plays out inside its budget (${live.ratio.toFixed(2)}x, limit ${limit(REF_LIVE, MATCH_TOLERANCE).toFixed(2)}x)`)

  // and the instant result, which is what the impatient manager taps
  const g2 = newGame('northampton', 'Perf', 78)
  while (!userFixtureThisWeek(g2)) processWeekAndAdvance(g2)
  const base2 = JSON.stringify(g2)
  const inst = measure(50, () => JSON.parse(base2) as GameState, gg => { simMatch(gg, userFixtureThisWeek(gg)!, weekRng(gg), false) })
  console.log(`  an instant result: ${inst.work.toFixed(0)}ms (${inst.ratio.toFixed(2)}x calibration)`)
  ok(inst.ratio < limit(REF_INSTANT, MATCH_TOLERANCE), `instant result is instant (${inst.ratio.toFixed(2)}x, limit ${limit(REF_INSTANT, MATCH_TOLERANCE).toFixed(2)}x)`)
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

console.log(failures() ? `\n${failures()} FAILURES` : '\nPERF PROBE PASSED: the week, the match and the save all stay light')
if (sink < 0) console.log(sink)                  // keeps the calibration from being optimised away
process.exit(failures() ? 1 : 0)
