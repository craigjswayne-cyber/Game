// THE PITCH PLAYS THE RECORD (2.0.0 rebuild, animation).
//
// Owner, 20 November 2026: "There is still no connection with players,
// commentary & graphics." The stadium pitch used to GUESS the play from the
// old engine's commentary (script.ts turned lines into beats, sim.ts steered
// thirty men at them), and he saw what guessing gives: a knock-on with no man
// near the ball, a carrier running sideways and back, the ball flying back.
// The new engine writes one record of the match (src/game/sim/record.ts,
// Play[]). This file turns that record, and nothing else, into the picture:
// where the ball is and who has it come only from the record (x, y, ball,
// who); the men round it are placed so they cannot contradict it.
//
// ---- WHAT MAKES THE 1.9.16 HIGHLIGHT CLIPS MOVE WELL (read from
// src/ui/highlight/bake.ts, plays.ts, geometry.ts, clipPlays.ts) ----
//
//  1. BAKED, THEN READ BACK. A clip is simulated once at 60 steps a second
//     and stored; a frame is a pure function of the clock (frameAt). Nothing
//     is decided while it plays, so a late frame is just the right picture a
//     little later, and a probe can measure every frame.
//  2. BODIES WITH LEGS. Every man is a body with a velocity, steered at a
//     target by "arrive": wanted speed = min(vmax, distance x 2.4), the change
//     of velocity x 8 capped at 16 m/s2. He eases into his spot, he turns in a
//     curve, he never snaps. Top speeds: a back sprints 9.3 m/s, a forward
//     7.4; getting into shape without the ball 8.0 and 6.2; a defensive line
//     shifting across 7.5; nobody over 12.8 even when quick.
//  3. THE BALL IS SCRIPTED, THE MEN ARE NOT. The ball sits on the ruck spot,
//     is passed along a smoothstep curve to where the receiver IS (the end of
//     the flight follows him), flies a kick on a smoothstep with a sine for
//     its height, and in hand is held a hand's width in front of the man. A
//     pass takes distance / 17 s (0.3 to 0.95 s), never faster than 22 m/s on
//     average; a man holds it 0.25 s before he moves it on.
//  4. THE RUN HAS A SHAPE. A carry is a run along a gentle curve with an
//     acceleration phase, a steady pace and a slowing into contact (runK, 0.4 s
//     either end), at 9.5 m/s for a back and 7.5 for a forward; a man who takes
//     it at pace carries on at pace. The carrier is placed on that curve each
//     frame and so is the ball; everyone else steers.
//  5. SHAPES BY POSITION, RELATIVE TO THE BALL. The attack stands in a table
//     of [metres behind, metres across] by shirt (ATT), the backs spread to
//     the open side; the defence in [metres in front, metres across] (DEF),
//     the back three by the system (pendulum: near wing up, full-back behind
//     him, far wing deep). Targets follow the ball, so the team flows after it.
//  6. THE LINE PRESSES. After the ball is out the defence comes up at its
//     line speed (3.6 m/s for 1.2 s, then 1.4) and never through the man; the
//     tackler is sent at where the carrier will be and meets him there.
//  7. NOBODY INSIDE ANYBODY. A soft push apart (1.3 m room) every frame, never
//     more than a walk, never for men in contact or the man with the ball.
//  8. THE TIMES ARE SHORT. A ruck 0.45 s, the 9 digging 0.35 s, a pass under
//     a second: at life speed the clip never waits, and it reads.
//
// This file does the same over a whole match: one bake of every play in the
// record (30 steps a second), every man a body with the clips' steering and
// a top speed of 9.4 m/s, the ball scripted from the record's x, y, ball and
// who, and the clips' shape tables (imported, not copied) for everybody the
// record does not name. Between plays nobody is moved: they run.
//
// ---- TIME ----
// The bake has its own clock ("anim seconds": every speed above is in them).
// Each play takes at least the time the plan gives it (worked out from the
// record) and longer when the man the record names has further to run: the
// bake waits for him rather than move him faster than a man can run.
// `schedule(plays, sides)` then says how fast each play is shown so an
// Extended match lasts about four minutes: key moments at life speed, the
// ordinary phases wound on, the walking between them wound on harder. The
// commentary reads the same schedule, so words and picture keep in step.
import type { Play } from '../../game/sim/record'
import { defenceShape } from '../clipPlays'
import { ATT, DEF, LINEOUT_ORDER, LINEOUT_Y, SCRUM_FORM, backAcross, openSide } from '../highlight/plays'
import { newPoses, posesAt } from './pose'

export type Pt = { x: number; y: number }
type Side = 0 | 1

/** steps a second of the bake (and of the stored frames) */
export const FPS = 30
const DT = 1 / FPS
/** nobody runs faster than this (m/s), whatever he is asked to do */
export const V_CAP = 10.4
/** a ball in the air or in hand is never faster than this (m/s) */
export const BALL_CAP = 40
const A_PLAYER = 16
/** personal space: closer than this two men are eased apart (a lineout stands 1.2 m apart and is left alone) */
const ROOM_M = 1.15
const V_JOG = 7
const DS = defenceShape(undefined)

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const smooth = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
const hyp = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
/** the way side s attacks: side 0 (home) towards x = 100 */
const dirOf = (s: Side) => (s === 0 ? 1 : -1)
const other = (s: Side): Side => (s === 0 ? 1 : 0)
/** the try line side s attacks */
const lineOf = (s: Side) => (s === 0 ? 100 : 0)
/** a man's whole dot on the grass (or a little over the touchline when he is put out there) */
const fx = (x: number) => clamp(x, -12, 112)
const fy = (y: number) => clamp(y, -1.5, 71.5)
const inY = (y: number) => clamp(y, 1, 69)
/** the in-goal's depth (LivePitch draws the dead-ball line here) */
export const IN_GOAL = 8
/** the point `by` metres on past P along the line from A through P: a ball aimed at P crosses there and goes on */
const pastLine = (A: Pt, P: Pt, by: number): Pt => { const dx = P.x - A.x, dy = P.y - A.y, l = Math.hypot(dx, dy) || 1; return { x: P.x + dx / l * by, y: P.y + dy / l * by } }
/** a point on the touchline taken just over it: a ball that goes into touch is seen to cross the line */
const overTouch = (y: number, by = 1.5) => (y <= 0.5 ? -by : y >= 69.5 ? 70 + by : y)
/** slot 0..29: home shirts 1..15 then away */
const slot = (s: Side, shirt: number) => s * 15 + shirt - 1
const sideOfSlot = (i: number): Side => (i < 15 ? 0 : 1)

/** a run off the mark (or already going, at share a0 of his pace), a steady
 *  pace, and slowing into contact: the clips' runK */
function runK(t: number, T: number, ta: number, a0 = 0): number {
  if (t <= 0) return 0
  if (t >= T) return 1
  ta = Math.min(ta, T / 2.2)
  const v = 1 / (T - ta + a0 * ta / 2)
  if (t < ta) return v * (a0 * t + (1 - a0) * t * t / (2 * ta))
  if (t > T - ta) return 1 - 0.5 * v * (T - t) * (T - t) / ta
  return v * (ta * (1 + a0) / 2 + (t - ta))
}

// =====================================================================
// THE PLAN: how long each play takes in the bake, from the record alone
// =====================================================================

/** where a play leaves the ball, as the record has it */
const spot = (p: Play): Pt => ({ x: p.x, y: p.y })
/** where a penalty goal is kicked from: the mark, or 5 m out when the mark is on the line (the law) */
const goalSpot = (p: Play): Pt => (Math.abs(lineOf(p.side) - p.x) < 5 ? { x: lineOf(p.side) - dirOf(p.side) * 5, y: p.y } : spot(p))

/** the record's restart and stoppage entries that stop play: the next play is a set piece */
const SET_NEXT = new Set(['scrum', 'lineout', 'kickoff', 'dropout22', 'goalLineDropout', 'conversion', 'penaltyGoal'])

export interface CarryGeo {
  A: Pt; B: Pt; R: Pt; dir: number; wide: boolean; gain: number
  pick: number; passes: number; passT: number; runT: number; spill: number
  fwdPass: boolean; brk: boolean; self: boolean
}

/** THE CARRY, from the record: the ball was at A (the last play's spot), he
 *  is tackled (or goes over) at B. He takes it standing deep enough behind A
 *  that every pass to him goes backwards and his run to B goes forwards,
 *  however little the record says he gained. A wide carry comes along a
 *  chain of passes, none longer than about twelve metres. */
export function carryGeo(plays: Play[], n: number): CarryGeo {
  const p = plays[n], q = plays[n - 1] ?? p
  const dir = dirOf(p.side)
  const A = spot(q)
  const brk = p.kind === 'lineBreak'
  const over = p.result === 'overTheLine' || (brk && (p.result === 'clean' || p.result === 'interception'))
  let B = spot(p)
  if (over) B = { x: lineOf(p.side) + dir * 1.0, y: inY(p.y) }
  const fwdPass = p.result === 'forwardPass'
  const icept = p.result === 'intercepted'
  // the man who has the ball already carrying it on (the catcher of a kick, the jackal, the interceptor): no pass
  // (but a forward pass is thrown by somebody to somebody: when the record names the man who had it, he is the passer)
  const self = !!p.who && heldBy(q) === p.who && p.result !== 'forwardPass'
  const dy = Math.abs(B.y - A.y)
  const wide = dy > 8 || brk
  const depth = wide ? 5 : 2.5
  const gain = (B.x - A.x) * dir
  // how many hands it goes through: the record's count when it gives one (0: he picks it from the base himself)
  const passes = self ? 0 : p.passes != null ? Math.min(3, p.passes) : Math.min(3, 1 + Math.floor(Math.max(0, dy - 6) / 11))
  let R: Pt
  if (self) R = { ...A }
  else if (passes === 0) R = { x: A.x - dir * 0.6, y: A.y }
  else if (fwdPass) R = { x: A.x + dir * 1.6, y: B.y }
  else if (icept) R = { ...B }
  else R = { x: gain + depth >= 1.5 ? A.x - dir * depth : B.x - dir * 1.5, y: inY(B.y - (B.y - A.y) * 0.12) }
  const passT = passes ? clamp((dy / passes + 2) / 15, 0.3, 0.85) + 0.15 : 0
  const pick = self ? 0.1 : q.kind === 'ruck' ? 0.45 : q.kind === 'lineout' ? 0.75 : q.kind === 'maul' ? 0.55 : q.kind === 'scrum' ? 0.25 : 0.2
  const len = hyp(R, B)
  const v = brk ? 8.4 : wide ? 7.2 : 6.0
  const runT = fwdPass || icept ? 0 : Math.max(0.9, len / v + 0.35)
  const spill = p.result === 'knockedOn' ? 0.45 : fwdPass || icept ? 0.45 : 0
  return { A, B, R, dir, wide, gain, pick, passes, passT, runT, spill, fwdPass, brk, self }
}

/** the man the record leaves holding the ball at the end of a play, when it names him */
function heldBy(q: Play): string | undefined {
  if (q.kind === 'catch') return q.who
  if (q.kind === 'ruck' && q.result === 'turnover') return q.vs?.[0]
  if (q.kind === 'carry' && q.result === 'intercepted') return q.vs?.[0]
  if (q.kind === 'lineout') return q.result === 'stolen' ? q.vs?.[0] : q.with?.[0]
  if (q.kind === 'offload') return q.with?.[0]
  if (q.kind === 'lineBreak' || q.kind === 'carry') return q.who
  return undefined
}

const KICK_HANG = (type: string | undefined, dist: number) =>
  type === 'box' ? 2.9 : type === 'upAndUnder' ? 3.3 : type === 'grubber' ? 0.6 + dist / 15
    : type === 'long' ? 2.2 + dist / 30 : type === 'restart' ? 2.6 + dist / 40 : 1.9 + dist / 35

export interface KickGeo { A: Pt; L: Pt; pre: number; hang: number; dir: number; fromHand: boolean }
export function kickGeo(plays: Play[], n: number): KickGeo {
  const p = plays[n], q = plays[n - 1] ?? p
  const A = spot(q), dir = dirOf(p.side)
  let L = spot(p)
  // (round 6: the record says where it truly came down: `out`, past the line, for a kick into touch or
  // out on the full; `land` otherwise, which for a kick that runs dead is in the in-goal)
  if (p.out && p.result === 'outOnFull') L = { x: p.out[0], y: p.out[1] }
  // (into touch: over the line at the record's spot and on as far as `out` is past it, along its flight)
  else if (p.out && (p.y <= 0.5 || p.y >= 69.5)) L = pastLine(A, spot(p), Math.max(0.8, hyp(spot(p), { x: p.out[0], y: p.out[1] })))
  else if (p.land) L = { x: p.land[0], y: p.land[1] }
  else if (p.result === 'outOnFull') L = { x: A.x + dir * 18, y: overTouch(p.y, 1.8) }
  // (to touch: it lands over the touchline, not on it)
  else if (p.y <= 0.5 || p.y >= 69.5) L = pastLine(A, L, 1.5)
  const fromMark = q.kind === 'penalty' || q.kind === 'freeKick'
  const pre = fromMark ? 0.8 : p.kick === 'box' ? 0.55 : q.kind === 'catch' && q.who === p.who ? 0.5 : q.kind === 'catch' ? 1.0 : 1.4
  const hang = p.result === 'chargedDown' ? 0.15 : KICK_HANG(p.result === 'penaltyToTouch' ? 'touch' : p.kick, hyp(A, L))
  return { A, L, pre, hang, dir, fromHand: !fromMark }
}

/** the next play that is an action, past any card shown on the way */
function nextAction(plays: Play[], n: number): Play | undefined {
  for (let k = n + 1; k < plays.length; k++) if (plays[k].kind !== 'yellowCard' && plays[k].kind !== 'redCard') return plays[k]
  return undefined
}

export interface Seg {
  n: number
  /** anim seconds: the play's action starts at a0, its dead time (walking to the next set piece) at a0 + act, it ends at a1 */
  a0: number; act: number; dead: number; a1: number
  /** the anim moment the ball is where the record puts it */
  mark: number
  /** 2 a key moment (life speed), 1 the lead-in to one, 0 ordinary */
  key: 0 | 1 | 2
  /** the ball is in play during the action */
  live: boolean
  /** a routine phase not shown in full: the picture travels through it (condense()) */
  condensed?: boolean
  /** a routine kick (between the 22s, caught, nothing key after it): shown quickly, nobody sprinting */
  quick?: boolean
}

const LIVE = new Set(['offload', 'kickoff', 'dropout22', 'goalLineDropout', 'carry', 'ruck', 'maul', 'lineBreak', 'kick', 'catch', 'scrum', 'lineout', 'tap'])

function actOf(plays: Play[], n: number): { act: number; mark: number } {
  const p = plays[n]
  switch (p.kind) {
    case 'offload': return { act: 0.6, mark: 0.6 }
    case 'carry': case 'lineBreak': {
      const g = carryGeo(plays, n)
      const act = g.pick + g.passes * g.passT + g.runT + g.spill
      return { act, mark: act }
    }
    case 'ruck': {
      const nx = plays[n + 1]
      const wideNext = nx && (nx.kind === 'carry' || nx.kind === 'lineBreak') ? Math.abs(nx.y - p.y) : 0
      const act = (p.result === 'turnover' ? 1.4 : 0.6) + Math.min(1.0, wideNext / 18)
      return { act, mark: act }
    }
    case 'kick': { const g = kickGeo(plays, n); return { act: g.pre + g.hang, mark: p.result === 'chargedDown' ? g.pre : g.pre + g.hang } }
    case 'catch': {
      const q = plays[n - 1]
      const act = q?.result === 'chargedDown' ? 0.3 + clamp(hyp(spot(q), spot(p)) / 10, 0.5, 1.1) : 0.5
      return { act, mark: act }
    }
    case 'kickoff': case 'dropout22': case 'goalLineDropout': {
      const from = p.kind === 'kickoff' ? 50 : p.kind === 'dropout22' ? (p.side === 0 ? 22 : 78) : (p.side === 0 ? 0 : 100)
      const act = 0.8 + KICK_HANG('restart', Math.abs(p.x - from))
      return { act, mark: act }
    }
    case 'scrum': return { act: p.result === 'won' || p.result === 'againstTheHead' ? 2.2 : 1.8, mark: p.result === 'won' || p.result === 'againstTheHead' ? 2.2 : 1.0 }
    case 'lineout': return p.result === 'won' || p.result === 'stolen' ? { act: 2.0, mark: 2.0 } : { act: 1.6, mark: 0.4 }
    case 'maul': { const act = 1.0 + Math.abs(p.gain ?? 0) / 1.4; return { act, mark: act } }
    case 'penalty': case 'freeKick': return { act: 1.2, mark: 1.2 }
    case 'tap': return { act: 0.6, mark: 0.6 }
    case 'penaltyGoal': case 'conversion': {
      const d = Math.abs(lineOf(p.side) - p.x) + (p.kind === 'conversion' ? 16 : 0)
      return { act: 0.8 + 0.6 + d / 24 + 0.6, mark: 0.8 }
    }
    case 'dropGoal': return { act: 1.3 + 0.6 + Math.abs(lineOf(p.side) - p.x) / 24 + 1.0, mark: 1.3 }
    case 'try': return { act: 1.9, mark: 0.6 }
    case 'penaltyTry': return { act: 2.6, mark: 2.6 }
    case 'heldUp': return { act: 1.8, mark: 0.4 }
    case 'deadBall': return { act: 0.8, mark: 0.8 }
    case 'intoTouch': return p.result === 'bounced' ? { act: 0.3 + Math.abs(p.y - (plays[n - 1]?.y ?? p.y)) / 8, mark: 0.3 + Math.abs(p.y - (plays[n - 1]?.y ?? p.y)) / 8 } : { act: 0.4, mark: 0.4 }
    case 'knockOn': return plays[n - 1]?.kind === 'carry' ? { act: 0.4, mark: 0.4 } : { act: 0.6, mark: 0.6 }
    case 'yellowCard': case 'redCard': return { act: 2.6, mark: 2.6 }
    // (round 10, COMMENTARY: the half-time and full-time summaries and the second-half talk line went by in
    // 2.5 s of fast forward; held 4 s, at clip pace as key moments, so they can be read)
    case 'halfTime': return { act: 4.0, mark: 4.0 }
    case 'fullTime': return { act: 4.0, mark: 4.0 }
    default: return { act: 0.5, mark: 0.5 }
  }
}

/** THE FADES THE OWNER ALLOWS (20 Nov 2026): "Fades only for lineouts, conversions, kicks at
 *  goal, after half-time." Before these the picture dissolves to the set piece formed, instead
 *  of everybody walking there. Scrums, kick-offs and 22s are still formed up on screen. */
export function fadesIn(plays: Play[], n: number): boolean {
  const p = plays[n]
  if (!p) return false
  if ((p.kind === 'lineout' && p.result !== 'quick') || p.kind === 'conversion' || p.kind === 'penaltyGoal') return true
  return p.kind === 'kickoff' && plays[n - 1]?.kind === 'halfTime'
}

/** the walk between a stoppage and the set piece after it (anim seconds) */
function deadOf(plays: Play[], n: number): number {
  const p = plays[n], nx = nextAction(plays, n)
  if (!nx) return 0
  // (a fade is coming: a moment's pause, then the dissolve)
  if (nx && fadesIn(plays, nx.n)) return 0.8
  if (p.kind === 'halfTime') return 9
  if (p.kind === 'try') return 7
  if (p.kind === 'penalty' || p.kind === 'freeKick') return nx.kind === 'penaltyGoal' ? 5 : nx.kind === 'kick' ? 3.5 : nx.kind === 'scrum' ? 5 : 1.5
  if (p.kind === 'yellowCard' || p.kind === 'redCard') return 0
  if (SET_NEXT.has(nx.kind) && nx.kind !== 'conversion') {
    // from where the ball went dead to where the set piece is: the far men have the most to walk
    const to = nx.kind === 'kickoff' ? { x: 50, y: 35 } : nx.kind === 'dropout22' ? { x: nx.side === 0 ? 22 : 78, y: 35 } : nx.kind === 'goalLineDropout' ? { x: nx.side === 0 ? 0 : 100, y: 35 } : spot(nx)
    return clamp(3.5 + (hyp(spot(p), to) + 18) / 7.5, 4, 11)
  }
  return 0
}

/** the key moments (owner, 20 Nov 2026): tries, kicks at goal, cards, line
 *  breaks, turnovers in either 22, tries held up, and the run that scored */
/** a line break that gains BIG_BREAK_M or more, ends inside their 22, or leads to a try (round 7, the coordinator's rule; at 30 or 40 m the lengths hardly change: nearly every break ends in the 22 or leads to a try) */
export const BIG_BREAK_M = 20
export function bigBreak(plays: Play[], n: number): boolean {
  const p = plays[n], q = plays[n - 1] ?? p
  const gain = (p.x - q.x) * dirOf(p.side)
  const in22 = p.side === 0 ? p.x > 78 : p.x < 22
  return gain >= BIG_BREAK_M || in22 || plays.slice(n + 1, n + 4).some(r => r.kind === 'try' || r.kind === 'penaltyTry')
}
function keyOf(plays: Play[], n: number): boolean {
  const p = plays[n], nx = plays[n + 1]
  if (['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard', 'heldUp', 'halfTime', 'fullTime'].includes(p.kind)) return true
  // (round 7: about eleven line breaks a match now; the big ones are key, the rest are shown at BREAK_RATE)
  if (p.kind === 'lineBreak') return bigBreak(plays, n)
  const in22 = p.x < 22 || p.x > 78
  if (in22 && ((p.kind === 'ruck' && p.result === 'turnover') || (p.kind === 'lineout' && p.result === 'stolen') || (p.kind === 'scrum' && p.result === 'againstTheHead'))) return true
  if ((p.kind === 'carry' || p.kind === 'maul') && nx && (nx.kind === 'try' || nx.kind === 'heldUp')) return true
  if (p.kind === 'kick' && p.result === 'chargedDown') return true
  if (p.kind === 'carry' && p.result === 'intercepted') return true
  return false
}
/** shown at the lead-in pace, not wound on: the restarts (owner: "teams formed up in view, kick, chase, catch") */
const SLOWISH = new Set(['kickoff', 'dropout22', 'goalLineDropout', 'halfTime', 'fullTime'])

