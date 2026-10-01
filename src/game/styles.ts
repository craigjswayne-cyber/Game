// ---- THE ATTACK AND DEFENCE STYLES (1.8.2, owner request) ----
//
// Five ways to attack and five ways to defend, picked by name on the Tactics
// screen and drawn there, the way a coach describes his side before he says a
// word about any one play:
//
//   ATTACK   direct (gain line and hard carrying), pods (1-3-3-1: balanced
//            forward pods and backline options), width (flat pass, screen and
//            sweep, the outside channels), kick (box kick and chase, territory
//            and the aerial battle), offload (keep the ball alive in the tackle)
//   DEFENCE  drift (slide, push play to the touchline), blitz (line speed that
//            cuts decision time), pendulum (a standard line with the back three
//            covering the kick space), man (man-to-man, a direct matchup each),
//            choke (the upright tackle: hold the carrier up, force the maul)
//
// HOW A STYLE RELATES TO WHAT WAS ALREADY THERE
//
//   THE DIALS. A style is first a PRESET over the levers the engine has always
//   read: the four with-ball dials, the breakdown commitment and the kick
//   style for an attack; line speed, width and the breakdown contest for a
//   defence. Picking one sets them; the dials stay on the screen as "fine
//   tune" and move freely afterwards, and the style is not changed by them.
//   An old save has no style, so it is read off the dials: the nearest of the
//   five on each side of the ball (atkStyleOfDials, defStyleOfDials).
//
//   A SMALL EFFECT OF ITS OWN. On top of the preset, each style changes the
//   rugby a little in its own currency (STYLE_FX): the line breaks it makes or
//   stops (the try chance), the gain line (the penalty window), the turnovers
//   it gives away or wins, the ground it makes after a tick that does not
//   score, the territory a kicking game buys, and the legs it costs.
//
//   THE MATCHUP. Each attack is good against some defences and bad against
//   others (MATCHUP). The table is doubly balanced: every row and every column
//   sums to zero, so against a world that plays every defence equally often
//   no attack gains from the table, and no defence either. scripts/styleprobe
//   measures that it holds on the pitch, not just in the arithmetic.
//
//   FIT. A style is only as good as the men asked to play it (STYLE_NEEDS),
//   read off the shirts on the pitch against the world's average man in each
//   shirt, the way moves.ts reads a move's fit, and then against the side's
//   own profile (styleFitRel), so it says which style suits THIS XV rather
//   than how good the XV is. Width needs pace out wide and passing at 10 and
//   12; choke needs strong, upright tacklers in the pack.
//
//   THE MOVES (moves.ts) are the plays you CALL inside the style: a style is
//   the side's overall game, a move is one play. The two meet in the fit: a
//   move that belongs to the style (STYLE_MOVES: the pod shapes in a pod
//   game, the crash ball in a direct one) is run better by a side that plays
//   that way all afternoon, and a kicking side runs its phase shapes a little
//   worse, because it plays fewer phases.
//
// AI clubs play the styles their head coach's philosophy leans to (PH_STYLES),
// two of each per philosophy, and which of the two by a hash of the club and
// the coach, so across the world each style is played about equally often.
//
// name/desc/say are i18n KEYS; the English is under `styles` in en.json.

import type { Attrs, Club, GameState, Tactic } from './model'
import { clamp, hashString } from './rng'

export type AtkStyle = 'direct' | 'pods' | 'width' | 'kick' | 'offload'
export type DefStyle = 'drift' | 'blitz' | 'pendulum' | 'man' | 'choke'

export const ATK_STYLES: AtkStyle[] = ['direct', 'pods', 'width', 'kick', 'offload']
export const DEF_STYLES: DefStyle[] = ['drift', 'blitz', 'pendulum', 'man', 'choke']

export const isAtkStyle = (v: unknown): v is AtkStyle => typeof v === 'string' && (ATK_STYLES as string[]).includes(v)
export const isDefStyle = (v: unknown): v is DefStyle => typeof v === 'string' && (DEF_STYLES as string[]).includes(v)

/** the levers an attacking style sets */
export type AtkPreset = Pick<Tactic, 'style' | 'tempo' | 'kicking' | 'ruckCommit' | 'kickStyle'>
/** the levers a defensive style sets */
export type DefPreset = Required<Pick<Tactic, 'defLine' | 'defWidth' | 'ruckContest'>>

export const ATK_PRESET: Record<AtkStyle, AtkPreset> = {
  direct: { style: 22, tempo: 46, kicking: 50, ruckCommit: 62, kickStyle: 'territory' },
  pods: { style: 45, tempo: 50, kicking: 45, ruckCommit: 55, kickStyle: 'balanced' },
  width: { style: 84, tempo: 60, kicking: 36, ruckCommit: 38, kickStyle: 'attack' },
  kick: { style: 40, tempo: 40, kicking: 84, ruckCommit: 52, kickStyle: 'contest' },
  offload: { style: 70, tempo: 66, kicking: 28, ruckCommit: 40, kickStyle: 'attack' },
}

