// ---- A TEST, KEPT (1.9.14) ----
//
// After a Test the coach saw the same list of results any week shows. The
// ranking had moved, the union had reacted and players had won caps, and the
// screen said none of it. These are filed at the whistle (match/finalize.ts)
// and read by the full-time card (ui TestVerdict) and the era record.
import type { Fixture, GameState } from './model'
import { natRankOrder } from './natrank'

/** the opponent's ranking going into the Test being settled (one match is
 *  settled at a time, open then close, so a module slot is enough) */
let natRankOrderBefore: number | null = null

const mineIn = (state: GameState, fx: Fixture): string | null => {
  const nat = state.natTeam
  return nat && (fx.homeId === nat || fx.awayId === nat) ? nat : null
}

/** Before the ranking exchange: the coach's Test opens its ledger. */
export function openTestLedger(state: GameState, fx: Fixture): void {
  const nat = mineIn(state, fx)
  if (!nat) return
  state.natLastTest = {
    fxId: fx.id, season: state.season, week: state.week, nat,
    opp: fx.homeId === nat ? fx.awayId : fx.homeId, us: 0, them: 0,
    rankBefore: natRankOrder(state).indexOf(nat) + 1, rankAfter: 0,
    ptsBefore: state.natRank?.[nat] ?? 0, ptsAfter: 0, debuts: [], caps: [],
  }
  natRankOrderBefore = natRankOrder(state).indexOf(fx.homeId === nat ? fx.awayId : fx.homeId) + 1 || 99
}

/** After the exchange: the score, the new ranking, the era's best. */
export function closeTestLedger(state: GameState, fx: Fixture): void {
  const L = state.natLastTest
  if (!L || L.fxId !== fx.id) return
  L.us = fx.homeId === L.nat ? fx.homeScore : fx.awayScore
  L.them = fx.homeId === L.nat ? fx.awayScore : fx.homeScore
  L.rankAfter = natRankOrder(state).indexOf(L.nat) + 1
  L.ptsAfter = state.natRank?.[L.nat] ?? 0
  const era = eraOf(state)
  if (era && L.rankAfter > 0 && (era.bestRank === 0 || L.rankAfter < era.bestRank)) era.bestRank = L.rankAfter
  // a win over a side in the world's top five, as ranked going in (natera.ts)
  if (era && L.us > L.them) {
    const oppBefore = natRankOrderBefore ?? 99
    if (oppBefore <= 5) era.topWin = true
  }
}

/** A cap for one of the coach's men: the card lists the milestones, the era
 *  keeps the debuts. */
export function noteTestCap(state: GameState, fxId: number, teamId: string, playerId: number, caps: number): void {
  const L = state.natLastTest
  if (!L || L.fxId !== fxId || teamId !== L.nat) return
  if (caps === 1) {
    L.debuts.push(playerId)
    const era = eraOf(state)
    if (era && !era.debuts.includes(playerId)) era.debuts.push(playerId)
  } else if (caps === 25 || caps === 50 || caps === 75 || caps === 100 || (caps > 100 && caps % 25 === 0)) {
    L.caps.push({ id: playerId, n: caps })
  }
}

/** The era for the nation held now, started with the tenure. */
export function eraOf(state: GameState): NonNullable<GameState['natEra']> | null {
  const nat = state.natTeam
  if (!nat) return null
  if (!state.natEra || state.natEra.nat !== nat) {
    const now = natRankOrder(state).indexOf(nat) + 1
    state.natEra = { nat, bestRank: now > 0 ? now : 0, debuts: [] }
  }
  return state.natEra
}

/** How a Test moves the union's confidence: the one rule, read by the week's
 *  settle (which applies it) and the full-time card (which says it). */
export function testConfDelta(state: GameState, mySide: string, oppId: string, us: number, them: number): number {
  const opp = state.natRank?.[oppId] ?? 70, me = state.natRank?.[mySide] ?? 70
  const better = opp > me
  // a draw with a weaker side is a result the union counts against you, and a
  // defeat by one well below you (five points or more) is a story (1.9.15)
  // and beating a side eight or more below is what you are paid for: +1
  return us > them ? (better ? 4 : opp <= me - 8 ? 1 : 2.5) : us < them ? (better ? -3.5 : opp <= me - 5 ? -7 : -5.5) : better ? 0.5 : -1
}