// =====================================================================
// CONDENSING: routine phases are travelled through, not wound on
// =====================================================================
//
// Owner, 22 Nov 2026, on play wound on twelve and eighteen times: "It feels
// jumpy not smooth." Nothing is ever shown faster than WIND_MAX times life
// speed. The time is saved instead by not showing every routine phase of a
// long passage: the first phase is shown, then the picture carries on, the
// ball and both lines travelling smoothly to where the passage is heading
// (with the phase count on a plate), and the last phase or two before what
// ends it are shown again. Only plain phases are condensed: a carry that
// made ground or was held, and a ruck that was recycled, by the same side
// one after another. Nothing that the commentary calls a key moment is.

/** a run of plays the picture travels through */
export interface Stretch { first: number; last: number; from: Pt; to: Pt; side: Side; phases: number; T: number }

/** how hard to condense: [phases shown at the head of a passage, at its tail, least phases left out] */
const LEVELS: [number, number, number][] = [[1, 2, 99], [1, 2, 2], [1, 1, 2], [1, 1, 1], [0, 1, 1], [0, 0, 1]]
export const CONDENSE_MAX = LEVELS.length - 1

const condenseCache = new WeakMap<Play[], Map<number, { stretches: Stretch[]; of: Int32Array }>>()
export function condense(plays: Play[], level: number): { stretches: Stretch[]; of: Int32Array } {
  let byL = condenseCache.get(plays)
  if (!byL) condenseCache.set(plays, byL = new Map())
  const hit = byL.get(level)
  if (hit && hit.of.length === plays.length) return hit
  const [head, tail, least] = LEVELS[clamp(level, 0, CONDENSE_MAX)]
  const of = new Int32Array(plays.length).fill(-1)
  const stretches: Stretch[] = []
  const plain = (n: number) => {
    const c = plays[n], r = plays[n + 1]
    return !!c && !!r && c.kind === 'carry' && (c.result === 'gainLine' || c.result === 'held') && r.kind === 'ruck' && r.result === 'recycled' && r.side === c.side && c.ball === c.side
  }
  for (let n = 0; n < plays.length;) {
    if (!plain(n)) { n++; continue }
    // a passage: phases one after another by the same side
    const starts: number[] = []
    let m = n
    while (plain(m) && (!starts.length || plays[m].side === plays[n].side)) { starts.push(m); m += 2 }
    const h = head
    const mid = starts.length - h - tail
    if (mid >= least) {
      const first = starts[h], last = starts[h + mid - 1] + 1
      const from = spot(plays[first - 1]), to = spot(plays[last])
      const T = clamp(hyp(from, to) / 6 + 0.8, 1.2, 6)
      const idx = stretches.length
      stretches.push({ first, last, from, to, side: plays[first].side, phases: mid, T })
      for (let k = first; k <= last; k++) of[k] = idx
    }
    n = m
  }
  const out = { stretches, of }
  byL.set(level, out)
  return out
}

/** A ROUTINE KICK (coordinator, 22 Nov 2026: "condense routine kicks"): from hand, between the 22s
 *  at both ends, caught, and nothing key within four plays. It is still shown, the ball flying to
 *  where the record has it land, but nobody sprints under it, so it goes by quickly. */
function routineKick(plays: Play[], n: number, keys: boolean[]): boolean {
  const p = plays[n], k = p.kind === 'catch' ? plays[n - 1] : p
  if (!k || k.kind !== 'kick' || k.result !== 'inPlay') return false
  const n0 = k.n, c = plays[n0 + 1], q = plays[n0 - 1]
  if (!c || c.kind !== 'catch' || !q) return false
  const in22 = (x: number) => x < 22 || x > 78
  if (in22(q.x) || in22(k.x)) return false
  for (let j = n0; j <= n0 + 5 && j < plays.length; j++) if (keys[j]) return false
  return true
}

const planCache = new WeakMap<Play[], Map<number, Seg[]>>()
/** every play's place on the bake's clock, at a level of condensing */
export function plan(plays: Play[], level = 0): Seg[] {
  let byL = planCache.get(plays)
  if (!byL) planCache.set(plays, byL = new Map())
  const hit = byL.get(level)
  // (a record still being played grows: what was planned for fewer plays is planned again)
  if (hit && hit.length === plays.length) return hit
  const cd = condense(plays, level)
  const segs: Seg[] = []
  let a = 0
  const keys = plays.map((_, n) => keyOf(plays, n))
  for (let n = 0; n < plays.length; n++) {
    const st = cd.of[n] >= 0 ? cd.stretches[cd.of[n]] : null
    const { act, mark } = st ? { act: st.T / (st.last - st.first + 1), mark: 0 } : actOf(plays, n)
    const dead = st ? 0 : deadOf(plays, n)
    const lead = !keys[n] && (keys[n + 1] || keys[n + 2] || (SLOWISH.has(plays[n].kind) && (n === 0 || plays[n - 1].kind === 'halfTime' || plays[n].kind === 'halfTime' || plays[n].kind === 'fullTime')))
    segs.push({ n, a0: a, act, dead, a1: a + act + dead, mark: a + mark, key: st ? 0 : keys[n] ? 2 : lead ? 1 : 0, live: LIVE.has(plays[n].kind), condensed: !!st, quick: !st && level >= 3 && routineKick(plays, n, keys) })
    a += act + dead
  }
  byL.set(level, segs)
  return segs
}

// =====================================================================
// THE SCHEDULE: how fast each play is shown
// =====================================================================

/** `at` is `start` again, under the name the overseer's harmonycheck reads; `fade` is true where the picture dissolves into the play (fadesIn) */
export interface Slot { n: number; start: number; at: number; dur: number; speed: number; fade: boolean; condensed: boolean }

/** THE LENGTH (owner, 22 Nov 2026 22:13: "8 mins is fine"): an Extended match is aimed at this
 *  many seconds on screen at the normal speed button. Change it here. */
export const TARGET_S = 480

/** THE PACE (owner, 22 Nov 2026 22:13: "for build ups to tries and key moments the game should be
 *  normal speed, then everything else is on fast forward but still happening"). Every play is
 *  shown. Life speed (1x): every key moment, the whole passage of possession that ends in a try
 *  (back to the set piece, turnover or catch it started from, the last BUILD_MAX seconds of it
 *  at most), LEAD_IN seconds before any other key moment and BEAT after it. Everything else is
 *  fast forward at a factor F worked out for each match so it lasts TARGET_S, but never so fast
 *  that a man moves more than MAN_PX or the ball more than BALL_PX on a phone screen between two
 *  frames at 60 a second. A close game (CLOSE_MARGIN points or fewer with CLOSE_FROM seconds of
 *  the clock gone) runs its last minutes at CLOSE_RATE. Every change of speed is eased over at
 *  least EASE_S seconds on screen: never a step. */
export const BUILD_MAX = 35, LEAD_IN = 3, BEAT = 1
/** a line break that does not score (round 6: the record has more of them, most run down) is shown from 1.5 s before it */
export const LEAD_BREAK = 1.5
/** the lead-in to a kick at goal (round 7) */
export const LEAD_KICK = 1.5
/** a smaller line break, not a key moment: shown at this speed, with its label, from LEAD_BREAK before it */
export const BREAK_RATE = 3
/** CLIP PACE (owner, 24 Nov 2026: "the normal speed of what was released in 1.9.16 and 1.9.17... it
 *  feels natural, the right speed"). The 1.9.16 highlight clips move their men at life pace (a back's
 *  sprint 9.3 m/s, passes about 14 m/s) and Live.tsx plays them at speed 0.9 on Normal, so the clip's
 *  clock runs 1/0.9 of life. The normal-speed parts here run at the same rate. */
export const CLIP_RATE = 1 / 0.9
/** in a try build-up, a ball lying still at a ruck for more than PAUSE_HOLD seconds goes on at
 *  PAUSE_RATE: the clips' rucks hold about 0.8 s on screen (measured), the record's are longer */
export const PAUSE_HOLD = 0.6, PAUSE_RATE = 2.5
/** a carrier's pace, the clips' own (src/ui/highlight/bake.ts V_BACK, V_FWD): a back 9.3 m/s, a forward 7.4, a line break 9.8 */
export const RUN_BACK = 9.3, RUN_FWD = 7.4, RUN_BREAK = 9.8
export const CLOSE_MARGIN = 7, CLOSE_FROM = 4500, CLOSE_RATE = 2
export const EASE_S = 1.0
/** the phone pitch: about 2.8 screen pixels to a metre (the landscape stadium in a 390 px wide box) */
export const PX_PER_M = 3.3
export const MAN_PX = 4, BALL_PX = 12, SCREEN_FPS = 60
/** (kept for the tests: the fastest a man may appear on screen, m/s) */
export const SCREEN_MAN = MAN_PX * SCREEN_FPS / PX_PER_M
export const SCREEN_BALL = BALL_PX * SCREEN_FPS / PX_PER_M
const F_MIN = 1.5, F_MAX = 20

/** the clock of the screen: the view second each frame starts at, and its rate */
export interface Timeline { V: Float64Array; rate: Float32Array; total: number; ff: number; slow: Uint8Array; close: boolean }

/** the first play of the possession that ends at play k: the set piece, turnover, catch, tap or restart it
 *  began with (the overseer's harmonycheck possessionStart, with the restarts added) */
export function possessionStart(P: Play[], k: number): number {
  const s = P[k].side
  let j = k
  while (j > 0) {
    const q = P[j - 1]
    if (q.ball !== s || ['conversion', 'penaltyGoal', 'dropGoal', 'halfTime', 'try', 'penaltyTry'].includes(q.kind)) break
    j--
    if (['lineout', 'scrum', 'tap', 'catch', 'kickoff', 'dropout22', 'goalLineDropout'].includes(P[j].kind) || (P[j].kind === 'ruck' && P[j].result === 'turnover') || (P[j].kind === 'carry' && P[j].result === 'intercepted')) break
  }
  return j
}

/** what each frame is: 1 life speed (key, try build-up, lead-in), 2 the close finish, 0 fast forward;
 *  and the most it may be wound on by the pixel limits */
const capCache = new WeakMap<Baked, Map<number, { cap: Float32Array; slow: Uint8Array; close: boolean }>>()
function capsOf(bk: Baked, build = BUILD_MAX): { cap: Float32Array; slow: Uint8Array; close: boolean } {
  let byB = capCache.get(bk)
  if (!byB) capCache.set(bk, byB = new Map())
  const hit = byB.get(build)
  if (hit) return hit
  const n = bk.n, P = bk.plays, segs = bk.segs, cap = new Float32Array(n), slow = new Uint8Array(n)
  const vm = new Float32Array(n)
  const cut = new Set(bk.cuts)
  for (let f = 1; f < n; f++) {
    if (cut.has(f)) { vm[f] = vm[f - 1]; continue }
    let v = 0
    for (let i = 0; i < 30; i++) v = Math.max(v, Math.hypot(bk.pos[f * 62 + i * 2] - bk.pos[(f - 1) * 62 + i * 2], bk.pos[f * 62 + i * 2 + 1] - bk.pos[(f - 1) * 62 + i * 2 + 1]) * FPS)
    const bv = Math.hypot(bk.ball[f * 3] - bk.ball[(f - 1) * 3], bk.ball[f * 3 + 1] - bk.ball[(f - 1) * 3 + 1]) * FPS
    vm[f] = Math.max(v / SCREEN_MAN, bv / SCREEN_BALL)
  }
  // (the fastest over the next and last half second: it slows before a sprint, not during it)
  const W = Math.round(FPS * 0.5)
  for (let f = 0; f < n; f++) {
    let m = 0
    for (let k = Math.max(0, f - W); k <= Math.min(n - 1, f + W); k++) m = Math.max(m, vm[k])
    cap[f] = clamp(1 / Math.max(1e-6, m), 1, F_MAX)
  }
  // (life speed wins over the close finish: a try in the last minutes is still shown at 1x)
  const mark = (a: number, b: number, v: number) => { for (let f = Math.max(0, Math.floor(a * FPS)); f < Math.min(n, Math.ceil(b * FPS)); f++) slow[f] = v === 1 ? 1 : slow[f] === 1 ? 1 : v }
  // the close finish first (the slower life-speed marks go over it)
  let close = false
  const at75 = P.findIndex(p => (p.clock ?? p.t) >= CLOSE_FROM)
  let closeF = n
  if (at75 > 0 && Math.abs(P[at75 - 1].score[0] - P[at75 - 1].score[1]) <= CLOSE_MARGIN) { close = true; closeF = Math.floor(segs[at75].a0 * FPS); mark(segs[at75].a0, segs[segs.length - 1].a1, 2) }
  for (let k = 0; k < P.length; k++) {
    const g = segs[k]
    if (g.key !== 2) continue
    const p = P[k]
    if (p.kind === 'try' || p.kind === 'penaltyTry') {
      // THE BUILD-UP (owner: "for build ups to tries... the game should be normal speed"; round 7): every
      // play of the possession that ended in the try, from the set piece, turnover, catch or restart that
      // began it, whatever its length. The ease down to clip pace is finished before that first play.
      const st = possessionStart(P, k)
      mark(segs[st].a0, g.a0 + g.act + BEAT, 1)
    // (a kick at goal is set up in the dissolve before it: two seconds of the kicker over the ball is enough)
    } else mark(g.a0 - (p.kind === 'lineBreak' ? LEAD_BREAK : p.kind === 'conversion' || p.kind === 'penaltyGoal' ? LEAD_KICK : LEAD_IN), g.a0 + g.act + (p.kind === 'lineBreak' ? 0.6 : BEAT), 1)
  }
  // the smaller line breaks (4): slower than fast forward, quicker than the clips, never over a build-up
  for (let k = 0; k < P.length; k++) if (P[k].kind === 'lineBreak' && segs[k].key !== 2) {
    const g = segs[k]
    for (let f = Math.max(0, Math.floor((g.a0 - LEAD_BREAK) * FPS)); f < Math.min(n, Math.ceil((g.a0 + g.act + 0.6) * FPS)); f++) if (slow[f] === 0) slow[f] = 4
  }
  // the long ruck pauses of a build-up (3): after PAUSE_HOLD of a ball lying still with nobody on it, it goes
  // on at PAUSE_RATE until somebody has it. Never inside a key moment itself.
  const inKey = new Uint8Array(n)
  for (let k = 0; k < P.length; k++) { const g = segs[k]; if (g.key === 2) for (let f = Math.max(0, Math.floor(g.a0 * FPS)); f < Math.min(n, Math.ceil((g.a0 + g.act) * FPS)); f++) inKey[f] = 1 }
  let still = 0
  for (let f = 1; f < n; f++) {
    const bv = Math.hypot(bk.ball[f * 3] - bk.ball[(f - 1) * 3], bk.ball[f * 3 + 1] - bk.ball[(f - 1) * 3 + 1]) * FPS
    const lying = slow[f] === 1 && !inKey[f] && bk.holder[f] < 0 && bv < 0.3 && P[bk.seg[f]].kind === 'ruck'
    still = lying ? still + 1 / FPS : 0
    // (not in a close finish: that is held at CLOSE_RATE or slower throughout)
    if (still > PAUSE_HOLD && !(close && f >= closeF)) slow[f] = 3
  }
  for (const f of bk.cuts) if (f < n) cap[f] = cap[Math.max(0, f - 1)]
  const out = { cap, slow, close }
  byB.set(build, out)
  return out
}
function timelineAt(bk: Baked, F: number, build = BUILD_MAX): Timeline {
  const { cap, slow, close } = capsOf(bk, build)
  const n = bk.n, rate = new Float32Array(n)
  for (let f = 0; f < n; f++) rate[f] = slow[f] === 1 ? CLIP_RATE : slow[f] === 3 ? Math.min(PAUSE_RATE, cap[f]) : slow[f] === 4 ? Math.min(BREAK_RATE, cap[f]) : slow[f] === 2 ? Math.min(CLOSE_RATE, cap[f]) : Math.min(F, cap[f])
  // EASED: the speed changes by the same share every screen frame, so going from life speed to F takes at
  // least EASE_S on screen either way, and near life speed a step is as gentle as near F
  const k = Math.log(Math.max(2, F)) / EASE_S
  for (let f = 1; f < n; f++) rate[f] = Math.min(rate[f], rate[f - 1] * Math.exp(k / FPS / rate[f - 1]))
  for (let f = n - 2; f >= 0; f--) rate[f] = Math.min(rate[f], rate[f + 1] * Math.exp(k / FPS / rate[f + 1]))
  const V = new Float64Array(n + 1)
  for (let f = 0; f < n; f++) V[f + 1] = V[f] + 1 / FPS / rate[f]
  return { V, rate, total: V[n], ff: F, slow, close }
}
const tlCache = new WeakMap<Baked, Timeline>()
/** the screen's clock for a baked match: the fast-forward factor that makes it last TARGET_S */
export function timeline(bk: Baked): Timeline {
  const hit = tlCache.get(bk)
  if (hit) return hit
  // (build-ups are never shortened, owner 24 Nov: a match of many tries simply runs longer)
  const build = BUILD_MAX
  let lo = F_MIN, hi = F_MAX
  for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (timelineAt(bk, mid, build).total > TARGET_S) lo = mid; else hi = mid }
  const tl = timelineAt(bk, hi, build)
  tlCache.set(bk, tl)
  return tl
}

/** CONDENSING IS OFF (owner, 22 Nov 2026 22:13: every play is shown, "not just being ignored").
 *  The code is kept: a level above 0 would travel through routine phases again. */
export const CONDENSE_LEVEL = 0

const bakeCache = new WeakMap<Play[], { sides?: [RecSide, RecSide]; bk: Baked }>()
/** the bake of a record, made once (the pitch and the commentary's schedule share it) */
export function bakeOf(plays: Play[], sides?: [RecSide, RecSide]): Baked {
  const hit = bakeCache.get(plays)
  if (hit && hit.sides === sides) return hit.bk
  const bk = bake(plays, sides, CONDENSE_LEVEL)
  bakeCache.set(plays, { sides, bk })
  return bk
}

/**
 * WHEN EACH PLAY IS SHOWN. `start` and `dur` are seconds on screen from the
 * kick-off; `speed` is how many times life speed the play is shown at on
 * average (1 for a key moment). A condensed play (a routine phase the
 * picture travels through) has `condensed: true` and a short `dur`. `fade`
 * is true where the picture dissolves into the play (fadesIn). The
 * commentary shows Line n's text when play n starts. Pass the same sides the
 * pitch is given (fromMatch.ts SimSide, home then away), or none to both.
 */
export function schedule(plays: Play[], sides?: [RecSide, RecSide]): Slot[] {
  const bk = bakeOf(plays, sides), tl = timeline(bk)
  const faded = new Set(bk.cuts.map(f => bk.seg[f]))
  const fr = (a: number) => clamp(Math.round(a * FPS), 0, bk.n)
  return plays.map((_, n) => {
    const g = bk.segs[n], start = tl.V[fr(g.a0)], end = tl.V[fr(g.a1)]
    const dur = Math.max(0, end - start)
    return { n, start, at: start, dur, speed: dur > 0 ? (g.a1 - g.a0) / dur : 1, fade: faded.has(n), condensed: !!g.condensed }
  })
}

/** the bake's clock (anim seconds) at a moment on screen */
export function animAt(tl: Timeline, v: number): number {
  const V = tl.V
  if (v <= 0) return 0
  if (v >= tl.total) return (V.length - 1) / FPS
  let lo = 0, hi = V.length - 1
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (V[m] <= v) lo = m; else hi = m }
  return (lo + (v - V[lo]) / Math.max(1e-9, V[lo + 1] - V[lo])) / FPS
}

// =====================================================================
// WHO IS WHO
// =====================================================================

/** a side as the pitch needs it: each player's id and the shirt he started in (fromMatch.ts SimSide) */
export interface RecSide { players: { id: string; shirt: number }[] }

// =====================================================================
// THE BAKE
// =====================================================================

export interface Baked {
  plays: Play[]
  segs: Seg[]
  /** frames stored, at FPS a second of anim time */
  n: number
  /** per frame: 30 men x (x, y), then the referee (x, y) */
  pos: Float32Array
  /** per frame: ball x, y, height */
  ball: Float32Array
  /** per frame: the slot holding the ball, or -1 */
  holder: Int8Array
  /** per frame: the side shown with the ball */
  poss: Int8Array
  /** per frame: the play being shown */
  seg: Int16Array
  /** per frame, 30 a frame: on the floor (1), bound in a ruck/scrum/maul (2), off the field (4), in the air at a lineout (8) */
  flags: Uint8Array
  /** the frames the picture dissolves at (the owner's fades: before a lineout, a conversion, a kick at goal, after half-time) */
  cuts: number[]
  /** per play, once it has been baked: the slot (0..29) of the man the record names (`who`), or -1. A try scorer's
   *  name tag is drawn on this man and on no other (27 Nov: "Stooke" rode on the No. 10 fetching the ball) */
  whoSlot?: number[]
}

interface Body { x: number; y: number; vx: number; vy: number; rest?: boolean }
type Ov = { x: number; y: number; v: number; place?: boolean; a?: number }

/** BAKE THE WHOLE MATCH. Deterministic: the same record and sides give the same frames. */
export function bake(plays: Play[], sides?: [RecSide, RecSide], level = 0): Baked {
  const b = makeBaker(plays, sides, level)
  b.run(Infinity, { final: true })
  return b.result()
}

/** A BAKER THAT CAN BE FED (round 8, the live match screen). The same bake, but it can stop where the
 *  record runs out and go on when more plays arrive: `plays` is the session's own array, pushed to as the
 *  match is simulated, and `run` bakes as many frames as it is allowed. A play is only started once
 *  `ahead` more plays are known (the men read the next plays), and its walk to the next set piece only
 *  once the next play is known; `final` lifts both at the end of the match. Nothing already baked is
 *  ever baked again, so the picture is continuous across every join. */
