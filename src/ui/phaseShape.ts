/**
 * THE SHAPE OF THE PHASE (roadmap 1a, owner 25 Sep 2026: "lets move to idea 2").
 *
 * The men used to stand in one formation for everything: a single set of spots
 * (SPOTS in MatchDay.tsx) hung off the ball, flatter in defence. A scrum drew
 * two coloured blocks over the top of that, and the thirty dots underneath
 * carried on standing as if it were open play.
 *
 * This gives each kind of moment its own template of fifteen spots per side:
 *
 *   open     a ruck: two over the ball, the nine at the base, pods of forwards,
 *            the backs stepped back and out towards the space; the defence as
 *            a flat line across the field with the back three deep
 *   scrum    two packs bound 3-4-1 and locked together on the mark, the nines
 *            at the feed, the backlines stepped and flat, back off the scrum
 *   lineout  two lines of forwards at right angles to the touchline, the
 *            hooker throwing in, the backs ten metres back
 *   maul     two knots of forwards around the ball, the backs as in open play
 *   kickoff  the kicking side a chasing line, the receivers in a pod under it
 *            with the back three deep
 *   goal     the kicker's side behind the tee, the defenders back on their line
 *            (in the in-goal for a conversion)
 *
 * Picture only, like phasePlay.ts: it reads the line and the ball's spot and
 * nothing reads it back. Coordinates are the fixture frame, in percent: x from
 * the home tryline end (0) to the away end (100), y from the top touchline.
 *
 * SPACING IS DRAWN, NOT SURVEYED. A dot is thirteen pixels on a pitch about
 * four hundred across and a hundred and fifty deep, so a man is about four
 * metres wide on screen. Real lineout gaps would stack seven dots into one; the
 * gaps below are the smallest that still read as separate men.
 */
import type { MatchEvent } from '../game/model'
import type { PlayKind, Pt } from './phasePlay'

export type Shape = 'open' | 'scrum' | 'lineout' | 'maul' | 'kickoff' | 'goal' | 'conversion'

/** slot indices, shirt minus one */
const LP = 0, HK = 1, TP = 2, L4 = 3, L5 = 4, BF = 5, OF = 6, N8 = 7, SH = 8, FH = 9,
  LW = 10, IC = 11, OC = 12, RW = 13, FB = 14
const FORWARDS = [LP, HK, TP, L4, L5, BF, OF, N8]

/** What the pitch should be arranged as for this line. */
export function shapeFor(ev: MatchEvent | undefined, kind: PlayKind, depicts: MatchEvent['fx'] | null): Shape {
  if (!ev) return 'kickoff'
  if (depicts === 'SCRUM') return 'scrum'
  if (depicts === 'LINEOUT') return 'lineout'
  if (depicts === 'MAUL') return 'maul'
  if (ev.type === 'CON') return 'conversion'
  if (ev.type === 'PEN' || kind === 'miss') return 'goal'
  if (kind === 'restart') return 'kickoff'
  return 'open'
}

/** Where the ball sits across the field for a shape: a scrum is set at least
 *  fifteen metres in, a lineout is on the touchline. `row` is where it would
 *  otherwise be. The distance up the field is never touched. */
export function shapeRow(shape: Shape, row: number): number {
  if (shape === 'scrum') return Math.max(22, Math.min(78, row))
  if (shape === 'lineout') return row < 50 ? 6 : 94
  return row
}

export interface ShapeArgs {
  shape: Shape
  /** the ball, or for a kick at goal the tee */
  ball: Pt
  /** this side's attacking direction: +1 towards x = 100, -1 towards 0 */
  dir: number
  /** this side has the ball (fed the scrum, threw in, is kicking at goal...) */
  attacking: boolean
  /** a number that changes from line to line, to vary who hits the ruck */
  seed: number
}

