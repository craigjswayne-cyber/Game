// Moving the club's cash into the transfer budget (user: "should be able to
// transfer balance into transfer money").
//
// The board's own rule, applied to the manager's request: the club keeps a
// season of wages plus a four million float in the bank - the exact reserve
// boardReinvests protects before it sweeps surplus into the estate - and
// anything above it the manager may put to work in the market, in 500k
// slices, so a fat balance is a series of decisions rather than one button
// that empties the account. The trade is real, not decorative: cash moved to
// the budget is cash the summer sweep can no longer turn into facilities,
// and the reserve floor means a club living on its overdraft cannot buy its
// way out through this door.

import type { GameState } from './model'
import { SEASON_WEEKS, fmtMoney, logDecision } from './model'

export const RELEASE_STEP = 500_000

/** The bank the board will not let the club dip under: a season of wages
 *  plus a float. Kept in lockstep with boardReinvests' reserve. */
export function cashReserve(state: GameState): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  const weekly = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  return Math.round(weekly * SEASON_WEEKS + 4_000_000)
}

/** Why the next 500k cannot move, or null if it can. Read by the BUTTON (to
 *  grey out and say the shortfall) and by the ACTION (to refuse) - the reason
 *  sits in front of the decision, through one predicate both sides share
 *  (the Training.tsx lesson: a row that offers a button and a handler that
 *  refuses it is the bug written twice). */
export function releaseBlock(state: GameState): string | null {
  if (state.unemployed) return 'No club, no treasury.'
  const club = state.clubs[state.userClubId]
  if (!club) return 'No club, no treasury.'
  if (club.balance - RELEASE_STEP < cashReserve(state)) {
    return `The board keeps ${fmtMoney(cashReserve(state))} banked - a season of wages plus a float - and the balance cannot dip below it.`
  }
  return null
}

/** Move one 500k slice of the club's cash into the transfer budget. */
export function releaseToBudget(state: GameState): { ok: boolean; msg: string } {
  const block = releaseBlock(state)
  if (block) return { ok: false, msg: block }
  const club = state.clubs[state.userClubId]
  club.balance -= RELEASE_STEP
  club.budget += RELEASE_STEP
  logDecision(state, `Moved ${fmtMoney(RELEASE_STEP)} from the bank into the transfer budget.`, true)
  return { ok: true, msg: `${fmtMoney(RELEASE_STEP)} moved into the transfer budget. The bank stands at ${fmtMoney(club.balance)}, the budget at ${fmtMoney(club.budget)}.` }
}