export interface Baker {
  /** bake up to `frames` more frames: 'done' at the end of a final record, 'need' when it wants more plays */
  run(frames: number, o?: { final?: boolean; ahead?: number }): 'done' | 'need' | 'budget'
  /** the plays have grown: plan the new ones (and re-plan those not yet started) */
  more(): void
  /** what has been baked so far, as a Baked whose arrays are views of the live ones */
  live(): Baked
  /** the finished bake, its arrays cut to length */
  result(): Baked
  /** frames baked so far */
  readonly frames: number
  /** the play being baked */
  readonly at: number
}
export function makeBaker(plays: Play[], sides?: [RecSide, RecSide], level = 0): Baker {
  // (the plan's times are the least each play takes: the bake waits for the men the record names, so it writes its own)
  const segs = plan(plays, level).map(g => ({ ...g }))
  const cd = condense(plays, level)
  let cap = Math.ceil(((segs.length ? segs[segs.length - 1].a1 : 0) * 1.6 + 60) * FPS)
  let pos = new Float32Array(cap * 62), ballA = new Float32Array(cap * 3)
  let holderA = new Int8Array(cap), possA = new Int8Array(cap), segA = new Int16Array(cap), flags = new Uint8Array(cap * 30)
  const grow = () => {
    cap *= 2
    const g2 = <T extends Float32Array | Int8Array | Int16Array | Uint8Array>(a: T, w: number): T => { const b = new (a.constructor as new (n: number) => T)(cap * w); b.set(a); return b }
    pos = g2(pos, 62); ballA = g2(ballA, 3); holderA = g2(holderA, 1); possA = g2(possA, 1); segA = g2(segA, 1); flags = g2(flags, 30)
  }

  // ---- who is who: ids to slots
  const idSlot = new Map<string, number>()
  const whoSlot: number[] = []
  sides?.forEach((sd, s) => { for (const p of sd.players) if (p.shirt >= 1 && p.shirt <= 15) idSlot.set(p.id, slot(s as Side, p.shirt)) })
  // a man off the bench is not in the fifteen at kick-off: he takes the shirt of the man the record last saw in his position
  sides?.forEach((sd, s) => { for (const p of sd.players) if (p.shirt > 15 && !idSlot.has(p.id)) idSlot.set(p.id, slot(s as Side, p.shirt > 23 ? 15 : p.shirt > 20 ? 9 + (p.shirt - 21) : p.shirt - 15)) })

  // ---- the bodies
  const B: Body[] = Array.from({ length: 30 }, () => ({ x: 50, y: 35, vx: 0, vy: 0 }))
  const ref: Body = { x: 50, y: 40, vx: 0, vy: 0 }
  const down = new Float32Array(30)
  const off = new Array<boolean>(30).fill(false)
  /** the clock second a carded man may come back (Infinity for a red) */
  const offUntil = new Array<number>(30).fill(-1)
  const ov: (Ov | null)[] = new Array(30).fill(null)
  const fl = new Uint8Array(30)
  const ball = { x: 50, y: 35, lift: 0 }
  let holder = -1, want = -1, poss: Side = 0
  /** a ball in the air: from, to (a point, or a man it follows), start, length, height, low (bouncing) */
  type Fly = { from: Pt; to: () => Pt; t0: number; dur: number; h: number; low?: boolean; then?: () => void }
  let fly = null as Fly | null
  /** a loose ball rolled or tossed to a point */
  let roll = null as { to: Pt; v: number } | null
  let t = 0

  /** the slot of a player id, or a fallback by shirt */
  const who = (id: string | undefined, s: Side, fallback: number): number => {
    const k = id ? idSlot.get(id) : undefined
    if (k != null && sideOfSlot(k) === s && !off[k]) return k
    const f = slot(s, fallback)
    if (!off[f]) return f
    for (let i = 0; i < 15; i++) if (!off[s * 15 + i]) return s * 15 + i
    return f
  }
  /** the man nearest a point on a side, standing, not one of skip */
  const nearest = (s: Side, p: Pt, skip: number[] = [], forwardsOnly = false): number => {
    let bi = -1, bd = Infinity
    for (let k = 0; k < (forwardsOnly ? 8 : 15); k++) {
      const i = s * 15 + k
      if (off[i] || skip.includes(i)) continue
      const d = hyp(B[i], p) + (down[i] > 0 ? 6 : 0)
      if (d < bd) { bd = d; bi = i }
    }
    return bi < 0 ? slot(s, 9) : bi
  }

  // ---- the shapes (the clips' tables, highlight/plays.ts)
  const ownLine = (x: number, b: Pt, dir: number) => {
    const line = dir > 0 ? 100 : 0
    const room = (line - b.x) * dir < 8 ? 2.5 : 0
    return dir > 0 ? Math.min(x, line + room) : Math.max(x, line - room)
  }
  const shapeAtt = (k: number, b: Pt, dir: number, lean: number): Pt => {
    const [back, across, open] = ATT[k]
    return { x: fx(ownLine(b.x - dir * back, b, -dir)), y: inY(b.y + (open ? backAcross(across, b.y, lean) : across)) }
  }
  const shapeDef = (k: number, b: Pt, dir: number, lean: number): Pt => {
    const near = b.y < 35 ? -1 : 1
    const room = near < 0 ? b.y : 70 - b.y
    if (k === 14) return { x: fx(ownLine(b.x + dir * 16, b, dir)), y: inY(b.y + near * Math.min(8, room * 0.5)) }
    if (k === 10 || k === 13) {
      const mine = (k === 10 ? 1 : -1) * (dir > 0 ? 1 : -1)
      if (mine !== near) return { x: fx(ownLine(b.x + dir * 12, b, dir)), y: inY(b.y + mine * 20) }
      return { x: fx(ownLine(b.x + dir * 4.5, b, dir)), y: inY(b.y + mine * 25 * DS.width) }
    }
    const [ahead, across] = DEF[k]
    let ls = -lean
    if ((ls > 0 ? 70 - b.y : b.y) < 13) ls = -ls
    const roomOn = ls > 0 ? 70 - b.y : b.y, roomOff = 70 - roomOn
    const w = across * DS.width
    const a = w > roomOn - 4 ? -Math.min(roomOff - 3, 6 + (w - 10) * 0.9) : w < -6 ? -6 + (w + 6) * clamp((roomOff - 8) / 10, 0.15, 1) : w
    return { x: fx(ownLine(b.x + dir * Math.max(1.2, ahead + DS.depth), b, dir)), y: inY(b.y + ls * a) }
  }
  const press = (s: number) => { const q = Math.max(0, s - 0.25); return DS.up * Math.min(q, DS.upFor) + DS.upAfter * Math.max(0, q - DS.upFor) }

  /** THE CONTEXT the men not named in a play stand by */
  type Ctx =
    | { k: 'open'; att: Side; O: Pt; tOut: number; lean: number; T?: number }
    | { k: 'kick'; kicker: Side; L: Pt; lean: number; quick?: boolean }
    | { k: 'form'; at: Pt[]; v: number }
    | { k: 'hold' }
  let ctx: Ctx = { k: 'hold' }
  // ---- POSITIONAL PLAY (owner, 22 Nov 2026: "players just randomly travel a strange angle").
  // The shape used to be the clips' tables centred on the ball across the pitch, so every pass,
  // carry or kick that moved the ball across moved thirty targets across with it, and whole
  // sides slid sideways as a block. Now each side has a LATERAL ANCHOR that follows the ball
  // across at no more than ANCHOR_V (a defence drifting, an attack realigning), and each man has
  // a LANE by his role: the wings on their touchlines, the 15 deep, the 10, 12 and 13 spread off
  // the anchor, the forwards in pods (1-3-3-1) beside it. Up and down the pitch the shape moves
  // with the ball, which is the way men run in rugby: forward onto it, back behind it.
  const ANCHOR_V = 1.6
  const ay: [number, number] = [35, 35]
  /** the ball's x, followed over about a second: the lines go up and back with the play, not with every pass and step */
  let bxs = 50
  /** and its y, the same way: the forwards set their pods and their guards off the ruck */
  let bys = 35
  /** THE DEFENSIVE LINE, HELD STEADY (round 5: it pulsed up and back each phase in fast forward). Where it
   *  wants to be (rawLine) and where it is (dLine), which moves towards it at no more than LINE_V */
  let dLine = 50
  const LINE_V = 2.6
  const rawLine = (): number => {
    if (ctx.k !== 'open') return dLine
    const da = dirOf(ctx.att)
    const up = t > ctx.tOut ? press(t - ctx.tOut) : 0
    let lx = ctx.O.x + da * 1.2 - da * Math.min(1.5, up)
    // (never closer than a metre in front of the ball: the line backs off a carry it has not stopped)
    if ((lx - bxs) * da < 1.0) lx = bxs + da * 1.0
    if (ctx.T !== undefined && (lx - ctx.T) * da < 1.2) lx = ctx.T + da * 1.2
    return lx
  }
  /** the open side (the side of the anchor with more room), held until the play is well over the middle */
  const osOf: [number, number] = [1, 1]
  /** THE SHAPE TURNS OVER SLOWLY (round 6): when the open side changes, the side's shape does not flip at
   *  once (a whole side sliding 20 m), it swings across through the middle at OS_SWING a second */
  const osC: [number, number] = [1, 1]
  const OS_SWING = 0.12
  /** the most a side in its shape moves across together, on average (m/s): 2 s of it is 3 m, leaving room for the men with a job in the play */
  const SIDE_VY = 1.5
  const updateAnchors = (fast: boolean) => {
    for (const s of [0, 1] as Side[]) {
      // (the further the ball has gone across, the quicker the side drifts after it: a 25 m switch is
      // covered in a few seconds, not left as a hole; a small change is followed at a walk)
      const want = clamp(ball.y, 8, 62), dv = (fast ? 10 : clamp(ANCHOR_V + 0.12 * Math.abs(want - ay[s]), ANCHOR_V, 3.4)) * DT
      ay[s] += clamp(want - ay[s], -dv, dv)
      if (ay[s] < 24) osOf[s] = 1
      else if (ay[s] > 46) osOf[s] = -1
      osC[s] = fast ? osOf[s] : osC[s] + clamp(osOf[s] - osC[s], -OS_SWING * DT, OS_SWING * DT)
    }
  }
  /** the attack's left, in y: side 0 attacks towards x = 100 with its left at y = 0 (formScrum) */
  const leftOf = (s: Side) => (dirOf(s) > 0 ? -1 : 1)
  /** a wing's lane: six metres in from his own touchline, a little towards the play */
  const wingLane = (s: Side, k: number, toward: number) => {
    const left = k === 10, sideY = (left ? leftOf(s) : -leftOf(s)) < 0 ? 6 : 64
    return sideY + 0.12 * (toward - sideY)
  }
  /** 1-3-3-1: [metres behind the ball, metres across from the anchor] by shirt index, the open side positive */
  // (round 5: wider, after measuring 17 of the 30 within 10 m across of the ball at a ruck and the attack 30 m wide)
  // (round 6: wider again, to the real shape: pods across 45 m and more, the ruck left to three or four a side)
  const POD: Record<number, [number, number]> = { 0: [2.5, -12], 1: [3.4, -14], 2: [2.5, -16], 3: [2.5, 12], 4: [3.4, 14], 7: [2.5, 16], 5: [3.2, -26], 6: [3.2, 26] }
  const attackSpot = (k: number, s: Side, bx: number): Pt => {
    const d = dirOf(s), A = ay[s], os = osC[s], osSide = osOf[s]
    if (k === 10 || k === 13) {
      const open = (k === 10 ? leftOf(s) : -leftOf(s)) === osSide
      return { x: bx - d * (open ? 10 : 8), y: wingLane(s, k, A) }
    }
    if (k === 14) return { x: bx - d * 13, y: inY(A + os * 13) }
    const BACK: Record<number, [number, number]> = { 8: [1.5, 1], 9: [6, 11], 11: [7.5, 20], 12: [9, 30] }
    let t2 = BACK[k] ?? POD[k] ?? [3, 0]
    // THE BACKS USE THE OPEN FIELD (round 10: the frozen engine's rucks sit nearer the touchlines, seed 2 a median
    // 16.5 m in, and with the 10, 12 and 13 at fixed gaps the 13 stood 42 m across with 20 m of grass outside him,
    // the attack under 35 m wide). With more open side than the middle of the field gives (42 m), they spread
    // into it, up to 1.4 times as wide; in the middle of the field nothing changes.
    if (k === 9 || k === 11 || k === 12) { const space = os >= 0 ? 66 - A : A - 4; t2 = [t2[0], t2[1] * clamp(space / 42, 1, 1.4)] }
    // (the forwards' pods are set off the ruck itself, followed over a second or so; the backs off the slower anchor)
    return { x: bx - d * t2[0], y: clamp((k < 8 ? bys : A) + os * t2[1], 4, 66) }
  }
  /** the defence: a flat line at lx (the forwards nearest the ruck, then the backs out across), the 9
   *  sweeping behind the ruck, the near wing up in the line, the far wing and the 15 deep */
  // (a guard and a bodyguard each side of the ruck, then the line out across the field 5 m apart)
  const DEF_ACROSS = [2.2, -2.2, 10.5, -10.5, 15.5, -15.5, 20.5, -20]
  const defenceSpot = (k: number, s: Side, lx: number): Pt => {
    const da = -dirOf(s), A = ay[s], os = osC[s]
    if (k === 8) return { x: lx + da * 5, y: A }
    // (the 15 covers the open side's backfield; the far wing drops into the other half of it)
    if (k === 14) return { x: lx + da * 18, y: inY(A + os * 14) }
    if (k === 10 || k === 13) {
      const lane = wingLane(s, k, A), near = Math.abs(lane - A) < 35
      return { x: lx + da * (near ? 0.5 : 12), y: lane }
    }
    const across = k < 8 ? DEF_ACROSS[k] : k === 9 ? 25.5 : k === 11 ? 30.5 : 35.5
    return { x: lx + da * (k < 8 ? 0 : 0.6), y: clamp((k < 8 ? bys : A) + os * across, 3, 67) }
  }
  const targetOf = (i: number): Ov => {
    const s = sideOfSlot(i), k = i % 15, fwd = k < 8
    if (ctx.k === 'hold') return { x: B[i].x, y: B[i].y, v: 2 }
    // (to a set piece every man goes to his mark by the shortest path, the forwards first)
    // (walked or jogged, never sprinted: the clock goes quicker while nobody runs, so it costs no time to watch)
    if (ctx.k === 'form') {
      const p = ctx.at[i], across = Math.abs(p.y - B[i].y) > Math.abs(p.x - B[i].x)
      return { x: p.x, y: p.y, v: Math.min(ctx.v, across ? 1.9 : fwd ? 4 : 3.5) }
    }
    let o: Ov
    if (ctx.k === 'kick') {
      // UNDER A KICK every man keeps his lane: the chasers run straight up, the back three drop straight back
      const r = other(ctx.kicker), dr = dirOf(r), L = ctx.L
      if (s === r) o = { x: L.x - dr * (k >= 10 ? 3 + (k % 3) * 3 : 6 + (k % 4) * 2), y: B[i].y, v: k >= 10 ? 8.5 : 5 }
      else o = { x: L.x + dr * (6 + (k % 3) * 1.5), y: B[i].y, v: fwd ? 6 : 7.5 }
      if (ctx.quick) o.v = Math.min(o.v, 5)
    } else {
      // open play: the attack in its lanes behind the ball, the defence a flat line in front of it, pressing once the ball is out
      const a = ctx.att, da = dirOf(a)
      if (s === a) { const p = attackSpot(k, s, Math.min(bxs * da, ctx.O.x * da + 3) * da); o = { ...p, v: fwd ? 6.2 : 8 } }
      else {
        // (the line as a whole, held steady: dLine follows rawLine at no more than LINE_V)
        let lx = dLine
        if ((lx - ball.x) * da < 0.5) lx = ball.x + da * 0.5
        const p = defenceSpot(k, s, lx)
        o = { ...p, v: fwd ? 6.2 : 8 }
      }
    }
    // a man whose way to his place is mostly across the field jogs there: nobody sprints sideways off the ball
    const dx = Math.abs(o.x - B[i].x), dyy = Math.abs(o.y - B[i].y)
    // (but a wing gets back to his touchline at a run: holding the width is his job)
    if (dyy > dx) o.v = Math.min(o.v, k === 10 || k === 13 ? 6 : dyy > 8 ? 3.6 : dyy > 3 ? 3.0 : 2.1)
    return o
  }

  /** the bench by the touchline, where a man in the bin sits */
  const benchOf = (i: number): Pt => ({ x: 50 + (sideOfSlot(i) === 0 ? -6 : 6) + (i % 15) * 0.3, y: -2.6 })

  // ---- the moves of the ball
  /** the ball to man i: out of the hands of whoever has it, tossed to him (or he picks it up) */
  const give = (i: number) => { if (holder !== i && (want !== i || pick)) { holder = -1; want = i; pick = false; roll = null } }
  /** IN PLAY THE MAN GOES TO THE BALL, NEVER THE BALL TO THE MAN (owner: "the ball randomly flies back"):
   *  it stays where it is and he has it once he is on it */
  let pick = false
  const pickUp = (i: number) => { if (holder < 0 && !fly && (want !== i || !pick)) { want = i; pick = true } }
  const drop = (at?: Pt) => { holder = -1; want = -1; pick = false; if (at) roll = { to: at, v: 8 } }
  const throwTo = (i: number, dur: number, h: number, then?: () => void) => {
    const from = { x: ball.x, y: ball.y }
    // (never faster on average than a hard pass, 20 m/s: the clips' rule)
    dur = Math.max(dur, hyp(from, B[i]) / 16)
    holder = -1; want = -1; pick = false; roll = null
    fly = { from, to: () => ({ x: B[i].x + dirOf(sideOfSlot(i)) * 0.35, y: B[i].y }), t0: t, dur, h, then: () => { holder = i; then?.() } }
  }
  const kickTo = (L: Pt, dur: number, h: number, low = false, then?: () => void) => {
    const from = { x: ball.x, y: ball.y }
    dur = Math.max(dur, hyp(from, L) / (low ? 18 : 26))
    holder = -1; want = -1; pick = false; roll = null
    fly = { from, to: () => L, t0: t, dur, h, low, then }
  }


  /** each play's own picture: called every frame with tau seconds into the play; true once it is done */
  type Ctl = (tau: number) => boolean | void
  /** the moment the ball is where the record puts it */
  let markAt = -1
  const mark = () => { if (markAt < 0) markAt = t }

  // ---- FORMATIONS: where everybody stands for a set piece
  const formKickoff = (kSide: Side, kicker: number): Pt[] => {
    const dk = dirOf(kSide), r = other(kSide)
    const at: Pt[] = new Array(30)
    let j = 0
    for (let k = 0; k < 15; k++) {
      const i = kSide * 15 + k
      if (i === kicker) { at[i] = { x: 50 - dk * 1.2, y: 35 }; continue }
      at[i] = { x: 50 - dk * (1.5 + (j % 2)), y: 5 + j * (60 / 13) }; j++
    }
    const R: [number, number][] = [[12, 14], [12, 17], [12, 20], [14, 50], [14, 53], [12, 30], [12, 40], [14, 56], [17, 35], [24, 30], [32, 10], [26, 46], [28, 22], [32, 60], [42, 35]]
    for (let k = 0; k < 15; k++) at[r * 15 + k] = { x: 50 + dk * R[k][0], y: R[k][1] }
    return wingsOnTheirTouchlines(at)
  }
  /** every wing on his own touchline (the left wing on his side's left), swapped with whoever stood there */
  const wingsOnTheirTouchlines = (at: Pt[]): Pt[] => {
    for (const s of [0, 1] as Side[]) for (const k of [10, 13]) {
      const i = s * 15 + k, lane = wingLane(s, k, 35)
      if (Math.abs(at[i].y - lane) < 15) continue
      // the man of his side standing nearest his lane takes the wing's spot instead
      let bj = -1, bd = Infinity
      for (let j = 0; j < 15; j++) { const q = s * 15 + j; if (q === i || j === 10 || j === 13) continue; const dd = Math.abs(at[q].y - lane); if (dd < bd) { bd = dd; bj = q } }
      if (bj >= 0) { const tmp = at[i]; at[i] = at[bj]; at[bj] = tmp }
    }
    return at
  }
  const formDropout = (by: Side, from: number, kicker: number): Pt[] => {
    const db = dirOf(by), r = other(by)
    const at: Pt[] = new Array(30)
    let j = 0
    for (let k = 0; k < 15; k++) {
      const i = by * 15 + k
      if (i === kicker) { at[i] = { x: fx(from - db * 1), y: 35 }; continue }
      at[i] = { x: fx(from - db * (2 + (j % 2))), y: 6 + j * (58 / 13) }; j++
    }
    const R: [number, number][] = [[11, 15], [11, 18], [11, 21], [13, 49], [13, 52], [11, 31], [11, 39], [13, 55], [16, 35], [24, 32], [32, 10], [27, 46], [29, 22], [32, 60], [40, 35]]
    for (let k = 0; k < 15; k++) at[r * 15 + k] = { x: fx(from + db * R[k][0]), y: R[k][1] }
    return wingsOnTheirTouchlines(at)
  }
  const formScrum = (feed: Side, M: Pt): Pt[] => {
    const d = dirOf(feed), leftY = d > 0 ? -1 : 1, o = other(feed)
    const at: Pt[] = new Array(30)
    SCRUM_FORM.forEach(([bk, ac], k) => {
      at[feed * 15 + k] = { x: M.x - d * bk, y: M.y + leftY * ac }
      at[o * 15 + k] = { x: M.x + d * bk, y: M.y - leftY * ac }
    })
    at[feed * 15 + 8] = { x: M.x - d * 0.4, y: M.y + leftY * 2.3 }
    at[o * 15 + 8] = { x: M.x + d * 0.6, y: M.y + leftY * 2.5 }
    const side = M.y < 35 ? 1 : -1
    // the backs: ours five metres behind the hindmost foot, theirs the same, each opposite his man
    const backs: [number, number, number][] = [[9, 8, 8], [11, 9.5, 15], [12, 11, 22], [14, 15, 12]]
    for (const [k, dx, dy] of backs) {
      at[feed * 15 + k] = { x: M.x - d * dx, y: inY(M.y + side * dy) }
      at[o * 15 + k] = { x: M.x + d * (dx - 1), y: inY(M.y + side * dy) }
    }
    // the wings: the open one wide, the blind one in the short side
    // the wings on their own touchlines (the left wing on his left), the open one deeper
    for (const [sd, dd] of [[feed, d], [o, -d]] as [Side, number][]) for (const k of [10, 13]) {
      const lane = wingLane(sd, k, M.y), open = Math.abs(lane - M.y) > 20
      at[sd * 15 + k] = { x: M.x - dd * (open ? 12 : 9), y: lane }
    }
    at[o * 15 + 14] = { x: M.x + d * 22, y: inY(lerp(35, M.y + side * 14, 0.4)) }
    return at.map(p => ({ x: fx(p.x), y: p.y }))
  }
  const formLineout = (thrower: Side, X: number, touchY: number): Pt[] => {
    const d = dirOf(thrower), o = other(thrower), ts = touchY === 0 ? 1 : -1
    const at: Pt[] = new Array(30)
    LINEOUT_ORDER.forEach((k, j) => {
      at[thrower * 15 + k] = { x: X - d * 0.5, y: touchY + ts * LINEOUT_Y[j] }
      at[o * 15 + k] = { x: X + d * 0.5, y: touchY + ts * LINEOUT_Y[j] }
    })
    at[thrower * 15 + 1] = { x: X, y: touchY + ts * 0.6 }
    at[o * 15 + 1] = { x: X + d * 2, y: touchY + ts * 2.5 }
    at[thrower * 15 + 8] = { x: X - d * 2, y: touchY + ts * 12 }
    at[o * 15 + 8] = { x: X + d * 2, y: touchY + ts * 15 }
    // the backs ten metres back, both sides
    const backs: [number, number, number][] = [[9, 11, 18], [11, 12, 25], [12, 13, 32], [14, 20, 34]]
    for (const [k, dx, dy] of backs) { at[thrower * 15 + k] = { x: X - d * dx, y: touchY + ts * dy }; at[o * 15 + k] = { x: X + d * dx, y: touchY + ts * dy } }
    // the wings on their own touchlines: the one on this side ten back, the far one out on the far side
    for (const [sd, dd] of [[thrower, d], [o, -d]] as [Side, number][]) for (const k of [10, 13]) {
      const lane = wingLane(sd, k, 35), near = Math.abs(lane - touchY) < 35
      at[sd * 15 + k] = { x: X - dd * (near ? 16 : 13), y: near ? touchY + ts * 12 : lane }
    }
    return at.map(p => ({ x: fx(p.x), y: inY(p.y) }))
  }
  /** a kick at goal: the kicker's side behind him, the other side behind their posts */
  const formGoal = (s: Side, K: Pt): Pt[] => {
    const d = dirOf(s), o = other(s), line = lineOf(s)
    const at: Pt[] = new Array(30)
    for (let k = 0; k < 15; k++) {
      at[s * 15 + k] = { x: fx(K.x - d * (8 + (k % 4) * 2.5)), y: inY(K.y + ((k % 7) - 3) * 3.4) }
      at[o * 15 + k] = { x: fx(line + d * (1.5 + (k % 3) * 1.2)), y: 20 + (k % 8) * 4.2 }
    }
    return at
  }
  /** a penalty taken quickly or kicked to touch: they are ten metres back */
  const formPenalty = (to: Side, M: Pt): Pt[] => {
    const d = dirOf(to), o = other(to), lean = openSide(M.y) >= 0 ? 1 : -1
    const at: Pt[] = new Array(30)
    for (let k = 0; k < 15; k++) {
      at[to * 15 + k] = shapeAtt(k, M, d, lean)
      at[o * 15 + k] = shapeDef(k, { x: M.x + d * 8.5, y: M.y }, d, lean)
    }
    return at
  }
  const formFor = (nx: Play): { at: Pt[]; fetch: number; spot: Pt } | null => {
    const s = nx.side
    switch (nx.kind) {
      case 'kickoff': { const kk = who(nx.who, s, 10); return { at: formKickoff(s, kk), fetch: kk, spot: { x: 50 - dirOf(s) * 1.2, y: 35 } } }
      case 'dropout22': case 'goalLineDropout': {
        const from = nx.kind === 'dropout22' ? (s === 0 ? 22 : 78) : (s === 0 ? 0 : 100)
        const kk = who(nx.who, s, 10)
        return { at: formDropout(s, from, kk), fetch: kk, spot: { x: from - dirOf(s) * 1, y: 35 } }
      }
      case 'scrum': return { at: formScrum(s, spot(nx)), fetch: slot(s, 9), spot: spot(nx) }
      case 'lineout': {
        if (nx.result === 'quick') return null
        const tY = nx.y < 35 ? 0 : 70; return { at: formLineout(s, nx.x, tY), fetch: who(nx.who, s, 2), spot: { x: nx.x, y: tY + (tY === 0 ? 0.6 : -0.6) } }
      }
      case 'penaltyGoal': { const kk = who(nx.who, s, 10); return { at: formGoal(s, goalSpot(nx)), fetch: kk, spot: goalSpot(nx) } }
      case 'kick': { const kk = who(nx.who, s, 10); return { at: formPenalty(s, spot(plays[nx.n - 1] ?? nx)), fetch: kk, spot: spot(plays[nx.n - 1] ?? nx) } }
      case 'tap': { const kk = who(undefined, s, 9); return { at: formPenalty(s, spot(nx)), fetch: kk, spot: spot(nx) } }
      default: return null
    }
  }

  /** where a conversion is kicked from: in line with the try, back far enough to see the posts */
  const conSpot = (s: Side, y: number): Pt => { const yy = clamp(y, 5, 65); return { x: lineOf(s) - dirOf(s) * (12 + Math.abs(yy - 35) * 0.25), y: yy } }

  // ---- THE DEAD TIME: the walk to the next set piece, the ball to the man who will put it in play
  const deadCtl = (p: Play): Ctl => {
    const nx = nextAction(plays, p.n)
    if (!nx) return () => { ctx = { k: 'hold' } }
    if (p.kind === 'try' && nx.kind === 'conversion') {
      const s = nx.side, K = conSpot(s, nx.y), kk = who(nx.who, s, 10)
      const at = formGoal(s, K)
      return tau => {
        ctx = { k: 'form', at, v: V_JOG }
        ov[kk] = { x: K.x - dirOf(s) * 0.35, y: K.y, v: 6.5 }
        if (tau > 1.0) give(kk)
        return tau > 2 && holder === kk && hyp(B[kk], { x: K.x - dirOf(s) * 0.35, y: K.y }) < 1 && formed(at, 3, 6)
      }
    }
    const f = formFor(nx)
    if (!f) return () => { /* open play goes on: the shape of the play just made */ }
    return tau => {
      ctx = { k: 'form', at: f.at, v: V_JOG }
      // the man who puts it in play walks to the ball, picks it up and takes it to the mark (nobody throws it to him across the field)
      if (holder === f.fetch) ov[f.fetch] = { x: f.spot.x, y: f.spot.y, v: 4 }
      // (a man of the other side who has it puts it down where he is: nobody walks off with the other side's ball)
      else if (holder >= 0 && sideOfSlot(holder) !== sideOfSlot(f.fetch) && !fly) { drop(); ball.lift = 0; ov[f.fetch] = { x: ball.x, y: ball.y, v: 4 } }
      else if (fly || (holder >= 0 && hyp(B[holder], B[f.fetch]) > 12)) ov[f.fetch] = { x: ball.x, y: ball.y, v: 4 }
      else if (holder >= 0) { ov[f.fetch] = { x: ball.x, y: ball.y, v: 4 }; if (hyp(B[holder], B[f.fetch]) < 3) give(f.fetch) }
      else { pickUp(f.fetch); ov[f.fetch] = { x: ball.x - dirOf(sideOfSlot(f.fetch)) * 0.35, y: ball.y, v: 4 } }
      // (the walk is over when the set piece is set: everybody in place and the ball with the man who puts it in play)
      return tau > 1.5 && holder === f.fetch && hyp(B[f.fetch], f.spot) < 1.5 && formed(f.at, 2, 3)
    }
  }
  /** is everybody (but a few stragglers) at his place in a formation */
  const formed = (at: Pt[], within = 2, allow = 3) => { let n = 0; for (let i = 0; i < 30; i++) if (!off[i] && at[i] && hyp(B[i], at[i]) > within) n++; return n <= allow }

  // ---- THE PLAYS. Each returns true once its action is done; mark() is the
  // moment the ball is where the record puts it (by default, the end).
  /** A CONDENSED PASSAGE: the ball travels on the ground from the last shown ruck to the ruck
   *  before the next shown phase, smoothly, and both sides keep their shape round it */
  /** A CONDENSED PASSAGE AS HANDOVERS: the ball goes forward along the passage in two or three
   *  carries of ten to fifteen metres, each carrier going to ground as the next man takes it off
   *  him, rather than one man running thirty metres. The phase count is on the plate. */
  interface Travel { t0: number; legs: Pt[]; j: number; c: number; from: Pt; legT0: number; used: number[]; passing: boolean }
  const travels = new Map<number, Travel>()
  const travelCtl = (n: number): Ctl => {
    const idx = cd.of[n], st = cd.stretches[idx], m = st.last - st.first + 1, k = n - st.first
    const lean = Math.sign(st.to.y - st.from.y) || (openSide(st.from.y) >= 0 ? 1 : -1)
    const d = dirOf(st.side)
    const dist = hyp(st.from, st.to), legs = dist > 28 ? 3 : dist > 13 ? 2 : 1
    const legT = st.T / legs
    return () => {
      ctx = { k: 'open', att: st.side, O: { x: ball.x, y: ball.y }, tOut: Infinity, lean }
      let tr = travels.get(idx)
      if (!tr) {
        const c = holder >= 0 && sideOfSlot(holder) === st.side ? holder : nearest(st.side, ball, [], false)
        fly = null; roll = null
        const pts = Array.from({ length: legs + 1 }, (_, j) => ({ x: lerp(st.from.x, st.to.x, j / legs), y: lerp(st.from.y, st.to.y, j / legs) }))
        tr = { t0: -1, legs: pts, j: 0, c, from: { x: 0, y: 0 }, legT0: -1, used: [c], passing: false }
        travels.set(idx, tr)
      }
      const W = tr.legs
      // the first man has to have it
      if (tr.t0 < 0) {
        if (holder !== tr.c) { if (holder >= 0) drop(); pickUp(tr.c); ov[tr.c] = { x: ball.x - d * 0.35, y: ball.y, v: V_CAP }; return false }
        tr.t0 = t; tr.legT0 = t; tr.from = { x: B[tr.c].x, y: B[tr.c].y }
      }
      // the next man comes up on his shoulder, a stride behind, to take it off him
      const nextTo = W[Math.min(legs, tr.j + 1)]
      if (tr.j < legs - 1 && !tr.passing) {
        const want = { x: nextTo.x - d * 2.5, y: inY(nextTo.y + lean * 3.5) }
        let nx = tr.used.length > tr.j + 1 ? tr.used[tr.j + 1] : -1
        if (nx < 0) { nx = nearest(st.side, want, [...tr.used, st.side * 15 + 10, st.side * 15 + 13], false); tr.used.push(nx) }
        ov[nx] = { x: want.x, y: want.y, v: 7 }
      }
      if (!tr.passing && holder === tr.c) {
        const e = runK(t - tr.legT0, legT, 0.35, tr.j ? 0.5 : 0)
        ov[tr.c] = { x: lerp(tr.from.x, nextTo.x - d * 0.35, e), y: lerp(tr.from.y, nextTo.y, e), v: V_CAP, place: true }
        if (t - tr.legT0 >= legT && tr.j < legs - 1) {
          // tackled: he goes down and gets it away to the man behind him
          down[tr.c] = 0.9; tr.passing = true
          throwTo(tr.used[tr.j + 1], 0.35, 0.5)
        }
      }
      if (tr.passing && !fly && holder === tr.used[tr.j + 1]) { tr.passing = false; tr.j++; tr.c = holder; tr.legT0 = t; tr.from = { x: B[tr.c].x, y: B[tr.c].y } }
      const finished = tr.j === legs - 1 && !tr.passing && t - tr.legT0 >= legT
      const done = n === st.last ? finished : t - tr.t0 >= st.T * (k + 1) / m - 1e-9
      // at the end he goes to ground, and the ball is there for the next shown phase
      if (done && n === st.last && holder === tr.c) { drop({ x: st.to.x, y: st.to.y }); down[tr.c] = 0.8 }
      return done
    }
  }

  const ctlOf = (n: number): Ctl => {
    // A REPLACEMENT TAKES THE PLACE OF THE MAN HE REPLACED (round 10, seed 16: No. 23 came on for a hurt lock,
    // was named the lineout jumper at play 477, and the static bench map had him on the wing, so the throw
    // went 15 m across the field to him). From the change on, his id is the replaced man's slot.
    { const q = plays[n]; if (q.kind === 'substitution' && q.result === 'made' && q.who && q.with?.[0]) { const sl = idSlot.get(q.who); if (sl != null) { idSlot.set(q.with[0], sl); idSlot.delete(q.who) } } }
    // (the slot of the man the play names, as it stands when the play starts: the screen's name tags go by it)
    { const q = plays[n]; whoSlot[n] = q.who ? idSlot.get(q.who) ?? -1 : -1 }
    if (cd.of[n] >= 0) return travelCtl(n)
    const p = plays[n], s = p.side, d = dirOf(s), o = other(s), q = plays[n - 1]
    const nx = plays[n + 1]
    const plan0 = segs[n]
    const leanTo = (to: Pt | undefined, from: Pt) => to ? (Math.sign(to.y - from.y) || (openSide(from.y) >= 0 ? 1 : -1)) : (openSide(from.y) >= 0 ? 1 : -1)
    switch (p.kind) {
      case 'kickoff': case 'dropout22': case 'goalLineDropout': {
        const kk = who(p.who, s, 10), L = spot(p)
        const fromX = p.kind === 'kickoff' ? 50 : (p.kind === 'dropout22' ? (s === 0 ? 22 : 78) : (s === 0 ? 0 : 100)) - d * 1
        const at = p.kind === 'kickoff' ? formKickoff(s, kk) : formDropout(s, fromX + d, kk)
        // the kick that is wrong (not ten metres, or out on the full) goes out over the near touchline
        // (the record writes such a kick-off's landing as if it were good: requests.md, 21 Nov)
        const bad = nx?.kind === 'restartError'
        const land = !bad ? L : nx.result === 'notTen' ? { x: 50 + d * 6, y: inY(35 + (L.y < 35 ? -6 : 6)) } : { x: L.x, y: L.y < 35 ? -1.5 : 71.5 }
        const hang = Math.max(1.5, plan0.act - 0.8)
        const catcher = nx && (nx.kind === 'catch' || nx.kind === 'knockOn') ? who(nx.who, nx.side, nx.side === s ? 6 : 15) : -1
        let kicked = -1
        return tau => {
          if (kicked < 0) {
            ctx = { k: 'form', at, v: V_JOG }
            give(kk)
            ov[kk] = { x: fromX - d * Math.max(0, 0.8 - tau), y: 35, v: 4 }
            // (the kick goes once the kicker has the ball and both sides are set)
            if (tau >= 0.8 && holder === kk && (formed(at, 2.5, 4) || tau > 4)) {
              kicked = tau
              const need = catcher >= 0 ? hyp(B[catcher], land) / 8.8 + 0.2 : 0
              kickTo(land, Math.max(hang, need), p.kind === 'kickoff' ? 14 : 12)
            }
            return false
          }
          ctx = { k: 'kick', kicker: s, L: land, lean: leanTo(undefined, land) }
          if (catcher >= 0) ov[catcher] = { x: land.x, y: inY(land.y), v: V_CAP }
          for (const i of chasers(s, land, 3)) if (i !== catcher) ov[i] = { x: land.x - d * 2, y: inY(land.y + ((i % 3) - 1) * 2), v: 8.6 }
          return !fly
        }
      }
      case 'catch': {
        const c = who(p.who, s, s === (q?.side ?? s) ? 6 : 15), L = spot(p)
        const kicked = q && (q.kind === 'kick' || q.kind === 'kickoff' || q.kind === 'dropout22' || q.kind === 'goalLineDropout')
        let rebound = false
        return tau => {
          ctx = kicked ? { k: 'kick', kicker: q.side, L, lean: leanTo(undefined, L), quick: !!segs[n].quick } : { k: 'open', att: s, O: L, tOut: 0, lean: leanTo(undefined, L) }
          if (q?.result === 'chargedDown' && !rebound && !fly && holder < 0) { rebound = true; kickTo(L, clamp(hyp(ball, L) / 10, 0.5, 1.1), 1.2, true) }
          ov[c] = holder === c ? { x: B[c].x + B[c].vx * 0.08, y: B[c].y + B[c].vy * 0.08, v: 3, a: 30 } : { x: ball.x - dirOf(s) * 0.35, y: ball.y, v: V_CAP }
          if (!fly && holder !== c) pickUp(c)
          return holder === c && tau >= 0.25
        }
      }
      case 'carry': case 'lineBreak': return carryCtl(n)
      case 'ruck': {
        const R = spot(p)
        const tackled = holder >= 0 && sideOfSlot(holder) === s ? holder : who(p.who, s, 8)
        const tk = (q?.vs ?? []).map(id => who(id, o, 7))
        const n9 = nearest(s, { x: R.x - d * 1.2, y: R.y }, [tackled], false)
        const nine = !off[slot(s, 9)] && slot(s, 9) !== tackled && hyp(B[slot(s, 9)], R) < 14 ? slot(s, 9) : n9
        const ruckers = nearestN(s, R, 2, [tackled, nine], true)
        const jackal = p.result === 'turnover' ? who(p.vs?.[0], o, 7) : -1
        const minT = plan0.act
        let grounded = false
        return tau => {
          ctx = { k: 'open', att: s, O: R, tOut: Infinity, lean: leanTo(nx ? spot(nx) : undefined, R) }
          if (!grounded) { grounded = true; if (holder === tackled || holder < 0) { holder = -1; want = -1; roll = { to: R, v: 6 } }; down[tackled] = Math.max(down[tackled], 0.9) }
          // A RUCK THAT READS: the tackled man on the ground over the ball, two of his side bound over
          // him, their tacklers bound against them, and the 9 at the base behind
          ov[tackled] = { x: R.x + d * 0.2, y: R.y + 0.9, v: 3 }; fl[tackled] |= 2
          ruckers.forEach((i, j) => { ov[i] = { x: R.x - d * 1.1, y: R.y + (j ? 0.7 : -0.7), v: 6 }; if (hyp(B[i], R) < 2.4) fl[i] |= 2 })
          tk.forEach((i, j) => { if (i === jackal) return; ov[i] = { x: R.x + d * 1.1, y: R.y + (j ? 0.7 : -0.7), v: 6 }; if (tau < 1.2 && hyp(B[i], R) < 2.4) fl[i] |= 2 })
          if (p.result === 'turnover') {
            ov[jackal] = { x: R.x + d * 0.35, y: R.y, v: V_CAP }
            if (tau > 0.5) pickUp(jackal)
            if (holder === jackal) ov[jackal] = { x: B[jackal].x, y: B[jackal].y, v: 1 }
            return holder === jackal && tau >= minT
          }
          ov[nine] = { x: R.x - d * 1.2, y: R.y + 0.6, v: 8 }
          // the ball comes out when the next play's men are there (a quick ruck when they already are)
          return tau >= minT && (ready(n + 1) || tau > minT + 1.5)
        }
      }
      case 'kick': return kickCtl(n)
      case 'intoTouch': {
        const to = spot(p)
        let started = false
        return tau => {
          ctx = { k: 'hold' }
          if (!started) { started = true; const out = p.out ? { x: p.out[0], y: p.out[1] } : { x: to.x, y: to.y < 35 ? -1.2 : 71.2 }; if (p.result === 'bounced') { if (holder < 0 && !fly) roll = { to: out, v: 8 } } else if (holder >= 0) drop(out) }
          return tau >= Math.min(plan0.act, 0.4) && !roll
        }
      }
      case 'knockOn': {
        const k = who(p.who, s, 15), L = spot(p)
        let knocked = false
        return tau => {
          ctx = { k: 'hold' }
          if (q?.kind === 'carry') return tau >= plan0.act
          // under the high ball, or in the chase: he gets to it and it goes forward off him
          ov[k] = { x: L.x, y: L.y, v: V_CAP }
          if (!knocked && !fly && holder < 0 && hyp(B[k], ball) < 1.8) { knocked = true; roll = { to: { x: L.x + d * 1.5, y: L.y }, v: 5 } }
          return knocked && !roll && tau >= plan0.act
        }
      }
      case 'deadBall': {
        // A DEAD BALL, BY ITS RESULT (round 7). Ran dead: it runs on to the record's `out`, beyond the
        // dead-ball line (or touch-in-goal), and stops there; nobody picks it up first. Touched down: it rolls
        // to the record's spot in the in-goal and a defender grounds it there.
        const dead = p.result !== 'touchedDown'
        const to2 = p.out ? { x: p.out[0], y: p.out[1] } : dead ? { x: lineOf(s) + d * (IN_GOAL + 2), y: clamp(ball.y, 1.5, 68.5) } : { x: lineOf(s) + d * 2, y: inY(ball.y) }
        const grounder = dead ? -1 : nearest(other(s), to2, [], false)
        let started = false, there = false
        return tau => {
          ctx = { k: 'hold' }
          if (!started && !fly) {
            started = true
            if (holder >= 0) drop()
            ball.lift = 0
            roll = { to: to2, v: Math.max(6, hyp(ball, to2) / Math.max(0.3, plan0.act - 0.25)) }
          }
          if (started && !roll && hyp(ball, to2) < 0.2) there = true
          if (grounder >= 0) { ov[grounder] = { x: to2.x - dirOf(other(s)) * 0.35, y: to2.y, v: V_CAP }; if (there && hyp(B[grounder], to2) < 1.2 && down[grounder] <= 0) down[grounder] = 1.2 }
          return there && tau >= plan0.act && (grounder < 0 || down[grounder] > 0 || tau > plan0.act + 3)
        }
      }
      case 'forwardPass': case 'notStraight': case 'unplayable': case 'restartError': {
        return tau => {
          ctx = { k: 'hold' }
          return tau >= plan0.act
        }
      }
      case 'scrum': {
        const M = spot(p), feed = s, win = p.ball
        const n9 = slot(feed, 9), w9 = slot(win, 9)
        const at = formScrum(feed, M)
        const feet = { x: M.x - dirOf(win) * 1.8, y: M.y }
        const plays2 = p.result === 'won' || p.result === 'againstTheHead'
        let set = -1, fed = false, hooked = false
        return tau => {
          ctx = { k: 'form', at, v: 4 }
          for (let k = 0; k < 8; k++) { fl[feed * 15 + k] |= 2; fl[o * 15 + k] |= 2 }
          // (the scrum goes down once the 9 has the ball at his feeding spot and the packs are set)
          if (set < 0) {
            if (holder !== n9) { if (holder < 0 && !fly) { pickUp(n9); ov[n9] = { x: ball.x, y: ball.y, v: 6 } } else if (holder >= 0 && hyp(B[holder], B[n9]) < 3) give(n9); else ov[n9] = { x: ball.x, y: ball.y, v: 6 } }
            if (holder === n9) ov[n9] = { x: at[n9].x, y: at[n9].y, v: 4 }
            if (holder === n9 && hyp(B[n9], at[n9]) < 1.5 && (formed(at, 1.5, 4) || tau > 3)) set = tau
            return false
          }
          const k = tau - set
          if (k < 0.7) return false
          if (!plays2) { if (k >= 1.0) mark(); return k >= 1.8 }
          if (!fed) { fed = true; kickTo(M, 0.4, 0.2) }
          if (k > 1.2 && !hooked && !fly) { hooked = true; kickTo(feet, 0.5, 0) }
          if (hooked && !fly) { ov[w9] = { x: ball.x - dirOf(win) * 0.35, y: ball.y, v: 6 }; pickUp(w9) }
          return hooked && holder === w9
        }
      }
      case 'lineout': if (p.result === 'quick') {
        // A QUICK THROW-IN: no lineout forms. The man who has it (the record's thrower) takes it at the
        // touchline and throws it in five metres to a man of his side running onto it.
        const tY = p.y < 35 ? 0 : 70, ts = tY === 0 ? 1 : -1
        const named0 = who(p.who, s, 11), thrower = hyp(B[named0], ball) < 12 ? named0 : nearest(s, ball, [], false), named = who(p.with?.[0], s, 9)
        const tSpot = { x: p.x, y: tY + ts * 0.5 }, rSpot = { x: p.x - d * 0.35, y: p.y }
        // (the man the record names takes it if he is near; from across the field the nearest man does: nobody waits five seconds for him)
        const recv = named !== thrower && hyp(B[named], rSpot) < 12 ? named : nearest(s, rSpot, [thrower], false)
        let thrown = -1
        return tau => {
          ctx = { k: 'open', att: s, O: spot(p), tOut: Infinity, lean: ts }
          ov[recv] = { x: rSpot.x, y: rSpot.y, v: 6 }
          if (thrown < 0) {
            if (holder !== thrower) { if (holder < 0 && !fly) { pickUp(thrower); ov[thrower] = { x: ball.x, y: ball.y, v: 6 } } else if (holder >= 0) give(thrower) }
            else ov[thrower] = { x: tSpot.x, y: tSpot.y, v: 5 }
            if (holder === thrower && hyp(B[thrower], tSpot) < 0.8 && (hyp(B[recv], rSpot) < 0.8 || tau > 5)) { thrown = tau; throwTo(recv, 0.45, 0.8) }
            return false
          }
          return holder === recv && tau - thrown >= 0.5
        }
      } else {
        const X = p.x, tY = p.y < 35 ? 0 : 70, ts = tY === 0 ? 1 : -1
        const at = formLineout(s, X, tY)
        const thrower = who(p.who, s, 2)
        const winner = p.ball
        const jumper = p.result === 'stolen' ? who(p.vs?.[0], winner, 4) : who(p.with?.[0], winner, 4)
        const jSpot = { x: X - dirOf(winner) * 0.5, y: tY + ts * 7 }
        const caught = p.result === 'won' || p.result === 'stolen'
        let thrown = -1
        return tau => {
          ctx = { k: 'form', at, v: 4 }
          ov[thrower] = { x: X, y: tY + ts * 0.6, v: 4 }
          if (caught) { ov[jumper] = { x: jSpot.x, y: jSpot.y, v: 5 } }
          if (thrown < 0) {
            give(thrower)
            if (tau >= 0.6 && holder === thrower && (((formed(at, 2, 4) || tau > 3.5) && (!caught || hyp(B[jumper], jSpot) < 0.6)) || tau > 6)) {
              thrown = tau
              if (caught) throwTo(jumper, 0.65, 3.5); else kickTo({ x: X, y: tY + ts * 6 }, 0.65, 3.5)
              if (!caught) mark()
            }
            return false
          }
          const k = tau - thrown
          if (caught && k < 1.0) fl[jumper] |= 8
          return caught ? holder === jumper && k >= 0.9 : k >= 1.0
        }
      }
      case 'maul': {
        const A = spot(q ?? p)
        const T = Math.max(0.3, plan0.act - 1.0)
        const carrier = holder >= 0 && sideOfSlot(holder) === s ? holder : who(undefined, s, 8)
        const end = p.result === 'driven' ? { x: lineOf(s) + d * 0.5, y: p.y } : spot(p)
        return tau => {
          const k = tau < 1.0 ? 0 : clamp((tau - 1.0) / T, 0, 1)
          const back = { x: lerp(A.x, end.x, k), y: lerp(A.y, end.y, k) }
          const front = { x: back.x + d * 1.6, y: back.y }
          ctx = { k: 'open', att: s, O: front, tOut: Infinity, lean: openSide(front.y) >= 0 ? 1 : -1 }
          if (holder >= 0 && holder !== carrier && !fly) throwTo(carrier, 0.3, 0.3)
          else if (holder < 0 && !fly) pickUp(carrier)
          ov[carrier] = { x: back.x - d * 0.35, y: back.y, v: 7, place: holder === carrier }
          const fw = [0, 1, 2, 3, 4, 5, 6, 7].filter(z => z !== carrier % 15)
          for (let j = 0; j < 7; j++) {
            const a = s * 15 + fw[j], b2 = o * 15 + j
            ov[a] = { x: front.x - d * (0.2 + (j % 3) * 0.7), y: front.y + ((j % 4) - 1.5) * 0.9, v: 6.5 }
            ov[b2] = { x: front.x + d * (0.6 + (j % 3) * 0.7), y: front.y + ((j % 4) - 1.5) * 0.9, v: 6.5 }
            if (hyp(B[a], front) < 3) fl[a] |= 2
            if (hyp(B[b2], front) < 3) fl[b2] |= 2
          }
          return tau >= plan0.act && holder === carrier && hyp(B[carrier], { x: end.x - d * 0.35, y: end.y }) < 0.6
        }
      }
      case 'penalty': case 'freeKick': {
        const M = spot(p)
        return tau => {
          ctx = { k: 'hold' }
          if (holder >= 0 || want >= 0) drop(M)
          else if (!fly && !roll && hyp(ball, M) > 0.3) roll = { to: M, v: 8 }
          return tau >= plan0.act && !fly && !roll && hyp(ball, M) <= 0.3
        }
      }
      case 'tap': {
        const M = spot(p), nine = who(undefined, s, 9)
        const at = formPenalty(s, M)
        return tau => { ctx = { k: 'form', at, v: V_JOG }; ov[nine] = { x: M.x - d * 0.35, y: M.y, v: 6.5 }; pickUp(nine); return holder === nine && tau >= 0.6 }
      }
      case 'penaltyGoal': case 'conversion': case 'dropGoal': {
        // (a penalty given on the line is kicked from 5 m out, as the law has it)
        const K0 = p.kind === 'conversion' ? conSpot(s, p.y) : p.kind === 'dropGoal' ? { x: p.x - d * 1.8, y: p.y } : spot(p)
        const K = p.kind === 'penaltyGoal' ? goalSpot(p) : K0
        const kk = who(p.who, s, 10)
        // (it crosses the try line between the uprights, 32.2 to 37.8, or outside them, and flies on 3 m)
        const posts = pastLine(K, { x: lineOf(s), y: p.good ? 35 : 35 + (p.y >= 35 ? 1 : -1) * 4.6 }, 3)
        const flight = 0.6 + hyp(K, posts) / 24
        const at = p.kind === 'dropGoal' ? null : formGoal(s, K)
        const lead = actOf(plays, n).mark
        let struck = -1
        return tau => {
          if (at) ctx = { k: 'form', at, v: 3 }
          else ctx = { k: 'open', att: s, O: spot(p), tOut: 0, lean: 1 }
          if (struck < 0) {
            if (p.kind === 'dropGoal' && holder !== kk && !fly && holder >= 0) { if (hyp(B[kk], K) < 3 || tau > 1.5) throwTo(kk, 0.55, 0.9); else ov[holder] = { x: B[holder].x, y: B[holder].y, v: 1.5, a: 30 } }
            else if (p.kind === 'dropGoal' && holder < 0 && !fly) { const c = nearest(s, ball, [kk], false); pickUp(c); ov[c] = { x: ball.x - d * 0.35, y: ball.y, v: V_CAP } }
            else if (holder !== kk && !fly && p.kind !== 'dropGoal') give(kk)
            ov[kk] = { x: K.x - d * 0.35, y: K.y, v: p.kind === 'dropGoal' ? 8 : 4 }
            if (tau >= lead && holder === kk && hyp(ball, K) < 0.8) { struck = tau; mark(); kickTo(posts, flight, p.kind === 'dropGoal' ? 8 : 10) }
            return false
          }
          ov[kk] = { x: K.x + d * 2, y: K.y, v: 3 }
          return !fly && tau - struck >= flight + 0.6
        }
      }
      case 'try': {
        const scorer = holder >= 0 && sideOfSlot(holder) === s ? holder : who(p.who, s, 11)
        const close = q?.kind === 'carry' && (q.shape === 'pickAndGo' || q.result === 'overTheLine') && Math.abs(lineOf(s) - q.x) < 6
        const at = { x: lineOf(s) + d * (close ? 0.6 : 1.2), y: inY(p.y) }
        // (close range: two of his bound on driving him over, three of theirs on the line holding them)
        const drivers = close ? nearestN(s, at, 2, [scorer], true) : [], wall = close ? nearestN(o, at, 3, [], false) : []
        let down0 = -1
        return tau => {
          ctx = { k: 'hold' }
          if (close && down0 < 0) {
            drivers.forEach((i, j) => { ov[i] = { x: B[scorer].x - d * 0.8, y: inY(B[scorer].y + (j ? 0.6 : -0.6)), v: V_CAP }; fl[i] |= 2 })
            wall.forEach((i, j) => { ov[i] = { x: lineOf(s) + d * 0.2, y: inY(at.y + (j - 1) * 0.9), v: 6 }; if (hyp(B[i], B[scorer]) < 2.2) fl[i] |= 2 })
            if (holder === scorer) fl[scorer] |= 2
          }
          if (down0 < 0) {
            if (holder !== scorer && !fly) pickUp(scorer)
            ov[scorer] = { x: at.x - d * 0.35, y: at.y, v: 7, place: holder === scorer }
            if (holder === scorer && hyp(B[scorer], { x: at.x - d * 0.35, y: at.y }) < 0.5 && tau >= 0.4) { down0 = tau; drop(); ball.x = at.x; ball.y = at.y; down[scorer] = 1.2; mark() }
            return false
          }
          // his side come to him; theirs walk back
          for (let k = 0; k < 15; k++) { const i = s * 15 + k; if (i !== scorer && !off[i] && hyp(B[i], at) < 25) ov[i] = { x: at.x - d * (3 + (k % 3)), y: inY(at.y + ((k % 5) - 2) * 2), v: 4 } }
          return tau - down0 >= 1.3
        }
      }
      case 'offload': {
        // AN OFFLOAD: in the tackle the carrier slips it to the man on his shoulder (the record's `with`)
        const giver = holder >= 0 && sideOfSlot(holder) === s ? holder : who(p.who, s, 8)
        const recv = who(p.with?.[0], s, 12)
        const at = spot(p)
        // (his shoulder on the side away from the tacklers, where there is room for a man to run onto it: a
        // receiver sent to a spot a tackler stands on is held off it by the others and never gets there)
        let rSpot = { x: at.x - d * 0.5, y: inY(at.y + (at.y < 35 ? 1.2 : -1.2)) }
        let placed = false
        let thrown = false
        return tau => {
          if (!placed) {
            placed = true
            const room = (c: Pt) => { let m = Infinity; for (let i = 0; i < 30; i++) if (i !== giver && i !== recv && !off[i]) m = Math.min(m, hyp(B[i], c)); return m }
            const cands = [1.2, -1.2, 1.8, -1.8].map(dy => ({ x: at.x - d * 0.5, y: inY(at.y + dy) })).filter(c => Math.abs(c.y - at.y) > 0.9)
            rSpot = cands.reduce((a, c) => (room(c) > room(a) + 0.2 ? c : a), cands[0])
          }
          ctx = { k: 'open', att: s, O: at, tOut: Infinity, lean: at.y < 35 ? 1 : -1 }
          ov[recv] = { x: rSpot.x, y: rSpot.y, v: V_CAP }
          if (holder === giver) ov[giver] = { x: B[giver].x, y: B[giver].y, v: 1, a: 30 }
          if (!thrown && holder === giver && (hyp(B[recv], rSpot) < 0.8 || tau > 6)) { thrown = true; throwTo(recv, 0.3, 0.4); down[giver] = 0.8 }
          if (!thrown && holder < 0 && !fly) { pickUp(recv); ov[recv] = { x: ball.x, y: ball.y, v: V_CAP } }
          return holder === recv && tau >= 0.3
        }
      }
      case 'penaltyTry': {
        // (Law 8.3: awarded under the posts. The ball is taken there; nobody runs with it.)
        const at = { x: lineOf(s) + d * 0.5, y: 35 }
        let started = false
        return tau => {
          ctx = { k: 'hold' }
          if (!started) { started = true; drop(); roll = { to: at, v: 8 } }
          return tau >= 1.5 && !roll
        }
      }
      case 'heldUp': {
        const carrier = holder >= 0 && sideOfSlot(holder) === s ? holder : who(p.who, s, 8)
        const at = { x: lineOf(s) + d * 0.6, y: inY(p.y) }
        return tau => {
          ctx = { k: 'hold' }
          if (holder !== carrier && !fly) pickUp(carrier)
          ov[carrier] = holder === carrier ? { x: at.x - d * 0.35, y: at.y, v: 4 } : { x: ball.x - d * 0.35, y: ball.y, v: V_CAP }
          fl[carrier] |= 2
          nearestN(o, at, 3, [], false).forEach((i, j) => { ov[i] = { x: at.x + d * 0.3, y: at.y + (j - 1) * 0.7, v: 7 }; fl[i] |= 2 })
          if (holder === carrier && tau >= 0.3) mark()
          return tau >= plan0.act && holder === carrier
        }
      }
      case 'yellowCard': case 'redCard': {
        const man = who(p.who, s, 6)
        let gone = false
        return tau => {
          ctx = { k: 'hold' }
          if (!gone) {
            gone = true
            offUntil[man] = p.kind === 'redCard' ? Infinity : p.until ?? p.t + 600
            off[man] = true; offVer++
            if (holder === man || want === man) drop({ x: B[man].x, y: B[man].y })
          }
          return tau >= plan0.act
        }
      }
      default:
        return tau => { ctx = { k: 'hold' }; return tau >= plan0.act }
    }
  }

  /** the n men of side s nearest a point (forwards only if asked) */
  const nearestN = (s: Side, p: Pt, n: number, skip: number[], forwards: boolean): number[] => {
    const out: number[] = []
    for (let j = 0; j < n; j++) out.push(nearest(s, p, [...skip, ...out], forwards))
    return out
  }
  const chasers = (s: Side, p: Pt, n: number) => nearestN(s, p, n, [], false)

  // ---- THE CARRY
  /** the men a carry needs: the carrier, the backs who move it on to him, where each stands, who tackles him */
  /** (worked out once a play, again only when somebody goes to or comes back from the bin) */
  let offVer = 0
  const menCache = new Map<number, { v: number; m: ReturnType<typeof carryMen0> }>()
  const carryMen = (n: number) => {
    const hit = menCache.get(n)
    if (hit && hit.v === offVer) return hit.m
    const m = carryMen0(n)
    menCache.set(n, { v: offVer, m })
    return m
  }
  const carryMen0 = (n: number) => {
    const p = plays[n], s = p.side, o = other(s), g = carryGeo(plays, n), d = g.dir
    let carrier = who(p.who, s, g.wide ? 12 : 8)
    // a forward pass thrown by the man the record names (he had the ball): it goes to the nearest back to the spot
    if (g.fwdPass && p.who && heldBy(plays[n - 1]) === p.who) {
      let bi = -1, bd = Infinity
      for (const k of [11, 12, 9, 14, 10, 13]) { const i = s * 15 + k; if (off[i] || i === carrier) continue; const dd = hyp(B[i], g.R); if (dd < bd) { bd = dd; bi = i } }
      if (bi >= 0) carrier = bi
    }
    const tk = (p.vs ?? []).map(id => who(id, o, 7)).filter(i => !off[i])
    // an interception: the man who reads it steps into the lane and takes the last pass
    const thief = p.result === 'intercepted' ? who(p.vs?.[0], o, 13) : -1
    // the man who gives the last pass, when the record names him
    const giver = p.with?.[0] ? who(p.with[0], s, 9) : -1
    let mids: Pt[] = []
    for (let k = 1; k < g.passes; k++) {
      const f = k / g.passes
      const to = thief >= 0 ? { x: g.A.x - d * 4, y: g.B.y } : g.R
      mids.push({ x: lerp(g.A.x - d * 1.5, to.x, f), y: inY(lerp(g.A.y, to.y, f)) })
    }
    let chain: number[] = []
    for (const k of [9, 11, 12, 14, 8, 10, 13]) {
      if (chain.length >= mids.length) break
      const i = s * 15 + k
      if (i !== carrier && i !== giver && !off[i]) chain.push(i)
    }
    if (giver >= 0 && giver !== carrier && mids.length) chain[chain.length - 1] = giver
    // THE SHAPE IT IS RUN IN (round 6: the record's `shape`, with the men in `via`). Each is drawn so a
    // watcher can tell it from the others: a pod's three together, a tip-on short, the pull-back behind a
    // front runner who carries on as the dummy, the miss pass over a man, the loop round the back, the
    // switch cutting across, the kick pass in the air.
    const L = Math.sign(g.B.y - g.A.y) || (openSide(g.A.y) >= 0 ? 1 : -1)
    let Rs = thief >= 0 ? g.B : g.R
    const sh = g.self || g.fwdPass || thief >= 0 ? undefined : p.shape
    let podMates: number[] = [], decoy = -1, skipped = -1, loop = false, crossing = false, kickPass = false
    const via = (p.via ?? []).map(id => who(id, s, 9)).filter(i => i !== carrier && !off[i])
    if (sh && via.length >= 2 && via.length - 1 === chain.length && new Set(via).size === via.length) chain = via.slice(1)
    const A0 = g.A, M = (dx: number, dy: number): Pt => ({ x: A0.x - d * dx, y: inY(A0.y + L * dy) })
    const fwds = (n2: number, skip: number[]) => { const o2: number[] = []; for (const k of [3, 4, 5, 6, 7, 0, 1, 2]) { const i = s * 15 + k; if (o2.length < n2 && !off[i] && !skip.includes(i) && i !== carrier) o2.push(i) } return o2 }
    if (sh === 'tipOn' && chain.length >= 1) { mids[mids.length - 1] = M(2, 3); Rs = M(1.4, 4.6) }
    else if (sh === 'pod' || sh === 'oneOut') { Rs = M(2.5, sh === 'pod' ? 5 : 3.5); if (sh === 'pod') podMates = fwds(2, [...chain, giver]) }
    else if (sh === 'podOff' && chain.length >= 1) { mids[mids.length - 1] = M(6, 7); Rs = M(3.5, 11); podMates = fwds(2, [...chain, giver]) }
    else if (sh === 'pullBack' && chain.length >= 1) { mids[mids.length - 1] = M(1.6, 6); Rs = M(6.5, 8.5); decoy = chain[chain.length - 1] }
    else if (sh === 'miss' && chain.length >= 1) {
      const lm = mids[mids.length - 1]
      Rs = { x: lm.x, y: inY(lm.y + L * 11) }
      for (const k of [11, 12, 10, 13, 9, 7]) { const i = s * 15 + k; if (!off[i] && i !== carrier && !chain.includes(i)) { skipped = i; break } }
    } else if ((sh === 'loop' || sh === 'wraparound') && chain.length >= 1) { const lm = mids[mids.length - 1]; Rs = { x: lm.x - d * 1.5, y: inY(lm.y + L * 3.5) }; loop = true }
    else if (sh === 'switch' && chain.length >= 1) { const lm = mids[mids.length - 1]; Rs = { x: lm.x - d * 0.6, y: inY(lm.y + L * 1.2) }; crossing = true }
    else if (sh === 'kickPass') kickPass = true
    return { p, g, carrier, tk, mids: mids.slice(0, chain.length), chain, thief, giver: g.passes === 1 && giver !== carrier ? giver : -1, Rs, L, sh, podMates, decoy, skipped, loop, crossing, kickPass }
  }
  /** is the next play's main man where it needs him */
  const ready = (m: number): boolean => {
    const p = plays[m]
    if (!p) return true
    if (p.kind === 'carry' || p.kind === 'lineBreak') {
      const { g, carrier, chain, mids } = carryMen(m)
      return (g.passes === 0 || hyp(B[carrier], carryMen(m).Rs) < 3.5) && chain.every((i, j) => hyp(B[i], mids[j]) < 4)
    }
    if (p.kind === 'kick') {
      const g = kickGeo(plays, m), kk = who(p.who, p.side, p.kick === 'box' ? 9 : 10)
      return p.kick === 'box' || !g.fromHand || hyp(B[kk], { x: g.A.x - g.dir * 7, y: g.A.y }) < 5
    }
    return true
  }
  const carryCtl = (n: number): Ctl => {
    const { p, g, carrier, tk, mids, chain: mids2, thief, giver, Rs, L, podMates, decoy, skipped, loop, crossing, kickPass } = carryMen(n)
    const s = p.side, o = other(s), d = g.dir
    // (an interception: the last pass is thrown for the carrier and taken by their man in the lane)
    const chain = [...mids2, thief >= 0 ? thief : carrier]
    const spots = [...mids, Rs]
    let passedAt = -1
    const latch = p.shape === 'pickAndGo' ? nearestN(s, g.A, 2, [carrier, ...mids2], true) : []
    let first = -1, next = 0, sent = 0
    let run: { from: Pt; T: number; a0: number; t0: number } | null = null
    let spilt = -1, fwdAt = -1, stolen = -1
    const lean = Math.sign(g.B.y - g.A.y) || (openSide(g.A.y) >= 0 ? 1 : -1)
    const back = carrier % 15 >= 8
    // (the highlight clips' paces: a back's sprint 9.3 m/s, a forward's 7.4, a break a little quicker)
    const vRun = g.brk ? RUN_BREAK : back ? RUN_BACK : RUN_FWD
    return tau => {
      // (T: where the record has him stopped, so the line comes up to meet him there and no further)
      ctx = { k: 'open', att: s, O: g.A, tOut: segs[n].a0 + g.pick, lean, T: g.brk || thief >= 0 ? undefined : g.B.x }
      // the man who has it: the 9 at the base (or the man the record says gave the pass, or whoever is there), the jumper, the catcher
      if (first < 0) {
        first = holder >= 0 && sideOfSlot(holder) === s ? holder
          : g.passes === 0 ? carrier
          : giver >= 0 && hyp(B[giver], ball) < 6 ? giver
          : want >= 0 && sideOfSlot(want) === s && !mids2.includes(want) ? want : nearest(s, g.A, [carrier, ...mids2, ...podMates, skipped, decoy], false)
      }
      if (holder !== first && holder < 0 && !fly && next === 0) { pickUp(first); ov[first] = { x: ball.x - d * 0.35, y: ball.y, v: V_CAP } }
      // the receivers into their places, the carrier into his (an intercepted carrier still runs his line)
      // (and a man keeps his place while the ball is in the air to him)
      chain.forEach((i, j) => { if ((j >= next || (fly && j === next - 1)) && i !== holder) ov[i] = { x: spots[j].x, y: spots[j].y, v: V_CAP } })
      const lastPasser = mids2.length ? mids2[mids2.length - 1] : -1
      if ((loop || crossing) && lastPasser >= 0 && holder !== carrier && !run) {
        const lp = spots[spots.length - 2]
        // the loop: he waits inside the man with it, then goes round the back of him; the switch: he waits
        // outside, and the man with it drifts across towards him before he cuts back in
        if (loop) ov[carrier] = holder === lastPasser || (fly && next === chain.length - 1) ? { x: lp.x - d * 2.6, y: inY(lp.y + L * 1.8), v: V_CAP } : { x: lp.x - d * 1.2, y: inY(lp.y - L * 1.6), v: V_CAP }
        else { ov[carrier] = holder === lastPasser ? { x: Rs.x, y: Rs.y, v: V_CAP } : { x: lp.x - d * 1.2, y: inY(lp.y + L * 5), v: V_CAP }; if (holder === lastPasser) ov[lastPasser] = { x: lp.x, y: inY(lp.y + L * 3), v: 4.5 } }
      }
      // A PICK AND GO (round 6: it read as a static pile): one or two of his forwards latch on behind him
      // and drive, bound to him, low; the defence meets them on its line
      if (p.shape === 'pickAndGo' && run) latch.forEach((i, j) => { ov[i] = { x: B[carrier].x - d * 0.8, y: inY(B[carrier].y + (j ? 0.6 : -0.6)), v: V_CAP }; if (hyp(B[i], B[carrier]) < 1.6) fl[i] |= 2 })
      // a pod: the two either side of him go with him into the line
      if (podMates.length) podMates.forEach((i, j) => { if (i !== holder && i !== first) ov[i] = run ? { x: B[carrier].x - d * 0.9, y: inY(B[carrier].y + (j ? 1.7 : -1.7)), v: V_CAP } : { x: Rs.x - d * 0.8, y: inY(Rs.y + (j ? 1.7 : -1.7)), v: V_CAP } })
      // the pull-back's front runner carries on hard at the line as the dummy; the miss pass's skipped man runs his line
      if (decoy >= 0 && passedAt >= 0 && holder !== decoy && tau - passedAt < 1.4) ov[decoy] = { x: spots[spots.length - 2].x + d * 5, y: inY(spots[spots.length - 2].y + L * 1.2), v: 7.5 }
      if (skipped >= 0 && skipped !== first && skipped !== holder && !run) { const lm = spots[spots.length - 2]; ov[skipped] = passedAt >= 0 ? { x: lm.x + d * 3, y: inY(lm.y + L * 5.5), v: 7 } : { x: lm.x - d * 0.5, y: inY(lm.y + L * 5.5), v: V_CAP } }
      if (thief >= 0 && holder !== carrier) ov[carrier] = { x: g.R.x === g.B.x ? g.B.x - d * 3 : g.R.x, y: g.B.y + (g.B.y < 35 ? 4 : -4), v: V_CAP }
      // the passes: each when its man is in place (or when he has kept them waiting long enough)
      if (!run && next < chain.length && !fly && holder >= 0 && holder !== chain[next] && tau >= g.pick && tau - sent >= 0.2) {
        const to = chain[next], dist = hyp(ball, B[to])
        const last = next === chain.length - 1
        if (hyp(B[to], spots[next]) < (last ? (thief >= 0 ? 0.8 : 1.5) : 2.5) || tau > g.pick + (last && thief >= 0 ? 8 : 4) + next) {
          const lastPass = next === chain.length - 1
          if (lastPass) passedAt = tau
          // (the kick pass goes up and over to the wing; the miss pass is long and a little higher)
          if (lastPass && kickPass) throwTo(to, Math.max(0.9, dist / 15), Math.min(9, 3 + dist / 5))
          else throwTo(to, clamp(dist / (lastPass && skipped >= 0 ? 19 : 17), 0.25, 0.95), Math.min(1.8, 0.4 + dist / (lastPass && skipped >= 0 ? 12 : 20)))
          next++; sent = tau
        }
      } else if (!run && next < chain.length && holder === chain[next]) next++
      // the man passing it on stands; the carrier gathers it and goes
      if (holder >= 0 && holder !== carrier && holder !== thief && !run) ov[holder] = { x: B[holder].x, y: B[holder].y, v: 1.5, a: 30 }
      if (thief >= 0) {
        if (holder === thief && stolen < 0) stolen = tau
        if (holder === thief) ov[thief] = { x: B[thief].x, y: B[thief].y, v: 1, a: 40 }
        return stolen >= 0 && tau - stolen >= g.spill
      }
      if (g.fwdPass) {
        if (holder === carrier && fwdAt < 0) fwdAt = tau
        if (holder === carrier) ov[carrier] = { x: B[carrier].x, y: B[carrier].y, v: 2, a: 30 }
        return fwdAt >= 0 && tau - fwdAt >= g.spill
      }
      if (!run && holder === carrier) {
        const from = { x: B[carrier].x, y: B[carrier].y }
        const T = Math.max(g.runT * 0.8, hyp(from, g.B) / vRun + 0.35, 0.6)
        run = { from, T, a0: clamp(Math.max(0, B[carrier].vx * d) / vRun, 0, 0.8), t0: tau }
      }
      if (run) {
        const k = runK(tau - run.t0, run.T, 0.35, run.a0)
        ov[carrier] = { x: lerp(run.from.x, g.B.x - d * 0.35, k), y: lerp(run.from.y, g.B.y, k), v: V_CAP, place: true }
        if (p.result === 'knockedOn' && spilt < 0 && k >= 1 && holder === carrier) { spilt = tau; drop({ x: g.B.x + d * 1.5, y: g.B.y }) }
      }
      // the tacklers: at where he will be tackled, meeting him there
      const rem = run ? run.T - (tau - run.t0) : 1.5
      tk.forEach((i, j) => {
        const meet = { x: g.B.x + d * 0.8, y: inY(g.B.y + (j ? 0.7 : -0.3)) }
        if (g.brk) { const tgt = rem < 1.5 ? meet : { x: lerp(B[i].x, meet.x, 0.6), y: lerp(B[i].y, meet.y, 0.6) }; ov[i] = { ...tgt, v: 9.2 } }
        else ov[i] = { ...meet, v: Math.min(V_CAP, Math.max(5, hyp(B[i], meet) / Math.max(0.3, rem) + 1.5)) }
        if (rem < 0.35 && hyp(B[i], ball) < 2) fl[i] |= 2
      })
      // PURPOSE OFF THE BALL (round 6; the clips' support runs at 6 m/s and their defenders at 5.3): two of
      // his own trail him at pace, one either shoulder, and the nearest defenders not making the tackle come
      // across to it from inside
      if (run && !g.brk) {
        const near = (side: Side, skip: number[], c: Pt, nmax: number) => {
          const out: number[] = []
          const cand: { i: number; d: number }[] = []
          for (let k = 0; k < 15; k++) { const i = side * 15 + k; if (off[i] || skip.includes(i) || down[i] > 0 || ov[i]) continue; cand.push({ i, d: hyp(B[i], c) }) }
          cand.sort((a, b) => a.d - b.d)
          for (const c2 of cand) { if (out.length >= nmax || c2.d > 18) break; out.push(c2.i) }
          return out
        }
        const cp = { x: B[carrier].x, y: B[carrier].y }
        near(s, [carrier, ...chain], cp, 2).forEach((i, j) => {
          ov[i] = { x: cp.x - d * 2.5, y: inY(cp.y + (j ? 2.4 : -2.4)), v: i % 15 >= 8 ? 8.5 : 7 }
        })
        const meet = { x: g.B.x + d * 1.5, y: g.B.y }
        near(o, tk, meet, 2).forEach((i, j) => {
          ov[i] = { x: meet.x + d * 0.5, y: inY(meet.y + (j ? 2.6 : -2.6)), v: 6.5 }
        })
      }
      // a break: the rest of their side turn and chase him
      if (g.brk && run) {
        // (the 15 runs the angle to cut him off where the record has him stopped; the far wing comes across late)
        const fb = o * 15 + 14, gone = tau - run.t0
        if (!off[fb] && !tk.includes(fb)) ov[fb] = { x: g.B.x + d * 1.5, y: g.B.y, v: 9.2 }
        for (let k = 0; k < 15; k++) {
          const i = o * 15 + k
          if (off[i] || tk.includes(i) || i === fb) continue
          // (the far wing holds his touchline a second before he comes across)
          const farWing = (k === 10 || k === 13) && Math.abs(B[i].y - ball.y) > 25
          if (farWing && gone < 1) continue
          const ahead = (B[i].x - ball.x) * d > 0
          ov[i] = ahead ? { x: lerp(B[i].x, g.B.x + d * 3, 0.5), y: lerp(B[i].y, g.B.y, 0.5), v: 8.5 } : { x: ball.x - d * (2 + (k % 4)), y: inY(ball.y + ((k % 5) - 2) * 2), v: 8.4 }
        }
      }
      if (!run) return false
      const ran = tau - run.t0 >= run.T && hyp(B[carrier], { x: g.B.x - d * 0.35, y: g.B.y }) < 0.5
      if (p.result === 'knockedOn') return spilt >= 0 && tau - spilt >= g.spill && !roll
      return ran
    }
  }

  /** THE NEXT PLAYS' MEN GO EARLY. A player reads the play: the man who will
   *  carry next is already moving to where he takes the pass, the backs who
   *  will move it on to him take their places, the tacklers drift across to
   *  him, the kicker drops into the pocket, the full-back gets under the kick.
   *  None of it moves the ball, so none of it can contradict the record. */
  const prepare = (m: number, soon: boolean) => {
    const p = plays[m]
    if (!p) return
    const put = (i: number, o2: Ov) => { if (i >= 0 && !off[i] && !ov[i] && i !== holder && i !== want && down[i] <= 0) ov[i] = o2 }
    if (p.kind === 'carry' || p.kind === 'lineBreak') {
      const { g, carrier, tk, mids, chain, thief } = carryMen(m)
      const { Rs } = carryMen(m)
      put(carrier, { x: Rs.x, y: Rs.y, v: soon ? 7 : 5 })
      if (thief >= 0) put(thief, { x: lerp(B[thief].x, g.B.x, soon ? 0.7 : 0.3), y: lerp(B[thief].y, g.B.y, soon ? 0.7 : 0.3), v: 8 })
      chain.forEach((i, j) => put(i, { x: mids[j].x, y: mids[j].y, v: soon ? 6 : 4.5 }))
      const B2 = { x: g.B.x + g.dir * 2.5, y: g.B.y }
      tk.forEach(i => { const t2 = targetOf(i); put(i, { x: lerp(t2.x, B2.x, soon ? 0.3 : 0.12), y: lerp(t2.y, B2.y, soon ? 0.3 : 0.12), v: 5 }) })
    } else if (p.kind === 'kick' && plays[m - 1]) {
      const g = kickGeo(plays, m), kk = who(p.who, p.side, p.kick === 'box' ? 9 : 10)
      if (g.fromHand && p.kick !== 'box') put(kk, { x: g.A.x - g.dir * 7, y: inY(g.A.y + (g.A.y < 35 ? 3 : -3)), v: 8 })
      // the back three drop for it
      const nx = plays[m + 1]
      if (nx && (nx.kind === 'catch' || nx.kind === 'knockOn') && nx.side !== p.side) {
        const c = who(nx.who, nx.side, 15)
        put(c, { x: lerp(B[c].x, g.L.x, 0.5), y: lerp(B[c].y, g.L.y, 0.5), v: 7 })
      }
    } else if (p.kind === 'dropGoal') {
      // the drop-goal man drops back into the pocket behind the ruck
      put(who(p.who, p.side, 10), { x: p.x - dirOf(p.side) * (soon ? 2.2 : 5), y: p.y, v: soon ? 8 : 6 })
    } else if (p.kind === 'offload') {
      // the support runner on the carrier's shoulder
      const recv = who(p.with?.[0], p.side, 12), d2 = dirOf(p.side)
      put(recv, { x: p.x - d2 * (soon ? 1.5 : 4), y: inY(p.y + (p.y < 35 ? 1.2 : -1.2)), v: soon ? 8 : 6 })
    } else if (p.kind === 'catch' && soon) {
      const c = who(p.who, p.side, 15)
      put(c, { x: p.x, y: p.y, v: V_CAP })
    } else if (p.kind === 'ruck' && p.result === 'turnover' && soon) {
      const j = who(p.vs?.[0], other(p.side), 7)
      put(j, { x: p.x + dirOf(p.side) * 1.5, y: p.y, v: 9 })
    }
  }

  // ---- THE KICK
  const kickCtl = (n: number): Ctl => {
    const p = plays[n], s = p.side, o = other(s), g = kickGeo(plays, n)
    const d = g.dir
    const kk = who(p.who, s, p.kick === 'box' ? 9 : 10)
    const box = p.kick === 'box'
    const pocket = g.fromHand ? (p.result === 'chargedDown' ? { x: g.A.x - d * 0.35, y: g.A.y } : box ? { x: g.A.x - d * 1.4, y: inY(g.A.y + 0.8) } : { x: g.A.x - d * 7, y: inY(g.A.y + (g.A.y < 35 ? 3 : -3)) }) : { x: g.A.x - d * 0.35, y: g.A.y }
    const nx = plays[n + 1]
    const catcher = nx && (nx.kind === 'catch' || nx.kind === 'knockOn') ? who(nx.who, nx.side, nx.side === s ? 6 : 15) : -1
    const charger = p.result === 'chargedDown' ? who(p.vs?.[0], o, 7) : -1
    let kicked = -1, first = -1
    const lowKick = p.kick === 'grubber'
    const h = p.result === 'chargedDown' ? 0.6 : lowKick ? 0.5 : p.kick === 'box' || p.kick === 'upAndUnder' ? 13 : 9
    const quick = !!segs[n].quick, vRun = quick ? 6 : V_CAP
    return tau => {
      if (kicked < 0) {
        ctx = { k: 'open', att: s, O: g.A, tOut: 0, lean: 1 }
        ov[kk] = { x: pocket.x, y: pocket.y, v: V_CAP }
        // the ball on the floor: the kicker takes it himself if he is on it, else the 9 (or whoever is nearest) picks it up and passes
        if (first < 0) first = holder >= 0 && sideOfSlot(holder) === s ? holder : hyp(B[kk], ball) < 4 ? kk : nearest(s, ball, [catcher, charger], false)
        if (holder < 0 && !fly) { pickUp(first); ov[first] = { x: ball.x - d * 0.35, y: ball.y, v: V_CAP } }
        if (holder >= 0 && holder !== kk && !fly && tau > 0.25 && hyp(B[kk], pocket) < 4) throwTo(kk, clamp(hyp(ball, B[kk]) / 16, 0.3, 0.8), 0.8)
        if (holder >= 0 && holder !== kk) ov[holder] = { x: B[holder].x, y: B[holder].y, v: 1.5, a: 30 }
        if (holder === kk) ov[kk] = p.result === 'chargedDown' ? { ...pocket, v: 3 } : { x: B[kk].x + d * 0.6, y: B[kk].y, v: 2, a: 30 }
        if (charger >= 0) ov[charger] = { x: B[kk].x + d * 1.2, y: B[kk].y, v: V_CAP }
        // the man who will take it reads it as it is set up
        if (catcher >= 0 && catcher !== kk) ov[catcher] = { x: g.L.x, y: inY(g.L.y), v: quick ? 5 : 8.5 }
        const settled = hyp(B[kk], pocket) < (p.result === 'chargedDown' ? 0.7 : 2) || tau > g.pre + 0.8
        if (holder === kk && tau >= g.pre - 0.02 && settled) {
          kicked = tau; mark0At(p)
          // (off the charger's hands: a step back off him, or, when the record has them score off it, bouncing back over the kicker's own line)
          if (p.result === 'chargedDown') kickTo(nx?.kind === 'try' ? { x: lineOf(o) + dirOf(o) * 1.2, y: inY(B[kk].y) } : { x: B[kk].x + d * 0.9, y: B[kk].y }, nx?.kind === 'try' ? 0.9 : 0.15, 0.6, nx?.kind === 'try')
          else {
            // (it hangs long enough for the man under it to get there, as the clips' kicks do)
            const need = catcher >= 0 ? hyp(B[catcher], g.L) / (vRun - 0.6) + 0.2 : 0
            kickTo(g.L, Math.max(g.hang, need), h, lowKick)
          }
        }
        return false
      }
      if (p.result === 'chargedDown') { ctx = { k: 'hold' }; if (charger >= 0) ov[charger] = { x: B[kk].x + d * 1.0, y: B[kk].y, v: 6 }; return !fly }
      ctx = { k: 'kick', kicker: s, L: g.L, lean: 1, quick }
      if (catcher >= 0) ov[catcher] = { x: g.L.x, y: inY(g.L.y), v: vRun }
      // the receivers nearest where it will land come across to cover the catcher (behind and either side of him)
      nearestN(o, g.L, 2, catcher >= 0 ? [catcher] : [], false).forEach((i, j) => { ov[i] = { x: g.L.x - dirOf(o) * 4, y: inY(g.L.y + (j ? 5 : -5)), v: quick ? 5 : 7 } })
      for (const i of chasers(s, g.L, 2)) if (i !== catcher && i !== kk) ov[i] = { x: g.L.x - d * 3, y: inY(g.L.y + ((i % 3) - 1) * 2.5), v: quick ? 5 : 8.6 }
      return !fly
    }
  }
  /** a kick charged down is where the record has it at the moment it is struck */
  const mark0At = (p: Play) => { if (p.result === 'chargedDown') mark() }

  // ---- THE REFEREE: a few metres behind the play on the open side, never in the way
  const refTarget = (): Pt => {
    const d = dirOf(poss)
    return { x: fx(ball.x - d * 7), y: inY(ball.y + (ball.y < 35 ? 8 : -8)) }
  }

  // ---- steering: the clips' arrive, with a top speed
  const steer = (b: Body, tx: number, ty: number, vmax: number, amax = A_PLAYER) => {
    const dx = tx - b.x, dy = ty - b.y, dist = Math.hypot(dx, dy)
    // (a dead band with a catch: a man on his spot stands still, and once settled he stays still until his place
    // is half a metre off, rather than creeping after every small change of it, which fast forward shows as a twitch)
    if (b.rest && dist < 0.5) { b.vx *= 0.6; b.vy *= 0.6; return }
    b.rest = dist < 0.15 && Math.hypot(b.vx, b.vy) < 0.4
    const wantV = dist < 0.15 ? 0 : Math.min(vmax, (dist - 0.15) * 2.4)
    const dvx = (dist > 1e-6 ? dx / dist * wantV : 0) - b.vx, dvy = (dist > 1e-6 ? dy / dist * wantV : 0) - b.vy
    let ax = dvx * 8, ay = dvy * 8
    const a = Math.hypot(ax, ay)
    if (a > amax) { ax *= amax / a; ay *= amax / a }
    b.vx += ax * DT; b.vy += ay * DT
    const v = Math.hypot(b.vx, b.vy)
    if (v > vmax) { const to = Math.max(vmax, v - amax * DT); b.vx *= to / v; b.vy *= to / v }
  }
  const placeToward = (b: Body, tx: number, ty: number) => {
    const dx = tx - b.x, dy = ty - b.y, dist = Math.hypot(dx, dy), mx = V_CAP * DT
    const k = dist > mx ? mx / dist : 1
    b.vx = dx * k / DT; b.vy = dy * k / DT
  }
  const separate = () => {
    for (let a = 0; a < 30; a++) {
      const p = B[a]
      for (let c = a + 1; c < 30; c++) {
        const q = B[c]
        const dx = q.x - p.x, dy = q.y - p.y
        if (dx > ROOM_M || dx < -ROOM_M || dy > ROOM_M || dy < -ROOM_M) continue
        if ((fl[a] & 2 && fl[c] & 2) || a === holder || c === holder || off[a] || off[c]) continue
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist >= ROOM_M || dist < 1e-6) continue
        if (ROOM_M - dist < 0.06) continue
        // (into their velocity, not their position: a shove the steering absorbs, rather than a step it pulls back every frame)
        const push = Math.min(0.6, (ROOM_M - dist) * 1.5)
        p.vx -= dx / dist * push; p.vy -= dy / dist * push; q.vx += dx / dist * push; q.vy += dy / dist * push
      }
    }
  }

  // ---- the opening: both sides formed up for the kick-off, the kicker on the ball
  // (overnight run: done again when the first play starts, for the live stream, whose record is still empty
  // when its baker is made: it began every match with thirty men on the centre spot walking out)
  // (where each man was a frame ago: set here, before the opening, which places them)
  const px = B.map(b => b.x), py = B.map(b => b.y)
  let opened = false
  const opening = () => {
    const p0 = plays[0]
    if (p0 && p0.kind === 'kickoff' && !opened) {
      opened = true
      const kk = who(p0.who, p0.side, 10)
      const at = formKickoff(p0.side, kk)
      for (let i = 0; i < 30; i++) { B[i].x = at[i].x; B[i].y = at[i].y; px[i] = B[i].x; py[i] = B[i].y }
      holder = kk; ball.x = B[kk].x; ball.y = B[kk].y
      poss = p0.side
    }
    ref.x = 50; ref.y = 44
  }
  opening()

  // ---- A FADE: everybody at his place for the set piece, the ball with the man who puts it in play
  const cutFrames: number[] = []
  const cutTo = (n: number, frame: number) => {
    const p = plays[n]
    let at: Pt[] | null = null, man = -1, spotAt: Pt | null = null
    if (p.kind === 'conversion') { const K = conSpot(p.side, p.y); at = formGoal(p.side, K); man = who(p.who, p.side, 10); spotAt = { x: K.x - dirOf(p.side) * 0.35, y: K.y } }
    else { const f2 = formFor(p); if (f2) { at = f2.at; man = f2.fetch; spotAt = f2.spot } }
    if (!at || man < 0 || !spotAt) return
    for (let i = 0; i < 30; i++) { if (off[i]) continue; B[i].x = at[i].x; B[i].y = at[i].y; B[i].vx = 0; B[i].vy = 0; px[i] = B[i].x; py[i] = B[i].y; down[i] = 0 }
    B[man].x = spotAt.x; B[man].y = spotAt.y; px[man] = spotAt.x; py[man] = spotAt.y
    fly = null; roll = null; want = -1; pick = false; holder = man
    ball.x = spotAt.x + dirOf(sideOfSlot(man)) * 0.35; ball.y = spotAt.y; ball.lift = 0
    ref.x = fx(ball.x - dirOf(p.side) * 7); ref.y = inY(ball.y + (ball.y < 35 ? 8 : -8)); ref.vx = ref.vy = 0
    cutFrames.push(frame)
  }
  // ---- THE LOOP
  let si = 0, f = 0, inDead = false, deadT0 = 0, deadReady = false, started = false, holdAct = false
  let ctl: Ctl = () => true, dctl: Ctl | null = null
  /** (streaming) may play k be started: enough of the plays after it are known */
  let gate = { final: true, ahead: 0 }
  const canStart = (k: number) => k < segs.length && (gate.final || plays.length > k + gate.ahead)
  const enterDead = (g: Seg) => { inDead = true; deadT0 = t; dctl = g.dead > 0 ? deadCtl(plays[g.n]) : null }
  const frame = (): 'frame' | 'need' | 'done' => {
    if (!started) {
      if (!canStart(0)) return segs.length || !gate.final ? 'need' : 'done'
      if (!opened) opening()
      started = true; segs[0].a0 = 0; ctl = ctlOf(0)
    }
    if (si >= segs.length) return 'done'
    t = f * DT
    // (the play is done, but where the men walk next is not known yet: wait for the next play)
    if (holdAct) { if (!gate.final && plays.length <= si + 1) return 'need'; holdAct = false; enterDead(segs[si]) }
    // (the walk is over, but the next play may not be started yet)
    if (inDead && si + 1 < plays.length + 1 && !gate.final && !canStart(si + 1) && (deadReady || t + DT - deadT0 >= (dctl ? segs[si].dead + 4 : segs[si].dead) - 1e-9)) return 'need'
    if (f >= cap) grow()
    const g = segs[si]
    ov.fill(null); fl.fill(0)
    // the match clock (a man in the bin comes back when it says so)
    const clock = plays[g.n].t
    for (let i = 0; i < 30; i++) if (off[i] && offUntil[i] !== Infinity && clock >= offUntil[i]) { off[i] = false; offUntil[i] = -1; offVer++ }
    poss = plays[g.n].ball
    if (!inDead) {
      const tau = t - g.a0
      const done = ctl(tau) === true
      prepare(g.n + 1, true); prepare(g.n + 2, false)
      // (a play that cannot finish, a man who never arrives, is cut short rather than waited on for ever)
      if (done || tau >= g.act * 3 + 6) {
        g.act = tau; g.mark = markAt >= 0 ? markAt : t
        if (!gate.final && plays.length <= g.n + 1) holdAct = true
        else enterDead(g)
      }
    } else if (dctl) deadReady = dctl(t - deadT0) === true
    // ---- the lateral anchors: slow in open play and under a kick, quick when nobody is in his shape
    // (under a kick everyone holds his lane, and so does the anchor: the side moves across once the ball is caught)
    if ((ctx as Ctx).k !== 'kick') updateAnchors((ctx as Ctx).k === 'form' || (ctx as Ctx).k === 'hold')
    bxs += (ball.x - bxs) * Math.min(1, DT / 0.9)
    bys += clamp((ball.y - bys) * Math.min(1, DT / 1.2), -3 * DT, 3 * DT)
    // (a new passage, or a line far off where it should be, is taken up at once: only the phase-to-phase sway is held)
    if ((ctx as Ctx).k === 'open') { const want = rawLine(); dLine = Math.abs(want - dLine) > 12 ? want : dLine + clamp(want - dLine, -LINE_V * DT, LINE_V * DT) }
    // ---- the men
    for (let i = 0; i < 30; i++) {
      const b = B[i]
      if (down[i] > 0) down[i] = Math.max(0, down[i] - DT)
      if (off[i]) { const c = benchOf(i); steer(b, c.x, c.y, 5); fl[i] |= 4 }
      else {
        const o2 = ov[i] ?? (pick && want === i ? { x: ball.x - dirOf(sideOfSlot(i)) * 0.35, y: ball.y, v: V_CAP } : targetOf(i))
        if (o2.place) placeToward(b, o2.x, o2.y)
        else if (down[i] > 0) { steer(b, b.x, b.y, 2, 30) }
        else steer(b, fx(o2.x), fy(o2.y), Math.min(V_CAP, o2.v), o2.a ?? A_PLAYER)
      }
      const v = Math.hypot(b.vx, b.vy)
      if (v > V_CAP) { b.vx *= V_CAP / v; b.vy *= V_CAP / v }
      b.x += b.vx * DT; b.y += b.vy * DT
      if (down[i] > 0) fl[i] |= 1
    }
    // NO WHOLE SIDE SLIDES ACROSS (round 7): the men in their shape (no part to play in this play, not off)
    // move across together no quicker than SIDE_VY on average; any more is taken off them all alike. A
    // side following a kick or a break is left alone (the chase), as is anyone with a job in the play.
    if ((ctx as Ctx).k === 'open' || (ctx as Ctx).k === 'hold') {
      // (the men the record names in this play and those either side of it keep their pace: they have the ball or the tackle)
      const named = new Set<number>()
      for (let k = Math.max(0, g.n - 1); k <= Math.min(plays.length - 1, g.n + 2); k++) { const q2 = plays[k]; for (const id of [q2.who, ...(q2.vs ?? []), ...(q2.with ?? []), ...(q2.via ?? [])]) { const sl = id ? idSlot.get(id) : undefined; if (sl != null) named.add(sl) } }
      if (holder >= 0) named.add(holder)
      for (const s2 of [0, 1] as Side[]) {
        let sum = 0, c = 0
        for (let k = 0; k < 15; k++) { const i = s2 * 15 + k; if (off[i] || named.has(i) || ov[i] || down[i] > 0) continue; sum += B[i].y - py[i]; c++ }
        if (c < 5) continue
        const m = sum / c, lim = SIDE_VY * DT
        if (Math.abs(m) <= lim) continue
        const cut = m - Math.sign(m) * lim
        for (let k = 0; k < 15; k++) { const i = s2 * 15 + k; if (off[i] || named.has(i) || ov[i] || down[i] > 0) continue; B[i].y -= cut; B[i].vy -= cut / DT }
      }
    }
    separate()
    // (and nobody faster than the cap after being eased apart)
    for (let i = 0; i < 30; i++) {
      const b = B[i], dx = b.x - px[i], dy = b.y - py[i], m2 = Math.hypot(dx, dy), mx = V_CAP * DT
      if (m2 > mx) { b.x = px[i] + dx * mx / m2; b.y = py[i] + dy * mx / m2 }
      px[i] = b.x; py[i] = b.y
    }
    { const r = refTarget(); steer(ref, r.x, r.y, 7); ref.x += ref.vx * DT; ref.y += ref.vy * DT }
    // ---- the ball
    if (fly) {
      const k = clamp((t - fly.t0) / fly.dur, 0, 1), e = fly.low ? 1 - (1 - k) * (1 - k) : smooth(k)
      const to = fly.to()
      ball.x = lerp(fly.from.x, to.x, e); ball.y = lerp(fly.from.y, to.y, e)
      ball.lift = fly.low ? Math.abs(Math.sin(k * Math.PI * 3)) * fly.h * (1 - k) : Math.sin(Math.PI * k) * fly.h
      if (k >= 1) { const th = fly.then; fly = null; ball.lift = 0; th?.() }
    } else if (want >= 0 && holder !== want && pick) {
      const b = B[want]
      if (Math.hypot(b.x + dirOf(sideOfSlot(want)) * 0.35 - ball.x, b.y - ball.y) < 1.0) { holder = want; want = -1; pick = false }
      if (roll) { const dx = roll.to.x - ball.x, dy = roll.to.y - ball.y, dist = Math.hypot(dx, dy); if (dist < 0.05) roll = null; else { const st = Math.min(dist, roll.v * DT); ball.x += dx / dist * st; ball.y += dy / dist * st } }
    } else if (want >= 0 && holder !== want) {
      const b = B[want], tx = b.x + dirOf(sideOfSlot(want)) * 0.35, ty = b.y
      const dx = tx - ball.x, dy = ty - ball.y, dist = Math.hypot(dx, dy)
      if (dist < 0.9) { holder = want; want = -1; pick = false }
      else { const st = Math.min(dist, 12 * DT); ball.x += dx / dist * st; ball.y += dy / dist * st; ball.lift = Math.min(1.2, dist * 0.15) }
    } else if (roll) {
      const dx = roll.to.x - ball.x, dy = roll.to.y - ball.y, dist = Math.hypot(dx, dy)
      if (dist < 0.05) roll = null
      else { const st = Math.min(dist, roll.v * DT); ball.x += dx / dist * st; ball.y += dy / dist * st }
      ball.lift = Math.max(0, ball.lift - DT * 3)
    }
    if (holder >= 0) { const b = B[holder]; ball.x = b.x + dirOf(sideOfSlot(holder)) * 0.35; ball.y = b.y; ball.lift = plays[g.n].kind === 'heldUp' ? 0.6 : 0 }
    // ---- write it down
    const o = f * 62
    for (let i = 0; i < 30; i++) { pos[o + i * 2] = B[i].x; pos[o + i * 2 + 1] = B[i].y; flags[f * 30 + i] = fl[i] }
    pos[o + 60] = ref.x; pos[o + 61] = ref.y
    ballA[f * 3] = ball.x; ballA[f * 3 + 1] = ball.y; ballA[f * 3 + 2] = ball.lift
    holderA[f] = holder; possA[f] = poss; segA[f] = g.n
    // ---- on to the next play once this one's dead time is walked
    if (inDead && (deadReady || t + DT - deadT0 >= (dctl ? g.dead + 4 : g.dead) - 1e-9)) {
      g.a1 = (f + 1) * DT; g.dead = g.a1 - g.a0 - g.act
      si++; inDead = false; markAt = -1; dctl = null; deadReady = false
      if (si < segs.length) { segs[si].a0 = g.a1; if (fadesIn(plays, si)) cutTo(si, f + 1); ctl = ctlOf(si) }
    }
    f++
    return 'frame'
  }
  return {
    run(frames, o = {}) {
      gate = { final: o.final ?? false, ahead: o.ahead ?? 3 }
      for (let c = 0; c < frames; c++) {
        const r = frame()
        if (r !== 'frame') return r
      }
      return 'budget'
    },
    more() {
      // the plays after the one being baked are planned again with what is now known; those started keep their times
      const fresh = plan(plays, level)
      for (let k = 0; k < fresh.length; k++) {
        if (k >= segs.length) segs.push({ ...fresh[k] })
        else if (k > si || (k === si && !started)) Object.assign(segs[k], { ...fresh[k], a0: segs[k].a0 })
        else if (k === si && !inDead) { segs[k].dead = fresh[k].dead; segs[k].key = fresh[k].key }
        else if (k === si) segs[k].key = fresh[k].key
      }
    },
    live: () => ({ plays, segs, whoSlot, cuts: cutFrames, n: f, pos: pos.subarray(0, f * 62), ball: ballA.subarray(0, f * 3), holder: holderA.subarray(0, f), poss: possA.subarray(0, f), seg: segA.subarray(0, f), flags: flags.subarray(0, f * 30) }),
    result: () => ({ plays, segs, whoSlot, cuts: cutFrames, n: f, pos: pos.slice(0, f * 62), ball: ballA.slice(0, f * 3), holder: holderA.slice(0, f), poss: possA.slice(0, f), seg: segA.slice(0, f), flags: flags.slice(0, f * 30) }),
    get frames() { return f },
    get at() { return si },
  }
}

