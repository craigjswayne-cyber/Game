// The board: the manager's requests (facilities, the ground, funds), its
// weekly reaction to results and its reading of the table. Split out of
// season.ts, which re-exports the public parts.
import type { FacilityId, Fixture, GameState } from '../model'
import { offerResult, offerRun } from '../records'
import { book } from '../books'
import { boardPatience, demandCeiling, FACILITY_INFO, facilityCost, buildWeeks, fmtMoney, grudgeBetween, MAX_FACILITY, squadTrust, GROUND_TIERS, groundLevel, groundBuildWeeks, unbeatenRun, mgrWinWeight, addWeeks100 } from '../model'
import { leaguePos } from '../schedule'
import { boardPriorityF } from '../seasonplan'
import { logDecision } from '../model'
import { clamp } from '../rng'
import { askBoard, type BoardAsk } from '../boardroom'
import { historyWeight } from '../history'
import { chairSwing, demandedFinish } from '../chairman'
import { t, tIn } from '../i18n'
import { runSpotlight } from './training'
import { mgrMilestones } from './news'

/** The manager is back at a door the board just closed (v1.1.4, owner's
 *  brief: "if they ask again after being denied - warning, respect halved;
 *  if they continue to push - fired"). Two doors share the ledger key
 *  'capital' (facilities and the ground share their cooldown); 'funds' is
 *  its own. The first repeat inside a denial draws the formal warning and
 *  HALVES the board's confidence; the next is the sack, that week, whatever
 *  the table says. Deterministic, rng-free, and the reply says exactly what
 *  pressing again will cost - the dismissal is a choice, never an ambush. */
