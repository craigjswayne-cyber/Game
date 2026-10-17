// The rarer incidents of open play (reversed penalties, cynical fouls, the
// penalty try, intercepts, held-up tries, the TMO, scuffles) and the
// contested set piece. Split out of matchEngine.ts.
import type { GameState, Player, Pos } from '../model'
import { XV_SLOTS } from '../model'
import { tIn } from '../i18n'
import { clamp } from '../rng'
import { isForward } from '../bench'
import { teamShort } from './selection'
import { refFor } from './referee'
import { backTowards, colour, describeRestart, inShirt, onField, said, upOf } from './commentary'
import { concedePenalty, scoreTry } from './scoring'
import { benchTank, isFrontRower } from './subs'
import { incRng, withRng } from './day'
import { giveRed, giveYellow, leadDamp, manFor } from './discipline'
import { recomputeSideUnits } from './field'
import { type SideCtx, evOf, evPts, zoneIdx } from './side'
import { type LiveCtx, pushLine } from './live'

/**
 * THE REFEREE CHANGES HIS MIND (item 53). Late word from the touch judge, a
 * replay on the big screen, or a block the attack ran that he had not seen:
 * the penalty goes the other way. About one in fifty.
 */
const REVERSE_P = 0.02
export function reversedPenalty(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number): boolean {
  const r = incRng(ctx, tick, side, 0x8E7E)
  if (r() >= REVERSE_P) return false
  const u = r()
  const kind = u < 0.4 ? 'obstruction' : u < 0.7 ? 'screen' : 'touchJudge'
  withRng(ctx, r, () => {
    pushLine(state, ctx, min, 'SUB', side, `comm.reverse_${kind}`, { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId) })
    concedePenalty(state, ctx, side, min, null)
  })
  side.pressure = clamp(side.pressure * 0.6, 0, 100)
  opp.pressure = clamp(opp.pressure + 12, 0, 100)
  backTowards(ctx, side, 12)
  return true
}

/**
 * ---- CYNICAL, AND THE PENALTY TRY (items 21, 26, 41) ----
 *
 * Close to the line, a defence about to be scored against will sometimes
 * kill it: a hand slapping a pass down, a body lying on the ball, a maul
 * pulled down. Inside the 22 that is a yellow card for the professional
 * foul; within a few metres, with a try coming, the referee goes under the
 * posts for seven points and the man still goes to the bin. How likely
 * scales with how likely the try was (pTry), so the side carving the
 * defence open is the side that gets them.
 */
const CYN_NEAR = 0.1, CYN_FAR = 0.018
export function cynicalIncident(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number, up: number, pTry: number): 'pt' | 'yc' | null {
  if (up < 70) return null
  const r = incRng(ctx, tick, side, 0xC71C)
  const near = up >= 88
  const p = (near ? clamp(CYN_NEAR * pTry / 0.1, 0.05, 0.25) : CYN_FAR) * leadDamp(side, opp)
  if (r() >= p) return null
  const u = r()
  const kind = u < 0.4 ? 'knockDown' : u < 0.75 ? 'ruck' : 'maul'
  const W: Partial<Record<Pos, number>> = kind === 'knockDown' ? { WG: 3, CE: 3, FB: 2, FH: 1, SH: 1, FL: 1 }
    : kind === 'ruck' ? { FL: 3, N8: 2, LK: 2, HK: 1.5 } : { LK: 3, FL: 2, HK: 1.5, LP: 1, TP: 1 }
  const p0 = manFor(r, onField(state, opp), W, 0.5)
  if (!p0) return null
  const pt = near && r() < (up >= 93 ? 0.45 : 0.2)
  const v = { team: teamShort(state, opp.teamId), opp: teamShort(state, side.teamId), player: p0.name }
  return withRng(ctx, r, () => {
    pushLine(state, ctx, min, 'SUB', opp, `comm.cyn_${kind}`, v, p0.id)
    if (pt) {
      penaltyTry(state, ctx, side, min)
      giveYellow(state, ctx, opp, p0, min + 1, 'comm.ycPenTry')
      return 'pt' as const
    }
    giveYellow(state, ctx, opp, p0, min, 'comm.ycProfFoul')
    return 'yc' as const
  })
}

