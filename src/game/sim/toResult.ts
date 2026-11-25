// THE NEW ENGINE'S MATCH AS THE GAME'S MATCH (round 8, stage 6: wiring).
//
// When the manager watches his own match in Extended, the match is played by the new engine
// (skeleton.ts MatchSim on a World from fromMatch.ts), and what it did is written into the game's
// own live match (match/live.ts LiveCtx, kicked off by the game's own beginMatch) play by play, as
// it is played. At the whistle the game's own blowFullTime and finalizeMatch run on that LiveCtx,
// unchanged: appearances, minutes, ratings into form, morale, condition, man of the match, the
// match report, the 22 numbers, debuts, the fixture's score. The week's settlement then reads the
// fixture and the players exactly as it reads an old-engine match.
//
// What is written as each play comes in (Sim2Session.sync):
//   the score and tries; the scorer's tries and points and the kicker's conversions, penalties and
//   drop goals (on the record only in a competitive club match, as the old engine does: onRecord);
//   every kick at goal (kicksAt, kicksMade, conA, penA); cards (the season's yc and rc, the ban a
//   red card brings, the sin bin and its return); injuries (the game's own injury table and
//   lengths, the physio's discount, the injury log); substitutions (the lineup, who is on, when he
//   came on, his fresh tank); the minutes each man is on the field (fieldChanged); tackles; scrums
//   and lineouts won and lost; kicks from hand and charge-downs; possession; every man's tank,
//   drained a four-minute tick at a time by the game's own drainEnergy, with the half-time ten
//   back; the key lines (MatchEvent) the post-match screens and the season's best try read.
// At the whistle: each man's mark gets what he did in the record (stats below), then finalizeMatch.
//
// DICE. The game's own match dice (season/dice.ts matchRng: a stream for this one match, never
// shared with any other fixture) are drawn by beginMatch at kick-off and by finalizeMatch at the
// whistle (each mark's spread, the condition of a man with no tank), as for an old-engine match.
// The ticks in between are not played, so none of their draws is taken: no later match, this
// week or any other, reads this stream, so nothing else moves. What the old engine drew in its
// ticks and the new one does not model (which injury, how long, the length of a red card's ban)
// is drawn here from the adapter's own stream (ADAPTER_SALT on the session's seed).
//
// A resumed match: the session keeps the list of what was asked of it (runs, decisions, answers),
// and replaySim2 plays the same list on the same pre-match game to the same place. Nothing else is
// needed to save it.
import type { Fixture, GameState, MatchEvent, Player } from '../model'
import { facLevel } from '../model'
import { mulberry32, type Rng } from '../rng'
import { matchRng } from '../season/dice'
import { genderOf } from '../gender'
import { tIn } from '../i18n'
import { beginMatch } from '../match/begin'
import { applyTeamTalk, applyTacticsChange, openDressingRoom } from '../match/control'
import { blowFullTime } from '../match/finalize'
import { drainEnergy, FW_POS } from '../match/energy'
import { cameOn, fieldChanged } from '../match/field'
import { pickInjury } from '../match/injuries'
import { pushLine, userDials, type LiveCtx } from '../match/live'
import { buildEvidence } from '../evidence'
import { teamShort } from '../match/selection'
import type { SideCtx } from '../match/side'
import { onRecord, evOf, zoneIdx, EV_CAUSES, type EvCause } from '../match/side'
import { benchTank } from '../match/subs'
import { noteKick } from '../match/kicking'
import type { SimResult as OldResult } from '../match/lines'
import type { HtTone, PreTone } from '../teamtalk'
import { MatchSim, type Stop } from './skeleton'
import { worldFromMatch, type MatchWorld } from './fromMatch'
import type { PenaltyCall, Play } from './record'
import type { Decision } from './world'

/** THE SWITCH. On: a managed match the manager watches in Extended is played by the new engine.
 *  Off: nothing in the game reaches this file. */
export const SIM2_EXTENDED = true

/** the adapter's own dice, salted off the session's seed */
export const ADAPTER_SALT = 0x51a2ad

/** what was asked of a session, in order: enough to play it again to the same place */
export type Sim2Op = { run: Stop } | { apply: Decision } | { answer: PenaltyCall } | { cover: string } | { auto: true }
export interface Sim2Save { v: 1; fxId: number; seed: number; userSideId: string | null; preTalk: string | null; ops: Sim2Op[] }

