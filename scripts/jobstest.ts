// Job-market regression: get sacked, wait for vacancies, get re-hired.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { applyForJob } from '../src/game/jobs'
import { mgrReputation } from '../src/game/model'

const g = newGame('montauban', 'Doomed Gaffer', 99)
g.clubs[g.userClubId].boardConfidence = 4 // one bad week from the sack

let guard = 0
while (!g.unemployed && guard++ < 30) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), false)
  processWeekAndAdvance(g)
}
if (!g.unemployed) { console.error('BUG: never sacked'); process.exit(1) }
console.log(`sacked at week ${g.week}, rep ${mgrReputation(g)} — now unemployed`)

// world keeps turning; vacancies appear
let hired = false
guard = 0
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
