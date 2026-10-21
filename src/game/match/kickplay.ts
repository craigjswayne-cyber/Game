// Kicks from hand, the 50:22, charge-downs and drop goals. Split out of
// matchEngine.ts, which re-exports the public parts.
import type { GameState, Pos, Tactic } from '../model'
import { zoneAt, zonePlan } from '../tactics'
import { clamp, mulberry32, wpick } from '../rng'
import { ATK_KICKS } from '../styles'
import { teamShort } from './selection'
import { backTowards, colour, describeRestart, inShirt, onField, said, sayWho, upOf } from './commentary'
import { scoreTry } from './scoring'
import { goalKicker } from './field'
import { type SideCtx, evPts, onRecord } from './side'
import { CHARGE_DOWN, CHARGE_LINEOUT, CHARGE_REGATHER, CHARGE_SAFE, CHARGE_SCRUM, CHARGE_TRY_LINES, DROP_MISS, KICK_BOX, KICK_EXIT, KICK_FIELD, KICK_LONG, KICK_PIN, KICK_TOUCH, KICK_UP } from './lines'
import { type LiveCtx, pushLine } from './live'
import { noteKick } from './kicking'

/**
 * ---- KICKS FROM HAND, AND THE ONES THAT ARE CHARGED DOWN (owner, 1.8.0) ----
 *
 * The owner's numbers: one kick from hand in forty is charged down, and one
 * in eighty ends in a try for the side that charged it.
 *
 * The engine had no kicks from hand at all: the kicking game was the line's
 * drift (ctx.field) and a handful of words. So the kicks are counted here, on
 * the match's own dice because a charge-down changes the match: a side kicks
 * a little more in its own half (the exit, the clearance, the box kick) than
 * in theirs, more with the kicking dial up and a territory game, and less with
 * the ball in hand. About seventeen a side a match, on the neutral dials.
 *
 * ONLY A LITTLE MORE DEEP, on purpose. With a steep gradient (half as many
 * kicks between the 22s as inside your own) territory paid twice: the side
 * with the field position also got the other side's charge-downs, and the
 * long exit from your own 22 went past optionsprobe's meta line.
 *
 * Each kick is a single draw against CHARGE_RATE. A charge-down is half a try
 * for the side that blocked it (a proper try, converted as any other, and not
 * sent to the TMO: nobody reviews a man falling on a loose ball in-goal), and
 * otherwise the ball lands where it lands - touch, a scrum, the chargers or
 * the kicker's own side - one draw between the four, and each moves the line
 * towards the kicking side's posts by what that outcome is worth.
 *
 * TWO SETS OF DICE, BOTH THE MATCH'S. How many kicks a side puts in and
 * whether each is charged come off a stream of their own, seeded once from
 * rng at kick-off and then by the tick and the side, because the count depends on the
 * tactics and the field: drawn from rng, a change of kicking dial shifted every
 * draw after it, and optionsprobe's common random numbers - the same match
 * with only the option changed - fell apart (a zone plan read +5.3 points one
 * run and +2.0 the next). What a charge-down DOES (who blocked it, whether it
 * is a try, where the ball goes, the try and the conversion) is rng, like
 * everything else that changes a match. Nothing here is the commentary's: the
 * same whether the match is watched or not, and only the words (which line,
 * which kicker is named) are crng.
 */
