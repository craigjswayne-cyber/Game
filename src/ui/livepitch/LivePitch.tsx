// The live pitch on screen (2.0.0): the whole pitch, upright, never moving.
//
// Owner, 16 Nov 2026: "the moving camera tracker should not happen - i prefer
// the original style where you see the full pitch" and "stay vertical - its
// key for the phone". So: try line to try line up the screen, the home side
// attacking upwards, drawn once and left alone. The men and the ball come
// from sim.ts, which plays each line out in real time.

import { useEffect, useMemo, useRef, useState } from 'react'
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
/** the least ground drawn round the pitch; the rest of the box is filled with
 *  more stand, so the ground runs off the edge of the screen as a real one does */
const SIDE_MIN = 6.6, END_MIN = 5.5
let SIDE = SIDE_MIN, END = END_MIN
let FIELD_L = 100 + GOAL * 2 + END * 2, FIELD_W = 70 + SIDE * 2

/** the verdict's type size: full size for TRY, smaller the longer the word */
function bannerSize(label: string, good: boolean): { fontSize: string } {
  const full = good ? 3.1 : 2.2
  return { fontSize: `${Math.max(1.15, Math.min(full, 19.5 / Math.max(1, label.length))).toFixed(2)}rem` }
}

/** a stable 0..1 from two integers: the crowd is the same crowd every frame */
function h2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263 + 1013904223) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) % 10000) / 10000
}

