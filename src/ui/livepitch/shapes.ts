// Where the thirty men stand for each phase (2.0.0).
//
// Every shape is written in the ATTACK'S OWN FRAME, then turned onto the pitch:
//
//   u  metres towards the line the side with the ball is attacking (+ is forward)
//   v  metres across the field towards the open side (+ is the wide side)
//
// so one template draws a scrum on either 22, for either side, by either
// touchline. Index i is shirt i + 1: 0-2 front row, 3-4 locks, 5-6 flankers,
// 7 No. 8, 8 scrum-half, 9 fly-half, 10 left wing, 11-12 centres, 13 right
// wing, 14 full-back.

import type { Phase } from './phase'

export type Pt = { x: number; y: number }
export interface Shape {
  /** by shirt index, home and away */
  home: Pt[]
  away: Pt[]
  /** the ball at rest (a kick in the air is drawn from Phase.to) */
  ball: Pt
  ref: Pt
  /** the planned runs of the side with the ball: from, to (field metres) */
  runs: { from: Pt; to: Pt }[]
  /** which shirt has the ball, side and index; null for a ruck or a kick */
  holder: { home: boolean; i: number } | null
}

type UV = [number, number]

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Open play, around a ruck or a man carrying. `far` is the metres of field on
 * the open side of the ball and `near` on the short side, so the backs hold
 * the real width of the pitch and nobody is stacked on a touchline.
 *
 * Attack: the men at the breakdown, a pod of three forwards off the
 * scrum-half, a second pod in midfield, the fly-half behind the first pod and
 * the backs stepped deeper the wider they stand. Defence: two at the ruck, a
 * line across the field that hangs back a little towards the edges, the
 * scrum-half sweeping behind it and the full-back deep.
 */
