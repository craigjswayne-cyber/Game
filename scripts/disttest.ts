// Scoreline distribution check mid-season (before rollover wipes fixtures).
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'

const g = newGame('toulouse', 'Dist Tester', 777)
while (g.week < 36) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), false)
  processWeekAndAdvance(g)
}
const played = g.fixtures.filter(f => f.played && g.comps[f.compId]?.type === 'league')
const avgTotal = played.reduce((s, f) => s + f.homeScore + f.awayScore, 0) / played.length
const avgTries = played.reduce((s, f) => s + f.homeTries + f.awayTries, 0) / played.length
const homeW = played.filter(f => f.homeScore > f.awayScore).length / played.length
const draws = played.filter(f => f.homeScore === f.awayScore).length / played.length
const blowouts = played.filter(f => Math.abs(f.homeScore - f.awayScore) > 40).length / played.length
const max = played.reduce((m, f) => Math.max(m, f.homeScore, f.awayScore), 0)
console.log(`games ${played.length} | avg total ${avgTotal.toFixed(1)} | avg tries ${avgTries.toFixed(2)} | home win ${(homeW * 100).toFixed(0)}% | draws ${(draws * 100).toFixed(1)}% | blowouts>40 ${(blowouts * 100).toFixed(1)}% | max score ${max}`)
// injuries and cards volume
const inj = Object.values(g.players).filter(p => p.injury).length
console.log(`currently injured across world: ${inj} of ${Object.keys(g.players).length}`)
// table sanity: Top14 leader should be a big club more often than not
import { sortTable } from '../src/game/schedule'
for (const id of ['prem', 'top14', 'urc', 'srp']) {
  const t = sortTable(g.comps[id].table)
  console.log(`${id}: 1st ${t[0].teamId} (${t[0].pts}pts) ... last ${t[t.length - 1].teamId}`)
}
