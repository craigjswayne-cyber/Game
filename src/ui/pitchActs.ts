/**
 * WHAT THE MEN DO IN A MOMENT (owner, 26 Sep 2026: "1, 2, 3 & 5" - tackles and
 * rucks you can see, cards and substitutions on the pitch, the scrum pushing
 * and the lineout lifting).
 *
 * phasePlay.ts scripts the ball and the man a line names. This scripts the men
 * AROUND them:
 *
 *   the tackle   a tackler meets the carrier where the carry ends, the carrier
 *                goes to ground (an offload stays up), and the nearest men of
 *                each side arrive over the ball: the ruck
 *   the scrum    the side the line credits drives the other back, and a scrum
 *                that is going round wheels
 *   the lineout  the jumper goes up in the lift, his two lifters close in under
 *                him, and the other side's jumper contests it
 *   the touchline a man shown a card walks off, a replaced man jogs off, and
 *                whoever comes on jogs on from the bench
 *
 * Picture only, like phasePlay.ts: nothing here is read by the engine or draws
 * from its rng, every path is a deterministic function of the line, and every
 * path either ends on the man's own spot or is thrown away at the next beat, so
 * a pitch that skips the animation (Fast, reduced motion, a scrub) is exactly
 * the pitch it was. Coordinates are the fixture frame, in percent.
 */
import type { MatchEvent } from '../game/model'
import type { Contact, Key, Pt } from './phasePlay'

/** A man on the pitch as the tackle sees him. */
export interface Man {
  id: number
  /** +1: the side the line credits; -1: the other */
  side: 1 | -1
  /** where he stood when the beat began */
  was: Pt
  /** where the layout puts him at the end of it */
  now: Pt
}

/** One man's part in the moment: a path (or none, if the passage already moves
 *  him), and when he is on the ground, as fractions of the beat. */
export interface Act {
  id: number
  role: 'carrier' | 'tackler' | 'jackler' | 'support' | 'guard'
  path: Key[] | null
  down: [number, number] | null
}

/** Screen distance, roughly: a percent across the pitch is about four pixels
 *  and a percent down it about one and a half (a strip about 400 by 150). */
const px = (a: Pt, b: Pt) => Math.hypot((a.x - b.x) * 4, (a.y - b.y) * 1.5)
/** Nobody sprints the length of the field to join a ruck. */
const REACH = 70

const k = (p: Pt, t: number): Key => ({ x: p.x, y: p.y, h: 0, at: t })

/**
 * Who is in the tackle and the ruck, and what each of them does.
 *
 * @param c       the tackle (phasePlay.contactOf)
 * @param men     everyone on the pitch
 * @param namedId the man the line names, whose own path the passage already runs
 * @param dir     the attacking direction of the side the line credits
 */
export function tackleActs(c: Contact, men: Man[], namedId: number | null, dir: number): Act[] {
  const carrying = men.filter(m => m.side === c.carrying)
  const defending = men.filter(m => m.side !== c.carrying)
  const named = namedId != null ? men.find(m => m.id === namedId) ?? null : null
  // picked by where they are going to be, not where they were: when play has
  // swung across the field in this beat, everybody started it a long way off
  const nearest = (pool: Man[], not: Set<number>, n: number) => pool
    .filter(m => !not.has(m.id) && px(m.now, c.pt) <= REACH)
    .sort((a, b) => px(a.now, c.pt) - px(b.now, c.pt) || a.id - b.id)
    .slice(0, n)

  // the named man is never drafted into somebody else's part: the passage is
  // already moving him, and a second path would fight it
  const used = new Set<number>(namedId != null ? [namedId] : [])
  // the carrier: the named man if the line is about him, else whoever of the
  // carrying side is closest to where the carry ends
  const carrier = c.named === 'carrier' && named && named.side === c.carrying ? named
    : nearest(carrying, used, 1)[0] ?? null
  if (carrier) used.add(carrier.id)
  // the tackler, or the man over the ball at a turnover
  const hitter = (c.named === 'tackler' || c.named === 'jackler') && named && named.side !== c.carrying ? named
    : nearest(defending, used, 1)[0] ?? null
  if (!carrier || !hitter) return []
  used.add(hitter.id)

  /** the carrying side's direction of attack */
  const a = dir * c.carrying
  const T = c.at
  const scrap = c.named === 'jackler'
  // a turnover is over quickly and the ball is away; a tackle is held while
  // the next phase is set up
  const hold = scrap ? 0.5 : 0.88
  const arrive = (extra: number) => Math.min(hold - 0.04, T + extra)
  const off = (p: Pt, dx: number, dy: number): Pt => ({ x: p.x + dx, y: p.y + dy })
  const run = (m: Man, spot: Pt, t: number): Key[] => [k(m.was, 0), k(spot, t), k(spot, hold), k(m.now, 1)]
  const acts: Act[] = []

  // the man the passage already moves keeps his path; only his fall is added
  const own = (m: Man) => m.id === namedId

  acts.push({
    id: carrier.id, role: 'carrier',
    path: own(carrier) ? null : run(carrier, c.pt, T),
    down: c.down ? [Math.min(hold - 0.05, T + 0.03), hold] : null,
  })
  // the tackler hits from the side the carrier is running at, and goes down
  // with him before rolling away; the jackler stays on his feet over the ball
  const hitSpot = scrap ? off(c.pt, a * 0.5, 0) : off(c.pt, a * 0.9, 0.8)
  acts.push({
    id: hitter.id, role: scrap ? 'jackler' : 'tackler',
    path: own(hitter) ? null : run(hitter, hitSpot, T),
    down: scrap ? null : [Math.min(hold - 0.05, T + 0.04), Math.min(hold, T + 0.32)],
  })
  // an offload keeps the ball alive and away: there is nothing to ruck over
  if (!c.down) return acts
  // the ruck: two of the carrying side in behind the ball, one of the others in
  // over it from the front
  nearest(carrying, used, 2).forEach((m, i) => {
    used.add(m.id)
    acts.push({ id: m.id, role: 'support', down: null,
      path: run(m, off(c.pt, -a * (1.2 + 0.9 * i), i % 2 ? 1.6 : -1.6), arrive(0.12 + 0.05 * i)) })
  })
  nearest(defending, used, 1).forEach(m => {
    used.add(m.id)
    acts.push({ id: m.id, role: 'guard', down: null, path: run(m, off(c.pt, a * 1.8, -1.2), arrive(0.16)) })
  })
  return acts
}

