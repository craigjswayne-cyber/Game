// THE WORLD FROM THE TEAM SHEETS (2.0.0 stage 2, docs/match-sim-spec.md
// section 3.3).
//
// The spec: "The strengths are built from what the engine already computes,
// so selection and tactics keep their meaning." So this file does not work
// out how good a side is. It asks the engine that already knows: beginMatch
// (match/begin.ts) builds the two sides exactly as it does for a real
// kick-off, with the selection, the tactics dials, the referee, the weather,
// the day's form and the team talk all in, and the World below reads the
// result and turns it into "1 is an average side".
//
// IT NEVER TOUCHES THE REAL GAME. beginMatch writes to what it is given: it
// sets fx.weather, fx.derby and fx.att, counts the match into state.chem,
// tallies the called moves onto each club's playbook and settles the
// analyst's read. So it is run on a structuredClone of the state, on the
// clone's own copy of the fixture, with dice of its own. The state and the
// fixture the caller holds are the ones he handed over, and the old engine's
// dice are never drawn (scripts/fingerprint.ts still passes).
import type { Fixture, GameState, Player, Pos } from '../model'
import { mulberry32, wpick, type Rng } from '../rng'
import { beginMatch } from '../match/begin'
import { mkSide } from '../match/setup'
import { sideEnergy } from '../match/energy'
import { fieldChanged, goalKicker, recomputeSideUnits } from '../match/field'
import { applyPreTalk, applyTeamTalk, makeSubstitution } from '../match/control'
import { benchTank } from '../match/subs'
import { styleWx } from '../conditions'
import { kickChance } from '../match/kicking'
import { clutchKick } from '../habits'
import { clamp } from '../rng'
import { specialistGaps, teamName, teamUnits } from '../match/selection'
import { effAt } from '../attributes'
import { fieldLineup } from '../match/side'
import type { SideCtx } from '../match/side'
import type { LiveCtx } from '../match/live'
import { NEUTRAL_STYLE, type Contest, type Decision, type ManForm, type PlayStyle, type World } from './world'
import { MATCHUP, styleTick, stylesOf, type AtkStyle, type DefStyle } from '../styles'
import { callsOf } from '../moves'
import { chemKey, type Tactic } from '../model'

/** a side as a reader needs it, to print names: the starting 15 in shirt order, then the bench */
export interface SimSide {
  teamId: string
  name: string
  /** the club's captain (player id), when it has one */
  captain?: string
  players: { id: string; name: string; shirt: number }[]
}

/** The World this file builds. It is a World, and it also answers the one
 *  question the interface cannot ask: the ruck is a different contest for
 *  the side with the ball (ruckSecure protects it) and the side without
 *  (ruckContest attacks it), and `str` is not told who has the ball. */
export interface MatchWorld extends World {
  /** side s's strength at the ruck, knowing whether it has the ball */
  ruck(s: 0 | 1, hasBall: boolean, t: number): number
  /** the clock, for a caller that wants to pick a player before it has asked for a strength */
  setClock(t: number): void
}

/**
 * HOW A UNIT BECOMES A STRENGTH. The engine's units run at about 15 to 20
 * and the simulation wants 1 for an average side and about 1.10 for a
 * clearly better one, so a unit u in a league whose sides average m becomes
 * (u / m) ^ GAMMA.
 *
 * OBSERVED (scripts/simworld.ts over seeds 4242, 777, 424242, 1 and 99, the
 * user's first league fixture, both sides, at kick-off): the units of the
 * sides in a league sit within about 8% of the league's mean, and at 1.6
 * the unit strengths ran from 0.84 to 1.21, with nine in ten between 0.90
 * and 1.12. The widest are kicking and goal, which hang on one or two men.
 */
// TUNED 21 Nov against the old engine (scripts/paritycheck.ts 40 150): at
// 1.6 the stronger side won by 1.58 x the old engine's margin; at 1.0 the
// slope is 1.03 and home wins are 53.2% against 52.3%.
export const GAMMA = 1.0

/** HOME ADVANTAGE. In the old engine ctx.hfa (about 1.08, venue.ts
 *  HOME_EDGE, moved by the trip, the crowd and the pitch in begin.ts) is a
 *  straight multiplier on the home side's attack and on nothing else
 *  (tick.ts: `ratio = att * adv * numF * terr / def`, adv = ctx.hfa for the
 *  home side and 1 for the away side; and resolveContest gets hfa and
 *  1 / hfa). Here the same edge is shared between the home side's ball and
 *  its defence: every open-play and set-piece contest gets hfa ^ HFA_SHARE,
 *  so home attack against away defence is up by root hfa and away attack
 *  against home defence is down by root hfa, and the gap between the two
 *  sides is the old engine's hfa. It is not put through GAMMA: it is
 *  already an edge on the result, not a rating. Kicks at goal and
 *  discipline get none: the old engine gives the kicker none, and the home
 *  crowd's lean on the whistle is already inside refPenF. */
// 0.45 from 0.5 (22 Nov): with the units above, 0.5 left the new home margin
// 0.7 points over the old engine's across the parity pairings, and 0.42 left
// it 0.2 under.
// 0.48 from 0.45 (round 6), on a balanced set (scripts/tmp/gp/home.ts: one round of every league in
// a game, 56 fixtures, each home and away club once, 100 matches each): old engine 56.8% home wins
// and +4.12 points; new 56.3% and +3.55 at 0.45, 58.2% and +4.40 at 0.5.
export const HFA_SHARE = 0.48

/** THE LATE FADE. The old engine multiplies a side's attack and defence by
 *  0.78 + 0.22 x (average energy / 100) (tick.ts eF). This World is built
 *  at kick-off and nobody drains its tanks, so the tank is run down in a
 *  straight line instead: a side on normal tempo ends the match with
 *  END_TANK of what it kicked off with (the old engine's sides average
 *  about 80 at kick-off and 21 at the final whistle, energy.ts DRAIN_HT_K),
 *  faster for a high tempo (tempoF) or a hard fitness week (drainF). The
 *  figure is divided by the same figure for a full tank at kick-off, so a
 *  fresh side is 1 at t = 0 and every side fades from there. What it does
 *  NOT know: replacements (fresh legs off the bench), the half-time
 *  recovery, or the old engine's steeper last quarter (LATE_FLOOR). Those
 *  belong to the simulation once it runs its own tanks per man. */
export const FADE_W = 0.22
export const LATE_FLOOR = 0.55, LATE_FROM_S = 3360
export const END_TANK = 0.27

/** the units a strength is read from, and the league's mean of each */
export type UnitKey = 'scrum' | 'lineout' | 'breakdown' | 'attack' | 'defence' | 'kicking' | 'goal' | 'overall'
const UNIT_KEYS: UnitKey[] = ['scrum', 'lineout', 'breakdown', 'attack', 'defence', 'kicking', 'goal', 'overall']
export type LeagueMeans = Record<UnitKey, number> & { penRisk: number; energy: number; n: number; lean: number }