export interface Sim2Opts {
  /** the team the manager runs in this match (club or nation); the game's own pick when absent */
  userSideId?: string | null
  /** the pre-match talk, as kickOff gives it (teamtalk.ts PreTone), or none */
  preTalk?: string | null
  /** the game's bench for the manager's side as well (the assistant has it). Off: as in a watched
   *  old-engine match, his replacements are his own and only an injury is covered for him. */
  assistantBench?: boolean
  /** the bench covers his injuries like for like at once. Off (the default, as in a watched
   *  old-engine match): the match waits at the dead ball for him to choose (pendingInjury). */
  autoInjury?: boolean
  /** for tests and measuring only: the match dice in place of the week's (matchRng), called twice
   *  for two identical streams (the World's private kick-off and the game's own) */
  dice?: () => Rng
}

/** per man, counted off the record: what goes into his mark */
interface ManLine { carries: number; metres: number; tackles: number; missed: number; breaks: number; turnovers: number; takes: number; knocks: number; pens: number; tries: number }
const NO_LINE = (): ManLine => ({ carries: 0, metres: 0, tackles: 0, missed: 0, breaks: 0, turnovers: 0, takes: 0, knocks: 0, pens: 0, tries: 0 })

/**
 * THE MARK FROM THE RECORD. The old engine's mark is 6 (with a small fixed jitter), plus what its
 * ticks credited (a try, a goal, a card), plus at the whistle the team's result, the pack's set
 * piece and a spread of 0.8 (finalizeMatch). The new engine counts what each man did, so his
 * contribution here replaces the old ticks' small per-incident credits: each count's weight,
 * less what an average man in his position does (RATE_MEAN), set so that over 200 matches of the
 * 56 league fixtures of a week each position's average mark and its spread are the old engine's
 * (scripts/tmp/gp/rates.ts; tests/simresult.test.ts holds it to 0.2 and 0.25).
 */
export const RATE_W: Record<keyof ManLine, number> = { carries: 0.02, metres: 0.012, tackles: 0.03, missed: -0.08, breaks: 0.18, turnovers: 0.15, takes: 0.04, knocks: -0.12, pens: -0.12, tries: 0 }
/** the average of the weighted counts for a man in each position over a full match (see RATE_W) */
export const RATE_MEAN: Record<string, number> = { LP: 0.70, HK: 0.92, TP: 0.57, LK: 0.87, FL: 1.14, N8: 1.26, SH: 0.67, FH: 0.57, CE: 0.83, WG: 0.48, FB: 0.42 }
/** and how far a man's mark moves for each unit of it: more for a back, whose afternoon the old
 *  engine's marks spread wider (sd 1.3 against 1.15 to 1.2 for a forward) */
export const RATE_SCALE: Record<string, number> = { LP: 0.6, HK: 0.6, TP: 0.6, LK: 0.6, FL: 0.6, N8: 0.6, SH: 0.6, FH: 0.8, CE: 1.1, WG: 1.2, FB: 1.2 }

export class Sim2Session {
  readonly sim: MatchSim
  readonly world: MatchWorld
  readonly ctx: LiveCtx
  readonly fx: Fixture
  /** 0 home, 1 away: the manager's side in the record, or null */
  readonly us: 0 | 1 | null
  /** what the room said to the pre-match talk (openDressingRoom), as kickOff shows it */
  readonly preTalkMsg: string | null
  private readonly state: GameState
  private readonly arng: Rng
  private readonly seed: number
  private readonly userSideId: string | null
  private readonly preTalk: string | null
  private readonly ops: Sim2Op[] = []
  private applied = 0
  private ticks = 0
  private finished: OldResult | null = null
  private readonly lines: [Map<string, ManLine>, Map<string, ManLine>] = [new Map(), new Map()]
  private readonly bins: { s: 0 | 1; id: number; back: number }[] = []
  /** where each side's possession came from, and what it has done (the points' causes: EvCount.pts) */
  private lastBall: 0 | 1 | null = null
  private from: ['turn' | 'set' | 'phase', 'turn' | 'set' | 'phase'] = ['phase', 'phase']
  private broke: [boolean, boolean] = [false, false]
  private moved: [boolean, boolean] = [false, false]
  private tryCause: [EvCause, EvCause] = ['phase', 'phase']

