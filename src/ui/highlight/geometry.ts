// The clip's geometry: points, easing, and the curved runs and passes.

export type Pt = { x: number; y: number }

export const smooth = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const bez = (a: Pt, c: Pt, b: Pt, s: number): Pt => ({
  x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * c.x + s * s * b.x,
  y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * c.y + s * s * b.y,
})
export const bezLen = (a: Pt, c: Pt, b: Pt) => { let L = 0, p = a; for (let s = 0.05; s <= 1.0001; s += 0.05) { const q = bez(a, c, b, s); L += Math.hypot(q.x - p.x, q.y - p.y); p = q } return L }
/** the point a share k of the way ALONG the curve (not of its parameter), so
 *  a runner on a bent line keeps an even pace round the bend */
export const bezAlong = (a: Pt, c: Pt, b: Pt, k: number): Pt => alongOf(a, c, b)(k)
/** the same, with the curve measured once (the chase asks where the ball
 *  will be thirty-odd times a frame) */
const alongCache = new WeakMap<Pt, { c: Pt; b: Pt; f: (k: number) => Pt }>()
function alongOf(a: Pt, c: Pt, b: Pt): (k: number) => Pt {
  const hit = alongCache.get(a)
  if (hit && hit.c === c && hit.b === b) return hit.f
  const N = 24, cum = [0]
  let p = a
  for (let i = 1; i <= N; i++) { const q = bez(a, c, b, i / N); cum.push(cum[i - 1] + Math.hypot(q.x - p.x, q.y - p.y)); p = q }
  const f = (k: number) => {
    const want = clamp(k, 0, 1) * cum[N]
    let i = 1
    while (i < N && cum[i] < want) i++
    const seg = cum[i] - cum[i - 1]
    return bez(a, c, b, (i - 1 + (seg > 1e-9 ? (want - cum[i - 1]) / seg : 0)) / N)
  }
  alongCache.set(a, { c, b, f })
  return f
}
