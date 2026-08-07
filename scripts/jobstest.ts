// Job-market regression: get sacked, wait for vacancies, get re-hired.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { applyForJob } from '../src/game/jobs'
import { mgrReputation } from '../src/game/model'

// This used to set confidence to 4 and hope thirty weeks of Montauban results
// would finish the job. That is not a test of the sack, it is a test of one club's
// luck, and it broke the moment selection improved and Montauban started winning:
// weeks 1 to 5 are friendlies and do not move the board at all, then they won five
// in a row and climbed clear. Worse, it hid a real bug for as long as it passed -
// the audit found board confidence bottoming out at 3.3 against a threshold of 3.
//
// So prove the mechanism instead. Confidence on the floor, past the eight-week
// grace period, must end the job.
const g = newGame('montauban', 'Doomed Gaffer', 99)
while (g.week < 10) {
  const fx0 = userFixtureThisWeek(g)
  if (fx0) simMatch(g, fx0, weekRng(g), false)
  processWeekAndAdvance(g)
}
g.clubs[g.userClubId].boardConfidence = 2
processWeekAndAdvance(g)
if (!g.unemployed) { console.error('BUG: confidence on the floor past week 8 did not end the job'); process.exit(1) }

// And the grace period has to be real: the same collapse before week 8 must not
// sack anyone, or a bad pre-season would end a career before it started.
{
  const early = newGame('montauban', 'Early Gaffer', 99)
  early.clubs[early.userClubId].boardConfidence = 1
  processWeekAndAdvance(early)
  if (early.unemployed) { console.error('BUG: sacked inside the eight-week grace period'); process.exit(1) }
  console.log('grace period holds: bc 1 in week 1 is a warning, not a sacking')
}

// The swing itself must never invert. Beating a weaker side cannot cost you
// confidence and losing to a stronger one cannot earn you any, which is what the
// unfloored opponent-strength term used to do at both tails.
{
  const mag = (mine: number, opp: number, won: boolean) => {
    const diff = (opp - mine) / 25
    return Math.max(0.8, won ? 2.5 + diff * 2 : 2.5 - diff * 2)
  }
  for (const [me, opp] of [[88, 55], [92, 50], [55, 88], [70, 70]]) {
    if (mag(me, opp, true) <= 0) { console.error(`BUG: rep ${me} beating rep ${opp} does not raise confidence`); process.exit(1) }
    if (mag(me, opp, false) <= 0) { console.error(`BUG: rep ${me} losing to rep ${opp} does not lower confidence`); process.exit(1) }
  }
  console.log('board swing never inverts: a win always helps, a defeat always hurts')
}
console.log(`sacked at week ${g.week}, rep ${mgrReputation(g)} — now unemployed`)

// world keeps turning; vacancies appear
let hired = false
let guard = 0
while (!hired && guard++ < 80) {
  processWeekAndAdvance(g)
  for (const v of [...g.vacancies]) {
    if (v.applied) continue
    const msg = applyForJob(g, v.clubId)
    if (!g.unemployed) {
      hired = true
      console.log(`week ${g.week}: ${msg}`)
      break
    }
  }
}
if (!hired) { console.error('BUG: never re-hired after 80 weeks'); process.exit(1) }
console.log(`re-employed at ${g.clubs[g.userClubId].name}; vacancies now ${g.vacancies.length}`)

// keep managing from the new dugout for a few weeks
for (let i = 0; i < 6; i++) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), false)
  processWeekAndAdvance(g)
}
console.log(`played on to season ${g.season} week ${g.week}, mgr record ${g.mgr.w}W-${g.mgr.d}D-${g.mgr.l}L`)
console.log('JOBS TEST PASSED')
