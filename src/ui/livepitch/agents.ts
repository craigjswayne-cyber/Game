// EVERY MAN DECIDES FOR HIMSELF (2.0.0, fourth pass: phase play).
//
// Owner, 17 Nov 2026: "There is still a significant amount of work to be done
// on positions, the movement of all on the pitch, their roles and how they
// interact", "The movement needs to be exactly how a game plays" and
// "Players should act independently".
//
// Until now thirty men were sent to the spots of a drawn shape. Here, in
// open play, each man works out where he should be from what is in front of
// him, many times a second:
//
//   ATTACK   the men at the breakdown clear it and the scrum-half goes to
//            its base; the free forwards form pods off him; the fly-half
//            stands behind the first pod, the centres step out and deeper,
//            a wing holds each touchline, the full-back sits in behind.
//            Nobody stands in front of the ball.
//   DEFENCE  the two nearest make the tackle; one contests the ball; a guard
//            stands either side of the ruck; the rest make a line on the
//            offside line, spread by how much field is on each side, and
//            when the ball comes out the line comes up at the man with it
//            and slides with the pass (a rush defence comes harder, a drift
//            defence slides further); the scrum-half sweeps behind it, the
//            wing away from the ball drops, the full-back shadows the ball.
//
// WHO GOES WHERE IS DECIDED BY WHERE HE IS, NOT BY HIS NUMBER: places in a
// line are handed out in order across the field, so men take the place
// beside them and two men never swap ends. That is most of why it reads as
// rugby and not as a diagram.
//
// What is known and what is not: there is no public tracking data for rugby
// union to copy (the clubs' GPS is private); the distances here are the
// laws' (the offside line at a ruck is the hindmost foot) and the published
// studies' (backs do the high-speed running, front-rowers very little).
//
// Pure: positions in, places out. No rng, no clock.

import type { Pt } from './shapes'

export interface OpenWorld {
  /** the thirty, 0-14 home and 15-29 away */
  b: Pt[]
  /** first index of the side with the ball (0 or 15), and the way it attacks */
  att0: number
  dir: 1 | -1
  /** the ruck, or the point the carrier is running at */
  ref: Pt
  /** the ball is on the floor in a ruck (else a man is carrying) */
  ruck: boolean
  /** seconds since the ball went to ground */
  ruckAge: number
  /** where the ball is once it is out of the ruck (the carrier, or a pass in the air); null while it is in */
  out: Pt | null
  /** side-relative shirt indices: the attack's three at the breakdown, the defence's two in the tackle */
  ruckers: number[]
  tacklers: number[]
  /** the attacker with the ball or just tackled (side-relative), if any */
  carrier: number | null
  downMan: number | null
  /** how this defence defends */
  rush: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** hand out places in order across the field: the men sorted by where they
 *  are, the places sorted the same way, paired off */
function deal(men: number[], vOf: (i: number) => number, slots: [number, number][]): Map<number, [number, number]> {
  const m = [...men].sort((a, c) => vOf(a) - vOf(c))
  const s = [...slots].sort((a, c) => a[1] - c[1])
  const out = new Map<number, [number, number]>()
  for (let k = 0; k < Math.min(m.length, s.length); k++) out.set(m[k], s[k])
  return out
}

/** where each of the thirty wants to be, right now */
export function openPlayTargets(w: OpenWorld): Pt[] {
  const { b, att0, dir } = w
  const def0 = 15 - att0
  const R = w.ref
  // the open side is the wide side of the ruck
  const s = R.y <= 35 ? 1 : -1
  const far = s > 0 ? 70 - R.y : R.y, near = 70 - far
  /** u metres up the field (the attack's way), v metres towards the open side */
  const P = (u: number, v: number): Pt => ({ x: clamp(R.x + dir * u, -4, 104), y: clamp(R.y + s * v, 1.5, 68.5) })
  const vOf = (g: number) => (b[g].y - R.y) * s
  const out: Pt[] = b.map(q => ({ x: q.x, y: q.y }))
  /** 11 is the left wing as his side looks up the field: which index is on the low-y touchline */
  const wingOn = (homeSide: boolean, lowY: boolean) => (homeSide === lowY ? 10 : 13)

  // ================= ATTACK =================
  const taken = new Set<number>()
  const put = (i: number, u: number, v: number) => { out[att0 + i] = P(u, v); taken.add(i) }
  if (w.carrier != null && !w.ruck) { out[att0 + w.carrier] = { ...R }; taken.add(w.carrier) }
  const rk = w.ruckers.filter(k => !taken.has(k))
  if (w.ruck) {
    if (w.downMan != null && !taken.has(w.downMan)) put(w.downMan, -1.7, 0)
    const spots: [number, number][] = [[-0.5, -2], [-0.5, 2], [-3.6, 0]]
    rk.filter(k => !taken.has(k)).forEach((k, j) => put(k, spots[j][0], spots[j][1]))
    if (!taken.has(8)) put(8, -4.2, 2.6)
  } else {
    // with the carrier: a man on each shoulder and one behind, the 9 trailing
    const spots: [number, number][] = [[-2.2, -2.6], [-2.4, 2.8], [-4.6, 0.4]]
    rk.forEach((k, j) => put(k, spots[j][0], spots[j][1]))
    if (!taken.has(8)) put(8, -6, -1.2)
  }
  // the pods: three off the 9, two more in midfield, one on a wide short side
  // (spaced for the size a man is drawn at: a pod is three discs side by side)
  const vA = Math.min(12, far * 0.27), vB = Math.min(29, far * 0.6)
  const podSlots: [number, number][] = [[-3.2, vA], [-4, vA - 3.6], [-4, vA + 3.6], [-5.6, vB - 1.9], [-6, vB + 1.9]]
  if (near > 14) podSlots.splice(3, 0, [-4, -Math.min(9, near * 0.5)])
  podSlots.push([-6, vB + 5.6], [-5, vA + 7.2])
  const freeFwd = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => !taken.has(k))
  for (const [g, [u, v]] of deal(freeFwd.map(k => att0 + k), vOf, podSlots.slice(0, freeFwd.length))) { out[g] = P(u, v); taken.add(g - att0) }
  // the backs: 10 behind the first pod, the centres out and deeper, 15 in behind
  if (!taken.has(9)) put(9, -8.5, vA + 3)
  const centres = [11, 12].filter(k => !taken.has(k))
  const cSlots: [number, number][] = [[-11.5, Math.min(21, far * 0.45)], [-14, Math.min(34, far * 0.74)]]
  for (const [g, [u, v]] of deal(centres.map(k => att0 + k), vOf, cSlots.slice(0, centres.length))) { out[g] = P(u, v); taken.add(g - att0) }
  const openHigh = s > 0
  const wOpen = wingOn(att0 === 0, !openHigh), wShort = wOpen === 10 ? 13 : 10
  if (!taken.has(wOpen)) put(wOpen, -16, far - 5)
  if (!taken.has(wShort)) put(wShort, -6, -(near - 3.5))
  if (!taken.has(14)) put(14, -19, Math.min(27, far * 0.58))

