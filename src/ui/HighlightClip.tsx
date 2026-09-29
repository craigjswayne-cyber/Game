import { useEffect, useRef, useState } from 'react'
import type { MatchEvent } from '../game/model'
import { kitGap } from './kit'

/**
 * ---- THE HIGHLIGHT, NOT THE WHOLE MATCH (1.8.0) ----
 *
 * Owner, 28 Sep 2026: "We are going to need to rethink the animation for the
 * game. Its erratic, not good enough for release. We are aiming for football
 * manager level of animation. Smooth and show tries properly, then just
 * commentary only." The always-on pitch redrew thirty men for every line of
 * commentary, and a line of commentary is not a moment of play: most of them
 * are a ruck, a kick to touch or a bit of colour, so the picture lurched from
 * one guessed shape to the next all afternoon.
 *
 * So the pitch now appears only for a highlight, as FM Mobile does it, and a
 * highlight is played as a piece of animation rather than a series of
 * snapshots:
 *
 *   SMOOTH BY CONSTRUCTION. Every position on screen is a pure function of the
 *   clip's clock. The ball runs an eased path through the build-up (the real
 *   field positions of the lines before the try), stopping at each ruck; each
 *   player stands in a formation worked out from where the ball was a moment
 *   ago (a lag of 0.1 to 0.6 s, longer for men further from the ball), so the
 *   team flows after the ball instead of teleporting. Nothing is ever set: a
 *   frame drawn late is simply the right picture a little later.
 *
 *   A TRY: the build-up phases, a tackle and a ruck at each, then the finish
 *   run to the line with the cover chasing, the grounding, and the banner.
 *   A KICK AT GOAL (Extended): the kicker, the flight, GOOD or WIDE.
 *   INTO THE 22 (Extended): the carries that got there.
 *
 * The commentary under the clip is revealed in time with it (onReveal), so the
 * words describe what the pitch is showing.
 */


/*
 * ---- ROUND TWO (owner, 27 Sep 2026: "much better") ----
 *
 *   THE WHOLE PITCH, STILL. "Use the full pitch camera and lock it": the view
 *   is the field from dead-ball line to dead-ball line and never moves.
 *   THE REFEREE is on it, trailing the ball.
 *   THROUGH THE GAP, NOT OVER PEOPLE. The finisher's line bends through the
 *   widest gap in the defence, nobody stands inside anybody else (a soft push
 *   apart every frame), and the men he beats dive and go to ground.
 *   MORE PASSES. A backs move is three passes along the line (a 3 on 2): the
 *   ball travels faster than the defence can drift, and the last man is over.
 *   THE TRY THE COMMENTARY CALLED. The engine's own line says how the try was
 *   scored, so the clip plays that: an intercept run from halfway, a maul
 *   driven over from a lineout, a chip and regather, a grubber, a crossfield
 *   kick to the wing, a charge-down pounced on.
 *   THE TRY IS ONLY CALLED WHEN THE BALL IS DOWN. Nothing else is written
 *   over the pitch: the "Can they make it?" and maul captions were taken off
 *   at the owner's request (1.8.0).
 *   AN ATTACK THAT DID NOT SCORE ends as it did: the full-back's last-gasp
 *   tackle, or the ball turned over.
 *   THE LAST TEN MINUTES OF A CLOSE MATCH bring the pitch on in Key Moments
 *   too, for the kicks and the attacks that decide it.
 */

export type ClipKind = 'try' | 'review' | 'notry' | 'kick' | 'attack'
/** How the moment is played out, read off the engine's own commentary. */
export type ClipStyle = 'phases' | 'overlap' | 'maul' | 'intercept' | 'chip' | 'grubber' | 'crossfield' | 'charge'

export interface ClipSpec {
  kind: ClipKind
  style: ClipStyle
  /** the attacking side runs towards x = 100 (home) or x = 0 (away) */
  attackHome: boolean
  /** ball positions of the build-up, in field metres (x 0..100 home line to away line, y 0..70) */
  beats: { x: number; y: number; line: number; carrier: number }[]
  /** where the moment ends: the grounding, or the kick spot */
  finish: { x: number; y: number; carrier: number }
  /** the event revealed as the moment lands */
  endLine: number
  /** a TMO review line: revealed as the ball goes down, before the verdict */
  reviewLine?: number
  reviewLabel?: string
  kickGood?: boolean
  /** a drop goal, made or missed (1.8.0): struck in open play with the
   *  defence rushing him, not a place kick with them behind the posts */
  drop?: boolean
  /** tacklers the finisher beats on his way (the commentary says how many) */
  misses: number
  /** how an attack that did not score ends */
  ending?: 'saved' | 'turnover'
  label: string
  sub?: string
  att: [string, string]
  def: [string, string]
  /** pace (1..20) by shirt, index 0 = No. 1 (1.8.0, E10): a quick wing pulls
   *  away from the cover and a slow prop is run down. Absent, everyone is 11. */
  attPace?: (number | undefined)[]
  defPace?: (number | undefined)[]
}

export interface ClipLabels {
  try: string; review: string; notry: string; good: string; wide: string
  turnover: string; saved: string
}

// ---------------------------------------------------------------- building

const STOP = new Set<MatchEvent['type']>(['TRY', 'CON', 'PEN', 'DG', 'HT', 'BRK', 'FT', 'KO', 'YC', 'RC', 'INJ'])
const isKick = (e: MatchEvent) =>
  e.type === 'PEN' || e.type === 'DG' || e.type === 'CON' || e.k === 'comm.penWide' || e.k === 'comm.penWideNamed' || e.k === 'comm.conWide'
  // a drop goal that misses is a kick at goal too (1.8.0): late in a close
  // game it comes on in Key Moments like the one that goes over
  || /^comm\.dropMiss\d/.test(e.k ?? '')
const isTryMoment = (e: MatchEvent) => e.type === 'TRY' || e.fx === 'NOTRY'

/** a stable 0..1 from a number, so a clip replays identically */
const hash = (n: number) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s) }

/** the try, as the commentary called it */
const STYLE: Record<string, ClipStyle> = {
  'comm.try4': 'maul', 'comm.tryPackDrive': 'maul', 'comm.tryMaulRumbles': 'maul', 'comm.tryWet5': 'maul',
  'comm.try13': 'intercept', 'comm.try14': 'chip', 'comm.try8': 'grubber', 'comm.tryWet1': 'grubber',
  'comm.try2': 'crossfield',
  // a charge-down called by the engine (matchEngine chargeDown, 1.8.0): the
  // kick is blocked and the side that blocked it scores
  'comm.tryCharge1': 'charge', 'comm.tryCharge2': 'charge', 'comm.tryCharge3': 'charge', 'comm.tryCharge4': 'charge',
  // the greasy ball squirting loose close in, pounced on after the phases
  'comm.tryWet2': 'phases',
  'comm.try1': 'phases', 'comm.try7': 'phases', 'comm.try10': 'phases', 'comm.try15': 'phases', 'comm.try18': 'phases',
  'comm.try20': 'phases', 'comm.try23': 'phases', 'comm.try25': 'phases',
  'comm.try3': 'overlap', 'comm.try5': 'overlap', 'comm.try6': 'overlap', 'comm.try9': 'overlap', 'comm.try11': 'overlap',
  'comm.try12': 'overlap', 'comm.try16': 'overlap', 'comm.try17': 'overlap', 'comm.try19': 'overlap', 'comm.try21': 'overlap',
  'comm.try22': 'overlap', 'comm.try24': 'overlap', 'comm.try26': 'overlap',
}
/** tacklers beaten on the way: "bumps off three tacklers", "a monstrous fend",
 *  "sits the last man down"; "untouched" and "nobody within five metres" none */
const MISSES: Record<string, number> = {
  'comm.try18': 3, 'comm.try11': 1, 'comm.try21': 1, 'comm.try3': 1, 'comm.try5': 1, 'comm.try16': 0, 'comm.try19': 0,
}
/** lines that are not a side carrying the ball (1.8.0): the defence, a kick,
 *  a set piece, a restart, the state of the game. A side's tackle in its own
 *  22 reads, by field position, like that side "in the 22", and is not an
 *  attack worth a clip */
const NOT_A_CARRY = /^comm\.(def|kick|restart|terr|late|charge|scrum|lineout|pbpRuck|pbpPhases|pbpWet|dropMiss)/
/** an attack in the 22 that ends with the ball lost */
const LOST = new Set(['comm.maulHeldUp', 'comm.howler3', 'comm.howler5'])

export type HighlightLevel = 'key' | 'extended'

/** The last ten minutes of a match within a converted try: the kicks and the
 *  attacks come on in Key Moments too (owner: "cut to a highlight late in
 *  close games - kicks to win, drop goal attempts, last-minute attacks"). */
export function lateAndClose(events: MatchEvent[], i: number): boolean {
  const e = events[i], before = events[i - 1] ?? e
  return !!e && e.min >= 70 && Math.abs(before.homeScore - before.awayScore) <= 7
}

/**
 * The side's own last line before line i. With both sides called every tick
 * (1.8.0, a hundred-odd lines a match) the line just before is as often the
 * other side's as this one's, and "the line before was not in the 22" read
 * every such alternation as a fresh entry: extended highlights went from under
 * one attack clip a match to eight or nine. Looking back to this side's own
 * last line asks the question that was meant - was THIS side already there.
 */
export function lastOwnLine(events: MatchEvent[], i: number): MatchEvent | undefined {
  const e = events[i]
  for (let k = i - 1; k >= Math.max(0, i - 12); k--) {
    const b = events[k]
    if (b.teamId === e.teamId && b.fld != null) return b
  }
  return undefined
}

/** Is line i a moment the pitch comes on for, at this level? */
export function momentAt(events: MatchEvent[], i: number, homeId: string, level: HighlightLevel): ClipKind | null {
  const e = events[i]
  if (!e) return null
  // a try sent upstairs is one highlight with its verdict: the review line
  // (a SUB line, fx TMO, just before the TRY or the NO TRY) is revealed as
  // the ball goes down, and the clip ends on the verdict
  if (e.fx === 'TMO') return null
  if (e.type === 'TRY') return 'try'
  if (e.fx === 'NOTRY') return 'notry'
  if (level !== 'extended' && !lateAndClose(events, i)) return null
  if (isKick(e)) return 'kick'
  // into the opposition 22 from outside it, and no try in the next two lines
  // (the try's own clip will show those carries)
  if (e.fld != null && e.teamId) {
    const up = (f: number) => e.teamId === homeId ? f : 100 - f
    const prev = lastOwnLine(events, i)
    const was = prev?.fld != null ? up(prev.fld) : 0
    const soon = events.slice(i + 1, i + 3).some(isTryMoment)
    if (up(e.fld) >= 78 && was < 78 && !soon && !STOP.has(e.type) && !NOT_A_CARRY.test(e.k ?? '')) return 'attack'
  }
  return null
}

/**
 * The next moment from the cursor on, if the lines between the cursor and it
 * are its own build-up (same side, no stoppage). Only lines already simulated
 * are read, so this never runs the engine.
 */
