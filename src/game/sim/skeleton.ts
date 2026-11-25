// THE MATCH SIMULATION (2.0.0, docs/match-sim-spec.md section 3).
//
// A whole match played one phase at a time: two sides, a ball, a place on the
// field, a clock and the laws. Every move goes through the laws machine
// (law.ts) and an illegal one throws. scripts/simshape.ts holds the shape of
// a match to the numbers in the spec, section 4; scripts/paritycheck.ts holds
// real fixtures to the old engine's odds.
//
// RESUMABLE (spec 1.2 and 3.4, the manager's hand). A match is a MatchSim: it
// can be run to a play or a clock time, stopped, have its World changed (a
// substitution, a tactics change, a team talk, any change of strength) or a
// penalty call answered, and carried on. Everything before the stop is
// exactly what it was, because it has already been written; everything after
// is played from the stop on the same dice, so the same seed and the same
// decisions at the same moments always give the same match. Its whole state
// is plain data (save(), and new MatchSim({ ..., from })), so a match can be
// put down and picked up again. simSkeleton({ seed, world }) is a MatchSim
// run to the final whistle with no decisions.
//
// The constants in K are what gets tuned.
import type { Rng } from '../rng'
import { Laws, type LawEvent, type LawState } from './law'
import type { KickType, PenaltyCall, Play, PlayKind, SimResult } from './record'
import { evenWorld, NEUTRAL_STYLE, type Contest, type Decision, type ManForm, type PlayStyle, type World } from './world'
const NO_MAN: ManForm = { carry: 1, tackle: 1, kick: 1, hands: 1, ruck: 1, legs: 1 }

export interface SkeletonOpts {
  seed: number
  /** each side's strength, 1 for an average side, when no team sheets are given */
  strength?: [number, number]
  /** the real sides: their strength at each contest and who does what (fromMatch.ts) */
  world?: World
}

/** who covers which shirt from the bench: 16 the hooker, 17 a loosehead, 18 a tighthead, 19 a lock,
 *  20 the back row, 21 the scrum-half, 22 the fly-half or a centre, 23 the back three or a centre */
const BENCH_FOR: number[][] = [[2], [1], [3], [4, 5], [6, 7, 8], [9], [10, 12, 13], [11, 14, 15, 13, 12]]

/** every number the shape of a match hangs on, in one place */
export const K = {
  // seconds of ball in play
  CARRY_S: 3.3, RUCK_S: 4.6, KICK_S: 6.2, CATCH_S: 2.2, SCRUM_S: 6, LINEOUT_S: 4, MAUL_S: 7, RESTART_S: 6.5, BREAK_S: 5,
  // seconds of dead time before a restart
  SCRUM_DEAD: 58, SCRUM_RESET_DEAD: 28, LINEOUT_DEAD: 31, PENALTY_DEAD: 18, GOAL_DEAD: 55, TRY_DEAD: 48, CON_DEAD: 48, KICKOFF_DEAD: 22, DROPOUT_DEAD: 24,
  // the decision: how often the side with the ball kicks, by where it is
  KICK_OWN22: 0.45, KICK_OWNHALF: 0.27, KICK_OPPHALF: 0.095, KICK_OPP22: 0.02, KICK_PER_PHASE: 0.012, KICK_PHASE_FROM: 4,
  // the carry
  WIDE: 0.30, WIDE_BLIND: 0.2, GAIN_TIGHT: 2.5, GAIN_TIGHT_SD: 2.4, GAIN_WIDE: 4.3, GAIN_WIDE_SD: 5.2,
  LINE_NEAR: 8, LINE_GAIN: 0.3,
  // LINE BREAKS (round 6, to the sources: about 10 a match, most run down): a break makes BREAK_MIN plus
  // up to BREAK_SPAN metres, and one in BREAK_LONG_P runs on up to BREAK_LONG more; inside five metres
  // of the line the cover gets there ('heldShort'); a runner hauled down is isolated, so the next ruck
  // is turned over ISOLATED_TURN times as often
  P_BREAK: 0.044, BREAK_MIN: 6, BREAK_SPAN: 20, BREAK_LONG_P: 0.35, BREAK_LONG: 50, ISOLATED_TURN: 2.2,
  // first-phase ball off a won set piece and the first two phases after a turnover meet a defence not set
  LAUNCH_B: 4.0, LAUNCH_B_22: 14.0, LAUNCH_B_OWN: 1.5, TURN_B: 1.3, LAUNCH_SCRUM: 0.6,
  // on their line the defence infringes and counter-rucks more: phase after phase there ends in a penalty or a turnover
  LINE_PEN: 1.3, LINE_TURN: 1.3,
  // the first two phases after catching the other side's kick (or a restart) meet a chasing line already up
  RETURN_B: 0.6,
  P_KNOCK_ON: 0.042, P_FORWARD: 0.004, P_INTO_TOUCH: 0.011, P_HELD_UP: 0.25,
  // an interception on a wide carry: how often, and how often the man who took it is away
  P_INTERCEPT: 0.006, INTERCEPT_AWAY: 0.45,
  // the ruck
  P_TURNOVER: 0.046, P_PEN_ATTACK: 0.017, P_PEN_DEFENCE: 0.01, P_UNPLAYABLE: 0.004,
  // kicks
  // what kind of kick: from the own 22 a clearance to touch or a long one; from the rest of the own half a box
  // kick, a long one, an up-and-under or one to touch
  KICK_CLEAR: 0.75, KICK_BOX: 0.38, KICK_LONG: 0.24, KICK_TOUCH: 0.25,
  P_OUT_FULL: 0.06, P_FIFTY22: 0.012,
  // set pieces
  LINEOUT_WON: 0.87, LINEOUT_STOLEN: 0.07, LINEOUT_NOT_STRAIGHT: 0.025, LINEOUT_PEN: 0.035,
  // the driving maul (round 6, to the sources: about 10 a match): near their line, in the middle, and deep in
  // the side's own half, times the pack's lean squared; most make a few metres and the ball is used
  MAUL_NEAR_MIN: 0.7, PICK_VS: 2,
  MAUL_FROM: 30, P_MAUL: 0.55, P_MAUL_MID: 0.40, P_MAUL_DEEP: 0.12, MAUL_GAIN: 4.5, MAUL_PEN: 0.10, MAUL_STOPPED: 0.08,
  SCRUM_PEN_FEED: 0.15, SCRUM_PEN_AGAINST: 0.08, SCRUM_FREE: 0.07, SCRUM_HEAD: 0.03, SCRUM_RESET: 0.22,
  // penalties. GOAL_TAKE set 21 Nov (was 0.66, +0.12 inside 30 m): the old engine takes about 3.5
  // shots at goal a match on the same fixtures and the simulation took 4.4 (scripts/tmp/gp/kicks.ts)
  GOAL_RANGE: 50, GOAL_TAKE: 0.52, GOAL_TAKE_NEAR: 0.10, LATE_CHASE_S: 4200, LATE_POSTS_S: 3600,
  // a penalty try: how near the line, and how often foul play there is judged to have stopped one
  PT_NEAR: 10, PT_CLOSE: 5, P_PT_CLOSE: 0.30, P_PT_NEAR: 0.13,
  PEN_TAP: 0.04, PEN_SCRUM: 0.05, FREE_TAP: 0.55, P_YELLOW_22: 0.13,
  CON_GOOD: 0.77,
  // where the kick is from: each metre past 15 out and each step off the posts costs this much,
  // around the average spot of a kick in this simulation (measured, scripts/tmp/gp/shape.ts), so a
  // world that knows the kicker's own chance (World.goalP) keeps it on average
  CON_WIDE: 0.34, CON_WIDE_MEAN: 0.54, PEN_FAR: 0.008, PEN_FAR_MEAN: 15.0, PEN_WIDE: 0.16, PEN_WIDE_MEAN: 0.54,
  // cards: a man in the bin for ten minutes, and what being a man down costs each contest.
  // P_RED IS THE GAME'S OWN RATE (owner, 25 Nov 22:27: the current game's, not real rugby's): the old
  // engine sends a man straight off 0.038 times a match, both sides together, on the week's 56 league
  // fixtures (scripts/tmp/gp/reds.ts, 600 matches); at 0.013 this gave 0.132. A second yellow is a red
  // as well (card(), Law 9), on top of this.
  P_YELLOW: 0.05, P_RED: 0.0032, BIN_S: 600, SHORT_COST: 0.09,
  // THE CAPTAIN (a design choice, round 6): his side gives away this much fewer penalties in its own 22 a
  // unit of leadership, lifts the carry this much when behind, and a poor one gets a late close call wrong
  // this often a unit. CHEMISTRY: knock-ons this much fewer a unit (-0.5 to 0.5). A CALLED MOVE: first-phase gain.
  CAPTAIN_PEN: 0.05, CAPTAIN_LIFT: 0.008, CAPTAIN_WRONG: 0.25, CHEM_KNOCK: 0.3, MOVE_GAIN: 1.08,
  // a front row's legs against the other's, at the scrum, to this power
  FRONT_LEGS: 1.0,
  // the referee's patience: from this many penalties conceded a side has been warned, and a card is this much likelier
  WARN_AT: 6, WARN_CARD: 2,
  // the in-goal's depth behind each goal line (as the pitch draws it, fromRecord.ts IN_GOAL), and how far
  // past a touchline or dead-ball line a ball that is out is written (Play.out)
  IN_GOAL: 8, OUT_BY: 1.5,
  // quick and slow ruck ball: how often it is quick for an average side, and what it does to the next phase
  P_QUICK_BALL: 0.45, QUICK_GAIN: 1.1, SLOW_GAIN: 0.92, SLOW_KICK: 1.15,
  // a drop at goal, taken from in range when a possession has gone a few phases; and a kick charged down
  DROP_RANGE: 36, DROP_PHASE: 3, P_DROP: 0.005, DROP_GOOD: 0.36, P_CHARGE: 0.011,
  // ROUND 4 (variety). A drop at goal is six times as likely with the scores level or a kick
  // behind in the last ten minutes
  DROP_LATE: 6,
  // offloads out of the tackle (times the side's style), and twice as often off a man hauled down after a break
  P_OFFLOAD: 0.065,
  // near their line: the pick and go (times the side's style), from inside this many metres
  PICK_ZONE: 6, P_PICK: 0.3,
  // a quick lineout and a quick tap (times the side's style)
  P_QUICK_LINEOUT: 0.10, QUICK_TAP_DEAD: 4,
  // fatigue late in each half: in the last ten minutes of a half a break is up to this much likelier
  LATE_BREAK: 0.25,
  // and in the last twenty minutes, from the legs (tick.ts TIRED_DEF, TIRED_ATT): an empty defence gives up
  // up to this much more, an empty attack makes up to this much less
  TIRED_DEF: 0.8, TIRED_ATT: 0.3,
  // momentum: a try, a turnover or a break lifts the side a little, fading over about four minutes
  MOM_TRY: 0.04, MOM_TURN: 0.025, MOM_BREAK: 0.015, MOM_MAX: 0.08, MOM_DECAY: 240,
  // a man hurt in a tackle, and the bench: each replacement's minute is drawn between these, the
  // front row first. (Round 8: 0.002 to 0.0095, the old engine's rate: 1.66 men off injured a match,
  // both sides, on the managed fixture (1.6 here at 0.0095); at 0.002 a season of watched matches had 72% fewer injuries.)
  P_INJURY: 0.0095, SUB_FROM: 2880, SUB_SPAN: 1080,
  // a carry driven back this far is a dominant tackle
  DRIVEN_BACK: -1.5,
  // A STYLE IS A WAY OF PLAYING, NOT A STRENGTH. What each lever is worth to the margin here
  // (scripts/tmp/gp/calib.ts: even sides, 12,000 paired seeds, one lever moved on one side), as a
  // share of what the carry against the tackle is worth (23.8 points of margin per unit of log):
  // kicking -2.9, width +2.1, the maul and the pick and go +1.2 (both up together), offloads +1.3,
  // quicker rucks -0.2, a blitz +2.7 per unit, a narrow defence +0.9, quick taps and throws -0.4.
  // Each is taken back off the side's own carry, so a style changes how a side plays and leaves
  // what it wins to the old engine's own style leans (PlayStyle.tryF, matchup) and to the men.
  // Without it, the per-fixture margin gap to the old engine went from 2.3 to 3.4 points (rms).
  // A BLITZ IS A BET ON THE BALL GOING WIDE (round 7): it shuts down the outside (BLITZ_WIDE off a wide
  // carry's edge) and is beaten on the inside by the carry it rushed past (BLITZ_TIGHT, negative, onto a
  // tight one), so line speed pays against a side that spreads it and costs against one that goes direct.
  // (Was 0.1 on every carry, which made the blitz simply better: +4.0 win % on the lever table.)
  BLITZ_WIDE: 0.25, BLITZ_TIGHT: -0.04,
  // how much more a squad's fit to tight or wide play (PlayStyle.fit) counts inside their 22, where a
  // pack's weight in the pick and go and the maul, or a back three's pace, decides the try
  FIT_22: 4,
  COMP_KICK: 0.26, COMP_WIDTH: -0.086, COMP_PACK: 0.020, COMP_OFFLOAD: -0.053, COMP_TEMPO: 0.080, COMP_BLITZ: -0.005, COMP_NARROW: -0.037, COMP_QUICK: 0.018, COMP_CORNER: -0.030,
  // (round 5, re-measured after the driving maul, quick ruck ball and the corner call came in: the pack
  // -0.025 to -0.074, tempo 0.008 to 0.080, and the corner -0.061 a unit of its lean)
  // (round 6, after mauls across the field and the realism retune: the pack -0.074 to -0.015, the blitz -0.115
  // to -0.059; the kick 0.123 to 0.26, set on the real fixture so the kicking dial moves the result as the old engine's does)
  // (round 7, after the blitz split by width and the plan in their 22 taken off the side's carry: the
  // blitz -0.059 to -0.005, the pack -0.015 to 0.020, the corner -0.061 to -0.030, each from calib.ts
  // in the even world, so the style dial and line speed are worth nothing to a level squad there)
} as const

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * THE PHASE-PLAY SHAPES (round 5): how the ball gets to the carrier, and what it does to his odds.
 * g: times the gain; b: times the line-break chance; k: times the knock-on chance; t: times the
 * turnover chance at the ruck after; i: times the interception chance (wide shapes only); passes:
 * the hands it goes through. Which shape is played is the side's style, where it is, the phase
 * count and how the defence is set (MatchSim.pickShape).
 */
