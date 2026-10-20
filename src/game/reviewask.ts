/**
 * ---- THE STORE REVIEW ASK (1.9.3) ----
 *
 * Owner: "Add a game review after 8 games." Once the device has seen eight
 * competitive matches finished (usage.ts counts them), the store's own review
 * card is asked for, once, at the next quiet moment (ReviewAsk.tsx). Never
 * again after that on this device, whatever the store did with the request:
 * Play and Apple both ration the card themselves and neither says whether it
 * showed, so asking twice only spends their quota.
 *
 * Device-level, like the Pro funnel (rm-pro) and the usage counts (rm-use):
 * never in the save, so a second career does not ask again.
 */
export const REVIEW_KEY = 'rm-rev'
/** competitive matches finished on this device before the ask */
export const REVIEW_AFTER = 8

/** True once the ask has been made on this device. */
export function reviewAsked(): boolean {
  try { return globalThis.localStorage?.getItem(REVIEW_KEY) === '1' } catch { return false }
}

/** Spent the moment it is tried, so a crash mid-card never asks twice. */
export function markReviewAsked(): void {
  try { globalThis.localStorage?.setItem(REVIEW_KEY, '1') } catch { /* private mode: asking again is harmless */ }
}

/** Due when enough matches are in and the ask has not been made. */
export const reviewDue = (matches: number, asked: boolean): boolean => !asked && matches >= REVIEW_AFTER
