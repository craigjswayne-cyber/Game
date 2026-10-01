// ---- THE CLUB'S CULTURE: WHO RUNS THE ROOM (1.8.2, room.ts) ----
//
// A hidden lean between a manager-led dressing room (+1) and a player-led one
// (-1). It moves only when the manager answers a dressing-room split in the
// office (room.ts): standing by a controversial call leans it towards the
// manager, reversing one towards the players. It is never printed; the room
// shows it through reactions, knocks at the door and the odd story.
//
// A leaf on purpose: authority.ts and talkback.ts read it, and room.ts writes
// it, so it imports nothing but types. At 0 (every club, every save, every
// harness that never answers a split) every factor below is exactly 1, so the
// modules that read it behave as they always did.
import type { GameState } from './model'

/** The lean, -1 player-led .. +1 manager-led. 0 at any club but the one the
 *  ledger describes, and for a manager out of work. */
export function cultureLean(state: GameState): number {
  const r = state.room
  if (!r || state.unemployed || r.club !== state.userClubId) return 0
  const c = Number.isFinite(r.c) ? r.c : 0
  return Math.max(-1, Math.min(1, c / 100))
}

/** Manager-led rooms resent more: the discipline machine's odds of a new
 *  incident are multiplied by this (1 .. 1.6). */
export function resentment(state: GameState): number {
  return 1 + Math.max(0, cultureLean(state)) * 0.6
}

/** How much a fine's standing test is eased (+) or hardened (-): a
 *  manager-led room takes a fine as discipline more readily, a player-led one
 *  argues it. Subtracted from authority's bite, at most 0.15 either way. */
export function authorityEdge(state: GameState): number {
  return cultureLean(state) * 0.15
}

/** Player-led rooms ask for more: the talk-back knock's weekly odds are
 *  multiplied by this (1 .. 1.5). */
export function demands(state: GameState): number {
  return 1 + Math.max(0, -cultureLean(state)) * 0.5
}
