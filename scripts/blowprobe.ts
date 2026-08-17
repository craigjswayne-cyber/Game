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

function margins(homeId: string, awayId: string, n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const g: GameState = structuredClone(base)
    const fx: Fixture = {
      id: 900_000 + i, compId: 'cc', round: 1, week: 20, homeId, awayId,
      played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
    }
    simMatch(g, fx, mulberry32(4242 + i * 13), false)
    out.push(Math.abs(fx.homeScore - fx.awayScore))
  }
  return out.sort((a, b) => a - b)
}

const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]

// ---- the total mismatch: a rout, never a cricket score ---------------------
{
  const m = margins(strongest.id, weakest.id, 120)
  console.log(`  mismatch margins: p50 ${q(m, 0.5)}, p90 ${q(m, 0.9)}, max ${m[m.length - 1]}`)
  ok(q(m, 0.5) >= 25, `the gulf still shows: median margin ${q(m, 0.5)} (floor 25)`)
  ok(m[m.length - 1] <= 88, `even the worst afternoon stays inside rugby: max ${m[m.length - 1]} (ceiling 88)`)
}

// ---- top v top: the user's screenshot, 120 times over ----------------------
{
  const m1 = margins(strongest.id, second.id, 60)
  const m2 = margins(second.id, strongest.id, 60)
  const m = [...m1, ...m2].sort((a, b) => a - b)
  console.log(`  top-v-top margins: p50 ${q(m, 0.5)}, p90 ${q(m, 0.9)}, max ${m[m.length - 1]}`)
  ok(m[m.length - 1] <= 60, `two top clubs never approach three figures: max ${m[m.length - 1]} (ceiling 60)`)
}

console.log(fails ? `\nBLOWPROBE FAILED (${fails})` : '\nBLOWPROBE PASSED')
process.exit(fails ? 1 : 0)