function openPlay(p: Phase, ruck: boolean, far: number, near: number): { att: UV[]; def: UV[] } {
  const att: UV[] = new Array(15)
  const F = Math.max(14, far), N = Math.max(4, near)
  // the forwards at this breakdown are the ones who were nearest it (the sim
  // says who); without a sim, a fixed three
  const sets = [[5, 6, 7], [3, 4, 1], [0, 2, 6], [7, 4, 5]]
  const here = p.ruckers?.length === 3 ? p.ruckers : sets[Math.abs(p.at) % sets.length]
  const others = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => !here.includes(k))
  if (ruck) {
    att[here[0]] = [-0.6, -1.9]; att[here[1]] = [-0.6, 1.9]; att[here[2]] = [-3.6, 0]
    att[8] = [-4.6, 3.4]
  } else {
    // in support of the carrier: one on each shoulder, one trailing
    att[here[0]] = [-2.2, -2.6]; att[here[1]] = [-2.4, 2.8]; att[here[2]] = [-4.5, 0.4]
    att[8] = [-5.5, -1.5]
  }
  // first pod, flat off nine; second pod in midfield; one forward short side
  const podA = Math.min(9, F * 0.22), podB = Math.min(26, F * 0.55)
  att[others[0]] = [-3.2, podA - 2.2]; att[others[1]] = [-2.6, podA]; att[others[2]] = [-3.2, podA + 2.2]
  att[others[3]] = [-5.2, podB - 2]; att[others[4]] = [-4.6, podB + 0.4]
  // the backs, deeper the wider they are: 10, 12, 13, then the open-side
  // wing on his touchline; the other wing holds the short side; 15 behind
  att[9] = [-7.5, Math.min(13, F * 0.3)]
  att[11] = [-9.5, Math.min(21, F * 0.44)]
  att[12] = [-11.5, Math.min(30, F * 0.66)]
  att[13] = [-12.5, F - 5]
  att[10] = [-6, -(N - 3.5)]
  att[14] = [-17, Math.min(18, F * 0.4)]
  if (N > 12) att[others[4]] = [-4, -Math.min(9, N * 0.5)]
  // the man just tackled is on the floor under the ruck, whoever he is
  if (ruck && p.downMan != null && p.downMan !== 8) att[p.downMan] = [-1.9, 0]

  // ---- the defence: FORWARDS CLOSE, BACKS WIDE. Two in the tackle, a
  // guard either side of the ruck, the rest of the pack next to them; then
  // 10, 12 and 13 across the midfield, a wing on each edge, the scrum-half
  // sweeping behind the ruck and the full-back deep.
  const def: UV[] = new Array(15)
  const tk = p.tacklers?.length === 2 ? p.tacklers : [6, 5]
  def[tk[0]] = ruck ? [2.4, -1.4] : [2.6, -2.2]
  def[tk[1]] = ruck ? [2.6, 2.2] : [2.6, 2.4]
  const fw = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => !tk.includes(k))
  const bk = [9, 11, 12].filter(k => !tk.includes(k))
  const depth = (v: number) => (ruck ? 5 : 4.5) + 2.6 * Math.pow(Math.min(1, Math.abs(v) / Math.max(F, N)), 1.6)
  def[fw[0]] = [4, -3.2]; def[fw[1]] = [4, 3.4]
  const rest = fw.slice(2)
  if (N > 12 && rest.length) { const k = rest.shift()!; def[k] = [depth(7), -Math.min(8, N * 0.5)] }
  const packTo = Math.min(F * 0.42, 7 + rest.length * 3.6)
  rest.forEach((k, j) => { const v = 7 + (packTo - 7) * (rest.length === 1 ? 0 : j / (rest.length - 1)); def[k] = [depth(v), v] })
  const b0 = packTo + 4.5, b1 = Math.max(b0 + 2, F - 13)
  bk.forEach((k, j) => { const v = b0 + (b1 - b0) * (bk.length === 1 ? 0.5 : j / (bk.length - 1)); def[k] = [depth(v), v] })
  def[13] = [depth(F) + 1, F - 5]
  def[10] = N > 9 ? [5.5, -(N - 4)] : [13, -(N - 3)]
  if (!tk.includes(8)) def[8] = [8.5, 2]
  def[14] = [24, Math.min(16, F * 0.35)]
  for (let k = 0; k < 15; k++) if (!def[k]) def[k] = [6, 3 + k]
  for (let k = 0; k < 15; k++) if (!att[k]) att[k] = [-6, 3 + k]
  return { att, def }
}

// THE TIGHT SHAPES ARE DRAWN LARGER THAN LIFE. A man's disc is about 3.5 m
// across on a phone so his number reads; a scrum drawn to scale would be one
// blob. So the set pieces are spaced for the discs: rows a disc apart, the
// two packs just touching, as the reference clips draw them.
function scrum(): { att: UV[]; def: UV[] } {
  const att: UV[] = [
    [-1.7, -3.3], [-1.7, 0], [-1.7, 3.3], [-4.9, -1.7], [-4.9, 1.7], [-4.4, -5.6], [-4.4, 5.6], [-8, 0],
    // THE LAW (10, scrum offside): every back but the 9 is five metres behind
    // the last foot of his own scrum. The attack's line is staggered deeper
    // from there; the defence's is flat on it, the full-back deep, and the
    // far wing hangs back for the kick (the pendulum).
    [-1, 6.6], [-13.2, 12], [-13.5, -13], [-14.8, 18.5], [-16.4, 25], [-18, 33], [-21, 15],
  ]
  const def: UV[] = [
    [1.7, 3.3], [1.7, 0], [1.7, -3.3], [4.9, 1.7], [4.9, -1.7], [4.4, 5.6], [4.4, -5.6], [8, 0],
    [2.2, 7.4], [13.2, 11], [13.4, -12], [13.2, 17], [13.2, 23.5], [18, 33], [27, 12],
  ]
  return { att, def }
}

