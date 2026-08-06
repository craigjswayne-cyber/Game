// The playbook has to be a decision, not a free upgrade.
//
// Three properties the whole design rests on, and one of them was wrong first
// time round:
//
//   The ORTHODOX call is neutral. If the default routine is worth anything, every
//   club in the world gets it for nothing. The first cut made peaks absolute (the
//   middle jump was 1.10) and handed all 101 clubs a free 7.8% on both set pieces,
//   which pushed scoring to 53.4 against a 53.2 ceiling.
//
//   An undrilled routine MISFIRES. If a barely-coached drive maul still beat the
//   call you know cold, there would be no reason ever to drill anything.
//
//   Familiarity bites. Calling the same move every week has to cost you, or the
//   right answer is "find the best routine once and never think again".
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, weekRng } from '../src/game/season'
import { beginMatch, stepTick } from '../src/game/matchEngine'
import {
  DEFAULT_LINEOUT, DEFAULT_SCRUM, ROUTINE_BY_ID, drillWeek, playbookOf,
  resetFamiliarity, routineEffect,
} from '../src/game/playbook'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const g = newGame('northampton', 'SetPiece', 5)
const club = g.clubs[g.userClubId]

// ---- the orthodox call is free of charge, in both directions ---------------
for (const id of [DEFAULT_LINEOUT, DEFAULT_SCRUM]) {
  const e = routineEffect(club, id)
  console.log(`  ${ROUTINE_BY_ID[id].name}: ${e.drilled.toFixed(0)}% drilled, worth ${e.mult.toFixed(3)}`)
  ok(Math.abs(e.mult - 1) < 0.001, `${ROUTINE_BY_ID[id].name} is exactly neutral whatever it is drilled to`)
}

// and across every club in the world, so nobody is quietly taxed or subsidised
let worst = 0
for (const c of Object.values(g.clubs)) {
  for (const id of [DEFAULT_LINEOUT, DEFAULT_SCRUM]) {
    worst = Math.max(worst, Math.abs(routineEffect(c, id).mult - 1))
  }
}
ok(worst < 0.001, `no club in the world gains from its default calls (worst ${worst.toFixed(4)})`)

// ---- an ambitious routine you have not drilled hurts you ------------------
const pb = playbookOf(club)
pb.drilled['lo_maul'] = 20
const cold = routineEffect(club, 'lo_maul')
console.log(`  drive maul at 20% drilled: ${cold.mult.toFixed(3)}`)
ok(cold.mult < 0.98, 'an undrilled drive maul misfires rather than quietly underperforming')

pb.drilled['lo_maul'] = 95
const hot = routineEffect(club, 'lo_maul')
console.log(`  drive maul at 95% drilled: ${hot.mult.toFixed(3)}`)
ok(hot.mult > 1.05, 'a well-drilled drive maul is a real weapon')
ok(hot.mult > cold.mult, 'drilling is what makes the difference')

// ---- drilling raises what you call and rusts what you shelve -------------
club.tactic.lineoutCall = 'lo_dummy'
club.tactic.scrumCall = 'sc_shove'
const before = { dummy: pb.drilled['lo_dummy'], front: pb.drilled['lo_front'] }
for (let w = 0; w < 12; w++) drillWeek(g, club, true)
console.log(`  after 12 weeks on the dummy jumper: ${before.dummy.toFixed(0)}% -> ${pb.drilled['lo_dummy'].toFixed(0)}%`)
console.log(`  front ball, shelved: ${before.front.toFixed(0)}% -> ${pb.drilled['lo_front'].toFixed(0)}%`)
ok(pb.drilled['lo_dummy'] > before.dummy + 8, 'the routine you drill genuinely improves')
ok(pb.drilled['lo_front'] < before.front, 'the routine you shelved rusts')

// ---- and there is a ceiling, so a club cannot own every move -------------
for (let w = 0; w < 200; w++) drillWeek(g, club, true)
const maxed = Math.max(...Object.values(pb.drilled))
ok(maxed <= 98, `drilled quality is capped (${maxed.toFixed(0)}%)`)
const shelved = Object.entries(pb.drilled).filter(([id]) => id !== 'lo_dummy' && id !== 'sc_shove')
ok(shelved.every(([, v]) => v <= 40), 'everything you never call has decayed away')

