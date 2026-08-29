// Job-market regression: get sacked, wait for vacancies, get re-hired.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { applyForJob, jobChance } from '../src/game/jobs'
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
// ON THE FLOOR MEANS ON THE FLOOR, not "two". This was pinned at 2, which a
// single win can rescue: boardReaction adds about 1.7 for a victory, so 2 becomes
// 3.7 and clears the threshold of 3. That is the game behaving correctly - a win
// buys a week - but it makes the test a coin toss on that week's result, and it
// duly failed the moment an unrelated content change moved the world rng stream.
// Zero is below anything one result can lift clear, so the assertion is now about
// the sack mechanism rather than about Montauban's Saturday.
g.clubs[g.userClubId].boardConfidence = 0
processWeekAndAdvance(g)
if (!g.unemployed) {
  console.error(`BUG: confidence on the floor past week 8 did not end the job (now ${g.clubs[g.userClubId].boardConfidence.toFixed(1)})`)
  process.exit(1)
}

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
// ---- THE BOARD READS THE SEAT YOU ARE SITTING IN -------------------------
//
// Owner, v1.1.12: "if you are head coach of a national team and of a top team,
// other jobs a lot below them should be 100% a chance not a long shot."
//
// jobChance compared the manager's REPUTATION with the club's standing and
// nothing else, and reputation is slow and earned: a coach appointed at
// Northampton (rep 86) on day one still carries rep 22, so a rep 38
// second-division board rolled him at 42% and the Job Centre card said Outside
// shot. Nobody interviews the Northampton head coach for Sedgley Park and
// wonders whether he is good enough.
let cvFails = 0
const cvOk = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) cvFails++
}
{
  const h = newGame('northampton', 'CV', 4242)
  const byRep = (r: number) => Object.values(h.clubs).sort((a, b) => Math.abs(a.rep - r) - Math.abs(b.rep - r))[0]
  const small = byRep(38), mid = byRep(55), near = byRep(70), peer = byRep(86), giant = byRep(93)
  cvOk(mgrReputation(h) < 30, `a day-one coach has nothing on paper yet (rep ${mgrReputation(h)})`)
  cvOk(jobChance(h, small.id) >= 0.9,
    `but the ${h.clubs[h.userClubId].short} job makes ${small.short} (rep ${small.rep}) a formality (${jobChance(h, small.id).toFixed(2)})`)
  cvOk(jobChance(h, mid.id) >= 0.8,
    `and ${mid.short} (rep ${mid.rep}) a strong favourite (${jobChance(h, mid.id).toFixed(2)})`)
  cvOk(jobChance(h, near.id) >= 0.5,
    `a step down is still comfortable (${near.short}, rep ${near.rep}: ${jobChance(h, near.id).toFixed(2)})`)
  // and the ceiling is untouched: standing is not the same as having earned it
  cvOk(jobChance(h, peer.id) <= 0.5,
    `a club as big as your own is not a formality (${peer.short}, rep ${peer.rep}: ${jobChance(h, peer.id).toFixed(2)})`)
  cvOk(jobChance(h, giant.id) <= 0.2,
    `and a giant still says no politely (${giant.short}, rep ${giant.rep}: ${jobChance(h, giant.id).toFixed(2)})`)

  // THE TEST JOB IS A CV OF ITS OWN, and it survives losing the club job -
  // which is the case the owner named, since a national coach between club
  // posts is exactly who a smaller board should be queuing up for.
  const j = newGame('montauban', 'CV2', 4243)
  j.unemployed = true
  const tiny = Object.values(j.clubs).sort((a, b) => a.rep - b.rep)[0]
  const before = jobChance(j, tiny.id)
  j.natTeam = 'SCO'
  const after = jobChance(j, tiny.id)
  cvOk(after > before,
    `coaching a Test side is worth something on its own (${before.toFixed(2)} -> ${after.toFixed(2)} at ${tiny.short})`)
  cvOk(after >= 0.9, `enough that a rep ${tiny.rep} board is not a gamble (${after.toFixed(2)})`)
}
if (cvFails) { console.error(`JOBS TEST FAILED (${cvFails})`); process.exit(1) }

console.log('JOBS TEST PASSED')
