// Leagues, finals and results: the pyramid's tiers, who goes down, where a
// final is played, a club's run of form, who went through a tie.
import { mulberry32 } from '../rng'
import type { FinalVenue, Fixture, GameState } from './types'

/** Consecutive competitive games without defeat this season, newest backwards.
 *  A loss ends it; a draw extends it; friendlies are wind, not weather - they
 *  neither extend nor break the run. Feeds The Scalp (16C): a long unbeaten
 *  season paints a target on the shirt. */
export function unbeatenRun(state: GameState, clubId: string): number {
  let run = 0
  const mine = state.fixtures
    .filter(f => f.played && f.compId !== 'fr' && (f.homeId === clubId || f.awayId === clubId))
    .sort((a, b) => a.week - b.week)
  for (let i = mine.length - 1; i >= 0; i--) {
    const f = mine[i]
    const us = f.homeId === clubId ? f.homeScore : f.awayScore
    const them = f.homeId === clubId ? f.awayScore : f.homeScore
    if (us < them) break
    run++
  }
  return run
}

/** The Home hub's form pips: the last n played fixtures in WEEK order, oldest
 *  first. Reported live with two screenshots: the fixture list showed a loss
 *  away at Sale inside the last five, the hub said W W W W W. The hub was
 *  slicing the last five played fixtures in ARRAY order, and the fixtures
 *  array is not week order: cup rounds and arranged friendlies are appended
 *  to the end as they are drawn, so once a knockout round is played the slice
 *  reads the array tail and a by-date result falls out. The dash panel one
 *  card below learned this exact lesson (see its comment); the pips never
 *  got the sort. */
export function formGuide(state: GameState, clubId: string, n = 5, competitive = false): ('W' | 'L' | 'D')[] {
  return state.fixtures
    .filter(f => f.played && (f.homeId === clubId || f.awayId === clubId) && (!competitive || f.compId !== 'fr'))
    .sort((a, b) => a.week - b.week)
    .slice(-n)
    .map(f => {
      const us = f.homeId === clubId ? f.homeScore : f.awayScore
      const them = f.homeId === clubId ? f.awayScore : f.homeScore
      return us > them ? 'W' : us < them ? 'L' : 'D'
    })
}

/** The grounds big enough to host a European final: every one of them 60,000
 *  seats or more, and every one of them has actually staged top-flight rugby.
 *  Both European finals share the venue on the same weekend, as in life. */
export const EURO_FINAL_VENUES: FinalVenue[] = [
  { name: 'Greater Twickenham', city: 'London', capacity: 82000 },
  { name: 'Grand Stade de Paris', city: 'Paris', capacity: 80698 },
  { name: 'Cardiff National Stadium', city: 'Cardiff', capacity: 74500 },
  { name: 'Marseille Stadium', city: 'Marseille', capacity: 67394 },
  { name: 'Edinburgh Stadium', city: 'Edinburgh', capacity: 67144 },
  { name: 'Crocker Park', city: 'Dublin', capacity: 82300 },
  { name: 'Greater London Stadium', city: 'London', capacity: 90000 },
]

/** Where a competition's final is played, or null for finals that stay at the
 *  higher seed's ground (UPC, Championship, the southern leagues - which is
 *  how those competitions actually do it).
 *
 *  The Premier Division final is ALWAYS Twickenham and the Elite 14 final is always
 *  the Stade de France. The European finals rotate: a deterministic pick from
 *  the save's seed and the season, so the announcement, the fixture and any
 *  reload all agree without storing anything - and never the same city two
 *  seasons running. NO shared rng is drawn: venue choice must not move a
 *  match stream. */
export function finalVenue(state: GameState, compId: string): FinalVenue | null {
  if (compId === 'prem') return EURO_FINAL_VENUES[0]
  if (compId === 'top14') return EURO_FINAL_VENUES[1]
  if (compId !== 'cc' && compId !== 'chc') return null
  const idx = (season: number) =>
    Math.floor(mulberry32(Math.abs(state.seed) * 7919 + season * 104729)() * EURO_FINAL_VENUES.length)
  let i = idx(state.season)
  if (state.season > 0 && i === idx(state.season - 1)) i = (i + 1) % EURO_FINAL_VENUES.length
  return EURO_FINAL_VENUES[i]
}

/** Leagues where the bottom club goes down. ONE list: the table's shading,
 *  the new-career media verdict and the pundits' predictions all read it, so
 *  no screen can threaten relegation in a league that has none. */
// 'prem' left the list in 1.6.3 on the real-world ringfence and came back in
// 1.6.5 on the owner's decision (runtime brief, section 2): relegation from
// the English top flight is deliberate game design. The Championship
// relegates to National One and the French Elite 14 swaps with Elite 2.
export const RELEGATES = ['prem', 'champ', 'top14']

/** The pyramid by tier: 1 the top flights, 2 the second divisions, 3 National
 *  League One. Loan gravity reads it - how far down a move is decides who
 *  would actually make it. */
export const LEAGUE_TIER: Record<string, number> = {
  // the MRC is a top flight with nowhere above it to reach: tier 1, like Japan's,
  // so no club in it is offered a promotion dream it can never win
  prem: 1, top14: 1, urc: 1, srp: 1, jl1: 1, mrc: 1,
  champ: 2, prod2: 2,
  natl1: 3,
}
export const leagueTier = (leagueId?: string | null): number => LEAGUE_TIER[leagueId ?? ''] ?? 2

/** Who went through: the side with more points, or for a tie level after
 *  extra time, the side the try count or the kicks sent through (1.8.16). */
export function tieWinner(fx: Pick<Fixture, 'homeId' | 'awayId' | 'homeScore' | 'awayScore' | 'decider'>): string {
  if (fx.homeScore !== fx.awayScore) return fx.homeScore > fx.awayScore ? fx.homeId : fx.awayId
  return fx.decider?.winner ?? fx.homeId
}
