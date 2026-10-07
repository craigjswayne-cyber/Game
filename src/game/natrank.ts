// World rankings for the Test game: an exchange system in the World Rugby
// style. Points flow from loser to winner - more for an upset, more when a
// knockout is on the line, most of all at a World Championship.

import type { Fixture, GameState } from './model'
import { NATIONS } from './nations'
import { clamp } from './rng'
import { genderOf, type Gender } from './gender'

/**
 * WHERE A NEW CAREER STARTS: World Rugby's own rankings, men's and women's,
 * as published in October 2026 (the owner's screenshots of the official
 * table, places 1 to 29 of each). The exchange below uses the same 40-100
 * scale, so these are the real points, not an imitation of the order.
 *
 * Every men's nation in this game is inside the published 29. The women's
 * sides of Argentina, Chile, Namibia, Romania and Uruguay are not, so they are
 * placed under the 29th (Mexico, 43.34) in the order of their reputation, half
 * a point apart: the order is a guess, the fact that they sit below is not.
 * Chile is CHL here, CHI on World Rugby's page.
 */
/** The Isles XV is a touring invitational, not a nation - never ranked. */
const UNRANKED = new Set(['LIO'])

const WR_MEN: Record<string, number> = {
  RSA: 93.09, NZL: 91.15, IRE: 88.08, FRA: 87.43, ENG: 85.68, AUS: 85.55, SCO: 84.78, ARG: 82.24,
  JPN: 77.28, FIJ: 76.81, WAL: 76.38, ITA: 76.30, GEO: 73.94, POR: 69.39, USA: 67.58,
  CHL: 66.94, ESP: 66.83, URU: 65.75, TGA: 65.14, SAM: 64.73, ROU: 62.45, CAN: 62.29, NAM: 56.96,
}
const WR_WOMEN: Record<string, number> = {
  ENG: 97.72, NZL: 91.44, CAN: 88.16, FRA: 86.74, IRE: 77.32, USA: 75.74, AUS: 75.58, ITA: 73.75,
  SCO: 72.84, RSA: 71.73, WAL: 67.57, JPN: 67.54, FIJ: 66.65, ESP: 63.22, SAM: 58.31,
  POR: 47.29, GEO: 43.88, TGA: 43.53,
}
const FLOOR = { m: 54.78, w: 43.34 }

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
