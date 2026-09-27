import { useEffect, useRef, type RefObject } from 'react'
import { parseRun, runAt, type Waypoint } from './offBall'

/**
 * ---- THE GLIDE (1.8.1) ----
 *
 * Owner, 26 Sep 2026: "Is the animation the best it can be in 2d? Or can you
 * make it work better and smoother? Be hyper critical like its a new fm mobile
 * product."
 *
 * Measured before this existed (scripts/smoothprobe.mjs, 12 seconds of live
 * play at 60fps): every commentary line started all thirty dots from rest,
 * eased them up to about 250px/s and eased them back down to rest, and then
 * nothing moved. 38% of frames had every man on the pitch standing still, six
 * stop-starts every ten seconds. That is the "random" feeling: not the
 * positions, the rhythm. A CSS transition per line can only ever do that,
 * because each one starts at zero speed and ends at zero speed.
 *
 * The classic top-down view reads as a game because nobody stops: a man who is
 * running keeps running while his next job arrives. So the position the line
 * asks for is a TARGET, and a critically damped spring carries each dot there
 * (the SmoothDamp integrator every game engine ships). When a new target lands
 * mid-run the dot keeps its speed and bends towards it instead of stopping and
 * starting again.
 *
 * How it lives with the rest of the pitch:
 * - React still writes left/top, now without a transition, so every existing
 *   position rule is untouched. This loop draws each dot at its SPRING position
 *   by writing the difference into `transform` (translate3d, compositor only).
 * - The passage animations (phasePlay, pitchActs) move dots and the ball with
 *   the separate `translate` property, which composes with `transform`, so a
 *   carrier's run and a kick's flight play on top of the glide as before.
 * - The highlighted man's size step moved from transform to `scale` for the
 *   same reason; the ball keeps its resting tilt inside the transform written
 *   here.
 * - Reduced motion: no glide, the dots go straight to where they are.
 * - A dot with a data-run (offBall.ts) has a MOVING mark: the waypoints of his
 *   own run through the beat, so the spring carries him along a support line,
 *   a defensive push or a kick chase rather than to one spot.
 *
 * THE HANDOVER. A kick's flight holds the ball where it landed (in touch, at
 * the posts) until the next line cancels it and starts the next passage from
 * the ball's mark, so the ball used to jump the width of the pitch in one
 * frame: thirteen snaps in twenty seconds of smoothprobe. preserve() wraps
 * that handover: it notes where everything is DRAWN, lets the old animations
 * go and the new ones start, measures again, and gives each element the
 * difference as spring offset, so it eases from where the eye last saw it.
 */
const GLIDE = '.pdot:not(.ghost), .ball, .official, .phase-line, .contest-bar'

type S = { tx: number; ty: number; ox: number; oy: number; vx: number; vy: number; runKey?: string; run?: Waypoint[] | null; runAt0?: number; pace?: number; line?: number }

/** The same step in two dimensions with a top speed (Unity's SmoothDamp with
 *  maxSpeed): the part of the offset the dot may close in one smoothing time
 *  is capped, so a long way to go is covered at an even pace. */
function damp2(ox: number, oy: number, vx: number, vy: number, smooth: number, dt: number, maxSpeed: number): [number, number, number, number] {
  const omega = 2 / smooth
  const x = omega * dt
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  let cx = ox, cy = oy
  const cap = maxSpeed * smooth, m = Math.hypot(cx, cy)
  if (m > cap) { cx *= cap / m; cy *= cap / m }
  const tx = ox - cx, ty = oy - cy   // where the capped step aims, short of the mark
  const ux = (vx + omega * cx) * dt, uy = (vy + omega * cy) * dt
  vx = (vx - omega * ux) * e; vy = (vy - omega * uy) * e
  let nx = tx + (cx + ux) * e, ny = ty + (cy + uy) * e
  // never run through the mark and back
  if (ox * nx < 0) { nx = 0; vx = 0 }
  if (oy * ny < 0) { ny = 0; vy = 0 }
  return [nx, ny, vx, vy]
}

function px(v: string, size: number): number | null {
  if (!v) return null
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return null
  return v.endsWith('%') ? n / 100 * size : n
}

/** how long, as a share of the beat, a dot takes to settle on its mark.
 *  Tuned on smoothprobe: long enough that a man is still moving when his next
 *  job arrives, short enough that he is never more than a beat behind the
 *  commentary. */