export const DEF_PRESET: Record<DefStyle, DefPreset> = {
  drift: { defLine: 28, defWidth: 80, ruckContest: 40 },
  blitz: { defLine: 88, defWidth: 62, ruckContest: 50 },
  pendulum: { defLine: 45, defWidth: 50, ruckContest: 45 },
  man: { defLine: 62, defWidth: 38, ruckContest: 55 },
  choke: { defLine: 58, defWidth: 30, ruckContest: 72 },
}

/**
 * The matchup, attack by row against defence by column, in steps of one.
 * Every row and every column sums to zero (styleprobe checks it), and every
 * attack has a defence it beats and one that beats it, and every defence the
 * same, so there is no answer that is right against everyone. The reasons
 * are the coaching study's "what beats it" for each shape (drift, blitz,
 * pendulum and man-to-man from worked examples; choke from the standard
 * coaching pattern).
 *
 *            drift blitz pendulum man choke
 *   direct     +2   -2     +1     0   -1   carries inside a slide win the gain line; the rush hits the carrier behind it; the choke holds him up
 *   pods       +1   +1     +1    -2   -1   the pop off the pod beats the rush; man-to-man reads a structure; the choke feeds on one-out carriers
 *   width      -2   -1      0    +1   +2   the drift and the blitz shut the outside down; loops and decoys pull markers; a narrow choke leaves the edges thin
 *   kick        0   +2     -2     0    0   the blitz leaves space in behind; the pendulum is there for it
 *   offload    -1    0      0    +1    0   a patient drift commits nobody to the tackle; broken play beats a man-for-man matchup
 */
export const MATCHUP: Record<AtkStyle, Record<DefStyle, number>> = {
  direct: { drift: 2, blitz: -2, pendulum: 1, man: 0, choke: -1 },
  pods: { drift: 1, blitz: 1, pendulum: 1, man: -2, choke: -1 },
  width: { drift: -2, blitz: -1, pendulum: 0, man: 1, choke: 2 },
  kick: { drift: 0, blitz: 2, pendulum: -2, man: 0, choke: 0 },
  offload: { drift: -1, blitz: 0, pendulum: 0, man: 1, choke: 0 },
}

/** what one step of the matchup is worth on the try chance (0.04 = 4%): measured
 *  on the pitch (styleprobe) at a little under a point of margin a match */
export const MATCH_K = 0.04

export interface StyleFx {
  /** multiplier on the attack's try chance: the line breaks it makes (an
   *  attack) or allows (a defence, read on the other side's attack) */
  tryF: number
  /** multiplier on the attack's penalty window: winning the gain line (an
   *  attack), or giving away offside and hands in the ruck (a defence) */
  penF: number
  /** multiplier on the turnover rate in a tick that comes to nothing:
   *  handling errors and intercepts (an attack), holding up and jackalling
   *  (a defence) */
  turn: number
  /** metres of gain line made in a tick that comes to nothing (attack only) */
  ground: number
  /** territory: how hard a kicking game pushes the line (attack), or how much
   *  of the other side's kicking game a defence lets through (defence) */
  terr: number
  /** the legs it costs, on the side's energy drain */
  drain: number
}

export const ATK_FX: Record<AtkStyle, StyleFx> = {
  direct: { tryF: 0.95, penF: 1.05, turn: 0.75, ground: 0.15, terr: 0, drain: 1.0 },
  pods: { tryF: 1.0, penF: 1.0, turn: 0.95, ground: 0.2, terr: 0, drain: 1.01 },
  width: { tryF: 1.08, penF: 0.95, turn: 1.1, ground: 0, terr: 0, drain: 1.02 },
  kick: { tryF: 0.88, penF: 0.98, turn: 0.85, ground: 0, terr: 1.0, drain: 0.98 },
  offload: { tryF: 1.15, penF: 0.97, turn: 1.2, ground: 0, terr: 0, drain: 1.03 },
}

export const DEF_FX: Record<DefStyle, StyleFx> = {
  drift: { tryF: 1.015, penF: 0.94, turn: 0.95, ground: 0, terr: 1, drain: 1.0 },
  blitz: { tryF: 0.96, penF: 1.08, turn: 1.1, ground: 0, terr: 1.2, drain: 1.04 },
  pendulum: { tryF: 1.04, penF: 0.98, turn: 0.95, ground: 0, terr: 0.4, drain: 0.99 },
  man: { tryF: 0.985, penF: 1.0, turn: 1.0, ground: 0, terr: 1, drain: 1.01 },
  choke: { tryF: 0.99, penF: 1.02, turn: 1.35, ground: 0, terr: 1, drain: 1.01 },
}

/** how many kicks from hand each attack puts in, on the engine's rate
 *  (kicksFromHand): the box kick and chase kicks the most, and every kick is
 *  a kick that can be charged down */
export const ATK_KICKS: Record<AtkStyle, number> = { direct: 1, pods: 1, width: 0.9, kick: 1.3, offload: 0.85 }

/** the base chance a tick that comes to nothing ends in a turnover, and the
 *  metres it costs the side that lost the ball */
