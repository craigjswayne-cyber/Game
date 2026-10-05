// Headless performance over a long career, written to run unchanged in an older
// release's worktree so the two builds can be compared on the same machine.
//
//   NODE_OPTIONS=--expose-gc npx vite-node scripts/qa/perfrun.ts -- <seasons=15> [seed] [m|w]
//
// Per season: wall time, mean / worst week, the rollover week, the save's JSON
// size, save (stringify) and load (parse + migrate) time, heap after a forced
// GC, and the counts that could grow without bound (news, history, memory,
// annals, players, fixtures). At seasons 0 and 10 the live match tick cost
// (beginMatch + stepTick, mean and p99) is measured on the user's fixture.
// Prints one PERF line per season as JSON for the comparison script.
import { migrate } from '../../src/game/save'
import * as ME from '../../src/game/matchEngine'
import * as SEASON from '../../src/game/season'
import type { GameState } from '../../src/game/model'
import { peekPid, resetIds } from '../../src/game/attributes'
process.env.SAVEGEN_LIB = '1'
const { playWeek, startCareer } = await import('./savegen')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
const args = process.argv.slice(2).filter(a => a !== '--')
const SEASONS = Number(args[0] ?? 15)
const SEED = Number(args[1] ?? 9090)
const GENDER = (args[2] ?? 'm') as 'm' | 'w'
const gc = (globalThis as Any).gc as (() => void) | undefined

function tickCost(g: GameState): { mean: number; p99: number; ticks: number } {
  // on a throwaway copy, so the career itself is untouched
  const c = JSON.parse(JSON.stringify(g)) as GameState
  const S = SEASON as Any, M = ME as Any
  let fx = S.userFixtureThisWeek(c)
  for (let i = 0; !fx && i < 6; i++) { playWeek(c); fx = S.userFixtureThisWeek(c) }
  if (!fx) return { mean: NaN, p99: NaN, ticks: 0 }
  const ctx = M.beginMatch(c, fx, S.matchRng(c), true, c.userClubId)
  const ts: number[] = []
  for (let guard = 0; guard < 5000 && ctx.seg < 3; guard++) {
    const t = performance.now()
    const r = M.stepTick(c, ctx)
    ts.push(performance.now() - t)
    if (r === 'FT') break
  }
  ts.sort((a, b) => a - b)
  return { mean: ts.reduce((a, b) => a + b, 0) / ts.length, p99: ts[Math.floor(ts.length * 0.99)], ticks: ts.length }
}

const g = startCareer(GENDER, SEED)
gc?.()
const heap0 = process.memoryUsage().heapUsed
console.log(`PERFSTART ${JSON.stringify({ seed: SEED, gender: GENDER, heap0: Math.round(heap0 / 1e6) })}`)
for (let s = 0; s < SEASONS; s++) {
  const row: Record<string, number | string> = { season: g.season }
  if (s === 0 || s === 10) {
    const pid0 = peekPid()
    const tc = tickCost(g)
    resetIds(pid0)
    row.tickMean = +tc.mean.toFixed(3); row.tickP99 = +tc.p99.toFixed(3); row.ticks = tc.ticks
  }
  const target = g.season + 1
  const weeks: number[] = []
  let roll = 0
  const t0 = performance.now()
  for (let guard = 0; g.season < target && guard < 60; guard++) {
    const t = performance.now()
    playWeek(g)
    const d = performance.now() - t
    if (g.season === target) roll = d
    else weeks.push(d)
  }
  row.wall = Math.round(performance.now() - t0)
  row.weekMean = +(weeks.reduce((a, b) => a + b, 0) / Math.max(1, weeks.length)).toFixed(1)
  row.weekMax = +Math.max(...weeks).toFixed(1)
  row.rollover = +roll.toFixed(1)
  let t = performance.now()
  const json = JSON.stringify(g)
  row.saveMs = +(performance.now() - t).toFixed(1)
  row.mb = +(json.length / 1e6).toFixed(2)
  t = performance.now()
  const pid = peekPid()
  migrate(JSON.parse(json) as GameState)
  resetIds(pid) // the load set the module's id counter; the career carries on with its own
  row.loadMs = +(performance.now() - t).toFixed(1)
  gc?.()
  row.heapMB = Math.round(process.memoryUsage().heapUsed / 1e6)
  row.rssMB = Math.round(process.memoryUsage().rss / 1e6)
  const G = g as Any
  row.news = g.news.length; row.history = g.history.length
  row.memory = G.memory?.entries?.length ?? 0; row.annals = G.annals?.length ?? 0
  row.players = Object.keys(g.players).length; row.fixtures = g.fixtures.length
  row.ledger = G.ledger?.length ?? 0; row.offers = g.offers.length
  row.hof = G.hof?.length ?? 0; row.press = g.press.length
  row.unemployed = g.unemployed ? 1 : 0
  console.log(`PERF ${JSON.stringify(row)}`)
}