export const GLIDE_SHARE = 0.42
/** the share of a beat a man takes to cover the way to a new mark, at an even
 *  pace: most of it, so he is still running when the next line comes */
export const PACE_SHARE = 0.85

export function usePitchGlide(world: RefObject<HTMLElement | null>, tickMs: number, lineKey = 0) {
  const tick = useRef(tickMs)
  tick.current = tickMs
  // which commentary line is on screen: a new one resets every man's pace
  const line = useRef(lineKey)
  line.current = lineKey
  const state = useRef(new WeakMap<HTMLElement, S>())
  const on = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    on.current = true
    const st = state.current
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      const w = world.current
      if (w) {
        const W = w.clientWidth, H = w.clientHeight
        const smooth = Math.max(0.05, tick.current / 1000 * GLIDE_SHARE)
        w.querySelectorAll<HTMLElement>(GLIDE).forEach(el => {
          let tx = px(el.style.left, W) ?? (el.style.right ? W - (px(el.style.right, W) ?? 0) : null)
          let ty = px(el.style.top, H)
          if (tx == null || ty == null) return
          let s = st.get(el)
          if (!s) { s = { tx, ty, ox: 0, oy: 0, vx: 0, vy: 0 }; st.set(el, s) }
          // OFF THE BALL (offBall.ts): the mark moves along the man's run
          // through the beat, and the spring chases the moving mark
          const key = el.dataset.run
          if (key !== s.runKey) { s.runKey = key; s.run = parseRun(key); s.runAt0 = now }
          const fresh = s.line !== line.current
          if (s.run) {
            const o = runAt(s.run, Math.min(1, (now - (s.runAt0 ?? now)) / Math.max(1, tick.current)))
            tx += o.x / 100 * W
            ty += o.y / 100 * H
          }
          if (tx !== s.tx || ty !== s.ty) {
            // the mark moved: the dot stays where it is drawn and runs on
            s.ox += s.tx - tx; s.oy += s.ty - ty
            s.tx = tx; s.ty = ty
            // A NEW LINE SETS HIS PACE: enough to reach the new mark in about
            // one beat, so he runs there at an even speed instead of sprinting
            // off and crawling in (SmoothDamp's maxSpeed)
            if (fresh) {
              s.line = line.current
              s.pace = Math.max(24, Math.hypot(s.ox, s.oy) / Math.max(0.2, tick.current / 1000 * PACE_SHARE))
            }
          }
          ;[s.ox, s.oy, s.vx, s.vy] = damp2(s.ox, s.oy, s.vx, s.vy, smooth, dt, s.pace ?? Infinity)
          if (Math.abs(s.ox) < 0.05 && Math.abs(s.vx) < 0.5) { s.ox = 0; s.vx = 0 }
          if (Math.abs(s.oy) < 0.05 && Math.abs(s.vy) < 0.5) { s.oy = 0; s.vy = 0 }
          const t = `translate3d(${s.ox.toFixed(2)}px, ${s.oy.toFixed(2)}px, 0)`
          el.style.transform = el.classList.contains('ball') ? `${t} rotate(-25deg)` : t
        })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { on.current = false; cancelAnimationFrame(raf) }
  }, [world])

  /** Run a handover (cancel the old passage, start the new) without a jump. */
  const preserve = (fn: () => void) => {
    const w = world.current
    if (!w || !on.current) { fn(); return }
    const els = [...w.querySelectorAll<HTMLElement>(GLIDE)]
    const centre = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }
    const before = new Map(els.map(el => [el, centre(el)]))
    fn()
    // screen pixels to the world's own: the camera scales the world
    const k = w.clientWidth ? w.getBoundingClientRect().width / w.clientWidth : 1
    for (const el of els) {
      const s = state.current.get(el)
      const b = before.get(el)
      if (!s || !b || !el.isConnected) continue
      const a = centre(el)
      const dx = (b[0] - a[0]) / (k || 1), dy = (b[1] - a[1]) / (k || 1)
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
      s.ox += dx; s.oy += dy
      const t = `translate3d(${s.ox.toFixed(2)}px, ${s.oy.toFixed(2)}px, 0)`
      el.style.transform = el.classList.contains('ball') ? `${t} rotate(-25deg)` : t
    }
  }
  return { preserve }
}