export function nextMoment(events: MatchEvent[], cursor: number, homeId: string, level: HighlightLevel, played: Set<number>, window = 6): { at: number; kind: ClipKind } | null {
  // a wide window is the Key Moments ticker, which skips the lines between
  const skipping = window > 6
  for (let m = cursor; m < Math.min(events.length, cursor + window); m++) {
    const kind = momentAt(events, m, homeId, level)
    if (kind && !played.has(m)) return { at: m, kind }
    const e = events[m]
    if (skipping) continue
    if (!e || STOP.has(e.type) || (events[m + 1]?.teamId && e.teamId && e.teamId !== events[m + 1].teamId)) break
  }
  return null
}

/** how the try is played: the engine's line, or the line before it (a
 *  charge-down called just before the score) */
function styleOf(events: MatchEvent[], m: number, first: number): ClipStyle {
  const e = events[m]
  if (events[first - 1]?.k === 'comm.flavGrass8' || events[m - 1]?.k === 'comm.flavGrass8') return 'charge'
  const s = e.k ? STYLE[e.k] : undefined
  return s ?? (hash(m * 5) < 0.55 ? 'overlap' : 'phases')
}

export function buildClip(events: MatchEvent[], m: number, kind: ClipKind, homeId: string,
  shirtOf: (playerId?: number) => number | undefined, colours: { home: [string, string]; away: [string, string] },
  labels: ClipLabels, nameOf: (playerId?: number) => string | undefined,
  paceOf?: (home: boolean, shirt: number) => number | undefined): ClipSpec {
  const e = events[m]
  const attackHome = e.teamId === homeId
  const paces = (home: boolean) => paceOf ? Array.from({ length: 15 }, (_, i) => paceOf(home, i + 1)) : undefined
  const up = (f: number) => attackHome ? f : 100 - f       // metres towards their line
  const toX = (u: number) => attackHome ? u : 100 - u
  const att = attackHome ? colours.home : colours.away
  const def = attackHome ? colours.away : colours.home

  if (kind === 'kick') {
    const good = e.type === 'PEN' || e.type === 'DG' || e.type === 'CON'
    const drop = e.type === 'DG' || /^comm\.dropMiss\d/.test(e.k ?? '')
    const u = e.type === 'CON' ? 85 : Math.max(58, Math.min(drop ? 80 : 90, up(e.fld ?? 72)))
    const y = e.type === 'CON' ? 12 + hash(m) * 46 : 16 + hash(m) * 38
    return {
      kind, style: 'phases', attackHome, beats: [], finish: { x: toX(u), y, carrier: shirtOf(e.playerId) ?? 10 }, endLine: m,
      kickGood: good, drop, label: good ? labels.good : labels.wide, att, def, misses: 0,
      sub: nameOf(e.playerId),
    }
  }

  // a review line just before the verdict is part of this moment
  const review = events[m - 1]?.fx === 'TMO' ? m - 1 : -1
  // the build-up: the last three phases at most, the same side, no stoppage
  // between (five phases of a forward carrying 14 m across ran to 22 s)
  const from: number[] = []
  const reach = (review >= 0 ? review : m) - (STYLE[e.k ?? ''] === 'maul' || STYLE[e.k ?? ''] === 'phases' ? 3 : 2)
  for (let k = (review >= 0 ? review : m) - 1; k >= Math.max(0, reach); k--) {
    const b = events[k]
    if (!b || STOP.has(b.type) || (b.teamId && b.teamId !== e.teamId)) break
    from.unshift(k)
  }
  const style: ClipStyle = kind === 'attack' ? (hash(m * 5) < 0.5 ? 'overlap' : 'phases') : styleOf(events, m, from[0] ?? m)
  const kicked = style === 'chip' || style === 'grubber' || style === 'crossfield'
  const endU = kind === 'attack' ? Math.max(80, Math.min(94, up(e.fld ?? 82))) : 103
  // positions: the engine's own for each line, pushed so the play only ever
  // goes forward, and started far enough out for the finish to be a run (or,
  // for a kick through, close enough for the kick to be one)
  const steps = Math.max(2, from.length)
  // AND NO FURTHER OUT THAN THE CLIP HAS TIME FOR (1.8.0). With both sides
  // called every tick the lines before a try are often the same tick's, all
  // at one spot far out, and three phases from 40 m then a run from halfway
  // ran to 17 s. The last ruck is within about 38 m of the line, and 26 m
  // when the TMO's look (3.6 s after the grounding) is to come as well.
  const reach38 = endU - (review >= 0 ? 26 : 38) - 3 * steps
  let u = Math.min(endU - 16, Math.max(kicked ? 70 : style === 'overlap' ? 55 : 40, reach38, from.length ? up(events[from[0]].fld ?? 60) : 60))
  let y = 18 + hash(m * 3) * 34
  const beats: ClipSpec['beats'] = []
  for (let i = 0; i < steps; i++) {
    const line = from[i] ?? -1
    const want = line >= 0 && events[line].fld != null ? up(events[line].fld!) : u + 6
    u = Math.min(endU - 12, Math.max(u + 3 + 3 * hash(m + i), want))
    // the play swings to the open side and back, as phases do
    const swing = (4 + 6 * hash(m * 7 + i)) * (y < 35 ? 1 : -1)
    y = Math.max(9, Math.min(61, y + swing))
    const forward = i < steps - 1 || style === 'overlap' || kicked
    beats.push({ x: toX(u), y, line, carrier: forward ? [8, 4, 6, 1, 5, 7][Math.floor(hash(m + i * 5) * 6)] : [12, 13, 10][Math.floor(hash(m + i) * 3)] })
  }
  // a backs move goes wide to the open side; anything else finishes nearer
  // the touchline it is closest to
  const open = y < 35 ? 1 : -1
  const fy = kind === 'attack' ? Math.max(8, Math.min(62, y + open * 10 * hash(m * 13)))
    : style === 'overlap' ? Math.max(6, Math.min(64, y + open * (18 + 10 * hash(m * 11))))
    : style === 'crossfield' ? (y < 35 ? 62 : 8)
    : Math.max(6, Math.min(64, y + (y < 35 ? -1 : 1) * (6 + 14 * hash(m * 11))))
  const shirt = shirtOf(e.playerId)
  const scorer = style === 'maul' ? (shirt && shirt <= 8 ? shirt : 2)
    : style === 'crossfield' ? (shirt === 11 || shirt === 14 ? shirt : 14)
    : shirt ?? (hash(m) < 0.5 ? 14 : 11)
  // an attack that did not score ends as it did: the ball lost if the next
  // lines say so or the other side has it next, else a try-saving tackle
  let ending: ClipSpec['ending']
  if (kind === 'attack') {
    const after = events.slice(m + 1, m + 4)
    // the ball is lost when the next lines say so, or when the other side's
    // next line has them carrying it; their tackle or a word about the
    // defence (NOT_A_CARRY) is the attack being stopped, not the ball lost
    const lost = after.some(a => a.k && LOST.has(a.k))
      || after.some(a => a.teamId && a.teamId !== e.teamId && !STOP.has(a.type) && !NOT_A_CARRY.test(a.k ?? ''))
    ending = lost ? 'turnover' : 'saved'
  }
  return {
    kind, style, attackHome, beats,
    finish: { x: toX(endU), y: fy, carrier: kind === 'attack' ? 12 : scorer },
    endLine: m,
    reviewLine: review >= 0 ? review : undefined,
    reviewLabel: labels.review,
    misses: kind === 'attack' ? 0 : e.k && e.k in MISSES ? MISSES[e.k] : hash(m * 17) < 0.4 ? 1 : 0,
    ending,
    label: kind === 'try' ? labels.try : kind === 'review' ? labels.review : kind === 'notry' ? labels.notry
      : ending === 'turnover' ? labels.turnover : ending === 'saved' ? labels.saved : '',
    sub: kind === 'attack' ? undefined : nameOf(e.playerId),
    att, def,
    attPace: paces(attackHome), defPace: paces(!attackHome),
  }
}

// ---------------------------------------------------------------- the bake

type Pt = { x: number; y: number }
export interface Timeline {
  reveals: { t: number; line: number }[]
  land: number; end: number; banner: number
  /** the finisher's run, and the defenders allowed to touch him in it */
  run?: [number, number]
  contact: number[]
}

const smooth = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const bez = (a: Pt, c: Pt, b: Pt, s: number): Pt => ({
  x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * c.x + s * s * b.x,
  y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * c.y + s * s * b.y,
})
const bezLen = (a: Pt, c: Pt, b: Pt) => { let L = 0, p = a; for (let s = 0.05; s <= 1.0001; s += 0.05) { const q = bez(a, c, b, s); L += Math.hypot(q.x - p.x, q.y - p.y); p = q } return L }
/** the point a share k of the way ALONG the curve (not of its parameter), so
 *  a runner on a bent line keeps an even pace round the bend */
const bezAlong = (a: Pt, c: Pt, b: Pt, k: number): Pt => {
  const N = 24, cum = [0]
  let p = a
  for (let i = 1; i <= N; i++) { const q = bez(a, c, b, i / N); cum.push(cum[i - 1] + Math.hypot(q.x - p.x, q.y - p.y)); p = q }
  const want = clamp(k, 0, 1) * cum[N]
  let i = 1
  while (i < N && cum[i] < want) i++
  const seg = cum[i] - cum[i - 1]
  return bez(a, c, b, (i - 1 + (seg > 1e-9 ? (want - cum[i - 1]) / seg : 0)) / N)
}

// attack, relative to the ball: [metres behind, metres across] for shirts 1..15;
// the across of the backs is multiplied by the open side (s = +-1, eased)
const ATT: [number, number, boolean][] = [
  [1.2, -1.8, false], [0.4, 0, false], [1.2, 1.8, false], [3, -3, false], [3, 3, false],
  [5, 6, true], [4.5, -5, true], [2.2, 0, false], [1.5, 2, true], [5, 8, true],
  [7, -13, true], [7, 15, true], [9, 22, true], [11, 29, true], [15, 10, true],
]
// defence, relative to the ball: [metres in front, metres across]
const DEF: [number, number][] = [
  [2.4, -2], [2.2, 0.5], [2.4, 3], [2.8, -6], [2.8, 6], [3, -10], [3, 10], [3.4, -14],
  [3.6, 3], [3.8, 14], [8, -26], [4, 19], [4.2, 24], [8, 28], [22, 0],
]
const TACKLERS = [1, 0, 2, 5, 4, 3, 6, 7]
const FORWARD_CARRIERS = [8, 4, 6, 1, 5, 7]

function openSide(y: number) { return clamp((35 - y) / 12, -1, 1) }
/** how far across a back stands: all to the open side near a touchline, and
 *  split both ways in midfield (scaling by the open side alone stood the
 *  whole backline on the ball there, a blob on the full-pitch view) */
function backAcross(i: number, across: number, y: number) {
  const s = openSide(y)
  return across * s + (1 - Math.abs(s)) * Math.abs(across) * (i % 2 ? 0.8 : -0.8)
}

/**
 * SMOOTH BY CONSTRUCTION, WITH LEGS. Everybody on the pitch is a body with a
 * top speed and an acceleration: they are steered towards where they ought to
 * be (their place in the shape, the ruck, the man with the ball) and can only
 * get there as fast as a player could. The scrum-half passes to where the
 * receiver actually is, the receiver has been drifting into position since
 * the last ruck, and the run is at a runner's pace, accelerating off the catch.
 *
 * The whole clip is simulated once at 60 steps a second when it is built and
 * then only read back, so a frame is still a pure function of the clock: a
 * late frame is the right picture a little later, and hlprobe can measure it.
 */
