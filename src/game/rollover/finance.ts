// Money at the rollover: prize money, grounds that grow, the board's
// reinvestment, the summer sponsorship call, next season's budgets and
// board mood, and the money the board promised the manager.
import { aiTransferBudget } from '../aiecon'
import { splitFor } from '../bench'
import { book } from '../books'
import { offersFor, SLOTS } from '../commercial'
import { tIn } from '../i18n'
import { autoSelect, repairSheet } from '../matchEngine'
import { OFFICE_OUTLET, roundMoney } from '../media'
import { demandCeiling, FACILITY_INFO, facilityCost, fmtMoney, GROUND_TIERS, groundLevel, isMyClub, logDecision, MAX_FACILITY, MAX_FOLLOWING, SEASON_WEEKS, type Club, type FacilityId, type GameState } from '../model'
import { clamp, type Rng } from '../rng'
import { sortTable } from '../schedule'
import { ordinal } from './format'

/**
 * A board does not sit on cash. Over the summer, anything well beyond a
 * healthy reserve gets spent on the club: one build on the estate, and the
 * rest into the debt, the academy and the community programme.
 *
 * Written after a 20-season soak finished with the manager's club on £179M
 * against an AI median of £15M, which makes the transfer market meaningless
 * from about season eight. The money is not confiscated - it is spent, the
 * news item says on what, and the terraces notice.
 *
 * Deliberately deterministic: no draw from the shared season rng, so adding
 * this cannot shift any match or transfer that follows it.
 */
export function boardReinvests(state: GameState) {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return
  const weekly = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  // a full season of wages plus a float is a prudent reserve, and the manager
  // keeps it: a first pass swept 55% above 0.6 of a season and left him poorer
  // than the AI median, which is its own kind of wrong
  const reserve = Math.round(weekly * SEASON_WEEKS + 4_000_000)
  // A BOARD INJECTION IS NOT SURPLUS (1.6.3). The cash a manager bought from
  // the store this season sat in the balance and was swept like any other
  // windfall: the largest tier bought at week 40 lost £44m to "reinvestment"
  // at the rollover (scripts/qa/p5_inject.ts). Whatever of it is still in the
  // account stays out of the sweep, and rebuildSeason carries it into next
  // season's transfer budget.
  const injected = Math.min(state.injectedThisSeason ?? 0, Math.max(0, club.balance))
  const surplus = club.balance - injected
  if (surplus <= reserve * 1.5) return
  const spend = Math.round((surplus - reserve) * 0.4)
  if (spend < 500_000) return
  club.balance -= spend

  // the board funds one build itself: whatever is weakest on the estate
  const weakest = (Object.keys(FACILITY_INFO) as FacilityId[])
    .filter(fid => (club.facilities?.[fid] ?? 0) < MAX_FACILITY)
    .sort((a, b) => (club.facilities?.[a] ?? 0) - (club.facilities?.[b] ?? 0))[0]
  let built: string | null = null
  if (weakest) {
    const lvl = club.facilities?.[weakest] ?? 0
    if (spend >= facilityCost(FACILITY_INFO[weakest], lvl)) {
      club.facilities = { ...(club.facilities ?? {}), [weakest]: lvl + 1 }
      built = tIn('en', 'news.reinvestBuilt', { name_k: FACILITY_INFO[weakest].name, lvl: lvl + 1 })
    }
  }
  state.fanMood = clamp((state.fanMood ?? 60) + 2, 0, 100)
  state.news.push({
    id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
    subject: `The board reinvests ${fmtMoney(spend)}`,
    body: `The accounts closed in rude health, and the board has no intention of letting the money sit in a deposit account while the club stands still. ${fmtMoney(spend)} goes back into ${club.name} over the summer: ${built ? `${built}, ` : ''}the last of the ground debt cleared, the academy funded for another cycle, and the community programme kept in the schools that feed this place. Your reserve stands at ${fmtMoney(club.balance)}, which is a season of wages and change. Spend the transfer budget on players, not on interest.`,
    k: built ? 'news.reinvestBuild' : 'news.reinvest',
    v: {
      spend: fmtMoney(spend), club: club.name, reserve: fmtMoney(club.balance),
      name_k: weakest ? FACILITY_INFO[weakest].name : 'common.nothing',
      lvl: weakest ? (club.facilities?.[weakest] ?? 0) : 0,
    },
  })
  logDecision(state, 'dec.boardReinvested', { amount: fmtMoney(spend) }, true)
}

/** Prize money from the final tables, before they are wiped. Returns where
 *  every club finished, as a 0 (top) to 1 (bottom) share of its league. */
