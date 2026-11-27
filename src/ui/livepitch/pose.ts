// POSES DRAWN OVER THE BAKE (polish round, 27 Nov 2026). Three things the last animation agent held back because
// they would have moved the baked positions the record tests check: the goal kicker's run-up and follow-through,
// team-mates running in to the try scorer, and the lineout lift (two lifters closing under the jumper). They are
// presentation only: an offset in metres added at draw time to a man who is NOT holding the ball at that frame.
// The bake, the ball and the man with the ball are never touched (tests/simpitch.test.ts checks it over twenty
// fixtures).
//
// One exception, said plainly: while a goal kick sits on the tee the bake counts the kicker as holding it (he
// placed it). For those frames the pose says `placed`: the ball is drawn on the tee where the bake has it, nobody is
// drawn holding it, and the kicker walks back and runs in to it. The ball's own position is still untouched.
import { FPS, type Baked } from './fromRecord'

export interface Poses {
  /** draw-time offsets, metres, per man */
  dx: Float32Array; dy: Float32Array
  /** 0..1: a lineout jumper off the ground (drawn larger with his shadow left below him) */
  lift: Float32Array
  /** a place kick waiting on the tee: no man is drawn holding the ball */
  placed: boolean
}
export const newPoses = (): Poses => ({ dx: new Float32Array(30), dy: new Float32Array(30), lift: new Float32Array(30), placed: false })

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
const X = (bk: Baked, f: number, i: number) => bk.pos[f * 62 + i * 2]
const Y = (bk: Baked, f: number, i: number) => bk.pos[f * 62 + i * 2 + 1]

/** the frames a play is shown in, [first, last], or null if it is not (fully) baked yet */
function range(bk: Baked, n: number): [number, number] | null {
  let lo = 0, hi = bk.n - 1
  if (hi < 0 || bk.seg[hi] <= n) return null
  while (lo < hi) { const m = (lo + hi) >> 1; if (bk.seg[m] < n) lo = m + 1; else hi = m }
  if (bk.seg[lo] !== n) return null
  let e = lo
  // (plays are short: walk to the end)
  while (e + 1 < bk.n && bk.seg[e + 1] === n) e++
  return [lo, e]
}

type Kick = { k: 'kick'; kk: number; fs: number; fp: number; sx: number; sy: number; ux: number; uy: number; back: number; run: number }
type Gather = { k: 'gather'; fl: number; end: number; cut: number; by: number; men: { i: number; delay: number }[] }
type Lift = { k: 'lift'; j: number; fa: number; fb: number; lifters: [number, number]; tin: number; tout: number }
type Info = Kick | Gather | Lift | { k: 'none' }
const cache = new WeakMap<object, Map<number, Info>>()

function infoOf(bk: Baked, n: number): Info | null {
  let m = cache.get(bk.plays)
  if (!m) { m = new Map(); cache.set(bk.plays, m) }
  const had = m.get(n)
  if (had) return had
  const r = range(bk, n)
  // (not baked to its end yet: nothing drawn over it, and nothing remembered)
  if (!r) return null
  const info = build(bk, n, r)
  m.set(n, info)
  return info
}

