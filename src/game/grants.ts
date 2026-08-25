/**
 * ---- THE DOORS PURCHASED MONEY WALKS THROUGH ----
 *
 * v1.1.0 sells power for the first time (docs/monetisation-spec.md), and this
 * file is the whole of where it enters the world. monetise.ts owns the till -
 * bridges, SKUs, entitlements - and knows nothing about the game; the game
 * knows nothing about the till; a purchase becomes a call into here, and
 * nothing else in the codebase may write these fields.
 *
 * The rules every door keeps, because scripts/grantprobe.ts checks them:
 *
 *   DETERMINISTIC AND OUTSIDE THE RNG STREAM. Additive writes only - no roll,
 *     no result, no fixture is touched, and `fingerprint` stays green with
 *     every grant applied.
 *
 *   BOUNDED WHERE IT IS CHEAP, TOTAL WHERE IT IS DEAR, STAMPED ALWAYS. An
 *     injection is priced on the season's opening budget, limited per season,
 *     and expires with the season. The Charter is forever, and the save wears
 *     the mark. Nothing here can ever touch an AI club's books.
 *
 *   FICTION FIRST. Every grant lands as club business - a board letter in the
 *     inbox, a line in the decisions ledger - in both languages, so a bought
 *     pound is as legible as an earned one.
 */
import { fmtMoney, logDecision, type GameState } from './model'
import { tIn } from './i18n'

export type InjectTier = 's' | 'm' | 'l' | 'xl'

/**
 * The one adjustment the till ever makes to a wage ceiling, for the user's
 * club and nobody else's: the Charter removes it outright, an injection's
 * allowance rents bounded room on top of it for the season. There are two
 * doors onto the cap - capPosition (cap.ts) and capOf (ai.ts, which cannot
 * import cap.ts back without a cycle) - and both call this, so the law is one
 * sentence in one place and cannot drift between the Finances bar and the
 * negotiating table.
 */
export function userCap(state: GameState, clubId: string, cap: number | null): number | null {
  if (cap == null || clubId !== state.userClubId) return cap
  if (state.uncapped) return null
  if (state.wageBoost) return Math.round(cap * (1 + state.wageBoost))
  return cap
}

/** The board's four resolutions. `pct` of the season's opening transfer
 *  budget, floored so the product means something at a National 1 club or a
 *  club fresh out of administration; `wage` is the cap-exempt allowance as a
 *  fraction of the league cap, board-underwritten for this season only
 *  (owner's decision, 25 Aug). The XL is the Sugar Daddy, and the owners will
 *  not go to the well for him twice in a year. */
export const INJECT_TIERS: Record<InjectTier, { pct: number; floor: number; wage: number; perSeason: number }> = {
  s: { pct: 0.25, floor: 100_000, wage: 0.05, perSeason: 2 },
  m: { pct: 0.65, floor: 250_000, wage: 0.10, perSeason: 2 },
  l: { pct: 1.50, floor: 500_000, wage: 0.20, perSeason: 2 },
  xl: { pct: 3.50, floor: 1_000_000, wage: 0.40, perSeason: 1 },
}

/** What this tier would add today, in pounds: the figure printed on the store
 *  row, and exactly the figure that lands. Priced on the snapshotted opening
 *  budget rather than the live balance, so buying in March is worth what the
 *  row said in September and spending does not devalue the product. */
export function injectionCash(state: GameState, tier: InjectTier): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  const open = club.budgetAtOpen ?? club.budget
  const def = INJECT_TIERS[tier]
  return Math.max(def.floor, Math.round((open * def.pct) / 10_000) * 10_000)
}

/** How many of this tier the board will still vote through this season. */
export function injectionsLeft(state: GameState, tier: InjectTier): number {
  return Math.max(0, INJECT_TIERS[tier].perSeason - (state.injections?.[tier] ?? 0))
}

/**
 * The board votes the funds through. Budget and balance rise together (the
 * books stay honest), the wage allowance stacks onto the season's boost, the
 * cash is written into the objectives ledger so a bought pound can never
 * finish "in the black", and the letter goes in the inbox. Returns false when
 * the well is dry for the season or there is no desk to sit at - the caller
 * must not have charged anybody by then.
 */
export function applyInjection(state: GameState, tier: InjectTier): boolean {
  if (state.unemployed) return false
  const club = state.clubs[state.userClubId]
  if (!club || injectionsLeft(state, tier) <= 0) return false
  const cash = injectionCash(state, tier)
  club.budget += cash
  club.balance += cash
  state.injections = { ...state.injections, [tier]: (state.injections?.[tier] ?? 0) + 1 }
  state.injectedThisSeason = (state.injectedThisSeason ?? 0) + cash
  // fractions like 0.05 accumulate float dust; the boost is bookkeeping, so
  // keep it exact to the percent
  state.wageBoost = Math.round(((state.wageBoost ?? 0) + INJECT_TIERS[tier].wage) * 100) / 100
  const v = { amount: fmtMoney(cash), club: club.name }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', 'news.boardInjectionSubj'),
    body: tIn('en', 'news.boardInjection', v),
    k: 'news.boardInjection', v,
  })
  logDecision(state, 'dec.boardInjection', { amount: fmtMoney(cash) }, true)
  return true
}

/**
 * The Owner's Charter: new ownership arrives with lawyers, and the wage law
 * no longer applies to this save. Irreversible by design - the product is
 * total freedom, bought with eyes open and stamped on the save (🖋 in Legacy
 * and the Annual). Any embargo being served dies with the law that imposed
 * it; AI clubs remain capped, because their books were balanced against the
 * law and the law still applies to them (capPosition applies this to the
 * user's club only).
 */
export function applyCharter(state: GameState): boolean {
  // no desk, no boardroom, no lawyers to receive: the surfaces that sell it
  // (Boardroom, career creation) always have a club in hand
  if (state.uncapped || state.unemployed) return false
  const club = state.clubs[state.userClubId]
  if (!club) return false
  state.uncapped = true
  club.capEmbargoUntil = undefined
  club.capBreaches = 0
  const v = { club: club.name }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', 'news.charterSubj'),
    body: tIn('en', 'news.charter', v),
    k: 'news.charter', v,
  })
  logDecision(state, 'dec.charter', undefined, true)
  return true
}
