// The match and training injury tables. Split out of matchEngine.ts, which
// re-exports the public parts.
import type { Gender } from '../gender'
import type { Rng } from '../rng'

/** The complaint is a KEY. It is quoted on the medical screen, in the day
 *  room, in two stories and in the match commentary, and a complaint recorded
 *  as English is English in all five for as long as the lay-off lasts. */
/**
 * ---- THE SHAPE OF A SEASON'S INJURIES (design review, v1.6.7) ----
 *
 * Measured before this round: about eleven time-loss injuries per club per
 * season, mean six weeks. The professional game runs several times that many
 * and most of them are short - a week or two of soft tissue, not a month.
 * Eleven long ones meant a squad never really churned, and the selection
 * problem an injury is supposed to set the manager almost never arrived.
 *
 * So the rate roughly doubles (the roll below) and the ranges come down at the
 * short end, which leaves the total weeks lost about where it was while making
 * the week-to-week medical room look like a rugby club's. The two that define
 * a career - the knee and the achilles - are untouched.
 */
const INJURIES = [
  ['injury.ribs', 1, 2], ['injury.deadLeg', 1, 1], ['injury.ankle', 1, 3],
  ['injury.hamstring', 2, 4], ['injury.concussion', 2, 3], ['injury.shoulder', 2, 6],
  ['injury.kneeLigament', 6, 16], ['injury.brokenHand', 3, 6], ['injury.calf', 1, 3],
  ['injury.groin', 2, 4], ['injury.bicep', 7, 12], ['injury.achilles', 16, 30],
] as const

/**
 * ---- WHAT GOES WRONG IS NOT THE SAME IN BOTH GAMES ----
 *
 * Owner, 6 Sep 2026: female players carry a "statistically higher weighting for
 * non-contact ACL/knee injuries and distinct concussion tracking", male players
 * for upper-body and shoulder damage. That is the sports-medicine literature's
 * clearest and least disputed finding about the two games, and a manager who
 * follows women's rugby knows it: the knee is the injury that defines a career.
 *
 * THE MEN'S ROW IS ALL ONES AND MUST STAY THAT WAY. A uniform weight makes the
 * weighted pick below return exactly the index `Math.floor(rng() * 12)` did, so
 * a men's career injures exactly the men it always would have, in the same
 * order, off the same rng stream. That is not a nicety - the match rng is
 * shared, so shifting one draw would move every scoreline after it in every
 * save in progress. The spec's men's row is satisfied RELATIVELY: men are
 * comparatively higher on shoulder because women are so much higher on knee.
 *
 * The women's row is the whole change. The knee is three times its flat share,
 * concussion close to double, and the injuries the literature puts on the men's
 * side - shoulder, bicep - are damped.
 */
const INJURY_WEIGHT: Record<Gender, readonly number[]> = {
  //     ribs dead ankl hams conc shou KNEE hand calf groi bice achi
  m: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  w: [1, 1, 1.2, 1.2, 1.8, 0.6, 3, 0.8, 1, 0.9, 0.5, 1],
}

/**
 * A longer road back from a head injury in the women's game.
 *
 * The owner asked for "distinct concussion tracking/recovery protocols" rather
 * than only a different chance of getting one. This is the modest version of
 * that: the same complaint, a wider return-to-play band. Two to five weeks
 * instead of two to three, so a bad one costs most of a block of fixtures.
 */
const CONCUSSION_W: readonly [number, number] = [2, 5]

/**
 * ---- THE TRAINING GROUND BREAKS PLAYERS TOO (design review, v1.6.7) ----
 *
 * Every injury in this game used to come out of a match, and a quarter to a
 * third of rugby's do not: they come from a Tuesday session, off a hamstring
 * that goes in a running drill or a shoulder in contact. A squad that only
 * ever got hurt on a Saturday was a squad the manager could rest into safety.
 *
 * Its own list rather than the match one, because the mix is different: soft
 * tissue dominates, the contact injuries are rarer, and the two that end
 * seasons are rarer still - though the achilles is on it on purpose, because
 * in the real game it goes in training as often as in a match.
 *
 * Weighted, and the weights are what make it a training list: a hamstring is
 * five times a knee here. The women's row from INJURY_WEIGHT still applies on
 * top, so a women's save keeps its knee and concussion loading.
 */
const TRAINING_INJURIES: readonly (readonly [string, number, number, number])[] = [
  //  complaint              lo  hi  weight
  ['injury.hamstring', 2, 4, 5],
  ['injury.calf', 1, 3, 4],
  ['injury.groin', 2, 4, 3],
  ['injury.ankle', 1, 3, 3],
  ['injury.deadLeg', 1, 1, 3],
  ['injury.shoulder', 2, 6, 2],
  ['injury.concussion', 2, 3, 1],
  ['injury.kneeLigament', 6, 16, 1],
  ['injury.achilles', 16, 30, 0.4],
] as const

/**
 * Pick a training-ground complaint and how long it costs. Two rng draws: the
 * weighted pick, then the length inside its band. The women's weighting and
 * the longer women's return-to-play after a head knock both carry over from
 * the match table, which is where that research is written down.
 */
export function pickTrainingInjury(rng: Rng, g: Gender, real?: boolean): readonly [string, number] {
  const byKey = new Map<string, number>(INJURIES.map((r, i) => [r[0] as string, INJURY_WEIGHT[g][i]]))
  let total = 0
  for (const [dk, , , w] of TRAINING_INJURIES) total += w * (byKey.get(dk) ?? 1)
  let r = rng() * total
  let hit = TRAINING_INJURIES[TRAINING_INJURIES.length - 1]
  for (const row of TRAINING_INJURIES) {
    r -= row[3] * (byKey.get(row[0]) ?? 1)
    if (r < 0) { hit = row; break }
  }
  let [dk, lo, hi] = hit
  if (g === 'w' && dk === 'injury.concussion') { lo = CONCUSSION_W[0]; hi = CONCUSSION_W[1] }
  return [headSafe(dk, real), lo + Math.floor(rng() * (hi - lo + 1))] as const
}

/**
 * NO HEAD INJURIES FOR REAL PEOPLE (1.9.3, owner). A concussion is a story the
 * game only tells about players it made up. A real player who draws one gets a
 * hamstring for the same number of weeks instead, so the rng stream, the
 * casualty count and the weeks lost are exactly what they were.
 */
export function headSafe(dk: string, real: boolean | undefined): string {
  return real && dk === 'injury.concussion' ? 'injury.hamstring' : dk
}

/** One rng draw, exactly as the flat pick took, so a uniform row is unchanged. */
export function pickInjury(rng: Rng, g: Gender, real?: boolean): readonly [string, number, number] {
  const w = INJURY_WEIGHT[g]
  let total = 0
  for (const x of w) total += x
  let r = rng() * total
  for (let i = 0; i < INJURIES.length; i++) {
    r -= w[i]
    if (r < 0) {
      const [dk, lo, hi] = INJURIES[i]
      if (g === 'w' && dk === 'injury.concussion') return [headSafe(dk, real), CONCUSSION_W[0], CONCUSSION_W[1]]
      return [headSafe(dk, real), lo, hi]
    }
  }
  return INJURIES[INJURIES.length - 1]
}