const HAND_KICKS_BY_PLAN: Record<string, number> = { long: 1.25, box: 1.1, play: 0.6, terr: 1.15, hand: 0.8 }
export const CHARGE_RATE = 1 / 40
export const CHARGE_TRY = 0.5
export function kicksFromHand(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number, tick: number) {
  const rng = mulberry32((((ctx.kickSeed ?? ctx.fx.id) ^ Math.imul(tick + 1, 104729) ^ (side === ctx.home ? 0x4b1c : 0x2e7d)) >>> 0) || 1)
  const up = upOf(ctx, side)
  const tac = state.clubs[side.teamId]?.tactic
  let rate = up < 22 ? 1.0 : up < 50 ? 0.9 : up < 78 ? 0.8 : 0.7
  rate *= 0.75 + (tac?.kicking ?? 50) / 200
  rate *= tac?.kickStyle === 'territory' ? 1.15 : tac?.kickStyle === 'attack' ? 0.9 : 1
  // and the style (1.8.2): the box kick and chase kicks the most
  if (side.sty) rate *= ATK_KICKS[side.sty.atk]
  // and the plan for where the ball is: a side kicking its exits long, or
  // playing for territory, puts in more of the kicks that can be charged, and
  // a side running it out of its own 22 fewer. Without this the kicking plans
  // won the ground AND dodged the risk that comes with it (optionsprobe: the
  // long exit read +4.0 points a match against a meta line of 4).
  rate *= HAND_KICKS_BY_PLAN[zonePlan(zoneAt(up), tac?.zones?.[zoneAt(up)]).id] ?? 1
  const n = Math.floor(rate) + (rng() < rate % 1 ? 1 : 0)
  for (let i = 0; i < n; i++) {
    side.handKicks = (side.handKicks ?? 0) + 1
    if (rng() < CHARGE_RATE) { chargeDown(state, ctx, side, opp, min); return }
    // OUT ON THE FULL, AND THE 50:22 (1.8.16, items 51, 59). On the same
    // kick dice. A kick that goes out without bouncing comes back to where it
    // was struck, a lineout to them; a kick from your own half that bounces
    // out inside their 22 is your throw there. A better boot finds more of
    // those, a touch-finding style looks for them, and now and then the
    // referee rules the ball was taken back into the kicker's half first and
    // it is an ordinary lineout to them.
    const k = rng()
    if (k < OUT_FULL_P * (2 - (side.day?.kicking ?? 1))) {
      backTowards(ctx, side, 7)
      const p = sayWho(state, ctx, side, [9, 14, 11], [5, 3, 1])
      colour(state, ctx, side, said(ctx, OUT_FULL), { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId), player: p?.name ?? teamShort(state, side.teamId) }, p?.id)
      continue
    }
    if (up < 50 && k < OUT_FULL_P + fiftyTwentyTwoP(side, tac)) {
      const p = sayWho(state, ctx, side, [9, 14, 8], [5, 3, 1])
      const v = { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId), player: p?.name ?? teamShort(state, side.teamId) }
      if (rng() < VOID_5022) {
        colour(state, ctx, side, 'comm.void5022', v, p?.id)
        continue
      }
      ctx.field = side === ctx.home ? 82 : 18
      side.pressure = clamp(side.pressure + 15, 0, 100)
      side.fifty22 = (side.fifty22 ?? 0) + 1
      colour(state, ctx, side, said(ctx, FIFTY22), v, p?.id)
      return
    }
    describeKick(state, ctx, side, opp, up, tac?.kickStyle)
  }
}

/** a kick that goes out on the full, a 50:22 found, and the share of those
 *  the referee voids because the ball was taken back into the half (1.8.16) */
const OUT_FULL_P = 0.012
const VOID_5022 = 0.15
const OUT_FULL = ['comm.outFull1', 'comm.outFull2', 'comm.outFull3']
const FIFTY22 = ['comm.fifty22_1', 'comm.fifty22_2', 'comm.fifty22_3']
function fiftyTwentyTwoP(side: SideCtx, tac: Tactic | undefined): number {
  const boot = clamp(side.units.kicking / 16, 0.6, 1.5)
  return 0.017 * boot * (tac?.kickStyle === 'territory' ? 1.4 : tac?.kickStyle === 'attack' ? 0.8 : 1)
}

