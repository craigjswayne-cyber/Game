// ---- THE SEASON'S BOOKS (1.8.0) ----
//
// Owner: "Can we make the financial page more clear and like a balance sheet."
// A balance sheet needs the season's money by line, and until now the game
// kept none of it: weeklyFinance moved club.balance and the only record was a
// week-by-week snapshot of the total (finHist). The Finances screen could say
// what a week SHOULD cost, never what the season HAD cost.
//
// So the recurring flows book themselves here as they land: the weekly
// settlement (wages, staff, upkeep, commercial, central money, gate, shop),
// repair bills on the ground, the manager's building work, transfer fees in
// and out, league prize money and the sponsors' season-end bonuses. Everything else the game does to the balance - fines, testimonials,
// the summer diary, the board's builds - is a long tail of small flows in a
// dozen files, and wiring each of them would scatter this ledger across the
// engine. They are not lost: the sheet shows them as the residual, "other
// items", computed as the movement in the bank that the named lines do not
// explain. That keeps the page honest by construction - opening balance plus
// every line always equals the cash in the bank - without a hook in every file.
import type { GameState } from './model'

export type BookLine =
  | 'deals' | 'bonus' | 'central' | 'gate' | 'shop' | 'sales' | 'prize'
  | 'wages' | 'staff' | 'upkeep' | 'works' | 'buys'

export interface SeasonBooks {
  season: number
  clubId: string
  /** the week the books were opened: 1 for a season played start to finish,
   *  later for a save from before the books existed, or a new job mid-season */
  fromWeek: number
  /** the cash in the bank when the books opened */
  opening: number
  /** set when the season closes, so last season's sheet still adds up */
  closing?: number
  lines: Partial<Record<BookLine, number>>
}

/** The order the sheet prints them in. Income first, then spending. */
export const INCOME_LINES: BookLine[] = ['deals', 'bonus', 'central', 'gate', 'shop', 'sales', 'prize']
export const SPEND_LINES: BookLine[] = ['wages', 'staff', 'upkeep', 'works', 'buys']

function open(state: GameState): SeasonBooks | null {
  const club = state.clubs[state.userClubId]
  // out of work, the old club's money is the old club's business
  if (!club || state.unemployed) return null
  const b = state.books
  if (b && b.season === state.season && b.clubId === club.id) return b
  state.books = {
    season: state.season, clubId: club.id, fromWeek: state.week,
    opening: Number.isFinite(club.balance) ? club.balance : 0, lines: {},
  }
  return state.books
}

/** Record money that has just moved in the manager's club's account. A NaN is
 *  refused here for the same reason dealWeekly refuses one: a single poisoned
 *  line would make every total on the sheet NaN for the rest of the season. */
export function book(state: GameState, line: BookLine, amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return
  const b = open(state)
  if (!b) return
  b.lines[line] = (b.lines[line] ?? 0) + Math.round(amount)
}

/** The rollover, just before the season index moves: close this season's
 *  books on the balance as it stands and open the next on the same figure, so
 *  the two sheets meet exactly and nothing the summer does falls between them. */
export function closeBooks(state: GameState) {
  const club = state.clubs[state.userClubId]
  const b = state.books
  if (b && club && b.clubId === club.id) {
    state.booksPrev = { ...b, closing: club.balance }
  }
  state.books = club
    ? { season: state.season + 1, clubId: club.id, fromWeek: 1, opening: club.balance, lines: {} }
    : undefined
}

export interface Sheet {
  season: number
  fromWeek: number
  opening: number
  closing: number
  income: { line: BookLine | 'other'; amount: number }[]
  spend: { line: BookLine | 'other'; amount: number }[]
  totalIn: number
  totalOut: number
}

/**
 * The sheet for the season in progress (or the last one), with the residual
 * placed on whichever side it belongs. Amounts on the spending side are
 * positive numbers: the screen prints them as spending, not as negatives.
 */
export function sheetOf(state: GameState, which: 'now' | 'prev' = 'now'): Sheet | null {
  const club = state.clubs[state.userClubId]
  if (!club) return null
  const b = which === 'now' ? (open(state) ?? undefined) : state.booksPrev
  if (!b) return null
  const closing = which === 'now' ? club.balance : (b.closing ?? club.balance)
  const income = INCOME_LINES.map(line => ({ line: line as BookLine | 'other', amount: b.lines[line] ?? 0 }))
  const spend = SPEND_LINES.map(line => ({ line: line as BookLine | 'other', amount: -(b.lines[line] ?? 0) }))
  const named = Object.values(b.lines).reduce((s, v) => s + (v ?? 0), 0)
  const other = Math.round(closing - b.opening - named)
  if (other > 0) income.push({ line: 'other', amount: other })
  if (other < 0) spend.push({ line: 'other', amount: -other })
  const totalIn = income.reduce((s, x) => s + x.amount, 0)
  const totalOut = spend.reduce((s, x) => s + x.amount, 0)
  return { season: b.season, fromWeek: b.fromWeek, opening: b.opening, closing, income, spend, totalIn, totalOut }
}
