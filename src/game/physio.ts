import type { GameState, Player, TrainLoad } from './model'
import { inRedZone } from './model'
import { formTraits } from './formtraits'
import { heavyLoad } from './devproject'
import { readLevel } from './temperament'

/**
 * ---- THE PHYSIO'S REPORT (1.9.13) ----
 *
 * Owner, from FM27 Mobile's "dedicated physio report": injury risk for each
 * player, and a training-intensity recommendation. The Medical screen already
 * listed the tired, the rusty and the men past 1,300 minutes; what it did not
 * do was say how much each of those things adds up to, or what to do about it
 * this week.
 *
 * The risk is the engine's own arithmetic, nothing invented: the factors the
 * training-ground roll multiplies (season/training.ts) and the one the match
 * adds (tick.ts, the red zone), read for each senior. A brittle body counts
 * only once the club has read the man well enough to know it (formtraits
 * traitHints), as on his page. The recommendation reads the whole squad.
 */

export type RiskTier = 'high' | 'raised' | 'low'
export type RiskWhy = 'tired' | 'rusty' | 'redZone' | 'youngLoad' | 'age' | 'brittle'

export interface RiskRow { p: Player; f: number; tier: RiskTier; why: RiskWhy[] }

/** The engine's factors for this man this week, multiplied (1 is a normal body). */
export function injuryRisk(state: GameState, p: Player): RiskRow {
  const why: RiskWhy[] = []
  let f = 1
  const tired = p.cond < 55
  if ((p.rust ?? 0) > 0) { f *= 2.6; why.push('rusty') }
  if (tired) { f *= 1.7; why.push('tired') }
  if (inRedZone(p)) { f *= 1.5; why.push('redZone') }
  if (heavyLoad(p)) { f *= 1.35; why.push('youngLoad') }
  if (p.age >= 32) { f *= 1.3; why.push('age') }
  const known = p.clubId === state.userClubId || ['vague', 'full'].includes(readLevel(state, p))
  if (known && formTraits(state.seed, p.id).brit && (tired || (p.rust ?? 0) > 0 || p.cond < 60)) { f *= 2; why.push('brittle') }
  const tier: RiskTier = f >= 2.5 ? 'high' : f >= 1.5 ? 'raised' : 'low'
  return { p, f, tier, why }
}

export interface PhysioReport {
  rows: RiskRow[]
  high: number
  raised: number
  avgCond: number
  recommend: TrainLoad
}

/** The squad, read once a week: who is at risk, and the load the physio would set. */
export function physioReport(state: GameState): PhysioReport {
  const club = state.clubs[state.userClubId]
  const fit = (club?.players ?? []).map(id => state.players[id])
    .filter((p): p is Player => !!p && !p.acad && !p.injury && !p.onLoan)
  const rows = fit.map(p => injuryRisk(state, p)).filter(r => r.tier !== 'low').sort((a, b) => b.f - a.f || a.p.id - b.p.id)
  const high = rows.filter(r => r.tier === 'high').length
  const raised = rows.length - high
  const avgCond = fit.length ? fit.reduce((s, p) => s + p.cond, 0) / fit.length : 100
  // ease off when several are on the edge or the legs are gone; push when the
  // squad is fresh and nobody is close; otherwise the usual week
  const recommend: TrainLoad = high >= 3 || avgCond < 72 ? 'light'
    : high === 0 && raised <= 2 && avgCond >= 85 ? 'hard' : 'normal'
  return { rows, high, raised, avgCond, recommend }
}