/** a kick from hand, in words: where it was kicked from decides what kind */
function describeKick(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, up: number, style?: Tactic['kickStyle']) {
  if (!ctx.detail || ctx.crng() >= 0.42) return
  const c = ctx.crng()
  const bank = up < 22 ? (c < 0.5 ? KICK_EXIT : KICK_BOX)
    : up < 50 ? (style === 'territory' ? (c < 0.6 ? KICK_TOUCH : KICK_LONG) : style === 'contest' ? (c < 0.6 ? KICK_BOX : KICK_UP)
      : c < 0.3 ? KICK_BOX : c < 0.65 ? KICK_TOUCH : KICK_LONG)
    : up < 78 ? (style === 'attack' ? (c < 0.6 ? KICK_PIN : KICK_UP) : c < 0.5 ? KICK_UP : c < 0.75 ? KICK_LONG : KICK_TOUCH)
    : KICK_PIN
  const p = bank === KICK_BOX ? sayWho(state, ctx, side, [8]) : sayWho(state, ctx, side, [9, 14, 11], [6, 3, 1])
  if (!p) return
  const team = teamShort(state, side.teamId), oppT = teamShort(state, opp.teamId)
  colour(state, ctx, side, said(ctx, bank), { team, opp: oppT, player: p.name }, p.id)
  // a ball in touch, and the quick throw taken before the lineout forms (item 29)
  if (bank === KICK_TOUCH && ctx.crng() < 0.12) {
    const q = sayWho(state, ctx, opp, [14, 10, 13, 8], [3, 2, 2, 1])
    if (q) colour(state, ctx, opp, `comm.quickThrow${1 + Math.floor(ctx.crng() * 2)}`, { team: oppT, opp: team, player: q.name }, q.id)
  }
  // the other side's answer to a kick they have to field
  if ((bank === KICK_LONG || bank === KICK_UP || bank === KICK_BOX) && ctx.crng() < 0.35) {
    const q = sayWho(state, ctx, opp, [14, 10, 13, 8], [4, 2, 2, 1])
    if (q) colour(state, ctx, opp, said(ctx, KICK_FIELD), { team: oppT, opp: team, player: q.name }, q.id)
  }
}

/** The kick is charged down. Who got a hand (a body, a shin) to it is the
 *  match's dice, since he may be the man who scores; the rest is words. */
function chargeDown(state: GameState, ctx: LiveCtx, kick: SideCtx, charge: SideCtx, min: number) {
  const { rng } = ctx
  kick.chargedDown = (kick.chargedDown ?? 0) + 1
  const men = onField(state, charge)
  if (!men.length) return
  // the men who charge are the ones nearest the kicker: the back row, the
  // locks and the midfield more than the wings
  const W: Partial<Record<Pos, number>> = { FL: 3, N8: 2.2, LK: 2, HK: 1.4, LP: 1, TP: 1, SH: 1.2, FH: 1.5, CE: 1.6, WG: 0.7, FB: 0.6 }
  const charger = wpick(rng, men, men.map(p => W[p.pos] ?? 1))
  const kicker = sayWho(state, ctx, kick, [8, 9, 14], [3, 5, 2])
  const team = teamShort(state, charge.teamId), oppT = teamShort(state, kick.teamId)
  colour(state, ctx, charge, said(ctx, CHARGE_DOWN), { team, opp: oppT, player: charger.name, kicker: kicker?.name ?? oppT }, charger.id)
  charge.ratings.set(charger.id, (charge.ratings.get(charger.id) ?? 6) + 0.2)
  const o = rng()
  if (o < CHARGE_TRY) {
    // loose behind them, and the chargers get there first. The line is left
    // where the kick was taken: moving it onto the kicking side's own line
    // first made every charge-down try restart the game deep in their 22,
    // which quietly paid the own-22 exit plans twice (optionsprobe)
    charge.pressure = clamp(charge.pressure + 42, 0, 100)
    kick.pressure = clamp(kick.pressure * 0.55, 0, 100)
    ctx.evWhy = 'kick'
    scoreTry(state, ctx, charge, min, said(ctx, CHARGE_TRY_LINES), charger, { player: charger.name }, false)
    ctx.evWhy = null
    return
  }
  // otherwise one of four, evenly: touch, a scrum, the chargers regather, or
  // the kicking side does. Every one of them costs the kicker ground.
  const k = Math.min(3, Math.floor((o - CHARGE_TRY) / ((1 - CHARGE_TRY) / 4)))
  if (k === 0) {
    backTowards(ctx, kick, 5)
    colour(state, ctx, kick, said(ctx, CHARGE_LINEOUT), { team: oppT, opp: team })
  } else if (k === 1) {
    backTowards(ctx, kick, 6)
    colour(state, ctx, charge, said(ctx, CHARGE_SCRUM), { team, opp: oppT })
  } else if (k === 2) {
    backTowards(ctx, kick, 10)
    charge.pressure = clamp(charge.pressure + 20, 0, 100)
    charge.poss += 0.3
    colour(state, ctx, charge, said(ctx, CHARGE_REGATHER), { team, opp: oppT, player: charger.name }, charger.id)
  } else {
    backTowards(ctx, kick, 3)
    colour(state, ctx, kick, said(ctx, CHARGE_SAFE), { team: oppT, opp: team })
  }
}

