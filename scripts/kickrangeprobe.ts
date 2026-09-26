// ---- KICKS AT GOAL FROM THE OPPOSITION HALF ONLY (1.7.4) ----
//
// Owner, 26 Sep 2026: "kicks at goal should be limited to within the
// opposition teams halfway". A penalty in a side's own half goes to touch for
// the lineout; only a penalty in the other half is kicked at the posts, and
// only there is the manager asked for the call. Every commentary line carries
// where the engine had the ball (MatchEvent.fld), so this reads it back:
//
//   every penalty goal was kicked from the kicking side's opposition half
//   own-half penalties happen, and go to touch instead
//   the touchline call is never offered in the kicker's own half
//
// Run: npx vite-node scripts/kickrangeprobe.ts
import { newGame } from '../src/game/newgame'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

let goals = 0, badGoals = 0, touches = 0, badTouches = 0, asks = 0, badAsks = 0, stamped = 0, lines = 0
for (const seed of [3, 17, 29, 41]) {
  const g = newGame('bath', 'Range', seed)
  const fxs = g.fixtures.filter(f => f.week >= 4 && f.week <= 12 && g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 40)
  fxs.forEach((fx, i) => {
    const r = simMatch(g, fx, mulberry32(seed * 1000 + i), true)
    for (const e of r.events) {
      lines++
      if (e.fld == null) continue
      stamped++
      const up = e.teamId === fx.homeId ? e.fld : 100 - e.fld
      if (e.type === 'PEN') { goals++; if (up < 50) badGoals++ }
      if (e.k === "comm.penTouchOwnHalf") { touches++; if (up > 50) badTouches++ }  // fld is rounded: 49.6 reads 50
      if (e.k === 'comm.penKickableAsk') { asks++; if (up < 50) badAsks++ }
    }
  })
}
console.log(`  ${lines} lines, ${goals} penalty goals, ${touches} own-half penalties to touch, ${asks} touchline calls`)
ok(stamped === lines, `every line carries where the ball was (${stamped} of ${lines})`)
ok(goals > 100 && badGoals === 0, `every penalty goal was kicked from the opposition half (${badGoals} of ${goals} were not)`)
ok(touches > 20, `own-half penalties happen, and go to touch (${touches})`)
ok(badTouches === 0, 'and a kick to touch starts from the kicker\'s own half')
ok(badAsks === 0, `the touchline call is never offered in the kicker's own half (${badAsks} of ${asks})`)

console.log(fails ? `\nKICK RANGE PROBE FAILED (${fails})` : '\nKICK RANGE PROBE PASSED: the posts are only in play in the other half')
process.exit(fails ? 1 : 0)