// =====================================================================
// READING IT BACK
// =====================================================================

export interface Frame {
  men: Pt[]; ref: Pt; ball: Pt & { lift: number }
  holder: number; poss: Side; n: number; flags: number[]
}
/** everything on the pitch at anim time a, blended between the two nearest frames */
export function frameAt(bk: Baked, a: number): Frame {
  const f = clamp(a * FPS, 0, bk.n - 1), i = Math.floor(f), j = Math.min(bk.n - 1, i + 1), k = f - i
  const near = k < 0.5 ? i : j
  const P = (o: number) => lerp(bk.pos[i * 62 + o], bk.pos[j * 62 + o], k)
  return {
    men: Array.from({ length: 30 }, (_, m) => ({ x: P(m * 2), y: P(m * 2 + 1) })),
    ref: { x: P(60), y: P(61) },
    ball: { x: lerp(bk.ball[i * 3], bk.ball[j * 3], k), y: lerp(bk.ball[i * 3 + 1], bk.ball[j * 3 + 1], k), lift: lerp(bk.ball[i * 3 + 2], bk.ball[j * 3 + 2], k) },
    holder: bk.holder[near], poss: bk.poss[near] as Side, n: bk.seg[near],
    flags: Array.from(bk.flags.subarray(near * 30, near * 30 + 30)),
  }
}

