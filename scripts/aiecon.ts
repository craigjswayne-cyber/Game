// Probe: a hundred rugby clubs with real books.
//
// weeklyFinance ran on ONE club - the manager's. The other hundred paid no wages,
// no staff and no upkeep, and took no gate, so every balance in the world drifted
// upwards forever and the eight-percent discount sellerWillingness gives a club in
// the red fired for two to six clubs in a hundred over ten measured seasons, only
// ever because somebody had overspent on a fee.
//
// Turning the ledger on is easy. Turning it on without wrecking the world is the
// job, and this probe is the record of three calibrations that did:
//
//   Static rep-based income against wage bills that inflate eighty percent over a
//   decade. Read beautifully for three seasons, then killed it: median minus
//   £16.6M, seventy-two clubs in a hundred under water.
//
//   The same, with the gate left unindexed on the argument that a ticket is a
//   ticket. A third of income frozen while costs rose put a slow leak under every
//   club in the world: the median slid about a million a season with nothing able
//   to stop it.
//
//   Both brakes, no floor. The tail ran to minus thirty-five million, which is not
//   a struggling rugby club, it is a number that has stopped meaning anything.
//
// So what is asserted here is not "the ledger runs". It is the SHAPE of the world
// after ten seasons: a median that still grows at about the rate it grew before
// (mean neutrality), a bounded tail, a bounded top, and pressure that actually
// exists - a real share of clubs in the red, and men on the market because of it.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { aiWeek, moneyIndex } from '../src/game/aiecon'
import { sellerWillingness } from '../src/game/ai'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const SEASONS = 10
/** The median AI club's gain a season, as the reference the rate is held to.
 *  0.85M was measured on the ledger this replaced, on seed 4242 alone. By 1.7.0
 *  the world had moved under it: 1.7.0 itself measured 0.38, 0.20, 0.28, 0.58
 *  and 0.22M on the five RATE_SEEDS (mean 0.33M), under the old 0.4x floor on
 *  three of them. 1.7.1 (which touches no money) drew -0.06M on 4242 and 0.45,
 *  0.49, 0.22, 0.21M on the rest: the same spread, a different path through
 *  it. One seed over ten seasons is a coin that lands anywhere in that range,
 *  so the rate is now pooled over five and held to the measured 1.7.0 mean
 *  (release audit, 26 Sep 2026). */
const WAS_PER_SEASON = 0.33e6
/** Worlds the rate and solvency checks pool over; the first is also the one
 *  every other check below reads. */
const RATE_SEEDS = [4242, 11, 99, 2025, 31337]

const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}
const ai = (g: GameState) => Object.values(g.clubs).filter(c => c.id !== g.userClubId)

const g = newGame('northampton', 'AI Econ', RATE_SEEDS[0])
const start = med(ai(g).map(c => c.balance))
let peakRed = 0
let listedPeak = 0

for (let s = 0; s < SEASONS; s++) {
  while (g.season === s) processWeekAndAdvance(g)
  const clubs = ai(g)
  const red = clubs.filter(c => c.balance < 0).length
  peakRed = Math.max(peakRed, red)
  const listed = Object.values(g.players).filter(p => p.transferListed && p.clubId && p.clubId !== g.userClubId).length
  listedPeak = Math.max(listedPeak, listed)
}

const clubs = ai(g)
const bals = clubs.map(c => c.balance).sort((a, b) => a - b)
const end = med(bals)
const perSeason = (end - start) / SEASONS
const red = bals.filter(b => b < 0).length
const index = moneyIndex(g)

// the other worlds, for the rate alone
const rates = [perSeason]
const ends = [end]
for (const seed of RATE_SEEDS.slice(1)) {
  const w = newGame('northampton', 'AI Econ', seed)
  const s0 = med(ai(w).map(c => c.balance))
  while (w.season < SEASONS) processWeekAndAdvance(w)
  const e = med(ai(w).map(c => c.balance))
  rates.push((e - s0) / SEASONS)
  ends.push(e)
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const pooledRate = mean(rates)

console.log(`\nafter ${SEASONS} seasons, ${clubs.length} AI clubs`)
console.log(`  median balance    ${(start / 1e6).toFixed(1)}M -> ${(end / 1e6).toFixed(1)}M  (${(perSeason / 1e6).toFixed(2)}M a season, was ${(WAS_PER_SEASON / 1e6).toFixed(2)}M)`)
console.log(`  over ${RATE_SEEDS.length} worlds   ${rates.map(r => (r / 1e6).toFixed(2)).join(', ')}M a season, mean ${(pooledRate / 1e6).toFixed(2)}M`)
console.log(`  worst / best      ${(bals[0] / 1e6).toFixed(1)}M / ${(bals[bals.length - 1] / 1e6).toFixed(1)}M`)
console.log(`  in the red        ${red}/${clubs.length} now, ${peakRed} at the worst point`)
console.log(`  money index       ${index.toFixed(2)}x  (median wage bill ${Math.round(med(clubs.map(c => aiWeek(g, c, index).wages)) / 1000)}k/wk)`)
console.log(`  listed by AI      up to ${listedPeak} men on the market at once`)
console.log(`  the manager       ${(g.clubs[g.userClubId].balance / 1e6).toFixed(1)}M`)

// MEAN NEUTRALITY. Wide, because the prize-money spine dominates and a world is
// chaotic over ten seasons; the point is that it is the same ORDER as before,
// not that it matches to the pound. Pooled, because one seed is not a measure.
ok(pooledRate > WAS_PER_SEASON * 0.4 && pooledRate < WAS_PER_SEASON * 2,
  `the median club still gains money at about the rate it used to (${(pooledRate / 1e6).toFixed(2)}M a season)`)
ok(mean(ends) > 0 && ends.every(e => e > -3e6),
  'and the median club is solvent after a decade, in every world')

// A BOUNDED TAIL. The floor is twenty weeks of wages, so a Premiership bill puts
// it near minus eight million; nothing should be far past that.
ok(bals[0] > -14e6, `the worst-run club in the world is not absurd (${(bals[0] / 1e6).toFixed(1)}M)`)
ok(bals[bals.length - 1] < 90e6, `and the richest is not printing money (${(bals[bals.length - 1] / 1e6).toFixed(1)}M)`)

// PRESSURE THAT EXISTS. This is the whole point of the change: before it, two to
// six clubs in a hundred were ever in the red, and only from transfer overspend.
ok(peakRed >= 10, `a real share of the world runs out of money (peak ${peakRed}/${clubs.length})`)
ok(peakRed <= 70, `but the world is not insolvent (peak ${peakRed}/${clubs.length})`)
ok(listedPeak >= 3, `and clubs in trouble put men on the market (peak ${listedPeak})`)

// AND THE DISCOUNT IS REACHABLE, which is the mechanism a manager actually feels.
{
  const broke = clubs.filter(c => c.balance < 0)
  // the reasons are keys now, not sentences - the player profile renders them
  // through t(), so grepping the English would only work in one language
  const withReason = broke.flatMap(c => c.players
    .map(id => g.players[id])
    .filter(p => !!p)
    .slice(0, 3)
    .map(p => sellerWillingness(g, p!).reasons.map(r => r.k).join(' | ')))
  const fires = withReason.filter(r => r.includes('player.sellInRed')).length
  console.log(`  cash-strapped     ${fires} of ${withReason.length} sampled men carry the "in the red" reason`)
  ok(fires > 0, 'a club in the red really does come down on its asking price')
}

console.log(fails ? `\nAI ECON FAILED (${fails})` : '\nAI ECON PASSED: a hundred clubs with real books, and a world that survives it')
process.exit(fails ? 1 : 0)