/** a fifteen's lean, backs against pack: the log of its attack over its tight five and back row's
 *  set piece and breakdown, from its own men before any dial (selection.ts teamUnits) */
export function leanOf(state: GameState, lineup: (number | null)[]): number {
  const u = teamUnits(state, lineup)
  return Math.log(Math.max(1e-6, u.attack)) - Math.log(Math.max(1e-6, Math.cbrt(u.scrum * u.lineout * u.breakdown)))
}

/**
 * THE AVERAGE SIDE, MEASURED AND NOT ASSUMED: every side in the fixture's
 * competition, built the way a kick-off builds one (mkSide: the sheet each
 * coach would name today, with his tactics dials in the units), and the mean
 * of each unit across them. For a friendly, or a competition too small to
 * have a mean worth the name, the two sides' own leagues are the yardstick
 * (every club in the world only when neither side has a league).
 *
 * Built on the clone, because mkSide reads through to the same places
 * beginMatch writes. What the mean does NOT include is what beginMatch adds
 * for this one match: the referee's dials, the weather, the day's form. So
 * on a wet day under a fussy whistle both sides can read a little under 1
 * at the same contest, which is the truth of that afternoon.
 */
function leagueMeans(clone: GameState, fx: Fixture): LeagueMeans {
  const inComp = (clone.comps[fx.compId]?.teamIds ?? []).filter(id => clone.clubs[id] || clone.natSquads[id])
  // a friendly or a small cup: the two sides' own leagues are the yardstick,
  // so two top-flight clubs meeting in a friendly read about 1, not 1.4
  const own = [fx.homeId, fx.awayId].flatMap(id => clone.comps[clone.clubs[id]?.leagueId ?? '']?.teamIds ?? [])
    .filter((id, i, a) => a.indexOf(id) === i && (clone.clubs[id] || clone.natSquads[id]))
  const ids = inComp.length >= 6 ? inComp : own.length >= 6 ? own : Object.keys(clone.clubs)
  const sum: LeagueMeans = { scrum: 0, lineout: 0, breakdown: 0, attack: 0, defence: 0, kicking: 0, goal: 0, overall: 0, penRisk: 0, energy: 0, n: 0, lean: 0 }
  for (const id of ids) {
    const side = mkSide(clone, id, clone.userClubId, fx.id, false)
    for (const k of UNIT_KEYS) sum[k] += side.units[k]
    sum.penRisk += side.penRisk
    sum.energy += sideEnergy(side)
    sum.lean += leanOf(clone, side.lineup.slice(0, 15))
    sum.n++
  }
  const n = Math.max(1, sum.n)
  for (const k of UNIT_KEYS) sum[k] /= n
  sum.penRisk /= n
  sum.energy /= n
  sum.lean /= n
  return sum
}

// ---- WHO DOES IT: weights by shirt number, 1 to 15 ------------------------
//
// The pickers name a man by the shirt he wears, because that is what a
// reader of the match recognises: the back row and the hooker carry most of
// the tight ball, the wings and centres the wide ball, the flankers are over
// it at the ruck. A weight of 0 means "not his job"; if nobody with a weight
// is on the field (cards), anybody who is on it does the job.
//                        1    2    3    4    5    6    7    8    9   10   11   12   13   14   15
const W_CARRY_TIGHT = [1.6, 2.2, 1.6, 1.8, 1.8, 2.6, 2.4, 3.2, 0.2, 0.3,   0, 0.9, 0.5,   0,   0]
const W_CARRY_WIDE  = [  0, 0.2,   0,   0, 0.1, 0.4, 0.5, 0.6, 0.2, 0.8, 3.0, 2.0, 2.4, 3.0, 2.4]
// (the tight tacklers are the old engine's own tackle shares for the pack, field.ts SLOT_TACKLES)
const W_TACKLE_TIGHT = [ 7,  10,   7,  11,  11,  13,  14,  11,   2,   3,   0,   4,   2,   0,   0]
const W_TACKLE_WIDE  = [ 0,   0,   0,   0,   0,   2,   3,   2,   2,   6,   6,  10,  10,   6,   5]
const W_JACKAL      = [0.4, 2.0, 0.3, 0.5, 0.5, 2.6, 3.4, 2.2,   0,   0,   0, 1.6, 0.8,   0,   0]
const W_KICK_OPEN   = [  0,   0,   0,   0,   0,   0,   0,   0, 0.3, 6.5,   0, 1.2,   0,   0, 2.0]
const W_KICK_BOX    = [  0,   0,   0,   0,   0,   0,   0,   0,  10, 0.5,   0,   0,   0,   0, 0.3]
const W_CATCH       = [  0,   0,   0,   0,   0,   0,   0, 0.2, 0.2, 0.8, 2.6, 0.2, 0.3, 2.6, 4.2]
const W_JUMP        = [  0,   0,   0, 3.4, 3.4, 2.4, 0.9, 0.9,   0,   0,   0,   0,   0,   0,   0]
const W_FORWARD     = [  1,   1,   1,   1,   1,   1,   1,   1,   0,   0,   0,   0,   0,   0,   0]
const W_ANYONE      = [  1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1]

const clampStr = (v: number) => Math.max(0.6, Math.min(1.5, v))

/** HOW MUCH EACH UNIT COUNTS, on top of GAMMA: a unit u becomes (u / m) ^ (GAMMA x UNIT_EXP[unit]).
 *  1 for every unit until 21 Nov; see the note at the value for how each was set. */
//
// SET 21 Nov from what each unit is worth to the margin in each engine
// (scripts/tmp/gp/sens.ts: the home side's unit raised 10% and held there
// through every recompute, the same seeds paired, 6 fixtures x 300 matches).
// Change in the home margin, old engine / new at exponent 1: attack 1.67 /
// 2.56, defence 2.25 / 2.47, breakdown 1.50 / 2.39, scrum 0.39 / 0.36,
// lineout 0.33 / 0.42, kicking 1.19 / 1.62 (goal and overall 0 / 0). Matching
// each unit exactly (exponent = old / new) took the slope of the new margin
// on the old across the parity pairings from 0.96 to 0.77: the old engine's
// better sides win by more than their units alone are worth to it (its
// styles, zone plans, called moves, player-by-player contests and benches
// lean the same way as the units, and the new simulation has none of them
// yet). So the exponents keep the old engine's RATIOS between the units and
// are scaled up together until the slope is back at 1: old / new x 1.3.
// On the 40 parity pairings (scripts/tmp/gp/newonly.ts, 300 new matches
// each against the stored old numbers) the mean gap in home margin went
// from 2.25 to 2.05 points and the rms from 2.83 to 2.75, slope 0.98.
// THEN KICKING, ON ITS OWN (second parity run, 22 Nov). The pairings still
// furthest apart were the ones with the widest gap in kicking units
// (Washington 15.1 v New England 10.3: old margin 1.9, new 6.3; Canberra
// 18.2 v Wellington 12.9: 3.6 v 10.8). Kicking is the unit with the widest
// spread between sides (sd of the log ratio 0.17, the others 0.09 to 0.13:
// it hangs on one or two men), and the old engine turns it into territory
// through a log and a pull back to halfway, so a big gap is worth less to
// it than a straight line says. Kicking down to 0.62 and the rest scaled up
// 1.12 to hold the slope: rms of the margin gap 2.70 to about 2.35 on the
// 40 pairings, slope 0.94 to 1.01 across the two runs either side of this.
// (Tuned against the same 40 pairings it is measured on: the old engine's
// own 150-match noise, about 1.4 points of margin, is in the target.)
// ROUND 6: all of them times 0.8. The 1.3 above made up for what the new engine did not have (styles,
// moves, the men themselves); now it has them, a change across a whole XV (form 3 against 8) was worth
// 1.6 times what it is in the old engine, and across the parity pairings the per-fixture margin gap
// fell from 3.8 to 3.1 points (rms, scripts/tmp/gp/newonly.ts) at a slope of 0.86 to 0.93.
export const UNIT_EXP: Record<UnitKey, number> = { scrum: 1.14, lineout: 0.92, breakdown: 0.73, attack: 0.76, defence: 1.04, kicking: 0.5, goal: 1, overall: 1 }

