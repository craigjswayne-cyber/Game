// Probe: the set piece is played, and a man tires by what he did (1.9.0,
// matchEngine.ts setPieceContest and roleDrain).
//
// Until 1.9.0 scrums and lineouts never happened: their won and lost figures
// were made up after the match from a tanh of the two units, and every forward
// tired at the same 1.1. This holds what replaced both:
//
//   - a match has about thirteen scrums and twenty-five lineouts, counted
//   - two ordinary packs keep about nine in ten of their own scrums, and
//     setPieceContest's penalties go to the pack going forward
//   - a front row that is spent loses more of its scrums than the same front
//     row fresh, in the same fixtures: the bench prop matters, locally
//   - props and hookers are more tired than wings at full time, and the
//     average drain across the fifteen is what it was before (1.053 a shirt),
//     so the world's scoring does not move (bandcheck holds that)
//
// Run: npx vite-node scripts/packprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf, matchStats, sideEnergy } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const FR = new Set(['LP', 'HK', 'TP'])
const N = 40

type Tot = { scrums: number; lineouts: number; kept: number; fed: number; awayKept2: number; awayFed2: number; frE: number; frN: number; wgE: number; wgN: number; homeE: number; awayE: number }
function run(spent: boolean): Tot {
  const t: Tot = { scrums: 0, lineouts: 0, kept: 0, fed: 0, awayKept2: 0, awayFed2: 0, frE: 0, frN: 0, wgE: 0, wgN: 0, homeE: 0, awayE: 0 }
  for (let i = 0; i < N; i++) {
    const g: GameState = newGame('leicester', 'Set Piece Probe', 60000 + i)
    const fx = g.fixtures.find(f => f.week >= 4 && g.clubs[f.homeId] && g.clubs[f.awayId])!
    const ctx = beginMatch(g, fx, mulberry32(8100 + i), false)
    // the away side's bench is the manager's, and he makes no changes, in
    // both runs: the AI replaces a spent front row within minutes, which is
    // the game working and the thing this test cannot see past
    ctx.away.isUser = true
    playHalf(g, ctx)
    const ht = matchStats(ctx)
    if (spent) {
      // the away front row has nothing left at half time, and nobody comes on
      for (const id of ctx.away.onPitch) if (FR.has(g.players[id]?.pos ?? '')) ctx.away.energy.set(id, 5)
    }
    playHalf(g, ctx)
    const s = matchStats(ctx)
    t.scrums += s.scrumsWon[0] + s.scrumsLost[0] + s.scrumsWon[1] + s.scrumsLost[1]
    t.lineouts += s.lineoutsWon[0] + s.lineoutsLost[0] + s.lineoutsWon[1] + s.lineoutsLost[1]
    t.kept += s.scrumsWon[0] + s.scrumsWon[1]
    t.fed += s.scrumsWon[0] + s.scrumsLost[0] + s.scrumsWon[1] + s.scrumsLost[1]
    t.awayKept2 += s.scrumsWon[1] - ht.scrumsWon[1]
    t.awayFed2 += (s.scrumsWon[1] + s.scrumsLost[1]) - (ht.scrumsWon[1] + ht.scrumsLost[1])
    t.homeE += sideEnergy(ctx.home); t.awayE += sideEnergy(ctx.away)
    for (const side of [ctx.home, ctx.away]) {
      for (const id of side.onPitch) {
        const p = g.players[id]; const e = side.energy.get(id) ?? 80
        if (!p || side.onAt?.has(id)) continue // starters only: a replacement came on fresh
        if (FR.has(p.pos)) { t.frE += e; t.frN++ }
        if (p.pos === 'WG') { t.wgE += e; t.wgN++ }
      }
    }
  }
  return t
}

const fresh = run(false)
const spent = run(true)
const perMatch = (n: number) => n / N
console.log(`${N} fixtures, played as they are and again with a spent away front row from half time`)
ok(perMatch(fresh.scrums) >= 9 && perMatch(fresh.scrums) <= 17, `a match has about thirteen scrums (${perMatch(fresh.scrums).toFixed(1)})`)
ok(perMatch(fresh.lineouts) >= 19 && perMatch(fresh.lineouts) <= 31, `and about twenty-five lineouts (${perMatch(fresh.lineouts).toFixed(1)})`)
const keep = fresh.kept / Math.max(1, fresh.fed)
ok(keep >= 0.85 && keep <= 0.95, `ordinary packs keep about nine in ten of their own scrums (${Math.round(keep * 100)}%)`)
const k1 = fresh.awayKept2 / Math.max(1, fresh.awayFed2), k2 = spent.awayKept2 / Math.max(1, spent.awayFed2)
ok(k2 < k1 - 0.03, `a spent front row keeps less of its own scrum ball in the second half (${Math.round(k2 * 100)}% against ${Math.round(k1 * 100)}% fresh)`)
const frE = fresh.frE / Math.max(1, fresh.frN), wgE = fresh.wgE / Math.max(1, fresh.wgN)
ok(frE < wgE - 4, `the front row ends the match more tired than the wings (${frE.toFixed(0)} against ${wgE.toFixed(0)})`)
// THE AVERAGE DRAIN IS THE OLD ONE. Measured on the 1.8.17 engine (flat 1.1
// and 1.0) over these same forty fixtures, 13 Oct 2026: home side with the
// AI's bench 54.3 at full time, away side with no changes 32.5. 1.9.0 read
// 53.8 and 32.4 on the day roleDrain went in.
const homeE = fresh.homeE / N, awayE = fresh.awayE / N
ok(Math.abs(homeE - 54.3) <= 2.5 && Math.abs(awayE - 32.5) <= 2.5,
  `a side tires as fast as it did, only different men (${homeE.toFixed(1)} and ${awayE.toFixed(1)} at full time, were 54.3 and 32.5)`)

console.log(fails ? `PACK PROBE FAILED (${fails})` : 'PACK PROBE PASSED: the scrum and the lineout are contested, and the front row tires by its own work')
process.exit(fails ? 1 : 0)
