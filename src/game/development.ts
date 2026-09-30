import type { GameState, Player, TrainingFocus } from './model'
import { planCap } from './season'

/**
 * ---- WHO CAN BE PICKED FOR DEVELOPMENT FOCUS AND PERSONAL PLANS ----
 *
 * Owner (1.8.0): "I also want to update development focus and personal plans -
 * they need to be more so I can select any player who reaches the criteria."
 *
 * Neither list was limited by the game. It was limited by the screen:
 *   - development focus showed the ten under-27s with the biggest gap to
 *     their potential and nobody else, so the eleventh man could not be
 *     picked at all, and a focused man who turned 27 fell off the list while
 *     still holding one of the three places (season.ts skips him, so the
 *     place did nothing and could not be given back);
 *   - personal plans showed the twelve best senior players by rating, so a
 *     squad's thirteenth man and every youngster outside the twelve could not
 *     be put on a programme;
 *   - a tap on a full book silently dropped the oldest assignment.
 *
 * The rules themselves are unchanged and written down here once, so the
 * Training screen and the probes read the same thing:
 *   development focus: 26 or under (season.ts reads the same age) and still
 *     below his potential, FOCUS_SLOTS places (three until 1.8.1, five now);
 *   personal plans: any senior-squad player (academy scholars have the
 *     academy coach's programme), as many as planCap: two, plus the
 *     assistant's badge, plus one for a manager from the coaching route.
 * A full book now says so instead of evicting anyone.
 */

export const FOCUS_MAX_AGE = 26
/** FIVE PLACES (owner, 1.8.1: "increase the development focus to cover 5
 *  players"). It was three. Each place is the same as it was: a focused man
 *  has an extra weekly chance of a rating point, 10% plus 4% for each level of
 *  the assistant's badge (about five to ten points over a full season, never
 *  past his potential), so two more places are two more youngsters developing
 *  faster, not three who develop faster still. */
export const FOCUS_SLOTS = 5

/** Why a man cannot carry a development focus, as a locale key, or null. */
export function focusBlock(p: Player): string | null {
  if (p.age > FOCUS_MAX_AGE) return 'training.whyFocusAge'
  if (p.ca >= p.pa) return 'training.whyCeiling'
  return null
}

/** Why a man cannot be put on a personal plan, as a locale key, or null. */
export function planBlock(p: Player): string | null {
  if (p.acad) return 'training.whyAcademy'
  return null
}

const mine = (state: GameState, id: number) => state.players[id]?.clubId === state.userClubId

/** The focus list as it counts: men still at the club, the first FOCUS_SLOTS
 *  (the weekly roll in season.ts reads this list). */
export function focusIds(state: GameState): number[] {
  return state.devFocus.filter(id => mine(state, id)).slice(0, FOCUS_SLOTS)
}

/** Add or remove a man. Adding into a full book is refused (the screen says
 *  why) rather than dropping somebody, and men no longer at the club are
 *  cleared out so their places come back. Returns true if it changed. */
export function setFocus(state: GameState, id: number, on: boolean): boolean {
  const cur = state.devFocus.filter(x => mine(state, x))
  if (!on) {
    state.devFocus = cur.filter(x => x !== id)
    return true
  }
  const p = state.players[id]
  if (!p || cur.includes(id) || focusBlock(p) || cur.filter(x => !focusBlock(state.players[x])).length >= FOCUS_SLOTS) return false
  // an entry that no longer qualifies gives its place up to a man who does
  state.devFocus = [...cur.filter(x => !focusBlock(state.players[x])), id]
  return true
}

/** Men on a plan that counts, newest last (activePlan's read). */
export function planIds(state: GameState): number[] {
  return (state.plans ?? []).filter(x => mine(state, x.id)).slice(-planCap(state)).map(x => x.id)
}

/** Put a man on a programme, change it, or take him off (plan null). A new
 *  man into a full book is refused; changing a man's programme never is. */
export function setPlan(state: GameState, id: number, plan: TrainingFocus | null): boolean {
  const cur = (state.plans ?? []).filter(x => mine(state, x.id))
  const had = cur.some(x => x.id === id)
  if (plan == null) {
    state.plans = cur.filter(x => x.id !== id)
    return had
  }
  const p = state.players[id]
  if (!p || planBlock(p)) return false
  if (!had && cur.length >= planCap(state)) return false
  // changing the programme keeps his place in the queue, and his second
  // programme unless it is now the same as the first
  state.plans = had
    ? cur.map(x => (x.id === id ? { ...x, plan, plan2: x.plan2 === plan ? undefined : x.plan2, pts: x.plan === plan ? x.pts : 0 } : x))
    : [...cur, { id, plan }]
  return true
}

/**
 * THE SECOND PROGRAMME (1.8.2, a development plan with a primary and a
 * secondary focus). Only for a man already on a plan, never the same as his
 * first, and it takes no place in the book: it splits his week (season.ts
 * rollPlan, seven parts to three) rather than adding one. null clears it.
 */
export function setPlan2(state: GameState, id: number, plan2: TrainingFocus | null): boolean {
  const cur = (state.plans ?? []).filter(x => mine(state, x.id))
  const e = cur.find(x => x.id === id)
  if (!e) return false
  if (plan2 != null && (plan2 === e.plan || plan2 === 'balanced')) return false
  state.plans = cur.map(x => (x.id === id ? { ...x, plan2: plan2 ?? undefined } : x))
  return true
}