/**
 * ---- THE DROP GOAL, MADE OR MISSED (owner, 1.8.0) ----
 *
 * The attempt was always rolled and always counted as a kick at goal, and a
 * miss said nothing, so the stats panel could show a kick taken that the
 * commentary never mentioned. Every attempt now has its line.
 *
 * And it is a kick from where the ball is: only in their half (it was rolled
 * from anywhere, halfway line included), better the closer in, and read off
 * the fly-half's kicking from hand - or the goal-kicker's if the 10 is off.
 * LATE IN A CLOSE GAME IT IS THE PLAY: from tick 17 (the 69th minute) a side level or
 * within a score goes for it about four times as often, a side a score up
 * twice as often. The base rate is set so the world kicks as many drop goals
 * as it did before any of this: 0.18 over a match, 0.53 points, measured on
 * the same 1,440 watched fixtures before and after - and now about 0.12
 * missed ones a match with them, which used to be silent.
 */
const DROP_BASE = 0.0135
export function dropChance(_ctx: LiveCtx, side: SideCtx, opp: SideCtx, up: number, tick: number): number {
  if (up < 55) return 0
  const diff = side.score - opp.score
  const late = tick >= 17 ? (diff >= -3 && diff <= 0 ? 4 : diff > 0 && diff <= 4 ? 2 : 1) : 1
  return DROP_BASE * late * (up > 70 ? 1.25 : 1)
}

export function dropGoalAttempt(state: GameState, ctx: LiveCtx, side: SideCtx, min: number, up: number) {
  const { rng } = ctx
  const fh = inShirt(state, side, 9)
    ?? goalKicker(state, side)
  if (!fh) return
  const pOver = clamp(0.12 + fh.a.kic / 40 + (up - 68) * 0.006, 0.12, 0.75)
  const dgOver = rng() < pOver
  noteKick(ctx, side, dgOver)
  if (dgOver) {
    side.score += 3
    evPts(ctx, side, 3, 'kick')
    if (onRecord(state, ctx, side)) { fh.stats.drops += 1; fh.stats.points += 3 }
    // the line before the restart, so it is stamped where it was struck
    pushLine(state, ctx, min, 'DG', side, 'comm.dropGoal', { player: fh.name }, fh.id)
    ctx.field = ctx.field * 0.6 + 50 * 0.4
    describeRestart(state, ctx, side)
  } else {
    // a missed drop goal is a 22 drop-out for the other side, which is where
    // the ball already is: nothing moves but the words
    pushLine(state, ctx, min, 'SUB', side, said(ctx, DROP_MISS), { player: fh.name }, fh.id)
  }
}
