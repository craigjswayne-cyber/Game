// ---- THE SECOND LAYER: MEN, NOT UNITS (1.8.0, E12) ----
//
// The match engine decides a tick from team units: a side's attack against
// the other side's defence, each an average over fifteen men. That layer is
// the one every balance probe is built on and it stays exactly as it is.
//
// This is the layer under it, ported from the design in
// design/match-engine-csharp (Resolution.cs): every tick, each side's phase of
// attack is a contest between PEOPLE. A carrier is chosen, runs into a
// tackler, and a jackal from the defending side competes for the ball against
// the carrier's support. Who wins that collision is decided by those men's own
// attributes, and it tilts what the team layer was going to do anyway:
//
//   - a dominant carry makes a try or a penalty to the attack more likely,
//   - a dominant tackle and a good jackal make a turnover more likely.
//
// MENTAL GATES TECHNICAL (owner's research round: "mental attributes can gate
// technical ones"). A man's handling is only as good as the decisions behind
// it, and his tackling only as good as where he stands to make it:
//
//     effective technical = technical * (0.70 + 0.30 * mental)
//
// with decisions gating handling and passing, positioning gating tackling,
// vision gating the offload, and work rate gating the clear-out.
//
// CENTRED, SO THE WORLD DOES NOT MOVE. The collision is scored against the
// average collision in the world (CENTRE, measured by scripts/contestprobe.ts
// across every Premiership XV), so two average men meet at 0.5 and the tilt
// averages to nothing across a season. What it changes is WHO: a side with a
// great ball-carrying back row and a weak midfield wins the carries its
// averages would have blurred together.
//
// Pure given its inputs and the one rng it is handed, like the team layer,
// so a watched match and a silent one still take the same draws.

import type { Attrs, Player } from './model'

/** 1..20 to 0..1 */
const n20 = (v: number) => Math.max(0, Math.min(1, (v - 1) / 19))
const logistic = (x: number, k: number) => 1 / (1 + Math.exp(-k * x))
const gate = (tech: number, mental: number) => n20(tech) * (0.70 + 0.30 * n20(mental))

/** How likely each shirt is to carry into contact (1..15). Forwards and the
 *  midfield carry; the scrum-half and the fly-half mostly distribute. */
const CARRY_W = [1.0, 1.0, 1.0, 0.8, 0.8, 1.2, 1.1, 1.4, 0.15, 0.35, 0.7, 1.1, 1.1, 0.7, 0.6]
/** How likely each shirt is to make the first-up tackle. */
const TACKLE_W = [0.9, 0.9, 0.9, 1.0, 1.0, 1.4, 1.4, 1.2, 0.8, 1.0, 0.6, 1.1, 1.0, 0.6, 0.5]
/** Who goes for the ball on the floor: the back row first. */
const JACKAL_W = [0.3, 0.6, 0.3, 0.4, 0.4, 1.4, 2.0, 1.0, 0.3, 0.1, 0.1, 0.3, 0.2, 0.1, 0.1]

export interface ContestSide {
  lineup: (number | null)[]
  onPitch: Set<number>
  /** 0..100 legs left, by player id */
  energy: Map<number, number>
}

export interface Contest {
  carrier: number
  tackler: number
  jackal: number
  /** 0..1: above 0.5 the carrier won the collision */
  dominance: number
  /** metres made before the tackle */
  metres: number
  /** multiplier for the team layer's try chance this tick, centred on 1 */
  tryF: number
  /** multiplier for the penalty window in this side's favour */
  penF: number
  /** probability this phase ends in a turnover at the breakdown */
  turnover: number
}

/** The average (carrier - tackler) score across the world's first XVs, and
 *  its spread, from scripts/contestprobe.ts. Two average men meet at 0.5. */
export const CENTRE = -0.046
const SPREAD_K = 6.0

const fresh = (side: ContestSide, id: number) => 0.78 + 0.22 * ((side.energy.get(id) ?? 70) / 100)

