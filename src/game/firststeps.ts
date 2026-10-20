// The first season's checklist: the five things a new manager does to learn the
// game, shown on Home until they are done or he skips it (owner, 1.9.4: "yes,
// but there needs to be a skip option").
//
// Three of the five are read straight off the career, so they tick themselves
// whichever way he gets there: a team sheet he picked, a match managed, a man
// signed. The other two are visits (the Tactics and Academy screens note
// themselves), since looking is the whole of those steps.
//
// Only a career started on this version carries `firstSteps`; a save from
// before has no list, which is right - that manager already knows the game.

import type { GameState } from './model'

export type StepId = 'pick' | 'plan' | 'match' | 'sign' | 'academy'

export interface FirstSteps {
  /** the steps done by visiting a screen */
  seen: StepId[]
  /** he chose not to be shown it again */
  skipped?: boolean
}

export interface Step {
  id: StepId
  done: boolean
  /** where the step's button goes (screen names as the store has them) */
  screen: 'squad' | 'tactics' | 'fixtures' | 'transfers' | 'academy'
}

/** The checklist as it stands, or null when there is nothing to show: no list
 *  on this career, skipped, or every step done. */
export function firstSteps(state: GameState): Step[] | null {
  const fs = state.firstSteps
  if (!fs || fs.skipped || state.unemployed) return null
  const club = state.clubs[state.userClubId]
  const seen = new Set(fs.seen)
  const steps: Step[] = [
    { id: 'pick', done: club?.tactic.userPicked === true, screen: 'squad' },
    { id: 'plan', done: seen.has('plan'), screen: 'tactics' },
    { id: 'match', done: (state.mgr?.m ?? 0) > 0, screen: 'fixtures' },
    { id: 'sign', done: (state.mgr?.signings ?? 0) > 0, screen: 'transfers' },
    { id: 'academy', done: seen.has('academy'), screen: 'academy' },
  ]
  return steps.every(s => s.done) ? null : steps
}

/** A visit that counts as a step done. Returns true when it changed anything,
 *  so the caller knows to save. */
export function noteStep(state: GameState, id: StepId): boolean {
  const fs = state.firstSteps
  if (!fs || fs.skipped || fs.seen.includes(id)) return false
  fs.seen.push(id)
  return true
}

/** He does not want the list: it goes for good on this career. */
export function skipFirstSteps(state: GameState): void {
  if (state.firstSteps) state.firstSteps.skipped = true
}
