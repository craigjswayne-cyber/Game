// Probe: your story begins before the first whistle, and it is priced fairly.
//
// From the FM26 assessment: manager creation with a backstory. Three origins,
// each front-loading a DIFFERENT edge, none of them free points everywhere:
//
//   Former International - the room believes from day one (trust 45 vs 26)
//     and the name is worth six points of standing, forever
//   The Coaching Route  - the default, and what every pre-origin save is
//     migrated to: one extra personal training plan
//   Local Hero          - the first club's board and terraces start warm;
//     the warmth does not exist anywhere else
//
// And the guard that matters for old saves: the coaching route IS the legacy
// career shape - trust 26, base reputation, standard board - so a migrated
// save plays exactly the career it was already playing, plus the plan slot
// that ships in the same build.
import { newGame } from '../src/game/newgame'
import { mgrReputation } from '../src/game/model'
import { planCap } from '../src/game/season'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const coach = newGame('northampton', 'Coach', 41, undefined, 'coach')
const player = newGame('northampton', 'Player', 41, undefined, 'player')
const local = newGame('northampton', 'Local', 41, undefined, 'local')
const legacy = newGame('northampton', 'Legacy', 41) // no origin passed at all

// ---- the ex-international -----------------------------------------------
ok((player.mgrTrust ?? 0) === 45, `the room believes a former international from day one (trust ${player.mgrTrust})`)
ok((coach.mgrTrust ?? 0) === 26, `and makes its mind up about a career coach (trust ${coach.mgrTrust})`)
ok(mgrReputation(player) === mgrReputation(coach) + 6, `the name is worth six points of standing (${mgrReputation(player)} vs ${mgrReputation(coach)})`)

// ---- the coaching route ----------------------------------------------------
ok(planCap(coach) === planCap(player) + 1, `the coaching route runs one extra personal plan (${planCap(coach)} vs ${planCap(player)})`)

// ---- the local hero ---------------------------------------------------------
const homeCoach = coach.clubs[coach.userClubId]
const homeLocal = local.clubs[local.userClubId]
ok(homeLocal.boardConfidence === homeCoach.boardConfidence + 12,
  `the local board starts warm (${homeLocal.boardConfidence} vs ${homeCoach.boardConfidence})`)
ok((local.fanMood ?? 0) > (coach.fanMood ?? 0), `and so do the terraces (${local.fanMood} vs ${coach.fanMood})`)

// ---- legacy saves play the career they were already playing ----------------
ok(legacy.mgrOrigin === 'coach', `no origin means the coaching route (${legacy.mgrOrigin})`)
ok((legacy.mgrTrust ?? 0) === 26 && mgrReputation(legacy) === mgrReputation(coach) &&
  legacy.clubs[legacy.userClubId].boardConfidence === homeCoach.boardConfidence,
  'trust, standing and the board all read exactly as they did before origins existed')

if (fails) { console.error(`\nORIGIN PROBE: ${fails} failures`); process.exit(1) }
console.log('\nORIGIN PROBE PASSED: three ways in, each paying differently')