function build(bk: Baked, n: number, [f0, f1]: [number, number]): Info {
  const p = bk.plays[n], nx = bk.plays[n + 1]
  if (p.kind === 'conversion' || p.kind === 'penaltyGoal') {
    // the strike: the last frame the kicker has it before it flies
    let fs = -1, kk = -1
    for (let f = f0 + 1; f <= f1; f++) if (bk.holder[f - 1] >= 0 && bk.holder[f] < 0) { fs = f; kk = bk.holder[f - 1]; break }
    if (fs < 0) return { k: 'none' }
    const bx = bk.ball[(fs - 1) * 3], by = bk.ball[(fs - 1) * 3 + 1]
    // on the tee: from the first frame the ball stops moving to the strike
    let fp = fs - 1
    while (fp - 1 >= f0 && bk.holder[fp - 1] === kk && Math.hypot(bk.ball[(fp - 1) * 3] - bx, bk.ball[(fp - 1) * 3 + 1] - by) < 0.05) fp--
    // (a kick at goal comes in on the owner's dissolve with the kicker already over the ball: from that frame he is
    // drawn standing at his mark, hidden by the dissolve, and runs in to strike it)
    const cut = bk.cuts.find(c => c >= f0 - 3 && c <= fp)
    let atMark = false
    if (cut != null && cut < fp && Math.hypot(bk.ball[cut * 3] - bx, bk.ball[cut * 3 + 1] - by) < 0.5 && bk.holder[cut] === kk) { fp = cut; atMark = true }
    else if (cut === fp) atMark = true
    if (fs - fp < Math.round(FPS * 0.5)) return { k: 'none' }
    const dir = kk < 15 ? 1 : -1, side = by >= 35 ? -1 : 1
    // his mark: four strides back from the ball and two across, the way a goal kicker stands; he runs in at about
    // 7 m/s on average (8.8 at the strike). Without a dissolve to stand him there he walks back to it at 4 m/s at most
    const T = (fs - fp) / FPS, run = Math.min(0.75, T - 0.1)
    const dist = atMark ? Math.min(5.2, run * 7) : Math.min(5.2, (T - 0.3) / 0.565)
    if (dist < 1.2) return { k: 'none' }
    const ux = (dir * 4.2) / 4.75, uy = (-side * 2.2) / 4.75
    return { k: 'kick', kk, fs, fp, sx: bx - ux * dist, sy: by - uy * dist, ux, uy, back: atMark ? 0 : dist * 0.375, run: atMark ? run : dist * 0.19 }
  }
  if ((p.kind === 'try' || p.kind === 'penaltyTry') && nx?.kind === 'conversion') {
    // only when the conversion comes in on a dissolve, so nobody is seen walking back
    const rn = range(bk, n + 1)
    const cut = rn ? bk.cuts.find(c => Math.abs(c - rn[0]) <= 3) : undefined
    if (cut == null) return { k: 'none' }
    const fl = clamp(Math.round(bk.segs[n].mark * FPS), f0, f1)
    const s = p.side === 1 ? 1 : 0, a0 = s * 15
    const bx = bk.ball[fl * 3], by2 = bk.ball[fl * 3 + 1]
    let by = bk.holder[fl] >= a0 && bk.holder[fl] < a0 + 15 ? bk.holder[fl] : -1
    if (by < 0) { let bd = 6; for (let i = a0; i < a0 + 15; i++) { const d = Math.hypot(X(bk, fl, i) - bx, Y(bk, fl, i) - by2); if (d < bd) { bd = d; by = i } } }
    if (by < 0) return { k: 'none' }
    // (a man who picks the ball up before the dissolve, the kicker fetching it, is left to the bake)
    const held = new Set<number>()
    for (let f = fl; f < Math.min(bk.n, cut + 1); f++) if (bk.holder[f] >= 0) held.add(bk.holder[f])
    const near: { i: number; d: number }[] = []
    for (let i = a0; i < a0 + 15; i++) {
      if (i === by || held.has(i) || bk.flags[fl * 30 + i] & 6) continue
      const d = Math.hypot(X(bk, fl, i) - X(bk, fl, by), Y(bk, fl, i) - Y(bk, fl, by))
      if (d < 35) near.push({ i, d })
    }
    near.sort((a, b) => a.d - b.d)
    return { k: 'gather', fl, end: f1, cut, by, men: near.map((x, r) => ({ i: x.i, delay: 0.12 + r * 0.05 })) }
  }
  if (p.kind === 'lineout') {
    let j = -1, fa = -1, fb = -1
    for (let f = f0; f <= f1; f++) for (let i = 0; i < 30; i++) if (bk.flags[f * 30 + i] & 8) { if (j < 0) { j = i; fa = f } if (i === j) fb = f }
    if (j < 0) return { k: 'none' }
    const a0 = j < 15 ? 0 : 15, thrower = bk.holder[Math.max(f0, fa - 1)]
    // (not a man who has the ball while the lift is drawn or eases off: the maul's carrier, the thrower)
    const held = new Set<number>()
    for (let f = Math.max(0, fa - FPS); f < Math.min(bk.n, fb + 3 * FPS); f++) if (bk.holder[f] >= 0) held.add(bk.holder[f])
    const c: { i: number; d: number }[] = []
    for (let i = a0; i < a0 + 8; i++) if (i !== j && i !== thrower && !held.has(i) && !(bk.flags[fa * 30 + i] & 4)) c.push({ i, d: Math.hypot(X(bk, fa, i) - X(bk, fa, j), Y(bk, fa, i) - Y(bk, fa, j)) })
    c.sort((a, b) => a.d - b.d)
    if (c.length < 2 || c[1].d > 4.5) return { k: 'none' }
    // (how long they take to close in and to let go: never quicker than a jog, 4 m/s in and 3.5 out on average, on top of their own running)
    const gap = (f: number) => Math.max(...[c[0].i, c[1].i].map((i, s2) => Math.hypot(X(bk, f, j) - X(bk, f, i), Y(bk, f, j) + (s2 ? 0.85 : -0.85) - Y(bk, f, i))))
    const fe = Math.min(bk.n - 1, fb + Math.round(FPS * 0.6))
    return { k: 'lift', j, fa, fb, lifters: [c[0].i, c[1].i], tin: Math.max(0.3, gap(fa) * 1.5 / 4), tout: Math.max(0.4, Math.max(gap(fb), gap(fe)) * 1.5 / 3.5) }
  }
  return { k: 'none' }
}

