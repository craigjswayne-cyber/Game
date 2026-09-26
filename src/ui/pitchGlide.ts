import { useEffect, useRef, type RefObject } from 'react'

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
 *
 * THE HANDOVER. A kick's flight holds the ball where it landed (in touch, at
 * the posts) until the next line cancels it and starts the next passage from
 * the ball's mark, so the ball used to jump the width of the pitch in one
 * frame: thirteen snaps in twenty seconds of smoothprobe. preserve() wraps
 * that handover: it notes where everything is DRAWN, lets the old animations
 * go and the new ones start, measures again, and gives each element the
 * difference as spring offset, so it eases from where the eye last saw it.
 */
const GLIDE = '.pdot:not(.ghost), .ball, .ball-shadow, .official'

type S = { tx: number; ty: number; ox: number; oy: number; vx: number; vy: number }

/** One SmoothDamp step on an offset whose target is zero. */
function damp(o: number, v: number, smooth: number, dt: number): [number, number] {
  const omega = 2 / smooth
  const x = omega * dt
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const temp = (v + omega * o) * dt
  return [(o + temp) * e, (v - omega * temp) * e]
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

export function usePitchGlide(world: RefObject<HTMLElement | null>, tickMs: number) {
  const tick = useRef(tickMs)
  tick.current = tickMs
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
          const tx = px(el.style.left, W) ?? (el.style.right ? W - (px(el.style.right, W) ?? 0) : null)
          const ty = px(el.style.top, H)
          if (tx == null || ty == null) return
          let s = st.get(el)
          if (!s) { s = { tx, ty, ox: 0, oy: 0, vx: 0, vy: 0 }; st.set(el, s) }
          else if (tx !== s.tx || ty !== s.ty) {
            // the mark moved: the dot stays where it is drawn and runs on
            s.ox += s.tx - tx; s.oy += s.ty - ty
            s.tx = tx; s.ty = ty
          }
          ;[s.ox, s.vx] = damp(s.ox, s.vx, smooth, dt)
          ;[s.oy, s.vy] = damp(s.oy, s.vy, smooth, dt)
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
