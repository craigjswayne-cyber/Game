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

/** a defensive line across the field, n men from v0 to v1, at depth u */
function line(n: number, u: number, v0: number, v1: number): UV[] {
  const out: UV[] = []
  for (let k = 0; k < n; k++) out.push([u + (k % 2) * 0.6, v0 + (v1 - v0) * (n === 1 ? 0.5 : k / (n - 1))])
  return out
}

/** the attack's shape around a ruck or a carry, and the defence's line */
function openPlay(p: Phase, ruck: boolean): { att: UV[]; def: UV[]; holder: number | null } {
  const att: UV[] = new Array(15)
  // the carrier's pod: a ruck has two men bound over the ball; a carry has
  // the man himself on it
  const r = p.at % 3
  const bound = [[5, 6], [3, 4], [0, 2]][r]
  att[bound[0]] = ruck ? [0.4, -0.7] : [-2.5, -3]
  att[bound[1]] = ruck ? [0.4, 0.7] : [-2.5, 3]
  att[8] = ruck ? [-1.4, 0.4] : [-4, 1]
  att[9] = [-6, 7]
  // the other forwards in two pods, one each side of the ball
  const rest = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => !bound.includes(k))
  const pods: UV[] = [[-3.5, -6], [-4, -8], [-3.5, -10], [-4.5, 11], [-5, 13], [-4.5, 15]]
  rest.forEach((k, j) => { att[k] = pods[j] })
  att[11] = [-8.5, 15]
  att[12] = [-10.5, 22]
  att[13] = [-11, 30]
  att[10] = [-7, -13]
  att[14] = [-14, 16]
  // a carry: the named man has it, so swap him onto the ball
  let holder: number | null = null
  if (!ruck) holder = 8
  const def: UV[] = new Array(15)
  // two of theirs at the breakdown, nine in the line, three in the backfield
  def[6] = ruck ? [1.4, -0.3] : [2.2, -1.5]
  def[5] = ruck ? [1.5, 0.9] : [2.2, 1.6]
  const ln = line(9, ruck ? 2.6 : 3.2, -11, 27)
  ;[0, 1, 2, 3, 4, 7, 8, 9, 11].forEach((k, j) => { def[k] = ln[j] })
  def[12] = [3.5, 31]
  def[10] = [16, -9]
  def[13] = [18, 22]
  def[14] = [26, 8]
  return { att, def, holder }
}

function scrum(): { att: UV[]; def: UV[] } {
  const att: UV[] = [
    [-0.7, -1.2], [-0.7, 0], [-0.7, 1.2], [-1.9, -0.55], [-1.9, 0.55], [-1.9, -1.7], [-1.9, 1.7], [-3, 0],
    [-0.4, 2.4], [-6, 7], [-8, -10], [-8.5, 13], [-10.5, 19], [-11.5, 27], [-14, 12],
  ]
  const def: UV[] = [
    [0.7, 1.2], [0.7, 0], [0.7, -1.2], [1.9, 0.55], [1.9, -0.55], [1.9, 1.7], [1.9, -1.7], [3, 0],
    [0.9, 2.6], [5.5, 7], [6, -10], [5.6, 13], [5.8, 19], [6.2, 27], [18, 11],
  ]
  return { att, def }
}

/** v here is metres in from the touchline the throw is taken on */
function lineout(): { att: UV[]; def: UV[] } {
  const att: UV[] = [
    [-0.5, 6], [0, -0.6], [-0.5, 12], [-0.5, 8], [-0.5, 10], [-0.5, 7], [-0.5, 13], [-0.5, 11],
    [-2, 16], [-10, 22], [-9, 3], [-11, 28], [-12, 35], [-13, 46], [-17, 32],
  ]
  const def: UV[] = [
    [0.6, 6], [2, 3], [0.6, 12], [0.6, 8], [0.6, 10], [0.6, 7], [0.6, 13], [0.6, 11],
    [1.8, 17], [10, 22], [10, 4], [10.5, 28], [11, 35], [13, 46], [24, 30],
  ]
  return { att, def }
}

function maul(): { att: UV[]; def: UV[] } {
  const att: UV[] = [
    [-1.4, -0.8], [-2.2, 0], [-1.4, 0.8], [-0.5, -0.5], [-0.5, 0.5], [-1.4, -1.7], [-1.4, 1.7], [-2.6, 0.9],
    [-3.6, 1.5], [-8, 6], [-8, -9], [-9, 12], [-10.5, 18], [-11, 26], [-14, 10],
  ]
  const def: UV[] = [
    [0.5, -0.6], [0.6, 0.4], [1.4, -1.2], [1.4, 0], [1.4, 1.1], [0.5, 1.5], [2.3, 0.5], [3, 3],
    [4, 6], [5, 9], [10, -8], [5, 14], [5.5, 20], [8, 28], [18, 12],
  ]
  return { att, def }
}

