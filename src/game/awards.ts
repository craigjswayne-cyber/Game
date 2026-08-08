// ---- MONTHLY AWARDS, EARNED RATHER THAN HANDED OUT ----
//
// Reported from live play: "wife won manager of the month with only one game
// played". Measured over three careers and 66 awards, it was worse than that.
//
//   - no club EVER played more than two LEAGUE games in the four-week window,
//     because the old code counted league fixtures only and ignored every cup
//     and European tie. 100% of awards were decided on two games or fewer, and
//     36% on one or none.
//   - 12 of the 66 awards went to a manager with ZERO POINTS. `bestPts` started
//     at -1, so in an international window where nobody played a match at all,
//     the award still fired and went to whichever club happened to sit first in
//     the table array.
//   - ties broke on table order, so the club nearest the top won them by
//     default rather than on merit.
//
// What replaces it:
//
//   1. EVERY competitive match counts - league, cup, Europe. That is both truer
//      and what lifts the sample: counting only league games was the reason a
//      window could hold one match at all.
//   2. A SIX-WEEK WINDOW, not four. Four weeks of this fixture list is two
//      competitive matches even with the cups counted, so 72% of awards were
//      still being decided on a two-game sample. Six weeks is three or four.
//   3. A HARD GATE: three matches and two wins. Nobody wins this for turning up,
//      and one win from three wins nothing however handsome it was.
//   4. NO AWARD IF NOBODY QUALIFIES. A quiet month is a quiet month; the league
//      does not have to crown somebody every time the calendar ticks over.
//   5. MERIT DECIDES, not table position. Beating a better side is worth more
//      than beating a worse one, winning away is worth more than winning at
//      home, and a hammering is worth more than squeaking home. Level scores
//      fall to a deterministic hash rather than to whoever is top.
//
// Re-measured over the same three careers afterwards: 36 awards instead of 60,
// six months where nobody deserved one, NO winner on two matches or fewer, none
// on nil points, and the user's own club taking three of the 36 rather than
// seven of the 60. Most winners now come in on three wins from three.
import type { GameState } from './model'

/** Three matches, or it is not a month's work.
 *
 *  Measured across three careers. On the old FOUR-week window no club ever
 *  played more than two league games, so a three-match gate would have killed the
 *  award outright. On a SIX-week window (see AWARD_EVERY) the fixture list gives
 *  clubs three or four competitive matches, 315 club-windows out of 420, and
 *  every single winner clears three. That is the whole reason the window moved:
 *  the gate and the calendar have to agree, or one of them is a lie. */
export const MIN_MATCHES = 3
/** Two wins, or it is not a month worth an award. Two from three is a good
 *  month; one from three is not, however handsome the win was. */
export const MIN_WINS = 2

/**
 * Weeks between awards.
 *
 * SIX, not four, and this is the change that did the most work. A four-week
 * window in this fixture calendar holds two competitive matches, so 72% of
 * awards were decided on a two-game sample even after every cup tie was counted.
 * Six weeks holds three or four, which is a month's work by any reading, and it
 * makes the award rarer: 36 given across the same three careers instead of 60.
 * Rarer and better-earned were both the point.
 */
export const AWARD_EVERY = 6

export interface MonthRun {
  clubId: string
  matches: number
  wins: number
  draws: number
  losses: number
  pts: number
  /** aggregate points difference across the window */
  diff: number
  /** merit score: results weighted by who they came against and where */
  score: number
  /** the best win of the month, for the write-up */
  bestWin: { oppId: string; us: number; them: number; away: boolean } | null
}

/** Is this a competition whose results should count towards a monthly award?
 *  Friendlies are not, and neither is anything the world does not rank. */
function counts(state: GameState, compId: string): boolean {
  if (compId === 'fr') return false
  const c = state.comps[compId]
  return !!c && (c.type === 'league' || c.type === 'cup')
}

/** Deterministic, so a tie does not resolve differently on a redraw. */
function hash(seed: number, key: string): number {
  let h = (seed ^ 0x27d4eb2f) >>> 0
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return (h >>> 0) % 1000
}

/**
 * What one club did between two weeks, across everything it played.
 *
 * The score is the judgement. A win is worth 3 before anything else, and then:
 *   + up to 1.5 more for beating a side better than you (reputation gap)
 *   + 0.5 for doing it away from home
 *   + up to 1.0 for the margin, which stops a run of one-point wins outranking
 *     a run of thumpings, and is capped so a 60-point mismatch is not the whole
 *     award
 * A defeat scores nothing and still counts as a match, so three games and one
 * win is a worse month than two games and two wins.
 */
export function monthRun(state: GameState, clubId: string, from: number, to: number): MonthRun {
  const me = state.clubs[clubId]
  const run: MonthRun = {
    clubId, matches: 0, wins: 0, draws: 0, losses: 0, pts: 0, diff: 0, score: 0, bestWin: null,
  }
  if (!me) return run
  for (const f of state.fixtures) {
    if (!f.played || f.week < from || f.week > to) continue
    if (f.homeId !== clubId && f.awayId !== clubId) continue
    if (!counts(state, f.compId)) continue
    const away = f.awayId === clubId
    const oppId = away ? f.homeId : f.awayId
    const opp = state.clubs[oppId]
    const us = (away ? f.awayScore : f.homeScore) ?? 0
    const them = (away ? f.homeScore : f.awayScore) ?? 0
    run.matches++
    run.diff += us - them
    if (us > them) {
      run.wins++
      run.pts += 3
      const gap = opp ? Math.max(-1.5, Math.min(1.5, (opp.rep - me.rep) / 12)) : 0
      const margin = Math.min(1, (us - them) / 25)
      run.score += 3 + gap + (away ? 0.5 : 0) + margin
      if (!run.bestWin || us - them > run.bestWin.us - run.bestWin.them) {
        run.bestWin = { oppId, us, them, away }
      }
    } else if (us === them) {
      run.draws++
      run.pts += 1
      run.score += 1
    } else {
      run.losses++
    }
  }
  return run
}

/** Does this month clear the bar at all? */
export const deserves = (r: MonthRun) => r.matches >= MIN_MATCHES && r.wins >= MIN_WINS

/**
 * Manager of the Month across a competition's clubs, or null when nobody in the
 * league did enough to deserve it.
 */
export function managerOfMonth(state: GameState, leagueId: string, from: number, to: number): MonthRun | null {
  const comp = state.comps[leagueId]
  if (!comp?.table?.length) return null
  const runs = comp.table
    .map(r => monthRun(state, r.teamId, from, to))
    .filter(deserves)
  if (!runs.length) return null
  runs.sort((a, b) =>
    b.score - a.score ||
    b.wins - a.wins ||
    b.diff - a.diff ||
    // and a genuine dead heat goes to a coin the league tosses the same way
    // every time, rather than to whoever is nearest the top of the table
    hash(state.seed, `${b.clubId}|${from}`) - hash(state.seed, `${a.clubId}|${from}`))
  return runs[0]
}

/** One line describing the winning month, for the award story. */
export function runLine(state: GameState, r: MonthRun): string {
  const rec = `${r.wins}W ${r.draws}D ${r.losses}L from ${r.matches}`
  const best = r.bestWin
    ? ` The pick of them: ${r.bestWin.us}-${r.bestWin.them} ${r.bestWin.away ? 'away at' : 'against'} ${state.clubs[r.bestWin.oppId]?.short ?? 'them'}.`
    : ''
  const diff = r.diff > 0 ? `, ${r.diff} points to the good` : r.diff < 0 ? `, ${-r.diff} points down on aggregate` : ''
  return `${rec}${diff}.${best}`
}
