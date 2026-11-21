// ---- THE SEASON PLAN (1.9.14) ----
//
// Player feedback (Instagram, 15 Nov 2026): "Be good have a preseason focus
// choose how you will play that season & practice set play". Owner: "That
// sounds like a good update for 1.9.14", then, on the first version (five
// rows, 27 choices): "I think the season plan is too confusing".
//
// So it is two questions with three answers each, on its own tab of Training
// and Staff while the plan is open (planOpen). How do you want to play
// (forwards, balanced, backs) picks an attack and a defence style; the
// pre-season work (fitness, set pieces, attack) picks the training focus, and
// set pieces also turns on Set-Piece Work, which drills the lineout and scrum
// calls faster. Each answer is written where its own screen already reads it
// (Tactics, Training, match prep), so the fine detail stays there to change.
// It adds no rule and draws nothing: a planned club and a club set up by hand
// the same way are the same club. The set-piece calls are left alone: a call
// the pack has not drilled misfires, and a one-tap card should not do that.
import type { GameState, TrainingFocus } from './model'
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
  // drift, not blitz, behind a wide game (1.9.16). With the blitz this answer was the
  // worst of the three at both clubs measured: more tired, 3.5 more tries conceded in
  // ten games, about 60 points of difference worse than Balanced and no more tries
  // scored. With drift (12 seeds, Leicester) it is 33 behind Balanced, inside the noise,
  // though still behind Forwards. The rest is the width style's own cost (styles.ts).
  backs: { atk: 'width', def: 'drift' },
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

/**
 * WHEN THE PLAN IS OPEN (owner, 16 Nov 2026: "have it as a tab that appears
 * in pre season and from the last game to the first league season of the next
 * season. Repeating. It dissapears for other times"). Two stretches:
 *   - the summer: the club has played every competitive match it has, and the
 *     league's last round is behind it (a club still in the play-offs has its
 *     tie on the list, unplayed, so it is not in the summer yet);
 *   - the pre-season: no league match played yet this season.
 * Friendlies count for neither.
 */
export function planOpen(state: GameState): boolean {
  if (state.unemployed) return false
  return afterLastGame(state) || beforeFirstLeague(state)
}

function mine(state: GameState) {
  const id = state.userClubId
  return state.fixtures.filter(f => (f.homeId === id || f.awayId === id) && f.compId !== 'fr')
}

function beforeFirstLeague(state: GameState): boolean {
  const club = state.clubs[state.userClubId]
  if (!club) return false
  return !mine(state).some(f => f.compId === club.leagueId && f.played)
}

function afterLastGame(state: GameState): boolean {
  const club = state.clubs[state.userClubId]
  if (!club) return false
  const fx = mine(state)
  const league = fx.filter(f => f.compId === club.leagueId)
  if (!league.length || fx.some(f => !f.played)) return false
  return state.week > Math.max(...league.map(f => f.week))
}

/** The season the plan is for: next season once this one's games are done. */
export function planSeason(state: GameState): number {
  return afterLastGame(state) ? state.season + 1 : state.season
}

/** The plan for the season ahead, if one has been set (a plan saved by the
 *  first version of the card, with no style, reads as not set). */
export function planThisSeason(state: GameState): PreseasonPlan | null {
  const p = state.preplan
  return p && p.season === planSeason(state) && PLAN_STYLES.includes(p.style) && PLAN_WORKS.includes(p.work) ? p : null
}

/** Write the two answers where the game already reads them. */
export function setPreseasonPlan(state: GameState, style: PlanStyle, work: PlanWork): void {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const s = STYLE_OF[style]
  applyAtkStyle(club.tactic, s.atk)
  applyDefStyle(club.tactic, s.def)
  state.training = FOCUS_OF[work]
  // EACH ANSWER PULLS THE LEVER ITS WORDS NAME (1.9.16, measured by
  // scripts/preseasonprobe.ts over 24 seeds). Only Set pieces set a match
  // preparation. Fitness ("legs for the season") set a training focus and
  // nothing that touches recovery or how fast legs tire, which read the week's
  // preparation; Attack ("moves and handling") never switched on the
  // preparation that drills called moves. All three now set their own, and a
  // preparation the manager chose himself in Training is left alone unless it
  // was one of the plan's.
  const PREP: Record<PlanWork, 'fitness' | 'setpiece' | 'attack'> = { fitness: 'fitness', setpiece: 'setpiece', attack: 'attack' }
  if (state.matchPrep == null || state.matchPrep === 'fitness' || state.matchPrep === 'setpiece' || state.matchPrep === 'attack') state.matchPrep = PREP[work]
  state.preplan = { season: planSeason(state), style, work }
  // the plan IS the game plan: the first season's checklist ticks it
  noteStep(state, 'plan')
}
