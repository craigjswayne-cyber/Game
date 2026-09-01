import type { Competition, FacilityId, Fixture, GameState, MatchEvent, Player, Pos, TableRow, TrainingFocus } from './model'
import { aiFireSale, aiWeeklyFinance } from './aiecon'
import { adminPenalty, insolvencyWarning } from './insolvency'
import { advanceHunt } from './living'
import { offerResult, offerRun } from './records'
import { rivalBeat } from './boss'
import { auditCaps, refreshCaps } from './cap'
import { commercialWeekly, expireDeals } from './commercial'
import { AWARD_EVERY, managerOfMonth, runLine, runVars } from './awards'
import { boardMemo } from './boardmemo'
import { terraceWeek } from './terraces'
import { upkeepWeek } from './upkeep'
import { addGrudge, boardObjective, boardPatience, demandCeiling, FACILITY_INFO, facLevel, facilityCost, finalVenue, fixtureDayOff, fmtMoney, formGuide, grudgeBetween, MAX_FACILITY, mgrReputation, operatingCost, SEASON_WEEKS, seasonLabel, squadTrust, unbeatenRun, weeklyCentral } from './model'
import { simMatch, autoSelect, teamShort, teamUnits, rosterOf } from './matchEngine'
import { emptyRow, leaguePos, sortTable, AUTUMN_WEEKS, PNC_WEEKS, SIX_NATIONS_WEEKS, TOUR_WEEKS, TRC_WEEKS, WC_KO_WEEKS } from './schedule'
import { aiPreContractPoach, aiRenewals, aiTransfers, askingPrice } from './ai'
import { OFFICE_OUTLET, PRESS_KEEP_WEEKS, generatePress } from './media'
import { debtWeek } from './treasury'
import { generateGossip } from './gossip'
import { buildPlayer, playerValue, playerWage } from './attributes'
import { recruitmentMeeting, scoutOpponent, weeklyScouting } from './scout'
import { recordTendency } from './tendency'
import { disciplineWeek } from './authority'
import { updateAgency } from './agency'
import { OBJECTIVE_DEFS } from './objectives'
import { derbyName, isDerby, rivalsOf } from './rivalries'
import { NAT_DEPTH, NAT_SQUAD_FLOOR, NAT_SQUAD_SIZE, NAT_TIERS, homeBased, nationByCode, nationNameIn, nationVars, regenName, worldNames } from './nations'
import { logDecision } from './model'
import { resolveCourses, staffWageBill } from './staff'
import { resolveCommission, scoutPostcard } from './commission'
import { clamp, mulberry32, shuffled, type Rng } from './rng'
import { gameTimeReview, settleGameTime } from './gametime'
import { rebuildSeason, rollIntakeClass } from './rollover'
import { drillWeek } from './playbook'
import { loanTargets } from './loans'
import { refreshVacancies, sackManager } from './jobs'
import { playAcademyWeek } from './academy'
import { canBeMentored, mentorBoost, mentorGraduations, mentorLoad, mentorReports } from './mentoring'
import { t, tIn, type Vars } from './i18n'

export function weekRng(state: GameState): Rng {
  return mulberry32(state.seed ^ (state.season * 131 + state.week * 7919))
}

/** The manager is back at a door the board just closed (v1.1.4, owner's
 *  brief: "if they ask again after being denied - warning, respect halved;
 *  if they continue to push - fired"). Two doors share the ledger key
 *  'capital' (facilities and the ground share their cooldown); 'funds' is
 *  its own. The first repeat inside a denial draws the formal warning and
 *  HALVES the board's confidence; the next is the sack, that week, whatever
 *  the table says. Deterministic, rng-free, and the reply says exactly what
 *  pressing again will cost - the dismissal is a choice, never an ambush. */
function pressBoard(state: GameState, kind: 'capital' | 'funds'): string {
  const club = state.clubs[state.userClubId]
  const asks = (state.boardAsks ??= {})
  const rec = (asks[kind] ??= { deniedAt: 0, strikes: 0 })
  rec.strikes += 1
  if (rec.strikes <= 1) {
    rec.warned = true
    club.boardConfidence = clamp(Math.round(club.boardConfidence * 0.5), 0, 100)
    logDecision(state, 'dec.boardPushed', {}, false)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: tIn('en', 'news.boardPushedSubj'), body: tIn('en', 'news.boardPushed'),
      k: 'news.boardPushed', v: {},
    })
    return t('reply.boardPushedWarn')
  }
  logDecision(state, 'dec.boardPushedOut', {}, false)
  sackManager(state, 'news.sackedPushed')
  return t('reply.boardPushedSacked')
}

/** Facility upgrades go through the boardroom (8-batch feedback): the board
 *  weighs the books and their faith in you. A yes releases the funds and
 *  puts builders on site for five weeks; a no closes the door for eight. */
export function requestFacility(state: GameState, fid: FacilityId): string {
  const club = state.clubs[state.userClubId]
  const info = FACILITY_INFO[fid]
  // a corrupted save or a stale screen can name a facility that does not
  // exist: say so rather than reaching into undefined
  // (an own-property check, so 'toString' and '__proto__' cannot sneak the
  // prototype's members in as a facility)
  if (!club || !Object.prototype.hasOwnProperty.call(FACILITY_INFO, fid) || typeof info?.name !== 'string') {
    return t('facilities.facNotBuildable')
  }
  const lvl = club?.facilities?.[fid] ?? 0
  if (lvl >= MAX_FACILITY) return t('facilities.facAlreadyWorldClass', { facility: t(info.name).toLowerCase() })
  if (state.facilityBuild) return t('facilities.facBuildersBusy', { facility: t(FACILITY_INFO[state.facilityBuild.id].name) })
  const abs = state.season * 100 + state.week
  // inside a denial the polite refusal is gone: asking again is pressing the
  // board, and pressing the board has a price (pressBoard above)
  if ((state.facilityAskCooldown ?? 0) > abs) return pressBoard(state, 'capital')
  const cost = facilityCost(info, lvl)
  /**
   * The board underwrites capital projects when it believes in you. That is what
   * board backing MEANS, and it is how a stand actually gets built in the real
   * game: the club does not pay for it out of the current account.
   *
   * It used to require the club's own reserves to cover 140% of the bill, and a
   * fifty-season audit approved 0 of 124 requests - at a club that won its league
   * in twenty of twenty-four seasons. The weekly ledger runs close to
   * break-even by design, so it never accumulates a million pounds spare, and the
   * upper levels cost more than a million. The whole estate was therefore inert
   * after the first season: a system the manager can see, ask about, and never
   * once complete. Found by scripts/soakhealth.ts at fifty seasons.
   *
   * So confidence buys backing. A board that rates you at seventy carries most of
   * it; one that merely tolerates you carries none, and the answer is still no if
   * results have not earned it. Winning is the way in.
   */
  const backing = club.boardConfidence >= 78 ? 0.7
    : club.boardConfidence >= 70 ? 0.55
    : club.boardConfidence >= 58 ? 0.3
    : 0
  const clubShare = Math.round(cost * (1 - backing))
  const approve = club.boardConfidence >= 45 && club.balance >= clubShare * 1.25
  if (!approve) {
    state.facilityAskCooldown = abs + 8
    ;(state.boardAsks ??= {}).capital = { deniedAt: abs, strikes: 0 }
    const whyKey = club.boardConfidence < 45 ? 'news.facNoResults'
      : club.balance < clubShare ? 'news.facNoShare'
      : 'news.facNoReserves'
    const why = tIn('en', whyKey)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `🏛 Board says no: ${tIn('en', info.name)}`,
      body: `Your request for a level ${lvl + 1} ${tIn('en', info.name).toLowerCase()} was heard, considered and declined - ${why}. The door reopens in a couple of months; better results and a healthier balance reopen it faster.`,
      k: 'news.facDeclined',
      v: { name_k: info.name, lvl: lvl + 1, why_k: whyKey },
    })
    logDecision(state, 'dec.facilityDeclined', { lvl: lvl + 1, fac_k: info.name, why_k: whyKey }, false)
    return t('reply.declined', { why_k: whyKey })
  }
  club.balance -= clubShare
  state.facilityBuild = { id: fid, done: abs + 5, level: lvl + 1 }
  delete state.boardAsks?.capital // a yes wipes the slate
  const boardPut = cost - clubShare
  logDecision(state, 'dec.facilityApproved', { lvl: lvl + 1, fac_k: info.name, cost: fmtMoney(cost) }, true)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: `🏛 Board approves: ${tIn('en', info.name)} to level ${lvl + 1}`,
    body: `${fmtMoney(cost)} signed off on a level ${lvl + 1} ${tIn('en', info.name).toLowerCase()}${boardPut > 0
      ? ` - the board underwrite ${fmtMoney(boardPut)} of it and the club funds the remaining ${fmtMoney(clubShare)}`
      : `, all of it from club funds`}. The builders move in on Monday and it opens in about five weeks. ${tIn('en', info.desc)}`,
    k: boardPut > 0 ? 'news.facApprovedShared' : 'news.facApproved',
    v: {
      name_k: info.name, desc_k: info.desc, lvl: lvl + 1,
      cost: fmtMoney(cost), board: fmtMoney(boardPut), club: fmtMoney(clubShare),
    },
  })
  return boardPut > 0
    ? `Approved. The board put up ${fmtMoney(boardPut)}, the club ${fmtMoney(clubShare)} - about five weeks to build.`
    : `Approved. ${fmtMoney(clubShare)} released - about five weeks to build.`
}

/** Cost of the next stand: seats added, at the same rate the board pays. */
export function expansionPlan(state: GameState) {
  const club = state.clubs[state.userClubId]
  const seats = Math.round((club.capacity * 0.06) / 100) * 100
  // League and cup gates only. A pre-season friendly is deliberately priced
  // at 38% interest by the gate model, and this average used to include them
  // - so a club selling out every Saturday read "77% full" to its own board
  // and the fill>=0.9 vote below was unreachable for anyone: forty scripted
  // seasons and a Leicester squeezed into 8,000 seats both built nothing
  // (release audit, 25 Aug). Every sibling aggregate in this file already
  // filters 'fr'; this was the one that forgot.
  const home = state.fixtures.filter(f => f.played && f.homeId === club.id && f.att && f.compId !== 'fr')
  const avg = home.length ? home.reduce((s, f) => s + (f.att ?? 0), 0) / home.length : 0
  // steel and concrete cost more the bigger the ground already is: the easy
  // terrace goes up first, the second tier needs foundations
  const perSeat = Math.round(1_400 * (1 + club.capacity / 45_000))
  return { seats, cost: seats * perSeat, perSeat, avg: Math.round(avg), fill: avg ? avg / club.capacity : 0, played: home.length }
}

/**
 * Ask for a bigger ground. The board wants to see the seats filled before it
 * pours concrete - full houses and a healthy balance carry the vote.
 */
export function requestExpansion(state: GameState): string {
  const club = state.clubs[state.userClubId]
  const abs = state.season * 100 + state.week
  if (club.capacity >= 82_000) return t('reply.groundAlreadyHuge', { stadium: club.stadium })
  // the Infrastructure page greys the button out at this point, and the engine
  // has to agree with it: a board does not lay seats it cannot sell
  if (club.capacity >= demandCeiling(club) * 0.95) {
    return t('reply.groundBigEnough', { stadium: club.stadium })
  }
  if (state.facilityBuild) return t('reply.buildersBusy')
  // same door as the facilities: inside a denial, asking again is pressing
  if ((state.facilityAskCooldown ?? 0) > abs) return pressBoard(state, 'capital')
  const { seats, cost, fill, played } = expansionPlan(state)
  // one stand a season: builders, planning permission and a season ticket
  // renewal cycle all take their time
  if (state.expandedSeason === state.season) {
    return t('reply.groundExtendedThisSeason')
  }
  const enoughDemand = played >= 3 && fill >= 0.9
  const approve = enoughDemand && club.balance >= cost * 1.3 && club.boardConfidence >= 50
  if (!approve) {
    state.facilityAskCooldown = abs + 8
    ;(state.boardAsks ??= {}).capital = { deniedAt: abs, strikes: 0 }
    const whyKey = played < 3 ? 'news.expNoEarly'
      : fill < 0.9 ? 'news.expNoEmpty'
      : club.balance < cost * 1.3 ? 'news.expNoReserves'
      : 'news.expNoResults'
    const why = tIn('en', whyKey, { pct: Math.round(fill * 100) })
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `🏛 Board says no: expanding ${club.stadium}`,
      body: `Your case for ${seats.toLocaleString()} more seats was heard and declined - ${why}. Fill the ground week after week and the argument makes itself.`,
      k: 'news.expDeclined',
      v: { stadium: club.stadium, seats, why_k: whyKey, pct: Math.round(fill * 100) },
    })
    logDecision(state, 'dec.expandDeclined', { stadium: club.stadium, why_k: whyKey, pct: Math.round(fill * 100) }, false)
    return t('reply.declined', { why_k: whyKey, pct: Math.round(fill * 100) })
  }
  club.balance -= cost
  club.capacity += seats
  state.expandedSeason = state.season
  delete state.boardAsks?.capital // a yes wipes the slate
  logDecision(state, 'dec.expandApproved', { stadium: club.stadium, seats, cost: fmtMoney(cost), cap: club.capacity }, true)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: `🏗 ${club.stadium} grows by ${seats.toLocaleString()} seats`,
    body: `The board has signed off on a new stand: ${fmtMoney(cost)}, and ${club.stadium} now holds ${club.capacity.toLocaleString()}. The waiting list finally moves, and every one of those seats pays its way at the turnstile.`,
    k: 'news.expApproved',
    v: { stadium: club.stadium, seats, cost: fmtMoney(cost), cap: club.capacity },
  })
  return t('reply.expandApproved', { seats, cost: fmtMoney(cost), cap: club.capacity })
}

/**
 * Ask the board for extra transfer funds. Engine-owned since v1.1.4: it was
 * an untyped `asked-<season>` flag the Finances screen kept directly on the
 * save, which meant the one request the board takes most personally was the
 * one the escalation ledger could not see. Same rules as before - once a
 * season, boards say yes when they owe you (objectives delivered), when they
 * adore you, or when tenure has earned it - plus the pressBoard consequences
 * for coming back inside a refusal.
 */
export function requestFunds(state: GameState): string {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return ''
  const abs = state.season * 100 + state.week
  // the board said no THIS SEASON and here he is again: that is pressing
  const rec = state.boardAsks?.funds
  if (rec && Math.floor(rec.deniedAt / 100) === state.season) return pressBoard(state, 'funds')
  if (state.fundsAskedSeason === state.season) return t('finances.fundsOnce')
  state.fundsAskedSeason = state.season
  const tenure = state.mgr.finishes.filter(x => x.leagueId === club.leagueId).length
  // boards say yes when they owe you (objectives delivered), when they
  // adore you, or when you've built something over the long haul
  const approved = state.boardOwed || club.boardConfidence >= 82 || (tenure >= 3 && club.boardConfidence >= 68)
  if (approved) {
    const extra = Math.round((club.budget * 0.25 + 400_000) / 50_000) * 50_000
    club.budget += extra
    const owed = state.boardOwed
    state.boardOwed = false
    delete state.boardAsks?.funds
    logDecision(state, 'dec.fundsApproved', { amount: fmtMoney(extra) }, true)
    return t(owed ? 'finances.boardRemembers' : 'finances.boardBacks', { amount: fmtMoney(extra) })
  }
  club.boardConfidence = Math.max(0, club.boardConfidence - 3)
  ;(state.boardAsks ??= {}).funds = { deniedAt: abs, strikes: 0 }
  logDecision(state, 'dec.fundsDeclined', {}, false)
  return t(club.boardConfidence >= 60 ? 'finances.boardDeclinesTalk' : 'finances.boardDeclines')
}

// ------------------------------------------------------------------
// Tables & knockouts
// ------------------------------------------------------------------

function applyToTable(comp: Competition, fx: Fixture) {
  if (fx.stage) return // knockout games don't affect tables
  const h = comp.table.find(r => r.teamId === fx.homeId)
  const a = comp.table.find(r => r.teamId === fx.awayId)
  if (!h || !a) return
  h.p++; a.p++
  h.pf += fx.homeScore; h.pa += fx.awayScore
  a.pf += fx.awayScore; a.pa += fx.homeScore
  h.tf += fx.homeTries; h.ta += fx.awayTries
  a.tf += fx.awayTries; a.ta += fx.homeTries
  if (fx.homeScore > fx.awayScore) { h.w++; a.l++; h.pts += 4 }
  else if (fx.homeScore < fx.awayScore) { a.w++; h.l++; a.pts += 4 }
  else { h.d++; a.d++; h.pts += 2; a.pts += 2 }
  // bonus points
  if (fx.homeTries >= 4) { h.bp++; h.pts++ }
  if (fx.awayTries >= 4) { a.bp++; a.pts++ }
  if (fx.homeScore < fx.awayScore && fx.awayScore - fx.homeScore <= 7) { h.bp++; h.pts++ }
  if (fx.awayScore < fx.homeScore && fx.homeScore - fx.awayScore <= 7) { a.bp++; a.pts++ }
}

/**
 * Recompute a league table from the fixtures that have actually been played.
 *
 * A save can arrive holding a table that disagrees with its own fixture list -
 * a bad write, a hand edit, or fixtures pruned on load because they named clubs
 * the file no longer contains. The standings are what a whole season is read
 * through, so a table saying forty-one games played in a league that has played
 * one is not cosmetic: every objective, every board judgement and every headline
 * about the title race is drawn from it.
 *
 * This replays the real fixtures through the real points rules rather than
 * inventing a correction, so the repaired table is the one the engine would have
 * produced. Found by scripts/savefuzz.ts.
 */
export function rebuildTable(comp: Competition, fixtures: Fixture[], state?: GameState) {
  if (comp.type !== 'league' || !Array.isArray(comp.table)) return
  for (const r of comp.table) {
    r.p = 0; r.w = 0; r.d = 0; r.l = 0
    r.pf = 0; r.pa = 0; r.tf = 0; r.ta = 0; r.bp = 0; r.pts = 0
  }
  for (const fx of fixtures) {
    if (fx.compId !== comp.id || !fx.played || fx.stage) continue
    applyToTable(comp, fx)
  }
  applyAdminPenalties(comp, state)
}

/**
 * A club in administration starts the season on minus ten.
 *
 * Applied HERE rather than painted on by the table screen, because a deduction
 * that only exists in the UI is not a deduction: promotion, relegation, playoff
 * cut-offs, the title itself and every AI board's read of its own season all
 * come off comp.table, and each of those has to see the same number the manager
 * does. Points are allowed to go negative, as they do in the real thing.
 */
export function applyAdminPenalties(comp: Competition, state?: GameState) {
  if (!state || comp.type !== 'league' || !Array.isArray(comp.table)) return
  for (const r of comp.table) {
    const hit = adminPenalty(state.clubs[r.teamId], state.season)
    if (hit) r.pts -= hit
  }
}

/** In knockout rugby there are no draws - nudge a golden-point winner. */
export function resolveKnockoutDraw(state: GameState, fx: Fixture, rng: Rng) {
  if (fx.homeScore !== fx.awayScore) return
  const hs = teamUnits(state, autoLineup(state, fx.homeId)).overall
  const as = teamUnits(state, autoLineup(state, fx.awayId)).overall
  const pHome = hs / (hs + as) + 0.05
  if (rng() < pHome) fx.homeScore += 3
  else fx.awayScore += 3
}

function autoLineup(state: GameState, teamId: string) {
  const pool = rosterOf(state, teamId).map(id => state.players[id]).filter(p => p && !p.injury && p.bans === 0)
  return autoSelect(state, pool)
}

function poolStandings(state: GameState, comp: Competition): string[][] {
  const pools = comp.pools ?? [comp.teamIds]
  return pools.map(pool => {
    const rows: TableRow[] = pool.map(emptyRow)
    for (const fx of state.fixtures) {
      if (fx.compId !== comp.id || !fx.played || fx.stage) continue
      if (!pool.includes(fx.homeId)) continue
      const mini: Competition = { ...comp, table: rows, pools: undefined }
      applyToTable(mini, fx)
    }
    return sortTable(rows).map(r => r.teamId)
  })
}

