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
import { evenWorld, type Contest, type Decision, type World } from './world'

export interface SkeletonOpts {
  seed: number
  /** each side's strength, 1 for an average side, when no team sheets are given */
  strength?: [number, number]
  /** the real sides: their strength at each contest and who does what (fromMatch.ts) */
  world?: World
}

/** every number the shape of a match hangs on, in one place */
export const K = {
  // seconds of ball in play
  CARRY_S: 3.3, RUCK_S: 4.9, KICK_S: 6.2, CATCH_S: 2.2, SCRUM_S: 6, LINEOUT_S: 4, MAUL_S: 9, RESTART_S: 6.5, BREAK_S: 5,
  // seconds of dead time before a restart
  SCRUM_DEAD: 58, SCRUM_RESET_DEAD: 28, LINEOUT_DEAD: 31, PENALTY_DEAD: 18, GOAL_DEAD: 55, TRY_DEAD: 48, CON_DEAD: 48, KICKOFF_DEAD: 22, DROPOUT_DEAD: 24,
  // the decision: how often the side with the ball kicks, by where it is
  KICK_OWN22: 0.45, KICK_OWNHALF: 0.245, KICK_OPPHALF: 0.085, KICK_OPP22: 0.02, KICK_PER_PHASE: 0.012, KICK_PHASE_FROM: 4,
  // the carry
  WIDE: 0.30, WIDE_BLIND: 0.2, GAIN_TIGHT: 2.5, GAIN_TIGHT_SD: 2.4, GAIN_WIDE: 4.3, GAIN_WIDE_SD: 5.2,
  LINE_NEAR: 8, LINE_GAIN: 0.6,
  P_BREAK: 0.024, BREAK_MIN: 14, BREAK_SPAN: 40,
  P_KNOCK_ON: 0.042, P_FORWARD: 0.004, P_INTO_TOUCH: 0.011, P_HELD_UP: 0.15,
  // an interception on a wide carry: how often, and how often the man who took it is away
  P_INTERCEPT: 0.006, INTERCEPT_AWAY: 0.45,
  // the ruck
  P_TURNOVER: 0.034, P_PEN_ATTACK: 0.026, P_PEN_DEFENCE: 0.017, P_UNPLAYABLE: 0.004,
  // kicks
  // what kind of kick: from the own 22 a clearance to touch or a long one; from the rest of the own half a box
  // kick, a long one, an up-and-under or one to touch
  KICK_CLEAR: 0.75, KICK_BOX: 0.38, KICK_LONG: 0.24, KICK_TOUCH: 0.25,
  P_OUT_FULL: 0.06, P_FIFTY22: 0.012,
  // set pieces
  LINEOUT_WON: 0.87, LINEOUT_STOLEN: 0.07, LINEOUT_NOT_STRAIGHT: 0.025, LINEOUT_PEN: 0.035,
  MAUL_FROM: 30, P_MAUL: 0.45, MAUL_PEN: 0.10, MAUL_STOPPED: 0.07,
  SCRUM_PEN_FEED: 0.085, SCRUM_PEN_AGAINST: 0.045, SCRUM_FREE: 0.035, SCRUM_HEAD: 0.03, SCRUM_RESET: 0.22,
  // penalties. GOAL_TAKE set 21 Nov (was 0.66, +0.12 inside 30 m): the old engine takes about 3.5
  // shots at goal a match on the same fixtures and the simulation took 4.4 (scripts/tmp/gp/kicks.ts)
  GOAL_RANGE: 50, GOAL_TAKE: 0.52, GOAL_TAKE_NEAR: 0.10, LATE_CHASE_S: 4200, LATE_POSTS_S: 3600,
  // a penalty try: how near the line, and how often foul play there is judged to have stopped one
  PT_NEAR: 10, PT_CLOSE: 5, P_PT_CLOSE: 0.30, P_PT_NEAR: 0.13,
  PEN_TAP: 0.07, PEN_SCRUM: 0.05, FREE_TAP: 0.55, P_YELLOW_22: 0.13,
  CON_GOOD: 0.77,
  // where the kick is from: each metre past 15 out and each step off the posts costs this much,
  // around the average spot of a kick in this simulation (measured, scripts/tmp/gp/shape.ts), so a
  // world that knows the kicker's own chance (World.goalP) keeps it on average
  CON_WIDE: 0.34, CON_WIDE_MEAN: 0.54, PEN_FAR: 0.008, PEN_FAR_MEAN: 15.0, PEN_WIDE: 0.16, PEN_WIDE_MEAN: 0.54,
  // cards: a man in the bin for ten minutes, and what being a man down costs each contest
  P_YELLOW: 0.05, P_RED: 0.006, BIN_S: 600, SHORT_COST: 0.09,
  // a drop at goal, taken from in range when a possession has gone a few phases; and a kick charged down
  DROP_RANGE: 36, DROP_PHASE: 3, P_DROP: 0.007, DROP_GOOD: 0.45, P_CHARGE: 0.011,
} as const

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const r1 = (v: number) => Math.round(v * 10) / 10

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
    this.L = new Laws(this.st.law)
    this.rng = stream(this.st, 'rng')
    this.pick = stream(this.st, 'pick')
  }

  get plays(): Play[] { return this.st.plays }
  get done(): boolean { return this.st.next.k === 'end' }
  /** the manager's penalty call the match is stopped for, or null */
  get pending(): PendingCall | null {
    const st = this.st, n = st.next
    if (n.k !== 'penaltyCall' || st.calls[n.to] !== 'ask' || st.answer) return null
    const d = n.to === 0 ? 100 - st.x : st.x
    const options: PenaltyCall[] = d <= K.GOAL_RANGE ? ['posts', 'corner', 'tap', 'scrum'] : ['corner', 'tap', 'scrum']
    return { kind: 'penalty', side: n.to, x: st.x, y: st.y, toLine: d, t: st.t, options }
  }
  /** a copy of the whole state, to put the match down and pick it up later (with the same World) */
  save(): SimState { return structuredClone(this.st) }
  result(): SimResult { return { plays: this.st.plays, score: this.st.score, tries: this.st.tries } }

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
    for (let guard = 0; guard < 5000 && !this.done && !this.pending && !reached(); guard++) this.step()
    return this
  }

  private flush() {
    const keep: Decision[] = []
    for (const d of this.queue) {
      if (d.kind === 'world') this.world = d.world
      else if (d.kind === 'strength') this.world = boosted(this.world, d.side, d.factor, d.contests)
      else if (d.kind === 'penaltyCall') this.st.calls[d.side] = d.call
      else if (d.kind === 'substitution') {
        // only with the ball dead, before a restart: never in open play, and not while a penalty
        // (whose offender is already named) is being given and taken
        const nk = this.st.next.k
        if (nk === 'phase' || nk === 'penalty' || nk === 'penaltyCall') { keep.push(d); continue }
        const why = this.world.decide ? this.world.decide(d, this.st.t) : 'this world has no bench'
        const st = this.st
        st.plays.push({ n: st.plays.length, t: Math.round(st.t), clock: Math.round(st.clock), kind: 'substitution', side: d.side, ball: st.ball,
          x: r1(st.x), y: r1(st.y), result: why ? 'refused' : 'made', who: d.off, with: [d.on], live: 0, dead: 0, score: [st.score[0], st.score[1]], ...(why ? { cause: why } : {}) })
      } else if (this.world.decide) this.world.decide(d, this.st.t)
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
  private short = (s: 0 | 1) => this.st.bin[s].filter(u => u > this.st.t).length + this.st.sentOff[s]
  /** a side's strength at a contest now: a man down costs every contest */
  private S = (s: 0 | 1, c: Contest) => this.world.str(s, c, this.st.t) * Math.max(0.55, 1 - K.SHORT_COST * this.short(s))
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
    st.plays.push(p)
  }
  /** dead time before a set piece: on the clock, and written on the play as `pre` */
  private wait(s: number) { this.st.t += s; this.st.clock += s; return s }

  /** half-time and full time are blown when the ball next goes dead */
  private whistle(): Next | null {
    const st = this.st
    if (st.half === 0 && st.clock >= 2400) {
      this.emit('halfTime', 0, 'halfTime', 'HALF', 0, 0)
      // the referee's clock starts the second half at forty minutes; the record's t runs on
      st.clock = 2400; st.half = 1
      return { k: 'kickoff', by: this.other(st.firstKO) }
    }
    if (st.half === 1 && st.clock >= 4800) { this.emit('fullTime', 0, 'fullTime', null, 0, 0); return { k: 'end' } }
    return null
  }

  private card(off: 0 | 1, red: boolean, cause: string, who: string) {
    const st = this.st
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
    if (u < 0.82) { st.ball = rec; st.phase = 1; st.carrierId = W.jumper(rec, pick); this.emit('catch', rec, 'caught', 'PLAY', K.CATCH_S, 0, { who: st.carrierId }); return { k: 'phase' } }
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
    st.plays[st.plays.length - 1].dead = K.DROPOUT_DEAD; this.wait(K.DROPOUT_DEAD)
    if (rng() < 0.88) { st.ball = this.other(by); st.phase = 1; st.carrierId = W.catcher(st.ball, pick); this.emit('catch', st.ball, 'caught', 'PLAY', K.CATCH_S, 0, { who: st.carrierId }) }
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
    const u = rng(), feed = this.vs(to, 'scrum')
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
    st.phase = 1
    this.emit('scrum', to, 'won', 'SCRUM', K.SCRUM_S, 0, base)
    return { k: 'phase' }
  }

  private lineout(to: 0 | 1): Next {
    const w = this.whistle(); if (w) return w
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    st.x = clamp(st.x, 5, 95); st.y = st.y < 35 ? 0 : 70; st.ball = to; st.passerId = ''; st.carrierId = ''
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
    st.phase = 1
    const jumper = W.jumper(to, pick)
    this.emit('lineout', to, 'won', 'LINEOUT', K.LINEOUT_S, 0, { pre, who: W.thrower(to), with: this.ids([jumper]) })
    st.carrierId = jumper
    // close to their line it is driven
    if (this.toLine(to, st.x) < K.MAUL_FROM && rng() < K.P_MAUL) {
      const before = st.x
      const gain = Math.max(0, this.gauss(5.5 * this.vs(to, 'maul'), 4))
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
    this.emit(free ? 'freeKick' : 'penalty', to, 'awarded', 'PENALTY', 0, K.PENALTY_DEAD, { cause, offender })
    const d = this.toLine(to, st.x)
    if (!free) {
      const c = rng()
      // (the man carded is the offender when the record names him)
      if (c < K.P_RED) this.card(off, true, 'foulPlay', offender || W.forward(off, pick))
      else if (c < K.P_RED + K.P_YELLOW + (d < 22 ? K.P_YELLOW_22 : 0)) this.card(off, false, d < 22 ? 'cynical' : 'foulPlay', offender || W.forward(off, pick))
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
    const tap = (): Next => { st.phase = 1; st.carrierId = W.carrier(to, false, pick); this.emit('tap', to, 'tapped', 'PLAY', 2, 0, { who: st.carrierId }); return { k: 'phase' } }
    // the corner or down the line: their own throw. Nobody kicks to touch from inside five metres.
    const corner = (): Next => {
      if (d <= 5) return tap()
      const gain = Math.min(d - 5, 22 + rng() * 16)
      const before = st.x
      st.x = this.adv(to, st.x, Math.max(2, gain)); st.y = st.y < 35 ? 0 : 70
      this.emit('kick', to, 'penaltyToTouch', 'TOUCH', K.KICK_S, 0, { kick: 'touch', gain: r1(Math.abs(st.x - before)), who: W.kicker(to, false, pick), land: [r1(st.x), r1(st.y)] })
      return { k: 'lineout', to }
    }
    if (call === 'posts' && d <= K.GOAL_RANGE) return posts()
    if (call === 'corner') return corner()
    if (call === 'tap') return tap()
    if (call === 'scrum') return { k: 'scrum', to }
    // the game's own call. The scoreboard and the clock (as aiPenaltyCall does in the old
    // engine): more than a kick behind in the last ten minutes, three points will not do; level
    // or ahead in the last twenty, take them every time
    const behind = st.score[off] - st.score[to]
    const take = st.clock >= K.LATE_CHASE_S && behind > 3 ? 0 : st.clock >= K.LATE_POSTS_S && behind <= 0 ? 1 : K.GOAL_TAKE + (d < 30 ? K.GOAL_TAKE_NEAR : 0)
    if (d <= K.GOAL_RANGE && u < take) return posts()
    const v = rng()
    if (v < K.PEN_TAP) return tap()
    if (v < K.PEN_TAP + K.PEN_SCRUM && d < 30) return { k: 'scrum', to }
    return corner()
  }

  /** a kick from hand by the side with the ball */
  private kick(fromFree = false): Next {
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    const s = st.ball, o2 = this.other(s), d = this.toLine(s, st.x), from = st.x
    const own22 = d > 78
    st.passerId = ''
    let type: KickType
    const u = rng()
    if (own22) type = u < K.KICK_CLEAR ? 'clearance' : 'long'
    else if (d > 50) type = u < K.KICK_BOX ? 'box' : u < K.KICK_BOX + K.KICK_LONG ? 'long' : u < 1 - K.KICK_TOUCH ? 'upAndUnder' : 'touch'
    else type = u < 0.45 ? 'grubber' : u < 0.80 ? 'upAndUnder' : 'touch'
    const kickerId = W.kicker(s, type === 'box', pick), boot = Math.sqrt(this.S(s, 'kicking'))
    const dist = boot * (type === 'clearance' ? 28 + rng() * 18 : type === 'long' ? 34 + rng() * 18 : type === 'touch' ? 22 + rng() * 16
      : type === 'grubber' ? 11 + rng() * 10 : 17 + rng() * 11)
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
    st.x = this.adv(s, from, dist); st.y = clamp(st.y + (rng() - 0.5) * 40, 2, 68)
    const land: [number, number] = [r1(clamp(st.x, 0, 100)), r1(st.y)]
    // over their goal line: dead, or touched down. A 22 drop-out from a long kick, a goal-line one when a short kick is made dead.
    if (this.toLine(s, st.x) <= 0) {
      st.x = s === 0 ? 100 : 0
      this.emit('kick', s, 'dead', 'KICK', K.KICK_S, 0, { kick: type, gain: r1(Math.abs(st.x - from)), who: kickerId, land })
      this.emit('deadBall', s, type === 'grubber' ? 'touchedDown' : 'ranDead', 'DEAD', 0, 0)
      return { k: 'dropout', by: o2, goalLine: type === 'grubber' }
    }
    const toTouch = type === 'clearance' || type === 'touch'
    if (toTouch) {
      // from outside the 22 it has to bounce: straight out is a lineout back where it was kicked
      if (!own22 && !fromFree && rng() < K.P_OUT_FULL * 4) {
        // (land: where it crossed the touchline on its way, before it would have come down)
        const over: [number, number] = [r1(clamp(from + (st.x - from) * 0.8, 0, 100)), st.y < 35 ? 0 : 70]
        st.x = from; st.y = st.y < 35 ? 0 : 70
        this.emit('kick', s, 'outOnFull', 'TOUCH', K.KICK_S, 0, { kick: type, who: kickerId, land: over })
        return { k: 'lineout', to: o2 }
      }
      st.y = st.y < 35 ? 0 : 70
      land[1] = st.y
      // THE 50:22 (Law 18): from his own half, bouncing into touch in their 22, his side throws. Every time.
      const fifty = !fromFree && d > 50 && this.toLine(s, st.x) < 22
      this.emit('kick', s, fifty ? 'fiftyTwentyTwo' : 'touch', 'TOUCH', K.KICK_S, 0, { kick: type, gain: r1(Math.abs(st.x - from)), who: kickerId, land })
      return { k: 'lineout', to: fifty ? s : o2 }
    }
    this.emit('kick', s, 'inPlay', 'KICK', K.KICK_S, 0, { kick: type, gain: r1(Math.abs(st.x - from)), who: kickerId, land })
    const v = rng()
    const contest = type === 'box' || type === 'upAndUnder' || type === 'grubber'
    const pCaught = contest ? 0.60 : 0.74, pRegather = contest ? 0.17 * this.vs(s, 'aerial') : 0.04
    if (v < pCaught) { st.ball = o2; st.phase = 1; st.carrierId = W.catcher(o2, pick); this.emit('catch', o2, 'caught', 'PLAY', K.CATCH_S, 0, { who: st.carrierId }); return { k: 'phase' } }
    if (v < pCaught + pRegather) { st.ball = s; st.phase = 1; st.carrierId = W.catcher(s, pick); this.emit('catch', s, 'regathered', 'PLAY', K.CATCH_S, 0, { who: st.carrierId }); return { k: 'phase' } }
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
    this.emit('intoTouch', s, 'bounced', 'TOUCH', 0, 0)
    return { k: 'lineout', to: o2 }
  }

  /** one phase of open play */
  private playPhase(): Next {
    const st = this.st, W = this.world, rng = this.rng, pick = this.pick
    const s = st.ball, o2 = this.other(s), d = this.toLine(s, st.x)
    const base = d > 78 ? K.KICK_OWN22 : d > 50 ? K.KICK_OWNHALF : d > 22 ? K.KICK_OPPHALF : K.KICK_OPP22
    if (d <= K.DROP_RANGE && d > 8 && st.phase >= K.DROP_PHASE && rng() < K.P_DROP) {
      const good = rng() < K.DROP_GOOD - Math.max(0, d - 22) * 0.012
      const who = W.goalKicker(s)
      if (good) { st.score[s] += 3; this.emit('dropGoal', s, 'over', 'DROPGOAL', K.KICK_S, 30, { good, who }); return { k: 'kickoff', by: o2 } }
      this.emit('dropGoal', s, 'wide', 'DROPMISS', K.KICK_S, 0, { good, who })
      return { k: 'dropout', by: o2, goalLine: false }
    }
    // (nobody kicks it away on their line: inside ten metres they keep it in hand)
    if (d > 10 && rng() < base + K.KICK_PER_PHASE * Math.max(0, st.phase - K.KICK_PHASE_FROM)) return this.kick()
    const wide = rng() < K.WIDE
    const edge = this.vs(s, 'carry', 'tackle')
    // (on their own line a defence is at its tightest: every metre is fought for)
    const near = d <= K.LINE_NEAR ? K.LINE_GAIN : 1
    let gain = wide ? this.gauss(K.GAIN_WIDE * edge * near, K.GAIN_WIDE_SD * near) : this.gauss(K.GAIN_TIGHT * edge * near, K.GAIN_TIGHT_SD * near)
    const passer = st.carrierId
    st.carrierId = W.carrier(s, wide, pick)
    const who = st.carrierId, tk = this.ids(W.tacklers(o2, wide, pick))
    // the pass that put him in: from the last man on the ball (the scrum-half off a ruck), and how
    // many hands it went through (a wide ball goes through the ten and often a centre)
    const passes = wide ? 2 + Math.floor(pick() * 3) : pick() < 0.7 ? 1 : 0
    st.passerId = passes && passer && passer !== who ? passer : ''
    const pass = st.passerId ? { with: [st.passerId], passes } : passes ? { passes } : {}
    // a wide carry never ends behind where it started (a man going backwards with it is a picture nobody believes)
    gain = clamp(gain, wide ? 0 : -5, 22)
    const x0 = st.x
    // (a wide ball goes to the open side, the side of the ruck with the more room, four times in five)
    st.y = clamp(st.y + (wide ? (rng() < (st.y < 35 ? K.WIDE_BLIND : 1 - K.WIDE_BLIND) ? -1 : 1) * (10 + rng() * 22) : (rng() - 0.5) * 9), wide ? -1 : 4, wide ? 71 : 66)
    const u = rng()
    const moved = () => r1(Math.abs(clamp(st.x, 0, 100) - x0)) * (this.toLine(s, st.x) <= this.toLine(s, x0) ? 1 : -1)
    // out over the touchline with it
    if (wide && (st.y <= 0 || st.y >= 70)) {
      if (rng() < 0.45) { st.x = this.adv(s, st.x, Math.max(0, gain)); st.y = st.y <= 0 ? 0 : 70; this.emit('carry', s, 'intoTouch', 'PLAY', K.CARRY_S, 0, { gain: moved(), phase: st.phase, who, vs: tk, ...pass }); this.emit('intoTouch', s, 'carried', 'TOUCH', 0, 0, { who }); return { k: 'lineout', to: o2 } }
      st.y = clamp(st.y, 3, 67)
    }
    // (in the field of play, never on the touchline itself)
    st.y = clamp(st.y, 0.5, 69.5)
    if (u < K.P_KNOCK_ON / Math.sqrt(this.S(s, 'handling'))) { this.emit('carry', s, 'knockedOn', 'PLAY', K.CARRY_S * 0.6, 0, { phase: st.phase, who, vs: tk, ...pass }); this.emit('knockOn', s, 'inContact', 'STOP', 0, 0, { who, vs: tk.slice(0, 1) }); return { k: 'scrum', to: o2 } }
    if (u < K.P_KNOCK_ON + K.P_FORWARD) { this.emit('carry', s, 'forwardPass', 'PLAY', K.CARRY_S * 0.6, 0, { phase: st.phase, who, ...pass }); this.emit('forwardPass', s, 'forward', 'STOP', 0, 0, { who: st.passerId || who, with: st.passerId ? [who] : undefined }); return { k: 'scrum', to: o2 } }
    // AN INTERCEPTION (owner's key moments): a wide pass read by a defender, who is sometimes gone
    if (wide && rng() < K.P_INTERCEPT) {
      const thief = W.catcher(o2, pick) || tk[0] || ''
      st.ball = o2; st.phase = 1; st.carrierId = thief; st.passerId = ''
      this.emit('carry', s, 'intercepted', 'PLAY', K.CARRY_S * 0.6, 0, { phase: st.phase, who, vs: this.ids([thief]), passes })
      if (rng() < K.INTERCEPT_AWAY) {
        const run = K.BREAK_MIN + rng() * (K.BREAK_SPAN + 30)
        st.x = this.adv(o2, st.x, run)
        if (this.toLine(o2, st.x) <= 0) { this.emit('lineBreak', o2, 'interception', 'PLAY', K.BREAK_S, 0, { gain: r1(run), phase: 1, who: thief }); return this.scoreTry(o2, 'interception') }
        this.emit('lineBreak', o2, 'interceptionHauled', 'PLAY', K.BREAK_S, 0, { gain: r1(run), phase: 1, who: thief, vs: this.ids([W.catcher(s, pick)]) })
      }
      return { k: 'phase' }
    }
    if (u < K.P_KNOCK_ON + K.P_FORWARD + K.P_BREAK * edge) {
      gain = K.BREAK_MIN + rng() * K.BREAK_SPAN
      st.x = this.adv(s, st.x, gain)
      if (this.toLine(s, st.x) <= 0) { this.emit('lineBreak', s, 'clean', 'PLAY', K.BREAK_S, 0, { gain: moved(), phase: st.phase, who, ...pass }); return this.scoreTry(s, 'break') }
      this.emit('lineBreak', s, 'hauledDown', 'PLAY', K.BREAK_S, 0, { gain: moved(), phase: st.phase, who, vs: this.ids([W.catcher(o2, pick)]), ...pass })
    } else {
      st.x = this.adv(s, st.x, gain)
      if (this.toLine(s, st.x) >= 99) st.x = s === 0 ? 1 : 99
      if (this.toLine(s, st.x) <= 0) {
        this.emit('carry', s, 'overTheLine', 'PLAY', K.CARRY_S, 0, { gain: moved(), phase: st.phase, who, vs: tk, ...pass })
        return rng() < K.P_HELD_UP ? this.heldUp(s) : this.scoreTry(s, wide ? 'wide' : 'close')
      }
      this.emit('carry', s, gain >= 1 ? 'gainLine' : 'held', 'PLAY', K.CARRY_S, 0, { gain: moved(), phase: st.phase, who, vs: tk, ...pass })
    }
    // the breakdown
    const r = rng(), def = 1 / this.vs(s, 'breakdown')
    // the defence gives away fewer penalties when it is disciplined, and so does the side with the ball
    const penFor = K.P_PEN_ATTACK / this.S(o2, 'discipline'), penAgainst = K.P_PEN_DEFENCE * def / this.S(s, 'discipline')
    if (r < K.P_TURNOVER * def) { const jk = W.jackal(o2, pick); st.ball = o2; st.phase = 1; st.carrierId = jk; st.passerId = ''; this.emit('ruck', s, 'turnover', 'PLAY', K.RUCK_S * 0.7, 0, { who, vs: this.ids([jk]) }); return { k: 'phase' } }
    if (r < K.P_TURNOVER * def + penFor) {
      const jk = W.jackal(o2, pick)
      this.emit('ruck', s, 'penaltyWon', 'PLAY', K.RUCK_S * 0.7, 0, { who, vs: this.ids([jk]) })
      return { k: 'penalty', to: s, free: false, cause: this.oneOf(['handsInRuck', 'offside', 'notRollingAway', 'highTackle']), offender: jk }
    }
    if (r < K.P_TURNOVER * def + penFor + penAgainst) {
      const jk = W.jackal(o2, pick)
      this.emit('ruck', s, 'penaltyLost', 'PLAY', K.RUCK_S * 0.7, 0, { who, vs: this.ids([jk]) })
      const c = this.oneOf(['holdingOn', 'sealingOff', 'obstruction'] as const)
      return { k: 'penalty', to: o2, free: false, cause: c, offender: c === 'holdingOn' ? who : W.forward(s, pick) }
    }
    if (r < K.P_TURNOVER * def + penFor + penAgainst + K.P_UNPLAYABLE) { this.emit('ruck', s, 'unplayable', 'PLAY', K.RUCK_S, 0, { who }); this.emit('unplayable', s, 'scrum', 'STOP', 0, 0); return { k: 'scrum', to: s } }
    this.emit('ruck', s, 'recycled', 'PLAY', K.RUCK_S, 0, { phase: st.phase, who })
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