function pickBy(ids: { id: number; w: number }[], rng: () => number): number {
  const total = ids.reduce((a, x) => a + x.w, 0)
  let r = rng() * total
  for (const x of ids) { r -= x.w; if (r <= 0) return x.id }
  return ids[ids.length - 1].id
}

function onField(side: ContestSide, weights: number[], players: Record<number, Player>) {
  const out: { id: number; w: number; p: Player }[] = []
  side.lineup.slice(0, 15).forEach((id, i) => {
    if (id == null || !side.onPitch.has(id)) return
    const p = players[id]
    if (p) out.push({ id, w: weights[i], p })
  })
  return out
}

/** the carrier's side of the collision: power, ball in hand, the footwork */
export const carryScore = (a: Attrs) =>
  0.40 * n20(a.str) + 0.25 * gate(a.han, a.dec) + 0.20 * gate(a.agi, a.dec) + 0.15 * n20(a.pac)
/** the tackler's: technique where he has read it, power, intent */
export const tackleScore = (a: Attrs) =>
  0.50 * gate(a.tac, a.pos) + 0.30 * n20(a.str) + 0.20 * n20(a.agg)

/**
 * One phase of attack by `att` into `def`. Returns null when either side has
 * nobody on the field (a match that has been abandoned in all but name).
 *
 * Draws exactly FOUR numbers from rng, always, so the draw count never
 * depends on who is on the pitch.
 */
export function resolveContest(att: ContestSide, def: ContestSide, players: Record<number, Player>, rng: () => number): Contest | null {
  const carriers = onField(att, CARRY_W, players)
  const tacklers = onField(def, TACKLE_W, players)
  const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng()
  if (!carriers.length || !tacklers.length) return null
  let i1 = 0
  { let t = carriers.reduce((a, x) => a + x.w, 0) * r1; for (i1 = 0; i1 < carriers.length - 1; i1++) { t -= carriers[i1].w; if (t <= 0) break } }
  let i2 = 0
  { let t = tacklers.reduce((a, x) => a + x.w, 0) * r2; for (i2 = 0; i2 < tacklers.length - 1; i2++) { t -= tacklers[i2].w; if (t <= 0) break } }
  const c = carriers[i1], tk = tacklers[i2]
  const jackals = onField(def, JACKAL_W, players).filter(x => x.id !== tk.id)
  const jackalId = jackals.length ? pickBy(jackals, () => r3) : tk.id
  const j = players[jackalId]

  // ---- the collision
  const cs = fresh(att, c.id) * carryScore(c.p.a)
  const ts = fresh(def, tk.id) * tackleScore(tk.p.a)
  const d = logistic(cs - ts - CENTRE, SPREAD_K)

  // ---- the clear-out: the carrier's forwards, gated by their work rate
  const support = carriers.filter(x => x.id !== c.id).sort((a, b) => b.w - a.w).slice(0, 3)
  const cleanout = support.length
    ? support.reduce((a, s) => a + fresh(att, s.id) * (0.6 * gate(s.p.a.ruc, s.p.a.wor) + 0.4 * n20(s.p.a.str)), 0) / support.length
    : 0.3
  const jackalThreat = j ? fresh(def, jackalId) * gate(j.a.ruc, j.a.pos) : 0.3

  // ---- what it does to the team layer, centred on 1 at d = 0.5
  // (the try tilt is deliberately small: it decides WHO wins the carries a
  // side's units already earned, not whether a weak side becomes a strong one)
  // divided by their world means (contestprobe), so each averages exactly 1
  const tryF = Math.exp(0.5 * (d - 0.5)) / 1.0060
  const penF = Math.exp(0.35 * (d - 0.5)) / 1.0029
  const turnover = Math.max(0, Math.min(0.2, 0.05 * (1.5 - d) * (0.6 + jackalThreat) * (1.3 - 0.6 * cleanout)))
  const metres = Math.max(-3, 1.5 * (0.6 + 4 * d) + (r4 - 0.5) * 3)
  return { carrier: c.id, tackler: tk.id, jackal: jackalId, dominance: d, metres, tryF, penF, turnover }
}