export const SHAPES: Record<string, { wide: boolean; g: number; b: number; k: number; t: number; i: number; passes: number }> = {
  oneOut:     { wide: false, g: 0.95, b: 0.75, k: 0.8, t: 1.0, i: 0, passes: 1 },
  pod:        { wide: false, g: 1.0, b: 0.6, k: 0.7, t: 0.85, i: 0, passes: 1 },
  tipOn:      { wide: false, g: 1.08, b: 0.9, k: 1.35, t: 1.0, i: 0, passes: 2 },
  snipe:      { wide: false, g: 1.15, b: 1.6, k: 0.9, t: 1.25, i: 0, passes: 0 },
  pullBack:   { wide: false, g: 1.05, b: 1.3, k: 1.2, t: 1.0, i: 0, passes: 3 },
  podOff10:   { wide: true, g: 1.0, b: 0.9, k: 0.9, t: 1.0, i: 0.7, passes: 2 },
  miss:       { wide: true, g: 1.15, b: 1.15, k: 1.1, t: 1.0, i: 1.8, passes: 3 },
  loop:       { wide: true, g: 1.1, b: 1.35, k: 1.3, t: 1.0, i: 1.0, passes: 3 },
  wraparound: { wide: true, g: 1.05, b: 1.25, k: 1.2, t: 1.0, i: 1.0, passes: 3 },
  switch:     { wide: true, g: 1.0, b: 1.4, k: 1.25, t: 1.1, i: 0.8, passes: 2 },
  kickPass:   { wide: true, g: 1.3, b: 1.7, k: 1.8, t: 1.0, i: 1.5, passes: 1 },
}
const SHAPE_STYLE: Record<string, Partial<Record<string, number>>> = {
  direct: { oneOut: 1.6, pod: 1.3, tipOn: 1.3, miss: 0.6, loop: 0.6, wraparound: 0.7 },
  pods: { pod: 1.8, podOff10: 1.5, pullBack: 1.5 },
  width: { miss: 1.8, loop: 1.6, wraparound: 1.5, pullBack: 1.2, oneOut: 0.6, pod: 0.7 },
  kick: { kickPass: 2.5, pod: 1.2, oneOut: 1.2 },
  offload: { tipOn: 1.8, switch: 1.8, loop: 1.3 },
}

/** each attacking style's own average over its usual shapes (halfway, second phase, a plain defence),
 *  which every shape it plays is divided by: a style chooses how a side plays, the men decide what it
 *  wins (round 5: without it, the per-fixture margin gap to the old engine grew by about half a point) */
const SHAPE_NORM: Record<string, Record<'true' | 'false', { g: number; b: number; k: number; t: number; i: number }>> = {}
for (const atk of ['', 'direct', 'pods', 'width', 'kick', 'offload']) {
  SHAPE_NORM[atk] = {} as Record<'true' | 'false', { g: number; b: number; k: number; t: number; i: number }>
  for (const wide of [true, false]) {
    const S2 = SHAPE_STYLE[atk] ?? {}
    const base: [string, number][] = wide ? [['podOff10', 1], ['miss', 0.8], ['loop', 0.4], ['wraparound', 0.4], ['switch', 0.35], ['kickPass', 0.12]]
      : [['oneOut', 1], ['pod', 1], ['tipOn', 0.5], ['pullBack', 0.4], ['snipe', 0.1]]
    const ws = base.map(([id, w]) => w * (S2[id] ?? 1)), tot = ws.reduce((a, b) => a + b, 0)
    const avg = (k: 'g' | 'b' | 'k' | 't' | 'i') => base.reduce((a, [id], n) => a + ws[n] * SHAPES[id][k], 0) / tot
    SHAPE_NORM[atk][String(wide) as 'true' | 'false'] = { g: avg('g'), b: avg('b'), k: avg('k'), t: avg('t'), i: Math.max(0.01, avg('i')) }
  }
}

/** what happens next: the step the match is waiting on */
export type Next =
  | { k: 'kickoff'; by: 0 | 1 }
  | { k: 'dropout'; by: 0 | 1; goalLine: boolean }
  | { k: 'scrum'; to: 0 | 1 }
  | { k: 'lineout'; to: 0 | 1 }
  | { k: 'penalty'; to: 0 | 1; free: boolean; cause?: string; offender?: string }
  /** a penalty has been given and the cards shown: what is done with it */
  | { k: 'penaltyCall'; to: 0 | 1 }
  | { k: 'phase' }
  | { k: 'end' }

/** a penalty waiting on the manager's call (MatchSim.pending) */
export interface PendingCall {
  kind: 'penalty'
  side: 0 | 1
  /** where it was given, and how far out from the line the side is attacking */
  x: number; y: number; toLine: number
  t: number
  /** the calls the laws allow from here (posts only in range) */
  options: PenaltyCall[]
}

/** EVERYTHING a match is, as plain data: save() it, and new MatchSim({ ..., from }) carries on from it */
export interface SimState {
  v: 1
  seed: number
  /** the two dice: the match's own, and the one that names who does what */
  rng: number
  pick: number
  law: LawState
  /** seconds since kick-off, always going forward; `clock` is the referee's */
  t: number
  clock: number
  half: 0 | 1
  ball: 0 | 1
  x: number; y: number
  phase: number
  score: [number, number]
  tries: [number, number]
  /** men in the bin (the second each comes back) and men sent off */
  bin: [number[], number[]]
  sentOff: [number, number]
  carrierId: string
  passerId: string
  firstKO: 0 | 1
  next: Next
  /** each side's standing penalty call: 'auto' is the game's own (the AI), 'ask' stops for the manager */
  calls: [PenaltyCall | 'auto' | 'ask', PenaltyCall | 'auto' | 'ask']
  /** the manager's answer to the call he was asked, used once */
  answer: PenaltyCall | null
  plays: Play[]
  /** momentum: each side's lift and the second it was last raised */
  mom?: [number, number]
  momT?: [number, number]
  /** the possession began at a set piece and is on its first phase: 'scrum', 'lineout' or '' */
  launch?: string
  /** an offload has just kept the ball alive: the next phase is a carry, not a ruck or a kick */
  offloaded?: boolean
  /** whether the game runs each side's bench; the minute each bench shirt (16 to 23) is due on */
  bench?: [boolean, boolean]
  subPlan?: [number[], number[]] | null
  /** men hurt and off, waiting for the replacement */
  hurt?: [string[], string[]]
  /** penalties each side has given away (the referee's patience) */
  conceded?: [number, number]
  /** the next restart comes from a penalty option, so the full-time whistle waits for it */
  penaltyOn?: boolean
  /** dead time waited since the last play, written as the next play's `pre` */
  preAcc?: number
  /** a runner hauled down after a break, alone at the next ruck; phases left against a defence not set after a turnover */
  isolated?: boolean
  turnPhases?: number
  /** the last ruck's ball: quick or slow ('' when the phase did not come off a ruck) */
  ruckSpeed?: '' | 'quick' | 'slow'
  /** written on the next play: the penalty call carried out and who made it, a tactics change
   *  taking effect, a team talk heard (Play.call, callBy, tactics, talk) */
  tag?: Partial<Pick<Play, 'call' | 'callBy' | 'tactics'>>
  talkTag?: { side: 0 | 1; tone: string; pre?: boolean } | null
  /** each side's injuries are the manager's to cover (an 'injuryCall' decision), the man he named
   *  for each hurt man, and the hurt man the match is waiting on (pendingInjury) */
  injAsk?: [boolean, boolean]
  injPick?: Record<string, string>
  injWait?: { side: 0 | 1; who: string } | null
  /** the men shown a yellow card this match (a second one is a red) */
  yellowed?: string[]
  /** the call the match is stopped for goes to the side's own call this once (MatchSim.answerAuto) */
  autoOnce?: boolean
}

/** a man hurt on the manager's side, waiting for him to choose who comes on (MatchSim.pendingInjury) */
export interface PendingInjury {
  kind: 'injury'
  side: 0 | 1
  /** the hurt man */
  who: string
  /** the bench men who can come on, and the like for like the game would send (the default) */
  options: string[]
  like: string
  t: number
}

/** where to stop: the first moment between two steps at or after it */
export interface Stop {
  /** a play index: stop once there are at least this many plays */
  play?: number
  /** a time in seconds since kick-off (Play.t) */
  t?: number
  /** a referee's clock time in seconds (Play.clock: the second half starts at 2400) */
  clock?: number
  /** and only when the ball is dead (a restart is next): the moment a substitution can be made */
  dead?: boolean
}

