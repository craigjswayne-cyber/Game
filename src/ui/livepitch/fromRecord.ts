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

export type Pt = { x: number; y: number }
type Side = 0 | 1

/** steps a second of the bake (and of the stored frames) */
export const FPS = 30
const DT = 1 / FPS
/** nobody runs faster than this (m/s), whatever he is asked to do */
export const V_CAP = 9.4
/** a ball in the air or in hand is never faster than this (m/s) */
export const BALL_CAP = 40
const A_PLAYER = 16
const V_SHAPE_BACK = 8, V_SHAPE_FWD = 6.2, V_JOG = 5.5
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
const fx = (x: number) => clamp(x, -7, 107)
const fy = (y: number) => clamp(y, -1.5, 71.5)
const inY = (y: number) => clamp(y, 1, 69)
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
  if (p.result === 'outOnFull') L = { x: A.x + dir * 18, y: p.y }
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
}

const LIVE = new Set(['kickoff', 'dropout22', 'goalLineDropout', 'carry', 'ruck', 'maul', 'lineBreak', 'kick', 'catch', 'scrum', 'lineout', 'tap'])

function actOf(plays: Play[], n: number): { act: number; mark: number } {
  const p = plays[n]
  switch (p.kind) {
    case 'carry': case 'lineBreak': {
      const g = carryGeo(plays, n)
      const act = g.pick + g.passes * g.passT + g.runT + g.spill
      return { act, mark: act }
    }
    case 'ruck': {
      const nx = plays[n + 1]
      const wideNext = nx && (nx.kind === 'carry' || nx.kind === 'lineBreak') ? Math.abs(nx.y - p.y) : 0
      const act = (p.result === 'turnover' ? 1.6 : 0.9) + Math.min(1.4, wideNext / 16)
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
      return { act: 0.8 + 0.7 + d / 24 + 1.1, mark: 0.8 }
    }
    case 'dropGoal': return { act: 1.3 + 0.6 + Math.abs(lineOf(p.side) - p.x) / 24 + 1.0, mark: 1.3 }
    case 'try': return { act: 1.9, mark: 0.6 }
    case 'penaltyTry': return { act: 2.6, mark: 2.6 }
    case 'heldUp': return { act: 1.8, mark: 0.4 }
    case 'deadBall': return { act: 0.8, mark: 0.8 }
    case 'intoTouch': return p.result === 'bounced' ? { act: 0.3 + Math.abs(p.y - (plays[n - 1]?.y ?? p.y)) / 8, mark: 0.3 + Math.abs(p.y - (plays[n - 1]?.y ?? p.y)) / 8 } : { act: 0.4, mark: 0.4 }
    case 'knockOn': return plays[n - 1]?.kind === 'carry' ? { act: 0.4, mark: 0.4 } : { act: 0.6, mark: 0.6 }
    case 'yellowCard': case 'redCard': return { act: 2.6, mark: 2.6 }
    case 'halfTime': return { act: 2.0, mark: 2.0 }
    case 'fullTime': return { act: 2.5, mark: 2.5 }
    default: return { act: 0.5, mark: 0.5 }
  }
}

