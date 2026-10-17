// The summer: one season closed and the next one opened. rebuildSeason is the
// order of play and lives here; each subsystem it calls lives under rollover/
// (ageing, intake, contracts, squads, development, awards, review, national,
// finance, competitions, registry, pledges). The names below are re-exported
// so every caller keeps importing from './rollover'.
import { closeAcademySeason, topUpAcademy } from './academy'
import { aiBoardsReinvest, aiWageRooms } from './aiecon'
import { ensureCaptains } from './analysis'
import { arcYearEnd } from './arc'
import { deriveTrait, repriceAcademies } from './attributes'
import { closeBooks } from './books'
import { ageManager } from './career'
import { expireDeals } from './commercial'
import { genderOf } from './gender'
import { punditPredictions } from './gossip'
import { historyYearEnd } from './history'
import { identitySeasonEnd } from './identity'
import { settleInsolvency } from './insolvency'
import { returnLoanIn } from './loans'
import { BASE_YEAR, fmtMoney, SEASON_WEEKS, seasonLabel, type GameState } from './model'
import { pickObjectives } from './objectives'
import { resetFamiliarity } from './playbook'
import { backResponders, respondersTo } from './rivalbids'
import { mulberry32 } from './rng'
import { sortTable } from './schedule'
import { settleSponsorBonuses } from './sponsortalks'
import { agePlayers, announceFarewell } from './rollover/ageing'
import { challengeCheck, invinciblesCheck, seasonAwards, settleRecords, tryOfTheSeason, worldPlayerOfTheYear } from './rollover/awards'
import { cupQualifiers, rebuildCompetitions, swapDivisions } from './rollover/competitions'
import { handleContracts } from './rollover/contracts'
import { closeSeasonStats, reviewSights } from './rollover/development'
import { boardReinvests, growGrounds, offerSponsorChoices, resetBudgets, settleBoardMoney, settlePrizeMoney } from './rollover/finance'
import { youthIntake } from './rollover/intake'
import { lionsHomecoming, unionReview } from './rollover/national'
import { carryPledges } from './rollover/pledges'
import { pruneDeparted, pruneNames } from './rollover/registry'
import { boardVerdict, managerSeasonReview, rivalYearVerdict } from './rollover/review'
import { pruneFreeAgents, replenishSquads, trimAiSquads } from './rollover/squads'

export { agePlayers, devFactor } from './rollover/ageing'
export { challengeCheck, invinciblesCheck } from './rollover/awards'
export { carryPledges } from './rollover/pledges'
export { rollIntakeClass } from './rollover/intake'