function pressBoard(state: GameState, kind: 'capital' | 'funds' | 'time' | 'staff'): string {
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
  // GOODWILL, NOT THE JOB (1.8.14). The second ask after a refusal used to be
  // a sacking on the spot, and it took a manager top of the table with it.
  // Each further ask now costs a quarter of what confidence is left; a board
  // pushed far enough sacks the usual way, on its confidence.
  club.boardConfidence = clamp(Math.round(club.boardConfidence * 0.75), 0, 100)
  logDecision(state, 'dec.boardPushed', {}, false)
  return t('reply.boardPushedAgain')
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
  // one builders' slot, and the new stand is in it
  if (state.stadiumBuild) return t('facilities.facStandBusy', { stadium: club.stadium })
  const abs = state.season * 100 + state.week
  // A BOARDROOM GRANT IS ALREADY A YES (1.8.1). The chairman agreed to fund
  // this building, so collecting it is not a request: it is not pressing
  // inside a refusal, and it is not refused for want of reserves the club
  // will not spend. It used to face the full test below, balance included,
  // and a club too poor to pay the share it was being excused was told no.
  const granted = (state.boardGrant ?? []).indexOf(fid)
  // inside a denial the polite refusal is gone: asking again is pressing the
  // board, and pressing the board has a price (pressBoard above)
  if (granted < 0 && (state.facilityAskCooldown ?? 0) > abs) return pressBoard(state, 'capital')
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
  const clubShare = granted >= 0 ? 0 : Math.round(cost * (1 - backing))
  const approve = granted >= 0 || (club.boardConfidence >= 45 && club.balance >= clubShare * 1.25)
  if (!approve) {
    state.facilityAskCooldown = addWeeks100(abs, 8)
    ;(state.boardAsks ??= {}).capital = { deniedAt: abs, strikes: 0 }
    const whyKey = club.boardConfidence < 45 ? 'news.facNoResults'
      : club.balance < clubShare ? 'news.facNoShare'
      : 'news.facNoReserves'
    const why = tIn('en', whyKey)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `Board says no: ${tIn('en', info.name)}`,
      body: `Your request for a level ${lvl + 1} ${tIn('en', info.name).toLowerCase()} was heard, considered and declined - ${why}. The door reopens in a couple of months; better results and a healthier balance reopen it faster.`,
      k: 'news.facDeclined',
      v: { name_k: info.name, lvl: lvl + 1, why_k: whyKey },
    })
    logDecision(state, 'dec.facilityDeclined', { lvl: lvl + 1, fac_k: info.name, why_k: whyKey }, false)
    return t('reply.declined', { why_k: whyKey })
  }
  /**
   * A BOARDROOM GRANT IS PAID BY THE BOARD (v1.8.3). If the chairman has
   * already agreed to fund this one, the club's share is nil and the grant
   * is spent - one building, once. That is the whole difference between the
   * ask on this page and the ask in the boardroom: here you are asking to be
   * allowed to spend, there you are asking somebody else to.
   */
  if (granted >= 0) {
    state.boardGrant!.splice(granted, 1)
  } else {
    club.balance -= clubShare
    book(state, 'works', -clubShare)
  }
  // the higher the rung, the longer the builders stay (buildWeeks in model.ts)
  const weeks = buildWeeks(lvl + 1)
  state.facilityBuild = { id: fid, done: addWeeks100(abs, weeks), level: lvl + 1 }
  delete state.boardAsks?.capital // a yes wipes the slate
  const boardPut = cost - clubShare
  logDecision(state, 'dec.facilityApproved', { lvl: lvl + 1, fac_k: info.name, cost: fmtMoney(cost), weeks }, true)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: `Board approves: ${tIn('en', info.name)} to level ${lvl + 1}`,
    body: `${fmtMoney(cost)} signed off on a level ${lvl + 1} ${tIn('en', info.name).toLowerCase()}${boardPut > 0
      ? ` - the board underwrite ${fmtMoney(boardPut)} of it and the club funds the remaining ${fmtMoney(clubShare)}`
      : `, all of it from club funds`}. The builders move in on Monday and it opens in about ${weeks} weeks. ${tIn('en', info.desc)}`,
    k: boardPut > 0 ? 'news.facApprovedShared' : 'news.facApproved',
    v: {
      name_k: info.name, desc_k: info.desc, lvl: lvl + 1,
      cost: fmtMoney(cost), board: fmtMoney(boardPut), club: fmtMoney(clubShare), weeks,
    },
  })
  return boardPut > 0
    ? t('reply.facApprovedShared', { board: fmtMoney(boardPut), club: fmtMoney(clubShare), n: weeks })
    : t('reply.facApprovedOwn', { club: fmtMoney(clubShare), n: weeks })
}

/** Cost of the next stand: seats added, at the same rate the board pays. */
export function expansionPlan(state: GameState) {
  const club = state.clubs[state.userClubId]
  /**
   * ---- THE NEXT RUNG, AS FAR AS THE TOWN WILL BUY IT (owner, v1.6.8) ----
   *
   * The ground used to grow 6% at a time toward nothing in particular. It now
   * climbs the six grounds in GROUND_TIERS, and what the board signs off is
   * the gap to the next one - or, when the following will not carry a stand
   * that big yet, as far toward it as the crowd justifies.
   *
   * THE STAGE IS THE TARGET, THE CATCHMENT IS THE LIMIT. A village club with
   * 1,500 seats and 1,700 people who would come does not get a 3,000-seat
   * stand because the ladder says so; it gets the 200 its support carries,
   * and reaches stage one when its support does. That keeps the ladder honest
   * on a small club without ever building a stand that stands empty.
   */
  const lvl = groundLevel(club.capacity)
  const target = lvl >= GROUND_TIERS.length - 1
    ? club.capacity
    : Math.min(GROUND_TIERS[lvl + 1], demandCeiling(club))
  const seats = Math.max(0, Math.round((target - club.capacity) / 100) * 100)
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
  return {
    seats, cost: seats * perSeat, perSeat, avg: Math.round(avg),
    fill: avg ? avg / club.capacity : 0, played: home.length,
    // the rung this build is climbing to, which sets how long it takes
    nextLevel: Math.min(GROUND_TIERS.length - 1, lvl + 1),
  }
}

