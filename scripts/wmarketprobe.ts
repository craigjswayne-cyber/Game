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

// NINE WOMEN'S WORLDS (1.8.0). One season's bids for one club run anywhere
// from 1 to 20, so three worlds could read 5 on a commit whose next six read
// 50 (and the commit before it 45 on the same six). The men's side stays at
// three: it is the yardstick, and it is steady at 11-18 a season.
//
// 36 AND 18 NOW (28 Sep 2026). Nine women's seasons against three men's put
// the "a third of the men's market" line one or two standard errors from its
// floor: four shifted seed lists read 6.3 v 4.7, 6.4 v 5.3, 7.1 v 4.3 and
// 6.6 v 5.3 bids a season, with one season running anywhere from 1 to 13
// (sd about 3.1 women's, 3.8 men's). The true margin is about 1.6 bids, so
// it needs a standard error near 0.6 to stand three clear of noise: 36
// women's seasons and 18 men's give 0.60. The same lists, extended.
const SEEDS = [7, 99, 1234, 21, 42, 314, 555, 808, 1717, 2, 3, 5, 11, 13, 17, 19, 23, 29]
const W_SEEDS = [7, 99, 1234, 21, 42, 314, 555, 808, 1717,
  2, 3, 5, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
  71, 73, 79, 83, 89, 97, 101, 103, 107]
const wClub = LEAGUE_DEFS('w')[0].clubs[0].id
const mBids = SEEDS.map(s => seasonBids('northampton', 'm', s))
const wBids = W_SEEDS.map(s => seasonBids(wClub, 'w', s))
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length

console.log(`\n  men's bids per season   ${mBids.join(', ')}`)
console.log(`  women's bids per season ${wBids.join(', ')}\n`)

// the same rate as before, one bidless season in nine, not one in thirty-six
ok(wBids.filter(n => n > 0).length >= W_SEEDS.length - Math.floor(W_SEEDS.length / 9),
  `women's seasons receive bids - the Inbox answer has something to answer (${wBids.filter(n => n > 0).length} of ${W_SEEDS.length})`)
ok(mean(wBids) >= 3,
  `women's seasons produce a market rather than an accident (${mean(wBids).toFixed(1)} bids a season)`)
// The women's world is a smaller world - 18 clubs inside the user's reputation
// band against 53 in the men's - so it will never match bid for bid, and
// demanding that it does would be demanding a league that does not exist. A
// third of the men's traffic is the line between "quieter" and "dead".
ok(mean(wBids) >= mean(mBids) / 3,
  `and it is a fraction of the men's market, not a rounding error (${mean(wBids).toFixed(1)} v ${mean(mBids).toFixed(1)} a season)`)

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