/** seven points under the posts, no conversion, nobody credited (Law 8) */
function penaltyTry(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  side.pressure = clamp(side.pressure + 42, 0, 100)
  const opp = side === ctx.home ? ctx.away : ctx.home
  opp.pressure = clamp(opp.pressure * 0.55, 0, 100)
  ctx.field = ctx.field * 0.6 + 50 * 0.4
  side.score += 7
  side.tries += 1
  side.penTries = (side.penTries ?? 0) + 1
  evPts(ctx, side, 7, 'pen')
  pushLine(state, ctx, min, 'TRY', side, `comm.penTry${1 + ((min + side.score) % 3)}`, { team: teamShort(state, side.teamId) })
  describeRestart(state, ctx, side)
}

/**
 * ---- THE INTERCEPT (items 22, 50) ----
 *
 * A pass floated wide into a rush defence, and the man who read it is gone.
 * Off a tick that came to nothing for the side with the ball, likelier
 * against a rush (defLine) and a loose handling side (fwdF), and on a wet
 * ball. From deep it is a long way: a slower man is run down, and the ball
 * is then deep in the attacking side's half anyway. Nobody sends an
 * intercept upstairs.
 */
const INTERCEPT_P = 0.0085
const INTERCEPT_TRY = ['comm.tryIntercept1', 'comm.tryIntercept2', 'comm.tryIntercept3', 'comm.tryIntercept4']
export function interceptTick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number, up: number): boolean {
  const r = incRng(ctx, tick, side, 0x1A7C)
  const rush = (state.clubs[opp.teamId]?.tactic.defLine ?? 50) / 100
  const wet = ctx.weather === 'Rain' || ctx.weather === 'Snow' ? 1.2 : 1
  const p = INTERCEPT_P * (0.7 + 0.6 * rush) * (up > 45 ? 1.2 : 0.5) * clamp(side.fwdF ?? 1, 0.6, 1.6) * wet * leadDamp(opp, side)
  if (r() >= p) return false
  const man = manFor(r, onField(state, opp), { WG: 3, CE: 3, FB: 1.5, FH: 1, SH: 0.8, FL: 0.4 })
  if (!man) return false
  // the run is as long as the attack had come: `up` metres back to their line
  const pAway = clamp(1.05 - up * 0.006 + (man.a.pac - 12) * 0.025, 0.35, 0.97)
  opp.ratings.set(man.id, (opp.ratings.get(man.id) ?? 6) + 0.25)
  // it is a turnover, and the evidence counts it as one, where it happened
  // (the try it may become is put down to turnovers, so the count must have it)
  const z = zoneIdx(up)
  evOf(side).turnLost[z] += 1
  const eo = evOf(opp)
  eo.turnWon[2 - z] += 1
  eo.lastTurn = tick
  opp.styTurnWon = (opp.styTurnWon ?? 0) + 1
  side.styTurnLost = (side.styTurnLost ?? 0) + 1
  if (r() < pAway) {
    side.pressure = clamp(side.pressure * 0.55, 0, 100)
    ctx.evWhy = 'turn'
    withRng(ctx, r, () => scoreTry(state, ctx, opp, min, said(ctx, INTERCEPT_TRY), man, { player: man.name }, false))
    ctx.evWhy = null
  } else {
    backTowards(ctx, side, Math.min(60, up * 0.7))
    opp.pressure = clamp(opp.pressure + 25, 0, 100)
    pushLine(state, ctx, min, 'SUB', opp, `comm.interceptCaught${1 + (min % 2)}`, { player: man.name, team: teamShort(state, opp.teamId) }, man.id)
  }
  return true
}

/**
 * ---- HELD UP, AND THE GOAL-LINE DROP-OUT (items 19, 27) ----
 *
 * Over the line and the ball never touches the grass: a body underneath it,
 * an arm in the way. Since the 2022 law it restarts with a drop-out from the
 * defending side's own goal line, so being held up is a real defensive win:
 * the attack had the ball five metres out and now receives it near halfway.
 */
