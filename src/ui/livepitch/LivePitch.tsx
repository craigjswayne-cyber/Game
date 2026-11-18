// The live pitch on screen (2.0.0): the whole pitch, upright, never moving.
//
// Owner, 16 Nov 2026: "the moving camera tracker should not happen - i prefer
// the original style where you see the full pitch" and "stay vertical - its
// key for the phone". So: try line to try line up the screen, the home side
// attacking upwards, drawn once and left alone. The men and the ball come
// from sim.ts, which plays each line out in real time.

import { useEffect, useMemo, useRef, useState } from 'react'
import artMaroon from './stadium-maroon.webp'
import artRed from './stadium-red.webp'
import artNavy from './stadium-navy.webp'
import artNight from './stadium-night.webp'
import artWet from './stadium-wet.webp'
import artGreen from './stadium-green.webp'
import artNightRed from './stadium-night-red.webp'
import artNightGreen from './stadium-night-green.webp'
import artSnow from './stadium-snow.webp'
import artNightWet from './stadium-night-wet.webp'
import artNightMaroon from './stadium-night-maroon.webp'
import artNightSnow from './stadium-night-snow.webp'
import type { MatchEvent } from '../../game/model'
import { readInk, isLight, refereeColour, tokenColor } from '../highlight/draw'
import { phaseAt, readLine, type Banner, type Phase } from './phase'
import { PitchSim } from './sim'
import type { PitchTac } from './agents'

export interface PitchSide {
  /** the lineup by shirt index, as the engine holds it */
  lineup: (number | null)[]
  /** the number each man wears, by shirt index */
  nums: number[]
  /** fill and edge */
  kit: [string, string]
}

/** in-goal metres drawn each end; the ground round the pitch: SIDE metres
 *  along each touchline (run-off, boards, a strip of crowd) and END metres
 *  behind each dead-ball line (boards and a stand) */
const GOAL = 8
/** THE GROUND IS A PICTURE (owner, 17 Nov 2026, sent a painted stadium to use).
 *  When the pitch is on its side the stadium is this picture and only the
 *  men, the ball and the lettering are drawn over it. These are where the
 *  field sits in the picture, in its own pixels: the left try line and the
 *  far touchline, and how many pixels a metre is along and across (it is
 *  painted a little foreshortened, so across is fewer). The lamp heads are
 *  for the glow of a night match.
 *  (18 Nov 2026: the owner sent a set of them. Each was measured, because
 *  the painter moved the pitch a few pixels between some: x0 and y0 are the
 *  left try line and the far touchline, mx and my the pixels to a metre.) */
type Stadium = { url: string; w: number; h: number; x0: number; y0: number; mx: number; my: number; seat?: [number, number, number] }
const GROUNDS: Record<'maroon' | 'red' | 'navy' | 'green' | 'night' | 'nightRed' | 'nightGreen' | 'nightMaroon' | 'nightWet' | 'nightSnow' | 'wet' | 'snow', Stadium> = {
  maroon: { url: artMaroon, w: 1448, h: 1086, x0: 280.5, y0: 318, mx: 8.87, my: 7.17, seat: [120, 30, 50] },
  red: { url: artRed, w: 1448, h: 1086, x0: 280, y0: 318, mx: 8.87, my: 7.16, seat: [200, 40, 45] },
  navy: { url: artNavy, w: 1448, h: 1086, x0: 280, y0: 318, mx: 8.87, my: 7.17, seat: [40, 60, 110] },
  green: { url: artGreen, w: 1448, h: 1086, x0: 280, y0: 318, mx: 8.87, my: 7.17, seat: [40, 150, 60] },
  night: { url: artNight, w: 1448, h: 1086, x0: 277, y0: 318, mx: 8.93, my: 7.19, seat: [40, 60, 110] },
  nightRed: { url: artNightRed, w: 1448, h: 1086, x0: 280, y0: 318, mx: 8.875, my: 7.18, seat: [200, 40, 45] },
  nightGreen: { url: artNightGreen, w: 1448, h: 1086, x0: 280, y0: 318, mx: 8.88, my: 7.17, seat: [40, 150, 60] },
  nightMaroon: { url: artNightMaroon, w: 1448, h: 1086, x0: 280, y0: 318, mx: 8.87, my: 7.17, seat: [120, 30, 50] },
  nightSnow: { url: artNightSnow, w: 1448, h: 1086, x0: 280, y0: 318, mx: 8.87, my: 7.17 },
  nightWet: { url: artNightWet, w: 1448, h: 1086, x0: 280.5, y0: 318.5, mx: 8.865, my: 7.16 },
  snow: { url: artSnow, w: 1448, h: 1086, x0: 280, y0: 318.5, mx: 8.87, my: 7.16 },
  wet: { url: artWet, w: 1448, h: 1086, x0: 280, y0: 318, mx: 8.87, my: 7.19 },
}
/** which ground a match is played in: the floodlit one at night, the wet one
 *  in rain or snow, otherwise the one whose seats are nearest the home colour */
const pickGround = (night: boolean, wet: boolean, snow: boolean, kit: string): Stadium => {
  if (snow && night) return GROUNDS.nightSnow
  if (wet && night) return GROUNDS.nightWet
  if (snow && !night) return GROUNDS.snow
  if (wet && !night) return GROUNDS.wet
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(kit)
  const c = m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [40, 60, 110]
  let best = GROUNDS.navy, bd = Infinity
  if (night) best = GROUNDS.night
  for (const g of night ? [GROUNDS.night, GROUNDS.nightRed, GROUNDS.nightGreen, GROUNDS.nightMaroon] : [GROUNDS.navy, GROUNDS.maroon, GROUNDS.red, GROUNDS.green]) { const d = g.seat!.reduce((t, v, i) => t + (v - c[i]) ** 2, 0); if (d < bd) { bd = d; best = g } }
  return best
}
const artCache = new Map<string, HTMLImageElement>()
const loadArt = (url: string) => { let im = artCache.get(url); if (!im) { im = new Image(); im.src = url; artCache.set(url, im) } return im }
/** the least ground drawn round the pitch; the rest of the box is filled with
 *  more stand, so the ground runs off the edge of the screen as a real one does */
const SIDE_MIN = 6.6, END_MIN = 5.5
let SIDE = SIDE_MIN, END = END_MIN
let FIELD_L = 100 + GOAL * 2 + END * 2, FIELD_W = 70 + SIDE * 2

/** the verdict's type size: full size for TRY, smaller the longer the word */
function bannerSize(label: string, good: boolean): { fontSize: string } {
  const full = good ? 3.4 : 2.4
  return { fontSize: `${Math.max(1.15, Math.min(full, 22 / Math.max(1, label.length))).toFixed(2)}rem` }
}

/** a stable 0..1 from two integers: the crowd is the same crowd every frame */
function h2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263 + 1013904223) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) % 10000) / 10000
}