/** HOW HARD THE STYLES LEAN (round 4): the kicking dial's reach on how often a side kicks (a dial
 *  of 50 + STYLE_KICK doubles it), the style dial's reach on how often it goes wide (the share runs
 *  from 1 - STYLE_WIDTH / 2 to 1 + STYLE_WIDTH / 2 of the average), and its reach on mauls and the
 *  pick and go. Set so two clubs look different and still score what the old engine says they do. */
/** HOW MUCH THE MAN NAMED IN A PLAY MATTERS against his side's average (round 5, owner: "everything
 *  in the game is affected by the decisions of the manager"): his own rating for the job relative to
 *  his side's, to this power, and how much his own tank (tired, or fresh off the bench) moves him */
export const MAN_W = 0.35, MAN_FADE = 0.5, FORM_DAMP = 0.32
/** a half-time talk's lift: this many times the old engine's own effect on the men, fading to nothing over this many seconds */
export const TALK_GAIN = 3, TALK_SPELL_S = 1200
/** the pre-match talk, kept for the whole match at this share of the old engine's effect on the units
 *  (at the full size the best and worst talk before kick-off were 12.9 win % apart on the lever table, at 0.35 5.9) */
export const PRE_TALK_GAIN = 0.25
/** take the old engine's style-dial and line-speed leans off the units (fromMatch dialLean) */
export const DIAL_NEUTRAL = true

/** THE SHIRT EACH MAN KNOWS (round 7, owner: a lock at 13 should cost about
 *  half a prop on the wing). The old units already charge a man for the shirt
 *  he wears (a lock has no pace for 13, a wing no tight-five strength), and
 *  this world's units are steeper than the old engine's, so every swap cost
 *  2 to 5 times what it did there. The game's own familiarity (effAt: his
 *  position 1, a listed second position 0.92, a near position 0.8, anything
 *  else 0.55) says how much of that loss is kept: SHIRT_KEEP by the least
 *  familiar man in the XV, and all of it for a non-specialist at prop, hooker
 *  or nine (specialistGaps), which stays the absurd case. */
/** WHO THE PLAN SUITS (round 7, owner: no style simply better; a strong pack suits direct and the
 *  drive, quick backs suit width). A tight carry is the pack's and a wide one the backs': each is
 *  times exp(+-b x z), z the fifteen's lean (leanOf) against its league's in sds of the world's
 *  squads (sd, measured over the Premiership: 0.106), held to +-z. 1 for a level squad. */
export const FIT = { b: 0.02, sd: 0.106, z: 2 }
export const SHIRT_KEEP = { alt: 0.25, near: 0.3, odd: 0.55, specialist: 1 }
const SHIRTS: Pos[] = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'WG', 'CE', 'CE', 'WG', 'FB']
type ShirtCost = { loss: Record<UnitKey, number>; keep: number }
const NO_SHIRT_COST: ShirtCost = { loss: { scrum: 1, lineout: 1, breakdown: 1, attack: 1, defence: 1, kicking: 1, goal: 1, overall: 1 }, keep: 1 }
/** how much of a man's own edge or shortfall counts in a shirt: all of it in his own, or for anybody at
 *  prop, hooker or nine who is not one; SHIRT_KEEP by his familiarity otherwise */
function shirtKeep(p: Player, slot: number): number {
  const fam = effAt(p, SHIRTS[slot]) / Math.max(1e-6, p.ca)
  if (fam >= 0.999) return 1
  if (specialistGaps(Array.from({ length: 15 }, (_, i) => (i === slot ? p : null))).length) return SHIRT_KEEP.specialist
  return fam >= 0.92 ? SHIRT_KEEP.alt : fam >= 0.8 ? SHIRT_KEEP.near : SHIRT_KEEP.odd
}
function shirtCost(state: GameState, lu: (number | null)[], unitsOf: (own: (number | null)[]) => SideCtx['units'], now: SideCtx['units']): ShirtCost {
  const men = lu.map(id => (id != null ? state.players[id] : undefined))
  let fam = 1
  men.forEach((p, i) => { if (p) fam = Math.min(fam, effAt(p, SHIRTS[i]) / Math.max(1e-6, p.ca)) })
  if (fam >= 0.999) return NO_SHIRT_COST
  // the same men in their own shirts: first by position, then by a listed
  // second position, the rest where they stand
  const own: (number | null)[] = Array(15).fill(null)
  const left = new Set(lu.map((_, i) => i))
  const place = (fits: (p: Player, pos: Pos) => boolean) => {
    for (const i of [...left]) {
      const p = men[i]
      if (!p) continue
      const j = SHIRTS.findIndex((pos, j) => own[j] == null && fits(p, pos))
      if (j >= 0) { own[j] = lu[i]; left.delete(i) }
    }
  }
  place((p, pos) => p.pos === pos)
  place((p, pos) => p.alt.includes(pos))
  for (const i of [...left]) { const j = own.indexOf(null); if (j >= 0) { own[j] = lu[i]; left.delete(i) } }
  const keep = specialistGaps(men).length ? SHIRT_KEEP.specialist
    : fam >= 0.92 ? SHIRT_KEEP.alt : fam >= 0.8 ? SHIRT_KEEP.near : SHIRT_KEEP.odd
  if (keep >= 1) return NO_SHIRT_COST
  const a = now, b = unitsOf(own)
  const loss = {} as Record<UnitKey, number>
  for (const k of Object.keys(NO_SHIRT_COST.loss) as UnitKey[]) loss[k] = Math.min(1, a[k] / Math.max(1e-6, b[k]))
  return { loss, keep }
}
/** the old engine's own penalty lean for each defence (styles.ts DEF_FX penF, not exported there) */
const DEF_PEN: Record<DefStyle, number> = { drift: 0.94, blitz: 1.08, pendulum: 0.98, man: 1.0, choke: 1.02 }
export const STYLE_KICK = 80, STYLE_WIDTH = 0.45, STYLE_PACK = 0.4, STYLE_MAUL = 1.0