// 0.06 rather than 0.07: every turnover is a tick lost and six metres given,
// the same to both sides, so it is noise on the result; at 0.07 the home
// win rate of single worlds sat a point lower (bandcheck's toulouse/777 read
// 49.8% in movesprobe's tripwire), at 0.06 the pooled bands are unmoved
export const TURN_BASE = 0.06
export const TURN_M = 6
/** what a fully fitting (or fully unsuited) XV adds to (or takes off) its
 *  style's effect on the try chance. The relative fit (styleFitRel) has a
 *  spread of about 0.14 across the world's first XVs (0.23 either way at the
 *  5th and 95th percentiles), so a side playing to its strengths finds about
 *  2% more try chances than one playing against them, and the extremes 3%.
 *  At 0.2 the home side's edge thinned in single worlds (bandcheck's
 *  toulouse/777 fell from 55% home wins to 50%): the fit is a second draw on
 *  who is better, on top of the players, and it must stay the smaller one */
export const FIT_K = 0.12
/** THE WORLD STAYS WHERE IT WAS CALIBRATED. Across a world where every club
 *  plays a style, the effects above need not average exactly neutral (the
 *  AI plays the kicking game a little more often than the others, and it
 *  makes fewer breaks and wins its ground instead). Every styled tick's try
 *  chance is scaled by this so the world scores what it did before styles
 *  existed (bandcheck: 49.4 points and 6.28 tries a game): the styles move
 *  who scores, not how much. A Test side is untouched. */
export const TRY_NORM = 0.995

// ---------------------------------------------------------------- the fit

export interface StyleNeed { shirts: number[]; attrs: (keyof Attrs)[] }

export const STYLE_NEEDS: Record<AtkStyle | DefStyle, StyleNeed[]> = {
  direct: [{ shirts: [1, 3, 8], attrs: ['str', 'han'] }, { shirts: [12], attrs: ['str'] }],
  pods: [{ shirts: [1, 2, 3, 4, 5], attrs: ['han', 'ruc'] }, { shirts: [9], attrs: ['pas', 'dec'] }],
  width: [{ shirts: [11, 13, 14, 15], attrs: ['pac'] }, { shirts: [10, 12], attrs: ['pas'] }],
  kick: [{ shirts: [9, 10, 15], attrs: ['kic'] }, { shirts: [11, 14], attrs: ['pac'] }],
  offload: [{ shirts: [6, 7, 8, 12, 13], attrs: ['han', 'agi'] }, { shirts: [6, 7, 8], attrs: ['sta'] }],
  drift: [{ shirts: [10, 12, 13], attrs: ['pos', 'tac'] }, { shirts: [11, 14], attrs: ['pac'] }],
  blitz: [{ shirts: [6, 7, 12, 13], attrs: ['pac', 'dec'] }, { shirts: [6, 7, 10, 12, 13], attrs: ['sta'] }],
  pendulum: [{ shirts: [11, 14, 15], attrs: ['pos', 'kic'] }, { shirts: [10], attrs: ['tac'] }],
  man: [{ shirts: [9, 10, 12, 13], attrs: ['tac', 'agi'] }, { shirts: [11, 14, 15], attrs: ['pac'] }],
  choke: [{ shirts: [4, 5, 6, 7, 8], attrs: ['str', 'tac'] }],
}

/** The world's average man in each shirt on each attribute a style reads,
 *  measured over every club's first XV in three fresh worlds (seeds 11, 222,
 *  3333), so an average side has a fit of zero. */
const REF: Record<string, number> = {
  '1.str': 14.1, '1.han': 9.4, '1.ruc': 12.9, '2.han': 10.1, '2.ruc': 12.8, '3.str': 14.0, '3.han': 9.0, '3.ruc': 12.4,
  '4.han': 10.4, '4.ruc': 13.2, '4.str': 14.1, '4.tac': 13.2, '5.han': 9.7, '5.ruc': 12.2, '5.str': 13.2, '5.tac': 12.2,
  '6.str': 13.3, '6.tac': 14.4, '6.han': 11.2, '6.agi': 8.7, '6.sta': 10.2, '6.pac': 9.2, '6.dec': 10.0,
  '7.str': 12.8, '7.tac': 13.5, '7.han': 10.5, '7.agi': 8.4, '7.sta': 9.8, '7.pac': 8.9, '7.dec': 9.4,
  '8.str': 14.1, '8.han': 12.0, '8.tac': 13.3, '8.agi': 8.9, '8.sta': 10.2,
  '9.pas': 14.1, '9.dec': 12.2, '9.kic': 12.2, '9.tac': 10.2, '9.agi': 10.9,
  '10.pas': 13.8, '10.kic': 14.2, '10.pos': 9.9, '10.tac': 9.9, '10.sta': 10.3, '10.agi': 10.2,
  '11.pac': 12.0, '11.pos': 10.8, '11.kic': 9.1,
  '12.str': 12.5, '12.pas': 12.5, '12.han': 13.3, '12.agi': 10.2, '12.pos': 9.9, '12.tac': 13.2, '12.pac': 10.7, '12.dec': 11.5, '12.sta': 10.0,
  '13.pac': 10.4, '13.han': 12.4, '13.agi': 9.9, '13.pos': 9.3, '13.tac': 12.4, '13.dec': 10.8, '13.sta': 9.7,
  '14.pac': 11.6, '14.pos': 10.2, '14.kic': 8.6,
  '15.pac': 11.3, '15.kic': 12.7, '15.pos': 12.9,
}
/** attribute points above the average man for a fit of +1 */
const FIT_SPAN = 3

