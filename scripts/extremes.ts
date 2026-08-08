import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch, autoSelect, availablePlayers } from '../src/game/matchEngine'
import { SEASON_WEEKS, fmtMoney, type GameState, type Player } from '../src/game/model'
import { bad, ok, finite, checkWorld, checkerBites, failCount } from './worldcheck'

/**
 * ---- THE EXTREMES ----
 *
 * breakit.ts plays badly. This does something different: it puts the world into
 * a state no career could ever reach by playing, and then makes the game carry
 * on for two full seasons from there.
 *
 * The question is never "is this state sensible" - it is not, that is the point.
 * The question is whether the engine divides by it, formats it, sorts by it,
 * pays wages out of it or picks a team from it and comes out the other side with
 * a world that still adds up. A game is indestructible when the answer is yes
 * for every one of these:
 *
 *   no players at all                  every player sacked, nobody left to pick
 *   two hundred players                every man in the league hoarded at once
 *   bankrupt                           minus five hundred million
 *   richer than the sport              plus fifty billion
 *   every player on a pound a week     and every player on a million a week
 *   an entire squad injured            nobody available, for two seasons
 *   an entire squad banned             same, by the citing commissioner
 *   a squad of children                every player fifteen
 *   a squad of pensioners              every player thirty-nine, at the cliff
 *   the worst team possible            every attribute at one
 *   the best team possible             every attribute at twenty
 *   a ground that holds nobody         capacity one
 *   a ground that holds a nation       capacity five million
 *   no board confidence, no trust      zero on every human gauge
 *   maximum everything                 a hundred on every human gauge
 *   no staff at all                    every coaching post empty
 *
 * Each one runs in its own world from a fresh career, so a failure names exactly
 * one extreme rather than a soup of them.
 */

const SEASONS = 2
const WEEKS = SEASON_WEEKS * SEASONS

/** A fresh career at Northampton, before anything strange has been done to it. */
function fresh(seed: number): GameState {
  return newGame('northampton', 'Extreme Tester', seed)
}

const mine = (g: GameState): Player[] =>
  (g.clubs[g.userClubId]?.players ?? []).map(id => g.players[id]).filter(Boolean)

/**
 * Run one extreme.
 *
 * `setup` does the damage once, before the first week. `each` (optional) keeps
 * it done every week, because the engine heals: an injury ticks down, a ban is
 * served, a balance recovers from gate receipts. An extreme that is allowed to
 * heal after one week is not being tested for two seasons, it is being tested
 * for one, so anything that must STAY extreme goes in `each`.
 */
