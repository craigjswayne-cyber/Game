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
import { FACILITY_INFO, MAX_FACILITY, SEASON_WEEKS, fmtMoney, logDecision, mgrReputation, type Club, type FacilityId, type GameState } from './model'
import { tIn } from './i18n'
import { NAT_TIERS } from './nations'

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

/**
 * THE OTHER CEILING, AND THE ONE THE CHARTER USED TO MISS.
 *
 * A club has TWO wage limits: the league's salary cap (userCap above) and its
 * own weekly wage budget. The Charter lifted the first and left the second
 * standing, so an owner who paid £9.99 for "No salary cap, for the save that
 * signs it" walked to the negotiating table and was told his wage budget
 * would break - which is true, and is not what he bought. Reported 29 Aug
 * 2026 with a screenshot of exactly that sentence.
 *
 * Same shape as userCap and for the same reason: four checks in ai.ts and the
 * scout's shopping list all read this budget, and they must agree with each
 * other and with the Charter. An injection's allowance lifts it in proportion
 * too, because the board underwriting wages it cannot pay for is the whole
 * point of the resolution.
 */
export function userWageBudget(state: GameState, club: Club): number {
  if (club.id !== state.userClubId) return club.wageBudget
  if (state.uncapped) return Number.POSITIVE_INFINITY
  if (state.wageBoost) return Math.round(club.wageBudget * (1 + state.wageBoost))
  return club.wageBudget
}

/** The board's four resolutions, at the owner's fixed figures (v1.1.5:
 *  "go back to what we agreed - 10m, 25m, 60m or 130 million + wages
 *  increased"). They were percentages of the season's opening budget; now
 *  every club, Toulouse or Bedford, gets the number on the tin. `wage` is
 *  the cap-exempt allowance as a fraction of the league cap,
 *  board-underwritten for this season only - doubled in the same brief.
 *  The XL is the Sugar Daddy, and the owners will not go to the well for
 *  him twice in a year. */
export const INJECT_TIERS: Record<InjectTier, { amount: number; wage: number; perSeason: number }> = {
  s: { amount: 10_000_000, wage: 0.10, perSeason: 2 },
  m: { amount: 25_000_000, wage: 0.20, perSeason: 2 },
  l: { amount: 60_000_000, wage: 0.40, perSeason: 2 },
  xl: { amount: 130_000_000, wage: 0.80, perSeason: 1 },
}

/** What this tier adds, in pounds: the figure printed on the store row, and
 *  exactly the figure that lands. Fixed since v1.1.5; the state parameter
 *  stays so every caller keeps compiling and the signature is ready if
 *  pricing ever becomes situational again. */
export function injectionCash(_state: GameState, tier: InjectTier): number {
  return INJECT_TIERS[tier].amount
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

/**
 * Full Fitness (v1.1.4, the owner's overnight brief: "restore your team to
 * full health", 99p): every injury cleared, every man's condition and rust
 * restored, in one visit. Consumable.
 * Deterministic, additive, no rng: it clears states, it never rolls dice.
 *
 * The bound changed in v1.1.5 (owner: "can be bought as many times as you
 * want but not one after another without a game"). The 3-a-season cap is
 * gone; instead the retreat will not book twice in a row - a match must be
 * PLAYED between visits, read off the manager's own record (w+d+l, which
 * only ever counts games actually managed), so back-to-back purchases in
 * one idle week are refused however deep the wallet. That keeps the one
 * exploit that mattered - heal, play, heal is spending money to skip the
 * recovery game, which is the product; heal, heal, heal was skipping the
 * game itself.
 *
 * Sharpness is deliberately NOT restored. Health is what medicine buys;
 * match practice is earned on Saturdays, and a healed man still comes back
 * needing minutes - which keeps the returning-player story intact.
 *
 * Returns false when there is nothing to heal (a fully fit squad) or no
 * match has been played since the last visit - and the Store holds the
 * purchase un-consumed, exactly as the Boardroom holds an injection the
 * board will not pass.
 */
const mgrGames = (state: GameState) => state.mgr.w + state.mgr.d + state.mgr.l

/** May the retreat be booked now? A game must separate two visits. */
export function healReady(state: GameState): boolean {
  return state.healAtGames == null || mgrGames(state) > state.healAtGames
}

export function applyHeal(state: GameState): boolean {
  if (state.unemployed) return false
  const club = state.clubs[state.userClubId]
  if (!club) return false
  if (!healReady(state)) return false
  let touched = 0
  for (const id of club.players) {
    const p = state.players[id]
    if (!p) continue
    const hurt = !!p.injury || p.cond < 100 || (p.rust ?? 0) > 0
    if (!hurt) continue
    touched++
    p.injury = null
    p.specialist = false
    p.cond = 100
    p.rust = 0
  }
  if (touched === 0) return false
  state.healAtGames = mgrGames(state)
  // the ledger keeps counting (the Annual and the decisions log read it);
  // it no longer gates anything
  state.injections = { ...(state.injections ?? {}), heal: (state.injections?.heal ?? 0) + 1 }
  const v = { n: touched }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
    subject: tIn('en', 'news.healSubj'),
    body: tIn('en', 'news.heal', v),
    k: 'news.heal', v,
  })
  // n stays a number: the plural rule reads it, and "1" would still pick
  // the right form but a number is what it means
  logDecision(state, 'dec.heal', { n: touched }, true)
  return true
}

