// THE MATCH AS IT IS PLAYED (round 8, the real match screen). The new engine is stepped a passage at a
// time (from one dead ball to the next), the pitch bakes as far as it has been told, and the screen plays
// the bake on a clock of its own. Nothing already baked is baked again, so the picture is continuous
// across every join; a decision the manager makes is handed to the engine, which makes it at the next
// dead ball it has not yet played.
//
// Three parts:
//  - Session: the engine's side. On the real screen it is GAMEPLAY's Sim2Session (toResult.ts, made by the
//    store's kickOff on liveMatch.sim2) through `fromSim2`; the tests use `standInSession`, a thin wrapper
//    round MatchSim and worldFromMatch with the same shape.
//  - StreamClock: how fast each baked frame is shown, worked out as frames are baked, by the same rules
//    as the whole-match timeline (clip pace for key moments and every play of a scoring possession, a
//    ruck pause wound on, smaller breaks at 3x, a close finish at 2x, fast forward elsewhere, every change
//    eased), committed a few seconds behind the bake so a lead-in or an ease can still reach back.
//  - StreamFeed: what LivePitch reads (the RecordFeed surface), with `pump()` to bake and simulate ahead
//    of the viewer and `blockedBy` to say what the match is waiting for (a penalty call, half-time,
//    the full-time whistle).
import type { GameState, Fixture } from '../../game/model'
import { mulberry32 } from '../../game/rng'
import { teamName } from '../../game/match/selection'
import { worldFromMatch, type SimSide } from '../../game/sim/fromMatch'
import { MatchSim, type PendingCall, type PendingInjury } from '../../game/sim/skeleton'
import type { Sim2Session } from '../../game/sim/toResult'
import type { Decision } from '../../game/sim/world'
import type { Play, PenaltyCall, SimResult } from '../../game/sim/record'
import {
  bigBreak, BREAK_RATE, CLIP_RATE, CLOSE_FROM, CLOSE_MARGIN, CLOSE_RATE, EASE_S, FPS, LEAD_BREAK, LEAD_IN, LEAD_KICK, BEAT,
  makeBaker, PAUSE_HOLD, PAUSE_RATE, possessionStart, RecordFeed, SCREEN_BALL, SCREEN_MAN, type Baked, type Baker,
} from './fromRecord'

// ---------------------------------------------------------------- the engine's side

/** what the screen needs of the engine (GAMEPLAY's session API, round 8) */
export interface Session {
  /** the record so far: the same array, pushed to as the match is played */
  readonly plays: Play[]
  readonly sides: [SimSide, SimSide]
  /** the side the manager is (0 home, 1 away), or null */
  readonly managed: 0 | 1 | null
  /** a penalty call the match is stopped for, or null */
  readonly pending: PendingCall | null
  /** a man of his hurt, the match waiting for him to name who comes on, or null */
  readonly pendingInjury: PendingInjury | null
  readonly done: boolean
  /** play on to the next dead ball (or the call, or the end) */
  nextPassage(): void
  /** a decision from now (a substitution waits for the ball to be dead) */
  apply(d: Decision): void
  /** answer the call; `null` leaves it to the captain (the game's own choice) */
  answer(call: PenaltyCall | null): void
  /** his man on for the hurt man the match is waiting on (any of pendingInjury.options) */
  cover(on: string): void
  /** the bench as the engine has it now */
  lineup(side: 0 | 1): { field: string[]; off: boolean[]; bench: string[] } | null
  /** play the rest of the match at once (the captain answers any call) */
  playOut(): void
  result(): SimResult
}