  constructor(state: GameState, fx: Fixture, seed: number, opts: Sim2Opts = {}) {
    this.state = state
    this.fx = fx
    this.seed = seed >>> 0
    this.preTalk = opts.preTalk ?? null
    this.arng = mulberry32((this.seed ^ ADAPTER_SALT) >>> 0 || 1)
    const userSideId = opts.userSideId === undefined ? state.userClubId : opts.userSideId
    this.userSideId = userSideId
    // the World first, from the game as it stands (it takes its own copy), kicked off on the same
    // dice as the game's own match below, so both copies start from the same afternoon
    const dice = opts.dice ?? (() => matchRng(state))
    this.world = worldFromMatch(state, fx, mulberry32(this.seed || 1), { beginRng: dice(), userSideId }).world
    // the game's own match: exactly what kickOff does for an old-engine match
    this.ctx = beginMatch(state, fx, dice(), true, userSideId)
    this.ctx.manualInj = true
    this.preTalkMsg = openDressingRoom(state, this.ctx, (opts.preTalk ?? null) as PreTone | null)
    this.us = this.world.managed ?? null
    this.kickoffTeams = [this.ctx.home.lineup.slice(0, 23), this.ctx.away.lineup.slice(0, 23)]
    this.sim = new MatchSim({ seed: this.seed, world: this.world })
    if (this.us != null) {
      // the manager answers his own kickable penalties; his bench is his own unless he hands it over
      this.sim.apply({ kind: 'penaltyCall', side: this.us, call: 'ask' })
      // (MatchSim leaves a managed side's bench to the manager; the assistant's, when he has it)
      this.sim.apply({ kind: 'bench', side: this.us, auto: !!opts.assistantBench })
      if (opts.preTalk) this.sim.apply({ kind: 'talk', side: this.us, tone: opts.preTalk, pre: true })
      if (!opts.autoInjury && !opts.assistantBench) this.sim.apply({ kind: 'injuryCall', side: this.us, ask: true })
    }
    if (opts.assistantBench) this.ctx.assistantSubs = true
  }

  /** the record so far */
  get plays(): readonly Play[] { return this.sim.plays }
  /** a kickable penalty waiting for the manager's call, or null */
  get pending() { return this.sim.pending }
  /** a man hurt on his side, waiting for him to name who comes on (options, and `like`: the game's pick) */
  get pendingInjury() { return this.sim.pendingInjury }
  /** the man of the match, as the record names men (player id as a string), once finish() has run */
  get motm(): string | undefined { return this.finished?.motmId != null ? String(this.finished.motmId) : undefined }
  /** the side the user manages (0 home, 1 away), as SimResult.managed */
  get managed(): 0 | 1 | undefined { return this.us ?? undefined }
  /** the final whistle has gone in the record */
  get done(): boolean { return this.sim.done }
  /** the score in the record */
  get score(): [number, number] { const p = this.plays; return p.length ? [p[p.length - 1].score[0], p[p.length - 1].score[1]] : [0, 0] }

  /** play on to the stop (MatchSim.runUntil); the game's match is brought up to date with it */
  runUntil(stop: Stop = {}): readonly Play[] {
    if (this.finished) return this.plays
    const last = this.ops[this.ops.length - 1]
    // one run straight after another is the same as the second alone: keep the list short
    if (last && 'run' in last) this.ops[this.ops.length - 1] = { run: { ...stop } }
    else this.ops.push({ run: { ...stop } })
    this.sim.runUntil(stop)
    this.sync()
    return this.plays
  }

  /**
   * A decision from the touchline: a substitution (ids as strings, made at the next dead ball and
   * written into the record as made or refused, with the reason), a tactics change (`set`: the
   * fields changed on the club's tactic, which the caller has already changed on the game's own
   * club as the old screen does), a team talk, or a standing penalty call. Returns what the game
   * says back (the room's verdict on a talk), or ''.
   */
  apply(d: Decision): string {
    if (this.finished) return ''
    this.ops.push({ apply: d })
    let msg = ''
    // the game's own match hears the talk too: its talk reactions carry into morale at the whistle
    if (d.kind === 'talk' && !d.pre && this.us === d.side) {
      this.sync()
      msg = applyTeamTalk(this.state, this.ctx, d.tone as HtTone)
    }
    if (d.kind === 'tactics' && this.us === d.side) {
      const tac = this.state.clubs[this.ctx[d.side === 0 ? 'home' : 'away'].teamId]?.tactic as unknown as Record<string, unknown> | undefined
      if (tac) { Object.assign(tac, d.set); applyTacticsChange(this.state, this.ctx) }
    }
    this.sim.apply(d)
    return msg
  }

