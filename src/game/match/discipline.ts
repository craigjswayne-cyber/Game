// Cards, the offences and the referee's warnings. Split out of
// matchEngine.ts.
import type { GameState, Player, Pos } from '../model'
import { clamp, wpick, type Rng } from '../rng'
import { teamShort } from './selection'
import { refFor } from './referee'
import { colour, onField, upOf } from './commentary'
import { checkFrontRow } from './subs'
import { fieldChanged } from './field'
import type { SideCtx } from './side'
import { type LiveCtx, binUntil, pushLine } from './live'

/** the man leading this side on the pitch: the captain, the vice, or the
 *  most natural leader out there */
function captainOf(state: GameState, side: SideCtx): Player | null {
  const club = state.clubs[side.teamId]
  for (const id of [club?.captain, club?.vice]) {
    if (id != null && side.onPitch.has(id)) return state.players[id] ?? null
  }
  const ps = onField(state, side)
  return ps.length ? ps.reduce((a, b) => (b.a.lea > a.a.lea ? b : a)) : null
}

/** ten minutes in the bin, for a named reason. Never below thirteen. */
export function giveYellow(state: GameState, ctx: LiveCtx, side: SideCtx, p: Player, min: number, key: string, v?: Record<string, string | number>): boolean {
  if (!side.onPitch.has(p.id)) return false
  // A SECOND YELLOW IS A RED (Law 9 and World Rugby Regulation 17): a man
  // already back from the bin is sent off for the rest of it. The panel often
  // calls the sending-off sanction enough, sometimes adds a week; which one is
  // read off the man and the minute, so no draw is taken from either stream.
  if (side.yellowUntil.has(p.id)) {
    side.sent += 1
    side.onPitch.delete(p.id)
    p.stats.rc += 1
    p.bans += (p.id + min) % 2
    side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 2)
    pushLine(state, ctx, min, 'RC', side, 'comm.secondYellow', { player: p.name, team: teamShort(state, side.teamId) }, p.id)
    checkFrontRow(state, ctx, side, min, p, 'red')
    fieldChanged(state, ctx, side, min)
    return true
  }
  if (side.onPitch.size <= 13) return false
  side.yellowUntil.set(p.id, binUntil(ctx, min))
  side.onPitch.delete(p.id)
  side.binned.add(p.id)
  p.stats.yc += 1
  side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 0.7)
  pushLine(state, ctx, min, 'YC', side, key, { player: p.name, team: teamShort(state, side.teamId), ...(v ?? {}) }, p.id)
  checkFrontRow(state, ctx, side, min, p, 'yellow')
  fieldChanged(state, ctx, side, min)
  return true
}

/** a red card: for the match (RED-CARD-01), with the ban that follows */
export function giveRed(state: GameState, ctx: LiveCtx, side: SideCtx, p: Player, min: number, key: string, v?: Record<string, string | number>): boolean {
  if (!side.onPitch.has(p.id)) return false
  side.sent += 1
  side.onPitch.delete(p.id)
  p.stats.rc += 1
  p.bans += 2 + Math.floor(ctx.rng() * 2)
  side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 2)
  pushLine(state, ctx, min, 'RC', side, key, { player: p.name, team: teamShort(state, side.teamId), ...(v ?? {}) }, p.id)
  checkFrontRow(state, ctx, side, min, p, 'red')
  fieldChanged(state, ctx, side, min)
  return true
}

/** the share of the old card roll that still fires, now that the
 *  professional foul, the TMO and the scuffle give cards of their own */
export const CARD_SHARE = 0.75
/** the strength each missing man (bin, red, unreplaced) takes from a side */
export const MAN_DOWN = 0.1
/** what the card from the discipline roll was for: words only */
export const YC_REASONS = ['comm.yellowCard', 'comm.ycHigh', 'comm.ycKnockOn', 'comm.ycOffsideRepeat', 'comm.ycShoulder', 'comm.ycTrip']
/** GARBAGE TIME FOR THE INCIDENTS TOO: a side more than four converted tries
 *  up takes its foot off, so the intercept and the penalty try damp the way
 *  the scoring roll does (blowprobe: without it the far tail of mismatches
 *  reached 40 in 20,000 past 90 points) */