/** the kicking side chasing in a line towards where it comes down, the other
 *  side's back three under it and their forwards turning */
function kickChase(landU: number, landV: number): { att: UV[]; def: UV[] } {
  const chase = landU - 9
  const att: UV[] = []
  for (let k = 0; k < 15; k++) att.push([0, 0])
  const front = [5, 6, 7, 9, 11, 12, 10, 13]
  front.forEach((k, j) => { att[k] = [chase - Math.abs(j - 3.5) * 0.8, landV - 18 + j * 5] })
  ;[0, 1, 2, 3, 4].forEach((k, j) => { att[k] = [Math.max(-2, chase - 12), landV - 10 + j * 5] })
  att[8] = [Math.max(-2, chase - 6), landV + 2]
  att[14] = [-6, landV * 0.5]
  const def: UV[] = []
  for (let k = 0; k < 15; k++) def.push([0, 0])
  def[14] = [landU, landV]
  def[10] = [landU - 3, landV - 12]
  def[13] = [landU - 2, landV + 12]
  ;[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12].forEach((k, j) => { def[k] = [Math.min(landU - 6, 6 + (j % 4) * 3), landV - 22 + j * 4] })
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
        const op = openPlay(p, true)
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
      const a = att.map(lt), d = def.map(lt)
      ball = { x: ux(-0.4), y: edge + side * 9 }
      ref = { x: ux(-2.5), y: edge + side * 18 }
      holder = 3
      return { home: p.homeBall ? a : d, away: p.homeBall ? d : a, ball, ref, runs: [], holder: { home: p.homeBall, i: 3 } }
    }
    case 'maul': {
      ;({ att, def } = maul())
      holder = 7
      ball = { x: ux(-2.6), y: vy(0.9) }
      break
    }
    case 'ruck': case 'carry': case 'catch': {
      const op = openPlay(p, p.kind === 'ruck')
      att = op.att; def = op.def
      if (p.kind !== 'ruck') {
        // the named man is on the ball; whoever stood there takes his place
        const c = carrierIdx ?? (p.kind === 'catch' ? 14 : 11)
        const spot = att[c]
        att[c] = [0, 0]
        if (c !== 8) att[8] = spot && (spot[0] !== 0 || spot[1] !== 0) ? spot : [-4, 1]
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
      ref = { x: ux(1.5), y: clamp(vy(-4), 2, 68) }
      break
    }
    case 'kick': case 'dropout': case 'kickoff': {
      const to = p.to ?? { x: ux(30), y: p.y }
      const landU = (to.x - p.x) * dir
      const landV = (to.y - p.y) * open
      ;({ att, def } = kickChase(landU, landV))
      if (p.kind === 'kickoff' || p.kind === 'dropout') {
        // the kicking side level along the line, the others waiting in pods
        // v is measured from the ball, which sits mid-field for a kick-off
        att = att.map((_, k) => [k === 9 ? -1.5 : 0, -31 + k * 4.4] as UV)
        const recv: UV[] = [
          [12, -14], [12, -11], [13, -8], [15, 6], [15, 9], [13, 12], [17, -4], [18, 2],
          [21, 0], [27, 4], [36, -22], [30, 12], [32, 20], [36, 26], [42, 0],
        ]
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
      const op = openPlay({ ...p, x: p.x }, false)
      att = op.att.map(([u, v]) => [u * 0.7 - 2, v * 0.6] as UV)
      def = op.def.map(([u, v]) => [Math.min(u, 3) - 1, v * 0.7] as UV)
      holder = carrierIdx ?? 13
      att[holder] = [0, 0]
      ball = { x: p.x, y: p.y }
      ref = { x: p.x, y: clamp(p.y + 4, 2, 68) }
      break
    }
    case 'con': case 'goal': {
      // the kicker on his spot, his side behind him, theirs behind the posts
      const k = carrierIdx ?? 9
      att = []
      for (let j = 0; j < 15; j++) att.push(j === k ? [0, 0] : [-10 - (j % 3) * 2, -14 + j * 2])
      const goalU = (p.homeBall ? 100 : 0) - p.x
      const gu = goalU * dir
      def = []
      for (let j = 0; j < 15; j++) def.push(p.kind === 'con' ? [gu + 2.5 + (j % 2), (35 - p.y) * open - 9 + j * 1.3] : [gu - 6 - (j % 4) * 3, (35 - p.y) * open - 18 + j * 2.5])
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
  return finish(att.map(toPt), def.map(toPt))
}
