// ---- THE PLAYS THE CLIPS ACT OUT (1.8.2) ----
//
// Owner, on 1.8.1: the highlight must feel like a real game. This is the
// part of the highlight clip that knows rugby rather than animation: how each
// defensive system stands and moves, and each called move as the runs,
// passes and decoys it is made of, timed from the moment the ball is out.
//
// The moves were worked out from a study of about seventy real move
// animations and coaching diagrams (the keyframes in the study's moves spec,
// redrawn in our own coordinates); nothing of the sources' own art, names or
// words is used. HighlightClip.tsx plays them: every man is still a body
// with a top speed and an acceleration, steered at his line, so a track is
// what he tries to run, not a path he is dragged along.

// ------------------------------------------------------------ the styles

/** The five defensive systems and five attacking styles of 1.8.2 (game/styles.ts). */
import { ATK_PRESET, DEF_PRESET, type AtkStyle, type DefStyle } from '../game/styles'
export type { AtkStyle, DefStyle }

/** what a side's tactic says about it: the dials (tactics.ts), and the
 *  named style once the tactic carries one */
export interface StyleDials {
  defLine?: number; defWidth?: number
  style?: number; tempo?: number; kicking?: number; ruckCommit?: number
  defStyle?: string; atkStyle?: string
  /** a pod game's shape (styles.ts PodShape): '1331', '242' or 'nine' */
  podShape?: string
}

// Where each style sits on the dials: the presets of game/styles.ts, read
// from there, so a side whose dials were set by picking a style reads back
// as that style.
const DEF_AT = Object.fromEntries(Object.entries(DEF_PRESET).map(([k, p]) => [k, [p.defLine, p.defWidth]])) as Record<DefStyle, [number, number]>
const ATK_AT = Object.fromEntries(Object.entries(ATK_PRESET).map(([k, p]) => [k, [p.style, p.tempo, p.kicking]])) as Record<AtkStyle, [number, number, number]>
const DEF_STYLES = Object.keys(DEF_AT) as DefStyle[]
const ATK_STYLES = Object.keys(ATK_AT) as AtkStyle[]

/**
 * The defending side's system. A tactic that names one is played as named;
 * until then (the styles branch adds the field) it is the system nearest its
 * line-speed and width dials, and absent dials (50/50) read as the standard
 * line with back-three cover, the pendulum.
 */
export function defStyleOf(t?: StyleDials): DefStyle {
  if (t?.defStyle && (DEF_STYLES as string[]).includes(t.defStyle)) return t.defStyle as DefStyle
  const line = t?.defLine ?? 50, width = t?.defWidth ?? 50
  let best: DefStyle = 'pendulum', bd = Infinity
  for (const s of DEF_STYLES) { const [l, w] = DEF_AT[s], dd = (l - line) ** 2 + (w - width) ** 2; if (dd < bd) { bd = dd; best = s } }
  return best
}

/** The attacking side's style, the same way round (style, tempo, kicking). */
export function atkStyleOf(t?: StyleDials): AtkStyle {
  if (t?.atkStyle && (ATK_STYLES as string[]).includes(t.atkStyle)) return t.atkStyle as AtkStyle
  const v = [t?.style ?? 50, t?.tempo ?? 50, t?.kicking ?? 50]
  let best: AtkStyle = 'pods', bd = Infinity
  for (const s of ATK_STYLES) { const p = ATK_AT[s], dd = p.reduce((a, x, i) => a + (x - v[i]) ** 2, 0); if (dd < bd) { bd = dd; best = s } }
  return best
}

/** How a defensive system stands and moves, in metres and seconds. */
export interface DefShape {
  style: DefStyle
  /** how fast the line comes up once the ball is out (m/s), for how long,
   *  and then how fast it keeps coming */
  up: number; upFor: number; upAfter: number
  /** how far behind the gain line the backs stand at a scrum (the law's
   *  five metres; a blitz is on it, a drift a little deeper) */
  scrumGap: number
  /** marking: a zone holds its channel and slides; man follows his man */
  mark: 'zone' | 'man'
  /** metres inside his man's shoulder */
  inside: number
  /** share of the ball's travel across the field the line slides with */
  slide: number
  /** the line's spread about the ball (1 as drawn in DEF) */
  width: number
  /** metres the line stands off the ball in phase play (added to DEF) */
  depth: number
  /** the back three as a pendulum: ball-side wing up, full-back behind him,
   *  far wing deep in the middle (otherwise both wings up in the line) */
  pendulum: boolean
  /** how far the man on a decoy steps in on him when he bites (m) */
  bite: number
  /** two men hold the carrier up in the tackle */
  choke: boolean
  /** the chase after a break: reaction, pace, how far the cover leads */
  react: number; huntV: number; coverV: number; coverLead: number
}

