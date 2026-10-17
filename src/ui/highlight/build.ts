// Which moments become clips, and the spec each one is played from.

import type { MatchEvent } from '../../game/model'
import { MOVE_BY_ID, moveOfKey } from '../../game/moves'
import { atkStyleOf, defStyleOf, tracksFor, type StyleDials } from '../clipPlays'
import { trackFrame } from './plays'
import type { ClipKind, ClipLabels, ClipSpec, ClipStyle } from './types'

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
  'comm.maulHeldUp': 'maul',
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
function lastOwnLine(events: MatchEvent[], i: number): MatchEvent | undefined {
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
  // THE ALMOST (1.9.1, owner: "occasionally it should be held up and no try
  // scored ... shown in animation as an almost chance"): always on, like a try
  if (e.k === 'comm.maulHeldUp') return 'heldup'
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
  tacticOf?: (home: boolean) => StyleDials | undefined,
  numOf?: (home: boolean, shirt: number) => number | undefined): ClipSpec {
  const e = events[m]
  // THE STYLES (1.8.2): the defending side's system, the attacking side's style
  const styles = {
    defStyle: defStyleOf(tacticOf?.(e.teamId !== homeId)),
    atkStyle: atkStyleOf(tacticOf?.(e.teamId === homeId)),
    // the pod shape inside a pod game (1.8.2 depth), off the same tactic
    podShape: tacticOf?.(e.teamId === homeId)?.podShape,
  }
  // a held-up line is the defending side's (they survived), so the side
  // driving the maul is the other one
  const attackHome = kind === 'heldup' ? e.teamId !== homeId : e.teamId === homeId
  const paces = (home: boolean) => paceOf ? Array.from({ length: 15 }, (_, i) => paceOf(home, i + 1)) : undefined
  // the number on each back: a replacement keeps the one he walked out in
  // (owner, 1.8.16: "if they are number 23 on the bench they should be 23")
  const nums = (home: boolean) => numOf ? Array.from({ length: 15 }, (_, i) => numOf(home, i + 1) ?? i + 1) : undefined
  const up = (f: number) => attackHome ? f : 100 - f       // metres towards their line
  const toX = (u: number) => attackHome ? u : 100 - u
  const att = attackHome ? colours.home : colours.away
  const def = attackHome ? colours.away : colours.home

  if (kind === 'kick') {
    const good = e.type === 'PEN' || e.type === 'DG' || e.type === 'CON'
    const drop = e.type === 'DG' || /^comm\.dropMiss\d/.test(e.k ?? '')
    const u = e.type === 'CON' ? 85 : Math.max(58, Math.min(drop ? 80 : 90, up(e.fld ?? 72)))
    // A CONVERSION IS TAKEN IN LINE WITH THE TRY (owner, 1.8.12: a maul try
    // in the corner had its kick drawn in front of the posts). The try's own
    // clip is worked out the same way the try was shown, and the kick goes
    // from across the field where it was grounded, a few metres in from touch.
    let y = e.type === 'CON' ? 12 + hash(m) * 46 : 16 + hash(m) * 38
    if (e.type === 'CON' || e.k === 'comm.conWide') {
      let ti = m - 1
      while (ti >= 0 && !(events[ti].type === 'TRY' && events[ti].teamId === e.teamId)) ti--
      if (ti >= 0 && m - ti <= 3) {
        const tryClip = buildClip(events, ti, 'try', homeId, shirtOf, colours, labels, nameOf, paceOf, tacticOf, numOf)
        y = Math.max(5, Math.min(65, tryClip.finish.y))
      }
    }
    return {
      kind, style: 'phases', attackHome, beats: [], finish: { x: toX(u), y, carrier: shirtOf(e.playerId) ?? 10 }, endLine: m, attNum: nums(attackHome), defNum: nums(!attackHome), ...styles,
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
  const mvId = kind === 'try' && /^comm\.(moveTry(Lo|Sc|Tap)|shapeTry)/.test(e.k ?? '') ? moveOfKey(e.v?.move_k) : null
  const launch: ClipSpec['launch'] = !mvId ? undefined
    : e.k?.startsWith('comm.moveTryLo') ? 'lineout' : e.k?.startsWith('comm.moveTrySc') ? 'scrum'
    : e.k?.startsWith('comm.moveTryTap') ? 'tap' : 'open'
  if (mvId && launch && launch !== 'open' && MOVE_BY_ID[mvId]) {
    // A STRIKE MOVE is played from the set piece it was called off, thirty
    // metres or so out (less when the TMO's look is to come as well): a
    // lineout on the touchline, a scrum in midfield, and a blindside wrap's
    // scrum near a touchline so there is a blind side to wrap round
    const lo = launch === 'lineout', tap = launch === 'tap', blind = mvId === 'mv_blind'
    // (1.8.2) a red-zone play is run where it is called, in their 22: the
    // maul twelve metres out (their backs ten back of it still in the field), the tap ten
    const red = !!MOVE_BY_ID[mvId].red
    const u0 = red ? (tap ? 89 : 87) + 1.5 * hash(m * 3) : (review >= 0 ? 71 : 66) + 4 * hash(m * 3)
    const top = hash(m * 7) < 0.5
    // (1.8.2) where the move is drawn from, as the study's moves are: a
    // lineout on the touchline; a scrum on the fifteen-metre line with the
    // width on its open side; the wrap's scrum with the short side on the
    // right, where its wing (the 14) is; a tap in front of the posts
    const y0 = lo ? (top ? 5 : 65) : tap ? (top ? 32 : 38) : blind ? (attackHome ? 52 : 18) : (top ? 15 : 55)
    const side = blind ? (y0 < 35 ? -1 : 1) : (y0 < 35 ? 1 : -1)
    const tr = tracksFor(mvId)?.[0]
    const tf = tr ? trackFrame(tr, lo ? 'lineout' : tap ? 'tap' : 'scrum', { x: 0, y: y0 }, side) : null
    const fy = tr && tf ? Math.max(4, Math.min(66, tf.base.y + side * tr.finish * tf.scP))
      : blind ? (y0 < 35 ? 6 : 64) : Math.max(6, Math.min(64, y0 + side * (18 + 8 * hash(m * 11))))
    const steps = Math.max(2, from.length)
    const roleShirt = (r: string) => r === 'W' ? (side * (attackHome ? 1 : -1) > 0 ? 14 : 11)
      : r === 'FW' ? (side * (attackHome ? 1 : -1) > 0 ? 11 : 14) : Number(r)
    const beats: ClipSpec['beats'] = Array.from({ length: steps }, (_, i) => ({
      x: toX(u0 + i * 0.5), y: y0, line: from[i] ?? -1, carrier: lo ? 2 : tap ? 9 : 8,
    }))
    return {
      kind, style: 'move', move: mvId, launch, attackHome, beats,
      // (nobody named: the move's own strike runner, or the man chasing its kick)
      finish: { x: toX(103), y: fy, carrier: shirtOf(e.playerId) ?? (tr ? roleShirt(tr.chase ?? tr.strike) : 13) },
      endLine: m,
      reviewLine: review >= 0 ? review : undefined,
      reviewLabel: labels.review,
      misses: hash(m * 17) < 0.4 ? 1 : 0,
      label: labels.try, sub: nameOf(e.playerId), att, def,
      attPace: paces(attackHome), defPace: paces(!attackHome), attNum: nums(attackHome), defNum: nums(!attackHome), ...styles,
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
      : kind === 'heldup' ? labels.heldup
      : ending === 'turnover' ? labels.turnover : ending === 'saved' ? labels.saved : '',
    sub: kind === 'attack' ? undefined : nameOf(e.playerId),
    att, def,
    attPace: paces(attackHome), defPace: paces(!attackHome), attNum: nums(attackHome), defNum: nums(!attackHome), ...styles,
    // a phase-play shape: the build-up is played in its pods
    ...(mvId && launch === 'open' ? { move: mvId, launch } : {}),
  }
}