  /** the manager's answer to the kickable penalty the match is waiting on */
  answer(call: PenaltyCall): void {
    if (this.finished || !this.sim.pending) return
    this.ops.push({ answer: call })
    this.sim.answer(call)
  }

  /** his man for the hurt man the match is waiting on: any of pendingInjury.options */
  cover(on: string): void {
    if (this.finished || !this.sim.pendingInjury) return
    this.ops.push({ cover: on })
    this.sim.answerInjury(on)
  }

  /** the call the side makes itself (the captain's, by the score and the clock: MatchSim's own call),
   *  for the penalty the match is waiting on: what answerDefault() will do. Read off a copy of the
   *  match played one step on, so nothing here is drawn from the match itself. */
  defaultCall(): PenaltyCall {
    const p = this.sim.pending
    if (!p) return 'posts'
    if (this.peek && this.peek.t === p.t) return this.peek.call
    const copy = new MatchSim({ seed: this.seed, world: this.world, from: this.sim.save() })
    copy.answerAuto()
    const n = copy.plays.length
    // one step: the call itself (the bench and the World are not touched while a penalty is taken)
    copy.step()
    const call = copy.plays.slice(n).find(q => q.call)?.call ?? copy.save().tag?.call ?? (p.options.includes('posts') ? 'posts' : p.options[0])
    this.peek = { t: p.t, call }
    return call
  }
  private peek: { t: number; call: PenaltyCall } | null = null

  /** leave the waiting penalty to the side's own call (the captain's), as the game makes it when he skips */
  answerDefault(): void {
    if (this.finished || !this.sim.pending) return
    this.ops.push({ auto: true })
    this.sim.answerAuto()
  }

  /** the two sides as they kicked off, before any change: [home, away], player ids, shirts 1 to 23 */
  readonly kickoffTeams: [(number | null)[], (number | null)[]]

  /** what to keep to play this match again to the same place (replaySim2) */
  save(): Sim2Save {
    return { v: 1, fxId: this.fx.id, seed: this.seed, userSideId: this.userSideId, preTalk: this.preTalk, ops: structuredClone(this.ops) }
  }

  /**
   * The final whistle. Plays out whatever is left (any penalty still waiting gets defaultCall,
   * as the old engine's skip does), brings the game's match up to date, puts what each man did
   * into his mark, and blows full time through the game's own finalizeMatch. Returns what
   * simMatch returns. Once only.
   */
  finish(): OldResult {
    if (this.finished) return this.finished
    for (let guard = 0; guard < 40 && !this.sim.done; guard++) {
      if (this.sim.pending) this.answerDefault()
      const inj = this.sim.pendingInjury
      if (inj) this.cover(inj.like)
      this.runUntil({})
    }
    this.sync()
    const ctx = this.ctx
    // the ticks the clock did not reach in the record (it always reaches 80: this is a net)
    while (this.ticks < 20) this.tick()
    for (const b of this.bins.splice(0)) this.back(b)
    ctx.tick = 20
    ctx.lastMin = Math.max(ctx.lastMin, 80)
    this.marks()
    blowFullTime(this.state, ctx)
    this.finished = { events: ctx.events, motmId: ctx.motmId }
    return this.finished
  }

  // ---- the record into the game's match -----------------------------------------------------

  private side(s: 0 | 1): SideCtx { return s === 0 ? this.ctx.home : this.ctx.away }
  private man(id: string | undefined): Player | null { return id ? this.state.players[Number(id)] ?? null : null }
  private line(s: 0 | 1, id: string | undefined): ManLine | null {
    if (!id) return null
    let l = this.lines[s].get(id)
    if (!l) { l = NO_LINE(); this.lines[s].set(id, l) }
    return l
  }

