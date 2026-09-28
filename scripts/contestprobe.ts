// ---- THE SECOND LAYER (1.8.0, E12): MEN, NOT UNITS ----
//
// src/game/contest.ts puts a contest between people under every tick of the
// team engine: a carrier into a tackler, a jackal against the clear-out. This
// checks the three things that layer promises:
//
//   CENTRED: across the world's first XVs an average collision is 0.5 and the
//     try and penalty tilts average exactly 1, so the season's scoring does not
//     move (the bands are checked by the engine's own probes).
//   IT IS THE MEN: a carrier made stronger wins more of his collisions, and a
//     tackler made better wins more of his.
//   MENTAL GATES TECHNICAL: the same handling with poor decisions carries worse
//     than with good decisions; the same tackling with poor positioning
//     tackles worse.
//
// Run: npx vite-node scripts/contestprobe.ts
import { newGame } from '../src/game/newgame'
import { resolveContest, carryScore, tackleScore, type ContestSide } from '../src/game/contest'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g = newGame('northampton', 'C', 3)
const clubs = Object.values(g.clubs).filter(c => c.tactic?.lineup?.slice(0, 15).every(x => x != null))
const side = (c: typeof clubs[0]): ContestSide => ({ lineup: c.tactic.lineup, onPitch: new Set(c.tactic.lineup.slice(0, 15) as number[]), energy: new Map() })

const run = (n: number, seed: number) => {
  const rng = mulberry32(seed)
  let d = 0, tf = 0, pf = 0, k = 0
  for (let i = 0; i < n; i++) {
    const a = clubs[Math.floor(rng() * clubs.length)], b = clubs[Math.floor(rng() * clubs.length)]
    if (a === b) continue
    const r = resolveContest(side(a), side(b), g.players, rng)!
    d += r.dominance; tf += r.tryF; pf += r.penF; k++
  }
  return { d: d / k, tf: tf / k, pf: pf / k }
}
const w = run(40000, 7)
console.log(`${clubs.length} clubs, 40,000 collisions: mean dominance ${w.d.toFixed(3)}, try tilt ${w.tf.toFixed(4)}, penalty tilt ${w.pf.toFixed(4)}\n`)
ok(Math.abs(w.d - 0.5) < 0.01, 'an average collision is even (0.5)')
ok(Math.abs(w.tf - 1) < 0.01 && Math.abs(w.pf - 1) < 0.01, 'the try and penalty tilts average 1, so the world does not move')

// one club against itself, with one man changed
const c = clubs.find(x => x.id === 'northampton')!
const o = clubs.find(x => x.id === 'bath')!
const dom = (seed: number) => { const rng = mulberry32(seed); let s = 0; for (let i = 0; i < 20000; i++) s += resolveContest(side(c), side(o), g.players, rng)!.dominance; return s / 20000 }
const base = dom(11)
const eight = g.players[c.tactic.lineup[7]!]
const keep = { ...eight.a }
eight.a.str = Math.min(20, eight.a.str + 5); eight.a.han = Math.min(20, eight.a.han + 5)
const stronger = dom(11)
Object.assign(eight.a, keep)
ok(stronger > base + 0.004, `a stronger No. 8 wins more of Northampton's collisions (${base.toFixed(4)} to ${stronger.toFixed(4)})`)

const seven = g.players[o.tactic.lineup[6]!]
const keep7 = { ...seven.a }
seven.a.tac = Math.min(20, seven.a.tac + 5)
const betterTackler = dom(11)
Object.assign(seven.a, keep7)
ok(betterTackler < base - 0.002, `a better Bath openside wins more of the tackles (${base.toFixed(4)} to ${betterTackler.toFixed(4)})`)

// mental gates technical
const man = { ...eight.a }
const carry = (dec: number) => carryScore({ ...man, han: 16, agi: 14, dec })
ok(carry(18) > carry(6) + 0.02, `the same hands carry better with good decisions (${carry(6).toFixed(3)} at 6, ${carry(18).toFixed(3)} at 18)`)
const tk = (pos: number) => tackleScore({ ...man, tac: 16, pos })
ok(tk(18) > tk(6) + 0.03, `the same tackling works better from good positions (${tk(6).toFixed(3)} at 6, ${tk(18).toFixed(3)} at 18)`)

console.log(fails ? `\nCONTEST PROBE FAILED (${fails})` : '\nCONTEST PROBE PASSED: the men decide the collision, centred so the world stands still')
process.exit(fails ? 1 : 0)
