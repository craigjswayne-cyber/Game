// Probe: running a club costs money that has nothing to do with rugby.
//
// Owner, v1.1.12: "running the club should be challenging financial - money
// comes and goes, external to rugby - stadium repairs, weather damage, new
// pitches, failed events, successful events always find humour in this - but
// make balancing the money a bit of a challenge and it impacts the board. keep
// them positive." Plus: "board finances - it should be a sliding bar for money
// in the club/transfer money."
//
// The books used to be a pure function of the sport - gate, central money,
// sponsors, wages, upkeep - every term of it predictable, so balancing them was
// arithmetic rather than management: you knew in week 3 what week 40 held. A
// real club's year has a gale in it, and a sportsman's dinner that goes mad.
//
// Four claims, and the third is the one that keeps this a challenge rather than
// a punishment.
import { newGame } from '../src/game/newgame'
import { upkeepWeek } from '../src/game/upkeep'
import { RELEASE_STEP, belowReserve, cashReserve, releasable, releaseBlock, releaseToBudget } from '../src/game/treasury'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const k = (n: number) => `${(n / 1000).toFixed(0)}k`

/** A season of non-rugby luck at one club, as a list of season nets. */
function seasons(club: 'northampton' | 'esher', n: number): number[] {
  const out: number[] = []
  for (let t = 0; t < n; t++) {
    const g = newGame(club, 'Upkeep', 500 + t)
    const rng = mulberry32(t * 6151 + 29)
    let net = 0
    for (let w = 3; w <= 44; w++) { g.week = w; net += upkeepWeek(g, rng) }
    out.push(net)
  }
  return out.sort((a, b) => a - b)
}

console.log('--- 1. the year is uneven, and it is meant to be\n')
{
  const big = seasons('northampton', 60)
  const median = big[30]
  ok(big[0] < -500_000, `a bad year of buildings really hurts (worst ${k(big[0])})`)
  ok(big[59] > 500_000, `and a good year of events really helps (best ${k(big[59])})`)
  ok(Math.abs(median) < 900_000,
    `while the middle of it is close to a wash - this is variance, not a tax (median ${k(median)})`)
  const g = newGame('northampton', 'Upkeep', 4)
  const rng = mulberry32(11)
  let hits = 0
  for (let w = 3; w <= 44; w++) { g.week = w; if (upkeepWeek(g, rng)) hits++ }
  ok(hits >= 3 && hits <= 14, `about one every five weeks, not an accountant's inbox (${hits} in a season)`)
}

console.log('\n--- 2. and it is written down, in the club\'s own words\n')
{
  const g = newGame('northampton', 'Upkeep', 7)
  const rng = mulberry32(3)
  let moved = 0
  for (let w = 3; w <= 44 && moved === 0; w++) { g.week = w; moved = upkeepWeek(g, rng) }
  ok(moved !== 0, 'something happened to the club that was not rugby')
  const story = g.news.find(n => n.k?.startsWith('news.up'))
  ok(!!story, `and it is in the inbox, keyed${story ? ` ("${story.subject}")` : ''}`)
  ok(!!story?.v && 'amount' in (story.v as object), 'with the figure in it, so the books and the story agree')
}

console.log('\n--- 3. a club cannot be ruined by weather it could never have paid for\n')
{
  // Weeks of upkeep is the right unit for proportion and the wrong one for
  // affordability: at Esher, whose whole balance is £57k, the uncapped version
  // measured a bad year at -£619k. That is not a challenge, it is
  // administration by weather - and it is not what a real club does either.
  // The roof gets patched and the survey gets filed, which is why every
  // lower-league ground in the country has a stand held together by paint.
  const small = seasons('esher', 60)
  const g0 = newGame('esher', 'Upkeep', 1)
  const bank = g0.clubs[g0.userClubId].balance
  ok(small[0] > -3 * bank,
    `a minnow's worst year is survivable against its own bank (${k(small[0])} against ${k(bank)})`)
  ok(small[30] > -bank,
    `and its median year is not a slow death (${k(small[30])})`)
  // the cap is a SHARE of the bank, so a rich club still gets the full bill
  const rich = newGame('northampton', 'Upkeep', 2)
  rich.clubs[rich.userClubId].balance = 40_000_000
  const rng = mulberry32(5)
  let worst = 0
  for (let w = 3; w <= 44; w++) { rich.week = w; worst = Math.min(worst, upkeepWeek(rich, rng)) }
  ok(worst < -200_000, `while a club with money in the bank pays for the whole repair (${k(worst)})`)
}

