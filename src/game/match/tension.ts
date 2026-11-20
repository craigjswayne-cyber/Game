/**
 * ---- A TEST THAT IS CLOSE SHOULD FEEL CLOSE (owner, 1.9.16) ----
 *
 * "Test matches generally seem a lot tighter and tense ... internationals
 *  need to feel the tension."
 *
 * Measured first, because the first reading of that was "make them closer"
 * and the numbers say they already are: the game's Six Nations Tests are
 * decided by seven or fewer 35% of the time against 33% in the real 2026
 * championship, on a mean margin of 15.1 against 15.9 (docs/working-1.9.16.md).
 * What a close Test lacked was anybody saying so. A one-score international
 * in the last quarter read exactly like a dead rubber in round four.
 *
 * So this is words and a marker, and nothing else. No dice of the match are
 * touched: every choice here is read off the clock and the score, or drawn on
 * the commentary's own stream (ctx.crng), which the simulation never reads.
 * A match played silently is the same match.
 */
import type { GameState, Player } from '../model'
import { teamShort } from './selection'
import { type LiveCtx, pushLine } from './live'
import type { SideCtx } from './side'

/** a converted try, the size of "one score" */
export const ONE_SCORE = 7
/** the last quarter: when a close Test starts to tell */
export const TENSE_FROM = 60

export const isTest = (state: GameState, ctx: LiveCtx): boolean => !!state.comps[ctx.fx.compId]?.isNational

/** How tight it is, if it is tight: a Test, in its last quarter, with a
 *  converted try or less between the sides. The scoreboard reads this too. */
export function tensionOf(state: GameState, ctx: LiveCtx, min: number): 'level' | 'one' | null {
  if (!isTest(state, ctx) || min < TENSE_FROM) return null
  const margin = Math.abs(ctx.home.score - ctx.away.score)
  return margin === 0 ? 'level' : margin <= ONE_SCORE ? 'one' : null
}

const LEAD = ['comm.tenseLead1', 'comm.tenseLead2', 'comm.tenseLead3', 'comm.tenseLead4']
const CHASE = ['comm.tenseChase1', 'comm.tenseChase2', 'comm.tenseChase3', 'comm.tenseChase4']
const LEVEL = ['comm.tenseLevel1', 'comm.tenseLevel2', 'comm.tenseLevel3']
const CROWD = ['comm.tenseCrowd1', 'comm.tenseCrowd2', 'comm.tenseCrowd3', 'comm.tenseCrowd4']

/** The atmosphere line for this tick, when the Test is on a knife edge: what
 *  the side with the ball is playing for, or what the ground is doing. Null
 *  when the ordinary atmosphere should speak. Two commentary draws at most. */
export function tenseLine(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number): string | null {
  const tn = tensionOf(state, ctx, min)
  if (!tn) return null
  // more of it as the clock runs down: about half the atmosphere at sixty,
  // nearly all of it in the last five
  if (ctx.crng() >= 0.45 + Math.min(0.45, (min - TENSE_FROM) * 0.025)) return null
  const pool = ctx.crng() < 0.3 ? CROWD : tn === 'level' ? LEVEL : side.score > opp.score ? LEAD : CHASE
  const recent = ctx.recent ?? []
  const fresh = pool.filter(k => !recent.includes(k))
  const from = fresh.length ? fresh : pool
  const key = from[(min + side.score + opp.score) % from.length]
  ;(ctx.recent ??= []).push(key)
  if (ctx.recent.length > 12) ctx.recent.shift()
  return key
}

/** Said once, the first time the clock is past seventy with one score in it. */
export function lastTenCall(state: GameState, ctx: LiveCtx, min: number) {
  if (!ctx.detail || ctx.tenseSaid || min < 70) return
  const tn = tensionOf(state, ctx, min)
  if (!tn) return
  ctx.tenseSaid = true
  const lead = ctx.home.score >= ctx.away.score ? ctx.home : ctx.away
  const chase = lead === ctx.home ? ctx.away : ctx.home
  // "ten minutes left" only when it is: a Test that became close at 76 gets
  // the closing-minutes line instead
  const early = min <= 72
  pushLine(state, ctx, min, 'SUB', null, tn === 'level' ? (early ? 'comm.tenseTenLevel' : 'comm.tenseLateLevel') : (early ? 'comm.tenseTenOne' : 'comm.tenseLateOne'), {
    team: teamShort(state, lead.teamId), opp: teamShort(state, chase.teamId),
    n: Math.abs(ctx.home.score - ctx.away.score),
  })
}

/** The walk to the tee. A shot at goal in the last quarter of a one-score
 *  Test is not a kick, it is the match: said before the ball is struck. */
export function pressureKick(state: GameState, ctx: LiveCtx, side: SideCtx, other: SideCtx, kicker: Player | null, min: number) {
  if (!ctx.detail || !kicker || !tensionOf(state, ctx, min)) return
  const diff = side.score - other.score
  // what three points would do: take the lead, level it, or stretch it past a score
  const key = diff < 0 && diff >= -2 ? 'comm.pressKickLead'
    : diff === -3 ? 'comm.pressKickLevel'
    : diff === 0 ? 'comm.pressKickFront'
    : diff > 0 && diff + 3 > ONE_SCORE ? 'comm.pressKickClear'
    : `comm.pressKick${1 + (min % 2)}`
  pushLine(state, ctx, min, 'SUB', side, key, { player: kicker.name, team: teamShort(state, side.teamId), opp: teamShort(state, other.teamId) }, kicker.id)
}