/** THE REAL MATCH: GAMEPLAY's session (store kickOff, liveMatch.sim2), as the screen needs it */
export function fromSim2(s: Sim2Session, game: GameState): Session {
  // the sides as they kicked off (the session's own kickoffTeams: shirts 1 to 23)
  const lus = s.kickoffTeams
  const side = (i: 0 | 1): SimSide => {
    const teamId = (i === 0 ? s.ctx.home : s.ctx.away).teamId
    const club = game.clubs[teamId]
    return {
      teamId, name: teamName(game, teamId), captain: club?.captain != null ? String(club.captain) : undefined,
      players: lus[i].flatMap((id, k) => { const p = id != null ? game.players[id] : null; return p ? [{ id: String(p.id), name: p.name, shirt: k + 1 }] : [] }),
    }
  }
  const out: Session = {
    get plays() { return s.plays as Play[] },
    sides: [side(0), side(1)],
    managed: s.us,
    get pending() { return s.pending },
    get pendingInjury() { return s.pendingInjury },
    get done() { return s.done },
    nextPassage() { if (!s.done && !s.pending && !s.pendingInjury) s.runUntil({ play: s.plays.length + 1, dead: true }) },
    apply: d => { s.apply(d) },
    // left to him (or the timer ran out): the captain's own call, by the score and the clock (the session's)
    answer: call => { if (!s.pending) return; if (call) s.answer(call); else s.answerDefault() },
    cover: on => s.cover(on),
    lineup: i => s.world.lineup?.(i) ?? null,
    playOut() {
      for (let guard = 0; guard < 400 && !s.done; guard++) {
        if (s.pending) out.answer(null)
        else if (s.pendingInjury) s.cover(s.pendingInjury.like)
        else s.runUntil({})
      }
    },
    result: () => s.sim.result(),
  }
  return out
}

/** THE STAND-IN (the tests' session): the managed match on MatchSim, on the real sides */
export function standInSession(game: GameState, fx: Fixture, seed: number): Session {
  const { world, home, away } = worldFromMatch(game, fx, mulberry32(seed))
  const sim = new MatchSim({ seed, world })
  const managed = world.managed ?? null
  // the manager is asked for his own penalties
  if (managed != null) sim.apply({ kind: 'penaltyCall', side: managed, call: 'ask' })
  const captain = () => {
    // the game's own answer for this one penalty: the call left to the captain, then asked again from the next
    const p = sim.pending
    if (!p) return
    sim.apply({ kind: 'penaltyCall', side: p.side, call: 'auto' })
    sim.step()
    sim.apply({ kind: 'penaltyCall', side: p.side, call: 'ask' })
  }
  return {
    get plays() { return sim.plays },
    sides: [home, away],
    managed,
    get pending() { return sim.pending },
    pendingInjury: null,
    get done() { return sim.done },
    nextPassage() {
      const from = sim.plays.length
      for (let guard = 0; guard < 400; guard++) {
        if (sim.done || sim.pending) return
        sim.step()
        // a dead ball: the next thing is a restart, a set piece, a penalty, or the whistle
        if (sim.plays.length > from && sim.st.next.k !== 'phase') return
      }
    },
    apply: d => sim.apply(d),
    answer: call => { if (call) sim.answer(call); else captain() },
    cover: () => {},
    lineup: s => world.lineup?.(s) ?? null,
    playOut() { for (let guard = 0; guard < 5000 && !sim.done; guard++) { if (sim.pending) captain(); else sim.runUntil() } },
    result: () => sim.result(),
  }
}

// ---------------------------------------------------------------- the clock

/** fast forward at Normal: the speed the whole-match timeline settles on for a typical match (round 4, 7x to 10x) */
export const STREAM_FF = 9
/** frames behind the bake that are final (anim seconds): room for a lead-in, a try's whole build-up (BUILD_MAX,
 *  which a try found later reaches back to) and an ease to reach back without a step in speed */
export const COMMIT_LAG = 36
/** how far ahead of the viewer the bake is kept (anim seconds) */
export const BAKE_AHEAD = 42