/** How well the men in the named shirts suit a style, -1..1. `at` returns the
 *  man's attribute in that shirt, or null when the shirt is empty (read as a
 *  weak one, as moves.ts does). */
export function styleFit(id: AtkStyle | DefStyle, at: (shirt: number, a: keyof Attrs) => number | null): number {
  let sum = 0, n = 0
  for (const need of STYLE_NEEDS[id]) for (const s of need.shirts) for (const a of need.attrs) {
    const v = at(s, a)
    sum += ((v ?? 6) - (REF[`${s}.${a}`] ?? 11)) / FIT_SPAN
    n++
  }
  return n ? clamp(sum / n, -1, 1) : 0
}

/**
 * THE FIT THAT COUNTS: how much better this XV suits one style than it suits
 * the ten on average. The raw fit above reads the men against the world's
 * average man, so a side of internationals "fits" every style and a side of
 * journeymen none, and paying for that would pay a strong side twice for
 * being strong (it widened the gaps: fewer draws, more blowouts). Relative to
 * the side's own profile, a strong side with a slow back three still fits the
 * wide game worse than its other options, which is the question a coach is
 * asking. This is what the engine plays and the Tactics screen shows.
 */
export function styleFitRel(id: AtkStyle | DefStyle, at: (shirt: number, a: keyof Attrs) => number | null): number {
  const all = [...ATK_STYLES, ...DEF_STYLES]
  const raw = Object.fromEntries(all.map(s => [s, styleFit(s, at)])) as Record<string, number>
  const mean = all.reduce((t, s) => t + raw[s], 0) / all.length
  return clamp(raw[id] - mean, -1, 1)
}

/** a club's fit for a style, off its team sheet as it stands */
export function clubStyleFit(state: GameState, club: Club, id: AtkStyle | DefStyle, lineup = club.tactic.lineup): number {
  return styleFitRel(id, (shirt, a) => {
    const pid = lineup[shirt - 1]
    const p = pid != null ? state.players[pid] : undefined
    return p ? p.a[a] : null
  })
}

// ---------------------------------------------------------------- the moves

/** The called moves that belong to each attacking style: a side that plays
 *  that way all afternoon runs them better (moves.ts fit, +MOVE_AFFINITY). */
export const STYLE_MOVES: Record<AtkStyle, string[]> = {
  // (1.8.2, the new families: the maul and the crash-and-swing are a direct
  // side's, the tap and the 9's loop a pod side's, the full-back and the
  // blind wing in the line a wide side's, the kicks a kicking side's, and
  // the peel's pop off the maul an offloading side's)
  direct: ['mv_crash', 'mv_1331', 'mv_crashswing', 'mv_maulswitch', 'mv_tapgo'],
  pods: ['mv_1331', 'mv_242', 'mv_backdoor', 'mv_loop9', 'mv_tap'],
  // (round 6: the tap and spread, the ball out the back to the width, too)
  width: ['mv_loop', 'mv_switch', 'mv_strike13', 'mv_242', 'mv_width', 'mv_wingin', 'mv_tapspread'],
  kick: ['mv_crosskick', 'mv_grubber'],
  offload: ['mv_backdoor', 'mv_decoy', 'mv_inside', 'mv_peel'],
}
export const MOVE_AFFINITY = 0.2
/** what the style does to a called move's fit: plus for a move that belongs
 *  to the style; a kicking side runs its open-play shapes a little worse */
export function moveAffinity(atk: AtkStyle | undefined, moveId: string, shape: boolean): number {
  if (!atk) return 0
  if (STYLE_MOVES[atk].includes(moveId)) return MOVE_AFFINITY
  return atk === 'kick' && shape ? -MOVE_AFFINITY / 2 : 0
}

// ---------------------------------------------------------------- choosing

/** The nearest attacking style to a set of dials: how an old save, which
 *  has dials and no style, is read. Style and kicking decide it, tempo helps. */
export function atkStyleOfDials(tac: Partial<Tactic>): AtkStyle {
  const v = (x: number | undefined) => (Number.isFinite(x) ? (x as number) : 50)
  let best: AtkStyle = 'pods', bestD = Infinity
  for (const id of ATK_STYLES) {
    const p = ATK_PRESET[id]
    const d = (p.style - v(tac.style)) ** 2 + (p.kicking - v(tac.kicking)) ** 2 + 0.5 * (p.tempo - v(tac.tempo)) ** 2
    if (d < bestD) { bestD = d; best = id }
  }
  return best
}

/** The nearest defensive style to the without-ball dials. */
export function defStyleOfDials(tac: Partial<Tactic>): DefStyle {
  const v = (x: number | undefined) => (Number.isFinite(x) ? (x as number) : 50)
  let best: DefStyle = 'pendulum', bestD = Infinity
  for (const id of DEF_STYLES) {
    const p = DEF_PRESET[id]
    const d = (p.defLine - v(tac.defLine)) ** 2 + (p.defWidth - v(tac.defWidth)) ** 2 + 0.5 * (p.ruckContest - v(tac.ruckContest)) ** 2
    if (d < bestD) { bestD = d; best = id }
  }
  return best
}