const HELD_UP_P = 0.24
export function heldUpTick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number, up: number): boolean {
  if (up < 86) return false
  const r = incRng(ctx, tick, side, 0x4E1D)
  if (r() >= HELD_UP_P) return false
  const carrier = manFor(r, onField(state, side), { N8: 2, FL: 2, LK: 1.5, HK: 2, LP: 1, TP: 1, CE: 1.2, WG: 1 })
  const stopper = manFor(r, onField(state, opp), { FL: 2, N8: 2, LK: 1.5, CE: 1.2, SH: 1, WG: 1, FB: 1 })
  if (stopper) opp.ratings.set(stopper.id, (opp.ratings.get(stopper.id) ?? 6) + 0.15)
  pushLine(state, ctx, min, 'SUB', opp, `comm.heldUp${1 + (min % 3)}`, {
    team: teamShort(state, opp.teamId), opp: teamShort(state, side.teamId),
    player: stopper?.name ?? teamShort(state, opp.teamId), carrier: carrier?.name ?? teamShort(state, side.teamId),
  }, stopper?.id)
  pushLine(state, ctx, min, 'SUB', opp, `comm.gldo${1 + (min % 2)}`, { team: teamShort(state, opp.teamId) })
  backTowards(ctx, side, 45)
  side.pressure = clamp(side.pressure * 0.6, 0, 100)
  opp.pressure = clamp(opp.pressure + 15, 0, 100)
  return true
}

/**
 * ---- FREE KICKS, AND THE THROW THAT IS NOT STRAIGHT (items 28, 33, 34, 46) ----
 *
 * The short arm: early engagement at the scrum, numbers at the lineout,
 * a crooked feed, time-wasting at the set piece, and a mark called inside
 * the 22. Nobody kicks at goal from one, so it is a little ground and the
 * ball, and a scrum offence given as a free kick makes the next one a full
 * penalty (describeOffence). A throw that is not straight hands the other
 * side the scrum; a hooker who throws badly, or one who has just come off the
 * bench cold, throws more of them.
 */
const FK_P = 0.08, NOT_STRAIGHT_P = 0.011
export function setPieceTick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number) {
  const r = incRng(ctx, tick, side, 0xF4EE)
  const u = r()
  const up = upOf(ctx, side)
  const team = teamShort(state, side.teamId), oppT = teamShort(state, opp.teamId)
  if (u < FK_P) {
    const k = r()
    const kind0 = up < 22 && k < 0.35 ? 'mark' : k < 0.5 ? 'scrumEarly' : k < 0.68 ? 'lineoutNumbers'
      : k < 0.82 ? 'scrumFeed' : k < 0.92 ? 'delay' : 'lineoutGap'
    // nobody engages at an uncontested scrum, so nobody goes early: the same
    // free kick is given for numbers at the lineout (both move play 5 metres)
    const kind = ctx.uncontested && kind0 === 'scrumEarly' ? 'lineoutNumbers' : kind0
    if (kind === 'scrumEarly' || kind === 'scrumFeed') opp.scrumFK = (opp.scrumFK ?? 0) + 1
    side.freeKicks = (side.freeKicks ?? 0) + 1
    const who = kind === 'mark' ? manFor(r, onField(state, side), { FB: 4, WG: 2, FH: 1 }) : null
    backTowards(ctx, opp, kind === 'mark' ? 18 : 5)
    side.pressure = clamp(side.pressure + 6, 0, 100)
    side.poss += 0.3
    pushLine(state, ctx, min, 'SUB', side, `comm.fk_${kind}`, { team, opp: oppT, player: who?.name ?? team }, who?.id)
    return
  }
  // the throw: the side throwing is `opp`, and `side` gets the scrum
  const hk = inShirt(state, opp, 1)
  const cold = hk && (opp.onAt?.get(hk.id) ?? 0) > 0 && min - (opp.onAt?.get(hk.id) ?? 0) < 12
  const pNS = NOT_STRAIGHT_P * clamp(1 + (12 - (hk?.a.lin ?? 12)) / 10, 0.6, 1.8) * (cold ? 1.4 : 1) * (2 - (opp.day?.lineout ?? 1))
  if (u < FK_P + pNS) {
    side.poss += 0.2
    opp.pressure = clamp(opp.pressure * 0.85, 0, 100)
    pushLine(state, ctx, min, 'SUB', opp, cold ? 'comm.notStraightCold' : `comm.notStraight${1 + (min % 2)}`,
      { team: oppT, opp: team, player: hk?.name ?? oppT }, hk?.id)
  }
}

