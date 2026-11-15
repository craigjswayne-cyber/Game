/**
 * ---- CHEAPER IN THE LAST YEAR, AND STILL A CHALLENGE (1.9.14) ----
 *
 * Social feedback: "maybe make players more affordable". Owner: "Will they not
 * damage the game and lose the challenge aspect?" transferRules.askingPrice now
 * halves the fee for a man in the final year of his contract (CONTRACT_END_F),
 * for every buyer. This probe holds the two things that could go wrong:
 *
 *   THE WORLD  AI clubs buy at the same prices. Over several seasons the
 *              strength of the clubs in a league must not drift further apart,
 *              and the titles must keep going round (no league settling into
 *              one champion every year).
 *   THE MANAGER  More of the market is within reach, but only the end of it:
 *              the men a club can afford who would improve it must stay a
 *              minority of the market, so a signing is still a choice.
 *
 * The bounds were set from the same measurement on 1.9.13's prices, with
 * room for the change to move them a little and not a lot.
 *
 * Run: npx vite-node scripts/contractendprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { askingPrice } from '../src/game/transferRules'
import type { GameState } from '../src/game/model'
import { ok, done } from './lib/probe'

const SEASONS = Number(process.env.SEASONS ?? 4)
const LEAGUES = ['prem', 'top14', 'urc']

/** The spread of club strength in a league: the standard deviation of each
 *  club's best-23 average rating. */
function spread(g: GameState, leagueId: string): number {
  const clubs = Object.values(g.clubs).filter(c => c.leagueId === leagueId)
  const str = clubs.map(c => {
    const best = c.players.map(id => g.players[id]).filter(p => p && !p.acad).map(p => p.ca).sort((a, b) => b - a).slice(0, 23)
    return best.reduce((s, x) => s + x, 0) / Math.max(1, best.length)
  })
  const m = str.reduce((s, x) => s + x, 0) / str.length
  return Math.sqrt(str.reduce((s, x) => s + (x - m) ** 2, 0) / str.length)
}

/** Of the men at other clubs who would improve this one, how many it can afford. */
function affordable(g: GameState, clubId: string): { better: number; can: number } {
  const c = g.clubs[clubId]
  const avg = c.players.map(id => g.players[id]).filter(p => p && !p.acad).reduce((s, p, _, a) => s + p.ca / a.length, 0)
  const pool = Object.values(g.players).filter(p => p.clubId && p.clubId !== clubId && !p.acad && p.ca >= avg + 3)
  return { better: pool.length, can: pool.filter(p => askingPrice(g, p) <= c.budget).length }
}

const champs: Record<string, string[]> = {}
let driftMax = 0
let shareMax = 0
for (const [club, seed] of [['harlequins', 11], ['leicester', 12]] as const) {
  const g = newGame(club, 'Contract End', seed)
  const s0 = Object.fromEntries(LEAGUES.map(l => [l, spread(g, l)]))
  const a0 = affordable(g, club)
  shareMax = Math.max(shareMax, a0.can / Math.max(1, a0.better))
  for (let s = 0; s < SEASONS; s++) {
    const start = g.season
    let guard = 0
    while (g.season === start && guard++ < 70) processWeekAndAdvance(g)
    const a = affordable(g, club)
    shareMax = Math.max(shareMax, a.can / Math.max(1, a.better))
  }
  for (const l of LEAGUES) {
    const d = spread(g, l) - s0[l]
    driftMax = Math.max(driftMax, d)
    for (const h of g.history.filter(x => x.compId === l)) (champs[l] ??= []).push(h.champion)
  }
  console.log(`  ${club}: spread ${LEAGUES.map(l => `${l} ${s0[l].toFixed(2)} -> ${spread(g, l).toFixed(2)}`).join(', ')}; affordable improvers ${a0.can}/${a0.better} at the start`)
}
const distinct = LEAGUES.map(l => new Set(champs[l] ?? []).size / Math.max(1, (champs[l] ?? []).length))
console.log(`  champions: ${LEAGUES.map((l, i) => `${l} ${new Set(champs[l]).size} different in ${(champs[l] ?? []).length} (${(distinct[i] * 100).toFixed(0)}%)`).join(', ')}`)
console.log(`  largest spread drift ${driftMax.toFixed(2)}, largest affordable share ${(shareMax * 100).toFixed(1)}%`)

ok(driftMax <= 0.9, `club strength in a league does not pull apart over ${SEASONS} seasons (largest drift ${driftMax.toFixed(2)} rating points)`)
// 1.9.13's prices, measured the same way: 6, 4 and 3 different champions in 8
// seasons (75%, 50%, 38%). A third is the floor: a league where one or two
// clubs win nearly everything is what this guards.
ok(distinct.every(d => d >= 0.33), `the titles keep going round: every league has a new champion at least one season in three (${distinct.map(d => (d * 100).toFixed(0) + '%').join(', ')})`)
// 1.9.13's prices: at most 28% of the men who would improve the club were
// within its budget at any point. Half price in the last year took that to 56%,
// the challenge leaking away; the bound keeps any easing small.
ok(shareMax <= 0.35, `a signing that improves the club is still a choice: at most ${(shareMax * 100).toFixed(1)}% of improvers are affordable (1.9.13: 28%)`)

done('CONTRACT END PROBE', 'cheaper last-year moves keep the leagues competitive and the market a choice')
