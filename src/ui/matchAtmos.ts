/**
 * THE AFTERNOON AROUND THE MATCH (owner, 25 Sep 2026: ideas 6 and 7, "weather
 * you can see" and "sound under the picture").
 *
 * Picture and sound only. Everything here reads the fixture and the live
 * state the match screen already has; nothing is written back, and nothing
 * draws from the match's rng.
 */
import type { Fixture } from '../game/model'

/** A stable 0..1 from a fixture id, so the same fixture always looks the same. */
function idHash(id: string | number): number {
  id = String(id)
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

/**
 * UNDER THE LIGHTS. The fixture list has no kick-off times, so this is a
 * picture decision rather than a fact: a midweek match is an evening match,
 * and about a third of weekend fixtures are the Friday-night or Saturday
 * teatime slot. Picked from the fixture id, never drawn, so a match does not
 * change its lighting between a reload and a replay.
 */
export function underLights(fx: Fixture): boolean {
  return !!fx.midweek || idHash(fx.id) < 0.34
}

/** Which way the wind blows down the pitch on a windy day: +1 towards the
 *  away end (x = 100 in the fixture frame), -1 towards the home end. */
export function windDir(fx: Fixture): number {
  return idHash(fx.id + ':wind') < 0.5 ? 1 : -1
}

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