/**
 * ---- THE TMO CALLS IT BACK (items 23, 43) ----
 *
 * Play has gone on, and the screen shows a high shot, a neck roll, a
 * dangerous clean-out, or a man playing the ball on the floor out of a
 * tackle. The referee goes upstairs for foul play, and the outcome is the
 * modern process: red for the worst, yellow for most, and a penalty only
 * when there is mitigation (a carrier dipping, a late change of direction, a
 * man falling into the tackle, low danger). The penalty is kicked to touch.
 */
const TMO_FOUL_P = 0.0062
export function tmoFoulTick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number) {
  const r = incRng(ctx, tick, side, 0x7F01)
  const agg = onField(state, opp).reduce((s, p) => s + p.a.agg, 0) / Math.max(1, opp.onPitch.size)
  const p = TMO_FOUL_P * clamp(agg / 11, 0.6, 1.6) * (ctx.derby ? 1.3 : 1) * refFor(ctx.fx.id).cards
  if (r() >= p) return
  const k = r()
  const kind = k < 0.35 ? 'high' : k < 0.55 ? 'secondary' : k < 0.68 ? 'neckRoll' : k < 0.82 ? 'cleanout' : 'ballOnGround'
  const W: Partial<Record<Pos, number>> = kind === 'ballOnGround' ? { HK: 2, FL: 3, N8: 2, LK: 1 }
    : kind === 'cleanout' ? { LK: 3, LP: 2, TP: 2, HK: 1.5, FL: 1.5 } : { LK: 2, FL: 2, CE: 2, LP: 1, TP: 1, HK: 1, N8: 1 }
  const man = manFor(r, onField(state, opp), W, 0.8)
  if (!man) return
  const v = { team: teamShort(state, opp.teamId), opp: teamShort(state, side.teamId), player: man.name }
  withRng(ctx, r, () => {
    pushLine(state, ctx, min, 'SUB', opp, `comm.tmoFoul_${kind}`, v, man.id)
    const verdict = r()
    if (kind !== 'ballOnGround' && verdict < 0.05) {
      giveRed(state, ctx, opp, man, min, 'comm.rcTmo')
    } else if (verdict < 0.6) {
      giveYellow(state, ctx, opp, man, min, kind === 'ballOnGround' ? 'comm.ycBallOnGround' : 'comm.ycTmo')
    } else {
      const m = r()
      pushLine(state, ctx, min, 'SUB', opp, `comm.tmoMit_${m < 0.3 ? 'dip' : m < 0.55 ? 'fall' : m < 0.8 ? 'late' : 'low'}`, v, man.id)
    }
    concedePenalty(state, ctx, opp, min, null)
  })
  backTowards(ctx, opp, 12)
  side.pressure = clamp(side.pressure + 12, 0, 100)
}

/**
 * ---- HANDBAGS (item 42) ----
 *
 * A shove after the whistle becomes six men and a referee. Mostly nothing
 * comes of it; sometimes the man who started it is penalised, and now and
 * then he is in the bin. More of them in a derby or a grudge match, in a
 * tight finish, and between sides with short fuses. Once a tick, not per side.
 */
