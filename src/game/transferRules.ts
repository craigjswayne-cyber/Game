// The transfer market's standing rules: who is barred, who is spoken for,
// what a club asks, the ink gate and the 46-man limit. Moved out of ai.ts so
// the modules ai.ts itself imports (living, recruit, scout, aiecon, rivalbids)
// can read them without importing ai back; ai.ts re-exports all of them.
import type { GameState, PendingDeal, Player } from './model'
import { unsettledFee } from './unsettled'

/** Is the club barred from signing anybody for a cap breach? */
export function embargoed(state: GameState, clubId: string): boolean {
  const until = state.clubs[clubId]?.capEmbargoUntil
  return typeof until === 'number' && state.season <= until
}

/** The deal agreed for this man while the window was shut, if there is one. */
export function pendingDeal(state: GameState, playerId: number): PendingDeal | undefined {
  return (state.pendingDeals ?? []).find(d => d.playerId === playerId)
}

/** Spoken for: a pre-contract elsewhere, or a deal agreed and waiting on the
 *  window. AI clubs leave such a man alone. */
export function promisedElsewhere(state: GameState, playerId: number): boolean {
  return (state.preContracts ?? []).some(pc => pc.playerId === playerId) || !!pendingDeal(state, playerId)
}

/**
 * THE FREE-AGENT FLIP (1.8.5 career QA). The ink gate (INK_WEEKS) stopped a
 * man signed for nothing being sold on at once, but not at all: sign every
 * free agent worth a fee, list each once the ink is dry, and the bids came
 * in at his value. Measured on a manager who did only that (Leicester, eight
 * to twelve seasons, two worlds): 18 to 37 million a season clear in 1.8.4
 * and in this release alike, against about half a million for the same club
 * left alone. The AI clubs taking the 85-rated stars from the pool changed
 * nothing: the manager has first pick of the pool every week.
 *
 * A market that let a man sit in the pool for nothing does not pay his full
 * value to have him back while he is still on the deal he signed for
 * nothing: until that deal's term is out (freeUntil, fixed when he signs, so
 * an early renewal does not wash it) bids for him come in at FREE_RESALE of
 * the usual fee. Measured at a half, a flipper still cleared 17-24 million a
 * season, because he simply sold more men; asking the bidders to carry his
 * wage (the free-agent test) took nothing off at all. At a quarter the same
 * manager clears 0 to 17 million a season over four runs (selling at once,
 * or holding each man to the end of his free deal; one was sacked inside a
 * season and cleared nothing). What is left is mostly the holding: after the
 * term he is an ordinary player again, two seasons of wages and a squad
 * place later, and sells at his value.
 */
export const FREE_RESALE = 0.25
export function freeDeal(state: GameState, p: Player): boolean {
  return p.freeUntil != null && state.season < p.freeUntil
}

/** Asking price for a player from his current club's perspective. */
export function askingPrice(state: GameState, p: Player): number {
  const club = p.clubId ? state.clubs[p.clubId] : null
  if (!club) return 0
  let f = 1.15
  if (p.transferListed) f = 0.8
  // ranked against the SENIOR squad: the key-man test asks whether he is one of
  // the eight a club builds its side on, and a scholar is never that man
  const squadCa = club.players.map(id => state.players[id]).filter(q => q && !q.acad)
    .map(q => q.ca).sort((a, b) => b - a)
  const isKey = p.ca >= (squadCa[7] ?? 70) // top-8 player at the club
  if (isKey && !p.transferListed) f = 1.7
  // SURPLUS IS PRICED AS SURPLUS (1.8.14). A club's 28th man cost 1.15 times his
  // value, the same as a regular starter, so a mid-table club with £2-3M found
  // about one man a window it could afford who would walk into its side, and a
  // "moneyball" approach had nothing to buy. Outside his club's best 23 he is
  // offered at 0.8 of his value, and outside its best 30 at 0.65 - the men a
  // big squad carries and would rather have off the wage bill.
  else if (!p.transferListed && p.ca < (squadCa[29] ?? -1)) f = 0.65
  else if (!p.transferListed && p.ca < (squadCa[22] ?? -1)) f = 0.8
  // an unsettled man is cheaper (recruit.ts unsettledFee): up to 15% off for
  // one who has asked to leave or whose mood has gone, graded rather than the
  // old single step at morale 3.5
  f *= unsettledFee(p)
  return Math.round((p.value * f) / 10_000) * 10_000
}

/** no AI club bids for a man the manager signed fewer weeks ago than this */
export const INK_WEEKS = 22

/** The registration limit every AI club is held to at the rollover (46
 *  seniors, rollover.ts) applied to the user's signings as well (1.6.3): the
 *  user could sign free agents to 73 while the world was culled at 46. */
export const SQUAD_LIMIT = 46
export function squadFull(state: GameState, club: { players: number[] }): boolean {
  return seniorsOf(state, club) >= SQUAD_LIMIT
}

/** The men who count against the 46. A hand-demoted senior is one of them: the
 *  demotion moves him to the academy LIST, the same way it leaves him on the
 *  cap bill, or the button is a way round the limit. */
export function seniorsOf(state: GameState, club: { players: number[] }): number {
  return club.players.reduce((n, id) => {
    const p = state.players[id]
    return n + (p && (!p.acad || p.demoted) ? 1 : 0)
  }, 0)
}
