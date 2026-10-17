// The shapes on the pitch: where the attack and the defence stand, how the
// defence chases, and the called moves drawn as pods, set pieces and tracks.

import { TRACKS, type AtkStyle, type Track, type TrackFrom } from '../clipPlays'
import { clamp, type Pt } from './geometry'

// attack, relative to the ball: [metres behind, metres across] for shirts 1..15;
// the across of the backs is multiplied by the open side (s = +-1, eased)
export const ATT: [number, number, boolean][] = [
  [1.2, -1.8, false], [0.4, 0, false], [1.2, 1.8, false], [3, -3, false], [3, 3, false],
  [5, 6, true], [4.5, -5, true], [2.2, 0, false], [1.5, 2, true], [5, 8, true],
  [7, -12, true], [6.5, 14.5, true], [8, 21, true], [9.5, 28, true], [13, 12, true],
]
// defence, relative to the ball: [metres in front, metres across]
// (1.8.2: spread as a real line is, a couple of metres between the men
// guarding the ruck and five or six between the backs, most of them on the
// side the play is going; across is towards that side)
export const DEF: [number, number][] = [
  [2.2, -2.4], [2.2, 2.2], [2.4, 5.2], [2.4, -5.8], [2.6, 8.6], [2.8, -9.8], [2.8, 12.2], [3, -14.5],
  [5, 0.5], [3, 16.5], [8, -26], [3.2, 21.5], [3.4, 27], [8, 28], [22, 0],
]
/**
 * THE CHASE AFTER A BREAK (1.8.2; owner on 1.8.1: "defensively when a player
 * breaks through, the defenders run away from the ball at the moment in the
 * animation"). 1.8.1 sent all but the nearest two defenders behind the ball
 * jogging back to their own line and five metres out of his lane: on a
 * phone that read as the defence running away from the ball (about a third
 * of their frames on a break had them moving away from it, for up to five
 * seconds at a time). Now everybody goes after the ball:
 *
 *   behind him, the nearest `hunters` chase flat out and the rest scramble
 *     after him, each running at where he WILL be (`lead` seconds on), not
 *     where he is, so they take angles rather than a tail-chase;
 *   ahead of him the cover comes across to cut off his line to the corner:
 *     the furthest point on his route that a man can reach no sooner than
 *     `margin` after him, so the angle is a real one and he gets there just
 *     too late (the clip is of a try; a man who would get there first is one
 *     of the men who dive at him and miss);
 *   and nobody's line is ever more than `maxTurn` (radians) off the line to
 *     the ball, so however a lead point falls nobody is seen running away.
 *
 * Wrong-footed men ahead of him take `react` seconds to stop and turn.
 *
 * ONE SET OF NUMBERS FOR NOW. The tactics' defence styles (drift, blitz,
 * pendulum, man-to-man, choke) are meant to bring their own here, with their
 * own line shape in DEF: a blitz reacts quicker and chases harder, a drift
 * leads the cover further to the corner, a choke sends more hunters.
 */
export interface Chase {
  react: number; hunters: number; huntV: number; coverV: number; scrambleV: number
  lead: number; coverLead: number; margin: number; heels: number; maxTurn: number
  /** a chaser behind the ball runs at this share of the carrier's speed */
  outpace: number
}
export const CHASE: Chase = { react: 0.3, hunters: 2, huntV: 9, coverV: 9, scrambleV: 7, lead: 1.0, coverLead: 3, margin: 0.35, heels: 3.2, maxTurn: 1.2, outpace: 0.93 }
export const TACKLERS = [1, 0, 2, 5, 4, 3, 6, 7]
export const FORWARD_CARRIERS = [8, 4, 6, 1, 5, 7]

