import { talkbackWeek } from './talkback'
import { settleStartPledge } from './handshake'
import type { Fixture, GameState, Player, Pos } from './model'
import { genderOf, subjectVar } from './gender'
import { islesCoach, isleTour, offerIsles } from './isles'
import { telling } from './tellings'
import { aiCloseSeason } from './closeseason'
import { talkingPoints } from './talkingpoints'
import { aiFireSale, aiWeeklyFinance } from './aiecon'
import { insolvencyWarning } from './insolvency'
import { advanceHunt } from './living'
import { aiFreeAgents, aiSummerMarket, aiYouthHunt, rivalPushWeek, settleRivalBids } from './rivalbids'
import { rivalBeat } from './boss'
import { auditCaps, refreshCaps } from './cap'
import { AWARD_EVERY, managerOfMonth, runLine, runVars } from './awards'
import { boardMemo } from './boardmemo'
import { terraceWeek } from './terraces'
import { upkeepWeek } from './upkeep'
import { absWeek, addGrudge, careerRows, boardPatience, FACILITY_INFO, finalVenue, fmtMoney, formGuide, mgrReputation, RELEGATES, SEASON_WEEKS, seasonLabel, stamp100, mgrWinWeight, tieWinner } from './model'
import { simMatch, teamShort } from './matchEngine'
import { BARRAGE_WEEK } from './calendar'
import { leaguePos, sortTable, snIdFor, snWeeksFor, TRC_WEEKS } from './schedule'
import { aiPreContractPoach, aiRenewals, aiTransfers, askingPrice, settlePendingDeals } from './ai'
import { isDeadlineWeek, nextWeek, postWindowNotes, prevWeek } from './window'
import { OFFICE_OUTLET, PRESS_KEEP_WEEKS, generatePress, isBoardroom } from './media'
import { debtWeek } from './treasury'
import { generateGossip } from './gossip'
import { peekPid, resetIds } from './attributes'
import { recruitmentMeeting, scoutOpponent, weeklyScouting } from './scout'
import { recordTendency } from './tendency'
import { flushIdentityNews, stepIdentity } from './identity'
import { disciplineWeek } from './authority'
import { updateAgency } from './agency'
import { OBJECTIVE_DEFS, objectiveBonus } from './objectives'
import { applyPlanSheet } from './seasonplan'
import { derbyName, isDerby } from './rivalries'
import { pickableNations, nationByCode, nationNameIn, nationVars } from './nations'
import { isMyClub, LAST_PLEDGE_WEEK, logDecision } from './model'
import { resolveCourses } from './staff'
import { staffRiftWeek } from './staffrift'
import { resolveCommission, scoutPostcard } from './commission'
import { scoutDesk } from './scoutrecs'
import { clamp, mulberry32 } from './rng'
import { attrOdds, attrRoll } from './ageing'
import { gameTimeReview, settleGameTime } from './gametime'
import { depthWatch } from './depthwatch'
import { rebuildSeason, rollIntakeClass } from './rollover'
import { setUpForUser } from './oppcoach'
import { drillWeek } from './playbook'
import { drillMovesWeek } from './moves'
import { settleJokers } from './joker'
import { settleKnocks } from './knock'
import { expireLoans, loanOutBoost, loanTargets } from './loans'
import { FOCUS_MAX_AGE, focusIds } from './development'
import { weekGrowth } from './devproject'
import { devNewsWeek, previewRead, trimDevFirst } from './devnews'
import { refreshVacancies, sackManager } from './jobs'
import { historyPreview } from './history'
import { arcWeek } from './arc'
import { playAcademyWeek } from './academy'
import { mentorGraduations, mentorReports } from './mentoring'
import { bondsWeek, flushBondNews } from './bonds'
import { roomTidy, roomWeek } from './room'
import { tIn, type Vars } from './i18n'
import { flushMemoryNews, memoryWeek, rememberPromise } from './memory'
import { natTwin, savedShort, weekRng } from './season/dice'
import { boardReaction, boardReadsTheTable, honeymoonEnd } from './season/board'
import { applyToTable, maybeCreateKnockouts, resolveKnockoutDraw, winnerOf } from './season/tables'
import { fillShortNatSquad, manageInternationals } from './season/internationals'
import { weeklyTraining } from './season/training'
import { weeklyFinance } from './season/finance'
import { afterClubMatch, leagueRoundUp, matchReport, mgrMilestones, milestones } from './season/news'
import { userFixtureThisWeek } from './season/whose'
import { withDevelopmentSide } from './season/friendlies'

// The season's subsystems live in src/game/season/ (split out of this file,
// which was nearly five thousand lines); this file keeps the weekly settle,
// processWeekAndAdvance, and re-exports everything it used to export so no
// import anywhere changes.
export { weekRng, matchRng } from './season/dice'
export { requestFacility, expansionPlan, requestExpansion, askTheBoard, requestFunds, honeymoonEnd } from './season/board'
export { rebuildTable, applyAdminPenalties, KO_STAGES, isKnockoutTie, resolveKnockoutDraw } from './season/tables'
export type { EtLine } from './season/tables'
export { activeWindows } from './season/internationals'
export type { Window } from './season/internationals'
export { planCap, activePlan, activeEntry, rollPlan, runSpotlight } from './season/training'
export { afterClubMatch, WIN_MARKS, GAME_MARKS } from './season/news'
export { userFixtureThisWeek, natFixtureThisWeek, assistantNatFixture, userMatchThisWeek, assistantFixtureThisWeek } from './season/whose'
export { arrangeFriendly, FRIENDLY_DAY, friendlyWeekOk, friendlyWeeks, friendlySuggestions, friendlyDate, arrangeMidweekFriendly } from './season/friendlies'

// ------------------------------------------------------------------
// Weekly processing
// ------------------------------------------------------------------

/** how many stories the inbox keeps on the shelf - older ones fall off the bottom */
export const NEWS_KEEP = 250

/**
 * Process everything for the current week EXCEPT the user's fixture
 * (which the UI plays via the MatchDay screen first).
 * Then move to next week.
 */