/** What each head coach's philosophy leans to: two attacks and two defences
 *  each, and across the eight every style appears three or four times. */
export const PH_STYLES: Record<string, { atk: [AtkStyle, AtkStyle]; def: [DefStyle, DefStyle] }> = {
  pack: { atk: ['direct', 'pods'], def: ['choke', 'man'] },
  width: { atk: ['width', 'offload'], def: ['drift', 'pendulum'] },
  tempo: { atk: ['offload', 'width'], def: ['blitz', 'drift'] },
  squeeze: { atk: ['kick', 'direct'], def: ['pendulum', 'choke'] },
  blitz: { atk: ['kick', 'pods'], def: ['blitz', 'man'] },
  counter: { atk: ['width', 'kick'], def: ['drift', 'pendulum'] },
  chaos: { atk: ['offload', 'direct'], def: ['blitz', 'choke'] },
  structure: { atk: ['pods', 'kick'], def: ['man', 'pendulum'] },
}

// ---------------------------------------------------------------- the pods

/**
 * THE POD SHAPE (1.8.2 depth, owner: "a pod-shape choice inside the Pods
 * style"). A pod game is not one game: where the eight forwards stand
 * decides what it is for. Three shapes, picked on the Pods card:
 *
 *   1331  a forward on each edge, two pods of three in the middle: the
 *         balanced game, and the Pods style exactly as it always was
 *   242   two on each edge, four in the middle: the ball goes wider sooner,
 *         more line breaks out wide, a little less go-forward and a little
 *         more risk in the pass
 *   nine  one-out runners round the scrum-half: quick ball off short
 *         carries, the most gain line and the fewest handling errors, and the
 *         fewest breaks; it costs a little more in legs (the recycle is fast)
 *
 * Each only shifts the Pods style's own effect (ATK_FX.pods) a little: the
 * shape is the second decision, not a new style. Absent (an old save, or a
 * side playing anything but pods) is 1331, which is the Pods style as it was.
 */
export type PodShape = '1331' | '242' | 'nine'
export const POD_SHAPES: PodShape[] = ['1331', '242', 'nine']
export const isPodShape = (v: unknown): v is PodShape => typeof v === 'string' && (POD_SHAPES as string[]).includes(v)

/** multipliers on the Pods style's try chance, penalty window, turnovers and
 *  drain, and metres added to its ground (all 1 and 0 for the 1-3-3-1) */
export const POD_FX: Record<PodShape, { tryF: number; penF: number; turn: number; ground: number; drain: number }> = {
  '1331': { tryF: 1, penF: 1, turn: 1, ground: 0, drain: 1 },
  '242': { tryF: 1.04, penF: 0.98, turn: 1.06, ground: -0.08, drain: 1.005 },
  nine: { tryF: 0.97, penF: 1.03, turn: 0.86, ground: 0.12, drain: 1.01 },
}
/** the forwards across the field, touch to touch, for anything that draws it */
export const POD_GROUPS: Record<PodShape, number[]> = { '1331': [1, 3, 3, 1], '242': [2, 4, 2], nine: [3, 2, 3] }

/** An attacking style's effect with its pod shape folded in. */
export function atkFx(atk: AtkStyle, pod?: PodShape): StyleFx {
  const a = ATK_FX[atk]
  if (atk !== 'pods' || !pod || pod === '1331') return a
  const p = POD_FX[pod]
  return { ...a, tryF: a.tryF * p.tryF, penF: a.penF * p.penF, turn: a.turn * p.turn, ground: a.ground + p.ground, drain: a.drain * p.drain }
}

/** Pick a pod shape: it names the Pods style too, since a shape is a pod game. */
export function applyPodShape(tac: Tactic, pod: PodShape) {
  if (tac.atkStyle !== 'pods') applyAtkStyle(tac, 'pods')
  tac.podShape = pod
}

export const podName = (id: PodShape) => `styles.pod_${id}`
export const podDesc = (id: PodShape) => `styles.pod_${id}Desc`

// ---------------------------------------------------------------- the leagues

/**
 * EACH LEAGUE PLAYS ITS OWN RUGBY (1.8.2 depth, owner: "distinct AI flavour
 * by country/league"). A coach's philosophy still decides the two attacks and
 * the two defences he chooses between (PH_STYLES), so nothing here takes a
 * club off its coach's game; what the league changes is which of the two he
 * reaches for, the way a coach adapts to the rugby around him:
 *
 *   French (Elite 14, Elite 2, both women's divisions): forward power and
 *     the offload; the choke tackle and man-for-man defence
 *   English (Premier, Championship, National One, the women's two): the
 *     kicking game and structured pods; the blitz
 *   Southern Hemisphere (the Pacific, both): width and the offload; the
 *     drift and the pendulum
 *   Celtic (the United Provinces, the Celtic Cup): pods and the kick; the
 *     blitz and man-to-man
 *   Japan: tempo and width; line speed
 *   the MRC: carrying and width; man-to-man
 *
 * A weight on each style (1 is no lean); a coach picks between his two with
 * odds in proportion to their weights, by the same hash as before. Every
 * style keeps a weight above zero everywhere, and each is favoured somewhere,
 * so every style is still played (styleprobe and depthprobe count them).
 */
