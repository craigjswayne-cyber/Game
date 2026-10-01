/**
 * ---- THE CAREER ARC: THE HOOKS ----
 *
 * Where the rest of the game calls in (arcbook.ts says what the arc is). Each
 * is one line at its call site:
 *
 *   arcAfterMatch    season.ts afterClubMatch (competitive club matches)
 *   arcWeek          season.ts processWeekAndAdvance, after the advance
 *   arcYearEnd       rollover.ts rebuildSeason, while the season still stands
 *   arcBeforeMove / arcAfterMove / arcLeaveJob   jobs.ts
 *   eraSigning       records.ts offerSigning
 *   coachSacked / coachAppoint                   jobs.ts refreshVacancies
 *   coachStakes      stakes.ts matchStakes
 *   chairSwing       season.ts boardReaction
 *   demandedFinish   every reader of the board's aim for the manager's club
 *   chairAskTilt     boardroom.ts boardRequests
 *   chairMemoRow     boardmemo.ts
 *   migrateArc       save.ts migrate
 */
import type { Fixture, GameState } from './model'
import { ARC_OFF, arcFile, arcOf, flushArcNews, onceArc } from './arcbook'
import { coachAfterMatch, coachWeek, coachYearEnd } from './rivalcoach'
import { closeEra, eraAfterMatch, eraYearEnd, openEra, tellEra } from './erastory'
import { announceTraits, conductRow, notePattern, reputeYearEnd } from './repute'
import { ambitionsWeek } from './ambitions'
import { boardSummer, newChairman } from './chairman'
import { ARC_CAPS } from './arcbook'

export function arcAfterMatch(state: GameState, fx: Fixture): void {
  if (ARC_OFF.on || state.unemployed || fx.compId === 'fr') return
  coachAfterMatch(state, fx)
  eraAfterMatch(state, fx)
  notePattern(state)
}

export function arcWeek(state: GameState): void {
  if (ARC_OFF.on) return
  coachWeek(state)
  if (!state.unemployed) {
    openEra(state)
    ambitionsWeek(state)
    // a takeover seats a different kind of man in the chair
    if (state.newOwnerUntil != null && onceArc(state, `owner:${state.userClubId}`)) newChairman(state, state.userClubId)
  }
  flushArcNews(state)
}

export function arcYearEnd(state: GameState): void {
  if (ARC_OFF.on) return
  const a = arcOf(state)
  if (!state.unemployed) {
    openEra(state)
    const row = conductRow(state)
    if (row) {
      a.conduct = a.conduct.filter(r => !(r.s === row.s && r.c === row.c))
      a.conduct.push(row)
      if (a.conduct.length > ARC_CAPS.conduct) a.conduct.splice(0, a.conduct.length - ARC_CAPS.conduct)
    }
    const rows = boardSummer(state, row)
    if (rows) arcFile(state, 'arc.verdict', { rows_ll: JSON.stringify(rows) }, { type: 'board', summer: true })
    if (eraYearEnd(state)) tellEra(state, '5', true)
    reputeYearEnd(state)
    announceTraits(state)
  }
  coachYearEnd(state)
  for (const [k, s] of Object.entries(a.said)) if (s < state.season) delete a.said[k]
}

/** jobs.ts resignJob and sackManager, while the desk is still his. */
export function arcLeaveJob(state: GameState, exit: 'sacked' | 'walked'): void {
  if (ARC_OFF.on) return
  closeEra(state, exit === 'sacked' ? 's' : 'w')
  flushArcNews(state)
}

/** jobs.ts takeJob, before the desk moves: a job walked out of for another. */
export function arcBeforeMove(state: GameState, clubId: string): void {
  if (ARC_OFF.on || state.unemployed || state.userClubId === clubId) return
  closeEra(state, 'm')
}

/** jobs.ts takeJob, once the new desk is his. */
export function arcAfterMove(state: GameState): void {
  if (ARC_OFF.on) return
  openEra(state)
  flushArcNews(state)
}