/** a stateful mulberry32 (rng.ts): the same numbers, with the state kept where it can be saved */
function stream(st: SimState, key: 'rng' | 'pick'): Rng {
  return () => {
    let a = st[key] | 0
    a = (a + 0x6d2b79f5) | 0
    st[key] = a
    let z = Math.imul(a ^ (a >>> 15), 1 | a)
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

/** a fresh match from a seed, before the kick-off */
export function freshState(seed: number): SimState {
  const st: SimState = {
    v: 1, seed, rng: seed >>> 0, pick: (seed ^ 0x9e3779b9) >>> 0, law: 'kickoff',
    t: 0, clock: 0, half: 0, ball: 0, x: 50, y: 35, phase: 0, score: [0, 0], tries: [0, 0],
    bin: [[], []], sentOff: [0, 0], carrierId: '', passerId: '', firstKO: 0, next: { k: 'end' },
    calls: ['auto', 'auto'], answer: null, plays: [],
    mom: [0, 0], momT: [0, 0], launch: '', offloaded: false, bench: [true, true], subPlan: null, hurt: [[], []],
  }
  const rng = stream(st, 'rng')
  st.firstKO = rng() < 0.5 ? 0 : 1
  st.next = { k: 'kickoff', by: st.firstKO }
  st.t += K.KICKOFF_DEAD; st.clock += K.KICKOFF_DEAD
  return st
}

/** a world with one side made stronger (or weaker) from now on, at every contest or the ones named */
export function boosted(w: World, side: 0 | 1, factor: number, contests?: Contest[]): World {
  const only = contests ? new Set(contests) : null
  return Object.assign(Object.create(w) as World, {
    str: (s: 0 | 1, c: Contest, t: number) => w.str(s, c, t) * (s === side && (!only || only.has(c)) ? factor : 1),
  })
}

export class MatchSim {
  readonly st: SimState
  world: World
  private L: Laws
  private rng: Rng
  private pick: Rng
  /** decisions waiting for their moment (a substitution waits for the ball to be dead) */
  private queue: Decision[] = []

  constructor(o: SkeletonOpts & { from?: SimState }) {
    this.st = o.from ? structuredClone(o.from) : freshState(o.seed)
    this.world = o.world ?? evenWorld(o.strength ?? [1, 1])
    if (!o.from) this.world.newMatch?.()
    const st = this.st
    st.mom ??= [0, 0]; st.momT ??= [0, 0]; st.launch ??= ''; st.offloaded ??= false; st.bench ??= [true, true]; st.subPlan ??= null; st.hurt ??= [[], []]
    // the manager runs his own bench (Decision { kind: 'bench', auto: true } hands it to the game)
    if (!o.from && this.world.managed != null) st.bench[this.world.managed] = false
    this.L = new Laws(this.st.law)
    this.rng = stream(this.st, 'rng')
    this.pick = stream(this.st, 'pick')
  }

  get plays(): Play[] { return this.st.plays }
  get done(): boolean { return this.st.next.k === 'end' }
  /** the manager's penalty call the match is stopped for, or null */
  get pending(): PendingCall | null {
    const st = this.st, n = st.next
    if (n.k !== 'penaltyCall' || st.calls[n.to] !== 'ask' || st.answer || st.autoOnce) return null
    const d = n.to === 0 ? 100 - st.x : st.x
    // inside five metres nobody kicks to touch, so the corner is not offered
    const options: PenaltyCall[] = (d <= K.GOAL_RANGE ? ['posts', 'corner', 'tap', 'scrum'] : ['corner', 'tap', 'scrum'])
      .filter(o => o !== 'corner' || d > 5) as PenaltyCall[]
    return { kind: 'penalty', side: n.to, x: st.x, y: st.y, toLine: d, t: st.t, options }
  }
  /** a man hurt on a side whose injuries the manager covers: the match waits at the dead ball */
  get pendingInjury(): PendingInjury | null {
    const st = this.st, w = st.injWait
    if (!w || st.next.k === 'end') return null
    const lu = this.world.lineup?.(w.side)
    if (!lu) return null
    const options = lu.bench.filter(Boolean)
    if (!options.length) return null
    return { kind: 'injury', side: w.side, who: w.who, options, like: this.likeFor(w.side, w.who) || options[0], t: st.t }
  }
  /** the manager's man for the hurt man the match is waiting on (any of pendingInjury.options) */
  answerInjury(on: string): void {
    const p = this.pendingInjury
    if (!p) throw new Error('no injury is waiting')
    if (!p.options.includes(on)) throw new Error(`${on} is not on the bench`)
    ;(this.st.injPick ??= {})[p.who] = on
    this.st.injWait = null
    this.benches()
  }
  /** the nearest like for like on the bench for a man in a shirt */
  private likeFor(s: 0 | 1, id: string): string {
    const lu = this.world.lineup?.(s)
    if (!lu) return ''
    const shirt = lu.field.indexOf(id) + 1
    const want = shirt <= 0 ? 0 : BENCH_FOR.findIndex(f => f.includes(shirt))
    const order = want < 0 ? [0, 1, 2, 3, 4, 5, 6, 7] : [want, ...[0, 1, 2, 3, 4, 5, 6, 7].filter(i => i !== want).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))]
    const b = order.find(i => lu.bench[i])
    return b != null ? lu.bench[b] : ''
  }
  /** a copy of the whole state, to put the match down and pick it up later (with the same World) */
  save(): SimState { return structuredClone(this.st) }
  result(): SimResult {
    const m = this.world.managed
    return { plays: this.st.plays, score: this.st.score, tries: this.st.tries, ...(m === 0 || m === 1 ? { managed: m } : {}) }
  }

  /** leave the call the match is stopped for to the side's own call (the captain's), as the game makes it */
  answerAuto(): void {
    if (!this.pending) throw new Error('no penalty call is waiting')
    this.st.autoOnce = true
  }
  /** answer the call the match is stopped for */
  answer(call: PenaltyCall): void {
    const p = this.pending
    if (!p) throw new Error('no penalty call is waiting')
    if (!p.options.includes(call)) throw new Error(`"${call}" is not allowed from ${Math.round(p.toLine)} m out`)
    this.st.answer = call
  }

  /**
   * A DECISION, from this moment. A strength change, a new World, a tactics
   * change or a team talk take effect on the next step; a substitution waits
   * for the ball to be dead (Law 3) and writes a `substitution` play when it
   * is made. A penalty call ('posts', 'corner', 'tap', 'scrum', 'ask' or
   * 'auto') stands from now until it is changed.
   */
  apply(d: Decision): void {
    this.queue.push(d)
    this.flush()
  }

  /** play one step (a restart, a phase, a penalty), or nothing when the match is over or a call is waiting */
  step(): boolean {
    if (this.done || this.pending) return false
    this.flush()
    this.benches()
    this.st.next = this.play(this.st.next)
    this.st.law = this.L.state
    this.flush()
    return true
  }

  /** play on to a stop (or to the end), stopping early for a penalty call the manager has to make */
  runUntil(stop: Stop = {}): this {
    const st = this.st
    const reached = () =>
      (stop.play == null || st.plays.length >= stop.play) && (stop.t == null || st.t >= stop.t) && (stop.clock == null || st.clock >= stop.clock) &&
      (stop.play != null || stop.t != null || stop.clock != null) && (!stop.dead || st.next.k !== 'phase')
    for (let guard = 0; guard < 5000 && !this.done && !this.pending && !this.pendingInjury && !reached(); guard++) this.step()
    return this
  }

  private flush() {
    const keep: Decision[] = []
    for (const d of this.queue) {
      if (d.kind === 'world') this.world = d.world
      else if (d.kind === 'strength') this.world = boosted(this.world, d.side, d.factor, d.contests)
      else if (d.kind === 'penaltyCall') this.st.calls[d.side] = d.call
      else if (d.kind === 'bench') this.st.bench![d.side] = d.auto
      else if (d.kind === 'injuryCall') { (this.st.injAsk ??= [false, false])[d.side] = d.ask; if (!d.ask && this.st.injWait?.side === d.side) this.st.injWait = null }
      else if (d.kind === 'substitution') {
        // only with the ball dead, before a restart: never in open play, and not while a penalty
        // (whose offender is already named) is being given and taken
        const nk = this.st.next.k
        if (nk === 'phase' || nk === 'penalty' || nk === 'penaltyCall') { keep.push(d); continue }
        const why = this.world.decide ? this.world.decide(d, this.st.t, this.st.score) : 'this world has no bench'
        const st = this.st
        // the game's own changes are only written when they are made
        if (why && (d.auto || d.injury)) continue
        if (d.injury) st.hurt![d.side] = st.hurt![d.side].filter(id => id !== d.off)
        // the dead time already waited before the change is written on it as `pre`, as emit() does for
        // every other stoppage, so the next play does not carry it past the change (harmonycheck R28)
        const pre = st.preAcc ? r1(st.preAcc) : undefined
        st.preAcc = 0
        st.plays.push({ n: st.plays.length, t: Math.round(st.t), clock: Math.round(st.clock), kind: 'substitution', side: d.side, ball: st.ball, ...(pre ? { pre } : {}),
          x: r1(st.x), y: r1(st.y), result: why ? 'refused' : 'made', who: d.off, with: [d.on], live: 0, dead: 0, score: [st.score[0], st.score[1]], ...(why ? { cause: why } : d.injury ? { cause: 'injury' } : d.auto ? { cause: 'tactical' } : {}), ...(d.chosen && !why ? { callBy: 'manager' as const } : {}) })
      } else if (this.world.decide) {
        // what a tactics change replaced, as the World had it, for the record (Play.tactics)
        const was: Record<string, unknown> = {}
        if (d.kind === 'tactics') { const tac = this.world.tactic?.(d.side); for (const k of Object.keys(d.set)) was[k] = tac?.[k] }
        const why = this.world.decide(d, this.st.t, this.st.score)
        if (!why && d.kind === 'tactics') this.st.tag = { ...this.st.tag, tactics: { side: d.side, set: d.set, was } }
        if (!why && d.kind === 'talk') this.st.talkTag = { side: d.side, tone: d.tone, ...(d.pre ? { pre: true } : {}) }
      }
    }
    this.queue = keep
  }

  // ---- the match, one step at a time --------------------------------------
  private play(next: Next): Next {
    switch (next.k) {
      case 'kickoff': return this.kickoff(next.by)
      case 'dropout': return this.dropout(next.by, next.goalLine)
      case 'scrum': return this.scrum(next.to)
      case 'lineout': return this.lineout(next.to)
      case 'penalty': return this.penalty(next.to, next.free, next.cause, next.offender)
      case 'penaltyCall': return this.penaltyCall(next.to)
      case 'phase': return this.playPhase()
      case 'end': return next
    }
  }

  private other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0)
  /** metres up the field for a side: side 0 plays towards x = 100 */
  private adv = (s: 0 | 1, from: number, m: number) => (s === 0 ? from + m : from - m)
  /** how far a side is from the line it is attacking */
  private toLine = (s: 0 | 1, at: number) => (s === 0 ? 100 - at : at)
  private gauss(mean: number, sd: number) {
    const u = Math.max(1e-9, this.rng()), v = this.rng()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  private short = (s: 0 | 1) => this.st.bin[s].filter(u => u > this.st.t).length + this.st.sentOff[s] + (this.st.hurt?.[s].length ?? 0)
  /** a side's strength at a contest now: a man down costs every contest; momentum lifts it a little */
  private S = (s: 0 | 1, c: Contest) => this.world.str(s, c, this.st.t) * Math.max(0.55, 1 - K.SHORT_COST * this.short(s)) * (c === 'goal' || c === 'discipline' ? 1 : 1 + this.mom(s))
  private sty = (s: 0 | 1): PlayStyle => this.world.style?.(s) ?? NEUTRAL_STYLE
  /** which shape this phase is run in, on one draw */
  private pickShape(wide: boolean, d: number, me: PlayStyle, them: PlayStyle): string {
    const st = this.st, ph = st.phase, S2 = SHAPE_STYLE[me.atk] ?? {}, wet = this.wet()
    const w = (id: string, base: number) => [id, base * (S2[id] ?? 1)] as [string, number]
    const opp22 = d <= 22
    const list: [string, number][] = wide ? [
      w('podOff10', 1.0), w('miss', 0.8 * (opp22 ? 0.8 : 1) * (1 + Math.max(0, them.narrow))), w('loop', 0.4), w('wraparound', 0.4 * (1 + Math.max(0, them.narrow))),
      w('switch', 0.35 * (ph >= 4 ? 1.3 : 1) * (1 + Math.max(0, -them.blitz))), w('kickPass', d <= 45 && !wet ? 0.12 * (opp22 ? 1.5 : 1) * (1 + Math.max(0, them.blitz)) : 0),
    ] : [
      w('oneOut', 1.0 * (opp22 ? 1.5 : 1)), w('pod', 1.0), w('tipOn', 0.5), w('snipe', ph >= 3 ? 0.25 * (opp22 ? 1.5 : 1) * (ph >= 4 ? 1.6 : 1) * (1 + Math.max(0, -them.blitz)) : 0),
      w('pullBack', d > 8 ? 0.4 * (opp22 ? 1.2 : 1) * (1 + Math.max(0, them.blitz)) : 0),
    ]
    return this.choose(this.rng(), list)
  }
  private man = (s: 0 | 1, id: string | undefined): ManForm => (id && this.world.man ? this.world.man(s, id, this.st.t) : NO_MAN)
  /** the style's own levers taken back off the side's carry (K.COMP_*) */
  private comp(y: PlayStyle) {
    return Math.pow(y.kick, K.COMP_KICK) * Math.pow(y.width / NEUTRAL_STYLE.width, K.COMP_WIDTH) * Math.pow(y.maul * y.pick, K.COMP_PACK) *
      Math.pow(y.offload, K.COMP_OFFLOAD) * Math.pow(y.tempo, K.COMP_TEMPO) * Math.pow(y.quick, K.COMP_QUICK) * Math.exp(K.COMP_BLITZ * y.blitz + K.COMP_NARROW * y.narrow + K.COMP_CORNER * (y.corner - NEUTRAL_STYLE.corner))
  }
  /** rain or snow: a wet ball. Damp is a little of both. */
  private wet = () => (this.world.weather === 'Rain' || this.world.weather === 'Snow' ? 1 : this.world.weather === 'Damp' ? 0.4 : 0)
  private lead = (s: 0 | 1) => this.st.score[s] - this.st.score[this.other(s)]
  /** the scoreboard and the clock: chasing the game late, or protecting a lead */
  private chasing = (s: 0 | 1) => (this.st.clock >= 3600 && this.lead(s) <= -8) || (this.st.clock >= 4200 && this.lead(s) < 0)
  private protecting = (s: 0 | 1) => this.st.clock >= 3600 && this.lead(s) > 0 && !(this.lead(s) > 20)
  /** men more than the other side (negative: fewer) */
  private menUp = (s: 0 | 1) => this.short(this.other(s)) - this.short(s)
  private mom = (s: 0 | 1) => (this.st.mom?.[s] ?? 0) * Math.exp(-(this.st.t - (this.st.momT?.[s] ?? 0)) / K.MOM_DECAY)
  private bump(s: 0 | 1, v: number) { this.st.mom![s] = Math.min(K.MOM_MAX, this.mom(s) + v); this.st.momT![s] = this.st.t }
  /** weighted choice on one draw */
  private choose<T extends string>(u: number, w: [T, number][]): T {
    const tot = w.reduce((a, x) => a + Math.max(0, x[1]), 0)
    let acc = 0
    for (const [k, v] of w) { acc += Math.max(0, v) / tot; if (u < acc) return k }
    return w[w.length - 1][0]
  }

  /**
   * THE GAME'S OWN BENCH, at a dead ball, for each side it runs: a hurt man
   * replaced at once, and each bench shirt on at a minute drawn for this
   * match between about 48 and 66, the front row first and the backs last
   * (the old engine empties its benches from the 44th minute, most of them
   * around the 61st). Like for like: 16 for the hooker, 17 and 18 the props,
   * 19 a lock, 20 the back row, 21 the scrum-half, 22 the fly-half or a
   * centre, 23 the back three or a centre.
   */
  private benches() {
    const st = this.st, W = this.world
    if (!W.lineup || !W.decide) return
    const nk = st.next.k
    if (nk === 'phase' || nk === 'penalty' || nk === 'penaltyCall' || nk === 'end') return
    const FOR = BENCH_FOR
    if (!st.subPlan) {
      const order = [0.15, 0.05, 0.25, 0.45, 0.55, 0.7, 0.8, 0.9]
      st.subPlan = [0, 1].map(() => order.map(o => Math.round(K.SUB_FROM + K.SUB_SPAN * Math.min(1, Math.max(0, o + (this.pick() - 0.5) * 0.3))))) as [number[], number[]]
    }
    for (const s of [0, 1] as const) {
      const lu = W.lineup(s)
      // a hurt man first, whoever runs the bench: the nearest like for like still on the bench
      for (const id of st.hurt![s]) {
        // the manager's own side, when he covers its injuries: his man, or the match waits for him
        if (st.injAsk?.[s] && lu.bench.some(Boolean)) {
          const on = st.injPick?.[id]
          if (on && lu.bench.includes(on)) { this.queue.push({ kind: 'substitution', side: s, off: id, on, injury: true, chosen: true }); continue }
          if (!st.injWait) st.injWait = { side: s, who: id }
          continue
        }
        const shirt = lu.field.indexOf(id) + 1
        const want = shirt <= 0 ? 0 : FOR.findIndex(f => f.includes(shirt))
        const order = want < 0 ? [0, 1, 2, 3, 4, 5, 6, 7] : [want, ...[0, 1, 2, 3, 4, 5, 6, 7].filter(i => i !== want).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))]
        const b = order.find(i => lu.bench[i])
        if (b != null) this.queue.push({ kind: 'substitution', side: s, off: id, on: lu.bench[b], injury: true })
      }
      if (!st.bench![s]) continue
      st.subPlan[s].forEach((due, i) => {
        if (due < 0 || st.clock < due || !lu.bench[i]) return
        const shirts = FOR[i].filter(n => lu.field[n - 1] && !lu.off[n - 1])
        if (!shirts.length) return
        const off = lu.field[shirts[Math.floor(this.pick() * shirts.length)] - 1]
        this.queue.push({ kind: 'substitution', side: s, off, on: lu.bench[i], auto: true })
        st.subPlan![s][i] = -1
      })
    }
    this.flush()
  }
  /** how much the better of side s at contest a is than the other side at contest b */
  private vs = (s: 0 | 1, a: Contest, b: Contest = a) => this.S(s, a) / this.S(this.other(s), b)
  private ids = (a: string[]) => a.filter(Boolean)
  private oneOf = <T>(a: readonly T[]): T => a[Math.floor(this.pick() * a.length)]

  private emit(kind: PlayKind, side: 0 | 1, result: string, law: LawEvent | null, live: number, dead: number, more?: Partial<Play>) {
    const st = this.st
    // (nobody is ever behind a dead-ball line: a man driven back over his own line is held on it)
    st.x = clamp(st.x, 0, 100); st.y = clamp(st.y, 0, 70)
    if (law && !this.L.go(law)) throw new Error(`the laws do not allow ${law} (${kind}/${result}) from "${this.L.state}" at play ${st.plays.length}`)
    st.t += live + dead; st.clock += live + dead
    const p: Play = { n: st.plays.length, t: Math.round(st.t), clock: Math.round(st.clock), kind, side, ball: st.ball, x: r1(st.x), y: r1(st.y), result, live, dead, score: [st.score[0], st.score[1]] }
    if (more) for (const k in more) { const v = (more as Record<string, unknown>)[k]; if (v !== undefined && v !== '') (p as unknown as Record<string, unknown>)[k] = v }
    if (st.tag) { Object.assign(p, st.tag); st.tag = undefined }
    if (st.talkTag && kind === 'kickoff') { p.talk = st.talkTag; st.talkTag = null }
    // the dead time waited before this play (a set piece forming, a penalty being taken), all of it
    if (st.preAcc) { p.pre = r1(st.preAcc); st.preAcc = 0 }
    st.plays.push(p)
  }
  /** dead time before a set piece: on the clock, and written on the play as `pre` */
  private wait(s: number) { this.st.t += s; this.st.clock += s; this.st.preAcc = (this.st.preAcc ?? 0) + s; return s }

  /** half-time and full time are blown when the ball next goes dead */
  private whistle(): Next | null {
    const st = this.st
    // (a penalty given before the whistle can still be played after it: its scrum or its lineout is taken, Law 5.7)
    const on = !!st.penaltyOn
    st.penaltyOn = false
    if (st.half === 0 && st.clock >= 2400 && !on) {
      this.emit('halfTime', 0, 'halfTime', 'HALF', 0, 0)
      // the referee's clock starts the second half at forty minutes; the record's t runs on
      st.clock = 2400; st.half = 1
      return { k: 'kickoff', by: this.other(st.firstKO) }
    }
    if (st.half === 1 && st.clock >= 4800 && !on) { this.emit('fullTime', 0, 'fullTime', null, 0, 0); return { k: 'end' } }
    return null
  }

  private card(off: 0 | 1, red: boolean, cause: string, who: string) {
    const st = this.st
    // A SECOND YELLOW IS A RED (Law 9): a man already shown one this match is sent off
    if (!red && who && (st.yellowed ??= []).includes(who)) { red = true; cause = 'secondYellow' }
    if (!red && who) st.yellowed!.push(who)
    if (red) { st.sentOff[off]++; this.world.carded?.(off, who, Infinity); this.emit('redCard', off, cause, null, 0, 20, { who }); return }
    const until = st.t + K.BIN_S
    st.bin[off].push(until); this.world.carded?.(off, who, until)
    this.emit('yellowCard', off, cause, null, 0, 12, { who, until: Math.round(until) })
  }

  private scoreTry(s: 0 | 1, how: string): Next {
    const st = this.st, W = this.world
    st.x = s === 0 ? 100 : 0
    st.score[s] += 5; st.tries[s]++
    this.emit('try', s, how, 'TRY', 0, K.TRY_DEAD, { who: st.carrierId, with: st.passerId ? [st.passerId] : undefined })
    // the conversion is from in line with where it was scored: out wide is harder
    const wide = Math.abs(st.y - 35) / 35
    // a world that knows the kicker gives his own chance from an average spot; out wide is harder than that
    const pCon = W.goalP ? W.goalP(s, 'con', st.t, st.score[s] - st.score[this.other(s)]) + K.CON_WIDE * (K.CON_WIDE_MEAN - wide)
      : (K.CON_GOOD + 0.16 - wide * K.CON_WIDE) * Math.sqrt(this.S(s, 'goal'))
    const good = this.rng() < clamp(pCon, 0.2, 0.98)
    if (good) st.score[s] += 2
    this.emit('conversion', s, good ? 'over' : 'wide', 'CON', 0, K.CON_DEAD, { good, who: W.goalKicker(s) })
    return { k: 'kickoff', by: this.other(s) }
  }

  private kickoff(by: 0 | 1): Next {
    const w = this.whistle(); if (w) return w
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    const rec = this.other(by)
    st.x = this.adv(by, 50, 17 + rng() * 14); st.y = 8 + rng() * 54; st.ball = by; st.passerId = ''
    const u = rng()
    // a bad kick-off is written where it went: short of the ten-metre line, or out on the full
    if (u >= 0.98) st.y = st.y < 35 ? 0 : 70
    else if (u >= 0.96) st.x = this.adv(by, 50, 3 + Math.abs(st.x - 50) * 0.2)
    this.emit('kickoff', by, 'kicked', 'KICKOFF', K.RESTART_S, 0, { kick: 'restart', who: W.kicker(by, false, pick), land: [r1(st.x), r1(st.y)] })
    if (u < 0.82) { st.ball = rec; st.phase = 1; st.turnPhases = -2; st.carrierId = W.jumper(rec, pick); this.emit('catch', rec, 'caught', 'PLAY', K.CATCH_S, 0, { who: st.carrierId }); return { k: 'phase' } }
    if (u < 0.91) { st.ball = by; st.phase = 1; st.carrierId = W.jumper(by, pick); this.emit('catch', by, 'regathered', 'PLAY', K.CATCH_S, 0, { who: st.carrierId }); return { k: 'phase' } }
    if (u < 0.96) { this.emit('knockOn', rec, 'underTheRestart', 'STOP', 0, 0, { who: W.jumper(rec, pick) }); return { k: 'scrum', to: by } }
    // not ten metres, or straight out: a scrum on halfway to the side that did not kick
    st.x = 50; st.y = 35
    this.emit('restartError', by, u < 0.98 ? 'notTen' : 'outOnFull', 'STOP', 0, 0)
    return { k: 'scrum', to: rec }
  }

  private dropout(by: 0 | 1, goalLine: boolean): Next {
    const w = this.whistle(); if (w) return w
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    const from = by === 0 ? (goalLine ? 0 : 22) : (goalLine ? 100 : 78)
    st.x = this.adv(by, from, 26 + rng() * 16); st.y = 8 + rng() * 54; st.ball = by; st.passerId = ''
    this.emit(goalLine ? 'goalLineDropout' : 'dropout22', by, 'kicked', 'DROPOUT', K.RESTART_S, 0, { kick: 'restart', who: W.kicker(by, false, pick), land: [r1(st.x), r1(st.y)] })
    // (the dead time is before it: the sides walking back)
    st.plays[st.plays.length - 1].dead = K.DROPOUT_DEAD; st.t += K.DROPOUT_DEAD; st.clock += K.DROPOUT_DEAD
    if (rng() < 0.88) { st.ball = this.other(by); st.phase = 1; st.turnPhases = -2; st.carrierId = W.catcher(st.ball, pick); this.emit('catch', st.ball, 'caught', 'PLAY', K.CATCH_S, 0, { who: st.carrierId }) }
    else { st.ball = by; st.phase = 1; st.carrierId = W.catcher(by, pick); this.emit('catch', by, 'regathered', 'PLAY', K.CATCH_S, 0, { who: st.carrierId }) }
    return { k: 'phase' }
  }

  private scrum(to: 0 | 1): Next {
    const w = this.whistle(); if (w) return w
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    st.x = clamp(st.x, 5, 95); st.y = clamp(st.y, 15, 55); st.ball = to; st.passerId = ''; st.carrierId = ''
    let dead = K.SCRUM_DEAD, resets = 0
    while (rng() < K.SCRUM_RESET) { dead += K.SCRUM_RESET_DEAD; resets++ }
    const pre = this.wait(dead)
    // the front rows' own legs: a tired front row against a fresh one off the bench
    const fr = (s2: 0 | 1) => { const f = W.lineup?.(s2).field; if (!f || !W.man) return 1; return (this.man(s2, f[0]).legs + this.man(s2, f[1]).legs + this.man(s2, f[2]).legs) / 3 }
    const u = rng(), feed = this.vs(to, 'scrum') * Math.pow(fr(to) / fr(this.other(to)), K.FRONT_LEGS)
    const pf = K.SCRUM_PEN_FEED * feed, pa = K.SCRUM_PEN_AGAINST / feed
    const base = { pre, resets: resets || undefined }
    if (u < pf) {
      const off = W.forward(this.other(to), pick)
      this.emit('scrum', to, 'penaltyWon', 'SCRUM', K.SCRUM_S, 0, { ...base, vs: this.ids([off]) })
      return { k: 'penalty', to, free: false, cause: this.oneOf(['collapsing', 'standingUp', 'notBinding']), offender: off }
    }
    if (u < pf + pa) {
      const off = W.forward(to, pick)
      this.emit('scrum', to, 'penaltyLost', 'SCRUM', K.SCRUM_S, 0, { ...base, who: off })
      return { k: 'penalty', to: this.other(to), free: false, cause: this.oneOf(['collapsing', 'standingUp', 'notBinding']), offender: off }
    }
    if (u < pf + pa + K.SCRUM_FREE) {
      this.emit('scrum', to, 'freeKick', 'SCRUM', K.SCRUM_S, 0, base)
      const fk = rng() < 0.5 ? to : this.other(to)
      return { k: 'penalty', to: fk, free: true, cause: 'earlyEngagement', offender: W.forward(this.other(fk), pick) }
    }
    if (u < pf + pa + K.SCRUM_FREE + K.SCRUM_HEAD / feed) { st.ball = this.other(to); st.phase = 1; this.emit('scrum', to, 'againstTheHead', 'SCRUM', K.SCRUM_S, 0, { ...base, vs: this.ids([W.forward(this.other(to), pick)]) }); return { k: 'phase' } }
    st.phase = 1; st.launch = 'scrum'
    this.emit('scrum', to, 'won', 'SCRUM', K.SCRUM_S, 0, base)
    return { k: 'phase' }
  }

  private lineout(to: 0 | 1): Next {
    const w = this.whistle(); if (w) return w
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    st.x = clamp(st.x, 5, 95); st.y = st.y < 35 ? 0 : 70; st.ball = to; st.passerId = ''; st.carrierId = ''; st.launch = ''
    // A QUICK THROW (Law 18): the side that did not put it out takes it before the lineout forms,
    // straight off a kick or a carry into touch (never after a penalty kick, which is the kicker's throw)
    const last = st.plays[st.plays.length - 1]
    const quickable = last && ((last.kind === 'kick' && last.result === 'touch') || last.kind === 'intoTouch') && last.side !== to
    if (quickable && rng() < K.P_QUICK_LINEOUT * this.sty(to).quick * (this.chasing(to) ? 1.6 : 1)) {
      const pre = this.wait(4)
      st.y = st.y < 35 ? 5 : 65; st.phase = 1
      st.carrierId = W.catcher(to, pick)
      this.emit('lineout', to, 'quick', 'LINEOUT', 2, 0, { pre, who: st.carrierId })
      return { k: 'phase' }
    }
    const pre = this.wait(K.LINEOUT_DEAD)
    const u = rng()
    if (u < K.LINEOUT_NOT_STRAIGHT) {
      this.emit('lineout', to, 'notStraight', 'LINEOUT', K.LINEOUT_S, 0, { pre, who: W.thrower(to) })
      st.y = st.y < 35 ? 15 : 55
      this.emit('notStraight', to, 'scrum', 'STOP', 0, 0, { who: W.thrower(to) })
      return { k: 'scrum', to: this.other(to) }
    }
    if (u < K.LINEOUT_NOT_STRAIGHT + K.LINEOUT_PEN) {
      this.emit('lineout', to, 'penalty', 'LINEOUT', K.LINEOUT_S, 0, { pre, who: W.thrower(to) })
      st.y = st.y < 35 ? 6 : 64
      const pto = rng() < 0.5 ? to : this.other(to), free = rng() < 0.4
      return { k: 'penalty', to: pto, free, cause: free ? 'closingTheGap' : this.oneOf(['obstruction', 'offsideAtLineout']), offender: W.jumper(this.other(pto), pick) }
    }
    st.y = st.y < 35 ? 7 : 63
    if (u < K.LINEOUT_NOT_STRAIGHT + K.LINEOUT_PEN + K.LINEOUT_STOLEN / this.vs(to, 'lineout')) {
      st.ball = this.other(to); st.phase = 1
      st.carrierId = W.jumper(this.other(to), pick)
      this.emit('lineout', to, 'stolen', 'LINEOUT', K.LINEOUT_S, 0, { pre, who: W.thrower(to), vs: this.ids([st.carrierId]) })
      return { k: 'phase' }
    }
    st.phase = 1; st.launch = 'lineout'
    const jumper = W.jumper(to, pick)
    this.emit('lineout', to, 'won', 'LINEOUT', K.LINEOUT_S, 0, { pre, who: W.thrower(to), with: this.ids([jumper]) })
    st.carrierId = jumper
    // close to their line it is driven (a pack side drives more of them, and from further out)
    const dl = this.toLine(to, st.x)
    const ms = this.sty(to).maul * (dl <= 22 ? this.sty(to).in22?.maul ?? 1 : 1)
    const pMaul = dl < K.MAUL_FROM * Math.max(1, ms) ? K.P_MAUL : dl < 70 ? K.P_MAUL_MID : K.P_MAUL_DEEP
    // A STYLE LEANS ON THE MAUL, IT DOES NOT GIVE IT UP (round 9). Squared, a wide side's lean (about
    // 0.35) cut its mauls to an eighth: 7.6 a match to 0.95, and with them the ground a lineout drive
    // wins, so width cost 30 to 45 seconds a match in their half for any squad (scripts/tmp/gp/sources.ts).
    // Now the lean counts once, and near their line every side drives some (MAUL_NEAR_MIN).
    const msEff = dl < K.MAUL_FROM ? Math.max(K.MAUL_NEAR_MIN, ms) : ms
    if (rng() < Math.min(0.9, pMaul * msEff)) {
      st.launch = ''
      const before = st.x
      const gain = Math.max(0, this.gauss(K.MAUL_GAIN * this.vs(to, 'maul') * Math.pow(this.sty(to).fit?.tight ?? 1, dl <= 22 ? K.FIT_22 : 1), 3.5))
      st.x = this.adv(to, st.x, gain)
      st.carrierId = W.forward(to, pick)
      const moved = r1(Math.abs(clamp(st.x, 0, 100) - before))
      if (this.toLine(to, st.x) <= 0) {
        this.emit('maul', to, 'driven', 'PLAY', K.MAUL_S, 0, { gain: moved, who: st.carrierId })
        return rng() < K.P_HELD_UP ? this.heldUp(to) : this.scoreTry(to, 'maul')
      }
      const m = rng()
      if (m < K.MAUL_PEN) {
        const off = W.forward(this.other(to), pick)
        this.emit('maul', to, 'pulledDown', 'PLAY', K.MAUL_S, 0, { gain: moved, who: st.carrierId, vs: this.ids([off]) })
        return { k: 'penalty', to, free: false, cause: 'collapsingMaul', offender: off }
      }
      if (m < K.MAUL_PEN + K.MAUL_STOPPED) { this.emit('maul', to, 'stopped', 'PLAY', K.MAUL_S, 0, { gain: moved, who: st.carrierId }); this.emit('unplayable', to, 'scrum', 'STOP', 0, 0); return { k: 'scrum', to: this.other(to) } }
      this.emit('maul', to, 'ballOut', 'PLAY', K.MAUL_S, 0, { gain: moved, who: st.carrierId })
    }
    return { k: 'phase' }
  }

  private heldUp(s: 0 | 1): Next {
    this.st.x = s === 0 ? 100 : 0
    this.emit('heldUp', s, 'heldUp', 'DEAD', 0, 0, { who: this.st.carrierId })
    return { k: 'dropout', by: this.other(s), goalLine: true }
  }

  private penalty(to: 0 | 1, free: boolean, cause?: string, offender?: string): Next {
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    const off = this.other(to)
    st.ball = to; st.passerId = ''; st.carrierId = ''
    // (a penalty's dead time is the call's: a quick tap is taken at once, anything else waits; MatchSim.penaltyCall)
    this.emit(free ? 'freeKick' : 'penalty', to, 'awarded', 'PENALTY', 0, free ? K.PENALTY_DEAD : 0, { cause, offender })
    const d = this.toLine(to, st.x)
    if (!free) st.conceded = [st.conceded?.[0] ?? 0, st.conceded?.[1] ?? 0], st.conceded[off]++
    // the referee's patience: a side giving away penalty after penalty has been warned, and the next
    // man goes (as concedePenalty does in the old engine); an aggressive side's men are carded more
    const repeat = !free && (st.conceded?.[off] ?? 0) >= K.WARN_AT ? K.WARN_CARD : 1
    const cardF = this.sty(off).cards * repeat
    if (!free) {
      const c = rng()
      // (the man carded is the offender when the record names him)
      if (c < K.P_RED * this.sty(off).cards) this.card(off, true, 'foulPlay', offender || W.forward(off, pick))
      else if (c < K.P_RED * this.sty(off).cards + (K.P_YELLOW + (d < 22 ? K.P_YELLOW_22 : 0)) * cardF) this.card(off, false, repeat > 1 ? 'repeated' : d < 22 ? 'cynical' : 'foulPlay', offender || W.forward(off, pick))
    }
    // A PENALTY TRY (Law 8.3): foul play on their own line that stopped a probable try. Seven
    // points, no conversion, and the offender goes to the bin if he has not gone already.
    if (!free && d <= K.PT_NEAR && rng() < (d <= K.PT_CLOSE ? K.P_PT_CLOSE : K.P_PT_NEAR)) {
      const last = st.plays[st.plays.length - 1].kind
      if (last !== 'yellowCard' && last !== 'redCard') this.card(off, false, 'penaltyTry', offender || W.forward(off, pick))
      st.x = to === 0 ? 100 : 0; st.y = 35
      st.score[to] += 7; st.tries[to]++
      this.emit('penaltyTry', to, 'awarded', 'TRY', 0, K.TRY_DEAD)
      return { k: 'kickoff', by: off }
    }
    if (free) {
      st.phase = 1
      if (rng() < K.FREE_TAP) { st.carrierId = W.carrier(to, false, pick); this.emit('tap', to, 'tapped', 'PLAY', 2, 0, { who: st.carrierId }); return { k: 'phase' } }
      return this.kick(true)
    }
    return { k: 'penaltyCall', to }
  }

  /** what is done with a penalty: the manager's call when he has made one, the game's otherwise */
  private penaltyCall(to: 0 | 1): Next {
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    const off = this.other(to), d = this.toLine(to, st.x)
    const standing = st.calls[to]
    const call: PenaltyCall | null = st.answer ?? (standing === 'auto' || standing === 'ask' ? null : standing)
    // who made it (Play.callBy): the manager answering, his standing order, or the side's own call on
    // a side somebody manages; nothing on a side nobody manages
    const by: Play['callBy'] = st.answer ? 'manager' : standing !== 'auto' && standing !== 'ask' ? 'standing'
      : this.world.managed === to ? 'captain' : undefined
    st.autoOnce = false
    const tagged = (c: PenaltyCall, f: () => Next): Next => { st.tag = { ...st.tag, call: c, ...(by ? { callBy: by } : {}) }; return f() }
    st.answer = null
    const u = rng()
    const posts = () => {
      const wide = Math.abs(st.y - 35) / 35, far = Math.max(0, d - 15)
      const pPen = W.goalP ? W.goalP(to, 'pen', st.t, st.score[to] - st.score[off]) + K.PEN_FAR * (K.PEN_FAR_MEAN - far) + K.PEN_WIDE * (K.PEN_WIDE_MEAN - wide)
        : (0.95 - K.PEN_FAR * far - wide * K.PEN_WIDE) * Math.sqrt(this.S(to, 'goal'))
      const good = rng() < clamp(pPen, 0.3, 0.97)
      const gk = W.goalKicker(to)
      if (good) { st.score[to] += 3; this.emit('penaltyGoal', to, 'over', 'GOAL', 0, K.GOAL_DEAD, { good, who: gk }); return { k: 'kickoff', by: off } as Next }
      this.emit('penaltyGoal', to, 'wide', 'GOALMISS', 0, K.GOAL_DEAD, { good, who: gk })
      return { k: 'dropout', by: off, goalLine: false } as Next
    }
    // A QUICK TAP: taken before the defence is back, when nobody has been carded (the game is not
    // stopped). Near their line it is a tap and go for the line: the pick and go follows.
    const tap = (): Next => {
      st.phase = 1; st.launch = ''
      // (quick when nobody has been carded: the referee has not stopped the game)
      const quick = st.plays[st.plays.length - 1].kind === 'penalty'
      this.wait(quick ? K.QUICK_TAP_DEAD : K.PENALTY_DEAD)
      st.carrierId = W.carrier(to, d <= 10 ? false : pick() < 0.3, pick)
      this.emit('tap', to, d <= 10 ? 'tapAndGo' : quick ? 'quickTap' : 'tapped', 'PLAY', 2, 0, { who: st.carrierId })
      return { k: 'phase' }
    }
    // the corner or down the line: their own throw. Nobody kicks to touch from inside five metres.
    const corner = (): Next => {
      if (d <= 5) return tap()
      const gain = Math.min(d - 5, 22 + rng() * 16)
      const before = st.x
      st.x = this.adv(to, st.x, Math.max(2, gain)); st.y = st.y < 35 ? 0 : 70
      this.emit('kick', to, 'penaltyToTouch', 'TOUCH', K.KICK_S, 0, { kick: 'touch', gain: r1(Math.abs(st.x - before)), who: W.kicker(to, false, pick), land: [r1(st.x), r1(st.y)], out: [r1(st.x), st.y < 35 ? -K.OUT_BY : 70 + K.OUT_BY] })
      return { k: 'lineout', to }
    }
    const waitThen = (f: () => Next) => { this.wait(K.PENALTY_DEAD); st.penaltyOn = true; const n = f(); if (n.k !== 'scrum' && n.k !== 'lineout') st.penaltyOn = false; return n }
    if (call === 'posts' && d <= K.GOAL_RANGE) return tagged('posts', () => waitThen(posts))
    if (call === 'corner') return d <= 5 ? tagged('tap', tap) : tagged('corner', () => waitThen(corner))
    if (call === 'tap') return tagged('tap', tap)
    if (call === 'scrum') return tagged('scrum', () => waitThen(() => ({ k: 'scrum', to })))
    // the game's own call. The scoreboard and the clock (as aiPenaltyCall does in the old
    // engine): more than a kick behind in the last ten minutes, three points will not do; level
    // or ahead in the last twenty, take them every time
    const behind = st.score[off] - st.score[to]
    // a side that backs its pack goes to the corner from their 22 more than one that takes the points
    const sty = this.sty(to)
    const lean = d <= 22 ? clamp(1 - 2 * (sty.corner - NEUTRAL_STYLE.corner), 0.2, 1.5) : 1
    let take = st.clock >= K.LATE_CHASE_S && behind > 3 ? 0 : st.clock >= K.LATE_POSTS_S && behind <= 0 ? 1 : (K.GOAL_TAKE + (d < 30 ? K.GOAL_TAKE_NEAR : 0)) * lean
    // THE CAPTAIN'S CALL in a close finish: a poor leader sometimes gets it wrong (the corner when the
    // three would win it, the posts when only a try will do)
    if (st.clock >= K.LATE_CHASE_S && Math.abs(behind) <= 7 && sty.lead < 0 && (take === 0 || take === 1) && rng() < -sty.lead * K.CAPTAIN_WRONG) take = 1 - take
    if (d <= K.GOAL_RANGE && u < take) return tagged('posts', () => waitThen(posts))
    const v = rng()
    // the quick tap: a high-tempo side, a side chasing the game, and close to their line
    if (v < K.PEN_TAP * sty.quick * (this.chasing(to) ? 2 : 1) * (d <= 10 ? 1.5 : 1)) return tagged('tap', tap)
    if (v < K.PEN_TAP + K.PEN_SCRUM && d < 30) return tagged('scrum', () => waitThen(() => ({ k: 'scrum', to })))
    return d <= 5 ? tagged('tap', tap) : tagged('corner', () => waitThen(corner))
  }

  /** a kick from hand by the side with the ball */
  private kick(fromFree = false): Next {
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    const s = st.ball, o2 = this.other(s), d = this.toLine(s, st.x), from = st.x
    const own22 = d > 78
    st.passerId = ''
    // WHAT KIND OF KICK: the side's own mix (its kicking style and its exit), the weather (a wet
    // ball goes up rather than across) and the scoreboard (a side holding a lead kicks for touch)
    const m = this.sty(s).kickMix, wet = this.wet(), hold = this.protecting(s) ? 1.5 : 1
    const u = rng()
    const type: KickType = own22
      ? this.choose(u, [['clearance', K.KICK_CLEAR * m.clearance * hold], ['long', (1 - K.KICK_CLEAR) * m.long], ['box', 0.06 * m.box * (1 + wet)]])
      : d > 50
        ? this.choose(u, [['box', K.KICK_BOX * m.box * (1 + 0.3 * wet)], ['long', K.KICK_LONG * m.long * hold], ['upAndUnder', (1 - K.KICK_BOX - K.KICK_LONG - K.KICK_TOUCH) * m.upAndUnder * (1 + 0.3 * wet)], ['touch', K.KICK_TOUCH * m.touch * hold]])
        : this.choose(u, [['grubber', 0.32 * m.grubber], ['upAndUnder', 0.30 * m.upAndUnder * (1 + 0.3 * wet)], ['touch', 0.20 * m.touch * hold], ['chip', 0.09 * m.chip * (1 - 0.5 * wet)], ['crossField', 0.09 * m.crossField * (1 - 0.5 * wet) * (d < 40 ? 1.5 : 0.5)]])
    const kickerId = W.kicker(s, type === 'box', pick), boot = Math.sqrt(this.S(s, 'kicking')) * this.man(s, kickerId).kick
    const dist = boot * (type === 'clearance' ? 28 + rng() * 18 : type === 'long' ? 34 + rng() * 18 : type === 'touch' ? 22 + rng() * 16
      : type === 'grubber' ? 11 + rng() * 10 : type === 'chip' ? 6 + rng() * 8 : type === 'crossField' ? 12 + rng() * 14 : 17 + rng() * 11)
    // charged down: it comes off a defender's hands and they are on to it first
    if (!fromFree && type !== 'grubber' && rng() < K.P_CHARGE) {
      const charger = this.ids(W.tacklers(o2, false, pick).slice(0, 1))
      this.emit('kick', s, 'chargedDown', 'KICK', K.KICK_S * 0.4, 0, { kick: type, who: kickerId, vs: charger })
      st.x = this.adv(s, from, -(3 + rng() * 8)); st.ball = o2; st.phase = 1
      // the charger is the man on to it: he scores it or picks it up
      st.carrierId = charger[0] || W.forward(o2, pick)
      if (this.toLine(o2, st.x) <= 0) return this.scoreTry(o2, 'chargeDown')
      this.emit('catch', o2, 'chargeDownRegathered', 'PLAY', K.CATCH_S, 0, { who: st.carrierId })
      return { k: 'phase' }
    }
    // (a cross-field kick goes to the far wing, a chip just over the line)
    const across = rng()
    st.x = this.adv(s, from, dist)
    st.y = type === 'crossField' ? (st.y < 35 ? 54 + across * 12 : 4 + across * 12) : type === 'chip' ? clamp(st.y + (across - 0.5) * 14, 2, 68) : clamp(st.y + (across - 0.5) * 40, 2, 68)
    const land: [number, number] = [r1(clamp(st.x, 0, 100)), r1(st.y)]
    // over their goal line: dead, or touched down. A 22 drop-out from a long kick, a goal-line one when a short kick is made dead.
    if (this.toLine(s, st.x) <= 0) {
      // WHERE IT REALLY WENT (owner, 24 Nov: "it said the ball went dead, but on screen it did not
      // cross the dead-ball line"). The record's x stops at the goal line (x 0 to 100); `land` is where
      // it came down, in-goal or beyond, and the dead ball's `out` is where it ended: over the dead-ball
      // line (K.IN_GOAL behind the goal line) when it ran dead, in-goal where a defender touched it down
      const over = Math.abs(st.x - (s === 0 ? 100 : 0)), line = s === 0 ? 100 : 0, dir = s === 0 ? 1 : -1
      land[0] = r1(line + dir * Math.max(0.5, Math.min(over, K.IN_GOAL + 6)))
      const outX = type === 'grubber' ? line + dir * Math.min(Math.max(1, over), K.IN_GOAL - 1) : line + dir * Math.max(K.IN_GOAL + 1.5, Math.min(over, K.IN_GOAL + 6))
      st.x = line
      this.emit('kick', s, 'dead', 'KICK', K.KICK_S, 0, { kick: type, gain: r1(Math.abs(st.x - from)), who: kickerId, land })
      this.emit('deadBall', s, type === 'grubber' ? 'touchedDown' : 'ranDead', 'DEAD', 0, 0, { out: [r1(outX), r1(st.y)] })
      return { k: 'dropout', by: o2, goalLine: type === 'grubber' }
    }
    const toTouch = type === 'clearance' || type === 'touch'
    if (toTouch) {
      // from outside the 22 it has to bounce: straight out is a lineout back where it was kicked
      if (!own22 && !fromFree && rng() < K.P_OUT_FULL * 4) {
        // (land: where it crossed the touchline on its way, before it would have come down)
        const over: [number, number] = [r1(clamp(from + (st.x - from) * 0.8, 0, 100)), st.y < 35 ? 0 : 70]
        st.x = from; st.y = st.y < 35 ? 0 : 70
        this.emit('kick', s, 'outOnFull', 'TOUCH', K.KICK_S, 0, { kick: type, who: kickerId, land: over, out: [over[0], over[1] === 0 ? -K.OUT_BY : 70 + K.OUT_BY] })
        return { k: 'lineout', to: o2 }
      }
      st.y = st.y < 35 ? 0 : 70
      land[1] = st.y
      // THE 50:22 (Law 18): from his own half, bouncing into touch in their 22, his side throws. Every time.
      const fifty = !fromFree && d > 50 && this.toLine(s, st.x) < 22
      this.emit('kick', s, fifty ? 'fiftyTwentyTwo' : 'touch', 'TOUCH', K.KICK_S, 0, { kick: type, gain: r1(Math.abs(st.x - from)), who: kickerId, land, out: [land[0], st.y === 0 ? -K.OUT_BY : 70 + K.OUT_BY] })
      return { k: 'lineout', to: fifty ? s : o2 }
    }
    this.emit('kick', s, 'inPlay', 'KICK', K.KICK_S, 0, { kick: type, gain: r1(Math.abs(st.x - from)), who: kickerId, land })
    const v = rng()
    // a kick that is chased and contested in the air: either side can win it
    const contest = type === 'box' || type === 'upAndUnder' || type === 'grubber' || type === 'chip' || type === 'crossField'
    const aerial = this.vs(s, 'aerial')
    const pCaught = type === 'crossField' ? 0.46 : type === 'chip' ? 0.46 : contest ? 0.60 : 0.74
    const pRegather = type === 'crossField' ? 0.30 * aerial : type === 'chip' ? 0.32 * aerial : contest ? 0.17 * aerial : 0.04
    const air = contest && type !== 'grubber' ? { contested: true } : {}
    st.launch = ''
    if (v < pCaught) { st.ball = o2; st.phase = 1; st.turnPhases = -2; st.carrierId = W.catcher(o2, pick); this.emit('catch', o2, 'caught', 'PLAY', K.CATCH_S, 0, { who: st.carrierId, ...air }); return { k: 'phase' } }
    if (v < pCaught + pRegather) { st.ball = s; st.phase = 1; st.carrierId = W.catcher(s, pick); this.emit('catch', s, 'regathered', 'PLAY', K.CATCH_S, 0, { who: st.carrierId, ...air }); return { k: 'phase' } }
    if (v < pCaught + pRegather + 0.07) { this.emit('knockOn', o2, 'underTheHighBall', 'STOP', 0, 0, { who: W.catcher(o2, pick) }); return { k: 'scrum', to: s } }
    if (v < pCaught + pRegather + 0.11) { this.emit('knockOn', s, 'inTheChase', 'STOP', 0, 0, { who: W.catcher(s, pick) }); return { k: 'scrum', to: o2 } }
    if (v < pCaught + pRegather + 0.135) {
      // after the kick: a chaser in front of the kicker, or a catcher's side off its feet
      const to = rng() < 0.6 ? o2 : s
      return to === o2
        ? { k: 'penalty', to, free: false, cause: this.oneOf(['offsideAtKick', 'obstruction']), offender: W.catcher(s, pick) }
        : { k: 'penalty', to, free: false, cause: this.oneOf(['highTackle', 'notReleasing']), offender: this.ids(W.tacklers(o2, false, pick))[0] }
    }
    // it bounces into touch
    st.y = st.y < 35 ? 0 : 70
    this.emit('intoTouch', s, 'bounced', 'TOUCH', 0, 0, { out: [r1(clamp(st.x, 0, 100)), st.y === 0 ? -K.OUT_BY : 70 + K.OUT_BY] })
    return { k: 'lineout', to: o2 }
  }

  /** one phase of open play */
  private playPhase(): Next {
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    const s = st.ball, o2 = this.other(s), d = this.toLine(s, st.x)
    const me = this.sty(s), them = this.sty(o2), wet = this.wet(), up = this.menUp(s)
    const chase = this.chasing(s), hold = this.protecting(s)
    // an offload has kept it alive: this phase is the man who took it, running on
    const offloaded = !!st.offloaded
    st.offloaded = false
    const launch = st.phase === 1 && st.launch ? st.launch : ''
    st.launch = ''
    const ball = st.ruckSpeed ?? ''
    st.ruckSpeed = ''
    const qb = ball === 'quick' ? K.QUICK_GAIN : ball === 'slow' ? K.SLOW_GAIN : 1
    if (!offloaded) {
      // a drop at goal: from in range after a few phases, and far likelier with the scores level or a kick behind late on
      const late = st.clock >= K.LATE_CHASE_S && this.lead(s) <= 0 && this.lead(s) >= -3 ? K.DROP_LATE : 1
      if (d <= K.DROP_RANGE && d > 8 && st.phase >= K.DROP_PHASE && rng() < K.P_DROP * late) {
        const good = rng() < K.DROP_GOOD - Math.max(0, d - 22) * 0.012
        const who = W.goalKicker(s)
        if (good) { st.score[s] += 3; this.emit('dropGoal', s, 'over', 'DROPGOAL', K.KICK_S, 30, { good, who }); return { k: 'kickoff', by: o2 } }
        this.emit('dropGoal', s, 'wide', 'DROPMISS', K.KICK_S, 0, { good, who })
        return { k: 'dropout', by: o2, goalLine: false }
      }
      // KICK OR RUN: by zone, the side's own leaning in that zone, the scoreboard (a side chasing
      // the game keeps the ball and runs it from deep; a side protecting a lead kicks it away),
      // the men on the field (a man down kicks, a man up keeps it) and the weather
      const zone = d > 78 ? 0 : d > 22 ? 1 : 2
      const base = d > 78 ? K.KICK_OWN22 : d > 50 ? K.KICK_OWNHALF : d > 22 ? K.KICK_OPPHALF : K.KICK_OPP22
      const lean = me.kick * me.kickZone[zone] * (chase ? (d > 50 ? 0.45 : 0.6) : hold && d > 40 ? 1.35 : 1) * (up < 0 ? 1.25 : up > 0 ? 0.85 : 1) * (1 + 0.2 * wet)
      // (nobody kicks it away on their line: inside ten metres they keep it in hand)
      if (d > 10 && rng() < base * lean * (ball === 'slow' ? K.SLOW_KICK : 1) + K.KICK_PER_PHASE * Math.max(0, st.phase - K.KICK_PHASE_FROM)) return this.kick()
    }
    // TIGHT OR WIDE. On their line a pack side picks and goes; elsewhere the side's own width, wider
    // a man up or chasing the game, narrower a man down or on a wet ball
    const plan = d <= 22 ? me.in22 : undefined
    const pickGo = d <= K.PICK_ZONE && rng() < Math.min(0.9, K.P_PICK * me.pick * (plan?.pick ?? 1))
    const widthP = me.width * (plan?.width ?? 1) * (up > 0 ? 1.25 : up < 0 ? 0.8 : 1) * (chase ? 1.2 : 1) * (1 - 0.3 * wet)
    const wide = !pickGo && rng() < widthP
    // the defence: a narrow defence gives up the outside and holds the inside, a blitz holds the
    // gain line and gives up more breaks and intercepts
    // (behind on the scoreboard, a good captain lifts them; the called move off first-phase ball is a drilled play)
    // THE PICK AND GO IS THE PACK'S (round 9): on their line it is forwards against forwards, so its
    // edge is the two packs' (the maul contest, to PICK_VS), not the backs' carrying against the tackle
    const contact = pickGo ? Math.pow(this.vs(s, 'maul'), K.PICK_VS) : this.vs(s, 'carry', 'tackle')
    const edge = qb * (this.lead(s) < 0 ? 1 + K.CAPTAIN_LIFT * me.lead : 1) * (launch && me.launchMove ? K.MOVE_GAIN : 1) * contact * this.comp(me) * (wide ? 1 + 0.12 * them.narrow : 1 - 0.12 * them.narrow) * (1 - (wide ? K.BLITZ_WIDE : K.BLITZ_TIGHT) * them.blitz) * (me.fit ? Math.pow(wide ? me.fit.wide : me.fit.tight, plan ? K.FIT_22 : 1) : 1)
    // (on their own line a defence is at its tightest: every metre is fought for)
    const near = d <= K.LINE_NEAR ? K.LINE_GAIN : 1
    // the shape it is run in (a pick and go, a launch play off set-piece ball and an offload's run are their own)
    const shapeId = offloaded || pickGo || launch ? '' : this.pickShape(wide, d, me, them)
    const SH0 = shapeId ? SHAPES[shapeId] : null, NRM = SHAPE_NORM[me.atk] ?? SHAPE_NORM['']
    const nr = NRM[String(wide) as 'true' | 'false']
    const SH = SH0 ? { ...SH0, g: SH0.g / nr.g, b: SH0.b / nr.b, k: SH0.k / nr.k, t: SH0.t / nr.t, i: wide ? SH0.i / nr.i : 0 } : null
    let gain = (wide ? this.gauss(K.GAIN_WIDE * edge * near, K.GAIN_WIDE_SD * near) : this.gauss(K.GAIN_TIGHT * edge * near, K.GAIN_TIGHT_SD * near)) * (SH?.g ?? 1)
    const passer = st.carrierId
    // (a snipe is the scrum-half himself)
    st.carrierId = offloaded ? passer : shapeId === 'snipe' ? W.kicker(s, true, pick) || W.carrier(s, false, pick) : W.carrier(s, wide, pick)
    const who = st.carrierId, tk = this.ids(W.tacklers(o2, wide, pick))
    // THE MEN IN IT: the carrier's own carrying and legs against the first tackler's (World.man)
    const mc = this.man(s, who), mt = this.man(o2, tk[0])
    gain *= 1 + (mc.carry / mt.tackle - 1) * (gain > 0 ? 1 : -1)
    // the pass that put him in: from the last man on the ball (the scrum-half off a ruck), and how
    // many hands it went through (a wide ball goes through the ten and often a centre)
    const passes = SH ? SH.passes : offloaded ? 0 : wide ? 2 + Math.floor(pick() * 3) : pickGo ? 0 : pick() < 0.7 ? 1 : 0
    // the men the ball went through on its way to him: the scrum-half, the fly-half, a decoy or a looping centre
    const via: string[] = []
    if (SH && passes > 0) {
      const nine = W.kicker(s, true, pick), ten = W.kicker(s, false, pick)
      if (shapeId === 'oneOut' || shapeId === 'pod') via.push(nine)
      else if (shapeId === 'tipOn') via.push(nine, W.carrier(s, false, pick))
      else if (shapeId === 'pullBack') via.push(nine, W.carrier(s, false, pick), ten)
      else if (shapeId === 'loop') via.push(nine, ten, W.carrier(s, true, pick), ten)
      else if (shapeId === 'kickPass') via.push(ten)
      else via.push(nine, ten, ...(passes > 2 ? [W.carrier(s, true, pick)] : []))
    }
    const hands = via.filter(x => x && x !== who)
    st.passerId = hands.length ? hands[hands.length - 1] : passes && passer && passer !== who ? passer : ''
    const pass = st.passerId ? { with: [st.passerId], passes } : passes ? { passes } : {}
    const shape = pickGo ? { shape: 'pickAndGo' } : launch && me.launchMove ? { shape: 'launch', move: me.launchMove } : launch ? { shape: 'launch' } : offloaded ? { shape: 'offload' } : shapeId ? { shape: shapeId, ...(hands.length ? { via: hands } : {}) } : {}
    // a wide carry never ends behind where it started (a man going backwards with it is a picture nobody believes)
    gain = clamp(gain, wide ? 0 : -5, 22)
    const x0 = st.x
    // (a wide ball goes to the open side, the side of the ruck with the more room, four times in five)
    st.y = clamp(st.y + (wide ? (rng() < (st.y < 35 ? K.WIDE_BLIND : 1 - K.WIDE_BLIND) ? -1 : 1) * (10 + rng() * 22) * (shapeId === 'kickPass' ? 1.4 : shapeId === 'switch' ? 0.6 : 1) : (rng() - 0.5) * (pickGo ? 4 : 9)), wide ? -1 : 4, wide ? 71 : 66)
    const u = rng()
    const moved = () => r1(Math.abs(clamp(st.x, 0, 100) - x0)) * (this.toLine(s, st.x) <= this.toLine(s, x0) ? 1 : -1)
    const info = { phase: st.phase, who, ...pass, ...shape }
    // out over the touchline with it
    if (wide && (st.y <= 0 || st.y >= 70)) {
      if (rng() < 0.45) { st.x = this.adv(s, st.x, Math.max(0, gain)); if (this.toLine(s, st.x) >= 99) st.x = s === 0 ? 1 : 99; st.y = st.y <= 0 ? 0 : 70; this.emit('carry', s, 'intoTouch', 'PLAY', K.CARRY_S, 0, { gain: moved(), vs: tk, ...info }); this.emit('intoTouch', s, 'carried', 'TOUCH', 0, 0, { who, out: [r1(clamp(st.x, 0, 100)), st.y === 0 ? -K.OUT_BY : 70 + K.OUT_BY] }); return { k: 'lineout', to: o2 } }
      st.y = clamp(st.y, 3, 67)
    }
    // (in the field of play, never on the touchline itself)
    st.y = clamp(st.y, 0.5, 69.5)
    // a wet ball is a slippery one
    // (partnerships that have played together drop less)
    const pKnock = K.P_KNOCK_ON / Math.sqrt(this.S(s, 'handling')) / mc.hands * (1 + 0.3 * wet) * (SH?.k ?? 1) * (1 - K.CHEM_KNOCK * me.chem)
    if (u < pKnock) { this.emit('carry', s, 'knockedOn', 'PLAY', K.CARRY_S * 0.6, 0, { vs: tk, ...info }); this.emit('knockOn', s, 'inContact', 'STOP', 0, 0, { who, vs: tk.slice(0, 1) }); return { k: 'scrum', to: o2 } }
    if (u < pKnock + K.P_FORWARD) { this.emit('carry', s, 'forwardPass', 'PLAY', K.CARRY_S * 0.6, 0, info); this.emit('forwardPass', s, 'forward', 'STOP', 0, 0, { who: st.passerId || who, with: st.passerId ? [who] : undefined }); return { k: 'scrum', to: o2 } }
    // AN INTERCEPTION (owner's key moments): a wide pass read by a defender, who is sometimes gone
    if (wide && rng() < K.P_INTERCEPT * (1 + 0.9 * them.blitz) * (1 - 0.2 * wet) * (SH ? SH.i : 1)) {
      const thief = W.catcher(o2, pick) || tk[0] || ''
      st.ball = o2; st.phase = 1; st.carrierId = thief; st.passerId = ''
      st.turnPhases = 2
      this.emit('carry', s, 'intercepted', 'PLAY', K.CARRY_S * 0.6, 0, { phase: st.phase, who, vs: this.ids([thief]), passes })
      this.bump(o2, K.MOM_TURN)
      if (rng() < K.INTERCEPT_AWAY) {
        const run = K.BREAK_MIN + rng() * (K.BREAK_SPAN + 30)
        st.x = this.adv(o2, st.x, run)
        if (this.toLine(o2, st.x) <= 0) { this.bump(o2, K.MOM_TRY); this.emit('lineBreak', o2, 'interception', 'PLAY', K.BREAK_S, 0, { gain: r1(run), phase: 1, who: thief }); return this.scoreTry(o2, 'interception') }
        this.emit('lineBreak', o2, 'interceptionHauled', 'PLAY', K.BREAK_S, 0, { gain: r1(run), phase: 1, who: thief, vs: this.ids([W.catcher(s, pick)]) })
      }
      return { k: 'phase' }
    }
    // THE BREAK: the carry against the tackle, the defence's line speed, the style matchup, the
    // move called off first-phase ball, tired legs late in each half, and an offload's run on
    const halfClock = st.clock - st.half * 2400
    // (the first half's last ten minutes from the clock; the last twenty of the match from the legs
    // themselves, as the old engine does it: a tired defence gives up more, a tired attack makes less)
    const tired = st.half === 0 || !W.legs ? 1 + K.LATE_BREAK * clamp((halfClock - 1800) / 600, 0, 1.5)
      : st.clock >= 3600 ? (1 + K.TIRED_DEF * (1 - W.legs(o2, st.t))) * (1 - K.TIRED_ATT * (1 - W.legs(s, st.t))) : 1
    // (a blitz is beaten by the ball behind it, a drift by a change of direction)
    const shapeB = !SH ? 1 : SH.b * (shapeId === 'pullBack' || shapeId === 'kickPass' ? 1 + 0.3 * Math.max(0, them.blitz) : shapeId === 'switch' || shapeId === 'snipe' ? 1 + 0.3 * Math.max(0, -them.blitz) : 1)
    const tp = st.turnPhases ?? 0
    const unset = (launch ? (d < 30 ? K.LAUNCH_B_22 : d < 50 ? K.LAUNCH_B : K.LAUNCH_B_OWN) * me.launch * (launch === 'scrum' ? K.LAUNCH_SCRUM : 1) : 1) * (tp > 0 ? K.TURN_B : tp < 0 ? K.RETURN_B : 1)
    st.turnPhases = tp > 0 ? tp - 1 : tp < 0 ? tp + 1 : 0
    const pBreak = K.P_BREAK * shapeB * edge * (mc.carry / mt.tackle) * me.tryF * (1 + 0.25 * them.blitz) * unset * tired * (pickGo ? 0.3 : 1) * (offloaded ? 1.3 : 1)
    let broke = false
    if (u < pKnock + K.P_FORWARD + pBreak) {
      broke = true
      gain = K.BREAK_MIN + rng() * K.BREAK_SPAN
      if (rng() < K.BREAK_LONG_P) gain += rng() * K.BREAK_LONG
      st.x = this.adv(s, st.x, gain)
      this.bump(s, K.MOM_BREAK)
      if (this.toLine(s, st.x) <= 0) { this.bump(s, K.MOM_TRY); this.emit('lineBreak', s, 'clean', 'PLAY', K.BREAK_S, 0, { gain: moved(), beat: tk.slice(0, 1), ...info }); return this.scoreTry(s, 'break') }
      // the cover: hauled down in the open, or held up short of the line by the last man
      st.isolated = true
      this.emit('lineBreak', s, this.toLine(s, st.x) <= 5 ? 'heldShort' : 'hauledDown', 'PLAY', K.BREAK_S, 0, { gain: moved(), vs: this.ids([W.catcher(o2, pick)]), beat: tk.slice(0, 1), ...info })
    } else {
      st.x = this.adv(s, st.x, gain)
      if (this.toLine(s, st.x) >= 99) st.x = s === 0 ? 1 : 99
      if (this.toLine(s, st.x) <= 0) {
        this.emit('carry', s, 'overTheLine', 'PLAY', K.CARRY_S, 0, { gain: moved(), vs: tk, ...info })
        if (rng() < K.P_HELD_UP) return this.heldUp(s)
        this.bump(s, K.MOM_TRY)
        return this.scoreTry(s, pickGo ? 'pickAndGo' : wide ? 'wide' : 'close')
      }
      // a dominant tackle drives him back
      this.emit('carry', s, gain >= 1 ? 'gainLine' : gain <= K.DRIVEN_BACK ? 'drivenBack' : 'held', 'PLAY', K.CARRY_S, 0, { gain: moved(), vs: tk, ...info })
    }
    // A MAN HURT in the contact: off now, replaced at the next dead ball (the World says who can be)
    const hurtRoll = rng()
    let hurtNow = false
    if (W.decide && hurtRoll < K.P_INJURY) {
      const victim = pick() < 0.5 || !tk[0] ? who : tk[0]
      const vs2: 0 | 1 = victim === who ? s : o2
      if (victim && !W.decide({ kind: 'injury', side: vs2, who: victim }, st.t)) {
        st.hurt![vs2].push(victim)
        this.emit('injury', vs2, 'offHurt', null, 0, 0, { who: victim })
        if (victim === who) { st.carrierId = ''; hurtNow = true }
      }
    }
    // AN OFFLOAD out of the tackle: the side's style, twice as often off a man hauled down after a
    // break, half as often on a wet ball. No ruck: the man who takes it runs on.
    if (rng() < K.P_OFFLOAD * me.offload * (broke ? 2 : 1) * (wide ? 1.3 : 0.8) * (1 - 0.4 * wet) && !hurtNow && this.toLine(s, st.x) > 1) {
      // (the man in support: the World's pick, never the man with the ball)
      let to = W.carrier(s, wide, pick)
      if (to && to === who) to = W.carrier(s, !wide, pick)
      if (!to || to !== who) {
        this.emit('offload', s, 'caught', 'PLAY', 1, 0, { who, with: to ? [to] : undefined, vs: tk.slice(0, 1) })
        st.carrierId = to; st.passerId = who; st.offloaded = true
        return { k: 'phase' }
      }
    }
    // the breakdown: quick ball for a high-tempo side; a blitz forces a few more turnovers
    const r = rng(), def = 1 / this.vs(s, 'breakdown')
    // the defence gives away fewer penalties when it is disciplined, and so does the side with the ball
    const onLine = this.toLine(s, st.x) <= 12
    // (a blitz gives away more at the breakdown; a good captain keeps his side onside in its own 22)
    const penFor = K.P_PEN_ATTACK * me.penF * them.defPen / this.S(o2, 'discipline') * (onLine ? K.LINE_PEN : 1) * (d <= 22 ? 1 - K.CAPTAIN_PEN * them.lead : 1), penAgainst = K.P_PEN_DEFENCE * def / this.S(s, 'discipline')
    // (the carrier, unless he has just been hurt and is off)
    const carrier = st.carrierId
    // the man over the ball, and his own work at the breakdown
    const jk = W.jackal(o2, pick)
    // (a runner who broke and was hauled down is on his own: his support is still coming)
    const iso = st.isolated && !st.offloaded ? K.ISOLATED_TURN : 1
    st.isolated = false
    const pTurn = K.P_TURNOVER * def * (1 + 0.15 * them.blitz) * this.man(o2, jk).ruck * (SH?.t ?? 1) * me.turnF * iso * (onLine ? K.LINE_TURN : 1)
    if (r < pTurn) { st.ball = o2; st.phase = 1; st.turnPhases = 2; st.carrierId = jk; st.passerId = ''; this.bump(o2, K.MOM_TURN); this.emit('ruck', s, 'turnover', 'PLAY', K.RUCK_S * 0.7, 0, { who: carrier, vs: this.ids([jk]) }); return { k: 'phase' } }
    if (r < pTurn + penFor) {
      this.emit('ruck', s, 'penaltyWon', 'PLAY', K.RUCK_S * 0.7, 0, { who: carrier, vs: this.ids([jk]) })
      return { k: 'penalty', to: s, free: false, cause: this.oneOf(['handsInRuck', 'offside', 'notRollingAway', 'highTackle']), offender: jk }
    }
    if (r < pTurn + penFor + penAgainst) {
      this.emit('ruck', s, 'penaltyLost', 'PLAY', K.RUCK_S * 0.7, 0, { who: carrier, vs: this.ids([jk]) })
      const c = this.oneOf(['holdingOn', 'sealingOff', 'obstruction'] as const)
      return { k: 'penalty', to: o2, free: false, cause: c, offender: c === 'holdingOn' && st.carrierId ? carrier : W.forward(s, pick) }
    }
    if (r < pTurn + penFor + penAgainst + K.P_UNPLAYABLE) { this.emit('ruck', s, 'unplayable', 'PLAY', K.RUCK_S, 0, { who: carrier }); this.emit('unplayable', s, 'scrum', 'STOP', 0, 0); return { k: 'scrum', to: s } }
    const ruckS = K.RUCK_S * me.tempo * (up < 0 ? 1.1 : 1) * (hold ? 1.1 : 1)
    // QUICK OR SLOW BALL: won by the breakdown and the tempo the side plays at, slowed by a jackal who
    // got a hand on it. Quick ball is a defence not set (more ground, more breaks next phase); slow
    // ball is a defence set and waiting (less ground, and the scrum-half is likelier to kick it)
    const pQuick = clamp(K.P_QUICK_BALL * Math.pow(this.vs(s, 'breakdown'), 2) / me.tempo / Math.max(0.5, this.man(o2, jk).ruck), 0.1, 0.8)
    const quickBall = rng() < pQuick
    st.ruckSpeed = quickBall ? 'quick' : 'slow'
    this.emit('ruck', s, 'recycled', 'PLAY', ruckS * (quickBall ? 0.7 : 1.3), 0, { phase: st.phase, who: carrier, speed: st.ruckSpeed })
    st.phase++
    return { k: 'phase' }
  }
}