/** the walk between a stoppage and the set piece after it (anim seconds) */
function deadOf(plays: Play[], n: number): number {
  const p = plays[n], nx = nextAction(plays, n)
  if (!nx) return 0
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
function keyOf(plays: Play[], n: number): boolean {
  const p = plays[n], nx = plays[n + 1]
  if (['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard', 'heldUp', 'lineBreak'].includes(p.kind)) return true
  if (p.kind === 'ruck' && p.result === 'turnover' && (p.x < 22 || p.x > 78)) return true
  if ((p.kind === 'carry' || p.kind === 'maul') && nx && (nx.kind === 'try' || nx.kind === 'heldUp')) return true
  if (p.kind === 'kick' && p.result === 'chargedDown') return true
  return false
}
/** shown at the lead-in pace, not wound on: the restarts (owner: "teams formed up in view, kick, chase, catch") */
const SLOWISH = new Set(['kickoff', 'dropout22', 'goalLineDropout', 'halfTime', 'fullTime'])

const planCache = new WeakMap<Play[], Seg[]>()
/** every play's place on the bake's clock */
export function plan(plays: Play[]): Seg[] {
  const hit = planCache.get(plays)
  if (hit) return hit
  const segs: Seg[] = []
  let a = 0
  const keys = plays.map((_, n) => keyOf(plays, n))
  for (let n = 0; n < plays.length; n++) {
    const { act, mark } = actOf(plays, n)
    const dead = deadOf(plays, n)
    const lead = !keys[n] && (keys[n + 1] || keys[n + 2] || SLOWISH.has(plays[n].kind))
    segs.push({ n, a0: a, act, dead, a1: a + act + dead, mark: a + mark, key: keys[n] ? 2 : lead ? 1 : 0, live: LIVE.has(plays[n].kind) })
    a += act + dead
  }
  planCache.set(plays, segs)
  return segs
}

// =====================================================================
// THE SCHEDULE: how fast each play is shown
// =====================================================================

/** `at` is `start` again, under the name the overseer's harmonycheck reads; nothing is faded (every man walks to every set piece) */
export interface Slot { n: number; start: number; at: number; dur: number; speed: number; fade: boolean }
/** a stretch of the bake shown at one speed: view seconds [v0, v1) are anim seconds [a0, a1) */
export interface Piece { n: number; v0: number; v1: number; a0: number; a1: number; speed: number }

/** an Extended match is about this long on screen (owner: "about 4 minutes") */
export const TARGET_S = 240

/** the winding-on: ordinary play at S times life speed, the walking between set pieces quicker still,
 *  the lead-in to a key moment at `lead`, the key moment at `key` (life speed unless the match has too many) */
function piecesAt(plays: Play[], segs: Seg[], S: number, key = 1, lead = 2.4): Piece[] {
  const dS = clamp(S * 1.6, 6, 18)
  const out: Piece[] = []
  let v = 0
  for (const g of segs) {
    // (a conversion is the end of a try already watched: a little quicker than life)
    const kk = plays[g.n].kind === 'conversion' ? Math.max(key, 1.5) : key
    const sp = g.key === 2 ? kk : g.key === 1 ? Math.min(S, lead) : S
    if (g.act > 0) { const d = g.act / sp; out.push({ n: g.n, v0: v, v1: v + d, a0: g.a0, a1: g.a0 + g.act, speed: sp }); v += d }
    if (g.dead > 0) { const d = g.dead / dS; out.push({ n: g.n, v0: v, v1: v + d, a0: g.a0 + g.act, a1: g.a1, speed: dS }); v += d }
  }
  return out
}

/** ordinary play is never wound on harder than this (the spec's "about eight times", with room) */
export const MAX_WIND = 12

const pieceCache = new WeakMap<Baked, Piece[]>()
/** the pieces of the whole match, wound on so it lasts TARGET_S */
export function pieces(bk: Baked): Piece[] {
  const hit = pieceCache.get(bk)
  if (hit) return hit
  const segs = bk.segs, plays = bk.plays
  const len = (ps: Piece[]) => ps.length ? ps[ps.length - 1].v1 : 0
  // the wind-on speed for ordinary play that makes the match the length wanted
  const solve = (key: number, lead: number) => {
    let lo = 1, hi = MAX_WIND
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (len(piecesAt(plays, segs, mid, key, lead)) > TARGET_S) lo = mid; else hi = mid }
    return piecesAt(plays, segs, hi, key, lead)
  }
  let ps = solve(1, 2.4)
  // A MATCH WITH A LOT IN IT (twelve tries, say) cannot show every key moment at life speed in four
  // minutes without winding the rest past readable: the key moments and their lead-ins go a little quicker
  for (let f = 1; f <= 8 && len(ps) > TARGET_S + 1; f++) ps = solve(1 + f * 0.1, 2.4 + f * 0.2)
  pieceCache.set(bk, ps)
  return ps
}

const bakeCache = new WeakMap<Play[], { sides?: [RecSide, RecSide]; bk: Baked }>()
/** the bake of a record, made once (the pitch and the commentary's schedule share it) */
export function bakeOf(plays: Play[], sides?: [RecSide, RecSide]): Baked {
  const hit = bakeCache.get(plays)
  if (hit && hit.sides === sides) return hit.bk
  const bk = bake(plays, sides)
  bakeCache.set(plays, { sides, bk })
  return bk
}

/**
 * WHEN EACH PLAY IS SHOWN. `start` and `dur` are seconds on screen from the
 * kick-off; `speed` is how many times life speed the play's action is shown
 * at (1 for a key moment; the walk to a set piece after it goes quicker
 * still). The commentary shows Line n's text when play n starts. Pass the
 * same sides the pitch is given (fromMatch.ts SimSide, home then away), or
 * none to both: the timing comes from the bake, which waits for the men the
 * record names, so the two must be baked alike to agree to the frame.
 */
export function schedule(plays: Play[], sides?: [RecSide, RecSide]): Slot[] {
  const ps = pieces(bakeOf(plays, sides))
  const out: Slot[] = plays.map((_, n) => ({ n, start: 0, at: 0, dur: 0, speed: 1, fade: false }))
  const seen = new Set<number>()
  for (const p of ps) {
    const o = out[p.n]
    if (!seen.has(p.n)) { seen.add(p.n); o.start = p.v0; o.speed = p.speed }
    o.dur = p.v1 - o.start
  }
  for (let n = 1; n < out.length; n++) if (!seen.has(n)) out[n].start = out[n - 1].start + out[n - 1].dur
  for (const o of out) o.at = o.start
  return out
}