const SHAPES: Record<DefStyle, DefShape> = {
  drift: {
    style: 'drift', up: 2.6, upFor: 1.0, upAfter: 1.0, scrumGap: 6, mark: 'zone', inside: 1.0, slide: 0.8, width: 1.12, depth: 0.8,
    pendulum: false, bite: 1.5, choke: false, react: 0.3, huntV: 9, coverV: 9, coverLead: 3.4,
  },
  blitz: {
    style: 'blitz', up: 5.6, upFor: 1.6, upAfter: 2, scrumGap: 5, mark: 'zone', inside: 0, slide: 0.3, width: 1.0, depth: -0.8,
    pendulum: false, bite: 2.0, choke: false, react: 0.2, huntV: 9.2, coverV: 9, coverLead: 2.6,
  },
  pendulum: {
    style: 'pendulum', up: 3.6, upFor: 1.2, upAfter: 1.4, scrumGap: 5.5, mark: 'zone', inside: 0.5, slide: 0.55, width: 1.0, depth: 0,
    pendulum: true, bite: 1.5, choke: false, react: 0.3, huntV: 9, coverV: 9, coverLead: 3.2,
  },
  man: {
    style: 'man', up: 3.4, upFor: 1.2, upAfter: 1.4, scrumGap: 5.5, mark: 'man', inside: 0, slide: 0, width: 0.95, depth: 0,
    pendulum: false, bite: 1.5, choke: false, react: 0.35, huntV: 9, coverV: 8.8, coverLead: 3,
  },
  choke: {
    style: 'choke', up: 4.4, upFor: 1.3, upAfter: 1.6, scrumGap: 5.5, mark: 'zone', inside: 0.8, slide: 0.45, width: 0.82, depth: -0.3,
    pendulum: false, bite: 1.8, choke: true, react: 0.3, huntV: 8.8, coverV: 8.8, coverLead: 3,
  },
}

/** THE ONE PLACE A DEFENCE'S SHAPE COMES FROM (1.8.2). */
export function defenceShape(style: DefStyle | undefined): DefShape { return SHAPES[style ?? 'pendulum'] }

// ------------------------------------------------------------ the moves

/** [seconds from the ball out, metres forward of the gain line, metres
 *  across towards the side the move goes] */
export type K = [number, number, number]
export type PassKind = 'pop' | 'pass' | 'miss'
/** where a track is drawn from: a set piece's mark, or the last ruck */
export type TrackFrom = 'scrum' | 'lineout' | 'ruck' | 'tap'

/**
 * A MOVE AS IT IS RUN. Roles are shirt numbers, or W (the wing on the side
 * the move goes) and FW (the far wing, on the other side), because which of
 * 11 and 14 that is depends on the way the side is running.
 *   runs     each man's line, as keyframes from the moment the ball is out
 *   ball     the passes: [release time, receiver, kind]; before the first,
 *            the 9 has it at the base (or `first` has it)
 *   strike   the man whose catch is the break
 *   decoys   men who run a carrier's line and never get it
 *   bite     the man the defence bites on, just before the gap is hit
 *   late     the late runner: slow and deep, then flat out
 *   finish   metres across (towards the move side) where it is grounded
 */
export interface Track {
  set: TrackFrom
  runs: Record<string, K[]>
  ball: [number, string, PassKind?][]
  first?: string
  strike: string
  decoys?: string[]
  bite?: string
  late?: string
  finish: number
  /** a kick move (1.8.2): the man chasing the kick, who scores when the
   *  commentary names nobody (the strike is then the kicker) */
  chase?: string
}

/** a track written in the study's coordinates (a 100 x 70 pitch, attack to
 *  +x): origin the gain line's x and the 9's y, `sgn` +1 when the move goes
 *  to +y, and `t0` the moment the 9 has the ball */
function spec(set: TrackFrom, [ox, oy, sgn, t0]: [number, number, number, number],
  runs: Record<string, [number, number, number][]>, rest: Omit<Track, 'set' | 'runs' | 'ball'> & { ball: [number, string, PassKind?][] }): Track {
  const out: Record<string, K[]> = {}
  for (const [r, ks] of Object.entries(runs)) out[r] = ks.map(([t, x, y]) => [Math.max(0, t - t0), x - ox, (y - oy) * sgn])
  return { set, runs: out, ...rest, ball: rest.ball.map(([t, w, k]) => [t - t0, w, k]) }
}