  /** one four-minute tick of the game's own fatigue, and the half-time ten back at the interval */
  private tick() {
    const ctx = this.ctx
    drainEnergy(this.state, ctx, ctx.home)
    drainEnergy(this.state, ctx, ctx.away)
    // (spScrums is the scrums of this tick, as the old engine's setPieceTick leaves it)
    ctx.home.spScrums = 0; ctx.away.spScrums = 0
    this.ticks++
    ctx.tick = this.ticks
    ;(ctx.marginHist ??= []).push(ctx.home.score - ctx.away.score)
    if (this.ticks === 10) {
      for (const side of [ctx.home, ctx.away]) for (const id of side.onPitch) {
        const e = side.energy.get(id)
        if (e != null) side.energy.set(id, Math.min(100, e + 10))
      }
    }
  }

  private back(b: { s: 0 | 1; id: number; back: number }) {
    const side = this.side(b.s)
    if (!side.binned.has(b.id)) return
    side.binned.delete(b.id)
    side.onPitch.add(b.id)
    fieldChanged(this.state, this.ctx, side, Math.min(80, b.back))
  }

  /** every play not yet written, in order */
  private sync() {
    const plays = this.plays
    for (; this.applied < plays.length; this.applied++) this.write(plays[this.applied])
  }

  private write(p: Play) {
    const ctx = this.ctx, state = this.state
    const clock = p.clock ?? p.t
    // the game's clock: the fatigue ticks this play has passed, the men back from the bin
    while (this.ticks < 20 && (this.ticks + 1) * 240 <= clock) this.tick()
    // the minute as the record's clock reads it: the second it is in, held at 40 in a first half's
    // added time (the old engine's own whistle rule, live.ts clockTo)
    const half2 = ctx.seg >= 1 && p.kind !== 'halfTime'
    const min = Math.max(1, Math.min(half2 ? 80 : 40, Math.floor(clock / 60) + 1))
    for (let i = this.bins.length - 1; i >= 0; i--) if (this.bins[i].back <= min) this.back(this.bins.splice(i, 1)[0])
    ctx.lastMin = Math.max(ctx.lastMin, min)
    ctx.field = Math.max(0, Math.min(100, p.x))
    const s = p.side, side = this.side(s), o: 0 | 1 = s === 0 ? 1 : 0, other = this.side(o)
    // possession: seconds of ball in play with the ball (matchStats reads the share)
    this.side(p.ball).poss += p.live
    // THE EVIDENCE (evidence.ts, the half-time and full-time panels): where the ball came from,
    // the zones it was played in, the turnovers by zone, the breaks and the called moves
    if (p.ball !== this.lastBall) {
      const b = p.ball
      this.from[b] = (p.kind === 'ruck' && p.result === 'turnover') || p.result === 'interception' || p.result === 'interceptionHauled' ? 'turn'
        : p.kind === 'scrum' || p.kind === 'lineout' ? 'set' : 'phase'
      this.broke[b] = false; this.moved[b] = false
      if (this.lastBall != null && this.from[b] === 'turn') {
        const upB = b === 0 ? p.x : 100 - p.x
        evOf(this.side(b)).turnWon[zoneIdx(upB)] += 1
        evOf(this.side(this.lastBall)).turnLost[zoneIdx(100 - upB)] += 1
        evOf(this.side(b)).lastTurn = this.ticks
      }
      this.lastBall = b
    }
    {
      const up = p.ball === 0 ? p.x : 100 - p.x
      evOf(this.side(p.ball)).zone[zoneIdx(up)] += 1
    }
    const setScore = () => { ctx.home.score = p.score[0]; ctx.away.score = p.score[1] }
    const who = this.man(p.who)
    switch (p.kind) {
      case 'try': case 'penaltyTry': {
        setScore()
        const cause: EvCause = p.kind === 'penaltyTry' ? 'pen' : this.broke[s] ? 'break' : this.from[s] === 'turn' ? 'turn' : this.moved[s] ? 'move' : 'phase'
        this.tryCause[s] = cause
        evOf(side).pts[EV_CAUSES.indexOf(cause)] += p.kind === 'penaltyTry' ? 7 : 5
        side.tries += 1
        if (side.firstTryMin == null) { side.firstTryMin = min; if (who) side.firstTryBy = who.id }
        if (who && p.kind === 'try') {
          ;(side.matchTries ??= new Map()).set(who.id, (side.matchTries.get(who.id) ?? 0) + 1)
          // the old engine's own credit (scoring.ts): 0.62 to the scorer and 0.035 to each forward on
          side.ratings.set(who.id, (side.ratings.get(who.id) ?? 6) + 0.62)
          for (const id of side.onPitch) { const f = state.players[id]; if (f && FW_POS.has(f.pos)) side.ratings.set(id, (side.ratings.get(id) ?? 6) + 0.035) }
          if (onRecord(state, ctx, side)) { who.stats.tries += 1; who.stats.points += 5 }
          const how = p.result
          const key = how === 'maul' ? 'comm.try4' : how === 'wide' ? 'comm.try2' : how === 'break' || how === 'interception' ? 'comm.try3' : 'comm.try1'
          pushLine(state, ctx, min, 'TRY', side, key, { player: who.name }, who.id)
        } else {
          // a penalty try: seven points, no conversion, nobody's try
          if (p.kind === 'penaltyTry') side.penTries = (side.penTries ?? 0) + 1
          pushLine(state, ctx, min, 'TRY', side, 'comm.tryPackDrive')
        }
        break
      }
      case 'conversion': case 'penaltyGoal': case 'dropGoal': {
        setScore()
        const good = !!p.good
        noteKick(ctx, side, good)
        if (good) evOf(side).pts[EV_CAUSES.indexOf(p.kind === 'conversion' ? this.tryCause[s] : p.kind === 'penaltyGoal' ? 'pen' : 'kick')] += p.kind === 'conversion' ? 2 : 3
        const rec = onRecord(state, ctx, side)
        if (p.kind === 'conversion') {
          if (who && rec) who.stats.conA = (who.stats.conA ?? 0) + 1
          if (good) {
            if (who && rec) { who.stats.cons += 1; who.stats.points += 2 }
            pushLine(state, ctx, min, 'CON', side, 'comm.con1', { player: who?.name ?? tIn('en', 'comm.theKicker') }, who?.id)
          } else pushLine(state, ctx, min, 'SUB', side, 'comm.conWide', { player: who?.name ?? '' }, who?.id)
        } else if (p.kind === 'penaltyGoal') {
          if (who && rec) who.stats.penA = (who.stats.penA ?? 0) + 1
          if (good) {
            side.pens += 1
            if (who) { if (rec) { who.stats.pens += 1; who.stats.points += 3 }; side.ratings.set(who.id, (side.ratings.get(who.id) ?? 6) + 0.15) }
            pushLine(state, ctx, min, 'PEN', side, 'comm.pen1', { player: who?.name ?? tIn('en', 'comm.theKicker') }, who?.id)
          } else pushLine(state, ctx, min, 'SUB', side, who ? 'comm.penWideNamed' : 'comm.penWide', { player: who?.name ?? '' }, who?.id)
        } else if (good) {
          if (who && rec) { who.stats.drops += 1; who.stats.points += 3 }
          pushLine(state, ctx, min, 'DG', side, 'comm.dropGoal', { player: who?.name ?? '' }, who?.id)
        }
        break
      }
      case 'yellowCard': {
        if (!who) break
        side.yellowUntil.set(who.id, min + 10)
        side.onPitch.delete(who.id)
        side.binned.add(who.id)
        who.stats.yc += 1
        side.ratings.set(who.id, (side.ratings.get(who.id) ?? 6) - 0.7)
        pushLine(state, ctx, min, 'YC', side, 'comm.yellowCard', { player: who.name, team: teamShort(state, side.teamId) }, who.id)
        fieldChanged(state, ctx, side, min)
        this.bins.push({ s, id: who.id, back: min + Math.round(((p.until ?? p.t + 600) - p.t) / 60) })
        break
      }
      case 'redCard': {
        if (!who) break
        side.sent += 1
        ;(side.sentOff ??= new Set()).add(who.id)
        side.onPitch.delete(who.id)
        side.binned.delete(who.id)
        who.stats.rc += 1
        // the ban the old engine gives: a straight red 2 or 3 matches (on the adapter's dice), a second
        // yellow 0 or 1, read off the man and the minute as discipline.ts giveYellow does
        who.bans += p.result === 'secondYellow' ? (who.id + min) % 2 : 2 + Math.floor(this.arng() * 2)
        side.ratings.set(who.id, (side.ratings.get(who.id) ?? 6) - 2)
        pushLine(state, ctx, min, 'RC', side, p.result === 'secondYellow' ? 'comm.secondYellow' : 'comm.redCard', { player: who.name, team: teamShort(state, side.teamId) }, who.id)
        fieldChanged(state, ctx, side, min)
        break
      }
      case 'injury': {
        if (!who) break
        // which injury and how long: the game's own table (injuries.ts pickInjury) and the old
        // engine's draw of the length inside it, the physio and the recovery centre's discount
        const [dk, lo, hi] = pickInjury(this.arng, genderOf(state), who.real)
        let weeks = lo + Math.floor(this.arng() * (hi - lo + 1))
        if (who.clubId === state.userClubId) {
          const care = (state.staff?.physio ?? 0) * 0.12 + facLevel(state, 'recovery') * 0.03
          if (care > 0) weeks = Math.max(1, Math.round(weeks * (1 - care)))
        }
        weeks = Math.max(1, weeks)
        who.injury = { desc: tIn('en', dk), dk, until: state.week + weeks, weeks }
        who.injLog = [...(who.injLog ?? []), { s: state.season, w: state.week, dk, weeks }].slice(-20)
        side.onPitch.delete(who.id)
        pushLine(state, ctx, min, 'INJ', side, 'comm.injuryDown', {
          player: who.name, injury_k: dk, rush_k: (who.rust ?? 0) > 0 ? 'comm.injuryRushedBack' : 'common.nothing',
        }, who.id)
        fieldChanged(state, ctx, side, min)
        break
      }
      case 'substitution': {
        if (p.result !== 'made') break
        const on = this.man(p.with?.[0])
        if (!who || !on) break
        const slotOut = side.lineup.indexOf(who.id), slotIn = side.lineup.indexOf(on.id)
        if (slotOut >= 0) side.lineup[slotOut] = on.id
        if (slotIn >= 0) side.lineup[slotIn] = who.id
        side.onPitch.delete(who.id)
        side.onPitch.add(on.id)
        cameOn(side, on.id, Math.min(79, min))
        if (!side.ratings.has(on.id)) side.ratings.set(on.id, 6)
        side.energy.set(on.id, benchTank(on))
        const forced = p.cause === 'injury'
        if (side.isUser && !forced) ctx.subsUsed += 1
        fieldChanged(state, ctx, side, min)
        if (forced) pushLine(state, ctx, min, 'SUB', side, 'comm.subComesOn', { player: on.name, brief_k: 'common.nothing' }, on.id)
        else pushLine(state, ctx, min, 'SUB', side, 'comm.subFromBench', { on: on.name, off: who.name, brief_k: 'common.nothing' }, on.id)
        break
      }
      case 'halfTime':
        setScore()
        while (this.ticks < 10) this.tick()
        ctx.seg = 1
        // the room opens: the match screen's half-time panel, as blowHalfTime leaves it
        ctx.awaiting = 'HT'
        pushLine(state, ctx, 40, 'HT', null, 'comm.halfTime', {
          home: teamShort(state, ctx.fx.homeId), away: teamShort(state, ctx.fx.awayId), hs: ctx.home.score, ascore: ctx.away.score,
        })
        // the half-time panel's numbers, as blowHalfTime leaves them
        if (ctx.userSideId) {
          const ev = buildEvidence(state, ctx)
          if (ev) ctx.htEv = ev
          ctx.htDials = userDials(state, ctx)
        }
        break
      case 'scrum': {
        side.spScrums = (side.spScrums ?? 0) + 1
        other.spScrums = (other.spScrums ?? 0) + 1
        const sp = (side.sp ??= { sw: 0, sl: 0, lw: 0, ll: 0, pen: 0 })
        if (p.result === 'againstTheHead' || p.result === 'penaltyLost' || p.result === 'freeKickLost') sp.sl += 1
        else sp.sw += 1
        if (p.result === 'penaltyWon' || p.result === 'penaltyLost') sp.pen += 1
        break
      }
      case 'lineout': {
        const sp = (side.sp ??= { sw: 0, sl: 0, lw: 0, ll: 0, pen: 0 })
        if (p.result === 'won') { sp.lw += 1; const j = this.line(s, p.with?.[0]); if (j) j.takes++ } else sp.ll += 1
        break
      }
      case 'notStraight': {
        const sp = (side.sp ??= { sw: 0, sl: 0, lw: 0, ll: 0, pen: 0 })
        sp.ll += 1
        break
      }
      case 'carry': case 'lineBreak': {
        const l = this.line(s, p.who)
        if (l) {
          if (p.kind === 'carry') l.carries++
          else l.breaks++
          l.metres += Math.max(0, p.gain ?? 0)
        }
        const ev = evOf(side)
        if (p.kind === 'lineBreak') { ev.breaks += 1; this.broke[s] = true } else ev.carries += 1
        if (p.move) {
          const c = (ev.calls[p.move] ??= [0, 0, 0, 0, 0])
          c[0] += 1; c[1] += p.gain ?? 0
          this.moved[s] = true
        }
        // the man he beat: a missed tackle (field.ts keeps them for the season's success rate)
        for (const b of p.beat ?? []) {
          const bl = this.line(o, b); if (bl) bl.missed++
          const bm = this.man(b)
          if (bm) (other.missed ??= new Map()).set(bm.id, (other.missed.get(bm.id) ?? 0) + 1)
        }
        for (const t of p.vs ?? []) {
          const tl = this.line(o, t)
          if (tl) tl.tackles++
          const tm = this.man(t)
          if (tm) (other.tackles ??= new Map()).set(tm.id, (other.tackles.get(tm.id) ?? 0) + 1)
        }
        break
      }
      case 'ruck':
        if (p.result === 'turnover') { const j = this.line(o, p.vs?.[0]); if (j) j.turnovers++ }
        break
      case 'knockOn': case 'forwardPass': { const l = this.line(s, p.who); if (l) l.knocks++; break }
      case 'penalty': case 'freeKick': {
        // the offender is of the other side
        const l = this.line(o, p.offender); if (l) l.pens++
        other.consPens = (other.consPens ?? 0) + 1
        break
      }
      case 'kick':
        if (p.kick !== 'restart') side.handKicks = (side.handKicks ?? 0) + 1
        if (p.result === 'chargedDown') side.chargedDown = (side.chargedDown ?? 0) + 1
        break
      default: break
    }
  }