/** Create knockout fixtures for a competition when the calendar reaches them. */
function maybeCreateKnockouts(state: GameState, comp: Competition, rng: Rng) {
  if (!comp.playoffTeams) return
  /** stages whose ties were made on this tick, so the draw can be assembled after */
  const drawnStages = new Set<string>()
  const cupLike = comp.type === 'cup' || !!comp.pools
  const koFx = (stage: string) => state.fixtures.filter(f => f.compId === comp.id && f.stage === stage)
  const mkFx = (stage: string, week: number, home: string, away: string) => {
    const fx: Fixture = {
      id: state.nextId++, compId: comp.id, round: 99, week, homeId: home, awayId: away,
      played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0, stage,
    }
    // a showpiece final leaves home: the Premier Division final is always
    // Twickenham, the Elite 14 final always the Stade de France, and the
    // European finals go to whichever great ground won this season's bid.
    // Only club finals - a World Championship final has its own host nation.
    if (stage === 'F' && state.clubs[home]) {
      const v = finalVenue(state, comp.id)
      if (v) fx.venue = v
    }
    state.fixtures.push(fx)
    // the draw is news when you're in the hat
    const mine = [state.userClubId, state.natTeam].filter(Boolean)
    drawnStages.add(stage)
    if (mine.includes(home) || mine.includes(away)) {
      const us = mine.includes(home) ? home : away
      const opp = us === home ? away : home
      const stgKey = { QF: 'news.stgQF', SF: 'news.stgSF', F: 'news.stgF', BAR: 'news.stgBAR', R16: 'news.stgR16' }[stage]
      const stg = stgKey ? tIn('en', stgKey) : stage
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `🎟 The ${comp.short} ${stg} draw: ${teamShort(state, opp)}`,
        body: fx.venue
          ? `It is settled. ${teamShort(state, opp)} in the ${comp.name} FINAL, at ${fx.venue.name} in ${fx.venue.city} - ${fx.venue.capacity.toLocaleString()} seats and both towns emptying to fill them. One match. Everything on it.`
          : us === home
            ? `The balls have been drawn. You host ${teamShort(state, opp)} in the ${comp.name} ${stg} - win, and the road continues. ${stg === 'FINAL' ? 'One match. Everything on it.' : 'Get the place rocking.'}`
            : `The balls have been drawn. You travel to ${teamShort(state, opp)} for the ${comp.name} ${stg}. ${stg === 'FINAL' ? 'One match. Everything on it.' : 'Quiet the crowd early and anything is possible.'}`,
        k: fx.venue ? 'news.drawFinal' : us === home ? 'news.drawHome' : 'news.drawAway',
        v: {
          opp: teamShort(state, opp), comp: comp.name, short: comp.short,
          stg_k: stgKey ?? '', stage,
          venue: fx.venue?.name ?? '', city: fx.venue?.city ?? '', seats: fx.venue?.capacity ?? 0,
          tail_k: stg === 'FINAL' ? 'news.drawTailFinal'
            : us === home ? 'news.drawTailHome' : 'news.drawTailAway',
        },
      })
    }
  }
  /**
   * Hold a freshly drawn round back as a ceremony (F19).
   *
   * The ties have to exist the moment the previous round ends, or the manager's
   * own tie would be simmed before the MatchDay screen ever saw it. But he should
   * not simply FIND them in his fixture list: a cup draw is a moment, and the
   * only one in the sport where you watch your season change without playing.
   *
   * Assembled after the round is built rather than while it is being built,
   * because the first ball out is rarely the manager's - collecting as we went
   * missed every tie drawn before his name came up.
   */
  const holdTheDraw = () => {
    for (const stage of drawnStages) {
      const ties = state.fixtures.filter(f => f.compId === comp.id && f.stage === stage)
      const mine = [state.userClubId, state.natTeam].filter(Boolean)
      // a round with only one tie in it is a final: there is nothing to draw
      if (ties.length < 2) continue
      if (!ties.some(f => mine.includes(f.homeId) || mine.includes(f.awayId))) continue
      state.draw = {
        compId: comp.id, stage, week: state.week, season: state.season, revealed: 0,
        ties: ties.map(f => ({ homeId: f.homeId, awayId: f.awayId })),
      }
    }
  }

  const regularDone = state.fixtures
    .filter(f => f.compId === comp.id && !f.stage)
    .every(f => f.played)
  if (!regularDone) return

  // Knockout ties are created as soon as the previous round is complete -
  // never lazily on their own match week, or the user's tie would be
  // simmed away before the MatchDay screen ever saw it.
  const ko = comp.koWeeks
  if (cupLike) {
    // pool competitions (Continental Cup, World Championship): QF ko[0], SF ko[1], F ko[2]
    if (koFx('QF').length === 0) {
      const pools = poolStandings(state, comp)
      const winners = pools.map(p => p[0])
      const runners = pools.map(p => p[1])
      // NO POOL REMATCH IN THE QUARTERS (user: "If you qualify from the cup -
      // you should not play a team from the group you played next"). The
      // shuffle can hand a runner straight back to his own pool winner, so:
      // keep the shuffled order when it is clean, otherwise walk the runner
      // permutations in a fixed order and take the first with no rematch.
      // Winner i came from pool i; runner slot order below pairs slots
      // [0,1,2,3] with winners [3,2,1,0] (the mkFx lines). Deterministic
      // repair, zero extra rng draws, so the match stream never moves.
      const rs = shuffled(rng, runners)
      const poolOf = new Map(runners.map((t, i) => [t, i]))
      const PARTNER = [3, 2, 1, 0] // runner slot -> winner index it will play
      const clean = (a: string[]) => a.every((t, slot) => poolOf.get(t) !== PARTNER[slot])
      let picked = rs
      if (!clean(rs)) {
        const perms = (xs: number[]): number[][] => xs.length <= 1 ? [xs]
          : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p2 => [x, ...p2]))
        for (const perm of perms([0, 1, 2, 3])) {
          const cand = perm.map(i => rs[i])
          if (clean(cand)) { picked = cand; break }
        }
      }
      const seeds = [...winners, ...picked]
      mkFx('QF', ko[0], seeds[0], seeds[7])
      mkFx('QF', ko[0], seeds[3], seeds[4])
      mkFx('QF', ko[0], seeds[1], seeds[6])
      mkFx('QF', ko[0], seeds[2], seeds[5])
      // the host city is announced with the quarter-final draw. Both European
      // finals share one great ground on one weekend, so the story runs once,
      // off the Continental Cup, and covers the pair of them.
      if (comp.id === 'cc') {
        const v = finalVenue(state, 'cc')
        if (v) state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
          subject: `🏟️ FINALS WEEKEND: ${v.city} gets Europe's showpiece`,
          body: [
            `${v.name} will stage both European finals this season: the Continental Shield under Friday lights, the Continental Cup on the Saturday. ${v.capacity.toLocaleString()} seats, one city, the whole sport in town for a weekend.`,
            `Eight quarter-finalists still stand in each competition, and every one of them circled the date this morning and priced the trip to ${v.city}.`,
          ].join('\n'),
          k: 'news.finalsWeekend',
          v: { venue: v.name, city: v.city, seats: v.capacity },
        })
      }
    }
    const qf = koFx('QF')
    if (koFx('SF').length === 0 && qf.length === 4 && qf.every(f => f.played)) {
      const w = qf.map(winnerOf)
      mkFx('SF', ko[1], w[0], w[1])
      mkFx('SF', ko[1], w[2], w[3])
    }
    const sf = koFx('SF')
    if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
      mkFx('F', ko[2], winnerOf(sf[0]), winnerOf(sf[1]))
    }
  } else {
    // league playoffs
    const order = sortTable(comp.table).map(r => r.teamId)
    const n = comp.playoffTeams
    if (n === 4) {
      const [sfW, fW] = ko
      if (koFx('SF').length === 0) {
        mkFx('SF', sfW, order[0], order[3])
        mkFx('SF', sfW, order[1], order[2])
      }
      const sf = koFx('SF')
      if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
        mkFx('F', fW, winnerOf(sf[0]), winnerOf(sf[1]))
      }
    } else {
      const [r1W, sfW, fW] = ko
      const r1Stage = n === 6 ? 'BAR' : 'QF'
      if (koFx(r1Stage).length === 0) {
        if (n === 6) {
          mkFx('BAR', r1W, order[2], order[5])
          mkFx('BAR', r1W, order[3], order[4])
        } else {
          mkFx('QF', r1W, order[0], order[7])
          mkFx('QF', r1W, order[3], order[4])
          mkFx('QF', r1W, order[1], order[6])
          mkFx('QF', r1W, order[2], order[5])
        }
      }
      const r1 = koFx(r1Stage)
      if (koFx('SF').length === 0 && r1.length && r1.every(f => f.played)) {
        const w = r1.map(winnerOf)
        if (n === 6) {
          mkFx('SF', sfW, order[0], w[1])
          mkFx('SF', sfW, order[1], w[0])
        } else {
          mkFx('SF', sfW, w[0], w[1])
          mkFx('SF', sfW, w[2], w[3])
        }
      }
      const sf = koFx('SF')
      if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
        mkFx('F', fW, winnerOf(sf[0]), winnerOf(sf[1]))
      }
    }
  }

  // every tie in this round is drawn now: hold it back as a ceremony
  holdTheDraw()
}

const winnerOf = (fx: Fixture) => (fx.homeScore >= fx.awayScore ? fx.homeId : fx.awayId)

// ------------------------------------------------------------------
// Internationals
// ------------------------------------------------------------------

export interface Window { start: number; end: number; nations: string[]; size: number }

/** Call-up windows for the competitions that actually exist this season.
 *  Exported for the country desk: call-up and drop need the window's squad
 *  cap, and the screen needs to know whether a window is open at all. */
export function activeWindows(state: GameState): Window[] {
  const out: Window[] = []
  if (state.comps['wc']) {
    out.push({ start: 1, end: WC_KO_WEEKS[WC_KO_WEEKS.length - 1], nations: state.comps['wc'].teamIds, size: NAT_SQUAD_SIZE })
  }
  if (state.comps['trc']) {
    out.push({ start: TRC_WEEKS[0] - 1, end: TRC_WEEKS[TRC_WEEKS.length - 1], nations: ['NZL', 'RSA', 'AUS', 'ARG'], size: NAT_SQUAD_SIZE })
  }
  if (state.comps['pnc']) {
    out.push({ start: PNC_WEEKS[0] - 1, end: PNC_WEEKS[PNC_WEEKS.length - 1], nations: state.comps['pnc'].teamIds, size: NAT_SQUAD_SIZE })
  }
  if (state.comps['aut']) {
    out.push({ start: AUTUMN_WEEKS[0] - 1, end: AUTUMN_WEEKS[AUTUMN_WEEKS.length - 1], nations: ['ENG', 'FRA', 'IRE', 'SCO', 'WAL', 'ITA', 'NZL', 'RSA', 'AUS', 'ARG', 'FIJ', 'JPN'], size: NAT_SQUAD_SIZE })
  }
  if (state.comps['sn']) {
    out.push({ start: SIX_NATIONS_WEEKS[0] - 1, end: SIX_NATIONS_WEEKS[SIX_NATIONS_WEEKS.length - 1], nations: ['ENG', 'FRA', 'IRE', 'SCO', 'WAL', 'ITA'], size: NAT_SQUAD_SIZE })
  }
  if (state.comps['tour']) {
    out.push({ start: TOUR_WEEKS[0] - 1, end: TOUR_WEEKS[TOUR_WEEKS.length - 1], nations: state.comps['tour'].teamIds, size: NAT_SQUAD_SIZE })
  }
  if (state.comps['lions']) {
    out.push({ start: TOUR_WEEKS[0] - 1, end: TOUR_WEEKS[TOUR_WEEKS.length - 1], nations: state.comps['lions'].teamIds, size: NAT_SQUAD_SIZE })
  }
  return out
}

function manageInternationals(state: GameState, rng: Rng) {
  for (const w of activeWindows(state)) {
    if (state.week === w.start) {
      // call-ups
      const userCalls: Player[] = []
      const lionsCalls: Player[] = []
      for (const nat of w.nations) {
        const HOME4 = ['ENG', 'IRE', 'SCO', 'WAL']
        // the user's own federation names its best REAL players, whatever
        // their age or rating - no floor keeps a young Scot at home while a
        // stand-in gets generated (user: "there should be no age limits or
        // restrictions on who should be picked"). AI nations keep the floor
        // so the wider Test world's squad quality is untouched.
        const usersNat = nat === state.natTeam ||
          (nat === 'LIO' && state.natTeam != null && HOME4.includes(state.natTeam))
        // the squad, plus the next men in behind it
        const target = w.size + NAT_DEPTH
        const pool = Object.values(state.players)
          .filter(p => (nat === 'LIO' ? HOME4.includes(p.nat) : p.nat === nat) &&
            // England and France pick from their own leagues, and the
            // federation's own list obeys the rule the coach obeys
            // (country.ts homeBased) - one predicate, or the announcement
            // names men the screen then refuses to keep
            p.clubId && homeBased(state, p, nat) && !p.injury && !p.onLoan &&
            (usersNat || p.ca >= 68))
          .sort((a, b) => b.ca - a.ca)
          // READ THE POOL DEEPER THAN THE SQUAD. This used to cut at w.size,
          // which made the count below useless as a test of a country's depth:
          // every nation on earth, England included, looked exactly 32 men
          // deep. Cut at squad-plus-depth and the number means what the next
          // line asks it to mean - how many men this country can actually put
          // forward.
          .slice(0, target)
        // EMERGING NATIONS NEED A SQUAD AND SOMEBODY TO FIGHT FOR IT.
        //
        // Our club world does not carry enough home-based Georgians or Uruguayans
        // to field a Test squad, so they are generated. The first version stopped
        // the moment the squad was full, and that is the whole of this bug: every
        // qualified man in the country was IN the squad, natEligible came back
        // empty, and the country desk said "Nobody left standing outside camp".
        // Drop a man and he was instantly the only alternative to himself.
        //
        // Owner: "its saying nobody is fighting to get into the squad... if I drop
        // one player then they are the only ones available - this shouldn't be the
        // case."
        //
        // So it generates a POOL rather than a squad: the 32 who travel plus a
        // further NAT_DEPTH who did not make it and are visible on the desk as the
        // next men in. Only the best w.size are capped; the rest stay in the world
        // uncapped and callable, which is what makes selection a decision.
        // Big nations are untouched - their natural pool already runs to hundreds.
        //
        // The trigger is the POOL, not the squad. It used to fire only when a
        // nation could not nearly fill its 23, which meant Argentina - who can
        // field 34 qualified men and not a soul more - never generated anybody
        // and had exactly two players outside a 32-man camp. Thin is thin
        // whether you are two short of a squad or two short of a contest.
        if (nat !== 'LIO' && pool.length < target) {
          const natRep = nationByCode(nat)?.rep ?? 55
          const POS_CYCLE = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB'] as const
          let i = 0
          while (pool.length < target && i < target + 12) {
            const q = clamp(Math.round(natRep - 26 + rng() * 12), 40, 68)
            const hp = buildPlayer(
              {
                name: regenName(rng, nat, worldNames(state)), pos: POS_CYCLE[i % POS_CYCLE.length],
                age: 22 + Math.floor(rng() * 9), nat, q,
                gk: (POS_CYCLE[i % POS_CYCLE.length] === 'FH') && rng() < 0.5,
              },
              null, state.seed + state.week * 131 + i * 17, state.season)
            state.players[hp.id] = hp
            pool.push(hp)
            i++
          }
        }
        // THE BEST OF THEM TRAVEL; THE REST ARE THE NEXT MEN IN. Re-sorted
        // because the generated players were pushed on the end rather than
        // merged in rating order, and a squad that is not the best of its own
        // pool is not a selection.
        pool.sort((a, b) => b.ca - a.ca)
        // ---- THE COACH NAMES HIS OWN SQUAD ----
        //
        // Owner, v1.1.17: "dont auto pick the squad, it should be the coaches
        // job to pick them."
        //
        // Every nation's squad was assembled here, the user's included, and the
        // country desk was handed a finished list to fiddle with. That is the
        // wrong way round for the one job the international game is FOR: the
        // squad is the decision, and it was being made for him before he saw a
        // name.
        //
        // So his nation's camp opens EMPTY and waits. Everybody else's is
        // picked exactly as before - thirty other federations naming squads is
        // world simulation, not a decision anybody is taking. The pool is still
        // built either way, because it is what the desk offers him to pick
        // from, and because the men in it need to exist.
        //
        // The camp cannot stay empty forever: nameNatSquad below fills it from
        // this same pool if the coach has not named it by the time a Test
        // arrives, so a Test is never played with twelve men.
        if (nat === state.natTeam) {
          state.natSquads[nat] = []
          // THE SUMMONS, not an announcement. The federation is waiting on him
          // rather than handing him a team sheet, and it says so in the inbox
          // as well as holding Continue - one of those is a reminder and the
          // other is a wall, and a job this big deserves both.
          const v = { ...nationVars(nat), n: NAT_SQUAD_FLOOR }
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: tIn('en', 'news.natNameSubj', v),
            body: tIn('en', 'news.natName', v),
            k: 'news.natName', v,
          })
          continue
        }
        const travelling = pool.slice(0, w.size)
        state.natSquads[nat] = travelling.map(p => p.id)
        for (const p of travelling) {
          p.natSquad = true
          p.morale = clamp(p.morale + 0.5, 1, 10) // the proudest phone call in rugby
          if (nat === 'LIO') {
            // no - THIS is the proudest phone call in rugby
            p.lions = (p.lions ?? 0) + 1
            p.morale = clamp(p.morale + 0.5, 1, 10)
            if (p.clubId === state.userClubId) lionsCalls.push(p)
          } else if (p.clubId === state.userClubId) userCalls.push(p)
        }
        // the national coach announces HIS squad - a proper occasion
        if (nat === state.natTeam || (nat === 'LIO' && state.natTeam != null && HOME4.includes(state.natTeam))) {
          const FWD = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8']
          // the squad sheet is the men who TRAVEL - the pool now runs deeper
          // than the squad, and the next men in are not in the announcement
          const fwd = travelling.filter(p => FWD.includes(p.pos))
          const bks = travelling.filter(p => !FWD.includes(p.pos))
          const line = (p: Player) => `${p.name}${(p.caps ?? 0) > 0 ? ` (${p.caps})` : ' (uncapped)'}${p.clubId ? ` - ${state.clubs[p.clubId]?.short ?? ''}` : ''}`
          const newCaps = travelling.filter(p => (p.caps ?? 0) === 0).length
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `📋 Your ${nationNameIn('en', nat)} squad is announced`,
            k: 'news.natSquad',
            v: {
              ...nationVars(nat), n: travelling.length,
              caps_k: newCaps ? 'news.natSquadNew' : 'news.natSquadCapped', newCaps,
              fwd: fwd.map(line).join('; '), bks: bks.map(line).join('; '),
            },
            body: [
              `The federation has published your ${travelling.length}-man squad for the window. ${newCaps ? `${newCaps} uncapped name${newCaps > 1 ? 's' : ''} in the room.` : 'A fully capped group.'}`,
              '',
              `FORWARDS: ${fwd.map(line).join('; ')}`,
              '',
              `BACKS: ${bks.map(line).join('; ')}`,
              '',
              'Shape the squad and pick your Test XV from the Club & Country screen before each match.',
            ].join('\n'),
          })
        }
      }
      if (lionsCalls.length) {
        // the honour of a career deserves better than the generic list
        const tour = state.comps['lions']?.name ?? 'the Lions tour'
        const names = lionsCalls.map(p => `${p.name}${(p.lions ?? 0) > 1 ? ` (tour number ${p.lions})` : ''}`).join(', ')
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `🦁 LIONS: ${lionsCalls.length === 1 ? lionsCalls[0].name.split(' ').slice(-1)[0] : `${lionsCalls.length} of yours`} make the tour`,
          k: (state.season * 5 + state.week * 3) % 2 === 0 ? 'news.lionsCallA' : 'news.lionsCallB',
          v: {
            n: lionsCalls.length, names, tour,
            who: lionsCalls.length === 1 ? lionsCalls[0].name.split(' ').slice(-1)[0] : String(lionsCalls.length),
            subj_k: lionsCalls.length === 1 ? 'news.lionsSubjOne' : 'news.lionsSubjMany',
            is_k: lionsCalls.length === 1 ? 'news.isOne' : 'news.isMany',
            he_k: lionsCalls.length === 1 ? 'news.heOne' : 'news.heMany',
          },
          body: [
            (state.season * 5 + state.week * 3) % 2 === 0
              ? `The call every player in these islands dreams of: ${names} ${lionsCalls.length === 1 ? 'is' : 'are'} going on ${tour}. The whole club walks taller this morning.`
              : `The ${tour} squad is out, and the club's name is on it: ${names}. Training stopped for the announcement. Nobody minded.`,
            `${lionsCalls.length === 1 ? 'He' : 'They'} will be away for the tour window. Plan the run-in accordingly - and welcome back a Lion.`,
          ].join('\n'),
          playerId: lionsCalls[0].id,
        })
      }
      if (userCalls.length) {
        // several windows can open the same week - one combined item, not two
        const names = userCalls.map(p => `${p.name} (${p.nat})`).join(', ')
        const existing = state.news.find(n =>
          n.week === state.week && n.season === state.season && n.subject === 'International call-ups')
        if (existing) {
          existing.body += ` Also called up: ${names}.`
          // and the same names into the key's variables, or a French reader sees
          // the first window's list and never the second. The engine finds this
          // story by its English subject, which is why that stays put.
          if (existing.v) existing.v.names = `${existing.v.names}, ${names}`
        } else {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `International call-ups`,
            body: `The following players have been called up and will be unavailable during the international window: ${names}.`,
            k: 'news.callUps',
            v: { names },
          })
        }
      }
    }
    if (state.week === w.end + 1) {
      if (state.natLineup && w.nations.includes(state.natLineup.team)) state.natLineup = null
      const returnedMine: string[] = []
      const lionsHome: Player[] = []
      for (const nat of w.nations) {
        for (const id of state.natSquads[nat] ?? []) {
          const p = state.players[id]
          if (p) {
            p.natSquad = false
            // Test rugby empties the tank - returning internationals need
            // managing, not flogging
            p.cond = clamp(p.cond - 10, 20, 100)
            if (p.clubId === state.userClubId) {
              if (nat === 'LIO') lionsHome.push(p)
              else returnedMine.push(p.name)
            }
          }
        }
        delete state.natSquads[nat]
      }
      if (lionsHome.length) {
        // a Lions tour changes a player: he comes home a bigger presence
        const comp = state.comps['lions']
        const seriesWon = comp?.champion === 'LIO'
        for (const p of lionsHome) {
          p.morale = clamp(p.morale + 0.6, 1, 10)
          p.a.lea = clamp(p.a.lea + 1, 1, 20)
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `🦁 The Lions come home${seriesWon ? ' as series winners' : ''}`,
          k: seriesWon ? 'news.lionsHomeWon' : 'news.lionsHome',
          v: {
            tour: comp?.name ?? 'the Lions tour',
            names: lionsHome.map(p => p.name).join(', '),
            him_k: lionsHome.length === 1 ? 'news.himOne' : 'news.himMany',
            come_k: lionsHome.length === 1 ? 'news.comesOne' : 'news.comeMany',
          },
          body: [
            `Back in club colours after ${comp?.name ?? 'the Lions tour'}: ${lionsHome.map(p => p.name).join(', ')}.`,
            seriesWon
              ? `A series win in the luggage, and the kind of standing money cannot buy. Expect ${lionsHome.length === 1 ? 'him' : 'them'} to walk taller here too.`
              : `Win or lose, a tour changes a player - ${lionsHome.length === 1 ? 'he comes' : 'they come'} back a bigger presence in this dressing room.`,
            `The medical staff still counsel care: a Lions summer empties the tank like nothing else.`,
          ].join(' '),
          playerId: lionsHome[0].id,
        })
      }
      if (returnedMine.length) {
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
          subject: `Internationals return - leggy`,
          body: `Back in club colours: ${returnedMine.join(', ')}. The medical staff's advice is blunt: Test rugby empties the tank, and none of them are at full freshness this week. Rotate or risk it - your call.`,
          k: 'news.intlBack',
          v: { names: returnedMine.join(', ') },
        })
      }
    }
  }
}

// ------------------------------------------------------------------
// Training & recovery
// ------------------------------------------------------------------

/** Which attributes a training focus works on - the squad session and the
 *  personal plans (18A) speak the same vocabulary. */
export const FOCUS_ATTRS: Record<string, (keyof Player['a'])[]> = {
  balanced: [], scrum: ['scr', 'str'], lineout: ['lin'], attack: ['han', 'pas', 'vis'],
  defence: ['tac', 'pos'], fitness: ['sta'], kicking: ['kic', 'goa'],
}
/** Which specialist coach amplifies which training focus. */
export const FOCUS_COACH: Record<string, keyof GameState['staff'] | null> = {
  balanced: null, scrum: 'scrumCoach', lineout: 'scrumCoach', attack: 'attack',
  defence: 'defence', fitness: 'assistant', kicking: 'kicking',
}

/** How many personal plans the department can run at once: the assistant's
 *  level is the bandwidth, and a manager who came up through the coaching
 *  route (18B) runs one more himself. */
export function planCap(state: GameState): number {
  return 2 + (state.staff?.assistant ?? 0) + (state.mgrOrigin === 'coach' ? 1 : 0)
}

/** The plan a man is actually on, cap enforced at read time: newest
 *  assignments win a full book, same idiom as devFocus. */
export function activePlan(state: GameState, playerId: number): TrainingFocus | null {
  return (state.plans ?? []).slice(-planCap(state)).find(x => x.id === playerId)?.plan ?? null
}

/** One week of a personal training programme (18A, from the Rugby Manager
 *  assessment: "advanced individual training" was the one mechanic ahead of
 *  ours). A planned man works HIS programme instead of the squad session, so
 *  the plan is a choice, not a stack: the specialist coach and the paddock
 *  set the ceiling, and older men absorb less of it. Returns true on a bump. */
export function rollPlan(state: GameState, p: Player, rng: Rng): boolean {
  const plan = activePlan(state, p.id)
  if (!plan) return false
  const coach = FOCUS_COACH[plan]
  const coachLvl = coach ? (state.staff[coach] ?? 0) : 0
  const ageF = p.age <= 23 ? 1.3 : p.age <= 28 ? 1 : 0.6
  if (rng() >= 0.055 * (1 + coachLvl * 0.5 + facLevel(state, 'paddock') * 0.2) * ageF) return false
  for (const k of FOCUS_ATTRS[plan]) p.a[k] = clamp(p.a[k] + 1, 1, 20)
  return true
}