type Lean = { atk?: Partial<Record<AtkStyle, number>>; def?: Partial<Record<DefStyle, number>> }
const FRENCH: Lean = { atk: { direct: 2.2, offload: 2, width: 0.6, kick: 0.6 }, def: { choke: 2.2, man: 1.5, drift: 0.7, blitz: 0.7 } }
const ENGLISH: Lean = { atk: { kick: 2.4, pods: 1.6, offload: 0.55, width: 0.7 }, def: { blitz: 2.2, pendulum: 1.2, drift: 0.7, choke: 0.8 } }
const SOUTHERN: Lean = { atk: { width: 2.4, offload: 1.7, direct: 0.55, kick: 0.6 }, def: { drift: 2, pendulum: 1.5, choke: 0.55, man: 0.8 } }
const CELTIC: Lean = { atk: { pods: 2, kick: 1.5, offload: 0.7 }, def: { blitz: 1.6, man: 1.6, drift: 0.8 } }
export const LEAGUE_LEAN: Record<string, Lean> = {
  top14: FRENCH, prod2: FRENCH, e1: FRENCH, e2: FRENCH,
  prem: ENGLISH, champ: ENGLISH, natl1: ENGLISH, pwr: ENGLISH,
  srp: SOUTHERN, pac: SOUTHERN,
  urc: CELTIC, celt: CELTIC,
  jl1: { atk: { width: 2, offload: 1.6, direct: 0.6, kick: 0.7 }, def: { blitz: 2.2, choke: 0.6 } },
  mrc: { atk: { direct: 1.8, width: 1.5, kick: 0.7 }, def: { man: 1.8, pendulum: 0.8 } },
}
/** a league's lean, the women's leagues ('w:pwr') read as their own culture */
export const leanOf = (leagueId: string | undefined): Lean => LEAGUE_LEAN[(leagueId ?? '').replace(/^w:/, '')] ?? {}

/** which of two by a hash fraction u (0..1), in proportion to the weights */
function leanPick<T extends string>(pair: [T, T], w: Partial<Record<T, number>> | undefined, u: number): T {
  const a = w?.[pair[0]] ?? 1, b = w?.[pair[1]] ?? 1
  return u * (a + b) < a ? pair[0] : pair[1]
}

export interface Styles { atk: AtkStyle; def: DefStyle; pod?: PodShape }

/**
 * The styles a club plays. The manager's are his, on the tactic (or read off
 * his dials when an old save has none). Every other club's are its head
 * coach's, from his philosophy: which of its two by a hash of the world, the
 * club and the coach, so a new coach can bring a new style and nothing needs
 * storing. A club with no philosophy is read off its dials.
 */
export function stylesOf(state: GameState, club: Club | undefined): Styles | null {
  if (!club) return null
  const tac = club.tactic
  if (club.id === state.userClubId || !club.philosophy || !PH_STYLES[club.philosophy]) {
    const atk = isAtkStyle(tac.atkStyle) ? tac.atkStyle : atkStyleOfDials(tac)
    return {
      atk,
      def: isDefStyle(tac.defStyle) ? tac.defStyle : defStyleOfDials(tac),
      ...(atk === 'pods' ? { pod: isPodShape(tac.podShape) ? tac.podShape : '1331' as PodShape } : {}),
    }
  }
  const ph = PH_STYLES[club.philosophy]
  const h = hashString(`${state.seed}|${club.id}|${club.coachGen ?? 0}|sty`)
  // the league's lean (LEAGUE_LEAN) weights the coach's two options; with no
  // lean it is the plain coin of the hash, as it always was. Two independent
  // fractions of the one hash, so the attack does not decide the defence.
  const lean = leanOf(club.leagueId)
  const u1 = (h & 0xffff) / 0x10000, u2 = (h >>> 16) / 0x10000
  const atk = leanPick(ph.atk, lean.atk, u1)
  return {
    atk, def: leanPick(ph.def, lean.def, u2),
    // an AI pod side's shape, by a hash of its own, a third each
    ...(atk === 'pods' ? { pod: POD_SHAPES[hashString(`${state.seed}|${club.id}|${club.coachGen ?? 0}|pod`) % 3] } : {}),
  }
}

/** Pick an attacking style: the style and its levers. */
export function applyAtkStyle(tac: Tactic, id: AtkStyle) {
  tac.atkStyle = id
  Object.assign(tac, ATK_PRESET[id])
}

/** Pick a defensive style: the style and its levers. */
export function applyDefStyle(tac: Tactic, id: DefStyle) {
  tac.defStyle = id
  Object.assign(tac, DEF_PRESET[id])
}

/** An old save's manager has dials and no style: name the nearest. Idempotent. */
export function migrateStyles(state: GameState) {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const tac = club.tactic
  if (!isAtkStyle(tac.atkStyle)) tac.atkStyle = atkStyleOfDials(tac)
  if (!isDefStyle(tac.defStyle)) tac.defStyle = defStyleOfDials(tac)
}

// ---------------------------------------------------------------- in the match

/** What a side is playing in a match, and how well its men suit it: set by
 *  the engine at kick-off and on every rebuild of the units (SideCtx.sty). */
export interface SideStyle extends Styles { atkFit: number; defFit: number }

