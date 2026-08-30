// Moving the club's cash into the transfer budget (user: "should be able to
// transfer balance into transfer money").
//
// THE RESERVE WAS A WALL AND IT IS A LINE (owner, v1.1.13: "when moving money
// it doesnt let me transfer everything?").
//
// The board's rule is that a club keeps a season of wages plus a four million
// float - the exact reserve boardReinvests protects before it sweeps surplus
// into the estate - and the first version of this simply refused to move
// anything below it. Measured at Northampton on day one: a reserve of £17.0m
// against a balance of £2.4m, so the bar had NO TRAVEL AT ALL and the feature
// read as broken from the first week of every career. Even at £132m it locked
// £17m away for ever.
//
// A manager may now move the lot. The reserve stops being a wall and becomes
// the line the readout draws: above it this is housekeeping, below it he is
// spending the wage bill on players and the screen says so before he commits.
// The board mind - dipping under costs confidence in proportion, once, at the
// moment of the decision - and insolvency.ts is still there for a club that
// takes it to the floor. That is the difference between a rule and a lecture:
// the game states the risk, prices it, and lets the manager decide.
//
// The trade is unchanged in every other respect: cash moved to the budget is
// cash the summer sweep can no longer turn into facilities.

import type { GameState } from './model'
import { SEASON_WEEKS, fmtMoney, logDecision, operatingCost } from './model'
import { t, tIn } from './i18n'

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
  if (club.balance < RELEASE_STEP) return 0
  // to the step, so the slider lands on round numbers a manager can read
  return Math.floor(club.balance / RELEASE_STEP) * RELEASE_STEP
}

/** How much of a move sits UNDER the board's reserve - nothing at all when the
 *  club stays comfortable, which is the ordinary case. The screen draws this
 *  and the board charges for it. */
export function belowReserve(state: GameState, amount: number): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  const after = club.balance - amount
  return Math.max(0, Math.min(amount, cashReserve(state) - after))
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
  // the only thing that stops a move now is having nothing to move
  if (releasable(state) <= 0) return t('finances.treasuryEmpty', { step: fmtMoney(RELEASE_STEP) })
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
  const under = belowReserve(state, move)
  club.balance -= move
  club.budget += move
  // THE BOARD MIND, IN PROPORTION. Emptying the wage float to buy players is a
  // real decision with a real cost, charged once here rather than as a rule
  // that refuses. Capped, because this is disquiet rather than a sacking: the
  // results still decide that, and insolvency.ts owns what happens if the
  // money actually runs out.
  if (under > 0) {
    const reserve = Math.max(1, cashReserve(state))
    club.boardConfidence = Math.max(0, club.boardConfidence - Math.min(12, (under / reserve) * 14))
  }
  logDecision(state, 'dec.movedToTransferBudget', { amount: fmtMoney(move) }, true)
  return {
    ok: true,
    msg: under > 0
      ? t('finances.treasuryMovedDeep', { step: fmtMoney(move), balance: fmtMoney(club.balance), budget: fmtMoney(club.budget) })
      : t('finances.treasuryMoved', { step: fmtMoney(move), balance: fmtMoney(club.balance), budget: fmtMoney(club.budget) }),
  }
}

/**
 * ---- THE BOARD, WHILE THE CLUB IS OVERDRAWN ----
 *
 * v1.1.13 turned the reserve from a wall into a line: a manager may move the
 * whole balance into the transfer budget, and dipping under the reserve costs
 * board confidence once, at the moment he decides. The owner's answer to that
 * named the half that was still missing:
 *
 *   "if tou spend it all then yes - if you take the club into debt then the
 *    pressure is on to fix it and the board grows the longer is stays in debt."
 *
 * A one-off charge prices the DECISION. It does not price the CONSEQUENCE, and
 * the consequence is the interesting part: an overdrawn club is a boardroom
 * that gets less patient every week nobody fixes it. Without this, going into
 * the red costs you twelve points of confidence and then nothing at all, for
 * ever, which makes it a toll rather than a risk.
 *
 * HOW HARD IT BITES
 *
 *   It starts almost gently and does not stay that way. Week one in the red is
 *   a raised eyebrow; by the end of a season in the red it is most of a
 *   boardroom. That shape - patient at first, then not - is the whole point: a
 *   short overdraft to buy a player in January is a fair gamble, and living
 *   there is not.
 *
 *   Priced in the club's own money, like everything else in the ledger. Being
 *   £2m down on a £40m turnover is a cashflow wobble; being £2m down at Esher
 *   is the end. The bite scales with how deep the hole is against a week of
 *   upkeep, so the same story reads the same at both ends of the game.
 *
 *   NO FLOOR. terraceWeek deliberately cannot push a board through the danger
 *   zone, because a manager cannot directly control what the terraces think.
 *   This one can go all the way down, because he can: the money is his to fix,
 *   and insolvency.ts is waiting at the bottom if he does not.
 *
 *   It says so. Silent drains are the worst thing a management game does. The
 *   first week in the red files a letter, and so does every fourth week after
 *   it, and clearing the debt files the relief.
 */

/** The most confidence a single week in the red may take. */
const DEBT_MAX_WEEKLY = 3.5

/** How much of that a club is charged, per week overdrawn and per week of
 *  upkeep it is down. Small on purpose - the escalation does the work. */
const DEBT_BITE = 0.18

export function debtWeek(state: GameState): void {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return
  const now = state.season * SEASON_WEEKS + state.week

  if (club.balance >= 0) {
    // OUT OF IT. The relief is filed only if there was something to be
    // relieved about - a club that has never been overdrawn says nothing.
    if (state.debtSince != null) {
      const weeks = Math.max(1, now - state.debtSince)
      state.debtSince = null
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: tIn('en', 'news.debtClearedSubj'),
        body: tIn('en', 'news.debtCleared', { weeks }),
        k: 'news.debtCleared', v: { weeks },
      })
    }
    return
  }

  state.debtSince ??= now
  const weeks = now - state.debtSince + 1
  // How deep, in weeks of upkeep. A club that is one week's upkeep down is
  // barely overdrawn; one that is ten weeks down is in trouble whatever its
  // size.
  const upkeep = Math.max(1, operatingCost(state, club))
  const depth = Math.min(10, -club.balance / upkeep)
  const bite = Math.min(DEBT_MAX_WEEKLY, DEBT_BITE * weeks * (0.5 + depth / 4))
  club.boardConfidence = Math.max(0, club.boardConfidence - bite)

  if (weeks === 1 || weeks % 4 === 0) {
    const v = { weeks, amount: fmtMoney(-club.balance) }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: tIn('en', weeks === 1 ? 'news.debtOpenedSubj' : 'news.debtPressureSubj'),
      body: tIn('en', weeks === 1 ? 'news.debtOpened' : 'news.debtPressure', v),
      k: weeks === 1 ? 'news.debtOpened' : 'news.debtPressure', v,
    })
  }
}
