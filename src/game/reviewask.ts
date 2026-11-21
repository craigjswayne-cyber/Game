/**
 * ---- THE STORE REVIEW ASK (1.9.3, retried since 1.9.4) ----
 *
 * Owner: "Add a game review after 8 games." Once the device has seen eight
 * competitive matches finished (usage.ts counts them), the store's own review
 * card is asked for at the next quiet moment (ReviewAsk.tsx).
 *
 * UP TO THREE ASKS (1.9.4, owner: "the rating pop up hasnt happened on
 * android"). Play and Apple ration the card themselves and never say whether
 * it showed; Play shows nothing at all to a build that was not installed from
 * the Play Store, so a phone that met the first ask on a test build spent its
 * only one on nothing. Now the ask comes after 8 matches, again 30 matches
 * later and once more 60 after that, and then never again.
 *
 * Device-level, like the Pro funnel (rm-pro) and the usage counts (rm-use):
 * never in the save, so a second career does not reset it.
 *
 * ASKED ON A HIGH (1.9.16). Owner: "can you add a rate our game pop up to a
 * high of winning a derby match or something similar? Want to find a moment
 * they are on a high to then reward us with a better score. Just once per
 * game if they haven't already done it." A count of matches says nothing
 * about how the last one went: the eighth match could be a 50-point hiding.
 * So a career now also asks once, at the first quiet moment after a result
 * worth being pleased about (reviewHigh), and that ask counts as one of the
 * device's three so the counted one does not follow it a week later. The
 * stores do not say whether somebody has already rated, but both hold the
 * card back themselves from somebody who has.
 */
export const REVIEW_KEY = 'rm-rev'
/** competitive matches finished on this device before the first ask */
export const REVIEW_AFTER = 8
/** matches between one ask and the next, after the first */
export const REVIEW_GAPS = [30, 60] as const
/** matches on the device before a high can ask: nobody rates a game after one afternoon */
export const HIGH_AFTER = 4
/** matches since the last ask before a high may ask again on this device */
export const HIGH_GAP = 10

import type { GameState } from './model'
import { isDerby } from './rivalries'

export interface ReviewState {
  /** asks made so far */
  n: number
  /** the match count at the last ask */
  at: number
}

/** 1.9.3 stored a bare '1' for "asked once"; that reads as one ask at 8. */
export function parseReview(raw: string | null): ReviewState {
  if (raw === '1') return { n: 1, at: REVIEW_AFTER }
  try {
    const o = raw ? JSON.parse(raw) as Partial<ReviewState> : null
    if (o && Number.isFinite(o.n) && Number.isFinite(o.at)) return { n: Math.max(0, Math.floor(o.n!)), at: Math.max(0, Math.floor(o.at!)) }
  } catch { /* unreadable: start again */ }
  return { n: 0, at: 0 }
}

export function readReview(): ReviewState {
  try { return parseReview(globalThis.localStorage?.getItem(REVIEW_KEY) ?? null) } catch { return { n: 0, at: 0 } }
}

/** Spent the moment it is tried, so a crash mid-card never asks twice. */
export function markReviewAsked(matches: number): void {
  const r = readReview()
  try { globalThis.localStorage?.setItem(REVIEW_KEY, JSON.stringify({ n: r.n + 1, at: matches })) } catch { /* private mode: asking again is harmless */ }
}

/** Due when enough matches are in since the last ask, three asks at most. */
export function reviewDue(matches: number, r: ReviewState): boolean {
  if (r.n === 0) return matches >= REVIEW_AFTER
  const gap = REVIEW_GAPS[r.n - 1]
  return gap != null && matches >= r.at + gap
}

export type ReviewHigh = 'derby' | 'final' | 'knockout' | 'upset' | 'big'

/**
 * Is the manager on a high? Read off the last match he played, so the moment
 * passes with the next one: a derby won, a final or any
 * knockout tie won, a side well above his own beaten, or a win by 20 or more.
 * Friendlies never count. Null when there is nothing to be pleased about.
 */
export function reviewHigh(state: GameState): ReviewHigh | null {
  if (state.unemployed) return null
  const me = state.userClubId
  // his LAST match, friendly or not, and only if it was this week or last:
  // the week turns on Continue, so the first quiet screen after a Saturday
  // win is often already next week's Monday
  const fx = state.fixtures.filter(f => f.played && (f.homeId === me || f.awayId === me))
    .sort((x, y) => x.week - y.week).pop()
  if (!fx || fx.compId === 'fr' || fx.week < state.week - 1) return null
  const home = fx.homeId === me
  const mine = home ? fx.homeScore : fx.awayScore
  const theirs = home ? fx.awayScore : fx.homeScore
  const won = fx.decider ? fx.decider.winner === me : mine > theirs
  if (!won) return null
  const opp = home ? fx.awayId : fx.homeId
  if (fx.stage === 'F') return 'final'
  if (isDerby(me, opp)) return 'derby'
  if (fx.stage) return 'knockout'
  const a = state.clubs[me]?.rep ?? 0, b = state.clubs[opp]?.rep ?? 0
  if (b - a >= 8) return 'upset'
  if (mine - theirs >= 20) return 'big'
  return null
}

/** May this career ask on a high now? Once per career, never within
 *  HIGH_GAP matches of the device's last ask, and never past its third. */
export function highDue(state: GameState, matches: number, r: ReviewState): boolean {
  if (state.rateAsked) return false
  if (matches < HIGH_AFTER) return false
  if (r.n >= 1 + REVIEW_GAPS.length) return false
  if (r.n > 0 && matches < r.at + HIGH_GAP) return false
  return reviewHigh(state) != null
}