// ---- THE CALLED MOVES, DRAWN (1.8.1, game/moves.ts) ----
//
// A PHASE-PLAY SHAPE puts the forwards in its pods for the whole build-up:
// [metres behind the ball, metres across towards the open side] by shirt
// index (0 = No. 1). Anybody not listed stands in the default shape.
export const PODS: Record<string, Record<number, [number, number]>> = {
  // a forward on each edge, a pod of three either side of the ruck
  mv_1331: { 0: [2.2, -9], 1: [3.4, -10.5], 2: [2.2, -12], 3: [2.2, 9], 4: [3.4, 10.5], 7: [2.2, 12], 5: [3, -24], 6: [3, 24] },
  // two on each edge, four in the middle
  mv_242: { 5: [3, -22], 1: [3.4, -25], 6: [3, 22], 7: [3.4, 25], 0: [2.2, -7], 3: [3.2, -4], 4: [3.2, 4], 2: [2.2, 7] },
  // a flat pod of three in front, the 10 behind it for the back door
  mv_backdoor: { 3: [1.2, 5], 4: [1.2, 7.5], 7: [1.2, 10], 9: [6, 8] },
}
/** a bound scrum, our side: [metres behind the mark, metres across] by shirt index */
export const SCRUM_FORM: [number, number][] = [[0.6, -1.2], [0.6, 0], [0.6, 1.2], [1.5, -0.6], [1.5, 0.6], [1.3, -1.9], [1.3, 1.9], [2.4, 0]]
/** a lineout, front to back: the shirt index at each place, and the
 *  metres in from touch (the jumper, No. 4, is second, lifted by 1 and 3) */
export const LINEOUT_ORDER = [0, 3, 2, 5, 4, 7, 6]
export const LINEOUT_Y = [5.8, 7.0, 8.2, 9.6, 10.8, 12.0, 13.4]
/** THE PODS AN ATTACKING STYLE PLAYS IN (1.8.2) when no shape is called:
 *  pods 1-3-3-1, width 2-4-2, direct one-out runners tight on the ruck */
export const STYLE_PODS: Partial<Record<AtkStyle, Record<number, [number, number]>>> = {
  direct: { 0: [2.6, -3.5], 2: [2.6, 3.5], 3: [3.4, -6], 4: [3.4, 6], 5: [3, -9], 6: [3, 9], 7: [2.4, 1.5] },
}
/** every called move has its track or its pods (movesprobe) */
export const CLIP_MOVES = [...new Set([...Object.keys(TRACKS), ...Object.keys(PODS)])]

/** A track's frame on the pitch: the 9 at the base (at a lineout, ten
 *  metres in from touch), how much deeper the backs stand when a move
 *  written for one set piece is run off another, and how much it is
 *  narrowed to fit between the touchlines. */
export function trackFrame(tr: Track, set: TrackFrom, S: Pt, side: number) {
  const touch = S.y < 35 ? 0 : 70, ts = touch === 0 ? 1 : -1
  const base = set === 'lineout' ? { x: S.x, y: touch + ts * 10 } : { x: S.x, y: S.y }
  let shift = tr.set === set || set === 'ruck' || tr.set === 'ruck' ? 0 : set === 'lineout' ? -4 : tr.set === 'lineout' ? 2 : 0
  // and never nearer than the law allows: ten metres back at a lineout,
  // behind the scrum (the backs' own lines only: the 8 and 9 are in it)
  const need = set === 'lineout' ? -10.6 : set === 'scrum' ? -4.8 : Infinity
  let front = -Infinity
  for (const [r, ks] of Object.entries(tr.runs)) if (r === 'W' || r === 'FW' || Number(r) >= 10) front = Math.max(front, ks[0][1])
  if (front + shift > need) shift = need - front
  let maxP = Math.max(1, tr.finish), maxN = 1
  for (const ks of Object.values(tr.runs)) for (const [, , a] of ks) { if (a > maxP) maxP = a; if (-a > maxN) maxN = -a }
  const roomP = side > 0 ? 70 - base.y : base.y, roomN = 70 - roomP
  return { base, shift, scP: clamp((roomP - 3) / maxP, 0.3, 1), scN: clamp((roomN - 3) / maxN, 0.3, 1) }
}

export function openSide(y: number) { return clamp((35 - y) / 12, -1, 1) }
/** how far across a back stands: all to the open side near a touchline, and
 *  split both ways in midfield (scaling by the open side alone stood the
 *  whole backline on the ball there, a blob on the full-pitch view) */
export function backAcross(across: number, y: number, lean: number) {
  // (1.8.2) in midfield the backline stands to the side the play is going,
  // a staggered line, rather than split man by man both ways
  const s = openSide(y)
  return across * clamp(s + lean * (1 - Math.abs(s)), -1, 1)
}
