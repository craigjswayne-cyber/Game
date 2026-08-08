// Probe: the monthly awards are earned.
//
// This exists because of a live report - "wife won manager of the month with only
// one game played" - and because the measurement behind that was worse than the
// report: across three careers, 100% of awards were decided on two league games
// or fewer, 36% on one or none, and 12 of 66 went to a manager with NIL POINTS
// because an empty international window still crowned whoever sat first in the
// table array.
//
// So this walks real careers and holds the award to the standard: a real sample,
// a real return, merit over table position, and no award at all in a month where
// nobody did enough.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import { AWARD_EVERY, MIN_MATCHES, MIN_WINS, deserves, managerOfMonth, monthRun, runLine } from '../src/game/awards'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

const hist: Record<number, number> = {}
let awards = 0, noAward = 0, userWins = 0, thin = 0, pointless = 0
let minWinPts = 99
const lines: string[] = []

for (const seed of [12345, 777, 4242]) {
  const g = newGame('northampton', 'Award Probe', seed)
  for (let w = 0; w < SEASON_WEEKS * 2; w++) {
    if (g.week % AWARD_EVERY === 0 && !g.unemployed) {
      const leagueId = g.clubs[g.userClubId].leagueId
      const comp = g.comps[leagueId]
      if (comp?.type === 'league') {
        const from = g.week - (AWARD_EVERY - 1)
        for (const r of comp.table) {
          const run = monthRun(g, r.teamId, from, g.week)
          hist[run.matches] = (hist[run.matches] ?? 0) + 1
        }
        const won = managerOfMonth(g, leagueId, from, g.week)
        if (won) {
          awards++
          if (won.matches <= 2) thin++
          if (won.pts <= 0) pointless++
          if (won.wins < MIN_WINS) bad(`an award went to a manager with ${won.wins} wins`)
          if (won.matches < MIN_MATCHES) bad(`an award went to a manager with ${won.matches} matches`)
          minWinPts = Math.min(minWinPts, won.pts)
          if (won.clubId === g.userClubId) userWins++
          if (lines.length < 3) lines.push(`  ${g.clubs[won.clubId]?.short}: ${runLine(g, won)}`)

          // and it has to be the BEST qualifying month, not merely a qualifying
          // one: nobody who cleared the bar may have a higher merit score
          const better = comp.table
            .map(r => monthRun(g, r.teamId, from, g.week))
            .filter(deserves)
            .filter(r => r.score > won.score + 1e-9)
          if (better.length) {
            bad(`${g.clubs[won.clubId]?.short} won on ${won.score.toFixed(2)} while ${g.clubs[better[0].clubId]?.short} scored ${better[0].score.toFixed(2)}`)
          }
        } else {
          noAward++
          // and when nobody wins it, nobody may have deserved it
          const any = comp.table.map(r => monthRun(g, r.teamId, from, g.week)).filter(deserves)
          if (any.length) bad(`no award was given but ${g.clubs[any[0].clubId]?.short} had ${any[0].wins}W from ${any[0].matches}`)
        }
      }
    }
    try { processWeekAndAdvance(g) } catch { break }
  }
}

console.log('matches a club played in an award window:')
for (const k of Object.keys(hist).map(Number).sort((a, b) => a - b)) {
  console.log(`  ${k}: ${hist[k]} club-windows`)
}
console.log(`\n${awards} awards, ${noAward} windows where nobody deserved one`)
console.log(`the user's club won ${userWins} (${((userWins / Math.max(1, awards)) * 100).toFixed(0)}% of them)`)
console.log(`thinnest winning sample: ${thin} on two matches or fewer; lowest winning return: ${minWinPts} pts`)
console.log('sample write-ups:')
for (const l of lines) console.log(l)

// ---- the standard ----
if (awards < 15) bad(`only ${awards} awards over three careers, which is too few to judge`)
if (thin) bad(`${thin} awards were decided on two matches or fewer`)
if (pointless) bad(`${pointless} awards went to a manager who won nothing`)
if (minWinPts < MIN_WINS * 3) bad(`an award was won on ${minWinPts} points, under the ${MIN_WINS}-win bar`)
// It must not simply always be the user. A strong club in a big league should
// take its fair share and no more: one in eight is generous for a 12-plus-club
// league, and anything past a quarter means the award is following the human
// rather than the results.
const share = userWins / Math.max(1, awards)
if (share > 0.25) bad(`the user's club won ${(share * 100).toFixed(0)}% of the awards, which is the award following the manager rather than the rugby`)

// ---- a fabricated month, to prove the gate rejects what it should ----
{
  const g = newGame('northampton', 'Award Probe', 999)
  const me = g.userClubId
  const leagueId = g.clubs[me].leagueId
  const opp = g.comps[leagueId].table.map(r => r.teamId).find(id => id !== me)!
  // one match, won handsomely: the exact case that was reported
  g.fixtures.push({
    id: g.nextId++, week: 6, compId: leagueId, homeId: me, awayId: opp,
    played: true, homeScore: 50, awayScore: 3,
  } as never)
  const one = managerOfMonth(g, leagueId, 1, 6)
  console.log(`\none game won 50-3: ${one ? `awarded to ${one.clubId}` : 'no award'}`)
  if (one?.clubId === me) bad('a single game, however one-sided, still won Manager of the Month')

  // three matches, one win two defeats: a bad month with a good day in it
  g.fixtures.push({
    id: g.nextId++, week: 5, compId: leagueId, homeId: opp, awayId: me,
    played: true, homeScore: 40, awayScore: 10,
  } as never)
  g.fixtures.push({
    id: g.nextId++, week: 4, compId: leagueId, homeId: opp, awayId: me,
    played: true, homeScore: 30, awayScore: 12,
  } as never)
  const poor = monthRun(g, me, 1, 6)
  console.log(`one win, two defeats: ${poor.wins}W ${poor.losses}L from ${poor.matches}, deserves ${deserves(poor)}`)
  if (deserves(poor)) bad('one win from three was judged a month worth an award')
}

if (fails) { console.error(`AWARD PROBE: ${fails} failures`); process.exit(1) }
console.log('\nAWARD PROBE PASSED')
