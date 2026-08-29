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
import { t } from './i18n'

export const RELEASE_STEP = 500_000

/** The bank the board will not let the club dip under: a season of wages
 *  plus a float. Kept in lockstep with boardReinvests' reserve. */
export function cashReserve(state: GameState): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  const weekly = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  return Math.round(weekly * SEASON_WEEKS + 4_000_000)
}

/**
 * THE MOST THAT COULD MOVE TODAY, in pounds, rounded to a tidy step.
 *
 * Owner, v1.1.12: "board finances - it should be a sliding bar for money in the
 * club/transfer money." A slider needs a top end, and the top end is the whole
 * of the cash above the board's reserve - so the bar's right-hand stop IS the
 * floor, drawn rather than explained. Zero when there is nothing to move, which
 * is what makes the control honest at a skint club: the bar has no travel and
 * the reason is written under it.
 */
export function releasable(state: GameState): number {
  if (state.unemployed) return 0
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  const spare = club.balance - cashReserve(state)
  if (spare < RELEASE_STEP) return 0
  // to the step, so the slider lands on round numbers a manager can read
  return Math.floor(spare / RELEASE_STEP) * RELEASE_STEP
}

/** Why nothing can move, or null if something can. Read by the CONTROL (to
 *  disable itself and say the shortfall) and by the ACTION (to refuse) - the
 *  reason sits in front of the decision, through one predicate both sides share
 *  (the Training.tsx lesson: a row that offers a button and a handler that
 *  refuses it is the bug written twice). */
export function releaseBlock(state: GameState): string | null {
  if (state.unemployed) return t('finances.treasuryNoClub')
  const club = state.clubs[state.userClubId]
  if (!club) return t('finances.treasuryNoClub')
  if (releasable(state) <= 0) {
    return t('finances.treasuryFloor', { reserve: fmtMoney(cashReserve(state)) })
  }
  return null
}

/**
 * Move cash into the transfer budget.
 *
 * `amount` is what the slider is sitting on; omitting it moves one step, which
 * is what the old button did and what every caller written before the slider
 * still means. Whatever is asked for is clamped to what is actually there, so
 * a stale control cannot overdraw the reserve - the engine decides, not the
 * screen.
 */
export function releaseToBudget(state: GameState, amount?: number): { ok: boolean; msg: string } {
  const block = releaseBlock(state)
  if (block) return { ok: false, msg: block }
  const club = state.clubs[state.userClubId]
  const most = releasable(state)
  const want = amount == null ? RELEASE_STEP : Math.round(amount)
  const move = Math.max(RELEASE_STEP, Math.min(most, want))
  club.balance -= move
  club.budget += move
  logDecision(state, 'dec.movedToTransferBudget', { amount: fmtMoney(move) }, true)
  return { ok: true, msg: t('finances.treasuryMoved', { step: fmtMoney(move), balance: fmtMoney(club.balance), budget: fmtMoney(club.budget) }) }
}