const FPS = 60, DT = 1 / FPS
const V_PLAYER = 11, A_PLAYER = 16
/** REAL PACE (E10): a man's top speed from his pace, from 0.92x at 1 to
 *  1.12x at 20, and exactly as before for an average man (10.5). The slow
 *  end is gentler: a slow man is run down by the cover, not filmed in slow
 *  motion, and a clip must not drag past 16 s. */
const paceK = (pac: number | undefined) => pac == null ? 1
  : pac < 10.5 ? 1 - 0.08 * clamp((10.5 - pac) / 9.5, 0, 1) : 1 + 0.12 * clamp((pac - 10.5) / 9.5, 0, 1)
/** hlprobe's ceiling is 13 m/s: nobody sprints past it, however quick */
const V_CAP = 12.8
/** how close two players stand before they are eased apart (m) */
const ROOM = 1.3

class Body {
  vx = 0; vy = 0
  /** seconds left on the floor after a missed tackle */
  down = 0
  /** in contact this frame (a ruck, a maul, a tackle): not eased apart */
  touch = false
  constructor(public x: number, public y: number) {}
  /** arrive at (tx, ty): full speed from far, easing in close, never faster than vmax */
  steer(tx: number, ty: number, vmax: number, amax: number, k = 2.4) {
    if (this.down > 0) { this.down -= DT; tx = this.x; ty = this.y; amax = 30 }
    const dx = tx - this.x, dy = ty - this.y, dist = Math.hypot(dx, dy)
    const want = Math.min(vmax, dist * k)
    const dvx = (dist > 1e-6 ? dx / dist * want : 0) - this.vx, dvy = (dist > 1e-6 ? dy / dist * want : 0) - this.vy
    let ax = dvx * 8, ay = dvy * 8
    const a = Math.hypot(ax, ay)
    if (a > amax) { ax *= amax / a; ay *= amax / a }
    this.vx += ax * DT; this.vy += ay * DT
    const v = Math.hypot(this.vx, this.vy)
    if (v > vmax) { this.vx *= vmax / v; this.vy *= vmax / v }
    // never over the touchline or the dead-ball line, however hard the turn
    this.x = clamp(this.x + this.vx * DT, -PAD + 1.4, 100 + PAD - 1.4)
    this.y = clamp(this.y + this.vy * DT, 0.4, 69.6)
  }
  /** put it exactly here (the ball carrier on his line), keeping the velocity honest */
  place(x: number, y: number) { this.vx = (x - this.x) / DT; this.vy = (y - this.y) / DT; this.x = x; this.y = y }
  /** onto the ball, but never faster than a sprint: a man who is a stride off
   *  it when it reaches him closes the stride instead of jumping it */
  hold(x: number, y: number) {
    const dx = x - this.x, dy = y - this.y, dist = Math.hypot(dx, dy), max = 11 * DT
    if (dist <= max) this.place(x, y)
    else this.place(this.x + dx / dist * max, this.y + dy / dist * max)
  }
}

/** a run: off the mark, a steady pace, and slowing into the contact or the dive */
function runK(t: number, T: number, ta: number): number {
  if (t <= 0) return 0
  if (t >= T) return 1
  const v = 1 / (T - ta)
  if (t < ta) return 0.5 * v * t * t / ta
  if (t > T - ta) return 1 - 0.5 * v * (T - t) * (T - t) / ta
  return v * (ta / 2 + (t - ta))
}

interface Baked {
  tl: Timeline; n: number
  ball: Float32Array; att: Float32Array; def: Float32Array; ref: Float32Array
  /** 30 a frame: the attack's 15, then the defence's */
  carry: Float32Array; down: Float32Array
}

type RunEnd = 'ruck' | 'feed' | 'score' | 'held'
type Phase =
  | { k: 'ruck'; q: Pt; dur: number; tackled?: number; tackler?: number }
  | { k: 'dig'; q: Pt; dur: number }
  | { k: 'pass'; who: number; dur: number; from?: Pt }
  | { k: 'run'; to: Pt; who: number; line: number; end: RunEnd; dur: number; ta?: number; from?: Pt; ctrl?: Pt; tackler: number }
  | { k: 'kick'; who: number; chaser: number; to: Pt; loft: number; low: boolean; dur: number; from?: Pt }
  | { k: 'done'; who: number; dur: number }

