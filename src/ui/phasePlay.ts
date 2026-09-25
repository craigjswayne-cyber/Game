/**
 * THE PLAY BETWEEN THE LINES (owner, 25 Sep 2026: "filler play between events"
 * and "kicks that look like kicks").
 *
 * The engine publishes one commentary line per beat and the pitch used to glide
 * the ball from one line's spot to the next in a single straight slide. Rugby
 * does not move like that: the ball comes out of a ruck, goes through a pair of
 * hands, gets carried into contact and goes to ground again, or gets kicked.
 *
 * This file turns a line into a PASSAGE: a short script of where the ball (and
 * the man the line names) goes during the beat, from the spot the last line left
 * the ball to the spot this one puts it. It is picture only:
 *
 *   * nothing here is read by the engine and nothing draws from its rng, so the
 *     match stream (fingerprint) cannot move;
 *   * the ball's resting spot is still the territory model to the decimal
 *     (dramaprobe reads `style.left`, and the passage lives entirely in
 *     `translate`, which never touches it);
 *   * every passage ends at offset zero, so when it finishes, or never runs
 *     (reduced motion, Fast, a scrub), the pitch is exactly what it was before.
 *
 * WHAT A LINE DEPICTS comes from its commentary key. The keys already say it in
 * English ("comm.flav7" is a touch-finder, "comm.flav10" a grubber) and the key
 * is language-free, so a French save draws the same kick.
 *
 * Coordinates are the FIXTURE frame, in percent of the pitch: x runs from the
 * home tryline (0) to the away one (100), y from the top touchline to the
 * bottom. Home attacks towards +x. The caller mirrors to the screen.
 */
import type { MatchEvent } from '../game/model'

export type PlayKind =
  | 'phase'    // out of the ruck, through the hands, carried into contact
  | 'wide'     // two passes to the edge
  | 'break'    // one pass and a long, swerving carry
  | 'offload'  // carried into contact, popped out of the tackle, carried on
  | 'hit'      // the other side carry and get knocked back
  | 'turnover' // a contest at the breakdown, the ball changes hands
  | 'touch'    // a kick for the touchline
  | 'box'      // a high box kick from the base of the ruck
  | 'grubber'  // a kick along the ground
  | 'cross'    // a cross-field kick to the far wing
  | 'catch'    // a high ball arriving from the other side
  | 'restart'  // a kick-off or restart from halfway
  | 'goal'     // a kick at the posts (penalty, conversion, drop goal)
  | 'miss'     // a kick at the posts that goes wide
  | 'none'     // nothing to act out: the old straight glide

const BY_KEY: Record<string, PlayKind> = {
  // kicks for touch, and the ones that go dead
  'comm.flav7': 'touch', 'comm.flav13': 'touch', 'comm.flavWind1': 'touch',
  'comm.flavWind3': 'touch', 'comm.flavDerby4': 'touch', 'comm.howler2': 'touch',
  'comm.flavGrass8': 'turnover',
  'comm.flavWet3': 'box',
  'comm.flav10': 'grubber',
  'comm.flav17': 'cross',
  // someone else's kick comes down on this side
  'comm.flav5': 'catch', 'comm.flav20': 'catch', 'comm.flavWet5': 'catch', 'comm.flavPac6': 'catch',
  'comm.flavWind2': 'restart', 'comm.howler4': 'restart',
  // ball in hand
  'comm.flav1': 'break', 'comm.flav2': 'break', 'comm.flav11': 'break', 'comm.flav19': 'break',
  'comm.flav24': 'break', 'comm.flavPac2': 'break', 'comm.flavPac3': 'break',
  'comm.flavPac4': 'break', 'comm.flavGrass6': 'break',
  'comm.flav14': 'offload', 'comm.flavPac1': 'offload',
  'comm.flav22': 'wide', 'comm.flavWind4': 'wide', 'comm.flavGrass5': 'wide',
  // the line names the TACKLER, so the carry belongs to the other side
  'comm.flav8': 'hit', 'comm.flav12': 'hit', 'comm.flav15': 'hit', 'comm.flav23': 'hit',
  'comm.flavPac5': 'hit', 'comm.flavGrass4': 'hit', 'comm.flavDerby3': 'hit',
  'comm.flav3': 'turnover', 'comm.flav16': 'turnover', 'comm.flav25': 'turnover',
  'comm.flavWet2': 'turnover', 'comm.howler3': 'turnover',
}