  /** each man's afternoon into his mark: what he did against an average man in his position */
  private marks() {
    for (const s of [0, 1] as const) {
      const side = this.side(s)
      for (const [id, l] of this.lines[s]) {
        const p = this.man(id)
        if (!p || !side.ratings.has(p.id)) continue
        let v = 0
        for (const k of Object.keys(RATE_W) as (keyof ManLine)[]) v += RATE_W[k] * l[k]
        // a replacement's average is the share of the eighty he played
        const share = Math.max(0.1, Math.min(1, (side.played?.get(p.id) ?? 0) / 80 + (side.since?.has(p.id) ? (80 - (side.since.get(p.id) ?? 80)) / 80 : 0)))
        v -= (RATE_MEAN[p.pos] ?? 0.75) * share
        side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) + (RATE_SCALE[p.pos] ?? 0.6) * v)
      }
    }
  }
}

/** Kick off a managed match on the new engine: the game's own kick-off, the World, the MatchSim. */
export function startSim2(state: GameState, fx: Fixture, seed: number, opts: Sim2Opts = {}): Sim2Session {
  return new Sim2Session(state, fx, seed, opts)
}

/** The same match played again on the same pre-match game, to the same place: a resumed match. */
export function replaySim2(state: GameState, save: Sim2Save, opts: Omit<Sim2Opts, 'userSideId' | 'preTalk'> = {}): Sim2Session | null {
  const fx = state.fixtures.find(f => f.id === save.fxId)
  if (!fx) return null
  const s = new Sim2Session(state, fx, save.seed, { ...opts, userSideId: save.userSideId, preTalk: save.preTalk })
  for (const op of save.ops) {
    if ('run' in op) s.runUntil(op.run)
    else if ('apply' in op) s.apply(op.apply)
    else if ('cover' in op) s.cover(op.cover)
    else if ('auto' in op) s.answerDefault()
    else s.answer(op.answer)
  }
  return s
}

/** the seed a managed match plays on: the game's own match seed for the week, so the same week
 *  played again is the same match */
export function sim2Seed(state: GameState, fx: Fixture): number {
  return (Math.floor(matchRng(state)() * 4294967296) ^ Math.imul(fx.id, 2654435761)) >>> 0
}

export type { MatchEvent }