function weeklyTraining(state: GameState, rng: Rng) {
  const focusMap = FOCUS_ATTRS
  const coachFor = FOCUS_COACH
  // a winning run carries a dressing room; a losing one drags it under
  {
    const uid = state.userClubId
    // formGuide sorts by week; a raw slice reads appended cup rounds out of
    // calendar order (the Home pips bug)
    const last3 = formGuide(state, uid, 3)
    if (last3.length === 3 && (last3.every(r => r === 'W') || last3.every(r => r === 'L'))) {
      const up = last3[0] === 'W'
      for (const id of state.clubs[uid].players) {
        const p = state.players[id]
        if (p) p.morale = clamp(p.morale + (up ? 0.25 : -0.3), 1, 10)
      }
    }
  }

  // mentor pairs dissolve when either man leaves the building
  if (state.mentors?.length) {
    state.mentors = state.mentors.filter(mp => {
      const s2 = state.players[mp.senior]
      const k2 = state.players[mp.kid]
      const ok = s2 && k2 && s2.clubId === state.userClubId && k2.clubId === state.userClubId
      if (!ok && k2 && k2.clubId === state.userClubId) {
        k2.morale = clamp(k2.morale - 0.5, 1, 10)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
          subject: `${k2.name.split(' ').slice(-1)[0]} loses his mentor`,
          body: `With ${s2 ? s2.name : 'his mentor'} gone, ${k2.name} is training alone again. The academy coach will keep an eye on him - but it isn't the same.`,
          k: 'news.mentorLost',
          v: { kid: k2.name, last: k2.name.split(' ').slice(-1)[0], mentor: s2 ? s2.name : tIn('en', 'news.hisMentor') },
          playerId: k2.id,
        })
      }
      return !!ok
    })
  }

  // turnaround: a Sunday game followed by a Friday game leaves 5 days'
  // recovery, not 7 - the whole squad freshens up slower that week
  const lastFx = state.fixtures.find(f =>
    f.week === state.week - 1 && f.played && (f.homeId === state.userClubId || f.awayId === state.userClubId))
  const nextFx = state.fixtures.find(f =>
    f.week === state.week && !f.played && (f.homeId === state.userClubId || f.awayId === state.userClubId))
  const gapDays = lastFx && nextFx ? 7 + fixtureDayOff(nextFx.id) - fixtureDayOff(lastFx.id) : 7
  const turnF = gapDays / 7 // 5-day turnaround = 71% recovery; 9 days = 128%

  // the skipper's mood is contagious: a happy leader settles the room,
  // a miserable one drags it down with him
  if (!state.unemployed) {
    const capId = state.clubs[state.userClubId].captain
    const cap = capId != null ? state.players[capId] : null
    if (cap && cap.a.lea >= 13) {
      const pull = cap.morale >= 7 ? 0.04 : cap.morale <= 4 ? -0.05 : 0
      if (pull) {
        for (const id of state.clubs[state.userClubId].players) {
          const p = state.players[id]
          if (p && p.id !== cap.id) p.morale = clamp(p.morale + pull, 1, 10)
        }
      }
    }
  }

  // an agent smells a payday: an underpaid performer demands new terms.
  // Two doors in (17A, user: "players request pay rises" as part of "there
  // needs to be more going on"): the star playing the house down on small
  // money, and the honest regular whose wage has drifted far under the market
  // for what he now is. The rate rises with the second pool, so a season
  // brings a handful of these conversations rather than one or two.
  if (!state.unemployed && rng() < 0.2) {
    const squad = state.clubs[state.userClubId].players.map(id => state.players[id]).filter(Boolean)
    const cands = squad.filter(p =>
      !p.acad && !p.loanFrom &&
      !(p.wantsDeal ?? 0) && p.contractEnds > state.season && p.age <= 32 &&
      ((p.stats.apps >= 8 && p.stats.ratingSum / Math.max(1, p.stats.apps) >= 7.15 && p.wage < playerWage(p.ca, p.age) * 0.85) ||
        (p.stats.apps >= 10 && p.stats.ratingSum / Math.max(1, p.stats.apps) >= 6.6 && p.wage < playerWage(p.ca, p.age) * 0.7)))
    if (cands.length) {
      const p = cands[Math.floor(rng() * cands.length)]
      p.wantsDeal = state.week
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
        subject: `💼 ${p.name} wants improved terms`,
        body: `${p.name}'s agent has been on the phone: his client is playing the house down (avg ${(p.stats.ratingSum / Math.max(1, p.stats.apps)).toFixed(2)}) on ${fmtMoney(p.wage)}/week, and the market rate is well north of that. He has ${p.contractEnds - state.season} year${p.contractEnds - state.season > 1 ? 's' : ''} left, but leave it unresolved and his head will drop - and other clubs will smell it. Offer a new deal from his player page.`,
        k: 'news.wantsTerms',
        v: {
          player: p.name, avg: (p.stats.ratingSum / Math.max(1, p.stats.apps)).toFixed(2),
          wage: fmtMoney(p.wage), n: p.contractEnds - state.season,
        },
        playerId: p.id,
      })
    }
  }

  // the physio's clean bill of health, one note for the week. Three separate
  // "back in training" letters in one midwinter inbox told the manager the same
  // thing three times over, and he still had to open each one to learn who.
  const returned: Player[] = []
  for (const club of Object.values(state.clubs)) {
    const isUser = club.id === state.userClubId
    for (const id of club.players) {
      const p = state.players[id]
      if (!p) continue
      // recovery - rusty players take longer to freshen up
      const gym = isUser ? facLevel(state, 'gym') * 0.9 : 0
      p.cond = clamp(p.cond + Math.round((((p.rust ?? 0) > 0 ? 16 : 22) + gym) * (isUser ? turnF : 1)), 20, 100)
      p.sharp = clamp(p.sharp - 4, 0, 100)
      if ((p.rust ?? 0) > 0) p.rust = (p.rust ?? 1) - 1
      if (p.injury && state.week >= p.injury.until) {
        const weeksOut = p.injury.weeks ?? 2
        p.injury = null
        p.specialist = false
        p.cond = 70
        p.sharp = 40
        // a spell of match rust: playable, but rushing him back risks re-injury
        p.rust = weeksOut >= 8 ? 3 : weeksOut >= 3 ? 2 : 1
        // academy returns are the academy coach's business - the first-team
        // inbox only hears about players the gaffer might actually pick
        if (isUser && !p.acad) returned.push(p)
      }
      // gentle in-season growth for youngsters, drift for user's training
      // focus. Damped near the top: without it the whole world's best 23
      // converge on 99 by season 12 and elite means nothing
      const growBoost = isUser ? 1 + state.staff.assistant * 0.25 : 1
      const eliteF = p.ca >= 94 ? 0.15 : p.ca >= 88 ? 0.5 : 1
      if (p.age <= 24 && p.ca < p.pa && rng() < 0.06 * growBoost * eliteF) p.ca += 1
      // a man on a personal plan works his own programme this week (18A);
      // everyone else takes the squad session
      if (isUser && activePlan(state, p.id)) {
        rollPlan(state, p, rng)
      } else if (isUser && state.training !== 'balanced') {
        const coach = coachFor[state.training]
        const coachLvl = coach ? (state.staff[coach] ?? 0) : 0
        if (rng() < 0.03 * (1 + state.staff.assistant * 0.5 + coachLvl * 0.45 + facLevel(state, 'paddock') * 0.2)) {
          for (const k of focusMap[state.training]) p.a[k] = clamp(p.a[k] + 1, 1, 20)
        }
      }
      // Morale drift, made conditional (v1.1.4, owner: "make morale genuinely
      // tricky - manager choices must matter"). It used to pull every man
      // toward 6.5 at 6% a week regardless of anything, which meant every
      // grievance self-healed in a month with the manager doing nothing.
      // Two changes, both deterministic:
      //   - the target depends on his rugby: a man getting his game drifts
      //     toward Good (6.5); a man who is not settles toward Okay (5.5),
      //     so a big squad's fringe no longer sits contentedly at Good;
      //   - the pull is asymmetric: morale falls to its target at the old 6%
      //     but RECOVERS at barely half that, so a soured man needs an actual
      //     intervention - minutes, a word in the office, a new deal, a sale -
      //     rather than a fortnight of being ignored.
      if (isUser) {
        const played = (p.lastWk ?? -9) >= state.week - 1
        const target = played || p.injury || p.natSquad ? 6.5 : 5.5
        p.morale += (target - p.morale) * (p.morale < target ? 0.035 : 0.06)
        const frozen = !played && (p.lastWk ?? -9) < state.week - 3 && !p.injury && !p.acad && !p.natSquad && p.stats.apps + 3 < state.week
        if (played) p.morale = clamp(p.morale + 0.1, 1, 10)
        else if (frozen) p.morale = clamp(p.morale - (p.pers === 'Mercenary' || p.pers === 'Ambitious' ? 0.35 : 0.2), 1, 10)
      }
      // an unresolved contract demand sours by the week
      if (isUser && (p.wantsDeal ?? 0) > 0) {
        p.morale = clamp(p.morale - 0.12, 1, 10)
        if (state.week - (p.wantsDeal ?? 0) === 8 && (p.pers === 'Mercenary' || p.pers === 'Ambitious')) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
            subject: `💼 ${p.name}'s agent goes public`,
            body: `Two months of silence from the club, so the agent has taken it to the papers: "${p.name} is one of the best-performing players in the league and the club knows our position." Rival clubs will have noticed. Sort a new deal on his player page - or brace for bids.`,
            k: 'news.agentPublic',
            v: { player: p.name },
            playerId: p.id,
          })
        }
      }
      // A good mentor is worth an extra coach - and a bad one is worth almost
      // nothing. The pairing's chance of a bump now scales with how well the two
      // men actually work together (game/mentoring.ts), so pairing a Mercenary
      // with a Temperamental kid is the waste of a season it ought to be. The
      // base rate is unchanged at the mid-fit case, so a squad's average paired
      // kid develops exactly as before.
      // canBeMentored rather than p.acad (user: "all players under 21 can have a
      // mentor"). This gate and the Training screen's dropdown are the same rule
      // and now read the same function: widening one without the other would
      // produce a pairing the game shows, reports on, and does nothing for.
      if (isUser && canBeMentored(p) && (state.mentors ?? []).some(mp => mp.kid === p.id)) {
        const mpair = (state.mentors ?? []).find(mp => mp.kid === p.id)!
        const mentor = state.players[mpair.senior]
        // a senior with two kids splits his attention: mentorLoad is 1 for one
        // kid, so every pairing that existed before multi-mentee arrived
        // develops exactly as it did
        const fitMult = mentor ? mentorBoost(mentor, p) * mentorLoad(state, mpair.senior) : 1
        if (rng() < 0.045 * fitMult) {
          const keys = Object.keys(p.a) as (keyof Player['a'])[]
          const k = keys[Math.floor(rng() * keys.length)]
          p.a[k] = clamp(p.a[k] + 1, 1, 20)
        }
        const pair = (state.mentors ?? []).find(mp => mp.kid === p.id)!
        const senior = state.players[pair.senior]
        if (senior && rng() < 0.008 && p.pers !== senior.pers) {
          p.pers = senior.pers
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
            subject: `${p.name.split(' ').slice(-1)[0]} is turning into his mentor`,
            body: `The coaches have noticed it in the little things - the extras after training, the way he talks in the huddle. ${p.name} is starting to carry himself like ${senior.name}. Character: now ${senior.pers.toLowerCase()}.`,
            k: 'news.becomesMentor',
            v: { player: p.name, last: p.name.split(' ').slice(-1)[0], mentor: senior.name, pers_k: `pers.${senior.pers}` },
            playerId: p.id,
          })
        }
      }
      // the academy coach quietly builds tomorrow's team
      if (isUser && p.acad && rng() < 0.025 + state.staff.academyCoach * 0.025) {
        const keys = Object.keys(p.a) as (keyof Player['a'])[]
        const k = keys[Math.floor(rng() * keys.length)]
        p.a[k] = clamp(p.a[k] + 1, 1, 20)
      }
      if (isUser && state.staff.physio > 0) p.cond = clamp(p.cond + state.staff.physio * 3, 20, 100)
      // the medical room earns its money: injured men can come back early
      if (isUser && p.injury && p.injury.until - state.week >= 2 && rng() < 0.06 + state.staff.physio * 0.02) {
        p.injury.until -= 1
        if (p.injury.until - state.week <= 0) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
            subject: `${p.name} ahead of schedule`,
            body: `Good news from the treatment table: ${p.name} (${p.injury.desc}) has smashed his rehab targets and is available again this week - earlier than anyone dared hope.`,
            k: 'news.aheadOfSchedule',
            v: { player: p.name, injury_k: p.injury.dk ?? 'common.nothing' },
            playerId: p.id,
          })
        }
      }
      // a recovery week puts petrol back in every tank
      if (isUser && state.matchPrep === 'recovery') p.cond = clamp(p.cond + 3.5, 20, 100)
      // the live market price, refreshed weekly: position curve, form
      // momentum and how much contract the buyer would be getting
      p.value = playerValue(p.ca, p.age, p.pa, p.pos, p.form, p.contractEnds - state.season)
    }
  }
  if (returned.length) {
    const one = returned.length === 1
    const line = (p: Player) => `${p.name} (${p.pos}), rusty for ${p.rust} week${(p.rust ?? 1) > 1 ? 's' : ''}`
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
      subject: one ? `${returned[0].name} back in training` : `${returned.length} back in training`,
      body: `${one ? 'Available for selection again' : 'Available for selection again'}: ${returned.map(line).join(', ')}. Pick a rusty man now and he could break down again; ease him back and he will be right.`,
      k: 'news.backInTraining',
      v: {
        n: returned.length, who: one ? returned[0].name : String(returned.length),
        men_l: JSON.stringify(returned.map(pl => ({ k: 'news.rustyMan', name: pl.name, pos: pl.pos, n: pl.rust ?? 1 }))),
      },
      playerId: returned[0].id,
    })
  }
}

/** The spotlight follows an unbeaten run (16C). Milestone letters at 8, 12
 *  and 16 competitive games without defeat, and an honest obituary when the
 *  run dies. Deterministic - phrasing keys off the milestone, never the rng.
 *  Exported so scripts/unbeatenprobe.ts can drive it directly. */
export function runSpotlight(state: GameState, fx: Fixture, us: number, them: number) {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const run = unbeatenRun(state, club.id) // includes the match just played
  // Same shape as gossip's wire(): the key is required and the English is
  // rendered from the dictionary, so a milestone letter cannot be added in one
  // language only.
  const push = (k: string, v: Vars) => state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v, fixtureId: fx.id,
  })
  if (us < them) {
    // the run that just ended is everything unbeaten BEFORE this fixture
    const before = state.fixtures
      .filter(f => f.played && f.compId !== 'fr' && f.id !== fx.id && (f.homeId === club.id || f.awayId === club.id))
      .sort((a, b) => a.week - b.week)
    let ended = 0
    for (let i = before.length - 1; i >= 0; i--) {
      const f = before[i]
      const u = f.homeId === club.id ? f.homeScore : f.awayScore
      const t = f.homeId === club.id ? f.awayScore : f.homeScore
      if (u < t) break
      ended++
    }
    if (ended >= 8) {
      push('news.runDies', { n: ended })
    }
    return
  }
  if (run === 8) {
    push('news.run8', { club: club.name })
  } else if (run === 12) {
    push('news.run12', {})
  } else if (run === 16) {
    push('news.run16', {})
  }
}

// ------------------------------------------------------------------
// Finances & board
// ------------------------------------------------------------------

function weeklyFinance(state: GameState, rng: Rng) {
  const club = state.clubs[state.userClubId]
  // A LOAN COSTS WHAT THE LETTER SAID IT COSTS (audit 16D). The signing news
  // has always promised the parent club "will cover half his wage", and this
  // line charged the full amount anyway. Half for a borrowed man, as promised.
  const wages = club.players.reduce((s, id) => {
    const p = state.players[id]
    if (!p) return s
    return s + (p.loanFrom ? Math.round(p.wage / 2) : p.wage)
  }, 0)
  club.balance -= wages
  // backroom staff wages - real salaries where a real man holds the job
  club.balance -= staffWageBill(state)
  // sponsorship, broadcast and the central-distribution top-up for a club whose
  // ground is smaller than its name (weeklyCentral documents why that top-up
  // exists and why it is shaped as a gap rather than a flat rise for everyone)
  club.balance += weeklyCentral(club)
  // and the commercial department: whatever the three deals are worth this week,
  // clauses included. An empty slot pays nothing, which is the point of it (F30).
  club.balance += commercialWeekly(state)
  // gate receipts from this week's home fixture
  const home = state.fixtures.find(f =>
    f.week === state.week && f.played && f.homeId === club.id && f.att)
  // F31: boxes and lounges mean the same crowd is worth more. 4% a level, so a
  // maxed block lifts a £30 head to £36. operatingCost documents why this one
  // facility carries an extra weekly bill.
  const hosp = 1 + facLevel(state, 'hospitality') * 0.04
  if (home?.att) club.balance += Math.round(home.att * 30 * hosp)
  // the club shop: replica shirts shift faster when the terraces are happy
  const shop = facLevel(state, 'shop')
  if (shop > 0) club.balance += Math.round(shop * 9_000 * (0.6 + (state.fanMood ?? 60) / 100))
  // running the place. A ground has to be heated, mown, stewarded and
  // insured 52 weeks a year, and every facility level is a building with
  // staff in it. This is what stops the estate being a free ratchet: going
  // from a good gym to a great one is a bill that never stops arriving.
  club.balance -= operatingCost(state)
  // weekly balance snapshot for the season chart
  ;(state.finHist ??= []).push({ w: state.week, b: club.balance })
  if (state.finHist.length > 50) state.finHist = state.finHist.slice(-50)
  if (club.balance < -2_000_000 && state.week % 6 === 0) {
    // A flat -5 said the same thing about a 2M overdraft and a 20M one, so a
    // winning side could run a hole of any depth with the board on 100. The
    // hit now scales with the hole: near the threshold it is what it always
    // was, and it grows from there.
    const debtM = Math.abs(club.balance) / 1_000_000
    club.boardConfidence = clamp(club.boardConfidence - clamp(3 + debtM, 3, 14), 0, 100)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: debtM >= 8 ? 'Board demands the books are balanced' : 'Board concerned by finances',
      body: `The club is ${fmtMoney(Math.abs(club.balance))} in the red. The board urges you to balance the books - consider player sales.`,
      k: debtM >= 8 ? 'news.debtDemand' : 'news.debtConcern',
      v: { debt: fmtMoney(Math.abs(club.balance)) },
    })
  }
}

function matchReport(state: GameState, fx: Fixture) {
  // the engine already filed a full report for matches played in detail -
  // a second VICTORY/DEFEAT item on the same result is just noise
  if (fx.events?.length) return
  const comp = state.comps[fx.compId]
  const isHome = fx.homeId === state.userClubId
  const us = isHome ? fx.homeScore : fx.awayScore
  const them = isHome ? fx.awayScore : fx.homeScore
  const verdict = us > them ? 'VICTORY' : us < them ? 'DEFEAT' : 'DRAW'
  const scorers = (fx.events ?? [])
    .filter(e => e.type === 'TRY' && e.playerName)
    .map(e => `${e.playerName} (${e.min}')`)
  const motm = fx.motm != null ? state.players[fx.motm] : null
  const rows: { k: string; [x: string]: string | number }[] = [
    { k: 'news.resScore', home: teamShort(state, fx.homeId), hs: fx.homeScore, as: fx.awayScore, away: teamShort(state, fx.awayId) },
  ]
  if (fx.att) rows.push({ k: 'news.resAtt', att: fx.att, venue: fx.venue?.name ?? state.clubs[fx.homeId]?.stadium ?? tIn('en', 'news.resNeutral') })
  rows.push(scorers.length ? { k: 'news.resTries', tries: scorers.join(', ') } : { k: 'news.resNoTries' })
  if (motm) rows.push({ k: 'news.resMotm', player: motm.name })
  const lines = rows.map(r => tIn('en', r.k, r))
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'result', read: false,
    subject: `${verdict}: ${us}-${them} ${us >= them ? 'over' : 'to'} ${teamShort(state, isHome ? fx.awayId : fx.homeId)} (${comp?.short})`,
    body: lines.join('\n'),
    k: 'news.result',
    v: {
      verdict_k: us > them ? 'news.resWin' : us < them ? 'news.resLoss' : 'news.resDraw',
      us, them, over_k: us >= them ? 'news.resOver' : 'news.resTo',
      opp: teamShort(state, isHome ? fx.awayId : fx.homeId), comp: comp?.short ?? '',
      rows_ll: JSON.stringify(rows),
    },
    fixtureId: fx.id,
  })
}

/**
 * THE BACK PAGE, THE GRUDGE AND THE LEDGER (v1.2.2, pre-launch audit).
 *
 * Three things that happen the moment the manager's side has played, each
 * turning a number that was already true into a sentence somebody would
 * repeat:
 *
 *  - THE BACK PAGE writes one tabloid headline from the match's DEFINING
 *    event rather than the score. The order is a judgement about what a
 *    sub-editor would lead with: a comeback beats a red card beats a
 *    hat-trick beats a derby beats a rout beats a last-minute swing beats a
 *    debut try, and only a match with none of those gets the plain result.
 *  - THE GRUDGE checks the league table against the club's nominated rival
 *    (the first derby pairing rivalries.ts knows) and files a story the
 *    week you climb above them, or fall below.
 *  - THE LEDGER records the quiet firsts - the first win at a ground, the
 *    first derby win, ten unbeaten - once each, as a story and as an entry
 *    on Legacy. mgrMilestones already salutes the round numbers on the
 *    manager's own record, so those are not repeated here.
 *
 * None of it moves a stat. It is there to be noticed.
 */
export function afterClubMatch(state: GameState, fx: Fixture) {
  const club = state.clubs[state.userClubId]
  if (!club || fx.compId === 'fr') return
  const isHome = fx.homeId === club.id
  const oppId = isHome ? fx.awayId : fx.homeId
  const opp = state.clubs[oppId]
  const us = isHome ? fx.homeScore : fx.awayScore
  const them = isHome ? fx.awayScore : fx.homeScore
  const won = us > them, lost = us < them
  const ev = fx.events ?? []
  const pts = (e: MatchEvent) => e.type === 'TRY' ? 5 : e.type === 'CON' ? 2 : (e.type === 'PEN' || e.type === 'DG') ? 3 : 0
  const oppShort = teamShort(state, oppId)
  const usShort = teamShort(state, club.id)

  // ---- the back page ----
  {
    const htAt = ev.findIndex(e => e.type === 'HT')
    const first = htAt >= 0 ? ev.slice(0, htAt) : ev.filter(e => e.min <= 40)
    const htUs = first.filter(e => e.teamId === club.id).reduce((a, e) => a + pts(e), 0)
    const htThem = first.filter(e => e.teamId === oppId).reduce((a, e) => a + pts(e), 0)
    const reds = ev.filter(e => e.type === 'RC')
    const tryCount = new Map<number, { n: number; name: string }>()
    for (const e of ev) if (e.type === 'TRY' && e.playerId != null) {
      const cur = tryCount.get(e.playerId) ?? { n: 0, name: e.playerName ?? '' }
      cur.n++; tryCount.set(e.playerId, cur)
    }
    const hat = [...tryCount.entries()].find(([, v]) => v.n >= 3)
    const late = ev.filter(e => e.min >= 78 && pts(e) > 0).sort((a, b) => b.min - a.min)[0]
    const debut = ev.find(e => e.type === 'TRY' && e.playerId != null && e.teamId === club.id && state.players[e.playerId]?.stats.apps === 1)
    const derby = isDerby(fx.homeId, fx.awayId)
    const margin = Math.abs(us - them)
    const base = { us: usShort, opp: oppShort, s1: us, s2: them }
    let hk = won ? 'bp.headWin' : lost ? 'bp.headLoss' : 'bp.headDraw'
    let hv: Record<string, string | number> = base
    let sk = won ? 'bp.subWin' : lost ? 'bp.subLoss' : 'bp.subDraw'
    let sv: Record<string, string | number> = { ...base, gaffer: opp?.coach ?? oppShort }
    if (won && htThem - htUs >= 10) { hk = 'bp.headComeback'; hv = { ...base, n: htThem - htUs }; sk = 'bp.subComeback' }
    else if (lost && htUs - htThem >= 10) { hk = 'bp.headCollapse'; hv = { ...base, n: htUs - htThem }; sk = 'bp.subCollapse' }
    else if (reds.length) {
      const r = reds[0]; const mine = r.teamId === club.id
      hk = mine ? 'bp.headRedOurs' : 'bp.headRedTheirs'; hv = { ...base, player: r.playerName ?? '', min: r.min }
      sk = won ? 'bp.subRedWon' : 'bp.subRedLost'
    }
    else if (hat) { hk = 'bp.headHatTrick'; hv = { ...base, player: hat[1].name, n: hat[1].n }; sk = won ? 'bp.subHatWon' : 'bp.subHatLost' }
    else if (derby) { hk = won ? 'bp.headDerbyWon' : lost ? 'bp.headDerbyLost' : 'bp.headDerbyDraw'; sk = won ? 'bp.subDerbyWon' : lost ? 'bp.subDerbyLost' : 'bp.subDraw' }
    else if (margin >= 25) { hk = won ? 'bp.headRout' : 'bp.headRouted'; hv = { ...base, n: margin }; sk = won ? 'bp.subRout' : 'bp.subRouted' }
    else if (late && ((late.teamId === club.id && won) || (late.teamId === oppId && lost))) { hk = won ? 'bp.headLateWin' : 'bp.headLateLoss'; hv = { ...base, player: late.playerName ?? '', min: late.min }; sk = won ? 'bp.subLateWin' : 'bp.subLateLoss' }
    else if (debut) { hk = 'bp.headDebut'; hv = { ...base, player: debut.playerName ?? '' }; sk = won ? 'bp.subDebutWon' : 'bp.subDebutLost' }
    state.backPage = { fixtureId: fx.id, compId: fx.compId, week: fx.week, hk, hv, sk, sv }
  }

  // ---- the grudge ----
  {
    const rivalId = rivalsOf(club.id)[0]
    const table = state.comps[club.leagueId]?.table
    if (rivalId && table && state.clubs[rivalId]?.leagueId === club.leagueId) {
      const pos = (id: string) => {
        const rows = [...table].sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.tf - a.tf)
        return rows.findIndex(r => r.teamId === id) + 1
      }
      const mine = pos(club.id), theirs = pos(rivalId)
      if (mine > 0 && theirs > 0) {
        const above = mine < theirs
        if (state.grudgeAbove != null && above !== state.grudgeAbove && state.week > 3) {
          const k = above ? 'news.grudgeAbove' : 'news.grudgeBelow'
          const v = { rival: teamShort(state, rivalId), mine, theirs }
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
            subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v,
          })
        }
        state.grudgeAbove = above
      }
    }
  }

  // ---- the ledger ----
  {
    const ledger = (state.ledger ??= [])
    const have = new Set(ledger.map(e => `${e.k}|${e.v.at ?? ''}`))
    const add = (k: string, v: Record<string, string | number>) => {
      if (have.has(`${k}|${v.at ?? ''}`)) return
      ledger.push({ k, v, season: state.season, week: state.week })
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: tIn('en', 'news.ledgerFirstSubj', v), body: tIn('en', k, v), k, v,
      })
    }
    // first win at this ground - counted across the whole career in the save
    if (won && !isHome) {
      const priorAny = state.fixtures.some(f => f.played && f.id !== fx.id && f.awayId === club.id && f.homeId === oppId && f.compId !== 'fr' && f.awayScore > f.homeScore)
      if (!priorAny) {
        const tries = state.fixtures.filter(f => f.played && f.awayId === club.id && f.homeId === oppId && f.compId !== 'fr').length
        add('news.ledgerFirstAway', { at: oppId, ground: opp?.stadium ?? oppShort, opp: oppShort, tries, tries_k: tries === 1 ? 'news.ledgerFirstGo' : 'news.ledgerGoes' })
      }
    }
    // first derby win
    if (won && isDerby(fx.homeId, fx.awayId) && !ledger.some(e => e.k === 'news.ledgerFirstDerby')) {
      add('news.ledgerFirstDerby', { at: '', derby: derbyName(fx.homeId, fx.awayId) ?? '', opp: oppShort })
    }
    // ten, twenty unbeaten in the league
    const res = state.fixtures.filter(f => f.played && f.compId === club.leagueId && (f.homeId === club.id || f.awayId === club.id)).sort((a, b) => b.week - a.week || b.id - a.id)
    let run = 0
    for (const f of res) {
      const a = f.homeId === club.id ? f.homeScore : f.awayScore
      const b = f.homeId === club.id ? f.awayScore : f.homeScore
      if (a >= b) run++; else break
    }
    if (run === 10) add('news.ledgerUnbeaten', { at: '10', n: 10 })
    if (run === 20) add('news.ledgerUnbeaten', { at: '20', n: 20 })
  }
}

