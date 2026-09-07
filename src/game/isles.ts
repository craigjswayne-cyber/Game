/**
 * ---- THE BRITISH & IRISH ISLES XV: THE HARDEST JOB IN THE GAME ----
 *
 * Owner, 7 Sep: "the pinnacle of the game should be coaching the British and
 * Irish Lions but we cant call them that so maybe British & Irish Isles XV...
 * This is the hardest job to be offered and it is knly offer only, only if you
 * have reputation of 95+, are coachin internationally and won something,
 * assistant takes over of national team while you do this job."
 *
 * Four conditions, and they are the whole feature. Before this, ANY coach of
 * England, Ireland, Scotland or Wales took the tour automatically, in the same
 * breath as taking the national job - which made the pinnacle of a career a
 * side effect of a job you already had.
 *
 * WHY 95 IS THE RIGHT NUMBER AND NOT AN ARBITRARY ONE. mgrReputation is capped
 * at 95: `Math.min(95, ...)`. So "reputation of 95+" is not a high bar, it is
 * THE bar - the top of the scale, reachable only with a real record and several
 * trophies behind it. The owner picked the ceiling, and this is the only thing
 * in the game that asks for it.
 *
 * OFFER ONLY. There is no apply, no shortlist and no way to ask. The four
 * unions choose, and either the letter arrives or it does not. That is how the
 * real job works and it is the reason it reads as an honour rather than a
 * transfer.
 *
 * AND THE COUNTRY DOES NOT COACH ITSELF. A man cannot prepare a Test series
 * eleven thousand miles away and run his own national side in the same summer,
 * so his assistant takes the country for the duration - the same arrangement
 * the real tour has always used, and the reason accepting costs something.
 */
import type { GameState } from './model'
import { mgrReputation } from './model'
import { isLionsSeason } from './schedule'

/** The four unions the touring side draws from. */
export const HOME_UNIONS = ['ENG', 'IRE', 'SCO', 'WAL'] as const

/** The reputation the unions want. It is the top of the scale, deliberately. */
export const ISLES_REP = 95

/** The week the letter arrives - late enough to have been earned, early enough
 *  to be a decision rather than an ambush. */
export const ISLES_OFFER_WEEK = 36

export interface IslesState {
  /** the season the offer was made in */
  season: number
  /** accepted, declined, or still sitting in the inbox */
  answer: 'open' | 'yes' | 'no'
}

/**
 * Would the unions consider him at all? Every clause of the owner's sentence,
 * and nothing else.
 */
export function islesEligible(state: GameState): { ok: boolean; why: string } {
  if (!isLionsSeason(state.season)) return { ok: false, why: 'isles.whyNoTour' }
  if (state.unemployed) return { ok: false, why: 'isles.whyNoJob' }
  // "are coachin internationally" - and one of the four, since it is their team
  const nat = state.natTeam
  if (!nat || !(HOME_UNIONS as readonly string[]).includes(nat)) return { ok: false, why: 'isles.whyNotIntl' }
  // "won something"
  if ((state.mgr?.trophies?.length ?? 0) < 1) return { ok: false, why: 'isles.whyNoTrophy' }
  // "reputation of 95+"
  if (mgrReputation(state) < ISLES_REP) return { ok: false, why: 'isles.whyRep' }
  return { ok: true, why: 'isles.whyYes' }
}

/** Is he actually taking the tour this summer? */
export function islesCoach(state: GameState): boolean {
  return isLionsSeason(state.season) && state.isles?.season === state.season && state.isles.answer === 'yes'
}

/** The letter, once a season, and only when every condition is met. */
export function offerIsles(state: GameState): boolean {
  if (state.isles?.season === state.season) return false
  if (state.week !== ISLES_OFFER_WEEK) return false
  if (!islesEligible(state).ok) return false
  state.isles = { season: state.season, answer: 'open' }
  return true
}

export function answerIsles(state: GameState, yes: boolean): boolean {
  if (state.isles?.season !== state.season || state.isles.answer !== 'open') return false
  state.isles.answer = yes ? 'yes' : 'no'
  return true
}
