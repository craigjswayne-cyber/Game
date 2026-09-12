/**
 * ---- THE WOMEN'S MARKET HAS TO HAVE BUYERS IN IT ----
 *
 * Owner, 1.5.8: "no AI club bid for any player across a whole season in the
 * women's game, so accept/reject never fires." A feature shipped one version
 * earlier - answering an incoming bid from the Inbox - was unreachable in half
 * the game, and nothing failed, because nothing was broken. The market was
 * simply priced out of itself.
 *
 * WHAT WAS ACTUALLY WRONG. ai.ts will only let a club bid for one of yours if
 * `c.budget >= p.value * 0.8`. Measured before the fix: the median women's club
 * opened on a £140k transfer budget against a £1.81m median player - 12.9 times
 * the money it had - and ZERO of the 64 clubs cleared the bar for anybody. The
 * men's world opened at 1.87x with 38 of 101 clearing it. The cause was one
 * season deep: rollover recomputes every budget from reputation each summer, so
 * from season two the two worlds already sat level, and only the opening
 * figures were out. newgame's openingBudget lifts them (W_OPENING_MONEY).
 *
 * This probe is the thing that was missing: it plays a full season in BOTH
 * worlds and counts the bids that actually landed. It is deliberately written
 * as a comparison rather than a threshold, because the honest test is not "some
 * number of bids" - it is that a woman manager's inbox works like a man's.
 *
 * Run: npx tsx scripts/wmarketprobe.ts
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import type { Gender } from '../src/game/gender'

let fails = 0
const ok = (cond: boolean, msg: string) => {
  if (!cond) { fails++; console.log('FAIL  ' + msg) } else console.log('  ok  ' + msg)
}

/** bids received for the user's players across one full season */
function seasonBids(club: string, gender: Gender, seed: number): number {
  const g = newGame(club, 'Probe', seed, undefined, 'coach', gender)
  const seen = new Set<number>()
  for (let w = 0; w < 48; w++) {
    processWeekAndAdvance(g)
    for (const o of g.offers) if (o.forUser) seen.add(o.id)
  }
  return seen.size
}

const SEEDS = [7, 99, 1234]
const wClub = LEAGUE_DEFS('w')[0].clubs[0].id
const mBids = SEEDS.map(s => seasonBids('northampton', 'm', s))
const wBids = SEEDS.map(s => seasonBids(wClub, 'w', s))
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

console.log(`\n  men's bids per season   ${mBids.join(', ')}`)
console.log(`  women's bids per season ${wBids.join(', ')}\n`)

ok(wBids.every(n => n > 0),
  'every women\'s season received at least one bid - the Inbox answer has something to answer')
ok(sum(wBids) >= 9,
  `three women's seasons produce a market rather than an accident (${sum(wBids)} bids)`)
// The women's world is a smaller world - 18 clubs inside the user's reputation
// band against 53 in the men's - so it will never match bid for bid, and
// demanding that it does would be demanding a league that does not exist. A
// third of the men's traffic is the line between "quieter" and "dead".
ok(sum(wBids) >= sum(mBids) / 3,
  `and it is a fraction of the men's market, not a rounding error (${sum(wBids)} v ${sum(mBids)})`)

// the root cause, asserted directly, so a future budget change that undoes it
// fails HERE rather than in a season of somebody's career
for (const [label, club, gender] of [['men', 'northampton', 'm'], ['women', wClub, 'w']] as const) {
  const g = newGame(club, 'Probe', 7, undefined, 'coach', gender)
  const vals = Object.values(g.players).map(p => p.value).sort((a, b) => a - b)
  const median = vals[vals.length >> 1]
  const clubs = Object.values(g.clubs)
  const can = clubs.filter(c => c.budget >= median * 0.8).length
  ok(can / clubs.length > 0.25,
    `${label}: ${can} of ${clubs.length} clubs open able to pay 80% of the median player (£${(median / 1e6).toFixed(2)}m)`)
}

console.log(fails === 0
  ? '\nW MARKET PROBE PASSED: both worlds have buyers in them'
  : `\nW MARKET PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