function extreme(
  label: string,
  seed: number,
  setup: (g: GameState) => void,
  each?: (g: GameState) => void,
  /**
   * Checked once, ten weeks in, immediately after `each` has re-applied the
   * damage - which is the only honest place to assert that the extreme IS the
   * extreme. Asserting it at the end of the run instead measures the engine
   * healing: a club stripped of every player is restocked at the rollover, an
   * injury is treated, a ban is served. Three of my own assertions failed that
   * way on the first run and none of them was an engine fault.
   */
  mid?: (g: GameState) => void,
): GameState {
  console.log(`\n--- ${label}`)
  const g = fresh(seed)
  let matches = 0
  let thrown = 0
  try {
    setup(g)
  } catch (e) {
    bad('SETUP', `${label}: setting the world up threw ${String(e).split('\n')[0].slice(0, 120)}`)
    return g
  }
  checkWorld(g, `${label} @ setup`, true)

  for (let w = 0; w < WEEKS; w++) {
    try {
      each?.(g)
      if (w === 10) mid?.(g)
      // play the user's own fixture the way the assistant would
      const fx = userFixtureThisWeek(g)
      if (fx && !g.unemployed) {
        // autoSelect is what the game does for a manager who never picks a team.
        // With nobody available it has to produce SOMETHING the sim can kick off
        // with, or refuse - either is fine, a throw is not.
        const c = g.clubs[g.userClubId]
        c.tactic.lineup = autoSelect(g, availablePlayers(g, c.players))
        simMatch(g, fx, weekRng(g), false)
        matches++
      }
      g.newsFrom = g.nextId
      processWeekAndAdvance(g)
    } catch (e) {
      thrown++
      if (thrown <= 2) {
        bad('THREW', `${label}: week ${g.week} threw ${String(e).split('\n')[0].slice(0, 140)}`)
      }
      if (thrown > 4) { console.log('  (stopping: it keeps throwing)'); break }
      // keep going: one bad week should not hide what the next twenty do
      try { g.week = Math.min(SEASON_WEEKS, g.week + 1) } catch { break }
    }
    // every fourth week is enough to catch drift without checking 7,000 players
    // eighty times, and the last week is always checked below
    if (w % 4 === 0) checkWorld(g, `${label} @ w${w}`, true)
    if (failCount() > 60) { console.log('  (stopping: too many failures to be useful)'); break }
  }

  checkWorld(g, `${label} @ end`, true)
  const club = g.clubs[g.userClubId]
  const squad = mine(g).length
  console.log(`  played ${matches} matches over ${WEEKS} weeks; squad ${squad}, balance ${fmtMoney(club?.balance ?? NaN)}, ` +
    `board ${Math.round(club?.boardConfidence ?? NaN)}, ${thrown} throw(s)`)
  ok(thrown === 0, `${label}: two seasons without an exception`)
  ok(finite(club?.balance), `${label}: the balance is still a number`)
  ok(g.season === SEASONS, `${label}: two seasons actually elapsed (season ${g.season})`)
  return g
}

// ------------------------------------------------- first: is anything looking?
//
// Sixteen green scenarios prove nothing if the checker has stopped checking.
// Before trusting a single one of them, break a clean world three ways and make
// sure it gets caught each time.
{
  console.log('--- the canaries: does the checker still bite?')
  const g = fresh(1)
  const club = g.clubs[g.userClubId]

  const realBalance = club.balance
  ok(checkerBites(g, 'NaN money', () => { club.balance = NaN }, () => { club.balance = realBalance }),
    'a balance of NaN is caught')

  ok(checkerBites(g, 'phantom player',
    () => { club.players.push(999_999) },
    () => { club.players.pop() }),
    'a roster pointing at a player who does not exist is caught')

  const firstNews = g.news[0]
  ok(!!firstNews && checkerBites(g, 'duplicate news id',
    () => { g.news.push({ ...firstNews }) },
    () => { g.news.pop() }),
    'two stories sharing an id are caught')

  const anyone = mine(g)[0]
  const realAge = anyone?.age ?? 25
  ok(!!anyone && checkerBites(g, 'impossible age',
    () => { anyone.age = -3 },
    () => { anyone.age = realAge }),
    'a player aged minus three is caught')
}

// -------------------------------------------------------- the money ladder
//
// Every figure on every screen goes through fmtMoney, so a bad rung shows up in
// a table cell, a news headline and a contract offer at once. Walk the whole
// ladder rather than spot-checking it: the two bugs found here were both at a
// boundary, where the tier was chosen before the rounding rather than after, so
// £999,600 read "£1000k" and a whisker under a billion read "£1000m".
{
  console.log('\n--- the money ladder')
  const rungs = [0, 1, 999, 1_000, 1_500, 999_499, 999_500, 999_999, 1_000_000, 1_500_000,
    9_950_000, 12_000_000, 999_499_999, 999_500_000, 999_999_999, 1_000_000_000,
    1_050_000_000, 18_015_000_000]
  let widest = ''
  for (const v of [...rungs, ...rungs.map(n => -n)]) {
    const s = fmtMoney(v)
    if (s.replace('-', '').length > widest.replace('-', '').length) widest = s
    // "£1000k" and "£1000m" are the shape of the bug: four digits where the next
    // tier up should have taken over
    if (/£\d{4,}(k|m|bn)/.test(s)) bad('MONEY-FMT', `${v} formats as "${s}", which should have moved up a tier`)
    if (/NaN|undefined|Infinity/.test(s)) bad('MONEY-FMT', `${v} formats as "${s}"`)
  }
  ok(!/£\d{4,}/.test(fmtMoney(999_999)), `just under a million reads ${fmtMoney(999_999)}`)
  ok(!/£\d{4,}/.test(fmtMoney(999_999_999)), `just under a billion reads ${fmtMoney(999_999_999)}`)
  ok(widest.length <= 8, `the widest figure on the ladder is "${widest}" (${widest.length} chars), which fits a table cell`)
  ok(fmtMoney(NaN).length > 0, 'and NaN does not crash the formatter')
}

