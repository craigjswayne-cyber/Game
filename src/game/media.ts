import type { GameState, OfficeTopic, Player, PressItem, PressOption } from './model'
import { SEASON_WEEKS, fmtMoney, formGuide, logDecision, poss } from './model'
import { loanOut } from './loans'
import { offersFor, signOffer, type SlotId } from './commercial'
import { derbyName, isDerby } from './rivalries'
import { nationNameIn, nationVars } from './nations'
import { applyResponse } from './authority'
import { clamp, pick, type Rng } from './rng'
import { tIn, type Vars } from './i18n'

const OUTLETS = [
  'The Rugby Chronicle', 'Oval Times', 'The Breakdown Podcast', 'Rugby World Weekly',
  'The Sunday Scrum', 'Lineout Live', 'The Egg Chasers Gazette', 'Front Row Daily',
]

/** How long an answered press question stays in the room. Two weeks: the
 *  owner's rule, and about as long as anyone remembers a quote for. */
export const PRESS_KEEP_WEEKS = 2

/** Not an outlet at all: player conversations behind a closed door. */
export const OFFICE_OUTLET = "The Manager's Office"

/**
 * How long the office remembers a conversation.
 *
 * A live report: a prospect asked to go out on loan, the manager agreed, and
 * the same lad knocked again with the same speech seven days later. The office
 * was generating from squad state alone, so any player who still matched the
 * filter could be picked again the very next week - and agreeing to something
 * never changed the filter, because agreeing did nothing.
 *
 * Fourteen weeks is a third of a season: long enough that the repeat reads as
 * a man whose patience has run out rather than a bug, and short enough that
 * he does get to come back if you left him in the stand all year.
 */
export const OFFICE_COOLDOWN = 14

const absWeek = (season: number, week: number) => season * SEASON_WEEKS + week

/** Has this player raised this subject recently enough that raising it again
 *  would read as the game forgetting the last conversation? */
export function askedRecently(state: GameState, pid: number, topic: OfficeTopic): boolean {
  const now = absWeek(state.season, state.week)
  return (state.officeMemo ?? []).some(m =>
    m.pid === pid && m.topic === topic && now - absWeek(m.season, m.week) < OFFICE_COOLDOWN)
}

/** Record that he came in about it. Written when the conversation is raised,
 *  not when it is answered: ignoring a player is also an answer, and it does
 *  not entitle him to ask again next week. */
function rememberAsk(state: GameState, pid: number, topic: OfficeTopic) {
  ;(state.officeMemo ??= []).push({ pid, topic, season: state.season, week: state.week })
  // two seasons of memos is far more than the cooldown needs, and keeps the
  // save from carrying a list that only ever grows
  const cutoff = absWeek(state.season - 2, state.week)
  state.officeMemo = state.officeMemo.filter(m => absWeek(m.season, m.week) >= cutoff).slice(-200)
}

/** A question the press ask, as a key and the variables it needs.
 *
 *  The whole press room used to be built from English sentences: the question
 *  positionally, the answers as `label:`, the replies as `reaction:`. None of
 *  it was ever translated, and proseprobe's press check was looking for field
 *  names this file does not use, so it reported zero and nobody looked again.
 *
 *  A press item is SAVED and read back for weeks, so it stores keys the way
 *  news, match events and decisions already do: the stored English stays for
 *  saves written before this existed, and the screen renders the key. */
type Q = { k: string; v?: Vars }

function mk(state: GameState, q: Q, playerId: number | undefined, options: PressItem['options'], _rng: Rng): PressItem {
  // THE OUTLET IS CHOSEN WITHOUT THE SHARED RNG (v1.2.2). It was pick(rng,
  // OUTLETS), one draw per candidate built - and most candidates are built
  // only to be discarded by the one-question-per-week draw. So every room
  // added to this file shifted the random stream of every seeded simulation
  // in the game, and the night ten rooms arrived two marginal balance
  // assertions in difficultyprobe moved with it. voice() already picks a
  // question's wording with zero stream footprint for exactly this reason;
  // the outlet follows the same rule. Deterministic on the week and the
  // question, so the same story still wears different mastheads.
  let h = state.season * 31 + state.week * 7 + (playerId ?? 0) * 3
  for (let i = 0; i < q.k.length; i++) h = (h * 33 + q.k.charCodeAt(i)) >>> 0
  return {
    id: state.nextId++,
    week: state.week,
    season: state.season,
    outlet: OUTLETS[h % OUTLETS.length],
    question: tIn('en', q.k, q.v),
    qk: q.k,
    qv: q.v,
    playerId,
    options,
    answered: false,
  }
}

/** One answer on a button, and what the room says back. Both are keys; both
 *  keep their English for an item that was saved before they were. */
const opt = (o: Omit<PressOption, 'label' | 'reaction'> & { lk: string; lv?: Vars; rk: string; rv?: Vars }): PressOption =>
  ({ ...o, label: tIn('en', o.lk, o.lv), reaction: tIn('en', o.rk, o.rv) })