function milestones(state: GameState, rng: Rng) {
  const club = state.clubs[state.userClubId]
  for (const id of club.players) {
    const p = state.players[id]
    // only the week he actually crossed the number - never a repeat salute
    if (!p || !p.stats.apps || p.lastWk !== state.week) continue
    const totApps = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
    const totTries = p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
    const totPts = p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
    const hits: { k: string; n: number }[] = []
    if ([50, 100, 150, 200, 250].includes(totApps)) hits.push({ k: 'news.mileApps', n: totApps })
    if ([25, 50, 75, 100].includes(totTries)) hits.push({ k: 'news.mileTries', n: totTries })
    if ([250, 500, 1000, 1500].includes(totPts)) hits.push({ k: 'news.milePts', n: totPts })
    for (const h of hits) {
      const v = { player: p.name, what_k: h.k, n: h.n }
      const body = tIn('en', 'news.milestone', v)
      // a player parked exactly on a number (no tries this week) must not
      // be saluted again - one presentation per milestone
      if (state.news.some(n => n.body === body)) continue
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `Milestone: ${p.name}`,
        body,
        k: 'news.milestone', v,
        playerId: p.id,
      })
    }
  }
}

function leagueRoundUp(state: GameState) {
  const leagueId = state.clubs[state.userClubId].leagueId
  const round = state.fixtures.filter(f =>
    f.compId === leagueId && f.week === state.week && f.played &&
    f.homeId !== state.userClubId && f.awayId !== state.userClubId)
  if (!round.length) return
  const rows = round.map(f => ({
    k: 'news.roundRow', home: teamShort(state, f.homeId), hs: f.homeScore,
    as: f.awayScore, away: teamShort(state, f.awayId),
  }))
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `${state.comps[leagueId]?.short} round-up`,
    body: rows.map(r => tIn('en', r.k, r)).join('\n'),
    k: 'news.roundUp',
    v: { comp: state.comps[leagueId]?.short ?? '', rows_ll: JSON.stringify(rows) },
  })
}

/** The dugout counts too: round numbers on the manager's own record.
 *  The win check only fires on a win, or it would repeat while the
 *  counter sits on the mark through defeats. */
/**
 * The career marks that get saluted, exported so the Legacy screen can show what
 * you are chasing rather than only what you have already passed.
 *
 * They were local arrays here, which meant the game celebrated a threshold it had
 * never mentioned: your 250th win arrived as a surprise, and nothing anywhere said
 * a 250th win was a thing.
 */
export const WIN_MARKS = [50, 100, 250, 500, 750, 1000]
export const GAME_MARKS = [100, 250, 500, 750, 1000]

function mgrMilestones(state: GameState, won: boolean) {
  const m = state.mgr
  const winMarks = WIN_MARKS
  const gameMarks = GAME_MARKS
  const pct = m.m > 0 ? Math.round((m.w / m.m) * 100) : 0
  if (won && winMarks.includes(m.w)) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: `🏅 Career win number ${m.w}`,
      body: `That was the ${m.w}th win of your managerial career - ${m.w} from ${m.m} matches (${pct}%), with ${m.trophies.length} ${m.trophies.length === 1 ? 'trophy' : 'trophies'} in the cabinet. The staff mark it with a quiet round of applause in the corridor. Back to work.`,
      k: 'news.careerWin',
      v: { w: m.w, m: m.m, pct, n: m.trophies.length, cup_k: m.trophies.length === 1 ? 'news.trophyOne' : 'news.trophyMany' },
    })
  }
  if (gameMarks.includes(m.m)) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: `📇 Match ${m.m} in the dugout`,
      body: `You have now taken charge of ${m.m} matches: ${m.w} won, ${m.d} drawn, ${m.l} lost (${pct}%). Very few last this long in the job. The trick, as ever, is the next one.`,
      k: 'news.careerGames',
      v: { m: m.m, w: m.w, d: m.d, l: m.l, pct },
    })
  }
}

function boardReaction(state: GameState, fx: Fixture, delegated = false) {
  const club = state.clubs[state.userClubId]
  const isHome = fx.homeId === club.id
  const us = isHome ? fx.homeScore : fx.awayScore
  const them = isHome ? fx.awayScore : fx.homeScore
  const oppRep = state.clubs[isHome ? fx.awayId : fx.homeId]?.rep ?? 70
  const diff = (oppRep - club.rep) / 25
  const derbyF = fx.derby ? 1.8 : 1 // derbies echo in the boardroom
  // a new owner watches every result like it is a referendum on you
  const ownerF = state.newOwnerUntil != null && state.week <= state.newOwnerUntil ? 1.4 : 1
  // The opponent's standing scales the swing: beating a better side is worth more,
  // losing to one hurts less. Right idea, but it had no floor, so past 1.25 of diff
  // both terms changed SIGN and the board's opinion inverted. Measured:
  //
  //   rep 88 beating rep 55   -0.14   a win that cost you confidence
  //   rep 92 beating rep 50   -0.86   worse the bigger the gulf
  //   rep 55 losing to rep 88 +0.14   a defeat that earned you some
  //
  // So a big club was punished for winning cup ties against minnows, and a small
  // club was unsackable: it shed 0.5 a defeat and gained 4.5 a win, which nets
  // positive winning one in eight. The audit found board confidence bottoming out
  // at 3.3 and the sack threshold is 3, which is why the doomed-manager test could
  // never actually get anyone sacked.
  //
  // A floor of 0.8 keeps the whole gradient and removes both inversions: a win
  // always helps a little, a defeat always hurts a little, and how much still
  // depends on who it was against.
  const mag = Math.max(0.8, us > them ? 2.5 + diff * 2 : 2.5 - diff * 2)
  // THE STANCE (25C, user: "the manager should set the expectations... if the
  // manager is losing then pressure should build"). Aim high at the season
  // launch and every result is measured against your own words: wins earn a
  // little more credit, defeats cost noticeably more - the asymmetry IS the
  // pressure the manager signed up for. Heads-down mutes the needle both
  // ways. Unset (never asked, old save, AI career) is exactly the old maths.
  const stanceF = state.stance === 'high' ? (us > them ? 1.15 : 1.3)
    : state.stance === 'safe' ? 0.85 : 1
  // PATIENCE SCALES WITH STATURE (wave 2): the whole swing, win or loss, is
  // louder at a big club and quieter at a small one - boardPatience(rep) is
  // the single curve, shared with the season-end reconciliation below so a
  // giant's board is impatient everywhere it can be, not just at one
  // checkpoint. Multiplying both directions (rather than only losses) keeps
  // the existing diff-term asymmetry intact: diff already makes an upset WIN
  // worth little to a giant and an upset LOSS cost it dearly; patienceF just
  // turns the whole boardroom's volume up or down around that.
  const patienceF = boardPatience(club.rep)
  if (us > them) club.boardConfidence = clamp(club.boardConfidence + mag * derbyF * ownerF * stanceF * patienceF, 0, 100)
  else if (us < them) club.boardConfidence = clamp(club.boardConfidence - mag * derbyF * ownerF * stanceF * patienceF, 0, 100)

  // The dressing room keeps its own book, and it is slower to move than the
  // board's. Belief is earned a win at a time and it does not arrive in one
  // good afternoon: the gains are smaller than the board's and the trust it
  // takes a season to build can be spent in a bad month, which is the point.
  // Beating a better side counts for more here too - players know who is good.
  // A RUN COMPOUNDS (user: "im unbeaten in the game, top of the league mood is
  // positive but the team are still making their mind up"). Win by win the gain
  // was flat, so eight straight wins read the same as eight scattered ones and
  // an unbeaten side's room was still "making its mind up" in November. Each
  // consecutive win now adds a little more belief than the last, capped at +2 a
  // match so a long streak is conviction, not worship - and one defeat still
  // spends it the old way.
  let streak = 0
  let slump = 0
  {
    const mine = state.fixtures
      .filter(f => f.played && (f.homeId === club.id || f.awayId === club.id) && f.compId !== 'fr')
      .sort((a, b) => a.week - b.week)
    for (let i = mine.length - 1; i >= 0; i--) {
      const f = mine[i]
      if (f.homeId === club.id ? f.homeScore > f.awayScore : f.awayScore > f.homeScore) { if (slump) break; streak++ }
      else if (f.homeId === club.id ? f.homeScore < f.awayScore : f.awayScore < f.homeScore) { if (streak) break; slump++ }
      else break
    }
  }
  // SYMMETRIC AT THE BASE (16C hardening). The loss base sat at 1.2 against a
  // win base of 1.5, which let a plainly losing season NET GAIN belief: the
  // trustprobe caught a 12W-16L year finishing +5. Wins still pay extra for
  // beating better sides and for streaks - quality is rewarded - but an equal
  // record against equal opposition must not manufacture conviction.
  // ...and the mirror holds on the way down: a slump spends belief faster
  // with every consecutive defeat, exactly as a run compounds it. Without the
  // mirror, twelve underdog wins papered over sixteen losses and the season
  // finished level - a losing year has to end with less belief than it began.
  const trustMag = us > them
    ? 1.5 + Math.max(0, diff) * 1.6 + Math.min(2, streak * 0.25)
    : -(1.5 + Math.max(0, -diff) * 1.2 + Math.min(2, slump * 0.25))
  state.mgrTrust = clamp(squadTrust(state) + trustMag * derbyF, 0, 100)
  // the derby ledger: every meeting with a rival is written down forever
  if (fx.derby) {
    const oppId = isHome ? fx.awayId : fx.homeId
    const book = (state.derbyBook ??= {})
    const rec = (book[oppId] ??= { w: 0, d: 0, l: 0 })
    if (us > them) rec.w += 1
    else if (us < them) rec.l += 1
    else rec.d += 1
  }
  // the manager's book: every opponent, every meeting, this tenure
  {
    const oppId = isHome ? fx.awayId : fx.homeId
    if (state.clubs[oppId]) {
      const book = (state.vsBook ??= {})
      const rec = (book[oppId] ??= { w: 0, d: 0, l: 0 })
      if (us > them) { rec.w += 1; rec.run = (rec.run ?? 0) > 0 ? (rec.run ?? 0) + 1 : 1 }
      else if (us < them) { rec.l += 1; rec.run = (rec.run ?? 0) < 0 ? (rec.run ?? 0) - 1 : -1 }
      else { rec.d += 1; rec.run = 0 }
    }
    // the gate record: the first home match sets the bar quietly, and
    // every crowd after that is chasing it
    // friendlies do not count: the bar is for competitive rugby, and pre-season
    // comes first in the calendar so a friendly would otherwise always set it
    // ...and NEITHER DOES A NEUTRAL FINAL (user, after a Twickenham final:
    // "the final was at Twickenham so it shouldn't have been a record").
    // A showpiece final names the user as nominal home with fx.venue set to
    // the neutral ground, so 80,941 through somebody else's turnstiles was
    // being announced as a record at a 15,000-seat home ground.
    if (isHome && fx.att && fx.compId !== 'fr' && !fx.venue) {
      const prev = state.gateRecord
      if (!prev) {
        state.gateRecord = { att: fx.att, oppId, season: state.season }
      } else if (fx.att > prev.att) {
        state.gateRecord = { att: fx.att, oppId, season: state.season }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
          subject: `🎟 RECORD GATE: ${fx.att.toLocaleString()} at ${club.stadium}`,
          body: `The biggest crowd of your era watched the ${state.clubs[oppId]?.short ?? oppId} match - ${fx.att.toLocaleString()}, beating the old mark of ${prev.att.toLocaleString()}. The commercial team is giddy; the ground staff want a word about the queues. Full houses follow winning teams.`,
          k: 'news.recordGate',
          v: { att: fx.att, stadium: club.stadium, opp: state.clubs[oppId]?.short ?? oppId, old: prev.att },
          fixtureId: fx.id,
        })
      }
    }
  }
  // the era's record book: marks to beat (records.ts, wave 5)
  if (fx.compId !== 'fr') {
    const foe = fx.homeId === state.userClubId ? fx.awayId : fx.homeId
    const mark = offerResult(state, foe, us, them)
    if (mark) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `📕 A record under you: ${us}-${them}`,
        body: `${tIn('en', mark.k, mark)} It goes in the book, where the next side to visit can read it.`,
        k: 'news.recordBook',
        v: { ...mark, us, them, mark_k: mark.k },
        fixtureId: fx.id,
      })
    }
    offerRun(state, unbeatenRun(state, state.userClubId))
  }
  // the spotlight follows an unbeaten run (16C)
  if (fx.compId !== 'fr') runSpotlight(state, fx, us, them)
  // manager career record - unless the assistant ran the touchline while the
  // manager took his country's Test: "matches in the dugout" means HIS dugout
  if (!delegated) {
    state.mgr.m += 1
    if (us > them) state.mgr.w += 1
    else if (us === them) state.mgr.d += 1
    else state.mgr.l += 1
    mgrMilestones(state, us > them)
  }

  // the terraces have longer memories and shorter fuses than the board
  const before = state.fanMood ?? 60
  const heat = fx.derby || grudgeBetween(state, fx.homeId, fx.awayId) ? 1.7 : 1
  let mood = before + (us > them ? 4 * heat : us < them ? -(5 * heat + (isHome ? 1.5 : 0)) : -1)
  mood += (55 - mood) * 0.03 // everything fades toward "fine"
  state.fanMood = clamp(mood, 5, 98)
  if (before < 80 && state.fanMood >= 80) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `🎶 The terraces are in full voice`,
      body: `The songs have new verses and away allocations are selling out. The supporters believe in this team - and ${state.clubs[state.userClubId].stadium} is becoming a genuinely hard place to visit.`,
      k: 'news.fansUp', v: { stadium: state.clubs[state.userClubId].stadium },
    })
  } else if (before > 30 && state.fanMood <= 30) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `😤 Boos at full-time`,
      body: `Sections of the support turned on the team this week. Banners are being painted and the phone-ins are merciless. Results are the only medicine - and until they come, home games will feel colder.`,
      k: 'news.fansDown', v: {},
    })
  }
}

// ------------------------------------------------------------------
// Weekly processing
// ------------------------------------------------------------------

export function userFixtureThisWeek(state: GameState): Fixture | undefined {
  return state.fixtures.find(f =>
    f.week === state.week && !f.played &&
    (f.homeId === state.userClubId || f.awayId === state.userClubId))
}

/** Idle-week friendly: a home run-out against another idle club. Sharpness
 *  and combinations for the squad - but the injury risk is real. */
export function arrangeFriendly(state: GameState, oppId: string): string {
  if (userFixtureThisWeek(state)) return t('reply.alreadyPlayingThisWeek')
  const opp = state.clubs[oppId]
  if (!opp) return t('reply.noSuchClub')
  const busy = state.fixtures.some(f => f.week === state.week && !f.played && (f.homeId === oppId || f.awayId === oppId))
  if (busy) return t('reply.oppHasFixture', { club: opp.short })
  state.fixtures.push({
    id: state.nextId++, compId: 'fr', round: 0, week: state.week,
    homeId: state.userClubId, awayId: oppId,
    played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
  })
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `🤝 Friendly arranged: ${opp.short} this week`,
    body: `${opp.name} have agreed to a run-out at your place. Minutes for the fringe men, sharpness for the returners - just don't get anyone hurt.`,
    k: 'news.friendly', v: { short: opp.short, club: opp.name },
  })
  return t('reply.friendlyArranged', { club: opp.name })
}

/** The national side's fixture this week, when the user also coaches one.
 *  A home-nations coach also takes the Lions in a tour year. */
export function natFixtureThisWeek(state: GameState): Fixture | undefined {
  if (!state.natTeam) return undefined
  const teams = [state.natTeam]
  if (['ENG', 'IRE', 'SCO', 'WAL'].includes(state.natTeam)) teams.push('LIO')
  return state.fixtures.find(f =>
    f.week === state.week && !f.played &&
    (teams.includes(f.homeId) || teams.includes(f.awayId)))
}

/** THE MATCH THAT IS THE MANAGER'S THIS WEEK - one decision point, read by
 *  the day walk, both match entrances and the probes, so they can never
 *  disagree about whose touchline he stands on.
 *
 *  A Test outranks the club fixture (user, after Scotland's game auto-played
 *  behind his club Saturday: "it didnt show the fixture and just played it...
 *  its meant to be the pinnacle but is hidden away"). When both fall in one
 *  week the manager takes his country and the assistant takes the club - the
 *  settle sims the club game and reports it (see the assistant's Saturday in
 *  processWeekAndAdvance). */
export function userMatchThisWeek(state: GameState): Fixture | undefined {
  return natFixtureThisWeek(state) ?? (state.unemployed ? undefined : userFixtureThisWeek(state))
}

/** THE CLUB GAME THE ASSISTANT TAKES - the other half of the same decision.
 *
 *  Undefined every week without a Test, because every one of those the
 *  manager takes himself. On a week holding both it is the club fixture, and
 *  it is what the Home card and the match screen must SAY is the assistant's,
 *  rather than offering it as the afternoon's work (user: "it showed my club
 *  game, I ran it and it played another international game. its important
 *  that they are clearly separated but work together"). */
export function assistantFixtureThisWeek(state: GameState): Fixture | undefined {
  if (state.unemployed || !natFixtureThisWeek(state)) return undefined
  return userFixtureThisWeek(state)
}

/** how many stories the inbox keeps on the shelf - older ones fall off the bottom */
export const NEWS_KEEP = 250

/**
 * Process everything for the current week EXCEPT the user's fixture
 * (which the UI plays via the MatchDay screen first).
 * Then move to next week.
 */