/** the bake's clock at a moment on screen */
export function animAt(ps: Piece[], v: number): number {
  if (!ps.length) return 0
  if (v <= 0) return ps[0].a0
  let lo = 0, hi = ps.length - 1
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ps[m].v0 <= v) lo = m; else hi = m - 1 }
  const p = ps[lo]
  return p.a0 + Math.min(1, (v - p.v0) / Math.max(1e-9, p.v1 - p.v0)) * (p.a1 - p.a0)
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
}

interface Body { x: number; y: number; vx: number; vy: number }
type Ov = { x: number; y: number; v: number; place?: boolean; a?: number }

/** BAKE THE WHOLE MATCH. Deterministic: the same record and sides give the same frames. */
export function bake(plays: Play[], sides?: [RecSide, RecSide]): Baked {
  // (the plan's times are the least each play takes: the bake waits for the men the record names, so it writes its own)
  const segs = plan(plays).map(g => ({ ...g }))
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
    | { k: 'open'; att: Side; O: Pt; tOut: number; lean: number }
    | { k: 'kick'; kicker: Side; L: Pt; lean: number }
    | { k: 'form'; at: Pt[]; v: number }
    | { k: 'hold' }
  let ctx: Ctx = { k: 'hold' }
  const targetOf = (i: number): Ov => {
    const s = sideOfSlot(i), k = i % 15, fwd = k < 8
    if (ctx.k === 'hold') return { x: B[i].x, y: B[i].y, v: 2 }
    if (ctx.k === 'form') { const p = ctx.at[i]; const far = hyp(B[i], p) > 22; return { x: p.x, y: p.y, v: far ? 7.5 : ctx.v } }
    if (ctx.k === 'kick') {
      const r = other(ctx.kicker), dr = dirOf(r)
      if (s === r) { const p = shapeAtt(k, ctx.L, dr, ctx.lean); return { ...p, v: fwd ? 6.5 : 8 } }
      const p = shapeDef(k, { x: ctx.L.x + dr * 4, y: ctx.L.y }, dr, ctx.lean); return { ...p, v: fwd ? 7 : 8 }
    }
    // open play: the attack in its shape off the ball, the defence in its line, pressing once the ball is out
    const a = ctx.att, da = dirOf(a)
    if (s === a) { const p = shapeAtt(k, ball, da, ctx.lean); return { ...p, v: fwd ? V_SHAPE_FWD : V_SHAPE_BACK } }
    const up = t > ctx.tOut ? press(t - ctx.tOut) : 0
    // (never closer than a metre in front of the ball: the line backs off a carry it has not stopped)
    let rx = ctx.O.x - da * Math.min(6, up)
    if ((rx + da * 2.2 - ball.x) * da < 1.0) rx = ball.x + da * 1.0 - da * 2.2
    const p = shapeDef(k, { x: rx, y: ball.y }, da, ctx.lean)
    return { ...p, v: fwd ? 7 : 7.5 }
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
    dur = Math.max(dur, hyp(from, B[i]) / 20)
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
    return at
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
    const openWing = side === leftY ? 10 : 13, blindWing = openWing === 10 ? 13 : 10
    at[feed * 15 + openWing] = { x: M.x - d * 12, y: inY(M.y + side * 30) }
    at[feed * 15 + blindWing] = { x: M.x - d * 9, y: inY(M.y - side * 11) }
    at[o * 15 + openWing] = { x: M.x + d * 9, y: inY(M.y + side * 30) }
    at[o * 15 + blindWing] = { x: M.x + d * 9, y: inY(M.y - side * 11) }
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
    const farW = ts > 0 ? (d > 0 ? 10 : 13) : (d > 0 ? 13 : 10), nearW = farW === 10 ? 13 : 10
    at[thrower * 15 + farW] = { x: X - d * 14, y: touchY + ts * 46 }
    at[thrower * 15 + nearW] = { x: X - d * 16, y: touchY + ts * 16 }
    at[o * 15 + farW] = { x: X + d * 12, y: touchY + ts * 44 }
    at[o * 15 + nearW] = { x: X + d * 14, y: touchY + ts * 14 }
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
      case 'lineout': { const tY = nx.y < 35 ? 0 : 70; return { at: formLineout(s, nx.x, tY), fetch: who(nx.who, s, 2), spot: { x: nx.x, y: tY + (tY === 0 ? 0.6 : -0.6) } } }
      case 'penaltyGoal': { const kk = who(nx.who, s, 10); return { at: formGoal(s, spot(nx)), fetch: kk, spot: spot(nx) } }
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
      ov[f.fetch] = { x: f.spot.x, y: f.spot.y, v: 6.5 }
      if (tau > 0.4) give(f.fetch)
      // (the walk is over when the set piece is set: everybody in place and the ball with the man who puts it in play)
      return tau > 1.5 && holder === f.fetch && hyp(B[f.fetch], f.spot) < 1.5 && formed(f.at, 2, 3)
    }
  }
  /** is everybody (but a few stragglers) at his place in a formation */
  const formed = (at: Pt[], within = 2, allow = 3) => { let n = 0; for (let i = 0; i < 30; i++) if (!off[i] && at[i] && hyp(B[i], at[i]) > within) n++; return n <= allow }

  // ---- THE PLAYS. Each returns true once its action is done; mark() is the
  // moment the ball is where the record puts it (by default, the end).
  const ctlOf = (n: number): Ctl => {
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
          ctx = kicked ? { k: 'kick', kicker: q.side, L, lean: leanTo(undefined, L) } : { k: 'open', att: s, O: L, tOut: 0, lean: leanTo(undefined, L) }
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
          ov[tackled] = { x: R.x - d * 0.5, y: R.y, v: 3 }; fl[tackled] |= 2
          ruckers.forEach((i, j) => { ov[i] = { x: R.x - d * 0.9, y: R.y + (j ? 0.6 : -0.6), v: 7 }; if (hyp(B[i], R) < 2) fl[i] |= 2 })
          tk.forEach((i, j) => { if (i === jackal) return; ov[i] = { x: R.x + d * 0.8, y: R.y + (j ? 0.6 : -0.4), v: 7 }; if (tau < 1.2 && hyp(B[i], R) < 2) fl[i] |= 2 })
          if (p.result === 'turnover') {
            ov[jackal] = { x: R.x + d * 0.35, y: R.y, v: V_CAP }
            if (tau > 0.5) pickUp(jackal)
            if (holder === jackal) ov[jackal] = { x: B[jackal].x, y: B[jackal].y, v: 1 }
            return holder === jackal && tau >= minT
          }
          ov[nine] = { x: R.x - d * 1.2, y: R.y + 0.6, v: 8 }
          // the ball comes out when the next play's men are there (a quick ruck when they already are)
          return tau >= minT && (ready(n + 1) || tau > minT + 3)
        }
      }
      case 'kick': return kickCtl(n)
      case 'intoTouch': {
        const to = spot(p)
        let started = false
        return tau => {
          ctx = { k: 'hold' }
          if (!started) { started = true; if (p.result === 'bounced') { if (holder < 0 && !fly) roll = { to: { x: to.x, y: to.y === 0 ? 0 : 70 }, v: 8 } } else if (holder >= 0) drop({ x: to.x, y: to.y === 0 ? 0 : 70 }) }
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
      case 'forwardPass': case 'notStraight': case 'unplayable': case 'restartError': case 'deadBall': {
        let started = false
        return tau => {
          ctx = { k: 'hold' }
          if (!started) { started = true; if (p.kind === 'deadBall' && holder < 0 && !fly) roll = { to: { x: lineOf(s) + d * 5, y: inY(p.y) }, v: 5 } }
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
          if (set < 0) { give(n9); if (holder === n9 && (formed(at, 1.5, 4) || tau > 3)) set = tau; return false }
          const k = tau - set
          if (k < 0.7) return false
          if (!plays2) { if (k >= 1.0) mark(); return k >= 1.8 }
          if (!fed) { fed = true; kickTo(M, 0.4, 0.2) }
          if (k > 1.2 && !hooked && !fly) { hooked = true; kickTo(feet, 0.5, 0) }
          if (hooked && !fly) { ov[w9] = { x: ball.x - dirOf(win) * 0.35, y: ball.y, v: 6 }; pickUp(w9) }
          return hooked && holder === w9
        }
      }
      case 'lineout': {
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
            if (tau >= 0.6 && holder === thrower && (formed(at, 2, 4) || tau > 3.5)) {
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
        const K = p.kind === 'conversion' ? conSpot(s, p.y) : p.kind === 'dropGoal' ? { x: p.x - d * 1.8, y: p.y } : spot(p)
        const kk = who(p.who, s, 10)
        const posts = { x: lineOf(s) + d * 3, y: p.good ? 35 : 35 + (p.y >= 35 ? 1 : -1) * 5.5 }
        const flight = 0.6 + hyp(K, posts) / 24
        const at = p.kind === 'dropGoal' ? null : formGoal(s, K)
        const lead = actOf(plays, n).mark
        let struck = -1
        return tau => {
          if (at) ctx = { k: 'form', at, v: 3 }
          else ctx = { k: 'open', att: s, O: spot(p), tOut: 0, lean: 1 }
          if (struck < 0) {
            if (p.kind === 'dropGoal' && holder !== kk && !fly && holder >= 0) throwTo(kk, 0.55, 0.9)
            else if (holder !== kk && !fly) { if (p.kind === 'dropGoal') pickUp(kk); else give(kk) }
            ov[kk] = { x: K.x - d * 0.35, y: K.y, v: p.kind === 'dropGoal' ? 8 : 4 }
            if (tau >= lead && holder === kk && hyp(ball, K) < 0.8) { struck = tau; mark(); kickTo(posts, flight, p.kind === 'dropGoal' ? 8 : 10) }
            return false
          }
          ov[kk] = { x: K.x + d * 2, y: K.y, v: 3 }
          return !fly && tau - struck >= flight + 1.0
        }
      }
      case 'try': {
        const scorer = holder >= 0 && sideOfSlot(holder) === s ? holder : who(p.who, s, 11)
        const at = { x: lineOf(s) + d * 1.2, y: inY(p.y) }
        let down0 = -1
        return tau => {
          ctx = { k: 'hold' }
          if (down0 < 0) {
            if (holder !== scorer && !fly) pickUp(scorer)
            ov[scorer] = { x: at.x - d * 0.35, y: at.y, v: 7, place: holder === scorer }
            if (holder === scorer && hyp(B[scorer], { x: at.x - d * 0.35, y: at.y }) < 0.5 && tau >= 0.4) { down0 = tau; drop(); ball.x = at.x; ball.y = at.y; down[scorer] = 1.2; mark() }
            return false
          }
          // his side come to him; theirs walk back
          for (let k = 0; k < 15; k++) { const i = s * 15 + k; if (i !== scorer && !off[i] && hyp(B[i], at) < 25) ov[i] = { x: at.x - d * (3 + (k % 3)), y: inY(at.y + ((k % 5) - 2) * 2), v: 5 } }
          return tau - down0 >= 1.3
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
    const mids: Pt[] = []
    for (let k = 1; k < g.passes; k++) {
      const f = k / g.passes
      const to = thief >= 0 ? { x: g.A.x - d * 4, y: g.B.y } : g.R
      mids.push({ x: lerp(g.A.x - d * 1.5, to.x, f), y: inY(lerp(g.A.y, to.y, f)) })
    }
    const chain: number[] = []
    for (const k of [9, 11, 12, 14, 10, 13]) {
      if (chain.length >= mids.length) break
      const i = s * 15 + k
      if (i !== carrier && i !== giver && !off[i]) chain.push(i)
    }
    if (giver >= 0 && giver !== carrier && mids.length) chain[chain.length - 1] = giver
    return { p, g, carrier, tk, mids: mids.slice(0, chain.length), chain, thief, giver: g.passes === 1 && giver !== carrier ? giver : -1 }
  }
  /** is the next play's main man where it needs him */
  const ready = (m: number): boolean => {
    const p = plays[m]
    if (!p) return true
    if (p.kind === 'carry' || p.kind === 'lineBreak') {
      const { g, carrier, chain, mids } = carryMen(m)
      return (g.passes === 0 || hyp(B[carrier], g.R) < 3.5) && chain.every((i, j) => hyp(B[i], mids[j]) < 4)
    }
    if (p.kind === 'kick') {
      const g = kickGeo(plays, m), kk = who(p.who, p.side, p.kick === 'box' ? 9 : 10)
      return p.kick === 'box' || !g.fromHand || hyp(B[kk], { x: g.A.x - g.dir * 7, y: g.A.y }) < 5
    }
    return true
  }
  const carryCtl = (n: number): Ctl => {
    const { p, g, carrier, tk, mids, chain: mids2, thief, giver } = carryMen(n)
    const s = p.side, o = other(s), d = g.dir
    // (an interception: the last pass is thrown for the carrier and taken by their man in the lane)
    const chain = [...mids2, thief >= 0 ? thief : carrier]
    const spots = [...mids, thief >= 0 ? g.B : g.R]
    let first = -1, next = 0, sent = 0
    let run: { from: Pt; T: number; a0: number; t0: number } | null = null
    let spilt = -1, fwdAt = -1, stolen = -1
    const lean = Math.sign(g.B.y - g.A.y) || (openSide(g.A.y) >= 0 ? 1 : -1)
    const back = carrier % 15 >= 8
    const vRun = g.brk ? 8.8 : back ? 8.0 : 6.6
    return tau => {
      ctx = { k: 'open', att: s, O: g.A, tOut: segs[n].a0 + g.pick, lean }
      // the man who has it: the 9 at the base (or the man the record says gave the pass, or whoever is there), the jumper, the catcher
      if (first < 0) {
        first = holder >= 0 && sideOfSlot(holder) === s ? holder
          : g.passes === 0 ? carrier
          : giver >= 0 && hyp(B[giver], ball) < 6 ? giver
          : want >= 0 && sideOfSlot(want) === s ? want : nearest(s, g.A, [carrier], false)
      }
      if (holder !== first && holder < 0 && !fly && next === 0) { pickUp(first); ov[first] = { x: ball.x - d * 0.35, y: ball.y, v: V_CAP } }
      // the receivers into their places, the carrier into his (an intercepted carrier still runs his line)
      // (and a man keeps his place while the ball is in the air to him)
      chain.forEach((i, j) => { if ((j >= next || (fly && j === next - 1)) && i !== holder) ov[i] = { x: spots[j].x, y: spots[j].y, v: V_CAP } })
      if (thief >= 0 && holder !== carrier) ov[carrier] = { x: g.R.x === g.B.x ? g.B.x - d * 3 : g.R.x, y: g.B.y + (g.B.y < 35 ? 4 : -4), v: V_CAP }
      // the passes: each when its man is in place (or when he has kept them waiting long enough)
      if (!run && next < chain.length && !fly && holder >= 0 && holder !== chain[next] && tau >= g.pick && tau - sent >= 0.2) {
        const to = chain[next], dist = hyp(ball, B[to])
        const last = next === chain.length - 1
        if (hyp(B[to], spots[next]) < (last ? (thief >= 0 ? 0.8 : 1.5) : 2.5) || tau > g.pick + (last && thief >= 0 ? 8 : 4) + next) {
          throwTo(to, clamp(dist / 17, 0.25, 0.95), Math.min(1.2, 0.4 + dist / 20))
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
      // a break: the rest of their side turn and chase him
      if (g.brk && run) {
        for (let k = 0; k < 15; k++) {
          const i = o * 15 + k
          if (off[i] || tk.includes(i)) continue
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
      put(carrier, { x: g.R.x, y: g.R.y, v: soon ? V_CAP : 8 })
      if (thief >= 0) put(thief, { x: lerp(B[thief].x, g.B.x, soon ? 0.7 : 0.3), y: lerp(B[thief].y, g.B.y, soon ? 0.7 : 0.3), v: 8 })
      chain.forEach((i, j) => put(i, { x: mids[j].x, y: mids[j].y, v: soon ? 8.5 : 7 }))
      const B2 = { x: g.B.x + g.dir * 2.5, y: g.B.y }
      tk.forEach(i => { const t2 = targetOf(i); put(i, { x: lerp(t2.x, B2.x, soon ? 0.6 : 0.35), y: lerp(t2.y, B2.y, soon ? 0.6 : 0.35), v: 8 }) })
    } else if (p.kind === 'kick' && plays[m - 1]) {
      const g = kickGeo(plays, m), kk = who(p.who, p.side, p.kick === 'box' ? 9 : 10)
      if (g.fromHand && p.kick !== 'box') put(kk, { x: g.A.x - g.dir * 7, y: inY(g.A.y + (g.A.y < 35 ? 3 : -3)), v: 8 })
      // the back three drop for it
      const nx = plays[m + 1]
      if (nx && (nx.kind === 'catch' || nx.kind === 'knockOn') && nx.side !== p.side) {
        const c = who(nx.who, nx.side, 15)
        put(c, { x: lerp(B[c].x, g.L.x, 0.5), y: lerp(B[c].y, g.L.y, 0.5), v: 7 })
      }
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
    return tau => {
      if (kicked < 0) {
        ctx = { k: 'open', att: s, O: g.A, tOut: 0, lean: 1 }
        ov[kk] = { x: pocket.x, y: pocket.y, v: V_CAP }
        // the ball on the floor: the kicker takes it himself if he is on it, else the 9 (or whoever is nearest) picks it up and passes
        if (first < 0) first = holder >= 0 && sideOfSlot(holder) === s ? holder : hyp(B[kk], ball) < 4 ? kk : nearest(s, ball, [], false)
        if (holder < 0 && !fly) { pickUp(first); ov[first] = { x: ball.x - d * 0.35, y: ball.y, v: V_CAP } }
        if (holder >= 0 && holder !== kk && !fly && tau > 0.25 && hyp(B[kk], pocket) < 4) throwTo(kk, clamp(hyp(ball, B[kk]) / 16, 0.3, 0.8), 0.8)
        if (holder >= 0 && holder !== kk) ov[holder] = { x: B[holder].x, y: B[holder].y, v: 1.5, a: 30 }
        if (holder === kk) ov[kk] = p.result === 'chargedDown' ? { ...pocket, v: 3 } : { x: B[kk].x + d * 0.6, y: B[kk].y, v: 2, a: 30 }
        if (charger >= 0) ov[charger] = { x: B[kk].x + d * 1.2, y: B[kk].y, v: V_CAP }
        // the man who will take it reads it as it is set up
        if (catcher >= 0 && catcher !== kk) ov[catcher] = { x: g.L.x, y: inY(g.L.y), v: 8.5 }
        const settled = hyp(B[kk], pocket) < (p.result === 'chargedDown' ? 0.7 : 2) || tau > g.pre + 2
        if (holder === kk && tau >= g.pre - 0.02 && settled) {
          kicked = tau; mark0At(p)
          if (p.result === 'chargedDown') kickTo({ x: B[kk].x + d * 0.9, y: B[kk].y }, 0.15, 0.6)
          else {
            // (it hangs long enough for the man under it to get there, as the clips' kicks do)
            const need = catcher >= 0 ? hyp(B[catcher], g.L) / 8.8 + 0.2 : 0
            kickTo(g.L, Math.max(g.hang, need), h, lowKick)
          }
        }
        return false
      }
      if (p.result === 'chargedDown') { ctx = { k: 'hold' }; if (charger >= 0) ov[charger] = { x: B[kk].x + d * 1.0, y: B[kk].y, v: 6 }; return !fly }
      ctx = { k: 'kick', kicker: s, L: g.L, lean: 1 }
      if (catcher >= 0) ov[catcher] = { x: g.L.x, y: inY(g.L.y), v: V_CAP }
      for (const i of chasers(s, g.L, 2)) if (i !== catcher && i !== kk) ov[i] = { x: g.L.x - d * 3, y: inY(g.L.y + ((i % 3) - 1) * 2.5), v: 8.6 }
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
    const wantV = Math.min(vmax, dist * 2.4)
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
        if (dx > 1.3 || dx < -1.3 || dy > 1.3 || dy < -1.3) continue
        if ((fl[a] & 2 && fl[c] & 2) || a === holder || c === holder || off[a] || off[c]) continue
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist >= 1.3 || dist < 1e-6) continue
        const push = Math.min(0.02, (1.3 - dist) / 2)
        p.x -= dx / dist * push; p.y -= dy / dist * push; q.x += dx / dist * push; q.y += dy / dist * push
      }
    }
  }

  // ---- the opening: both sides formed up for the kick-off, the kicker on the ball
  {
    const p0 = plays[0]
    if (p0 && p0.kind === 'kickoff') {
      const kk = who(p0.who, p0.side, 10)
      const at = formKickoff(p0.side, kk)
      for (let i = 0; i < 30; i++) { B[i].x = at[i].x; B[i].y = at[i].y }
      holder = kk; ball.x = B[kk].x; ball.y = B[kk].y
      poss = p0.side
    }
    ref.x = 50; ref.y = 44
  }

  // ---- THE LOOP
  const px = B.map(b => b.x), py = B.map(b => b.y)
  let si = 0, f = 0, inDead = false, deadT0 = 0, deadReady = false
  let ctl: Ctl = segs.length ? ctlOf(0) : () => true, dctl: Ctl | null = null
  if (segs.length) segs[0].a0 = 0
  for (; si < segs.length; f++) {
    t = f * DT
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
      if (done || tau >= g.act * 3 + 6) { g.act = tau; g.mark = markAt >= 0 ? markAt : t; inDead = true; deadT0 = t; dctl = g.dead > 0 ? deadCtl(plays[g.n]) : null }
    } else if (dctl) deadReady = dctl(t - deadT0) === true
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
      if (si < segs.length) { segs[si].a0 = g.a1; ctl = ctlOf(si) }
    }
  }
  const N = f
  return { plays, segs, n: N, pos: pos.slice(0, N * 62), ball: ballA.slice(0, N * 3), holder: holderA.slice(0, N), poss: possA.slice(0, N), seg: segA.slice(0, N), flags: flags.slice(0, N * 30) }
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
    case 'dropGoal': return { x: p.x, y: p.y, tol: 2.5 }
    case 'try': case 'heldUp': return { x: p.x, y: clamp(p.y, 1, 69), tol: 2.5 }
    case 'notStraight': case 'restartError': case 'unplayable': case 'forwardPass': return { tol: Infinity }
    // (a forward pass is written where it was thrown from: it is caught a stride or two in front of that)
    case 'carry': return p.result === 'forwardPass' ? { x: p.x, y: p.y, tol: 4 } : { x: p.x, y: p.y, tol: 1.6 }
    case 'kick': return p.result === 'outOnFull' ? { y: p.y, tol: 2 } : { x: p.x, y: p.y, tol: 1.6 }
    case 'kickoff': return { x: p.x, tol: 2 }
    case 'knockOn': case 'scrum': case 'maul': return { x: p.x, y: p.y, tol: 2.6 }
    case 'lineout': return { x: p.x, y: p.y, tol: p.result === 'won' || p.result === 'stolen' ? 1.6 : 1.6 }
    case 'intoTouch': return { x: p.x, y: p.y, tol: 1.6 }
    case 'deadBall': return { tol: Infinity }
    case 'yellowCard': case 'redCard': case 'halfTime': case 'fullTime': return { tol: Infinity }
    default: return { x: p.x, y: p.y, tol: 1.6 }
  }
}

// =====================================================================
// THE FEED: what LivePitch.tsx draws, read from the bake on the screen's clock
// =====================================================================

/** the chip on the pitch for each play (lp.* keys that already exist in the locales) */
function chipOf(p: Play): string {
  switch (p.kind) {
    case 'kickoff': return 'lp.kickoff'
    case 'dropout22': return 'lp.dropout22'
    case 'goalLineDropout': return 'lp.dropout'
    case 'scrum': return p.result === 'againstTheHead' ? 'lp.againstHead' : 'lp.scrum'
    case 'lineout': return p.result === 'stolen' ? 'lp.lineoutStolen' : 'lp.lineout'
    case 'maul': return 'lp.maul'
    case 'kick': return p.result === 'chargedDown' ? 'lp.chargeDown' : p.result === 'outOnFull' ? 'lp.outFull' : p.result === 'fiftyTwentyTwo' ? 'lp.fifty22'
      : p.kick === 'box' ? 'lp.boxKick' : p.kick === 'upAndUnder' ? 'lp.upAndUnder' : p.kick === 'grubber' ? 'lp.grubber' : p.result === 'touch' || p.result === 'penaltyToTouch' ? 'lp.kickTouch' : 'lp.kick'
    case 'catch': return 'lp.catch'
    case 'penalty': case 'freeKick': return 'lp.penalty'
    case 'tap': return 'lp.quickTap'
    case 'penaltyGoal': return 'lp.goalKick'
    case 'conversion': return 'lp.con'
    case 'dropGoal': return 'lp.drop'
    case 'knockOn': return 'lp.knockOn'
    case 'forwardPass': return 'lp.forwardPass'
    case 'intoTouch': return 'lp.intoTouch'
    case 'heldUp': return 'lp.heldUp'
    case 'halfTime': return 'lp.halfTime'
    case 'fullTime': return 'lp.fullTime'
    case 'ruck': return p.result === 'turnover' ? 'lp.turnover' : 'lp.ruck'
    case 'try': case 'penaltyTry': return 'lp.try'
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
  readonly bk: Baked
  readonly ps: Piece[]
  /** seconds on screen since the kick-off */
  view = 0
  b: { x: number; y: number; vx: number; vy: number }[] = Array.from({ length: 30 }, () => ({ x: 50, y: 35, vx: 0, vy: 0 }))
  ref = { x: 50, y: 40, vx: 0, vy: 0 }
  ball = { x: 50, y: 35, lift: 0 }
  holder = -1
  down: number[] = new Array(30).fill(0)
  off: boolean[] = new Array(30).fill(false)
  private fl: number[] = new Array(30).fill(0)
  phase: { kind: PhaseKindLike; homeBall: boolean; at: number; label: string; x: number; y: number } | null = null
  landed = false
  readonly pending = false
  readonly reached = true
  done = false
  readonly cuts = 0
  /** 1: the feed keeps its own clock (the schedule), the screen is not to wind it on again */
  readonly rate = 1
  /** how many times life speed it is being shown at (the screen shows the fast-forward mark over 2.6) */
  speed = 1
  flash: { label: string; home: boolean; n: number } | null = null
  says: { k: string; home: boolean; src: number }[] = []
  banner: FeedBanner | null = null
  /** the play on screen now, by its index in the record */
  n = 0
  constructor(public plays: Play[], sides?: [RecSide, RecSide], private ids: [string, string] = ['home', 'away'], private nameOf?: (id: string) => string | undefined) {
    this.bk = bakeOf(plays, sides)
    this.ps = pieces(this.bk)
    this.read()
  }
  get length(): number { return this.ps.length ? this.ps[this.ps.length - 1].v1 : 0 }
  step(dt: number) { if (this.done) return; this.view = Math.min(this.length, this.view + dt); this.read() }
  seek(v: number) { this.view = clamp(v, 0, this.length); this.read() }
  private read() {
    const a = animAt(this.ps, this.view)
    const fr = frameAt(this.bk, a)
    for (let i = 0; i < 30; i++) {
      const m = fr.men[i], b = this.b[i]
      b.vx = m.x - b.x; b.vy = m.y - b.y; b.x = m.x; b.y = m.y
      this.fl[i] = fr.flags[i]; this.down[i] = fr.flags[i] & 1 ? 1 : 0; this.off[i] = !!(fr.flags[i] & 4)
    }
    this.ref.x = fr.ref.x; this.ref.y = fr.ref.y
    this.ball.x = fr.ball.x; this.ball.y = fr.ball.y; this.ball.lift = fr.ball.lift
    this.holder = fr.holder
    const n = fr.n, p = this.plays[n], seg = this.bk.segs[n]
    const piece = this.ps.find(q => q.n === n && a >= q.a0 && a <= q.a1)
    this.speed = piece?.speed ?? 1
    if (!this.phase || this.phase.at !== n) {
      this.phase = { kind: KIND[p.kind] ?? 'hold', homeBall: fr.poss === 0, at: n, label: chipOf(p), x: p.x, y: p.y }
      const fk = FLASH[p.kind] ?? (p.kind === 'ruck' && p.result === 'turnover' ? 'lp.turnover' : p.kind === 'kick' && p.result === 'chargedDown' ? 'lp.chargeDown' : undefined)
      if (fk) this.flash = { label: fk, home: (p.kind === 'knockOn' || p.kind === 'forwardPass' || p.kind === 'intoTouch' ? p.side : p.ball) === 0, n }
      this.banner = this.bannerOf(n)
    }
    this.phase.homeBall = fr.poss === 0
    this.n = n
    this.landed = a >= seg.mark
    this.done = this.view >= this.length - 1e-6
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
  /** the man the current play names (the tag over the man on the ball shows when he has it) */
  get who(): string | undefined { return this.plays[this.n]?.who }
}