export function settlePrizeMoney(state: GameState): Map<string, number> {
  const finishFrac = new Map<string, number>()
  for (const comp of Object.values(state.comps)) {
    if (comp.type !== 'league') continue
    const order = sortTable(comp.table).map(r => r.teamId)
    order.forEach((teamId, idx) => {
      const club = state.clubs[teamId]
      if (!club) return
      if (order.length > 1) finishFrac.set(teamId, idx / (order.length - 1))
      const prize = Math.max(0, (order.length - idx)) * 120_000 + (comp.champion === teamId ? 1_500_000 : 0)
      club.balance += prize
      if (teamId === state.userClubId) book(state, 'prize', prize)
    })
  }
  return finishFrac
}

/** Bums on seats: clubs that keep selling out build bigger stands. */
export function growGrounds(state: GameState, rng: Rng) {
  for (const club of Object.values(state.clubs)) {
    // league and cup gates only, the rule expansionPlan states for every such
    // aggregate: a friendly is priced at 38% interest, and counting it read a
    // sold-out season as under nine-tenths full, so the following never grew
    // for a club that played friendlies (1.8.1)
    const home = state.fixtures.filter(f => f.played && f.homeId === club.id && f.att && f.compId !== 'fr')
    // THE SAME LADDER THE MANAGER CLIMBS (v1.6.8). A stage-five stadium is
    // the top of the estate for every club in the world, not only for the one
    // the user happens to be sitting at, or the map would be drawing a rule
    // that applies to one ground out of a hundred and one.
    if (home.length < 5 || groundLevel(club.capacity) >= GROUND_TIERS.length - 1) continue
    const avg = home.reduce((sum, f) => sum + (f.att ?? 0), 0) / home.length
    /**
     * ---- A SEASON OF FULL HOUSES BUYS A BIGGER FOLLOWING (v1.6.8) ----
     *
     * demandCeiling used to anchor for ever on the ground a club opened with,
     * which capped the whole world at about 1.4x its starting seats and made
     * the 0-to-5 ground ladder unclimbable for anybody who started small.
     *
     * This is the only thing that moves that anchor, and it is the hardest
     * thing in the game to fake: a whole season with the ground better than
     * nine-tenths full. Turned away supporters become next season's season
     * tickets. Five per cent a season compounds to the cap in about a decade
     * of sold-out rugby, which is a career, not a quarter.
     *
     * It runs BEFORE the expansion vote below on purpose - a club that filled
     * the place last season should be allowed to act on it this summer.
     */
    if (avg / club.capacity >= 0.9) {
      club.following = Math.min(MAX_FOLLOWING, (club.following ?? 1) * 1.05)
    }
    if (avg / club.capacity < 0.93 || rng() > 0.4) continue // boards dither
    // a board will not build seats it cannot sell: the catchment is the ceiling
    if (club.capacity >= demandCeiling(club) * 0.95) continue
    // and it never overshoots the rung it is climbing toward
    const room = Math.min(GROUND_TIERS[groundLevel(club.capacity) + 1], demandCeiling(club)) - club.capacity
    const add = Math.min(Math.round((club.capacity * (0.04 + rng() * 0.06)) / 100) * 100,
                         Math.round(room / 100) * 100)
    // same per-seat curve the manager is quoted in expansionPlan: a big ground
    // costs more per seat than a small one, which is what a flat 1,400 missed
    const cost = add * Math.round(1_400 * (1 + club.capacity / 45_000))
    if (add < 100 || club.balance < cost * 2) continue
    club.balance -= cost
    club.capacity += add
    if (club.id === state.userClubId) {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
        subject: `${club.stadium} to grow - ${add.toLocaleString()} new seats`,
        body: `Full houses all season have convinced the board. Diggers arrive this summer: capacity rises to ${club.capacity.toLocaleString()} at a cost of ${fmtMoney(cost)}. Keep winning and we'll fill that too.`,
        k: 'news.groundGrows',
        v: { stadium: club.stadium, add, cap: club.capacity, cost: fmtMoney(cost) },
      })
    }
  }
}

