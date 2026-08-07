// Does every shirt go to a man who belongs in it?
//
// The user loaded Northampton and found a centre at 9, a winger at 10 and the
// scrum-half at 11. This measures that class of error across every club in the
// world, at kick-off and again after the season has been running long enough for
// rotation, injuries and the stale-sheet rebuild to have had their say.
//
// Two metrics, because they are different faults:
//
//   IMPOSSIBLE  the shirt is on a man who is neither a natural nor an alt. A
//               squad with both hookers injured has to shoehorn somebody, so
//               this is only a fault when a natural was actually available.
//
//   DISPLACED   the shirt is on an alt while a natural for it was available and
//               is NOT wearing his own shirt. This is the one the user saw, and
//               it is always wrong: effAt scores an alt at 0.92 of ability, so a
//               87 scrum-half outscores a 78 natural winger on the wing, takes
//               the 11 shirt, and leaves 9 to be shoehorned.
import { newGame } from '../src/game/newgame'
import { XV_SLOTS } from '../src/game/model'
import type { GameState, Player, Pos } from '../src/game/model'
import { availablePlayers, autoSelect } from '../src/game/matchEngine'
import { effAt } from '../src/game/attributes'
import { splitFor } from '../src/game/bench'
import { processWeekAndAdvance } from '../src/game/season'

const SEEDS = Number(process.env.SEEDS ?? 6)
const WEEKS = Number(process.env.WEEKS ?? 12)

let xvs = 0
let impossible = 0
let displaced = 0
const examples: string[] = []

/** A natural for this shirt who is not already wearing it, and where he is.
 *
 *  Mirrors autoSelect's own pool rules or it measures the wrong thing: the
 *  academy is a second squad, only raided when the seniors run dry, so an
 *  academy fly-half does not count as cover for the first team's 10 shirt. */
function freeNatural(pool: Player[], lineup: (number | null)[], pos: Pos): { p: Player; at: number } | null {
  for (const q of pool) {
    if (q.pos !== pos) continue
    const at = lineup.indexOf(q.id)
    // in the XV wearing his own shirt: he is exactly where he should be
    if (at >= 0 && at < 15 && XV_SLOTS[at].pos === q.pos) continue
    return { p: q, at }
  }
  return null
}

function check(state: GameState, clubId: string, when: string, lineup: (number | null)[]) {
  const club = state.clubs[clubId]
  let pool = availablePlayers(state, club.players, false)
  const seniors = pool.filter(p => !p.acad)
  if (seniors.length >= 23) pool = seniors
  xvs++
  for (let i = 0; i < 15; i++) {
    const id = lineup[i]
    if (id == null) continue
    const p = state.players[id]
    if (!p) continue
    const pos = XV_SLOTS[i].pos
    if (p.pos === pos) continue

    const nat = freeNatural(pool, lineup, pos)
    if (!nat) continue
    // The only question worth asking: would the natural be BETTER in this shirt?
    //
    // Where he is sitting does not decide it. Blair Kinghorn on the wing ahead of
    // a poor natural winger is what a coach would do, and Alex Coles at 75 on the
    // blindside ahead of a 74 natural flanker is a selection, not a bug. The
    // margin is there because autoSelect also weighs condition and form, which
    // this does not: a couple of points of difference is legitimate rotation, and
    // ten is a scrum-half playing centre.
    if (effAt(nat.p, pos) <= effAt(p, pos) + 4) continue

    if (p.alt.includes(pos)) displaced++
    else impossible++

    if (examples.length < 14) {
      const where = nat.at < 0 ? 'is not in the 23' : nat.at >= 15 ? 'is on the bench' : `is wearing ${XV_SLOTS[nat.at].shirt}`
      examples.push(`${when} ${club.short} shirt ${XV_SLOTS[i].shirt} (${pos}) -> ${p.name} [${p.pos}${p.alt.length ? '/' + p.alt.join('/') : ''}] ${effAt(p, pos).toFixed(0)} while ${nat.p.name} [${nat.p.pos}] ${effAt(nat.p, pos).toFixed(0)} ${where}`)
    }
  }
}

for (let s = 0; s < SEEDS; s++) {
  const g = newGame('northampton', 'Audit', 1000 + s * 7919)
  // kick-off: the sheet a new career is handed
  for (const id of Object.keys(g.clubs)) check(g, id, 'wk1', g.clubs[id].tactic.lineup)
  // and again once the season has bruised everyone
  for (let w = 0; w < WEEKS; w++) processWeekAndAdvance(g)
  for (const id of Object.keys(g.clubs)) check(g, id, `wk${g.week}`, g.clubs[id].tactic.lineup)
  // and the freshly computed sheet, which is what a match actually uses
  for (const id of Object.keys(g.clubs)) {
    const club = g.clubs[id]
    check(g, id, 'auto', autoSelect(g, availablePlayers(g, club.players, false), splitFor(club)))
  }
}

console.log(`${xvs} club XVs across ${SEEDS} worlds (week 1, week ${1 + WEEKS}, and a fresh auto-pick)`)
console.log(`impossible: ${impossible}  (a shirt on a man who cannot play it, with a natural free)`)
console.log(`displaced:  ${displaced}  (a shirt on an alt while its natural wears someone else's)`)
for (const e of examples) console.log('  eg ' + e)

const bad = impossible + displaced
if (bad > 0) {
  console.log(`\nPICK FIT FAILED: ${bad} shirts on the wrong man with the right man available`)
  process.exit(1)
}
console.log('\nPICK FIT PASSED: every shirt is on its natural, or nobody natural was free')