export function processWeekAndAdvance(state: GameState) {
  const rng = weekRng(state)

  // The week's set-piece coaching (F2). What you call gets sharper, what you
  // shelved rusts - which is what stops a club from owning ten world-class moves.
  for (const club of Object.values(state.clubs)) {
    drillWeek(state, club, club.id === state.userClubId && state.matchPrep === 'setpiece')
  }

  // internationals squad management happens before matches
  manageInternationals(state, rng)

  // knockout creation for this week (before playing)
  for (const comp of Object.values(state.comps)) maybeCreateKnockouts(state, comp, rng)

  // Play all unplayed fixtures for this week. The user's is USUALLY already
  // played, by the MatchDay screen, but it is not always - and when this loop
  // plays it instead, it used to swallow the whole post-match reaction with it.
  //
  // The block below finds the user's fixture with `played && !tableApplied`,
  // which is true after MatchDay (which sets played and leaves the table alone)
  // and FALSE after this loop (which sets both). So on any week the user did not
  // watch his own match, boardReaction, matchReport, milestones, the league
  // round-up, the opponent scouting report and the manager's own win-loss record
  // were all skipped in silence.
  //
  // Measured before this fix, one Bath season played headless: 30 club matches,
  // and state.mgr.m read 4 - the four pre-season friendlies, which are counted on
  // a different path. Squad trust sat at its opening 26 for three whole seasons
  // across every seed, because the only code that moves it lives in boardReaction.
  // Board confidence still climbed, which is what hid this: it has other sources
  // (the half-term recompute from league position, award bonuses), so the number
  // moved and nobody looked closer.
  //
  // Every simtest, soak and audit runs headless, so the entire long-horizon test
  // suite has been measuring a world where the manager's club never had a board
  // reaction. Remembering the fixture here is the fix; the check below no longer
  // depends on who happened to play it.
  // ---- THE ASSISTANT NAMES WHAT THE COACH DID NOT ----
  //
  // The camp opens empty and Continue holds until a legal squad is named, so in
  // ordinary play this never fires. It exists for the ways round that hold: an
  // old save loaded mid-window, a nation too thin to reach the floor, a coach
  // appointed after the camp opened. A Test is never played with twelve men.
  fillShortNatSquad(state)
  const thisWeek = state.fixtures.filter(f => f.week === state.week && !f.played)
  let simmedUserFx: Fixture | null = null
  for (const fx of thisWeek) {
    const mine = fx.homeId === state.userClubId || fx.awayId === state.userClubId ||
      (state.natTeam != null && (fx.homeId === state.natTeam || fx.awayId === state.natTeam ||
        (['ENG', 'IRE', 'SCO', 'WAL'].includes(state.natTeam) && (fx.homeId === 'LIO' || fx.awayId === 'LIO'))))
    simMatch(state, fx, rng, false)
    const comp = state.comps[fx.compId]
    if (comp) {
      if (fx.stage) resolveKnockoutDraw(state, fx, rng)
      applyToTable(comp, fx)
      fx.tableApplied = true
    }
    if (mine) simmedUserFx = fx
  }

  // ---- WORD FROM CAMP ----
  // An international week used to be a scoreline in the round-up with your own
  // men invisible inside it (user: "when players are away with international
  // teams - we should get a match report on the score and how your players
  // played"). One report per Test that used your players, covering both sides
  // of it - so when two of your men face each other it is one story, not two
  // (user: "if two players from your club are playing against each other, you
  // should get one report"). Ratings are a deterministic gate on (seed,
  // fixture, player) - never the weekly stream, so the sim is untouched.
  if (!state.unemployed) {
    // A WEEK OF TESTS IS ONE WEEK, NOT SIX STORIES (owner, v1.1.12: "tighten up
    // the volume of text. is it essential, is it clear").
    //
    // scripts/newspeak.ts measured the worst inbox in six seasons at 25 items,
    // SIX of them this same story with different flags on it - one per Test
    // that happened to use one of your men, which on a full international
    // weekend is most of them. Six near-identical cards is not six pieces of
    // news, it is one piece of news filed six times, and it is the same fault
    // the academy heirs and the assistant's Saturday were both fixed for.
    //
    // So the reports are gathered first and the count decides the shape: one
    // or two Tests keep their own headline, because a single man's afternoon
    // deserves its own card; three or more become one word-from-camp round-up
    // with every Test in it.
    const reports: { fx: Fixture; lines: { id: number; rating: number; row: Record<string, string | number>; text: string }[] }[] = []
    for (const fx of thisWeek) {
      const icomp = state.comps[fx.compId]
      if (!icomp || icomp.type !== 'intl') continue
      // the nat coach lives his own Test from the dugout - this beat is the
      // club manager hearing from camp about everyone else's
      if (state.natTeam && (fx.homeId === state.natTeam || fx.awayId === state.natTeam)) continue
      const away = [fx.homeId, fx.awayId].flatMap(nat =>
        (state.natSquads[nat] ?? [])
          .map(id => state.players[id])
          .filter((p): p is Player => !!p && p.clubId === state.userClubId)
          .map(p => ({ p, nat })))
      if (!away.length) continue
      const lines = away.map(({ p, nat }) => {
        const rr = mulberry32((state.seed ^ Math.imul(fx.id, 31) ^ Math.imul(p.id, 2654435761)) >>> 0)
        const won = nat === fx.homeId ? fx.homeScore > fx.awayScore : fx.awayScore > fx.homeScore
        const rating = Math.min(9.4, 6 + rr() * 2.6 + (won ? 0.3 : 0))
        const wordKey = rating >= 8.4 ? 'news.capRan' : rating >= 7.6 ? 'news.capExcellent'
          : rating >= 6.9 ? 'news.capJob' : rating >= 6.3 ? 'news.capSteady' : 'news.capQuiet'
        const row = { k: 'news.capLine', player: p.name, nat_k: `nation.${nat}`, rating: rating.toFixed(1), word_k: wordKey }
        return { id: p.id, rating, row, text: tIn('en', row.k, row) }
      }).sort((a, b) => b.rating - a.rating)
      reports.push({ fx, lines })
    }

    if (reports.length <= 2) {
      for (const { fx, lines } of reports) {
        const hName = nationNameIn('en', fx.homeId)
        const aName = nationNameIn('en', fx.awayId)
        const shown = lines.slice(0, 4).map(l => l.text)
        const more = lines.length - shown.length
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `🌍 ${hName} ${fx.homeScore}-${fx.awayScore} ${aName}: how your men got on`,
          body: shown.join('\n') + (more > 0 ? `\nAnd ${more} more of yours came through it fine.` : ''),
          k: more > 0 ? 'news.capsMore' : 'news.caps',
          v: {
            home_k: `nation.${fx.homeId}`, away_k: `nation.${fx.awayId}`,
            hs: fx.homeScore, as: fx.awayScore,
            rows_ll: JSON.stringify(lines.slice(0, 4).map(l => l.row)), n: more,
          },
          // the reader's people-chips: the men this story is about, so their
          // names are tappable. Carried on the line rather than dug back out of
          // the rendered row, which is where the first draft of this lost them.
          playerIds: lines.slice(0, 6).map(l => l.id),
          fixtureId: fx.id,
        })
      }
    } else if (reports.length) {
      // one card, every Test on it, best man from each named
      const blocks = reports.map(({ fx, lines }) => ({
        k: 'news.campBlock',
        home_k: `nation.${fx.homeId}`, away_k: `nation.${fx.awayId}`,
        hs: fx.homeScore, as: fx.awayScore,
        best: lines[0].row.player as string,
        rating: lines[0].row.rating as string,
        word_k: lines[0].row.word_k as string,
        rest_k: lines.length > 1 ? 'news.campBlockRest' : 'common.nothing',
        n: lines.length - 1,
      }))
      const men = reports.reduce((n, r) => n + r.lines.length, 0)
      const v = { n: men, tests: reports.length, blocks_ll: JSON.stringify(blocks) }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
        subject: tIn('en', 'news.campRoundSubj', v),
        body: tIn('en', 'news.campRound', v),
        k: 'news.campRound', v,
      })
    }
  }

  // The A League runs the same weeks as the senior league, and AFTER it: a lad
  // called up to the seniors this week has had his senior game and had p.acad
  // cleared, so he cannot also turn out for the A side (feedback 10G).
  playAcademyWeek(state, rng)
  // DEADLINE DAY: the last week of each window is a circus - panic
  // listings appear at cut prices and nobody's star is safe
  if ((state.week === 7 || state.week === 27) && !state.unemployed) {
    const bargains: string[] = []
    const pool = Object.values(state.players).filter(p =>
      p.clubId && p.clubId !== state.userClubId && state.clubs[p.clubId] &&
      !p.transferListed && !p.onLoan && !p.loanFrom && !p.injury &&
      p.ca >= 70 && p.ca <= 84 && p.age >= 24)
    for (let k = 0; k < 3 && pool.length; k++) {
      const p = pool.splice(Math.floor(rng() * pool.length), 1)[0]
      p.transferListed = true
      bargains.push(`${p.name} (${p.pos}, ${state.clubs[p.clubId!]?.short}) - ${fmtMoney(askingPrice(state, p))}`)
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
      subject: `🚨 DEADLINE DAY - the window slams shut this week`,
      body: [
        `Phones are running hot across the league. Clubs are cutting prices to move bodies before the deadline${bargains.length ? ':' : '.'}`,
        ...bargains.map(b => `• ${b}`),
        `Move fast if you're buying - and don't be shocked if someone comes for one of yours before midnight.`,
      ].join('\n'),
      k: bargains.length ? 'news.deadlineList' : 'news.deadline',
      v: { list: bargains.map(b => `• ${b}`).join('\n') },
    })
  }

  // the morning after deadline day: the window is shut, here is the rundown
  if ((state.week === 8 || state.week === 28) && !state.unemployed) {
    const deals = state.news.filter(n => n.type === 'transfer' && n.season === state.season &&
      n.week === state.week - 1 && n.subject.includes(' joins ') && n.playerId != null)
    if (deals.length >= 2) {
      const TIMES = ['08:10', '09:45', '11:30', '13:05', '14:40', '16:15', '18:00', '19:35', '21:10', '22:55']
      const rows: { k: string; [x: string]: string | number }[] = []
      deals.slice(0, 5).forEach((n, i) => {
        const p = state.players[n.playerId!]
        const to = p?.clubId ? state.clubs[p.clubId] : null
        if (!p || !to) return
        // read back out of the STORED ENGLISH body, which is why that body is
        // never translated in place - see model.ts NewsItem
        const fee = n.body.match(/for a fee of (.+?)\. The /)?.[1] ?? null
        const mine = to.id === state.userClubId || n.body.includes(`from ${state.clubs[state.userClubId].name}`)
        rows.push({
          k: 'news.ddDeal', time: TIMES[i], player: p.name, pos: p.pos, to: to.short,
          fee: fee ?? '', fee_k: fee ? 'news.ddFeeKnown' : 'news.ddFeeUndisclosed',
          mine_k: mine ? 'news.ddYours' : 'common.nothing',
        })
      })
      const flop = Object.values(state.players)
        .filter(p => p.clubId && p.clubId !== state.userClubId && p.ca >= 76 && p.transferListed)
        .sort((a, b) => b.ca - a.ca)[0]
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
        subject: `📻 Deadline day, as it happened`,
        body: [
          `The window is shut. ${deals.length} deals crossed the line on the final day${deals.length > 5 ? ', the biggest of them' : ''}:`,
          ...rows.map(r => tIn('en', r.k, r)),
          ...(flop ? [`23:40 - COLLAPSED: ${flop.name}'s move fell apart at the medical. He stays at ${state.clubs[flop.clubId!]?.short} - for now.`] : []),
          `Back to rugby.`,
        ].join('\n'),
        k: flop ? 'news.ddRoundupFlop' : 'news.ddRoundup',
        v: {
          n: deals.length, rows_ll: JSON.stringify(rows),
          big_k: deals.length > 5 ? 'news.ddBiggest' : 'common.nothing',
          flop: flop?.name ?? '', flopClub: flop?.clubId ? state.clubs[flop.clubId]?.short ?? '' : '',
        },
      })
    }
  }

  // promises fall due: the squad keeps the receipts on what you said
  // in the office, and settles them - kept or broken - at the due week
  if (state.pledges?.length) {
    const remain: typeof state.pledges = []
    for (const pl of state.pledges) {
      const p = state.players[pl.playerId]
      // void quietly if the season rolled, either of you moved on, or you
      // were shown the door - a new regime owes the squad nothing. A player
      // who signed a pre-contract elsewhere made his own choice: no promise
      // survives his signature on someone else's paper
      if (pl.season !== state.season || !p || p.clubId !== state.userClubId || state.unemployed ||
        (state.preContracts ?? []).some(pc => pc.playerId === p.id)) continue
      if (state.week < pl.due) { remain.push(pl); continue }
      const gap = p.stats.apps - pl.baseApps
      const kept = pl.kind === 'plans' ? gap >= 2
        : pl.kind === 'minutes' ? gap >= 1
        : p.contractEnds > state.season
      const sulky = p.pers === 'Ambitious' || p.pers === 'Mercenary' || p.pers === 'Temperamental'
      if (kept) {
        p.morale = clamp(p.morale + 1.1, 1, 10)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
          // THE PLAYER SAYS IT HIMSELF (16B, user: "if a player moans about
          // playing time and then are rewarded playing time they should thank
          // the coach for keeping their word")
          subject: `🤝 Word kept: ${p.name}`,
          body: pl.kind === 'plans' ? `You told ${p.name} he was in your plans, and the team sheets backed it up. He knocks on your door after training: "You did not have to promise me anything, and you kept it anyway. Thank you, coach." The dressing room has not forgotten the conversation either. Trust like that is worth points.`
            : pl.kind === 'minutes' ? `${p.name} got the minutes you promised him. He finds you in the corridor after the session: "You said I would get my chance and you kept your word. I will not forget that, coach." The academy coach is purring too: "That is how you grow one." The kid would run through a wall for you now.`
            : `${p.name} has his new deal, just as you said he would. The senior pros noticed: this is a club where a handshake still means something.`,
          k: pl.kind === 'plans' ? 'news.keptPlans' : pl.kind === 'minutes' ? 'news.keptMinutes' : 'news.keptDeal',
          v: { player: p.name },
          playerId: p.id,
        })
      } else {
        p.morale = clamp(p.morale - (sulky ? 2.2 : 1.5), 1, 10)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
          subject: `💔 Promise broken: ${p.name}`,
          body: pl.kind === 'plans' ? `You told ${p.name} he was in your plans ${state.week - pl.week} weeks ago. He has barely seen the pitch since. The conversation has leaked to the squad, and his agent is already briefing that "the manager's word means nothing at this club."`
            : pl.kind === 'minutes' ? `${p.name} was promised minutes and got none. He trained with headphones in all week, and the academy coach has stopped defending you in the canteen.`
            : `${p.name} is still waiting for the deal you as good as promised him. He held off other offers on your word - now he feels strung along, and the older heads in the squad are watching how this ends.`,
          k: pl.kind === 'plans' ? 'news.brokePlans' : pl.kind === 'minutes' ? 'news.brokeMinutes' : 'news.brokeDeal',
          v: { player: p.name, n: state.week - pl.week },
          playerId: p.id,
        })
      }
    }
    state.pledges = remain
  }

  // the examiners report back on any coach sitting his next badge
  resolveCourses(state)

  // the chief scout comes home and files his report
  resolveCommission(state)
  // and word from the road while he is still out there
  scoutPostcard(state)

  // the builders finish: a board-funded facility upgrade opens its doors
  if (state.facilityBuild && state.season * 100 + state.week >= state.facilityBuild.done) {
    const b = state.facilityBuild
    const info = FACILITY_INFO[b.id]
    const uc = state.clubs[state.userClubId]
    if (uc) uc.facilities = { ...(uc.facilities ?? {}), [b.id]: b.level }
    state.facilityBuild = null
    logDecision(state, 'dec.facilityOpened', { lvl: b.level, fac_k: info.name, desc_k: info.desc }, true)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `🏗 The new ${tIn('en', info.name).toLowerCase()} opens`,
      body: `The builders are gone and the ribbon is cut: your ${tIn('en', info.name).toLowerCase()} is now level ${b.level}. ${tIn('en', info.desc)} The squad found it within minutes; the coaches found it first.`,
      k: 'news.facOpens',
      v: { name_k: info.name, desc_k: info.desc, lvl: b.level },
    })
  }

  // the physio's red flag: a position group stripped below cover gets an
  // assistant's alert with names, timelines and the loan-market options
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    // 'need' is the number of starting shirts the group fills: an alert
    // means the XV cannot be fielded from fit specialists at all
    // The label is a KEY. It is the headline of an injury-crisis story and it
    // sits in the middle of its first sentence, so an English label put "the
    // back row" into a French inbox twice over.
    const GROUPS: { key: string; label: string; pos: Pos[]; need: number }[] = [
      { key: 'prop', label: 'news.unitProps', pos: ['LP', 'TP'], need: 2 },
      { key: 'hook', label: 'news.unitHooker', pos: ['HK'], need: 1 },
      { key: 'lock', label: 'news.unitSecondRow', pos: ['LK'], need: 2 },
      { key: 'back5', label: 'news.unitBackRow', pos: ['FL', 'N8'], need: 3 },
      { key: 'nine', label: 'news.unitScrumHalf', pos: ['SH'], need: 1 },
      { key: 'ten', label: 'news.unitFlyHalf', pos: ['FH'], need: 1 },
      { key: 'centre', label: 'news.unitCentres', pos: ['CE'], need: 2 },
      { key: 'back3', label: 'news.unitBackThree', pos: ['WG', 'FB'], need: 3 },
    ]
    const squad = club.players.map(id => state.players[id]).filter(Boolean)
    state.crisisAt ??= {}
    for (const grp of GROUPS) {
      const all = squad.filter(p => grp.pos.includes(p.pos) && !p.acad)
      const fit = all.filter(p => !p.injury && p.bans === 0)
      if (fit.length >= grp.need || all.length <= grp.need) continue
      if (state.week - (state.crisisAt[grp.key] ?? -99) < 6) continue
      state.crisisAt[grp.key] = state.week
      const downRows: Vars[] = all.filter(p => p.injury || p.bans > 0)
        .map(p => ({
          k: p.injury ? 'news.crisisInjured' : 'news.crisisBanned',
          name: p.name, wk: p.injury?.until ?? 0,
        }))
      const down = downRows.map(r => tIn('en', String(r.k), r))
      const cover = loanTargets(state).filter(p => grp.pos.includes(p.pos)).slice(0, 3)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
        subject: `🚑 Injury crisis: ${tIn('en', grp.label)}`,
        body: [
          `The physio's board makes grim reading at ${tIn('en', grp.label)}: ${fit.length} fit of ${all.length} on the books.${down.length ? ` Out: ${down.join(', ')}.` : ''}`,
          cover.length
            ? `The assistant has three calls he could make tonight - loan cover available: ${cover.map(p => `${p.name} (${p.pos}, ${p.age}, ${state.clubs[p.clubId!]?.short})`).join(', ')}. Transfers screen, Loans tab.`
            : `The loan market has nothing suitable this week. Youth, patience, or a positional reshuffle - your call.`,
        ].join('\n'),
        k: cover.length ? 'news.crisisCover' : 'news.crisis',
        v: {
          unit_k: grp.label, fit: fit.length, all: all.length,
          out_k: down.length ? 'news.crisisOut' : 'common.nothing',
          outList_l: downRows.length ? JSON.stringify(downRows) : '[]',
          cover: cover.map(p => `${p.name} (${p.pos}, ${p.age}, ${state.clubs[p.clubId!]?.short})`).join(', '),
        },
      })
    }
  }

  // the long goodbye: the game's oldest names call time in midwinter, so
  // the run-in doubles as a farewell tour. At 37 next summer is certain
  // anyway (the rollover retires everyone turning 38), so the announcement
  // never changes anyone's fate - it just says it out loud
  if (state.week === 12) {
    const bowing = Object.values(state.players)
      .filter(p => p.age >= 37 && !p.retiring && !p.farewell && p.clubId && state.clubs[p.clubId])
    for (const p of bowing) p.retiring = true
    // at 37 even the greats have declined - judge the career, not today's
    // number: still-capable, a big Test career, or a POTY on the shelf
    const stars = bowing.filter(p => (p.ca >= 72 || (p.caps ?? 0) >= 25 || (p.poty ?? 0) > 0) && p.clubId !== state.userClubId)
      .sort((a, b) => b.ca - a.ca).slice(0, 2)
    // two names, one story. Week 12 is already the heaviest midwinter inbox of
    // the year and this beat was posting a separate letter for each of them.
    if (stars.length) {
      // The CV of a man calling time, as a KEY and its values. It used to be
      // rendered to English here and joined into one string, so the French
      // story carried "31 appearances and 10 tries" in the middle of it - the
      // fragment was translatable and the join threw the translation away.
      const cvVars = (p: typeof stars[0]) => {
        const apps = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps
        const tries = p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries
        return {
          k: tries ? 'news.cvTries' : 'news.cv',
          name: p.name, age: p.age, club: state.clubs[p.clubId!]?.name ?? '', apps, tries,
          // A young man's CV can read "1 appearance", so the nouns come from
          // the shared count fragments rather than the sentence.
          apps_k: apps === 1 ? 'count.appearanceOne' : 'count.appearanceMany',
          tries_k: tries === 1 ? 'count.tryOne' : 'count.tryMany',
        }
      }
      const cv = (p: typeof stars[0]) => tIn('en', cvVars(p).k, cvVars(p))
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: stars.length === 1
          ? `🎤 Signing off: ${stars[0].name} calls time`
          : `🎤 Signing off: ${stars.map(p => p.name).join(' and ')} call time`,
        body: `${stars.length === 1 ? 'One of the game\'s great careers ends in the summer' : 'Two of the game\'s great careers end in the summer'}. ${stars.map(cv).join('. ')}. The next few months are the farewell tour, and every ground they visit will stand for them. One last shot at silverware first.`,
        k: stars.length === 1 ? 'news.bowOne' : 'news.bowTwo',
        v: {
          // "X and Y" was joined here with the English conjunction and passed
          // in as one variable, so a French headline read "Retallick and
          // Mostert raccrochent". Two names is the most there can ever be, so
          // the two of them travel separately and the template joins them.
          names: stars.map(p => p.name).join(stars.length === 1 ? '' : tIn('en', 'news.andJoin')),
          a: stars[0].name, b: stars[1]?.name ?? '',
          cvs: stars.map(cv).join('. '),
          cvs_l: JSON.stringify(stars.map(cvVars)),
        },
        playerId: stars[0].id,
      })
    }
    for (const p of bowing.filter(p => p.clubId === state.userClubId)) {
      // the scout answers the letter: three names who could wear the shirt next
      const succ = Object.values(state.players)
        .filter(c => c.clubId && c.clubId !== state.userClubId && state.clubs[c.clubId] &&
          c.pos === p.pos && c.age <= 29 && c.ca >= p.ca - 4 && !c.retiring && !c.onLoan && !c.loanFrom)
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 3)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `🎤 ${p.name} tells you first: this is the last one`,
        body: [
          `${p.name} (${p.age}) knocks on your door before the press find out: he is retiring at the end of the season. No drama, no demands - he just wanted you to hear it from him. Give him a send-off worth the years.`,
          succ.length
            ? `The chief scout has already been through the files for the ${p.pos} shirt: ${succ.map(c => `${c.name} (${c.age}, ${state.clubs[c.clubId!]?.short}, ${fmtMoney(c.value)})`).join(', ')}. The succession starts now, not in the summer.`
            : `The chief scout has been through the files and does not love the ${p.pos} market this year. The academy may have to answer this one.`,
        ].join('\n'),
        k: succ.length ? 'news.retiresSucc' : 'news.retires',
        v: {
          player: p.name, age: p.age, pos: p.pos,
          succ: succ.map(c => `${c.name} (${c.age}, ${state.clubs[c.clubId!]?.short}, ${fmtMoney(c.value)})`).join(', '),
        },
        playerId: p.id,
      })
    }
  }

  // loan watch: the postcard from the feeder club. The verdicts are honest -
  // tone tracks the same deterministic roll the summer return boost uses
  if ([10, 18, 26, 34, 42].includes(state.week) && !state.unemployed) {
    const out = Object.values(state.players)
      .filter(p => p.onLoan && p.clubId === state.userClubId)
    if (out.length) {
      const lrng = mulberry32(state.seed ^ (state.season * 977 + state.week * 31))
      const BACKS: Pos[] = ['SH', 'FH', 'CE', 'WG', 'FB']
      const lines = out.map(p => {
        const apps = 2 + Math.floor(lrng() * 3)
        const tries = BACKS.includes(p.pos) ? Math.floor(lrng() * 3) : lrng() < 0.25 ? 1 : 0
        const maxed = p.ca >= p.pa
        const boost = 2 + Math.floor(mulberry32(state.seed + p.id)() * 3)
        const verdictKey = maxed ? 'news.loanLevel'
          : boost >= 4 ? 'news.loanStar'
          : boost === 3 ? 'news.loanGrowing'
          : 'news.loanSteady'
        // **name** renders bold in the reader, and the club he is at is named
        // (round 25, user: "bold the names ... say what club they are playing
        // for") - loanClub is set at loan time; older loans fall back gracefully
        return {
          k: tries ? 'news.loanRowTries' : 'news.loanRow',
          name: p.name, pos: p.pos, age: p.age,
          at_k: p.loanClub && state.clubs[p.loanClub] ? 'news.loanAt' : 'common.nothing',
          at: p.loanClub && state.clubs[p.loanClub] ? state.clubs[p.loanClub].name : '',
          apps, n: tries, verdict_k: verdictKey,
        }
      })
      // four in full, the rest counted: club names made each line ~20
      // characters longer, and five would breach the 800-character ceiling
      const shown = lines.slice(0, 4)
      const rest = out.length - shown.length
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: out.length === 1
          ? `🧳 Loan watch: how ${out[0].name} is getting on`
          : `🧳 Loan watch: news from the feeder clubs`,
        body: [
          `The academy manager files his loan report:`,
          ...shown.map(r => tIn('en', String(r.k), r)),
          ...(rest > 0 ? [`And ${rest} more out getting their minutes.`] : []),
        ].join('\n'),
        k: out.length === 1
          ? (rest > 0 ? 'news.loanOneMore' : 'news.loanOne')
          : (rest > 0 ? 'news.loanManyMore' : 'news.loanMany'),
        v: { who: out[0].name, rows_ll: JSON.stringify(shown), rest },
        playerId: out.length === 1 ? out[0].id : undefined,
      })
    }
  }

  // Northern Championship lore: the Slam and the Spoon are bigger than the table
  {
    const sn = state.comps['sn']
    const lastWk = SIX_NATIONS_WEEKS[SIX_NATIONS_WEEKS.length - 1]
    const penultWk = SIX_NATIONS_WEEKS[SIX_NATIONS_WEEKS.length - 2]
    if (sn && state.week === penultWk) {
      const leader = sortTable(sn.table)[0]
      if (leader && leader.w === 4 && leader.d === 0 && leader.l === 0) {
        const name = nationNameIn('en', leader.teamId)
        const yours = state.natTeam === leader.teamId
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `⚡ ${name} are 80 minutes from a Grand Slam`,
          body: yours
            ? `Four from four, one to play. Your side stand one win from a Grand Slam - the week every coach dreams about and none sleeps through. Handle the occasion, not just the opposition.`
            : `${name} have won all four and go into the final round with a Grand Slam on the table. The whole championship stops to watch.`,
          k: yours ? 'news.slamEveYours' : 'news.slamEve',
          v: { ...nationVars(leader.teamId) },
        })
      }
    }
    if (sn && state.week === lastWk) {
      const fx = state.fixtures.filter(f => f.compId === 'sn')
      if (fx.length && fx.every(f => f.played)) {
        const rows = sortTable(sn.table)
        const top = rows[0]
        const bottom = rows[rows.length - 1]
        if (top && top.w === 5) {
          const name = nationNameIn('en', top.teamId)
          const yours = state.natTeam === top.teamId
          if (yours && state.natConfidence != null) state.natConfidence = clamp(state.natConfidence + 12, 0, 100)
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `👑 GRAND SLAM: ${name} win them all`,
            body: yours
              ? `Five from five. A GRAND SLAM for ${name}, and your name goes on it forever. Titles are won most years; Slams are remembered in decades. Enjoy every minute of the week that follows.`
              : `${name} complete the Grand Slam - five wins from five. The rest of the championship applauds through gritted teeth.`,
            k: yours ? 'news.slamYours' : 'news.slam',
            v: { ...nationVars(top.teamId) },
          })
        }
        if (bottom && bottom.w === 0 && bottom.d === 0) {
          const name = nationNameIn('en', bottom.teamId)
          const yours = state.natTeam === bottom.teamId
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `🥄 The Wooden Spoon goes to ${name}`,
            body: yours
              ? `Five defeats from five. The Wooden Spoon is ${name}'s - and yours. The union's review lands next week, and the press will not be gentle. Something has to change, starting with the result.`
              : `${name} finish the championship without a win and take the Wooden Spoon home. Their review will be brutal.`,
            k: yours ? 'news.spoonYours' : 'news.spoon',
            v: { ...nationVars(bottom.teamId) },
          })
        }
      }
    }
  }

  // southern lore: a Southern Championship clean sweep is the south's Slam -
  // six from six against the hardest room in the sport
  {
    const trc = state.comps['trc']
    const lastWk = TRC_WEEKS[TRC_WEEKS.length - 1]
    const penultWk = TRC_WEEKS[TRC_WEEKS.length - 2]
    if (trc && state.week === penultWk) {
      const leader = sortTable(trc.table)[0]
      if (leader && leader.w === 5 && leader.d === 0 && leader.l === 0) {
        const name = nationNameIn('en', leader.teamId)
        const yours = state.natTeam === leader.teamId
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `⚡ ${name} are 80 minutes from a Championship clean sweep`,
          body: yours
            ? `Five from five in the hardest championship on earth, one to play. Win it and your side join the shortest of lists. The south does not hand these out.`
            : `${name} have won all five and can complete a Southern Championship clean sweep in the final round. The southern hemisphere holds its breath.`,
          k: yours ? 'news.sweepEveYours' : 'news.sweepEve',
          v: { ...nationVars(leader.teamId) },
        })
      }
    }
    if (trc && state.week === lastWk) {
      const fx = state.fixtures.filter(f => f.compId === 'trc')
      if (fx.length && fx.every(f => f.played)) {
        const top = sortTable(trc.table)[0]
        if (top && top.w === 6) {
          const name = nationNameIn('en', top.teamId)
          const yours = state.natTeam === top.teamId
          if (yours && state.natConfidence != null) state.natConfidence = clamp(state.natConfidence + 10, 0, 100)
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `👑 CLEAN SWEEP: ${name} win every Southern Championship match`,
            body: yours
              ? `Six from six against the best the south can field. A clean sweep of the Southern Championship, and your name on it. In a hundred years they will still be reading this list out.`
              : `${name} complete a perfect Southern Championship - six wins from six. The other three nations go home to their reviews.`,
            k: yours ? 'news.sweepYours' : 'news.sweep',
            v: { ...nationVars(top.teamId) },
          })
        }
      }
    }
  }

  // the World Championship post-mortem: the seed said one thing - what did the
  // tournament say back?
  {
    const wcFinal = state.fixtures.find(f => f.compId === 'wc' && f.stage === 'F' && f.played && f.week === state.week)
    // world champions in the building: your club's players in the winning
    // squad get their moment regardless of whether you coach a nation
    if (wcFinal) {
      const champ = wcFinal.homeScore > wcFinal.awayScore ? wcFinal.homeId : wcFinal.awayId
      const winners = (state.natSquads[champ] ?? [])
        .map(id => state.players[id])
        .filter((p): p is Player => !!p && p.clubId === state.userClubId)
      if (winners.length) {
        for (const p of winners) {
          p.morale = clamp(p.morale + 1, 1, 10)
          p.wcWins = (p.wcWins ?? 0) + 1
        }
        const champName = nationNameIn('en', champ)
        const names = winners.map(p => p.name).join(', ')
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `🏆 World champion${winners.length > 1 ? 's' : ''} in the building`,
          body: [
            (state.season * 5 + state.week * 3) % 2 === 0
              ? `${champName} are champions of the world, and ${names} ${winners.length === 1 ? 'was' : 'were'} in the squad that did it. The shirt goes in a frame; the aura comes back to training with ${winners.length === 1 ? 'him' : 'them'}.`
              : `When the confetti settled on the World Championship final, ${names} of ${champName} ${winners.length === 1 ? 'was' : 'were'} under it - your player${winners.length > 1 ? 's' : ''}, world champion${winners.length > 1 ? 's' : ''}.`,
            `Whatever happens for the rest of ${winners.length === 1 ? 'his' : 'their'} career${winners.length > 1 ? 's' : ''}, nobody can take this away.`,
          ].join(' '),
          k: (state.season * 5 + state.week * 3) % 2 === 0 ? 'news.wcHomeA' : 'news.wcHomeB',
          v: { n: winners.length, ...nationVars(champ), names },
          playerId: winners[0].id,
        })
      }
    }
    const nat = state.natTeam
    if (wcFinal && nat) {
      const seeds = state.comps['wc']?.seeds ?? []
      const seed = seeds.indexOf(nat) + 1
      const won = (wcFinal.homeId === nat && wcFinal.homeScore > wcFinal.awayScore) ||
        (wcFinal.awayId === nat && wcFinal.awayScore > wcFinal.homeScore)
      const inFinal = wcFinal.homeId === nat || wcFinal.awayId === nat
      const wcFx = state.fixtures.filter(f => f.compId === 'wc' && f.played && (f.homeId === nat || f.awayId === nat))
      const deepest = wcFx.some(f => f.stage === 'F') ? (won ? 1 : 2)
        : wcFx.some(f => f.stage === 'SF') ? 4
        : wcFx.some(f => f.stage === 'QF') ? 8
        : 16
      const name = nationNameIn('en', nat)
      const finishWord = deepest === 1 ? 'WORLD CHAMPIONS' : deepest === 2 ? 'beaten finalists'
        : deepest === 4 ? 'semi-finalists' : deepest === 8 ? 'quarter-finalists' : 'out in the pools'
      const parWord = seed > 0 && deepest < seed ? 'You over-delivered on the seeding, and the country knows it.'
        : seed > 0 && deepest === seed ? 'Par on the seeding. The review will be fair, if unsentimental.'
        : seed > 0 ? 'Short of the seeding - expect the post-mortem to use your name.'
        : ''
      if (wcFx.length) {
        if (state.natConfidence != null) {
          const swing = deepest === 1 ? 20 : deepest === 2 ? 8 : seed > 0 && deepest < seed ? 6 : seed > 0 && deepest > seed ? -8 : 0
          state.natConfidence = clamp(state.natConfidence + swing, 0, 100)
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: deepest === 1 ? `🏆 ${name}: CHAMPIONS OF THE WORLD` : `🌍 World Championship post-mortem: ${name}`,
          k: deepest === 1 ? 'news.wcWon' : seed > 0 ? 'news.wcOutSeeded' : 'news.wcOut',
          v: {
            ...nationVars(nat), seed,
            finish_k: deepest === 1 ? 'news.wcFinChamps' : deepest === 2 ? 'news.wcFinBeaten'
              : deepest === 4 ? 'news.wcFinSemi' : deepest === 8 ? 'news.wcFinQuarter' : 'news.wcFinPools',
            par_k: seed > 0 && deepest < seed ? 'news.wcParOver'
              : seed > 0 && deepest === seed ? 'news.wcParEven'
              : seed > 0 ? 'news.wcParUnder' : 'common.nothing',
          },
          body: [
            `${name} finish the World Championship as ${finishWord}${seed > 0 ? `, having gone in seeded ${seed} of 20` : ''}.`,
            deepest === 1 ? `Whatever else happens in your career, they can never take this away.` : parWord,
          ].filter(Boolean).join(' '),
        })
      }
    }
  }

  // giant-killings: a cup upset is the sport's oldest story, and it makes
  // the back page - one a week, the biggest gap wins the ink
  {
    const played = state.fixtures.filter(f => f.played && f.week === state.week && f.stage &&
      state.clubs[f.homeId] && state.clubs[f.awayId] && f.homeScore !== f.awayScore)
    let best: { fx: Fixture; gap: number; winId: string; loseId: string } | null = null
    for (const f of played) {
      const winId = f.homeScore > f.awayScore ? f.homeId : f.awayId
      const loseId = winId === f.homeId ? f.awayId : f.homeId
      const gap = (state.clubs[loseId]?.rep ?? 0) - (state.clubs[winId]?.rep ?? 0)
      if (gap >= 15 && (!best || gap > best.gap)) best = { fx: f, gap, winId, loseId }
    }
    if (best) {
      const win = state.clubs[best.winId], lose = state.clubs[best.loseId]
      const youWon = best.winId === state.userClubId
      const youLost = best.loseId === state.userClubId
      const score = `${teamShort(state, best.fx.homeId)} ${best.fx.homeScore}-${best.fx.awayScore} ${teamShort(state, best.fx.awayId)}`
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: youLost ? `💀 GIANT-KILLED: ${win?.short} dump you out`
          : youWon ? `⚔️ GIANT-KILLING: you dump out ${lose?.short}`
          : `⚔️ GIANT-KILLING: ${win?.short} shock ${lose?.short}`,
        body: youLost
          ? `${score}. The ${state.comps[best.fx.compId]?.name ?? 'cup'} run ends at the hands of a side nobody rated - and that is exactly how the papers will write it. Cup rugby forgives nothing.`
          : youWon
            ? `${score}. Your side knocked out a club a class above on paper, and paper lost. The players cut souvenirs from the net of the changing room whiteboard; the town will talk about this one for years.`
            : `${score} in the ${state.comps[best.fx.compId]?.name ?? 'cup'}. ${win?.name} beat a side a class above them on paper, and the whole sport smiles - except in ${lose?.city ?? 'one town'}.`,
        k: youLost ? 'news.giantLost' : youWon ? 'news.giantWon' : 'news.giantOther',
        v: {
          score, comp: state.comps[best.fx.compId]?.name ?? tIn('en', 'news.theCup'),
          win: win?.short ?? '', winName: win?.name ?? '', lose: lose?.short ?? '',
          loseCity: lose?.city ?? tIn('en', 'news.oneTown'),
        },
        fixtureId: best.fx.id,
      })
    }
  }

  // final week: the moment the semi-final whistle goes, the buildup starts.
  // Knockout finals are only drawn the week they are played, so the beat
  // fires off the semi-final win - which is the sweeter moment anyway
  {
    const mines = [
      ...(!state.unemployed ? [state.userClubId] : []),
      ...(state.natTeam ? [state.natTeam] : []),
    ]
    for (const mine of mines) {
      const sf = state.fixtures.find(f => f.played && f.week === state.week && f.stage === 'SF' &&
        (f.homeId === mine || f.awayId === mine))
      if (!sf) continue
      const us = sf.homeId === mine ? sf.homeScore : sf.awayScore
      const them = sf.homeId === mine ? sf.awayScore : sf.homeScore
      if (us <= them) continue
      const compName = state.comps[sf.compId]?.name ?? 'the cup'
      const otherSf = state.fixtures.find(f => f.compId === sf.compId && f.stage === 'SF' && f.id !== sf.id)
      const oppId = otherSf?.played
        ? (otherSf.homeScore > otherSf.awayScore ? otherSf.homeId : otherSf.awayId)
        : null
      const oppName = oppId ? (state.clubs[oppId]?.name ?? nationNameIn('en', oppId)) : null
      const v = state.clubs[mine] ? finalVenue(state, sf.compId) : null
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `🏆 YOU ARE IN THE FINAL: ${compName}`,
        body: [
          `The semi-final is won and there is one game left in the ${compName}${oppName ? ` - ${oppName}, winner takes the trophy` : ''}. The town plans its week around it, training closes to the public, and everyone you have ever met asks about tickets.`,
          v ? `And it is at ${v.name}. ${v.capacity.toLocaleString()} people in ${v.city}, half of them yours. Days like this are why anybody does this job.` : '',
          `Nobody remembers a beaten finalist. Pick the team that wins it.`,
        ].filter(Boolean).join('\n'),
        k: v ? 'news.finalVenue' : 'news.final',
        v: {
          comp: compName,
          opp_k: oppName ? 'news.finalOpp' : 'common.nothing', opp: oppName ?? '',
          venue: v?.name ?? '', city: v?.city ?? '', seats: v?.capacity ?? 0,
        },
        fixtureId: sf.id,
      })
    }
  }

  // derby week: the buildup starts the moment the previous weekend ends
  if (!state.unemployed) {
    const next = state.fixtures.find(f => !f.played && f.week === state.week + 1 &&
      (f.homeId === state.userClubId || f.awayId === state.userClubId) &&
      isDerby(f.homeId, f.awayId))
    if (next) {
      const oppId = next.homeId === state.userClubId ? next.awayId : next.homeId
      const opp = state.clubs[oppId]
      const home = next.homeId === state.userClubId
      const rec = state.derbyBook?.[oppId]
      const played = rec ? rec.w + rec.d + rec.l : 0
      const pl = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
      const recLine = rec && played > 0
        ? `Your record against them since you took charge: ${pl(rec.w, 'win')}, ${pl(rec.d, 'draw')}, ${pl(rec.l, 'defeat')}.`
        : `Your first meeting with them in this job. First impressions last a lifetime in fixtures like this.`
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `🔥 DERBY WEEK: ${derbyName(next.homeId, next.awayId)}`,
        body: [
          `${opp?.name ?? 'The old enemy'} ${home ? 'come to' : 'await at'} ${home ? state.clubs[state.userClubId].stadium : opp?.stadium ?? 'their place'} on Saturday, and the town already knows it. Tickets went an hour after release. Training gates will be busier than usual this week.`,
          recLine,
          `Nobody remembers the league position of a derby winner. Everybody remembers the score.`,
        ].join('\n'),
        k: home ? 'news.derbyHome' : 'news.derbyAway',
        v: {
          name: derbyName(next.homeId, next.awayId) ?? '',
          opp: opp?.name ?? tIn('en', 'news.oldEnemy'),
          ground: home ? state.clubs[state.userClubId].stadium : opp?.stadium ?? tIn('en', 'news.theirPlace'),
          rec_k: rec && played > 0 ? 'news.derbyRec' : 'news.derbyFirst',
          w: rec?.w ?? 0, d: rec?.d ?? 0, l: rec?.l ?? 0,
        },
        fixtureId: next.id,
      })
    }
  }

  // the academy coach has watched next summer's class all season - his
  // preview is honest because the class it describes is already fixed
  if (state.week === 30 && !state.unemployed && !state.intakeClass?.length) {
    const cls = rollIntakeClass(state, rng)
    if (cls.length) {
      state.intakeClass = cls
      const best = Math.max(...cls.map(c => c.pa))
      const grade = best >= 96 ? 'A' : best >= 90 ? 'B' : best >= 82 ? 'C' : best >= 74 ? 'D' : 'E'
      const star = cls.reduce((a, b) => (b.pa > a.pa ? b : a))
      const GROUP: Record<string, string> = {
        LP: 'news.unitFront', HK: 'news.unitFront', TP: 'news.unitFront', LK: 'news.unitSecond',
        FL: 'news.unitBack', N8: 'news.unitBack', SH: 'news.unitHalf', FH: 'news.unitHalf',
        CE: 'news.unitMid', WG: 'news.unitThree', FB: 'news.unitThree',
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: `🎓 Academy preview: next summer's class`,
        body: tIn('en', 'news.intakePreview', {
          n: cls.length,
          verdict_k: `news.intakeGrade${grade}`,
          unit_k: GROUP[star.pos] ?? 'news.unitPack',
        }),
        k: 'news.intakePreview',
        v: { n: cls.length, verdict_k: `news.intakeGrade${grade}`, unit_k: GROUP[star.pos] ?? 'news.unitPack' },
      })
    }
  }

  // the Scouting Agency refreshes its world rankings every four weeks
  if (state.week % 4 === 2) updateAgency(state)

  // half-term: the board grades the season so far, in writing
  if (state.week === 24 && !state.unemployed) {
    const club = state.clubs[state.userClubId]
    const comp = state.comps[club.leagueId]
    const posNow = leaguePos(comp?.table, club.id)
    // The board writes a report card at half term, so it should also adjust how
    // it feels to match the table it is looking at. Without this the boardroom
    // only ever reacted to individual results, whose wins and losses roughly
    // cancel - so a side that slid from 1st to 8th kept the confidence it earned
    // last May.
    //
    // STATURE-RELATIVE, since wave 2 (boardPatience): the OLD target read raw
    // table position, so a title-favourite sitting 5th of 10 and a bottom-half
    // club sitting 5th of 10 got the SAME 62% target - "second is a crisis at
    // a giant" cannot exist on a formula that cannot tell a giant from a
    // minnow. The target now measures distance from boardObjective(rep)'s own
    // expected finish - 70 is dead-on-target, and it moves 108 points across
    // the table's spread either side rather than the old 54, so a genuine
    // title favourite sliding to mid-table lands in real crisis territory
    // (clamped 20-96, never a mathematically impossible confidence). The
    // BLEND weight is patience-scaled too: a giant's board pulls toward the
    // half-term verdict harder, a minnow's barely moves off where it was.
    if (posNow > 0 && (comp?.table.length ?? 0) > 1) {
      const tableLen = comp!.table.length
      const objPos = Math.min(boardObjective(club.rep).pos, tableLen)
      const devFrac = (posNow - objPos) / Math.max(1, tableLen - 1)
      const target = clamp(70 - devFrac * 108, 20, 96)
      const blendW = clamp(0.25 * boardPatience(club.rep), 0.12, 0.5)
      club.boardConfidence = clamp(club.boardConfidence * (1 - blendW) + target * blendW, 0, 100)
    }
    const pred = state.preds?.[club.id]
    const diff = pred && posNow ? pred - posNow : 0
    const objs = (state.objectives ?? []).map(id => OBJECTIVE_DEFS.find(o => o.id === id)).filter(Boolean)
    const met = objs.filter(o => o!.met(state)).length
    const grade = diff >= 3 ? 'A' : diff >= 1 ? 'B' : diff === 0 ? 'C' : diff >= -2 ? 'D' : 'E'
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `🏛 Half-term report card: grade ${grade}`,
      body: [
        `The board's mid-season review has landed on your desk.`,
        posNow ? `League: ${posNow}${posNow === 1 ? 'st' : posNow === 2 ? 'nd' : posNow === 3 ? 'rd' : 'th'}${pred ? ` (pundits predicted ${pred}${pred === 1 ? 'st' : pred === 2 ? 'nd' : pred === 3 ? 'rd' : 'th'})` : ''}.` : '',
        objs.length ? `Season objectives: ${met}/${objs.length} on track.` : '',
        `Boardroom confidence: ${Math.round(club.boardConfidence)}%.`,
        grade === 'A' ? 'Verdict: "Exceptional. Whatever you are doing, keep doing it."'
          : grade === 'B' ? 'Verdict: "Ahead of expectations. The room is pleased."'
          : grade === 'C' ? 'Verdict: "On par. The second half of the season will define you."'
          : grade === 'D' ? 'Verdict: "Below where we should be. Improvement is expected, not hoped for."'
          : 'Verdict: "Unacceptable. The board will be watching the next two months very closely."',
      ].filter(Boolean).join('\n'),
      k: 'news.halfTerm',
      v: {
        grade,
        pos_k: posNow ? (pred ? 'news.htPosPred' : 'news.htPos') : 'common.nothing',
        pos_o: posNow, pred_o: pred ?? 0,
        objs_k: objs.length ? 'news.htObjs' : 'common.nothing', met, total: objs.length,
        conf: Math.round(club.boardConfidence),
        verdict_k: `news.htGrade${grade}`,
      },
    })
  }

  // monthly awards in the user's league: every four weeks the league names
  // its player and manager of the month - small prizes, big feelings
  if (state.week % AWARD_EVERY === 0 && !state.unemployed) {
    const leagueId = state.clubs[state.userClubId].leagueId
    const comp = state.comps[leagueId]
    if (comp?.type === 'league') {
      const from = state.week - (AWARD_EVERY - 1)
      // Manager of the Month, earned rather than handed out (see awards.ts for
      // the measurements that forced this rewrite: 100% of awards were decided
      // on two league games or fewer, and 12 of 66 went to a manager with zero
      // points because an international window still crowned somebody).
      //
      // Every competitive match counts now, there is a hard gate of two matches
      // and two wins, and merit decides rather than table position. It can come
      // back null, and a month where nobody deserved it passes without an award.
      const best = managerOfMonth(state, leagueId, from, state.week)
      // Player of the Month: hottest form among men who featured this window.
      //
      // `!p.acad` is not belt and braces, it is the fix for a measured bug. The A
      // League bumps stats.apps and adds 0.35 of form for every win (academy.ts),
      // and it never writes lastWk. So an academy lad who kept winning A League
      // games sat on a form figure of 8.9 with thirteen "appearances", and the old
      // duplicate of this award - which filtered on apps and form alone - handed
      // him the senior league's Player of the Month at weeks 16, 20, 24, 28, 32
      // and 36 of the same season. Measured over three careers: 22 of 42 awards
      // went to a man who had not played a senior minute in the window.
      const cands = comp.table.flatMap(r => (state.clubs[r.teamId]?.players ?? [])
        .map(id => state.players[id])
        .filter(p => p && !p.acad && (p.lastWk ?? -9) >= from))
      // JUDGED ON THE MONTH, NOT ON FORM.
      //
      // This used to sort on p.form, and form is a rolling average: each match
      // moves it by only 35% (form * 0.65 + rating * 0.35), so it carries weight
      // from long before the window. A man who was superb in September and merely
      // decent in October could still outrank the man who was actually best in
      // October, and the award said "Player of the Month" while measuring the
      // season. mSum/mApps are the window and nothing but the window, cleared
      // every time an award is given (matchEngine writes them beside ratingSum).
      //
      // Two appearances is the sample gate. Three would match the manager's, but
      // this is one man rather than a whole club: a six-week window holds three or
      // four matches, and a squad rotates, so demanding three would quietly
      // restrict the award to the never-rested. Two games at 8.5 is a month.
      const MIN_POM_APPS = 2
      const monthAvg = (p: Player) => (p.stats.mApps ?? 0) > 0 ? (p.stats.mSum ?? 0) / p.stats.mApps : 0
      const pom = cands
        .filter(p => (p!.stats.mApps ?? 0) >= MIN_POM_APPS)
        // best average in the window; a tie goes to the man who played more of it
        .sort((a, b) => monthAvg(b!) - monthAvg(a!) || (b!.stats.mApps ?? 0) - (a!.stats.mApps ?? 0))[0]
      // THE TWO AWARDS ARE SEPARATE AWARDS. This used to read `if (pom && best)`,
      // so a month where no manager cleared the three-match, two-win gate took the
      // player's award away with it, and he earned his on the pitch.
      //
      // Honesty about this one: it is a coupling removed, not a bug caught.
      // Measured over 5 careers and 15 seasons, 105 award windows: 90 had both a
      // worthy manager and a worthy player, 15 had neither, and NOT ONE had only
      // one of them. The calendar is why - a six-week block either holds three or
      // four league rounds or it holds none - so the old condition never actually
      // cost anybody an award. It would the moment the gate or the calendar moved,
      // and the two prizes have no business depending on each other regardless.
      if (pom || best) {
        const bestClub = best?.clubId
        if (pom) pom.morale = clamp(pom.morale + 0.6, 1, 10)
        const userWon = !!bestClub && bestClub === state.userClubId
        if (userWon) {
          state.mgr.moms = (state.mgr.moms ?? 0) + 1
          const club = state.clubs[state.userClubId]
          club.boardConfidence = clamp(club.boardConfidence + 4, 0, 100)
          state.fanMood = clamp((state.fanMood ?? 60) + 4, 5, 98)
        }
        const ourMan = pom?.clubId === state.userClubId
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
          subject: userWon
            ? `🥇 Manager of the Month: YOU`
            : ourMan
              ? `🥇 ${comp.short} awards: ${pom!.name} is Player of the Month`
              : `🥇 ${comp.short} monthly awards`,
          body: [
            best && bestClub
              ? `Manager of the Month: ${userWon ? `${state.managerName} (${state.clubs[state.userClubId].short})` : `${state.clubs[bestClub]?.coach ?? 'The coach'} (${state.clubs[bestClub]?.short})`}. ${runLine(state, best)}`
              : 'Manager of the Month: not awarded. Nobody put together a month worth the trophy.',
            pom
              // the number he actually won it on, not his season form
              ? `Player of the Month: ${pom.name} (${state.clubs[pom.clubId!]?.short ?? '-'}), ${monthAvg(pom).toFixed(1)} across ${pom.stats.mApps} ${pom.stats.mApps === 1 ? 'game' : 'games'} this month.`
              : 'Player of the Month: not awarded.',
            userWon ? 'The board notice these things - and so does the crowd.' : ourMan ? 'A proud week for the club and a lift for the man himself.' : '',
          ].filter(Boolean).join('\n'),
          k: userWon ? 'news.momYou' : ourMan ? 'news.momOurs' : 'news.momOther',
          v: {
            comp: comp.short, player: pom?.name ?? '',
            mgr_k: best && bestClub ? 'news.momMgr' : 'news.momMgrNone',
            mgrName: best && bestClub
              ? (userWon ? state.managerName : state.clubs[bestClub]?.coach ?? tIn('en', 'news.theCoach'))
              : '',
            mgrClub: bestClub ? state.clubs[bestClub]?.short ?? '' : '',
            run_k: best ? 'news.runLine' : 'common.nothing',
            ...(best ? runVars(state, best) : {}),
            pom_k: pom ? 'news.momPlayer' : 'news.momPlayerNone',
            pomClub: pom ? state.clubs[pom.clubId!]?.short ?? '-' : '',
            avg: pom ? monthAvg(pom).toFixed(1) : '',
            n: pom?.stats.mApps ?? 0,
            tail_k: userWon ? 'news.momTailYou' : ourMan ? 'news.momTailOurs' : 'common.nothing',
          },
          playerId: pom?.id,
        })
      }
    }
  }

  // THE WINDOW CLOSES HERE, for everybody.
  //
  // Outside the award block on purpose: it has to happen at the boundary whether
  // or not an award was given, whether or not the manager has a job, and for every
  // league rather than only his. If the reset lived inside that block, a spell out
  // of work or a month nobody deserved would leave the counters running and the
  // next award would be judged on ten weeks of rugby called a month.
  if (state.week % AWARD_EVERY === 0) {
    for (const p of Object.values(state.players)) {
      if (p.stats.mApps || p.stats.mSum) { p.stats.mApps = 0; p.stats.mSum = 0 }
    }
  }

  // knockout heartbreak breeds a grudge: losing a semi or a final puts the
  // winner on your dartboard for the next couple of seasons
  for (const fx of state.fixtures.filter(f =>
    f.week === state.week && f.played && (f.stage === 'SF' || f.stage === 'F') &&
    state.clubs[f.homeId] && state.clubs[f.awayId])) {
    const winner = fx.homeScore > fx.awayScore ? fx.homeId : fx.awayId
    const loser = winner === fx.homeId ? fx.awayId : fx.homeId
    const comp = state.comps[fx.compId]
    addGrudge(state, loser, winner,
      fx.stage === 'F' ? 'news.grudgeBrokeHeartsFinal' : 'news.grudgeBrokeHeartsSemi',
      // A competition's short name is a proper noun and travels as a variable;
      // "the cup", when there is no competition to name, is a WORD, and a word
      // passed in as a variable is English hiding inside a French sentence. So
      // the slot picks between two keys instead.
      { comp_k: comp?.short ? 'news.grudgeCompNamed' : 'news.grudgeCup', comp: comp?.short ?? '' })
  }

  // The user's match, whoever played it.
  //
  // Watched through MatchDay it arrives here `played && !tableApplied`, so the
  // table is applied below. Simmed by the loop above it is already on the table,
  // and `simmedUserFx` is how we still know it happened - see the long note up
  // there for what silently went missing before.
  const userFx = state.fixtures.find(f =>
    f.week === state.week && f.played && !f.tableApplied &&
    (f.homeId === state.userClubId || f.awayId === state.userClubId ||
     (state.natTeam != null && (f.homeId === state.natTeam || f.awayId === state.natTeam ||
       (['ENG', 'IRE', 'SCO', 'WAL'].includes(state.natTeam) && (f.homeId === 'LIO' || f.awayId === 'LIO'))))))
    ?? simmedUserFx
  if (userFx) {
    const isClubMatch = userFx.homeId === state.userClubId || userFx.awayId === state.userClubId
    const comp = state.comps[userFx.compId]
    // only if the loop above has not already done it: applying a result to the
    // table twice would double every point the club won
    if (comp && !userFx.tableApplied) {
      if (userFx.stage) resolveKnockoutDraw(state, userFx, rng)
      applyToTable(comp, userFx)
      userFx.tableApplied = true
    }
    if (isClubMatch && userFx.compId === 'fr') {
      // a friendly: sharpness banked, no board consequences - but the
      // manager's record counts every match he took charge of (FY feedback)
      const us = userFx.homeId === state.userClubId ? userFx.homeScore : userFx.awayScore
      const them = userFx.homeId === state.userClubId ? userFx.awayScore : userFx.homeScore
      state.mgr.m += 1
      if (us > them) state.mgr.w += 1
      else if (us === them) state.mgr.d += 1
      else state.mgr.l += 1
      mgrMilestones(state, us > them)
      scoutOpponent(state, userFx.homeId === state.userClubId ? userFx.awayId : userFx.homeId)
    } else if (isClubMatch) {
      boardReaction(state, userFx)
      matchReport(state, userFx)
      afterClubMatch(state, userFx)
      milestones(state, rng)
      leagueRoundUp(state)
      // you learn a lot about the men you just faced
      scoutOpponent(state, userFx.homeId === state.userClubId ? userFx.awayId : userFx.homeId)
      // the analysts' tape: this week's dials go in the tendency window, and
      // the repetition streaks tick (pillar 2) - a habit is now a fact
      recordTendency(state)
    } else {
      // Test match: national duty counts on the manager's record
      const mySide = userFx.homeId === state.natTeam || userFx.homeId === 'LIO' ? userFx.homeId : userFx.awayId
      const us = userFx.homeId === mySide ? userFx.homeScore : userFx.awayScore
      const them = userFx.homeId === mySide ? userFx.awayScore : userFx.homeScore
      state.mgr.m += 1
      if (us > them) state.mgr.w += 1
      else if (us === them) state.mgr.d += 1
      else state.mgr.l += 1
      // the tenure's own ledger, shown on the country desk - the record books
      // keep a coach's Test record separately, so the game does too
      const rec = (state.natRecord ??= { m: 0, w: 0, d: 0, l: 0 })
      rec.m += 1
      if (us > them) rec.w += 1
      else if (us === them) rec.d += 1
      else rec.l += 1
      mgrMilestones(state, us > them)
      // the union keeps score: every Test moves their confidence in you,
      // weighted by where the two sides sit in the world
      if (mySide === state.natTeam && state.natConfidence != null) {
        const oppId = userFx.homeId === mySide ? userFx.awayId : userFx.homeId
        const better = (state.natRank?.[oppId] ?? 70) > (state.natRank?.[mySide] ?? 70)
        const delta = us > them ? (better ? 4 : 2.5) : us < them ? (better ? -3.5 : -5.5) : 0.5
        state.natConfidence = clamp(state.natConfidence + delta, 0, 100)
      }
      matchReport(state, userFx)
    }
  }

  // ---- THE ASSISTANT'S SATURDAY ----
  // (user: "when you take on a international job your assistant should step
  // in for the periods of time and let you coach the team"). When the
  // manager took his nation's Test this week, the loop above simmed the club
  // fixture. The club's afternoon still counts in full - the board reacts,
  // the report files, the milestones tick - it just was not his hands on the
  // wheel, and the news says whose they were.
  if (userFx && simmedUserFx && simmedUserFx !== userFx && !state.unemployed &&
      (simmedUserFx.homeId === state.userClubId || simmedUserFx.awayId === state.userClubId) &&
      simmedUserFx.compId !== 'fr') {
    const cfx = simmedUserFx
    boardReaction(state, cfx, true)
    matchReport(state, cfx)
    afterClubMatch(state, cfx)
    milestones(state, rng)
    leagueRoundUp(state)
    const us = cfx.homeId === state.userClubId ? cfx.homeScore : cfx.awayScore
    const them = cfx.homeId === state.userClubId ? cfx.awayScore : cfx.homeScore
    const opp = state.clubs[cfx.homeId === state.userClubId ? cfx.awayId : cfx.homeId]
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'result', read: false,
      subject: `🧢 The assistant took the ${opp?.short ?? 'league'} match: ${us > them ? 'won' : us < them ? 'lost' : 'drew'} ${us}-${them}`,
      body: `With you away on Test duty, your assistant picked the side and ran the touchline. ${us > them
        ? 'He hands the week back with a win and an insufferable grin.'
        : us < them
        ? 'He hands the week back with an apology and a full debrief already on your desk.'
        : 'He hands the week back all square.'} The board judges the result the way it judges any other - the routines are yours even when the voice is not.`,
      k: 'news.assistantRan',
      v: {
        opp: opp?.short ?? tIn('en', 'news.theLeague'), us, them,
        verb_k: us > them ? 'news.assWon' : us < them ? 'news.assLost' : 'news.assDrew',
        hand_k: us > them ? 'news.assHandWin' : us < them ? 'news.assHandLoss' : 'news.assHandDraw',
      },
      fixtureId: cfx.id,
    })
  }

  // board pressure: warnings, then the sack
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    if (club.boardConfidence <= 10 && club.boardConfidence > 3 && state.week % 3 === 0) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: 'FINAL WARNING from the board',
        body: 'The chairman has made it plain: results must turn around immediately, or the club will seek a new Director of Rugby.',
        k: 'news.finalWarning', v: {},
      })
    }
    if (club.boardConfidence <= 3 && state.week > 8) {
      // the mechanics live in sackManager (jobs.ts) - shared with the
      // pushed-once-too-often dismissal of the board-request escalation
      sackManager(state, 'news.sacked')
    }
  }

  // rounds completed this week may unlock the next knockout stage -
  // create those ties NOW so the user's match exists before its week starts
  for (const comp of Object.values(state.comps)) maybeCreateKnockouts(state, comp, rng)

  // FINALS WEEK (the buildup the biggest game deserves, part two). A final
  // seven days out gets the full circus: the back-page comparison of the two
  // clubs, and - when the final is yours - the adverts. Runs here, directly
  // after knockout creation, because a final drawn tonight is next week's
  // match and the buildup must start the moment the semi-final whistle goes.
  {
    const finals = state.fixtures.filter(f => !f.played && f.week === state.week + 1 &&
      f.stage === 'F' && state.clubs[f.homeId] && state.clubs[f.awayId])
    const userLeague = !state.unemployed ? state.clubs[state.userClubId]?.leagueId : null
    for (const fx of finals) {
      const comp = state.comps[fx.compId]
      if (!comp) continue
      const usIn = !state.unemployed && (fx.homeId === state.userClubId || fx.awayId === state.userClubId)
      // the back page covers the finals the user's world watches: his own,
      // his league's, and the two European showpieces
      if (!usIn && fx.compId !== 'cc' && fx.compId !== 'chc' && fx.compId !== userLeague) continue
      const a = state.clubs[fx.homeId], b = state.clubs[fx.awayId]
      const star = (clubId: string) => {
        const men = state.clubs[clubId].players.map(id => state.players[id]).filter(p => p && !p.acad)
        return men.length ? men.reduce((x, y) => (y.form > x.form ? y : x)) : null
      }
      const sa = star(fx.homeId), sb = star(fx.awayId)
      const where = fx.venue ? `${fx.venue.name}, ${fx.venue.city}` : `${a.stadium}, ${a.city}`
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `🗞️ THE BIG ONE: ${a.short} v ${b.short} for the ${comp.short}`,
        body: [
          `${comp.name} final, ${where}, Saturday.`,
          `${a.short} arrive on ${formGuide(state, a.id).join(' ') || 'no form to speak of'}${sa ? `, ${sa.name} the man to watch` : ''}. ${b.short} answer with ${formGuide(state, b.id).join(' ') || 'nothing played'}${sb ? ` and ${sb.name} in the form of his life` : ''}.`,
          usIn ? `Finals are won by the side that handles the day - and the day starts now.` : `Somebody in that stadium is going to remember Saturday forever.`,
        ].join('\n'),
        k: 'news.bigOne',
        v: {
          a: a.short, b: b.short, comp: comp.name, short: comp.short, where,
          aForm: formGuide(state, a.id).join(' ') || tIn('en', 'news.noForm'),
          bForm: formGuide(state, b.id).join(' ') || tIn('en', 'news.nothingPlayed'),
          aStar_k: sa ? 'news.bigOneStarA' : 'common.nothing', aStar: sa?.name ?? '',
          bStar_k: sb ? 'news.bigOneStarB' : 'common.nothing', bStar: sb?.name ?? '',
          tail_k: usIn ? 'news.bigOneYours' : 'news.bigOneTheirs',
        },
        fixtureId: fx.id,
      })
      // the adverts (finals week is the one week the sport buys the town):
      // user's final only, and the pick is salted by the calendar so it does
      // not lean on any rng stream
      if (usIn) {
        const v = fx.venue
        const ADS = ['news.adsA', 'news.adsB', 'news.adsC']
        const adKey = ADS[(state.season * 7 + state.week) % ADS.length]
        const adV = {
          city_k: v ? 'news.adsCity' : 'news.adsTown', city: v?.city ?? '',
          venue_k: v ? 'news.adsVenue' : 'common.nothing', venue: v?.name ?? '',
          coach_k: v ? 'news.adsCoach' : 'common.nothing',
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
          subject: `📺 Finals week: the adverts have landed`,
          body: tIn('en', adKey, adV),
          k: adKey, v: adV,
          fixtureId: fx.id,
        })
      }
    }
  }

  // finals crown champions
  for (const comp of Object.values(state.comps)) {
    if (comp.champion) continue
    const final = state.fixtures.find(f => f.compId === comp.id && f.stage === 'F' && f.played)
    if (final) {
      comp.champion = winnerOf(final)
      state.history.push({ season: state.season, compId: comp.id, champion: comp.champion })
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `${teamShort(state, comp.champion)} win the ${comp.name}!`,
        body: `${teamShort(state, comp.champion)} defeated ${teamShort(state, final.homeId === comp.champion ? final.awayId : final.homeId)} ${Math.max(final.homeScore, final.awayScore)}-${Math.min(final.homeScore, final.awayScore)} in the ${comp.name} final.`,
        k: 'news.cupWon',
        v: {
          champ: teamShort(state, comp.champion), comp: comp.name,
          loser: teamShort(state, final.homeId === comp.champion ? final.awayId : final.homeId),
          hi: Math.max(final.homeScore, final.awayScore), lo: Math.min(final.homeScore, final.awayScore),
        },
      })
      if (comp.champion === state.userClubId || (state.natTeam != null && comp.champion === state.natTeam)) {
        const mine = comp.champion === state.userClubId
        const hk = mine ? 'cel.champions' : 'cel.championsOf'
        const hv: Vars = mine
          ? { short: teamShort(state, state.userClubId).toUpperCase() }
          : { comp: comp.name.toUpperCase() }
        const sv = { comp: comp.name, season: seasonLabel(state.season), manager: state.managerName }
        state.celebration = {
          headline: tIn('en', hk, hv),
          sub: tIn('en', 'cel.championsSub', sv),
          icon: '🏆',
          hk, hv, sk: 'cel.championsSub', sv,
        }
        state.mgr.trophies.push({ compId: comp.id, season: state.season, clubId: state.userClubId })
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
          subject: `🏆 CHAMPIONS! The ${comp.name} is yours`,
          body: `Scenes of pure joy as ${state.clubs[state.userClubId].name} lift the ${comp.name}. The city will talk about this night for years - and the board have noted exactly who delivered it.`,
          k: 'news.youWonCup', v: { comp: comp.name, club: state.clubs[state.userClubId].name },
        })
        state.clubs[state.userClubId].boardConfidence = clamp(state.clubs[state.userClubId].boardConfidence + 20, 0, 100)
      }
    }
    // pure round-robin comps (6N, TRC, National 1): champion = table top when all played
    if (!comp.champion && (comp.type === 'intl' || (comp.type === 'league' && !comp.playoffTeams)) && comp.table.length) {
      const all = state.fixtures.filter(f => f.compId === comp.id)
      if (all.length && all.every(f => f.played)) {
        comp.champion = sortTable(comp.table)[0].teamId
        state.history.push({ season: state.season, compId: comp.id, champion: comp.champion })
        if (comp.type === 'league' && comp.champion === state.userClubId) {
          state.mgr.trophies.push({ compId: comp.id, season: state.season, clubId: state.userClubId })
          const hv2 = { short: teamShort(state, state.userClubId).toUpperCase() }
          const sv2 = { comp: comp.name, season: seasonLabel(state.season), manager: state.managerName }
          state.celebration = {
            headline: tIn('en', 'cel.champions', hv2),
            sub: tIn('en', 'cel.championsSub', sv2),
            icon: '🏆',
            hk: 'cel.champions', hv: hv2, sk: 'cel.championsSub', sv: sv2,
          }
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
            subject: `🏆 CHAMPIONS! The ${comp.name} title is yours`,
            body: `${state.clubs[state.userClubId].name} finish top of the pile. Promotion won, history made - the town will remember this season.`,
            k: 'news.youWonLeague', v: { comp: comp.name, club: state.clubs[state.userClubId].name },
          })
          state.clubs[state.userClubId].boardConfidence = clamp(state.clubs[state.userClubId].boardConfidence + 20, 0, 100)
        }
        const lionsWin = comp.id === 'lions' && comp.champion === 'LIO' &&
          state.natTeam != null && ['ENG', 'IRE', 'SCO', 'WAL'].includes(state.natTeam)
        if ((state.natTeam != null && comp.champion === state.natTeam) || lionsWin) {
          state.mgr.trophies.push({ compId: comp.id, season: state.season, clubId: state.userClubId })
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
            subject: `🏆 CHAMPIONS! You've won the ${comp.name} with ${comp.champion}`,
            body: `A nation celebrates. Your name goes into the record books as the coach who delivered the ${comp.name}.`,
            k: 'news.youWonIntl', v: { comp: comp.name, nat: comp.champion },
          })
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `${teamShort(state, comp.champion)} win the ${comp.name}`,
          body: `${teamShort(state, comp.champion)} have been crowned ${comp.name} champions.`,
          k: 'news.leagueWon', v: { champ: teamShort(state, comp.champion), comp: comp.name },
        })
      }
    }
  }

  // THE RELEGATION PLAYOFF (21A). In England the trapdoor is no longer
  // automatic: once week 43 has crowned both champions, the Premier Division's
  // bottom club hosts the Championship winner in week 44 - eighty minutes
  // for a place in the top flight, playable like any other fixture when it
  // is yours. The rollover reads this game's result instead of swapping the
  // two clubs blind; the other pyramids keep the automatic trapdoor.
  if (state.week === 43) {
    const prem = state.comps['prem']
    const champ = state.comps['champ']
    const already = state.fixtures.some(f => f.compId === 'prem' && f.stage === 'BAR')
    if (prem && champ && !already) {
      const bottom = sortTable(prem.table).map(r => r.teamId).pop()
      const up = champ.champion ?? sortTable(champ.table)[0]?.teamId
      if (bottom && up && bottom !== up && state.clubs[bottom] && state.clubs[up]) {
        const fx: Fixture = {
          id: state.nextId++, compId: 'prem', round: 99, week: 44,
          homeId: bottom, awayId: up, played: false,
          homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0, stage: 'BAR',
        }
        state.fixtures.push(fx)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
          subject: `⚔️ The relegation playoff: ${teamShort(state, bottom)} v ${teamShort(state, up)}`,
          body: `One game for a Premier Division place. ${state.clubs[bottom].name} finished bottom and get to defend their status at home; ${state.clubs[up].name} won the Championship and come to take it. Winner plays top-flight rugby next season.`,
          k: 'news.barrage',
          v: {
            a: teamShort(state, bottom), b: teamShort(state, up),
            aName: state.clubs[bottom].name, bName: state.clubs[up].name,
          },
          fixtureId: fx.id,
        })
      }
    }
  }

  // Career milestone salutes for your own men.
  //
  // These used to flood the inbox in the opening weeks (user screenshot: four
  // guards of honour all dated week 1, identical wording). The cause is that
  // `total` counts p.hist.apps, the estimated pre-2025 career, so a squad full
  // of players sitting just under a round number all crossed at once the first
  // time they played for you. Three changes:
  //   the ladder only holds the numbers a club actually marks, no 50s or 150s;
  //   a man must have played 5 games in THIS save before we salute him, so we
  //   only celebrate what we actually watched happen;
  //   one appearance salute a week, the biggest number winning, so a genuine
  //   coincidence still reads as a headline rather than a list.
  const MILESTONES = new Set([100, 200, 300, 400, 500])
  const appSalutes: { p: Player; total: number }[] = []
  for (const id of state.clubs[state.userClubId]?.players ?? []) {
    const p = state.players[id]
    if (!p || p.lastWk !== state.week || state.unemployed) continue
    const total = p.career.reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
    const cTries = p.career.reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
    const cPts = p.career.reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
    // tries/points can park exactly on a number for weeks - salute once only
    const trySubj = `🏉 ${p.name}: ${cTries} career tries`
    const ptsSubj = `🎯 ${p.name}: ${cPts.toLocaleString()} career points`
    if ((cTries === 50 || cTries === 100) && !state.news.some(n => n.subject === trySubj)) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: trySubj,
        body: `The weekend brought up try number ${cTries} of ${p.name}'s career. The video team has already cut the montage.`,
        k: 'news.careerTries', v: { player: p.name, n: cTries, n_o: cTries },
        playerId: p.id,
      })
    } else if ((cPts === 500 || cPts === 1000) && !state.news.some(n => n.subject === ptsSubj)) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: ptsSubj,
        body: `A milestone from the tee: ${p.name} passed ${cPts.toLocaleString()} career points at the weekend. Metronomes get remembered too.`,
        k: 'news.careerPoints', v: { player: p.name, n: cPts },
        playerId: p.id,
      })
    }
    // appearances made since this save began - the ones you were there for
    const inSave = p.stats.apps + p.career.reduce((sum, c) => sum + c.apps, 0)
    if (MILESTONES.has(total) && inSave >= 5) appSalutes.push({ p, total })
  }
  if (appSalutes.length) {
    const { p, total } = appSalutes.sort((a, b) => b.total - a.total)[0]
    const KEYS = ['news.guardA', 'news.guardB', 'news.guardC']
    // deterministic pick: the same week and the same man always read the same
    const pickIdx = (p.id * 7 + state.week * 13 + state.season * 3) % KEYS.length
    const v = {
      player: p.name, n: total, n_o: total,
      tail_k: total >= 300 ? 'news.guardTail300' : total >= 200 ? 'news.guardTail200' : 'news.guardTail100',
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `👏 ${p.name}: ${total} career appearances`,
      body: tIn('en', KEYS[pickIdx], v),
      k: KEYS[pickIdx], v,
      playerId: p.id,
    })
  }

  // decrement bans for players whose team played
  const playedTeams = new Set<string>()
  for (const fx of state.fixtures.filter(f => f.week === state.week && f.played)) {
    playedTeams.add(fx.homeId); playedTeams.add(fx.awayId)
  }
  for (const p of Object.values(state.players)) {
    if (p.bans > 0 && p.clubId && playedTeams.has(p.clubId)) p.bans--
  }

  // the recruitment meeting (audit 20B): at the top of each window the
  // scouting department puts names on the board. Week 2 so the opening-week
  // letters have cleared; week 21 ahead of the mid-season deadline at 27.
  if (state.week === 2 || state.week === 21) recruitmentMeeting(state)

  // ---- THE CONTRACT LADDER ----
  //
  // Owner, v1.1.17: "contract talk should be in the inbox 6 months from
  // players contracts finishing with a reminder 3 months, 1 month, 2 weeks..."
  //
  // There were two warnings, at weeks 20 and 31, both saying the same thing in
  // the same words - so the first one was easy to file away and the second read
  // as a repeat rather than as a clock running down. A season is SEASON_WEEKS
  // long and ends at the last of them, so the owner's calendar lands on:
  //
  //   week 19  six months out    (26 weeks)
  //   week 32  three months out  (13 weeks)
  //   week 41  a month out       (4 weeks)
  //   week 43  a fortnight out   (2 weeks)
  //
  // One story, four dates, and it says how long is left each time, which is
  // the whole point of a reminder.
  const CONTRACT_LADDER: [number, string][] = [
    [SEASON_WEEKS - 26, 'news.cxSix'],
    [SEASON_WEEKS - 13, 'news.cxThree'],
    [SEASON_WEEKS - 4, 'news.cxOne'],
    [SEASON_WEEKS - 2, 'news.cxTwo'],
  ]
  const rung = CONTRACT_LADDER.find(([wk]) => wk === state.week)
  if (rung) {
    const expiring = state.clubs[state.userClubId].players
      .map(id => state.players[id])
      .filter(p => p && p.contractEnds <= state.season)
    if (expiring.length) {
      // Name the three biggest and count the rest: a 25-man comma list was the
      // single longest message in the game (1,181 characters, brevity pass 19A),
      // and the full list already lives on Team > Contracts.
      const named = [...expiring].sort((a, b) => b.ca - a.ca).slice(0, 3)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
        subject: `${expiring.length} contract${expiring.length > 1 ? 's' : ''} expiring`,
        body: `${tIn('en', rung[1])} until these deals end: ${named.map(p => `${p.name} (${p.pos}, ${p.age})`).join(', ')}`
          + `${expiring.length > named.length ? ` and ${expiring.length - named.length} more - full list on Team ▸ Contracts` : ''}.`
          + ` Offer new terms from their profiles, or they are free to talk to anyone.`,
        k: expiring.length > named.length ? 'news.expiringMore' : 'news.expiring',
        v: {
          n: expiring.length, more: expiring.length - named.length,
          when_k: rung[1],
          men_l: JSON.stringify(named.map(x => ({ k: 'news.expiringMan', name: x.name, pos: x.pos, age: x.age }))),
        },
      })
    }
  }

  // a union comes calling: dual club-and-country roles for proven managers
  if (state.natOffer && state.week - state.natOffer.week > 3) state.natOffer = null
  // THE CALL IS ANSWERED (v1.1.4, the International Stage): a purchased
  // introduction to the federations. Deterministic and rng-free - it fires
  // the week natCall names and waits politely while the manager is
  // unemployed or already fielding an offer. Since v1.1.5 the buyer PICKS
  // the federation at the store (owner: "they should be able to select who
  // they want to manage"), carried here in natCallNat; a save whose call
  // was placed before the picker existed falls back to the old ladder rule,
  // the best tier the reputation honestly qualifies for. The offer placed
  // is a normal natOffer in every way - same letter key, same 3-week shelf
  // life, same Profile buttons.
  if (state.natCall != null && !state.natTeam && !state.natOffer && !state.unemployed
      && state.season * SEASON_WEEKS + state.week >= state.natCall) {
    const rep = mgrReputation(state)
    const picked = state.natCallNat && NAT_TIERS.some(([n]) => n === state.natCallNat)
      ? state.natCallNat : null
    const qualified = NAT_TIERS.filter(([, need]) => rep >= need)
    const nat = picked ?? (qualified.length ? qualified[qualified.length - 1] : NAT_TIERS[0])[0]
    state.natCall = null
    state.natCallNat = null
    state.natOffer = { nat, week: state.week }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `🌍 ${nat} want you as national head coach`,
      body: `The union has been watching your work and wants you to take the national side alongside your club job - Test windows, championship campaigns, maybe a World Championship. Accept or decline from your Manager Profile. The offer won't stay open long.`,
      k: 'news.natOffer', v: { nat },
    })
  }
  if (!state.natTeam && !state.natOffer && !state.unemployed && (state.week === 6 || state.week === 18)) {
    const rep = mgrReputation(state)
    if (rep >= 64) {
      // offers come from the best jobs you qualify for, not the whole ladder
      const eligible = NAT_TIERS.filter(([, need]) => rep >= need).map(([n]) => n).slice(-5)
      if (eligible.length && rng() < 0.55) {
        const nat = eligible[Math.floor(rng() * eligible.length)]
        state.natOffer = { nat, week: state.week }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
          subject: `🌍 ${nat} want you as national head coach`,
          body: `The union has been watching your work and wants you to take the national side alongside your club job - Test windows, championship campaigns, maybe a World Championship. Accept or decline from your Manager Profile. The offer won't stay open long.`,
          k: 'news.natOffer', v: { nat },
        })
      }
    }
  }

  weeklyTraining(state, rng)
  // the game-time ledger (F18): what the team sheets say against what each man
  // was told, settled a little every week rather than in one lump
  settleGameTime(state)
  gameTimeReview(state)
  // The other hundred clubs, whether or not the manager currently has a job:
  // the world's books do not stop because he is between posts.
  aiWeeklyFinance(state)
  aiFireSale(state)
  // and the manager gets a year's notice before the same thing happens to him
  insolvencyWarning(state)
  // one rival, one of your players, all season (living.ts)
  advanceHunt(state)
  // THE MAN IN THE OTHER DUGOUT (C3). One voice, once a month at most, and a
  // sacking when his season collapses. Gated on the calendar and the table, never
  // on the shared rng - a quote that moved the sim stream would change results by
  // being generated.
  if (!state.unemployed) {
    const beat = rivalBeat(state)
    if (beat) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
        subject: tIn('en', `${beat.k}Subj`, beat.v), body: tIn('en', beat.k, beat.v),
        k: beat.k, v: beat.v,
      })
    }
  }
  if (!state.unemployed) {
    weeklyFinance(state, rng)
    weeklyScouting(state)
    // the run-in: from week 28, gaps and rivals become the story
    if (state.week >= 31 && !state.unemployed) {
      const club = state.clubs[state.userClubId]
      const comp = state.comps[club.leagueId]
      if (comp && comp.type === 'league') {
        const order = sortTable(comp.table)
        const idx = order.findIndex(r => r.teamId === club.id)
        const roundsLeft = state.fixtures.filter(f =>
          f.compId === comp.id && !f.stage && !f.played &&
          (f.homeId === club.id || f.awayId === club.id)).length
        if (idx >= 0 && roundsLeft > 0) {
          const me = order[idx]
          const top = order[0]
          const gapTop = top.pts - me.pts
          const line = comp.playoffTeams || 0
          const lineRow = line > 0 && idx >= line ? order[line - 1] : null
          const bottom = order[order.length - 1]
          const gapDown = me.pts - bottom.pts
          const rivalResults = (ids: string[]) => state.fixtures
            .filter(f => f.compId === comp.id && f.week === state.week && f.played &&
              (ids.includes(f.homeId) || ids.includes(f.awayId)) &&
              f.homeId !== club.id && f.awayId !== club.id)
            .map(f => `${teamShort(state, f.homeId)} ${f.homeScore}–${f.awayScore} ${teamShort(state, f.awayId)}`)
          // WHAT TOPPING THE TABLE ACTUALLY WINS (user, on the last round of
          // a playoff league: "its saying its all mine but the playoffs are
          // still to be played"). In a league with playoffTeams the regular
          // season crowns a top seed, not a champion, and telling a manager
          // "win and it is yours" the week before three knockout rounds is a
          // promise the format cannot keep. Leagues without playoffs keep the
          // old words - there, the table IS the title.
          const seeded = line > 0
          let k = ''
          let v: Vars = {}
          // the rival scores that go under each of these, as rows so the label
          // in front of them ("Chasers:", "Down there:") translates too
          const rows = (label: string, ids: string[]) =>
            JSON.stringify(rivalResults(ids).map(r => ({ k: 'news.runinRival', label_k: label, r })))
          if (idx === 0 && gapTop === 0) {
            const chasers = order.slice(1, 3).map(r => r.teamId)
            // FINAL DAY SAYS WHAT IS ACTUALLY ON OFFER. In a league with
            // playoffs the last round crowns a top seed, not a champion, and
            // the first version of this conversion collapsed both headlines
            // into the title one - caught by occasionprobe, which exists for
            // exactly that promise.
            k = roundsLeft === 1
              ? (seeded ? 'news.runinTopFinalSeed' : 'news.runinTopFinal')
              : 'news.runinTopRace'
            v = {
              n: roundsLeft, seeded: seeded ? 1 : 0,
              lead_k: order[1] ? 'news.runinClearOf' : 'news.runinClear',
              gap: order[1] ? me.pts - order[1].pts : 0,
              rival: order[1] ? teamShort(state, order[1].teamId) : '',
              push_k: roundsLeft === 1
                ? (seeded ? 'news.runinWinSeed' : 'news.runinWinTitle')
                : (seeded ? 'news.runinGoldSeed' : 'news.runinGold'),
              rows_ll: rows('news.runinChasers', chasers),
            }
          } else if (gapTop <= 6) {
            k = roundsLeft === 1 ? 'news.runinChaseFinal' : 'news.runinChaseRace'
            v = {
              n: roundsLeft, gap: gapTop, leader: teamShort(state, top.teamId),
              seed_k: seeded ? 'news.runinSeedWord' : 'news.runinTitleWord',
              push_k: roundsLeft === 1 ? 'news.runinNeedFavour' : 'news.runinKeepWinning',
              rows_ll: rows('news.runinLeaders', [top.teamId]),
            }
          } else if (lineRow && lineRow.pts - me.pts <= 6) {
            k = 'news.runinPush'
            v = {
              n: roundsLeft, holder: teamShort(state, lineRow.teamId),
              off_k: lineRow.pts - me.pts === 0 ? 'news.runinLevel' : 'news.runinOffLine',
              off: lineRow.pts - me.pts,
              push_k: roundsLeft <= 2 ? 'news.runinLastAfternoons' : 'news.runinGoOnARun',
              rows_ll: rows('news.runinRivals', [lineRow.teamId]),
            }
          } else if (idx === order.length - 1 || gapDown <= 4) {
            const above = order[order.length - 2]
            k = idx === order.length - 1
              ? (roundsLeft === 1 ? 'news.runinBottomFinal' : 'news.runinBottom')
              : (roundsLeft === 1 ? 'news.runinNearFinal' : 'news.runinNear')
            v = {
              n: roundsLeft, gap: gapDown,
              safe_k: above ? 'news.runinFromSafety' : 'news.runinSinking',
              safe: above ? above.pts - me.pts : 0,
              push_k: roundsLeft === 1 ? 'news.runinWinOrDown' : 'news.runinEveryRuck',
              rows_ll: rows('news.runinDownThere', [bottom.teamId, above?.teamId].filter(Boolean) as string[]),
            }
          }
          if (k) {
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
              subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v,
            })
          }
          // MATHEMATICAL PLAYOFF QUALIFICATION GETS SAID OUT LOUD (user: "no
          // announcement when you mathematically qualify for the playoffs").
          // The check is the strict one: a rival can pass you only if their
          // points plus five per remaining game (win plus try bonus, the most
          // a match can pay) reach yours - ties count against you, so the
          // announcement is never premature by a tiebreak. Announced once a
          // season via a STAMP on state, never by scanning the news log - the
          // log is trimmed, and this session found three gates that forgot.
          if (line > 0 && state.playoffClinch !== state.season && idx >= 0) {
            const leftOf = (id: string) => state.fixtures.filter(f =>
              f.compId === comp.id && !f.stage && !f.played &&
              (f.homeId === id || f.awayId === id)).length
            const canPass = order.filter((r, i) =>
              i !== idx && r.pts + 5 * leftOf(r.teamId) >= me.pts).length
            if (canPass < line) {
              state.playoffClinch = state.season
              const club2 = state.clubs[state.userClubId]
              state.news.push({
                id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
                subject: `🎟 PLAYOFFS SECURED: ${club2.short} are mathematically in`,
                body: `Whatever happens from here, ${club2.name} will be in the ${comp.short} playoffs - no combination of results can push you out of the top ${line}. The seeding is still worth fighting for: finish higher and the knockout rounds come to ${club2.stadium}. The office has already had a call about semi-final ticketing.`,
                k: 'news.clinch',
                v: { short: club2.short, club: club2.name, comp: comp.short, line, stadium: club2.stadium },
              })
            }
          }
        }
      }
    }

    // the Northern Championship window is a big deal - a round-up lands every week
    if (state.comps['sn'] && SIX_NATIONS_WEEKS.includes(state.week)) {
      const round = state.fixtures.filter(f => f.compId === 'sn' && f.week === state.week && f.played)
      if (round.length) {
        const order = sortTable(state.comps['sn'].table)
        const leader = order[0] ? nationNameIn('en', order[0].teamId) : null
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `🏆 Northern Championship round ${SIX_NATIONS_WEEKS.indexOf(state.week) + 1}: the story so far`,
          body: [
            ...round.map(f => `${nationNameIn('en', f.homeId)} ${f.homeScore}–${f.awayScore} ${nationNameIn('en', f.awayId)}`),
            leader ? `\n${leader} top the table${order[0].p >= 4 ? ' with the title in sight' : ''}. The whole sport stops for this.` : '',
          ].filter(Boolean).join('\n'),
          k: leader ? 'news.snRoundLeader' : 'news.snRound',
          v: {
            n: SIX_NATIONS_WEEKS.indexOf(state.week) + 1,
            rows_ll: JSON.stringify(round.map(f => ({
              k: 'news.snRow', home_k: `nation.${f.homeId}`,
              hs: f.homeScore, as: f.awayScore, away_k: `nation.${f.awayId}`,
            }))),
            leader_k: order[0] ? `nationCap.${order[0].teamId}` : 'common.nothing',
            sight_k: order[0] && order[0].p >= 4 ? 'news.snSight' : 'common.nothing',
          },
        })
      }
    }
    generatePress(state, rng)
    // the dressing room's own ledger (pillar 1): incidents surface, unanswered
    // ones fester, and the senior players knock when the room has had enough
    disciplineWeek(state)
    // press tone cools toward neutral unless you keep feeding it
    if (state.pressTone) state.pressTone = Math.abs(state.pressTone * 0.8) < 0.5 ? 0 : state.pressTone * 0.8
  }
  generateGossip(state, rng)
  // WHERE THE SUPPORT'S ANGER HAS GOT TO, and what it costs (terraces.ts).
  // Before this, fan mood moved the gate, the shop and the atmosphere and
  // could not by itself cost anybody a job; a sustained campaign presses the
  // board now, and a support that has fallen for you holds it steady through
  // a bad run - which is what a manager means by "the fans bought me time".
  terraceWeek(state)
  // THE PART OF RUNNING A CLUB THAT IS NOT RUGBY (upkeep.ts, owner: "money
  // comes and goes, external to rugby - stadium repairs, weather damage, new
  // pitches, failed events, successful events"). The books were entirely a
  // function of the sport and therefore entirely predictable; a roof, a storm
  // and a sportsman's dinner are what make balancing them a job.
  upkeepWeek(state, rng)
  // AND THE BOARD COUNTS THE WEEKS IN THE RED. After upkeep, so the week's
  // non-rugby luck is already in the balance being judged.
  debtWeek(state)
  // the board's standing monthly item, three weeks off the awards beat so the
  // two never share an inbox (boardmemo.ts)
  boardMemo(state)

  // THE SECOND PLAYER OF THE MONTH USED TO LIVE HERE, AND IT HAD TO GO.
  //
  // It predated the measured monthly-awards block above (awards.ts) and was never
  // removed when that landed, so the league handed out two Players of the Month:
  // this one every four weeks, that one every six, and both on weeks 12, 24 and
  // 36 - usually to two different men in the same bulletin.
  //
  // It was also the worse of the two. It had no window at all: any man with three
  // appearances at any point in the season and a hot form figure TODAY. That let
  // it crown a man who had not played for a month, whose rolling form had simply
  // not decayed, and - because the A League bumps apps and form without ever
  // writing lastWk - it repeatedly gave the senior league's award to an academy
  // teenager. Measured over three careers, two seasons each: 9 double awards, 22
  // of 42 winners with no senior minutes in the window.
  //
  // scripts/potmprobe.ts holds all of that at zero now.
  aiTransfers(state, rng)
  aiRenewals(state, rng)
  if (!state.unemployed) aiPreContractPoach(state, rng)
  refreshVacancies(state, rng)

  // individual development focus: extra growth for up to 3 youngsters
  if (!state.unemployed) {
    for (const id of state.devFocus.slice(0, 3)) {
      const p = state.players[id]
      if (!p || p.clubId !== state.userClubId || p.age > 26) continue
      const boost = 0.1 + state.staff.assistant * 0.04
      if (p.ca < p.pa && rng() < boost) {
        p.ca += 1
        if (rng() < 0.6) {
          const keys = Object.keys(p.a) as (keyof typeof p.a)[]
          const k = keys[Math.floor(rng() * keys.length)]
          p.a[k] = clamp(p.a[k] + 1, 1, 20)
        }
      }
    }
  }

  // how the mentoring pairs are getting on, every sixth week - after the
  // graduation sweep, so a finished pairing gets its send-off rather than one
  // more progress note about a course that is over
  if (!state.unemployed) {
    mentorGraduations(state)
    mentorReports(state)
  }

  // ---- OBJECTIVES LAND IN THE NEWS ----
  // The board's briefs were checked twice a season, quietly (the half-term
  // card and the review), so hitting one mid-March made no sound (user: "when
  // achieved it should def be in the news"). A BANKED objective is a fact the
  // moment it happens, so the week it comes true it gets its headline - once,
  // the objDone ledger holds the once. The unbanked ones only mean anything
  // at the final whistle of the season and stay out of this.
  if (!state.unemployed) {
    state.objDone ??= []
    for (const id of state.objectives ?? []) {
      const def = OBJECTIVE_DEFS.find(o => o.id === id)
      if (!def || !def.banked || state.objDone.includes(id)) continue
      if (!def.met(state)) continue
      state.objDone.push(id)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: `✅ Board objective met: ${tIn('en', def.textKey(state)).split(':')[0]}`,
        body: `One of the season's briefs is in the bank: "${tIn('en', def.textKey(state))}." The board noted it at this morning's meeting, and it will count for you at the end-of-season review whatever else happens between now and May.`,
        k: 'news.objectiveMet',
        // The headline used to be the objective rendered to English and cut at
        // its colon, so the subject line was English in a French inbox. Each
        // objective has its own short form now; splitting a sentence on
        // punctuation is not a translation strategy.
        v: { head_k: `${def.textKey(state)}Head`, text_k: def.textKey(state) },
      })
    }
  }

  // ---- THE DESK CLEARS ITSELF ----
  // Two piles used to grow without limit and the user noticed both (user:
  // "press questions should be forced to be cleared before each next match"
  // and "24 unread messages from weeks ago. These should clear"). The hard
  // continue-gate is a bigger rework of every walk flow; what ships now is
  // the honest half: a press question you did not answer this week does not
  // follow you into the next one - the moment passed, the room moved on -
  // and a story unread for three weeks is filed by the club secretary. The
  // filed stories stay on the record (the Wire and season review read the
  // whole list); they simply stop counting against the mail icon.
  // STRICTLY OLDER THAN THIS WEEK. A question is stamped with the week being
  // settled when it is written (media.mk), and the manager answers it during
  // the FOLLOWING week's walk - so `<` gives every question exactly one full
  // week on the desk, and `<=` would gag the press room for good by expiring
  // each question in the same settlement that asked it. Office conversations
  // and internal staff decisions (the pre-season camp) are not press and keep
  // their own clock.
  // TIDY THE PRESS ROOM (owner, v1.1.14: "tidy the press room up - remove
  // anything older than 2 weeks"). His screenshot, taken in week 8, had
  // coverage from 30 August and 23 August still on the page - two months of
  // answered questions stacked under RECENT COVERAGE, which is neither recent
  // nor coverage. Answered questions older than a fortnight are dropped from
  // the save entirely rather than merely hidden: they are the largest thing in
  // a long career's press list and nothing else reads them.
  //
  // UNANSWERED ONES ARE NEVER SWEPT HERE. The loop below auto-answers a
  // question the manager let pass, and that carries a board and support cost -
  // deleting it instead would make ignoring the desk free again, which is the
  // exact hole that loop was written to close.
  //
  // MEASURED AGAINST THE WEEK THE ROOM WILL BE READ IN, not the one being
  // settled. This runs inside the settle for week W and the manager opens the
  // room in week W+1, so a straight `<= PRESS_KEEP_WEEKS` here left one item
  // that the screen - which measures from the week it is actually drawn in -
  // then hid anyway. Same rule, one clock.
  {
    const next = state.season * SEASON_WEEKS + state.week + 1
    state.press = state.press.filter(q =>
      !q.answered || next - (q.season * SEASON_WEEKS + q.week) <= PRESS_KEEP_WEEKS)
  }
  for (const q of state.press) {
    if (q.answered || q.topic || q.outlet === OFFICE_OUTLET) continue
    if (q.season < state.season || (q.season === state.season && q.week < state.week)) {
      q.answered = true
      q.answerLabel = 'No comment'
      q.reaction = 'The moment passed. The outlet ran the piece without you, and next week brings new questions.'
      // Silence is not free. Ignoring the desk used to cost exactly nothing,
      // which made never opening the Press screen strictly optimal - the worst
      // live answer docks board confidence, but letting every question rot
      // docked none. Small numbers on purpose: one missed question is a shrug,
      // a season of empty chairs is a board that has stopped hearing from its
      // manager and a support that has stopped hearing from its club. Sized
      // below the worst live answer (board -0.2 on the option scale = 1.0
      // confidence) so answering badly still beats not answering at all.
      const uc = state.clubs[state.userClubId]
      if (uc) uc.boardConfidence = clamp(uc.boardConfidence - 0.8, 0, 100)
      state.fanMood = clamp((state.fanMood ?? 60) - 0.4, 10, 95)
    }
  }
  for (const n of state.news) {
    if (n.read || n.cleared) continue
    const age = (state.season - n.season) * 100 + (state.week - n.week)
    if (age >= 3) { n.read = true; n.cleared = true }
  }

  // advance
  if (state.week >= SEASON_WEEKS) {
    // the summer cap audit happens on the old season's wage bill, before the
    // rollover moves anybody on (F6)
    auditCaps(state)
    rebuildSeason(state)
    // and the new season's ceiling is measured from the league as it now stands
    refreshCaps(state)
  } else {
    state.week += 1
  }

  // trim news LAST, so the 250 ceiling holds at the end of every tick - it used
  // to sit above the advance, which let the season rollover file its honours,
  // retirements and expiries on top of a list that had already been cut
  if (state.news.length > NEWS_KEEP) state.news = state.news.slice(-NEWS_KEEP)

  // (derby build-up now lives in the pre-advance block above, with the
  // all-time ledger - the old duplicate beat here was removed)
}

