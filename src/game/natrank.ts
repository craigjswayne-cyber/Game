// World rankings for the Test game: an exchange system in the World Rugby
// style. Points flow from loser to winner - more for an upset, more when a
// knockout is on the line, most of all at a World Championship.

import type { Fixture, GameState } from './model'
import { NATIONS } from './nations'
import { clamp } from './rng'

const seedOf = (code: string): number => {
  const n = NATIONS.find(x => x.code === code)
  return n ? 30 + n.rep * 0.65 : 55
}

/** The Lions are a touring invitational, not a nation - never ranked. */
const UNRANKED = new Set(['LIO'])

/** Make sure every nation has a rating (new games and old saves alike). */
export function seedNatRank(state: GameState) {
  state.natRank ??= {}
  for (const n of NATIONS) {
    if (!UNRANKED.has(n.code)) state.natRank[n.code] ??= Math.round(seedOf(n.code) * 100) / 100
  }
  for (const code of UNRANKED) delete state.natRank[code]
}

/** Exchange rating points after a Test match. */
export function updateNatRank(state: GameState, fx: Fixture) {
  if (UNRANKED.has(fx.homeId) || UNRANKED.has(fx.awayId)) return
  const r = (state.natRank ??= {})
  r[fx.homeId] ??= seedOf(fx.homeId)
  r[fx.awayId] ??= seedOf(fx.awayId)
  const d = Math.max(-10, Math.min(10, r[fx.homeId] + 3 - r[fx.awayId])) // +3: home soil
  let pts: number
  if (fx.homeScore > fx.awayScore) pts = 1 - d / 10
  else if (fx.homeScore < fx.awayScore) pts = -(1 + d / 10)
  else pts = -d / 10
  let k = Math.abs(fx.homeScore - fx.awayScore) > 15 ? 1.5 : 1
  if (fx.stage) k *= fx.compId === 'wc' ? 2 : 1.5
  const delta = Math.round(pts * k * 100) / 100
  r[fx.homeId] = clamp(Math.round((r[fx.homeId] + delta) * 100) / 100, 40, 100)
  r[fx.awayId] = clamp(Math.round((r[fx.awayId] - delta) * 100) / 100, 40, 100)
}

/** Current ranking order, best first. */
export function natRankOrder(state: GameState): string[] {
  seedNatRank(state)
  return Object.keys(state.natRank!)
    .sort((a, b) => state.natRank![b] - state.natRank![a])
}