const SCUFFLE_P = 0.011
export function scuffleTick(state: GameState, ctx: LiveCtx, tick: number, min: number) {
  const r = incRng(ctx, tick, null, 0x5C0F)
  const margin = Math.abs(ctx.home.score - ctx.away.score)
  const heat = (ctx.derby ? 2.2 : ctx.grudge ? 1.6 : 1) * (tick >= 15 && margin <= 10 ? 1.4 : 1)
  if (r() >= SCUFFLE_P * heat) return
  const aggOf = (s: SideCtx) => onField(state, s).reduce((t, p) => t + p.a.agg, 0) / Math.max(1, s.onPitch.size)
  const ha = aggOf(ctx.home), aa = aggOf(ctx.away)
  const inst = r() < ha / Math.max(1, ha + aa) ? ctx.home : ctx.away
  const other = inst === ctx.home ? ctx.away : ctx.home
  const man = manFor(r, onField(state, inst), { LK: 2, FL: 2, HK: 2, LP: 1.5, TP: 1.5, N8: 1, CE: 1 }, 1.2)
  if (!man) return
  const v = { team: teamShort(state, inst.teamId), opp: teamShort(state, other.teamId), player: man.name }
  pushLine(state, ctx, min, 'SUB', inst, `comm.scuffle${1 + Math.floor(r() * 3)}`, v, man.id)
  const o = r()
  if (o < 0.55) {
    pushLine(state, ctx, min, 'SUB', null, 'comm.scuffleNothing', v)
  } else {
    withRng(ctx, r, () => {
      pushLine(state, ctx, min, 'SUB', inst, 'comm.scufflePen', v, man.id)
      concedePenalty(state, ctx, inst, min, null)
      if (o >= 0.88) giveYellow(state, ctx, inst, man, min, 'comm.ycScuffle')
    })
    backTowards(ctx, inst, 10)
    other.pressure = clamp(other.pressure + 10, 0, 100)
  }
}

/** THE WATER BREAK (item 31): a hot afternoon stops at the quarters */
export function waterBreak(state: GameState, ctx: LiveCtx, tick: number) {
  if (!ctx.hot || (tick !== 5 && tick !== 15)) return
  colour(state, ctx, null, `comm.waterBreak${tick === 5 ? 1 : 2}`, { home: teamShort(state, ctx.home.teamId), away: teamShort(state, ctx.away.teamId) })
}

/**
 * ---- THE WARM-UP WITHDRAWAL (item 55) ----
 *
 * A hamstring tightens in the warm-up and the team sheet changes an hour
 * before kick-off: the replacement who was named on the bench starts, and the
 * side plays with a bench one short. Never a front-rower (the scrum law has
 * its own rules), about one side in fifty, and the man who pulls out misses a
 * week.
 */
const WITHDRAW_P = 0.02
export function lateWithdrawal(state: GameState, ctx: LiveCtx, side: SideCtx) {
  const r = incRng(ctx, -1, side, 0x1A7E)
  if (r() >= WITHDRAW_P) return
  const slot = 3 + Math.floor(r() * 12)
  const outId = side.lineup[slot]
  const out = outId != null ? state.players[outId] : null
  if (!out || !side.onPitch.has(out.id)) return
  const pos = XV_SLOTS[slot].pos
  let bIdx = -1
  for (let i = 15; i < side.lineup.length; i++) {
    const id = side.lineup[i]
    const b = id != null ? state.players[id] : null
    if (!b || b.injury) continue
    if (b.pos === pos || b.alt.includes(pos)) { bIdx = i; break }
    if (bIdx < 0 && isForward(b.pos) === isForward(pos) && !isFrontRower(b)) bIdx = i
  }
  if (bIdx < 0) return
  const b = state.players[side.lineup[bIdx] as number]
  side.lineup[slot] = b.id
  side.lineup[bIdx] = null
  side.onPitch.delete(out.id)
  side.onPitch.add(b.id)
  side.benchIds.delete(b.id)
  side.ratings.delete(out.id)
  side.ratings.set(b.id, 6)
  side.energy.delete(out.id)
  side.energy.set(b.id, benchTank(b))
  side.since?.delete(out.id)
  side.since?.set(b.id, 0)
  out.injury = { desc: tIn('en', 'injury.warmup'), dk: 'injury.warmup', until: state.week + 1, weeks: 1 }
  out.injLog = [...(out.injLog ?? []), { s: state.season, w: state.week, dk: 'injury.warmup', weeks: 1 }].slice(-20)
  recomputeSideUnits(state, ctx, side)
  pushLine(state, ctx, 0, 'SUB', side, 'comm.lateWithdrawal', { team: teamShort(state, side.teamId), player: out.name, sub: b.name }, b.id)
}

