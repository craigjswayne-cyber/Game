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
import type { Fixture, GameState } from '../model'
import { mulberry32, wpick, type Rng } from '../rng'
import { beginMatch } from '../match/begin'
import { mkSide } from '../match/setup'
import { sideEnergy } from '../match/energy'
import { fieldChanged, goalKicker, recomputeSideUnits } from '../match/field'
import { applyTeamTalk, makeSubstitution } from '../match/control'
import { benchTank } from '../match/subs'
import { kickChance } from '../match/kicking'
import { clutchKick } from '../habits'
import { clamp } from '../rng'
import { teamName } from '../match/selection'
import type { SideCtx } from '../match/side'
import type { LiveCtx } from '../match/live'
import type { Contest, Decision, World } from './world'

/** a side as a reader needs it, to print names: the starting 15 in shirt order, then the bench */
export interface SimSide {
  teamId: string
  name: string
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
export const HFA_SHARE = 0.45

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
export const END_TANK = 0.27

/** the units a strength is read from, and the league's mean of each */
export type UnitKey = 'scrum' | 'lineout' | 'breakdown' | 'attack' | 'defence' | 'kicking' | 'goal' | 'overall'
const UNIT_KEYS: UnitKey[] = ['scrum', 'lineout', 'breakdown', 'attack', 'defence', 'kicking', 'goal', 'overall']
export type LeagueMeans = Record<UnitKey, number> & { penRisk: number; energy: number; n: number }

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
  const sum: LeagueMeans = { scrum: 0, lineout: 0, breakdown: 0, attack: 0, defence: 0, kicking: 0, goal: 0, overall: 0, penRisk: 0, energy: 0, n: 0 }
  for (const id of ids) {
    const side = mkSide(clone, id, clone.userClubId, fx.id, false)
    for (const k of UNIT_KEYS) sum[k] += side.units[k]
    sum.penRisk += side.penRisk
    sum.energy += sideEnergy(side)
    sum.n++
  }
  const n = Math.max(1, sum.n)
  for (const k of UNIT_KEYS) sum[k] /= n
  sum.penRisk /= n
  sum.energy /= n
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
export const UNIT_EXP: Record<UnitKey, number> = { scrum: 1.43, lineout: 1.15, breakdown: 0.91, attack: 0.95, defence: 1.3, kicking: 0.62, goal: 1, overall: 1 }

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
  const unitStr = (s: 0 | 1, k: UnitKey) => Math.pow(sides[s].units[k] / Math.max(1e-6, mean[k]), GAMMA * exps[k])
  const hfaShare = opts.hfaShare ?? HFA_SHARE
  const hfa = (s: 0 | 1) => (s === 0 ? Math.pow(ctx.hfa, hfaShare) : 1)
  // each shirt's tank when its man came on, and the second he came on (0 for a starter), so a
  // replacement brings fresh legs and the fade is the fifteen men on the field now
  const tank0 = sides.map(side => shirts[sides.indexOf(side)].map(id => (id == null ? 70 : side.energy.get(id) ?? 70) / 100))
  const onAt = [Array(15).fill(0), Array(15).fill(0)] as [number[], number[]]
  const fade = (s: 0 | 1, t: number) => {
    const side = sides[s], rate = (1 - END_TANK) * side.tempoF * side.drainF
    let e = 0
    for (let i = 0; i < 15; i++) e += tank0[s][i] * Math.max(0, 1 - Math.min(1, Math.max(0, t - onAt[s][i]) / 4800) * rate)
    e /= 15
    return (1 - FADE_W + FADE_W * e) / (1 - FADE_W + FADE_W * (mean.energy / 100))
  }
  /** the bench men already used, who cannot come on again */
  const used: [Set<number>, Set<number>] = [new Set(), new Set()]
  const isUserSide = (s: 0 | 1) => ctx.userSideId != null && sides[s].teamId === ctx.userSideId
  /** THE MANAGER'S HAND on the private copy, through the old engine's own functions where it has them.
   *  It changes this World for good: after a decision, build a new World for the next match. */
  const decide = (d: Decision, t: number): string => {
    now = t
    if (d.kind === 'world' || d.kind === 'strength' || d.kind === 'penaltyCall') return 'not a decision for the World'
    const s = d.side, side = sides[s], min = Math.min(79, Math.max(1, Math.floor(t / 60)))
    ctx.lastMin = min
    if (d.kind === 'substitution') {
      const outId = Number(d.off), inId = Number(d.on)
      const slot = shirts[s].indexOf(outId)
      if (slot < 0) return 'not on the field'
      if (isOff(s, outId)) return 'in the bin or sent off'
      const benchAt = side.lineup.indexOf(inId)
      if (benchAt < 15 || used[s].has(inId)) return 'not on the bench'
      if (isUserSide(s)) {
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
      used[s].add(inId)
      shirts[s][slot] = inId
      tank0[s][slot] = (side.energy.get(inId) ?? 70) / 100
      onAt[s][slot] = t
      return ''
    }
    if (d.kind === 'tactics') {
      const tac = clone.clubs[side.teamId]?.tactic as unknown as Record<string, unknown> | undefined
      if (!tac) return 'no club'
      Object.assign(tac, d.set)
      // as applyTacticsChange: the units rebuilt with the new dials, nothing else
      recomputeSideUnits(clone, ctx, side)
      return ''
    }
    if (d.kind === 'talk') {
      if (!isUserSide(s)) return 'only the manager gives a talk'
      const said = applyTeamTalk(clone, ctx, d.tone as Parameters<typeof applyTeamTalk>[2])
      recomputeSideUnits(clone, ctx, side)
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
  const str = (s: 0 | 1, c: Contest, t: number): number => {
    now = t
    // a kick at goal is one man and a tee: no crowd, no fade
    if (c === 'goal') return clampStr(raw(s, c))
    // a tired side gives away more, but the crowd is already in refPenF
    if (c === 'discipline') return clampStr(raw(s, c) * fade(s, t))
    return clampStr(raw(s, c) * hfa(s) * fade(s, t))
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

  const world: MatchWorld = {
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
    name: teamName(clone, side.teamId),
    players: side.lineup.flatMap((id, i) => {
      const p = id != null ? clone.players[id] : null
      return p ? [{ id: String(p.id), name: p.name, shirt: i + 1 }] : []
    }),
  })

  return { world, home: simSide(ctx.home), away: simSide(ctx.away) }
}
