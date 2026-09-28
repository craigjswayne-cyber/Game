// The without-ball system (18D) has to be a TRADE, not a free upgrade, and it
// has to be invisible until touched.
//
// Four properties the design rests on:
//
//   ABSENT IS FREE. A save from before the dials existed, or a dial parked at
//   50, must play the old game bit for bit. Every term is priced so f(50) = 0
//   and the width layer only fires when the multiplier is not exactly 1.0 -
//   otherwise ten thousand existing saves change under the player's feet and
//   the sim fingerprint breaks.
//
//   LINE SPEED IS PRICED IN THE ENGINE'S OWN CURRENCIES. A blitz buys defence
//   and pays in penalties and cards; a drift does the reverse. Both directions,
//   exact multipliers, or the dial is either a cheat or a trap.
//
//   WIDTH IS ROCK-PAPER-SCISSORS. A spread line beats a wide attack and loses
//   to a tight one, in equal measure. If the wrong call did not pay the other
//   way, "always spread" would be the only setting anyone ever used.
//
//   THE BLITZ IS NOT A META. Over a pile of full matches, defLine 100 must not
//   move the mean margin outside noise - pressure gained, penalties conceded,
//   roughly a wash. If it were an upgrade, every save would end up at 100.
import { newGame } from '../src/game/newgame'
import { weekRng } from '../src/game/season'
import { beginMatch, simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const userFixture = (g: GameState) =>
  g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))!

const mySide = (g: GameState, ctx: ReturnType<typeof beginMatch>) =>
  ctx.home.teamId === g.userClubId ? ctx.home : ctx.away

// ---- absent and 50 are the same game, bit for bit --------------------------
// Since 20C the AI philosophies SET these dials, so "the untouched world" has
// to be manufactured: world A has the dials deleted outright, world B holds
// them at 50. The engine must not be able to tell the two apart.
for (const seed of [7, 31]) {
  const a = newGame('northampton', 'Split', seed)
  const b = newGame('northampton', 'Split', seed)
  for (const c of Object.values(a.clubs)) { delete c.tactic.defLine; delete c.tactic.defWidth }
  for (const c of Object.values(b.clubs)) { c.tactic.defLine = 50; c.tactic.defWidth = 50 }
  const fa = userFixture(a), fb = userFixture(b)
  const ra = simMatch(a, fa, weekRng(a), false)
  const rb = simMatch(b, fb, weekRng(b), false)
  ok(fa.homeScore === fb.homeScore && fa.awayScore === fb.awayScore && ra.events.length === rb.events.length,
    `seed ${seed}: absent dials and dials at 50 are the same game (${fa.homeScore}-${fa.awayScore})`)
}

// ---- and the dugouts now defend with an identity (20C) ----------------------
{
  const g = newGame('northampton', 'Split', 7)
  const ai = Object.values(g.clubs).filter(c => c.id !== g.userClubId && c.philosophy)
  const withDials = ai.filter(c => c.tactic.defLine != null && c.tactic.defWidth != null)
  ok(withDials.length === ai.length, `every AI philosophy carries the without-ball dials (${withDials.length}/${ai.length})`)
  const spread = new Set(ai.map(c => c.tactic.defLine)).size
  ok(spread >= 4, `and they differ from dugout to dugout (${spread} distinct line speeds)`)
  ok((g.clubs[g.userClubId].tactic.defLine ?? 50) === 50, 'while your own dials stay yours')
}

// and a dial-less save produces finite numbers everywhere it is read
{
  const g = newGame('northampton', 'Split', 11)
  const ctx = beginMatch(g, userFixture(g), weekRng(g), false)
  const s = mySide(g, ctx)
  ok(Number.isFinite(s.units.defence) && Number.isFinite(s.penRisk) && Number.isFinite(s.cardRisk),
    'a save written before the dials existed reads as the middle of both')
}

// ---- line speed: exact prices, both directions ------------------------------
const atLine = (v: number | undefined) => {
  const g = newGame('northampton', 'Split', 19)
  if (v != null) g.clubs[g.userClubId].tactic.defLine = v
  const ctx = beginMatch(g, userFixture(g), weekRng(g), false)
  const s = mySide(g, ctx)
  return { def: s.units.defence, pen: s.penRisk, card: s.cardRisk }
}
const mid = atLine(undefined), blitz = atLine(100), drift = atLine(0)
console.log(`  blitz: defence x${(blitz.def / mid.def).toFixed(3)}, penalties x${(blitz.pen / mid.pen).toFixed(3)}, cards +${(blitz.card - mid.card).toFixed(4)}`)
console.log(`  drift: defence x${(drift.def / mid.def).toFixed(3)}, penalties x${(drift.pen / mid.pen).toFixed(3)}, cards ${(drift.card - mid.card).toFixed(4)}`)
ok(Math.abs(blitz.def / mid.def - 1.04) < 0.001, 'a full blitz buys exactly 4% of defence')
ok(Math.abs(blitz.pen / mid.pen - 1.12) < 0.001, 'and pays 12% more kickable penalties for it')
ok(Math.abs(blitz.card - mid.card - 0.002) < 0.0005, 'plus a real bump in card risk')
ok(Math.abs(drift.def / mid.def - 0.96) < 0.001, 'a passive drift concedes 4% of defence')
ok(Math.abs(drift.pen / mid.pen - 0.88) < 0.001, 'and buys 12% cleaner discipline back')

