// The English trapdoor is a game now (21A).
//
// User: "in England relegation should be a playoff game with the winner of
// the championship." Week 44: the Premiership's bottom club hosts the
// Championship winner, and the rollover reads that result instead of
// swapping the two clubs blind. Both outcomes are forced here by writing
// the scoreline before the rollover reads it, so the probe proves the swap
// logic rather than waiting for a seed to produce each ending.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { sortTable } from '../src/game/schedule'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

/** Walk a season to week 44 with the bar played, hand the scoreline to the
 *  caller to bend, then roll into next season and report who plays where. */
function runSeason(seed: number, bend: (bar: Fixture, g: GameState) => void) {
  const g = newGame('northampton', 'Barrage', seed)
  let bar: Fixture | undefined
  let bottom = '', up = ''
  let guard = 0
  while (g.season === 0 && guard++ < 60) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), false)
    if (g.week === 44) {
      bar = g.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR')
      if (bar) {
        bottom = bar.homeId; up = bar.awayId
        // the fixture may not have settled yet this week - let processWeek
        // play it, then bend the result before the season rolls over
      }
    }
    const preSeason = g.season
    processWeekAndAdvance(g)
    if (g.week === 45 || (g.season === preSeason && g.week > 44)) {
      if (bar?.played) bend(bar, g)
    }
    if (g.season !== preSeason) break
  }
  return { g, bar, bottom, up }
}

// ---- the playoff exists, between the right two clubs, off the table --------
{
  const { g, bar, bottom, up } = runSeason(5, () => {})
  ok(!!bar, 'week 44 holds the relegation playoff')
  if (bar) {
    ok(bar.homeId === bottom && g.clubs[bottom] != null, `the Premiership's bottom club hosts (${g.clubs[bottom]?.short})`)
    ok(g.clubs[up] != null && bar.awayId === up, `the Championship winner travels (${g.clubs[up]?.short})`)
    ok(bar.played, 'and the game was actually played')
    ok(g.news.some(n => /relegation playoff/i.test(n.subject)), 'the playoff was announced when the finals settled')
  }
}

// ---- the champion wins it: the swap happens ---------------------------------
{
  const { g, bar, bottom, up } = runSeason(5, b => { b.homeScore = 10; b.awayScore = 24 })
  if (bar) {
    ok(g.clubs[up].leagueId === 'prem', `${g.clubs[up].short} win the playoff and go up`)
    ok(g.clubs[bottom].leagueId === 'champ', `${g.clubs[bottom].short} lose it at home and go down`)
  } else { fails++ }
}

// ---- the bottom club wins it: everybody stays where they were ---------------
{
  const { g, bar, bottom, up } = runSeason(5, b => { b.homeScore = 24; b.awayScore = 10 })
  if (bar) {
    ok(g.clubs[bottom].leagueId === 'prem', `${g.clubs[bottom].short} survive on their own patch`)
    ok(g.clubs[up].leagueId === 'champ', `${g.clubs[up].short} stay down despite the title`)
    ok(g.news.some(n => /SURVIVED|stay down|keep their Premiership place/i.test(`${n.subject} ${n.body}`)),
      'and the great escape makes the news')
  } else { fails++ }
}

// ---- the playoff never pollutes the league table ----------------------------
{
  const g = newGame('northampton', 'Barrage', 5)
  let guard = 0
  while (g.season === 0 && g.week < 45 && guard++ < 60) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), false)
    if (g.week === 44) break
    processWeekAndAdvance(g)
  }
  const prem = g.comps['prem']
  const rows = sortTable(prem.table)
  const plays = new Set(rows.map(r => r.p))
  ok(plays.size === 1, `every Premiership club has played the same number of league games (${[...plays].join(', ')})`)
}

console.log(fails ? `\nBARRAGE PROBE FAILED (${fails})` : '\nBARRAGE PROBE PASSED: the trapdoor is eighty minutes long')
process.exit(fails ? 1 : 0)