console.log('\n--- 4. the treasury moves the whole balance, and says what that costs\n')
{
  // Owner, v1.1.13: "when moving money it doesnt let me transfer everything?"
  //
  // The reserve - a season of wages plus a four million float - used to stop
  // the slider dead. Measured at Northampton on day one: a £17.0m reserve
  // against a £2.4m balance, so the bar had NO TRAVEL AT ALL and the feature
  // read as broken from the first week of every career. It is a LINE now, not
  // a wall: the whole balance moves, the readout says which side of it you are
  // on, and the board charge for the far side.
  const g = newGame('northampton', 'Upkeep', 8)
  const club = g.clubs[g.userClubId]
  const reserve = cashReserve(g)
  ok(club.balance < reserve,
    `a new club opens BELOW the board's reserve (${k(club.balance)} against ${k(reserve)})`)
  ok(releasable(g) > 0 && releaseBlock(g) === null,
    `and the bar still has travel on day one - this is what read as broken (${k(releasable(g))})`)

  club.balance = reserve + 4_000_000
  const most = releasable(g)
  ok(most % RELEASE_STEP === 0, `the bar lands on round numbers (${k(most)})`)
  ok(most > club.balance - reserve,
    `and its far end is the whole balance, not the reserve (${k(most)} of ${k(club.balance)})`)
  ok(belowReserve(g, 4_000_000) === 0, 'a move that stays above the line costs nothing')
  ok(belowReserve(g, most) > 0, 'and one that empties the account is priced')

  // above the line: housekeeping, and the board do not care
  const boardBefore = club.boardConfidence
  const budget0 = club.budget
  const r = releaseToBudget(g, 4_000_000)
  ok(r.ok && club.budget === budget0 + 4_000_000, `one drag moves the lot (${k(4_000_000)} in one go)`)
  ok(club.boardConfidence === boardBefore, 'and a move within the spare cash passes without comment')

  // below it: allowed, and it costs
  const h = newGame('northampton', 'Upkeep', 9)
  const hclub = h.clubs[h.userClubId]
  hclub.balance = cashReserve(h) + 1_000_000
  hclub.boardConfidence = 70
  const deep = releaseToBudget(h, releasable(h))
  ok(deep.ok, 'the manager may empty the account if he decides to')
  ok(hclub.boardConfidence < 70,
    `and the board mind, in proportion (70 -> ${hclub.boardConfidence.toFixed(1)})`)
  ok(70 - hclub.boardConfidence <= 12,
    `but it is disquiet, not a sacking (${(70 - hclub.boardConfidence).toFixed(1)} points)`)

  // the engine clamps, not the screen: a stale control cannot overdraw
  const j = newGame('northampton', 'Upkeep', 10)
  const jclub = j.clubs[j.userClubId]
  const bank = jclub.balance
  const asked = releaseToBudget(j, 999_000_000)
  ok(asked.ok && jclub.balance >= 0 && jclub.balance <= bank,
    `asking for the moon takes only what is there (${k(bank)} -> ${k(jclub.balance)})`)
  ok(releaseBlock(j) !== null, 'and then the bar is spent, and says so')
}

console.log(fails ? `\nUPKEEP PROBE FAILED (${fails})` : '\nUPKEEP PROBE PASSED: the year is uneven, and the bar moves the lot')
process.exit(fails ? 1 : 0)
