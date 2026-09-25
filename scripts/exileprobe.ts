/**
 * ---- WHEN THEY SACK YOU, THEY SACK YOU ----
 *
 * Owner, 1.7.0, two faults in one breath:
 *
 *   "I was fired by a team but still see news stories related to them appear
 *    in my news feed. Once fired the news around the club shouldnt be there
 *    anymore."
 *   "if fired by a club - you should be instantly dismissed if you apply for
 *    the job again within a 3 month period."
 *
 * ONE CAUSE BEHIND THE FIRST. state.userClubId keeps naming the last club
 * after a dismissal, on purpose - the annals, the era summary and the legend
 * list all need to know where the man worked. But every LIVE "my club" feature
 * read the same field, so a sacked manager went on getting his old side's
 * training report, their transfer bids, their record gate and a VICTORY/DEFEAT
 * report on his own W-D-L for a team he no longer picked. Measured before the
 * fix: 146 stories in 25 weeks out of work, and the training tick was still
 * applying his gym, his physio and his staff to their squad.
 *
 * The fix is model.ts myClubId(), which is null while he is out of work. This
 * probe is the guard, and it is deliberately written as a SWEEP rather than a
 * list of the seventeen story keys that leaked: a new feature that reaches for
 * state.userClubId without thinking fails here the week it is written, which a
 * hand-kept list would not catch.
 *
 * WHAT COUNTS AS A LEAK. A story is a leak if it names the old club, its short
 * name, its ground or one of the players who were in its squad on the day of
 * the sacking. That deliberately catches some innocent world news - the league
 * round-up naming a table, the club appointing its next Director of Rugby -
 * so those keys are named in ALLOWED below, each with the reason it is
 * genuinely news a man out of work would read.
 *
 * Run: npx tsx scripts/exileprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { applyForJob, jobChance, sackCooloff, sackManager, SACK_COOLOFF } from '../src/game/jobs'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { absWeek, type GameState, type Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

/** Stories that may name the old club while the manager is out of work, and
 *  why. Anything not on this list is a leak. */
const ALLOWED = new Set([
  // the club that sacked you appointing (and later sacking) its next man is
  // the most-read story in the game for somebody who has just left
  'news.coachOut', 'news.coachIn',
  // league tables, round-ups and the wire name every club in the division
  'news.roundUp', 'news.leagueRoundUp', 'news.powerRankings',
  // the transfer wire is about the whole market
  'news.wire', 'news.transferRumour',
])

const fresh = (): GameState => {
  const g = newGame('leicester', 'Exile Probe', 99)
  while (g.week < 10) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), false)
    processWeekAndAdvance(g)
  }
  return g
}

// ---- 1. the sack closes the club's door on the news feed -------------------
console.log('--- 1. once fired, the old club leaves the inbox')
{
  const g = fresh()
  const old = g.clubs[g.userClubId]
  const oldName = old.name, oldShort = old.short, oldStadium = old.stadium
  const squadThen = old.players
    .map(id => g.players[id]).filter((p): p is Player => !!p).map(p => p.name)
  sackManager(g, 'news.sacked')
  const mark = g.news.length
  for (let i = 0; i < 25 && g.unemployed; i++) processWeekAndAdvance(g)

  const filed = g.news.slice(mark)
  const leaks = filed.filter(n => {
    if (ALLOWED.has(n.k ?? '')) return false
    const text = `${n.subject} ${n.body}`
    return text.includes(oldName) || text.includes(oldShort) || text.includes(oldStadium)
      || squadThen.some(name => text.includes(name))
  })
  for (const n of leaks.slice(0, 8)) console.log(`       leak [${n.k}] ${n.subject}`)
  ok(filed.length > 10, `the world keeps writing while he is out of work (${filed.length} stories)`)
  ok(leaks.length === 0, `and not one of them is about the club that sacked him (${leaks.length})`)
}

// ---- 2. and stops running their week for them ------------------------------
console.log('--- 2. his staff go with the job')
{
  const g = fresh()
  const oldId = g.userClubId
  // an out-of-work manager's physio, gym and academy coach must not keep
  // treating a squad he does not pick. The staff are HIS, not the club's.
  g.staff = { ...g.staff, physio: 3, assistant: 3, academyCoach: 3 }
  sackManager(g, 'news.sacked')
  const hurt = g.clubs[oldId].players
    .map(id => g.players[id]).filter((p): p is Player => !!p)[0]
  hurt.cond = 40
  const before = hurt.cond
  processWeekAndAdvance(g)
  // the club's own recovery still applies; the +9 a level-3 physio would add
  // on top of it does not
  ok(hurt.cond - before <= 25, `a sacked manager's physio is not treating their squad (${before} -> ${hurt.cond.toFixed(0)})`)
}

// ---- 3. three months before that board will see you again ------------------
console.log('--- 3. the board that sacked you remembers for three months')
{
  const g = fresh()
  const oldId = g.userClubId
  sackManager(g, 'news.sacked')
  ok((g.sackedBy ?? []).some(r => r.clubId === oldId), 'the dismissal is on the record')
  ok(sackCooloff(g, oldId) === SACK_COOLOFF, `and the door is shut for ${SACK_COOLOFF} weeks`)
  ok(jobChance(g, oldId) === 0, 'the club that sacked him is not a long shot, it is a no')

  // the vacancy sackManager opened is the very job in question
  const said = applyForJob(g, oldId)
  ok(!said.includes('offer') && said.length > 0, `applying is refused at the door: "${said.slice(0, 60)}..."`)
  ok(!g.jobOffer, 'no offer is made')
  ok(!g.vacancies.find(v => v.clubId === oldId)?.applied,
    'and it does not burn his one application - he can apply properly once the clock runs out')
  ok(!g.news.some(n => n.k === 'news.jobRejected'), 'nor does a refusal at the door reach the inbox as a rejection letter')

  // ...and once it has run out, the club is an ordinary vacancy again
  g.sackedBy = [{ clubId: oldId, at: absWeek(g.season, g.week) - SACK_COOLOFF }]
  ok(sackCooloff(g, oldId) === 0, 'three months later the clock has run out')
  ok(jobChance(g, oldId) > 0, 'and they will take an application again')
}

// ---- 4. a second sacking restarts the clock, and nobody else is barred -----
console.log('--- 4. the record is per club, and the last cheque is the one that counts')
{
  const g = fresh()
  const oldId = g.userClubId
  const other = Object.keys(g.clubs).find(id => id !== oldId)!
  g.sackedBy = [
    { clubId: oldId, at: absWeek(g.season, g.week) - SACK_COOLOFF - 20 },
    { clubId: oldId, at: absWeek(g.season, g.week) - 2 },
  ]
  ok(sackCooloff(g, oldId) === SACK_COOLOFF - 2, 'sacked twice, the second cheque restarts the clock')
  ok(sackCooloff(g, other) === 0, 'and no other board has heard anything about it')
}

// ---- 5. resigning is not being sacked --------------------------------------
console.log('--- 5. walking out is a decision, not a dismissal')
{
  const g = fresh()
  const oldId = g.userClubId
  const { resignJob } = await import('../src/game/jobs')
  resignJob(g)
  ok(g.unemployed, 'the job is gone either way')
  ok(sackCooloff(g, oldId) === 0, 'but a club you left on your own terms would have you back')
}

console.log(fails ? `\nEXILE PROBE FAILED (${fails})` : '\nEXILE PROBE PASSED')
process.exit(fails ? 1 : 0)