/**
 * Top a short Test squad up to the floor, from the men actually available.
 *
 * Only ever the USER's nation - everyone else's is picked in full by
 * manageInternationals. Only ever when a Test for that nation falls this week,
 * because until then the empty sheet IS the job and filling it would be the
 * auto-pick the owner asked us to stop doing.
 */
function fillShortNatSquad(state: GameState) {
  const nat = state.natTeam
  if (!nat || state.unemployed) return
  const playing = state.fixtures.some(f =>
    !f.played && f.week === state.week && (f.homeId === nat || f.awayId === nat))
  if (!playing) return
  const named = state.natSquads[nat] ?? []
  if (named.length >= NAT_SQUAD_FLOOR) return
  const inCamp = new Set(named)
  const spare = Object.values(state.players)
    .filter(p => !inCamp.has(p.id) && (nat === 'LIO' ? HOME4_NAT.includes(p.nat) : p.nat === nat) &&
      p.clubId && homeBased(state, p, nat) && !p.injury && !p.natSquad)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, NAT_SQUAD_FLOOR - named.length)
  if (!spare.length) return
  for (const p of spare) {
    named.push(p.id)
    p.natSquad = true
  }
  state.natSquads[nat] = named
  const v = { ...nationVars(nat), n: spare.length }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
    subject: tIn('en', 'news.natFilledSubj', v),
    body: tIn('en', 'news.natFilled', v),
    k: 'news.natFilled', v,
  })
}

const HOME4_NAT = ['ENG', 'IRE', 'SCO', 'WAL']