/** Weekly press generation for the user's club. */
export function generatePress(state: GameState, rng: Rng) {
  const club = state.clubs[state.userClubId]
  const squad = club.players.map(id => state.players[id]).filter(Boolean)
  const open = state.press.filter(p => !p.answered).length
  // deterministic voicing: the same question wears different words from week
  // to week without ever drawing on the shared rng (zero stream footprint)
  const voice = (salt: number, opts: string[]) =>
    opts[(state.season * 5 + state.week * 3 + salt) % opts.length]

  // the pre-season decision fires every season regardless of the spam gate:
  // an internal staff call, and week 1 must never lose it to a leftover
  // question from the final round of last season
  if (state.week === 1 && !state.press.some(p => p.season === state.season && p.options.some(o => o.camp))) {
    const item = mk(state,
      { k: voice(20, ['press.campQ1', 'press.campQ2']) },
      undefined, [
        opt({ morale: 0, board: 0, camp: 'heat', lk: 'press.campHeat', rk: 'press.campHeatR' }),
        opt({ morale: 0, board: 0, camp: 'home', lk: 'press.campHome', rk: 'press.campHomeR' }),
        opt({ morale: 0, board: 0, camp: 'tour', lk: 'press.campTour', rk: 'press.campTourR' }),
      ], rng)
    item.outlet = OFFICE_OUTLET
    state.press.push(item)
    return
  }

  // THE EXPECTATIONS DECISION (25C, user: "at the start of the season the
  // manager should set the expectations for the club" - the FM Mobile beat).
  // Week 2, after the camp call and before the league starts: the pundits'
  // predicted finish is on the table and the manager decides how to pitch the
  // year. The answer sets state.stance, which boardReaction reads all season -
  // aim high and every result swings the boardroom harder, keep heads down
  // and the needle is muted both ways. An internal staff call like the camp,
  // so it fires past the spam gate and survives the press-expiry sweep.
  if (state.week === 2 && !state.press.some(p => p.season === state.season && p.options.some(o => o.stance))) {
    const pred = state.preds?.[state.userClubId]
    const pred_k = pred ? 'press.punditsHave' : 'press.punditsSplit'
    // Stature: 1 = title favourite, 0 = wooden-spoon pick. The squad's read on
    // each answer scales with it (user: "if a manager picks a top team and
    // selects fight bravely against relegation then... the squad should be
    // more doubtful of their manager"). No prediction reads as mid-table.
    const leagueN = state.comps[club.leagueId]?.teamIds.length ?? 10
    const stature = pred != null && leagueN > 1 ? clamp((leagueN - pred) / (leagueN - 1), 0, 1) : 0.5
    // The war chest (user: "they get a bit more money but they best win or the
    // board will be nervous about their budget"). Released the moment the
    // manager aims high; the rollover claws it back with interest if the side
    // finishes no better than the pundits said - see rebuildSeason.
    const fund = Math.min(400_000, Math.max(100_000, Math.round((club.budget * 0.12) / 50_000) * 50_000))
    const round1 = (x: number) => Math.round(x * 10) / 10
    const item = mk(state,
      { k: voice(21, ['press.stanceQ1', 'press.stanceQ2']), v: { pred_k, pred_o: pred ?? 0 } },
      undefined, [
        opt({
          morale: round1(0.2 + 0.4 * (1 - stature)), board: 0.3, stance: 'high', fund,
          lk: 'press.stanceHigh', lv: { fund: fmtMoney(fund) },
          rk: 'press.stanceHighR',
          rv: { fund: fmtMoney(fund), room_k: stature < 0.45 ? 'press.stanceHighUnrated' : 'press.stanceHighExpected' },
        }),
        opt({ morale: 0.1, board: 0.2, stance: 'board', lk: 'press.stanceBoard', rk: 'press.stanceBoardR' }),
        opt({
          morale: round1(-0.7 * stature), board: 0, stance: 'safe',
          lk: 'press.stanceSafe', rk: 'press.stanceSafeR',
          rv: { tail_k: stature > 0.55 ? 'press.stanceSafeFancied' : 'common.nothing' },
        }),
      ], rng)
    item.outlet = OFFICE_OUTLET
    state.press.push(item)
    return
  }

  // THE MORNING AFTER SILVERWARE, THE ROOM ASKS ABOUT THE SILVERWARE (user:
  // "day after winning both prem final and champs cup - no press questions
  // about success. feels a bit odd"). A won final is the biggest day the
  // club has, and the press generator had no beat for it - the Monday after
  // a double the room was asking about a winger's form. Fires past the spam
  // gate like the other can't-miss moments; the stamp (absolute week of the
  // newest final toasted) keeps it to one toast per trophy, and a weekend
  // that lands two finals gets asked about as a double.
  {
    const absNow = state.season * SEASON_WEEKS + state.week
    const toasted = state.silverwareAsk ?? -1
    const won = state.fixtures.filter(f => {
      if (f.stage !== 'F' || !f.played) return false
      if (f.homeId !== state.userClubId && f.awayId !== state.userClubId) return false
      const abs = state.season * SEASON_WEEKS + f.week
      if (abs <= toasted || absNow - abs > 2) return false
      return f.homeId === state.userClubId ? f.homeScore > f.awayScore : f.awayScore > f.homeScore
    })
    if (won.length) {
      state.silverwareAsk = Math.max(...won.map(f => state.season * SEASON_WEEKS + f.week))
      const names = won.map(f => state.comps[f.compId]?.name ?? tIn('en', 'press.theCup'))
      const what = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
      const double = names.length > 1
      state.press.push(mk(state,
        {
          k: voice(23, double ? ['press.silverDoubleQ1', 'press.silverDoubleQ2']
            : ['press.silverOneQ1', 'press.silverOneQ2']),
          v: { what, n: names.length },
        },
        undefined, [
          opt({ morale: 0.5, board: 0.4, lk: 'press.silverGroup', rk: 'press.silverGroupR' }),
          opt({ morale: 0.3, board: 0.3, lk: 'press.silverFans', rk: 'press.silverFansR' }),
          opt({ morale: 0.2, board: 0.5, lk: 'press.silverAgain', rk: 'press.silverAgainR' }),
        ], rng))
      return
    }
  }

  if (open >= 2) return // don't spam

  // the morning after a bigger club's interest breaks, the first question
  // writes itself - and it goes straight to the top of the pile
  if (state.courtedAt === state.season * 100 + state.week - 1 && state.courtedBy) {
    const suitor = state.clubs[state.courtedBy]
    if (suitor) {
      state.press.push(mk(state,
        {
          k: voice(1, ['press.courtQ1', 'press.courtQ2', 'press.courtQ3']),
          v: { club: suitor.name, poss: poss(suitor.name) },
        },
        undefined, [
          opt({ morale: 0.5, board: 0.8, vow: true, lk: 'press.courtStay', rk: 'press.courtStayR', rv: { short: suitor.short } }),
          opt({ morale: 0.2, board: 0.3, lk: 'press.courtWork', rk: 'press.courtWorkR' }),
          opt({ morale: -0.3, board: -0.6, lk: 'press.courtNever', rk: 'press.courtNeverR' }),
        ], rng))
      return
    }
  }

  // the hearing: one of yours saw red this week and the ban is confirmed.
  // Time-sensitive, so it jumps the candidate queue like the courtship does
  {
    const f = state.fixtures.find(f =>
      f.played && f.week === state.week && (f.homeId === club.id || f.awayId === club.id))
    const rcs = f?.events?.filter(e => e.type === 'RC' && e.teamId === club.id && e.playerId != null) ?? []
    const banned = rcs.length ? state.players[rcs[rcs.length - 1].playerId!] : null
    if (banned && (banned.bans ?? 0) >= 1 && !state.press.some(p => p.options.some(o => o.appeal) && p.season === state.season && state.week - p.week <= 2)) {
      const n = banned.bans
      state.press.push(mk(state,
        { k: voice(19, ['press.banQ1', 'press.banQ2', 'press.banQ3']), v: { player: banned.name, n } },
        banned.id, [
          opt({ morale: 0.6, board: 0, appeal: true, lk: 'press.banAppeal', rk: 'press.banAppealR' }),
          opt({ morale: -0.2, board: 0.4, lk: 'press.banAccept', rk: 'press.banAcceptR' }),
          opt({ morale: 0.8, board: -0.5, lk: 'press.banBlast', rk: 'press.banBlastR' }),
        ], rng))
      return
    }
  }

  // finals week: the biggest press room of the season is not a lottery
  // entry - if the final is this week, this question is asked
  {
    const fin = state.fixtures.find(f => !f.played && f.week === state.week && f.stage === 'F' &&
      f.compId !== 'fr' && (f.homeId === club.id || f.awayId === club.id))
    if (fin && state.clubs[fin.homeId] && state.clubs[fin.awayId]) {
      const oppId = fin.homeId === club.id ? fin.awayId : fin.homeId
      const opp = state.clubs[oppId]
      const compName = state.comps[fin.compId]?.name ?? 'the cup'
      const where = fin.venue ? fin.venue.name : state.clubs[fin.homeId].stadium
      state.press.push(mk(state,
        {
          k: voice(26, ['press.finalQ1', 'press.finalQ2', 'press.finalQ3']),
          v: { comp: compName, where, opp: opp.short },
        },
        undefined, [
          opt({ morale: 0.8, board: -0.3, lk: 'press.finalWin', rk: 'press.finalWinR' }),
          opt({ morale: 0.3, board: 0.4, lk: 'press.finalRespect', rk: 'press.finalRespectR' }),
          opt({ morale: -0.2, board: 0.2, lk: 'press.finalTrap', rk: 'press.finalTrapR' }),
        ], rng))
      return
    }
  }

  const candidates: PressItem[] = []

  // hot streak player
  const hot = squad.filter(p => p.form >= 8 && p.stats.apps >= 3)
  if (hot.length && rng() < 0.6) {
    const p = pick(rng, hot)
    candidates.push(mk(state,
      { k: voice(2 + p.id, ['press.hotQ1', 'press.hotQ2', 'press.hotQ3']), v: { player: p.name, pos_k: posNounKey(p) } },
      p.id, [
        opt({ morale: 1.2, board: 0, lk: 'press.hotPraise', rk: 'press.hotPraiseR', rv: { player: p.name } }),
        opt({ morale: -0.3, board: 0.5, lk: 'press.hotFeet', rk: 'press.hotFeetR', rv: { player: p.name } }),
        // a fourth way to play it (user: "a bit more variety in press replies")
        opt({ morale: 0.6, board: 0.2, lk: 'press.hotOthers', rk: 'press.hotOthersR', rv: { player: p.name } }),
        opt({ morale: 0, board: -0.2, lk: 'press.noComment', rk: 'press.noCommentR' }),
      ], rng))
  }

  // struggling player
  const cold = squad.filter(p => p.form <= 4.5 && p.stats.apps >= 3)
  if (cold.length && rng() < 0.5) {
    const p = pick(rng, cold)
    candidates.push(mk(state,
      { k: voice(3 + p.id, ['press.coldQ1', 'press.coldQ2', 'press.coldQ3']), v: { player: p.name } },
      p.id, [
        opt({ morale: 1.4, board: -0.3, lk: 'press.coldBack', rk: 'press.coldBackR', rv: { player: p.name } }),
        opt({ morale: -1.2, board: 0.6, lk: 'press.coldAdmit', rk: 'press.coldAdmitR', rv: { player: p.name } }),
        opt({ morale: 0.9, board: -0.5, lk: 'press.coldBlame', rk: 'press.coldBlameR', rv: { player: p.name } }),
        opt({ morale: 0.2, board: 0, lk: 'press.coldNoOne', rk: 'press.coldNoOneR' }),
      ], rng))
  }

  // transfer rumour about star player
  const stars = squad.filter(p => p.ca >= 84)
  if (stars.length && rng() < 0.3) {
    const p = pick(rng, stars)
    const bigClubs = Object.values(state.clubs).filter(c => c.id !== club.id && c.rep >= club.rep)
    const suitor = bigClubs.length ? pick(rng, bigClubs) : null
    if (suitor) {
      candidates.push(mk(state,
        {
          k: voice(4 + p.id, ['press.rumourQ1', 'press.rumourQ2', 'press.rumourQ3']),
          v: { player: p.name, club: suitor.name },
        },
        p.id, [
          opt({ morale: 0.8, board: 0.3, lk: 'press.rumourNever', rk: 'press.rumourNeverR', rv: { player: p.name, short: suitor.short } }),
          opt({ morale: -1.5, board: 0, unsettle: true, lk: 'press.rumourPrice', rk: 'press.rumourPriceR', rv: { player: p.name } }),
          opt({ morale: 0.4, board: 0.1, lk: 'press.rumourAsk', rk: 'press.rumourAskR', rv: { player: p.name } }),
          opt({ morale: 0, board: 0, lk: 'press.rumourNothing', rk: 'press.rumourNothingR' }),
        ], rng))
    }
  }

  // ================================================================
  // TEN MORE ROOMS (v1.2.2, pre-launch audit: "the current press system
  // feels repetitive"). Each fires on a real state of the world, once per
  // season per subject, and every answer moves something - a player, the
  // board, the terraces (fans, new) or the team sheet itself (lock, new).
  // They join `candidates` like everything else, so the spam gate and the
  // one-question-per-week draw still apply to them.
  // ================================================================
  const askedThisSeason = (stem: string, pid?: number) =>
    state.press.some(q => q.season === state.season && (q.qk ?? '').startsWith(stem) && (pid == null || q.playerId === pid))
  const lastUser = state.fixtures
    .filter(f => f.played && f.week === state.week - 1 && (f.homeId === club.id || f.awayId === club.id) && f.compId !== 'fr')
    .sort((a, b) => b.week - a.week)[0]
  const ours = (f: { homeId: string; homeScore: number; awayScore: number }) =>
    f.homeId === club.id ? [f.homeScore, f.awayScore] : [f.awayScore, f.homeScore]
  const xvIds = club.tactic.lineup.slice(0, 15).filter((x): x is number => x != null)

  // 1. THE REFEREE - lost by five or fewer, two late penalties against
  if (lastUser?.events && !askedThisSeason('press.refereeQ')) {
    const [us, them] = ours(lastUser)
    const oppId = lastUser.homeId === club.id ? lastUser.awayId : lastUser.homeId
    const late = lastUser.events.filter(e => e.type === 'PEN' && e.teamId === oppId && e.min >= 70).length
    if (us < them && them - us <= 5 && late >= 2) {
      candidates.push(mk(state,
        { k: voice(31, ['press.refereeQ1', 'press.refereeQ2']), v: { n: late } },
        undefined, [
          opt({ morale: 0.5, board: -0.4, fans: 0.3, lk: 'press.refereeClips', rk: 'press.refereeClipsR' }),
          opt({ morale: -0.2, board: 0.4, lk: 'press.refereeOurs', rk: 'press.refereeOursR' }),
          opt({ morale: 0, board: 0, lk: 'press.refereeUnseen', rk: 'press.refereeUnseenR' }),
        ], rng))
    }
  }

  // 2. THE CONTRACT STAND-OFF - a starter in his last season, past the winter
  if (state.week >= 20) {
    const p = squad.find(q => q.contractEnds === state.season && xvIds.includes(q.id) && !q.onLoan && !askedThisSeason('press.standoffQ', q.id))
    if (p) {
      candidates.push(mk(state,
        { k: voice(32 + p.id, ['press.standoffQ1', 'press.standoffQ2']), v: { player: p.name } },
        p.id, [
          opt({ morale: 0.4, board: 0.1, lk: 'press.standoffLoved', rk: 'press.standoffLovedR', rv: { player: p.name } }),
          opt({ morale: -0.5, board: 0.3, unsettle: true, lk: 'press.standoffBigger', rk: 'press.standoffBiggerR' }),
          opt({ morale: 0, board: 0, lk: 'press.standoffBetween', rk: 'press.standoffBetweenR' }),
        ], rng))
    }
  }

  // 3. THE WEATHER - an away trip in the deep of winter
  {
    const away = state.fixtures.find(f => !f.played && f.week === state.week && f.awayId === club.id && f.compId !== 'fr')
    if (away && state.week >= 14 && state.week <= 28 && !askedThisSeason('press.weatherQ')) {
      const kicker = club.tactic.kickers?.[0] != null ? state.players[club.tactic.kickers[0]!] : null
      candidates.push(mk(state,
        { k: voice(33, ['press.weatherQ1', 'press.weatherQ2']), v: { opp: state.clubs[away.homeId]?.short ?? '' } },
        kicker?.id, [
          opt({ morale: 0.3, board: 0.1, lk: 'press.weatherKick', rk: 'press.weatherKickR' }),
          opt({ morale: 0.1, board: 0.2, lk: 'press.weatherSame', rk: 'press.weatherSameR' }),
          opt({ morale: 0, board: 0, fans: 0.2, lk: 'press.weatherCoat', rk: 'press.weatherCoatR' }),
        ], rng))
    }
  }

  // 4. THE OLD BOY - one of yours faces the club he left within two seasons
  {
    const fx = state.fixtures.find(f => !f.played && f.week === state.week && (f.homeId === club.id || f.awayId === club.id) && f.compId !== 'fr')
    const oppId = fx ? (fx.homeId === club.id ? fx.awayId : fx.homeId) : null
    const p = oppId ? squad.find(q => xvIds.includes(q.id) &&
      q.career.some(c => c.clubId === oppId && c.season >= state.season - 2) &&
      !askedThisSeason('press.oldboyQ', q.id)) : null
    if (p && oppId) {
      candidates.push(mk(state,
        { k: voice(34 + p.id, ['press.oldboyQ1', 'press.oldboyQ2']), v: { player: p.name, opp: state.clubs[oppId]?.short ?? '' } },
        p.id, [
          opt({ morale: 0.6, board: 0, fans: 0.2, lk: 'press.oldboyCelebrate', rk: 'press.oldboyCelebrateR' }),
          opt({ morale: -0.3, board: 0.2, lk: 'press.oldboyBehave', rk: 'press.oldboyBehaveR' }),
          opt({ morale: 0, board: 0, lk: 'press.oldboyFriday', rk: 'press.oldboyFridayR' }),
        ], rng))
    }
  }

  // 5. THE ACADEMY KID - nineteen or under, first start, this week
  {
    const kid = squad.find(q => q.age <= 19 && xvIds.includes(q.id) && q.stats.starts === 0 && !q.career.some(c => c.apps > 0) && !askedThisSeason('press.kidstartQ', q.id))
    if (kid) {
      const senior = squad.filter(q => q.pos === kid.pos && q.id !== kid.id && !xvIds.includes(q.id)).sort((a, b) => b.ca - a.ca)[0]
      candidates.push(mk(state,
        { k: voice(35 + kid.id, ['press.kidstartQ1', 'press.kidstartQ2']), v: { player: kid.name, pos_k: posNounKey(kid) } },
        kid.id, [
          opt({ morale: 0.7, board: 0, lk: 'press.kidstartReady', rk: 'press.kidstartReadyR', rv: { senior: senior?.name ?? '' } }),
          opt({ morale: -0.4, board: 0.1, lk: 'press.kidstartInjuries', rk: 'press.kidstartInjuriesR' }),
          opt({ morale: 0.3, board: 0, lk: 'press.kidstartFirst', rk: 'press.kidstartFirstR' }),
        ], rng))
    }
  }

  // 6. THE EMPTY SEATS - three home games under sixty per cent
  {
    const recent = state.fixtures.filter(f => f.played && f.homeId === club.id && f.compId !== 'fr' && f.att != null)
      .sort((a, b) => b.week - a.week).slice(0, 3)
    if (recent.length === 3 && recent.every(f => (f.att ?? 0) < club.capacity * 0.6) && !askedThisSeason('press.seatsQ')) {
      const empty = club.capacity - (recent[0].att ?? 0)
      candidates.push(mk(state,
        { k: voice(36, ['press.seatsQ1', 'press.seatsQ2']), v: { n: Math.round(empty / 100) * 100 } },
        undefined, [
          opt({ morale: 0, board: -0.2, fans: 0.5, lk: 'press.seatsListening', rk: 'press.seatsListeningR' }),
          opt({ morale: 0, board: -0.4, fans: -0.2, lk: 'press.seatsPrices', rk: 'press.seatsPricesR' }),
          opt({ morale: 0.1, board: 0.1, fans: 0.1, lk: 'press.seatsWin', rk: 'press.seatsWinR' }),
        ], rng))
    }
  }

  // 7. THE LEAK - a low dressing room talks; a benched starter's name is out
  {
    const avg = squad.length ? squad.reduce((a, q) => a + q.morale, 0) / squad.length : 10
    const benched = club.tactic.lineup.slice(15).filter((x): x is number => x != null).map(id => state.players[id])
      .find(q => q && q.stats.starts >= 3 && !askedThisSeason('press.leakQ', q.id))
    // NO DRAW ON THE SHARED RNG for the gate (same rule as voice(): a press
    // room that consumes a random number shifts every seeded simulation that
    // follows it, which is how two marginal balance assertions in
    // difficultyprobe flipped the night this room was added). Odd weeks only.
    if (avg < 5 && benched && (state.season * 7 + state.week) % 2 === 1) {
      candidates.push(mk(state,
        { k: voice(37 + benched.id, ['press.leakQ1', 'press.leakQ2']), v: { player: benched.name } },
        benched.id, [
          opt({ morale: -0.3, board: 0.3, lk: 'press.leakLong', rk: 'press.leakLongR' }),
          opt({ morale: 0.5, board: 0, lock: true, lk: 'press.leakStarts', rk: 'press.leakStartsR', rv: { player: benched.name } }),
          opt({ morale: 0, board: -0.2, lk: 'press.leakTalk', rk: 'press.leakTalkR' }),
        ], rng))
    }
  }

  // 8. THE MILESTONE - a hundredth game or fiftieth try for the club, on Saturday
  {
    const p = squad.find(q => {
      const apps = q.stats.apps + q.career.filter(c => c.clubId === club.id).reduce((a, c) => a + c.apps, 0)
      const tries = q.stats.tries + q.career.filter(c => c.clubId === club.id).reduce((a, c) => a + c.tries, 0)
      return xvIds.includes(q.id) && (apps === 99 || tries === 49) && !askedThisSeason('press.centuryQ', q.id)
    })
    if (p) {
      const apps = p.stats.apps + p.career.filter(c => c.clubId === club.id).reduce((a, c) => a + c.apps, 0)
      const cap = club.captain != null && club.captain !== p.id ? state.players[club.captain] : null
      candidates.push(mk(state,
        { k: voice(38 + p.id, ['press.centuryQ1', 'press.centuryQ2']), v: { player: p.name, what_k: apps === 99 ? 'press.centuryGames' : 'press.centuryTries' } },
        p.id, [
          opt({ morale: 0.8, board: 0, lk: 'press.centuryBest', rk: 'press.centuryBestR', rv: { captain_k: cap ? 'press.centuryCaptainSulks' : 'common.nothing', captain: cap?.name ?? '' } }),
          opt({ morale: 0.2, board: 0, lk: 'press.centuryConversation', rk: 'press.centuryConversationR' }),
          opt({ morale: 0.5, board: 0, fans: 0.2, lk: 'press.centuryTwoHundred', rk: 'press.centuryTwoHundredR' }),
        ], rng))
    }
  }

  // 9. THE BENCH WARMER - good enough to start, six weeks without a start
  {
    const abilities = squad.map(q => q.ca).sort((a, b) => a - b)
    const median = abilities[Math.floor(abilities.length / 2)] ?? 0
    const p = squad.find(q => q.ca >= median && !xvIds.includes(q.id) && !q.onLoan && !q.acad &&
      (q.lastWk == null || q.lastWk <= state.week - 6) && state.week > 8 && !askedThisSeason('press.benchQ', q.id))
    if (p) {
      candidates.push(mk(state,
        { k: voice(39 + p.id, ['press.benchQ1', 'press.benchQ2']), v: { player: p.name } },
        p.id, [
          opt({ morale: -0.6, board: 0.2, unsettle: true, lk: 'press.benchDoor', rk: 'press.benchDoorR' }),
          opt({ morale: 0.1, board: 0, lk: 'press.benchBuilding', rk: 'press.benchBuildingR' }),
          opt({ morale: 0.7, board: 0, lock: true, lk: 'press.benchNextWeek', rk: 'press.benchNextWeekR', rv: { player: p.name } }),
        ], rng))
    }
  }

  // 10. THE COMEBACK - fifteen down at the break, and won
  if (lastUser?.events && !askedThisSeason('press.comebackQ')) {
    const [us, them] = ours(lastUser)
    const oppId = lastUser.homeId === club.id ? lastUser.awayId : lastUser.homeId
    const pts = (e: { type: string }) => e.type === 'TRY' ? 5 : e.type === 'CON' ? 2 : (e.type === 'PEN' || e.type === 'DG') ? 3 : 0
    const ht = lastUser.events.findIndex(e => e.type === 'HT')
    const first = ht >= 0 ? lastUser.events.slice(0, ht) : lastUser.events.filter(e => e.min <= 40)
    const htUs = first.filter(e => e.teamId === club.id).reduce((a, e) => a + pts(e), 0)
    const htThem = first.filter(e => e.teamId === oppId).reduce((a, e) => a + pts(e), 0)
    if (us > them && htThem - htUs >= 15) {
      const cap = club.captain != null ? state.players[club.captain] : null
      candidates.push(mk(state,
        { k: voice(40, ['press.comebackQ1', 'press.comebackQ2']), v: { n: htThem - htUs } },
        cap?.id, [
          opt({ morale: 0.6, board: 0.1, fans: 0.4, lk: 'press.comebackCaptain', rk: 'press.comebackCaptainR', rv: { captain: cap?.name ?? '' } }),
          opt({ morale: 0.3, board: 0.3, lk: 'press.comebackTruth', rk: 'press.comebackTruthR' }),
          opt({ morale: 0.2, board: 0.2, fans: 0.1, lk: 'press.comebackRoom', rk: 'press.comebackRoomR' }),
        ], rng))
    }
  }

  // derby build-up: poke the fire or play it down
  const nextFx = state.fixtures.find(f =>
    !f.played && f.week === state.week &&
    (f.homeId === club.id || f.awayId === club.id) && isDerby(f.homeId, f.awayId))
  if (nextFx && rng() < 0.65) {
    const oppId = nextFx.homeId === club.id ? nextFx.awayId : nextFx.homeId
    const opp = state.clubs[oppId]
    candidates.push(mk(state,
      {
        k: voice(5, ['press.derbyQ1', 'press.derbyQ2', 'press.derbyQ3']),
        v: {
          derby: derbyName(nextFx.homeId, nextFx.awayId) ?? '',
          opp: opp?.short ?? '', opp_k: opp ? 'press.oppNamed' : 'press.oppThey',
          poss_k: opp ? 'press.oppNamedPoss' : 'press.oppTheir',
        },
      },
      undefined, [
        opt({ morale: 0, board: 0.4, lk: 'press.derbyFan', rk: 'press.derbyFanR' }),
        opt({ morale: 0, board: -0.2, lk: 'press.derbyJust', rk: 'press.derbyJustR' }),
        opt({ morale: 0, board: 0.2, lk: 'press.derbyPraise', rk: 'press.derbyPraiseR' }),
      ], rng))
  }

  // wonderkid hype
  const kids = squad.filter(p => p.age <= 21 && p.form >= 7 && p.stats.apps >= 2)
  if (kids.length && rng() < 0.4) {
    const p = pick(rng, kids)
    candidates.push(mk(state,
      { k: voice(6 + p.id, ['press.kidQ1', 'press.kidQ2', 'press.kidQ3']), v: { player: p.name, age: p.age } },
      p.id, [
        opt({ morale: 1.5, board: 0.2, unsettle: true, lk: 'press.kidCrown', rk: 'press.kidCrownR', rv: { player: p.name } }),
        opt({ morale: 0.3, board: 0.3, lk: 'press.kidProtect', rk: 'press.kidProtectR' }),
        opt({ morale: -0.6, board: 0.4, lk: 'press.kidEarn', rk: 'press.kidEarnR', rv: { player: p.name } }),
      ], rng))
  }

  // title-race mind games: late season, neck and neck with one rival
  const raceComp = state.comps[club.leagueId]
  if (raceComp && state.week >= 31 && rng() < 0.5) {
    const order = [...raceComp.table].sort((a, b) => b.pts - a.pts)
    const myIdx = order.findIndex(r => r.teamId === club.id)
    const rivalRow = myIdx >= 0 && myIdx <= 2
      ? (order[myIdx === 0 ? 1 : myIdx - 1] ?? null)
      : null
    const rivalClub = rivalRow && Math.abs(rivalRow.pts - order[myIdx].pts) <= 6 ? state.clubs[rivalRow.teamId] : null
    if (rivalClub) {
      candidates.push(mk(state,
        {
          k: voice(7, ['press.raceQ1', 'press.raceQ2', 'press.raceQ3']),
          v: {
            club: rivalClub.name, short: rivalClub.short,
            coach: rivalClub.coach ?? '',
            coach_k: rivalClub.coach ? 'press.coachNamed' : 'press.coachTheirs',
          },
        },
        undefined, [
          opt({ morale: 0.6, board: 0, lk: 'press.racePressure', rk: 'press.racePressureR', rv: { short: rivalClub.short } }),
          opt({ morale: 0.2, board: 0.4, lk: 'press.raceOurselves', rk: 'press.raceOurselvesR' }),
          opt({ morale: 0, board: 0.2, lk: 'press.raceFlatter', rk: 'press.raceFlatterR', rv: { short: rivalClub.short } }),
        ], rng))
    }
  }

  // unveiling: a new signing arrived this week - set his expectations
  const unveiling = state.news.find(n =>
    n.type === 'transfer' && n.season === state.season && state.week - n.week <= 1 &&
    n.playerId != null && state.players[n.playerId]?.clubId === club.id &&
    n.subject.includes(`joins ${club.name}`))
  const signing = unveiling?.playerId != null ? state.players[unveiling.playerId] : null
  if (signing && rng() < 0.7) {
    candidates.push(mk(state,
      {
        k: voice(8 + signing.id, ['press.unveilQ1', 'press.unveilQ2', 'press.unveilQ3']),
        v: { player: signing.name, pos_k: posNounKey(signing) },
      },
      signing.id, [
        opt({ morale: 1.2, board: 0.3, lk: 'press.unveilMarquee', rk: 'press.unveilMarqueeR', rv: { player: signing.name } }),
        opt({ morale: 0.4, board: 0, lk: 'press.unveilSettle', rk: 'press.unveilSettleR' }),
        opt({ morale: -0.5, board: 0.4, lk: 'press.unveilFight', rk: 'press.unveilFightR' }),
      ], rng))
  }

  // results pressure. formGuide sorts by week; a raw slice of the fixtures
  // array reads appended cup rounds out of calendar order (the Home pips bug).
  const recent = formGuide(state, club.id, 4)
  const losses = recent.filter(r => r === 'L').length
  if (losses >= 3) {
    candidates.push(mk(state,
      { k: voice(9, ['press.crisisQ1', 'press.crisisQ2', 'press.crisisQ3']), v: { n: losses, of: recent.length } },
      undefined, [
        opt({ morale: 0.4, board: 0.6, lk: 'press.crisisOwn', rk: 'press.crisisOwnR' }),
        opt({ morale: 0, board: -0.6, lk: 'press.crisisMargins', rk: 'press.crisisMarginsR' }),
        opt({ morale: -0.2, board: -0.3, lk: 'press.crisisAttack', rk: 'press.crisisAttackR' }),
      ], rng))
  }

  // discipline row: cards in the last match
  const lastFx = [...state.fixtures].reverse().find(f =>
    f.played && (f.homeId === club.id || f.awayId === club.id))
  const carded = lastFx?.events?.filter(e =>
    (e.type === 'YC' || e.type === 'RC') && e.teamId === club.id && e.playerId != null) ?? []
  if (carded.length >= 2 && rng() < 0.6) {
    const ev = carded[carded.length - 1]
    candidates.push(mk(state,
      {
        k: voice(10, ['press.cardsQ1', 'press.cardsQ2', 'press.cardsQ3']),
        v: {
          n: carded.length, player: ev.playerName ?? '',
          man_k: ev.playerName ? 'press.cardsNamed' : 'press.cardsYourMan',
          Man_k: ev.playerName ? 'press.cardsNamed' : 'press.cardsYourManCap',
        },
      },
      ev.playerId, [
        opt({ morale: 0.8, board: -0.4, lk: 'press.cardsDefend', rk: 'press.cardsDefendR' }),
        opt({ morale: -0.6, board: 0.6, lk: 'press.cardsAddress', rk: 'press.cardsAddressR' }),
        opt({ morale: 0.4, board: -0.5, lk: 'press.cardsBlame', rk: 'press.cardsBlameR' }),
      ], rng))
  }

  // the new owner has landed: the room wants your first words on him
  if (state.newOwnerUntil != null && state.newOwnerUntil - state.week >= 6 && rng() < 0.7) {
    candidates.push(mk(state,
      { k: voice(11, ['press.ownerQ1', 'press.ownerQ2', 'press.ownerQ3']) },
      undefined, [
        opt({ morale: 0.4, board: 0.3, lk: 'press.ownerRugby', rk: 'press.ownerRugbyR' }),
        opt({ morale: 0, board: 0.4, lk: 'press.ownerVision', rk: 'press.ownerVisionR' }),
        opt({ morale: 0.5, board: -0.6, lk: 'press.ownerComeGo', rk: 'press.ownerComeGoR' }),
      ], rng))
  }

  // the vultures: job speculation when the board is restless
  if (club.boardConfidence <= 42 && rng() < 0.5) {
    candidates.push(mk(state,
      { k: voice(12, ['press.vultureQ1', 'press.vultureQ2', 'press.vultureQ3']) },
      undefined, [
        opt({ morale: 0.3, board: 0.3, lk: 'press.vultureTrophies', rk: 'press.vultureTrophiesR' }),
        opt({ morale: -0.4, board: -0.3, lk: 'press.vultureBoard', rk: 'press.vultureBoardR' }),
        opt({ morale: 0.5, board: -0.1, lk: 'press.vultureLaugh', rk: 'press.vultureLaughR' }),
      ], rng))
  }

  // title run-in nerves
  const myComp = state.comps[club.leagueId]
  if (myComp && state.week >= 30 && rng() < 0.45) {
    const pos = [...myComp.table].sort((a, b) => b.pts - a.pts).findIndex(r => r.teamId === club.id) + 1
    if (pos > 0 && pos <= 2) {
      candidates.push(mk(state,
        {
          k: voice(13, ['press.runInQ1', 'press.runInQ2', 'press.runInQ3']),
          v: {
            where_k: pos === 1 ? 'press.runInTable' : 'press.runInTwo',
            pile_k: pos === 1 ? 'press.runInPile' : 'press.runInSecond',
            who_k: pos === 1 ? 'press.runInLeaders' : 'press.runInChasers',
          },
        },
        undefined, [
          opt({ morale: 0.6, board: 0.3, lk: 'press.runInTarget', rk: 'press.runInTargetR' }),
          opt({ morale: 0, board: 0.2, lk: 'press.runInOneGame', rk: 'press.runInOneGameR' }),
          opt({ morale: 0.3, board: 0.2, lk: 'press.runInPrivilege', rk: 'press.runInPrivilegeR' }),
        ], rng))
    }
  }

  // Test-window exodus. THE ANSWERS ROTATE AND THE QUESTION COOLS DOWN
  // (user: "we keep getting the international have taken 6 of players. need
  // to change up the options for response"). Three voicings already rotated,
  // but the three ANSWERS were frozen, and with no playerId the office memo
  // never cooled it - a long window could ask twice in a fortnight with the
  // same three buttons. The option set now rotates on the same deterministic
  // clock as the wording, and a stamp keeps the subject off the desk for
  // eight weeks once raised.
  const away = squad.filter(p => p.natSquad).length
  const absNow2 = state.season * SEASON_WEEKS + state.week
  if (away >= 4 && rng() < 0.5 && (state.natAskAt == null || absNow2 - state.natAskAt >= 8)) {
    state.natAskAt = absNow2
    const optionSets = [
      [
        opt({ morale: 0.4, board: 0.3, lk: 'press.intlProud', rk: 'press.intlProudR' }),
        opt({ morale: 0, board: 0.1, lk: 'press.intlCalendar', rk: 'press.intlCalendarR' }),
        opt({ morale: 0.2, board: 0, lk: 'press.intlCope', rk: 'press.intlCopeR' }),
      ],
      [
        opt({ morale: 0.5, board: 0.1, lk: 'press.intlFringe', rk: 'press.intlFringeR' }),
        opt({ morale: 0, board: 0.4, lk: 'press.intlMoney', rk: 'press.intlMoneyR' }),
        opt({ morale: 0.3, board: 0.1, lk: 'press.intlFamilies', rk: 'press.intlFamiliesR' }),
      ],
      [
        opt({ morale: 0.2, board: 0.3, lk: 'press.intlDepth', rk: 'press.intlDepthR' }),
        opt({ morale: 0.1, board: 0.2, lk: 'press.intlClub', rk: 'press.intlClubR' }),
        opt({ morale: -0.1, board: 0, lk: 'press.intlHurts', rk: 'press.intlHurtsR' }),
      ],
    ]
    const opts = optionSets[(state.season * 5 + state.week * 3 + 14) % optionSets.length]
    candidates.push(mk(state,
      { k: voice(14, ['press.intlQ1', 'press.intlQ2', 'press.intlQ3']), v: { n: away } },
      undefined, opts, rng))
  }

  // THE OTHER HAT. When the manager also coaches a nation and his squad is in
  // camp, the country's press want him too - a Test window should feel like
  // the biggest week of his year, not a line in the fixture list (user: "its
  // meant to be the pinnacle but is hidden away"). What he says here moves
  // the UNION's confidence, not the club board's - saying the country comes
  // second is heard in the federation offices, and saying it comes first is
  // heard in his own dressing room.
  // AN OPEN CAMP, NOT A FULL ONE (v1.1.17). This asked for a populated squad,
  // which was fine while the federation named it the moment the window opened.
  // The coach names it himself now and the sheet starts blank, so a length test
  // would have silenced the country's press for exactly the days they would
  // most want him - the ones where he is picking.
  if (state.natTeam && state.natSquads[state.natTeam] != null &&
      (state.natCoachAskAt == null || absNow2 - state.natCoachAskAt >= 6) && rng() < 0.6) {
    state.natCoachAskAt = absNow2
    const nv = nationVars(state.natTeam)
    candidates.push(mk(state,
      { k: voice(37, ['press.natQ1', 'press.natQ2', 'press.natQ3']), v: nv },
      undefined, [
        opt({ morale: 0, board: 0, natConf: 3, lk: 'press.natWinLot', lv: nv, rk: 'press.natWinLotR' }),
        opt({ morale: 0, board: 0.2, natConf: 0.5, lk: 'press.natTestByTest', rk: 'press.natTestByTestR' }),
        opt({ morale: 0.3, board: 0.4, natConf: -3, lk: 'press.natClubPays', rk: 'press.natClubPaysR' }),
      ], rng))
  }

  // THE RUN GETS ASKED ABOUT (user: "no questions on how we are unbeaten this
  // season"). Five league wins from five is the only story in town; a press
  // room that ignores it while asking about the Test calendar reads as deaf.
  {
    const lg = state.fixtures.filter(f => f.compId === club.leagueId && f.played &&
      (f.homeId === club.id || f.awayId === club.id))
    const allWon = lg.length >= 5 && lg.every(f =>
      f.homeId === club.id ? f.homeScore > f.awayScore : f.awayScore > f.homeScore)
    if (allWon && rng() < 0.55) {
      candidates.push(mk(state,
        { k: voice(31, ['press.unbeatenQ1', 'press.unbeatenQ2', 'press.unbeatenQ3']), v: { n: lg.length } },
        undefined, [
          opt({ morale: 0.2, board: 0.3, lk: 'press.unbeatenNothing', rk: 'press.unbeatenNothingR' }),
          opt({ morale: 0.5, board: -0.1, lk: 'press.unbeatenSayIt', rk: 'press.unbeatenSayItR' }),
          opt({ morale: 0.3, board: 0.3, lk: 'press.unbeatenStandard', rk: 'press.unbeatenStandardR' }),
        ], rng))
    }
  }

  // the manager's office: players knock on your door - but a man who has
  // already signed a pre-contract elsewhere has nothing left to ask you
  const OFFICE = OFFICE_OUTLET
  const committed = new Set((state.preContracts ?? []).map(pc => pc.playerId))

  // a frozen-out senior wants to know where he stands
  const frozen = squad.filter(p => !p.acad && p.age >= 24 && p.ca >= 68 &&
    p.morale <= 5.5 && p.stats.apps <= 2 && !p.injury && !p.onLoan && !committed.has(p.id) &&
    !askedRecently(state, p.id, 'plans') && state.week >= 10 && state.week <= 40)
  if (frozen.length && rng() < 0.35) {
    const p = pick(rng, frozen)
    const item = mk(state,
      { k: pick(rng, ['press.plansQ1', 'press.plansQ2', 'press.plansQ3']), v: { player: p.name } },
      p.id, [
        opt({ morale: 1.1, board: 0, pledge: 'plans', lk: 'press.plansIn',
          rk: pick(rng, ['press.plansInR1', 'press.plansInR2']), rv: { player: p.name } }),
        opt({ morale: -0.9, board: 0.3, unsettle: true, lk: 'press.plansOut',
          rk: pick(rng, ['press.plansOutR1', 'press.plansOutR2']), rv: { player: p.name } }),
        opt({ morale: -0.4, board: 0.2, lk: 'press.plansEarn',
          rk: pick(rng, ['press.plansEarnR1', 'press.plansEarnR2']) }),
      ], rng)
    item.outlet = OFFICE
    item.topic = 'plans'
    candidates.push(item)
  }

  // an academy prospect wants a loan
  const restless = squad.filter(p => p.acad && p.age <= 21 && p.pa >= 74 &&
    p.stats.apps <= 3 && !p.injury && !p.onLoan && !committed.has(p.id) &&
    !askedRecently(state, p.id, 'loan') && state.week >= 8 && state.week <= 34)
  if (restless.length && rng() < 0.3) {
    const p = pick(rng, restless)
    const item = mk(state,
      { k: pick(rng, ['press.loanQ1', 'press.loanQ2', 'press.loanQ3']), v: { player: p.name, age: p.age } },
      p.id, [
        opt({ morale: 0.9, board: 0, pledge: 'minutes', lk: 'press.loanMinutes',
          rk: pick(rng, ['press.loanMinutesR1', 'press.loanMinutesR2']), rv: { player: p.name } }),
        opt({ morale: 0.5, board: 0.2, loan: true, lk: 'press.loanAgree',
          rk: pick(rng, ['press.loanAgreeR1', 'press.loanAgreeR2']) }),
        opt({ morale: -0.7, board: 0, lk: 'press.loanStay',
          rk: pick(rng, ['press.loanStayR1', 'press.loanStayR2']) }),
      ], rng)
    item.outlet = OFFICE
    item.topic = 'loan'
    candidates.push(item)
  }

  // a veteran on an expiring deal wants to know what happens next
  const fading = squad.filter(p => p.age >= 32 && p.contractEnds <= state.season &&
    p.stats.apps >= 4 && !p.onLoan && !committed.has(p.id) &&
    !askedRecently(state, p.id, 'deal') && state.week >= 20 && state.week <= 38)
  if (fading.length && rng() < 0.35) {
    const p = pick(rng, fading)
    const item = mk(state,
      { k: pick(rng, ['press.dealQ1', 'press.dealQ2', 'press.dealQ3']), v: { player: p.name, age: p.age } },
      p.id, [
        opt({ morale: 1.2, board: -0.2, pledge: 'deal', lk: 'press.dealYear',
          rk: pick(rng, ['press.dealYearR1', 'press.dealYearR2']), rv: { player: p.name } }),
        opt({ morale: -1.0, board: 0.4, lk: 'press.dealLast',
          rk: pick(rng, ['press.dealLastR1', 'press.dealLastR2']) }),
        opt({ morale: -0.3, board: 0, lk: 'press.dealWait',
          rk: pick(rng, ['press.dealWaitR1', 'press.dealWaitR2']) }),
      ], rng)
    item.outlet = OFFICE
    item.topic = 'deal'
    candidates.push(item)
  }

  // post-match reaction: the result you just walked off the pitch with
  const justPlayed = state.fixtures.find(f =>
    f.played && f.week === state.week && (f.homeId === club.id || f.awayId === club.id))
  if (justPlayed && rng() < 0.6) {
    const us = justPlayed.homeId === club.id ? justPlayed.homeScore : justPlayed.awayScore
    const them = justPlayed.homeId === club.id ? justPlayed.awayScore : justPlayed.homeScore
    const oppId = justPlayed.homeId === club.id ? justPlayed.awayId : justPlayed.homeId
    const oppName = state.clubs[oppId]?.short ?? oppId
    const margin = us - them
    const derby = isDerby(justPlayed.homeId, justPlayed.awayId)
    let reaction: PressItem | null = null
    if (margin >= 25) {
      reaction = mk(state,
        { k: voice(15, ['press.routQ1', 'press.routQ2', 'press.routQ3']), v: { us, them, opp: oppName } },
        undefined, [
          opt({ morale: 0.6, board: 0.3, lk: 'press.routMore', rk: 'press.routMoreR' }),
          opt({ morale: 0.2, board: 0.2, lk: 'press.routCredit', lv: { opp: oppName }, rk: 'press.routCreditR' }),
          opt({ morale: 0, board: 0.2, lk: 'press.routMoveOn', rk: 'press.routMoveOnR' }),
        ], rng)
    } else if (margin <= -25) {
      reaction = mk(state,
        { k: voice(16, ['press.thrashQ1', 'press.thrashQ2', 'press.thrashQ3']), v: { us, them, opp: oppName, by: them - us } },
        undefined, [
          opt({ morale: 0.7, board: -0.2, lk: 'press.thrashOnMe', rk: 'press.thrashOnMeR' }),
          opt({ morale: -0.9, board: 0.4, lk: 'press.thrashUnacceptable', rk: 'press.thrashUnacceptableR' }),
          opt({ morale: 0.1, board: -0.3, lk: 'press.thrashOneDay', rk: 'press.thrashOneDayR' }),
        ], rng)
    } else if (derby && margin > 0) {
      reaction = mk(state,
        { k: voice(17, ['press.derbyWonQ1', 'press.derbyWonQ2', 'press.derbyWonQ3']) },
        undefined, [
          opt({ morale: 0.5, board: 0.3, lk: 'press.derbyWonEnjoy', rk: 'press.derbyWonEnjoyR' }),
          opt({ morale: -0.2, board: 0.3, lk: 'press.derbyWonFour', rk: 'press.derbyWonFourR' }),
          opt({ morale: 0.8, board: -0.1, unsettle: false, lk: 'press.derbyWonCity', rk: 'press.derbyWonCityR' }),
        ], rng)
    } else if (derby && margin < 0) {
      reaction = mk(state,
        { k: voice(18, ['press.derbyLostQ1', 'press.derbyLostQ2', 'press.derbyLostQ3']) },
        undefined, [
          opt({ morale: 0.4, board: 0.3, lk: 'press.derbyLostFace', rk: 'press.derbyLostFaceR' }),
          opt({ morale: 0, board: -0.4, lk: 'press.derbyLostStats', rk: 'press.derbyLostStatsR' }),
          opt({ morale: 0.3, board: 0, lk: 'press.derbyLostReturn', rk: 'press.derbyLostReturnR' }),
        ], rng)
    }
    if (reaction && state.press.filter(p => !p.answered).length < 2) state.press.push(reaction)
  }

  if (candidates.length && rng() < 0.75) {
    const chosen = candidates[Math.floor(rng() * candidates.length)]
    state.press.push(chosen)
    // the office writes its memo when the man knocks, so that whatever the
    // manager says - or does not say - he is not back next week with the
    // same speech
    if (chosen.topic && chosen.playerId != null) rememberAsk(state, chosen.playerId, chosen.topic)
    // keep press list bounded
    if (state.press.length > 40) state.press = state.press.slice(-40)
  }

  // ONE ROOM, ONE QUESTION. A live screenshot showed two outlets asking the
  // word-for-word same question in the same week. Whatever pushed it twice,
  // the room must never print it twice: the first unanswered copy of any
  // wording survives, the rest are dropped. Answered questions are history
  // and stay untouched.
  {
    const seen = new Set<string>()
    state.press = state.press.filter(q =>
      q.answered || (seen.has(q.question) ? false : (seen.add(q.question), true)))
  }
}

