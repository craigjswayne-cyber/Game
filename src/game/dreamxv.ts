// The Dream Team of a league round, in one place.
//
// The Dream Team screen picks the best rated man FOR EACH SHIRT; the day
// room's card counted "your men in it" off the top fifteen ratings of the
// round, whatever their positions. The two disagreed whenever a position was
// crowded: the owner was told six Montauban men made the XV while the screen
// showed eight (French Elite 2, round 6). Both now read this.
import { XV_SLOTS, type GameState, type Player } from './model'

/** The week this league last played, 0 if it has not. */
export function lastLeagueWeek(game: GameState, leagueId: string): number {
  let wk = 0
  for (const f of game.fixtures) if (f.compId === leagueId && f.played && f.week > wk) wk = f.week
  return wk
}

/** One man per XV shirt, best rating first, each man used once. */
export function roundXV(game: GameState, leagueId: string, week: number): { slot: typeof XV_SLOTS[number]; p: Player | null }[] {
  const pool = Object.values(game.players).filter(p =>
    p.clubId && game.clubs[p.clubId]?.leagueId === leagueId &&
    p.lastWk === week && p.lastR != null)
  const used = new Set<number>()
  return XV_SLOTS.map(slot => {
    const best = pool
      .filter(p => !used.has(p.id) && (p.pos === slot.pos || p.alt.includes(slot.pos)))
      .sort((a, b) => (b.lastR ?? 0) - (a.lastR ?? 0))[0]
    if (best) used.add(best.id)
    return { slot, p: best ?? null }
  })
}
