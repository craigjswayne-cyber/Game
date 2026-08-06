// The game-time expectations ledger (F18).
//
// A squad is thirty-odd men and only twenty-three of them get a shirt each week,
// which is the oldest problem in the job. The game modelled the consequence of
// that in exactly one place: a promise made in the office, settled on a due week.
// So a first-choice tighthead could sit out four months without a word, and the
// only way anyone ever complained about minutes was if you had specifically
// promised them.
//
// This is the standing version. Every man at the club has an understanding of
// where he sits, set when he signs and adjustable any week. The ledger compares
// what he was told to what the team sheets actually say, and his mood follows the
// gap. Meet the expectation and he is content; ignore a key man and he is in the
// office by Christmas.
//
// Two deliberate limits:
//
//   It applies to the user's club only. The ledger is a management instrument,
//   not a law of physics, and running it across 101 AI squads would move world
//   morale (and therefore world scoring) for no gain anyone can see.
//
//   It is symmetric. Keeping your side of the understanding lifts morale as much
//   as breaking it costs, so a manager who selects honestly is rewarded rather
//   than merely spared.

import type { Club, GameState, Player } from './model'
import { clamp } from './rng'

export type SquadStatus = 'key' | 'rotation' | 'squad' | 'prospect' | 'fringe'

export interface StatusDef {
  id: SquadStatus
  name: string
  /** what he was told, in words */
  desc: string
  /** share of the club's matches he expects to appear in */
  share: number
}

export const STATUSES: StatusDef[] = [
  { id: 'key', name: 'Key Player', desc: 'He starts unless he is injured. Sit him and he wants to know why.', share: 0.70 },
  { id: 'rotation', name: 'Rotation', desc: 'In and out of the side, and he knows it. Roughly every other week.', share: 0.45 },
  { id: 'squad', name: 'Squad Player', desc: 'Cover and a bench shirt. A quarter of the matches keeps him happy.', share: 0.25 },
  { id: 'prospect', name: 'Prospect', desc: 'Learning his trade. A handful of appearances a season is progress.', share: 0.12 },
  { id: 'fringe', name: 'Not In Plans', desc: 'He has been told where he stands. He expects nothing and may want out.', share: 0.0 },
]

export const STATUS_BY_ID: Record<string, StatusDef> =
  Object.fromEntries(STATUSES.map(s => [s.id, s]))

/** What a man assumes, before anybody tells him otherwise.
 *
 *  Read off his standing in the squad rather than stored at generation, so an
 *  existing save and a new signing both get a sane answer with no migration. */
export function defaultStatus(state: GameState, club: Club, p: Player): SquadStatus {
  // An academy man is not in this queue at all. His rugby is the A League, every
  // week, under the academy coach (feedback 10G) - he is not sitting at home
  // counting first-team appearances, so he expects none of them and 'fringe' is
  // the honest reading. Before this, 27 scholars each quietly demanded a 0.12
  // share and three of the 23 shirts a week were promised to schoolboys.
  if (p.acad) return 'fringe'
  // Ranked against the SENIOR squad, for the same reason. Ranking against all 65
  // registered players meant the academy's low abilities pushed every senior up
  // the order: a squad player read as top-35% and became a KEY man, and the
  // humanprobe caught the club promising 26.8 of its 23 shirts every week.
  const squad = club.players.map(id => state.players[id]).filter(x => x && !x.acad)
  if (!squad.length) return 'squad'
  const better = squad.filter(x => x.ca > p.ca).length
  const rank = better / squad.length
  if (p.age <= 21 && p.ca < 70) return 'prospect'
  if (rank <= 0.35) return 'key'
  if (rank <= 0.60) return 'rotation'
  if (rank <= 0.85) return 'squad'
  return 'prospect'
}

export function statusOf(state: GameState, club: Club, p: Player): SquadStatus {
  const s = p.status
  return s && STATUS_BY_ID[s] ? s : defaultStatus(state, club, p)
}

/** Matches this club has actually played this season - the denominator. */
export function clubMatchesPlayed(state: GameState, clubId: string): number {
  let n = 0
  for (const fx of state.fixtures) {
    if (!fx.played || fx.week > state.week) continue
    if (fx.homeId === clubId || fx.awayId === clubId) n++
  }
  return n
}

export interface LedgerRow {
  p: Player
  status: SquadStatus
  /** appearances he was entitled to expect by now */
  expected: number
  actual: number
  /** negative means short-changed */
  gap: number
  /** his reading of it, in one word */
  mood: 'happy' | 'content' | 'restless' | 'unhappy'
}

export function ledgerRow(state: GameState, club: Club, p: Player, played: number): LedgerRow {
  const status = statusOf(state, club, p)
  const share = STATUS_BY_ID[status].share
  // Long-term injury is nobody's broken promise: the weeks he could not have
  // played are taken out of what he was entitled to expect.
  const out = p.injury ? Math.min(played, p.injury.weeks ?? 0) : 0
  const expected = Math.round(Math.max(0, played - out) * share)
  const actual = p.stats.apps
  const gap = actual - expected
  const mood: LedgerRow['mood'] =
    gap >= 2 ? 'happy'
    : gap >= -1 ? 'content'
    : gap >= -4 ? 'restless'
    : 'unhappy'
  return { p, status, expected, actual, gap, mood }
}

