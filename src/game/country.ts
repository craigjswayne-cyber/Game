// The country desk: the national coach SHAPES his squad, he does not just
// receive it (user: "the game doesnt feel like it currently nails the
// international element. its meant to be the pinnacle but is hidden away").
// The window-open announcement hands him the federation's default list;
// these functions let him call up and drop names while the window is open,
// under the same rules the federation used to build it.
//
// Everything here is a user decision on explicit state - no rng, no dials,
// nothing to measure. Refusals return a message so the screen can say WHY,
// the same contract the treasury release uses.
import type { GameState, Player } from './model'
import { clamp } from './rng'
import { activeWindows } from './season'

const HOME4 = ['ENG', 'IRE', 'SCO', 'WAL']

/** The floor a Test squad can be trimmed to: a matchday 23 plus cover. */
export const NAT_SQUAD_FLOOR = 23

/** The open call-up window for the user's nation, or null between windows.
 *  Open means the squad exists AND the calendar says the window is running -
 *  after w.end the squad list lingers one week for the release housekeeping,
 *  and that week is not a week to be making calls. */
export function natWindow(state: GameState): { size: number } | null {
  const nat = state.natTeam
  if (!nat || !state.natSquads[nat]) return null
  const w = activeWindows(state).find(w =>
    w.nations.includes(nat) && state.week >= w.start && state.week <= w.end)
  return w ? { size: w.size } : null
}

/** Is this player callable for the user's nation at all? One predicate so the
 *  screen's list and the call-up guard can never disagree.
 *
 *  Deliberately thin (user: "there should be no age limits or restrictions
 *  on who should be picked"): the passport, the treatment table and not
 *  already being in a camp are the only bars. Age, rating, loan status and
 *  even holding a club contract are the COACH's judgement, not the game's. */
function callable(state: GameState, p: Player): boolean {
  const nat = state.natTeam
  if (!nat) return false
  const natMatch = nat === 'LIO' ? HOME4.includes(p.nat) : p.nat === nat
  return natMatch && !p.injury && !p.natSquad
}

/** The next men in: EVERY qualified player outside the current Test squads,
 *  best first, the full list - no cap, no rating floor, no velvet rope. */
export function natEligible(state: GameState): Player[] {
  if (!state.natTeam) return []
  return Object.values(state.players)
    .filter(p => callable(state, p))
    .sort((a, b) => b.ca - a.ca)
}

/** Call a player into the window squad. Returns null on success, or the
 *  refusal the screen prints. */
export function natCallUp(state: GameState, playerId: number): string | null {
  const nat = state.natTeam
  if (!nat) return 'You do not hold a national job.'
  const w = natWindow(state)
  const squad = state.natSquads[nat]
  if (!w || !squad) return 'No window is open. Call-ups happen when the federation opens camp.'
  const p = state.players[playerId]
  if (!p) return 'No such player.'
  if (squad.includes(playerId) || p.natSquad) return `${p.name} is already in a Test squad.`
  if (!(nat === 'LIO' ? HOME4.includes(p.nat) : p.nat === nat)) return `${p.name} is not qualified for this squad.`
  if (p.injury) return `${p.name} is injured. The medical staff will not pass him.`
  if (squad.length >= w.size) return `The federation caps the squad at ${w.size}. Drop a name first.`
  squad.push(playerId)
  p.natSquad = true
  p.morale = clamp(p.morale + 0.5, 1, 10) // the proudest phone call in rugby
  // the 23 is picked from the squad - a changed squad voids the old teamsheet
  if (state.natLineup?.team === nat) state.natLineup = null
  return null
}

/** Drop a player from the window squad. Returns null on success, or the
 *  refusal the screen prints. */
export function natDrop(state: GameState, playerId: number): string | null {
  const nat = state.natTeam
  if (!nat) return 'You do not hold a national job.'
  const w = natWindow(state)
  const squad = state.natSquads[nat]
  if (!w || !squad) return 'No window is open.'
  const idx = squad.indexOf(playerId)
  if (idx < 0) return 'He is not in the squad.'
  if (squad.length <= NAT_SQUAD_FLOOR) return `A Test squad cannot go below ${NAT_SQUAD_FLOOR} - call a replacement up first.`
  const p = state.players[playerId]
  squad.splice(idx, 1)
  if (p) {
    p.natSquad = false
    p.morale = clamp(p.morale - 0.7, 1, 10) // being sent home from camp stings
  }
  if (state.natLineup?.team === nat) state.natLineup = null
  return null
}