/** THE POSES at anim time a. `out` is filled and returned (no allocation a frame) */
export function posesAt(bk: Baked, a: number, out: Poses, reduce = false): Poses {
  out.dx.fill(0); out.dy.fill(0); out.lift.fill(0); out.placed = false
  if (!bk.n) return out
  const f = clamp(Math.round(a * FPS), 0, bk.n - 1), n = bk.seg[f]
  // (the play now, and the few before it: a follow-through or a lift easing off runs on into the next plays)
  for (let k = n; k >= n - 4; k--) {
    if (k < 0) break
    const inf = infoOf(bk, k)
    if (!inf || inf.k === 'none') continue
    if (inf.k === 'kick') kickPose(bk, inf, a, f, out, reduce)
    // (until the dissolve to the conversion, which may fall a frame or two either side of the try's last frame)
    else if (inf.k === 'gather' && !reduce && f < inf.cut) gatherPose(bk, inf, a, f, out)
    else if (inf.k === 'lift') liftPose(bk, inf, a, f, out, reduce)
  }
  // THE RULE: the man with the ball is never moved (a ball on the tee has nobody holding it, as drawn)
  const h = bk.holder[f]
  if (h >= 0 && !out.placed) { out.dx[h] = 0; out.dy[h] = 0 }
  return out
}

function kickPose(bk: Baked, k: Kick, a: number, f: number, out: Poses, reduce: boolean) {
  const t = k.fs / FPS - a
  if (f >= k.fp && f < k.fs) {
    out.placed = true
    if (reduce) return
    // walk back to his mark, stand, run in: as much of it as the time on the tee allows
    const T = (k.fs - k.fp) / FPS, run = k.run, back = k.back
    let w: number
    if (t <= run) { const u = 1 - t / run; w = 1 - (0.75 * u + 0.25 * u * u) }
    else if (back > 0 && t >= T - back) w = smooth((T - t) / back)
    else w = 1
    const px = X(bk, f, k.kk), py = Y(bk, f, k.kk)
    out.dx[k.kk] = (k.sx - px) * w; out.dy[k.kk] = (k.sy - py) * w
  } else if (f >= k.fs && !reduce) {
    // the follow-through: carried on past the tee a stride or two, then back into the bake's walk
    const s = -t, m = s < 0.4 ? 1.6 * smooth(s / 0.4) : 1.6 * (1 - smooth((s - 0.4) / 1.4))
    if (m > 0) { out.dx[k.kk] += k.ux * m; out.dy[k.kk] += k.uy * m }
  }
}

function gatherPose(bk: Baked, g: Gather, a: number, f: number, out: Poses) {
  if (f < g.fl) return
  // (he is followed where he stood when the ball went down; the frames after the try's last are read there too)
  const fr = Math.min(f, g.end)
  const t = a - g.fl / FPS, sx = X(bk, fr, g.by), sy = Y(bk, fr, g.by)
  for (let r = 0; r < g.men.length; r++) {
    const { i, delay } = g.men[r]
    const u = t - delay
    if (u <= 0) continue
    // up to a jog (3.6 m/s, 5.4 at the most with the easing, on top of his own running) from a standing start, to a ring round him, eased in to stop
    const run = u < 0.6 ? 3 * u * u : 1.08 + 3.6 * (u - 0.6)
    const px = X(bk, f, i), py = Y(bk, f, i), dx = sx - px, dy = sy - py, d = Math.hypot(dx, dy)
    // (a man the bake moves a long way meanwhile is not followed: he is off to the conversion)
    if (d > 40) continue
    const ring = 1.5 + 0.35 * Math.min(6, r)
    if (d <= ring) continue
    const D = d - ring, k = smooth(Math.min(1, run / (D + 1.5)))
    out.dx[i] = dx / d * D * k; out.dy[i] = dy / d * D * k
  }
}

function liftPose(bk: Baked, l: Lift, a: number, f: number, out: Poses, reduce: boolean) {
  const t0 = l.fa / FPS - l.tin * 0.7, t1 = l.fb / FPS + 0.1
  const w = a < t0 ? 0 : a < t0 + l.tin ? smooth((a - t0) / l.tin) : a <= t1 ? 1 : smooth(1 - (a - t1) / l.tout)
  if (w <= 0) return
  const jx = X(bk, f, l.j), jy = Y(bk, f, l.j)
  // (he goes up in 0.15 s and comes down in 0.25)
  const ta = l.fa / FPS, tb = l.fb / FPS
  out.lift[l.j] = a < ta ? 0 : a <= tb ? (reduce ? 1 : smooth((a - ta) / 0.15)) : reduce ? 0 : 1 - smooth((a - tb) / 0.25)
  if (reduce) return
  // one in front of him and one behind, along the line of the lineout (which runs in from touch), closing under him
  l.lifters.forEach((i, s) => {
    const tx = jx, ty = jy + (s ? 0.85 : -0.85)
    out.dx[i] = (tx - X(bk, f, i)) * w; out.dy[i] = (ty - Y(bk, f, i)) * w
  })
}
