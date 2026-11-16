// ---- THE SEASON PLAN (1.9.14) ----
//
// Player feedback (Instagram, 15 Nov 2026): "Be good have a preseason focus
// choose how you will play that season & practice set play". Owner: "That
// sounds like a good update for 1.9.14", then, on the first version (five
// rows, 27 choices): "I think the season plan is too confusing".
//
// So it is two questions with three answers each. How do you want to play
// (forwards, balanced, backs) picks an attack and a defence style; the
// pre-season work (fitness, set pieces, attack) picks the training focus, and
// set pieces also turns on Set-Piece Work, which drills the lineout and scrum
// calls faster. Each answer is written where its own screen already reads it
// (Tactics, Training, match prep), so the fine detail stays there to change.
// It adds no rule and draws nothing: a planned club and a club set up by hand
// the same way are the same club. The set-piece calls are left alone: a call
// the pack has not drilled misfires, and a one-tap card should not do that.
import type { GameState, TrainingFocus } from './model'
import { preseasonWeeksFor } from './calendar'
import { applyAtkStyle, applyDefStyle, type AtkStyle, type DefStyle } from './styles'
import { noteStep } from './firststeps'

export type PlanStyle = 'forwards' | 'balanced' | 'backs'
export type PlanWork = 'fitness' | 'setpiece' | 'attack'

export const PLAN_STYLES: PlanStyle[] = ['forwards', 'balanced', 'backs']
export const PLAN_WORKS: PlanWork[] = ['fitness', 'setpiece', 'attack']

/** What each answer sets. */
export const STYLE_OF: Record<PlanStyle, { atk: AtkStyle; def: DefStyle }> = {
  forwards: { atk: 'direct', def: 'choke' },
  balanced: { atk: 'pods', def: 'drift' },
  backs: { atk: 'width', def: 'blitz' },
}
export const FOCUS_OF: Record<PlanWork, TrainingFocus> = {
  fitness: 'fitness',
  setpiece: 'scrum',
  attack: 'attack',
}

export interface PreseasonPlan {
  season: number
  style: PlanStyle
  work: PlanWork
}

/** The weeks the card is on Home: the pre-season, in work. */
export function planWeeks(state: GameState): boolean {
  if (state.unemployed || !state.clubs[state.userClubId]) return false
  return preseasonWeeksFor(state.gender ?? 'm').includes(state.week)
}

/** The plan this season, if one has been set (a plan saved by the first
 *  version of the card, with no style, reads as not set). */
export function planThisSeason(state: GameState): PreseasonPlan | null {
  const p = state.preplan
  return p && p.season === state.season && PLAN_STYLES.includes(p.style) && PLAN_WORKS.includes(p.work) ? p : null
}

/** Write the two answers where the game already reads them. */
export function setPreseasonPlan(state: GameState, style: PlanStyle, work: PlanWork): void {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const s = STYLE_OF[style]
  applyAtkStyle(club.tactic, s.atk)
  applyDefStyle(club.tactic, s.def)
  state.training = FOCUS_OF[work]
  if (work === 'setpiece') state.matchPrep = 'setpiece'
  else if (state.matchPrep === 'setpiece') state.matchPrep = undefined
  state.preplan = { season: state.season, style, work }
  // the plan IS the game plan: the first season's checklist ticks it
  noteStep(state, 'plan')
}
