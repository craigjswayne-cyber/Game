import type { GameState, MatchEvent, Fixture } from '../game/model'
import { tIn } from '../game/i18n'
import { hasSupporter, tillOpen } from '../game/monetise'
import { isKnockoutTie, resolveKnockoutDraw, weekRng } from '../game/season'
import type { LiveCtx } from '../game/matchEngine'
import { isHighlight } from '../game/highlights'
import { proMatchPlayed, readFunnel, writeFunnel } from '../game/profunnel'
import { countMatch } from '../game/usage'

/** ONE COMPETITIVE MATCH COMPLETED, FOR THE PRO MANAGER CADENCE (1.8.6).
 *
 *  Device state only (game/profunnel.ts): nothing here reads the rng or
 *  writes the career. Friendlies do not count, nothing counts once Pro is
 *  owned, and nothing counts where there is no store to buy it from. Called
 *  at each of the four places a match of the manager's ends - the live
 *  whistle, the assistant's result, a walkover and a match played out on
 *  reload - and keyed by career and fixture, so no match counts twice. */
export function countForPro(g: GameState, fx: Pick<Fixture, 'id' | 'compId'> | null | undefined) {
  if (!fx || fx.compId === 'fr') return
  // the feedback report's match count (game/usage.ts) rides the same four
  // places and the same key, and counts whatever the store: device state,
  // never the career, never the rng
  countMatch(`${g.seed}:${g.season}:${fx.id}`, `${g.seed}:${g.season}`)
  if (!tillOpen() || hasSupporter()) return
  const f = readFunnel()
  const n = proMatchPlayed(f, `${g.seed}:${g.season}:${fx.id}`)
  if (n !== f) writeFunnel(n)
}

/** The cursor position that reveals the next highlight, or the end of what has
 *  been simulated so far. Always advances by at least one so the ticker can
 *  never stall on a quiet passage. What counts as a highlight depends on how
 *  close the game is (game/highlights.ts, 1.8.0).
 *
 *  'SUB' lines are not highlights by type: the engine uses them for
 *  substitutions but also for atmosphere lines, the half-time numbers and the
 *  penalty prompt. Touchline decisions and intervals still halt play through
 *  ctx.decision and ctx.awaiting, which is where those stops belong. */
export function nextHighlight(events: MatchEvent[], cursor: number, homeId: string): number {
  let c = cursor
  while (c < events.length && !isHighlight(events, c, homeId)) c += 1
  return Math.min(events.length, Math.max(cursor + 1, c + 1))
}

/** After a tick hits FT: knockout ties are settled in sudden-death extra time. */
export function settleKnockout(g: GameState, ctx: LiveCtx) {
  const fx = ctx.fx
  if (isKnockoutTie(fx) && fx.homeScore === fx.awayScore) {
    // EXTRA TIME, THEN TRIES, THEN THE KICKS (1.8.16): every step of it on
    // the ticker, as keys like every other line (this used to be one line of
    // English, the same in a French match)
    const h0 = fx.homeScore, a0 = fx.awayScore
    const lines = resolveKnockoutDraw(g, fx, weekRng(g))
    let hs = h0, as = a0
    for (const l of lines) {
      if (l.type === 'TRY' || l.type === 'PEN') {
        const pts = l.k === 'comm.etTryCon' ? 7 : l.k === 'comm.etTry' ? 5 : 3
        if (l.teamId === fx.homeId) hs += pts; else as += pts
      }
      ctx.events.push({ min: l.min, type: l.type, teamId: l.teamId, text: tIn('en', l.k, l.v), k: l.k, v: l.v, homeScore: hs, awayScore: as })
    }
    fx.events = ctx.events
  }
}
