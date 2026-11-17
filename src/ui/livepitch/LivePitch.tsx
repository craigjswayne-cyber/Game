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
import { phaseAt, type Banner } from './phase'
import { PitchSim } from './sim'

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
const GOAL = 8, SIDE = 5.6, END = 11.5
const FIELD_L = 100 + GOAL * 2 + END * 2, FIELD_W = 70 + SIDE * 2

/** a stable 0..1 from two integers: the crowd is the same crowd every frame */
function h2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263 + 1013904223) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) % 10000) / 10000
}

export function LivePitch({ events, cursor, homeId, home, away, paused, names, onPlayed, tr, teams, boards, speed = 1 }: {
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
  /** the words: an lp.* key and its values */
  tr: (key: string, vars?: Record<string, string | number>) => string
  /** the two sides' short names */
  teams: { home: string; away: string }
  /** the names on the advertising boards (the game's invented sponsors) */
  boards?: string[]
}) {
  /** the banner on screen, once its moment has landed */
  const [banner, setBanner] = useState<Banner | null>(null)
  const bannerRef = useRef<{ want: Banner | null; shownAt: number }>({ want: null, shownAt: -1 })
  const canvas = useRef<HTMLCanvasElement>(null)
  const phase = useMemo(() => phaseAt(events, cursor, homeId), [events, cursor, homeId])
  bannerRef.current.want = phase.banner ?? null
  const carrier = useMemo(() => {
    if (phase.carrier == null) return null
    const hi = home.lineup.indexOf(phase.carrier), ai = away.lineup.indexOf(phase.carrier)
    if (hi >= 0 && hi < 15) return { home: true, i: hi }
    if (ai >= 0 && ai < 15) return { home: false, i: ai }
    return null
  }, [phase, home.lineup, away.lineup])

  const sim = useRef<PitchSim>()
  if (!sim.current) sim.current = new PitchSim()
  const seen = useRef<{ at: number; cursor: number; told: boolean; moved: boolean }>({ at: -99, cursor: -1, told: true, moved: false })
  // a new line: a new play if it moves the picture, else it is already played
  if (seen.current.cursor !== cursor) {
    seen.current.cursor = cursor
    seen.current.moved = phase.at !== seen.current.at
    if (phase.at !== seen.current.at) {
      seen.current.at = phase.at
      sim.current.start(phase, carrier && carrier.home === phase.homeBall ? carrier.i : null)
    }
    seen.current.told = false
  }
  const attackText = tr('lp.attack', { team: phase.homeBall ? teams.home : teams.away })
  const io = useRef({ home, away, names, onPlayed, paused: !!paused, carrierId: phase.carrier, attackText, boards, speed })
  io.current = { home, away, names, onPlayed, paused: !!paused, carrierId: phase.carrier, attackText, boards, speed }

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const S = sim.current!
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ink = readInk()
    const refKit = refereeColour([...home.kit, ...away.kit], [ink.refPink, ink.refOrange, ink.refCyan])
    let raf = 0, last = performance.now(), acc = 0
    // upright on a phone held upright; on its side when the box is wider than
    // it is tall (a phone turned over, a tablet's wide column): the same
    // picture turned a quarter, the home side then attacking to the right
    let dim = { w: 0, h: 0, dpr: 1, sc: 1, ox: 0, oy: 0, up: true }
    const field = document.createElement('canvas')
    // the last frame before a cut, dissolved out over the new one
    const ghost = document.createElement('canvas')
    let seenCuts = S.cuts, dissolve = 0
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
      g.fillStyle = '#12181c'; g.fillRect(0, 0, W, L)
      // the two end stands: rows of seats in the home colour, a crowd in them
      const stand = (top: boolean) => {
        const y0 = top ? 0 : fy(-GOAL - 4.6), hgt = (END - 4.6) * sc
        g.fillStyle = '#1b2329'; g.fillRect(0, y0, W, hgt)
        const rows = 5, rh = hgt / rows
        for (let r = 0; r < rows; r++) {
          g.fillStyle = hk[0]; g.globalAlpha = 0.5 + 0.08 * r
          g.fillRect(sc * 0.6, y0 + r * rh + rh * 0.18, W - sc * 1.2, rh * 0.64)
          g.globalAlpha = 1
          const n = Math.floor((W - sc * 1.2) / (sc * 0.95))
          for (let c = 0; c < n; c++) {
            const k = h2(c + (top ? 0 : 500), r)
            if (k < 0.2) continue
            g.fillStyle = k < 0.62 ? hk[0] : k < 0.8 ? ink.white : k < 0.9 ? ak[0] : hk[1]
            g.beginPath(); g.arc(sc * 0.6 + (c + 0.5) * sc * 0.95, y0 + r * rh + rh * 0.5, Math.max(1, sc * 0.3), 0, Math.PI * 2); g.fill()
          }
        }
        // the aisles
        g.fillStyle = '#1b2329'
        for (const a of [0.25, 0.5, 0.75]) g.fillRect(W * a - sc * 0.5, y0, sc, hgt)
      }
      stand(true); stand(false)
      // a strip of crowd down each touchline
      for (const left of [true, false]) {
        const x0 = left ? 0 : fx(70 + SIDE - 1.7)
        g.fillStyle = '#1b2329'; g.fillRect(x0, fy(100 + GOAL + 4.6), 1.7 * sc, (116 + 9.2) * sc)
        const n = Math.floor((116 + 9.2) / 1.0)
        for (let c = 0; c < n; c++) {
          const k = h2(c, left ? 77 : 99)
          if (k < 0.25) continue
          g.fillStyle = k < 0.65 ? hk[0] : k < 0.82 ? ink.white : k < 0.92 ? ak[0] : hk[1]
          g.beginPath(); g.arc(x0 + 0.85 * sc, fy(100 + GOAL + 4.6) + (c + 0.5) * sc, Math.max(1, sc * 0.32), 0, Math.PI * 2); g.fill()
        }
      }
      // the boards: along both touchlines (the names up the pitch) and both ends
      const boardFills = [hk[0], '#f4f1e6', '#16202a', hk[1]]
      const text = (label: string, cx: number, cy: number, size: number, fill: string, rot: number, maxW: number) => {
        g.save(); g.translate(cx, cy); g.rotate(rot)
        g.font = `800 ${size}px var(--cond, system-ui), system-ui, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = isLight(fill) ? '#141a1f' : '#f4f1e6'
        g.fillText(label.toUpperCase(), 0, 0.5, maxW); g.restore()
      }
      const panels = 6, pl = (116 + 3) / panels
      for (const left of [true, false]) {
        const bx = left ? fx(-1.4 - 2.4) : fx(71.4)
        for (let i = 0; i < panels; i++) {
          const fill = boardFills[(i + (left ? 0 : 2)) % boardFills.length]
          const y1 = fy(100 + GOAL + 1.5 - i * pl)
          g.fillStyle = fill; g.fillRect(bx, y1 + 0.5, 2.4 * sc, pl * sc - 1)
          text(names[(i * 2 + (left ? 0 : 1)) % names.length], bx + 1.2 * sc, y1 + pl * sc / 2, Math.max(6.5, sc * 1.55), fill, left ? -Math.PI / 2 : Math.PI / 2, pl * sc - 6)
        }
      }
      const ep = 3, ew = (70 + 2.8) / ep
      for (const top of [true, false]) {
        const by = top ? fy(100 + GOAL + 1.4 + 2.6) : fy(-GOAL - 1.4)
        for (let i = 0; i < ep; i++) {
          const fill = boardFills[(i + (top ? 1 : 3)) % boardFills.length]
          const x1 = fx(-1.4 + i * ew)
          g.fillStyle = fill; g.fillRect(x1 + 0.5, by, ew * sc - 1, 2.6 * sc)
          text(names[(i + (top ? 3 : 6)) % names.length], x1 + ew * sc / 2, by + 1.3 * sc, Math.max(7, sc * 1.7), fill, 0, ew * sc - 8)
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
      lg.addColorStop(0, 'rgba(255,255,235,.07)'); lg.addColorStop(1, 'rgba(0,0,0,.2)')
      g.fillStyle = lg; g.fillRect(fx(-1.4), fy(100 + GOAL + 1.4), 72.8 * sc, (116 + 2.8) * sc)

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
      // the posts, with their height: the uprights lean away from the eye and
      // throw a shadow, the bar hangs between them, the pads sit on the line
      for (const x of [0, 100]) {
        const lean = { dx: sc * 1.5, dy: -sc * 5.2 }
        g.lineCap = 'round'
        g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = Math.max(2, sc * 0.45)
        for (const y of [32.2, 37.8]) { g.beginPath(); g.moveTo(fx(y), fy(x)); g.lineTo(fx(y) + sc * 4.2, fy(x) + sc * 1.6); g.stroke() }
        g.strokeStyle = ink.white; g.lineWidth = Math.max(2, sc * 0.42)
        for (const y of [32.2, 37.8]) { g.beginPath(); g.moveTo(fx(y), fy(x)); g.lineTo(fx(y) + lean.dx, fy(x) + lean.dy); g.stroke() }
        g.beginPath(); g.moveTo(fx(32.2) + lean.dx * 0.3, fy(x) + lean.dy * 0.3); g.lineTo(fx(37.8) + lean.dx * 0.3, fy(x) + lean.dy * 0.3); g.stroke()
        for (const y of [32.2, 37.8]) { g.beginPath(); g.arc(fx(y), fy(x), Math.max(2.6, sc * 0.6), 0, Math.PI * 2); g.fillStyle = hk[0]; g.fill(); g.lineWidth = 1; g.strokeStyle = ink.white; g.stroke() }
        g.lineCap = 'butt'
      }
    }
    const size = () => {
      const w = cv.clientWidth, h = cv.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      const up = h >= w
      const sc = up ? Math.min(w / FIELD_W, h / FIELD_L) : Math.min(w / FIELD_L, h / FIELD_W)
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
        acc += dt * io.current.speed
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
      // the banner lands with the moment, not with the line
      const bw = bannerRef.current
      if (bw.want && S.landed && S.phase?.at === bw.want.at && bw.shownAt !== bw.want.at) {
        bw.shownAt = bw.want.at
        setBanner(bw.want)
        if ((bw.want.kind === 'try' || bw.want.kind === 'pentry') && !reduce) burst(S.ball.x, S.ball.y, bw.want.teamId === homeId)
      } else if (bw.shownAt !== -1 && (!bw.want || bw.want.at !== bw.shownAt) && !(bw.want && S.landed && S.phase?.at === bw.want.at)) { bw.shownAt = -1; setBanner(null) }
      for (const c of confetti) { c.vy += 26 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt; c.rot += c.spin * dt }
      confetti = confetti.filter(c => c.life > 0)
      if (S.done && !seen.current.told) { seen.current.told = true; io.current.onPlayed?.(seen.current.moved) }
      draw()
      raf = requestAnimationFrame(frame)
    }

    const draw = () => {
      const g = cv.getContext('2d')!
      const { w, h, dpr, sc } = dim
      if (!sc) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = '#12181c'; g.fillRect(0, 0, w, h)
      if (dim.up) g.drawImage(field, dim.ox, dim.oy, FIELD_W * sc, FIELD_L * sc)
      else {
        g.save(); g.translate(dim.ox + FIELD_L * sc, dim.oy); g.rotate(Math.PI / 2)
        g.drawImage(field, 0, 0, FIELD_W * sc, FIELD_L * sc); g.restore()
      }
      // who is attacking, written on the in-goal they are attacking
      {
        const up = S.phase?.homeBall !== false
        g.save()
        g.font = `800 ${Math.round(Math.max(10, sc * 3.1))}px var(--cond, system-ui), system-ui, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillStyle = 'rgba(255,255,255,.34)'
        const ax = up ? 100 + GOAL / 2 : -GOAL / 2
        g.translate(SX(ax, 35), SY(ax, 35) + 1)
        if (!dim.up) g.rotate(up ? Math.PI / 2 : -Math.PI / 2)
        g.fillText(io.current.attackText.toUpperCase(), 0, 0)
        g.restore()
      }
      const R = Math.max(8, sc * 1.9)
      const { home: H, away: A, names: N, carrierId } = io.current
      const flying = S.ball.lift > 0.4
      const dot = (i: number) => {
        const side = i < 15 ? H : A, k = i % 15
        const p = S.b[i]
        const x = SX(p.x, p.y), y = SY(p.x, p.y)
        const has = i === S.holder
        g.beginPath(); g.arc(x + R * 0.14, y + R * 0.24, R, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill()
        g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fillStyle = side.kit[0]; g.fill()
        g.lineWidth = has ? Math.max(2.4, R * 0.3) : Math.max(1.3, R * 0.17)
        g.strokeStyle = has ? ink.white : side.kit[1]; g.stroke()
        g.fillStyle = isLight(side.kit[0]) ? ink.dark : ink.white
        g.font = `800 ${Math.round(R * 1.08)}px system-ui, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(String(side.nums[k] ?? k + 1), x, y + 0.5)
      }
      // the lines being run on to the ball: a dashed arrow to where he will take it
      g.save()
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.fillStyle = 'rgba(255,255,255,.8)'; g.lineWidth = Math.max(1.6, sc * 0.3); g.setLineDash([sc * 1.1, sc * 0.9]); g.lineCap = 'round'
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
      for (const st of [15 - top, top]) for (let i = st; i < st + 15; i++) if (i !== S.holder) dot(i)
      // the referee: no number, the colour nobody wears
      g.beginPath(); g.arc(SX(S.ref.x, S.ref.y), SY(S.ref.x, S.ref.y), R * 0.78, 0, Math.PI * 2); g.fillStyle = refKit; g.fill()
      g.lineWidth = 1.4; g.strokeStyle = ink.dark; g.stroke()
      if (S.holder >= 0) dot(S.holder)

      // the ball: on the man's shoulder in hand, off its shadow in the air
      const br = Math.max(3.6, R * 0.5) * (1 + S.ball.lift * 0.03)
      const inHand = S.holder >= 0 && !flying
      const bx = SX(S.ball.x, S.ball.y) + (inHand ? R * 0.7 : 0), by = SY(S.ball.x, S.ball.y) - (inHand ? R * 0.6 : 0)
      if (!inHand) { g.beginPath(); g.ellipse(SX(S.ball.x, S.ball.y), SY(S.ball.x, S.ball.y) + 1.5, br * 0.9, br * 0.55, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill() }
      g.beginPath(); g.ellipse(bx, by - S.ball.lift * sc * 0.45, br * 0.72, br, 0.5, 0, Math.PI * 2)
      g.fillStyle = ink.ball; g.fill(); g.lineWidth = 1; g.strokeStyle = ink.ballEdge; g.stroke()

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
  }, [home.kit[0], home.kit[1], away.kit[0], away.kit[1]])

  // the chip says what the play is; a plain carry or tackle says nothing
  const quiet = phase.kind === 'carry' || phase.label === 'lp.tackle' || phase.label === 'lp.ruck' || phase.kind === 'try' || phase.kind === 'con' || phase.kind === 'goal'
  // a called move is named, whatever the play (the reference names its moves)
  const cap = (x: string) => x.charAt(0).toLocaleUpperCase() + x.slice(1)
  const chip = phase.move && phase.kind !== 'try' ? cap(tr(phase.move)) : quiet ? '' : tr(phase.label, phase.n != null ? { n: phase.n } : undefined)
  const bSide = banner ? (banner.teamId === homeId ? home : away) : null
  const good = banner && (banner.kind === 'try' || banner.kind === 'pentry' || banner.kind === 'con' || banner.kind === 'pen' || banner.kind === 'dg')
  const pts = banner ? ({ try: 5, pentry: 7, con: 2, pen: 3, dg: 3 } as Record<string, number>)[banner.kind] : undefined
  return (
    <div className="live-pitch" data-testid="live-pitch" data-phase={phase.kind}>
      <canvas ref={canvas} className="lp-canvas" />
      {chip && <div className="lp-chip" key={`c${phase.at}`}><i style={{ background: (phase.homeBall ? home : away).kit[0] }} />{chip}</div>}
      {banner && bSide && (
        <div className={`lp-banner ${banner.kind}${good ? ' good' : ''}`} key={`b${banner.at}`} data-testid="lp-banner">
          {pts != null && <em>+{pts}</em>}
          <b>{tr(`lp.b.${banner.kind}`)}</b>
          <span><i style={{ background: bSide.kit[0], borderColor: bSide.kit[1] }} />
            {banner.teamId === homeId ? teams.home : teams.away}{banner.name ? ` · ${banner.name}` : ''} · {Math.min(80, banner.min)}'</span>
        </div>
      )}
    </div>
  )
}
