// Probe: Round 25D-1 - the valuation engine and the development magic.
//
// User: "at the moment the value of a player is too linked to age rather than
// talent", plus the FM blueprint he pasted: late bloomers ("the random kinda
// who become high value and legends") and minutes-gated growth ("a 20-year-old
// sitting on your bench will stop developing"). This pins four properties:
//
//   THE WORLD'S MONEY IS WHERE IT WAS. The new position/form/contract factors
//   are a redistribution, not a revaluation: fresh-world mean value must sit
//   within a few percent of the old universal-cliff formula, or every budget,
//   fee and board expectation drifts together.
//
//   TALENT BEATS THE CALENDAR. A world-class 30-year-old fly-half now
//   outprices a middling 23-year-old, which is the exact complaint.
//
//   THE LATE BLOOMER IS RARE, HIDDEN AND REAL. About 8.5% of players, a pure
//   function of (seed, id), and at 28 a bloomer still grows where his
//   ordinary twin has plateaued.
//
//   MINUTES MATTER, AND THE MEAN STAYS PUT. Ten starts feed a young pro's
//   growth, a season on the bench starves it, and the measured -0.012 middle
//   band keeps the u24 average where it was.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { isLateBloomer, playerValue } from '../src/game/attributes'
import { devFactor } from '../src/game/rollover'
import { SEASON_WEEKS } from '../src/game/model'
import type { Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length

// the formula this round replaced, kept here as the yardstick
function oldValue(ca: number, age: number, pa: number): number {
  const base = Math.pow(ca / 100, 3.1) * 9_000_000
  let ageF = 1
  if (age <= 21) ageF = 1.25 + (pa - ca) / 120
  else if (age <= 24) ageF = 1.3
  else if (age <= 27) ageF = 1.15
  else if (age <= 29) ageF = 0.95
  else if (age <= 31) ageF = 0.65
  else if (age <= 33) ageF = 0.35
  else ageF = 0.15
  return Math.max(10_000, Math.round((base * ageF) / 10_000) * 10_000)
}

// ---- the world's money is where it was --------------------------------------
for (const seed of [9, 777]) {
  const g = newGame('northampton', 'Val', seed)
  const ps = Object.values(g.players) as Player[]
  const oldM = mean(ps.map(p => oldValue(p.ca, p.age, p.pa)))
  const createM = mean(ps.map(p => playerValue(p.ca, p.age, p.pa, p.pos)))
  const fullM = mean(ps.map(p => playerValue(p.ca, p.age, p.pa, p.pos, p.form, p.contractEnds - g.season)))
  const dc = createM / oldM - 1
  const df = fullM / oldM - 1
  ok(Math.abs(dc) < 0.025, `seed ${seed}: creation-shape mean within 2.5% of the old formula (${(dc * 100).toFixed(1)}%)`)
  ok(Math.abs(df) < 0.015, `seed ${seed}: full-shape mean within 1.5% of the old formula (${(df * 100).toFixed(1)}%)`)
}

// ---- talent beats the calendar ----------------------------------------------
{
  ok(playerValue(85, 30, 85, 'FH') > playerValue(65, 23, 70, 'CE'),
    'a world-class 30-year-old fly-half outprices a middling 23-year-old centre')
  ok(playerValue(80, 30, 80, 'FH') > playerValue(80, 30, 80, 'WG'),
    'the market trusts a 30-year-old 10 longer than a 30-year-old wing')
  ok(playerValue(80, 30, 80, 'TP') > playerValue(80, 30, 80, 'CE'),
    'a 30-year-old tighthead holds value past a 30-year-old centre')
  ok(playerValue(80, 20, 92, 'CE') > playerValue(80, 20, 82, 'CE'),
    'promise still carries a premium at 20')
}

// ---- the season moves the price ---------------------------------------------
{
  const v = (form?: number, yrs?: number) => playerValue(75, 26, 80, 'CE', form, yrs)
  ok(v(9) > v(6) && v(6) > v(3), `form momentum: a man on 9s (${v(9)}) beats par (${v(6)}) beats a slump (${v(3)})`)
  ok(v(undefined, 3) > v(undefined, 1) && v(undefined, 1) > v(undefined, 0),
    `contract factor: 3 years (${v(undefined, 3)}) beats 1 (${v(undefined, 1)}) beats expiring (${v(undefined, 0)})`)
  ok(v() === playerValue(75, 26, 80, 'CE'), 'omitted factors are exactly neutral')
}

// ---- the late bloomer: rare, hidden, deterministic --------------------------
{
  const g = newGame('northampton', 'Bloom', 9)
  const ids = Object.values(g.players).map(p => p.id)
  const inc = ids.filter(id => isLateBloomer(g.seed, id)).length / ids.length
  ok(inc > 0.06 && inc < 0.11, `incidence sits on the dial: ${(inc * 100).toFixed(1)}% of ${ids.length} players (target 8.5%)`)
  ok(isLateBloomer(g.seed, ids[0]) === isLateBloomer(g.seed, ids[0]),
    'a pure function of (seed, id): the same player always gets the same answer')
  const other = ids.filter(id => isLateBloomer(g.seed + 1, id) !== isLateBloomer(g.seed, id)).length
  ok(other > 0, 'a different world deals a different hand')
}

// ---- minutes matter (direction), then a real season (mean + bloomers) -------
{
  const g = newGame('northampton', 'Mins', 9)
  const base = Object.values(g.players).find(p => !p.acad && p.age <= 23 && p.clubId && p.clubId !== g.userClubId)!
  const at = (ls?: number) => devFactor(g, { ...base, lastStarts: ls } as Player)
  ok(at(12) > at(5) && at(5) > at(1), `starts feed growth: 12 starts ${at(12).toFixed(3)} > 5 starts ${at(5).toFixed(3)} > benched ${at(1).toFixed(3)}`)
  ok(at(undefined) === devFactor(g, base), 'a fresh world (no stashed starts) is untouched')

  // play the season out headless and let the rollover write the ledger
  let guard = 0
  while (g.week < SEASON_WEEKS && guard++ < SEASON_WEEKS + 5) processWeekAndAdvance(g)

  // THE FORKED SUMMER: a fresh world gives no headroom past 26 (paBoost is 0
  // from 27 up), so a 28-year-old with room to grow only exists organically
  // years into a save. Manufacture him instead: clone the save, hand every
  // 28-year-old ten points of headroom, and run the same rollover - growth
  // must land on the bloomers and nobody else (for a 28-year-old the summer
  // roll is the ONLY ca writer; weekly bumps stop at 26)
  {
    const fork = structuredClone(g)
    const marks: { id: number; ca0: number; bloom: boolean }[] = []
    for (const p of Object.values(fork.players)) {
      if (p.age !== 28 || p.onLoan || p.acad || p.farewell || p.retiring || p.ca >= 88) continue
      p.pa = Math.min(99, p.ca + 10)
      marks.push({ id: p.id, ca0: p.ca, bloom: isLateBloomer(fork.seed, p.id) })
    }
    processWeekAndAdvance(fork)
    const bloomers = marks.filter(x => x.bloom)
    const plain = marks.filter(x => !x.bloom)
    const bloomGrew = bloomers.filter(x => (fork.players[x.id]?.ca ?? x.ca0) > x.ca0).length
    const plainGrew = plain.filter(x => (fork.players[x.id]?.ca ?? x.ca0) > x.ca0).length
    ok(bloomers.length >= 5, `the cohort is real: ${bloomers.length} bloomers among ${marks.length} 28-year-olds`)
    ok(bloomGrew >= Math.ceil(bloomers.length * 0.7), `the bloomers refuse to plateau: ${bloomGrew}/${bloomers.length} grew at 28`)
    ok(plainGrew === 0, `everyone else has stopped: ${plainGrew}/${plain.length} ordinary 28-year-olds grew`)
  }

  const season0 = g.season
  processWeekAndAdvance(g)
  ok(g.season === season0 + 1, `the season rolled over (week ${g.week}, season ${g.season})`)

  // the mean stays put: the minutes term averaged over the exact gate
  // population must sit on zero (the -0.012 middle band is that correction)
  const pop = Object.values(g.players).filter(p => !p.acad && p.age <= 23 && p.lastStarts != null)
  const term = (ls: number) => ls >= 10 ? 0.10 : ls <= 2 ? -0.10 : -0.012
  const m = mean(pop.map(p => term(p.lastStarts!)))
  ok(pop.length > 300, `the gate population is real: ${pop.length} young pros carried starts through the summer`)
  ok(Math.abs(m) < 0.01, `the minutes term is mean-neutral over them (${m.toFixed(4)})`)
}

console.log(fails ? `\n${fails} FAILURES` : '\nROUND 25D PROBE PASSED')
process.exit(fails ? 1 : 0)