export const TRACKS: Record<string, Track[]> = {
  // THE LOOP, as the study's signature scrum move: 10 to 12, 10 round the
  // back of him and out again, the blind wing inserted, the full-back, and
  // the far wing on the touchline. The 13 holds his man with a straight line.
  mv_loop: [spec('scrum', [50, 15, 1, 0.6], {
    '10': [[0, 44, 22], [1.0, 44.5, 23], [1.4, 46, 26], [1.75, 44.4, 28.4], [2.05, 45.4, 31], [2.3, 47, 32.8], [2.6, 49, 35], [3.2, 52, 37]],
    '12': [[0, 43, 29], [1.0, 44.5, 29], [1.4, 46, 29], [2.2, 49, 29], [2.8, 51, 29.5]],
    FW: [[0, 41, 33], [1.4, 43.5, 34.5], [2.2, 46.5, 37], [2.6, 49.5, 40], [3.4, 53, 44], [4.0, 55, 46]],
    '13': [[0, 42, 40], [1.4, 45, 41], [2.2, 48, 41], [3.0, 51, 41]],
    '15': [[0, 38, 48], [1.4, 41.5, 48], [2.6, 48.5, 48], [3.0, 51.5, 49], [3.4, 55, 50.5], [4.2, 58, 54]],
    W: [[0, 42, 62], [1.4, 44, 62], [2.6, 48, 62], [3.4, 52.5, 62.5], [3.9, 56, 63], [4.4, 60, 64]],
  }, {
    ball: [[1.0, '10'], [1.4, '12', 'pop'], [2.15, '10', 'pop'], [2.5, 'FW'], [2.95, '15'], [3.5, 'W', 'miss']],
    strike: 'W', decoys: ['13'], bite: '15', late: 'FW', finish: 49,
  })],
  // THE SWITCH: 10 runs across, dragging his man and the 12's; 12 runs
  // straight to hold his; 13 cuts back underneath and they cross close to
  // the line.
  mv_switch: [spec('scrum', [42, 20, 1, 0.4], {
    '10': [[0, 36, 26], [0.8, 37, 27], [1.4, 38.5, 30], [2.0, 40, 33], [2.5, 41, 34.6], [3.0, 42.2, 36.2], [3.5, 44, 37.5]],
    '12': [[0, 35, 33], [1.2, 37, 35], [2.0, 40, 37], [2.8, 43, 38.5], [3.3, 45.5, 39]],
    '13': [[0, 34, 40], [1.2, 36, 40], [2.0, 39, 39.5], [2.5, 40.5, 37.8], [3.0, 42, 35.2], [3.4, 45, 32.5], [4.0, 50, 30]],
    '15': [[0, 30, 47], [2, 36, 46], [3.2, 40, 44]],
    W: [[0, 35, 60], [2, 39, 60], [3.4, 44, 60]],
    FW: [[0, 36, 13], [2, 39, 15], [3.4, 43, 17]],
  }, {
    ball: [[0.8, '10'], [2.9, '13', 'pop']],
    strike: '13', decoys: ['12'], bite: '10', finish: 18,
  })],
  // THE CRASH BALL: 12 on a short, hard line into the seam, drawing two, and
  // the tip-on to 13 on his shoulder at the moment of contact.
  mv_crash: [spec('lineout', [85, 15, 1, 0.8], {
    '10': [[0, 78, 22], [1.2, 79.5, 23], [1.6, 80.5, 24], [2.2, 82, 25.5], [3.0, 84, 26.5]],
    '12': [[0, 77, 28], [1.2, 78.6, 27.4], [1.6, 80.4, 26.8], [2.2, 84.4, 26], [2.7, 87.4, 25.5], [3.0, 88.2, 25.4]],
    '13': [[0, 76, 34], [1.4, 78, 32], [2.2, 82, 29.4], [2.7, 86, 27.8], [3.0, 88.6, 27.2], [3.5, 94, 27]],
    FW: [[0, 79, 19], [2, 82, 20], [3, 85, 21]],
    '15': [[0, 72, 32], [2, 77, 32], [3.3, 83, 31]],
    W: [[0, 76, 50], [2, 79, 50], [3.3, 84, 50]],
  }, {
    ball: [[1.2, '10'], [1.75, '12', 'pop'], [2.72, '13', 'pop']],
    strike: '13', decoys: [], bite: '12', finish: 12,
  })],
  // DECOY OUT THE BACK: 12 runs the hard flat line of a man about to get it,
  // and the ball goes behind him to 13 coming from depth.
  mv_decoy: [spec('scrum', [50, 15, 1, 0.6], {
    '10': [[0, 44, 22], [1.0, 44.5, 23], [1.5, 46.5, 25], [2.0, 48, 27], [2.4, 49, 28], [3.0, 51, 30]],
    '12': [[0, 45, 28], [1.0, 46, 28.5], [1.5, 48.6, 29.3], [2.0, 52.4, 30.3], [2.4, 55.6, 31], [2.8, 58.4, 31.5], [3.2, 60, 31.8]],
    '13': [[0, 40.5, 33], [1.0, 41.5, 33.2], [1.6, 44, 32.8], [2.0, 46.6, 32.6], [2.4, 49.6, 34], [2.8, 52.6, 36]],
    '15': [[0, 37, 44], [1.6, 41, 44], [2.4, 46, 45], [3, 50, 46.5]],
    W: [[0, 42, 60], [2, 46, 60], [3, 50, 60.5], [3.5, 53, 61]],
    FW: [[0, 44, 8], [2, 46, 12], [3, 48, 15]],
  }, {
    ball: [[1.0, '10'], [2.02, '13']],
    strike: '13', decoys: ['12'], bite: '12', late: '13', finish: 30,
  })],
  // THE BLINDSIDE WRAP: 8 picks and goes short, draws the flanker and pops
  // to 9, who draws the wing's man and gives it to the blind wing arriving
  // from deep on a steep line.
  mv_blind: [spec('scrum', [60, 55, 1, 0.5], {
    '8': [[0, 57.6, 55], [0.4, 57.8, 55.4], [0.9, 59.6, 57.8], [1.4, 61.6, 59.8], [1.8, 63, 60.8], [2.3, 64.4, 61.2]],
    '9': [[0, 57, 52.6], [0.5, 57.2, 55], [0.9, 58, 59.6], [1.4, 60.4, 61.8], [1.8, 62.2, 63], [2.3, 64, 64], [2.8, 65, 64.5]],
    W: [[0, 51, 63.5], [0.9, 53.5, 63.8], [1.8, 58, 64.6], [2.4, 62.5, 65.6], [2.8, 66, 66], [3.3, 70, 66.2]],
    '10': [[0, 52, 45], [2, 54, 46], [3, 56, 48]],
    '12': [[0, 50, 38], [2, 52, 39], [3, 54, 41]],
    '13': [[0, 48, 30], [2, 50, 32], [3, 52, 34]],
    '15': [[0, 45, 40], [2, 49, 44], [3, 52, 48]],
    FW: [[0, 47, 15], [2, 49, 17], [3, 51, 19]],
  }, {
    first: '8', ball: [[1.72, '9', 'pop'], [2.72, 'W']],
    strike: 'W', decoys: [], bite: '9', late: 'W', finish: 11.5,
  })],
  // THE INSIDE BALL: 10 runs out and his man goes with him; 12 cuts back
  // on a steep line inside him, into the hole they leave.
  mv_inside: [spec('scrum', [50, 15, 1, 0.6], {
    '10': [[0, 44, 22], [1.0, 44.5, 23], [1.6, 46.5, 27], [2.2, 48.5, 31], [2.6, 49.6, 33], [3.2, 51, 35]],
    '12': [[0, 42.5, 30], [1.0, 43.5, 31], [1.6, 45.4, 31], [2.0, 47, 29.6], [2.4, 49.6, 28], [2.8, 53, 27], [3.2, 56, 26.5]],
    '13': [[0, 42, 37], [1.6, 45, 39], [2.4, 48.5, 41], [3.0, 51, 42]],
    '15': [[0, 38, 45], [2, 43, 44], [3, 47, 43]],
    W: [[0, 42, 60], [2, 46, 60], [3, 49, 60]],
    FW: [[0, 41, 8], [2, 44, 12], [3, 47, 16]],
  }, {
    ball: [[1.0, '10'], [2.25, '12', 'pop']],
    strike: '12', decoys: ['13'], bite: '10', finish: 14,
  })],
  // 13 THROUGH THE MIDDLE: 10 to 12 flat, with 13 coming off 12's outside
  // shoulder on a hard inside line, the full-back out the back as the other
  // option; the man on 12 and the man on 13 both lean out.
  mv_strike13: [spec('scrum', [50, 15, 1, 0.5], {
    '10': [[0, 44, 21], [0.8, 45, 22], [1.2, 46, 23], [1.6, 47.5, 24.5], [2.2, 49, 26], [2.8, 50.5, 27]],
    '12': [[0, 43, 27], [1.2, 45.5, 27.5], [1.6, 47, 28], [2.2, 49.5, 28.6], [2.6, 51, 29], [3.0, 52.5, 29.4]],
    '13': [[0, 42, 34], [1.2, 45, 34], [1.8, 47.5, 32.6], [2.3, 50, 30.6], [2.7, 52.6, 29.6], [3.2, 57, 28.6]],
    '15': [[0, 38, 38], [1.4, 42, 38], [2.4, 47, 36], [3.0, 50, 35.5]],
    W: [[0, 42, 58], [2, 46, 58], [3, 50, 58]],
    FW: [[0, 42, 8], [2, 45, 11], [3, 48, 14]],
  }, {
    ball: [[0.8, '10'], [1.45, '12'], [2.45, '13', 'pop']],
    strike: '13', decoys: ['15'], bite: '12', finish: 14,
  })],
  // THE BACK DOOR: a flat pod of three in front, the 10 feeding it and 12
  // hidden behind it; the ball goes along the pod and out the back to 12.
  mv_backdoor: [spec('ruck', [50, 20, 1, 0.6], {
    '10': [[0, 44, 26], [0.8, 44.5, 26.5], [1.4, 46, 28], [2.2, 47.5, 30], [3.0, 49.5, 33]],
    '4': [[0, 47, 31], [1.4, 49, 31], [1.9, 50.4, 31.4], [2.4, 51.4, 31.8], [2.8, 51.8, 32]],
    '8': [[0, 47, 34], [1.4, 49, 34], [2.1, 51, 34.2], [2.5, 52, 34.5], [2.9, 52.4, 34.6]],
    '5': [[0, 47, 37], [1.4, 49, 37], [2.1, 51, 37.2], [2.5, 52, 37.5], [2.9, 52.4, 37.6]],
    '12': [[0, 42.5, 35], [1.4, 44.6, 35], [2.1, 46.8, 37], [2.4, 48.8, 38.8], [3.1, 53, 42]],
    '13': [[0, 41.5, 46], [2, 46.5, 47], [3.1, 50, 47.5], [3.9, 58, 48]],
    '15': [[0, 36, 40], [2, 41, 41], [3.2, 46, 43]],
    W: [[0, 42, 60], [2.4, 46, 60], [3.6, 50, 60]],
  }, {
    ball: [[0.8, '10'], [1.3, '4'], [1.72, '8', 'pop'], [2.22, '12']],
    strike: '12', decoys: ['5'], bite: '8', finish: 30,
  })],
  // 1-3-3-1 NEAR THE LINE: the pod runs at them, tips on inside the pod, and
  // the full-back takes it out the back of them.
  mv_1331: [spec('ruck', [55, 35, -1, 0.6], {
    '3': [[0, 52, 28], [1.0, 52.5, 27.6], [1.5, 53, 27.2], [2.1, 54, 26.6], [2.5, 54.6, 26.4]],
    '2': [[0, 52, 25], [1.5, 53, 24.8], [2.1, 54, 25], [2.5, 55, 25]],
    '1': [[0, 51.5, 31], [1.5, 52.5, 30.5], [2.1, 53.5, 30], [2.5, 54, 29.6]],
    '15': [[0, 48.5, 26], [1.5, 49.6, 24.6], [2.1, 51, 23], [2.5, 53, 21], [3.2, 56, 17.5], [3.8, 58, 15.5]],
    '10': [[0, 49, 32], [2, 51, 30], [3, 53, 27]],
    W: [[0, 50, 10], [2.5, 52, 10], [3.8, 56, 9], [4.3, 58, 8.5]],
  }, {
    ball: [[1.3, '3'], [2.02, '2', 'pop'], [2.45, '15']],
    strike: '15', decoys: ['1'], bite: '2', finish: 27,
  })],
  // 2-4-2: the 10 loops a forward pod and the full-back comes in on the angle.
  mv_242: [spec('ruck', [55, 55, -1, 0.5], {
    '10': [[0, 50, 48], [0.4, 50.5, 47.5], [1.4, 51.5, 45.5], [1.85, 52.2, 44.2], [2.1, 52.4, 42.2], [2.35, 54, 40], [2.6, 56, 38.2], [3.2, 58, 36.5]],
    '4': [[0, 52, 41], [1.4, 53.5, 41.5], [1.9, 55, 42], [2.5, 57, 42]],
    '5': [[0, 52, 44], [1.4, 53.5, 44.2], [1.9, 55, 44.4], [2.5, 56.5, 44.6]],
    '15': [[0, 46, 30], [1.9, 50, 31], [3.0, 55, 33], [3.6, 58, 33], [4.3, 63, 32]],
    W: [[0, 48, 12], [3, 52, 13], [4.5, 60, 14]],
    '12': [[0, 47, 38], [2, 51, 37], [3.2, 55, 36]],
  }, {
    ball: [[0.9, '10'], [1.85, '4', 'pop'], [2.3, '10', 'pop'], [3.3, '15']],
    strike: '15', decoys: ['5'], bite: '10', late: '15', finish: 42,
  })],

  // ---- THE NEW FAMILIES (1.8.2), from the same study ------------------------
  // THE BLIND WING IN: the wing on the short side of the scrum comes across
  // behind a flat 10 and hits the seam between their 10 and 12 at pace, the
  // 12 running the decoy line that holds his man.
  mv_wingin: [spec('scrum', [50, 15, 1, 0.6], {
    '10': [[0, 44, 22], [1.0, 45, 22.6], [1.6, 46.8, 23.6], [2.1, 48.4, 24.8], [2.6, 49.6, 26.4]],
    FW: [[0, 41, 14], [1.0, 42, 16], [1.6, 44, 19.5], [2.2, 46.4, 22.8], [2.5, 48, 24.2], [3.0, 53, 25.5], [3.6, 59, 26.5]],
    '12': [[0, 43, 30], [1.0, 44.8, 30.4], [1.8, 47.6, 31.4], [2.4, 50.2, 32.2], [3, 52.5, 33]],
    '13': [[0, 42, 38], [1.0, 44.5, 38.6], [2.0, 47.5, 39.6], [3, 50.5, 40.5]],
    '15': [[0, 38, 42], [2, 43.5, 40], [3.2, 50, 36], [3.8, 55, 34]],
    W: [[0, 42, 60], [2, 46, 60], [3, 50, 60]],
  }, { ball: [[1.0, '10'], [2.25, 'FW', 'pop']], strike: 'FW', decoys: ['12'], bite: '12', late: 'FW', finish: 15 })],
  // THE FULL-BACK INTO THE LINE: draw-and-give passes along a flat line, the
  // 15 arriving from depth outside the 13 at full pace, and the ball on to
  // the wing on the far touch.
  mv_width: [spec('scrum', [50, 15, 1, 0.6], {
    '10': [[0, 44, 22], [1.0, 45, 23], [1.6, 46.5, 26], [2.2, 47.5, 28]],
    '12': [[0, 43, 29], [1.4, 45, 30], [2.0, 47, 31], [2.6, 48.5, 32]],
    '13': [[0, 42, 37], [1.6, 45, 38], [2.2, 47.4, 39], [2.8, 49.5, 40.5], [3.4, 51.5, 42]],
    '15': [[0, 36, 32], [1.4, 40.5, 35], [2.2, 45, 39.5], [2.8, 49.5, 44], [3.3, 53, 47]],
    W: [[0, 42, 62], [2, 46, 62], [3.2, 52, 63], [3.8, 56, 64]],
    FW: [[0, 44, 8], [2, 46, 12]],
  }, { ball: [[1.0, '10'], [1.55, '12'], [2.2, '13', 'pop'], [2.75, '15'], [3.35, 'W', 'miss']], strike: 'W', decoys: ['13'], bite: '13', late: '15', finish: 49 })],
  // THE TAP PENALTY SWITCH, ten metres out: the 9 taps, the pod in front of
  // him shapes to drive (a decoy), the ball goes to the other pod and round
  // the corner of it along the line to the wing.
  mv_tap: [spec('tap', [90, 35, 1, 0.3], {
    '9': [[0, 90, 35], [0.6, 90.5, 35], [1.0, 91, 35.5]],
    '1': [[0, 91.5, 30], [0.8, 93, 30], [1.4, 95, 30.5]], '2': [[0, 91.5, 32], [0.8, 93, 32], [1.4, 95, 32]], '3': [[0, 91.5, 34], [0.8, 93, 34], [1.4, 95, 33.5]],
    '4': [[0, 90, 40], [0.8, 91, 40], [1.3, 92, 40.5]], '5': [[0, 90, 42], [0.8, 91, 42], [1.3, 92.5, 42.5]], '8': [[0, 89.5, 44], [1.0, 91, 44.5], [1.6, 93, 45]],
    '10': [[0, 86, 44], [1.0, 88, 45], [1.6, 90.5, 47]],
    '12': [[0, 85, 48], [1.4, 88, 49], [2.0, 90.5, 50]],
    '13': [[0, 84, 53.5], [1.4, 88, 54.5], [2.0, 91.5, 55.5]],
    W: [[0, 84, 62], [2.0, 90, 63], [2.6, 94, 64]],
  }, { first: '9', ball: [[0.8, '4', 'pop'], [1.2, '10'], [1.9, '13'], [2.5, 'W']], strike: 'W', decoys: ['1', '2', '3'], finish: 29 })],
  // THE LINEOUT PEEL: the maul sets at the tail, the hooker comes round the
  // back of it from his throw and takes it off the 9, runs across, and the
  // blind wing cuts back on his shoulder in the seam off the maul.
  mv_peel: [spec('lineout', [70, 10, 1, 0], {
    '2': [[0, 70.5, 1], [0.5, 68.6, 3.4], [1.0, 67.2, 7.8], [1.35, 67.6, 11], [1.8, 69, 13.8], [2.4, 70.8, 16.4], [2.9, 72.2, 18.4]],
    FW: [[0, 62, 12], [0.8, 63, 12.4], [1.5, 65.4, 13.6], [2.1, 68.2, 15.2], [2.55, 70.8, 16], [3.1, 75, 16.2], [3.7, 80, 16]],
    '10': [[0, 64, 22], [1.5, 66, 23], [2.6, 68.5, 24.5], [3.4, 71, 26]],
    '12': [[0, 63, 29], [1.5, 65, 30], [2.6, 67.5, 31], [3.4, 70, 32]],
    '13': [[0, 62, 36], [2, 65.5, 37], [3.4, 69, 38]],
    '15': [[0, 57, 32], [2, 61, 30], [3.4, 66, 27]],
    W: [[0, 61, 55], [2, 64, 55], [3.4, 67, 55]],
  }, { ball: [[1.3, '2', 'pop'], [2.45, 'FW']], strike: 'FW', decoys: ['10'], bite: '2', late: 'FW', finish: 7 })],
  // THE MAUL SWITCH, seven metres out: the lineout stands in two pods; the
  // throw goes to the front one while they compete at the back, the back pod
  // runs round to bind on, and the maul drives up the touchline with the
  // hooker at the back of it to ground it.
  mv_maulswitch: [spec('lineout', [93, 10, 1, 0], {
    '2': [[0, 93, 0.8], [0.5, 91.8, 3], [1.0, 91.3, 6.6], [1.6, 92.4, 7.8], [2.6, 94.4, 7.9], [3.6, 96.6, 7.8], [4.5, 98.6, 7.6]],
    '1': [[0, 92.5, 5.8], [1.2, 93.1, 6.3], [2.2, 94.4, 6.6], [3.2, 96.4, 6.8], [4.4, 99.2, 6.8]],
    '4': [[0, 92.5, 7], [1.2, 93.6, 7.4], [2.2, 94.8, 7.6], [3.2, 96.8, 7.6], [4.4, 99.6, 7.6]],
    '3': [[0, 92.5, 8.2], [1.2, 93.2, 8.5], [2.2, 94.4, 8.6], [3.2, 96.4, 8.6], [4.4, 99.2, 8.6]],
    '6': [[0, 92.5, 11.2], [0.5, 92.5, 11.2], [1.3, 92.9, 9.9], [2.2, 94, 9.7], [3.2, 95.9, 9.6], [4.4, 98.7, 9.6]],
    '5': [[0, 92.5, 12.4], [0.6, 92.4, 12.3], [1.4, 92.6, 10.8], [2.3, 93.6, 10.6], [3.2, 95.4, 10.4], [4.4, 98.2, 10.4]],
    '8': [[0, 92.5, 13.6], [0.7, 92.3, 13.4], [1.5, 92.4, 11.8], [2.4, 93.3, 11.4], [3.2, 95, 11.2], [4.4, 97.8, 11.2]],
    '7': [[0, 92.5, 14.8], [0.8, 92.2, 14.4], [1.6, 92.2, 12.6], [2.5, 93, 12.2], [3.2, 94.6, 12], [4.4, 97.4, 12]],
    // (the backs ten metres back, spread as the threat that holds theirs)
    '10': [[0, 81.5, 17], [2, 83, 18], [3.2, 84.5, 18.5]], '12': [[0, 81, 24], [2, 82.5, 25], [3.2, 84, 25.5]],
    '13': [[0, 80.5, 31], [2, 82, 32], [3.2, 83.5, 32.5]], '15': [[0, 76, 30], [2, 78, 29], [3.2, 80, 28]],
    W: [[0, 80, 45], [2, 82, 45], [3.2, 83.5, 45]], FW: [[0, 82, 4], [2, 83, 4.5], [3.2, 84, 5]],
  }, { ball: [[1.05, '4', 'pop'], [4.2, '2', 'pop']], strike: '2', decoys: ['6', '5'], finish: -3 })],
  // CRASH THEN SWING: phase one, the 12 on a flat crash line into the
  // 10-12 channel and down; phase two, the 9 picks it
  // off the quick ruck and the ball goes along the line to the open edge,
  // the blind wing having tracked across behind it all to take the last pass.
  mv_crashswing: [spec('lineout', [50, 58, -1, 0], {
    '9': [[0, 48, 58], [0.6, 48.5, 57], [1.6, 50.5, 50.5], [2.2, 51.4, 48], [2.6, 51, 47.6], [3.2, 51.5, 46]],
    '10': [[0, 44, 52], [0.4, 44.5, 51.5], [0.9, 46, 50], [1.6, 46, 46], [2.4, 47, 41.5], [2.9, 48.5, 39.5], [3.4, 50, 38]],
    '12': [[0, 43, 46], [0.5, 44, 46], [0.9, 46, 46], [1.3, 49, 46], [1.6, 51.4, 46], [2.8, 52, 46]],
    FW: [[0, 45, 55], [0.8, 46, 53], [1.4, 47.5, 48], [2.2, 47, 40], [3.2, 47.5, 30], [4.0, 48.5, 25.5], [4.6, 49.8, 22.8], [5.1, 52, 20], [5.6, 56, 17.5], [6.2, 61, 15.5]],
    '13': [[0, 42, 36], [1.6, 44, 35], [2.8, 46, 33], [3.4, 49, 32], [3.9, 51.5, 31]],
    '15': [[0, 38, 30], [2.0, 41, 29], [3.4, 44, 27], [4.0, 48, 25], [4.5, 51.5, 23.5]],
    W: [[0, 42, 10], [3, 45, 11], [4.5, 49, 11], [5.5, 53, 11]],
  }, {
    ball: [[0.4, '10'], [0.95, '12', 'pop'], [2.5, '9', 'pop'], [2.95, '10'], [3.5, '13'], [4.0, '15'], [4.6, 'FW']],
    strike: 'FW', decoys: ['13'], bite: '15', late: 'FW', finish: 43,
  })],
  // THE LOOP BY THE 9: the 10 takes it and runs straight at the fringe with
  // the 13 on a decoy line outside, and the 9, who followed his pass round
  // the back, takes the tip outside the 10 where the fringe defender should be.
  mv_loop9: [spec('scrum', [50, 15, 1, 0], {
    '9': [[0, 48, 15], [0.4, 47.8, 16.5], [0.9, 46.6, 19.5], [1.3, 47, 22.5], [1.7, 48.4, 24.6], [2.1, 51, 27], [2.6, 55, 29.5], [3.0, 58, 32]],
    '10': [[0, 44, 22], [0.4, 44.5, 22], [0.9, 46.5, 22.5], [1.4, 48.5, 23], [1.8, 49.8, 23.2], [2.2, 50.5, 23.5]],
    '13': [[0, 42, 38], [1.0, 45, 38], [1.8, 48.5, 37.5], [2.6, 51, 37]],
    '12': [[0, 43, 30], [1.2, 46, 30], [2.2, 49, 30.5], [3.0, 51.5, 31]],
    W: [[0, 42, 60], [1.6, 45, 56], [2.6, 50, 48], [3.2, 54, 42], [3.8, 58, 39]],
    '15': [[0, 38, 45], [2, 43, 44], [3.2, 48, 43]],
    FW: [[0, 44, 8], [2, 46, 10], [3, 48, 12]],
  }, { ball: [[0.4, '10'], [1.75, '9', 'pop']], strike: '9', decoys: ['13'], bite: '10', late: '9', finish: 26 })],
  // THE CROSS-FIELD KICK: a flat line off the lineout draws them up, and the
  // 10 puts it across to the far wing, who has stayed wide and runs onto it.
  mv_crosskick: [spec('lineout', [70, 15, 1, 0], {
    '10': [[0, 64, 21], [0.5, 64.5, 21.5], [0.9, 65.5, 22.5], [1.3, 66.5, 23.5]],
    '12': [[0, 63.5, 28], [1, 66, 29], [2, 69, 30]],
    '13': [[0, 63, 35], [1, 65.5, 36], [2, 68, 37]],
    '15': [[0, 60, 40], [1.5, 63, 44]],
    W: [[0, 62, 62], [1, 65, 62], [2, 69, 62.5]],
    FW: [[0, 64, 8], [1.5, 66, 9]],
  }, { ball: [[0.35, '10']], strike: '10', chase: 'W', decoys: ['12'], finish: 48 })],
  // THE GRUBBER THROUGH: the 10 flat, their line rushing him, and the ball
  // rolled through the gap between their 10 and 12 for the centres to chase.
  mv_grubber: [spec('scrum', [50, 15, 1, 0.6], {
    '10': [[0, 44, 22], [1.0, 44.6, 22.2], [1.4, 45.8, 22.8], [1.8, 47, 23.4]],
    '12': [[0, 43, 29], [1.4, 45.5, 29], [2.0, 49, 28.5], [2.6, 53, 28]],
    '13': [[0, 42, 37], [1.4, 44.5, 36.5], [2.0, 48, 35], [2.6, 52, 33]],
    '15': [[0, 38, 42], [2, 42, 40]],
    W: [[0, 42, 60], [2, 46, 60]],
    FW: [[0, 44, 8], [2, 46, 10]],
  }, { ball: [[1.0, '10']], strike: '10', chase: '12', decoys: ['13'], finish: 14 })],
}

