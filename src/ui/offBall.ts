/**
 * ---- OFF THE BALL (1.8.0) ----
 *
 * Owner, reading the overnight report: "Also fix this - The biggest gap left
 * against FM Mobile is that our players are arranged in a shape for each
 * commentary line rather than moved by the match engine, so nobody makes their
 * own runs off the ball."
 *
 * Every line of the match already says where the engine has the ball
 * (MatchEvent.fld), who has it, and what just happened (the play kind: a
 * phase, a break, a kick for touch, a box kick, a chase). The pitch used to
 * turn that into ONE set of spots per line and glide everyone to them. Now it
 * also gives each man a short run across the beat, read off the same facts:
 *
 *   attack    forwards off the ruck run on to the ball as the next carriers;
 *             the backs take a line from depth, out-to-in towards the ball;
 *             the wings hold their width and step up; the full-back joins
 *   defence   the line pushes up (line speed), then drifts across towards
 *             the ball; the back three drop to cover the kick
 *   kicks     the kicking side chases from behind the mark; the side
 *             receiving it turns and covers
 *   set piece the backs stand flat until the ball is out, then move up
 *
 * A run is a few waypoints, as offsets from the man's mark in the fixture frame
 * (x in percent from the home tryline, y in percent from the top touchline)
 * at fractions of the beat. pitchGlide.ts moves each dot's target along them
 * and the spring does the rest, so a man is always going somewhere.
 *
 * Deterministic, and picture only, like phaseShape.ts: it reads the line and
 * nothing reads it back. The engine's numbers, and so the results, the
 * balance bands and the engine fingerprint, do not move.
 */
import type { PlayKind, Pt } from './phasePlay'
import type { Shape } from './phaseShape'

/** slot indices, shirt minus one */
const SH = 8, FH = 9, LW = 10, IC = 11, OC = 12, RW = 13, FB = 14

export type Waypoint = { t: number; x: number; y: number }

export type RunInput = {
  shape: Shape
  kind: PlayKind
  slot: number
  /** +1 if this side attacks towards x = 100 (home), -1 if towards x = 0 */
  dir: 1 | -1
  inPossession: boolean
  ruck: boolean
  carrier: boolean
  /** this man's mark and the ball, fixture frame */
  mark: Pt
  ball: Pt
  /** stable per man per line, 0..1, to stagger timings so no two men move as one */
  jitter: number
}

const KICKS: PlayKind[] = ['touch', 'box', 'grubber', 'cross']
/** how far a run carries a man in one beat: tuned on runsprobe */
export const RUN = 2