// ---- THE SPONSORSHIP DECISION (25C) ----
// expireDeals just installed a below-market caretaker in any slot whose
// contract ran out (user: "You should be able to choose between deals...
// short term for lower amounts or bigger deals for longer"). The market
// already offers exactly that choice on the Finances screen; what was
// missing was the moment - so the summer a deal lapses, the commercial
// director walks into the office with the three offers and asks. Choosing
// one signs it (media.answerPress, opt.deal); staying with the stopgap is a
// real answer too. Internal decision, so the press-expiry sweep leaves it.
export function offerSponsorChoices(state: GameState) {
  if (!state.unemployed) {
    for (const slot of SLOTS) {
      const d = state.deals?.[slot.id]
      if (!d || !d.auto || d.from !== state.season) continue
      const offers = offersFor(state, slot.id)
      if (offers.length < 3) continue
      const [lng, sht, cls] = offers
      // the summer sponsorship call is a press item too, built here rather than
      // in the press generator - which is how it stayed English after the rest
      // of the room was translated. The live probe found it by reading the
      // press room a career actually produces.
      const qv = { slot_k: slot.name, weekly: fmtMoney(d.weekly) }
      const sponsorOpt = (o: typeof lng, kind: 'long' | 'short' | 'clause', lk: string, rk: string) => ({
        morale: 0, board: 0, deal: { slot: slot.id, kind, offer: o },
        lk, lv: { sponsor: o.sponsor, weekly: fmtMoney(o.weekly), n: o.years },
        rk, rv: { n: o.years },
        label: tIn('en', lk, { sponsor: o.sponsor, weekly: fmtMoney(o.weekly), n: o.years }),
        reaction: tIn('en', rk, { n: o.years }),
      })
      state.press.push({
        id: state.nextId++, week: 1, season: state.season, outlet: OFFICE_OUTLET,
        question: tIn('en', 'press.slotQ', qv), qk: 'press.slotQ', qv,
        options: [
          sponsorOpt(lng, 'long', 'press.slotLong', 'press.slotLongR'),
          sponsorOpt(sht, 'short', 'press.slotShort', 'press.slotShortR'),
          sponsorOpt(cls, 'clause', 'press.slotClause', 'press.slotClauseR'),
          {
            morale: 0, board: 0, deal: { slot: slot.id, kind: 'keep' },
            lk: 'press.slotKeep', rk: 'press.slotKeepR',
            label: tIn('en', 'press.slotKeep'), reaction: tIn('en', 'press.slotKeepR'),
          },
        ],
        answered: false,
      })
    }
  }
}

/** Budgets: base by rep + carryover health; the board's confidence pulled
 *  toward where the club finished; and every club's sheet for August. */
export function resetBudgets(state: GameState, finishFrac: Map<string, number>, rooms: Map<string, number>, methodPts: number) {
  for (const club of Object.values(state.clubs)) {
    club.budget = Math.max(200_000, Math.round((club.rep * 45_000 + Math.max(0, club.balance) * 0.15) / 50_000) * 50_000)
    // an AI board's allowance answers to its books (aiecon.ts, 1.8.3); the
    // manager's is the line above, unchanged
    if (!isMyClub(state, club.id)) club.budget = aiTransferBudget(state, club, rooms.get(club.id))
    // the board injections bought this season stay spendable: whatever of
    // that cash is still in the account is the floor of next season's
    // allowance, not 15% of it (scripts/qa/p5_inject.ts, 1.6.3)
    if (club.id === state.userClubId && !state.unemployed && (state.injectedThisSeason ?? 0) > 0) {
      const carried = Math.min(state.injectedThisSeason ?? 0, Math.max(0, club.balance))
      club.budget = Math.max(club.budget, Math.round(carried / 50_000) * 50_000)
    }
    // The old reset was confidence * 0.6 + 30, whose fixed point is 75 - so
    // every board in the game drifted back to comfortable each summer no matter
    // how the season had gone, and a side that finished 8th of 10 was dragged
    // back up to about 75%. Measured over 12 seasons with scripts/boardprobe.ts:
    // board confidence tracked league position at r = -0.23 while the crowd
    // managed -0.62, and boards in the bottom third of the table averaged 70%.
    // The attractor now depends on where the club actually finished: top of the
    // league pulls towards 86, bottom towards 32. The objective verdict above
    // stays as the expectation layer on top of it.
    //
    // Tuned by measurement, not taste. 88 down to 18 at an even split read
    // r = -0.43 but dropped the mean to 37% and left even top-quarter boards at
    // 53%, which would sack a manager who was doing well. This range and weight
    // keep the coupling while leaving a successful side comfortable.
    const frac = finishFrac.get(club.id)
    const target = frac == null ? 75 : 86 - frac * 54
    club.boardConfidence = clamp(club.boardConfidence * 0.55 + target * 0.45, 0, 100)
    // THE METHOD SURVIVES THE PULL. The pull keeps 55% of whatever stood
    // before it, so the board's read of how the season was run (chairman.ts
    // boardMethod, at most 4 points) would arrive as two. It is added here,
    // after, so the letter's points are the points the boardroom keeps.
    if (methodPts && club.id === state.userClubId && !state.unemployed) {
      club.boardConfidence = clamp(club.boardConfidence + methodPts, 0, 100)
    }
    // THE MANAGER'S OWN SHEET SURVIVES THE SUMMER. It used to be re-picked here
    // for every club, his included, and marked as the game's, so a side he had
    // chosen with care came back in August as the auto-pick's. Only the men who
    // have actually gone (sold, released, retired, loan over) lose their shirts;
    // the gaps are filled the way a match-day repair fills them and the rest of
    // the twenty-three stands exactly as he wrote it.
    const mine = club.id === state.userClubId && !state.unemployed && club.tactic.userPicked === true
    const kept = mine
      ? club.tactic.lineup.map(id => id != null && state.players[id]?.clubId === club.id && !state.players[id].loanFrom ? id : null)
      : []
    if (kept.some(id => id != null)) {
      club.tactic.lineup = keepSheet(state, club, kept)
      continue
    }
    const pool = club.players.map(id => state.players[id]).filter(Boolean)
    club.tactic.lineup = autoSelect(state, pool)
    // The sheet this line just wrote is the game's, not the manager's, so the
    // engine's tidy-up may look at it again. A sheet the game picked for him
    // last season is re-picked like anyone's; only one he wrote himself is
    // carried over, above.
    club.tactic.userPicked = false
  }
}

