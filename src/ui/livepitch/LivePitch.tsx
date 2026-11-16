// The live pitch on screen (2.0.0): the canvas, its camera and its clock.
//
// The shape comes from phase.ts and shapes.ts; this only moves the men there.
// Each new line sets new targets and everyone eases towards them over about a
// beat of commentary, so the picture never jumps. The camera follows the ball
// at about fifty metres across (owner's second reference clip: the numbers
// have to read on a phone), and stands back for a kick-off or a long kick.

import { useEffect, useMemo, useRef } from 'react'
import type { MatchEvent } from '../../game/model'
import { readInk, isLight, refereeColour } from '../highlight/draw'
import { phaseAt, type Phase } from './phase'
import { shapeOf, type Pt, type Shape } from './shapes'

export interface PitchSide {
  /** the lineup by shirt index, as the engine holds it */
  lineup: (number | null)[]
  /** the number each man wears, by shirt index */
  nums: number[]
  /** fill and edge */
  kit: [string, string]
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** a small stable wobble per man per phase, so a line is never a ruler */
function jit(i: number, at: number, salt: number): number {
  let h = ((i + 1) * 374761393 + (at + 7) * 668265263 + salt * 2246822519) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h % 1000) / 1000 - 0.5)
}

export function LivePitch({ events, cursor, homeId, home, away, beatMs, paused, names }: {
  events: MatchEvent[]
  cursor: number
  homeId: string
  home: PitchSide
  away: PitchSide
  /** how long a line stays up at the current speed, so the men arrive in time */
  beatMs: number
  paused?: boolean
  /** a man's name, for the tag over the man on the ball */
  names: (playerId: number) => string | undefined
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const phase = useMemo(() => phaseAt(events, cursor, homeId), [events, cursor, homeId])

  // who the line names, and which side he plays for
  const carrier = useMemo(() => {
    if (phase.carrier == null) return null
    const hi = home.lineup.indexOf(phase.carrier), ai = away.lineup.indexOf(phase.carrier)
    if (hi >= 0 && hi < 15) return { home: true, i: hi }
    if (ai >= 0 && ai < 15) return { home: false, i: ai }
    return null
  }, [phase, home.lineup, away.lineup])

  const shape = useMemo<Shape>(() => {
    // the carrier's index counts only if he plays for the side with the ball
    const idx = carrier && carrier.home === phase.homeBall ? carrier.i : null
    return shapeOf(phase, idx)
  }, [phase, carrier])

  // the live state the animation loop reads, kept out of React
  const live = useRef({ phase, shape, beatMs, paused: !!paused, changedAt: 0 })
  useEffect(() => {
    live.current.phase = phase
    live.current.shape = shape
    live.current.changedAt = performance.now()
  }, [phase, shape])
  live.current.beatMs = beatMs
  live.current.paused = !!paused

  const sides = useRef({ home, away, names })
  sides.current = { home, away, names }

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ink = readInk()
    const refKit = refereeColour([...home.kit, ...away.kit], [ink.refPink, ink.refOrange, ink.refCyan])

    // where everything is now, in field metres; starts on the target
    const s0 = live.current.shape
    const pos: Pt[] = [...s0.home, ...s0.away].map(p => ({ ...p }))
    const refPos: Pt = { ...s0.ref }
    const ball: Pt & { lift: number } = { ...s0.ball, lift: 0 }
    const cam = { x: s0.ball.x, y: 35, w: 56 }
    let flight: { from: Pt; to: Pt; hang: number; t0: number; dur: number; at: number } | null = null
    let seenAt = live.current.phase.at
    let raf = 0, last = performance.now()

    let dim = { w: 0, h: 0, dpr: 1 }
    const size = () => {
      const w = cv.clientWidth, h = cv.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      dim = { w, h, dpr }
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(cv)

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const L = live.current
      const P = L.phase, S = L.shape
      const beat = Math.max(0.25, L.beatMs / 1000)
      // a new phase: a kick leaves the boot from where the ball is now
      if (P.at !== seenAt) {
        seenAt = P.at
        if ((P.kind === 'kick' || P.kind === 'kickoff' || P.kind === 'dropout' || P.kind === 'con' || P.kind === 'goal') && P.to) {
          const from = P.kind === 'kick' ? { x: ball.x, y: ball.y } : { x: P.x, y: P.y }
          if (P.kind !== 'kick') { ball.x = P.x; ball.y = P.y }
          flight = { from, to: P.to, hang: P.hang ?? 12, t0: now, dur: Math.min(1.4, Math.max(0.5, beat * 0.85)) * 1000, at: P.at }
        } else flight = null
      }
      const step = L.paused ? 0 : dt
      // the men: ease towards the target, quicker at a quicker pace
      const rate = reduce ? 1e3 : 3.6 / beat
      const k = 1 - Math.exp(-step * rate)
      const tgt = [...S.home, ...S.away]
      for (let i = 0; i < 30; i++) {
        const t = tgt[i]
        const tx = t.x + jit(i, P.at, 1) * 1.2, ty = t.y + jit(i, P.at, 2) * 1.2
        pos[i].x += (tx - pos[i].x) * k
        pos[i].y += (ty - pos[i].y) * k
      }
      refPos.x += (S.ref.x - refPos.x) * k
      refPos.y += (S.ref.y - refPos.y) * k
      // the ball: in the air, in a man's hands, or on the floor at the ruck
      if (flight && flight.at === P.at) {
        const f = reduce ? 1 : clamp((now - flight.t0) / flight.dur, 0, 1)
        const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2
        ball.x = flight.from.x + (flight.to.x - flight.from.x) * e
        ball.y = flight.from.y + (flight.to.y - flight.from.y) * e
        ball.lift = Math.sin(Math.PI * f) * flight.hang
      } else {
        const h = S.holder
        const want = h ? pos[(h.home ? 0 : 15) + h.i] : S.ball
        const kb = h ? 1 : k
        ball.x += (want.x - ball.x) * kb
        ball.y += (want.y - ball.y) * kb
        ball.lift = 0
      }
      // the camera: on the ball, wider for kicks and restarts
      const wide = P.kind === 'kick' || P.kind === 'kickoff' || P.kind === 'dropout' || P.kind === 'break'
      const flightMid = flight && flight.at === P.at ? { x: (flight.from.x + flight.to.x) / 2, y: (flight.from.y + flight.to.y) / 2 } : null
      const cx = flightMid ? flightMid.x : ball.x
      const cw = wide ? 74 : P.kind === 'con' || P.kind === 'goal' ? 62 : 52
      const kc = reduce ? 1 : 1 - Math.exp(-dt * 2.2)
      cam.x += (cx - cam.x) * kc
      cam.y += ((flightMid ? flightMid.y : ball.y) - cam.y) * kc
      cam.w += (cw - cam.w) * kc
      draw(P, S)
      raf = requestAnimationFrame(frame)
    }

    const draw = (P: Phase, S: Shape) => {
      const g = cv.getContext('2d')!
      const { w, h, dpr } = dim
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      // metres to pixels: cam.w metres across the canvas, never showing more
      // of the stands than the pitch needs
      const sc = w / cam.w
      const viewH = h / sc
      const cxm = clamp(cam.x, -12 + cam.w / 2, 112 - cam.w / 2)
      const cym = clamp(cam.y, -8 + viewH / 2, 78 - viewH / 2)
      const X = (x: number) => (x - cxm) * sc + w / 2
      const Y = (y: number) => (y - cym) * sc + h / 2

      g.fillStyle = ink.surround; g.fillRect(0, 0, w, h)
      // grass: mown stripes every ten metres, the in-goals a shade darker
      for (let i = -1; i < 11; i++) {
        g.fillStyle = i % 2 ? ink.grassB : ink.grassA
        g.fillRect(X(i * 10), Y(-3), 10 * sc + 1, 76 * sc)
      }
      g.fillStyle = 'rgba(0,0,0,.14)'
      g.fillRect(X(-10), Y(-3), 10 * sc, 76 * sc); g.fillRect(X(100), Y(-3), 10 * sc, 76 * sc)
      // the lines
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1.2, sc * 0.16)
      const vline = (x: number, dash: number[] = []) => { g.setLineDash(dash); g.beginPath(); g.moveTo(X(x), Y(0)); g.lineTo(X(x), Y(70)); g.stroke() }
      vline(0); vline(100); vline(22); vline(78); vline(50); vline(-10); vline(110)
      vline(40, [sc * 1.2, sc * 1.2]); vline(60, [sc * 1.2, sc * 1.2]); vline(5, [sc * 0.6, sc * 1.2]); vline(95, [sc * 0.6, sc * 1.2])
      g.setLineDash([sc * 1, sc * 1.6])
      for (const y of [5, 15, 55, 65]) { g.beginPath(); g.moveTo(X(-10), Y(y)); g.lineTo(X(110), Y(y)); g.stroke() }
      g.setLineDash([])
      g.beginPath(); g.moveTo(X(-10), Y(0)); g.lineTo(X(110), Y(0)); g.moveTo(X(-10), Y(70)); g.lineTo(X(110), Y(70)); g.stroke()
      // the posts, with a little height: the uprights lean away from the camera
      for (const x of [0, 100]) {
        const up = sc * 2.2
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = Math.max(2, sc * 0.35)
        g.beginPath(); g.moveTo(X(x), Y(32.2)); g.lineTo(X(x) + up * 0.9, Y(32.2) + up * 0.5); g.moveTo(X(x), Y(37.8)); g.lineTo(X(x) + up * 0.9, Y(37.8) + up * 0.5); g.stroke()
        g.strokeStyle = ink.white; g.lineWidth = Math.max(2, sc * 0.3)
        g.beginPath(); g.moveTo(X(x), Y(32.2)); g.lineTo(X(x), Y(37.8)); g.stroke()
        g.beginPath(); g.moveTo(X(x), Y(32.2)); g.lineTo(X(x) - up * 0.5, Y(32.2) - up); g.moveTo(X(x), Y(37.8)); g.lineTo(X(x) - up * 0.5, Y(37.8) - up); g.stroke()
      }

      const R = clamp(sc * 1.25, 7, 15)
      const { home: H, away: A, names: N } = sides.current
      const holderIdx = S.holder ? (S.holder.home ? 0 : 15) + S.holder.i : -1
      const flying = ball.lift > 0.3
      const dot = (i: number) => {
        const home = i < 15, k = home ? i : i - 15
        const side = home ? H : A
        const p = pos[i]
        const x = X(p.x), y = Y(p.y)
        const hasBall = i === holderIdx && !flying
        g.beginPath(); g.arc(x + R * 0.12, y + R * 0.22, R, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill()
        g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fillStyle = side.kit[0]; g.fill()
        g.lineWidth = hasBall ? Math.max(2.5, R * 0.28) : Math.max(1.4, R * 0.16)
        g.strokeStyle = hasBall ? ink.white : side.kit[1]; g.stroke()
        g.fillStyle = isLight(side.kit[0]) ? ink.dark : ink.white
        g.font = `800 ${Math.round(R * 1.05)}px system-ui, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(String(side.nums[k] ?? k + 1), x, y + 0.5)
      }
      // the side without the ball underneath, so the carrier is always on top
      const order = S.holder?.home === false ? [0, 15] : [15, 0]
      for (const start of order) for (let i = start; i < start + 15; i++) if (i !== holderIdx) dot(i)
      if (holderIdx >= 0) dot(holderIdx)

      // the referee: no number, the colour nobody wears
      g.beginPath(); g.arc(X(refPos.x), Y(refPos.y), R * 0.8, 0, Math.PI * 2); g.fillStyle = refKit; g.fill()
      g.lineWidth = 1.5; g.strokeStyle = ink.dark; g.stroke()

      // the ball, lifted off its shadow in the air
      const br = Math.max(4, R * 0.5) * (1 + ball.lift * 0.025)
      const bx = holderIdx >= 0 && !flying ? X(pos[holderIdx].x) + R * 0.65 : X(ball.x)
      const by = holderIdx >= 0 && !flying ? Y(pos[holderIdx].y) - R * 0.55 : Y(ball.y)
      g.beginPath(); g.ellipse(X(ball.x), Y(ball.y) + 2, br * 0.9, br * 0.5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill()
      g.beginPath(); g.ellipse(bx, by - ball.lift * sc * 0.35, br, br * 0.68, -0.5, 0, Math.PI * 2)
      g.fillStyle = ink.ball; g.fill(); g.lineWidth = 1; g.strokeStyle = ink.ballEdge; g.stroke()

      // the man on the ball, by name
      if (holderIdx >= 0 && !flying && P.carrier != null) {
        const nm = N(P.carrier)
        if (nm) {
          const p = pos[holderIdx]
          const label = nm.split(' ').slice(-1)[0]
          g.font = `700 ${Math.round(clamp(R * 0.9, 10, 13))}px system-ui, sans-serif`
          const tw = g.measureText(label).width + 10
          const lx = X(p.x), ly = Y(p.y) - R - 10
          g.fillStyle = 'rgba(10,14,20,.78)'
          g.beginPath(); g.roundRect(lx - tw / 2, ly - 9, tw, 18, 9); g.fill()
          g.fillStyle = ink.white; g.textAlign = 'center'; g.textBaseline = 'middle'
          g.fillText(label, lx, ly + 0.5)
        }
      }
    }

    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [home.kit[0], home.kit[1], away.kit[0], away.kit[1]])

  return (
    <div className="live-pitch" data-testid="live-pitch" data-phase={phase.kind}>
      <canvas ref={canvas} className="lp-canvas" />
    </div>
  )
}
