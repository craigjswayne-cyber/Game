/**
 * THE AFTERNOON AROUND THE MATCH (owner, 25 Sep 2026: idea 7, "sound under
 * the picture"). The weather you could see (idea 6) was tried and taken back
 * out at the owner's call; the weather you can hear stays (audio.ts).
 *
 * Sound only. Everything here reads the fixture and the live
 * state the match screen already has; nothing is written back, and nothing
 * draws from the match's rng.
 */
/**
 * HOW LOUD THE GROUND IS, 0..1, for the crowd bed (audio.ts).
 *
 *   territory  the nearer the ball is to either tryline, the louder, and
 *              louder still when it is the HOME side bearing down, because
 *              most of the ground is theirs
 *   tension    a close game late on (MatchDay's tension) lifts everything
 *   review     a try gone upstairs is the loudest wait in the sport
 *   gate       a small crowd makes less noise than a full house
 */
export function crowdLevel(o: {
  ballX: number; homeAttacking: boolean; tension: number; review: boolean; att: number | undefined
}): number {
  const near = Math.max(0, Math.min(1, (Math.abs(o.ballX - 50) - 12) / 32))
  const homeEnd = o.ballX > 50
  // the home crowd roars their side on; the away end is smaller
  const lean = o.homeAttacking && homeEnd ? 1 : !o.homeAttacking && !homeEnd ? 0.7 : 0.45
  const gate = Math.max(0.4, Math.min(1, (o.att ?? 12000) / 16000))
  const lvl = 0.22 + 0.5 * near * lean + 0.35 * o.tension + (o.review ? 0.45 : 0)
  return Math.max(0, Math.min(1, lvl * gate))
}