/**
 * The manager's sheet with its empty shirts filled. repairSheet does the
 * filling (from the men he did not name, so nobody he picked is displaced), but
 * it also leaves out anyone who cannot play today, and in the summer that is a
 * man carrying a knock into pre-season. His shirt is held for him, as it is on
 * match day, so he is put back where the manager had him.
 */
function keepSheet(state: GameState, club: Club, kept: (number | null)[]): (number | null)[] {
  const filled = repairSheet(state, club, kept, splitFor(club))
  const named = new Set(kept.filter((x): x is number => x != null))
  return filled.map((id, i) => kept[i] ?? (id != null && named.has(id) ? null : id))
}

/** The objective money and the aim-high reckoning, settled after the budget
 *  refresh has assigned every budget from scratch. */
export function settleBoardMoney(state: GameState, objBonus: number, userWonLeague: boolean, userFinishPos: number) {
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    if (objBonus > 0) club.budget += objBonus
    // THE AIM-HIGH RECKONING (user: "they get a bit more money but they best
    // win or the board will be nervous about their budget"). The war chest was
    // an advance against a promise to beat the pundits' number. Beat it, or
    // win the league outright, and the advance was earned. Miss it and next
    // season's budget gives the money back with interest: the interest is what
    // makes taking the cheque every summer a bet rather than a salary, and the
    // rate is set by measurement (scripts/stancecheck.ts), not by argument.
    if (state.stance === 'high' && state.stanceFund) {
      const pred = state.preds?.[club.id]
      const met = userWonLeague || (pred != null && userFinishPos > 0 && userFinishPos < pred)
      if (met) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season, type: 'board', read: false,
          subject: `The war chest is yours to keep`,
          body: `You told the world to judge you in May, and May agreed. The ${fmtMoney(state.stanceFund)} the board put behind the promise stays spent with their blessing, and the chairman is already quoting you in the season-ticket letter.`,
          k: 'news.warChestKept', v: { fund: fmtMoney(state.stanceFund) },
        })
      } else if (pred != null) {
        // The interest rate is measured, not argued (scripts/stancecheck.ts,
        // 10 paired careers x 3 seasons): a strict beat-the-pundits promise is
        // missed 57% of the time, so 1.75x puts the expected repayment level
        // with the advance and always aiming high is a bet, not a salary. At
        // 2x the high road taxed a career 100k a season; at 1.2x it paid 173k
        // a season - both free lunches, one in each direction.
        // Rounded the way the chest was, and floored in proportion (1.8.1): a
        // flat £200,000 floor and fifty-thousand rounding were Premiership
        // figures, so a small club's claw rounded to nothing while the floor
        // lifted its budget above where it stood before the claw.
        // (a chest of £100,000 and up claws back exactly as it always did)
        const claw = state.stanceFund >= 100_000
          ? Math.round((state.stanceFund * 1.75) / 50_000) * 50_000
          : roundMoney(state.stanceFund * 1.75)
        club.budget = Math.max(Math.min(200_000, Math.round(club.budget * 0.25)), club.budget - claw)
        state.news.push({
          id: state.nextId++, week: 1, season: state.season, type: 'board', read: false,
          subject: `The board recalls the war chest`,
          body: `Last summer you aimed high and the board paid for the privilege: a ${fmtMoney(state.stanceFund)} advance against a promise to beat the pundits. The pundits said ${ordinal(pred)}; you finished ${ordinal(userFinishPos)}. The accountants have taken ${fmtMoney(claw)} off this season's budget - the advance, plus interest for the nervousness. Your budget stands at ${fmtMoney(club.budget)}.`,
          k: 'news.warChestBack',
          v: { fund: fmtMoney(state.stanceFund), pred_o: pred, pos_o: userFinishPos, claw: fmtMoney(claw), budget: fmtMoney(club.budget) },
        })
      }
    }
  }
}
