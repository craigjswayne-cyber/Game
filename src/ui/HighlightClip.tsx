import { useEffect, useRef, useState } from 'react'
import type { MatchEvent } from '../game/model'
import { kitGap } from './kit'
import { MOVE_BY_ID, moveOfKey } from '../game/moves'
import { TRACKS, atkStyleOf, defStyleOf, defenceShape, trackAt, tracksFor, type AtkStyle, type DefStyle, type K, type StyleDials, type Track, type TrackFrom } from './clipPlays'

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
export type ClipStyle = 'phases' | 'overlap' | 'maul' | 'intercept' | 'chip' | 'grubber' | 'crossfield' | 'charge' | 'move'

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
  /** THE CALLED MOVE THAT MADE IT (1.8.1, game/moves.ts), read off the try
   *  line's move_k: a strike move is played from its set piece (style
   *  'move'), and a phase-play shape puts the forwards in its pods */
  move?: string
  launch?: 'lineout' | 'scrum' | 'open' | 'tap'
  /** THE STYLES (1.8.2): how the defending side defends and how the
   *  attacking side attacks, from their tactics (clipPlays.ts); absent is
   *  the standard line and plain phase play */
  defStyle?: DefStyle
  atkStyle?: AtkStyle
  /** the pod shape of a pod game ('1331', '242', 'nine'), off the tactic */
  podShape?: string
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
  paceOf?: (home: boolean, shirt: number) => number | undefined,
  tacticOf?: (home: boolean) => StyleDials | undefined): ClipSpec {
  const e = events[m]
  // THE STYLES (1.8.2): the defending side's system, the attacking side's style
  const styles = {
    defStyle: defStyleOf(tacticOf?.(e.teamId !== homeId)),
    atkStyle: atkStyleOf(tacticOf?.(e.teamId === homeId)),
    // the pod shape inside a pod game (1.8.2 depth), off the same tactic
    podShape: tacticOf?.(e.teamId === homeId)?.podShape,
  }
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
      kind, style: 'phases', attackHome, beats: [], finish: { x: toX(u), y, carrier: shirtOf(e.playerId) ?? 10 }, endLine: m, ...styles,
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
  // THE CALLED MOVE THAT MADE IT (1.8.1, game/moves.ts): the try line
  // carries the move in move_k and says in its key what it came off
  const mvId = kind === 'try' && /^comm\.(moveTry(Lo|Sc)|shapeTry)/.test(e.k ?? '') ? moveOfKey(e.v?.move_k) : null
  const launch: ClipSpec['launch'] = !mvId ? undefined
    : e.k?.startsWith('comm.moveTryLo') ? 'lineout' : e.k?.startsWith('comm.moveTrySc') ? 'scrum' : 'open'
  if (mvId && launch && launch !== 'open' && MOVE_BY_ID[mvId]) {
    // A STRIKE MOVE is played from the set piece it was called off, thirty
    // metres or so out (less when the TMO's look is to come as well): a
    // lineout on the touchline, a scrum in midfield, and a blindside wrap's
    // scrum near a touchline so there is a blind side to wrap round
    const lo = launch === 'lineout', blind = mvId === 'mv_blind'
    const u0 = (review >= 0 ? 71 : 66) + 4 * hash(m * 3)
    const top = hash(m * 7) < 0.5
    // (1.8.2) where the move is drawn from, as the study's moves are: a
    // lineout on the touchline; a scrum on the fifteen-metre line with the
    // width on its open side; the wrap's scrum with the short side on the
    // right, where its wing (the 14) is
    const y0 = lo ? (top ? 5 : 65) : blind ? (attackHome ? 52 : 18) : (top ? 15 : 55)
    const side = blind ? (y0 < 35 ? -1 : 1) : (y0 < 35 ? 1 : -1)
    const tr = tracksFor(mvId)?.[0]
    const tf = tr ? trackFrame(tr, lo ? 'lineout' : 'scrum', { x: 0, y: y0 }, side) : null
    const fy = tr && tf ? Math.max(4, Math.min(66, tf.base.y + side * tr.finish * tf.scP))
      : blind ? (y0 < 35 ? 6 : 64) : Math.max(6, Math.min(64, y0 + side * (18 + 8 * hash(m * 11))))
    const steps = Math.max(2, from.length)
    const beats: ClipSpec['beats'] = Array.from({ length: steps }, (_, i) => ({
      x: toX(u0 + i * 0.5), y: y0, line: from[i] ?? -1, carrier: lo ? 2 : 8,
    }))
    return {
      kind, style: 'move', move: mvId, launch, attackHome, beats,
      // (nobody named: the move's own strike runner)
      finish: { x: toX(103), y: fy, carrier: shirtOf(e.playerId) ?? (tr ? (tr.strike === 'W' ? (side * (attackHome ? 1 : -1) > 0 ? 14 : 11) : tr.strike === 'FW' ? (side * (attackHome ? 1 : -1) > 0 ? 11 : 14) : Number(tr.strike)) : 13) },
      endLine: m,
      reviewLine: review >= 0 ? review : undefined,
      reviewLabel: labels.review,
      misses: hash(m * 17) < 0.4 ? 1 : 0,
      label: labels.try, sub: nameOf(e.playerId), att, def,
      attPace: paces(attackHome), defPace: paces(!attackHome), ...styles,
    }
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
  let fy = kind === 'attack' ? Math.max(8, Math.min(62, y + open * 10 * hash(m * 13)))
    : style === 'overlap' ? Math.max(6, Math.min(64, y + open * (18 + 10 * hash(m * 11))))
    : style === 'crossfield' ? (y < 35 ? 62 : 8)
    : Math.max(6, Math.min(64, y + (y < 35 ? -1 : 1) * (6 + 14 * hash(m * 11))))
  // a called shape with a play of its own finishes where its play goes
  const openTr = mvId && launch === 'open' && kind === 'try' ? tracksFor(mvId)?.[0] : undefined
  if (openTr && openTr.set === 'ruck') {
    const sd = y < 35 ? 1 : -1, tf = trackFrame(openTr, 'ruck', { x: 0, y }, sd)
    fy = Math.max(5, Math.min(65, y + sd * openTr.finish * tf.scP))
  }
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
    attPace: paces(attackHome), defPace: paces(!attackHome), ...styles,
    // a phase-play shape: the build-up is played in its pods
    ...(mvId && launch === 'open' ? { move: mvId, launch } : {}),
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
  /** a set piece: which, and when the ball is out of it */
  set?: { kind: string; out: number }
  /** a move's bite: the defender, the man he bites on (shirt indexes), when
   *  he goes, the strike runner, when he hits the line and took the ball */
  bite?: { def: number; on: number; t: number; strike: number; hit: number; caught: number }
  /** a move with no bite: when the strike runner reached their line */
  hit?: number; hitDef?: number
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
const bezAlong = (a: Pt, c: Pt, b: Pt, k: number): Pt => alongOf(a, c, b)(k)
/** the same, with the curve measured once (the chase asks where the ball
 *  will be thirty-odd times a frame) */
const alongCache = new WeakMap<Pt, { c: Pt; b: Pt; f: (k: number) => Pt }>()
function alongOf(a: Pt, c: Pt, b: Pt): (k: number) => Pt {
  const hit = alongCache.get(a)
  if (hit && hit.c === c && hit.b === b) return hit.f
  const N = 24, cum = [0]
  let p = a
  for (let i = 1; i <= N; i++) { const q = bez(a, c, b, i / N); cum.push(cum[i - 1] + Math.hypot(q.x - p.x, q.y - p.y)); p = q }
  const f = (k: number) => {
    const want = clamp(k, 0, 1) * cum[N]
    let i = 1
    while (i < N && cum[i] < want) i++
    const seg = cum[i] - cum[i - 1]
    return bez(a, c, b, (i - 1 + (seg > 1e-9 ? (want - cum[i - 1]) / seg : 0)) / N)
  }
  alongCache.set(a, { c, b, f })
  return f
}

// attack, relative to the ball: [metres behind, metres across] for shirts 1..15;
// the across of the backs is multiplied by the open side (s = +-1, eased)
const ATT: [number, number, boolean][] = [
  [1.2, -1.8, false], [0.4, 0, false], [1.2, 1.8, false], [3, -3, false], [3, 3, false],
  [5, 6, true], [4.5, -5, true], [2.2, 0, false], [1.5, 2, true], [5, 8, true],
  [7, -12, true], [6.5, 14.5, true], [8, 21, true], [9.5, 28, true], [13, 12, true],
]
// defence, relative to the ball: [metres in front, metres across]
// (1.8.2: spread as a real line is, a couple of metres between the men
// guarding the ruck and five or six between the backs, most of them on the
// side the play is going; across is towards that side)
const DEF: [number, number][] = [
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
interface Chase {
  react: number; hunters: number; huntV: number; coverV: number; scrambleV: number
  lead: number; coverLead: number; margin: number; heels: number; maxTurn: number
  /** a chaser behind the ball runs at this share of the carrier's speed */
  outpace: number
}
const CHASE: Chase = { react: 0.3, hunters: 2, huntV: 9, coverV: 9, scrambleV: 7, lead: 1.0, coverLead: 3, margin: 0.35, heels: 3.2, maxTurn: 1.2, outpace: 0.93 }
const TACKLERS = [1, 0, 2, 5, 4, 3, 6, 7]
const FORWARD_CARRIERS = [8, 4, 6, 1, 5, 7]

// ---- THE CALLED MOVES, DRAWN (1.8.1, game/moves.ts) ----
//
// A PHASE-PLAY SHAPE puts the forwards in its pods for the whole build-up:
// [metres behind the ball, metres across towards the open side] by shirt
// index (0 = No. 1). Anybody not listed stands in the default shape.
const PODS: Record<string, Record<number, [number, number]>> = {
  // a forward on each edge, a pod of three either side of the ruck
  mv_1331: { 0: [2.2, -9], 1: [3.4, -10.5], 2: [2.2, -12], 3: [2.2, 9], 4: [3.4, 10.5], 7: [2.2, 12], 5: [3, -24], 6: [3, 24] },
  // two on each edge, four in the middle
  mv_242: { 5: [3, -22], 1: [3.4, -25], 6: [3, 22], 7: [3.4, 25], 0: [2.2, -7], 3: [3.2, -4], 4: [3.2, 4], 2: [2.2, 7] },
  // a flat pod of three in front, the 10 behind it for the back door
  mv_backdoor: { 3: [1.2, 5], 4: [1.2, 7.5], 7: [1.2, 10], 9: [6, 8] },
}
/** a bound scrum, our side: [metres behind the mark, metres across] by shirt index */
const SCRUM_FORM: [number, number][] = [[0.6, -1.2], [0.6, 0], [0.6, 1.2], [1.5, -0.6], [1.5, 0.6], [1.3, -1.9], [1.3, 1.9], [2.4, 0]]
/** a lineout, front to back: the shirt index at each place, and the
 *  metres in from touch (the jumper, No. 4, is second, lifted by 1 and 3) */
const LINEOUT_ORDER = [0, 3, 2, 5, 4, 7, 6]
const LINEOUT_Y = [5.8, 7.0, 8.2, 9.6, 10.8, 12.0, 13.4]
/** THE PODS AN ATTACKING STYLE PLAYS IN (1.8.2) when no shape is called:
 *  pods 1-3-3-1, width 2-4-2, direct one-out runners tight on the ruck */
const STYLE_PODS: Partial<Record<AtkStyle, Record<number, [number, number]>>> = {
  direct: { 0: [2.6, -3.5], 2: [2.6, 3.5], 3: [3.4, -6], 4: [3.4, 6], 5: [3, -9], 6: [3, 9], 7: [2.4, 1.5] },
}
/** every called move has its track or its pods (movesprobe) */
export const CLIP_MOVES = [...new Set([...Object.keys(TRACKS), ...Object.keys(PODS)])]

/** A track's frame on the pitch: the 9 at the base (at a lineout, ten
 *  metres in from touch), how much deeper the backs stand when a move
 *  written for one set piece is run off another, and how much it is
 *  narrowed to fit between the touchlines. */
function trackFrame(tr: Track, set: TrackFrom, S: Pt, side: number) {
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

function openSide(y: number) { return clamp((35 - y) / 12, -1, 1) }
/** how far across a back stands: all to the open side near a touchline, and
 *  split both ways in midfield (scaling by the open side alone stood the
 *  whole backline on the ball there, a blob on the full-pitch view) */
function backAcross(across: number, y: number, lean: number) {
  // (1.8.2) in midfield the backline stands to the side the play is going,
  // a staggered line, rather than split man by man both ways
  const s = openSide(y)
  return across * clamp(s + lean * (1 - Math.abs(s)), -1, 1)
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
/** frames kept: every other step (1.8.2: half the bake's writing and half its
 *  memory; read back blended, a thirtieth of a second apart is still smooth) */
const KEEP = 2, REC_FPS = FPS / KEEP
const V_PLAYER = 11, A_PLAYER = 16
/** a defensive line shifting across with the ball (m/s) */
const V_SHIFT = 7.5
/** REAL PACE (1.8.2): a back's sprint and a forward's, and the pace they
 *  get into shape at without the ball */
const V_BACK = 9.3, V_FWD = 7.4, V_SHAPE_BACK = 8, V_SHAPE_FWD = 6.2
/** a man on his line aims this far ahead of it, so his steering lag lands
 *  him on it rather than behind it */
const LOOK = 0.4
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
  /** lifted in a lineout */
  aloft = 0
  constructor(public x: number, public y: number) {}
  /** arrive at (tx, ty): full speed from far, easing in close, never faster than vmax */
  steer(tx: number, ty: number, vmax: number, amax: number, k = 2.4) {
    if (this.down > 0) { this.down -= DT; tx = this.x; ty = this.y; amax = 30 }
    const dx = tx - this.x, dy = ty - this.y, dist = Math.hypot(dx, dy)
    const want = Math.min(vmax, dist * k)
    const dvx = (dist > 1e-6 ? dx / dist * want : 0) - this.vx, dvy = (dist > 1e-6 ? dy / dist * want : 0) - this.vy
    const v0 = Math.hypot(this.vx, this.vy)
    let ax = dvx * 8, ay = dvy * 8
    const a = Math.hypot(ax, ay)
    if (a > amax) { ax *= amax / a; ay *= amax / a }
    this.vx += ax * DT; this.vy += ay * DT
    // over his top speed (the cap has just come down: a chaser held to the
    // pace of a man slowing into his dive): he eases off, he does not stop
    // dead in a frame
    const v = Math.hypot(this.vx, this.vy)
    if (v > vmax) { const to = Math.max(vmax, Math.min(v, v0 - amax * DT)); this.vx *= to / v; this.vy *= to / v }
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

/** a run: off the mark (or already going, at a share a0 of his pace), a
 *  steady pace, and slowing into the contact or the dive */
function runK(t: number, T: number, ta: number, a0 = 0): number {
  if (t <= 0) return 0
  if (t >= T) return 1
  const v = 1 / (T - ta + a0 * ta / 2)
  if (t < ta) return v * (a0 * t + (1 - a0) * t * t / (2 * ta))
  if (t > T - ta) return 1 - 0.5 * v * (T - t) * (T - t) / ta
  return v * (ta * (1 + a0) / 2 + (t - ta))
}

interface Baked {
  tl: Timeline; n: number
  ball: Float32Array; att: Float32Array; def: Float32Array; ref: Float32Array
  /** 30 a frame: the attack's 15, then the defence's */
  carry: Float32Array; down: Float32Array; aloft: Float32Array
}

type RunEnd = 'ruck' | 'feed' | 'score' | 'held'
type Phase =
  | { k: 'ruck'; q: Pt; dur: number; tackled?: number; tackler?: number }
  | { k: 'dig'; q: Pt; dur: number }
  | { k: 'pass'; who: number; dur: number; from?: Pt; lead?: [number, number]; decoy?: boolean }
  | { k: 'run'; to: Pt; who: number; line: number; end: RunEnd; dur: number; ta?: number; a0?: number; from?: Pt; ctrl?: Pt; tackler: number; across?: number }
  | { k: 'track'; dur: number }
  | { k: 'set'; q: Pt; dur: number }
  | { k: 'kick'; who: number; chaser: number; to: Pt; loft: number; low: boolean; dur: number; from?: Pt }
  | { k: 'done'; who: number; dur: number }

function bake(c: ClipSpec, opts?: { biteAt?: number; biteDef?: number; scout?: boolean }): Baked {
  const d = c.attackHome ? 1 : -1
  const U = (u: number) => c.attackHome ? u : 100 - u
  const uOf = (x: number) => c.attackHome ? x : 100 - x
  // a man's whole dot inside the dead-ball line, not only his middle
  const fieldX = (x: number) => clamp(x, -PAD + 1.4, 100 + PAD - 1.4)
  const fieldY = (y: number) => clamp(y, 1, 69)
  const reveals: { t: number; line: number }[] = []
  const contact: number[] = []
  // THE DEFENCE'S SYSTEM (1.8.2): its shape, its line speed, its chase
  const DS = defenceShape(c.defStyle)
  const CH: Chase = { ...CHASE, react: DS.react, huntV: DS.huntV, coverV: DS.coverV, coverLead: DS.coverLead }
  /** the side the play is going to */
  const lean = Math.sign(c.finish.y - (c.beats[c.beats.length - 1]?.y ?? 35)) || 1
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
  // a phase-play shape's pods (1.8.1): the forwards stand in them, not in
  // the default shape, for the whole of the build-up
  // the attack's pods: its style's (1-3-3-1 for pods, 2-4-2 for width, one-out
  // runners for direct), with a called shape's own on top
  const stylePods = c.kind !== 'kick' && (c.style === 'phases' || c.style === 'overlap') && c.atkStyle
    ? (c.atkStyle === 'pods' ? (c.podShape === '242' ? PODS.mv_242 : c.podShape === 'nine' ? STYLE_PODS.direct : PODS.mv_1331)
      : c.atkStyle === 'width' ? PODS.mv_242 : STYLE_PODS[c.atkStyle]) : undefined
  const movePods = c.launch === 'open' && c.move && PODS[c.move] ? PODS[c.move] : undefined
  const pods = movePods || stylePods ? { ...(stylePods ?? (movePods && c.move !== 'mv_1331' && c.move !== 'mv_242' ? PODS.mv_1331 : {})), ...movePods } : undefined
  const shapeAtt = (i: number, b: Pt, dir: number): Pt => {
    // (the pods are the attack's: an intercept's other side stands plain)
    const pd = dir === d ? pods?.[i] : undefined
    if (pd) {
      const s = openSide(b.y) >= 0 ? 1 : -1
      return { x: fieldX(ownLine(b.x - dir * pd[0], b, -dir)), y: fieldY(b.y + pd[1] * s) }
    }
    const [back, across, open] = ATT[i]
    // the side with the ball stays out of its own in-goal too (a clearance
    // from their 22 stood their full-back five metres behind his line)
    return { x: fieldX(ownLine(b.x - dir * back, b, -dir)), y: fieldY(b.y + (open ? backAcross(across, b.y, dir === d ? lean : -lean) : across)) }
  }
  // THE LINE BY ITS SYSTEM (1.8.2, defenceShape): its spread and depth,
  // and the back three: both wings up and the full-back deep, or as a
  // pendulum, the near wing up, the full-back behind him, the far wing deep
  const shapeDef = (i: number, b: Pt, dir: number): Pt => {
    const near = b.y < 35 ? -1 : 1
    const room = near < 0 ? b.y : 70 - b.y
    if (i === 14) return { x: fieldX(ownLine(b.x + dir * (DS.pendulum ? 16 : 21), b, dir)), y: fieldY(DS.pendulum ? b.y + near * Math.min(8, room * 0.5) : 35 + (b.y - 35) * 0.4) }
    if (i === 10 || i === 13) {
      // (their 11 is on their left: our right)
      const mine = (i === 10 ? 1 : -1) * (dir > 0 ? 1 : -1)
      if (DS.pendulum && mine !== near) return { x: fieldX(ownLine(b.x + dir * 12, b, dir)), y: fieldY(b.y + mine * 20) }
      return { x: fieldX(ownLine(b.x + dir * 4.5, b, dir)), y: fieldY(b.y + mine * 25 * DS.width) }
    }
    const [ahead, across] = DEF[i]
    // most of them to the side the play goes, the line narrowed to fit
    // (towards the touchline the line keeps its spacing; with no room at
    // all that side, it stands the other way)
    let ls = dir === d ? lean : -lean
    if ((ls > 0 ? 70 - b.y : b.y) < 13) ls = -ls
    const roomOn = ls > 0 ? 70 - b.y : b.y, roomOff = 70 - roomOn
    const w = across * DS.width
    // (a back with no room outside the man inside him stands on the other
    // side of the ruck instead, rather than squeezing the line up)
    const a = w > roomOn - 4 ? -Math.min(roomOff - 3, 6 + (w - 10) * 0.9)
      : w < -6 ? -6 + (w + 6) * clamp((roomOff - 8) / 10, 0.15, 1) : w
    return { x: fieldX(ownLine(b.x + dir * Math.max(1.2, ahead + DS.depth), b, dir)), y: fieldY(b.y + ls * a) }
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
  const everyone = [...att, ...def, ref]
  const mx = new Float64Array(everyone.length), my = new Float64Array(everyone.length)
  const separate = () => {
    const all = everyone, n = all.length
    const held = carrier < 0 ? null : carrier < 15 ? att[carrier] : def[carrier - 15]
    mx.fill(0); my.fill(0)
    for (let a = 0; a < n; a++) {
      const p = all[a]
      for (let b = a + 1; b < n; b++) {
        const q = all[b]
        const dx = q.x - p.x, dy = q.y - p.y
        if (dx > ROOM || dx < -ROOM || dy > ROOM || dy < -ROOM) continue
        if ((p.touch && q.touch) || (p.touch && q === held) || (q.touch && p === held)) continue
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist >= ROOM || dist < 1e-6) continue
        const ux = dx / dist * (ROOM - dist) / 2, uy = dy / dist * (ROOM - dist) / 2
        mx[a] -= ux; my[a] -= uy; mx[b] += ux; my[b] += uy
      }
    }
    // however many neighbours lean on a man, he gives no more than a walk a frame
    for (let i = 0; i < n; i++) {
      const p = all[i]
      if (p === held) continue
      const m = Math.hypot(mx[i], my[i])
      if (m < 1e-9) continue
      const k = Math.min(1, 0.012 / m)
      p.x += mx[i] * k; p.y += my[i] * k
    }
  }

  // ---- write it down, 60 frames a second
  const rec = { ball: [] as number[], att: [] as number[], def: [] as number[], ref: [] as number[], carry: [] as number[], down: [] as number[], aloft: [] as number[] }
  let nFrames = 0, frameNo = 0
  /** a first bake that only has to find when the gap is hit stops there */
  let halt = false
  const snap = (t: number) => {
    // a little life, the same for everybody all the time (switching it off for
    // the ball carrier made him hop 40 cm on the catch)
    rec.ball.push(ball.x, ball.y, ball.lift)
    for (let i = 0; i < 15; i++) {
      const a = att[i], b = def[i]
      rec.att.push(a.x + Math.sin(t * 1.7 + i * 1.3) * 0.15, a.y + Math.cos(t * 1.3 + i * 0.9) * 0.15)
      rec.def.push(b.x + Math.sin(t * 1.7 + i * 1.3 + 2) * 0.15, b.y + Math.cos(t * 1.3 + i * 0.9 + 2) * 0.15)
    }
    rec.ref.push(ref.x, ref.y)
    for (let i = 0; i < 30; i++) {
      const b = i < 15 ? att[i] : def[i - 15]
      rec.carry.push(i === carrier ? 1 : 0); rec.down.push(b.down > 0 ? 1 : 0); rec.aloft.push(b.aloft)
    }
    nFrames++
  }
  const record = (endAt: () => number, step: (t: number) => void): Baked => {
    snap(0)
    for (let f = 1; ; f++) {
      const t = f * DT
      for (let i = 0; i < 15; i++) { att[i].touch = false; att[i].aloft = 0; def[i].touch = false; def[i].aloft = 0 }
      step(t)
      separate()
      const r = refSpot(); ref.steer(r.x, r.y, 8.5, 10)
      if (f % KEEP === 0) snap(t)
      frameNo = f
      if (t > endAt() + 0.5 || f > FPS * 40 || halt) break
    }
    return {
      tl: { reveals, land, banner, end, run, contact }, n: nFrames,
      ball: Float32Array.from(rec.ball), att: Float32Array.from(rec.att), def: Float32Array.from(rec.def), ref: Float32Array.from(rec.ref),
      carry: Float32Array.from(rec.carry), down: Float32Array.from(rec.down), aloft: Float32Array.from(rec.aloft),
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
  /** THE CHASE (1.8.2, CHASE above): where defender `b` runs to get the man
   *  with the ball, given his `route` (where the ball will be tau seconds
   *  from now), the defender's pace `v` and how far ahead he may lead him.
   *  Behind the ball that is a lead point on the carrier's line; ahead of it,
   *  the cover's angle to the furthest point he still reaches just after
   *  him; at his heels, a stride and a half behind him rather than through
   *  him. The line is then turned towards the ball as far as it must be. */
  const aims = new Map<Body, Pt>()
  const chaseTo = (b: Body, i: number, route: (tau: number) => Pt, v: number, lead: number, ch: Chase = CHASE): Pt => {
    // (his line is worked out afresh every third frame: a twentieth of a
    // second is too short for a man to change his mind, and it is most of
    // the cost of a clip)
    const kept = aims.get(b)
    if (kept && (frameNo + i) % 3) return kept
    const q = chaseLine(b, i, route, v, lead, ch)
    aims.set(b, q)
    return q
  }
  const chaseLine = (b: Body, i: number, route: (tau: number) => Pt, v: number, lead: number, ch: Chase): Pt => {
    const now = route(0)
    const ahead = (b.x - now.x) * d > 0.3
    let aim: Pt | null = null
    for (let tau = 0; tau <= lead + 1e-6; tau += 0.1) {
      const q = route(tau), T = Math.hypot(q.x - b.x, q.y - b.y) / v
      // there after him, and without crossing his path in front of him on
      // the way (a cover man who aimed at the carrier himself ran into him)
      let clear = T >= tau + ch.margin
      for (let s = 0.25; clear && s < 0.9; s += 0.25) {
        const c = route(s * T)
        if (Math.hypot(b.x + (q.x - b.x) * s - c.x, b.y + (q.y - b.y) * s - c.y) < 2.4) clear = false
      }
      if (clear) aim = q
      else if (aim) break
    }
    if (!aim && ahead) {
      // he is coming straight at him: set, and let him go by, a step off
      // his line if he stands on it (a man meant to be in his path is one
      // of the men who dive at him and miss)
      let near: Pt = now, nd = Infinity
      for (let tau = 0; tau <= 1.5; tau += 0.1) { const q = route(tau), dd = Math.hypot(q.x - b.x, q.y - b.y); if (dd < nd) { nd = dd; near = q } }
      const step = nd < 2.8 ? (2.8 - nd) / Math.max(nd, 0.3) : 0
      aim = { x: b.x + (b.x - near.x) * step, y: b.y + (b.y - near.y) * step }
    }
    if (!aim) {
      const nx = route(0.15), hx = nx.x - now.x, hy = nx.y - now.y, hl = Math.hypot(hx, hy)
      const ux = hl > 0.05 ? hx / hl : d, uy = hl > 0.05 ? hy / hl : 0
      const off = i % 2 ? 1.1 : -1.1
      aim = { x: now.x - ux * ch.heels - uy * off, y: now.y - uy * ch.heels + ux * off }
    }
    // never more than maxTurn off the line to the ball
    const ax = aim.x - b.x, ay = aim.y - b.y, bx = ball.x - b.x, by = ball.y - b.y
    if (Math.hypot(ax, ay) > 1e-6 && Math.hypot(bx, by) > 1e-6) {
      const ang = Math.atan2(ax * by - ay * bx, ax * bx + ay * by)
      if (Math.abs(ang) > ch.maxTurn) {
        const r = ang - Math.sign(ang) * ch.maxTurn, co = Math.cos(r), si = Math.sin(r)
        aim = { x: b.x + ax * co - ay * si, y: b.y + ax * si + ay * co }
      }
    }
    // (and not into his own in-goal while the play is up-field)
    return { x: fieldX(ownLine(aim.x, ball, d)), y: fieldY(aim.y) }
  }
  /** where the ball will be, sampled once a frame for all fifteen of them
   *  (tenths of a second, 3.5 s ahead) rather than walked along its curve
   *  fifteen times over */
  const sampled = (route: (tau: number) => Pt): ((tau: number) => Pt) => {
    const S = Array.from({ length: 36 }, (_, k) => route(k * 0.1))
    return tau => {
      const f = clamp(tau / 0.1, 0, 35), i = Math.min(34, Math.floor(f)), k = f - i
      return { x: lerp(S[i].x, S[i + 1].x, k), y: lerp(S[i].y, S[i + 1].y, k) }
    }
  }
  /** OUTPACED (1.8.2): a man chasing from behind runs 7% slower than the
   *  man with the ball, so the gap grows slowly and he never catches a try
   *  scorer (a chaser at his own top speed ran a slow prop down and through) */
  const outpaced = (route: (tau: number) => Pt) => {
    const a = route(0), b = route(0.05)
    return CHASE.outpace * Math.max(Math.hypot(b.x - a.x, b.y - a.y) / 0.05, 4)
  }
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
    // (the backs ten metres back from the line of touch, both sides, 1.8.2)
    const backsAt = { x: x0 - d * 6, y: touchY + s * 24 }, lineAt = { x: x0 + d * 7, y: touchY + s * 22 }
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
        // (the lifters step in on the jumper as the throw goes, and up he goes)
        const lifter = (i === 2 || i === 4) && t > 0.5 && t < CATCH
        const a = lifter ? { x: att[i].x, y: jumper.y + (i === 2 ? -s : s) * 0.8 } : t < CATCH ? { x: att[i].x, y: att[i].y } : i === scorer ? { x: ball.x - d * 0.4, y: ball.y } : slot(ATTS[order.indexOf(i)], i)
        if (i === 3) att[i].aloft = t > THROW && t < CATCH + 0.25 ? 1 : 0
        const q = t < CATCH ? { x: def[i].x, y: def[i].y } : slot(DEFS[i], i + 9)
        att[i].steer(a.x, a.y, V_PLAYER, A_PLAYER); def[i].steer(q.x, q.y, V_PLAYER, A_PLAYER)
      }
      for (let i = 8; i < 15; i++) {
        const p = shapeAtt(i, { x: front.x - d * 6, y: touchY + s * 24 }, d), q = shapeDef(i, { x: front.x + d * (t < CATCH ? 7 : 3), y: touchY + s * 22 }, d)
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
      const route = caught ? sampled(tau => bezAlong(go, path, c.finish, runK(t - caught + tau, T, 0.5))) : () => ball
      for (let i = 0; i < 15; i++) {
        if (!caught) {
          const a = i === who ? { x: lerp(att[i].x, def[target].x, 0.4), y: lerp(att[i].y, def[target].y, 0.4) } : shapeDef(i, ball, -d)
          if (i === who) att[i].touch = true
          att[i].steer(a.x, a.y, V_PLAYER, A_PLAYER)
          if (i === passer && carrier === 15 + passer) { def[i].touch = true; def[i].hold(fieldX(def[i].x - d * 5 * DT), def[i].y); ball.x = def[i].x; ball.y = def[i].y; continue }
          const q = i === target ? { x: fieldX(def[passer].x + d * 3.5), y: fieldY(def[passer].y + (def[passer].y < 35 ? 8 : -8)) } : shapeAtt(i, ball, -d)
          def[i].steer(q.x, q.y, i === target ? V_PLAYER : V_SHIFT, A_PLAYER)
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
          // ahead of him they are wrong-footed for a moment, then the cover
          // comes across; behind him the nearest two hunt him and the rest
          // scramble after him (1.8.2, CHASE: they used to drift back to
          // their line, and the rest jog home, which read as running away)
          const ahead = (def[i].x - att[who].x) * d > 0.3
          const pk = paceK(c.defPace?.[i])
          if (ahead && t - caught < CHASE.react) { def[i].steer(def[i].x, def[i].y, 3, A_PLAYER); continue }
          const v = Math.min(V_CAP, (ahead ? CHASE.coverV : hunt.has(i) ? CHASE.huntV : CHASE.scrambleV) * pk, ahead ? Infinity : outpaced(route))
          const q = chaseTo(def[i], i, route, v, ahead ? CHASE.coverLead : CHASE.lead)
          def[i].steer(q.x, q.y, v, A_PLAYER)
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
    /** where the charged-down ball is at time tt: on the boot, then
     *  bouncing back over their line to where the charger falls on it */
    const looseAt = (tt: number): Pt => {
      if (tt < KICK + HIT) return { x: block.x, y: block.y }
      const k = clamp((tt - KICK - HIT) / T, 0, 1), e = 1 - (1 - k) * (1 - k)
      return { x: lerp(block.x, spot.x, e), y: lerp(block.y, spot.y, e) }
    }
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
      const loose = sampled(tau => looseAt(t + tau))
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
          // after the block every one of them goes after the loose ball, the
          // nearest three hardest, each to where it will be (1.8.2, CHASE;
          // the rest used to drift back to their line at a walk)
          if (t < KICK) { const q = shapeAtt(i, start, -d); def[i].steer(q.x, q.y, V_PLAYER, A_PLAYER); continue }
          const v = chase.has(i) ? 7.5 : CHASE.scrambleV * 0.85
          const q = chaseTo(def[i], i, loose, v, 1.5)
          def[i].steer(q.x, q.y, v, A_PLAYER)
        }
      }
    })
  }

  // =========================================================== phases
  const pts = c.beats
  const phases: Phase[] = []
  // THE CALLED MOVE, AS IT IS RUN (1.8.2, clipPlays.ts). A strike move is
  // played from its set piece (the scrum fed and hooked, or the lineout
  // thrown, caught and delivered), a shape's from its last ruck, and then
  // the move's own lines, passes, decoys and bite (a 'track'), into the
  // finish.
  const tr = c.move ? tracksFor(c.move)?.[0] : undefined
  const setKind: TrackFrom | null = c.style === 'move' && tr ? (c.launch === 'lineout' ? 'lineout' : c.launch === 'tap' ? 'tap' : 'scrum') : null
  const lo = setKind === 'lineout'
  const SET = setKind === 'lineout' ? 1.85 : setKind === 'tap' ? 0.55 : 1.7
  if (setKind) {
    phases.push({ k: 'set', q: pts[0], dur: SET })
    readOut(0.1, 0.45)
  } else {
    phases.push({ k: 'ruck', q: pts[0], dur: 0.5 })
    if (pts[0].line >= 0) reveals.push({ t: 0.1, line: pts[0].line })
  }
  let prev = -1
  for (let j = setKind ? pts.length : 1; j < pts.length; j++) {
    const b = pts[j], q = pts[j - 1]
    let who = b.carrier
    // the man who has just been tackled is on the floor: the next carry is somebody else's
    if (who === prev) who = FORWARD_CARRIERS.find(s => s !== prev && s !== 9)!
    // in a shape the carry comes off a pod beside the ruck, not from a man
    // stationed out on the edge twenty metres away (1.8.1)
    if (pods?.[who - 1] && Math.abs(pods[who - 1][1]) > 13) who = FORWARD_CARRIERS.find(s => s !== prev && Math.abs(pods[s - 1]?.[1] ?? 99) <= 13) ?? who
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
  const feed = (who: number, len = 2.2) => {
    phases.push({ k: 'pass', who, dur: 0 })
    phases.push({ k: 'run', to: { x: 0, y: 0 }, who, line: -1, end: 'feed', dur: 0.45, tackler: -1, ctrl: { x: len * 0.85, y: 0 } })
  }
  const finishRun = (who: number) => phases.push({ k: 'run', to: c.finish, who, line: -1, end: endKind, dur: 0, tackler: 14 })

  // ---- the track: its men, its frame of reference, its ball
  const roleOf = (r: string) => r === 'W' ? (side * d > 0 ? 14 : 11) : r === 'FW' ? (side * d > 0 ? 11 : 14) : Number(r)
  const useTrack = !!tr && (setKind != null || (c.launch === 'open' && tr.set === 'ruck'))
  const TK = useTrack ? trackFrame(tr!, setKind ?? 'ruck', setKind ? pts[0] : last, side) : null
  /** a track point on the pitch */
  const TP = (fwd: number, across: number, forward = false): Pt => {
    const f = TK!
    return { x: fieldX(f.base.x + d * (fwd + (forward ? 0 : f.shift))), y: fieldY(f.base.y + side * across * (across >= 0 ? f.scP : f.scN)) }
  }
  const runsBy: Record<number, K[]> = {}
  if (TK) for (const [r, ks] of Object.entries(tr!.runs)) runsBy[roleOf(r)] = ks
  const posAt = (shirt: number, k: number): Pt | null => {
    const ks = runsBy[shirt]
    if (!ks) return null
    const [f, a] = trackAt(ks, k)
    return TP(f, a, shirt <= 8)
  }
  const strikeS = TK ? roleOf(tr!.strike) : -1
  const biteOnS = TK && tr!.bite ? roleOf(tr!.bite) : -1
  // the unlisted backs stand in a plain staggered line off the 9
  const BACKS: Record<string, [number, number]> = { '10': [-6, 7], '12': [-7, 14], '13': [-8.5, 21], '15': [-13, 15], W: [-9.5, 31], FW: [-7, -9] }
  const trackStart = (shirt: number): Pt | null => {
    const p = posAt(shirt, 0)
    if (p) return p
    for (const [r, [f, a]] of Object.entries(BACKS)) if (roleOf(r) === shirt) return TP(f, a)
    return null
  }

  if (useTrack) {
    if (!setKind) phases.push({ k: 'dig', q: last, dur: 0.3 })
    phases.push({ k: 'track', dur: 99 })
    if (strikeS === scorer) finishRun(scorer)
    else {
      // the break, and the scorer in support takes the last pass
      phases.push({ k: 'run', to: { x: 0, y: 0 }, who: strikeS, line: -1, end: 'feed', dur: 0.45, tackler: -1, ctrl: { x: 7, y: 0 }, across: 0.6 })
      phases.push({ k: 'pass', who: scorer, dur: 0 })
      finishRun(scorer)
    }
  } else {
    phases.push({ k: 'dig', q: last, dur: 0.35 })
    if (c.style === 'overlap' || c.style === 'move') {
      // three passes along the line: 9 to the first receiver, two more, and the
      // last man is outside his marker
      for (const s of [10, 12, 13, 15, 11, 14].filter(s => s !== scorer).slice(0, 2)) feed(s)
      phases.push({ k: 'pass', who: scorer, dur: 0 })
      finishRun(scorer)
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
      // (a shape with no track of its own: out the back of the pod to the 10)
      if (c.move === 'mv_backdoor' && scorer !== 10) feed(10, 2)
      phases.push({ k: 'pass', who: scorer, dur: 0 })
      finishRun(scorer)
    }
  }
  phases.push({ k: 'done', who: scorer, dur: 99 })

  // ---- THE SET PIECE, DRAWN (1.8.2): two packs bound 3-4-1 with the 9
  // feeding, or two lines of forwards a metre apart with the jumpers lifted,
  // and the backlines back where the law puts them; held still before the
  // ball moves so the viewer can read it
  const setAtt: Pt[] = [], setDef: Pt[] = []
  /** the attacker each defensive back marks, by shirt index */
  const marks: number[] = Array(15).fill(-1)
  const leftY = d > 0 ? -1 : 1           // the attack's left, in y
  const touchY = last.y < 35 ? 0 : 70, ts = touchY === 0 ? 1 : -1
  /** mirror the attack's line: defenders by order across the field onto the
   *  attackers by order across, each on his inside shoulder or square */
  const markUp = (defs: number[], atts: number[], at: (i: number) => Pt, attAt: (s: number) => Pt) => {
    const A = atts.slice().sort((a, b) => (attAt(a).y - attAt(b).y) * side)
    const D = defs.slice().sort((a, b) => (at(a).y - at(b).y) * side)
    // more of them than of us: the spare men stand in the middle of the line
    const off = Math.max(0, Math.floor((D.length - A.length) / 2))
    D.forEach((di, j) => { const a = A[j - off]; if (a != null) marks[di] = a })
    return { A, D }
  }
  if (setKind && TK) {
    const S = pts[0], x0 = S.x
    const backs = [10, 12, 13, 15, 11, 14]
    if (setKind === 'scrum') {
      SCRUM_FORM.forEach(([bk, ac], j) => {
        setAtt[j] = { x: fieldX(x0 - d * bk), y: fieldY(S.y + leftY * ac) }
        // their loosehead is on their left, which is our right
        setDef[j] = { x: fieldX(x0 + d * bk), y: fieldY(S.y - leftY * ac) }
      })
      setAtt[8] = { x: fieldX(x0 - d * 0.4), y: fieldY(S.y + leftY * 2.3) }
      setDef[8] = { x: fieldX(x0 + d * 0.5), y: fieldY(S.y + leftY * 2.5) }
    } else if (setKind === 'lineout') {
      LINEOUT_ORDER.forEach((j, n) => {
        setAtt[j] = { x: fieldX(x0 - d * 0.5), y: touchY + ts * LINEOUT_Y[n] }
        setDef[j] = { x: fieldX(x0 + d * 0.5), y: touchY + ts * LINEOUT_Y[n] }
      })
      setAtt[1] = { x: x0, y: fieldY(touchY + ts * 0.6) }
      setDef[1] = { x: fieldX(x0 + d * 2), y: touchY + ts * 2.5 }
      setAtt[8] = { x: fieldX(x0 - d * 2), y: TK.base.y }
      setDef[8] = { x: fieldX(x0 + d * 2), y: touchY + ts * 15 }
    } else {
      // a tap: the 9 on the mark, the pack in pods either side of him
      for (let j = 0; j < 9; j++) setAtt[j] = posAt(j + 1, 0) ?? { x: fieldX(x0 - d * (2 + (j % 3))), y: fieldY(S.y + (j - 4) * 2.2) }
      for (let j = 0; j < 9; j++) setDef[j] = { x: fieldX(x0 + d * 10), y: fieldY(S.y + (j - 4) * 3) }
    }
    for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9]) { const p = setKind !== 'tap' && s !== 9 ? posAt(s, 0) : null; if (p) setAtt[s - 1] = p }
    for (const s of backs) setAtt[s - 1] = trackStart(s) ?? setAtt[s - 1] ?? TP(-8, 10)
    // the defending backs: behind their hindmost foot at a scrum, ten
    // metres back at a lineout or a tap, each opposite his man
    const gap = setKind === 'scrum' ? SCRUM_FORM[7][0] + DS.scrumGap : 10
    // (man for man by the numbers: their 10, 12 and 13 on ours, and their
    // wings on ours, their 11 facing our 14)
    const D = [9, 10, 11, 12, 13]
    marks[9] = 9; marks[11] = 11; marks[12] = 12; marks[10] = 13; marks[13] = 10
    for (const i of D) {
      const m = marks[i]
      const y = m >= 0 ? setAtt[m].y - side * DS.inside : S.y
      setDef[i] = { x: fieldX(ownLine(x0 + d * gap, S, d)), y: fieldY(y) }
    }
    setDef[14] = { x: fieldX(ownLine(x0 + d * (gap + 14), S, d)), y: fieldY(lerp(35, TK.base.y + side * 14, DS.pendulum ? 0.6 : 0.35)) }
    for (let i = 0; i < 15; i++) {
      att[i].x = setAtt[i].x; att[i].y = setAtt[i].y
      def[i].x = setDef[i].x; def[i].y = setDef[i].y
    }
    if (setKind === 'lineout') { ball.x = setAtt[1].x; ball.y = setAtt[1].y } else { ball.x = setAtt[8].x; ball.y = setAtt[8].y }
  }

  // where a receiver should be standing for a pass from a ruck at q
  const receiveSpot = (q: Pt, who: number): Pt => {
    // in a phase-play shape a forward takes it where his pod stands
    if (pods?.[who - 1]) return shapeAtt(who - 1, q, d)
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

  // ---- the track as it is played: who has the ball, the pass in the air,
  // the next pass, and the bite
  let holder = -1, flight: { from: Pt; to: number; t0: number; dur: number; lift: number } | null = null, nextPass = 0, caughtAt = -9
  let trackT0 = 0, trackX0: number[] = [], trackY0: number[] = [], trackBy0 = 0
  const biteFrom: Record<number, { x: number; y: number; ux: number; uy: number }> = {}
  /** the man who bites on the decoy: his marker, or the nearest to him */
  const biterOf = () => {
    const on = att[biteOnS - 1]
    let bd = Infinity, bi = -1
    def.forEach((b, i) => { if (i === 14 || i === 8 || (setKind && i < 8 && setKind !== 'tap')) return; const dd = Math.hypot(b.x - on.x, b.y - on.y) + (marks[i] === biteOnS - 1 ? -4 : 0); if (dd < bd) { bd = dd; bi = i } })
    return bi
  }
  let hitDef = -1, hitX = 0
  const trackIdx = phases.findIndex(x => x.k === 'track')
  let biteI = -1, biteIn = -1, biteT = opts?.biteAt ?? Infinity, biteHit = -1, strikeCaught = -1
  const trackIdle = (i: number): Pt => {
    // a man with no line in the move: the pack unbinds and follows at a
    // jog, a back holds his place and comes up with the line
    const p = setAtt[i] ?? trackStart(i + 1)
    if (i < 8 || !p) return shapeAtt(i, { x: ball.x, y: ball.y }, d)
    return { x: fieldX(p.x + d * Math.min(4, (ball.x - (TK?.base.x ?? ball.x)) * d * 0.5 + 1)), y: p.y }
  }

  let p = 0, ps = 0, heldAt = -1, thiefI = -1
  const enter = (ph: Phase, t: number) => {
    if (ph.k === 'track') {
      trackT0 = t
      holder = roleOf(tr!.first ?? '9') - 1
      trackX0 = def.map(b => b.x)
      trackY0 = def.map(b => b.y)
      trackBy0 = ball.y
      // in open play the defence marks up on the move's men as it forms
      if (!setKind) {
        const ruckMen = new Set(def.map((b, i) => ({ i, dd: Math.hypot(b.x - last.x, b.y - last.y) })).sort((a, b) => a.dd - b.dd).slice(0, 2).map(r => r.i))
        const dmen = def.map((_, i) => i).filter(i => i !== 8 && i !== 14 && !ruckMen.has(i))
        const amen = Object.keys(runsBy).map(Number).filter(s => s !== 9).map(s => s - 1)
        markUp(dmen, amen, i => def[i], i => att[i])
      }
    } else if (ph.k === 'pass') {
      ph.from = { x: ball.x, y: ball.y }
      const r = att[ph.who - 1]
      // (a called move's long pass, off the back of the pod to a wing, is
      // given the air time it needs rather than a ball faster than a pass)
      ph.dur = Math.max(Math.hypot(r.x - ball.x, r.y - ball.y) / 22, clamp(Math.hypot(r.x - ball.x, r.y - ball.y) / 17, 0.3, c.move ? 1.2 : 0.95))
    } else if (ph.k === 'run') {
      const r = att[ph.who - 1]
      ph.from = { x: r.x + d * 0.4, y: r.y }
      if (ph.end === 'feed') {
        // a few strides onto the ball, drifting towards the space (a move's
        // runner runs the line it asks for: across, or back against the grain)
        const a = ph.ctrl!.x, cc = ph.across ?? 1.2
        ph.to = { x: fieldX(ph.from.x + d * a), y: fieldY(ph.from.y + side * cc) }
        ph.ctrl = { x: (ph.from.x + ph.to.x) / 2, y: (ph.from.y + ph.to.y) / 2 }
        ph.ta = 0.2
        ph.a0 = clamp(Math.hypot(r.vx, r.vy) / 9, 0, 0.9)
        if (ph.across != null) ph.dur = Math.max(0.45, Math.hypot(a, cc) / 7.5 + ph.ta * (1 - ph.a0 / 2))
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
        // chases. Anybody still near his line has a go and misses, and so do
        // as many more as the commentary says he beat.
        missers = []
        frozen = def.map(b => ({ x: fieldX(b.x + b.vx * 0.3), y: fieldY(b.y + b.vy * 0.3) }))
        // the nearest two chase him hardest
        hunters = new Set(def.map((b, i) => ({ i, dd: Math.hypot(b.x - ph.from!.x, b.y - ph.from!.y) })).sort((a, b) => a.dd - b.dd).slice(0, 2).map(r => r.i))
        // (off a crossfield kick he is over from the catch: straight in,
        // where a line bent round the men chasing the kick made the quick
        // wing's run the longer one)
        ph.ctrl = c.style === 'crossfield' ? { x: (ph.from.x + ph.to.x) / 2, y: (ph.from.y + ph.to.y) / 2 } : gapLine(ph.from, ph.to)
        const skip = (i: number) => (i === 14 && ph.end === 'held') || missers.some(m => m.i === i)
        const nearest = (i: number) => {
          let bs = 0.5, bd = Infinity
          for (let s = 0.02; s <= 0.95; s += 0.03) { const q = bez(ph.from!, ph.ctrl!, ph.to, s); const dd = Math.hypot(q.x - frozen[i].x, q.y - frozen[i].y); if (dd < bd) { bd = dd; bs = s } }
          return { s: bs, dist: bd }
        }
        const ranked = def.map((_, i) => ({ i, ...nearest(i) })).filter(r => !skip(r.i) && (frozen[r.i].x - ph.from!.x) * d > 0).sort((a, b) => a.dist - b.dist)
        // (up to four of them: a fourth man standing in his line was left
        // out at three and the finisher ran straight through him)
        for (const r of ranked) if (r.dist < 2.6 && missers.length < 4) missers.push({ i: r.i, s: r.s, dove: 0 })
        for (const r of ranked) if (missers.length < Math.min(3, Math.max(missers.length, c.misses)) && !missers.some(m => m.i === r.i) && r.dist < 9) missers.push({ i: r.i, s: clamp(r.s, 0.25, 0.85), dove: 0 })
        contact.push(...missers.map(m => m.i))
        if (ph.end === 'held') contact.push(14)
        // the men who bit on the decoy are in the play too: the ball went
        // past them, and the finisher runs by the man they went for
        for (const b of [biteI, biteIn]) if (b >= 0 && !contact.includes(b)) contact.push(b)
      } else ph.ctrl = { x: (ph.from.x + ph.to.x) / 2, y: (ph.from.y + ph.to.y) / 2 }
      const dist = bezLen(ph.from, ph.ctrl, ph.to)
      const pace = (ph.who >= 9 ? 9.5 : 7.5) * paceK(c.attPace?.[ph.who - 1])
      ph.ta = 0.4
      // ON THE RUN (1.8.2): a man who takes it at pace carries on at pace;
      // only a man standing still starts from nothing
      ph.a0 = clamp(Math.hypot(r.vx, r.vy) / pace, 0, 0.9)
      ph.dur = Math.max(0.9, dist / pace + ph.ta * (1 - ph.a0 / 2))
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
  /** a man's top speed on his feet: a back's sprint and a forward's */
  const sprint = (_team: Body[], i: number, pace?: (number | undefined)[]) => Math.min(V_CAP, (i >= 8 ? V_BACK : V_FWD) * paceK(pace?.[i]))

  const baked = record(endOf, (t) => {
    while (t >= ps + phases[p].dur && p < phases.length - 1) { ps += phases[p].dur; p++; enter(phases[p], ps) }
    const ph = phases[p], k = t - ps
    // the next man to take a pass, drifting into place for it
    const next = phases.slice(p + 1).find(x => x.k === 'pass') as Extract<Phase, { k: 'pass' }> | undefined
    const kickNext = phases.slice(p).find(x => x.k === 'kick') as Extract<Phase, { k: 'kick' }> | undefined
    const ruckAt = ph.k === 'ruck' || ph.k === 'dig' ? ph.q : ph.k === 'run' && ph.end === 'ruck' ? ph.to : null
    const finishing = ph.k === 'run' && (ph.end === 'score' || ph.end === 'held')
    // the last ruck before a move off it: the men of the move take their marks
    const forming = useTrack && !setKind && (ph.k === 'ruck' || ph.k === 'dig') && !phases.slice(p + 1).some(x => x.k === 'ruck')
    carrier = -1
    const kt = t - trackT0

    // ---- the ball in a track: in the hands of the man running his line, or
    // in the air between two of them
    if (ph.k === 'track') {
      const nb = tr!.ball[nextPass]
      // (a man holds it a moment before he moves it on: never a catch and a
      // pass in one frame)
      if (!flight && nb && kt >= nb[0] && kt >= caughtAt + 0.15) {
        const to = roleOf(nb[1]) - 1, from = { x: ball.x, y: ball.y }
        const r = att[to], dist = Math.hypot(r.x + r.vx * 0.3 - from.x, r.y + r.vy * 0.3 - from.y)
        const kind = nb[2] ?? 'pass'
        // (never faster on average than a hard pass, 22 m/s)
        const dur = Math.max(dist / 22, kind === 'pop' ? clamp(dist / 13, 0.2, 0.35) : kind === 'miss' ? clamp(dist / 18, 0.5, 0.85) : clamp(dist / 16, 0.3, 0.55))
        flight = { from, to, t0: kt, dur, lift: kind === 'pop' ? 0.5 : kind === 'miss' ? 1.8 : 0.9 }
        nextPass++
      }
      if (flight) {
        const r = att[flight.to], kk = smooth((kt - flight.t0) / flight.dur)
        ball.x = lerp(flight.from.x, r.x + d * 0.4, kk); ball.y = lerp(flight.from.y, r.y, kk)
        ball.lift = Math.sin(Math.PI * kk) * flight.lift
        if (kk >= 1) {
          holder = flight.to; flight = null; caughtAt = kt
          if (holder === strikeS - 1) { strikeCaught = t; ph.dur = k + DT / 2 }
        }
      } else if (holder >= 0) {
        // in his hands (brought there, never snapped: off the base of a ruck
        // the 9 stands a stride from where it was)
        const hx = att[holder].x + d * 0.4 - ball.x, hy = att[holder].y - ball.y, hd = Math.hypot(hx, hy), st = Math.min(1, 16 * DT / Math.max(hd, 1e-6))
        ball.x += hx * st; ball.y += hy * st; ball.lift = 0; carrier = holder
      }
    }
    // THE BITE: the man on the decoy (and the man inside him) step in on
    // him, 0.3 to 0.5 s before the gap is hit (the bake is run twice: the
    // first finds when the strike runner hits the line)
    if (biteOnS > 0 && biteI < 0 && t >= biteT - 0.05 && p >= trackIdx) {
      biteI = opts?.biteDef ?? biterOf()
      // his inside neighbour, the next man towards the ruck
      let bn = Infinity
      def.forEach((b, i) => { if (i === biteI || i === 14 || i === 8) return; const ac = (def[biteI].y - b.y) * side; if (ac > 0 && ac < bn && Math.abs(b.x - def[biteI].x) < 6) { bn = ac; biteIn = i } })
      // (they are in the play: the ball goes past the men who went for the decoy)
      for (const b of [biteI, biteIn]) if (b >= 0 && !contact.includes(b)) contact.push(b)
    }
    for (let i = 0; i < 15; i++) {
      const shirt = i + 1
      let tgt = shapeAtt(i, ball, d)
      let vm = i >= 8 ? V_SHAPE_BACK : V_SHAPE_FWD
      if (next && next.who === shirt && ruckAt && ph.k !== 'pass') tgt = receiveSpot(ruckAt, shirt)
      // outside the man with the ball, a step behind, running onto it
      if (next && next.who === shirt && ph.k === 'run' && ph.end === 'feed') { tgt = { x: fieldX(ball.x - d * 3.5), y: fieldY(ball.y + side * 5) }; vm = sprint(att, i, c.attPace) }
      if (ph.k === 'pass' && ph.who === shirt) { const r = att[i]; tgt = { x: r.x + d * 2, y: r.y }; vm = V_PLAYER }
      // the chaser of a kick: out wide for a crossfield, then onto the ball
      if (kickNext && kickNext.chaser === shirt && ph.k !== 'kick' && !(ph.k === 'run' && ph.who === shirt)) {
        tgt = c.style === 'crossfield' ? { x: fieldX(kickNext.to.x - d * 10), y: kickNext.to.y } : tgt
        if (c.style === 'crossfield') vm = V_PLAYER
      }
      if (ph.k === 'kick' && ph.chaser === shirt) {
        const kk = clamp(k / ph.dur, 0, 1)
        tgt = { x: ph.to.x - d * 0.4 * (1 - kk), y: ph.to.y }; vm = V_PLAYER
      }
      if (shirt === 9 && ruckAt && !(next?.who === 9)) { tgt = { x: ruckAt.x - d * 1, y: ruckAt.y + 0.6 }; vm = V_PLAYER }
      if (ph.k === 'ruck' && ph.tackled === shirt) { tgt = { x: ph.q.x - d * 0.6, y: ph.q.y }; att[i].touch = true }
      if (ph.k === 'ruck' && shirt === 9) att[i].touch = true
      // the move's men take their marks as the last ruck forms
      if (forming && shirt !== 9) { const q = trackStart(shirt); if (q && !(ph.k === 'ruck' && ph.tackled === shirt)) { tgt = q; vm = sprint(att, i, c.attPace) } }
      // THE SET PIECE: bound, lifting, feeding; nobody moves until the ball does
      if (ph.k === 'set') {
        tgt = setAtt[i]; vm = 4
        if (i < 8 && setKind !== 'tap') att[i].touch = true
        if (setKind === 'scrum' && i === 8) {
          // the 9 feeds at the mouth, then goes round to the base
          if (k > 0.85) { tgt = { x: fieldX(pts[0].x - d * 3.4), y: fieldY(pts[0].y + leftY * 0.8) }; vm = 4.5 }
          att[i].touch = true
        }
        if (setKind === 'lineout') {
          const jy = touchY + ts * LINEOUT_Y[1]
          // the lifters step in to the jumper as the throw goes, and he goes up
          if ((i === 0 || i === 2) && k > 0.5 && k < 1.75) tgt = { x: setAtt[i].x, y: jy + (i === 0 ? -ts : ts) * 0.85 }
          att[i].aloft = i === 3 && k > 0.7 && k < 1.6 ? 1 : 0
        }
      }
      // THE TRACK: each man on his line, the decoys at a carrier's pace
      if (ph.k === 'track') {
        const q = posAt(shirt, kt + LOOK)
        if (q) {
          const a = posAt(shirt, kt)!, b = posAt(shirt, kt + 0.3)!
          const v = Math.hypot(b.x - a.x, b.y - a.y) / 0.3
          tgt = q; vm = clamp(v * 1.3 + 1, 3, sprint(att, i, c.attPace))
        } else if (shirt === 9 && holder !== 8) {
          // the 9 follows his pass
          tgt = { x: fieldX(ball.x - d * 5), y: fieldY(lerp(att[i].y, ball.y, 0.5)) }; vm = 6
        } else if (shirt !== holder + 1) { tgt = trackIdle(i); vm = i < 8 ? (kt < 0.6 && setKind === 'scrum' ? 1 : 4.5) : 5 }
        if (i < 8 && setKind === 'scrum' && kt < 0.4 && !runsBy[shirt]) att[i].touch = true
        // the scorer, if he is not on the move's line, works up in support
        if (shirt === scorer && !runsBy[shirt] && shirt !== holder + 1) { const w = att[strikeS - 1]; tgt = { x: fieldX(w.x - d * 4), y: fieldY(w.y + side * 4) }; vm = sprint(att, i, c.attPace) }
      }
      const snapped = (ph.k === 'run' && ph.who === shirt) || (ph.k === 'done' && ph.who === shirt) || (ph.k === 'kick' && ph.who === shirt && k < 0.05)
      if (snapped) { if (!(ph.k === 'done' && heldAt >= 0)) carrier = i; continue }
      att[i].steer(tgt.x, tgt.y, vm, A_PLAYER)
    }

    // when the strike runner hits their line, at the man who bites (or, in
    // the first bake, the man who will): the bite is timed off it
    // (their line where he stood as the strike runner took it: a man marking
    // the decoy goes with him, and the gap is where he was)
    if (strikeCaught > 0 && hitDef < 0 && biteOnS > 0) { hitDef = biteI >= 0 ? biteI : biterOf(); hitX = def[hitDef].x }
    if (strikeCaught > 0 && biteHit < 0 && hitDef >= 0 && t > strikeCaught && (att[strikeS - 1].x - hitX) * d > 0) { biteHit = t; if (opts?.scout) halt = true }

    // the ball, and the man carrying it
    if (ph.k === 'ruck' || ph.k === 'dig') { ball.x = ph.q.x; ball.y = ph.q.y; ball.lift = 0 }
    else if (ph.k === 'set') {
      const S = pts[0]
      if (setKind === 'lineout') {
        // the throw: the hooker on the touchline to the jumper at the top of
        // his lift, and down to the 9
        const THROW = 0.7, CATCH = 1.35, DOWN = 1.55
        const jp = att[3], n9 = att[8]
        if (k < THROW) { ball.x = att[1].x; ball.y = att[1].y; ball.lift = 0.3; carrier = 1 }
        else if (k < CATCH) {
          const kk = smooth((k - THROW) / (CATCH - THROW))
          ball.x = lerp(setAtt[1].x, jp.x, kk); ball.y = lerp(setAtt[1].y, jp.y, kk)
          ball.lift = Math.sin(Math.PI * kk) * 3.5 + kk * 2.2
        } else if (k < DOWN) { ball.x = jp.x; ball.y = jp.y; ball.lift = 2.2; carrier = 3 }
        else {
          const kk = smooth((k - DOWN) / (SET - DOWN))
          ball.x = lerp(jp.x, n9.x + d * 0.4, kk); ball.y = lerp(jp.y, n9.y, kk); ball.lift = lerp(2.2, 0.4, kk)
          if (kk >= 1) carrier = 8
        }
      } else if (setKind === 'scrum') {
        // the feed: in the 9's hands at the mouth, into the tunnel, and
        // hooked back to the No. 8's feet, where the 9 picks it up
        const FEED = 0.6, IN = 0.8, BACK = 1.3
        const mouth = { x: S.x, y: S.y }, feet = { x: fieldX(S.x - d * 2.9), y: S.y }
        if (k < FEED) { ball.x = att[8].x; ball.y = att[8].y; ball.lift = 0.4; carrier = 8 }
        else if (k < IN) { const kk = smooth((k - FEED) / (IN - FEED)); ball.x = lerp(setAtt[8].x, mouth.x, kk); ball.y = lerp(setAtt[8].y, mouth.y, kk); ball.lift = 0.2 * (1 - kk) }
        else if (k < BACK) { const kk = smooth((k - IN) / (BACK - IN)); ball.x = lerp(mouth.x, feet.x, kk); ball.y = lerp(mouth.y, feet.y, kk); ball.lift = 0 }
        else {
          // (a wrap: the 8 has it at his feet; otherwise the 9 comes to it)
          const who = tr?.first === '8' ? 7 : 8
          const kk = smooth((k - BACK) / (SET - BACK))
          ball.x = lerp(feet.x, att[who].x + d * 0.4, kk); ball.y = lerp(feet.y, att[who].y, kk); ball.lift = 0
        }
      } else { ball.x = att[8].x + d * 0.4; ball.y = att[8].y; ball.lift = k > 0.3 ? 0.3 : 0; carrier = 8 }
    } else if (ph.k === 'pass') {
      const r = att[ph.who - 1], kk = smooth(k / ph.dur)
      ball.x = lerp(ph.from!.x, r.x + d * 0.4, kk); ball.y = lerp(ph.from!.y, r.y, kk)
      ball.lift = Math.sin(Math.PI * kk) * (0.6 + ph.dur)
    } else if (ph.k === 'run') {
      const kk = runK(k, ph.dur, ph.ta!, ph.a0)
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

    // where the ball will be tau seconds from now, for the chase (1.8.2):
    // the finisher on his line, or a kick in the air
    const route: ((tau: number) => Pt) | null = finishing
      ? sampled(tau => { const r = ph as Extract<Phase, { k: 'run' }>; return bezAlong(r.from!, r.ctrl!, r.to, runK(k + tau, r.dur, r.ta!, r.a0)) })
      : ph.k === 'kick'
        ? sampled(tau => {
          const kk = clamp((k + tau) / ph.dur, 0, 1), e = ph.low ? 1 - (1 - kk) * (1 - kk) : smooth(kk)
          return { x: lerp(ph.from!.x, ph.to.x, e), y: lerp(ph.from!.y, ph.to.y, e) }
        })
        : null
    // how far their line has come up since the ball came out
    const adv = (s: number) => { const q = Math.max(0, s - 0.25); return DS.up * Math.min(q, DS.upFor) + DS.upAfter * Math.max(0, q - DS.upFor) }
    for (let i = 0; i < 15; i++) {
      if (carrier === 15 + i) continue
      let tgt = shapeDef(i, ball, d)
      // a defensive line shifts at a hard run, not a sprint (at a sprint the
      // far side of it crossed the field at 11 m/s with every pass)
      let vmax = i < 8 ? V_SHAPE_FWD : V_SHIFT
      // (a man planting to go in on the decoy stops his slide sharply)
      let amax = A_PLAYER
      // THE SET PIECE: bound or in the line until the ball is out
      if (ph.k === 'set') {
        tgt = setDef[i]; vmax = 4
        if (i < 8 && setKind !== 'tap') def[i].touch = true
        if (setKind === 'scrum' && i === 8) tgt = { x: fieldX(ball.x + d * 0.6), y: setDef[8].y }
        if (setKind === 'lineout') {
          const jy = touchY + ts * LINEOUT_Y[1]
          if ((i === 0 || i === 2) && k > 0.55 && k < 1.7) tgt = { x: setDef[i].x, y: jy + (i === 0 ? -ts : ts) * 0.85 }
          def[i].aloft = i === 3 && k > 0.75 && k < 1.45 ? 1 : 0
        }
      } else if (ph.k === 'track' || (TK && setKind && !finishing && ph.k !== 'done' && p <= trackIdx + 1)) {
        // THE LINE BY ITS SYSTEM (defenceShape): up at its speed, sliding
        // with the ball or following its men, never through them
        const m = marks[i]
        if (m >= 0) {
          const man = att[m]
          const slideY = DS.slide * Math.max(0, (ball.y - trackBy0) * side)
          const y = DS.mark === 'man' ? man.y - side * 0.3 : (setDef[i]?.y ?? trackY0[i] ?? def[i].y) + side * slideY
          // (aimed a little ahead of where the line is, so it keeps up)
          let x = (trackX0[i] ?? def[i].x) - d * adv(kt + 0.45)
          if ((x - man.x) * d < 1.6) x = man.x + d * 1.6
          tgt = { x, y: DS.mark === 'man' ? y : lerp(y, man.y - side * DS.inside, 0.35) }
          vmax = Math.max(V_SHIFT, DS.up + 1)
        } else if (i === 14) {
          tgt = { x: fieldX(ownLine((TK?.base.x ?? ball.x) + d * 20 - d * adv(kt) * 0.3, ball, d)), y: fieldY(lerp(35, ball.y + side * 8, DS.pendulum ? 0.65 : 0.4)) }
        } else if (i === 8) {
          // their 9 at the base, then after the ball
          tgt = kt < 0.3 ? def[i] : { x: fieldX(ball.x + d * 3), y: fieldY(ball.y + side * 1.5) }; vmax = 6.5
        } else if (i < 8 && setKind === 'scrum') {
          // the pack stays bound until the ball is out; the flanker on the
          // side it goes breaks first, into the channel by the scrum
          const flank = (i === 5 || i === 6) && Math.sign(setDef[i].y - pts[0].y) === side
          if (kt < (flank ? 0.4 : i === 7 ? 0.8 : 1.1)) { tgt = setDef[i]; def[i].touch = true; vmax = 2 }
          else { tgt = flank ? { x: fieldX(pts[0].x + d * 3.5 - d * adv(kt) * 0.4), y: fieldY(TK!.base.y + side * (5 + kt * 2)) } : { x: fieldX(ball.x + d * (4 + (i % 3))), y: fieldY(ball.y + side * (i % 4) * 1.5) }; vmax = flank ? 7 : 5 }
        } else if (i < 8 && setKind === 'lineout') {
          if (kt < 0.6) { tgt = setDef[i]; vmax = 2 } else { tgt = { x: fieldX(ball.x + d * (6 + (i % 3))), y: fieldY(lerp(setDef[i].y, ball.y, 0.35)) }; vmax = 4.5 }
        }
      }
      // on his run: ahead of him, the line holds for a moment; then everybody
      // goes after the ball (1.8.2, CHASE and chaseTo): behind him on a
      // pursuit line, ahead of him the cover across to cut him off
      if (finishing && frozen.length && route) {
        const ahead = (def[i].x - ball.x) * d > 0.3
        const pk = paceK(c.defPace?.[i])
        if ((i === biteI || i === biteIn) && t < biteT + 0.45) { /* still going in on the decoy */ }
        else if (ahead && k < CH.react) { tgt = frozen[i]; vmax = 3 }
        else {
          const v = Math.min(V_CAP, (ahead ? CH.coverV : hunters.has(i) ? CH.huntV : CH.scrambleV) * pk, ahead ? Infinity : outpaced(route))
          tgt = chaseTo(def[i], i, route, v, ahead ? CH.coverLead : CH.lead, CH); vmax = v
          // (a man who is not one of the tacklers does not run into him as he
          // slows for the line: he stays a stride off)
          const ox = def[i].x - ball.x, oy = def[i].y - ball.y, od = Math.hypot(ox, oy)
          if (od < 2.2 && !contact.includes(i)) { tgt = { x: ball.x + ox / (od || 1) * 2.2, y: ball.y + oy / (od || 1) * 2.2 }; vmax = Math.min(vmax, 6) }
        }
      } else if (route && ph.k === 'kick') {
        // a kick through them (a grubber, a chip, a crossfield) is the same
        // break: they chase where it will come down, the nearest two hardest
        const v = Math.min(V_CAP, (kickHunters.has(i) ? CH.huntV : CH.scrambleV) * paceK(c.defPace?.[i]))
        tgt = chaseTo(def[i], i, route, v, CH.coverLead, CH); vmax = v
      } else if (ph.k === 'done' && c.kind !== 'attack') {
        // and once it is down they close on it at a jog, to a few metres off
        const ux = def[i].x - ball.x, uy = def[i].y - ball.y, ul = Math.hypot(ux, uy) || 1, ring = 4 + (i % 4)
        tgt = ul > ring ? { x: ball.x + ux / ul * ring, y: ball.y + uy / ul * ring } : { x: def[i].x, y: def[i].y }; vmax = 5
      }
      // THE BITE: in on the decoy, a step or two, as he threatens
      if ((i === biteI || i === biteIn) && t < biteT + 0.7) {
        // (a step or two from where he stood as he went, towards where the
        // decoy was: he commits, he does not follow him through)
        const on = att[biteOnS - 1], step = i === biteI ? DS.bite : DS.bite * 0.6
        const o = biteFrom[i] ??= { x: def[i].x, y: def[i].y, ux: 0, uy: 0 }
        if (!o.ux && !o.uy) { const ux = on.x - o.x, uy = on.y - o.y, ul = Math.hypot(ux, uy) || 1; o.ux = ux / ul; o.uy = uy / ul }
        tgt = { x: o.x + o.ux * step * 2.2, y: o.y + o.uy * step * 2.2 }; vmax = 6.5; amax = A_PLAYER * 1.5
        const ul = Math.hypot(on.x - def[i].x, on.y - def[i].y)
        if (ul < 1.6) { def[i].touch = true; on.touch = true }
      }
      // the men he beats: at his line as he gets there, a dive, and the floor
      const biting = (i === biteI || i === biteIn) && t < biteT + 0.45
      const m = finishing && !biting ? missers.find(x => x.i === i) : undefined
      if (m && finishing) {
        const at = bez(ph.from!, ph.ctrl!, ph.to, m.s)
        const near = Math.hypot(ball.x - def[i].x, ball.y - def[i].y)
        if (!m.dove && near < 2.4) { m.dove = t }
        // a man who never got close enough to dive has missed him already
        // once he is behind the ball, and joins the cover rather than running
        // up-field to a spot on a path the carrier has left
        const beaten = (def[i].x - ball.x) * d <= 0.3
        if (!m.dove && !beaten) { tgt = at; vmax = Math.min(V_CAP, V_BACK * paceK(c.defPace?.[i])) }
        else if (t - m.dove < 0.3) { tgt = { x: ball.x - d * 1.2, y: ball.y }; def[i].touch = true }
        else if (!def[i].down && t - m.dove < 0.35) def[i].down = 1.1
      }
      // the tackler meets the carry and stays in the ruck; a choke tackle
      // (1.8.2) is two of them, holding him up
      const choker = DS.choke && ph.k !== 'set' && (ph.k === 'ruck' || (ph.k === 'run' && ph.end === 'ruck')) && i === TACKLERS[(TACKLERS.indexOf((ph as { tackler?: number }).tackler ?? -1) + 3) % TACKLERS.length]
      if (ph.k === 'run' && ph.end === 'ruck' && (ph.tackler === i || choker) && k > ph.dur - 1.1) { tgt = { x: ph.to.x + d * 0.8, y: ph.to.y + (choker ? 0.9 : 0) }; def[i].touch = true; vmax = V_BACK }
      if (ph.k === 'ruck' && (ph.tackler === i || choker)) { tgt = { x: ph.q.x + d * 0.8, y: ph.q.y + (choker ? 0.9 : 0) }; def[i].touch = true }
      // the full-back's last-gasp tackle, and the openside over the ball after it
      // (he comes up to meet him: to the first point of his line he can
      // reach in time, not back to the spot where they will meet)
      if (c.kind === 'attack' && i === 14 && (finishing || ph.k === 'done')) {
        vmax = Math.min(V_CAP, 9.5 * paceK(c.defPace?.[i]))
        tgt = { x: ball.x + d * 0.8, y: ball.y }
        if (finishing && route) {
          for (let tau = 0; tau <= 3.4; tau += 0.1) {
            const q = route(tau)
            if (Math.hypot(q.x + d * 0.8 - def[i].x, q.y - def[i].y) / vmax <= tau + 0.1) { tgt = { x: q.x + d * 0.8, y: q.y }; break }
            tgt = { x: ph.to.x + d * 0.8, y: ph.to.y }
          }
        }
        def[i].touch = true
      }
      if (c.kind === 'attack' && i === thiefI && ph.k === 'done' && c.ending === 'turnover') { tgt = { x: ball.x + d * 0.6, y: ball.y + 0.5 }; def[i].touch = true }
      def[i].steer(fieldX(tgt.x), fieldY(tgt.y), vmax, amax)
    }
  })
  end = endOf()
  banner = c.reviewLine != null ? land + 2.0 : c.ending === 'turnover' ? land + 0.7 : land + 0.05
  if (c.reviewLine != null) reveals.push({ t: land, line: c.reviewLine })
  baked.tl = {
    reveals, land, banner, end, run, contact,
    ...(setKind ? { set: { kind: setKind, out: SET } } : {}),
    ...(biteI >= 0 ? { bite: { def: biteI, on: biteOnS - 1, t: biteT, strike: strikeS - 1, hit: biteHit, caught: strikeCaught } } : {}),
    ...(useTrack && biteI < 0 && biteHit > 0 ? { hit: biteHit, hitDef } : {}),
  }
  return baked
}

const baked = new WeakMap<ClipSpec, Baked>()
/** baked once, or for a move with a bite twice: the first time finds when
 *  the strike runner hits their line, so the man on the decoy bites 0.4 s
 *  before it (1.8.2) */
const bakeOf = (c: ClipSpec) => {
  let b = baked.get(c)
  if (!b) {
    const tr = c.move ? tracksFor(c.move)?.[0] : undefined
    b = bake(c, { scout: !!tr?.bite })
    if (tr?.bite && b.tl.hit != null && b.tl.hit > 0) {
      const biteDef = b.tl.hitDef
      b = bake(c, { biteAt: b.tl.hit - BITE_LEAD, biteDef })
      // (his step in brings the line to the runner a little sooner: once more,
      // from where the gap was hit this time)
      for (let k = 0; k < 2; k++) {
        const bt = b.tl.bite
        if (!bt || bt.hit <= 0 || Math.abs(bt.hit - bt.t - BITE_LEAD) <= 0.06) break
        b = bake(c, { biteAt: bt.hit - BITE_LEAD, biteDef })
      }
    }
    baked.set(c, b)
  }
  return b
}
/** how long before the gap is hit the man on the decoy bites (s) */
const BITE_LEAD = 0.42

/** When each commentary line is revealed, and the ball goes down. */
export function clipTimeline(c: ClipSpec): Timeline { return bakeOf(c).tl }

/** How long the clip runs, in seconds at normal speed. */
export function clipLength(c: ClipSpec): number { return bakeOf(c).tl.end }

/**
 * Everything on the pitch at time t, in field metres: read back from the
 * bake, blended between the two nearest of its 60-a-second frames.
 * `carrying` and `down` are 30 long: the attack's 15, then the defence's.
 */
export function frameAt(spec: ClipSpec, t: number): { ball: Pt; lift: number; att: Pt[]; def: Pt[]; ref: Pt; carrying: number[]; down: number[]; aloft: number[] } {
  const b = bakeOf(spec)
  const f = clamp(t * REC_FPS, 0, b.n - 1), i = Math.floor(f), j = Math.min(b.n - 1, i + 1), k = f - i
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
    aloft: Array.from({ length: 30 }, (_, s) => at(b.aloft, 30, s)),
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
      // (1.8.2: a touch bigger again at phone size, so the numbers read)
      const R0 = Math.max(6, dim.sc * 1.1), R = R0 * 1.2
      const finishing = t > tl.land - 0.01

      const dot = (p: Pt, fill: string, edge: string, num: number, ring: boolean, down: boolean, aloft = 0) => {
        const x = X(p.x), y = Y(clamp(p.y, 0.5, 69.5))
        // a lineout jumper at the top of his lift: bigger, his shadow further off
        const r = R * (1 + 0.28 * aloft), lift = 1 + 2.5 * aloft
        g.globalAlpha = down ? 0.5 : 1
        g.beginPath(); g.arc(x, y + lift, r, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill()
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill()
        g.lineWidth = ring ? 2 : 1.2; g.strokeStyle = ring ? ink.white : edge; g.stroke()
        g.fillStyle = isLight(fill) ? ink.dark : ink.white; g.font = `800 ${Math.round(R * 1.12)}px system-ui, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(String(num), x, y + 0.5)
        g.globalAlpha = 1
      }

      for (let i = 0; i < 15; i++) dot(f.def[i], spec.def[0], spec.def[1], i + 1, f.carrying[15 + i] > 0.5, f.down[15 + i] > 0.5, f.aloft[15 + i])
      for (let i = 0; i < 15; i++) dot(f.att[i], spec.att[0], spec.att[1], i + 1, f.carrying[i] > 0.5 && !finishing, f.down[i] > 0.5, f.aloft[i])

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