// ---- width: the matchup pays both ways --------------------------------------
const atWidth = (myWidth: number, oppStyle: number) => {
  const g = newGame('northampton', 'Split', 23)
  const fx = userFixture(g)
  const oppId = fx.homeId === g.userClubId ? fx.awayId : fx.homeId
  g.clubs[g.userClubId].tactic.defWidth = myWidth
  g.clubs[oppId].tactic.style = oppStyle
  const ctx = beginMatch(g, fx, weekRng(g), false)
  return mySide(g, ctx).units.defence
}
const spreadVsWide = atWidth(100, 100) / atWidth(50, 100)
const narrowVsWide = atWidth(0, 100) / atWidth(50, 100)
const spreadVsTight = atWidth(100, 0) / atWidth(50, 0)
const narrowVsTight = atWidth(0, 0) / atWidth(50, 0)
console.log(`  vs a wide attack: spread x${spreadVsWide.toFixed(3)}, narrow x${narrowVsWide.toFixed(3)}`)
console.log(`  vs a tight attack: spread x${spreadVsTight.toFixed(3)}, narrow x${narrowVsTight.toFixed(3)}`)
ok(Math.abs(spreadVsWide - 1.05) < 0.001, 'a spread line smothers an expansive attack (+5%)')
ok(Math.abs(narrowVsWide - 0.95) < 0.001, 'a narrow line leaves the touchlines open to it (-5%)')
ok(Math.abs(spreadVsTight - 0.95) < 0.001, 'but the same spread line is run through by a tight side (-5%)')
ok(Math.abs(narrowVsTight - 1.05) < 0.001, 'where a narrow line stuffs the pick-and-go (+5%)')

// ---- the blitz is a trade, not a meta ---------------------------------------
// Same fixture, same seeds, one world with the user's line at 100. Pressure
// gained should be paid back in penalties: the mean margin must not move
// outside noise. Measured at commit time over three independent 150-seed
// blocks: drift +0.96, -0.59, +0.53 points - the sign alternates, which is
// what noise looks like. A real lean drifts the same way in every block.
//
// PAIRED, AND 800 OF THEM, NOT 150 WORLDS A SIDE (28 Sep 2026). The old
// blocks were one match per world, each arm in its own copy, so a match's
// margin (sd about 23 points) was the whole error: the drift's standard error
// was about 1.9 points against a band of 2.5, and four shifted seed lists
// read +0.47, +1.09, +3.06 (FAIL) and -1.83 with nothing changed. Now each of
// 40 worlds plays its opening fixture 20 times, both arms from an identical
// kick-off on the same stream. Paired, the drift's standard error is 0.47
// points, so the unchanged band of 2.5 sits over five of them; the probe
// prints its own se every run. 28 s, against 73 s for the old 300 worlds.
const WORLDS = 40, K = 20
const diffs: number[] = []
let sumBase = 0, sumAggro = 0, replayed = 0, replays = 0
for (let i = 0; i < WORLDS; i++) {
  const g = newGame('northampton', 'Arena', 100 + i)
  const fx0 = userFixture(g)
  // the two clubs, their men and the chemistry ledger are all a match reads
  // or writes that the next match could feel (found by diffing the state
  // around a sim); restoring them (rather than cloning a 5 MB world
  // per sim, 150 ms a time) puts every sim back on the same kick-off
  const clubIds = [fx0.homeId, fx0.awayId]
  const pids = clubIds.flatMap(c => g.clubs[c].players)
  const snapC = structuredClone(clubIds.map(c => g.clubs[c]))
  const snapP = structuredClone(pids.map(id => g.players[id]))
  const snapChem = structuredClone(g.chem)
  const play = (line: number | undefined, seed: number) => {
    clubIds.forEach((c, j) => { g.clubs[c] = structuredClone(snapC[j]) })
    pids.forEach((id, j) => { g.players[id] = structuredClone(snapP[j]) })
    g.chem = structuredClone(snapChem)     // a match builds chemistry, and reads it
    if (line != null) g.clubs[g.userClubId].tactic.defLine = line
    const fx = { ...fx0, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 }
    simMatch(g, fx, mulberry32(seed), false)
    return fx.homeId === g.userClubId ? fx.homeScore - fx.awayScore : fx.awayScore - fx.homeScore
  }
  for (let k = 0; k < K; k++) {
    const seed = (i * 7919 + k * 104729 + 17) >>> 0
    const m = [play(undefined, seed), play(100, seed)]
    sumBase += m[0]; sumAggro += m[1]; diffs.push(m[1] - m[0])
    // the pairing is only as good as the restore: the same stream from the
    // same kick-off has to replay the same match
    if (k === 0) { replays++; if (play(undefined, seed) === m[0]) replayed++ }
  }
}
ok(replayed === replays, `a restored kick-off replays the same match on the same stream (${replayed}/${replays})`)
const n = diffs.length
const blitzDrift = diffs.reduce((a, b) => a + b, 0) / n
const se = Math.sqrt(diffs.reduce((a, b) => a + (b - blitzDrift) ** 2, 0) / (n - 1) / n)
console.log(`  mean margin over ${n} paired matches: dial untouched ${(sumBase / n).toFixed(2)}, full blitz ${(sumAggro / n).toFixed(2)} (drift se ${se.toFixed(2)})`)
ok(Math.abs(blitzDrift) < 2.5, `the blitz is not a free upgrade (drift ${blitzDrift.toFixed(2)} pts, band 2.5, ${(2.5 / se).toFixed(1)} se)`)

console.log(fails ? `\nSPLIT PROBE FAILED (${fails})` : '\nSPLIT PROBE PASSED: the without-ball dials are a priced trade')
process.exit(fails ? 1 : 0)