/**
 * Ask for a bigger ground. The board wants to see the seats filled before it
 * pours concrete - full houses and a healthy balance carry the vote.
 */
export function requestExpansion(state: GameState): string {
  const club = state.clubs[state.userClubId]
  const abs = state.season * 100 + state.week
  // THE TOP OF THE LADDER, and the hard cap above it for the handful of
  // grounds that were already bigger than a stage-five stadium on day one
  if (groundLevel(club.capacity) >= GROUND_TIERS.length - 1 || club.capacity >= 82_000) {
    return t('reply.groundAlreadyHuge', { stadium: club.stadium })
  }
  // the Infrastructure page greys the button out at this point, and the engine
  // has to agree with it: a board does not lay seats it cannot sell
  if (club.capacity >= demandCeiling(club) * 0.95) {
    return t('reply.groundBigEnough', { stadium: club.stadium })
  }
  if (state.facilityBuild) return t('reply.buildersBusy')
  if (state.stadiumBuild) return t('facilities.facStandBusy', { stadium: club.stadium })
  // same door as the facilities: inside a denial, asking again is pressing
  if ((state.facilityAskCooldown ?? 0) > abs) return pressBoard(state, 'capital')
  const { seats, cost, fill, played, nextLevel } = expansionPlan(state)
  // the catchment may leave nothing worth laying this season
  if (seats < 100) return t('reply.groundBigEnough', { stadium: club.stadium })
  // one stand a season: builders, planning permission and a season ticket
  // renewal cycle all take their time
  if (state.expandedSeason === state.season) {
    return t('reply.groundExtendedThisSeason')
  }
  const enoughDemand = played >= 3 && fill >= 0.9
  const approve = enoughDemand && club.balance >= cost * 1.3 && club.boardConfidence >= 50
  if (!approve) {
    state.facilityAskCooldown = addWeeks100(abs, 8)
    ;(state.boardAsks ??= {}).capital = { deniedAt: abs, strikes: 0 }
    const whyKey = played < 3 ? 'news.expNoEarly'
      : fill < 0.9 ? 'news.expNoEmpty'
      : club.balance < cost * 1.3 ? 'news.expNoReserves'
      : 'news.expNoResults'
    const why = tIn('en', whyKey, { pct: Math.round(fill * 100) })
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `Board says no: expanding ${club.stadium}`,
      body: `Your case for ${seats.toLocaleString()} more seats was heard and declined - ${why}. Fill the ground week after week and the argument makes itself.`,
      k: 'news.expDeclined',
      v: { stadium: club.stadium, seats, why_k: whyKey, pct: Math.round(fill * 100) },
    })
    logDecision(state, 'dec.expandDeclined', { stadium: club.stadium, why_k: whyKey, pct: Math.round(fill * 100) }, false)
    return t('reply.declined', { why_k: whyKey, pct: Math.round(fill * 100) })
  }
  club.balance -= cost
  book(state, 'works', -cost)
  state.expandedSeason = state.season
  // THE SEATS ARRIVE WHEN THE STAND DOES (owner, v1.6.6). A yes used to put
  // them on the gate the same afternoon, which made the one project big enough
  // to reshape the club the only one that cost no time at all. The money goes
  // now - the contract is signed - and the capacity moves when the builders
  // are off site, twelve weeks later, holding the builders' slot meanwhile.
  const weeks = groundBuildWeeks(nextLevel)
  state.stadiumBuild = { done: addWeeks100(abs, weeks), seats, cost }
  delete state.boardAsks?.capital // a yes wipes the slate
  logDecision(state, 'dec.expandApproved', { stadium: club.stadium, seats, cost: fmtMoney(cost), weeks }, true)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: `Builders move in at ${club.stadium}: ${seats.toLocaleString()} seats`,
    body: `The board has signed off on a new stand: ${fmtMoney(cost)}, and ${seats.toLocaleString()} seats at ${club.stadium}. The hoardings go up this week and the stand opens in ${weeks} weeks - until then the ground holds what it always held, and the builders are on this and nothing else.`,
    k: 'news.expApproved',
    v: { stadium: club.stadium, seats, cost: fmtMoney(cost), weeks },
  })
  return t('reply.expandApproved', { seats, cost: fmtMoney(cost), weeks })
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
/** The boardroom door (boardroom.ts). It is here rather than there because
 *  pressBoard - the cost of knocking on a door the board just shut - has
 *  lived in this file since it was written, and one escalation ladder is
 *  worth more than two that agree today. */