/** v here is metres in from the touchline the throw is taken on */
function lineout(): { att: UV[]; def: UV[] } {
  const att: UV[] = [
    [-1.8, 5.5], [0, -1], [-1.8, 23.5], [-1.8, 12.7], [-1.8, 16.3], [-1.8, 9.1], [-1.8, 27.1], [-1.8, 19.9],
    // THE LAW (18): the line stands between the 5 and 15 metre lines, the
    // receiver two metres off it, and everyone else ten metres back until
    // the ball is caught. The other hooker is in the five-metre channel; the
    // defending 9 is often the one in the tramlines with the hooker at the tail.
    [-4, 17], [-13, 36], [-10.5, 3], [-14.5, 42], [-16, 48], [-17.5, 57], [-22, 40],
  ]
  const def: UV[] = [
    [1.8, 5.5], [3.6, 30.5], [1.8, 23.5], [1.8, 12.7], [1.8, 16.3], [1.8, 9.1], [1.8, 27.1], [1.8, 19.9],
    [2.6, 2.6], [11, 36], [11, 5], [11, 42], [11, 48], [14, 57], [26, 38],
  ]
  return { att, def }
}

function maul(): { att: UV[]; def: UV[] } {
  const att: UV[] = [
    [-1.7, -3.2], [-5, 0], [-1.7, 3.2], [-1.7, 0], [-5, -3.2], [-5, 3.2], [-8, -1.6], [-8, 1.8],
    [-10.5, 4.5], [-12, 12], [-11, -11], [-13, 18], [-14.5, 24], [-15, 32], [-18, 14],
  ]
  const def: UV[] = [
    [1.7, -1.7], [1.7, 1.7], [1.7, -5], [4.9, 0], [1.7, 5], [4.9, -3.4], [4.9, 3.4], [6.5, 7],
    [7, 10], [7, 14], [12, -10], [7, 20], [7.5, 26], [10, 33], [20, 14],
  ]
  return { att, def }
}

/** the kicking side chasing in a line towards where it comes down, the other
 *  side's back three under it and their forwards turning */
/**
 * A KICK AND WHAT BOTH SIDES DO ABOUT IT (docs/match-authenticity-2.0.0.md,
 * section 7).
 *
 * contest  a box kick or an up-and-under: short and high so it can be won
 *          back. The wing on that side leads the chase from the outside and
 *          gets under it; two back-rowers are on his shoulder for the loose
 *          ball; the rest come up behind in a line across the field; the 10
 *          sits in the pocket and the full-back and far wing stay home for
 *          the kick that comes back.
 * long     for territory: nobody gets there, so the whole line goes up
 *          together and stops ten metres short, where the catcher must be
 *          met or kick back.
 * touch    it is going out: both sides walk to the lineout.
 *
 * The side it is kicked to: the full-back under it, a wing beside him to
 * take the pass infield, the other wing dropping in behind, the half-backs
 * and the rest turning and working back to get behind the ball.
 */
