// The Scouting Agency: monthly world rankings - the game's biggest names
// and the wonderkids coming for their thrones.

import type { GameState, Player } from './model'

/** Current world top 20 seniors by ability (the argument-settling list). */
export function agencySeniors(state: GameState): Player[] {
  return Object.values(state.players)
    .filter(p => p.clubId && state.clubs[p.clubId] && p.age >= 22)
    .sort((a, b) => b.ca - a.ca || b.value - a.value)
    .slice(0, 20)
}

/** Current world top 20 wonderkids (21 and under) by ceiling. */
export function agencyKids(state: GameState): Player[] {
  return Object.values(state.players)
    .filter(p => p.clubId && state.clubs[p.clubId] && p.age <= 21)
    .sort((a, b) => b.pa - a.pa || b.ca - a.ca)
    .slice(0, 20)
}

/** Monthly snapshot: remember last month's order and each man's best-ever rank. */
export function updateAgency(state: GameState) {
  const seniors = agencySeniors(state).map(p => p.id)
  const kids = agencyKids(state).map(p => p.id)
  state.agency ??= { seniors: [], kids: [], best: {} }
  for (const [list] of [[seniors], [kids]] as [number[]][]) {
    list.forEach((pid, i) => {
      const b = state.agency!.best[pid]
      state.agency!.best[pid] = b == null ? i + 1 : Math.min(b, i + 1)
    })
  }
  state.agency.seniors = seniors
  state.agency.kids = kids
}