export function leadDamp(scoring: SideCtx, other: SideCtx): number {
  const lead = scoring.score - other.score
  return lead > 28 ? Math.max(0.2, Math.pow(28 / lead, 1.4)) : 1
}
/** a man by position, weighted, off the given stream */
export function manFor(r: Rng, ps: Player[], w: Partial<Record<Pos, number>>, agg = 0): Player | null {
  if (!ps.length) return null
  return wpick(r, ps, ps.map(p => (w[p.pos] ?? 0.3) * (1 + agg * (p.a.agg - 10) / 10)))
}

/**
 * ---- WHAT THE PENALTY WAS FOR (item 18, and 24, 25, 40, 44, 45, 46) ----
 *
 * Every broadcast names the offence and this engine never did: "PENALTY to
 * Leicester" and nothing about why. Named now, and named from what the side
 * giving it away is doing: a rush defence is penalised for offside, a side
 * contesting every ruck for hands in it, a pack going backwards at the scrum
 * for collapsing. A fussy breakdown referee blows more of the ruck offences.
 * Words only, on crng: the penalty happened either way.
 */
type Offence =
  | 'offsideLine' | 'offsideRuck' | 'sideEntry' | 'handsRuck' | 'offFeet' | 'notRelease' | 'notRoll'
  | 'highTackle' | 'scrumCollapse' | 'scrumAngle' | 'scrumBind' | 'scrumKnee' | 'scrumEarly'
  | 'maulCollapse' | 'lineoutBarge' | 'lineoutThrough' | 'lifterAcross' | 'offsideKick' | 'boxKick10'
  | 'pullBack' | 'beyondRuck' | 'noBall'
const OFFENCE_MEN: Record<Offence, Partial<Record<Pos, number>>> = {
  offsideLine: { CE: 3, WG: 2, FH: 1, FL: 1.5, FB: 0.6 }, offsideRuck: { FL: 2, N8: 1.5, LK: 1.5, CE: 1 },
  sideEntry: { FL: 2, LK: 2, HK: 1.5, N8: 1.5, LP: 1, TP: 1 }, handsRuck: { FL: 3, N8: 2, HK: 1.5, CE: 1 },
  offFeet: { FL: 3, HK: 2, N8: 1.5, LK: 1.2, CE: 0.8 }, notRelease: { CE: 2, FL: 2, LK: 1.5, WG: 1, FB: 1 },
  notRoll: { LK: 2, FL: 2, LP: 1.5, TP: 1.5, HK: 1, CE: 1 }, highTackle: { LK: 2, FL: 2, CE: 2, LP: 1, TP: 1, HK: 1 },
  scrumCollapse: { LP: 3, TP: 3, HK: 1 }, scrumAngle: { LP: 2, TP: 3 }, scrumBind: { LP: 3, TP: 2, HK: 1 },
  scrumKnee: { LP: 3, TP: 3 }, scrumEarly: { LP: 2, TP: 2, HK: 2 },
  maulCollapse: { LK: 3, FL: 2, HK: 1, N8: 1 }, lineoutBarge: { LK: 3, FL: 2, N8: 1 },
  lineoutThrough: { LK: 2, FL: 2, N8: 2 }, lifterAcross: { LP: 3, TP: 3, FL: 1 },
  offsideKick: { CE: 2, WG: 2, FL: 1.5, FH: 1 }, boxKick10: { FL: 2, N8: 1.5, WG: 1.5, CE: 1 },
  pullBack: { FL: 2, LK: 1.5, N8: 1.5, HK: 1 }, beyondRuck: { FL: 2, LK: 2, HK: 1.5, N8: 1.5 },
  noBall: { CE: 2, FL: 2, WG: 1.5, LK: 1 },
}
const SCRUM_OFFENCES = new Set<Offence>(['scrumCollapse', 'scrumAngle', 'scrumBind', 'scrumKnee', 'scrumEarly'])

