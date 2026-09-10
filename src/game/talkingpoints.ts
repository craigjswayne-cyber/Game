/**
 * ---- THE STORIES A CLUB ACTUALLY HAS TO ANSWER ----
 *
 * Owner, 7 Sep: "check rugby news for inspiration for talking points - ugly away
 * kit launch, advertising campaign goes viral for wrong reasons, low ticket
 * sales causing pressure, new breakout league threatened (doesn't ever happen)
 * rival coaches leak information about your team, playes get injured on
 * international duty occasionally."
 *
 * The wire in gossip.ts is the internet on a Monday: it is about ANY club, it
 * costs nothing and it is meant to be funny. These are different. Each one is
 * about YOUR club, each fires on a real condition rather than a die roll, and
 * each does something - money, mood, or the next match.
 *
 * A story with no consequence is set dressing. A consequence with no story is a
 * number moving for no reason. These are the two halves put together.
 *
 * ONE A WEEK AT MOST, and never the same one twice in a season. A club that has
 * its kit mocked twice in a year is a club whose news generator you can see the
 * edges of.
 *
 * ON THE INJURIES: the last of the owner's six is already in the game and needed
 * nothing. A Test is simulated by the same engine as a league match, so a man
 * away with his country can and does come back hurt, and the Word From Camp
 * report already tells you. It is listed here so the next person to read this
 * list does not build it twice.
 */
import type { GameState } from './model'
import { clamp, mulberry32 } from './rng'
import { fmtMoney } from './model'
import { tIn } from './i18n'

export type PointId = 'awaykit' | 'advert' | 'tickets' | 'breakaway' | 'breakawayEnd' | 'leak'

/** Fired once per season each, tracked so nothing repeats inside a year. */
function fired(state: GameState): Record<string, number> {
  return (state.points ??= {})
}
const already = (state: GameState, id: PointId) => fired(state)[id] === state.season
const mark = (state: GameState, id: PointId) => { fired(state)[id] = state.season }

/** How full the ground has been this season, 0-1. Competitive gates only. */
export function fillRate(state: GameState): number {
  const club = state.clubs[state.userClubId]
  if (!club?.capacity) return 1
  // competitive gates only - a friendly draws a token crowd and would drag the
  // figure down into a story about a problem the club does not have
  const games = state.fixtures.filter(f =>
    f.played && f.homeId === club.id && f.att && f.compId !== 'fr')
  if (!games.length) return 1
  const avg = games.reduce((s, f) => s + (f.att ?? 0), 0) / games.length
  return clamp(avg / club.capacity, 0, 1)
}

function push(state: GameState, id: PointId, k: string, v: Record<string, string | number>, type: 'general' | 'board' = 'general') {
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type, read: false,
    subject: tIn('en', `${k}Subj`, v),
    body: tIn('en', k, v),
    k, v,
  })
  mark(state, id)
}

/**
 * WHICH WEEK THIS STORY LANDS IN, THIS SEASON.
 *
 * The first version gated each one on a modulo of the week and the club's
 * reputation, which reads like variety and is not: for Bath the breakaway
 * expression never came out zero at all, so the story could not fire in any
 * season of any career at that club. A condition that is unreachable for some
 * clubs and constant for others is worse than a die roll.
 *
 * So the week is CHOSEN from the save's own seed, once per season per story:
 * every club gets every story, on a different week each year, and the same
 * career always plays out the same way.
 */
function weekFor(state: GameState, id: PointId, lo: number, hi: number): number {
  const h = mulberry32(state.seed + state.season * 8191 + id.length * 977 + id.charCodeAt(0) * 31)()
  return lo + Math.floor(h * (hi - lo + 1))
}

/**
 * One a week, and only one. The order is the order they are checked in, and it
 * is deliberate: the ones with money or pressure behind them get the week ahead
 * of the ones that are only a laugh.
 */