export class StreamClock {
  rate = new Float32Array(4096)
  slow = new Uint8Array(4096)
  private vm = new Float32Array(4096)
  /** frames whose rate will not change again */
  committed = 0
  /** frames with a rate at all */
  n = 0
  private grow(to: number) {
    if (to <= this.rate.length) return
    let c = this.rate.length
    while (c < to) c *= 2
    const r = new Float32Array(c); r.set(this.rate); this.rate = r
    const s = new Uint8Array(c); s.set(this.slow); this.slow = s
    const v = new Float32Array(c); v.set(this.vm); this.vm = v
  }
  /** work the rates out for the frames baked so far; `final`: the match is over and baked to the end */
  update(bk: Baked, final: boolean, held = false) {
    const n = bk.n
    if (n <= this.n && !final) return
    this.grow(n + 1)
    const cutSet = new Set(bk.cuts)
    // how fast anything moves in each new frame, against what the screen allows
    for (let f = Math.max(1, this.n); f < n; f++) {
      if (cutSet.has(f)) { this.vm[f] = this.vm[f - 1]; continue }
      let v = 0
      for (let i = 0; i < 30; i++) v = Math.max(v, Math.hypot(bk.pos[f * 62 + i * 2] - bk.pos[(f - 1) * 62 + i * 2], bk.pos[f * 62 + i * 2 + 1] - bk.pos[(f - 1) * 62 + i * 2 + 1]) * FPS)
      const bv = Math.hypot(bk.ball[f * 3] - bk.ball[(f - 1) * 3], bk.ball[f * 3 + 1] - bk.ball[(f - 1) * 3 + 1]) * FPS
      this.vm[f] = Math.max(v / SCREEN_MAN, bv / SCREEN_BALL)
    }
    const C = this.committed
    const W = Math.round(FPS * 0.5)
    // ---- what each frame is (the same rules as capsOf)
    const P = bk.plays, segs = bk.segs
    for (let f = C; f < n; f++) this.slow[f] = 0
    const mark = (a: number, b: number, v: number) => {
      for (let f = Math.max(C, Math.floor(a * FPS)); f < Math.min(n, Math.ceil(b * FPS)); f++) this.slow[f] = v === 1 ? 1 : this.slow[f] === 1 ? 1 : v
    }
    // the close finish
    const at75 = P.findIndex(p => (p.clock ?? p.t) >= CLOSE_FROM)
    let closeF = Infinity
    if (at75 > 0 && segs[at75]?.a0 != null && bk.seg[n - 1] >= at75 && Math.abs(P[at75 - 1].score[0] - P[at75 - 1].score[1]) <= CLOSE_MARGIN) { closeF = Math.floor(segs[at75].a0 * FPS); mark(segs[at75].a0, n / FPS + 1, 2) }
    const last = n ? bk.seg[n - 1] : 0
    const started = (k: number) => k <= last
    for (let k = 0; k <= Math.min(last + 1, P.length - 1); k++) {
      const g = segs[k]
      if (!g) continue
      const p = P[k]
      const a0 = started(k) ? g.a0 : n / FPS
      const end = started(k) && k < last ? g.a0 + g.act + BEAT : n / FPS + 1
      if (end * FPS < C && k < last) continue
      if (p.kind === 'try' || p.kind === 'penaltyTry') {
        const st = possessionStart(P, k)
        if (started(st)) mark(segs[st].a0, end, 1)
      } else if (g.key === 2) {
        const lead = p.kind === 'lineBreak' ? LEAD_BREAK : p.kind === 'conversion' || p.kind === 'penaltyGoal' ? LEAD_KICK : LEAD_IN
        mark(a0 - lead, started(k) && k < last ? g.a0 + g.act + (p.kind === 'lineBreak' ? 0.6 : BEAT) : n / FPS + 1, 1)
      }
    }
    // a try the engine has already played whose possession began in what is baked (the bake has not reached the try yet)
    for (let k = last + 1; k < P.length; k++) if (P[k].kind === 'try' || P[k].kind === 'penaltyTry') { const st = possessionStart(P, k); if (started(st)) mark(segs[st].a0, n / FPS + 1, 1) }
    // the smaller line breaks
    for (let k = 0; k <= last; k++) if (P[k].kind === 'lineBreak' && !bigBreak(P, k)) {
      const g = segs[k]
      for (let f = Math.max(C, Math.floor((g.a0 - LEAD_BREAK) * FPS)); f < Math.min(n, Math.ceil((g.a0 + g.act + 0.6) * FPS)); f++) if (this.slow[f] === 0) this.slow[f] = 4
    }
    // a ball lying at a ruck in a build-up is wound on
    let still = 0
    // (counted from well back, so a pause already under way when the frames were last worked out is still a pause)
    for (let f = Math.max(1, C - 20 * FPS); f < n; f++) {
      const bv = Math.hypot(bk.ball[f * 3] - bk.ball[(f - 1) * 3], bk.ball[f * 3 + 1] - bk.ball[(f - 1) * 3 + 1]) * FPS
      const g = segs[bk.seg[f]], inKey = g.key === 2 && f / FPS < g.a0 + g.act
      const lying = (this.slow[f] === 1 || this.slow[f] === 3) && !inKey && bk.holder[f] < 0 && bv < 0.3 && P[bk.seg[f]].kind === 'ruck'
      still = lying ? still + 1 / FPS : 0
      if (f >= C && still > PAUSE_HOLD && f < closeF) this.slow[f] = 3
    }
    // ---- the rates, eased: forward from the last final frame, back from the frontier
    const k2 = Math.log(STREAM_FF) / EASE_S
    for (let f = C; f < n; f++) {
      let m = 0
      for (let q = Math.max(0, f - W); q <= Math.min(n - 1, f + W); q++) m = Math.max(m, this.vm[q])
      const cap = Math.max(1, Math.min(20, 1 / Math.max(1e-6, m)))
      const sl = this.slow[f]
      this.rate[f] = sl === 1 ? CLIP_RATE : sl === 3 ? Math.min(PAUSE_RATE, cap) : sl === 4 ? Math.min(BREAK_RATE, cap) : sl === 2 ? Math.min(CLOSE_RATE, cap) : Math.min(STREAM_FF, cap)
    }
    for (let f = Math.max(1, C); f < n; f++) this.rate[f] = Math.min(this.rate[f], this.rate[f - 1] * Math.exp(k2 / FPS / this.rate[f - 1]))
    // (held for the manager: the picture settles to clip pace as it gets there, so whatever comes next starts from it)
    if (held && n > C) this.rate[n - 1] = Math.min(this.rate[n - 1], CLIP_RATE)
    for (let f = n - 2; f >= C; f--) this.rate[f] = Math.min(this.rate[f], this.rate[f + 1] * Math.exp(k2 / FPS / this.rate[f + 1]))
    // (and a slowing that would have to begin behind what is final, a try's build-up found after its first frames
    // were fixed: eased down from the last final frame instead of a step. Everywhere else the pass above has
    // eased it already and this changes nothing)
    for (let f = Math.max(1, C); f < n; f++) this.rate[f] = Math.max(this.rate[f], this.rate[f - 1] * Math.exp(-k2 / FPS / this.rate[f - 1]))
    this.n = n
    this.committed = final ? n : Math.max(C, n - Math.round(COMMIT_LAG * FPS))
  }
}