function bake(c: ClipSpec): Baked {
  const d = c.attackHome ? 1 : -1
  const U = (u: number) => c.attackHome ? u : 100 - u
  const uOf = (x: number) => c.attackHome ? x : 100 - x
  // a man's whole dot inside the dead-ball line, not only his middle
  const fieldX = (x: number) => clamp(x, -PAD + 1.4, 100 + PAD - 1.4)
  const fieldY = (y: number) => clamp(y, 1, 69)
  const reveals: { t: number; line: number }[] = []
  const contact: number[] = []
  let land = 0, banner = 0, end = 0
  let run: [number, number] | undefined

  // ---- the shapes: dir is the way the side with the ball is going
  // IN-GOAL ONLY WHEN THE PLAY IS THERE (owner, 1.8.0: the full-back stood
  // past the dead-ball line). `dir` points at the line the side is defending;
  // nobody stands behind it until the ball is within eight metres of it, and
  // then no more than two and a half metres back.
  const ownLine = (x: number, b: Pt, dir: number) => {
    const line = dir > 0 ? 100 : 0
    const room = (line - b.x) * dir < 8 ? 2.5 : 0
    return dir > 0 ? Math.min(x, line + room) : Math.max(x, line - room)
  }
  const shapeAtt = (i: number, b: Pt, dir: number): Pt => {
    const [back, across, open] = ATT[i]
    // the side with the ball stays out of its own in-goal too (a clearance
    // from their 22 stood their full-back five metres behind his line)
    return { x: fieldX(ownLine(b.x - dir * back, b, -dir)), y: fieldY(b.y + (open ? backAcross(i, across, b.y) : across)) }
  }
  const shapeDef = (i: number, b: Pt, dir: number): Pt => {
    if (i === 14) return { x: fieldX(ownLine(b.x + dir * 22, b, dir)), y: fieldY(35 + (b.y - 35) * 0.4) }
    const [ahead, across] = DEF[i]
    return { x: fieldX(ownLine(b.x + dir * ahead, b, dir)), y: fieldY(b.y + across) }
  }

  // ---- the bodies
  const ball = { x: 0, y: 0, lift: 0 }
  const start: Pt = c.kind === 'kick' ? c.finish
    : c.style === 'intercept' ? { x: U(50), y: c.beats[0].y }
    : c.style === 'charge' ? { x: U(90), y: c.beats[0].y }
    : c.beats[0]
  ball.x = start.x; ball.y = start.y
  // who has the ball at the start: the defence, for an intercept or a charge-down
  const theirs = c.style === 'intercept' || c.style === 'charge'
  // a drop goal: struck from the pocket seven metres behind the last ruck,
  // the attack's shape on that ruck and the defence set in front of it,
  // coming up hard at him
  const ruckAt: Pt = { x: fieldX(c.finish.x + d * 7), y: c.finish.y }
  const dropAt = (i: number, rush: number): Pt => { const q = shapeDef(i, ruckAt, d); return { x: fieldX(q.x + d * rush), y: q.y } }
  const att = Array.from({ length: 15 }, (_, i) => {
    const p = c.kind === 'kick' && c.drop ? shapeAtt(i, ruckAt, d)
      : c.kind === 'kick' ? { x: fieldX(c.finish.x - d * (8 + (i % 5) * 2.5)), y: fieldY(10 + i * 3.6) }
      : theirs ? shapeDef(i, start, -d) : shapeAtt(i, start, d)
    return new Body(p.x, p.y)
  })
  const def = Array.from({ length: 15 }, (_, i) => {
    const p = c.kind === 'kick' && c.drop ? dropAt(i, 2)
      : c.kind === 'kick' ? { x: fieldX((c.attackHome ? 100 : 0) + d * 3), y: fieldY(22 + (i % 8) * 3.6) }
      : theirs ? shapeAtt(i, start, -d) : shapeDef(i, start, d)
    return new Body(p.x, p.y)
  })
  // THE REFEREE, a few metres behind the play on the open side
  const refSpot = (): Pt => c.kind === 'kick'
    ? { x: fieldX((c.attackHome ? 100 : 0) - d * 4), y: 45 }
    // a charge-down: he follows the ball in from the field side, to see it
    // grounded, rather than waiting on the dead-ball line
    : c.style === 'charge' ? { x: fieldX(ownLine(ball.x - d * 6, ball, d)), y: fieldY(ball.y + (ball.y < 35 ? 8 : -8)) }
    : { x: fieldX(ball.x - (theirs ? -d : d) * 7), y: fieldY(ball.y + (ball.y < 35 ? 8 : -8)) }
  const ref = new Body(refSpot().x, refSpot().y)
  let carrier = -1   // 0..14 the attack, 15..29 the defence

  /** nobody stands inside anybody: a soft push apart, never more than a
   *  walking pace, and never for men in contact or the man with the ball */
  const separate = () => {
    const all = [...att, ...def, ref]
    const held = carrier < 0 ? null : carrier < 15 ? att[carrier] : def[carrier - 15]
    const mx = new Float64Array(all.length), my = new Float64Array(all.length)
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
      const p = all[a], q = all[b]
      if ((p.touch && q.touch) || (p.touch && q === held) || (q.touch && p === held)) continue
      const dx = q.x - p.x, dy = q.y - p.y, dist = Math.hypot(dx, dy)
      if (dist >= ROOM || dist < 1e-6) continue
      const ux = dx / dist * (ROOM - dist) / 2, uy = dy / dist * (ROOM - dist) / 2
      mx[a] -= ux; my[a] -= uy; mx[b] += ux; my[b] += uy
    }
    // however many neighbours lean on a man, he gives no more than a walk a frame
    all.forEach((p, i) => {
      if (p === held) return
      const m = Math.hypot(mx[i], my[i])
      if (m < 1e-9) return
      const k = Math.min(1, 0.012 / m)
      p.x += mx[i] * k; p.y += my[i] * k
    })
  }

  // ---- write it down, 60 frames a second
  const frames: { ball: number[]; att: number[]; def: number[]; ref: number[]; carry: number[]; down: number[] }[] = []
  const snap = (t: number) => {
    // a little life, the same for everybody all the time (switching it off for
    // the ball carrier made him hop 40 cm on the catch)
    const wob = (i: number, a: number) => [Math.sin(t * 1.7 + i * 1.3 + a) * 0.15, Math.cos(t * 1.3 + i * 0.9 + a) * 0.15]
    frames.push({
      ball: [ball.x, ball.y, ball.lift],
      att: att.flatMap((b, i) => [b.x + wob(i, 0)[0], b.y + wob(i, 0)[1]]),
      def: def.flatMap((b, i) => [b.x + wob(i, 2)[0], b.y + wob(i, 2)[1]]),
      ref: [ref.x, ref.y],
      carry: Array.from({ length: 30 }, (_, i) => i === carrier ? 1 : 0),
      down: [...att, ...def].map(b => b.down > 0 ? 1 : 0),
    })
  }
  const record = (endAt: () => number, step: (t: number) => void): Baked => {
    snap(0)
    for (let f = 1; ; f++) {
      const t = f * DT
      for (const b of [...att, ...def]) b.touch = false
      step(t)
      separate()
      const r = refSpot(); ref.steer(r.x, r.y, 8.5, 10)
      snap(t)
      if (t > endAt() + 0.5 || f > FPS * 40) break
    }
    const n = frames.length
    const pack = (key: 'ball' | 'att' | 'def' | 'ref' | 'carry' | 'down', w: number) => {
      const a = new Float32Array(n * w)
      frames.forEach((fr, i) => a.set(fr[key], i * w))
      return a
    }
    return {
      tl: { reveals, land, banner, end, run, contact }, n,
      ball: pack('ball', 3), att: pack('att', 30), def: pack('def', 30), ref: pack('ref', 2), carry: pack('carry', 30), down: pack('down', 30),
    }
  }
  /** the build-up lines, read out over the set-up of a set piece */
  const readOut = (from: number, gap: number) => c.beats.forEach((b, j) => { if (b.line >= 0) reveals.push({ t: from + j * gap, line: b.line }) })
  /** a place behind a runner, for the men chasing him or backing him up */
  const trail = (b: Body, i: number, dir: number, vmax: number) =>
    ({ x: fieldX(b.x - dir * (3.5 + (i % 4) * 1.5)), y: fieldY(b.y + ((i % 5) - 2) * 2.2), vmax })
  /** THE COVER RUNS BACK (1.8.1). A defender the ball has gone past is never
   *  sent further from his own line than he already is (`dir` is the way the
   *  attack is going, which is towards that line): he stops, turns and
   *  heads home, and steer's acceleration cap makes it a turn, not a snap. */
  const homeward = <Q extends Pt>(b: Body, q: Q, dir: number): Q => ((q.x - b.x) * dir < 0 ? { ...q, x: b.x } : q)
  /** the ball is down: the verdict now, or after the TMO's look */
  const grounded = (t: number) => {
    land = t
    banner = c.reviewLine != null ? land + 2.0 : land + 0.05
    end = land + (c.reviewLine != null ? 3.6 : 2.1)
    if (c.reviewLine != null) reveals.push({ t: land, line: c.reviewLine })
  }
  const endAfter = () => land > 0 ? end : Infinity

  // =========================================================== a kick at goal
  if (c.kind === 'kick') {
    const posts = { x: c.attackHome ? 100 : 0, y: 35 + (c.kickGood ? 0 : (c.finish.y < 35 ? -1 : 1) * 5.2) }
    const flight = Math.max(1.5, Math.hypot(posts.x - c.finish.x, posts.y - c.finish.y) / 24)
    land = 0.9 + flight; banner = land - 0.1; end = land + 1.7
    const kicker = c.finish.carrier - 1
    att[kicker].x = c.finish.x - d * 1.2; att[kicker].y = c.finish.y
    carrier = kicker
    return record(() => end, (t) => {
      const k = smooth((t - 0.9) / flight)
      ball.x = lerp(c.finish.x, posts.x, k); ball.y = lerp(c.finish.y, posts.y, k)
      ball.lift = k > 0 && k < 1 ? Math.sin(Math.PI * k) * 9 : 0
      carrier = t < 0.9 ? kicker : -1
      for (let i = 0; i < 15; i++) {
        if (i === kicker) { const kx = t < 0.9 ? c.finish.x - d * 1.2 : c.finish.x + d * 2; att[i].steer(kx, c.finish.y, 6, 10) }
        else if (c.drop) { const p = shapeAtt(i, ruckAt, d); att[i].steer(p.x, p.y, 3, A_PLAYER) }
        else { const p = { x: fieldX(c.finish.x - d * (8 + (i % 5) * 2.5)), y: fieldY(10 + i * 3.6) }; att[i].steer(p.x, p.y, V_PLAYER, A_PLAYER) }
        // a drop goal: they come up hard until it is struck, then turn to watch
        const q = c.drop ? dropAt(i, t < 0.9 ? -2 : 0)
          : { x: fieldX((c.attackHome ? 100 : 0) + d * 3), y: fieldY(22 + (i % 8) * 3.6) }
        def[i].steer(q.x, q.y, c.drop ? (t < 0.9 ? 7 : 2) : V_PLAYER, A_PLAYER)
      }
    })
  }

  // =========================================================== a maul
  // Owner: "driving mauls over from the lineout". The lineout is five metres
  // out; the jumper takes it, the pack binds round him, and the maul goes
  // over at a walking pace with the ball at the back.
  if (c.style === 'maul') {
    const touchY = c.beats[c.beats.length - 1].y < 35 ? 0 : 70
    const s = touchY === 0 ? 1 : -1
    const x0 = U(95)
    const scorer = c.finish.carrier - 1
    // the lineout
    for (let j = 0, k = 0; j < 8; j++) {
      if (j === 1) continue
      const yy = touchY + s * (5 + k++ * 1.2)
      att[j].x = x0 - d * 0.6; att[j].y = yy
      def[j].x = x0 + d * 0.6; def[j].y = yy
    }
    att[1].x = x0; att[1].y = touchY + s * 0.8
    def[1].x = x0 + d * 2; def[1].y = touchY + s * 1.6
    const backsAt = { x: x0 - d * 6, y: touchY + s * 24 }, lineAt = { x: x0, y: touchY + s * 22 }
    for (let i = 8; i < 15; i++) {
      const p = shapeAtt(i, backsAt, d), q = shapeDef(i, lineAt, d)
      att[i].x = p.x; att[i].y = p.y; def[i].x = q.x; def[i].y = q.y
    }
    ball.x = att[1].x; ball.y = att[1].y; carrier = 1
    const jumper = { x: x0 - d * 0.6, y: touchY + s * 7.4 }
    const THROW = 0.7, CATCH = 1.4, BOUND = 2.3, PACE = 1.5
    // the maul's front, and the ball two metres behind it
    let front = { x: jumper.x + d * 0.3, y: jumper.y }
    const ATTS: [number, number][] = [[0.3, -0.8], [0.3, 0.8], [1.0, -1.3], [1.0, 0], [1.0, 1.3], [1.7, -0.7], [1.7, 0.7]]
    const order = [0, 1, 2, 3, 4, 5, 6, 7].filter(j => j !== scorer)
    const DEFS: [number, number][] = [[-0.7, -1], [-0.7, 0], [-0.7, 1], [-1.4, -1.3], [-1.4, -0.4], [-1.4, 0.5], [-1.4, 1.4], [-2.1, 0]]
    readOut(0.1, 0.5)
    const slot = (sl: [number, number], i: number): Pt => ({ x: front.x - d * sl[0], y: front.y + sl[1] + Math.sin(i * 1.7) * 0.2 })
    return record(endAfter, (t) => {
      if (t < THROW) { ball.x = att[1].x; ball.y = att[1].y; ball.lift = 0; carrier = 1 }
      else if (t < CATCH) {
        const k = smooth((t - THROW) / (CATCH - THROW))
        ball.x = lerp(att[1].x, jumper.x, k); ball.y = lerp(att[1].y, jumper.y, k); ball.lift = Math.sin(Math.PI * k) * 3.5 + k * 1.2
        carrier = -1
      } else {
        // the drive: slow at first, then rolling
        if (t > BOUND && land <= 0) {
          const v = PACE * clamp((t - BOUND) / 0.8, 0.2, 1)
          front = { x: front.x + d * v * DT, y: front.y + Math.sin(t * 1.3) * 0.004 }
        }
        const back = { x: front.x - d * 2.1, y: front.y }
        const k = smooth((t - CATCH) / (BOUND - CATCH))
        ball.x = lerp(jumper.x, back.x, k); ball.y = lerp(jumper.y, back.y, k); ball.lift = lerp(1.2, 0.4, k)
        carrier = t < BOUND ? 3 : scorer
        if (land <= 0 && uOf(ball.x) >= 101.2) grounded(t)
        if (land > 0) ball.lift = 0
      }
      for (let i = 0; i < 8; i++) {
        att[i].touch = def[i].touch = t > CATCH
        // the hooker stands on his mark until the throw (holding him a step
        // behind a ball that sat on him walked him seven metres back from
        // the touchline before it went in)
        if (i === carrier) { if (t >= THROW) att[i].hold(ball.x - d * 0.4, ball.y); else att[i].place(att[i].x, att[i].y); continue }
        const a = t < CATCH ? { x: att[i].x, y: att[i].y } : i === scorer ? { x: ball.x - d * 0.4, y: ball.y } : slot(ATTS[order.indexOf(i)], i)
        const q = t < CATCH ? { x: def[i].x, y: def[i].y } : slot(DEFS[i], i + 9)
        att[i].steer(a.x, a.y, V_PLAYER, A_PLAYER); def[i].steer(q.x, q.y, V_PLAYER, A_PLAYER)
      }
      for (let i = 8; i < 15; i++) {
        const p = shapeAtt(i, { x: front.x - d * 6, y: touchY + s * 24 }, d), q = shapeDef(i, { x: front.x, y: touchY + s * 22 }, d)
        att[i].steer(p.x, p.y, V_PLAYER, A_PLAYER); def[i].steer(q.x, q.y, V_PLAYER, A_PLAYER)
      }
    })
  }

  // =========================================================== an intercept
  // Owner: "include interception tries". They have the ball on halfway; the
  // pass is read and taken, and it is a race to the line.
  if (c.style === 'intercept') {
    const who = clamp(c.finish.carrier >= 9 ? c.finish.carrier : 13, 9, 15) - 1
    const passer = 9, target = 11   // their 10 to their 12
    const SET = 0.6
    let p1 = 0, p2 = 0, t2 = 0, caught = 0, T = 0
    let from: Pt = { ...ball }, go: Pt = { ...ball }
    readOut(0.1, 0.5)
    let path: Pt = { x: 0, y: 0 }
    let hunt = new Set<number>(), back = new Set<number>()
    const beaten: { i: number; dove: number }[] = []
    return record(endAfter, (t) => {
      carrier = -1
      if (t < SET) { /* the ruck */ }
      else if (!p2) {
        // their 9 to their 10, who takes a stride and moves it on
        const r = def[passer]
        if (!p1) p1 = clamp(Math.hypot(r.x - start.x, r.y - start.y) / 17, 0.3, 0.8)
        const k = smooth((t - SET) / p1)
        ball.x = lerp(start.x, r.x, k); ball.y = lerp(start.y, r.y, k); ball.lift = Math.sin(Math.PI * k) * 0.8
        if (k >= 1) {
          carrier = 15 + passer
          if (t > SET + p1 + 0.45) {
            t2 = t; from = { x: ball.x, y: ball.y }
            p2 = clamp(Math.hypot(att[who].x - ball.x, att[who].y - ball.y) / 18, 0.4, 1.0)
          }
        }
      } else if (!caught) {
        // ... and it is read and taken
        const k = smooth((t - t2) / p2), r = att[who]
        ball.x = lerp(from.x, r.x + d * 0.4, k); ball.y = lerp(from.y, r.y, k); ball.lift = Math.sin(Math.PI * k) * 0.9
        if (k >= 1) {
          caught = t; go = { x: r.x + d * 0.4, y: r.y }
          // through the gap in their backline, and anybody in it grabs at air
          path = { x: (go.x + c.finish.x) / 2, y: (go.y + c.finish.y) / 2 }
          let bestSc = -Infinity
          for (let off = -12; off <= 12; off += 2) {
            const ctrl = { x: path.x, y: fieldY((go.y + c.finish.y) / 2 + off) }
            let clear = Infinity
            for (let s = 0.05; s <= 0.6; s += 0.05) { const q = bez(go, ctrl, c.finish, s); for (const b of def) clear = Math.min(clear, Math.hypot(b.x - q.x, b.y - q.y), Math.hypot(b.x + b.vx * 0.4 - q.x, b.y + b.vy * 0.4 - q.y)) }
            const sc = Math.min(clear, 8) - Math.abs(off) * 0.1
            if (sc > bestSc) { bestSc = sc; path = ctrl }
          }
          def.forEach((b, i) => {
            const bx = b.x + b.vx * 0.4, by = b.y + b.vy * 0.4
            for (let s = 0.02; s <= 0.7; s += 0.04) { const q = bez(go, path, c.finish, s); if (Math.hypot(b.x - q.x, b.y - q.y) < 2.6 || Math.hypot(bx - q.x, by - q.y) < 2.6) { beaten.push({ i, dove: 0 }); contact.push(i); break } }
          })
          T = bezLen(go, path, c.finish) / 10 + 0.5
          const near = (bs: Body[]) => bs.map((b, i) => ({ i, dd: Math.hypot(b.x - go.x, b.y - go.y) })).sort((a, b) => a.dd - b.dd).map(r => r.i)
          // the nearest two chase; four all converging read as a swarm
          hunt = new Set(near(def).filter(i => !beaten.some(x => x.i === i)).slice(0, 2))
          back = new Set(near(att).filter(i => i !== who).slice(0, 2))
          run = [caught, caught + T]
          grounded(caught + T)
        }
      }
      if (caught) {
        const k = runK(t - caught, T, 0.5)
        const at = bezAlong(go, path, c.finish, k)
        ball.x = at.x; ball.y = at.y; ball.lift = 0
        att[who].hold(ball.x - d * 0.4, ball.y)
        carrier = who
      }
      // before the catch: they attack, we defend; after it: we run, they chase
      for (let i = 0; i < 15; i++) {
        if (!caught) {
          const a = i === who ? { x: lerp(att[i].x, def[target].x, 0.4), y: lerp(att[i].y, def[target].y, 0.4) } : shapeDef(i, ball, -d)
          if (i === who) att[i].touch = true
          att[i].steer(a.x, a.y, V_PLAYER, A_PLAYER)
          if (i === passer && carrier === 15 + passer) { def[i].touch = true; def[i].hold(fieldX(def[i].x - d * 5 * DT), def[i].y); ball.x = def[i].x; ball.y = def[i].y; continue }
          const q = i === target ? { x: fieldX(def[passer].x + d * 3.5), y: fieldY(def[passer].y + (def[passer].y < 35 ? 8 : -8)) } : shapeAtt(i, ball, -d)
          def[i].steer(q.x, q.y, V_PLAYER, A_PLAYER)
        } else {
          // the interceptor is carried above; only his own shirt is skipped
          // here (a `continue` for the whole index used to freeze the
          // defender who wore the same number for the rest of the run)
          if (i !== who) {
            const a = back.has(i) ? trail(att[who], i, d, 9.5) : { x: fieldX(att[who].x - d * (12 + (i % 5) * 3)), y: lerp(att[i].y, att[who].y, 0.3), vmax: 5 }
            att[i].steer(a.x, a.y, a.vmax, A_PLAYER)
          }
          const b = beaten.find(x => x.i === i)
          const near = Math.hypot(def[i].x - att[who].x, def[i].y - att[who].y)
          if (b && !b.dove && near < 2.4) b.dove = t
          if (b && b.dove && t - b.dove < 0.3) { def[i].touch = true; def[i].steer(ball.x - d * 1.2, ball.y, V_PLAYER, A_PLAYER); continue }
          if (b && b.dove && !def[i].down && t - b.dove < 0.35) def[i].down = 1.1
          // ahead of him they are wrong-footed; once he is past they chase
          const ahead = (def[i].x - att[who].x) * d > 0.3
          // (the rest turn for their own line rather than to a spot behind
          // him, which a man he had just passed reached by running up-field)
          const q = ahead ? { x: def[i].x + d * 0.4, y: def[i].y, vmax: 2.5 }
            : homeward(def[i], hunt.has(i) ? trail(att[who], i + 3, d, 8.8)
              : { x: fieldX(def[i].x + d * 8), y: def[i].y, vmax: 5.5 }, d)
          def[i].steer(q.x, q.y, q.vmax, A_PLAYER)
        }
      }
    })
  }

  // =========================================================== a charge-down
  // Owner: "kicks can be charged down and the other team can turn over and
  // score"; and in 1.8.0, with the engine now calling charge-downs, the clip
  // shows the kick, the block, the bounce and the score. Their fly-half stands deep
  // to clear from his own 22; the charger comes off the line as the pass goes,
  // meets the ball on the boot, and it cannons back over their line, bouncing,
  // with him after it. The block is the moment the engine's charge-down line
  // is read out, so the words land on the picture.
  if (c.style === 'charge') {
    const kicker = 9, chargerI = clamp(c.finish.carrier, 1, 15) - 1
    // the fly-half stands deep and to the charger's side of the ruck, so the
    // charger's run at him is not through the ruck
    const side = Math.sign(att[chargerI].y - ball.y) || 1
    const setUp = { x: fieldX(U(96)), y: fieldY(ball.y + side * 5) }
    const PASS = 0.5, KICK = 1.4, HIT = 0.1, T = 1.15
    const spot = { x: fieldX(U(102.2)), y: fieldY(ball.y + (ball.y < 35 ? 3 : -3)) }
    let from: Pt = { ...ball }, block: Pt = { ...ball }
    // the build-up read out over the ruck, and the charge-down line itself
    // (the last of them) as the ball hits him
    c.beats.forEach((bt, j) => {
      if (bt.line < 0) return
      reveals.push({ t: j === c.beats.length - 1 && c.beats.length > 1 ? KICK + HIT : 0.1 + j * 0.4, line: bt.line })
    })
    // who races for the loose ball: picked at the block, the nearest to it
    let follow = new Set<number>(), chase = new Set<number>()
    const nearest = (bs: Body[], p: Pt, skip: number, n: number) => new Set(bs.map((q, i) => ({ i, dd: Math.hypot(q.x - p.x, q.y - p.y) }))
      .filter(r => r.i !== skip).sort((x, y) => x.dd - y.dd).slice(0, n).map(r => r.i))
    return record(endAfter, (t) => {
      if (t >= KICK && !follow.size) { follow = nearest(att, block, chargerI, 3); chase = nearest(def, block, kicker, 3) }
      if (t < PASS) { carrier = -1 }
      else if (t < KICK - 0.35) {
        const k = smooth((t - PASS) / 0.45), r = def[kicker]
        ball.x = lerp(start.x, r.x, k); ball.y = lerp(start.y, r.y, k); ball.lift = Math.sin(Math.PI * k) * 0.6
        carrier = k >= 1 ? 15 + kicker : -1
      } else if (t < KICK) {
        // in his hands, dropping it onto the boot
        ball.x = def[kicker].x; ball.y = def[kicker].y; ball.lift = 0.3 * (KICK - t) / 0.35 + 0.2; carrier = 15 + kicker
        from = { x: ball.x, y: ball.y }
        block = { x: fieldX(from.x - d * 1.3), y: from.y }
      } else if (t < KICK + HIT) {
        // off the boot and straight into him
        carrier = -1
        const k = (t - KICK) / HIT
        ball.x = lerp(from.x, block.x, k); ball.y = lerp(from.y, block.y, k); ball.lift = 0.4 + k * 0.8
      } else {
        // and back the way it came, bouncing over their line
        carrier = -1
        const k = clamp((t - KICK - HIT) / T, 0, 1), e = 1 - (1 - k) * (1 - k)
        ball.x = lerp(block.x, spot.x, e); ball.y = lerp(block.y, spot.y, e)
        ball.lift = Math.abs(Math.sin(k * Math.PI * 3)) * 1.4 * (1 - k)
        if (!land) { grounded(KICK + HIT + T); run = [KICK, land] }
        if (t >= land) { carrier = chargerI; ball.lift = 0 }
      }
      for (let i = 0; i < 15; i++) {
        if (i === chargerI) {
          att[i].touch = true
          if (land > 0 && t >= land) att[i].hold(spot.x - d * 0.4, spot.y)
          else if (t < KICK) {
            // off the line as the pass goes, at the kicker
            const go = t > 0.15
            const tgt = go ? { x: def[kicker].x - d * 1.4, y: def[kicker].y } : shapeDef(i, start, -d)
            att[i].steer(tgt.x, tgt.y, V_PLAYER, A_PLAYER + 4)
          } else att[i].steer(ball.x - d * 0.5, ball.y, V_PLAYER, A_PLAYER + 4)
        } else {
          // after the block: the nearest few race in behind him, the rest
          // come up at a jog
          // (their shape is set on the ruck, not on the kicker, so the man
          // standing deep to kick is on his own and the charger's run is clear)
          const a: Pt & { vmax?: number } = t < KICK ? shapeDef(i, start, -d)
            : follow.has(i) ? trail(att[chargerI], i, d, 9)
            : { x: fieldX(lerp(att[i].x, ball.x - d * (12 + (i % 5) * 3), 0.5)), y: att[i].y, vmax: 4 }
          att[i].steer(a.x, a.y, a.vmax ?? V_PLAYER, A_PLAYER)
        }
        if (i === kicker) {
          def[i].touch = true
          // set deep for the clearance, knocked back a step by the block, then
          // turning to chase a ball he will not reach
          const tgt = t < KICK ? setUp : t < KICK + 0.5 ? { x: def[i].x + d * 0.6, y: def[i].y } : { x: ball.x, y: ball.y + 1.5 }
          def[i].steer(tgt.x, tgt.y, t < KICK ? V_PLAYER : t < KICK + 0.5 ? 3 : 6.5, A_PLAYER)
        } else {
          // the kicking side turns and chases from the field side, never from
          // behind its own dead-ball line (they all stood in-goal before)
          const q: Pt & { vmax?: number } = t < KICK ? shapeAtt(i, start, -d)
            // the nearest chase the loose ball, but from where they stand:
            // sent to a spot behind the charger, a man between him and the
            // line ran up-field and round him (1.8.1, homeward)
            : chase.has(i) ? homeward(def[i], { x: fieldX(ball.x - d * (1.5 + (i % 3))), y: fieldY(ball.y + ((i % 3) - 1) * 2), vmax: 7.5 }, d)
            : { x: fieldX(ownLine(def[i].x + d * 2, ball, d)), y: def[i].y, vmax: 3.5 }
          def[i].steer(q.x, q.y, q.vmax ?? V_PLAYER, A_PLAYER)
        }
      }
    })
  }

  // =========================================================== phases
  const pts = c.beats
  const phases: Phase[] = []
  phases.push({ k: 'ruck', q: pts[0], dur: 0.5 })
  if (pts[0].line >= 0) reveals.push({ t: 0.1, line: pts[0].line })
  let prev = -1
  for (let j = 1; j < pts.length; j++) {
    const b = pts[j], q = pts[j - 1]
    let who = b.carrier
    // the man who has just been tackled is on the floor: the next carry is somebody else's
    if (who === prev) who = FORWARD_CARRIERS.find(s => s !== prev && s !== 9)!
    const tackler = TACKLERS[j % TACKLERS.length]
    phases.push({ k: 'dig', q, dur: 0.35 })
    phases.push({ k: 'pass', who, dur: 0 })
    phases.push({ k: 'run', to: b, who, line: b.line, end: 'ruck', dur: 0, tackler })
    phases.push({ k: 'ruck', q: b, dur: 0.45, tackled: who, tackler })
    prev = who
  }
  // the finish, from the last ruck
  const last = pts[pts.length - 1]
  const scorer = c.finish.carrier
  const endKind: RunEnd = c.kind === 'attack' ? 'held' : 'score'
  const side = Math.sign(c.finish.y - last.y) || (last.y < 35 ? 1 : -1)
  phases.push({ k: 'dig', q: last, dur: 0.35 })
  const feed = (who: number, len = 2.2) => {
    phases.push({ k: 'pass', who, dur: 0 })
    phases.push({ k: 'run', to: { x: 0, y: 0 }, who, line: -1, end: 'feed', dur: 0.45, tackler: -1, ctrl: { x: len * 0.85, y: 0 } })
  }
  if (c.style === 'overlap') {
    // three passes along the line: 9 to the first receiver, two more, and the
    // last man is outside his marker
    for (const s of [10, 12, 13, 15, 11, 14].filter(s => s !== scorer).slice(0, 2)) feed(s)
    phases.push({ k: 'pass', who: scorer, dur: 0 })
    phases.push({ k: 'run', to: c.finish, who: scorer, line: -1, end: endKind, dur: 0, tackler: 14 })
  } else if (c.style === 'chip') {
    feed(scorer, 2.5)
    const spot = { x: fieldX(U(Math.min(97, uOf(last.x) + 12))), y: fieldY(last.y + side * 3) }
    phases.push({ k: 'kick', who: scorer, chaser: scorer, to: spot, loft: 5, low: false, dur: 1.15 })
    phases.push({ k: 'run', to: c.finish, who: scorer, line: -1, end: 'score', dur: 0, tackler: 14 })
  } else if (c.style === 'grubber') {
    const kicker = scorer === 10 ? 12 : 10
    feed(kicker, 2)
    const spot = { x: fieldX(U(102.5)), y: fieldY(c.finish.y) }
    phases.push({ k: 'kick', who: kicker, chaser: scorer, to: spot, loft: 0.35, low: true, dur: 0 })
    phases.push({ k: 'done', who: scorer, dur: 99 })
  } else if (c.style === 'crossfield') {
    const kicker = scorer === 10 ? 12 : 10
    feed(kicker, 1.5)
    const spot = { x: fieldX(U(95)), y: fieldY(c.finish.y) }
    phases.push({ k: 'kick', who: kicker, chaser: scorer, to: spot, loft: 8, low: false, dur: 0 })
    phases.push({ k: 'run', to: { x: c.finish.x, y: fieldY(c.finish.y - side * 2) }, who: scorer, line: -1, end: 'score', dur: 0, tackler: 14 })
  } else {
    phases.push({ k: 'pass', who: scorer, dur: 0 })
    phases.push({ k: 'run', to: c.finish, who: scorer, line: -1, end: endKind, dur: 0, tackler: 14 })
  }
  phases.push({ k: 'done', who: scorer, dur: 99 })

  // where a receiver should be standing for a pass from a ruck at q
  const receiveSpot = (q: Pt, who: number): Pt => {
    const [back, across, open] = ATT[who - 1]
    const s = openSide(q.y)
    const a = clamp(open ? across * s : across, -14, 14)
    const bk = clamp(back, 2.5, 7)
    return { x: fieldX(q.x - d * bk), y: fieldY(q.y + (Math.abs(a) < 1.5 ? (s >= 0 ? 2.5 : -2.5) : a)) }
  }

  // the men who miss him on his way: [defender, path share where they meet]
  let missers: { i: number; s: number; dove: number }[] = []
  let frozen: Pt[] = []
  let hunters = new Set<number>()
  /** the two nearest the landing spot of a kick through the line (1.8.1) */
  let kickHunters = new Set<number>()
  // the line through the widest gap
  const gapLine = (from: Pt, to: Pt): Pt => {
    let best: Pt = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, score = -Infinity
    for (let off = -10; off <= 10; off += 2) {
      const ctrl = { x: (from.x + to.x) / 2, y: fieldY((from.y + to.y) / 2 + off) }
      let clear = Infinity
      for (let s = 0.2; s <= 0.9; s += 0.1) {
        const p = bez(from, ctrl, to, s)
        def.forEach((b, i) => { if (!missers.some(m => m.i === i)) clear = Math.min(clear, Math.hypot(b.x - p.x, b.y - p.y), Math.hypot(b.x + b.vx * 0.3 - p.x, b.y + b.vy * 0.3 - p.y)) })
      }
      const sc = Math.min(clear, 8) - Math.abs(off) * 0.12
      if (sc > score) { score = sc; best = ctrl }
    }
    return best
  }

  let p = 0, ps = 0, heldAt = -1, thiefI = -1
  const enter = (ph: Phase, t: number) => {
    if (ph.k === 'pass') {
      ph.from = { x: ball.x, y: ball.y }
      const r = att[ph.who - 1]
      ph.dur = clamp(Math.hypot(r.x - ball.x, r.y - ball.y) / 17, 0.3, 0.95)
    } else if (ph.k === 'run') {
      const r = att[ph.who - 1]
      ph.from = { x: r.x + d * 0.4, y: r.y }
      if (ph.end === 'feed') {
        // a few strides onto the ball, drifting towards the space
        ph.to = { x: fieldX(ph.from.x + d * ph.ctrl!.x), y: fieldY(ph.from.y + side * 1.2) }
        ph.ctrl = { x: (ph.from.x + ph.to.x) / 2, y: (ph.from.y + ph.to.y) / 2 }
        ph.ta = 0.2
        return
      }
      const scoring = ph.end === 'score' || ph.end === 'held'
      // a finisher who took the last pass on the far side of the field goes
      // in on his own side of it, not forty metres across the in-goal (that
      // run ran a clip past sixteen seconds)
      if (scoring && Math.abs(ph.to.y - ph.from.y) > 22) ph.to = { x: ph.to.x, y: fieldY(ph.from.y + Math.sign(ph.to.y - ph.from.y) * 22) }
      if (scoring) {
        // THROUGH THE GAP: his line bends through the widest one; the line
        // stands where it was (wrong-footed) until he is past, then turns and
        // chases from behind. Anybody still near his line has a go and misses,
        // and so do as many more as the commentary says he beat.
        missers = []
        frozen = def.map(b => ({ x: fieldX(b.x + b.vx * 0.3), y: fieldY(b.y + b.vy * 0.3) }))
        // the nearest two chase him; four all converging read as a swarm
        hunters = new Set(def.map((b, i) => ({ i, dd: Math.hypot(b.x - ph.from!.x, b.y - ph.from!.y) })).sort((a, b) => a.dd - b.dd).slice(0, 2).map(r => r.i))
        ph.ctrl = gapLine(ph.from, ph.to)
        const skip = (i: number) => (i === 14 && ph.end === 'held') || missers.some(m => m.i === i)
        const nearest = (i: number) => {
          let bs = 0.5, bd = Infinity
          for (let s = 0.02; s <= 0.95; s += 0.03) { const q = bez(ph.from!, ph.ctrl!, ph.to, s); const dd = Math.hypot(q.x - frozen[i].x, q.y - frozen[i].y); if (dd < bd) { bd = dd; bs = s } }
          return { s: bs, dist: bd }
        }
        const ranked = def.map((_, i) => ({ i, ...nearest(i) })).filter(r => !skip(r.i) && (frozen[r.i].x - ph.from!.x) * d > 0).sort((a, b) => a.dist - b.dist)
        for (const r of ranked) if (r.dist < 2.6 && missers.length < 3) missers.push({ i: r.i, s: r.s, dove: 0 })
        for (const r of ranked) if (missers.length < Math.min(3, Math.max(missers.length, c.misses)) && !missers.some(m => m.i === r.i) && r.dist < 9) missers.push({ i: r.i, s: clamp(r.s, 0.25, 0.85), dove: 0 })
        contact.push(...missers.map(m => m.i))
        if (ph.end === 'held') contact.push(14)
      } else ph.ctrl = { x: (ph.from.x + ph.to.x) / 2, y: (ph.from.y + ph.to.y) / 2 }
      const dist = bezLen(ph.from, ph.ctrl, ph.to)
      const pace = (ph.who >= 9 ? 9.5 : 7.5) * paceK(c.attPace?.[ph.who - 1])
      ph.ta = 0.4
      ph.dur = Math.max(0.9, dist / pace + ph.ta)
      if (ph.line >= 0) reveals.push({ t, line: ph.line })
      if (scoring) { land = t + ph.dur; run = [t, land] }
    } else if (ph.k === 'kick') {
      ph.from = { x: ball.x, y: ball.y }
      kickHunters = new Set(def.map((b, i) => ({ i, dd: Math.hypot(b.x - ph.to.x, b.y - ph.to.y) })).sort((a, b) => a.dd - b.dd).slice(0, 2).map(r => r.i))
      const dist = Math.hypot(ph.to.x - ball.x, ph.to.y - ball.y)
      // the chaser must get there: the kick hangs for as long as his run takes
      const ch = att[ph.chaser - 1]
      const need = Math.hypot(ph.to.x - ch.x, ph.to.y - ch.y) / 9 + 0.45
      ph.dur = Math.max(ph.dur, ph.low ? dist / 16 : dist / 20, need, 0.9)
      if (c.style === 'grubber') { land = t + ph.dur; run = [t, land] }
    }
  }
  enter(phases[0], 0)
  // until the last run has started nobody knows when the ball goes down
  const endOf = () => land <= 0 ? Infinity : land + (c.reviewLine != null ? 3.6 : c.kind === 'attack' ? (c.ending === 'turnover' ? 2.6 : 1.4) : 2.1)

  const baked = record(endOf, (t) => {
    while (t >= ps + phases[p].dur && p < phases.length - 1) { ps += phases[p].dur; p++; enter(phases[p], ps) }
    const ph = phases[p], k = t - ps
    // the next man to take a pass, drifting into place for it
    const next = phases.slice(p + 1).find(x => x.k === 'pass') as Extract<Phase, { k: 'pass' }> | undefined
    const kickNext = phases.slice(p).find(x => x.k === 'kick') as Extract<Phase, { k: 'kick' }> | undefined
    const ruckAt = ph.k === 'ruck' || ph.k === 'dig' ? ph.q : ph.k === 'run' && ph.end === 'ruck' ? ph.to : null
    const finishing = ph.k === 'run' && (ph.end === 'score' || ph.end === 'held')
    const finishK = finishing ? runK(k, ph.dur, ph.ta!) : ph.k === 'done' || (ph.k === 'kick' && c.style !== 'chip') ? 1 : 0
    carrier = -1

    for (let i = 0; i < 15; i++) {
      const shirt = i + 1
      let tgt = shapeAtt(i, ball, d)
      if (next && next.who === shirt && ruckAt && ph.k !== 'pass') tgt = receiveSpot(ruckAt, shirt)
      // outside the man with the ball, a step behind, running onto it
      if (next && next.who === shirt && ph.k === 'run' && ph.end === 'feed') tgt = { x: fieldX(ball.x - d * 4), y: fieldY(ball.y + side * 8) }
      if (ph.k === 'pass' && ph.who === shirt) { const r = att[i]; tgt = { x: r.x + d * 2, y: r.y } }
      // the chaser of a kick: out wide for a crossfield, then onto the ball
      if (kickNext && kickNext.chaser === shirt && ph.k !== 'kick' && !(ph.k === 'run' && ph.who === shirt)) {
        tgt = c.style === 'crossfield' ? { x: fieldX(kickNext.to.x - d * 10), y: kickNext.to.y } : tgt
      }
      if (ph.k === 'kick' && ph.chaser === shirt) {
        const kk = clamp(k / ph.dur, 0, 1)
        tgt = { x: ph.to.x - d * 0.4 * (1 - kk), y: ph.to.y }
      }
      if (shirt === 9 && ruckAt && !(next?.who === 9)) tgt = { x: ruckAt.x - d * 1, y: ruckAt.y + 0.6 }
      if (ph.k === 'ruck' && ph.tackled === shirt) { tgt = { x: ph.q.x - d * 0.6, y: ph.q.y }; att[i].touch = true }
      if (ph.k === 'ruck' && shirt === 9) att[i].touch = true
      const snapped = (ph.k === 'run' && ph.who === shirt) || (ph.k === 'done' && ph.who === shirt) || (ph.k === 'kick' && ph.who === shirt && k < 0.05)
      if (snapped) { if (!(ph.k === 'done' && heldAt >= 0)) carrier = i; continue }
      att[i].steer(tgt.x, tgt.y, V_PLAYER, A_PLAYER)
    }

    // the ball, and the man carrying it
    if (ph.k === 'ruck' || ph.k === 'dig') { ball.x = ph.q.x; ball.y = ph.q.y; ball.lift = 0 }
    else if (ph.k === 'pass') {
      const r = att[ph.who - 1], kk = smooth(k / ph.dur)
      ball.x = lerp(ph.from!.x, r.x + d * 0.4, kk); ball.y = lerp(ph.from!.y, r.y, kk)
      ball.lift = Math.sin(Math.PI * kk) * (0.6 + ph.dur)
    } else if (ph.k === 'run') {
      const kk = runK(k, ph.dur, ph.ta!)
      const at = bezAlong(ph.from!, ph.ctrl!, ph.to, kk)
      ball.x = at.x; ball.y = at.y; ball.lift = 0
      att[ph.who - 1].hold(ball.x - d * 0.4, ball.y)
    } else if (ph.k === 'kick') {
      const kk = clamp(k / ph.dur, 0, 1)
      const e = ph.low ? 1 - (1 - kk) * (1 - kk) : smooth(kk)
      ball.x = lerp(ph.from!.x, ph.to.x, e); ball.y = lerp(ph.from!.y, ph.to.y, e)
      ball.lift = ph.low ? Math.abs(Math.sin(kk * Math.PI * 3)) * ph.loft * (1 - kk) : Math.sin(Math.PI * kk) * ph.loft
      if (k < 0.05) att[ph.who - 1].place(att[ph.who - 1].x + d * 2 * DT, att[ph.who - 1].y)
    } else if (ph.k === 'done') {
      ball.lift = 0
      // the nearest man to the tackle, bar the full-back who made it, wins it
      if (c.ending === 'turnover' && land > 0 && thiefI < 0) {
        let bd = Infinity
        def.forEach((b, i) => { if (i === 14) return; const dd = Math.hypot(b.x - ball.x, b.y - ball.y); if (dd < bd) { bd = dd; thiefI = i } })
      }
      const thief = def[Math.max(0, thiefI)]
      if (c.ending === 'turnover' && land > 0 && t > land + 0.6 && (heldAt >= 0 || Math.hypot(thief.x - ball.x, thief.y - ball.y) < 1.6)) {
        // the ball lost: a ruck, and their openside comes away with it
        if (heldAt < 0) heldAt = t
        const kk = smooth((t - heldAt) / 1.0)
        thief.place(fieldX(thief.x - d * 3.5 * DT * (0.3 + kk)), thief.y)
        const bx = thief.x - d * 0.3 - ball.x, by = thief.y - ball.y, bd = Math.hypot(bx, by), step = Math.min(bd, 20 * DT)
        if (bd > 1e-6) { ball.x += bx / bd * step; ball.y += by / bd * step }
        carrier = 15 + thiefI
      } else att[ph.who - 1].hold(ball.x - d * 0.4, ball.y)
    }

    for (let i = 0; i < 15; i++) {
      if (carrier === 15 + i) continue
      let tgt = shapeDef(i, ball, d)
      let vmax = V_PLAYER
      // on his run: ahead of him, the line holds where it was; once he is
      // past, it turns for its own line.
      //
      // THE COVER RUNS BACK (1.8.1, owner: "once a line break happens the
      // defending players keep running forward, this isn't natural"). The
      // men behind the ball were sent to a spot a set distance behind HIM,
      // so a man he had just passed kept running up-field to reach it. Now
      // the nearest two chase him down, the rest turn and jog back into
      // shape, and none of them is sent up-field (homeward).
      if (finishing && frozen.length) {
        const ahead = (def[i].x - ball.x) * d > 0.3
        const hunt = hunters.has(i)
        tgt = ahead ? { x: frozen[i].x + d * 0.6, y: frozen[i].y }
          : hunt ? { x: ball.x - d * (3.5 + (i % 2) * 1.5), y: ball.y + ((i % 3) - 1) * 1.5 }
          // the rest jog home and out of his lane, so the man he has just
          // passed is not run through a second time as he bends his line
          : { x: def[i].x + d * 6, y: fieldY(def[i].y + (def[i].y >= ball.y ? 5 : -5)) }
        if (!ahead) tgt = homeward(def[i], tgt, d)
        vmax = ahead ? 3 : hunt ? Math.min(V_CAP, 9 * paceK(c.defPace?.[i])) : 5.5
      } else if (ph.k === 'kick' && c.style === 'chip') {
        tgt = { x: ownLine(def[i].x + d * 0.6, ball, d), y: def[i].y }; vmax = 4
      } else if (finishK > 0 && c.kind !== 'attack') {
        const chase = { x: ball.x - d * (2 + (i % 5)), y: ball.y + ((i % 3) - 1) * 3 }
        tgt = { x: lerp(tgt.x, chase.x, finishK * 0.8), y: lerp(tgt.y, chase.y, finishK * 0.8) }
        // a kick through them (a grubber) is the same break: behind the
        // ball, the nearest two chase it and the rest turn for their own
        // line and out of the chasers' lane, never away from it
        if ((def[i].x - ball.x) * d <= 0.3) {
          if (ph.k === 'kick' && kickHunters.size && !kickHunters.has(i)) tgt = { x: def[i].x + d * 6, y: fieldY(def[i].y + (def[i].y >= ball.y ? 5 : -5)) }
          tgt = homeward(def[i], tgt, d)
        }
      }
      // the men he beats: at his line as he gets there, a dive, and the floor
      const m = finishing ? missers.find(x => x.i === i) : undefined
      if (m && finishing) {
        const at = bez(ph.from!, ph.ctrl!, ph.to, m.s)
        const near = Math.hypot(ball.x - def[i].x, ball.y - def[i].y)
        if (!m.dove && near < 2.4) { m.dove = t }
        // a man who never got close enough to dive has missed him already
        // once he is behind the ball, and joins the cover rather than running
        // up-field to a spot on a path the carrier has left
        const beaten = (def[i].x - ball.x) * d <= 0.3
        if (!m.dove && !beaten) { tgt = at; vmax = Math.min(V_CAP, V_PLAYER * paceK(c.defPace?.[i])) }
        else if (t - m.dove < 0.3) { tgt = { x: ball.x - d * 1.2, y: ball.y }; def[i].touch = true }
        else if (!def[i].down && t - m.dove < 0.35) def[i].down = 1.1
      }
      // the tackler meets the carry and stays in the ruck
      if (ph.k === 'run' && ph.end === 'ruck' && ph.tackler === i && k > ph.dur - 1.1) { tgt = { x: ph.to.x + d * 0.8, y: ph.to.y }; def[i].touch = true }
      if (ph.k === 'ruck' && ph.tackler === i) { tgt = { x: ph.q.x + d * 0.8, y: ph.q.y }; def[i].touch = true }
      // the full-back's last-gasp tackle, and the openside over the ball after it
      if (c.kind === 'attack' && i === 14 && (finishing || ph.k === 'done')) {
        tgt = finishing ? { x: ph.to.x + d * 0.8, y: ph.to.y } : { x: ball.x + d * 0.8, y: ball.y }
        def[i].touch = true; vmax = Math.min(V_CAP, 12 * paceK(c.defPace?.[i]))
      }
      if (c.kind === 'attack' && i === thiefI && ph.k === 'done' && c.ending === 'turnover') { tgt = { x: ball.x + d * 0.6, y: ball.y + 0.5 }; def[i].touch = true }
      def[i].steer(fieldX(tgt.x), fieldY(tgt.y), vmax, A_PLAYER)
    }
  })
  end = endOf()
  banner = c.reviewLine != null ? land + 2.0 : c.ending === 'turnover' ? land + 0.7 : land + 0.05
  if (c.reviewLine != null) reveals.push({ t: land, line: c.reviewLine })
  baked.tl = { reveals, land, banner, end, run, contact }
  return baked
}