export interface FromMatchOpts {
  /** for measuring only: change the kicked-off sides (on the private copy) before the world reads them */
  tweak?: (ctx: LiveCtx) => void
  /** for tuning only: exponents to use in place of UNIT_EXP, and a home share in place of HFA_SHARE */
  exp?: Partial<Record<UnitKey, number>>
  hfaShare?: number
}

export function worldFromMatch(state: GameState, fx: Fixture, rng: Rng, opts: FromMatchOpts = {}): { world: MatchWorld; home: SimSide; away: SimSide } {
  // the real game is copied whole and the copy is what kicks off
  const clone = structuredClone(state)
  const fxc = clone.fixtures.find(f => f.id === fx.id)
  if (!fxc) throw new Error(`fixture ${fx.id} is not in this game`)
  // the average side first, while the clone is still as the week left it
  const mean = leagueMeans(clone, fxc)
  // beginMatch draws from the dice it is given (the gate, the kick seed):
  // they are ours, seeded off the caller's, never the week's
  const ctx = beginMatch(clone, fxc, mulberry32((Math.floor(rng() * 4294967296) >>> 0) || 1), false)
  opts.tweak?.(ctx)
  const sides: [SideCtx, SideCtx] = [ctx.home, ctx.away]

  /** the fifteen shirts at kick-off (after any warm-up withdrawal), by index 0 to 14 */
  const shirts = sides.map(s => s.lineup.slice(0, 15)) as [(number | null)[], (number | null)[]]
  /** who is off, and the clock second he comes back (Infinity for a red) */
  const off: [Map<string, number>, Map<string, number>] = [new Map(), new Map()]
  /** the latest clock the simulation has shown us. The pickers are not told
   *  the time, and `str` is asked on every contest, so it keeps the clock. */
  let now = 0

  const exps = { ...UNIT_EXP, ...opts.exp }
  /** a half-time talk's spell on each side: the units before and after it, and when it was given */
  type Spell = { t0: number; before: SideCtx['units']; after: SideCtx['units'] }
  const spell: [Spell | null, Spell | null] = [null, null]
  /** the pre-match talk's effect on each unit (after over before), kept at PRE_TALK_GAIN of the old engine's size */
  const preTalk: [Partial<Record<UnitKey, number>> | null, Partial<Record<UnitKey, number>> | null] = [null, null]
  /** the old engine's own lean of two dials on the units (setup.ts applyModifiers: the style dial on the
   *  attack, scrum and breakdown, line speed on the defence), which this simulation plays out itself
   *  (PlayStyle width, maul, pick, blitz), so it is taken back off here and not counted twice. What a
   *  plan the squad cannot play costs (styleMisfit) stays: that is the squad's fit. */
  const dialLean = (s: 0 | 1, k: UnitKey) => {
    const tac = clone.clubs[sides[s].teamId]?.tactic as Partial<Tactic> | undefined
    if (!tac) return 1
    const f = (v: number | undefined) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v as number)) - 50 : 0) / 50
    const st = f(tac.style), dl = f(tac.defLine ?? 50)
    return k === 'attack' ? 1 + st * 0.06 : k === 'scrum' ? 1 - st * 0.05 : k === 'breakdown' ? 1 - st * 0.03 : k === 'defence' ? 1 + dl * 0.04 : 1
  }
  const unitOf = (s: 0 | 1, k: UnitKey) => {
    let u = sides[s].units[k] / (DIAL_NEUTRAL ? dialLean(s, k) : 1)
    // the units now carry the talks at the old engine's size (its talk factors stay on the men through
    // every rebuild, a replacement's included): take each back to its own size here
    const pr = preTalk[s]?.[k]
    if (pr) u *= Math.pow(pr, PRE_TALK_GAIN - 1)
    const sp = spell[s]
    if (sp) {
      const w = Math.max(0, 1 - (now - sp.t0) / TALK_SPELL_S)
      u *= Math.pow(sp.after[k] / Math.max(1e-6, sp.before[k]), TALK_GAIN * w - 1)
    }
    return u
  }
  /** what playing men out of position costs each unit (the units against the
   *  same fifteen men in their own shirts), and how much of it to keep: a
   *  plausible swap keeps part, a non-specialist in the front row or at nine
   *  keeps all (shirtCost) */
  const shirtMemo: [Map<string, ShirtCost>, Map<string, ShirtCost>] = [new Map(), new Map()]
  const shirtOf = (s: 0 | 1): ShirtCost => {
    const lu = fieldLineup(sides[s]).slice(0, 15)
    const key = lu.join(',')
    let c = shirtMemo[s].get(key)
    if (!c) {
      c = shirtCost(clone, lu, own => {
        // the same side with the men in their own shirts, through the old engine's own
        // modifiers as well (a plan that no longer fits the squad costs it there too)
        const copy = { ...sides[s], lineup: [...own, ...sides[s].lineup.slice(15)], hia: null } as SideCtx
        recomputeSideUnits(clone, ctx, copy)
        return copy.units
      }, sides[s].units)
      shirtMemo[s].set(key, c)
    }
    return c
  }
  const unitStr = (s: 0 | 1, k: UnitKey) => {
    const c = shirtOf(s)
    return Math.pow(unitOf(s, k) / Math.max(1e-6, mean[k]), GAMMA * exps[k])
      * (c.keep < 1 ? Math.pow(c.loss[k], GAMMA * exps[k] * (c.keep - 1)) : 1)
  }
  const hfaShare = opts.hfaShare ?? HFA_SHARE
  const hfa = (s: 0 | 1) => (s === 0 ? Math.pow(ctx.hfa, hfaShare) : 1)
  // each shirt's tank when its man came on, and the second he came on (0 for a starter), so a
  // replacement brings fresh legs and the fade is the fifteen men on the field now
  const tank0 = sides.map(side => shirts[sides.indexOf(side)].map(id => (id == null ? 70 : side.energy.get(id) ?? 70) / 100))
  const onAt = [Array(15).fill(0), Array(15).fill(0)] as [number[], number[]]
  /** the side's average tank now, 0 to 1 */
  const legsOf = (s: 0 | 1, t: number) => {
    const side = sides[s], rate = (1 - END_TANK) * side.tempoF * side.drainF
    let e = 0
    for (let i = 0; i < 15; i++) e += tank0[s][i] * Math.max(0, 1 - Math.min(1, Math.max(0, t - onAt[s][i]) / 4800) * rate)
    return e / 15
  }
  // THE LAST QUARTER (round 5, as tick.ts eF): from the 56th minute a tank counts for far more
  // (LATE_FLOOR 0.55 + 0.45 x tank, against 0.78 + 0.22 x tank before it), which is what makes the
  // bench matter in the old engine: a side that never changes is a side on empty legs
  const fade = (s: 0 | 1, t: number) => {
    const e = legsOf(s, t), w = t >= LATE_FROM_S ? 1 - LATE_FLOOR : FADE_W
    return (1 - w + w * e) / (1 - FADE_W + FADE_W * (mean.energy / 100))
  }
  /** the bench men already used, who cannot come on again */
  const used: [Set<number>, Set<number>] = [new Set(), new Set()]
  /** the men taken off, who cannot come back on (the bench slot he leaves holds his id) */
  const gone: [Set<number>, Set<number>] = [new Set(), new Set()]
  /** EVERY MATCH ON THIS WORLD STARTS AT THE KICK-OFF IT WAS BUILT AT (newMatch). A decision
   *  changes the private copy; the first one in a match takes a copy of what it changes, and
   *  newMatch puts it all back, so a World can be handed to match after match. */
  const shirts0 = shirts.map(a => a.slice()) as typeof shirts
  const tank00 = tank0.map(a => a.slice())
  let saved: { sides: unknown[]; tactics: unknown[]; ctx: Record<string, unknown> } | null = null
  const CTX_KEYS = ['subsUsed', 'lastSub', 'talkUsed', 'htTone', 'htReads', 'lastMin', 'preTalk', 'preReads'] as const
  const keep = () => {
    if (saved) return
    saved = {
      sides: sides.map(sd => structuredClone({ ...sd })),
      tactics: sides.map(sd => structuredClone(clone.clubs[sd.teamId]?.tactic ?? null)),
      ctx: Object.fromEntries(CTX_KEYS.map(k => [k, structuredClone((ctx as unknown as Record<string, unknown>)[k])])),
    }
  }
  const newMatch = () => {
    for (const m of off) m.clear()
    for (const u of used) u.clear()
    for (const g2 of gone) g2.clear()
    for (const s of [0, 1] as const) { shirts[s] = shirts0[s].slice(); tank0[s] = tank00[s].slice(); onAt[s].fill(0) }
    injured[0].clear(); injured[1].clear()
    spell[0] = null; spell[1] = null; preTalk[0] = null; preTalk[1] = null; shirtMemo[0].clear(); shirtMemo[1].clear()
    if (!saved) return
    const sv = saved
    sides.forEach((sd, i) => {
      const snap = structuredClone(sv.sides[i]) as Record<string, unknown>
      const live = sd as unknown as Record<string, unknown>
      for (const k of Object.keys(live)) if (!(k in snap)) delete live[k]
      Object.assign(live, snap)
      const club = clone.clubs[sd.teamId]
      if (club && sv.tactics[i]) club.tactic = structuredClone(sv.tactics[i]) as typeof club.tactic
    })
    Object.assign(ctx, structuredClone(sv.ctx))
    saved = null
    styles = [buildStyle(0), buildStyle(1)]
  }
  /** men taken off hurt and not yet replaced */
  const injured: [Set<number>, Set<number>] = [new Set(), new Set()]
  const isUserSide = (s: 0 | 1) => ctx.userSideId != null && sides[s].teamId === ctx.userSideId
  /** THE MANAGER'S HAND on the private copy, through the old engine's own functions where it has them.
   *  It changes this World for good: after a decision, build a new World for the next match. */
  const decide = (d: Decision, t: number, score?: [number, number]): string => {
    now = t
    if (d.kind === 'world' || d.kind === 'strength' || d.kind === 'penaltyCall') return 'not a decision for the World'
    if (d.kind === 'bench') return ''
    const s = d.side, side = sides[s], min = Math.min(79, Math.max(1, Math.floor(t / 60)))
    keep()
    ctx.lastMin = min
    if (d.kind === 'injury') {
      const id = Number(d.who)
      if (!shirts[s].includes(id) || isOff(s, id)) return 'not on the field'
      injured[s].add(id)
      off[s].set(String(id), Infinity)
      return ''
    }
    if (d.kind === 'substitution') {
      const outId = Number(d.off), inId = Number(d.on)
      const slot = shirts[s].indexOf(outId)
      if (slot < 0) return 'not on the field'
      const hurt = !!d.injury && injured[s].has(outId)
      if (!hurt && isOff(s, outId)) return 'in the bin or sent off'
      const benchAt = side.lineup.indexOf(inId)
      if (benchAt < 15 || used[s].has(inId) || gone[s].has(inId)) return 'not on the bench'
      if (hurt) { off[s].delete(String(outId)); injured[s].delete(outId) }
      if (isUserSide(s) && !d.auto && !hurt) {
        // the manager's own side: the old engine's makeSubstitution, with every law it checks
        // (the front row, the bin, the count) and its bill for a shirt that does not fit
        makeSubstitution(clone, ctx, outId, inId)
        if (side.lineup[slot] !== inId) return 'refused'
      } else {
        side.lineup[slot] = inId; side.lineup[benchAt] = outId
        side.onPitch.delete(outId); side.onPitch.add(inId)
        side.energy.set(inId, benchTank(clone.players[inId]))
        fieldChanged(clone, ctx, side, min)
      }
      used[s].add(inId); gone[s].add(outId)
      shirts[s][slot] = inId
      if (hurt) off[s].delete(String(outId))
      tank0[s][slot] = (side.energy.get(inId) ?? 70) / 100
      onAt[s][slot] = t
      return ''
    }
    if (d.kind === 'tactics') {
      const tac = clone.clubs[side.teamId]?.tactic as unknown as Record<string, unknown> | undefined
      if (!tac) return 'no club'
      Object.assign(tac, d.set)
      // as applyTacticsChange: the units rebuilt with the new dials; and the way the side plays
      recomputeSideUnits(clone, ctx, side)
      styles = [buildStyle(0), buildStyle(1)]
      return ''
    }
    if (d.kind === 'talk') {
      if (!isUserSide(s)) return 'only the manager gives a talk'
      // the room hears the talk at the real score (the old engine reads the margin into the talk's setting)
      if (score) { sides[0].score = score[0]; sides[1].score = score[1] }
      const before = { ...side.units }
      // before the kick-off it is the pre-match talk (teamtalk.ts PRE_TONES), after it the half-time one
      if (d.pre) {
        const said = applyPreTalk(clone, ctx, d.tone as Parameters<typeof applyPreTalk>[2])
        recomputeSideUnits(clone, ctx, side)
        const r: Partial<Record<UnitKey, number>> = {}
        for (const k of UNIT_KEYS) r[k] = side.units[k] / Math.max(1e-6, before[k])
        preTalk[s] = r
        shirtMemo[s].clear()
        return said && ctx.preTalk !== d.tone ? said : ''
      }
      const said = applyTeamTalk(clone, ctx, d.tone as Parameters<typeof applyTeamTalk>[2])
      recomputeSideUnits(clone, ctx, side)
      // A SPELL, NOT A SETTING (round 7): what the talk did to each man's units is a lift (or a cost)
      // that is felt at once and has gone by TALK_SPELL_S later, TALK_GAIN times the old engine's size
      spell[s] = { t0: t, before, after: { ...side.units } }
      shirtMemo[s].clear()
      styles = [buildStyle(0), buildStyle(1)]
      return said && ctx.htTone !== d.tone ? said : ''
    }
    return 'unknown decision'
  }
  const ruckRaw = (s: 0 | 1, hasBall: boolean | null) => {
    const side = sides[s]
    const sec = side.ruckSecure ?? 1, con = side.ruckContest ?? 1
    // not told who has the ball: a side spends about half its rucks each way
    return unitStr(s, 'breakdown') * (hasBall == null ? (sec + con) / 2 : hasBall ? sec : con)
  }
  const raw = (s: 0 | 1, c: Contest): number => {
    const u = sides[s].units
    switch (c) {
      case 'carry': return unitStr(s, 'attack')
      case 'tackle': return unitStr(s, 'defence')
      case 'breakdown': return ruckRaw(s, null)
      case 'handling': return (unitStr(s, 'attack') + unitStr(s, 'overall')) / 2
      case 'scrum': return unitStr(s, 'scrum')
      case 'lineout': return unitStr(s, 'lineout')
      // the maul is the lineout's ball and the scrum's weight
      case 'maul': return (unitStr(s, 'lineout') + unitStr(s, 'scrum')) / 2
      case 'kicking': return unitStr(s, 'kicking')
      case 'aerial': return (unitStr(s, 'kicking') + unitStr(s, 'defence')) / 2
      case 'goal': return u.goal > 0 ? unitStr(s, 'goal') : 1
      // higher is cleaner. penRisk is the engine's whole price for this side
      // today: its physicality (aggF) priced by this referee (refPenF), its
      // defensive line and its ruck contest, and the home crowd's lean. The
      // league's mean price over this side's price is 1 for an average side
      // under an average whistle. Not through GAMMA: it is already a rate.
      case 'discipline': return mean.penRisk / Math.max(1e-6, sides[s].penRisk)
    }
  }
  // FORM ACROSS A WHOLE XV (round 6): the units carry each man's form (0.9 + 0.02 x form), and a change
  // to all fifteen at once moved the new engine 1.6 times as far as the old one (+25 win % for form 3
  // against 8, old +16). Part of that common shift is taken back, FORM_DAMP of it on the log scale; a
  // man in form against his team-mates still counts in full (World.man).
  const formF = ([0, 1] as const).map(s => {
    const ps = shirts0[s].filter((x): x is number => x != null).map(id => clone.players[id]).filter(Boolean)
    const m = ps.reduce((a, p) => a + (0.9 + 0.02 * (p.form ?? 5)), 0) / Math.max(1, ps.length)
    return Math.pow(m, -FORM_DAMP)
  })
  const str = (s: 0 | 1, c: Contest, t: number): number => {
    now = t
    // a kick at goal is one man and a tee: no crowd, no fade
    if (c === 'goal') return clampStr(raw(s, c))
    // a tired side gives away more, but the crowd is already in refPenF
    if (c === 'discipline') return clampStr(raw(s, c) * fade(s, t))
    return clampStr(raw(s, c) * hfa(s) * fade(s, t) * formF[s])
  }

  const isOff = (s: 0 | 1, id: number) => (off[s].get(String(id)) ?? -1) > now
  /** one man by shirt weight, from those on the field; '' when the side has nobody */
  const pickBy = (s: 0 | 1, w: number[], rng: Rng, not?: string): string => {
    const on: number[] = [], ws: number[] = []
    shirts[s].forEach((id, i) => {
      if (id == null || isOff(s, id) || String(id) === not) return
      on.push(id); ws.push(w[i])
    })
    if (!on.length) return ''
    return String(ws.some(x => x > 0) ? wpick(rng, on, ws) : wpick(rng, on, on.map(() => 1)))
  }
  /** the man in a shirt (1 to 15), or the next best by weight when he is off */
  const inShirt = (s: 0 | 1, shirt: number, fallback: number[]): string => {
    const id = shirts[s][shirt - 1]
    if (id != null && !isOff(s, id)) return String(id)
    // no dice here (the interface gives none): the heaviest weight still on the field
    let best = '', bw = -1
    shirts[s].forEach((pid, i) => {
      if (pid == null || isOff(s, pid)) return
      if (fallback[i] > bw) { bw = fallback[i]; best = String(pid) }
    })
    return best
  }

  /**
   * HOW EACH SIDE PLAYS, from the old engine's own settings for it: the four
   * dials (style, tempo, kicking, aggression), the without-ball dials (line
   * speed, width), the kicking style and the exit, the zonal game plan, the
   * attack and defence styles (styles.ts stylesOf: the manager's own, or the
   * head coach's philosophy for every other club) and the called moves
   * (moves.ts callsOf). Each number is a lean on a decision the simulation
   * makes, and each is 1 (or the average) for a club on the middle of every
   * dial, so the world's averages hold.
   */
  function buildStyle(s: 0 | 1): PlayStyle {
    const side = sides[s], club = clone.clubs[side.teamId]
    const tac = (club?.tactic ?? {}) as Partial<Tactic>
    const dial = (v: number | undefined) => (Number.isFinite(v) ? (v as number) : 50)
    const sty = club ? stylesOf(clone, club) : null
    const oppClub = clone.clubs[sides[s === 0 ? 1 : 0].teamId]
    const oppSty = oppClub ? stylesOf(clone, oppClub) : null
    const atk = sty?.atk ?? '', def = sty?.def ?? ''
    const kickD = dial(tac.kicking), styleD = dial(tac.style), tempoD = dial(tac.tempo)
    const A = (m: Partial<Record<string, number>>) => m[atk] ?? 1
    const zones = tac.zones ?? {}
    const kickMix = { ...NEUTRAL_STYLE.kickMix }
    const ks = tac.kickStyle ?? 'balanced'
    if (ks === 'territory') Object.assign(kickMix, { long: 1.5, touch: 1.5, clearance: 1.2, box: 0.8, upAndUnder: 0.7, grubber: 0.6, chip: 0.5, crossField: 0.5 })
    if (ks === 'contest') Object.assign(kickMix, { box: 1.5, upAndUnder: 1.8, long: 0.7, touch: 0.8, grubber: 0.8, chip: 1, crossField: 0.8 })
    if (ks === 'attack') Object.assign(kickMix, { grubber: 1.6, chip: 2.2, crossField: 2.4, long: 0.7, touch: 0.8, box: 0.8 })
    if (tac.exit === 'box') kickMix.box *= 2
    if (tac.exit === 'long') { kickMix.long *= 1.6; kickMix.clearance *= 0.8 }
    if (tac.exit === 'fifty22') kickMix.touch *= 2
    const kickZone: [number, number, number] = [
      zones.own22 === 'long' ? 1.3 : zones.own22 === 'play' ? 0.55 : tac.exit === 'counter' ? 0.65 : 1,
      zones.middle === 'terr' ? 1.3 : zones.middle === 'hand' ? 0.7 : 1,
      zones.opp22 === 'drive' ? 0.6 : zones.opp22 === 'spread' ? 0.8 : 1,
    ]
    const calls = club ? callsOf(clone, club) : {}
    const move = calls.lineout ?? calls.main ?? calls.scrum ?? calls.alt
    // the hash the old engine's AI reads for its appetite for the corner (scoring.ts aiPenaltyCall)
    let h = 0
    for (const ch of side.teamId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    const appetite = (h % 1000) / 1000
    const pack = 1 + STYLE_PACK * (50 - styleD) / 100
    return {
      atk, def,
      kick: Math.max(0.5, Math.min(1.7, (1 + (kickD - 50) / STYLE_KICK) * A({ kick: 1.1, width: 0.92, offload: 0.9 }))),
      kickZone, kickMix,
      width: Math.max(0.18, Math.min(0.45, 0.30 * (1 - STYLE_WIDTH / 2 + STYLE_WIDTH * styleD / 100) * A({ width: 1.08, direct: 0.9, offload: 1.04 }))),
      tempo: 1.18 - 0.36 * tempoD / 100,
      // (divided by the world's mean, 1.2, so the average club offloads as the even world does)
      offload: A({ offload: 2.6, width: 1.0, direct: 0.8, kick: 0.8 }) / 1.2,
      maul: (1 + STYLE_MAUL * (50 - styleD) / 100) * A({ direct: 1.15, pods: 1.1, width: 0.8, offload: 0.85 }) ,
      pick: pack * A({ direct: 1.2, width: 0.8 }),
      // the plan in their 22 is played only there (skeleton.ts), so the side's carry elsewhere does not pay for it
      fit: (() => {
        const z = Math.max(-FIT.z, Math.min(FIT.z, (leanOf(clone, shirts0[s]) - mean.lean) / FIT.sd))
        return { wide: Math.exp(FIT.b * z), tight: Math.exp(-FIT.b * z) }
      })(),
      in22: zones.opp22 === 'drive' ? { maul: 2.0, pick: 1.5, width: 1 } : zones.opp22 === 'spread' ? { maul: 0.7, pick: 0.7, width: 1.05 } : { maul: 1, pick: 1, width: 1 },
      corner: Math.max(0, Math.min(0.85, 0.08 + appetite * 0.45 + (50 - styleD) / 150 + (zones.opp22 === 'drive' ? 0.1 : 0))),
      quick: 0.5 + tempoD / 100,
      blitz: Math.max(-1, Math.min(1, (dial(tac.defLine) - 50) / 40 + (def === 'blitz' ? 0.3 : def === 'drift' ? -0.3 : 0))),
      narrow: Math.max(-1, Math.min(1, (50 - dial(tac.defWidth)) / 40 + (def === 'choke' ? 0.25 : 0))),
      // (nearly every club calls a move: one that does not plays its first phase a little worse)
      launch: move ? 1.1 : 0.8,
      ...(move ? { launchMove: move } : {}),
      matchup: atk && oppSty?.def ? MATCHUP[atk as AtkStyle]?.[oppSty.def as DefStyle] ?? 0 : 0,
      // THE OLD ENGINE'S OWN STYLE TICK (styles.ts styleTick): its try lean for this attack against
      // that defence, with the matchup, how well each XV fits its style, the pack and the weather in
      // it. (Its leans on the penalty count and on turnovers were tried here as well, round 5, and
      // taken out: through this simulation's own breakdown they moved the per-fixture margin gap to
      // the old engine from 3.4 to 4.0 points, rms, on the parity pairings.)
      ...(() => {
        const o = sides[s === 0 ? 1 : 0], su = side.units, ou = o.units
        const tk = styleTick(side.sty, o.sty, { attSet: su.scrum + su.lineout, defSet: ou.scrum + ou.lineout, attack: su.attack, defence: ou.defence }, styleWx(ctx.weather, ctx.surface))
        return { tryF: tk.tryF, penF: 1, turnF: 1 }
      })(),
      // how readily this side's men are carded (setup.ts cardRisk: the aggression dial), against the plain 0.012
      cards: (side.cardRisk ?? 0.012) / 0.012,
      // THE CAPTAIN (round 6, a design choice: the old engine only has him in the referee's words). His
      // leadership rating, 12 the middle of a club captain's range (1 to 20; captains average about 13):
      // discipline in his own 22, the call at a late close penalty, and a lift when his side is behind
      lead: (() => {
        const ids = [club?.captain, club?.vice].filter((x): x is number => x != null && shirts[s].includes(x))
        const cap = ids.length ? clone.players[ids[0]] : shirts[s].map(id => (id != null ? clone.players[id] : null)).filter(Boolean).sort((a, b) => b!.a.lea - a!.a.lea)[0]
        return cap ? Math.max(-1, Math.min(1, (cap.a.lea - 12) / 6)) : 0
      })(),
      // CHEMISTRY (round 6): games played together by the key partnerships (state.chem, as teamUnits reads
      // it), each counted up to 50, centred so a side whose pairs have played 25 games each is 0
      chem: (() => {
        const pairs: [number, number][] = [[8, 9], [11, 12], [0, 1], [1, 2], [3, 4]]
        let t = 0
        for (const [i, j] of pairs) { const a = side.lineup[i], b = side.lineup[j]; t += a != null && b != null ? Math.min(1, (clone.chem?.[chemKey(a, b)] ?? 0) / 50) : 0 }
        return t / pairs.length - 0.5
      })(),
      defPen: DEF_PEN[def as DefStyle] ?? 1,
    }
  }
  let styles: [PlayStyle, PlayStyle] = [buildStyle(0), buildStyle(1)]

  // ---- ONE MAN AGAINST ANOTHER -------------------------------------------
  // The units are the side; these are the men inside it. Each man's own
  // attributes for a job, through the same match-day multipliers the units
  // use (condition, form, sharpness: selection.ts teamUnits), against the
  // average of his own starting fifteen, raised to MAN_W so the best carrier
  // in a side is a better carrier without the side as a whole moving. Then his
  // own legs: his tank from when he came on, against the side's average now.
  type Job = Exclude<keyof ManForm, 'legs'>
  const JOBS: Job[] = ['carry', 'tackle', 'kick', 'hands', 'ruck']
  const rawMan = (id: number): Record<Job, number> => {
    const p = clone.players[id]
    if (!p) return { carry: 1, tackle: 1, kick: 1, hands: 1, ruck: 1 }
    const a = p.a, f = (0.78 + 0.22 * (p.cond ?? 100) / 100) * (0.9 + 0.02 * (p.form ?? 5)) * (0.945 + 0.055 * ((p.sharp ?? 70) / 100))
    return {
      carry: (a.str * 0.3 + a.pac * 0.3 + a.agi * 0.2 + a.han * 0.2) * f,
      tackle: (a.tac * 0.6 + a.pos * 0.2 + a.wor * 0.2) * f,
      kick: a.kic * f,
      hands: (a.han * 0.7 + a.pas * 0.3) * f,
      ruck: (a.ruc * 0.7 + a.str * 0.3) * f,
    }
  }
  const rawCache = new Map<number, Record<Job, number>>()
  const rawOf = (id: number) => { let r = rawCache.get(id); if (!r) { r = rawMan(id); rawCache.set(id, r) } return r }
  // EACH JOB AGAINST THE MEN WHO DO IT: the average is weighted the way the pickers name men for that
  // job (a carry is mostly the back row, a kick the 10), so the man the simulation names is, on
  // average, exactly his side (1), and the side as a whole stays what its units say
  const JOB_W: Record<Job, number[]> = {
    carry: W_CARRY_TIGHT.map((x, i) => x * 0.7 + W_CARRY_WIDE[i] * 0.3),
    hands: W_CARRY_TIGHT.map((x, i) => x * 0.7 + W_CARRY_WIDE[i] * 0.3),
    tackle: W_TACKLE_TIGHT.map((x, i) => x * 0.7 + W_TACKLE_WIDE[i] * 0.3),
    kick: W_KICK_OPEN.map((x, i) => x + W_KICK_BOX[i] * 0.5),
    ruck: W_JACKAL,
  }
  const sideAvg = ([0, 1] as const).map(s => Object.fromEntries(JOBS.map(j => {
    let num = 0, den = 0
    shirts0[s].forEach((id, i) => { if (id == null) return; const w = JOB_W[j][i]; num += w * Math.pow(rawOf(id)[j], MAN_W); den += w })
    return [j, den ? Math.pow(num / den, 1 / MAN_W) : 1]
  })) as Record<Job, number>)
  const tankAt = (s: 0 | 1, slot: number, t: number) => {
    const side = sides[s], rate = (1 - END_TANK) * side.tempoF * side.drainF
    return tank0[s][slot] * Math.max(0, 1 - Math.min(1, Math.max(0, t - onAt[s][slot]) / 4800) * rate)
  }
  const keepMemo = new Map<string, number>()
  const manKeep = (s: 0 | 1, slot: number, n: number) => {
    const key = `${s}|${slot}|${n}`
    let k = keepMemo.get(key)
    if (k == null) {
      const p = clone.players[n]
      k = p ? shirtKeep(p, slot) : 1
      keepMemo.set(key, k)
    }
    return k
  }
  const man = (s: 0 | 1, id: string, t: number): ManForm => {
    const n = Number(id), slot = shirts[s].indexOf(n)
    if (!id || slot < 0) return { carry: 1, tackle: 1, kick: 1, hands: 1, ruck: 1, legs: 1 }
    const r = rawOf(n)
    let e = 0
    for (let i = 0; i < 15; i++) e += tankAt(s, i, t)
    e /= 15
    // his legs against his side's: a tired man tackles, carries and rucks worse; his hands and boot a little
    const legs = (1 - MAN_FADE + MAN_FADE * tankAt(s, slot, t)) / (1 - MAN_FADE + MAN_FADE * e)
    // a man out of his own shirt: the units already charge the side for him, so his own edge or
    // shortfall at the jobs the shirt gives him counts only as much as the units' loss does (SHIRT_KEEP)
    const k = MAN_W * manKeep(s, slot, n)
    const rel = (j: Job) => Math.pow(r[j] / sideAvg[s][j], k)
    return { carry: rel('carry') * legs, tackle: rel('tackle') * legs, kick: rel('kick') * Math.sqrt(legs), hands: rel('hands') * Math.sqrt(legs), ruck: rel('ruck') * legs, legs }
  }

  const world: MatchWorld = {
    man,
    legs: legsOf,
    style: s => styles[s],
    managed: ctx.userSideId == null ? null : sides[0].teamId === ctx.userSideId ? 0 : 1,
    weather: ctx.weather,
    newMatch,
    lineup: s => ({
      field: shirts[s].map(id => (id == null ? '' : String(id))),
      off: shirts[s].map(id => id == null || isOff(s, id)),
      bench: sides[s].lineup.slice(15, 23).map(id => (id == null || used[s].has(id) || gone[s].has(id) ? '' : String(id))),
    }),
    str,
    ruck: (s, hasBall, t) => { now = t; return clampStr(ruckRaw(s, hasBall) * hfa(s) * fade(s, t)) },
    setClock: t => { now = t },
    carrier: (s, wide, rng) => pickBy(s, wide ? W_CARRY_WIDE : W_CARRY_TIGHT, rng),
    tacklers: (s, wide, rng) => {
      const w = wide ? W_TACKLE_WIDE : W_TACKLE_TIGHT
      const first = pickBy(s, w, rng)
      if (!first) return []
      // two men in the tackle a little under half the time, more often in the tight
      if (rng() >= (wide ? 0.3 : 0.5)) return [first]
      const second = pickBy(s, w, rng, first)
      return second ? [first, second] : [first]
    },
    jackal: (s, rng) => pickBy(s, W_JACKAL, rng),
    kicker: (s, box, rng) => pickBy(s, box ? W_KICK_BOX : W_KICK_OPEN, rng),
    catcher: (s, rng) => pickBy(s, W_CATCH, rng),
    goalKicker: s => {
      // the engine's own answer (field.ts): the named kicker, then the
      // club's list, then the best boot on the field. It reads onPitch, so
      // a kicker in the bin is tried against our own record too.
      const k = goalKicker(clone, sides[s])
      if (k && shirts[s].includes(k.id) && !isOff(s, k.id)) return String(k.id)
      return inShirt(s, 10, W_KICK_OPEN.map((x, i) => x + W_ANYONE[i] * 0.01))
    },
    thrower: s => inShirt(s, 2, W_FORWARD.map((x, i) => x * (i < 3 ? 2 : 1) + 0.01)),
    jumper: (s, rng) => pickBy(s, W_JUMP, rng),
    forward: (s, rng) => pickBy(s, W_FORWARD, rng),
    carded: (s, id, until) => { off[s].set(id, until) },
    decide,
    // THE OLD ENGINE'S OWN KICK (kicking.ts kickChance, with the clutch
    // habit, as scoring.ts and takePenaltyShot use them): the kicker's goal
    // kicking, form and nerve, the kicking coach and facility (goalBonus) and
    // the weather (goalPenalty), all absolute. Measured 21 Nov (scripts/tmp/
    // gp/kicks.ts): reading the kick as a strength against the league mean
    // gave every league the same goal kicking, so a National One side kicked
    // like a Top 14 one and the lower leagues scored 3 to 6 points a match
    // more than they do in the old engine.
    goalP: (s, kind, t, lead) => {
      now = t
      const id = world.goalKicker(s)
      const kicker = id ? clone.players[Number(id)] ?? null : null
      const base = kind === 'con' ? 0.495 : 0.53
      return clamp(kickChance(clone, kicker, base, 54, ctx.goalPenalty ?? 0, sides[s]) + clutchKick(clone.seed, kicker, Math.floor(t / 60), lead), 0.3, 0.92)
    },
  }

  const simSide = (side: SideCtx): SimSide => ({
    teamId: side.teamId,
    captain: clone.clubs[side.teamId]?.captain != null ? String(clone.clubs[side.teamId]!.captain) : undefined,
    name: teamName(clone, side.teamId),
    players: side.lineup.flatMap((id, i) => {
      const p = id != null ? clone.players[id] : null
      return p ? [{ id: String(p.id), name: p.name, shirt: i + 1 }] : []
    }),
  })

  return { world, home: simSide(ctx.home), away: simSide(ctx.away) }
}