/** where the record says the ball is at a play's mark, and how close the
 *  picture must be. Where the record's x, y is not the ball (a conversion is
 *  written at the try, a kick out on the full at the lineout mark, a drop
 *  goal at the ruck it came from) the exception is said here. */
export function expectedAt(p: Play, next?: Play): { x?: number; y?: number; tol: number } {
  // (a kick-off the next entry calls wrong is written as if it landed well: it is shown short, or out)
  if (p.kind === 'kickoff' && next?.kind === 'restartError') return { tol: Infinity }
  switch (p.kind) {
    case 'conversion': return { y: clamp(p.y, 5, 65), tol: 1.5 }
    // (struck 1.8 m behind the ruck the record puts it at)
    case 'dropGoal': return { x: p.x - dirOf(p.side) * 1.8, y: p.y, tol: 1.6 }
    case 'penaltyGoal': return { ...goalSpot(p), tol: 1.6 }
    case 'try': case 'heldUp': return { x: p.x, y: clamp(p.y, 1, 69), tol: 2.5 }
    case 'notStraight': case 'restartError': case 'unplayable': case 'forwardPass': return { tol: Infinity }
    // (a forward pass is written where it was thrown from: it is caught a stride or two in front of that)
    case 'carry': return p.result === 'forwardPass' ? { x: p.x, y: p.y, tol: 4 } : { x: p.x, y: p.y, tol: 1.6 }
    // (an offload is taken a stride from the tackle the record puts it at)
    case 'offload': return { x: p.x, y: p.y, tol: 2.5 }
    // (round 6: a kick is marked where it truly came down)
    case 'kick': return p.out && p.result === 'outOnFull' ? { x: p.out[0], y: p.out[1], tol: 1.6 } : p.out && (p.y <= 0.5 || p.y >= 69.5) ? { x: p.x, y: p.y, tol: 2.4 } : p.land ? { x: p.land[0], y: p.land[1], tol: 1.6 } : p.result === 'outOnFull' ? { y: p.y, tol: 2 } : { x: p.x, y: p.y, tol: 1.6 }
    case 'kickoff': return { x: p.x, tol: 2 }
    case 'knockOn': case 'maul': return { x: p.x, y: p.y, tol: 2.6 }
    // (the ball comes back to the No. 8's feet, 1.8 m behind the mark, and the 9 has it there)
    case 'scrum': return { x: p.x, y: p.y, tol: 3 }
    case 'lineout': return { x: p.x, y: p.y, tol: p.result === 'won' || p.result === 'stolen' ? 1.6 : 1.6 }
    case 'intoTouch': return { x: p.x, y: p.y, tol: 1.6 }
    case 'deadBall': return { tol: Infinity }
    case 'yellowCard': case 'redCard': case 'halfTime': case 'fullTime': return { tol: Infinity }
    // (a substitution is made while the ball is dead: its x, y is where play was, not where the ball is)
    case 'substitution': return { tol: Infinity }
    default: return { x: p.x, y: p.y, tol: 1.6 }
  }
}

