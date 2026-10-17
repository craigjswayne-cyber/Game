// How unsettled a man is, and what it takes off his fee and his terms. A leaf
// moved out of recruit.ts so that the transfer rules (askingPrice) can read it
// without importing recruit, which imports them back; recruit.ts re-exports
// what it exported before.
import type { Player } from './model'
import type { ReportStage } from './scout'
import { clamp } from './rng'

// ---------------------------------------------------------------------------
// an unsettled man is cheaper
// ---------------------------------------------------------------------------

/** How low his mood is, 0 when content. Starts at 4.5 (a quarter) and is full
 *  at 3, which is where the old flat 15% off the asking price sat. */
const moraleLevel = (p: Player): number => p.morale <= 4.5 ? clamp((5 - p.morale) / 2, 0.25, 1) : 0
const askedLevel = (p: Player): number => (p.wantsOut ?? 0) > 0 ? 1 : 0

/** How unsettled he is, 0 to 1, from reads the game already keeps: a formal
 *  transfer request (1), a place on the list (0.6), or low morale (up to 1).
 *  The worst of them counts; they are one grievance seen three ways. Pure
 *  arithmetic on the player, no draws. */
export function unsettledLevel(p: Player): number {
  return Math.max(askedLevel(p), p.transferListed ? 0.6 : 0, moraleLevel(p))
}

/** His club's asking fee: up to 15% off for a man who has asked to leave or
 *  whose mood has gone. The listing is left out on purpose: askingPrice
 *  already prices a listed man at the club's own markdown (0.8 against 1.15),
 *  and counting it twice would halve a listed player overnight. */
export function unsettledFee(p: Player): number {
  return 1 - 0.15 * Math.max(askedLevel(p), moraleLevel(p))
}

/** His own terms: up to 7% off for a man who wants out, 4% for a listed one,
 *  less for a merely low mood. A man who wants a move asks for less to get it. */
export function unsettledTerms(p: Player): number {
  return 1 - 0.07 * unsettledLevel(p)
}

/** What the report can say about his mood, and only what the club could know:
 *  a listing or a request is public at any stage, a low mood only once the
 *  scouts have a proper report and have talked to people around him. */
export type Unsettled = 'asked' | 'listed' | 'unhappy'
export function unsettledRead(stage: ReportStage, p: Player): Unsettled | null {
  if (askedLevel(p)) return 'asked'
  if (p.transferListed) return 'listed'
  if (stage >= 2 && moraleLevel(p) > 0) return 'unhappy'
  return null
}