function pickOffence(state: GameState, ctx: LiveCtx, off: SideCtx, att: SideCtx): Offence {
  const tac = state.clubs[off.teamId]?.tactic
  const rush = clamp(((tac?.defLine ?? 50) - 50) / 50, -1, 1)
  const contest = clamp(((tac?.ruckContest ?? 50) - 50) / 50, -1, 1)
  const fussy = clamp(2 - refFor(ctx.fx.id).breakdown, 0.7, 1.3)
  const scrumDown = clamp(att.units.scrum / Math.max(1, off.units.scrum), 0.7, 1.5)
  const attUp = upOf(ctx, att)
  const W: [Offence, number][] = [
    ['offsideLine', 1.1 + 1.4 * Math.max(0, rush)], ['offsideRuck', 0.7], ['sideEntry', 0.7 * fussy],
    ['handsRuck', (1 + 0.9 * Math.max(0, contest)) * fussy], ['offFeet', (0.9 + 0.5 * Math.max(0, contest)) * fussy],
    ['notRelease', 0.9 * fussy], ['notRoll', attUp > 78 ? 1.3 : 0.6], ['highTackle', 0.45 * (1 + (off.aggF ?? 0))],
    // no scrum offences at an uncontested scrum: the packs do not engage
    ['scrumCollapse', ctx.uncontested ? 0 : 0.7 * scrumDown * scrumDown], ['scrumAngle', ctx.uncontested ? 0 : 0.25 * scrumDown],
    ['scrumBind', ctx.uncontested ? 0 : 0.25 * scrumDown], ['scrumKnee', ctx.uncontested ? 0 : 0.18 * scrumDown], ['maulCollapse', attUp > 68 ? 0.8 : 0.1], ['lineoutBarge', 0.18],
    ['lineoutThrough', 0.14], ['lifterAcross', 0.1], ['offsideKick', 0.3], ['boxKick10', attUp < 40 ? 0.35 : 0.1],
    ['pullBack', 0.12], ['beyondRuck', 0.28], ['noBall', 0.22],
  ]
  const tot = W.reduce((s, [, w]) => s + w, 0)
  let x = ctx.crng() * tot
  for (const [o, w] of W) { x -= w; if (x < 0) return o }
  return 'offsideLine'
}

/** the offence named, on the commentary's dice, before the kick decision */
export function describeOffence(state: GameState, ctx: LiveCtx, off: SideCtx, att: SideCtx) {
  if (!ctx.detail) return
  const o = pickOffence(state, ctx, off, att)
  const ps = onField(state, off)
  const w = OFFENCE_MEN[o]
  let p: Player | null = null
  if (ps.length) {
    let x = ctx.crng() * ps.reduce((s, q) => s + (w[q.pos] ?? 0.2), 0)
    for (const q of ps) { x -= w[q.pos] ?? 0.2; if (x < 0) { p = q; break } }
  }
  const v = { team: teamShort(state, off.teamId), opp: teamShort(state, att.teamId), player: p?.name ?? teamShort(state, off.teamId) }
  colour(state, ctx, off, `comm.off_${o}${1 + Math.floor(ctx.crng() * 2)}`, v, p?.id)
  // a second scrum offence after a free kick is the full arm (item 49)
  if (SCRUM_OFFENCES.has(o) && (off.scrumFK ?? 0) > 0) colour(state, ctx, off, 'comm.offFullArm', v)
}

/** the referee and the captain: the warning before the bin, the final one
 *  before the second, and now and then a skipper asking for a word */
export function describeWarning(state: GameState, ctx: LiveCtx, off: SideCtx, binAt: number) {
  if (!ctx.detail) return
  const cap = captainOf(state, off)
  const v = { team: teamShort(state, off.teamId), player: cap?.name ?? teamShort(state, off.teamId), n: off.consPens }
  if (binAt >= 3 && off.consPens === binAt - 1) {
    off.warned = (off.warned ?? 0) + 1
    colour(state, ctx, off, `comm.refWarn${1 + Math.floor(ctx.crng() * 3)}`, v, cap?.id)
  } else if (off.consPens === binAt * 2 - 1) {
    colour(state, ctx, off, 'comm.refWarnFinal', v, cap?.id)
  } else if (off.consPens >= 3 && ctx.crng() < 0.12) {
    colour(state, ctx, off, `comm.capTalk${1 + Math.floor(ctx.crng() * 3)}`, v, cap?.id)
  }
}