// ---------------------------------------------------------------- the squad
// Sack the lot. Nobody to pick, nobody to pay, nobody to injure. The academy
// and the transfer market are the only ways back, and the engine has to cope
// with a club that fields nothing at all.
const empty = extreme('no players at all', 101, g => {
  const c = g.clubs[g.userClubId]
  for (const id of [...c.players]) {
    const p = g.players[id]
    if (p) { p.clubId = null; p.acad = false }
  }
  c.players = []
  c.tactic.lineup = c.tactic.lineup.map(() => null)
}, g => {
  // the club will sign and promote its way back out of the hole, which is the
  // engine being sensible - but this extreme is about staying empty, so keep it
  const c = g.clubs[g.userClubId]
  for (const id of [...c.players]) {
    const p = g.players[id]
    if (p) { p.clubId = null; p.acad = false }
  }
  c.players = []
}, g => {
  ok(mine(g).length === 0, 'no players at all: the club really is empty when the week starts')
  ok(availablePlayers(g, g.clubs[g.userClubId].players).length === 0,
    'and the game agrees there is nobody to pick')
})
// The interesting part is what the engine does about it. A club cannot field
// nothing, so it signs and promotes its way back - and that recovery has to be
// coherent, not a phantom squad of players who belong to somebody else.
const back = mine(empty)
ok(back.length > 0, `no players at all: the engine restocked the club rather than leaving it fieldless (${back.length})`)
ok(back.every(p => p.clubId === empty.userClubId),
  'and every man it found actually plays for the club now')

// Hoard. Every unattached player in the world signed at once, which is a squad
// list twenty times the size of any screen that renders it.
extreme('two hundred players', 202, g => {
  const c = g.clubs[g.userClubId]
  const spare = Object.values(g.players).filter(p => !p.clubId).slice(0, 200 - c.players.length)
  for (const p of spare) { p.clubId = c.id; c.players.push(p.id) }
  // and take a hundred more off other clubs, so the rosters have to stay honest
  for (const other of Object.values(g.clubs)) {
    if (other.id === c.id) continue
    while (other.players.length > 20 && c.players.length < 300) {
      const id = other.players.pop()!
      const p = g.players[id]
      if (!p) continue
      p.clubId = c.id
      c.players.push(id)
    }
    if (c.players.length >= 300) break
  }
})

// ---------------------------------------------------------------- the money
extreme('bankrupt by five hundred million', 303, g => {
  g.clubs[g.userClubId].balance = -500_000_000
}, g => {
  // gate receipts and central funding would climb out of it in a season
  g.clubs[g.userClubId].balance = Math.min(g.clubs[g.userClubId].balance, -500_000_000)
})

extreme('richer than the sport', 404, g => {
  g.clubs[g.userClubId].balance = 50_000_000_000
})

extreme('every player on a pound a week', 505, g => {
  for (const p of mine(g)) p.wage = 1
}, g => { for (const p of mine(g)) p.wage = 1 })

extreme('every player on a million a week', 606, g => {
  for (const p of mine(g)) p.wage = 1_000_000
}, g => { for (const p of mine(g)) p.wage = 1_000_000 })