// =====================================================================
// THE FEED: what LivePitch.tsx draws, read from the bake on the screen's clock
// =====================================================================

/** the chip on the pitch for each play (lp.* keys that already exist in the locales) */
function chipOf(p: Play): string {
  switch (p.kind) {
    // (overnight run: the set-piece call the record now carries, said on the label)
    case 'kickoff': return p.option === 'short' ? 'lp.koShort' : p.option === 'long' ? 'lp.koLong' : 'lp.kickoff'
    case 'dropout22': return 'lp.dropout22'
    case 'goalLineDropout': return 'lp.dropout'
    case 'scrum': return p.result === 'againstTheHead' ? 'lp.againstHead' : p.result === 'pushover' ? 'lp.pushover'
      : p.option === 'shove' ? 'lp.scrumShove' : p.option === 'eightPick' ? 'lp.scrumEight' : p.option === 'backRowMove' ? 'lp.scrumMove' : 'lp.scrum'
    case 'lineout': return p.result === 'stolen' ? 'lp.lineoutStolen' : p.option === 'front' ? 'lp.loFront' : p.option === 'middle' ? 'lp.loMiddle' : p.option === 'tail' ? 'lp.loTail' : 'lp.lineout'
    case 'maul': return 'lp.maul'
    case 'kick': return p.result === 'chargedDown' ? 'lp.chargeDown' : p.result === 'outOnFull' ? 'lp.outFull' : p.result === 'fiftyTwentyTwo' ? 'lp.fifty22'
      : p.kick === 'box' ? 'lp.boxKick' : p.kick === 'upAndUnder' ? 'lp.upAndUnder' : p.kick === 'grubber' ? 'lp.grubber' : p.result === 'touch' || p.result === 'penaltyToTouch' ? 'lp.kickTouch' : 'lp.kick'
    case 'catch': return 'lp.catch'
    case 'penalty': case 'freeKick': return p.warning ? 'lp.penWarning' : 'lp.penalty'
    case 'tap': return 'lp.quickTap'
    case 'penaltyGoal': return p.wind === 'with' ? 'lp.goalKickWith' : p.wind === 'into' ? 'lp.goalKickInto' : 'lp.goalKick'
    case 'conversion': return p.wind === 'with' ? 'lp.conWith' : p.wind === 'into' ? 'lp.conInto' : 'lp.con'
    case 'dropGoal': return 'lp.drop'
    case 'knockOn': return 'lp.knockOn'
    case 'forwardPass': return 'lp.forwardPass'
    case 'intoTouch': return 'lp.intoTouch'
    case 'heldUp': return 'lp.heldUp'
    case 'halfTime': return 'lp.halfTime'
    case 'fullTime': return 'lp.fullTime'
    case 'ruck': return p.result === 'turnover' ? 'lp.turnover' : 'lp.ruck'
    case 'try': case 'penaltyTry': return 'lp.try'
    case 'lineBreak': return 'lp.lineBreak'
    default: return 'lp.carry'
  }
}
/** the plates that say what just happened and who has the ball now */
const FLASH: Record<string, string> = { knockOn: 'lp.knockOn', forwardPass: 'lp.forwardPass', intoTouch: 'lp.intoTouch', penalty: 'lp.penalty', freeKick: 'lp.penalty', heldUp: 'lp.heldUp' }