/** Fifteen spots, indexed by slot. */
export function formation(a: ShapeArgs): Pt[] {
  const { ball, dir } = a
  /** u: back from the ball towards this side's own line; v: across the field */
  const P = (u: number, v: number): Pt => ({ x: ball.x - dir * u, y: ball.y + v })
  /** v measured to this side's LEFT, as the men face their direction of play:
   *  facing +x the left touchline is the top of the screen */
  const L = (u: number, left: number): Pt => P(u, -dir * left)
  /** the open side: where there is more field */
  const s = ball.y < 50 ? 1 : -1
  /** the wing standing on the top or bottom of the screen for this side */
  const wingAt = (vSign: number) => (vSign * dir < 0 ? LW : RW)
  const out: Pt[] = new Array(15)

  switch (a.shape) {
    case 'scrum': {
      // 3-4-1, loosehead on the left so it packs against the other tighthead
      out[LP] = L(1.3, 6); out[HK] = L(1.3, 0); out[TP] = L(1.3, -6)
      out[L4] = L(3.4, 3); out[L5] = L(3.4, -3)
      out[BF] = L(3.4, 9); out[OF] = L(3.4, -9)
      out[N8] = L(5.4, 0)
      // the feed goes in on the attacking side's left, and both nines are there
      // (the attacking side's left, in the defending side's terms, is its right)
      out[SH] = a.attacking ? L(0.2, 13) : L(0.9, -13)
      if (a.attacking) {
        out[FH] = P(7.5, s * 12)
        out[IC] = P(9, s * 21); out[OC] = P(10.5, s * 30)
        out[wingAt(s)] = P(11.5, s * 40); out[wingAt(-s)] = P(8, -s * 17)
        out[FB] = P(14.5, s * 10)
      } else {
        // flat, five metres back off the last feet
        out[FH] = P(9, s * 12)
        out[IC] = P(9, s * 21); out[OC] = P(9, s * 30)
        out[wingAt(s)] = P(9, s * 40); out[wingAt(-s)] = P(9, -s * 17)
        out[FB] = P(17, s * 14)
      }
      return out
    }
    case 'lineout': {
      // e points from the touchline into the field
      const e = ball.y < 50 ? 1 : -1
      const line = [LP, TP, L4, L5, BF, OF, N8]
      // a metre apart in the laws; a dot apart here, or the two lines draw as one
      line.forEach((slot, i) => { out[slot] = P(1.9, e * (9 + i * 4.6)) })
      out[HK] = a.attacking ? P(0.6, -e * 1) : P(2.2, e * 4)
      out[SH] = P(2.8, e * 45)
      const far = wingAt(e)
      const near = far === LW ? RW : LW
      if (a.attacking) {
        out[FH] = P(8.5, e * 50)
        out[IC] = P(10, e * 60); out[OC] = P(11.5, e * 70)
        out[far] = P(12.5, e * 81)
        out[near] = P(15, e * 38); out[FB] = P(17, e * 60)
      } else {
        out[FH] = P(8.5, e * 50)
        out[IC] = P(8.5, e * 60); out[OC] = P(8.5, e * 70)
        out[far] = P(8.5, e * 81)
        out[near] = P(16, e * 38); out[FB] = P(18, e * 64)
      }
      return out
    }
    case 'kickoff': {
      if (!a.attacking) {
        // receiving: a pod under the ball, the backs deep behind it
        const pod: [number, number][] = [[0, -5], [0, 5], [1.6, 0], [2.4, -9], [2.4, 9], [3.6, -4], [3.6, 4], [4.8, 0]]
        FORWARDS.forEach((slot, i) => { out[slot] = P(pod[i][0], pod[i][1]) })
        out[SH] = P(5.5, s * 8)
        out[FH] = P(9, s * 4)
        out[IC] = { x: P(8, 0).x, y: 30 }; out[OC] = { x: P(8, 0).x, y: 70 }
        out[LW] = { x: P(12, 0).x, y: dir > 0 ? 14 : 86 }; out[RW] = { x: P(12, 0).x, y: dir > 0 ? 86 : 14 }
        out[FB] = { x: P(16, 0).x, y: 50 }
        return out
      }
      // the chase: a line across the field a few strides behind where it lands,
      // the kicker trailing it
      const chasers = [LW, BF, L4, LP, HK, TP, L5, OF, N8, IC, OC, RW]
      chasers.forEach((slot, i) => {
        const y = 8 + (84 * i) / (chasers.length - 1)
        out[slot] = { x: ball.x - dir * (7 + Math.abs(y - ball.y) * 0.05), y: dir > 0 ? y : 100 - y }
      })
      out[FH] = { x: ball.x - dir * 16, y: 50 }
      out[SH] = { x: ball.x - dir * 12, y: 50 - s * 12 }
      out[FB] = { x: ball.x - dir * 20, y: 50 + s * 10 }
      return out
    }
    case 'goal':
    case 'conversion': {
      if (a.attacking) {
        // behind the kicker, well back, watching; the kicker himself is on the
        // tee (the passage walks him there, and his named spot is the tee)
        const watchers = [LP, HK, TP, L4, L5, BF, OF, N8, SH, LW, IC, OC, RW, FB]
        watchers.forEach((slot, i) => {
          out[slot] = P(9 + (i % 2) * 3, (i - 6.5) * 4.2)
        })
        // the kicker, stepped back and off to one side for his run-up, where
        // his halo does not sit on top of the ball on the tee (and above it,
        // because his name plate goes above him and would cover it from below)
        out[FH] = P(5, -13)
        return out
      }
      // the defenders back on their own line, two deep; for a conversion in
      // the in-goal behind it, ready to charge
      const line = a.shape === 'conversion' ? (dir > 0 ? 6 : 94) : (dir > 0 ? 9 : 91)
      for (let slot = 0; slot < 15; slot++) {
        const row = slot % 2
        out[slot] = { x: line - dir * row * 2.4, y: 26 + (slot >> 1) * 6.8 + row * 3 }
      }
      return out
    }
    case 'maul':
    case 'open':
      break
  }

  // ---- open play, and the backs of a maul ----
  if (a.attacking) {
    // two over the ball, varying from ruck to ruck
    const pairs: [number, number][] = [[BF, OF], [LP, L4], [HK, L5], [TP, N8], [OF, L4], [BF, TP]]
    const ruck = pairs[Math.abs(a.seed) % pairs.length]
    out[ruck[0]] = P(-0.4, -3); out[ruck[1]] = P(-0.4, 3)
    out[SH] = P(1.8, 0)
    const pods = FORWARDS.filter(f => !ruck.includes(f))
    const podSpots: [number, number][] = [[3.2, s * 7], [3.8, s * 12], [4.8, s * 9.5], [3.2, -s * 7], [3.8, -s * 12], [4.6, -s * 16]]
    pods.forEach((slot, i) => { out[slot] = P(podSpots[i][0], podSpots[i][1]) })
    // the backline, stepped back and out towards the space
    out[FH] = P(5, s * 11)
    out[IC] = P(6.8, s * 20); out[OC] = P(8.6, s * 29)
    out[wingAt(s)] = P(10, s * 39); out[wingAt(-s)] = P(6, -s * 22)
    out[FB] = P(11.5, s * 15)
  } else {
    // two guarding the ruck, everybody else in one line across the field just
    // behind the ball, the fullback deep in the pocket
    const pairs: [number, number][] = [[OF, L5], [BF, TP], [N8, LP], [L4, HK]]
    const ruck = pairs[Math.abs(a.seed) % pairs.length]
    out[ruck[0]] = P(1.1, -3); out[ruck[1]] = P(1.1, 3)
    // the line: the forwards nearest the ruck, the backs further out, the wings
    // at the ends
    const inside = [...FORWARDS.filter(f => !ruck.includes(f)), SH, FH, IC, OC]
    const spots: number[] = []
    const n = inside.length + 2
    for (let i = 0; i < n; i++) spots.push(8 + (84 * i) / (n - 1))
    // the two touchline-most spots are the wings'
    const top = spots.shift()!, bottom = spots.pop()!
    spots.sort((p, q) => Math.abs(p - ball.y) - Math.abs(q - ball.y))
    const lineX = (y: number) => ball.x - dir * (2.4 + Math.abs(y - ball.y) * 0.025)
    inside.forEach((slot, i) => { out[slot] = { x: lineX(spots[i]), y: spots[i] } })
    out[wingAt(-1)] = { x: lineX(top) - dir * 2, y: top }
    out[wingAt(1)] = { x: lineX(bottom) - dir * 2, y: bottom }
    out[FB] = P(14, s * 16)
  }

  if (a.shape === 'maul') {
    // the forwards bind on: a knot round the ball on each side of it
    const knot: [number, number][] = [[0.2, -4], [0.2, 4], [1.6, -7], [1.6, 0], [1.6, 7], [3, -4], [3, 4], [4.2, 0]]
    FORWARDS.forEach((slot, i) => {
      const [u, v] = knot[i]
      out[slot] = a.attacking ? P(u, v) : P(0.9 + u * 0.8, v)
    })
    out[SH] = P(a.attacking ? 5.6 : 5, s * 8)
  }
  return out
}