// ------------------------------------------------------------ unavailability
extreme('an entire squad injured', 707, g => {
  for (const p of mine(g)) { p.injury = { desc: 'ruled out for the test', until: 9999, weeks: 99 }; p.cond = 0 }
}, g => {
  for (const p of mine(g)) { p.injury = { desc: 'ruled out for the test', until: 9999, weeks: 99 }; p.cond = 0 }
}, g => {
  ok(availablePlayers(g, g.clubs[g.userClubId].players).length === 0,
    'an entire squad injured: the game agrees nobody is available')
})

extreme('an entire squad banned', 808, g => {
  for (const p of mine(g)) p.bans = 20
}, g => { for (const p of mine(g)) p.bans = Math.max(p.bans, 20) })

// ------------------------------------------------------------------- the men
extreme('a squad of children', 909, g => {
  for (const p of mine(g)) { p.age = 15; p.ca = 20; p.pa = 95 }
})

// The retirement cliff, all at once: thirty-nine year olds do not get another
// contract, so this is a whole squad walking out at the same rollover.
extreme('a squad of pensioners at the cliff', 1010, g => {
  for (const p of mine(g)) { p.age = 39; p.contractEnds = g.season }
})

extreme('the worst team possible', 1111, g => {
  for (const p of mine(g)) {
    p.ca = 1; p.pa = 1; p.form = 0; p.morale = 0
    for (const k of Object.keys(p.a) as (keyof typeof p.a)[]) p.a[k] = 1
  }
}, g => {
  for (const p of mine(g)) {
    p.ca = 1
    for (const k of Object.keys(p.a) as (keyof typeof p.a)[]) p.a[k] = 1
  }
})

extreme('the best team possible', 1212, g => {
  for (const p of mine(g)) {
    p.ca = 100; p.pa = 100; p.form = 10; p.morale = 10
    for (const k of Object.keys(p.a) as (keyof typeof p.a)[]) p.a[k] = 20
  }
}, g => {
  for (const p of mine(g)) {
    p.ca = 100
    for (const k of Object.keys(p.a) as (keyof typeof p.a)[]) p.a[k] = 20
  }
})

// ---------------------------------------------------------------- the ground
extreme('a ground that holds nobody', 1313, g => {
  g.clubs[g.userClubId].capacity = 1
}, g => { g.clubs[g.userClubId].capacity = 1 })

extreme('a ground that holds a nation', 1414, g => {
  g.clubs[g.userClubId].capacity = 5_000_000
}, g => { g.clubs[g.userClubId].capacity = 5_000_000 })

// --------------------------------------------------------- the human gauges
extreme('nothing left in the tank', 1515, g => {
  const c = g.clubs[g.userClubId]
  c.boardConfidence = 0
  g.fanMood = 0
  for (const p of mine(g)) { p.morale = 0; p.form = 0 }
}, g => {
  g.clubs[g.userClubId].boardConfidence = 0
  g.fanMood = 0
  for (const p of mine(g)) p.morale = 0
})

extreme('maximum everything', 1616, g => {
  const c = g.clubs[g.userClubId]
  c.boardConfidence = 100
  g.fanMood = 100
  for (const p of mine(g)) { p.morale = 10; p.form = 10 }
}, g => {
  g.clubs[g.userClubId].boardConfidence = 100
  g.fanMood = 100
  for (const p of mine(g)) { p.morale = 10; p.form = 10 }
})

extreme('no staff at all', 1717, g => {
  for (const k of Object.keys(g.staff) as (keyof typeof g.staff)[]) {
    if (typeof g.staff[k] === 'number') (g.staff[k] as number) = 0
  }
}, g => {
  for (const k of Object.keys(g.staff) as (keyof typeof g.staff)[]) {
    if (typeof g.staff[k] === 'number') (g.staff[k] as number) = 0
  }
})

// ------------------------------------------------------------------ verdict
console.log(failCount()
  ? `\nEXTREMES FOUND ${failCount()} PROBLEM(S)`
  : '\nEXTREMES PASSED: sixteen impossible worlds, two seasons each, all still standing')
if (failCount()) process.exit(1)
