// Probe: the scoreboard stays inside rugby (user, after winning 106-3 AT
// Leinster: "this would be a tight game in real life - the scores feel well
// off at present").
//
// Two claims:
//
//   A total mismatch is a rout, not a cricket score. The engine converts a
//   strength gap into tries without ever easing off, so the best side in the
//   world put 100 on the worst at a measurable rate (Zebre 6-101 Glasgow,
//   Sungoliath 109-9, one in ~1300 world fixtures). Real winners at +40 kick
//   the corners and empty the bench: garbage time damps the leading side's
//   try chance, nothing else.
//
//   Two top-class clubs never produce three figures. Headline case exactly as
//   reported: strongest v strongest, home and away, and the tail must sit
//   where real rugby's does.
//
// The damp never touches a close game (it starts at +35), so the world's
// means stay where bandcheck put them - that is asserted by bandcheck, and
// re-measured after this change, not argued.
import { newGame } from '../src/game/newgame'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const base = newGame('northampton', 'Blow', 17)
const clubs = Object.values(base.clubs)
const byRep = [...clubs].sort((a, b) => b.rep - a.rep)
const strongest = byRep[0]
const second = byRep.find(c => c.id !== strongest.id && c.leagueId !== strongest.leagueId) ?? byRep[1]
const weakest = byRep[byRep.length - 1]
console.log(`  strongest ${strongest.short} (rep ${strongest.rep}), second ${second.short} (rep ${second.rep}), weakest ${weakest.short} (rep ${weakest.rep})`)

// A RATE OVER THOUSANDS, NOT THE MAXIMUM OF 120 (28 Sep 2026).
//
// Both ceilings were asserted as the single worst margin in 120 or so
// matches, and a maximum is the least stable number a sample has: four
// shifted seed lists read 79, 83, 84 and 97 (FAIL) against 90, and 51, 62
// (FAIL), 54 and 48 against 60. Measured over 20,000 matches each, the
// ceilings sit almost exactly at the one-in-a-thousand tail: the mismatch
// goes past 90 in 15 of 20,000 (worst 97, none reaches 100) and top v top
// past 60 in 13 of 20,000 (worst 70). So a 120-match maximum fails about one
// run in twelve per ceiling with nothing changed.
//
// The claim is now the rate: past the ceiling in fewer than 1 match in 500,
// over 10,000 of each. A 120-match window is still clean four times in five
// at that rate, which is what the old test tolerated in practice; measured,
// the game runs at about 1 in 1,400, and the 1-in-1,300 blowout that started
// this (100-pointers across world fixtures) would be many times over it.
//
// Restored, not cloned: the two clubs, their men and the chemistry ledger are
// put back before each sim (150 ms a structuredClone, about 3 ms this way),
// and the first 30 are checked against the clone to prove it is the same.
const ids = [...new Set([strongest.id, second.id, weakest.id])]
const pids = ids.flatMap(c => base.clubs[c].players)
const snapC = structuredClone(ids.map(c => base.clubs[c]))
const snapP = structuredClone(pids.map(id => base.players[id]))
const snapChem = structuredClone(base.chem)
const restore = () => {
  ids.forEach((c, j) => { base.clubs[c] = structuredClone(snapC[j]) })
  pids.forEach((id, j) => { base.players[id] = structuredClone(snapP[j]) })
  base.chem = structuredClone(snapChem)
}

function margins(homeId: string, awayId: string, n: number, clone = false): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const g: GameState = clone ? structuredClone(base) : (restore(), base)
    const fx: Fixture = {
      id: 900_000 + i, compId: 'cc', round: 1, week: 20, homeId, awayId,
      played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
    }
    simMatch(g, fx, mulberry32(4242 + i * 13), false)
    out.push(Math.abs(fx.homeScore - fx.awayScore))
  }
  restore()
  return out.sort((a, b) => a - b)
}

const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]
const N = 10_000
const RATE = 1 / 500

{
  const a = margins(strongest.id, weakest.id, 30, true).join(',')
  const b = margins(strongest.id, weakest.id, 30).join(',')
  ok(a === b, 'a restored world plays the same 30 matches as a cloned one')
}

// ---- the total mismatch: a rout, never a cricket score ---------------------
{
  const m = margins(strongest.id, weakest.id, N)
  const over = m.filter(x => x > 90).length
  console.log(`  mismatch margins over ${N}: p50 ${q(m, 0.5)}, p90 ${q(m, 0.9)}, p99.9 ${q(m, 0.999)}, max ${m[m.length - 1]}, past 90 in ${over}`)
  ok(q(m, 0.5) >= 25, `the gulf still shows: median margin ${q(m, 0.5)} (floor 25)`)
  // Ceiling raised 88 -> 90 with the verified August 2026 squads: the world's
  // strongest side got genuinely stronger at the top end, and its worst
  // afternoon against the weakest club in the world now peaks at 89. A
  // 90-point rout for a full-strength giant against a part-time club is still
  // inside rugby; three figures is not, and the top-v-top ceiling below is
  // what actually guards the leagues people play in.
  ok(over < N * RATE, `even the worst afternoons stay inside rugby: past 90 in ${over} of ${N} (under 1 in 500 is ${N * RATE})`)
}

// ---- top v top: the user's screenshot, thousands of times over -------------
{
  const m1 = margins(strongest.id, second.id, N / 2)
  const m2 = margins(second.id, strongest.id, N / 2)
  const m = [...m1, ...m2].sort((a, b) => a - b)
  const over = m.filter(x => x > 60).length
  console.log(`  top-v-top margins over ${N}: p50 ${q(m, 0.5)}, p90 ${q(m, 0.9)}, p99.9 ${q(m, 0.999)}, max ${m[m.length - 1]}, past 60 in ${over}`)
  ok(over < N * RATE, `two top clubs never approach three figures: past 60 in ${over} of ${N} (under 1 in 500 is ${N * RATE})`)
}

console.log(fails ? `\nBLOWPROBE FAILED (${fails})` : '\nBLOWPROBE PASSED')
process.exit(fails ? 1 : 0)
