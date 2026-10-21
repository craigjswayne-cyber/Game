// Condition: what a match takes out of a man and what a week puts back.
//
// THE SQUAD WAS ONE NUMBER (owner, 1.9.4: "The % is too consistent for
// players, it should be more random and affected by game performance,
// training, coaches"). Anybody who played the full eighty finished on an empty
// tank, the tank set the post-match condition, and the floor caught all of
// them: fifteen men on 12%, then +22 for the week, and a team sheet reading
// 35% from 1 to 15 (48% and 71% after a friendly). These two shifts give each
// man his own number. Both are centred on nothing, so a side's average
// condition, and with it the scoring and the rotation bands, stays where it was:
// only who is fresh moves.
//
// No rng draw: the per-man noise is a hash of the world seed, the player and
// the week, so it cannot move the match stream (fingerprint) and replaying a
// week gives the same numbers.

import type { GameState, Player } from './model'
import { absWeek } from './model'
import { devHash, heavyLoad } from './devproject'

/** salts for devHash, clear of the ones devproject and training use */
const SALT_TOLL = 61, SALT_REC = 62

/** the middle of a starter's stamina, and of a match rating, across the
 *  world (measured on 5,080 starters and 111,894 ratings, three seeds): the
 *  two terms are centred on what the men they apply to actually have */
const STA_MID = 10
const RATING_MID = 6.1
/** an offset on the match toll, while it is tuned (TUNE_TOLL_BIAS) */
const TOLL_BIAS = Number((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.TUNE_TOLL_BIAS ?? 0)

/** What the match cost him beyond the tank, in condition points: his engine,
 *  how his day went, and the knocks no tank measures. Roughly -12 to +12,
 *  centred on 0. `r` is his match rating (1-10, 6.5 an ordinary day). */
export function matchToll(state: GameState, p: Player, r: number | null): number {
  const engine = (p.a.sta - STA_MID) * 0.9
  // a big game lifts the legs on Monday and a bad one sits in them
  const day = r == null ? 0 : Math.max(-4, Math.min(4, (r - RATING_MID) * 2.5))
  const knocks = (devHash(state.seed, p.id, SALT_TOLL, absWeek(state.season, state.week)) - 0.5) * 12
  return engine + day + knocks - TOLL_BIAS
}

/** How the week's recovery differs for him, in condition points: age, his
 *  engine, the week's training and his own body. Roughly -9 to +9, centred
 *  on 0. `isUser` gates the training-ground parts the manager chooses. */
export function recoveryShift(state: GameState, p: Player, isUser: boolean): number {
  const age = p.age <= 22 ? 2 : p.age >= 33 ? -4 : p.age >= 30 ? -2 : 0
  const engine = (p.a.sta - STA_MID) * 0.4
  const body = (devHash(state.seed, p.id, SALT_REC, absWeek(state.season, state.week)) - 0.5) * 8
  // a fitness week builds the base he recovers on (the manager's choice, so
  // his club only); a heavy load eats into it at every club alike
  const work = (isUser && state.matchPrep === 'fitness' ? 1.5 : 0) - (heavyLoad(p) ? 2.5 : 0)
  return age + engine + body + work
}
