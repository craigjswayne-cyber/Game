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

/**
 * A CLUB PLAYS ITS OWN WAY (docs/match-authenticity-2.0.0.md, sections 1, 2
 * and 11). These are the manager's own dials (model Tactic), all 0..100 with
 * 50 the middle, read by the pitch so two clubs do not look the same:
 *   style     forwards-led and tight .. expansive: which pod shape the pack
 *             stands in and how often the ball goes wide
 *   tempo     how quickly the ball comes back from the ruck
 *   commit    how many go into their own ruck
 *   defLine   drift .. blitz: how hard the line comes up, how far it slides
 *   defWidth  narrow round the ruck .. spread to the touchlines
 *   contest   fan out and hold the line .. go after the ball on the floor
 */
export interface PitchTac { style: number; tempo: number; commit: number; defLine: number; defWidth: number; contest: number }
export const MID_TAC: PitchTac = { style: 50, tempo: 50, commit: 50, defLine: 50, defWidth: 50, contest: 50 }

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
  /** the defence's two men standing post at this ruck, picked when it formed (not re-picked every frame) */
  posts?: number[]
  /** the attacker with the ball or just tackled (side-relative), if any */
  carrier: number | null
  downMan: number | null
  /** how each side plays: the attack's shape and the defence's system, from the clubs' own tactics */
  att: PitchTac
  def: PitchTac
  /** men who are off the field (a card): by global index. The shapes close
   *  up round the hole, as fourteen men do */
  gone?: boolean[]
  /** 0..1: the attack is on the move. The pods and the backs do not stand
   *  and wait for the ball: as it comes available they start their runs, so
   *  whoever gets it is already going forward when he takes it */
  go: number
  /** which side of the ruck is the open side (+1: towards high y). Held by
   *  the sim so the whole shape does not flip as the ball crosses midfield */
  side: 1 | -1
  /** where the man with the ball is going to be met (the end of his run),
   *  if he is running: the defence holds its line there, it does not back
   *  away in front of him */
  meet: Pt | null
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
  const s = w.side
  const far = s > 0 ? 70 - R.y : R.y, near = 70 - far
  /** u metres up the field (the attack's way), v metres towards the open side */
  const P = (u: number, v: number): Pt => ({ x: clamp(R.x + dir * u, -4, 104), y: clamp(R.y + s * v, 1.5, 68.5) })
  const vOf = (g: number) => (b[g].y - R.y) * s
  const out: Pt[] = b.map(q => ({ x: q.x, y: q.y }))
  /** 11 is the left wing as his side looks up the field: which index is on the low-y touchline */
  const wingOn = (homeSide: boolean, lowY: boolean) => (homeSide === lowY ? 10 : 13)
  const openHigh = s > 0
  const gone = (g: number) => w.gone?.[g] === true

  // ================= ATTACK =================
  // ONE SHAPE, HUNG OFF THE BALL. It is the same shape while a man carries
  // as it is at the ruck, so as the ball goes forward the whole side comes
  // forward with it, and when he is tackled they are already where the next
  // phase starts. Depth is the point of it: every man is behind the ball,
  // and the further out he stands the deeper he stands, so each pass goes
  // back to a man coming on to it.
  const taken = new Set<number>()
  const put = (i: number, u: number, v: number) => { out[att0 + i] = P(u, v); taken.add(i) }
  if (w.carrier != null && !w.ruck) { out[att0 + w.carrier] = { ...R }; taken.add(w.carrier) }
  const rk = w.ruckers.filter(k => !taken.has(k))
  if (w.ruck) {
    // the tackled man on the ball, two over him, one latched on behind; the 9 at the base
    if (w.downMan != null && !taken.has(w.downMan)) put(w.downMan, -0.3, 0)
    // (a side that commits few keeps its third man out of it and on his feet)
    const spots: [number, number][] = [[0.7, -0.9], [0.7, 0.9], [-1.5, -0.2]]
    rk.filter(k => !taken.has(k)).slice(0, w.att.commit < 42 ? 2 : 3).forEach((k, j) => put(k, spots[j][0], spots[j][1]))
    if (!taken.has(8)) put(8, -2.6, 1.1)
  } else {
    // with the carrier: a man on each shoulder a stride behind, one further back, the 9 trailing
    const spots: [number, number][] = [[-2.4, -2.4], [-2.4, 2.4], [-5, 0]]
    rk.forEach((k, j) => put(k, spots[j][0], spots[j][1]))
    if (!taken.has(8)) put(8, -5.5, 1.6)
  }
  const go = w.go
  // the forwards: a pod of three off the 9, a pair in midfield, one on a wide short side
  // (spaced for the size a man is drawn at: nothing here stands on the ruck
  // or on the defence's toes)
  const vB = clamp(far * 0.5, 23, 32)
  let podSlots: [number, number][]
  if (w.att.style >= 60) {
    // 1-3-3-1: a pod of three off the 9, a pod of three in midfield, and a
    // forward holding each 15 metre channel
    podSlots = [[-4, 11.6], [-4.8, 8], [-4.8, 15.2], [-6.5, vB], [-6.9, vB + 3.8], [-9, Math.max(vB + 12, far - 10)]]
    if (near > 15) podSlots.push([-5, -(near - 9)])
    podSlots.push([-6.9, vB - 3.8])
  } else if (w.att.style <= 40) {
    // tight: both pods close to the ruck, one after the other, nobody out wide
    podSlots = [[-3.6, 9.6], [-4.4, 6], [-4.4, 13.2], [-5.6, 18.4], [-6.2, 22], [-6.2, 14.8 + 10.8]]
    if (near > 15) podSlots.splice(3, 0, [-4, -Math.min(7, near * 0.4)])
    podSlots.push([-5, -Math.min(11, near * 0.6)])
  } else {
    // 1-3-2 and a spare: a pod of three off the 9, a pair in midfield, one on a wide short side
    podSlots = [[-4, 11.6], [-4.8, 8], [-4.8, 15.2], [-6.5, vB], [-6.9, vB + 3.8]]
    if (near > 15) podSlots.splice(3, 0, [-4, -Math.min(9, near * 0.45)])
    podSlots.push([-5.5, 19], [-7, vB + 7.6])
  }
  const freeFwd = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => !taken.has(k) && !gone(att0 + k))
  // A FORWARD STAYS ON THE SIDE OF THE RUCK HE IS ON (18 Nov 2026, own audit:
  // "players running in strange areas"). Every pod was set on the open side,
  // so at each ruck any forward on the short side ran across behind it, and
  // when the open side changed the whole pack crossed over. A forward who is
  // already out on the short side now holds a place there, as a short-side
  // pod does, and only the men near the ruck or on the open side fill the
  // open-side pods.
  {
    const room = Math.max(0, near - 5)
    const shortMen = freeFwd.filter(k => vOf(att0 + k) < -5).sort((a, c) => vOf(att0 + c) - vOf(att0 + a)).slice(0, room > 14 ? 3 : room > 7 ? 2 : 0)
    shortMen.forEach((k, j) => {
      out[att0 + k] = P(Math.min(-3, -4 - j * 0.9 + go * 1.2), -Math.min(room, 7 + j * 4.2))
      taken.add(k)
    })
    for (const k of shortMen) freeFwd.splice(freeFwd.indexOf(k), 1)
    // (the open side has that many fewer: the widest places go unfilled)
    podSlots = podSlots.filter(q => q[1] > 0).sort((a, c) => a[1] - c[1]).slice(0, freeFwd.length).concat(podSlots.filter(q => q[1] <= 0)).slice(0, Math.max(freeFwd.length, 0))
  }
  for (const [g, [u, v]] of deal(freeFwd.map(k => att0 + k), vOf, podSlots.slice(0, freeFwd.length))) { out[g] = P(Math.min(-3, u + go * 1.2), v); taken.add(g - att0) }
  // the backs: 10 out the back of the first pod; 12, 13 and the open wing
  // each wider and deeper than the man inside him; 15 between 13 and the
  // wing when there is room for him, else behind the midfield
  const v13 = vB + 8, vW = far - 4
  if (!taken.has(9)) put(9, -8.5 + go * 1.5, 13.4)
  const centres = [11, 12].filter(k => !taken.has(k) && !gone(att0 + k))
  const cSlots: [number, number][] = [[-10, 19.4], [-11.5, v13]]
  for (const [g, [u, v]] of deal(centres.map(k => att0 + k), vOf, cSlots.slice(0, centres.length))) { out[g] = P(u + go * 1.5, v); taken.add(g - att0) }
  const wOpen = wingOn(att0 === 0, !openHigh), wShort = wOpen === 10 ? 13 : 10
  if (!taken.has(wOpen)) put(wOpen, -13.5 + go * 1.5, vW)
  if (!taken.has(wShort)) put(wShort, near > 9 ? -4.5 : -7, -(near - 3.5))
  if (!taken.has(14)) { if (vW - v13 > 13) put(14, -12.5 + go * 1.5, (v13 + vW) / 2); else put(14, -16, vB - 3) }

  // ================= DEFENCE =================
  // A FLAT LINE ON THE OFFSIDE LINE. At the ruck it stands a stride beyond
  // the last foot, a post either side of the ruck and then a man every few
  // metres, shoulder to shoulder across the field. When the ball comes out
  // the line goes forward together at it and slides with each pass. While a
  // man is carrying the line is where he will be met: it holds there, it
  // does not back away in front of him. Behind it the 9 sweeps, the far wing
  // hangs for the kick and the full-back stays deep and follows the ball.
  const M = w.ruck ? R : (w.meet ?? R)
  const D = (u: number, v: number): Pt => ({ x: clamp(M.x + dir * u, -4, 104), y: clamp(M.y + s * v, 1.5, 68.5) })
  const dvOf = (g: number) => (b[g].y - M.y) * s
  const dfar = s > 0 ? 70 - M.y : M.y, dnear = 70 - dfar
  const dTaken = new Set<number>()
  const dput = (i: number, p: Pt) => {
    // nobody defends from behind his own try line
    const own = dir > 0 ? 100 : 0
    out[def0 + i] = { x: dir > 0 ? Math.min(p.x, own + 0.5) : Math.max(p.x, own - 0.5), y: p.y }
    dTaken.add(i)
  }
  // where the ball is, in the defence's frame
  const C = w.out
  const Cu = C ? (C.x - M.x) * dir : 0, Cv = C ? (C.y - M.y) * s : 0
  const L = 2.3
  const [t0, t1] = w.tacklers
  if (!w.ruck) {
    // the tackle: the two nearest go at the man once he is on them
    const at = C ?? R
    const on = Math.hypot(at.x - M.x, at.y - M.y) < 7
    if (t0 != null) dput(t0, on ? { x: at.x + dir * 0.9, y: at.y - 0.8 } : D(0.9, -0.9))
    if (t1 != null) dput(t1, on ? { x: at.x + dir * 1.1, y: at.y + 0.9 } : D(1.1, 1))
  } else {
    // the tackler is on the floor and the second man is over the ball for a
    // moment; then they are out of it and back in the line
    if (t0 != null && w.ruckAge < 1.3) dput(t0, D(0.9, -0.6))
    // (a side that goes after the ball leaves its man over it for longer)
    if (t1 != null && w.ruckAge < 0.5 + w.def.contest / 100 * 1.3) dput(t1, D(1.3, 0.6))
  }
  // a post either side of the ruck: the two nearest forwards
  const posts = (w.posts && w.posts.length === 2 ? w.posts.filter(k => !dTaken.has(k) && !gone(def0 + k)) : [0, 1, 2, 3, 4, 5, 6, 7].filter(k => !dTaken.has(k) && !gone(def0 + k))
    .map(k => ({ k, d: Math.hypot(b[def0 + k].x - M.x, b[def0 + k].y - M.y) })).sort((a, c) => a.d - c.d).slice(0, 2).map(o => o.k))
  for (const [g, [u, v]] of deal(posts.map(k => def0 + k), dvOf, [[L, -3.5], [L, 3.5]])) dput(g - def0, D(u, v))
  // the 9 sweeps behind the line on the ball's side; the full-back is deep and follows the ball
  if (!dTaken.has(8)) dput(8, D(7, clamp(Cv * 0.8 + 2, -(dnear - 4), dfar - 8)))
  if (!dTaken.has(14)) {
    const by = (C ?? M).y
    dput(14, { x: clamp(M.x + dir * 23, 4, 96), y: 35 + (by - 35) * 0.6 })
  }
  // line speed: once the ball is out the line goes up at it, together. The
  // men in front of the ball lead by a stride, nobody is left behind.
  // (a few metres, together: the line does not charge ten metres and then
  // run back again every phase)
  const upBy = C ? clamp(L - (Cu + 1.5), 0, 3) * (0.55 + 0.55 * w.def.defLine / 100) : 0
  const up = (v: number) => {
    if (!C) return L
    const here = v * Cv < 0 ? 0.25 : clamp(1.05 - Math.abs(v - Cv) / 45, 0.6, 1)
    return L - upBy * here
  }
  const slide = (v: number) => (C && v * Cv > 0 ? v + clamp((Cv - v) * (0.3 - 0.22 * w.def.defLine / 100), -4, 4) : v)
  // the wings: the short-side wing is in the line when there is a short
  // side to defend; the open wing hangs a few metres back until the ball
  // comes his way, then he is up
  const dOpen = wingOn(def0 === 0, !openHigh), dShort = dOpen === 10 ? 13 : 10
  if (!dTaken.has(dShort)) dput(dShort, dnear > 9 ? D(up(-(dnear - 4)) + 0.4, -(dnear - 4)) : D(10, -(dnear - 3)))
  if (!dTaken.has(dOpen)) {
    const coming = C != null && Cv > dfar - 24
    dput(dOpen, coming || dfar < 24 ? D(up(dfar - 5) + 0.6, dfar - 5) : D(L + 5, dfar - 5))
  }
  // everyone else is the line: how many each side goes by how much field there is
  const lineMen = [0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12].filter(k => !dTaken.has(k) && !gone(def0 + k))
  const nShort = Math.min(lineMen.length, dnear > 24 ? 2 : dnear > 12 ? 1 : 0)
  const slots: [number, number][] = []
  for (let k = 0; k < nShort; k++) slots.push([0, -(7.4 + k * Math.min(5.5, Math.max(4, (dnear - 14) / 2)))])
  const nOpen = lineMen.length - slots.length
  // close together near the ruck, a little wider each man out, and never stretched thin
  const W = Math.max(11, Math.min(dfar - 9, 7.4 + (nOpen - 1) * (5 + 2.6 * w.def.defWidth / 100)))
  for (let k = 0; k < nOpen; k++) slots.push([0, 7.4 + (W - 7.4) * Math.pow(nOpen === 1 ? 0.4 : k / (nOpen - 1), 1.15)])
  // NUMBERING UP: each man in the line steps on to the attacker in front of
  // him, so the two lines face each other man for man where they can
  const theirs: number[] = []
  for (let k = 0; k < 15; k++) {
    if (k === 8 || gone(att0 + k)) continue
    const a = out[att0 + k], au = (a.x - M.x) * dir, av = (a.y - M.y) * s
    if (au < -2 && Math.abs(av) > 5) theirs.push(av)
  }
  const onMan = (v: number) => {
    let best = 9, at = -1
    theirs.forEach((av, j) => { const d = Math.abs(av - v); if (d < best) { best = d; at = j } })
    if (best >= 3 || at < 0) return v
    // one defender to a man: he is taken. (Eased in with distance, so a man
    // is never snapped across when an attacker drifts into range.)
    const to = theirs.splice(at, 1)[0]
    return v + (to - v) * 0.7 * (1 - best / 3)
  }
  for (const [g, [, v0]] of deal(lineMen.map(k => def0 + k), dvOf, slots)) {
    const v = onMan(v0)
    const vv = slide(v)
    dput(g - def0, D(up(vv), vv))
  }
  return out
}