type PhaseKindLike = 'kickoff' | 'scrum' | 'lineout' | 'maul' | 'ruck' | 'carry' | 'kick' | 'catch' | 'try' | 'con' | 'goal' | 'dropout' | 'penalty' | 'heldup' | 'break' | 'hold'
const KIND: Record<string, PhaseKindLike> = {
  penaltyTry: 'try', kickoff: 'kickoff', dropout22: 'dropout', goalLineDropout: 'dropout', scrum: 'scrum', lineout: 'lineout', maul: 'maul', ruck: 'ruck',
  carry: 'carry', lineBreak: 'break', kick: 'kick', catch: 'catch', try: 'try', conversion: 'con', penaltyGoal: 'goal', dropGoal: 'goal',
  penalty: 'penalty', freeKick: 'penalty', tap: 'penalty', heldUp: 'heldup',
}

export interface FeedBanner { kind: 'try' | 'pentry' | 'con' | 'conMiss' | 'pen' | 'penMiss' | 'dg' | 'dgMiss' | 'yc' | 'rc'; teamId: string; name?: string; min: number; at: number }

/**
 * THE FEED: the surface LivePitch draws from (the same names PitchSim has),
 * on the screen's own clock. step(dt) moves the screen on dt seconds; the
 * schedule turns that into anim time; the bake gives the picture.
 */