// ---------------------------------------------------------------- the feed

export type Blocked = 'penalty' | 'injury' | 'halfTime' | 'fullTime' | null

/** what the screen asks the stream to wait at (the manager's say), or null to play on */
export class StreamFeed extends RecordFeed {
  readonly baker: Baker
  readonly clock = new StreamClock()
  /** the anim second the screen is at */
  a = 0
  /** a speed button: 1 at Normal; it scales every rate alike */
  speedMul = 1
  /** half-time is held until the manager has had his say */
  htHeld = false
  /** the screen has caught up with everything that may be shown */
  starved = false
  private htSeen = -1
  constructor(public session: Session, ids: [string, string], nameOf?: (id: string) => string | undefined) {
    const baker = makeBaker(session.plays, session.sides)
    super(session.plays, session.sides, ids, nameOf, () => baker.live())
    this.baker = baker
  }
  /** the engine is waiting: for a penalty call, at half-time, or the match is over */
  get blockedBy(): Blocked {
    const P = this.session.plays
    if (this.session.pending) return 'penalty'
    if (this.session.pendingInjury) return 'injury'
    if (this.session.done) return 'fullTime'
    // (half-time, held until released; a change made in it, written straight after it, does not end it)
    let h = P.length - 1
    while (h >= 0 && P[h].kind === 'substitution') h--
    if (h >= 0 && P[h].kind === 'halfTime' && h > this.htSeen) return 'halfTime'
    return null
  }
  /** half-time is over (the talk given): play on into the second half */
  releaseHalfTime() { let h = this.session.plays.length - 1; while (h >= 0 && this.session.plays[h].kind !== 'halfTime') h--; this.htSeen = h }
  /** bake (and simulate) ahead of the screen, for up to `ms` milliseconds of work */
  pump(ms = 6): void {
    const t0 = performance.now()
    for (let guard = 0; guard < 200 && performance.now() - t0 < ms; guard++) {
      const bk = this.baker.live()
      if (bk.n / FPS >= this.a + BAKE_AHEAD && !this.baker.frames) break
      if (bk.n / FPS >= this.a + BAKE_AHEAD) break
      const blocked = this.blockedBy
      const final = blocked === 'fullTime'
      const r = this.baker.run(Math.round(FPS * 2), { final, ahead: blocked ? 0 : 1 })
      // (when the engine is waiting for the manager no more frames will come until he answers: all of it may be shown)
      this.clock.update(this.baker.live(), r === 'done' || (r === 'need' && !!blocked), r === 'need' && !!blocked)
      if (r === 'need') {
        if (blocked) break
        const before = this.session.plays.length
        this.session.nextPassage()
        if (this.session.plays.length > before) this.baker.more()
        else if (!this.blockedBy) break
      }
      if (r === 'done') break
    }
    this.dirty = true
  }
  /** frames the screen may show */
  get shownTo(): number { return Math.max(0, this.clock.committed - 1) }
  get length(): number { return Infinity }
  protected isDone(): boolean { return this.blockedBy === 'fullTime' && this.a * FPS >= this.clock.n - 2 }
  /** the screen's clock, dt seconds on: anim time moves at the rate of the frame it is in, times the speed button */
  step(dt: number) {
    if (this.done) return
    this.view += dt
    const fa = Math.max(0, Math.min(this.clock.n - 1, Math.floor(this.a * FPS)))
    const next = this.a + dt * (this.clock.rate[fa] || 1) * this.speedMul
    const lim = this.shownTo / FPS
    this.starved = next >= lim
    this.a = Math.min(next, lim)
    this.dirty = true
    this.done = this.isDone()
  }
  seek(v: number) { this.a = Math.max(0, Math.min(v, this.shownTo / FPS)); this.dirty = true; this.read() }
  /** A MATCH PICKED UP AGAIN (a reload, the session replayed to where it was): everything up to play `n`
   *  baked without being shown, at the same rates the screen worked out the first time (the bake and the
   *  clock see the same plays), and the screen stood at the start of play n. Returns the play it stands at. */
  startAt(n: number): number {
    n = Math.max(0, Math.min(n, this.session.plays.length - 1))
    // (the first frame of play n as baked: the frame-to-play map, not segs[n].a0, which is only a plan until
    // the bake has started the play)
    const firstOf = () => { const bk = this.baker.live(); for (let f = 0; f < bk.n; f++) if (bk.seg[f] >= n) return f; return -1 }
    let f0 = -1
    for (let guard = 0; guard < 20000; guard++) {
      f0 = firstOf()
      if (f0 >= 0 && this.shownTo >= f0) break
      const had = this.baker.live().n
      // (pump bakes BAKE_AHEAD past where the screen is: the screen is moved along to what is final)
      this.a = Math.max(this.a, this.shownTo / FPS)
      this.pump(50)
      if (this.baker.live().n === had && this.blockedBy) { f0 = firstOf(); break }
    }
    this.seek(f0 >= 0 ? Math.min(f0, this.shownTo) / FPS : this.shownTo / FPS)
    return this.n
  }
  protected read() { if (this.baker.frames > 0) super.read() }
  protected animNow(): number { return this.a }
  protected rateAt(fa: number): number { return (this.clock.rate[fa] || 1) * this.speedMul }
  protected slowAt(fa: number): number { return this.clock.slow[fa] }
  /** at the end of what may be shown, with the engine waiting for the manager */
  get waiting(): Blocked { return this.starved && this.blockedBy ? this.blockedBy : null }
}

export function frameCount(bk: Baked): number { return bk.n }