export interface StyleTick {
  /** the matchup this tick, -2..2 */
  m: number
  tryF: number
  penF: number
  /** the chance a tick that comes to nothing is turned over */
  turnP: number
  /** metres of gain line after a tick that comes to nothing */
  ground: number
}

/**
 * What the two styles make of one tick of `att` attacking into `def`.
 * `units` carries the few team numbers the two special cases read: a choke
 * defence against a pack that is stronger at the set piece (it wants the maul
 * the choke is inviting), and a man-to-man defence against a better attack
 * (every mismatch is a one-on-one it has to win). Exactly neutral (all 1s and
 * 0 ground, the base turnover rate) when either side has no style: a Test side.
 */
export function styleTick(att: SideStyle | undefined, def: SideStyle | undefined,
  units: { attSet: number; defSet: number; attack: number; defence: number }, wx?: StyleWx): StyleTick {
  if (!att || !def) return { m: 0, tryF: 1, penF: 1, turnP: TURN_BASE, ground: 0 }
  const a = atkFx(att.atk, att.pod), d = DEF_FX[def.def]
  const m = MATCHUP[att.atk][def.def]
  let tryF = TRY_NORM * a.tryF * d.tryF * (1 + MATCH_K * m) * (1 + FIT_K * att.atkFit) * (1 - FIT_K * def.defFit)
  if (def.def === 'choke') {
    const pack = clamp(Math.log(Math.max(1, units.attSet) / Math.max(1, units.defSet)) * 4, -1, 1)
    tryF *= 1 + 0.06 * pack
  } else if (def.def === 'man') {
    const edge = clamp(Math.log(Math.max(1, units.attack) / Math.max(1, units.defence)) * 5, -1, 1)
    tryF *= 1 + 0.05 * edge
  }
  const penF = a.penF * d.penF
  let turn = a.turn * d.turn
  // THE CONDITIONS (conditions.ts): a wet ball is dropped, and dropped most
  // by the sides that throw it about; the direct and kicking games and the
  // choke tackle are the wet-weather rugby. Exactly 1 on a dry day.
  if (wx && wx.wet > 0) {
    const handle = att.atk === 'pods' && att.pod === 'nine' ? 0.7 : WET_HANDLE[att.atk]
    turn *= 1 + WET_TURN * wx.wet * handle
    if (def.def === 'choke') turn *= 1 + 0.1 * wx.wet
    tryF *= 1 + wx.wet * WET_TRY[att.atk] - (def.def === 'choke' ? 0.03 * wx.wet : 0)
  }
  if (wx?.windy && att.atk === 'kick') tryF *= 0.97
  const turnP = clamp(TURN_BASE * turn * (1 - 0.15 * m), 0, 0.3)
  return { m, tryF, penF, turnP, ground: a.ground }
}

/** The day as the styles read it (conditions.ts wetness): 0 dry, 0.5 damp,
 *  1 wet, 1.2 snow; and whether the wind is up. */
export interface StyleWx { wet: number; windy: boolean }
/** how much more often a wet ball is turned over, at full wetness, for an
 *  attack that handles an average amount (x WET_HANDLE for each style) */
export const WET_TURN = 0.4
export const WET_HANDLE: Record<AtkStyle, number> = { direct: 0.55, pods: 0.9, width: 1.25, kick: 0.6, offload: 1.6 }
/** what the wet does to each attack's try chance, at full wetness: the
 *  carrying and kicking games suit it, the handling games do not. Averages
 *  close to zero over the five, so the wet moves who scores more than how much */
export const WET_TRY: Record<AtkStyle, number> = { direct: 0.04, pods: 0, width: -0.04, kick: 0.04, offload: -0.05 }
/** the share of a kicking game's territory the wind leaves it: a long kick
 *  into a gale comes back, and one with it runs dead */
export const WIND_TERR = 0.6

/** How hard a side's kicking game pushes the line this tick: its attack's
 *  territory, let through or shut down by the other side's defence, and cut
 *  back when the wind is up. */
export const styleTerr = (att: SideStyle | undefined, def: SideStyle | undefined, windy = false): number =>
  att && def ? ATK_FX[att.atk].terr * DEF_FX[def.def].terr * (windy ? WIND_TERR : 1) : 0

/**
 * CONTACT, AND WHO GETS HURT (1.8.2 depth). A carrying game puts its men
 * into collisions all afternoon, a rush defence hits the men it meets hard,
 * and a choke tackle is two men and a maul; a wide or kicking game spends
 * less of its day in contact. Read as each side's share of the match's
 * injury roll (conditions.ts injuryF), centred so the world's count of
 * injuries barely moves: the styles shift who is hurt, not how many.
 */
/** the knocks a side's own carrying costs it */
export const ATK_CONTACT: Record<AtkStyle, number> = { direct: 1.12, pods: 1.04, width: 0.92, kick: 0.95, offload: 1.0 }
/** the knocks a defence hands out to the side it tackles */
export const DEF_HITS: Record<DefStyle, number> = { drift: 0.93, blitz: 1.1, pendulum: 0.95, man: 1.0, choke: 1.06 }
/** the knocks a defence costs its own tacklers */
export const DEF_OWN: Record<DefStyle, number> = { drift: 0.97, blitz: 1.04, pendulum: 0.97, man: 1.0, choke: 1.05 }