const baked = new WeakMap<ClipSpec, Baked>()
const bakeOf = (c: ClipSpec) => { let b = baked.get(c); if (!b) { b = bake(c); baked.set(c, b) } return b }

/** When each commentary line is revealed, and the ball goes down. */
export function clipTimeline(c: ClipSpec): Timeline { return bakeOf(c).tl }

/** How long the clip runs, in seconds at normal speed. */
export function clipLength(c: ClipSpec): number { return bakeOf(c).tl.end }

/**
 * Everything on the pitch at time t, in field metres: read back from the
 * bake, blended between the two nearest of its 60-a-second frames.
 * `carrying` and `down` are 30 long: the attack's 15, then the defence's.
 */
export function frameAt(spec: ClipSpec, t: number): { ball: Pt; lift: number; att: Pt[]; def: Pt[]; ref: Pt; carrying: number[]; down: number[] } {
  const b = bakeOf(spec)
  const f = clamp(t * FPS, 0, b.n - 1), i = Math.floor(f), j = Math.min(b.n - 1, i + 1), k = f - i
  const at = (a: Float32Array, w: number, o: number) => lerp(a[i * w + o], a[j * w + o], k)
  const pts = (a: Float32Array) => Array.from({ length: 15 }, (_, s) => ({ x: at(a, 30, s * 2), y: at(a, 30, s * 2 + 1) }))
  const near = k < 0.5 ? i : j
  return {
    ball: { x: at(b.ball, 3, 0), y: at(b.ball, 3, 1) },
    lift: at(b.ball, 3, 2),
    att: pts(b.att), def: pts(b.def),
    ref: { x: at(b.ref, 2, 0), y: at(b.ref, 2, 1) },
    carrying: Array.from({ length: 30 }, (_, s) => b.carry[near * 30 + s]),
    down: Array.from({ length: 30 }, (_, s) => b.down[near * 30 + s]),
  }
}