function kickChase(landU: number, landV: number, kind: 'contest' | 'long' | 'touch' = 'long'): { att: UV[]; def: UV[] } {
  const sv = landV >= 0 ? 1 : -1
  const att: UV[] = []
  for (let k = 0; k < 15; k++) att.push([0, 0])
  // the wing on the side it has gone to, and the other one
  const wNear = sv > 0 ? 13 : 10, wFar = sv > 0 ? 10 : 13
  const line = kind === 'touch' ? Math.min(landU - 14, 8) : kind === 'contest' ? landU - 9 : landU - 11
  if (kind === 'contest') {
    att[wNear] = [landU - 1.2, landV + sv * 1.8]
    att[5] = [landU - 4.5, landV - sv * 2.6]
    att[6] = [landU - 5.5, landV + sv * 1.2]
  } else {
    att[wNear] = [line + 1, landV + sv * 5]
    att[5] = [line, landV - sv * 1]
    att[6] = [line, landV - sv * 7]
  }
  // the line behind them, across the field, connected
  const inLine = [7, 11, 12, 3, 4, 0, 1, 2]
  inLine.forEach((k, j) => { att[k] = [line - (k < 3 ? 5 : k < 5 ? 2.5 : 0) - Math.abs(j - 2) * 0.4, landV - sv * (kind === 'contest' ? 7.5 + j * 5.2 : 13 + j * 5.2)] })
  att[8] = [Math.max(2, line - 8), landV * 0.5 - sv * 3]
  att[9] = [Math.max(-4, line - 13), landV * 0.4 - sv * 8]
  att[wFar] = [Math.max(-6, line - 10), landV - sv * 52]
  att[14] = [Math.max(-14, line - 24), landV * 0.35 - sv * 14]

  const def: UV[] = []
  for (let k = 0; k < 15; k++) def.push([0, 0])
  // (their wings, seen from the kicker: 10 is on the -v side, 13 on the +v side)
  const dNear = sv > 0 ? 13 : 10, dFar = sv > 0 ? 10 : 13
  def[14] = [landU, landV]
  def[dNear] = [landU + 4.5, landV + sv * 3.5]
  def[dFar] = [landU + 2, landV - sv * 13]
  def[9] = [landU - 4, landV - sv * 9]
  def[8] = [landU - 9, landV - sv * 4]
  // the rest have turned and are working back to get behind the ball
  ;[5, 6, 7, 11, 12, 3, 4, 0, 1, 2].forEach((k, j) => {
    def[k] = [Math.max(3, landU - 9 - (j % 3) * 3.4 - (k < 5 ? 5 : 0)), landV - sv * (-4 + j * 5)]
  })
  return { att, def }
}

/**
 * The thirty, the ball and the referee for a phase, in field metres.
 * `carrierIdx` is the shirt index of the man the line names, when he is on.
 */