/** a whole match, kick-off to final whistle, with no decisions */
export function simSkeleton(o: SkeletonOpts): SimResult {
  return new MatchSim(o).runUntil().result()
}

/** a decision and the moment it is made */
export interface TimedDecision { at: Stop; decision: Decision }

/**
 * A WHOLE MATCH WITH THE MANAGER'S HAND ON IT: the decisions, each made at
 * its moment, in order, and any penalty call the match stops for answered by
 * `onCall` ('posts' when there is none and the kick is on, 'corner'
 * otherwise). The same seed, world and decisions always give the same match,
 * which is how a saved managed match is replayed.
 */
export function simWithDecisions(o: SkeletonOpts & { decisions: TimedDecision[]; onCall?: (p: PendingCall, m: MatchSim) => PenaltyCall }): SimResult {
  const m = new MatchSim(o)
  const answer = () => {
    const p = m.pending
    if (p) m.answer(o.onCall ? o.onCall(p, m) : p.options.includes('posts') ? 'posts' : 'corner')
  }
  for (const td of o.decisions) {
    for (let g = 0; g < 200 && !m.done; g++) { m.runUntil(td.at); if (m.pending) answer(); else break }
    m.apply(td.decision)
  }
  for (let g = 0; g < 400 && !m.done; g++) { m.runUntil(); if (m.pending) answer() }
  return m.result()
}