export function ledger(state: GameState, club: Club): LedgerRow[] {
  const played = clubMatchesPlayed(state, club.id)
  return club.players
    .map(id => state.players[id])
    .filter(Boolean)
    .map(p => ledgerRow(state, club, p, played))
    .sort((a, b) => a.gap - b.gap)
}

/** The weekly drift. Called once a week for the user's club.
 *
 *  Grace period matters: nobody sulks in September because he has one start from
 *  two. The ledger only bites once there is a sample worth arguing about, which
 *  is why it waits for six matches. */
export function settleGameTime(state: GameState) {
  if (state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  const played = clubMatchesPlayed(state, club.id)
  if (played < 6) return
  // A man in this week's twenty-three has nothing to raise this week, and that
  // exclusion is what makes the whole ledger safe to attach to morale.
  //
  // Morale is the engine's own input: it reads the starting XV's average. Any
  // drift that reaches the XV is therefore a hidden adjustment to team strength,
  // and measurement showed it either way round - a penalty that touched rotated
  // and injured starters cost the user 1.9 points a game, an equal reward handed
  // back 3.3 points of margin. Restricting the drift to men who are not in the
  // side keeps the consequence exactly where it belongs: on the players with a
  // grievance, surfacing through transfer requests, the office and contract
  // talks rather than through the scoreline.
  const named = new Set(club.tactic.lineup.filter((x): x is number => x != null))
  for (const id of club.players) {
    const p = state.players[id]
    if (!p || p.onLoan || named.has(p.id)) continue
    // The two directions cannot be mechanically equal, and it took two
    // measurements to see why.
    //
    // Attempt one allowed -0.3 against +0.2 and only applied the personality
    // multiplier to the downside. That made the ledger a standing tax: across a
    // ten-season sim the user's club fell from 27.1 points a game to 25.1,
    // because a squad always has more men below the twenty-three than in it.
    //
    // Attempt two made the caps equal at 0.25. That overshot the other way,
    // 28.7 for and 23.5 against, and the reason is exposure rather than
    // arithmetic: the engine reads the STARTING XV's average morale, and the
    // starting XV is by definition the over-served group. An equal reward is
    // therefore worth far more than an equal punishment, and picking your best
    // side becomes a free three points of margin.
    //
    // So: being picked as expected is the baseline and pays nothing. Only a man
    // getting materially more than he was promised lifts, and modestly. Being
    // short-changed costs in full, and it costs men who are not in the XV, which
    // is where it belongs - it surfaces as transfer requests, office visits and
    // form rather than as a hidden penalty on the team you actually field.
    const row = ledgerRow(state, club, p, played)
    if (row.status === 'fringe') continue // he was told, and he expects nothing
    // A LEVEL he settles at, not a slope he slides down.
    //
    // Every accumulating version of this failed measurement, and the reason is
    // the same each time: a man permanently outside the twenty-three drifts one
    // way forever. He bottoms out at morale 1 and stays there, and because the
    // reserves are the pool injuries and suspensions draw from, the entire squad
    // rots by degrees. Ten seasons of that cost the user two points a game.
    //
    // A short-changed squad player is not suicidal, he is disgruntled, and
    // disgruntled has a floor. So the ledger names the morale his situation
    // justifies and pulls him gently toward it, which settles rather than sinks.
    const sulky = p.pers === 'Ambitious' || p.pers === 'Mercenary' || p.pers === 'Temperamental'
    const loyal = p.pers === 'Loyal' || p.pers === 'Professional'
    const bite = sulky ? 1.25 : loyal ? 0.8 : 1
    const target = clamp(6.8 + row.gap * 0.35 * bite, 2.5, 9)
    // and it only argues in the direction the team sheets justify: it never
    // talks a man out of a good mood he earned somewhere else
    const pull = (row.gap < 0 && p.morale > target) || (row.gap >= 3 && p.morale < target)
    if (!pull) continue
    p.morale = clamp(p.morale + (target - p.morale) * 0.07, 1, 10)
  }
}

/** Twice a season the assistant puts the ledger in front of you.
 *
 *  One inbox item, at the two points in a season where it can still be fixed.
 *  A weekly nag would be noise and the news budget is already tight. */
export function gameTimeReview(state: GameState): void {
  if (state.unemployed) return
  if (state.week !== 14 && state.week !== 26) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  const rows = ledger(state, club).filter(r => r.status !== 'fringe' && r.gap <= -3).slice(0, 5)
  if (!rows.length) return
  const asst = state.staffPeople?.assistant?.name ?? 'Your assistant'
  const lines = rows.map(r => {
    const d = STATUS_BY_ID[r.status]
    return `${r.p.name} (${d.name.toLowerCase()}, ${r.p.pers.toLowerCase()}): ${r.actual} appearance${r.actual === 1 ? '' : 's'} against ${r.expected} he was led to expect.`
  })
  const worst = rows[0]
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
    subject: `📋 Game time: ${rows.length} men are not getting what they were told`,
    body: [
      `${asst} has been through the team sheets, and there is a conversation coming whether you have it or not.`,
      '',
      ...lines,
      '',
      worst.mood === 'unhappy'
        ? `${worst.p.name} is the one to watch. Another month of this and he will be knocking on your door, or his agent will be knocking on somebody else's.`
        : `None of them has downed tools yet. Selection or an honest word about where they stand will settle it.`,
      `You can change what a man is told on the Squad page under Game Time. Telling him the truth costs less than letting him find out.`,
    ].join('\n'),
    playerId: worst.p.id,
  })
}