export function LivePitch({ events, cursor, homeId, home, away, paused, names, onPlayed, tr, teams, boards, speed = 1, realTime = false, tactics, night = true, wet = false, snow = false, onReached }: {
  /** snow on the ground */
  snow?: boolean
  /** rain or snow: the wet ground */
  wet?: boolean
  /** under the lights, or an afternoon kick-off (owner, 17 Nov 2026: "Make day matches too") */
  night?: boolean
  /** how each club plays (home, away): its own dials, so the two sides look different */
  tactics?: [PitchTac, PitchTac]
  events: MatchEvent[]
  cursor: number
  homeId: string
  home: PitchSide
  away: PitchSide
  paused?: boolean
  /** a man's name, for the tag over the man on the ball */
  names: (playerId: number) => string | undefined
  /** the newest line has been played out on the grass */
  onPlayed?: (moved: boolean) => void
  /** the pitch has got to the play the line at this cursor describes */
  onReached?: (cursor: number) => void
  /** 1 is real time; the Fast setting plays it quicker, Slow a little slower */
  speed?: number
  /** play everything at real time: nothing is wound on */
  realTime?: boolean
  /** the words: an lp.* key and its values */
  tr: (key: string, vars?: Record<string, string | number>) => string
  /** the two sides' short names */
  teams: { home: string; away: string }
  /** the names on the advertising boards (the game's invented sponsors) */
  boards?: string[]
}) {
  /** the play on the grass right now: usually the newest line's, but a score
   *  is played before its line is shown, and the label has to match the grass */
  const [onGrass, setOnGrass] = useState<Phase | null>(null)
  /** the banner on screen, once its moment has landed */
  const [banner, setBanner] = useState<Banner | null>(null)
  const bannerRef = useRef<{ want: Banner | null; shownAt: number }>({ want: null, shownAt: -1 })
  const canvas = useRef<HTMLCanvasElement>(null)
  const phase = useMemo(() => phaseAt(events, cursor, homeId), [events, cursor, homeId])
  bannerRef.current.want = phase.banner ?? null
  /** the shirt index of the man a phase names, if he plays for the side with the ball */
  const carrierOf = (p: Phase): number | null => {
    if (p.carrier == null) return null
    const i = (p.homeBall ? home : away).lineup.indexOf(p.carrier)
    return i >= 0 && i < 15 ? i : null
  }
  // THE SCORE IS SEEN BEFORE IT IS READ. A try's line, and the scoreboard
  // with it, used to arrive and then the try was played: the result first,
  // the run after. So the next line is looked at before it is revealed, and
  // when it is a score (or a miss, or a try ruled out) the pitch plays it
  // first and asks for the line as the ball goes down.
  const ahead = useMemo(() => {
    const e = events[cursor]
    if (!e) return null
    const p = readLine(e, cursor, homeId, phase, events[cursor + 1])
    return p?.banner && p.banner.kind !== 'yc' && p.banner.kind !== 'rc' ? p : null
  }, [events, cursor, homeId, phase])
  const sim = useRef<PitchSim>()
  if (!sim.current) sim.current = new PitchSim()
  const seen = useRef<{ at: number; cursor: number; told: boolean; moved: boolean; pre: boolean }>({ at: -99, cursor: -1, told: true, moved: false, pre: false })
  // a new line: a new play if it moves the picture, else it is already played
  if (seen.current.cursor !== cursor) {
    seen.current.cursor = cursor
    seen.current.moved = phase.at !== seen.current.at
    if (phase.at !== seen.current.at) {
      seen.current.at = phase.at
      sim.current.start(phase, carrierOf(phase))
    }
    seen.current.told = false
    seen.current.pre = false
  }
  const attackText = tr('lp.attack', { team: phase.homeBall ? teams.home : teams.away })
  const io = useRef({ home, away, names, onPlayed, onReached, cursor, paused: !!paused, carrierId: phase.carrier as number | undefined, attackText, boards, speed, realTime, ahead, aheadIdx: ahead ? carrierOf(ahead) : null })
  if (tactics) sim.current.tac = tactics
  // FOURTEEN MEN: a man shown a card is off the field (ten minutes for a
  // yellow, the rest of the match for a red), and so is a slot the engine
  // has left empty. He walks to the touchline and his side plays without him.
  {
    const nowMin = events[Math.max(0, Math.min(events.length, cursor) - 1)]?.min ?? 0
    const off = new Array(30).fill(false)
    for (let k = 0; k < Math.min(events.length, cursor); k++) {
      const e = events[k]
      if ((e.type !== 'YC' && e.type !== 'RC') || e.playerId == null) continue
      if (e.type === 'YC' && nowMin - e.min >= 10) continue
      const hi = home.lineup.indexOf(e.playerId), ai = away.lineup.indexOf(e.playerId)
      if (hi >= 0 && hi < 15) off[hi] = true
      else if (ai >= 0 && ai < 15) off[15 + ai] = true
    }
    for (let k = 0; k < 15; k++) { if (home.lineup[k] == null) off[k] = true; if (away.lineup[k] == null) off[15 + k] = true }
    sim.current.off = off
  }
  io.current = { home, away, names, onPlayed, onReached, cursor, paused: !!paused, carrierId: (sim.current.phase ?? phase).carrier, attackText, boards, speed, realTime, ahead, aheadIdx: ahead ? carrierOf(ahead) : null }

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const S = sim.current!
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ink = readInk()
    const lp = { ground: tokenColor('--lp-ground'), stand: tokenColor('--lp-stand'), light: tokenColor('--lp-board-light'), dark: tokenColor('--lp-board-dark'), boardInk: tokenColor('--lp-board-ink') }
    const gold = tokenColor('--gold-fill')
    const refKit = refereeColour([...home.kit, ...away.kit], [ink.refPink, ink.refOrange, ink.refCyan])
    let raf = 0, last = performance.now(), acc = 0
    // upright on a phone held upright; on its side when the box is wider than
    // it is tall (a phone turned over, a tablet's wide column): the same
    // picture turned a quarter, the home side then attacking to the right
    let dim = { w: 0, h: 0, dpr: 1, sc: 1, ox: 0, oy: 0, up: true, tilt: false, art: 0 }
    const field = document.createElement('canvas')
    // THE TILT IS DRAWN, NOT STYLED (17 Nov 2026, owner: "need to make it
    // hi-res so its really vissible"). Tilting the canvas with a CSS 3D
    // transform made the browser redraw it at one dot per point and stretch
    // that: blocky on a phone. The picture is now drawn flat here at full
    // resolution and laid on to the screen row by row in perspective.
    const flat = document.createElement('canvas')
    // the last frame before a cut, dissolved out over the new one
    const ghost = document.createElement('canvas')
    let grassSeen: Phase | null = null
    let reachedSent = -1
    let seenCuts = S.cuts, dissolve = 0
    /** 0..1: how much the fast-forward mark is showing */
    let ffShown = 0, rateNow = 1
    // each man's drawn size, eased: he shrinks into a ruck and grows out of it, he does not pop
    const sz = new Float32Array(30).fill(1)
    /** when the ball went down for a try, for the ring round it */
    let tryAt = -1, tryFor = -99
    // confetti for a try, in screen pixels, in the scorers' colours
    let confetti: { x: number; y: number; vx: number; vy: number; life: number; rot: number; spin: number; c: string }[] = []
    const burst = (fx: number, fy: number, isHome: boolean) => {
      const kit = (isHome ? io.current.home : io.current.away).kit
      const cols = [kit[0], kit[1], ink.white, tokenColor('--gold-fill')]
      const cx = Math.max(2, Math.min(98, fx)), x0 = SX(cx, fy), y0 = SY(cx, fy)
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 150
        confetti.push({ x: x0, y: y0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 70, life: 1.6 + Math.random() * 1.4, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 14, c: cols[i % cols.length] })
      }
    }
    // field metres to screen: length up the screen (home attacks up), width across
    const STADIUM = pickGround(night, wet, snow, io.current.home.kit[0])
    const stadiumArt = typeof Image !== 'undefined' ? loadArt(STADIUM.url) : null
    const SX = (x: number, y: number) => dim.art ? dim.ox + (STADIUM.x0 + x * STADIUM.mx) * dim.art : dim.up ? dim.ox + (y + SIDE) * dim.sc : dim.ox + (x + GOAL + END) * dim.sc
    const SY = (x: number, y: number) => dim.art ? dim.oy + (STADIUM.y0 + y * STADIUM.my) * dim.art : dim.up ? dim.oy + (100 + GOAL + END - x) * dim.sc : dim.oy + (y + SIDE) * dim.sc

    const paintField = () => {
      const { sc, dpr } = dim
      field.width = Math.round(FIELD_W * sc * dpr); field.height = Math.round(FIELD_L * sc * dpr)
      const g = field.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const fx = (y: number) => (y + SIDE) * sc, fy = (x: number) => (100 + GOAL + END - x) * sc
      const W = FIELD_W * sc, L = FIELD_L * sc
      const hk = io.current.home.kit, ak = io.current.away.kit
      const names = (io.current.boards?.length ? io.current.boards : ['PHASE'])

      // ---- the ground: concrete, then the stands, then the grass on top
      g.fillStyle = lp.ground; g.fillRect(0, 0, W, L)
      // (from the reference: outside the stands is dark grass and trees, not concrete)
      if (!dim.up) { g.fillStyle = ink.grassB; g.fillRect(0, 0, W, L); g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(0, 0, W, L) }
      // the roofs go on last, over the day or night light, so they keep their colour
      const late: (() => void)[] = []
      // THE GROUND (owner, 17 Nov 2026, from the reference: "build stands like
      // the video", "Advertising on two sides"). A stand down each touchline
      // and one behind each goal: tiers of seats in the home colours with a
      // crowd in them, stairways between the blocks, a roof over the back
      // rows, and trees in the corners. The advertising boards run down the
      // two touchlines only.
      /** a block of seating: rows parallel to the pitch edge it faces. (x, y, w, h)
       *  in pixels; `out` is which way is away from the pitch */
      // (a club in black or navy would have a stand you cannot see: its seats take the other kit colour)
      const lum = (c: string) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c); return m ? (parseInt(m[1], 16) * 0.299 + parseInt(m[2], 16) * 0.587 + parseInt(m[3], 16) * 0.114) / 255 : 0.5 }
      // (17 Nov 2026, own review: "Too much green": a club in green had green
      // seats on green grass in a green surround. A seat is never grass-coloured:
      // such a club gets its other colour, or failing that a slate blue.)
      const grassy = (c: string) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c); if (!m) return false; const [r, gg, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]; return gg > r * 1.12 && gg > b * 1.12 }
      const okSeat = (c: string) => lum(c) > 0.17 && lum(c) < 0.8 && !grassy(c)
      const seatCol = okSeat(hk[0]) ? hk[0] : okSeat(hk[1]) ? hk[1] : 'rgba(74,98,150,1)'
      const seating = (x: number, y: number, w: number, h: number, out: 'l' | 'r' | 'u' | 'd', seed: number, roofFrac = 0.42) => {
        if (w < 2 || h < 2) return
        const alongX = out === 'u' || out === 'd'
        const depth = alongX ? h : w, len = alongX ? w : h
        g.fillStyle = lp.stand; g.fillRect(x, y, w, h)
        const rowPx = Math.max(3, sc * 1.05), rows = Math.max(1, Math.floor(depth / rowPx))
        const seat = Math.max(2.4, sc * 0.9), n = Math.floor(len / seat)
        for (let r = 0; r < rows; r++) {
          // row r counts from the pitch outwards
          const d0 = r * rowPx
          const rx = out === 'l' ? x + w - d0 - rowPx : out === 'r' ? x + d0 : x
          const ry = out === 'u' ? y + h - d0 - rowPx : out === 'd' ? y + d0 : y
          g.fillStyle = seatCol; g.globalAlpha = 0.5 + 0.34 * (r / Math.max(1, rows - 1))
          if (alongX) g.fillRect(rx, ry + rowPx * 0.14, w, rowPx * 0.72); else g.fillRect(rx + rowPx * 0.14, ry, rowPx * 0.72, h)
          g.globalAlpha = 1
          for (let c = 0; c < n; c++) {
            const k = h2(c + seed * 131, r + seed * 17)
            // (a calmer crowd: mostly one soft tone, a few in white, fewer still in the away colour)
            if (k < 0.3) continue
            g.fillStyle = k < 0.8 ? 'rgba(232,226,214,.55)' : k < 0.93 ? 'rgba(255,255,255,.85)' : ak[0]
            const cx = alongX ? x + (c + 0.5) * seat : rx + rowPx * 0.5, cy = alongX ? ry + rowPx * 0.5 : y + (c + 0.5) * seat
            g.beginPath(); g.arc(cx, cy, Math.max(0.9, sc * 0.27), 0, Math.PI * 2); g.fill()
          }
        }
        // the stairways between the blocks
        g.fillStyle = lp.stand
        const gap = Math.max(18, sc * 13)
        for (let a = gap; a < len - gap * 0.4; a += gap) { if (alongX) g.fillRect(x + a - sc * 0.45, y, sc * 0.9, h); else g.fillRect(x, y + a - sc * 0.45, w, sc * 0.9) }
        // the roof over the back rows, with its front edge catching the light
        // the wall at the front of the stand, where it meets the ground
        g.fillStyle = 'rgba(196,202,210,.92)'
        const wl = Math.max(1.5, sc * 0.55)
        if (out === 'u') g.fillRect(x, y + h - wl, w, wl); else if (out === 'd') g.fillRect(x, y, w, wl)
        else if (out === 'l') g.fillRect(x + w - wl, y, wl, h); else g.fillRect(x, y, wl, h)
        // the people standing at the rail, in front of the wall
        {
          const pr = Math.max(1.2, sc * 0.4), step = Math.max(3.2, sc * 1.25)
          for (let a = step; a < len - step; a += step) {
            const k = h2(Math.round(a) + seed * 71, seed * 13)
            if (k < 0.38) continue
            const d = wl + pr * 1.3
            const px = alongX ? x + a : out === 'l' ? x + w + d - wl * 2 : x - d + wl * 2
            const py = alongX ? (out === 'u' ? y + h + d - wl * 2 : y - d + wl * 2) : y + a
            g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(px + pr * 0.3, py + pr * 0.4, pr, 0, Math.PI * 2); g.fill()
            g.fillStyle = k < 0.6 ? hk[1] : k < 0.78 ? ink.white : k < 0.9 ? ak[0] : hk[0]
            g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill()
          }
        }
        // (owner, 17 Nov 2026: "ends of the stands need fixing", "roof ... is
        // weird", "Use the reference video": there each stand is a building of
        // its own, a white wall closing each end of it and a plain dark blue
        // roof with thin white trusses, no grid)
        const gw = Math.max(2, sc * 1.3)
        g.fillStyle = 'rgba(236,239,244,1)'
        if (alongX) { g.fillRect(x, y, gw, h); g.fillRect(x + w - gw, y, gw, h) } else { g.fillRect(x, y, w, gw); g.fillRect(x, y + h - gw, w, gw) }
        g.fillStyle = 'rgba(0,0,0,.22)'
        if (alongX) { g.fillRect(x + gw, y, gw * 0.5, h); g.fillRect(x + w - gw * 1.5, y, gw * 0.5, h) } else { g.fillRect(x, y + gw, w, gw * 0.5); g.fillRect(x, y + h - gw * 1.5, w, gw * 0.5) }
        if (rows >= 4) {
          const rd = depth * roofFrac
          // the dark under the roof, where the back rows are in its shadow
          g.fillStyle = 'rgba(0,0,0,.42)'
          const sh = Math.min(depth - rd, sc * 2.2)
          if (out === 'u') g.fillRect(x, y + rd, w, sh); else if (out === 'd') g.fillRect(x, y + h - rd - sh, w, sh)
          else if (out === 'l') g.fillRect(x + rd, y, sh, h); else g.fillRect(x + w - rd - sh, y, sh, h)
          const ox = out === 'l' ? x : out === 'r' ? x + w - rd : x, oy = out === 'u' ? y : out === 'd' ? y + h - rd : y
          late.push(() => {
            // HEIGHT (17 Nov 2026, own review: "No height"). The roof is nine
            // metres up, and seen at the tilt a thing that high sits further up
            // the screen than the ground beneath it. So the roof is drawn
            // shifted that way: the far stand shows its columns and the seats
            // under the roof, the near stand shows its back wall, and each end
            // stand shows the white wall that closes the end nearest the camera.
            const lift = dim.up ? 0 : sc * 3.8
            if (lift) {
              if (out === 'l') {
                g.strokeStyle = 'rgba(236,239,244,.9)'; g.lineWidth = Math.max(1, sc * 0.3)
                const col = Math.max(14, sc * 9)
                for (let a2 = col * 0.5; a2 < len; a2 += col) { g.beginPath(); g.moveTo(x + rd - lift, y + a2); g.lineTo(x + rd, y + a2); g.stroke() }
              } else if (out === 'r') {
                g.fillStyle = night ? 'rgba(96,104,120,1)' : 'rgba(168,175,188,1)'; g.fillRect(x + w - lift, y, lift, h)
                g.fillStyle = 'rgba(0,0,0,.16)'
                const rib = Math.max(10, sc * 6)
                for (let a2 = rib * 0.5; a2 < len; a2 += rib) g.fillRect(x + w - lift, y + a2, lift, Math.max(1, sc * 0.3))
              } else {
                const fr = out === 'u' ? y + h : y, bk = out === 'u' ? y : y + h
                g.fillStyle = night ? 'rgba(170,176,188,1)' : 'rgba(236,239,244,1)'
                g.beginPath(); g.moveTo(x + w, fr); g.lineTo(x + w, bk); g.lineTo(x + w - lift, bk); g.closePath(); g.fill()
                g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = Math.max(0.8, sc * 0.18); g.stroke()
              }
            }
            g.save(); g.translate(-lift, 0)
            // its shadow on whatever is under its front edge
            g.fillStyle = night ? 'rgba(16,24,48,1)' : 'rgba(30,44,84,1)'
            if (alongX) g.fillRect(ox, oy, w, rd); else g.fillRect(ox, oy, rd, h)
            // thin white trusses across it
            g.fillStyle = 'rgba(255,255,255,.4)'
            const truss = Math.max(14, sc * 9), tw2 = Math.max(0.8, sc * 0.16)
            for (let a2 = truss * 0.5; a2 < len; a2 += truss) { if (alongX) g.fillRect(x + a2, oy, tw2, rd); else g.fillRect(ox, y + a2, rd, tw2) }
            // a white edge all round, heavier along the front
            g.strokeStyle = 'rgba(240,243,248,.95)'; g.lineWidth = Math.max(1, sc * 0.3)
            if (alongX) g.strokeRect(ox, oy, w, rd); else g.strokeRect(ox, oy, rd, h)
            g.fillStyle = 'rgba(240,243,248,1)'
            const fw = Math.max(1.6, sc * 0.55)
            if (out === 'u') g.fillRect(x, y + rd - fw, w, fw); else if (out === 'd') g.fillRect(x, y + h - rd, w, fw)
            else if (out === 'l') g.fillRect(x + rd - fw, y, fw, h); else g.fillRect(x + w - rd, y, fw, h)
            g.restore()
          })
        }
      }
      const pitchT = fy(100 + GOAL), pitchB = fy(-GOAL), pitchL = fx(0), pitchR = fx(70)
      const boardW = 2.3 * sc, off = 1.5 * sc
      // down each touchline: run-off, boards, then the stand out to the edge.
      // On its side the camera is behind the near stand: that one is mostly
      // roof, seen from behind, with only its front rows showing.
      seating(0, pitchT, pitchL - off - boardW - sc * 0.5, pitchB - pitchT, 'l', 1, 0.42)
      seating(pitchR + off + boardW + sc * 0.5, pitchT, W - (pitchR + off + boardW + sc * 0.5), pitchB - pitchT, 'r', 2, dim.up ? 0.42 : 0.62)
      // BEHIND EACH GOAL, A STAND THAT RISES (owner, 17 Nov 2026, of the
      // reference: "All of those on stadium", stands "at the left and right
      // ends"). Seen at the tilt its back rows are higher up the screen than
      // its front ones, so it leans, and the end wall nearest the camera shows.
      {
        // (owner, 17 Nov 2026: "fix the roofs": the lean left a thin crooked
        // roof and a grey wedge at each end. The end stands are now built as
        // the far stand is, square, with a full roof over the back rows.)
        const rise = 0
        const wall = 'rgba(62,70,84,1)'
        const eT = pitchT - sc * 2.4, eB = pitchB + sc * 2.4
        g.save(); g.transform(1, 0, rise, 1, -rise * eT, 0)
        seating(pitchL, 0, pitchR - pitchL, eT, 'u', 3, 0.42)
        g.restore()
        g.save(); g.transform(1, 0, -rise, 1, rise * eB, 0)
        seating(pitchL, eB, pitchR - pitchL, L - eB, 'd', 4, 0.42)
        g.restore()
        if (rise > 0) {
          g.fillStyle = wall
          g.beginPath(); g.moveTo(pitchR, eT); g.lineTo(pitchR, 0); g.lineTo(pitchR - rise * eT, 0); g.closePath(); g.fill()
          g.beginPath(); g.moveTo(pitchR, eB); g.lineTo(pitchR, L); g.lineTo(pitchR - rise * (L - eB), L); g.closePath(); g.fill()
        }
      }
      // trees in the four corners, overhanging the ends of the stands
      for (const [cx, cy, sd] of [[0, 0, 11], [W, 0, 23], [0, L, 37], [W, L, 51]] as [number, number, number][]) {
        const reach = Math.min(Math.max(pitchL - off - boardW, sc * 5), Math.max(pitchT, sc * 5)) * 1.3
        for (let t = 0; t < (dim.up ? 6 : 11); t++) {
          const a = h2(t, sd) * Math.PI * 2, rr = h2(t, sd + 1) * reach
          const tx = cx + Math.cos(a) * rr * (cx === 0 ? 1 : -1) * 0.9, ty = cy + Math.sin(a) * rr * (cy === 0 ? 1 : -1) * 0.9
          const rad = Math.max(5, sc * (2.2 + h2(t, sd + 2) * 2.4))
          g.fillStyle = ink.grassB; g.beginPath(); g.arc(Math.abs(tx - cx) * (cx === 0 ? 1 : -1) + cx, Math.abs(ty - cy) * (cy === 0 ? 1 : -1) + cy, rad, 0, Math.PI * 2); g.fill()
          g.fillStyle = `rgba(0,0,0,${(0.28 + h2(t, sd + 3) * 0.3).toFixed(2)})`; g.fill()
          // the light catching the top of the crown
          g.fillStyle = 'rgba(190,255,190,.2)'; g.beginPath(); g.arc(Math.abs(tx - cx) * (cx === 0 ? 1 : -1) + cx - rad * 0.3, Math.abs(ty - cy) * (cy === 0 ? 1 : -1) + cy - rad * 0.1, rad * 0.55, 0, Math.PI * 2); g.fill()
        }
      }
      // night: the stands sit back in the dark, lit by what spills off the pitch
      if (night) { g.fillStyle = 'rgba(0,6,20,.38)'; g.fillRect(0, 0, W, L) }
      // by day the sun is on the far stand and the near one is in its own shade
      else {
        // (overlay, not a wash: the seats keep their colour and get brighter)
        g.save(); g.globalCompositeOperation = 'overlay'
        g.fillStyle = 'rgba(255,248,225,.7)'; g.fillRect(0, 0, W, L)
        g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(120,135,150,.22)'; g.fillRect(0, 0, W, L); g.restore()
      }
      for (const f of late) f()
      // a floodlight in each corner: the lamp head and the light it throws
      if (dim.up) for (const [cx, cy] of [[pitchL - off, pitchT - sc * 1.5], [pitchR + off, pitchT - sc * 1.5], [pitchL - off, pitchB + sc * 1.5], [pitchR + off, pitchB + sc * 1.5]] as [number, number][]) {
        if (night) {
          const glow = g.createRadialGradient(cx, cy, 0, cx, cy, sc * 16)
          glow.addColorStop(0, 'rgba(255,252,225,.42)'); glow.addColorStop(1, 'rgba(255,252,225,0)')
          g.fillStyle = glow; g.fillRect(cx - sc * 16, cy - sc * 16, sc * 32, sc * 32)
        }
        g.fillStyle = ink.white; g.beginPath(); g.arc(cx, cy, Math.max(2, sc * 0.8), 0, Math.PI * 2); g.fill()
      }
      // the boards: down both touchlines, and nowhere else
      const boardFills = [hk[0], lp.light, lp.dark, hk[1]]
      // (owner, 17 Nov 2026: "Tidy the advertising boards": every board the
      // same length on its side of the ground, every name in the same size of
      // lettering, and that size the largest at which the longest name still
      // fits whole inside its board)
      const fam = getComputedStyle(cv).getPropertyValue('--cond').trim() || 'system-ui'
      const runs: [boolean, [number, number][]][] = [
        [true, [[-GOAL, 12.75], [12.75, 33.5], [66.5, 87.25], [87.25, 100 + GOAL]]],
        [false, [0, 1, 2, 3, 4, 5].map(i => [-GOAL + i * 116 / 6, -GOAL + (i + 1) * 116 / 6] as [number, number])],
      ]
      const nameAt = (left: boolean, i: number) => names[(i * 2 + (left ? 0 : 1)) % names.length].toUpperCase()
      let px = Math.min(boardW * 0.62, Math.max(6, sc * 1.5))
      for (let n = 0; n < 14; n++) {
        g.font = `800 ${px}px ${fam}, system-ui, sans-serif`
        let fits = true
        for (const [left, segs] of runs) segs.forEach(([m0, m1], i) => { if (g.measureText(nameAt(left, i)).width > (m1 - m0) * sc - sc * 4.5) fits = false })
        if (fits || px <= 4) break
        px *= 0.92
      }
      for (const [left, segs] of runs) {
        const bx = left ? pitchL - off - boardW : pitchR + off
        segs.forEach(([m0, m1], i) => {
          const fill = boardFills[(i + (left ? 0 : 2)) % boardFills.length]
          const y1 = fy(m1), ln = (m1 - m0) * sc
          g.fillStyle = fill; g.fillRect(bx, y1 + sc * 0.2, boardW, ln - sc * 0.4)
          // a thin frame, so each board reads as its own panel
          g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(0.6, sc * 0.12); g.strokeRect(bx, y1 + sc * 0.2, boardW, ln - sc * 0.4)
          g.save(); g.translate(bx + boardW / 2, y1 + ln / 2); g.rotate(left || !dim.up ? -Math.PI / 2 : Math.PI / 2)
          g.font = `800 ${px}px ${fam}, system-ui, sans-serif`
          g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = isLight(fill) ? lp.boardInk : lp.light
          g.fillText(nameAt(left, i), 0, 0.5); g.restore()
        })
      }

      // ---- the grass: a run-off, then mown stripes every ten metres
      g.fillStyle = ink.grassB; g.fillRect(fx(-1.4), fy(100 + GOAL + 1.4), 72.8 * sc, (116 + 2.8) * sc)
      for (let i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? ink.grassB : ink.grassA
        g.fillRect(fx(0), fy(i * 10 + 10), 70 * sc, 10 * sc + 0.5)
      }
      g.fillStyle = 'rgba(0,0,0,.15)'
      g.fillRect(fx(0), fy(100 + GOAL), 70 * sc, GOAL * sc); g.fillRect(fx(0), fy(0), 70 * sc, GOAL * sc)
      // the floodlights: brighter in the middle, falling off to the corners
      const lg = g.createRadialGradient(W / 2, L / 2, L * 0.12, W / 2, L / 2, L * 0.62)
      // (a night match under lights, as the reference is: bright in the middle, the corners falling away)
      if (night) { lg.addColorStop(0, 'rgba(255,255,235,.1)'); lg.addColorStop(0.55, 'rgba(0,8,24,.12)'); lg.addColorStop(1, 'rgba(0,6,22,.5)') }
      // daylight: even and a touch warm, only a little darker at the edges
      else { lg.addColorStop(0, 'rgba(235,255,150,.3)'); lg.addColorStop(0.6, 'rgba(235,255,150,.22)'); lg.addColorStop(1, 'rgba(235,255,150,.12)') }
      g.fillStyle = lg; g.fillRect(fx(-1.4), fy(100 + GOAL + 1.4), 72.8 * sc, (116 + 2.8) * sc)
      // DEPTH ON THE GRASS: it is mown both ways, the stands throw their
      // shadows on to it, and the light is uneven across it
      g.save()
      g.beginPath(); g.rect(fx(-1.4), fy(100 + GOAL + 1.4), 72.8 * sc, (116 + 2.8) * sc); g.clip()
      for (let i = 0; i < 10; i++) if (i % 2) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(fx(i * 7), fy(100 + GOAL), 7 * sc, 116 * sc) }
      for (const [bx, by, br, a] of [[20, 30, 30, 0.34], [52, 78, 26, 0.3], [8, 96, 22, 0.24], [60, 12, 24, 0.26], [38, 52, 18, 0.2]] as [number, number, number, number][]) {
        const sg = g.createRadialGradient(fx(bx), fy(by), 0, fx(bx), fy(by), br * sc)
        sg.addColorStop(0, `rgba(0,14,8,${a})`); sg.addColorStop(1, 'rgba(0,14,8,0)')
        g.fillStyle = sg; g.fillRect(fx(bx) - br * sc, fy(by) - br * sc, br * sc * 2, br * sc * 2)
      }
      // pools of light between the shadows, and the grain of the grass
      for (const [bx, by, br] of [[44, 24, 22], [26, 66, 24], [50, 100, 20]] as [number, number, number][]) {
        const sg = g.createRadialGradient(fx(bx), fy(by), 0, fx(bx), fy(by), br * sc)
        sg.addColorStop(0, 'rgba(240,255,170,.16)'); sg.addColorStop(1, 'rgba(240,255,170,0)')
        g.fillStyle = sg; g.fillRect(fx(bx) - br * sc, fy(by) - br * sc, br * sc * 2, br * sc * 2)
      }
      for (let i = 0; i < 2600; i++) {
        const gx = fx(h2(i, 901) * 70), gy = fy(-GOAL + h2(i, 907) * 116)
        g.fillStyle = h2(i, 911) < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,220,.06)'
        g.fillRect(gx, gy, Math.max(1, sc * 0.5), Math.max(0.6, sc * 0.16))
      }
      // the stands' shadows: long from the near side, short from the far and the ends
      for (const [x0, x1] of [[fx(71.4), fx(71.4 - 9)], [fx(-1.4), fx(-1.4 + 4)]] as [number, number][]) {
        const sd = g.createLinearGradient(x0, 0, x1, 0)
        sd.addColorStop(0, 'rgba(0,8,16,.42)'); sd.addColorStop(1, 'rgba(0,8,16,0)')
        g.fillStyle = sd; g.fillRect(Math.min(x0, x1), fy(100 + GOAL + 1.4), Math.abs(x1 - x0), (116 + 2.8) * sc)
      }
      for (const [y0, y1] of [[fy(100 + GOAL + 1.4), fy(100 + GOAL - 4)], [fy(-GOAL - 1.4), fy(-GOAL + 4)]] as [number, number][]) {
        const sd = g.createLinearGradient(0, y0, 0, y1)
        sd.addColorStop(0, 'rgba(0,8,16,.34)'); sd.addColorStop(1, 'rgba(0,8,16,0)')
        g.fillStyle = sd; g.fillRect(fx(-1.4), Math.min(y0, y1), 72.8 * sc, Math.abs(y1 - y0))
      }
      g.restore()

      g.strokeStyle = 'rgba(255,255,255,.88)'; g.lineWidth = Math.max(1.2, sc * 0.22)
      const across = (x: number, dash: number[] = [], y0 = 0, y1 = 70) => { g.setLineDash(dash); g.beginPath(); g.moveTo(fx(y0), fy(x)); g.lineTo(fx(y1), fy(x)); g.stroke() }
      across(0); across(100); across(22); across(78); across(50); across(-GOAL); across(100 + GOAL)
      across(40, [sc * 1.4, sc * 1.4]); across(60, [sc * 1.4, sc * 1.4])
      // the 5s and 15s, as the short dashes a real pitch has
      g.setLineDash([sc * 1.2, sc * 2.2])
      for (const y of [5, 15, 55, 65]) { g.beginPath(); g.moveTo(fx(y), fy(0)); g.lineTo(fx(y), fy(100)); g.stroke() }
      for (const x of [5, 95]) across(x, [sc * 1.2, sc * 2.2], 5, 65)
      g.setLineDash([])
      g.beginPath(); g.moveTo(fx(0), fy(-GOAL)); g.lineTo(fx(0), fy(100 + GOAL)); g.moveTo(fx(70), fy(-GOAL)); g.lineTo(fx(70), fy(100 + GOAL)); g.stroke()
      // THE TUNNEL (owner, 17 Nov 2026: "Add tunnel in red circle"): on halfway
      // between the two dugouts, a dark mouth cut back into the stand under a
      // canopy in the club's colour, and a path from it to the touchline
      {
        const ta = off + boardW, y0 = fy(52.6), len = 5.2 * sc, deep = sc * 6.5
        g.fillStyle = ink.grassB; g.fillRect(pitchL - ta, fy(53.2), ta - sc * 0.3, 6.4 * sc)
        g.fillStyle = 'rgba(214,218,224,1)'; g.fillRect(pitchL - ta, y0 + len * 0.18, ta - sc * 0.3, len * 0.64)
        g.fillStyle = 'rgba(232,236,242,1)'; g.fillRect(pitchL - ta - deep, y0 - sc * 0.5, deep, len + sc)
        const tg2 = g.createLinearGradient(pitchL - ta - deep, 0, pitchL - ta, 0)
        tg2.addColorStop(0, 'rgba(0,0,0,1)'); tg2.addColorStop(1, 'rgba(34,40,52,1)')
        g.fillStyle = tg2; g.fillRect(pitchL - ta - deep, y0, deep, len)
        g.fillStyle = lum(hk[0]) > 0.17 ? hk[0] : hk[1]; g.fillRect(pitchL - ta - deep, y0 - sc * 0.5, deep * 0.45, len + sc)
        g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(pitchL - ta - deep * 0.55 - 1, y0 - sc * 0.5, 1.2, len + sc)
      }
      // THE BENCHES (owner: "Benches for home and away teams"): a dugout each
      // side of halfway ON the far touchline (owner, 17 Nov 2026: "they need to be
      // connected to the pitch"), opening straight on to the grass, the
      // replacements sitting in it in their own colours, and the technical
      // area marked on the run-off in front
      // (owner, 17 Nov 2026: "Lets build them then": the reference's glass
      // dugouts, the replacements 16 to 23 sitting in them, a coach standing
      // in the technical area)
      // (owner, 17 Nov 2026: "bench looks too long ... Look into correct
      // scale": eight seats at about 1.25m each is a 10m dugout, not 16m)
      for (const [mid, kit] of [[40.5, hk], [59.5, ak]] as [number, [string, string]][]) {
        const y0 = fy(mid + 5), len = 10 * sc
        const bw = sc * 3.8, ta = off + boardW, bx = pitchL - ta - bw
        // (owner, 17 Nov 2026: "Sink them more into the stand and push the
        // technical area beyond the pitch lines": the dugout is set back into
        // the stand, and the technical area is the grass between it and the
        // touchline, none of it on the field)
        g.fillStyle = ink.grassB; g.fillRect(pitchL - ta, y0 - sc * 1.5, ta - sc * 0.3, len + sc * 3)
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(bx - sc * 0.5, y0 + sc * 0.5, bw, len)
        g.fillStyle = 'rgba(22,27,35,1)'; g.fillRect(bx, y0, bw, len)
        g.fillStyle = 'rgba(232,236,242,1)'; g.fillRect(bx, y0, sc * 0.5, len)
        g.fillRect(bx, y0, bw, sc * 0.35); g.fillRect(bx, y0 + len - sc * 0.35, bw, sc * 0.35)
        // the replacements, 16 to 23, in their own colours
        const rr = Math.max(1.6, sc * 0.5)
        for (let i = 0; i < 8; i++) {
          const cx = bx + bw * 0.6, cy = y0 + (i + 0.5) * len / 8
          g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(cx + rr * 0.2, cy + rr * 0.3, rr, 0, Math.PI * 2); g.fill()
          g.fillStyle = kit[0]; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill()
          g.strokeStyle = kit[1]; g.lineWidth = Math.max(0.7, sc * 0.16); g.stroke()
          if (rr >= 3.4) {
            g.save(); g.translate(cx, cy); if (!dim.up) g.rotate(-Math.PI / 2)
            g.font = `800 ${Math.round(rr * 1.05)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
            g.fillStyle = isLight(kit[0]) ? ink.dark : ink.white
            g.fillText(String(dim.up ? 16 + i : 23 - i), 0, 0.5); g.restore()
          }
        }
        // the glass roof over the back of it, its frame, and a rim in the team's colour
        g.fillStyle = 'rgba(190,225,255,.26)'; g.fillRect(bx, y0, bw * 0.46, len)
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = Math.max(0.8, sc * 0.16)
        for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(bx, y0 + i * len / 4); g.lineTo(bx + bw * 0.46, y0 + i * len / 4); g.stroke() }
        g.fillStyle = lum(kit[0]) > 0.17 ? kit[0] : kit[1]; g.fillRect(bx + bw * 0.46 - Math.max(1.2, sc * 0.3), y0, Math.max(1.2, sc * 0.3), len)
        // the technical area on the run-off, and the coach standing in it
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = Math.max(0.8, sc * 0.16); g.setLineDash([sc * 0.9, sc * 0.9])
        g.strokeRect(pitchL - ta + sc * 0.3, y0 - sc * 1.1, ta - sc * 1.0, len + sc * 2.2); g.setLineDash([])
        const kx = pitchL - ta * 0.42, ky = y0 + len * (mid < 50 ? 0.62 : 0.38), kr = Math.max(2.4, sc * 0.9)
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(kx + kr * 0.25, ky + kr * 0.35, kr, 0, Math.PI * 2); g.fill()
        g.fillStyle = 'rgba(26,32,44,1)'; g.beginPath(); g.arc(kx, ky, kr, 0, Math.PI * 2); g.fill()
        g.strokeStyle = lum(kit[0]) > 0.17 ? kit[0] : kit[1]; g.lineWidth = Math.max(1, sc * 0.26); g.stroke()
      }
      // THE POSTS, SQUARE ON (owner, 17 Nov 2026: "The posts look wonky").
      // Seen from above with the pitch upright: the bar along the try line,
      // a pad at each foot, and each upright standing straight back from the
      // field into the in-goal, the same at both ends, with a soft shadow.
      // (on its side the pitch is seen at a tilt and the posts stand up out of
      // it: those are drawn each frame, over the grass, not here)
      if (dim.up) for (const x of [0, 100]) {
        const away = x === 0 ? 1 : -1   // towards the dead-ball line, in screen y
        const up = sc * 4.2
        g.lineCap = 'round'
        g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = Math.max(2, sc * 0.5)
        for (const y of [32.2, 37.8]) { g.beginPath(); g.moveTo(fx(y) + sc * 0.5, fy(x)); g.lineTo(fx(y) + sc * 0.5, fy(x) + away * up); g.stroke() }
        g.strokeStyle = ink.white; g.lineWidth = Math.max(2, sc * 0.44)
        for (const y of [32.2, 37.8]) { g.beginPath(); g.moveTo(fx(y), fy(x)); g.lineTo(fx(y), fy(x) + away * up); g.stroke() }
        g.lineWidth = Math.max(2.4, sc * 0.5)
        g.beginPath(); g.moveTo(fx(32.2), fy(x)); g.lineTo(fx(37.8), fy(x)); g.stroke()
        for (const y of [32.2, 37.8]) { g.beginPath(); g.arc(fx(y), fy(x), Math.max(2.8, sc * 0.62), 0, Math.PI * 2); g.fillStyle = hk[0]; g.fill(); g.lineWidth = 1.2; g.strokeStyle = ink.white; g.stroke() }
        g.lineCap = 'butt'
      }
    }
    const size = () => {
      const w = cv.clientWidth, h = cv.clientHeight
      // (owner, 17 Nov 2026: "need to make it hi-res so its really vissible":
      // drawn at up to three times the screen's dots, never fewer than two,
      // because the tilt stretches the picture and softens it)
      const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1))
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      flat.width = cv.width; flat.height = cv.height
      const tilt = getComputedStyle(cv).getPropertyValue('--lp-tilt').trim() === '1'
      // upright only in a box that is clearly taller than it is wide: a squarish
      // panel (the landscape game in an upright screen) is the pitch on its side
      const up = h > w * 1.25
      // the pitch as large as the box allows with the least ground round it,
      // then the ground stretched to fill what is left
      const across = up ? w : h, along = up ? h : w
      // (turned on its side there is room behind the goals to spare, so the
      // touchline stands get more of it)
      const sideMin = up ? SIDE_MIN : 9
      const endMin = up ? END_MIN : 13
      const sc = Math.min(across / (70 + sideMin * 2), along / (100 + GOAL * 2 + endMin * 2))
      if (sc > 0) { SIDE = (across / sc - 70) / 2; END = (along / sc - 100 - GOAL * 2) / 2; FIELD_L = 100 + GOAL * 2 + END * 2; FIELD_W = 70 + SIDE * 2 }
      dim = { w, h, dpr, sc, up, tilt, art: 0, ox: (w - (up ? FIELD_W : FIELD_L) * sc) / 2, oy: (h - (up ? FIELD_L : FIELD_W) * sc) / 2 }
      // on its side, and the picture has arrived: the picture is the ground
      if (!up && stadiumArt?.complete && stadiumArt.naturalWidth > 0 && w > 0) {
        // THE PITCH A LITTLE CLOSER (18 Nov 2026, stage 2). With the whole
        // picture in the panel a man was drawn nearly five metres across, so
        // any ruck was one blob. The outer edge of the picture (the backs of
        // the roofs, the trees) is left off: every seat is still in view and
        // the pitch is a sixth bigger.
        const crop = { x: 100, y: 75, w: 1248, h: 936 }
        const k = Math.min(w / crop.w, h / crop.h)
        dim = { w, h, dpr, sc: STADIUM.mx * k, up, tilt: false, art: k, ox: (w - crop.w * k) / 2 - crop.x * k, oy: (h - crop.h * k) / 2 - crop.y * k }
      } else if (sc > 0) paintField()
    }
    size()
    if (stadiumArt && !stadiumArt.complete) stadiumArt.addEventListener('load', () => { if (cv.isConnected) size() }, { once: true })
    const ro = new ResizeObserver(size)
    ro.observe(cv)

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!io.current.paused) {
        // the speed changes are eased, never snapped: it winds on and winds down
        const want = io.current.realTime ? Math.min(1, S.rate) : S.rate
        rateNow += (want - rateNow) * Math.min(1, dt * 3.5)
        const rate = rateNow
        acc += dt * io.current.speed * rate
        ffShown += ((rate >= 2.6 && !S.done ? 1 : 0) - ffShown) * Math.min(1, dt * 8)
        while (acc >= 1 / 120) { S.step(1 / 120); acc -= 1 / 120 }
      }
      if (S.cuts !== seenCuts) {
        // the canvas still holds the frame before the cut: keep it
        const first = seenCuts === 0 && S.cuts === 1
        seenCuts = S.cuts
        if (!first && cv.width && !reduce) {
          ghost.width = cv.width; ghost.height = cv.height
          ghost.getContext('2d')!.drawImage(cv, 0, 0)
          dissolve = 1
        }
      }
      if (dissolve > 0) dissolve = Math.max(0, dissolve - dt / 0.45)
      if (S.phase && S.phase !== grassSeen) { grassSeen = S.phase; setOnGrass(S.phase) }
      {
        const rc = io.current.cursor
        if (reachedSent !== rc && (S.phase?.at !== rc - 1 || S.reached)) { reachedSent = rc; io.current.onReached?.(rc) }
      }
      // the banner lands with the moment, not with the line
      const bw = bannerRef.current
      if (bw.want && S.landed && S.phase?.at === bw.want.at && bw.shownAt !== bw.want.at) {
        bw.shownAt = bw.want.at
        setBanner(bw.want)
        if ((bw.want.kind === 'try' || bw.want.kind === 'pentry') && !reduce) burst(S.ball.x, S.ball.y, bw.want.teamId === homeId)
      } else if (bw.shownAt !== -1 && (!bw.want || S.phase?.at !== bw.shownAt)) { bw.shownAt = -1; setBanner(null) }
      for (const c of confetti) { c.vy += 26 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt; c.rot += c.spin * dt }
      confetti = confetti.filter(c => c.life > 0)
      const sn = seen.current
      if (S.done && !sn.told) {
        const nx = io.current.ahead
        if (nx && nx.at !== sn.at) {
          // a score is next: play it now, and tell them when it lands
          sn.at = nx.at; sn.pre = true
          S.start(nx, io.current.aheadIdx)
        } else { sn.told = true; io.current.onPlayed?.(sn.moved) }
      } else if (sn.pre && !sn.told && S.landed && !S.done) { sn.told = true; io.current.onPlayed?.(true) }
      draw()
      raf = requestAnimationFrame(frame)
    }

    const draw = () => {
      const g = (dim.tilt ? flat : cv).getContext('2d')!
      const { w, h, dpr, sc } = dim
      if (!sc) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = lp.ground; g.fillRect(0, 0, w, h)
      if (dim.art && stadiumArt) {
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
        g.drawImage(stadiumArt, dim.ox, dim.oy, STADIUM.w * dim.art, STADIUM.h * dim.art)
      } else if (dim.up) g.drawImage(field, dim.ox, dim.oy, FIELD_W * sc, FIELD_L * sc)
      else {
        g.save(); g.translate(dim.ox + FIELD_L * sc, dim.oy); g.rotate(Math.PI / 2)
        g.drawImage(field, 0, 0, FIELD_W * sc, FIELD_L * sc); g.restore()
        // THE POSTS STAND UP (owner, 17 Nov 2026: "Posts look odd"). Seen at a
        // tilt from the near touchline a post rises up the screen and leans
        // a little away from the field: two tall uprights, the bar a third of
        // the way up, a pad at each foot, a shadow on the grass behind.
        for (const x of [0, 100]) {
          const out = x === 0 ? -1 : 1
          const H = sc * 15, lean = out * 0.2
          const foot = [32.2, 37.8].map(y => ({ x: SX(x, y), y: SY(x, y) }))
          g.lineCap = 'round'
          g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = Math.max(1.5, sc * 0.5)
          for (const f of foot) { g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x + out * H * 0.55, f.y + sc * 0.6); g.stroke() }
          g.strokeStyle = ink.white; g.lineWidth = Math.max(1.6, sc * 0.5)
          for (const f of foot) { g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x + lean * H, f.y - H); g.stroke() }
          g.beginPath(); g.moveTo(foot[0].x + lean * H * 0.3, foot[0].y - H * 0.3); g.lineTo(foot[1].x + lean * H * 0.3, foot[1].y - H * 0.3); g.stroke()
          const kit = io.current.home.kit
          // the shaded side of each upright, so it reads as a round post
          g.strokeStyle = 'rgba(120,130,145,.8)'; g.lineWidth = Math.max(0.7, sc * 0.16)
          for (const f of foot) { g.beginPath(); g.moveTo(f.x + sc * 0.17, f.y); g.lineTo(f.x + sc * 0.17 + lean * H, f.y - H); g.stroke() }
          for (const f of foot) {
            g.strokeStyle = kit[0]; g.lineWidth = Math.max(3.4, sc * 1.3); g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x + lean * H * 0.14, f.y - H * 0.14); g.stroke()
            g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, sc * 0.3); g.beginPath(); g.moveTo(f.x - sc * 0.3, f.y); g.lineTo(f.x - sc * 0.3 + lean * H * 0.14, f.y - H * 0.14); g.stroke()
          }
          g.lineCap = 'butt'
        }
        // THE FLAGS: one at every corner, and at each 22 and halfway a couple
        // of metres outside the touchline, standing up with a shadow
        {
          const fl: [number, number][] = []
          for (const x of [-GOAL, 0, 100, 100 + GOAL]) for (const y of [0, 70]) fl.push([x, y])
          for (const x of [22, 50, 78]) fl.push([x, 70.7])   // (near side only: on the far side they stood across the boards)
          // (owner, 17 Nov 2026: "corner flags should be more obvious": taller,
          // a thicker pole, a big bright pennant with a white edge, as the
          // reference's red flags stand out against the grass)
          for (const [x, y] of fl) {
            const corner = y === 0 || y === 70
            const Hf = sc * (corner ? 3.6 : 2.2)
            const px = SX(x, y), py = SY(x, y)
            g.lineCap = 'round'
            g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(1.2, sc * 0.45)
            g.beginPath(); g.moveTo(px, py); g.lineTo(px + Hf * 0.55, py + sc * 0.4); g.stroke()
            g.strokeStyle = ink.white; g.lineWidth = Math.max(1.4, sc * (corner ? 0.5 : 0.32))
            g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - Hf); g.stroke()
            g.lineCap = 'butt'
            const pw = sc * (corner ? 1.7 : 1)
            g.fillStyle = 'rgba(232,74,60,1)'
            g.beginPath(); g.moveTo(px, py - Hf); g.lineTo(px + pw, py - Hf * 0.8); g.lineTo(px, py - Hf * 0.58); g.closePath(); g.fill()
            g.strokeStyle = ink.white; g.lineWidth = Math.max(0.7, sc * 0.16); g.stroke()
          }
        }
      }
      // THE FLOODLIGHTS (owner, 17 Nov 2026: "put flood lights in each
      // corner"): a pylon standing in each corner of the ground, a bank of
      // lamps at its head turned in to the pitch, lit at night
      // (owner, 17 Nov 2026: "floodlights look awful", "Use the reference
      // video": there a floodlight is a slim pale pole in the corner with a
      // small lamp head and a soft pool of light, nothing more)
      if (!dim.up && !dim.art) for (const [x, y] of [[-GOAL - 5, -6.5], [100 + GOAL + 5, -6.5], [-GOAL - 5, 76.5], [100 + GOAL + 5, 76.5]] as [number, number][]) {
        // (own review: they read as stray slanted lines. Now a straight
        // mast with a dark edge so it shows by day, a foot, and a lamp box)
        const px = SX(x, y), py = SY(x, y), H = sc * 11, inx = x < 50 ? 1 : -1
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(px - inx * sc * 1.6, py + sc * 0.3, sc * 2.2, sc * 0.6, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = 'rgba(40,46,58,1)'; g.fillRect(px - sc * 0.5, py - H, sc * 1.0, H)
        g.fillStyle = 'rgba(214,219,228,1)'; g.fillRect(px - sc * 0.3, py - H, sc * 0.6, H)
        g.fillStyle = 'rgba(40,46,58,1)'; g.fillRect(px - sc * 0.9, py - sc * 0.5, sc * 1.8, sc * 0.7)
        if (night) {
          const glow = g.createRadialGradient(px, py - H, 0, px, py - H, sc * 11)
          glow.addColorStop(0, 'rgba(255,252,225,.55)'); glow.addColorStop(1, 'rgba(255,252,225,0)')
          g.fillStyle = glow; g.fillRect(px - sc * 11, py - H - sc * 11, sc * 22, sc * 22)
        }
        g.fillStyle = 'rgba(40,46,58,1)'; g.fillRect(px - sc * 1.7, py - H - sc * 1.3, sc * 3.4, sc * 2)
        g.fillStyle = night ? 'rgba(255,253,232,1)' : 'rgba(236,240,246,1)'
        for (let c = 0; c < 3; c++) g.fillRect(px - sc * 1.4 + c * sc * 1.0, py - H - sc * 1.0, sc * 0.8, sc * 1.4)
      }
      // (the side attacking each end used to be written across its in-goal; the
      // owner did not like it, 17 Nov 2026, and the pitch is cleaner without)
      // (smaller than they were: the reference draws a man about a metre and a
      // half across and lets a pack overlap)
      // (in the painted ground the pitch is a smaller share of the panel, so the men are a touch smaller)
      const R0 = Math.max(dim.art ? 5.2 : 6.5, sc * 1.45)
      let R = R0
      const { home: H, away: A, names: N, carrierId } = io.current
      const flying = S.ball.lift > 0.4
      // a lineout jumper in the air is drawn larger: he is above the rest
      const up2 = S.lifted()
      const dot = (i: number) => {
        const side = i < 15 ? H : A, k = i % 15
        const p = S.b[i]
        const x = SX(p.x, p.y), y = SY(p.x, p.y)
        const has = i === S.holder
        const scorer = has && S.phase?.kind === 'try' && S.landed
        // a man on the ground after a tackle: fainter until he is back up
        const floor = S.down[i] > 0 || S.off[i]
        // the men in a ruck are a pile, not six separate discs
        sz[i] += ((S.bound(i) || floor ? 0.56 : up2[0] === i || up2[1] === i ? 1.24 : 1) - sz[i]) * 0.18
        R = R0 * sz[i]
        if (floor) g.globalAlpha = 0.6
        // DEPTH (owner, 17 Nov 2026: "Add more depth"): a man stands on the
        // grass, he is not printed on it. A soft shadow thrown down and to
        // one side, and a light from above on the disc itself.
        g.beginPath(); g.ellipse(x + R * 0.3, y + R * 0.62, R * 1.02, R * 0.78, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.36)'; g.fill()
        g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fillStyle = side.kit[0]; g.fill()
        {
          const sh = g.createRadialGradient(x - R * 0.35, y - R * 0.45, R * 0.1, x, y, R * 1.05)
          sh.addColorStop(0, 'rgba(255,255,255,.3)'); sh.addColorStop(0.55, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.3)')
          g.fillStyle = sh; g.fill()
        }
        g.lineWidth = has ? Math.max(2.4, R * 0.3) : Math.max(1.3, R * 0.17)
        g.strokeStyle = scorer ? gold : has ? ink.white : side.kit[1]; g.stroke()
        g.fillStyle = isLight(side.kit[0]) ? ink.dark : ink.white
        g.font = `800 ${Math.round(R * 1.08)}px system-ui, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        // (a man bound in a ruck or on the floor is one of a knot: no number on him)
        if (sz[i] > 0.8) g.fillText(String(side.nums[k] ?? k + 1), x, y + 0.5)
        if (floor) g.globalAlpha = 1
        R = R0
      }
      // A CALLED MOVE'S LINES, as the Playbook draws them: each man's run
      // from where he is to where it ends, dashed, with an arrow on it
      {
        const tl = S.trails()
        if (tl.length) {
          g.save()
          g.strokeStyle = 'rgba(255,255,255,.72)'; g.fillStyle = 'rgba(255,255,255,.72)'
          g.lineWidth = Math.max(1.6, sc * 0.3); g.lineCap = 'round'; g.lineJoin = 'round'
          for (const line of tl) {
            g.setLineDash([sc * 1.1, sc * 1.0])
            g.beginPath()
            line.forEach((q, n) => { const x = SX(q.x, q.y), y = SY(q.x, q.y); if (n) g.lineTo(x, y); else g.moveTo(x, y) })
            g.stroke()
            const e = line[line.length - 1], f = line[Math.max(0, line.length - 3)]
            const x1 = SX(e.x, e.y), y1 = SY(e.x, e.y), x0 = SX(f.x, f.y), y0 = SY(f.x, f.y)
            const d = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / d, uy = (y1 - y0) / d
            g.setLineDash([])
            g.beginPath(); g.moveTo(x1 + ux * 4, y1 + uy * 4); g.lineTo(x1 - ux * 4 - uy * 3.6, y1 - uy * 4 + ux * 3.6); g.lineTo(x1 - ux * 4 + uy * 3.6, y1 - uy * 4 - ux * 3.6); g.closePath(); g.fill()
          }
          g.restore()
        }
      }
      // THE TRY IS SEEN (owner: "tries seem a bit unclear"): where the ball
      // goes down, rings spread from it in the scorers' colour
      if (S.phase?.kind === 'try' && S.landed) {
        if (tryFor !== S.phase.at) { tryFor = S.phase.at; tryAt = performance.now() }
        const age = (performance.now() - tryAt) / 1000
        const kit = (S.phase.homeBall ? io.current.home : io.current.away).kit
        const bxr = SX(S.ball.x, S.ball.y), byr = SY(S.ball.x, S.ball.y)
        for (let n = 0; n < 3; n++) {
          const a = (age - n * 0.35) / 1.5
          if (a <= 0 || a >= 1) continue
          g.beginPath(); g.arc(bxr, byr, sc * (2 + a * 11), 0, Math.PI * 2)
          g.lineWidth = Math.max(2, sc * 0.6) * (1 - a); g.strokeStyle = n % 2 ? ink.white : kit[0]; g.globalAlpha = 1 - a; g.stroke(); g.globalAlpha = 1
        }
      }
      // the lines being run on to the ball: a dashed arrow to where he will take it
      g.save()
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.fillStyle = 'rgba(255,255,255,.6)'; g.lineWidth = Math.max(1.4, sc * 0.26); g.setLineDash([sc * 1.1, sc * 0.9]); g.lineCap = 'round'
      for (const r of S.runs()) {
        const a = S.b[r.i]
        const x0 = SX(a.x, a.y), y0 = SY(a.x, a.y), x1 = SX(r.to.x, r.to.y), y1 = SY(r.to.x, r.to.y)
        const d = Math.hypot(x1 - x0, y1 - y0)
        if (d < R * 1.6) continue
        const ux = (x1 - x0) / d, uy = (y1 - y0) / d
        g.beginPath(); g.moveTo(x0 + ux * R * 1.15, y0 + uy * R * 1.15); g.lineTo(x1 - ux * 3, y1 - uy * 3); g.stroke()
        g.setLineDash([])
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - ux * 6 - uy * 3.4, y1 - uy * 6 + ux * 3.4); g.lineTo(x1 - ux * 6 + uy * 3.4, y1 - uy * 6 - ux * 3.4); g.closePath(); g.fill()
        g.setLineDash([sc * 1.1, sc * 0.9])
      }
      g.restore()
      // the side with the ball on top, the man with it last of all
      const top = S.phase?.homeBall === false ? 15 : 0
      for (const st of [15 - top, top]) for (let i = st; i < st + 15; i++) if (i !== S.holder && S.bound(i)) dot(i)
      for (const st of [15 - top, top]) for (let i = st; i < st + 15; i++) if (i !== S.holder && !S.bound(i)) dot(i)
      R = R0
      // the referee: no number, the colour nobody wears
      g.beginPath(); g.arc(SX(S.ref.x, S.ref.y), SY(S.ref.x, S.ref.y), R * 0.78, 0, Math.PI * 2); g.fillStyle = refKit; g.fill()
      g.lineWidth = 1.4; g.strokeStyle = ink.dark; g.stroke()
      if (S.holder >= 0) dot(S.holder)

      // the ball: on the man's shoulder in hand, off its shadow in the air
      const br = Math.max(3.6, R * 0.5) * (1 + S.ball.lift * 0.03)
      const inHand = S.holder >= 0 && !flying
      const bx = SX(S.ball.x, S.ball.y) + (inHand ? R * 0.7 : 0), by = SY(S.ball.x, S.ball.y) - (inHand ? R * 0.6 : 0)
      // a real ball: its shadow stays on the grass and softens as it climbs,
      // the ball itself is lit from above with a seam down it
      if (!inHand) {
        const k = Math.min(1, S.ball.lift / 12)
        g.beginPath(); g.ellipse(SX(S.ball.x, S.ball.y) + br * 0.3 + k * sc * 1.2, SY(S.ball.x, S.ball.y) + br * 0.5, br * (0.95 + k * 0.4), br * (0.6 + k * 0.2), 0, 0, Math.PI * 2)
        g.fillStyle = `rgba(0,0,0,${(0.4 - k * 0.2).toFixed(2)})`; g.fill()
      }
      {
        const cy = by - S.ball.lift * sc * 0.45
        g.beginPath(); g.ellipse(bx, cy, br * 0.72, br, 0.5, 0, Math.PI * 2)
        g.fillStyle = ink.ball; g.fill()
        const bg = g.createRadialGradient(bx - br * 0.3, cy - br * 0.4, br * 0.05, bx, cy, br * 1.05)
        bg.addColorStop(0, 'rgba(255,255,255,.75)'); bg.addColorStop(0.5, 'rgba(255,255,255,0)'); bg.addColorStop(1, 'rgba(0,0,0,.38)')
        g.fillStyle = bg; g.fill()
        g.lineWidth = 1; g.strokeStyle = ink.ballEdge; g.stroke()
        g.save(); g.translate(bx, cy); g.rotate(0.5); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = Math.max(0.6, br * 0.1)
        g.beginPath(); g.moveTo(0, -br * 0.6); g.lineTo(0, br * 0.6); g.stroke(); g.restore()
      }

      // the man on the ball, by name, when he is the one the line names
      if (inHand && carrierId != null) {
        const side = S.holder < 15 ? H : A
        if (side.lineup[S.holder % 15] === carrierId) {
          const nm = N(carrierId)
          if (nm) {
            const p = S.b[S.holder]
            const label = nm.split(' ').slice(-1)[0]
            g.font = `700 11px system-ui, sans-serif`
            const tw = g.measureText(label).width + 10
            const lx = Math.max(tw / 2 + 2, Math.min(w - tw / 2 - 2, SX(p.x, p.y))), ly = SY(p.x, p.y) - R - 11
            g.fillStyle = 'rgba(10,14,20,.8)'
            g.beginPath(); g.roundRect(lx - tw / 2, ly - 8, tw, 16, 8); g.fill()
            g.fillStyle = ink.white; g.textAlign = 'center'; g.textBaseline = 'middle'
            g.fillText(label, lx, ly + 0.5)
          }
        }
      }
      // wound on: two chevrons in the corner while the quiet play goes by
      if (ffShown > 0.02) {
        const cx = w - 26, cy = 22
        g.save(); g.globalAlpha = 0.85 * ffShown
        g.fillStyle = 'rgba(8,12,10,.7)'; g.beginPath(); g.roundRect(cx - 17, cy - 11, 34, 22, 11); g.fill()
        g.fillStyle = ink.white
        for (const o of [-7, 2]) { g.beginPath(); g.moveTo(cx + o, cy - 5.5); g.lineTo(cx + o + 7, cy); g.lineTo(cx + o, cy + 5.5); g.closePath(); g.fill() }
        g.restore()
      }
      for (const c of confetti) {
        g.save(); g.translate(c.x, c.y); g.rotate(c.rot)
        g.globalAlpha = Math.min(1, c.life); g.fillStyle = c.c
        g.fillRect(-3, -1.6, 6, 3.2); g.restore()
      }
      // the dissolve of a cut: the old frame fading off the new one
      // THE WEATHER FALLS (owner, 18 Nov 2026: "can we incorporate weather?").
      // The ground is already the wet or the snowy one; now it rains or snows
      // on it. Rain is fine slanted streaks, snow is slow flakes that drift.
      if ((wet || snow) && !reduce) {
        const tm = performance.now() / 1000
        // (h2 runs from -1 to 1: its size is used here, or half the weather
        // falls off the screen and a flake can have a negative radius)
        const u = (k: number, n: number) => Math.abs(h2(k, n))
        if (wet) {
          g.strokeStyle = 'rgba(232,240,255,.5)'; g.lineWidth = 1.1; g.beginPath()
          for (let k = 0; k < 150; k++) {
            const sp = 300 + u(k, 71) * 180
            const x0 = (u(k, 73) * (w + 80) + tm * 60) % (w + 80) - 40
            const y0 = (u(k, 79) * (h + 40) + tm * sp) % (h + 40) - 20
            g.moveTo(x0, y0); g.lineTo(x0 + 3.5, y0 + 13)
          }
          g.stroke()
        } else {
          g.fillStyle = 'rgba(255,255,255,.9)'
          for (let k = 0; k < 110; k++) {
            const sp = 22 + u(k, 83) * 26
            const x0 = (u(k, 89) * w + Math.sin(tm * 0.8 + k) * 9 + tm * 6 + w) % w
            const y0 = (u(k, 97) * h + tm * sp) % h
            g.beginPath(); g.arc(x0, y0, 1 + u(k, 101) * 1.2, 0, Math.PI * 2); g.fill()
          }
        }
      }
      const o = cv.getContext('2d')!
      o.setTransform(1, 0, 0, 1, 0, 0)
      if (dim.tilt) {
        // the same view the styled tilt gave: leaning back 27 degrees about a
        // line a little below the middle, the eye 620 points away
        const th = 27 * Math.PI / 180, d = 620, k = 0.985, pv = h * 0.58, oy = h * 0.425
        const ys = (v: number) => { const s2 = d / (d - (v - pv) * k * Math.sin(th)); return [oy + (pv + (v - pv) * k * Math.cos(th) - oy) * s2, s2] }
        // (own review: "Dead space": outside the tilted ground the panel showed
        // through as grey wedges. It is filled with the same dark grass as the
        // ground round the stands, so the wedges read as more of the place.)
        o.fillStyle = ink.grassB; o.fillRect(0, 0, cv.width, cv.height)
        o.fillStyle = night ? 'rgba(0,4,10,.66)' : 'rgba(0,0,0,.14)'; o.fillRect(0, 0, cv.width, cv.height)
        o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high'
        const dv = 1 / dpr * 2
        for (let v = 0; v < h; v += dv) {
          const [y0, s0] = ys(v), [y1] = ys(v + dv)
          const ww = w * k * s0
          o.drawImage(flat, 0, v * dpr, flat.width, dv * dpr, (w / 2 - ww / 2) * dpr, y0 * dpr, ww * dpr, (y1 - y0) * dpr + 0.75)
        }
      }
      if (dissolve > 0 && ghost.width) {
        o.globalAlpha = dissolve * dissolve * (3 - 2 * dissolve)
        o.drawImage(ghost, 0, 0)
        o.globalAlpha = 1
      }
    }

    // the boards are lettered in the condensed face: letter them again once it has loaded
    void document.fonts?.ready.then(() => { if (cv.isConnected) size() })
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [home.kit[0], home.kit[1], away.kit[0], away.kit[1], night, wet, snow])

  // the chip says what the play is; a plain carry or tackle says nothing.
  // A called move is named, and named large, for as long as it is being run
  // (owner, 17 Nov 2026: "I didnt see any of the moves")
  const now = onGrass ?? phase
  const quiet = now.kind === 'carry' || now.label === 'lp.tackle' || now.label === 'lp.ruck' || now.kind === 'try' || now.kind === 'con' || now.kind === 'goal'
  const cap = (x: string) => x.charAt(0).toLocaleUpperCase() + x.slice(1)
  const isMove = !!now.move
  const chip = isMove ? cap(tr(now.move!)) : quiet ? '' : tr(now.label, now.n != null ? { n: now.n } : undefined)
  const bSide = banner ? (banner.teamId === homeId ? home : away) : null
  const good = banner && (banner.kind === 'try' || banner.kind === 'pentry' || banner.kind === 'con' || banner.kind === 'pen' || banner.kind === 'dg')
  const pts = banner ? ({ try: 5, pentry: 7, con: 2, pen: 3, dg: 3 } as Record<string, number>)[banner.kind] : undefined
  return (
    <div className={`live-pitch${night ? '' : ' day'}`} data-testid="live-pitch" data-phase={phase.kind}>
      <canvas ref={canvas} className="lp-canvas" />
      {chip && <div className={`lp-chip${isMove ? ' move' : ''}`} key={`c${now.at}`}><i style={{ background: (now.homeBall ? home : away).kit[0] }} />{isMove && <small>{tr('lp.move')}</small>}{chip}</div>}
      {banner && bSide && (
        <div className={`lp-banner ${banner.kind}${good ? ' good' : ''}${(banner.teamId === homeId) ? ' low' : ' high'}`} key={`b${banner.at}`} data-testid="lp-banner">
          {pts != null && <em>+{pts}</em>}
          {/* a long verdict (PENALTY GOAL, CARTELLINO GIALLO) is set smaller so it stays inside the touchlines */}
          <b style={bannerSize(tr(`lp.b.${banner.kind}`), !!good)}>{tr(`lp.b.${banner.kind}`)}</b>
          <span><i style={{ background: bSide.kit[0], borderColor: bSide.kit[1] }} />
            {banner.teamId === homeId ? teams.home : teams.away}{banner.name ? ` · ${banner.name}` : ''} · {Math.min(80, banner.min)}'</span>
        </div>
      )}
    </div>
  )
}