export function talkingPoints(state: GameState): void {
  if (state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  const w = state.week

  // ---- LOW TICKET SALES, AND A BOARD THAT NOTICES ----
  // The one with teeth. It reads the actual gates rather than a die: a club
  // whose ground is two-thirds empty in December is a club with a problem, and
  // the board saying so out loud is the point of the story.
  if (!already(state, 'tickets') && w >= 14 && w <= 34) {
    const fill = fillRate(state)
    const played = state.fixtures.filter(f => f.played && f.homeId === club.id && f.compId !== 'fr').length
    if (played >= 4 && fill < 0.62) {
      // HOW MUCH IT COSTS DEPENDS ON WHOSE BOARD IT IS.
      //
      // A flat six points was wrong in a way autopilotprobe caught within an
      // hour: the game deliberately keeps a giant's board brutal and a minnow's
      // patient, and a fixed penalty punished them identically - the minnow's
      // mean board confidence over a sleepwalked season fell from 48 to 39 and
      // the gap the probe defends nearly halved.
      //
      // It is also simply truer this way. Ten thousand empty seats at a club
      // that sells thirty thousand is a business problem the board will raise
      // in a meeting. The same percentage at a club that draws two thousand is
      // a quiet Saturday, and every board at that level has seen a hundred of
      // them.
      // AND BELOW A CERTAIN LEVEL IT COSTS NOTHING AT ALL. Scaling the penalty
      // was not enough on its own - the minnow's mean still sat three points
      // short of where the game had calibrated it. A small club's board raises
      // the gate figures the way it raises the price of pies: it is a thing
      // said at a meeting, not a thing anybody loses a job over. The story
      // still runs, because it is true of every club. The confidence only moves
      // where the money actually matters.
      const cost = club.rep >= 55 ? clamp(Math.round((club.rep - 40) / 6), 2, 9) : 0
      club.boardConfidence = clamp(club.boardConfidence - cost, 0, 100)
      state.fanMood = clamp((state.fanMood ?? 60) - 3, 5, 98)
      push(state, 'tickets', 'point.tickets', {
        club: club.name, pct: Math.round(fill * 100), stadium: club.stadium,
      }, 'board')
      return
    }
  }

  // ---- THE ADVERT THAT GOT AWAY ----
  // Exposure is exposure: the campaign is a disaster and the sponsor is
  // delighted, which is exactly how this goes in real life. Money in, mood down.
  if (!already(state, 'advert') && w === weekFor(state, 'advert', 8, 30)) {
    const fee = Math.round(40_000 + club.rep * 1_800)
    club.balance += fee
    state.fanMood = clamp((state.fanMood ?? 60) - 4, 5, 98)
    push(state, 'advert', 'point.advert', { club: club.name, fee: fmtMoney(fee) })
    return
  }

  // ---- THE AWAY KIT ----
  // Preseason, once. A mocked kit sells: the supporters hate it, the shop
  // cannot keep it in stock, and both of those are true at the same time.
  if (!already(state, 'awaykit') && w >= 1 && w <= 3) {
    const fee = Math.round(18_000 + club.rep * 900)
    club.balance += fee
    state.fanMood = clamp((state.fanMood ?? 60) - 2, 5, 98)
    push(state, 'awaykit', 'point.awaykit', { club: club.name, fee: fmtMoney(fee) })
    return
  }

  // ---- THE BREAKAWAY LEAGUE THAT NEVER HAPPENS ----
  // The owner was explicit: "(doesn't ever happen)". So it is a rumour with a
  // second half - it is threatened, and weeks later it collapses - because a
  // threat with no ending is a loose thread, and this particular story ALWAYS
  // ends the same way in real life.
  if (!already(state, 'breakaway') && w === weekFor(state, 'breakaway', 6, 26)) {
    push(state, 'breakaway', 'point.breakaway', { club: club.name })
    fired(state).breakawayWeek = w
    return
  }
  if (fired(state).breakaway === state.season && !already(state, 'breakawayEnd')
    && w >= (fired(state).breakawayWeek ?? 0) + 5) {
    push(state, 'breakawayEnd', 'point.breakawayEnd', { club: club.name })
    return
  }

  // ---- A RIVAL COACH TALKS ----
  // The only one that reaches the pitch. Somebody has told a journalist how you
  // play, and the team you meet next has read it. It is a small edge and it is
  // a real one; see prepLeak in matchEngine.
  if (!already(state, 'leak') && w === weekFor(state, 'leak', 10, 38)) {
    state.leaked = state.week
    push(state, 'leak', 'point.leak', { club: club.name })
    return
  }
}

/** Has this week's opponent been handed your homework? */
export const prepLeaked = (state: GameState) => state.leaked === state.week
