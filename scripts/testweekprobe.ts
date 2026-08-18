// Probe: a Test week belongs to the Test coach.
//
// User, holding the Scotland job: "it didnt show the fixture and just played
// it. when you take on a international job your assistant should step in for
// the periods of time and let you coach the team... its meant to be the
// pinnacle but is hidden away."
//
// The mechanism: matchday routing preferred the CLUB fixture, so any Test
// falling in a club week was silently simmed by the settle loop. Three
// claims now, all through userMatchThisWeek - the single decision point the
// day walk and both match entrances read:
//
//   1. When club and country both play this week, the manager's match is his
//      country's.
//   2. The assistant takes the club fixture: it is simmed, applied to the
//      table, and reported by name in the news.
//   3. The club's afternoon still counts in full - the board reacts and the
//      report files - and the manager's own record counts only the match his
//      hands were on.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userMatchThisWeek } from '../src/game/season'
import type { Fixture } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('northampton', 'TestWeek', 61)
// take the Scotland job and walk to a week with a club fixture
g.natTeam = 'SCO'
g.natConfidence = 60
for (let i = 0; i < 12; i++) {
  processWeekAndAdvance(g)
  const club = g.clubs[g.userClubId]
  const cfx = g.fixtures.find(f => f.week === g.week && !f.played && f.compId !== 'fr' &&
    (f.homeId === club.id || f.awayId === club.id))
  if (cfx) break
}
const club = g.clubs[g.userClubId]
const clubFx = g.fixtures.find(f => f.week === g.week && !f.played &&
  (f.homeId === club.id || f.awayId === club.id))!
ok(!!clubFx, `a club fixture stands this week (wk${g.week})`)

// the union schedules a Test the same weekend
const test: Fixture = {
  id: 950_001, compId: 'sn', round: 1, week: g.week, homeId: 'SCO', awayId: 'ENG',
  played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
}
g.fixtures.push(test)

// 1. the manager's match is his country's
const mine = userMatchThisWeek(g)
ok(mine?.id === test.id, `userMatchThisWeek hands him the Test, not the club game (got ${mine?.compId})`)

// the UI plays it: mark it the way MatchDay leaves a match
test.played = true
test.homeScore = 24; test.awayScore = 18; test.homeTries = 3; test.awayTries = 2

const mgrBefore = g.mgr.m
const confBefore = g.natConfidence
processWeekAndAdvance(g)

// 2. the assistant took the club match, visibly
ok(clubFx.played && clubFx.tableApplied === true, 'the club fixture was played and applied to the table')
const note = g.news.find(n => n.subject.includes('The assistant took the'))
ok(!!note, `the assistant's afternoon is reported by name${note ? ` ("${note.subject}")` : ''}`)

// 3. the ledger is split correctly
ok(g.mgr.m === mgrBefore + 1, `the manager's record counts the Test only (${mgrBefore} -> ${g.mgr.m})`)
ok(g.natConfidence !== confBefore, `the union's confidence moved on the result (${confBefore} -> ${g.natConfidence})`)
const clubReport = g.news.find(n => n.fixtureId === clubFx.id && n.id !== note?.id)
ok(!!clubReport, 'the club match still filed its own report')

console.log(fails ? `\nTEST WEEK PROBE FAILED (${fails})` : '\nTEST WEEK PROBE PASSED: the pinnacle is on the touchline, not in the round-up')
process.exit(fails ? 1 : 0)