/** Lines about the touchline, the bench or the crowd: play is not what they
 *  are about, so the ball just settles where the territory model puts it. */
const OFF_BALL = /^comm\.(sub|hia|halfTime|hourMark|fullTime|coach|oppCoach|shirtSwap|bench|outOfCover|uncontested|frontRow|testimonial|oldBoy|milestone|crowd|forfeit|ko)/

/** What a revealed line should act out on the pitch. */
export function playKind(ev: MatchEvent | undefined): PlayKind {
  if (!ev) return 'none'
  if (ev.type === 'PEN' || ev.type === 'CON' || ev.type === 'DG') return 'goal'
  if (ev.type === 'KO') return 'restart'
  if (ev.type !== 'SUB') return 'none'
  if (ev.fx === 'MISS') return 'miss'
  if (ev.fx) return 'none'          // scrum, lineout and maul keep their own overlay
  const key = (ev.k ?? '').replace(/_[fw]$/, '')
  if (BY_KEY[key]) return BY_KEY[key]
  if (!key || OFF_BALL.test(key)) return 'none'
  return 'phase'
}

/** Kicks that finish ON a touchline, or out on the far wing, move where the ball
 *  comes to rest across the field, so the men converge there too (a lineout is
 *  at the touchline, not in midfield). Only the across-field row: the ball's
 *  distance up the field is the territory model's and nobody else's.
 *  `row` is where the ball would otherwise sit. */
export function restingRow(kind: PlayKind, row: number): number | null {
  if (kind === 'touch') return row < 50 ? 7 : 93
  if (kind === 'cross') return row < 50 ? 84 : 16
  return null
}

export interface Pt { x: number; y: number }
/** One point on a path: where, how high off the ground (0..1), and when, as a
 *  fraction of the passage. */
export interface Key extends Pt { h: number; at: number }

export interface Passage {
  ball: Key[]
  /** the named man's path, when the line names one who is on the pitch */
  carrier: Key[] | null
  /** the ball sails away (a goal kick) instead of coming to rest, and has gone
   *  from sight by this point in the passage */
  away: boolean
}

/** When a kick at goal reaches the posts, as a fraction of the beat. */
export const GOAL_ARRIVES = 0.58

/** Where a kick at goal is struck from. A penalty or drop goal from where the
 *  territory model put it, held at least a 22 out (a kick from the tryline is
 *  not a kick); a conversion from in line with the try (`prev`, where the last
 *  line left the ball) and back towards the 22. */
export function teeSpot(type: MatchEvent['type'], spot: Pt, prev: Pt | null, dir: number): Pt {
  if (type === 'CON') return { x: dir > 0 ? 76 : 24, y: prev ? Math.max(12, Math.min(88, prev.y)) : spot.y }
  return { x: dir > 0 ? Math.min(spot.x, 78) : Math.max(spot.x, 22), y: spot.y }
}

/** A small deterministic hash so the same line always plays the same way:
 *  scrub back and forth and the pass goes to the same side every time. */
function noise(seed: number, i: number): number {
  let h = (seed * 374761393 + i * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const clampX = (x: number) => Math.max(3, Math.min(97, x))
const clampY = (y: number) => Math.max(5, Math.min(95, y))
const at = (p: Pt, h: number, t: number): Key => ({ x: clampX(p.x), y: clampY(p.y), h, at: t })
const lerp = (a: Pt, b: Pt, s: number): Pt => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s })

/** A ball in the air between two points, sampled so the height reads as an arc
 *  rather than a straight line with a bump in it. */
function flight(from: Pt, to: Pt, t0: number, t1: number, peak: number, endH = 0, steps = 6): Key[] {
  const out: Key[] = []
  for (let i = 1; i <= steps; i++) {
    const s = i / steps
    // a parabola that finishes at endH, so a goal kick is still climbing
    // as it goes over the bar while a punt comes back to earth
    const h = peak * 4 * s * (1 - s) + endH * s
    out.push(at(lerp(from, to, s), h, t0 + (t1 - t0) * s))
  }
  return out
}