export function askTheBoard(state: GameState, id: BoardAsk): string {
  return askBoard(state, id, pressBoard)
}

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

/** The week a new manager's first-season grace ends: the first week a
 *  results sacking can happen, so the grace covers the weeks BEFORE it (the
 *  sack check reads `week < honeymoonEnd`). 32 at a club of reputation 50 or
 *  less, 12 at 88 or more, a straight line between. */
export function honeymoonEnd(rep: number): number {
  const t = Math.max(0, Math.min(1, (rep - 50) / 38))
  return Math.round(32 - 20 * t)
}

/** board confidence a week at a title favourite for a sheet the manager never claimed */
const ABSENT_SHEET = 1.1
export function boardReaction(state: GameState, fx: Fixture, delegated = false) {
  const club = state.clubs[state.userClubId]
  const isHome = fx.homeId === club.id
  const us = isHome ? fx.homeScore : fx.awayScore
  const them = isHome ? fx.awayScore : fx.homeScore
  const oppRep = state.clubs[isHome ? fx.awayId : fx.homeId]?.rep ?? 70
  const diff = (oppRep - club.rep) / 25
  // derbies echo in the boardroom; an earned rivalry or a return to a club
  // that remembers you echoes a little (history.ts, never above 1.3)
  const derbyF = fx.derby ? 1.8 : historyWeight(state, fx)
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
  // A WIN IS WORTH SOMETHING AT A BIG CLUB TOO (1.8.0, owner: "why if they
  // are doing everything right do they get sacked? This needs to be fixed").
  // A favourite beating a weaker side earned max(0.8, 2.5 + diff * 2), about
  // a quarter of what losing the same game cost, so Bath had to win four in
  // five just to hold its board still: a title-chasing 11-7 season drifted
  // down, and a best-XV Bath was sacked in 6 of 48 simulated seasons. A win
  // is now worth at least 55% of the loss against the same opponent, which
  // holds a favourite's board level at about a 65% win rate. Where the win
  // was already worth more (an underdog's), nothing changes.
  const lossMag = Math.max(0.8, 2.5 - diff * 2)
  const mag = us > them ? Math.max(0.8, 2.5 + diff * 2, 0.55 * lossMag) : lossMag
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
  // and THE MAN IN THE CHAIR (chairman.ts): a stability chairman is a shade
  // calmer about a result, an ambitious one a shade louder, and a newcomer's
  // board is in a hurry. Hidden, and a tenth either way at most.
  const patienceF = boardPatience(club.rep) * chairSwing(state)
  // THE SEASON PLAN (1.8.2, seasonplan.ts): the competition the manager put
  // first is watched harder, the one he put last more gently. 1 with no plan.
  const prioF = boardPriorityF(state, fx.compId)
  if (us > them) club.boardConfidence = clamp(club.boardConfidence + mag * derbyF * ownerF * stanceF * patienceF * prioF, 0, 100)
  else if (us < them) club.boardConfidence = clamp(club.boardConfidence - mag * derbyF * ownerF * stanceF * patienceF * prioF, 0, 100)

  // THE BOARD KNOWS WHO PICKED THE SIDE (1.8.17, owner: "everything should be
  // green", on autopilotprobe). A big club's board reads its results, and it
  // also knows whether the manager it pays named the twenty-three or left
  // that to his assistant: a season of the assistant's sheets is a manager
  // who is not doing the job, whatever the table says. Without this the
  // board could only judge a sleepwalker by the results his assistant's
  // sides earned, which since 1.8.14 are close to an engaged manager's, so
  // the engaged Bath was in crisis 12 seasons in 36 against the absent
  // one's 14. A little each week a sheet nobody claimed is played, scaled
  // by stature: nothing at a club whose board is patient (boardPatience 1
  // and under, about rep 55), the full amount at a title favourite. One
  // touch of the Selection screen claims the sheet (tactic.userPicked), and
  // an international week the assistant runs is not counted (delegated).
  // Measured with it at 1.1 (autopilotprobe, 36 seasons each): crisis 9
  // engaged against 20 absent at Bath, sacked 1 against 11; Esher, whose
  // board is patient, untouched (0 of 36, worst 26).
  if (!delegated && club.tactic.userPicked !== true) {
    const giant = clamp((boardPatience(club.rep) - 1) / 0.9, 0, 1)
    if (giant > 0) club.boardConfidence = clamp(club.boardConfidence - ABSENT_SHEET * giant, 0, 100)
  }

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
  // BELIEF IS SLOWER TO WIN THAN TO LOSE AT THE TOP (1.8.14). A winning side
  // took a stranger from 26 to 80-100 inside one season, so the room's doubts
  // were over before the first trophy was. A win now buys less belief the more
  // the room already has: about half a season of winning moves a new man from
  // doubted to accepted, and full conviction takes two or three good years.
  const believe = clamp(1.25 - squadTrust(state) / 100, 0.3, 1)
  const trustMag = us > them
    ? (1.5 + Math.max(0, diff) * 1.6 + Math.min(2, streak * 0.25)) * believe
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
          subject: `RECORD GATE: ${fx.att.toLocaleString()} at ${club.stadium}`,
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
        subject: `A record under you: ${us}-${them}`,
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
    if (us > them) { state.mgr.ww = (state.mgr.ww ?? state.mgr.w) + mgrWinWeight(state); state.mgr.w += 1 }
    else if (us === them) state.mgr.d += 1
    else state.mgr.l += 1
    mgrMilestones(state, us > them)
  }

  // the terraces have longer memories and shorter fuses than the board
  const before = state.fanMood ?? 60
  const heat = fx.derby || grudgeBetween(state, fx.homeId, fx.awayId) ? 1.7 : historyWeight(state, fx)
  // A BIG CLUB'S TERRACES DO NOT LOWER THEIR SIGHTS (owner, 1.8.14: "the fans
  // should be aggressive on piling on the pressure for results"). The board
  // now reads its squad before it sets the aim (chairman.ts demandedFinish);
  // the support reads the badge. From reputation 80 a draw is a defeat's
  // little brother (it costs double) and the campaign starts sooner
  // (terraces.ts). A defeat costs what it always did: mood also sets the home
  // crowd's lift on the day, and a defeat that cost 1.4 times the mood at
  // Northampton turned into a spiral (an idle manager sacked in six first
  // seasons of eight, three on 1.8.13).
  const big = state.clubs[state.userClubId].rep >= 80
  let mood = before + (us > them ? 4 * heat : us < them ? -(5 * heat + (isHome ? 1.5 : 0)) : big ? -2 : -1)
  mood += (55 - mood) * 0.03 // everything fades toward "fine"
  state.fanMood = clamp(mood, 5, 98)
  if (before < 80 && state.fanMood >= 80) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `The terraces are in full voice`,
      body: `The songs have new verses and away allocations are selling out. The supporters believe in this team - and ${state.clubs[state.userClubId].stadium} is becoming a genuinely hard place to visit.`,
      k: 'news.fansUp', v: { stadium: state.clubs[state.userClubId].stadium },
    })
  } else if (before > 30 && state.fanMood <= 30) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `Boos at full-time`,
      body: `Sections of the support turned on the team this week. Banners are being painted and the phone-ins are merciless. Results are the only medicine - and until they come, home games will feel colder.`,
      k: 'news.fansDown', v: {},
    })
  }
}

