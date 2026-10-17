// The day's form: each unit up or down on the day, on its own stream. Split
// out of matchEngine.ts, which re-exports the public parts.
import type { GameState } from '../model'
import { clamp, mulberry32, type Rng } from '../rng'
import { teamShort } from './selection'
import { colour } from './commentary'
import { type SideCtx, layer } from './side'
import type { LiveCtx } from './live'

/**
 * ---- THE AFTERNOON'S INCIDENTS (1.8.16) ----------------------------------
 *
 * The owner sat through a season of real broadcasts (TNT Sports' Prem, the
 * play-offs, the Quilter Nations Series) and wrote down everything that
 * happened in them that this engine could not: the penalty try and the yellow
 * that goes with it, the intercept run in from halfway, the TMO calling back
 * a high shot after play had gone on, held up over the line and the goal-line
 * drop-out, free kicks, the 50:22, the kick that goes out on the full, the
 * referee's word with the captain, the scuffle, the warm-up withdrawal. His
 * brief: "its important each game feels different and authentic. We need
 * randomness amongst all the tactics."
 *
 * THE INCIDENT DICE. Every one of these changes a match, so none of them is
 * the commentary's (crng). But none of them draws on the shared stream either:
 * each decision comes off a small stream of its own, seeded from the match's
 * kickSeed (taken once from rng at kick-off) and the tick, the side and what
 * is being decided. So a side that is never in position for an intercept
 * still has every other dice of the afternoon where it was, which keeps the
 * common random numbers optionsprobe and dialweight depend on. What an
 * incident then DOES (who scores, the conversion, the card's front-row law)
 * is run on the same incident stream (withRng), for the same reason.
 *
 * Wording stays on crng, as everywhere else in this file.
 */
export type DayUnit = 'scrum' | 'lineout' | 'breakdown' | 'kicking' | 'attack' | 'defence'
const DAY_UNITS: DayUnit[] = ['scrum', 'lineout', 'breakdown', 'kicking', 'attack', 'defence']
/** how much each unit can be up or down on the day, one standard deviation.
 *  The set piece swings most (a lineout that will not fire is the most
 *  common story of a bad afternoon); attack and defence least, because they
 *  reach the try chance through a power of 2.6. */
const DAY_SD: Record<DayUnit, number> = { scrum: 0.05, lineout: 0.06, breakdown: 0.045, kicking: 0.05, attack: 0.022, defence: 0.022 }
/** how far the plan clicks or stalls on the day: scales what called moves
 *  and zone plans are worth, never their direction */
const EXEC_SD = 0.15

/** a stream for one decision: the match, the tick, the side and the question */
export function incRng(ctx: LiveCtx, tick: number, side: SideCtx | null, salt: number): Rng {
  const s = ((ctx.kickSeed ?? (ctx.fx.id | 0)) ^ Math.imul(tick + 11, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)
    ^ (side == null ? 0x2f1 : side === ctx.home ? 0x1d0f5 : 0x7a31b)) >>> 0
  return mulberry32(s || 1)
}

/** run `fn` with ctx.rng set to `r`, so whatever it draws comes off `r` */
export function withRng<T>(ctx: LiveCtx, r: Rng, fn: () => T): T {
  const was = ctx.rng
  ctx.rng = r
  try { return fn() } finally { ctx.rng = was }
}

/** a standard normal off a stream (Box-Muller) */
function normalOf(r: Rng): number {
  const u = Math.max(1e-9, r())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

/**
 * THE DAY (1.8.16, owner: "each game feels different"). Every side turns up
 * with a lineout that fires or does not, a scrum that is on top or under it,
 * a boot that finds touch or slices it. Drawn once at kick-off, mean-neutral
 * (a lognormal with its drift taken out), layered so a substitution keeps it,
 * and the same whether anybody is watching. The plan itself clicks or stalls
 * too (exec), which is the "randomness amongst all the tactics": the same
 * tactics are worth more on one Saturday than the next.
 */
export function dealTheDay(ctx: LiveCtx, uncontested = false) {
  for (const side of [ctx.home, ctx.away]) {
    const r = incRng(ctx, -2, side, 0xDA7)
    const day: Partial<Record<DayUnit, number>> = {}
    for (const u of DAY_UNITS) {
      const sd = DAY_SD[u]
      const m = Math.exp(sd * normalOf(r) - (sd * sd) / 2)
      day[u] = clamp(m, 1 - 3 * sd, 1 + 3 * sd)
      // an uncontested scrum has no good day or bad one (the draw is still
      // taken, so the units after it are dealt the same)
      if (u === 'scrum' && uncontested) { day[u] = 1; continue }
      layer(side, u, day[u]!)
    }
    side.day = day
    side.exec = clamp(Math.exp(EXEC_SD * normalOf(r) - (EXEC_SD * EXEC_SD) / 2), 0.4, 1.8)
  }
}

/** The day, in words, once it has had time to show: the unit furthest from
 *  normal for each side, at about twenty minutes, and the plan by the hour. */
export function describeDay(state: GameState, ctx: LiveCtx, tick: number) {
  if (!ctx.detail || (tick !== 5 && tick !== 14)) return
  for (const side of [ctx.home, ctx.away]) {
    const team = teamShort(state, side.teamId)
    if (tick === 5 && side.day) {
      let best: DayUnit | null = null, far = 0
      for (const u of DAY_UNITS) {
        if (u === 'attack' || u === 'defence') continue
        const d = Math.abs((side.day[u] ?? 1) - 1) / DAY_SD[u]
        if (d > far) { far = d; best = u }
      }
      if (best && far >= 1.3) {
        const up = (side.day[best] ?? 1) > 1
        colour(state, ctx, side, `comm.day_${best}${up ? 'Up' : 'Down'}`, { team })
      }
    }
    if (tick === 14 && side.exec != null) {
      if (side.exec >= 1.35) colour(state, ctx, side, 'comm.day_planClicks', { team })
      else if (side.exec <= 0.7) colour(state, ctx, side, 'comm.day_planStalls', { team })
    }
  }
}
