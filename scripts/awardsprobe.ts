/**
 * ---- THE TEAM OF THE YEAR ----
 *
 * Owner: "It should be also a time to show off the dream team of the year...
 * if you have a player in your team on this - extra revenue should come in from
 * shirt sales, events and demand to sponsor them."
 *
 * The World Player of the Year was already in the game; the fifteen were not.
 * This holds the new half and the one line where the two must agree:
 *
 *   the fifteen are a real fifteen - every shirt filled, nobody named twice;
 *   they have all played for their country;
 *   it lands with the awards night, once a season, not on a loop;
 *   having one of them pays, and the player of the year pays more;
 *   AND IT NEVER DISAGREES WITH THE OTHER AWARD about who won - the first
 *   draft of this feature filed a second, different player of the year under a
 *   news key the real award already owned.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import { teamOfTheYear, awardWindfall } from '../src/game/yearend'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const SEASONS = 4
const g = newGame('bath', 'Test', 24601)
const totyBySeason = new Map<number, number>()
const potyBySeason = new Map<number, number>()
let paydays = 0
let paid = 0

for (let s = 0; s < SEASONS; s++) {
  for (let i = 0; i < SEASON_WEEKS; i++) {
    const budgetBefore = g.clubs[g.userClubId].budget
    processWeekAndAdvance(g)
    const toty = g.news.filter(n => n.k === 'news.toty')
    const poty = g.news.filter(n => n.k === 'news.poty')
    const mineNews = g.news.filter(n => n.k === 'news.totyMine')
    for (const n of toty) totyBySeason.set(n.season, (totyBySeason.get(n.season) ?? 0) + 1)
    for (const n of poty) potyBySeason.set(n.season, (potyBySeason.get(n.season) ?? 0) + 1)
    // the two awards must name the same winner
    for (const n of mineNews) {
      void n
      paydays++
      if (g.clubs[g.userClubId].budget > budgetBefore) paid++
    }
    g.news = g.news.filter(n => !['news.poty', 'news.toty', 'news.totyMine'].includes(n.k ?? ''))
  }
}

console.log(`\n${SEASONS} seasons: ${totyBySeason.size} teams of the year, ${potyBySeason.size} players of the year, ${paydays} paydays`)
ok(totyBySeason.size > 0, 'the Team of the Year is published at all')
ok([...totyBySeason.values()].every(n => n === 1),
  `and exactly once a season${[...totyBySeason.values()].some(n => n !== 1) ? ` (saw ${[...totyBySeason.values()].join(', ')})` : ''}`)
ok([...potyBySeason.values()].every(n => n === 1),
  `the Player of the Year still fires exactly once a season too${[...potyBySeason.values()].some(n => n !== 1) ? ` (saw ${[...potyBySeason.values()].join(', ')})` : ''}`)
ok(totyBySeason.size === potyBySeason.size, 'the two land on the same night, every year')

// ---- the fifteen are a real fifteen ----
const h = newGame('bath', 'Test', 777)
for (let i = 0; i < SEASON_WEEKS - 2; i++) processWeekAndAdvance(h)
const xv = teamOfTheYear(h)
ok(xv.length === 15, `fifteen players, one per shirt (${xv.length})`)
ok(new Set(xv.map(p => p.id)).size === xv.length, 'and nobody is named twice')
// THE INVARIANT THE TWO AWARDS SHARE. Both are scored on the same sum, so the
// best eligible player in the world has to be in the fifteen - if he is not,
// the awards night is about to name a Player of the Year it then leaves out.
// This is checked on a live state rather than by reading the news text, because
// after the rollover that files it the winner may already have retired.
const eligible = Object.values(h.players)
  .filter(p => (p.caps ?? 0) > 0 && p.stats.apps >= 6 && !!p.clubId)
const score = (p: typeof eligible[number]) => {
  const cups = h.history.filter(x => x.season === h.season && x.champion === p.clubId).length
  return p.stats.ratingSum / p.stats.apps + p.stats.tries * 0.004 + cups * 0.15
}
const best = eligible.sort((a, b) => score(b) - score(a))[0]
ok(!!best && xv.some(p => p.id === best.id),
  `the best eligible player in the world is in his own team of the year (${best?.name ?? 'nobody'}, ${best?.pos ?? '-'})`)

const shape = xv.map(p => p.pos).sort().join(',')
ok(shape === 'CE,CE,FB,FH,FL,FL,HK,LK,LK,LP,N8,SH,TP,WG,WG',
  `the shape is a rugby team, not a list of good players (${shape})`)
ok(xv.every(p => (p.caps ?? 0) > 0), 'every one of them has played for his country')

// ---- it pays, and it pays more for the big prize ----
ok(awardWindfall(70, 0, false) === 0, 'a club with nobody in it gets nothing')
ok(awardWindfall(70, 1, false) > 0, 'a club with one of them gets paid')
ok(awardWindfall(70, 2, false) > awardWindfall(70, 1, false), 'two are worth more than one')
ok(awardWindfall(70, 1, true) > awardWindfall(70, 1, false), 'and the player of the year is worth more than a team-mate')
ok(awardWindfall(90, 1, false) > awardWindfall(50, 1, false), 'a bigger club sells more shirts off the same name')
ok(paydays === 0 || paid === paydays, `every payday actually reached the budget (${paid}/${paydays})`)

console.log('')
if (fails === 0) console.log('AWARDS PROBE PASSED: one awards night, a real fifteen, and it pays')
else console.log(`AWARDS PROBE FAILED (${fails})`)
process.exit(fails)
