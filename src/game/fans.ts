import type { GameState } from './model'
import { clamp } from './rng'

/**
 * ---- WHAT THE FANS THINK, AND WHY (1.9.13) ----
 *
 * Owner's round: fan approval broken down
 * across form, transfers, stability and the manager. PHASE had one number,
 * fan mood, moved from sixteen places (results, the summer review, star
 * signings and sales, ticket and sponsor decisions, the press). Every one of
 * them now moves it through here, naming its cause, and the season keeps a
 * running total for each, so the breakdown on the Board tab is exactly what
 * moved the number: nothing estimated alongside it.
 *
 *   results  match results, the season's verdict, awards
 *   squad    stars signed and sold, the academy promises, the homegrown
 *   club     ticket prices, sponsor and kit deals, tours, the ground
 *   manager  the press conferences, an empty chair, a legend's welcome
 */
export type FanCause = 'results' | 'squad' | 'club' | 'manager'
export const FAN_CAUSES: readonly FanCause[] = ['results', 'squad', 'club', 'manager']

function book(state: GameState, cause: FanCause, moved: number) {
  if (!moved) return
  const w = state.fanWhy?.season === state.season ? state.fanWhy
    : { season: state.season, results: 0, squad: 0, club: 0, manager: 0 }
  state.fanWhy = { ...w, [cause]: Math.round((w[cause] + moved) * 10) / 10 }
}

/** Move fan mood by `delta`, inside [lo, hi], and say why. Returns how far it moved. */
export function moveFans(state: GameState, delta: number, cause: FanCause, lo = 5, hi = 98): number {
  const before = state.fanMood ?? 60
  state.fanMood = clamp(before + delta, lo, hi)
  const moved = state.fanMood - before
  book(state, cause, moved)
  return moved
}

/** Set fan mood outright (a result's arithmetic, the summer verdict), and say why. */
export function setFans(state: GameState, value: number, cause: FanCause, lo = 5, hi = 98): number {
  return moveFans(state, value - (state.fanMood ?? 60), cause, lo, hi)
}
