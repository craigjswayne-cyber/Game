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
 */
export const REVIEW_KEY = 'rm-rev'
/** competitive matches finished on this device before the first ask */
export const REVIEW_AFTER = 8
/** matches between one ask and the next, after the first */
export const REVIEW_GAPS = [30, 60] as const

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
