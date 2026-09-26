/**
 * ---- THE WALKOVER: ten is the line ----
 *
 * 1.6.4 gave the engine a forfeit rule (matchEngine.ts forfeitSide): a club
 * that cannot put ten fit players on the field concedes 28-0 with four tries,
 * and the loser leaves with nothing. Before it the engine played on with
 * three men and lost 0-82 (scripts/qa/edge.ts). This holds the rule at the
 * edges: nine forfeits, ten plays, a nation never forfeits, both short is a
 * scratched 0-0, the table takes the walkover like any result, and the
 * manager's own side is told in the inbox.
 *
 * Run: npx vite-node scripts/forfeitprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, weekRng } from '../src/game/season'
import { simMatch, forfeitSide, FORFEIT_MIN, FORFEIT_SCORE, FORFEIT_TRIES } from '../src/game/matchEngine'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

function toFixtureWeek(g: GameState, clubId: string) {
  let guard = 0
  while (guard++ < 30 && !g.fixtures.some(f => f.week === g.week && !f.played && (f.homeId === clubId || f.awayId === clubId))) processWeekAndAdvance(g)
  return g.fixtures.find(f => f.week === g.week && !f.played && (f.homeId === clubId || f.awayId === clubId))!
}

function thin(g: GameState, clubId: string, keep: number) {
  const club = g.clubs[clubId]
  for (const id of club.players.slice(keep)) g.players[id].clubId = null
  club.players = club.players.slice(0, keep)
  // "N available players" means N who can play: the men kept are made fit and
  // free. The first ten on the list used to be kept as they were, and when
  // the TMO moved the stream one of them was carrying a knock from the weeks
  // before, so ten on the books was nine available and the rule (rightly)
  // called a walkover the probe had labelled a match.
  for (const id of club.players) { const p = g.players[id]; p.injury = null; p.bans = 0 }
}

// ---- nine forfeits, ten plays -----------------------------------------------
for (const [keep, expectForfeit] of [[FORFEIT_MIN - 1, true], [FORFEIT_MIN, false]] as const) {
  const g = newGame('bath', 'Forfeit', 3)
  for (let i = 0; i < 4; i++) processWeekAndAdvance(g)
  const fx = toFixtureWeek(g, 'bath')
  thin(g, 'bath', keep)
  const side = forfeitSide(g, fx)
  ok((side != null) === expectForfeit, `${keep} available players: ${expectForfeit ? 'a walkover' : 'a match'} (${side ?? 'plays'})`)
  simMatch(g, fx, weekRng(g), true)
  const bathHome = fx.homeId === 'bath'
  const bathScore = bathHome ? fx.homeScore : fx.awayScore
  const oppScore = bathHome ? fx.awayScore : fx.homeScore
  const oppTries = bathHome ? fx.awayTries : fx.homeTries
  if (expectForfeit) {
    ok(fx.played && bathScore === 0 && oppScore === FORFEIT_SCORE && oppTries === FORFEIT_TRIES,
      `the walkover is ${FORFEIT_SCORE}-0 with ${FORFEIT_TRIES} tries (${fx.homeId} ${fx.homeScore}-${fx.awayScore} ${fx.awayId})`)
    ok(g.news.some(n => n.k === 'news.forfeit'), 'and the manager is told in the inbox')
    processWeekAndAdvance(g)
    const row = g.comps.prem.table.find(r => r.teamId === 'bath')!
    const opp = g.comps.prem.table.find(r => r.teamId === (bathHome ? fx.awayId : fx.homeId))!
    ok(row.l >= 1 && row.pa >= FORFEIT_SCORE, `the table records the defeat (bath l${row.l} pa${row.pa})`)
    ok(opp.w >= 1 && opp.bp >= 1, `and the win with its try bonus (${opp.teamId} w${opp.w} bp${opp.bp})`)
  } else {
    ok(fx.played && (fx.homeScore + fx.awayScore > 0 || fx.events != null), 'ten men play the match out')
  }
}

// ---- both short: scratched ---------------------------------------------------
{
  const g = newGame('bath', 'Forfeit', 5)
  for (let i = 0; i < 4; i++) processWeekAndAdvance(g)
  const fx = toFixtureWeek(g, 'bath')
  thin(g, fx.homeId, 5)
  thin(g, fx.awayId, 5)
  ok(forfeitSide(g, fx) === 'both', 'both sides short is both')
  simMatch(g, fx, weekRng(g), false)
  ok(fx.played && fx.homeScore === 0 && fx.awayScore === 0 && fx.homeTries === 0 && fx.awayTries === 0, 'and the fixture is scratched 0-0')
}

// ---- a nation never forfeits -------------------------------------------------
{
  const g = newGame('leicester', 'Forfeit', 9)
  const test = g.fixtures.find(f => !g.clubs[f.homeId] && !g.clubs[f.awayId])
  ok(!!test && forfeitSide(g, test) === null, `a Test match is never a walkover (${test?.homeId} v ${test?.awayId})`)
}

console.log(fails ? `FORFEIT PROBE FAILED (${fails})` : 'FORFEIT PROBE PASSED: ten men play, nine concede, and the table knows')
process.exit(fails ? 1 : 0)
