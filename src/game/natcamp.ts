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

/**
 * THE SIDE HE IS COACHING THIS WEEK (1.9.16). On an Isles tour that is the
 * tour party, 'LIO', and not his own country, which his assistant has.
 *
 * Everything in this file was keyed on state.natTeam alone, so on the tour -
 * the hardest job in the game - the plan's four dials, the captain and the
 * camp's focus did nothing for the Isles at all, and the camp focus he chose
 * was worn by England under the assistant instead. The screens showed every
 * control and the engine read none of them.
 *
 * The same test as isles.ts islesCoach, written out here because this file
 * imports nothing from the season (the match engine reads it).
 */
export function coachedSide(state: GameState): string | null {
  const i = state.isles
  if (i && i.season === state.season && i.answer === 'yes' && (state.natSquads?.['LIO']?.length ?? 0) > 0) return 'LIO'
  return state.natTeam ?? null
}

// ---- THE TOUR'S COACHING TEAM (1.9.16) ----
//
// Owner, 21 Nov 2026: "You should pick coaches from around the game... This
// is the pinnacle of the game - make features that feel like it is the only
// place you get this." The Isles coach names three assistants from the head
// coaches of the game's clubs: forwards, attack, defence. Each lifts his part
// of the Isles' game for the whole tour by a little, more for a coach from a
// bigger club and a little more again when it is the thing his own side is
// built on. A fact read at kick-off, like the camp focus; nothing is drawn.
export type TourRole = 'fwd' | 'atk' | 'def'
export const TOUR_ROLES: TourRole[] = ['fwd', 'atk', 'def']
const ROLE_SUITS: Record<TourRole, string[]> = { fwd: ['pack', 'squeeze'], atk: ['width', 'tempo', 'counter'], def: ['blitz', 'structure', 'chaos'] }

/** What a club's head coach is worth in a tour role, in percent (0.5 to 4). */
export function tourCoachPct(state: GameState, clubId: string, role: TourRole): number {
  const c = state.clubs[clubId]
  if (!c) return 0
  const base = Math.max(0.5, Math.min(3.5, (c.rep - 50) / 12))
  const suited = !!c.philosophy && ROLE_SUITS[role].includes(c.philosophy)
  return Math.round((base + (suited ? 0.5 : 0)) * 10) / 10
}

/** Kick-off: the tour side carries its coaching team's work. */
export function applyTourStaff(state: GameState, side: SideCtx): void {
  if (side.teamId !== 'LIO' || coachedSide(state) !== 'LIO') return
  const st = state.isles?.staff
  if (!st) return
  const f = (role: TourRole) => 1 + (st[role] ? tourCoachPct(state, st[role]!, role) : 0) / 100
  side.units.scrum *= f('fwd'); side.units.lineout *= f('fwd')
  side.units.attack *= f('atk')
  side.units.defence *= f('def')
}

/** This camp's focus, if one has been chosen in this window. */
export function campFocus(state: GameState): CampFocus | null {
  const c = state.natCamp
  if (!c || c.nat !== coachedSide(state)) return null
  if (c.season !== state.season || state.week < c.start || state.week > c.end) return null
  return CAMP_FOCI.includes(c.focus) ? c.focus : null
}

/** Kick-off: the user's national side carries its camp's work. Keyed on the
 *  nation, not on side.isUser, for the reason setup.ts gives for the club. */
export function applyCamp(state: GameState, side: SideCtx): void {
  if (side.teamId !== coachedSide(state)) return
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
  const nat = coachedSide(state)
  if (!nat) return null
  if (!state.natPlan || state.natPlan.nat !== nat) {
    // the tour has a plan and a captain of its own, and his country's are
    // kept for when he is home
    if (state.natPlan && nat === 'LIO') state.natPlanHome = state.natPlan
    const home = nat !== 'LIO' && state.natPlanHome?.nat === nat ? state.natPlanHome : null
    state.natPlan = home ?? { nat, style: 50, tempo: 50, kicking: 50, aggression: 50, captain: null }
    if (nat !== 'LIO') state.natPlanHome = null
  }
  return state.natPlan
}

/** Read without creating: what the engine sees. */
function planFor(state: GameState, teamId: string): NatPlan | null {
  const p = state.natPlan
  return p && coachedSide(state) === teamId && p.nat === teamId ? p : null
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
