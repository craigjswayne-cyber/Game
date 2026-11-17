// ---- THE NATIONAL CAMP'S FOCUS (1.9.14) ----
//
// Player feedback (Instagram, 16 Nov 2026), from a manager holding a club and
// a country: "Couldn't see training for my international team". There was
// none: Training & Staff is the club's, and a Test side turned up having done
// nothing anybody chose. Owner: a camp focus.
//
// While the window is open (country.ts natWindow) the coach picks one of three
// for the camp: fitness, set pieces or attack. It is the club's match prep,
// with the same sizes and the same trade, minus the briefing room (a camp
// borrows a hotel, not your club's facilities):
//   fitness    the side tires about 8% slower
//   set pieces scrum and lineout +4%, attack -1%
//   attack     attack +3.5%, defence -1%
// It lasts the window it was chosen in and no longer, so each camp is a fresh
// decision. Nothing is drawn: a focus is a fact, read at kick-off.
// Choosing one is country.ts setCampFocus, which knows the windows; this file
// imports nothing from the season so the match engine can read it.
import type { GameState } from './model'
import { aggPenRisk, type SideCtx } from './match/side'

export type CampFocus = 'fitness' | 'setpiece' | 'attack'
export const CAMP_FOCI: CampFocus[] = ['fitness', 'setpiece', 'attack']

/** This camp's focus, if one has been chosen in this window. */
export function campFocus(state: GameState): CampFocus | null {
  const c = state.natCamp
  if (!c || !state.natTeam || c.nat !== state.natTeam) return null
  if (c.season !== state.season || state.week < c.start || state.week > c.end) return null
  return CAMP_FOCI.includes(c.focus) ? c.focus : null
}

/** Kick-off: the user's national side carries its camp's work. Keyed on the
 *  nation, not on side.isUser, for the reason setup.ts gives for the club. */
export function applyCamp(state: GameState, side: SideCtx): void {
  if (!state.natTeam || side.teamId !== state.natTeam) return
  switch (campFocus(state)) {
    case 'attack': side.units.attack *= 1.035; side.units.defence *= 0.99; break
    case 'setpiece': side.units.scrum *= 1.04; side.units.lineout *= 1.04; side.units.attack *= 0.99; break
    case 'fitness': side.drainF = 0.92; break
    default: break
  }
}

// ---- THE TEST GAME PLAN (1.9.14) ----
//
// Owner: the international stage should be "more fun to play", and a Test
// gave the coach fewer decisions than a club league match: no captain, no
// plan, and the touchline dials hidden. A nation has no club tactic, so the
// national side carries its own four dials and a captain here.
//
// The dials work the way the club's do (match/setup.ts, the dial block): the
// same arithmetic for style, tempo, kicking and aggression, applied to the
// national side only. At 50 each is exactly nothing, so a coach who leaves the
// plan alone plays the Test the engine always played.
export type NatDial = 'style' | 'tempo' | 'kicking' | 'aggression'
export const NAT_DIALS: NatDial[] = ['style', 'tempo', 'kicking', 'aggression']
type NatPlan = NonNullable<GameState['natPlan']>

/** The plan for the nation the manager coaches, created on first use. */
export function natPlanOf(state: GameState): NatPlan | null {
  const nat = state.natTeam
  if (!nat) return null
  if (!state.natPlan || state.natPlan.nat !== nat) {
    state.natPlan = { nat, style: 50, tempo: 50, kicking: 50, aggression: 50, captain: null }
  }
  return state.natPlan
}

/** Read without creating: what the engine sees. */
function planFor(state: GameState, teamId: string): NatPlan | null {
  const p = state.natPlan
  return p && state.natTeam === teamId && p.nat === teamId ? p : null
}

/** The national captain, if the coach has named one. */
export function natCaptain(state: GameState, teamId: string): number | null {
  return planFor(state, teamId)?.captain ?? null
}

/** Kick-off and every rebuild: the national side's dials. */
export function applyNatPlan(state: GameState, side: SideCtx): void {
  const plan = planFor(state, side.teamId)
  if (!plan) return
  const f = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) - 50 : 0) / 50
  const tf = f(plan.tempo)
  side.units.attack *= 1 + f(plan.style) * 0.06 + tf * (tf < 0 ? 0.08 : 0.05) - f(plan.kicking) * 0.035
  side.units.scrum *= 1 - f(plan.style) * 0.05
  side.units.breakdown *= 1 + f(plan.aggression) * 0.06 - f(plan.style) * 0.03 - f(plan.kicking) * 0.02
  side.units.kicking *= 1 + f(plan.kicking) * 0.1
  side.units.defence *= 1 - Math.max(0, tf) * 0.03
  side.tempoF *= 1 + tf * 0.12
  // aggression is the one dial whose middle is not a multiply by one: the
  // penalty risk is rebuilt from it, so it is only touched once it moves
  const ag = f(plan.aggression)
  if (ag !== 0) {
    side.cardRisk += ag * 0.006
    side.aggF = ag
    side.penRisk = aggPenRisk(ag, side.refPenF ?? 1)
  }
}