/**
 * ---- THE SET PIECE IS PLAYED, NOT ESTIMATED (1.9.0) ----
 *
 * Until 1.9.0 scrums and lineouts never happened. The scrum and the lineout
 * were a tenth each of a side's attack, scrumEdge leaned the penalty count,
 * and matchStats made the won and lost figures up afterwards from a tanh of
 * the two units. A lineout steal was a line of flavour text.
 *
 * Now each side feeds about 0.32 scrums and 0.6 lineouts a tick (thirteen
 * and twenty-five a match, the figures matchStats assumed), and each one is
 * contested: the scrum by the two packs' scrum units, scaled by how fresh
 * each FRONT ROW is (so a bench prop changes the scrum, locally), and by the
 * referee's scrum dial; the lineout by the throwing side's lineout unit and
 * the jumpers' legs against the other side's contest, worse in the wet.
 *
 * What it changes, and why it is balanced: the ball a set piece gives scales
 * this tick's try chance (clean a little up, scrappy down, stolen down for
 * the feeder and up for the thief), centred so that two equal packs score
 * exactly what they did; and penalties won at the scrum replace scrumEdge in
 * the penalty window, linear in won minus lost so equal packs are neutral.
 * A dominant pack now wins its afternoons the way it does on a real pitch.
 *
 * All of it is drawn on its own stream (incRng, salt 0x5E7), so the match's main
 * dice are untouched: the fingerprint moves only by what the set piece does.
 * setPieceTick, below, keeps the short arm (free kicks, the crooked throw).
 */
const SP_SCRUM_P = 0.32, SP_LINEOUT_P = 0.6
const SP_CLEAN = 1.012, SP_SCRAPPY = 0.92, SP_STOLEN = 0.88, SP_THIEF = 1.06
export const SP_PEN_W = 0.35
/** how fresh a side's set-piece men are, 0..1: the front row (scrum), the
 *  hooker and locks (the throw and catch) and the locks and flankers (the
 *  contest). One pass over the pitch a side a tick: this runs for every
 *  match in the world, and reading each group separately cost perfprobe
 *  its budget. Nothing in setPieceContest changes energy, so it is read once. */