export function shapeOf(p: Phase, carrierIdx: number | null): Shape {
  const dir = p.homeBall ? 1 : -1
  // the open side: the wider half of the field from the ball
  const open = p.y <= 35 ? 1 : -1
  const far = open > 0 ? 70 - p.y : p.y, near = 70 - far
  const ux = (u: number) => p.x + dir * u
  const vy = (v: number) => p.y + open * v
  const toPt = ([u, v]: UV): Pt => ({ x: clamp(ux(u), -6, 106), y: clamp(vy(v), 1, 69) })
  let att: UV[], def: UV[]
  let holder: number | null = null
  let ball: Pt = { x: p.x, y: p.y }
  let ref: Pt = { x: p.x - dir * 4, y: clamp(p.y - open * 6, 2, 68) }
  const runs: { from: Pt; to: Pt }[] = []

  const finish = (a: Pt[], d: Pt[]): Shape => ({
    home: p.homeBall ? a : d,
    away: p.homeBall ? d : a,
    ball, ref, runs,
    holder: holder == null ? null : { home: p.homeBall, i: holder },
  })

  switch (p.kind) {
    case 'scrum': case 'penalty': {
      if (p.kind === 'penalty') {
        // the play stops: the side penalised retreats ten, the other gathers
        const op = openPlay(p, true, far, near)
        att = op.att.map(([u, v]) => [u - 1, v * 0.8] as UV)
        def = op.def.map(([u, v]) => [Math.max(u, 0) + 9, v * 0.85] as UV)
        holder = carrierIdx ?? 8
        att[holder] = [0, 0]
        ref = { x: ux(2), y: clamp(vy(-3), 2, 68) }
        break
      }
      ;({ att, def } = scrum())
      ball = { x: ux(0), y: p.y }
      ref = { x: ux(1), y: clamp(vy(-5), 2, 68) }
      break
    }
    case 'lineout': {
      ;({ att, def } = lineout())
      // v from the touchline the throw is taken on, so the line runs infield
      const side = p.y <= 35 ? 1 : -1
      const edge = p.y <= 35 ? 0 : 70
      const lt = ([u, v]: UV): Pt => ({ x: clamp(ux(u), -6, 106), y: clamp(edge + side * v, -0.5, 70.5) })
      {
        const lowOpenL = side < 0
        for (const [arr, homeSide] of [[att, p.homeBall], [def, !p.homeBall]] as [UV[], boolean][]) {
          if (((homeSide === lowOpenL) ? 10 : 13) !== 13) { const t = arr[10]; arr[10] = arr[13]; arr[13] = t }
        }
      }
      const a = att.map(lt), d = def.map(lt)
      ball = { x: ux(-0.4), y: edge + side * 12.7 }
      ref = { x: ux(0), y: edge + side * 2.5 }
      holder = 3
      return { home: p.homeBall ? a : d, away: p.homeBall ? d : a, ball, ref, runs: [], holder: { home: p.homeBall, i: 3 } }
    }
    case 'maul': {
      ;({ att, def } = maul())
      holder = 7
      ball = { x: ux(-8), y: vy(1.8) }
      break
    }
    case 'ruck': case 'carry': case 'catch': {
      const op = openPlay(p, p.kind === 'ruck', far, near)
      att = op.att; def = op.def
      if (p.kind !== 'ruck') {
        // the named man is on the ball; whoever stood there takes his place
        const c = carrierIdx ?? (p.kind === 'catch' ? 14 : 11)
        // his own place in the shape is left for the men either side to close
        att[c] = [0, 0]
        holder = c
        // the backs' lines, drawn as the dashed runs
        for (const k of [9, 11, 12, 13]) {
          if (k === c) continue
          const [u, v] = att[k]
          runs.push({ from: toPt([u, v]), to: toPt([u + 7, v + (k === 11 ? -3 : 2)]) })
        }
        if (p.kind === 'catch') {
          // the catcher deep, his side around him; the chasers arriving
          att = att.map(([u, v], k) => k === c ? [0, 0] : [u - 3, v * 0.7] as UV)
          def = def.map(([u, v]) => [Math.max(4, u + 3), v * 0.8] as UV)
          runs.length = 0
        }
      } else {
        ball = { x: ux(0), y: p.y }
      }
      ref = { x: ux(-3), y: clamp(vy(near > 9 ? -7.5 : 8), 2, 68) }
      break
    }
    case 'kick': case 'dropout': case 'kickoff': {
      const to = p.to ?? { x: ux(30), y: p.y }
      const landU = (to.x - p.x) * dir
      const landV = (to.y - p.y) * open
      const how = p.label === 'lp.kickTouch' ? 'touch' : (p.hang ?? 0) >= 14 ? 'contest' : 'long'
      ;({ att, def } = kickChase(landU, landV, how))
      // a restart in the air is chased like any high ball; before it is kicked both sides are set
      if (p.flying) { holder = null; ball = to; ref = { x: ux(landU * 0.5), y: clamp(vy(landV * 0.5 + 8), 2, 68) }; break }
      if (p.kind === 'kickoff' || p.kind === 'dropout') {
        // the kicking side level along the line, the others waiting in pods
        // v is measured from the ball, which sits mid-field for a kick-off
        // the pack lines up on the side it is going to, the backs the other
        // side of the kicker, a wing on each touchline, the full-back behind
        const sv = landV >= 0 ? 1 : -1
        // (docs/match-authenticity-2.0.0.md, section 8: seven forwards are the
        // chase, most of them on the side it is going to; a centre and a wing
        // outside them; the number 8 and the full-back stay back for the
        // kick that comes back)
        const ko: UV[] = [
          [0, -5], [0, 5], [0, -9], [0, 9], [0, 13], [0, 17], [0, 21], [-13, 3],
          [-4, -3], [-1.5, 0], [0, -31], [0, 25], [0, -15], [0, 31], [-18, -12],
        ]
        att = ko.map(([u, v]) => [u, v * sv] as UV)
        const recv: UV[] = [
          [12, 14], [12, 11], [13, 8], [15, -6], [15, -9], [13, -12], [17, 4], [18, -2],
          [21, 0], [27, -4], [34, -26], [30, -12], [32, -20], [34, 28], [42, 0],
        ].map(([u, v]) => [u, v * sv] as UV)
        def = recv
        if (p.kind === 'dropout') def = recv.map(([u, v]) => [u + 8, v] as UV)
      } else {
        att[9] = [-1, 0]
      }
      holder = null
      ball = to
      ref = { x: ux(landU * 0.5), y: clamp(vy(landV * 0.5 + 8), 2, 68) }
      break
    }
    case 'try': case 'heldup': {
      // over the line: the scorer on the ball, his side arriving, theirs beaten
      const op = openPlay(p, false, far, near)
      // his support arriving behind him, the cover that did not get there
      att = op.att.map(([u, v]) => [u * 0.9 - 7, v * 0.9] as UV)
      // THE SCORER IS ON HIS OWN. The cover is behind him, beaten, not in
      // a heap on top of him: the try has to be seen
      def = op.def.map(([, v], k) => [-4.5 - (k % 4) * 2.2, v * 0.9 + (v >= 0 ? 3 : -3)] as UV)
      holder = carrierIdx ?? 13
      att[holder] = [0, 0]
      ball = { x: p.x, y: p.y }
      ref = { x: p.x, y: clamp(p.y + 4, 2, 68) }
      break
    }
    case 'con': case 'goal': {
      // the kicker on his spot, his side behind him, theirs behind the posts
      const k = carrierIdx ?? 9
      const goalU = ((p.homeBall ? 100 : 0) - p.x) * dir
      const gu = goalU
      // absolute places across the field, written back into this frame
      const vAt = (y: number) => (y - p.y) * open
      att = []
      // his side wait well behind him, spread across the field
      for (let j = 0; j < 15; j++) att.push(j === k ? [0, 0] : [-15 - ((j * 7) % 5) * 2.6, vAt(10 + ((j * 4) % 15) * 3.5)])
      def = []
      // theirs under the posts for a conversion, back ten for a penalty
      for (let j = 0; j < 15; j++) def.push(p.kind === 'con' ? [gu + 2 + (j % 2) * 3, vAt(12 + j * 3.3)] : [Math.max(10, gu - 4 - (j % 3) * 4), vAt(8 + j * 3.9)])
      holder = k
      ball = { x: p.x, y: p.y }
      ref = { x: ux(gu + 1), y: 33 }
      break
    }
    default: {
      // the break: both sides walking in a loose line either side of halfway
      att = []; def = []
      for (let j = 0; j < 15; j++) { att.push([-6 - (j % 2) * 3, -28 + j * 4]); def.push([6 + (j % 2) * 3, -28 + j * 4]) }
      ball = { x: 50, y: 35 }
      ref = { x: 50, y: 35 }
    }
  }
  // THE WINGS STAY ON THEIR OWN WINGS. Every shape above puts "the wing on
  // the open side" in slot 13 and "the wing on the short side" in slot 10;
  // which of 11 and 14 that is depends on which way the side is playing and
  // which touchline is the open one. 11 is the left wing as his side looks
  // up the field, always.
  const lowOpen = open < 0
  const swapFor = (homeSide: boolean) => ((homeSide === lowOpen) ? 10 : 13) !== 13
  const fix = (a: UV[], homeSide: boolean) => { if (swapFor(homeSide)) { const t = a[10]; a[10] = a[13]; a[13] = t } }
  fix(att, p.homeBall); fix(def, !p.homeBall)
  // a side defending its own line stands on it, not behind it
  const own = p.homeBall ? 100 : 0
  const onLine = (q: Pt): Pt => ({ x: p.homeBall ? Math.min(q.x, own + 0.6) : Math.max(q.x, own - 0.6), y: q.y })
  const scored = p.kind === 'try' || p.kind === 'heldup' || p.kind === 'con' || p.kind === 'goal'
  return finish(att.map(toPt), scored ? def.map(toPt) : def.map(toPt).map(onLine))
}