/**
 * ---- THE BOARD READS THE TABLE (v1.8.4) ----
 *
 * It used to read it once, at half term, against a target floored at 20. Both
 * halves of that were wrong for a big club, and autopilotprobe caught it:
 * twelve seasons of deliberate neglect at a rep-88 club got NOBODY sacked, and
 * the board reached crisis in two of the twelve. A manager game whose board
 * never acts has no stakes in it at all.
 *
 * Two changes, both stature-scaled, and the owner's words for what this should
 * feel like are "pressure at a title favourite should be super hard and
 * intense".
 *
 *   THE FLOOR. clamp(..., 20, 96) meant no blend could ever put a board below
 *   20, so the sack check at 3 was unreachable by this route however badly a
 *   giant did. The floor now falls with patience: a Championship board still
 *   bottoms out around 22 and a title favourite's can reach 2. A minnow's
 *   board is where the old number came from and keeps it.
 *
 *   THE CADENCE. Once a season is not pressure, it is an annual review. The
 *   board now looks at weeks 12, 24 and 34 - a third of the way in, half term,
 *   and with the run-in in front of it - and leans on it harder each time. A
 *   giant sliding all year gets three verdicts, each worse than the last;
 *   a side that recovers by March is judged on March.
 *
 * Deliberately NOT a route to a sacking on its own: the blend converges toward
 * the target rather than jumping to it, so a board that ends the season hating
 * you still needed the weekly results to agree. An engaged manager at the same
 * club sits around 31 - visibly under pressure at a place where second is a
 * crisis, and nowhere near the trapdoor.
 */