type SpLegs = { fr: number; thr: number; jmp: number }
function spLegs(state: GameState, s: SideCtx): SpLegs {
  let fr = 0, nfr = 0, thr = 0, nthr = 0, jmp = 0, njmp = 0
  for (const id of s.onPitch) {
    const p = state.players[id]
    if (!p) continue
    const pos = p.pos
    if (pos !== 'LP' && pos !== 'HK' && pos !== 'TP' && pos !== 'LK' && pos !== 'FL') continue
    const e = s.energy.get(id) ?? 80
    if (pos === 'LP' || pos === 'HK' || pos === 'TP') { fr += e; nfr++ }
    if (pos === 'HK' || pos === 'LK') { thr += e; nthr++ }
    if (pos === 'LK' || pos === 'FL') { jmp += e; njmp++ }
  }
  return { fr: (nfr ? fr / nfr : 60) / 100, thr: (nthr ? thr / nthr : 60) / 100, jmp: (njmp ? jmp / njmp : 60) / 100 }
}
export function setPieceContest(state: GameState, ctx: LiveCtx, tick: number) {
  const { home, away } = ctx
  const ref = refFor(ctx.fx.id)
  const wet = ctx.weather === 'Rain' || ctx.weather === 'Snow' ? 1 : ctx.weather === 'Damp' ? 0.4 : 0
  const hl = spLegs(state, home), al = spLegs(state, away)
  home.spTryF = 1; home.spPens = 0; home.spScrums = 0; home.sp ??= { sw: 0, sl: 0, lw: 0, ll: 0, pen: 0 }
  away.spTryF = 1; away.spPens = 0; away.spScrums = 0; away.sp ??= { sw: 0, sl: 0, lw: 0, ll: 0, pen: 0 }
  // the home feed first, then the away: the order the dice were drawn in
  for (let k = 0; k < 2; k++) {
    const feed = k ? away : home, opp = k ? home : away
    const r = incRng(ctx, tick, feed, 0x5E7)
    // ---- the scrum ----
    if (r() < SP_SCRUM_P) {
      feed.spScrums! += 1; opp.spScrums! += 1
      const u = r()
      if (ctx.uncontested) {
        // nobody pushes in an uncontested scrum: the feeder keeps it
        feed.sp!.sw++
      } else {
        // the front row's legs are 40% of the shove: a spent one against a
        // fresh one off the bench is a pack going backwards (packprobe)
        const fl = k ? al : hl, ol = k ? hl : al
        const push = feed.units.scrum * (0.6 + 0.4 * fl.fr)
        const resist = opp.units.scrum * (0.6 + 0.4 * ol.fr)
        // read as a ratio, the way scrumEdge read the two packs: 1.1 is a
        // nudge (0.19), 1.3 a pack going forward (0.49), 2.0 a rout (0.88)
        const edge = Math.tanh(2 * Math.log(push / Math.max(0.01, resist)))
        const pen = 0.16 * ref.scrum
        if (u < pen) {
          // the referee rewards the side going forward
          const toFeed = r() < 0.5 + 0.4 * edge
          ;(toFeed ? feed : opp).spPens! += 1
          ;(toFeed ? feed : opp).sp!.pen++
          if (toFeed) feed.sp!.sw++; else feed.sp!.sl++
          if (ctx.detail && ctx.crng() < 0.35) colour(state, ctx, toFeed ? feed : opp, 'comm.flav21', { team: teamShort(state, (toFeed ? feed : opp).teamId) })
        // free kicks at the scrum are setPieceTick's (early engagement, the
        // feed), so this is the full-arm penalty, the tighthead, and the ball
        } else if (u < pen + 0.01 + Math.max(0, -edge) * 0.12) {
          feed.spTryF! *= SP_STOLEN; opp.spTryF! *= SP_THIEF; feed.sp!.sl++
        } else if (u < pen + 0.01 + Math.max(0, -edge) * 0.12 + 0.08 + Math.max(0, -edge) * 0.1) {
          feed.spTryF! *= SP_SCRAPPY; feed.sp!.sw++
        } else {
          feed.spTryF! *= SP_CLEAN; feed.sp!.sw++
        }
      }
    }
    // ---- the lineout ----
    if (r() < SP_LINEOUT_P) {
      const throwQ = feed.units.lineout * (0.8 + 0.2 * (k ? al : hl).thr)
      const contest = opp.units.lineout * (0.8 + 0.2 * (k ? hl : al).jmp)
      const win = clamp(0.87 + 0.10 * Math.tanh(2 * Math.log(throwQ / Math.max(0.01, contest))) - 0.04 * wet, 0.6, 0.97)
      // the throw that is not straight is setPieceTick's; this is the contest
      if (r() > win) {
        feed.spTryF! *= SP_STOLEN; opp.spTryF! *= SP_THIEF; feed.sp!.ll++
        if (ctx.detail && ctx.crng() < 0.5) {
          const jumper = [...opp.onPitch].map(id => state.players[id]).filter((p): p is Player => !!p && (p.pos === 'LK' || p.pos === 'FL'))
            .sort((a, b) => b.a.lin - a.a.lin)[0]
          if (jumper) colour(state, ctx, opp, 'comm.flav9', { player: jumper.name, team: teamShort(state, opp.teamId) }, jumper.id)
        }
      } else {
        feed.spTryF! *= r() < 0.86 ? SP_CLEAN : SP_SCRAPPY
        feed.sp!.lw++
      }
    }
  }
}
