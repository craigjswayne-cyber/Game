// Probe: the audit-16D engine fixes stay fixed.
//
// Each section is load-bearing - all of them FAIL on the code as it stood
// before the round (verified against commit 99a7366 when this shipped):
//
//   1. A sin-binned man cannot score during his own ten minutes. He used to
//      stay in the on-pitch pools and could cross while "in the bin".
//   2. The Kicking dial reaches the scoreline. units.kicking was written by
//      the dial, the exits, two roles, the coach and the wind, and read by
//      NOTHING - so flipping the dial 0 to 100 changed no result, ever.
//   3. The last quarter opens up. Try timing was dead flat (23.7% of tries
//      after the hour); tired defences now miss first, like real rugby.
//   4. Physicality buys penalties against you. Concession was a flat
//      0.115/tick whatever the dial said, which made max aggression a free
//      lunch: all the breakdown, none of the threes.
//   5. A loan-in is charged at half wage, as the signing letter has always
//      promised. weeklyFinance summed every wage at full price.
import { newGame } from '../src/game/newgame'
import { simMatch } from '../src/game/matchEngine'
import { processWeekAndAdvance } from '../src/game/season'
import { loanTargets, loanIn } from '../src/game/loans'
import { mulberry32 } from '../src/game/rng'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const freshBothSquads = (g: GameState, homeId: string, awayId: string) => {
  for (const cid of [homeId, awayId]) {
    for (const pid of g.clubs[cid].players) {
      const p = g.players[pid]
      if (p) { p.cond = 95; p.injury = null; p.bans = 0; p.rust = 0 }
    }
  }
}

// ---- 1 + 3: sin-bin honesty and the late-game arc, from the same matches ----
{
  let binViolations = 0
  let tries = 0, lateTries = 0
  for (const seed of [7, 88, 999]) {
    const g = newGame('leicester', 'Audit', seed)
    const fxs = g.fixtures.filter(f => f.compId === 'prem').slice(0, 50)
    fxs.forEach((fx, i) => {
      freshBothSquads(g, fx.homeId, fx.awayId)
      simMatch(g, fx, mulberry32(seed * 31 + i), true)
      const binned: { pid: number; from: number; teamId: string }[] = []
      for (const e of fx.events ?? []) {
        if (e.type === 'YC' && e.playerId != null) binned.push({ pid: e.playerId, from: e.min, teamId: e.teamId })
        if (e.type === 'TRY') {
          tries++
          if (e.min > 60) lateTries++
          // THE BIN IS [from, from+10), NOT (from, from+10].
          //
          // The engine sets yellowUntil = min + 10 and holds a man off while
          // `yellowUntil > min`, so he is back ON at exactly from+10 - ten
          // minutes served. This check used `<= b.from + 10` and so counted his
          // first legal minute back as a score from inside the bin.
          //
          // It needed a try at precisely from+10, by exactly the man who had been
          // binned, which is why it sat undetected until a card-rate change moved
          // the streams: 1 violation in 150 matches. The engine was right and the
          // probe was wrong, which is worth stating plainly because this one read
          // as a correctness bug in the match engine and was reported as such.
          if (e.playerId != null &&
              binned.some(b => b.pid === e.playerId && b.teamId === e.teamId && e.min > b.from && e.min < b.from + 10)) {
            binViolations++
          }
        }
      }
    })
  }
  ok(binViolations === 0, `nobody scores from inside the sin bin (${binViolations} violations in 150 matches)`)
  const lateShare = (100 * lateTries) / Math.max(1, tries)
  ok(lateShare > 26, `the last quarter opens up: ${lateShare.toFixed(1)}% of ${tries} tries came after the hour (flat play is ~23.7%, want > 26%)`)
}

// ---- 2: the kicking dial reaches the scoreline ------------------------------
{
  const results = (kicking: number) => {
    const g = newGame('northampton', 'Audit', 41)
    Object.assign(g.clubs['northampton'].tactic, { kicking })
    const fxs = g.fixtures
      .filter(f => f.compId === 'prem' && (f.homeId === 'northampton' || f.awayId === 'northampton'))
      .slice(0, 20)
    return fxs.map((fx, i) => {
      freshBothSquads(g, fx.homeId, fx.awayId)
      simMatch(g, fx, mulberry32(4100 + i), false)
      return `${fx.homeScore}-${fx.awayScore}`
    })
  }
  const low = results(0)
  const high = results(100)
  const moved = low.filter((s, i) => s !== high[i]).length
  ok(moved > 0, `the Kicking dial is not a placebo: ${moved}/20 identical-seed results move when it goes 0 to 100`)
}

// ---- 4: physicality pays in penalties conceded ------------------------------
{
  const penGoalsConcededPerGame = (aggression: number) => {
    let pens = 0, games = 0
    for (const seed of [11, 222, 3333]) {
      const g = newGame('northampton', 'Audit', seed)
      Object.assign(g.clubs['northampton'].tactic, { aggression })
      const fxs = g.fixtures
        .filter(f => f.compId === 'prem' && (f.homeId === 'northampton' || f.awayId === 'northampton'))
        .slice(0, 18)
      fxs.forEach((fx, i) => {
        freshBothSquads(g, fx.homeId, fx.awayId)
        simMatch(g, fx, mulberry32(seed * 1000 + i), true)
        games++
        for (const e of fx.events ?? []) {
          if (e.type === 'PEN' && e.teamId !== 'northampton') pens++
        }
      })
    }
    return pens / games
  }
  const calm = penGoalsConcededPerGame(0)
  const wild = penGoalsConcededPerGame(100)
  ok(wild > calm * 1.15, `max aggression concedes real penalties: ${wild.toFixed(2)}/game at dial 100 vs ${calm.toFixed(2)} at dial 0 (want > 1.15x)`)
}

// ---- 5: a loan-in is charged at half wage -----------------------------------
{
  const mk = () => {
    const g = newGame('northampton', 'Audit', 55)
    const t = loanTargets(g)[0]
    if (!t) return null
    loanIn(g, t.id)
    return { g, pid: t.id }
  }
  const a = mk()
  const b = mk()
  if (!a || !b) {
    ok(false, 'loan market offered nobody to test with')
  } else {
    // identical worlds, identical rng path - the only difference is whether
    // the ledger sees him as a loan, so the week's balances differ by
    // exactly the half wage the letter promised
    delete b.g.players[b.pid].loanFrom
    processWeekAndAdvance(a.g)
    processWeekAndAdvance(b.g)
    const saved = a.g.clubs['northampton'].balance - b.g.clubs['northampton'].balance
    const want = Math.round(a.g.players[a.pid].wage / 2)
    ok(Math.abs(saved - want) < 1, `the parent club covers half a loan wage: saved ${saved}/wk, promised ${want}/wk`)
  }
}

console.log(fails ? `\nAUDIT PROBE FAILED (${fails})` : '\nAUDIT PROBE PASSED: the 16D fixes hold')
process.exit(fails ? 1 : 0)