export class RecordFeed {
  /** the bake being read: the whole match's, or (StreamFeed) the part baked so far */
  get bk(): Baked { return this.src() }
  private src: () => Baked
  readonly tl!: Timeline
  /** seconds on screen since the kick-off */
  view = 0
  b: { x: number; y: number; vx: number; vy: number }[] = Array.from({ length: 30 }, () => ({ x: 50, y: 35, vx: 0, vy: 0 }))
  ref = { x: 50, y: 40, vx: 0, vy: 0 }
  ball = { x: 50, y: 35, lift: 0 }
  holder = -1
  down: number[] = new Array(30).fill(0)
  off: boolean[] = new Array(30).fill(false)
  private fl: number[] = new Array(30).fill(0)
  phase: { kind: PhaseKindLike; homeBall: boolean; at: number; label: string; x: number; y: number; fallback?: string } | null = null
  landed = false
  readonly pending = false
  readonly reached = true
  done = false
  /** how many dissolves have been passed (LivePitch dissolves when this changes) */
  cuts = 0
  /** 1: the feed keeps its own clock (the schedule), the screen is not to wind it on again */
  readonly rate = 1
  /** how many times life speed it is being shown at (the screen shows the fast-forward mark over 2.6) */
  speed = 1
  /** a routine phase the picture is travelling through (the screen shows the fast-forward mark) */
  condensed = false
  /** the fast-forward mark: a condensed passage, or the clock well over life speed */
  /** inside a key moment or a try build-up (a ruck pause in one is wound on, but it is not fast forward) */
  buildUp = false
  get ff(): boolean { return this.condensed || (this.speed >= 1.5 && !this.buildUp) }
  flash: { label: string; home: boolean; n: number; vars?: Record<string, string | number> } | null = null
  says: { k: string; home: boolean; src: number }[] = []
  banner: FeedBanner | null = null
  /** the play on screen now, by its index in the record */
  n = 0
  constructor(public plays: Play[], sides?: [RecSide, RecSide], private ids: [string, string] = ['home', 'away'], private nameOf?: (id: string) => string | undefined, live?: () => Baked) {
    if (live) this.src = live
    else {
      const bk = bakeOf(plays, sides)
      this.src = () => bk
      this.tl = timeline(bk)
      this.read()
    }
  }
  /** (overridden by StreamFeed) the anim second the screen is at, and its speed and kind there */
  protected animNow(): number { return animAt(this.tl, this.view) }
  protected rateAt(fa: number): number { return this.tl.rate[fa] ?? 1 }
  protected slowAt(fa: number): number { return this.tl.slow[fa] }
  get length(): number { return this.tl.total }
  protected isDone(): boolean { return this.view >= this.length - 1e-6 }
  /** the clock on dt seconds; the picture is read once, when it is drawn (sync) */
  step(dt: number) { if (this.done) return; this.view = Math.min(this.length, this.view + dt); this.dirty = true; this.done = this.view >= this.length - 1e-6 }
  protected dirty = false
  /** read the picture at the clock, if it has moved since it was last read (LivePitch calls this before drawing) */
  sync() { if (this.dirty) { this.dirty = false; this.read() } }
  seek(v: number) { this.view = clamp(v, 0, this.length); this.read() }
  /** the anim second last read, and the poses drawn over the bake there (pose.ts: never the ball or its holder) */
  anim = 0
  readonly poses = newPoses()
  /** set by LivePitch: no run-ups, lifts or gathering when the player asks for reduced motion */
  reduceMotion = false
  protected read() {
    const a = this.animNow()
    const fr = frameAt(this.bk, a)
    this.anim = a
    posesAt(this.bk, a, this.poses, this.reduceMotion)
    { const f = Math.round(a * FPS); let c = 0; for (const x of this.bk.cuts) if (x <= f) c++; this.cuts = c }
    for (let i = 0; i < 30; i++) {
      const m = fr.men[i], b = this.b[i]
      b.vx = m.x - b.x; b.vy = m.y - b.y; b.x = m.x; b.y = m.y
      this.fl[i] = fr.flags[i]; this.down[i] = fr.flags[i] & 1 ? 1 : 0; this.off[i] = !!(fr.flags[i] & 4)
    }
    this.ref.x = fr.ref.x; this.ref.y = fr.ref.y
    this.ball.x = fr.ball.x; this.ball.y = fr.ball.y; this.ball.lift = fr.ball.lift
    this.holder = fr.holder
    const n = fr.n, p = this.plays[n], seg = this.bk.segs[n]
    { const fa = clamp(Math.floor(a * FPS), 0, this.bk.n - 1); this.speed = this.rateAt(fa); const sl = this.slowAt(fa); this.buildUp = sl === 1 || sl === 3 }
    this.condensed = !!seg.condensed
    if (!this.phase || this.phase.at !== n) {
      // (lp.lineBreak is asked for in the locales, requests.md: until it is there the chip says it in English)
      this.phase = { kind: KIND[p.kind] ?? 'hold', homeBall: fr.poss === 0, at: n, label: chipOf(p), x: p.x, y: p.y, fallback: p.kind === 'lineBreak' ? 'Line break' : undefined }
      const fk = FLASH[p.kind] ?? (p.kind === 'ruck' && p.result === 'turnover' ? 'lp.turnover' : p.kind === 'kick' && p.result === 'chargedDown' ? 'lp.chargeDown' : undefined)
      if (fk) this.flash = { label: fk, home: (p.kind === 'knockOn' || p.kind === 'forwardPass' || p.kind === 'intoTouch' ? p.side : p.ball) === 0, n }
      // a condensed passage: the phase count it gets to, on the plate, while the picture travels
      if (seg.condensed && (n === 0 || !this.bk.segs[n - 1].condensed)) {
        let last = n
        while (this.bk.segs[last + 1]?.condensed) last++
        const ph = this.plays[last].phase ?? this.plays[last - 1]?.phase
        // (a count that low says nothing: the passage was short)
        if (ph && ph >= 3) this.flash = { label: 'lp.phases', home: p.side === 0, n, vars: { n: ph } }
      }
      this.banner = this.bannerOf(n)
    }
    this.phase.homeBall = fr.poss === 0
    this.n = n
    this.landed = a >= seg.mark
    this.done = this.isDone()
  }
  private bannerOf(n: number): FeedBanner | null {
    const p = this.plays[n]
    const kind = p.kind === 'try' ? 'try' : p.kind === 'penaltyTry' ? 'pentry' : p.kind === 'conversion' ? (p.good ? 'con' : 'conMiss') : p.kind === 'penaltyGoal' ? (p.good ? 'pen' : 'penMiss')
      : p.kind === 'dropGoal' ? (p.good ? 'dg' : 'dgMiss') : p.kind === 'yellowCard' ? 'yc' : p.kind === 'redCard' ? 'rc' : null
    if (!kind) return null
    return { kind, teamId: this.ids[p.side], name: p.who ? this.nameOf?.(p.who) : undefined, min: Math.floor(p.t / 60) + 1, at: n }
  }
  bound(i: number): boolean { return !!(this.fl[i] & 2) }
  atRuck(i: number): boolean { return this.phase?.kind === 'ruck' && i !== this.holder && hyp(this.b[i], this.ball) < 7 }
  lifted(): [number, number] { const j = this.fl.findIndex(f => !!(f & 8)); return [j, -1] }
  /** (PitchSim's: a line to play. The feed plays the record, so there is nothing to queue.) */
  playLine(_beats?: unknown, _carrier?: unknown) { /* the record is played whole */ }
  /** frozen: the screen does not move the clock on; the recorder seeks and calls redraw() for each frame */
  frozen = false
  /** set by LivePitch: draw one frame now, at the feed's clock */
  redraw: () => void = () => {}
  /** the slot of the man play n names, as the bake has him (-1: nobody, or not baked yet) */
  slotOfWho(n: number): number { return this.bk.whoSlot?.[n] ?? -1 }
  /** the man the current play names (the tag over the man on the ball shows when he has it) */
  get who(): string | undefined { return this.plays[this.n]?.who }
}

// =====================================================================
// ODD RUNS (owner, 22 Nov 2026: "players just randomly travel a strange angle")
// =====================================================================

/**
 * The coordinator's measure (scripts/tmp/oddruns.ts): a long fast run is 13 m or more in two
 * seconds of the bake. It is ODD when it goes more than 35 degrees off straight up-and-down the
 * pitch, or 6 m or more backwards, and is none of the runs rugby has a reason for: the man the
 * record names in the play or the one either side of it (carrier, tackler, catcher, kicker,
 * jackal, passer), a chase of a kick or a drop back under one (straight, within 35 degrees),
 * the side that has just lost the ball getting back behind it (straight), a man going to or
 * from the bin, or a window with a dissolve in it (the owner's fades). Also the worst
 * whole-side slide: the mean sideways move of a side's men over two seconds, where the side is not
 * going towards a ball 5 m or more off its middle (a side drifting after a switch is meant).
 */
/** THE SHAPE AT A RUCK (round 6: "about half the 30 are within 10 m across of the ball"). At recycled
 *  rucks, sampled four times a second: how many of the 30 stand within 10 m across of the ball (median),
 *  and how wide the attack and the defence are, second man to fourteenth (median, metres). */
export function shapeAtRucks(bk: Baked): { near: number; attackWidth: number; defenceWidth: number; samples: number } {
  const P = bk.plays, near: number[] = [], aw: number[] = [], dw: number[] = []
  const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN }
  for (let f = 0; f < bk.n; f += Math.round(FPS / 4)) {
    const p = P[bk.seg[f]]
    if (p.kind !== 'ruck' || p.result !== 'recycled') continue
    const a = bk.poss[f], by = bk.ball[f * 3 + 1]
    let c = 0
    for (let i = 0; i < 30; i++) if (Math.abs(bk.pos[f * 62 + i * 2 + 1] - by) < 10) c++
    near.push(c)
    const ys = (s: number) => Array.from({ length: 15 }, (_, k) => bk.pos[f * 62 + (s * 15 + k) * 2 + 1]).sort((x, y) => x - y)
    const ay2 = ys(a), dy2 = ys(1 - a)
    aw.push(ay2[13] - ay2[1]); dw.push(dy2[13] - dy2[1])
  }
  return { near: med(near), attackWidth: med(aw), defenceWidth: med(dw), samples: near.length }
}

export function oddRuns(bk: Baked, sides?: [RecSide, RecSide]) {
  const P = bk.plays, W = 2 * FPS
  const slotOf = new Map<string, number>()
  sides?.forEach((sd, s) => { for (const p of sd.players) if (p.shirt >= 1 && p.shirt <= 15) slotOf.set(p.id, s * 15 + p.shirt - 1) })
  const named = (n: number, i: number, back = 1) => {
    for (let k = Math.max(0, n - back); k <= Math.min(P.length - 1, n + 2); k++) {
      const p = P[k]
      for (const id of [p.who, ...(p.vs ?? []), ...(p.with ?? [])]) if (id && slotOf.get(id) === i) return true
    }
    return false
  }
  const cutAt = new Uint8Array(bk.n)
  for (const f of bk.cuts) for (let k = f; k < Math.min(bk.n, f + W + 1); k++) cutAt[k] = 1
  let runs = 0, odd = 0, across = 0, back = 0
  const byKind: Record<string, number> = {}, sample: string[] = []
  const last = new Int32Array(30).fill(-999)
  let slide = 0, slideAt = -1
  for (let fr = W; fr < bk.n; fr++) {
    if (cutAt[fr]) continue
    const n = bk.seg[fr], p = P[n]
    // (a whole side may chase a break or a kick across the field: the slide is looked for everywhere else.
    // Round 9: any such play inside the two seconds, not only at either end of them. Seed 2's line break at
    // play 123 lasted under two seconds, so the window from the play before it to the ruck after it held the
    // whole chase: Leicester's defence covering across to the breakdown, every man stopping at or short of
    // the ball, was counted as a side sliding with nowhere to go)
    let chase = ['lineBreak', 'kick', 'kickoff', 'dropout22', 'goalLineDropout', 'catch', 'try', 'heldUp'].includes(p.kind)
    for (let k = bk.seg[fr - W]; k < n && !chase; k++) chase = ['lineBreak', 'kick', 'kickoff', 'dropout22', 'goalLineDropout'].includes(P[k]?.kind ?? '')
    if (!chase) for (const s of [0, 1]) {
      let sy = 0, c = 0
      for (let k = 0; k < 15; k++) { const i = s * 15 + k; if (bk.flags[fr * 30 + i] & 4 || named(n, i)) continue; sy += bk.pos[fr * 62 + i * 2 + 1] - bk.pos[(fr - W) * 62 + i * 2 + 1]; c++ }
      // (a side going across towards a ball 5 m or more off its middle is following it, as the owner asked
      // after a switch: the slide looked for is one with no ball to go to)
      let my = 0
      for (let k = 0; k < 15; k++) my += bk.pos[(fr - W) * 62 + (s * 15 + k) * 2 + 1]
      // (where the ball is now, or was during the two seconds)
      let follows = false
      for (let q = fr - W; q <= fr && !follows; q += 10) { const off = bk.ball[q * 3 + 1] - my / 15; follows = Math.abs(off) >= 5 && Math.sign(off) === Math.sign(sy) }
      if (follows) continue
      if (c && Math.abs(sy / c) > slide) { slide = Math.abs(sy / c); slideAt = n }
    }
    for (let i = 0; i < 30; i++) {
      if (fr - last[i] < W) continue
      const dx = bk.pos[fr * 62 + i * 2] - bk.pos[(fr - W) * 62 + i * 2], dy = bk.pos[fr * 62 + i * 2 + 1] - bk.pos[(fr - W) * 62 + i * 2 + 1]
      const d = Math.hypot(dx, dy)
      if (d < 13) continue
      last[i] = fr; runs++
      const s = i < 15 ? 0 : 1, fwd = s === 0 ? dx : -dx, ang = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI
      const isOdd = ang > 35 || fwd < -6
      if (!isOdd) continue
      if (named(n, i) || (bk.flags[fr * 30 + i] & 4) || (bk.flags[(fr - W) * 30 + i] & 4)) continue
      // straight runs with a reason: under a kick, or getting back behind the ball after losing it
      const kickish = ['kick', 'kickoff', 'dropout22', 'goalLineDropout', 'catch'].includes(p.kind) || ['kick', 'kickoff', 'dropout22', 'goalLineDropout'].includes(P[n - 1]?.kind ?? '')
      const lost = p.ball !== s
      if (ang <= 35 && (kickish || lost)) continue
      // running at the ball (the cover after a break, support onto a carrier): within 30 degrees of where it is
      const bx = bk.ball[fr * 3] - bk.pos[(fr - W) * 62 + i * 2], by = bk.ball[fr * 3 + 1] - bk.pos[(fr - W) * 62 + i * 2 + 1]
      const toBall = Math.acos(clamp((dx * bx + dy * by) / (d * Math.max(1e-6, Math.hypot(bx, by))), -1, 1)) * 180 / Math.PI
      if (toBall <= 30) continue
      odd++
      if (ang > 35) across++
      if (fwd < -6) back++
      const k2 = `${p.kind}/${p.result}`; byKind[k2] = (byKind[k2] ?? 0) + 1
      if (sample.length < 40) sample.push(`play ${n} ${k2} side${s} shirt ${(i % 15) + 1}: ${d.toFixed(0)} m, ${ang.toFixed(0)} deg, ${fwd.toFixed(0)} m forward${lost ? ' (side without the ball)' : ''}`)
    }
  }
  // THE WINGS HOLD THEIR TOUCHLINES: in open play (carries and rucks), a wing not named in the play
  // nor carrying is within 15 m of his own touchline
  let wingFrames = 0, wingOff = 0
  // THE LINE IS FLAT: at the end of each shown ruck, the spread up and down the pitch of the defenders in
  // the front line (forwards, 10, 12, 13: not the 9, the back three, or the men in the ruck or named)
  const spreads: number[] = []
  for (let fr = 0; fr < bk.n; fr += 3) {
    const n = bk.seg[fr], p = P[n], g = bk.segs[n]
    if (p.kind !== 'carry' && p.kind !== 'ruck') continue
    for (const s of [0, 1]) for (const k of [10, 13]) {
      const i = s * 15 + k
      // (a wing who has just carried, tackled or caught is let off while he gets back: six plays)
      if (named(n, i, 6) || bk.holder[fr] === i || bk.flags[fr * 30 + i] & 4) continue
      const left = k === 10, d = s === 0 ? 1 : -1, touchY = ((left ? (d > 0 ? -1 : 1) : (d > 0 ? 1 : -1)) < 0) ? 0 : 70
      wingFrames++
      if (Math.abs(bk.pos[fr * 62 + i * 2 + 1] - touchY) > 15) wingOff++
    }
    void g
  }
  for (const g of bk.segs) {
    const p = P[g.n]
    if (p.kind !== 'ruck' || g.condensed) continue
    const fr = Math.min(bk.n - 1, Math.floor((g.a0 + g.act) * FPS) - 1), def = p.side === 0 ? 1 : 0
    const xs: number[] = []
    for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12]) {
      const i = def * 15 + k
      if (bk.flags[fr * 30 + i] & 7 || named(g.n, i)) continue
      xs.push(bk.pos[fr * 62 + i * 2])
    }
    if (xs.length >= 5) { xs.sort((a, b) => a - b); spreads.push(xs[xs.length - 2] - xs[1]) }
  }
  spreads.sort((a, b) => a - b)
  const flat = spreads.length ? spreads.filter(v => v < 6).length / spreads.length : 1
  return { runs, odd, across, back, slide, slideAt, byKind, sample, wingShare: wingFrames ? wingOff / wingFrames : 0, flat, spreadMedian: spreads[spreads.length >> 1] ?? 0 }
}

// =====================================================================
// SMOOTHNESS ON SCREEN (owner, 22 Nov 2026 22:13: "I believe we can get there with smoothness")
// =====================================================================

/**
 * What the phone shows, frame by frame at SCREEN_FPS: the view clock stepped a 60th of a second at a
 * time, positions read back exactly as the screen reads them (frameAt, blended between baked frames),
 * and measured in pixels on the phone pitch (PX_PER_M). Frames that cross one of the owner's dissolves
 * are left out. Reports the most any man and the ball move between two frames, the most a man's
 * movement changes from one frame to the next (jerk), how often a man who is all but still twitches
 * back and forth, the biggest change of clock rate between frames, and the seconds at life speed,
 * in fast forward and in a close finish.
 */
export function screenSmooth(bk: Baked, tl: Timeline) {
  const step = 1 / SCREEN_FPS
  const cutA = bk.cuts.map(f => f / FPS)
  let prev: Frame | null = null, prevA = 0
  const lastV = new Float32Array(31 * 2)
  let manMax = 0, ballMax = 0, jerkMax = 0, jitter = 0, rateStep = 0, prevRate = tl.rate[0] || 1
  const men: number[] = [], jerks: number[] = [], jitKinds: Record<string, number> = {}, P = bk.plays
  let slowS = 0, ffS = 0, closeS = 0
  for (let v = 0; v < tl.total; v += step) {
    const a = animAt(tl, v), f = Math.min(bk.n - 1, Math.floor(a * FPS))
    const r = tl.rate[f]
    if (tl.slow[f] === 1 || tl.slow[f] === 3) slowS += step; else if (tl.slow[f] === 2) closeS += step; else ffS += step
    // (the change of speed from one screen frame to the next, as a share)
    rateStep = Math.max(rateStep, Math.abs(r / prevRate - 1)); prevRate = r
    const fr = frameAt(bk, a)
    if (prev && !cutA.some(c => c > prevA - 1 / FPS - 1e-9 && c <= a + 1 / FPS + 1e-9)) {
      for (let i = 0; i < 30; i++) {
        const dx = (fr.men[i].x - prev.men[i].x) * PX_PER_M, dy = (fr.men[i].y - prev.men[i].y) * PX_PER_M, d = Math.hypot(dx, dy)
        if (fr.flags[i] & 4) continue
        men.push(d); manMax = Math.max(manMax, d)
        const jx = dx - lastV[i * 2], jy = dy - lastV[i * 2 + 1], j = Math.hypot(jx, jy)
        jerks.push(j); jerkMax = Math.max(jerkMax, j)
        // a near-still man going back the way he came: a twitch
        if (d > 0.05 && d < 0.6 && Math.hypot(lastV[i * 2], lastV[i * 2 + 1]) > 0.05 && dx * lastV[i * 2] + dy * lastV[i * 2 + 1] < 0) { jitter++; const k2 = P[bk.seg[f]].kind; jitKinds[k2] = (jitKinds[k2] ?? 0) + 1 }
        lastV[i * 2] = dx; lastV[i * 2 + 1] = dy
      }
      ballMax = Math.max(ballMax, Math.hypot(fr.ball.x - prev.ball.x, fr.ball.y - prev.ball.y) * PX_PER_M)
    } else lastV.fill(0)
    prev = fr; prevA = a
  }
  const q = (xs: number[], p: number) => { const s2 = Float32Array.from(xs).sort(); return s2[Math.min(s2.length - 1, Math.floor(p * s2.length))] ?? 0 }
  return { jitKinds, manMax, manP999: q(men, 0.999), ballMax, jerkMax, jerkP999: q(jerks, 0.999), jitterPerMin: jitter / (tl.total / 60), rateStep, slowS, ffS, closeS }
}