/** Full end-of-season rollover into a fresh campaign. */
export function rebuildSeason(state: GameState) {
  const rng = mulberry32(state.seed ^ ((state.season + 1) * 60013))

  // A new season wipes the tape: last year's analysis is last year's, so a move
  // the league had worked out is worth calling again.
  for (const club of Object.values(state.clubs)) resetFamiliarity(club)

  // the A League is decided before the season index moves on, so its champion
  // and the user's finish are stamped in the season they were earned
  // THE RIVAL'S YEAR, SETTLED (C3). Read HERE, at the top, because the leagues are
  // rebuilt empty further down and a verdict computed after that would find no
  // table, no positions and nothing to say - silently, forever.
  rivalYearVerdict(state)

  closeAcademySeason(state)
  seasonAwards(state)
  tryOfTheSeason(state)
  worldPlayerOfTheYear(state)
  settleRecords(state)

  // the Lions come home: the tour ends with the season itself, so the
  // window's return week (end + 1) never exists on the calendar - the
  // homecoming is processed here, before the blanket natSquad reset
  lionsHomecoming(state)

  // the union's annual review: the Test job answers to somebody too
  unionReview(state)

  // the manager's season in review - a proper full-time moment
  managerSeasonReview(state)

  // board verdict on the season vs their stated objective. The final league
  // position, the title and the objective money are CAPTURED here and settled
  // after the budget refresh below: club.budget is assigned from scratch down
  // there, so any money added to it at this point in the function is silently
  // wiped. The "+£250k budget" this verdict prints fell into exactly that
  // hole for two versions - the favour (boardOwed) was the only part of the
  // reward that ever arrived.
  const { userFinishPos, userWonLeague, objBonus } = boardVerdict(state)

  // the sponsors' performance bonuses (1.8.0) are read off the same final
  // tables, so they are paid here, before anything below wipes them
  settleSponsorBonuses(state)

  // prize money & budget refresh (uses final tables before wipe)
  // Also records where every club finished, as a 0 (top) to 1 (bottom) share of
  // its league, because the boardroom reset near the end of this function needs
  // it and the leagues are rebuilt empty before then.
  const finishFrac = settlePrizeMoney(state)
  // WHO WILL WANT TO ANSWER HIM (rivalbids.ts, 1.8.5): read off the final
  // table while it stands, backed after the budgets are set below
  const userComp = state.unemployed ? null : state.comps[state.clubs[state.userClubId]?.leagueId ?? '']
  const responders = userComp?.type === 'league' ? respondersTo(state, sortTable(userComp.table).map(r => r.teamId), userComp.champion) : []

  // bums on seats: clubs that keep selling out build bigger stands
  growGrounds(state, rng)

  // the career arc's summer: conduct, the chairman's verdict, eras, rivals
  // (arc.ts). The board's points for the season's METHOD come back rather
  // than land here, and are added after the summer pull below.
  const methodPts = arcYearEnd(state)
  identitySeasonEnd(state) // the identity's expectations, met or missed (identity.ts)
  // archive player season -> career
  // THE SEASON REVIEW (1.8.2, devproject.ts): before the season's numbers are
  // wiped, every young man's ceiling can move on what the season held, and the
  // manager's own get a row on their development timeline. The staff's
  // estimate is read before and after the summer, so the row can say whether
  // they raised or lowered their sights.
  const { sightsBefore, bandBefore } = closeSeasonStats(state)
  state.natSquads = {}
  delete state.natSent
  delete state.natFed
  state.natLineup = null

  // what every AI board can pay, read while the season's gates are still on
  // the fixture list: the contracts, the squad top-up and the budgets below
  // all price from it (aiecon.ts, 1.8.3)
  const rooms = aiWageRooms(state)
  agePlayers(state, rng, rooms)
  reviewSights(state, sightsBefore, bandBefore)
  handleContracts(state, rng, rooms)
  youthIntake(state, rng)
  replenishSquads(state, rng, rooms)
  // every academy in the world recruits its next scholarship year, back up to
  // 27 in shape - see topUpAcademy for why this is not optional (feedback 10G)
  for (const club of Object.values(state.clubs)) {
    topUpAcademy(state, club, rng, state.seed + state.season * 977)
  }

  // AI squads shed their surplus every summer (squads.ts trimAiSquads)
  trimAiSquads(state)

  // EVERY MAN BORN THIS SUMMER GETS HIS SIGNATURE. buildPlayer derives a trait
  // and the summer's own makers (intake, heirs, replenishment) did not, so a
  // regen went a season without one - until a save and reload, where migrate
  // derived it from his attributes. A reload changing the simulation is a bug
  // whichever side of it is right; this is the same derivation, done here.
  for (const p of Object.values(state.players)) {
    if (p.trait === undefined) p.trait = deriveTrait(p)
  }

  // keep the free-agent pool from growing without bound over long careers
  pruneFreeAgents(state)

  // Promotion & relegation between each top flight and its second tier
  swapDivisions(state)

  // Continental Cup qualification for next season from final league standings
  const { euroSlots, chcSlots } = cupQualifiers(state)

  // THE INVINCIBLES (16C): a whole competitive season without defeat is the
  // rarest thing in the sport, and the moment it deserves has to be claimed
  // here, while the season's fixtures still exist to prove it.
  invinciblesCheck(state)

  // THE RECKONING (release audit 2.4): a club that spent the season unable to
  // pay for itself goes into administration now, while state.season is still
  // the season it failed in - settleInsolvency stamps the penalty onto the year
  // about to start. It has to run before the bump for that reason, and before
  // the tables are rebuilt below so the deduction is in them from round one.
  settleInsolvency(state)

  // and the manager gets a year older with everybody else (career.ts). Before
  // the season bump, so the age and the season it belongs to stay in step.
  ageManager(state)

  // wipe season structures & rebuild
  // ---- THE CONTRACT CLOCK STOPS WHILE SHE IS AWAY ----
  //
  // The owner's spec: maternity leave should "freeze contract duration clocks,
  // preserve roster rights without taking up an active playing squad slot".
  // contractEnds is an absolute season index, so a season rolling over while a
  // player is on leave would spend a year of her deal on a year she did not
  // play. Pushing it out by one is the freeze.
  //
  // Done here, before the increment, so it reads in the same units as every
  // other contractEnds in the file.
  for (const p of Object.values(state.players)) {
    if (p.maternity) p.contractEnds += 1
  }

  // the season's books close on the balance as it stands, and the next
  // season's open on the same figure the first time money moves (books.ts)
  closeBooks(state)
  // the club's memory closes the year: rivalries, legends, the annals line (history.ts)
  historyYearEnd(state)
  state.season += 1
  // F30: a deal whose term ran out with the old season is gone, and the manager
  // is told, because an empty commercial slot pays nothing and that has to be a
  // decision he knows he is making rather than a quiet hole in the accounts.
  // AFTER the season bump, so `until >= state.season` reads the new season.
  expireDeals(state)
  state.week = 1
  state.finHist = []
  state.fixtures = []
  state.offers = []
  // OPEN JOBS CARRY OVER THE SUMMER, their clock rebased onto the new season.
  // They used to be wiped here, and a club's new coach is only ever appointed
  // when its vacancy EXPIRES (jobs.ts refreshVacancies), so every club with a
  // job open at the end of May went coachless for the rest of the career. With
  // the week counted back by a season, a vacancy that was already old expires
  // in week 1 and the club appoints; one opened in the close season stays on
  // the Job Centre for the weeks it has left, and an offer made against it can
  // still be answered. The union's offer keeps the same clock for the same
  // reason: its three-week shelf life compares weeks, and without the rebase a
  // letter from week 46 never met the test again.
  state.vacancies = state.vacancies.map(v => ({ ...v, week: v.week - SEASON_WEEKS }))
  if (state.natOffer) state.natOffer = { ...state.natOffer, week: state.natOffer.week - SEASON_WEEKS }
  state.devFocus = state.devFocus.filter(id => state.players[id]?.clubId === state.userClubId)
  state.press = state.press.filter(p => !p.answered).slice(-5)

  // ---- THE SPONSORSHIP DECISION (25C) ----
  offerSponsorChoices(state)
  const wcYear = rebuildCompetitions(state, rng, euroSlots, chcSlots)

  // the farewell season: a one-club servant announces his last dance, and
  // his home pre-season friendly becomes the testimonial he plays in
  announceFarewell(state)
  if (wcYear) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season, type: 'intl', read: false,
      subject: `A WORLD CHAMPIONSHIP season`,
      body: `The ${BASE_YEAR + state.season} World Championship kicks off in the opening weeks of the season. Twenty nations, four pools, one trophy - and your internationals will be away with their countries until it's decided. Plan your early rounds carefully.`,
      k: 'news.wcSeason', v: { year: BASE_YEAR + state.season },
    })
  }

  // old wounds heal: expired grudges drop off the fixture list, and
  // contract stand-offs reset with the new season
  state.grudges = (state.grudges ?? []).filter(g => g.until >= state.season)
  for (const p of Object.values(state.players)) { if ((p.wantsDeal ?? 0) > 0) p.wantsDeal = 0 }
  state.slAlerted = []
  // a new season wipes the promise ledger clean, except a promise made too
  // late to be judged in the season just gone (model.pledgeDue): that one is
  // owed in this season, counted from the first week, against fresh stats
  state.pledges = carryPledges(state.pledges ?? [], state.season, genderOf(state))
  state.takeover = null // deals not done by summer quietly collapse
  state.newOwnerUntil = null // the honeymoon does not survive the summer
  state.crisisAt = {} // week numbers reset with the calendar

  // and every ledger that holds a player id loses the men who have gone
  pruneDeparted(state)

  boardReinvests(state)
  pruneNames(state)
  // and the other hundred boards, for the same reason his does it: money sitting
  // in a deposit account while the club stands still is money the board would
  // rather see in the academy and the training ground (aiecon.ts).
  aiBoardsReinvest(state)

  // budgets: base by rep + carryover health
  resetBudgets(state, finishFrac, rooms, methodPts)

  // Money the board promised the manager is settled HERE, after the refresh
  // above has assigned every budget from scratch - earlier in this function it
  // would be wiped, which is the hole the objective bonus sat in for two
  // versions (see the verdict block).
  settleBoardMoney(state, objBonus, userWonLeague, userFinishPos)
  // the boards that finished behind him back their coaches (rivalbids.ts)
  backResponders(state, responders)
  ensureCaptains(state)

  // loan-ins go home to their parent clubs (the same road a dated loan
  // takes mid-season, loans.returnLoanIn)
  for (const p of Object.values(state.players)) {
    if (p.loanFrom && state.clubs[p.loanFrom]) {
      returnLoanIn(state, p, rng, 1)
    }
  }
  state.objectives = pickObjectives(state)
  // the achievement ledger belongs to the objectives it tracked
  state.objDone = []
  // last season's stance died with last season - the launch decision comes
  // round again in week 2, and the reckoning above has already settled the
  // war chest, so the advance dies with it
  state.stance = undefined
  state.stanceFund = undefined
  // v1.1.0: the purchased season expires with the season it was bought in -
  // the wage allowance, the injection counts and the objectives ledger all
  // belong to the campaign that paid for them (grants.ts; grantprobe)
  state.wageBoost = undefined
  state.injections = undefined
  // THE SUMMER'S NEW SCHOLARS GO ONTO DEVELOPMENT DEALS. The intake and the
  // regens were minted on first-team money and only a reload repriced them
  // (migrate), so a running game paid every club's new academy a senior wage
  // for a season and a reloaded save did not: the last divergence between
  // the two (scripts/qa/determinism.ts, migrate mode, 1.6.5). Same sweep
  // newGame runs, idempotent.
  repriceAcademies(Object.values(state.players))
  state.injectedThisSeason = undefined
  state.releasedThisSeason = undefined
  // the rewarded ledger is weekly or seasonal and goes with the season, all but
  // the team night's stamp: its cap is four game-weeks, counted in absolute
  // weeks, and a summer in between must not reset it (rewarded.ts)
  const night = state.rewarded?.teamNight
  state.rewarded = Array.isArray(night) ? { teamNight: night } : undefined
  // and the new opening budget is snapshotted AFTER the war-chest clawback
  // above, so a board injection is priced on what the season really opens with
  for (const club of Object.values(state.clubs)) club.budgetAtOpen = club.budget
  // THE ANNUAL (user: "a forced page that says 'ready for a new season?' with
  // records backed up"). The rollover has just filed the honours, the annals
  // and the record books; the stamp routes Continue to the Annual page, whose
  // one button starts the campaign. Engine careers never read it.
  if (!state.unemployed) state.annual = { season: state.season - 1 }

  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'board', read: false,
    subject: `The ${seasonLabel(state.season)} season begins`,
    body: `Pre-season is over. Your transfer budget has been set at ${fmtMoney(state.clubs[state.userClubId].budget)}. Bring us silverware.`,
    k: 'news.seasonBegins',
    v: { season: seasonLabel(state.season), budget: fmtMoney(state.clubs[state.userClubId].budget) },
  })

  // A SEASON IS WORTH BACKING UP, and the rollover is the one moment in the year
  // when a manager is between jobs rather than mid-week. The save lives in this
  // browser's storage and nowhere else: a cleared browser, a full disk or an iPhone
  // that has not seen the game for a week can all take it, and none of them ask
  // first. Once a season, in the same breath as the budget, is not nagging.
  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'general', read: false,
    subject: `${seasonLabel(state.season - 1)} is in the books: back it up`,
    body: `A whole season done, and it lives in this browser and nowhere else. `
      + `An exported career file survives whatever the browser does. Worth one every rollover.`,
    k: 'news.backItUp', v: { season: seasonLabel(state.season - 1) },
  })

  punditPredictions(state, rng)
  state.tryOfSeason = null // the new season starts its own reel
  challengeCheck(state)
}
