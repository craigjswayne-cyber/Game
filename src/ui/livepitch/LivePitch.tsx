// The live pitch on screen (2.0.0): the whole pitch, upright, never moving.
//
// Owner, 16 Nov 2026: "the moving camera tracker should not happen - i prefer
// the original style where you see the full pitch" and "stay vertical - its
// key for the phone". So: try line to try line up the screen, the home side
// attacking upwards, drawn once and left alone. The men and the ball come
// from sim.ts, which plays each line out in real time.

import { useEffect, useMemo, useRef } from 'react'
import type { MatchEvent } from '../../game/model'
import { readInk, isLight, refereeColour } from '../highlight/draw'
import { phaseAt } from './phase'
import { PitchSim } from './sim'

export interface PitchSide {
  /** the lineup by shirt index, as the engine holds it */
  lineup: (number | null)[]
  /** the number each man wears, by shirt index */
  nums: number[]
  /** fill and edge */
  kit: [string, string]
}

/** in-goal metres drawn each end, and the run-off round the outside */
const GOAL = 8, MARGIN = 3
const FIELD_L = 100 + GOAL * 2 + MARGIN * 2, FIELD_W = 70 + MARGIN * 2

export function LivePitch({ events, cursor, homeId, home, away, paused, names, onPlayed }: {
  events: MatchEvent[]
  cursor: number
  homeId: string
  home: PitchSide
  away: PitchSide
  paused?: boolean
  /** a man's name, for the tag over the man on the ball */
  names: (playerId: number) => string | undefined
  /** the newest line has been played out on the grass */
  onPlayed?: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const phase = useMemo(() => phaseAt(events, cursor, homeId), [events, cursor, homeId])
  const carrier = useMemo(() => {
    if (phase.carrier == null) return null
    const hi = home.lineup.indexOf(phase.carrier), ai = away.lineup.indexOf(phase.carrier)
    if (hi >= 0 && hi < 15) return { home: true, i: hi }
    if (ai >= 0 && ai < 15) return { home: false, i: ai }
    return null
  }, [phase, home.lineup, away.lineup])

  const sim = useRef<PitchSim>()
  if (!sim.current) sim.current = new PitchSim()
  const seen = useRef<{ at: number; cursor: number; told: boolean }>({ at: -99, cursor: -1, told: true })
  // a new line: a new play if it moves the picture, else it is already played
  if (seen.current.cursor !== cursor) {
    seen.current.cursor = cursor
    if (phase.at !== seen.current.at) {
      seen.current.at = phase.at
      sim.current.start(phase, carrier && carrier.home === phase.homeBall ? carrier.i : null)
    }
    seen.current.told = false
  }
  const io = useRef({ home, away, names, onPlayed, paused: !!paused, carrierId: phase.carrier })
  io.current = { home, away, names, onPlayed, paused: !!paused, carrierId: phase.carrier }

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const S = sim.current!
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ink = readInk()
    const refKit = refereeColour([...home.kit, ...away.kit], [ink.refPink, ink.refOrange, ink.refCyan])
    let raf = 0, last = performance.now(), acc = 0
    let dim = { w: 0, h: 0, dpr: 1, sc: 1, ox: 0, oy: 0 }
    const field = document.createElement('canvas')
    // the last frame before a cut, dissolved out over the new one
    const ghost = document.createElement('canvas')
    let seenCuts = S.cuts, dissolve = 0
    // field metres to screen: length up the screen (home attacks up), width across
    const PX = (y: number) => dim.ox + (y + MARGIN) * dim.sc
    const PY = (x: number) => dim.oy + (100 + GOAL + MARGIN - x) * dim.sc

    const paintField = () => {
      const { sc, dpr } = dim
      field.width = Math.round(FIELD_W * sc * dpr); field.height = Math.round(FIELD_L * sc * dpr)
      const g = field.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const fx = (y: number) => (y + MARGIN) * sc, fy = (x: number) => (100 + GOAL + MARGIN - x) * sc
      g.fillStyle = ink.surround; g.fillRect(0, 0, FIELD_W * sc, FIELD_L * sc)
      // mown stripes every ten metres up the pitch
      for (let i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? ink.grassB : ink.grassA
        g.fillRect(fx(0), fy(i * 10 + 10), 70 * sc, 10 * sc + 0.5)
      }
      g.fillStyle = ink.grassB
      g.fillRect(fx(0), fy(100 + GOAL), 70 * sc, GOAL * sc); g.fillRect(fx(0), fy(0), 70 * sc, GOAL * sc)
      g.fillStyle = 'rgba(0,0,0,.16)'
      g.fillRect(fx(0), fy(100 + GOAL), 70 * sc, GOAL * sc); g.fillRect(fx(0), fy(0), 70 * sc, GOAL * sc)
      g.strokeStyle = 'rgba(255,255,255,.86)'; g.lineWidth = Math.max(1.2, sc * 0.22)
      const across = (x: number, dash: number[] = [], y0 = 0, y1 = 70) => { g.setLineDash(dash); g.beginPath(); g.moveTo(fx(y0), fy(x)); g.lineTo(fx(y1), fy(x)); g.stroke() }
      across(0); across(100); across(22); across(78); across(50); across(-GOAL); across(100 + GOAL)
      across(40, [sc * 1.4, sc * 1.4]); across(60, [sc * 1.4, sc * 1.4])
      // the 5s and 15s, as the short dashes a real pitch has
      g.setLineDash([sc * 1.2, sc * 2.2])
      for (const y of [5, 15, 55, 65]) { g.beginPath(); g.moveTo(fx(y), fy(0)); g.lineTo(fx(y), fy(100)); g.stroke() }
      for (const x of [5, 95]) across(x, [sc * 1.2, sc * 2.2], 5, 65)
      g.setLineDash([])
      g.beginPath(); g.moveTo(fx(0), fy(-GOAL)); g.lineTo(fx(0), fy(100 + GOAL)); g.moveTo(fx(70), fy(-GOAL)); g.lineTo(fx(70), fy(100 + GOAL)); g.stroke()
      // the posts: the bar on the try line, the pads either end of it
      for (const x of [0, 100]) {
        g.strokeStyle = ink.white; g.lineWidth = Math.max(2.5, sc * 0.5)
        g.beginPath(); g.moveTo(fx(32.2), fy(x)); g.lineTo(fx(37.8), fy(x)); g.stroke()
        for (const y of [32.2, 37.8]) { g.beginPath(); g.arc(fx(y), fy(x), Math.max(2.5, sc * 0.55), 0, Math.PI * 2); g.fillStyle = ink.white; g.fill() }
      }
    }
    const size = () => {
      const w = cv.clientWidth, h = cv.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      const sc = Math.min(w / FIELD_W, h / FIELD_L)
      dim = { w, h, dpr, sc, ox: (w - FIELD_W * sc) / 2, oy: (h - FIELD_L * sc) / 2 }
      if (sc > 0) paintField()
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(cv)

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!io.current.paused) {
        acc += dt
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
      if (S.done && !seen.current.told) { seen.current.told = true; io.current.onPlayed?.() }
      draw()
      raf = requestAnimationFrame(frame)
    }

    const draw = () => {
      const g = cv.getContext('2d')!
      const { w, h, dpr, sc } = dim
      if (!sc) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = ink.surround; g.fillRect(0, 0, w, h)
      g.drawImage(field, dim.ox, dim.oy, FIELD_W * sc, FIELD_L * sc)
      const R = Math.max(7.5, sc * 1.7)
      const { home: H, away: A, names: N, carrierId } = io.current
      const flying = S.ball.lift > 0.4
      const dot = (i: number) => {
        const side = i < 15 ? H : A, k = i % 15
        const p = S.b[i]
        const x = PX(p.y), y = PY(p.x)
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
      // the side with the ball on top, the man with it last of all
      const top = S.phase?.homeBall === false ? 15 : 0
      for (const st of [15 - top, top]) for (let i = st; i < st + 15; i++) if (i !== S.holder) dot(i)
      // the referee: no number, the colour nobody wears
      g.beginPath(); g.arc(PX(S.ref.y), PY(S.ref.x), R * 0.78, 0, Math.PI * 2); g.fillStyle = refKit; g.fill()
      g.lineWidth = 1.4; g.strokeStyle = ink.dark; g.stroke()
      if (S.holder >= 0) dot(S.holder)

      // the ball: on the man's shoulder in hand, off its shadow in the air
      const br = Math.max(3.6, R * 0.5) * (1 + S.ball.lift * 0.03)
      const inHand = S.holder >= 0 && !flying
      const bx = PX(S.ball.y) + (inHand ? R * 0.7 : 0), by = PY(S.ball.x) - (inHand ? R * 0.6 : 0)
      if (!inHand) { g.beginPath(); g.ellipse(PX(S.ball.y), PY(S.ball.x) + 1.5, br * 0.9, br * 0.55, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill() }
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
            const lx = Math.max(tw / 2 + 2, Math.min(w - tw / 2 - 2, PX(p.y))), ly = PY(p.x) - R - 11
            g.fillStyle = 'rgba(10,14,20,.8)'
            g.beginPath(); g.roundRect(lx - tw / 2, ly - 8, tw, 16, 8); g.fill()
            g.fillStyle = ink.white; g.textAlign = 'center'; g.textBaseline = 'middle'
            g.fillText(label, lx, ly + 0.5)
          }
        }
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

  return (
    <div className="live-pitch" data-testid="live-pitch" data-phase={phase.kind}>
      <canvas ref={canvas} className="lp-canvas" />
    </div>
  )
}
