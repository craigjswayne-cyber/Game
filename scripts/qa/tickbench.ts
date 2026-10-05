// The live match's cost per tick, measured over many matches so it can be
// compared between builds (runs unchanged in an older release's worktree).
//
//   npx vite-node scripts/qa/tickbench.ts -- [matches=60] [seed]
//
// Every fixture of the opening weeks is played tick by tick with the detail a
// watched match has (beginMatch detail=true, stepTick to full time), on a
// throwaway copy of the world. Prints the mean and p99 tick, and the per-match
// total, after a warm-up.
import * as NG from '../../src/game/newgame'
import * as ME from '../../src/game/matchEngine'
import * as SEASON from '../../src/game/season'
import type { GameState } from '../../src/game/model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
const args = process.argv.slice(2).filter(a => a !== '--')
const N = Number(args[0] ?? 60)
const SEED = Number(args[1] ?? 31337)
const base = (NG as Any).newGame('leicester', 'Bench', SEED) as GameState
const json = JSON.stringify(base)
const fixtures = base.fixtures.filter(f => base.clubs[f.homeId] && base.clubs[f.awayId] && f.week <= 12)
const ticks: number[] = []
const perMatch: number[] = []
for (let i = 0; i < N + 5; i++) {
  const g = JSON.parse(json) as GameState
  const fx = g.fixtures.find(f => f.id === fixtures[i % fixtures.length].id)!
  const M = ME as Any
  const t0 = performance.now()
  const ctx = M.beginMatch(g, fx, (SEASON as Any).matchRng(g), true, fx.homeId)
  const mine: number[] = []
  for (let guard = 0; guard < 400 && ctx.seg < 3; guard++) {
    const t = performance.now()
    const r = M.stepTick(g, ctx)
    mine.push(performance.now() - t)
    if (r === 'FT') break
  }
  if (i >= 5) { ticks.push(...mine); perMatch.push(performance.now() - t0) }
}
ticks.sort((a, b) => a - b)
const mean = ticks.reduce((a, b) => a + b, 0) / ticks.length
console.log(`TICKBENCH ${JSON.stringify({ matches: N, ticks: ticks.length, mean: +mean.toFixed(3), p50: +ticks[Math.floor(ticks.length / 2)].toFixed(3), p99: +ticks[Math.floor(ticks.length * 0.99)].toFixed(3), max: +ticks[ticks.length - 1].toFixed(2), match: +(perMatch.reduce((a, b) => a + b, 0) / perMatch.length).toFixed(1) })}`)
