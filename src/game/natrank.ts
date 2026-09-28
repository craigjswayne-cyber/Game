// World rankings for the Test game: an exchange system in the World Rugby
// style. Points flow from loser to winner - more for an upset, more when a
// knockout is on the line, most of all at a World Championship.

import type { Fixture, GameState } from './model'
import { NATIONS } from './nations'
import { clamp } from './rng'
import { genderOf, type Gender } from './gender'

/**
 * WHERE A NEW CAREER STARTS: World Rugby's own rankings, men's and women's,
 * as published on 21 September 2026 (the owner's screenshot of the official
 * table). The exchange below uses the same 40-100 scale, so these are the real
 * points, not an imitation of the order.
 *
 * Only the top fifteen of each were on the page. A nation below that is placed
 * under the fifteenth, in the order of its reputation, half a point apart:
 * the order is a guess, the fact that they sit below fifteenth is not.
 * (Women's 15th, the Netherlands, has no side in this game.)
 */
/** The Isles XV is a touring invitational, not a nation - never ranked. */
const UNRANKED = new Set(['LIO'])

const WR_MEN: Record<string, number> = {
  RSA: 95.09, NZL: 91.15, IRE: 88.08, FRA: 87.43, ENG: 85.68, SCO: 84.78, AUS: 83.55, ARG: 82.24,
  JPN: 77.28, FIJ: 76.81, WAL: 76.38, ITA: 76.30, GEO: 73.94, POR: 69.39, USA: 67.58,
}
const WR_WOMEN: Record<string, number> = {
  ENG: 97.26, NZL: 91.90, CAN: 90.61, FRA: 84.29, IRE: 77.23, USA: 75.51, ITA: 75.29, SCO: 74.40,
  AUS: 74.03, RSA: 69.87, WAL: 67.80, JPN: 67.63, FIJ: 66.44, ESP: 63.54,
}
const FLOOR = { m: 67.58, w: 58.49 }

const seedOf = (code: string, world: Gender = 'm'): number => {
  const table = world === 'w' ? WR_WOMEN : WR_MEN
  if (table[code] != null) return table[code]
  const rest = NATIONS.filter(n => table[n.code] == null && !UNRANKED.has(n.code)).sort((a, b) => b.rep - a.rep)
  const i = rest.findIndex(n => n.code === code)
  return Math.max(40, FLOOR[world] - 0.5 * (i < 0 ? rest.length + 1 : i + 1))
}


/** Make sure every nation has a rating (new games and old saves alike). */
export function seedNatRank(state: GameState) {
  state.natRank ??= {}
  for (const n of NATIONS) {
    if (!UNRANKED.has(n.code)) state.natRank[n.code] ??= Math.round(seedOf(n.code, genderOf(state)) * 100) / 100
  }
  for (const code of UNRANKED) delete state.natRank[code]
}

/** Exchange rating points after a Test match. */
export function updateNatRank(state: GameState, fx: Fixture) {
  if (UNRANKED.has(fx.homeId) || UNRANKED.has(fx.awayId)) return
  const r = (state.natRank ??= {})
  r[fx.homeId] ??= seedOf(fx.homeId, genderOf(state))
  r[fx.awayId] ??= seedOf(fx.awayId, genderOf(state))
  // +3 for home soil, except at a World Championship: the whole tournament is
  // played in one host country, so the "home" side of the fixture list is a
  // name on a draw sheet, and World Rugby takes the allowance off there too
  const soil = fx.compId === 'wc' ? 0 : 3
  const d = Math.max(-10, Math.min(10, r[fx.homeId] + soil - r[fx.awayId]))
  let pts: number
  if (fx.homeScore > fx.awayScore) pts = 1 - d / 10
  else if (fx.homeScore < fx.awayScore) pts = -(1 + d / 10)
  else pts = -d / 10
  let k = Math.abs(fx.homeScore - fx.awayScore) > 15 ? 1.5 : 1
  if (fx.stage) k *= fx.compId === 'wc' ? 2 : 1.5
  // An exchange: what one side gains the other loses. The 40 to 100 bounds
  // used to be applied to each side AFTER the exchange, so a side at the
  // ceiling took nothing while its opponent still lost the full amount, and
  // points left the system. The exchange itself is capped now, at whatever
  // the side nearer its bound can take.
  const raw = Math.round(pts * k * 100) / 100
  const delta = raw > 0
    ? Math.max(0, Math.min(raw, 100 - r[fx.homeId], r[fx.awayId] - 40))
    : Math.min(0, Math.max(raw, 40 - r[fx.homeId], r[fx.awayId] - 100))
  r[fx.homeId] = clamp(Math.round((r[fx.homeId] + delta) * 100) / 100, 40, 100)
  r[fx.awayId] = clamp(Math.round((r[fx.awayId] - delta) * 100) / 100, 40, 100)
}

/** Current ranking order, best first. */
export function natRankOrder(state: GameState): string[] {
  seedNatRank(state)
  return Object.keys(state.natRank!)
    .sort((a, b) => state.natRank![b] - state.natRank![a])
}