// ---- familiarity: the eighth time is worth less than the first -----------
resetFamiliarity(club)
pb.drilled['lo_maul'] = 95
const fresh = routineEffect(club, 'lo_maul').mult
pb.used['lo_maul'] = 14
const stale = routineEffect(club, 'lo_maul').mult
console.log(`  drive maul fresh ${fresh.toFixed(3)} -> after 14 calls ${stale.toFixed(3)}`)
ok(stale < fresh - 0.02, 'the analysts learn a routine you keep calling')
ok(stale > 1, 'but a well-drilled move is still worth something when they know it')
// a deniable routine should survive being watched far better than an obvious one
pb.drilled['lo_dummy'] = 95
pb.used['lo_dummy'] = 14
const dummyDecay = 1 - routineEffect(club, 'lo_dummy').mult / (1 + (ROUTINE_BY_ID['lo_dummy'].peak - 1))
const maulDecay = 1 - stale / (1 + (ROUTINE_BY_ID['lo_maul'].peak - 1))
ok(dummyDecay < maulDecay, 'a hard-to-read routine survives the tape better than an obvious one')

resetFamiliarity(club)
ok((playbookOf(club).used['lo_maul'] ?? 0) === 0, 'a new season wipes the tape')

// ---- the kicking game ----------------------------------------------------
const g2 = newGame('northampton', 'Kick', 9)
const c2 = g2.clubs[g2.userClubId]
// name a deliberately poor kicker: the point is that the CHOICE is honoured
const xv = c2.tactic.lineup.slice(0, 15).filter((id): id is number => id != null)
const worstBoot = xv.map(id => g2.players[id]).sort((a, b) => a.a.goa - b.a.goa)[0]
c2.tactic.kickers = [worstBoot.id, null]
const fx2 = g2.fixtures.find(f => f.week === g2.week && (f.homeId === g2.userClubId || f.awayId === g2.userClubId))!
const ctx2 = beginMatch(g2, fx2, weekRng(g2), true)
const mine = ctx2.home.teamId === ctx2.userSideId ? ctx2.home : ctx2.away
console.log(`  named kicker: ${worstBoot.name} (goal ${worstBoot.a.goa}), engine hands the tee to ${g2.players[mine.units.kickerId ?? 0]?.name}`)
ok(mine.units.kickerId === worstBoot.id, 'the designated kicker takes the tee even when he is not the best boot')

// a standing instruction answers the touchline call instead of stopping the game
const g3 = newGame('northampton', 'Pen', 3)
g3.clubs[g3.userClubId].tactic.penaltyCall = 'posts'
const fx3 = g3.fixtures.find(f => f.week === g3.week && (f.homeId === g3.userClubId || f.awayId === g3.userClubId))!
const ctx3 = beginMatch(g3, fx3, weekRng(g3), true)
let asked = 0
for (let i = 0; i < 21 && ctx3.seg < 3; i++) {
  stepTick(g3, ctx3)
  if (ctx3.decision) { asked++; ctx3.decision = null }
}
ok(asked === 0, `a standing instruction never stops to ask (${asked} prompts)`)

// ---- and none of it breaks a season -------------------------------------
const g4 = newGame('northampton', 'Season', 13)
g4.clubs[g4.userClubId].tactic.lineoutCall = 'lo_maul'
for (let w = 0; w < 18; w++) processWeekAndAdvance(g4)
const pb4 = playbookOf(g4.clubs[g4.userClubId])
console.log(`  after 18 played weeks: maul ${pb4.drilled['lo_maul'].toFixed(0)}% drilled, called ${pb4.used['lo_maul'] ?? 0}x`)
ok((pb4.used['lo_maul'] ?? 0) > 0, 'calls are tallied as matches are played')
ok(pb4.drilled['lo_maul'] > 40, 'and a season of coaching moves the needle')

console.log(fails ? `\nSET PIECE PROBE FAILED (${fails})` : '\nSET PIECE PROBE PASSED')
process.exit(fails ? 1 : 0)
