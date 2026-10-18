// The highlight on screen: the canvas, its clock, and the banner caption.

import { useEffect, useRef, useState } from 'react'
import { bakeOf, frameAt } from './bake'
import { drawField, FIELD_W, isLight, PAD, readInk, refereeColour } from './draw'
import { clamp, type Pt } from './geometry'
import type { ClipSpec } from './types'

// ---------------------------------------------------------------- the component

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

      for (let i = 0; i < 15; i++) dot(f.def[i], spec.def[0], spec.def[1], spec.defNum?.[i] ?? i + 1, f.carrying[15 + i] > 0.5, f.down[15 + i] > 0.5, f.aloft[15 + i])
      for (let i = 0; i < 15; i++) dot(f.att[i], spec.att[0], spec.att[1], spec.attNum?.[i] ?? i + 1, f.carrying[i] > 0.5 && !finishing, f.down[i] > 0.5, f.aloft[i])

      // THE REFEREE (owner, 1.8.0): a circle like everybody else, told apart
      // by the colour neither side wears, no number, and a dark edge. Full
      // size since 1.9.2: at 0.78 of a player he was near the ball's size and
      // read as the ball (owner, 18 Oct 2026). His colour is never white or
      // cream: pink, orange or cyan, never within reach of the ball's.
      const rx = X(f.ref.x), ry = Y(clamp(f.ref.y, 0.5, 69.5)), rs = R
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