  // ================= DEFENCE =================
  const dTaken = new Set<number>()
  const dput = (i: number, p: Pt) => {
    // nobody defends from behind his own try line
    const own = dir > 0 ? 100 : 0
    out[def0 + i] = { x: dir > 0 ? Math.min(p.x, own + 0.5) : Math.max(p.x, own - 0.5), y: p.y }
    dTaken.add(i)
  }
  // where the ball is going to be met: the carrier, or the pass in the air
  const C = w.out
  const Cu = C ? (C.x - R.x) * dir : 0, Cv = C ? (C.y - R.y) * s : 0
  const [t0, t1] = w.tacklers
  if (!w.ruck) {
    // the tackle: the two nearest go at the man, one each side of him
    const at = C ?? R
    if (t0 != null) dput(t0, { x: at.x + dir * 0.9, y: at.y - 0.8 })
    if (t1 != null) dput(t1, { x: at.x + dir * 1.1, y: at.y + 0.9 })
  } else {
    // the tackler is on the floor then rolls clear; the second man is over
    // the ball for a moment, then takes a guard's place
    if (t0 != null) dput(t0, w.ruckAge < 1.4 ? P(1.0, -0.7) : P(2.4, -5.4))
    if (t1 != null) dput(t1, w.ruckAge < 1.2 ? P(0.8, 0.5) : P(2.4, 5.6))
  }
  // a guard either side of the ruck: the two nearest forwards
  const guards = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => !dTaken.has(k))
    .map(k => ({ k, d: Math.hypot(b[def0 + k].x - R.x, b[def0 + k].y - R.y) })).sort((a, c) => a.d - c.d).slice(0, 2).map(o => o.k)
  for (const [g, [u, v]] of deal(guards.map(k => def0 + k), vOf, [[2.0, -2.8], [2.0, 2.8]])) dput(g - def0, P(u, v))
  // the scrum-half sweeps behind the line, the full-back shadows the ball
  const ballV = C ? Cv : 0
  if (!dTaken.has(8)) dput(8, P(8, clamp(ballV * 0.7 + 2, -(near - 4), far - 8)))
  if (!dTaken.has(14)) {
    const by = (C ?? R).y
    dput(14, { x: clamp(R.x + dir * 24, 4, 96), y: 35 + (by - 35) * 0.55 })
  }
  // the line comes up at the ball and slides with it
  const up = (v: number) => {
    if (!C) return 1.7
    const close = clamp(1 - Math.abs(v - Cv) / 16, 0, 1) * (w.rush ? 1 : 0.6)
    return 1.7 + (Math.min(1.7, Cu + 1.6) - 1.7) * close
  }
  const slide = (v: number) => (C ? v + clamp((Cv - v) * (w.rush ? 0.1 : 0.28), -5, 5) : v)
  // the wings: the one on the ball's side is up in the line; the far one
  // hangs back for the kick until the ball comes his way
  const dOpen = wingOn(def0 === 0, !openHigh), dShort = dOpen === 10 ? 13 : 10
  if (!dTaken.has(dShort)) dput(dShort, near > 9 ? P(up(-(near - 4)) + 0.6, -(near - 4)) : P(11, -(near - 3)))
  if (!dTaken.has(dOpen)) {
    const coming = C != null && Cv > far - 26
    dput(dOpen, coming || far < 26 ? P(up(far - 5) + 0.8, far - 5) : P(9.5, far - 6))
  }
  // everyone else is the line: how many each side goes by how much field there is
  const lineMen = [0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12].filter(k => !dTaken.has(k))
  const nShort = near > 20 ? 2 : near > 10 ? 1 : 0
  const slots: [number, number][] = []
  for (let k = 0; k < Math.min(nShort, lineMen.length); k++) slots.push([0, -(5.8 + (Math.max(8, near - 9) - 5.8) * (nShort === 1 ? 0.5 : k))])
  const nOpen = lineMen.length - slots.length
  for (let k = 0; k < nOpen; k++) slots.push([0, 6 + (Math.max(10, far - 10) - 6) * Math.pow(nOpen === 1 ? 0.4 : k / (nOpen - 1), 1.12)])
  for (const [g, [, v]] of deal(lineMen.map(k => def0 + k), vOf, slots)) {
    const vv = slide(v)
    dput(g - def0, P(up(vv), vv))
  }
  return out
}