/** The run for one man through one beat, or null to stand on his mark. */
export function offBallRun(r: RunInput): Waypoint[] | null {
  if (r.carrier || r.ruck) return null
  if (r.shape === 'kickoff' || r.shape === 'goal' || r.shape === 'conversion') return null
  const fwd = r.dir
  const back = r.slot >= SH
  const back3 = r.slot === LW || r.slot === RW || r.slot === FB
  const toBallY = r.ball.y - r.mark.y
  // this man's pace. The offsets below are in percent of the field's length
  // (a percent is about a metre and a fifth), doubled by RUN so a beat of about
  // a second is a five-to-seven metre run: a jog, not a stroll on the spot
  const s = (0.75 + r.jitter * 0.5) * RUN
  const late = 0.08 + r.jitter * 0.14 // when he sets off

  // SET PIECE: nobody moves until the ball is out, then the backs come up
  if (r.shape === 'scrum' || r.shape === 'lineout' || r.shape === 'maul') {
    if (!back) return null
    const up = (r.inPossession ? 2.2 : 1.8) * s
    return [
      { t: 0, x: 0, y: 0 },
      { t: 0.55, x: 0, y: 0 },
      { t: 1, x: fwd * up, y: toBallY * 0.08 },
    ]
  }

  // A KICK: the side that kicked chases from behind the mark, the side it is
  // coming to turns and runs back to cover it
  if (KICKS.includes(r.kind)) {
    if (r.inPossession) {
      const chase = (back3 || r.slot < SH ? 5.5 : 3.5) * s
      return [
        { t: 0, x: -fwd * chase, y: -toBallY * 0.15 },
        { t: 0.6, x: -fwd * chase * 0.35, y: -toBallY * 0.05 },
        { t: 1, x: fwd * 0.8, y: 0 },
      ]
    }
    const turn = (back3 ? 1.5 : 3) * s
    return [
      { t: 0, x: fwd * turn, y: 0 },
      { t: 1, x: 0, y: toBallY * 0.1 },
    ]
  }

  if (r.inPossession) {
    // forwards off the ruck: on to the ball as the next pod of carriers
    if (!back) {
      return [
        { t: 0, x: -fwd * 1.2 * s, y: 0 },
        { t: late + 0.25, x: 0, y: toBallY * 0.1 },
        { t: 1, x: fwd * 1.6 * s, y: toBallY * 0.22 },
      ]
    }
    // the wings hold their width and step up with the play
    if (r.slot === LW || r.slot === RW) {
      return [
        { t: 0, x: -fwd * 1.5 * s, y: 0 },
        { t: 1, x: fwd * 2.2 * s, y: -Math.sign(toBallY || 1) * 1.2 },
      ]
    }
    // the full-back joins the line from depth
    if (r.slot === FB) {
      return [
        { t: 0, x: -fwd * 3 * s, y: toBallY * 0.1 },
        { t: 1, x: fwd * 1.5 * s, y: toBallY * 0.3 },
      ]
    }
    // the nine hovers at the base; the ten and the centres run a line from
    // depth, out-to-in, the centres later than the ten
    const depth = r.slot === SH ? 0.8 : r.slot === FH ? 2 : 2.8
    const cut = r.slot === IC || r.slot === OC ? 0.25 : 0.12
    return [
      { t: 0, x: -fwd * depth * s, y: -toBallY * 0.05 },
      { t: late + (r.slot === OC ? 0.2 : 0.1), x: -fwd * depth * 0.5 * s, y: 0 },
      { t: 1, x: fwd * 2.4 * s, y: toBallY * cut },
    ]
  }

  // DEFENCE. The back three drop and shift to cover the space behind.
  if (back3) {
    return [
      { t: 0, x: 0, y: 0 },
      { t: 1, x: -fwd * 2.2 * s, y: toBallY * 0.25 },
    ]
  }
  // The line: set, push up hard, then drift across towards the ball
  return [
    { t: 0, x: -fwd * 0.6, y: 0 },
    { t: late + 0.3, x: fwd * 2 * s, y: toBallY * 0.05 },
    { t: 1, x: fwd * 2.6 * s, y: toBallY * 0.2 },
  ]
}

/** A run as the data attribute pitchGlide reads, in DISPLAY space: x mirrored
 *  when the manager's side is drawn attacking the other way. */
export function runAttr(run: Waypoint[] | null, mirror: boolean): string | undefined {
  if (!run) return undefined
  return run.map(w => `${w.t.toFixed(2)},${(mirror ? -w.x : w.x).toFixed(2)},${w.y.toFixed(2)}`).join(';')
}

/** The offset along a run at a fraction of the beat, linear between points. */
export function runAt(run: Waypoint[], t: number): { x: number; y: number } {
  if (t <= run[0].t) return run[0]
  for (let i = 1; i < run.length; i++) {
    if (t <= run[i].t) {
      const a = run[i - 1], b = run[i], k = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
    }
  }
  return run[run.length - 1]
}

export function parseRun(s: string | undefined): Waypoint[] | null {
  if (!s) return null
  const out: Waypoint[] = []
  for (const part of s.split(';')) {
    const [t, x, y] = part.split(',').map(Number)
    if (![t, x, y].every(Number.isFinite)) return null
    out.push({ t, x, y })
  }
  return out.length ? out : null
}