/** How hard the scrum goes, in percent of the pitch the side the line credits
 *  drives the other back, and how far it wheels, in degrees. An uncontested
 *  scrum does not push: that is what uncontested means. */
export function scrumDrive(ev: MatchEvent | undefined, seed: number): { push: number; wheel: number } {
  const key = (ev?.k ?? '').replace(/_[fw]$/, '')
  if (/^comm\.uncontested/.test(key)) return { push: 0, wheel: 0 }
  const push = key === 'comm.flav4' ? 3.2          // a monster scrum
    : key === 'comm.flavWet1' ? 1                   // a trudge in the rain
    : 1.7                                           // it inches forward
  // one in four goes round as well, and never the monster: that one goes
  // straight back
  const h = Math.imul((seed * 2654435761) ^ 0x5bd1e995, 1274126177) >>> 0
  const wheel = key !== 'comm.flav4' && h % 4 === 0 ? ((h >> 3) % 2 ? 16 : -16) : 0
  return { push, wheel }
}

/** Fractions of a set-piece beat, for the push: bind, the hit, a stall, the drive. */
export const SCRUM_BEATS: [number, number][] = [[0, 0], [0.38, 0], [0.52, 0.3], [0.62, 0.26], [0.84, 1], [1, 1]]

/** The lineout's cast, by slot (shirt minus one): the jumper at the middle of
 *  the line, and the men either side of him in it, who lift. */
export const LINEOUT = { jumper: 3, lifters: [2, 4] } as const
/** The lift: up, held at the top for the catch, and back down. */
export const LIFT_BEATS: [number, number][] = [[0, 0], [0.2, 0], [0.36, 1], [0.62, 1], [0.8, 0], [1, 0]]

/** Where the hooker throws from and where the jumper takes it, for the side
 *  throwing in: `mark` is the lineout's spot on the touchline. The same numbers
 *  phaseShape.ts stands them on (P(0.6, -e) and the third man in the line). */
export function lineoutSpots(mark: Pt, dir: number): { hooker: Pt; jumper: Pt } {
  const e = mark.y < 50 ? 1 : -1
  return {
    hooker: { x: mark.x - dir * 0.6, y: mark.y - e },
    jumper: { x: mark.x - dir * 1.9, y: mark.y + e * (9 + 2 * 4.6) },
  }
}

/** Where a man leaving the field heads: the touchline in front of the bench,
 *  on the side of halfway he was on. A man shown a card walks straight off. */
export function touchlineExit(was: Pt, carded: boolean): Pt {
  return carded ? { x: was.x, y: 104 } : { x: was.x + (50 - was.x) * 0.5, y: 104 }
}
/** And where a replacement comes on from. */
export function benchEntry(now: Pt): Pt {
  return { x: now.x + (50 - now.x) * 0.5, y: 104 }
}
