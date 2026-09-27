import { useEffect, useRef, useState } from 'react'
import type { MatchEvent } from '../game/model'

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

export type ClipKind = 'try' | 'review' | 'notry' | 'kick' | 'attack'

export interface ClipSpec {
  kind: ClipKind
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
  label: string
  sub?: string
  att: [string, string]
  def: [string, string]
}

// ---------------------------------------------------------------- building

const STOP = new Set<MatchEvent['type']>(['TRY', 'CON', 'PEN', 'DG', 'HT', 'BRK', 'FT', 'KO', 'YC', 'RC', 'INJ'])
const isKick = (e: MatchEvent) =>
  e.type === 'PEN' || e.type === 'DG' || e.type === 'CON' || e.k === 'comm.penWide' || e.k === 'comm.penWideNamed' || e.k === 'comm.conWide'
const isTryMoment = (e: MatchEvent) => e.type === 'TRY' || e.fx === 'NOTRY'

/** a stable 0..1 from a number, so a clip replays identically */
const hash = (n: number) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s) }

export type HighlightLevel = 'key' | 'extended'

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
  if (level !== 'extended') return null
  if (isKick(e)) return 'kick'
  // into the opposition 22 from outside it, and no try in the next two lines
  // (the try's own clip will show those carries)
  if (e.fld != null && e.teamId) {
    const up = (f: number) => e.teamId === homeId ? f : 100 - f
    const prev = events[i - 1]
    const was = prev?.fld != null && prev.teamId === e.teamId ? up(prev.fld) : 0
    const soon = events.slice(i + 1, i + 3).some(isTryMoment)
    if (up(e.fld) >= 78 && was < 78 && !soon && !STOP.has(e.type)) return 'attack'
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

export function buildClip(events: MatchEvent[], m: number, kind: ClipKind, homeId: string,
  shirtOf: (playerId?: number) => number | undefined, colours: { home: [string, string]; away: [string, string] },
  labels: { try: string; review: string; notry: string; good: string; wide: string }, nameOf: (playerId?: number) => string | undefined): ClipSpec {
  const e = events[m]
  const attackHome = e.teamId === homeId
  const up = (f: number) => attackHome ? f : 100 - f       // metres towards their line
  const toX = (u: number) => attackHome ? u : 100 - u
  const att = attackHome ? colours.home : colours.away
  const def = attackHome ? colours.away : colours.home

  if (kind === 'kick') {
    const good = e.type === 'PEN' || e.type === 'DG' || e.type === 'CON'
    const u = e.type === 'CON' ? 85 : Math.max(58, Math.min(90, up(e.fld ?? 72)))
    const y = e.type === 'CON' ? 12 + hash(m) * 46 : 16 + hash(m) * 38
    return {
      kind, attackHome, beats: [], finish: { x: toX(u), y, carrier: shirtOf(e.playerId) ?? 10 }, endLine: m,
      kickGood: good, label: good ? labels.good : labels.wide, att, def,
      sub: nameOf(e.playerId),
    }
  }

  // a review line just before the verdict is part of this moment
  const review = events[m - 1]?.fx === 'TMO' ? m - 1 : -1
  // the build-up: up to four lines back, the same side, no stoppage between
  const from: number[] = []
  for (let k = (review >= 0 ? review : m) - 1; k >= Math.max(0, m - 5); k--) {
    const b = events[k]
    if (!b || STOP.has(b.type) || (b.teamId && b.teamId !== e.teamId)) break
    from.unshift(k)
  }
  const endU = kind === 'attack' ? Math.max(80, Math.min(94, up(e.fld ?? 82))) : 103
  // positions: the engine's own for each line, pushed so the play only ever
  // goes forward, and started far enough out for the finish to be a run
  let u = Math.min(endU - 16, Math.max(40, from.length ? up(events[from[0]].fld ?? 60) : 60))
  let y = 18 + hash(m * 3) * 34
  const beats: ClipSpec['beats'] = []
  const steps = Math.max(2, from.length)
  for (let i = 0; i < steps; i++) {
    const line = from[i] ?? -1
    const want = line >= 0 && events[line].fld != null ? up(events[line].fld!) : u + 6
    u = Math.min(endU - 12, Math.max(u + 3 + 3 * hash(m + i), want))
    // the play swings to the open side and back, as phases do
    const swing = (8 + 10 * hash(m * 7 + i)) * (y < 35 ? 1 : -1)
    y = Math.max(9, Math.min(61, y + swing))
    const forward = i < steps - 1
    beats.push({ x: toX(u), y, line, carrier: forward ? [8, 4, 6, 1, 5, 7][Math.floor(hash(m + i * 5) * 6)] : [12, 13, 10][Math.floor(hash(m + i) * 3)] })
  }
  const fy = kind === 'attack' ? y : Math.max(6, Math.min(64, y + (y < 35 ? -1 : 1) * (6 + 14 * hash(m * 11))))
  const scorer = shirtOf(e.playerId) ?? (hash(m) < 0.5 ? 14 : 11)
  return {
    kind, attackHome, beats,
    finish: { x: toX(endU), y: fy, carrier: kind === 'attack' ? 12 : scorer },
    endLine: m,
    reviewLine: review >= 0 ? review : undefined,
    reviewLabel: labels.review,
    label: kind === 'try' ? labels.try : kind === 'review' ? labels.review : kind === 'notry' ? labels.notry : '',
    sub: kind === 'attack' ? undefined : nameOf(e.playerId),
    att, def,
  }
}

// ---------------------------------------------------------------- the bake

type Pt = { x: number; y: number }
export interface Timeline { reveals: { t: number; line: number }[]; land: number; end: number; banner: number }

const smooth = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

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

/**
 * SMOOTH BY CONSTRUCTION, WITH LEGS. Everybody on the pitch is a body with a
 * top speed and an acceleration: they are steered towards where they ought to
 * be (their place in the shape, the ruck, the man with the ball) and can only
 * get there as fast as a player could. The first version placed each man
 * where the shape said, a fraction of a second behind the ball, and the ball
 * carrier was pulled onto the ball whatever the distance: a wing who took the
 * last pass crossed 25 metres in a third of a second (hlprobe measured 156 m/s).
 * Now the scrum-half passes to where the receiver actually is, the receiver
 * has been drifting into position since the last ruck, and the run is at a
 * runner's pace, accelerating off the catch.
 *
 * The whole clip is simulated once at 60 steps a second when it is built and
 * then only read back, so a frame is still a pure function of the clock: a
 * late frame is the right picture a little later, and hlprobe can measure it.
 */
const FPS = 60, DT = 1 / FPS
const V_PLAYER = 11.5, A_PLAYER = 16
const V_CAM = 13, A_CAM = 14

class Body {
  vx = 0; vy = 0
  constructor(public x: number, public y: number) {}
  /** arrive at (tx, ty): full speed from far, easing in close, never faster than vmax */
  steer(tx: number, ty: number, vmax: number, amax: number, k = 2.4) {
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
    this.x = clamp(this.x + this.vx * DT, -PAD + 0.5, 100 + PAD - 0.5)
    this.y = clamp(this.y + this.vy * DT, 0.4, 69.6)
  }
  /** put it exactly here (the ball carrier on his line), keeping the velocity honest */
  place(x: number, y: number) { this.vx = (x - this.x) / DT; this.vy = (y - this.y) / DT; this.x = x; this.y = y }
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

interface Baked { tl: Timeline; n: number; ball: Float32Array; att: Float32Array; def: Float32Array; carry: Float32Array; cam: Float32Array }

type Phase =
  | { k: 'ruck'; q: Pt; dur: number; tackled?: number; tackler?: number }
  | { k: 'dig'; q: Pt; dur: number }
  | { k: 'pass'; q: Pt; who: number; dur: number; from?: Pt }
  | { k: 'run'; to: Pt; who: number; line: number; last: boolean; dur: number; ta?: number; from?: Pt; tackler: number }
  | { k: 'done'; who: number; dur: number }

function bake(c: ClipSpec): Baked {
  const d = c.attackHome ? 1 : -1
  const fieldX = (x: number) => clamp(x, -PAD + 1, 100 + PAD - 1)
  const fieldY = (y: number) => clamp(y, 1, 69)
  const reveals: { t: number; line: number }[] = []

  // ---- the script
  const phases: Phase[] = []
  let land = 0, banner = 0, end = 0
  if (c.kind !== 'kick') {
    const pts = c.beats
    phases.push({ k: 'ruck', q: pts[0], dur: 0.5 })
    if (pts[0].line >= 0) reveals.push({ t: 0.1, line: pts[0].line })
    let prev = -1
    const stops = [...pts.slice(1), { ...c.finish, line: -1 }]
    stops.forEach((b, j) => {
      const last = j === stops.length - 1
      const q = pts[j]
      let who = b.carrier
      // the man who has just been tackled is on the floor: the next carry is somebody else's
      if (!last && who === prev) who = FORWARD_CARRIERS.find(s => s !== prev && s !== 9)!
      phases.push({ k: 'dig', q, dur: 0.35 })
      phases.push({ k: 'pass', q, who, dur: 0 })
      phases.push({ k: 'run', to: b, who, line: b.line, last, dur: 0, tackler: TACKLERS[j % TACKLERS.length] })
      if (!last) phases.push({ k: 'ruck', q: b, dur: 0.45, tackled: who, tackler: TACKLERS[j % TACKLERS.length] })
      prev = who
    })
    phases.push({ k: 'done', who: prev, dur: 99 })
  }

  // where a receiver should be standing for a pass from a ruck at q
  const receiveSpot = (q: Pt, who: number): Pt => {
    const [back, across, open] = ATT[who - 1]
    const s = openSide(q.y)
    const a = clamp(open ? across * s : across, -14, 14)
    const bk = clamp(back, 2.5, 7)
    return { x: fieldX(q.x - d * bk), y: fieldY(q.y + (Math.abs(a) < 1.5 ? (s >= 0 ? 2.5 : -2.5) : a)) }
  }

  // ---- the bodies, standing in their shape at kick-off
  const ball = { x: 0, y: 0, lift: 0 }
  const shapeAtt = (i: number, b: Pt): Pt => {
    if (c.kind === 'kick') return { x: fieldX(c.finish.x - d * (8 + (i % 5) * 2.5)), y: fieldY(10 + i * 3.6) }
    const [back, across, open] = ATT[i]
    return { x: fieldX(b.x - d * back), y: fieldY(b.y + (open ? across * openSide(b.y) : across)) }
  }
  const shapeDef = (i: number, b: Pt): Pt => {
    if (c.kind === 'kick') return { x: fieldX((c.attackHome ? 100 : 0) + d * 3), y: fieldY(22 + (i % 8) * 3.6) }
    if (i === 14) return { x: fieldX(b.x + d * 22), y: fieldY(35 + (b.y - 35) * 0.4) }
    const [ahead, across] = DEF[i]
    return { x: fieldX(b.x + d * ahead), y: fieldY(b.y + across) }
  }
  const start = c.kind === 'kick' ? c.finish : c.beats[0]
  ball.x = start.x; ball.y = start.y
  const att = Array.from({ length: 15 }, (_, i) => { const p = shapeAtt(i, start); return new Body(p.x, p.y) })
  const def = Array.from({ length: 15 }, (_, i) => { const p = shapeDef(i, start); return new Body(p.x, p.y) })
  const lead = (): Pt => c.kind === 'kick'
    ? { x: (ball.x + (c.attackHome ? 100 : 0)) / 2, y: (ball.y + 35) / 2 }
    : { x: ball.x + d * 7, y: ball.y }
  const cam = new Body(lead().x, lead().y)

  if (c.kind === 'kick') {
    const posts = { x: c.attackHome ? 100 : 0, y: 35 + (c.kickGood ? 0 : (c.finish.y < 35 ? -1 : 1) * 5.2) }
    const flight = Math.max(1.5, Math.hypot(posts.x - c.finish.x, posts.y - c.finish.y) / 24)
    land = 0.9 + flight; banner = land - 0.1; end = land + 1.7
    const kicker = c.finish.carrier - 1
    att[kicker].x = c.finish.x - d * 1.2; att[kicker].y = c.finish.y
    return record(end, (t) => {
      const k = smooth((t - 0.9) / flight)
      ball.x = lerp(c.finish.x, posts.x, k); ball.y = lerp(c.finish.y, posts.y, k)
      ball.lift = k > 0 && k < 1 ? Math.sin(Math.PI * k) * 9 : 0
      for (let i = 0; i < 15; i++) {
        if (i === kicker) { const kx = t < 0.9 ? c.finish.x - d * 1.2 : c.finish.x + d * 2; att[i].steer(kx, c.finish.y, 6, 10) }
        else { const p = shapeAtt(i, ball); att[i].steer(p.x, p.y, V_PLAYER, A_PLAYER) }
        const q = shapeDef(i, ball); def[i].steer(q.x, q.y, V_PLAYER, A_PLAYER)
      }
      return kicker
    })
  }

  // ---- play it
  let p = 0, ps = 0
  const enter = (ph: Phase, t: number) => {
    if (ph.k === 'pass') {
      ph.from = { x: ball.x, y: ball.y }
      const r = att[ph.who - 1]
      ph.dur = clamp(Math.hypot(r.x - ball.x, r.y - ball.y) / 17, 0.3, 0.95)
    } else if (ph.k === 'run') {
      ph.from = { x: ball.x, y: ball.y }
      const dist = Math.hypot(ph.to.x - ball.x, ph.to.y - ball.y)
      const pace = ph.who >= 9 ? 9.5 : 7.5
      ph.ta = 0.4
      ph.dur = Math.max(0.9, dist / pace + ph.ta)
      if (ph.line >= 0) reveals.push({ t, line: ph.line })
      if (ph.last) land = t + ph.dur
    }
  }
  enter(phases[0], 0)
  // until the last run has started nobody knows when the ball goes down
  const endOf = () => land <= 0 ? Infinity : land + (c.reviewLine != null ? 4.2 : c.kind === 'attack' ? 0.9 : 2.1)

  return record(() => endOf(), (t) => {
    while (t >= ps + phases[p].dur && p < phases.length - 1) { ps += phases[p].dur; p++; enter(phases[p], ps) }
    const ph = phases[p], k = t - ps
    // the next man to take a pass, drifting into place for it
    const next = phases.slice(p).find(x => x.k === 'pass') as Extract<Phase, { k: 'pass' }> | undefined
    const ruckAt = ph.k === 'ruck' || ph.k === 'dig' ? ph.q : ph.k === 'run' && !ph.last ? ph.to : null
    const finishK = ph.k === 'run' && ph.last ? runK(k, ph.dur, ph.ta!) : ph.k === 'done' ? 1 : 0
    let carrier = -1

    for (let i = 0; i < 15; i++) {
      const shirt = i + 1
      let tgt = shapeAtt(i, ball)
      if (next && next.who === shirt && ph.k !== 'pass' && ruckAt) tgt = receiveSpot(ruckAt, shirt)
      if (ph.k === 'pass' && ph.who === shirt) {
        const r = att[i]
        tgt = { x: r.x + d * 2, y: r.y }                                     // running onto it
      }
      if (shirt === 9 && ruckAt && !(next?.who === 9)) tgt = { x: ruckAt.x - d * 1, y: ruckAt.y + 0.6 }
      if (ph.k === 'ruck' && ph.tackled === shirt) tgt = { x: ph.q.x - d * 0.6, y: ph.q.y }
      const snapped = (ph.k === 'run' && ph.who === shirt) || (ph.k === 'done' && ph.who === shirt)
      if (snapped) { carrier = i; continue }
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
      ball.x = lerp(ph.from!.x, ph.to.x, kk); ball.y = lerp(ph.from!.y, ph.to.y, kk); ball.lift = 0
      att[ph.who - 1].place(ball.x - d * 0.4, ball.y)
    } else if (ph.k === 'done') {
      ball.lift = 0
      att[ph.who - 1].place(ball.x - d * 0.4, ball.y)
    }

    for (let i = 0; i < 15; i++) {
      let tgt = shapeDef(i, ball)
      // the cover turns and chases the finisher
      if (finishK > 0 && c.kind !== 'attack') {
        const chase = { x: ball.x - d * (2 + (i % 5)), y: ball.y + ((i % 3) - 1) * 3 }
        tgt = { x: lerp(tgt.x, chase.x, finishK * 0.75), y: lerp(tgt.y, chase.y, finishK * 0.75) }
      }
      // the tackler meets the carry and stays in the ruck
      if (ph.k === 'run' && !ph.last && ph.tackler === i && k > ph.dur - 1.1) tgt = { x: ph.to.x + d * 0.8, y: ph.to.y }
      if (ph.k === 'ruck' && ph.tackler === i) tgt = { x: ph.q.x + d * 0.8, y: ph.q.y }
      def[i].steer(fieldX(tgt.x), fieldY(tgt.y), V_PLAYER, A_PLAYER)
    }
    return carrier
  })

  // ---- write it down, 60 frames a second
  function record(endAt: number | (() => number), step: (t: number) => number): Baked {
    const frames: { ball: number[]; att: number[]; def: number[]; carry: number[]; cam: number[] }[] = []
    const snap = (carrier: number, t: number) => {
      // a little life, the same for everybody all the time (switching it off for
      // the ball carrier made him hop 40 cm on the catch)
      const wob = (i: number, a: number) => [Math.sin(t * 1.7 + i * 1.3 + a) * 0.25, Math.cos(t * 1.3 + i * 0.9 + a) * 0.25]
      const L = lead()
      cam.steer(L.x, L.y, V_CAM, A_CAM, 1.6)
      frames.push({
        ball: [ball.x, ball.y, ball.lift],
        att: att.flatMap((b, i) => [b.x + wob(i, 0)[0], b.y + wob(i, 0)[1]]),
        def: def.flatMap((b, i) => [b.x + wob(i, 2)[0], b.y + wob(i, 2)[1]]),
        carry: att.map((_, i) => i === carrier ? 1 : 0),
        cam: [cam.x, cam.y],
      })
    }
    snap(c.kind === 'kick' ? c.finish.carrier - 1 : -1, 0)
    for (let f = 1; ; f++) {
      const t = f * DT
      const carrier = step(t)
      snap(carrier, t)
      const e = typeof endAt === 'number' ? endAt : endAt()
      if (t > e + 0.5 || f > FPS * 40) break
    }
    if (c.kind !== 'kick') {
      end = endOf()
      banner = c.reviewLine != null ? land + 2.2 : land + 0.05
      if (c.reviewLine != null) reveals.push({ t: land, line: c.reviewLine })
    }
    const n = frames.length
    const pack = (key: 'ball' | 'att' | 'def' | 'carry' | 'cam', w: number) => {
      const a = new Float32Array(n * w)
      frames.forEach((fr, i) => a.set(fr[key], i * w))
      return a
    }
    return { tl: { reveals, land, banner, end }, n, ball: pack('ball', 3), att: pack('att', 30), def: pack('def', 30), carry: pack('carry', 15), cam: pack('cam', 2) }
  }
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
 */
export function frameAt(spec: ClipSpec, t: number): { ball: Pt; lift: number; att: Pt[]; def: Pt[]; carrying: number[] } {
  const b = bakeOf(spec)
  const f = clamp(t * FPS, 0, b.n - 1), i = Math.floor(f), j = Math.min(b.n - 1, i + 1), k = f - i
  const at = (a: Float32Array, w: number, o: number) => lerp(a[i * w + o], a[j * w + o], k)
  const pts = (a: Float32Array) => Array.from({ length: 15 }, (_, s) => ({ x: at(a, 30, s * 2), y: at(a, 30, s * 2 + 1) }))
  return {
    ball: { x: at(b.ball, 3, 0), y: at(b.ball, 3, 1) },
    lift: at(b.ball, 3, 2),
    att: pts(b.att), def: pts(b.def),
    carrying: Array.from({ length: 15 }, (_, s) => b.carry[(k < 0.5 ? i : j) * 15 + s]),
  }
}

/** Where the camera looks at time t: a few metres ahead of the ball, easing
 *  after it at a camera operator's pace, held inside the field. viewH is the
 *  window's depth in metres. */
export function cameraAt(spec: ClipSpec, t: number, viewH: number): Pt {
  const b = bakeOf(spec)
  const f = clamp(t * FPS, 0, b.n - 1), i = Math.floor(f), j = Math.min(b.n - 1, i + 1), k = f - i
  const hw = VIEW_W / 2, hh = viewH / 2
  const x = lerp(b.cam[i * 2], b.cam[j * 2], k), y = lerp(b.cam[i * 2 + 1], b.cam[j * 2 + 1], k)
  return { x: clamp(x, -PAD + hw, 100 + PAD - hw), y: clamp(y, hh, 70 - hh) }
}

// ---------------------------------------------------------------- the component

const PAD = 7          // in-goal metres drawn each end
const FIELD_W = 100 + PAD * 2
/** THE CAMERA: a window on the field, not the whole of it. At full length the
 *  thirty men were specks at one end; FM follows the play, and so does this:
 *  56 m by 34 m, centred a few metres ahead of the ball, following it through
 *  the same eased path (so the camera is as smooth as the play), and never
 *  past the dead-ball lines or the touchlines. */
const VIEW_W = 56, VIEW_H = 34

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
  const pausedRef = useRef(!!paused)
  pausedRef.current = !!paused
  const cb = useRef({ onReveal, onDone })
  cb.current = { onReveal, onDone }

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const tl = bakeOf(spec).tl
    const d = spec.attackHome ? 1 : -1
    let raf = 0, clock = 0, lastNow = performance.now(), revealed = 0, landed = false, finished = false, reviewing = false
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ink = readInk()

    // the pitch, drawn once
    const field = document.createElement('canvas')
    const size = () => {
      const w = cv.clientWidth, h = cv.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      // metres to pixels, and the whole field drawn once at that scale
      const sc = w / VIEW_W
      field.width = Math.round(FIELD_W * sc * dpr); field.height = Math.round(70 * sc * dpr)
      const f = field.getContext('2d')!
      f.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawField(f, FIELD_W * sc, 70 * sc, ink)
      return { w, h, dpr, sc }
    }
    let dim = size()
    const onResize = () => { dim = size() }
    window.addEventListener('resize', onResize)

    let cam = { x: 50, y: 35 }
    const camAt = (t: number) => cameraAt(spec, t, dim.h / dim.sc)
    const X = (x: number) => (x - cam.x) * dim.sc + dim.w / 2
    const Y = (y: number) => (y - cam.y) * dim.sc + dim.h / 2

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000)
      lastNow = now
      if (!pausedRef.current) clock += dt / speed
      const t = reduce ? Math.max(clock, tl.land) : clock
      // commentary in step with the picture
      while (revealed < tl.reveals.length && t >= tl.reveals[revealed].t) cb.current.onReveal(tl.reveals[revealed++].line)
      if (spec.reviewLine != null && !reviewing && t >= tl.land) { reviewing = true; setBanner('review') }
      if (!landed && t >= tl.banner) { landed = true; cb.current.onReveal(spec.endLine); if (spec.label) setBanner('final') }
      draw(t)
      if (t >= tl.end && !finished) { finished = true; cb.current.onDone(); return }
      raf = requestAnimationFrame(frame)
    }

    const draw = (t: number) => {
      const g = cv.getContext('2d')!
      cam = camAt(t)
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.fillStyle = ink.surround; g.fillRect(0, 0, cv.width, cv.height)
      g.drawImage(field, Math.round((X(-PAD)) * dim.dpr), Math.round(Y(0) * dim.dpr))
      g.setTransform(dim.dpr, 0, 0, dim.dpr, 0, 0)
      const f = frameAt(spec, t)
      const now = { p: f.ball }
      const R = Math.max(6.5, dim.sc * 1.02)
      const finishing = t > tl.land - 0.01

      const dot = (p: Pt, fill: string, edge: string, num: number, ring = false) => {
        const x = X(p.x), y = Y(clamp(p.y, 0.5, 69.5))
        g.beginPath(); g.arc(x, y + 1.2, R, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill()
        g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fillStyle = fill; g.fill()
        g.lineWidth = ring ? 2.2 : 1.4; g.strokeStyle = ring ? ink.white : edge; g.stroke()
        g.fillStyle = isLight(fill) ? ink.dark : ink.white; g.font = `700 ${Math.round(R * 1.05)}px system-ui, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(String(num), x, y + 0.5)
      }

      for (let i = 0; i < 15; i++) dot(f.def[i], spec.def[0], spec.def[1], i + 1)
      for (let i = 0; i < 15; i++) dot(f.att[i], spec.att[0], spec.att[1], i + 1, f.carrying[i] > 0.5 && !finishing)

      // the ball, lifted off its shadow in flight
      const bx = X(now.p.x), by = Y(now.p.y)
      g.beginPath(); g.ellipse(bx, by + 2, R * 0.55, R * 0.3, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fill()
      g.beginPath(); g.ellipse(bx, by - f.lift * dim.sc * 0.6, R * 0.6, R * 0.42, -0.4, 0, Math.PI * 2)
      g.fillStyle = ink.ball; g.fill(); g.lineWidth = 1; g.strokeStyle = ink.ballEdge; g.stroke()
    }

    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [spec, speed])

  return (
    <div className={`hl-clip ${spec.kind}`} data-testid="hl-clip">
      <canvas ref={canvas} className="hl-canvas" />
      {banner === 'review' && (
        <div className="hl-banner review"><b>{spec.reviewLabel}</b></div>
      )}
      {banner === 'final' && (
        <div className={`hl-banner ${spec.kind}${spec.kind === 'kick' && !spec.kickGood ? ' miss' : ''}`}
          style={{ background: spec.kind === 'try' || (spec.kind === 'kick' && spec.kickGood) ? spec.att[0] : undefined, color: spec.kind === 'try' || (spec.kind === 'kick' && spec.kickGood) ? (isLight(spec.att[0]) ? 'var(--prop-ink-dark)' : 'var(--prop-ink)') : undefined }}>
          <b>{spec.label}</b>
          {spec.sub && <span>{spec.sub}</span>}
        </div>
      )}
    </div>
  )
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
