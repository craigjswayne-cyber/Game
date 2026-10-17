// What the club knows of a man: the knowledge ladder and the readings taken
// through it (attribute ranges, the fuzzed rating, the ceiling band). A leaf
// moved out of scout.ts so that scoutrecs and commission, which scout.ts
// imports, can read a man without importing scout back; scout.ts re-exports
// what it exported before.
import type { Attrs, GameState, Player } from './model'
import { ATTR_KEYS } from './model'
import { clamp, hashString, mulberry32 } from './rng'

export function knowledge(state: GameState, p: Player): number {
  if (p.clubId === state.userClubId) return 100
  return clamp(p.sc ?? 20, 0, 100)
}

/** Uncertainty margin in attribute points at a knowledge level. */
export function margin(k: number): number {
  if (k >= 95) return 0
  if (k >= 75) return 1
  if (k >= 55) return 2
  if (k >= 35) return 3
  return 4
}

/** Deterministic skew so the displayed range doesn't centre on the truth. */
function skew(p: Player, idx: number, m: number): number {
  if (m === 0) return 0
  const r = mulberry32(hashString(`${p.id}:${idx}`))()
  return Math.round((r * 2 - 1) * (m / 2))
}

/** Visible [lo, hi] for one attribute. Exact when fully scouted. */
export function attrRange(state: GameState, p: Player, key: keyof Attrs): [number, number] {
  const k = knowledge(state, p)
  const m = margin(k)
  if (m === 0) return [p.a[key], p.a[key]]
  const idx = ATTR_KEYS.indexOf(key)
  const c = clamp(p.a[key] + skew(p, idx, m), 1, 20)
  return [clamp(c - m, 1, 20), clamp(c + m, 1, 20)]
}

/** Fuzzed overall ability for star displays. */
export function fuzzedCa(state: GameState, p: Player): number {
  const k = knowledge(state, p)
  const m = margin(k)
  if (m === 0) return p.ca
  return clamp(p.ca + skew(p, 99, m * 3), 30, 99)
}

/**
 * ---- THE CEILING IS FOUND, NOT GIVEN (1.8.2) ----
 *
 * Owner: "It shouldn't be easy to see the best youngsters and free agents;
 * you should have to research and do deep dives."
 *
 * A man's potential is the most valuable secret in the game, and until now the
 * World screen listed the eight highest in any league, free agents included,
 * the pre-season circular named five of them, the market sorted on the true
 * rating and priced on the true ceiling, and a player page put a Wonderkid
 * chip on any teenager with one, scouted or not. So the ceiling is now read
 * the way the attributes always were: through knowledge. Nothing the manager
 * sees reads p.pa for a man at another club except through paRange, and
 * everything that ranks or filters for him ranks on the reading.
 *
 *   under 35 knowledge  no reading at all: a name on a team sheet
 *   35 to 54            a wide band, twelve either side
 *   55 to 74            seven either side (WATCH_KNOW: a proper report)
 *   75 to 94            four either side
 *   95 and over         the number
 *
 * The band is skewed by a fixed per-man amount, like the attribute ranges, so
 * its middle is not the truth. The only ways up the ladder are the ones that
 * always raised knowledge: the shortlist, the league background and focus,
 * facing him, and the chief scout's brief (weeklyScouting, scoutOpponent,
 * commission.ts). AI clubs never read any of this; they see true values.
 */
export const WATCH_KNOW = 55

/** Margin on the ceiling at a knowledge level, or -1 for no reading at all. */
function paMargin(k: number): number {
  if (k >= 95) return 0
  if (k >= 75) return 4
  if (k >= 55) return 7
  if (k >= 35) return 12
  return -1
}

/**
 * ---- A YOUNG MAN'S CEILING IS AN ESTIMATE, WHOEVER WATCHES HIM (1.8.2) ----
 *
 * Knowledge reads what a man IS. What he will become is still being decided
 * (devproject.ts: the ceiling moves with his seasons until his early twenties),
 * so no file, not even your own staff's on your own academy, reads it as a
 * number while he is young. The floor on the margin runs from seven points at
 * 18 to two at 23, and the club's own development staff see further: a
 * level-3 assistant and a level-3 Centre of Excellence take a point each off
 * it for the club's own men (never under one before 24). From 24 the full
 * file is the number again, as it always was.
 */
export function youthPaMargin(state: GameState, p: Player): number {
  if (p.age >= 24) return 0
  const base = p.age <= 18 ? 7 : p.age <= 20 ? 5 : p.age <= 22 ? 4 : 2
  if (p.clubId !== state.userClubId) return base
  const club = state.clubs[state.userClubId]
  const sight = ((state.staff?.assistant ?? 0) >= 3 ? 1 : 0) + ((club?.facilities?.academy ?? 0) >= 3 ? 1 : 0)
  return Math.max(1, base - sight - (secondOpinion(state, p) ? 1 : 0))
}

/**
 * A SECOND OPINION (1.8.2, rewarded.ts): a watched spot buys the development
 * staff the look they would otherwise take a season or a better setup to
 * reach, which is one more point of sight on this man's ceiling, this season.
 * It sits under the same floor of one as the assistant and the Centre of
 * Excellence, so a young man's ceiling is never read as a number early. Your
 * own players only; it changes what the club reads of him (the band, and the
 * middle of it the club's own lists sort on), never the man or any AI club.
 */
export function secondOpinion(state: GameState, p: Player): boolean {
  const o = state.rewarded?.opinion
  return p.clubId === state.userClubId && !!o && typeof o === 'object' && o[p.id] === state.season
}

/** The scouts' band on his ceiling, or null when they have not read it. */
export function paRange(state: GameState, p: Player): [number, number] | null {
  const km = paMargin(knowledge(state, p))
  if (km < 0) return null
  const m = Math.max(km, youthPaMargin(state, p))
  if (m === 0) return [p.pa, p.pa]
  const c = clamp(p.pa + skew(p, 98, m), 1, 99)
  const floor = Math.round(fuzzedCa(state, p))
  // (a band that runs past 99 slides down rather than being cut short: cut,
  // it narrowed as the ceiling rose, and a tight band at the top told the
  // reader of an unscouted man that he was the real thing)
  const lo = clamp(Math.max(floor, c - m - Math.max(0, c + m - 99)), 1, 99)
  return [lo, clamp(Math.max(lo, c + m), 1, 99)]
}

/**
 * One number for "how high could he go", as far as the club knows: the middle
 * of the band, or with no band at all a generic projection from what can be
 * seen (his rating as read, plus the years he has left to grow). It never
 * reads the ceiling of a man the scouts have not read.
 */
export function scoutPa(state: GameState, p: Player): number {
  const r = paRange(state, p)
  if (r) return (r[0] + r[1]) / 2
  return clamp(fuzzedCa(state, p) + Math.max(0, 23 - p.age) * 2.5, 1, 99)
}

export function bumpKnowledge(p: Player, amt: number) {
  p.sc = clamp((p.sc ?? 20) + amt, 0, 100)
}
