// ---- THE BODY AND THE CRAFT AGE DIFFERENTLY (1.7.3) ----
//
// Owner, 26 Sep 2026: "physical vs tactical aging. Although players technical
// abilities rise - so a scrimmage in the scrum is better, a kicker more
// accurate".
//
// Before this, one summer rule moved every attribute a man had by the same
// ratio, and the ratio was his rating against the rating he was BORN with
// (q0), not against last summer's. So a lad who grew from 50 to 65 had every
// attribute multiplied up again every summer for the rest of his career,
// whether or not his rating moved: measured over six seasons (seed 777) the
// 27-29 band's attributes read like a 100-rated side on a 68 rating. And a
// 34-year-old lost scrummaging exactly as fast as pace.
//
// Now each summer:
//   THE RATING CHANGE is shared out by the position's own template, the same
//   weights the attributes were built with, so a prop's point goes mostly to
//   the scrum and a wing's mostly to his legs.
//   THE AGE SHAPE moves points between kinds, and only between them: pace,
//   agility and stamina grow to 23-24 and fade from 28, pace first; strength
//   holds longest; the techniques (scrum, lineout, kicking, goal kicking,
//   handling, passing, tackling, rucking) keep improving into the early 30s;
//   reading the game (vision, decisions, positioning) grows from 24. The
//   shape is ZERO-SUM on the rating scale, so it changes what kind of player
//   a man is, never how good the game thinks he is.
//   A LEVEL PULL takes a quarter of any gap between the attributes and the
//   rating back each summer, so a save carrying the old inflation settles,
//   and the 1-20 clamps can never walk a man away from his rating.
// Leadership keeps its own clock (a point every three years from 24, as the
// world is built with); aggression and work rate are temperament, not age.
//
// Rounding is by a hash of (seed, player, season, attribute): no rng draw is
// spent, so no other roll in the summer moves.

import type { Pos } from '../data/types'
import type { Attrs, GameState, Player } from './model'
import { attrWeight } from './attributes'
import { clamp, mulberry32 } from './rng'

type K = keyof Attrs
const PHYSICAL: K[] = ['pac', 'agi', 'sta', 'str']
const TECHNICAL: K[] = ['scr', 'lin', 'goa', 'kic', 'pas', 'han', 'tac', 'ruc']
const READING: K[] = ['vis', 'dec', 'pos']
/** the attributes the age shape moves points between */
const SHAPED: K[] = [...PHYSICAL, ...TECHNICAL, ...READING]
/** the attributes that say how good a man is (goal kicking and leadership
 *  run on their own scales: a specialist kicker's goa is not his rating) */
const LEVEL: K[] = ['tac', 'str', 'scr', 'lin', 'ruc', 'han', 'pas', 'kic', 'pac', 'sta', 'agi', 'vis', 'dec', 'pos', 'agg', 'wor']

/** attribute points per rating point, for this position (deriveAttrs' slope) */
export const slope = (pos: Pos, k: K) => (0.45 + 0.55 * attrWeight(pos, k)) / 5

/** One summer's shift at the age just turned, in RATING points: how much of
 *  a man's rating moves into or out of this kind of skill. Turned into
 *  attribute points by the position's slope, so a prop's craft grows in his
 *  scrummaging and a fly-half's in his boot, and a prop, who never had much
 *  pace, has less of it to lose. */
function rawShape(age: number, k: K): number {
  switch (k) {
    case 'pac': return age <= 23 ? 1.5 : age <= 27 ? 0 : age <= 29 ? -2 : age <= 31 ? -3.5 : -4.5
    case 'agi': return age <= 23 ? 1 : age <= 27 ? 0 : age <= 29 ? -1.5 : age <= 31 ? -2.5 : -3.5
    case 'sta': return age <= 24 ? 1.5 : age <= 29 ? 0 : age <= 31 ? -2 : -3
    case 'str': return age <= 26 ? 2 : age <= 32 ? 0 : -2
    case 'vis': case 'dec': case 'pos': return age >= 24 ? 1.5 : 0
    default: return TECHNICAL.includes(k) ? (age >= 22 && age <= 31 ? 2 : age >= 32 ? 1.5 : 0) : 0
  }
}

/** The age shape for one summer, in attribute points, centred so it moves no
 *  rating: the shifts, read back as rating points, sum to zero. */
export function ageShape(age: number, pos: Pos): Partial<Record<K, number>> {
  const raw = SHAPED.map(k => rawShape(age, k))
  const mean = raw.reduce((s, v) => s + v, 0) / SHAPED.length
  const out: Partial<Record<K, number>> = {}
  SHAPED.forEach((k, i) => { out[k] = (raw[i] - mean) * slope(pos, k) })
  return out
}

/** Every summer's shape a man of this age has already lived through (from 19),
 *  for a player built into the world at that age. */
export function shapeSoFar(age: number, pos: Pos): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {}
  for (let y = 19; y <= age; y++) {
    const s = ageShape(y, pos)
    for (const k of SHAPED) out[k] = (out[k] ?? 0) + s[k]!
  }
  return out
}

/** What rating a man's attributes describe, on his position's template. */
export function attrLevel(p: Pick<Player, 'pos' | 'a'>): number {
  return LEVEL.reduce((s, k) => s + p.a[k] / slope(p.pos, k), 0) / LEVEL.length
}

const KEYS: K[] = ['tac', 'str', 'scr', 'lin', 'ruc', 'han', 'pas', 'kic', 'goa', 'pac', 'sta', 'agi', 'vis', 'dec', 'pos', 'agg', 'lea', 'wor']

/** Round x up with probability equal to its fraction, by hash. */
function hashRound(x: number, seed: number, id: number, season: number, i: number): number {
  const n = Math.floor(x)
  const u = mulberry32((seed ^ Math.imul(id, 0x27d4eb2d) ^ Math.imul(season + 1, 0x165667b1) ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0)()
  return n + (u < x - n ? 1 : 0)
}

/** Add shifts (in attribute points) to a man's attributes, rounded by hash. */
export function shiftAttrs(p: Player, d: Partial<Record<K, number>>, seed: number, season: number) {
  KEYS.forEach((k, i) => {
    const dk = d[k]
    if (!dk) return
    p.a[k] = clamp(hashRound(p.a[k] + dk, seed, p.id, season, i), 1, 20)
  })
}

/** The summer, for one man: his age already turned, his rating already moved
 *  by dCa. */
export function ageAttributes(state: GameState, p: Player, caBefore: number) {
  const dCa = p.ca - caBefore
  // the level pull reads last summer's rating against last summer's attributes
  const gap = caBefore - attrLevel(p)
  const shape = ageShape(p.age, p.pos)
  const d: Partial<Record<K, number>> = {}
  for (const k of KEYS) {
    let v = (dCa + gap * 0.25) * slope(p.pos, k) + (shape[k] ?? 0)
    // goal kicking is a specialist's craft on its own scale: it takes the
    // shape and the rating change, but no level pull
    if (k === 'goa') v -= gap * 0.25 * slope(p.pos, k)
    // leadership keeps the world's own clock: a point every three years from 24
    if (k === 'lea') v = (p.age >= 25 ? 1 / 3 : 0) + dCa * slope(p.pos, k)
    d[k] = v
  }
  shiftAttrs(p, d, state.seed, state.season)
}