/**
 * The Estate (v1.1.4: "upgrade all facilities to max"; £9.99 since v1.1.5): every one of
 * the nine facilities raised to its ceiling, at once, for the club this save
 * manages today. Charter-shaped: bought once from the store, applied to a
 * save deliberately, stamped for good (🏗️ in Legacy and the Annual).
 *
 * What it does NOT wave away: the estate belongs to the CLUB. Walk out of
 * the job and the buildings stay behind, exactly as a real ground would -
 * and a maxed estate runs maxed upkeep (operatingCost reads estateSum), so
 * the purchase buys buildings, not free money. Any half-built project is
 * completed by the same wave of contractors rather than refunded.
 */
export function applyEstate(state: GameState): boolean {
  if (state.estateMaxed || state.unemployed) return false
  const club = state.clubs[state.userClubId]
  if (!club) return false
  const fids = Object.keys(FACILITY_INFO) as FacilityId[]
  const before = fids.reduce((s, fid) => s + (club.facilities?.[fid] ?? 0), 0)
  if (before >= MAX_FACILITY * fids.length) return false
  club.facilities ??= {}
  for (const fid of fids) club.facilities[fid] = MAX_FACILITY
  state.facilityBuild = null
  state.estateMaxed = true
  const v = { club: club.name }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', 'news.estateSubj'),
    body: tIn('en', 'news.estate', v),
    k: 'news.estate', v,
  })
  logDecision(state, 'dec.estate', undefined, true)
  return true
}

/**
 * The International Stage: the buyer picks the federation and IS APPOINTED.
 *
 * It used to place a real natOffer - the same letter, the same accept/decline
 * on the Profile, the same three-week shelf life every earned offer has - on
 * the reasoning that reusing the earned machinery kept one code path. What
 * that actually bought the customer was a letter he had to go and find on
 * another screen, and which QUIETLY EXPIRED if he played three weeks without
 * finding it (season.ts clears an offer older than three weeks). The owner
 * paid for it and reported: "paid for this but no job offer came it should be
 * immediate and automatically installed - it shouldnt even be an offer just an
 * announcement with a question of will you carry on at the club?"
 *
 * He is right, and not only about the bug. An EARNED offer can be declined
 * because the union chose you; a BOUGHT one cannot sensibly be, because you
 * chose it and you have already paid. So the job is installed here - the
 * tenure opens exactly as answerNatOffer would have opened it - the news
 * carries an appointment rather than an approach, and the single real
 * decision is left standing in natKeepAsk: do you carry on at the club?
 * Ignoring that question keeps the club job, so nothing can expire and
 * nothing can be lost by not finding a screen.
 *
 * A call placed with no pick (defensive callers) falls back to the best
 * tier the reputation honestly qualifies for - the same ladder rule the
 * answer block in season.ts keeps for saves whose two-week natCall was
 * already in flight when the wait was removed.
 */
export const NAT_CALL_WEEKS = 2

export function applyPinnacle(state: GameState, nat?: string): boolean {
  if (state.pinnacleCalled || state.unemployed) return false
  if (state.natTeam || state.natOffer) return false
  if (nat != null && !NAT_TIERS.some(([n]) => n === nat)) return false
  state.pinnacleCalled = true
  const rep = mgrReputation(state)
  const qualified = NAT_TIERS.filter(([, need]) => rep >= need)
  const chosen = nat ?? (qualified.length ? qualified[qualified.length - 1] : NAT_TIERS[0])[0]
  // the appointment itself, on the same terms answerNatOffer sets: a new
  // tenure starts at nought and the union starts out believing in you
  state.natTeam = chosen
  state.natConfidence = 60
  state.natRecord = { m: 0, w: 0, d: 0, l: 0 }
  state.natKeepAsk = state.unemployed ? null : chosen
  const v = { nat: chosen }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    // newsSubject() derives the subject key by putting Subj on the end of k,
    // so both bodies carry their own subject line
    subject: tIn('en', `news.${state.unemployed ? 'natAppointedOnly' : 'natAppointed'}Subj`, v),
    body: tIn('en', `news.${state.unemployed ? 'natAppointedOnly' : 'natAppointed'}`, v),
    k: `news.${state.unemployed ? 'natAppointedOnly' : 'natAppointed'}`, v,
  })
  logDecision(state, 'dec.pinnacle', undefined, true)
  return true
}
