import type { GameState, Player } from './model'
import { kickRecord, tackleRecord, type KickLine } from './model'

/**
 * ---- THE SEASON'S STATS ----
 *
 * Owner, 1.9.13: "top tacklers appear but goal kickers are in a different
 * place. I also think this should be in its own section maybe in a tab to the
 * right of fixtures, league table." The boards lived under the Team of the
 * Week; they are now the Fixtures screen's Stats tab, with more on them.
 *
 * The figures are each player's season, in every competition (they are wiped
 * at the summer with every other season figure, rollover closeSeasonStats).
 * The pool is the players at the clubs in the chosen competition. Every board
 * here reads a count the game already keeps; nothing is drawn.
 */

/** Kicks at goal before a kicker is ranked on the rate, so one from one is
 *  not the best boot in the league. */
export const MIN_KICKS = 10
/** Tackles made and missed before the success rate ranks anybody. */
export const MIN_TACKLES = 30
/** Appearances before an average rating ranks anybody. */
export const MIN_APPS_RATED = 3
const TOP = 5

export interface StatRow { p: Player; n: number; line?: KickLine; y?: number; r?: number }
export interface TeamRow { teamId: string; n: number }

export interface SeasonBoards {
  rating: StatRow[]
  tries: StatRow[]
  points: StatRow[]
  tackles: StatRow[]
  tackleRate: StatRow[]
  kickers: StatRow[]
  motm: StatRow[]
  drops: StatRow[]
  cards: StatRow[]
  /** from the competition's own table: absent for a cup with no table */
  teamTries: TeamRow[]
  defence: TeamRow[]
}

const top = (rows: StatRow[], by: (a: StatRow, b: StatRow) => number) =>
  rows.filter(r => r.n > 0).sort((a, b) => by(a, b) || a.p.id - b.p.id).slice(0, TOP)

export function seasonBoards(state: GameState, compId: string): SeasonBoards {
  const comp = state.comps[compId]
  const clubs = new Set(comp?.teamIds ?? [])
  const pool = Object.values(state.players).filter(p => p.clubId && clubs.has(p.clubId) && p.stats.apps > 0)
  const row = (p: Player, n: number): StatRow => ({ p, n })
  const desc = (a: StatRow, b: StatRow) => b.n - a.n

  const rating = top(pool.filter(p => p.stats.apps >= MIN_APPS_RATED)
    .map(p => row(p, p.stats.ratingSum / p.stats.apps)), desc)
  const tries = top(pool.map(p => row(p, p.stats.tries)), desc)
  const points = top(pool.map(p => row(p, p.stats.points)), desc)
  const tackles = top(pool.map(p => row(p, p.stats.tkl ?? 0)), desc)
  const tackleRate = top(pool.flatMap(p => {
    const t = tackleRecord(p.stats)
    return t && t.att >= MIN_TACKLES ? [{ p, n: t.pct, line: t }] : []
  }), (a, b) => b.n - a.n || b.line!.made - a.line!.made)
  const kickers = top(pool.flatMap(p => {
    const k = kickRecord(p.stats).all
    return k && k.att >= MIN_KICKS ? [{ p, n: k.pct, line: k }] : []
  }), (a, b) => b.n - a.n || b.line!.made - a.line!.made)
  const motm = top(pool.map(p => row(p, p.stats.motm)), desc)
  const drops = top(pool.map(p => row(p, p.stats.drops)), desc)
  // a red is worth two yellows on the discipline board, as on a citing list
  const cards = top(pool.map(p => ({ p, n: p.stats.yc + p.stats.rc * 2, y: p.stats.yc, r: p.stats.rc })), desc)

  const table = (comp?.table ?? []).filter(r => r.p > 0)
  const teamTries = [...table].sort((a, b) => b.tf - a.tf || a.teamId.localeCompare(b.teamId))
    .slice(0, TOP).map(r => ({ teamId: r.teamId, n: r.tf }))
  // the fewest conceded a game, so a side with a match in hand is not flattered
  const defence = [...table].sort((a, b) => a.pa / a.p - b.pa / b.p || a.teamId.localeCompare(b.teamId))
    .slice(0, TOP).map(r => ({ teamId: r.teamId, n: Math.round(r.pa / r.p * 10) / 10 }))

  return { rating, tries, points, tackles, tackleRate, kickers, motm, drops, cards, teamTries, defence }
}