/** the tracks a clip may play */
export function tracksFor(move: string): Track[] | undefined {
  return TRACKS[move]
}

/** a man's line at time t: through his keyframes on a smooth curve
 *  (Catmull-Rom), standing still before the first and after the last */
export function trackAt(ks: K[], t: number): [number, number] {
  if (t <= ks[0][0]) return [ks[0][1], ks[0][2]]
  const n = ks.length
  if (t >= ks[n - 1][0]) return [ks[n - 1][1], ks[n - 1][2]]
  let i = 0
  while (i < n - 2 && t > ks[i + 1][0]) i++
  const p0 = ks[Math.max(0, i - 1)], p1 = ks[i], p2 = ks[i + 1], p3 = ks[Math.min(n - 1, i + 2)]
  const u = (t - p1[0]) / Math.max(1e-6, p2[0] - p1[0])
  // tangents by time (a long pause and a sprint are not smoothed alike)
  const T = Math.max(1e-6, p2[0] - p1[0])
  const h = (j: 1 | 2) => {
    const d1 = i === 0 ? (p2[j] - p1[j]) / T : (p2[j] - p0[j]) / Math.max(1e-6, p2[0] - p0[0])
    const d2 = i + 2 >= n ? (p2[j] - p1[j]) / T : (p3[j] - p1[j]) / Math.max(1e-6, p3[0] - p1[0])
    const u2 = u * u, u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * p1[j] + (u3 - 2 * u2 + u) * d1 * T + (-2 * u3 + 3 * u2) * p2[j] + (u3 - u2) * d2 * T
  }
  return [h(1), h(2)]
}