export function processWeekAndAdvance(state: GameState) {
  // last week's back page is last week's: a fresh one is written below if
  // the side plays, and a stale one must never sit over a new week
  const rng = weekRng(state)
  // never mint below the counter the save carries: a career opened in the
  // same session as another must not reuse ids the other career freed (1.6.4)
  resetIds(Math.max(peekPid(), state.pidNext ?? 0))
  // the window's countdown for any day of this week the walk did not reach,
  // so a week settled in one go still files every notice, in order (window.ts)
  postWindowNotes(state, 5)
  // did last week's match make a knock worse? (knock.ts) - before the jokers,
  // so a flare-up that puts a man out long-term is one a joker can cover
  settleKnocks(state)
  // a medical joker whose man is fit again, or gone, leaves (joker.ts)
  settleJokers(state)

  // ---- A DRAW IS NEWS, AND NEWS GOES OFF ----
  //
  // state.draw holds the ceremony the bulletin offers. closeDraw() clears it,
  // and its own comment says clearing it is what stops the same draw being
  // offered every week for the rest of the season - but closeDraw is reachable
  // from nothing except the two buttons INSIDE the draw screen. Back out with
  // the arrow, or press Continue without opening it at all, and the card sat
  // on the home page for good: the owner reported it twice over, once as a
  // draw that would not go away after Continue and once as a semi-final draw
  // still showing after he had won the title.
  //
  // So the card no longer depends on anybody pressing the right button. A draw
  // belongs to this season and to a round that has not been played; either of
  // those failing makes it history, and the ties themselves live in the fixture
  // list, so dropping the ceremony loses nothing at all.
  if (state.draw) {
    const d = state.draw
    const stale = d.season !== state.season || state.fixtures.some(f =>
      f.compId === d.compId && f.stage === d.stage && f.played)
    if (stale) state.draw = null
  }

  // The week's set-piece coaching (F2). What you call gets sharper, what you
  // shelved rusts - which is what stops a club from owning ten world-class moves.
  for (const club of Object.values(state.clubs)) {
    drillWeek(state, club, club.id === state.userClubId && state.matchPrep === 'setpiece')
    // and the attacking moves, on the same rules (moves.ts): an Attack week
    // and the attack coach are what sharpen them
    drillMovesWeek(state, club, club.id === state.userClubId && state.matchPrep === 'attack')
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
    const mine = isMyClub(state, fx.homeId) || isMyClub(state, fx.awayId) ||
      (state.natTeam != null && (fx.homeId === state.natTeam || fx.awayId === state.natTeam ||
        (islesCoach(state) && (fx.homeId === 'LIO' || fx.awayId === 'LIO'))))
    // A MIDWEEK FRIENDLY IS THE ASSISTANT'S GAME, not the manager's: it never
    // becomes simmedUserFx, so a league Saturday in the same week is still the
    // match he stands on the touchline for.
    if (fx.compId === 'fr' && fx.devSide) {
      withDevelopmentSide(state, fx.homeId, () => simMatch(state, fx, rng, false))
      continue
    }
    simMatch(state, fx, rng, false)
    const comp = state.comps[fx.compId]
    if (comp) {
      // A PROVINCIAL TOUR GAME IS NOT PART OF THE SERIES. It carries a `stage`
      // like every tour fixture does ("Tour match 3"), which would otherwise
      // send it through the knockout-draw resolver, and its home side is a CLUB
      // that has no row in a two-team Test table. It counts for minutes, form
      // and the tourists' momentum; it does not count for the series.
      if (!fx.tourMatch) {
        if (fx.stage) resolveKnockoutDraw(state, fx, rng)
        applyToTable(comp, fx)
        fx.tableApplied = true
      }
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
    // a touring side's opponent can be a club (the Isles tour), which has no
    // nation key: its name goes in as itself, as compLabel reads a _k it
    // cannot find (1.8.4 career QA: "nation.crusaders 21-43 ...")
    const sideK = (id: string) => (nationByCode(id) ? `nation.${id}` : state.clubs[id]?.name ?? id)
    const sideName = (id: string) => (nationByCode(id) ? nationNameIn('en', id) : state.clubs[id]?.name ?? id)
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
        const hName = sideName(fx.homeId)
        const aName = sideName(fx.awayId)
        const shown = lines.slice(0, 4).map(l => l.text)
        const more = lines.length - shown.length
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `${hName} ${fx.homeScore}-${fx.awayScore} ${aName}: how your men got on`,
          body: shown.join('\n') + (more > 0 ? `\nAnd ${more} more of yours came through it fine.` : ''),
          k: more > 0 ? 'news.capsMore' : 'news.caps',
          v: {
            home_k: sideK(fx.homeId), away_k: sideK(fx.awayId),
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
        home_k: sideK(fx.homeId), away_k: sideK(fx.awayId),
        hs: fx.homeScore, as: fx.awayScore,
        best: lines[0].row.player as string,
        rating: lines[0].row.rating as string,
        word_k: lines[0].row.word_k as string,
        rest_k: lines.length > 1 ? 'news.campBlockRest' : 'common.nothing',
        n: lines.length - 1,
      }))
      const men = reports.reduce((n, r) => n + r.lines.length, 0)
      const v = { n: men, tests: reports.length, blocks_ll: JSON.stringify(blocks) }
      const k = telling(state, 'news.campRound')
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
        subject: tIn('en', `${k}Subj`, v),
        body: tIn('en', k, v),
        k, v,
      })
    }
  }

  // The A League runs the same weeks as the senior league, and AFTER it: a lad
  // called up to the seniors this week has had his senior game and had p.acad
  // cleared, so he cannot also turn out for the A side (feedback 10G).
  playAcademyWeek(state, rng)
  // DEADLINE DAY: the last week of each window is a circus - panic
  // listings appear at cut prices and nobody's star is safe. Filed by the
  // settle before it, so the story is on the desk for deadline week itself
  if (isDeadlineWeek(nextWeek(state.week)) && !state.unemployed) {
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
      subject: `DEADLINE DAY - the window slams shut this week`,
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
  if (isDeadlineWeek(prevWeek(state.week)) && !state.unemployed) {
    // read by the story's key and its variables, not its English (1.8.1): the
    // subject and body are stored in English for the engine, and a round-up
    // that parsed them broke the day anybody reworded a transfer story
    const deals = state.news.filter(n => n.type === 'transfer' && n.season === state.season &&
      n.week === state.week - 1 && (n.k === 'news.transferDone' || n.k === 'news.transferDoneFree') && n.playerId != null)
    if (deals.length >= 2) {
      const TIMES = ['08:10', '09:45', '11:30', '13:05', '14:40', '16:15', '18:00', '19:35', '21:10', '22:55']
      const rows: { k: string; [x: string]: string | number }[] = []
      deals.slice(0, 5).forEach((n, i) => {
        const p = state.players[n.playerId!]
        const to = p?.clubId ? state.clubs[p.clubId] : null
        if (!p || !to) return
        const fee = n.k === 'news.transferDone' && n.v?.fee != null ? String(n.v.fee) : null
        const mine = to.id === state.userClubId || n.v?.from === state.clubs[state.userClubId].name
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
        subject: `Deadline day, as it happened`,
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
      // a start is owed at the next match played (handshake.ts)
      if (pl.kind === 'start') { if (settleStartPledge(state, pl, p)) remain.push(pl); continue }
      // due past the last playing week: rollover carries it into the new season
      if (state.week < pl.due || pl.due > LAST_PLEDGE_WEEK) { remain.push(pl); continue }
      const gap = p.stats.apps - pl.baseApps
      const kept = pl.kind === 'plans' ? gap >= 2
        : pl.kind === 'minutes' ? gap >= 1
        : p.contractEnds > state.season
      const sulky = p.pers === 'Ambitious' || p.pers === 'Mercenary' || p.pers === 'Temperamental'
      rememberPromise(state, p, kept, pl.kind) // memory.ts: the squad keeps the receipts, and so does the world
      if (kept) {
        p.morale = clamp(p.morale + 1.1, 1, 10)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
          // THE PLAYER SAYS IT HIMSELF (16B, user: "if a player moans about
          // playing time and then are rewarded playing time they should thank
          // the coach for keeping their word")
          subject: `Word kept: ${p.name}`,
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
          subject: `Promise broken: ${p.name}`,
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
  // two coaches at odds: the odd story, and the end of it (staffrift.ts)
  staffRiftWeek(state)

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
      subject: `The new ${tIn('en', info.name).toLowerCase()} opens`,
      body: `The builders are gone and the ribbon is cut: your ${tIn('en', info.name).toLowerCase()} is now level ${b.level}. ${tIn('en', info.desc)} The squad found it within minutes; the coaches found it first.`,
      k: 'news.facOpens',
      v: { name_k: info.name, desc_k: info.desc, lvl: b.level },
    })
  }

  // and the stand tops out: the seats only exist once the builders are gone
  if (state.stadiumBuild && state.season * 100 + state.week >= state.stadiumBuild.done) {
    const b = state.stadiumBuild
    const uc = state.clubs[state.userClubId]
    state.stadiumBuild = null
    if (uc) {
      uc.capacity += b.seats
      // NEW CONCRETE DOES NOT LEAK. The wear-and-tear stories in upkeep.ts are
      // weighted by how long it is since anybody built anything here, and a
      // stand is the thing that resets that - which is the other half of why
      // a manager reinvests in the ground rather than banking the gate.
      uc.wear = 0
      logDecision(state, 'dec.standOpened', { stadium: uc.stadium, seats: b.seats, cap: uc.capacity }, true)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: `The new stand opens at ${uc.stadium}`,
        body: `The hoardings are down and the turnstiles are through it: ${uc.stadium} now holds ${uc.capacity.toLocaleString()}, ${b.seats.toLocaleString()} of them new. The waiting list finally moves, and every one of those seats pays its way at the gate.`,
        k: 'news.expOpened',
        v: { stadium: uc.stadium, seats: b.seats, cap: uc.capacity },
      })
    }
  }

  // the physio's red flag: a position group stripped below cover gets an
  // assistant's alert with names, timelines and the loan-market options
  const crisisPos = new Set<Pos>()
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
      for (const p of grp.pos) crisisPos.add(p)
      const downRows: Vars[] = all.filter(p => p.injury || p.bans > 0)
        .map(p => ({
          k: p.injury ? 'news.crisisInjured' : 'news.crisisBanned',
          name: p.name, wk: p.injury?.until ?? 0,
        }))
      const down = downRows.map(r => tIn('en', String(r.k), r))
      const cover = loanTargets(state).filter(p => grp.pos.includes(p.pos)).slice(0, 3)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
        subject: `Injury crisis: ${tIn('en', grp.label)}`,
        body: [
          `The physio's board makes grim reading at ${tIn('en', grp.label)}: ${fit.length} fit of ${all.length} on the books.${down.length ? ` Out: ${down.join(', ')}.` : ''}`,
          cover.length
            ? `The assistant has three calls he could make tonight - loan cover available: ${cover.map(p => `${p.name} (${p.pos}, ${p.age}, ${state.clubs[p.clubId!]?.short})`).join(', ')}.`
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
  // and the quieter word, once per spell, when a position is down to its last
  // fit specialists (owner, round 4: the depth chart no longer flags it)
  depthWatch(state, crisisPos)

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
        const apps = careerRows(p).reduce((s, c) => s + c.apps, 0) + p.stats.apps
        const tries = careerRows(p).reduce((s, c) => s + c.tries, 0) + p.stats.tries
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
          ? `Signing off: ${stars[0].name} calls time`
          : `Signing off: ${stars.map(p => p.name).join(' and ')} call time`,
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
        subject: `${p.name} tells you first: this is the last one`,
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
        const boost = loanOutBoost(state, p)
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
          ? `Loan watch: how ${out[0].name} is getting on`
          : `Loan watch: news from the feeder clubs`,
        body: [
          `The academy manager files his loan report:`,
          ...shown.map(r => tIn('en', String(r.k), r)),
          ...(rest > 0 ? [`And ${rest} more out getting their minutes.`] : []),
        ].join('\n'),
        k: out.length === 1
          ? (rest > 0 ? 'news.loanOneMore' : 'news.loanOne')
          : (rest > 0 ? 'news.loanManyMore' : 'news.loanMany'),
        v: { ...subjectVar(state.staffPeople?.academyCoach?.g), who: out[0].name, rows_ll: JSON.stringify(shown), rest },
        playerId: out.length === 1 ? out[0].id : undefined,
      })
    }
  }

  // Northern Championship lore: the Slam and the Spoon are bigger than the table
  {
    const snWks = snWeeksFor(genderOf(state))
    const sn = state.comps[snIdFor(genderOf(state))]
    const lastWk = snWks[snWks.length - 1]
    const penultWk = snWks[snWks.length - 2]
    if (sn && state.week === penultWk) {
      const leader = sortTable(sn.table)[0]
      if (leader && leader.w === 4 && leader.d === 0 && leader.l === 0) {
        const name = nationNameIn('en', leader.teamId)
        const yours = state.natTeam === leader.teamId
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `${name} are 80 minutes from a Grand Slam`,
          body: yours
            ? `Four from four, one to play. Your side stand one win from a Grand Slam - the week every coach dreams about and none sleeps through. Handle the occasion, not just the opposition.`
            : `${name} have won all four and go into the final round with a Grand Slam on the table. The whole championship stops to watch.`,
          k: yours ? 'news.slamEveYours' : 'news.slamEve',
          v: { ...nationVars(leader.teamId) },
        })
      }
    }
    if (sn && state.week === lastWk) {
      // the championship's own id, not the men's: a women's world plays w:sn,
      // and filtering on 'sn' found no fixtures there, so its Slam and its
      // Spoon went unannounced while the eve-of story above ran every year
      const fx = state.fixtures.filter(f => f.compId === sn.id)
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
            subject: `GRAND SLAM: ${name} win them all`,
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
            subject: `The Wooden Spoon goes to ${name}`,
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
          subject: `${name} are 80 minutes from a Championship clean sweep`,
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
            subject: `CLEAN SWEEP: ${name} win every Southern Championship match`,
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
      const champ = tieWinner(wcFinal)
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
          subject: `World champion${winners.length > 1 ? 's' : ''} in the building`,
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
      const won = tieWinner(wcFinal) === nat
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
          subject: deepest === 1 ? `${name}: CHAMPIONS OF THE WORLD` : `World Championship post-mortem: ${name}`,
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
        subject: youLost ? `GIANT-KILLED: ${win?.short} dump you out`
          : youWon ? `GIANT-KILLING: you dump out ${lose?.short}`
          : `GIANT-KILLING: ${win?.short} shock ${lose?.short}`,
        body: youLost
          ? `${score}. The ${state.comps[best.fx.compId]?.name ?? 'cup'} run ends at the hands of a side nobody rated - and that is exactly how the papers will write it. Cup rugby forgives nothing.`
          : youWon
            ? `${score}. Your side knocked out a club a class above on paper, and paper lost. The players cut souvenirs from the net of the changing room whiteboard; ${win?.city} will talk about this one for years.`
            : `${score} in the ${state.comps[best.fx.compId]?.name ?? 'cup'}. ${win?.name} beat a side a class above them on paper, and the whole sport smiles - except in ${lose?.city ?? 'one place'}.`,
        k: youLost ? 'news.giantLost' : youWon ? 'news.giantWon' : 'news.giantOther',
        v: {
          score, comp: state.comps[best.fx.compId]?.name ?? tIn('en', 'news.theCup'),
          win: win?.short ?? '', winName: win?.name ?? '', lose: lose?.short ?? '',
          loseCity: lose?.city ?? tIn('en', 'news.oneTown'), city: win?.city ?? '',
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
        ? tieWinner(otherSf)
        : null
      const oppName = oppId ? (state.clubs[oppId]?.name ?? nationNameIn('en', oppId)) : null
      const v = state.clubs[mine] ? finalVenue(state, sf.compId) : null
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `YOU ARE IN THE FINAL: ${compName}`,
        body: [
          `The semi-final is won and there is one game left in the ${compName}${oppName ? ` - ${oppName}, winner takes the trophy` : ''}. The supporters plan their week around it, training closes to the public, and everyone you have ever met asks about tickets.`,
          v ? `And it is at ${v.name}. ${v.capacity.toLocaleString()} people in ${v.city}, half of them yours.` : '',
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
        subject: `DERBY WEEK: ${derbyName(next.homeId, next.awayId)}`,
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
      // the coach's READ of the class (1.8.2): a teenager's ceiling is an
      // estimate, so the preview grades what he believes, not the number
      const read = (c: { name: string; pa: number }) => previewRead(state.seed, c.name, c.pa)
      const best = Math.max(...cls.map(read))
      const grade = best >= 96 ? 'A' : best >= 90 ? 'B' : best >= 82 ? 'C' : best >= 74 ? 'D' : 'E'
      const star = cls.reduce((a, b) => (read(b) > read(a) ? b : a))
      const GROUP: Record<string, string> = {
        LP: 'news.unitFront', HK: 'news.unitFront', TP: 'news.unitFront', LK: 'news.unitSecond',
        FL: 'news.unitBack', N8: 'news.unitBack', SH: 'news.unitHalf', FH: 'news.unitHalf',
        CE: 'news.unitMid', WG: 'news.unitThree', FB: 'news.unitThree',
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: `Academy preview: next summer's class`,
        body: tIn('en', 'news.intakePreview', {
          n: cls.length,
          verdict_k: `news.intakeGrade${grade}`,
          unit_k: GROUP[star.pos] ?? 'news.unitPack',
        }),
        k: 'news.intakePreview',
        v: { ...subjectVar(state.staffPeople?.academyCoach?.g), n: cls.length, verdict_k: `news.intakeGrade${grade}`, unit_k: GROUP[star.pos] ?? 'news.unitPack' },
      })
    }
  }

  // the Scouting Agency refreshes its world rankings every four weeks
  if (state.week % 4 === 2) updateAgency(state)

  // THE BOARD LOOKS AT THE TABLE THREE TIMES, not once (boardReadsTheTable
  // above). Week 24 is the half-term letter and does its own call inside that
  // block; these are the two silent ones either side of it, and the lean grows
  // because a board that has watched you slide since September is not still
  // asking itself whether it is a blip.
  //
  // THE FIRST READING IS THE LIGHTEST (1.9.0). Week 12 is five or six league
  // games in, when the table is mostly the fixture list, and at 0.8 it pulled
  // a title favourite's board a third of the way to a target near the floor:
  // a Bath picking its best XV every week lost 16 to 30 points of confidence
  // in that one week, after a WIN, and was in crisis in 8 seasons of 36
  // (autopilotprobe). Half the lean; the half-term letter and week 34 still
  // read the table at full weight.
  if (!state.unemployed && (state.week === 12 || state.week === 34)) {
    boardReadsTheTable(state, state.week === 12 ? 0.5 : 1.25)
  }

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
    boardReadsTheTable(state)
    const pred = state.preds?.[club.id]
    const diff = pred && posNow ? pred - posNow : 0
    const objs = (state.objectives ?? []).map(id => OBJECTIVE_DEFS.find(o => o.id === id)).filter(Boolean)
    const met = objs.filter(o => o!.met(state)).length
    const grade = diff >= 3 ? 'A' : diff >= 1 ? 'B' : diff === 0 ? 'C' : diff >= -2 ? 'D' : 'E'
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `Half-term report card: grade ${grade}`,
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
      // League bumped stats.apps (stats.acadApps since 1.6.5, AWARD-01) and adds
      // 0.35 of form for every win (academy.ts), and it never writes lastWk. So an academy lad who kept winning A League
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
            ? `Manager of the Month: YOU`
            : ourMan
              ? `${comp.short} awards: ${pom!.name} is Player of the Month`
              : `${comp.short} monthly awards`,
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
    const winner = tieWinner(fx)
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
    // isMyClub, not a bare id compare: after a sacking the old club goes on
    // playing every Saturday and its fixture still carries that id. Matching
    // it here found a match that was not a club match of his and not a Test
    // either, so it fell through to the international branch below and filed a
    // VICTORY/DEFEAT report - and put the result on his own W-D-L - for a team
    // he no longer picked.
    (isMyClub(state, f.homeId) || isMyClub(state, f.awayId) ||
     (state.natTeam != null && (f.homeId === state.natTeam || f.awayId === state.natTeam ||
       (islesCoach(state) && (f.homeId === 'LIO' || f.awayId === 'LIO'))))))
    ?? simmedUserFx
  if (userFx) {
    // A sacked manager's old club still plays every week, and the fixture
    // still carries his old id - but the afternoon is not his. Reading it
    // through isMyClub keeps the board reaction, the match report, the record
    // gate, the milestones and his own W-D-L off a team he does not pick.
    const isClubMatch = isMyClub(state, userFx.homeId) || isMyClub(state, userFx.awayId)
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
      if (us > them) { state.mgr.ww = (state.mgr.ww ?? state.mgr.w) + mgrWinWeight(state); state.mgr.w += 1 }
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
      stepIdentity(state) // the club's identity drifts toward how it is run (identity.ts)
    } else {
      // Test match: national duty counts on the manager's record
      const mySide = userFx.homeId === state.natTeam || userFx.homeId === 'LIO' ? userFx.homeId : userFx.awayId
      const us = userFx.homeId === mySide ? userFx.homeScore : userFx.awayScore
      const them = userFx.homeId === mySide ? userFx.awayScore : userFx.homeScore
      state.mgr.m += 1
      // a Test win carries a full weight in the weighted record too: it counted
      // as a game and never as a weighted win, so once `ww` existed every Test
      // won pulled the win rate in mgrReputation DOWN
      if (us > them) { state.mgr.ww = (state.mgr.ww ?? state.mgr.w) + 1; state.mgr.w += 1 }
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
      subject: `The assistant took the ${opp?.short ?? 'league'} match: ${us > them ? 'won' : us < them ? 'lost' : 'drew'} ${us}-${them}`,
      body: `With you away on Test duty, your assistant picked the side and ran the touchline. ${us > them
        ? 'He hands the week back with a win and an insufferable grin.'
        : us < them
        ? 'He hands the week back with an apology and a full debrief already on your desk.'
        : 'He hands the week back all square.'} The board judges the result the way it judges any other - the routines are yours even when the voice is not.`,
      k: 'news.assistantRan',
      v: {
        ...subjectVar(state.staffPeople?.assistant?.g),
        opp: opp?.short ?? tIn('en', 'news.theLeague'), us, them,
        verb_k: us > them ? 'news.assWon' : us < them ? 'news.assLost' : 'news.assDrew',
        hand_k: us > them ? 'news.assHandWin' : us < them ? 'news.assHandLoss' : 'news.assHandDraw',
      },
      fixtureId: cfx.id,
    })
  }

  // ---- A PLAYED FIXTURE THAT NEVER REACHED THE TABLE ----
  //
  // The loop that sims the week tables everything it sims. What it does not sim
  // is a match somebody already played: the manager's own, watched through
  // MatchDay, arrives here played-but-untabled, and the two blocks above settle
  // it as part of working out his afternoon.
  //
  // His OLD club's match can arrive in exactly that state. MatchDay and the
  // harnesses both reach for userFixtureThisWeek, which finds a fixture by club
  // id and knows nothing about whether he still works there - so a week out of
  // work leaves a played match that the blocks above, which are about HIS
  // afternoon and not that club's, will never table. A league whose played
  // counts do not match its fixtures is a broken league, and breakit duly found
  // it: "leicester's table says 10 played, the fixture list says 11".
  //
  // It sweeps AFTER those blocks, not before. Run first, it tabled the club
  // fixture on an assistant's Saturday, so the `!tableApplied` in the find
  // above stopped picking out the Test and the manager's own afternoon became
  // the league game - which is how testweekprobe caught the first draft of
  // this. Last, it only ever sees what nobody claimed, and a manager in work
  // has nothing for it to do.
  for (const f of state.fixtures) {
    if (f.week !== state.week || !f.played || f.tableApplied) continue
    const comp = state.comps[f.compId]
    if (!comp) continue
    if (f.stage) resolveKnockoutDraw(state, f, rng)
    applyToTable(comp, f)
    f.tableApplied = true
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
    /**
     * A CHAIRMAN WHO GAVE YOU UNTIL CHRISTMAS DOES NOT SACK YOU IN NOVEMBER
     * (v1.8.3). The board can grant more time in the boardroom, and a grant
     * that the next bad week overrides is not a grant, it is a letter. The
     * FINAL WARNING above still goes out, because the reprieve is time, not
     * absolution, and the manager should be able to feel the clock.
     *
     * Being pushed once too often is NOT covered by this: that dismissal is
     * for ignoring the board, and a stay of execution the board granted is
     * exactly the thing being ignored.
     */
    const reprieved = (state.boardGrace ?? 0) > stamp100(state)
    // ONE BAD READING IS NOT A SACKING, AND A NEW MAN GETS SOME TIME (1.8.0,
    // owner, as above). The floor has to hold for three weeks running, and in
    // his first season at the club the board waits before acting on results
    // alone. HOW LONG DEPENDS ON THE CLUB (owner: "Honeymoon period should be
    // a lot smaller if managing a top team, it should be harder as the fans
    // expect results"): week 32 at a club of reputation 50 or less, falling
    // in a straight line to week 12 at 88 or more (honeymoonEnd). The final
    // warnings above still go out, so he can feel the clock.
    state.boardFloorWeeks = club.boardConfidence <= 3 ? (state.boardFloorWeeks ?? 0) + 1 : 0
    const honeymoon = (state.tenureStart ?? -1) === state.season && state.week < honeymoonEnd(club.rep)
    // SILVERWARE BUYS TIME (1.8.14). A manager who had won the club two titles
    // was sacked inside one mid-season slump, on the same three weeks as a man
    // who had won nothing. Each trophy at this club in the last two seasons
    // adds three weeks to how long the board's confidence must sit on the floor.
    // AND A LEGACY BUYS A LITTLE MORE (1.8.15). A twenty-season soak sacked a
    // manager who had won Toulouse eleven trophies, the last of them three
    // seasons earlier, with the side fifth of fourteen and inside the playoff
    // places: two seasons is a short memory for a board he had filled the
    // cabinet for. Every four trophies at the club, ever, add three weeks more,
    // at most six; the whole allowance stays capped at nine extra weeks, so a
    // decorated manager in a real collapse still goes.
    const mine = (state.mgr?.trophies ?? []).filter(x => x.clubId === club.id)
    const silver = Math.min(3, Math.min(2, mine.filter(x => x.season >= state.season - 1).length) + Math.min(2, Math.floor(mine.length / 4)))
    if (club.boardConfidence <= 3 && state.week > 8 && !reprieved && !honeymoon && state.boardFloorWeeks >= 3 + 3 * silver) {
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
        subject: `THE BIG ONE: ${a.short} v ${b.short} for the ${comp.short}`,
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
          subject: `Finals week: the adverts have landed`,
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
        subject: `${savedShort(state, comp.champion)} win the ${comp.name}!`,
        body: `${savedShort(state, comp.champion)} defeated ${savedShort(state, final.homeId === comp.champion ? final.awayId : final.homeId)} ${Math.max(final.homeScore, final.awayScore)}-${Math.min(final.homeScore, final.awayScore)} in the ${comp.name} final.`,
        k: 'news.cupWon',
        v: {
          champ: savedShort(state, comp.champion), comp: comp.name,
          loser: savedShort(state, final.homeId === comp.champion ? final.awayId : final.homeId),
          ...natTwin(state, 'champ', comp.champion),
          ...natTwin(state, 'loser', final.homeId === comp.champion ? final.awayId : final.homeId),
          hi: Math.max(final.homeScore, final.awayScore), lo: Math.min(final.homeScore, final.awayScore),
        },
      })
      // his club's cup only while it IS his club: userClubId still names the one
      // that sacked him, and a successor's trophy was going on his record
      const clubWon = !state.unemployed && comp.champion === state.userClubId
      if (clubWon || (state.natTeam != null && comp.champion === state.natTeam)) {
        const mine = clubWon
        const hk = mine ? 'cel.champions' : 'cel.championsOf'
        const hv: Vars = mine
          ? { short: teamShort(state, state.userClubId).toUpperCase() }
          : { comp: comp.name.toUpperCase() }
        const sv = { comp: comp.name, season: seasonLabel(state.season), manager: state.managerName }
        state.celebration = {
          headline: tIn('en', hk, hv),
          sub: tIn('en', 'cel.championsSub', sv),
          icon: 'trophy',
          hk, hv, sk: 'cel.championsSub', sv,
        }
        state.mgr.trophies.push({ compId: comp.id, season: state.season, clubId: state.userClubId })
        if (mine) {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
            subject: `CHAMPIONS! The ${comp.name} is yours`,
            body: `Scenes of pure joy as ${state.clubs[state.userClubId].name} lift the ${comp.name}. ${state.clubs[state.userClubId].city} will talk about this night for years - and the board have noted exactly who delivered it.`,
            k: 'news.youWonCup', v: { comp: comp.name, club: state.clubs[state.userClubId].name, city: state.clubs[state.userClubId].city },
          })
          state.clubs[state.userClubId].boardConfidence = clamp(state.clubs[state.userClubId].boardConfidence + 20, 0, 100)
        } else {
          // a knockout his NATION won (a World Championship final): the same
          // letter the round-robin Tests send below. It used to fall into the
          // club's, which had his club lifting the World Championship and gave
          // its board the credit.
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
            subject: `CHAMPIONS! You've won the ${comp.name} with ${comp.champion}`,
            body: `A nation celebrates. Your name goes into the record books as the coach who delivered the ${comp.name}.`,
            k: 'news.youWonIntl', v: { comp: comp.name, nat: comp.champion },
          })
        }
      }
    }
    // pure round-robin comps (6N, TRC, National 1): champion = table top when all played
    if (!comp.champion && (comp.type === 'intl' || (comp.type === 'league' && !comp.playoffTeams)) && comp.table.length) {
      const all = state.fixtures.filter(f => f.compId === comp.id)
      if (all.length && all.every(f => f.played)) {
        comp.champion = sortTable(comp.table)[0].teamId
        state.history.push({ season: state.season, compId: comp.id, champion: comp.champion })
        if (comp.type === 'league' && comp.champion === state.userClubId && !state.unemployed) {
          state.mgr.trophies.push({ compId: comp.id, season: state.season, clubId: state.userClubId })
          const hv2 = { short: teamShort(state, state.userClubId).toUpperCase() }
          const sv2 = { comp: comp.name, season: seasonLabel(state.season), manager: state.managerName }
          state.celebration = {
            headline: tIn('en', 'cel.champions', hv2),
            sub: tIn('en', 'cel.championsSub', sv2),
            icon: 'trophy',
            hk: 'cel.champions', hv: hv2, sk: 'cel.championsSub', sv: sv2,
          }
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
            subject: `CHAMPIONS! The ${comp.name} title is yours`,
            body: `${state.clubs[state.userClubId].name} finish top of the pile. Promotion won, history made - ${state.clubs[state.userClubId].city} will remember this season.`,
            k: 'news.youWonLeague', v: { comp: comp.name, club: state.clubs[state.userClubId].name, city: state.clubs[state.userClubId].city },
          })
          state.clubs[state.userClubId].boardConfidence = clamp(state.clubs[state.userClubId].boardConfidence + 20, 0, 100)
        }
        const lionsWin = comp.id === isleTour(state)?.id && comp.champion === 'LIO' &&
          state.natTeam != null && ['ENG', 'IRE', 'SCO', 'WAL'].includes(state.natTeam)
        if ((state.natTeam != null && comp.champion === state.natTeam) || lionsWin) {
          state.mgr.trophies.push({ compId: comp.id, season: state.season, clubId: state.userClubId })
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
            subject: `CHAMPIONS! You've won the ${comp.name} with ${comp.champion}`,
            body: `A nation celebrates. Your name goes into the record books as the coach who delivered the ${comp.name}.`,
            k: 'news.youWonIntl', v: { comp: comp.name, nat: comp.champion },
          })
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `${savedShort(state, comp.champion)} win the ${comp.name}`,
          body: `${savedShort(state, comp.champion)} have been crowned ${comp.name} champions.`,
          k: 'news.leagueWon', v: { champ: savedShort(state, comp.champion), comp: comp.name, ...natTwin(state, 'champ', comp.champion) },
        })
      }
    }
  }

  // THE RELEGATION PLAYOFF (21A). In England the trapdoor is no longer
  // automatic: once the Championship final has crowned its winner (week 40,
  // calendar.ts), the Premier Division's bottom club hosts him in semi-final
  // week - eighty minutes for a place in the top flight, playable like any
  // other fixture when it is yours. The rollover reads this game's result
  // instead of swapping the two clubs blind; the other pyramids keep the
  // automatic trapdoor. It was week 44 until 1.6.5 (the summer camp week)
  // and finals day after that, beside the Premiership final.
  // A season built before the move still has its Championship final in 42,
  // so its playoff stays on 43, the week after.
  const champKo = state.comps['champ']?.koWeeks ?? []
  const barWeek = Math.max(BARRAGE_WEEK, (champKo[champKo.length - 1] ?? 0) + 1)
  if (state.week === barWeek - 1) {
    const prem = state.comps['prem']
    const champ = state.comps['champ']
    const already = state.fixtures.some(f => f.compId === 'prem' && f.stage === 'BAR')
    // no playoff for a place in a ringfenced league (RELEGATES, 1.6.3)
    if (prem && champ && !already && RELEGATES.includes('prem')) {
      const bottom = sortTable(prem.table).map(r => r.teamId).pop()
      const up = champ.champion ?? sortTable(champ.table)[0]?.teamId
      if (bottom && up && bottom !== up && state.clubs[bottom] && state.clubs[up]) {
        const fx: Fixture = {
          id: state.nextId++, compId: 'prem', round: 99, week: barWeek,
          homeId: bottom, awayId: up, played: false,
          homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0, stage: 'BAR',
        }
        state.fixtures.push(fx)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
          subject: `The relegation play-off: ${teamShort(state, bottom)} v ${teamShort(state, up)}`,
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
    const total = careerRows(p).reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
    const cTries = careerRows(p).reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
    const cPts = careerRows(p).reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
    // tries/points can park exactly on a number for weeks - salute once only
    const trySubj = `${p.name}: ${cTries} career tries`
    const ptsSubj = `${p.name}: ${cPts.toLocaleString()} career points`
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
    const inSave = p.stats.apps + careerRows(p).reduce((sum, c) => sum + c.apps, 0)
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
      subject: `${p.name}: ${total} career appearances`,
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
  // long (48) and ends at the last of them, so the owner's calendar lands on:
  //
  //   week 22  six months out    (26 weeks)
  //   week 35  three months out  (13 weeks)
  //   week 44  a month out       (4 weeks)
  //   week 46  a fortnight out   (2 weeks)
  //
  // The last two fall in the close season, after the finals, which is right:
  // the deals run to the end of the season, not to the end of the rugby.
  // (Those were 19, 32, 41 and 43 while the season was 45 weeks long; the
  // table below counts back from SEASON_WEEKS, so it moved with it.)
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
          + `${expiring.length > named.length ? ` and ${expiring.length - named.length} more` : ''}.`
          + ` Without new terms, they are free to talk to anyone.`,
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
      && absWeek(state.season, state.week) >= state.natCall) {
    const rep = mgrReputation(state)
    const offer = pickableNations(state)
    const picked = state.natCallNat && offer.some(([n]) => n === state.natCallNat)
      ? state.natCallNat : null
    const qualified = offer.filter(([, need]) => rep >= need)
    const nat = picked ?? (qualified.length ? qualified[qualified.length - 1] : offer[0])[0]
    state.natCall = null
    state.natCallNat = null
    state.natOffer = { nat, week: state.week }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `${nat} want you as national head coach`,
      body: `The union has been watching your work and wants you to take the national side alongside your club job - Test windows, championship campaigns, maybe a World Championship. The offer won't stay open long.`,
      k: 'news.natOffer', v: { nat },
    })
  }
  if (!state.natTeam && !state.natOffer && !state.unemployed && (state.week === 6 || state.week === 18)) {
    const rep = mgrReputation(state)
    if (rep >= 64) {
      // offers come from the best jobs you qualify for, not the whole ladder
      const eligible = pickableNations(state).filter(([, need]) => rep >= need).map(([n]) => n).slice(-5)
      if (eligible.length && rng() < 0.55) {
        const nat = eligible[Math.floor(rng() * eligible.length)]
        state.natOffer = { nat, week: state.week }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
          subject: `${nat} want you as national head coach`,
          body: `The union has been watching your work and wants you to take the national side alongside your club job - Test windows, championship campaigns, maybe a World Championship. The offer won't stay open long.`,
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
    // the verdicts still owed to the inbox, two scouting stories a week at most
    scoutDesk(state)
    // the run-in: from week 31, gaps and rivals become the story
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
                subject: `PLAY-OFFS SECURED: ${club2.short} are mathematically in`,
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
    const snId = snIdFor(genderOf(state))
    const snWeeks = snWeeksFor(genderOf(state))
    if (state.comps[snId] && snWeeks.includes(state.week)) {
      const round = state.fixtures.filter(f => f.compId === snId && f.week === state.week && f.played)
      if (round.length) {
        const order = sortTable(state.comps[snId].table)
        const leader = order[0] ? nationNameIn('en', order[0].teamId) : null
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `Northern Championship round ${snWeeks.indexOf(state.week) + 1}: the story so far`,
          body: [
            ...round.map(f => `${nationNameIn('en', f.homeId)} ${f.homeScore}–${f.awayScore} ${nationNameIn('en', f.awayId)}`),
            leader ? `\n${leader} top the table${order[0].p >= 4 ? ' with the title in sight' : ''}. The whole sport stops for this.` : '',
          ].filter(Boolean).join('\n'),
          k: leader ? 'news.snRoundLeader' : 'news.snRound',
          v: {
            n: snWeeks.indexOf(state.week) + 1,
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
    // a dressing-room question left from last week is gone (room.ts)
    roomTidy(state)
    generatePress(state, rng)
    // the dressing room's own ledger (pillar 1): incidents surface, unanswered
    // ones fester, and the senior players knock when the room has had enough
    disciplineWeek(state)
    // players who talk back (1.7.3): the four new knocks, on the office's own
    // stream, and only when nobody else is already at the door
    talkbackWeek(state)
    // press tone cools toward neutral unless you keep feeding it
    if (state.pressTone) state.pressTone = Math.abs(state.pressTone * 0.8) < 0.5 ? 0 : state.pressTone * 0.8
  }
  generateGossip(state, rng)
  memoryWeek(state) // the world reads your old decisions back (memory.ts), no rng
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
  //
  // THE WEEK'S REPAIR BILL IS RECORDED (v1.6.9), because a probe cannot
  // otherwise tell a gate from a boiler. upkeepWeek draws from the week's
  // shared rng, so anything that happened earlier in the week moves its
  // position and changes WHICH bill lands - and friendlyprobe, whose whole job
  // is to assert that a midweek friendly costs and earns exactly nothing, was
  // reading a £644k swing that was a sun-damaged stand rather than takings.
  //
  // Giving upkeep its own stream was tried first and is the better engineering
  // - a roof does not leak because the academy played on Wednesday - but it
  // re-deals every draw behind it and moved two unrelated probes on a release
  // day. Recording the charge costs nothing, moves nothing, and lets the probe
  // subtract the noise it was never trying to measure. The stream fix is worth
  // doing on a quieter afternoon.
  state.lastUpkeep = upkeepWeek(state, rng)
  // AND THE BOARD COUNTS THE WEEKS IN THE RED. After upkeep, so the week's
  // non-rugby luck is already in the balance being judged.
  debtWeek(state)
  // the board's standing monthly item, three weeks off the awards beat so the
  // two never share an inbox (boardmemo.ts)
  // the empty weeks are only empty of rugby: the rest of the world hires out its
  // clubhouse whether the manager remembers to or not
  aiCloseSeason(state)

  // the stories a club has to answer for: the gate figures, the advert nobody
  // read aloud, the kit, the breakaway that never happens, and the coach who
  // talked. One a week at most, each once a season (talkingpoints.ts).
  talkingPoints(state)

  boardMemo(state)

  // ---- THE LETTER FROM THE FOUR UNIONS ----
  // Once a season, in a tour year, and only for a manager who has met every one
  // of the owner's four conditions. It arrives as an offer with no way to ask
  // for it, which is the whole point of it.
  if (offerIsles(state)) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
      subject: `An invitation from the four unions`,
      body: `The four unions have written to you jointly. They want you to take the British & Irish Isles XV to ${isleTour(state)?.name?.replace(/^.*Tour of /, '') ?? 'the southern hemisphere'} this summer: seven provincial games and a three-Test series, one squad drawn from four countries who spend every February trying to beat each other.

There is no shortlist and no interview. They have chosen, and they are asking.

If you go, your assistant takes your national side for the duration. Nobody prepares a Test series eleven thousand miles from home and runs his own country in the same summer.`,
      k: 'news.islesOffer', v: { host: isleTour(state)?.name?.replace(/^.*Tour of /, '') ?? '' },
    })
  }

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
  // the week is out for any rival bid on the manager's targets, then the
  // backed rivals and the youth hunters move (rivalbids.ts): all hashed, no
  // draws on the shared stream
  settleRivalBids(state)
  aiTransfers(state, rng)
  rivalPushWeek(state)
  aiYouthHunt(state)
  aiFreeAgents(state)
  aiSummerMarket(state)
  aiRenewals(state, rng)
  if (!state.unemployed) aiPreContractPoach(state, rng)
  refreshVacancies(state, rng)

  // individual development focus: extra growth for up to FOCUS_SLOTS
  // youngsters, the list development.ts keeps (five from 1.8.1)
  if (!state.unemployed) {
    for (const id of focusIds(state)) {
      const p = state.players[id]
      if (!p || p.clubId !== state.userClubId || p.age > FOCUS_MAX_AGE) continue
      // the week's drivers and spell (devproject.weekGrowth, 1.8.2)
      const boost = (0.1 + state.staff.assistant * 0.04) * weekGrowth(state, p)
      if (p.ca < p.pa && rng() < boost) {
        p.ca += 1
        if (rng() < 0.6) {
          const keys = Object.keys(p.a) as (keyof typeof p.a)[]
          const k = keys[Math.floor(rng() * keys.length)]
          // the last points are the hardest (E6, ageing.ts attrOdds)
          if (attrRoll(state.seed, p.id, absWeek(state.season, state.week), k) < attrOdds(p.a[k])) p.a[k] = clamp(p.a[k] + 1, 1, 20)
        }
      }
    }
  }

  // how the mentoring pairs are getting on, every eighth week - after the
  // graduation sweep, so a finished pairing gets its send-off rather than one
  // more progress note about a course that is over
  if (!state.unemployed) {
    mentorGraduations(state)
    mentorReports(state)
    // the development staff's word on a breakthrough or a stall (devnews.ts)
    devNewsWeek(state)
    // the office's hard calls and the room's culture (room.ts): before the
    // bonds pass, whose last XV it reads to see who was left out
    roomWeek(state)
    // the dressing room's friendships, rivalries and cliques (bonds.ts)
    bondsWeek(state)
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
      // WHAT IT EARNS IS SAID HERE, NOT ON THE OBJECTIVES CARD (owner, round
      // 5: "it should be a message when you achieve it"). The money and the
      // board's favour are settled in May (rollover.ts), so the line says when.
      // Stories filed before this read 'news.objectiveMet', which stays for them.
      const head_k = `${def.textKey(state)}Head`
      const amount = fmtMoney(objectiveBonus(state.clubs[state.userClubId].budget))
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: tIn('en', 'news.objPaidSubj', { head_k }),
        body: tIn('en', 'news.objPaid', { head_k, amount }),
        k: 'news.objPaid',
        // The headline used to be the objective rendered to English and cut at
        // its colon, so the subject line was English in a French inbox. Each
        // objective has its own short form now; splitting a sentence on
        // punctuation is not a translation strategy.
        v: { head_k, amount },
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
    const next = absWeek(state.season, state.week) + 1
    // a board decision stays on Finances > The Board for the season it was
    // made in: the camp and the season's pitch are asked in weeks 1 and 2,
    // and "what did we decide?" is a question for March too
    state.press = state.press.filter(q =>
      !q.answered || next - (q.season * SEASON_WEEKS + q.week) <= PRESS_KEEP_WEEKS ||
      (isBoardroom(q) && q.season === state.season))
  }
  for (const q of state.press) {
    if (q.answered || q.topic || q.outlet === OFFICE_OUTLET) continue
    if (q.season < state.season || (q.season === state.season && q.week < state.week)) {
      q.answered = true
      q.answerLabel = 'No comment'
      q.reaction = 'The moment passed. The outlet ran the piece without you, and next week brings new questions.'
      // keyed, so the coverage list reads it in the reader's language rather
      // than the English it was filed in
      q.alk = 'press.noComment'
      q.rk = 'press.missedR'
      // Silence is not free. Ignoring the desk used to cost exactly nothing,
      // which made never opening the Press screen strictly optimal - the worst
      // live answer docks board confidence, but letting every question rot
      // docked none. Small numbers on purpose: one missed question is a shrug,
      // a season of empty chairs is a board that has stopped hearing from its
      // manager and a support that has stopped hearing from its club. Sized
      // below the worst live answer (board -0.2 on the option scale = 1.0
      // confidence) so answering badly still beats not answering at all.
      //
      // AND IN PROPORTION TO THE BOARD'S PATIENCE (1.8.1). This was the one
      // board term that ignored stature (boardPatience scales every result
      // and every table review), and in 1.8.1 it began to fire far more for
      // an absent manager: the one-question-a-week gate stopped counting the
      // office's own standing decisions as press, so the press kept asking
      // all season where two stale memos had silenced it from the first
      // month (Esher, seed 151: two expired questions a season became a
      // dozen, and the board that bottomed at 50 bottomed at 15). A small
      // club's board takes an empty chair as it takes a defeat, at its own
      // patience: a little under half the price at the weakest club in the
      // game, the full 0.8 from the middle of the pool up, never more, so a
      // bad answer still beats no answer. autopilotprobe, 36 seeds, Esher
      // sleepwalking: mean lowest confidence 45.9 before, 49.3 with this
      // (1.8.0: 48.6).
      const uc = state.clubs[state.userClubId]
      if (uc) uc.boardConfidence = clamp(uc.boardConfidence - 0.8 * Math.min(1, boardPatience(uc.rep) / 1.3), 0, 100)
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
    // a loan struck to a date goes home the week it falls due (v1.2.8)
    expireLoans(state, rng)
    state.week += 1
  }

  // trim news LAST, so the 250 ceiling holds at the end of every tick - it used
  // to sit above the advance, which let the season rollover file its honours,
  // retirements and expiries on top of a list that had already been cut
  // (1.8.2) and the development staff's notes, once filed, go before anything
  // else does: a breakthrough or a revised projection is written to be read
  // that week, and must not push a rarer story (the club's history book, a
  // record, a farewell) off the end of the inbox (devnews.ts trimDevFirst)
  // the new week's Monday notice, if the window opens or shuts on it
  postWindowNotes(state, 0)
  // the deals agreed while it was shut go through first thing on the Monday
  // it opens, before any AI club moves (1.8.15, ai.ts settlePendingDeals)
  settlePendingDeals(state)
  trimDevFirst(state, NEWS_KEEP)
  if (state.news.length > NEWS_KEEP) state.news = state.news.slice(-NEWS_KEEP)

  // the new week's opponent decides how it sets up for you, and last week's
  // takes its plan off (E9, oppcoach.ts setUpForUser): after the advance, so
  // it is the fixture the manager is about to prepare for
  setUpForUser(state, userFixtureThisWeek(state))
  // and the assistant names this week's side to the season plan, if there is
  // one and the sheet is his (seasonplan.ts)
  applyPlanSheet(state)
  // and the week's history: a former club, a legend on the other side (history.ts)
  historyPreview(state)
  flushMemoryNews(state) // memory.ts stories held through the settle take their ids now
  flushBondNews(state) // and the dressing room's (bonds.ts)
  flushIdentityNews(state) // and identity.ts's, the same way (heldnews.ts)
  arcWeek(state) // the career arc: rival coaches, ambitions, and its held stories (arc.ts)

  // (derby build-up now lives in the pre-advance block above, with the
  // all-time ledger - the old duplicate beat here was removed)
  // EVERY MAN MINTED THIS WEEK CARRIES HIS BASELINE (1.8.5 save QA). The
  // academy heirs, the youth intake and the replenish regens are built as
  // literals in rollover.ts without ca0 or hist, and migrate gives them both on
  // load - so a career reloaded mid-season measured a scholar's growth from
  // the day it was loaded (a breakthrough story, the desk's riser, the
  // development project) while the same career played on measured none until
  // the next summer, and a reloaded regen of 26 gained the pre-2025 career
  // deriveHist invents for the opening world (scripts/qa/savedet.ts). Growth
  // is measured from the week he arrives, as it is for every man buildPlayer
  // makes; his history before us is none, which is what the game already read
  // an absent one as (hist?.apps ?? 0), now written down so a load agrees.
  for (const p of Object.values(state.players)) {
    if (p.ca0 === undefined) p.ca0 = p.ca
    if (p.hist === undefined) p.hist = { apps: 0, tries: 0, points: 0 }
  }
  // the counter the save carries, after every mint this week made (1.6.4)
  state.pidNext = peekPid()
}