// ---------------------------------------------------------------- the component

const PAD = 7          // in-goal metres drawn each end
const FIELD_W = 100 + PAD * 2

export function HighlightClip({ spec, speed = 1, paused, onReveal, onDone }: {
  spec: ClipSpec
  /** 1 normal; above 1 slower */
  speed?: number
  paused?: boolean
  onReveal: (line: number) => void
  onDone: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [banner, setBanner] = useState<'review' | 'final' | null>(null)
  // the ball is down: the try is only called from here (hlliveprobe reads it)
  const [down, setDown] = useState(false)
  const pausedRef = useRef(!!paused)
  pausedRef.current = !!paused
  const cb = useRef({ onReveal, onDone })
  cb.current = { onReveal, onDone }

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const tl = bakeOf(spec).tl
    let raf = 0, clock = 0, lastNow = performance.now(), revealed = 0, landed = false, finished = false, reviewing = false, isDown = false
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ink = readInk()
    const refKit = refereeColour([...spec.att, ...spec.def], [ink.refPink, ink.refOrange, ink.refCyan])

    // THE WHOLE PITCH, LOCKED: dead-ball line to dead-ball line, drawn once,
    // scaled to fit and centred
    const field = document.createElement('canvas')
    const size = () => {
      const w = cv.clientWidth, h = cv.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      const sc = Math.min(w / FIELD_W, h / 70)
      const ox = (w - FIELD_W * sc) / 2, oy = (h - 70 * sc) / 2
      field.width = Math.round(FIELD_W * sc * dpr); field.height = Math.round(70 * sc * dpr)
      const f = field.getContext('2d')!
      f.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawField(f, FIELD_W * sc, 70 * sc, ink)
      return { w, h, dpr, sc, ox, oy }
    }
    let dim = size()
    const onResize = () => { dim = size() }
    window.addEventListener('resize', onResize)

    const X = (x: number) => dim.ox + (x + PAD) * dim.sc
    const Y = (y: number) => dim.oy + y * dim.sc

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000)
      lastNow = now
      if (!pausedRef.current) clock += dt / speed
      const t = reduce ? Math.max(clock, tl.land) : clock
      // commentary in step with the picture
      while (revealed < tl.reveals.length && t >= tl.reveals[revealed].t) cb.current.onReveal(tl.reveals[revealed++].line)
      if (!isDown && tl.land > 0 && t >= tl.land) { isDown = true; setDown(true) }
      if (spec.reviewLine != null && !reviewing && t >= tl.land) { reviewing = true; setBanner('review') }
      if (!landed && t >= tl.banner) { landed = true; cb.current.onReveal(spec.endLine); if (spec.label) setBanner('final') }
      draw(t)
      if (t >= tl.end && !finished) { finished = true; cb.current.onDone(); return }
      raf = requestAnimationFrame(frame)
    }

    const draw = (t: number) => {
      const g = cv.getContext('2d')!
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.fillStyle = ink.surround; g.fillRect(0, 0, cv.width, cv.height)
      g.drawImage(field, Math.round(X(-PAD) * dim.dpr), Math.round(Y(0) * dim.dpr))
      g.setTransform(dim.dpr, 0, 0, dim.dpr, 0, 0)
      const f = frameAt(spec, t)
      // the ball keeps its size; the men are a fifth bigger than they were
      // (owner, 1.8.0), and their numbers with them
      const R0 = Math.max(5.5, dim.sc * 1.1), R = R0 * 1.2
      const finishing = t > tl.land - 0.01

      const dot = (p: Pt, fill: string, edge: string, num: number, ring: boolean, down: boolean) => {
        const x = X(p.x), y = Y(clamp(p.y, 0.5, 69.5))
        g.globalAlpha = down ? 0.5 : 1
        g.beginPath(); g.arc(x, y + 1, R, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill()
        g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fillStyle = fill; g.fill()
        g.lineWidth = ring ? 2 : 1.2; g.strokeStyle = ring ? ink.white : edge; g.stroke()
        g.fillStyle = isLight(fill) ? ink.dark : ink.white; g.font = `700 ${Math.round(R * 1.1)}px system-ui, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(String(num), x, y + 0.5)
        g.globalAlpha = 1
      }

      for (let i = 0; i < 15; i++) dot(f.def[i], spec.def[0], spec.def[1], i + 1, f.carrying[15 + i] > 0.5, f.down[15 + i] > 0.5)
      for (let i = 0; i < 15; i++) dot(f.att[i], spec.att[0], spec.att[1], i + 1, f.carrying[i] > 0.5 && !finishing, f.down[i] > 0.5)

      // THE REFEREE (owner, 1.8.0): a circle like everybody else, told apart
      // by the colour neither side wears, no number, a little smaller, and a
      // dark edge
      const rx = X(f.ref.x), ry = Y(clamp(f.ref.y, 0.5, 69.5)), rs = R * 0.78
      g.beginPath(); g.arc(rx, ry + 1, rs, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill()
      g.beginPath(); g.arc(rx, ry, rs, 0, Math.PI * 2); g.fillStyle = refKit; g.fill()
      g.lineWidth = 2; g.strokeStyle = ink.dark; g.stroke()

      // the ball, lifted off its shadow in flight
      const bx = X(f.ball.x), by = Y(f.ball.y)
      g.beginPath(); g.ellipse(bx, by + 2, R0 * 0.55, R0 * 0.3, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fill()
      g.beginPath(); g.ellipse(bx, by - f.lift * dim.sc * 0.6, R0 * 0.6, R0 * 0.42, -0.4, 0, Math.PI * 2)
      g.fillStyle = ink.ball; g.fill(); g.lineWidth = 1; g.strokeStyle = ink.ballEdge; g.stroke()
    }

    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [spec, speed])

  const good = spec.kind === 'try' || (spec.kind === 'kick' && spec.kickGood)
  return (
    <div className={`hl-clip ${spec.kind}`} data-testid="hl-clip" data-down={down ? '1' : '0'}>
      <canvas ref={canvas} className="hl-canvas" />
      {banner === 'review' && (
        <div className="hl-banner review"><b>{spec.reviewLabel}</b></div>
      )}
      {banner === 'final' && (
        <div className={`hl-banner ${spec.kind}${spec.kind === 'kick' && !spec.kickGood ? ' miss' : ''}`}
          style={{ background: good ? spec.att[0] : undefined, color: good ? (isLight(spec.att[0]) ? 'var(--prop-ink-dark)' : 'var(--prop-ink)') : undefined }}>
          <b>{spec.label}</b>
          {spec.sub && <span>{spec.sub}</span>}
        </div>
      )}
    </div>
  )
}

/**
 * WHAT THE REFEREE WEARS (owner, 1.8.0): pink, orange when either side wears
 * pink, cyan when the kits use pink and orange, and never a colour either
 * side is wearing. A kit "wears" a colour when either of its two
 * colours is within REF_NEAR of it by kitGap (the summed channel distance the
 * away-kit rule uses), so a cerise or a coral counts as pink and a tangerine
 * or a deep gold as orange. If even cyan is near a kit (a side in all three),
 * he takes whichever of the three is furthest from every kit colour.
 */
const REF_NEAR = 150
export function refereeColour(kits: string[], [pink, orange, cyan]: [string, string, string]): string {
  const near = (c: string) => kits.some(k => kitGap(c, k) < REF_NEAR)
  const pick = !near(pink) ? pink : !near(orange) ? orange : cyan
  if (!near(pick)) return pick
  return [pink, orange, cyan].map(c => ({ c, gap: Math.min(...kits.map(k => kitGap(c, k))) }))
    .sort((a, b) => b.gap - a.gap)[0].c
}

/** is this a light colour, so the writing on it wants to be dark? */
function isLight(bg: string): boolean {
  const h = bg.replace('#', '')
  if (h.length < 6) return false
  return (parseInt(h.slice(0, 2), 16) * 299 + parseInt(h.slice(2, 4), 16) * 587 + parseInt(h.slice(4, 6), 16) * 114) / 1000 > 150
}

/** A colour token's value, for the canvas (which cannot read var()). */
export function tokenColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** the canvas's colours, all from tokens.css */
function readInk() {
  return {
    surround: tokenColor('--hl-surround'), grassA: tokenColor('--hl-grass-a'), grassB: tokenColor('--hl-grass-b'),
    ball: tokenColor('--hl-ball'), ballEdge: tokenColor('--hl-ball-edge'),
    white: tokenColor('--prop-ink'), dark: tokenColor('--prop-ink-dark'),
    refPink: tokenColor('--hl-ref-pink'), refOrange: tokenColor('--hl-ref-orange'), refCyan: tokenColor('--hl-ref-cyan'),
  }
}

/** A rugby pitch, side on: stripes, try lines, 22s, halfway, the dashed 10s,
 *  5s and 15s, and the posts. */
function drawField(g: CanvasRenderingContext2D, w: number, h: number, ink: ReturnType<typeof readInk>) {
  const X = (x: number) => (x + PAD) / FIELD_W * w
  const Y = (y: number) => y / 70 * h
  for (let i = 0; i < 12; i++) {
    g.fillStyle = i % 2 ? ink.grassB : ink.grassA
    g.fillRect(X(-PAD + i * (FIELD_W / 12)), 0, w / 12 + 1, h)
  }
  // the in-goals a shade darker
  g.fillStyle = 'rgba(0,0,0,.12)'
  g.fillRect(0, 0, X(0), h); g.fillRect(X(100), 0, w - X(100), h)
  g.strokeStyle = 'rgba(255,255,255,.82)'; g.lineWidth = 1.4
  const line = (x: number, dash: number[] = []) => { g.setLineDash(dash); g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), h); g.stroke() }
  line(0); line(100); line(22); line(78); line(50)
  line(40, [5, 5]); line(60, [5, 5]); line(5, [3, 5]); line(95, [3, 5])
  g.setLineDash([4, 6])
  for (const y of [5, 15, 55, 65]) { g.beginPath(); g.moveTo(X(0), Y(y)); g.lineTo(X(100), Y(y)); g.stroke() }
  g.setLineDash([])
  g.strokeRect(0.7, 0.7, w - 1.4, h - 1.4)
  // the posts: a crossbar on the try line and the two uprights, seen from above
  for (const x of [0, 100]) {
    g.lineWidth = 2.2; g.strokeStyle = ink.white
    g.beginPath(); g.moveTo(X(x), Y(32.2)); g.lineTo(X(x), Y(37.8)); g.stroke()
    for (const y of [32.2, 37.8]) { g.beginPath(); g.arc(X(x), Y(y), 2, 0, Math.PI * 2); g.fillStyle = ink.white; g.fill() }
  }
}
