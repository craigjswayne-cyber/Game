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
import type { SideCtx } from './match/side'

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
