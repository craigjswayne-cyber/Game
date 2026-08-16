/**
 * ---- DOES EVERY DIAL EARN ITS PLACE? (release audit, Pass 2, qualitative half)
 *
 * disttest already proves the match engine produces plausible rugby: points,
 * tries, home advantage, draws, all inside their bands. What nothing measures is
 * whether the SIX TACTICAL DIALS are six decisions or two decisions and four
 * pieces of furniture.
 *
 * That is the balance hole a manager game dies of quietly. If style and
 * aggression decide everything and tempo, kicking, defLine and defWidth move the
 * result by less than noise, then four of the screens the player is invited to
 * study are decoration, and no unit test will ever say so - each dial is wired up
 * exactly as written, and each one has a probe proving it is wired up.
 *
 * So: for each dial, play the same club, the same seed and the same fixtures with
 * that dial pinned to 10 and again pinned to 90, everything else held at 50, and
 * measure the swing in league points. Then compare the swings.
 *
 * TWO THINGS THIS HAS TO GET RIGHT, both learned the hard way elsewhere in this
 * suite:
 *
 *   THE SHEET MUST BE THE MANAGER'S. `lineupFor` treats a sheet the GAME chose
 *   as re-pickable, so difficultyprobe's first version measured three managers
 *   who were all secretly the same auto-picker. Setting `userPicked` is what the
 *   Selection screen does the moment a human touches it, and without it a dial
 *   experiment is an experiment on a lineup that keeps changing underneath it.
 *
 *   A DIAL IS NOT A GOOD DIAL BECAUSE IT IS A BIG DIAL. The bar here is not
 *   "every dial matters equally" - a matchup dial like defWidth SHOULD do nothing
 *   against an average field, because its whole job is to pay off against one
 *   kind of opponent and cost against another. So the assertion is deliberately
 *   modest: no dial may be flat to three decimal places, and the loudest dial may
 *   not drown the quietest by more than a stated ratio. That catches a dial that
 *   is not plumbed in, and a dial that has become the only decision, and it does
 *   not pretend to be a balance target it has not earned.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { autoSelect } from '../src/game/matchEngine'
import { SEASON_WEEKS } from '../src/game/model'
import { sortTable } from '../src/game/schedule'
import type { GameState, Player, Tactic } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const SEEDS = [4, 88, 1201, 77]
type Dial = 'style' | 'tempo' | 'kicking' | 'aggression' | 'defLine' | 'defWidth'
const DIALS: Dial[] = ['style', 'tempo', 'kicking', 'aggression', 'defLine', 'defWidth']

/** One season at Northampton with every dial at 50 except `dial`, pinned. */
function season(seed: number, dial: Dial | null, value: number) {
  const g: GameState = newGame('northampton', 'Dials', seed)
  const setDials = () => {
    const t = g.clubs[g.userClubId].tactic as Tactic
    t.style = 50; t.tempo = 50; t.kicking = 50; t.aggression = 50
    t.defLine = 50; t.defWidth = 50
    if (dial) (t as unknown as Record<string, number>)[dial] = value
    // the sheet has to be the manager's or the auto-picker quietly retakes it
    const club = g.clubs[g.userClubId]
    const pool = club.players.map(id => g.players[id])
      .filter((p): p is Player => !!p && !p.injury && p.bans === 0 && !p.onLoan && !p.natSquad)
    if (pool.length >= 23) {
      t.lineup = autoSelect(g, pool, t.split)
      t.userPicked = true
    }
  }
  let guard = 0
  while (g.week < SEASON_WEEKS && guard++ < SEASON_WEEKS + 5) {
    setDials()
    processWeekAndAdvance(g)
  }
  const row = sortTable(g.comps['prem'].table).find(r => r.teamId === g.userClubId)
  const t = g.comps['prem'].table.find(r => r.teamId === g.userClubId)
  return { pts: row?.pts ?? 0, for: t?.pf ?? 0, against: t?.pa ?? 0 }
}

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length