/** Bounces along the ground, getting smaller. */
function bobble(from: Pt, to: Pt, t0: number, t1: number): Key[] {
  const hs = [0.14, 0, 0.09, 0, 0.05, 0]
  return hs.map((h, i) => at(lerp(from, to, (i + 1) / hs.length), h, t0 + (t1 - t0) * (i + 1) / hs.length))
}

/**
 * Script the beat.
 *
 * @param kind   what the line depicts
 * @param from   where the ball was left by the previous line
 * @param to     where this line puts it (the territory model)
 * @param dir    +1 if the side the line credits attacks towards +x, else -1
 * @param seed   a number that is the same for the same line
 * @param man    the named man: where he stood before and where the layout puts
 *               him now, or null when nobody is named
 */
export function buildPassage(kind: PlayKind, from: Pt, to: Pt, dir: number, seed: number,
  man: { was: Pt; now: Pt } | null): Passage | null {
  if (kind === 'none') return null
  const r = (i: number) => noise(seed, i)
  const side = r(1) < 0.5 ? -1 : 1
  // A pass never goes forward: the receiver is level with or behind the ball.
  const behind = (p: Pt, d: number, gap: number): Pt =>
    ({ x: d > 0 ? Math.min(p.x, from.x - gap) : Math.max(p.x, from.x + gap), y: p.y })
  // where the first receiver takes it: the named man, if he is near enough to
  // be the one it goes to, otherwise a point off the side of the ruck
  const receiver = (d: number, reach: number): Pt => {
    if (man && Math.abs(man.was.y - from.y) < 34 && Math.abs(man.was.x - from.x) < 22)
      return behind({ x: man.was.x, y: man.was.y }, d, 1.5)
    return { x: from.x - d * (2 + r(2) * 3), y: from.y + side * (reach + r(3) * 8) }
  }
  const carrierPath = (keys: Key[]): Key[] | null => {
    if (!man) return null
    return [at(man.was, 0, 0), ...keys, at(man.now, 0, 1)]
  }

  switch (kind) {
    case 'phase': {
      const rec = receiver(dir, 10)
      const ball = [at(from, 0, 0), at(from, 0, 0.14), at(lerp(from, rec, 0.5), 0.08, 0.26),
        at(rec, 0.02, 0.38), at(to, 0, 0.9), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(rec, 0, 0.38), at(to, 0, 0.9)]), away: false }
    }
    case 'wide': {
      const r1: Pt = { x: from.x - dir * 3, y: from.y + side * 12 }
      const edge = side > 0 ? 88 : 12
      const r2 = behind({ x: r1.x - dir * 2, y: edge }, dir, 4)
      const ball = [at(from, 0, 0), at(from, 0, 0.1), at(r1, 0.04, 0.26), at(r2, 0.07, 0.48),
        at(to, 0, 0.92), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(r2, 0, 0.48), at(to, 0, 0.92)]), away: false }
    }
    case 'break': {
      const rec = receiver(dir, 8)
      // the swerve: out towards space, then back in on the line
      const mid = lerp(rec, to, 0.5)
      const swerve: Pt = { x: mid.x, y: mid.y + (mid.y < 50 ? 9 : -9) }
      const ball = [at(from, 0, 0), at(from, 0, 0.1), at(rec, 0.04, 0.26), at(swerve, 0, 0.6),
        at(to, 0, 0.92), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(rec, 0, 0.26), at(swerve, 0, 0.6), at(to, 0, 0.92)]), away: false }
    }
    case 'offload': {
      const rec = receiver(dir, 8)
      const contact = lerp(rec, to, 0.45)
      const pop: Pt = { x: contact.x - dir * 1, y: contact.y + side * 6 }
      const ball = [at(from, 0, 0), at(from, 0, 0.1), at(rec, 0.04, 0.26), at(contact, 0, 0.52),
        at(pop, 0.06, 0.62), at(to, 0, 0.92), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(rec, 0, 0.26), at(contact, 0, 0.52)]), away: false }
    }
    case 'hit': {
      // the OTHER side have it, run at the named tackler and get put down behind
      // where they were going: the ball ends up back on the model's spot
      const opp = -dir
      const rec: Pt = { x: from.x - opp * 3, y: from.y + side * 9 }
      const contact: Pt = { x: rec.x + opp * 5, y: rec.y - side * 2 }
      const ball = [at(from, 0, 0), at(from, 0, 0.12), at(rec, 0.04, 0.3), at(contact, 0, 0.62),
        at(to, 0, 0.78), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(contact, 0, 0.62)]), away: false }
    }
    case 'turnover': {
      // a scrap over the ball where it went down, then it is away the other way
      const j = (i: number): Pt => ({ x: from.x + (r(10 + i) - 0.5) * 2.4, y: from.y + (r(20 + i) - 0.5) * 3 })
      const ball = [at(from, 0, 0), at(j(0), 0, 0.12), at(j(1), 0, 0.24), at(j(2), 0, 0.36),
        at(from, 0, 0.46), at(to, 0, 0.92), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(from, 0, 0.42), at(to, 0, 0.92)]), away: false }
    }
    case 'touch': {
      // pass back to the kicker, then out: the resting row is already the touchline
      const k: Pt = { x: from.x - dir * 5, y: from.y + side * 4 }
      const ball = [at(from, 0, 0), at(from, 0, 0.08), at(k, 0.03, 0.24),
        ...flight(k, to, 0.3, 0.9, 0.85), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(k, 0, 0.24), at(lerp(k, to, 0.15), 0, 0.5)]), away: false }
    }
    case 'box': {
      // straight off the base of the ruck, high enough to chase
      const ball = [at(from, 0, 0), at(from, 0, 0.16), ...flight(from, to, 0.16, 0.9, 1, 0, 8), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(to, 0, 0.88)]), away: false }
    }
    case 'grubber': {
      const k: Pt = { x: from.x - dir * 3, y: from.y + side * 3 }
      const ball = [at(from, 0, 0), at(from, 0, 0.1), at(k, 0.03, 0.26), ...bobble(k, to, 0.3, 0.9), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(to, 0, 0.9)]), away: false }
    }
    case 'cross': {
      const k: Pt = { x: from.x - dir * 4, y: from.y }
      const ball = [at(from, 0, 0), at(from, 0, 0.08), at(k, 0.03, 0.22), ...flight(k, to, 0.26, 0.88, 0.9), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(to, 0, 0.88)]), away: false }
    }
    case 'catch': {
      // their kick, coming down on the named man, who gets under it
      const ball = [at(from, 0, 0), ...flight(from, to, 0.06, 0.82, 1, 0, 8), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(to, 0, 0.8)]), away: false }
    }
    case 'restart': {
      const spot: Pt = { x: 50, y: 50 }
      const ball = [at(spot, 0, 0), at(spot, 0, 0.12), ...flight(spot, to, 0.12, 0.88, 1, 0, 8), at(to, 0, 1)]
      return { ball, carrier: carrierPath([at(to, 0, 0.86)]), away: false }
    }
    case 'goal':
    case 'miss': {
      // `from` is the tee here (the caller knows where a conversion is taken
      // from). A beat on the tee for the run-up, then at the posts: over the
      // bar, or past the upright. It arrives a little after halfway through the
      // beat, which is when the banner and the posts close-up give the verdict
      // (theme.css, .ev-banner.late), and keeps going a little, so it reads as
      // through rather than stopping on the bar.
      const posts: Pt = { x: dir > 0 ? 93 : 7, y: 50 }
      const aim: Pt = kind === 'miss' ? { x: posts.x, y: 50 + side * 15 } : posts
      const beyond = lerp(from, aim, 1.1)
      const ball = [at(from, 0, 0), at(from, 0, 0.16), ...flight(from, aim, 0.16, GOAL_ARRIVES, 0.4, 0.3, 8),
        at(beyond, 0.28, 0.74), at(beyond, 0.28, 1)]
      // the kicker named in the line: at the end of his run-up, through the
      // ball and a stride after it, then back to the side of the tee
      const kicker = man ? [at(man.was, 0, 0), at(man.now, 0, 0.1),
        at(from, 0, 0.18), at(lerp(from, aim, 0.06), 0, 0.3), at(man.now, 0, 1)] : null
      return { ball, carrier: kicker, away: true }
    }
  }
  return null
}