/** "the best FLANKER in the competition" - the everyday word for the shirt,
 *  not the position label on his profile. A key, because a French reporter
 *  asks about a troisième ligne aile. */
function posNounKey(p: Player): string {
  const map: Record<string, string> = {
    LP: 'prop', TP: 'prop', HK: 'hooker', LK: 'lock', FL: 'flanker', N8: 'number8',
    SH: 'scrumHalf', FH: 'flyHalf', CE: 'centre', WG: 'winger', FB: 'fullBack',
  }
  return `posNoun.${map[p.pos] ?? 'player'}`
}

/** Apply the chosen answer. */
export function answerPress(state: GameState, pressId: number, optionIndex: number) {
  const item = state.press.find(p => p.id === pressId)
  if (!item || item.answered) return
  const opt = item.options[optionIndex]
  if (!opt) return
  item.answered = true
  item.answerLabel = opt.label
  item.alk = opt.lk; item.alv = opt.lv
  item.reaction = opt.reaction
  item.rk = opt.rk; item.rv = opt.rv
  // a public loyalty vow goes on the record - walk it back and it walks with you
  if (opt.vow) state.vowedAt = state.season * 100 + state.week
  // the national-coach question is heard in the federation offices, not the
  // club boardroom - what it moves is the union's confidence
  if (opt.natConf && state.natConfidence != null) {
    state.natConfidence = clamp(state.natConfidence + opt.natConf, 0, 100)
  }
  // a discipline conversation: the incident machine decides whether the
  // response lands, and its verdict becomes the printed reaction
  if (opt.disc && item.incidentId != null) {
    const inc = (state.incidents ?? []).find(i => i.id === item.incidentId)
    if (inc) { const r = applyResponse(state, inc, opt.disc); item.reaction = r.text; item.rk = r.k; item.rv = r.v }
  }
  // a lodged appeal is heard the same day: deterministic verdict, no shared
  // rng - the same save always gets the same hearing
  if (opt.appeal && item.playerId != null) {
    const p = state.players[item.playerId]
    if (p) {
      const upheld = (p.id + state.season * 7 + state.week * 3) % 3 !== 0 // the club wins 2 hearings in 3
      if (upheld && p.bans > 0) {
        p.bans -= 1
        logDecision(state, 'dec.appealUpheld', { player: p.name }, true)
        // The tail is a whole clause and it pluralises, so it travels as a key
        // with `n` on it rather than as a stitched-together string: English
        // switches at one and French at two, and only the reader's dictionary
        // knows which.
        const v = {
          player: p.name, n: p.bans,
          rest_k: p.bans > 0 ? 'news.appealStillToServe' : 'news.appealFreeToPlay',
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
          subject: tIn('en', 'news.appealUpheldSubj', v),
          body: tIn('en', 'news.appealUpheld', v),
          k: 'news.appealUpheld', v,
          playerId: p.id,
        })
      } else {
        p.bans += 1
        const c = state.clubs[state.userClubId]
        c.boardConfidence = clamp(c.boardConfidence - 2, 0, 100)
        logDecision(state, 'dec.appealDismissed', { player: p.name }, false)
        const v = { player: p.name, n: p.bans }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
          subject: tIn('en', 'news.appealDismissedSubj', v),
          body: tIn('en', 'news.appealDismissed', v),
          k: 'news.appealDismissed', v,
          playerId: p.id,
        })
      }
    }
  }
  // "Agree - a loan makes sense" now agrees to a loan. It used to be a mood
  // adjustment and a note telling the manager to go and do it himself, which is
  // how a prospect came back the following week asking for the thing his boss
  // had already said yes to.
  if (opt.loan && item.playerId != null) {
    const r = loanOut(state, item.playerId)
    if (!r.ok) {
      // he is in the XV, or too old, or already out: say so rather than print a
      // reaction describing a move that did not happen
      item.rk = 'press.loanBlocked'; item.rv = { why: r.msg }
      item.reaction = tIn('en', item.rk, item.rv)
    } else {
      logDecision(state, 'dec.agreedLoan', { player: state.players[item.playerId]?.name ?? '' }, true)
    }
  }
  if (item.playerId != null) {
    const p = state.players[item.playerId]
    if (p) {
      const swing = p.pers === 'Temperamental' ? 1.7 : 1
      p.morale = clamp(p.morale + opt.morale * swing, 1, 10)
      if (opt.unsettle) p.morale = clamp(p.morale - 1, 1, 10) // agents circle an unsettled player
      // a promise made is a promise recorded - it falls due in a few weeks
      if (opt.pledge && !(state.pledges ?? []).some(pl => pl.playerId === p.id && pl.kind === opt.pledge)) {
        ;(state.pledges ??= []).push({
          playerId: p.id, kind: opt.pledge, week: state.week, season: state.season,
          due: Math.min(state.week + (opt.pledge === 'deal' ? 8 : 6), 44),
          baseApps: p.stats.apps,
        })
      }
    }
  }
  // the pre-season decision lands the same week: deterministic trade-offs
  if (opt.camp) {
    const c = state.clubs[state.userClubId]
    const squad = c.players.map(id => state.players[id]).filter((p): p is Player => !!p)
    if (opt.camp === 'heat') {
      c.balance -= 400_000
      for (const p of squad) { p.sharp = clamp(p.sharp + 12, 0, 100); p.morale = clamp(p.morale + 0.3, 1, 10) }
      logDecision(state, 'dec.campHeat', undefined, true)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.campHeatSubj'),
        body: tIn('en', 'news.campHeat'),
        k: 'news.campHeat',
      })
    } else if (opt.camp === 'home') {
      state.fanMood = clamp((state.fanMood ?? 60) + 6, 10, 95)
      for (const p of squad) p.morale = clamp(p.morale + 0.2, 1, 10)
      logDecision(state, 'dec.campHome', undefined, true)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.campHomeSubj'),
        body: tIn('en', 'news.campHome'),
        k: 'news.campHome',
      })
    } else {
      c.balance += 600_000
      state.fanMood = clamp((state.fanMood ?? 60) - 3, 10, 95)
      for (const p of squad) p.cond = clamp(p.cond - 8, 20, 100)
      logDecision(state, 'dec.campTour', undefined, false)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.campTourSubj'),
        body: tIn('en', 'news.campTour'),
        k: 'news.campTour',
      })
    }
  }
  // the summer sponsorship decision (25C): the option IS the signature.
  // offersFor is deterministic on (seed, season, slot), so the deal named on
  // the button is exactly the deal that lands; 'keep' leaves the stopgap the
  // department already took, which signOffer would let you replace any time.
  if (opt.deal && opt.deal.kind !== 'keep') {
    const offers = offersFor(state, opt.deal.slot as SlotId)
    const idx = { long: 0, short: 1, clause: 2 }[opt.deal.kind]
    if (idx != null && offers[idx]) signOffer(state, offers[idx])
  }
  // the expectations decision: the stance stands for the season and
  // boardReaction reads it on every result
  if (opt.stance) {
    state.stance = opt.stance
    const c = state.clubs[state.userClubId]
    // the war chest lands the moment the words are out - and the rollover
    // remembers exactly how much the promise was worth
    if (opt.fund) {
      c.budget += opt.fund
      state.stanceFund = opt.fund
    }
    // the whole room heard the launch speech. The option's morale figure was
    // computed against the club's stature when the question was built, and
    // this item has no playerId, so the per-player branch above never fires -
    // without this loop the squad reaction is a printed number that moves
    // nobody, which is exactly what it was for two versions.
    for (const id of c.players) {
      const p = state.players[id]
      if (p) p.morale = clamp(p.morale + opt.morale, 1, 10)
    }
    logDecision(state,
      opt.stance === 'high' ? 'dec.stanceHigh' : opt.stance === 'safe' ? 'dec.stanceSafe' : 'dec.stanceBoard',
      { fund_k: opt.fund ? 'dec.warChest' : 'common.nothing', fund: opt.fund ? fmtMoney(opt.fund) : '' },
      opt.stance !== 'safe')
  }
  const club = state.clubs[state.userClubId]
  club.boardConfidence = clamp(club.boardConfidence + opt.board * 5, 0, 100)
  // the terraces were listening too (v1.2.2)
  if (opt.fans) state.fanMood = clamp((state.fanMood ?? 60) + opt.fans * 5, 5, 98)
  // "he starts" - so he starts. The weakest man in his position makes way;
  // if nobody in the XV plays there, the last bench slot does.
  if (opt.lock && item.playerId != null) {
    const p = state.players[item.playerId]
    const xv = club.tactic.lineup.slice(0, 15)
    if (p && !xv.includes(p.id)) {
      let at = -1, worst = Infinity
      xv.forEach((id, i) => {
        const q = id != null ? state.players[id] : null
        if (q && q.pos === p.pos && q.ca < worst) { worst = q.ca; at = i }
      })
      if (at < 0) at = xv.findIndex(id => id == null)
      if (at < 0) at = 14
      const out = club.tactic.lineup[at]
      const benchAt = club.tactic.lineup.indexOf(p.id)
      club.tactic.lineup[at] = p.id
      if (benchAt >= 0) club.tactic.lineup[benchAt] = out
    }
  }

  // tone ledger: what you say in public adds up - but words behind the
  // office door are private, and never move the public needle
  if (item.outlet === OFFICE_OUTLET) return
  const prev = state.pressTone ?? 0
  if (opt.morale >= 0.5) state.pressTone = clamp(prev + 1, -6, 6)
  else if (opt.morale <= -0.5) state.pressTone = clamp(prev - 1, -6, 6)
  const tone = state.pressTone ?? 0
  if (prev < 4 && tone >= 4) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
      subject: tIn('en', 'news.toneSwaggerSubj'),
      body: tIn('en', 'news.toneSwagger'),
      k: 'news.toneSwagger',
    })
  }
  if (prev > -4 && tone <= -4) {
    for (const id of club.players) {
      const p = state.players[id]
      if (p) p.morale = clamp(p.morale - 0.5, 1, 10)
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
      subject: tIn('en', 'news.toneBruisedSubj'),
      body: tIn('en', 'news.toneBruised'),
      k: 'news.toneBruised',
    })
  }
}
