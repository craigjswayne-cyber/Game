// Match ratings' team term and the tank: how a man tires by his own work.
// Split out of matchEngine.ts, which re-exports the public parts.
import type { GameState } from '../model'
import { inRedZone } from '../model'
import type { SideCtx } from './side'
import type { LiveCtx } from './live'

/**
 * ---- WHAT THE EIGHTY MINUTES WERE WORTH TO EVERYONE WHO PLAYED ----
 *
 * User, after winning 75-7: "this was the player rating - feels off?" Nine of
 * his fifteen sat on 6.0 while the wing who scored took 9.6.
 *
 * He was right, and the measurement was worse than the impression. Over four
 * seasons at Northampton the banked ratings read:
 *
 *   won by 15-39   mean 6.73   26% rated 7+
 *   won by 1-14    mean 6.68   23% rated 7+
 *   lost by 1-14   mean 5.82    3% rated 7+
 *   lost by 15+    mean 5.81    3% rated 7+
 *
 * A thirty-point win and a one-point win were 0.05 apart. Losing by three and
 * losing by forty were identical. The scoreboard was a win/loss SWITCH and
 * nothing more, because the only thing that meaningfully moved a mark was
 * scoring a try (+0.9) with a trickle for the goal kicker (+0.15). Nothing in
 * the model knew the difference between a hammering and a scrap.
 *
 * Two terms, both shared by every man who got on the pitch:
 *
 *   THE RESULT, which is symmetric. A win is +0.45 and a defeat -0.45, where it
 *   used to be +0.5 against -0.3 with a draw punished as a non-win. Symmetric
 *   means the two sides of any fixture cancel, so the world's mean rating is
 *   held by construction rather than by hoping - and a draw is now neutral,
 *   which is what a draw is.
 *
 *   THE MARGIN, also symmetric, capped so that a cricket score cannot hand out
 *   nines. 28 points is the divisor because that is roughly the gap at which a
 *   game stops being a contest; the cap lands 75-7 on the ceiling, which is
 *   where the manager who asked would put it.
 *
 * WHAT IS DELIBERATELY NOT HERE. A term for winning the scrum or the breakdown
 * was drafted and cut. The unit figures it would read carry the tactical dials,
 * so a rating built on them could be farmed by a slider - and ratings feed form,
 * which feeds selection. That is the free-lunch shape the kicking dial had, and
 * dialweight cannot currently resolve effects that small (docs/archive/audit-handoff).
 * The forwards/backs gap is real and measured (7% of forwards rated 7+ against
 * 18% of backs); it is not closed here, because closing it with a number nobody
 * can validate is how the last three calibrations got reverted.
 */
const RATING_RESULT = 0.45
const RATING_MARGIN_DIV = 28
const RATING_MARGIN_CAP = 0.9
// A HAMMERING OUTRANKS A HANDSOME WIN (user, after the 106-3: "player ratings
// feel better but still a little way off for a 106-3 game"). The main slope
// caps at a 25-point margin so a cricket score cannot hand out nines on its
// own - but capping dead flat meant 31-6 and 106-3 paid every man exactly the
// same. Past the cap the term keeps climbing at about a fifth of the slope,
// to its own hard ceiling: the full extra +0.35 arrives by a 53-point margin.
// Exactly symmetric, so the two sides of any fixture still cancel and the
// world's mean mark holds by construction; and the team term still never
// reaches form, so the autopilotprobe lesson stands untouched.
const RATING_TAIL_DIV = 80
const RATING_TAIL_CAP = 0.35

export function teamRatingTerm(side: SideCtx, other: SideCtx): number {
  const margin = side.score - other.score
  const result = margin > 0 ? RATING_RESULT : margin < 0 ? -RATING_RESULT : 0
  const a = Math.abs(margin)
  const tail = Math.min(RATING_TAIL_CAP, Math.max(0, (a - RATING_MARGIN_CAP * RATING_MARGIN_DIV) / RATING_TAIL_DIV))
  const by = Math.sign(margin) * (Math.min(RATING_MARGIN_CAP, a / RATING_MARGIN_DIV) + tail)
  return result + by
}

/** Average remaining energy of a side's on-pitch players, 0-100. */
/** each shirt's share of the work (1.9.0, drainEnergy), before scrums */
const ROLE_DRAIN: Record<string, number> = {
  LP: 0.99, HK: 0.99, TP: 0.99, LK: 1.08, FL: 1.13, N8: 1.12,
  SH: 1.0, FH: 0.93, CE: 0.99, WG: 1.03, FB: 0.99,
}
/** and what a scrum costs, by shirt: the front row most, the locks behind */
const SCRUM_DRAIN: Record<string, number> = { LP: 0.30, HK: 0.27, TP: 0.30, LK: 0.12, FL: 0.05, N8: 0.06 }
/** a side packs down about 0.64 scrums a tick (both feeds), which adds 0.81
 *  to the fifteen shirts' summed share; DRAIN_NORM takes the average back to
 *  the old (8 x 1.1 + 7 x 1.0) / 15 = 1.053, so the world tires as fast as it
 *  did and only who tires moves (scripts/packprobe.ts measures it) */
const DRAIN_NORM = 0.97
/** THE PRICE OF THE HALF-TIME BREAK (1.9.2). blowHalfTime gives everyone on
 *  the pitch 10 points back (finalize.ts HT_RECOVERY), and the drain is this
 *  much steeper so a side's energy averaged over the eighty minutes is where
 *  it was. Measured on 1,401 fixtures of seed 4242: mean on-pitch energy 27.42
 *  before, 27.44 with the break and 1.09; at the final whistle 21.5 against
 *  20.6; points a game inside the seed's noise (49.2 against 50.2, with the
 *  unchanged engine itself moving 49.2 to 49.8 between drain settings). */
const DRAIN_HT_K = 1.09
function roleDrain(pos: string, scrums: number): number {
  return ((ROLE_DRAIN[pos] ?? 1) + (SCRUM_DRAIN[pos] ?? 0) * scrums) * DRAIN_NORM
}

export function sideEnergy(side: SideCtx): number {
  let sum = 0, n = 0
  for (const id of side.onPitch) { sum += side.energy.get(id) ?? 70; n++ }
  return n ? sum / n : 70
}

export const FW_POS = new Set(['LP', 'HK', 'TP', 'LK', 'FL', 'N8'])

/** Drain the petrol tanks of everyone on the pitch for one tick. */
export function drainEnergy(state: GameState, ctx: LiveCtx, side: SideCtx) {
  // snow and a hot afternoon both take more out of a man (heat, 1.8.16)
  const wF = ctx.weather === 'Snow' ? 1.1 : ctx.hot ? 1.08 : 1
  for (const id of side.onPitch) {
    const p = state.players[id]
    if (!p) continue
    const base = (2.0 + (20 - p.a.sta) * 0.14) * (inRedZone(p) ? 1.12 : 1)
    // A MAN TIRES BY WHAT HE DID (1.9.0). One 1.1 for every forward and 1.0
    // for every back meant a loosehead who had packed down fourteen times was
    // as fresh as a blindside. Each shirt now has its own workload, and the
    // front row and locks pay for every scrum this tick (setPieceTick). The
    // weights are normalised so a side's average drain is what it was: the
    // scoring bands do not move, but who is spent at 60 minutes does.
    const posF = roleDrain(p.pos, side.spScrums ?? 0)
    const e = side.energy.get(id) ?? 80
    side.energy.set(id, Math.max(0, e - base * side.tempoF * side.drainF * (side.repF ?? 1) * posF * wF * DRAIN_HT_K))
  }
}