console.log(`  measuring ${DIALS.length} dials over ${SEEDS.length} seeds, low(10) v high(90), all others held at 50\n`)
const swing: Record<string, { pts: number; diff: number; lo: number; hi: number }> = {}
for (const dial of DIALS) {
  const lo = SEEDS.map(s => season(s, dial, 10))
  const hi = SEEDS.map(s => season(s, dial, 90))
  const dPts = mean(hi.map(r => r.pts)) - mean(lo.map(r => r.pts))
  const dDiff = mean(hi.map(r => r.for - r.against)) - mean(lo.map(r => r.for - r.against))
  swing[dial] = { pts: dPts, diff: dDiff, lo: mean(lo.map(r => r.pts)), hi: mean(hi.map(r => r.pts)) }
  console.log(`  ${dial.padEnd(11)} ${mean(lo.map(r => r.pts)).toFixed(1).padStart(5)}pts at 10  ->${mean(hi.map(r => r.pts)).toFixed(1).padStart(6)}pts at 90` +
    `   swing ${dPts >= 0 ? '+' : ''}${dPts.toFixed(2)}pts, ${dDiff >= 0 ? '+' : ''}${dDiff.toFixed(1)} points difference`)
}

// ---- IS ANY DIAL SIMPLY NOT PLUMBED IN? -----------------------------------
// A dial wired to nothing gives byte-identical seasons at both ends, which shows
// up as an exact zero on both measures across every seed. That is the failure
// this probe exists to catch, and it is the one that would be invisible forever.
console.log('')
for (const dial of DIALS) {
  const s = swing[dial]
  ok(Math.abs(s.pts) > 0.001 || Math.abs(s.diff) > 0.001,
    `${dial} changes the season when you move it (${s.pts >= 0 ? '+' : ''}${s.pts.toFixed(2)}pts, ${s.diff >= 0 ? '+' : ''}${s.diff.toFixed(1)} diff)`)
}

// ---- HAS ONE DIAL BECOME THE ONLY DECISION? -------------------------------
// Measured on points difference rather than league points: points is a coarse
// step function (a one-point win and a twenty-point win both pay 4), so a real
// effect can hide inside it, while difference moves continuously.
const mags = DIALS.map(d => Math.abs(swing[d].diff))
const loudest = Math.max(...mags)
const quietest = Math.min(...mags)
const ratio = quietest > 0 ? loudest / quietest : Infinity
const names = DIALS.map((d, i) => ({ d, m: mags[i] })).sort((a, b) => b.m - a.m)
console.log(`\n  loudest ${names[0].d} (${names[0].m.toFixed(1)}), quietest ${names.at(-1)!.d} (${names.at(-1)!.m.toFixed(1)}), ratio ${ratio.toFixed(1)}x`)
ok(ratio < 40,
  `no single dial drowns the rest (${ratio.toFixed(1)}x spread between loudest and quietest, bar 40x)`)

// ---- AND MOVING NOTHING IS NOT THE BEST PLAN -----------------------------
// The neutral run, against the best single-dial run. If sitting at 50 on
// everything beats every extreme, the dials are a tax on the player's attention
// rather than a set of choices.
const neutral = mean(SEEDS.map(s => season(s, null, 50).pts))
const best = Math.max(...DIALS.map(d => Math.max(swing[d].lo, swing[d].hi)))
console.log(`\n  everything at 50: ${neutral.toFixed(1)}pts. best single-dial setting: ${best.toFixed(1)}pts`)
ok(best > neutral,
  `there is a better plan than leaving every dial alone (+${(best - neutral).toFixed(1)}pts)`)

console.log(fails ? `\n${fails} FAILURES` : '\nDIAL WEIGHT PASSED: six dials, six of them plumbed in, none of them the only decision')
process.exit(fails ? 1 : 0)