/** the legs a side's two styles cost, on its energy drain */
export const styleDrain = (s: Styles | null): number => (s ? atkFx(s.atk, s.pod).drain * DEF_FX[s.def].drain : 1)

// ---------------------------------------------------------------- the words

export const atkName = (id: AtkStyle) => `styles.atk_${id}`
export const defName = (id: DefStyle) => `styles.def_${id}`
export const atkDesc = (id: AtkStyle) => `styles.atk_${id}Desc`
export const defDesc = (id: DefStyle) => `styles.def_${id}Desc`
/** the style as the commentary says it mid-sentence ("the blitz") */
export const atkSay = (id: AtkStyle) => `styles.sayAtk_${id}`
export const defSay = (id: DefStyle) => `styles.sayDef_${id}`

/** The defences an attack beats and the ones it struggles against, and the
 *  reverse for a defence: for the screen, straight off the matchup table. */
export function atkBeats(id: AtkStyle): { beats: DefStyle[]; weak: DefStyle[] } {
  return { beats: DEF_STYLES.filter(d => MATCHUP[id][d] > 0), weak: DEF_STYLES.filter(d => MATCHUP[id][d] < 0) }
}
export function defBeats(id: DefStyle): { beats: AtkStyle[]; weak: AtkStyle[] } {
  return { beats: ATK_STYLES.filter(a => MATCHUP[a][id] < 0), weak: ATK_STYLES.filter(a => MATCHUP[a][id] > 0) }
}

// ---------------------------------------------------------------- the shapes

/**
 * THE SHAPE OF EACH STYLE, for anything that draws a side playing it (the
 * highlight clip; the Tactics screen draws its own whiteboard versions in
 * ui/tacticsArt.tsx). Numbers in metres and seconds, taken from the coaching
 * study's keyframes: nothing here feeds back into the engine. A picture is
 * free to ignore any field it has no use for.
 *
 * ATTACK
 *   width       how far across the field the ball typically travels in a phase
 *   depth       how deep the first receivers stand behind the ruck
 *   passes      passes before contact in a typical phase
 *   pods        forwards grouped across the field, touch to touch (1-3-3-1)
 *   kick        the phase ends in a kick: hang time and distance of a box kick
 *   offload     the share of tackles the ball comes out of
 * DEFENCE
 *   lineSpeed   m/s the line comes up at
 *   slide       m/s the line slides outwards as the ball goes wide (the drift)
 *   deep        men standing back in the field (the full-back is one)
 *   track       each defender follows his own man rather than a channel
 *   tacklers    men into each tackle (the choke brings two, and keeps it up)
 *   upright     the tackle is made high, the carrier kept on his feet
 */
export interface AtkShape { width: number; depth: number; passes: number; pods?: number[]; kick?: { hang: number; dist: number }; offload: number }
export interface DefShape { lineSpeed: number; slide: number; deep: number; track: boolean; tacklers: number; upright: boolean }

export const ATK_SHAPE: Record<AtkStyle, AtkShape> = {
  direct: { width: 10, depth: 3.5, passes: 1, offload: 0.05 },
  pods: { width: 35, depth: 3, passes: 2, pods: [1, 3, 3, 1], offload: 0.12 },
  width: { width: 60, depth: 5.5, passes: 4, offload: 0.1 },
  kick: { width: 20, depth: 4, passes: 1, kick: { hang: 4.3, dist: 38 }, offload: 0.05 },
  offload: { width: 30, depth: 2.5, passes: 2, offload: 0.45 },
}

export const DEF_SHAPE: Record<DefStyle, DefShape> = {
  drift: { lineSpeed: 2.5, slide: 3, deep: 1, track: false, tacklers: 1, upright: false },
  blitz: { lineSpeed: 5.5, slide: 0, deep: 1, track: false, tacklers: 1, upright: false },
  pendulum: { lineSpeed: 3, slide: 1, deep: 2, track: false, tacklers: 1, upright: false },
  man: { lineSpeed: 3.5, slide: 0, deep: 1, track: true, tacklers: 1, upright: false },
  choke: { lineSpeed: 4, slide: 0.5, deep: 1, track: false, tacklers: 2, upright: true },
}

/**
 * THE STYLES IN A FINISHED MATCH, for the highlight clip and anything else
 * that has only the events. The kick-off line carries all four ids in its
 * values (hA/hD home attack and defence, aA/aD away), and every commentary
 * line in which a style told carries the attacking style as `sa` and the
 * defending one as `sd`. Null for a match played before styles existed.
 */
export function matchStyles(events: readonly { type: string; v?: Record<string, string | number> }[]):
  { home: Partial<Styles>; away: Partial<Styles> } | null {
  const ko = events.find(e => e.type === 'KO' && e.v && ('hA' in e.v || 'aA' in e.v))
  if (!ko?.v) return null
  const v = ko.v
  const A = (x: unknown) => (isAtkStyle(x) ? x : undefined)
  const D = (x: unknown) => (isDefStyle(x) ? x : undefined)
  return { home: { atk: A(v.hA), def: D(v.hD) }, away: { atk: A(v.aA), def: D(v.aD) } }
}