export function boardReadsTheTable(state: GameState, lean = 1) {
  const club = state.clubs[state.userClubId]
  const comp = state.comps[club?.leagueId ?? '']
  if (!club || !comp || comp.table.length <= 1) return
  // A BOARD IN THE TRAPDOOR IS NOT TALKED ROUND BY THE TABLE. Without this the
  // three reviews became three reprieves: chaosprobe drives confidence to zero
  // and waits for the sack, and the week-12 review blended it straight back up
  // to the target before the check at the end of the week could fire. A board
  // that has already decided has already decided; the sack is the only thing
  // left to happen to it.
  if (club.boardConfidence <= 3) return
  const posNow = leaguePos(comp.table, club.id)
  if (posNow <= 0) return
  const tableLen = comp.table.length
  // the aim for the kind of job this is (chairman.ts), not stature alone
  const objPos = Math.min(demandedFinish(state, club.id, tableLen).pos, tableLen)
  const devFrac = (posNow - objPos) / Math.max(1, tableLen - 1)
  const patience = boardPatience(club.rep)
  const floor = clamp(30 - patience * 14, 2, 26)
  const target = clamp(70 - devFrac * 108, floor, 96)
  // AT MOST 40% OF THE WAY IN ONE READING (1.9.0, was 62%). A giant's board
  // still pulls hardest, but one look at the table can no longer undo most of
  // a season's results in a week; the weekly result swings (boardReaction)
  // carry the rest. Clubs whose board reads at 0.4 or less are untouched.
  const blendW = clamp(0.25 * patience * lean, 0.12, 0.4)
  // BOARDS SOUR FASTER THAN THEY WARM. Symmetrical was wrong in both
  // directions: it let a slide be forgiven at the next review as readily as it
  // punished one, and chaosprobe caught the consequence - a board driven to
  // zero was lifted back to 21 in a single reading because the table happened
  // to look ordinary. Goodwill is earned back over a season, not over one
  // afternoon with a league table, so a rise carries a third of the weight of
  // a fall.
  const w = target < club.boardConfidence ? blendW : blendW * 0.34
  club.boardConfidence = clamp(club.boardConfidence * (1 - w) + target * w, 0, 100)
}