export function LivePitch({ events, cursor, homeId, home, away, paused, names, onPlayed, tr, teams, boards, speed = 1, realTime = false, tactics, night = true }: {
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
  const io = useRef({ home, away, names, onPlayed, paused: !!paused, carrierId: phase.carrier as number | undefined, attackText, boards, speed, realTime, ahead, aheadIdx: ahead ? carrierOf(ahead) : null })
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
  io.current = { home, away, names, onPlayed, paused: !!paused, carrierId: (sim.current.phase ?? phase).carrier, attackText, boards, speed, realTime, ahead, aheadIdx: ahead ? carrierOf(ahead) : null }

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
    let dim = { w: 0, h: 0, dpr: 1, sc: 1, ox: 0, oy: 0, up: true }
    const field = document.createElement('canvas')
    // the last frame before a cut, dissolved out over the new one
    const ghost = document.createElement('canvas')
    let grassSeen: Phase | null = null
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
    const SX = (x: number, y: number) => dim.up ? dim.ox + (y + SIDE) * dim.sc : dim.ox + (x + GOAL + END) * dim.sc
    const SY = (x: number, y: number) => dim.up ? dim.oy + (100 + GOAL + END - x) * dim.sc : dim.oy + (y + SIDE) * dim.sc

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
      const seatCol = lum(hk[0]) > 0.17 ? hk[0] : lum(hk[1]) > 0.17 ? hk[1] : lp.light
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
            if (k < 0.16) continue
            g.fillStyle = k < 0.55 ? hk[1] : k < 0.8 ? ink.white : k < 0.92 ? ak[0] : hk[0]
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
        if (rows >= 4) {
          const rd = depth * roofFrac
          // the dark under the roof, where the back rows are in its shadow
          g.fillStyle = 'rgba(0,0,0,.42)'
          const sh = Math.min(depth - rd, sc * 2.2)
          if (out === 'u') g.fillRect(x, y + rd, w, sh); else if (out === 'd') g.fillRect(x, y + h - rd - sh, w, sh)
          else if (out === 'l') g.fillRect(x + rd, y, sh, h); else g.fillRect(x + w - rd - sh, y, sh, h)
          const ox = out === 'l' ? x : out === 'r' ? x + w - rd : x, oy = out === 'u' ? y : out === 'd' ? y + h - rd : y
          // a solid roof, seen from above: grey sheeting, a fascia in the club colour along its front
          g.fillStyle = 'rgba(46,54,66,.97)'
          if (alongX) g.fillRect(ox, oy, w, rd); else g.fillRect(ox, oy, rd, h)
          g.fillStyle = hk[0]
          const fw = Math.max(2, sc * 0.7)
          if (out === 'u') g.fillRect(x, y + rd - fw, w, fw); else if (out === 'd') g.fillRect(x, y + h - rd, w, fw)
          else if (out === 'l') g.fillRect(x + rd - fw, y, fw, h); else g.fillRect(x + w - rd, y, fw, h)
          g.fillStyle = 'rgba(255,255,255,.5)'
          if (out === 'u') g.fillRect(x, y + rd - 1, w, 1.2); else if (out === 'd') g.fillRect(x, y + h - rd, w, 1.2)
          else if (out === 'l') g.fillRect(x + rd - 1, y, 1.2, h); else g.fillRect(x + w - rd, y, 1.2, h)
          // white trusses across the roof and a beam along it, as the reference has
          g.fillStyle = 'rgba(255,255,255,.34)'
          const truss = Math.max(12, sc * 7), tw2 = Math.max(1, sc * 0.24)
          for (let a = truss * 0.5; a < len; a += truss) { if (alongX) g.fillRect(x + a, oy, tw2, rd); else g.fillRect(ox, y + a, rd, tw2) }
          if (alongX) g.fillRect(x, oy + rd * 0.45, w, tw2); else g.fillRect(ox + rd * 0.45, y, tw2, h)
        }
      }
      const pitchT = fy(100 + GOAL), pitchB = fy(-GOAL), pitchL = fx(0), pitchR = fx(70)
      const boardW = 2.3 * sc, off = 1.5 * sc
      // down each touchline: run-off, boards, then the stand out to the edge.
      // On its side the camera is behind the near stand: that one is mostly
      // roof, seen from behind, with only its front rows showing.
      seating(0, pitchT, pitchL - off - boardW - sc * 0.5, pitchB - pitchT, 'l', 1, 0.42)
      seating(pitchR + off + boardW + sc * 0.5, pitchT, W - (pitchR + off + boardW + sc * 0.5), pitchB - pitchT, 'r', 2, dim.up ? 0.42 : 0.8)
      // BEHIND EACH GOAL, A STAND THAT RISES (owner, 17 Nov 2026, of the
      // reference: "All of those on stadium", stands "at the left and right
      // ends"). Seen at the tilt its back rows are higher up the screen than
      // its front ones, so it leans, and the end wall nearest the camera shows.
      {
        const rise = dim.up ? 0 : 0.45
        const wall = 'rgba(62,70,84,1)'
        const eT = pitchT - sc * 2.4, eB = pitchB + sc * 2.4
        g.save(); g.transform(1, 0, rise, 1, -rise * eT, 0)
        seating(pitchL, 0, pitchR - pitchL, eT, 'u', 3, 0.34)
        g.restore()
        g.save(); g.transform(1, 0, -rise, 1, rise * eB, 0)
        seating(pitchL, eB, pitchR - pitchL, L - eB, 'd', 4, 0.34)
        g.restore()
        if (rise > 0) {
          g.fillStyle = wall
          g.beginPath(); g.moveTo(pitchR, eT); g.lineTo(pitchR, 0); g.lineTo(pitchR - rise * eT, 0); g.closePath(); g.fill()
          g.beginPath(); g.moveTo(pitchR, eB); g.lineTo(pitchR, L); g.lineTo(pitchR - rise * (L - eB), L); g.closePath(); g.fill()
        }
      }
      // THE BENCHES (owner: "Benches for home and away teams"): a dugout each
      // side of halfway on the far touchline, in front of the stand, the
      // replacements sitting in it in their own colours, and the technical
      // area marked on the run-off in front
      // (owner, 17 Nov 2026: "Lets build them then": the reference's glass
      // dugouts, the replacements 16 to 23 sitting in them, a coach standing
      // in the technical area)
      for (const [mid, kit] of [[37, hk], [63, ak]] as [number, [string, string]][]) {
        const y0 = fy(mid + 8), len = 16 * sc
        const bw = sc * 4.4, bx = pitchL - off - boardW - bw - sc * 0.3
        // its shadow on the stand front, then the floor and the back wall
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(bx - sc * 0.5, y0 + sc * 0.5, bw, len)
        g.fillStyle = 'rgba(22,27,35,1)'; g.fillRect(bx, y0, bw, len)
        g.fillStyle = 'rgba(232,236,242,1)'; g.fillRect(bx, y0, sc * 0.5, len)
        g.fillRect(bx, y0, bw, sc * 0.35); g.fillRect(bx, y0 + len - sc * 0.35, bw, sc * 0.35)
        // the replacements, 16 to 23, in their own colours
        const rr = Math.max(2.2, sc * 0.82)
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
        g.strokeRect(pitchL - off + sc * 0.15, y0 + len * 0.2, off - sc * 0.4, len * 0.6); g.setLineDash([])
        const kx = pitchL - off * 0.5, ky = y0 + len * (mid < 50 ? 0.62 : 0.38), kr = Math.max(2.4, sc * 0.9)
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(kx + kr * 0.25, ky + kr * 0.35, kr, 0, Math.PI * 2); g.fill()
        g.fillStyle = 'rgba(26,32,44,1)'; g.beginPath(); g.arc(kx, ky, kr, 0, Math.PI * 2); g.fill()
        g.strokeStyle = lum(kit[0]) > 0.17 ? kit[0] : kit[1]; g.lineWidth = Math.max(1, sc * 0.26); g.stroke()
      }
      // trees in the four corners, overhanging the ends of the stands
      for (const [cx, cy, sd] of [[0, 0, 11], [W, 0, 23], [0, L, 37], [W, L, 51]] as [number, number, number][]) {
        const reach = Math.min(Math.max(pitchL - off - boardW, sc * 5), Math.max(pitchT, sc * 5)) * 1.3
        for (let t = 0; t < 6; t++) {
          const a = h2(t, sd) * Math.PI * 2, rr = h2(t, sd + 1) * reach
          const tx = cx + Math.cos(a) * rr * (cx === 0 ? 1 : -1) * 0.9, ty = cy + Math.sin(a) * rr * (cy === 0 ? 1 : -1) * 0.9
          const rad = Math.max(5, sc * (2.2 + h2(t, sd + 2) * 2.4))
          g.fillStyle = ink.grassB; g.beginPath(); g.arc(Math.abs(tx - cx) * (cx === 0 ? 1 : -1) + cx, Math.abs(ty - cy) * (cy === 0 ? 1 : -1) + cy, rad, 0, Math.PI * 2); g.fill()
          g.fillStyle = `rgba(0,0,0,${(0.28 + h2(t, sd + 3) * 0.3).toFixed(2)})`; g.fill()
          // the light catching the top of the crown
          g.fillStyle = 'rgba(190,255,190,.13)'; g.beginPath(); g.arc(Math.abs(tx - cx) * (cx === 0 ? 1 : -1) + cx - rad * 0.3, Math.abs(ty - cy) * (cy === 0 ? 1 : -1) + cy - rad * 0.1, rad * 0.55, 0, Math.PI * 2); g.fill()
        }
      }
      // night: the stands sit back in the dark, lit by what spills off the pitch
      if (night) { g.fillStyle = 'rgba(0,6,20,.38)'; g.fillRect(0, 0, W, L) }
      // by day the sun is on the far stand and the near one is in its own shade
      else {
        g.save(); g.globalCompositeOperation = 'screen'
        const dg = g.createLinearGradient(0, 0, W, 0); dg.addColorStop(0, 'rgba(205,215,215,.62)'); dg.addColorStop(1, 'rgba(150,170,190,.4)')
        g.fillStyle = dg; g.fillRect(0, 0, W, L); g.restore()
      }
      // a floodlight in each corner: the lamp head and the light it throws
      for (const [cx, cy] of [[pitchL - off, pitchT - sc * 1.5], [pitchR + off, pitchT - sc * 1.5], [pitchL - off, pitchB + sc * 1.5], [pitchR + off, pitchB + sc * 1.5]] as [number, number][]) {
        if (night) {
          const glow = g.createRadialGradient(cx, cy, 0, cx, cy, sc * 16)
          glow.addColorStop(0, 'rgba(255,252,225,.42)'); glow.addColorStop(1, 'rgba(255,252,225,0)')
          g.fillStyle = glow; g.fillRect(cx - sc * 16, cy - sc * 16, sc * 32, sc * 32)
        }
        g.fillStyle = ink.white; g.beginPath(); g.arc(cx, cy, Math.max(2, sc * 0.8), 0, Math.PI * 2); g.fill()
      }
      // the boards: down both touchlines, and nowhere else
      const boardFills = [hk[0], lp.light, lp.dark, hk[1]]
      const text = (label: string, cx: number, cy: number, size: number, fill: string, rot: number, maxW: number) => {
        g.save(); g.translate(cx, cy); g.rotate(rot)
        g.font = `800 ${size}px var(--cond, system-ui), system-ui, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = isLight(fill) ? lp.boardInk : lp.light
        g.fillText(label.toUpperCase(), 0, 0.5, maxW); g.restore()
      }
      const panels = 6, pl = 116 / panels
      for (const left of [true, false]) {
        const bx = left ? pitchL - off - boardW : pitchR + off
        for (let i = 0; i < panels; i++) {
          const fill = boardFills[(i + (left ? 0 : 2)) % boardFills.length]
          const y1 = fy(100 + GOAL - i * pl)
          g.fillStyle = fill; g.fillRect(bx, y1 + 0.5, boardW, pl * sc - 1)
          text(names[(i * 2 + (left ? 0 : 1)) % names.length], bx + boardW / 2, y1 + pl * sc / 2, Math.max(6.5, sc * 1.5), fill, left || !dim.up ? -Math.PI / 2 : Math.PI / 2, pl * sc - 6)
        }
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
      for (let i = 0; i < 10; i++) if (i % 2) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(fx(i * 7), fy(100 + GOAL), 7 * sc, 116 * sc) }
      for (const [bx, by, br, a] of [[20, 30, 30, 0.2], [52, 78, 26, 0.16], [8, 96, 22, 0.14], [60, 12, 24, 0.15]] as [number, number, number, number][]) {
        const sg = g.createRadialGradient(fx(bx), fy(by), 0, fx(bx), fy(by), br * sc)
        sg.addColorStop(0, `rgba(0,14,8,${a})`); sg.addColorStop(1, 'rgba(0,14,8,0)')
        g.fillStyle = sg; g.fillRect(fx(bx) - br * sc, fy(by) - br * sc, br * sc * 2, br * sc * 2)
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
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
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
      dim = { w, h, dpr, sc, up, ox: (w - (up ? FIELD_W : FIELD_L) * sc) / 2, oy: (h - (up ? FIELD_L : FIELD_W) * sc) / 2 }
      if (sc > 0) paintField()
    }
    size()
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
        ffShown += ((rate >= 1.6 && !S.done ? 1 : 0) - ffShown) * Math.min(1, dt * 8)
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
      const g = cv.getContext('2d')!
      const { w, h, dpr, sc } = dim
      if (!sc) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = lp.ground; g.fillRect(0, 0, w, h)
      if (dim.up) g.drawImage(field, dim.ox, dim.oy, FIELD_W * sc, FIELD_L * sc)
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
          for (const x of [22, 50, 78]) for (const y of [-1.6, 71.6]) fl.push([x, y])
          const Hf = sc * 2.6
          for (const [x, y] of fl) {
            const px = SX(x, y), py = SY(x, y)
            g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = Math.max(1, sc * 0.3)
            g.beginPath(); g.moveTo(px, py); g.lineTo(px + Hf * 0.5, py + sc * 0.35); g.stroke()
            g.strokeStyle = ink.white; g.lineWidth = Math.max(1, sc * 0.26)
            g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - Hf); g.stroke()
            g.fillStyle = io.current.home.kit[1]
            g.beginPath(); g.moveTo(px, py - Hf); g.lineTo(px + sc * 1.2, py - Hf * 0.82); g.lineTo(px, py - Hf * 0.62); g.closePath(); g.fill()
          }
        }
      }
      // (the side attacking each end used to be written across its in-goal; the
      // owner did not like it, 17 Nov 2026, and the pitch is cleaner without)
      // (smaller than they were: the reference draws a man about a metre and a
      // half across and lets a pack overlap)
      const R0 = Math.max(6.5, sc * 1.45)
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
        sz[i] += ((S.bound(i) || floor ? 0.74 : up2[0] === i || up2[1] === i ? 1.24 : 1) - sz[i]) * 0.18
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
        g.fillText(String(side.nums[k] ?? k + 1), x, y + 0.5)
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
      if (dissolve > 0 && ghost.width) {
        g.setTransform(1, 0, 0, 1, 0, 0)
        g.globalAlpha = dissolve * dissolve * (3 - 2 * dissolve)
        g.drawImage(ghost, 0, 0)
        g.globalAlpha = 1
      }
    }

    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [home.kit[0], home.kit[1], away.kit[0], away.kit[1], night])

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
